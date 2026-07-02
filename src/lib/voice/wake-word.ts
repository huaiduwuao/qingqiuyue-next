/**
 * Wake Word 检测 — openWakeWord (开源 MIT, 可商用)
 *
 * openWakeWord: https://github.com/dscripka/openWakeWord
 *   - 浏览器端用 onnxruntime-web 跑 ONNX 模型
 *   - 模型 ~30MB, 可放 public/wake/ 自托管
 *
 * 运行方式:
 *   1. 加载 melspectrogram.onnx (特征提取器, ~10MB)
 *   2. 加载 {label}.onnx (唤醒词模型, ~30MB)
 *   3. VAD 每帧送入 80ms/1280 samples 音频
 *   4. 用 melspectrogram.onnx 提取 1 帧 mel 特征
 *   5. 累积约 31 帧 mel 特征后, 喂给唤醒词模型做推理
 *   6. 置信度 > sensitivity 则触发 onWake
 *
 * 任意环节失败都会自动降级到 vad-fallback (靠 ASR 文本匹配唤醒词)
 */

import * as ort from 'onnxruntime-web'
import { voiceLog } from './logger'
import type { WakeWordConfig } from './types'

export interface WakeWordCallbacks {
  onWake: (label: string, confidence: number) => void
  onError?: (err: any) => void
}

const SAMPLE_RATE = 16000
const FRAME_MS = 80
const FRAME_SAMPLES = (SAMPLE_RATE * FRAME_MS) / 1000 // 1280
const N_FEATURE_FRAMES = 31 // openWakeWord 默认特征帧数 (约 2.48s)
const DEFAULT_SENSITIVITY = 0.5

let engine: OpenWakeWordEngine | null = null

class OpenWakeWordEngine {
  private cfg: WakeWordConfig
  private cbs: WakeWordCallbacks
  private melSession: ort.InferenceSession | null = null
  private wakeSession: ort.InferenceSession | null = null
  // 环形 buffer: 预分配 8192 samples (~512ms),比 80ms 步长大够用
  // 用 head 索引 + take 拷贝避免每帧 slice 重新分配 (原代码 80ms 一次 GC)
  private readonly RING_CAPACITY = 8192
  private audioBuffer: Float32Array = new Float32Array(this.RING_CAPACITY)
  private audioBufferLen = 0  // 当前有效长度
  private featureBuffer: Float32Array[] = [] // 每帧 mel 特征
  private ready = false
  private destroyed = false
  private processing = false
  private pendingAudio: Float32Array[] = []
  // 推理延迟统计 (每 100 帧打一次平均)
  private inferenceCount = 0
  private inferenceTotalMs = 0

  constructor(cfg: WakeWordConfig, cbs: WakeWordCallbacks) {
    this.cfg = cfg
    this.cbs = cbs
  }

  async init(): Promise<boolean> {
    if (!this.cfg.modelUrl) {
      voiceLog('warn', 'wake', '未配置 modelUrl, 降级到 vad-fallback')
      return false
    }

    try {
      // 动态探测 WASM 路径 (兼容 webpack + Turbopack + 自托管)
      // 顺序: webpack 默认 → Turbopack → 同源 /wake/
      ort.env.wasm.wasmPaths = await resolveWasmPaths()

      // melspectrogram 路径: cfg 可覆盖,默认 /wake/melspectrogram.onnx
      const melUrl = (this.cfg as WakeWordConfig & { melModelUrl?: string }).melModelUrl || '/wake/melspectrogram.onnx'
      voiceLog('info', 'wake', 'loading melspectrogram model:', melUrl)
      this.melSession = await ort.InferenceSession.create(melUrl, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      })

      voiceLog('info', 'wake', 'loading wake word model:', this.cfg.modelUrl)
      this.wakeSession = await ort.InferenceSession.create(this.cfg.modelUrl, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      })

      this.ready = true
      voiceLog('info', 'wake', 'openWakeWord init success, label=', this.cfg.label)
      return true
    } catch (err) {
      voiceLog('error', 'wake', 'openWakeWord init failed:', err)
      this.cbs.onError?.(err instanceof Error ? err : new Error(String(err)))
      return false
    }
  }

  /**
   * 把音频加入处理队列; 引擎会异步逐帧推理
   */
  feed(audio: Float32Array): void {
    if (!this.ready || this.destroyed) return
    this.pendingAudio.push(audio)
    if (!this.processing) {
      this.processing = true
      this.processLoop().catch((err) => {
        voiceLog('error', 'wake', 'processLoop error:', err)
      })
    }
  }

  private async processLoop(): Promise<void> {
    while (!this.destroyed && this.pendingAudio.length > 0) {
      const chunks = this.pendingAudio.splice(0)
      for (const audio of chunks) {
        await this.processAudio(audio)
      }
    }
    this.processing = false
  }

  private async processAudio(audio: Float32Array): Promise<void> {
    if (!this.melSession || !this.wakeSession) return

    // 累积到环形 buffer (避免每帧 new Float32Array)
    for (let i = 0; i < audio.length; i++) {
      if (this.audioBufferLen >= this.RING_CAPACITY) {
        // 满了: 整体左移丢弃前半 (保留最近 ~512ms 数据)
        const keep = this.audioBufferLen - FRAME_SAMPLES
        this.audioBuffer.copyWithin(0, FRAME_SAMPLES, this.audioBufferLen)
        this.audioBufferLen = keep
      }
      this.audioBuffer[this.audioBufferLen++] = audio[i]
    }

    // 每次取 1280 samples 跑 mel, 50% overlap 滑动
    while (this.audioBufferLen >= FRAME_SAMPLES) {
      // 拷贝一帧 (1280 samples) 喂给 ONNX — 必须 copy 因为 ONNX 会持有
      const frame = this.audioBuffer.slice(0, FRAME_SAMPLES)
      const score = await this.runFrame(frame)

      if (score !== null && score > (this.cfg.sensitivity ?? DEFAULT_SENSITIVITY)) {
        voiceLog('info', 'wake', `detected "${this.cfg.label}" confidence=${score.toFixed(3)}`)
        this.cbs.onWake(this.cfg.label, score)
      }

      // 50% overlap 滑动: 左移半帧
      this.audioBuffer.copyWithin(0, FRAME_SAMPLES / 2, this.audioBufferLen)
      this.audioBufferLen -= FRAME_SAMPLES / 2
    }
  }

  private async runFrame(frame: Float32Array): Promise<number | null> {
    if (!this.melSession || !this.wakeSession) return null

    try {
      // 1. melspectrogram
      const melInputName = this.melSession.inputNames[0]
      const melOutputName = this.melSession.outputNames[0]
      const melTensor = new ort.Tensor('float32', frame, [1, frame.length])
      const melFeeds: Record<string, ort.Tensor> = { [melInputName]: melTensor }
      const melResult = await this.melSession.run(melFeeds)
      const melOut = melResult[melOutputName]
      const melData = melOut.data as Float32Array
      const melShape = melOut.dims

      // 解析 mel 输出形状, 得到 nMels
      let nMels = 0
      let frameFeatures: Float32Array
      if (melShape.length === 1) {
        nMels = melShape[0]
        frameFeatures = melData
      } else if (melShape.length === 2) {
        nMels = melShape[0] * melShape[1] === melData.length ? melShape[1] : melShape[0]
        frameFeatures = melData.slice(0, nMels)
      } else {
        // 3D: [batch, nMels, 1] 或 [batch, 1, nMels]
        nMels = melShape.length >= 2 ? (melShape[1] > melShape[2] ? melShape[2] : melShape[1]) : 32
        frameFeatures = melData.slice(0, nMels)
      }

      // 2. 累积特征
      this.featureBuffer.push(frameFeatures.slice())
      if (this.featureBuffer.length > N_FEATURE_FRAMES) {
        this.featureBuffer.shift()
      }

      // 3. 特征够帧数后跑唤醒词模型
      if (this.featureBuffer.length < N_FEATURE_FRAMES) {
        return null
      }

      const featureTensorData = new Float32Array(N_FEATURE_FRAMES * nMels)
      for (let t = 0; t < N_FEATURE_FRAMES; t++) {
        for (let m = 0; m < nMels; m++) {
          featureTensorData[t * nMels + m] = this.featureBuffer[t][m] ?? 0
        }
      }

      const wakeInputName = this.wakeSession.inputNames[0]
      const wakeOutputName = this.wakeSession.outputNames[0]
      const wakeTensor = new ort.Tensor('float32', featureTensorData, [1, N_FEATURE_FRAMES, nMels])
      const wakeFeeds: Record<string, ort.Tensor> = { [wakeInputName]: wakeTensor }
      const wakeResult = await this.wakeSession.run(wakeFeeds)
      const wakeOut = wakeResult[wakeOutputName]
      const wakeData = wakeOut.data as Float32Array

      // 输出可能是 [batch, classes] 或 [batch, time, classes]; 取最大值作为置信度
      let score = Number.NEGATIVE_INFINITY
      for (let i = 0; i < wakeData.length; i++) {
        if (wakeData[i] > score) score = wakeData[i]
      }
      return score === Number.NEGATIVE_INFINITY ? null : score
    } catch (err) {
      voiceLog('error', 'wake', 'runFrame error:', err)
      return null
    }
  }

  destroy(): void {
    this.destroyed = true
    this.melSession = null
    this.wakeSession = null
    this.audioBuffer = new Float32Array(this.RING_CAPACITY)
    this.audioBufferLen = 0
    this.featureBuffer = []
    this.pendingAudio = []
    this.ready = false
  }
}

export async function startWakeWord(
  cfg: WakeWordConfig,
  cbs: WakeWordCallbacks
): Promise<{ mode: 'openwakeword' | 'vad-fallback' }> {
  stopWakeWord()

  if (!isOpenWakeWordSupported()) {
    voiceLog('warn', 'wake', '浏览器不支持 Web Audio, 降级到 vad-fallback')
    return { mode: 'vad-fallback' }
  }

  engine = new OpenWakeWordEngine(cfg, cbs)
  const ok = await engine.init()
  return { mode: ok ? 'openwakeword' : 'vad-fallback' }
}

export function stopWakeWord(): void {
  if (engine) {
    engine.destroy()
    engine = null
  }
}

/**
 * 把音频送入 openWakeWord 引擎异步推理
 */
export function processAudioChunk(audio: Float32Array): void {
  engine?.feed(audio)
}

export function isOpenWakeWordSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.AudioContext &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices
  )
}

export function getDefaultWakeWordConfig(): WakeWordConfig {
  return {
    label: '小月',
    modelUrl: '/wake/xiaoyue.onnx',
    melModelUrl: '/wake/melspectrogram.onnx',
    sensitivity: DEFAULT_SENSITIVITY,
  }
}

/**
 * 动态探测 ONNX Runtime WASM 路径
 *
 * Next.js 不会自动 bundle onnxruntime-web 的 WASM/.mjs 运行时,必须手动放
 * public/ 并显式指 wasmPaths。我们把整个 ORT runtime 复制到 public/ort-wasm/。
 *
 * ORT 1.27 实际文件名: 没有了旧版 ort-wasm.wasm,只保留变体
 *   - ort-wasm-simd-threaded.wasm (默认)
 *   - ort-wasm-simd-threaded.{jsep,jspi,asyncify}.wasm (变体)
 * ORT 启动时按 executionProvider 顺序自动选最合适的。
 */
async function resolveWasmPaths(): Promise<string> {
  const localPath = '/ort-wasm/'

  // 验证关键文件能访问(挑 ORT 默认会用的)
  for (const probe of [
    'ort-wasm-simd-threaded.wasm',
    'ort-wasm-simd-threaded.jsep.wasm',
    'ort.mjs',
  ]) {
    try {
      const r = await fetch(localPath + probe, { method: 'HEAD' })
      if (r.ok) {
        voiceLog('info', 'wake', 'wasm path resolved:', localPath, 'via', probe)
        return localPath
      }
    } catch {
      // continue
    }
  }
  voiceLog('warn', 'wake', 'no WASM found in /ort-wasm/, falling back to Next.js default (likely broken)')
  return '/_next/static/chunks/'
}

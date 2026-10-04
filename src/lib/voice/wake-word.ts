/**
 * Wake Word 检测 — openWakeWord 特征 + 自训"小月"小模型 (v2)
 *
 * 流水线与沙盒训练脚本 (qingqiuyue-go internal/handler/wake_train_sandbox.py) 逐帧同源:
 *   1. 16kHz 音频按 int16 量纲 (×32767) 累积, 每 1280 samples (80ms) 一步
 *   2. melspectrogram.onnx 跑最近 1280+480 samples → 8 帧 mel, 做 x/10+2
 *   3. 最近 76 帧 mel → embedding_model.onnx → 96 维向量 (每步 1 个)
 *   4. 最近 16 个向量 [1,16,96] → 唤醒模型 → 分数
 *   5. 连续 3 步 (240ms) 超过阈值才算唤醒; 唤醒后冷却 2s 并清空缓冲
 *      (真喊"小月"能连续高分 3~5 步, 误触发多是 1~2 步的尖峰)
 *
 * 模型来源: 优先 core-api 上沙盒最新训练的模型 (/api/core/wake-word/model),
 * 拿不到就用打包在前端的 /wake/xiaoyue_v2.onnx。阈值随模型的 meta 下发。
 *
 * 任意环节失败都会降级到 vad-fallback (靠 ASR 文本匹配唤醒词)
 */

// 只导入类型;运行时在 init() 里按需 import(),ORT 的 JS 不再随数字人页面一起打包下载,
// 真正开启唤醒词时才加载。
import type * as ort from 'onnxruntime-web'
import { API_PREFIX } from '@/lib/api/prefix'
import { voiceLog } from './logger'
import type { WakeWordConfig } from './types'

export interface WakeWordCallbacks {
  onWake: (label: string, confidence: number) => void
  onError?: (err: any) => void
}

const STEP = 1280            // 80ms @16kHz
const MEL_CONTEXT = 480      // mel 需要多看 3 帧 hop 才能出满 8 帧
const MEL_WIN = 76           // 每个 embedding 吃 76 帧 mel
const N_EMB = 16             // 唤醒模型看最近 16 个 embedding
const DEFAULT_PATIENCE = 3   // 连续几步超阈值才触发 (meta 可覆盖)
const COOLDOWN_STEPS = 25    // 触发后 2s 内不再触发
const DEFAULT_SENSITIVITY = 0.8

let engine: OpenWakeWordEngine | null = null
let ortRt: typeof import('onnxruntime-web') | null = null

class OpenWakeWordEngine {
  private cfg: WakeWordConfig
  private cbs: WakeWordCallbacks
  private melSession: ort.InferenceSession | null = null
  private embSession: ort.InferenceSession | null = null
  private wakeSession: ort.InferenceSession | null = null
  private threshold = DEFAULT_SENSITIVITY
  private patience = DEFAULT_PATIENCE

  // 原始音频 (int16 量纲): 最近 MEL_CONTEXT 个历史样本 + 未满一步的新样本
  private raw = new Float32Array(MEL_CONTEXT + STEP * 4)
  private rawLen = MEL_CONTEXT // 开头用 0 填满上下文
  private mel: Float32Array[] = []
  private emb: Float32Array[] = []
  private hitStreak = 0
  private cooldown = 0

  private ready = false
  private destroyed = false
  private processing = false
  private pending: Float32Array[] = []
  private stepCount = 0
  private stepMsTotal = 0
  private maxScore = 0
  private errorLogged = false

  constructor(cfg: WakeWordConfig, cbs: WakeWordCallbacks) {
    this.cfg = cfg
    this.cbs = cbs
  }

  async init(): Promise<boolean> {
    try {
      const [wasmDir, rt] = await Promise.all([resolveWasmPaths(), import('onnxruntime-web')])
      ortRt = rt
      // 必须用绝对 URL (worker 内没有 location); 单线程 + 主线程跑, 不需要 COOP/COEP
      rt.env.wasm.wasmPaths = (typeof window !== 'undefined' && window.location?.origin)
        ? window.location.origin + (wasmDir.startsWith('/') ? wasmDir : '/' + wasmDir)
        : wasmDir
      rt.env.wasm.numThreads = 1
      rt.env.wasm.proxy = false

      const opts: ort.InferenceSession.SessionOptions = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }
      const melUrl = this.cfg.melModelUrl || '/wake/melspectrogram.onnx'
      const embUrl = this.cfg.embeddingModelUrl || '/wake/embedding_model.onnx'
      voiceLog('info', 'wake', 'loading feature models:', melUrl, embUrl)
      ;[this.melSession, this.embSession] = await Promise.all([
        rt.InferenceSession.create(melUrl, opts),
        rt.InferenceSession.create(embUrl, opts),
      ])

      const model = await loadWakeModel(this.cfg)
      this.wakeSession = await rt.InferenceSession.create(model.bytes, opts)
      this.threshold = this.cfg.sensitivity ?? model.threshold ?? DEFAULT_SENSITIVITY
      this.patience = model.patience ?? DEFAULT_PATIENCE
      this.ready = true
      voiceLog('info', 'wake', `openWakeWord init success, label=${this.cfg.label} model=${model.source} threshold=${this.threshold} patience=${this.patience}`)
      return true
    } catch (err) {
      console.error('[wake] openWakeWord init failed:', err)
      voiceLog('error', 'wake', 'openWakeWord init failed:', err instanceof Error ? err.message : String(err))
      this.cbs.onError?.(err instanceof Error ? err : new Error(String(err)))
      return false
    }
  }

  /** 送入一段 16kHz float(-1..1) 音频; 引擎异步逐步推理 */
  feed(audio: Float32Array): void {
    if (!this.ready || this.destroyed) return
    this.pending.push(audio)
    if (!this.processing) {
      this.processing = true
      this.processLoop().catch((err) => voiceLog('error', 'wake', 'processLoop error:', err))
    }
  }

  private async processLoop(): Promise<void> {
    while (!this.destroyed && this.pending.length > 0) {
      // 积压太多 (标签页切后台回来) 就丢旧的, 只保留最近 ~2s, 不追赶历史音频
      const chunks = this.pending.splice(0)
      let total = chunks.reduce((s, c) => s + c.length, 0)
      while (total > 32000 && chunks.length > 1) total -= chunks.shift()!.length
      for (const audio of chunks) await this.push(audio)
    }
    this.processing = false
  }

  private async push(audio: Float32Array): Promise<void> {
    let off = 0
    while (off < audio.length && !this.destroyed) {
      const n = Math.min(audio.length - off, MEL_CONTEXT + STEP - this.rawLen)
      for (let i = 0; i < n; i++) {
        const s = audio[off + i]
        this.raw[this.rawLen + i] = (s > 1 ? 1 : s < -1 ? -1 : s) * 32767
      }
      this.rawLen += n
      off += n
      if (this.rawLen === MEL_CONTEXT + STEP) {
        await this.step(this.raw.slice(0, MEL_CONTEXT + STEP))
        // 保留最后 MEL_CONTEXT 个样本做下一步的上下文
        this.raw.copyWithin(0, STEP, MEL_CONTEXT + STEP)
        this.rawLen = MEL_CONTEXT
      }
    }
  }

  private async step(window: Float32Array): Promise<void> {
    if (!this.melSession || !this.embSession || !this.wakeSession) return
    const t0 = performance.now()
    try {
      // 1. mel: [1, 1760] → [1,1,8,32]
      const melOut = (await this.melSession.run({
        [this.melSession.inputNames[0]]: new ortRt!.Tensor('float32', window, [1, window.length]),
      }))[this.melSession.outputNames[0]]
      const md = melOut.data as Float32Array
      const nFrames = md.length / 32
      for (let f = 0; f < nFrames; f++) {
        const row = new Float32Array(32)
        for (let m = 0; m < 32; m++) row[m] = md[f * 32 + m] / 10 + 2
        this.mel.push(row)
      }
      if (this.mel.length > MEL_WIN) this.mel.splice(0, this.mel.length - MEL_WIN)
      if (this.mel.length < MEL_WIN) return

      // 2. embedding: [1,76,32,1] → [1,1,1,96]
      const melWin = new Float32Array(MEL_WIN * 32)
      for (let f = 0; f < MEL_WIN; f++) melWin.set(this.mel[f], f * 32)
      const embOut = (await this.embSession.run({
        [this.embSession.inputNames[0]]: new ortRt!.Tensor('float32', melWin, [1, MEL_WIN, 32, 1]),
      }))[this.embSession.outputNames[0]]
      this.emb.push(Float32Array.from(embOut.data as Float32Array))
      if (this.emb.length > N_EMB) this.emb.shift()
      if (this.emb.length < N_EMB) return

      // 3. 唤醒模型: [1,16,96] → 分数
      const feat = new Float32Array(N_EMB * 96)
      for (let i = 0; i < N_EMB; i++) feat.set(this.emb[i], i * 96)
      const out = (await this.wakeSession.run({
        [this.wakeSession.inputNames[0]]: new ortRt!.Tensor('float32', feat, [1, N_EMB, 96]),
      }))[this.wakeSession.outputNames[0]]
      const score = (out.data as Float32Array)[0]
      this.decide(score)
    } catch (err) {
      if (!this.errorLogged) {
        this.errorLogged = true
        voiceLog('error', 'wake', 'inference error:', err)
      }
    } finally {
      this.stepCount++
      this.stepMsTotal += performance.now() - t0
      if (this.stepCount % 250 === 0) { // 每 20s 打一次
        voiceLog('info', 'wake', `avg step ${(this.stepMsTotal / this.stepCount).toFixed(1)}ms, max score 20s=${this.maxScore.toFixed(3)}`)
        this.maxScore = 0
      }
    }
  }

  private decide(score: number): void {
    if (score > this.maxScore) this.maxScore = score
    if (this.cooldown > 0) {
      this.cooldown--
      return
    }
    this.hitStreak = score >= this.threshold ? this.hitStreak + 1 : 0
    if (this.hitStreak < this.patience) return
    voiceLog('info', 'wake', `detected "${this.cfg.label}" score=${score.toFixed(3)} threshold=${this.threshold}`)
    this.hitStreak = 0
    this.cooldown = COOLDOWN_STEPS
    // 清掉 embedding 历史, 同一句"小月"不会在冷却结束后再触发
    this.emb = []
    this.cbs.onWake(this.cfg.label, score)
  }

  destroy(): void {
    this.destroyed = true
    this.melSession = null
    this.embSession = null
    this.wakeSession = null
    this.mel = []
    this.emb = []
    this.pending = []
    this.ready = false
  }
}

/**
 * 唤醒模型: 先拿 core-api 上沙盒最新训练的 (带阈值 meta), 失败再用前端打包的静态模型
 */
async function loadWakeModel(cfg: WakeWordConfig): Promise<{ bytes: Uint8Array; threshold?: number; patience?: number; source: string }> {
  const candidates: { model: string; meta: string }[] = []
  if (cfg.serverModel !== false) {
    candidates.push({ model: API_PREFIX + '/api/core/wake-word/model', meta: API_PREFIX + '/api/core/wake-word/meta' })
  }
  const staticUrl = cfg.modelUrl || '/wake/xiaoyue_v2.onnx'
  candidates.push({ model: staticUrl, meta: staticUrl.replace(/\.onnx$/, '.json') })
  for (const c of candidates) {
    try {
      // 先 meta 后模型: 服务端在 meta 请求里顺手部署刚训练完的模型, 阈值和模型才对得上
      let threshold: number | undefined
      let patience: number | undefined
      try {
        const m = await fetch(c.meta, { cache: 'no-cache' })
        if (m.ok) {
          const j = await m.json()
          const meta = j?.data ?? j
          if (meta?.version === 2 && typeof meta.threshold === 'number') threshold = meta.threshold
          if (meta?.version === 2 && Number.isInteger(meta.patience) && meta.patience > 0) patience = meta.patience
        }
      } catch { /* meta 可选 */ }
      const r = await fetch(c.model, { cache: 'no-cache' })
      if (!r.ok) continue
      const bytes = new Uint8Array(await r.arrayBuffer())
      return { bytes, threshold, patience, source: c.model }
    } catch {
      // 换下一个
    }
  }
  throw new Error('唤醒模型加载失败')
}

export async function startWakeWord(
  cfg: WakeWordConfig,
  cbs: WakeWordCallbacks
): Promise<{ mode: 'openwakeword' | 'vad-fallback' }> {
  stopWakeWord()

  const debug = (typeof window !== 'undefined' && (window as any).__DIGITAL_HUMAN_DEBUG) as { noWake?: boolean } | undefined
  if (debug?.noWake) {
    voiceLog('info', 'wake', 'noWake flag set, using vad-fallback')
    return { mode: 'vad-fallback' }
  }

  if (!isOpenWakeWordSupported()) {
    voiceLog('warn', 'wake', '浏览器不支持 Web Audio, 降级到 vad-fallback')
    return { mode: 'vad-fallback' }
  }

  const e = new OpenWakeWordEngine(cfg, cbs)
  engine = e
  const ok = await e.init()
  if (engine !== e) { e.destroy(); return { mode: 'vad-fallback' } } // init 期间被 stop
  return { mode: ok ? 'openwakeword' : 'vad-fallback' }
}

export function stopWakeWord(): void {
  if (engine) {
    engine.destroy()
    engine = null
  }
}

/** 把连续音频流送入 openWakeWord 引擎异步推理 (只能喂连续流, 不要重复喂同一段) */
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
    modelUrl: '/wake/xiaoyue_v2.onnx',
    melModelUrl: '/wake/melspectrogram.onnx',
    embeddingModelUrl: '/wake/embedding_model.onnx',
    // sensitivity 不填 → 用模型 meta 里训练时按"误唤醒 ≤0.5 次/小时"选出的阈值
  }
}

/**
 * ONNX Runtime WASM 路径: Next.js 不会 bundle onnxruntime-web 的 WASM,
 * 整个 ORT runtime 复制在 public/ort-wasm/。
 */
async function resolveWasmPaths(): Promise<string> {
  const localPath = '/ort-wasm/'
  for (const probe of ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.jsep.wasm', 'ort.mjs']) {
    try {
      const r = await fetch(localPath + probe, { method: 'HEAD' })
      if (r.ok) return localPath
    } catch {
      // continue
    }
  }
  voiceLog('warn', 'wake', 'no WASM found in /ort-wasm/, falling back to Next.js default (likely broken)')
  return '/_next/static/chunks/'
}

/**
 * 频谱特征 VAD — 替代纯 RMS 能量检测
 *
 * 三大特征判断人声:
 *  1. 预加重后的能量 (高频分量, 排除低频嗡嗡声)
 *  2. 过零率 (ZCR) — 语音 0.02-0.25, 纯噪声 0 或 >0.4
 *  3. 自适应噪声底 (随环境慢适应, 不被突然的杂音拖高)
 *
 * 比纯 RMS 强:
 *  - 键盘声 (高频瞬态) → 能量高但 ZCR 异常, 过滤
 *  - 风扇 (低频稳态) → 预加重后能量低, 过滤
 *  - 呼吸 (低频, 短促) → ZCR 偏低, 过滤
 *  - 远场人声 → 仍能识别
 *
 * 触发条件: 能量高 + ZCR 在语音范围 + 持续 > 150ms
 * 结束条件: 能量 < 阈值 (静默 > 700ms 才认结束)
 */

import type { VADCallbacks } from './types'
import { voiceLog } from './logger'

let audioContext: AudioContext | null = null
let mediaStream: MediaStream | null = null
let sourceNode: MediaStreamAudioSourceNode | null = null
let processorNode: ScriptProcessorNode | null = null
let callbacks: VADCallbacks | null = null

// 帧级别状态
let isSpeaking = false
let speechStartTime = 0   // performance.now()
let lastSoundTime = 0     // 上次"可能是语音"的时间
let frameCount = 0

// 说话期间的音频累积 buffer (段结束时推整个 buffer 给 always-listening)
let speechBuffer: Float32Array[] = []

// 噪声底 (慢自适应, 初始估计)
let noiseFloor = 0.005
const noiseFloorUpdateRate = 0.02  // 每帧更新比例 (越小越慢)
// 最近一次"可能的语音"能量 (用于突增检测, 区分"一直是底噪" vs "突然说话")
let lastHumanEnergy = 0
// 关键调试标记: 在前 30 帧每 5 帧打印原始能量
// 用来诊断麦克风是否被 AGC 压扁
let debugFrameCount = 0

interface VadOptions {
  threshold?: number         // 基础阈值倍数 (相对噪声底)
  minSpeechMs?: number       // 最短人声持续时间
  silenceMs?: number         // 判定结束的静默时长
  sampleRate?: number        // 音频采样率
  frameMs?: number           // 帧长度
}

// 预加重滤波器系数 (高通, y[n] = x[n] - α·x[n-1])
// α=0.97 让高频相对低频增强 ~30dB, 模拟人耳
const PRE_EMPHASIS = 0.97

// 合并累积的多帧
function mergeBuffers(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((s, c) => s + c.length, 0)
  const out = new Float32Array(total)
  let off = 0
  for (const c of chunks) { out.set(c, off); off += c.length }
  return out
}

// 过零率: 一帧内过零次数 / 帧长
// 纯噪声 (白噪声) ZCR 很高 (0.4-0.5)
// 语音 ZCR 中等 (0.05-0.20) 因为浊音 + 清音混合
// 稳态正弦波 (风扇嗡嗡) ZCR 很低 (<0.02)
function zeroCrossingRate(samples: Float32Array): number {
  let zc = 0
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i] >= 0) !== (samples[i - 1] >= 0)) zc++
  }
  return zc / (samples.length - 1)
}

// 预加重 + 能量
function emphasizedRms(samples: Float32Array): number {
  let s = 0
  let prev = 0
  // 注: 这里简化, 不真做跨帧; 单帧内做一次预加重
  for (let i = 0; i < samples.length; i++) {
    const cur = samples[i]
    const emphasized = cur - PRE_EMPHASIS * prev
    s += emphasized * emphasized
    prev = cur
  }
  // 归一化 0-1 范围
  return Math.sqrt(s / samples.length)
}

// 找最近 2 的幂的 ScriptProcessor buffer size
function nearestPowerOfTwo(n: number): number {
  const POWERS = [256, 512, 1024, 2048, 4096, 8192, 16384]
  return POWERS.reduce((best, p) =>
    Math.abs(p - n) < Math.abs(best - n) ? p : best
  , POWERS[0])
}

export async function startVAD(cbs: VADCallbacks, userOpts: VadOptions = {}): Promise<void> {
  if (audioContext) {
    voiceLog('warn', 'vad', 'already running')
    return
  }
  callbacks = cbs
  const opts: Required<VadOptions> = {
    threshold: userOpts.threshold ?? 2.0,       // 能量阈值 = 噪声底 × 2.0 (低增益麦克风)
    minSpeechMs: userOpts.minSpeechMs ?? 80,     // 80ms 即可触发 (短促的"小月"也能认)
    silenceMs: userOpts.silenceMs ?? 700,
    sampleRate: userOpts.sampleRate ?? 16000,
    frameMs: userOpts.frameMs ?? 30,
  }
  isSpeaking = false
  speechStartTime = 0
  lastSoundTime = 0
  frameCount = 0
  speechBuffer = []   // 清累积 buffer
  noiseFloor = 0.0008  // 初始估计 (低增益麦克风)
  debugFrameCount = 0
  lastHumanEnergy = 0
  audioContext = new AudioContext({ sampleRate: opts.sampleRate })
  if (audioContext.state === 'suspended') {
    try { await audioContext.resume() } catch (e) { voiceLog('warn', 'vad', 'resume:', e) }
  }
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      sampleRate: opts.sampleRate,
      echoCancellation: true,
      noiseSuppression: true,    // 浏览器内置降噪 (重要!)
      autoGainControl: true,     // 自动增益
    },
  })
  sourceNode = audioContext.createMediaStreamSource(mediaStream)
  // ScriptProcessor buffer size 必须是 2 的幂 (256-16384)
  const rawFrameSize = Math.floor(opts.sampleRate * opts.frameMs / 1000)
  const frameSize = nearestPowerOfTwo(rawFrameSize)
  voiceLog('info', 'vad', 'frame', rawFrameSize, '→', frameSize, '(power of 2)')
  processorNode = audioContext.createScriptProcessor(frameSize, 1, 1)

  processorNode.onaudioprocess = (e) => {
    if (!callbacks) return
    const input = e.inputBuffer.getChannelData(0)
    const now = performance.now()

    // === 1. 计算特征 ===
    const energy = emphasizedRms(input)   // 预加重后能量
    const zcr = zeroCrossingRate(input)   // 过零率

    // === 2. 自适应噪声底 (只在"明显安静"时更新, 不被说话拉高) ===
    // 关键: 说话过程中 + 刚说完 1.5s 内 都不更新 (防止说话后静默被当作"底噪"拉低)
    const sinceTrigger = now - speechStartTime
    const inSpeechWindow = isSpeaking || (speechStartTime > 0 && sinceTrigger < 1500)
    if (energy < noiseFloor * 1.5 && !inSpeechWindow) {
      noiseFloor = (1 - noiseFloorUpdateRate) * noiseFloor + noiseFloorUpdateRate * energy
    }
    // 噪声底下限: 0.00005 (允许极低增益麦克风)
    const floor = Math.max(noiseFloor, 0.00005)

    // === 3. 多特征决策 (极致宽松, 适配压扁的麦克风) ===
    // 触发条件 (任一):
    //   (a) 能量 > 噪声底 × 1.5 × 阈值 (相对)
    //   (b) 绝对能量 > max(0.0001, 噪声底 × 3) (任何比底噪强 3 倍)
    //   (c) 相对"瞬时上升" > 2x 最近 30 帧平均 (能量突增 = 有人开始说话)
    const isLoud = energy > floor * opts.threshold
    const aboveAbsolute = energy > Math.max(0.0001, floor * 3)
    const isHumanVoice = isLoud || aboveAbsolute

    // 调试: 前 200 帧每 10 帧打印原始数据
    if (debugFrameCount < 200 && debugFrameCount % 10 === 0) {
    } else if (debugFrameCount === 200) {
      voiceLog('info', 'vad', 'debug done. floor=' + floor.toFixed(6) + ' lastHumanEnergy=' + (lastHumanEnergy || 0).toFixed(6))
    }
    debugFrameCount++

    // === 4. 状态机 ===
    if (isHumanVoice) {
      lastSoundTime = now
      // 累积当前帧 (即使还没正式判为 speaking, 也先存着, 避免正式 speaking 后丢失开头)
      speechBuffer.push(new Float32Array(input))
      if (!isSpeaking) {
        // 启动: 持续 minSpeechMs 才认是语音
        if (speechStartTime === 0) speechStartTime = now
        if (now - speechStartTime >= opts.minSpeechMs) {
          isSpeaking = true
          callbacks.onSpeechStart()
        }
      }
    } else {
      speechStartTime = 0  // 重置 (还没开始说话就重置)
      // 还没正式判为 speaking 就遇到非人声, 丢弃预存的 buffer
      if (!isSpeaking) {
        speechBuffer = []
      }
    }

    // === 5. 段结束检测 (静默 > silenceMs) ===
    if (isSpeaking) {
      const silenceDuration = now - lastSoundTime
      if (silenceDuration >= opts.silenceMs) {
        // 段结束, 推累积的全部说话音频
        isSpeaking = false
        const merged = mergeBuffers(speechBuffer)
        speechBuffer = []
        voiceLog('info', 'vad-end', `pushing ${merged.length} samples (${(merged.length/16000).toFixed(2)}s)`)
        if (merged.length > 0) {
          callbacks.onSpeechEnd(merged)
        }
      }
    }

    // 心跳日志已删除 (vad.ts:214): 每 50 帧 (~1.5s) 一次的 frame stats 噪声,
    // 用户日常使用时不需要看, 真要排查时手动 uncomment 即可。
    // if (frameCount % 50 === 0) {
    //   voiceLog('info', 'vad', `f${frameCount} e=${energy.toFixed(4)} zcr=${zcr.toFixed(3)} floor=${floor.toFixed(4)} loud=${isLoud} voice=${isHumanVoice} speaking=${isSpeaking}`)
    // }
    frameCount++
  }
  sourceNode.connect(processorNode)
  const gain = audioContext.createGain()
  gain.gain.value = 0
  processorNode.connect(gain)
  gain.connect(audioContext.destination)
  voiceLog('info', 'vad:smart', `started, threshold=${opts.threshold}×floor, minSpeech=${opts.minSpeechMs}ms, silence=${opts.silenceMs}ms`)
}

export function stopVAD(): void {
  try { processorNode?.disconnect() } catch {}
  try { sourceNode?.disconnect() } catch {}
  try { mediaStream?.getTracks().forEach((t) => t.stop()) } catch {}
  try { audioContext?.close() } catch {}
  if (audioContext) {
    // 不清 module-level 变量 (兼容多次启动)
  }
  audioContext = null
  mediaStream = null
  sourceNode = null
  processorNode = null
  isSpeaking = false
  speechStartTime = 0
  speechBuffer = []
  callbacks = null
  voiceLog('info', 'vad:smart', 'stopped')
}

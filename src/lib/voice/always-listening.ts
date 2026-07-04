/**
 * Always-Listening Voice Agent — wake word + barge-in 状态机
 *
 * 流程 (用户说 "小月" 唤醒):
 *   麦克风持续监听
 *     ↓ VAD 检测到人声段 (VAD 段 = 一次"说话" 直到停顿 1.2s)
 *     ↓ ASR 转写
 *     ↓
 *     ┌─────────────────────────────────────────────┐
 *     │ state == 'idle' (数字人没在说话)            │
 *     │   文本含唤醒词?                              │
 *     │     是 → state='recording'                   │
 *     │     否 → 丢弃, 继续监听                       │
 *     ├─────────────────────────────────────────────┤
 *     │ state == 'recording'                         │
 *     │   整段文本 = 用户命令                        │
 *     │   发给 onCommand                              │
 *     │   state='processing' (结束后回 'idle')        │
 *     └─────────────────────────────────────────────┘
 *
 * Barge-in (打断):
 *   数字人在说话 (avatarSpeaking=true)
 *     ↓ 用户说 "小月" 触发唤醒词
 *     ↓
 *     调 onInterrupt() (停止数字人 audio + 清状态)
 *     然后正常进入 recording 流程
 *
 * 优势: 单个 MediaStream + 单个 VAD, 不需要 openWakeWord
 *       (Qwen3-ASR 转写几秒的音频, 检测 "小月" 是否在文本里)
 */

import { startVAD, stopVAD } from './vad'
import { transcribe, encodeWAV } from './asr-stream'
import { voiceLog } from './logger'
import {
  startWakeWord,
  stopWakeWord,
  processAudioChunk,
  getDefaultWakeWordConfig,
} from './wake-word'
import type { VoiceEvent, VoiceState, WakeWordConfig } from './types'

export type VoiceAgentMode = 'idle' | 'recording' | 'processing'

export interface AlwaysListeningOptions {
  /** ASR gateway URL (经 Next.js 代理或直连) */
  asrGatewayUrl?: string
  /** ASR 模型名 */
  asrModel?: string
  /** 识别语种 */
  language?: string
  /** 唤醒词配置 (openWakeWord); 不传则使用默认 "小月" 并降级到 ASR 文本匹配 */
  wakeWord?: WakeWordConfig
  /** 唤醒词列表 (默认: ['小月', '清秋月', '清秋']), 作为 ASR fallback */
  wakePhrases?: string[]
  /** 识别出用户命令后调用 */
  onCommand: (text: string) => Promise<void> | void
  /** 状态变化时 (UI 状态指示) */
  onStateChange?: (ev: VoiceEvent) => void
  /** 唤醒词命中时 */
  onWakeWord?: (label: string) => void
  /** 数字人正在说时被打断 */
  onInterrupt?: () => void
  /** 查询数字人是否正在说 (每次 ASR 段处理时调, 用于判断要不要触发打断) */
  isAvatarSpeaking?: () => boolean
  /** WS 发送函数 (可选, 用于流式 ASR: 直接发 PCM chunk 到 WS, 不走 HTTP) */
  wsSend?: (msg: { type: string; pcm?: string; language?: string }) => void
  /** WS 是否已连接 (用于判断是否走 WS ASR) */
  wsConnected?: () => boolean
}

export class AlwaysListening {
  private state: VoiceAgentMode = 'idle'
  private listeners = new Set<(ev: VoiceEvent) => void>()
  private opts: AlwaysListeningOptions

  // 当前 VAD 段 (VAD 检测到一段人声期间的累计音频)
  private candidateChunks: Float32Array[] = []
  // 段结束处理定时器 (等 500ms 确认没有新的人声)
  private segmentEndTimer: any = null
  // 唤醒后累积的命令 buffer (跨多个 VAD 段)
  private commandBuffer: Float32Array[] = []
  // 主动作开关
  private active = false
  // 2s 静默检测: 唤醒后无新段时触发命令处理
  private silenceTimer: any = null
  // 静默阈值 (ms) — 用户停止说话 2s 就认为说完了
  private static readonly SILENCE_MS = 2000
  // VAD 屏蔽时间戳 (毫秒) — "我在听" TTS 播放期间屏蔽 VAD, 防止它把 cue 音频当命令
  private muteVadUntilMs = 0
  // 唤醒后最久等待 (用户可能走开), 超时放弃
  private static readonly MAX_WAIT_MS = 30000
  private maxWaitTimer: any = null
  // openWakeWord 工作模式
  private wakeMode: 'openwakeword' | 'vad-fallback' = 'vad-fallback'
  private wakeConfig: WakeWordConfig = getDefaultWakeWordConfig()

  constructor(opts: AlwaysListeningOptions) {
    this.opts = opts
  }

  on(fn: (ev: VoiceEvent) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(ev: Partial<VoiceEvent>): void {
    const full: VoiceEvent = { state: this.state as VoiceState, ts: Date.now(), ...ev }
    this.listeners.forEach((fn) => {
      try { fn(full) } catch (e) { voiceLog('error', 'voice', 'listener err:', e) }
    })
    this.opts.onStateChange?.(full)
  }

  private setState(s: VoiceAgentMode): void {
    this.state = s
  }

  async start(): Promise<void> {
    if (this.active) return
    this.active = true

    // 初始化 openWakeWord
    this.wakeConfig = this.opts.wakeWord || getDefaultWakeWordConfig()
    const wakeResult = await startWakeWord(this.wakeConfig, {
      onWake: (label, confidence) => {
        voiceLog('info', 'voice', `openWakeWord detected: ${label} (${confidence.toFixed(3)})`)
        this.handleWakeWord(label)
      },
      onError: (err) => {
        voiceLog('warn', 'voice', 'openWakeWord error:', err.message)
      },
    })
    this.wakeMode = wakeResult.mode
    voiceLog('info', 'voice', 'wake word mode:', this.wakeMode)

    await startVAD({
      onSpeechStart: () => {
        // 屏蔽期内 VAD 段不处理 (防止 TTS cue 音频被当成命令)
        if (Date.now() < this.muteVadUntilMs) return
        this.onSpeechStart()
      },
      onSpeechEnd: (audio: Float32Array) => {
        if (Date.now() < this.muteVadUntilMs) return
        this.onSpeechEnd(audio)
      },
    }, {
      // 段结束静默 800ms(原默认 700ms,稍微放宽抗噪,延迟仍可控)
      silenceMs: 800,
    })
    this.setState('idle')
    this.emit({})
    voiceLog('info', 'voice', 'started, waiting for wake word:', this.opts.wakePhrases || ['小月','清秋月','清秋'])
  }

  /**
   * 播放"我在听"反馈 (浏览器 SpeechSynthesis 瞬时播放)
   * 同时屏蔽 VAD 防止它把 cue 音频当命令
   *
   * 屏蔽时长 6s(原 4s 不够 — 中文 TTS "我在听, 请讲" 实测 3-4.5s,
   * 加上尾音 0.5-1s,以及用户从听到 cue 到开口的反应 1-2s,4s 太紧会吞首字)。
   * 同时挂 onend 事件:TTS 真播完就立即解除屏蔽(比固定 6s 提前释放,
   * 减少对正常说话的影响)。
   */
  private playWakeCue(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    // 屏蔽 VAD 6 秒 (TTS cue ~4s + 用户反应 ~2s)
    this.muteVadUntilMs = Date.now() + 6000
    try {
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance('我在听, 请讲')
      utter.lang = 'zh-CN'
      utter.rate = 1.0
      utter.pitch = 1.0
      // TTS 实际结束时立即解除屏蔽(比固定 6s 早)
      utter.onend = () => {
        if (Date.now() < this.muteVadUntilMs) {
          this.muteVadUntilMs = 0
          voiceLog('info', 'voice', 'wake cue ended early, VAD unmuted')
        }
      }
      utter.onerror = () => {
        this.muteVadUntilMs = 0
      }
      window.speechSynthesis.speak(utter)
      voiceLog('info', 'voice', 'playing wake cue: 我在听, 请讲 (VAD muted 6s, early-release on onend)')
    } catch (e) {
      // TTS 失败也要解除屏蔽
      this.muteVadUntilMs = 0
      voiceLog('warn', 'voice', 'TTS cue failed:', (e as Error).message)
    }
  }

  /**
   * 播放"处理中"反馈 (告诉用户听到了, 正在想)
   */
  private playProcessingCue(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    try {
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance('我想想')
      utter.lang = 'zh-CN'
      utter.rate = 1.0
      utter.pitch = 1.0
      window.speechSynthesis.speak(utter)
    } catch (e) {
      voiceLog('warn', 'voice', 'TTS cue failed:', (e as Error).message)
    }
  }

  /**
   * 播放"放弃"反馈 (用户没说, 系统放弃等待)
   */
  private playGiveUpCue(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    try {
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance('有事再来找我吧')
      utter.lang = 'zh-CN'
      utter.rate = 1.0
      utter.pitch = 1.0
      window.speechSynthesis.speak(utter)
    } catch (e) {
      voiceLog('warn', 'voice', 'TTS cue failed:', (e as Error).message)
    }
  }

  stop(): void {
    if (!this.active) return
    this.active = false
    stopVAD()
    stopWakeWord()
    if (this.segmentEndTimer) clearTimeout(this.segmentEndTimer)
    if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null }
    if (this.maxWaitTimer) { clearTimeout(this.maxWaitTimer); this.maxWaitTimer = null }
    this.setState('idle')
    this.candidateChunks = []
    this.commandBuffer = []
    this.emit({})
  }

  private onSpeechStart(): void {
    // VAD 检测到人声起 — 立刻开始累积候选音频
    this.candidateChunks = []
    // ⚠️ 不再在这里清 silenceTimer — 之前的设计是"用户开始说话就重置静默计时",
    // 但在 noisy 环境下 VAD 频繁触发 onSpeechStart,导致 2s 静默计时器永远清零,
    // onSilenceDetected 永远不触发 → 唤醒后用户说命令,数字人不响应
    //
    // 修复: 静默计时器改在 onSpeechEnd 重启(段结束 = 候选停顿 = 真正静默起点)
    this.emit({})
  }

  private onSpeechEnd(audio: Float32Array): void {
    voiceLog('info', 'voice', `onSpeechEnd called, audio.length=${audio.length} (${(audio.length/16000).toFixed(2)}s), state=${this.state}, avatarSpeaking=${this.opts.isAvatarSpeaking?.()}`)
    // VAD 检测到本段结束 (1.2s 静音, redemptionMs=1200)
    this.candidateChunks.push(audio)

    // 把音频喂给 openWakeWord(不限制 state — barge-in 场景下数字人说话时
    // 也需要本地推理检测唤醒词,不然要等 2s 静默 + ASR 完整转写)
    if (this.wakeMode === 'openwakeword') {
      processAudioChunk(audio)
    }

    // 在 recording 状态: 累积到 command buffer
    // 但如果数字人正在说话, 它自己的音频也会被 VAD 捕获 → 丢弃
    if (this.state === 'recording' && !this.opts.isAvatarSpeaking?.()) {
      this.commandBuffer.push(audio)
    } else if (this.state === 'recording' && this.opts.isAvatarSpeaking?.()) {
      voiceLog('info', 'voice', 'ignore VAD segment (avatar speaking)')
    }
    // 段结束处理定时器 (等 200ms 看有没有接续 — 从 500ms 缩短,降低首字响应)
    if (this.segmentEndTimer) clearTimeout(this.segmentEndTimer)
    this.segmentEndTimer = setTimeout(() => this.processSegment(), 200)

    // 唤醒后 command 静默计时器 — 移到 onSpeechEnd 重启(原在 onSpeechStart 清, noisy 永远清不掉)
    if (this.state === 'recording') {
      if (this.silenceTimer) clearTimeout(this.silenceTimer)
      this.silenceTimer = setTimeout(() => this.onSilenceDetected(), AlwaysListening.SILENCE_MS)
    }
  }

  /**
   * 唤醒词命中后的统一处理 (openWakeWord 回调或 ASR fallback 都会走这里)
   */
  private handleWakeWord(label: string): void {
    if (this.state !== 'idle') return

    // 数字人正在说? 触发打断
    if (this.opts.isAvatarSpeaking?.()) {
      voiceLog('info', 'voice', 'barge-in: interrupting avatar')
      this.opts.onInterrupt?.()
    }

    this.setState('recording')
    this.emit({ wakeWord: label })
    this.opts.onWakeWord?.(label)

    // 把当前段(含唤醒词)复制到 commandBuffer; 后续段也会累积, 2s 静默后一起 ASR
    this.commandBuffer = [...this.candidateChunks]

    // 播放"我在听"反馈 + 屏蔽 VAD 4s (避免 cue 音频被当成命令)
    this.playWakeCue()

    // 2s 静默检测: 唤醒后无新段, 触发命令处理
    if (this.silenceTimer) clearTimeout(this.silenceTimer)
    this.silenceTimer = setTimeout(() => this.onSilenceDetected(), AlwaysListening.SILENCE_MS)

    // 30s 兜底: 用户走开/没说话, 自动放弃
    if (this.maxWaitTimer) { clearTimeout(this.maxWaitTimer); this.maxWaitTimer = null }
    this.maxWaitTimer = setTimeout(() => {
      if (this.state === 'recording') {
        voiceLog('info', 'voice', '30s timeout, giving up')
        if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null }
        this.playGiveUpCue()
        this.setState('idle')
        this.emit({})
        this.commandBuffer = []
      }
    }, AlwaysListening.MAX_WAIT_MS)
  }

  /**
   * 处理一个完整 VAD 段:
   * 1) 拼接音频
   * 2) ASR 转写 (仅在 vad-fallback 或 openWakeWord 未命中时用于二次确认)
   * 3) 根据 state 决定:
   *    - idle: 检查唤醒词, 有则进入 recording
   *    - recording: 当作用户命令, 调 onCommand
   * 4) 打断处理: 如果在说话中检测到唤醒词, 调 onInterrupt
   */
  private async processSegment(): Promise<void> {
    if (this.segmentEndTimer) {
      clearTimeout(this.segmentEndTimer)
      this.segmentEndTimer = null
    }
    const merged = this.mergeChunks(this.candidateChunks)
    this.candidateChunks = []
    // 太短 (< 0.15s) 当噪声忽略
    if (merged.length < 2400) return

    try {
      // ── 优先走 WS 流式 ASR (降低延迟) ──
      const wsConnected = this.opts.wsConnected?.() ?? false;
      if (wsConnected && this.opts.wsSend) {
        // 编码 PCM16 → base64, 发 WS asr_chunk
        const pcm16 = float32ToPCM16(merged);
        const b64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
        this.opts.wsSend({ type: 'asr_chunk', pcm: b64 });

        // WS ASR 结果是异步的 — 这里不等, 靠 onWSServerMsg 回调
        // 那个回调会触发 custom event 'ws-asr-result', 由 useChatAvatarWS 监听
        // 这里仍然做 HTTP ASR 作为 fallback (双路: WS 快 + HTTP 稳)
      }

      // ── HTTP ASR (降级/双路) ──
      const r = await transcribe(merged, {
        gatewayUrl: this.opts.asrGatewayUrl,
        model: this.opts.asrModel,
        language: this.opts.language,
      })
      if (!r.text || !r.text.trim()) return
      const text = r.text.trim()
      const normalized = text.replace(/[，。！？、；：""''（）,.!?;:"'()]/g, ' ').trim()
      voiceLog('info', 'voice', 'segment:', { state: this.state, text, normalized, avatarSpeaking: this.opts.isAvatarSpeaking?.() })

      this.handleSegmentText(normalized, text)
    } catch (e) {
      voiceLog('error', 'voice', 'ASR 失败:', (e as Error).message)
      this.emit({ error: (e as Error).message })
      this.setState('idle')
    }
  }

  /**
   * 处理 ASR 文本 (共用逻辑: idle 检查唤醒词, 否则丢弃)
   */
  private handleSegmentText(normalized: string, rawText: string): void {
    if (this.state === 'idle') {
      const wake = this.matchWakeWord(normalized)
      if (wake) {
        this.handleWakeWord(wake)
      } else {
        voiceLog('info', 'voice', 'no wake word in segment, text:', rawText)
      }
    }
  }

  /**
   * 唤醒后 2s 静默检测: 把 commandBuffer 累积的音频 ASR 并发命令
   */
  private async onSilenceDetected(): Promise<void> {
    if (this.state !== 'recording' || this.commandBuffer.length === 0) {
      return
    }
    if (this.maxWaitTimer) { clearTimeout(this.maxWaitTimer); this.maxWaitTimer = null }
    const merged = this.mergeChunks(this.commandBuffer)
    this.commandBuffer = []
    if (merged.length < 2400) {
      // 太短 (只是唤醒词, 没后续)
      voiceLog('info', 'voice', 'only wake word, no command')
      this.setState('idle')
      this.emit({})
      return
    }
    try {
      const r = await transcribe(merged, {
        gatewayUrl: this.opts.asrGatewayUrl,
        model: this.opts.asrModel,
        language: this.opts.language,
      })
      if (!r.text || !r.text.trim()) {
        this.setState('idle')
        this.emit({})
        return
      }
      const text = r.text.trim()
      const normalized = text.replace(/[，。！？、；：""''（）,.!?;:"'()]/g, ' ').trim()
      // 去掉唤醒词
      const wake = this.matchWakeWord(normalized)
      const cmd = (wake ? normalized.replace(wake, '') : normalized).trim()
      voiceLog('info', 'voice', 'command from silence:', { text, cmd })
      if (!cmd) {
        this.setState('idle')
        this.emit({})
        return
      }
      this.setState('processing')
      this.emit({ text: cmd })
      // 告诉用户"听到了" (防止用户以为系统没反应)
      this.playProcessingCue()
      try { await this.opts.onCommand(cmd) } finally { this.setState('idle') }
    } catch (e) {
      voiceLog('error', 'voice', 'command ASR failed:', (e as Error).message)
      this.emit({ error: (e as Error).message })
      this.setState('idle')
    }
  }

  private mergeChunks(chunks: Float32Array[]): Float32Array {
    const total = chunks.reduce((s, c) => s + c.length, 0)
    const out = new Float32Array(total)
    let off = 0
    for (const c of chunks) { out.set(c, off); off += c.length }
    return out
  }

  private matchWakeWord(text: string): string | null {
    // 1. 先用配置的短语 (精确匹配)
    const phrases = this.opts.wakePhrases || ['小月', '清秋月', '清秋']
    const exact = [...phrases].sort((a, b) => b.length - a.length)
      .find(p => text.includes(p))
    if (exact) return exact

    // 2. ASR 误识别容错 (拼音模糊匹配)
    //    "小月" 可能被听成: 晓月, 小约, 小悦, 小岳, 邀约, 邀月
    //    "清秋月" 可能被听成: 轻秋月, 清秋岳, 青秋月
    const lower = text.toLowerCase().replace(/\s+/g, ' ')
    if (lower.includes('小月') || lower.includes('晓月') || lower.includes('小约') || lower.includes('小悦') || lower.includes('小岳')) return '小月'
    if (lower.includes('清秋') || lower.includes('轻秋') || lower.includes('青秋')) return '清秋月'
    return null
  }

  getState(): VoiceState { return this.state as VoiceState }
  getMode(): VoiceAgentMode { return this.state }
}

/**
 * Float32Array (归一化 -1..1) → Int16Array (PCM16 LE)
 * 用于 WS 流式 ASR: 客户端发送 PCM16 base64 到服务端
 */
function float32ToPCM16(float32: Float32Array): Int16Array {
  const pcm16 = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  return pcm16
}
/**
 * Voice Agent 共享类型
 */

export type VoiceState =
  | 'idle'           // 静默待机 (没有音频)
  | 'listening'      // 检测到人声 (VAD)
  | 'wakeword'       // 检测到唤醒词
  | 'recording'      // 录音中 (实时转写)
  | 'processing'     // 处理中 (LLM)
  | 'speaking'       // 数字人在说话
  | 'error'

export interface VoiceEvent {
  state: VoiceState
  text?: string                    // 实时识别部分结果
  confidence?: number
  wakeWord?: string
  audioChunk?: Float32Array        // VAD 触发的人声片段
  error?: string
  ts: number
}

export interface WakeWordConfig {
  /** openWakeWord 唤醒词模型 .onnx 路径 (浏览器可访问的 URL) */
  modelUrl?: string
  /** melspectrogram.onnx 路径 (默认 /wake/melspectrogram.onnx) */
  melModelUrl?: string
  /** 唤醒词显示名 (用于日志) */
  label: string
  /** 灵敏度 0-1 (default 0.5) */
  sensitivity?: number
}

/** VAD 回调 */
export interface VADCallbacks {
  onSpeechStart: () => void
  onSpeechEnd: (audio: Float32Array) => void
  onVadScore?: (score: number) => void
}

/** Wake Word 回调 */
export interface WakeWordCallbacks {
  onWake: (label: string, confidence: number) => void
  onError?: (err: any) => void
}

export interface VoiceAgentOptions {
  /** 唤醒词配置, 不设则纯能量检测 (不精确) */
  wakeWord?: WakeWordConfig
  /** ASR gateway URL */
  asrGatewayUrl: string
  /** 默认 ASR 模型 */
  asrModel?: string
  /** 默认语言 */
  language?: string
  /** 回调: 完整语音指令识别成功后触发 */
  onCommand: (text: string) => Promise<void> | void
  /** 回调: 状态变化 */
  onStateChange?: (ev: VoiceEvent) => void
}
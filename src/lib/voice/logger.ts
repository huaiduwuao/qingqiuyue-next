/**
 * voiceLog — 语音链路前端日志
 *
 * 同时做两件事:
 *  1. 输出到 console (保留现有调试习惯)
 *  2. dispatch CustomEvent('voice-log'), 让 UI 面板可以展示
 */

export interface VoiceLogEntry {
  level: 'info' | 'warn' | 'error'
  tag: string
  message: string
  ts: number
}

export function voiceLog(level: 'info' | 'warn' | 'error', tag: string, ...args: unknown[]): void {
  const message = args
    .map((a) => {
      if (a === null) return 'null'
      if (a === undefined) return 'undefined'
      if (typeof a === 'object') {
        try {
          return JSON.stringify(a)
        } catch {
          return String(a)
        }
      }
      return String(a)
    })
    .join(' ')

  const prefix = `[${tag}] ${message}`
  if (level === 'error') console.error(prefix)
  else if (level === 'warn') console.warn(prefix)
  else console.log(prefix)

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent<VoiceLogEntry>('voice-log', {
          detail: { level, tag, message, ts: Date.now() },
        })
      )
    } catch {
      // ignore
    }
  }
}

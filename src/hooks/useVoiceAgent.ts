/**
 * useVoiceAgent — React hook 包装 AlwaysListening (wake word 状态机)
 *
 * 用法:
 *   const { state, transcript, start, stop } = useVoiceAgent({
 *     asrGatewayUrl: '/api/audio',
 *     wakePhrases: ['小月', '清秋月'],
 *     onCommand: async (text) => { await sendToAvatar(text) },
 *     isAvatarSpeaking: () => avatarIsSpeaking,  // 用于打断
 *     onInterrupt: () => avatarStop(),            // 打断时调
 *   })
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { AlwaysListening } from '@/lib/voice/always-listening'
import { getDefaultWakeWordConfig } from '@/lib/voice/wake-word'
import type { VoiceEvent, VoiceState, WakeWordConfig } from '@/lib/voice/types'

export interface UseVoiceAgentOptions {
  asrGatewayUrl?: string
  asrModel?: string
  language?: string
  /** openWakeWord 唤醒词配置; 不传使用默认 "小月" */
  wakeWord?: WakeWordConfig
  wakePhrases?: string[]
  onCommand: (text: string) => Promise<void> | void
  /** 数字人是否正在说 (用于打断检测) */
  isAvatarSpeaking?: () => boolean
  /** 数字人正在说时被唤醒 → 调这个打断 */
  onInterrupt?: () => void
}

export function useVoiceAgent(opts: UseVoiceAgentOptions) {
  const [state, setState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const [wakeWord, setWakeWord] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const optsRef = useRef(opts)
  optsRef.current = opts
  const agentRef = useRef<AlwaysListening | null>(null)

  useEffect(() => {
    const a = new AlwaysListening({
      asrGatewayUrl: optsRef.current.asrGatewayUrl,
      asrModel: optsRef.current.asrModel,
      language: optsRef.current.language,
      wakeWord: optsRef.current.wakeWord || getDefaultWakeWordConfig(),
      wakePhrases: optsRef.current.wakePhrases,
      onCommand: (text) => optsRef.current.onCommand(text),
      isAvatarSpeaking: () => optsRef.current.isAvatarSpeaking?.() ?? false,
      onInterrupt: () => optsRef.current.onInterrupt?.(),
      onStateChange: (ev) => {
        setState(ev.state)
        if (ev.text !== undefined) setTranscript(ev.text)
        if (ev.wakeWord !== undefined) setWakeWord(ev.wakeWord)
        if (ev.error) setError(ev.error)
      },
    })
    agentRef.current = a

    // ⚠️ 不要在这里 auto-start, 否则 AudioContext 在 useEffect 里创建
    // 没有 user gesture, 浏览器会 suspended, createMediaStreamSource 报错
    // 让外部在 click handler 里同步调 a.start()
    // a.start() 由 FloatingDigitalHuman 的 mic 按钮 click 触发

    return () => {
      a.stop()
      agentRef.current = null
    }
  }, [])

  return {
    state,
    transcript,
    wakeWord,
    error,
    start: () => agentRef.current?.start(),
    stop: () => agentRef.current?.stop(),
  }
}
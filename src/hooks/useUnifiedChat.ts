/**
 * useUnifiedChat — 统一文本聊天与数字人聊天的 Hook
 *
 * 后端统一走 Hermes (/api/realtime/hermes/chat 或 /api/content/hermes/client/*)。
 * 当 enableAvatar=true 时, 在拿到 Hermes 文本回复后, 再调 /api/avatar/chat
 * 获取 TTS 音频、viseme 口型、emotion 表情, 供 VRM 数字人使用。
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as hermesApi from '@/apis/hermes'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  emotion?: Record<string, number>
  action?: string
  audioUrl?: string | null
  visemes?: Array<{ t: number; shape: string; weight: number }>
}

export interface UseUnifiedChatOptions {
  agentId: string
  /** 是否为数字人模式(需要 TTS/viseme/emotion) */
  enableAvatar?: boolean
  /** 是否自动加载问候语作为首条消息 */
  autoGreeting?: boolean
}

function normalizeHistory(raw: any[]): ChatMessage[] {
  return raw.map((m: any) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content || m.message || '',
  }))
}

export function useUnifiedChat({ agentId, enableAvatar = false, autoGreeting = false }: UseUnifiedChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const qc = useQueryClient()

  const detailQuery = useQuery({
    queryKey: ['hermes', 'detail', agentId],
    queryFn: () => hermesApi.clientDetail(agentId).then((r: any) => r?.data),
    enabled: !!agentId && autoGreeting,
  })

  const historyQuery = useQuery({
    queryKey: ['hermes', 'history', agentId],
    queryFn: () => hermesApi.clientHistory(agentId).then((r: any) => {
      const msgs = r?.data?.messages || r?.data || []
      return normalizeHistory(msgs)
    }),
    enabled: !!agentId,
  })

  // 初始化 messages: 优先用历史, 历史为空且允许问候语时显示 greeting
  useEffect(() => {
    if (!historyQuery.data) return
    if (historyQuery.data.length > 0) {
      setMessages(historyQuery.data)
      return
    }
    if (autoGreeting && detailQuery.data?.greeting) {
      setMessages([{ role: 'assistant', content: detailQuery.data.greeting }])
    }
  }, [historyQuery.data, detailQuery.data, autoGreeting])

  const sendMutation = useMutation({
    mutationFn: async (text: string): Promise<ChatMessage> => {
      // 1. 统一走 Hermes 后端拿文本回复
      const hermesRes = (await hermesApi.chat(agentId, text)) as any
      const replyText = hermesRes?.text ?? hermesRes?.data?.text ?? ''

      if (!enableAvatar) {
        return { role: 'assistant', content: replyText }
      }

      // 2. 数字人模式: 用 avatar/chat 补 TTS/viseme/emotion
      try {
        const avatarRes = await fetch('/api/avatar/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            agentId,
            history: messages.map((m) => ({ role: m.role, content: m.content })),
          }),
        })
        if (avatarRes.ok) {
          const data = await avatarRes.json()
          return {
            role: 'assistant',
            content: data.text || replyText,
            emotion: data.emotion || {},
            action: data.action || 'idle',
            visemes: data.visemes || [],
            audioUrl: data.audioUrl || null,
          }
        }
        console.warn('[useUnifiedChat] avatar/chat failed:', avatarRes.status)
      } catch (e) {
        console.warn('[useUnifiedChat] avatar/chat error:', (e as Error).message)
      }

      return { role: 'assistant', content: replyText }
    },
    onSuccess: (assistantMsg) => {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: input },
        assistantMsg,
      ])
      setInput('')
      qc.invalidateQueries({ queryKey: ['hermes', 'history', agentId] })
    },
  })

  const send = useCallback(() => {
    const text = input.trim()
    if (!text || sendMutation.isPending) return
    sendMutation.mutate(text)
  }, [input, sendMutation.isPending])

  const sendText = useCallback(
    (text: string) => {
      if (!text.trim() || sendMutation.isPending) return
      setInput(text)
      sendMutation.mutate(text)
    },
    [sendMutation.isPending]
  )

  return {
    messages,
    input,
    setInput,
    send,
    sendText,
    isLoading: sendMutation.isPending || historyQuery.isLoading,
    isHistoryLoading: historyQuery.isLoading,
    error: sendMutation.error,
  }
}

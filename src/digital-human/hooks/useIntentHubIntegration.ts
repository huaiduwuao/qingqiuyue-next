'use client'

/**
 * useIntentHubIntegration - 意图分析与数字人集成
 *
 * 将 Hermes Intent Hub 与 ImmersiveDigitalHuman 集成：
 * - 监听用户消息，自动进行意图分析
 * - 根据意图分析结果，渲染动态 UI（Modal/Drawer/Toast）
 * - 执行 Agent 调用并更新数字人状态
 */

import { useEffect, useCallback, useState } from 'react'
import { useIntentHub, useDigitalHumanIntentHub } from '../dynamic-ui/useIntentHub'
import type { DynamicUI, UIAvatar, UIAction } from '../dynamic-ui/types'
import { devLog } from '@/lib/dev-log'

interface UseIntentHubIntegrationOptions {
  /** 是否启用意图分析 */
  enabled?: boolean
  /** 会话 ID */
  sessionId?: string
  /** 用户 ID */
  userId?: number
  /** 是否自动执行高置信度意图 */
  autoExecute?: boolean
  /** 是否在消息发送前分析 */
  analyzeOnSend?: boolean
  /** 数字人 handle，用于更新表情/动作 */
  avatarHandle?: {
    setEmotion?: (expression: string) => void
    setAction?: (action: string) => void
    speak?: (text: string, audioUrl?: string) => void
  }
  /** 意图分析完成回调 */
  onIntentAnalyzed?: (response: any) => void
  /** 意图执行完成回调 */
  onIntentExecuted?: (response: any) => void
  /** UI 渲染回调 */
  onUIRendered?: (ui: DynamicUI) => void
  /** 数字人动作回调 */
  onAvatarAction?: (avatar: UIAvatar) => void
  /** 错误回调 */
  onError?: (error: Error) => void
}

interface UseIntentHubIntegrationReturn {
  /** 当前动态 UI */
  currentUI: DynamicUI | null
  /** 是否正在分析/执行 */
  isProcessing: boolean
  /** 分析结果 */
  analysis: any
  /** 执行结果 */
  execution: any
  /** 对话历史 */
  messages: any[]
  /** 渲染 UI */
  renderUI: (ui: DynamicUI) => void
  /** 关闭 UI */
  closeUI: () => void
  /** 执行动作 */
  executeAction: (action: UIAction) => void
  /** 发送消息（带意图分析） */
  sendMessage: (text: string) => Promise<void>
  /** 清空历史 */
  clearHistory: () => void
  /** 更新数字人状态 */
  updateAvatar: (avatar: UIAvatar) => void
}

export function useIntentHubIntegration(
  options: UseIntentHubIntegrationOptions = {}
): UseIntentHubIntegrationReturn {
  const {
    enabled = true,
    sessionId,
    userId,
    autoExecute = true,
    analyzeOnSend = true,
    avatarHandle,
    onIntentAnalyzed,
    onIntentExecuted,
    onUIRendered,
    onAvatarAction,
    onError,
  } = options

  const [currentUI, setCurrentUI] = useState<DynamicUI | null>(null)
  const [lastAvatar, setLastAvatar] = useState<UIAvatar | null>(null)

  // 使用数字人专用的 IntentHub hook
  const intentHub = useDigitalHumanIntentHub({
    apiBase: '/api/hermes',
    sessionId,
    userId,
    autoExecute,
    onIntentAnalyzed: (response) => {
      devLog.debug('[IntentHub] analyzed:', response)
      onIntentAnalyzed?.(response)

      // 渲染建议的 UI
      if (response.suggestedUI) {
        setCurrentUI(response.suggestedUI)
        onUIRendered?.(response.suggestedUI)
      }
    },
    onIntentExecuted: (response) => {
      devLog.debug('[IntentHub] executed:', response)
      onIntentExecuted?.(response)

      // 渲染执行后的 UI
      if (response.ui) {
        setCurrentUI(response.ui)
        onUIRendered?.(response.ui)
      }

      // 更新数字人状态
      if (response.avatar) {
        setLastAvatar(response.avatar)
        onAvatarAction?.(response.avatar)
        applyAvatarState(response.avatar)
      }
    },
    onUIRendered: (ui) => {
      setCurrentUI(ui)
      onUIRendered?.(ui)
    },
    onAvatarAction: (avatar) => {
      setLastAvatar(avatar)
      onAvatarAction?.(avatar)
      applyAvatarState(avatar)
    },
    onError: (error) => {
      devLog.error('[IntentHub] error:', error)
      onError?.(error)
    },
  })

  // 应用数字人状态
  const applyAvatarState = useCallback((avatar: UIAvatar) => {
    if (!avatarHandle) return

    if (avatar.expression && avatarHandle.setEmotion) {
      avatarHandle.setEmotion(avatar.expression)
    }
    if (avatar.action && avatarHandle.setAction) {
      avatarHandle.setAction(avatar.action)
    }
    if (avatar.speak && avatarHandle.speak) {
      avatarHandle.speak(avatar.speak)
    }
  }, [avatarHandle])

  // 渲染 UI
  const renderUI = useCallback((ui: DynamicUI) => {
    setCurrentUI(ui)
    onUIRendered?.(ui)
  }, [onUIRendered])

  // 关闭 UI
  const closeUI = useCallback(() => {
    setCurrentUI(null)
  }, [])

  // 执行动作
  const executeAction = useCallback(async (action: UIAction) => {
    devLog.debug('[IntentHub] execute action:', action)

    // 关闭当前 UI
    setCurrentUI(null)

    // 根据动作类型处理
    switch (action.handler) {
      case 'agent':
        // 调用 Agent
        if (action.target) {
          await intentHub.execute([{
            id: `action_${Date.now()}`,
            intent: action.label,
            confidence: 1,
            required: true,
            plan: { agentId: action.target }
          }])
        }
        break

      case 'tool':
        // 调用工具
        if (action.target) {
          await intentHub.execute([{
            id: `action_${Date.now()}`,
            intent: action.label,
            confidence: 1,
            required: true,
            plan: {
              toolCalls: [{ name: action.target, arguments: action.params || {} }]
            }
          }])
        }
        break

      case 'navigate':
        // 导航
        if (action.target) {
          window.location.href = action.target
        }
        break

      case 'intent':
        // 继续分析
        if (action.target) {
          await intentHub.analyze(action.target)
        }
        break

      case 'ui':
        // 渲染新 UI
        if (action.params?.ui) {
          setCurrentUI(action.params.ui as DynamicUI)
          onUIRendered?.(action.params.ui as DynamicUI)
        }
        break
    }
  }, [intentHub, onUIRendered])

  // 发送消息
  const sendMessage = useCallback(async (text: string) => {
    if (!enabled) return
    await intentHub.sendMessage(text)
  }, [enabled, intentHub])

  // 更新数字人
  const updateAvatar = useCallback((avatar: UIAvatar) => {
    setLastAvatar(avatar)
    onAvatarAction?.(avatar)
    applyAvatarState(avatar)
  }, [onAvatarAction, applyAvatarState])

  return {
    currentUI,
    isProcessing: intentHub.analyzing || intentHub.executing,
    analysis: intentHub.analysis,
    execution: intentHub.execution,
    messages: intentHub.messages,
    renderUI,
    closeUI,
    executeAction,
    sendMessage,
    clearHistory: intentHub.clearHistory,
    updateAvatar,
  }
}

/**
 * 创建意图分析拦截器
 * 用于包装现有的 send 函数，自动进行意图分析
 */
export function createIntentInterceptor(
  sendFn: (text: string) => Promise<void>,
  intentHub: ReturnType<typeof useIntentHubIntegration>
) {
  return async (text: string) => {
    // 先分析意图
    await intentHub.sendMessage(text)
    // 再执行原始发送
    await sendFn(text)
  }
}

/**
 * 快捷预设：创建与 ImmersiveDigitalHuman 集成的 IntentHub
 */
export function useImmersiveIntentHub(
  avatarHandle?: UseIntentHubIntegrationOptions['avatarHandle']
) {
  return useIntentHubIntegration({
    enabled: true,
    autoExecute: true,
    analyzeOnSend: true,
    avatarHandle,
  })
}

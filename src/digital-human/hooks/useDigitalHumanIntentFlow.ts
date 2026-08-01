'use client'

/**
 * useDigitalHumanIntentFlow - 数字人智能交互流程
 *
 * 这是一个完整的数字人与多Agent平台集成示例：
 * - 监听用户输入
 * - 调用 Hermes Intent Hub 进行意图分析
 * - 根据分析结果自动执行Agent/渲染UI/更新数字人
 * - 支持自由形式的交互，不限制用户想做什么
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { DynamicUI, UIAction, UIAvatar, AnalyzeResponse } from '../dynamic-ui/types'
import { devLog } from '@/lib/dev-log'

interface IntentFlowOptions {
  /** API 地址 */
  apiBase?: string
  /** 会话 ID */
  sessionId?: string
  /** 用户 ID */
  userId?: number
  /** 可用 Agent 列表 */
  agents?: Array<{ id: string; name: string; description: string }>
  /** 是否自动分析 */
  autoAnalyze?: boolean
  /** 是否自动执行高置信度意图 */
  autoExecute?: boolean
  /** 回调 */
  onIntentAnalyzed?: (response: AnalyzeResponse) => void
  onUIReady?: (ui: DynamicUI) => void
  onAvatarAction?: (avatar: UIAvatar) => void
  onAgentCalled?: (agentId: string, result: any) => void
  onError?: (error: Error) => void
}

interface IntentFlowReturn {
  /** 当前 UI */
  currentUI: DynamicUI | null
  /** 是否处理中 */
  isProcessing: boolean
  /** 发送消息并分析意图 */
  sendAndAnalyze: (message: string) => Promise<AnalyzeResponse | null>
  /** 执行意图分支 */
  executeIntents: (response: AnalyzeResponse) => Promise<void>
  /** 执行动作 */
  executeAction: (action: UIAction) => Promise<void>
  /** 渲染 UI */
  renderUI: (ui: DynamicUI) => void
  /** 关闭 UI */
  closeUI: () => void
  /** 更新数字人 */
  updateAvatar: (avatar: UIAvatar) => void
}

export function useDigitalHumanIntentFlow(
  options: IntentFlowOptions = {}
): IntentFlowReturn {
  const {
    apiBase = '/api/hermes',
    sessionId,
    userId,
    agents = [],
    autoExecute = true,
    onIntentAnalyzed,
    onUIReady,
    onAvatarAction,
    onAgentCalled,
    onError,
  } = options

  const [currentUI, setCurrentUI] = useState<DynamicUI | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentSessionId] = useState(sessionId || `sess_${Date.now()}`)

  // 意图分析
  const analyze = useCallback(async (message: string): Promise<AnalyzeResponse | null> => {
    setIsProcessing(true)

    try {
      const response = await fetch(`${apiBase}/intents/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          sessionId: currentSessionId,
          userId,
          availableAgents: agents,
          // 传递可用工具信息
          availableTools: [
            { name: 'ui.showModal', description: '显示模态弹窗' },
            { name: 'ui.showToast', description: '显示轻提示' },
            { name: 'ui.showChoices', description: '显示选项列表' },
            { name: 'ui.updateAvatar', description: '更新数字人表情动作' },
            { name: 'ui.navigate', description: '导航到页面' },
          ],
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }

      const result: AnalyzeResponse = await response.json()
      devLog.debug('[IntentFlow] analyzed:', result)

      // 回调
      onIntentAnalyzed?.(result)

      // 渲染建议的 UI
      if (result.suggestedUI) {
        setCurrentUI(result.suggestedUI)
        onUIReady?.(result.suggestedUI)
      }

      // 自动执行高置信度意图
      if (autoExecute && result.branches.length > 0) {
        const requiredBranches = result.branches.filter(
          b => b.required && b.confidence >= 0.7
        )
        if (requiredBranches.length > 0) {
          await executeBranches(requiredBranches)
        }
      }

      return result
    } catch (err) {
      devLog.error('[IntentFlow] analyze error:', err)
      onError?.(err as Error)
      return null
    } finally {
      setIsProcessing(false)
    }
  }, [apiBase, currentSessionId, userId, agents, autoExecute, onIntentAnalyzed, onUIReady, onError])

  // 执行意图分支
  const executeBranches = useCallback(async (branches: AnalyzeResponse['branches']) => {
    setIsProcessing(true)

    try {
      // 先渲染分支的 UI
      for (const branch of branches) {
        if (branch.ui) {
          setCurrentUI(branch.ui)
          onUIReady?.(branch.ui)
        }

        // 更新数字人
        if (branch.ui?.avatar) {
          onAvatarAction?.(branch.ui.avatar)
        }
      }

      // 调用执行接口
      const response = await fetch(`${apiBase}/intents/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          userId,
          branches: branches.map(b => ({
            id: b.id,
            intent: b.intent,
            confidence: b.confidence,
            required: b.required,
            plan: b.plan,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }

      const result = await response.json()
      devLog.debug('[IntentFlow] executed:', result)

      // 处理执行结果
      if (result.ui) {
        setCurrentUI(result.ui)
        onUIReady?.(result.ui)
      }

      if (result.avatar) {
        onAvatarAction?.(result.avatar)
      }

      // Agent 调用结果
      if (result.branchResults) {
        for (const br of result.branchResults) {
          if (br.agentResult) {
            onAgentCalled?.(br.agentResult.agentId, br.agentResult)
          }
        }
      }
    } catch (err) {
      devLog.error('[IntentFlow] execute error:', err)
      onError?.(err as Error)
    } finally {
      setIsProcessing(false)
    }
  }, [apiBase, currentSessionId, userId, onUIReady, onAvatarAction, onAgentCalled, onError])

  // 执行动作
  const executeAction = useCallback(async (action: UIAction) => {
    devLog.debug('[IntentFlow] execute action:', action)
    setCurrentUI(null)

    switch (action.handler) {
      case 'agent':
        // 调用 Agent
        if (action.target) {
          onAgentCalled?.(action.target, null)
        }
        break

      case 'tool':
        // 工具调用
        devLog.debug('[IntentFlow] tool call:', action.target, action.params)
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
          await analyze(action.target)
        }
        break

      case 'ui':
        // 渲染新 UI
        if (action.params?.ui) {
          setCurrentUI(action.params.ui as DynamicUI)
          onUIReady?.(action.params.ui as DynamicUI)
        }
        break
    }
  }, [analyze, onAgentCalled, onUIReady])

  // 发送消息并分析
  const sendAndAnalyze = useCallback(async (message: string) => {
    return analyze(message)
  }, [analyze])

  // 渲染 UI
  const renderUI = useCallback((ui: DynamicUI) => {
    setCurrentUI(ui)
    onUIReady?.(ui)
  }, [onUIReady])

  // 关闭 UI
  const closeUI = useCallback(() => {
    setCurrentUI(null)
  }, [])

  // 更新数字人
  const updateAvatar = useCallback((avatar: UIAvatar) => {
    onAvatarAction?.(avatar)
  }, [onAvatarAction])

  return {
    currentUI,
    isProcessing,
    sendAndAnalyze,
    executeIntents: async (response) => executeBranches(response.branches),
    executeAction,
    renderUI,
    closeUI,
    updateAvatar,
  }
}

/**
 * 快捷预设：创建数字人智能交互
 */
export function useSmartDigitalHuman(
  avatarHandle?: {
    setEmotion?: (expression: string) => void
    setAction?: (action: string) => void
    speak?: (text: string) => void
  }
) {
  const intentFlow = useDigitalHumanIntentFlow({
    apiBase: '/api/hermes',
    autoExecute: true,
    onAvatarAction: (avatar) => {
      if (avatarHandle) {
        if (avatar.expression && avatarHandle.setEmotion) {
          avatarHandle.setEmotion(avatar.expression)
        }
        if (avatar.action && avatarHandle.setAction) {
          avatarHandle.setAction(avatar.action)
        }
        if (avatar.speak && avatarHandle.speak) {
          avatarHandle.speak(avatar.speak)
        }
      }
    },
  })

  return intentFlow
}

'use client'

/**
 * useIntentHub - 意图分析 Hook
 *
 * 提供 LLM 驱动的意图分析和多 Agent 执行能力。
 * 与 Hermes Intent Hub 后端配合使用。
 */

import { useState, useCallback, useRef } from 'react'
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  ExecuteRequest,
  ExecuteResponse,
  IntentBranch,
  DynamicUI,
  UIAvatar,
  UIAction,
  Message,
  AgentInfo,
  ToolInfo,
} from './types'

interface UseIntentHubOptions {
  /** Hermes Intent Hub API 地址 */
  apiBase?: string
  /** 默认会话 ID */
  sessionId?: string
  /** 用户 ID */
  userId?: number
  /** 可用 Agent 列表 */
  availableAgents?: AgentInfo[]
  /** 可用工具列表 */
  availableTools?: ToolInfo[]
  /** 自动执行必需的意图 */
  autoExecute?: boolean
  /** 回调 */
  onIntentAnalyzed?: (response: AnalyzeResponse) => void
  onIntentExecuted?: (response: ExecuteResponse) => void
  onUIRendered?: (ui: DynamicUI) => void
  onAvatarAction?: (avatar: UIAvatar) => void
  onError?: (error: Error) => void
}

interface UseIntentHubReturn {
  /** 是否正在分析 */
  analyzing: boolean
  /** 是否正在执行 */
  executing: boolean
  /** 当前 UI */
  currentUI: DynamicUI | null
  /** 意图分析结果 */
  analysis: AnalyzeResponse | null
  /** 执行结果 */
  execution: ExecuteResponse | null
  /** 对话历史 */
  messages: Message[]
  /** 分析意图 */
  analyze: (message: string) => Promise<AnalyzeResponse | null>
  /** 执行意图分支 */
  execute: (branches: IntentBranch[]) => Promise<ExecuteResponse | null>
  /** 执行单个动作 */
  executeAction: (action: UIAction) => Promise<void>
  /** 渲染 UI */
  renderUI: (ui: DynamicUI) => void
  /** 关闭 UI */
  closeUI: () => void
  /** 发送用户消息并自动分析+执行 */
  sendMessage: (text: string) => Promise<void>
  /** 清空历史 */
  clearHistory: () => void
  /** 更新可用 Agent */
  setAvailableAgents: (agents: AgentInfo[]) => void
  /** 更新可用工具 */
  setAvailableTools: (tools: ToolInfo[]) => void
}

export function useIntentHub(options: UseIntentHubOptions = {}): UseIntentHubReturn {
  const {
    apiBase = '/api/hermes',
    sessionId: initialSessionId,
    userId,
    availableAgents = [],
    availableTools = [],
    autoExecute = true,
    onIntentAnalyzed,
    onIntentExecuted,
    onUIRendered,
    onAvatarAction,
    onError,
  } = options

  const [analyzing, setAnalyzing] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [currentUI, setCurrentUI] = useState<DynamicUI | null>(null)
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null)
  const [execution, setExecution] = useState<ExecuteResponse | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [sessionId, setSessionId] = useState(initialSessionId)
  const [agents, setAgents] = useState<AgentInfo[]>(availableAgents)
  const [tools, setTools] = useState<ToolInfo[]>(availableTools)

  const recentIntentsRef = useRef<string[]>([])

  // 发送请求
  const request = useCallback(async <T,>(path: string, body: unknown): Promise<T | null> => {
    try {
      const res = await fetch(`${apiBase}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      }
      return res.json()
    } catch (err) {
      onError?.(err as Error)
      return null
    }
  }, [apiBase, onError])

  // 分析意图
  const analyze = useCallback(async (message: string): Promise<AnalyzeResponse | null> => {
    setAnalyzing(true)

    try {
      const req: AnalyzeRequest = {
        message,
        sessionId,
        userId,
        history: messages.slice(-10), // 最近 10 条
        availableAgents: agents,
        availableTools: tools,
        recentIntents: recentIntentsRef.current.slice(-5),
      }

      const resp = await request<AnalyzeResponse>('/intents/analyze', req)
      if (!resp) return null

      setAnalysis(resp)

      // 更新最近意图
      if (resp.primaryIntent) {
        recentIntentsRef.current = [...recentIntentsRef.current, resp.primaryIntent].slice(-10)
      }

      // 添加用户消息到历史
      setMessages(prev => [...prev, { role: 'user', content: message }])

      // 回调
      onIntentAnalyzed?.(resp)

      // 渲染建议的 UI
      if (resp.suggestedUI) {
        setCurrentUI(resp.suggestedUI)
        onUIRendered?.(resp.suggestedUI)
      }

      // 自动执行必需的意图
      if (autoExecute && resp.branches.length > 0) {
        const requiredBranches = resp.branches.filter(b => b.required && b.confidence >= 0.7)
        if (requiredBranches.length > 0) {
          await execute(requiredBranches)
        }
      }

      return resp
    } finally {
      setAnalyzing(false)
    }
  }, [request, sessionId, userId, messages, agents, tools, autoExecute, onIntentAnalyzed, onUIRendered, onError])

  // 执行意图分支
  const execute = useCallback(async (branches: IntentBranch[]): Promise<ExecuteResponse | null> => {
    if (branches.length === 0) return null

    setExecuting(true)

    try {
      const req: ExecuteRequest = {
        sessionId,
        userId,
        branches,
        context: {
          availableAgents: agents,
          availableTools: tools,
        },
      }

      const resp = await request<ExecuteResponse>('/intents/execute', req)
      if (!resp) return null

      setExecution(resp)

      // 添加 assistant 消息
      if (resp.aggregatedResult?.text) {
        setMessages(prev => [...prev, { role: 'assistant', content: resp.aggregatedResult!.text }])
      }

      // 渲染 UI
      if (resp.ui) {
        setCurrentUI(resp.ui)
        onUIRendered?.(resp.ui)
      }

      // 数字人交互
      if (resp.avatar) {
        onAvatarAction?.(resp.avatar)
      }

      // 回调
      onIntentExecuted?.(resp)

      return resp
    } finally {
      setExecuting(false)
    }
  }, [request, sessionId, userId, agents, tools, onIntentExecuted, onUIRendered, onAvatarAction, onError])

  // 执行动作
  const executeAction = useCallback(async (action: UIAction): Promise<void> => {
    // 关闭当前 UI
    setCurrentUI(null)

    switch (action.handler) {
      case 'agent':
        // 调用 Agent
        if (action.target) {
          await execute([{
            id: `action_${Date.now()}`,
            intent: action.label,
            confidence: 1,
            required: true,
            plan: { agentId: action.target }
          }])
        }
        break

      case 'tool':
        // 调用工具（目前通过后端执行）
        if (action.target) {
          await request('/intents/execute', {
            sessionId,
            userId,
            branches: [{
              id: `action_${Date.now()}`,
              intent: action.label,
              confidence: 1,
              required: true,
              plan: {
                toolCalls: [{ name: action.target, arguments: action.params }]
              }
            }]
          })
        }
        break

      case 'navigate':
        // 导航（前端处理）
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
        // 渲染新的 UI
        if (action.params?.ui) {
          setCurrentUI(action.params.ui as DynamicUI)
          onUIRendered?.(action.params.ui as DynamicUI)
        }
        break
    }
  }, [execute, request, sessionId, userId, analyze, onUIRendered])

  // 渲染 UI
  const renderUI = useCallback((ui: DynamicUI) => {
    setCurrentUI(ui)
    onUIRendered?.(ui)
  }, [onUIRendered])

  // 关闭 UI
  const closeUI = useCallback(() => {
    setCurrentUI(null)
  }, [])

  // 发送消息（自动分析+执行）
  const sendMessage = useCallback(async (text: string): Promise<void> => {
    await analyze(text)
  }, [analyze])

  // 清空历史
  const clearHistory = useCallback(() => {
    setMessages([])
    setAnalysis(null)
    setExecution(null)
    recentIntentsRef.current = []
  }, [])

  return {
    analyzing,
    executing,
    currentUI,
    analysis,
    execution,
    messages,
    analyze,
    execute,
    executeAction,
    renderUI,
    closeUI,
    sendMessage,
    clearHistory,
    setAvailableAgents: setAgents,
    setAvailableTools: setTools,
  }
}

// =============================================================================
// 快捷预设
// =============================================================================

/**
 * 创建数字人对话专用的 IntentHub
 * 预配置了数字人相关的 Agent 和 Tools
 */
export function useDigitalHumanIntentHub(options: Partial<UseIntentHubOptions> = {}) {
  const defaultAgents: AgentInfo[] = [
    { id: 'digital_human', name: '数字人助手', description: '主控数字人，负责协调其他 Agent', capabilities: ['chat', 'control'] },
    { id: 'search_agent', name: '搜索 Agent', description: '搜索互联网信息', capabilities: ['search', 'query'] },
    { id: 'knowledge_agent', name: '知识库 Agent', description: '查询本地知识库', capabilities: ['knowledge', 'query'] },
    { id: 'tool_agent', name: '工具 Agent', description: '执行系统操作', capabilities: ['tool', 'control'] },
  ]

  const defaultTools: ToolInfo[] = [
    { name: 'face.setExpression', description: '设置数字人表情' },
    { name: 'body.playAction', description: '播放数字人动作' },
    { name: 'scene.change', description: '切换场景' },
    { name: 'camera.preset', description: '切换相机视角' },
  ]

  return useIntentHub({
    availableAgents: defaultAgents,
    availableTools: defaultTools,
    autoExecute: true,
    ...options,
  })
}

/**
 * 创建多 Agent 协作专用的 IntentHub
 * 用于复杂任务的多 Agent 编排
 */
export function useMultiAgentIntentHub(options: Partial<UseIntentHubOptions> = {}) {
  return useIntentHub({
    autoExecute: false, // 多 Agent 需要用户确认
    ...options,
  })
}

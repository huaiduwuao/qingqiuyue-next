/**
 * Intent 类型 — 数字人能做的所有事的语义表示
 */

export type Intent =
  | { type: 'chat'; text: string; agentId: string }       // 普通对话
  | { type: 'navigate'; path: string; label?: string }
  | { type: 'open_external'; url: string; label?: string; mode?: 'iframe' | 'newtab' }  // 弹窗/新标签显示外部 URL
  | { type: 'walk_to'; target: 'sidebar' | 'header' | 'footer' | 'center' | 'cursor' | { x: number; y: number }; durationMs?: number }  // 数字人走到页面上某处
  | { type: 'delegate'; agentId: string; task: string; taskId?: string }
  | { type: 'switch'; agentId: string }                   // 切换当前对话角色
  | { type: 'return' }                                    // 返回上一个角色
  | { type: 'cron'; cronExpr: string; prompt: string; agentId?: string }
  | { type: 'system'; action: SystemAction; params?: Record<string, any> }
  | { type: 'query'; kind: 'conversation' | 'task' | 'artifact'; query: string }
  | { type: 'multi'; intents: Intent[] }                  // 复合意图

export type SystemAction =
  | 'volume-up' | 'volume-down' | 'volume-set'
  | 'mute' | 'unmute'
  | 'theme-light' | 'theme-dark'
  | 'fullscreen-on' | 'fullscreen-off'
  | 'reload' | 'logout'

export interface IntentResult {
  intent: Intent
  /** 给数字人朗读的简短确认文本 (如 "好的, 我来画" / "已打开设置") */
  replyText: string
  /** 数字人回复时的情绪/动作 */
  emotion?: string
  action?: string
  /** 异步任务 ID (delegate/cron 时) */
  taskId?: string
  /** 是否需要等执行完才回复 (chat: false, delegate: false, navigate: true) */
  awaitExecution?: boolean
}

export interface IntentRouterOptions {
  model?: string                   // LLM 模型 (默认 MiniMax-M2.7-highspeed)
  apiKey?: string
  baseUrl?: string
  availableAgents?: Array<{ id: string; displayName: string; description: string; tools: string[] }>
  systemContext?: string           // 当前页面/状态上下文
}
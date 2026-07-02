/**
 * task-engine/types.ts — 通用异步任务引擎类型
 *
 * 支持: Hermes 委派 / ComfyUI 视频生成 / 爬虫 / 数字人管线 / RAG
 */

export type TaskStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'

export type TaskType = 'hermes' | 'comfyui' | 'video' | 'spider' | 'pipeline' | 'rag'

export interface TaskStage {
  name: string
  status: 'pending' | 'running' | 'done' | 'failed'
  progress: number // 0-100, 仅该阶段进度
  message?: string
  ts: number
}

export interface TaskLogEntry {
  level: 'info' | 'warn' | 'error'
  message: string
  ts: number
}

export interface TaskState {
  id: string
  taskType: TaskType
  status: TaskStatus
  userId?: string
  conversationId?: string
  agentId?: string
  prompt?: string
  payload: Record<string, unknown>
  context?: Record<string, unknown>
  result?: Record<string, unknown> | null
  progress: number
  stages: TaskStage[]
  logs: TaskLogEntry[]
  error?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
}

export interface CreateTaskOptions {
  taskType: TaskType
  userId?: string
  conversationId?: string
  agentId?: string
  prompt?: string
  payload?: Record<string, unknown>
  context?: Record<string, unknown>
}

export type SseEvent =
  | { event: 'connected'; data: { t: number } }
  | { event: 'status'; data: { status: TaskStatus; progress: number; t: number } }
  | { event: 'stage'; data: TaskStage }
  | { event: 'progress'; data: { progress: number; t: number } }
  | { event: 'log'; data: TaskLogEntry }
  | { event: 'result'; data: { result: Record<string, unknown> | null; t: number } }
  | { event: 'done'; data: { result: Record<string, unknown> | null; progress: number; t: number } }
  | { event: 'error'; data: { message: string; stage?: string; t: number } }
  | { event: 'cancelled'; data: { t: number } }

export interface TaskUpdate {
  status?: TaskStatus
  progress?: number
  stages?: TaskStage[]
  result?: Record<string, unknown> | null
  error?: string
  startedAt?: number
  completedAt?: number
}

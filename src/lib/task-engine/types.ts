/**
 * task-engine/types.ts — 通用异步任务引擎类型
 *
 * 支持: Hermes 委派 / ComfyUI 视频生成 / 爬虫 / 数字人管线 / RAG
 */

// 后端 gen-api 用的是 pending / queued / processing / completed / failed
// (见 internal/genapp/service.go 的 updateStatus 调用),这里必须把它们都收进来 ——
// 之前这个联合类型是前端自己拍的一套词表,和后端一个都对不上。
export type TaskStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  // 下面三个是本地/其它任务源在用的,保留
  | 'running'
  | 'done'
  | 'cancelled'

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
  // gen-api 实际发的 status 载荷:{jobId, status, progress, errorMsg}(无 t)。
  | { event: 'status'; data: { status: TaskStatus; progress: number; jobId?: number; errorMsg?: string; t?: number } }
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

/**
 * task-engine/store.ts — 通用异步任务状态管理
 *
 * 设计:
 *   - 内存 Map 提供实时 SSE 推送
 *   - 异步写 PG (tasks 表), 支持跨进程恢复和持久化
 *   - 每个 taskId 一个 EventEmitter, 支持多客户端同时订阅
 *   - 后台 sweeper 清理孤儿任务
 */

import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { tasks } from '@/lib/db/schema'
import { safeErrorLog } from '@/lib/error-handler'
import type {
  TaskState,
  TaskStatus,
  TaskStage,
  TaskLogEntry,
  CreateTaskOptions,
  SseEvent,
  TaskUpdate,
  TaskType,
} from './types'

const TASK_TTL_MIN = parseInt(process.env.TASK_ENGINE_TTL_MIN || '30', 10)
const MAX_LOGS = 500

const taskMap = new Map<string, TaskState>()
const emitters = new Map<string, EventEmitter>()

function emitterFor(taskId: string): EventEmitter {
  let em = emitters.get(taskId)
  if (!em) {
    em = new EventEmitter()
    em.setMaxListeners(50)
    emitters.set(taskId, em)
  }
  return em
}

function newTaskId(): string {
  return `t_${randomUUID().replace(/-/g, '').slice(0, 16)}`
}

function nowMs(): number {
  return Date.now()
}

async function persistToDb(state: TaskState): Promise<void> {
  try {
    await db
      .update(tasks)
      .set({
        status: state.status,
        taskType: state.taskType,
        progress: state.progress,
        stages: state.stages,
        payload: state.payload,
        result: state.result,
        error: state.error,
        startedAt: state.startedAt ? new Date(state.startedAt) : undefined,
        completedAt: state.completedAt ? new Date(state.completedAt) : undefined,
      })
      .where(eq(tasks.id, state.id))
  } catch (e) {
    console.error('[task-engine] persist failed:', (e as Error).message)
  }
}

async function insertToDb(state: TaskState): Promise<void> {
  try {
    await db.insert(tasks).values({
      id: state.id,
      userId: state.userId,
      conversationId: state.conversationId,
      agentId: state.agentId,
      taskType: state.taskType,
      status: state.status,
      prompt: state.prompt,
      payload: state.payload,
      context: state.context,
      progress: state.progress,
      stages: state.stages,
      createdAt: new Date(state.createdAt),
    })
  } catch (e) {
    console.error('[task-engine] insert failed:', (e as Error).message)
  }
}

function emit(taskId: string, e: SseEvent): void {
  const em = emitters.get(taskId)
  if (!em) return
  em.emit('event', e)
}

export function createTask(opts: CreateTaskOptions): TaskState {
  const id = newTaskId()
  const state: TaskState = {
    id,
    taskType: opts.taskType,
    status: 'queued',
    userId: opts.userId,
    conversationId: opts.conversationId,
    agentId: opts.agentId,
    prompt: opts.prompt,
    payload: opts.payload || {},
    context: opts.context,
    result: null,
    progress: 0,
    stages: [],
    logs: [],
    createdAt: nowMs(),
  }
  taskMap.set(id, state)
  insertToDb(state).catch((e) => safeErrorLog('insertToDb', e))
  return state
}

export function getTask(taskId: string): TaskState | null {
  return taskMap.get(taskId) || null
}

export function listTasks(userId?: string): TaskState[] {
  const all = Array.from(taskMap.values())
  return userId ? all.filter((t) => t.userId === userId) : all
}

export function updateTask(taskId: string, update: TaskUpdate): TaskState | null {
  const state = taskMap.get(taskId)
  if (!state) return null
  if (update.status !== undefined) state.status = update.status
  if (update.progress !== undefined) state.progress = Math.max(0, Math.min(100, update.progress))
  if (update.stages !== undefined) state.stages = update.stages
  if (update.result !== undefined) state.result = update.result
  if (update.error !== undefined) state.error = update.error
  if (update.startedAt !== undefined) state.startedAt = update.startedAt
  if (update.completedAt !== undefined) state.completedAt = update.completedAt

  emit(taskId, {
    event: 'status',
    data: { status: state.status, progress: state.progress, t: nowMs() },
  })
  persistToDb(state).catch((e) => safeErrorLog('persistToDb', e))
  return state
}

export function setStatus(taskId: string, status: TaskStatus): TaskState | null {
  const state = taskMap.get(taskId)
  if (!state) return null
  state.status = status
  if (status === 'running' && !state.startedAt) state.startedAt = nowMs()
  emit(taskId, {
    event: 'status',
    data: { status, progress: state.progress, t: nowMs() },
  })
  persistToDb(state).catch((e) => safeErrorLog('persistToDb', e))
  return state
}

export function setStage(
  taskId: string,
  name: string,
  stageStatus: TaskStage['status'],
  progress?: number,
  message?: string,
): TaskState | null {
  const state = taskMap.get(taskId)
  if (!state) return null
  const idx = state.stages.findIndex((s) => s.name === name)
  const stage: TaskStage = {
    name,
    status: stageStatus,
    progress: progress === undefined ? (stageStatus === 'done' ? 100 : 0) : Math.max(0, Math.min(100, progress)),
    message,
    ts: nowMs(),
  }
  if (idx >= 0) state.stages[idx] = stage
  else state.stages.push(stage)

  emit(taskId, { event: 'stage', data: stage })
  persistToDb(state).catch((e) => safeErrorLog('persistToDb', e))
  return state
}

export function setProgress(taskId: string, progress: number): TaskState | null {
  const state = taskMap.get(taskId)
  if (!state) return null
  state.progress = Math.max(0, Math.min(100, progress))
  emit(taskId, { event: 'progress', data: { progress: state.progress, t: nowMs() } })
  persistToDb(state).catch((e) => safeErrorLog('persistToDb', e))
  return state
}

export function appendLog(taskId: string, level: TaskLogEntry['level'], message: string): TaskState | null {
  const state = taskMap.get(taskId)
  if (!state) return null
  const entry: TaskLogEntry = { level, message, ts: nowMs() }
  state.logs.push(entry)
  if (state.logs.length > MAX_LOGS) state.logs.splice(0, state.logs.length - MAX_LOGS)
  emit(taskId, { event: 'log', data: entry })
  return state
}

export function setResult(taskId: string, result: Record<string, unknown> | null): TaskState | null {
  const state = taskMap.get(taskId)
  if (!state) return null
  state.result = result
  emit(taskId, { event: 'result', data: { result, t: nowMs() } })
  persistToDb(state).catch((e) => safeErrorLog('persistToDb', e))
  return state
}

export function markRunning(taskId: string): TaskState | null {
  return setStatus(taskId, 'running')
}

export function markDone(taskId: string, result?: Record<string, unknown>): TaskState | null {
  const state = taskMap.get(taskId)
  if (!state) return null
  state.status = 'done'
  state.progress = 100
  state.completedAt = nowMs()
  if (result !== undefined) state.result = result
  emit(taskId, {
    event: 'done',
    data: { result: state.result ?? null, progress: 100, t: nowMs() },
  })
  persistToDb(state).catch((e) => safeErrorLog('persistToDb', e))
  return state
}

export function markFailed(taskId: string, error: string | Error, stage?: string): TaskState | null {
  const state = taskMap.get(taskId)
  if (!state) return null
  state.status = 'failed'
  state.completedAt = nowMs()
  state.error = error instanceof Error ? error.message : error
  emit(taskId, {
    event: 'error',
    data: { message: state.error, stage, t: nowMs() },
  })
  persistToDb(state).catch((e) => safeErrorLog('persistToDb', e))
  return state
}

export function markCancelled(taskId: string): TaskState | null {
  const state = taskMap.get(taskId)
  if (!state) return null
  state.status = 'cancelled'
  state.completedAt = nowMs()
  emit(taskId, { event: 'cancelled', data: { t: nowMs() } })
  persistToDb(state).catch((e) => safeErrorLog('persistToDb', e))
  return state
}

export function subscribe(taskId: string, onEvent: (e: SseEvent) => void): () => void {
  const em = emitterFor(taskId)
  em.on('event', onEvent)
  onEvent({ event: 'connected', data: { t: nowMs() } })
  return () => {
    em.off('event', onEvent)
  }
}

// ── 孤儿清理 ──────────────────────────────────────────
let sweeperStarted = false
export function startOrphanSweeper(): void {
  if (sweeperStarted) return
  sweeperStarted = true
  setInterval(() => {
    const now = nowMs()
    const ttlMs = TASK_TTL_MIN * 60_000
    for (const [taskId, t] of taskMap) {
      if (t.status === 'running' || t.status === 'queued') {
        const idle = now - (t.stages.at(-1)?.ts || t.createdAt)
        if (idle > ttlMs) {
          console.log(`[task-engine] 孤儿任务超时取消: ${taskId}`)
          markCancelled(taskId)
        }
      }
    }
  }, 60_000).unref()
}

// 服务端自动启动孤儿清理
if (typeof window === 'undefined') {
  startOrphanSweeper()
}
export async function hydrateFromDb(limit = 100): Promise<void> {
  try {
    const rows = await db.query.tasks.findMany({
      orderBy: (tasks, { desc }) => [desc(tasks.createdAt)],
      limit,
    })
    for (const row of rows) {
      if (taskMap.has(row.id)) continue
      const state: TaskState = {
        id: row.id,
        taskType: (row.taskType as TaskType) || 'hermes',
        status: (row.status as TaskStatus) || 'queued',
        userId: row.userId || undefined,
        conversationId: row.conversationId || undefined,
        agentId: row.agentId || undefined,
        prompt: row.prompt || undefined,
        payload: (row.payload as Record<string, unknown>) || {},
        context: (row.context as Record<string, unknown>) || undefined,
        result: (row.result as Record<string, unknown>) || null,
        progress: row.progress || 0,
        stages: (row.stages as TaskStage[]) || [],
        logs: [],
        error: row.error || undefined,
        createdAt: row.createdAt ? new Date(row.createdAt).getTime() : nowMs(),
        startedAt: row.startedAt ? new Date(row.startedAt).getTime() : undefined,
        completedAt: row.completedAt ? new Date(row.completedAt).getTime() : undefined,
      }
      taskMap.set(row.id, state)
    }
    console.log(`[task-engine] hydrated ${rows.length} tasks from db`)
  } catch (e) {
    console.error('[task-engine] hydrate failed:', (e as Error).message)
  }
}

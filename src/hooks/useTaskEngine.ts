'use client'

/**
 * useTaskEngine — 通用 SSE 任务进度 hook
 *
 * 用法:
 *   const { task, logs, error, connection, progress } = useTaskEngine(taskId)
 */

import { useEffect, useReducer, useRef, useCallback } from 'react'
import type {
  TaskState,
  TaskStatus,
  TaskStage,
  TaskLogEntry,
  SseEvent,
} from '@/lib/task-engine/types'
import { jobEventsURL } from '@/apis/gen'

interface State {
  task: TaskState | null
  logs: TaskLogEntry[]
  error: { message: string; stage?: string } | null
  connection: 'idle' | 'connecting' | 'open' | 'closed' | 'error'
}

type Action =
  | { type: 'SNAPSHOT'; task: TaskState }
  | { type: 'CONNECTION'; connection: State['connection'] }
  | { type: 'SSE_EVENT'; event: SseEvent }
  | { type: 'RESET' }

const LOG_RING = 200

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SNAPSHOT':
      return { ...state, task: action.task }
    case 'CONNECTION':
      return { ...state, connection: action.connection }
    case 'SSE_EVENT': {
      const e = action.event
      const task = state.task ? { ...state.task } : null
      switch (e.event) {
        case 'connected':
          return { ...state, connection: 'open' }
        case 'status': {
          // gen-api 只发 status 事件,而且第一条就是初始状态 —— 它没有 snapshot/connected。
          // 原来这里要求 task 已存在才更新,但 task 只由 SNAPSHOT 赋值、而 SNAPSHOT
          // 从没被派发过,于是 task 恒为 null,进度条永远是 0。这里改成首条 status
          // 就地建出 task。
          const next: TaskState = task ?? {
            id: String(e.data.jobId ?? ''),
            taskType: 'video' as TaskState['taskType'],
            status: e.data.status,
            payload: {},
            progress: e.data.progress ?? 0,
            stages: [],
            logs: [],
            createdAt: Date.now(),
          }
          next.status = e.data.status
          next.progress = e.data.progress ?? next.progress
          // 后端把失败原因放在 errorMsg 里
          if (e.data.errorMsg) next.error = e.data.errorMsg
          const failed = e.data.status === 'failed'
          const finished = failed || e.data.status === 'completed'
          return {
            ...state,
            task: next,
            error: failed ? { message: e.data.errorMsg || '生成失败' } : state.error,
            connection: finished ? 'closed' : state.connection,
          }
        }
        case 'stage': {
          if (task) {
            const idx = task.stages.findIndex((s) => s.name === e.data.name)
            const stages = [...task.stages]
            if (idx >= 0) stages[idx] = e.data
            else stages.push(e.data)
            task.stages = stages
          }
          return { ...state, task }
        }
        case 'progress': {
          if (task) task.progress = e.data.progress
          return { ...state, task }
        }
        case 'log': {
          const logs = [...state.logs, e.data]
          if (logs.length > LOG_RING) logs.splice(0, logs.length - LOG_RING)
          return { ...state, logs }
        }
        case 'result': {
          if (task) task.result = e.data.result
          return { ...state, task }
        }
        case 'done': {
          if (task) {
            task.status = 'done'
            task.progress = 100
            task.result = e.data.result
            task.completedAt = Date.now()
          }
          return { ...state, task, connection: 'closed' }
        }
        case 'error': {
          if (task) {
            task.status = 'failed'
            task.error = e.data.message
            task.completedAt = Date.now()
          }
          return { ...state, task, error: { message: e.data.message, stage: e.data.stage }, connection: 'closed' }
        }
        case 'cancelled': {
          if (task) task.status = 'cancelled'
          return { ...state, task, connection: 'closed' }
        }
        default:
          return state
      }
    }
    case 'RESET':
      return { task: null, logs: [], error: null, connection: 'idle' }
  }
}

const initialState: State = {
  task: null,
  logs: [],
  error: null,
  connection: 'idle',
}

export function useTaskEngine(taskId: string | null) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!taskId) {
      sourceRef.current?.close()
      sourceRef.current = null
      return
    }
    dispatch({ type: 'RESET' })
    dispatch({ type: 'CONNECTION', connection: 'connecting' })

    // 之前这里是 `/api/tasks/${taskId}/events` —— 网关上没有这个路由(404),
    // 所以 EventSource 一直在对着一个不存在的地址重连。真实地址见 apis/gen.ts。
    const src = new EventSource(jobEventsURL(taskId))
    sourceRef.current = src

    src.onopen = () => {
      dispatch({ type: 'CONNECTION', connection: 'open' })
    }
    src.onerror = () => {
      dispatch({ type: 'CONNECTION', connection: 'error' })
    }

    const types: SseEvent['event'][] = [
      'connected', 'status', 'stage', 'progress', 'log', 'result', 'done', 'error', 'cancelled',
    ]
    types.forEach((t) => {
      src.addEventListener(t, (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data)
          dispatch({ type: 'SSE_EVENT', event: { event: t, data } as SseEvent })
        } catch { /* */ }
      })
    })

    return () => {
      src.close()
      sourceRef.current = null
    }
  }, [taskId])

  // 没有 cancel。
  //
  // 原来这里是 `DELETE /api/tasks/${taskId}` —— 后端从未提供过取消接口,
  // 网关上是 404。留着一个点了必定失败的取消按钮,不如不给。
  // gen-api 要支持取消,需要先能把 ComfyUI 的 prompt 中断掉(POST /interrupt),
  // 并在中断后退回预扣的额度。

  return {
    ...state,
    progress: state.task?.progress ?? 0,
  }
}

export type { TaskState, TaskStatus, TaskStage, TaskLogEntry }

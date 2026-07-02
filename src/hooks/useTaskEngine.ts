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
          if (task) {
            task.status = e.data.status
            task.progress = e.data.progress
          }
          return { ...state, task }
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

    const src = new EventSource(`/api/tasks/${taskId}/events`)
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

  const cancel = useCallback(async () => {
    if (!taskId) return
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
  }, [taskId])

  return {
    ...state,
    progress: state.task?.progress ?? 0,
    cancel,
  }
}

export type { TaskState, TaskStatus, TaskStage, TaskLogEntry }

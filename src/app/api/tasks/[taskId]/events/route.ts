import { NextRequest } from 'next/server'
import * as taskStore from '@/lib/task-engine/store'
import { formatSseFrame, sseHeaders, SSE_HEARTBEAT } from '@/lib/task-engine/format-sse'
import type { SseEvent } from '@/lib/task-engine/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 1800

// GET /api/tasks/[taskId]/events (SSE)
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await ctx.params
  const task = taskStore.getTask(taskId)
  if (!task) {
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      const close = () => {
        if (closed) return
        closed = true
        try { controller.close() } catch { /* */ }
      }

      controller.enqueue(encoder.encode(formatSseFrame({
        event: 'connected',
        data: { t: Date.now() },
      })))

      const unsubscribe = taskStore.subscribe(taskId, (e: SseEvent) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(formatSseFrame(e)))
          if (e.event === 'done' || e.event === 'error' || e.event === 'cancelled') {
            setTimeout(close, 500).unref()
          }
        } catch {
          close()
        }
      })

      const heartbeat = setInterval(() => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(SSE_HEARTBEAT))
        } catch {
          close()
        }
      }, 25_000)

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        unsubscribe()
        close()
      })
    },
  })

  return new Response(stream, { headers: sseHeaders() })
}

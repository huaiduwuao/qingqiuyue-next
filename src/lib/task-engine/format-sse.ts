/**
 * task-engine/format-sse.ts — SSE 帧格式化
 */

import type { SseEvent } from './types'

export function formatSseFrame(e: SseEvent): string {
  return `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`
}

export const SSE_HEARTBEAT = ':hb\n\n'

export function sseHeaders(): Headers {
  const h = new Headers()
  h.set('Content-Type', 'text/event-stream; charset=utf-8')
  h.set('Cache-Control', 'no-cache, no-transform')
  h.set('Connection', 'keep-alive')
  h.set('X-Accel-Buffering', 'no')
  return h
}

/**
 * avatar-pipeline format-sse.ts —— SSE 帧格式化
 *
 * Server-Sent Events 协议:
 *   event: <name>\n
 *   data: <json>\n
 *   \n
 *
 * 多行 data 用 data: <line>\n 重复,这里我们只发单行 JSON。
 */

import type { SseEvent } from './types';

export function formatSseFrame(e: SseEvent): string {
  return `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`;
}

/** 心跳:注释行,客户端 EventSource 不触发 message 事件 */
export const SSE_HEARTBEAT = ':hb\n\n';

export interface SseResponseInit {
  headers?: HeadersInit;
}

/** 构造一个 SSE Response,带标准头 */
export function sseHeaders(): Headers {
  const h = new Headers();
  h.set('Content-Type', 'text/event-stream; charset=utf-8');
  h.set('Cache-Control', 'no-cache, no-transform');
  h.set('Connection', 'keep-alive');
  // 关掉 nginx 缓冲,允许流式
  h.set('X-Accel-Buffering', 'no');
  return h;
}

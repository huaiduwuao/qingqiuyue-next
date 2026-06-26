import { NextRequest } from 'next/server';
import * as jobStore from '@/lib/avatar-pipeline/job-store';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/avatar-pipeline/auth';
import { formatSseFrame, sseHeaders, SSE_HEARTBEAT } from '@/lib/avatar-pipeline/format-sse';
import type { SseEvent } from '@/lib/avatar-pipeline/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 30 分钟上限(刚好覆盖最长 pipeline 30min TTL)
export const maxDuration = 60 * 30;

// GET /api/avatar/pipeline/jobs/[jobId]/events (SSE)
//
// 流程:
//   1. 鉴权 + 所有权校验
//   2. 立即推 replay(从 MinIO events/<id>.ndjson 读历史,加速客户端初始化)
//   3. subscribe job-store EventEmitter,实时推新事件
//   4. 每 25s 一行 :hb 心跳
//   5. 客户端断开 / job 终态 / 超时:关闭
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const user = getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  const { jobId } = await ctx.params;

  const j = jobStore.getJob(jobId);
  if (!j) {
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
  if (j.userId !== user.userId) return forbiddenResponse();
  j.lastClientActivityAt = Date.now();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* */ }
      };

      // 先推一帧 SSE headers(浏览器 EventSource 必须先收到 data:)
      controller.enqueue(encoder.encode(formatSseFrame({
        event: 'connected',
        data: { t: Date.now() },
      })));

      // 订阅 job-store 实时事件
      const unsubscribe = jobStore.subscribe(jobId, (e: SseEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(formatSseFrame(e)));
          if (e.event === 'done' || e.event === 'cancelled' || e.event === 'error') {
            // 终态,稍后关流
            setTimeout(close, 500).unref();
          }
        } catch {
          close();
        }
      });

      // 心跳
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(SSE_HEARTBEAT));
        } catch {
          close();
        }
      }, 25_000);

      // 客户端断开
      const onAbort = () => {
        clearInterval(heartbeat);
        unsubscribe();
        close();
      };
      req.signal.addEventListener('abort', onAbort);
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}

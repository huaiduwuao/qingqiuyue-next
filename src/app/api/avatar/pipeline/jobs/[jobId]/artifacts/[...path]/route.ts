import { NextRequest } from 'next/server';
import * as jobStore from '@/lib/avatar-pipeline/job-store';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/avatar-pipeline/auth';
import * as minio from '@/lib/avatar-pipeline/minio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/avatar/pipeline/jobs/[jobId]/artifacts/[...path]
// 从 MinIO 拉 artifacts/<jobId>/<path> 代理给客户端
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ jobId: string; path: string[] }> },
) {
  const user = getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  const { jobId, path: parts } = await ctx.params;

  const j = jobStore.getJob(jobId);
  if (!j) return new Response('not found', { status: 404 });
  if (j.userId !== user.userId) return forbiddenResponse();

  // 安全:path 段只允许字母数字 + ._-/
  const safe = parts.join('/');
  if (/[^a-zA-Z0-9._\-/]/.test(safe)) {
    return new Response('bad path', { status: 400 });
  }
  const key = `artifacts/${jobId}/${safe}`;
  const buf = await minio.getObjectBuffer(key);
  if (!buf) return new Response('not found', { status: 404 });

  // 推断 content-type
  const ct = safe.endsWith('.glb') || safe.endsWith('.gltf')
    ? 'model/gltf-binary'
    : safe.endsWith('.mp4')
    ? 'video/mp4'
    : safe.endsWith('.log') || safe.endsWith('.txt')
    ? 'text/plain; charset=utf-8'
    : safe.endsWith('.json')
    ? 'application/json'
    : 'application/octet-stream';

  j.lastClientActivityAt = Date.now();

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': ct,
      'Content-Length': String(buf.length),
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

import { NextRequest, NextResponse } from 'next/server';
import * as jobStore from '@/lib/avatar-pipeline/job-store';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/avatar-pipeline/auth';
import type { JobSnapshot } from '@/lib/avatar-pipeline/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/avatar/pipeline/jobs/[jobId] —— 快照
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const user = getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  const { jobId } = await ctx.params;

  const j = jobStore.getJob(jobId);
  if (!j) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (j.userId !== user.userId) return forbiddenResponse();

  const snap: JobSnapshot = {
    jobId: j.jobId,
    name: j.name,
    status: j.status,
    stage: j.stage,
    pct: j.pct,
    createdAt: j.createdAt,
    startedAt: j.startedAt,
    finishedAt: j.finishedAt,
    durationMs: j.durationMs,
    artifacts: j.artifacts,
    error: j.error,
    config: j.config,
  };
  // 刷新活动戳
  j.lastClientActivityAt = Date.now();
  return NextResponse.json(snap);
}

// DELETE /api/avatar/pipeline/jobs/[jobId] —— 取消
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const user = getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  const { jobId } = await ctx.params;

  const j = jobStore.getJob(jobId);
  if (!j) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (j.userId !== user.userId) return forbiddenResponse();

  if (j.status !== 'running') {
    return NextResponse.json(
      { error: 'invalid_state', msg: `当前状态 ${j.status} 不允许取消` },
      { status: 409 },
    );
  }
  if (!j.pgid) {
    return NextResponse.json(
      { error: 'no_pgid', msg: '无进程组 ID' },
      { status: 500 },
    );
  }

  const pgid = j.pgid;
  console.log(`[pipeline] 取消 job ${jobId}, 杀进程组 ${pgid}`);
  try {
    process.kill(pgid, 'SIGTERM');
  } catch (e: any) {
    // 进程可能已经死
  }
  // 5s 后强杀
  setTimeout(() => {
    try {
      process.kill(pgid, 'SIGKILL');
    } catch { /* */ }
  }, 5000).unref();

  return NextResponse.json({ jobId, status: 'cancelling' }, { status: 202 });
}

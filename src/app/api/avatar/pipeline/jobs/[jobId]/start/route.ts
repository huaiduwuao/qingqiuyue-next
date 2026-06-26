import { NextRequest, NextResponse } from 'next/server';
import * as jobStore from '@/lib/avatar-pipeline/job-store';
import { runJob } from '@/lib/avatar-pipeline/run-pipeline';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/avatar-pipeline/auth';
import { startOrphanSweeper } from '@/lib/avatar-pipeline/job-store';
import * as minio from '@/lib/avatar-pipeline/minio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 启动后台 sweeper(模块加载时跑一次,幂等)
startOrphanSweeper();

// POST /api/avatar/pipeline/jobs/[jobId]/start
// 1. 校验 input.mp4 已就位(已 upload)
// 2. 校验并发
// 3. 调 runJob(异步,不等结果)
// 4. 返回 202 + eventsUrl
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const user = getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  const { jobId } = await ctx.params;

  const j = jobStore.getJob(jobId);
  if (!j) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (j.userId !== user.userId) return forbiddenResponse();

  // 必须在 ready 状态才能 start
  if (j.status !== 'ready' && j.status !== 'awaiting_upload') {
    return NextResponse.json(
      { error: 'invalid_state', msg: `当前状态 ${j.status} 不允许 start` },
      { status: 409 },
    );
  }

  // 校验视频已就位
  try {
    const stat = await minio.statObject(`uploads/${jobId}/input.mp4`);
    if (!stat) {
      return NextResponse.json(
        { error: 'no_input', msg: '请先上传视频' },
        { status: 422 },
      );
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: 'minio_error', msg: `对象存储查询失败: ${e?.message || e}` },
      { status: 503 },
    );
  }

  // 标记 ready(如果还在 awaiting_upload)
  if (j.status === 'awaiting_upload') {
    jobStore.markReady(jobId, `uploads/${jobId}/input.mp4`);
  }

  // 并发限制
  const slot = jobStore.canStartNew();
  if (!slot.ok) {
    return NextResponse.json({ error: 'busy', msg: slot.reason }, { status: 503 });
  }

  // 启动(不等结果)
  const runOpts = {
    name: j.name,
    skip3dgs: j.config.skip3dgs,
    height: j.config.height,
    mixamoKey: j.config.mixamoKey ?? undefined,
  };
  runJob(jobId, runOpts).catch((e) => {
    console.error(`[pipeline] runJob ${jobId} 失败:`, e);
    jobStore.markFailed(jobId, 'INTERNAL_ERROR', e?.message || String(e));
  });

  return NextResponse.json(
    {
      jobId,
      status: 'running',
      eventsUrl: `/api/avatar/pipeline/jobs/${jobId}/events`,
    },
    { status: 202 },
  );
}

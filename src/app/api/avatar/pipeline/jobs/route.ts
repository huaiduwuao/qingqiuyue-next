import { NextRequest, NextResponse } from 'next/server';
import * as jobStore from '@/lib/avatar-pipeline/job-store';
import * as minio from '@/lib/avatar-pipeline/minio';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/avatar-pipeline/auth';
import type { CreateJobRequest, CreateJobResponse } from '@/lib/avatar-pipeline/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_CONCURRENT_HARD_LIMIT = 10; // 防止单用户刷接口占用所有 job

// POST /api/avatar/pipeline/jobs —— 创建 job,返回 presigned upload URL
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  let body: CreateJobRequest = {};
  try {
    body = await req.json();
  } catch {
    // 允许空 body
  }

  // 并发限制
  const slot = jobStore.canStartNew();
  if (!slot.ok) {
    return NextResponse.json({ error: 'busy', msg: slot.reason }, { status: 503 });
  }
  // 单用户 job 数限制
  const myJobs = jobStore.listJobs(user.userId);
  const myActive = myJobs.filter((j) =>
    j.status === 'running' || j.status === 'awaiting_upload' || j.status === 'ready'
  ).length;
  if (myActive >= MAX_CONCURRENT_HARD_LIMIT) {
    return NextResponse.json(
      { error: 'too_many', msg: `单用户最多 ${MAX_CONCURRENT_HARD_LIMIT} 个未完成任务` },
      { status: 429 },
    );
  }

  const job = jobStore.createJob(user.userId, body);
  const videoKey = `uploads/${job.jobId}/input.mp4`;

  let uploadUrl: string;
  try {
    uploadUrl = await minio.presignedPutUrl(videoKey, 3600);
  } catch (e: any) {
    jobStore.markFailed(job.jobId, 'MINIO_PRESIGN_FAILED', e?.message || 'presign 失败');
    return NextResponse.json(
      { error: 'minio_error', msg: `对象存储不可用: ${e?.message || e}` },
      { status: 503 },
    );
  }

  const resp: CreateJobResponse = {
    jobId: job.jobId,
    status: job.status,
    upload: {
      type: 'presigned',
      url: uploadUrl,
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4' },
      expiresInSec: 3600,
    },
    videoKey,
  };
  return NextResponse.json(resp, { status: 201 });
}

// GET /api/avatar/pipeline/jobs —— 列表(只返回当前用户的)
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  const jobs = jobStore.listJobs(user.userId).map((j) => ({
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
  }));
  return NextResponse.json({ list: jobs });
}

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { writeFile, mkdir } from 'fs/promises';
import * as jobStore from '@/lib/avatar-pipeline/job-store';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/avatar-pipeline/auth';
import * as minio from '@/lib/avatar-pipeline/minio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/avatar/pipeline/jobs/[jobId]/deploy
// 把 MinIO 上的 model.glb + outfits/*.glb 拷到 public/avatars/(覆盖)
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

  if (j.status !== 'completed') {
    return NextResponse.json(
      { error: 'invalid_state', msg: `当前状态 ${j.status} 不允许部署` },
      { status: 409 },
    );
  }

  const repoRoot = process.cwd();
  const publicAvatars = path.join(repoRoot, 'public', 'avatars');
  const publicOutfits = path.join(publicAvatars, 'outfits');

  const deployed: string[] = [];

  // 找 model.glb
  const modelArtifact = j.artifacts.find((a) => a.key.endsWith('/model.glb'));
  if (modelArtifact) {
    const buf = await minio.getObjectBuffer(modelArtifact.key);
    if (buf) {
      await mkdir(publicAvatars, { recursive: true });
      await writeFile(path.join(publicAvatars, 'model.glb'), new Uint8Array(buf));
      deployed.push('public/avatars/model.glb');
    }
  } else {
    return NextResponse.json(
      { error: 'no_model', msg: 'job 产物中无 model.glb' },
      { status: 422 },
    );
  }

  // outfits 全部部署,casual 默认 = model
  const outfitArtifacts = j.artifacts.filter((a) => /\/(outfits)\/[^/]+\.glb$/.test(a.key));
  await mkdir(publicOutfits, { recursive: true });
  // 先把主模型拷成 casual(若没有 casual artifact)
  const hasCasual = outfitArtifacts.some((a) => a.key.endsWith('/outfits/casual.glb'));
  if (!hasCasual && deployed.length) {
    const buf = await minio.getObjectBuffer(modelArtifact.key);
    if (buf) {
      await writeFile(path.join(publicOutfits, 'casual.glb'), new Uint8Array(buf));
      deployed.push('public/avatars/outfits/casual.glb');
    }
  }
  for (const a of outfitArtifacts) {
    const buf = await minio.getObjectBuffer(a.key);
    if (buf) {
      const filename = a.key.split('/').pop()!;
      await writeFile(path.join(publicOutfits, filename), new Uint8Array(buf));
      deployed.push(`public/avatars/outfits/${filename}`);
    }
  }

  return NextResponse.json({ deployed, modelUrl: '/avatars/model.glb' });
}

/**
 * avatar-pipeline run-pipeline.ts —— spawn avatar-pipeline.sh 编排器
 *
 * 职责:
 *   1. 从 MinIO 下载 input.mp4 到本地 workdir
 *   2. spawn bash scripts/avatar-pipeline.sh (detached, 进程组)
 *   3. parser 解析 stdout / stderr → job-store 状态
 *   4. 退出后:成功 → 上传 deploy/ 到 MinIO,失败/取消 → 标记
 */

import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { pipeline as streamPipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import { mkdir, stat, readdir } from 'fs/promises';
import * as minio from './minio';
import * as jobStore from './job-store';
import { parseLine } from './parser';
import type { StartJobRequest, PipelineStage, Artifact } from './types';

const REPO_ROOT = process.cwd();
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'avatar-pipeline.sh');
const WORK_ROOT = process.env.AVATAR_WORK_ROOT || path.join(REPO_ROOT, '.avatar-work');

export interface RunResult {
  ok: boolean;
  code: number | null;
  signal: NodeJS.Signals | null;
  artifacts: Artifact[];
  error?: string;
}

export async function runJob(jobId: string, opts: StartJobRequest): Promise<RunResult> {
  const workDir = path.join(WORK_ROOT, 'jobs', jobId);
  const deployDir = path.join(workDir, 'deploy');
  const inputLocal = path.join(workDir, 'input.mp4');

  // 0. 准备 workdir
  await mkdir(workDir, { recursive: true });
  await mkdir(deployDir, { recursive: true });

  // 1. 视频模式:从 MinIO 下载 input.mp4 / 库模式:跳过
  if (!opts.fromLibrary) {
    const videoKey = `uploads/${jobId}/input.mp4`;
    let videoStat: Awaited<ReturnType<typeof minio.statObject>>;
    try {
      videoStat = await minio.statObject(videoKey);
    } catch (e) {
      throw new Error(`input 视频不存在: ${videoKey}`);
    }
    if (!videoStat) {
      throw new Error(`input 视频不存在: ${videoKey}`);
    }
    // 限制最大 2GB
    if (videoStat.size > 2 * 1024 * 1024 * 1024) {
      throw new Error(`视频过大: ${(videoStat.size / 1e9).toFixed(1)} GB (上限 2 GB)`);
    }
    await minio.getFile(videoKey, inputLocal);
  }

  // 2. spawn bash 脚本
  const args: string[] = [
    SCRIPT_PATH,
    '--name', opts.name || jobId,
    '--out', workDir,
    '--deploy-dir', deployDir,
  ];
  if (opts.fromLibrary) {
    args.push('--from-library', opts.fromLibrary);
  } else {
    args.push('--input', inputLocal);
  }
  if (opts.skip3dgs) args.push('--skip-3dgs');
  if (opts.mixamoKey) {
    args.push('--mixamo', await downloadMixamoDir(jobId, opts.mixamoKey, workDir));
  }
  if (opts.height) {
    args.push('--height', String(opts.height));
  }

  return new Promise<RunResult>((resolve) => {
    const child: ChildProcess = spawn('bash', args, {
      cwd: REPO_ROOT,
      detached: true, // 新建进程组,便于 kill -pgid
      env: { ...process.env, AVATAR_PIPELINE_JOB_ID: jobId },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (!child.pid) {
      jobStore.markFailed(jobId, 'SPAWN_FAILED', '无法启动子进程');
      resolve({ ok: false, code: null, signal: null, artifacts: [], error: 'spawn failed' });
      return;
    }

    // 负数 pgid = 进程组 ID
    const pgid = -child.pid;
    jobStore.markRunning(jobId, pgid);

    // 3. 解析 stdout / stderr
    const onParse = (stream: 'stdout' | 'stderr') => (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      for (const line of text.split('\n')) {
        if (!line) continue;
        parseLine(line, stream, {
          onStage: (stage, pct) => jobStore.setStage(jobId, stage, pct),
          onProgress: (pct) => jobStore.setProgress(jobId, pct),
          onLog: (s, l) => jobStore.appendLog(jobId, s, l),
        });
      }
    };
    child.stdout?.on('data', onParse('stdout'));
    child.stderr?.on('data', onParse('stderr'));

    // 4. 退出
    child.on('exit', async (code, signal) => {
      // 找出 script 实际 emit 的最后一个 stage
      const job = jobStore.getJob(jobId);
      if (!job) {
        resolve({ ok: false, code, signal, artifacts: [], error: 'job 不存在' });
        return;
      }
      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        jobStore.markCancelling(jobId);
        resolve({ ok: false, code, signal, artifacts: job.artifacts, error: 'cancelled' });
        return;
      }
      if (code !== 0) {
        jobStore.markFailed(jobId, 'STAGE_FAILED', `bash 退出码 ${code}`);
        resolve({ ok: false, code, signal, artifacts: job.artifacts, error: `exit ${code}` });
        return;
      }
      // 成功:上传 deploy/ 到 MinIO
      try {
        const uploaded = await minio.putDir(deployDir, `artifacts/${jobId}`);
        for (const key of uploaded) {
          const stat = await minio.statObject(key);
          if (!stat) continue;
          const artifact: Artifact = {
            key,
            bytes: stat.size,
            contentType: stat.contentType || guessContentType(key),
            downloadUrl: `/api/avatar/pipeline/jobs/${jobId}/artifacts/${encodeURI(key.replace(`artifacts/${jobId}/`, ''))}`,
          };
          jobStore.addArtifact(jobId, artifact);
        }
        jobStore.markCompleted(jobId);
        resolve({ ok: true, code, signal, artifacts: jobStore.getJob(jobId)?.artifacts || [] });
      } catch (e: any) {
        jobStore.markFailed(jobId, 'UPLOAD_FAILED', `上传产物到 MinIO 失败: ${e?.message || e}`);
        resolve({ ok: false, code, signal, artifacts: jobStore.getJob(jobId)?.artifacts || [], error: 'upload failed' });
      }
    });

    // 5. spawn 错误(例如 ENOENT)
    child.on('error', (err) => {
      jobStore.markFailed(jobId, 'SPAWN_ERROR', err.message);
      resolve({ ok: false, code: null, signal: null, artifacts: [], error: err.message });
    });
  });
}

/** 把 MinIO 的 mixamo/<jobId>/* 拉本地 workdir/mixamo/ */
async function downloadMixamoDir(jobId: string, mixamoKey: string, workDir: string): Promise<string> {
  const localDir = path.join(workDir, 'mixamo');
  await mkdir(localDir, { recursive: true });
  // 用 minio listObjectsV2
  const c = (minio as any).getClient ? (minio as any).getClient() : null;
  if (!c) throw new Error('minio client 未初始化');
  const objects: string[] = [];
  await new Promise<void>((resolve, reject) => {
    const stream = c.listObjectsV2(minio.BUCKET, `${mixamoKey}/`, true);
    stream.on('data', (o: any) => { if (o.name) objects.push(o.name); });
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });
  for (const key of objects) {
    const rel = key.replace(`${mixamoKey}/`, '');
    const local = path.join(localDir, rel);
    await minio.getFile(key, local);
  }
  return localDir;
}

function guessContentType(key: string): string {
  if (key.endsWith('.glb') || key.endsWith('.gltf')) return 'model/gltf-binary';
  if (key.endsWith('.mp4')) return 'video/mp4';
  if (key.endsWith('.log') || key.endsWith('.txt')) return 'text/plain; charset=utf-8';
  if (key.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

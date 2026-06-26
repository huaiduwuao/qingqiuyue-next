/**
 * avatar-pipeline job-store.ts —— 内存 job 状态 + EventEmitter fan-out
 *
 * 设计:
 *   - 单进程 Map<jobId, JobState>(不做持久化,重启会丢,这是 v1 限制)
 *   - 每个 jobId 一个 EventEmitter,emit SseEvent 给所有订阅者
 *   - markRunning / appendLog / setStage / appendEvent 都会 push 给订阅者
 *   - 后台 sweeper 每分钟跑一次,清理没人订阅的孤儿 job
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import type {
  JobState,
  JobStatus,
  PipelineStage,
  SseEvent,
  Artifact,
  StartJobRequest,
} from './types';
import * as minio from './minio';

const LOG_RING_SIZE = 500;
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_PIPELINES || '2', 10);
const JOB_TTL_MIN = parseInt(process.env.AVATAR_JOB_TTL_MIN || '30', 10);

// 模块级状态
const jobs = new Map<string, JobState>();
const emitters = new Map<string, EventEmitter>();

function emitterFor(jobId: string): EventEmitter {
  let em = emitters.get(jobId);
  if (!em) {
    em = new EventEmitter();
    em.setMaxListeners(50); // 多个 SSE 客户端可同时订阅
    emitters.set(jobId, em);
  }
  return em;
}

function newJobState(opts: { jobId: string; userId: string; name: string; config: StartJobRequest }): JobState {
  return {
    jobId: opts.jobId,
    name: opts.name,
    status: 'awaiting_upload',
    stage: null,
    pct: 0,
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    artifacts: [],
    error: null,
    config: {
      skip3dgs: opts.config.skip3dgs || false,
      height: opts.config.height || 1.75,
      mixamoKey: opts.config.mixamoKey || null,
    },
    userId: opts.userId,
    pgid: null,
    logs: [],
    subscriberCount: 0,
    lastClientActivityAt: Date.now(),
  };
}

// ── 公开 API ──────────────────────────────────────

export function createJob(userId: string, opts: StartJobRequest): JobState {
  const jobId = `j_${randomUUID().slice(0, 12)}`;
  const state = newJobState({ jobId, userId, name: opts.name || jobId, config: opts });
  jobs.set(jobId, state);
  // 初始化 MinIO 目录(可空对象,只确保桶存在)
  minio.ensureBucket().catch(() => { /* 延迟到首次访问时再试 */ });
  return state;
}

export function getJob(jobId: string): JobState | null {
  return jobs.get(jobId) || null;
}

export function listJobs(userId: string): JobState[] {
  return Array.from(jobs.values())
    .filter((j) => j.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function canStartNew(): { ok: true } | { ok: false; reason: string } {
  const running = Array.from(jobs.values()).filter((j) => j.status === 'running').length;
  if (running >= MAX_CONCURRENT) {
    return { ok: false, reason: `服务器繁忙,正在跑 ${running} 个 pipeline,最多 ${MAX_CONCURRENT} 个并发` };
  }
  return { ok: true };
}

export function markReady(jobId: string, videoKey: string): JobState | null {
  const j = jobs.get(jobId);
  if (!j) return null;
  j.status = 'ready';
  j.lastClientActivityAt = Date.now();
  emitToJob(jobId, { event: 'status', data: { status: 'ready', stage: null, pct: 0, t: Date.now() } });
  // 持久化 state 到 MinIO
  saveStateToMinio(j).catch(() => { /* 非关键 */ });
  return j;
}

export function markRunning(jobId: string, pgid: number): JobState | null {
  const j = jobs.get(jobId);
  if (!j) return null;
  j.status = 'running';
  j.startedAt = Date.now();
  j.pgid = pgid;
  j.lastClientActivityAt = Date.now();
  emitToJob(jobId, { event: 'status', data: { status: 'running', stage: j.stage, pct: j.pct, t: Date.now() } });
  saveStateToMinio(j).catch(() => { /* */ });
  return j;
}

export function setStage(jobId: string, stage: PipelineStage, pct: number): void {
  const j = jobs.get(jobId);
  if (!j) return;
  j.stage = stage;
  j.pct = Math.max(0, Math.min(100, pct));
  emitToJob(jobId, { event: 'stage', data: { stage, pct: j.pct, t: Date.now() } });
  saveStateToMinio(j).catch(() => { /* */ });
}

export function setProgress(jobId: string, pct: number): void {
  const j = jobs.get(jobId);
  if (!j) return;
  j.pct = Math.max(0, Math.min(100, pct));
  emitToJob(jobId, { event: 'progress', data: { pct: j.pct, t: Date.now() } });
}

export function appendLog(jobId: string, stream: 'stdout' | 'stderr', line: string): void {
  const j = jobs.get(jobId);
  if (!j) return;
  const entry = { stream, line, t: Date.now() };
  j.logs.push(entry);
  if (j.logs.length > LOG_RING_SIZE) {
    j.logs.splice(0, j.logs.length - LOG_RING_SIZE);
  }
  emitToJob(jobId, { event: 'log', data: entry });
}

export function addArtifact(jobId: string, artifact: Artifact): void {
  const j = jobs.get(jobId);
  if (!j) return;
  j.artifacts.push(artifact);
  emitToJob(jobId, { event: 'artifact', data: { ...artifact, t: Date.now() } });
  saveStateToMinio(j).catch(() => { /* */ });
}

export function markCompleted(jobId: string): void {
  const j = jobs.get(jobId);
  if (!j) return;
  j.status = 'completed';
  j.finishedAt = Date.now();
  j.durationMs = (j.finishedAt - (j.startedAt || j.finishedAt));
  j.pct = 100;
  j.pgid = null;
  emitToJob(jobId, {
    event: 'done',
    data: { status: 'completed', durationMs: j.durationMs, artifacts: j.artifacts, t: Date.now() },
  });
  saveStateToMinio(j).catch(() => { /* */ });
}

export function markFailed(jobId: string, code: string, message: string): void {
  const j = jobs.get(jobId);
  if (!j) return;
  j.status = 'failed';
  j.finishedAt = Date.now();
  j.durationMs = j.finishedAt - (j.startedAt || j.finishedAt);
  j.pgid = null;
  j.error = { stage: j.stage || 'unknown', message, logsTail: j.logs.slice(-50).map((l) => l.line) };
  emitToJob(jobId, {
    event: 'error',
    data: { code, stage: j.stage || 'unknown', message, logsTail: j.error.logsTail, t: Date.now() },
  });
  saveStateToMinio(j).catch(() => { /* */ });
}

export function markCancelling(jobId: string): void {
  const j = jobs.get(jobId);
  if (!j) return;
  j.status = 'cancelled';
  j.finishedAt = Date.now();
  j.pgid = null;
  emitToJob(jobId, { event: 'cancelled', data: { t: Date.now() } });
  saveStateToMinio(j).catch(() => { /* */ });
}

// ── SSE 订阅 ──────────────────────────────────────

export function subscribe(jobId: string, onEvent: (e: SseEvent) => void): () => void {
  const em = emitterFor(jobId);
  em.on('event', onEvent);
  const j = jobs.get(jobId);
  if (j) j.subscriberCount++;
  // 推一个 connected 事件,客户端据此知道连接 OK
  onEvent({ event: 'connected', data: { t: Date.now() } });
  return () => {
    em.off('event', onEvent);
    if (j) j.subscriberCount = Math.max(0, j.subscriberCount - 1);
  };
}

function emitToJob(jobId: string, e: SseEvent): void {
  const em = emitters.get(jobId);
  if (!em) return;
  em.emit('event', e);
  // 异步追加到 MinIO ndjson(不阻塞)
  const key = `events/${jobId}.ndjson`;
  minio.appendNdjson(key, { ...e, _t: Date.now() }).catch(() => { /* 非关键 */ });
}

// ── 持久化 state 到 MinIO(用于后台诊断 / 日后引入跨进程 worker) ──

async function saveStateToMinio(j: JobState): Promise<void> {
  const { pgid, logs, subscriberCount, ...snapshot } = j;
  await minio.putObject(
    `state/${j.jobId}.json`,
    Buffer.from(JSON.stringify(snapshot, null, 2), 'utf8'),
    'application/json',
  );
}

// ── 孤儿清理:每分钟跑一次 ──

let sweeperStarted = false;
export function startOrphanSweeper(): void {
  if (sweeperStarted) return;
  sweeperStarted = true;
  setInterval(() => {
    const now = Date.now();
    const ttlMs = JOB_TTL_MIN * 60_000;
    for (const [jobId, j] of jobs) {
      if (j.status !== 'running' && j.status !== 'awaiting_upload' && j.status !== 'ready') continue;
      const idleMs = now - j.lastClientActivityAt;
      if (idleMs > ttlMs && j.subscriberCount === 0) {
        console.log(`[job-store] 清理孤儿 job: ${jobId} (idle ${Math.floor(idleMs / 60_000)}min)`);
        if (j.pgid) {
          try { process.kill(j.pgid, 'SIGKILL'); } catch { /* */ }
        }
        j.status = 'cancelled';
        j.finishedAt = now;
        j.pgid = null;
        j.error = { stage: j.stage || 'unknown', message: 'no client activity, auto-cancelled', logsTail: [] };
        jobs.delete(jobId);
        emitters.delete(jobId);
      }
    }
  }, 60_000).unref();
}

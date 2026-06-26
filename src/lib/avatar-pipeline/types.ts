/**
 * avatar-pipeline types —— 共享类型,前端 + 后端都用
 */

// Job 状态机:严格的有限状态
export type JobStatus =
  | 'awaiting_upload' // 创建了,等用户 PUT 视频
  | 'ready'           // 视频到位,可以 start
  | 'running'         // 正在跑
  | 'completed'       // 成功
  | 'failed'          // 失败
  | 'cancelled';      // 用户取消

// avatar-pipeline.sh 输出的 6 个阶段(沿用脚本 emit 的 STAGE <key>)
export const PIPELINE_STAGES = [
  'capture',
  'reconstruct',
  'train_3dgs',
  'mesh',
  'rig_blender',
  'deploy',
] as const;
export type PipelineStage = typeof PIPELINE_STAGES[number];

// StartJob 请求体
export interface StartJobRequest {
  /** 角色名,缺省用 jobId */
  name?: string;
  /** 跳过 3DGS 训练(无 GPU 时用) */
  skip3dgs?: boolean;
  /** 角色身高(米) */
  height?: number;
  /** Mixamo 动作目录 key(prefix),可选 */
  mixamoKey?: string;
  /** 预制库角色 id(如 aoi/yuki/...);设置后跳过 capture/reconstruct/3dgs/mesh */
  fromLibrary?: string;
}

// CreateJob 请求体
export interface CreateJobRequest extends StartJobRequest {
  /** fromLibrary 也允许在 create 阶段就传(server 可以选:要不要立即 start) */
  fromLibrary?: string;
}

// CreateJob 响应
export interface CreateJobResponse {
  jobId: string;
  status: JobStatus;
  upload: {
    type: 'presigned' | 'proxy';
    url: string;
    method: 'PUT' | 'POST';
    headers?: Record<string, string>;
    expiresInSec: number;
  };
  videoKey: string;
}

// Job 快照(GET /jobs/[id])
export interface JobSnapshot {
  jobId: string;
  name: string;
  status: JobStatus;
  stage: PipelineStage | null;
  pct: number;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  durationMs: number | null;
  artifacts: Artifact[];
  error: { stage: PipelineStage | string; message: string; logsTail: string[] } | null;
  config: {
    skip3dgs: boolean;
    height: number;
    mixamoKey: string | null;
  };
}

export interface Artifact {
  key: string;          // MinIO key,如 "artifacts/j_xxx/model.glb"
  bytes: number;
  contentType: string;
  downloadUrl: string;  // 相对路径 /api/avatar/pipeline/jobs/<id>/artifacts/<path>
}

// SSE 事件类型(给前端 usePipelineJob hook 用)
export type SseEvent =
  | { event: 'stage'; data: { stage: PipelineStage; pct: number; t: number } }
  | { event: 'progress'; data: { pct: number; t: number } }
  | { event: 'log'; data: { stream: 'stdout' | 'stderr'; line: string; t: number } }
  | { event: 'status'; data: { status: JobStatus; stage: PipelineStage | null; pct: number; t: number } }
  | { event: 'artifact'; data: Artifact & { t: number } }
  | { event: 'done'; data: { status: 'completed'; durationMs: number; artifacts: Artifact[]; t: number } }
  | { event: 'error'; data: { code: string; stage: PipelineStage | string; message: string; logsTail: string[]; t: number } }
  | { event: 'cancelled'; data: { t: number } }
  | { event: 'connected'; data: { t: number } };

// 内部:job-store 的 JobState(扩展 JobSnapshot,加运行时字段)
export interface JobState extends JobSnapshot {
  userId: string;          // 创建者
  /** 进程组 ID(负数,kill(-pgid, ...) 用) */
  pgid: number | null;
  /** 日志 ring buffer,最近 500 行 */
  logs: { stream: 'stdout' | 'stderr'; line: string; t: number }[];
  /** EventEmitter 订阅者数量,0 时启动孤儿清理 */
  subscriberCount: number;
  /** 最后一次有客户端活动(GET 快照或 SSE 连接) */
  lastClientActivityAt: number;
}

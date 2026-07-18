export {}; // Make this a module

// ============ 镜像管理 ============

// SandboxImageCreateReq 创建镜像请求
export interface SandboxImageCreateReq {
  name: string;
  displayName?: string;
  description?: string;
  dockerfile?: string;
  entrypoint?: string;
  cmd?: string;
  memoryLimit?: string;
  cpuCount?: number;
  timeoutSec?: number;
}

// SandboxImageUpdateReq 更新镜像请求
export interface SandboxImageUpdateReq {
  displayName?: string;
  description?: string;
  entrypoint?: string;
  cmd?: string;
  memoryLimit?: string;
  cpuCount?: number;
  timeoutSec?: number;
  status?: string;
}

// SandboxImageResp 镜像响应
export interface SandboxImageResp {
  id: number;
  name: string;
  displayName: string;
  description: string;
  baseImage: string;
  entrypoint: string;
  cmd: string;
  memoryLimit: string;
  cpuCount: number;
  timeoutSec: number;
  isPublic: boolean;
  pullCount: number;
  status: string;
  createTime: string;
}

// ============ 任务管理 ============

// FileInput 文件输入
export interface FileInput {
  name: string;
  content: string; // base64 编码
  targetPath: string;
}

// SandboxTaskCreateReq 创建任务请求
export interface SandboxTaskCreateReq {
  title: string;
  imageId: number;
  code: string;
  inputFiles?: FileInput[];
  args?: string;
  env?: Record<string, string>;
  timeoutSec?: number;
  memoryLimit?: string;
}

// FileOutput 文件输出
export interface FileOutput {
  name: string;
  url: string;
  size: number;
  mimeType: string;
}

// SandboxTaskResp 任务响应
export interface SandboxTaskResp {
  taskId: string;
  title: string;
  status: string;
  imageName: string;
  language: string;
  exitCode: number;
  stdout?: string;
  stderr?: string;
  outputFiles?: FileOutput[];
  errorMsg?: string;
  durationMs: number;
  timeoutSec: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

// SandboxTaskListReq 任务列表查询
export interface SandboxTaskListReq {
  page?: number;
  pageSize?: number;
  status?: string;
  imageId?: number;
}

// SandboxTaskStatusResp 任务状态响应
export interface SandboxTaskStatusResp {
  taskId: string;
  status: string;
  message?: string;
  progress: number;
  containerId?: string;
  exitCode?: number;
}

// ============ 状态常量 ============
export const TASK_STATUS = {
  PENDING: 'pending',
  SCHEDULING: 'scheduling',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout',
} as const;

export const TASK_STATUS_LABELS: Record<string, string> = {
  pending: '等待中',
  scheduling: '调度中',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
  timeout: '超时',
};

export const TASK_STATUS_COLORS: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  pending: 'default',
  scheduling: 'info',
  running: 'info',
  completed: 'success',
  failed: 'error',
  cancelled: 'warning',
  timeout: 'warning',
};

export const IMAGE_STATUS = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
  DEPRECATED: 'deprecated',
} as const;

export const IMAGE_STATUS_LABELS: Record<string, string> = {
  active: '启用',
  disabled: '禁用',
  deprecated: '废弃',
};

/**
 * 通用后台任务(internal/opstask)TypeScript 类型。
 * 与后端 module_task_run 表 + GET /api/content/ops/task/* 一一对应。
 */

export type OpsTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export const OPS_TASK_STATUS_LABELS: Record<OpsTaskStatus, string> = {
  pending: '等待中',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

// 对应 MUI Chip 的 color 名。default/info/success/error/warning 是 v5 标准集。
export const OPS_TASK_STATUS_COLORS: Record<OpsTaskStatus, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  pending: 'default',
  running: 'info',
  completed: 'success',
  failed: 'error',
  cancelled: 'warning',
};

/** 列表/详情共用的 task_run。字段名按后端 GORM 列名 → Go JSON 序列化(原样)。 */
export interface OpsTaskRun {
  id: number;
  kind: string;
  status: OpsTaskStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  total: number;
  processed: number;
  failed: number;
  error?: string;
  resultSummary?: string;
  triggeredBy: number;
  payload: string; // 后端是 TEXT,前端原样展示 + JSON 解析(详情对话框)
  cancelRequested: number;
  createTime: string;
  updateTime: string;
}

export interface OpsTaskStartReq {
  kind: string;
  /** 任意 JSON object;后端原样存到 payload 列(审计)。 */
  payload: Record<string, unknown>;
}

export interface OpsTaskStartResp {
  taskId: number;
  status: OpsTaskStatus;
}

export interface OpsTaskListReq {
  kind?: string;
  limit?: number;
}

export type OpsTaskKindList = string[];

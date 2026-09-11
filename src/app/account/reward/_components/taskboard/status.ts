import type { RewardTaskStatus } from '@/beans/reward';

/**
 * 前后端任务状态枚举不对齐：
 *   - 后端 reward_task.go 原样存小写：pending / claimed / submitted / approved / rejected
 *   - 前端 RewardTaskStatus 类型用全大写：OPEN / CLAIMED / SUBMITTED / APPROVED / REJECTED
 * UI 消费 task.status 时必须先走本模块归一化，否则 canClaim/canSubmit/canReview 与
 * STATUS_LABEL 都会失效。
 */
const LOW_TO_HIGH: Record<string, RewardTaskStatus> = {
  pending: 'OPEN',
  claimed: 'CLAIMED',
  submitted: 'SUBMITTED',
  approved: 'APPROVED',
  rejected: 'REJECTED',
};

const HIGH_TO_LOW: Record<RewardTaskStatus, string> = {
  OPEN: 'pending',
  CLAIMED: 'claimed',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const REWARD_TASK_STATUS_LABEL: Record<RewardTaskStatus, string> = {
  OPEN: '待领',
  CLAIMED: '进行中',
  SUBMITTED: '待验收',
  APPROVED: '已完成',
  REJECTED: '已驳回',
};

export const REWARD_TASK_STATUS_COLOR: Record<RewardTaskStatus, string> = {
  OPEN: 'success.main',
  CLAIMED: 'secondary.main',
  SUBMITTED: 'warning.main',
  APPROVED: '#8B5CF6',
  REJECTED: 'primary.main',
};

/** 把后端实际值（小写或全大写）归一化到前端 RewardTaskStatus，未知值回退到 OPEN。 */
export function normalizeRewardTaskStatus(raw?: string | null): RewardTaskStatus {
  if (!raw) return 'OPEN';
  const lower = raw.toLowerCase();
  if (lower in LOW_TO_HIGH) return LOW_TO_HIGH[lower];
  if (raw in HIGH_TO_LOW) return raw as RewardTaskStatus;
  return 'OPEN';
}

/** 前端状态写到后端时用小写（保持后端实际存储格式）。 */
export function denormalizeRewardTaskStatus(status: RewardTaskStatus): string {
  return HIGH_TO_LOW[status] ?? status;
}

/**
 * 后端 TaskView 字段(claimerId/claimerName/claimerAvatar/submission/createUser)
 * 映射到前端 bean 命名(assigneeId/assigneeName/assigneeAvatar/deliverable/createdBy)。
 * /task/page 列表与 claim/submit/review 的返回都要经过这里。
 */
export function mapRewardTaskFromBackend(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const r = { ...raw };
  if (r.assigneeId == null && r.claimerId != null) r.assigneeId = r.claimerId || null;
  if (r.assigneeName == null && r.claimerName) r.assigneeName = r.claimerName;
  if (r.assigneeAvatar == null && r.claimerAvatar) r.assigneeAvatar = r.claimerAvatar;
  if (r.deliverable == null && r.submission) r.deliverable = r.submission;
  if (r.createdBy == null && r.createUser != null) r.createdBy = r.createUser;
  return r;
}

export function mapRewardTaskListFromBackend(list: any[]): any[] {
  if (!Array.isArray(list)) return [];
  return list.map(mapRewardTaskFromBackend);
}

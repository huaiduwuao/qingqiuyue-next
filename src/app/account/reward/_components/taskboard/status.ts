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
 * 后端字段名约定：RewardTaskEntity gorm 用 `claimer_id` / `reviewer_id` / `owner_id`,
 * json tag 与前端 beans/reward.d.ts 的 `assigneeId` / `reviewerId` / `ownerId` 命名不一致。
 * 这里在 API 入口把后端 camelCase 拉到前端 camelCase 上,不污染 beans 类型。
 *
 * 一次走全 → /task/page list / task/{id}/claim|/submit|/review response,
 * 让 TaskDetailDialog/TaskCard/page 的 isAssignee 判定与 assignee filter 真正生效。
 */
export function mapRewardTaskFromBackend(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const r = { ...raw };
  if (r.assigneeId == null && r.claimerId != null) r.assigneeId = r.claimerId;
  // claimerName/Avatar 等后端不输出,UI fallback 用任务列表外的用户池（暂不动）
  return r;
}

export function mapRewardTaskListFromBackend(list: any[]): any[] {
  if (!Array.isArray(list)) return [];
  return list.map(mapRewardTaskFromBackend);
}

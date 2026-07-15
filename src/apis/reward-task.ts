/**
 * Reward task API — 悬赏项目下的协作任务。
 *
 * 端点(对齐 mock-bridge-api/internal/handler/reward_task.go,本轮仅 mock):
 *   GET    /api/core/task/page?projectId=&status=&assigneeId=&priority=
 *   GET    /api/core/task/{id}
 *   POST   /api/core/task
 *   PUT    /api/core/task/{id}
 *   DELETE /api/core/task/{id}
 *   POST   /api/core/task/{id}/claim     OPEN → CLAIMED
 *   POST   /api/core/task/{id}/submit    CLAIMED → SUBMITTED
 *   POST   /api/core/task/{id}/review    SUBMITTED → APPROVED|REJECTED
 *
 * 响应通过 axios 拦截器解包为 { code, msg, data },这里直接返回 data。
 */

import { rewardClient } from '@/lib/api/client';
import type { RewardTask, RewardTaskStatus, TaskPriority } from '@/beans/reward';
import type { PageParams } from '@/beans/pagination';

export interface TaskQuery extends PageParams {
  projectId?: number;
  groupId?: number;
  demandId?: number;
  status?: RewardTaskStatus | '';
  assigneeId?: number;
  priority?: TaskPriority;
}

export interface TaskPageResp {
  records: RewardTask[];
  totalRow: number;
  page: number;
  pageSize: number;
}

export async function listTasks(params: TaskQuery = {}) {
  return rewardClient<{ code: number; msg: string; data: TaskPageResp }>(
    '/task/page',
    { method: 'GET', params },
  ) as unknown;
}

export async function getTask(id: number) {
  return rewardClient<{ code: number; msg: string; data: RewardTask }>(
    `/task/${id}`,
    { method: 'GET' },
  ) as unknown;
}

export async function createTask(data: Partial<RewardTask>) {
  return rewardClient<{ code: number; msg: string; data: RewardTask }>(
    '/task',
    { method: 'POST', data },
  ) as unknown;
}

export async function updateTask(id: number, data: Partial<RewardTask>) {
  return rewardClient<{ code: number; msg: string; data: RewardTask }>(
    `/task/${id}`,
    { method: 'PUT', data },
  ) as unknown;
}

export async function deleteTask(id: number) {
  return rewardClient(`/task/${id}`, { method: 'DELETE' });
}

export async function claimTask(id: number) {
  return rewardClient(`/task/${id}/claim`, { method: 'POST' });
}

export async function submitTask(id: number, deliverable: string) {
  return rewardClient(`/task/${id}/submit`, {
    method: 'POST',
    data: { deliverable },
  });
}

export async function reviewTask(id: number, approved: boolean, note: string) {
  return rewardClient(`/task/${id}/review`, {
    method: 'POST',
    data: { approved, note },
  });
}

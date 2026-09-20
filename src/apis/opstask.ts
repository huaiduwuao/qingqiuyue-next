import { adminClient } from '@/lib/api/client';
import type {
  OpsTaskRun,
  OpsTaskStartReq,
  OpsTaskStartResp,
  OpsTaskKindList,
} from '@/beans/opstask';

// 列出已注册任务类型(给"启动"对话框的 kind 下拉用)
export async function listOpsTaskKinds(): Promise<OpsTaskKindList> {
  return adminClient('/ops/task/kinds');
}

// 历史列表。query: kind(可选), limit(默认 50, 上限 200)
export async function listOpsTasks(params?: { kind?: string; limit?: number }): Promise<OpsTaskRun[]> {
  return adminClient('/ops/task', { params });
}

// 单条详情(进度轮询 2s 一次)
export async function getOpsTask(id: number): Promise<OpsTaskRun> {
  return adminClient(`/ops/task/${id}`);
}

// 启动任务
export async function startOpsTask(req: OpsTaskStartReq): Promise<OpsTaskStartResp> {
  return adminClient('/ops/task/start', { method: 'POST', data: req });
}

// 取消未终态的任务
export async function cancelOpsTask(id: number): Promise<{ msg?: string }> {
  return adminClient(`/ops/task/${id}/cancel`, { method: 'POST' });
}

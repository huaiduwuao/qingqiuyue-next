import { adminClient } from '@/lib/api/client';
import type {
  SandboxImageCreateReq,
  SandboxImageUpdateReq,
  SandboxImageResp,
  SandboxTaskCreateReq,
  SandboxTaskResp,
  SandboxTaskListReq,
  SandboxTaskStatusResp,
} from '@/beans/sandbox';

// ============ 镜像管理 ============

// 镜像列表
export async function listImages(params?: {
  page?: number;
  pageSize?: number;
}): Promise<{ list?: SandboxImageResp[]; records?: SandboxImageResp[]; total?: number; totalRow?: number }> {
  return adminClient('/sandbox/images', { params });
}

// 获取镜像详情
export async function getImage(id: number): Promise<SandboxImageResp> {
  return adminClient(`/sandbox/images/${id}`);
}

// 创建镜像
export async function createImage(params: SandboxImageCreateReq): Promise<SandboxImageResp> {
  return adminClient('/sandbox/images', { method: 'POST', data: params });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 拉取镜像到 Podman 本地。列表里 available=false 时点「拉取」走这里。
//
// 后端立即返回、在后台拉(core-api 的网关读超时只有 60s,大镜像同步等会 504,
// 连带把拉取掐断)。这里轮询镜像列表的 available / pulling / pullError,
// 拉完才 resolve,调用方仍按"await 完就是拉好了"来写。
export async function pullImage(id: number): Promise<{ id: number; pulled: boolean }> {
  await adminClient(`/sandbox/images/${id}/pull`, { method: 'POST' });
  const deadline = Date.now() + 22 * 60 * 1000; // 后端上限 20 分钟
  while (Date.now() < deadline) {
    await sleep(4000);
    const res = await listImages({ page: 1, pageSize: 200 });
    const row = (res.list || res.records || []).find((r) => r.id === id);
    if (!row) throw new Error('镜像记录不见了');
    if (row.available) return { id, pulled: true };
    if (!row.pulling && row.pullError) throw new Error(row.pullError);
    if (!row.pulling) throw new Error('拉取已结束但本地仍没有该镜像,请重试');
  }
  throw new Error('拉取超过 22 分钟仍未完成,请稍后刷新列表查看');
}

// ============ 任务管理 ============

// 任务列表
export async function listTasks(params?: SandboxTaskListReq): Promise<{
  list?: SandboxTaskResp[]; records?: SandboxTaskResp[]; total?: number; totalRow?: number
}> {
  return adminClient('/sandbox/tasks', { params });
}

// 获取任务详情
export async function getTask(taskId: string): Promise<SandboxTaskResp> {
  return adminClient(`/sandbox/tasks/${taskId}`);
}

// 获取任务状态
export async function getTaskStatus(taskId: string): Promise<SandboxTaskStatusResp> {
  return adminClient(`/sandbox/tasks/${taskId}/status`);
}

// 获取任务日志
export async function getTaskLogs(
  taskId: string,
  tail?: number
): Promise<{ logs?: string }> {
  return adminClient(`/sandbox/tasks/${taskId}/logs`, { params: { tail: tail ?? 200 } });
}

// 创建任务
export async function createTask(params: SandboxTaskCreateReq): Promise<SandboxTaskResp> {
  return adminClient('/sandbox/tasks', { method: 'POST', data: params });
}

// 取消任务
export async function cancelTask(taskId: string): Promise<{ msg?: string }> {
  return adminClient(`/sandbox/tasks/${taskId}/cancel`, { method: 'POST' });
}


// ============ 产物 → 内容 ============

/** 预览沙盒脚本产物(读 /workspace/result.json)。返回 total / with_body / preview。 */
export async function getTaskResult(taskId: string): Promise<{
  total: number; with_body: number; preview: any[];
}> {
  return adminClient(`/sandbox/tasks/${taskId}/result`, { method: 'GET' });
}

export interface ImportStats {
  inserted: number;
  /** 同 URL / 同正文已在库里,没有再插 */
  duplicate: number;
  skipped: number;
  failed: number;
}

/**
 * 把沙盒产物入库到指定内容。contentId 传字符串——雪花 id 超 2^53。
 *
 * 后端校验后在后台逐章写库、立即返回;这里轮询 GET /tasks/{id}/import 直到
 * done / failed。以前一个请求等到底,上千章超过网关 60s 就 504,导入停在半路。
 */
export async function importTaskResult(taskId: string, contentId: string): Promise<{
  content_id: string; stats: ImportStats;
}> {
  await adminClient(`/sandbox/tasks/${taskId}/import`, {
    method: 'POST',
    data: { content_id: contentId },
  });
  const deadline = Date.now() + 32 * 60 * 1000; // 后端上限 30 分钟
  while (Date.now() < deadline) {
    await sleep(3000);
    const job = await adminClient<{ status: string; error?: string; stats?: ImportStats }>(
      `/sandbox/tasks/${taskId}/import`,
      { method: 'GET' },
    );
    if (job?.status === 'done') {
      return { content_id: contentId, stats: job.stats ?? { inserted: 0, duplicate: 0, skipped: 0, failed: 0 } };
    }
    if (job?.status === 'failed') throw new Error(job.error || '入库失败');
    if (job?.status === 'none') throw new Error('导入状态丢失(服务可能重启过),请检查章节后重试');
  }
  throw new Error('入库超过 32 分钟仍未结束,请稍后检查章节');
}

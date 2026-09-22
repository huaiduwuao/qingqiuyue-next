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

// 拉取镜像到 Podman 本地。列表里 available=false 时点「拉取」走这里。
// 大镜像可能几分钟,前端要给足超时。
export async function pullImage(id: number): Promise<{ id: number; pulled: boolean }> {
  return adminClient(`/sandbox/images/${id}/pull`, { method: 'POST', timeout: 20 * 60 * 1000 });
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

/** 把沙盒产物入库到指定内容。contentId 传字符串——雪花 id 超 2^53。 */
export async function importTaskResult(taskId: string, contentId: string): Promise<{
  content_id: string; stats: { inserted: number; updated: number; skipped: number; failed: number };
}> {
  return adminClient(`/sandbox/tasks/${taskId}/import`, {
    method: 'POST',
    data: { content_id: contentId },
    timeout: 10 * 60 * 1000, // 上千章,给足
  });
}

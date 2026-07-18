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
}): Promise<{ data?: { list?: SandboxImageResp[]; records?: SandboxImageResp[]; total?: number; totalRow?: number } }> {
  return adminClient('/sandbox/images', { params });
}

// 获取镜像详情
export async function getImage(id: number): Promise<{ data?: SandboxImageResp }> {
  return adminClient(`/sandbox/images/${id}`);
}

// 创建镜像
export async function createImage(params: SandboxImageCreateReq): Promise<{ data?: SandboxImageResp }> {
  return adminClient('/sandbox/images', { method: 'POST', data: params });
}

// ============ 任务管理 ============

// 任务列表
export async function listTasks(params?: SandboxTaskListReq): Promise<{
  data?: { list?: SandboxTaskResp[]; records?: SandboxTaskResp[]; total?: number; totalRow?: number }
}> {
  return adminClient('/sandbox/tasks', { params });
}

// 获取任务详情
export async function getTask(taskId: string): Promise<{ data?: SandboxTaskResp }> {
  return adminClient(`/sandbox/tasks/${taskId}`);
}

// 获取任务状态
export async function getTaskStatus(taskId: string): Promise<{ data?: SandboxTaskStatusResp }> {
  return adminClient(`/sandbox/tasks/${taskId}/status`);
}

// 获取任务日志
export async function getTaskLogs(
  taskId: string,
  tail?: number
): Promise<{ data?: { logs?: string } }> {
  return adminClient(`/sandbox/tasks/${taskId}/logs`, { params: { tail: tail ?? 200 } });
}

// 创建任务
export async function createTask(params: SandboxTaskCreateReq): Promise<{ data?: SandboxTaskResp }> {
  return adminClient('/sandbox/tasks', { method: 'POST', data: params });
}

// 取消任务
export async function cancelTask(taskId: string): Promise<{ msg?: string }> {
  return adminClient(`/sandbox/tasks/${taskId}/cancel`, { method: 'POST' });
}

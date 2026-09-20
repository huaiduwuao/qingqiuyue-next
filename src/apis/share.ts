/**
 * C 端用户 API:分享/发布任务
 * 后端路由:`/api/core/share/*` (cmd/core-api/main.go RegisterUserRoutes)
 */

import { adminClient } from '@/lib/api/client';

export interface ShareTask {
  id: number;
  platform: string;        // douyin/kuaishou/xiaohongshu
  contentType: string;     // topic/work/...
  contentId: number;
  status: 'pending' | 'uploading' | 'publishing' | 'success' | 'failed';
  remoteId: string;
  remoteUrl: string;
  errorMsg: string;
  retryCount: number;
  scheduledAt?: number;    // Unix 秒
  startedAt?: number;
  finishedAt?: number;
  createTime: string;
}

export interface PlatformAccountBrief {
  id: number;
  platform: string;
  accountName: string;
  clientKey: string;
  hasAccessToken: boolean;
  authStatus: number;
  platformUserNickname: string;
}

/** 后端 GET /share/tasks */
export async function listTasks(params: {
  page?: number;
  pageSize?: number;
  platform?: string;
  status?: string;
}) {
  return adminClient<{ list?: ShareTask[]; total?: number }>('/share/tasks', { params });
}

/**
 * 后端 POST /share/create
 *
 * 调用方传平铺字段,这里组装成后端要的形状:标题/素材都在 payload 里
 * (Go 侧 userCreateReq.Payload = socialshare.PublishPayload)。平铺着发过去的话
 * payload 会是空对象,任务建出来没标题没素材,到发布那一步才失败。
 */
export async function createTask(params: {
  socialAccountId: number;
  contentType: string;
  contentId: number;
  title: string;
  videoUrl?: string;
  coverUrl?: string;
  tags?: string[];
  shareCardImageUrl?: string;
  topicId?: string;
  scheduledAt?: number; // Unix 秒,定时发布
}) {
  const { socialAccountId, contentType, contentId, scheduledAt, ...payload } = params;
  return adminClient<ShareTask>('/share/create', {
    method: 'POST',
    data: { socialAccountId, contentType, contentId, scheduledAt, payload },
  });
}

/** 后端 POST /share/retry/:id */
export async function retryTask(id: number) {
  return adminClient(`/share/retry/${id}`, { method: 'POST' });
}

/** 后端 GET /share/accounts/:platform */
export async function listAccounts(platform: string) {
  return adminClient<PlatformAccountBrief[]>(`/share/accounts/${platform}`);
}

/** 任务状态文案 + 颜色 */
export const TASK_STATUS_META: Record<string, { label: string; color: 'default' | 'primary' | 'warning' | 'success' | 'error' }> = {
  pending:    { label: '待发布', color: 'default' },
  uploading:  { label: '上传中', color: 'primary' },
  publishing: { label: '发布中', color: 'primary' },
  success:    { label: '已成功', color: 'success' },
  failed:     { label: '已失败', color: 'error' },
};
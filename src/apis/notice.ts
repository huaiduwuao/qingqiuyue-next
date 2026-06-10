import { adminClient } from '@/lib/api/client';

// 通知信息
export interface NoticeInfo {
  id: number;
  title: string;
  content?: string;
  type?: string;
  status?: number;
  createTime?: string;
}

// 通知查询参数
export interface NoticeQuery {
  page?: number;
  pageSize?: number;
}

// 通知列表响应
export interface NoticeListResp {
  list: NoticeInfo[];
  total: number;
}

// 获取通知列表
export async function listNotices(params?: NoticeQuery) {
  return adminClient<NoticeListResp>('/notice/list', {
    method: 'GET',
    params,
  });
}

// 获取通知详情
export async function getNotice(id: number) {
  return adminClient<NoticeInfo>(`/notice/${id}`, {
    method: 'GET',
  });
}

// 创建通知
export async function createNotice(data: any) {
  return adminClient<NoticeInfo>('/notice', {
    method: 'POST',
    data,
  });
}

// 更新通知
export async function updateNotice(id: number, data: any) {
  return adminClient<NoticeInfo>(`/notice/${id}`, {
    method: 'PUT',
    data,
  });
}

// 删除通知
export async function deleteNotice(id: number) {
  return adminClient(`/notice/${id}`, {
    method: 'DELETE',
  });
}

import { adminClient } from '@/lib/api/client';

// App版本信息
export interface AppVersionInfo {
  id: number;
  appId: number;
  version: string;
  versionCode: number;
  url?: string;
  forceUpdate?: boolean;
  updateLog?: string;
  status?: number;
  createTime?: string;
}

// App版本查询参数
export interface AppVersionQuery {
  page?: number;
  pageSize?: number;
}

// App版本列表响应
export interface AppVersionListResp {
  list: AppVersionInfo[];
  total: number;
}

// 获取APP版本列表
export async function listAppVersions(params?: AppVersionQuery) {
  return adminClient<AppVersionListResp>('/app/version/list', {
    method: 'GET',
    params,
  });
}

// 获取最新版本
export async function getLatestAppVersion(appId: number) {
  return adminClient<AppVersionInfo>(`/api/app/version/latest/${appId}`, {
    method: 'GET',
  });
}

// 创建APP版本
export async function createAppVersion(data: any) {
  return adminClient<AppVersionInfo>('/app/version', {
    method: 'POST',
    data,
  });
}

// 更新APP版本
export async function updateAppVersion(id: number, data: any) {
  return adminClient<AppVersionInfo>(`/api/app/version/${id}`, {
    method: 'PUT',
    data,
  });
}

// 删除APP版本
export async function deleteAppVersion(id: number) {
  return adminClient(`/api/app/version/${id}`, {
    method: 'DELETE',
  });
}

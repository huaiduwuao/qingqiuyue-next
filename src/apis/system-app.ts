import { adminClient } from '@/lib/api/client';
import { AppItem } from "@/beans/system";

export interface AppListParams {
  page?: number;
  pageSize?: number;
  pageNumber?: number;
  name?: string;
  status?: number;
}

// 应用分页 -> 后端 GET /app/list (分页响应别名由 client 拦截器统一处理)
export async function page(params: AppListParams) {
  return adminClient('/app/list', { params });
}

// 删除应用 -> 后端 DELETE /app/:id (批量循环)
export async function remove(ids: number[]) {
  const list = Array.isArray(ids) ? ids : [ids];
  return Promise.all(list.map((id) => adminClient(`/app/${id}`, { method: 'DELETE' })));
}

// 保存应用 -> 后端 POST /app
export async function save(params: AppItem) {
  return adminClient('/app', { method: 'POST', data: params });
}

// 更新应用 -> 后端 PUT /app/:id
export async function update(params: AppItem) {
  return adminClient(`/app/${params.id}`, { method: 'PUT', data: params });
}

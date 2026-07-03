import { adminClient } from '@/lib/api/client';
import { AppItem } from "@/beans/system";

export interface AppConfigListParams {
  page?: number;
  pageSize?: number;
  pageNumber?: number;
  name?: string;
  code?: string;
}

// -> 后端 GET /app/config/listByMap
export async function listByMap(params: { type: string }) {
  return adminClient('/app/config/listByMap', { params });
}

// 根据 code 查单个配置 -> 后端 GET /app/config/getByCode
export async function getByCode(params: { code: string }) {
  return adminClient('/app/config/getByCode', { params });
}

// 应用配置分页 -> 后端 GET /app/config/list
export async function page(params: AppConfigListParams) {
  return adminClient('/app/config/list', { params });
}

// 删除 -> 后端 DELETE /app/config/:id (批量循环)
export async function remove(ids: number[]) {
  const list = Array.isArray(ids) ? ids : [ids];
  return Promise.all(list.map((id) => adminClient(`/app/config/${id}`, { method: 'DELETE' })));
}

// 保存 -> 后端 POST /app/config
export async function save(params: AppItem) {
  return adminClient('/app/config', { method: 'POST', data: params });
}

// 更新 -> 后端 PUT /app/config/:id
export async function update(params: AppItem) {
  return adminClient(`/app/config/${params.id}`, { method: 'PUT', data: params });
}

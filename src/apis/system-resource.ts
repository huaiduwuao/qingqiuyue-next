import { adminClient } from '@/lib/api/client';
import { ResourceItem } from "@/beans/system";
import { PageParams } from '@/beans/pagination';

export interface ResourceListParams extends PageParams {
  name?: string;
}

// 资源分页 -> 后端 GET /resource/list (client.ts 已自动归一化分页响应)
export async function page(params: ResourceListParams) {
  return adminClient('/resource/list', { params });
}

// 同步资源 -> 后端 GET /resource/sync
export async function sync() {
  return adminClient('/resource/sync');
}

// 删除资源 -> 后端 DELETE /resource/:id (批量循环)
export async function remove(ids: number[]) {
  const list = Array.isArray(ids) ? ids : [ids];
  return Promise.all(list.map((id) => adminClient(`/resource/${id}`, { method: 'DELETE' })));
}

// 保存资源 -> 后端 POST /resource
export async function save(params: ResourceItem) {
  return adminClient('/resource', { method: 'POST', data: params });
}

// 更新资源 -> 后端 PUT /resource/:id
export async function update(params: ResourceItem) {
  return adminClient(`/resource/${params.id}`, { method: 'PUT', data: params });
}

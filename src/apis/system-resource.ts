import { adminClient } from '@/lib/api/client';
import { PageParams } from '@/beans/pagination';

export interface ResourceListParams extends PageParams {
  name?: string;
  serviceId?: number;
  pid?: number;
}

/** 接口资源(core-api resource 表) */
export interface ResourceRecord {
  id?: number;
  name?: string;
  url?: string;
  method?: string;
  serviceId?: number;
  pid?: number;
  updateTime?: string;
}

// 资源分页 -> 后端 GET /resource/list (client.ts 已自动归一化分页响应)
export async function page(params: ResourceListParams) {
  return adminClient('/resource/list', { params });
}

// 删除资源 -> 后端 DELETE /resource/:id (批量循环)
export async function remove(ids: number[]) {
  const list = Array.isArray(ids) ? ids : [ids];
  return Promise.all(list.map((id) => adminClient(`/resource/${id}`, { method: 'DELETE' })));
}

// 保存资源 -> 后端 POST /resource
export async function save(params: ResourceRecord) {
  return adminClient('/resource', { method: 'POST', data: params });
}

// 更新资源 -> 后端 PUT /resource/:id
export async function update(params: ResourceRecord) {
  return adminClient(`/resource/${params.id}`, { method: 'PUT', data: params });
}

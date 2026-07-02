import { adminClient } from '@/lib/api/client';
import {ResourceItem, TableListParams} from "@/beans/system";

export interface ResourceListParams {
  page?: number;
  pageSize?: number;
  pageNumber?: number;
  name?: string;
}

// 后端分页响应 { list, total } 归一成 UI 期望的 { records, totalRow }
function normalizePage(res: any) {
  const d = res?.data ?? {};
  return { ...res, data: { records: d.records ?? d.list ?? [], totalRow: d.totalRow ?? d.total ?? 0 } };
}

// 资源分页 -> 后端 GET /resource/list
export async function page(params: ResourceListParams) {
  const res = await adminClient('/resource/list', { params });
  return normalizePage(res);
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

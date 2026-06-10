import { adminClient } from '@/lib/api/client';
import {AppServiceItem, TableListParams} from "@/beans/system";

// 应用服务分页 -> 后端 GET /app/service/list
export async function page(params: any) {
  return adminClient('/app/service/list', { params });
}

// ⚠️ 后端 app-service 未提供 listApp，保留走 mock。
export async function appList(params: any) {
  return adminClient('/app/service/listApp', { params });
}

// 删除 -> 后端 DELETE /app/service/:id (批量循环)
export async function remove(ids: number[]) {
  const list = Array.isArray(ids) ? ids : [ids];
  return Promise.all(list.map((id) => adminClient(`/app/service/${id}`, { method: 'DELETE' })));
}

// 保存 -> 后端 POST /app/service
export async function save(params: AppServiceItem) {
  return adminClient('/app/service', { method: 'POST', data: params });
}

// 更新 -> 后端 PUT /app/service/:id
export async function update(params: AppServiceItem) {
  return adminClient(`/app/service/${(params as any).id}`, { method: 'PUT', data: params });
}

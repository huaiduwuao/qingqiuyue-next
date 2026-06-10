import { adminClient } from '@/lib/api/client';
import {DictDataItem} from "@/beans/system";

// -> 后端 GET /dict/data/list
export async function list(params: any) {
  return adminClient('/dict/data/list', { params });
}

// 字典数据分页 -> 后端 GET /dict/data/list (分页别名由 client 拦截器统一处理)
export async function page(params: any) {
  return adminClient('/dict/data/list', { params });
}

// 删除 -> 后端 DELETE /dict/data/:id (批量循环)
export async function remove(ids: number[]) {
  const arr = Array.isArray(ids) ? ids : [ids];
  return Promise.all(arr.map((id) => adminClient(`/dict/data/${id}`, { method: 'DELETE' })));
}

// 保存 -> 后端 POST /dict/data
export async function save(params: DictDataItem) {
  return adminClient('/dict/data', { method: 'POST', data: params });
}

// 更新 -> 后端 PUT /dict/data/:id
export async function update(params: DictDataItem) {
  return adminClient(`/dict/data/${(params as any).id}`, { method: 'PUT', data: params });
}

// 字典类型列表 -> 后端 GET /dict/type/list
export async function typeList(params: any) {
  return adminClient('/dict/type/list', { params });
}

import { adminClient } from '@/lib/api/client';

// 字典类型信息
export interface DictTypeInfo {
  id: number;
  name: string;
  type: string;
  status?: number;
}

// 字典数据信息
export interface DictDataInfo {
  id: number;
  type: string;
  label: string;
  value: string;
  sort?: number;
  status?: number;
}

// 字典查询参数
export interface DictTypeQuery {
  page?: number;
  pageNumber?: number;
  pageSize?: number;
  name?: string;
  type?: string;
  status?: number;
}

export interface DictDataQuery {
  page?: number;
  pageSize?: number;
}

// 获取字典类型列表
export async function listDictTypes(params?: DictTypeQuery) {
  return adminClient<{ list: DictTypeInfo[]; records?: DictTypeInfo[]; total: number; totalRow?: number; success?: boolean }>('/dict/type/list', {
    method: 'GET',
    params,
  });
}

// 获取字典类型详情
export async function getDictType(id: number) {
  return adminClient<DictTypeInfo>(`/dict/type/${id}`, {
    method: 'GET',
  });
}

// 创建字典类型
export async function createDictType(data: unknown) {
  return adminClient<DictTypeInfo>('/dict/type', {
    method: 'POST',
    data,
  });
}

// 更新字典类型
export async function updateDictType(id: number, data: unknown) {
  return adminClient<DictTypeInfo>(`/dict/type/${id}`, {
    method: 'PUT',
    data,
  });
}

// 删除字典类型
export async function deleteDictType(id: number) {
  return adminClient(`/dict/type/${id}`, {
    method: 'DELETE',
  });
}

// 获取字典数据列表
export async function listDictData(params?: DictDataQuery) {
  return adminClient<{ list: DictDataInfo[]; total: number }>('/dict/data/list', {
    method: 'GET',
    params,
  });
}

// 获取字典数据详情
export async function getDictData(id: number) {
  return adminClient<DictDataInfo>(`/dict/data/${id}`, {
    method: 'GET',
  });
}

// 按类型获取字典数据
export async function getDictDataByType(type: string) {
  return adminClient<DictDataInfo[]>(`/dict/data/all/${type}`, {
    method: 'GET',
  });
}

// 创建字典数据
export async function createDictData(data: unknown) {
  return adminClient<DictDataInfo>('/dict/data', {
    method: 'POST',
    data,
  });
}

// 更新字典数据
export async function updateDictData(id: number, data: unknown) {
  return adminClient<DictDataInfo>(`/dict/data/${id}`, {
    method: 'PUT',
    data,
  });
}

// 删除字典数据
export async function deleteDictData(id: number) {
  return adminClient(`/dict/data/${id}`, {
    method: 'DELETE',
  });
}

// Aliases for missing exports
export const page = listDictTypes;
export const remove = (ids: number | number[]) => {
  const id = Array.isArray(ids) ? ids[0] : ids;
  return deleteDictType(id);
};
export const save = createDictType;

// Wrapper for update that accepts an object with id
export const update = (data: { id?: number; _id?: number } & Record<string, unknown>) => {
  if (data.id) {
    return updateDictType(data.id, data as any);
  }
  return updateDictType(data._id!, data as any);
};

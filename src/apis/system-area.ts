import { adminClient } from '@/lib/api/client';

// 区域信息
export interface AreaInfo {
  code: string;
  name: string;
  level?: number;
  children?: AreaInfo[];
}

// 获取省份列表
export async function getProvinces() {
  return adminClient<AreaInfo[]>('/area/provinces', {
    method: 'GET',
  });
}

// 获取城市列表
export async function getCities(provinceCode: string) {
  return adminClient<AreaInfo[]>(`/area/cities/${provinceCode}`, {
    method: 'GET',
  });
}

// 获取区县列表
export async function getAreas(cityCode: string) {
  return adminClient<AreaInfo[]>(`/area/areas/${cityCode}`, {
    method: 'GET',
  });
}

// 获取街道列表
export async function getStreets(areaCode: string) {
  return adminClient<AreaInfo[]>(`/area/streets/${areaCode}`, {
    method: 'GET',
  });
}

// Aliases for missing exports (CRUD pattern)
// Paginated list for DataGridTable
export const page = async (params?: { pageNumber?: number; pageSize?: number; sortField?: string; sortOrder?: string }) => {
  return adminClient<{ records: AreaInfo[]; totalRow: number; success?: boolean }>('/area/page', {
    method: 'GET',
    params,
  });
};
export const remove = async (ids: Array<string | number>) => {
  return adminClient('/area/remove', { method: 'DELETE', data: ids });
};
export const save = async (params: Record<string, unknown>) => {
  return adminClient('/area/save', { method: 'POST', data: params });
};
export const update = async (params: Record<string, unknown>) => {
  return adminClient('/area/update', { method: 'PUT', data: params });
};

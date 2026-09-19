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
// Paginated list for DataGridTable;level=area 让后端 /area/page 查 sys_area 表
export const page = async (params?: { pageNumber?: number; pageSize?: number; sortField?: string; sortOrder?: string; name?: string; parentCode?: string }) => {
  return adminClient<{ list: AreaInfo[]; page: number; total: number; success?: boolean }>('/area/page', {
    method: 'GET',
    params: { ...params, level: 'area' },
  });
};
export const remove = async (ids: Array<string | number>) => {
  return adminClient('/area/remove', { method: 'DELETE', params: { level: 'area' }, data: ids });
};
export const save = async (params: Record<string, unknown>) => {
  return adminClient('/area/save', { method: 'POST', data: { ...params, level: 'area' } });
};
export const update = async (params: Record<string, unknown>) => {
  return adminClient('/area/update', { method: 'PUT', data: { ...params, level: 'area' } });
};

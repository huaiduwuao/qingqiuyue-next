import { adminClient } from '@/lib/api/client';
import { CityItem } from "@/beans/system";

const LEVEL = 'city';

export interface CityListParams {
  page?: number;
  pageSize?: number;
  pageNumber?: number;
  name?: string;
  /** 按父级省份编码筛选 */
  parentCode?: string;
}

export async function page(params: CityListParams) {
  return adminClient('/area/page', {
    params: { ...params, level: LEVEL }
  });
}

export async function remove(ids: number[]) {
  return adminClient('/area/remove', { method: 'DELETE', params: { level: LEVEL }, data: ids });
}

export async function save(params: CityItem) {
  return adminClient('/area/save', { method: 'POST', data: { ...params, level: LEVEL } });
}

export async function update(params: CityItem) {
  return adminClient('/area/update', { method: 'PUT', data: { ...params, level: LEVEL } });
}

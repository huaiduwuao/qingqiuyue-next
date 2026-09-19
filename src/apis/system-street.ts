import { adminClient } from '@/lib/api/client';
import { StreetItem } from "@/beans/system";

const LEVEL = 'street';

export interface StreetListParams {
  page?: number;
  pageSize?: number;
  pageNumber?: number;
  name?: string;
  /** 按父级区县编码筛选 */
  parentCode?: string;
}

export async function page(params: StreetListParams) {
  return adminClient('/area/page', {
    params: { ...params, level: LEVEL }
  });
}

export async function remove(ids: number[]) {
  return adminClient('/area/remove', { method: 'DELETE', params: { level: LEVEL }, data: ids });
}

export async function save(params: StreetItem) {
  return adminClient('/area/save', { method: 'POST', data: { ...params, level: LEVEL } });
}

export async function update(params: StreetItem) {
  return adminClient('/area/update', { method: 'PUT', data: { ...params, level: LEVEL } });
}

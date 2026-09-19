import { adminClient } from '@/lib/api/client';
import { ProvinceItem } from "@/beans/system";

const LEVEL = 'province';

export interface ProvinceListParams {
  page?: number;
  pageSize?: number;
  pageNumber?: number;
  name?: string;
}

export async function page(params: ProvinceListParams) {
  return adminClient('/area/page', {
    params: { ...params, level: LEVEL }
  });
}

export async function remove(ids: number[]) {
  return adminClient('/area/remove', { method: 'DELETE', params: { level: LEVEL }, data: ids });
}

export async function save(params: ProvinceItem) {
  return adminClient('/area/save', { method: 'POST', data: { ...params, level: LEVEL } });
}

export async function update(params: ProvinceItem) {
  return adminClient('/area/update', { method: 'PUT', data: { ...params, level: LEVEL } });
}

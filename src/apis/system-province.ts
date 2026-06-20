import { adminClient } from '@/lib/api/client';
import {ProvinceItem, TableListParams} from "@/beans/system";

export interface ProvinceListParams {
  page?: number;
  pageSize?: number;
  pageNumber?: number;
  name?: string;
}

export async function page(params: ProvinceListParams) {
  return adminClient('/area/page', {
    params
  });
}

export async function remove(ids: number[]) {
  return adminClient('/area/remove', { method: 'DELETE', data: ids });
}

export async function save(params: ProvinceItem) {
  return adminClient('/area/save', { method: 'POST', data: params });
}

export async function update(params: ProvinceItem) {
  return adminClient('/area/update', { method: 'PUT', data: params });
}

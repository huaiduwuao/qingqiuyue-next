import { adminClient } from '@/lib/api/client';
import {CityItem} from "@/beans/system";

export interface CityListParams {
  page?: number;
  pageSize?: number;
  pageNumber?: number;
  name?: string;
}

export async function page(params: CityListParams) {
  return adminClient('/area/page', {
    params
  });
}

export async function remove(ids: number[]) {
  return adminClient('/area/remove', { method: 'DELETE', data: ids });
}

export async function save(params: CityItem) {
  return adminClient('/area/save', { method: 'POST', data: params });
}

export async function update(params: CityItem) {
  return adminClient('/area/update', { method: 'PUT', data: params });
}

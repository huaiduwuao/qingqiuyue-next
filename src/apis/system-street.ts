import { adminClient } from '@/lib/api/client';
import {StreetItem} from "@/beans/system";

export interface StreetListParams {
  page?: number;
  pageSize?: number;
  pageNumber?: number;
  name?: string;
}

export async function page(params: StreetListParams) {
  return adminClient('/area/page', {
    params
  });
}

export async function remove(ids: number[]) {
  return adminClient('/area/remove', { method: 'DELETE', data: ids });
}

export async function save(params: StreetItem) {
  return adminClient('/area/save', { method: 'POST', data: params });
}

export async function update(params: StreetItem) {
  return adminClient('/area/update', { method: 'PUT', data: params });
}

import { adminClient } from '@/lib/api/client';
import {TableListParams} from "@/beans/system";

export interface UserLevelListParams {
  page?: number;
  pageSize?: number;
  pageNumber?: number;
  name?: string;
}

export async function page(params: UserLevelListParams) {
  return adminClient("/userLevel/client/page", {
    params
  });
}

export async function remove(ids: number[]) {
  return adminClient("/userLevel/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: Record<string, unknown>) {
  return adminClient("/userLevel/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: Record<string, unknown>) {
  return adminClient("/userLevel/updateById", {
    method: "POST",
    data: params
  });
}

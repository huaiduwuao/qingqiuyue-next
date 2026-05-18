import { adminClient } from '@/lib/api/client';
import {AppItem, TableListParams} from "@/beans/system";


export async function page(params: any) {
  return adminClient("/app/page", {
    params
  });
}

export async function remove(ids: number[]) {
  return adminClient("/app/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: AppItem) {
  return adminClient("/app/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: AppItem) {
  return adminClient("/app/updateById", {
    method: "POST",
    data: params
  });
}

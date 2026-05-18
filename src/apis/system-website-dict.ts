import { adminClient } from '@/lib/api/client';
import {AppItem, TableListParams} from "@/beans/system";


export async function page(params: any) {
  return adminClient("/sysWebsiteDict/client/page", {
    params
  });
}

export async function remove(ids: number[]) {
  return adminClient("/sysWebsiteDict/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: AppItem) {
  return adminClient("/sysWebsiteDict/saveBatch", {
    method: "POST",
    data: params
  });
}

export async function update(params: AppItem) {
  return adminClient("/sysWebsiteDict/updateById", {
    method: "POST",
    data: params
  });
}

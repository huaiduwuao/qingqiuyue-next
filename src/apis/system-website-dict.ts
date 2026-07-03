import { adminClient } from '@/lib/api/client';
import { AppItem } from "@/beans/system";

export interface WebsiteDictListParams {
  page?: number;
  pageSize?: number;
  pageNumber?: number;
  name?: string;
  type?: string;
}


export async function page(params: WebsiteDictListParams) {
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

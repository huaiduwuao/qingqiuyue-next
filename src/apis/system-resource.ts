import { adminClient } from '@/lib/api/client';
import {ResourceItem, TableListParams} from "@/beans/system";


export async function page(params: any) {
  return adminClient("/resource/list", {
    params
  });
}

export async function sync() {
  return adminClient("/resource/sync");
}

export async function remove(ids: number[]) {
  return adminClient("/resource/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: ResourceItem) {
  return adminClient("/resource/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: ResourceItem) {
  return adminClient("/resource/updateById", {
    method: "POST",
    data: params
  });
}

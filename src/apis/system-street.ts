import { adminClient } from '@/lib/api/client';
import {StreetItem} from "@/beans/system";


export async function page(params: any) {
  return adminClient("/sysStreet/page", {
    params
  });
}

export async function remove(ids: number[]) {
  return adminClient("/sysStreet/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: StreetItem) {
  return adminClient("/sysStreet/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: StreetItem) {
  return adminClient("/sysStreet/updateById", {
    method: "POST",
    data: params
  });
}

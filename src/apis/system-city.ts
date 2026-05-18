import { adminClient } from '@/lib/api/client';
import {CityItem} from "@/beans/system";


export async function page(params: any) {
  return adminClient("/sysCity/page", {
    params
  });
}

export async function remove(ids: number[]) {
  return adminClient("/sysCity/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: CityItem) {
  return adminClient("/sysCity/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: CityItem) {
  return adminClient("/sysCity/updateById", {
    method: "POST",
    data: params
  });
}

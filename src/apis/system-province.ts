import { adminClient } from '@/lib/api/client';
import {ProvinceItem, TableListParams} from "@/beans/system";


export async function page(params: any) {
  return adminClient("/sysProvince/page", {
    params
  });
}

export async function remove(ids: number[]) {
  return adminClient("/sysProvince/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: ProvinceItem) {
  return adminClient("/sysProvince/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: ProvinceItem) {
  return adminClient("/sysProvince/updateById", {
    method: "POST",
    data: params
  });
}

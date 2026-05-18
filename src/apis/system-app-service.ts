import { adminClient } from '@/lib/api/client';
import {AppServiceItem, TableListParams} from "@/beans/system";


export async function page(params: any) {
  return adminClient("/appService/page", {
    params
  });
}

export async function appList(params: any) {
  return adminClient("/appService/listApp", {
    params
  });
}

export async function remove(ids: number[]) {
  return adminClient("/appService/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: AppServiceItem) {
  return adminClient("/appService/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: AppServiceItem) {
  return adminClient("/appService/updateById", {
    method: "POST",
    data: params
  });
}

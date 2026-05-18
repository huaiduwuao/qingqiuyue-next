import { adminClient } from '@/lib/api/client';
import {AppConfigItem, AppItem, TableListParams} from "@/beans/system";

export async function listByMap(params: AppConfigItem) {
  return adminClient("/appConfig/listByMap", {
    params
  });
}

export async function page(params: any) {
  return adminClient("/appConfig/page", {
    params
  });
}

export async function remove(ids: number[]) {
  return adminClient("/appConfig/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: AppItem) {
  return adminClient("/appConfig/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: AppItem) {
  return adminClient("/appConfig/updateById", {
    method: "POST",
    data: params
  });
}

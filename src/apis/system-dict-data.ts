import { adminClient } from '@/lib/api/client';
import {DictDataItem} from "@/beans/system";

export async function list(params: any) {
  return adminClient("/sysDictData/list", {
    params
  });
}

export async function page(params: any) {
  return adminClient("/sysDictData/page", {
    params
  });
}

export async function remove(ids: number[]) {
  return adminClient("/sysDictData/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: DictDataItem) {
  return adminClient("/sysDictData/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: DictDataItem) {
  return adminClient("/sysDictData/updateById", {
    method: "POST",
    data: params
  });
}

export async function typeList(params: any) {
  return adminClient("/sysDictData/listType", {
    params
  });
}

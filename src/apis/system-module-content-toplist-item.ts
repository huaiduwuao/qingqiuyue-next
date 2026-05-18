import { contentClient } from '@/lib/api/client';
import {ModuleTemplateItem} from "@/beans/system";


export async function page(params: any) {
  return contentClient("/module/moduleContentToplistItem/client/page", {
    params
  });
}

export async function remove(ids: number[]) {
  return contentClient("/module/moduleContentToplistItem/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: any) {
  return contentClient("/module/moduleContentToplistItem/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: any) {
  return contentClient("/module/moduleContentToplistItem/updateById", {
    method: "POST",
    data: params
  });
}

export async function list(params: any) {
  return contentClient("/module/moduleContentToplistItem/listByMap", {
    params
  });
}

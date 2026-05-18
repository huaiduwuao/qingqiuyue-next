import { contentClient } from '@/lib/api/client';
import {ModuleTemplateItem} from "@/beans/system";


export async function page(params: any) {
  return contentClient("/module/moduleContentToplist/client/page", {
    params
  });
}

export async function myPage(params: any) {
  return contentClient("/module/moduleContentToplist/client/myPage", {
    params
  });
}

export async function remove(ids: number[]) {
  return contentClient("/module/moduleContentToplist/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: ModuleTemplateItem) {
  return contentClient("/module/moduleContentToplist/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: ModuleTemplateItem) {
  return contentClient("/module/moduleContentToplist/updateById", {
    method: "POST",
    data: params
  });
}

export async function sync(params: ModuleTemplateItem) {
  return contentClient("/module/moduleContentToplist/sync", {
    params
  });
}

export async function topList(params: any) {
  return contentClient("/module/moduleContentToplist/client/list", {
    params
  });
}

export async function addItem(params: any) {
  return contentClient("/module/moduleContentToplist/client/addItem", {
    params
  });
}

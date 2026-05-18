import { contentClient } from '@/lib/api/client';
import {ModuleTemplateItem} from "@/beans/system";


export async function page(params: any) {
  return contentClient("/module/moduleTemplate/client/page", {
    params
  });
}

export async function list(params: any) {
  return contentClient("/module/moduleTemplate/client/list", {
    params
  });
}

export async function myPage(params: any) {
  return contentClient("/module/moduleTemplate/client/myPage", {
    params
  });
}

export async function remove(ids: number[]) {
  return contentClient("/module/moduleTemplate/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function itemList(params: any) {
  return contentClient("/module/moduleTemplateAttr/client/list", {
    params
  });
}


export async function save(params: ModuleTemplateItem) {
  return contentClient("/module/moduleTemplate/save", {
    method: "POST",
    data: params
  });
}

export async function saveOrUpdate(params: ModuleTemplateItem) {
  return contentClient("/module/moduleTemplate/client/saveOrUpdate", {
    method: "POST",
    data: params
  });
}


export async function update(params: ModuleTemplateItem) {
  return contentClient("/module/moduleTemplate/updateById", {
    method: "POST",
    data: params
  });
}

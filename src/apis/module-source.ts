import { contentClient } from '@/lib/api/client';
import {ModuleTemplateItem} from "@/beans/system";


export async function page(params: any) {
  return contentClient("/module/moduleSource/client/page", {
    params
  });
}

export async function remove(ids: number[]) {
  return contentClient("/module/moduleSource/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: ModuleTemplateItem) {
  return contentClient("/module/moduleSource/save", {
    method: "POST",
    data: params
  });
}

export async function saveOrUpdate(params: ModuleTemplateItem) {
  return contentClient("/module/moduleSource/client/saveOrUpdate", {
    method: "POST",
    data: params
  });
}

export async function update(params: ModuleTemplateItem) {
  return contentClient("/module/moduleSource/updateById", {
    method: "POST",
    data: params
  });
}

import { contentClient } from '@/lib/api/client';
import {SystemModuleTemplateAttrItem} from "@/beans/system";


export async function page(params: any) {
  return contentClient("/module/moduleTemplateAttr/page", {
    params
  });
}

export async function remove(ids: number[]) {
  return contentClient("/module/moduleTemplateAttr/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: SystemModuleTemplateAttrItem) {
  return contentClient("/module/moduleTemplateAttr/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: SystemModuleTemplateAttrItem) {
  return contentClient("/module/moduleTemplateAttr/updateById", {
    method: "POST",
    data: params
  });
}

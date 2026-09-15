import { adminClient } from '@/lib/api/client';

export interface WebsiteDictListParams {
  page?: number;
  pageSize?: number;
  pageNumber?: number;
  sitename?: string;
  type?: string;
}

/** 网站字典(core-api sys_website_dict 表):网站名 + 类型 + 关联的字典类型/字典项 ID */
export interface WebsiteDictRecord {
  id?: number;
  sitename?: string;
  type?: string;
  dictTypeId?: number;
  dictDataId?: number;
  updateTime?: string;
}

export async function page(params: WebsiteDictListParams) {
  return adminClient("/sysWebsiteDict/client/page", {
    params
  });
}

export async function remove(ids: number[]) {
  return adminClient("/sysWebsiteDict/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: WebsiteDictRecord) {
  return adminClient("/sysWebsiteDict/saveBatch", {
    method: "POST",
    data: params
  });
}

export async function update(params: WebsiteDictRecord) {
  return adminClient("/sysWebsiteDict/updateById", {
    method: "POST",
    data: params
  });
}

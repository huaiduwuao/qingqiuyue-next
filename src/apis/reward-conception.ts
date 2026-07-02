import { rewardClient } from '@/lib/api/client';
import type { ConceptionItem } from '@/beans/reward';

// 概念信息(API 返回的完整字段 = ConceptionItem 视图的全部可选字段)
export interface ConceptionInfo extends ConceptionItem {
  id: number;
  name: string;
  description?: string;
}

// 概念查询参数
export interface ConceptionQuery {
  page?: number;
  pageSize?: number;
  pageNumber?: number;
  name?: string;
  groupId?: number;
  demandId?: number;
  status?: string;
}

// 概念列表响应
export interface ConceptionListResp {
  list: ConceptionInfo[];
  records?: ConceptionInfo[];
  total: number;
  totalRow?: number;
  data?: ConceptionListResp;
  success?: boolean;
}

// 获取概念列表
export async function listConceptions(params?: ConceptionQuery) {
  return rewardClient<ConceptionListResp>('/conception/client/page', {
    method: 'GET',
    params,
  });
}

// 后台管理列表
export async function adminListConceptions(params?: ConceptionQuery) {
  return rewardClient<ConceptionListResp>('/conception/list', {
    method: 'GET',
    params,
  });
}

// 分页获取概念 (page alias)
export const conceptionPage = (params?: ConceptionQuery) => listConceptions(params);

// 获取概念详情
export async function getConception(id: number) {
  return rewardClient<ConceptionInfo>(`/conception/${id}`, {
    method: 'GET',
  });
}

// 创建概念
export async function createConception(data: unknown) {
  return rewardClient<ConceptionInfo>('/conception', {
    method: 'POST',
    data,
  });
}

// 更新概念
export async function updateConception(id: number, data: unknown) {
  return rewardClient<ConceptionInfo>(`/conception/${id}`, {
    method: 'PUT',
    data,
  });
}

// 删除概念
export async function deleteConception(id: number) {
  return rewardClient(`/conception/${id}`, {
    method: 'DELETE',
  });
}

// Aliases for missing exports
export const myPage = listConceptions;
export const conceptionDetail = (params: { id: number } | number) => {
  if (typeof params === 'number') {
    return getConception(params);
  }
  return getConception(params.id);
};
export const save = createConception;

// Wrapper for remove that accepts an array or single id
export const remove = (ids: number | number[]) => {
  const id = Array.isArray(ids) ? ids[0] : ids;
  return deleteConception(id);
};

// Wrapper for update that accepts an object with id
export const update = (data: { id?: number; _id?: number } & Record<string, unknown>) => {
  if (data.id) {
    return updateConception(data.id, data as any);
  }
  return updateConception(data._id!, data as any);
};

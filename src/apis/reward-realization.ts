import { rewardClient } from '@/lib/api/client';
import type { PageParams } from '@/beans/pagination';

// 实现信息
export interface RealizationInfo {
  id: number;
  demandId: number;
  userId: number;
  content?: string;
  status?: string;
  createTime?: string;
}

// 实现查询参数（扩展统一分页类型）
export interface RealizationQuery extends PageParams {
  demandId?: number;
  userId?: number;
  groupId?: number;
}

// 实现列表响应
export interface RealizationListResp {
  list: RealizationInfo[];
  records?: RealizationInfo[];
  total: number;
  totalRow?: number;
  data?: RealizationListResp;
  success?: boolean;
}

// 获取实现列表
export async function listRealizations(params?: RealizationQuery) {
  return rewardClient<RealizationListResp>('/realization/list', {
    method: 'GET',
    params,
  });
}

// 获取实现详情
export async function getRealization(id: number) {
  return rewardClient<RealizationInfo>(`/realization/${id}`, {
    method: 'GET',
  });
}

// 创建实现
export async function createRealization(data: unknown) {
  return rewardClient<RealizationInfo>('/realization', {
    method: 'POST',
    data,
  });
}

// 更新实现
export async function updateRealization(id: number, data: unknown) {
  return rewardClient<RealizationInfo>(`/realization/${id}`, {
    method: 'PUT',
    data,
  });
}

// 删除实现
export async function deleteRealization(id: number) {
  return rewardClient(`/realization/${id}`, {
    method: 'DELETE',
  });
}

// Aliases for missing exports
export const myPage = listRealizations;
export const realizationDetail = (params: { id: number } | number) => {
  if (typeof params === 'number') {
    return getRealization(params);
  }
  return getRealization(params.id);
};
export const pickRealization = async (params: Record<string, unknown>) => {
  return rewardClient('/realization/pick', { method: 'POST', data: params });
};

// Wrapper for remove that accepts an array or single id
export const remove = (ids: number | number[]) => {
  const id = Array.isArray(ids) ? ids[0] : ids;
  return deleteRealization(id);
};

// Wrapper for save that accepts an object
export const save = (data: unknown) => createRealization(data);

// Wrapper for update that accepts an object with id
export const update = (data: { id?: number; _id?: number } & Record<string, unknown>) => {
  if (data.id) {
    return updateRealization(data.id, data as any);
  }
  return updateRealization(data._id!, data as any);
};

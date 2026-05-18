import { rewardClient } from '@/lib/api/client';

// 概念信息
export interface ConceptionInfo {
  id: number;
  name: string;
  description?: string;
  groupId?: number;
  status?: string;
  createTime?: string;
}

// 概念查询参数
export interface ConceptionQuery {
  page?: number;
  pageSize?: number;
  pageNumber?: number;
  name?: string;
  groupId?: number;
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

// 分页获取概念 (page alias)
export const conceptionPage = (params?: ConceptionQuery) => listConceptions(params);

// 获取概念详情
export async function getConception(id: number) {
  return rewardClient<ConceptionInfo>(`/conception/${id}`, {
    method: 'GET',
  });
}

// 创建概念
export async function createConception(data: any) {
  return rewardClient<ConceptionInfo>('/conception', {
    method: 'POST',
    data,
  });
}

// 更新概念
export async function updateConception(id: number, data: any) {
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
export const update = (data: any) => {
  if (data.id) {
    return updateConception(data.id, data);
  }
  return updateConception(data._id, data);
};

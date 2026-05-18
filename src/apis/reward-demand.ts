import { rewardClient } from '@/lib/api/client';

// 需求信息
export interface DemandInfo {
  id: number;
  title: string;
  description?: string;
  projectId?: number;
  groupId?: number;
  status?: string;
  createTime?: string;
}

// 需求查询参数
export interface DemandQuery {
  page?: number;
  pageSize?: number;
  pageNumber?: number;
  title?: string;
  status?: string;
  groupId?: number;
  projectId?: number;
}

// 需求列表响应
export interface DemandListResp {
  list: DemandInfo[];
  records?: DemandInfo[];
  total: number;
  totalRow?: number;
  data?: DemandListResp;
  success?: boolean;
}

// 获取需求列表
export async function listDemands(params?: DemandQuery) {
  return rewardClient<DemandListResp>('/demand/client/page', {
    method: 'GET',
    params,
  });
}

// 分页获取需求 (page alias)
export const demandPage = (params?: DemandQuery) => listDemands(params);

// 获取需求详情
export async function getDemand(id: number) {
  return rewardClient<DemandInfo>(`/demand/${id}`, {
    method: 'GET',
  });
}

// 创建需求
export async function createDemand(data: any) {
  return rewardClient<DemandInfo>('/demand', {
    method: 'POST',
    data,
  });
}

// 更新需求
export async function updateDemand(id: number, data: any) {
  return rewardClient<DemandInfo>(`/demand/${id}`, {
    method: 'PUT',
    data,
  });
}

// 删除需求
export async function deleteDemand(id: number) {
  return rewardClient(`/demand/${id}`, {
    method: 'DELETE',
  });
}

// Aliases for missing exports
export const myPage = listDemands;
export const demandDetail = (params: { id: number } | number) => {
  if (typeof params === 'number') {
    return getDemand(params);
  }
  return getDemand(params.id);
};
export const process = async (params: any) => {
  return rewardClient('/demand/process', { method: 'POST', data: params });
};
// Wrapper for remove that accepts an array or single id
export const remove = (ids: number | number[]) => {
  const id = Array.isArray(ids) ? ids[0] : ids;
  return deleteDemand(id);
};

// Wrapper for save that accepts an object
export const save = (data: any) => createDemand(data);

// Wrapper for update that accepts an object with id
export const update = (data: any) => {
  if (data.id) {
    return updateDemand(data.id, data);
  }
  return updateDemand(data._id, data);
};

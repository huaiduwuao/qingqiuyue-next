import { rewardClient } from '@/lib/api/client';
import type { PageParams } from '@/beans/pagination';

// 分组信息
export interface GroupInfo {
  id: number;
  name: string;
  description?: string;
  cover?: string;
  status?: string;
  createTime?: string;
}

// 分组查询参数（扩展统一分页类型）
export interface GroupQuery extends PageParams {
  name?: string;
  status?: string;
}

// 分组列表响应
export interface GroupListResp {
  list: GroupInfo[];
  records?: GroupInfo[];
  total: number;
  totalRow?: number;
  data?: GroupListResp;
  success?: boolean;
}

// 获取分组列表
export async function listGroups(params?: GroupQuery) {
  return rewardClient<GroupListResp>('/group/client/page', {
    method: 'GET',
    params,
  });
}

// 分页获取分组 (page alias)
export const groupPage = (params?: GroupQuery) => listGroups(params);

// 获取分组详情
export async function getGroup(id: number) {
  return rewardClient<GroupInfo>(`/group/${id}`, {
    method: 'GET',
  });
}

// 创建分组
export async function createGroup(data: unknown) {
  return rewardClient<GroupInfo>('/group', {
    method: 'POST',
    data,
  });
}

// 更新分组
export async function updateGroup(id: number, data: unknown) {
  return rewardClient<GroupInfo>(`/group/${id}`, {
    method: 'PUT',
    data,
  });
}

// 删除分组
export async function deleteGroup(id: number) {
  return rewardClient(`/group/${id}`, {
    method: 'DELETE',
  });
}

// 获取分组列表 (兼容旧名称)
export const groupList = listGroups;

// 创建分组 (兼容旧名称)
export const newGroup = createGroup;

// Aliases for missing exports
export const groupDetail = (params: { id: number } | number) => {
  if (typeof params === 'number') {
    return getGroup(params);
  }
  return getGroup(params.id);
};

// Wrapper for remove that accepts an array or single id
export const remove = (ids: number | number[]) => {
  const id = Array.isArray(ids) ? ids[0] : ids;
  return deleteGroup(id);
};

// 获取待审核分组
export async function groupListWait(params?: GroupQuery) {
  return rewardClient<GroupListResp>('/group/wait', {
    method: 'GET',
    params,
  });
}

// 获取分组建议
export async function groupSuggest(params?: any) {
  return rewardClient<GroupInfo[]>('/group/suggest', {
    method: 'GET',
    params,
  });
}

// 发送分组
export async function sendGroup(data: unknown) {
  return rewardClient<GroupInfo>('/group/send', {
    method: 'POST',
    data,
  });
}

// 同意分组 (original function)
async function doAgreeGroup(id: number) {
  return rewardClient<GroupInfo>(`/group/${id}/agree`, {
    method: 'PUT',
  });
}

// Wrapper for agreeGroup that accepts an object with id or a number
export const agreeGroup = (idOrData: number | any) => {
  if (typeof idOrData === 'number') {
    return doAgreeGroup(idOrData);
  }
  if (idOrData.id) {
    return doAgreeGroup(idOrData.id);
  }
  return doAgreeGroup(idOrData._id);
};

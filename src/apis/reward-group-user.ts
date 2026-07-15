import { rewardClient } from '@/lib/api/client';
import type { PageParams } from '@/beans/pagination';

// 分组用户信息
export interface GroupUserInfo {
  id: number;
  groupId: number;
  userId: number;
  status?: string;
  createTime?: string;
}

// 分组用户查询参数（扩展统一分页类型）
export interface GroupUserQuery extends PageParams {
  userId?: number;
  groupId?: number;
  status?: string;
}

// 分组用户列表响应
export interface GroupUserListResp {
  list: GroupUserInfo[];
  total: number;
}

// 获取分组用户列表
export async function listGroupUsers(params?: GroupUserQuery) {
  return rewardClient<GroupUserListResp>('/group-user/list', {
    method: 'GET',
    params,
  });
}

// 添加分组用户
export async function createGroupUser(data: unknown) {
  return rewardClient<GroupUserInfo>('/group-user', {
    method: 'POST',
    data,
  });
}

// 更新分组用户
export async function updateGroupUser(id: number, data: unknown) {
  return rewardClient<GroupUserInfo>(`/group-user/${id}`, {
    method: 'PUT',
    data,
  });
}

// 删除分组用户
export async function deleteGroupUser(id: number) {
  return rewardClient(`/group-user/${id}`, {
    method: 'DELETE',
  });
}

// 邀请用户加入分组
export async function inviteGroupUser(data: unknown) {
  return rewardClient('/group-user/invite', {
    method: 'POST',
    data,
  });
}

// 同意/拒绝加入申请
export async function agreeGroupUser(id: number, status: string) {
  return rewardClient(`/group-user/agree/${id}?status=${status}`, {
    method: 'POST',
  });
}

// Aliases for missing exports
export const page = listGroupUsers;

// Wrapper for remove that accepts an array or single id
export const remove = (ids: number | number[]) => {
  const id = Array.isArray(ids) ? ids[0] : ids;
  return deleteGroupUser(id);
};

// Wrapper for save that accepts an object
export const save = (data: unknown) => createGroupUser(data);

// Wrapper for update that accepts an object with id
export const update = (data: { id?: number; _id?: number } & Record<string, unknown>) => {
  if (data.id) {
    return updateGroupUser(data.id, data as any);
  }
  return updateGroupUser(data._id!, data as any);
};

import { adminClient } from '@/lib/api/client';

// 权限信息
export interface PermissionInfo {
  id: number;
  name: string;
  code?: string;
  info?: string;
}

// 权限查询参数
export interface PermissionQuery {
  page?: number;
  pageNumber?: number;
  pageSize?: number;
  name?: string;
  code?: string;
}

// 创建权限请求
export interface CreatePermissionReq {
  name: string;
  code: string;
  info?: string;
}

// 更新权限请求
export interface UpdatePermissionReq {
  name?: string;
  code?: string;
  info?: string;
}

// 权限列表响应
export interface PermissionListResp {
  list: PermissionInfo[];
  records?: PermissionInfo[];
  total: number;
  totalRow?: number;
  success?: boolean;
}

// 获取权限列表
export async function listPermissions(params?: PermissionQuery) {
  return adminClient<PermissionListResp>('/permission/list', {
    method: 'GET',
    params,
  });
}

// 获取权限详情
export async function getPermission(id: number) {
  return adminClient<PermissionInfo>(`/permission/${id}`, {
    method: 'GET',
  });
}

// 创建权限
export async function createPermission(data: CreatePermissionReq) {
  return adminClient<PermissionInfo>('/permission', {
    method: 'POST',
    data,
  });
}

// 更新权限
export async function updatePermission(id: number, data: UpdatePermissionReq) {
  return adminClient<PermissionInfo>(`/permission/${id}`, {
    method: 'PUT',
    data,
  });
}

// 删除权限
export async function deletePermission(id: number) {
  return adminClient(`/permission/${id}`, {
    method: 'DELETE',
  });
}

// Aliases for missing exports
export const page = listPermissions;
export const remove = (ids: number | number[]) => {
  const id = Array.isArray(ids) ? ids[0] : ids;
  return deletePermission(id);
};
export const save = createPermission;

// Wrapper for update that accepts an object with id
export const update = (data: { id?: number; _id?: number } & Record<string, unknown>) => {
  if (data.id) {
    return updatePermission(data.id, data as any);
  }
  return updatePermission(data._id!, data as any);
};

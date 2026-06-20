import { adminClient } from '@/lib/api/client';

// 数据权限信息
export interface DataPermissionInfo {
  id: number;
  name: string;
  code: string;
  type?: string;
  info?: string;
}

// 数据权限查询参数
export interface DataPermissionQuery {
  page?: number;
  pageNumber?: number;
  pageSize?: number;
  name?: string;
  code?: string;
}

// 创建数据权限请求
export interface CreateDataPermissionReq {
  name: string;
  code: string;
  type?: string;
  info?: string;
}

// 更新数据权限请求
export interface UpdateDataPermissionReq {
  name?: string;
  code?: string;
  type?: string;
  info?: string;
}

// 数据权限列表响应
export interface DataPermissionListResp {
  list: DataPermissionInfo[];
  records?: DataPermissionInfo[];
  total: number;
  totalRow?: number;
  success?: boolean;
}

// 获取数据权限列表
export async function listDataPermissions(params?: DataPermissionQuery) {
  return adminClient<DataPermissionListResp>('/data-permission/list', {
    method: 'GET',
    params,
  });
}

// 获取数据权限详情
export async function getDataPermission(id: number) {
  return adminClient<DataPermissionInfo>(`/data-permission/${id}`, {
    method: 'GET',
  });
}

// 创建数据权限
export async function createDataPermission(data: CreateDataPermissionReq) {
  return adminClient<DataPermissionInfo>('/data-permission', {
    method: 'POST',
    data,
  });
}

// 更新数据权限
export async function updateDataPermission(id: number, data: UpdateDataPermissionReq) {
  return adminClient<DataPermissionInfo>(`/data-permission/${id}`, {
    method: 'PUT',
    data,
  });
}

// 删除数据权限
export async function deleteDataPermission(id: number) {
  return adminClient(`/data-permission/${id}`, {
    method: 'DELETE',
  });
}

// Aliases for missing exports
export const page = listDataPermissions;
export const save = createDataPermission;

// Wrapper for remove that accepts an array or single id
export const remove = (ids: number | number[]) => {
  const id = Array.isArray(ids) ? ids[0] : ids;
  return deleteDataPermission(id);
};

// Wrapper for update that accepts an object with id
export const update = (data: any) => {
  if (data.id) {
    return updateDataPermission(data.id, data);
  }
  return updateDataPermission(data._id, data);
};

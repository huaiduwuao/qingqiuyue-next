import { adminClient } from '@/lib/api/client';
import { PageParams } from '@/beans/pagination';

export interface UserListParams extends PageParams {
  name?: string;
  username?: string;
  status?: number;
}

// 用户分页 -> GET /api/core/user/list
export async function page(params: UserListParams) {
  return adminClient('/user/list', { params });
}

// 删除用户 -> DELETE /api/core/user/:id
export async function remove(ids: number[]) {
  const list = Array.isArray(ids) ? ids : [ids];
  return Promise.all(list.map((id) => adminClient(`/user/${id}`, { method: 'DELETE' })));
}

// 保存用户 -> POST /api/core/user
export async function save(params: Record<string, unknown>) {
  return adminClient('/user', { method: 'POST', data: params });
}

// 更新用户 -> PUT /api/core/user/:id
export async function update(params: Record<string, unknown>) {
  return adminClient(`/user/${params.id}`, { method: 'PUT', data: params });
}

// 获取用户已有角色 - GET /api/core/user/:id/roles
export async function listRole(userId: number) {
  return adminClient(`/user/${userId}/roles`);
}

// 建议角色(复用角色列表接口) -> GET /api/core/role/list
export async function suggestRole(params: Record<string, unknown>) {
  return adminClient('/role/list', { params });
}

// 删除用户角色 - 设为空角色列表
export async function removeRole(userId: number, roleId: number) {
  return adminClient(`/user/${userId}/roles`, { method: 'POST', data: { roleIds: [] } });
}

// 添加用户角色 -> POST /api/core/user/:id/roles
export async function roleAdd(userId: number, roleIds: number[]) {
  return adminClient(`/user/${userId}/roles`, { method: 'POST', data: { roleIds } });
}

// 获取用户已有角色 - GET /api/core/user/:id/roles
export async function getRoles(userId: number) {
  return adminClient(`/user/${userId}/roles`);
}

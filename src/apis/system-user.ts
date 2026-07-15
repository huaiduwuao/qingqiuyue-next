import { adminClient } from '@/lib/api/client';
import { PageParams } from '@/beans/pagination';

export interface UserListParams extends PageParams {
  name?: string;
  username?: string;
  status?: number;
}

// 用户分页 -> 后端 GET /user/list (client.ts 已自动归一化分页响应)
export async function page(params: UserListParams) {
  return adminClient('/user/list', { params });
}

// 删除用户 -> 后端 DELETE /user/:id (批量循环)
export async function remove(ids: number[]) {
  const list = Array.isArray(ids) ? ids : [ids];
  return Promise.all(list.map((id) => adminClient(`/user/${id}`, { method: 'DELETE' })));
}

// 保存用户 -> 后端 POST /user
export async function save(params: Record<string, unknown>) {
  return adminClient('/user', { method: 'POST', data: params });
}

// 更新用户 -> 后端 PUT /user/:id
export async function update(params: Record<string, unknown>) {
  return adminClient(`/user/${params.id}`, { method: 'PUT', data: params });
}

// ⚠️ 以下 user-role 分配端点后端(admin-api)暂未实现,保留走 mock。
// 后端补齐后再对齐:建议 GET /user/:id/roles、POST /user/:id/roles 等。
// 用户角色列表
export async function listRole(params: Record<string, unknown>) {
  return adminClient(`/user/listRole/${params.id}`, { params });
}

// 建议角色
export async function suggestRole(params: Record<string, unknown>) {
  return adminClient(`/user/suggestRole/${params.id}`, { params });
}

// 删除用户角色
export async function removeRole(ids?: number[]) {
  return adminClient('/userRole/removeByIds', { method: 'DELETE', data: ids });
}

// 添加用户角色
export async function roleAdd(params: Record<string, unknown>) {
  return adminClient('/user/roleAdd', { method: 'POST', data: params });
}

// 获取用户已有角色 - GET /user/:id/roles
export async function getRoles(userId: number) {
  return adminClient(`/user/${userId}/roles`, { method: 'GET' });
}

import { adminClient } from '@/lib/api/client';
import { UserInfo } from './auth';

// 后端分页响应 { list, total } 归一成 UI 期望的 { records, totalRow }
function normalizePage(res: any) {
  const d = res?.data ?? {};
  return {
    ...res,
    data: {
      records: d.records ?? d.list ?? [],
      totalRow: d.totalRow ?? d.total ?? 0,
    },
  };
}

// 用户分页 -> 后端 GET /user/list
export async function page(params: any) {
  const res = await adminClient('/user/list', { params });
  return normalizePage(res);
}

// 删除用户 -> 后端 DELETE /user/:id (批量循环)
export async function remove(ids: number[]) {
  const list = Array.isArray(ids) ? ids : [ids];
  return Promise.all(list.map((id) => adminClient(`/user/${id}`, { method: 'DELETE' })));
}

// 保存用户 -> 后端 POST /user
export async function save(params: any) {
  return adminClient('/user', { method: 'POST', data: params });
}

// 更新用户 -> 后端 PUT /user/:id
export async function update(params: any) {
  return adminClient(`/user/${params.id}`, { method: 'PUT', data: params });
}

// ⚠️ 以下 user-role 分配端点后端(admin-api)暂未实现,保留走 mock。
// 后端补齐后再对齐:建议 GET /user/:id/roles、POST /user/:id/roles 等。
// 用户角色列表
export async function listRole(params: any) {
  return adminClient(`/user/listRole/${params.id}`, { params });
}

// 建议角色
export async function suggestRole(params: any) {
  return adminClient(`/user/suggestRole/${params.id}`, { params });
}

// 删除用户角色
export async function removeRole(ids?: number[]) {
  return adminClient('/userRole/removeByIds', { method: 'DELETE', data: ids });
}

// 添加用户角色
export async function roleAdd(params: any) {
  return adminClient('/user/roleAdd', { method: 'POST', data: params });
}

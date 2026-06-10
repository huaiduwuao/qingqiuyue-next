import { adminClient } from '@/lib/api/client';

// 后端分页响应 { list, total } 归一成 UI 期望的 { records, totalRow }
function normalizePage(res: any) {
  const d = res?.data ?? {};
  return { ...res, data: { records: d.records ?? d.list ?? [], totalRow: d.totalRow ?? d.total ?? 0 } };
}

// 角色分页 -> 后端 GET /role/list
export async function page(params: any) {
  const res = await adminClient('/role/list', { params });
  return normalizePage(res);
}

// ⚠️ 以下细粒度赋权端点(listMenu/listPermission/suggest*/menuChange/userAdd 及对应 ...Remove)
//    后端 admin-api 未实现,仅整体赋权 POST /role/:id/permissions|data-permissions。暂保留走 mock,
//    后端补齐后再对齐。
// 角色列表菜单 (mock-only)
export async function listMenu(params?: number) {
  return adminClient(`/role/listMenu/${params}`);
}

// 删除角色 -> 后端 DELETE /role/:id (批量循环)
export async function remove(ids: number[]) {
  const list = Array.isArray(ids) ? ids : [ids];
  return Promise.all(list.map((id) => adminClient(`/role/${id}`, { method: 'DELETE' })));
}

// 角色权限列表
export async function listPermission(params: any) {
  return adminClient(`/role/listPermission/${params.id}`, { params });
}

// 建议权限
export async function suggestPermission(params: any) {
  return adminClient("/role/suggestPermission", { params });
}

// 删除权限
export async function removePermission(ids?: number[]) {
  return adminClient("/rolePermission/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

// 添加权限 -> 后端 POST /role/:id/permissions (整体赋权)
export async function permissionAdd(params: any) {
  return adminClient(`/role/${params.roleId ?? params.id}/permissions`, {
    method: 'POST',
    data: params,
  });
}

// 数据权限列表
export async function listDataPermission(params: any) {
  return adminClient(`/role/listDataPermission/${params.id}`, { params });
}

// 建议数据权限
export async function suggestDataPermission(params: any) {
  return adminClient("/role/suggestDataPermission", { params });
}

// 删除数据权限
export async function removeDataPermission(ids?: number[]) {
  return adminClient("/roleDataPermission/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

// 添加数据权限 -> 后端 POST /role/:id/data-permissions
export async function dataPermissionAdd(params: any) {
  return adminClient(`/role/${params.roleId ?? params.id}/data-permissions`, {
    method: 'POST',
    data: params,
  });
}

// 保存角色 -> 后端 POST /role
export async function save(params: any) {
  return adminClient('/role', { method: 'POST', data: params });
}

// 更新角色 -> 后端 PUT /role/:id
export async function update(params: any) {
  return adminClient(`/role/${params.id}`, { method: 'PUT', data: params });
}

// 菜单变更
export async function menuChange(params: any) {
  return adminClient("/role/menuChange", {
    method: "POST",
    data: params
  });
}

// 角色用户列表
export async function listUser(params: any) {
  return adminClient(`/role/listUser/${params.id}`, { params });
}

// 建议用户
export async function suggestUser(params: any) {
  return adminClient("/role/suggestUser", { params });
}

// 删除用户
export async function removeUser(ids?: number[]) {
  return adminClient("/userRole/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

// 添加用户
export async function userAdd(params: any) {
  return adminClient("/role/userAdd", {
    method: "POST",
    data: params
  });
}

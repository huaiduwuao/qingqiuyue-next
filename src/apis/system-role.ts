import { adminClient } from '@/lib/api/client';
import { PageParams } from '@/beans/pagination';

// ==================== 角色管理 ====================

// 角色分页 -> GET /api/core/role/list
export async function page(params: Record<string, unknown>) {
  return adminClient('/role/list', { params });
}

// 删除角色 -> DELETE /api/core/role/:id
export async function remove(ids: number[]) {
  const list = Array.isArray(ids) ? ids : [ids];
  return Promise.all(list.map((id) => adminClient(`/role/${id}`, { method: 'DELETE' })));
}

// 保存角色 -> POST /api/core/role
export async function save(params: Record<string, unknown>) {
  return adminClient('/role', { method: 'POST', data: params });
}

// 更新角色 -> PUT /api/core/role/:id
export async function update(params: Record<string, unknown>) {
  return adminClient(`/role/${params.id}`, { method: 'PUT', data: params });
}

// 获取角色详情 - GET /api/core/role/:id
export async function get(id: number) {
  return adminClient(`/role/${id}`);
}

// ==================== 权限管理 ====================

// 权限列表 -> GET /api/core/permission/list
export async function listPermission(params: Record<string, unknown>) {
  return adminClient('/permission/list', { params });
}

// 搜索权限建议 -> GET /api/core/permission/suggest?name=&limit=
export async function suggestPermission(params: Record<string, unknown>) {
  return adminClient('/permission/suggest', { params });
}

// 删除权限 -> POST /api/core/permission/deleteByIds
export async function removePermission(ids?: number[]) {
  return adminClient('/permission/deleteByIds', { method: 'POST', data: { ids } });
}

// 添加权限 -> POST /api/core/role/:id/permissions
export async function permissionAdd(params: Record<string, unknown>) {
  return adminClient(`/role/${params.roleId ?? params.id}/permissions`, { method: 'POST', data: params });
}

// 获取角色已有权限列表 - GET /api/core/role/:id/permissions
export async function getPermissions(roleId: number) {
  return adminClient(`/role/${roleId}/permissions`);
}

// ==================== 数据权限管理 ====================

// 数据权限列表 -> GET /api/core/data-permission/list
export async function listDataPermission(params: Record<string, unknown>) {
  return adminClient('/data-permission/list', { params });
}

// 搜索数据权限建议 -> GET /api/core/data-permission/suggest?name=&limit=
export async function suggestDataPermission(params: Record<string, unknown>) {
  return adminClient('/data-permission/suggest', { params });
}

// 删除数据权限 -> POST /api/core/data-permission/deleteByIds
export async function removeDataPermission(ids?: number[]) {
  return adminClient('/data-permission/deleteByIds', { method: 'POST', data: { ids } });
}

// 添加数据权限 -> POST /api/core/role/:id/data-permissions
export async function dataPermissionAdd(params: Record<string, unknown>) {
  return adminClient(`/role/${params.roleId ?? params.id}/data-permissions`, { method: 'POST', data: params });
}

// 获取角色已有数据权限列表 - GET /api/core/role/:id/data-permissions
export async function getDataPermissions(roleId: number) {
  return adminClient(`/role/${roleId}/data-permissions`);
}

// ==================== 菜单管理 ====================

// 菜单列表 -> GET /api/core/menu/list
export async function listMenu(params?: number) {
  return adminClient('/menu/list', { params: params ? { pid: params } : {} });
}

// 菜单变更 -> POST /api/core/menu/:id/assign
export async function menuChange(params: Record<string, unknown>) {
  return adminClient(`/menu/${params.id}/assign`, { method: 'POST', data: params });
}

// 获取角色已有菜单列表 - GET /api/core/menu/:id/role-menus
export async function getMenus(roleId: number) {
  return adminClient(`/menu/${roleId}/role-menus`);
}

// ==================== 角色用户管理 ====================

// 角色用户列表 -> GET /api/core/role/:roleId/users
export async function listUser(params: Record<string, unknown>) {
  return adminClient(`/role/${params.roleId ?? params.id}/users`);
}

// 搜索用户建议 -> GET /api/core/role/users/suggest?name=&limit=
export async function suggestUser(params: Record<string, unknown>) {
  return adminClient('/role/users/suggest', { params });
}

// 删除用户角色 -> DELETE /api/core/role/users
export async function removeUser(params: Record<string, unknown>) {
  return adminClient('/role/users', { method: 'DELETE', data: params });
}

// 添加用户角色 -> POST /api/core/role/users
export async function userAdd(params: Record<string, unknown>) {
  return adminClient('/role/users', { method: 'POST', data: params });
}

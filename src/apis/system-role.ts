import { adminClient } from '@/lib/api/client';

/**
 * 角色管理 API(core-api /api/core/role/*)。
 *
 * 角色本身只有名称/编码/描述;它的功能权限、数据权限、菜单、成员各走一个整体替换的接口,
 * 后端按 system:role:* 权限守卫,内置角色(超级管理员)只有超级管理员能改。
 */

export interface RoleRecord {
  id: number;
  name: string;
  code: string;
  info?: string;
  system?: boolean;
  userCount?: number;
  updateTime?: string;
}

export interface PermissionRecord {
  id: number;
  name: string;
  code: string;
  info?: string;
}

export interface DataPermissionRecord {
  id: number;
  name: string;
  code: string;
  type?: string;
  info?: string;
}

export interface MenuRecord {
  id: number;
  pid: number;
  name: string;
  path?: string;
  sort?: number;
  type?: string;
  display?: number;
}

export interface MemberRecord {
  id: number;
  name: string;
  nickname?: string;
  mobile?: string;
  avatar?: string;
}

// ==================== 角色 ====================

// 角色分页 -> GET /api/core/role/list
export async function page(params: Record<string, unknown>) {
  return adminClient('/role/list', { params });
}

// 删除角色 -> DELETE /api/core/role/:id
export async function remove(ids: number[]) {
  const list = Array.isArray(ids) ? ids : [ids];
  return Promise.all(list.map((id) => adminClient(`/role/${id}`, { method: 'DELETE' })));
}

// 新建角色 -> POST /api/core/role
export async function save(params: Record<string, unknown>) {
  return adminClient('/role', { method: 'POST', data: params });
}

// 修改角色基本信息 -> PUT /api/core/role/:id
export async function update(params: Record<string, unknown>) {
  return adminClient(`/role/${params.id}`, { method: 'PUT', data: params });
}

// 角色详情 -> GET /api/core/role/:id
export async function get(id: number) {
  return adminClient<RoleRecord>(`/role/${id}`);
}

// ==================== 功能权限 ====================

// 全部功能权限 -> GET /api/core/permission/all
export async function listAllPermissions() {
  return adminClient<PermissionRecord[]>('/permission/all');
}

// 角色已有功能权限 -> GET /api/core/role/:id/permissions
export async function getPermissions(roleId: number) {
  return adminClient<PermissionRecord[]>(`/role/${roleId}/permissions`);
}

// 整体替换角色的功能权限 -> POST /api/core/role/:id/permissions
export async function assignPermissions(roleId: number, permissionIds: number[]) {
  return adminClient(`/role/${roleId}/permissions`, { method: 'POST', data: { permissionIds } });
}

// ==================== 数据权限 ====================

// 全部数据权限 -> GET /api/core/data-permission/all
export async function listAllDataPermissions() {
  return adminClient<DataPermissionRecord[]>('/data-permission/all');
}

// 角色已有数据权限 -> GET /api/core/role/:id/data-permissions
export async function getDataPermissions(roleId: number) {
  return adminClient<DataPermissionRecord[]>(`/role/${roleId}/data-permissions`);
}

// 整体替换角色的数据权限 -> POST /api/core/role/:id/data-permissions
export async function assignDataPermissions(roleId: number, permissionIds: number[]) {
  return adminClient(`/role/${roleId}/data-permissions`, { method: 'POST', data: { permissionIds } });
}

// ==================== 菜单 ====================

// 全部菜单(平铺,按 pid 组树) -> GET /api/core/menu/all
export async function listAllMenus() {
  return adminClient<MenuRecord[]>('/menu/all');
}

// 角色已有菜单 -> GET /api/core/role/:id/menus
export async function getMenus(roleId: number) {
  return adminClient<MenuRecord[]>(`/role/${roleId}/menus`);
}

// 整体替换角色的菜单 -> POST /api/core/role/:id/menus
export async function assignMenus(roleId: number, menuIds: number[]) {
  return adminClient(`/role/${roleId}/menus`, { method: 'POST', data: { menuIds } });
}

// ==================== 成员 ====================

// 角色成员 -> GET /api/core/role/:id/users
export async function listMembers(roleId: number) {
  return adminClient<MemberRecord[]>(`/role/${roleId}/users`);
}

// 添加成员 -> POST /api/core/role/:id/users
export async function addMembers(roleId: number, userIds: number[]) {
  return adminClient(`/role/${roleId}/users`, { method: 'POST', data: { userIds } });
}

// 移除成员 -> DELETE /api/core/role/:id/users
export async function removeMembers(roleId: number, userIds: number[]) {
  return adminClient(`/role/${roleId}/users`, { method: 'DELETE', data: { userIds } });
}

// 搜索用户 -> GET /api/core/user/suggest?keyword=
export async function suggestUsers(keyword: string) {
  return adminClient<MemberRecord[]>('/user/suggest', { params: { keyword } });
}

import { adminClient } from '@/lib/api/client';

// 菜单信息
export interface MenuInfo {
  id: number;
  pid: number;
  name: string;
  path?: string;
  sort?: number;
  icon?: string;
  type?: string;
  display?: number;
  children?: MenuInfo[];
}

// 菜单列表响应
export interface MenuListResp {
  list: MenuInfo[];
  total: number;
}

// 获取菜单列表
export async function listMenus() {
  return adminClient<MenuListResp>('/menu/list', {
    method: 'GET',
  });
}

// 获取菜单详情
export async function getMenu(id: number) {
  return adminClient<MenuInfo>(`/api/menu/${id}`, {
    method: 'GET',
  });
}

// 创建菜单
export async function createMenu(data: any) {
  return adminClient<MenuInfo>('/menu', {
    method: 'POST',
    data,
  });
}

// 更新菜单
export async function updateMenu(id: number, data: any) {
  return adminClient<MenuInfo>(`/api/menu/${id}`, {
    method: 'PUT',
    data,
  });
}

// 删除菜单
export async function deleteMenu(id: number) {
  return adminClient(`/api/menu/${id}`, {
    method: 'DELETE',
  });
}

// 获取当前用户菜单
export async function getUserMenus() {
  return adminClient<MenuInfo[]>('/menu/me', {
    method: 'GET',
  });
}

// 分配菜单
export async function assignMenus(id: number, menuIds: number[]) {
  return adminClient(`/api/menu/${id}/assign`, {
    method: 'POST',
    data: { menuIds },
  });
}

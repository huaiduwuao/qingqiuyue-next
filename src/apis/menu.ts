import { adminClient } from '@/lib/api/client';
import { MenuItem } from '@/beans/system';

// 获取当前用户菜单 - GET /api/admin/menu/me
export async function getMenuData(params?: any) {
  return adminClient('/menu/me', { params });
}

// 获取菜单列表 - GET /api/admin/menu/list
export async function list(params?: any) {
  return adminClient('/menu/list', { params });
}

// 获取菜单详情 - GET /api/admin/menu/{id}
export async function getMenu(id: number) {
  return adminClient(`/menu/${id}`, { method: 'GET' });
}

// 创建菜单 - POST /api/admin/menu
export async function save(params: MenuItem) {
  return adminClient('/menu', { method: 'POST', data: params });
}

// 更新菜单 - PUT /api/admin/menu/{id}
export async function update(id: number, params: MenuItem) {
  return adminClient(`/menu/${id}`, { method: 'PUT', data: params });
}

// 删除菜单 - DELETE /api/admin/menu/{id}
export async function remove(id: number) {
  return adminClient(`/menu/${id}`, { method: 'DELETE' });
}

// 分配菜单 - POST /api/admin/menu/{id}/assign
export async function assign(id: number, menuIds: number[]) {
  return adminClient(`/menu/${id}/assign`, { method: 'POST', data: { menuIds } });
}

import { adminClient } from '@/lib/api/client';

// 角色分页
export async function page(params: any) {
  return adminClient("/role/page", { params });
}

// 角色列表菜单
export async function listMenu(params?: number) {
  return adminClient(`/role/listMenu/${params}`);
}

// 删除角色
export async function remove(ids: number[]) {
  return adminClient("/role/removeByIds", {
    method: "DELETE",
    data: ids
  });
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

// 添加权限
export async function permissionAdd(params: any) {
  return adminClient("/role/permissionAdd", {
    method: "POST",
    data: params
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

// 添加数据权限
export async function dataPermissionAdd(params: any) {
  return adminClient("/role/dataPermissionAdd", {
    method: "POST",
    data: params
  });
}

// 保存角色
export async function save(params: any) {
  return adminClient("/role/save", {
    method: "POST",
    data: params
  });
}

// 更新角色
export async function update(params: any) {
  return adminClient("/role/updateById", {
    method: "POST",
    data: params
  });
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

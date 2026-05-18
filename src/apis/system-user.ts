import { adminClient } from '@/lib/api/client';
import { UserInfo } from './auth';

// 用户分页
export async function page(params: any) {
  return adminClient("/user/page", { params });
}

// 删除用户
export async function remove(ids: number[]) {
  return adminClient("/user/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

// 保存用户
export async function save(params: any) {
  return adminClient("/user/systemAdd", {
    method: "POST",
    data: params
  });
}

// 更新用户
export async function update(params: any) {
  return adminClient("/user/systemUpdate", {
    method: "POST",
    data: params
  });
}

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
  return adminClient("/userRole/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

// 添加用户角色
export async function roleAdd(params: any) {
  return adminClient("/user/roleAdd", {
    method: "POST",
    data: params
  });
}

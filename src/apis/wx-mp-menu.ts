import { wxClient } from '@/lib/api/client';

// 微信菜单分页
export async function page(params: Record<string, unknown>) {
  return wxClient("/wxMenu/client/page", { params });
}

// 删除菜单
export async function remove(ids: number[]) {
  return wxClient("/wxMenu/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

// 保存菜单
export async function save(params: Record<string, unknown>) {
  return wxClient("/wxMenu/save", {
    method: "POST",
    data: params
  });
}

// 更新菜单
export async function update(params: Record<string, unknown>) {
  return wxClient("/wxMenu/updateById", {
    method: "PUT",
    data: params
  });
}

// 发布菜单
export async function publish(params: Record<string, unknown>) {
  return wxClient("/wxMenu/client/publish", {
    method: "POST",
    data: params
  });
}

// 客户端获取菜单
export async function clientGet(params: Record<string, unknown>) {
  return wxClient("/wxMenu/client/get", { params });
}

import { wxClient } from '@/lib/api/client';

// 微信菜单分页
export async function page(params: any) {
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
export async function save(params: any) {
  return wxClient("/wxMenu/save", {
    method: "POST",
    data: params
  });
}

// 更新菜单
export async function update(params: any) {
  return wxClient("/wxMenu/updateById", {
    method: "POST",
    data: params
  });
}

// 发布菜单
export async function publish(params: any) {
  return wxClient("/wxMenu/client/publish", {
    method: "POST",
    data: params
  });
}

// 客户端获取菜单
export async function clientGet(params: any) {
  return wxClient("/wxMenu/client/get", { params });
}

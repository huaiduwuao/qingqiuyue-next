import { wxClient } from '@/lib/api/client';

// 微信用户分页
export async function page(params: any) {
  return wxClient("/wxUser/client/page", { params });
}

// 删除用户
export async function remove(ids: number[]) {
  return wxClient("/wxUser/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

// 保存用户
export async function save(params: any) {
  return wxClient("/wxUser/save", {
    method: "POST",
    data: params
  });
}

// 更新用户
export async function update(params: any) {
  return wxClient("/wxUser/updateById", {
    method: "POST",
    data: params
  });
}

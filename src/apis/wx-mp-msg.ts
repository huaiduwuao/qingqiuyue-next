import { wxClient } from '@/lib/api/client';

// 微信消息分页
export async function page(params: Record<string, unknown>) {
  return wxClient("/wxMsg/client/page", { params });
}

// 删除消息
export async function remove(ids: number[]) {
  return wxClient("/wxMsg/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

// 保存消息
export async function save(params: Record<string, unknown>) {
  return wxClient("/wxMsg/save", {
    method: "POST",
    data: params
  });
}

// 更新消息
export async function update(params: Record<string, unknown>) {
  return wxClient("/wxMsg/updateById", {
    method: "PUT",
    data: params
  });
}

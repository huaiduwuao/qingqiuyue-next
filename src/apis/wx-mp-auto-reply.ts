import { wxClient } from '@/lib/api/client';

// 微信自动回复分页
export async function page(params: any) {
  return wxClient("/wxAutoReply/client/page", { params });
}

// 删除自动回复
export async function remove(ids: number[]) {
  return wxClient("/wxAutoReply/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

// 保存自动回复
export async function save(params: any) {
  return wxClient("/wxAutoReply/save", {
    method: "POST",
    data: params
  });
}

// 更新自动回复
export async function update(params: any) {
  return wxClient("/wxAutoReply/updateById", {
    method: "POST",
    data: params
  });
}

import { wxClient, adminClient } from '@/lib/api/client';

// 微信自动回复分页
export async function page(params: Record<string, unknown>) {
  return wxClient("/wxAutoReply/client/page", { params });
}

// 删除自动回复
export async function remove(ids: number[]) {
  return wxClient("/wxAutoReply/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

// 保存 / 更新走 internal/wxmp 的管理员接口:原来的 /wxAutoReply/save 只认五个字段,
// 匹配方式、图文标题/摘要/封面/链接、优先级全被丢掉,而且不校验登录。
export async function save(params: Record<string, unknown>) {
  return adminClient("/admin/wx/mp/auto-reply", { method: "POST", data: params });
}

export async function update(params: Record<string, unknown>) {
  return adminClient("/admin/wx/mp/auto-reply", { method: "PUT", data: params });
}

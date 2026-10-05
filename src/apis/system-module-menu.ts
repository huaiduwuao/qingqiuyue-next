import { contentClient } from '@/lib/api/client';

// 模块菜单信息
export interface ModuleMenuInfo {
  id: number;
  moduleId: number;
  name: string;
  path?: string;
  icon?: string;
  sort?: number;
  contentId?: number;
  type?: string;
  children?: ModuleMenuInfo[];
}

// 分页获取模块菜单
export async function page(params: Record<string, unknown>) {
  return contentClient("/module/menu/client/page", {
    params
  });
}

// 获取模块菜单树。口令合集带上解锁时拿到的通行证 modulePass,否则菜单不带内容 id
export async function clientTree(params: { moduleId: number; modulePass?: string }) {
  return contentClient<ModuleMenuInfo[]>("/module/menu/client/tree", {
    params
  });
}

// 删除
export async function remove(ids: unknown) {
  return contentClient("/module/menu/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

// 列表
export async function list(params: Record<string, unknown>) {
  return contentClient("/module/menu/client/list", {
    params
  });
}

// 保存
export async function save(params: Record<string, unknown>) {
  return contentClient("/module/menu/save", {
    method: "POST",
    data: params
  });
}

// 更新
export async function update(params: Record<string, unknown>) {
  return contentClient("/module/menu/updateById", {
    method: "POST",
    data: params
  });
}

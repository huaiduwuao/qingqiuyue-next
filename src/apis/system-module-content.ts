import { contentClient } from '@/lib/api/client';

// 模块内容信息
export interface ModuleContentInfo {
  id: number;
  moduleId: number;
  title: string;
  content?: string;
  cover?: string;
  status?: number;
  needPay?: boolean;
  shareType?: string;
  contentType?: string;
  userId?: number;
  username?: string;
  collectNum?: number;
  agreeNum?: number;
}

// 内容操作参数
export interface ContentActionReq {
  contentId: number;
  action: string;
}

// 评论参数
export interface CommentReq {
  contentId: number;
  content: string;
}

// 模块内容查询参数
export interface ModuleContentQuery {
  page?: number;
  pageSize?: number;
  pageNumber?: number;
  moduleId?: number;
  contentType?: string;
  userId?: number;
}

// 模块内容列表响应
export interface ModuleContentListResp {
  records?: ModuleContentInfo[];
  list: ModuleContentInfo[];
  total: number;
  totalRow?: number;
  pages?: number;
  current?: number;
}

// 分页获取模块内容
export async function page(params: ModuleContentQuery) {
  return contentClient<ModuleContentListResp>('/module/content/client/page', {
    method: 'GET',
    params,
  });
}

// 获取模块内容列表
export async function listModuleContents(params?: ModuleContentQuery) {
  return contentClient<ModuleContentListResp>('/module/content/client/page', {
    method: 'GET',
    params,
  });
}

// 获取模块内容详情
export async function detail(params: { id: number } | number) {
  const id = typeof params === 'number' ? params : params.id;
  return contentClient<ModuleContentInfo>(`/module/content/client/detail`, {
    method: 'GET',
    params: { id },
  });
}

// 获取模块内容详情 - GET /module/content/{id}
export async function getModuleContent(id: number) {
  return contentClient<ModuleContentInfo>(`/module/content/${id}`, {
    method: 'GET',
  });
}

// 创建模块内容 - POST /module/content
export async function createModuleContent(data: unknown) {
  return contentClient<ModuleContentInfo>('/module/content', {
    method: 'POST',
    data,
  });
}

// 更新模块内容 - PUT /module/content/{id}
export async function updateModuleContent(id: number, data: unknown) {
  return contentClient<ModuleContentInfo>(`/module/content/${id}`, {
    method: 'PUT',
    data,
  });
}

// 删除模块内容 - DELETE /module/content/removeByIds
export async function deleteModuleContent(ids: number[]) {
  return contentClient(`/module/content/removeByIds`, {
    method: 'DELETE',
    data: ids,
  });
}

// 从模块移除内容
export async function removeFromModule(params: { moduleId: number; contentId: number }) {
  return contentClient('/module/content/client/removeFromModule', {
    method: 'POST',
    data: params,
  });
}

// 处理内容
export async function process(params: Record<string, unknown>) {
  return contentClient('/module/content/client/process', {
    method: 'POST',
    data: params,
  });
}

// 获取关联内容
export async function related(params: Record<string, unknown>) {
  return contentClient('/module/content/client/related', {
    method: 'GET',
    params,
  });
}

// 建议内容
export async function suggest(params: Record<string, unknown>) {
  return contentClient('/module/content/client/suggest', {
    method: 'GET',
    params,
  });
}

// 更新分享设置
export async function updateShare(params: Record<string, unknown>) {
  return contentClient('/module/content/client/updateShare', {
    method: 'POST',
    data: params,
  });
}

// 内容操作(点赞/收藏等) - POST /module/content/action
export async function doContentAction(data: ContentActionReq) {
  return contentClient('/module/content/action', {
    method: 'POST',
    data,
  });
}

// 添加评论 - POST /module/content/comment
export async function addComment(data: CommentReq) {
  return contentClient('/module/content/comment', {
    method: 'POST',
    data,
  });
}

// 获取评论列表 - GET /module/content/comment/{contentId}
export async function getComments(contentId: number, params?: { page?: number; pageSize?: number }) {
  return contentClient(`/module/content/comment/${contentId}`, {
    method: 'GET',
    params,
  });
}

// Aliases
export const myPage = (params: ModuleContentQuery) => page({ ...params });
export const remove = (ids: number[]) => deleteModuleContent(ids);
export const save = createModuleContent;
export const update = (data: { id?: number; _id?: number } & Record<string, unknown>) => {
  if (data.id) {
    return updateModuleContent(data.id, data as any);
  }
  return updateModuleContent(data._id!, data as any);
};

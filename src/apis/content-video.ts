import { contentClient } from '@/lib/api/client';
// 内容类型
export type ContentType = 'music' | 'novel' | 'video' | 'film' | 'teleplay' | 'animation' | 'comics' | 'article' | 'news' | 'picture-album' | 'picture-detail' | 'live' | 'website' | 'pan' | 'vshow' | 'animation-item' | 'teleplay-item' | 'comics-item' | 'film-item' | 'vshow-item';

// 通用内容项
export interface ContentItem {
  id: number;
  title?: string;
  name?: string;
  cover?: string;
  info?: string;
  content?: string;
  contentType?: string;
  status?: string;
  moduleContentStatus?: string;
  moduleContentId?: number;
  moduleContentPreviewId?: number;
  moduleContentSearch?: boolean;
  createUser?: number;
  createTime?: string;
  updateTime?: string;
  groupId?: number;
}

// 通用分页参数
export interface ContentPageParams {
  page?: number;
  pageNumber?: number;
  pageSize?: number;
  current?: number;
  groupId?: number;
  status?: string;
  keyword?: string;
}

// Mock data for video content type

// 分页获取内容
export async function page(contentType: ContentType, params: ContentPageParams) {
  return contentClient(`client-content/${contentType}/page`, {
    method: 'GET',
    params,
  });
}

// 获取内容详情
export async function detail(contentType: ContentType, params: { id: number } | number) {
  const id = typeof params === 'number' ? params : params.id;
  return contentClient(`client-content/${contentType}/detail`, {
    method: 'GET',
    params: { id },
  });
}

// 处理内容状态
export async function process(contentType: ContentType, params: any) {
  return contentClient(`client-content/${contentType}/process`, {
    method: 'POST',
    data: params,
  });
}

// 保存或更新内容
export async function saveOrUpdate(contentType: ContentType, params: any) {
  return contentClient(`client-content/${contentType}/saveOrUpdate`, {
    method: 'POST',
    data: params,
  });
}

// 更新并发布
export async function updateAndPublish(contentType: ContentType, params: any) {
  return contentClient(`client-content/${contentType}/updateAndPublish`, {
    method: 'POST',
    data: params,
  });
}

// 删除内容
export async function remove(contentType: ContentType, ids: number[]) {
  return contentClient(`client-content/${contentType}/removeByIds`, {
    method: 'DELETE',
    data: ids,
  });
}

// Aliases
export const save = (contentType: ContentType, data: any) => saveOrUpdate(contentType, data);
export const update = (contentType: ContentType, data: any) => saveOrUpdate(contentType, data);
export const myPage = (contentType: ContentType, params: ContentPageParams) => page(contentType, params);
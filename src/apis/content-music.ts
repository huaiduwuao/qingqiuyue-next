import { contentClient } from '@/lib/api/client';
import type { PageParams } from '@/beans/pagination';
import { normalizeLegacyPageResponse } from '@/hooks/usePagination';
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

// 分页获取内容
export async function page<T = ContentItem>(contentType: ContentType, params: PageParams) {
  const res = await contentClient(`client-content/${contentType}/page`, {
    method: 'GET',
    params,
  });
  return normalizeLegacyPageResponse<T>((res as any)?.data ?? res);
}

// 获取内容详情
export async function detail(contentType: ContentType, params: { id: string | number } | string | number) {
  const id = typeof params === 'object' ? params.id : params;
  return contentClient(`client-content/${contentType}/detail`, {
    method: 'GET',
    params: { id },
  });
}

// 处理内容状态
export async function process(contentType: ContentType, params: Record<string, unknown>) {
  return contentClient(`client-content/${contentType}/process`, {
    method: 'POST',
    data: params,
  });
}

// 保存或更新内容
export async function saveOrUpdate(contentType: ContentType, params: Record<string, unknown>) {
  return contentClient(`client-content/${contentType}/saveOrUpdate`, {
    method: 'POST',
    data: params,
  });
}

// 更新并发布
export async function updateAndPublish(contentType: ContentType, params: Record<string, unknown>) {
  return contentClient(`client-content/${contentType}/updateAndPublish`, {
    method: 'POST',
    data: params,
  });
}

// 删除内容
export async function remove(contentType: ContentType, ids: number[]) {
  const list = Array.isArray(ids) ? ids : [ids];
  return Promise.all(list.map((id) => contentClient(`content/${id}`, { method: 'DELETE' })));
}

// Aliases
export const save = (contentType: ContentType, data: Record<string, unknown>) => saveOrUpdate(contentType, data);
export const update = (contentType: ContentType, data: Record<string, unknown>) => saveOrUpdate(contentType, data);
export const myPage = (contentType: ContentType, params: PageParams) => page(contentType, params);
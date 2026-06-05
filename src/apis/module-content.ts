/**
 * module_content API — 走 MSW mock(mockEnabled 时)或真后端。
 *
 * 端点路径对齐 Go 后端 internal/handler/module.go:
 *   GET    /api/content/module/content/list
 *   GET    /api/content/module/content/{id}
 *   DELETE /api/content/module/content/{id}
 *   POST   /api/content/module/content/action
 *
 * 响应格式:axios 拦截器已解包为 { code, msg, data },所以这里直接返回 data 字段(records/totalRow)。
 */

import { contentClient } from '@/lib/api/client';

export interface ModuleContentItem {
  id: number;
  moduleId: number;
  groupId?: number;
  categoryId?: number;
  title: string;
  subtitle?: string;
  content?: string;
  contentType: string;
  coverUrl?: string;
  cover?: string;
  status: string;
  author?: string;
  source?: string;
  sourceLabel?: string;
  tags?: string;
  agreeNum?: number;
  collectNum?: number;
  shareNum?: number;
  readNum?: number;
  commentNum?: number;
  search?: boolean;
  moduleContentStatus?: string;
  moduleContentSearch?: boolean;
  createTime?: string;
  updateTime?: string;
}

export interface ModuleContentQuery {
  pageNumber?: number;
  pageSize?: number;
  page?: number;
  moduleId?: number | string;
  groupId?: number | string;
  contentType?: string;
  status?: string;
  source?: string;
  title?: string;
  sortField?: string;
  sortOrder?: string;
}

export interface ModuleContentPageResp {
  records: ModuleContentItem[];
  totalRow: number;
  page: number;
  pageSize: number;
}

function toBackendParams(q: ModuleContentQuery) {
  return {
    page: q.pageNumber ?? q.page ?? 1,
    pageSize: q.pageSize ?? 20,
    moduleId: q.moduleId,
    groupId: q.groupId,
    contentType: q.contentType,
    status: q.status,
    source: q.source,
    title: q.title,
    sortField: q.sortField,
    sortOrder: q.sortOrder,
  };
}

export async function myPage(params: ModuleContentQuery = {}): Promise<{ code: number; data: ModuleContentPageResp }> {
  return contentClient('/module/content/list', { params: toBackendParams(params) }) as any;
}

export async function getById(id: number): Promise<{ code: number; data: ModuleContentItem }> {
  return contentClient(`/module/content/${id}`, { method: 'GET' }) as any;
}

export async function updateShare(params: ModuleContentItem) {
  return contentClient('/module/content', { method: 'POST', data: params });
}

export async function remove(ids: number[]) {
  return contentClient(`/module/content/${ids[0]}`, { method: 'DELETE' });
}

export async function process(params: { ids: number[]; status?: string; moduleContentStatus?: string; moduleContentSearch?: boolean }) {
  return contentClient('/module/content/action', { method: 'POST', data: params });
}

export async function suggest(params: { title: string; contentType?: string }) {
  return contentClient('/module/content/suggest', { params });
}

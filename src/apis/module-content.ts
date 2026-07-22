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
import type { PageParams, PageResult } from '@/beans/pagination';
import { normalizeLegacyPageResponse } from '@/hooks/usePagination';

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

export interface ModuleContentQuery extends PageParams {
  moduleId?: number | string;
  groupId?: number | string;
  contentType?: string;
  status?: string;
  source?: string;
  sourceLabel?: string;
  title?: string;
  sortField?: string;
  sortOrder?: string;
}

function toBackendParams(q: ModuleContentQuery) {
  return {
    page: q.page ?? 1,
    pageSize: q.pageSize ?? 20,
    moduleId: q.moduleId,
    groupId: q.groupId,
    contentType: q.contentType,
    status: q.status,
    source: q.source,
    sourceLabel: q.sourceLabel,
    title: q.title,
    sortField: q.sortField,
    sortOrder: q.sortOrder,
  };
}

export async function myPage(params: ModuleContentQuery = {}): Promise<PageResult<ModuleContentItem>> {
  const res = await contentClient('/module/content/list', { params: toBackendParams(params) });
  return normalizeLegacyPageResponse(res.data as any);
}

export async function getById(id: number): Promise<{ code: number; data: ModuleContentItem }> {
  return contentClient(`/module/content/${id}`, { method: 'GET' }) as any;
}

export async function updateShare(params: ModuleContentItem) {
  return contentClient('/module/content', { method: 'POST', data: params });
}

// 批量删除:后端 /module/content/{id} 一次只接受单个 id,前端循环逐个删。
// 错误时 Promise.all 不中断,先成功的标 done,失败的 throw 最后一笔错误。
// 用户勾选 N 条 → handleBatchDelete → await Promise.all(remove(...)) → N 次 DELETE。
export async function remove(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const results = await Promise.allSettled(
    ids.map((id) => contentClient(`/module/content/${id}`, { method: 'DELETE' })),
  );
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length === results.length) {
    // 全失败:抛错让 UI 显示
    throw (failed[0] as PromiseRejectedResult).reason;
  }
  // 部分失败:log 但不抛(否则一条失败会让前面成功的也回滚 UI)
  if (failed.length) {
    console.warn(`remove: ${failed.length}/${ids.length} 删除失败`, failed);
  }
}

export async function process(params: { ids: number[]; status?: string; moduleContentStatus?: string; moduleContentSearch?: boolean }) {
  return contentClient('/module/content/action', { method: 'POST', data: params });
}

export async function suggest(params: { title: string; contentType?: string }) {
  return contentClient('/module/content/suggest', { params });
}

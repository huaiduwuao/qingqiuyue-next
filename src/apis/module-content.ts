/**
 * module_content API。
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
import { normalizePageResponse } from '@/beans/pagination';

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
  // 下面这些后端 /module/content/list 一直在返回(internal/model/entity/module.go
  // 的 ModuleContentEntity),只是前端类型漏了声明,拿不到值。
  rating?: number;
  ratingCount?: number;
  releaseDate?: string;
  metadata?: string; // Doris 的 JSON 列,序列化成字符串下发
  publishTime?: string;
  publishAt?: string;
  accessScope?: string;
  genreCodes?: string;
  regionCode?: string;
  pubYear?: number;
}

export interface ModuleContentQuery extends PageParams {
  moduleId?: number | string;
  groupId?: number | string;
  contentType?: string;
  status?: string;
  source?: string;
  sourceLabel?: string;
  title?: string;
  /**
   * 排序字段,走后端白名单(未命中回退 id DESC,即"最新抓的在前")。
   * 取值:rating / rating_count / release_date / create_time / update_time /
   * read_num / COLLECT / relevance。
   *
   * relevance 按标题与 title 的相关性排(精确 > 前缀 > 其余),用于"我知道要
   * 找哪条,帮我精确定位"的场景 —— 补全页用它,否则同名作品的几十条新抓条目
   * 会把正主挤出返回窗口。
   */
  orderBy?: string;
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
    orderBy: q.orderBy,
  };
}

export async function myPage(params: ModuleContentQuery = {}): Promise<PageResult<ModuleContentItem>> {
  const res = await contentClient('/module/content/list', { params: toBackendParams(params) });
  return normalizePageResponse(res as any);
}

/**
 * 内容管理列表(发布台等):后端按当前用户的数据权限过滤 ——
 * 没配数据范围的只返回自己的内容(含待审/驳回/下架),持有 ALL 的返回全部。
 * 公开浏览(首页、分类、已爬取)用 myPage,不受数据权限影响。
 */
export async function managePage(params: ModuleContentQuery = {}): Promise<PageResult<ModuleContentItem>> {
  const res = await contentClient('/module/content/manage/page', { params: toBackendParams(params) });
  return normalizePageResponse(res as any);
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


export async function suggest(params: { title: string; contentType?: string }) {
  return contentClient('/module/content/suggest', { params });
}

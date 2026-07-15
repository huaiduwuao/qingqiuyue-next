import { accountClient } from '@/lib/api/client';
import type { PageParams, PageResult } from '@/beans/pagination';
import { normalizeLegacyPageResponse } from '@/hooks/usePagination';

/** 解开 axios 拦截器的包装层(返回真正的 body) */
function unwrap<T = any>(resp: any): T {
  if (!resp) return resp as T;
  const body = resp?.data ?? resp;
  if (body && typeof body === 'object' && 'code' in body && 'data' in body) {
    return body.data as T;
  }
  return body as T;
}

export interface WorksPageParams extends PageParams {
  contentType?: string;
  status?: string;
  source?: string;
}

export interface WorksItem {
  /** Core API serializes BIGINT IDs outside JavaScript's safe range as strings. */
  id: string | number;
  title: string;
  contentType: string;
  coverUrl: string;
  readNum: number;
  agreeNum: number;
  commentNum: number;
  status: string;
  source?: string;
  publishTime?: string;
}

export interface MonetizeSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  byType: Record<string, number>;
  recent30Days: number;
}

export interface InteractionItem {
  type: string;
  contentId: number;
  title?: string;
  userId: number;
  userName?: string;
  content?: string;
  time: string;
}

export interface ActivityItem {
  type: string;
  refId: string;
  title: string;
  time: string;
  remark?: string;
}

export async function getCreatorWorks(params?: WorksPageParams): Promise<PageResult<WorksItem>> {
  const res = await unwrap(await accountClient('/account/works', { params }));
  return normalizeLegacyPageResponse(res as any);
}

export async function getCreatorMonetizeSummary(): Promise<MonetizeSummary> {
  return unwrap(await accountClient('/account/monetize/summary'));
}

export async function getCreatorInteractions(params?: PageParams): Promise<PageResult<InteractionItem>> {
  const res = await unwrap(await accountClient('/account/interaction/comments', { params }));
  return normalizeLegacyPageResponse(res as any);
}

export async function getCreatorActivities(params?: PageParams): Promise<PageResult<ActivityItem>> {
  const res = await unwrap(await accountClient('/account/activity/list', { params }));
  return normalizeLegacyPageResponse(res as any);
}

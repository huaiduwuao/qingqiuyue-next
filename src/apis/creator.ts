import { accountClient } from '@/lib/api/client';

/** 解开 axios 拦截器的包装层(返回真正的 body) */
function unwrap<T = any>(resp: any): T {
  if (!resp) return resp as T;
  const body = resp?.data ?? resp;
  if (body && typeof body === 'object' && 'code' in body && 'data' in body) {
    return body.data as T;
  }
  return body as T;
}

export interface WorksPageParams {
  contentType?: string;
  status?: string;
  source?: string;
  page?: number;
  pageSize?: number;
}

export interface PageResponse<T> {
  records: T[];
  totalRow: number;
  total: number;
  list: T[];
  page: number;
  pageSize: number;
}

export interface WorksItem {
  id: number;
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

export async function getCreatorWorks(params?: WorksPageParams): Promise<PageResponse<WorksItem>> {
  return unwrap(await accountClient('/account/works', { params }));
}

export async function getCreatorMonetizeSummary(): Promise<MonetizeSummary> {
  return unwrap(await accountClient('/account/monetize/summary'));
}

export async function getCreatorInteractions(params?: { page?: number; pageSize?: number }): Promise<PageResponse<InteractionItem>> {
  return unwrap(await accountClient('/account/interaction/comments', { params }));
}

export async function getCreatorActivities(params?: { page?: number; pageSize?: number }): Promise<PageResponse<ActivityItem>> {
  return unwrap(await accountClient('/account/activity/list', { params }));
}

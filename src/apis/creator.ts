import { accountClient } from '@/lib/api/client';

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

export function getCreatorWorks(params?: WorksPageParams) {
  return accountClient<PageResponse<WorksItem>>('/account/works', {
    params,
  });
}

export function getCreatorMonetizeSummary() {
  return accountClient<MonetizeSummary>('/account/monetize/summary');
}

export function getCreatorInteractions(params?: { page?: number; pageSize?: number }) {
  return accountClient<PageResponse<InteractionItem>>('/account/interaction/comments', {
    params,
  });
}

export function getCreatorActivities(params?: { page?: number; pageSize?: number }) {
  return accountClient<PageResponse<ActivityItem>>('/account/activity/list', {
    params,
  });
}

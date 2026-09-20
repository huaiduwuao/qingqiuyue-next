import { contentClient } from '@/lib/api/client';

/**
 * admin-works —— 后台「作品管理」全量内容列表。
 * 走 content-api 的 /module/content/manage/page:按当前管理员的数据权限返回
 * 全站(持有 ALL)或范围内作品,含待审/下架/已发布全状态。
 */

export interface AdminWork {
  id: number | string;
  title: string;
  subtitle?: string;
  contentType?: string;
  coverUrl?: string;
  status?: string;
  author?: string;
  userId?: number;
  source?: string;
  sourceLabel?: string;
  readNum?: number;
  agreeNum?: number;
  collectNum?: number;
  commentNum?: number;
  rating?: number;
  publishTime?: string;
  content?: string;
}

export interface AdminWorkQuery {
  page?: number;
  pageSize?: number;
  contentType?: string;
  status?: string;
  title?: string;
  source?: string;
}

export interface AdminWorkPage {
  list: AdminWork[];
  total: number;
}

/** 拉取后台作品分页。响应可能是 {records,totalRow} 或 {list,total},统一归一。 */
export async function fetchAdminWorks(params: AdminWorkQuery): Promise<AdminWorkPage> {
  const res = await contentClient<{
    records?: AdminWork[];
    list?: AdminWork[];
    total?: number;
    totalRow?: number;
  }>('/module/content/manage/page', { method: 'GET', params });
  const d = res;
  const list = (d?.records as AdminWork[]) ?? (d?.list as AdminWork[]) ?? [];
  const total = Number(d?.totalRow ?? d?.total ?? list.length);
  return { list, total };
}

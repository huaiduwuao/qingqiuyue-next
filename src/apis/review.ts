import { adminClient } from '@/lib/api/client';
import type { PageParams, PageResult } from '@/beans/pagination';
import { normalizeLegacyPageResponse } from '@/hooks/usePagination';
import type { EntityId } from '@/lib/id';

// 审核请求结构
export interface ReviewRequest {
  id: number;
  contentId: number;
  contentType: string;
  userId: number;
  title: string;
  coverUrl: string;
  status: 'pending' | 'approved' | 'rejected' | 'revise_requested' | 'resubmit';
  priority: number;
  reason: string;
  reviewerId?: number;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewStats {
  totalRequests: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  todayCount: number;
  avgReviewTime: number;
}

// 提交内容审核
export async function submitReview(params: {
  /** 内容 id 超 2^53,按字符串原样传(后端 jsonfix.Int64) */
  contentId: EntityId;
  contentType: string;
  title?: string;
  coverUrl?: string;
  priority?: number;
  /** 被驳回后重新提交(申诉)时给审核员的说明 */
  reason?: string;
}): Promise<{ id: number; status: string }> {
  const res = await adminClient('/review/submit', { method: 'POST', data: params });
  return res?.data ?? res;
}

// 获取待审队列
export async function getReviewQueue(params?: PageParams & {
  status?: string;
  contentType?: string;
}): Promise<PageResult<ReviewRequest>> {
  const res = await adminClient('/review/queue', { params });
  return normalizeLegacyPageResponse((res as any)?.data ?? res);
}

// 审核内容
export async function doReview(params: {
  id: number;
  action: 'approve' | 'reject' | 'revise';
  note?: string;
  categoryId?: number;
  categoryName?: string;
}): Promise<void> {
  await adminClient(`/review/${params.id}/review`, {
    method: 'POST',
    data: {
      action: params.action,
      note: params.note,
      categoryId: params.categoryId,
      categoryName: params.categoryName,
    },
  });
}

// 获取我的审核记录
export async function getMyReviews(params?: PageParams): Promise<PageResult<ReviewRequest>> {
  const res = await adminClient('/review/my', { params });
  return normalizeLegacyPageResponse((res as any)?.data ?? res);
}

// 获取审核统计
export async function getReviewStats(): Promise<ReviewStats> {
  const res = await adminClient('/review/stats');
  return res?.data ?? res;
}


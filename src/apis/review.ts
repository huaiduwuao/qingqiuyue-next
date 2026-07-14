import { adminClient } from '@/lib/api/client';

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

export interface ReviewLog {
  id: number;
  requestId: number;
  reviewerId: number;
  reviewerName: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  note: string;
  categoryId?: number;
  categoryName?: string;
  createdAt: string;
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
  contentId: number;
  contentType: string;
  title?: string;
  coverUrl?: string;
  priority?: number;
}): Promise<{ id: number; status: string }> {
  const res = await adminClient('/review/submit', { method: 'POST', data: params });
  return res?.data ?? res;
}

// 获取待审队列
export async function getReviewQueue(params: {
  page?: number;
  pageSize?: number;
  status?: string;
  contentType?: string;
}): Promise<{ records: ReviewRequest[]; totalRow: number; page: number; pageSize: number }> {
  const res = await adminClient('/review/queue', { params });
  return res?.data ?? res;
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
export async function getMyReviews(params: {
  page?: number;
  pageSize?: number;
}): Promise<{ records: ReviewRequest[]; totalRow: number; page: number; pageSize: number }> {
  const res = await adminClient('/review/my', { params });
  return res?.data ?? res;
}

// 获取审核统计
export async function getReviewStats(): Promise<ReviewStats> {
  const res = await adminClient('/review/stats');
  return res?.data ?? res;
}

// 获取审核日志
export async function getReviewLogs(requestId: number): Promise<ReviewLog[]> {
  const res = await adminClient(`/review/${requestId}/logs`);
  return res?.data ?? res ?? [];
}

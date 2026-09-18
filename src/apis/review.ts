import { adminClient } from '@/lib/api/client';
import type { PageParams, PageResult } from '@/beans/pagination';
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
  return adminClient<{ id: number; status: string }>('/review/submit', { method: 'POST', data: params });
}

// 获取待审队列
export async function getReviewQueue(params?: PageParams & {
  status?: string;
  contentType?: string;
}): Promise<PageResult<ReviewRequest>> {
  return adminClient<PageResult<ReviewRequest>>('/review/queue', { params });
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
  return adminClient<PageResult<ReviewRequest>>('/review/my', { params });
}

// 获取审核统计
export async function getReviewStats(): Promise<ReviewStats> {
  return adminClient<ReviewStats>('/review/stats');
}

// ─── B1:定时发布 ───
// 后端 internal/handler/creator_dashboard_write.go 的 ScheduleContent 接口。
// 传 publishAt 为毫秒时间戳;空/<=现在 视为立即发布(等价 /publish)。
export async function scheduleContent(contentId: EntityId, publishAt: number): Promise<{ ok: boolean; publishAt: number }> {
  return adminClient<{ ok: boolean; publishAt: number }>(`/account/content/${contentId}/schedule`, {
    method: 'POST',
    data: { publishAt },
  });
}


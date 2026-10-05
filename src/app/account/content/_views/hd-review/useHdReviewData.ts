'use client';

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getHdVideoList } from '@/apis/dashboard';
import { doReview, getMyReviews, getReviewQueue, type ReviewRequest } from '@/apis/review';
import type { ReviewerDecision } from '../hd-publish/data';
import { dedupeHdVideos } from '../hd-publish/hdPublishModel';
import { useOptimisticOverlay } from '../hd-publish/useOptimisticOverlay';
import { applyVerdict, mergeReviewVideos, myReviewsToVideos, queueToVideos } from './hdReviewModel';

export const REVIEW_QUEUE_QUERY_KEY = ['review-queue', 'pending'] as const;
export const MY_REVIEWS_QUERY_KEY = ['review-queue', 'mine'] as const;
const HD_VIDEOS_QUERY_KEY = ['creator-hd-videos'] as const;

/**
 * 审核员工作台的视频列表:待审队列(pending + resubmit)+ 我审过的(/review/my)+ 自己的 HD 视频,
 * 每次都由服务端数据现算,提交结论是叠在上面的乐观改动(useOptimisticOverlay):
 * 先把这条挪到「已审核」,失败撤回;成功后等队列和我的记录都重拉到再以服务端为准。
 *
 * 此前本地 state 只在队列里出现新 id 时才并进来:别的审核员处理掉、作者撤回的审核单一直挂在
 * 待审里;「已审核」和今日统计只记本次会话里自己点过的,刷新就清零;HD 视频列表只在首次渲染
 * 拷一次,之后再也不同步。
 */
export function useHdReviewVideos(reviewerId: string, setSnack: (msg: string) => void) {
  const hdQuery = useQuery({
    queryKey: HD_VIDEOS_QUERY_KEY,
    queryFn: () => getHdVideoList({ page: 1, pageSize: 50 }),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  });
  // 待审队列来自审核系统(content_review_request,仅内容运营可见)
  const queueQuery = useQuery({
    queryKey: REVIEW_QUEUE_QUERY_KEY,
    queryFn: async () => {
      // 新提交(pending)与作者修改后重新提交(resubmit)的审核单都需要处理
      const [pending, resubmit] = await Promise.all([
        getReviewQueue({ status: 'pending', pageSize: 100 }),
        getReviewQueue({ status: 'resubmit', pageSize: 100 }),
      ]);
      return [...(resubmit.list ?? []), ...(pending.list ?? [])] as ReviewRequest[];
    },
    staleTime: 30_000,
    refetchOnMount: 'always',
  });
  // 我处理过的审核单:「已审核」列表和今日统计的来源
  const mineQuery = useQuery({
    queryKey: MY_REVIEWS_QUERY_KEY,
    queryFn: async () => ((await getMyReviews({ page: 1, pageSize: 100 })).list ?? []) as ReviewRequest[],
    staleTime: 30_000,
    refetchOnMount: 'always',
  });

  const queue = queueQuery.data;
  const mine = mineQuery.data;
  const hdList = hdQuery.data?.list;
  const serverVideos = useMemo(
    () => mergeReviewVideos(queueToVideos(queue, reviewerId), myReviewsToVideos(mine, reviewerId), dedupeHdVideos(hdList)),
    [queue, mine, hdList, reviewerId],
  );
  // 内容 id → 审核单 id,提交结论时用
  const reviewIdByContent = useMemo(() => new Map((queue ?? []).map((r) => [String(r.contentId), r.id])), [queue]);

  const { overlay, runOptimistic } = useOptimisticOverlay(
    [
      { key: REVIEW_QUEUE_QUERY_KEY, query: queueQuery },
      { key: MY_REVIEWS_QUERY_KEY, query: mineQuery },
    ],
    setSnack,
  );
  const videos = useMemo(() => overlay(serverVideos), [overlay, serverVideos]);

  /**
   * 提交审核结论:通过 → 内容上线,驳回 → 内容标记为未通过,要求修改 → 退回作者。
   * 返回是否成功;没有待处理的审核单时不发请求。
   */
  const submitVerdict = useCallback(
    async (opts: { videoId: string; title: string; decision: ReviewerDecision; note: string; categoryName?: string }) => {
      const { videoId, title, decision, note, categoryName } = opts;
      const reviewId = reviewIdByContent.get(videoId);
      if (!reviewId) {
        setSnack('这条内容没有待处理的审核单');
        return false;
      }
      const completedAt = Date.now();
      return runOptimistic(
        { kind: 'update', videoId, apply: (v) => applyVerdict(v, decision, note, reviewerId, completedAt) },
        () =>
          doReview({
            id: reviewId,
            action: decision === 'pass' ? 'approve' : decision === 'reject' ? 'reject' : 'revise',
            note,
            categoryName,
          }),
        decision === 'pass'
          ? `✅ 已通过《${title}》`
          : decision === 'reject'
            ? `⛔ 已驳回《${title}》`
            : '📝 已通知创作者补充材料',
        '提交审核结论失败',
      );
    },
    [reviewIdByContent, runOptimistic, reviewerId, setSnack],
  );

  return { videos, submitVerdict };
}

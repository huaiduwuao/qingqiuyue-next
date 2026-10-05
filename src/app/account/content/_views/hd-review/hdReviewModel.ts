// 审核员工作台的纯函数:审核单 → 页面用的 HdVideo(无 React 依赖)。
import type { ReviewRequest } from '@/apis/review';
import { gradient2 } from '@/constants/gradients';
import { REVIEW_CHECK_TEMPLATE, type HdVideo, type ReviewCheck, type ReviewerDecision } from '../hd-publish/data';

const APPEAL_WINDOW_MS = 7 * 86400000;

function toMs(t: string | undefined): number | undefined {
  if (!t) return undefined;
  const ms = new Date(t).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

function checksWith(manual: ReviewCheck['status'], message?: string): ReviewCheck[] {
  return REVIEW_CHECK_TEMPLATE.map((c) =>
    c.id === 'manual_review' ? { ...c, status: manual, message } : { ...c, status: 'pending' as const },
  );
}

function baseVideo(r: ReviewRequest): Omit<HdVideo, 'status'> {
  return {
    id: String(r.contentId),
    title: r.title || '(无标题)',
    cover: r.coverUrl || gradient2('#FE2C55', '#FFB400'),
    resolution: '1080P',
    fps: 30,
    hdr: false,
    duration: '00:00',
    sizeMB: 0,
    uploadedAt: toMs(r.createdAt) ?? 0,
    hasCover: !!r.coverUrl,
    subtitles: [],
    audioTracks: [{ id: 'a1', label: '原声', codec: 'AAC 320kbps', isDefault: true }],
  };
}

/** 待审队列(pending + resubmit)→ 审核中的视频,都算分给当前审核员。开始时间取审核单创建时间。 */
export function queueToVideos(queue: ReviewRequest[] | undefined, reviewerId: string): HdVideo[] {
  return (queue ?? []).map((r) => ({
    ...baseVideo(r),
    status: 'reviewing',
    review: {
      checks: checksWith('pending'),
      startedAt: toMs(r.createdAt),
      assignedReviewerId: reviewerId,
    },
  }));
}

const DECISION_BY_STATUS: Partial<Record<ReviewRequest['status'], ReviewerDecision>> = {
  approved: 'pass',
  rejected: 'reject',
  revise_requested: 'request_changes',
};

/**
 * 我处理过的审核单(/review/my)→ 已审核的视频:通过 = 已发布,驳回 / 要求修改 = 未通过;
 * 完成时间取审核单的更新时间。作者重新提交后又回到待审的(pending / resubmit)不算已审核。
 */
export function myReviewsToVideos(mine: ReviewRequest[] | undefined, reviewerId: string): HdVideo[] {
  const out: HdVideo[] = [];
  for (const r of mine ?? []) {
    const decision = DECISION_BY_STATUS[r.status];
    if (!decision) continue;
    const isPass = decision === 'pass';
    const completedAt = toMs(r.updatedAt) ?? toMs(r.createdAt) ?? 0;
    const note = r.reviewNote || r.reason || '';
    out.push({
      ...baseVideo(r),
      status: isPass ? 'published' : 'review_failed',
      failedStage: isPass ? undefined : 'review',
      publishedAt: isPass ? completedAt : undefined,
      review: {
        checks: checksWith(isPass ? 'passed' : 'failed', note || undefined),
        startedAt: toMs(r.createdAt),
        completedAt,
        result: isPass ? 'pass' : 'reject',
        assignedReviewerId: reviewerId,
        reviewerVerdict: {
          decision,
          note,
          reviewerId: r.reviewerId ? String(r.reviewerId) : reviewerId,
          timestamp: completedAt,
          appealable: decision === 'reject',
          appealDeadline: decision === 'reject' ? completedAt + APPEAL_WINDOW_MS : undefined,
        },
      },
    });
  }
  return out;
}

/**
 * 工作台列表 = 待审队列 + 我审过的 + 创作者自己的 HD 视频(从高清发布带 video 参数跳来时能选中),
 * 按内容 id 去重,前者优先:同一条重新提交后既在队列里又在我的记录里,以队列为准。
 */
export function mergeReviewVideos(...lists: HdVideo[][]): HdVideo[] {
  const seen = new Set<string>();
  const out: HdVideo[] = [];
  for (const list of lists) {
    for (const v of list) {
      if (seen.has(v.id)) continue;
      seen.add(v.id);
      out.push(v);
    }
  }
  return out;
}

/** 提交结论后视频的样子(乐观改动;服务端重拉到我的审核记录后以服务端为准)。 */
export function applyVerdict(
  v: HdVideo,
  decision: ReviewerDecision,
  note: string,
  reviewerId: string,
  completedAt: number,
): HdVideo {
  if (!v.review) return v;
  const isPass = decision === 'pass';
  return {
    ...v,
    status: isPass ? 'published' : 'review_failed',
    failedStage: isPass ? undefined : 'review',
    publishedAt: isPass ? completedAt : v.publishedAt,
    views: isPass ? 0 : v.views,
    likes: isPass ? 0 : v.likes,
    review: {
      ...v.review,
      completedAt,
      result: isPass ? 'pass' : 'reject',
      reviewerVerdict: {
        decision,
        note,
        reviewerId,
        timestamp: completedAt,
        appealable: decision === 'reject',
        appealDeadline: decision === 'reject' ? completedAt + APPEAL_WINDOW_MS : undefined,
      },
      checks: v.review.checks.map((c) =>
        c.id === 'manual_review' ? { ...c, status: isPass ? 'passed' : 'failed', message: note } : c,
      ),
    },
  };
}

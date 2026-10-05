import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReviewRequest } from '@/apis/review';
import {
  applyVerdict,
  machineRank,
  mergeReviewVideos,
  myReviewsToVideos,
  parseMachineCheck,
  queueToVideos,
} from './hdReviewModel';

const api = vi.hoisted(() => ({
  pending: [] as any[],
  resubmit: [] as any[],
  mine: [] as any[],
  hd: [] as any[],
  doReview: vi.fn(),
}));

vi.mock('@/apis/review', () => ({
  getReviewQueue: vi.fn(async ({ status }: { status: string }) => ({
    list: (status === 'resubmit' ? api.resubmit : api.pending).map((r) => ({ ...r })),
  })),
  getMyReviews: vi.fn(async () => ({ list: api.mine.map((r) => ({ ...r })) })),
  doReview: (...a: unknown[]) => api.doReview(...a),
}));
vi.mock('@/apis/dashboard', () => ({
  getHdVideoList: vi.fn(async () => ({ list: api.hd.map((v) => ({ ...v })) })),
}));

import { useHdReviewVideos, REVIEW_QUEUE_QUERY_KEY } from './useHdReviewData';

const req = (id: number, contentId: string, status: ReviewRequest['status'], over: Partial<ReviewRequest> = {}) =>
  ({
    id,
    contentId,
    contentType: 'VIDEO',
    userId: 9,
    title: `内容${contentId}`,
    coverUrl: '',
    status,
    priority: 0,
    reason: '',
    createdAt: '2026-10-05T08:00:00Z',
    updatedAt: '2026-10-05T09:00:00Z',
    ...over,
  }) as unknown as ReviewRequest;

function deferred<T = unknown>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(reviewerId = '7') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const setSnack = vi.fn();
  const view = renderHook(() => useHdReviewVideos(reviewerId, setSnack), { wrapper });
  return { client, setSnack, ...view };
}

const byId = (videos: { id: string }[], id: string) => videos.find((v) => v.id === id) as any;

beforeEach(() => {
  api.pending = [];
  api.resubmit = [];
  api.mine = [];
  api.hd = [];
  api.doReview.mockReset();
});

describe('hdReviewModel', () => {
  it('队列 → 审核中且分给当前审核员,开始时间取审核单创建时间(不随渲染变)', () => {
    const [v] = queueToVideos([req(1, '100', 'pending')], '7');
    expect(v).toMatchObject({ id: '100', status: 'reviewing', review: { assignedReviewerId: '7' } });
    expect(v.review?.startedAt).toBe(new Date('2026-10-05T08:00:00Z').getTime());
  });

  it('我的审核记录 → 已审核;回到待审的不算', () => {
    const out = myReviewsToVideos(
      [
        req(1, '1', 'approved', { reviewNote: '好' }),
        req(2, '2', 'rejected', { reviewNote: '侵权' }),
        req(3, '3', 'revise_requested'),
        req(4, '4', 'resubmit'),
      ],
      '7',
    );
    expect(out.map((v) => [v.id, v.status, v.review?.result])).toEqual([
      ['1', 'published', 'pass'],
      ['2', 'review_failed', 'reject'],
      ['3', 'review_failed', 'reject'],
    ]);
    expect(out[1].review?.reviewerVerdict).toMatchObject({ decision: 'reject', note: '侵权', appealable: true });
    expect(out[2].review?.reviewerVerdict?.decision).toBe('request_changes');
    expect(out[0].review?.completedAt).toBe(new Date('2026-10-05T09:00:00Z').getTime());
  });

  it('机审结论:解析标签、落到 AI 初审一项,建议拦截排最前', () => {
    const [blocked, passed, unchecked] = queueToVideos(
      [
        req(1, '1', 'pending', {
          machineSuggestion: 'block',
          machineLabels: '["gamble","porn"]',
          machineReason: '封面违规',
          machineCheckedAt: '2026-10-05T08:00:05Z',
        }),
        req(2, '2', 'pending', { machineSuggestion: 'pass', machineLabels: '[]' }),
        req(3, '3', 'pending'),
      ],
      '7',
    );
    expect(blocked.review?.machine).toEqual({
      suggestion: 'block',
      labels: ['gamble', 'porn'],
      reason: '封面违规',
      checkedAt: new Date('2026-10-05T08:00:05Z').getTime(),
    });
    expect(blocked.review?.checks.find((c) => c.id === 'ai_content')).toMatchObject({
      status: 'failed',
      message: 'gamble、porn;封面违规',
    });
    expect(passed.review?.checks.find((c) => c.id === 'ai_content')?.status).toBe('passed');
    expect(unchecked.review?.machine).toBeUndefined();
    expect(unchecked.review?.checks.find((c) => c.id === 'ai_content')?.status).toBe('pending');
    expect([unchecked, passed, blocked].sort((a, b) => machineRank(a) - machineRank(b))[0].id).toBe('1');
  });

  it('机审列坏数据:不认识的结论当没有,标签不是 JSON 数组就当空', () => {
    expect(parseMachineCheck(req(1, '1', 'pending', { machineSuggestion: 'weird' as never }))).toBeUndefined();
    expect(parseMachineCheck(req(1, '1', 'pending', { machineSuggestion: 'review', machineLabels: 'oops' }))?.labels).toEqual([]);
    expect(parseMachineCheck(req(1, '1', 'pending', { machineSuggestion: 'review', machineLabels: '{"a":1}' }))?.labels).toEqual([]);
  });

  it('合并时前面的来源优先(重新提交的以队列为准)', () => {
    const merged = mergeReviewVideos(
      queueToVideos([req(1, '5', 'resubmit')], '7'),
      myReviewsToVideos([req(2, '5', 'rejected')], '7'),
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe('reviewing');
  });

  it('applyVerdict 只改人工复审这一项并记结论', () => {
    const [v] = queueToVideos([req(1, '1', 'pending')], '7');
    const out = applyVerdict(v, 'reject', '违规', '7', 1000);
    expect(out).toMatchObject({ status: 'review_failed', failedStage: 'review', review: { completedAt: 1000, result: 'reject' } });
    expect(out.review?.checks.find((c) => c.id === 'manual_review')).toMatchObject({ status: 'failed', message: '违规' });
    expect(out.review?.checks.filter((c) => c.status === 'pending')).toHaveLength(5);
  });
});

describe('useHdReviewVideos', () => {
  it('服务端队列变了(条数不变)列表跟着刷新', async () => {
    api.pending = [req(1, '1', 'pending', { title: '旧标题' })];
    const { client, result } = setup();
    await waitFor(() => expect(result.current.videos).toHaveLength(1));
    expect(byId(result.current.videos, '1').title).toBe('旧标题');

    // 别的审核员处理掉了 1,队列里换成 2:条数没变
    api.pending = [req(2, '2', 'pending')];
    await act(async () => {
      await client.invalidateQueries({ queryKey: REVIEW_QUEUE_QUERY_KEY });
    });
    await waitFor(() => expect(result.current.videos.map((v) => v.id)).toEqual(['2']));
  });

  it('提交结论:进行中先挪到已审核,重拉到的旧队列冲不掉;成功后以我的审核记录为准', async () => {
    api.pending = [req(11, '1', 'pending')];
    const { client, result, setSnack } = setup();
    await waitFor(() => expect(result.current.videos).toHaveLength(1));

    const d = deferred();
    api.doReview.mockReturnValue(d.promise);
    let pending!: Promise<boolean>;
    act(() => {
      pending = result.current.submitVerdict({ videoId: '1', title: '内容1', decision: 'pass', note: '好' });
    });
    expect(byId(result.current.videos, '1').status).toBe('published');

    await act(async () => {
      await client.invalidateQueries({ queryKey: REVIEW_QUEUE_QUERY_KEY });
    });
    expect(byId(result.current.videos, '1').status).toBe('published');

    api.pending = [];
    api.mine = [req(11, '1', 'approved', { reviewNote: '服务端备注' })];
    await act(async () => {
      d.resolve(undefined);
      await pending;
    });
    expect(api.doReview).toHaveBeenCalledWith({ id: 11, action: 'approve', note: '好', categoryName: undefined });
    expect(setSnack).toHaveBeenLastCalledWith('✅ 已通过《内容1》');
    await waitFor(() => expect(byId(result.current.videos, '1').review.reviewerVerdict.note).toBe('服务端备注'));
    expect(byId(result.current.videos, '1').status).toBe('published');
  });

  it('提交失败回滚到待审并提示', async () => {
    api.pending = [req(11, '1', 'pending')];
    const { result, setSnack } = setup();
    await waitFor(() => expect(result.current.videos).toHaveLength(1));

    api.doReview.mockRejectedValue(new Error('审核单已处理'));
    let ok = true;
    await act(async () => {
      ok = await result.current.submitVerdict({ videoId: '1', title: '内容1', decision: 'reject', note: '违规' });
    });
    expect(ok).toBe(false);
    expect(byId(result.current.videos, '1').status).toBe('reviewing');
    expect(setSnack).toHaveBeenLastCalledWith('提交审核结论失败:审核单已处理');
  });

  it('没有待处理审核单的内容不发请求', async () => {
    api.hd = [{ id: '50', title: '我的视频', status: 'REVIEWING', uploadedAt: 1 }];
    const { result, setSnack } = setup();
    await waitFor(() => expect(byId(result.current.videos, '50')?.status).toBe('reviewing'));
    let ok = true;
    await act(async () => {
      ok = await result.current.submitVerdict({ videoId: '50', title: '我的视频', decision: 'pass', note: '' });
    });
    expect(ok).toBe(false);
    expect(api.doReview).not.toHaveBeenCalled();
    expect(setSnack).toHaveBeenLastCalledWith('这条内容没有待处理的审核单');
  });
});

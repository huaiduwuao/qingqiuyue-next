import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { computeHdStats } from './hdPublishModel';

const api = vi.hoisted(() => ({
  hdList: [] as any[],
  manageList: [] as any[],
  del: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@/apis/dashboard', () => ({
  getHdVideoList: vi.fn(async () => ({ list: api.hdList.map((v) => ({ ...v })), total: api.hdList.length })),
}));
vi.mock('@/apis/module-content', () => ({
  managePage: vi.fn(async () => ({ list: api.manageList.map((v) => ({ ...v })), total: api.manageList.length })),
  updateShare: vi.fn(),
  setContentCover: vi.fn(),
}));
vi.mock('@/lib/api/client', () => ({
  accountClient: { delete: (...a: unknown[]) => api.del(...a), post: (...a: unknown[]) => api.post(...a) },
  formatApiError: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

import { useHdVideos, HD_VIDEOS_QUERY_KEY } from './useHdPublishData';

const hd = (id: string, status: string, over: Record<string, unknown> = {}) => ({
  id,
  title: `视频${id}`,
  cover: '',
  resolution: '4K',
  fps: 30,
  hdr: false,
  duration: '',
  sizeMB: 0,
  status,
  uploadedAt: Date.now(),
  hasCover: false,
  ...over,
});

function deferred<T = unknown>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const setSnack = vi.fn();
  const view = renderHook(() => useHdVideos(setSnack), { wrapper });
  return { client, setSnack, ...view };
}

const statusOf = (videos: { id: string; status: string }[], id: string) => videos.find((v) => v.id === id)?.status;

beforeEach(() => {
  api.hdList = [];
  api.manageList = [];
  api.del.mockReset();
  api.post.mockReset();
});

describe('useHdVideos', () => {
  it('服务端状态变了、条数没变时列表和统计跟着刷新', async () => {
    api.hdList = [hd('1', 'transcoding'), hd('2', 'REVIEWING')];
    const { client, result } = setup();
    await waitFor(() => expect(result.current.videos).toHaveLength(2));
    expect(statusOf(result.current.videos, '1')).toBe('transcoding');
    // 库里的原始大写状态归到 HD 流程状态
    expect(statusOf(result.current.videos, '2')).toBe('reviewing');
    expect(computeHdStats(result.current.videos, 5).transcoding).toBe(1);

    api.hdList = [hd('1', 'REVIEWING'), hd('2', 'REJECTED')];
    await act(async () => {
      await client.invalidateQueries({ queryKey: HD_VIDEOS_QUERY_KEY });
    });
    await waitFor(() => expect(statusOf(result.current.videos, '1')).toBe('reviewing'));
    expect(result.current.videos).toHaveLength(2);
    expect(statusOf(result.current.videos, '2')).toBe('review_failed');
    expect(computeHdStats(result.current.videos, 5).transcoding).toBe(0);
  });

  it('管理列表的 VIDEO 并进来,HD 接口已有的 id 以 HD 接口为准', async () => {
    api.hdList = [hd('1', 'REVIEWING', { title: 'HD 版' })];
    api.manageList = [
      { id: '1', title: '管理列表版', status: 'REVIEWING' },
      { id: '9', title: '已上线', status: 'PUBLISH' },
    ];
    const { result } = setup();
    await waitFor(() => expect(result.current.videos).toHaveLength(2));
    expect(result.current.videos.find((v) => v.id === '1')?.title).toBe('HD 版');
    expect(statusOf(result.current.videos, '9')).toBe('published');
  });

  it('进行中的乐观删除不会被重新拉到的旧数据冲掉,确认后以服务端为准', async () => {
    api.hdList = [hd('1', 'failed'), hd('2', 'REVIEWING')];
    const { client, result } = setup();
    await waitFor(() => expect(result.current.videos).toHaveLength(2));

    const req = deferred();
    api.del.mockReturnValue(req.promise);
    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.handleDelete('1');
    });
    expect(result.current.videos.map((v) => v.id)).toEqual(['2']);

    // 请求还没回来时服务端数据刷新(仍带着 1,且 2 的状态变了):删除不被冲掉,2 的新状态照常显示
    api.hdList = [hd('1', 'failed'), hd('2', 'REJECTED')];
    await act(async () => {
      await client.invalidateQueries({ queryKey: HD_VIDEOS_QUERY_KEY });
    });
    await waitFor(() => expect(statusOf(result.current.videos, '2')).toBe('review_failed'));
    expect(result.current.videos.map((v) => v.id)).toEqual(['2']);

    // 删除成功、服务端也删掉了
    api.hdList = [hd('2', 'REJECTED')];
    await act(async () => {
      req.resolve({});
      await pending;
    });
    await waitFor(() => expect(api.del).toHaveBeenCalledWith('/account/content/1'));
    expect(result.current.videos.map((v) => v.id)).toEqual(['2']);
  });

  it('确认后的乐观改动在服务端刷新后让位给服务端数据', async () => {
    api.hdList = [hd('1', 'failed')];
    const { result } = setup();
    await waitFor(() => expect(statusOf(result.current.videos, '1')).toBe('failed'));

    api.post.mockResolvedValue({});
    // 服务端收到重新转码后,转码已经跑完进了审核
    api.hdList = [hd('1', 'REVIEWING')];
    await act(async () => {
      await result.current.handleRetry('1');
    });
    await waitFor(() => expect(statusOf(result.current.videos, '1')).toBe('reviewing'));
  });

  it('请求失败时回滚到服务端的真实状态并提示', async () => {
    api.hdList = [hd('1', 'failed'), hd('2', 'review_failed')];
    const { result, setSnack } = setup();
    await waitFor(() => expect(result.current.videos).toHaveLength(2));

    const req = deferred();
    api.post.mockReturnValue(req.promise);
    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.handleRetry('1');
    });
    expect(statusOf(result.current.videos, '1')).toBe('transcoding');
    await act(async () => {
      req.reject(new Error('网络错误'));
      await pending;
    });
    expect(statusOf(result.current.videos, '1')).toBe('failed');
    expect(setSnack).toHaveBeenLastCalledWith('重新转码失败:网络错误');

    // 删除失败:条目回来
    api.del.mockRejectedValue(new Error('无权操作此内容'));
    await act(async () => {
      await result.current.handleDelete('2');
    });
    expect(result.current.videos.map((v) => v.id).sort()).toEqual(['1', '2']);
    expect(setSnack).toHaveBeenLastCalledWith('删除失败:无权操作此内容');
  });

  it('重新送审失败回滚,极速通道失败退回次数', async () => {
    api.hdList = [hd('1', 'review_failed')];
    const { result } = setup();
    await waitFor(() => expect(result.current.videos).toHaveLength(1));

    api.post.mockRejectedValue(new Error('boom'));
    await act(async () => {
      await result.current.handleResubmitReview('1');
    });
    expect(statusOf(result.current.videos, '1')).toBe('review_failed');

    const before = result.current.fastChannelQuota;
    await act(async () => {
      await result.current.handleFastTrackReview('1');
    });
    expect(result.current.fastChannelQuota).toBe(before);
  });

  it('新上传的视频先显示,服务端列表拉到同 id 后不重复', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.videos).toEqual([]));
    api.hdList = [hd('77', 'REVIEWING')];
    act(() => {
      result.current.addVideo({ ...hd('77', 'transcoding'), subtitles: [], audioTracks: [] } as any);
    });
    expect(result.current.videos.map((v) => v.id)).toEqual(['77']);
    await waitFor(() => expect(statusOf(result.current.videos, '77')).toBe('reviewing'));
    expect(result.current.videos).toHaveLength(1);
  });
});

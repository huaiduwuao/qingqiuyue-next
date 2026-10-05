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
  setCover: vi.fn(),
}));

vi.mock('@/apis/dashboard', () => ({
  getHdVideoList: vi.fn(async () => ({ list: api.hdList.map((v) => ({ ...v })), total: api.hdList.length })),
}));
vi.mock('@/apis/module-content', () => ({
  managePage: vi.fn(async () => ({ list: api.manageList.map((v) => ({ ...v })), total: api.manageList.length })),
  updateShare: vi.fn(),
  setContentCover: (...a: unknown[]) => api.setCover(...a),
}));
vi.mock('@/lib/api/client', () => ({
  accountClient: {
    delete: (...a: unknown[]) => api.del(...a),
    post: (...a: unknown[]) => api.post(...a),
    get: async () => ({ limit: 10, used: 0, remaining: 10 }),
  },
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
  api.setCover.mockReset();
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

  it('换封面:上传图片后调后端保存,成功提示;服务端刷新后用服务端的封面', async () => {
    api.hdList = [hd('1', 'PUBLISH', { cover: 'https://old/c.jpg', hasCover: true })];
    const { result, setSnack } = setup();
    await waitFor(() => expect(result.current.videos).toHaveLength(1));

    api.post.mockResolvedValue({ url: 'https://cdn/new.jpg' });
    api.setCover.mockResolvedValue({ id: '1', coverUrl: 'https://cdn/new.jpg', status: 'REVIEWING' });
    api.hdList = [hd('1', 'REVIEWING', { cover: 'https://cdn/new.jpg', hasCover: true })];
    let ok = false;
    await act(async () => {
      ok = await result.current.saveCover('1', new Blob(['x'], { type: 'image/jpeg' }), 'f.jpg');
    });
    expect(ok).toBe(true);
    expect(api.post).toHaveBeenCalledWith('/file/upload', expect.any(FormData), expect.anything());
    expect(api.setCover).toHaveBeenCalledWith('1', 'https://cdn/new.jpg');
    expect(setSnack).toHaveBeenLastCalledWith('封面已保存,视频重新进入审核');
    await waitFor(() => expect(statusOf(result.current.videos, '1')).toBe('reviewing'));
    expect(result.current.videos[0].cover).toBe('https://cdn/new.jpg');
  });

  it('换封面保存中先显示新封面,失败换回原封面并提示', async () => {
    api.hdList = [hd('1', 'REVIEWING', { cover: 'https://old/c.jpg', hasCover: true })];
    const { result, setSnack } = setup();
    await waitFor(() => expect(result.current.videos).toHaveLength(1));

    const req = deferred();
    api.setCover.mockReturnValue(req.promise);
    let pending!: Promise<boolean>;
    act(() => {
      pending = result.current.handleSetCover('1', 'https://cdn/new.jpg');
    });
    expect(result.current.videos[0].cover).toBe('https://cdn/new.jpg');
    await act(async () => {
      req.reject(new Error('只能修改自己的内容'));
      await pending;
    });
    expect(result.current.videos[0].cover).toBe('https://old/c.jpg');
    expect(setSnack).toHaveBeenLastCalledWith('封面保存失败:只能修改自己的内容');
  });

  it('封面图片上传失败或没返回地址时不调保存接口', async () => {
    api.hdList = [hd('1', 'REVIEWING')];
    const { result, setSnack } = setup();
    await waitFor(() => expect(result.current.videos).toHaveLength(1));

    api.post.mockRejectedValueOnce(new Error('文件过大'));
    let ok = true;
    await act(async () => {
      ok = await result.current.saveCover('1', new Blob(['x']), 'f.jpg');
    });
    expect(ok).toBe(false);
    expect(setSnack).toHaveBeenLastCalledWith({ msg: '封面上传失败:文件过大', severity: 'error' });

    api.post.mockResolvedValueOnce({});
    await act(async () => {
      ok = await result.current.saveCover('1', new Blob(['x']), 'f.jpg');
    });
    expect(ok).toBe(false);
    expect(api.setCover).not.toHaveBeenCalled();
  });
});

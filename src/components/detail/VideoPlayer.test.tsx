/**
 * VideoPlayer 规则解析模式的回归测试。
 *
 * 2026-09-26 用户报「只有声音、看不到画面」:规则解析模式不设 src / streams,hasVideo 判成 false,
 * 渲染的是封面图,<video> 从没挂进页面,但它照样在后台出声。这里锁住:解析完成后 <video> 在 DOM 里、
 * 地址已挂上;第一次失败静默重解析一次,第二次才出重试界面。
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveStream = vi.fn();

vi.mock('@/lib/localStream/engine', () => ({
  canResolveLocally: (url: string) => /bilibili\.com\/video\//.test(url),
  resolveStream: (...args: unknown[]) => resolveStream(...args),
}));
vi.mock('@/lib/localStream/rules', () => ({
  loadRules: async () => ({ schema: 1, version: 'test', providers: [] }),
  matchProvider: () => ({ rule: { label: '哔哩哔哩' }, groups: [] }),
}));
vi.mock('@/lib/clientDiag', () => ({ reportDiag: vi.fn() }));

import VideoPlayer from './VideoPlayer';

const PAGE = 'https://www.bilibili.com/video/BV1GJ411x7h7';
const MP4 = 'https://cn-jstz-cu-01-04.bilivideo.com/x.mp4?deadline=1';

beforeEach(() => {
  resolveStream.mockReset();
  // jsdom 没实现媒体播放
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: () => Promise.resolve() });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: () => {} });
  Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: () => {} });
});

describe('VideoPlayer · 规则解析模式', () => {
  it('解析完成后 <video> 挂在页面里并带上地址(不是只放声音的封面)', async () => {
    resolveStream.mockResolvedValue({ kind: 'progressive', provider: 'bilibili', duration: 213, urls: [MP4], mediaHeaders: {}, source: 'server' });
    const { container } = render(<VideoPlayer sourceUrl={PAGE} poster="https://i0.hdslb.com/cover.jpg" autoPlay />);
    await waitFor(() => {
      const v = container.querySelector('video');
      expect(v).not.toBeNull();
      expect(v!.getAttribute('src')).toBe(MP4);
    });
    expect(resolveStream).toHaveBeenCalledWith(PAGE, expect.objectContaining({ refresh: false }));
  });

  it('第一次失败静默强制重解析,第二次才给重试界面', async () => {
    resolveStream.mockRejectedValueOnce(new Error('bilibili/play: code=-404')).mockRejectedValueOnce(new Error('还是不行'));
    render(<VideoPlayer sourceUrl={PAGE} />);
    await waitFor(() => expect(resolveStream).toHaveBeenCalledTimes(2));
    expect(resolveStream.mock.calls[1][1]).toEqual(expect.objectContaining({ refresh: true }));
    expect(await screen.findByText('这条视频暂时没能加载出来')).toBeInTheDocument();
    expect(screen.getByText('还是不行')).toBeInTheDocument();

    resolveStream.mockResolvedValue({ kind: 'progressive', provider: 'bilibili', duration: 1, urls: [MP4], mediaHeaders: {}, source: 'server' });
    await act(async () => screen.getByText('重试').click());
    await waitFor(() => expect(resolveStream).toHaveBeenCalledTimes(3));
  });
});

/**
 * 登记片源的地区限制(StreamInfo.region)开播前就挂在画面上:
 * 2026-10-04 用户反馈「需要 VPN / 只有国内能看」只在播放失败后才说,平时根本看不到。
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const parseStream = vi.fn();

vi.mock('@/apis/stream', () => ({
  parseStream: (...args: unknown[]) => parseStream(...args),
  checkStreamAccess: async () => ({ direct: true, verdict: 'direct', answered: true }),
  BANDWIDTH_NOTICE: '',
}));
vi.mock('@/lib/localStream/engine', () => ({
  canResolveLocally: () => false,
  resolveStream: vi.fn(),
  webCannotFetchMedia: () => false,
}));
vi.mock('@/lib/localStream/rules', () => ({
  loadRules: async () => ({ schema: 1, version: 'test', providers: [] }),
  matchProvider: () => null,
}));
vi.mock('@/lib/clientDiag', () => ({ reportDiag: vi.fn(), reportPlayFailure: vi.fn() }));

import VideoPlayer from './VideoPlayer';

function streamsWith(region: string) {
  const st = { quality: '原始', resolution: '', url: 'https://cdn.example.com/a.mp4', needPay: false, format: 'mp4', access: 'direct', region };
  return { data: { url: 'qqy-vs://615/1/1', platform: '欧乐影院', streams: [st], defaultStream: st } };
}

beforeEach(() => {
  parseStream.mockReset();
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: () => Promise.resolve() });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: () => {} });
  Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: () => {} });
});

describe('VideoPlayer · 片源地区提示', () => {
  it('overseas:提示国内要开 VPN', async () => {
    parseStream.mockResolvedValue(streamsWith('overseas'));
    render(<VideoPlayer sourceUrl="qqy-vs://615/1/1" />);
    expect(await screen.findByText('海外片源 · 国内需开 VPN 才能观看')).toBeInTheDocument();
  });

  it('mainland:提示只有国内网络能看', async () => {
    parseStream.mockResolvedValue(streamsWith('mainland'));
    render(<VideoPlayer sourceUrl="qqy-vs://620/1/1" />);
    expect(await screen.findByText('仅限国内网络观看 · 开着 VPN / 代理会放不了')).toBeInTheDocument();
  });

  it('不限地区的片源不挂提示', async () => {
    parseStream.mockResolvedValue(streamsWith(''));
    render(<VideoPlayer sourceUrl="qqy-vs://616/1/1" />);
    await vi.waitFor(() => expect(parseStream).toHaveBeenCalled());
    expect(screen.queryByText(/VPN/)).toBeNull();
  });
});

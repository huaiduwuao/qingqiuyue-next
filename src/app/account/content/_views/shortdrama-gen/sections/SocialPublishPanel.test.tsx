import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Episode } from '@/apis/shortdrama';

const api = vi.hoisted(() => ({ socialPost: vi.fn(), socialRefresh: vi.fn() }));
const share = vi.hoisted(() => ({ listAccounts: vi.fn() }));
const shareAccount = vi.hoisted(() => ({ platforms: vi.fn() }));

vi.mock('@/apis/shortdrama', async (orig) => ({
  ...(await orig<typeof import('@/apis/shortdrama')>()),
  dramaAPI: api,
}));
vi.mock('@/apis/share', () => share);
vi.mock('@/apis/share-account', () => shareAccount);

import SocialPublishPanel from './SocialPublishPanel';

const baseEpisode = {
  id: 11, project_id: 1, no: 2, title: '重逢',
  finals: { en: { url: 'https://x/qq-video/drama/1/ep2/en/final.mp4', duration: 58, width: 1080, height: 1920, at: '2026-10-05T10:00:00+08:00' } },
  distribution: {
    en: {
      youtube_shorts: {
        title: 'Reborn', caption: 'Hook', hashtags: [],
        posts: {
          '5': { platform: 'youtube_shorts', account_id: 5, account_name: '我的频道', lang: 'en', task_id: 9, status: 'success', remote_url: 'https://www.youtube.com/shorts/abc', privacy: 'private', notice: '清秋月的 YouTube API 项目还没通过审核', at: '2026-10-05T10:00:00+08:00' },
        },
      },
    },
  },
} as unknown as Episode;

function mount(ep: Episode, onChanged = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <SocialPublishPanel episode={ep} lang="en" langName="English" onChanged={onChanged} />
    </QueryClientProvider>,
  );
  return onChanged;
}

describe('SocialPublishPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    share.listAccounts.mockImplementation(async (p: string) =>
      p === 'youtube'
        ? [{ id: 5, platform: 'youtube', accountName: 'YT', authStatus: 1, platformUserNickname: '我的频道', clientKey: '', hasAccessToken: true }]
        : [
            { id: 6, platform: 'tiktok', accountName: 'TT', authStatus: 1, platformUserNickname: '', clientKey: '', hasAccessToken: true },
            { id: 7, platform: 'tiktok', accountName: '没授权', authStatus: 0, platformUserNickname: '', clientKey: '', hasAccessToken: false },
          ],
    );
    shareAccount.platforms.mockResolvedValue([
      { platform: 'youtube', builtinApp: true, privateOnly: false, redirectUri: '' },
      { platform: 'tiktok', builtinApp: true, privateOnly: true, redirectUri: '' },
    ]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => vi.useRealTimers());

  it('shows existing post records with privacy notice and link', async () => {
    mount(baseEpisode);
    expect(await screen.findByText('已发布')).toBeTruthy();
    expect(screen.getByText('私享')).toBeTruthy();
    expect(screen.getByText(/还没通过审核/)).toBeTruthy();
    expect(screen.getByRole('link', { name: '打开' }).getAttribute('href')).toBe('https://www.youtube.com/shorts/abc');
    // TikTok 应用审核中:提示只能仅自己可见、账号要私密
    expect(await screen.findByText(/TikTok 的清秋月应用还在审核中/)).toBeTruthy();
    // 没授权的账号不出现在可选列表里
    expect(screen.queryByText(/没授权/)).toBeNull();
  });

  it('publishes only on explicit click with the selected accounts and privacy', async () => {
    api.socialPost.mockResolvedValue({ created: 1, reused: 0, skipped: ['YouTube Shorts「YT」已经发过了'], errors: null, distribution: {} });
    const onChanged = mount(baseEpisode);
    await screen.findByText('TikTok · TT');
    expect(api.socialPost).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '发布到 YouTube / TikTok' }));
    await waitFor(() =>
      expect(api.socialPost).toHaveBeenCalledWith(11, {
        lang: 'en', platforms: ['youtube_shorts', 'tiktok'], account_ids: [5, 6], privacy: 'private', force: false,
      }),
    );
    expect(await screen.findByText(/已提交 1 个上传任务;YouTube Shorts「YT」已经发过了/)).toBeTruthy();
    expect(onChanged).toHaveBeenCalled();
  });

  it('cannot publish without a final cut', async () => {
    mount({ ...baseEpisode, finals: {} } as unknown as Episode);
    await screen.findByText('TikTok · TT');
    expect((screen.getByRole('button', { name: '发布到 YouTube / TikTok' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/还没有English版成片/)).toBeTruthy();
  });

  it('polls progress while an upload is in flight', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.socialRefresh.mockResolvedValue({ distribution: {} });
    const ep = JSON.parse(JSON.stringify(baseEpisode)) as Episode;
    const posts = ep.distribution!.en.youtube_shorts.posts!;
    posts['5'].status = 'uploading';
    const onChanged = mount(ep);
    expect(await screen.findByText('上传中')).toBeTruthy();
    await vi.advanceTimersByTimeAsync(5100);
    await waitFor(() => expect(api.socialRefresh).toHaveBeenCalledWith(11));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/apis/share', () => ({
  listAccounts: vi.fn(),
  createTask: vi.fn(),
}));
vi.mock('@/apis/share-account', async (orig) => ({
  ...(await orig<typeof import('@/apis/share-account')>()),
  platforms: vi.fn(),
}));

import { listAccounts, createTask } from '@/apis/share';
import { platforms } from '@/apis/share-account';
import ShareTaskDialog, { type ShareTaskPlatform } from './ShareTaskDialog';

const acc = (id: number, name: string, platform = 'douyin') => ({
  id, platform, accountName: name, clientKey: '', hasAccessToken: true, authStatus: 1, platformUserNickname: '',
});

function setup(open = true, platform: ShareTaskPlatform = 'douyin') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (o: boolean) => (
    <QueryClientProvider client={qc}>
      <ShareTaskDialog open={o} onClose={() => {}} platform={platform} contentType="video" contentId="7" defaultTitle="标题" />
    </QueryClientProvider>
  );
  const utils = render(ui(open));
  return { ...utils, setOpen: (o: boolean) => utils.rerender(ui(o)) };
}

describe('ShareTaskDialog 账号列表(react-query)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('关闭时不请求;打开后加载并默认选中第一个账号提交', async () => {
    vi.mocked(listAccounts).mockResolvedValue([acc(11, '账号A'), acc(12, '账号B')] as never);
    vi.mocked(createTask).mockResolvedValue({} as never);
    const { setOpen } = setup(false);
    expect(listAccounts).not.toHaveBeenCalled();
    setOpen(true);
    expect(await screen.findByText('账号A')).toBeInTheDocument();
    expect(listAccounts).toHaveBeenCalledWith('douyin');
    fireEvent.click(screen.getByRole('button', { name: /提交|发布|创建/ }));
    await waitFor(() => expect(createTask).toHaveBeenCalled());
    expect(vi.mocked(createTask).mock.calls[0][0]).toMatchObject({ socialAccountId: 11 });
  });

  it('加载失败显示错误', async () => {
    vi.mocked(listAccounts).mockRejectedValue(new Error('拉取失败了'));
    setup(true);
    expect(await screen.findByText('拉取失败了')).toBeInTheDocument();
  });
});

describe('ShareTaskDialog YouTube / TikTok', () => {
  beforeEach(() => vi.clearAllMocks());

  it('海外平台:不显示 video_id / 封面,带正文和可见性提交', async () => {
    vi.mocked(listAccounts).mockResolvedValue([acc(21, '我的频道', 'youtube')] as never);
    vi.mocked(platforms).mockResolvedValue([{ platform: 'youtube', builtinApp: true, privateOnly: false, redirectUri: '' }]);
    vi.mocked(createTask).mockResolvedValue({} as never);
    setup(true, 'youtube');
    expect(await screen.findByText('我的频道')).toBeInTheDocument();
    expect(listAccounts).toHaveBeenCalledWith('youtube');
    expect(screen.queryByText(/视频 ID/)).toBeNull();
    expect(screen.queryByText(/封面 URL/)).toBeNull();
    expect(screen.getByText('可见性')).toBeInTheDocument();
    // 可见性默认私享
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: '正文一段' } });
    fireEvent.click(screen.getByRole('button', { name: '立即发布' }));
    await waitFor(() => expect(createTask).toHaveBeenCalled());
    const arg = vi.mocked(createTask).mock.calls[0][0];
    expect(arg).toMatchObject({ socialAccountId: 21, description: '正文一段', privacy: 'private' });
    expect(arg).not.toHaveProperty('videoId');
    expect(arg).not.toHaveProperty('coverUrl');
  });

  it('应用审核中:提示只能仅自己可见,可见性锁成私享,定时仍可用', async () => {
    vi.mocked(listAccounts).mockResolvedValue([acc(31, 'TT', 'tiktok')] as never);
    vi.mocked(platforms).mockResolvedValue([{ platform: 'tiktok', builtinApp: true, privateOnly: true, redirectUri: '' }]);
    setup(true, 'tiktok');
    expect(await screen.findByText(/TikTok 应用还在审核中/)).toBeInTheDocument();
    expect(screen.getByText('应用审核通过前只能这样发')).toBeInTheDocument();
    expect(screen.getByText('仅自己可见')).toBeInTheDocument();
    expect(screen.getByLabelText('定时发布')).toBeInTheDocument();
  });
});

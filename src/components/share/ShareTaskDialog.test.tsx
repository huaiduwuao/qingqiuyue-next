import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/apis/share', () => ({
  listAccounts: vi.fn(),
  createTask: vi.fn(),
}));

import { listAccounts, createTask } from '@/apis/share';
import ShareTaskDialog from './ShareTaskDialog';

const acc = (id: number, name: string) => ({
  id, platform: 'douyin', accountName: name, clientKey: '', hasAccessToken: true, authStatus: 1, platformUserNickname: '',
});

function setup(open = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (o: boolean) => (
    <QueryClientProvider client={qc}>
      <ShareTaskDialog open={o} onClose={() => {}} platform="douyin" contentType="video" contentId="7" defaultTitle="标题" />
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

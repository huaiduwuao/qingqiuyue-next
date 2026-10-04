import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/apis/home', () => ({
  getComments: vi.fn(),
  sendComment: vi.fn(),
  commentAction: vi.fn(),
}));
vi.mock('@/components/common/UserAvatarLink', () => ({ UserAvatarLink: () => null }));
vi.mock('@/components/common/UserDecor', () => ({ UserNameDecor: ({ children }: { children?: React.ReactNode }) => <>{children}</> }));
vi.mock('@/components/community/UserLine', () => ({ BotBadge: () => null }));

import { getComments, sendComment, commentAction } from '@/apis/home';
import { DetailComments } from './DetailComments';

const c = (id: string, extra: Record<string, unknown> = {}) => ({ id, content: `评论${id}`, username: `u${id}`, agreeNum: 0, ...extra });

function setup(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
  return {
    ...utils,
    rerenderWith: (next: React.ReactElement) => utils.rerender(<QueryClientProvider client={qc}>{next}</QueryClientProvider>),
  };
}

describe('DetailComments(react-query)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('加载第一页并回报总数', async () => {
    vi.mocked(getComments).mockResolvedValue({ list: [c('1'), c('2')], total: 2, hasMore: false });
    const onTotal = vi.fn();
    setup(<DetailComments contentId="9" initialCount={5} onTotalChange={onTotal} />);
    expect(screen.getByText('评论 (5)')).toBeInTheDocument();
    expect(await screen.findByText('评论1')).toBeInTheDocument();
    expect(screen.getByText('评论 (2)')).toBeInTheDocument();
    expect(onTotal).toHaveBeenLastCalledWith(2);
    expect(getComments).toHaveBeenCalledWith('9', { page: 1, page_size: 20 });
  });

  it('换作品后旧作品的慢响应不覆盖新列表', async () => {
    let resolveOld!: (v: unknown) => void;
    vi.mocked(getComments).mockImplementation((id) =>
      id === 'old'
        ? (new Promise((r) => (resolveOld = r)) as never)
        : (Promise.resolve({ list: [c('n1')], total: 1, hasMore: false }) as never),
    );
    const { rerenderWith } = setup(<DetailComments contentId="old" />);
    rerenderWith(<DetailComments contentId="new" />);
    expect(await screen.findByText('评论n1')).toBeInTheDocument();
    resolveOld({ list: [c('o1')], total: 1, hasMore: false });
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByText('评论o1')).not.toBeInTheDocument();
    expect(screen.getByText('评论n1')).toBeInTheDocument();
  });

  it('点赞乐观更新,失败回滚', async () => {
    vi.mocked(getComments).mockResolvedValue({ list: [c('1', { agreeNum: 3 })], total: 1, hasMore: false });
    let reject!: (e: unknown) => void;
    vi.mocked(commentAction).mockReturnValue(new Promise((_, r) => (reject = r)) as never);
    setup(<DetailComments contentId="9" />);
    await screen.findByText('评论1');
    fireEvent.click(screen.getByTestId('ThumbUpOutlinedIcon').closest('button')!);
    expect(await screen.findByText('4')).toBeInTheDocument();
    expect(screen.getByTestId('ThumbUpIcon')).toBeInTheDocument();
    reject(new Error('炸了'));
    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(screen.getByTestId('ThumbUpOutlinedIcon')).toBeInTheDocument();
  });

  it('发评论后回到第一页重新拉取', async () => {
    vi.mocked(getComments)
      .mockResolvedValueOnce({ list: [c('1')], total: 1, hasMore: false })
      .mockResolvedValueOnce({ list: [c('2'), c('1')], total: 2, hasMore: false });
    vi.mocked(sendComment).mockResolvedValue({});
    setup(<DetailComments contentId="9" />);
    await screen.findByText('评论1');
    fireEvent.change(screen.getByPlaceholderText(/评论|说点/), { target: { value: '新的' } });
    fireEvent.click(screen.getByTestId('SendIcon').closest('button')!);
    await waitFor(() => expect(sendComment).toHaveBeenCalledWith({ contentId: '9', content: '新的' }));
    expect(await screen.findByText('评论2')).toBeInTheDocument();
    expect(screen.getByText('评论 (2)')).toBeInTheDocument();
  });

  it('紧凑模式打开弹窗前不请求', async () => {
    vi.mocked(getComments).mockResolvedValue({ list: [c('1')], total: 1, hasMore: false });
    setup(<DetailComments contentId="9" compact commentCount={7} />);
    expect(getComments).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('7'));
    expect(await screen.findByText('评论1')).toBeInTheDocument();
  });
});

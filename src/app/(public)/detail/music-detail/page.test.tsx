import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const nav = vi.hoisted(() => ({ id: '1' }));
const music = vi.hoisted(() => ({ resolveMusic: vi.fn() }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(`id=${nav.id}`),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/detail/music-detail',
}));
vi.mock('@/apis/content-music', () => ({
  detail: vi.fn(async (_t: string, { id }: { id: string }) => ({ id, title: `歌 ${id}`, artist: '歌手', album: '专辑' })),
}));
vi.mock('@/lib/player/resolveMusic', async (orig) => ({
  ...(await orig<typeof import('@/lib/player/resolveMusic')>()),
  resolveMusic: music.resolveMusic,
}));
vi.mock('@/hooks/useContentInteraction', () => ({
  useContentInteraction: () => ({ liked: false, likeBusy: false, toggleLike: vi.fn() }),
}));
vi.mock('@/lib/track', () => ({ track: vi.fn(), recordHistory: vi.fn() }));
vi.mock('@/components/detail/DetailHeader', () => ({ default: () => null }));
vi.mock('@/components/detail/DetailFooter', () => ({ DetailFooter: () => null }));
vi.mock('@/components/detail/DetailComments', () => ({ DetailComments: () => null }));
vi.mock('@/components/player/PlaylistPicker', () => ({ default: () => null }));

import MusicDetailPage from './page';

describe('音乐详情:换歌', () => {
  beforeEach(() => {
    nav.id = '1';
    music.resolveMusic.mockReset();
  });

  it('从一首歌换到另一首,不残留上一首解析出的歌词', async () => {
    music.resolveMusic.mockImplementation(async (d: { id: string }) =>
      d.id === '1'
        ? { src: 'https://x/1.mp3', lyrics: [{ time: 1, text: '第一首的歌词' }] }
        : { src: 'https://x/2.mp3', lyrics: [] },
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const ui = () => (
      <QueryClientProvider client={qc}>
        <MusicDetailPage />
      </QueryClientProvider>
    );
    const { rerender } = render(ui());
    await screen.findByText('第一首的歌词');

    // 相关推荐里点到第二首:同一个页面组件,只是 ?id= 变了
    nav.id = '2';
    rerender(ui());
    await screen.findByText('歌 2');
    await waitFor(() => expect(music.resolveMusic).toHaveBeenCalledWith(expect.objectContaining({ id: '2' })));
    await screen.findByText('暂无歌词');
    expect(screen.queryByText('第一首的歌词')).toBeNull();
  });
});

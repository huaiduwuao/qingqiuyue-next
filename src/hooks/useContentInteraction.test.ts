import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/apis/interaction', () => ({
  getInteraction: vi.fn(),
  setLike: vi.fn(),
  setDislike: vi.fn(),
  setCollect: vi.fn(),
}));

import * as api from '@/apis/interaction';
import type { Interaction } from '@/apis/interaction';
import { useContentInteraction } from './useContentInteraction';

// 超 2^53 的真实内容 id:必须原样发给后端,不能被 Number() 截断
const ID = '1789308033040943108';

let server: Interaction;

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  server = { contentId: ID, loggedIn: true, liked: false, disliked: false, collected: false, agreeNum: 5, collectNum: 2 };
  vi.mocked(api.getInteraction).mockImplementation(async () => ({ ...server }));
  vi.mocked(api.setLike).mockImplementation(async (_id, on) => {
    server = { ...server, liked: on, agreeNum: server.agreeNum + (on ? 1 : -1) };
    return {} as never; // 返回值(Axios 响应)hook 不读
  });
  vi.mocked(api.setCollect).mockImplementation(async (_id, on) => {
    server = { ...server, collected: on, collectNum: server.collectNum + (on ? 1 : -1) };
    return {} as never; // 返回值(Axios 响应)hook 不读
  });
});

describe('useContentInteraction', () => {
  it('shows the saved state after a reload instead of starting empty', async () => {
    server = { ...server, liked: true, collected: true, agreeNum: 9 };
    const { result } = renderHook(() => useContentInteraction(ID), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.liked).toBe(true);
    expect(result.current.collected).toBe(true);
    expect(result.current.likeCount).toBe(9);
  });

  it('likes with the exact id, confirms success and ends on the server count', async () => {
    const notify = vi.fn();
    const { result } = renderHook(() => useContentInteraction(ID, { notify }), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(() => result.current.toggleLike());

    expect(api.setLike).toHaveBeenCalledWith(ID, true);
    expect(notify).toHaveBeenCalledWith('已点赞', 'success');
    expect(result.current.liked).toBe(true);
    expect(result.current.likeCount).toBe(6);
    // 页面「详情基数 + likeDelta」的显示方式:基数 5 + 1
    expect(result.current.likeDelta).toBe(1);
  });

  it('rolls back and shows the error when the server refuses', async () => {
    vi.mocked(api.setLike).mockRejectedValueOnce(new Error('请先登录'));
    const notify = vi.fn();
    const { result } = renderHook(() => useContentInteraction(ID, { notify }), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(() => result.current.toggleLike());

    expect(notify).toHaveBeenCalledWith(expect.any(String), 'error');
    expect(notify).not.toHaveBeenCalledWith('已点赞', 'success');
    expect(result.current.liked).toBe(false);
    expect(result.current.likeCount).toBe(5);
  });

  it('asks a logged-out user to log in without calling the API', async () => {
    server = { ...server, loggedIn: false };
    const notify = vi.fn();
    const { result } = renderHook(() => useContentInteraction(ID, { notify }), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(() => result.current.toggleCollect());

    expect(api.setCollect).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith('请先登录后再操作', 'error');
    expect(result.current.collected).toBe(false);
  });

  it('favorites and un-favorites with explicit target states', async () => {
    const notify = vi.fn();
    const { result } = renderHook(() => useContentInteraction(ID, { notify }), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(() => result.current.toggleCollect());
    expect(api.setCollect).toHaveBeenLastCalledWith(ID, true);
    expect(result.current.collected).toBe(true);
    expect(result.current.collectCount).toBe(3);

    await act(() => result.current.toggleCollect());
    expect(api.setCollect).toHaveBeenLastCalledWith(ID, false);
    expect(notify).toHaveBeenLastCalledWith('已取消收藏', 'success');
    expect(result.current.collected).toBe(false);
    expect(result.current.collectCount).toBe(2);
  });
});

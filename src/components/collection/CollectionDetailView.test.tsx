import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(''),
}));
vi.mock('@/lib/contentRoute', () => ({ useContentNavigate: () => vi.fn() }));
vi.mock('@/components/common/PlayTag', () => ({ PlayTag: () => null }));

const auth = vi.hoisted(() => ({ user: null as null | { id: number } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

// 模拟后端:付费合集 10 个作品,未买断只给前 3 个;买断后给全部
const backend = vi.hoisted(() => ({
  price: 30,
  unlocked: false,
  mine: false,
  balance: 100,
  paidWorks: 2,
}));
const item = (i: number) => ({
  id: i, contentId: 1000 + i, title: `作品 ${i}`, coverUrl: '', type: 'VIDEO', author: '甲', views: 0, likes: 0, addTime: '',
});
const unlockList = vi.fn(async () => {
  backend.unlocked = true;
  backend.balance -= backend.price;
  return { ok: true, unlocked: true, alreadyUnlocked: false, price: backend.price, paid: backend.price, balance: backend.balance };
});
vi.mock('@/apis/my-list', () => ({
  getMyListDetail: vi.fn(async () => ({
    id: 7, userId: 2, name: '付费合集', description: '简介', coverUrl: '', covers: [], type: 'topic',
    itemCount: 10, isPublic: false, mine: backend.mine, createTime: '', updateTime: '',
    price: backend.price, visibility: 'paid', ownerName: '作者乙',
    unlocked: backend.mine || backend.unlocked, locked: !backend.mine && !backend.unlocked,
    paidWorks: backend.paidWorks,
  })),
  getSharedList: vi.fn(),
  getMyListContent: vi.fn(async () => {
    const all = Array.from({ length: 10 }, (_, i) => item(i + 1));
    if (backend.mine || backend.unlocked) return { list: all, total: 10 };
    return { list: all.slice(0, 3), total: 10, locked: true, previewCount: 3, price: backend.price };
  }),
  unlockList: () => unlockList(),
}));
vi.mock('@/apis/wallet', () => ({
  getWalletBalance: vi.fn(async () => ({ balance: backend.balance })),
  formatDiamonds: (n: number) => `${n} 钻`,
}));

import CollectionDetailView from './CollectionDetailView';

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CollectionDetailView listId="7" returnTo="/collections/detail?id=7" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  Object.assign(backend, { price: 30, unlocked: false, mine: false, balance: 100, paidWorks: 2 });
  auth.user = null;
  push.mockReset();
  unlockList.mockClear();
});

describe('合集详情:付费合集', () => {
  it('未买断只显示前 3 个作品,提示其余与连带解锁的作者付费作品', async () => {
    renderView();
    await screen.findByText('作品 3');
    expect(screen.queryByText('作品 4')).toBeNull();
    expect(screen.getByText('还有 7 个作品,解锁后可看')).toBeTruthy();
    expect(screen.getByText('含作者付费作品 2 个,买断后一并解锁')).toBeTruthy();
  });

  it('登录用户用钻石解锁后显示全部作品', async () => {
    auth.user = { id: 9 };
    renderView();
    await screen.findByText('当前余额 100 钻');
    fireEvent.click(await screen.findByRole('button', { name: '用 30 钻解锁合集' }));
    await screen.findByText('作品 10');
    expect(unlockList).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/解锁后可看/)).toBeNull();
  });

  it('未登录点解锁去登录,带回跳地址', async () => {
    renderView();
    fireEvent.click(await screen.findByRole('button', { name: '登录后用 30 钻解锁合集' }));
    expect(push).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('/collections/detail?id=7')));
    expect(unlockList).not.toHaveBeenCalled();
  });

  it('余额不足引导去充值', async () => {
    auth.user = { id: 9 };
    backend.balance = 10;
    renderView();
    const link = await screen.findByRole('link', { name: /钻石不足,去充值/ });
    expect(link.getAttribute('href')).toBe('/recharge');
  });

  it('合集主本人看全部,没有付费墙', async () => {
    auth.user = { id: 2 };
    backend.mine = true;
    renderView();
    await screen.findByText('作品 10');
    expect(screen.queryByRole('button', { name: /解锁合集/ })).toBeNull();
  });
});

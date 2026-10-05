import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('moduleId=5'),
  useRouter: () => ({ push }),
}));

const auth = vi.hoisted(() => ({ user: null as null | { id: number } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

// 合集解锁状态由后端决定:模拟一个"买 / 输口令之前锁着,之后放开"的后端
const backend = vi.hoisted(() => ({
  module: { id: 5, title: '分享模块' } as Record<string, unknown>,
  unlocked: false,
  balance: 100,
}));

vi.mock('@/apis/system-module-menu', () => ({
  clientTree: vi.fn(async (params: { modulePass?: string }) => {
    const open = !backend.module.shareType || backend.unlocked || params.modulePass === 'p'.repeat(32);
    return [
      { id: 1, name: '第一章', type: 'PAGE', contentId: open ? 101 : 0 },
      { id: 2, name: '第二章', type: 'PAGE', contentId: open ? 102 : 0 },
    ];
  }),
}));
vi.mock('@/apis/system-module-list', () => ({
  detail: vi.fn(async (params: { modulePass?: string }) => {
    const m = backend.module;
    const locked = !!m.shareType && !backend.unlocked && params.modulePass !== 'p'.repeat(32);
    return {
      ...m,
      locked,
      needPay: locked && m.shareType === 'pay',
      needPassword: locked && m.shareType === 'password',
    };
  }),
}));
vi.mock('@/apis/system-module-content', () => ({
  detail: vi.fn(async ({ id }: { id: number }) => ({ id, title: `内容 ${id}` })),
}));
const payUnlock = vi.fn(async () => {
  backend.unlocked = true;
  backend.balance -= Number(backend.module.price);
  return { unlocked: true, alreadyUnlocked: false, price: backend.module.price, paid: backend.module.price, balance: backend.balance };
});
const passwordUnlock = vi.fn(async ({ password }: { password: string }) => {
  if (password !== '123456') throw new Error('口令错误');
  return { unlocked: true, pass: 'p'.repeat(32), expiresAt: 0 };
});
vi.mock('@/apis/global', () => ({
  payUnlock: () => payUnlock(),
  passwordUnlock: (d: { password: string }) => passwordUnlock(d),
}));
vi.mock('@/apis/wallet', () => ({
  getWalletBalance: vi.fn(async () => ({ balance: backend.balance })),
  formatDiamonds: (n: number) => `${n} 钻`,
}));
vi.mock('@/components/ModuleContentDetail', () => ({
  default: ({ detail }: { detail: { title: string } }) => <div>{detail.title}</div>,
}));

import ShareModuleDetailPage from './page';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ShareModuleDetailPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  backend.module = { id: 5, title: '分享模块' };
  backend.unlocked = false;
  backend.balance = 100;
  auth.user = null;
  push.mockReset();
  payUnlock.mockClear();
  passwordUnlock.mockClear();
  try { window.sessionStorage.clear(); } catch { /* ignore */ }
});

describe('分享模块详情:侧栏目录', () => {
  it('点目录项不重挂侧栏(长目录滚动位置不丢)', async () => {
    renderPage();
    // 默认打开第一项,等它的内容出来、页面稳定了再点第二项
    await screen.findByText('内容 101');
    const node = screen.getByText('第二章');
    fireEvent.click(node);
    await screen.findByText('内容 102');
    // 以前侧栏是渲染期定义的组件,点一下就整棵卸载重建,原节点脱离文档
    expect(node.isConnected).toBe(true);
    expect(screen.getByText('第二章')).toBe(node);
  });
});

describe('分享模块详情:付费合集', () => {
  it('登录用户用钻石解锁后才加载内容', async () => {
    backend.module = { id: 5, title: '付费模块', shareType: 'pay', price: 30 };
    auth.user = { id: 9 };
    renderPage();
    const btn = await screen.findByRole('button', { name: '用 30 钻解锁' });
    await screen.findByText('当前余额 100 钻');
    expect(screen.queryByText('内容 101')).toBeNull();
    fireEvent.click(btn);
    await screen.findByText('内容 101');
    expect(payUnlock).toHaveBeenCalledTimes(1);
  });

  it('未登录点解锁去登录', async () => {
    backend.module = { id: 5, title: '付费模块', shareType: 'pay', price: 30 };
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '登录后解锁' }));
    expect(push).toHaveBeenCalledWith(expect.stringContaining('/user/login'));
    expect(payUnlock).not.toHaveBeenCalled();
  });

  it('余额不足引导去充值', async () => {
    backend.module = { id: 5, title: '付费模块', shareType: 'pay', price: 300 };
    auth.user = { id: 9 };
    renderPage();
    const link = await screen.findByRole('link', { name: /钻石不足,去充值/ });
    expect(link.getAttribute('href')).toBe('/recharge');
  });
});

describe('分享模块详情:口令合集', () => {
  it('口令正确后带通行证加载内容,口令错误提示', async () => {
    backend.module = { id: 5, title: '口令模块', shareType: 'password' };
    renderPage();
    const input = await screen.findByPlaceholderText('请输入口令');
    fireEvent.change(input, { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: '解锁内容' }));
    await screen.findByText('口令错误');
    expect(screen.queryByText('内容 101')).toBeNull();

    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '解锁内容' }));
    await screen.findByText('内容 101');
    await waitFor(() => expect(window.sessionStorage.getItem('module-pass:5')).toBe('p'.repeat(32)));
  });
});

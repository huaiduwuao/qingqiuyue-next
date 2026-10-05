import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('moduleId=5'),
}));
vi.mock('@/apis/system-module-menu', () => ({
  clientTree: vi.fn(async () => [
    { id: 1, name: '第一章', type: 'PAGE', contentId: 101 },
    { id: 2, name: '第二章', type: 'PAGE', contentId: 102 },
  ]),
}));
vi.mock('@/apis/system-module-list', () => ({
  detail: vi.fn(async () => ({ id: 5, name: '分享模块' })),
}));
vi.mock('@/apis/system-module-content', () => ({
  detail: vi.fn(async ({ id }: { id: number }) => ({ id, title: `内容 ${id}` })),
}));
vi.mock('@/apis/global', () => ({ passwordUnlock: vi.fn(), payUnlock: vi.fn() }));
vi.mock('@/components/ModuleContentDetail', () => ({
  default: ({ detail }: { detail: { title: string } }) => <div>{detail.title}</div>,
}));

import ShareModuleDetailPage from './page';

describe('分享模块详情:侧栏目录', () => {
  it('点目录项不重挂侧栏(长目录滚动位置不丢)', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ShareModuleDetailPage />
      </QueryClientProvider>,
    );
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

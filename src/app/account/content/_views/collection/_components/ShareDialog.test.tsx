import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const api = vi.hoisted(() => ({
  setListPrice: vi.fn(),
  updateMyList: vi.fn(async () => ({ ok: true })),
  createShareToken: vi.fn(async () => ({ ok: true, shareToken: 't'.repeat(32) })),
  deleteShareToken: vi.fn(async () => ({ ok: true })),
}));
vi.mock('@/apis/my-list', () => ({
  ...api,
  COLLECTION_MAX_PRICE: 10000,
  COLLECTION_PREVIEW_ITEMS: 3,
  collectionHref: (id: string | number) => `/collections/detail?id=${id}`,
}));
vi.mock('@/lib/api/client', () => ({
  formatApiError: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

import ShareDialog, { type ShareTarget } from './ShareDialog';

function renderDialog(target: ShareTarget, onSnack = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ShareDialog open target={target} onClose={vi.fn()} onChanged={vi.fn()} onSnack={onSnack} />
    </QueryClientProvider>,
  );
  return onSnack;
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockClear());
});

describe('合集可见性:付费', () => {
  it('等级不够时显示后端给的当前 / 所需等级', async () => {
    api.setListPrice.mockRejectedValueOnce(new Error('达到 Lv4 资深创作者后才能设置付费合集(当前 Lv2 成长创作者,创作者分满 2000 即可)'));
    renderDialog({ id: 7, name: '合集', isPublic: true, price: 0 });
    fireEvent.click(screen.getByRole('radio', { name: /付费/ }));
    fireEvent.change(screen.getByLabelText('买断价(钻)'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: '保存可见性' }));
    await screen.findByText(/当前 Lv2/);
    expect(api.setListPrice).toHaveBeenCalledWith(7, 30);
  });

  it('价格超出范围不发请求', async () => {
    renderDialog({ id: 7, name: '合集', isPublic: true, price: 0 });
    fireEvent.click(screen.getByRole('radio', { name: /付费/ }));
    fireEvent.change(screen.getByLabelText('买断价(钻)'), { target: { value: '20000' } });
    fireEvent.click(screen.getByRole('button', { name: '保存可见性' }));
    await screen.findByText('价格需为 1 ~ 10000 的整数(钻)');
    expect(api.setListPrice).not.toHaveBeenCalled();
  });

  it('付费改回私密:先清零价格,再关公开、关链接', async () => {
    api.setListPrice.mockResolvedValueOnce({ ok: true, price: 0 });
    const snack = renderDialog({ id: 7, name: '合集', isPublic: true, price: 30, shareToken: 'x'.repeat(32) });
    fireEvent.click(screen.getByRole('radio', { name: /私密/ }));
    fireEvent.click(screen.getByRole('button', { name: '保存可见性' }));
    await waitFor(() => expect(snack).toHaveBeenCalledWith('已设为私密'));
    expect(api.setListPrice).toHaveBeenCalledWith(7, 0);
    expect(api.updateMyList).toHaveBeenCalledWith(7, { isPublic: false });
    expect(api.deleteShareToken).toHaveBeenCalledWith(7);
  });
});

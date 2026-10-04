import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({
  listLayouts: vi.fn(async () => [
    { key: 'study_tea', name: '书斋茶席', intro: '喝茶', template: 'study', items: 12, ready: 9, thumbs: ['models/a.thumb.png'] },
    { key: 'empty_one', name: '还没做好', intro: '', template: 'loft', items: 5, ready: 0, thumbs: [] },
  ]),
  applyLayout: vi.fn(async () => ({ placed: 9, skipped: 3, canUndo: true })),
  undoLayout: vi.fn(async () => ({ placed: 2, skipped: 0, canUndo: false })),
  worldFileUrl: (r: string) => `/qq-media/world/${r}`,
}));
vi.mock('@/apis/world', () => api);

import { RoomLayouts, layoutResultText } from '../scene-ui/RoomLayouts';

describe('layoutResultText', () => {
  it('says what happened', () => {
    expect(layoutResultText({ placed: 9, skipped: 3, canUndo: true })).toBe('摆好了 9 件,3 件还没做好先跳过');
    expect(layoutResultText({ placed: 4, skipped: 0, canUndo: false })).toBe('摆好了 4 件');
    expect(layoutResultText({ placed: 0, skipped: 5, canUndo: false })).toContain('跳过了 5 件');
  });
});

describe('RoomLayouts', () => {
  it('replaces with confirmation, then can undo once', async () => {
    const toast = vi.fn();
    const onApplied = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<RoomLayouts toast={toast} onApplied={onApplied} />);
    await screen.findByText('书斋茶席');
    expect(screen.getByText(/现在能摆 9 件/)).toBeTruthy();
    // 一件都摆不出来的样板间按钮是灰的
    const buttons = screen.getAllByRole('button', { name: '换成这样' }) as HTMLButtonElement[];
    expect(buttons[1].disabled).toBe(true);
    await act(async () => { fireEvent.click(buttons[0]); });
    expect(api.applyLayout).toHaveBeenCalledWith({ template: 'study_tea', mode: 'replace' });
    expect(toast).toHaveBeenCalledWith('🏡', '摆好了 9 件,3 件还没做好先跳过');
    expect(onApplied).toHaveBeenCalledTimes(1);
    const undo = await screen.findByRole('button', { name: /撤销刚才的套用/ });
    await act(async () => { fireEvent.click(undo); });
    expect(api.undoLayout).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('button', { name: /撤销刚才的套用/ })).toBeNull());
    expect(onApplied).toHaveBeenCalledTimes(2);
  });

  it('adds without asking and offers no undo', async () => {
    api.applyLayout.mockClear();
    const confirm = vi.spyOn(window, 'confirm');
    confirm.mockClear();
    render(<RoomLayouts toast={vi.fn()} onApplied={vi.fn()} />);
    await screen.findByText('书斋茶席');
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: '加进来' })[0]); });
    expect(confirm).not.toHaveBeenCalled();
    expect(api.applyLayout).toHaveBeenCalledWith({ template: 'study_tea', mode: 'add' });
    expect(screen.queryByRole('button', { name: /撤销刚才的套用/ })).toBeNull();
  });
});

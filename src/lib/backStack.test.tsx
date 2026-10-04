/**
 * 返回手势先关弹层:MUI Dialog 和自绘浮层都能被 closeTopOverlay 关掉;手机浏览器里有弹层时
 * 垫一条历史记录,返回退掉它就只关弹层、不换页。
 */
import { act, render, screen } from '@testing-library/react';
import Dialog from '@mui/material/Dialog';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { closeTopOverlay, installOverlayHistoryGuard, useBackClose } from './backStack';

function Panel() {
  const [open, setOpen] = useState(true);
  useBackClose(open, () => setOpen(false));
  return <div>{open ? '评论栏开着' : '评论栏收起'}</div>;
}

function WithDialog() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Panel />
      <Dialog open={open} onClose={() => setOpen(false)} transitionDuration={0}>
        举报弹窗
      </Dialog>
    </>
  );
}

const tick = (ms = 20) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

describe('backStack', () => {
  it('先关最上面的 MUI 弹窗,再关自绘浮层,都关完返回 false', async () => {
    render(<WithDialog />);
    expect(screen.getByText('举报弹窗')).toBeInTheDocument();
    act(() => {
      expect(closeTopOverlay()).toBe(true);
    });
    await tick();
    expect(screen.queryByText('举报弹窗')).toBeNull();
    expect(screen.getByText('评论栏开着')).toBeInTheDocument();
    act(() => {
      expect(closeTopOverlay()).toBe(true);
    });
    expect(screen.getByText('评论栏收起')).toBeInTheDocument();
    expect(closeTopOverlay()).toBe(false);
  });

  it('手机浏览器:弹层开着时垫一条记录,返回只关弹层', async () => {
    installOverlayHistoryGuard();
    const before = history.length;
    render(<Panel />);
    await tick();
    expect(history.length).toBe(before + 1);
    expect(history.state?.__qqOverlay).toBe(true);
    await act(async () => {
      history.back();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.getByText('评论栏收起')).toBeInTheDocument();
    expect(history.state?.__qqOverlay).toBeFalsy();
  });
});

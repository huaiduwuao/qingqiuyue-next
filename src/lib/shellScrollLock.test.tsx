/**
 * 2026-09-27 安卓真机 scroll_stuck:详情页 body 带着行内 overflow:hidden,整页滑不动。
 * 复现顺序:首页外壳挂着 → 打开 MUI 抽屉(Modal 记下 body 当时的 overflow)→ 抽屉还开着就换页,外壳卸载
 * → 抽屉随后关闭,把记下的值写回 body。这里锁住:这一串之后 body 能滚。
 */
import { act, render } from '@testing-library/react';
import Drawer from '@mui/material/Drawer';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installScrollLockGuard, useShellScrollLock } from './shellScrollLock';

function Shell() {
  useShellScrollLock();
  return <div>shell</div>;
}

let setShell: (v: boolean) => void = () => {};
let setDrawer: (v: boolean) => void = () => {};

function App() {
  const [shell, s1] = useState(true);
  const [drawer, s2] = useState(false);
  setShell = s1;
  setDrawer = s2;
  return (
    <>
      {shell ? <Shell /> : <div>detail</div>}
      <Drawer open={drawer} transitionDuration={0}>
        menu
      </Drawer>
    </>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('shellScrollLock', () => {
  it('外壳卸载后抽屉才关,body 不留 overflow:hidden', async () => {
    installScrollLockGuard();
    render(<App />);
    const html = document.documentElement;
    expect(html.hasAttribute('data-shell-lock')).toBe(true);

    act(() => setDrawer(true));
    // Modal 打开时自己锁 body —— 这是正当的,守卫不能拆
    expect(document.body.style.overflow).toBe('hidden');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(document.body.style.overflow).toBe('hidden');

    // 点了抽屉里的链接:先换页(外壳卸载),再关抽屉
    act(() => setShell(false));
    expect(html.hasAttribute('data-shell-lock')).toBe(false);
    act(() => setDrawer(false));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(document.querySelector('.MuiModal-root:not(.MuiModal-hidden)')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('两个外壳交替挂载时计数,不会提前解锁', () => {
    const a = render(<Shell />);
    const b = render(<Shell />);
    a.unmount();
    expect(document.documentElement.hasAttribute('data-shell-lock')).toBe(true);
    b.unmount();
    expect(document.documentElement.hasAttribute('data-shell-lock')).toBe(false);
  });

  it('没有打开的 Modal 时,别处残留的行内 overflow:hidden 由守卫清掉', async () => {
    installScrollLockGuard();
    document.body.style.overflow = 'hidden';
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(document.body.style.overflow).toBe('');
  });
});

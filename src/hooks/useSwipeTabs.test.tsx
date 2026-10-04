import { render } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useSwipeTabs } from './useSwipeTabs';

function touch(el: Element, type: string, x: number, y: number) {
  const e = new Event(type, { bubbles: true });
  const pts = type === 'touchend' ? [] : [{ clientX: x, clientY: y }];
  Object.defineProperty(e, 'touches', { value: pts });
  el.dispatchEvent(e);
}

function drag(el: Element, from: [number, number], to: [number, number]) {
  touch(el, 'touchstart', ...from);
  for (let i = 1; i <= 6; i++) {
    touch(el, 'touchmove', from[0] + ((to[0] - from[0]) * i) / 6, from[1] + ((to[1] - from[1]) * i) / 6);
  }
  touch(el, 'touchend', ...to);
}

function Area({ onSwipe }: { onSwipe: (d: 1 | -1) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useSwipeTabs(ref, onSwipe);
  return (
    <div ref={ref} data-testid="area">
      <p data-testid="text">正文</p>
      <div data-testid="strip" style={{ overflowX: 'auto' }} />
    </div>
  );
}

describe('useSwipeTabs', () => {
  it('横划切页签,竖划不管', () => {
    const fn = vi.fn();
    const { getByTestId } = render(<Area onSwipe={fn} />);
    const text = getByTestId('text');
    drag(text, [300, 400], [150, 410]);
    expect(fn).toHaveBeenLastCalledWith(1);
    drag(text, [100, 400], [260, 395]);
    expect(fn).toHaveBeenLastCalledWith(-1);
    fn.mockClear();
    drag(text, [200, 600], [230, 200]);
    // 先竖后横也不算
    touch(text, 'touchstart', 200, 600);
    touch(text, 'touchmove', 200, 560);
    touch(text, 'touchmove', 60, 560);
    touch(text, 'touchend', 60, 560);
    expect(fn).not.toHaveBeenCalled();
  });

  it('起点在能横向滚动的条里不接管', () => {
    const fn = vi.fn();
    const { getByTestId } = render(<Area onSwipe={fn} />);
    const strip = getByTestId('strip');
    Object.defineProperty(strip, 'scrollWidth', { value: 900 });
    Object.defineProperty(strip, 'clientWidth', { value: 300 });
    drag(strip, [300, 400], [100, 400]);
    expect(fn).not.toHaveBeenCalled();
  });
});

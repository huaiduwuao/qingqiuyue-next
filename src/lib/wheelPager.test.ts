/**
 * Mac 客户端「翻页手势不生效」(2026-09-28):触控板事件序列下,推荐流滚轮翻页的判断。
 * 序列按 WKWebView 触控板的形状造:~16ms 一个事件,手指阶段小 delta 上升,松手后惯性逐渐衰减。
 */
import { describe, expect, it } from 'vitest';
import { createWheelPager } from './wheelPager';

type Ev = [delta: number, gapMs: number];

/** 手指阶段 rise(从小到大)+ 惯性阶段 decay(从大到小) */
function trackpadSwipe(peak: number, sign = 1, fingerSteps = 8, inertiaSteps = 70): Ev[] {
  const out: Ev[] = [];
  for (let i = 1; i <= fingerSteps; i++) out.push([sign * Math.max(1, Math.round((peak * i) / fingerSteps)), 16]);
  for (let i = 1; i <= inertiaSteps; i++) out.push([sign * Math.max(1, Math.round(peak * Math.pow(0.93, i))), 16]);
  return out;
}

function run(seq: Ev[]) {
  const pages: number[] = [];
  const feed = createWheelPager((d) => pages.push(d));
  let t = 1000;
  for (const [d, gap] of seq) {
    t += gap;
    feed(d, 0, t);
  }
  return pages;
}

describe('wheelPager', () => {
  it('轻轻划一下(delta 全是个位数)也能翻一条', () => {
    const gentle: Ev[] = Array.from({ length: 20 }, () => [4, 16]);
    expect(run(gentle)).toEqual([1]);
  });

  it('一次轻扫连同一两秒惯性只翻一条', () => {
    expect(run(trackpadSwipe(60))).toEqual([1]);
    expect(run(trackpadSwipe(30, -1))).toEqual([-1]);
  });

  it('上一下的惯性还没停又划一下,翻第二条', () => {
    const first = trackpadSwipe(60);
    // 惯性衰减到一半时手指又划(事件间隔一直 16ms,没有停顿)
    const seq = [...first.slice(0, 30), ...trackpadSwipe(50)];
    expect(run(seq)).toEqual([1, 1]);
  });

  it('鼠标滚轮:一格翻一条,连续快拨一串只翻一条,停一下再拨翻下一条', () => {
    expect(run([[100, 16]])).toEqual([1]);
    const burst: Ev[] = [[100, 16], [100, 40], [100, 40], [100, 40]];
    expect(run([...burst, [100, 400]])).toEqual([1, 1]);
  });

  it('按行滚动的滚轮(deltaMode=1)也算', () => {
    const pages: number[] = [];
    const feed = createWheelPager((d) => pages.push(d));
    feed(3, 1, 1000);
    expect(pages).toEqual([1]);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindShelfReading, openBookFromShelf, playBookClose, playBookOpen } from './bookFlip';
import { setRenderedPath } from '@/lib/navTransition';

/** jsdom 没有 Web Animations:给一个立刻放完的假实现 */
function fakeAnimate() {
  return { finished: Promise.resolve() } as unknown as Animation;
}

const overlay = () => document.querySelector('[data-book-flip]');

describe('bookFlip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Element.prototype.animate = vi.fn(fakeAnimate) as unknown as typeof Element.prototype.animate;
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    sessionStorage.clear();
    history.replaceState(null, '', '/home/me?mainTab=bookshelf');
    setRenderedPath('/home/me');
  });

  afterEach(async () => {
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('does nothing when reduced motion is on', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const onCovered = vi.fn();
    expect(playBookOpen({ theme: { id: 'x', label: '', paper: '#fff', page: '#eee', text: '#000', sub: '#666', line: '#ddd', fill: '#eee', dark: false }, onCovered })).toBe(false);
    expect(onCovered).not.toHaveBeenCalled();
    expect(overlay()).toBeNull();
  });

  it('opens from the shelf: navigates once covered, then removes the overlay', async () => {
    const navigate = vi.fn(() => {
      history.pushState(null, '', '/detail/novel-detail?id=42');
      setRenderedPath('/detail/novel-detail?id=42');
    });
    expect(openBookFromShelf({ id: 42, cover: '', title: '书' }, navigate)).toBe(true);
    expect(overlay()).not.toBeNull();
    // 连点第二下被吞掉
    expect(openBookFromShelf({ id: 42 }, navigate)).toBe(true);
    await vi.runAllTimersAsync();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(overlay()).toBeNull();
  });

  it('plays the close animation when the reader unmounts back onto the same shelf', async () => {
    openBookFromShelf({ id: 7 }, () => history.pushState(null, '', '/detail/novel-detail?id=7'));
    await vi.runAllTimersAsync();

    const cleanup = bindShelfReading('7');
    expect(cleanup).toBeTypeOf('function');
    // 系统返回键:popstate 先把地址改回书架,页面随后卸载
    history.replaceState(null, '', '/home/me?mainTab=bookshelf&sub=works');
    cleanup!();
    expect(overlay()).not.toBeNull();
    await vi.runAllTimersAsync();
    expect(overlay()).toBeNull();
    // 合过一次就作废,再进同一本书不算从书架来的
    expect(bindShelfReading('7')).toBeUndefined();
  });

  it('does not close when leaving the reader for somewhere else', () => {
    openBookFromShelf({ id: 8 }, () => {});
    const cleanup = bindShelfReading('8');
    vi.advanceTimersByTime(6000);
    history.replaceState(null, '', '/detail/novel-detail?id=99');
    cleanup!();
    expect(overlay()).toBeNull();
  });

  it('calls onCovered synchronously for an in-page close', () => {
    const onCovered = vi.fn();
    playBookClose({ theme: { id: 'x', label: '', paper: '#fff', page: '#eee', text: '#000', sub: '#666', line: '#ddd', fill: '#eee', dark: false }, onCovered });
    expect(onCovered).toHaveBeenCalledTimes(1);
  });
});

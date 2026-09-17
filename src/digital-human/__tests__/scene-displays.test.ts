import { describe, expect, it } from 'vitest';
import {
  emptyNav, navCanBack, navCanForward, navObserve, pageFromTarget, parseSlot, resolveDisplayInput, slotForUrl, toSitePath,
} from '../scene-ui/displays';
import { resolveIframeUrl } from '../virtual-browser';
import { DISPLAY_SPECS, displayFocusPose } from '../vrm/sceneDisplays';

describe('scene displays: 页面分屏', () => {
  it('看的上大屏,读的上竖屏,其它上副屏', () => {
    expect(slotForUrl('/detail/film-detail?id=1')).toBe('wall');
    expect(slotForUrl('/detail/live-detail?id=1')).toBe('wall');
    expect(slotForUrl('/detail/novel-detail?id=1')).toBe('kiosk');
    expect(slotForUrl('/detail/music-detail?id=1')).toBe('kiosk');
    expect(slotForUrl('/home/recommend?tab=rank')).toBe('desk');
    expect(slotForUrl('https://example.com/a')).toBe('desk');
    expect(slotForUrl('https://cdn.example.com/a.mp4?x=1')).toBe('wall');
  });

  it('站内地址识别', () => {
    expect(toSitePath('/search?q=a')).toBe('/search?q=a');
    expect(toSitePath('//evil.com/x')).toBeNull();
    expect(toSitePath('https://qq.test/detail/x', 'https://qq.test')).toBe('/detail/x');
    expect(toSitePath('https://other.test/detail/x', 'https://qq.test')).toBeNull();
  });

  it('地址栏输入:路径 / 网址 / 搜索词', () => {
    expect(resolveDisplayInput(' /playlist ')).toBe('/playlist');
    expect(resolveDisplayInput('https://a.com/x')).toBe('https://a.com/x');
    expect(resolveDisplayInput('bilibili.com')).toBe('https://bilibili.com');
    expect(resolveDisplayInput('周杰伦 稻香')).toBe(`/search?q=${encodeURIComponent('周杰伦 稻香')}`);
  });

  it('屏幕名中英文都认', () => {
    expect(parseSlot('wall')).toBe('wall');
    expect(parseSlot('大屏')).toBe('wall');
    expect(parseSlot('竖屏')).toBe('kiosk');
    expect(parseSlot('副屏')).toBe('desk');
    expect(parseSlot('')).toBeNull();
    expect(parseSlot(undefined)).toBeNull();
  });

  it('B 站链接映射成外链播放器后走 iframe,不当成直链视频', () => {
    const page = pageFromTarget(resolveIframeUrl({ url: 'https://www.bilibili.com/video/BV1xx411c7mD' }));
    expect(page.kind).toBe('web');
    expect(page.url).toContain('player.bilibili.com');
    expect(page.embeddable).toBe(true);
    expect(pageFromTarget(resolveIframeUrl({ url: 'https://cdn.example.com/a.mp4' })).kind).toBe('video');
  });
});

describe('scene displays: 每块屏自己的访问栈', () => {
  it('新地址压栈,相邻地址算前进/后退', () => {
    let nav = emptyNav();
    nav = navObserve(nav, '/a');
    nav = navObserve(nav, '/b');
    nav = navObserve(nav, '/c');
    expect(nav).toEqual({ entries: ['/a', '/b', '/c'], index: 2 });
    nav = navObserve(nav, '/b'); // 后退
    expect(nav.index).toBe(1);
    expect(navCanBack(nav) && navCanForward(nav)).toBe(true);
    nav = navObserve(nav, '/c'); // 前进
    expect(nav.index).toBe(2);
    nav = navObserve(navObserve(nav, '/b'), '/d'); // 退一步再去新地址:截断 /c
    expect(nav).toEqual({ entries: ['/a', '/b', '/d'], index: 2 });
  });

  it('地址没变不产生新对象(调用方靠引用判断有没有变化)', () => {
    const nav = navObserve(emptyNav(), '/a');
    expect(navObserve(nav, '/a')).toBe(nav);
    expect(navCanBack(nav)).toBe(false);
  });
});

describe('scene displays: 凑近看的机位', () => {
  it('相机在屏幕正前方,屏幕落在聊天区上方', () => {
    for (const spec of Object.values(DISPLAY_SPECS)) {
      const { pos, target } = displayFocusPose(spec, 30, 16 / 9);
      const dx = pos[0] - target[0];
      const dz = pos[2] - target[2];
      const dist = Math.hypot(dx, dz);
      // 视线沿屏幕法线
      expect(dx / dist).toBeCloseTo(Math.sin(spec.rotationY), 5);
      expect(dz / dist).toBeCloseTo(Math.cos(spec.rotationY), 5);
      // 屏幕整个在画面内:上沿不出顶,下沿高于底部 34% 的聊天区
      const halfView = Math.tan((30 * Math.PI) / 360) * dist;
      const h = spec.heightPx * spec.scale;
      const top = (spec.position[1] + h / 2 - target[1]) / halfView;
      const bottom = (spec.position[1] - h / 2 - target[1]) / halfView;
      expect(top).toBeLessThanOrEqual(1);
      expect(bottom).toBeGreaterThanOrEqual(-0.32 - 1e-6);
    }
  });
});

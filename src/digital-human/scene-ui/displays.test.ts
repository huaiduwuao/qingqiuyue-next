import { describe, expect, it } from 'vitest';
import { resolveIframeUrl, safeFrameSrc } from '../virtual-browser';
import { isBackendPath, pageFromTarget, resolveDisplayInput, toSitePath } from './displays';

describe('scene displays: backend paths are never site pages', () => {
  it('treats /api, /ws, /logs and MinIO buckets as backend paths', () => {
    for (const p of ['/api/proxy?url=https://evil.example/x.html', '/API/proxy', '/./api/proxy', '/x/../api/proxy', '/%61pi/proxy', '/ws/x', '/logs', '/qq-media/a.html']) {
      expect(isBackendPath(p)).toBe(true);
      expect(toSitePath(p)).toBeNull();
    }
    expect(toSitePath('https://qq.test/api/proxy?url=x', 'https://qq.test')).toBeNull();
    expect(toSitePath('/\t/evil.com')).toBeNull();
    expect(toSitePath('/apidoc')).toBe('/apidoc');
    expect(toSitePath('/detail/film-detail?id=1')).toBe('/detail/film-detail?id=1');
  });

  it('does not put same-origin or script urls on screen as web pages', () => {
    const origin = window.location.origin;
    for (const url of ['/api/proxy?url=https://evil.example/x.html', `${origin}/api/proxy?url=x`, 'javascript:alert(1)']) {
      const page = pageFromTarget(resolveIframeUrl({ url }));
      expect(page.kind).not.toBe('site');
      expect(page.url).toBe('about:blank');
    }
    // 本站代理的视频流仍可放(<video> 不执行脚本)
    expect(pageFromTarget(resolveIframeUrl({ url: '/api/proxy?url=https%3A%2F%2Fcdn.example.com%2Fa.mp4&x=.mp4' })).kind).toBe('video');
    expect(pageFromTarget(resolveIframeUrl({ url: 'https://zh.wikipedia.org/wiki/x' })).url).toBe('https://zh.wikipedia.org/wiki/x');
  });

  it('address bar input for backend paths falls back to search', () => {
    expect(resolveDisplayInput('/api/proxy?url=x').startsWith('/search?q=')).toBe(true);
  });

  it('safeFrameSrc only allows cross-origin http(s)', () => {
    expect(safeFrameSrc('https://a.com/x', 'https://qq.test')).toBe('https://a.com/x');
    expect(safeFrameSrc('https://qq.test/api/proxy', 'https://qq.test')).toBe('about:blank');
    expect(safeFrameSrc('/api/proxy', 'https://qq.test')).toBe('about:blank');
    expect(safeFrameSrc('data:text/html,x', 'https://qq.test')).toBe('about:blank');
  });
});

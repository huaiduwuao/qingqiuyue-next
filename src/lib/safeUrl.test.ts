import { afterEach, describe, expect, it, vi } from 'vitest';
import { openExternal, safeHttpUrl, safeSitePath } from './safeUrl';

describe('safeHttpUrl', () => {
  it('keeps http(s) and resolves relative paths on this site', () => {
    expect(safeHttpUrl('https://a.com/x?y=1')).toBe('https://a.com/x?y=1');
    expect(safeHttpUrl('http://a.com')).toBe('http://a.com/');
    expect(safeHttpUrl('/detail/x', 'https://qq.test')).toBe('https://qq.test/detail/x');
  });

  it('rejects script-ish and local schemes', () => {
    for (const bad of ['javascript:alert(1)', ' JavaScript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,<b>', 'file:///etc/passwd', 'vbscript:x', '', null, undefined]) {
      expect(safeHttpUrl(bad)).toBeNull();
    }
  });
});

describe('openExternal', () => {
  afterEach(() => vi.restoreAllMocks());

  it('always opens with noopener and skips unsafe urls', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    expect(openExternal('https://a.com')).toBe(true);
    expect(open).toHaveBeenCalledWith('https://a.com/', '_blank', 'noopener,noreferrer');
    expect(openExternal('javascript:alert(1)')).toBe(false);
    expect(open).toHaveBeenCalledTimes(1);
  });
});

describe('safeSitePath', () => {
  it('accepts in-site paths only', () => {
    expect(safeSitePath('/taskboard?taskId=1')).toBe('/taskboard?taskId=1');
    for (const bad of ['javascript:alert(1)', 'https://evil.com', '//evil.com', '/\\evil.com', '/\t/evil.com', 'rel/path', '', null]) {
      expect(safeSitePath(bad)).toBeNull();
    }
  });
});

import { describe, expect, it } from 'vitest';
import { externalLink, formatAgo, formatDuration, formatLiveFor, formatViewers } from './liveApi';

describe('formatViewers', () => {
  it('treats missing counts as unknown, not zero viewers', () => {
    expect(formatViewers(0)).toBe('—');
    expect(formatViewers(undefined)).toBe('—');
  });
  it('uses 万 / 亿 units', () => {
    expect(formatViewers(836)).toBe('836');
    expect(formatViewers(12000)).toBe('1.2万');
    expect(formatViewers(50000)).toBe('5万');
    expect(formatViewers(5646301)).toBe('564.6万');
    expect(formatViewers(230000000)).toBe('2.3亿');
  });
});

describe('time helpers', () => {
  const now = 1_790_000_000;
  it('formatAgo', () => {
    expect(formatAgo(now - 30, now)).toBe('刚刚');
    expect(formatAgo(now - 5 * 60, now)).toBe('5 分钟前');
    expect(formatAgo(now - 3 * 3600, now)).toBe('3 小时前');
    expect(formatAgo(0, now)).toBe('');
  });
  it('formatLiveFor', () => {
    expect(formatLiveFor(0, now)).toBe('');
    expect(formatLiveFor(now - 600, now)).toBe('刚开播');
    expect(formatLiveFor(now - 2 * 3600 - 5, now)).toBe('已播约 2 小时');
    expect(formatLiveFor(now - 50 * 3600, now)).toBe('已播约 2 天');
  });
  it('formatDuration adds the last refresh period', () => {
    expect(formatDuration(now, now)).toBe('约 1 小时');
    expect(formatDuration(now, now + 3 * 3600)).toBe('约 4 小时');
    expect(formatDuration(now, now - 1)).toBe('');
  });
});

describe('externalLink', () => {
  it('only allows http(s)', () => {
    expect(externalLink('https://www.huya.com/998')).toBe('https://www.huya.com/998');
    expect(externalLink('javascript:alert(1)')).toBe('');
    expect(externalLink(undefined)).toBe('');
  });
});

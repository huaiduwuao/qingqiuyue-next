import { describe, expect, it } from 'vitest';
import { formatCount, formatDuration, toTimestamp } from './format';

describe('formatCount', () => {
  it('小于 1000 原样', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(999)).toBe('999');
  });

  it('千 / 万 缩写保留一位小数', () => {
    expect(formatCount(1000)).toBe('1.0k');
    expect(formatCount(3456)).toBe('3.5k');
    expect(formatCount(9999)).toBe('10.0k');
    expect(formatCount(10000)).toBe('1.0w');
    expect(formatCount(123456)).toBe('12.3w');
  });

  it('空值 / NaN / 负数显示 0', () => {
    expect(formatCount()).toBe('0');
    expect(formatCount(undefined)).toBe('0');
    expect(formatCount(null)).toBe('0');
    expect(formatCount(NaN)).toBe('0');
    expect(formatCount(-5)).toBe('0');
  });
});

describe('formatDuration', () => {
  it('秒数转 m:ss,小数秒向下取整', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5.9)).toBe('0:05');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3725)).toBe('62:05');
  });

  it('空值 / NaN / 负数显示 0:00', () => {
    expect(formatDuration(undefined)).toBe('0:00');
    expect(formatDuration(null)).toBe('0:00');
    expect(formatDuration(NaN)).toBe('0:00');
    expect(formatDuration(-1)).toBe('0:00');
  });
});

describe('toTimestamp', () => {
  it('数字 / 纯数字字符串按毫秒时间戳', () => {
    expect(toTimestamp(1700000000000)).toBe(1700000000000);
    expect(toTimestamp('1700000000000')).toBe(1700000000000);
  });

  it('空值 / 乱码返回 NaN', () => {
    expect(toTimestamp(null)).toBeNaN();
    expect(toTimestamp(undefined)).toBeNaN();
    expect(toTimestamp('')).toBeNaN();
    expect(toTimestamp('not a date')).toBeNaN();
  });

  it('ISO 8601 原样解析', () => {
    expect(toTimestamp('2026-10-04T12:00:00Z')).toBe(Date.UTC(2026, 9, 4, 12, 0, 0));
    expect(toTimestamp('2026-10-04T12:00:00+08:00')).toBe(Date.UTC(2026, 9, 4, 4, 0, 0));
  });

  it('「日期 空格 时间」按本地时间解析(Safari 直接 new Date 会得到 Invalid Date)', () => {
    expect(toTimestamp('2026-10-04 12:00:00')).toBe(new Date(2026, 9, 4, 12, 0, 0).getTime());
    expect(toTimestamp('2026-10-04 12:00')).toBe(new Date(2026, 9, 4, 12, 0, 0).getTime());
  });

  it('Date 对象取 getTime', () => {
    expect(toTimestamp(new Date(5))).toBe(5);
  });
});

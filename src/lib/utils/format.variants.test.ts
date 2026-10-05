import { describe, expect, it } from 'vitest';
import {
  formatCount,
  formatCountW,
  formatCountWLocale,
  formatCountWan,
  formatCountWanK,
  formatCountWanYi,
  formatCountYiW,
  formatDuration,
  formatDurationHms,
  formatDurationLabel,
  formatDurationLabelLong,
  formatDurationPadded,
  formatMs,
} from './format';

// 各页面收口前的原实现,逐字抄来做对照:合法输入上变体必须与原实现输出完全一致。
const orig = {
  // RecommendVideoFeed(TopPerformingContent / CircleExtras 同口径,只是没有空值保护)
  countW(n?: number): string {
    if (n == null || isNaN(n)) return '0';
    if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
    return n.toString();
  },
  // WorksMobile(CreatorProfileHeader 同口径,没有空值保护)
  countWLocale(n?: number) {
    const v = Number(n) || 0;
    if (v >= 10000) return `${(v / 10000).toFixed(1)}w`;
    return v.toLocaleString();
  },
  // DramaPanel / TheaterPanel
  countYiW(n?: number | null): string {
    const num = Number(n) || 0;
    if (num >= 100000000) return `${(num / 100000000).toFixed(1)}亿`;
    if (num >= 10000) return `${(num / 10000).toFixed(1)}w`;
    return num.toString();
  },
  // FeedPanel formatViews
  countWan(n: number): string {
    if (n == null || isNaN(n) || n < 0) return '0';
    if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
    return n.toString();
  },
  // creator/page formatNum、admin dashboard/analysis fmt
  countWanK(n: number): string {
    if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
  },
  // apis/dashboard formatCount
  countWanYi(n: number): string {
    if (n >= 100000000) return (n / 100000000).toFixed(1) + '亿';
    if (n >= 10000) return (n / 10000).toFixed(1) + '万';
    return n.toLocaleString();
  },
  // MyHomePage formatViews、WorksManager / collection formatNum
  countWK(n: number): string {
    if (n == null || isNaN(n) || n < 0) return '0';
    if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
  },
  // music-detail / VideoPlayer / FloatingVideoDock / GlobalMusicBar
  playerTime(s: number) {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  },
  // CallLayer fmt / apis/call 通话时长
  padded(sec: number) {
    return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  },
  // FeedPanel formatDuration
  label(sec: number): string {
    if (sec == null || isNaN(sec) || sec < 0) return '0:00';
    if (sec < 60) return `${sec}秒`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  },
  // MyHomePage formatDuration
  labelLong(sec: number): string {
    if (sec == null || isNaN(sec) || sec < 0) return '0:00';
    if (sec < 60) return `${sec}秒`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m < 60) return `${m}:${s.toString().padStart(2, '0')}`;
    const h = Math.floor(m / 60);
    return `${h}:${(m % 60).toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  },
  // spider/tasks fmtDuration
  hms(sec?: number): string {
    if (sec === undefined || sec < 0) return '-';
    const s = Math.floor(sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    if (m > 0) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
    return `${s}s`;
  },
  // ops/tasks formatDuration
  ms(ms?: number): string {
    if (!ms || ms < 0) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  },
};

const COUNTS = [0, 1, 999, 1000, 1234, 9999, 10000, 12345, 99999, 100000, 123456, 99999999, 100000000, 123456789, 5e12];
const NEG = [-1, -5, -12345];
const SECS = [0, 1, 5, 59, 60, 61, 65, 599, 3599, 3600, 3661, 3725, 86399, 86400, 90000, 360000];

describe('计数变体与原实现逐字对照', () => {
  it('formatCountW', () => {
    for (const n of [...COUNTS, ...NEG]) expect(formatCountW(n)).toBe(orig.countW(n));
    expect(formatCountW(12345)).toBe('1.2w');
    expect(formatCountW(3456)).toBe('3456');
    expect(formatCountW(-5)).toBe('-5');
    expect(formatCountW(NaN)).toBe('0');
    expect(formatCountW(undefined)).toBe('0');
    expect(formatCountW(null)).toBe('0');
  });

  it('formatCountWLocale', () => {
    for (const n of [...COUNTS, ...NEG, NaN, undefined]) expect(formatCountWLocale(n)).toBe(orig.countWLocale(n));
    expect(formatCountWLocale(9999)).toBe((9999).toLocaleString());
    expect(formatCountWLocale(12345)).toBe('1.2w');
    expect(formatCountWLocale(null)).toBe('0');
  });

  it('formatCountYiW', () => {
    for (const n of [...COUNTS, ...NEG, NaN, undefined, null]) expect(formatCountYiW(n)).toBe(orig.countYiW(n));
    expect(formatCountYiW(123456789)).toBe('1.2亿');
    expect(formatCountYiW(123456)).toBe('12.3w');
    expect(formatCountYiW(1234)).toBe('1234');
  });

  it('formatCountWan', () => {
    for (const n of [...COUNTS, ...NEG, NaN]) expect(formatCountWan(n)).toBe(orig.countWan(n));
    expect(formatCountWan(12345)).toBe('1.2万');
    expect(formatCountWan(-1)).toBe('0');
    expect(formatCountWan(undefined)).toBe('0');
  });

  it('formatCountWanK', () => {
    for (const n of [...COUNTS, ...NEG]) expect(formatCountWanK(n)).toBe(orig.countWanK(n));
    expect(formatCountWanK(12345)).toBe('1.2万');
    expect(formatCountWanK(3456)).toBe('3.5k');
    expect(formatCountWanK(NaN)).toBe('0');
    expect(formatCountWanK(null)).toBe('0');
  });

  it('formatCountWanYi', () => {
    for (const n of [...COUNTS, ...NEG]) expect(formatCountWanYi(n)).toBe(orig.countWanYi(n));
    expect(formatCountWanYi(123456789)).toBe('1.2亿');
    expect(formatCountWanYi(12345)).toBe('1.2万');
    expect(formatCountWanYi(NaN)).toBe('0');
    expect(formatCountWanYi(undefined)).toBe('0');
  });

  it('formatCount 与 MyHomePage / WorksManager / collection 的原实现一致', () => {
    for (const n of [...COUNTS, NaN]) expect(formatCount(n)).toBe(orig.countWK(n));
    // 原 WorksManager / collection 的 formatNum 没有负数保护,负数会原样显示;计数不会为负,收口后显示 0
    expect(formatCount(-5)).toBe('0');
  });
});

describe('时长变体与原实现逐字对照', () => {
  const frac = [0.4, 5.9, 65.5, 3725.99];

  it('formatDuration 与播放器里的 fmt 一致(含 Infinity)', () => {
    for (const s of [...SECS, ...frac, -1, NaN, Infinity, -Infinity]) expect(formatDuration(s)).toBe(orig.playerTime(s));
    expect(formatDuration(Infinity)).toBe('0:00');
  });

  it('formatDurationPadded', () => {
    for (const s of SECS) expect(formatDurationPadded(s)).toBe(orig.padded(s));
    expect(formatDurationPadded(65)).toBe('01:05');
    expect(formatDurationPadded(0)).toBe('00:00');
    expect(formatDurationPadded(-1)).toBe('00:00');
    expect(formatDurationPadded(NaN)).toBe('00:00');
    expect(formatDurationPadded(undefined)).toBe('00:00');
  });

  it('formatDurationLabel', () => {
    for (const s of [...SECS, ...frac, -1, NaN]) expect(formatDurationLabel(s)).toBe(orig.label(s));
    expect(formatDurationLabel(45)).toBe('45秒');
    expect(formatDurationLabel(3725)).toBe('62:05');
    expect(formatDurationLabel(undefined)).toBe('0:00');
  });

  it('formatDurationLabelLong', () => {
    for (const s of [...SECS, ...frac, -1, NaN]) expect(formatDurationLabelLong(s)).toBe(orig.labelLong(s));
    expect(formatDurationLabelLong(45)).toBe('45秒');
    expect(formatDurationLabelLong(65)).toBe('1:05');
    expect(formatDurationLabelLong(3725)).toBe('1:02:05');
    expect(formatDurationLabelLong(null)).toBe('0:00');
  });

  it('formatDurationHms', () => {
    for (const s of [...SECS, ...frac, -1, undefined]) expect(formatDurationHms(s)).toBe(orig.hms(s));
    expect(formatDurationHms(3725)).toBe('1h 02m');
    expect(formatDurationHms(187)).toBe('3m 07s');
    expect(formatDurationHms(5)).toBe('5s');
    expect(formatDurationHms(NaN)).toBe('-');
    expect(formatDurationHms(null)).toBe('-');
  });

  it('formatMs', () => {
    for (const ms of [0, 1, 850, 999, 1000, 3210, 59_999, 60_000, 125_000, 3_600_000, -5, NaN, undefined]) {
      expect(formatMs(ms)).toBe(orig.ms(ms));
    }
    expect(formatMs(850)).toBe('850ms');
    expect(formatMs(3210)).toBe('3.2s');
    expect(formatMs(125_000)).toBe('2m 5s');
    expect(formatMs(0)).toBe('-');
    expect(formatMs(null)).toBe('-');
  });
});

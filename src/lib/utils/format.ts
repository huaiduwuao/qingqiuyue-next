/**
 * 通用展示格式化。此前同样的实现在各页面里各抄一份,这里收口成唯一来源。
 * 口径不同的版本(有没有 k 档、用 w 还是 万、小数部分走 toLocaleString、带「秒」单位、毫秒耗时……)
 * 各自是一个有名字的变体函数,不往一个函数里塞参数;新增口径就加新变体并补测试。
 */

/** 计数缩写:12345 → 1.2w,3456 → 3.5k,其余原样;空值 / NaN / 负数显示 0 */
export function formatCount(n: number | null | undefined = 0): string {
  if (n == null || Number.isNaN(n) || n < 0) return '0';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** 只有 w 档:12345 → 1.2w,其余原样(没有 k 档,负数原样);空值 / NaN 显示 0 */
export function formatCountW(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '0';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  return String(n);
}

/** 只有 w 档,万以下走 toLocaleString(1234 → "1,234");空值 / NaN 当 0 */
export function formatCountWLocale(n: number | null | undefined): string {
  const v = Number(n) || 0;
  if (v >= 10000) return `${(v / 10000).toFixed(1)}w`;
  return v.toLocaleString();
}

/** 亿 + w 两档:1.2亿 / 3.4w,其余原样;空值 / NaN 当 0 */
export function formatCountYiW(n: number | null | undefined): string {
  const v = Number(n) || 0;
  if (v >= 100000000) return `${(v / 100000000).toFixed(1)}亿`;
  if (v >= 10000) return `${(v / 10000).toFixed(1)}w`;
  return String(v);
}

/** 只有「万」档:12345 → 1.2万,其余原样;空值 / NaN / 负数显示 0 */
export function formatCountWan(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n) || n < 0) return '0';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return String(n);
}

/** 「万」+ k 两档:1.2万 / 3.5k,其余原样(负数原样);空值 / NaN 显示 0 */
export function formatCountWanK(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '0';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** 亿 + 万 两档,万以下走 toLocaleString:1.2亿 / 3.4万 / 1,234;空值 / NaN 显示 0 */
export function formatCountWanYi(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '0';
  if (n >= 100000000) return (n / 100000000).toFixed(1) + '亿';
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  return n.toLocaleString();
}

/** 秒数 → m:ss(分钟不进位到小时,如 3725 → 62:05);空值 / NaN / Infinity / 负数显示 0:00 */
export function formatDuration(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** 秒数 → mm:ss,分钟也补零(通话计时:65 → 01:05);空值 / NaN / Infinity / 负数显示 00:00 */
export function formatDurationPadded(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return '00:00';
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

/** 不足一分钟写「N秒」,其余 m:ss(45 → 45秒,65 → 1:05);空值 / NaN / 负数显示 0:00 */
export function formatDurationLabel(sec: number | null | undefined): string {
  if (sec == null || Number.isNaN(sec) || sec < 0) return '0:00';
  if (sec < 60) return `${sec}秒`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** 同 formatDurationLabel,但满一小时进位成 h:mm:ss(3725 → 1:02:05) */
export function formatDurationLabelLong(sec: number | null | undefined): string {
  if (sec == null || Number.isNaN(sec) || sec < 0) return '0:00';
  if (sec < 60) return `${sec}秒`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}:${s.toString().padStart(2, '0')}`;
  const h = Math.floor(m / 60);
  return `${h}:${(m % 60).toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** 秒数 → 两级紧凑写法:1h 05m / 3m 07s / 5s;空值 / NaN / 负数显示 - */
export function formatDurationHms(sec: number | null | undefined): string {
  if (sec == null || Number.isNaN(sec) || sec < 0) return '-';
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${s}s`;
}

/** 毫秒耗时:850ms / 3.2s / 2m 5s;空值 / 0 / 负数显示 - */
export function formatMs(ms: number | null | undefined): string {
  if (!ms || ms < 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

/**
 * 时间值 → 毫秒时间戳;解析不了返回 NaN。
 * - number / 纯数字字符串:当作毫秒时间戳
 * - 后端部分接口给的 "2026-10-04 12:00:00"(日期和时间之间是空格):Chrome 认,Safari / iOS WebView
 *   直接 Invalid Date,这里先把空格换成 'T'(按本地时间解析,与 Chrome 的结果一致)
 * - 其余(ISO 8601 等)交给 Date.parse
 */
export function toTimestamp(v: number | string | Date | null | undefined): number {
  if (v == null || v === '') return NaN;
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  const s = v.trim();
  if (/^\d+$/.test(s)) return Number(s);
  const m = /^(\d{4}-\d{2}-\d{2})[ ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/.exec(s);
  return Date.parse(m ? `${m[1]}T${m[2]}` : s);
}

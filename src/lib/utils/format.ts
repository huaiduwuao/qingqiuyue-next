/**
 * 通用展示格式化。此前同样的实现在各页面里各抄一份,这里收口成唯一来源。
 * 口径不同的版本(万/亿、toLocaleString、带「秒/小时」单位、毫秒耗时等)仍留在各自页面,
 * 不要往这里硬塞参数。
 */

/** 计数缩写:12345 → 1.2w,3456 → 3.5k,其余原样;空值 / NaN / 负数显示 0 */
export function formatCount(n: number | null | undefined = 0): string {
  if (n == null || Number.isNaN(n) || n < 0) return '0';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** 秒数 → m:ss(分钟不进位到小时,如 3725 → 62:05);空值 / NaN / 负数显示 0:00 */
export function formatDuration(sec: number | null | undefined): string {
  if (sec == null || Number.isNaN(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
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

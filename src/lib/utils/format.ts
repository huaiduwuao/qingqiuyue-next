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

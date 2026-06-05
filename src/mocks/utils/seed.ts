/**
 * Mock seed utilities — 提供稳定、可分页的伪数据生成。
 * 不依赖 faker;通过简单数学 + 固定常量实现可重复结果。
 */

const PALETTE = ['#FE2C55', '#FFB400', '#25F4EE', '#8B5CF6', '#5DDB96', '#F59E0B', '#5DF7F2', '#A78BFA'];

export function pick<T>(arr: readonly T[], seed: number): T {
  return arr[seed % arr.length];
}

export function pickMany<T>(arr: readonly T[], n: number, seed: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[(seed * 7 + i * 13) % arr.length]);
  return out;
}

export function range(n: number, start = 0): number[] {
  return Array.from({ length: n }, (_, i) => start + i);
}

export function id(seed: number): string {
  return `id-${seed.toString(36)}`;
}

export function avatar(seed: number): string {
  return `https://picsum.photos/seed/${seed}/100/100`;
}

export function cover(w: number, h: number, seed: number): string {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}

export function color(seed: number): string {
  return pick(PALETTE, seed);
}

export function dateOffset(daysAgo: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export function fmtDate(d: Date): string {
  return d.toISOString();
}

export function paged<T>(records: T[], page: number, size: number): { records: T[]; totalRow: number } {
  const start = (page - 1) * size;
  return {
    records: records.slice(start, start + size),
    totalRow: records.length,
  };
}

export function pageOf<T>(arr: T[], page: number | undefined, size: number | undefined): { list: T[]; total: number } {
  const p = Math.max(1, page ?? 1);
  const s = Math.max(1, size ?? 20);
  const start = (p - 1) * s;
  return { list: arr.slice(start, start + s), total: arr.length };
}

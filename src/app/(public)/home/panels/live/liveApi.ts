// 直播目录的数据层:类型、请求、格式化。
//
// 平台不转播直播 —— 这里的直播间全部来自虎牙 / 斗鱼 / B站,只收录「谁在哪个平台播什么、
// 现在开没开、多少人在看」。人气(viewers)是源站最近一次给出的在线人数,每小时随抓取
// 刷新;0 表示源站没给,界面显示「—」而不是 0。开播时间、往期场次由后端 live_session
// 按刷新周期记录,精度到小时,所以一律写「约」。

import { homeClient } from '@/lib/api/client';
import type { EntityId } from '@/lib/id';

export type LivePlatform = 'huya' | 'douyu' | 'bilibili' | 'other';
export type LiveStatus = 'all' | 'live' | 'offline';
export type LiveSort = 'hot' | 'new';
export type RankBoard = 'now' | 'day' | 'week';
export type ClassicRange = 'week' | 'month' | 'all';

export interface LiveRoom {
  id: EntityId;
  streamerId?: EntityId;
  hostName: string;
  hostAvatar: string;
  title: string;
  cover: string;
  viewers: number;
  category: string;
  categoryLabel: string;
  area: string;
  platform: LivePlatform;
  platformLabel: string;
  sourceUrl: string;
  startedAt: number;
  isLive: boolean;
  hotRank: number;
  peakViewers?: number;
}

export interface LiveFacet {
  key: string;
  label: string;
  live: number;
  total: number;
  top?: LiveRoom;
}

export interface LiveOverview {
  total: number;
  live: number;
  updatedAt: number;
  platforms: LiveFacet[];
  categories: LiveFacet[];
}

export interface LiveClassic {
  id: EntityId;
  contentId: EntityId;
  streamerId?: EntityId;
  title: string;
  cover: string;
  hostName: string;
  hostAvatar: string;
  platform: LivePlatform;
  platformLabel: string;
  category: string;
  categoryLabel: string;
  area: string;
  startedAt: number;
  endedAt: number;
  peakOnline: number;
  peakAt: number;
  sourceUrl: string;
  isLive: boolean;
}

export interface LiveFilters {
  platform: string;
  category: string;
}

function filterParams(f: LiveFilters, extra: Record<string, string | number> = {}) {
  const p = new URLSearchParams();
  if (f.platform && f.platform !== 'all') p.set('platform', f.platform);
  if (f.category && f.category !== 'all') p.set('category', f.category);
  for (const [k, v] of Object.entries(extra)) p.set(k, String(v));
  return p.toString();
}

export function fetchOverview(platform: string) {
  const qs = platform && platform !== 'all' ? `?platform=${encodeURIComponent(platform)}` : '';
  return homeClient.get<LiveOverview>(`/live/overview${qs}`).then((r) => r.data);
}

export function fetchRank(board: RankBoard, f: LiveFilters, limit = 10) {
  return homeClient
    .get<{ board: RankBoard; list: LiveRoom[]; updatedAt: number; since: number }>(
      `/live/rank?${filterParams(f, { board, limit })}`,
    )
    .then((r) => r.data);
}

export function fetchRooms(f: LiveFilters & { status: LiveStatus; sort: LiveSort }, page: number, size: number) {
  const extra: Record<string, string | number> = { page, size };
  if (f.sort === 'new') extra.sort = 'new';
  else if (f.status !== 'all') extra.status = f.status;
  return homeClient
    .get<{ list: LiveRoom[]; total: number }>(`/live/rooms?${filterParams(f, extra)}`)
    .then((r) => r.data);
}

export function fetchClassics(range: ClassicRange, f: LiveFilters, limit = 12) {
  return homeClient
    .get<{ list: LiveClassic[]; since: number }>(`/live/classics?${filterParams(f, { range, limit })}`)
    .then((r) => r.data);
}

/** 平台品牌色,只用在小徽标上。 */
export const PLATFORM_COLOR: Record<string, string> = {
  huya: '#FF9600',
  douyu: '#FF5D23',
  bilibili: '#FB7299',
  other: '#8A8F98',
};

/** 人气:0 / 缺失显示「—」(源站没给),不是 0 人在看。 */
export function formatViewers(n?: number | null): string {
  const num = Number(n) || 0;
  if (num <= 0) return '—';
  if (num >= 1e8) return `${trim1(num / 1e8)}亿`;
  if (num >= 1e4) return `${trim1(num / 1e4)}万`;
  return String(Math.round(num));
}

function trim1(v: number): string {
  return v.toFixed(1).replace(/\.0$/, '');
}

/** 距今多久:刚刚 / N 分钟前 / N 小时前 / M月D日。ts、now 都是 unix 秒。 */
export function formatAgo(ts: number, now: number): string {
  if (!ts) return '';
  const d = Math.max(0, now - ts);
  if (d < 60) return '刚刚';
  if (d < 3600) return `${Math.floor(d / 60)} 分钟前`;
  if (d < 86400) return `${Math.floor(d / 3600)} 小时前`;
  return formatDay(ts);
}

/** 已播时长(本场开播时间来自每小时一次的抓取,按「约」显示)。 */
export function formatLiveFor(startedAt: number, now: number): string {
  if (!startedAt) return '';
  const d = Math.max(0, now - startedAt);
  if (d < 3600) return '刚开播';
  const h = Math.floor(d / 3600);
  return h >= 24 ? `已播约 ${Math.floor(h / 24)} 天` : `已播约 ${h} 小时`;
}

/** 一场的时长。起止都是「看到在播」的时刻,少算了最后一个刷新周期,补 1 小时。 */
export function formatDuration(start: number, end: number): string {
  if (!start || !end || end < start) return '';
  const h = Math.round((end - start) / 3600) + 1;
  return h >= 24 ? `约 ${Math.round(h / 24)} 天` : `约 ${h} 小时`;
}

export function formatDay(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function formatDayTime(ts: number): string {
  const d = new Date(ts * 1000);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDay(ts)} ${hh}:${mm}`;
}

/** 站外直播间地址只放行 http(s)。 */
export function externalLink(url?: string): string {
  return url && /^https?:\/\//.test(url) ? url : '';
}

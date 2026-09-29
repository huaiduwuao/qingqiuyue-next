/**
 * scene-ui/plazaFeeds.ts — 广场各个地标上摆的平台内容
 *
 * 地标不再只是「发一句话给数字人」:走过去就能看到平台里真实的东西,点了直接开 / 直接播。
 *
 *   放映亭 → 推荐里能看的影视        (recommend/feed, watchable=1)
 *   点唱机 → 本周热歌                (leaderboard MUSIC)
 *   书亭   → 今日一悟 + 热门小说     (insight/daily + leaderboard NOVEL)
 *   舞池   → 正在直播                (home/live/rooms?status=live)
 *   观星台 → 全网今日热榜            (trending?period=day)
 *   许愿池 → 许愿墙 + 正在悬赏       (plaza/wishes + demand/client/page?scope=market),见 WishWall
 *   感悟地标 → 题记 + 编者一问 + 这个主题的诗与作品 (insight/theme?key=)
 *
 * 每个加载器都把各自接口的形状收成同一种卡片,失败返回空列表(面板显示「暂时没有」)。
 */

import { fetchRecommend } from '@/apis/home-discover';
import { fetchLeaderboard, type LeaderboardEntry } from '@/apis/leaderboard';
import { getTrending } from '@/apis/recommend';
import { daily as insightDaily, theme as insightTheme } from '@/apis/insight';
import { listDemands } from '@/apis/reward-demand';
import { fetchRooms, type LiveRoom } from '@/app/(public)/home/panels/live/liveApi';
import { mediaUrl } from '@/lib/media';
import { contentHref } from './content';
import type { DisplaySlot } from '../vrm/sceneDisplays';
import { zoneFeed, type WorldZone, type ZoneFeedKind } from '../vrm/world/worldLayout';

/** 点卡片之后做什么 */
export type FeedAction =
  | { kind: 'open'; href: string; slot?: DisplaySlot }
  | { kind: 'play'; trackId: string };

export interface FeedCard {
  key: string;
  title: string;
  subtitle?: string;
  cover?: string;
  badge?: string;
  action: FeedAction | null;
}

export interface ZoneFeed {
  title: string;
  /** 卡片上方的一段话(今日一悟的句子之类) */
  lead?: { text: string; source?: string; action?: FeedAction };
  cards: FeedCard[];
  /** 面板底部「更多」去哪 */
  more?: { label: string; href: string };
  /** 点唱机:整张榜单做成队列时用 */
  tracks?: { id: string; title?: string; artist?: string; cover?: string }[];
}

const cover = (u?: string) => (u ? mediaUrl(u) : undefined);

function openContent(type: string, id: string | number, title: string, slot?: DisplaySlot): FeedAction | null {
  const href = contentHref({ id: String(id), contentType: String(type || '').toUpperCase(), title });
  return href ? { kind: 'open', href, slot } : null;
}

const fmtCount = (n?: number) => (!n ? undefined : n >= 10000 ? `${(n / 10000).toFixed(1)}万` : String(n));

async function cinema(): Promise<ZoneFeed> {
  const r = await fetchRecommend({ types: 'FILM,TELEPLAY,ANIMATION,VIDEO', size: 8, watchable: 1 }).catch(() => null);
  const list: any[] = r?.list ?? r?.items ?? [];
  return {
    title: '今日放映',
    cards: list.slice(0, 8).map((it) => ({
      key: String(it.id),
      title: it.title,
      subtitle: it.author || it.reason || undefined,
      cover: cover(it.cover),
      badge: it.contentType === 'FILM' ? '电影' : it.contentType === 'TELEPLAY' ? '剧集' : it.contentType === 'ANIMATION' ? '动漫' : '视频',
      action: openContent(it.contentType, it.id, it.title, 'wall'),
    })),
    more: { label: '去放映厅', href: '/home/recommend?tab=theater' },
  };
}

async function jukebox(): Promise<ZoneFeed> {
  const board = await fetchLeaderboard({ type: 'MUSIC', metric: 'hot', period: 'week', limit: 12 }).catch(() => null);
  const list: LeaderboardEntry[] = board?.list ?? [];
  return {
    title: '本周热歌',
    cards: list.map((e) => ({
      key: String(e.id),
      title: e.title,
      subtitle: e.author || undefined,
      cover: cover(e.cover),
      badge: `#${e.rank}`,
      action: { kind: 'play', trackId: String(e.id) },
    })),
    tracks: list.map((e) => ({ id: String(e.id), title: e.title, artist: e.author, cover: e.cover })),
    more: { label: '完整榜单', href: '/home/recommend?tab=rank' },
  };
}

async function books(): Promise<ZoneFeed> {
  const [d, board] = await Promise.all([
    insightDaily().catch(() => null),
    fetchLeaderboard({ type: 'NOVEL', metric: 'hot', period: 'week', limit: 8 }).catch(() => null),
  ]);
  const cards: FeedCard[] = (board?.list ?? []).map((e) => ({
    key: String(e.id),
    title: e.title,
    subtitle: e.author || undefined,
    cover: cover(e.cover),
    badge: `#${e.rank}`,
    action: openContent(e.contentType || 'NOVEL', e.id, e.title, 'kiosk'),
  }));
  const lead = d?.theme
    ? { text: d.theme.line, source: d.theme.lineSrc || d.theme.name, action: { kind: 'open' as const, href: '/insight', slot: 'kiosk' as DisplaySlot } }
    : undefined;
  if (d?.poem) {
    cards.unshift({
      key: `poem-${d.poem.id}`,
      title: d.poem.title,
      subtitle: [d.poem.dynasty, d.poem.author].filter(Boolean).join(' · ') || undefined,
      badge: '今日诗',
      action: openContent('POETRY', d.poem.id, d.poem.title, 'kiosk'),
    });
  }
  return { title: '今日一悟 · 热门小说', lead, cards, more: { label: '人生感悟专题', href: '/insight' } };
}

async function dance(): Promise<ZoneFeed> {
  const r = await fetchRooms({ platform: 'all', category: 'all', status: 'live', sort: 'hot' }, 1, 8).catch(() => null);
  const list: LiveRoom[] = r?.list ?? [];
  return {
    title: '正在直播',
    cards: list.map((room) => ({
      key: String(room.id),
      title: room.title || room.hostName,
      subtitle: [room.hostName, room.platformLabel].filter(Boolean).join(' · '),
      cover: cover(room.cover),
      badge: fmtCount(room.viewers) ? `🔥 ${fmtCount(room.viewers)}` : '直播中',
      action: openContent('LIVE', room.id, room.title || room.hostName, 'wall'),
    })),
    more: { label: '去直播频道', href: '/home/recommend?tab=live' },
  };
}

async function stars(): Promise<ZoneFeed> {
  const r: any = await getTrending({ period: 'day', limit: 10 }).catch(() => null);
  const list: any[] = r?.list ?? [];
  return {
    title: '全网今日热榜',
    cards: list.map((it) => ({
      key: String(it.id),
      title: it.title,
      subtitle: it.platformLabel || it.author || undefined,
      cover: cover(it.cover),
      badge: `#${it.rank}`,
      action: openContent(it.contentType, it.id, it.title),
    })),
    more: { label: '完整热榜', href: '/home/recommend?tab=rank' },
  };
}

/** 许愿池旁边的「正在悬赏」:别人的需求,点了去悬赏广场 */
export async function openBounties(): Promise<FeedCard[]> {
  const r: any = await listDemands({ scope: 'market', order: 'newest', pageNumber: 1, pageSize: 5 } as any).catch(() => null);
  const list: any[] = r?.list ?? r?.records ?? [];
  return list.slice(0, 5).map((d) => ({
    key: String(d.id),
    title: d.title,
    subtitle: d.username ? `${d.username} 发起` : undefined,
    cover: cover(d.cover),
    badge: d.pay ? `¥${d.pay}` : '悬赏',
    action: { kind: 'open', href: '/account/reward?tab=square' },
  }));
}

const TYPE_LABEL: Record<string, string> = { POETRY: '诗词', FILM: '电影', TELEPLAY: '剧集', ANIMATION: '动漫', SHORT_DRAMA: '短剧', NOVEL: '小说', MUSIC: '音乐', VIDEO: '视频', ARTICLE: '文章' };

/** 感悟地标:题记做引子,编者一问做标题,下面是这个主题命中的诗和各类作品(都是语料原文) */
async function insight(themeKey: string): Promise<ZoneFeed> {
  const r = await insightTheme(themeKey).catch(() => null);
  if (!r?.theme) return { title: '暂时连不上', cards: [] };
  const cards: FeedCard[] = [];
  for (const sec of r.sections ?? []) {
    const poetry = sec.contentType === 'POETRY';
    for (const it of (sec.items ?? []).slice(0, poetry ? 4 : 2)) {
      cards.push({
        key: sec.contentType + '-' + it.id,
        title: it.title,
        subtitle: poetry
          ? [[it.dynasty, it.author].filter(Boolean).join(' · '), it.excerpt].filter(Boolean).join('  ')
          : it.author || it.excerpt || undefined,
        cover: poetry ? undefined : cover(it.cover),
        badge: TYPE_LABEL[sec.contentType] ?? sec.contentType,
        // 诗和文字类在竖屏看,影视在大屏
        action: openContent(sec.contentType, it.id, it.title, ['POETRY', 'NOVEL', 'ARTICLE'].includes(sec.contentType) ? 'kiosk' : 'wall'),
      });
    }
  }
  const themeHref = '/insight/theme?key=' + encodeURIComponent(themeKey);
  return {
    title: r.theme.ask || r.theme.name,
    lead: { text: r.theme.line, source: r.theme.lineSrc, action: { kind: 'open', href: themeHref, slot: 'kiosk' } },
    cards,
    more: { label: '从古至今', href: themeHref + '&tab=timeline' },
  };
}

const FEEDS: Partial<Record<ZoneFeedKind, () => Promise<ZoneFeed>>> = { cinema, jukebox, books, dance, stars };

// 同一次进页面里切回来不重复请求:5 分钟内用缓存(按面板类型 + 主题)
const cache = new Map<string, { at: number; feed: ZoneFeed }>();
export async function loadZoneFeed(zone: WorldZone): Promise<ZoneFeed | null> {
  const kind = zoneFeed(zone);
  const key = kind === 'insight' ? 'insight:' + zone.themeKey : kind;
  const loader = kind === 'insight' ? (zone.themeKey ? () => insight(zone.themeKey!) : undefined) : FEEDS[kind];
  if (!loader) return null;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.feed;
  const feed = await loader();
  if (feed.cards.length > 0) cache.set(key, { at: Date.now(), feed });
  return feed;
}

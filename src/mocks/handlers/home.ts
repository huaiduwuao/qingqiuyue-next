/**
 * Home MSW handlers — Phase 3 改造:
 * 已接入真实后端的社交/me/侧边栏/AI 搜索端点走 passthrough,
 * 内容类端点(feed/live/theater/drama/werewolf)暂由 MSW 兜底(后端 handler 已实现,可逐步切 passthrough)。
 */

import { http, HttpResponse, passthrough } from 'msw';
import {
  FEED, LIVE_ROOMS, LIVE_TOP_10, THEATER_ITEMS, DRAMA_EPISODES, DRAMA_SERIES,
  WEREWOLF_PLAYERS, WEREWOLF_VIDEO, WEREWOLF_FEED,
} from '../db/home';

const ok = <T,>(data: T) => HttpResponse.json({ code: 200, msg: 'OK', data });
const okList = <T,>(list: T[], total: number) => ok({ list, total });

export const homeHandlers = [
  // ─── 已接入真实后端:me / 社交 / 好友 ───
  http.get('*/api/content/home/me/profile', () => passthrough()),
  http.post('*/api/content/home/me/profile', () => passthrough()),
  http.get('*/api/content/home/me/list', () => passthrough()),
  http.post('*/api/content/home/me/batch-delete', () => passthrough()),
  http.post('*/api/content/home/me/toggle-private', () => passthrough()),

  http.get('*/api/content/home/follow/state', () => passthrough()),
  http.get('*/api/content/home/follow/list', () => passthrough()),
  http.post('*/api/content/home/follow/:userId', () => passthrough()),
  http.delete('*/api/content/home/follow/:userId', () => passthrough()),

  http.get('*/api/content/home/friend/list', () => passthrough()),
  http.get('*/api/content/home/friend/stats', () => passthrough()),
  http.post('*/api/content/home/friend/:userId', () => passthrough()),
  http.delete('*/api/content/home/friend/:userId', () => passthrough()),

  http.get('*/api/content/home/friend/requests', () => passthrough()),
  http.get('*/api/content/home/friend/requests/sent', () => passthrough()),
  http.post('*/api/content/home/friend/requests/:id/accept', () => passthrough()),
  http.post('*/api/content/home/friend/requests/:id/reject', () => passthrough()),
  http.post('*/api/content/home/friend/requests/sent/:id/cancel', () => passthrough()),

  http.get('*/api/content/home/suggestions', () => passthrough()),

  // ─── 已接入真实后端:侧边栏 / AI 搜索 ───
  http.get('*/api/content/home/side/comments', () => passthrough()),
  http.get('*/api/content/home/side/related', () => passthrough()),
  http.get('*/api/content/home/ai/search', () => passthrough()),

  // ─── 仍由 MSW 兜底:内容类面板(后端已有真实 handler,后续可切 passthrough) ───
  http.get('*/api/content/home/feed', ({ request }) => {
    const url = new URL(request.url);
    const tab = url.searchParams.get('tab') || 'recommend';
    const section = url.searchParams.get('section') || 'recommend';
    const category = url.searchParams.get('category') || 'all';
    const page = Number(url.searchParams.get('page') || 1);
    const base = (FEED as any)[tab] || FEED.recommend;
    const baseArr: any[] = typeof base === 'function' ? base() : base;
    let filtered = baseArr;
    if (section && section !== 'recommend') {
      filtered = filtered.filter((i) => i.section === section);
    }
    if (category && category !== 'all') {
      filtered = filtered.filter((i) => i.category === category);
    }
    return ok({ list: filtered, total: filtered.length, page, size: 20 });
  }),

  http.get('*/api/content/home/live/rooms', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const sort = url.searchParams.get('sort');
    let list = [...LIVE_ROOMS];
    if (status === 'live') list = list.filter((r) => r.isLive);
    else if (status === 'offline') list = list.filter((r) => !r.isLive);
    if (sort === 'new') list.sort((a, b) => b.startedAt - a.startedAt);
    else list.sort((a, b) => b.viewers - a.viewers);
    return ok({ list, total: list.length });
  }),

  http.get('*/api/content/home/live/top', () => ok({ list: LIVE_TOP_10, total: LIVE_TOP_10.length, updatedAt: Date.now() })),

  http.get('*/api/content/home/theater/items', ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const filtered = category ? THEATER_ITEMS.filter((i) => i.category === category) : THEATER_ITEMS;
    return ok({ list: filtered, total: filtered.length });
  }),

  http.get('*/api/content/home/drama/episodes', ({ request }) => {
    const url = new URL(request.url);
    const dramaId = Number(url.searchParams.get('dramaId') || 9000);
    return ok({ list: DRAMA_EPISODES, total: DRAMA_EPISODES.length, dramaId });
  }),

  http.get('*/api/content/home/drama/series', ({ request }) => {
    const url = new URL(request.url);
    const genre = url.searchParams.get('genre') || '';
    const status = url.searchParams.get('status') || 'ALL';
    let list = [...DRAMA_SERIES];
    if (genre) list = list.filter((d) => d.genre === genre);
    if (status && status !== 'ALL') list = list.filter((d) => d.status === status);
    return okList(list, list.length);
  }),

  http.get('*/api/content/home/drama/top', ({ request }) => {
    const url = new URL(request.url);
    const genre = url.searchParams.get('genre') || '';
    const status = url.searchParams.get('status') || 'ALL';
    let pool = [...DRAMA_SERIES];
    if (genre) pool = pool.filter((d) => d.genre === genre);
    if (status && status !== 'ALL') pool = pool.filter((d) => d.status === status);
    const list = pool
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
      .map((d, i) => ({ ...d, hotRank: i + 1 }));
    return okList(list, list.length);
  }),

  http.get('*/api/content/home/theater/top', ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const pool = category && category !== 'all' ? THEATER_ITEMS.filter((t) => t.category === category) : THEATER_ITEMS;
    const list = [...pool]
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
      .map((item, i) => ({ ...item, hotRank: i + 1 }));
    return okList(list, list.length);
  }),

  // 狼人杀(暂无真实业务表,仍 mock)
  http.get('*/api/content/home/werewolf/video', () => ok(WEREWOLF_VIDEO)),
  http.get('*/api/content/home/werewolf/feed', () => okList(WEREWOLF_FEED, WEREWOLF_FEED.length)),
  http.get('*/api/content/home/werewolf/players', () => okList(WEREWOLF_PLAYERS, WEREWOLF_PLAYERS.length)),
  http.post('*/api/content/home/werewolf/like', () => ok({ liked: true, likes: WEREWOLF_VIDEO.likes + 1 })),
  http.post('*/api/content/home/werewolf/collect', () => ok({ collected: true, collects: WEREWOLF_VIDEO.collects + 1 })),
];

/**
 * Home MSW handlers — Phase 3 改造:
 * 已接入真实后端的社交/me/侧边栏/AI 搜索/内容类面板端点走 passthrough,
 * 狼人杀暂无真实业务表,仍由 MSW 兜底。
 */

import { http, HttpResponse, passthrough } from 'msw';
import {
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

  // ─── 已接入真实后端:内容类面板 ───
  http.get('*/api/content/home/feed', () => passthrough()),
  http.get('*/api/content/home/live/rooms', () => passthrough()),
  http.get('*/api/content/home/live/top', () => passthrough()),
  http.get('*/api/content/home/theater/items', () => passthrough()),
  http.get('*/api/content/home/theater/top', () => passthrough()),
  http.get('*/api/content/home/drama/episodes', () => passthrough()),
  http.get('*/api/content/home/drama/series', () => passthrough()),
  http.get('*/api/content/home/drama/top', () => passthrough()),

  // 狼人杀(暂无真实业务表,仍 mock)
  http.get('*/api/content/home/werewolf/video', () => ok(WEREWOLF_VIDEO)),
  http.get('*/api/content/home/werewolf/feed', () => okList(WEREWOLF_FEED, WEREWOLF_FEED.length)),
  http.get('*/api/content/home/werewolf/players', () => okList(WEREWOLF_PLAYERS, WEREWOLF_PLAYERS.length)),
  http.post('*/api/content/home/werewolf/like', () => ok({ liked: true, likes: WEREWOLF_VIDEO.likes + 1 })),
  http.post('*/api/content/home/werewolf/collect', () => ok({ collected: true, collects: WEREWOLF_VIDEO.collects + 1 })),
];

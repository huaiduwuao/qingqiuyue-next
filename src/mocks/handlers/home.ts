/**
 * Home MSW handlers — Phase 3 改造:
 * 所有接口走 passthrough 让后端接管。
 */

import { http, passthrough } from 'msw';

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
];

/**
 * Home MSW handlers — Phase 3 用的 7 菜单内容区端点。
 */

import { http, HttpResponse } from 'msw';
import {
  MY_PROFILE, FEED, LIVE_ROOMS, LIVE_TOP_10, THEATER_ITEMS, DRAMA_EPISODES, DRAMA_SERIES, DRAMA_TOP_10, THEATER_TOP_10,
  AI_SEARCH_CHUNKS, WEREWOLF_PLAYERS, WEREWOLF_VIDEO, SIDE_COMMENTS, SIDE_RELATED,
  CURRENT_USER_ID, getUser, followUser, unfollowUser, addFriend, removeFriend,
  acceptFriendRequest, rejectFriendRequest, suggestFollowUsers, suggestFriendUsers,
  isFollowing, isFriend, FRIEND_REQUESTS,
} from '../db/home';

const ok = <T,>(data: T) => HttpResponse.json({ code: 200, msg: 'OK', data });
const okList = <T,>(list: T[], total: number) => ok({ list, total });

export const homeHandlers = [
  http.get('*/api/home/me/profile', () => ok(MY_PROFILE)),

  http.get('*/api/home/feed', ({ request }) => {
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

  // ─── 关注/朋友 关系 API ───
  http.get('*/api/home/follow/state', ({ request }) => {
    const url = new URL(request.url);
    const userId = Number(url.searchParams.get('userId') || 0);
    return ok({ userId, isFollowing: isFollowing(userId), isFriend: isFriend(userId) });
  }),

  http.post('*/api/home/follow/:userId', ({ params }) => {
    const userId = Number(params.userId);
    const target = getUser(userId);
    if (!target) return ok({ ok: false, msg: '用户不存在' });
    followUser(userId);
    return ok({ ok: true, isFollowing: true, isFriend: isFriend(userId) });
  }),

  http.delete('*/api/home/follow/:userId', ({ params }) => {
    const userId = Number(params.userId);
    unfollowUser(userId);
    return ok({ ok: true, isFollowing: false, isFriend: false });
  }),

  http.post('*/api/home/friend/:userId', ({ params }) => {
    const userId = Number(params.userId);
    addFriend(userId);
    return ok({ ok: true, isFriend: true });
  }),

  http.delete('*/api/home/friend/:userId', ({ params }) => {
    const userId = Number(params.userId);
    removeFriend(userId);
    return ok({ ok: true, isFriend: false });
  }),

  // 好友请求
  http.get('*/api/home/friend/requests', () => okList(FRIEND_REQUESTS, FRIEND_REQUESTS.length)),
  http.post('*/api/home/friend/requests/:id/accept', ({ params }) => {
    const r = acceptFriendRequest(Number(params.id));
    return r ? ok(r) : ok({ ok: false, msg: '请求不存在' });
  }),
  http.post('*/api/home/friend/requests/:id/reject', ({ params }) => {
    const r = rejectFriendRequest(Number(params.id));
    return r ? ok(r) : ok({ ok: false, msg: '请求不存在' });
  }),

  // 推荐用户(关注/朋友 空态用)
  http.get('*/api/home/suggestions', ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'follow';
    const limit = Number(url.searchParams.get('limit') || 8);
    const list = type === 'friend' ? suggestFriendUsers(limit) : suggestFollowUsers(limit);
    return okList(list, list.length);
  }),

  http.get('*/api/home/werewolf/video', () => ok(WEREWOLF_VIDEO)),
  http.get('*/api/home/werewolf/players', () => okList(WEREWOLF_PLAYERS, WEREWOLF_PLAYERS.length)),
  http.post('*/api/home/werewolf/like', () => ok({ liked: true, likes: WEREWOLF_VIDEO.likes + 1 })),
  http.post('*/api/home/werewolf/collect', () => ok({ collected: true, collects: WEREWOLF_VIDEO.collects + 1 })),

  http.get('*/api/home/live/rooms', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status'); // 'live' | 'offline' | null
    const sort = url.searchParams.get('sort');     // 'hot' | 'new' | null
    let list = [...LIVE_ROOMS];
    if (status === 'live') list = list.filter((r) => r.isLive);
    else if (status === 'offline') list = list.filter((r) => !r.isLive);
    if (sort === 'new') list.sort((a, b) => b.startedAt - a.startedAt);
    else list.sort((a, b) => b.viewers - a.viewers);
    return ok({ list, total: list.length });
  }),

  http.get('*/api/home/live/top', () => ok({ list: LIVE_TOP_10, total: LIVE_TOP_10.length, updatedAt: Date.now() })),

  http.get('*/api/home/theater/items', ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const filtered = category ? THEATER_ITEMS.filter((i) => i.category === category) : THEATER_ITEMS;
    return ok({ list: filtered, total: filtered.length });
  }),

  http.get('*/api/home/drama/episodes', ({ request }) => {
    const url = new URL(request.url);
    const dramaId = Number(url.searchParams.get('dramaId') || 9000);
    return ok({ list: DRAMA_EPISODES, total: DRAMA_EPISODES.length, dramaId });
  }),

  // 短剧系列(支持题材 + 状态双过滤)
  http.get('*/api/home/drama/series', ({ request }) => {
    const url = new URL(request.url);
    const genre = url.searchParams.get('genre') || '';
    const status = url.searchParams.get('status') || 'ALL';
    let list = [...DRAMA_SERIES];
    if (genre) list = list.filter((d) => d.genre === genre);
    if (status && status !== 'ALL') list = list.filter((d) => d.status === status);
    return okList(list, list.length);
  }),

  // 短剧 Top 10(支持题材 + 状态过滤,每个筛选维度下取 top 10)
  http.get('*/api/home/drama/top', ({ request }) => {
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

  // 放映厅 Top 10(每个分类内部取 top 10,而不是在全局 top 10 中过滤)
  http.get('*/api/home/theater/top', ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    let pool = category && category !== 'all' ? THEATER_ITEMS.filter((t) => t.category === category) : THEATER_ITEMS;
    const list = [...pool]
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
      .map((item, i) => ({ ...item, hotRank: i + 1 }));
    return okList(list, list.length);
  }),

  http.get('*/api/home/ai/search', ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') || '';
    const chunks = AI_SEARCH_CHUNKS[q] || AI_SEARCH_CHUNKS.default;
    return ok({ query: q, chunks });
  }),

  http.get('*/api/home/side/comments', () => okList(SIDE_COMMENTS, SIDE_COMMENTS.length)),
  http.get('*/api/home/side/related', () => okList(SIDE_RELATED, SIDE_RELATED.length)),
];

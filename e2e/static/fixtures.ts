import { ok, page$, type MockRule } from './mock';

/**
 * 各页面用到的接口 fixture。形状对照前端 src/apis/* 的类型和 qingqiuyue-go 的 handler/vo:
 * 一律走 { code, msg, data } 信封,分页是 data = { list, total, page, pageSize }。
 */

/** 所有页面都会打的公共接口(埋点、字典、侧栏热榜等) */
export const COMMON: MockRule[] = [
  { method: 'POST', path: /^\/content\/behavior$/, body: ok(null) },
  { method: 'POST', path: /^\/content\/search\/feedback$/, body: ok(null) },
  { path: /^\/content\/dict\/types$/, body: ok([{ id: 1, name: '小说', code: 'NOVEL', sort: 1 }, { id: 2, name: '视频', code: 'VIDEO', sort: 2 }]) },
  { path: /^\/content\/home\/side\/hot$/, body: ok({ list: [] }) },
  { path: /^\/content\/topic\/hot$/, body: ok([]) },
  { path: /^\/content\/recommend\/feed$/, body: ok({ list: [], total: 0, hasMore: false }) },
  { path: /^\/content\/recommend\/related$/, body: ok({ list: [], total: 0, hasMore: false }) },
  { path: /^\/content\/availability$/, body: ok({ items: {} }) },
  // 规则下发拿不到时前端用内置默认规则(lib/localStream/rules)
  { path: /^\/content\/stream\/rules$/, body: ok(null) },
  {
    path: /^\/content\/interaction$/,
    body: (_req: unknown, url: URL) =>
      ok({ contentId: url.searchParams.get('contentId'), loggedIn: false, liked: false, disliked: false, collected: false, agreeNum: 0, collectNum: 0 }),
  },
  { path: /^\/content\/mark\/status$/, body: ok({ watchlater: false, reserve: false }) },
  { path: /^\/content\/module\/content\/comment\/[^/]+$/, body: page$([]) },
];

// ── 视频详情 ──
export const VIDEO_ID = '880001';
export const VIDEO: MockRule[] = [
  {
    path: /^\/content\/client-content\/video\/detail$/,
    body: ok({
      id: VIDEO_ID,
      title: 'E2E 测试视频',
      cover: '',
      uploaderId: 20001,
      uploaderName: 'E2E UP',
      uploaderAvatar: '',
      fans: 0,
      description: '冒烟用 6 秒测试片',
      duration: 6,
      // 同源 MinIO 路径:不经外站探测,按 .mp4 走原生 <video>;内容由 mock.ts 的 /qq-video/ 路由给出
      videoUrl: '/qq-video/e2e/tiny.mp4',
      viewCount: 1,
      likeCount: 0,
      commentCount: 0,
      publishTime: '2026-10-01T08:00:00+08:00',
      tags: [],
    }),
  },
];

// ── 首页 ──
export const novel = (id: number) => ({
  id,
  title: `E2E 小说 ${id}`,
  contentType: 'NOVEL',
  cover: '',
  status: 'PUBLISHED',
  viewCount: 100 + id,
  collectCount: id,
});

export const LEADERBOARD: MockRule[] = [
  {
    path: /^\/content\/home\/leaderboard\/catalog$/,
    body: ok({
      builtAt: '2026-10-04T08:00:00+08:00',
      types: [{ code: 'ALL', name: '总榜', count: 1, categories: [] }],
      metrics: [{ key: 'hot', name: '热度榜', desc: '综合热度', periods: ['day', 'week'] }],
      periods: [
        { key: 'day', name: '日榜', compare: '较昨日' },
        { key: 'week', name: '周榜', compare: '较上周' },
      ],
    }),
  },
  {
    path: /^\/content\/home\/leaderboard$/,
    body: ok({
      type: 'ALL',
      category: '',
      metric: 'hot',
      period: 'day',
      compared: false,
      signals: ['behavior'],
      total: 1,
      offset: 0,
      builtAt: '2026-10-04T08:00:00+08:00',
      list: [{ id: '501', rank: 1, title: 'E2E 榜单作品', cover: '', contentType: 'NOVEL', score: 90, views: 10, likes: 1, collects: 1, comments: 0 }],
    }),
  },
  { path: /^\/content\/trending\/platforms$/, body: ok({ list: [] }) },
  { path: /^\/content\/trending$/, body: ok({ list: [] }) },
];

const ROOM = {
  id: '9001',
  hostName: 'E2E 主播',
  hostAvatar: '',
  title: 'E2E 直播间',
  cover: '',
  viewers: 1234,
  category: 'game',
  categoryLabel: '游戏',
  area: '',
  platform: 'douyu',
  platformLabel: '斗鱼',
  sourceUrl: '',
  startedAt: 1790000000,
  isLive: true,
  hotRank: 1,
};
export const LIVE: MockRule[] = [
  {
    path: /^\/content\/home\/live\/overview$/,
    body: ok({ total: 1, live: 1, updatedAt: 1790000000, platforms: [], categories: [] }),
  },
  { path: /^\/content\/home\/live\/rank$/, body: ok({ list: [ROOM] }) },
  { path: /^\/content\/home\/live\/rooms$/, body: ok({ list: [ROOM], total: 1 }) },
  { path: /^\/content\/home\/live\/classics$/, body: ok({ list: [], since: 0 }) },
];

// ── 系统消息 ──
/** 作品下架通知:info 里只有 contentId(超过 2^53 的雪花 id,验证不丢精度) */
export const TAKEDOWN_ID = '1234567890123456789';
export const systemNotices = () => [
  {
    id: 7001,
    type: 'system',
    title: '作品已被下架',
    content: '你的作品《E2E 示例》因版权投诉已下架',
    info: `{"contentId":${TAKEDOWN_ID}}`,
    status: 'UNREAD',
    // 今天的时间 → 列表显示「今天 HH:mm」
    createTime: new Date(Date.now() - 60_000).toISOString(),
  },
  {
    id: 7002,
    type: 'system',
    title: '审核未通过',
    content: '高清发布审核未通过',
    info: '{"reviewId":3,"contentId":5,"status":"rejected"}',
    status: 'READ',
    createTime: new Date(Date.now() - 3 * 86400_000).toISOString(),
  },
];

export const NOTICE: MockRule[] = [
  { path: /^\/core\/notice\/system\/list$/, body: () => page$(systemNotices()) },
  { path: /^\/core\/notice\/interaction\/list$/, body: page$([]) },
  { path: /^\/core\/notice\/count$/, body: ok({ total: 1, system: 1, interaction: 0 }) },
  { method: 'POST', path: /^\/core\/notice\/(system|interaction)\/read(All)?$/, body: ok(null) },
  // 点进去的通用详情页
  { path: /^\/content\/module\/content\/(client\/)?detail$/, body: ok({ id: TAKEDOWN_ID, title: '已下架作品', status: 'OFFLINE' }) },
];

// ── 充值 ──
export const RECHARGE: MockRule[] = [
  {
    path: /^\/core\/payment\/diamond-packages$/,
    body: ok([
      { id: 1, name: '60 钻', diamondAmount: 60, priceCents: 600 },
      { id: 2, name: '300 钻', diamondAmount: 300, priceCents: 3000, originalPriceCents: 3300 },
    ]),
  },
  { path: /^\/core\/recharge\/benefits$/, body: ok({ list: [] }) },
  { path: /^\/core\/recharge\/activity$/, body: ok(null) },
  { path: /^\/core\/wallet$/, body: ok({ id: 1, userId: 10001, balance: 0, frozen: 0, updateTime: '2026-10-04T08:00:00+08:00' }) },
  { path: /^\/core\/wallet\/transactions$/, body: ok({ list: [], total: 0, page: 1 }) },
];

// ── 搜索 ──
export const SEARCH_KW = '月光';
export const searchHit = (i: number) => ({
  id: String(660000 + i),
  title: `${SEARCH_KW}之下 第${i}部`,
  contentType: 'NOVEL',
  cover: '',
  author: 'E2E 作者',
  score: 1 - i / 100,
  usable: true,
});
export const SEARCH: MockRule[] = [
  {
    path: /^\/content\/search$/,
    body: (_req: unknown, url: URL) =>
      ok({ list: url.searchParams.get('kw') ? Array.from({ length: 6 }, (_, i) => searchHit(i + 1)) : [], total: 6, hasMore: false }),
  },
  { path: /^\/core\/user\/suggest$/, body: ok([]) },
  { path: /^\/content\/module\/content\/suggest$/, body: page$([]) },
  { path: /^\/content\/analytics\/hot$/, body: ok({ list: [] }) },
];

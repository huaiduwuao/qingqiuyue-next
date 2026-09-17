import { contentClient } from '@/lib/api/client';
import type { EntityId } from '@/lib/id';

// 行为上报 → content-api POST /api/content/behavior
// itemId 是内容 id(超 2^53 的 BIGINT),按字符串原样上报,后端 jsonfix.Int64 接收。
export const reportBehavior = (data: {
  userId?: number; itemId: EntityId; itemType?: string; action?: string; duration?: number;
}) => contentClient('/behavior', { method: 'POST', data });

// 内容播放状态。后端 internal/playability 判定后随 feed / trending 一起下发。
//   playable       —— 拿到了可播放流
//   pending_repair —— **故障**:应该能播但现在播不了,展示 repairNotice
//   live_offline   —— **不是故障**:直播间当前没人开播。这是直播内容的正常状态,
//                     提示语刻意不含"修复"二字 —— 没有任何东西坏了
//   not_applicable —— 小说/漫画/文章,不进播放器
//   unknown        —— 尚未判定
//   bandwidth_limited —— **不是故障**:流解析得出来,但源站校验 Referer,本站不替
//                     它付视频带宽。提示"因带宽成本暂不支持站内播放",给去原站的入口
//   embeddable     —— 不走本站播放器,但源站有官方外链播放器,iframe 嵌在本站页面里播
//                     (embedUrl / embedProvider 随之下发;sourceUrl 是源站页面,不是流)。
//                     站内看得到画面,不要当成不可播去打标或过滤
export type PlaybackStatus =
  | 'playable'
  | 'pending_repair'
  | 'live_offline'
  | 'bandwidth_limited'
  | 'embeddable'
  | 'not_applicable'
  | 'unknown';

// 推荐内容项
export interface FeedItem {
  // 字符串形 id。内容 id 是雪花算法生成的 int64,超过 JS 的 2^53 安全整数范围,
  // 用 number 接会丢精度 —— 后端 Item.IDString 就是为此存在的。
  id: string;
  title: string;
  cover: string;
  author: string;
  contentType: string;
  score: number;
  /** 命中的全部召回通道,便于线上归因:i2i / u2u / hot / fresh / tag / quality / editor */
  channels?: string[];
  /** 主召回通道(兼容旧字段) */
  reason: string;
  metadata?: string;

  // ── 播放性 ──
  // sourceUrl 只有确实可播时才是可播地址;不可播时是空串,而不是一条无关的
  // 演示视频 —— 后者会把"内容坏了"伪装成"内容好着呢"。
  sourceUrl?: string;
  playable?: boolean;
  playbackStatus?: PlaybackStatus;
  /** 面向用户的中文提示,仅 pending_repair 时非空 */
  repairNotice?: string;
  /** playbackStatus=embeddable 时:源站官方外链播放器的 iframe 地址与平台名 */
  embedUrl?: string;
  embedProvider?: string;
}

export interface FeedResult {
  list: FeedItem[];
  total: number;
  hasMore: boolean;
}

// 个性化 feed → GET /api/content/recommend/feed
// 链路:画像 → 多路召回(i2i/u2u/hot/fresh/tag/quality/editor)→ 过滤 → 排序。
export const recommendFeed = (params: {
  userId?: number; types?: string; type?: string; size?: number; page?: number;
}) => contentClient('/recommend/feed', { params });

// 历史别名,与 /recommend/feed 是同一条链路。早期"增强版"曾是独立实现,现已合并。
export const getPersonalFeed = (params: { userId: number; type?: string; size?: number }) =>
  contentClient('/recommend/personal', { params });

// 相关推荐 → GET /api/content/recommend/related?seedId=
// 以种子内容为中心的 i2i 召回(向量相似 + 同作者/同标签),已排除种子自身。
// seedId 用字符串:内容 id 是超出 2^53 的雪花 id。
export const getRelated = (params: { seedId: string | number; userId?: number; types?: string; size?: number }) =>
  contentClient<FeedResult>('/recommend/related', { params });

// 热榜 → GET /api/content/analytics/hot
export const getHotRanking = (params: { type?: string; limit?: number }) =>
  contentClient('/analytics/hot', { params });

// 负反馈("不感兴趣")→ POST /api/content/recommend/feedback
// 累计到阈值(默认 2 次)后,该内容不再推给这个用户。
export const reportRecommendFeedback = (params: { userId: number; contentId: number }) =>
  contentClient('/recommend/feedback', { method: 'POST', data: params });

// 单条内容的播放性判定 → GET /api/content/playability/:id
// 想在渲染播放器之前先问一次的场景用它:拿到 pending_repair 就直接展示
// "内容修复中",不用先渲染播放器再失败。
export const getPlayability = (contentId: string | number) =>
  contentClient(`/playability/${contentId}`);

// ── 全网热门资源索引 ──────────────────────────────────────────────────
// 后端 internal/trending:把各平台的"热"归并成一张索引表。与 /analytics/hot
// 的区别是它跨平台、带平台归属和时间窗口,而不是单一内容类型的站内热度。

export type TrendingPeriod = 'realtime' | 'day' | 'week';

export interface TrendingItem {
  /** 字符串形 id,避免 JS 2^53 精度损失 */
  id: string;
  rank: number;
  title: string;
  cover: string;
  author?: string;
  contentType: string;
  /** 平台短码:bilibili / huya / douyin / zhihu ... */
  platform: string;
  /** 平台展示名:B站 / 虎牙直播 / 抖音 / 知乎 ... */
  platformLabel: string;
  sourceUrl?: string;
  hotScore: number;
  /** 在源站榜单里的位次;0/缺省表示这条不是从榜单抓来的 */
  externalRank?: number;
  behaviorScore: number;
  freshness: number;
  publishTime: string;
  // 播放性,与 feed 同一套语义
  playable: boolean;
  playbackStatus: PlaybackStatus;
  repairNotice?: string;
}

export interface TrendingResult {
  period: TrendingPeriod;
  platform?: string;
  total: number;
  buildTime: string;
  list: TrendingItem[];
}

export interface TrendingPlatform {
  platform: string;
  label: string;
  count: number;
  topScore: number;
}

// 全网热门索引 → GET /api/content/trending
export const getTrending = (params: {
  period?: TrendingPeriod;
  platform?: string;
  type?: string;
  limit?: number;
  /** 只要能播的。文本类内容(小说/文章)不受影响,它们本来就不进播放器 */
  playableOnly?: 1;
}) => contentClient('/trending', { params });

// 索引覆盖的平台分布 → GET /api/content/trending/platforms
// 前端的平台筛选栏直接消费它,不必再硬编码一份平台列表 ——
// 爬虫接入新平台后筛选栏自动多一项。
export const getTrendingPlatforms = (params: { period?: TrendingPeriod } = {}) =>
  contentClient('/trending/platforms', { params });

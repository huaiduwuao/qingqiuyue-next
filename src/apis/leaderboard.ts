import { contentClient } from '@/lib/api/client';

// 排行榜 —— 后端 internal/leaderboard。
// 一张榜 = 类型 × 分类 × 榜型 × 时间窗。类型、分类、榜型、时间窗全部来自
// /home/leaderboard/catalog,前端不写死任何一项:后台字典加一个子分类、爬虫
// 接入一个新分区,筛选栏自动多一项。

export type LeaderboardMetric = 'hot' | 'rising' | 'new' | 'praise';
export type LeaderboardPeriod = 'day' | 'week' | 'month' | 'all';

export interface LeaderboardCategory {
  /** dict:<code> / tag:<标签> / source:<平台> */
  key: string;
  name: string;
  kind: 'dict' | 'tag' | 'source';
  count: number;
}

export interface LeaderboardType {
  /** ALL = 跨类型总榜 */
  code: string;
  name: string;
  count: number;
  categories: LeaderboardCategory[];
}

export interface LeaderboardMetricInfo {
  key: LeaderboardMetric;
  name: string;
  desc: string;
  /** 空数组 = 该榜型不分时间窗 */
  periods: LeaderboardPeriod[];
}

export interface LeaderboardPeriodInfo {
  key: LeaderboardPeriod;
  name: string;
  /** 升降对比的口径文案:较昨日 / 较上周 / 较上月 */
  compare: string;
}

export interface LeaderboardCatalog {
  builtAt: string;
  types: LeaderboardType[];
  metrics: LeaderboardMetricInfo[];
  periods: LeaderboardPeriodInfo[];
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  title: string;
  cover: string;
  author?: string;
  contentType: string;
  source?: string;
  labels?: string[];
  /** 0..100 本榜合成分;新作榜恒为 0 */
  score: number;
  /** 较上期上升几名(负数下降);缺省 = 没有可比的上期 */
  delta?: number;
  isNew?: boolean;
  /** 在全网热榜上的名次 */
  trendingRank?: number;
  rating?: number;
  views: number;
  likes: number;
  collects: number;
  comments: number;
  publishTime?: string;
}

export interface LeaderboardBoard {
  type: string;
  category: string;
  categoryName?: string;
  metric: LeaderboardMetric;
  period?: LeaderboardPeriod;
  /** 飙升榜依据:delta = 与上期比;fresh = 暂无上期快照,按新上榜热度排 */
  basis?: 'delta' | 'fresh';
  compared: boolean;
  /** 实际参与排序的信号,见 SIGNAL_LABEL */
  signals: string[];
  total: number;
  offset: number;
  builtAt: string;
  list: LeaderboardEntry[];
}

export const SIGNAL_LABEL: Record<string, string> = {
  external: '全网热度',
  behavior: '站内行为',
  engagement: '互动',
  freshness: '新鲜度',
  rating: '评分',
  approval: '点赞收藏',
};

export interface LeaderboardQuery {
  type?: string;
  category?: string;
  metric?: LeaderboardMetric;
  period?: LeaderboardPeriod;
  offset?: number;
  limit?: number;
}

// GET /api/content/home/leaderboard/catalog
export async function fetchLeaderboardCatalog(): Promise<LeaderboardCatalog | null> {
  const r: any = await contentClient('/home/leaderboard/catalog');
  return (r?.data ?? null) as LeaderboardCatalog | null;
}

// GET /api/content/home/leaderboard?type=&category=&metric=&period=&offset=&limit=
export async function fetchLeaderboard(q: LeaderboardQuery): Promise<LeaderboardBoard | null> {
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== '') params[k] = v as string | number;
  }
  const r: any = await contentClient('/home/leaderboard', { params });
  return (r?.data ?? null) as LeaderboardBoard | null;
}

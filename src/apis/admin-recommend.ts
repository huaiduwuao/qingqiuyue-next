import { contentClient } from '@/lib/api/client';
import { toEntityId, type EntityId } from '@/lib/id';

/**
 * admin-recommend —— 推荐系统与用户画像控制台。
 * 对应后端 recommendapp 的 admin 接口(见 internal/recommendapp)。
 */

// ── 运营干预(Boost/Suppress) ────────────────────────────────────────────────

export interface BoostItem {
  id: number | string;
  contentId: number | string;
  action: 'boost' | 'suppress';
  weight: number;
  reason?: string;
  expireAt?: string;
  createTime?: string;
}

export interface BoostListPage {
  list: BoostItem[];
  total: number;
}

export async function fetchBoostList(page: number, pageSize = 20): Promise<BoostListPage> {
  const res = await contentClient<{ list?: BoostItem[]; records?: BoostItem[]; total?: number; totalRow?: number }>(
    '/recommend/boost/list',
    { method: 'GET', params: { page, size: pageSize } },
  );
  const d = res;
  const list = (d?.list as BoostItem[]) ?? (d?.records as BoostItem[]) ?? [];
  const total = Number(d?.total ?? d?.totalRow ?? list.length);
  return { list, total };
}

export async function setBoost(input: { contentId: EntityId; action: 'boost' | 'suppress'; weight: number; reason?: string; expireAt?: number }) {
  return contentClient('/recommend/boost', {
    method: 'POST',
    data: {
      // 内容 id 超 2^53,Number() 会截成另一条内容;按字符串原样发(见 lib/id.ts)
      contentId: toEntityId(input.contentId),
      action: input.action,
      weight: input.weight,
      reason: input.reason,
      expireAt: input.expireAt,
    },
  });
}

export async function revokeBoost(id: number | string) {
  return contentClient(`/recommend/boost/${id}/revoke`, { method: 'POST' });
}

// ── 推荐指标 + 画像分布 ────────────────────────────────────────────────────

export interface RecommendOverview {
  ctr?: number;          // 点击率 0~1
  cvr?: number;          // 转化率 0~1
  exposures?: number;    // 曝光数
  clicks?: number;       // 点击数
  conversions?: number;  // 转化数
  days?: number;
  exposureSource?: string; // 曝光口径;behavior_view_fallback 表示降级用 view
  note?: string;         // 口径说明
}

export interface ProfileStats {
  tagCloud?: { tag: string; count: number }[];
  typeDist?: { type: string; count: number }[];
  userSplit?: { real: number; bot: number };
}

export async function fetchRecommendOverview(days = 7): Promise<RecommendOverview> {
  const res = await contentClient<RecommendOverview>('/recommend/stats/overview', {
    method: 'GET',
    params: { days },
  });
  return res as RecommendOverview;
}

export async function fetchProfileStats(): Promise<ProfileStats> {
  const res = await contentClient<ProfileStats>('/recommend/stats/profile', { method: 'GET' });
  return res as ProfileStats;
}

// ── 内容向量回填(i2i 召回的数据来源) ──────────────────────────────────────

export interface EmbeddingStats {
  enabled: boolean;
  reason?: string;
  model?: string;
  running?: boolean;
  currentType?: string;
  embeddedSinceStart?: number;
  ratePerSec?: number;
  lastError?: string;
  lastErrorAt?: string;
  startedAt?: string;
  coverage?: Record<string, number>; // 各类型已建向量条数
  catalog?: Record<string, number>;  // 各类型内容总数
}

export async function fetchEmbeddingStats(): Promise<EmbeddingStats> {
  return contentClient<EmbeddingStats>('/recommend/stats/embeddings', { method: 'GET' });
}

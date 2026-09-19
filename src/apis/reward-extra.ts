import { accountClient } from '@/lib/api/client';

// ========== 悬赏广场额外 API ==========

// 获取悬赏分类(带计数)
export interface RewardCategory {
  id: string;
  code: string;
  label: string;
  icon: string;
  color: string;
  sort: number;
  count: number;
}

export async function getRewardCategories(): Promise<RewardCategory[]> {
  const resp = await accountClient('/reward/categories');
  return resp ?? [];
}

// 悬赏达人榜
export interface RewardRanker {
  id: string;
  rank: number;
  name: string;
  initials: string;
  avatarColor: string;
  bounty: number;   // 已接悬赏数
  income: number;   // 累计收益(分)
  color: string;
}

export async function getRewardRanking(limit = 8): Promise<RewardRanker[]> {
  const resp = await accountClient('/reward/ranking', { params: { limit } });
  return resp ?? [];
}

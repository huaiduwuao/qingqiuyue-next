import { accountClient } from '@/lib/api/client';

// ========== 悬赏广场额外 API ==========

// 结算单详情
export interface SettlementDetail {
  demandId: number;
  demandTitle: string;
  demandStatus: string;
  totalReward: number;   // 元
  totalPoint: number;    // 灵气
  winnerCount: number;    // 获奖人数
  settleTime: string;
  settleBy: number;
  items: SettlementItem[];
}

export interface SettlementItem {
  userId: number;
  userName: string;
  taskId: number;
  taskTitle: string;
  reward: number;        // 元
  pointAmount: number;   // 灵气
  status: string;
  reviewNote: string;
  reviewTime: string;
}

// 获取需求结算单详情
export async function getSettlementDetail(demandId: number): Promise<SettlementDetail> {
  const resp = await accountClient(`/reward/settlement/${demandId}`);
  return resp?.data ?? resp;
}

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
  return resp?.data ?? [];
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
  return resp?.data ?? [];
}

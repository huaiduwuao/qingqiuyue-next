import { adminClient } from '@/lib/api/client';

// 等级信息
export interface CreatorLevelInfo {
  userId: number;
  level: number;
  levelName: string;
  score: number;
  icon: string;
  color: string;
  privileges: string[];
  totalPublished: number;
  totalLikes: number;
  totalFavorites: number;
  totalShares: number;
  totalViews: number;
  violations: number;
  nextLevel?: {
    level: number;
    name: string;
    minScore: number;
    maxScore: number;
    icon: string;
    color: string;
    privileges: string[];
  };
  progress: number; // 距离下一等级进度百分比
}

// 积分历史
export interface ScoreHistory {
  id: number;
  userId: number;
  delta: number;
  type: 'publish' | 'like' | 'favorite' | 'share' | 'view' | 'violation';
  contentId?: number;
  reason: string;
  createdAt: string;
}

// 排行榜项
export interface RankingItem {
  rank: number;
  userId: number;
  level: number;
  score: number;
  icon: string;
  color: string;
}

// 等级配置
export const LEVEL_CONFIG = [
  { level: 1, name: '新手创作者', icon: '🌱', color: '#90A4AE', minScore: 0, maxScore: 99 },
  { level: 2, name: '成长创作者', icon: '🌿', color: '#4CAF50', minScore: 100, maxScore: 499 },
  { level: 3, name: '成熟创作者', icon: '🌳', color: '#2196F3', minScore: 500, maxScore: 1999 },
  { level: 4, name: '资深创作者', icon: '⭐', color: '#9C27B0', minScore: 2000, maxScore: 4999 },
  { level: 5, name: '头部创作者', icon: '👑', color: '#FFD700', minScore: 5000, maxScore: 0 },
];

// 获取创作者等级信息
export async function getCreatorLevelInfo(): Promise<CreatorLevelInfo> {
  const res = await adminClient('/creator-level/info');
  return res?.data ?? res;
}

// 获取积分变动历史
export async function getScoreHistory(params: {
  page?: number;
  pageSize?: number;
}): Promise<{ records: ScoreHistory[]; page: number; pageSize: number }> {
  const res = await adminClient('/creator-level/history', { params });
  return res?.data ?? res;
}

// 获取等级排行榜
export async function getLevelRankings(params: {
  level?: number;
  limit?: number;
}): Promise<{ rankings: RankingItem[] }> {
  const res = await adminClient('/creator-level/rankings', { params });
  return res?.data ?? res;
}

// 增加积分（供内部调用）
export async function addCreatorScore(params: {
  delta: number;
  scoreType: string;
  reason?: string;
  contentId?: number;
}): Promise<void> {
  await adminClient('/creator-level/add-score', { method: 'POST', data: params });
}

// 计算积分（前端辅助）
export const SCORE_VALUES = {
  publish: 10,    // 发布内容
  like: 1,        // 获得点赞
  favorite: 2,    // 获得收藏
  share: 3,      // 获得分享
  view: 1,        // 获得阅读
  violation: -20,  // 违规扣分
};

// 获取等级特权说明
export function getLevelPrivileges(level: number): string[] {
  const configs: Record<number, string[]> = {
    1: ['每日可发布3篇内容', '可发布短视频（≤30分钟）', '基础数据分析'],
    2: ['每日可发布10篇内容', '可发布长视频（>30分钟）', '详细数据分析', '参与平台活动'],
    3: ['每日可发布30篇内容', '可开启打赏功能', '优先推荐机会', '创作者社群准入'],
    4: ['无限发布', '可设置付费内容', '专属客服支持', '商业合作优先'],
    5: ['所有特权', '专属运营支持', '优先审核通道', '平台资源倾斜', '年度盛典邀请'],
  };
  return configs[level] || [];
}

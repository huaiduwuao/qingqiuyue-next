import { accountClient } from '@/lib/api/client';

// 行为激励 API —— 奖励是积分(不是钻石,也不进钱包)

// BehaviorStats 行为统计
export interface BehaviorStats {
  todayReward: number;   // 今日奖励(积分)
  dailyLimit: number;    // 每日上限(积分)
  likeCount: number;     // 点赞次数
  collectCount: number;  // 收藏次数
  shareCount: number;    // 分享次数
  readCount: number;     // 阅读完成次数
}

// DailyLimit 每日剩余额度
export interface DailyLimit {
  remaining: number;  // 今日剩余可获积分
}

// 行为奖励请求
export interface BehaviorRewardPayload {
  contentId: number | string;
  /** @deprecated 后端已忽略,作者按 contentId 查;内容不存在时后端返回「内容不存在」 */
  contentAuthorId?: number;
  readDuration?: number;  // 阅读时长(秒)
}

// 获取用户行为统计
export async function getBehaviorStats(): Promise<BehaviorStats> {
  const res = await accountClient('/behavior/stats');
  return res;
}

// 获取每日剩余奖励额度
export async function getDailyLimit(): Promise<DailyLimit> {
  const res = await accountClient('/behavior/daily-limit');
  return res;
}

// 点赞奖励
export async function postLike(payload: BehaviorRewardPayload): Promise<void> {
  await accountClient('/behavior/like', { method: 'POST', data: payload });
}

// 收藏奖励
export async function postCollect(payload: BehaviorRewardPayload): Promise<void> {
  await accountClient('/behavior/collect', { method: 'POST', data: payload });
}

// 分享奖励
export async function postShare(payload: BehaviorRewardPayload): Promise<void> {
  await accountClient('/behavior/share', { method: 'POST', data: payload });
}

// 阅读奖励
export async function postRead(payload: BehaviorRewardPayload): Promise<void> {
  await accountClient('/behavior/read', { method: 'POST', data: payload });
}

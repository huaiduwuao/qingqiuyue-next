/**
 * 统一奖励中心 API
 * 所有奖励类接口统一从这里调用，数据源为 wallet 表
 */
import { accountClient } from '@/lib/api/client';

// ========== 钱包汇总 ==========

/** 钱包汇总响应 */
export interface WalletSummary {
  balance: number;     // 当前余额(分)
  totalIncome: number; // 累计收入(分)
  totalSpend: number;  // 累计支出(分)
  todayReward: number; // 今日收益(分,不含充值)
}

/** 获取钱包汇总 */
export async function getWalletSummary(): Promise<WalletSummary> {
  const resp = await accountClient<WalletSummary>('/wallet/summary');
  return resp?.data ?? resp;
}

// ========== 奖励流水 ==========

/** 奖励流水项 */
export interface RewardRecord {
  id: number;
  userId: number;
  amount: number;         // 分,正=入
  type: string;           // task_reward/achievement/demand_settle/daily_task/invite/monthly_benefit/tip_in/point_migration
  balanceAfter: number;
  refId: string;
  remark: string;
  sourceType: string;     // demand_settle/achievement/daily_task/invite/monthly_benefit/point_migration
  sourceId: number;
  createTime: string;
}

/** 奖励流水列表 */
export interface RewardRecordList {
  list: RewardRecord[];
  total: number;
  page: number;
}

/** 获取奖励流水 */
export async function getRewardRecords(params?: { page?: number; size?: number }): Promise<RewardRecordList> {
  const resp = await accountClient('/wallet/rewards', { params });
  const d = resp?.data;
  return { list: d?.list ?? [], total: d?.total ?? 0, page: d?.page ?? 1 };
}

// ========== 每日任务 ==========

/** 每日任务项 */
export interface DailyTask {
  taskType: string;
  name: string;
  description: string;
  rewardPoint: number;  // 奖励积分(分)
  maxCount: number;     // 每日可完成次数
  completed: boolean;
  claimed: boolean;
  canClaim: boolean;
}

/** 每日任务统计 */
export interface DailyTaskStats {
  date: string;
  totalTasks: number;
  completed: number;
  totalReward: number; // 分
  claimableCount: number;
}

/** 获取今日任务列表 */
export async function getDailyTaskList(): Promise<DailyTask[]> {
  const resp = await accountClient<DailyTask[]>('/daily-task/list');
  return resp?.data ?? resp ?? [];
}

/** 获取任务统计 */
export async function getDailyTaskStats(): Promise<DailyTaskStats> {
  const resp = await accountClient<DailyTaskStats>('/daily-task/stats');
  return resp?.data ?? resp;
}

/** 完成并领取任务奖励 */
export async function completeDailyTask(taskType: string): Promise<{ msg: string }> {
  return accountClient('/daily-task/complete', {
    method: 'POST',
    data: { taskType },
  });
}

// ========== 邀请系统 ==========

/** 邀请统计 */
export interface InviteStats {
  myCode: string;         // 我的邀请码(空=未生成)
  inviteCount: number;    // 已邀请人数
  totalReward: number;    // 累计获得奖励(分)
  pendingReward: number;  // 待发放奖励(分)
}

/** 邀请记录 */
export interface InviteRecord {
  id: number;
  inviterId: number;
  inviteeId: number;
  inviteeName: string;
  inviteeAvatar: string;
  status: string;        // pending/bound/expired
  rewardStatus: string;  // pending/issued
  createTime: string;
}

/** 邀请列表响应 */
export interface InviteRecordList {
  list: InviteRecord[];
  total: number;
  page: number;
}

/** 获取邀请统计 */
export async function getInviteStats(): Promise<InviteStats> {
  const resp = await accountClient<InviteStats>('/invite/stats');
  return resp?.data ?? resp;
}

/** 创建邀请码 */
export async function createInviteCode(): Promise<{ code: string }> {
  return accountClient('/invite/create', { method: 'POST' });
}

/** 绑定邀请码 */
export async function bindInviteCode(code: string): Promise<{ msg: string }> {
  return accountClient('/invite/bind', { method: 'POST', data: { code } });
}

/** 获取邀请记录 */
export async function getInviteRecords(params?: { page?: number; size?: number }): Promise<InviteRecordList> {
  const resp = await accountClient('/invite/records', { params });
  const d = resp?.data;
  return { list: d?.list ?? [], total: d?.total ?? 0, page: d?.page ?? 1 };
}

// ========== 月度福利 ==========

/** 月度福利状态 */
export interface MonthlyBenefitStatus {
  isVip: boolean;           // 是否VIP会员
  vipLevel: number;         // VIP等级
  vipLevelName: string;     // VIP等级名称
  monthlyReward: number;    // 本月应发奖励(分)
  lastBenefitMonth: string; // 上次发放月份
  lastBenefitAmount: number; // 上次发放金额(分)
  lastBenefitTime: string;  // 上次发放时间
  currentStatus: string;    // pending/sent
}

/** 月度福利记录 */
export interface MonthlyBenefitRecord {
  id: number;
  userId: number;
  yearMonth: string;
  diamondReward: number; // 分
  vipLevel: number;
  status: string;        // pending/sent
  createTime: string;
}

/** 获取本月福利状态 */
export async function getMonthlyBenefitStatus(): Promise<MonthlyBenefitStatus> {
  const resp = await accountClient<MonthlyBenefitStatus>('/monthly-benefit/current');
  return resp?.data ?? resp;
}

/** 获取福利领取记录 */
export async function getMonthlyBenefitRecords(): Promise<MonthlyBenefitRecord[]> {
  const resp = await accountClient<MonthlyBenefitRecord[]>('/monthly-benefit/records');
  return resp?.data ?? resp ?? [];
}

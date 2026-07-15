import { adminClient } from '@/lib/api/client';
import type { PageParams, PageResult } from '@/beans/pagination';
import { normalizeLegacyPageResponse } from '@/hooks/usePagination';

// ── 打赏 API ──

export interface Tip {
  id: number;
  fanId: number;
  creatorId: number;
  contentId?: number;
  amount: number; // 分
  currency: string;
  platformFee: number;
  creatorEarn: number;
  message?: string;
  status: string;
  createdAt: string;
}

export interface TipRequest {
  creatorId: number;
  contentId?: number;
  amount: number;
  message?: string;
}

// 打赏
export async function sendTip(params: TipRequest): Promise<void> {
  await adminClient('/social/tip', { method: 'POST', data: params });
}

// 获取打赏记录
export async function getTips(params?: PageParams): Promise<PageResult<Tip>> {
  const res = await adminClient('/social/tips', { params });
  const data = res?.data;
  if (!data) return normalizeLegacyPageResponse({ records: [], totalRow: 0, page: 1, pageSize: 20 } as any);
  return normalizeLegacyPageResponse(data);
}

// ── 订阅 API ──

export interface Subscription {
  id: number;
  fanId: number;
  creatorId: number;
  planType: 'monthly' | 'yearly';
  amount: number;
  startTime: string;
  endTime: string;
  status: string;
  createdAt: string;
}

export interface SubscriptionInfo {
  isSubscribed: boolean;
  planType?: string;
  endTime?: string;
  price: number;
}

// 获取订阅信息
export async function getSubscription(creatorId: number): Promise<SubscriptionInfo> {
  const res = await adminClient(`/social/subscription/${creatorId}`);
  return res?.data ?? res;
}

// 订阅
export async function subscribe(params: {
  creatorId: number;
  planType: 'monthly' | 'yearly';
}): Promise<void> {
  await adminClient('/social/subscribe', { method: 'POST', data: params });
}

// ── 付费内容 API ──

export interface PaidContent {
  id: number;
  creatorId: number;
  contentId: number;
  title: string;
  coverUrl: string;
  price: number;
  salesCount: number;
  revenue: number;
  contentType: string;
  status: string;
  createdAt: string;
}

export interface Purchase {
  id: number;
  userId: number;
  creatorId: number;
  paidContentId: number;
  amount: number;
  status: string;
  createdAt: string;
}

// 设置付费内容
export async function setPaidContent(params: {
  contentId: number;
  price: number;
}): Promise<PaidContent> {
  const res = await adminClient('/social/paid-content', { method: 'POST', data: params });
  return res?.data ?? res;
}

// 购买付费内容
export async function purchasePaidContent(paidContentId: number): Promise<void> {
  await adminClient('/social/purchase', { method: 'POST', data: { paidContentId } });
}

// 获取我的付费内容
export async function getMyPaidContents(params?: PageParams): Promise<PageResult<PaidContent>> {
  const res = await adminClient('/social/my-paid-contents', { params });
  const data = res?.data;
  if (!data) return normalizeLegacyPageResponse({ records: [], totalRow: 0, page: 1, pageSize: 20 } as any);
  return normalizeLegacyPageResponse(data);
}

// 获取我的购买记录
export async function getMyPurchases(params?: PageParams): Promise<PageResult<Purchase>> {
  const res = await adminClient('/social/my-purchases', { params });
  const data = res?.data;
  if (!data) return normalizeLegacyPageResponse({ records: [], totalRow: 0, page: 1, pageSize: 20 } as any);
  return normalizeLegacyPageResponse(data);
}

// ── 收益 API ──

export interface EarningsStats {
  totalEarnings: number;   // 累计收益（分）
  availableAmount: number; // 可提现金额（分）
  withdrawnAmount: number; // 已提现金额（分）
  pendingAmount: number;   // 待处理（分）
  todayEarnings: number;   // 今日收益（分）
  monthEarnings: number;   // 本月收益（分）
}

export interface Earning {
  id: number;
  userId: number;
  type: 'tip' | 'subscription' | 'paid_content' | 'commission';
  sourceId?: number;
  fanId?: number;
  amount: number;
  platformFee: number;
  netAmount: number;
  status: string;
  createdAt: string;
}

// 获取收益统计
export async function getEarnings(): Promise<EarningsStats> {
  const res = await adminClient('/social/earnings');
  return res?.data ?? res;
}

// 获取收益明细
export async function getEarningHistory(params?: PageParams & { type?: string }): Promise<PageResult<Earning>> {
  const res = await adminClient('/social/earning-history', { params });
  const data = res?.data;
  if (!data) return normalizeLegacyPageResponse({ records: [], totalRow: 0, page: 1, pageSize: 20 } as any);
  return normalizeLegacyPageResponse(data);
}

// ── 提现 API ──

export interface Withdraw {
  id: number;
  userId: number;
  amount: number;
  fee: number;
  actualAmount: number;
  bankAccount: string;
  bankName: string;
  status: string;
  remark?: string;
  processedAt?: string;
  createdAt: string;
}

export interface WithdrawRequest {
  amount: number;
  bankAccount: string;
  bankName: string;
}

// 申请提现
export async function applyWithdraw(params: WithdrawRequest): Promise<void> {
  await adminClient('/social/withdraw', { method: 'POST', data: params });
}

// 获取提现记录
export async function getWithdrawHistory(params?: PageParams): Promise<PageResult<Withdraw>> {
  const res = await adminClient('/social/withdraw-history', { params });
  const data = res?.data;
  if (!data) return normalizeLegacyPageResponse({ records: [], totalRow: 0, page: 1, pageSize: 20 } as any);
  return normalizeLegacyPageResponse(data);
}

// 格式化金额（分 -> 元）
export function formatMoney(fen: number): string {
  return (fen / 100).toFixed(2);
}

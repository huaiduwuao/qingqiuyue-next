import { accountClient } from '@/lib/api/client';

// ========== 钱包相关 API ==========

// 钱包余额
export interface WalletBalance {
  id: number;
  userId: number;
  balance: number; // 分
  frozen: number;  // 冻结金额(分)
  updateTime: string;
}

// 钱包流水
export interface WalletTransaction {
  id: number;
  userId: number;
  amount: number;       // 分,正=入,负=出
  type: string;         // recharge/consume/tip_in/tip_out/withdraw
  balanceAfter: number;  // 分
  refId: string;
  remark: string;
  createTime: string;
}

// 提现申请
export interface WithdrawRequest {
  id: number;
  userId: number;
  amount: number;       // 分
  status: 'pending' | 'approved' | 'rejected';
  bankInfo: string;
  rejectNote?: string;
  createTime: string;
  updateTime: string;
}

// 获取钱包余额
export async function getWalletBalance(): Promise<WalletBalance> {
  return accountClient<WalletBalance>('/wallet');
}

// 别名:兼容旧代码
export const getWallet = getWalletBalance;

// 获取钱包流水
export async function getWalletTransactions(params?: { page?: number; size?: number }) {
  return accountClient('/wallet/transactions', { params });
}

// 打赏创作者
export async function tipCreator(data: {
  targetUserId: number;
  contentId?: string | number; // 雪花 id,传字符串避免精度丢失
  amount: number;  // 分
  remark?: string;
}) {
  return accountClient('/wallet/tip', { method: 'POST', data });
}

// 申请提现
export async function applyWithdraw(data: {
  amount: number;   // 分
  bankInfo: string; // 收款信息
}) {
  return accountClient('/wallet/withdraw', { method: 'POST', data });
}

// 获取提现列表(后台审核)
export async function getWithdrawList(params?: { page?: number; size?: number; status?: string }) {
  return accountClient('/wallet/withdraw/list', { params });
}

// 审核提现(后台)
export async function reviewWithdraw(data: {
  id: number;
  approved: boolean;
  rejectNote?: string;
}) {
  return accountClient('/wallet/withdraw/review', { method: 'POST', data });
}

// ========== 充值相关 API ==========

// 充值套餐
export interface RechargePackage {
  id: number;
  diamonds: number;
  price: number;      // 元
  bonus?: number;     // 赠送钻石
}

// 充值订单响应
export interface RechargeOrderResp {
  orderNo: string;
  amount: number;
  payTip?: string;
}

// 获取充值套餐
export async function getRechargePackages(): Promise<RechargePackage[]> {
  const resp = await accountClient('/payment/diamond-packages');
  return resp?.data ?? [];
}

// createRechargeOrder / confirmRecharge 已删除。
//
// 它们对应后端 POST /wallet/recharge 和 POST /wallet/recharge/callback。
// 后者只凭一个 orderNo 就把订单标记已付并入账,没有任何验签 —— 前端先下一笔
// 任意金额的订单、再自己调一次回调,就是凭空充值。两个后端端点已删除。
//
// 充值请走 @/apis/payment 的 createOrder():下单拿支付网关的支付参数,
// 到账由网关异步回调 /api/core/payment/notify/*(验签)入账,前端不参与记账。

/**
 * 钱包 / 充值 / 流水 域 API。
 *
 * 后端实现见 qingqiuyue-go/internal/walletapp/walletapp.go
 * 全部走 /api/core/wallet/*:
 *   GET    /wallet                 当前余额(分)
 *   GET    /wallet/transactions    流水(分页)
 *   POST   /wallet/recharge        发起充值,返回 {orderNo, amount, payTip}
 *   POST   /wallet/recharge/callback  模拟支付回调(传入 orderNo 即可标记已付)
 *
 * 注:钱包侧金额统一以「分」存储 + 传输,前端展示时除以 100 得到元。
 */
import { accountClient } from '@/lib/api/client';

function unwrap<T = any>(resp: any): T {
  if (!resp) return resp as T;
  const body = resp?.data ?? resp;
  if (body && typeof body === 'object' && 'code' in body && 'data' in body) {
    return body.data as T;
  }
  return body as T;
}

export interface Wallet {
  id: number;
  userId: number;
  balance: number; // 分
  frozen: number;
  updateTime: string;
}

export interface WalletTx {
  id: number;
  userId: number;
  amount: number; // 分,正=入,负=出
  type: 'recharge' | 'consume' | 'reward' | 'refund' | string;
  balanceAfter: number;
  refId: string;
  remark: string;
  createTime: string;
}

export interface RechargeOrderResp {
  orderNo: string;
  amount: number; // 分
  payTip: string;
}

export async function getWallet(): Promise<Wallet> {
  return unwrap(await accountClient('/wallet'));
}

export async function getWalletTransactions(params?: { page?: number; size?: number }) {
  return unwrap<{ list: WalletTx[]; total: number; page: number }>(
    await accountClient('/wallet/transactions', { params })
  );
}

export async function createRechargeOrder(body: { amount: number; channel: string }) {
  return unwrap<RechargeOrderResp>(await accountClient.post('/wallet/recharge', body));
}

export async function confirmRecharge(body: { orderNo: string }) {
  return unwrap(await accountClient.post('/wallet/recharge/callback', body));
}
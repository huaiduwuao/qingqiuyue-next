import { accountClient } from '@/lib/api/client';

// ========== 钱包相关 API ==========

// 钱包按「钻石」记账(后端 walletapp,1 钻 = FEN_PER_DIAMOND 分 = ¥0.1)。
// 人民币只在充值 / 提现打款 / 按人民币标价的商品这几个边界上出现。
export const FEN_PER_DIAMOND = 10;
/** 最低提现钻石数(walletapp.MinWithdrawAmount,10 钻 = ¥1) */
export const MIN_WITHDRAW_DIAMONDS = 10;

/** 钱包在个人中心里的位置(旧的 /account/wallet 会跳到这里) */
export const WALLET_HREF = '/account/center?tab=wallet';

/** 钻石数的展示文本:1234 → "1,234 钻" */
export function formatDiamonds(diamonds: number | null | undefined): string {
  return `${Math.round(Number(diamonds) || 0).toLocaleString('zh-CN')} 钻`;
}

/** 榜单等窄位置用的短格式:860 → "860 钻",12345 → "1.2 万钻" */
export function formatDiamondsShort(diamonds: number | null | undefined): string {
  const n = Math.round(Number(diamonds) || 0);
  return n >= 10000 ? `${(n / 10000).toFixed(1).replace(/\.0$/, '')} 万钻` : `${n.toLocaleString('zh-CN')} 钻`;
}

/** 元 → 钻。只用于兼容后端仍按元给的老字段(新字段直接是钻石) */
export function yuanToDiamonds(yuan: number | null | undefined): number {
  return Math.round((Number(yuan) || 0) * (100 / FEN_PER_DIAMOND));
}

/** 分 → 钻。团队收入、实现成交额在库里按分记,数值都由钻石折来,整除无零头 */
export function fenToDiamonds(fen: number | null | undefined): number {
  return Math.round((Number(fen) || 0) / FEN_PER_DIAMOND);
}

/** 需求赏金(钻):新接口给 payDiamonds,老数据只有按元的 pay */
export function demandPayDiamonds(d: { payDiamonds?: number | null; pay?: number | string | null }): number {
  return d.payDiamonds != null ? Number(d.payDiamonds) : yuanToDiamonds(Number(d.pay ?? 0));
}

/** 任务标价(钻):新接口给 rewardDiamonds,老数据只有按元的 reward */
export function taskRewardDiamonds(t: { rewardDiamonds?: number | null; reward?: number | null }): number {
  return t.rewardDiamonds != null ? Number(t.rewardDiamonds) : yuanToDiamonds(t.reward ?? 0);
}

/** 钻石数 → 等值人民币(元)文本,去掉无意义的小数:10 → "1",15 → "1.5" */
export function diamondsToYuan(diamonds: number): string {
  const yuan = (diamonds * FEN_PER_DIAMOND) / 100;
  return Number.isInteger(yuan) ? String(yuan) : yuan.toFixed(2).replace(/0$/, '');
}

// 钱包余额
export interface WalletBalance {
  id: number;
  userId: number;
  balance: number; // 钻
  frozen: number;  // 冻结(钻)
  updateTime: string;
}

// 钱包流水
export interface WalletTransaction {
  id: number;
  userId: number;
  amount: number;       // 钻,正=入,负=出
  type: string;         // recharge/consume/tip_in/tip_out/withdraw
  balanceAfter: number;  // 钻
  refId: string;
  remark: string;
  sourceType?: string; // demand_settle 等,配合 sourceId 跳回来源
  sourceId?: number;
  createTime: string;
}

/** 一类收入 / 支出的今日 · 本月 · 累计(钻) */
export interface IncomeBucket {
  key: string;
  label: string;
  today: number;
  month: number;
  total: number;
}

/** GET /wallet/income:收益按来源汇总(悬赏/作品付费/打赏/订阅/礼物/平台奖励)+ 支出去向 */
export interface WalletIncome {
  today: number;
  month: number;
  total: number;
  sources: IncomeBucket[];
  expenses: IncomeBucket[];
  /** 流水筛选项:in:<来源> / out:<去向> */
  filters: { key: string; label: string }[];
}

export async function getWalletIncome(): Promise<WalletIncome> {
  return accountClient<WalletIncome>('/wallet/income');
}

// 提现申请
export interface WithdrawRequest {
  id: number;
  userId: number;
  amount: number;       // 申请提现的钻石数
  payoutCents?: number; // 应打款金额(分)= 钻 × FEN_PER_DIAMOND
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

// 获取钱包流水。filter:in / out / in:<来源> / out:<去向>(取值见 WalletIncome.filters)
export async function getWalletTransactions(params?: { page?: number; size?: number; filter?: string }) {
  return accountClient<{ list: WalletTransaction[]; total: number; page: number }>('/wallet/transactions', { params });
}

// 打赏创作者
export async function tipCreator(data: {
  targetUserId: number;
  contentId?: string | number; // 雪花 id,传字符串避免精度丢失
  amount: number;  // 钻,最少 1
  remark?: string;
}) {
  return accountClient('/wallet/tip', { method: 'POST', data });
}

// 申请提现
export async function applyWithdraw(data: {
  amount: number;   // 钻,最少 MIN_WITHDRAW_DIAMONDS
  bankInfo: string; // 收款信息(必填,≤200 字)
}) {
  return accountClient<{ requestId: number; amount: number; payoutCents: number; status: string }>('/wallet/withdraw', { method: 'POST', data });
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
  return resp ?? [];
}

// createRechargeOrder / confirmRecharge 已删除。
//
// 它们对应后端 POST /wallet/recharge 和 POST /wallet/recharge/callback。
// 后者只凭一个 orderNo 就把订单标记已付并入账,没有任何验签 —— 前端先下一笔
// 任意金额的订单、再自己调一次回调,就是凭空充值。两个后端端点已删除。
//
// 充值请走 @/apis/payment 的 createOrder():下单拿支付网关的支付参数,
// 到账由网关异步回调 /api/core/payment/notify/*(验签)入账,前端不参与记账。

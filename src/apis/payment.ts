import { accountClient } from '@/lib/api/client';
import type { PageParams, PageResult } from '@/beans/pagination';
import { normalizePageResponse } from '@/beans/pagination';

// 支付系统 API

// 订单接口
export interface PaymentOrder {
  id: number;
  userId: number;
  orderNo: string;
  orderType: string;  // diamond / membership
  productId: number;
  productName: string;
  amountCents: number;
  // refunding = 已申请退款、等管理员审批;abnormal = 支付回调异常(金额/状态对不上),需人工核对
  status: string;     // pending / paid / cancelled / refunding / refunded / abnormal
  channel: string;    // wechat / alipay
  channelOrderId?: string;
  paidAt?: string;
  refundReason?: string; // 用户申请退款的理由
  refundNote?: string;   // 管理员审批备注(驳回原因等)
  refundedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

// 钻石套餐
export interface DiamondPackage {
  id: number;
  name: string;
  diamondAmount: number;
  priceCents: number;
  originalPriceCents?: number;
}

// 会员套餐
export interface MembershipPlan {
  id: number;
  name: string;
  period: string;     // monthly / yearly
  priceCents: number;
  /** 用钻石开通要扣的钻石数(后端按 priceCents / 10 折算) */
  diamondPrice?: number;
  dailyVideoQuota?: number;
  dailyChatQuota?: number;
  description?: string;
}

// 会员状态
export interface MembershipStatus {
  status: string;     // none / active / expired
  planId?: number;
  planName?: string;
  startedAt?: string;
  expiresAt?: string;
}

// 获取钻石套餐列表
export async function getDiamondPackages(): Promise<DiamondPackage[]> {
  const res = await accountClient('/payment/diamond-packages');
  return (res ?? []) as DiamondPackage[];
}

// 获取会员套餐列表
export async function getMembershipPlans(): Promise<MembershipPlan[]> {
  const res = await accountClient('/payment/membership-plans');
  return (res ?? []) as MembershipPlan[];
}

// 创建订单
export async function createOrder(params: {
  orderType: 'diamond' | 'membership';
  productId: number;
  channel: 'wechat' | 'alipay';
}): Promise<{ orderNo: string; amount: number; payParams: any }> {
  return await accountClient('/payment/orders', { method: 'POST', data: params });
}

// 获取订单列表
export async function getOrderList(params?: PageParams): Promise<PageResult<PaymentOrder>> {
  const data = await accountClient('/payment/orders', { params });
  if (!data) return normalizePageResponse({ records: [], totalRow: 0, page: 1, pageSize: 20 } as any);
  return normalizePageResponse(data);
}

// 取消订单
export async function cancelOrder(orderNo: string): Promise<void> {
  await accountClient(`/payment/orders/${orderNo}/cancel`, { method: 'POST' });
}

// 申请退款
export async function refundOrder(orderNo: string, reason?: string): Promise<void> {
  await accountClient(`/payment/orders/${orderNo}/refund`, { method: 'POST', data: { reason } });
}

// ── 管理后台:退款审批 ──
// 用户申请退款后订单停在 refunding;通过时后端扣回充值的钻石 / 会员时长并原路退款,驳回回到 paid。

export async function adminListRefunds(params: PageParams & { status?: string }): Promise<PageResult<PaymentOrder>> {
  const data = await accountClient('/admin/payment/refunds', {
    params: { page: params.page ?? params.pageNumber, pageSize: params.pageSize, status: params.status || undefined },
  });
  return normalizePageResponse(data ?? ({ list: [], total: 0, page: 1, pageSize: 20 } as any));
}

export async function adminApproveRefund(orderNo: string, note?: string): Promise<void> {
  await accountClient(`/admin/payment/refunds/${encodeURIComponent(orderNo)}/approve`, { method: 'POST', data: { note } });
}

export async function adminRejectRefund(orderNo: string, note: string): Promise<void> {
  await accountClient(`/admin/payment/refunds/${encodeURIComponent(orderNo)}/reject`, { method: 'POST', data: { note } });
}

// 获取会员状态
export async function getMembershipStatus(): Promise<MembershipStatus> {
  const res = await accountClient('/payment/membership');
  return res ?? { status: 'none' };
}

// mockPay 已删除。
//
// 它打的是后端 POST /api/core/payment/mock-pay —— 一个跳过支付网关、直接把订单
// 标记为已付并发放钻石/会员的端点,而且是无条件注册在生产路由里的。任何登录
// 用户都能给自己开会员。后端端点和这个函数一并移除,到账只能来自网关回调
// (/api/core/payment/notify/wechat|alipay,带验签)。

import { accountClient } from '@/lib/api/client';

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
  status: string;     // pending / paid / cancelled / refunding / refunded
  channel: string;    // wechat / alipay
  channelOrderId?: string;
  paidAt?: string;
  createdAt: string;
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
  return (res?.data ?? []) as DiamondPackage[];
}

// 获取会员套餐列表
export async function getMembershipPlans(): Promise<MembershipPlan[]> {
  const res = await accountClient('/payment/membership-plans');
  return (res?.data ?? []) as MembershipPlan[];
}

// 创建订单
export async function createOrder(params: {
  orderType: 'diamond' | 'membership';
  productId: number;
  channel: 'wechat' | 'alipay';
}): Promise<{ orderNo: string; amount: number; payParams: any }> {
  const res = await accountClient('/payment/orders', { method: 'POST', data: params });
  return res?.data;
}

// 获取订单列表
export async function getOrderList(params?: { page?: number; pageSize?: number }): Promise<{
  records: PaymentOrder[];
  totalRow: number;
  page: number;
}> {
  const res = await accountClient('/payment/orders', { params });
  return res?.data ?? { records: [], totalRow: 0, page: 1 };
}

// 取消订单
export async function cancelOrder(orderNo: string): Promise<void> {
  await accountClient(`/payment/orders/${orderNo}/cancel`, { method: 'POST' });
}

// 申请退款
export async function refundOrder(orderNo: string, reason?: string): Promise<void> {
  await accountClient(`/payment/orders/${orderNo}/refund`, { method: 'POST', data: { reason } });
}

// 获取会员状态
export async function getMembershipStatus(): Promise<MembershipStatus> {
  const res = await accountClient('/payment/membership');
  return res?.data ?? { status: 'none' };
}

// 模拟支付（测试用）
export async function mockPay(orderNo: string): Promise<void> {
  await accountClient('/payment/mock-pay', { method: 'POST', data: { orderNo } });
}

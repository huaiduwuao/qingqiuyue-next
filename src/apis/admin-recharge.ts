/**
 * 管理后台充值记录 API
 * 后端实现: qingqiuyue-go/internal/handler/admin_recharge.go
 */
import { accountClient } from '@/lib/api/client';
import type { PageParams } from '@/beans/pagination';
import { normalizeLegacyPageResponse } from '@/hooks/usePagination';

/** 解开 axios 拦截器的包装层,拿到真正的后端 body */
function unwrap<T = any>(resp: any): T {
  if (!resp) return resp as T;
  const body = resp?.data ?? resp;
  if (body && typeof body === 'object' && 'code' in body && 'data' in body) {
    return body.data as T;
  }
  return body as T;
}

// ========== 充值记录 ==========

export interface RechargeRecord {
  id: number;
  orderNo: string;
  userId: number;
  userNickname: string;
  amount: number; // 金额(分)
  diamondAmount: number; // 钻石数量
  status: 'pending' | 'paid' | 'failed';
  channel: string; // alipay/wechat/mock
  createdAt: string;
  paidAt?: string;
  source: 'wallet' | 'payment'; // 来源: wallet=钱包充值, payment=支付订单
}

export interface RechargeRecordsResp {
  list: RechargeRecord[];
  records: RechargeRecord[];
  total: number;
  totalRow: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface RechargeRecordsParams extends PageParams {
  status?: string;    // 状态筛选: pending/paid/failed
  channel?: string;   // 渠道筛选: alipay/wechat
  userId?: string;    // 用户ID
  startDate?: string; // 开始日期 YYYY-MM-DD
  endDate?: string;   // 结束日期 YYYY-MM-DD
}

export async function getRechargeRecords(params?: RechargeRecordsParams): Promise<{
  list: RechargeRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const res = unwrap<RechargeRecordsResp>(await accountClient('/admin/recharge/records', { params }));
  return normalizeLegacyPageResponse(res as any);
}

// 格式化金额（分→元）
export function formatMoney(fen: number): string {
  return (fen / 100).toFixed(2);
}

// 状态标签映射
export const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: '待支付', color: 'warning' },
  paid: { label: '已支付', color: 'success' },
  failed: { label: '失败', color: 'error' },
};

// 渠道标签映射
export const channelLabels: Record<string, { label: string; color: string }> = {
  alipay: { label: '支付宝', color: 'info' },
  wechat: { label: '微信', color: 'success' },
  mock: { label: '模拟', color: 'default' },
};

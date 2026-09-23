/**
 * LLM 配额 API Client
 * 调用 core-api 的 /api/core/payment/quota/* 与 /api/core/admin/quota/packages
 * (internal/paymentapp/handler.go RegisterRoutes)。以前写的 /api/payment/*,APISIX 没有这条路由,
 * 11 个接口全 404。
 */

import { API_PREFIX } from '@/lib/api/prefix'
import { authFetch } from '@/lib/api/auth'

const API_BASE = `${API_PREFIX}/api/core`

interface RequestOptions extends RequestInit {
  token?: string
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, ...init } = options
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await authFetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
  const json = await res.json().catch(() => ({} as any))
  // 业务失败是 HTTP 200 + {code≠200, msg}(response.FailWithMsg),比如退订超过 7 天、
  // 加油包已用完;以前当成功返回,调用方读 undefined 字段才崩。
  if (json && typeof json === 'object' && 'code' in json) {
    const code = Number((json as any).code)
    if (code !== 200 && code !== 0) throw new Error((json as any).msg || `请求失败(${code})`)
  }
  // 兼容 {code, data, msg} 与裸 body
  if (json && typeof json === 'object' && 'data' in json && ('code' in json || 'msg' in json)) {
    return (json as any).data as T
  }
  return json as T
}

export interface QuotaPackage {
  id: number
  code: string
  name: string
  token_quota: number
  request_quota: number
  diamond_price: number
  rmb_price: number
  rpm: number
  tpm: number
  valid_days: number
  target_tier: string
  enabled: boolean
  sort: number
}

export interface QuotaOrder {
  id: number
  order_no: string
  package_id: number
  package_name: string
  diamond_paid: number
  tokens_granted: number
  status: string
  pay_channel: string
  period: string
  create_time: string
  paid_at: string | null
}

export interface QuotaOverview {
  /** 本月可用总量 = base_token_limit + 未过期的 purchased_tokens */
  token_limit: number
  token_used: number
  token_percent: number
  request_limit: number
  request_used: number
  diamond_balance: number
  reset_at: string
  status: 'ok' | 'soft_warn' | 'hard_block'
  hard_limit_tokens: number
  soft_limit_tokens: number
  period: string
  /** 月度基础额度(会员档位 / 默认) */
  base_token_limit?: number
  /** 加油包剩余 token(单独计,不随月度重置) */
  purchased_tokens?: number
  /** 加油包到期时间,null = 不过期 */
  purchased_expires_at?: string | null
}

export interface QuotaTrendPoint {
  date: string
  tokens: number
  requests: number
}

export interface QuotaBreakdownRow {
  key: string
  tokens: number
  requests: number
  diamond: number
  percent: number
}

export const quotaAPI = {
  // 套餐列表(公开 + 管理员)
  listPackages(): Promise<{ list: QuotaPackage[]; total: number }> {
    return request('/payment/quota/packages')
  },
  // 管理员 CRUD
  adminListPackages(): Promise<{ list: QuotaPackage[]; total: number }> {
    return request('/admin/quota/packages')
  },
  createPackage(p: Partial<QuotaPackage>): Promise<QuotaPackage> {
    return request('/admin/quota/packages', { method: 'POST', body: JSON.stringify(p) })
  },
  updatePackage(id: number, p: Partial<QuotaPackage>): Promise<QuotaPackage> {
    return request(`/admin/quota/packages/${id}`, { method: 'PUT', body: JSON.stringify(p) })
  },
  deletePackage(id: number): Promise<{ message: string }> {
    return request(`/admin/quota/packages/${id}`, { method: 'DELETE' })
  },

  // 购买
  buyPackage(packageId: number, channel: 'diamond' | 'alipay' | 'wxpay' = 'diamond'): Promise<QuotaOrder> {
    return request('/payment/quota/orders', { method: 'POST', body: JSON.stringify({ package_id: packageId, channel }) })
  },
  listMyOrders(page = 1, limit = 20): Promise<{ list: QuotaOrder[]; total: number; page: number; limit: number }> {
    return request(`/payment/quota/orders?page=${page}&limit=${limit}`)
  },
  refundOrder(orderNo: string): Promise<{ message: string; refund_tokens: number; refund_diamond: number }> {
    return request(`/payment/quota/orders/${orderNo}/refund`, { method: 'POST' })
  },

  // 我的配额
  overview(): Promise<QuotaOverview> {
    return request('/payment/quota/overview')
  },
  trend(days = 7): Promise<{ points: QuotaTrendPoint[]; days: number }> {
    return request(`/payment/quota/trend?days=${days}`)
  },
  breakdown(dim: 'model' | 'agent' = 'model', days = 30): Promise<{ rows: QuotaBreakdownRow[]; dim: string; days: number }> {
    return request(`/payment/quota/breakdown?dim=${dim}&days=${days}`)
  },
}
/**
 * 审计日志 API 客户端(/system/agent-audit 页用)
 *
 * 后端: agentmanager-api 的 /api/agentmanager/admin/audit(全量)与
 * /api/agentmanager/gateway/audit(仅当前用户)。两者已在 gateway.go 里
 * 统一成 request.PageRequest + response.SuccessPageEx,返回
 * {code:0, data:{list, total, page, pageSize, totalPages, hasMore}};
 * 响应拦截器会剥掉 code 外壳,调用方直接读 r.list / r.total。
 *
 * 为什么不复用 lib/agentmanager/api.ts 的 agentmAPI:那个类走裸 fetch 手工拼
 * URLSearchParams,拿不到 axios 的分页参数归一(pageSize → page_size)与
 * 响应外壳处理。这里改用 adminClient,和全站其它 admin 列表页一致。
 */

import { adminClient } from '@/lib/api/client'

export interface AuditLogRow {
  id: number
  user_id: number
  agent_id?: number
  instance_id?: number
  model: string
  request_tokens: number
  response_tokens: number
  total_tokens: number
  latency_ms: number
  status: string
  error_msg?: string
  input_preview?: string
  create_time: string
  /** source: agent(数字员工/后台运行)或缺省(网关);agent 员工名;usage_source: provider/estimated */
  metadata?: { source?: string; agent?: string; run_id?: string; usage_source?: string; stream?: boolean }
}

export interface AuditLogPage {
  list: AuditLogRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasMore: boolean
}

export interface ListAuditLogParams {
  page?: number
  pageSize?: number
  /** success / error */
  status?: string
  /** 按模型名模糊搜索(后端 ILIKE) */
  keyword?: string
  /** 排序列名,后端有白名单,非白名单列回落 id */
  sort?: string
  /** asc / desc */
  order?: string
}

/** 全量审计日志(管理员,含后台运行 / 工作流这些没有登录用户的调用) */
export const listFullAuditLogs = (params: ListAuditLogParams = {}) =>
  adminClient('/agentmanager/admin/audit', { params })

/** 当前登录用户自己的审计日志 */
export const listMyAuditLogs = (params: ListAuditLogParams = {}) =>
  adminClient('/agentmanager/gateway/audit', { params })

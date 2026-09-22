/**
 * 会话 API 客户端(/system/conversations 页用)
 *
 * 后端: agentmanager-api 的 /api/agentmanager/sessions 及其子接口。
 * 路由前缀在 APISIX 上挂在 /api/agentmanager/* 上,所以必须走 agentmanagerClient
 * (基址 `${API_GATEWAY}/api/agentmanager`),用 adminClient 会拼成
 * /api/core/agentmanager/sessions,core-api 上没有这条路由 → 404。
 *
 * 后端已对齐标准分页协议(request.PageRequest + response.SuccessPageEx),
 * 返回 {code:0, data:{list, total, page, pageSize, totalPages, hasMore}};
 * 响应拦截器会剥掉 code 外壳,调用方直接读 r.list / r.total。
 *
 * stats 和 users 两个接口目前仍是扁平响应(无 {code, data} 外壳),
 * 客户端拦截器对 flat shape 也做了归一处理,这里直接读字段即可。
 */

import { agentmanagerClient } from '@/lib/api/client'

export interface SessionRow {
  id: number
  user_id: number
  title: string
  agent_id: number
  instance_id: number
  model: string
  status: string
  message_count: number
  total_tokens: number
  create_time: string
  update_time: string
}

export interface SessionPage {
  list: SessionRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasMore: boolean
}

export interface ListSessionParams {
  page?: number
  pageSize?: number
  status?: string
  user_id?: string
  agent_id?: string
  keyword?: string
  sort?: string
  order?: string
}

export interface SessionStats {
  total_sessions: number
  active_sessions: number
  archived_sessions: number
  total_messages: number
  total_tokens: number
  unique_users: number
}

export interface ActiveUserRow {
  user_id: number
  session_count: number
  message_count: number
  total_tokens: number
  last_session_at: string
}

export interface SessionMessageRow {
  id: number
  session_id: number
  role: string
  content: string
  model: string
  input_tokens: number
  output_tokens: number
  latency_ms: number
  status: string
  create_time: string
}

export const listSessions = (params: ListSessionParams = {}) =>
  agentmanagerClient<SessionPage>('/sessions', { params })

export const getSessionStats = () =>
  agentmanagerClient<SessionStats>('/sessions/stats')

export const listActiveUsers = (limit = 50) =>
  agentmanagerClient<{ list: ActiveUserRow[] }>('/sessions/users', { params: { limit } })

export const getSessionMessages = (id: number | string) =>
  agentmanagerClient<{ session: SessionRow; messages: SessionMessageRow[] }>(`/sessions/${id}/messages`)

export const deleteSession = (id: number | string) =>
  agentmanagerClient(`/sessions/${id}`, { method: 'DELETE' })

export const archiveSession = (id: number | string) =>
  agentmanagerClient(`/sessions/${id}/archive`, { method: 'POST' })

export const unarchiveSession = (id: number | string) =>
  agentmanagerClient(`/sessions/${id}/unarchive`, { method: 'POST' })
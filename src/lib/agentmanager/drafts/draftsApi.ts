/**
 * 草稿 API:对应后端 internal/agentmanager/builder。
 * 数字员工 / 技能 / 工作流 / MCP 服务由 builder 员工起草,人在这里试运行、发布或丢弃。
 */

import { API_PREFIX } from '@/lib/api/prefix'
import { authFetch } from '@/lib/api/auth'

const BASE = `${API_PREFIX}/api/agentmanager/drafts`

export type DraftKind = 'agent' | 'skill' | 'workflow' | 'mcp_server'
export type DraftStatus = 'draft' | 'published' | 'discarded'

export interface Draft {
  id: number
  kind: DraftKind
  name: string
  description: string
  spec: Record<string, unknown>
  status: DraftStatus
  created_by: number
  run_id?: string
  published_ref?: string
  dry_run?: string
  dry_run_ok?: boolean
  created_at: string
  updated_at: string
  published_at?: string
}

export const KIND_LABEL: Record<DraftKind, string> = {
  agent: '数字员工',
  skill: '技能',
  workflow: '工作流',
  mcp_server: 'MCP 服务',
}


async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(`${BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json' } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
  return body
}

export const draftsAPI = {
  list: async (all: boolean, status?: DraftStatus) => {
    const qs = new URLSearchParams()
    if (all) qs.set('all', '1')
    if (status) qs.set('status', status)
    const q = qs.toString()
    return (await call<{ list: Draft[] }>(q ? `?${q}` : '')).list || []
  },
  dryRun: (id: number) => call<{ ok: boolean; summary: string }>(`/${id}/dry-run`, { method: 'POST' }),
  publish: (id: number) => call<Draft>(`/${id}/publish`, { method: 'POST' }),
  discard: (id: number) => call<{ message: string }>(`/${id}/discard`, { method: 'POST' }),
}

/** 草稿卡片上的一行摘要:每种草稿挑最能说明它是什么的字段。 */
export function draftSummary(d: Draft): string {
  const s = d.spec || {}
  switch (d.kind) {
    case 'agent': {
      const tools = Array.isArray(s.tools) ? (s.tools as string[]) : []
      return tools.length ? `工具:${tools.join(', ')}` : '工具:全部系统工具'
    }
    case 'skill': {
      const files = Array.isArray(s.files) ? (s.files as { path: string }[]) : []
      return s.entry ? `入口 ${String(s.entry)} · ${files.length} 个文件` : '仅说明,无脚本'
    }
    case 'workflow': {
      const nodes = Array.isArray(s.nodes) ? (s.nodes as { id: string; type?: string }[]) : []
      return `${nodes.length} 个节点:${nodes.map(n => `${n.id}(${n.type || 'action'})`).join(' → ')}`
    }
    case 'mcp_server':
      return s.catalog_id ? `目录条目 ${String(s.catalog_id)}` : `${String(s.transport || '')} ${String(s.url || '')}`
    default:
      return ''
  }
}

/**
 * 技能仓库 API:对应后端 internal/agentmanager/skill_hub.go。
 */

import { API_PREFIX } from '@/lib/api/prefix'
import { authFetch } from '@/lib/api/auth'

const BASE = `${API_PREFIX}/api/agentmanager/skills/hub`

export interface HubSource {
  id: number
  name: string
  type: 'github' | 'local'
  url: string
  ref?: string
  trusted: boolean
  enabled: boolean
}

export interface HubCandidate {
  source: string
  identifier: string
  name: string
  description: string
  scripts?: string[]
  installed_id?: number
}

export interface HubFinding {
  id: string
  severity: 'critical' | 'high' | 'medium'
  category: string
  message: string
  file: string
  line: number
}

export interface HubReport {
  findings: HubFinding[]
  trusted: boolean
  allowed: boolean
  forceable: boolean
  reason: string
}

export interface HubScan {
  name: string
  description: string
  entry: string
  files: { path: string; size: number }[]
  skipped?: string[]
  sha256: string
  report: HubReport
}


async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(`${BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json' } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(body.error || `HTTP ${res.status}`) as Error & { report?: HubReport }
    if (body.report) err.report = body.report
    throw err
  }
  return body
}

export const hubAPI = {
  sources: async () => (await call<{ list: HubSource[] }>('/sources')).list || [],
  addSource: (s: Pick<HubSource, 'name' | 'type' | 'url' | 'ref' | 'trusted'>) =>
    call<HubSource>('/sources', { method: 'POST', body: JSON.stringify(s) }),
  deleteSource: (id: number) => call<{ message: string }>(`/sources/${id}`, { method: 'DELETE' }),
  search: (q: string) =>
    call<{ list: HubCandidate[]; errors: Record<string, string> }>(`/search?q=${encodeURIComponent(q)}`),
  scan: (source: string, identifier: string) =>
    call<HubScan>('/scan', { method: 'POST', body: JSON.stringify({ source, identifier }) }),
  install: (source: string, identifier: string, force = false) =>
    call<{ id: number; name: string; tool: string; entry: string; forced: boolean; report: HubReport }>('/install', {
      method: 'POST',
      body: JSON.stringify({ source, identifier, force }),
    }),
}

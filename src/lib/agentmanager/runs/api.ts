/**
 * 运行(runs)API:后台执行的数字员工任务,对应后端 internal/agentmanager/runs。
 *
 * 事件流用 fetch 读 SSE,而不是 EventSource:EventSource 不能带 Authorization 头。
 * 断线后自动带 after=<最后一个 seq> 重连,不重复、不丢事件。
 */

const BASE = '/api/agentmanager/runs'

export type RunStatus = 'queued' | 'running' | 'awaiting_approval' | 'succeeded' | 'failed' | 'cancelled'

export interface Run {
  id: string
  parent_run_id?: string
  user_id: number
  agent: string
  input: string
  status: RunStatus
  output?: string
  error?: string
  created_at: string
  started_at?: string
  finished_at?: string
}

export interface Approval {
  id: string
  run_id: string
  tool: string
  args: string
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  decided_by?: number
  created_at: string
  decided_at?: string
}

/** 事件日志里的一条事件(后端 eventlog.Event 的 JSON 形态)。 */
export interface RunEvent {
  seq: number
  session_id: string
  run?: string
  t: string
  ts: string
  data?: any
}

export const TERMINAL_EVENTS = new Set(['run.finished', 'run.error', 'run.cancelled'])

export function isTerminal(status: RunStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled'
}

function authHeaders(token?: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function call<T>(path: string, token: string | null | undefined, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(token), ...(init.headers as Record<string, string>) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const runsAPI = {
  start: (token: string | null, body: { agent?: string; input: string; parent_run_id?: string }) =>
    call<Run>('', token, { method: 'POST', body: JSON.stringify(body) }),
  list: async (token: string | null, opts: { all?: boolean; limit?: number } = {}) => {
    const q = new URLSearchParams()
    if (opts.all) q.set('all', '1')
    if (opts.limit) q.set('limit', String(opts.limit))
    const res = await call<{ list: Run[] }>(q.toString() ? `?${q}` : '', token)
    return res.list || []
  },
  get: (token: string | null, id: string) => call<Run>(`/${encodeURIComponent(id)}`, token),
  cancel: (token: string | null, id: string) =>
    call<{ status: string }>(`/${encodeURIComponent(id)}/cancel`, token, { method: 'POST' }),
  approvals: async (token: string | null, id: string) => {
    const res = await call<{ list: Approval[] }>(`/${encodeURIComponent(id)}/approvals`, token)
    return res.list || []
  },
  decide: (token: string | null, id: string, approvalId: string, decision: 'approve' | 'reject') =>
    call<{ decision: string }>(`/${encodeURIComponent(id)}/approvals/${encodeURIComponent(approvalId)}`, token, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }),
}

/**
 * 解析 SSE 文本。返回完整的事件和尚未收完的尾巴(下次拼上继续解析)。
 * 注释行(": ping" 心跳)和解析不了的帧直接跳过。纯函数,便于测试。
 */
export function parseSSE(buffer: string): { events: RunEvent[]; rest: string } {
  const blocks = buffer.replace(/\r\n/g, '\n').split('\n\n')
  const rest = blocks.pop() ?? ''
  const events: RunEvent[] = []
  for (const block of blocks) {
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
    if (data.length === 0) continue
    try {
      events.push(JSON.parse(data.join('\n')))
    } catch {
      /* 坏帧:跳过,不影响后续 */
    }
  }
  return { events, rest }
}

/**
 * 订阅运行事件,按 seq 顺序逐条回调;读到终态事件或 signal 取消时结束。
 * 断线自动从最后一个 seq 续上,连续失败 5 次后抛错。
 */
export async function streamRunEvents(
  runId: string,
  token: string | null | undefined,
  onEvent: (e: RunEvent) => void,
  signal: AbortSignal,
  after = 0,
): Promise<void> {
  let last = after
  let failures = 0
  while (!signal.aborted) {
    try {
      const res = await fetch(`${BASE}/${encodeURIComponent(runId)}/events?after=${last}`, {
        headers: authHeaders(token),
        signal,
      })
      if (!res.ok || !res.body) throw new Error(`事件流连接失败 HTTP ${res.status}`)
      failures = 0
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parsed = parseSSE(buf)
        buf = parsed.rest
        for (const e of parsed.events) {
          if (e.seq <= last) continue
          last = e.seq
          onEvent(e)
          if (TERMINAL_EVENTS.has(e.t)) return
        }
      }
    } catch (err) {
      if (signal.aborted) return
      failures++
      if (failures > 5) throw err
    }
    await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** failures, 10000)))
  }
}

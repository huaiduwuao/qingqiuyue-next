/**
 * Hermes API 客户端
 *
 * 对接 hermes-agent 的 REST API:
 *   POST /auth/password-login
 *   POST /api/sessions
 *   POST /api/sessions/{id}/messages
 *   GET  /api/sessions
 *   GET  /api/skills
 *   GET  /api/runs/{id}
 *   POST /api/cron/jobs
 *
 * 鉴权: 登录后 Set-Cookie 拿 hermes_session_at + hermes_session_rt
 */

export interface HermesClientOptions {
  baseUrl: string
  username: string
  password: string
}

export interface SessionOptions {
  persona: string
  systemPrompt?: string
  context?: any
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: any[]
  tool_call_id?: string
}

export class HermesClient {
  private cookies = new Map<string, string>()
  private baseUrl: string
  private username: string
  private password: string

  constructor(baseUrlOrOpts: string | HermesClientOptions, username?: string, password?: string) {
    if (typeof baseUrlOrOpts === 'string') {
      this.baseUrl = baseUrlOrOpts.replace(/\/+$/, '')
      this.username = username!
      this.password = password!
    } else {
      this.baseUrl = baseUrlOrOpts.baseUrl.replace(/\/+$/, '')
      this.username = baseUrlOrOpts.username
      this.password = baseUrlOrOpts.password
    }
  }

  private cookieHeader(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  }

  private captureCookies(res: Response): void {
    const setCookie = res.headers.get('set-cookie')
    if (!setCookie) return
    // 多个 Set-Cookie 用逗号分隔但 Expires 含逗号, 简化处理
    for (const part of setCookie.split(/,(?=\s*\w+=)/)) {
      const [pair] = part.split(';')
      const eq = pair.indexOf('=')
      if (eq < 0) continue
      const k = pair.slice(0, eq).trim()
      const v = pair.slice(eq + 1).trim()
      if (k && v) this.cookies.set(k, v)
    }
  }

  async login(): Promise<void> {
    const r = await fetch(`${this.baseUrl}/auth/password-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'basic', username: this.username, password: this.password }),
    })
    if (!r.ok) {
      const body = await r.text().catch(() => '')
      throw new Error(`Hermes login failed ${r.status}: ${body.slice(0, 200)}`)
    }
    this.captureCookies(r)
  }

  private async req<T = any>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers)
    headers.set('Cookie', this.cookieHeader())
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    const r = await fetch(`${this.baseUrl}${path}`, { ...init, headers })
    if (r.status === 401) {
      // cookie 过期, 重登一次
      await this.login()
      headers.set('Cookie', this.cookieHeader())
      const r2 = await fetch(`${this.baseUrl}${path}`, { ...init, headers })
      if (!r2.ok) throw new Error(`Hermes ${path} ${r2.status}: ${await r2.text().catch(() => '')}`)
      return r2.json() as Promise<T>
    }
    if (!r.ok) {
      throw new Error(`Hermes ${path} ${r.status}: ${await r.text().catch(() => '')}`)
    }
    return r.json() as Promise<T>
  }

  /** 创建 session, 返回 session_id */
  async createSession(opts: SessionOptions): Promise<string> {
    const r = await this.req<{ id: string; session_id?: string }>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({
        title: `agent-${Date.now()}`,
        system_prompt: opts.persona,
        context: opts.context || {},
      }),
    })
    return r.id || r.session_id || ''
  }

  /** 列出所有 session */
  async listSessions(): Promise<any[]> {
    return this.req<any[]>('/api/sessions')
  }

  /** 往 session 发消息 */
  async sendMessage(sessionId: string, message: ChatMessage): Promise<any> {
    return this.req(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: 'POST',
      body: JSON.stringify(message),
    })
  }

  /** 列所有 skill */
  async listSkills(): Promise<any[]> {
    return this.req<any[]>('/api/skills')
  }

  /** 查 run 状态 */
  async getRun(runId: string): Promise<any> {
    return this.req(`/api/runs/${encodeURIComponent(runId)}`)
  }

  /** 创建 cron job */
  async createCron(opts: { cron: string; prompt: string; agentId?: string }): Promise<any> {
    return this.req('/api/cron/jobs', {
      method: 'POST',
      body: JSON.stringify({
        cron_expression: opts.cron,
        prompt: opts.prompt,
        agent_id: opts.agentId,
      }),
    })
  }

  /** 列出 memory graph 节点 (用于持久化记忆) */
  async getMemoryGraph(): Promise<any> {
    return this.req('/api/learning/graph')
  }

  /** 健康检查 */
  async ping(): Promise<boolean> {
    try {
      const r = await fetch(`${this.baseUrl}/api/auth/me`, {
        headers: { Cookie: this.cookieHeader() },
      })
      return r.ok
    } catch {
      return false
    }
  }
}
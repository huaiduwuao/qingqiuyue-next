/**
 * AgentManager API Client
 * 多 Agent 管理平面前端 SDK
 */

const API_BASE = process.env.NEXT_PUBLIC_AGENTM_URL || 'http://localhost:10081/api/v1'

interface RequestOptions extends RequestInit {
  token?: string
}

class AgentManagerAPI {
  private token: string | null = null

  setToken(token: string) {
    this.token = token
  }

  clearToken() {
    this.token = null
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { token, ...fetchOpts } = options

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    const authToken = token || this.token
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...fetchOpts,
      headers,
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(error.error || `HTTP ${res.status}`)
    }

    return res.json()
  }

  // ========== Auth ==========
  async login(username: string, password: string) {
    const data = await this.request<{
      access_token: string
      refresh_token: string
      token_type: string
      expires_in: number
    }>('/gateway/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    this.token = data.access_token
    return data
  }

  async refreshToken(refreshToken: string) {
    return this.request<{ access_token: string; expires_in: number }>('/gateway/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
  }

  async getCurrentUser() {
    return this.request<{ user_id: number; username: string; role: string }>('/gateway/auth/me')
  }

  // ========== Instances ==========
  async listInstances(params?: { page?: number; limit?: number; region?: string; status?: string }) {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.region) query.set('region', params.region)
    if (params?.status) query.set('status', params.status)

    return this.request<{ list: Instance[]; total: number; page: number; limit: number }>(
      `/instances?${query}`
    )
  }

  async getInstance(id: number) {
    return this.request<Instance>(`/instances/${id}`)
  }

  async createInstance(data: Partial<Instance>) {
    return this.request<Instance>('/instances', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateInstance(id: number, data: Partial<Instance>) {
    return this.request<Instance>(`/instances/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteInstance(id: number) {
    return this.request<{ message: string }>(`/instances/${id}`, { method: 'DELETE' })
  }

  async startInstance(id: number) {
    return this.request<{ message: string }>(`/instances/${id}/start`, { method: 'POST' })
  }

  async stopInstance(id: number) {
    return this.request<{ message: string }>(`/instances/${id}/stop`, { method: 'POST' })
  }

  async getInstanceStatus(id: number) {
    return this.request<{
      id: number
      status: string
      health_status: string
      active_sessions: number
      avg_latency_ms: number
    }>(`/instances/${id}/status`)
  }

  async discoverInstances() {
    return this.request<{ discovered: Instance[]; message: string }>('/instances/discover', {
      method: 'POST',
    })
  }

  // ========== Gateway ==========
  async listModels() {
    return this.request<{ models: { id: string; name: string; type: string }[] }>('/gateway/llm/models')
  }

  async chatCompletions(
    model: string,
    messages: { role: string; content: string }[],
    options?: { stream?: boolean; temperature?: number }
  ) {
    return this.request<any>('/gateway/llm/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model, messages, ...options }),
    })
  }

  async getQuota() {
    return this.request<{
      user_id: number
      period: string
      quota_limit: number
      quota_used: number
      requests_limit: number
      requests_used: number
    }>('/gateway/quota')
  }

  async getAuditLog(params?: { page?: number; limit?: number }) {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))

    return this.request<{ list: AuditLog[]; total: number; page: number; limit: number }>(
      `/gateway/audit?${query}`
    )
  }

  // ========== Teams ==========
  async listTeams() {
    return this.request<{ list: Team[]; total: number }>('/teams')
  }

  async createTeam(name: string, description?: string) {
    return this.request<Team>('/teams', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    })
  }

  async getTeam(id: number) {
    return this.request<{ team: Team; stats: any }>(`/teams/${id}`)
  }

  async deleteTeam(id: number) {
    return this.request<{ message: string }>(`/teams/${id}`, { method: 'DELETE' })
  }

  async listTeamMembers(teamId: number) {
    return this.request<{ members: TeamMember[] }>(`/teams/${teamId}/members`)
  }

  async addTeamMember(teamId: number, userId: number, role?: string) {
    return this.request<TeamMember>(`/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: String(userId), role }),
    })
  }

  async removeTeamMember(teamId: number, userId: number) {
    return this.request<{ message: string }>(`/teams/${teamId}/members/${userId}`, {
      method: 'DELETE',
    })
  }

  async listTeamTasks(teamId: number, params?: { status?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams()
    if (params?.status) query.set('status', params.status)
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))

    return this.request<{ list: AgentTask[]; total: number }>(`/teams/${teamId}/tasks?${query}`)
  }

  async dispatchTask(teamId: number, data: { agent_id: number; task_type: string; title?: string; input?: any }) {
    return this.request<AgentTask>(`/teams/${teamId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // ========== Skills ==========
  async listSkills(params?: { category?: string; source?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams()
    if (params?.category) query.set('category', params.category)
    if (params?.source) query.set('source', params.source)
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))

    return this.request<{ list: Skill[]; total: number }>(`/skills?${query}`)
  }

  async getSkill(id: number) {
    return this.request<Skill>(`/skills/${id}`)
  }

  async createSkill(data: Partial<Skill>) {
    return this.request<Skill>('/skills', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async deleteSkill(id: number) {
    return this.request<{ message: string }>(`/skills/${id}`, { method: 'DELETE' })
  }

  async listInstanceSkills(instanceId: number) {
    return this.request<{ skills: Skill[] }>(`/skills/instances/${instanceId}`)
  }

  async attachSkillToInstance(instanceId: number, skillId: number, config?: any) {
    return this.request<InstanceSkill>(`/skills/instances/${instanceId}`, {
      method: 'POST',
      body: JSON.stringify({ skill_id: skillId, config }),
    })
  }

  // ========== Admin ==========
  async getLLMGovernance() {
    return this.request<any>('/admin/llm-governance')
  }

  async getCostStats(period?: string) {
    const query = period ? `?period=${period}` : ''
    return this.request<any>(`/admin/costs${query}`)
  }

  async getFullAuditLog(params?: { page?: number; limit?: number }) {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))

    return this.request<{ list: AuditLog[]; total: number }>(`/admin/audit?${query}`)
  }

  // ========== Monitoring ==========
  async getMonitoringOverview() {
    return this.request<MonitoringOverview>('/monitoring/overview')
  }

  async getInstancesStats() {
    return this.request<{ instances: InstanceStats[] }>('/monitoring/instances')
  }

  async getAgentsStats() {
    return this.request<{ agents: AgentStats[] }>('/monitoring/agents')
  }

  async getUsageStats(period: 'day' | 'week' | 'month' = 'week') {
    return this.request<UsageStats>(`/monitoring/usage?period=${period}`)
  }

  async getLatencyStats() {
    return this.request<LatencyStats>('/monitoring/latency')
  }
}

// Types
export interface Instance {
  id: number
  name: string
  code: string
  base_url: string
  description?: string
  region: string
  weight: number
  tags: Record<string, any>
  status: 'active' | 'paused' | 'offline'
  health_status: 'unknown' | 'healthy' | 'unhealthy'
  health_msg?: string
  last_health_at?: string
  max_concurrent: number
  runtime_type: string
  total_requests: number
  active_sessions: number
  avg_latency_ms: number
  create_time: string
}

export interface Agent {
  id: number
  agent_id: string
  name: string
  role: string
  role_type: string
  tags: string[]
  description?: string
  persona?: string
  system_prompt?: string
  greeting?: string
  model: string
  capabilities: string[]
  status: 'draft' | 'active' | 'paused'
  published: boolean
  chat_count: number
}

export interface AuditLog {
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
}

export interface Team {
  id: number
  name: string
  description?: string
  owner_id: number
  status: string
  create_time: string
}

export interface TeamMember {
  id: number
  team_id: number
  user_id: number
  role: 'owner' | 'admin' | 'member' | 'viewer'
  quota_limit: number
}

export interface AgentTask {
  id: number
  team_id: number
  user_id: number
  agent_id: number
  task_type: string
  title: string
  input: Record<string, any>
  output: Record<string, any>
  status: 'pending' | 'running' | 'completed' | 'failed'
  error_msg?: string
  priority: number
  create_time: string
  started_at?: string
  completed_at?: string
}

export interface Skill {
  id: number
  name: string
  version: string
  description?: string
  category: string
  tags: string[]
  config: Record<string, any>
  source: 'local' | 'hub' | 'builtin'
  status: 'draft' | 'published' | 'archived'
  install_count: number
  usage_count: number
}

export interface InstanceSkill {
  instance_id: number
  skill_id: number
  enabled: boolean
  config: Record<string, any>
}

// ========== Monitoring Types ==========

export interface MonitoringOverview {
  instances: {
    total: number
    healthy: number
    unhealthy: number
    unknown: number
  }
  agents: {
    total: number
    active: number
    paused: number
    today_chats: number
  }
  usage: {
    today_tokens: number
    today_requests: number
    avg_latency_ms: number
  }
  quota: {
    total: number
    used: number
    usage_percent: number
  }
}

export interface InstanceStats {
  id: number
  name: string
  code: string
  status: string
  health_status: string
  region: string
  weight: number
  max_concurrent: number
  active_conns: number
  total_requests: number
  avg_latency_ms: number
  last_health_at?: string
}

export interface AgentStats {
  id: number
  agent_id: string
  name: string
  role: string
  status: string
  chat_count: number
  total_tokens: number
  last_chat_at?: string
}

export interface UsageStats {
  period: string
  total_tokens: number
  total_requests: number
  avg_latency_ms: number
  daily: DailyUsage[]
}

export interface DailyUsage {
  date: string
  tokens: number
  requests: number
  avg_latency_ms: number
}

export interface LatencyStats {
  avg_latency_ms: number
  p50_latency_ms: number
  p95_latency_ms: number
  p99_latency_ms: number
  by_instance: InstanceLatency[]
}

export interface InstanceLatency {
  instance_id: number
  instance_name: string
  avg_latency_ms: number
  total_requests: number
}

// Export singleton
export const agentmAPI = new AgentManagerAPI()

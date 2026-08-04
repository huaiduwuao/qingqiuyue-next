/**
 * AgentManager API Client
 * 多 Agent 管理平面前端 SDK
 */

const API_BASE = '/api/agentmanager'

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

  // 获取认证 token（优先 session_id，其次 token）
  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return this.token
    // 优先使用 session_id
    const sessionId = localStorage.getItem('session_id')
    if (sessionId) return sessionId
    const token = localStorage.getItem('token')
    if (token) return token
    return this.token
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { token, ...fetchOpts } = options

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    const authToken = token || this.getAuthToken()
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
  // 同步 session_id（从 core-api 登录后调用）
  syncSessionId(sessionId: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('session_id', sessionId)
    }
    this.token = sessionId
  }

  // 登录时同步 session_id（向后兼容）
  async login(username: string, password: string) {
    // AgentManager 有自己的登录接口，但也要同步 session_id
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

    const queryString = query.toString()
    const path = queryString ? `/instances?${queryString}` : '/instances'
    return this.request<{ list: Instance[]; total: number; page: number; limit: number }>(path)
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

  /**
   * 流式聊天(SSE):stream=true 触发后端流式转发,
   * onDelta 边收文本,onDone 收结束,onError 收错误。
   */
  async chatCompletionsStream(
    model: string,
    messages: { role: string; content: string }[],
    handlers: { onDelta?: (text: string) => void; onDone?: () => void; onError?: (e: string) => void },
  ): Promise<void> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const authToken = this.getAuthToken()
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`

    const res = await fetch(`${API_BASE}/gateway/llm/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, stream: true }),
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }))
      handlers.onError?.(error.error || `HTTP ${res.status}`)
      return
    }
    if (!res.body) {
      handlers.onError?.('响应无流内容')
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let event = 'message'
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let idx
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx).replace(/\r$/, '')
        buffer = buffer.slice(idx + 1)
        if (line.startsWith('event:')) {
          event = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          const dataStr = line.slice(5).trim()
          try {
            const data = JSON.parse(dataStr)
            if (event === 'delta') handlers.onDelta?.(data.text ?? '')
            else if (event === 'done') handlers.onDone?.()
            else if (event === 'error') handlers.onError?.(data.error ?? 'unknown')
          } catch {
            /* 忽略无法解析的行 */
          }
        } else if (line === '') {
          event = 'message'
        }
      }
    }
    handlers.onDone?.()
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

  /**
   * AG-UI 流式对话(SSE):POST /agui,解析 AG-UI 事件流。
   * 事件序列:RunStarted → TextMessageStart → TextMessageContent(多段) → TextMessageEnd → RunFinished
   * onDelta 收文本增量,onDone 收结束,onError 收错误。
   */
  async aguiChat(
    params: { model?: string; agent?: string; prompt: string; system?: string; session_id?: string; user_id?: number; avatar_mode?: boolean; history?: Array<{ role: string; content: string }> },
    handlers: {
      onDelta?: (text: string) => void
      onDone?: () => void
      onError?: (e: string) => void
      onToolCall?: (name: string, toolCallId: string, args?: string) => void
      onToolEnd?: (toolCallId: string) => void
    },
  ): Promise<void> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const authToken = this.getAuthToken()
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`

    const res = await fetch(`${API_BASE}/agui`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }))
      handlers.onError?.(error.error || `HTTP ${res.status}`)
      return
    }
    if (!res.body) {
      handlers.onError?.('响应无流内容')
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8', { fatal: false })
    let buffer = ''
    let finished = false  // 防止 RUN_FINISHED 与流结束重复触发 onDone
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      // 过滤掉 U+FFFD (Unicode replacement char) — DeepSeek LLM 偶尔输出无效 UTF-8 字节流
      const raw = decoder.decode(value, { stream: true })
      buffer += raw.replace(/�/g, '')
      let idx
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, idx).replace(/\r/g, '')
        buffer = buffer.slice(idx + 2)
        // 取 data: 行
        const dataLine = block.split('\n').find(l => l.startsWith('data:'))
        if (!dataLine) continue
        const dataStr = dataLine.slice(5).trim()
        try {
          const data = JSON.parse(dataStr)
          const type = data.type
          if (type === 'TEXT_MESSAGE_CONTENT') {
            // 过滤掉 U+FFFD：json.Marshal 把 LLM 非法 UTF-8 转成了 � 转义序列
            handlers.onDelta?.((data.delta ?? '').replace(/�/g, ''))
          } else if (type === 'RUN_FINISHED') {
            if (!finished) {
              finished = true
              handlers.onDone?.()
            }
          } else if (type === 'RUN_ERROR') {
            handlers.onError?.(data.message || 'run error')
          } else if (type === 'TOOL_CALL_START') {
            handlers.onToolCall?.(data.toolCallName ?? '', data.toolCallId ?? '')
          } else if (type === 'TOOL_CALL_CHUNK') {
            // 携带工具参数(args JSON 存于 delta)。Start 已触发一次,这里补 args。
            handlers.onToolCall?.(data.toolCallName ?? '', data.toolCallId ?? '', data.delta ?? '')
          } else if (type === 'TOOL_CALL_END') {
            handlers.onToolEnd?.(data.toolCallId ?? '')
          }
        } catch {
          /* 忽略无法解析的行 */
        }
      }
    }
    if (!finished) {
      handlers.onDone?.()
    }
  }

  /**
   * 多 Agent 编排:单 agent / 链式 / 并行。
   */
  async multiAgentRun(params: { model?: string; agent?: string; prompt: string; system?: string }) {
    return this.request<{ agent: string; output: string }>('/multi-agent/run', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  async multiAgentChain(params: { agents: string[]; prompt: string }) {
    return this.request<{ agents: string[]; output: string }>('/multi-agent/chain', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  async multiAgentParallel(params: { agents: string[]; prompt: string }) {
    return this.request<{ agents: string[]; output: string }>('/multi-agent/parallel', {
      method: 'POST',
      body: JSON.stringify(params),
    })
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

  async updateSkill(id: number, data: Partial<Skill>) {
    return this.request<Skill>(`/skills/${id}`, {
      method: 'PUT',
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

  // ========== Agents 管理 ==========
  async getAgentById(id: number) {
    return this.request<any>(`/agents/${id}`)
  }

  async listAgents() {
    // 后端返回 { list, total, page, limit },这里取出数组
    const res = await this.request<{ list: Agent[]; total: number }>('/agents')
    return res.list || []
  }

  async updateAgent(id: number, data: Record<string, any>) {
    return this.request<any>(`/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async createAgent(data: Record<string, any>) {
    return this.request<any>('/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async deleteAgent(id: number) {
    return this.request<{ message: string }>(`/agents/${id}`, { method: 'DELETE' })
  }

  // ========== 模型供应商配置 ==========
  async listModelProviders(type?: string) {
    const q = type ? `?type=${type}` : ''
    return this.request<{ list: ModelProvider[]; total: number }>(`/model-providers${q}`)
  }

  async createModelProvider(data: Partial<ModelProvider>) {
    return this.request<ModelProvider>('/model-providers', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateModelProvider(id: number, data: Partial<ModelProvider>) {
    return this.request<ModelProvider>(`/model-providers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteModelProvider(id: number) {
    return this.request<{ message: string }>(`/model-providers/${id}`, { method: 'DELETE' })
  }

  // ========== 节点类型(可维护) ==========
  async listNodeTypes() {
    return this.request<{ list: NodeType[]; total: number }>('/node-types')
  }

  async createNodeType(data: Partial<NodeType>) {
    return this.request<NodeType>('/node-types', { method: 'POST', body: JSON.stringify(data) })
  }

  async updateNodeType(id: number, data: Partial<NodeType>) {
    return this.request<NodeType>(`/node-types/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }

  async deleteNodeType(id: number) {
    return this.request<{ message: string }>(`/node-types/${id}`, { method: 'DELETE' })
  }

  // ========== 工作流执行 / 调度 / 执行记录 ==========
  async executeWorkflow(workflowId: number, input?: Record<string, any>) {
    return this.request<{ run: WorkflowRun; error?: string }>(`/workflows/${workflowId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ input: input ?? {} }),
    })
  }

  async createSchedule(workflowId: number, data: Partial<WorkflowSchedule>) {
    return this.request<WorkflowSchedule>(`/workflows/${workflowId}/schedule`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async listSchedules(workflowId: number) {
    return this.request<{ list: WorkflowSchedule[]; total: number }>(`/workflows/${workflowId}/schedules`)
  }

  async listAllSchedules() {
    return this.request<{ list: WorkflowSchedule[]; total: number }>('/workflow-schedules')
  }

  async updateSchedule(id: number, data: Partial<WorkflowSchedule>) {
    return this.request<WorkflowSchedule>(`/workflow-schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteSchedule(id: number) {
    return this.request<{ message: string }>(`/workflow-schedules/${id}`, { method: 'DELETE' })
  }

  async listWorkflowRuns(params?: { workflow_id?: number; status?: string; limit?: number }) {
    const q = new URLSearchParams()
    if (params?.workflow_id) q.set('workflow_id', String(params.workflow_id))
    if (params?.status) q.set('status', params.status)
    if (params?.limit) q.set('limit', String(params.limit))
    const qs = q.toString()
    return this.request<{ list: WorkflowRun[]; total: number }>(`/workflow-runs${qs ? `?${qs}` : ''}`)
  }

  async getWorkflowRun(id: number) {
    return this.request<{ run: WorkflowRun; steps: WorkflowRunStep[] }>(`/workflow-runs/${id}`)
  }

  // ========== 对话记录与复现 ==========
  async listConversations(params?: { user_id?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams()
    if (params?.user_id) query.set('user_id', params.user_id)
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))
    return this.request<{ list: Conversation[]; total: number; page: number; limit: number }>(`/conversations?${query}`)
  }

  async getConversation(uuid: string) {
    return this.request<Conversation>(`/conversations/${uuid}`)
  }

  async getConversationMessages(uuid: string) {
    return this.request<{ messages: ConversationMessage[] }>(`/conversations/${uuid}/messages`)
  }

  async getConversationCheckpoints(uuid: string) {
    return this.request<{ checkpoints: ConversationCheckpoint[] }>(`/conversations/${uuid}/checkpoints`)
  }

  async replayConversation(uuid: string, params?: { from_checkpoint?: string; from_seq?: number; skip_tool_calls?: boolean }) {
    return this.request<ReplayResult>(`/conversations/${uuid}/replay`, {
      method: 'POST',
      body: JSON.stringify(params ?? {}),
    })
  }

  async deleteConversation(uuid: string) {
    return this.request<{ message: string }>(`/conversations/${uuid}`, { method: 'DELETE' })
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

export type ModelProviderType = 'llm' | 'tts' | 'asr' | 'diffusion' | 'codingplan'

/** 工作流/画布节点类型(后端 node_types 表,可维护) */
export interface NodeType {
  id: number
  kind: string
  label: string
  icon?: string
  color?: string
  category?: 'flow' | 'entity' | 'io'
  allow_source?: boolean
  allow_target?: boolean
  default_config?: Record<string, any>
  sort_order?: number
  enabled?: boolean
}

// ========== 工作流执行 / 调度 ==========
export interface WorkflowSchedule {
  id: number
  workflow_id: number
  kind: 'at' | 'every' | 'cron'
  cron_expr?: string
  every_sec?: number
  at_time?: string
  timezone?: string
  overlap_policy?: 'skip' | 'replace'
  max_runs?: number
  ends_at?: string
  next_run_at?: string
  last_run_at?: string
  last_status?: string
  run_count?: number
  trigger_input?: Record<string, any>
  enabled?: boolean
}

export interface WorkflowRun {
  id: number
  workflow_id: number
  schedule_id?: number
  source: 'manual' | 'scheduled'
  status: 'claimed' | 'running' | 'completed' | 'failed' | 'unknown'
  trigger_input?: Record<string, any>
  final_state?: Record<string, any>
  error?: string
  claimed_at?: string
  started_at?: string
  finished_at?: string
  duration_ms?: number
}

export interface WorkflowRunStep {
  id: number
  run_id: number
  node_id: string
  node_type: string
  phase: 'start' | 'complete' | 'error' | 'skip'
  start_time?: string
  end_time?: string
  duration_ms?: number
  input?: Record<string, any>
  output?: Record<string, any>
  error?: string
  attempt?: number
}

export interface ModelProvider {
  id: number
  type: ModelProviderType
  name: string
  base_url?: string
  api_key?: string
  model?: string
  website?: string
  remark?: string
  enabled: boolean
  is_default: boolean
  /** 上下文长度(0=默认/不限) */
  context_length?: number
  /** API 格式:openai(/chat/completions) / anthropic(/messages) */
  api_format?: 'openai' | 'anthropic'
  /** 认证字段:authorization(Bearer) / x-api-key / api-key(查询参数) */
  auth_field?: 'authorization' | 'x-api-key' | 'api-key'
  create_time?: string
  update_time?: string
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
  runtime_type?: string
  base_url?: string
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

// ========== 对话记录类型 ==========
export interface Conversation {
  id: number
  session_uuid: string
  user_id: number
  tenant_id: number
  title: string
  agent_id: string
  agent_db_id: number
  agent_name: string
  model: string
  mode: string
  status: 'active' | 'completed' | 'interrupted'
  message_count: number
  total_tokens: number
  checkpoint_count: number
  create_time: string
  update_time: string
  end_time?: string
}

export interface ConversationMessage {
  id: number
  conversation_id: number
  seq: number
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  agent_id: string
  agent_db_id: number
  model: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  tool_calls?: Record<string, any>
  tool_call_count: number
  reasoning_steps?: Record<string, any>
  is_checkpoint: boolean
  status: 'success' | 'error' | 'partial'
  error_msg?: string
  latency_ms: number
  create_time: string
}

export interface ConversationCheckpoint {
  id: number
  conversation_id: number
  name: string
  description: string
  last_message_seq: number
  last_message_id: number
  create_time: string
}

export interface ReplayResult {
  conversation_id: number
  session_uuid: string
  title: string
  agent_id: string
  agent_db_id: number
  agent_name: string
  model: string
  mode: string
  messages: ConversationMessage[]
  checkpoints: ConversationCheckpoint[]
  total_messages: number
  total_tokens: number
  duration: number
}

// Export singleton
export const agentmAPI = new AgentManagerAPI()

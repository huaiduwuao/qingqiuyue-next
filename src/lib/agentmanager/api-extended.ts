/**
 * AgentManager API Client — 扩展
 * 新增: Kanban / MCP / Sandbox / PlanExecute 接口
 */

import { agentmAPI as baseAPI } from './api'

// ========== Kanban ==========

export interface KanbanBoard {
  id: number
  slug: string
  name: string
  description?: string
  created_at: string
}

export interface KanbanTask {
  id: number
  board_id: number
  title: string
  body?: string
  status: 'todo' | 'ready' | 'running' | 'scheduled' | 'blocked' | 'done' | 'archived'
  priority: number
  assignee?: string
  created_by?: string
  created_at: string
  started_at?: string
  completed_at?: string
  workspace_kind: 'scratch' | 'worktree' | 'dir'
  workspace_path?: string
  branch_name?: string
  result?: string
  skills: string[]
  session_id?: string
  current_step_key?: string
}

export interface KanbanEvent {
  id: number
  task_id: number
  kind: string
  payload: Record<string, any>
  created_at: string
}

// ========== MCP ==========

export interface MCPServer {
  id: number
  name: string
  transport: 'stdio' | 'sse' | 'streamable_http'
  command?: string
  args?: string[]
  url?: string
  headers?: Record<string, string>
  timeout?: number
  status: 'active' | 'paused'
  tool_count: number
  created_at: string
}

export interface MCPTool {
  name: string
  description?: string
  input_schema?: Record<string, any>
}

// ========== Skill Executable ==========

export interface ExecutableSkill {
  id: number
  name: string
  description: string
  category: string
  tags: string[]
  kind: 'tool' | 'prompt' | 'mcp' | 'pipeline'
  // kind=tool
  tool_config?: {
    func_name: string
    input_schema: Record<string, any>
    destructive: boolean
  }
  // kind=prompt
  prompt_template?: string
  // kind=mcp
  mcp_tool_ref?: string
  // kind=pipeline
  pipeline?: PipelineStep[]
  status: 'draft' | 'active' | 'paused'
  usage_count: number
}

export interface PipelineStep {
  type: 'skill' | 'tool' | 'mcp'
  ref: string
  args?: Record<string, any>
  next_on?: string
}

// ========== Sandbox ==========

export interface SandboxStats {
  available: number
  in_use: number
  total: number
  running_tasks: number
}

export interface SandboxContainer {
  id: string
  name: string
  task_id: number
  created_at: string
  status: 'available' | 'running' | 'stopping'
}

// ========== Agent Orchestration ==========

export interface AgentExecution {
  id: string
  agent_id: number
  agent_name: string
  user_id: number
  status: 'pending' | 'running' | 'completed' | 'failed' | 'interrupted'
  mode: 'react' | 'chain' | 'parallel' | 'cycle' | 'plan_execute'
  messages: AgentMessage[]
  tools_used: string[]
  created_at: string
  completed_at?: string
  error?: string
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: AgentToolCall[]
  tool_call_id?: string
  name?: string
}

export interface AgentToolCall {
  id: string
  name: string
  arguments: string
}

export interface PlanStep {
  step: string
  status: 'pending' | 'running' | 'done' | 'failed'
  result?: string
}

// ========== 扩展 API Client ==========

const API_BASE = '/api/agentmanager'

class ExtendedAgentmAPI {
  private token: string | null = null

  setToken(t: string) { this.token = t }

  private async request<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(opts.headers as Record<string, string>),
    }
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`
    const res = await fetch(`${API_BASE}${path}`, { ...opts, headers })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    return res.json()
  }

  // --- Kanban ---
  async listKanbanBoards() {
    return this.request<{ list: KanbanBoard[] }>('/kanban/boards')
  }

  async createKanbanBoard(data: { name: string; slug?: string; description?: string }) {
    return this.request<KanbanBoard>('/kanban/boards', { method: 'POST', body: JSON.stringify(data) })
  }

  async listKanbanTasks(boardId: number, params?: { status?: string }) {
    const qs = params?.status ? `?status=${params.status}` : ''
    return this.request<{ list: KanbanTask[] }>(`/kanban/boards/${boardId}/tasks${qs}`)
  }

  async createKanbanTask(boardId: number, data: { title: string; body?: string; priority?: number; skills?: string[] }) {
    return this.request<KanbanTask>(`/kanban/boards/${boardId}/tasks`, { method: 'POST', body: JSON.stringify(data) })
  }

  async moveKanbanTask(taskId: number, status: string) {
    return this.request<{ message: string }>(`/kanban/tasks/${taskId}/move`, {
      method: 'PATCH', body: JSON.stringify({ status }),
    })
  }

  async deleteKanbanTask(taskId: number) {
    return this.request<{ message: string }>(`/kanban/tasks/${taskId}`, { method: 'DELETE' })
  }

  async claimKanbanTask(boardId: number, workerId: string) {
    return this.request<KanbanTask>(`/kanban/boards/${boardId}/claim`, { method: 'POST', body: JSON.stringify({ worker_id: workerId }) })
  }

  async completeKanbanTask(taskId: number, result: string) {
    return this.request<{ message: string }>(`/kanban/tasks/${taskId}/complete`, {
      method: 'POST', body: JSON.stringify({ result }),
    })
  }

  async getKanbanTaskEvents(taskId: number) {
    return this.request<{ list: KanbanEvent[] }>(`/kanban/tasks/${taskId}/events`)
  }

  // --- MCP ---
  async listMCPServers() {
    return this.request<{ list: MCPServer[] }>('/mcp/servers')
  }

  async addMCPServer(data: Partial<MCPServer>) {
    return this.request<MCPServer>('/mcp/servers', { method: 'POST', body: JSON.stringify(data) })
  }

  async removeMCPServer(id: number) {
    return this.request<{ message: string }>(`/mcp/servers/${id}`, { method: 'DELETE' })
  }

  async listMCPTools(serverId: number) {
    return this.request<{ list: MCPTool[] }>(`/mcp/servers/${serverId}/tools`)
  }

  // --- Skill Executable ---
  async listExecutableSkills(params?: { category?: string; kind?: string }) {
    const qs = new URLSearchParams()
    if (params?.category) qs.set('category', params.category)
    if (params?.kind) qs.set('kind', params.kind)
    const q = qs.toString()
    return this.request<{ list: ExecutableSkill[] }>(`/skills/executable${q ? '?' + q : ''}`)
  }

  async createExecutableSkill(data: Partial<ExecutableSkill>) {
    return this.request<ExecutableSkill>('/skills/executable', { method: 'POST', body: JSON.stringify(data) })
  }

  async attachSkillToAgent(agentId: number, skillId: number) {
    return this.request<{ message: string }>(`/agents/${agentId}/skills`, {
      method: 'POST', body: JSON.stringify({ skill_id: skillId }),
    })
  }

  async detachSkillFromAgent(agentId: number, skillId: number) {
    return this.request<{ message: string }>(`/agents/${agentId}/skills/${skillId}`, { method: 'DELETE' })
  }

  async registerSkillFunc(name: string, code: string) {
    return this.request<{ message: string }>('/skills/funcs', { method: 'POST', body: JSON.stringify({ name, code }) })
  }

  async listSkillFuncs() {
    return this.request<{ list: string[] }>('/skills/funcs')
  }

  // --- Sandbox ---
  async getSandboxStats() {
    return this.request<SandboxStats>('/sandbox/stats')
  }

  async listSandboxContainers() {
    return this.request<{ list: SandboxContainer[] }>('/sandbox/containers')
  }

  async acquireSandbox(taskId: number) {
    return this.request<{ container_id: string }>('/sandbox/acquire', {
      method: 'POST', body: JSON.stringify({ task_id: taskId }),
    })
  }

  async releaseSandbox(containerId: string) {
    return this.request<{ message: string }>(`/sandbox/release/${containerId}`, { method: 'POST' })
  }

  // --- Agent Execution ---
  async runAgent(agentId: number, messages: AgentMessage[], opts?: { mode?: string; stream?: boolean }) {
    return this.request<AgentExecution>('/agent/run', {
      method: 'POST', body: JSON.stringify({ agent_id: agentId, messages, ...opts }),
    })
  }

  async runAgentStream(agentId: number, messages: AgentMessage[], opts?: { mode?: string }): Promise<EventSource> {
    const body = JSON.stringify({ agent_id: agentId, messages, mode: opts?.mode || 'react' })
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
    }
    const resp = await fetch(`${API_BASE}/agent/run/stream`, { method: 'POST', body, headers })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    // SSE stream via ReadableStream
    return new EventSource(`${API_BASE}/agent/run/stream`, {
      // @ts-ignore
      fetch: (url: string, init: any) => ({ ...fetch(url, init), body, headers }),
    } as any)
  }

  async listAgentExecutions(agentId?: number, params?: { status?: string; limit?: number }) {
    const qs = new URLSearchParams()
    if (agentId) qs.set('agent_id', String(agentId))
    if (params?.status) qs.set('status', params.status)
    if (params?.limit) qs.set('limit', String(params.limit))
    const q = qs.toString()
    return this.request<{ list: AgentExecution[] }>(`/agent/executions${q ? '?' + q : ''}`)
  }

  async interruptAgentExecution(executionId: string) {
    return this.request<{ message: string }>(`/agent/executions/${executionId}/interrupt`, { method: 'POST' })
  }

  async resumeAgentExecution(executionId: string, resumeData: Record<string, any>) {
    return this.request<AgentExecution>(`/agent/executions/${executionId}/resume`, {
      method: 'POST', body: JSON.stringify(resumeData),
    })
  }

  // --- Plan-Execute ---
  async runPlanExecute(goal: string, maxSteps?: number) {
    return this.request<AgentExecution>('/agent/plan_execute', {
      method: 'POST', body: JSON.stringify({ goal, max_steps: maxSteps || 10 }),
    })
  }
}

export const agentmExtendedAPI = new ExtendedAgentmAPI()

/**
 * Canvas 画布 API 客户端
 * 对接 /api/agentmanager/canvas 后端路由
 */

import type {
  AgentCanvas,
  AgentAssociations,
  AgentWorkflowInfo,
  AgentMemoryInfo,
  WorkflowResult,
  SkillResult,
  SkillKind,
} from './types'

const API_BASE = '/api/agentmanager'

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('session_id') || localStorage.getItem('token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  const token = getAuthToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(error.error || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * SSE 流式请求
 * 后端按 event: delta(增量文本)/ result(最终结果)/ error 推送。
 * onDelta 收增量,onResult 收最终对象,onError 收错误。
 */
async function requestStream<TResult = any>(
  path: string,
  body: any,
  handlers: {
    onDelta?: (text: string) => void
    onResult?: (result: TResult) => void
    onError?: (err: string) => void
  },
): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getAuthToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
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

    // 按行解析 SSE:event: xxx / data: {...} / 空行结束一条
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
          else if (event === 'result') handlers.onResult?.(data as TResult)
          else if (event === 'error') handlers.onError?.(data.error ?? 'unknown')
        } catch {
          /* 忽略无法解析的行 */
        }
      } else if (line === '') {
        event = 'message'
      }
    }
  }
}

export const canvasAPI = {
  // ========== 画布 ==========
  getCanvas: (agentId: number) =>
    request<AgentCanvas>(`/canvas/${agentId}`),

  saveCanvas: (agentId: number, canvasData: any, config?: any) =>
    request<{ success: boolean }>(`/canvas/${agentId}`, {
      method: 'PUT',
      body: JSON.stringify({ canvas_data: canvasData, config }),
    }),

  addNode: (agentId: number, node: { node_id: string; node_type: string; ref_id?: number; position?: any; config?: any }) =>
    request(`/canvas/${agentId}/nodes`, {
      method: 'POST',
      body: JSON.stringify(node),
    }),

  deleteNode: (agentId: number, nodeId: string) =>
    request(`/canvas/${agentId}/nodes/${nodeId}`, { method: 'DELETE' }),

  // ========== 关联 ==========
  getAssociations: (agentId: number) =>
    request<AgentAssociations>(`/canvas/${agentId}/associations`),

  linkSkill: (agentId: number, skillId: number, config?: any) =>
    request(`/canvas/${agentId}/link-skill`, {
      method: 'POST',
      body: JSON.stringify({ skill_id: skillId, config }),
    }),

  unlinkSkill: (agentId: number, skillId: number) =>
    request(`/canvas/${agentId}/link-skill/${skillId}`, { method: 'DELETE' }),

  linkMCP: (agentId: number, mcpServerId: number, config?: any) =>
    request(`/canvas/${agentId}/link-mcp`, {
      method: 'POST',
      body: JSON.stringify({ mcp_server_id: mcpServerId, config }),
    }),

  unlinkMCP: (agentId: number, mcpServerId: number) =>
    request(`/canvas/${agentId}/link-mcp/${mcpServerId}`, { method: 'DELETE' }),

  // ========== 工作流 ==========
  listWorkflows: (agentId: number) =>
    request<AgentWorkflowInfo[]>(`/canvas/${agentId}/workflows`),

  createWorkflow: (agentId: number, data: { name: string; description?: string; workflow_json: string; workflow_type?: string }) =>
    request<AgentWorkflowInfo>(`/canvas/${agentId}/workflows`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateWorkflow: (agentId: number, workflowId: number, data: { name?: string; description?: string; workflow_json?: string; workflow_type?: string; status?: string }) =>
    request<AgentWorkflowInfo>(`/canvas/${agentId}/workflows/${workflowId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteWorkflow: (agentId: number, workflowId: number) =>
    request(`/canvas/${agentId}/workflows/${workflowId}`, { method: 'DELETE' }),

  // ========== 记忆 ==========
  listMemories: (agentId: number) =>
    request<AgentMemoryInfo[]>(`/canvas/${agentId}/memories`),

  setMemory: (agentId: number, data: { id?: number; name: string; memory_type?: string; description?: string; config?: any; content?: string; priority?: number }) =>
    request<AgentMemoryInfo>(`/canvas/${agentId}/memories`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteMemory: (agentId: number, memoryId: number) =>
    request(`/canvas/${agentId}/memories/${memoryId}`, { method: 'DELETE' }),

  // ========== LLM 生成 ==========
  // currentCanvas:当前画布 {nodes,edges},传入后 LLM 在其基础上按 prompt 修改(对话操作画布)
  generateWorkflow: (prompt: string, agentContext?: string, currentCanvas?: { nodes: any[]; edges: any[] }) =>
    request<WorkflowResult>('/canvas/generate-workflow', {
      method: 'POST',
      body: JSON.stringify({ prompt, agent_context: agentContext, current_canvas: currentCanvas }),
    }),

  // 流式生成工作流(SSE):onDelta 收增量文本,onResult 收最终 WorkflowResult
  generateWorkflowStream: (
    prompt: string,
    agentContext: string | undefined,
    currentCanvas: { nodes: any[]; edges: any[] } | undefined,
    handlers: { onDelta?: (text: string) => void; onResult?: (r: WorkflowResult) => void; onError?: (e: string) => void },
  ) =>
    requestStream<WorkflowResult>('/canvas/generate-workflow-stream', {
      prompt,
      agent_context: agentContext,
      current_canvas: currentCanvas,
    }, handlers),

  generateSkill: (prompt: string, skillType: SkillKind) =>
    request<SkillResult>('/canvas/generate-skill', {
      method: 'POST',
      body: JSON.stringify({ prompt, skill_type: skillType }),
    }),

  // 流式生成技能(SSE)
  generateSkillStream: (
    prompt: string,
    skillType: SkillKind,
    handlers: { onDelta?: (text: string) => void; onResult?: (r: SkillResult) => void; onError?: (e: string) => void },
  ) =>
    requestStream<SkillResult>('/canvas/generate-skill-stream', {
      prompt,
      skill_type: skillType,
    }, handlers),
}

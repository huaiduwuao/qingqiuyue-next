// Canvas 画布相关类型定义

/** 画布节点类型 */
export type CanvasNodeType =
  | 'agent'
  | 'skill'
  | 'mcp'
  | 'memory'
  | 'workflow'
  | 'start'
  | 'end'
  | 'condition'
  | 'action'
  | 'parallel'

/** 画布节点数据 */
export interface CanvasNodeData {
  label: string
  nodeType: CanvasNodeType
  refId?: number
  config?: Record<string, any>
  [key: string]: any
}

/** 后端画布实体 */
export interface AgentCanvas {
  id: number
  agent_id: number
  name: string
  description: string
  canvas_data: {
    nodes?: any[]
    edges?: any[]
  }
  config?: Record<string, any>
  version: number
  create_time: string
  update_time: string
}

/** 技能类型 */
export type SkillKind = 'tool' | 'prompt' | 'mcp' | 'pipeline'

/** 工作流类型 */
export type WorkflowType = 'sequential' | 'parallel' | 'conditional' | 'plan_execute'

/** 工作流生成结果 */
export interface WorkflowResult {
  success: boolean
  error?: string
  name: string
  description: string
  workflow_type: WorkflowType
  workflow_json: string
  nodes: WorkflowNodeDef[]
  edges: WorkflowEdgeDef[]
}

export interface WorkflowNodeDef {
  id: string
  type: string
  name: string
  config?: Record<string, any>
  position?: { x: number; y: number }
}

export interface WorkflowEdgeDef {
  id: string
  source: string
  target: string
  source_handle?: string
  target_handle?: string
  condition?: string
}

/** 技能生成结果 */
export interface SkillResult {
  success: boolean
  error?: string
  name: string
  description: string
  category: string
  kind: SkillKind
  tool_name?: string
  tool_description?: string
  input_schema?: Record<string, any>
  func_name?: string
  prompt_template?: string
  mcp_server_name?: string
  mcp_tool_name?: string
  pipeline_steps?: PipelineStepDef[]
}

export interface PipelineStepDef {
  type: string
  ref: string
  args?: Record<string, any>
  next_on?: string
}

/** Agent 关联信息 */
export interface AgentAssociations {
  agent_id: number
  skills: AgentSkillInfo[]
  mcps: AgentMCPInfo[]
  workflows: AgentWorkflowInfo[]
  memories: AgentMemoryInfo[]
  canvas?: AgentCanvas
}

export interface AgentSkillInfo {
  agent_id: number
  skill_id: number
  enabled: boolean
  priority: number
  config?: Record<string, any>
  skill_name: string
  skill_category: string
  skill_status: string
}

export interface AgentMCPInfo {
  agent_id: number
  mcp_server_id: number
  enabled: boolean
  config?: Record<string, any>
  mcp_server_name: string
  mcp_tool_count: number
}

export interface AgentWorkflowInfo {
  id: number
  agent_id: number
  name: string
  description: string
  workflow_json: string
  workflow_type: WorkflowType
  version: number
  status: string
  exec_count: number
  last_exec_at?: string
}

export interface AgentMemoryInfo {
  id: number
  agent_id: number
  name: string
  memory_type: string
  description: string
  config?: Record<string, any>
  content: string
  priority: number
  access_count: number
  last_access_at?: string
}

/** 节点类型的展示配置 */
export const NODE_TYPE_META: Record<CanvasNodeType, { label: string; color: string; icon: string }> = {
  agent: { label: 'Agent', color: '#1976d2', icon: '🤖' },
  skill: { label: '技能', color: '#9c27b0', icon: '⚡' },
  mcp: { label: 'MCP', color: '#2e7d32', icon: '🔌' },
  memory: { label: '记忆', color: '#ed6c02', icon: '🧠' },
  workflow: { label: '工作流', color: '#0288d1', icon: '🔀' },
  start: { label: '开始', color: '#43a047', icon: '▶' },
  end: { label: '结束', color: '#e53935', icon: '⏹' },
  condition: { label: '条件', color: '#fdd835', icon: '◇' },
  action: { label: '动作', color: '#00897b', icon: '▣' },
  parallel: { label: '并行', color: '#5e35b1', icon: '∥' },
}

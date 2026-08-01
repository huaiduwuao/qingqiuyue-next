/**
 * 动态 UI 类型定义
 * 与后端 hermeshubs/types.go 保持一致
 */

// =============================================================================
// 基础类型
// =============================================================================

export type DialogueAct = 'request' | 'confirm' | 'answer' | 'clarify' | 'chitchat' | 'unknown'

export type UIType = 'modal' | 'drawer' | 'toast' | 'inline' | 'fullscreen' | 'floating'

export interface UIPosition {
  vertical: 'top' | 'center' | 'bottom'
  horizontal: 'left' | 'center' | 'right'
  offset?: number
}

export type UIBodyType = 'text' | 'markdown' | 'list' | 'grid' | 'chart' | 'form' | 'custom' | 'loading'

export type UIActionStyle = 'primary' | 'secondary' | 'danger' | 'ghost'

export type StepType = 'agent' | 'tool' | 'intent' | 'wait' | 'ui'

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed'

// =============================================================================
// 意图分析
// =============================================================================

export interface IntentBranch {
  id: string
  intent: string
  confidence: number
  required: boolean
  plan?: IntentPlan
  ui?: DynamicUI
  followUp?: string
}

export interface IntentPlan {
  agentId?: string
  toolCalls?: ToolCall[]
  subIntents?: IntentBranch[]
}

export interface ToolCall {
  name: string
  arguments?: Record<string, any>
}

export interface AnalyzeResponse {
  branches: IntentBranch[]
  primaryIntent: string
  dialogueAct: DialogueAct
  followUp?: string
  suggestedUI?: DynamicUI
  executionPlan?: ExecutionPlan
}

// =============================================================================
// 动态 UI
// =============================================================================

export interface DynamicUI {
  type: UIType
  position?: UIPosition
  header?: UIHeader
  body?: UIBody
  actions?: UIAction[]
  avatar?: UIAvatar
  duration?: number
  closeCondition?: string
}

export interface UIHeader {
  title: string
  subtitle?: string
  avatar?: string
  closable?: boolean
}

export interface UIBody {
  type: UIBodyType
  content: any
}

// 内容类型
export interface ListContent {
  items: ListItem[]
}

export interface ListItem {
  id: string
  title: string
  subtitle?: string
  icon?: string
  image?: string
  tags?: string[]
  action?: string
}

export interface GridContent {
  columns: number
  items: GridItem[]
}

export interface GridItem {
  id: string
  title: string
  image?: string
  subtitle?: string
  badge?: string
  action?: string
}

export interface FormContent {
  fields: FormField[]
}

export interface FormField {
  name: string
  type: 'text' | 'password' | 'select' | 'checkbox' | 'radio' | 'date'
  label: string
  placeholder?: string
  required?: boolean
  default?: any
  options?: SelectOption[]
}

export interface SelectOption {
  value: string
  label: string
}

export interface UIAction {
  id: string
  label: string
  icon?: string
  style: UIActionStyle
  handler: 'agent' | 'tool' | 'navigate' | 'intent' | 'ui'
  target?: string
  params?: Record<string, any>
  disabled?: boolean
}

export interface UIAvatar {
  speak?: string
  expression?: string
  action?: string
  duration?: number
}

// =============================================================================
// 执行
// =============================================================================

export interface ExecutionPlan {
  mode: 'sequential' | 'parallel' | 'mixed'
  groups?: ExecutionGroup[]
  aggregation: 'first' | 'all' | 'llm' | 'none'
  responseTemplate?: string
}

export interface ExecutionGroup {
  id: string
  parallel: boolean
  steps: ExecutionStep[]
}

export interface ExecutionStep {
  id: string
  type: StepType
  agentId?: string
  toolCall?: ToolCall
  intentId?: string
}

export interface ExecuteRequest {
  sessionId?: string
  userId?: number
  plan?: ExecutionPlan
  branches?: IntentBranch[]
  context?: Record<string, any>
}

export interface ExecuteResponse {
  executionId: string
  status: ExecutionStatus
  branchResults?: BranchResult[]
  aggregatedResult?: AggregatedResult
  ui?: DynamicUI
  avatar?: UIAvatar
  error?: string
  durationMs: number
}

export interface BranchResult {
  branchId: string
  status: ExecutionStatus
  agentResult?: AgentResult
  toolResults?: ToolResult[]
  uiResult?: UIResult
  error?: string
  durationMs?: number
}

export interface AgentResult {
  agentId: string
  success: boolean
  response?: string
  data?: any
  toolCalls?: ToolCall[]
  suggestedUI?: DynamicUI
}

export interface ToolResult {
  tool: string
  success: boolean
  result?: any
  error?: string
}

export interface UIResult {
  action: 'rendered' | 'closed' | 'clicked'
  uiId?: string
  clickedId?: string
}

export interface AggregatedResult {
  text: string
  data?: any
  ui?: DynamicUI
  avatar?: UIAvatar
  nextActions?: UIAction[]
}

// =============================================================================
// 会话
// =============================================================================

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AnalyzeRequest {
  message: string
  sessionId?: string
  userId?: number
  history?: Message[]
  availableAgents?: AgentInfo[]
  availableTools?: ToolInfo[]
  recentIntents?: string[]
  context?: Record<string, any>
}

export interface AgentInfo {
  id: string
  name: string
  description: string
  capabilities?: string[]
}

export interface ToolInfo {
  name: string
  description: string
  parameters?: Record<string, any>
}

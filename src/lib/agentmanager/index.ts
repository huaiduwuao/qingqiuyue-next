/**
 * AgentManager 客户端导出
 */

export { agentmAPI } from './api'
export type {
  Instance,
  Agent,
  AuditLog,
  Team,
  TeamMember,
  AgentTask,
  Skill,
  InstanceSkill,
} from './api'
export { default as Console } from './Console'
export { ChatPanel } from './ChatPanel'
export { AgentSelector, AgentCard } from './AgentSelector'

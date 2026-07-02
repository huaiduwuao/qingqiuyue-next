/**
 * agents/session-context.ts — 会话级多角色状态管理
 *
 * 每个 conversation 维护一个角色栈 (agentStack):
 *   - 栈顶 = 当前活跃角色
 *   - pushAgent = 临时委派 (如"让运维专家看看")
 *   - popAgent  = 返回上一个角色
 *   - switchAgent = 直接切换当前角色 (替换栈顶)
 */

import type { Agent } from '@/lib/db/schema'

export type MemoryScope = 'isolated' | 'shared-readonly' | 'shared-full' | 'role-based'

export interface SessionContext {
  conversationId: string
  agentStack: string[]
  activeAgentId: string | null
  memoryScope: MemoryScope
}

class SessionContextManager {
  private sessions = new Map<string, SessionContext>()

  get(conversationId: string): SessionContext {
    let ctx = this.sessions.get(conversationId)
    if (!ctx) {
      ctx = {
        conversationId,
        agentStack: [],
        activeAgentId: null,
        memoryScope: 'role-based',
      }
      this.sessions.set(conversationId, ctx)
    }
    return ctx
  }

  setActive(conversationId: string, agentId: string): SessionContext {
    const ctx = this.get(conversationId)
    ctx.activeAgentId = agentId
    if (!ctx.agentStack.includes(agentId)) {
      ctx.agentStack.push(agentId)
    }
    return ctx
  }

  switchAgent(conversationId: string, agentId: string): SessionContext {
    const ctx = this.get(conversationId)
    if (ctx.agentStack.length > 0) {
      ctx.agentStack[ctx.agentStack.length - 1] = agentId
    } else {
      ctx.agentStack.push(agentId)
    }
    ctx.activeAgentId = agentId
    return ctx
  }

  pushAgent(conversationId: string, agentId: string): SessionContext {
    const ctx = this.get(conversationId)
    ctx.agentStack.push(agentId)
    ctx.activeAgentId = agentId
    return ctx
  }

  popAgent(conversationId: string): { agentId: string | null; ctx: SessionContext } {
    const ctx = this.get(conversationId)
    const popped = ctx.agentStack.pop() || null
    ctx.activeAgentId = ctx.agentStack.at(-1) || null
    return { agentId: popped, ctx }
  }

  clear(conversationId: string): void {
    this.sessions.delete(conversationId)
  }

  setMemoryScope(conversationId: string, scope: MemoryScope): SessionContext {
    const ctx = this.get(conversationId)
    ctx.memoryScope = scope
    return ctx
  }

  getActiveAgentId(conversationId: string): string | null {
    return this.get(conversationId).activeAgentId
  }
}

export const sessionManager = new SessionContextManager()

// 辅助: 根据 memoryScope 判断两个 agent 是否共享上下文
export function shouldShareMemory(scope: MemoryScope, agentA?: string | null, agentB?: string | null): boolean {
  if (scope === 'shared-full') return true
  if (scope === 'shared-readonly') return true
  if (scope === 'role-based') return agentA === agentB
  return false
}

// 辅助: 判断当前 agent 能否读取其他 agent 的消息
export function canReadOtherAgents(scope: MemoryScope): boolean {
  return scope === 'shared-full' || scope === 'shared-readonly'
}

// 辅助: 判断当前 agent 能否写入共享上下文
export function canWriteSharedContext(scope: MemoryScope): boolean {
  return scope === 'shared-full'
}

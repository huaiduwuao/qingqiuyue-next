/**
 * Agent Registry — DB 驱动的多 agent 动态管理
 *
 * 核心:
 *   - 启动时从 PG 读 agents 表
 *   - 每个 agent 自动登录自己的 Hermes (如配了 hermes_url)
 *   - 预热 session (或新建), 保存在 DB 的 hermes_session_id
 *   - pickAgent(intent) 根据意图路由
 *   - CRUD via REST API (/api/admin/agents) 改 DB 后自动热重载
 */

import { db, schema } from '@/lib/db/client'
import { eq } from 'drizzle-orm'
import { HermesClient } from './hermes-client'

export type AgentSpec = typeof schema.agents.$inferSelect

export interface AgentRuntime extends AgentSpec {
  hermes: HermesClient | null     // null = 不需要 hermes (如 digital_human 主对话)
  loadedAt: number
}

declare global {
   
  var __agentRegistry: Map<string, AgentRuntime> | undefined
   
  var __agentRegistryLoadedAt: number | undefined
}

const CACHE_TTL_MS = 30_000  // 30s 自动 reload

class AgentRegistryImpl {
  private agents: Map<string, AgentRuntime> = new Map()
  private loadedAt = 0

  /**
   * 从 DB 加载所有 enabled agent, 自动登录 hermes, 预热 session
   */
  async reload(force = false): Promise<void> {
    const now = Date.now()
    if (!force && now - this.loadedAt < CACHE_TTL_MS && this.agents.size > 0) return

    const rows = await db.select().from(schema.agents).where(eq(schema.agents.enabled, true))
    const next = new Map<string, AgentRuntime>()

    for (const row of rows) {
      let hermes: HermesClient | null = null
      if (row.hermesUrl && row.hermesUsername && row.hermesPassword) {
        try {
          hermes = new HermesClient(row.hermesUrl, row.hermesUsername, row.hermesPassword)
          await hermes.login()
          // 如果 DB 没存 session_id, 新建一个并写回
          if (!row.hermesSessionId) {
            const sid = await hermes.createSession({ persona: row.persona })
            await db.update(schema.agents)
              .set({ hermesSessionId: sid, updatedAt: new Date() })
              .where(eq(schema.agents.id, row.id))
            row.hermesSessionId = sid
          }
        } catch (e) {
          console.error(`[registry] agent "${row.id}" hermes login failed:`, (e as Error).message)
          hermes = null  // 失败但不让整个 registry 崩
        }
      }
      next.set(row.id, { ...row, hermes, loadedAt: now })
    }

    this.agents = next
    this.loadedAt = now
    console.log(`[registry] loaded ${this.agents.size} agents:`, [...this.agents.keys()].join(', '))
  }

  /**
   * 取指定 agent
   */
  async get(id: string): Promise<AgentRuntime | null> {
    await this.reload()
    return this.agents.get(id) || null
  }

  /**
   * 列所有 agent (不登录 hermes, 仅 DB 行)
   */
  list(): AgentRuntime[] {
    return [...this.agents.values()]
  }

  /**
   * 按意图挑 agent
   * 简单规则: 第一个 tools 包含关键词的 agent
   */
  async pickAgent(intent: string): Promise<AgentRuntime | null> {
    await this.reload()
    const intentLower = intent.toLowerCase()
    for (const agent of this.agents.values()) {
      const tools = (agent.tools as string[]) || []
      for (const tool of tools) {
        if (intentLower.includes(tool.toLowerCase())) return agent
      }
    }
    return this.agents.get('digital_human') || null  // fallback
  }

  /**
   * 强制 reload (管理 API 调用)
   */
  async invalidate(): Promise<void> {
    this.loadedAt = 0
    await this.reload(true)
  }
}

// 单例 (避免 HMR 多实例)
const registry: AgentRegistryImpl = globalThis.__agentRegistry
  ? (globalThis.__agentRegistry as any)
  : new AgentRegistryImpl()
if (!globalThis.__agentRegistry) {
  globalThis.__agentRegistry = registry as any
}

export const agentRegistry = registry
/**
 * Shared Context Bus — 多 agent 共享上下文的内存层
 *
 * 设计:
 *   - 全局单例, in-memory 缓存当前对话上下文
 *   - 每 conversation 一个 SharedContext
 *   - agent 按 memory_scope 决定读写权限
 *   - DB (conversations.metadata + messages) 持久化真值
 *
 * 实际生产可换 Redis, 这里先用 in-memory + 定期 snapshot 到 DB.
 */

import type { Task, Artifact } from '@/lib/db/schema'
import type { MemoryScope } from './session-context'

export interface ConversationContext {
  conversationId: string
  userId: string
  userPreferences: {
    style: string
    language: string
    voice: string
    voiceSpeed: number
    wakeWord: string
    [k: string]: any
  }
  history: Array<{
    agentId: string
    role: 'user' | 'assistant' | 'tool'
    content: string
    emotion?: any
    action?: string
    timestamp: number
  }>
  currentTask?: Pick<Task, 'id' | 'agentId' | 'status' | 'prompt' | 'progress'>
  artifacts: Artifact[]
  activeAgentId?: string
  memoryScope?: MemoryScope
  builtAt: number
}

declare global {
  // eslint-disable-next-line no-var
  var __sharedContextCache: Map<string, ConversationContext> | undefined
}

const cache: Map<string, ConversationContext> =
  globalThis.__sharedContextCache ?? new Map<string, ConversationContext>()
if (!globalThis.__sharedContextCache) globalThis.__sharedContextCache = cache

export const sharedContext = {
  get(conversationId: string): ConversationContext | null {
    return cache.get(conversationId) || null
  },

  set(conversationId: string, ctx: ConversationContext): void {
    cache.set(conversationId, ctx)
  },

  addMessage(conversationId: string, msg: ConversationContext['history'][number]): void {
    const ctx = cache.get(conversationId)
    if (!ctx) return
    ctx.history.push(msg)
    // 保留最近 50 条
    if (ctx.history.length > 50) ctx.history = ctx.history.slice(-50)
  },

  setCurrentTask(conversationId: string, task: ConversationContext['currentTask']): void {
    const ctx = cache.get(conversationId)
    if (!ctx) return
    ctx.currentTask = task
  },

  addArtifact(conversationId: string, art: Artifact): void {
    const ctx = cache.get(conversationId)
    if (!ctx) return
    ctx.artifacts.push(art)
  },

  /** 给某 agent 的视图 (按 memory_scope 过滤) */
  viewAs(conversationId: string, scope: MemoryScope, viewerAgentId?: string): Readonly<ConversationContext> | null {
    const ctx = cache.get(conversationId)
    if (!ctx) return null

    if (scope === 'isolated') {
      // isolated: 只看到自己 agent 的 history 和 task
      return Object.freeze({
        ...ctx,
        history: ctx.history.filter((m) => m.agentId === viewerAgentId || m.role === 'user'),
        artifacts: [],
        currentTask: ctx.currentTask?.agentId === viewerAgentId ? ctx.currentTask : undefined,
      }) as any
    }

    if (scope === 'role-based' && viewerAgentId) {
      // role-based: 同角色共享, 跨角色只读用户消息
      return Object.freeze({
        ...ctx,
        history: ctx.history.filter((m) => m.agentId === viewerAgentId || m.role === 'user'),
        currentTask: ctx.currentTask?.agentId === viewerAgentId ? ctx.currentTask : undefined,
      }) as any
    }

    // shared-readonly 和 shared-full 都能看全部, readonly 通过 freeze 防止改
    return Object.freeze(ctx)
  },

  clear(conversationId: string): void {
    cache.delete(conversationId)
  },
}
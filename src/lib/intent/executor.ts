/**
 * Intent Executor — 执行具体意图
 *
 * 实际副作用:
 *   - chat:      返回结果交给 chat route 处理 (TTS + VRM)
 *   - navigate:  Next.js router.push()
 *   - delegate:  入 DB tasks 表, 调 hermes agent
 *   - cron:      入 DB cron_jobs 表, 通知 hermes
 *   - system:    前端 Web Audio API 等
 *   - query:     查 PG 表, 返回结果
 */

import { db, schema } from '@/lib/db/client'
import { desc, eq, ilike, and, sql } from 'drizzle-orm'
import { agentRegistry } from '@/lib/agents/registry'
import { sharedContext } from '@/lib/agents/shared-context'
import { sessionManager } from '@/lib/agents/session-context'
import * as taskEngine from '@/lib/task-engine/store'
import type { Intent } from './types'

export interface ExecutorOptions {
  conversationId: string
  userId?: string
}

export interface ExecutorResult {
  ok: boolean
  message: string
  data?: any
}

export async function executeIntent(intent: Intent, opts: ExecutorOptions): Promise<ExecutorResult> {
  try {
    switch (intent.type) {
      case 'chat':
        // chat 不在这里执行, 由 chat route 处理
        return { ok: true, message: 'chat delegated' }

      case 'navigate':
        if (typeof window !== 'undefined') {
          if (intent.path) {
            // 用 location.assign 整页跳转, 100% 可靠
            // (Next.js App Router 的 pushState+popstate 不被监听, 改 router.push 需要
            //  全局 React 桥接组件, 复杂度不值; 真要 SPA 平滑跳转后面加 bridge)
            // 同时 dispatch 自定义事件, 让前端可以做平滑过渡(过渡动画等)
            window.dispatchEvent(new CustomEvent('digital-human-navigate', { detail: { path: intent.path } }))
            window.location.assign(intent.path)
          }
        }
        return { ok: true, message: `navigated to ${intent.path}` }

      case 'open_external':
        if (typeof window !== 'undefined' && intent.url) {
          // 派发自定义事件给前端 ExternalViewer 组件(在站内的 iframe 弹窗里显示)
          // 不直接用 window.open —— 走前端组件保证用户体验一致
          window.dispatchEvent(new CustomEvent('digital-human-open-external', {
            detail: {
              url: intent.url,
              label: intent.label || new URL(intent.url).hostname,
              mode: intent.mode || 'iframe',
            },
          }))
          // mode='newtab' 时同时开新标签(用户明确要求)
          if (intent.mode === 'newtab') {
            window.open(intent.url, '_blank', 'noopener,noreferrer')
          }
        }
        return { ok: true, message: `opened ${intent.url}` }

      case 'walk_to':
        if (typeof window !== 'undefined') {
          // 把语义 target 转成屏幕坐标
          let target: { x: number; y: number }
          const w = window.innerWidth
          const h = window.innerHeight
          const FW = 320  // 浮窗宽
          const FH = 520  // 浮窗高
          if (intent.target === 'cursor') {
            target = { x: Math.max(0, w - FW - 20), y: Math.max(0, h - FH - 20) }
          } else if (intent.target === 'sidebar') {
            target = { x: 0, y: (h - FH) / 2 }  // 屏幕最左
          } else if (intent.target === 'header') {
            target = { x: (w - FW) / 2, y: 0 }  // 屏幕最上
          } else if (intent.target === 'footer') {
            target = { x: (w - FW) / 2, y: h - FH }  // 屏幕最下
          } else if (intent.target === 'center') {
            target = { x: (w - FW) / 2, y: (h - FH) / 2 }  // 屏幕正中央
          } else if (typeof intent.target === 'object') {
            target = { x: intent.target.x, y: intent.target.y }
          } else {
            target = { x: (w - FW) / 2, y: (h - FH) / 2 }
          }
          // 调 FloatingDigitalHuman 暴露的 walkTo
          const walkTo = (window as any).__qingqiuyueWalkTo as ((t: any, d?: number) => void) | undefined
          if (walkTo) walkTo({ left: target.x, top: target.y }, intent.durationMs || 1500)
          // 走路时也播 walk 动作 + 回来后 idle
          window.dispatchEvent(new CustomEvent('digital-human-walk', { detail: { target: intent.target } }))
        }
        return { ok: true, message: `walking to ${typeof intent.target === 'string' ? intent.target : 'position'}` }

      case 'switch': {
        sessionManager.switchAgent(opts.conversationId, intent.agentId)
        return { ok: true, message: `switched to ${intent.agentId}`, data: { agentId: intent.agentId } }
      }

      case 'return': {
        const { agentId, ctx } = sessionManager.popAgent(opts.conversationId)
        if (!agentId) {
          return { ok: false, message: 'no previous agent to return to' }
        }
        return { ok: true, message: `returned to ${ctx.activeAgentId}`, data: { previousAgentId: agentId, activeAgentId: ctx.activeAgentId } }
      }

      case 'delegate': {
        const agent = await agentRegistry.get(intent.agentId)
        if (!agent) return { ok: false, message: `agent ${intent.agentId} not found` }

        // 临时委派: 把目标 agent 压入会话栈
        sessionManager.pushAgent(opts.conversationId, intent.agentId)

        // 用通用任务引擎创建任务
        const task = taskEngine.createTask({
          taskType: 'hermes',
          userId: opts.userId,
          conversationId: opts.conversationId,
          agentId: intent.agentId,
          prompt: intent.task,
          context: sharedContext.get(opts.conversationId) as unknown as Record<string, unknown>,
        })

        // 异步调 hermes (fire-and-forget)
        if (agent.hermes && agent.hermesSessionId) {
          ;(async () => {
            try {
              taskEngine.markRunning(task.id)
              const result = await agent.hermes!.sendMessage(agent.hermesSessionId!, {
                role: 'user',
                content: intent.task,
              })
              taskEngine.markDone(task.id, result as Record<string, unknown>)
              // artifact 落库 (假设 result 含 url / content)
              if (result?.artifact_url || result?.content) {
                await db.insert(schema.artifacts).values({
                  conversationId: opts.conversationId,
                  agentId: intent.agentId,
                  kind: (result.kind as any) || 'file',
                  url: (result.artifact_url as string) || '',
                  filename: (result.filename as string) || null,
                  metadata: result as any,
                })
              }
            } catch (e) {
              taskEngine.markFailed(task.id, e as Error)
            }
          })()
        }
        return { ok: true, message: `task ${task.id} queued for ${intent.agentId}`, data: { taskId: task.id } }
      }

      case 'cron': {
        const [job] = await db.insert(schema.cronJobs).values({
          userId: opts.userId,
          agentId: intent.agentId || null,
          cronExpr: intent.cronExpr,
          prompt: intent.prompt,
          enabled: true,
        }).returning()
        return { ok: true, message: `cron job ${job.id} created: ${intent.cronExpr}`, data: { cronJobId: job.id } }
      }

      case 'system':
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('digital-human-system', { detail: intent }))
        }
        return { ok: true, message: `system action: ${intent.action}` }

      case 'query': {
        if (intent.kind === 'conversation' || intent.kind === 'task' || intent.kind === 'artifact') {
          const rows = await db.select().from(schema.messages)
            .where(ilike(schema.messages.content, `%${intent.query}%`))
            .orderBy(desc(schema.messages.createdAt))
            .limit(10)
          return { ok: true, message: `found ${rows.length} messages`, data: rows }
        }
        return { ok: false, message: 'unsupported query kind' }
      }

      case 'multi':
        const results = []
        for (const sub of intent.intents) {
          results.push(await executeIntent(sub, opts))
        }
        return { ok: true, message: `multi executed: ${results.length} intents`, data: results }

      default:
        return { ok: false, message: `unknown intent type: ${(intent as any).type}` }
    }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}
import { NextResponse } from 'next/server'
import { db, schema, pingDb } from '@/lib/db/client'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/agents — 返回已启用的 Hermes agent 列表 (供前端角色选择器)
 *
 * 之前实现: 远端 fetch HERMES_API_BASE_URL/api/content/hermes/client/page
 *   → Hermes 服务经常没起 / 跨域问题, fallback 只返默认小月, 用户看不到多角色
 *
 * 现在实现: 直接读 DB (和 /api/admin/agents 同源), 只返 enabled=true 的
 *   → 跟 admin 后台数据一致, 不依赖外部服务
 */

export async function GET() {
  try {
    const pingOk = await pingDb()
    if (!pingOk) {
      // DB 也不可达: fallback 小月(不崩前端)
      return NextResponse.json({
        agents: [
          { agentId: 'xiaoyue', name: '小月', role: 'AI助理', roleType: 'general', description: '清秋月平台的AI数字人助理', avatarUrl: '', greeting: '你好呀，我是小月，有什么可以帮你的吗？' },
        ],
      })
    }

    const rows = await db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.enabled, true))

    const agents = rows
      .filter((a) => a.id && a.displayName)
      .map((a) => ({
        agentId: a.id,
        name: a.displayName,
        role: a.description || '',
        roleType: 'general',
        description: a.description || '',
        avatarUrl: '',
        greeting: '',
      }))

    return NextResponse.json({ agents, count: agents.length })
  } catch (e) {
    console.error('[api/agents] failed:', (e as Error).message)
    return NextResponse.json({
      agents: [
        { agentId: 'xiaoyue', name: '小月', role: 'AI助理', roleType: 'general', description: '清秋月平台的AI数字人助理', avatarUrl: '', greeting: '你好呀，我是小月，有什么可以帮你的吗？' },
      ],
    })
  }
}
/**
 * /api/admin/agents — Agent CRUD (DB 驱动)
 *
 * GET    /api/admin/agents           列所有
 * GET    /api/admin/agents?id=xxx   取一个
 * POST   /api/admin/agents           新建 { id, displayName, persona, model, ... }
 * PUT    /api/admin/agents?id=xxx    更新字段
 * DELETE /api/admin/agents?id=xxx    删除 (软删 enabled=false)
 *
 * 修改后自动 reload agent registry
 */

import { NextRequest, NextResponse } from 'next/server'
import { db, schema, pingDb } from '@/lib/db/client'
import { eq } from 'drizzle-orm'
import { agentRegistry } from '@/lib/agents/registry'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  const pingOk = await pingDb()
  if (!pingOk) {
    return NextResponse.json({ error: 'DB unreachable' }, { status: 503 })
  }
  if (id) {
    const rows = await db.select().from(schema.agents).where(eq(schema.agents.id, id)).limit(1)
    if (!rows[0]) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ agent: rows[0] })
  }
  const all = await db.select().from(schema.agents)
  return NextResponse.json({ agents: all, count: all.length })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const id = body.id
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const insert = {
    id,
    displayName: body.displayName || id,
    description: body.description || null,
    persona: body.persona || '你是助手',
    model: body.model || 'MiniMax-M2.7-highspeed',
    voice: body.voice || null,
    hermesUrl: body.hermesUrl || null,
    hermesUsername: body.hermesUsername || null,
    hermesPassword: body.hermesPassword || null,
    hermesSessionId: null,
    tools: body.tools || [],
    skills: body.skills || [],
    memoryScope: body.memoryScope || 'isolated',
    enabled: body.enabled !== false,
  }
  try {
    const [row] = await db.insert(schema.agents).values(insert).returning()
    await agentRegistry.invalidate()
    return NextResponse.json({ agent: row, created: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function PUT(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id query required' }, { status: 400 })
  const body = await req.json()
  const patch: any = { updatedAt: new Date() }
  for (const k of ['displayName','description','persona','model','voice','hermesUrl',
                    'hermesUsername','hermesPassword','hermesSessionId','memoryScope','enabled']) {
    if (k in body) patch[k] = body[k]
  }
  if ('tools' in body) patch.tools = body.tools
  if ('skills' in body) patch.skills = body.skills

  const [row] = await db.update(schema.agents).set(patch).where(eq(schema.agents.id, id)).returning()
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 })
  await agentRegistry.invalidate()
  return NextResponse.json({ agent: row, updated: true })
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id query required' }, { status: 400 })
  // 软删 (enabled=false), 保留历史关联
  const [row] = await db.update(schema.agents).set({ enabled: false, updatedAt: new Date() }).where(eq(schema.agents.id, id)).returning()
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 })
  await agentRegistry.invalidate()
  return NextResponse.json({ agent: row, disabled: true })
}
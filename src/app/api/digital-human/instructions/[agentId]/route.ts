/**
 * /api/digital-human/instructions/[agentId] —— 透传到 Go 后端数据库
 *
 *   GET    /[agentId]  — fetch one
 *   PUT    /[agentId]  — update (bump version)
 *   DELETE /[agentId]  — delete
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchDigitalHuman } from '@/digital-human/api-mode';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ agentId: string }> }) {
  const { agentId: raw } = await ctx.params;
  const agentId = decodeURIComponent(raw);
  try {
    const r = await fetchDigitalHuman(`/api/realtime/digital-human/instructions/${encodeURIComponent(agentId)}`, { method: 'GET' });
    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: `upstream Go: ${e?.message || e}` }, { status: 502 });
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ agentId: string }> }) {
  const { agentId: raw } = await ctx.params;
  const agentId = decodeURIComponent(raw);
  try {
    const body = await req.text();
    const r = await fetchDigitalHuman(`/api/realtime/digital-human/instructions/${encodeURIComponent(agentId)}`, {
      method: 'PUT',
      body,
    });
    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: `upstream Go: ${e?.message || e}` }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ agentId: string }> }) {
  const { agentId: raw } = await ctx.params;
  const agentId = decodeURIComponent(raw);
  try {
    const r = await fetchDigitalHuman(`/api/realtime/digital-human/instructions/${encodeURIComponent(agentId)}`, { method: 'DELETE' });
    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: `upstream Go: ${e?.message || e}` }, { status: 502 });
  }
}

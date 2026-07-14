/**
 * /api/digital-human/instructions —— 透传到 Go 后端数据库
 *
 *   GET    /api/digital-human/instructions                 — list all
 *   POST   /api/digital-human/instructions                 — create
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchDigitalHuman } from '@/digital-human/api-mode';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const r = await fetchDigitalHuman('/api/realtime/digital-human/instructions', { method: 'GET' });
    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: `upstream Go: ${e?.message || e}` }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const r = await fetchDigitalHuman('/api/realtime/digital-human/instructions', {
      method: 'POST',
      body,
    });
    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: `upstream Go: ${e?.message || e}` }, { status: 502 });
  }
}

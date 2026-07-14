/**
 * /api/digital-human/tools — 列出数字人所有可用工具
 *
 * 透传到 Go 后端
 */

import { NextResponse } from 'next/server';
import { fetchDigitalHuman } from '@/digital-human/api-mode';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const r = await fetchDigitalHuman('/api/realtime/digital-human/tools', { method: 'GET' });
    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: `upstream Go: ${e?.message || e}` }, { status: 502 });
  }
}

/**
 * /api/digital-human/tools — 列出数字人所有可用工具
 *
 * 供:
 *   - 管理页面 (展示工具元数据)
 *   - LLM 提示生成 (`buildToolsHint()` 也内置在 instructions/presets)
 *   - 第三方前端取工具目录
 */

import { NextResponse } from 'next/server';
import { summarizeTools, ALL_TOOLS } from '@/digital-human/tools/tools';
import { isExternalDigitalHumanAPI, fetchDigitalHuman } from '@/digital-human/api-mode';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  if (isExternalDigitalHumanAPI()) {
    try {
      const r = await fetchDigitalHuman('/api/realtime/digital-human/tools', { method: 'GET' });
      const data = await r.json();
      return NextResponse.json(data, { status: r.status });
    } catch (e: any) {
      return NextResponse.json({ error: `upstream Go: ${e?.message || e}` }, { status: 502 });
    }
  }
  return NextResponse.json({
    tools: summarizeTools(),
    fullSchema: ALL_TOOLS.map(t => ({
      name: t.name,
      category: t.category,
      description: t.description,
      parameters: t.parameters,
    })),
  });
}

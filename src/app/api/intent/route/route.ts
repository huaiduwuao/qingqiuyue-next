/**
 * /api/intent/route —— 意图路由（服务端 LLM 调用）
 *
 * 把 intent router 的 LLM function calling 移到服务端执行，
 * 避免客户端 process.env.OPENAI_API_KEY 不可访问的问题。
 *
 * POST body:
 *   { text: string, availableAgents?: { id, displayName, description, tools }[] }
 *
 * 返回: IntentResult { intent, replyText, emotion, action, awaitExecution }
 */

import { NextRequest, NextResponse } from 'next/server';
import { routeIntent } from '@/lib/intent/router';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text: string = body.text || '';
    if (!text.trim()) {
      return NextResponse.json({ error: 'text required' }, { status: 400 });
    }

    const result = await routeIntent(text, {
      availableAgents: body.availableAgents || [],
      systemContext: body.systemContext,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[intent/route] error:', err);
    return NextResponse.json(
      { error: err?.message || 'intent routing failed' },
      { status: 500 },
    );
  }
}

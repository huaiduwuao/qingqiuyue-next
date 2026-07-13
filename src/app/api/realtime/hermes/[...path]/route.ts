/**
 * /api/realtime/hermes/[...path] —— 透传代理到 realtime-api 后端
 *
 * 浏览器无法直接访问 realtime-api:10003(跨域 + cookie),
 * 走这个 catch-all 路由转发请求,把 response 原样返回。
 *
 * 复用 hermesApi 客户端的风格,但作为代理而非直连 dashboard。
 */

import { NextRequest, NextResponse } from 'next/server';

const REALTIME_BASE = process.env.REALTIME_API_URL || 'http://localhost:10003';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function forward(req: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  const subPath = pathSegments.join('/');
  const search = req.nextUrl.search;
  const targetUrl = `${REALTIME_BASE}/api/realtime/hermes/${subPath}${search}`;

  const init: RequestInit = {
    method: req.method,
    headers: filterHeaders(req.headers),
    // body 仅在有 body 时传(GET/HEAD 无 body)
    ...(req.method !== 'GET' && req.method !== 'HEAD' && { body: await req.arrayBuffer() }),
  };

  try {
    const upstream = await fetch(targetUrl, init);
    const buf = await upstream.arrayBuffer();
    const headers = new Headers();
    upstream.headers.forEach((v, k) => {
      // hop-by-hop headers 不能转
      if (['transfer-encoding', 'connection', 'keep-alive'].includes(k.toLowerCase())) return;
      headers.set(k, v);
    });
    return new NextResponse(buf, {
      status: upstream.status,
      headers,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: `realtime-api proxy failed: ${e?.message || e}` },
      { status: 502 },
    );
  }
}

function filterHeaders(h: Headers): HeadersInit {
  const out: Record<string, string> = {};
  h.forEach((v, k) => {
    const lower = k.toLowerCase();
    if (['host', 'connection', 'content-length', 'transfer-encoding'].includes(lower)) return;
    out[k] = v;
  });
  return out;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path || []);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path || []);
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path || []);
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path || []);
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path || []);
}
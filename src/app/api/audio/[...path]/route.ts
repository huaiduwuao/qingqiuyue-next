/**
 * /api/audio/[...path] — Next.js 代理到 audio-gateway (8001)
 *
 * 浏览器 → /api/audio/transcriptions → gateway :8001/v1/audio/transcriptions
 * 浏览器 → /api/audio/align         → gateway :8001/v1/audio/align
 *
 * 透传原始 body (避免 FormData 重新序列化, 大文件 multipart 更稳)
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const GATEWAY = (process.env.AUDIO_GATEWAY_BASE_URL || 'http://127.0.0.1:8001/v1')
  .replace(/\/v1$/, '')

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path } = await ctx.params
  const subPath = path.join('/')
  const targetUrl = `${GATEWAY}/v1/audio/${subPath}${req.nextUrl.search}`

  // 透传 body: 用 ArrayBuffer 避免 FormData re-encode 问题
  let body: BodyInit | undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await req.arrayBuffer()
  }

  // 透传 content-type 和 content-length
  const headers: Record<string, string> = {}
  const contentType = req.headers.get('content-type')
  if (contentType) headers['Content-Type'] = contentType
  const contentLength = req.headers.get('content-length')
  if (contentLength) headers['Content-Length'] = contentLength

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      signal: AbortSignal.timeout(60_000),
    })

    // 透传响应
    const resHeaders = new Headers()
    const ct = upstream.headers.get('content-type')
    if (ct) resHeaders.set('Content-Type', ct)
    const buf = await upstream.arrayBuffer()
    return new NextResponse(buf, { status: upstream.status, headers: resHeaders })
  } catch (e: any) {
    console.error(`[audio proxy] ${targetUrl} 失败:`, e?.message || e)
    return NextResponse.json(
      { error: 'gateway unreachable', detail: e?.message, target: targetUrl },
      { status: 502 }
    )
  }
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const DELETE = proxy
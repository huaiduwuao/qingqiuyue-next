/**
 * /api/audio/speech — TTS 代理
 * 转发到 realtime-api (10.9.1.2:10003) 的 /api/audio/speech
 */

import { NextRequest } from 'next/server'

const REALTIME_API = process.env.NEXT_PUBLIC_REALTIME_URL || 'http://10.9.1.2:10003'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const targetUrl = `${REALTIME_API}/api/audio/speech`

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    })

    // 流式响应直接转发
    if (response.headers.get('content-type')?.includes('text/event-stream') ||
        response.headers.get('content-type')?.includes('audio/')) {
      return new Response(response.body, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('content-type') || 'audio/mpeg',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // 非流式 JSON 响应
    const data = await response.json()
    return Response.json(data, { status: response.status })
  } catch (error) {
    return Response.json({ error: 'TTS proxy error', details: String(error) }, { status: 502 })
  }
}
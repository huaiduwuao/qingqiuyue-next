/**
 * /api/audio/transcriptions — ASR 代理
 * 转发到 realtime-api (10.9.1.2:10003) 的 /api/audio/transcriptions
 */

import { NextRequest } from 'next/server'

const REALTIME_API = process.env.NEXT_PUBLIC_REALTIME_URL || 'http://10.9.1.2:10003'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    // ASR 需要转发 multipart/form-data
    const formData = await req.formData()
    const targetUrl = `${REALTIME_API}/api/audio/transcriptions`

    const response = await fetch(targetUrl, {
      method: 'POST',
      body: formData,
    })

    const data = await response.json()
    return Response.json(data, { status: response.status })
  } catch (error) {
    return Response.json({ error: 'ASR proxy error', details: String(error) }, { status: 502 })
  }
}
import { NextRequest, NextResponse } from 'next/server'
import * as minio from '@/lib/avatar-pipeline/minio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/artifacts/* — 代理 MinIO 对象下载
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ key: string[] }> },
) {
  const { key } = await ctx.params
  const objectKey = key.join('/')
  if (!objectKey) {
    return NextResponse.json({ error: 'key required' }, { status: 400 })
  }

  try {
    const buf = await minio.getObjectBuffer(objectKey)
    if (!buf) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    const stat = await minio.statObject(objectKey)
    const headers = new Headers()
    headers.set('Content-Type', stat?.contentType || 'application/octet-stream')
    headers.set('Cache-Control', 'public, max-age=3600')
    return new NextResponse(new Uint8Array(buf), { headers })
  } catch (e) {
    console.error('[api/artifacts] failed:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

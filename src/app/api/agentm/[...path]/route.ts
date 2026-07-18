/**
 * /api/agentm/* — AgentManager API 代理
 *
 * 所有请求转发到后端 APISIX 网关 (http://apisix:9080/api/agentmanager/*)
 * 避免前端跨域问题，统一入口。
 */

import { NextRequest, NextResponse } from 'next/server'

const AGENTM_BASE = process.env.NEXT_PUBLIC_AGENTM_URL || 'http://localhost:10005/api/agentmanager'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// 匹配 /api/agentm/* 的所有路径
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const pathStr = path.join('/')
  const targetUrl = `${AGENTM_BASE}/${pathStr}${req.nextUrl.search}`

  try {
    const response = await fetch(targetUrl, {
      headers: {
        ...Object.fromEntries(req.headers.entries()),
        'Host': undefined as any,
      },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    return NextResponse.json({ error: 'Backend error' }, { status: 502 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const pathStr = path.join('/')
  const targetUrl = `${AGENTM_BASE}/${pathStr}`
  const body = await req.text()

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...Object.fromEntries(req.headers.entries()),
        'Host': undefined as any,
      },
      body,
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    return NextResponse.json({ error: 'Backend error' }, { status: 502 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const pathStr = path.join('/')
  const targetUrl = `${AGENTM_BASE}/${pathStr}`
  const body = await req.text()

  try {
    const response = await fetch(targetUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...Object.fromEntries(req.headers.entries()),
        'Host': undefined as any,
      },
      body,
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    return NextResponse.json({ error: 'Backend error' }, { status: 502 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const pathStr = path.join('/')
  const targetUrl = `${AGENTM_BASE}/${pathStr}${req.nextUrl.search}`

  try {
    const response = await fetch(targetUrl, {
      method: 'DELETE',
      headers: {
        ...Object.fromEntries(req.headers.entries()),
        'Host': undefined as any,
      },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    return NextResponse.json({ error: 'Backend error' }, { status: 502 })
  }
}

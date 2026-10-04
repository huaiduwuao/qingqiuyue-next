import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { agentmRequest } from './request'
import { agentmAPI } from './api'
import { isApiError } from '@/lib/api/client'
import { setAuthToken } from '@/lib/api/auth'

const fetchMock = vi.fn()

function jsonResponse(body: unknown, status = 200) {
  return new Response(body === undefined ? '' : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function sentAuth(call = 0): string | null {
  const init = fetchMock.mock.calls[call][1] as RequestInit
  return new Headers(init.headers).get('Authorization')
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  setAuthToken(null)
})

afterEach(() => {
  vi.unstubAllGlobals()
  setAuthToken(null)
})

describe('agentmRequest', () => {
  it('平铺 JSON 原样返回,并带上当前登录会话', async () => {
    setAuthToken('sess-1')
    fetchMock.mockResolvedValue(jsonResponse({ list: [1], total: 1 }))
    await expect(agentmRequest('/skills')).resolves.toEqual({ list: [1], total: 1 })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/agentmanager/skills')
    expect(sentAuth()).toBe('Bearer sess-1')
  })

  it('{ code, msg, data } 包装拆到 data;HTTP 200 但 code 失败要抛错', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: 200, msg: 'OK', data: { list: [], total: 0 } }))
    await expect(agentmRequest('/gateway/audit')).resolves.toEqual({ list: [], total: 0 })

    fetchMock.mockResolvedValueOnce(jsonResponse({ code: 500, msg: '数据库挂了' }))
    await expect(agentmRequest('/gateway/audit')).rejects.toMatchObject({ message: '数据库挂了', category: 'business' })
  })

  it('空 body 不再因 res.json() 抛错', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(agentmRequest('/x', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('非 2xx 抛 ApiError,文案取 error / message / msg,401 归为 auth', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'skill not found' }, 404))
    await expect(agentmRequest('/skills/9')).rejects.toSatisfy(e => isApiError(e) && e.message === 'skill not found')

    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'unauthorized' }, 401))
    await expect(agentmRequest('/skills')).rejects.toMatchObject({ category: 'auth', status: 401 })
  })
})

describe('agentmAPI 会话', () => {
  it('登出后不再带 setToken 留下的旧会话', async () => {
    setAuthToken('old-session')
    agentmAPI.setToken('old-session')
    setAuthToken(null)
    fetchMock.mockResolvedValue(jsonResponse({ models: [] }))
    await agentmAPI.listModels()
    expect(sentAuth()).toBeNull()
  })
})

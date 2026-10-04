/**
 * agentmanager 裸 fetch 的公共底座。
 *
 * agentmAPI / agentmExtendedAPI 的方法签名历史上是「resolve 后端 JSON 本体」,
 * 而且有流式(SSE)接口,所以没直接换成 axios 的 agentmanagerClient;但前缀、会话头、
 * 401 通知、错误分类和 { code, msg, data } 拆包都和 agentmanagerClient 走同一套口径:
 *   - 前缀:API_PREFIX(客户端里是网关绝对地址)
 *   - 会话:lib/api/auth 的 authFetch(只认登录会话,不再各自缓存 token)
 *   - 错误:抛 ApiError,formatApiError / isAuthError 能直接用
 */

import { API_PREFIX } from '@/lib/api/prefix'
import { authFetch } from '@/lib/api/auth'
import { ApiError, isEnvelope } from '@/lib/api/client'

export const AGENTMANAGER_BASE = `${API_PREFIX}/api/agentmanager`

export interface AgentmRequestOptions extends RequestInit {
  /** 显式指定会话(极少用);不传则由 authFetch 取当前登录会话 */
  token?: string
}

/** 错误文案:core 用 msg,agentmanager 用 error / message */
export function agentmErrorText(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const b = body as { msg?: unknown; message?: unknown; error?: unknown }
    for (const v of [b.error, b.message, b.msg]) {
      if (typeof v === 'string' && v) return v
    }
  }
  return fallback
}

/** 非 2xx 响应转 ApiError(流式接口拿它的 message 交给 onError) */
export async function agentmResponseError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => null)
  return new ApiError({
    message: agentmErrorText(body, res.statusText || `HTTP ${res.status}`) || `HTTP ${res.status}`,
    category: res.status === 401 ? 'auth' : 'business',
    code: (body as { code?: string | number } | null)?.code,
    status: res.status,
    response: body,
  })
}

/**
 * JSON 请求:resolve 后端 JSON 本体;若是 { code, msg, data } 包装(gateway 审计等少数接口)
 * 则按 agentmanagerClient 的口径拆到 data,HTTP 200 但 code 失败的也抛错。
 */
export async function agentmRequest<T>(path: string, options: AgentmRequestOptions = {}): Promise<T> {
  const { token, ...fetchOpts } = options
  const headers = new Headers(fetchOpts.headers)
  if (!headers.has('Content-Type') && !(typeof FormData !== 'undefined' && fetchOpts.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res: Response
  try {
    res = await authFetch(`${AGENTMANAGER_BASE}${path}`, { ...fetchOpts, headers })
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') throw e
    throw new ApiError({ message: '网络连接失败,请检查网络', category: 'network' })
  }
  if (!res.ok) throw await agentmResponseError(res)

  // 204 / c.Status(200) 这类空 body:以前直接 res.json() 会抛「Unexpected end of JSON input」
  const text = await res.text()
  if (!text) return undefined as T
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return text as T
  }
  if (isEnvelope(body)) {
    if (body.code !== 200 && body.code !== '200' && body.code !== 0) {
      throw new ApiError({
        message: agentmErrorText(body, '请求失败'),
        category: body.code === 401 || body.code === '401' ? 'auth' : 'business',
        code: body.code,
        status: res.status,
        response: body,
      })
    }
    return body.data as T
  }
  return body as T
}

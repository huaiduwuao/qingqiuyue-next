/**
 * 错误处理工具
 * 提供统一的错误日志和错误处理函数
 */

import * as Sentry from '@sentry/nextjs'
import { API_PREFIX } from '@/lib/api/prefix'

// 开发环境是否开启详细日志
const ENABLE_ERROR_LOG = process.env.NODE_ENV === 'development'

// §15.5 前端监控:Sentry(有 DSN 时)+ 自建 /behavior 上报(兜底)。
//
// Sentry 的 init 在 instrumentation-client.ts 里;这里只负责 capture。
// 没配 DSN 时 Sentry 是 no-op,仍然走 /behavior 上报,监控不丢。
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? ''

// 采样:每分钟最多 10 条 /behavior 上报,避免报错风暴打爆后端。
// (Sentry 自己有配额限流,不过滤。)
const CLIENT_ERROR_MAX_PER_MIN = 10
let clientErrorBudget = CLIENT_ERROR_MAX_PER_MIN
if (typeof window !== 'undefined') {
  setInterval(() => {
    clientErrorBudget = CLIENT_ERROR_MAX_PER_MIN
  }, 60_000)
}

/**
 * 把前端错误上报。
 *
 * 顺序:
 *  1. Sentry(如果配了 DSN)—— 有 stack / breadcrumb / 用户上下文
 *  2. 自建 /behavior(action=client_error)—— 无 DSN 时的兜底,且后端可查
 */
export function reportClientError(context: string, error: unknown, extra?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return

  // 1) Sentry
  if (SENTRY_DSN) {
    try {
      Sentry.withScope((scope) => {
        scope.setTag('context', context)
        if (extra) {
          scope.setExtras(extra)
        }
        Sentry.captureException(error)
      })
    } catch {
      /* Sentry 上报失败不影响业务 */
    }
  }

  // 2) 自建 /behavior 兜底(限流)
  if (clientErrorBudget <= 0) return
  clientErrorBudget -= 1

  try {
    const body = {
      userId: 0,
      itemId: 0,
      itemType: 'PAGE',
      action: 'client_error',
      duration: 0,
      page: typeof location !== 'undefined' ? location.pathname : '',
      visitorId: (() => {
        try {
          return localStorage.getItem('qq_vid') || ''
        } catch {
          return ''
        }
      })(),
      // 附加信息:后端 behavior 接口目前只消化 page/visitorId,其余字段留给将来的扩展点
      errorContext: context,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? (error.stack || '').slice(0, 2000) : '',
      ...extra,
    }
    void fetch(API_PREFIX + '/api/content/behavior', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* 上报失败不影响业务 */
  }
}

/**
 * 安全地记录错误日志（不在生产环境暴露敏感信息）
 */
export function safeErrorLog(context: string, error: unknown, ...args: unknown[]): void {
  if (!ENABLE_ERROR_LOG) {
    // 生产环境:控制台简要 + 上报后端监控(§15.5)
    console.error(`[ERROR] ${context}`)
    reportClientError(
      context,
      error,
      args.length > 0 ? { args: args.map((a) => String(a)).slice(0, 3) } : undefined,
    )
    return
  }

  // 开发环境记录详细信息
  console.error(`[ERROR] ${context}:`, error, ...args)
}

/**
 * 静默吞噬错误但记录日志（用于不重要的后台操作）
 */
export function silentCatch(error: unknown, context?: string): void {
  if (context) {
    safeErrorLog(context, error)
  } else {
    safeErrorLog('Async operation failed', error)
  }
}

/**
 * 为 Promise 添加错误处理
 */
export function withErrorHandler<T>(
  promise: Promise<T>,
  onError?: (error: unknown) => void,
): Promise<T | undefined> {
  return promise.catch((error) => {
    if (onError) {
      onError(error)
    } else {
      silentCatch(error)
    }
    return undefined
  })
}

/**
 * 创建带错误处理的回调函数
 */
export function createErrorHandler(context: string, onError?: (error: unknown) => void) {
  return (error: unknown): void => {
    if (onError) {
      onError(error)
    } else {
      safeErrorLog(context, error)
    }
  }
}

/**
 * 安全的异步执行函数
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  fallback: T,
  context?: string,
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    safeErrorLog(context || 'safeAsync failed', error)
    return fallback
  }
}

export default {
  safeErrorLog,
  reportClientError,
  silentCatch,
  withErrorHandler,
  createErrorHandler,
  safeAsync,
}
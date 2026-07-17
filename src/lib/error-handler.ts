/**
 * 错误处理工具
 * 提供统一的错误日志和错误处理函数
 */

// 开发环境是否开启详细日志
const ENABLE_ERROR_LOG = process.env.NODE_ENV === 'development'

/**
 * 安全地记录错误日志（不在生产环境暴露敏感信息）
 */
export function safeErrorLog(context: string, error: unknown, ...args: unknown[]): void {
  if (!ENABLE_ERROR_LOG) {
    // 生产环境只记录到监控服务
    console.error(`[ERROR] ${context}`)
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
  onError?: (error: unknown) => void
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
  context?: string
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
  silentCatch,
  withErrorHandler,
  createErrorHandler,
  safeAsync
}

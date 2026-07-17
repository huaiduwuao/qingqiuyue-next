'use client'

import { useCallback } from 'react'
import { useSnackbar } from 'notistack'
import { safeErrorLog } from '@/lib/error-handler'

/**
 * 通用错误处理 Hook
 * 提供一致的错误提示和日志记录
 */
export function useErrorHandler() {
  const { enqueueSnackbar } = useSnackbar()

  /**
   * 处理 API 错误
   * @param error 错误对象
   * @param context 错误上下文（用于日志）
   * @param userMessage 用户看到的错误消息（可选）
   */
  const handleError = useCallback((
    error: unknown,
    context?: string,
    userMessage?: string
  ) => {
    // 记录错误日志
    safeErrorLog(context || 'API Error', error)

    // 显示用户友好的错误提示
    const message = userMessage || extractErrorMessage(error)
    enqueueSnackbar(message, {
      variant: 'error',
      anchorOrigin: { vertical: 'top', horizontal: 'center' },
      autoHideDuration: 4000,
    })
  }, [enqueueSnackbar])

  /**
   * 处理业务错误（已知错误类型）
   */
  const handleBusinessError = useCallback((
    message: string,
    context?: string
  ) => {
    if (context) {
      safeErrorLog(context, new Error(message))
    }
    enqueueSnackbar(message, {
      variant: 'warning',
      anchorOrigin: { vertical: 'top', horizontal: 'center' },
      autoHideDuration: 3000,
    })
  }, [enqueueSnackbar])

  /**
   * 处理成功提示
   */
  const handleSuccess = useCallback((
    message: string
  ) => {
    enqueueSnackbar(message, {
      variant: 'success',
      anchorOrigin: { vertical: 'top', horizontal: 'center' },
      autoHideDuration: 2000,
    })
  }, [enqueueSnackbar])

  return {
    handleError,
    handleBusinessError,
    handleSuccess,
  }
}

/**
 * 从错误对象中提取友好的错误消息
 */
export function extractErrorMessage(error: unknown): string {
  if (!error) return '操作失败'

  // 处理标准 Error 对象
  if (error instanceof Error) {
    // 过滤敏感信息
    const message = error.message
    if (message.includes('401') || message.includes('Unauthorized')) {
      return '登录已过期，请重新登录'
    }
    if (message.includes('403') || message.includes('Forbidden')) {
      return '没有权限执行此操作'
    }
    if (message.includes('404') || message.includes('Not Found')) {
      return '请求的资源不存在'
    }
    if (message.includes('network') || message.includes('Network')) {
      return '网络连接失败，请检查网络'
    }
    if (message.includes('timeout') || message.includes('Timeout')) {
      return '请求超时，请重试'
    }
    // 截断过长的错误消息
    return message.length > 100 ? message.slice(0, 100) + '...' : message
  }

  // 处理字符串错误
  if (typeof error === 'string') {
    return error.length > 100 ? error.slice(0, 100) + '...' : error
  }

  // 处理对象错误
  if (typeof error === 'object') {
    const obj = error as Record<string, unknown>
    // 尝试从常见字段提取
    if (obj.message && typeof obj.message === 'string') {
      return extractErrorMessage(obj.message)
    }
    if (obj.msg && typeof obj.msg === 'string') {
      return extractErrorMessage(obj.msg)
    }
    if (obj.error && typeof obj.error === 'string') {
      return extractErrorMessage(obj.error)
    }
  }

  return '操作失败，请稍后重试'
}

/**
 * 包装 async 函数，自动处理错误
 */
export async function withErrorHandler<T>(
  fn: () => Promise<T>,
  errorHandler: (error: unknown) => void,
  context?: string
): Promise<T | undefined> {
  try {
    return await fn()
  } catch (error) {
    safeErrorLog(context || 'Async operation failed', error)
    errorHandler(error)
    return undefined
  }
}

export default useErrorHandler

'use client'

import { useCallback, useState, ReactNode } from 'react'
import { Snackbar as MuiSnackbar } from '@mui/material'
import Alert, { type AlertColor } from '@mui/material/Alert'
import { safeErrorLog } from '@/lib/error-handler'

export function useErrorHandler() {
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: AlertColor
  }>({
    open: false,
    message: '',
    severity: 'error',
  })

  const showSnackbar = useCallback((message: string, severity: AlertColor = 'error') => {
    setSnackbar({ open: true, message, severity })
  }, [])

  const handleClose = useCallback(() => {
    setSnackbar(prev => ({ ...prev, open: false }))
  }, [])

  const handleError = useCallback((
    error: unknown,
    context?: string,
    userMessage?: string
  ) => {
    safeErrorLog(context || 'API Error', error)
    const message = userMessage || extractErrorMessage(error)
    showSnackbar(message, 'error')
  }, [showSnackbar])

  const handleBusinessError = useCallback((
    message: string,
    context?: string
  ) => {
    if (context) {
      safeErrorLog(context, new Error(message))
    }
    showSnackbar(message, 'warning')
  }, [showSnackbar])

  const handleSuccess = useCallback((message: string) => {
    showSnackbar(message, 'success')
  }, [showSnackbar])

  // 返回 Snackbar 组件
  const renderSnackbar = (): ReactNode => (
    <MuiSnackbar
      open={snackbar.open}
      autoHideDuration={4000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        onClose={handleClose}
        severity={snackbar.severity}
        variant="filled"
        sx={{ width: '100%' }}
      >
        {snackbar.message}
      </Alert>
    </MuiSnackbar>
  )

  return {
    handleError,
    handleBusinessError,
    handleSuccess,
    showSnackbar,
    renderSnackbar,
  }
}

export function extractErrorMessage(error: unknown): string {
  if (!error) return '操作失败'

  if (error instanceof Error) {
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
    return message.length > 100 ? message.slice(0, 100) + '...' : message
  }

  if (typeof error === 'string') {
    return error.length > 100 ? error.slice(0, 100) + '...' : error
  }

  if (typeof error === 'object') {
    const obj = error as Record<string, unknown>
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

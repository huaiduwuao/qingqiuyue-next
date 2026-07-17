'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Box, Typography, Button, Paper } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })

    // 调用自定义错误处理回调
    this.props.onError?.(error, errorInfo)

    // 上报错误到监控系统（可扩展）
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state
    const { children, fallback } = this.props

    if (hasError) {
      // 使用自定义 fallback
      if (fallback) {
        return fallback
      }

      // 默认错误UI
      return (
        <Paper
          elevation={2}
          sx={{
            p: 4,
            mx: 'auto',
            my: 4,
            maxWidth: 600,
            textAlign: 'center',
            bgcolor: 'error.lighter',
            border: '1px solid',
            borderColor: 'error.light'
          }}
        >
          <ErrorOutlinedIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />

          <Typography variant="h5" component="h2" gutterBottom color="error.dark">
            出现了一些问题
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            抱歉，页面加载时遇到了错误。请尝试刷新页面。
          </Typography>

          {/* 开发环境显示详细信息 */}
          {process.env.NODE_ENV === 'development' && error && (
            <Box
              sx={{
                mt: 2,
                p: 2,
                bgcolor: 'grey.100',
                borderRadius: 1,
                textAlign: 'left',
                overflow: 'auto'
              }}
            >
              <Typography variant="caption" component="pre" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                {error.toString()}
                {'\n\n'}
                {errorInfo?.componentStack}
              </Typography>
            </Box>
          )}

          <Box sx={{ mt: 3 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<RefreshIcon />}
              onClick={this.handleReset}
            >
              重试
            </Button>
          </Box>
        </Paper>
      )
    }

    return children
  }
}

// 异步组件错误包装器
interface AsyncErrorWrapperProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

export function AsyncErrorWrapper({
  children,
  fallback,
  onError
}: AsyncErrorWrapperProps): ReactNode {
  return (
    <ErrorBoundary fallback={fallback} onError={onError}>
      {children}
    </ErrorBoundary>
  )
}

// 页面级别错误边界（用于 layout 或 page 组件）
export function PageErrorFallback({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}): ReactNode {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        p: 3
      }}
    >
      <ErrorOutlinedIcon sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />

      <Typography variant="h4" component="h1" gutterBottom>
        页面加载失败
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
        {error.digest ? (
          <>错误码: {error.digest}</>
        ) : (
          '加载页面时发生了未知错误'
        )}
      </Typography>

      <Button variant="contained" size="large" onClick={reset}>
        重新加载
      </Button>
    </Box>
  )
}

export default ErrorBoundary

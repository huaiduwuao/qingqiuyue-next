// Sentry 客户端初始化(§15.5)。
//
// Next 15 原生支持 app 目录下的 instrumentation-client.ts,在客户端 bundle 加载时执行。
// 不用 withSentryConfig 包装 next.config.ts —— 本项目是 output:'export' 静态导出,
// 走 webpack 插件会引入构建期依赖和 sourcemap 上传逻辑,而这里只需要运行时错误捕获。
//
// DSN 缺失时静默跳过,Sentry 完全不影响产品(空字符串会 disable SDK)。

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? ''

export const sentryEnabled = Boolean(dsn)

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? process.env.NODE_ENV ?? 'development',
    // 10% 性能追踪(避免打爆配额)
    tracesSampleRate: 0.1,
    // 过滤已知噪音
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
    ],
    beforeSend(event) {
      // 开发环境不上报(本地调试直接看 console)
      if (process.env.NODE_ENV !== 'production') {
        return null
      }
      return event
    },
  })
}

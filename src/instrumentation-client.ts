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

// 地址里可能带登录凭据(微信回调的 session_id / code、分享链接里的 token),不能原样上报
const SECRET_PARAM_RE = /([?&#](?:session_id|sessionId|token|access_token|code|state)=)[^&#\s]*/gi

function scrubUrl<T>(v: T): T {
  return (typeof v === 'string' ? v.replace(SECRET_PARAM_RE, '$1[Filtered]') : v) as T
}

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
      if (event.request) {
        event.request.url = scrubUrl(event.request.url)
        event.request.query_string = typeof event.request.query_string === 'string' ? scrubUrl(`?${event.request.query_string}`).slice(1) : undefined
        if (event.request.headers) {
          event.request.headers = Object.fromEntries(Object.entries(event.request.headers).map(([k, v]) => [k, scrubUrl(v)]))
        }
      }
      return event
    },
    beforeBreadcrumb(crumb) {
      // navigation 的 from/to、fetch/xhr 的 url 都可能带凭据
      if (crumb.data) {
        for (const k of ['url', 'from', 'to']) {
          if (k in crumb.data) crumb.data[k] = scrubUrl(crumb.data[k])
        }
      }
      if (crumb.message) crumb.message = scrubUrl(crumb.message)
      return crumb
    },
  })
}

/**
 * Agent 详情段的 server 外壳。
 *
 * 为什么需要这个 layout.tsx?
 *   output:'export' 下动态段 [id] 必须有 generateStaticParams 函数,
 *   但 generateStaticParams 不能和 'use client' 同文件。
 *   所以拆成 server 段 (本 layout) + client 段 (page.tsx) 两层。
 *
 * 占位策略:
 *   generateStaticParams 只输出一个占位 id='-1'。
 *   build 产物里有 out/system/agentmanager/agents/-1.html 一个壳文件。
 *   用户访问 /agents/123 时:
 *     1. 浏览器拿到 -1.html(Next.js 静态导出 + SPA fallback)
 *     2. Next.js client router 接管,识别 URL 中的 [id]=123
 *     3. 调用 page.tsx (client) 用 useParams() 拿到真实 id=123
 *     4. 渲染对应 agent 详情
 *   用户体验 = 纯 CSR SPA 路由。
 *
 * 为什么不用 dynamicParams: true?
 *   Next.js 限制:dynamicParams 必须配合 SSR,不能和 output: export 共用。
 */

import { ReactNode } from 'react'

export function generateStaticParams() {
  return [{ id: '-1' }]
}

export default function AgentDetailLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
/**
 * Agent 详情段的 server 外壳。
 *
 * 作用:
 *   output:'export' 下动态段 [id] 必须有 generateStaticParams,
 *   generateStaticParams 不能和 'use client' 同文件,所以用 layout.tsx
 *   充当 server 段占位,page.tsx 是纯 client 组件。
 *
 * 占位 id = '-1' 是不存在的值,真正 id 由 client 组件 useParams 解析。
 * 这样 export build 时只输出一个壳页面,运行时 client 拿到真实 URL 参数渲染。
 */

import { ReactNode } from 'react'

export function generateStaticParams() {
  return [{ id: '-1' }]
}

export default function AgentDetailLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
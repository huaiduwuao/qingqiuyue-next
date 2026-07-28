/**
 * Agent 详情页(server 外壳)
 * 访问路径: /system/agentmanager/agent/[id]
 *
 * output:'export' 静态导出:动态段 [id] 必须声明 generateStaticParams。
 * generateStaticParams 不能和 'use client' 同文件,因此拆成:
 * 本文件(server)导出占位 id,实际渲染交给 client 组件 AgentDetailClient。
 * 导出一个占位 id(-1),真实 id 由客户端 useParams 解析。
 */

import AgentDetailClient from './AgentDetailClient'

export function generateStaticParams() {
  return [{ id: '-1' }]
}

export default function AgentDetailPage() {
  return <AgentDetailClient />
}

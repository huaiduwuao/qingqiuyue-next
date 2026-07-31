'use client'

/**
 * Agent 详情页
 * 访问路径: /system/agentmanager/agent-detail?id=123
 *
 * 路由选择说明:
 *   用 query string (?id=) 而不是动态段 ([id]) 的原因:
 *   1. output:'export' 静态导出下,动态段 [id] 必须有 generateStaticParams 函数,
 *      否则 build 报错。即使 generateStaticParams 占位 + dynamicParams:true
 *      也不行(dynamicParams 与 output:export 不兼容)。
 *   2. 用 query string 后,路由是静态的 /agent-detail,build 输出 ○ (Static),
 *      不需要任何 generateStaticParams 占位。
 *   3. 运行时是纯 CSR:Next.js client router 不需要 SPA fallback,
 *      useSearchParams 直接读 ?id= 参数,AgentDetail 拿到 id 渲染。
 *
 * 优点:
 *   - 路由简单(纯静态),维护成本低
 *   - build 产物纯净(无需占位页)
 *   - 与 nginx 静态托管架构完全兼容
 *
 * 缺点:
 *   - URL 不是 RESTful 风格(/agents/123 vs /agent-detail?id=123)
 *   - 浏览器刷新无副作用(query string 保留)
 */

import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

const AgentDetail = dynamic(
  () => import('@/lib/agentmanager/canvas/AgentDetail').then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    ),
  },
)

export default function AgentDetailPage() {
  const searchParams = useSearchParams()
  const idParam = searchParams?.get('id') ?? ''
  const agentId = parseInt(idParam, 10)

  if (isNaN(agentId) || agentId < 0) {
    return <Box sx={{ p: 4 }}>无效的 Agent ID</Box>
  }

  return <AgentDetail agentId={agentId} />
}
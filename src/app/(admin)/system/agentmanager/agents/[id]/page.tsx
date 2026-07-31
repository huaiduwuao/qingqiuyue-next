'use client'

/**
 * Agent 详情页
 * 访问路径: /system/agentmanager/agent/[id]
 *
 * output:'export' 静态导出下,动态段 [id] 必须有 generateStaticParams,
 * 但 generateStaticParams 不能和 'use client' 同文件。
 *
 * 解决:把 generateStaticParams 放父级 [id]/layout.tsx(允许 server 段做静态壳),
 * page.tsx 本身是 client 组件,运行时通过 useParams 读真实 id。
 * 这样避免"server 外壳 + client wrapper"两层结构,真正的内容渲染全部在 client。
 */

import { useParams } from 'next/navigation'
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
  const params = useParams<{ id: string }>()
  const agentId = parseInt(params?.id ?? '', 10)

  if (isNaN(agentId) || agentId < 0) {
    return <Box sx={{ p: 4 }}>无效的 Agent ID</Box>
  }

  return <AgentDetail agentId={agentId} />
}
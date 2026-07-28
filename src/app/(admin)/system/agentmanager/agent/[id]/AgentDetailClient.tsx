'use client'

/**
 * Agent 详情页(client 部分)
 * 运行时通过 useParams 读取真实 id,渲染 AgentDetail(dynamic ssr:false)。
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

export default function AgentDetailClient() {
  const params = useParams<{ id: string }>()
  const agentId = parseInt(params?.id ?? '', 10)

  if (isNaN(agentId) || agentId < 0) {
    return <Box sx={{ p: 4 }}>无效的 Agent ID</Box>
  }

  return <AgentDetail agentId={agentId} />
}

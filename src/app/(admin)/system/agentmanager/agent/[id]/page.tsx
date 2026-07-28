'use client'

/**
 * Agent 详情页
 * 访问路径: /system/agentmanager/agent/[id]
 */

import { use } from 'react'
import dynamic from 'next/dynamic'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

const AgentDetail = dynamic(
  () => import('@/lib/agentmanager/canvas/AgentDetail').then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    ),
  },
)

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const agentId = parseInt(id, 10)

  if (isNaN(agentId)) {
    return <Box sx={{ p: 4 }}>无效的 Agent ID</Box>
  }

  return <AgentDetail agentId={agentId} />
}

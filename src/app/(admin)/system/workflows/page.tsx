'use client'

/**
 * 工作流
 * 访问路径: /system/workflows —— 复用 AgentManager 控制台的「workflows」页(embedded:不显示 tab 条)
 */

import dynamic from 'next/dynamic'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

const Console = dynamic(() => import('@/lib/agentmanager/Console').then(m => m.default), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <CircularProgress />
    </Box>
  ),
})

export default function Page() {
  return <Console tab="workflows" embedded />
}

'use client'

/**
 * 数字员工列表
 * 访问路径: /system/staff —— 复用 AgentManager 控制台的「agents」页(embedded:不显示 tab 条)
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
  return <Console tab="agents" embedded />
}

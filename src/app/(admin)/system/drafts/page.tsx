'use client'

/**
 * 草稿箱(builder 起草的员工 / 技能 / 工作流 / MCP)
 * 访问路径: /system/drafts —— 复用 AgentManager 控制台的「drafts」页(embedded:不显示 tab 条)
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
  return <Console tab="drafts" embedded />
}

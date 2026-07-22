'use client'

/**
 * SandboxMonitor — 沙盒容器池监控
 * 对应后端 sandbox/manager.go
 */

import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import RefreshIcon from '@mui/icons-material/Refresh'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import type { SandboxStats, SandboxContainer } from '../api-extended'

interface Props { token: string }

export default function SandboxMonitor({ token }: Props) {
  const [stats, setStats] = useState<SandboxStats | null>(null)
  const [containers, setContainers] = useState<SandboxContainer[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [statsRes, containersRes] = await Promise.all([
        fetch('/api/agentmanager/sandbox/stats', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch('/api/agentmanager/sandbox/containers', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      ])
      setStats(statsRes)
      setContainers(containersRes.list || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const releaseContainer = async (containerId: string) => {
    await fetch(`/api/agentmanager/sandbox/release/${containerId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    load()
  }

  const acquireSandbox = async () => {
    await fetch('/api/agentmanager/sandbox/acquire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ task_id: 0 }),
    })
    load()
  }

  const total = stats?.total || 1
  const availablePct = ((stats?.available || 0) / total * 100)
  const inUsePct = ((stats?.in_use || 0) / total * 100)

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">沙盒容器池</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<PlayArrowIcon />} size="small" variant="outlined" onClick={acquireSandbox}>
            预热容器
          </Button>
          <Button startIcon={<RefreshIcon />} size="small" onClick={load}>刷新</Button>
        </Box>
      </Box>

      {loading && <CircularProgress size={20} />}

      {/* 统计卡片 */}
      {stats && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                {stats.available}
              </Typography>
              <Typography variant="caption" color="text.secondary">空闲</Typography>
              <LinearProgress variant="determinate" value={availablePct} color="success" sx={{ mt: 1, height: 4, borderRadius: 2 }} />
            </CardContent>
          </Card>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main' }}>
                {stats.in_use}
              </Typography>
              <Typography variant="caption" color="text.secondary">使用中</Typography>
              <LinearProgress variant="determinate" value={inUsePct} color="warning" sx={{ mt: 1, height: 4, borderRadius: 2 }} />
            </CardContent>
          </Card>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {stats.total}
              </Typography>
              <Typography variant="caption" color="text.secondary">总计</Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'info.main' }}>
                {stats.running_tasks}
              </Typography>
              <Typography variant="caption" color="text.secondary">运行中任务</Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* 容器列表 */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" sx={{ mb: 1.5 }}>容器列表</Typography>
          {containers.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {containers.map(c => (
                <Box key={c.id} sx={{
                  display: 'flex', alignItems: 'center', gap: 2,
                  p: 1.5, bgcolor: 'background.default', borderRadius: 1,
                }}>
                  <Chip
                    size="small"
                    label={c.status === 'available' ? '空闲' : c.status === 'running' ? '运行中' : '停止中'}
                    color={c.status === 'available' ? 'success' : c.status === 'running' ? 'warning' : 'default'}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {c.name || c.id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      任务 #{c.task_id} • 创建于 {new Date(c.created_at).toLocaleString()}
                    </Typography>
                  </Box>
                  {c.status === 'running' && (
                    <Button size="small" startIcon={<StopIcon />} color="error" onClick={() => releaseContainer(c.id)}>
                      释放
                    </Button>
                  )}
                </Box>
              ))}
            </Box>
          ) : (
            <Alert severity="info">暂无运行中的沙盒容器。点击「预热容器」启动一个。</Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}

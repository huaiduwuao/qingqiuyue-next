'use client'

/**
 * 工作流任务管理
 * 左:执行记录(run)列表 — 状态/耗时/触发源
 * 右:选中 run 的节点级步骤日志(run_step)+ 最终 state
 * 顶部:定时调度(schedule)管理 — 启用/启停/删除/下次执行时间
 */

import { useCallback, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import Switch from '@mui/material/Switch'
import Collapse from '@mui/material/Collapse'

import { agentmAPI, type WorkflowRun, type WorkflowRunStep, type WorkflowSchedule } from './api'

const STATUS_COLOR: Record<string, 'success' | 'error' | 'warning' | 'default' | 'info'> = {
  completed: 'success',
  failed: 'error',
  running: 'info',
  claimed: 'warning',
  unknown: 'default',
}

const PHASE_COLOR: Record<string, string> = {
  start: '#1976d2',
  complete: '#2e7d32',
  error: '#c62828',
  skip: '#9e9e9e',
}

export default function WorkflowRunsManager() {
  const [runs, setRuns] = useState<WorkflowRun[]>([])
  const [schedules, setSchedules] = useState<WorkflowSchedule[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<WorkflowRun | null>(null)
  const [steps, setSteps] = useState<WorkflowRunStep[]>([])
  const [stepsLoading, setStepsLoading] = useState(false)
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, s] = await Promise.all([
        agentmAPI.listWorkflowRuns({ limit: 50 }).catch(() => ({ list: [] as WorkflowRun[], total: 0 })),
        agentmAPI.listAllSchedules().catch(() => ({ list: [] as WorkflowSchedule[], total: 0 })),
      ])
      setRuns(r.list || [])
      setSchedules(s.list || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 8000) // 8s 轮询,看 running 变化
    return () => clearInterval(t)
  }, [load])

  const openRun = async (run: WorkflowRun) => {
    setSelected(run)
    setStepsLoading(true)
    setExpandedStep(null)
    try {
      const res = await agentmAPI.getWorkflowRun(run.id)
      setSteps(res.steps || [])
    } catch {
      setSteps([])
    } finally {
      setStepsLoading(false)
    }
  }

  const toggleSchedule = async (sch: WorkflowSchedule) => {
    await agentmAPI.updateSchedule(sch.id, { enabled: !sch.enabled }).catch(() => {})
    load()
  }

  const deleteSchedule = async (sch: WorkflowSchedule) => {
    if (!confirm(`删除工作流 #${sch.workflow_id} 的这个定时调度?`)) return
    await agentmAPI.deleteSchedule(sch.id).catch(() => {})
    load()
  }

  const fmtTime = (t?: string) => (t ? new Date(t).toLocaleString() : '—')
  const fmtDur = (ms?: number) => (ms == null ? '—' : ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`)

  return (
    <Box>
      {/* 定时调度 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>⏰ 定时调度({schedules.length})</Typography>
        <Button size="small" onClick={load} disabled={loading}>刷新</Button>
      </Box>
      {schedules.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          暂无定时调度。在「🔀 工作流」总览里给某个工作流配置定时执行。
        </Typography>
      ) : (
        <TableContainer sx={{ mb: 3, border: '1px solid #eee', borderRadius: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>工作流</TableCell>
                <TableCell>规则</TableCell>
                <TableCell>下次执行</TableCell>
                <TableCell>上次状态</TableCell>
                <TableCell align="right">次数</TableCell>
                <TableCell>启用</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {schedules.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>#{s.workflow_id}</TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={s.kind === 'cron' ? `cron: ${s.cron_expr}` : s.kind === 'every' ? `每 ${s.every_sec}s` : `at ${fmtTime(s.at_time)}`} />
                    <Chip size="small" sx={{ ml: 0.5 }} label={s.overlap_policy === 'replace' ? '替换' : '跳过'} variant="outlined" />
                  </TableCell>
                  <TableCell>{fmtTime(s.next_run_at)}</TableCell>
                  <TableCell>{s.last_status ? <Chip size="small" color={STATUS_COLOR[s.last_status] ?? 'default'} label={s.last_status} /> : '—'}</TableCell>
                  <TableCell align="right">{s.run_count ?? 0}</TableCell>
                  <TableCell><Switch size="small" checked={s.enabled ?? false} onChange={() => toggleSchedule(s)} /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => deleteSchedule(s)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 执行记录 + 步骤详情 */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>📋 执行记录({runs.length})</Typography>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        {/* run 列表 */}
        <TableContainer sx={{ flex: 1, border: '1px solid #eee', borderRadius: 1, maxHeight: 480, overflowY: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>工作流</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>来源</TableCell>
                <TableCell align="right">耗时</TableCell>
                <TableCell>开始时间</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && runs.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center"><CircularProgress size={20} /></TableCell></TableRow>
              ) : runs.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.secondary' }}>暂无执行记录</TableCell></TableRow>
              ) : (
                runs.map((r) => (
                  <TableRow
                    key={r.id}
                    hover
                    onClick={() => openRun(r)}
                    sx={{ cursor: 'pointer', bgcolor: selected?.id === r.id ? 'action.selected' : 'inherit' }}
                  >
                    <TableCell>#{r.id}</TableCell>
                    <TableCell>#{r.workflow_id}</TableCell>
                    <TableCell><Chip size="small" color={STATUS_COLOR[r.status] ?? 'default'} label={r.status} /></TableCell>
                    <TableCell>{r.source === 'scheduled' ? '⏰ 定时' : '🖱 手动'}</TableCell>
                    <TableCell align="right">{fmtDur(r.duration_ms)}</TableCell>
                    <TableCell>{fmtTime(r.started_at ?? r.claimed_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* 步骤详情 */}
        <Box sx={{ width: 420, flexShrink: 0, border: '1px solid #eee', borderRadius: 1, maxHeight: 480, overflowY: 'auto', p: 1.5 }}>
          {!selected ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
              点左侧一条执行记录,查看节点级步骤日志
            </Typography>
          ) : stepsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress size={20} /></Box>
          ) : (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Run #{selected.id} 步骤({steps.length})
              </Typography>
              {selected.error && (
                <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>错误: {selected.error}</Typography>
              )}
              {steps.map((st, i) => (
                <Box key={st.id} sx={{ mb: 0.5, border: '1px solid #f0f0f0', borderRadius: 1, overflow: 'hidden' }}>
                  <Box
                    onClick={() => setExpandedStep(expandedStep === i ? null : i)}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, cursor: 'pointer', bgcolor: '#fafafa', '&:hover': { bgcolor: '#f0f0f0' } }}
                  >
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: PHASE_COLOR[st.phase] ?? '#999' }} />
                    <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }} noWrap>{st.node_id}</Typography>
                    <Chip size="small" variant="outlined" label={st.node_type} />
                    <Typography variant="caption" color="text.secondary">{st.phase} · {fmtDur(st.duration_ms)}</Typography>
                  </Box>
                  <Collapse in={expandedStep === i}>
                    <Box sx={{ p: 1, borderTop: '1px solid #f0f0f0' }}>
                      {st.error && <Typography variant="caption" color="error" sx={{ display: 'block' }}>错误: {st.error}</Typography>}
                      {st.output && Object.keys(st.output).length > 0 && (
                        <pre style={{ margin: 0, fontSize: 11, maxHeight: 160, overflow: 'auto', background: '#263238', color: '#aed581', padding: 8, borderRadius: 4 }}>
                          {JSON.stringify(st.output, null, 2)}
                        </pre>
                      )}
                    </Box>
                  </Collapse>
                </Box>
              ))}
              {steps.length === 0 && <Typography variant="body2" color="text.secondary">无步骤记录</Typography>}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}

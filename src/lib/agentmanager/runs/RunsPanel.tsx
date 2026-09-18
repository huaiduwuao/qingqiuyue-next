'use client'

/**
 * RunsPanel — 后台运行:发起任务、看实时过程、批准/驳回高风险操作、取消。
 * 对应后端 internal/agentmanager/runs;事件流断线自动续传,关掉页面运行也不会停。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import CircularProgress from '@mui/material/CircularProgress'
import { runsAPI, streamRunEvents, isTerminal, type Approval, type Run, type RunEvent, type RunStatus } from './api'
import { toTimeline } from './timeline'
import { API_PREFIX } from '@/lib/api/prefix'

const STATUS: Record<RunStatus, { label: string; color: 'default' | 'info' | 'warning' | 'success' | 'error' }> = {
  queued: { label: '排队中', color: 'default' },
  running: { label: '执行中', color: 'info' },
  awaiting_approval: { label: '等待确认', color: 'warning' },
  succeeded: { label: '已完成', color: 'success' },
  failed: { label: '失败', color: 'error' },
  cancelled: { label: '已取消', color: 'default' },
}

interface StaffItem {
  agentId: string
  name: string
  description?: string
}

function when(ts?: string) {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : ''
}

export default function RunsPanel({ token }: { token: string }) {
  const [runs, setRuns] = useState<Run[]>([])
  const [all, setAll] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [staff, setStaff] = useState<StaffItem[]>([])
  const [agent, setAgent] = useState('worker')
  const [input, setInput] = useState('')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadRuns = useCallback(async () => {
    try {
      setRuns(await runsAPI.list(token, { all }))
    } catch (e: any) {
      setError(e.message)
    }
  }, [token, all])

  useEffect(() => {
    loadRuns()
  }, [loadRuns])

  // 有没结束的运行时,每 5 秒刷新一次列表里的状态
  const hasLive = runs.some((r) => !isTerminal(r.status))
  useEffect(() => {
    if (!hasLive) return
    const t = setInterval(loadRuns, 5000)
    return () => clearInterval(t)
  }, [hasLive, loadRuns])

  useEffect(() => {
    fetch(API_PREFIX + '/api/agentmanager/multi-agent/staff')
      .then((r) => r.json())
      .then((d) => setStaff(d.agents || []))
      .catch(() => {})
  }, [])

  const start = async () => {
    setStarting(true)
    setError(null)
    try {
      const run = await runsAPI.start(token, { agent, input })
      setInput('')
      await loadRuns()
      setSelected(run.id)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setStarting(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>发起运行</Typography>
        <Typography variant="body2" color="text.secondary">
          数字员工在后台执行,关掉页面也会继续。发悬赏、触发工作流这类操作会先停下来等你确认。
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <TextField
            id="run-agent"
            select
            size="small"
            label="数字员工"
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="worker">通用助手(worker)</MenuItem>
            {staff
              .filter((s) => s.agentId !== 'worker')
              .map((s) => (
                <MenuItem key={s.agentId} value={s.agentId}>
                  {s.name}
                </MenuItem>
              ))}
          </TextField>
          <TextField
            id="run-input"
            size="small"
            label="要做什么"
            placeholder="例如:用 Python 算一下 2026 年每个月的工作日天数,列成表"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            multiline
            minRows={2}
            sx={{ flex: 1, minWidth: 260 }}
          />
          <Button variant="contained" onClick={start} disabled={starting || !input.trim()}>
            {starting ? <CircularProgress size={18} /> : '发起'}
          </Button>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
        <Paper sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0, maxHeight: 600, overflow: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, pt: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>最近的运行</Typography>
            <FormControlLabel
              control={<Switch id="runs-all" size="small" checked={all} onChange={(e) => setAll(e.target.checked)} />}
              label={<Typography variant="caption">全部用户</Typography>}
            />
          </Box>
          {runs.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              还没有运行。在上面发起一个。
            </Typography>
          ) : (
            <List dense>
              {runs.map((r) => (
                <ListItemButton key={r.id} selected={r.id === selected} onClick={() => setSelected(r.id)}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Chip size="small" label={STATUS[r.status]?.label ?? r.status} color={STATUS[r.status]?.color ?? 'default'} />
                        <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                          {r.input}
                        </Typography>
                      </Box>
                    }
                    secondary={`${r.agent} · ${when(r.created_at)}`}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </Paper>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {selected ? (
            <RunDetail key={selected} token={token} runId={selected} onChanged={loadRuns} />
          ) : (
            <Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
              <Typography variant="body2">选一个运行看它的执行过程</Typography>
            </Paper>
          )}
        </Box>
      </Box>
    </Box>
  )
}

function RunDetail({ token, runId, onChanged }: { token: string; runId: string; onChanged: () => void }) {
  const [run, setRun] = useState<Run | null>(null)
  const [events, setEvents] = useState<RunEvent[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const [r, a] = await Promise.all([runsAPI.get(token, runId), runsAPI.approvals(token, runId)])
    setRun(r)
    setApprovals(a)
  }, [token, runId])

  useEffect(() => {
    const ctrl = new AbortController()
    setEvents([])
    refresh().catch((e) => setErr(e.message))
    streamRunEvents(
      runId,
      token,
      (e) => {
        setEvents((prev) => [...prev, e])
        // 状态变化(审批、终态)时刷新详情和列表
        if (e.t.startsWith('approval.') || e.t.startsWith('run.')) {
          refresh().catch(() => {})
          onChanged()
        }
      },
      ctrl.signal,
    ).catch((e) => setErr(e.message))
    return () => ctrl.abort()
  }, [runId, token, refresh, onChanged])

  const timeline = useMemo(() => toTimeline(events), [events])
  const pending = approvals.filter((a) => a.status === 'pending')

  const decide = async (a: Approval, d: 'approve' | 'reject') => {
    setBusy(true)
    try {
      await runsAPI.decide(token, runId, a.id, d)
      await refresh()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    if (!confirm('取消这个运行?已经做完的步骤不会撤回。')) return
    setBusy(true)
    try {
      await runsAPI.cancel(token, runId)
      await refresh()
      onChanged()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!run) {
    return (
      <Paper sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
        {err ? <Alert severity="error">{err}</Alert> : <CircularProgress size={24} />}
      </Paper>
    )
  }

  return (
    <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip label={STATUS[run.status]?.label ?? run.status} color={STATUS[run.status]?.color ?? 'default'} />
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {run.agent} · {when(run.created_at)}
        </Typography>
        {!isTerminal(run.status) && (
          <Button size="small" color="error" variant="outlined" onClick={cancel} disabled={busy}>
            取消运行
          </Button>
        )}
      </Box>

      <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', fontWeight: 500 }}>
        {run.input}
      </Typography>

      {err && (
        <Alert severity="error" onClose={() => setErr(null)}>
          {err}
        </Alert>
      )}

      {pending.map((a) => (
        <Alert
          key={a.id}
          severity="warning"
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" color="inherit" onClick={() => decide(a, 'reject')} disabled={busy}>
                驳回
              </Button>
              <Button size="small" variant="contained" color="warning" onClick={() => decide(a, 'approve')} disabled={busy}>
                批准执行
              </Button>
            </Box>
          }
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>数字员工要执行「{a.tool}」,需要你确认</Typography>
          <Box component="pre" sx={{ m: 0, mt: 0.5, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {prettyJSON(a.args)}
          </Box>
        </Alert>
      ))}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 460, overflow: 'auto' }}>
        {timeline.map((it, i) => {
          if (it.kind === 'text') {
            return (
              <Typography key={i} variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {it.text}
              </Typography>
            )
          }
          if (it.kind === 'tool') {
            return (
              <Box key={i} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: it.isError ? 'error.main' : 'text.secondary' }}>
                  {it.done ? (it.isError ? '✗' : '✓') : '…'} {it.name}
                </Typography>
                {it.args && (
                  <Box component="pre" sx={{ m: 0, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'text.secondary' }}>
                    {prettyJSON(it.args)}
                  </Box>
                )}
                {it.result && (
                  <Box component="pre" sx={{ m: 0, mt: 0.5, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 200, overflow: 'auto' }}>
                    {it.result}
                  </Box>
                )}
              </Box>
            )
          }
          return (
            <Typography key={i} variant="caption" sx={{ color: `${it.tone}.main` }}>
              — {it.text}
            </Typography>
          )
        })}
        {!isTerminal(run.status) && timeline.length === 0 && <CircularProgress size={18} />}
      </Box>

      {run.status === 'succeeded' && run.output && (
        <Alert severity="success" sx={{ whiteSpace: 'pre-wrap' }}>
          {run.output}
        </Alert>
      )}
      {run.status === 'failed' && run.error && <Alert severity="error">{run.error}</Alert>}
    </Paper>
  )
}

function prettyJSON(s: string) {
  try {
    return JSON.stringify(JSON.parse(s), null, 2)
  } catch {
    return s
  }
}

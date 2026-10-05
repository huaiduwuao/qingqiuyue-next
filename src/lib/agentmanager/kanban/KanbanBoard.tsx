'use client'

/**
 * KanbanBoard — 看板视图
 * 对应后端 kanban/service.go
 */

import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import AddIcon from '@mui/icons-material/Add'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import type { KanbanTask, KanbanBoard } from '../api-extended'
import { agentmanagerClient, formatApiError } from '@/lib/api/client'

const COLUMNS: { id: KanbanTask['status']; label: string; color: string }[] = [
  { id: 'todo',      label: '◻ 待办',     color: '#6b7280' },
  { id: 'ready',     label: '▶ 就绪',     color: '#3b82f6' },
  { id: 'running',   label: '● 进行中',   color: '#f59e0b' },
  { id: 'blocked',   label: '⊘ 阻塞',    color: '#ef4444' },
  { id: 'done',      label: '✓ 完成',     color: '#22c55e' },
]

// 员工列表取不到时的兜底(运行服务未启用 / 未登录)
const FALLBACK_STAFF = [
  { id: 'worker', label: '通用' },
  { id: 'frontend', label: '前端' },
  { id: 'backend', label: '后端' },
  { id: 'ops', label: '运维' },
  { id: 'qa', label: '测试' },
]

interface Props {
  /** 不传则显示看板选择器(列出全部看板,可新建) */
  boardId?: number
  token: string
  workerId?: string
  onRunAgent?: (task: KanbanTask) => void
  onOpenRun?: (runId: string) => void
}

export default function KanbanBoard({ boardId: fixedBoardId, token, onRunAgent, onOpenRun }: Props) {
  const [boards, setBoards] = useState<{ id: number; name: string; slug: string }[]>([])
  const [pickedBoard, setPickedBoard] = useState<number | null>(null)
  const boardId = fixedBoardId ?? pickedBoard
  // 可指派的员工:和数字人页面同一来源,含 builder 发布的自定义员工和短剧员工
  const [staff, setStaff] = useState<{ id: string; label: string }[]>(FALLBACK_STAFF)
  useEffect(() => {
    // 员工列表是公开接口,但统一走 agentmanagerClient:带上网关前缀(客户端里是绝对地址)和会话头
    agentmanagerClient.get<{ agents?: { agentId: string; name: string }[] }>('/multi-agent/staff')
      .then(d => {
        const list = (d?.agents || []).map(a => ({ id: a.agentId, label: a.name || a.agentId }))
        if (list.length) setStaff(list)
      })
      .catch(() => {})
  }, [])

  // token 只用来在会话切换时触发重新加载;请求头由 agentmanagerClient 统一从会话里取
  const loadBoards = useCallback(async () => {
    if (fixedBoardId != null || !token) return
    try {
      const res = await agentmanagerClient.get<{ list?: { id: number; name: string; slug: string }[] }>('/kanban/boards')
      const list = res?.list || []
      setBoards(list)
      setPickedBoard(cur => (cur != null && list.some(b => b.id === cur)) ? cur : (list[0]?.id ?? null))
    } catch { /* ignore */ }
  }, [fixedBoardId, token])
  useEffect(() => { loadBoards() }, [loadBoards])

  const createBoard = async () => {
    const name = prompt('新看板名称')?.trim()
    if (!name) return
    let b: { ID?: number; id?: number } | null = null
    try {
      b = await agentmanagerClient.post('/kanban/boards', { name })
    } catch (e) {
      setRunError(`新建看板失败: ${formatApiError(e)}`)
      return
    }
    await loadBoards()
    const newId = b?.ID ?? b?.id
    if (newId) setPickedBoard(newId)
  }

  const [tasks, setTasks] = useState<KanbanTask[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [agentFor, setAgentFor] = useState<Record<number, string>>({})
  const [runError, setRunError] = useState<string | null>(null)
  // 前端筛选(看板一次拉全部任务):关键字 / 执行人 / 优先级
  const [keyword, setKeyword] = useState('')
  const [fAssignee, setFAssignee] = useState('')
  const [fPriority, setFPriority] = useState('')

  const load = useCallback(async () => {
    if (boardId == null || !token) { setTasks([]); return }
    setLoading(true)
    try {
      const res = await agentmanagerClient.get<{ list?: KanbanTask[] }>(`/kanban/boards/${boardId}/tasks`)
      setTasks(res?.list || [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [boardId, token])

  useEffect(() => { load() }, [load])

  const createTask = async () => {
    if (!newTitle.trim()) return
    try {
      await agentmanagerClient.post(`/kanban/boards/${boardId}/tasks`, { title: newTitle, body: newBody })
    } catch (e) {
      setRunError(`新建任务失败: ${formatApiError(e)}`)
      return
    }
    setNewTitle('')
    setNewBody('')
    setCreateOpen(false)
    load()
  }

  const moveTask = async (taskId: number, status: KanbanTask['status']) => {
    try {
      await agentmanagerClient.patch(`/kanban/tasks/${taskId}/move`, { status })
    } catch (e) {
      setRunError(`移动任务失败: ${formatApiError(e)}`)
    }
    load()
  }

  // 交给数字员工:卡片变成一次后台运行,结束后由后端回写 done / blocked
  const runTask = async (task: KanbanTask) => {
    setRunError(null)
    try {
      await agentmanagerClient.post(`/kanban/tasks/${task.id}/run`, { agent: agentFor[task.id] || 'worker' })
    } catch (e) {
      setRunError(formatApiError(e))
    }
    load()
  }

  // 拖拽: onDragStart → onDragOver → onDrop
  const handleDragStart = (e: React.DragEvent, task: KanbanTask) => {
    e.dataTransfer.setData('taskId', String(task.id))
    e.dataTransfer.setData('fromStatus', task.status)
  }

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault()
    setDragOver(status)
  }

  const handleDrop = async (e: React.DragEvent, toStatus: string) => {
    e.preventDefault()
    setDragOver(null)
    const taskId = Number(e.dataTransfer.getData('taskId'))
    const fromStatus = e.dataTransfer.getData('fromStatus')
    if (fromStatus === toStatus) return
    await moveTask(taskId, toStatus as KanbanTask['status'])
  }

  const kw = keyword.trim().toLowerCase()
  const visibleTasks = tasks.filter(t =>
    (!kw || `${t.title} ${t.body || ''}`.toLowerCase().includes(kw)) &&
    (!fAssignee || (fAssignee === '-' ? !t.assignee : t.assignee === fAssignee)) &&
    (!fPriority || String(t.priority || 0) === fPriority)
  )
  const assignees = Array.from(new Set(tasks.map(t => t.assignee).filter((a): a is string => !!a))).sort()
  const priorities = Array.from(new Set(tasks.map(t => t.priority || 0))).sort((a, b) => b - a)
  const staffLabel = (id: string) => staff.find(s => s.id === id)?.label || id

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6">看板</Typography>
          {fixedBoardId == null && (
            <>
              <select
                aria-label="选择看板"
                value={boardId ?? ''}
                onChange={e => setPickedBoard(Number(e.target.value))}
                style={{ fontSize: 13, padding: '2px 6px' }}
              >
                {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <Button size="small" variant="text" onClick={createBoard}>+ 新看板</Button>
            </>
          )}
        </Box>
        <Button startIcon={<AddIcon />} variant="contained" size="small" disabled={boardId == null} onClick={() => setCreateOpen(true)}>
          新建任务
        </Button>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 1.5 }}>
        <input aria-label="搜索任务" placeholder="搜索标题 / 描述" value={keyword} onChange={e => setKeyword(e.target.value)} style={{ fontSize: 13, padding: '4px 6px', width: 180 }} />
        <select aria-label="执行人" value={fAssignee} onChange={e => setFAssignee(e.target.value)} style={{ fontSize: 13, padding: '4px 6px' }}>
          <option value="">全部执行人</option>
          <option value="-">未指派</option>
          {assignees.map(a => <option key={a} value={a}>{staffLabel(a)}</option>)}
        </select>
        <select aria-label="优先级" value={fPriority} onChange={e => setFPriority(e.target.value)} style={{ fontSize: 13, padding: '4px 6px' }}>
          <option value="">全部优先级</option>
          {priorities.map(p => <option key={p} value={String(p)}>{p > 0 ? `P${p}` : '无优先级'}</option>)}
        </select>
        {(kw || fAssignee || fPriority) && (
          <Button size="small" variant="text" onClick={() => { setKeyword(''); setFAssignee(''); setFPriority('') }}>
            重置({visibleTasks.length}/{tasks.length})
          </Button>
        )}
      </Box>
      {runError && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setRunError(null)}>{runError}</Alert>}

      {loading && <CircularProgress size={20} />}

      {/* 看板列 */}
      <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2 }}>
        {COLUMNS.map(col => {
          const colTasks = visibleTasks.filter(t => t.status === col.id)
          return (
            <Paper
              key={col.id}
              sx={{
                minWidth: 240,
                maxWidth: 240,
                p: 1.5,
                borderTop: `3px solid ${col.color}`,
                bgcolor: dragOver === col.id ? 'action.hover' : 'background.paper',
                borderRadius: 1,
                transition: 'background 0.2s',
              }}
              onDragOver={e => handleDragOver(e, col.id)}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => handleDrop(e, col.id)}
            >
              {/* 列头 */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: col.color }}>
                  {col.label} ({colTasks.length})
                </Typography>
              </Box>

              {/* 任务卡片 */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {colTasks.map(task => (
                  <Card
                    key={task.id}
                    draggable
                    onDragStart={e => handleDragStart(e, task)}
                    sx={{ cursor: 'grab', '&:active': { cursor: 'grabbing', opacity: 0.7 } }}
                  >
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <DragIndicatorIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                        {task.title}
                      </Typography>
                      {task.body && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {task.body}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                        {(task.skills || []).slice(0, 2).map((s, i) => (
                          <Chip key={i} label={s} size="small" variant="outlined" sx={{ fontSize: 10 }} />
                        ))}
                        {task.priority > 0 && (
                          <Chip label={`P${task.priority}`} size="small" color="error" sx={{ fontSize: 10 }} />
                        )}
                      </Box>
                      {(task.status === 'todo' || task.status === 'ready' || task.status === 'blocked') && (
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                          <select
                            aria-label="数字员工"
                            value={agentFor[task.id] || 'worker'}
                            onChange={e => setAgentFor(m => ({ ...m, [task.id]: e.target.value }))}
                            style={{ fontSize: 11, padding: '2px 4px' }}
                          >
                            {staff.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                          </select>
                          <Button size="small" variant="text" sx={{ fontSize: 11, minWidth: 0 }} onClick={() => runTask(task)}>
                            ▶ 交给数字员工
                          </Button>
                          {onRunAgent && (
                            <Button size="small" variant="text" sx={{ fontSize: 11, minWidth: 0 }} onClick={() => onRunAgent(task)}>对话</Button>
                          )}
                        </Box>
                      )}
                      {task.status === 'running' && task.run_id && (
                        <Button size="small" variant="text" sx={{ mt: 1, fontSize: 11, minWidth: 0 }} onClick={() => onOpenRun?.(task.run_id!)} disabled={!onOpenRun}>
                          ● 运行中 · {task.run_id.slice(0, 8)}
                        </Button>
                      )}
                      {(task.status === 'done' || task.status === 'blocked') && task.result && (
                        <Typography variant="caption" color={task.status === 'done' ? 'text.secondary' : 'error'} sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', mt: 0.5 }}>
                          {task.result}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {colTasks.length === 0 && (
                  <Box sx={{ py: 3, textAlign: 'center', color: 'text.disabled' }}>
                    <Typography variant="caption">拖拽任务到这里</Typography>
                  </Box>
                )}
              </Box>
            </Paper>
          )
        })}
      </Box>

      {/* 创建任务对话框 */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>新建任务</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="标题" value={newTitle} onChange={e => setNewTitle(e.target.value)} sx={{ mt: 1, mb: 1 }} autoFocus />
          <TextField
            fullWidth label="描述" value={newBody} onChange={e => setNewBody(e.target.value)}
            multiline rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>取消</Button>
          <Button onClick={createTask} variant="contained" disabled={!newTitle.trim()}>创建</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

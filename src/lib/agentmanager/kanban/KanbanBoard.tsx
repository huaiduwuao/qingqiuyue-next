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
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import type { KanbanTask, KanbanBoard } from '../api-extended'

const COLUMNS: { id: KanbanTask['status']; label: string; color: string }[] = [
  { id: 'todo',      label: '◻ 待办',     color: '#6b7280' },
  { id: 'ready',     label: '▶ 就绪',     color: '#3b82f6' },
  { id: 'running',   label: '● 进行中',   color: '#f59e0b' },
  { id: 'blocked',   label: '⊘ 阻塞',    color: '#ef4444' },
  { id: 'done',      label: '✓ 完成',     color: '#22c55e' },
]

interface Props {
  boardId: number
  token: string
  workerId?: string
  onRunAgent?: (task: KanbanTask) => void
}

export default function KanbanBoard({ boardId, token, workerId, onRunAgent }: Props) {
  const [tasks, setTasks] = useState<KanbanTask[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [dragOver, setDragOver] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/agentmanager/kanban/boards/${boardId}/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json())
      setTasks(res.list || [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [boardId, token])

  useEffect(() => { load() }, [load])

  const createTask = async () => {
    if (!newTitle.trim()) return
    await fetch(`/api/agentmanager/kanban/boards/${boardId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: newTitle, body: newBody }),
    })
    setNewTitle('')
    setNewBody('')
    setCreateOpen(false)
    load()
  }

  const moveTask = async (taskId: number, status: KanbanTask['status']) => {
    await fetch(`/api/agentmanager/kanban/tasks/${taskId}/move`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    })
    load()
  }

  const deleteTask = async (taskId: number) => {
    if (!confirm('确认删除?')) return
    await fetch(`/api/agentmanager/kanban/tasks/${taskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
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

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">看板</Typography>
        <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => setCreateOpen(true)}>
          新建任务
        </Button>
      </Box>

      {loading && <CircularProgress size={20} />}

      {/* 看板列 */}
      <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2 }}>
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id)
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
                      {onRunAgent && task.status === 'ready' && (
                        <Button size="small" variant="text" sx={{ mt: 1, fontSize: 11 }} onClick={() => onRunAgent(task)}>
                          ▶ 执行
                        </Button>
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

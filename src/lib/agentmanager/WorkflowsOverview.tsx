'use client'

/**
 * 跨 Agent 的工作流总览
 *
 * 后端没有「列全部工作流」接口,只有按 Agent 维度的
 * GET /canvas/:agentId/workflows,因此这里先列出全部 Agent,
 * 再并发拉取各自的工作流聚合展示。
 */

import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { agentmAPI, type Agent } from './api'
import { canvasAPI } from './canvas/api'
import type { AgentWorkflowInfo, WorkflowType } from './canvas/types'

const TYPE_LABEL: Record<WorkflowType, string> = {
  sequential: '顺序',
  parallel: '并行',
  conditional: '条件',
  plan_execute: '规划执行',
}

const STATUS_COLOR: Record<string, 'success' | 'default' | 'warning' | 'error'> = {
  active: 'success',
  enabled: 'success',
  draft: 'default',
  disabled: 'warning',
  archived: 'default',
}

interface WorkflowRow extends AgentWorkflowInfo {
  agent_name: string
}
export type { WorkflowRow }

export default function WorkflowsOverview({ onCreate, onEdit }: { onCreate?: () => void; onEdit?: (row: WorkflowRow) => void }) {
  const [rows, setRows] = useState<WorkflowRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const agents = await agentmAPI.listAgents().catch(() => [] as Agent[])
      // 并发拉取每个 Agent 的工作流,单个失败不影响整体
      const grouped = await Promise.all(
        (agents || []).map(async (a: Agent) => {
          const agentId = a.id
          const agentName = a.name ?? `#${agentId}`
          try {
            const wfs = await canvasAPI.listWorkflows(agentId)
            return (wfs || []).map((w) => ({ ...w, agent_name: agentName }))
          } catch {
            return [] as WorkflowRow[]
          }
        }),
      )
      setRows(grouped.flat())
    } catch (e: any) {
      setError(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDelete = async (w: WorkflowRow) => {
    if (!confirm(`删除工作流「${w.name}」?`)) return
    await canvasAPI.deleteWorkflow(w.agent_id, w.id).catch((e) => alert(`删除失败: ${e.message}`))
    load()
  }

  useEffect(() => {
    load()
  }, [load])

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">全部工作流({rows.length})</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {onCreate && (
            <Button size="small" variant="contained" onClick={onCreate}>
              ➕ 新建工作流
            </Button>
          )}
          <Button size="small" onClick={load} disabled={loading}>
            刷新
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : rows.length === 0 ? (
        <Box sx={{ color: 'text.secondary', py: 4, textAlign: 'center' }}>
          暂无工作流。可在 Agent 详情页通过对话生成,或新建工作流。
        </Box>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>名称</TableCell>
                <TableCell>所属 Agent</TableCell>
                <TableCell>类型</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>版本</TableCell>
                <TableCell align="right">执行次数</TableCell>
                <TableCell>最近执行</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((w) => (
                <TableRow key={`${w.agent_id}-${w.id}`} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {w.name}
                    </Typography>
                    {w.description && (
                      <Typography variant="caption" color="text.secondary">
                        {w.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{w.agent_name}</TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={TYPE_LABEL[w.workflow_type] ?? w.workflow_type} />
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={STATUS_COLOR[w.status] ?? 'default'} label={w.status} />
                  </TableCell>
                  <TableCell>v{w.version}</TableCell>
                  <TableCell align="right">{w.exec_count}</TableCell>
                  <TableCell>{w.last_exec_at ? new Date(w.last_exec_at).toLocaleString() : '—'}</TableCell>
                  <TableCell align="right">
                    {onEdit && (
                      <IconButton size="small" onClick={() => onEdit(w)} title="编辑">
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton size="small" color="error" onClick={() => handleDelete(w)} title="删除">
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}

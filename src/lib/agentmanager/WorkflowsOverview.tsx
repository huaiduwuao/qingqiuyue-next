'use client'

/**
 * 跨 Agent 的工作流总览
 *
 * 后端没有「列全部工作流」接口,只有按 Agent 维度的
 * GET /canvas/:agentId/workflows。前端在并发拉取各 Agent 工作流后内存聚合,
 * 然后走项目统一的 DataGridTable(MUI X DataGrid),与 /system/bot、/system/shop
 * 等后台表格共用交互/分页/筛选体验,不再单独维护一份 Table+Pagination。
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import AddIcon from '@mui/icons-material/Add'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import ScheduleIcon from '@mui/icons-material/Schedule'
import type { GridColDef } from '@mui/x-data-grid'
import { DataGridTable } from '@/components/tables/DataGridTable'
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
  // 全部 Agent × 各自工作流聚合到一份内存里,DataGridTable 在 server 模式下按
  // (pageNumber-1)*pageSize 切片。load() 与 fetchData 解耦:load 只负责拉数据并
  // 推 allRows,完成后 setTick 触发 DataGridTable 重新拉取,fetchData 只做切片。
  const [allRows, setAllRows] = useState<WorkflowRow[]>([])
  const [error, setError] = useState('')
  const [scheduleFor, setScheduleFor] = useState<WorkflowRow | null>(null)
  const [cronExpr, setCronExpr] = useState('0 * * * *')
  const [overlap, setOverlap] = useState<'skip' | 'replace'>('skip')
  // tick 递增即触发 DataGridTable 重拉;同时给 totalRow 喂个依赖,避免空数组时
  // 只靠 tick 在数据未变化场景下被 React 合并掉
  const [tick, setTick] = useState(0)
  // ref 让 fetchData 永远读到最新 allRows,避免闭包 staleness
  const rowsRef = useRef<WorkflowRow[]>([])
  useEffect(() => { rowsRef.current = allRows }, [allRows])

  const load = useCallback(async () => {
    setError('')
    try {
      const agents = await agentmAPI.listAgents().catch(() => [] as Agent[])
      const grouped = await Promise.all(
        (agents || []).map(async (a: Agent) => {
          const agentId = a.id
          const agentName = a.name ?? `#${agentId}`
          try {
            const res = await canvasAPI.listWorkflows(agentId, { limit: 100 })
            return (res.list || []).map((w) => ({ ...w, agent_name: agentName }))
          } catch {
            return [] as WorkflowRow[]
          }
        }),
      )
      setAllRows(grouped.flat())
    } catch (e: any) {
      setError(e.message || '加载失败')
    }
  }, [])

  // refresh = 重拉数据 + tick++ 触发 DataGridTable 重 fetch
  const refresh = useCallback(() => {
    load().then(() => setTick((t) => t + 1))
  }, [load])

  useEffect(() => {
    load().then(() => setTick((t) => t + 1))
  }, [load])

  const handleDelete = async (w: WorkflowRow) => {
    if (!confirm(`删除工作流「${w.name}」?`)) return
    try {
      await canvasAPI.deleteWorkflow(w.agent_id, w.id)
    } catch (e: any) {
      alert(`删除失败: ${e.message}`)
      return
    }
    refresh()
  }

  // 立即执行
  const handleExecute = async (w: WorkflowRow) => {
    try {
      const res: any = await agentmAPI.executeWorkflow(w.id, {})
      if (res.error) {
        alert(`执行失败: ${res.error}`)
      } else {
        alert(`执行完成: ${res.run?.status ?? ''}${res.run?.error ? '\n' + res.run.error : ''}`)
      }
    } catch (e: any) {
      alert(`执行失败: ${e.message}`)
    }
  }

  // 保存定时配置
  const handleSaveSchedule = async () => {
    if (!scheduleFor) return
    try {
      await agentmAPI.createSchedule(scheduleFor.id, {
        kind: 'cron',
        cron_expr: cronExpr,
        overlap_policy: overlap,
        enabled: true,
      })
      setScheduleFor(null)
      alert('定时调度已创建,可在「📋 任务」tab 查看')
    } catch (e: any) {
      alert(`创建失败: ${e.message}`)
    }
  }

  const columns = useMemo<GridColDef<WorkflowRow>[]>(() => [
    {
      field: 'name',
      headerName: '名称',
      flex: 1.5,
      minWidth: 180,
      renderCell: (p) => (
        <Box sx={{ textAlign: 'left' }}>
          <Box sx={{ fontWeight: 600 }}>{p.row.name}</Box>
          {p.row.description && (
            <Box sx={{ fontSize: 12, color: 'text.secondary' }}>{p.row.description}</Box>
          )}
        </Box>
      ),
    },
    { field: 'agent_name', headerName: '所属 Agent', flex: 1, minWidth: 120 },
    {
      field: 'workflow_type',
      headerName: '类型',
      width: 100,
      renderCell: (p) => (
        <Chip size="small" variant="outlined" label={TYPE_LABEL[p.value as WorkflowType] ?? (p.value as string)} />
      ),
    },
    {
      field: 'status',
      headerName: '状态',
      width: 90,
      renderCell: (p) => (
        <Chip size="small" color={STATUS_COLOR[p.value as string] ?? 'default'} label={p.value as string} />
      ),
    },
    {
      field: 'version',
      headerName: '版本',
      width: 80,
      valueFormatter: (v) => `v${v as number}`,
    },
    { field: 'exec_count', headerName: '执行次数', type: 'number', width: 100, align: 'right', headerAlign: 'right' },
    {
      field: 'last_exec_at',
      headerName: '最近执行',
      flex: 1,
      minWidth: 160,
      valueFormatter: (v) => (v ? new Date(v as string).toLocaleString() : '—'),
    },
  ], [])

  return (
    <Box>
      {error && (
        <Box sx={{ mb: 2, p: 2, border: 1, borderColor: 'error.main', borderRadius: 1, color: 'error.main' }}>
          {error}
        </Box>
      )}

      <DataGridTable
        title={`全部工作流(${allRows.length})`}
        columns={columns}
        // 纯内存切片;读 ref 避免 fetchData 闭包捕获 stale allRows。
        // 真实数据加载由 useEffect 内的 load() 完成,完成后再 setTick 触发这里。
        fetchData={async ({ pageNumber, pageSize }) => {
          const rows = rowsRef.current
          const start = (pageNumber - 1) * pageSize
          return { records: rows.slice(start, start + pageSize), totalRow: rows.length }
        }}
        extraParams={{ tick, count: allRows.length }}
        onEdit={onEdit ? (row) => onEdit(row) : undefined}
        onDelete={handleDelete}
        toolBarRender={
          onCreate
            ? () => (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>
                    新建工作流
                  </Button>
                </Box>
              )
            : undefined
        }
        customActions={[
          {
            label: '执行',
            icon: <PlayArrowIcon fontSize="small" />,
            color: 'primary',
            onClick: (row: WorkflowRow) => handleExecute(row),
          },
          {
            label: '定时',
            icon: <ScheduleIcon fontSize="small" />,
            onClick: (row: WorkflowRow) => {
              setScheduleFor(row)
              setCronExpr('0 * * * *')
              setOverlap('skip')
            },
          },
        ]}
      />

      {/* 定时调度配置弹窗 */}
      <Dialog open={!!scheduleFor} onClose={() => setScheduleFor(null)} maxWidth="xs" fullWidth>
        <DialogTitle>⏰ 定时调度「{scheduleFor?.name}」</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            size="small"
            label="cron 表达式"
            value={cronExpr}
            onChange={(e) => setCronExpr(e.target.value)}
            helperText="5 字段(分 时 日 月 周),如 0 * * * * = 每小时;支持 6 字段带秒"
          />
          <TextField select size="small" label="上次未跑完时(重叠策略)" value={overlap} onChange={(e) => setOverlap(e.target.value as any)}>
            <MenuItem value="skip">跳过本次(skip)</MenuItem>
            <MenuItem value="replace">取消上次,执行本次(replace)</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleFor(null)}>取消</Button>
          <Button variant="contained" onClick={handleSaveSchedule}>创建调度</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

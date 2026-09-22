'use client'

/**
 * SessionManager - 会话管理组件
 *
 * 与 /system/agent-audit 同款:基于 DataGridTable 的服务端分页、列排序、
 * pageSize 选择器、FilterBar 过滤栏;统一调用模式,不再手写 Table + Pagination。
 *
 * 后端 agentmanager-api 的 /sessions 端点已对齐标准分页协议
 * (request.PageRequest + response.SuccessPageEx),前端直接传 page/pageSize。
 */

import { useCallback, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Paper from '@mui/material/Paper'
import VisibilityIcon from '@mui/icons-material/Visibility'
import ArchiveIcon from '@mui/icons-material/Archive'
import UnarchiveIcon from '@mui/icons-material/Unarchive'
import DeleteIcon from '@mui/icons-material/Delete'
import type { GridColDef } from '@mui/x-data-grid'
import { DataGridTable } from '@/components/tables/DataGridTable'
import type { FilterBarProps } from '@/components/tables/FilterBar'
import {
  listSessions,
  getSessionStats,
  listActiveUsers,
  getSessionMessages,
  deleteSession,
  archiveSession,
  unarchiveSession,
  type SessionRow,
  type SessionStats,
  type ActiveUserRow,
  type SessionMessageRow,
} from '@/apis/agentmanager-session'

/** 会话状态展示映射。未收录的状态原样显示(见下方渲染逻辑)。 */
const SESSION_STATUS: Record<string, { label: string; color: 'success' | 'default' | 'info' }> = {
  active: { label: '活跃', color: 'success' },
  completed: { label: '已完成', color: 'info' },
  archived: { label: '已归档', color: 'default' },
}

/** 列定义提到模块外,避免每次 render 重建导致 DataGrid 重新计算列。 */
const columns: GridColDef<SessionRow>[] = [
  { field: 'id', headerName: 'ID', width: 80 },
  {
    field: 'user_id',
    headerName: '用户',
    width: 100,
    renderCell: (p) => <Chip label={`用户 ${p.value as number}`} size="small" variant="outlined" />,
  },
  {
    field: 'title',
    headerName: '标题',
    flex: 1,
    minWidth: 200,
    // 后端排序白名单没有 title(排序价值低),关掉点击排序免得点了没反应
    sortable: false,
    renderCell: (p) => (
      <Typography variant="body2" sx={{ maxWidth: 360 }} noWrap title={p.value as string}>
        {(p.value as string) || '无标题'}
      </Typography>
    ),
  },
  { field: 'model', headerName: '模型', width: 160 },
  {
    field: 'message_count',
    headerName: '消息数',
    type: 'number',
    width: 100,
    align: 'right',
    headerAlign: 'right',
  },
  {
    field: 'total_tokens',
    headerName: 'Token',
    type: 'number',
    width: 120,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: (v) => ((v as number) || 0).toLocaleString(),
  },
  {
    field: 'status',
    headerName: '状态',
    width: 100,
    renderCell: (p) => {
      const s = p.value as string
      // 会话模型注释写的是 active/archived,但线上实际还有 completed。
      // 别把非 active 的一律说成「已归档」—— 认不出来的就原样显示。
      const meta = SESSION_STATUS[s] ?? { label: s || '-', color: 'default' as const }
      return <Chip size="small" label={meta.label} color={meta.color} />
    },
  },
  {
    field: 'update_time',
    headerName: '更新时间',
    width: 180,
    valueFormatter: (v) => (v ? new Date(v as string).toLocaleString() : '-'),
  },
]

export default function SessionManager() {
  // 过滤值由 DataGridTable 的 FilterBar 驱动
  const [filters, setFilters] = useState<FilterBarProps['values']>({})

  // 统计 + 活跃用户只在挂载时拉一次,不随翻页/过滤重拉
  const [stats, setStats] = useState<SessionStats | null>(null)
  const [activeUsers, setActiveUsers] = useState<ActiveUserRow[]>([])

  // 详情弹窗 state(行级「查看」按钮触发)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null)
  const [messages, setMessages] = useState<SessionMessageRow[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  // 给 DataGridTable 用的 refetch 触发器:删除/归档后刷新列表。
  // DataGridTable 内部用 extraParamsKey 检测变化重拉;传一个递增 tick 即可。
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    getSessionStats().then(setStats).catch(() => setStats(null))
    listActiveUsers(20).then((d) => setActiveUsers(d.list || [])).catch(() => setActiveUsers([]))
  }, [])

  const handleView = useCallback(async (row: SessionRow) => {
    setSelectedSession(row)
    setDetailOpen(true)
    setLoadingMessages(true)
    try {
      const d = await getSessionMessages(row.id)
      setMessages(d.messages || [])
    } catch (e) {
      console.error('Failed to fetch messages:', e)
      setMessages([])
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  const handleDelete = useCallback(async (row: SessionRow) => {
    if (!confirm(`确定删除会话「${row.title || row.id}」?此操作不可恢复。`)) return
    try {
      await deleteSession(row.id)
    } catch (e: any) {
      alert(`删除失败: ${e?.message || e}`)
      return
    }
    setReloadTick((t) => t + 1)
    getSessionStats().then(setStats).catch(() => {})
  }, [])

  const handleArchive = useCallback(async (row: SessionRow) => {
    try {
      await archiveSession(row.id)
    } catch (e: any) {
      alert(`归档失败: ${e?.message || e}`)
      return
    }
    setReloadTick((t) => t + 1)
    getSessionStats().then(setStats).catch(() => {})
  }, [])

  const handleUnarchive = useCallback(async (row: SessionRow) => {
    try {
      await unarchiveSession(row.id)
    } catch (e: any) {
      alert(`取消归档失败: ${e?.message || e}`)
      return
    }
    setReloadTick((t) => t + 1)
    getSessionStats().then(setStats).catch(() => {})
  }, [])

  // 用户点了活跃用户 chip → 把 user_id 塞进过滤值,
  // DataGridTable 的 extraParamsKey 检测到变化自动 refetch 并回到第 1 页。
  const applyUserFilter = (userId: number) => {
    setFilters((prev) => ({ ...prev, user_id: String(userId) }))
  }

  return (
    <Box>
      {/* 统计卡片 */}
      {stats && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 2, mb: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="h4" color="primary">{stats.total_sessions}</Typography>
              <Typography variant="body2" color="text.secondary">总会话</Typography>
            </CardContent>
          </Card>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="h4" color="success.main">{stats.active_sessions}</Typography>
              <Typography variant="body2" color="text.secondary">活跃</Typography>
            </CardContent>
          </Card>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="h4" color="text.secondary">{stats.archived_sessions}</Typography>
              <Typography variant="body2" color="text.secondary">已归档</Typography>
            </CardContent>
          </Card>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="h4">{stats.total_messages.toLocaleString()}</Typography>
              <Typography variant="body2" color="text.secondary">消息数</Typography>
            </CardContent>
          </Card>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="h4">{(stats.total_tokens / 1000).toFixed(0)}k</Typography>
              <Typography variant="body2" color="text.secondary">Token</Typography>
            </CardContent>
          </Card>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="h4">{stats.unique_users}</Typography>
              <Typography variant="body2" color="text.secondary">用户数</Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* 会话列表(自带 FilterBar + DataGrid) */}
      <DataGridTable
        title="会话列表"
        columns={columns}
        fetchData={async (params) => {
          const res = await listSessions({
            page: params.pageNumber,
            pageSize: params.pageSize,
            user_id: params.user_id,
            status: params.status,
            keyword: params.keyword,
            sort: params.sortField,
            order: params.sortOrder,
          })
          return { records: res.list || [], totalRow: res.total || 0 }
        }}
        filters={{
          fields: [
            { key: 'keyword', label: '标题', type: 'text', placeholder: '搜索会话标题...', width: 220 },
            { key: 'user_id', label: '用户ID', type: 'text', placeholder: '按用户ID过滤', width: 140 },
            {
              key: 'status',
              label: '状态',
              type: 'select',
              options: [
                { label: '活跃', value: 'active' },
                { label: '已完成', value: 'completed' },
                { label: '已归档', value: 'archived' },
              ],
            },
          ],
          values: filters,
          onChange: setFilters,
          onReset: () => setFilters({}),
        }}
        extraParams={{ tick: reloadTick }}
        // 活跃用户 chip 区放在 FilterBar 之下、表格之上。
        // 点击 chip 改写 filters.user_id,DataGridTable 自动 refetch 并回到第 1 页。
        toolBarRender={() =>
          activeUsers.length > 0 ? (
            <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>👥 活跃用户(点击快速过滤)</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {activeUsers.slice(0, 12).map((u) => (
                  <Chip
                    key={u.user_id}
                    label={`用户 ${u.user_id}: ${u.session_count} 会话`}
                    onClick={() => applyUserFilter(u.user_id)}
                    variant="outlined"
                    size="small"
                    color={filters.user_id === String(u.user_id) ? 'primary' : 'default'}
                  />
                ))}
              </Box>
            </Paper>
          ) : null
        }
        customActions={[
          {
            label: '查看',
            icon: <VisibilityIcon fontSize="small" />,
            onClick: handleView,
          },
          {
            // 归档后 status=archived,行还在(不写 deleted),所以这里能给出反向的「取消归档」
            label: '归档',
            icon: <ArchiveIcon fontSize="small" />,
            onClick: handleArchive,
            hidden: (row) => row.status === 'archived',
          },
          {
            label: '取消归档',
            icon: <UnarchiveIcon fontSize="small" />,
            onClick: handleUnarchive,
            hidden: (row) => row.status !== 'archived',
          },
          {
            label: '删除',
            icon: <DeleteIcon fontSize="small" />,
            color: 'error',
            onClick: handleDelete,
          },
        ]}
      />

      {/* 会话详情弹窗 */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          会话详情 {selectedSession && `· ${selectedSession.title || '无标题'}`}
        </DialogTitle>
        <DialogContent dividers>
          {selectedSession && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                用户: {selectedSession.user_id} · 模型: {selectedSession.model || '-'} ·
                消息数: {selectedSession.message_count} · Token: {selectedSession.total_tokens.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                创建时间: {new Date(selectedSession.create_time).toLocaleString()}
              </Typography>
            </Box>
          )}

          {loadingMessages ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : messages.length === 0 ? (
            <Alert severity="info">暂无消息记录</Alert>
          ) : (
            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
              {messages.map((msg) => (
                <Paper
                  key={msg.id}
                  variant="outlined"
                  sx={{
                    p: 2,
                    mb: 1,
                    bgcolor: msg.role === 'user'
                      ? 'action.hover'
                      : msg.role === 'assistant'
                        ? 'background.default'
                        : 'warning.50' as any,
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Chip
                      label={msg.role === 'user' ? '用户' : msg.role === 'assistant' ? '助手' : msg.role}
                      size="small"
                      color={msg.role === 'user' ? 'primary' : msg.role === 'assistant' ? 'default' : 'warning'}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {msg.latency_ms}ms · {msg.input_tokens}+{msg.output_tokens} tokens
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {msg.content.length > 500 ? msg.content.slice(0, 500) + '...' : msg.content}
                  </Typography>
                  {msg.status === 'error' && (
                    <Alert severity="error" sx={{ mt: 1 }}>{msg.content}</Alert>
                  )}
                </Paper>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
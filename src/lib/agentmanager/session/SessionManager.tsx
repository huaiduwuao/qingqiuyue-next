'use client'

/**
 * SessionManager - 会话管理组件
 * 查看所有用户的会话记录
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import VisibilityIcon from '@mui/icons-material/Visibility'
import DeleteIcon from '@mui/icons-material/Delete'
import ArchiveIcon from '@mui/icons-material/Archive'

interface Session {
  id: number
  user_id: number
  title: string
  agent_id: number
  instance_id: number
  model: string
  status: string
  message_count: number
  total_tokens: number
  create_time: string
  update_time: string
}

interface SessionMessage {
  id: number
  session_id: number
  role: string
  content: string
  model: string
  input_tokens: number
  output_tokens: number
  latency_ms: number
  status: string
  create_time: string
}

interface SessionStats {
  total_sessions: number
  active_sessions: number
  archived_sessions: number
  total_messages: number
  total_tokens: number
  unique_users: number
}

interface UserSessionInfo {
  user_id: number
  session_count: number
  message_count: number
  total_tokens: number
  last_session_at: string
}

interface SessionManagerProps {
  token: string
  baseURL?: string
}

export default function SessionManager({ token, baseURL = '/api/agentmanager' }: SessionManagerProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [stats, setStats] = useState<SessionStats | null>(null)
  const [activeUsers, setActiveUsers] = useState<UserSessionInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)

  // 过滤
  const [userIdFilter, setUserIdFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [keyword, setKeyword] = useState('')

  // 详情弹窗
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [messages, setMessages] = useState<SessionMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (userIdFilter) params.set('user_id', userIdFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (keyword) params.set('keyword', keyword)

      const res = await fetch(`${baseURL}/sessions?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setSessions(data.list || [])
      setTotal(data.total || 0)
    } catch (e) {
      console.error('Failed to fetch sessions:', e)
    } finally {
      setLoading(false)
    }
  }, [token, baseURL, page, limit, userIdFilter, statusFilter, keyword])

  const fetchStats = async () => {
    try {
      const res = await fetch(`${baseURL}/sessions/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setStats(data)
    } catch (e) {
      console.error('Failed to fetch stats:', e)
    }
  }

  const fetchActiveUsers = async () => {
    try {
      const res = await fetch(`${baseURL}/sessions/users`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setActiveUsers(data.list || [])
    } catch (e) {
      console.error('Failed to fetch active users:', e)
    }
  }

  useEffect(() => {
    fetchSessions()
    fetchStats()
    fetchActiveUsers()
  }, [fetchSessions])

  const viewSession = async (session: Session) => {
    setSelectedSession(session)
    setDetailOpen(true)
    setLoadingMessages(true)
    try {
      const res = await fetch(`${baseURL}/sessions/${session.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setMessages(data.messages || [])
    } catch (e) {
      console.error('Failed to fetch messages:', e)
    } finally {
      setLoadingMessages(false)
    }
  }

  const deleteSession = async (id: number) => {
    if (!confirm('确定删除该会话？')) return
    try {
      await fetch(`${baseURL}/sessions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      fetchSessions()
      fetchStats()
    } catch (e) {
      console.error('Failed to delete session:', e)
    }
  }

  const archiveSession = async (id: number) => {
    try {
      await fetch(`${baseURL}/sessions/${id}/archive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      fetchSessions()
      fetchStats()
    } catch (e) {
      console.error('Failed to archive session:', e)
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <Box>
      {/* 统计卡片 */}
      {stats && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 2, mb: 3 }}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="primary">{stats.total_sessions}</Typography>
            <Typography variant="body2" color="text.secondary">总会话</Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="success.main">{stats.active_sessions}</Typography>
            <Typography variant="body2" color="text.secondary">活跃</Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="grey.500">{stats.archived_sessions}</Typography>
            <Typography variant="body2" color="text.secondary">已归档</Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4">{stats.total_messages.toLocaleString()}</Typography>
            <Typography variant="body2" color="text.secondary">消息数</Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4">{(stats.total_tokens / 1000).toFixed(0)}k</Typography>
            <Typography variant="body2" color="text.secondary">Token</Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4">{stats.unique_users}</Typography>
            <Typography variant="body2" color="text.secondary">用户数</Typography>
          </Paper>
        </Box>
      )}

      {/* 过滤条件 */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          size="small"
          placeholder="搜索标题..."
          value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
            },
          }}
          sx={{ minWidth: 200 }}
        />
        <TextField
          size="small"
          placeholder="用户ID"
          value={userIdFilter}
          onChange={(e) => { setUserIdFilter(e.target.value); setPage(1); }}
          sx={{ width: 120 }}
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>状态</InputLabel>
          <Select
            value={statusFilter}
            label="状态"
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <MenuItem value="">全部</MenuItem>
            <MenuItem value="active">活跃</MenuItem>
            <MenuItem value="archived">已归档</MenuItem>
          </Select>
        </FormControl>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" onClick={fetchSessions} size="small">刷新</Button>
      </Box>

      {/* 活跃用户列表 */}
      {activeUsers.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>👥 活跃用户</Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {activeUsers.slice(0, 10).map((user) => (
              <Chip
                key={user.user_id}
                label={`用户 ${user.user_id}: ${user.session_count} 会话`}
                onClick={() => { setUserIdFilter(String(user.user_id)); setPage(1); }}
                variant="outlined"
                size="small"
              />
            ))}
          </Box>
        </Paper>
      )}

      {/* 会话列表 */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>用户</TableCell>
              <TableCell>标题</TableCell>
              <TableCell>模型</TableCell>
              <TableCell>消息数</TableCell>
              <TableCell>Token</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>更新时间</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography color="text.secondary">暂无会话数据</Typography>
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((session) => (
                <TableRow key={session.id} hover>
                  <TableCell>{session.id}</TableCell>
                  <TableCell>
                    <Chip label={`用户 ${session.user_id}`} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 200 }} noWrap>
                      {session.title || '无标题'}
                    </Typography>
                  </TableCell>
                  <TableCell>{session.model || '-'}</TableCell>
                  <TableCell>{session.message_count}</TableCell>
                  <TableCell>{session.total_tokens.toLocaleString()}</TableCell>
                  <TableCell>
                    <Chip
                      label={session.status === 'active' ? '活跃' : '已归档'}
                      size="small"
                      color={session.status === 'active' ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {new Date(session.update_time).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => viewSession(session)}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => archiveSession(session.id)}>
                      <ArchiveIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => deleteSession(session.id)} color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 分页 */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, p) => setPage(p)}
            color="primary"
          />
        </Box>
      )}

      {/* 会话详情弹窗 */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          会话详情 {selectedSession && `- ${selectedSession.title || '无标题'}`}
        </DialogTitle>
        <DialogContent dividers>
          {selectedSession && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                用户: {selectedSession.user_id} | 模型: {selectedSession.model || '-'} |
                消息数: {selectedSession.message_count} | Token: {selectedSession.total_tokens}
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
              {messages.map((msg, idx) => (
                <Paper
                  key={msg.id}
                  sx={{
                    p: 2,
                    mb: 1,
                    bgcolor: msg.role === 'user' ? 'primary.50' : msg.role === 'assistant' ? 'grey.50' : 'warning.50',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Chip
                      label={msg.role === 'user' ? '用户' : msg.role === 'assistant' ? '助手' : msg.role}
                      size="small"
                      color={msg.role === 'user' ? 'primary' : msg.role === 'assistant' ? 'default' : 'warning'}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {msg.latency_ms}ms | {msg.input_tokens}+{msg.output_tokens} tokens
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

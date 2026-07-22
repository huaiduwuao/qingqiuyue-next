'use client'

/**
 * MCPManager — MCP Server & Tools 管理
 * 对应后端 mcp/client.go
 */

import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import type { MCPServer, MCPTool } from '../api-extended'

interface Props { token: string }

export default function MCPManager({ token }: Props) {
  const [servers, setServers] = useState<MCPServer[]>([])
  const [tools, setTools] = useState<Record<number, MCPTool[]>>({})
  const [loading, setLoading] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [newServer, setNewServer] = useState<Partial<MCPServer>>({
    transport: 'stdio',
    timeout: 60,
    status: 'active',
  })

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/agentmanager/mcp/servers', {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json())
      setServers(res.list || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const loadTools = async (serverId: number) => {
    const res = await fetch(`/api/agentmanager/mcp/servers/${serverId}/tools`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json())
    setTools(prev => ({ ...prev, [serverId]: res.list || [] }))
  }

  const addServer = async () => {
    if (!newServer.name || !newServer.transport) return
    await fetch('/api/agentmanager/mcp/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(newServer),
    })
    setAddOpen(false)
    setNewServer({ transport: 'stdio', timeout: 60, status: 'active' })
    load()
  }

  const removeServer = async (id: number) => {
    if (!confirm('确认移除此 MCP Server?')) return
    await fetch(`/api/agentmanager/mcp/servers/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    load()
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">MCP Server 管理</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<RefreshIcon />} size="small" onClick={load}>刷新</Button>
          <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => setAddOpen(true)}>
            添加 Server
          </Button>
        </Box>
      </Box>

      {loading && <CircularProgress size={20} />}

      {/* Server 列表 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2 }}>
        {servers.map(server => (
          <Card key={server.id}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{server.name}</Typography>
                  <Chip size="small" label={server.transport} sx={{ mt: 0.5, fontSize: 10 }} />
                </Box>
                <Chip
                  size="small"
                  label={server.status === 'active' ? '✓ 在线' : '✗ 离线'}
                  color={server.status === 'active' ? 'success' : 'default'}
                />
              </Box>

              {/* 连接信息 */}
              <Box sx={{ mt: 1.5 }}>
                {server.transport === 'stdio' && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', display: 'block' }}>
                    {server.command} {server.args?.join(' ')}
                  </Typography>
                )}
                {server.transport !== 'stdio' && server.url && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', display: 'block' }}>
                    {server.url}
                  </Typography>
                )}
              </Box>

              {/* 工具数 */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}>
                <Button size="small" variant="text" onClick={() => loadTools(server.id)}>
                  {tools[server.id] ? `${tools[server.id].length} 个工具` : '加载工具'}
                </Button>
                <Button size="small" color="error" onClick={() => removeServer(server.id)}>移除</Button>
              </Box>

              {/* 工具列表 */}
              {tools[server.id] && (
                <Box sx={{ mt: 1, maxHeight: 200, overflowY: 'auto' }}>
                  {tools[server.id].map((tool, i) => (
                    <Box key={i} sx={{ py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'primary.main' }}>
                        {tool.name}
                      </Typography>
                      {tool.description && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 11 }}>
                          {tool.description.slice(0, 80)}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        ))}

        {servers.length === 0 && !loading && (
          <Alert severity="info">暂无可用的 MCP Server，点击「添加 Server」添加第一个。</Alert>
        )}
      </Box>

      {/* 添加 Server 对话框 */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>添加 MCP Server</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="名称" value={newServer.name || ''} onChange={e => setNewServer(s => ({ ...s, name: e.target.value }))} sx={{ mt: 1 }} />
          <FormControl fullWidth sx={{ mt: 1.5 }}>
            <InputLabel>传输方式</InputLabel>
            <Select label="传输方式" value={newServer.transport || 'stdio'}
              onChange={e => setNewServer(s => ({ ...s, transport: e.target.value as any }))}>
              <MenuItem value="stdio">stdio (本地子进程)</MenuItem>
              <MenuItem value="sse">SSE (HTTP Server-Sent Events)</MenuItem>
              <MenuItem value="streamable_http">Streamable HTTP</MenuItem>
            </Select>
          </FormControl>

          {newServer.transport === 'stdio' ? (
            <>
              <TextField fullWidth label="命令" value={newServer.command || ''} onChange={e => setNewServer(s => ({ ...s, command: e.target.value }))} sx={{ mt: 1.5 }} placeholder="npx / python / node" />
              <TextField fullWidth label="参数 (JSON 数组)" value={newServer.args ? JSON.stringify(newServer.args) : ''}
                onChange={e => { try { setNewServer(s => ({ ...s, args: JSON.parse(e.target.value) })) } catch {} }}
                sx={{ mt: 1 }} placeholder='["-m", "my_mcp_server"]' />
            </>
          ) : (
            <>
              <TextField fullWidth label="URL" value={newServer.url || ''} onChange={e => setNewServer(s => ({ ...s, url: e.target.value }))} sx={{ mt: 1.5 }} placeholder="http://localhost:8080/mcp" />
            </>
          )}

          <TextField fullWidth label="超时 (秒)" type="number" value={newServer.timeout || 60}
            onChange={e => setNewServer(s => ({ ...s, timeout: Number(e.target.value) }))} sx={{ mt: 1.5 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>取消</Button>
          <Button onClick={addServer} variant="contained" disabled={!newServer.name}>添加</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

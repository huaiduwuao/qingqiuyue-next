'use client'

/**
 * MCPManager — 托管 MCP server:从目录一键安装(容器跑在 qingqiuyue 网络里)或接入远程地址。
 * 对应后端 internal/agentmanager/mcp_hosted.go。
 */

import { useCallback, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import RefreshIcon from '@mui/icons-material/Refresh'
import type { MCPCatalogEntry, MCPServer, MCPTool } from '../api-extended'
import { API_PREFIX } from '@/lib/api/prefix'

interface Props {
  token: string
}

const STATUS: Record<string, { label: string; color: 'success' | 'warning' | 'error' | 'default' }> = {
  running: { label: '运行中', color: 'success' },
  starting: { label: '启动中', color: 'warning' },
  error: { label: '出错', color: 'error' },
  stopped: { label: '已停止', color: 'default' },
}

export default function MCPManager({ token }: Props) {
  const [catalog, setCatalog] = useState<MCPCatalogEntry[]>([])
  const [servers, setServers] = useState<MCPServer[]>([])
  const [tools, setTools] = useState<Record<number, MCPTool[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [installing, setInstalling] = useState<MCPCatalogEntry | 'custom' | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<{ name: string; env: Record<string, string>; url: string; transport: 'sse' | 'streamable_http' }>({
    name: '',
    env: {},
    url: '',
    transport: 'sse',
  })

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const api = useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
      const res = await fetch(API_PREFIX + `/api/agentmanager/mcp${path}`, { ...init, headers })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      return body
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, s] = await Promise.all([api<{ list: MCPCatalogEntry[] }>('/catalog'), api<{ list: MCPServer[] }>('/servers')])
      setCatalog(c.list || [])
      setServers(s.list || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    load()
  }, [load])

  const openInstall = (entry: MCPCatalogEntry | 'custom') => {
    setInstalling(entry)
    setForm({ name: entry === 'custom' ? '' : entry.id, env: {}, url: entry === 'custom' ? '' : entry.url_hint || '', transport: entry === 'custom' ? 'sse' : (entry.transport as any) })
  }

  const install = async () => {
    if (!installing) return
    setBusy(true)
    setError(null)
    try {
      const body =
        installing === 'custom'
          ? { name: form.name, transport: form.transport, url: form.url }
          : { catalog_id: installing.id, name: form.name, env: form.env, url: form.url }
      await api('/servers', { method: 'POST', body: JSON.stringify(body) })
      setInstalling(null)
      await load()
    } catch (e: any) {
      setError(e.message)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const act = async (s: MCPServer, action: 'start' | 'stop' | 'remove') => {
    if (action === 'remove' && !confirm(`移除「${s.name}」?容器会一并删掉。`)) return
    setBusy(true)
    try {
      if (action === 'remove') await api(`/servers/${s.id}`, { method: 'DELETE' })
      else await api(`/servers/${s.id}/${action}`, { method: 'POST' })
      await load()
    } catch (e: any) {
      setError(e.message)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const loadTools = async (s: MCPServer) => {
    try {
      const r = await api<{ list: MCPTool[] }>(`/servers/${s.id}/tools`)
      setTools((prev) => ({ ...prev, [s.id]: r.list || [] }))
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">MCP 服务</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<RefreshIcon />} size="small" onClick={load}>刷新</Button>
          <Button size="small" variant="outlined" onClick={() => openInstall('custom')}>接入远程地址</Button>
        </Box>
      </Box>
      {loading && <CircularProgress size={20} />}
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>已接入</Typography>
        {servers.length === 0 && !loading && <Alert severity="info">还没有接入任何 MCP 服务。从下面的目录一键安装,或接入远程地址。</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2 }}>
          {servers.map((s) => {
            const st = STATUS[s.status] ?? { label: s.status, color: 'default' as const }
            return (
              <Card key={s.id}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>{s.name}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }} noWrap>
                        {s.docker_image ? `容器 · ${s.docker_image}` : s.server_url}
                      </Typography>
                    </Box>
                    <Chip size="small" label={st.label} color={st.color} />
                  </Box>
                  {s.last_error && <Alert severity="error" sx={{ py: 0 }}>{s.last_error}</Alert>}
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Button size="small" onClick={() => loadTools(s)} disabled={s.status !== 'running'}>
                      {tools[s.id] ? `${tools[s.id].length} 个工具` : `${s.tool_count} 个工具`}
                    </Button>
                    <Box sx={{ flex: 1 }} />
                    {s.status === 'running' ? (
                      <Button size="small" onClick={() => act(s, 'stop')} disabled={busy}>停止</Button>
                    ) : (
                      <Button size="small" onClick={() => act(s, 'start')} disabled={busy}>启动</Button>
                    )}
                    <Button size="small" color="error" onClick={() => act(s, 'remove')} disabled={busy}>移除</Button>
                  </Box>
                  {tools[s.id] && (
                    <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
                      {tools[s.id].map((t, i) => (
                        <Box key={i} sx={{ py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'primary.main' }}>{t.name}</Typography>
                          {t.description && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 11 }}>
                              {t.description.slice(0, 100)}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </Box>
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>目录</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          容器类条目会在服务器的容器网络里起一个服务,数字员工通过它的工具干活;远程类条目接到你自己机器上的 Unreal / Blender。
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2 }}>
          {catalog.map((e) => (
            <Card key={e.id} variant="outlined">
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>{e.name}</Typography>
                  <Chip size="small" variant="outlined" label={e.kind === 'container' ? '容器' : '远程'} />
                </Box>
                <Typography variant="caption" color="text.secondary">{e.description}</Typography>
                {e.notes && <Typography variant="caption" sx={{ color: 'warning.main' }}>{e.notes}</Typography>}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button size="small" onClick={() => openInstall(e)}>{e.kind === 'container' ? '安装' : '接入'}</Button>
                  {e.source && (
                    <Typography component="a" href={e.source} target="_blank" rel="noreferrer" variant="caption" sx={{ color: 'text.disabled' }}>
                      来源 ↗
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Box>

      <Dialog open={!!installing} onClose={() => !busy && setInstalling(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{installing === 'custom' ? '接入远程 MCP 服务' : `安装 ${installing?.name ?? ''}`}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          <TextField id="mcp-name" size="small" label="名字(小写字母、数字、-)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          {installing === 'custom' && (
            <>
              <TextField id="mcp-url" size="small" label="地址(http:// 或 https://)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              <TextField
                id="mcp-transport"
                select
                size="small"
                label="传输方式"
                value={form.transport}
                onChange={(e) => setForm({ ...form, transport: e.target.value as any })}
                slotProps={{ select: { native: true } }}
              >
                <option value="sse">SSE</option>
                <option value="streamable_http">Streamable HTTP</option>
              </TextField>
              <Typography variant="caption" color="text.secondary">stdio 型服务不能直接接入(那会在服务端进程里执行命令);请从目录安装成容器。</Typography>
            </>
          )}
          {installing && installing !== 'custom' && installing.kind === 'remote' && (
            <TextField id="mcp-url" size="small" label="地址" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} helperText={installing.notes} />
          )}
          {installing && installing !== 'custom' && installing.kind === 'container' && (installing.env || []).map((ev) => (
            <TextField
              key={ev.name}
              id={`mcp-env-${ev.name}`}
              size="small"
              type={ev.secret ? 'password' : 'text'}
              label={`${ev.name}${ev.required ? ' *' : ''}`}
              helperText={ev.description}
              value={form.env[ev.name] || ''}
              onChange={(e) => setForm({ ...form, env: { ...form.env, [ev.name]: e.target.value } })}
            />
          ))}
          {installing && installing !== 'custom' && installing.kind === 'container' && (
            <Typography variant="caption" color="text.secondary">安装会拉镜像并等服务就绪,首次可能要一两分钟。</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInstalling(null)} disabled={busy}>取消</Button>
          <Button variant="contained" onClick={install} disabled={busy || !form.name.trim()}>
            {busy ? <CircularProgress size={18} /> : '确定'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

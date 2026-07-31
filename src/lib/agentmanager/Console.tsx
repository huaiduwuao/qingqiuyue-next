'use client'

/**
 * AgentManager 管理控制台 - MUI 版本
 * 多 Agent 管理平面前端界面
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
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
import { agentmAPI, type Instance, type Agent, type AuditLog, type Skill, type MonitoringOverview, type InstanceStats, type UsageStats } from './api'
import KanbanBoard from './kanban/KanbanBoard'
import MCPManager from './mcp/MCPManager'
import SandboxMonitor from './sandbox/SandboxMonitor'
import AgentTerminal from './terminal/AgentTerminal'
import SessionManager from './session/SessionManager'
import WorkflowsOverview from './WorkflowsOverview'
import dynamic from 'next/dynamic'
import { useAuth } from '@/contexts/AuthContext'

// 工作室组件(含 React Flow)客户端渲染
const WorkflowStudio = dynamic(() => import('./studio/WorkflowStudio'), { ssr: false })
const SkillStudio = dynamic(() => import('./studio/SkillStudio'), { ssr: false })
const AgentStudio = dynamic(() => import('./studio/AgentStudio'), { ssr: false })
const ModelProviderManager = dynamic(() => import('./models/ModelProviderManager'), { ssr: false })
const WorkflowRunsManager = dynamic(() => import('./WorkflowRunsManager'), { ssr: false })

type Tab = 'dashboard' | 'instances' | 'agents' | 'sessions' | 'audit' | 'skills' | 'gateway' | 'kanban' | 'mcp' | 'sandbox' | 'terminal' | 'workflows' | 'models' | 'workflow-runs'

export default function AgentManagerConsole() {
  const { sessionId: token, isAuthenticated } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  // 工作室(创建/编辑页):非空时整体替换 tab 视图;editingId 表示编辑模式
  const [studio, setStudio] = useState<'agent' | 'skill' | 'workflow' | null>(null)
  const [studioEditId, setStudioEditId] = useState<number | null>(null)
  const [studioEditName, setStudioEditName] = useState<string>('')
  const [agentsList, setAgentsList] = useState<Agent[]>([])
  const [loading, setLoading] = useState(false)

  // 打开工作室:kind + 可选编辑 id
  const openStudio = (kind: 'agent' | 'skill' | 'workflow', editId: number | null = null) => {
    setStudioEditId(editId)
    setStudioEditName('')
    setStudio(kind)
  }
  const closeStudio = () => {
    setStudio(null)
    setStudioEditId(null)
    setStudioEditName('')
    loadData() // 返回后刷新列表
  }

  // Data states
  const [instances, setInstances] = useState<Instance[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [overview, setOverview] = useState<MonitoringOverview | null>(null)
  const [instanceStats, setInstanceStats] = useState<InstanceStats[]>([])
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)

  // 删除 Agent / 技能
  const handleDeleteAgent = async (a: Agent) => {
    if (!confirm(`删除 Agent「${a.name}」?此操作不可恢复。`)) return
    await agentmAPI.deleteAgent(a.id).catch((e) => alert(`删除失败: ${e.message}`))
    loadData()
  }
  const handleDeleteSkill = async (s: Skill) => {
    if (!confirm(`删除技能「${s.name}」?`)) return
    await agentmAPI.deleteSkill(s.id).catch((e) => alert(`删除失败: ${e.message}`))
    loadData()
  }

  // Load data
  const loadData = useCallback(async () => {
    if (!token) return

    setLoading(true)
    try {
      agentmAPI.setToken(token)

      const [instRes, overviewRes, instStatsRes, usageRes, agentsRes] = await Promise.all([
        agentmAPI.listInstances().catch(() => ({ list: [] })),
        agentmAPI.getMonitoringOverview().catch(() => null),
        agentmAPI.getInstancesStats().catch(() => ({ instances: [] })),
        agentmAPI.getUsageStats('week').catch(() => null),
        agentmAPI.listAgents().catch(() => [] as Agent[]),
      ])
      setInstances(instRes.list || [])
      setOverview(overviewRes)
      setInstanceStats(instStatsRes.instances || [])
      setUsageStats(usageRes)
      setAgentsList(agentsRes || [])
    } catch (e: any) {
      console.error('Load data error:', e)
    } finally {
      setLoading(false)
    }
  }, [token])

  // Load audit logs
  const loadAuditLogs = async () => {
    if (!token) return
    agentmAPI.setToken(token)
    setLoading(true)
    try {
      const res = await agentmAPI.getAuditLog({ limit: 50 })
      setAuditLogs(res.list || [])
    } catch (e: any) {
      console.error('Load audit error:', e)
    } finally {
      setLoading(false)
    }
  }

  // Load skills
  const loadSkills = async () => {
    if (!token) return
    agentmAPI.setToken(token)
    setLoading(true)
    try {
      const res = await agentmAPI.listSkills()
      setSkills(res.list || [])
    } catch (e: any) {
      console.error('Load skills error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated && token) {
      loadData()
    }
  }, [isAuthenticated, token, loadData])

  useEffect(() => {
    if (isAuthenticated && activeTab === 'audit') {
      loadAuditLogs()
    }
    if (isAuthenticated && activeTab === 'skills') {
      loadSkills()
    }
  }, [isAuthenticated, activeTab])

  // 未登录状态
  if (!isAuthenticated) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 4 }}>
        <Box sx={{ maxWidth: 400, mx: 'auto', textAlign: 'center' }}>
          <Typography variant="h4" sx={{ mb: 2 }}>🔐</Typography>
          <Typography variant="h5" sx={{ mb: 2 }}>需要登录</Typography>
          <Typography sx={{ color: 'text.secondary', mb: 3 }}>
            请先登录以访问 Agent 管理控制台
          </Typography>
          <Button variant="contained" href="/user/login?redirect=/system/agentmanager">
            去登录
          </Button>
        </Box>
      </Box>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: '📊 总览' },
    { key: 'instances', label: '🖥️ 实例' },
    { key: 'agents', label: '🤖 Agent' },
    { key: 'sessions', label: '💬 会话' },
    { key: 'audit', label: '📝 审计' },
    { key: 'skills', label: '🛠️ 技能' },
    { key: 'gateway', label: '🌐 网关' },
    { key: 'models', label: '🧠 模型管理' },
    { key: 'kanban', label: '📋 看板' },
    { key: 'mcp', label: '🔌 MCP' },
    { key: 'sandbox', label: '🐳 沙盒' },
    { key: 'terminal', label: '🖥️ 终端' },
    { key: 'workflows', label: '🔀 工作流' },
    { key: 'workflow-runs', label: '📋 任务' },
  ]

  return (
    <Box sx={{ bgcolor: 'background.default', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px - 48px)', overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          🤖 AgentManager
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {overview && (
            <>
              <Chip
                size="small"
                label={`✓ 健康: ${overview.instances.healthy}/${overview.instances.total}`}
                color="success"
                variant="outlined"
              />
              <Chip
                size="small"
                label={`🤖 Agent: ${overview.agents.active}/${overview.agents.total}`}
                color="primary"
                variant="outlined"
              />
            </>
          )}
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider', px: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => {
            setActiveTab(v)
            closeStudio() // 切换 tab 时退出工作室,回到对应列表
          }}
          textColor="primary"
          indicatorColor="primary"
        >
          {tabs.map(tab => (
            <Tab key={tab.key} label={tab.label} value={tab.key} />
          ))}
        </Tabs>
      </Box>

      {/* Content */}
      <Box sx={{ p: 3, flex: 1, minHeight: 0, overflow: 'auto' }}>
        {studio ? (
          /* 工作室:创建/编辑页(左聊天 + 右画布),整体替换 tab 视图 */
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flex: '0 0 auto' }}>
              <Button size="small" variant="outlined" onClick={closeStudio}>
                ← 返回
              </Button>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {studio === 'agent' ? '🤖 Agent 工作室' : studio === 'skill' ? '⚡ 技能工作室' : '🔀 工作流工作室'}
                {studioEditId ? (studioEditName ? ` · ${studioEditName}` : ' · 编辑') : ' · 新建'}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0 }}>
              {studio === 'agent' && <AgentStudio editingId={studioEditId} onLoaded={setStudioEditName} />}
              {studio === 'skill' && <SkillStudio editingId={studioEditId} onLoaded={setStudioEditName} />}
              {studio === 'workflow' && <WorkflowStudio editingId={studioEditId} onLoaded={setStudioEditName} />}
            </Box>
          </Box>
        ) : (
        <>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && !loading && overview && (
          <Box>
            {/* Stats Cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">实例</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 600, mt: 1 }}>
                    {overview.instances.total}
                  </Typography>
                  <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                    {overview.instances.healthy} 健康
                  </Typography>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Agent</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 600, mt: 1 }}>
                    {overview.agents.total}
                  </Typography>
                  <Typography variant="body2" color="primary.main" sx={{ mt: 1 }}>
                    {overview.agents.active} 活跃
                  </Typography>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">今日对话</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 600, mt: 1 }}>
                    {overview.agents.today_chats}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    次
                  </Typography>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">平均延迟</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 600, mt: 1 }}>
                    {overview.usage.avg_latency_ms.toFixed(0)}ms
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    响应时间
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            {/* Usage Chart */}
            {usageStats?.daily?.length ? (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>📈 使用趋势（本周）</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 120 }}>
                    {usageStats.daily.map((day, i) => {
                      const maxTokens = Math.max(...usageStats.daily.map(d => d.tokens), 1)
                      const height = (day.tokens / maxTokens) * 100
                      return (
                        <Box key={i} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                          <Box
                            sx={{
                              width: '100%',
                              bgcolor: 'primary.main',
                              borderRadius: '4px 4px 0 0',
                              minHeight: 4,
                              height: `${Math.max(height, 4)}%`,
                            }}
                            title={`${day.tokens.toLocaleString()} tokens`}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {day.date.slice(5)}
                          </Typography>
                        </Box>
                      )
                    })}
                  </Box>
                </CardContent>
              </Card>
            ) : null}

            {/* Instance Status */}
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>📋 实例状态</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>名称</TableCell>
                        <TableCell>状态</TableCell>
                        <TableCell>连接</TableCell>
                        <TableCell>延迟</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {instanceStats.slice(0, 5).map(inst => (
                        <TableRow key={inst.id}>
                          <TableCell>{inst.name}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={inst.health_status === 'healthy' ? '✓ 健康' :
                                     inst.health_status === 'unhealthy' ? '✗ 异常' : '? 未知'}
                              color={inst.health_status === 'healthy' ? 'success' : 'error'}
                            />
                          </TableCell>
                          <TableCell>{inst.active_conns}/{inst.max_concurrent}</TableCell>
                          <TableCell>{inst.avg_latency_ms}ms</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Instances Tab */}
        {activeTab === 'instances' && !loading && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">实例管理</Typography>
              <Button
                variant="contained"
                size="small"
                onClick={() => agentmAPI.discoverInstances().then(loadData)}
              >
                自动发现
              </Button>
            </Box>
            <Box sx={{ display: 'grid', gap: 2 }}>
              {instances.map(inst => (
                <Card key={inst.id}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 2,
                            bgcolor: inst.runtime_type === 'hermes' ? 'primary.main' :
                                      inst.runtime_type === 'openclaw' ? 'warning.main' : 'grey.500',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 24,
                          }}
                        >
                          {inst.runtime_type === 'hermes' ? '🖥️' : inst.runtime_type === 'openclaw' ? '🦞' : '🤖'}
                        </Box>
                        <Box>
                          <Typography variant="h6">{inst.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {inst.code} • {inst.base_url || 'N/A'}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Chip
                          size="small"
                          label={inst.runtime_type?.toUpperCase() || 'HERMES'}
                          color="primary"
                          variant="outlined"
                        />
                        <Chip
                          size="small"
                          label={inst.health_status === 'healthy' ? '✓ 健康' :
                                 inst.health_status === 'unhealthy' ? '✗ 异常' : '? 未知'}
                          color={inst.health_status === 'healthy' ? 'success' : 'warning'}
                        />
                      </Box>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, mt: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        区域: <Box component="span" color="text.primary">{inst.region}</Box>
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        权重: <Box component="span" color="text.primary">{inst.weight}</Box>
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        最大并发: <Box component="span" color="text.primary">{inst.max_concurrent}</Box>
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        总请求: <Box component="span" color="text.primary">{inst.total_requests}</Box>
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Box>
        )}

        {/* Agents Tab */}
        {activeTab === 'agents' && !loading && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h6">Agent 管理</Typography>
              <Button size="small" variant="contained" onClick={() => setStudio('agent')}>➕ 新建 Agent</Button>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
              {agentsList.map(agent => (
                <Card key={agent.id}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          bgcolor: 'primary.main',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: 18,
                        }}
                      >
                        {agent.name.charAt(0)}
                      </Box>
                      <Box
                        sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                        onClick={() => router.push(`/system/agentmanager/agent-detail?id=${agent.id}`)}
                      >
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>{agent.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{agent.role} · {agent.model}</Typography>
                      </Box>
                      <IconButton size="small" onClick={() => openStudio('agent', agent.id)} title="编辑">
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDeleteAgent(agent)} title="删除">
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Chip size="small" label={agent.status} color={agent.status === 'active' ? 'success' : 'default'} />
                      {agent.published && <Chip size="small" label="已发布" color="info" variant="outlined" />}
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                        对话 {agent.chat_count?.toLocaleString?.() ?? 0}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              ))}
              {agentsList.length === 0 && (
                <Typography variant="body2" color="text.secondary">暂无 Agent,点右上角「新建 Agent」创建。</Typography>
              )}
            </Box>
          </Box>
        )}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && token && (
          <SessionManager token={token} />
        )}

        {/* Audit Tab */}
        {activeTab === 'audit' && !loading && (
          <Box>
            <Typography variant="h6" sx={{ mb: 3 }}>审计日志</Typography>
            {auditLogs.length > 0 ? (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>时间</TableCell>
                      <TableCell>用户</TableCell>
                      <TableCell>模型</TableCell>
                      <TableCell>Token</TableCell>
                      <TableCell>延迟</TableCell>
                      <TableCell>状态</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {auditLogs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell>{new Date(log.create_time).toLocaleString()}</TableCell>
                        <TableCell>{log.user_id}</TableCell>
                        <TableCell>{log.model}</TableCell>
                        <TableCell>{log.total_tokens}</TableCell>
                        <TableCell>{log.latency_ms}ms</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={log.status}
                            color={log.status === 'success' ? 'success' : 'error'}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">暂无审计日志</Alert>
            )}
          </Box>
        )}

        {/* Skills Tab */}
        {activeTab === 'skills' && !loading && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h6">技能管理</Typography>
              <Button size="small" variant="contained" onClick={() => setStudio('skill')}>➕ 新建技能</Button>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
              {skills.map(skill => (
                <Card key={skill.id}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{skill.name}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          {skill.description}
                        </Typography>
                      </Box>
                      <IconButton size="small" onClick={() => openStudio('skill', skill.id)} title="编辑">
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDeleteSkill(skill)} title="删除">
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                      <Chip size="small" label={skill.category} />
                      <Chip size="small" label={skill.source} color="primary" variant="outlined" />
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Box>
        )}

        {/* Gateway Tab */}
        {activeTab === 'gateway' && !loading && (
          <Box>
            <Typography variant="h6" sx={{ mb: 3 }}>AI 网关</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>配额使用</Typography>
                  {overview && (
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">Token 配额</Typography>
                        <Typography variant="body2">
                          {overview.quota.used.toLocaleString()} / {overview.quota.total.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{ bgcolor: 'grey.700', borderRadius: 1, height: 8, overflow: 'hidden' }}>
                        <Box
                          sx={{
                            bgcolor: 'primary.main',
                            height: '100%',
                            width: `${Math.min(overview.quota.usage_percent, 100)}%`,
                            borderRadius: 1,
                          }}
                        />
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>可用模型</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {['xiaoyue', 'backend-dev', 'frontend-dev', 'ops'].map(model => (
                      <Box key={model} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
                        <Typography variant="body2">{model}</Typography>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Box>
        )}

        {/* Kanban Tab */}
        {activeTab === 'kanban' && token && (
          <KanbanBoard boardId={1} token={token} />
        )}

        {/* MCP Tab */}
        {activeTab === 'mcp' && token && (
          <MCPManager token={token} />
        )}

        {/* Sandbox Tab */}
        {activeTab === 'sandbox' && token && (
          <SandboxMonitor token={token} />
        )}

        {/* Terminal Tab */}
        {activeTab === 'terminal' && (
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>🖥️ Agent 远程终端</Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              连接远程 Hermes Agent / Claude Code / OpenClaw，实时查看输出结果
            </Alert>
            <AgentTerminal token={token ?? undefined} />
          </Box>
        )}

        {/* Workflows Tab:跨所有 Agent 的工作流总览 */}
        {activeTab === 'workflows' && (
          <Box>
            <WorkflowsOverview
              onCreate={() => openStudio('workflow')}
              onEdit={(row) => openStudio('workflow', row.id)}
            />
          </Box>
        )}

        {/* 模型供应商管理 Tab */}
        {activeTab === 'models' && (
          <Box>
            <ModelProviderManager />
          </Box>
        )}

        {/* 工作流任务管理 Tab:执行记录 + 步骤日志 + 定时调度 */}
        {activeTab === 'workflow-runs' && (
          <Box>
            <WorkflowRunsManager />
          </Box>
        )}
        </>
        )}
      </Box>
    </Box>
  )
}

'use client'

/**
 * Agent 详情页
 * Tab 切换: 基本信息 / 画布 / 技能 / MCP / 记忆 / 对话生成
 */

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import CircularProgress from '@mui/material/CircularProgress'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'

import { agentmAPI } from '@/lib/agentmanager/api'
import { canvasAPI } from './api'
import type { AgentAssociations } from './types'

// 画布和生成器客户端渲染
const CanvasFlow = dynamic(() => import('./CanvasFlow'), {
  ssr: false,
  loading: () => <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>,
})
const GeneratorChat = dynamic(() => import('./GeneratorChat'), {
  ssr: false,
  loading: () => <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>,
})

interface AgentDetailProps {
  agentId: number
}

interface AgentInfo {
  id: number
  agent_id: string
  name: string
  role: string
  role_type: string
  description: string
  persona: string
  system_prompt: string
  greeting: string
  model: string
  status: string
  published: boolean
  tags: string[]
  capabilities: string[]
}

export default function AgentDetail({ agentId }: AgentDetailProps) {
  const [tab, setTab] = useState(0)
  const [agent, setAgent] = useState<AgentInfo | null>(null)
  const [assoc, setAssoc] = useState<AgentAssociations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const [agentData, assocData] = await Promise.all([
          agentmAPI.getAgentById(agentId),
          canvasAPI.getAssociations(agentId).catch(() => null),
        ])
        if (!mounted) return
        setAgent(agentData)
        setAssoc(assocData)
      } catch (e: any) {
        if (mounted) setError(e.message || '加载失败')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [agentId])

  const refreshAssoc = async () => {
    try {
      const data = await canvasAPI.getAssociations(agentId)
      setAssoc(data)
    } catch {
      /* ignore */
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error || !agent) {
    return <Box sx={{ p: 4, color: 'error.main' }}>加载失败: {error || 'Agent 不存在'}</Box>
  }

  const agentContext = `Agent名称: ${agent.name}\n角色: ${agent.role}\n描述: ${agent.description}\n能力: ${(agent.capabilities || []).join(', ')}`

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 头部 */}
      <Box sx={{ p: 2, borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ fontSize: 20, fontWeight: 700 }}>{agent.name}</Box>
          <Box sx={{ fontSize: 13, color: 'text.secondary' }}>{agent.description || agent.agent_id}</Box>
        </Box>
        <Chip label={agent.role} size="small" color="primary" variant="outlined" />
        <Chip
          label={agent.status}
          size="small"
          color={agent.status === 'active' ? 'success' : 'default'}
        />
        {agent.published && <Chip label="已发布" size="small" color="info" />}
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: '1px solid #eee', px: 1 }}
      >
        <Tab label="基本信息" />
        <Tab label="🎨 画布" />
        <Tab label="✨ 对话生成" />
        <Tab label={`⚡ 技能 (${assoc?.skills?.length ?? 0})`} />
        <Tab label={`🔌 MCP (${assoc?.mcps?.length ?? 0})`} />
        <Tab label={`🧠 记忆 (${assoc?.memories?.length ?? 0})`} />
        <Tab label={`🔀 工作流 (${assoc?.workflows?.length ?? 0})`} />
      </Tabs>

      {/* 内容 */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {tab === 0 && <BasicInfoTab agent={agent} />}
        {tab === 1 && (
          <Box sx={{ height: 'calc(100vh - 220px)', minHeight: 560 }}>
            <CanvasFlow agentId={agentId} agentName={agent.name} />
          </Box>
        )}
        {tab === 2 && (
          <Box sx={{ p: 3, maxWidth: 900 }}>
            <GeneratorChat
              agentId={agentId}
              agentContext={agentContext}
              onWorkflowGenerated={refreshAssoc}
              onSkillGenerated={refreshAssoc}
            />
          </Box>
        )}
        {tab === 3 && <SkillsTab agentId={agentId} assoc={assoc} onChanged={refreshAssoc} />}
        {tab === 4 && <MCPsTab agentId={agentId} assoc={assoc} onChanged={refreshAssoc} />}
        {tab === 5 && <MemoriesTab agentId={agentId} assoc={assoc} onChanged={refreshAssoc} />}
        {tab === 6 && <WorkflowsTab agentId={agentId} assoc={assoc} onChanged={refreshAssoc} />}
      </Box>
    </Box>
  )
}

// ============ 基本信息 ============
function BasicInfoTab({ agent }: { agent: AgentInfo }) {
  return (
    <Box sx={{ p: 3, maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField label="名称" value={agent.name} fullWidth size="small" slotProps={{ input: { readOnly: true } }} />
      <Box sx={{ display: 'flex', gap: 2 }}>
        <TextField label="角色" value={agent.role} size="small" slotProps={{ input: { readOnly: true } }} />
        <TextField label="模型" value={agent.model} size="small" slotProps={{ input: { readOnly: true } }} />
      </Box>
      <TextField label="Persona" value={agent.persona} fullWidth multiline rows={2} slotProps={{ input: { readOnly: true } }} />
      <TextField label="System Prompt" value={agent.system_prompt} fullWidth multiline rows={5} slotProps={{ input: { readOnly: true } }} />
      <TextField label="Greeting" value={agent.greeting} fullWidth slotProps={{ input: { readOnly: true } }} />
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {(agent.capabilities || []).map((c) => (
          <Chip key={c} label={c} size="small" />
        ))}
      </Box>
    </Box>
  )
}

// ============ 技能 ============
function SkillsTab({ agentId, assoc, onChanged }: { agentId: number; assoc: AgentAssociations | null; onChanged: () => void }) {
  const [skillIdInput, setSkillIdInput] = useState('')
  const [busy, setBusy] = useState(false)

  const link = async () => {
    const id = parseInt(skillIdInput, 10)
    if (!id) return
    setBusy(true)
    try {
      await canvasAPI.linkSkill(agentId, id)
      setSkillIdInput('')
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const unlink = async (skillId: number) => {
    setBusy(true)
    try {
      await canvasAPI.unlinkSkill(agentId, skillId)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small"
          label="技能 ID"
          value={skillIdInput}
          onChange={(e) => setSkillIdInput(e.target.value)}
          sx={{ width: 200 }}
        />
        <Button variant="contained" size="small" onClick={link} disabled={busy}>
          关联技能
        </Button>
      </Box>

      {(assoc?.skills || []).map((s) => (
        <Box
          key={s.skill_id}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, mb: 1, border: '1px solid #eee', borderRadius: 1 }}
        >
          <Box sx={{ flex: 1 }}>
            <Box sx={{ fontWeight: 600 }}>{s.skill_name}</Box>
            <Box sx={{ fontSize: 12, color: 'text.secondary' }}>
              {s.skill_category} · 优先级 {s.priority}
            </Box>
          </Box>
          <Chip label={s.enabled ? '启用' : '停用'} size="small" color={s.enabled ? 'success' : 'default'} />
          <Button size="small" color="error" onClick={() => unlink(s.skill_id)} disabled={busy}>
            移除
          </Button>
        </Box>
      ))}
      {(assoc?.skills?.length ?? 0) === 0 && <Box sx={{ color: 'text.secondary' }}>暂无关联技能</Box>}
    </Box>
  )
}

// ============ MCP ============
function MCPsTab({ agentId, assoc, onChanged }: { agentId: number; assoc: AgentAssociations | null; onChanged: () => void }) {
  const [mcpIdInput, setMcpIdInput] = useState('')
  const [busy, setBusy] = useState(false)

  const link = async () => {
    const id = parseInt(mcpIdInput, 10)
    if (!id) return
    setBusy(true)
    try {
      await canvasAPI.linkMCP(agentId, id)
      setMcpIdInput('')
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const unlink = async (mcpId: number) => {
    setBusy(true)
    try {
      await canvasAPI.unlinkMCP(agentId, mcpId)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small"
          label="MCP 服务器 ID"
          value={mcpIdInput}
          onChange={(e) => setMcpIdInput(e.target.value)}
          sx={{ width: 200 }}
        />
        <Button variant="contained" size="small" onClick={link} disabled={busy}>
          关联 MCP
        </Button>
      </Box>

      {(assoc?.mcps || []).map((m) => (
        <Box
          key={m.mcp_server_id}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, mb: 1, border: '1px solid #eee', borderRadius: 1 }}
        >
          <Box sx={{ flex: 1 }}>
            <Box sx={{ fontWeight: 600 }}>{m.mcp_server_name}</Box>
            <Box sx={{ fontSize: 12, color: 'text.secondary' }}>工具数: {m.mcp_tool_count}</Box>
          </Box>
          <Chip label={m.enabled ? '启用' : '停用'} size="small" color={m.enabled ? 'success' : 'default'} />
          <Button size="small" color="error" onClick={() => unlink(m.mcp_server_id)} disabled={busy}>
            移除
          </Button>
        </Box>
      ))}
      {(assoc?.mcps?.length ?? 0) === 0 && <Box sx={{ color: 'text.secondary' }}>暂无关联 MCP</Box>}
    </Box>
  )
}

// ============ 记忆 ============
function MemoriesTab({ agentId, assoc, onChanged }: { agentId: number; assoc: AgentAssociations | null; onChanged: () => void }) {
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)

  const add = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      await canvasAPI.setMemory(agentId, { name, content, memory_type: 'long_term' })
      setName('')
      setContent('')
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: number) => {
    setBusy(true)
    try {
      await canvasAPI.deleteMemory(agentId, id)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ p: 3, maxWidth: 720 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
        <TextField size="small" label="记忆名称" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField size="small" label="记忆内容" value={content} onChange={(e) => setContent(e.target.value)} multiline rows={3} />
        <Button variant="contained" size="small" onClick={add} disabled={busy || !name.trim()} sx={{ alignSelf: 'flex-start' }}>
          添加记忆
        </Button>
      </Box>

      {(assoc?.memories || []).map((m) => (
        <Box key={m.id} sx={{ p: 1.5, mb: 1, border: '1px solid #eee', borderRadius: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1, fontWeight: 600 }}>{m.name}</Box>
            <Chip label={m.memory_type} size="small" />
            <Button size="small" color="error" onClick={() => remove(m.id)} disabled={busy}>
              删除
            </Button>
          </Box>
          {m.content && <Box sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>{m.content}</Box>}
          <Box sx={{ fontSize: 11, color: 'text.disabled', mt: 0.5 }}>访问 {m.access_count} 次 · 优先级 {m.priority}</Box>
        </Box>
      ))}
      {(assoc?.memories?.length ?? 0) === 0 && <Box sx={{ color: 'text.secondary' }}>暂无记忆</Box>}
    </Box>
  )
}

// ============ 工作流 ============
function WorkflowsTab({ agentId, assoc, onChanged }: { agentId: number; assoc: AgentAssociations | null; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)

  const remove = async (id: number) => {
    setBusy(true)
    try {
      await canvasAPI.deleteWorkflow(agentId, id)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>
        在「对话生成」Tab 中通过自然语言生成工作流，或在画布中设计后保存。
      </Box>

      {(assoc?.workflows || []).map((w) => (
        <Box
          key={w.id}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, mb: 1, border: '1px solid #eee', borderRadius: 1 }}
        >
          <Box sx={{ flex: 1 }}>
            <Box sx={{ fontWeight: 600 }}>{w.name}</Box>
            <Box sx={{ fontSize: 12, color: 'text.secondary' }}>
              {w.description || w.workflow_type} · v{w.version} · 执行 {w.exec_count} 次
            </Box>
          </Box>
          <Chip label={w.status} size="small" color={w.status === 'active' ? 'success' : 'default'} />
          <Button size="small" color="error" onClick={() => remove(w.id)} disabled={busy}>
            删除
          </Button>
        </Box>
      ))}
      {(assoc?.workflows?.length ?? 0) === 0 && <Box sx={{ color: 'text.secondary' }}>暂无工作流</Box>}
    </Box>
  )
}

'use client'

/**
 * Agent 工作室
 * 左:对话创建(引导描述)/ 手动添加
 * 右:Agent 列表(增/改/删/选中)+ 关联图画布(Agent → 技能/工作流/MCP/记忆)
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'

import { agentmAPI, type Agent } from '../api'
import { canvasAPI } from '../canvas/api'
import type { AgentAssociations } from '../canvas/types'
import StudioLayout, { type ChatMessage } from './StudioLayout'
import StudioGraph, { type GraphNode, type GraphEdge } from './StudioGraph'

export default function AgentStudio() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selected, setSelected] = useState<Agent | null>(null)
  const [assoc, setAssoc] = useState<AgentAssociations | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [generating, setGenerating] = useState(false)
  const [editing, setEditing] = useState<Agent | null>(null)

  // 手动表单
  const [mName, setMName] = useState('')
  const [mRole, setMRole] = useState('')
  const [mModel, setMModel] = useState('deepseek-chat')
  const [mDesc, setMDesc] = useState('')
  const [mPrompt, setMPrompt] = useState('')

  const load = useCallback(async () => {
    const list = await agentmAPI.listAgents().catch(() => [] as Agent[])
    setAgents(list || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // 选中 Agent 时加载其关联
  useEffect(() => {
    if (!selected) {
      setAssoc(null)
      return
    }
    canvasAPI.getAssociations(selected.id).then(setAssoc).catch(() => setAssoc(null))
  }, [selected])

  // 对话创建(把自然语言作为描述 + system prompt 种子)
  const handleSend = async (text: string) => {
    setMessages((m) => [...m, { role: 'user', text }])
    setGenerating(true)
    try {
      // 用首行/前 20 字作为名称,整段作为描述与人设种子
      const name = text.split(/[\n,。,.]/)[0].slice(0, 20) || `Agent ${Date.now()}`
      await agentmAPI.createAgent({
        name,
        role: 'assistant',
        role_type: 'general',
        description: text,
        persona: text,
        system_prompt: `你是 ${name}。${text}`,
        model: mModel,
        status: 'draft',
        published: false,
        tags: [],
        capabilities: [],
      })
      setMessages((m) => [...m, { role: 'assistant', text: `✅ 已创建 Agent「${name}」(草稿)。可在右侧选中后进一步完善,或到 Agent 详情页配置画布/技能/工作流。` }])
      await load()
    } catch (e: any) {
      setMessages((m) => [...m, { role: 'assistant', text: `创建失败: ${e.message}` }])
    } finally {
      setGenerating(false)
    }
  }

  // 手动添加 / 保存编辑
  const handleManualSave = async () => {
    if (!mName.trim()) return
    try {
      const payload = {
        name: mName,
        role: mRole || 'assistant',
        model: mModel,
        description: mDesc,
        system_prompt: mPrompt,
      }
      if (editing) {
        await agentmAPI.updateAgent(editing.id, payload)
      } else {
        await agentmAPI.createAgent({ ...payload, role_type: 'general', status: 'draft', published: false, tags: [], capabilities: [] })
      }
      resetManual()
      await load()
    } catch (e: any) {
      alert(`保存失败: ${e.message}`)
    }
  }

  const resetManual = () => {
    setEditing(null)
    setMName('')
    setMRole('')
    setMModel('deepseek-chat')
    setMDesc('')
    setMPrompt('')
  }

  const startEdit = (a: Agent) => {
    setEditing(a)
    setMName(a.name)
    setMRole(a.role ?? '')
    setMModel(a.model ?? 'deepseek-chat')
    setMDesc(a.description ?? '')
    setMPrompt((a as any).system_prompt ?? '')
  }

  const handleDelete = async (a: Agent) => {
    if (!confirm(`删除 Agent「${a.name}」?此操作不可恢复。`)) return
    await agentmAPI.deleteAgent(a.id).catch(() => {})
    if (selected?.id === a.id) setSelected(null)
    await load()
  }

  // 画布:Agent 中心,辐射技能/工作流/MCP/记忆
  const graph = useMemo((): { nodes: GraphNode[]; edges: GraphEdge[] } => {
    if (!selected) return { nodes: [], edges: [] }
    const nodes: GraphNode[] = [
      { id: 'agent', label: selected.name, sub: selected.role, kind: 'agent', x: 320, y: 200 },
    ]
    const edges: GraphEdge[] = []
    const groups: { items: { id: number; name: string }[]; kind: GraphNode['kind']; angle0: number }[] = [
      { items: (assoc?.skills ?? []).map((s) => ({ id: s.skill_id, name: s.skill_name })), kind: 'skill', angle0: -90 },
      { items: (assoc?.workflows ?? []).map((w) => ({ id: w.id, name: w.name })), kind: 'workflow', angle0: 0 },
      { items: (assoc?.mcps ?? []).map((m) => ({ id: m.mcp_server_id, name: m.mcp_server_name })), kind: 'mcp', angle0: 90 },
      { items: (assoc?.memories ?? []).map((m) => ({ id: m.id, name: m.name })), kind: 'memory', angle0: 180 },
    ]
    const R = 220
    groups.forEach((g) => {
      g.items.forEach((item, i) => {
        const angle = ((g.angle0 + i * 30) * Math.PI) / 180
        const nid = `${g.kind}-${item.id}`
        nodes.push({
          id: nid,
          label: item.name || `#${item.id}`,
          sub: g.kind,
          kind: g.kind,
          x: 320 + R * Math.cos(angle),
          y: 200 + R * Math.sin(angle),
        })
        edges.push({ id: `e-${nid}`, source: 'agent', target: nid })
      })
    })
    return { nodes, edges }
  }, [selected, assoc])

  const listPanel = (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>全部 Agent({agents.length})</Typography>
      {agents.length === 0 && <Typography variant="body2" color="text.secondary">暂无 Agent,用左侧对话或手动添加创建。</Typography>}
      {agents.map((a) => (
        <Box
          key={a.id}
          onClick={() => setSelected(a)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1, p: 1, mb: 0.5, borderRadius: 1, cursor: 'pointer',
            border: selected?.id === a.id ? '1.5px solid #1976d2' : '1px solid #eee',
            bgcolor: selected?.id === a.id ? '#e3f2fd' : '#fff',
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{a.name}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {a.role} · {a.model} · 对话 {a.chat_count}
            </Typography>
          </Box>
          <Chip size="small" label={a.status} color={a.status === 'active' ? 'success' : 'default'} />
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); startEdit(a) }}><EditOutlinedIcon fontSize="small" /></IconButton>
          <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDelete(a) }}><DeleteOutlineIcon fontSize="small" /></IconButton>
        </Box>
      ))}
    </Box>
  )

  const manualForm = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="body2" color="text.secondary">{editing ? `编辑「${editing.name}」` : '手动新建 Agent'}</Typography>
      <TextField size="small" label="名称" value={mName} onChange={(e) => setMName(e.target.value)} />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField size="small" label="角色" value={mRole} onChange={(e) => setMRole(e.target.value)} sx={{ flex: 1 }} />
        <TextField size="small" label="模型" value={mModel} onChange={(e) => setMModel(e.target.value)} sx={{ flex: 1 }} />
      </Box>
      <TextField size="small" label="描述" value={mDesc} onChange={(e) => setMDesc(e.target.value)} multiline rows={2} />
      <TextField size="small" label="System Prompt" value={mPrompt} onChange={(e) => setMPrompt(e.target.value)} multiline rows={6} />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button variant="contained" onClick={handleManualSave} disabled={!mName.trim()}>{editing ? '保存修改' : '创建'}</Button>
        {editing && <Button onClick={resetManual}>取消编辑</Button>}
      </Box>
    </Box>
  )

  return (
    <StudioLayout
      title="🤖 Agent 工作室"
      chatPlaceholder="描述你想要的 Agent,例如:一个帮我整理每日新闻摘要并推送的助手"
      generating={generating}
      messages={messages}
      onSend={handleSend}
      manualForm={manualForm}
      listPanel={listPanel}
      graph={<StudioGraph nodes={graph.nodes} edges={graph.edges} emptyHint="选中一个 Agent 查看它的技能/工作流/MCP/记忆关联图" />}
    />
  )
}

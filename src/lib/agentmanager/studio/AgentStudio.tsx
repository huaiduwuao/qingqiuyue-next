'use client'

/**
 * Agent 工作室 —— 关联图编辑
 * 画布即「Agent 关联图」:Agent 居中,技能/MCP/工作流/记忆节点。
 * 从 Agent 节点连一条线到实体节点 = 建立关联;删除该线 = 解除关联。
 * 保存时:先存 Agent 基本信息,再把当前连线 diff 已有关联,批量 link/unlink。
 * 可添加实体(技能/MCP)从全局列表选择加入画布;工作流/记忆为 per-agent,经对话或后续在详情页建。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Tooltip from '@mui/material/Tooltip'

import { agentmAPI, type Agent, type ModelProvider, type Skill } from '../api'
import { agentmExtendedAPI } from '../api-extended'
import { canvasAPI } from '../canvas/api'
import type { AgentAssociations } from '../canvas/types'
import StudioLayout, { type ChatMessage } from './StudioLayout'
import EditableGraph, { type EditableGraphRef, type DraftNode, type DraftEdge } from './EditableGraph'

const NODE_PALETTE = [
  { kind: 'skill', label: '技能' },
  { kind: 'workflow', label: '工作流' },
  { kind: 'mcp', label: 'MCP' },
  { kind: 'memory', label: '记忆' },
]

// 实体节点 id 规则:entityKind-refId,与关联 id 对应
const eid = (kind: string, refId: number) => `${kind}-${refId}`

interface MCPServerLite {
  id: number
  name: string
}

export default function AgentStudio({ editingId = null, onLoaded }: { editingId?: number | null; onLoaded?: (name: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Agent 基本信息草稿
  const [agentId, setAgentId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [role, setRole] = useState('assistant')
  const [model, setModel] = useState('')
  const [providers, setProviders] = useState<ModelProvider[]>([])
  const [desc, setDesc] = useState('')
  const [prompt, setPrompt] = useState('')
  // 2026-08: Hermes 路由开关
  const [routeToHermes, setRouteToHermes] = useState(false)

  // 关联图
  const [assoc, setAssoc] = useState<AgentAssociations | null>(null)
  const [allSkills, setAllSkills] = useState<Skill[]>([])
  const [allMcps, setAllMcps] = useState<MCPServerLite[]>([])
  const [addSkillId, setAddSkillId] = useState<number | ''>('')
  const [addMcpId, setAddMcpId] = useState<number | ''>('')

  const graphRef = useRef<EditableGraphRef>(null)
  const draftRef = useRef<{ nodes: DraftNode[]; edges: DraftEdge[] }>({ nodes: [], edges: [] })

  // 加载模型供应商 + 全局技能/MCP 列表
  useEffect(() => {
    ;(async () => {
      const [llm, cp] = await Promise.all([
        agentmAPI.listModelProviders('llm').catch(() => ({ list: [] as ModelProvider[], total: 0 })),
        agentmAPI.listModelProviders('codingplan').catch(() => ({ list: [] as ModelProvider[], total: 0 })),
      ])
      const all = [...(cp.list || []), ...(llm.list || [])].filter((p) => p.enabled)
      setProviders(all)
      if (!model && all.length) {
        const def = all.find((p) => p.is_default) ?? all[0]
        if (def?.model) setModel(def.model)
      }
      // 全局技能 / MCP
      const sk = await agentmAPI.listSkills().catch(() => ({ list: [] as Skill[], total: 0 }))
      setAllSkills(sk.list || [])
      const mc = await agentmExtendedAPI.listMCPServers().catch(() => ({ list: [] as any[] }))
      setAllMcps((mc.list || []).map((s: any) => ({ id: s.id, name: s.name ?? s.server_name ?? `MCP #${s.id}` })))
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 编辑模式:加载 Agent + 关联,灌入画布
  useEffect(() => {
    if (!editingId) return
    ;(async () => {
      const a = await agentmAPI.getAgentById(editingId).catch(() => null)
      if (!a) return
      const assocData = await canvasAPI.getAssociations(editingId).catch(() => null)
      loadIntoDraft(a, assocData)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId])

  // 把 Agent + 关联灌入画布(Agent 居中,实体环绕,已关联的连线)
  const loadIntoDraft = (a: Agent, assocData: AgentAssociations | null) => {
    setAgentId(a.id)
    setName(a.name)
    onLoaded?.(a.name)
    setRole(a.role ?? 'assistant')
    setModel(a.model ?? '')
    setDesc(a.description ?? '')
    setPrompt((a as any).system_prompt ?? '')
    // 2026-08: 加载 Hermes 路由开关
    setRouteToHermes((a as any).route_to_hermes ?? false)
    setAssoc(assocData)

    const nodes: DraftNode[] = [
      { id: 'agent', label: a.name, sub: a.role, kind: 'agent', x: 360, y: 220, config: { description: a.description, system_prompt: (a as any).system_prompt } },
    ]
    const edges: DraftEdge[] = []
    let angle = -90
    const R = 240
    const place = (kind: string, refId: number, label: string, sub?: string) => {
      const rad = (angle * Math.PI) / 180
      const id = eid(kind, refId)
      nodes.push({
        id,
        label,
        sub: sub ?? kind,
        kind,
        x: 360 + R * Math.cos(rad),
        y: 220 + R * Math.sin(rad),
        config: { refId },
      })
      edges.push({ id: `e-${id}`, source: 'agent', target: id })
      angle += 40
    }
    ;(assocData?.skills ?? []).forEach((s) => place('skill', s.skill_id, s.skill_name, s.skill_category))
    ;(assocData?.mcps ?? []).forEach((m) => place('mcp', m.mcp_server_id, m.mcp_server_name, `${m.mcp_tool_count} 工具`))
    ;(assocData?.workflows ?? []).forEach((w) => place('workflow', w.id, w.name, w.workflow_type))
    ;(assocData?.memories ?? []).forEach((m) => place('memory', m.id, m.name, m.memory_type))

    graphRef.current?.setData(nodes, edges)
    setDirty(false)
  }

  // 对话协助:把需求转成名称/描述/提示词草稿,不落库
  const handleSend = async (text: string) => {
    setMessages((m) => [...m, { role: 'user', text }])
    setGenerating(true)
    try {
      const genName = text.split(/[\n,。.]/)[0].slice(0, 20) || '新 Agent'
      if (!name) setName(genName)
      setDesc(text)
      setPrompt((p) => p || `你是 ${genName}。${text}`)
      // 新建模式还没有关联,先放 Agent 节点
      if (!agentId) {
        graphRef.current?.setData(
          [{ id: 'agent', label: genName, sub: role, kind: 'agent', x: 360, y: 220, config: { description: text, system_prompt: `你是 ${genName}。${text}` } }],
          [],
        )
      }
      setDirty(true)
      setMessages((m) => [...m, { role: 'assistant', text: `已根据描述填好「${genName}」的草稿。在右侧画布连线关联技能/MCP 后点「保存」。` }])
    } finally {
      setGenerating(false)
    }
  }

  // 从全局列表加入实体节点(未连线,用户再连线建立关联)
  const addEntityNode = (kind: string, refId: number, label: string, sub?: string) => {
    const d = graphRef.current?.getData() ?? draftRef.current
    const id = eid(kind, refId)
    if (d.nodes.some((n) => n.id === id)) return // 已在画布
    const nodes = [...d.nodes, { id, label, sub: sub ?? kind, kind, x: 360 + (Math.random() * 320 - 160), y: 60 + Math.random() * 80, config: { refId } }]
    graphRef.current?.setData(nodes, d.edges)
    setDirty(true)
  }

  // 保存:存 Agent 基本信息 + 按连线 diff 关联(link/unlink)
  const handleSave = async () => {
    if (!name.trim()) {
      alert('请填写 Agent 名称')
      return
    }
    setSaving(true)
    try {
      // 1. 存基本信息(从 Agent 节点 config 读描述/Prompt,可能被双击改过)
      const draft = graphRef.current?.getData() ?? draftRef.current
      const agentNode = draft.nodes.find((n) => n.id === 'agent')
      const cfg = agentNode?.config ?? {}
      const payload = {
        name,
        role: role || 'assistant',
        model,
        description: cfg.description ?? desc,
        system_prompt: cfg.system_prompt ?? prompt,
        // 2026-08: Hermes 路由开关
        route_to_hermes: routeToHermes,
      }
      let aid = agentId
      if (aid) {
        await agentmAPI.updateAgent(aid, payload)
      } else {
        const created = await agentmAPI.createAgent({ ...payload, role_type: 'general', status: 'draft', published: false, tags: [], capabilities: [] })
        aid = created.id
        setAgentId(aid)
      }

      // 2. 按连线 diff 关联:画布上 agent→实体 的线 = 期望关联
      if (aid) {
        await syncAssociations(aid, draft)
      }

      setDirty(false)
      setMessages((m) => [...m, { role: 'assistant', text: `✅ Agent「${name}」已保存,关联已同步。` }])
    } catch (e: any) {
      alert(`保存失败: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  // 把画布连线同步到后端关联(link 新增,unlink 移除)
  const syncAssociations = async (aid: number, draft: { nodes: DraftNode[]; edges: DraftEdge[] }) => {
    // 画布上 agent→实体 的关联集合
    const want = { skill: new Set<number>(), mcp: new Set<number>() }
    draft.edges.forEach((e) => {
      if (e.source !== 'agent') return
      const node = draft.nodes.find((n) => n.id === e.target)
      if (!node?.config?.refId) return
      if (node.kind === 'skill') want.skill.add(node.config.refId)
      if (node.kind === 'mcp') want.mcp.add(node.config.refId)
    })
    // 已有关联
    const have = {
      skill: new Set((assoc?.skills ?? []).map((s) => s.skill_id)),
      mcp: new Set((assoc?.mcps ?? []).map((m) => m.mcp_server_id)),
    }
    // link:想要但没有
    for (const id of want.skill) if (!have.skill.has(id)) await canvasAPI.linkSkill(aid, id).catch(() => {})
    for (const id of want.mcp) if (!have.mcp.has(id)) await canvasAPI.linkMCP(aid, id).catch(() => {})
    // unlink:有但不想要
    for (const id of have.skill) if (!want.skill.has(id)) await canvasAPI.unlinkSkill(aid, id).catch(() => {})
    for (const id of have.mcp) if (!want.mcp.has(id)) await canvasAPI.unlinkMCP(aid, id).catch(() => {})
    // 刷新关联快照
    const fresh = await canvasAPI.getAssociations(aid).catch(() => null)
    setAssoc(fresh)
  }

  const markDirty = useCallback((nodes: DraftNode[], edges: DraftEdge[]) => {
    draftRef.current = { nodes, edges }
    setDirty(true)
  }, [])

  // 画布上方:名称/角色/绑定模型 + 添加技能/MCP + 保存
  const propBar = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', flex: '0 0 auto' }}>
      <TextField size="small" label="名称" value={name} onChange={(e) => { setName(e.target.value); setDirty(true) }} sx={{ minWidth: 130 }} />
      <TextField size="small" label="角色" value={role} onChange={(e) => { setRole(e.target.value); setDirty(true) }} sx={{ minWidth: 100 }} />
      <TextField select size="small" label="绑定模型" value={model} onChange={(e) => { setModel(e.target.value); setDirty(true) }} sx={{ minWidth: 170 }}>
        {providers.map((p) => (
          <MenuItem key={p.id} value={p.model}>{p.name} · {p.model}{p.is_default ? ' (默认)' : ''}</MenuItem>
        ))}
        {model && !providers.some((p) => p.model === model) && <MenuItem value={model}>{model}(当前)</MenuItem>}
      </TextField>

      {/* 添加技能 / MCP 到画布(再连线建立关联) */}
      <TextField select size="small" label="+ 技能" value={addSkillId} onChange={(e) => {
        const id = Number(e.target.value)
        const s = allSkills.find((x) => x.id === id)
        if (s) addEntityNode('skill', s.id, s.name, s.category)
        setAddSkillId('')
      }} sx={{ minWidth: 130 }}>
        <MenuItem value=""><em>选技能…</em></MenuItem>
        {allSkills.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
      </TextField>
      <TextField select size="small" label="+ MCP" value={addMcpId} onChange={(e) => {
        const id = Number(e.target.value)
        const s = allMcps.find((x) => x.id === id)
        if (s) addEntityNode('mcp', s.id, s.name, 'MCP')
        setAddMcpId('')
      }} sx={{ minWidth: 130 }}>
        <MenuItem value=""><em>选 MCP…</em></MenuItem>
        {allMcps.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
      </TextField>

      {/* 2026-08: Hermes 路由开关 */}
      <Tooltip title="开启后,数字人对话时走 Hermes dashboard(可使用 Hermes Skills)">
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={routeToHermes}
              onChange={(e) => { setRouteToHermes(e.target.checked); setDirty(true) }}
            />
          }
          label={
            <Chip
              size="small"
              label="Hermes"
              icon={<span style={{ fontSize: 12 }}>🤖</span>}
              color={routeToHermes ? 'primary' : 'default'}
              variant={routeToHermes ? 'filled' : 'outlined'}
            />
          }
          sx={{ ml: 1 }}
        />
      </Tooltip>

      {dirty && <Chip size="small" label="未保存" color="warning" variant="outlined" />}
      <Button size="small" variant="contained" onClick={handleSave} disabled={saving || !name.trim()}>
        {saving ? '保存中…' : agentId ? '💾 保存修改' : '💾 保存 Agent'}
      </Button>
    </Box>
  )

  return (
    <StudioLayout
      title="🤖 Agent 工作室"
      chatPlaceholder="描述你想要的 Agent,例如:一个帮我整理每日新闻摘要并推送的助手"
      generating={generating}
      messages={messages}
      onSend={handleSend}
      listPanel={null}
      showList={false}
      graph={
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 1 }}>
          {propBar}
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <EditableGraph
              ref={graphRef}
              palette={NODE_PALETTE}
              onChange={markDirty}
              emptyHint="对话生成 Agent 节点后,从上方加技能/MCP,再从 Agent 节点拖线连到它们即关联;改完点「保存」"
            />
          </Box>
        </Box>
      }
    />
  )
}

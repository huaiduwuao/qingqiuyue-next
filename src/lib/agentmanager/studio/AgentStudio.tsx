'use client'

/**
 * Agent 工作室
 * 对话只是协助:生成的名称/描述/提示词先进表单与画布草稿,
 * 用户修改后点「保存」才落库。画布(Agent 关联结构)可编辑。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'

import { agentmAPI, type Agent, type ModelProvider } from '../api'
import StudioLayout, { type ChatMessage } from './StudioLayout'
import EditableGraph, { type EditableGraphRef, type DraftNode, type DraftEdge } from './EditableGraph'

const NODE_PALETTE = [
  { kind: 'agent', label: 'Agent' },
  { kind: 'skill', label: '技能' },
  { kind: 'workflow', label: '工作流' },
  { kind: 'mcp', label: 'MCP' },
  { kind: 'memory', label: '记忆' },
]

export default function AgentStudio({ editingId = null, onLoaded }: { editingId?: number | null; onLoaded?: (name: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // 草稿
  const [agentId, setAgentId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [role, setRole] = useState('assistant')
  const [model, setModel] = useState('')
  const [providers, setProviders] = useState<ModelProvider[]>([])
  const [desc, setDesc] = useState('')
  const [prompt, setPrompt] = useState('')
  const graphRef = useRef<EditableGraphRef>(null)
  const draftRef = useRef<{ nodes: DraftNode[]; edges: DraftEdge[] }>({ nodes: [], edges: [] })

  // 加载可用模型供应商(llm/codingplan),供 Agent 绑定
  useEffect(() => {
    ;(async () => {
      const [llm, cp] = await Promise.all([
        agentmAPI.listModelProviders('llm').catch(() => ({ list: [] as ModelProvider[], total: 0 })),
        agentmAPI.listModelProviders('codingplan').catch(() => ({ list: [] as ModelProvider[], total: 0 })),
      ])
      const all = [...(cp.list || []), ...(llm.list || [])].filter((p) => p.enabled)
      setProviders(all)
      // 默认选默认供应商的模型
      if (!model && all.length) {
        const def = all.find((p) => p.is_default) ?? all[0]
        if (def?.model) setModel(def.model)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 编辑模式:按 id 拉 Agent 灌入草稿
  useEffect(() => {
    if (!editingId) return
    ;(async () => {
      const a = await agentmAPI.getAgentById(editingId).catch(() => null)
      if (a) loadIntoDraft(a)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId])

  const loadIntoDraft = (a: Agent) => {
    setAgentId(a.id)
    setName(a.name)
    onLoaded?.(a.name)
    setRole(a.role ?? 'assistant')
    setModel(a.model ?? '')
    setDesc(a.description ?? '')
    setPrompt((a as any).system_prompt ?? '')
    graphRef.current?.setData(
      [{ id: 'agent', label: a.name, sub: a.role, kind: 'agent', x: 320, y: 200, config: {} }],
      [],
    )
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
      graphRef.current?.setData(
        [{ id: 'agent', label: genName, sub: role, kind: 'agent', x: 320, y: 200, config: {} }],
        [],
      )
      setDirty(true)
      setMessages((m) => [...m, { role: 'assistant', text: `已根据描述填好「${genName}」的草稿(名称/描述/提示词),并在画布放入 Agent 节点。请完善后点「保存」。` }])
    } finally {
      setGenerating(false)
    }
  }

  // 保存:新建 create / 编辑 update
  const handleSave = async () => {
    if (!name.trim()) {
      alert('请填写 Agent 名称')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name,
        role: role || 'assistant',
        model,
        description: desc,
        system_prompt: prompt,
      }
      if (agentId) {
        await agentmAPI.updateAgent(agentId, payload)
      } else {
        const created = await agentmAPI.createAgent({ ...payload, role_type: 'general', status: 'draft', published: false, tags: [], capabilities: [] })
        setAgentId(created.id)
      }
      setDirty(false)
      setMessages((m) => [...m, { role: 'assistant', text: `✅ Agent「${name}」已保存(草稿)。可到 Agent 详情页配置画布/技能/工作流。` }])
    } catch (e: any) {
      alert(`保存失败: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const markDirty = useCallback((nodes: DraftNode[], edges: DraftEdge[]) => {
    draftRef.current = { nodes, edges }
    setDirty(true)
  }, [])

  // 画布上方:名称/角色/绑定模型 + 保存;描述/SystemPrompt 双击 Agent 节点编辑(存节点 config)
  const propBar = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', flex: '0 0 auto' }}>
      <TextField size="small" label="名称" value={name} onChange={(e) => { setName(e.target.value); setDirty(true) }} sx={{ minWidth: 140 }} />
      <TextField size="small" label="角色" value={role} onChange={(e) => { setRole(e.target.value); setDirty(true) }} sx={{ minWidth: 110 }} />
      <TextField
        select
        size="small"
        label="绑定模型"
        value={model}
        onChange={(e) => { setModel(e.target.value); setDirty(true) }}
        sx={{ minWidth: 190 }}
      >
        {providers.map((p) => (
          <MenuItem key={p.id} value={p.model}>
            {p.name} · {p.model}{p.is_default ? ' (默认)' : ''}
          </MenuItem>
        ))}
        {model && !providers.some((p) => p.model === model) && (
          <MenuItem value={model}>{model}(当前)</MenuItem>
        )}
      </TextField>
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
              emptyHint="用左侧对话生成草稿,或点上方按钮添加关联节点;双击 Agent 节点改描述/Prompt,改完点「保存」"
            />
          </Box>
        </Box>
      }
    />
  )
}

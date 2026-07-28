'use client'

/**
 * 工作流工作室
 * 对话只是协助:生成的结果先进画布草稿,用户在画布上主动修改,
 * 点「保存」才落库。不会一句对话就直接创建。
 * 画布可编辑:拖动 / 增删节点 / 连线 / 双击改节点配置。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'

import { agentmAPI, type Agent } from '../api'
import { canvasAPI } from '../canvas/api'
import type { AgentWorkflowInfo, WorkflowType, WorkflowResult } from '../canvas/types'
import StudioLayout, { type ChatMessage } from './StudioLayout'
import EditableGraph, { type EditableGraphRef, type DraftNode, type DraftEdge } from './EditableGraph'

const TYPE_LABEL: Record<WorkflowType, string> = {
  sequential: '顺序',
  parallel: '并行',
  conditional: '条件',
  plan_execute: '规划执行',
}

const NODE_PALETTE = [
  { kind: 'start', label: '开始' },
  { kind: 'step', label: '步骤' },
  { kind: 'agent', label: 'Agent' },
  { kind: 'skill', label: '技能' },
  { kind: 'mcp', label: 'MCP' },
  { kind: 'condition', label: '条件' },
  { kind: 'end', label: '结束' },
]

export default function WorkflowStudio({ editingId = null }: { editingId?: number | null }) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [targetAgentId, setTargetAgentId] = useState<number | ''>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // 草稿(表单 + 画布共享)
  const [wfId, setWfId] = useState<number | null>(null) // 编辑已有工作流时的 id
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [wtype, setWtype] = useState<WorkflowType>('sequential')
  const graphRef = useRef<EditableGraphRef>(null)
  const draftRef = useRef<{ nodes: DraftNode[]; edges: DraftEdge[] }>({ nodes: [], edges: [] })

  // 加载 Agent 列表
  useEffect(() => {
    agentmAPI.listAgents().then((ags) => {
      setAgents(ags || [])
      if (ags?.length) setTargetAgentId((cur) => (cur === '' ? ags[0].id : cur))
    }).catch(() => {})
  }, [])

  // 编辑模式:按 id 拉该工作流灌入草稿
  useEffect(() => {
    if (!editingId || !agents.length) return
    ;(async () => {
      for (const a of agents) {
        try {
          const wfs = await canvasAPI.listWorkflows(a.id)
          const found = (wfs || []).find((w) => w.id === editingId)
          if (found) {
            loadIntoDraft(found, a.id)
            return
          }
        } catch {
          /* ignore */
        }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, agents])

  // 把已有工作流灌入草稿
  const loadIntoDraft = (w: AgentWorkflowInfo, agentId: number) => {
    setWfId(w.id)
    setTargetAgentId(agentId)
    setName(w.name)
    setDesc(w.description ?? '')
    setWtype(w.workflow_type)
    let def: any = {}
    try {
      def = JSON.parse(w.workflow_json || '{}')
    } catch {
      def = {}
    }
    const nodes: DraftNode[] = (def.nodes ?? []).map((n: any, i: number) => ({
      id: String(n.id ?? `n${i}`),
      label: n.name ?? n.label ?? String(n.id ?? `节点${i}`),
      sub: n.type,
      kind: n.type ?? 'step',
      x: n.position?.x ?? 80 + (i % 3) * 200,
      y: n.position?.y ?? 60 + Math.floor(i / 3) * 120,
      config: n.config ?? {},
    }))
    const edges: DraftEdge[] = (def.edges ?? []).map((e: any, i: number) => ({
      id: String(e.id ?? `e${i}`),
      source: String(e.source),
      target: String(e.target),
      label: e.condition ?? e.label,
    }))
    graphRef.current?.setData(nodes, edges)
    setDirty(false)
  }

  // 对话生成/修改:把当前画布草稿一并传给 LLM,让它基于现有画布按指令修改;结果只灌草稿,不落库
  const handleSend = async (text: string) => {
    setMessages((m) => [...m, { role: 'user', text }])
    setGenerating(true)
    try {
      const agent = agents.find((a) => a.id === targetAgentId)
      const ctx = agent ? `Agent名称: ${agent.name}\n描述: ${agent.description ?? ''}` : undefined
      // 当前画布(已有节点/边)传给后端,LLM 在其基础上修改 → 实现「连线下所有节点」这类操作
      const draft = graphRef.current?.getData() ?? draftRef.current
      const currentCanvas = draft.nodes.length
        ? {
            nodes: draft.nodes.map((n) => ({ id: n.id, type: n.kind ?? 'step', name: n.label, config: n.config ?? {}, position: { x: n.x, y: n.y } })),
            edges: draft.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, condition: e.label })),
          }
        : undefined
      const result: WorkflowResult = await canvasAPI.generateWorkflow(text, ctx, currentCanvas)
      if (result.success) {
        // 灌入草稿,用户确认后再保存
        setName(result.name)
        setDesc(result.description)
        setWtype(result.workflow_type)
        const nodes: DraftNode[] = (result.nodes ?? []).map((n, i) => ({
          id: String(n.id ?? `n${i}`),
          label: n.name ?? String(n.id ?? `节点${i}`),
          sub: n.type,
          kind: n.type ?? 'step',
          x: n.position?.x ?? 80 + (i % 3) * 200,
          y: n.position?.y ?? 60 + Math.floor(i / 3) * 120,
          config: (n as any).config ?? {},
        }))
        const edges: DraftEdge[] = (result.edges ?? []).map((e: any, i: number) => ({
          id: String(e.id ?? `e${i}`),
          source: String(e.source),
          target: String(e.target),
          label: e.condition ?? e.label,
        }))
        graphRef.current?.setData(nodes, edges)
        setDirty(true)
        setMessages((m) => [...m, { role: 'assistant', text: `已生成草稿「${result.name}」(${nodes.length} 节点 / ${edges.length} 边),已放到右侧画布。请在画布上调整,确认后点「保存」。` }])
      } else {
        setMessages((m) => [...m, { role: 'assistant', text: `生成失败: ${result.error ?? '未知错误'}` }])
      }
    } catch (e: any) {
      setMessages((m) => [...m, { role: 'assistant', text: `生成失败: ${e.message}` }])
    } finally {
      setGenerating(false)
    }
  }

  // 保存:新建 create / 编辑 update,只有点了才落库
  const handleSave = async () => {
    if (!name.trim()) {
      alert('请填写工作流名称')
      return
    }
    if (!targetAgentId) {
      alert('请选择目标 Agent(工作流需关联到某个 Agent)')
      return
    }
    const draft = graphRef.current?.getData() ?? draftRef.current
    if (!draft.nodes.length) {
      alert('画布还是空的,先用对话生成或手动添加节点')
      return
    }
    setSaving(true)
    try {
      const workflow_json = JSON.stringify({
        nodes: draft.nodes.map((n) => ({
          id: n.id,
          type: n.kind ?? 'step',
          name: n.label,
          config: n.config ?? {},
          position: { x: n.x, y: n.y },
        })),
        edges: draft.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          condition: e.label,
        })),
      })
      if (wfId) {
        await canvasAPI.updateWorkflow(targetAgentId, wfId, {
          name,
          description: desc,
          workflow_json,
          workflow_type: wtype,
        })
      } else {
        const created = await canvasAPI.createWorkflow(targetAgentId, {
          name,
          description: desc,
          workflow_json,
          workflow_type: wtype,
        })
        setWfId(created.id)
      }
      setDirty(false)
      setMessages((m) => [...m, { role: 'assistant', text: `✅ 工作流「${name}」已保存。` }])
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

  const agentSelector = (
    <TextField
      select
      size="small"
      label="目标 Agent"
      value={targetAgentId}
      onChange={(e) => setTargetAgentId(Number(e.target.value))}
      sx={{ minWidth: 170 }}
    >
      {agents.map((a) => (
        <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
      ))}
    </TextField>
  )

  // 左侧面板:名称/描述/类型 + 保存(对话协助 + 表单共用一份草稿)
  const manualForm = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="body2" color="text.secondary">
        {wfId ? `编辑工作流 #${wfId}` : '新工作流草稿'}
        {dirty && <Chip size="small" label="未保存" color="warning" sx={{ ml: 1 }} />}
      </Typography>
      <TextField size="small" label="名称" value={name} onChange={(e) => { setName(e.target.value); setDirty(true) }} />
      <TextField size="small" label="描述" value={desc} onChange={(e) => { setDesc(e.target.value); setDirty(true) }} multiline rows={2} />
      <TextField select size="small" label="类型" value={wtype} onChange={(e) => { setWtype(e.target.value as WorkflowType); setDirty(true) }}>
        {Object.entries(TYPE_LABEL).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
      </TextField>
      <Typography variant="caption" color="text.disabled">
        结构(节点/连线)在右侧画布上编辑;双击节点可改名称与配置。
      </Typography>
      <Button variant="contained" onClick={handleSave} disabled={saving || !name.trim()}>
        {saving ? '保存中…' : wfId ? '💾 保存修改' : '💾 保存工作流'}
      </Button>
    </Box>
  )

  return (
    <StudioLayout
      title="🔀 工作流工作室"
      chatPlaceholder="描述工作流,例如:先搜索最新新闻,再总结成摘要,最后发邮件通知"
      generating={generating}
      messages={messages}
      onSend={handleSend}
      manualForm={manualForm}
      listPanel={null}
      showList={false}
      graph={
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: '0 0 auto' }}>
            {agentSelector}
            <Box sx={{ flex: 1 }} />
            {dirty && <Chip size="small" label="有未保存修改" color="warning" variant="outlined" />}
            <Button size="small" variant="contained" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? '保存中…' : '💾 保存'}
            </Button>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <EditableGraph
              ref={graphRef}
              palette={NODE_PALETTE}
              onChange={markDirty}
              emptyHint="用左侧对话生成草稿,或点上方按钮手动添加节点;改完点「保存」"
            />
          </Box>
        </Box>
      }
    />
  )
}

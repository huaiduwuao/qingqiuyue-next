'use client'

/**
 * 工作流工作室
 * 左:对话生成(generateWorkflow)/ 手动添加
 * 右:跨 Agent 工作流列表(增/改/删/选中)+ 节点流程图画布
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import IconButton from '@mui/material/IconButton'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'

import { agentmAPI, type Agent } from '../api'
import { canvasAPI } from '../canvas/api'
import type { AgentWorkflowInfo, WorkflowType, WorkflowResult } from '../canvas/types'
import StudioLayout, { type ChatMessage } from './StudioLayout'
import StudioGraph, { type GraphNode, type GraphEdge } from './StudioGraph'

const TYPE_LABEL: Record<WorkflowType, string> = {
  sequential: '顺序',
  parallel: '并行',
  conditional: '条件',
  plan_execute: '规划执行',
}

interface Row extends AgentWorkflowInfo {
  agent_name: string
}

export default function WorkflowStudio({ editingId = null }: { editingId?: number | null }) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [targetAgentId, setTargetAgentId] = useState<number | ''>('')
  const [rows, setRows] = useState<Row[]>([])
  const [selected, setSelected] = useState<Row | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [generating, setGenerating] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)

  // 手动表单
  const [mName, setMName] = useState('')
  const [mDesc, setMDesc] = useState('')
  const [mType, setMType] = useState<WorkflowType>('sequential')
  const [mJson, setMJson] = useState('{\n  "nodes": [],\n  "edges": []\n}')

  // 加载 Agent 列表 + 全部工作流
  const load = useCallback(async () => {
    const ags = await agentmAPI.listAgents().catch(() => [] as Agent[])
    setAgents(ags || [])
    if (!targetAgentId && ags?.length) setTargetAgentId(ags[0].id)
    const grouped = await Promise.all(
      (ags || []).map(async (a) => {
        try {
          const wfs = await canvasAPI.listWorkflows(a.id)
          return (wfs || []).map((w) => ({ ...w, agent_name: a.name }))
        } catch {
          return [] as Row[]
        }
      }),
    )
    setRows(grouped.flat())
  }, [targetAgentId])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 编辑模式:列表点「编辑」带 id 进入,rows 就绪后自动预填表单并选中(画布显示该工作流)
  useEffect(() => {
    if (!editingId || rows.length === 0) return
    const target = rows.find((r) => r.id === editingId)
    if (target) {
      startEdit(target)
      setSelected(target)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, rows])

  // 对话生成
  const handleSend = async (text: string) => {
    setMessages((m) => [...m, { role: 'user', text }])
    if (!targetAgentId) {
      setMessages((m) => [...m, { role: 'assistant', text: '请先在右上角选择一个目标 Agent,工作流需要关联到某个 Agent。' }])
      return
    }
    setGenerating(true)
    try {
      const agent = agents.find((a) => a.id === targetAgentId)
      const ctx = agent ? `Agent名称: ${agent.name}\n描述: ${agent.description ?? ''}` : undefined
      const result: WorkflowResult = await canvasAPI.generateWorkflow(text, ctx)
      if (result.success) {
        await canvasAPI.createWorkflow(targetAgentId, {
          name: result.name,
          description: result.description,
          workflow_json: JSON.stringify({ nodes: result.nodes, edges: result.edges }),
          workflow_type: result.workflow_type,
        })
        setMessages((m) => [...m, { role: 'assistant', text: `✅ 已生成并保存工作流「${result.name}」(${result.nodes?.length ?? 0} 节点 / ${result.edges?.length ?? 0} 边),关联到 ${agent?.name ?? 'Agent'}。` }])
        await load()
      } else {
        setMessages((m) => [...m, { role: 'assistant', text: `生成失败: ${result.error ?? '未知错误'}` }])
      }
    } catch (e: any) {
      setMessages((m) => [...m, { role: 'assistant', text: `生成失败: ${e.message}` }])
    } finally {
      setGenerating(false)
    }
  }

  // 手动添加 / 保存编辑
  const handleManualSave = async () => {
    if (!mName.trim()) return
    let parsed: any
    try {
      parsed = JSON.parse(mJson)
    } catch {
      alert('workflow_json 不是合法 JSON')
      return
    }
    try {
      if (editing) {
        await canvasAPI.updateWorkflow(editing.agent_id, editing.id, {
          name: mName,
          description: mDesc,
          workflow_json: mJson,
          workflow_type: mType,
        })
      } else {
        if (!targetAgentId) {
          alert('请先选择目标 Agent')
          return
        }
        await canvasAPI.createWorkflow(targetAgentId, {
          name: mName,
          description: mDesc,
          workflow_json: JSON.stringify(parsed),
          workflow_type: mType,
        })
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
    setMDesc('')
    setMType('sequential')
    setMJson('{\n  "nodes": [],\n  "edges": []\n}')
  }

  const startEdit = (r: Row) => {
    setEditing(r)
    setMName(r.name)
    setMDesc(r.description ?? '')
    setMType(r.workflow_type)
    setMJson(r.workflow_json || '{\n  "nodes": [],\n  "edges": []\n}')
  }

  const handleDelete = async (r: Row) => {
    if (!confirm(`删除工作流「${r.name}」?`)) return
    await canvasAPI.deleteWorkflow(r.agent_id, r.id).catch(() => {})
    if (selected?.id === r.id) setSelected(null)
    await load()
  }

  // 画布:把选中工作流的 nodes/edges 映射成图
  const graph = useMemo((): { nodes: GraphNode[]; edges: GraphEdge[] } => {
    if (!selected) return { nodes: [], edges: [] }
    let def: any = {}
    try {
      def = JSON.parse(selected.workflow_json || '{}')
    } catch {
      def = {}
    }
    const ns: any[] = def.nodes ?? []
    const es: any[] = def.edges ?? []
    const nodes: GraphNode[] = ns.map((n, i) => ({
      id: String(n.id ?? `n${i}`),
      label: n.name ?? n.label ?? String(n.id ?? `节点${i}`),
      sub: n.type,
      kind: i === 0 ? 'start' : i === ns.length - 1 ? 'end' : 'step',
      x: n.position?.x ?? 80 + (i % 3) * 200,
      y: n.position?.y ?? 60 + Math.floor(i / 3) * 120,
    }))
    const edges: GraphEdge[] = es.map((e, i) => ({
      id: String(e.id ?? `e${i}`),
      source: String(e.source),
      target: String(e.target),
      label: e.condition ?? e.label,
    }))
    return { nodes, edges }
  }, [selected])

  // 目标 Agent 选择器(新建/对话生成时用)
  const agentSelector = (
    <TextField
      select
      size="small"
      label="目标 Agent"
      value={targetAgentId}
      onChange={(e) => setTargetAgentId(Number(e.target.value))}
      sx={{ minWidth: 180 }}
    >
      {agents.map((a) => (
        <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
      ))}
    </TextField>
  )

  const listPanel = (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>全部工作流({rows.length})</Typography>
        {agentSelector}
      </Box>
      {rows.length === 0 && <Typography variant="body2" color="text.secondary">暂无工作流,用左侧对话或手动添加创建。</Typography>}
      {rows.map((r) => (
        <Box
          key={`${r.agent_id}-${r.id}`}
          onClick={() => setSelected(r)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1, p: 1, mb: 0.5, borderRadius: 1, cursor: 'pointer',
            border: selected?.id === r.id ? '1.5px solid #1976d2' : '1px solid #eee',
            bgcolor: selected?.id === r.id ? '#e3f2fd' : '#fff',
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{r.name}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {r.agent_name} · {TYPE_LABEL[r.workflow_type] ?? r.workflow_type} · v{r.version} · 执行 {r.exec_count}
            </Typography>
          </Box>
          <Chip size="small" label={r.status} color={r.status === 'active' ? 'success' : 'default'} />
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); startEdit(r) }}><EditOutlinedIcon fontSize="small" /></IconButton>
          <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDelete(r) }}><DeleteOutlineIcon fontSize="small" /></IconButton>
        </Box>
      ))}
    </Box>
  )

  const manualForm = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="body2" color="text.secondary">{editing ? `编辑「${editing.name}」` : '手动新建工作流'}</Typography>
      <TextField size="small" label="名称" value={mName} onChange={(e) => setMName(e.target.value)} />
      <TextField size="small" label="描述" value={mDesc} onChange={(e) => setMDesc(e.target.value)} />
      <TextField select size="small" label="类型" value={mType} onChange={(e) => setMType(e.target.value as WorkflowType)}>
        {Object.entries(TYPE_LABEL).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
      </TextField>
      <TextField size="small" label="workflow_json (nodes/edges)" value={mJson} onChange={(e) => setMJson(e.target.value)} multiline rows={10} slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 12 } } }} />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button variant="contained" onClick={handleManualSave} disabled={!mName.trim()}>{editing ? '保存修改' : '创建'}</Button>
        {editing && <Button onClick={resetManual}>取消编辑</Button>}
      </Box>
    </Box>
  )

  // 编辑或新建某条时隐藏右侧全部列表,只留画布;画布上方保留目标 Agent 选择与当前项提示
  const inDetail = editing !== null || editingId !== null

  return (
    <StudioLayout
      title="🔀 工作流工作室"
      chatPlaceholder="描述工作流,例如:先搜索最新新闻,再总结成摘要,最后发邮件通知"
      generating={generating}
      messages={messages}
      onSend={handleSend}
      manualForm={manualForm}
      listPanel={listPanel}
      showList={!inDetail}
      graph={
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 1 }}>
          {inDetail && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: '0 0 auto' }}>
              {!editing && agentSelector}
              {selected && (
                <Typography variant="body2" color="text.secondary">
                  当前:{selected.name}({selected.agent_name})
                </Typography>
              )}
            </Box>
          )}
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <StudioGraph nodes={graph.nodes} edges={graph.edges} emptyHint="选中一个工作流查看流程图,或用左侧创建一个" />
          </Box>
        </Box>
      }
    />
  )
}

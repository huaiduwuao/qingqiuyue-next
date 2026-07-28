'use client'

/**
 * 技能工作室
 * 左:对话生成(generateSkill)/ 手动添加
 * 右:技能列表(增/改/删/选中)+ 「输入→处理→输出」节点图画布
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

import { agentmAPI, type Skill } from '../api'
import { canvasAPI } from '../canvas/api'
import type { SkillResult, SkillKind } from '../canvas/types'
import StudioLayout, { type ChatMessage } from './StudioLayout'
import StudioGraph, { type GraphNode, type GraphEdge } from './StudioGraph'

const KIND_LABEL: Record<SkillKind, string> = {
  tool: '工具',
  prompt: '提示词',
  mcp: 'MCP',
  pipeline: '管道',
}

const CATEGORIES = ['图像/视觉处理', '内容生成/写作', '数据/信息处理', '其他']

export default function SkillStudio({ editingId = null }: { editingId?: number | null }) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [selected, setSelected] = useState<Skill | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [generating, setGenerating] = useState(false)
  // 对话创建固定按「工具」类型生成,不再让用户选
  const genKind: SkillKind = 'tool'
  const [editing, setEditing] = useState<Skill | null>(null)

  // 手动表单
  const [mName, setMName] = useState('')
  const [mDesc, setMDesc] = useState('')
  const [mCategory, setMCategory] = useState(CATEGORIES[0])
  const [mConfig, setMConfig] = useState('{}')

  const load = useCallback(async () => {
    const res = await agentmAPI.listSkills().catch(() => ({ list: [] as Skill[], total: 0 }))
    setSkills(res.list || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // 编辑模式:带 id 进入,skills 就绪后自动预填表单并选中(画布显示该技能)
  useEffect(() => {
    if (!editingId || skills.length === 0) return
    const target = skills.find((s) => s.id === editingId)
    if (target) {
      startEdit(target)
      setSelected(target)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, skills])

  // 对话生成
  const handleSend = async (text: string) => {
    setMessages((m) => [...m, { role: 'user', text }])
    setGenerating(true)
    try {
      const result: SkillResult = await canvasAPI.generateSkill(text, genKind)
      if (result.success) {
        await agentmAPI.createSkill({
          name: result.name,
          description: result.description,
          category: result.category || '其他',
          tags: [],
          config: (result as any).config ?? {},
        } as Partial<Skill>)
        setMessages((m) => [...m, { role: 'assistant', text: `✅ 已生成并保存技能「${result.name}」(${KIND_LABEL[genKind]} · ${result.category})。` }])
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
    let config: any = {}
    try {
      config = JSON.parse(mConfig || '{}')
    } catch {
      alert('config 不是合法 JSON')
      return
    }
    try {
      if (editing) {
        await agentmAPI.updateSkill(editing.id, { name: mName, description: mDesc, category: mCategory, config })
      } else {
        await agentmAPI.createSkill({ name: mName, description: mDesc, category: mCategory, tags: [], config } as Partial<Skill>)
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
    setMCategory(CATEGORIES[0])
    setMConfig('{}')
  }

  const startEdit = (s: Skill) => {
    setEditing(s)
    setMName(s.name)
    setMDesc(s.description ?? '')
    setMCategory(s.category || CATEGORIES[0])
    setMConfig(JSON.stringify(s.config ?? {}, null, 2))
  }

  const handleDelete = async (s: Skill) => {
    if (!confirm(`删除技能「${s.name}」?`)) return
    await agentmAPI.deleteSkill(s.id).catch(() => {})
    if (selected?.id === s.id) setSelected(null)
    await load()
  }

  // 画布:输入 → 技能处理 → 输出
  const graph = useMemo((): { nodes: GraphNode[]; edges: GraphEdge[] } => {
    if (!selected) return { nodes: [], edges: [] }
    const nodes: GraphNode[] = [
      { id: 'input', label: '输入', sub: '请求参数', kind: 'io', x: 60, y: 120 },
      { id: 'skill', label: selected.name, sub: selected.category, kind: 'skill', x: 300, y: 100 },
      { id: 'output', label: '输出', sub: '处理结果', kind: 'io', x: 540, y: 120 },
    ]
    const edges: GraphEdge[] = [
      { id: 'e1', source: 'input', target: 'skill' },
      { id: 'e2', source: 'skill', target: 'output' },
    ]
    return { nodes, edges }
  }, [selected])

  const listPanel = (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>全部技能({skills.length})</Typography>
      {skills.length === 0 && <Typography variant="body2" color="text.secondary">暂无技能,用左侧对话或手动添加创建。</Typography>}
      {skills.map((s) => (
        <Box
          key={s.id}
          onClick={() => setSelected(s)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1, p: 1, mb: 0.5, borderRadius: 1, cursor: 'pointer',
            border: selected?.id === s.id ? '1.5px solid #7b1fa2' : '1px solid #eee',
            bgcolor: selected?.id === s.id ? '#f3e5f5' : '#fff',
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{s.name}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {s.category} · 使用 {s.usage_count} 次
            </Typography>
          </Box>
          <Chip size="small" label={s.status} color={s.status === 'published' ? 'success' : 'default'} />
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); startEdit(s) }}><EditOutlinedIcon fontSize="small" /></IconButton>
          <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDelete(s) }}><DeleteOutlineIcon fontSize="small" /></IconButton>
        </Box>
      ))}
    </Box>
  )

  const manualForm = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="body2" color="text.secondary">{editing ? `编辑「${editing.name}」` : '手动新建技能'}</Typography>
      <TextField size="small" label="名称" value={mName} onChange={(e) => setMName(e.target.value)} />
      <TextField size="small" label="描述" value={mDesc} onChange={(e) => setMDesc(e.target.value)} multiline rows={2} />
      <TextField select size="small" label="分类" value={mCategory} onChange={(e) => setMCategory(e.target.value)}>
        {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
      </TextField>
      <TextField size="small" label="config (JSON)" value={mConfig} onChange={(e) => setMConfig(e.target.value)} multiline rows={8} slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 12 } } }} />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button variant="contained" onClick={handleManualSave} disabled={!mName.trim()}>{editing ? '保存修改' : '创建'}</Button>
        {editing && <Button onClick={resetManual}>取消编辑</Button>}
      </Box>
    </Box>
  )

  // 编辑或新建某条时隐藏右侧全部列表,只留画布
  const inDetail = editing !== null || editingId !== null

  return (
    <StudioLayout
      title="⚡ 技能工作室"
      chatPlaceholder="描述技能,例如:一个能查询天气并返回温度信息的工具"
      generating={generating}
      messages={messages}
      onSend={handleSend}
      manualForm={manualForm}
      listPanel={listPanel}
      showList={!inDetail}
      graph={<StudioGraph nodes={graph.nodes} edges={graph.edges} emptyHint="选中一个技能查看结构图,或用左侧创建一个" />}
    />
  )
}

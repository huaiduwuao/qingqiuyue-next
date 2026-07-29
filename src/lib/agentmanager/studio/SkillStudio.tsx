'use client'

/**
 * 技能工作室
 * 对话只是协助:生成的结果先进画布草稿与表单,用户修改后点「保存」才落库。
 * 画布(输入→处理→输出 结构)可编辑:拖动 / 增删 / 连线 / 双击改配置。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'

import { agentmAPI, type Skill } from '../api'
import { canvasAPI } from '../canvas/api'
import type { SkillResult } from '../canvas/types'
import StudioLayout, { type ChatMessage } from './StudioLayout'
import EditableGraph, { type EditableGraphRef, type DraftNode, type DraftEdge } from './EditableGraph'

const CATEGORIES = ['图像/视觉处理', '内容生成/写作', '数据/信息处理', '其他']

const NODE_PALETTE = [
  { kind: 'io', label: '输入' },
  { kind: 'skill', label: '处理' },
  { kind: 'condition', label: '条件' },
  { kind: 'io', label: '输出' },
]

export default function SkillStudio({ editingId = null, onLoaded }: { editingId?: number | null; onLoaded?: (name: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // 草稿
  const [skillId, setSkillId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [config, setConfig] = useState('{}')
  const graphRef = useRef<EditableGraphRef>(null)
  const draftRef = useRef<{ nodes: DraftNode[]; edges: DraftEdge[] }>({ nodes: [], edges: [] })

  // 编辑模式:按 id 拉技能灌入草稿
  useEffect(() => {
    if (!editingId) return
    ;(async () => {
      const s = await agentmAPI.getSkill(editingId).catch(() => null)
      if (s) loadIntoDraft(s)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId])

  const loadIntoDraft = (s: Skill) => {
    setSkillId(s.id)
    setName(s.name)
    onLoaded?.(s.name)
    setDesc(s.description ?? '')
    setCategory(s.category || CATEGORIES[0])
    setConfig(JSON.stringify(s.config ?? {}, null, 2))
    // 默认结构:输入 → 技能 → 输出
    graphRef.current?.setData(
      [
        { id: 'input', label: '输入', sub: '请求参数', kind: 'io', x: 60, y: 120, config: {} },
        { id: 'skill', label: s.name, sub: s.category, kind: 'skill', x: 300, y: 100, config: s.config ?? {} },
        { id: 'output', label: '输出', sub: '处理结果', kind: 'io', x: 540, y: 120, config: {} },
      ],
      [
        { id: 'e1', source: 'input', target: 'skill' },
        { id: 'e2', source: 'skill', target: 'output' },
      ],
    )
    setDirty(false)
  }

  // 对话生成:流式边生成边显示,结束后灌草稿;不落库
  const handleSend = async (text: string) => {
    setMessages((m) => [...m, { role: 'user', text }])
    setGenerating(true)
    let streamText = ''
    setMessages((m) => [...m, { role: 'assistant', text: '⏳ 生成中…' }])
    const updateStream = () => {
      setMessages((m) => {
        const copy = [...m]
        copy[copy.length - 1] = { role: 'assistant', text: '⏳ 生成中…\n' + streamText.slice(-800) }
        return copy
      })
    }
    const applyResult = (result: SkillResult) => {
      if (result.success) {
        setName(result.name)
        setDesc(result.description)
        setCategory(result.category || '其他')
        const cfg = (result as any).config ?? {}
        setConfig(JSON.stringify(cfg, null, 2))
        graphRef.current?.setData(
          [
            { id: 'input', label: '输入', sub: '请求参数', kind: 'io', x: 60, y: 120, config: {} },
            { id: 'skill', label: result.name, sub: result.category, kind: 'skill', x: 300, y: 100, config: cfg },
            { id: 'output', label: '输出', sub: '处理结果', kind: 'io', x: 540, y: 120, config: {} },
          ],
          [
            { id: 'e1', source: 'input', target: 'skill' },
            { id: 'e2', source: 'skill', target: 'output' },
          ],
        )
        setDirty(true)
        return `已生成草稿「${result.name}」(${result.category}),已填入表单与画布。请检查修改后点「保存」。`
      }
      return `生成失败: ${result.error ?? '未知错误'}`
    }
    const setLast = (text: string) => {
      setMessages((m) => {
        const copy = [...m]
        copy[copy.length - 1] = { role: 'assistant', text }
        return copy
      })
    }
    try {
      await canvasAPI.generateSkillStream(text, 'tool', {
        onDelta: (t) => {
          streamText += t
          updateStream()
        },
        onResult: (r) => setLast(applyResult(r)),
        onError: (e) => setLast(`生成失败: ${e}`),
      })
    } catch (e: any) {
      setLast(`生成失败: ${e.message}`)
    } finally {
      setGenerating(false)
    }
  }

  // 保存:新建 create / 编辑 update。config 取画布中 skill(处理)节点的 config
  const handleSave = async () => {
    if (!name.trim()) {
      alert('请填写技能名称')
      return
    }
    // 从画布找处理节点(kind=skill)的 config;找不到用原表单值兜底
    const draft = graphRef.current?.getData()
    const skillNode = draft?.nodes.find((n) => n.kind === 'skill')
    let cfg: any = skillNode?.config ?? {}
    if (!skillNode) {
      try {
        cfg = JSON.parse(config || '{}')
      } catch {
        cfg = {}
      }
    }
    setSaving(true)
    try {
      if (skillId) {
        await agentmAPI.updateSkill(skillId, { name, description: desc, category, config: cfg })
      } else {
        const created = await agentmAPI.createSkill({ name, description: desc, category, tags: [], config: cfg } as Partial<Skill>)
        setSkillId(created.id)
      }
      setDirty(false)
      setMessages((m) => [...m, { role: 'assistant', text: `✅ 技能「${name}」已保存。` }])
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

  // 画布上方:技能整体属性(名称/描述/分类)+ 保存;config 双击「处理」节点编辑
  const propBar = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', flex: '0 0 auto' }}>
      <TextField size="small" label="名称" value={name} onChange={(e) => { setName(e.target.value); setDirty(true) }} sx={{ minWidth: 150 }} />
      <TextField size="small" label="描述" value={desc} onChange={(e) => { setDesc(e.target.value); setDirty(true) }} sx={{ flex: 1, minWidth: 160 }} />
      <TextField select size="small" label="分类" value={category} onChange={(e) => { setCategory(e.target.value); setDirty(true) }} sx={{ minWidth: 130 }}>
        {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
      </TextField>
      {dirty && <Chip size="small" label="未保存" color="warning" variant="outlined" />}
      <Button size="small" variant="contained" onClick={handleSave} disabled={saving || !name.trim()}>
        {saving ? '保存中…' : skillId ? '💾 保存修改' : '💾 保存技能'}
      </Button>
    </Box>
  )

  return (
    <StudioLayout
      title="⚡ 技能工作室"
      chatPlaceholder="描述技能,例如:一个能查询天气并返回温度信息的工具"
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
              emptyHint="用左侧对话生成草稿,或点上方按钮添加节点;双击「处理」节点改 config,改完点「保存」"
            />
          </Box>
        </Box>
      }
    />
  )
}

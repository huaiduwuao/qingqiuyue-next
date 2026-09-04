'use client'

/**
 * Agent 工作室
 * 对话只是协助:生成的名称/描述/提示词先进表单与画布草稿,
 * 用户修改后点「保存」才落库。画布(Agent 关联结构)可编辑。
 * 关联资源(技能/MCP/记忆/工作流)直接在右侧面板管理。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import CloseIcon from '@mui/icons-material/Close'

import { agentmAPI, type Agent, type ModelProvider } from '../api'
import { agentmExtendedAPI } from '../api-extended'
import { canvasAPI } from '../canvas/api'
import type { AgentAssociations } from '../canvas/types'
import StudioLayout from './StudioLayout'
import EditableGraph, { type EditableGraphRef, type DraftNode, type DraftEdge } from './EditableGraph'

const NODE_PALETTE = [
  { kind: 'agent', label: 'Agent' },
  { kind: 'skill', label: '技能' },
  { kind: 'workflow', label: '工作流' },
  { kind: 'mcp', label: 'MCP' },
  { kind: 'memory', label: '记忆' },
]

// 选择弹窗类型
type SelectDialogType = 'skill' | 'mcp' | null

// 选择弹窗
function SelectDialog({ type, onClose, onSelect }: { type: SelectDialogType; onClose: () => void; onSelect: (id: number) => void }) {
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!type) return
    ;(async () => {
      setLoading(true)
      try {
        if (type === 'skill') {
          const res = await agentmAPI.listSkills({ limit: 200 })
          setList(res.list || [])
        } else if (type === 'mcp') {
          const res = await agentmExtendedAPI.listMCPServers()
          setList(res.list || [])
        }
      } catch {
        setList([])
      } finally {
        setLoading(false)
      }
    })()
  }, [type])

  const title = type === 'skill' ? '选择技能' : '选择 MCP 服务器'

  return (
    <Dialog open={!!type} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {title}
        <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0, maxHeight: 400 }}>
        {loading ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>加载中…</Box>
        ) : list.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>暂无可用选项</Box>
        ) : (
          <List dense>
            {list.map((item) => (
              <ListItem key={item.id} disablePadding>
                <ListItemButton onClick={() => onSelect(item.id)}>
                  <ListItemText
                    primary={item.name}
                    secondary={type === 'skill' ? item.category : `${item.tool_count} 个工具`}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  )
}

// 创建工作流弹窗
function CreateWorkflowDialog({ agentId, open, onClose, onCreated }: { agentId: number; open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await canvasAPI.createWorkflow(agentId, {
        name: name.trim(),
        description: description.trim(),
        workflow_json: '{}',
        workflow_type: 'sequential',
      })
      onCreated()
      onClose()
    } catch (e: any) {
      alert(`创建失败: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>创建工作流</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <TextField label="名称" size="small" fullWidth value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <TextField label="描述" size="small" fullWidth value={description} onChange={(e) => setDescription(e.target.value)} multiline rows={2} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={handleCreate} disabled={saving || !name.trim()}>
          {saving ? '创建中…' : '创建'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// 创建记忆弹窗
function CreateMemoryDialog({ agentId, open, onClose, onCreated }: { agentId: number; open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await canvasAPI.setMemory(agentId, { name: name.trim(), content: content.trim(), memory_type: 'long_term' })
      onCreated()
      onClose()
    } catch (e: any) {
      alert(`创建失败: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>添加记忆</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <TextField label="名称" size="small" fullWidth value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <TextField label="内容" size="small" fullWidth value={content} onChange={(e) => setContent(e.target.value)} multiline rows={3} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={handleCreate} disabled={saving || !name.trim()}>
          {saving ? '添加中…' : '添加'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// 关联资源面板
function AssociationPanel({ agentId, onMsg }: { agentId: number; onMsg: (msg: string) => void }) {
  const [assoc, setAssoc] = useState<AgentAssociations | null>(null)
  const [selectDialog, setSelectDialog] = useState<SelectDialogType>(null)
  const [createWorkflowDialog, setCreateWorkflowDialog] = useState(false)
  const [createMemoryDialog, setCreateMemoryDialog] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const data = await canvasAPI.getAssociations(agentId)
      setAssoc(data)
    } catch { /* ignore */ }
  }, [agentId])

  useEffect(() => { refresh() }, [refresh])

  // 绑定技能
  const handleLinkSkill = async (skillId: number) => {
    try {
      await canvasAPI.linkSkill(agentId, skillId)
      await refresh()
      onMsg('✅ 技能已绑定')
    } catch (e: any) { onMsg(`绑定失败: ${e.message}`) }
  }

  // 解绑技能
  const handleUnlinkSkill = async (skillId: number) => {
    try {
      await canvasAPI.unlinkSkill(agentId, skillId)
      await refresh()
      onMsg('✅ 技能已解绑')
    } catch (e: any) { onMsg(`解绑失败: ${e.message}`) }
  }

  // 绑定 MCP
  const handleLinkMCP = async (mcpId: number) => {
    try {
      await canvasAPI.linkMCP(agentId, mcpId)
      await refresh()
      onMsg('✅ MCP 已绑定')
    } catch (e: any) { onMsg(`绑定失败: ${e.message}`) }
  }

  // 解绑 MCP
  const handleUnlinkMCP = async (mcpId: number) => {
    try {
      await canvasAPI.unlinkMCP(agentId, mcpId)
      await refresh()
      onMsg('✅ MCP 已解绑')
    } catch (e: any) { onMsg(`解绑失败: ${e.message}`) }
  }

  // 删除记忆
  const handleDeleteMemory = async (memoryId: number) => {
    try {
      await canvasAPI.deleteMemory(agentId, memoryId)
      await refresh()
      onMsg('✅ 记忆已删除')
    } catch (e: any) { onMsg(`删除失败: ${e.message}`) }
  }

  // 删除工作流
  const handleDeleteWorkflow = async (workflowId: number) => {
    try {
      await canvasAPI.deleteWorkflow(agentId, workflowId)
      await refresh()
      onMsg('✅ 工作流已删除')
    } catch (e: any) { onMsg(`删除失败: ${e.message}`) }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>关联资源</Typography>

      {/* 技能 */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>⚡ 技能</Typography>
          <Typography variant="caption" color="text.secondary">({assoc?.skills?.length ?? 0})</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {(assoc?.skills || []).map((s) => (
            <Box key={s.skill_id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 0.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ flex: 1 }}>{s.skill_name}</Typography>
              <IconButton size="small" color="error" onClick={() => handleUnlinkSkill(s.skill_id)}><DeleteIcon fontSize="small" /></IconButton>
            </Box>
          ))}
          <Button size="small" variant="outlined" onClick={() => setSelectDialog('skill')} startIcon={<AddIcon />}>绑定技能</Button>
        </Box>
      </Box>

      {/* MCP */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>🔌 MCP</Typography>
          <Typography variant="caption" color="text.secondary">({assoc?.mcps?.length ?? 0})</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {(assoc?.mcps || []).map((m) => (
            <Box key={m.mcp_server_id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 0.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ flex: 1 }}>{m.mcp_server_name}</Typography>
              <IconButton size="small" color="error" onClick={() => handleUnlinkMCP(m.mcp_server_id)}><DeleteIcon fontSize="small" /></IconButton>
            </Box>
          ))}
          <Button size="small" variant="outlined" onClick={() => setSelectDialog('mcp')} startIcon={<AddIcon />}>绑定 MCP</Button>
        </Box>
      </Box>

      {/* 记忆 */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>🧠 记忆</Typography>
          <Typography variant="caption" color="text.secondary">({assoc?.memories?.length ?? 0})</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {(assoc?.memories || []).map((mm) => (
            <Box key={mm.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 0.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ flex: 1 }}>{mm.name}</Typography>
              <IconButton size="small" color="error" onClick={() => handleDeleteMemory(mm.id)}><DeleteIcon fontSize="small" /></IconButton>
            </Box>
          ))}
          <Button size="small" variant="outlined" onClick={() => setCreateMemoryDialog(true)} startIcon={<AddIcon />}>添加记忆</Button>
        </Box>
      </Box>

      {/* 工作流 */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>🔀 工作流</Typography>
          <Typography variant="caption" color="text.secondary">({assoc?.workflows?.length ?? 0})</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {(assoc?.workflows || []).map((w) => (
            <Box key={w.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 0.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ flex: 1 }}>{w.name}</Typography>
              <IconButton size="small" color="error" onClick={() => handleDeleteWorkflow(w.id)}><DeleteIcon fontSize="small" /></IconButton>
            </Box>
          ))}
          <Button size="small" variant="outlined" onClick={() => setCreateWorkflowDialog(true)} startIcon={<AddIcon />}>创建工作流</Button>
        </Box>
      </Box>

      {/* 弹窗 */}
      <SelectDialog type={selectDialog} onClose={() => setSelectDialog(null)} onSelect={(id) => { if (selectDialog === 'skill') handleLinkSkill(id); else if (selectDialog === 'mcp') handleLinkMCP(id); setSelectDialog(null) }} />
      <CreateWorkflowDialog agentId={agentId} open={createWorkflowDialog} onClose={() => setCreateWorkflowDialog(false)} onCreated={refresh} />
      <CreateMemoryDialog agentId={agentId} open={createMemoryDialog} onClose={() => setCreateMemoryDialog(false)} onCreated={refresh} />
    </Box>
  )
}

export default function AgentStudio({ editingId = null, onLoaded }: { editingId?: number | null; onLoaded?: (name: string) => void }) {
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

  // 加载关联资源到画布
  const loadAssociationsToGraph = useCallback(async (aId: number) => {
    try {
      const assoc = await canvasAPI.getAssociations(aId)
      console.log('加载关联资源:', assoc)
      const newNodes: DraftNode[] = []
      const newEdges: DraftEdge[] = []

      // Agent 节点（中心顶部）
      const agentY = 80
      newNodes.push({ id: 'agent', label: name || 'Agent', sub: role, kind: 'agent', x: 400, y: agentY, config: {} })

      // 技能节点（Agent 上方，水平排列）
      let xPos = 50
      const skillY = 250
      for (const s of assoc.skills || []) {
        newNodes.push({ id: `skill-${s.skill_id}`, label: s.skill_name, sub: s.skill_category, kind: 'skill', x: xPos, y: skillY, config: {} })
        newEdges.push({ id: `e-skill-${s.skill_id}`, source: `skill-${s.skill_id}`, target: 'agent' })
        xPos += 160
      }

      // MCP 节点（Agent 下方，水平排列）
      xPos = 50
      const mcpY = 420
      for (const m of assoc.mcps || []) {
        newNodes.push({ id: `mcp-${m.mcp_server_id}`, label: m.mcp_server_name, sub: 'MCP', kind: 'mcp', x: xPos, y: mcpY, config: {} })
        newEdges.push({ id: `e-mcp-${m.mcp_server_id}`, source: 'agent', target: `mcp-${m.mcp_server_id}` })
        xPos += 160
      }

      // 记忆节点（MCP 下方，水平排列）
      xPos = 50
      const memY = 590
      for (const mm of assoc.memories || []) {
        newNodes.push({ id: `memory-${mm.id}`, label: mm.name, sub: '记忆', kind: 'memory', x: xPos, y: memY, config: {} })
        xPos += 160
      }

      // 工作流节点（记忆下方，水平排列）
      xPos = 50
      const wfY = 760
      for (const w of assoc.workflows || []) {
        newNodes.push({ id: `workflow-${w.id}`, label: w.name, sub: '工作流', kind: 'workflow', x: xPos, y: wfY, config: {} })
        xPos += 160
      }

      console.log('设置画布数据:', { nodes: newNodes.length, edges: newEdges.length })
      graphRef.current?.setData(newNodes, newEdges)
      console.log('画布数据已设置')
    } catch (e) {
      console.error('加载关联失败:', e)
    }
  }, [name, role])

  const loadIntoDraft = (a: Agent) => {
    setAgentId(a.id)
    setName(a.name)
    onLoaded?.(a.name)
    setRole(a.role ?? 'assistant')
    setModel(a.model ?? '')
    setDesc(a.description ?? '')
    setPrompt((a as any).system_prompt ?? '')
    setDirty(false)
    // 延迟加载关联资源
    setTimeout(() => loadAssociationsToGraph(a.id), 100)
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

  const manualForm = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {agentId ? `编辑 Agent #${agentId}` : '新 Agent 草稿'}
        </Typography>
        {dirty && <Chip size="small" label="未保存" color="warning" />}
      </Box>
      <TextField size="small" label="名称" value={name} onChange={(e) => { setName(e.target.value); setDirty(true) }} />
      <TextField size="small" label="角色" value={role} onChange={(e) => { setRole(e.target.value); setDirty(true) }} />
      <TextField
        select
        size="small"
        label="绑定模型(大脑)"
        value={model}
        onChange={(e) => { setModel(e.target.value); setDirty(true) }}
        helperText={providers.length === 0 ? '未配置模型供应商,请先到「🧠 模型管理」添加' : '来自模型管理的 LLM / CodingPlan 供应商'}
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
      <TextField size="small" label="描述" value={desc} onChange={(e) => { setDesc(e.target.value); setDirty(true) }} multiline rows={2} />
      <TextField size="small" label="System Prompt" value={prompt} onChange={(e) => { setPrompt(e.target.value); setDirty(true) }} multiline rows={5} />
      <Button variant="contained" onClick={handleSave} disabled={saving || !name.trim()}>
        {saving ? '保存中…' : agentId ? '💾 保存修改' : '💾 保存 Agent'}
      </Button>
    </Box>
  )

  // 消息回调
  const [studioMsg, setStudioMsg] = useState('')

  const showMsg = (msg: string) => {
    setStudioMsg(msg)
    setTimeout(() => setStudioMsg(''), 3000)
  }

  return (
    <Box sx={{ display: 'flex', gap: 2, height: '100%', minHeight: 0 }}>
      {/* 左:对话 + 手动表单 */}
      <Box sx={{ width: 400, flexShrink: 0, display: 'flex', flexDirection: 'column', border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden', bgcolor: 'background.paper' }}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>🤖 Agent 工作室</Typography>
        </Box>
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {agentId ? `编辑 Agent #${agentId}` : '新 Agent 草稿'}
              </Typography>
              {dirty && <Chip size="small" label="未保存" color="warning" />}
            </Box>
            <TextField size="small" label="名称" value={name} onChange={(e) => { setName(e.target.value); setDirty(true) }} />
            <TextField size="small" label="角色" value={role} onChange={(e) => { setRole(e.target.value); setDirty(true) }} />
            <TextField
              select
              size="small"
              label="绑定模型(大脑)"
              value={model}
              onChange={(e) => { setModel(e.target.value); setDirty(true) }}
              helperText={providers.length === 0 ? '未配置模型供应商' : ''}
            >
              {providers.map((p) => (
                <MenuItem key={p.id} value={p.model}>{p.name} · {p.model}{p.is_default ? ' (默认)' : ''}</MenuItem>
              ))}
            </TextField>
            <TextField size="small" label="描述" value={desc} onChange={(e) => { setDesc(e.target.value); setDirty(true) }} multiline rows={2} />
            <TextField size="small" label="System Prompt" value={prompt} onChange={(e) => { setPrompt(e.target.value); setDirty(true) }} multiline rows={5} />
            <Button variant="contained" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? '保存中…' : agentId ? '💾 保存修改' : '💾 保存 Agent'}
            </Button>
          </Box>
        </Box>
      </Box>

      {/* 右:关联资源 + 画布 */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        {agentId ? (
          <Box sx={{ flex: '0 0 200px', overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', p: 2 }}>
            <AssociationPanel agentId={agentId} onMsg={showMsg} />
          </Box>
        ) : (
          <Box sx={{ flex: '0 0 auto', p: 2, textAlign: 'center', color: 'text.secondary' }}>
            先保存 Agent 后才能管理关联资源
          </Box>
        )}

        {/* 画布 */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="subtitle2">工作流画布</Typography>
            <Box sx={{ flex: 1 }} />
            {studioMsg && <Typography variant="caption" color={studioMsg.startsWith('✅') ? 'success.main' : 'error'}>{studioMsg}</Typography>}
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
              emptyHint="用左侧表单完善 Agent 信息,或点上方按钮添加关联节点"
            />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

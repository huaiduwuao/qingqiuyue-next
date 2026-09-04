'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import CloseIcon from '@mui/icons-material/Close'

import CanvasNode from './CanvasNode'
import { canvasAPI } from './api'
import { agentmAPI } from '@/lib/agentmanager/api'
import { agentmExtendedAPI } from '@/lib/agentmanager/api-extended'
import type { AgentAssociations, CanvasNodeType, AgentSkillInfo, AgentMCPInfo, AgentWorkflowInfo, AgentMemoryInfo } from './types'
import { NODE_TYPE_META as META } from './types'

const nodeTypes: NodeTypes = { canvasNode: CanvasNode }

// 技能/MCP 选择弹窗类型
type SelectDialogType = 'skill' | 'mcp' | null

interface SelectDialogProps {
  type: SelectDialogType
  onClose: () => void
  onSelect: (id: number) => void
}

function SelectDialog({ type, onClose, onSelect }: SelectDialogProps) {
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
interface CreateWorkflowDialogProps {
  agentId: number
  onClose: () => void
  onCreated: () => void
}

function CreateWorkflowDialog({ agentId, onClose, onCreated }: CreateWorkflowDialogProps) {
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
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>创建工作流</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <TextField
          label="名称" size="small" fullWidth value={name}
          onChange={(e) => setName(e.target.value)} autoFocus
        />
        <TextField
          label="描述" size="small" fullWidth value={description}
          onChange={(e) => setDescription(e.target.value)} multiline rows={2}
        />
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
interface CreateMemoryDialogProps {
  agentId: number
  onClose: () => void
  onCreated: () => void
}

function CreateMemoryDialog({ agentId, onClose, onCreated }: CreateMemoryDialogProps) {
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
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>添加记忆</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <TextField
          label="名称" size="small" fullWidth value={name}
          onChange={(e) => setName(e.target.value)} autoFocus
        />
        <TextField
          label="内容" size="small" fullWidth value={content}
          onChange={(e) => setContent(e.target.value)} multiline rows={3}
        />
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

interface CanvasFlowProps {
  agentId: number
  agentName?: string
}

/**
 * Agent 画布工作流编辑器
 * - 加载/保存画布数据
 * - 拖拽连线
 * - 从关联面板拖入技能/MCP/记忆/工作流节点
 * - 绑定/解绑技能/MCP/记忆/工作流（完全在画布中操作）
 */
export default function CanvasFlow({ agentId, agentName }: CanvasFlowProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [assoc, setAssoc] = useState<AgentAssociations | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  // 弹窗状态
  const [selectDialog, setSelectDialog] = useState<SelectDialogType>(null)
  const [createWorkflowDialog, setCreateWorkflowDialog] = useState(false)
  const [createMemoryDialog, setCreateMemoryDialog] = useState(false)

  // 加载画布 + 关联信息
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const [canvas, associations] = await Promise.all([
          canvasAPI.getCanvas(agentId),
          canvasAPI.getAssociations(agentId).catch(() => null),
        ])
        if (!mounted) return

        const data = canvas.canvas_data || {}
        const loadedNodes: Node[] = (data.nodes || []).map((n: any) => ({
          id: n.id,
          type: 'canvasNode',
          position: n.position || { x: 100, y: 100 },
          data: n.data || { label: n.id },
        }))
        const loadedEdges: Edge[] = (data.edges || []).map((e: any) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          label: e.label,
          animated: e.animated,
          markerEnd: { type: MarkerType.ArrowClosed },
        }))

        // 若画布为空，初始化 start → agent → end 完整骨架(横向,连线齐全)
        if (loadedNodes.length === 0) {
          loadedNodes.push(
            { id: 'start', type: 'canvasNode', position: { x: 60, y: 200 }, data: { label: '开始', nodeType: 'start' } },
            { id: 'agent', type: 'canvasNode', position: { x: 320, y: 200 }, data: { label: agentName || 'Agent', nodeType: 'agent' } },
            { id: 'end', type: 'canvasNode', position: { x: 580, y: 200 }, data: { label: '结束', nodeType: 'end' } },
          )
          loadedEdges.push(
            { id: 'e-start-agent', source: 'start', target: 'agent', markerEnd: { type: MarkerType.ArrowClosed } },
            { id: 'e-agent-end', source: 'agent', target: 'end', markerEnd: { type: MarkerType.ArrowClosed } },
          )
        }

        setNodes(loadedNodes)
        setEdges(loadedEdges)
        setAssoc(associations)
      } catch (e: any) {
        setMsg(`加载失败: ${e.message}`)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [agentId, agentName, setNodes, setEdges])

  // 连线
  const onConnect = useCallback(
    (conn: Connection) =>
      setEdges((eds) =>
        addEdge({ ...conn, markerEnd: { type: MarkerType.ArrowClosed } }, eds),
      ),
    [setEdges],
  )

  // 保存画布
  const handleSave = useCallback(async () => {
    setSaving(true)
    setMsg('')
    try {
      const canvasData = {
        nodes: nodes.map((n) => ({ id: n.id, position: n.position, data: n.data })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          label: e.label,
          animated: e.animated,
        })),
      }
      await canvasAPI.saveCanvas(agentId, canvasData)
      setMsg('✅ 已保存')
    } catch (e: any) {
      setMsg(`保存失败: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }, [agentId, nodes, edges])

  // 添加节点（从关联面板）
  const addEntityNode = useCallback(
    (type: CanvasNodeType, label: string, refId?: number) => {
      const id = `${type}-${refId ?? Date.now()}`
      setNodes((nds) => {
        if (nds.some((n) => n.id === id)) return nds
        return [
          ...nds,
          {
            id,
            type: 'canvasNode',
            position: { x: 320 + Math.random() * 200, y: 60 + Math.random() * 80 },
            data: { label, nodeType: type, refId },
          },
        ]
      })
    },
    [setNodes],
  )

  // 刷新关联数据
  const refreshAssoc = useCallback(async () => {
    try {
      const data = await canvasAPI.getAssociations(agentId)
      setAssoc(data)
    } catch { /* ignore */ }
  }, [agentId])

  // 绑定技能
  const handleLinkSkill = useCallback(async (skillId: number) => {
    try {
      await canvasAPI.linkSkill(agentId, skillId)
      await refreshAssoc()
      setMsg('✅ 技能已绑定')
    } catch (e: any) {
      setMsg(`绑定失败: ${e.message}`)
    }
  }, [agentId, refreshAssoc])

  // 解绑技能
  const handleUnlinkSkill = useCallback(async (skillId: number) => {
    try {
      await canvasAPI.unlinkSkill(agentId, skillId)
      // 同时移除画布中对应的节点
      setNodes((nds) => nds.filter((n) => !(n.data?.nodeType === 'skill' && n.data?.refId === skillId)))
      await refreshAssoc()
      setMsg('✅ 技能已解绑')
    } catch (e: any) {
      setMsg(`解绑失败: ${e.message}`)
    }
  }, [agentId, refreshAssoc, setNodes])

  // 绑定 MCP
  const handleLinkMCP = useCallback(async (mcpId: number) => {
    try {
      await canvasAPI.linkMCP(agentId, mcpId)
      await refreshAssoc()
      setMsg('✅ MCP 已绑定')
    } catch (e: any) {
      setMsg(`绑定失败: ${e.message}`)
    }
  }, [agentId, refreshAssoc])

  // 解绑 MCP
  const handleUnlinkMCP = useCallback(async (mcpId: number) => {
    try {
      await canvasAPI.unlinkMCP(agentId, mcpId)
      setNodes((nds) => nds.filter((n) => !(n.data?.nodeType === 'mcp' && n.data?.refId === mcpId)))
      await refreshAssoc()
      setMsg('✅ MCP 已解绑')
    } catch (e: any) {
      setMsg(`解绑失败: ${e.message}`)
    }
  }, [agentId, refreshAssoc, setNodes])

  // 删除记忆
  const handleDeleteMemory = useCallback(async (memoryId: number) => {
    try {
      await canvasAPI.deleteMemory(agentId, memoryId)
      setNodes((nds) => nds.filter((n) => !(n.data?.nodeType === 'memory' && n.data?.refId === memoryId)))
      await refreshAssoc()
      setMsg('✅ 记忆已删除')
    } catch (e: any) {
      setMsg(`删除失败: ${e.message}`)
    }
  }, [agentId, refreshAssoc, setNodes])

  // 删除工作流
  const handleDeleteWorkflow = useCallback(async (workflowId: number) => {
    try {
      await canvasAPI.deleteWorkflow(agentId, workflowId)
      setNodes((nds) => nds.filter((n) => !(n.data?.nodeType === 'workflow' && n.data?.refId === workflowId)))
      await refreshAssoc()
      setMsg('✅ 工作流已删除')
    } catch (e: any) {
      setMsg(`删除失败: ${e.message}`)
    }
  }, [agentId, refreshAssoc, setNodes])

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>加载画布中…</div>
  }

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 560 }}>
      {/* 左：关联面板 */}
      <aside style={{ width: 260, borderRight: '1px solid #eee', padding: 12, overflowY: 'auto', background: '#fafafa' }}>
        <h4 style={{ margin: '4px 0 12px' }}>关联资源</h4>

        {/* 技能 */}
        <PanelSection title="⚡ 技能" count={assoc?.skills?.length}>
          {(assoc?.skills || []).map((s) => (
            <PanelItem
              key={s.skill_id}
              label={s.skill_name}
              onAdd={() => addEntityNode('skill', s.skill_name, s.skill_id)}
              onDelete={() => handleUnlinkSkill(s.skill_id)}
            />
          ))}
          <Button
            size="small" variant="outlined" fullWidth sx={{ mt: 1 }}
            onClick={() => setSelectDialog('skill')}
            startIcon={<AddIcon />}
          >
            绑定技能
          </Button>
        </PanelSection>

        {/* MCP */}
        <PanelSection title="🔌 MCP" count={assoc?.mcps?.length}>
          {(assoc?.mcps || []).map((m) => (
            <PanelItem
              key={m.mcp_server_id}
              label={m.mcp_server_name}
              onAdd={() => addEntityNode('mcp', m.mcp_server_name, m.mcp_server_id)}
              onDelete={() => handleUnlinkMCP(m.mcp_server_id)}
            />
          ))}
          <Button
            size="small" variant="outlined" fullWidth sx={{ mt: 1 }}
            onClick={() => setSelectDialog('mcp')}
            startIcon={<AddIcon />}
          >
            绑定 MCP
          </Button>
        </PanelSection>

        {/* 记忆 */}
        <PanelSection title="🧠 记忆" count={assoc?.memories?.length}>
          {(assoc?.memories || []).map((mm) => (
            <PanelItem
              key={mm.id}
              label={mm.name}
              onAdd={() => addEntityNode('memory', mm.name, mm.id)}
              onDelete={() => handleDeleteMemory(mm.id)}
            />
          ))}
          <Button
            size="small" variant="outlined" fullWidth sx={{ mt: 1 }}
            onClick={() => setCreateMemoryDialog(true)}
            startIcon={<AddIcon />}
          >
            添加记忆
          </Button>
        </PanelSection>

        {/* 工作流 */}
        <PanelSection title="🔀 工作流" count={assoc?.workflows?.length}>
          {(assoc?.workflows || []).map((w) => (
            <PanelItem
              key={w.id}
              label={w.name}
              onAdd={() => addEntityNode('workflow', w.name, w.id)}
              onDelete={() => handleDeleteWorkflow(w.id)}
            />
          ))}
          <Button
            size="small" variant="outlined" fullWidth sx={{ mt: 1 }}
            onClick={() => setCreateWorkflowDialog(true)}
            startIcon={<AddIcon />}
          >
            创建工作流
          </Button>
        </PanelSection>

        {/* 控制节点 */}
        <PanelSection title="⊕ 控制节点">
          {(['condition', 'action', 'parallel'] as CanvasNodeType[]).map((t) => (
            <PanelItem
              key={t}
              label={META[t].label}
              onAdd={() => addEntityNode(t, META[t].label)}
            />
          ))}
        </PanelSection>
      </aside>

      {/* 右：画布 */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          {msg && <span style={{ fontSize: 12, color: msg.startsWith('✅') ? 'green' : 'red' }}>{msg}</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '6px 16px',
              background: '#1976d2',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {saving ? '保存中…' : '保存画布'}
          </button>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={['Backspace', 'Delete']}
          onNodesDelete={(deleted) => {
            // 删除节点时，如果是实体节点（技能/MCP/记忆/工作流），自动解绑
            deleted.forEach((n) => {
              const data = n.data || {}
              const nodeType = data.nodeType as CanvasNodeType | undefined
              const refId = data.refId as number | undefined
              if (nodeType === 'skill' && refId) handleUnlinkSkill(refId)
              else if (nodeType === 'mcp' && refId) handleUnlinkMCP(refId)
              else if (nodeType === 'memory' && refId) handleDeleteMemory(refId)
              else if (nodeType === 'workflow' && refId) handleDeleteWorkflow(refId)
            })
          }}
        >
          <Background gap={16} />
          <Controls />
          <MiniMap pannable zoomable style={{ width: 140, height: 90 }} />
        </ReactFlow>
      </div>

      {/* 选择弹窗 */}
      <SelectDialog
        type={selectDialog}
        onClose={() => setSelectDialog(null)}
        onSelect={(id) => {
          if (selectDialog === 'skill') handleLinkSkill(id)
          else if (selectDialog === 'mcp') handleLinkMCP(id)
          setSelectDialog(null)
        }}
      />

      {/* 创建工作流弹窗 */}
      <CreateWorkflowDialog
        agentId={agentId}
        onClose={() => setCreateWorkflowDialog(false)}
        onCreated={refreshAssoc}
      />

      {/* 创建记忆弹窗 */}
      <CreateMemoryDialog
        agentId={agentId}
        onClose={() => setCreateMemoryDialog(false)}
        onCreated={refreshAssoc}
      />
    </div>
  )
}

function PanelSection({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6 }}>
        {title}
        {typeof count === 'number' && <span style={{ color: '#999' }}> ({count})</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {children}
      </div>
    </div>
  )
}

function PanelItem({ label, onAdd, onDelete }: { label: string; onAdd: () => void; onDelete?: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '5px 8px',
        background: '#fff',
        border: '1px solid #e5e5e5',
        borderRadius: 5,
        fontSize: 12,
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
        {onDelete && (
          <button
            onClick={onDelete}
            title="解绑/删除"
            style={{
              border: 'none',
              background: '#ffebee',
              color: '#d32f2f',
              borderRadius: 4,
              cursor: 'pointer',
              padding: '2px 6px',
              fontSize: 12,
              minWidth: 20,
            }}
          >
            ×
          </button>
        )}
        <button
          onClick={onAdd}
          title="添加到画布"
          style={{
            border: 'none',
            background: '#e3f2fd',
            color: '#1976d2',
            borderRadius: 4,
            cursor: 'pointer',
            padding: '2px 6px',
            fontSize: 12,
          }}
        >
          +
        </button>
      </div>
    </div>
  )
}

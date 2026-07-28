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

import CanvasNode from './CanvasNode'
import { canvasAPI } from './api'
import type { AgentAssociations, CanvasNodeType, NODE_TYPE_META } from './types'
import { NODE_TYPE_META as META } from './types'

const nodeTypes: NodeTypes = { canvasNode: CanvasNode }

interface CanvasFlowProps {
  agentId: number
  agentName?: string
}

/**
 * Agent 画布工作流编辑器
 * - 加载/保存画布数据
 * - 拖拽连线
 * - 从关联面板拖入技能/MCP/记忆/工作流节点
 */
export default function CanvasFlow({ agentId, agentName }: CanvasFlowProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [assoc, setAssoc] = useState<AgentAssociations | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

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

        // 若画布为空，初始化 start/agent/end 骨架
        if (loadedNodes.length === 0) {
          loadedNodes.push(
            { id: 'start', type: 'canvasNode', position: { x: 80, y: 200 }, data: { label: '开始', nodeType: 'start' } },
            { id: 'agent', type: 'canvasNode', position: { x: 320, y: 200 }, data: { label: agentName || 'Agent', nodeType: 'agent' } },
            { id: 'end', type: 'canvasNode', position: { x: 580, y: 200 }, data: { label: '结束', nodeType: 'end' } },
          )
          loadedEdges.push({
            id: 'e-start-agent',
            source: 'start',
            target: 'agent',
            markerEnd: { type: MarkerType.ArrowClosed },
          })
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

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>加载画布中…</div>
  }

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 560 }}>
      {/* 左：关联面板 */}
      <aside style={{ width: 240, borderRight: '1px solid #eee', padding: 12, overflowY: 'auto', background: '#fafafa' }}>
        <h4 style={{ margin: '4px 0 12px' }}>关联资源</h4>

        <PanelSection title="⚡ 技能" count={assoc?.skills?.length}>
          {(assoc?.skills || []).map((s) => (
            <PanelItem
              key={s.skill_id}
              label={s.skill_name || `技能 #${s.skill_id}`}
              onAdd={() => addEntityNode('skill', s.skill_name, s.skill_id)}
            />
          ))}
        </PanelSection>

        <PanelSection title="🔌 MCP" count={assoc?.mcps?.length}>
          {(assoc?.mcps || []).map((m) => (
            <PanelItem
              key={m.mcp_server_id}
              label={m.mcp_server_name || `MCP #${m.mcp_server_id}`}
              onAdd={() => addEntityNode('mcp', m.mcp_server_name, m.mcp_server_id)}
            />
          ))}
        </PanelSection>

        <PanelSection title="🧠 记忆" count={assoc?.memories?.length}>
          {(assoc?.memories || []).map((mm) => (
            <PanelItem
              key={mm.id}
              label={mm.name}
              onAdd={() => addEntityNode('memory', mm.name, mm.id)}
            />
          ))}
        </PanelSection>

        <PanelSection title="🔀 工作流" count={assoc?.workflows?.length}>
          {(assoc?.workflows || []).map((w) => (
            <PanelItem
              key={w.id}
              label={w.name}
              onAdd={() => addEntityNode('workflow', w.name, w.id)}
            />
          ))}
        </PanelSection>

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
        >
          <Background gap={16} />
          <Controls />
          <MiniMap pannable zoomable style={{ width: 140, height: 90 }} />
        </ReactFlow>
      </div>
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

function PanelItem({ label, onAdd }: { label: string; onAdd: () => void }) {
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
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <button
        onClick={onAdd}
        style={{
          border: 'none',
          background: '#e3f2fd',
          color: '#1976d2',
          borderRadius: 4,
          cursor: 'pointer',
          padding: '2px 8px',
          fontSize: 12,
        }}
      >
        +
      </button>
    </div>
  )
}

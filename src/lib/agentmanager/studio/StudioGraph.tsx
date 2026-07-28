'use client'

/**
 * 只读节点图画布
 * 工作室右侧面板共用:把工作流/技能/Agent 关联渲染成节点图。
 * 与 CanvasFlow(可编辑、按 Agent 持久化)不同,本组件纯展示、由外部传 nodes/edges。
 */

import { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

export interface GraphNode {
  id: string
  label: string
  /** 副标题/类型说明 */
  sub?: string
  /** 分组,用于配色 */
  kind?: 'start' | 'end' | 'agent' | 'skill' | 'workflow' | 'mcp' | 'memory' | 'step' | 'io'
  x: number
  y: number
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  label?: string
}

const KIND_COLOR: Record<string, { bg: string; border: string; fg: string }> = {
  start: { bg: '#e8f5e9', border: '#66bb6a', fg: '#2e7d32' },
  end: { bg: '#ffebee', border: '#ef5350', fg: '#c62828' },
  agent: { bg: '#e3f2fd', border: '#42a5f5', fg: '#1565c0' },
  skill: { bg: '#f3e5f5', border: '#ab47bc', fg: '#6a1b9a' },
  workflow: { bg: '#fff3e0', border: '#ffa726', fg: '#e65100' },
  mcp: { bg: '#e0f7fa', border: '#26c6da', fg: '#00838f' },
  memory: { bg: '#fffde7', border: '#ffee58', fg: '#f9a825' },
  step: { bg: '#eceff1', border: '#90a4ae', fg: '#37474f' },
  io: { bg: '#fafafa', border: '#bdbdbd', fg: '#616161' },
}

interface StudioGraphProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  /** 空态提示 */
  emptyHint?: string
}

export default function StudioGraph({ nodes, edges, emptyHint }: StudioGraphProps) {
  const rfNodes: Node[] = useMemo(
    () =>
      nodes.map((n) => {
        const c = KIND_COLOR[n.kind ?? 'step'] ?? KIND_COLOR.step
        return {
          id: n.id,
          position: { x: n.x, y: n.y },
          data: {
            label: (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{n.label}</div>
                {n.sub && <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>{n.sub}</div>}
              </div>
            ),
          },
          style: {
            background: c.bg,
            border: `1.5px solid ${c.border}`,
            color: c.fg,
            borderRadius: 8,
            padding: '8px 12px',
            minWidth: 120,
            fontSize: 12,
          },
          draggable: true,
          connectable: false,
        }
      }),
    [nodes],
  )

  const rfEdges: Edge[] = useMemo(
    () =>
      edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#90a4ae' },
        labelStyle: { fontSize: 11, fill: '#607d8b' },
      })),
    [edges],
  )

  if (nodes.length === 0) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9e9e9e',
          fontSize: 14,
          border: '1px dashed #e0e0e0',
          borderRadius: 8,
          background: '#fafafa',
        }}
      >
        {emptyHint ?? '选择或创建一个条目后,这里会显示它的结构图'}
      </div>
    )
  }

  return (
    <div style={{ height: '100%', border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
      <ReactFlow nodes={rfNodes} edges={rfEdges} fitView nodesConnectable={false} proOptions={{ hideAttribution: true }}>
        <Background gap={16} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable style={{ width: 120, height: 80 }} />
      </ReactFlow>
    </div>
  )
}

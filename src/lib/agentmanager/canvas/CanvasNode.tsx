'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { NODE_TYPE_META, type CanvasNodeType } from './types'

/**
 * 通用画布节点
 * 根据 nodeType 渲染不同颜色和图标
 */
function CanvasNodeComponent({ data, selected }: NodeProps) {
  const nodeType = (data.nodeType as CanvasNodeType) || 'action'
  const meta = NODE_TYPE_META[nodeType] || NODE_TYPE_META.action
  const isStart = nodeType === 'start'
  const isEnd = nodeType === 'end'

  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: 8,
        border: `2px solid ${selected ? '#1976d2' : meta.color}`,
        background: '#fff',
        minWidth: 140,
        boxShadow: selected ? '0 0 0 3px rgba(25,118,210,0.25)' : '0 1px 4px rgba(0,0,0,0.12)',
        fontSize: 13,
      }}
    >
      {!isStart && (
        <Handle type="target" position={Position.Top} style={{ background: meta.color }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 16 }}>{meta.icon}</span>
        <div>
          <div style={{ fontWeight: 600, color: '#222' }}>{(data.label as string) || meta.label}</div>
          <div style={{ fontSize: 11, color: meta.color }}>{meta.label}</div>
        </div>
      </div>

      {!isEnd && (
        <Handle type="source" position={Position.Bottom} style={{ background: meta.color }} />
      )}
    </div>
  )
}

export default memo(CanvasNodeComponent)

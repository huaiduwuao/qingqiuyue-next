/**
 * VoiceIndicator — 语音状态可视化 (纯展示, 状态由父传)
 *
 * 颜色编码:
 *   🟢 idle        待机监听中 (VAD 在跑, 等唤醒词)
 *   🟡 listening   检测到人声 (正在 ASR 判断唤醒词)
 *   🟣 recording   唤醒词已识别, 在录用户命令
 *   ⏳ processing  ASR/LLM 处理中
 *   🔵 wake        唤醒词识别成功 (短暂, 跳到 recording)
 *   🔴 error
 */

'use client'

import React from 'react'
import type { CSSProperties } from 'react'

export type VoiceIndicatorState = 'idle' | 'listening' | 'wake' | 'recording' | 'processing' | 'error'

export interface VoiceIndicatorProps {
  /** 当前状态 */
  state: VoiceIndicatorState
  /** 识别到的转写文字 */
  transcript?: string
  /** 唤醒词命中时的 label */
  wakeWord?: string
  /** 错误信息 */
  error?: string | null
  /** 位置 */
  position?: 'top-right' | 'top-left' | 'bottom-right'
  /** 显示转写文字 */
  showTranscript?: boolean
}

const COLORS: Record<VoiceIndicatorState, string> = {
  idle: '#10b981',        // 绿 - 待机
  listening: '#f59e0b',    // 黄 - 检测人声
  wake: '#a855f7',         // 紫 - 唤醒词识别
  recording: '#3b82f6',    // 蓝 - 在录用户命令
  processing: '#6b7280',   // 灰 - 处理中
  error: '#ef4444',        // 红 - 错误
}

const LABELS: Record<VoiceIndicatorState, string> = {
  idle: '待机, 说"小月"唤醒',
  listening: '检测人声...',
  wake: '唤醒词已识别!',
  recording: '我在听 👂',
  processing: '处理中...',
  error: '错误',
}

export function VoiceIndicator({
  state,
  transcript,
  wakeWord,
  error,
  position = 'top-right',
  showTranscript = true,
}: VoiceIndicatorProps) {
  const color = COLORS[state]
  const label = LABELS[state]

  // 拖动状态
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null)
  const [dragging, setDragging] = React.useState(false)
  const dragRef = React.useRef<{ startX: number; startY: number; initLeft: number; initTop: number } | null>(null)

  // 只在客户端、且未拖动过时计算初始位置
  React.useEffect(() => {
    if (typeof window === 'undefined' || pos !== null) return
    const getInitialPos = () => {
      if (position === 'top-right') return { left: window.innerWidth - 16 - 320, top: 16 }
      if (position === 'top-left') return { left: 16, top: 16 }
      // bottom-right
      return { left: window.innerWidth - 16 - 320, top: window.innerHeight - 80 }
    }
    setPos(getInitialPos())
  }, [position, pos])

  const onPointerDown = React.useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    setDragging(true)
    const rect = el.getBoundingClientRect()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initLeft: rect.left,
      initTop: rect.top,
    }
  }, [])

  const onPointerMove = React.useCallback((e: React.PointerEvent) => {
    if (!dragging || !dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setPos({
      left: Math.max(0, dragRef.current.initLeft + dx),
      top: Math.max(0, dragRef.current.initTop + dy),
    })
  }, [dragging])

  const onPointerUp = React.useCallback(() => {
    setDragging(false)
    dragRef.current = null
  }, [])

  if (pos === null) return null

  const style: CSSProperties = {
    position: 'fixed',
    left: pos.left,
    top: pos.top,
    zIndex: 9999,
    background: 'rgba(0,0,0,0.65)',
    color: '#fff',
    borderRadius: 12,
    padding: '8px 14px',
    fontSize: 13,
    fontFamily: 'system-ui, sans-serif',
    backdropFilter: 'blur(8px)',
    border: `2px solid ${color}`,
    boxShadow: `0 0 16px ${color}40`,
    transition: dragging ? 'none' : 'all 200ms ease',
    maxWidth: 320,
    cursor: dragging ? 'grabbing' : 'grab',
    userSelect: 'none',
    touchAction: 'none',
    pointerEvents: 'auto',
  }

  return (
    <div
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 8px ${color}`,
            animation: state === 'idle' ? 'pulse 2s infinite' : 'none',
          }}
        />
        <span style={{ fontWeight: 600 }}>{label}</span>
        {wakeWord && state !== 'recording' && (
          <span style={{ opacity: 0.6, fontSize: 11 }}>[👂{wakeWord}]</span>
        )}
      </div>
      {showTranscript && transcript && (
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85, fontStyle: 'italic' }}>
          "{transcript}"
        </div>
      )}
      {error && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#fca5a5' }}>
          ⚠️ {error}
        </div>
      )}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}
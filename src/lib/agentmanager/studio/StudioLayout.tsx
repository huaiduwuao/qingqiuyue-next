'use client'

/**
 * 工作室通用布局(参考下载/1.png)
 * 左侧:引导式聊天面板(对话协助创建)
 * 右侧:可编辑画布(EditableGraph),实体的属性显示在画布节点上,
 *       双击节点编辑;改完点「保存」才落库。不再有「手动添加」表单。
 * 技能 / 工作流 / Agent 三个工作室共用此骨架。
 */

import { useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

interface StudioLayoutProps {
  title: string
  /** 输入框占位提示 */
  chatPlaceholder: string
  /** 聊天生成中 */
  generating: boolean
  messages: ChatMessage[]
  onSend: (text: string) => void
  /** 右侧实体列表面板 */
  listPanel: ReactNode
  /** 右侧画布 */
  graph: ReactNode
  /** 聊天框下方附加区(如保存按钮) */
  chatFooter?: ReactNode
  /** 是否显示右侧实体列表;编辑/创建某条时传 false,只留画布 */
  showList?: boolean
}

export default function StudioLayout({
  title,
  chatPlaceholder,
  generating,
  messages,
  onSend,
  listPanel,
  graph,
  chatFooter,
  showList = true,
}: StudioLayoutProps) {
  const [input, setInput] = useState('')

  const send = () => {
    const t = input.trim()
    if (!t || generating) return
    onSend(t)
    setInput('')
  }

  // 高度由父容器(Console 工作室容器,flex:1)撑满,内部固定不溢出
  return (
    <Box sx={{ display: 'flex', gap: 2, height: '100%', minHeight: 0 }}>
      {/* 左:对话面板 */}
      <Box
        sx={{
          width: 380,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #eee',
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: '#fff',
        }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #f0f0f0' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
        </Box>

        {/* 消息区 */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {messages.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
              用自然语言描述你的需求,我来帮你创建。生成的内容会放到右侧画布,你可以继续修改后保存。
            </Typography>
          )}
          {messages.map((m, i) => (
            <Box
              key={i}
              sx={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                bgcolor: m.role === 'user' ? '#1976d2' : '#f5f5f5',
                color: m.role === 'user' ? '#fff' : 'text.primary',
                px: 1.5,
                py: 1,
                borderRadius: 2,
                fontSize: 13,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {m.text}
            </Box>
          ))}
          {generating && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', fontSize: 13 }}>
              <CircularProgress size={14} /> 思考中…
            </Box>
          )}
        </Box>

        {/* 输入区 */}
        <Box sx={{ p: 1.5, borderTop: '1px solid #f0f0f0' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              fullWidth
              multiline
              maxRows={4}
              placeholder={chatPlaceholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            <Button variant="contained" onClick={send} disabled={generating || !input.trim()} sx={{ alignSelf: 'flex-end' }}>
              发送
            </Button>
          </Box>
          {chatFooter}
        </Box>
      </Box>

      {/* 右:列表(可选)+ 画布 */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        {showList && (
          <Box sx={{ flex: '0 0 auto', maxHeight: '42%', overflowY: 'auto', border: '1px solid #eee', borderRadius: 2, bgcolor: '#fff', p: 1.5 }}>
            {listPanel}
          </Box>
        )}
        <Box sx={{ flex: 1, minHeight: 0 }}>{graph}</Box>
      </Box>
    </Box>
  )
}

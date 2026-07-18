'use client'

/**
 * AI 对话页面
 * 使用 MUI 组件
 */

import { useState, useRef, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import CircularProgress from '@mui/material/CircularProgress'
import Button from '@mui/material/Button'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import SendIcon from '@mui/icons-material/Send'
import ClearIcon from '@mui/icons-material/Clear'
import { agentmAPI } from '@/lib/agentmanager/api'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  model?: string
}

export default function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [models, setModels] = useState<{ id: string; name: string }[]>([])
  const [selectedModel, setSelectedModel] = useState('xiaoyue')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 加载模型列表
  useEffect(() => {
    agentmAPI.listModels()
      .then(res => setModels(res.models || []))
      .catch(console.error)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const response = await agentmAPI.chatCompletions(
        selectedModel,
        messages.concat(userMessage).map(m => ({
          role: m.role,
          content: m.content,
        }))
      )

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: extractContent(response),
        timestamp: new Date(),
        model: selectedModel,
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (e: any) {
      setError(e.message || '发送失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setMessages([])
  }

  const handleSuggestion = (text: string) => {
    setInput(text)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6">🤖 AI 对话</Typography>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>模型</InputLabel>
            <Select
              value={selectedModel}
              label="模型"
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {models.map(m => (
                <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip size="small" label={`${messages.length} 条消息`} />
          <Button
            size="small"
            startIcon={<ClearIcon />}
            onClick={handleClear}
            disabled={messages.length === 0}
          >
            清空对话
          </Button>
        </Box>
      </Box>

      {/* Messages */}
      <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
        <Box sx={{ maxWidth: 800, mx: 'auto' }}>
          {/* Welcome */}
          {messages.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h4" sx={{ mb: 2 }}>💬</Typography>
              <Typography variant="h5" sx={{ mb: 1 }}>开始对话</Typography>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                选择一个 AI 模型，开始对话吧！
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                {[
                  '最近好看的电影推荐',
                  '帮我写一个 Python 脚本',
                  '解释一下什么是量子计算',
                ].map((suggestion, i) => (
                  <Chip
                    key={i}
                    label={suggestion}
                    onClick={() => handleSuggestion(suggestion)}
                    variant="outlined"
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Messages */}
          {messages.map(msg => (
            <Box
              key={msg.id}
              sx={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                mb: 2,
              }}
            >
              <Box
                sx={{
                  maxWidth: '80%',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                }}
              >
                <Avatar
                  sx={{
                    bgcolor: msg.role === 'user' ? 'primary.main' : 'grey.600',
                    width: 36,
                    height: 36,
                  }}
                >
                  {msg.role === 'user' ? 'U' : 'AI'}
                </Avatar>
                <Paper
                  sx={{
                    p: 2,
                    bgcolor: msg.role === 'user' ? 'primary.main' : 'background.paper',
                    color: msg.role === 'user' ? 'white' : 'text.primary',
                    borderRadius: 2,
                    borderTopRightRadius: msg.role === 'user' ? 4 : 16,
                    borderTopLeftRadius: msg.role === 'user' ? 16 : 4,
                  }}
                >
                  {msg.role === 'assistant' && (
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                      {msg.model || 'AI'}
                    </Typography>
                  )}
                  <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      mt: 0.5,
                      opacity: 0.7,
                      textAlign: msg.role === 'user' ? 'right' : 'left',
                    }}
                  >
                    {msg.timestamp.toLocaleTimeString()}
                  </Typography>
                </Paper>
              </Box>
            </Box>
          ))}

          {/* Loading */}
          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Avatar sx={{ bgcolor: 'grey.600', width: 36, height: 36 }}>AI</Avatar>
              <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} />
                  <Typography color="text.secondary">AI 正在思考...</Typography>
                </Box>
              </Paper>
            </Box>
          )}

          {/* Error */}
          {error && (
            <Paper sx={{ p: 2, bgcolor: 'error.dark', color: 'error.contrastText', mb: 2 }}>
              ❌ {error}
            </Paper>
          )}

          <div ref={messagesEndRef} />
        </Box>
      </Box>

      {/* Input */}
      <Paper component="form" onSubmit={handleSubmit} sx={{ p: 2, display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="输入你的问题..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          autoFocus
        />
        <IconButton
          type="submit"
          color="primary"
          disabled={loading || !input.trim()}
        >
          <SendIcon />
        </IconButton>
      </Paper>
    </Box>
  )
}

// 提取响应内容
function extractContent(response: any): string {
  if (!response) return '无响应'
  if (typeof response === 'string') return response

  if (response.choices?.[0]?.message?.content) {
    return response.choices[0].message.content
  }

  if (response.content) return response.content
  if (response.text) return response.text
  if (response.message) return response.message

  return JSON.stringify(response, null, 2)
}

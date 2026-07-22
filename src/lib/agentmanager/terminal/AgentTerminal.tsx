'use client'

/**
 * AgentTerminal - 远程终端组件
 * 支持连接 Hermes / Claude Code / OpenClaw 并实时展示输出
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'

interface TerminalLine {
  type: 'stdout' | 'stderr' | 'system' | 'done' | 'error'
  content: string
  timestamp: Date
}

interface AgentTerminalProps {
  token?: string
  hermesBaseURL?: string
}

const RUNTIME_LABELS: Record<string, string> = {
  hermes: '🖥️ Hermes Agent',
  claude: '🤖 Claude Code',
  openclaw: '🦞 OpenClaw',
}

export default function AgentTerminal({ token, hermesBaseURL }: AgentTerminalProps) {
  const [runtime, setRuntime] = useState<string>('claude')
  const [command, setCommand] = useState('')
  const [lines, setLines] = useState<TerminalLine[]>([])
  const [running, setRunning] = useState(false)
  const [sessionId, setSessionId] = useState('')

  const outputRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [lines])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  const addLine = useCallback((type: TerminalLine['type'], content: string) => {
    setLines(prev => [...prev, { type, content, timestamp: new Date() }])
  }, [])

  const runCommand = async () => {
    if (!command.trim() || running) return

    setRunning(true)
    setLines(prev => [...prev, { type: 'system', content: `> ${command}`, timestamp: new Date() }])

    const cmdToSend = command
    setCommand('')

    try {
      let endpoint = ''
      let body: Record<string, any> = {}

      if (runtime === 'claude') {
        endpoint = '/api/v1/agentmanager/terminal/claude'
        body = {
          prompt: cmdToSend,
          model: 'sonnet',
          timeout: 300,
        }
      } else if (runtime === 'hermes') {
        endpoint = '/api/v1/agentmanager/terminal/hermes'
        body = {
          agent_id: 'default',
          command: cmdToSend,
        }
      } else if (runtime === 'openclaw') {
        endpoint = '/api/v1/agentmanager/terminal/openclaw'
        body = {
          command: cmdToSend,
          session_id: sessionId || undefined,
          timeout: 60,
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const err = await response.json()
        addLine('error', `请求失败: ${err.error || response.statusText}`)
        setRunning(false)
        return
      }

      // SSE 流式读取
      const reader = response.body?.getReader()
      if (!reader) {
        addLine('error', '无法读取响应流')
        setRunning(false)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // 处理 SSE 行
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)

            if (data === '[DONE]') {
              addLine('done', '[完成]')
              break
            }

            try {
              const parsed = JSON.parse(data)

              if (parsed.type === 'stdout' || parsed.type === 'stderr') {
                addLine(parsed.type, parsed.content)
              } else if (parsed.type === 'done') {
                addLine('done', `[进程退出: ${parsed.code === 0 ? '成功' : '失败'}]`)
              } else if (parsed.choices?.[0]?.delta?.content) {
                // OpenAI 流式格式
                addLine('stdout', parsed.choices[0].delta.content)
              } else if (parsed.content) {
                // OpenAI 完整格式
                addLine('stdout', parsed.content)
              }
            } catch {
              // 非 JSON 行，可能是原始文本
              if (data.trim()) {
                addLine('stdout', data)
              }
            }
          }
        }
      }

      addLine('done', '[连接关闭]')
    } catch (err: any) {
      addLine('error', `错误: ${err.message}`)
    } finally {
      setRunning(false)
    }
  }

  const clearOutput = () => {
    setLines([])
  }

  const getLineColor = (type: TerminalLine['type']) => {
    switch (type) {
      case 'stderr': return 'error.main'
      case 'error': return 'error.main'
      case 'done': return 'success.main'
      case 'system': return 'info.main'
      default: return 'text.primary'
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 400 }}>
      {/* 工具栏 */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>运行时</InputLabel>
          <Select
            value={runtime}
            label="运行时"
            onChange={(e) => setRuntime(e.target.value)}
          >
            {Object.entries(RUNTIME_LABELS).map(([key, label]) => (
              <MenuItem key={key} value={key}>{label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {runtime === 'openclaw' && (
          <TextField
            size="small"
            label="Session ID"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            sx={{ minWidth: 120 }}
          />
        )}

        <Box sx={{ flex: 1 }} />

        <Tooltip title="清空输出">
          <IconButton onClick={clearOutput} size="small">
            🗑️
          </IconButton>
        </Tooltip>
      </Box>

      {/* 终端输出区 */}
      <Paper
        ref={outputRef}
        sx={{
          flex: 1,
          bgcolor: '#1e1e1e',
          color: '#d4d4d4',
          p: 2,
          fontFamily: '"Fira Code", "Cascadia Code", "Consolas", monospace',
          fontSize: 13,
          overflow: 'auto',
          borderRadius: 1,
          minHeight: 300,
          maxHeight: 500,
        }}
      >
        {lines.length === 0 && (
          <Box sx={{ color: '#6a6a6a', fontStyle: 'italic' }}>
            连接远程 Agent 终端... 等待输入命令
          </Box>
        )}

        {lines.map((line, i) => (
          <Box
            key={i}
            sx={{
              color: getLineColor(line.type),
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              mb: 0.5,
              opacity: line.type === 'done' ? 0.7 : 1,
            }}
          >
            {line.content}
          </Box>
        ))}

        {running && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <CircularProgress size={12} sx={{ color: 'primary.main' }} />
            <Typography variant="caption" sx={{ color: '#6a6a6a' }}>
              运行中...
            </Typography>
          </Box>
        )}
      </Paper>

      {/* 输入区 */}
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder={runtime === 'claude' ? '输入 Claude Code 指令...' :
                        runtime === 'hermes' ? '输入 Hermes Agent 命令... ' :
                        '输入 OpenClaw 命令...'}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              runCommand()
            }
          }}
          disabled={running}
          sx={{
            '& .MuiOutlinedInput-root': {
              fontFamily: '"Fira Code", "Consolas", monospace',
            },
          }}
        />
        <Button
          variant="contained"
          onClick={runCommand}
          disabled={running || !command.trim()}
          sx={{ minWidth: 80 }}
        >
          {running ? <CircularProgress size={20} color="inherit" /> : '运行'}
        </Button>
      </Box>

      {/* 快捷命令 */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          快捷命令:
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {runtime === 'claude' && (
            <>
              <Button size="small" variant="outlined" onClick={() => setCommand('帮我写一个 Hello World')}>
                Hello World
              </Button>
              <Button size="small" variant="outlined" onClick={() => setCommand('解释这段代码: const x = 1')}>
                解释代码
              </Button>
              <Button size="small" variant="outlined" onClick={() => setCommand('搜索互联网: Go 语言最佳实践')}>
                搜索
              </Button>
            </>
          )}
          {runtime === 'hermes' && (
            <>
              <Button size="small" variant="outlined" onClick={() => setCommand('列出所有可用的 agent')}>
                列出 Agent
              </Button>
              <Button size="small" variant="outlined" onClick={() => setCommand('执行搜索任务')}>
                搜索任务
              </Button>
            </>
          )}
          {runtime === 'openclaw' && (
            <>
              <Button size="small" variant="outlined" onClick={() => setCommand('web search: Go tutorial')}>
                Web 搜索
              </Button>
              <Button size="small" variant="outlined" onClick={() => setCommand('read file: ./README.md')}>
                读文件
              </Button>
            </>
          )}
        </Box>
      </Box>
    </Box>
  )
}

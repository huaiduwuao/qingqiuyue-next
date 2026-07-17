'use client'

/**
 * ClawManager 对话页面
 * 完整的 AI 对话体验
 */

import { useState, useRef, useEffect } from 'react'
import { clawmAPI, type Instance } from './api'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  model?: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
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
    clawmAPI.listModels()
      .then(res => setModels(res.models || []))
      .catch(console.error)
  }, [])

  const handleLogin = async () => {
    try {
      await clawmAPI.login(username, password)
      setIsLoggedIn(true)
    } catch (e: any) {
      setError(e.message)
    }
  }

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
      const response = await clawmAPI.chatCompletions(
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

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">🤖 AI 对话</h1>

          {/* 模型选择 */}
          <select
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm"
          >
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            {messages.length} 条消息
          </span>
          <button
            onClick={handleClear}
            className="text-sm text-gray-400 hover:text-white"
          >
            清空对话
          </button>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Welcome */}
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">💬</div>
              <h2 className="text-2xl font-bold mb-2">开始对话</h2>
              <p className="text-gray-400 mb-6">
                选择一个 AI 模型，开始对话吧！
              </p>
              <div className="flex justify-center gap-2 flex-wrap">
                {[
                  '最近好看的电影推荐',
                  '帮我写一个 Python 脚本',
                  '解释一下什么是量子计算',
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(suggestion)}
                    className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-full text-sm text-gray-300 border border-gray-700"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-5 py-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-gray-800 text-gray-200 rounded-bl-md'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="text-xs text-gray-500 mb-1">
                    {msg.model || 'AI'}
                  </div>
                )}
                <div className="whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </div>
                <div className={`text-xs mt-1 ${
                  msg.role === 'user' ? 'text-blue-200' : 'text-gray-500'
                }`}>
                  {msg.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}

          {/* Loading */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-800 rounded-2xl rounded-bl-md px-5 py-3">
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span>AI 正在思考...</span>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex justify-center">
              <div className="bg-red-900/50 text-red-400 rounded-lg px-4 py-2 border border-red-800">
                ❌ {error}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="border-t border-gray-700 p-4 bg-gray-800">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="输入你的问题..."
              className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-medium transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  发送中
                </span>
              ) : (
                '发送'
              )}
            </button>
          </div>
        </form>
      </footer>
    </div>
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

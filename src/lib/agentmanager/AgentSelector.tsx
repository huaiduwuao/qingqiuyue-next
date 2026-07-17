'use client'

/**
 * AgentManager Agent 选择器组件
 * 用于选择不同的 AI Agent 进行对话
 */

import { useState, useEffect } from 'react'
import { agentmAPI, type Agent } from './api'

interface AgentSelectorProps {
  onSelect: (agent: Agent) => void
  selected?: string
}

export function AgentSelector({ onSelect, selected }: AgentSelectorProps) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    setLoading(true)
    try {
      const res = await agentmAPI.listInstances()
      // TODO: 从 /api/v1/agents 获取真实的 Agent 列表
      // 目前使用内置的模型列表作为演示
      const modelRes = await agentmAPI.listModels()
      const mockAgents: Agent[] = modelRes.models.map((m, i) => ({
        id: i + 1,
        agent_id: m.id,
        name: m.name,
        role: m.id,
        role_type: m.type,
        tags: [m.type],
        description: `AI ${m.name}`,
        model: m.id,
        capabilities: [],
        status: 'active',
        published: true,
        chat_count: 0,
      }))
      setAgents(mockAgents)
    } catch (e) {
      console.error('Load agents error:', e)
    } finally {
      setLoading(false)
    }
  }

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(filter.toLowerCase()) ||
    agent.role.toLowerCase().includes(filter.toLowerCase())
  )

  const roleColors: Record<string, string> = {
    agent: 'bg-purple-600',
    backend: 'bg-green-600',
    frontend: 'bg-blue-600',
    ops: 'bg-orange-600',
    general: 'bg-gray-600',
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="搜索 Agent..."
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Agent List */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-4 text-gray-400">加载中...</div>
        ) : filteredAgents.length === 0 ? (
          <div className="text-center py-4 text-gray-400">没有找到匹配的 Agent</div>
        ) : (
          filteredAgents.map(agent => (
            <button
              key={agent.agent_id}
              onClick={() => onSelect(agent)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                selected === agent.agent_id
                  ? 'bg-blue-600/30 border border-blue-500'
                  : 'bg-gray-700/50 hover:bg-gray-700'
              }`}
            >
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                roleColors[agent.role] || 'bg-gray-600'
              }`}>
                {agent.name.charAt(0)}
              </div>

              {/* Info */}
              <div className="flex-1 text-left">
                <div className="font-medium">{agent.name}</div>
                <div className="text-xs text-gray-400">{agent.description || agent.role}</div>
              </div>

              {/* Status */}
              {selected === agent.agent_id && (
                <div className="text-blue-400">✓</div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// Agent 卡片组件
interface AgentCardProps {
  agent: Agent
  onClick?: () => void
  onChat?: () => void
}

export function AgentCard({ agent, onClick, onChat }: AgentCardProps) {
  const roleColors: Record<string, string> = {
    agent: 'from-purple-600 to-purple-700',
    backend: 'from-green-600 to-green-700',
    frontend: 'from-blue-600 to-blue-700',
    ops: 'from-orange-600 to-orange-700',
    general: 'from-gray-600 to-gray-700',
  }

  const colorClass = roleColors[agent.role] || roleColors.general

  return (
    <div
      onClick={onClick}
      className="bg-gray-800 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all group"
    >
      {/* Header */}
      <div className={`bg-gradient-to-r ${colorClass} p-4`}>
        <div className="flex items-center justify-between">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold">
            {agent.name.charAt(0)}
          </div>
          <div className="flex gap-1">
            {agent.capabilities?.slice(0, 3).map((cap, i) => (
              <span key={i} className="text-xs bg-white/20 px-2 py-1 rounded">
                {cap}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-lg">{agent.name}</h3>
        <p className="text-gray-400 text-sm mt-1 line-clamp-2">
          {agent.description || '暂无描述'}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-4 text-sm text-gray-400">
          <span>💬 {agent.chat_count}</span>
          <span className={`px-2 py-0.5 rounded text-xs ${
            agent.status === 'active' ? 'bg-green-900/50 text-green-400' :
            agent.status === 'paused' ? 'bg-yellow-900/50 text-yellow-400' :
            'bg-gray-700 text-gray-400'
          }`}>
            {agent.status}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onChat?.() }}
            className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            开始对话
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClick?.() }}
            className="px-4 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm transition-colors"
          >
            详情
          </button>
        </div>
      </div>
    </div>
  )
}

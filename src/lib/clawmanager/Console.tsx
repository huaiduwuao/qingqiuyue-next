'use client'

/**
 * ClawManager 管理控制台
 * 多 Agent 管理平面前端界面
 */

import { useState, useEffect, useCallback } from 'react'
import { clawmAPI, type Instance, type Agent, type AuditLog, type Skill } from './api'

type Tab = 'instances' | 'agents' | 'audit' | 'skills' | 'gateway'

export default function ClawManagerConsole() {
  const [activeTab, setActiveTab] = useState<Tab>('instances')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Data states
  const [instances, setInstances] = useState<Instance[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [quota, setQuota] = useState<any>(null)
  const [governance, setGovernance] = useState<any>(null)

  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // Login
  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      await clawmAPI.login(username, password)
      setIsLoggedIn(true)
      loadData()
    } catch (e: any) {
      setError(e.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [instRes, skillRes, quotaRes, govRes] = await Promise.all([
        clawmAPI.listInstances().catch(() => ({ list: [] })),
        clawmAPI.listSkills().catch(() => ({ list: [] })),
        clawmAPI.getQuota().catch(() => null),
        clawmAPI.getLLMGovernance().catch(() => null),
      ])
      setInstances(instRes.list || [])
      setSkills(skillRes.list || [])
      setQuota(quotaRes)
      setGovernance(govRes)
    } catch (e: any) {
      console.error('Load data error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load audit logs
  const loadAuditLogs = async () => {
    setLoading(true)
    try {
      const res = await clawmAPI.getAuditLog({ limit: 50 })
      setAuditLogs(res.list || [])
    } catch (e: any) {
      console.error('Load audit error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isLoggedIn) {
      loadData()
    }
  }, [isLoggedIn, loadData])

  useEffect(() => {
    if (isLoggedIn && activeTab === 'audit') {
      loadAuditLogs()
    }
  }, [isLoggedIn, activeTab])

  // Health check
  const handleHealthCheck = async (instance: Instance) => {
    try {
      const status = await clawmAPI.getInstanceStatus(instance.id)
      setInstances(prev =>
        prev.map(i => i.id === instance.id ? { ...i, health_status: status.health_status as any } : i)
      )
    } catch (e: any) {
      alert(`Health check failed: ${e.message}`)
    }
  }

  // Login form
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-center">🤖 ClawManager</h1>
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl mb-4">登录</h2>
            {error && (
              <div className="bg-red-900/50 border border-red-500 rounded p-3 mb-4">
                {error}
              </div>
            )}
            <input
              type="text"
              placeholder="用户名"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-gray-700 rounded px-4 py-2 mb-4"
            />
            <input
              type="password"
              placeholder="密码"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-700 rounded px-4 py-2 mb-4"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 rounded px-4 py-2 disabled:opacity-50"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Tabs
  const tabs: { key: Tab; label: string }[] = [
    { key: 'instances', label: '实例' },
    { key: 'agents', label: 'Agent' },
    { key: 'audit', label: '审计' },
    { key: 'skills', label: '技能' },
    { key: 'gateway', label: '网关' },
  ]

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">🤖 ClawManager</h1>
          <div className="flex items-center gap-4">
            {governance && (
              <div className="flex gap-4 text-sm">
                <span>实例: <span className="text-green-400">{governance.instances?.healthy || 0}/{governance.instances?.total || 0}</span></span>
                <span>Agent: <span className="text-blue-400">{governance.agents || 0}</span></span>
              </div>
            )}
            <button
              onClick={() => setIsLoggedIn(false)}
              className="text-gray-400 hover:text-white"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-gray-800 border-b border-gray-700 px-6">
        <nav className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <main className="p-6">
        {loading && <div className="text-center py-8 text-gray-400">加载中...</div>}

        {/* Instances Tab */}
        {activeTab === 'instances' && !loading && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">实例管理</h2>
              <button
                onClick={() => clawmAPI.discoverInstances().then(loadData)}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm"
              >
                自动发现
              </button>
            </div>
            <div className="grid gap-4">
              {instances.map(inst => (
                <div key={inst.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">{inst.name}</h3>
                      <p className="text-gray-400 text-sm">{inst.code} • {inst.base_url}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        inst.health_status === 'healthy' ? 'bg-green-900 text-green-400' :
                        inst.health_status === 'unhealthy' ? 'bg-red-900 text-red-400' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {inst.health_status === 'healthy' ? '✓ 健康' :
                         inst.health_status === 'unhealthy' ? '✗ 异常' : '? 未知'}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        inst.status === 'active' ? 'bg-green-900/50 text-green-400' :
                        inst.status === 'offline' ? 'bg-red-900/50 text-red-400' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {inst.status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-4 text-sm text-gray-400">
                    <div>区域: <span className="text-white">{inst.region}</span></div>
                    <div>权重: <span className="text-white">{inst.weight}</span></div>
                    <div>最大并发: <span className="text-white">{inst.max_concurrent}</span></div>
                    <div>运行时: <span className="text-white">{inst.runtime_type}</span></div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleHealthCheck(inst)}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      健康检查
                    </button>
                    <button className="text-gray-400 hover:text-white text-sm">
                      编辑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Agents Tab */}
        {activeTab === 'agents' && !loading && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Agent 管理</h2>
            <p className="text-gray-400">Agent 数据将从 clawm_agents 表加载（当前为空）</p>
          </div>
        )}

        {/* Audit Tab */}
        {activeTab === 'audit' && !loading && (
          <div>
            <h2 className="text-xl font-semibold mb-4">审计日志</h2>
            {auditLogs.length > 0 ? (
              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left">时间</th>
                      <th className="px-4 py-3 text-left">用户</th>
                      <th className="px-4 py-3 text-left">模型</th>
                      <th className="px-4 py-3 text-left">Token</th>
                      <th className="px-4 py-3 text-left">延迟</th>
                      <th className="px-4 py-3 text-left">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map(log => (
                      <tr key={log.id} className="border-t border-gray-700">
                        <td className="px-4 py-3">{new Date(log.create_time).toLocaleString()}</td>
                        <td className="px-4 py-3">{log.user_id}</td>
                        <td className="px-4 py-3">{log.model}</td>
                        <td className="px-4 py-3">{log.total_tokens}</td>
                        <td className="px-4 py-3">{log.latency_ms}ms</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            log.status === 'success' ? 'bg-green-900 text-green-400' :
                            'bg-red-900 text-red-400'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-400">暂无审计日志</p>
            )}
          </div>
        )}

        {/* Skills Tab */}
        {activeTab === 'skills' && !loading && (
          <div>
            <h2 className="text-xl font-semibold mb-4">技能管理</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {skills.map(skill => (
                <div key={skill.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h3 className="font-semibold">{skill.name}</h3>
                  <p className="text-gray-400 text-sm mt-1">{skill.description}</p>
                  <div className="mt-3 flex gap-2">
                    <span className="text-xs bg-gray-700 px-2 py-1 rounded">{skill.category}</span>
                    <span className="text-xs bg-blue-900/50 text-blue-400 px-2 py-1 rounded">{skill.source}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gateway Tab */}
        {activeTab === 'gateway' && !loading && (
          <div>
            <h2 className="text-xl font-semibold mb-4">AI 网关</h2>
            {quota && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h3 className="font-semibold mb-3">配额使用</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Token 配额</span>
                      <span>{quota.quota_used?.toLocaleString()} / {quota.quota_limit?.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${(quota.quota_used / quota.quota_limit) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-4">
                      <span className="text-gray-400">请求次数</span>
                      <span>{quota.requests_used?.toLocaleString()} / {quota.requests_limit?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h3 className="font-semibold mb-3">可用模型</h3>
                  <div className="space-y-2">
                    {['xiaoyue', 'backend-dev', 'frontend-dev', 'ops'].map(model => (
                      <div key={model} className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 bg-green-500 rounded-full" />
                        {model}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

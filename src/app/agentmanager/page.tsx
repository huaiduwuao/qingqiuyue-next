'use client'

/**
 * AgentManager 管理控制台页面
 * 访问路径: /agentmanager
 */

import dynamic from 'next/dynamic'

// 使用 dynamic import 避免 SSR 问题
const Console = dynamic(() => import('@/lib/agentmanager/Console').then(m => m.default), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">🤖</div>
        <div className="text-xl">加载 AgentManager...</div>
      </div>
    </div>
  ),
})

export default function AgentManagerPage() {
  return <Console />
}

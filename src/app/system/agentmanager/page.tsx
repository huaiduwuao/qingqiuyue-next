'use client'

/**
 * AgentManager 管理控制台页面
 * 访问路径: /system/agentmanager
 */

import dynamic from 'next/dynamic'

// 使用 dynamic import 避免 SSR 问题
const Console = dynamic(() => import('@/lib/agentmanager/Console').then(m => m.default), {
  ssr: false,
  loading: () => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div>加载 AgentManager...</div>
    </div>
  ),
})

export default function AgentManagerPage() {
  return <Console />
}

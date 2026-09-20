'use client'

/**
 * 我的 LLM 配额 —— 用户端入口
 * 路径 /account/quota
 * 内容与 GatewayQuotaPanel 一致(配额卡 / 趋势 / 拆分 / 购买),只是不带 embedded、不显示网关其它信息。
 */

import GatewayQuotaPanel from '@/lib/agentmanager/GatewayQuotaPanel'

export default function Page() {
  return <GatewayQuotaPanel />
}
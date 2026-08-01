/**
 * 部署管理 API
 * 从 updater 服务获取部署状态和历史
 * 通过 APISIX 网关统一访问: /api/updater/*
 */

// 使用相对路径，通过 APISIX 网关访问
const UPDATER_BASE_URL = '';

/**
 * 获取所有服务状态
 */
export async function getServicesStatus() {
  const res = await fetch(`${UPDATER_BASE_URL}/api/updater/services`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('获取服务状态失败');
  return res.json();
}

/**
 * 获取部署历史
 */
export async function getDeploymentHistory() {
  const res = await fetch(`${UPDATER_BASE_URL}/api/updater/history`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('获取部署历史失败');
  return res.json();
}

/**
 * 获取 updater 状态
 */
export async function getUpdaterStatus() {
  const res = await fetch(`${UPDATER_BASE_URL}/api/updater/status`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('获取 updater 状态失败');
  return res.json();
}

/**
 * 健康检查
 */
export async function healthCheck() {
  const res = await fetch(`${UPDATER_BASE_URL}/api/updater/health`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('健康检查失败');
  return res.json();
}

/**
 * 全量健康检查 - 所有服务
 */
export async function healthCheckFull() {
  const res = await fetch(`${UPDATER_BASE_URL}/api/updater/health/full`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('全量健康检查失败');
  return res.json();
}

/**
 * 触发后端重建
 */
export async function rebuildBackend() {
  const res = await fetch(`${UPDATER_BASE_URL}/api/updater/rebuild/backend`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('触发后端重建失败');
  return res.json();
}

/**
 * 触发前端重建
 */
export async function rebuildFrontend() {
  const res = await fetch(`${UPDATER_BASE_URL}/api/updater/rebuild/web`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('触发前端重建失败');
  return res.json();
}

/**
 * 触发全部重建
 */
export async function rebuildAll() {
  const res = await fetch(`${UPDATER_BASE_URL}/api/updater/rebuild/all`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('触发重建失败');
  return res.json();
}

/**
 * 回滚服务
 */
export async function rollbackService(service: string, commit?: string) {
  const res = await fetch(`${UPDATER_BASE_URL}/api/updater/rollback/${service}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commit }),
  });
  if (!res.ok) throw new Error('回滚服务失败');
  return res.json();
}

/**
 * 获取告警配置
 */
export async function getAlertConfig() {
  const res = await fetch(`${UPDATER_BASE_URL}/api/updater/alerts/config`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('获取告警配置失败');
  return res.json();
}

/**
 * 设置告警配置
 */
export async function setAlertConfig(config: {
  enabled: boolean
  type: 'dingtalk' | 'feishu' | 'slack' | 'webhook' | 'none'
  webhookUrl: string
  token?: string
  secret?: string
  channel?: string
}) {
  const res = await fetch(`${UPDATER_BASE_URL}/api/updater/alerts/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('设置告警配置失败');
  return res.json();
}

/**
 * 测试告警
 */
export async function testAlert() {
  const res = await fetch(`${UPDATER_BASE_URL}/api/updater/alerts/test`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('测试告警失败');
  return res.json();
}

/**
 * 日志分析
 */
export async function analyzeLogs(service?: string, lines = 500) {
  const params = new URLSearchParams()
  if (service) params.set('service', service)
  params.set('lines', String(lines))

  const res = await fetch(`${UPDATER_BASE_URL}/api/updater/logs/analyze?${params}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('日志分析失败');
  return res.json();
}

/**
 * 获取构建日志
 */
export async function getBuildLog() {
  const res = await fetch(`${UPDATER_BASE_URL}/api/updater/build/log`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('获取构建日志失败');
  return res.text();
}

/**
 * 获取部署日志
 */
export async function getDeployLog() {
  const res = await fetch(`${UPDATER_BASE_URL}/api/updater/deploy/log`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('获取部署日志失败');
  return res.text();
}

/**
 * 获取容器日志
 */
export async function getContainerLogs(containerName: string, tail = 200) {
  const res = await fetch(`${UPDATER_BASE_URL}/api/updater/container/logs/${containerName}?tail=${tail}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('获取容器日志失败');
  return res.json();
}

// 类型定义
export interface HealthCheckResult {
  service: string
  status: 'healthy' | 'unhealthy' | 'unknown'
  latencyMs: number
  error?: string
}

export interface FullHealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  services: HealthCheckResult[]
  timestamp: string
}

export interface DeployRecord {
  id: string
  service: string
  commit: string
  event: 'startup' | 'auto_update' | 'manual_rebuild' | 'rollback'
  success: boolean
  message: string
  timestamp: string
}

export interface HistoryResponse {
  history: DeployRecord[]
  updater_version: string
}

export interface AlertConfig {
  enabled: boolean
  type: 'dingtalk' | 'feishu' | 'slack' | 'webhook' | 'none'
  webhookUrl: string
  token?: string
  secret?: string
  channel?: string
}

export interface LogAnalysisResult {
  service: string
  errorCount: number
  warningCount: number
  errors: string[]
  warnings: string[]
  timestamp: string
}

export interface LogAnalysisResponse {
  results: LogAnalysisResult[]
  summary: {
    total_errors: number
    total_warnings: number
    timestamp: string
  }
}

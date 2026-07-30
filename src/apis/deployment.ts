/**
 * 部署管理 API
 * 从 updater 服务获取部署状态和历史
 */

const UPDATER_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://10.9.1.2:10082';

/**
 * 获取所有服务状态
 */
export async function getServicesStatus() {
  const res = await fetch(`${UPDATER_BASE_URL}/services`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('获取服务状态失败');
  return res.json();
}

/**
 * 获取部署历史
 */
export async function getDeploymentHistory() {
  const res = await fetch(`${UPDATER_BASE_URL}/history`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('获取部署历史失败');
  return res.json();
}

/**
 * 获取 updater 状态
 */
export async function getUpdaterStatus() {
  const res = await fetch(`${UPDATER_BASE_URL}/status`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('获取 updater 状态失败');
  return res.json();
}

/**
 * 健康检查
 */
export async function healthCheck() {
  const res = await fetch(`${UPDATER_BASE_URL}/health`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('健康检查失败');
  return res.json();
}

/**
 * 触发后端重建
 */
export async function rebuildBackend() {
  const res = await fetch(`${UPDATER_BASE_URL}/rebuild/backend`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('触发后端重建失败');
  return res.json();
}

/**
 * 触发前端重建
 */
export async function rebuildFrontend() {
  const res = await fetch(`${UPDATER_BASE_URL}/rebuild/web`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('触发前端重建失败');
  return res.json();
}

/**
 * 触发全部重建
 */
export async function rebuildAll() {
  const res = await fetch(`${UPDATER_BASE_URL}/rebuild/all`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('触发重建失败');
  return res.json();
}

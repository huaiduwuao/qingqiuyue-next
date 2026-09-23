/**
 * 请求 realtime-api(/api/realtime/*)时带上的登录凭据:后端已改为必须认证。
 *
 * TODO(合并): 换成 '@/lib/api/…' 里统一的 getAuthToken,这里只是本地读取的临时实现,
 * 读法与 src/lib/api/client.ts 的请求拦截器一致(session_id 优先,其次 token)。
 */
export function realtimeAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const token = localStorage.getItem('session_id') || localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

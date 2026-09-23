/**
 * WebSocket 握手用的一次性票。
 *
 * 浏览器的 WebSocket 构造函数设不了请求头,凭据只能进 URL;session_id 进了 URL 就会落进网关
 * access log 和浏览器历史。所以 realtime-api 的所有 WebSocket(/ws/notify、数字人 / 语音 / 爬虫进度等)
 * 都只认 ?ticket=:连之前 POST /api/core/realtime/ticket(带 Authorization)换一张 60 秒的一次性票,
 * 用完即焚。每次(重)连都要重新换票,别缓存。
 */

import { adminClient } from '@/lib/api/client';

/** 换一张票。没登录 / 会话过期时抛错(调用方按「连不上」处理,退避重试或走轮询)。 */
export async function getRealtimeTicket(): Promise<string> {
  const res = await adminClient<{ ticket?: string }>('/realtime/ticket', { method: 'POST' });
  const ticket = res?.ticket;
  if (!ticket) throw new Error('no realtime ticket');
  return ticket;
}

/**
 * 换票并拼到 WebSocket 地址上。url 可以是绝对地址(ws/wss/http/https),也可以是 /api/... 这样的路径,
 * 返回同样形式。地址里残留的 token= / session_id= / 旧 ticket= 一并去掉:服务端已不认,留着只会把会话漏进日志。
 */
export async function withTicket(url: string): Promise<string> {
  const ticket = await getRealtimeTicket();
  const DUMMY = 'http://relative.invalid';
  const u = new URL(url, DUMMY);
  for (const k of ['token', 'session_id', 'sessionId', 'ticket']) u.searchParams.delete(k);
  u.searchParams.set('ticket', ticket);
  return u.origin === DUMMY && !url.startsWith(DUMMY) ? u.href.slice(DUMMY.length) : u.href;
}

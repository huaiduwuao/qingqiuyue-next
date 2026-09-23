/**
 * realtime-api WebSocket 的一次性票。
 *
 * 占位实现(stub):另一条分支会提供正式版本,合并时以那边为准。导出签名保持一致:
 * getRealtimeTicket() / withTicket(url)。
 *
 * 浏览器的 WebSocket 握手带不了 Authorization 头,凭据只能进 URL;直接放 session_id
 * 会落进网关日志和浏览器历史,所以先 POST /api/core/realtime/ticket 换一张短时一次性票。
 */

import { adminClient } from '@/lib/api/client';

/** 换一张新票。每次建连(含重连)都要重新换,票用过即失效。 */
export async function getRealtimeTicket(): Promise<string> {
  const res = (await adminClient('/realtime/ticket', { method: 'POST' })) as { ticket?: string } | undefined;
  const ticket = res?.ticket;
  if (!ticket) throw new Error('no realtime ticket');
  return ticket;
}

/** 给 WS 地址补上 ?ticket=(已有查询串时用 &) */
export async function withTicket(url: string): Promise<string> {
  const ticket = await getRealtimeTicket();
  return `${url}${url.includes('?') ? '&' : '?'}ticket=${encodeURIComponent(ticket)}`;
}

'use client';

/**
 * 数字人会话接口(/api/agentmanager/conversations*)的唯一出口。
 *
 * agentmanager 整组路由都挂了 session 鉴权,此前这里全是裸 fetch、不带 Authorization,
 * 于是列表恒为空、「新会话」恒 401 后悄悄退回本地会话。会话归属由后端按 session 判定,
 * 前端不再传 userId。
 */

const BASE = '/api/agentmanager/conversations';

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const t = localStorage.getItem('session_id') || localStorage.getItem('token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

export class ConversationApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init.headers as Record<string, string>) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = res.status === 401 ? '登录已失效,请重新登录' : body?.error || `HTTP ${res.status}`;
    throw new ConversationApiError(msg, res.status);
  }
  return res.json();
}

export interface RawConversation {
  id: number | string;
  title?: string;
  agentId?: number | string;
  updateTime?: string;
  createTime?: string;
}

export interface RawMessage {
  role: string;
  content: string;
}

export function listConversations(limit: number) {
  return call<{ list: RawConversation[]; total: number }>(`?limit=${limit}`);
}

export function createConversation(title = '新会话') {
  return call<RawConversation>('', { method: 'POST', body: JSON.stringify({ title }) });
}

export function listMessages(id: string) {
  return call<{ messages: RawMessage[] }>(`/${encodeURIComponent(id)}/messages`);
}

export function appendMessage(id: string, role: 'user' | 'assistant', content: string) {
  return call<unknown>(`/${encodeURIComponent(id)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ role, content }),
  });
}

export function renameConversation(id: string, title: string) {
  return call<unknown>(`/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ title }) });
}

/** 服务端会话 id 是数字;local-* 之类的本地占位不发往后端。 */
export function isServerConversationId(id: string | null | undefined): id is string {
  return !!id && /^\d+$/.test(id);
}

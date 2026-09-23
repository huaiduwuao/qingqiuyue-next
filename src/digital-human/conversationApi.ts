'use client';

/**
 * 数字人会话接口(/api/agentmanager/conversations*)的唯一出口。
 *
 * agentmanager 整组路由都挂了 session 鉴权,此前这里全是裸 fetch、不带 Authorization,
 * 于是列表恒为空、「新会话」恒 401 后悄悄退回本地会话。会话归属由后端按 session 判定,
 * 前端不再传 userId。
 *
 * Safari 注意:`res.json()` 在 body 不是合法 JSON(空 / HTML 错误页 / BOM)时会抛
 * `SyntaxError: The string did not match the expected pattern`(Chrome 会给更具体的
 * `Unexpected token ...` 信息)。前端 catch 不到这个细节,普通用户看到的「会话列表
 * 加载失败」其实就是这个错。因此 call() 用 text()+JSON.parse 兜底,先看清楚后端
 * 到底回了什么再决定抛什么错。
 */

import { API_PREFIX } from '@/lib/api/prefix';
import { authFetch } from '@/lib/api/auth';

const BASE = `${API_PREFIX}/api/agentmanager/conversations`;


export class ConversationApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** 把服务端 body 解读成 JSON。空 / HTML / BOM 都不会抛 SYNTAX_ERR。 */
async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  // BOM / 前后空白 / 非 JSON 头(HTML 错误页、空白响应)走兜底
  const trimmed = text.replace(/^﻿/, '').trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    // 不是 JSON:截前 120 字带回前端,免得 Safari 的含糊 SYNTAX_ERR 让用户一脸懵
    const snippet = trimmed.slice(0, 120).replace(/\s+/g, ' ');
    throw new ConversationApiError(`后端返回非 JSON 响应(${res.status}): ${snippet}`, res.status);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) },
  });
  if (!res.ok) {
    const body = await readJson(res).catch(() => ({}));
    const msg = res.status === 401 ? '登录已失效,请重新登录' : body?.error || `HTTP ${res.status}`;
    throw new ConversationApiError(msg, res.status);
  }
  return readJson(res);
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

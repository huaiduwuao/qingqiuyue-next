import { adminClient } from '@/lib/api/client';

// 在线客服(core-api /api/core/kf/*)。
//
// /kf-chat 之前根本没连这里:页面挂的是私信组件 ContactTalk,列出来的是用户的全部
// 私信会话 —— 客服后端(kf_session / kf_message)写好了却从来没人调用。

export interface KfMessage {
  id: number;
  sessionId: number;
  userId: number;
  /** system 是服务端自动回执(首次来访的欢迎语) */
  fromRole: 'user' | 'staff' | 'system';
  type: 'text' | 'image';
  content: string;
  staffId?: number;
  createTime: string;
}

export interface KfSession {
  id: number;
  userId: number;
  status: 'open' | 'closed';
  lastTime: string;
  lastMessage: string;
  unreadUser: number;
  unreadStaff: number;
  nickname?: string;
  avatar?: string;
}

export interface KfSummary {
  unread: number;
  status: 'open' | 'closed';
  serviceHours: string;
  hasSession: boolean;
}

// ── 用户侧 ────────────────────────────────────────────────────────────────

export async function getKfMessages(): Promise<{ list: KfMessage[]; serviceHours: string }> {
  const res = await adminClient('/kf/messages');
  return { list: res?.data?.list ?? [], serviceHours: res?.data?.serviceHours ?? '' };
}

export async function sendKfMessage(content: string, type: 'text' | 'image' = 'text'): Promise<KfMessage> {
  const res = await adminClient('/kf/message', { method: 'POST', data: { content, type } });
  return res?.data as KfMessage;
}

export async function getKfSummary(): Promise<KfSummary> {
  const res = await adminClient('/kf/summary');
  return res?.data as KfSummary;
}

export async function markKfRead(): Promise<void> {
  await adminClient('/kf/read', { method: 'POST', data: {} });
}

// ── 客服侧(内容运营及以上) ────────────────────────────────────────────────

export async function getKfSessions(status?: 'open' | 'closed'): Promise<KfSession[]> {
  const res = await adminClient('/kf/sessions', { params: status ? { status } : undefined });
  return res?.data?.list ?? [];
}

export async function getKfThread(userId: number): Promise<KfMessage[]> {
  const res = await adminClient('/kf/session/messages', { params: { userId } });
  return res?.data?.list ?? [];
}

export async function replyKf(userId: number, content: string, type: 'text' | 'image' = 'text'): Promise<KfMessage> {
  const res = await adminClient('/kf/reply', { method: 'POST', data: { userId, content, type } });
  return res?.data as KfMessage;
}

export async function markKfStaffRead(userId: number): Promise<void> {
  await adminClient('/kf/session/read', { method: 'POST', data: { userId } });
}

export async function closeKfSession(userId: number): Promise<void> {
  await adminClient('/kf/close', { method: 'POST', data: { userId } });
}

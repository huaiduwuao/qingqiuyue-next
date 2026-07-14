import { accountClient } from '@/lib/api/client';

// 消息系统 API

// 会话接口
export interface DMSession {
  id: number;
  userId: number;
  nickname: string;
  avatar: string;
  bio?: string;
  isFollowed: boolean;
  isOfficial: boolean;
  unread: number;
  lastMessage: string;
  lastMessageType: string;
  lastTime: string;
  pinned: boolean;
  doNotDisturb?: boolean;
}

// 消息接口
export interface DMMessage {
  id: number;
  sessionId: number;
  fromUserId: number;
  type: string;
  content: string;
  status: string;
  time: string;
}

// 获取会话列表
export async function getSessionList(): Promise<DMSession[]> {
  const res = await accountClient('/msg/session/list');
  return (res?.data?.list ?? []) as DMSession[];
}

// 获取会话详情
export async function getSessionDetail(id: number): Promise<DMSession> {
  const res = await accountClient('/msg/session/detail', { params: { id } });
  return res?.data as DMSession;
}

// 获取消息列表
export async function getMessageList(sessionId: number): Promise<DMMessage[]> {
  const res = await accountClient('/msg/message/list', { params: { sessionId } });
  return (res?.data?.list ?? []) as DMMessage[];
}

// 发送消息
export async function sendMessage(sessionId: number, content: string, type = 'text'): Promise<DMMessage> {
  const res = await accountClient('/msg/message/send', {
    method: 'POST',
    data: { sessionId, content, type }
  });
  return res?.data as DMMessage;
}

// 撤回消息
export async function recallMessage(msgId: number): Promise<void> {
  await accountClient('/msg/message/recall', { method: 'POST', data: { msgId } });
}

// 删除消息
export async function deleteMessage(id: number): Promise<void> {
  await accountClient(`/msg/message/${id}`, { method: 'DELETE' });
}

// 搜索消息
export async function searchMessages(keyword: string, page = 1): Promise<{ list: DMMessage[]; total: number }> {
  const res = await accountClient('/msg/message/search', { params: { keyword, page } });
  return {
    list: (res?.data?.records ?? []) as DMMessage[],
    total: res?.data?.totalRow ?? 0
  };
}

// 置顶会话
export async function pinSession(id: number): Promise<void> {
  await accountClient(`/msg/session/${id}/pin`, { method: 'POST' });
}

// 取消置顶
export async function unpinSession(id: number): Promise<void> {
  await accountClient(`/msg/session/${id}/unpin`, { method: 'POST' });
}

// 设置免打扰
export async function setDoNotDisturb(id: number, enabled: boolean): Promise<void> {
  await accountClient(`/msg/session/${id}/dnd`, { method: 'POST', data: { enabled } });
}

// 标记已读
export async function markSessionRead(id: number): Promise<void> {
  await accountClient('/msg/session/read', { method: 'POST', data: { id } });
}

// 删除会话
export async function removeSessions(ids: number[]): Promise<number> {
  const res = await accountClient('/msg/session/removeByIds', {
    method: 'DELETE',
    data: { ids }
  });
  return res?.data?.removed ?? 0;
}

// 关注/取消关注会话
export async function followSession(sessionId: number): Promise<void> {
  await accountClient('/msg/session/follow', { method: 'POST', data: { sessionId } });
}

export async function unfollowSession(sessionId: number): Promise<void> {
  await accountClient('/msg/session/unfollow', { method: 'POST', data: { sessionId } });
}

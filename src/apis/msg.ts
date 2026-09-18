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

// ── 富内容分享(作品 / 悬赏任务 / 歌单 / 活动 / 名片) ──────────────────────
//
// 发的时候只传 {kind,id,note}:标题、封面、角标一律由服务端查出来写进消息,
// 前端传什么都不作数(否则谁都能伪造一张卡片)。读的时候拿到的就是完整快照。

export type ShareKind = 'work' | 'bounty' | 'demand' | 'activity' | 'playlist' | 'user';

/** 消息体里存的卡片(后端 msgapp.ShareCard)。 */
export interface ShareCard {
  kind: ShareKind;
  id: string;
  title: string;
  subtitle?: string;
  cover?: string;
  badge?: string;
  meta?: string;
  /** 站内路由。作品类没有这个,用 contentType 拼(各类型详情页路由不同)。 */
  href?: string;
  note?: string;
  contentType?: string;
}

/** 选择器里的一行候选。 */
export interface ShareCandidate {
  kind: ShareKind;
  id: string;
  title: string;
  subtitle?: string;
  cover?: string;
  badge?: string;
  meta?: string;
  contentType?: string;
}

export interface ShareSource {
  key: string;
  label: string;
  kind: ShareKind;
}

/** 分享选择器的候选列表。sources 由后端给,前端不写死页签。 */
export async function getShareCandidates(
  source: string,
  keyword = '',
  page = 1,
): Promise<{ list: ShareCandidate[]; sources: ShareSource[] }> {
  const res = await accountClient('/msg/share/candidates', {
    params: { source, keyword: keyword || undefined, page, pageSize: 30 },
  });
  return { list: res?.data?.list ?? [], sources: res?.data?.sources ?? [] };
}

/** 把一件站内内容作为卡片发进会话。 */
export async function sendShareCard(
  sessionId: number,
  kind: ShareKind,
  id: string | number,
  note = '',
): Promise<DMMessage> {
  return sendMessage(sessionId, JSON.stringify({ kind, id: String(id), note }), 'card');
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

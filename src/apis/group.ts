import { contentClient } from '@/lib/api/client';

// ────────────────────────────────────────────────────────────────────────
// F1: 群组(Group)与团队(Team) — 同一份后端,group_type 区分
//   group = 兴趣聚类/粉丝群(聊天 + 打赏,成员平等)
//   team  = 商业协作/接单(队长 + 队员,按比例分账)
// ────────────────────────────────────────────────────────────────────────

export type GroupType = 'group' | 'team';
export type GroupRole = 'owner' | 'admin' | 'member';

export interface ChatGroup {
  id: number;
  ownerUserId: number;
  type: GroupType;
  name: string;
  bio?: string;
  avatar?: string;
  public: boolean;
  /** 自动加入:collection(合集专属群) / creator(创作者粉丝群) */
  autoJoinType?: 'collection' | 'creator';
  autoJoinRef?: number;
  memberCount: number;
  lastMessage?: string;
  lastTime?: string;
  createTime: string;
}

export interface GroupMember {
  id: number;
  groupId: number;
  userId: number;
  role: GroupRole;
  muted: boolean;
  nickname?: string;
  /** 万分比(10000=100%);团队成员的分账比例 */
  ratio?: number;
  joinTime: string;
}

export interface GroupMessage {
  id: number;
  groupId: number;
  fromUserId: number;
  type: 'text' | 'image' | 'system';
  content: string;
  mentions?: number[];
  status: 'active' | 'recalled';
  time: string;
}

export interface GroupView extends ChatGroup {
  myRole?: GroupRole;
  myMuted?: boolean;
  isMember?: boolean;
  ownerName?: string;
  ownerAvatar?: string;
}

export interface GroupInvite {
  id: number;
  groupId: number;
  token: string;
  inviter: number;
  invitee: number;
  expiresAt: string;
  maxUses: number;
  usedCount: number;
}

// ─── 群组 CRUD ───

export async function createGroup(data: {
  type: GroupType;
  name: string;
  bio?: string;
  avatar?: string;
  public?: boolean;
  autoJoinType?: 'collection' | 'creator';
  autoJoinRef?: number;
}): Promise<ChatGroup> {
  const res = await contentClient('/group/create', { method: 'POST', data });
  return (res as any)?.data ?? res;
}

export async function listMyGroups(params: {
  type?: GroupType;
  keyword?: string;
} = {}): Promise<{ list: ChatGroup[]; total: number }> {
  const res = await contentClient('/group/list', { params });
  return (res as any)?.data ?? res;
}

export async function getGroup(id: number): Promise<GroupView> {
  const res = await contentClient(`/group/${id}`);
  return (res as any)?.data ?? res;
}

export async function updateGroup(id: number, data: {
  name?: string;
  bio?: string;
  avatar?: string;
  public?: boolean;
}): Promise<{ ok: boolean }> {
  const res = await contentClient(`/group/${id}/update`, { method: 'POST', data });
  return (res as any)?.data ?? res;
}

export async function dismissGroup(id: number): Promise<{ ok: boolean }> {
  const res = await contentClient(`/group/${id}/dismiss`, { method: 'POST' });
  return (res as any)?.data ?? res;
}

// ─── 成员管理 ───

export async function joinGroup(id: number): Promise<{ ok: boolean }> {
  const res = await contentClient(`/group/${id}/join`, { method: 'POST' });
  return (res as any)?.data ?? res;
}

export async function leaveGroup(id: number): Promise<{ ok: boolean }> {
  const res = await contentClient(`/group/${id}/leave`, { method: 'POST' });
  return (res as any)?.data ?? res;
}

export async function listGroupMembers(id: number): Promise<{ list: GroupMember[]; total: number }> {
  const res = await contentClient(`/group/${id}/members`);
  return (res as any)?.data ?? res;
}

export async function kickGroupMember(groupId: number, userId: number): Promise<{ ok: boolean }> {
  const res = await contentClient(`/group/${groupId}/kick`, {
    method: 'POST',
    data: { userId },
  });
  return (res as any)?.data ?? res;
}

export async function setGroupMemberRole(groupId: number, userId: number, role: GroupRole): Promise<{ ok: boolean }> {
  const res = await contentClient(`/group/${groupId}/role`, {
    method: 'POST',
    data: { userId, role },
  });
  return (res as any)?.data ?? res;
}

export async function muteGroupMember(groupId: number, userId: number, muted: boolean): Promise<{ ok: boolean }> {
  const res = await contentClient(`/group/${groupId}/mute`, {
    method: 'POST',
    data: { userId, muted },
  });
  return (res as any)?.data ?? res;
}

// ─── 邀请 ───

export async function createGroupInvite(groupId: number, data: {
  invitee?: number;
  maxUses?: number;
  ttlSec?: number;
}): Promise<GroupInvite> {
  const res = await contentClient(`/group/${groupId}/invite`, { method: 'POST', data });
  return (res as any)?.data ?? res;
}

export async function acceptGroupInvite(token: string): Promise<ChatGroup> {
  const res = await contentClient(`/group/accept-invite`, {
    method: 'POST',
    params: { token },
  });
  return (res as any)?.data ?? res;
}

// ─── 消息 ───

export async function listGroupMessages(groupId: number, params: {
  before?: number;
  limit?: number;
} = {}): Promise<{ list: GroupMessage[]; total: number }> {
  const res = await contentClient(`/group/${groupId}/messages`, { params });
  return (res as any)?.data ?? res;
}

export async function sendGroupMessage(groupId: number, data: {
  type: 'text' | 'image';
  content: string;
  mentions?: number[];
}): Promise<GroupMessage> {
  const res = await contentClient(`/group/${groupId}/send`, { method: 'POST', data });
  return (res as any)?.data ?? res;
}

export async function recallGroupMessage(messageId: number): Promise<{ ok: boolean }> {
  const res = await contentClient(`/group/message/${messageId}/recall`, { method: 'POST' });
  return (res as any)?.data ?? res;
}

// ─── 自动加入(合集/创作者专属群) ───

export async function autoJoinGroup(refType: 'collection' | 'creator', refId: number): Promise<{ joined: number[] }> {
  const res = await contentClient('/group/auto-join', {
    params: { refType, refId },
  });
  return (res as any)?.data ?? res;
}

// ────────────────────────────────────────────────────────────────────────
// F2: 团队分账(只有 type='team' 的群才能用)
// ────────────────────────────────────────────────────────────────────────

export interface TeamSettlement {
  id: number;
  teamId: number;
  sourceType: string; // reward / bounty / order
  sourceId: number;
  totalCents: number;
  note?: string;
  createTime: string;
}

export async function settleTeam(teamId: number, data: {
  sourceType: string;
  sourceId?: number;
  totalCents: number;
  note?: string;
}): Promise<TeamSettlement> {
  const res = await contentClient(`/group/team/${teamId}/settle`, { method: 'POST', data });
  return (res as any)?.data ?? res;
}

export async function listTeamSettlements(teamId: number): Promise<{ list: TeamSettlement[]; total: number }> {
  const res = await contentClient(`/group/team/${teamId}/settlements`);
  return (res as any)?.data ?? res;
}

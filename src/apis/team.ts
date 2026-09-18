/**
 * 团队与实现。
 *
 * 平台的主线:人们聚在「意境」里 → 在意境里提「需求」→ 个人或「团队」认领并交付 →
 * 验收通过的交付成为一条「实现」,回到意境里成为它的内容 → 结账时按份额分账。
 *
 * 团队是稳定的用户集群:可以整体认领任务,赏金按认领那一刻的成员份额快照分。
 * 实现只由验收动作产生,没有"新建实现"的接口。
 *
 * 后端:qingqiuyue-go/internal/teamapp(挂在 /api/core)。
 */
import { rewardClient } from '@/lib/api/client';

export type TeamRole = 'owner' | 'admin' | 'member';
export type TeamMemberStatus = 'active' | 'invited' | 'applied';

export interface Team {
  id: number;
  name: string;
  intro: string;
  avatar: string;
  ownerId: number;
  /** 主场意境,0 = 没有 */
  topicId: number;
  memberCount: number;
  /** 验收通过的交付数 */
  realizedCount: number;
  /** 累计结账收入(分) */
  earnedCents: number;
  openJoin: boolean;
  status: 'active' | 'disbanded';
  createdAt?: string;
}

export interface MyTeam extends Team {
  myRole: TeamRole;
  myShare: number;
  myStatus: TeamMemberStatus;
}

export interface TeamMember {
  id: number;
  teamId: number;
  userId: number;
  role: TeamRole;
  /** 分账权重,不是百分比:2 / 1 / 1 就是 50% / 25% / 25% */
  share: number;
  status: TeamMemberStatus;
  nickname: string;
  avatar: string;
  isBot: boolean;
}

export interface Realization {
  id: number;
  demandId: number;
  taskId: number;
  topicId: number;
  userId: number;
  teamId: number;
  demandTitle: string;
  taskTitle: string;
  /** module_content.id,按字符串传(BIGINT);"0" = 只交了文字说明 */
  workId: string;
  workType: string;
  workTitle: string;
  workCover: string;
  amountCents: number;
  settledAt?: string | null;
  createdAt: string;
  // 列表接口附带
  nickname?: string;
  avatar?: string;
  teamName?: string;
}

const data = <T>(p: Promise<any>): Promise<T> => p.then((r) => (r?.data ?? r) as T);

export const listTeams = (params?: { topicId?: number; keyword?: string; page?: number; pageSize?: number }) =>
  data<{ list: Team[]; total: number }>(rewardClient('/team/list', { method: 'GET', params }));

export const myTeams = () => data<{ list: MyTeam[]; total: number }>(rewardClient('/team/mine', { method: 'GET' }));

export const getTeam = (id: number) =>
  data<{ team: Team; members: TeamMember[]; realizations: Realization[] }>(rewardClient(`/team/${id}`, { method: 'GET' }));

/** 我在这个团队里的身份;队长和管理员还能看到待处理的邀请与申请 */
export const getTeamManage = (id: number) =>
  data<{ my: TeamMember | null; pending: TeamMember[] }>(rewardClient(`/team/${id}/manage`, { method: 'GET' }));

export const createTeam = (body: { name: string; intro?: string; topicId?: number }) =>
  data<Team>(rewardClient('/team', { method: 'POST', data: body }));

export const updateTeam = (id: number, body: { intro: string; avatar: string; topicId: number; openJoin: boolean }) =>
  rewardClient(`/team/${id}`, { method: 'PUT', data: body });

export const disbandTeam = (id: number) => rewardClient(`/team/${id}/disband`, { method: 'POST' });

export const applyTeam = (id: number) => data<{ joined: boolean }>(rewardClient(`/team/${id}/apply`, { method: 'POST' }));

export const inviteToTeam = (id: number, userId: number) =>
  data<{ joined: boolean }>(rewardClient(`/team/${id}/invite`, { method: 'POST', data: { userId } }));

/** 接受邀请时 userId 是自己;同意申请时是申请人 */
export const acceptTeamRequest = (id: number, userId: number) =>
  rewardClient(`/team/${id}/accept`, { method: 'POST', data: { userId } });

/** 退队 / 拒绝邀请 / 撤回申请(userId 是自己),或踢人、拒绝申请(队长、管理员) */
export const removeTeamMember = (id: number, userId: number) =>
  rewardClient(`/team/${id}/remove`, { method: 'POST', data: { userId } });

export const setTeamMember = (id: number, body: { userId: number; role: TeamRole; share: number }) =>
  rewardClient(`/team/${id}/member`, { method: 'PUT', data: body });

/** 邀请时按昵称找人(至少两个字) */
export const teamCandidates = (id: number, keyword: string) =>
  data<{ list: TeamMember[] }>(rewardClient(`/team/${id}/candidates`, { method: 'GET', params: { keyword } }));

export const listRealizations = (params: {
  topicId?: number;
  teamId?: number;
  userId?: number;
  demandId?: number;
  page?: number;
  pageSize?: number;
}) => data<{ list: Realization[]; total: number }>(rewardClient('/realization/list', { method: 'GET', params }));

export const yuan = (cents?: number) => ((cents ?? 0) / 100).toFixed(2);

/** 意境页里的一条需求(公开只读,不登录也能看) */
export interface RealmDemand {
  id: number;
  topicId: number;
  topicTitle: string;
  title: string;
  subtitle: string;
  /** 赏金(元) */
  pay: number;
  status: 'PUBLISHED' | 'COMPLETED' | 'SETTLED';
  endTime?: string | null;
  userId: number;
  username: string;
  avatar: string;
  isBot: boolean;
  taskCount: number;
  openTaskCount: number;
  completedCount: number;
}

/** 一个意境里的需求;不传 topicId 列所有发在意境里的需求。status=all 连已完成、已结账的一起列 */
export const listRealmDemands = (params: { topicId?: number; status?: 'all'; page?: number; pageSize?: number }) =>
  data<{ list: RealmDemand[]; total: number }>(rewardClient('/realm/demands', { method: 'GET', params }));

/**
 * Reward task mock data — 悬赏项目下的协作任务(in-memory,刷新即重置)。
 *
 * 32 条种子:3 个项目 × 5 个状态 × 3 个优先级,assignee 覆盖 5 个虚拟成员。
 * 状态机由 handlers/reward-task.ts 校验,这里只暴露读写 + 工具函数。
 */

import { range, dateOffset, avatar } from '../utils/seed';
import type { RewardTask, RewardTaskStatus, TaskPriority } from '@/beans/reward';
import { refreshDemandProgress, appendRealizationFromTask } from './reward';

const T = (d: number, h = 10) => dateOffset(d, h);

const STATUSES: RewardTaskStatus[] = ['OPEN', 'CLAIMED', 'SUBMITTED', 'APPROVED', 'REJECTED'];
const PRIORITIES: TaskPriority[] = ['P0', 'P1', 'P2'];
const PROJECTS = [1, 2, 3];

const MEMBERS = [
  { id: 1, name: '当前用户', avatar: avatar(1) },
  { id: 10086, name: '青清秋月', avatar: avatar(10086) },
  { id: 20001, name: '墨羽', avatar: avatar(20001) },
  { id: 20002, name: '小桥流水', avatar: avatar(20002) },
  { id: 20003, name: '云深不知处', avatar: avatar(20003) },
  { id: 20004, name: '月下独酌', avatar: avatar(20004) },
];

const TITLES_BY_STATUS: Record<RewardTaskStatus, string[]> = {
  OPEN: [
    '设计人物角色立绘(2 张)',
    '撰写第 3 章初稿',
    '整理参考资料 + 素材清单',
    '搭建剧情大纲思维导图',
    '剪辑预告片 30 秒',
  ],
  CLAIMED: [
    '撰写第 5 章',
    '绘制分镜草图',
    '配乐试听 + 选曲',
    '字幕校对(英 → 中)',
  ],
  SUBMITTED: [
    '第 2 章插画(已交稿)',
    '宣发海报(待审)',
    '音效设计(待审)',
    '主角配音 demo(待审)',
  ],
  APPROVED: [
    '封面图设计',
    '第 1 章文案',
    '评论区运营话术',
    '片头动画 5 秒',
    'BGM 编曲',
  ],
  REJECTED: [
    '副标题文案(需重写)',
    '分镜 v2(构图待改)',
  ],
};

// 任务 ↔ 需求 静态映射(i 是 0-indexed,id = 2000+i):
//  APPROVED 任务可选 id: 2003, 2008, 2013, 2018, 2023, 2028 (i%5===3)
//  分配(一对一,每张 task 至多挂一个 demand):
//    demand 1 "开发登录功能"  → 2003(APPROVED), 2007(SUBMITTED)  1/2 进行中
//    demand 3 "优化数据库"    → 2013(APPROVED), 2018(APPROVED)    2/2 可结账
//    demand 4 "短片分镜"      → 2023(APPROVED), 2028(APPROVED)    SETTLED 历史
const TASK_DEMAND_MAP: Record<number, number> = {
  2003: 1, 2007: 1,
  2013: 3, 2018: 3,
  2023: 4, 2028: 4,
};

// 跨团队任务演示:id 2000/2005/2010/2015 (i=0/5/10/15) 同时挂到 group 1+2
const CROSS_TEAM_INDICES = new Set([0, 5, 10, 15]);

function build(i: number): RewardTask {
  const projectId = PROJECTS[i % PROJECTS.length];
  // 在 2 个团队间分布,跟项目无关:让"按团队"和"按项目"两个维度都能筛出有效数据
  const groupId = (i % 2) + 1;
  // 跨团队任务:[1, 2] 共享,体现一个需求/项目可被多团队协作
  const groupIds = CROSS_TEAM_INDICES.has(i) ? [1, 2] : [groupId];
  const status = STATUSES[i % STATUSES.length];
  const priority = PRIORITIES[(i >> 1) % PRIORITIES.length];
  const statusTitles = TITLES_BY_STATUS[status];
  const title = statusTitles[i % statusTitles.length];
  const demandId = TASK_DEMAND_MAP[2000 + i] ?? null;

  // OPEN/REJECTED 无 assignee,其他状态分配一个成员
  const isAssigned = status === 'CLAIMED' || status === 'SUBMITTED' || status === 'APPROVED';
  const member = isAssigned ? MEMBERS[(i + 1) % MEMBERS.length] : null;

  // deadline: P0 = 3 天内, P1 = 7 天, P2 = 14 天;部分过期
  const daysFromNow = priority === 'P0' ? 3 : priority === 'P1' ? 7 : 14;
  const isOverdue = i % 5 === 0;
  const deadline = T(isOverdue ? -1 * ((i % 3) + 1) : daysFromNow + (i % 5));

  const createdAt = T(7 + (i % 14), 9);
  const claimedAt = isAssigned ? T(3 + (i % 5), 11) : null;
  const submittedAt = status === 'SUBMITTED' || status === 'APPROVED' ? T(1 + (i % 3), 14) : status === 'REJECTED' ? T(2, 14) : null;
  const reviewedAt = status === 'APPROVED' || status === 'REJECTED' ? T(i % 3, 16) : null;

  return {
    id: 2000 + i,
    projectId,
    groupId,
    groupIds,
    demandId,
    title,
    description: `${title} —— 任务说明:\n\n1. 交付标准:符合项目风格指南\n2. 评审流程:负责人提交 → 项目主审稿\n3. 截止时间:见左侧截止日期\n\n(任务 ID: ${2000 + i})`,
    assigneeId: member?.id ?? null,
    assigneeName: member?.name ?? '',
    assigneeAvatar: member?.avatar ?? '',
    status,
    priority,
    deadline,
    deliverable: status === 'SUBMITTED' || status === 'APPROVED' ? 'https://internal.example.com/uploads/' + (2000 + i) : null,
    reviewNote: status === 'APPROVED' ? '通过 ✓ 质量达标' : status === 'REJECTED' ? '需要补充细节,详见评论' : null,
    createdBy: 10086,
    createdAt,
    updatedAt: T(i % 5, 18),
    claimedAt,
    submittedAt,
    reviewedAt,
  };
}

const TASKS: RewardTask[] = range(32).map(build);

export const REWARD_TASKS = TASKS;

export const REWARD_MEMBERS = MEMBERS;

export interface TaskListOpts {
  projectId?: number;
  groupId?: number;
  demandId?: number;
  status?: string;
  assigneeId?: number;
  priority?: string;
}

export function listTasks(opts: TaskListOpts = {}) {
  let list = [...TASKS];
  if (opts.projectId != null) list = list.filter((t) => t.projectId === opts.projectId);
  // groupId 升级语义:命中 groupIds 任一 OR 单值 groupId 等于
  if (opts.groupId != null) {
    list = list.filter((t) =>
      (Array.isArray(t.groupIds) && t.groupIds.includes(opts.groupId!)) ||
      t.groupId === opts.groupId
    );
  }
  if (opts.demandId != null) list = list.filter((t) => t.demandId === opts.demandId);
  if (opts.status) list = list.filter((t) => t.status === opts.status);
  if (opts.assigneeId != null) list = list.filter((t) => t.assigneeId === opts.assigneeId);
  if (opts.priority) list = list.filter((t) => t.priority === opts.priority);
  // 按 priority (P0 优先) + updatedAt 倒序
  const prioRank: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
  list.sort((a, b) => {
    const dp = (prioRank[a.priority || 'P2'] || 2) - (prioRank[b.priority || 'P2'] || 2);
    if (dp !== 0) return dp;
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });
  return list;
}

export function getTaskById(id: number | string) {
  return TASKS.find((t) => String(t.id) === String(id)) || null;
}

export function createTaskRecord(data: Partial<RewardTask>): RewardTask {
  const now = new Date().toISOString();
  const groupIds: number[] = Array.isArray(data.groupIds) && data.groupIds.length > 0
    ? data.groupIds
    : (data.groupId != null ? [data.groupId] : []);
  const rec: RewardTask = {
    id: 2000 + TASKS.length + 1,
    projectId: data.projectId,
    groupId: data.groupId ?? (groupIds[0] ?? null),
    groupIds,
    demandId: data.demandId ?? null,
    title: data.title,
    description: data.description,
    assigneeId: data.assigneeId ?? null,
    assigneeName: data.assigneeName ?? '',
    assigneeAvatar: data.assigneeAvatar ?? '',
    status: 'OPEN',
    priority: data.priority || 'P1',
    deadline: data.deadline || null,
    deliverable: null,
    reviewNote: null,
    createdBy: data.createdBy || 10086,
    createdAt: now,
    updatedAt: now,
    claimedAt: null,
    submittedAt: null,
    reviewedAt: null,
  };
  TASKS.push(rec);
  return rec;
}

export function updateTaskRecord(id: number | string, patch: Partial<RewardTask>): RewardTask | null {
  const t = getTaskById(id);
  if (!t) return null;
  Object.assign(t, patch, { updatedAt: new Date().toISOString() });
  return t;
}

export function deleteTaskRecord(id: number | string): boolean {
  const i = TASKS.findIndex((t) => String(t.id) === String(id));
  if (i < 0) return false;
  TASKS.splice(i, 1);
  return true;
}

const nowIso = () => new Date().toISOString();

export function claimTaskRecord(id: number | string, userId: number, userName: string, userAvatar: string): RewardTask | null {
  const t = getTaskById(id);
  if (!t) return null;
  if (t.status !== 'OPEN') return null;
  t.status = 'CLAIMED';
  t.assigneeId = userId;
  t.assigneeName = userName;
  t.assigneeAvatar = userAvatar;
  t.claimedAt = nowIso();
  t.updatedAt = t.claimedAt;
  return t;
}

export function submitTaskRecord(id: number | string, deliverable: string): RewardTask | null {
  const t = getTaskById(id);
  if (!t) return null;
  if (t.status !== 'CLAIMED' && t.status !== 'REJECTED') return null;
  t.status = 'SUBMITTED';
  t.deliverable = deliverable;
  t.submittedAt = nowIso();
  t.updatedAt = t.submittedAt;
  return t;
}

export function reviewTaskRecord(id: number | string, approved: boolean, note: string): RewardTask | null {
  const t = getTaskById(id);
  if (!t) return null;
  if (t.status !== 'SUBMITTED') return null;
  t.status = approved ? 'APPROVED' : 'REJECTED';
  t.reviewNote = note;
  t.reviewedAt = nowIso();
  t.updatedAt = t.reviewedAt;
  // 副作用:若 task 关联了 demand,同步刷新该 demand 的完成度 + 派生 Realization
  if (t.demandId != null) {
    refreshDemandProgress(t.demandId, TASKS);
    if (t.status === 'APPROVED') {
      appendRealizationFromTask(t);
    }
  }
  return t;
}

export function getProjectProgress(projectId: number) {
  const list = TASKS.filter((t) => t.projectId === projectId);
  const total = list.length;
  const approved = list.filter((t) => t.status === 'APPROVED').length;
  return { total, approved, percent: total > 0 ? Math.round((approved / total) * 100) : 0 };
}

export function getMyTasks(userId: number) {
  return TASKS.filter((t) => t.assigneeId === userId);
}

export function getGroupTaskCount(groupId: number) {
  return TASKS.filter((t) =>
    (Array.isArray(t.groupIds) && t.groupIds.includes(groupId)) || t.groupId === groupId
  ).length;
}

export function getGroupStats(groupId: number) {
  const list = TASKS.filter((t) =>
    (Array.isArray(t.groupIds) && t.groupIds.includes(groupId)) || t.groupId === groupId
  );
  const total = list.length;
  const approved = list.filter((t) => t.status === 'APPROVED').length;
  const inProgress = list.filter((t) => t.status === 'CLAIMED' || t.status === 'SUBMITTED').length;
  const open = list.filter((t) => t.status === 'OPEN').length;
  return { total, approved, inProgress, open, percent: total > 0 ? Math.round((approved / total) * 100) : 0 };
}

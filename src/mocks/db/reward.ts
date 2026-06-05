/**
 * Reward seed data — group / demand / project / conception / realization。
 *
 * Demand 状态枚举:PENDING / PUBLISHED / COMPLETED / SETTLED / CLOSED
 * (与 page.tsx: STATUS_MAP 同步)
 *
 * Demand ↔ Task 关联:demo 种子里:
 *   - demand 1 "开发登录功能"   PUBLISHED, taskIds: [2003, 2008, 2013] (3 张)
 *   - demand 2 "修复Bug"        PUBLISHED, taskIds: []  (空,展示"暂无任务"提示)
 *   - demand 3 "优化数据库"     COMPLETED, taskIds: [2020, 2025]  (2/2 完成,可结账)
 *   - demand 4 "短片分镜"       SETTLED,   settledAt+settlement 历史快照
 *
 * 注意:DEMANDS / CONCEPTION_PAGE.records / REALIZATIONS / GROUP_USERS 都是可变数组,
 * settle/unsettle/realization-派生/contribution 累加会写回。
 */

import { dateOffset } from '../utils/seed';

const T0 = dateOffset(0);
const Tm1 = dateOffset(-1);
const Tm7 = dateOffset(-7);
const Tm15 = dateOffset(-15);
const Tm30 = dateOffset(-30);
const T1 = dateOffset(30);
const T2 = dateOffset(60);
const T3 = dateOffset(90);

export const DEMANDS: any[] = [
  {
    id: 1,
    title: '开发登录功能',
    subtitle: '需要实现用户登录',
    content: '完成用户登录、注册、忘记密码三大流程,支持手机号 + 邮箱两种方式。\n\n验收标准:\n1. 登录响应 < 800ms\n2. 错误提示友好,5 次密码错误触发图形验证码\n3. 登录态支持 7 天免登录',
    pay: 100,
    status: 'PUBLISHED',
    groupId: 1,
    taskIds: [2003, 2007],
    completedCount: 0,
    totalTaskCount: 2,
    tags: ['前端', '认证', 'P0'],
    username: '张三',
    avatar: '',
    createTime: T0,
  },
  {
    id: 2,
    title: '修复首页加载慢的问题',
    subtitle: '首页首屏加载超过 5s,需要优化',
    content: '用户反馈首页白屏时间长,需要排查并优化。\n\n可能的方向:\n- 拆分首屏 bundle\n- 延迟非关键组件加载\n- SSR/ISR 改造',
    pay: 50,
    status: 'PUBLISHED',
    groupId: 1,
    taskIds: [],
    completedCount: 0,
    totalTaskCount: 0,
    tags: ['性能', '优化'],
    username: '李四',
    avatar: '',
    createTime: T1,
  },
  {
    id: 3,
    title: '优化数据库查询',
    subtitle: '订单查询接口需要 2s+,需要优化',
    content: '核心订单接口 P99 超过 2 秒,影响交易体验。\n\n已完成任务:\n- 索引重建(已完成)\n- 查询语句拆分(已完成)\n\n剩余工作:监控 + 灰度全量。',
    pay: 200,
    status: 'COMPLETED',
    groupId: 1,
    taskIds: [2013, 2018],
    completedCount: 2,
    totalTaskCount: 2,
    tags: ['后端', '性能', 'P1'],
    username: '王五',
    avatar: '',
    createTime: T2,
  },
  {
    id: 4,
    title: '短片分镜脚本',
    subtitle: '为宣传片撰写分镜脚本',
    content: '宣传片 90 秒,需 12 个镜头分镜,带构图/运镜说明。\n\n已结案:张三完成 6 段,李四完成 6 段,各分 ¥150。',
    pay: 300,
    status: 'SETTLED',
    groupId: 1,
    taskIds: [2023, 2028],
    completedCount: 2,
    totalTaskCount: 2,
    settledAt: Tm30,
    settlement: {
      demandId: 4,
      totalPay: 300,
      approvedCount: 2,
      distribution: [
        { assigneeId: 10086, assigneeName: '青清秋月', taskCount: 1, amount: 150 },
        { assigneeId: 20001, assigneeName: '墨羽', taskCount: 1, amount: 150 },
      ],
      completedAt: Tm7,
      settledAt: Tm30,
    },
    tags: ['创意', '分镜'],
    username: '赵六',
    avatar: '',
    createTime: T3,
  },
];

export const DEMAND_PAGE = {
  records: DEMANDS,
  totalRow: DEMANDS.length,
};

export const CONCEPTION_PAGE = {
  records: [
    { id: 1, title: 'AI助手创意', description: '基于AI的创意助手', status: 'OPEN', likes: 66, groupId: 1, demandId: 1, createTime: T0 },
    { id: 2, title: '区块链应用', description: '区块链技术应用探索', status: 'DOING', likes: 45, groupId: 1, createTime: T1 },
    { id: 3, title: '订单系统重构草案', description: '把订单表拆为订单主表 + 扩展表', status: 'DOING', likes: 38, groupId: 1, demandId: 3, createTime: T2 },
    { id: 4, title: '分镜视觉参考', description: '12 个镜头的运镜 + 光影参考', status: 'OPEN', likes: 27, groupId: 1, createTime: T3 },
  ],
  totalRow: 4,
};

export const CONCEPTION_LIST = {
  list: [
    { id: 1, title: 'AI助手创意', name: 'AI助手创意', description: '基于AI的创意助手', status: 'OPEN', likes: 66, groupId: 1, demandId: 1 },
    { id: 2, title: '区块链应用', name: '区块链应用', description: '区块链技术应用探索', status: 'DOING', likes: 45, groupId: 1 },
    { id: 3, title: '订单系统重构草案', name: '订单系统重构草案', description: '把订单表拆为订单主表 + 扩展表', status: 'DOING', likes: 38, groupId: 1, demandId: 3 },
    { id: 4, title: '分镜视觉参考', name: '分镜视觉参考', description: '12 个镜头的运镜 + 光影参考', status: 'OPEN', likes: 27, groupId: 1 },
  ],
  total: 4,
};

export const GROUP_PAGE = {
  records: [
    { id: 1, name: '前端开发组', info: '专注前端技术', cover: '', status: 'AGREE', createUser: 1, projects: 3, createTime: T0 },
    { id: 2, name: '后端开发组', info: '专注后端技术', cover: '', status: 'AGREE', createUser: 2, projects: 5, createTime: T1 },
  ],
  totalRow: 2,
};

export const PROJECT_PAGE = {
  records: [
    { id: 1, title: '用户中心项目', description: '开发用户中心模块', status: 'DOING', progress: 60, groupId: 1, createTime: T0 },
    { id: 2, title: '支付模块', description: '开发支付功能', status: 'PLANNING', progress: 10, groupId: 1, createTime: T1 },
    { id: 3, title: '消息系统', description: '开发站内消息', status: 'DONE', progress: 100, groupId: 1, createTime: T2 },
  ],
  totalRow: 3,
};

// 可变数组:contribution 会随 settle / unsettle 写入。导出数组引用 + 包装 list/total。
// 包含 5 个成员:前 3 是默认演示用户(张三/李四/王五),后 2 是种子任务实际归属的成员(青清秋月/墨羽),
// 后两者初始 contribution 各 150,反映需求 4 (短片分镜) 历史结算各分 150 的快照。
export const GROUP_USERS: any[] = [
  { id: 1, groupId: 1, userId: 1, nickname: '张三', username: 'zhangsan', role: 'ADMIN', contribution: 1500, createTime: T3 },
  { id: 2, groupId: 1, userId: 2, nickname: '李四', username: 'lisi', role: 'MEMBER', contribution: 980, createTime: T2 },
  { id: 3, groupId: 1, userId: 3, nickname: '王五', username: 'wangwu', role: 'MEMBER', contribution: 750, createTime: T1 },
  { id: 4, groupId: 1, userId: 10086, nickname: '青清秋月', username: 'qingqiuyue', role: 'MEMBER', contribution: 150, createTime: T0 },
  { id: 5, groupId: 1, userId: 20001, nickname: '墨羽', username: 'moyu', role: 'MEMBER', contribution: 150, createTime: T0 },
];

export const GROUP_USER_LIST = {
  get list() { return GROUP_USERS; },
  get total() { return GROUP_USERS.length; },
};

export const GROUP_SUGGEST = [
  { id: 1, name: '前端开发组', info: '专注前端技术', cover: '', status: 'AGREE' },
  { id: 2, name: '后端开发组', info: '专注后端技术', cover: '', status: 'AGREE' },
];

export const GROUP_WAIT = [
  { id: 1, groupId: 1, group: { name: '前端开发组' }, nickname: '赵六', avatar: '', createUser: 1 },
];

// 可变数组:task APPROVED → appendRealizationFromTask 派生追加。导出数组 + 包装 list/total。
export const REALIZATIONS: any[] = [
  { id: 1, title: '登录功能实现', description: '完成了用户登录功能', status: 'APPROVED', demandId: 1, userId: 1 },
  { id: 2, title: 'UI优化', description: '完成了界面优化', status: 'PENDING', demandId: 2, userId: 2 },
];

export const REALIZATION_LIST = {
  get list() { return REALIZATIONS; },
  get total() { return REALIZATIONS.length; },
};

// 幂等追踪:已派生的 taskId 集合,防止反结账/重审时重复追加
export const REALIZATION_TASK_IDS: number[] = [];

// 工具函数:取 demand 详情 / 更新 / 触发结账
export function getDemandRecord(id: number | string) {
  return DEMANDS.find((d) => String(d.id) === String(id)) || null;
}

export function getDemandByTaskId(taskId: number) {
  return DEMANDS.find((d) => Array.isArray(d.taskIds) && d.taskIds.includes(taskId)) || null;
}

export function refreshDemandProgress(demandId: number, allTasks: any[]) {
  const d = getDemandRecord(demandId);
  if (!d) return null;
  if (d.status === 'SETTLED' || d.status === 'CLOSED') return d;
  const taskIds: number[] = d.taskIds || [];
  const tasks = taskIds.map((tid) => allTasks.find((t) => t.id === tid)).filter(Boolean);
  const total = tasks.length;
  const approved = tasks.filter((t) => t.status === 'APPROVED').length;
  d.completedCount = approved;
  d.totalTaskCount = total;
  if (total > 0 && approved === total && d.status === 'PUBLISHED') {
    d.status = 'COMPLETED';
  } else if (total > 0 && approved < total && d.status === 'COMPLETED') {
    // 任务被删或回退,自动从 COMPLETED 退回 PUBLISHED
    d.status = 'PUBLISHED';
  }
  return d;
}

export function settleDemandRecord(demandId: number, allTasks: any[]) {
  const d = getDemandRecord(demandId);
  if (!d) return { ok: false, msg: '需求不存在' };
  if (d.status !== 'COMPLETED') {
    return { ok: false, msg: '需求未完成,无法结账(需所有关联任务都 APPROVED)' };
  }
  const taskIds: number[] = d.taskIds || [];
  const approvedTasks = taskIds
    .map((tid) => allTasks.find((t) => t.id === tid))
    .filter((t) => t && t.status === 'APPROVED');
  const totalPay = Number(d.pay || 0);
  const count = approvedTasks.length;
  if (count === 0) return { ok: false, msg: '没有可结算的已通过任务' };

  // 等额分账,余数归给最早 reviewedAt
  const base = Math.floor(totalPay / count);
  const remainder = totalPay - base * count;
  const sorted = [...approvedTasks].sort((a, b) => (a.reviewedAt || '').localeCompare(b.reviewedAt || ''));
  const acc = new Map<number, { name: string; count: number; amount: number }>();
  sorted.forEach((t, idx) => {
    const cur = acc.get(t.assigneeId) || { name: t.assigneeName || '匿名', count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += base + (idx === 0 ? remainder : 0);
    acc.set(t.assigneeId, cur);
  });

  const distribution = Array.from(acc.entries()).map(([id, v]) => ({
    assigneeId: id,
    assigneeName: v.name,
    taskCount: v.count,
    amount: v.amount,
  }));

  const now = new Date().toISOString();
  d.status = 'SETTLED';
  d.settledAt = now;
  d.settlement = {
    demandId: d.id,
    totalPay,
    approvedCount: count,
    distribution,
    completedAt: sorted[sorted.length - 1]?.reviewedAt || now,
    settledAt: now,
  };

  // 副作用:按 distribution 累加每个 contributor 的团队贡献度
  for (const item of distribution) {
    incrementContribution(d.groupId, item.assigneeId, item.amount);
  }

  return { ok: true, demand: d };
}

// 反结账:SETTLED → COMPLETED,回滚 contribution、清空 settlement
export function unsettleDemandRecord(demandId: number) {
  const d = getDemandRecord(demandId);
  if (!d) return { ok: false, msg: '需求不存在' };
  if (d.status !== 'SETTLED') {
    return { ok: false, msg: '需求未结账,无需反结账' };
  }
  if (d.settlement && Array.isArray(d.settlement.distribution)) {
    for (const item of d.settlement.distribution) {
      revertContribution(d.groupId, item.assigneeId, item.amount);
    }
  }
  d.status = 'COMPLETED';
  d.settledAt = null;
  d.settlement = null;
  return { ok: true, demand: d };
}

// ----- 团队贡献度工具 -----
export function getGroupUser(groupId: number, userId: number) {
  return GROUP_USERS.find((u) => u.groupId === groupId && u.userId === userId) || null;
}

export function incrementContribution(groupId: number, userId: number, amount: number) {
  const u = getGroupUser(groupId, userId);
  if (!u) return null;
  u.contribution = Number(u.contribution || 0) + amount;
  return u;
}

export function revertContribution(groupId: number, userId: number, amount: number) {
  const u = getGroupUser(groupId, userId);
  if (!u) return null;
  u.contribution = Number(u.contribution || 0) - amount;
  return u;
}

// ----- 意境 ↔ 需求 -----
export function getConceptionByDemandId(demandId: number) {
  return CONCEPTION_PAGE.records.filter((c: any) => c.demandId === demandId);
}

// ----- 实现派生(task APPROVED → 自动追加 Realization,幂等) -----
export function appendRealizationFromTask(task: any) {
  if (!task || task.status !== 'APPROVED' || !task.demandId) return null;
  if (REALIZATION_TASK_IDS.includes(task.id)) return null;
  const rec = {
    id: REALIZATIONS.length > 0 ? Math.max(...REALIZATIONS.map((r) => r.id)) + 1 : 1,
    title: '任务交付 — ' + (task.title || '未命名任务'),
    description: task.description || '',
    status: 'PENDING',
    demandId: task.demandId,
    taskId: task.id,
    userId: task.assigneeId,
    autoGenerated: true,
    createTime: new Date().toISOString(),
  };
  REALIZATIONS.push(rec);
  REALIZATION_TASK_IDS.push(task.id);
  return rec;
}

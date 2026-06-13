/**
 * Reward-task MSW handlers — 项目协作任务的 9 个端点。
 *
 * 端点:
 *   GET    /api/core/task/page
 *   GET    /api/core/task/{id}
 *   POST   /api/core/task
 *   PUT    /api/core/task/{id}
 *   DELETE /api/core/task/{id}
 *   POST   /api/core/task/{id}/claim
 *   POST   /api/core/task/{id}/submit
 *   POST   /api/core/task/{id}/review
 */

import { http, HttpResponse } from 'msw';
import {
  listTasks,
  getTaskById,
  createTaskRecord,
  updateTaskRecord,
  deleteTaskRecord,
  claimTaskRecord,
  submitTaskRecord,
  reviewTaskRecord,
  REWARD_MEMBERS,
} from '../db/reward-task';

const ok = <T,>(data: T) => HttpResponse.json({ code: 200, msg: 'OK', data });
const fail = (msg: string, code = 400) => HttpResponse.json({ code, msg }, { status: code });

export const rewardTaskHandlers = [
  // 列表
  http.get('*/api/core/task/page', ({ request }) => {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId');
    const groupId = url.searchParams.get('groupId');
    const demandId = url.searchParams.get('demandId');
    const status = url.searchParams.get('status');
    const assigneeId = url.searchParams.get('assigneeId');
    const priority = url.searchParams.get('priority');
    const page = Number(url.searchParams.get('page') || 1);
    const pageSize = Number(url.searchParams.get('pageSize') || 100);

    const records = listTasks({
      projectId: projectId ? Number(projectId) : undefined,
      groupId: groupId ? Number(groupId) : undefined,
      demandId: demandId ? Number(demandId) : undefined,
      status: status || undefined,
      assigneeId: assigneeId ? Number(assigneeId) : undefined,
      priority: priority || undefined,
    });

    return ok({
      records,
      totalRow: records.length,
      page,
      pageSize,
    });
  }),

  // 详情
  http.get(/\/api\/reward\/task\/\d+$/, ({ request }) => {
    const id = request.url.split('/').pop();
    const t = getTaskById(id!);
    if (!t) return fail('任务不存在', 404);
    return ok(t);
  }),

  // 新建
  http.post('*/api/core/task', async ({ request }) => {
    const body: any = await request.json();
    if (!body.title) return fail('标题必填', 400);
    const rec = createTaskRecord({
      projectId: body.projectId,
      groupId: body.groupId,
      demandId: body.demandId ?? null,
      title: body.title,
      description: body.description,
      priority: body.priority,
      deadline: body.deadline,
    });
    return ok(rec);
  }),

  // 更新
  http.put(/\/api\/reward\/task\/\d+$/, async ({ request }) => {
    const id = request.url.split('/').pop();
    const body: any = await request.json();
    const rec = updateTaskRecord(id!, body);
    if (!rec) return fail('任务不存在', 404);
    return ok(rec);
  }),

  // 删除
  http.delete(/\/api\/reward\/task\/\d+$/, ({ request }) => {
    const id = request.url.split('/').pop();
    const ok2 = deleteTaskRecord(id!);
    if (!ok2) return fail('任务不存在', 404);
    return ok({ success: true });
  }),

  // 领取 — 以请求 body 里的 userId 模拟"当前用户",默认 10086
  http.post(/\/api\/reward\/task\/\d+\/claim$/, async ({ request }) => {
    const id = request.url.split('/').slice(-2, -1)[0];
    const body: any = await request.json().catch(() => ({}));
    const userId = body?.userId ?? 10086;
    const member = REWARD_MEMBERS.find((m) => m.id === userId) || REWARD_MEMBERS[0];
    const t = claimTaskRecord(id, member.id, member.name, member.avatar);
    if (!t) return fail('任务状态不允许领取', 400);
    return ok(t);
  }),

  // 提交
  http.post(/\/api\/reward\/task\/\d+\/submit$/, async ({ request }) => {
    const id = request.url.split('/').slice(-2, -1)[0];
    const body: any = await request.json();
    if (!body?.deliverable) return fail('交付物必填', 400);
    const t = submitTaskRecord(id, body.deliverable);
    if (!t) return fail('任务状态不允许提交', 400);
    return ok(t);
  }),

  // 审稿
  http.post(/\/api\/reward\/task\/\d+\/review$/, async ({ request }) => {
    const id = request.url.split('/').slice(-2, -1)[0];
    const body: any = await request.json();
    const t = reviewTaskRecord(id, !!body?.approved, body?.note || '');
    if (!t) return fail('任务状态不允许审稿', 400);
    return ok(t);
  }),
];

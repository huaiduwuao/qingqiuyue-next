/**
 * Reward MSW handlers — group / demand / project / conception / realization 全部 CRUD。
 *
 * 端点路径对照表(由 reward/* api 文件确认):
 *  - /group/client/page        GET        分页
 *  - /group/suggest            GET        列表
 *  - /group/wait               GET        待审
 *  - /group                    POST       新建
 *  - /group/:id                GET/PUT/DEL
 *  - /group/:id/agree          PUT
 *  - /group/send               POST
 *  - /group-user/list          GET        (注:原 mock 重复注册 2 次,以最后一次为准)
 *  - /group-user/invite        POST
 *  - /demand/client/page       GET
 *  - /demand                   POST
 *  - /demand/:id               GET/PUT/DEL
 *  - /demand/process           POST
 *  - /project/client/page      GET
 *  - /project                  POST
 *  - /project/:id              GET/PUT/DEL
 *  - /conception/client/page   GET
 *  - /conception/list          GET
 *  - /conception               POST
 *  - /conception/:id           GET/PUT/DEL
 *  - /realization/list         GET
 *  - /realization              POST
 *  - /realization/:id          GET/PUT/DEL
 */

import { http, HttpResponse } from 'msw';
import {
  DEMAND_PAGE,
  DEMANDS,
  CONCEPTION_PAGE,
  CONCEPTION_LIST,
  GROUP_PAGE,
  PROJECT_PAGE,
  GROUP_USER_LIST,
  GROUP_SUGGEST,
  GROUP_WAIT,
  REALIZATION_LIST,
  getDemandRecord,
  settleDemandRecord,
  unsettleDemandRecord,
  getConceptionByDemandId,
} from '../db/reward';
import { REWARD_TASKS } from '../db/reward-task';

const ok = <T,>(data: T) => HttpResponse.json({ code: 200, msg: 'OK', data });
const fail = (msg: string, code = 400) => HttpResponse.json({ code, msg }, { status: code });

export const rewardHandlers = [
  // group list / paged
  http.get('*/api/reward/group/client/page', () => ok(GROUP_PAGE)),
  http.get('*/api/reward/group/suggest', () => ok(GROUP_SUGGEST)),
  http.get('*/api/reward/group/wait', () => ok(GROUP_WAIT)),
  http.post('*/api/reward/group', () => ok({ id: 3, name: '新团队', status: 'AGREE' })),
  http.get(/\/api\/reward\/group\/\d+$/, () => ok({ id: 1, name: '前端开发组', info: '专注前端技术', status: 'AGREE' })),
  http.put(/\/api\/reward\/group\/\d+$/, () => ok({ success: true })),
  http.delete(/\/api\/reward\/group\/\d+$/, () => ok({ success: true })),
  http.put(/\/api\/reward\/group\/\d+\/agree$/, () => ok({ success: true })),
  http.post('*/api/reward/group/send', () => ok({ success: true })),

  // group-user
  http.get('*/api/reward/group-user/list', () => ok(GROUP_USER_LIST)),
  http.post('*/api/reward/group-user/invite', () => ok({ success: true })),
  http.post('*/api/reward/group-user/agree/*', () => ok({ success: true })),
  http.post(/\/api\/reward\/group-user$/, () => ok({ id: (GROUP_USER_LIST.list?.length ?? 0) + 1, status: 'WAIT' })),
  http.put(/\/api\/reward\/group-user\/\d+$/, () => ok({ success: true })),
  http.delete(/\/api\/reward\/group-user\/\d+$/, () => ok({ success: true })),

  // demand
  http.get('*/api/reward/demand/client/page', () => ok(DEMAND_PAGE)),
  http.post('*/api/reward/demand', () => ok({ id: DEMANDS.length + 1, title: '新需求' })),
  http.get(/\/api\/reward\/demand\/\d+$/, ({ request }) => {
    const id = request.url.split('/').pop();
    const d = getDemandRecord(id!);
    if (!d) return fail('需求不存在', 404);
    return ok(d);
  }),
  http.put(/\/api\/reward\/demand\/\d+$/, async ({ request }) => {
    const id = request.url.split('/').pop();
    const d = getDemandRecord(id!);
    if (!d) return fail('需求不存在', 404);
    const body: any = await request.json().catch(() => ({}));
    if (Array.isArray(body.taskIds)) d.taskIds = body.taskIds;
    if (body.title != null) d.title = body.title;
    if (body.pay != null) d.pay = body.pay;
    if (body.status != null) d.status = body.status;
    return ok(d);
  }),
  http.delete(/\/api\/reward\/demand\/\d+$/, () => ok({ success: true })),
  http.post('*/api/reward/demand/process', () => ok({ success: true })),
  // 触发结账
  http.post(/\/api\/reward\/demand\/\d+\/settle$/, ({ request }) => {
    const id = request.url.split('/').slice(-2, -1)[0];
    const res: any = settleDemandRecord(Number(id), REWARD_TASKS);
    if (!res.ok) return fail(res.msg, 400);
    return ok(res.demand);
  }),
  // 反结账(SETTLED → COMPLETED,回滚 contribution)
  http.post(/\/api\/reward\/demand\/\d+\/unsettle$/, ({ request }) => {
    const id = request.url.split('/').slice(-2, -1)[0];
    const res: any = unsettleDemandRecord(Number(id));
    if (!res.ok) return fail(res.msg, 400);
    return ok(res.demand);
  }),

  // project
  http.get('*/api/reward/project/client/page', () => ok(PROJECT_PAGE)),
  http.post('*/api/reward/project', () => ok({ id: 4, title: '新项目' })),
  http.get(/\/api\/reward\/project\/\d+$/, () => ok({ id: 1, title: '用户中心项目', description: '开发用户中心模块', status: 'DOING' })),
  http.put(/\/api\/reward\/project\/\d+$/, () => ok({ success: true })),
  http.delete(/\/api\/reward\/project\/\d+$/, () => ok({ success: true })),

  // conception — page/list 支持 demandId 过滤(查询参数)
  http.get('*/api/reward/conception/client/page', ({ request }) => {
    const url = new URL(request.url);
    const demandId = url.searchParams.get('demandId');
    const demandIdNum = demandId ? Number(demandId) : null;
    if (demandIdNum) {
      return ok({ records: getConceptionByDemandId(demandIdNum), totalRow: 0 });
    }
    return ok(CONCEPTION_PAGE);
  }),
  http.get('*/api/reward/conception/list', ({ request }) => {
    const url = new URL(request.url);
    const demandId = url.searchParams.get('demandId');
    const demandIdNum = demandId ? Number(demandId) : null;
    if (demandIdNum) {
      const filtered = CONCEPTION_LIST.list.filter((c: any) => c.demandId === demandIdNum);
      return ok({ list: filtered, total: filtered.length });
    }
    return ok(CONCEPTION_LIST);
  }),
  http.post('*/api/reward/conception', () => ok({ id: 3, title: '新意境' })),
  http.get(/\/api\/reward\/conception\/\d+$/, () => ok({ id: 1, title: 'AI助手创意', description: '基于AI的创意助手', status: 'OPEN' })),
  http.put(/\/api\/reward\/conception\/\d+$/, () => ok({ success: true })),
  http.delete(/\/api\/reward\/conception\/\d+$/, () => ok({ success: true })),

  // realization — list 实时化(task APPROVED 派生追加)
  http.get('*/api/reward/realization/list', () => ok(REALIZATION_LIST)),
  http.post('*/api/reward/realization', () => ok({ id: 3, title: '新实现' })),
  http.get(/\/api\/reward\/realization\/\d+$/, () => ok({ id: 1, title: '登录功能实现', description: '完成了用户登录功能', status: 'APPROVED' })),
  http.put(/\/api\/reward\/realization\/\d+$/, () => ok({ success: true })),
  http.delete(/\/api\/reward\/realization\/\d+$/, () => ok({ success: true })),
];

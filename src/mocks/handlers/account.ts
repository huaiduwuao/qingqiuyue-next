/**
 * Account MSW handlers — 创作者中心端点已接入真实后端,
 * 这里保留占位 apply/status handler(高清发布/共创/合集/原创保护子域待后端接口),
 * 其余走 passthrough 让真实 /api/core/account/* 接管。
 */

import { http, HttpResponse, passthrough } from 'msw';
import { APPLICATION_STATUS } from '../db/account';

const ok = <T,>(data: T) => HttpResponse.json({ code: 200, msg: 'OK', data });

// 内存里 application 状态,方便 POST 后回读
const appState: Record<string, any> = { ...APPLICATION_STATUS };

export const accountHandlers = [
  // 已接入真实后端的创作者中心接口
  http.get('*/api/core/account/works', () => passthrough()),
  http.get('*/api/core/account/monetize/summary', () => passthrough()),
  http.get('*/api/core/account/interaction/comments', () => passthrough()),
  http.get('*/api/core/account/activity/list', () => passthrough()),

  // ─── 4 个 placeholder 状态(子域申请,后端接口未就绪时前端自持) ───
  ...['original', 'cocreate', 'collection', 'hd-publish'].map((key) =>
    http.get(`*/api/core/account/${key}/status`, () => ok(appState[key]))
  ),
  ...['original', 'cocreate', 'collection', 'hd-publish'].map((key) =>
    http.post(`*/api/core/account/${key}/apply`, async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as any;
      appState[key] = {
        applied: true,
        reviewedAt: new Date().toISOString(),
        message: `${key} 申请已提交`,
        payload: body,
      };
      return ok(appState[key]);
    })
  ),
];

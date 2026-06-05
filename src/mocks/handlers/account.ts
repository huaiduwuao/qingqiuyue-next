/**
 * Account MSW handlers — content 子页(works/data/monetize/interaction/activity)
 * + 5 个 placeholder 状态查询 + 申请提交。
 */

import { http, HttpResponse } from 'msw';
import {
  CREATOR_STATS,
  WORKS,
  DATA_OVERVIEW,
  MONETIZE_SUMMARY,
  COMMENTS,
  ACTIVITIES,
  APPLICATION_STATUS,
} from '../db/account';

const ok = <T,>(data: T) => HttpResponse.json({ code: 200, msg: 'OK', data });

// 内存里 application 状态,方便 POST 后回读
const appState: Record<string, any> = { ...APPLICATION_STATUS };

export const accountHandlers = [
  http.get('*/api/account/creator/stats', () => ok(CREATOR_STATS)),

  http.get('*/api/account/works', ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const page = Number(url.searchParams.get('page') || 1);
    const size = Number(url.searchParams.get('size') || 20);
    // 当前 works 都是空,type=image 时取 3 条作为 LIKES_PREVIEW
    if (type === 'image') {
      return ok({
        list: [
          { id: 1, title: '示例作品 1', cover: 'https://picsum.photos/seed/wp1/400/600', likes: 156 },
          { id: 2, title: '示例作品 2', cover: 'https://picsum.photos/seed/wp2/400/600', likes: 89 },
          { id: 3, title: '示例作品 3', cover: 'https://picsum.photos/seed/wp3/400/600', likes: 67 },
        ],
        total: 3, page, size,
      });
    }
    return ok({ list: WORKS.records, total: WORKS.totalRow, page, size });
  }),

  http.get('*/api/account/data/overview', () => ok(DATA_OVERVIEW)),

  http.get('*/api/account/monetize/summary', () => ok(MONETIZE_SUMMARY)),

  http.get('*/api/account/interaction/comments', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') || 1);
    const size = Number(url.searchParams.get('size') || 20);
    return ok({
      list: COMMENTS.records,
      total: COMMENTS.totalRow,
      page,
      size,
    });
  }),

  http.get('*/api/account/activity/list', () => ok({ list: ACTIVITIES, total: ACTIVITIES.length })),

  // ─── 5 个 placeholder 状态 ───
  ...['original', 'cocreate', 'collection', 'hd-publish'].map((key) =>
    http.get(`*/api/account/${key}/status`, () => ok(appState[key]))
  ),
  ...['original', 'cocreate', 'collection', 'hd-publish'].map((key) =>
    http.post(`*/api/account/${key}/apply`, async ({ request }) => {
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

/**
 * Module-content MSW handlers — 对齐 Go 后端 /api/content/module/content/* 端点。
 *
 * 端点(由 sql/doris/schema.sql + internal/handler/module.go 确认):
 *   GET    /api/content/module/content/list        分页列表
 *   GET    /api/content/module/content/{id}        详情
 *   DELETE /api/content/module/content/{id}        删除
 *   POST   /api/content/module/content/action      状态/检索切换
 */

import { http, HttpResponse } from 'msw';
import { getModuleContentPage, getModuleContentById } from '../db/module-content';

const ok = <T,>(data: T) => HttpResponse.json({ code: 200, msg: 'OK', data });
const okPage = (records: any[], totalRow: number, page: number, pageSize: number) =>
  HttpResponse.json({ code: 200, msg: 'OK', data: { records, totalRow, page, pageSize } });

export const moduleContentHandlers = [
  http.get('*/api/content/module/content/list', ({ request }) => {
    const url = new URL(request.url);
    const data = getModuleContentPage({
      page: Number(url.searchParams.get('page') || 1),
      pageSize: Number(url.searchParams.get('pageSize') || url.searchParams.get('page_size') || 20),
      moduleId: url.searchParams.get('moduleId') || undefined,
      groupId: url.searchParams.get('groupId') || undefined,
      contentType: url.searchParams.get('contentType') || undefined,
      status: url.searchParams.get('status') || undefined,
      source: url.searchParams.get('source') || undefined,
      title: url.searchParams.get('title') || undefined,
    });
    return okPage(data.records, data.totalRow, data.page, data.pageSize);
  }),

  http.get(/\/api\/content\/module\/content\/\d+$/, ({ request }) => {
    const id = Number(request.url.split('/').pop());
    const record = getModuleContentById(id);
    if (!record) return HttpResponse.json({ code: 404, msg: 'Not Found' }, { status: 404 });
    return ok(record);
  }),

  http.delete(/\/api\/content\/module\/content\/\d+$/, () => ok({ success: true })),

  http.post('*/api/content/module/content/action', () => ok({ success: true })),
];

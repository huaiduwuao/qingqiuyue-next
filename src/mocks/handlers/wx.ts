/**
 * WeChat MSW handlers — 公众号 4 子模块 (menu / user / msg / auto-reply) 共 18 端点。
 */

import { http, HttpResponse } from 'msw';
import { WX_MENU, WX_USER, WX_MSG, WX_AUTO_REPLY } from '../db/wx';

const ok = <T,>(data: T) => HttpResponse.json({ code: 200, msg: 'OK', data });
const okPage = <T,>(records: T[], totalRow: number) => ok({ records, totalRow, page: 1, pageSize: 20 });

export const wxHandlers = [
  // ─── wxMenu 6 端点 ───
  http.get('*/api/core/wxMenu/client/page', () => okPage(WX_MENU.records, WX_MENU.totalRow)),
  http.get('*/api/core/wxMenu/client/get', () => ok(WX_MENU.records[0])),
  http.post('*/api/core/wxMenu/client/publish', () => ok({ published: true, publishedAt: new Date().toISOString() })),
  http.delete('*/api/core/wxMenu/removeByIds', () => ok({ removed: 1 })),
  http.post('*/api/core/wxMenu/save', () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.post('*/api/core/wxMenu/updateById', () => ok({ updated: 1 })),

  // ─── wxUser 4 端点 ───
  http.get('*/api/core/wxUser/client/page', () => okPage(WX_USER.records, WX_USER.totalRow)),
  http.delete('*/api/core/wxUser/removeByIds', () => ok({ removed: 1 })),
  http.post('*/api/core/wxUser/save', () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.post('*/api/core/wxUser/updateById', () => ok({ updated: 1 })),

  // ─── wxMsg 4 端点 ───
  http.get('*/api/core/wxMsg/client/page', () => okPage(WX_MSG.records, WX_MSG.totalRow)),
  http.delete('*/api/core/wxMsg/removeByIds', () => ok({ removed: 1 })),
  http.post('*/api/core/wxMsg/save', () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.post('*/api/core/wxMsg/updateById', () => ok({ updated: 1 })),

  // ─── wxAutoReply 4 端点 ───
  http.get('*/api/core/wxAutoReply/client/page', () => okPage(WX_AUTO_REPLY.records, WX_AUTO_REPLY.totalRow)),
  http.delete('*/api/core/wxAutoReply/removeByIds', () => ok({ removed: 1 })),
  http.post('*/api/core/wxAutoReply/save', () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.post('*/api/core/wxAutoReply/updateById', () => ok({ updated: 1 })),
];

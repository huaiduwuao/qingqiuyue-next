/**
 * WeChat MSW handlers — 公众号 4 子模块 (menu / user / msg / auto-reply) 共 18 端点。
 */

import { http, HttpResponse } from 'msw';
import { WX_MENU, WX_USER, WX_MSG, WX_AUTO_REPLY, WX_MSG_REPLY_PRESETS } from '../db/wx';

const ok = <T,>(data: T) => HttpResponse.json({ code: 200, msg: 'OK', data });
const okPage = <T,>(records: T[], totalRow: number) => ok({ records, totalRow, page: 1, pageSize: 20 });

export const wxHandlers = [
  // ─── wxMenu 6 端点 ───
  http.get('*/api/wx/wxMenu/client/page', () => okPage(WX_MENU.records, WX_MENU.totalRow)),
  http.get('*/api/wx/wxMenu/client/get', () => ok(WX_MENU.records[0])),
  http.post('*/api/wx/wxMenu/client/publish', () => ok({ published: true, publishedAt: new Date().toISOString() })),
  http.delete('*/api/wx/wxMenu/removeByIds', () => ok({ removed: 1 })),
  http.post('*/api/wx/wxMenu/save', () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.post('*/api/wx/wxMenu/updateById', () => ok({ updated: 1 })),

  // ─── wxUser 4 端点 ───
  http.get('*/api/wx/wxUser/client/page', () => okPage(WX_USER.records, WX_USER.totalRow)),
  http.delete('*/api/wx/wxUser/removeByIds', () => ok({ removed: 1 })),
  http.post('*/api/wx/wxUser/save', () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.post('*/api/wx/wxUser/updateById', () => ok({ updated: 1 })),

  // ─── wxMsg 4 端点 ───
  http.get('*/api/wx/wxMsg/client/page', () => okPage(WX_MSG.records, WX_MSG.totalRow)),
  http.delete('*/api/wx/wxMsg/removeByIds', () => ok({ removed: 1 })),
  http.post('*/api/wx/wxMsg/save', () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.post('*/api/wx/wxMsg/updateById', () => ok({ updated: 1 })),

  // ─── wxAutoReply 4 端点 ───
  http.get('*/api/wx/wxAutoReply/client/page', () => okPage(WX_AUTO_REPLY.records, WX_AUTO_REPLY.totalRow)),
  http.delete('*/api/wx/wxAutoReply/removeByIds', () => ok({ removed: 1 })),
  http.post('*/api/wx/wxAutoReply/save', () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.post('*/api/wx/wxAutoReply/updateById', () => ok({ updated: 1 })),
];

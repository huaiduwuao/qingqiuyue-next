/**
 * Account MSW handlers — 创作者中心端点已全部接入真实后端，
 * 所有接口走 passthrough 让后端接管。
 */

import { http, passthrough } from 'msw';

export const accountHandlers = [
  // 创作者中心 — 全部走真实后端
  http.get('*/api/core/account/works', () => passthrough()),
  http.get('*/api/core/account/monetize/summary', () => passthrough()),
  http.get('*/api/core/account/interaction/comments', () => passthrough()),
  http.get('*/api/core/account/activity/list', () => passthrough()),
];

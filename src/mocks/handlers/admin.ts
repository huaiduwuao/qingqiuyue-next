/**
 * Admin MSW handlers — user / dict / menu / app/config / module-menu / point / user-relation.
 * URL 全部 wildcard 形式以兼容各 baseURL.
 */

import { http, HttpResponse } from 'msw';
import { CURRENT_USER,
  MENU_LIST,
  MODULE_TYPE_DICT,
  DICT_TYPE_LIST,
  DICT_DATA_BY_TYPE,
  MODULE_MENU_TREE,
  USER_POINT,
  USER_RELATION_PAGE } from '../db/user';

const ok = <T,>(data: T) => HttpResponse.json({ code: 200, msg: 'OK', data });

export const adminHandlers = [
  http.get('*/api/core/dict/type/list', () => ok(DICT_TYPE_LIST)),

  http.get('*/api/core/dict/data/all/module-type', () => ok(DICT_DATA_BY_TYPE)),

  http.get('*/api/core/user/current', () => ok(CURRENT_USER)),

  http.get('*/api/core/menu/list', () => ok(MENU_LIST)),

  http.get('*/api/core/menu/me', () => ok(MENU_LIST)),

  http.get('*/api/core/dict/data/all', () => ok([MODULE_TYPE_DICT])),

  // 公开登录(router.go:74 public group)
  http.post('*/api/core/login', () => ok({ token: 'mock-token-12345', user: CURRENT_USER })),

  // 旧路径兼容
  http.post('*/api/core/user/login', () => ok({ token: 'mock-token-12345', user: CURRENT_USER })),

  http.get('*/api/core/module/menu/clientTree', () => ok(MODULE_MENU_TREE)),

  http.get('*/api/core/point/user', () => ok(USER_POINT)),

  http.get('*/api/core/user-relation/list', () => ok(USER_RELATION_PAGE)),
];

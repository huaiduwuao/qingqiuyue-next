/**
 * Admin (system) MSW handlers — 110+ endpoints 覆盖 12 个 system 页面。
 * 涵盖 user / role / menu / dict / app / app/config / appService / resource / permission / data-permission / area / website-dict / notice / user-contact / point / sign / chart / sms / content / menu / module-menu。
 */

import { http, HttpResponse } from 'msw';
import {
  SYS_USER,
  SYS_USER_LEVEL,
  SYS_USER_POINT,
  SYS_ROLE,
  SYS_MENU,
  SYS_DICT_TYPE,
  SYS_DICT_DATA,
  SYS_APP,
  SYS_APP_CONFIG,
  SYS_APP_SERVICE,
  SYS_RESOURCE,
  SYS_DATA_PERMISSION,
  SYS_PROVINCE,
  SYS_CITY,
  SYS_STREET,
  SYS_WEBSITE_DICT,
  NOTICE_LIST,
  USER_CONTACT,
  USER_CONTACT_GROUP,
  USER_CONTACT_RECENT,
  NOTICE_INTERACTION,
  NOTICE_SYSTEM,
  DM_SESSIONS,
  DM_MESSAGES,
  USER_SIGN,
  USER_RELATION,
  USER_PROFILE,
  DASHBOARD_RADAR,
  MODULE_MENU_TREE,
  DASHBOARD_STATS,
  DASHBOARD_TREND,
  DASHBOARD_CONTENT_DISTRIBUTION,
  DASHBOARD_TOP_CREATORS,
  DASHBOARD_RECENT_ACTIVITIES,
  WORKPLACE_USER,
  WORKPLACE_QUICK_ACTIONS,
  WORKPLACE_TODOS,
  WORKPLACE_PROJECTS,
  WORKPLACE_TEAM,
  DH_ASSETS,
  DH_RECENT_JOBS,
} from '../db/system';

const ok = <T,>(data: T) => HttpResponse.json({ code: 200, msg: 'OK', data });
const okPage = <T,>(records: T[], totalRow: number) => ok({ records, totalRow, page: 1, pageSize: 20 });
const okList = <T,>(list: T[], total: number) => ok({ list, total });
const okSuggest = <T,>(list: T[]) => ok(list);

export const systemHandlers = [
  // ─── user ───
  http.get('*/api/core/user/page', () => okPage(SYS_USER.records, SYS_USER.totalRow)),
  http.get(/\/api\/admin\/user\/\d+$/, ({ params }) => {
    const id = Number((params as Record<string, string[]>)[0]);
    return ok(SYS_USER.records.find((u) => u.id === id) || SYS_USER.records[0]);
  }),
  http.get('*/api/core/user/list', () => okList(SYS_USER.records, SYS_USER.totalRow)),
  // REST(对齐后端 admin-api): POST /user 新建, PUT /user/:id 更新, DELETE /user/:id 删除
  http.post(/\/api\/admin\/user$/, () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.put(/\/api\/admin\/user\/\d+$/, () => ok({ updated: 1 })),
  http.delete(/\/api\/admin\/user\/\d+$/, () => ok({ removed: 1 })),
  http.get('*/api/core/user', () => ok(USER_PROFILE)),
  http.get('*/api/core/user/profile', () => ok(USER_PROFILE)),
  http.post('*/api/core/user/systemAdd', () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.post('*/api/core/user/systemUpdate', () => ok({ updated: 1 })),
  http.post('*/api/core/user/updateMe', () => ok(USER_PROFILE)),
  http.put('*/api/core/user/updateMe', () => ok(USER_PROFILE)),
  http.post('*/api/core/user/checkPassword', () => ok({ valid: true })),
  http.post('*/api/core/user/roleAdd', () => ok({ added: 1 })),
  http.post('*/api/core/user/logout', () => ok({ success: true })),
  http.post('*/api/core/user/upload', () => ok({ url: 'https://picsum.photos/seed/avatar-upload/200/200' })),
  http.get('*/api/core/user/name/available', () => ok({ available: true })),
  http.get('*/api/core/user/connectList', () => okList([], 0)),
  http.delete(/\/api\/admin\/user\/removeByIds.*/, () => ok({ removed: 1 })),

  // ─── userLevel ───
  http.get('*/api/core/userLevel/client/page', () => okPage(SYS_USER_LEVEL.records, SYS_USER_LEVEL.totalRow)),
  http.post('*/api/core/userLevel/save', () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.post('*/api/core/userLevel/updateById', () => ok({ updated: 1 })),
  http.delete(/\/api\/admin\/userLevel\/removeByIds.*/, () => ok({ removed: 1 })),

  // ─── userRole ───
  http.delete(/\/api\/admin\/userRole\/removeByIds.*/, () => ok({ removed: 1 })),

  // ─── role ───
  http.get('*/api/core/role/page', () => okPage(SYS_ROLE.records, SYS_ROLE.totalRow)),
  // REST(对齐后端 admin-api)
  http.get('*/api/core/role/list', () => okList(SYS_ROLE.records, SYS_ROLE.totalRow)),
  http.post(/\/api\/admin\/role\/\d+\/permissions$/, () => ok({ assigned: 1 })),
  http.post(/\/api\/admin\/role\/\d+\/data-permissions$/, () => ok({ assigned: 1 })),
  http.post(/\/api\/admin\/role$/, () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.put(/\/api\/admin\/role\/\d+$/, () => ok({ updated: 1 })),
  http.delete(/\/api\/admin\/role\/\d+$/, () => ok({ removed: 1 })),
  http.post('*/api/core/role/save', () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.post('*/api/core/role/updateById', () => ok({ updated: 1 })),
  http.post('*/api/core/role/menuChange', () => ok({ updated: 1 })),
  http.post('*/api/core/role/permissionAdd', () => ok({ added: 1 })),
  http.post('*/api/core/role/dataPermissionAdd', () => ok({ added: 1 })),
  http.post('*/api/core/role/userAdd', () => ok({ added: 1 })),
  http.get('*/api/core/role/suggestUser', () => okSuggest(SYS_USER.records.slice(0, 10).map((u) => ({ id: u.id, nickname: u.nickname, avatar: u.avatar })))),
  http.get('*/api/core/role/suggestPermission', () => okSuggest(SYS_RESOURCE.records.slice(0, 10))),
  http.get('*/api/core/role/suggestDataPermission', () => okSuggest(SYS_DATA_PERMISSION.records)),
  http.delete(/\/api\/admin\/role\/removeByIds.*/, () => ok({ removed: 1 })),

  http.delete(/\/api\/admin\/rolePermission\/removeByIds.*/, () => ok({ removed: 1 })),
  http.delete(/\/api\/admin\/roleDataPermission\/removeByIds.*/, () => ok({ removed: 1 })),

  // ─── menu ───
  http.get('*/api/core/menu', () => ok(SYS_MENU.records)),
  http.get('*/api/core/menu/list', () => ok(SYS_MENU.records)),
  http.get('*/api/core/menu/me', () => ok(SYS_MENU.records)),
  http.post('*/api/core/menu/save', () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.post('*/api/core/menu/updateById', () => ok({ updated: 1 })),
  http.put(/\/api\/admin\/menu\/\d+$/, () => ok({ updated: 1 })),
  http.delete(/\/api\/admin\/menu\/removeByIds.*/, () => ok({ removed: 1 })),

  // ─── moduleMenu (content 子域) ───
  http.get('*/api/content/module/menu/client/list', () => okList(SYS_MENU.records, SYS_MENU.totalRow)),
  http.get('*/api/content/module/menu/client/page', () => okPage(SYS_MENU.records, SYS_MENU.totalRow)),
  http.get('*/api/content/module/menu/client/tree', () => ok(MODULE_MENU_TREE)),
  http.post('*/api/content/module/menu/save', () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.post('*/api/content/module/menu/updateById', () => ok({ updated: 1 })),
  http.delete(/\/api\/content\/module\/menu\/removeByIds.*/, () => ok({ removed: 1 })),

  // ─── dict ───
  http.get('*/api/core/dict/data/list', () => okList(SYS_DICT_DATA, SYS_DICT_DATA.length)),
  http.get('*/api/core/dict/data/all', () => okList(SYS_DICT_DATA, SYS_DICT_DATA.length)),
  http.get('*/api/core/dict/data/all/module-type', () => okList(SYS_DICT_DATA.filter((d) => d.typeId === 1), 9)),
  // dict REST(对齐后端 /dict/type/* 与 /dict/data/*)
  http.get('*/api/core/dict/type/list', () => okList(SYS_DICT_TYPE.records, SYS_DICT_TYPE.totalRow)),
  http.get('*/api/core/dict/data/all/*', () => okList(SYS_DICT_DATA, SYS_DICT_DATA.length)),
  http.post(/\/api\/admin\/dict\/type$/, () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.put(/\/api\/admin\/dict\/type\/\d+$/, () => ok({ updated: 1 })),
  http.delete(/\/api\/admin\/dict\/type\/\d+$/, () => ok({ removed: 1 })),
  http.get(/\/api\/admin\/dict\/type\/\d+$/, () => ok(SYS_DICT_TYPE.records[0])),
  http.post(/\/api\/admin\/dict\/data$/, () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.put(/\/api\/admin\/dict\/data\/\d+$/, () => ok({ updated: 1 })),
  http.delete(/\/api\/admin\/dict\/data\/\d+$/, () => ok({ removed: 1 })),
  http.get(/\/api\/admin\/dict\/data\/\d+$/, () => ok(SYS_DICT_DATA[0])),

  // ─── sysDictType ───
  http.get('*/api/core/sysDictType/list', () => okList(SYS_DICT_TYPE.records, SYS_DICT_TYPE.totalRow)),
  http.get('*/api/core/sysDictType/listType', () => okList(SYS_DICT_TYPE.records, SYS_DICT_TYPE.totalRow)),
  http.get('*/api/core/sysDictType/page', () => okPage(SYS_DICT_TYPE.records, SYS_DICT_TYPE.totalRow)),
  http.post('*/api/core/sysDictType/save', () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.post('*/api/core/sysDictType/updateById', () => ok({ updated: 1 })),
  http.delete(/\/api\/admin\/sysDictType\/removeByIds.*/, () => ok({ removed: 1 })),

  // ─── sysDictData ───
  http.get('*/api/core/sysDictData/list', () => okList(SYS_DICT_DATA, SYS_DICT_DATA.length)),
  http.get('*/api/core/sysDictData/listType', () => okList(SYS_DICT_DATA, SYS_DICT_DATA.length)),
  http.get('*/api/core/sysDictData/page', () => okPage(SYS_DICT_DATA, SYS_DICT_DATA.length)),
  http.post('*/api/core/sysDictData/save', () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.post('*/api/core/sysDictData/updateById', () => ok({ updated: 1 })),
  http.delete(/\/api\/admin\/sysDictData\/removeByIds.*/, () => ok({ removed: 1 })),

  // ─── app/config (REST,对齐后端;必须在 /app/:id 之前注册) ───
  http.get('*/api/core/app/config/listByMap', () => okList(SYS_APP_CONFIG.list, SYS_APP_CONFIG.total)),
  http.get('*/api/core/app/config/list', () => okList(SYS_APP_CONFIG.list, SYS_APP_CONFIG.total)),
  http.post(/\/api\/admin\/app\/config$/, () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.put(/\/api\/admin\/app\/config\/\d+$/, () => ok({ updated: 1 })),
  http.delete(/\/api\/admin\/app\/config\/\d+$/, () => ok({ removed: 1 })),

  // ─── app/service (REST) ───
  http.get('*/api/core/app/service/listApp', () => okList(SYS_APP_SERVICE.list, SYS_APP_SERVICE.list.length)),
  http.get('*/api/core/app/service/list', () => okList(SYS_APP_SERVICE.list, SYS_APP_SERVICE.list.length)),
  http.post(/\/api\/admin\/app\/service$/, () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.put(/\/api\/admin\/app\/service\/\d+$/, () => ok({ updated: 1 })),
  http.delete(/\/api\/admin\/app\/service\/\d+$/, () => ok({ removed: 1 })),

  // ─── app (REST) ───
  http.get('*/api/core/app/list', () => okList(SYS_APP.records, SYS_APP.records.length)),
  http.post(/\/api\/admin\/app$/, () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.put(/\/api\/admin\/app\/\d+$/, () => ok({ updated: 1 })),
  http.delete(/\/api\/admin\/app\/\d+$/, () => ok({ removed: 1 })),

  // ─── resource ───
  http.get('*/api/core/resource/list', () => okList(SYS_RESOURCE.records, SYS_RESOURCE.totalRow)),
  http.get('*/api/core/resource/page', () => okPage(SYS_RESOURCE.records, SYS_RESOURCE.totalRow)),
  http.post('*/api/core/resource/save', () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.post('*/api/core/resource/updateById', () => ok({ updated: 1 })),
  http.put(/\/api\/admin\/resource\/\d+$/, () => ok({ updated: 1 })),
  http.post('*/api/core/resource/sync', () => ok({ synced: 1 })),
  http.delete(/\/api\/admin\/resource\/removeByIds.*/, () => ok({ removed: 1 })),

  // ─── permission (老) ───
  http.get('*/api/core/permission/list', () => okList(SYS_RESOURCE.records, SYS_RESOURCE.totalRow)),
  http.get('*/api/core/permission/page', () => okPage(SYS_RESOURCE.records, SYS_RESOURCE.totalRow)),
  http.post('*/api/core/permission/save', () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.post('*/api/core/permission/updateById', () => ok({ updated: 1 })),
  http.delete(/\/api\/admin\/permission\/removeByIds.*/, () => ok({ removed: 1 })),

  // ─── point records ───
  http.get('*/api/core/point/records', () => okPage(SYS_USER_POINT.history, SYS_USER_POINT.history.length)),
  http.get('*/api/core/point/page', () => okPage(SYS_USER_POINT.history, SYS_USER_POINT.history.length)),

  // ─── area/page ───
  http.get('*/api/core/area/page', () => okPage(SYS_PROVINCE, SYS_PROVINCE.length)),
  http.get('*/api/core/area/list', () => okList(SYS_PROVINCE, SYS_PROVINCE.length)),

  // ─── data-permission ───
  http.get('*/api/core/data-permission/list', () => okList(SYS_DATA_PERMISSION.records, SYS_DATA_PERMISSION.totalRow)),
  http.get('*/api/core/dataPermission/list', () => okList(SYS_DATA_PERMISSION.records, SYS_DATA_PERMISSION.totalRow)),

  // ─── area (省/市/区) ───
  http.get('*/api/core/area/provinces', () => okList(SYS_PROVINCE, SYS_PROVINCE.length)),
  http.get('*/api/core/sysProvince/page', () => okPage(SYS_PROVINCE, SYS_PROVINCE.length)),
  http.post('*/api/core/sysProvince/save', () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.post('*/api/core/sysProvince/updateById', () => ok({ updated: 1 })),
  http.delete(/\/api\/admin\/sysProvince\/removeByIds.*/, () => ok({ removed: 1 })),

  http.get('*/api/core/sysCity/page', () => okPage(SYS_CITY.records, SYS_CITY.totalRow)),
  http.post('*/api/core/sysCity/save', () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.post('*/api/core/sysCity/updateById', () => ok({ updated: 1 })),
  http.delete(/\/api\/admin\/sysCity\/removeByIds.*/, () => ok({ removed: 1 })),

  http.get('*/api/core/sysStreet/page', () => okPage(SYS_STREET.records, SYS_STREET.totalRow)),
  http.post('*/api/core/sysStreet/save', () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.post('*/api/core/sysStreet/updateById', () => ok({ updated: 1 })),
  http.delete(/\/api\/admin\/sysStreet\/removeByIds.*/, () => ok({ removed: 1 })),

  // 旧 /area 路径(简化)
  http.get(/\/api\/admin\/area\/provinces.*/, () => okList(SYS_PROVINCE, SYS_PROVINCE.length)),
  http.post('*/api/core/area/save', () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.post('*/api/core/area/update', () => ok({ updated: 1 })),
  http.put('*/api/core/area/update', () => ok({ updated: 1 })),
  http.post('*/api/core/area/remove', () => ok({ removed: 1 })),
  http.delete('*/api/core/area/remove', () => ok({ removed: 1 })),
  http.get('*/api/core/area/cities/*', () => okList(SYS_PROVINCE, SYS_PROVINCE.length)),
  http.get('*/api/core/area/areas/*', () => okList(SYS_PROVINCE, SYS_PROVINCE.length)),
  http.get('*/api/core/area/streets/*', () => okList(SYS_PROVINCE, SYS_PROVINCE.length)),

  // ─── website-dict ───
  http.get('*/api/core/sysWebsiteDict/client/page', () => okPage(SYS_WEBSITE_DICT.records, SYS_WEBSITE_DICT.totalRow)),
  http.post('*/api/core/sysWebsiteDict/saveBatch', () => ok({ added: 1 })),
  http.post('*/api/core/sysWebsiteDict/updateById', () => ok({ updated: 1 })),
  http.delete(/\/api\/admin\/sysWebsiteDict\/removeByIds.*/, () => ok({ removed: 1 })),

  // ─── notice ───
  http.get('*/api/core/notice/list', () => okList(NOTICE_LIST.records, NOTICE_LIST.totalRow)),
  http.get('*/api/core/notice/size', () => ok({ total: NOTICE_LIST.totalRow, unread: 3 })),
  http.post('*/api/core/notice/update', () => ok({ updated: 1 })),
  http.get('*/api/core/notice/client/historyChat', () => okList([], 0)),
  http.get('*/api/core/notice/pullStream', () => okList([], 0)),

  // ─── point ───
  http.get('*/api/core/point/user', () => ok(SYS_USER_POINT)),
  http.get('*/api/core/userPoint', () => ok(SYS_USER_POINT)),
  http.put('*/api/core/point/update', () => ok({ updated: 1 })),
  http.post('*/api/core/point/unlock', () => ok({ unlocked: true })),
  http.post('*/api/core/point/remove', () => ok({ removed: 1 })),

  // ─── chart (dashboard) ───
  http.get('*/api/core/chart/radar', () => ok(DASHBOARD_RADAR)),

  // ─── sms ───
  http.post('*/api/core/sms/send', () => ok({ sent: true, expireAt: new Date(Date.now() + 300000).toISOString() })),
  http.post('*/api/core/sms/verify', () => ok({ verified: true })),

  // ─── authentication ───
  http.post('*/api/core/authentication/openid', () => ok({ openid: 'o6_bmjrPTlm6_2sgVt7hMZOPfL_demo', token: 'mock-token-67890' })),

  // ─── content (admin 域里嵌的) ───
  http.post('*/api/content/parse', () => ok({ parsed: true, type: 'novel', fields: ['title', 'author', 'content'] })),
  http.post('*/api/content/collect', () => ok({ collected: 12 })),
  http.post('*/api/content/report', () => ok({ reported: true, reportId: 9999 })),
  http.get('*/api/content/search', () => okList([], 0)),
  http.post('*/api/content/file/upload', () => ok({ url: 'https://picsum.photos/seed/upload/200/200', filename: 'demo.jpg' })),
  http.post('*/api/core/file/upload', () => ok({ url: 'https://picsum.photos/seed/upload/200/200', filename: 'demo.jpg' })),
  http.get('*/api/content/novelBookshelf/my', () => okList([], 0)),
  http.post('*/api/content/novelBookshelf/remove', () => ok({ removed: 1 })),
  http.get('*/api/content/question/qa', () => okList([], 0)),
  http.post('*/api/content/question/qa', () => ok({ id: 9999 })),
  http.get('*/api/core/question/qa', () => okList([], 0)),

  // ─── user-relation (社交) ───
  http.get('*/api/core/user-relation/list', () => okList(USER_RELATION.followers, USER_RELATION.followers.length)),
  http.get('*/api/core/user-relation/record', () => okList(USER_RELATION.following, USER_RELATION.following.length)),

  // ─── user-sign ───
  http.get('*/api/core/user-sign/hasSign', () => ok(USER_SIGN.hasSign)),
  http.get('*/api/core/user-sign/record', () => ok(USER_SIGN.record)),
  http.post('*/api/core/user-sign/sign', () => ok({ signed: true, point: 10, continuousDays: USER_SIGN.continuousDays + 1 })),

  // ─── user-activity ───
  http.get('*/api/core/user-activity/list', () => okList([], 0)),

  // ─── userContact (社交联系人) ───
  http.get('*/api/core/userContact/client/list', () => okList(USER_CONTACT.records, USER_CONTACT.totalRow)),
  http.post('*/api/core/userContact/agree', () => ok({ agreed: true })),
  http.post('*/api/core/userContact/send', () => ok({ sent: true, requestId: 9999 })),
  http.delete(/\/api\/admin\/userContact\/removeByIds.*/, () => ok({ removed: 1 })),

  // ─── userContactGroup ───
  http.get('*/api/core/userContactGroup/client/list', () => okList(USER_CONTACT_GROUP.records, USER_CONTACT_GROUP.totalRow)),
  http.get('*/api/core/userContactGroup/client/suggest', () => okSuggest(USER_CONTACT_GROUP.records.slice(0, 5))),
  http.post('*/api/core/userContactGroup/create', () => ok({ id: 9999 })),
  http.post('*/api/core/userContactGroup/invite', () => ok({ invited: 1 })),
  http.post('*/api/core/userContactGroup/agree', () => ok({ agreed: true })),
  http.post('*/api/core/userContactGroup/send', () => ok({ sent: true })),

  // ─── userContactRecent ───
  http.get('*/api/core/userContactRecent/client/list', () => okList(USER_CONTACT_RECENT, USER_CONTACT_RECENT.length)),
  http.post('*/api/core/userContactRecent/client/insert', () => ok({ id: 9999 })),
  http.post('*/api/core/userContactRecentExt/client/process', () => ok({ processed: true })),

  // ─── 通知中心 ───
  http.get('*/api/core/notice/interaction/list', ({ request }) => {
    const url = new URL(request.url);
    const subType = url.searchParams.get('subType') || 'all';
    let records = NOTICE_INTERACTION.records;
    if (subType !== 'all') {
      const map: Record<string, string[]> = {
        comment: ['comment'],
        mention: ['mention'],
        like: ['like'],
        follow: ['follow'],
        friend: [],
      };
      const allowed = map[subType] || [];
      records = records.filter((r) => allowed.includes(r.type));
    }
    return okList(records, records.length);
  }),
  http.get('*/api/core/notice/system/list', () => okList(NOTICE_SYSTEM.records, NOTICE_SYSTEM.totalRow)),
  http.get('*/api/core/notice/count', () => ok({
    interaction: NOTICE_INTERACTION.records.filter((r) => r.unread).length,
    system: NOTICE_SYSTEM.records.filter((r) => r.unread).length,
    total: NOTICE_INTERACTION.records.filter((r) => r.unread).length + NOTICE_SYSTEM.records.filter((r) => r.unread).length,
  })),
  http.post('*/api/core/notice/read', () => ok({ updated: 1 })),
  http.post('*/api/core/notice/readAll', () => ok({ updated: 1 })),

  // ─── 私信 ───
  http.get('*/api/core/msg/session/list', () => okList(DM_SESSIONS, DM_SESSIONS.length)),
  http.get('*/api/core/msg/session/detail', ({ request }) => {
    const id = Number(new URL(request.url).searchParams.get('id') || 1);
    const session = DM_SESSIONS.find((s) => s.id === id) || DM_SESSIONS[0];
    return ok(session);
  }),
  http.get('*/api/core/msg/message/list', ({ request }) => {
    const id = Number(new URL(request.url).searchParams.get('sessionId') || 1);
    return okList(DM_MESSAGES[id] || DM_MESSAGES[1] || [], (DM_MESSAGES[id] || DM_MESSAGES[1] || []).length);
  }),
  http.post('*/api/core/msg/message/send', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { sessionId?: number; content?: string; type?: string };
    return ok({
      id: Math.floor(Math.random() * 1000) + 99999,
      sessionId: body.sessionId,
      fromUserId: 2000,
      type: body.type || 'text',
      content: body.content || '',
      time: new Date().toISOString(),
      status: 'sent',
    });
  }),
  http.post('*/api/core/msg/session/follow', () => ok({ followed: true })),
  http.post('*/api/core/msg/session/unfollow', () => ok({ unfollowed: true })),
  http.post('*/api/core/msg/session/read', () => ok({ read: true })),
  http.delete(/\/api\/admin\/msg\/session\/removeByIds.*/, () => ok({ removed: 1 })),

  // ─── dashboard/analysis ───
  http.get('*/api/core/dashboard/stats', () => ok(DASHBOARD_STATS)),
  http.get('*/api/core/dashboard/trend', () => ok(DASHBOARD_TREND)),
  http.get('*/api/core/dashboard/content-distribution', () => ok(DASHBOARD_CONTENT_DISTRIBUTION)),
  http.get('*/api/core/dashboard/top-creators', () => ok(DASHBOARD_TOP_CREATORS)),
  http.get('*/api/core/dashboard/recent-activities', () => ok(DASHBOARD_RECENT_ACTIVITIES)),

  // ─── workplace ───
  http.get('*/api/core/workplace/user', () => ok(WORKPLACE_USER)),
  http.get('*/api/core/workplace/quick-actions', () => ok(WORKPLACE_QUICK_ACTIONS)),
  http.get('*/api/core/workplace/todos', () => ok(WORKPLACE_TODOS)),
  http.post('*/api/core/workplace/todo/toggle', () => ok({ updated: 1 })),
  http.get('*/api/core/workplace/projects', () => ok(WORKPLACE_PROJECTS)),
  http.get('*/api/core/workplace/team', () => ok(WORKPLACE_TEAM)),

  // ─── digital-human assets ───
  http.get('*/api/core/digital-human/assets', () => ok(DH_ASSETS)),
  http.get('*/api/core/digital-human/recent-jobs', () => ok(DH_RECENT_JOBS)),
  http.post('*/api/core/digital-human/job/start', () => ok({ id: Math.floor(Math.random() * 1000) + 9999, status: 'queued' })),

  // ─── moderation ───
  http.get('*/api/core/moderation/sensitive-words', () =>
    ok([
      { id: 1, word: '赌博', level: 2, category: 'illegal', status: 'active', createdAt: '2026-01-01T00:00:00Z' },
      { id: 2, word: '色情', level: 2, category: 'porn', status: 'active', createdAt: '2026-01-01T00:00:00Z' },
      { id: 3, word: '淫秽', level: 2, category: 'porn', status: 'active', createdAt: '2026-01-01T00:00:00Z' },
      { id: 4, word: '暴力', level: 1, category: 'violence', status: 'active', createdAt: '2026-01-01T00:00:00Z' },
      { id: 5, word: '自杀', level: 1, category: 'danger', status: 'active', createdAt: '2026-01-01T00:00:00Z' },
    ]),
  ),
  http.post('*/api/core/moderation/sensitive-words', () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.delete(/\/api\/core\/moderation\/sensitive-words\/\d+/, () => ok({ deleted: 1 })),
  http.get('*/api/core/moderation/reports', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || '';
    const allReports = [
      { id: 1, reporterId: 100, targetType: 'chat', targetId: 1, reason: '发布不当言论', status: 'pending', createdAt: '2026-06-01T10:00:00Z' },
      { id: 2, reporterId: 101, targetType: 'video', targetId: 2, reason: '涉及色情内容', status: 'resolved', reviewerId: 1, reviewNote: '确认违规，已下架', reviewedAt: '2026-06-02T10:00:00Z', createdAt: '2026-06-01T11:00:00Z' },
      { id: 3, reporterId: 102, targetType: 'image', targetId: 3, reason: '暴力血腥', status: 'rejected', reviewerId: 1, reviewNote: '经核实不违规', reviewedAt: '2026-06-02T12:00:00Z', createdAt: '2026-06-01T12:00:00Z' },
      { id: 4, reporterId: 103, targetType: 'user', targetId: 4, reason: '头像含低俗内容', status: 'pending', createdAt: '2026-06-03T09:00:00Z' },
    ];
    const filtered = status ? allReports.filter((r) => r.status === status) : allReports;
    return okPage(filtered, filtered.length);
  }),
  http.post(/\/api\/core\/moderation\/reports\/\d+\/review/, () => ok({ reviewed: true })),
  http.post('*/api/core/moderation/check-media', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { url?: string };
    const lower = (body.url || '').toLowerCase();
    const hit = ['adult', 'porn', 'sex', 'violence', 'blood', 'terror'].some((kw) => lower.includes(kw));
    return ok({
      passed: !hit,
      riskLevel: hit ? 3 : 0,
      categories: hit ? ['porn'] : [],
      confidence: hit ? 0.92 : 0,
      reason: hit ? '命中模拟风险内容' : '',
    });
  }),
];

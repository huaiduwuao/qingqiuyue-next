/**
 * Content MSW handlers — 170+ endpoints 覆盖 30+ 个内容子页 + module 子域。
 */

import { http, HttpResponse } from 'msw';
import {
  BANNERS,
  CATEGORIES,
  MODULE_MENUS,
  MODULE_LISTS,
  MODULE_LIST,
  MODULE_TAGS,
  MODULE_SOURCES,
  MODULE_TEMPLATES,
  MODULE_TEMPLATE_ATTRS,
  MODULE_CONTENTS,
  MODULE_CONTENT_TOPLISTS,
  MODULE_CONTENT_TOPLIST_ITEMS,
  MODULE_DETAILS,
  MODULE_CONTENT_ACTION_PAGE,
  NOVEL_CHAPTERS,
  CONTENT_TYPE_ENDPOINTS,
  MODULE_BANNERS,
  MODULE_CATEGORIES,
  MODULE_TAGS_LIST,
  MODULE_TEMPLATES_LIST,
  MODULE_TEMPLATE_ATTRS_LIST,
  MODULE_TOPLISTS,
  MODULE_TOPLIST_ITEMS,
  CLIENT_CONTENT_SEED,
  QUESTION_LIST,
} from '../db/content';

const ok = <T,>(data: T) => HttpResponse.json({ code: 200, msg: 'OK', data });
const okPage = <T,>(records: T[], totalRow: number) => ok({ records, totalRow, page: 1, pageSize: 20 });
const okList = <T,>(list: T[], total: number) => ok({ list, total });

const CONTENT_TYPES: Array<{ type: string; prefix: string }> = [
  { type: 'article', prefix: 'article' },
  { type: 'video', prefix: 'video' },
  { type: 'music', prefix: 'music' },
  { type: 'music-playlist', prefix: 'musicPlaylist' },
  { type: 'novel', prefix: 'novel' },
  { type: 'novel-chapter', prefix: 'novelChapter' },
  { type: 'novel-bookshelf', prefix: 'novelBookshelf' },
  { type: 'live', prefix: 'live' },
  { type: 'news', prefix: 'news' },
  { type: 'pan', prefix: 'pan' },
  { type: 'picture-album', prefix: 'pictureAlbum' },
  { type: 'picture-detail', prefix: 'pictureDetail' },
  { type: 'teleplay', prefix: 'teleplay' },
  { type: 'teleplay-item', prefix: 'teleplayItem' },
  { type: 'film', prefix: 'film' },
  { type: 'film-item', prefix: 'filmItem' },
  { type: 'vshow', prefix: 'vshow' },
  { type: 'vshow-item', prefix: 'vshowItem' },
  { type: 'animation', prefix: 'animation' },
  { type: 'animation-item', prefix: 'animationItem' },
  { type: 'comics', prefix: 'comics' },
  { type: 'comics-item', prefix: 'comicsItem' },
  { type: 'spider-queue', prefix: 'spiderQueue' },
  { type: 'todo-queue', prefix: 'todoQueue' },
  { type: 'urls', prefix: 'urls' },
  { type: 'website', prefix: 'website' },
];

const contentTypeHandlers: any[] = [];

for (const t of CONTENT_TYPES) {
  const base = `*/api/content/client-content/${t.type}`;
  const seed = CLIENT_CONTENT_SEED[t.type];

  contentTypeHandlers.push(http.get(`${base}/page`, () => okPage(seed.records, seed.totalRow)));
  contentTypeHandlers.push(http.get(`${base}/detail`, ({ request }) => {
    const id = Number(new URL(request.url).searchParams.get('id') || 1);
    return ok(seed.records.find((r) => r.id === id) || seed.records[0]);
  }));
  contentTypeHandlers.push(http.get(`${base}/list`, () => okList(seed.records, seed.totalRow)));

  if (t.type === 'music-playlist') {
    contentTypeHandlers.push(http.get(`${base}/musicList`, () => okList(CLIENT_CONTENT_SEED.music.records, CLIENT_CONTENT_SEED.music.totalRow)));
  }

  contentTypeHandlers.push(http.get(`${base}/suggest`, () => ok(seed.records.slice(0, 8).map((r) => ({ id: r.id, title: r.title })))));
  contentTypeHandlers.push(http.post(`${base}/save`, () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })));
  contentTypeHandlers.push(http.post(`${base}/update`, () => ok({ updated: 1 })));
  contentTypeHandlers.push(http.post(`${base}/process`, () => ok({ processed: true })));

  if (t.type === 'teleplay' || t.type === 'vshow') {
    contentTypeHandlers.push(http.post(`${base}/updateAndPublish`, () => ok({ updated: 1, published: true })));
  }

  if (t.type === 'novel-bookshelf') {
    contentTypeHandlers.push(http.post(`${base}/add`, () => ok({ added: true })));
  }

  if (t.type === 'teleplay-item' || t.type === 'vshow-item' || t.type === 'film-item' || t.type === 'comics-item' || t.type === 'animation-item') {
    contentTypeHandlers.push(http.get(`${base}/get`, ({ request }) => {
      const id = Number(new URL(request.url).searchParams.get('id') || 1);
      return ok(seed.records.find((r) => r.id === id) || seed.records[0]);
    }));
    contentTypeHandlers.push(http.post(`${base}/sync`, () => ok({ synced: 1 })));
  }

  if (t.type === 'novel-chapter') {
    contentTypeHandlers.push(http.post(`${base}/sync`, () => ok({ synced: 1 })));
  }

  contentTypeHandlers.push(http.delete(`${base}/removeByIds`, () => ok({ removed: 1 })));

  // 通用 saveOrUpdate — 6 个 generic content-* (animation/comics/film/music/novel/video) 走这条
  contentTypeHandlers.push(http.post(`${base}/saveOrUpdate`, () => ok({ id: Date.now(), updated: 1 })));
}

export const contentHandlers = [
  // content 主资源 REST(对齐后端 content-api: POST /content, GET/PUT/DELETE /content/:id)
  http.post(/\/api\/content\/content$/, () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.put(/\/api\/content\/content\/\d+$/, () => ok({ updated: 1 })),
  http.delete(/\/api\/content\/content\/\d+$/, () => ok({ removed: 1 })),
  http.get('*/api/content/banners', () => ok(BANNERS)),
  http.get('*/api/content/categories', () => ok(CATEGORIES)),
  http.get('*/api/content/module-menus', () => ok(MODULE_MENUS)),
  http.get('*/api/content/module-lists', () => ok(MODULE_LISTS)),
  http.get('*/api/content/module/list', () => ok(MODULE_LIST)),
  http.get('*/api/content/module-tags', () => ok(MODULE_TAGS)),
  http.get('*/api/content/module-sources', () => ok(MODULE_SOURCES)),
  http.get('*/api/content/module-templates', () => ok(MODULE_TEMPLATES)),
  http.get('*/api/content/module-template-attrs', () => ok(MODULE_TEMPLATE_ATTRS)),
  http.get('*/api/content/module-contents', () => ok(MODULE_CONTENTS)),
  http.get('*/api/content/module-content-toplists', () => ok(MODULE_CONTENT_TOPLISTS)),
  http.get('*/api/content/module-content-toplist-items', () => ok(MODULE_CONTENT_TOPLIST_ITEMS)),
  http.get('*/api/content/module-details', () => ok(MODULE_DETAILS)),
  http.get('*/api/content/module/content/action/page', () => ok(MODULE_CONTENT_ACTION_PAGE)),

  ...Object.entries(CONTENT_TYPE_ENDPOINTS).map(([path, def]) => {
    return http.get(`*/api/content${path}`, () =>
      ok({
        records: [
          { id: 1, ...def, status: 'PUBLISH', updateTime: '2026-05-27T10:00:00Z' },
        ],
        totalRow: 1,
      })
    );
  }),

  // ─── module 域 CRUD ───
  http.get(/\/api\/content\/module(\?|$)/, () => ok(MODULE_LIST)),
  http.post('*/api/content/module', () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.delete(/\/api\/content\/module\/removeByIds.*/, () => ok({ removed: 1 })),
  http.get('*/api/content/module/list', () => ok(MODULE_LIST)),
  http.get('*/api/content/module/list/myPage', () => okPage(MODULE_LIST.list, MODULE_LIST.list.length)),
  http.delete(/\/api\/content\/module\/list\/removeByIds.*/, () => ok({ removed: 1 })),

  // module/banner
  http.get('*/api/content/module/banner', () => okList(MODULE_BANNERS, MODULE_BANNERS.length)),
  http.get('*/api/content/module/banner/page', () => okPage(MODULE_BANNERS, MODULE_BANNERS.length)),
  http.post('*/api/content/module/banner', () => ok({ id: 9999 })),
  http.delete(/\/api\/content\/module\/banner\/removeByIds.*/, () => ok({ removed: 1 })),

  // module/category
  http.get('*/api/content/module/category', () => okList(MODULE_CATEGORIES, MODULE_CATEGORIES.length)),
  http.get('*/api/content/module/category/page', () => okPage(MODULE_CATEGORIES, MODULE_CATEGORIES.length)),
  http.post('*/api/content/module/category', () => ok({ id: 9999 })),
  http.delete(/\/api\/content\/module\/category\/removeByIds.*/, () => ok({ removed: 1 })),

  // module/menu
  http.get('*/api/content/module/menu', () => ok(MODULE_MENUS)),
  http.get('*/api/content/module/menu/list', () => okList(MODULE_MENUS, MODULE_MENUS.length)),
  http.get('*/api/content/module/menu/clientTree', () => ok(MODULE_MENUS)),
  http.post('*/api/content/module/menu', () => ok({ id: 9999 })),
  http.delete(/\/api\/content\/module\/menu\/removeByIds.*/, () => ok({ removed: 1 })),

  // module/tag
  http.get('*/api/content/module/tag', () => okList(MODULE_TAGS_LIST, MODULE_TAGS_LIST.length)),
  http.get('*/api/content/module/tag/page', () => okPage(MODULE_TAGS_LIST, MODULE_TAGS_LIST.length)),
  http.post('*/api/content/module/tag', () => ok({ id: 9999 })),
  http.delete(/\/api\/content\/module\/tag\/removeByIds.*/, () => ok({ removed: 1 })),

  // module/template
  http.get('*/api/content/module/template', () => okList(MODULE_TEMPLATES_LIST, MODULE_TEMPLATES_LIST.length)),
  http.get('*/api/content/module/template/list', () => okList(MODULE_TEMPLATES_LIST, MODULE_TEMPLATES_LIST.length)),
  http.get('*/api/content/module/template/itemList', () => okList(MODULE_TEMPLATE_ATTRS_LIST, MODULE_TEMPLATE_ATTRS_LIST.length)),
  http.post('*/api/content/module/template', () => ok({ id: 9999 })),
  http.delete(/\/api\/content\/module\/template\/removeByIds.*/, () => ok({ removed: 1 })),

  // module/template/attr
  http.get('*/api/content/module/template/attr', () => okList(MODULE_TEMPLATE_ATTRS_LIST, MODULE_TEMPLATE_ATTRS_LIST.length)),
  http.get('*/api/content/module/template/attr/page', () => okPage(MODULE_TEMPLATE_ATTRS_LIST, MODULE_TEMPLATE_ATTRS_LIST.length)),
  http.post('*/api/content/module/template/attr', () => ok({ id: 9999 })),
  http.delete(/\/api\/content\/module\/template\/attr\/removeByIds.*/, () => ok({ removed: 1 })),

  // module/toplist
  http.get('*/api/content/module/toplist', () => ok(MODULE_TOPLISTS)),
  http.post('*/api/content/module/toplist', () => ok({ id: 9999 })),
  http.delete(/\/api\/content\/module\/toplist\/removeByIds.*/, () => ok({ removed: 1 })),
  http.get('*/api/content/module/toplist/myPage', () => okPage(MODULE_TOPLISTS, MODULE_TOPLISTS.length)),

  // module/toplist/item
  http.get('*/api/content/module/toplist/item', () => okList(MODULE_TOPLIST_ITEMS, MODULE_TOPLIST_ITEMS.length)),
  http.get('*/api/content/module/toplist/item/page', () => okPage(MODULE_TOPLIST_ITEMS, MODULE_TOPLIST_ITEMS.length)),
  http.post('*/api/content/module/toplist/item', () => ok({ id: 9999 })),
  http.delete(/\/api\/content\/module\/toplist\/item\/removeByIds.*/, () => ok({ removed: 1 })),

  // module/content 列表 — 列表/详情/删除/动作端点已迁移到 handlers/module-content.ts (覆盖筛选+分页)
  http.get('*/api/content/module/content/suggest', () => ok(MODULE_CONTENTS.records.slice(0, 8).map((r) => ({ id: r.id, title: r.title })))),
  http.get('*/api/content/module/content/comment', () => okList([], 0)),
  http.post('*/api/content/module/content/comment', () => ok({ id: 9999 })),
  http.post('*/api/content/module/content/passwordUnlock', () => ok({ unlocked: true })),
  http.post('*/api/content/module/content/payUnlock', () => ok({ unlocked: true })),
  http.post('*/api/content/module/passwordUnlock', () => ok({ unlocked: true })),
  http.post('*/api/content/module/payUnlock', () => ok({ unlocked: true })),

  // module/moduleContent
  http.post('*/api/content/module/moduleContent/action', () => ok({ processed: true })),
  http.post('*/api/content/module/moduleContent/client/process', () => ok({ processed: true })),
  http.get('*/api/content/module/moduleContent/client/related', () => okList([], 0)),
  http.post('*/api/content/module/moduleContent/client/removeFromModule', () => ok({ removed: true })),
  http.get('*/api/content/module/moduleContent/client/suggest', () => ok(MODULE_CONTENTS.records.slice(0, 8).map((r) => ({ id: r.id, title: r.title })))),
  http.post('*/api/content/module/moduleContent/client/updateShare', () => ok({ updated: 1 })),
  http.get('*/api/content/module/moduleContent/comment', () => okList([], 0)),
  http.post('*/api/content/module/moduleContent/comment', () => ok({ id: 9999 })),

  // moduleContentItem / Preview
  http.get('*/api/content/module/moduleContentItem/client/detail', ({ request }) => {
    const id = Number(new URL(request.url).searchParams.get('id') || 1);
    return ok(NOVEL_CHAPTERS.find((c) => c.id === id) || NOVEL_CHAPTERS[0]);
  }),
  http.get('*/api/content/module/moduleContentPreview/client/detail', () => ok(MODULE_CONTENTS.records[0])),
  http.get('*/api/content/module/moduleContent/client/detail', () => ok(MODULE_CONTENTS.records[0])),
  http.get(/\/api\/content\/module\/moduleContent\/client\/detail.*/, () => ok(MODULE_CONTENTS.records[0])),

  // moduleContentToplist
  http.get('*/api/content/module/moduleContentToplist/client/list', () => okList(MODULE_CONTENT_TOPLISTS, MODULE_CONTENT_TOPLISTS.length)),
  http.get('*/api/content/module/moduleContentToplist/client/myPage', () => okPage(MODULE_CONTENT_TOPLISTS, MODULE_CONTENT_TOPLISTS.length)),
  http.get('*/api/content/module/moduleContentToplist/client/page', () => okPage(MODULE_CONTENT_TOPLISTS, MODULE_CONTENT_TOPLISTS.length)),
  http.post('*/api/content/module/moduleContentToplist/client/addItem', () => ok({ added: 1 })),
  http.post('*/api/content/module/moduleContentToplist/save', () => ok({ id: 9999 })),
  http.post('*/api/content/module/moduleContentToplist/updateById', () => ok({ updated: 1 })),
  http.post('*/api/content/module/moduleContentToplist/sync', () => ok({ synced: 1 })),
  http.delete(/\/api\/content\/module\/moduleContentToplist\/removeByIds.*/, () => ok({ removed: 1 })),

  // moduleContentToplistItem
  http.get('*/api/content/module/moduleContentToplistItem/client/page', () => okPage(MODULE_CONTENT_TOPLIST_ITEMS, MODULE_CONTENT_TOPLIST_ITEMS.length)),
  http.get('*/api/content/module/moduleContentToplistItem/listByMap', () => ok(MODULE_CONTENT_TOPLIST_ITEMS)),
  http.post('*/api/content/module/moduleContentToplistItem/save', () => ok({ id: 9999 })),
  http.post('*/api/content/module/moduleContentToplistItem/updateById', () => ok({ updated: 1 })),
  http.delete(/\/api\/content\/module\/moduleContentToplistItem\/removeByIds.*/, () => ok({ removed: 1 })),

  // moduleSource
  http.get('*/api/content/module/moduleSource/client/page', () => okPage(MODULE_SOURCES, MODULE_SOURCES.length)),
  http.post('*/api/content/module/moduleSource/client/saveOrUpdate', () => ok({ id: 9999, updated: 1 })),
  http.delete(/\/api\/content\/module\/moduleSource\/removeByIds.*/, () => ok({ removed: 1 })),

  // moduleTemplate
  http.get('*/api/content/module/moduleTemplate/client/list', () => okList(MODULE_TEMPLATES_LIST, MODULE_TEMPLATES_LIST.length)),
  http.get('*/api/content/module/moduleTemplate/client/myPage', () => okPage(MODULE_TEMPLATES_LIST, MODULE_TEMPLATES_LIST.length)),
  http.get('*/api/content/module/moduleTemplate/client/page', () => okPage(MODULE_TEMPLATES_LIST, MODULE_TEMPLATES_LIST.length)),
  http.post('*/api/content/module/moduleTemplate/client/saveOrUpdate', () => ok({ id: 9999, updated: 1 })),
  http.post('*/api/content/module/moduleTemplate/save', () => ok({ id: 9999 })),
  http.post('*/api/content/module/moduleTemplate/updateById', () => ok({ updated: 1 })),
  http.delete(/\/api\/content\/module\/moduleTemplate\/removeByIds.*/, () => ok({ removed: 1 })),

  // moduleTemplateAttr
  http.get('*/api/content/module/moduleTemplateAttr/client/list', () => okList(MODULE_TEMPLATE_ATTRS_LIST, MODULE_TEMPLATE_ATTRS_LIST.length)),
  http.get('*/api/content/module/moduleTemplateAttr/page', () => okPage(MODULE_TEMPLATE_ATTRS_LIST, MODULE_TEMPLATE_ATTRS_LIST.length)),
  http.post('*/api/content/module/moduleTemplateAttr/save', () => ok({ id: 9999 })),
  http.post('*/api/content/module/moduleTemplateAttr/updateById', () => ok({ updated: 1 })),
  http.delete(/\/api\/content\/module\/moduleTemplateAttr\/removeByIds.*/, () => ok({ removed: 1 })),

  // moduleMenu
  http.get('*/api/content/module/moduleMenu/client/list', () => okList(MODULE_MENUS, MODULE_MENUS.length)),
  http.get('*/api/content/module/moduleMenu/client/page', () => okPage(MODULE_MENUS, MODULE_MENUS.length)),
  http.post('*/api/content/module/moduleMenu/save', () => ok({ id: 9999 })),
  http.post('*/api/content/module/moduleMenu/updateById', () => ok({ updated: 1 })),
  http.delete(/\/api\/content\/module\/moduleMenu\/removeByIds.*/, () => ok({ removed: 1 })),

  // ─── 通用 ───
  http.post('*/api/content/file/upload', () => ok({ url: 'https://picsum.photos/seed/upload/200/200', filename: 'demo.jpg' })),
  http.get('*/api/content/question/qa', () => okList(QUESTION_LIST, QUESTION_LIST.length)),
  http.post('*/api/content/question/qa', () => ok({ id: 9999 })),

  // ─── 28 个 client-content 类型的 handler ───
  ...contentTypeHandlers,

  // ─── content-novel-chapter 特殊端点 ───
  http.post('*/api/content/client-content/novel-bookshelf/correctLastRead', () => ok({ corrected: true })),
  http.get('*/api/content/client-content/novel/get', ({ request }) => {
    const id = Number(new URL(request.url).searchParams.get('id') || 1);
    const seed = CLIENT_CONTENT_SEED.novel;
    return ok(seed.records.find((r) => r.id === id) || seed.records[0]);
  }),

  // ─── content-pan (走 adminClient) ───
  http.get('*/api/admin/pan/page', () => okPage([], 0)),
  http.post('*/api/admin/pan/process', () => ok({ processed: true })),
  http.post('*/api/admin/pan', () => ok({ id: Date.now() })),
  http.put(/\/api\/admin\/pan\/\d+/, () => ok({ updated: 1 })),
  http.get(/\/api\/admin\/pan\/\d+/, () => ok({ id: 1, name: 'pan item', status: 'active' })),
  http.delete(/\/api\/admin\/pan\/removeByIds.*/, () => ok({ removed: 1 })),

  // ─── content-spider-queue (走 contentClient/content/) ───
  http.get('*/api/content/content/spiderQueue/client/page', () => okPage([], 0)),
  http.post('*/api/content/content/spiderQueue', () => ok({ id: Date.now() })),
  http.put(/\/api\/content\/content\/spiderQueue\/\d+/, () => ok({ updated: 1 })),
  http.get(/\/api\/content\/content\/spiderQueue\/\d+/, () => ok({ id: 1, url: 'https://example.com', status: 'pending' })),
  http.delete(/\/api\/content\/content\/spiderQueue\/removeByIds.*/, () => ok({ removed: 1 })),

  // ─── content-todo-queue (走 contentClient/content/) ───
  http.get('*/api/content/content/todoQueue/client/page', () => okPage([], 0)),
  http.post('*/api/content/content/todoQueue/process', () => ok({ processed: true })),
  http.post('*/api/content/content/todoQueue', () => ok({ id: Date.now() })),
  http.put(/\/api\/content\/content\/todoQueue\/\d+/, () => ok({ updated: 1 })),
  http.get(/\/api\/content\/content\/todoQueue\/\d+/, () => ok({ id: 1, task: 'todo', status: 'pending' })),
  http.delete(/\/api\/content\/content\/todoQueue\/removeByIds.*/, () => ok({ removed: 1 })),

  // ─── content-urls (走 adminClient) ───
  http.get('*/api/admin/urls/list', () => okList([], 0)),
  http.post('*/api/admin/urls', () => ok({ id: Date.now() })),
  http.put(/\/api\/admin\/urls\/\d+/, () => ok({ updated: 1 })),
  http.get(/\/api\/admin\/urls\/\d+/, () => ok({ id: 1, url: 'https://example.com', status: 'active' })),
  http.delete(/\/api\/admin\/urls.*/, () => ok({ removed: 1 })),

  // ─── content-website (走 adminClient) ───
  http.get('*/api/admin/website/page', () => okPage([], 0)),
  http.post('*/api/admin/website/process', () => ok({ processed: true })),
  http.post('*/api/admin/website', () => ok({ id: Date.now() })),
  http.put(/\/api\/admin\/website\/\d+/, () => ok({ updated: 1 })),
  http.get(/\/api\/admin\/website\/\d+/, () => ok({ id: 1, domain: 'example.com', status: 'active' })),
  http.delete(/\/api\/admin\/website\/removeByIds.*/, () => ok({ removed: 1 })),
];

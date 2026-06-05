/**
 * Spider MSW handlers — batch / workers / siteSlots / sources / templates / tasks / proxies / health / stats。
 */

import { http, HttpResponse, delay } from 'msw';
import {
  SPIDER_BATCH,
  SPIDER_WORKERS,
  SPIDER_WORKER_STATS,
  SPIDER_SITE_SLOTS,
  SPIDER_SITE_SLOT_STATS,
  SPIDER_SOURCES,
  SPIDER_TEMPLATES,
  SPIDER_BATCH_STATS,
  SPIDER_TASKS,
  SPIDER_TASK_ITEMS,
  SPIDER_TASK_LINKS,
  SPIDER_PROXIES,
  SPIDER_PROXY_STATS,
  SPIDER_TEMPLATE_ATTRS,
  SPIDER_CRAWL_STATS,
  SPIDER_HEALTH,
  SPIDER_TIMESERIES,
  SPIDER_ACTIVITY,
  bumpTimeseries,
  pushActivityEvent,
  addTask,
  stopTask,
  deleteTask,
  addProxy,
  deleteProxy,
  toggleProxy,
  addTemplateAttr,
  updateTemplateAttr,
  deleteTemplateAttr,
} from '../db/spider';

const ok = <T,>(data: T) => HttpResponse.json({ code: 200, msg: 'OK', data });

/** MSW v2 不支持通过 (params as any)[0] 取正则分组;改从 URL 中解析末尾段 */
const extractLastPathSegment = (url: string): string => {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  } catch {
    return '';
  }
};
const pathParam = (request: Request, indexFromEnd: number = 1): string => {
  try {
    const u = new URL(request.url);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts[parts.length - indexFromEnd] || '';
  } catch {
    return '';
  }
};

export const spiderHandlers = [
  // ─── health / stats ───
  http.get('*/api/spider/health', () => ok(SPIDER_HEALTH)),
  http.get('*/api/spider/stats', () => ok(SPIDER_CRAWL_STATS)),
  // ─── 实时趋势 + 活动流 ───
  http.get('*/api/spider/timeseries', () => {
    // 每次取都重新摇最后几小时,模拟"实时"
    bumpTimeseries();
    return ok(SPIDER_TIMESERIES);
  }),
  http.get('*/api/spider/activity', () => {
    // 30% 概率推一条新事件
    if (Math.random() < 0.3) pushActivityEvent();
    return ok(SPIDER_ACTIVITY);
  }),

  // ─── batch ───
  http.get('*/api/spider/batch', () => ok(SPIDER_BATCH)),
  http.post('*/api/spider/batch', () => ok({ id: Math.floor(Math.random() * 1000) + 9999, status: 'pending' })),
  http.get(/\/api\/spider\/batch\/\d+$/, ({ request }) => {
    const id = Number(pathParam(request));
    const job = SPIDER_BATCH.list.find((j) => j.id === id) || SPIDER_BATCH.list[0];
    return ok(job);
  }),
  http.post(/\/api\/spider\/batch\/\d+\/start/, () => ok({ success: true, status: 'running' })),
  http.post(/\/api\/spider\/batch\/\d+\/pause/, () => ok({ success: true, status: 'paused' })),
  http.post(/\/api\/spider\/batch\/\d+\/resume/, () => ok({ success: true, status: 'running' })),
  http.post(/\/api\/spider\/batch\/\d+\/cancel/, () => ok({ success: true, status: 'cancelled' })),
  http.get(/\/api\/spider\/batch\/\d+\/stats/, () => ok(SPIDER_BATCH_STATS)),
  http.post('*/api/spider/batch/operate', () => ok({ status: 'ok' })),

  // ─── workers ───
  http.get('*/api/spider/workers', () => ok(SPIDER_WORKERS)),
  http.get('*/api/spider/workers/stats', () => ok(SPIDER_WORKER_STATS)),

  // ─── sites / slots ───
  http.get('*/api/spider/sites/slots', () => ok(SPIDER_SITE_SLOTS)),
  http.get('*/api/spider/sites/slots/stats', () => ok(SPIDER_SITE_SLOT_STATS)),
  http.post(/\/api\/spider\/sites\/\d+\/pause/, () => ok({ status: 'paused' })),
  http.post(/\/api\/spider\/sites\/\d+\/resume/, () => ok({ status: 'resumed' })),

  // ─── sources ───
  http.get('*/api/spider/sources', () => ok(SPIDER_SOURCES)),
  http.get(/\/api\/spider\/sources\/\d+$/, ({ request }) => {
    const id = Number(pathParam(request));
    const s = SPIDER_SOURCES.list.find((x) => x.id === id);
    return s ? ok(s) : ok(null);
  }),
  http.post('*/api/spider/sources', () => ok({ id: Math.floor(Math.random() * 1000) + 9999, status: 'active' })),
  http.put(/\/api\/spider\/sources\/\d+$/, () => ok({ success: true })),
  http.delete(/\/api\/spider\/sources\/\d+$/, () => ok({ success: true })),

  // ─── templates ───
  http.get('*/api/spider/templates', () => ok(SPIDER_TEMPLATES)),
  http.get(/\/api\/spider\/templates\/\d+$/, ({ request }) => {
    const id = Number(pathParam(request));
    const t = SPIDER_TEMPLATES.list.find((x) => x.id === id);
    if (!t) return ok(null);
    return ok({ ...t, attrs: SPIDER_TEMPLATE_ATTRS[id] || [] });
  }),
  http.post('*/api/spider/templates', () => ok({ id: Math.floor(Math.random() * 1000) + 9999 })),
  http.put(/\/api\/spider\/templates\/\d+$/, () => ok({ success: true })),
  http.delete(/\/api\/spider\/templates\/\d+$/, () => ok({ success: true })),
  // 模板属性
  http.get(/\/api\/spider\/templates\/\d+\/attrs/, ({ request }) => {
    const id = Number(pathParam(request, 2)); // 倒数第 2 段
    return ok({ list: SPIDER_TEMPLATE_ATTRS[id] || [], total: (SPIDER_TEMPLATE_ATTRS[id] || []).length });
  }),
  http.post(/\/api\/spider\/templates\/\d+\/attrs/, async ({ request }) => {
    const tid = Number(pathParam(request, 2));
    const body = (await request.json()) as any;
    const a = addTemplateAttr(tid, body);
    return ok(a);
  }),
  http.put(/\/api\/spider\/templates\/attrs\/\d+$/, async ({ request }) => {
    const aid = Number(pathParam(request));
    const body = (await request.json()) as any;
    for (const tid of Object.keys(SPIDER_TEMPLATE_ATTRS)) {
      const r = updateTemplateAttr(Number(tid), aid, body);
      if (r) return ok(r);
    }
    return ok(null);
  }),
  http.delete(/\/api\/spider\/templates\/attrs\/\d+$/, ({ request }) => {
    const aid = Number(pathParam(request));
    for (const tid of Object.keys(SPIDER_TEMPLATE_ATTRS)) {
      if (deleteTemplateAttr(Number(tid), aid)) return ok({ success: true });
    }
    return ok({ success: false });
  }),
  // TODO(REAL-LLM): 当前为 LLM 模拟,真实接入路径为 POST /api/spider/tasks/rule,后端通过 LLM 分析页面结构返回 SelectorRule 列表
  http.post('*/api/spider/templates/auto-generate', async ({ request }) => {
    const body = (await request.json()) as { url: string; type?: string };
    await delay(2500);
    const domain = (() => {
      try {
        return new URL(body.url).hostname;
      } catch {
        return 'example.com';
      }
    })();
    return ok({
      rules: [
        { code: 'container', selector: 'ul.list, .item-list, .content-list', isArray: true, source: 'llm', confidence: 0.92 },
        { code: 'item', selector: 'li, .item, .card', isArray: true, source: 'llm', confidence: 0.9 },
        { code: 'title', selector: 'h2, h3, .title, a', attr: 'text', source: 'llm', confidence: 0.88 },
        { code: 'link', selector: 'a', attr: 'href', source: 'llm', confidence: 0.86 },
        { code: 'cover', selector: 'img', attr: 'src', source: 'heuristic', confidence: 0.75 },
      ],
      previewItems: [
        { title: `示例条目 1 (${domain})`, link: `${body.url}/detail/1`, cover: 'https://picsum.photos/seed/1/120/80' },
        { title: `示例条目 2 (${domain})`, link: `${body.url}/detail/2`, cover: 'https://picsum.photos/seed/2/120/80' },
        { title: `示例条目 3 (${domain})`, link: `${body.url}/detail/3`, cover: 'https://picsum.photos/seed/3/120/80' },
      ],
    });
  }),

  // ─── tasks ───
  http.get('*/api/spider/tasks', () => ok(SPIDER_TASKS)),
  http.post('*/api/spider/tasks', async ({ request }) => {
    const body = (await request.json()) as any;
    const t = addTask({
      sourceId: body.source_id ? Number(body.source_id) : undefined,
      startUrl: body.start_url,
      maxDepth: body.max_depth || 2,
      maxPages: body.max_pages || 100,
    });
    return ok(t);
  }),
  http.get(/\/api\/spider\/tasks\/[^/]+$/, ({ request }) => {
    const id = pathParam(request);
    const t = SPIDER_TASKS.list.find((x) => x.id === id);
    if (!t) return ok(null);
    return ok({
      ...t,
      stats: { pagesCrawled: t.pagesCrawled, linksFound: t.linksFound, itemsSaved: t.itemsSaved },
      isRunning: t.status === 'running',
      items: SPIDER_TASK_ITEMS[id] || [],
      links: SPIDER_TASK_LINKS[id] || [],
    });
  }),
  http.post(/\/api\/spider\/tasks\/[^/]+\/stop/, ({ request }) => {
    const id = pathParam(request, 2);
    const t = stopTask(id);
    return t ? ok(t) : ok({ success: false });
  }),
  http.delete(/\/api\/spider\/tasks\/[^/]+$/, ({ request }) => {
    const id = pathParam(request);
    return ok({ success: deleteTask(id) });
  }),
  http.get(/\/api\/spider\/tasks\/[^/]+\/items/, ({ request }) => {
    const id = pathParam(request, 2);
    return ok({ list: SPIDER_TASK_ITEMS[id] || [], total: (SPIDER_TASK_ITEMS[id] || []).length });
  }),
  http.get(/\/api\/spider\/tasks\/[^/]+\/links/, ({ request }) => {
    const id = pathParam(request, 2);
    return ok({ list: SPIDER_TASK_LINKS[id] || [], total: (SPIDER_TASK_LINKS[id] || []).length });
  }),

  // ─── proxies ───
  http.get('*/api/spider/proxies', () => ok(SPIDER_PROXIES)),
  http.get('*/api/spider/proxies/stats', () => ok(SPIDER_PROXY_STATS)),
  http.post('*/api/spider/proxies', async ({ request }) => {
    const body = (await request.json()) as { url: string; type: 'http' | 'https' | 'socks5' };
    return ok(addProxy(body.url, body.type));
  }),
  http.put(/\/api\/spider\/proxies\/[^/]+$/, async ({ request }) => {
    const id = pathParam(request);
    const body = (await request.json()) as { active: boolean };
    const p = toggleProxy(id, body.active);
    return p ? ok(p) : ok({ success: false });
  }),
  http.delete(/\/api\/spider\/proxies\/[^/]+$/, ({ request }) => {
    const id = pathParam(request);
    return ok({ success: deleteProxy(id) });
  }),
];

/**
 * Spider seed data — batch / workers / siteSlots / sources / templates。
 */

import { range, dateOffset, pick } from '../utils/seed';

const STATUS = ['running', 'paused', 'pending', 'completed', 'cancelled', 'failed'];
const TYPES = ['novel', 'video', 'news', 'music', 'animation', 'comics', 'article'];
const SOURCES = ['笔趣阁', '起点中文', '哔哩哔哩', '腾讯新闻', '网易音乐', '樱花动漫', '豆瓣电影', '知乎专栏', '今日头条', '新浪微博'];

export const SPIDER_BATCH = {
  list: range(12).map((i) => ({
    id: 100 + i,
    name: ['笔趣阁小说爬取', '哔哩视频批量', '腾讯新闻热榜', '网易云音乐专辑', '豆瓣电影 Top250', '知乎专栏', '今日头条实时', 'B站番剧', '起点新书榜', '樱花新番', '抖音合集', '微博热搜'][i],
    domain: ['biquge.tw', 'bilibili.com', 'news.qq.com', 'music.163.com', 'douban.com', 'zhihu.com', 'toutiao.com', 'bilibili.com', 'qidian.com', 'dmhy.org', 'douyin.com', 'weibo.com'][i],
    url: 'https://example.com',
    type: TYPES[i % TYPES.length],
    status: pick(STATUS, i),
    progress: 20 + i * 7,
    totalUrls: 100 + i * 30,
    processedUrls: 30 + i * 18,
    successUrls: 25 + i * 17,
    failUrls: 5 + i,
    workers: 1 + (i % 4),
    siteSlotId: 1 + (i % 4),
    startTime: dateOffset(i % 7, 9),
    endTime: i < 6 ? null : dateOffset(i % 7, 18),
    createTime: dateOffset(i),
    updateTime: dateOffset(i, 14),
  })),
  total: 12,
};

export const SPIDER_WORKERS = {
  list: range(6).map((i) => ({
    id: `w${i + 1}`,
    name: `Worker-${i + 1}`,
    status: pick(['idle', 'busy', 'offline', 'idle', 'busy', 'idle'], i),
    processedCount: 100 + i * 87,
    successCount: 90 + i * 80,
    failCount: 10 + i * 7,
    avgSpeed: 0.5 + (i % 4) * 0.3,
    currentJob: i % 2 === 0 ? `Job ${100 + i}` : null,
    cpu: 20 + (i * 13) % 70,
    memory: 30 + (i * 17) % 60,
    lastActiveTime: dateOffset(i % 3, 16),
  })),
  total: 6,
};

export const SPIDER_WORKER_STATS = {
  total: 6,
  idle: 3,
  busy: 2,
  offline: 1,
  avgSpeed: 1.2,
  todayProcessed: 2840,
  weekProcessed: 18420,
};

export const SPIDER_SITE_SLOTS = {
  list: range(5).map((i) => ({
    id: 1 + i,
    siteName: ['笔趣阁', '哔哩哔哩', '腾讯新闻', '豆瓣', '知乎'][i],
    domain: ['biquge.tw', 'bilibili.com', 'news.qq.com', 'douban.com', 'zhihu.com'][i],
    status: pick(['active', 'active', 'paused', 'active', 'active'], i),
    activeSlots: 2 + (i % 2),
    maxSlots: 5,
    queueSize: 5 + i * 3,
    progress: 30 + i * 12,
    createTime: dateOffset(i + 5),
  })),
  total: 5,
};

export const SPIDER_SITE_SLOT_STATS = {
  totalSlots: 25,
  usedSlots: 9,
  availableSlots: 16,
  sites: 5,
};

export const SPIDER_SOURCES = {
  list: range(8).map((i) => ({
    id: 200 + i,
    name: SOURCES[i],
    domain: ['biquge.tw', 'qidian.com', 'bilibili.com', 'news.qq.com', 'music.163.com', 'douban.com', 'zhihu.com', 'weibo.com'][i],
    url: 'https://example.com',
    type: TYPES[i % TYPES.length],
    status: pick(['active', 'active', 'inactive', 'active', 'paused', 'active', 'active', 'inactive'], i),
    itemCount: 500 + i * 320,
    successRate: 0.85 + (i % 3) * 0.05,
    avgSpeed: 0.8 + (i % 4) * 0.4,
    lastCrawlAt: dateOffset(i % 5, 12),
    createTime: dateOffset(i + 7),
  })),
  total: 8,
};

export const SPIDER_TEMPLATES = {
  list: range(6).map((i) => ({
    id: 300 + i,
    name: ['小说模板', '视频模板', '新闻模板', '音乐模板', '动漫模板', '电影模板'][i],
    type: TYPES[i % TYPES.length],
    source: SOURCES[i],
    attrs: 12 + i * 3,
    items: 500 + i * 280,
    status: i < 5 ? 'ENABLED' : 'DISABLED',
    version: `v${1 + Math.floor(i / 2)}.${i % 3}.0`,
    createTime: dateOffset(i + 10),
  })),
  total: 6,
};

export const SPIDER_BATCH_STATS = {
  total: 12,
  running: 3,
  completed: 5,
  paused: 2,
  failed: 1,
  cancelled: 1,
  todayProcessed: 12480,
  weekProcessed: 84320,
  monthProcessed: 342180,
};

// ─── 单任务(Tasks) ───
const TASK_STATUS = ['pending', 'running', 'stopped', 'completed', 'failed', 'running', 'running', 'completed', 'pending', 'failed', 'running', 'completed'];

export const SPIDER_TASKS = {
  list: range(12).map((i) => ({
    id: `t${1000 + i}`,
    sourceId: 200 + (i % 8),
    sourceName: SOURCES[i % SOURCES.length],
    startUrl: `https://${['biquge.tw', 'qidian.com', 'bilibili.com', 'news.qq.com', 'music.163.com', 'douban.com', 'zhihu.com', 'weibo.com'][i % 8]}/${['book', 'novel', 'video', 'article', 'album', 'movie', 'answer', 'post'][i % 8]}/${1000 + i}`,
    status: TASK_STATUS[i],
    maxDepth: 1 + (i % 3),
    maxPages: 50 + i * 30,
    pagesCrawled: i < 4 ? 30 + i * 12 : 50 + i * 30,
    linksFound: 100 + i * 47,
    itemsSaved: 30 + i * 12,
    createdAt: dateOffset(i),
    updatedAt: dateOffset(i, 14),
  })),
  total: 12,
};

// 任务抓取项(按 taskId)
export const SPIDER_TASK_ITEMS: Record<string, { id: number; taskId: string; url: string; title: string; cover?: string; source?: string; crawledAt: string }[]> = {};
SPIDER_TASKS.list.forEach((t, idx) => {
  const n = 5 + (idx % 4);
  SPIDER_TASK_ITEMS[t.id] = range(n).map((j) => ({
    id: 10000 + idx * 100 + j,
    taskId: t.id,
    url: `${t.startUrl}?p=${j + 1}`,
    title: `${SOURCES[idx % SOURCES.length]} 抓取项 ${idx + 1}-${j + 1}`,
    cover: `https://picsum.photos/seed/${t.id}-${j}/200/120`,
    source: ['biquge.tw', 'qidian.com', 'bilibili.com', 'news.qq.com'][idx % 4],
    crawledAt: dateOffset(idx, j),
  }));
});

// 任务发现链接
export const SPIDER_TASK_LINKS: Record<string, { id: number; taskId: string; url: string; source?: string; depth: number; foundAt: string }[]> = {};
SPIDER_TASKS.list.forEach((t, idx) => {
  const n = 8 + (idx % 3);
  SPIDER_TASK_LINKS[t.id] = range(n).map((j) => ({
    id: 20000 + idx * 100 + j,
    taskId: t.id,
    url: `https://example.com/page${idx}-${j + 1}`,
    source: ['biquge.tw', 'bilibili.com', 'news.qq.com'][idx % 3],
    depth: j % 3,
    foundAt: dateOffset(idx, 8 + j),
  }));
});

// ─── 代理(Proxies) ───
export const SPIDER_PROXIES = {
  list: [
    { id: 'p1', url: 'http://127.0.0.1:8888', type: 'http', active: true, successCount: 1842, failCount: 12 },
    { id: 'p2', url: 'http://10.0.0.21:3128', type: 'http', active: true, successCount: 920, failCount: 38 },
    { id: 'p3', url: 'socks5://192.168.1.50:1080', type: 'socks5', active: true, successCount: 567, failCount: 4 },
    { id: 'p4', url: 'https://proxy.example.com:443', type: 'https', active: false, successCount: 0, failCount: 0 },
    { id: 'p5', url: 'http://10.0.0.22:3128', type: 'http', active: true, successCount: 1245, failCount: 27 },
    { id: 'p6', url: 'socks5://10.0.0.30:1080', type: 'socks5', active: false, successCount: 88, failCount: 145 },
  ],
  total: 6,
};

export const SPIDER_PROXY_STATS = {
  total: 6,
  active: 4,
  successRate: 0.943,
  failCount: 226,
};

// ─── 模板属性(按 templateId 索引) ───
const ATTR_TEMPLATES = [
  [
    { name: '标题', type: 'text', code: 'title', content: JSON.stringify({ selector: '.book-title', attr: 'text' }), remark: 'h1 节点文本' },
    { name: '链接', type: 'link', code: 'link', content: JSON.stringify({ selector: 'a.read', attr: 'href' }), remark: '章节链接' },
    { name: '封面', type: 'image', code: 'cover', content: JSON.stringify({ selector: 'img.cover', attr: 'src' }), remark: '' },
    { name: '简介', type: 'text', code: 'description', content: JSON.stringify({ selector: '.intro', attr: 'text' }), remark: '' },
  ],
  [
    { name: '标题', type: 'text', code: 'title', content: JSON.stringify({ selector: 'h1.video-title', attr: 'text' }), remark: '' },
    { name: '链接', type: 'link', code: 'link', content: JSON.stringify({ selector: 'a.video-link', attr: 'href' }), remark: '' },
    { name: '封面', type: 'image', code: 'cover', content: JSON.stringify({ selector: 'img.preview', attr: 'src' }), remark: '' },
    { name: '描述', type: 'text', code: 'description', content: JSON.stringify({ selector: '.desc', attr: 'text' }), remark: '' },
    { name: '日期', type: 'text', code: 'date', content: JSON.stringify({ selector: '.pubdate', attr: 'text' }), remark: '' },
  ],
  [
    { name: '标题', type: 'text', code: 'title', content: JSON.stringify({ selector: '.news-title', attr: 'text' }), remark: '' },
    { name: '链接', type: 'link', code: 'link', content: JSON.stringify({ selector: 'a.title', attr: 'href' }), remark: '' },
    { name: '日期', type: 'text', code: 'date', content: JSON.stringify({ selector: '.time', attr: 'text' }), remark: '' },
  ],
  [
    { name: '专辑名', type: 'text', code: 'title', content: JSON.stringify({ selector: '.album-name', attr: 'text' }), remark: '' },
    { name: '链接', type: 'link', code: 'link', content: JSON.stringify({ selector: 'a.album', attr: 'href' }), remark: '' },
    { name: '封面', type: 'image', code: 'cover', content: JSON.stringify({ selector: 'img.cover', attr: 'src' }), remark: '' },
  ],
  [
    { name: '番名', type: 'text', code: 'title', content: JSON.stringify({ selector: '.anime-title', attr: 'text' }), remark: '' },
    { name: '链接', type: 'link', code: 'link', content: JSON.stringify({ selector: 'a.detail', attr: 'href' }), remark: '' },
    { name: '封面', type: 'image', code: 'cover', content: JSON.stringify({ selector: 'img.cover', attr: 'src' }), remark: '' },
    { name: '简介', type: 'text', code: 'description', content: JSON.stringify({ selector: '.summary', attr: 'text' }), remark: '' },
  ],
  [
    { name: '片名', type: 'text', code: 'title', content: JSON.stringify({ selector: '.movie-title', attr: 'text' }), remark: '' },
    { name: '链接', type: 'link', code: 'link', content: JSON.stringify({ selector: 'a.movie', attr: 'href' }), remark: '' },
    { name: '封面', type: 'image', code: 'cover', content: JSON.stringify({ selector: 'img.poster', attr: 'src' }), remark: '' },
    { name: '评分', type: 'text', code: 'date', content: JSON.stringify({ selector: '.rating', attr: 'text' }), remark: '影评日期占位' },
  ],
];

export const SPIDER_TEMPLATE_ATTRS: Record<number, { id: number; templateId: number; name: string; type: string; code: string; content: string; remark?: string; createdAt: string }[]> = {};
SPIDER_TEMPLATES.list.forEach((t, ti) => {
  const list = ATTR_TEMPLATES[ti % ATTR_TEMPLATES.length];
  SPIDER_TEMPLATE_ATTRS[t.id] = list.map((a, ai) => ({
    id: 5000 + ti * 100 + ai,
    templateId: t.id,
    ...a,
    createdAt: dateOffset(ti + 5, 10),
  }));
});

// ─── Dashboard 全局统计 ───
export const SPIDER_CRAWL_STATS = {
  runningEngines: 3,
  totalPages: 184320,
  totalLinks: 2840920,
  totalItems: 18420,
};

export const SPIDER_HEALTH = {
  status: 'healthy',
  engines: 3,
  uptime: 86400,
};

// ─── 24h 抓取量趋势(可滚动) ───
const HOURLY_BASE = [
  { pages: 4200, items: 580, links: 38000, errors: 12 },
  { pages: 5100, items: 720, links: 42000, errors: 8 },
  { pages: 4800, items: 690, links: 41000, errors: 15 },
  { pages: 3900, items: 540, links: 35000, errors: 6 },
  { pages: 3200, items: 410, links: 28000, errors: 4 },
  { pages: 2800, items: 360, links: 24000, errors: 3 },
  { pages: 2400, items: 310, links: 21000, errors: 2 },
  { pages: 3100, items: 420, links: 27000, errors: 5 },
  { pages: 5600, items: 810, links: 48000, errors: 14 },
  { pages: 7200, items: 1080, links: 62000, errors: 22 },
  { pages: 8400, items: 1240, links: 71000, errors: 28 },
  { pages: 9100, items: 1380, links: 78000, errors: 32 },
  { pages: 9600, items: 1450, links: 82000, errors: 35 },
  { pages: 10100, items: 1520, links: 86000, errors: 38 },
  { pages: 9800, items: 1480, links: 84000, errors: 30 },
  { pages: 9300, items: 1410, links: 80000, errors: 27 },
  { pages: 8800, items: 1320, links: 75000, errors: 24 },
  { pages: 8200, items: 1230, links: 71000, errors: 21 },
  { pages: 7600, items: 1140, links: 66000, errors: 19 },
  { pages: 6900, items: 1020, links: 60000, errors: 16 },
  { pages: 6300, items: 940, links: 55000, errors: 13 },
  { pages: 5800, items: 860, links: 51000, errors: 10 },
  { pages: 5100, items: 750, links: 45000, errors: 9 },
  { pages: 4600, items: 670, links: 40000, errors: 7 },
];
const _buildHourly = () => {
  const now = new Date();
  return HOURLY_BASE.map((b, i) => {
    const h = (now.getHours() - 23 + i + 24) % 24;
    // 加一点随机抖动,让刷新时有变化
    const jitter = 0.9 + Math.random() * 0.2;
    return {
      hour: String(h).padStart(2, '0'),
      pages: Math.round(b.pages * jitter),
      items: Math.round(b.items * jitter),
      links: Math.round(b.links * jitter),
      errors: Math.max(0, Math.round(b.errors * jitter)),
    };
  });
};
export let SPIDER_TIMESERIES = {
  hourly: _buildHourly(),
  updatedAt: new Date().toISOString(),
};
/** 模拟每 5s 滚一次 — 把最新小时重算 jitter,体现"实时" */
export function bumpTimeseries() {
  const next = _buildHourly();
  // 只滚动最后 4 个小时(模拟数据推进)
  const last4 = next.slice(-4).map((p) => ({
    ...p,
    pages: Math.round(p.pages * (0.92 + Math.random() * 0.16)),
    items: Math.round(p.items * (0.92 + Math.random() * 0.16)),
    links: Math.round(p.links * (0.92 + Math.random() * 0.16)),
    errors: Math.max(0, Math.round(p.errors * (0.9 + Math.random() * 0.2))),
  }));
  SPIDER_TIMESERIES = {
    hourly: [...next.slice(0, -4), ...last4],
    updatedAt: new Date().toISOString(),
  };
  return SPIDER_TIMESERIES;
}

// ─── 最近活动 Feed ───
const SEED_ACTIVITY = [
  { type: 'task', severity: 'success', title: '任务 t1003 已完成', detail: '抓取 234 页 · 入库 187 条' },
  { type: 'item', severity: 'info', title: '笔趣阁入库 12 条新书', detail: '源: biquge.tw · 来源类型: novel' },
  { type: 'proxy', severity: 'warning', title: '代理 p6 失败率上升', detail: '近 1h 失败 145 / 总 233 次' },
  { type: 'error', severity: 'error', title: '任务 t1007 抓取出错', detail: 'HTTP 503 from news.qq.com' },
  { type: 'template', severity: 'success', title: '模板"小说模板"应用 4 条新规则', detail: '通过智能生成 (LLM)' },
  { type: 'source', severity: 'info', title: '源"起点中文"健康度: 良好', detail: '近 1h 成功率 99.2%' },
  { type: 'task', severity: 'info', title: '新建任务 t1100', detail: '来源: biquge.tw · 深度 2 · 100 页' },
  { type: 'item', severity: 'success', title: '哔哩哔哩入库 23 条视频', detail: '源: bilibili.com' },
  { type: 'error', severity: 'warning', title: 'Worker w5 离线', detail: '心跳超时 60s,自动重连中' },
  { type: 'task', severity: 'info', title: '任务 t1002 进度更新', detail: '已抓取 45/100 页' },
  { type: 'proxy', severity: 'success', title: '代理池新增 1 个代理', detail: 'http://10.0.0.22:3128' },
  { type: 'item', severity: 'info', title: '腾讯新闻入库 8 条', detail: '源: news.qq.com' },
  { type: 'template', severity: 'info', title: '模板"视频模板"删除 1 条属性', detail: 'code: date' },
  { type: 'source', severity: 'warning', title: '源"网易音乐"暂停', detail: '连续失败 5 次' },
  { type: 'task', severity: 'error', title: '任务 t1005 失败', detail: '起始 URL 不可达' },
  { type: 'item', severity: 'info', title: '豆瓣电影入库 5 条', detail: '源: douban.com' },
  { type: 'proxy', severity: 'info', title: '代理 p3 启用', detail: 'socks5://192.168.1.50:1080' },
  { type: 'task', severity: 'success', title: '任务 t1009 已完成', detail: '抓取 80 页 · 入库 62 条' },
  { type: 'item', severity: 'info', title: '知乎专栏入库 14 条', detail: '源: zhihu.com' },
  { type: 'error', severity: 'error', title: '任务 t1011 抓取出错', detail: '解析 selector 失败: .news-title' },
];
const _buildActivity = (): { events: _ActEv[]; updatedAt: string } => {
  const now = Date.now();
  const events: _ActEv[] = SEED_ACTIVITY.slice(0, 20).map((e, i) => ({
    id: 1000 + i,
    time: new Date(now - i * 47_000 - Math.random() * 30_000).toISOString(),
    type: e.type as _ActEv['type'],
    severity: e.severity as _ActEv['severity'],
    title: e.title,
    detail: e.detail,
  }));
  return { events, updatedAt: new Date().toISOString() };
};
type _ActEv = {
  id: number;
  time: string;
  type: 'task' | 'item' | 'error' | 'proxy' | 'template' | 'source';
  severity: 'info' | 'success' | 'warning' | 'error';
  title: string;
  detail?: string;
};
let _actEvents: _ActEv[] = _buildActivity().events;
export let SPIDER_ACTIVITY = {
  events: _actEvents,
  updatedAt: new Date().toISOString(),
};
/** 模拟实时事件流入 — 5s 内插入 1-2 条新事件,旧事件下沉 */
let _nextEventId = 1020;
const _ROTATING_TEMPLATES = [
  { type: 'task', severity: 'success', title: '任务运行完成', details: ['抓取 128 页 · 入库 95 条', '抓取 56 页 · 入库 42 条', '抓取 312 页 · 入库 248 条'] },
  { type: 'item', severity: 'info', title: '新条目入库', details: ['biquge.tw: 18 条', 'qidian.com: 24 条', 'news.qq.com: 12 条', 'music.163.com: 8 条'] },
  { type: 'error', severity: 'error', title: '抓取失败', details: ['HTTP 503', '连接超时 30s', '解析失败: .content'] },
  { type: 'proxy', severity: 'warning', title: '代理健康度下降', details: ['p2: 成功率 88%', 'p5: 失败率上升'] },
  { type: 'source', severity: 'info', title: '源健康度刷新', details: ['douban.com: 良好', 'zhihu.com: 良好', 'weibo.com: 一般'] },
];
export function pushActivityEvent() {
  const tpl = _ROTATING_TEMPLATES[Math.floor(Math.random() * _ROTATING_TEMPLATES.length)];
  const detail = tpl.details[Math.floor(Math.random() * tpl.details.length)];
  const ev: _ActEv = {
    id: _nextEventId++,
    time: new Date().toISOString(),
    type: tpl.type as any,
    severity: tpl.severity as any,
    title: tpl.title,
    detail,
  };
  _actEvents = [ev, ..._actEvents].slice(0, 30);
  SPIDER_ACTIVITY = { events: _actEvents, updatedAt: new Date().toISOString() };
  return ev;
}

// ─── 工具函数(内存可变状态) ───
let nextProxyId = 7;
export function addProxy(url: string, type: 'http' | 'https' | 'socks5') {
  const p = { id: `p${nextProxyId++}`, url, type, active: true, successCount: 0, failCount: 0 };
  SPIDER_PROXIES.list.unshift(p);
  SPIDER_PROXIES.total += 1;
  return p;
}
export function deleteProxy(id: string) {
  const idx = SPIDER_PROXIES.list.findIndex((p) => p.id === id);
  if (idx > -1) {
    SPIDER_PROXIES.list.splice(idx, 1);
    SPIDER_PROXIES.total -= 1;
    return true;
  }
  return false;
}
export function toggleProxy(id: string, active: boolean) {
  const p = SPIDER_PROXIES.list.find((p) => p.id === id);
  if (p) {
    p.active = active;
    return p;
  }
  return null;
}

let nextTaskId = 1100;
export function addTask(params: { sourceId?: number; startUrl: string; maxDepth: number; maxPages: number }) {
  const source = SPIDER_SOURCES.list.find((s) => s.id === params.sourceId);
  const t = {
    id: `t${nextTaskId++}`,
    sourceId: params.sourceId ?? 0,
    sourceName: source?.name || '未知源',
    startUrl: params.startUrl,
    status: 'pending' as const,
    maxDepth: params.maxDepth,
    maxPages: params.maxPages,
    pagesCrawled: 0,
    linksFound: 0,
    itemsSaved: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  (SPIDER_TASKS.list as any[]).unshift(t);
  SPIDER_TASKS.total += 1;
  SPIDER_TASK_ITEMS[t.id] = [];
  SPIDER_TASK_LINKS[t.id] = [];
  return t;
}
export function stopTask(id: string) {
  const t = SPIDER_TASKS.list.find((t) => t.id === id);
  if (t && (t.status === 'running' || t.status === 'pending')) {
    t.status = 'stopped';
    t.updatedAt = new Date().toISOString();
    return t;
  }
  return null;
}
export function deleteTask(id: string) {
  const idx = SPIDER_TASKS.list.findIndex((t) => t.id === id);
  if (idx > -1) {
    SPIDER_TASKS.list.splice(idx, 1);
    SPIDER_TASKS.total -= 1;
    delete SPIDER_TASK_ITEMS[id];
    delete SPIDER_TASK_LINKS[id];
    return true;
  }
  return false;
}

let nextAttrId = 5500;
export function addTemplateAttr(templateId: number, attr: { name: string; type: string; code: string; content: string; remark?: string }) {
  if (!SPIDER_TEMPLATE_ATTRS[templateId]) SPIDER_TEMPLATE_ATTRS[templateId] = [];
  const a = {
    id: nextAttrId++,
    templateId,
    ...attr,
    createdAt: new Date().toISOString(),
  };
  SPIDER_TEMPLATE_ATTRS[templateId].push(a);
  return a;
}
export function updateTemplateAttr(templateId: number, attrId: number, patch: Partial<{ name: string; type: string; code: string; content: string; remark: string }>) {
  const list = SPIDER_TEMPLATE_ATTRS[templateId];
  if (!list) return null;
  const a = list.find((x) => x.id === attrId);
  if (!a) return null;
  Object.assign(a, patch);
  return a;
}
export function deleteTemplateAttr(templateId: number, attrId: number) {
  const list = SPIDER_TEMPLATE_ATTRS[templateId];
  if (!list) return false;
  const idx = list.findIndex((x) => x.id === attrId);
  if (idx > -1) {
    list.splice(idx, 1);
    return true;
  }
  return false;
}

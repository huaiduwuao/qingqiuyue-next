import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test as base, expect, type Page, type Request, type Route } from '@playwright/test';

/**
 * 静态冒烟(playwright.static.config.ts)的公共夹具:
 *  - 所有 /api/** 都由 page.route 拦截,按 { code, msg, data } 信封回 fixture(与 src/lib/api/client.ts 拦截器约定一致);
 *    没登记的接口回一个空分页,并记进 unmatched 方便排查;
 *  - /ws/** 用 routeWebSocket 接住,不连真网关;站外请求一律就地回空,整套用例不出网;
 *  - 收集 console.error / pageerror,用例结束时断言除已知无害项外为空。
 */

export const ok = (data: unknown) => ({ code: 200, msg: 'success', data });
export const page$ = <T>(list: T[], total = list.length, page = 1, pageSize = list.length || 20) =>
  ok({ list, total, page, pageSize });

export const SESSION = 'e2e-session-0001';
export const USER = {
  id: 10001,
  name: 'e2e_user',
  nickname: 'E2E 用户',
  email: '',
  mobile: '',
  avatar: '',
  info: '',
  status: 'NORMAL',
  tenantId: 1,
  roles: ['user'],
  permissions: [] as string[],
  superAdmin: false,
};

export const TINY_VIDEO = readFileSync(path.join(__dirname, 'fixtures', 'tiny.webm'));

type Responder = (req: Request, url: URL) => unknown | Promise<unknown>;
export interface MockRule {
  method?: string;
  /** 匹配去掉 /api 前缀后的 pathname,如 /core/user/current */
  path: RegExp;
  body: Responder | Record<string, unknown> | unknown[] | null;
}

/**
 * 已知无害的控制台报错,逐条写明原因。目前为空:站外请求、推送 WebSocket、EventSource 都已就地接住,
 * 正常页面不该有任何 console.error。真遇到无法避免的再加,别用宽泛的正则把真问题吞掉。
 */
const BENIGN: RegExp[] = [];

const DEFAULT_RULES: MockRule[] = [
  {
    path: /^\/core\/user\/current$/,
    // 和后端一样按会话头判断:带着 Bearer 才算登录(登录页里登录成功后也走这条)
    body: (req) => (req.headers()['authorization'] ? ok(USER) : { code: 401, msg: '未登录', data: null }),
  },
  { path: /^\/core\/menu\/me$/, body: ok([]) },
  { path: /^\/core\/dict\/data\/all$/, body: ok([]) },
  { path: /^\/core\/notice\/count$/, body: ok({ total: 0, system: 0, interaction: 0, msg: 0 }) },
  { path: /^\/core\/msg\/session\/list$/, body: ok({ list: [], total: 0 }) },
  { path: /^\/core\/realtime\/ticket|\/ticket$/, body: ok({ ticket: 'e2e-ticket', expiresIn: 60 }) },
  { path: /^\/core\/auth\/options$|^\/core\/login\/options$/, body: ok({}) },
];

export interface MockOptions {
  authed?: boolean;
  rules?: MockRule[];
}

export interface MockApi {
  /** 落到默认兜底(没登记)的接口,便于补 fixture */
  unmatched: string[];
  /** 所有发出的请求 URL(含站外),用于断言「没去请求某域名」 */
  requests: string[];
  /** 追加/覆盖规则,后加的优先 */
  use(...rules: MockRule[]): void;
}

/**
 * CI / 线上的静态包把 NEXT_PUBLIC_API_BASE_URL 打成 https://qingqiuyue.com(绝对地址),
 * 页面在 127.0.0.1 上跑时接口是跨域的:fulfill 也要带 CORS 头,浏览器才肯把响应交给页面。
 */
function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers()['origin'];
  return origin
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Requested-With',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        Vary: 'Origin',
      }
    : {};
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    headers: { ...corsHeaders(route.request()), 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
}

export async function installMocks(page: Page, opts: MockOptions = {}): Promise<MockApi> {
  const authed = !!opts.authed;
  const rules: MockRule[] = [...(opts.rules ?? []), ...DEFAULT_RULES];
  const api: MockApi = {
    unmatched: [],
    requests: [],
    use: (...r) => rules.unshift(...r),
  };

  page.on('request', (r) => api.requests.push(r.url()));

  await page.addInitScript(
    ([sid, on]) => {
      try {
        if (on) localStorage.setItem('session_id', sid as string);
        else localStorage.removeItem('session_id');
        // 首访引导弹窗(lib/onboardingPrefs)会盖住页面,当作已走完
        localStorage.setItem('qq-onboarding', JSON.stringify({ completed: true, interests: [], seenWelcome: true, version: 1 }));
      } catch {
        /* ignore */
      }
    },
    [SESSION, authed] as const,
  );

  // 站外一律回空:不出网,也不让第三方脚本/图片的失败污染 console
  await page.route(
    (url) => url.hostname !== '127.0.0.1' && url.hostname !== 'localhost',
    (route) => route.fulfill({ status: 204, body: '' }),
  );

  // 推送 WebSocket:接住但不回任何消息
  await page.routeWebSocket(/\/ws\//, () => {});

  // 视频:同源 /qq-video/** 统一回 tiny.webm(Chromium 开源构建不带 H.264,按内容嗅探 WebM;支持 Range 以便 seek)
  await page.route(/\/qq-video\//, async (route) => {
    const range = route.request().headers()['range'];
    const size = TINY_VIDEO.length;
    const m = range && /bytes=(\d+)-(\d*)/.exec(range);
    if (m) {
      const start = Number(m[1]);
      const end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
      await route.fulfill({
        status: 206,
        headers: {
          'Content-Type': 'video/webm',
          'Accept-Ranges': 'bytes',
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Content-Length': String(end - start + 1),
        },
        body: TINY_VIDEO.subarray(start, end + 1),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'video/webm', 'Accept-Ranges': 'bytes', 'Content-Length': String(size) },
      body: TINY_VIDEO,
    });
  });

  await page.route(/\/api\//, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^\/api/, '');
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders(req) });
      return;
    }
    // EventSource(搜索的全网检索推送等):回一个空的事件流,浏览器按 retry 慢慢重连
    if ((req.headers()['accept'] || '').includes('text/event-stream')) {
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders(req), 'Content-Type': 'text/event-stream' },
        body: 'retry: 600000\n\n',
      });
      return;
    }
    for (const r of rules) {
      if (r.method && r.method.toUpperCase() !== req.method()) continue;
      if (!r.path.test(p)) continue;
      const body = typeof r.body === 'function' ? await (r.body as Responder)(req, url) : r.body;
      await fulfillJson(route, body);
      return;
    }
    api.unmatched.push(`${req.method()} ${p}`);
    await fulfillJson(route, page$([]));
  });

  return api;
}

/** 收集 console.error / pageerror,结束时断言为空(BENIGN 除外) */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (BENIGN.some((re) => re.test(text))) return;
    // 资源加载失败的文案里没有地址,补上 location 才知道是哪个文件
    const at = msg.location()?.url;
    errors.push(`[console] ${text}${at ? ` @ ${at}` : ''}`);
  });
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
  return errors;
}

type Fixtures = { errors: string[] };

/** 每个用例自动挂上错误收集(auto),结束时断言没有新错误;用例里也可以提前断言 */
export const test = base.extend<Fixtures>({
  errors: [
    async ({ page }, provide) => {
      const errors = watchErrors(page);
      await provide(errors);
      expect(errors, '页面出现了 console.error / 未捕获异常').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

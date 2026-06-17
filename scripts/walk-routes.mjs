/**
 * 用 Playwright 走完所有前端路由,捕获每个路由触发的 404/4xx/5xx API 请求。
 * 走完后输出 JSON 报告到 stdout 末尾。
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const FRONTEND = 'http://localhost:3000';
const BACKEND = 'http://10.9.1.2:10005';

const routeFile = '/tmp/qingqiuyue-routes.txt';
const raw = readFileSync(routeFile, 'utf8');
const routes = raw
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean);

// 去掉 (group) 包裹层
const toUrl = (r) => '/' + r.replace(/^\([^)]+\)\//, '').replace(/^\([^)]+\)$/, '');

async function login() {
  const res = await fetch(`${BACKEND}/api/core/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'admin', password: 'admin123' }),
  });
  const j = await res.json();
  if (!j.data?.token) throw new Error('login failed: ' + JSON.stringify(j));
  return j.data.token;
}

async function walkRoute(page, url) {
  const findings = [];
  const onResponse = (resp) => {
    const s = resp.status();
    const u = resp.url();
    if (!u.startsWith(BACKEND) && !u.includes('/api/') && !u.includes('/logs/')) return;
    if (s >= 400) {
      findings.push({ status: s, method: resp.request().method(), url: u });
    }
  };
  page.on('response', onResponse);
  try {
    const r = await page.goto(`${FRONTEND}${url}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500); // 给 react-query 一点时间触发 API 请求
    if (!r || r.status() >= 400) {
      findings.push({ status: r?.status() ?? 0, method: 'GET', url: `${FRONTEND}${url}` });
    }
  } catch (e) {
    findings.push({ status: 0, method: 'GET', url: `${FRONTEND}${url}`, error: String(e).slice(0, 200) });
  } finally {
    page.off('response', onResponse);
  }
  return findings;
}

const token = await login();
console.error(`[login] token ok, ${routes.length} routes`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
await ctx.addCookies([
  { name: 'auth-token', value: token, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
]);
const page = await ctx.newPage();
page.setDefaultTimeout(25000);

const report = [];
for (const r of routes) {
  const url = toUrl(r);
  process.stdout.write(`→ ${url}\r`);
  const findings = await walkRoute(page, url);
  if (findings.length) {
    report.push({ route: url, file: r, errors: findings });
  }
}
await browser.close();

writeFileSync('/tmp/qingqiuyue-walk-report.json', JSON.stringify(report, null, 2));
console.error(`\n[done] ${report.length} routes had errors; report -> /tmp/qingqiuyue-walk-report.json`);

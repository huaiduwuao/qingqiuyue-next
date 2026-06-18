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

// 去掉 (group) 包裹层,支持 "/(admin)/system" → "/system" 和 "(admin)/system" → "/system"
// 跳过 Next.js 私有文件夹(_components / _views / 任何 _ 前缀)—— 它们不是路由
function toUrl(r) {
  if (/\/_[^/]+(\/|$)/.test(r)) return null; // 下划线开头的目录段
  const stripped = r.replace(/\/\([^)]+\)\//g, '/').replace(/^\/\([^)]+\)\//, '/');
  return stripped.startsWith('/') ? stripped : '/' + stripped;
}

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
    await page.waitForTimeout(1200);
    if (!r || r.status() >= 400) {
      findings.push({ status: r?.status() ?? 0, method: 'GET', url: `${FRONTEND}${url}` });
    }
    // ── 子 tab / 侧边栏 / 底部导航 一轮扫,触发懒加载的 API 调用 ──
    // 用类名匹配 MUI 组件(其它库可扩展);不点 data-no-drag / 模态触发器,
    // 避免误触播放/暂停/弹窗导致状态污染。
    const tabSelectors = [
      '.MuiTab-root',
      '.MuiListItemButton-root',
      '.MuiBottomNavigationAction-root',
      '.MuiToggleButton-root',
    ].join(', ');
    const tabs = await page.$$(tabSelectors);
    for (const t of tabs) {
      try {
        // 跳过 disabled / hidden
        const isDisabled = await t.evaluate((el) => el.matches('[disabled], [aria-disabled="true"]') || el.getAttribute('data-no-drag') !== null);
        if (isDisabled) continue;
        await t.click({ timeout: 1000 });
        await page.waitForTimeout(600);
      } catch { /* 元素被遮罩/已 unmount,跳过 */ }
    }
    await page.waitForTimeout(500);
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
  if (url === null) continue; // 私有文件夹,不是路由
  process.stdout.write(`→ ${url}\r`);
  const findings = await walkRoute(page, url);
  if (findings.length) {
    report.push({ route: url, file: r, errors: findings });
  }
}
await browser.close();

writeFileSync('/tmp/qingqiuyue-walk-report.json', JSON.stringify(report, null, 2));
console.error(`\n[done] ${report.length} routes had errors; report -> /tmp/qingqiuyue-walk-report.json`);

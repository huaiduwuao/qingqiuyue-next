/**
 * 访问 login 页,捕获浏览器 console 错误,确认 hydration mismatch 是否消除。
 */
import { chromium } from 'playwright';

const errors = [];
const warns = [];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('console', (msg) => {
  const t = msg.type();
  const txt = msg.text();
  if (t === 'error') errors.push(txt);
  if (t === 'warning') warns.push(txt);
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto('http://localhost:3000/user/login', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);

// 截图方便肉眼对比
await page.screenshot({ path: '/tmp/login-page.png', fullPage: true });

const hydrateErrors = [...errors, ...warns].filter((t) =>
  /hydrat|mismatch|css-\w+-Mui/i.test(t)
);

console.log(JSON.stringify({
  totalErrors: errors.length,
  totalWarns: warns.length,
  hydrateIssues: hydrateErrors,
  corsIssues: [...errors, ...warns].filter((t) => /CORS|cors/i.test(t)),
  firstFive: {
    errors: errors.slice(0, 5).map((s) => s.slice(0, 200)),
    warns: warns.slice(0, 5).map((s) => s.slice(0, 200)),
  },
}, null, 2));

await browser.close();

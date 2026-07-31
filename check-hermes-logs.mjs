import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const lr = await page.request.post('http://localhost:3000/api/core/login', {
  data: { name: 'admin', password: 'admin123' },
  headers: { 'Content-Type': 'application/json' }
});
const ld = await lr.json();
const token = ld.data?.session_id;

// 查 hermes 容器日志
// 链路:localhost:3000 → APISIX /api/updater/* → qingqiuyue-updater:8080/container/logs/*
//      → docker logs qingqiuyue-hermes
const r = await page.request.get('http://localhost:3000/api/updater/container/logs/qingqiuyue-hermes');
console.log('status:', r.status());
const text = await r.text();
console.log(text.substring(0, 4000));

await browser.close();
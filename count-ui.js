const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:3000/digital-human', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(4000);
  const items = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.MuiListItemButton-root')).map((el) => el.textContent.trim())
  );
  // 单独发请求核对
  const api = await page.evaluate(async () => {
    const r = await fetch('/api/agentmanager/conversations?userId=0&limit=20');
    const j = await r.json();
    return { total: j.total, ids: (j.list || []).map((x) => x.id) };
  });
  console.log('UI渲染条数:', items.length);
  console.log('UI项:', JSON.stringify(items));
  console.log('API total:', api.total, 'ids:', JSON.stringify(api.ids));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' });
  const page = await ctx.newPage();
  try { await page.goto('https://www.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }); } catch {}
  await page.waitForTimeout(5000);
  const cookies = await ctx.cookies();
  const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  // 用 fetch 直接打 detail API
  const awemeId = '7415783028546194697';
  const resp = await page.evaluate(async ({ awemeId }) => {
    const r = await fetch(`https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=${awemeId}`, {
      headers: { 'Referer': 'https://www.douyin.com/' },
      credentials: 'include'
    });
    return { status: r.status, body: await r.text() };
  }, { awemeId });
  console.log('=== status:', resp.status, '===');
  console.log('body len:', resp.body.length);
  console.log('body prefix:', resp.body.slice(0, 800));
  await browser.close();
})();
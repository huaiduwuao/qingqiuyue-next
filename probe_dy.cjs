const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' });
  const page = await ctx.newPage();
  const apiCalls = [];
  page.on('request', req => {
    const u = req.url();
    if (u.includes('douyin.com/aweme') || u.includes('amemv.com') || u.includes('snssdk.com')) {
      apiCalls.push({ method: req.method(), url: u, headers: req.headers() });
    }
  });
  page.on('response', async resp => {
    const u = resp.url();
    if (u.includes('douyin.com/aweme/v1/web/aweme/detail') || u.includes('douyin.com/aweme/v1/web/aweme/post')) {
      try {
        const body = await resp.text();
        const short = body.length > 500 ? body.slice(0, 500) + '...' : body;
        console.log('--- RESP', resp.status(), u.slice(0, 120), '---');
        console.log(short);
      } catch (e) {}
    }
  });
  // 先访问首页拿到 cookie
  await page.goto('https://www.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  // 滚一下触发加载
  await page.evaluate(() => window.scrollBy(0, 1000));
  await page.waitForTimeout(3000);
  // 现在看是否有 aweme_id 出现
  const awemeIds = await page.evaluate(() => {
    const ids = new Set();
    document.querySelectorAll('a[href*="/video/"]').forEach(a => {
      const m = a.href.match(/\/video\/(\d+)/);
      if (m) ids.add(m[1]);
    });
    return Array.from(ids).slice(0, 5);
  });
  console.log('=== AWEME_IDs on page ===');
  console.log(awemeIds);
  if (awemeIds.length > 0) {
    const testUrl = `https://www.douyin.com/video/${awemeIds[0]}`;
    console.log('=== OPEN video page:', testUrl);
    const callsBefore = apiCalls.length;
    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    const callsAfter = apiCalls.length;
    console.log(`captured ${callsAfter - callsBefore} API calls`);
    console.log('=== API CALLS ===');
    apiCalls.slice(callsBefore).slice(0, 10).forEach(c => {
      console.log(`> ${c.method} ${c.url.slice(0, 150)}`);
      console.log(`  headers: X-Bogus=${c.headers['x-bogus'] || '-'} msToken=${c.headers['msToken'] ? c.headers['msToken'].slice(0,30)+'...' : '-'} cookie=${c.headers['cookie'] ? c.headers['cookie'].slice(0,40)+'...' : '-'}`);
    });
  }
  await browser.close();
})();
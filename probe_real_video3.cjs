const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' });
  const page = await ctx.newPage();
  await page.goto('https://www.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(5000);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(2000);
  // 看页面里所有的 <a> 链接
  const allLinks = await page.$$eval('a', links => links.map(l => l.href).filter(h => h && h.length > 0));
  console.log('total links:', allLinks.length);
  // 找包含 video 的
  const vids = allLinks.filter(h => h.includes('/video/'));
  console.log('video links:', vids.length);
  vids.slice(0, 5).forEach(h => console.log(' ', h));
  // 试看页面源码有没有 aweme_id
  const html = await page.content();
  const matches = html.match(/"aweme_id":"(\d{15,20})"/g);
  console.log('aweme_id matches in HTML:', (matches || []).slice(0, 5));
  // 还有 data-* 属性
  const matches2 = html.match(/data-e2e-aweme-id="(\d+)"/g);
  console.log('data-e2e-aweme-id matches:', (matches2 || []).slice(0, 5));
  await browser.close();
})();
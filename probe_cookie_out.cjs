const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' });
  const page = await ctx.newPage();
  await page.goto('https://www.douyin.com/hot', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const cookies = await ctx.cookies();
  const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  console.log('=== Cookie (供 Go 测试用) ===');
  console.log(cookieStr);
  // 再打开一个视频页拿 aweme_id
  const links = await page.$$eval('a[href*="/video/"]', ls => ls.map(l => l.href));
  if (links.length > 0) {
    await page.goto(links[0], { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(3000);
    const m = page.url().match(/\/video\/(\d+)/);
    if (m) {
      console.log('=== aweme_id ===');
      console.log(m[1]);
      console.log('=== URL ===');
      console.log(page.url());
    }
  }
  await browser.close();
})();
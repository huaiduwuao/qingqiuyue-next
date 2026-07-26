const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    headless: false,  // 用真实浏览器避免被检测
    args: ['--disable-blink-features=AutomationControlled', '--start-maximized']
  });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });
  // 注入反检测脚本
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
    window.chrome = { runtime: {} };
  });
  const page = await ctx.newPage();
  const apiCalls = [];
  page.on('response', async resp => {
    const u = resp.url();
    if (u.includes('douyin.com/aweme/v1/web/aweme/detail')) {
      try {
        const body = await resp.text();
        console.log('=== AWEME DETAIL RESP ===');
        console.log('URL:', u.slice(0, 200));
        console.log('body prefix:', body.slice(0, 600));
        apiCalls.push({ url: u, headers: resp.request().headers() });
      } catch (e) {}
    }
  });
  try {
    await page.goto('https://www.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'dy_home.png' });
    // 点一个视频
    const links = await page.$$('a[href*="/video/"]');
    console.log('video links:', links.length);
    if (links.length > 0) {
      await links[0].click();
      await page.waitForTimeout(8000);
      await page.screenshot({ path: 'dy_video.png' });
      // 拿 aweme_id
      const url = page.url();
      console.log('video URL:', url);
    }
  } catch (e) { console.log('err:', e.message); }
  await browser.close();
})();
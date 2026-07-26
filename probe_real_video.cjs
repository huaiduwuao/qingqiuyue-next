const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' });
  const page = await ctx.newPage();
  await page.goto('https://www.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(8000);
  await page.screenshot({ path: 'home.png' });
  const hrefs = await page.$$eval('a[href*="/video/"]', links => links.map(l => l.href));
  console.log('video links:', hrefs.length);
  hrefs.slice(0, 3).forEach(h => console.log(' ', h));
  if (hrefs.length > 0) {
    await page.goto(hrefs[0], { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'video.png' });
    console.log('video URL:', page.url());
    // 现在打 detail API
    const awemeId = page.url().match(/\/video\/(\d+)/)?.[1];
    console.log('aweme_id:', awemeId);
    if (awemeId) {
      const resp = await page.evaluate(async (id) => {
        const r = await fetch(`https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=${id}`, { credentials: 'include' });
        return { status: r.status, body: await r.text() };
      }, awemeId);
      console.log('=== detail api status:', resp.status);
      const j = JSON.parse(resp.body);
      if (j.aweme_detail) {
        console.log('desc:', j.aweme_detail.desc?.slice(0, 60));
        console.log('video.play_addr.url_list[0]:', j.aweme_detail.video?.play_addr?.url_list?.[0]?.slice(0, 150));
      } else {
        console.log('body:', resp.body.slice(0, 400));
      }
    }
  }
  await browser.close();
})();
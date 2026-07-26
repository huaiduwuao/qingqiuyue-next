const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' });
  const page = await ctx.newPage();
  await page.goto('https://www.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(5000);
  // 关掉登录弹窗
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(1000);
  // 尝试点关闭按钮
  const closeBtn = await page.$('button:has-text("关闭"), .semi-modal-close, [aria-label="close"]');
  if (closeBtn) await closeBtn.click().catch(() => {});
  await page.waitForTimeout(2000);
  // 现在拿视频链接
  const hrefs = await page.$$eval('a[href*="/video/"]', links => links.map(l => l.href));
  console.log('video links:', hrefs.length);
  hrefs.slice(0, 5).forEach(h => console.log(' ', h));
  if (hrefs.length > 0) {
    const awemeId = hrefs[0].match(/\/video\/(\d+)/)?.[1];
    console.log('aweme_id:', awemeId);
    if (awemeId) {
      const resp = await page.evaluate(async (id) => {
        const r = await fetch(`https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=${id}`, { credentials: 'include' });
        return { status: r.status, body: await r.text() };
      }, awemeId);
      const j = JSON.parse(resp.body);
      if (j.aweme_detail) {
        console.log('=== aweme_detail 拿到 ===');
        console.log('desc:', j.aweme_detail.desc?.slice(0, 60));
        console.log('video.play_addr.url_list[0]:', j.aweme_detail.video?.play_addr?.url_list?.[0]?.slice(0, 150));
      } else {
        console.log('body:', resp.body.slice(0, 400));
      }
    }
  }
  await browser.close();
})();
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' });
  const page = await ctx.newPage();
  // 直接访问一个视频页(短链),让它 302 到真实 URL
  await page.goto('https://v.douyin.com/ieHh4qG3/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(5000);
  console.log('final URL:', page.url());
  const m = page.url().match(/\/video\/(\d+)/);
  if (m) {
    const awemeId = m[1];
    console.log('aweme_id:', awemeId);
    // 现在在该页面上下文里调 detail API
    const resp = await page.evaluate(async (id) => {
      const r = await fetch(`https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=${id}`, { credentials: 'include' });
      return { status: r.status, body: await r.text() };
    }, awemeId);
    const j = JSON.parse(resp.body);
    if (j.aweme_detail) {
      console.log('=== 成功 ===');
      console.log('desc:', j.aweme_detail.desc?.slice(0, 60));
      console.log('video.play_addr.url_list[0]:', j.aweme_detail.video?.play_addr?.url_list?.[0]?.slice(0, 150));
      console.log('video.play_addr_h264.url_list[0]:', j.aweme_detail.video?.play_addr_h264?.url_list?.[0]?.slice(0, 150));
      console.log('video.bit_rate count:', (j.aweme_detail.video?.bit_rate || []).length);
      if (j.aweme_detail.video?.bit_rate?.length > 0) {
        j.aweme_detail.video.bit_rate.forEach((br, i) => {
          console.log(`  br[${i}] ${br.bit_rate}bps: ${br.play_addr?.url_list?.[0]?.slice(0, 80)}`);
        });
      }
    } else {
      console.log('body:', resp.body.slice(0, 400));
    }
  }
  await browser.close();
})();
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' });
  const page = await ctx.newPage();
  // 打开首页,看看有没有热搜或视频可以直接访问
  await page.goto('https://www.douyin.com/hot', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'hot.png' });
  // 看 a 标签
  const links = await page.$$eval('a[href*="/video/"]', ls => ls.map(l => l.href));
  console.log('video links:', links.length);
  links.slice(0, 5).forEach(h => console.log(' ', h));
  if (links.length > 0) {
    // 打开第一个视频页
    await page.goto(links[0], { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(5000);
    const m = page.url().match(/\/video\/(\d+)/);
    if (m) {
      const awemeId = m[1];
      console.log('aweme_id:', awemeId);
      const resp = await page.evaluate(async (id) => {
        const r = await fetch(`https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=${id}`, { credentials: 'include' });
        return { status: r.status, body: await r.text() };
      }, awemeId);
      const j = JSON.parse(resp.body);
      if (j.aweme_detail) {
        console.log('=== aweme_detail 成功 ===');
        console.log('desc:', j.aweme_detail.desc?.slice(0, 60));
        console.log('video.play_addr.url_list[0]:', j.aweme_detail.video?.play_addr?.url_list?.[0]?.slice(0, 150));
        console.log('video keys:', Object.keys(j.aweme_detail.video || {}));
        console.log('=== bit_rate (多档清晰度) ===');
        (j.aweme_detail.video?.bit_rate || []).forEach((br, i) => {
          console.log(`  br[${i}] ${br.bit_rate}bps ${br.play_addr?.width}x${br.play_addr?.height} ${br.play_addr?.url_list?.[0]?.slice(0, 80)}`);
        });
        console.log('=== play_addr_h264 ===');
        console.log('  ', j.aweme_detail.video?.play_addr_h264?.url_list?.[0]?.slice(0, 120));
        console.log('=== play_addr_265 ===');
        console.log('  ', j.aweme_detail.video?.play_addr_265?.url_list?.[0]?.slice(0, 120));
      } else {
        console.log('body:', resp.body.slice(0, 400));
      }
    }
  }
  await browser.close();
})();
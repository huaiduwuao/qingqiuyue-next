const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' });
  const page = await ctx.newPage();
  await page.goto('https://www.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(5000);
  const cookies = await ctx.cookies();
  const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  // 试一个已知的热门视频 URL - 用用户提供的搜索页对应的话题
  // 我们用一个公开抖音热门视频的 aweme_id
  const testIds = [
    '7415783028546194697',
    '7412518272724352294',
    '7412089661567962394',
    '7412522834565279003',
    '7412526954932305198',
  ];
  for (const id of testIds) {
    const resp = await page.evaluate(async ({ id, cookieStr }) => {
      const r = await fetch(`https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=${id}`, {
        headers: { 'Cookie': cookieStr },
        credentials: 'include'
      });
      const body = await r.text();
      return { status: r.status, len: body.length, body };
    }, { id, cookieStr });
    const j = JSON.parse(resp.body);
    const ok = !!j.aweme_detail;
    console.log(`${ok ? '✓' : '✗'} aweme_id=${id}  status=${resp.status}  has_detail=${ok}`);
    if (ok) {
      console.log(`  desc: ${j.aweme_detail.desc?.slice(0, 50)}`);
      console.log(`  play_addr.url_list[0]: ${j.aweme_detail.video?.play_addr?.url_list?.[0]?.slice(0, 120)}`);
    } else {
      console.log(`  reason: ${j.filter_detail?.filter_reason || j.status_msg}`);
    }
  }
  await browser.close();
})();
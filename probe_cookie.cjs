const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' });
  const page = await ctx.newPage();
  // 访问抖音首页拿 cookie
  try { await page.goto('https://www.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }); } catch {}
  await page.waitForTimeout(5000);
  const cookies = await ctx.cookies();
  console.log('=== cookies ===');
  const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  console.log(cookieStr.slice(0, 500));
  console.log('=== individual cookies ===');
  cookies.forEach(c => console.log(`  ${c.name} = ${c.value.slice(0,40)}${c.value.length>40?'...':''}`));
  await browser.close();
})();
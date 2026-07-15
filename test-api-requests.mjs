import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const requests = [];
page.on('request', req => {
  if (req.url().includes('module/content')) {
    requests.push({ url: req.url(), time: Date.now() });
  }
});
page.on('response', res => {
  if (res.url().includes('module/content')) {
    console.log('RESPONSE:', res.status(), res.url().substring(60));
  }
});

console.log('=== 测试 API 请求 ===');
await page.goto('http://localhost:3000/home/recommend?tab=all', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(5000);
console.log('初始请求数:', requests.length);

// 滚动
await page.evaluate(() => {
  const main = document.querySelector('main');
  if (main) {
    main.scrollTop = main.scrollHeight;
    main.dispatchEvent(new Event('scroll', { bubbles: true }));
  }
});
await page.waitForTimeout(3000);
console.log('滚动后请求数:', requests.length);

// 继续滚动
for (let i = 0; i < 5; i++) {
  await page.evaluate(() => {
    const main = document.querySelector('main');
    if (main) {
      main.scrollTop = main.scrollHeight;
      main.dispatchEvent(new Event('scroll', { bubbles: true }));
    }
  });
  await page.waitForTimeout(2000);
  console.log(`第${i+2}次滚动后请求数:`, requests.length);
}

console.log('\n所有请求:');
requests.forEach((r, i) => console.log(`${i+1}. ${r.url.substring(60)}`));

await browser.close();

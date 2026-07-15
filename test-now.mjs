import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

page.on('console', msg => console.log('LOG:', msg.text()));

console.log('=== 测试 tab=home ===');
await page.goto('http://localhost:3000/home/recommend?tab=home', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(5000);

let imgs = await page.evaluate(() => document.querySelectorAll('img').length);
console.log('初始图片:', imgs);

// 检查 MAIN 滚动信息
const scrollInfo = await page.evaluate(() => {
  const main = document.querySelector('main');
  return {
    scrollTop: main?.scrollTop,
    scrollHeight: main?.scrollHeight,
    clientHeight: main?.clientHeight,
    dist: main ? main.scrollHeight - main.scrollTop - main.clientHeight : 0
  };
});
console.log('MAIN 滚动信息:', scrollInfo);

// 滚动到底部
await page.evaluate(() => {
  const main = document.querySelector('main');
  if (main) {
    main.scrollTop = main.scrollHeight;
    main.dispatchEvent(new Event('scroll', { bubbles: true }));
  }
});
await page.waitForTimeout(3000);

imgs = await page.evaluate(() => document.querySelectorAll('img').length);
console.log('滚动1次后图片:', imgs);

// 继续滚动
for (let i = 0; i < 3; i++) {
  await page.evaluate(() => {
    const main = document.querySelector('main');
    if (main) {
      main.scrollTop = main.scrollHeight;
      main.dispatchEvent(new Event('scroll', { bubbles: true }));
    }
  });
  await page.waitForTimeout(2000);
  imgs = await page.evaluate(() => document.querySelectorAll('img').length);
  console.log(`滚动${i+2}次后图片:`, imgs);
}

await browser.close();
console.log('\n✅ 测试完成');

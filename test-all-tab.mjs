import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

page.on('console', msg => console.log('LOG:', msg.text()));

console.log('=== 测试 tab=all ===');
await page.goto('http://localhost:3000/home/recommend?tab=all', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(6000);

let imgs = await page.evaluate(() => document.querySelectorAll('img').length);
console.log('初始图片:', imgs);

const scrollInfo = await page.evaluate(() => {
  const main = document.querySelector('main');
  return {
    scrollTop: main?.scrollTop,
    scrollHeight: main?.scrollHeight,
    clientHeight: main?.clientHeight,
    dist: main ? main.scrollHeight - main.scrollTop - main.clientHeight : 0
  };
});
console.log('MAIN:', scrollInfo);

// 滚动
for (let i = 0; i < 5; i++) {
  await page.evaluate(() => {
    const main = document.querySelector('main');
    if (main) {
      main.scrollTop = main.scrollHeight;
      main.dispatchEvent(new Event('scroll', { bubbles: true }));
    }
  });
  await page.waitForTimeout(2500);
  imgs = await page.evaluate(() => document.querySelectorAll('img').length);
  const dist = await page.evaluate(() => {
    const main = document.querySelector('main');
    return main ? main.scrollHeight - main.scrollTop - main.clientHeight : 0;
  });
  console.log(`滚动${i+1}: 图片=${imgs}, dist=${dist}`);
}

await browser.close();

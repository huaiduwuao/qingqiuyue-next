import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

page.on('console', msg => console.log('LOG:', msg.text()));

console.log('=== 测试 React Query 状态 ===');
await page.goto('http://localhost:3000/home/recommend?tab=all', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(5000);

// 检查初始状态
let state = await page.evaluate(() => {
  const main = document.querySelector('main');
  return {
    imgs: document.querySelectorAll('img').length,
    mainDist: main ? main.scrollHeight - main.scrollTop - main.clientHeight : 0
  };
});
console.log('初始:', state);

// 滚动到中间位置
await page.evaluate(() => {
  const main = document.querySelector('main');
  if (main) {
    main.scrollTop = main.scrollHeight / 2;
    main.dispatchEvent(new Event('scroll', { bubbles: true }));
  }
});
await page.waitForTimeout(2000);

// 滚动到底部
await page.evaluate(() => {
  const main = document.querySelector('main');
  if (main) {
    main.scrollTop = main.scrollHeight;
    main.dispatchEvent(new Event('scroll', { bubbles: true }));
  }
});
await page.waitForTimeout(3000);

state = await page.evaluate(() => {
  const main = document.querySelector('main');
  return {
    imgs: document.querySelectorAll('img').length,
    mainDist: main ? main.scrollHeight - main.scrollTop - main.clientHeight : 0
  };
});
console.log('滚动到底部后:', state);

// 检查 React DevTools 或直接检查 queryKey
const queryKeys = await page.evaluate(() => {
  // 尝试从 window 获取 React Query 缓存
  const keys = [];
  // 这只是一个诊断方法
  return keys;
});
console.log('Query keys:', queryKeys);

await browser.close();

import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// 监听控制台错误
page.on('console', msg => {
  if (msg.type() === 'error') {
    console.log('[CONSOLE ERROR]:', msg.text());
  }
});

page.on('pageerror', err => {
  console.log('[PAGE ERROR]:', err.message);
});

try {
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  
  const title = await page.title();
  console.log('[PAGE TITLE]:', title);
  
  // 检查图片加载情况
  const images = await page.$$eval('img', imgs => imgs.slice(0, 10).map(img => ({
    src: img.src.substring(0, 100),
    loaded: img.complete && img.naturalWidth > 0,
    alt: img.alt || ''
  })));
  console.log('[IMAGES COUNT]:', images.length);
  console.log('[IMAGES]:', JSON.stringify(images, null, 2));
  
  // 页面内容摘要
  const content = await page.$eval('main', el => el.innerText.substring(0, 1000)).catch(() => 'no main');
  console.log('[PAGE TEXT]:', content);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

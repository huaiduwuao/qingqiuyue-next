import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// 监听网络请求失败
page.on('requestfailed', request => {
  console.log('[REQUEST FAILED]:', request.url().substring(0, 120));
});

page.on('response', response => {
  if (response.status() >= 400) {
    console.log('[HTTP ERROR]:', response.status(), response.url().substring(0, 120));
  }
});

try {
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);
  
  // 检查具体图片
  const imageDetails = await page.$$eval('img', imgs => imgs.slice(0, 5).map(img => ({
    src: img.src,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    complete: img.complete,
    currentSrc: img.currentSrc,
    offsetWidth: img.offsetWidth,
    offsetHeight: img.offsetHeight
  })));
  console.log('[IMAGE DETAILS]:', JSON.stringify(imageDetails, null, 2));
  
  // 检查 CSS 背景图
  const bgImages = await page.$$eval('*', els => 
    els.filter(el => {
      const style = window.getComputedStyle(el);
      return style.backgroundImage && style.backgroundImage !== 'none' && style.backgroundImage.startsWith('url');
    }).slice(0, 5).map(el => ({
      tag: el.tagName,
      class: el.className,
      bgImage: window.getComputedStyle(el).backgroundImage
    }))
  );
  console.log('[BG IMAGES]:', JSON.stringify(bgImages, null, 2));
  
  // 检查数据来源
  const apiRequests = await page.evaluate(() => {
    const items = window.__NEXT_DATA__?.props?.pageProps || {};
    return Object.keys(items).slice(0, 10);
  });
  console.log('[PAGE PROPS KEYS]:', apiRequests);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

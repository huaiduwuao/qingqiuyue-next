import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// 监听网络请求
page.on('response', async response => {
  const url = response.url();
  if (response.status() >= 400 && url.includes('/api/')) {
    console.log(`[HTTP ${response.status()}]: ${url}`);
  }
});

try {
  console.log('Loading ?tab=home...');
  await page.goto('http://localhost:3000/home/recommend?tab=home', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // 检查图片加载情况
  const images = await page.$$eval('img', imgs => imgs.slice(0, 10).map(img => ({
    src: img.src.substring(0, 80),
    loaded: img.complete && img.naturalWidth > 0,
    alt: img.alt?.substring(0, 30) || ''
  })));
  
  console.log('\n[IMAGES]:');
  images.forEach(img => {
    console.log(`  ${img.loaded ? '✅' : '❌'} ${img.src}`);
    console.log(`     alt: ${img.alt}`);
  });
  
  // 检查 API 返回的数据
  const apiData = await page.evaluate(() => {
    // 查找页面内容
    const body = document.body.innerText;
    const lines = body.split('\n').filter(l => l.trim());
    return lines.slice(0, 30);
  });
  
  console.log('\n[PAGE CONTENT]:');
  apiData.forEach(line => console.log(' ', line));
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

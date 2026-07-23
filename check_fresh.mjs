import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

let apiCalls = [];
page.on('request', request => {
  const url = request.url();
  if (url.includes('/api/content')) {
    console.log('[REQUEST]:', url);
  }
});

page.on('response', async response => {
  const url = response.url();
  if (url.includes('/api/content') && response.status() === 200) {
    try {
      const data = await response.json();
      console.log(`[RESPONSE]: list=${data.data?.list?.length || 0}, total=${data.data?.total || 0}`);
    } catch(e) {}
  }
});

try {
  await page.goto('http://localhost:3000/home/recommend?tab=home', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  const content = await page.evaluate(() => document.body.innerText);
  console.log('\n[EMPTY STATE]:', content.includes('内容为空') || content.includes('暂无'));
  console.log('[HAS ITEMS]:', content.includes('播放') || content.includes('分钟'));
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

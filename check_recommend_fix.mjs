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
      if (data.data?.list) {
        console.log(`[RESPONSE]: list=${data.data.list.length}, total=${data.data.total}`);
      }
    } catch(e) {}
  }
});

try {
  console.log('Loading ?tab=home...');
  await page.goto('http://localhost:3000/home/recommend?tab=home', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  const content = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasEmpty: text.includes('内容为空') || text.includes('暂无'),
      hasItems: text.includes('各行各业') || text.includes('功夫女足') || text.includes('播放'),
    };
  });
  
  console.log('\n[RESULT]:', content);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

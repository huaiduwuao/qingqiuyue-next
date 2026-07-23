import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

let apiData = null;
page.on('response', async response => {
  if (response.url().includes('/api/content/home/feed') && response.status() === 200) {
    try {
      const data = await response.json();
      apiData = data;
    } catch(e) {}
  }
});

try {
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  
  if (apiData) {
    console.log('[API DATA]:', JSON.stringify(apiData.data?.list?.slice(0, 3), null, 2));
  }
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

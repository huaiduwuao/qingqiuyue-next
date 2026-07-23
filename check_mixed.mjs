import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('response', async response => {
  const url = response.url();
  if (url.includes('/recommend/feed')) {
    try {
      const data = await response.json();
      const list = data.data?.list || [];
      const types = [...new Set(list.map(i => i.contentType))];
      console.log('[TYPES IN RESPONSE]:', types);
      console.log('[ITEMS]:');
      list.forEach((item, i) => {
        console.log(`  ${i+1}. ${item.contentType}: ${item.title?.substring(0, 30)}`);
      });
    } catch(e) {
      console.log('[ERROR]:', e.message);
    }
  }
});

try {
  await page.goto('http://localhost:3000/home/recommend?tab=home', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

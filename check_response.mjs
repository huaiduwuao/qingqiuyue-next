import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('response', async response => {
  const url = response.url();
  if (url.includes('/recommend/feed')) {
    try {
      const data = await response.json();
      console.log('[RECOMMEND RESPONSE]:', JSON.stringify(data, null, 2).substring(0, 1000));
    } catch(e) {
      console.log('[ERROR]:', e.message);
    }
  }
});

try {
  await page.goto('http://localhost:3000/home/recommend?tab=home', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

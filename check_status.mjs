import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('response', async response => {
  const url = response.url();
  if (url.includes('/recommend/feed')) {
    console.log(`[RESPONSE ${response.status()}]:`, url);
    try {
      const text = await response.text();
      console.log('[BODY]:', text.substring(0, 500));
    } catch(e) {
      console.log('[TEXT ERROR]:', e.message);
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

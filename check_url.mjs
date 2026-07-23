import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('request', request => {
  const url = request.url();
  if (url.includes('/recommend/feed')) {
    console.log('[REQUEST URL]:', url);
  }
});

try {
  await page.goto('http://localhost:3000/home/recommend?tab=home', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

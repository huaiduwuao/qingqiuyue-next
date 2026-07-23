import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', msg => {
  console.log(`[${msg.type().toUpperCase()}]:`, msg.text());
});

page.on('pageerror', err => {
  console.log('[PAGE ERROR]:', err.message);
});

try {
  console.log('Loading page...');
  const response = await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'load', timeout: 30000 });
  console.log('[STATUS]:', response.status());
  
  await page.waitForTimeout(5000);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

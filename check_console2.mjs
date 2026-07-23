import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', msg => {
  console.log(`[${msg.type().toUpperCase()}]:`, msg.text());
});

try {
  console.log('=== Loading with section=recommend ===');
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

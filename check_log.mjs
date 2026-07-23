import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('FeedPanel') || text.includes('contentType')) {
    console.log('[CONSOLE]:', text);
  }
});

try {
  await page.goto('http://localhost:3000/home/recommend?tab=home', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

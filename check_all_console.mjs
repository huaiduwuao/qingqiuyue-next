import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Capture ALL console messages
page.on('console', msg => {
  console.log(`[${msg.type().toUpperCase()}]:`, msg.text());
});

// Capture page errors
page.on('pageerror', err => {
  console.log('[PAGE ERROR]:', err.message);
});

try {
  console.log('Loading with section=recommend...');
  const response = await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('[STATUS]:', response.status());
  
  // Wait for any errors
  await page.waitForTimeout(5000);
  
  // Check if there's any content
  const hasContent = await page.evaluate(() => document.body.children.length > 0);
  console.log('[HAS CONTENT]:', hasContent);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

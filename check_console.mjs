import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Capture ALL console messages
page.on('console', msg => {
  console.log(`[${msg.type().toUpperCase()}]:`, msg.text());
});

try {
  console.log('=== Loading with section=recommend ===');
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(4000);
  
  // Check what's in the page
  const content = await page.evaluate(() => document.body.innerText);
  const lines = content.split('\n').filter(l => l.trim()).slice(0, 20);
  console.log('\n[PAGE CONTENT LINES]:', lines);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

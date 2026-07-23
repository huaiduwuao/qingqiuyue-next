import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('HomeRecommendPage') || text.includes('section=') || text.includes('MOUNTED')) {
    console.log(`[CONSOLE]:`, text);
  }
});

try {
  console.log('Loading page with section=recommend...');
  const response = await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'load', timeout: 30000 });
  console.log('[STATUS]:', response.status());
  
  await page.waitForTimeout(5000);
  
  console.log('\n[Done waiting]');
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

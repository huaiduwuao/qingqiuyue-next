import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('HomeRecommendPage') || text.includes('DEBUG')) {
    console.log(`[CONSOLE]:`, text);
  }
});

try {
  console.log('Loading with section=recommend...');
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  // Check content
  const hasDebugBar = await page.evaluate(() => document.body.innerText.includes('DEBUG: tabFromUrl'));
  console.log('\n[HAS DEBUG BAR]:', hasDebugBar);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('HomeRecommendPage') || text.includes('section=')) {
    console.log('[CONSOLE]:', text);
  }
});

page.on('pageerror', err => {
  console.log('[PAGE ERROR]:', err.message);
});

try {
  console.log('Loading with section=recommend...');
  const response = await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'load', timeout: 30000 });
  console.log('[STATUS]:', response.status());
  
  await page.waitForTimeout(8000);
  
  // Get full page content
  const content = await page.evaluate(() => {
    const body = document.body.innerText;
    const lines = body.split('\n').filter(l => l.trim());
    return {
      hasDebug: body.includes('DEBUG:'),
      firstLines: lines.slice(0, 30),
      hasGreenBg: document.body.innerHTML.includes('rgb(0, 255, 0)') || document.body.innerHTML.includes('#00ff00')
    };
  });
  
  console.log('[CONTENT]:', JSON.stringify(content, null, 2));
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

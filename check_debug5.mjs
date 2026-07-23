import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('DEBUG')) {
    console.log('[CONSOLE]:', text);
  }
});

try {
  console.log('Loading with section=recommend...');
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  
  // Check for debug bar at top of page
  const pageContent = await page.content();
  const hasDebugBar = pageContent.includes('DEBUG: tabFromUrl');
  console.log('[HAS DEBUG BAR]:', hasDebugBar);
  
  // Get visible text
  const bodyText = await page.evaluate(() => document.body.innerText);
  const lines = bodyText.split('\n').filter(l => l.trim()).slice(0, 30);
  console.log('[FIRST 30 LINES]:', lines);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

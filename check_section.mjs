import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('HomeRecommend') || text.includes('tabFromUrl') || text.includes('recommend')) {
    console.log('[CONSOLE]:', text);
  }
});

try {
  console.log('Testing: /home/recommend?section=recommend');
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  
  // Check URL after navigation
  console.log('[URL]:', page.url());
  
  // Check what tabFromUrl value was
  const tabValue = await page.evaluate(() => {
    // Try to access React state - this is a hack but let's see
    return document.body.innerText.includes('recommend');
  });
  console.log('[Has recommend content]:', tabValue);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  console.log('=== Test 1: ?section=recommend ===');
  let response = await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'load', timeout: 30000 });
  console.log('[STATUS]:', response.status());
  await page.waitForTimeout(5000);
  
  let content = await page.evaluate(() => ({
    url: window.location.href,
    search: window.location.search,
    body: document.body.innerText.substring(0, 300)
  }));
  console.log('[URL]:', content.url);
  console.log('[SEARCH]:', content.search);
  console.log('[BODY PREVIEW]:', content.body.replace(/\n/g, ' ').substring(0, 200));
  
  // Navigate away
  await page.goto('about:blank');
  
  console.log('\n=== Test 2: ?tab=recommend ===');
  response = await page.goto('http://localhost:3000/home/recommend?tab=recommend', { waitUntil: 'load', timeout: 30000 });
  console.log('[STATUS]:', response.status());
  await page.waitForTimeout(5000);
  
  content = await page.evaluate(() => ({
    url: window.location.href,
    search: window.location.search,
    body: document.body.innerText.substring(0, 300)
  }));
  console.log('[URL]:', content.url);
  console.log('[SEARCH]:', content.search);
  console.log('[BODY PREVIEW]:', content.body.replace(/\n/g, ' ').substring(0, 200));
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

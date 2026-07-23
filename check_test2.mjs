import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  console.log('Testing /test-search with section=recommend...');
  const response = await page.goto('http://localhost:3000/test-search?section=recommend', { waitUntil: 'load', timeout: 30000 });
  console.log('[STATUS]:', response.status());
  
  await page.waitForTimeout(5000);
  
  const content = await page.evaluate(() => {
    const body = document.body;
    return {
      hasGreen: body.innerHTML.includes('rgb(0, 255, 0)'),
      text: body.innerText,
    };
  });
  
  console.log('[CONTENT]:', JSON.stringify(content, null, 2));
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

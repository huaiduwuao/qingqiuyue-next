import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  console.log('Testing minimal test page with section=recommend...');
  const response = await page.goto('http://localhost:3000/home/recommend/test-page?section=recommend', { waitUntil: 'load', timeout: 30000 });
  console.log('[STATUS]:', response.status());
  
  await page.waitForTimeout(5000);
  
  const content = await page.evaluate(() => {
    const body = document.body;
    return {
      hasGreen: body.innerHTML.includes('rgb(0, 255, 0)') || body.innerHTML.includes('#00ff00'),
      text: body.innerText,
      html: body.innerHTML.substring(0, 500)
    };
  });
  
  console.log('[CONTENT]:', JSON.stringify(content, null, 2));
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

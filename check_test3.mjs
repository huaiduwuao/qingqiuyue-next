import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Capture all console messages
page.on('console', msg => {
  console.log(`[${msg.type().toUpperCase()}]:`, msg.text());
});

try {
  console.log('Loading with section=recommend...');
  const response = await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'load', timeout: 30000 });
  console.log('[STATUS]:', response.status());
  
  await page.waitForTimeout(5000);
  
  // Check console logs for our test
  const content = await page.evaluate(() => {
    return {
      hasVideo: document.body.innerText.includes('各行各业'),
      hasMusic: document.body.innerText.includes('Lover'),
    };
  });
  
  console.log('\n[CONTENT]:', content);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

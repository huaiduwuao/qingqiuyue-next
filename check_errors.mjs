import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Capture all console messages
page.on('console', msg => {
  console.log(`[${msg.type().toUpperCase()}]:`, msg.text());
});

page.on('pageerror', err => {
  console.log('[PAGE ERROR]:', err.message);
  console.log('[STACK]:', err.stack);
});

page.on('response', response => {
  if (response.status() >= 400 && !response.url().includes('favicon')) {
    console.log(`[HTTP ${response.status()}]:`, response.url());
  }
});

try {
  console.log('Loading page...');
  const response = await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'load', timeout: 30000 });
  
  console.log('[STATUS]:', response.status());
  
  // Wait a bit for JS to execute
  await page.waitForTimeout(10000);
  
  // Check if there's any content
  const content = await page.content();
  console.log('[HTML LENGTH]:', content.length);
  
  // Try to evaluate in page context
  const evalResult = await page.evaluate(() => {
    return {
      bodyHTML: document.body.innerHTML.substring(0, 500),
      children: document.body.children.length,
      scripts: document.scripts.length
    };
  });
  
  console.log('[EVAL RESULT]:', JSON.stringify(evalResult, null, 2));
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

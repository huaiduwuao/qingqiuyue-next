import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  console.log('Loading with section=recommend...');
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  // Check for debug banner
  const hasDebugBanner = await page.evaluate(() => {
    // Look for the green debug banner
    const elements = document.querySelectorAll('*');
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      if (style.backgroundColor === 'rgb(0, 255, 0)' || style.backgroundColor === '#00ff00') {
        return {
          found: true,
          text: el.textContent,
          position: style.position
        };
      }
    }
    return { found: false };
  });
  
  console.log('[DEBUG BANNER]:', JSON.stringify(hasDebugBanner, null, 2));
  
  // Also check console
  const bodyText = await page.evaluate(() => document.body.innerText);
  const hasDebugInText = bodyText.includes('DEBUG: section=');
  console.log('[HAS DEBUG IN TEXT]:', hasDebugInText);
  
  if (hasDebugInText) {
    const debugLine = bodyText.split('\n').find(l => l.includes('DEBUG:'));
    console.log('[DEBUG LINE]:', debugLine);
  }
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

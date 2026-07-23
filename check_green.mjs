import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  console.log('Loading with section=recommend...');
  const response = await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'load', timeout: 30000 });
  console.log('[STATUS]:', response.status());
  
  await page.waitForTimeout(8000);
  
  // Check for green banner
  const result = await page.evaluate(() => {
    const body = document.body;
    const html = body.innerHTML;
    
    // Look for green background
    const allElements = document.querySelectorAll('*');
    const greenElements = [];
    for (const el of allElements) {
      const bg = window.getComputedStyle(el).backgroundColor;
      if (bg === 'rgb(0, 255, 0)' || bg === '#00ff00') {
        greenElements.push({
          tag: el.tagName,
          text: el.textContent,
          position: window.getComputedStyle(el).position
        });
      }
    }
    
    return {
      hasGreen: greenElements.length > 0,
      greenElements,
      hasDebugText: html.includes('DEBUG: section='),
      debugTextMatch: html.match(/DEBUG: section=([^<]+)/)?.[0] || 'NOT FOUND',
      hasVideo: body.innerText.includes('各行各业'),
      hasMusic: body.innerText.includes('Lover')
    };
  });
  
  console.log('[RESULT]:', JSON.stringify(result, null, 2));
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Capture ALL console messages
page.on('console', msg => {
  console.log(`[${msg.type().toUpperCase()}]:`, msg.text());
});

try {
  console.log('Loading with section=recommend...');
  const response = await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'load', timeout: 30000 });
  console.log('[STATUS]:', response.status());
  
  await page.waitForTimeout(8000);
  
  // Check the actual content
  const content = await page.evaluate(() => {
    const body = document.body;
    const html = body.innerHTML;
    
    // Find ALL elements with green background
    const allGreen = [];
    document.querySelectorAll('*').forEach(el => {
      const bg = window.getComputedStyle(el).backgroundColor;
      if (bg === 'rgb(0, 255, 0)') {
        allGreen.push(el.textContent);
      }
    });
    
    return {
      greenCount: allGreen.length,
      greenTexts: allGreen,
      hasDebugInHtml: html.includes('DEBUG:'),
      debugSection: html.match(/DEBUG:[^<]+/)?.[0] || 'NOT FOUND',
      hasVideo: body.innerText.includes('各行各业'),
      hasMusic: body.innerText.includes('Lover'),
      url: window.location.href
    };
  });
  
  console.log('\n[RESULT]:', JSON.stringify(content, null, 2));
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

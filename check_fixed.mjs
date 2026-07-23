import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  console.log('Loading with section=recommend...');
  const response = await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('[STATUS]:', response.status());
  
  await page.waitForTimeout(5000);
  
  // Check for debug banner
  const hasDebugBanner = await page.evaluate(() => {
    const body = document.body.innerText;
    return {
      hasDebug: body.includes('DEBUG:'),
      debugText: body.match(/DEBUG: section="([^"]+)"/)?.[1] || 'NOT FOUND',
      hasVideo: body.includes('各行各业') || body.includes('功夫女足'),
      hasMusic: body.includes('Lover')
    };
  });
  
  console.log('[RESULT]:', JSON.stringify(hasDebugBanner, null, 2));
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  console.log('=== Test: ?section=recommend (should show RecommendVideoFeed) ===');
  const response = await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'load', timeout: 30000 });
  console.log('[STATUS]:', response.status());
  
  await page.waitForTimeout(5000);
  
  const content = await page.evaluate(() => {
    const body = document.body.innerText;
    return {
      hasVideo: body.includes('各行各业') || body.includes('功夫女足'),
      hasMusic: body.includes('Lover'),
      hasDebug: body.includes('DEBUG:'),
      firstLine: body.split('\n').filter(l => l.trim())[20] || 'N/A'
    };
  });
  
  console.log('[RESULT]:', JSON.stringify(content, null, 2));
  
  // Also test ?tab=recommend
  console.log('\n=== Test: ?tab=recommend (should show RecommendVideoFeed) ===');
  await page.goto('http://localhost:3000/home/recommend?tab=recommend', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  const content2 = await page.evaluate(() => {
    const body = document.body.innerText;
    return {
      hasVideo: body.includes('各行各业') || body.includes('功夫女足'),
      hasMusic: body.includes('Lover')
    };
  });
  
  console.log('[RESULT2]:', JSON.stringify(content2, null, 2));
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

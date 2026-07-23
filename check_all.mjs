import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Capture all console messages
page.on('console', msg => {
  console.log(`[${msg.type().toUpperCase()}]:`, msg.text());
});

page.on('pageerror', err => {
  console.log('[PAGE ERROR]:', err.message);
});

try {
  console.log('Loading with section=recommend...');
  const response = await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'load', timeout: 30000 });
  console.log('[STATUS]:', response.status());
  
  // Wait for any JS execution
  await page.waitForTimeout(10000);
  
  // Check content
  const content = await page.evaluate(() => {
    const body = document.body.innerText;
    return {
      hasDebug: body.includes('DEBUG:'),
      hasVideo: body.includes('各行各业') || body.includes('功夫女足'),
      hasMusic: body.includes('Lover'),
      hasCategoryNav: body.includes('多分类聚合'),
      first20: body.split('\n').filter(l => l.trim()).slice(0, 20)
    };
  });
  
  console.log('\n[CONTENT]:', JSON.stringify(content, null, 2));
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

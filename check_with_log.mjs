import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('HomeRecommend') || text.includes('tabFromUrl')) {
    console.log('[CONSOLE]:', text);
  }
});

try {
  console.log('Loading with section=recommend...');
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  
  // Check what content is showing
  const content = await page.evaluate(() => {
    const body = document.body.innerText;
    return {
      hasVideo: body.includes('各行各业') || body.includes('功夫女足'),
      hasMusic: body.includes('Lover') || body.includes('Taylor Swift'),
      firstLine: body.split('\n').filter(l => l.trim())[10] || 'N/A'
    };
  });
  
  console.log('\n[CONTENT CHECK]:', content);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
// Create fresh context
const context = await browser.newContext();
const page = await context.newPage();

page.on('response', async response => {
  const url = response.url();
  if (url.includes('/recommend/feed')) {
    try {
      const data = await response.json();
      const types = [...new Set((data.data?.list || []).map(i => i.contentType))];
      console.log('[RESPONSE TYPES]:', types);
    } catch(e) {}
  }
});

try {
  // Fresh navigation
  await page.goto('about:blank');
  await page.goto('http://localhost:3000/home/recommend?tab=home', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  const content = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasVideo: text.includes('各行各业') || text.includes('功夫女足'),
      hasMusic: text.includes('Lover'),
      hasEmpty: text.includes('内容为空'),
    };
  });
  
  console.log('[RESULT]:', content);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

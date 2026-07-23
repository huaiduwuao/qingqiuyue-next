import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

let apiCalls = [];
page.on('response', async response => {
  if (response.url().includes('/api/') && response.status() === 200) {
    try {
      const url = response.url();
      const data = await response.json();
      const types = data.data?.list?.map(i => i.category || i.contentType) || [];
      apiCalls.push({ 
        url: url.replace('https://qingqiuyue.com', ''), 
        count: data.data?.list?.length || 0,
        types: [...new Set(types)],
        firstTitle: data.data?.list?.[0]?.title
      });
    } catch(e) {}
  }
});

try {
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  
  console.log('[ALL API CALLS]:');
  apiCalls.forEach(call => {
    console.log(`  ${call.url}`);
    console.log(`    Types: ${call.types.join(',')}, Count: ${call.count}, First: ${call.firstTitle}`);
  });
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

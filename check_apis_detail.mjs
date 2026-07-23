import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

let apiCalls = [];
page.on('response', async response => {
  const url = response.url();
  if (url.includes('/api/content/') && response.status() === 200) {
    try {
      const data = await response.json();
      const types = [...new Set((data.data?.list || []).map(i => i.category || i.contentType))];
      const count = (data.data?.list || []).length;
      const firstTitle = data.data?.list?.[0]?.title || 'N/A';
      apiCalls.push({
        url: url.replace('https://qingqiuyue.com', '').split('?')[0],
        params: new URL(url).searchParams.toString(),
        types,
        count,
        firstTitle: firstTitle.substring(0, 40)
      });
    } catch(e) {}
  }
});

try {
  console.log('Testing: section=recommend');
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  
  console.log('[ALL CONTENT API CALLS]:');
  apiCalls.forEach(call => {
    console.log(`\n  URL: ${call.url}`);
    console.log(`  Params: ${call.params}`);
    console.log(`  Types: ${call.types.join(',')}, Count: ${call.count}`);
    console.log(`  First: ${call.firstTitle}`);
  });
  
  // Check if recommend/feed was called
  const hasRecommendFeed = apiCalls.some(c => c.url.includes('recommend/feed'));
  console.log('\n[HAS RECOMMEND/FEED CALL]:', hasRecommendFeed);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

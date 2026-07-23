import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Register listener BEFORE navigation
let apiCalls = [];
page.on('request', request => {
  const url = request.url();
  if (url.includes('/api/') && !url.includes('agentmanager')) {
    apiCalls.push(url.replace('https://qingqiuyue.com', '').replace('http://localhost:3000', ''));
  }
});

page.on('response', async response => {
  const url = response.url();
  if (url.includes('/api/content/') && response.status() === 200) {
    try {
      const data = await response.json();
      const types = [...new Set((data.data?.list || []).map(i => i.category || i.contentType))];
      const firstTitle = data.data?.list?.[0]?.title || 'N/A';
      console.log(`[API ${response.status()}]: ${url.split('?')[0]} -> Types: ${types.join(',')}, First: ${firstTitle.substring(0, 30)}`);
    } catch(e) {}
  }
});

try {
  console.log('Testing: section=recommend (should show RecommendVideoFeed)');
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  
  console.log('\n[ALL API CALLS]:', apiCalls.length);
  apiCalls.forEach(call => console.log(' ', call));
  
  // Check final content
  const content = await page.content();
  const hasRecommendContent = content.includes('功夫女足') || content.includes('0:00');
  console.log('\n[HAS RECOMMEND CONTENT]:', hasRecommendContent);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

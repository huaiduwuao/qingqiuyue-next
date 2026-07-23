import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

let apiCalls = [];
page.on('request', request => {
  const url = request.url();
  if (url.includes('/api/') && !url.includes('agentmanager')) {
    apiCalls.push(url.replace('https://qingqiuyue.com', '').replace('http://localhost:3000', ''));
  }
});

page.on('response', async response => {
  const url = response.url();
  if (url.includes('/api/content/recommend')) {
    try {
      const data = await response.json();
      const types = [...new Set(data.data?.list?.map(i => i.category || i.contentType) || [])];
      console.log('[RECOMMEND API]:', types.join(','), '- Count:', data.data?.list?.length);
    } catch(e) {}
  }
});

try {
  console.log('Testing: /home/recommend?section=recommend');
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  
  console.log('\n[API CALLS]:');
  apiCalls.forEach(call => console.log(' ', call));
  
  // Check if RecommendVideoFeed is showing correct content
  const content = await page.content();
  const hasCorrectContent = content.includes('各行各业') || content.includes('功夫女足');
  console.log('\n[HAS VIDEO CONTENT]:', hasCorrectContent);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

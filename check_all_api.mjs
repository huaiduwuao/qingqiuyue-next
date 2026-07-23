import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

let apiCalls = [];
page.on('request', request => {
  const url = request.url();
  if (url.includes('/api/') && !url.includes('agentmanager')) {
    apiCalls.push({ method: request.method(), url: url.replace('https://qingqiuyue.com', '').replace('http://localhost:3000', '') });
  }
});

page.on('response', async response => {
  const url = response.url();
  if (url.includes('/api/content/recommend')) {
    try {
      const data = await response.json();
      console.log('[RECOMMEND API RESPONSE]:', JSON.stringify(data.data?.list?.slice(0,2), null, 2));
    } catch(e) {}
  }
});

try {
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  
  console.log('\n[ALL API REQUESTS]:');
  apiCalls.forEach(call => {
    console.log(`  ${call.method} ${call.url}`);
  });
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

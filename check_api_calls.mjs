import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// 监听所有 API 调用
let apiCalls = [];
page.on('request', request => {
  const url = request.url();
  if (url.includes('/api/')) {
    apiCalls.push({ method: request.method(), url: url.replace('https://qingqiuyue.com', '') });
  }
});

page.on('response', async response => {
  const url = response.url();
  if (url.includes('/api/') && response.status() === 200) {
    try {
      const data = await response.json();
      apiCalls.push({ 
        response: true,
        url: url.replace('https://qingqiuyue.com', '').split('?')[0],
        hasList: !!data.data?.list,
        listLength: data.data?.list?.length || 0,
        total: data.data?.total || 0
      });
    } catch(e) {
      apiCalls.push({ response: true, url: url, error: e.message });
    }
  }
});

try {
  console.log('Loading ?tab=home...');
  await page.goto('http://localhost:3000/home/recommend?tab=home', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  console.log('\n[API CALLS]:');
  apiCalls.forEach(call => {
    if (call.response) {
      console.log(`  ✅ ${call.url}: list=${call.listLength}, total=${call.total}`);
    } else {
      console.log(`  📤 ${call.method} ${call.url}`);
    }
  });
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

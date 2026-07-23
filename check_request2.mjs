import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

let apiCalls = [];
page.on('request', request => {
  const url = request.url();
  if (url.includes('/api/content')) {
    apiCalls.push({ url });
  }
});

page.on('response', async response => {
  const url = response.url();
  if (url.includes('/api/content')) {
    try {
      const data = await response.json();
      apiCalls.push({ 
        url, 
        list: data.data?.list?.length || 0, 
        total: data.data?.total || 0 
      });
    } catch(e) {}
  }
});

try {
  console.log('Loading fresh...');
  await page.goto('http://localhost:3000/home/recommend?tab=home', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  console.log('\n[API CALLS]:');
  apiCalls.forEach(call => {
    if (call.list !== undefined) {
      console.log(`  ✅ ${call.url.substring(0, 80)}: list=${call.list}, total=${call.total}`);
    } else {
      console.log(`  📤 ${call.url.substring(0, 80)}`);
    }
  });
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

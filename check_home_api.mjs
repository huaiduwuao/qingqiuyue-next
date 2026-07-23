import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

let apiCalls = [];
page.on('response', async response => {
  const url = response.url();
  if (url.includes('/api/') && response.status() === 200) {
    try {
      const data = await response.json();
      if (data.data?.list) {
        apiCalls.push({
          url: url.replace('https://qingqiuyue.com', ''),
          count: data.data.list.length,
          types: [...new Set(data.data.list.map(i => i.category || i.contentType))],
          firstItem: data.data.list[0]
        });
      }
    } catch(e) {}
  }
});

try {
  console.log('Loading ?tab=home...');
  await page.goto('http://localhost:3000/home/recommend?tab=home', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  console.log('\n[API CALLS]:');
  apiCalls.forEach(call => {
    console.log(`\n  URL: ${call.url}`);
    console.log(`  Count: ${call.count}, Types: ${call.types.join(',')}`);
    console.log(`  First item:`, JSON.stringify(call.firstItem, null, 2));
  });
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

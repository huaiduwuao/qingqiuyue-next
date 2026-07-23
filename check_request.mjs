import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// 监听请求
page.on('request', request => {
  const url = request.url();
  if (url.includes('/api/')) {
    console.log('[REQUEST]:', url);
  }
});

page.on('response', async response => {
  const url = response.url();
  if (url.includes('/api/content')) {
    try {
      const data = await response.json();
      const listLen = data.data?.list?.length || 0;
      const total = data.data?.total || 0;
      const types = data.data?.list ? [...new Set(data.data.list.map(i => i.contentType || i.category))] : [];
      console.log(`[RESPONSE ${response.status()}]: ${url.substring(0, 80)}`);
      console.log(`  list: ${listLen}, total: ${total}, types: ${types.join(',')}`);
    } catch(e) {
      console.log(`[RESPONSE ERROR]: ${url}`);
    }
  }
});

try {
  console.log('Loading ?tab=home...');
  await page.goto('http://localhost:3000/home/recommend?tab=home', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

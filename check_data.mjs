import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// 拦截 API 响应
let apiResponses = [];
page.on('response', async response => {
  if (response.url().includes('/api/') && response.status() === 200) {
    try {
      const data = await response.json();
      if (data.data?.list) {
        apiResponses.push({ url: response.url(), count: data.data.list.length, types: [...new Set(data.data.list.map(i => i.category || i.contentType))] });
      }
    } catch(e) {}
  }
});

try {
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);
  
  console.log('[API RESPONSES]:', JSON.stringify(apiResponses, null, 2));
  
  // 检查数据库中的 Music 数据
  const musicItems = await page.evaluate(() => {
    // 尝试从全局状态获取
    const state = window.__NEXT_DATA__;
    return state ? 'has next data' : 'no next data';
  });
  console.log('[STATE]:', musicItems);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', msg => {
  console.log('[BROWSER CONSOLE]:', msg.text());
});

try {
  console.log('Testing with section=recommend...');
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(5000);
  
  // Force refresh to ensure we get latest code
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  console.log('[URL after reload]:', page.url());
  
  // Check API calls made
  let apiCalls = [];
  page.on('request', request => {
    if (request.url().includes('/api/') && !request.url().includes('agentmanager')) {
      apiCalls.push(request.url().replace('https://qingqiuyue.com', ''));
    }
  });
  
  await page.waitForTimeout(2000);
  console.log('[API CALLS]:', apiCalls);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

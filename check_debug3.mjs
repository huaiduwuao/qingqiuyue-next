import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

let allConsoleLogs = [];
page.on('console', msg => {
  allConsoleLogs.push({ type: msg.type(), text: msg.text() });
});

let apiCalls = [];
page.on('response', async response => {
  const url = response.url();
  if (url.includes('/api/')) {
    try {
      const data = await response.json();
      apiCalls.push({
        url: url.replace('https://qingqiuyue.com', '').split('?')[0],
        types: [...new Set((data.data?.list || []).map(i => i.category || i.contentType))]
      });
    } catch(e) {}
  }
});

try {
  console.log('=== Loading with section=recommend ===');
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(5000);
  
  console.log('\n[ALL CONSOLE LOGS]:');
  allConsoleLogs.forEach(log => {
    if (log.text.includes('HomeRecommend') || log.text.includes('DEBUG') || log.text.includes('merge')) {
      console.log(`  [${log.type}]: ${log.text}`);
    }
  });
  
  console.log('\n[API CALLS]:');
  apiCalls.forEach(call => {
    console.log(`  ${call.url}: ${call.types.join(',')}`);
  });
  
  // Check what's in main
  const mainContent = await page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return 'No main element';
    return main.innerText.substring(0, 500);
  });
  console.log('\n[MAIN CONTENT]:', mainContent.substring(0, 300));
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

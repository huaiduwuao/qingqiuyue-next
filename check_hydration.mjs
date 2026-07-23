import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

let apiCalls = [];
page.on('response', async response => {
  const url = response.url();
  if (url.includes('/api/')) {
    console.log(`[API]: ${url.replace('https://qingqiuyue.com', '')}`);
  }
});

try {
  console.log('Loading: /home/recommend?section=recommend');
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'load', timeout: 20000 });
  
  // Wait for hydration
  console.log('Waiting for hydration...');
  await page.waitForTimeout(5000);
  
  // Try clicking the RecommendVideoFeed if it exists
  const hasRecommendBtn = await page.$('text=推荐') !== null;
  console.log('[Has 导航栏推荐 button]:', hasRecommendBtn);
  
  // Check if RecommendVideoFeed content exists
  const hasVideoFeed = await page.evaluate(() => {
    // Look for specific RecommendVideoFeed markers
    const body = document.body.innerText;
    return body.includes('功夫女足') || body.includes('0:00') || body.includes('Lover');
  });
  console.log('[Has VideoFeed content]:', hasVideoFeed);
  
  // Check page HTML
  const html = await page.content();
  const hasRecommendComponent = html.includes('各行各业') || html.includes('各行各业为功夫');
  console.log('[HTML contains VIDEO content]:', hasRecommendComponent);
  
  // Check current URL params
  const currentUrl = page.url();
  console.log('[Current URL]:', currentUrl);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', msg => {
  if (msg.type() === 'log' || msg.type() === 'error') {
    console.log(`[${msg.type().toUpperCase()}]:`, msg.text());
  }
});

page.on('response', async response => {
  const url = response.url();
  if (url.includes('/api/')) {
    const status = response.status();
    if (status >= 400) {
      console.log(`[HTTP ${status}]:`, url);
    }
  }
});

try {
  // Clear any old state
  await page.goto('about:blank');
  await page.close();
  
  // Fresh browser
  const page2 = await browser.newPage();
  page2.on('console', msg => {
    if (msg.type() === 'log' || msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('DEBUG') || text.includes('recommend') || text.includes('fetch')) {
        console.log(`[CONSOLE]:`, text);
      }
    }
  });
  
  await page2.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'networkidle', timeout: 15000 });
  await page2.waitForTimeout(3000);
  
  console.log('[FINAL URL]:', page2.url());
  
  // Check for RecommendVideoFeed specific content
  const content = await page2.content();
  const hasRecommendComponent = content.includes('0:00') || content.includes('Lover');
  console.log('[HAS RECOMMEND CONTENT]:', hasRecommendComponent);
  
  await page2.close();
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

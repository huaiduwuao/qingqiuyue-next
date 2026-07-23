import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  console.log('Loading /home/recommend?section=recommend...');
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  // Get full HTML
  const html = await page.content();
  console.log('[HTML LENGTH]:', html.length);
  console.log('[HTML PREVIEW]:', html.substring(0, 1000));
  
  // Check if it looks like a React app
  const isReactApp = html.includes('__next') || html.includes('_next/static');
  console.log('[IS REACT APP]:', isReactApp);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

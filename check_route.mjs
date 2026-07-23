import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Capture ALL console messages
page.on('console', msg => {
  console.log(`[${msg.type().toUpperCase()}]:`, msg.text());
});

page.on('pageerror', err => {
  console.log('[PAGE ERROR]:', err.message, '\nStack:', err.stack?.substring(0, 500));
});

try {
  console.log('Loading /home/recommend?section=recommend...');
  const response = await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  // Wait longer for React to fully hydrate
  await page.waitForTimeout(8000);
  
  // Check if the page component actually rendered
  const renderedContent = await page.evaluate(() => {
    // Look for any React root
    const root = document.getElementById('__next') || document.getElementById('root');
    if (!root) return 'No React root found';
    
    // Check if component tree has our content
    const html = root.innerHTML;
    return {
      length: html.length,
      hasMusicContent: html.includes('Lover') || html.includes('Taylor Swift'),
      hasVideoContent: html.includes('各行各业') || html.includes('功夫女足'),
      hasRecommendNav: html.includes('精选') && html.includes('推荐'),
      first500: html.substring(0, 500)
    };
  });
  
  console.log('\n[RENDERED CONTENT]:', JSON.stringify(renderedContent, null, 2));
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

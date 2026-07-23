import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  // Inject global variable BEFORE page load
  await page.addInitScript(() => {
    window.__DEBUG_TAB_VALUE__ = 'NOT_SET';
    window.__DEBUG_SEARCH_PARAMS__ = 'NOT_SET';
    const originalLog = console.log;
    console.log = (...args) => {
      const msg = args.join(' ');
      if (msg.includes('HomeRecommendPage') || msg.includes('tabFromUrl')) {
        window.__DEBUG_SEARCH_PARAMS__ = msg;
      }
      originalLog.apply(console, args);
    };
  });
  
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  // Check global values
  const debugValues = await page.evaluate(() => ({
    tabValue: window.__DEBUG_TAB_VALUE__,
    searchParamsLog: window.__DEBUG_SEARCH_PARAMS__
  }));
  
  console.log('[DEBUG VALUES]:', debugValues);
  
  // Also try to inject code now
  await page.evaluate(() => {
    window.__TEST_VALUE__ = 'Hello from page';
  });
  
  const testValue = await page.evaluate(() => window.__TEST_VALUE__);
  console.log('[TEST VALUE]:', testValue);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

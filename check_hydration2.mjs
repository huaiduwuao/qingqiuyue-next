import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  // Try to execute code in the page context to see what's happening
  const hydrationInfo = await page.evaluate(() => {
    // Try to find React fiber
    const rootEl = document.querySelector('main')?.parentElement;
    if (!rootEl) return 'No root found';
    
    // Find React internal key
    const reactKeys = Object.keys(rootEl).filter(k => k.startsWith('__react'));
    const fiberKey = reactKeys[0];
    
    if (!fiberKey) {
      // Try finding any React fiber on the page
      const allKeys = new Set();
      const checkElement = (el) => {
        Object.keys(el).forEach(k => {
          if (k.startsWith('__react')) allKeys.add(k);
        });
        el.children && Array.from(el.children).forEach(checkElement);
      };
      checkElement(document.body);
      return { message: 'No fiber on main parent', foundKeys: [...allKeys] };
    }
    
    const fiber = rootEl[fiberKey];
    return {
      foundFiber: true,
      hasReturn: !!fiber?.return,
      type: fiber?.elementType?.name || typeof fiber?.elementType,
      memoizedProps: fiber?.memoizedProps ? Object.keys(fiber.memoizedProps) : []
    };
  });
  
  console.log('[HYDRATION INFO]:', JSON.stringify(hydrationInfo, null, 2));
  
  // Try a different approach - inject a script to modify the component
  await page.evaluate(() => {
    // Override console.log to capture component logs
    const originalLog = console.log;
    window.__capturedLogs = [];
    console.log = (...args) => {
      window.__capturedLogs.push(args.join(' '));
      originalLog.apply(console, args);
    };
  });
  
  // Reload and check
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  
  const capturedLogs = await page.evaluate(() => window.__capturedLogs || []);
  console.log('\n[CAPTURED LOGS]:', capturedLogs.filter(l => l.includes('HomeRecommendPage') || l.includes('tabFromUrl')));
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  // Find React root element
  const rootInfo = await page.evaluate(() => {
    // Try different selectors
    const selectors = ['#__next', '#root', '[data-reactroot]', '[id]'];
    const results = [];
    
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        results.push({
          selector: sel,
          id: el.id,
          className: el.className?.toString().substring(0, 50),
          childCount: el.children.length,
          hasChildren: el.children.length > 0
        });
      }
    }
    
    // Also check for any element with 'mui-' class (MUI components)
    const muiElements = document.querySelectorAll('[class*="mui-"]');
    results.push({ muiCount: muiElements.length });
    
    return results;
  });
  
  console.log('[REACT ROOT INFO]:', JSON.stringify(rootInfo, null, 2));
  
  // Check what's actually in the main content area
  const mainContent = await page.evaluate(() => {
    // Find the main element or the largest div
    const main = document.querySelector('main') || document.querySelector('div[style*="display: flex"]');
    if (!main) return 'No main found';
    
    return {
      tag: main.tagName,
      className: main.className?.toString().substring(0, 100),
      textContent: main.textContent?.substring(0, 200)
    };
  });
  
  console.log('[MAIN CONTENT]:', mainContent);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

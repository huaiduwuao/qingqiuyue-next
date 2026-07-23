import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  console.log('Loading page...');
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  // Wait for React to fully hydrate
  console.log('Waiting for hydration...');
  await page.waitForFunction(() => {
    return document.body.style.display !== 'none' || document.querySelector('[class*="MuiBox"]');
  }, { timeout: 15000 }).catch(() => console.log('Timeout waiting for hydration'));
  
  await page.waitForTimeout(5000);
  
  // Get body display style
  const bodyStyle = await page.evaluate(() => window.getComputedStyle(document.body).display);
  console.log('[BODY DISPLAY]:', bodyStyle);
  
  // Check for green banner
  const allStyles = await page.evaluate(() => {
    const elements = document.querySelectorAll('*');
    const results = [];
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') {
        results.push({
          tag: el.tagName,
          bg: style.backgroundColor,
          text: el.textContent?.substring(0, 50)
        });
      }
    }
    return results.slice(0, 10);
  });
  
  console.log('[COLORED ELEMENTS]:', JSON.stringify(allStyles, null, 2));
  
  // Get page text
  const pageText = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('\n[PAGE TEXT]:', pageText);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

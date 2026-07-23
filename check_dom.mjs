import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  
  // Get DOM structure
  const domInfo = await page.evaluate(() => {
    const root = document.getElementById('__next') || document.getElementById('root') || document.documentElement;
    return {
      hasNextRoot: !!document.getElementById('__next'),
      hasRoot: !!document.getElementById('root'),
      childCount: root.children.length,
      bodyChildCount: document.body.children.length,
      mainElements: document.querySelectorAll('main').length,
      bodyText: document.body.innerText.substring(0, 200)
    };
  });
  
  console.log('[DOM INFO]:', JSON.stringify(domInfo, null, 2));
  
  // Check all elements
  const structure = await page.evaluate(() => {
    const result = [];
    function walk(el, depth) {
      if (depth > 3) return;
      const id = el.id;
      const className = el.className?.toString().substring(0, 50);
      if (id || className) {
        result.push({ tag: el.tagName, id, class: className, depth });
      }
      for (const child of el.children) {
        walk(child, depth + 1);
      }
    }
    walk(document.body, 0);
    return result.slice(0, 30);
  });
  
  console.log('[DOM STRUCTURE]:', JSON.stringify(structure, null, 2));
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  
  // Wait for React to hydrate and check internal state
  const debugInfo = await page.evaluate(async () => {
    // Try to find React fiber for the component
    const root = document.getElementById('__next');
    if (!root) return { error: 'No __next root found' };
    
    // Get React internal key
    const keys = Object.keys(root).filter(k => k.startsWith('__react'));
    const reactKey = keys[0];
    
    if (!reactKey) return { error: 'No React fiber found' };
    
    const fiber = root[reactKey];
    if (!fiber) return { error: 'No fiber' };
    
    // Try to get the state - this is hacky but let's try
    // React 18 uses different structure
    let state = null;
    let memoizedProps = null;
    
    // Walk up the fiber tree to find HomeRecommendPage
    let current = fiber;
    let depth = 0;
    while (current && depth < 20) {
      const type = current.elementType?.name || current.elementType;
      if (type === 'HomeRecommendPage' || type === 'function') {
        memoizedProps = current.memoizedProps;
        // Try to get stateNode (for hooks)
        const stateNode = current.stateNode;
        if (stateNode) {
          state = {
            hasRouter: !!stateNode.router,
            searchParams: stateNode.searchParams?.toString?.() || stateNode.searchParams
          };
        }
        break;
      }
      current = current.return;
      depth++;
    }
    
    return {
      foundComponent: depth < 20,
      depth,
      type: current?.elementType?.name || current?.elementType,
      memoizedProps: memoizedProps ? { 
        searchParams: memoizedProps.searchParams?.toString?.() 
      } : null,
      state
    };
  });
  
  console.log('[REACT DEBUG]:', JSON.stringify(debugInfo, null, 2));
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

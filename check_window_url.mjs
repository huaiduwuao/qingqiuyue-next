import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  // Inject JavaScript to read and display searchParams
  const urlInfo = await page.evaluate(() => {
    // Get URL info
    const url = new URL(window.location.href);
    const searchParams = url.searchParams;
    
    // Try to read Next.js router state
    const nextData = window.__NEXT_DATA__?.props?.pageProps || {};
    
    // Check if useSearchParams hook returns correct value
    // by checking the URL that was actually navigated to
    return {
      locationHref: window.location.href,
      locationSearch: window.location.search,
      urlSearchParams: searchParams.toString(),
      tab: searchParams.get('tab'),
      section: searchParams.get('section'),
      pathname: window.location.pathname,
      hasNextData: !!window.__NEXT_DATA__
    };
  });
  
  console.log('[URL INFO]:', JSON.stringify(urlInfo, null, 2));
  
  // Now check which component is rendering
  const componentInfo = await page.evaluate(() => {
    const body = document.body.innerText;
    return {
      hasCategoryNav: body.includes('多分类聚合') && body.includes('小说') && body.includes('漫画'),
      hasRecommendVideoFeed: body.includes('各行各业') || body.includes('功夫女足'),
      hasMusicFeed: body.includes('Lover') || body.includes('Taylor Swift'),
      hasZeroTime: body.includes('0:00'),
      firstLine: body.split('\n').filter(l => l.trim())[15] || 'N/A'
    };
  });
  
  console.log('\n[COMPONENT INFO]:', componentInfo);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

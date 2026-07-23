import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('DEBUG') || text.includes('tabFromUrl')) {
    console.log('[CONSOLE]:', text);
  }
});

try {
  console.log('Loading with section=recommend...');
  await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  
  // Check if debug box is visible
  const hasDebugBox = await page.$('text=DEBUG: tabFromUrl') !== null;
  console.log('\n[DEBUG BOX VISIBLE]:', hasDebugBox);
  
  // Get debug box text
  if (hasDebugBox) {
    const debugText = await page.$eval('text=DEBUG', el => el.textContent).catch(() => 'N/A');
    console.log('[DEBUG TEXT]:', debugText);
  }
  
  // Check content
  const content = await page.evaluate(() => {
    const body = document.body.innerText;
    return {
      hasVideo: body.includes('各行各业') || body.includes('功夫女足'),
      hasMusic: body.includes('Lover'),
      hasDebugWarning: body.includes('DEBUG: tabFromUrl')
    };
  });
  console.log('\n[CONTENT]:', content);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

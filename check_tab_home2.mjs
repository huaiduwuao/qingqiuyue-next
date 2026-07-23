import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  console.log('Loading ?tab=home...');
  const response = await page.goto('http://localhost:3000/home/recommend?tab=home', { waitUntil: 'networkidle', timeout: 30000 });
  console.log('[STATUS]:', response.status());
  
  await page.waitForTimeout(5000);
  
  // Check content
  const content = await page.evaluate(() => {
    const body = document.body.innerText;
    const lines = body.split('\n').filter(l => l.trim());
    return {
      hasNovel: body.includes('小说') && body.includes('多分类'),
      hasMusic: body.includes('Lover') || body.includes('Taylor'),
      first20: lines.slice(0, 20)
    };
  });
  
  console.log('\n[CONTENT]:');
  console.log('hasNovel:', content.hasNovel);
  console.log('hasMusic:', content.hasMusic);
  console.log('Lines:', content.first20);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

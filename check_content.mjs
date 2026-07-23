import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  console.log('Loading ?tab=home...');
  await page.goto('http://localhost:3000/home/recommend?tab=home', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  // Get all content
  const content = await page.evaluate(() => {
    const body = document.body;
    const text = body.innerText;
    const lines = text.split('\n').filter(l => l.trim());
    return {
      lines: lines,
      lineCount: lines.length,
      hasNovel: text.includes('小说') && text.includes('多分类'),
      hasMusic: text.includes('Lover'),
      hasEmpty: text.includes('内容为空') || text.includes('暂无'),
    };
  });
  
  console.log('[CONTENT]:');
  console.log('Line count:', content.lineCount);
  console.log('hasNovel:', content.hasNovel);
  console.log('hasMusic:', content.hasMusic);
  console.log('hasEmpty:', content.hasEmpty);
  console.log('\n[ALL LINES]:');
  content.lines.forEach((line, i) => {
    if (line && i > 40) console.log(`${i}: ${line}`);
  });
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

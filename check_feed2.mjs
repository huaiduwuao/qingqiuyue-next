import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('FeedPanel') || text.includes('error') || text.includes('Error')) {
    console.log('[CONSOLE]:', text);
  }
});

try {
  console.log('Loading ?tab=home...');
  await page.goto('http://localhost:3000/home/recommend?tab=home', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  // Check FeedPanel content
  const content = await page.evaluate(() => {
    const body = document.body.innerText;
    const lines = body.split('\n').filter(l => l.trim());
    return {
      allLines: lines,
      hasContent: lines.length > 30,  // More than just navigation
    };
  });
  
  console.log('\n[ALL LINES]:');
  content.allLines.forEach((line, i) => {
    if (line) console.log(`${i}: ${line}`);
  });
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

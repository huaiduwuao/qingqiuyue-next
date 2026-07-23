import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('response', async response => {
  const url = response.url();
  if (url.includes('/recommend/feed')) {
    try {
      const data = await response.json();
      console.log('[API DATA]:', JSON.stringify(data.data?.list?.slice(0,2), null, 2));
    } catch(e) {
      console.log('[ERROR]:', e.message);
    }
  }
});

try {
  console.log('Loading ?tab=home...');
  await page.goto('http://localhost:3000/home/recommend?tab=home', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  const content = await page.evaluate(() => {
    const text = document.body.innerText;
    const lines = text.split('\n').filter(l => l.trim());
    return lines.slice(40, 60);
  });
  
  console.log('\n[PAGE CONTENT]:');
  content.forEach(line => console.log(' ', line));
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

let apiCalls = [];
page.on('response', async response => {
  const url = response.url();
  if (url.includes('/api/') && response.status() === 200) {
    try {
      const data = await response.json();
      if (data.data?.list) {
        apiCalls.push({
          url: url.replace('https://qingqiuyue.com', '').split('?')[0],
          count: data.data.list.length,
          types: [...new Set(data.data.list.map(i => i.contentType || i.category))],
          firstCover: data.data.list[0]?.coverUrl || data.data.list[0]?.cover || 'NO COVER'
        });
      }
    } catch(e) {}
  }
});

try {
  console.log('Loading ?tab=home...');
  await page.goto('http://localhost:3000/home/recommend?tab=home', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  console.log('\n[API CALLS]:');
  apiCalls.forEach(call => {
    console.log(`  ${call.url}: ${call.types.join(',')} (${call.count})`);
    console.log(`    First cover: ${call.firstCover?.substring(0, 60)}`);
  });
  
  // Check images
  const images = await page.$$eval('img', imgs => imgs.slice(0, 5).map(img => ({
    loaded: img.complete && img.naturalWidth > 0,
    src: img.src.substring(0, 60)
  })));
  
  console.log('\n[IMAGES]:');
  images.forEach(img => console.log(`  ${img.loaded ? '✅' : '❌'} ${img.src}`));
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

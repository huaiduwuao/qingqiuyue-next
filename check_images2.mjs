import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  console.log('Loading ?tab=home...');
  await page.goto('http://localhost:3000/home/recommend?tab=home', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  // Check images
  const images = await page.$$eval('img', imgs => imgs.slice(0, 10).map(img => ({
    src: img.src,
    loaded: img.complete && img.naturalWidth > 0,
    alt: img.alt?.substring(0, 30) || ''
  })));
  
  console.log('\n[IMAGES]:');
  images.forEach(img => {
    console.log(`  ${img.loaded ? '✅' : '❌'} ${img.src.substring(0, 70)}`);
    if (img.alt) console.log(`     alt: ${img.alt}`);
  });
  
  // Check API calls
  const apiInfo = await page.evaluate(() => {
    const body = document.body.innerText;
    return {
      hasNovel: body.includes('小说') && body.includes('多分类'),
      hasMusic: body.includes('Lover') || body.includes('Taylor'),
      hasImages: body.includes('图片') || body.includes('cover'),
      firstLine: body.split('\n').filter(l => l.trim())[20] || 'N/A'
    };
  });
  
  console.log('\n[PAGE INFO]:', apiInfo);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

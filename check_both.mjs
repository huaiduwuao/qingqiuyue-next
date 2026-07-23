import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

async function testUrl(url, expected) {
  const response = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  const content = await page.evaluate(() => document.body.innerText);
  const hasVideo = content.includes('各行各业') || content.includes('功夫女足');
  const hasMusic = content.includes('Lover');
  const hasNovel = content.includes('小说') && content.includes('多分类聚合');
  
  const result = expected === 'video' ? hasVideo && !hasMusic : hasNovel && !hasVideo;
  console.log(`${result ? '✅' : '❌'} ${url}: ${expected === 'video' ? 'VIDEO' : 'NOVEL'}`);
  return result;
}

try {
  console.log('Testing URL parameter handling:\n');
  const r1 = await testUrl('http://localhost:3000/home/recommend?section=recommend', 'video');
  const r2 = await testUrl('http://localhost:3000/home/recommend?tab=recommend', 'video');
  const r3 = await testUrl('http://localhost:3000/home/recommend?tab=home', 'novel');
  
  if (r1 && r2 && r3) {
    console.log('\n✅ 所有测试通过！');
  } else {
    console.log('\n❌ 部分测试失败');
  }
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

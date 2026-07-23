import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  console.log('Loading ?tab=home...');
  await page.goto('http://localhost:3000/home/recommend?tab=home', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  // Get full content
  const content = await page.evaluate(() => {
    const body = document.body.innerHTML;
    return {
      htmlLength: body.length,
      hasNovel: body.includes('小说') && body.includes('多分类'),
      hasMusic: body.includes('Lover'),
      hasContentItems: body.includes('更新') || body.includes('分钟') || body.includes('播放'),
      hasEmptyState: body.includes('暂无内容') || body.includes('加载中'),
      first500: body.substring(0, 1000)
    };
  });
  
  console.log('[CONTENT]:');
  console.log('HTML length:', content.htmlLength);
  console.log('hasNovel:', content.hasNovel);
  console.log('hasMusic:', content.hasMusic);
  console.log('hasContentItems:', content.hasContentItems);
  console.log('hasEmptyState:', content.hasEmptyState);
  console.log('\n[HTML PREVIEW]:');
  console.log(content.first500);
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

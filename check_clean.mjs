import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  console.log('=== Test: ?section=recommend ===');
  const response = await page.goto('http://localhost:3000/home/recommend?section=recommend', { waitUntil: 'load', timeout: 30000 });
  console.log('[STATUS]:', response.status());
  
  await page.waitForTimeout(5000);
  
  const content = await page.evaluate(() => {
    const body = document.body.innerText;
    return {
      hasVideo: body.includes('各行各业') || body.includes('功夫女足'),
      hasMusic: body.includes('Lover'),
      hasDebug: body.includes('DEBUG:'),
      hasGreen: body.includes('rgb(0, 255, 0)') || body.includes('#00ff00')
    };
  });
  
  console.log('[RESULT]:', content);
  
  if (content.hasVideo && !content.hasMusic && !content.hasDebug) {
    console.log('\n✅ 修复成功！VIDEO 内容正确显示');
  } else {
    console.log('\n❌ 仍有问题');
  }
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

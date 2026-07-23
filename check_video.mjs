import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('response', async response => {
  const url = response.url();
  if (url.includes('/recommend/feed')) {
    try {
      const data = await response.json();
      const types = [...new Set((data.data?.list || []).map(i => i.contentType))];
      console.log('[TYPES]:', types);
      if (data.data?.list?.[0]) {
        console.log('[FIRST]:', data.data.list[0].title, '-', data.data.list[0].contentType);
      }
    } catch(e) {}
  }
});

try {
  console.log('Loading ?tab=home...');
  await page.goto('http://localhost:3000/home/recommend?tab=home', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  const content = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasItems: text.includes('各行各业') || text.includes('功夫女足'),
      hasMusic: text.includes('Lover') || text.includes('Taylor'),
      hasEmpty: text.includes('内容为空') || text.includes('暂无'),
    };
  });
  
  console.log('\n[RESULT]:', content);
  
  if (content.hasItems && !content.hasMusic) {
    console.log('\n✅ 修复成功！显示 VIDEO 内容');
  }
  
} catch (e) {
  console.error('[ERROR]:', e.message);
}

await browser.close();

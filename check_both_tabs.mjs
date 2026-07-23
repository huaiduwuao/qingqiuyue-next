import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });

async function testTab(tab) {
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('http://localhost:3000/home/recommend?tab=' + tab, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  const content = await page.evaluate(() => document.body.innerText);
  await context.close();
  
  return {
    hasVideo: content.includes('各行各业') || content.includes('功夫女足'),
    hasMusic: content.includes('Lover') || content.includes('Taylor Swift'),
    hasEmpty: content.includes('内容为空') || content.includes('暂无'),
    lineCount: content.split('\n').filter(l => l.trim()).length
  };
}

async function main() {
  console.log('Testing tab=home...');
  const home = await testTab('home');
  console.log('  home:', home);
  
  console.log('\nTesting tab=recommend...');
  const recommend = await testTab('recommend');
  console.log('  recommend:', recommend);
  
  console.log('\nTesting tab=novel...');
  const novel = await testTab('novel');
  console.log('  novel:', novel);
  
  // Summary
  console.log('\n=== SUMMARY ===');
  if (home.hasVideo && !home.hasMusic) {
    console.log('✅ tab=home: 显示 VIDEO 内容');
  } else {
    console.log('❌ tab=home: 未正确显示');
  }
  
  if (recommend.hasVideo && !recommend.hasMusic) {
    console.log('✅ tab=recommend: 显示 VIDEO 内容');
  } else {
    console.log('❌ tab=recommend: 未正确显示');
  }
  
  await browser.close();
}

main().catch(console.error);

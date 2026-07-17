// 临时调试脚本：检查 home/recommend?tab=friend 和 tab=follow 页面
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 监听网络请求
  const apiResponses = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/content/home/')) {
      try {
        const body = await response.text();
        apiResponses.push({ url, body: body.substring(0, 500) });
      } catch (e) {
        apiResponses.push({ url, error: e.message });
      }
    }
  });

  // 监听控制台消息
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('[HomeRecommend]') || msg.text().includes('[FeedPanel]')) {
      console.log(`[Console ${msg.type()}] ${msg.text()}`);
    }
  });

  console.log('=== 检查 tab=friend ===');
  try {
    await page.goto('http://localhost:3000/home/recommend?tab=friend', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // 检查页面内容
    const hasContent = await page.locator('text=朋友圈').count() > 0;
    console.log(`页面有"朋友圈"文字: ${hasContent}`);

    const hasEmptyHint = await page.locator('text=还没有互相关注的朋友').count() > 0;
    const hasLoading = await page.locator('text=加载中').count() > 0;
    console.log(`显示"还没有互相关注的朋友": ${hasEmptyHint}`);
    console.log(`显示"加载中": ${hasLoading}`);

  } catch (e) {
    console.log(`tab=friend 加载错误: ${e.message}`);
  }

  // 打印 API 响应
  console.log('\n=== Friend API 响应 ===');
  for (const r of apiResponses) {
    console.log(`URL: ${r.url}`);
    console.log(`Body: ${r.body || r.error}`);
    console.log('---');
  }

  // 清空记录
  apiResponses.length = 0;

  console.log('\n=== 检查 tab=follow ===');
  try {
    await page.goto('http://localhost:3000/home/recommend?tab=follow', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const hasContent = await page.locator('text=关注').count() > 0;
    console.log(`页面有"关注"文字: ${hasContent}`);

    const hasEmptyHint = await page.locator('text=关注的人还没发作品').count() > 0;
    const hasLoading = await page.locator('text=加载中').count() > 0;
    console.log(`显示"关注的人还没发作品": ${hasEmptyHint}`);
    console.log(`显示"加载中": ${hasLoading}`);

  } catch (e) {
    console.log(`tab=follow 加载错误: ${e.message}`);
  }

  console.log('\n=== Follow API 响应 ===');
  for (const r of apiResponses) {
    console.log(`URL: ${r.url}`);
    console.log(`Body: ${r.body || r.error}`);
    console.log('---');
  }

  await browser.close();
}

main().catch(console.error);

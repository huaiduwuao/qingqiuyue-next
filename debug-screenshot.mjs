// 截图调试脚本
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  console.log('=== tab=friend 截图 ===');
  await page.goto('http://localhost:3000/home/recommend?tab=friend', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshot-friend.png', fullPage: false });
  console.log('已保存 screenshot-friend.png');

  // 检查关键元素
  const cards = await page.locator('[class*="MuiBox"]').count();
  console.log(`MuiBox 元素数量: ${cards}`);

  // 检查是否有任何内容卡片
  const feedItems = await page.evaluate(() => {
    const items = document.querySelectorAll('[class*="MuiCard"]');
    return items.length;
  });
  console.log(`卡片元素数量: ${feedItems}`);

  // 检查 feed 数据
  const feedList = await page.evaluate(() => {
    // 尝试从 React Query 缓存中获取
    return window.__feedDebug || 'no debug info';
  });
  console.log(`Feed 调试信息: ${feedList}`);

  // 检查页面可见文本
  const textContent = await page.evaluate(() => {
    return document.body.innerText.substring(0, 500);
  });
  console.log(`页面文本内容:\n${textContent}`);

  // 检查网络请求中的具体数据
  console.log('\n=== 检查 API 返回的具体数据 ===');

  const feedResponse = await page.evaluate(async () => {
    const resp = await fetch('/api/content/home/feed?tab=friend&page=1&size=12');
    const data = await resp.json();
    return JSON.stringify(data, null, 2).substring(0, 2000);
  });
  console.log(`Feed API 响应:\n${feedResponse}`);

  await browser.close();
  console.log('\n截图已保存');
}

main().catch(console.error);

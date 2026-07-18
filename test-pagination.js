// 快速测试脚本
import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('1. 打开首页...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const initialCards = await page.locator('.my-masonry-grid_column > div').count();
    console.log(`初始卡片数量: ${initialCards}`);

    // 检查 sentinel 元素
    const sentinel = page.locator('div[style*="height: 20px"]').first();
    const sentinelCount = await page.locator('div[style*="height: 20px"]').count();
    console.log(`Sentinel 元素数量: ${sentinelCount}`);

    if (sentinelCount > 0) {
      const sentinelBox = await sentinel.boundingBox();
      console.log(`Sentinel 位置:`, sentinelBox);
    }

    // 监听控制台日志
    const logs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('IntersectionObserver') || text.includes('Loading')) {
        logs.push(text);
      }
    });

    // 多次滚动到页面最底部
    console.log('\n2. 滚动到页面底部...');
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);

      const cards = await page.locator('.my-masonry-grid_column > div').count();
      const scrollY = await page.evaluate(() => window.scrollY);
      const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      console.log(`滚动 ${i + 1}: 位置=${scrollY}/${scrollHeight}, 卡片=${cards}`);
    }

    if (logs.length > 0) {
      console.log('\n控制台日志:');
      logs.forEach(log => console.log('  ', log));
    }

    const finalCards = await page.locator('.my-masonry-grid_column > div').count();
    console.log(`\n最终卡片数量: ${finalCards}`);

    if (finalCards > initialCards) {
      console.log('✅ 测试通过：加载更多正常工作');
    } else {
      console.log('⚠️ 卡片数量未增加');
    }

  } catch (error) {
    console.error('测试出错:', error.message);
  } finally {
    await browser.close();
  }
}

test();

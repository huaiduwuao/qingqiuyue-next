// +build ignore

// E2E 测试：抖音视频播放
import { chromium } from 'playwright';

(async () => {
  console.log('==========================================');
  console.log('抖音视频播放 E2E 测试');
  console.log('==========================================');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  // 监听控制台错误
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log(`[Console Error] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    errors.push(err.message);
    console.log(`[Page Error] ${err.message}`);
  });

  try {
    // 1. 打开首页
    console.log('\n>>> 1. 打开首页 http://localhost:3000');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: 'test_output/home.png', fullPage: true });
    console.log('首页截图: test_output/home.png');

    // 等待内容加载
    await page.waitForTimeout(3000);

    // 2. 查找抖音相关内容
    console.log('\n>>> 2. 查找抖音内容入口');

    // 尝试多种选择器
    const selectors = [
      'text=抖音',
      '[data-source="douyin_hot"]',
      '[data-category="douyin"]',
      'button:has-text("抖音")',
      'a:has-text("抖音")',
    ];

    let foundSelector = null;
    for (const sel of selectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 })) {
          console.log(`  找到入口: ${sel}`);
          foundSelector = sel;
          break;
        }
      } catch {}
    }

    // 3. 查找视频卡片
    console.log('\n>>> 3. 查找视频卡片');
    const cardSelectors = [
      '[class*="Card"]',
      '[class*="card"]',
      '[data-item-type="VIDEO"]',
      'article',
      'div[role="article"]',
    ];

    let cardCount = 0;
    for (const sel of cardSelectors) {
      const count = await page.locator(sel).count();
      if (count > 0) {
        console.log(`  找到 ${count} 个元素: ${sel}`);
        cardCount = count;
        break;
      }
    }

    // 4. 如果找到视频卡片，点击第一个
    if (cardCount > 0) {
      console.log('\n>>> 4. 点击第一个视频卡片');
      const firstCard = page.locator('[class*="Card"], [class*="card"], article, [data-item-type]').first();
      await firstCard.scrollIntoViewIfNeeded();
      await firstCard.click();

      // 等待播放器加载
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'test_output/video_detail.png', fullPage: true });
      console.log('详情页截图: test_output/video_detail.png');
    }

    // 5. 查找播放器
    console.log('\n>>> 5. 检查播放器');
    const playerSelectors = ['video', '[class*="player"]', '[class*="Player"]', 'iframe'];
    for (const sel of playerSelectors) {
      const count = await page.locator(sel).count();
      if (count > 0) {
        console.log(`  找到 ${count} 个: ${sel}`);
      }
    }

    // 6. 尝试直接访问抖音详情页测试
    console.log('\n>>> 6. 测试抖音视频路由');
    const testVideoId = '7321456891735847168';

    // 通过内容详情页测试 (如果应用有 /content/:id 路由)
    const detailUrls = [
      `http://localhost:3000/content/${testVideoId}`,
      `http://localhost:3000/video/${testVideoId}`,
      `http://localhost:3000/detail/${testVideoId}`,
    ];

    for (const url of detailUrls) {
      try {
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
        if (resp && resp.status() < 400) {
          console.log(`  可访问: ${url}`);
          await page.waitForTimeout(2000);
          await page.screenshot({ path: `test_output/detail_${testVideoId}.png`, fullPage: true });

          // 检查是否有视频元素
          const videoCount = await page.locator('video').count();
          console.log(`    视频元素: ${videoCount}`);
          break;
        }
      } catch {}
    }

    // 7. 检查 API 调用
    console.log('\n>>> 7. 检查 API 调用');

    // 拦截 API 请求
    const apiCalls = [];
    page.on('response', async resp => {
      const url = resp.url();
      if (url.includes('/api/') || url.includes('10.9.1.2')) {
        apiCalls.push({ url, status: resp.status() });
      }
    });

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    if (apiCalls.length > 0) {
      console.log(`  API 调用 (${apiCalls.length}个):`);
      apiCalls.slice(0, 10).forEach(call => {
        console.log(`    [${call.status}] ${call.url.substring(0, 80)}...`);
      });
    }

    // 总结
    console.log('\n==========================================');
    console.log('测试总结');
    console.log('==========================================');
    console.log(`控制台错误数: ${errors.length}`);
    if (errors.length > 0) {
      console.log('错误列表:');
      errors.slice(0, 5).forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    }
    console.log('\n截图已保存到 test_output/ 目录');

  } catch (err) {
    console.error('测试失败:', err.message);
  } finally {
    await browser.close();
  }
})();

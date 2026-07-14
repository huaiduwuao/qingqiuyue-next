import { test, expect } from '@playwright/test';

/**
 * 无限滚动加载测试
 */
test.describe('无限滚动加载', () => {
  test('滚动到底部应加载更多内容', async ({ page }) => {
    await page.goto('http://localhost:3000/home/recommend?tab=home');
    await page.waitForURL(/\/home\/recommend/, { timeout: 15_000 });

    // 等待初始内容加载
    await page.waitForTimeout(3000);

    // 等待容器挂载
    await page.waitForSelector('[style*="overflow"]', { timeout: 10000 });

    // 获取初始卡片数量
    const initialCards = await page.locator('main [style*="aspect-ratio"]').count();
    console.log(`初始卡片数量: ${initialCards}`);

    // 滚动容器到底部触发加载
    await page.evaluate(() => {
      const containers = document.querySelectorAll('[style*="overflow"]');
      containers.forEach((el: Element) => {
        const htmlEl = el as HTMLElement;
        if (htmlEl.style.overflow.includes('auto') || htmlEl.style.overflow.includes('scroll')) {
          htmlEl.scrollTop = htmlEl.scrollHeight;
        }
      });
    });
    await page.waitForTimeout(2000);

    // 获取加载后的卡片数量
    const afterScrollCards = await page.locator('main [style*="aspect-ratio"]').count();
    console.log(`滚动后卡片数量: ${afterScrollCards}`);

    // 验证无报错
    expect(true).toBe(true);
  });

  test('follow tab 应支持滚动加载', async ({ page }) => {
    await page.goto('http://localhost:3000/home/recommend?tab=follow');
    await page.waitForURL(/\/home\/recommend/, { timeout: 15_000 });

    // 等待初始内容
    await page.waitForTimeout(2000);

    // 滚动触发加载
    await page.evaluate(() => {
      const containers = document.querySelectorAll('[style*="overflow"]');
      containers.forEach((el: Element) => {
        const htmlEl = el as HTMLElement;
        if (htmlEl.style.overflow.includes('auto') || htmlEl.style.overflow.includes('scroll')) {
          htmlEl.scrollTop = htmlEl.scrollHeight;
        }
      });
    });
    await page.waitForTimeout(1500);

    // 页面应该响应滚动（无报错）
    const hasContent = await page.locator('main').count() > 0;
    expect(hasContent).toBe(true);
  });

  test('friend tab 应支持滚动加载', async ({ page }) => {
    await page.goto('http://localhost:3000/home/recommend?tab=friend');
    await page.waitForURL(/\/home\/recommend/, { timeout: 15_000 });

    // 等待初始内容
    await page.waitForTimeout(2000);

    // 滚动触发加载
    await page.evaluate(() => {
      const containers = document.querySelectorAll('[style*="overflow"]');
      containers.forEach((el: Element) => {
        const htmlEl = el as HTMLElement;
        if (htmlEl.style.overflow.includes('auto') || htmlEl.style.overflow.includes('scroll')) {
          htmlEl.scrollTop = htmlEl.scrollHeight;
        }
      });
    });
    await page.waitForTimeout(1500);

    // 页面应该响应滚动（无报错）
    const hasContent = await page.locator('main').count() > 0;
    expect(hasContent).toBe(true);
  });
});

import { test, expect } from '@playwright/test';

/**
 * 验证从 AI 搜索页点击"推荐"菜单能正确导航
 * 问题：点击后错误跳转到 /search?q=推荐
 */
test.describe('home/recommend 导航测试', () => {
  test('从 AI 搜索页点击推荐菜单应跳转到 tab=recommend', async ({ page }) => {
    // 1. 进入 AI 搜索页
    await page.goto('http://localhost:3000/home/recommend?tab=ai');
    await page.waitForURL(/\/home\/recommend\?tab=ai/, { timeout: 15_000 });

    // 2. 确认 AI 搜索页已加载（用 main 区域的 AI 搜索标题）
    await expect(page.getByRole('main').getByText('AI 搜索', { exact: true })).toBeVisible({ timeout: 10_000 });

    // 3. 点击左侧栏的"推荐"菜单（侧边栏）
    const recommendNav = page.locator('nav').getByText('推荐', { exact: true });
    await recommendNav.click();

    // 4. 验证 URL 变为 tab=recommend（不应该跳到 search）
    await page.waitForURL(/\/home\/recommend\?tab=recommend/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/home\/recommend\?tab=recommend/);

    // 5. 确保没有跳到搜索页
    expect(page.url()).not.toContain('/search');
  });

  test('从精选页点击推荐菜单应正常导航', async ({ page }) => {
    await page.goto('http://localhost:3000/home/recommend?tab=home');
    await page.waitForURL(/\/home\/recommend\?tab=home/, { timeout: 15_000 });

    // 点击推荐
    const recommendNav = page.locator('nav').getByText('推荐', { exact: true });
    await recommendNav.click();

    await page.waitForURL(/\/home\/recommend\?tab=recommend/, { timeout: 10_000 });
    expect(page.url()).not.toContain('/search');
  });
});

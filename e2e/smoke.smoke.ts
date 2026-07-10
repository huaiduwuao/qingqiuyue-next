import { test, expect } from '@playwright/test';

/**
 * 无登录冒烟：仅验证 Playwright 能拉起 next dev、chromium 能打开页面并真实渲染。
 * 不碰业务、不需账密。业务用例见 reward/*.spec.ts（需 E2E_OWNER_NAME/PASSWORD）。
 */
test('smoke · next dev + chromium + 登录页可渲染', async ({ page }) => {
  await page.goto('/user/login');
  await expect(page.getByText('清秋月', { exact: true })).toBeVisible({ timeout: 30_000 }); // 登录页品牌字（精确匹配，避开页脚「清秋月 · 2026」）
  await expect(page.getByLabel('用户名')).toBeVisible(); // 账号密码 tab 默认渲染用户名输入框（登录按钮是 Box 而非 <button>，不用 role）
});

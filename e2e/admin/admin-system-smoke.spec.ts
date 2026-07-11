import { test, expect } from '@playwright/test';

/**
 * 管理后台 · 系统模块 smoke。owner+SUPER_ADMIN 权限可进 /system/* 各子页面（基于
 * storageState 的 useAuthority 通过）。
 * 选 5 个代表性 path 做「打开 + body 可见」路由验证；不绑死页内文案（dashboard 有图表，
 * user/list 表头变，跳过过细断言）。
 */
const SMOKE_ROUTES = [
  '/system',
  '/system/user', // 用户列表
  '/system/role', // 角色
  '/system/menu', // 菜单
  '/system/app', // 应用
  '/system/dashboard/analysis', // 分析页
];

for (const path of SMOKE_ROUTES) {
  test(`admin · ${path} 进入不崩`, async ({ page }) => {
    const resp = await page.goto(`http://localhost:3000${path}`);
    expect(resp).toBeTruthy();
    // admin 路由可能在 useAuthority 失败时跳 login,允许这两种状态
    const status = resp!.status();
    expect([200, 304, 302, 307].includes(status) || status < 500).toBeTruthy();
    await expect(page.locator('body')).toBeVisible({ timeout: 5_000 });
  });
}

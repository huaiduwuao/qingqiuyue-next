import { test, expect } from '@playwright/test';

/**
 * 首页（公开）smoke。一级跳转 landing → /home/recommend（main 包内的 home 子路由）。
 * 内容由 HERMES 推荐 / HotRankingBar / RecommendBoard 等组件拼装，至少验证能进得去 +
 * 一些关键文案存在。
 */
test.describe('首页 smoke', () => {
  test('1 · landing → /home/recommend 加载', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    // 顶级 page.tsx 重定向到 /home/recommend
    await page.waitForURL(/\/home\/recommend/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/home\/recommend/);
  });

  test('2 · recommend 页有 hero / 列表渲染', async ({ page }) => {
    await page.goto('http://localhost:3000/home/recommend');
    // 不绑死文案（推荐位每周变）:主内容区每张内容卡都有一张封面 img,数它最稳。
    // 全量并行跑时 dev 冷编译竞争严重,首屏可能 >30s,给 45s 余量。
    const covers = page.locator('main img[alt]:not([alt=""])');
    await expect(covers.first()).toBeVisible({ timeout: 45_000 });
    expect(await covers.count()).toBeGreaterThanOrEqual(5);
  });

  // 左侧栏「内容管理」「悬赏中心」:router.push 同页跳转,不开新标签页,且返回键能回首页
  for (const { label, url } of [
    { label: '内容管理', url: /\/account\/content$/ },
    { label: '悬赏中心', url: /\/account\/reward$/ },
  ]) {
    test(`3 · 侧栏「${label}」同页跳转且可返回(不开新标签)`, async ({ page, context }) => {
      await page.goto('/home/recommend');
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
      let popupOpened = false;
      context.on('page', () => { popupOpened = true; });
      await page.getByText(label, { exact: true }).first().click();
      await expect(page).toHaveURL(url, { timeout: 10_000 });
      expect(popupOpened).toBe(false);
      // push 留了历史栈:返回键应回到 /home/recommend
      await page.goBack();
      await expect(page).toHaveURL(/\/home\/recommend/, { timeout: 10_000 });
    });
  }
});

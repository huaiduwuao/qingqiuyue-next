import { test, expect } from '@playwright/test';
import { gotoContentView } from '../fixtures/content-nav';

/**
 * 创作者中心 · 活动管理。数据:getActivityList(真接口)。
 * 写路径:立即报名 → 报名弹窗 → 勾选同意规则 → 确认报名(POST /api/core/activity/signup)
 * → snack「已成功报名《…》」。
 */
const RX_SIGNUP = /\/api\/core\/activity\/signup(\?|$)/;

test.describe('创作者中心 · 活动管理', () => {
  test('1 · 渲染骨架（标题 + 搜索 + 排序）', async ({ page }) => {
    await gotoContentView(page, '活动管理');
    await expect(page.getByText('活动管理').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder('搜索活动名称 / 主办方')).toBeVisible();
    await expect(page.getByText('浏览平台活动 · 报名参与 · 投稿作品 · 查看获奖')).toBeVisible();
  });

  test('2 · 立即报名 → 勾选规则 → 确认报名 → POST + snack', async ({ page }) => {
    await gotoContentView(page, '活动管理');
    // 报名是单向持久化:全部报过名就没有「立即报名」了 → 幂等 skip
    const signupBtn = page.getByRole('button', { name: '立即报名' }).first();
    const hasSignup = await signupBtn.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false);
    test.skip(!hasSignup, '当前账号所有可报名活动均已报名,无「立即报名」入口');
    await signupBtn.dispatchEvent('click'); // 数字人聊天气泡可能拦截,绕开

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/^报名《/)).toBeVisible({ timeout: 5_000 });
    // 未勾选规则 → 确认报名 disabled
    const confirmBtn = dialog.getByRole('button', { name: '确认报名' });
    await expect(confirmBtn).toBeDisabled();
    await dialog.getByText('我已阅读并同意以上规则,自愿参与本活动').click();
    await expect(confirmBtn).toBeEnabled();

    const signupReq = page.waitForRequest((r) => r.method() === 'POST' && RX_SIGNUP.test(r.url()), { timeout: 10_000 });
    await confirmBtn.click();
    const req = await signupReq.catch(() => null);
    expect(req, '确认报名应发出 POST /api/core/activity/signup').toBeTruthy();

    await expect(page.getByText(/^已成功报名《/)).toBeVisible({ timeout: 8_000 });
  });

  /**
   * 详情 Drawer · 4 tab 切换:点开第一个活动卡 → 默认 detail tab 显示 → 切到 prizes /
   * leaderboard / mywork,各 tab 至少看到自己的 SectionTitle;关闭 X。
   * 不依赖活动有 prizes/leaderboard/submissions 数据(空数据也显示标题或空态)。
   */
  test('3 · 详情 Drawer 4 tab 切换', async ({ page }) => {
    await gotoContentView(page, '活动管理');
    await page.waitForResponse((r) => r.url().includes('/api/core/creator/activity') && r.status() === 200, { timeout: 15_000 }).catch(() => {});

    // 活动卡:Box 不是 button/role,只能通过标题文字定位。点首张活动卡(主标题文字),打开 Drawer。
    const firstCard = page.locator('h6, [class*="MuiTypography"]').filter({ hasText: /\S/ }).first();
    const hasCard = await firstCard.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
    test.skip(!hasCard, '当前无可用活动卡(seed 应保证 ≥1 条)');
    await firstCard.dispatchEvent('click'); // 数字人聊天气泡可能拦截,绕开

    // Drawer 应打开,默认 "活动详情" tab + SectionTitle 出现
    const drawer = page.locator('.MuiDrawer-root').last();
    await expect(drawer.getByText('活动介绍')).toBeVisible({ timeout: 5_000 });
    await expect(drawer.getByText('活动规则')).toBeVisible();
    await expect(drawer.getByText('投稿要求')).toBeVisible();

    // 切到「奖项」tab
    await drawer.getByRole('tab', { name: /奖项/ }).click();
    await expect(drawer.getByText('奖项设置')).toBeVisible({ timeout: 3_000 });

    // 切到「排行榜」tab
    await drawer.getByRole('tab', { name: /排行榜/ }).click();
    await expect(drawer.getByText('作品热度榜')).toBeVisible({ timeout: 3_000 });

    // 切到「我的作品」tab — "我的投稿" SectionTitle 或空态 "还没有作品参赛"
    await drawer.getByRole('tab', { name: /我的作品/ }).click();
    const myWork = drawer.getByText(/我的投稿|还没有作品参赛/);
    await expect(myWork).toBeVisible({ timeout: 3_000 });

    // 关闭 Drawer:关闭 X 是 drawer 第一个 IconButton(在 Hero 右上)
    await drawer.locator('button').first().click();
    await expect(drawer).not.toBeVisible({ timeout: 3_000 });
  });

  /**
   * 搜索过滤:输入不存在的关键词 → 列表空 → 显示"没有符合条件的活动"空态。
   * 不假设具体活动名,以"结果数量在输入后变化"为弱断言;若活动数 ≤1 跳过(没东西可筛)。
   */
  test('4 · 搜索框实时过滤活动', async ({ page }) => {
    await gotoContentView(page, '活动管理');
    await page.waitForResponse((r) => r.url().includes('/api/core/creator/activity') && r.status() === 200, { timeout: 15_000 }).catch(() => {});

    const search = page.getByPlaceholder('搜索活动名称 / 主办方');
    await expect(search).toBeVisible({ timeout: 5_000 });
    await search.fill('zzzzz不存在的关键词');
    await expect(page.getByText(/没有符合条件的活动/)).toBeVisible({ timeout: 5_000 });
    // 清空恢复
    await search.fill('');
  });
});

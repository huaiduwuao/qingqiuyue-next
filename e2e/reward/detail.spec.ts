import { test, expect } from '@playwright/test';

/**
 * 悬赏中心 · 页内弹层（不跳转路由）。
 * 背景：/account/reward/detail?id=b2 独立路由已按需求移除，详情/全部列表/完整榜单
 * 全部改为 dashboard 内弹层 (BountyDetailDialog / BountyListDialog / RankingListDialog),
 * URL 全程保持在 /account/reward。seed: 从意境链路脚本生成。
 */
test.describe('悬赏中心 · 页内弹层（不跳转）', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/account/reward');
    await expect(page.getByText('热门悬赏')).toBeVisible({ timeout: 15_000 });
  });

  test('1 · 点击热门悬赏卡 -> 详情弹层，URL 不变', async ({ page }) => {
    const card = page.getByText(/国风青丘/).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    await card.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    // exact:true —— "正在加载悬赏详情…"含子串"悬赏详情"会触发 strict mode
    await expect(dialog.getByText('悬赏详情', { exact: true })).toBeVisible();
    await expect(dialog.getByText('总赏金')).toBeVisible();
    await expect(dialog.getByText('已接悬赏')).toBeVisible();
    await expect(page).toHaveURL(/\/account\/reward$/);
  });

  test('2 · 详情弹层可关闭且不离开当前页', async ({ page }) => {
    await page.getByText(/国风青丘/).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await dialog.getByRole('button', { name: '关闭' }).first().click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/account\/reward$/);
  });

    test('3 · 查看全部 -> 跳转到 /bounties 页面 -> 卡片点击进详情弹层', async ({ page }) => {
    // 广场"查看全部 >" 现在跳转到独立路由,不是弹窗
    await page.getByText('查看全部 >').first().click();
    await page.waitForURL(/\/account\/reward\/bounties/, { timeout: 5_000 });
    // 页面标题 + 至少 1 张卡
    await expect(page.getByText('全部悬赏')).toBeVisible({ timeout: 10_000 });
    const cards = page.getByText(/国风青丘|青丘月/);
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
    await cards.first().click();
    // 详情弹窗叠在页面上
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('悬赏详情', { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/account\/reward\/bounties/);
  });

  test('3b · 全部悬赏页 · 分类筛选可点击', async ({ page }) => {
    await page.goto('/account/reward/bounties');
    await expect(page.getByText('全部悬赏')).toBeVisible({ timeout: 10_000 });
    // 找一个非"全部"的分类 chip 点一下,URL 应带上 ?category=
    const musicChip = page.getByRole('button', { name: /^音乐/ });
    if (await musicChip.count() > 0) {
      await musicChip.first().click();
      await page.waitForURL(/category=music/, { timeout: 5_000 });
    }
    await page.goBack();
    await expect(page).toHaveURL(/\/account\/reward/);
  });

test('4 · 达人榜“查看完整榜单” -> 榜单弹层', async ({ page }) => {
    await page.getByText('查看完整榜单 ->').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText('悬赏达人榜 · 完整榜单')).toBeVisible();
    await expect(page).toHaveURL(/\/account\/reward$/);
  });
});

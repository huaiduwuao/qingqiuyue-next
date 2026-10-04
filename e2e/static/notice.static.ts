import { COMMON, NOTICE, TAKEDOWN_ID } from './fixtures';
import { expect, installMocks, test } from './mock';
import type { Page } from '@playwright/test';

/** 记录已读请求的 body */
function watchRead(page: Page) {
  const reads: Array<{ path: string; body: unknown }> = [];
  page.on('request', (r) => {
    const p = new URL(r.url()).pathname;
    if (r.method() === 'POST' && /\/api\/core\/notice\/\w+\/read$/.test(p)) reads.push({ path: p, body: r.postDataJSON() });
  });
  return reads;
}

const DETAIL_URL = new RegExp(`/share/module-content-detail\\?id=${TAKEDOWN_ID}$`);

test.describe('系统消息', () => {
  test('消息中心:列表显示时间和标签,点「作品下架」进作品详情', async ({ page, errors }) => {
    const api = await installMocks(page, { authed: true, rules: [...COMMON, ...NOTICE] });
    const reads = watchRead(page);
    await page.goto('/account/msg?tab=system');

    const takedown = page.getByText('作品已被下架', { exact: true });
    await expect(takedown).toBeVisible();
    // 标签 / 时间由 notice.info + createTime 推导
    const row = takedown.locator('xpath=..');
    await expect(row.getByText('作品', { exact: true })).toBeVisible();
    await expect(row.getByText(/^今天 \d{2}:\d{2}$/)).toBeVisible();
    const review = page.getByText('审核未通过', { exact: true }).locator('xpath=..');
    await expect(review.getByText('审核', { exact: true })).toBeVisible();
    await expect(review.getByText('3 天前', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '全部已读 (1)' })).toBeVisible();

    await takedown.click();
    await expect(page).toHaveURL(DETAIL_URL);
    // 长整数 id 不丢精度
    expect(new URL(page.url()).searchParams.get('id')).toBe(TAKEDOWN_ID);
    expect(reads).toEqual([{ path: '/api/core/notice/system/read', body: { id: 7001 } }]);
    await expect(page.getByText('已下架作品').first()).toBeVisible();

    expect(api.unmatched).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('顶栏铃铛:系统页签同样能点进作品详情,已读打到 system 接口', async ({ page, errors }) => {
    const api = await installMocks(page, { authed: true, rules: [...COMMON, ...NOTICE] });
    const reads = watchRead(page);
    // 消息中心页自己不显示铃铛,从别的个人中心页打开
    await page.goto('/account/settings');

    await page.getByRole('button', { name: '通知' }).click();
    await page.getByRole('tab', { name: /系统消息/ }).last().click();
    const item = page.getByRole('presentation').getByText('作品已被下架', { exact: true });
    await expect(item).toBeVisible();
    // 时间由 createTime 推导(以前读不存在的 time 字段,一直空白)
    const popover = page.getByRole('presentation');
    await expect(popover.getByText(/^(刚刚|\d+ 分钟前)$/).first()).toBeVisible();
    await expect(popover.getByText('3 天前', { exact: true })).toBeVisible();
    await item.click();

    await expect(page).toHaveURL(DETAIL_URL);
    expect(reads).toEqual([{ path: '/api/core/notice/system/read', body: { id: 7001 } }]);
    expect(api.unmatched).toEqual([]);
    expect(errors).toEqual([]);
  });
});

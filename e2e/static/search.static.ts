import { COMMON, SEARCH, SEARCH_KW } from './fixtures';
import { expect, installMocks, test } from './mock';

test('搜索:输入关键词出结果,曝光上报正常发出', async ({ page, errors }) => {
  const api = await installMocks(page, { rules: [...COMMON, ...SEARCH] });
  const impressions: Array<Record<string, unknown>> = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/api\/content\/search\/feedback$/.test(new URL(r.url()).pathname)) {
      impressions.push(r.postDataJSON());
    }
  });

  await page.goto('/search');
  const box = page.getByPlaceholder('搜索你感兴趣的内容、创作者或话题').last();
  await box.fill(SEARCH_KW);
  await box.press('Enter');

  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(SEARCH_KW)}`));
  await expect(page.getByText(`${SEARCH_KW}之下 第1部`).first()).toBeVisible();
  // 「全部」页签只预览前 4 条
  await expect(page.locator('[data-cid]')).toHaveCount(4);

  // IntersectionObserver:卡片可见即上报 impression(带关键词和位置)
  await expect.poll(() => impressions.length).toBeGreaterThan(0);
  expect(impressions[0]).toMatchObject({ keyword: SEARCH_KW, event: 'impression' });

  // 切到「内容」页签:新挂上的卡片由 MutationObserver 交给 observer,后两条也要上报,且同一条不重复报
  await page.getByRole('tab', { name: /^内容/ }).click();
  await expect(page.locator('[data-cid]')).toHaveCount(6);
  const ids = () => impressions.map((i) => String(i.contentId));
  await expect.poll(() => new Set(ids()).size).toBe(6);
  expect(ids().length).toBe(6);

  expect(api.unmatched).toEqual([]);
  expect(errors).toEqual([]);
});

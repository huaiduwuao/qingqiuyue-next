import { expect, type Page } from '@playwright/test';
import { waitList } from './api';

/**
 * 进入悬赏中心「协作看板」。reward 是客户端单页（tabKey 切视图，无 deep link），
 * 只能 goto reward 后点 sidebar「协作看板」(key '7')。?owner=1 由 taskboard 挂载时读一次。
 */
export async function gotoTaskboard(page: Page, { owner = true }: { owner?: boolean } = {}) {
  await page.goto(`/account/reward${owner ? '?owner=1' : ''}`);
  await page.getByRole('button', { name: '协作看板' }).click();
  // 等懒加载 chunk（Suspense fallback「加载中…」）消失，再等看板 toolbar 出现
  await expect(page.getByText('加载中…')).toBeHidden({ timeout: 15_000 }).catch(() => {});
  await expect(page.getByRole('button', { name: '我的任务' })).toBeVisible({ timeout: 15_000 });
  // 首次列表请求已发出（有 project seed 时）
  await waitList(page).catch(() => {});
}

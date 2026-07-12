import { expect, type Page } from '@playwright/test';

/**
 * 进入创作者中心某视图。content 是客户端单页（activeTab 切视图，无 deep link）,只能:
 *   goto /account/content → 点 sidebar item → 等视图切换
 *
 * label 对应 CreatorSidebar.MENU_GROUPS 里 item.label:
 *   '工作台' / '发布' / '审核员工作台' / '活动管理' / '共创中心' / '合集管理'
 *   '作品管理' / '爬虫管理' / '抓取内容' / '原创保护'
 *   '数据中心' / '等级勋章' / '变现中心'
 *
 * 坑:侧栏按钮在 React hydration 完成前就「可见可点」,此时点击事件丢失(视图不切)。
 * 解法:重试点击,直到默认工作台内容(「灵感发现」)消失 = 切换真正生效。
 */
export async function gotoContentView(page: Page, label: string) {
  await page.goto('/account/content');
  // 先等默认工作台渲染出标志内容:① 确认 hydration 完成(之前点击丢失的根因)
  // ② 避免「灵感发现尚未渲染 → toBeHidden 误判切换成功」的假阳性
  await expect(page.getByText('灵感发现').first()).toBeVisible({ timeout: 15_000 });
  const btn = page.getByRole('button', { name: label }).first();
  await btn.waitFor({ state: 'visible', timeout: 10_000 });
  if (label !== '工作台') {
    await expect(async () => {
      await btn.click();
      await expect(page.getByText('灵感发现').first()).toBeHidden({ timeout: 3_000 });
    }).toPass({ timeout: 15_000, intervals: [300, 600, 1000] });
  } else {
    await btn.click();
  }
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
}

import { expect, type Page } from '@playwright/test';

/**
 * 进入创作者中心某视图。content 是客户端单页（activeTab 切视图，无 deep link）,只能:
 *   goto /account/content → 点 sidebar item → 等 fallback 消失
 *
 * label 对应 CreatorSidebar.MENU_GROUPS 里 item.label:
 *   '工作台' / '高清发布' / '活动管理' / '共创中心' / '合集管理'
 *   '作品管理' / '爬虫管理' / '抓取内容' / '原创保护'
 *   '数据中心' / '等级勋章' / '变现中心' / '互动数据' / '通知'
 */
export async function gotoContentView(page: Page, label: string) {
  await page.goto('/account/content');
  await page.getByRole('button', { name: label }).first().click();
  // 等加载中/Chakra 风格 — content 视图一般没有 Suspense,设宽松兜底
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
}

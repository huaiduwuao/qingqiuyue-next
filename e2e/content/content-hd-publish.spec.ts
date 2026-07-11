import { test, expect } from '@playwright/test';
import { gotoContentView } from '../fixtures/content-nav';

/**
 * 创作者中心 · 高清发布(hd-publish,2819 行的最大写流程)。
 * 覆盖:渲染骨架 → 上传弹窗 → 空标题校验 → 提交上传(POST /api/content/module/content)
 * → 新卡进「转码中」。提交接口走真实后端;失败时前端兜底本地预览,snack 文案统一为
 * 「已加入转码队列」,两条路殊途同归。
 */
const RX_CREATE = /\/api\/content\/module\/content\/?(\?|$)/;

test.describe('创作者中心 · 高清发布', () => {
  test('1 · 渲染骨架（统计卡 + 上传区 + 特权 + 状态 Tabs)', async ({ page }) => {
    await gotoContentView(page, '高清发布');
    for (const t of ['今日上传', 'HD 作品总数', '极速通道剩余', '今日审核']) {
      await expect(page.getByText(t).first()).toBeVisible({ timeout: 10_000 });
    }
    await expect(page.getByText('上传高清视频').first()).toBeVisible();
    await expect(page.getByText('HD 创作特权')).toBeVisible();
    // 状态 Tabs(带计数,用前缀匹配)
    for (const t of ['全部', '转码中', '审核中', '已发布']) {
      await expect(page.getByRole('tab', { name: new RegExp(`^${t}`) })).toBeVisible();
    }
  });

  test('2 · 上传区点击 → 弹窗字段齐全（标题/质量/提交）', async ({ page }) => {
    await gotoContentView(page, '高清发布');
    await page.getByText('点击或拖拽视频文件到此区域', { exact: false }).first().dispatchEvent('click'); // 数字人聊天气泡会拦截 pointer 事件,绕开
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText('上传高清视频')).toBeVisible();
    await expect(dialog.getByLabel('视频标题')).toBeVisible();
    await expect(dialog.getByText('输出质量')).toBeVisible();
    for (const q of ['4K 超清', '2K 高清', '1080P 高清', '720P 标清']) {
      await expect(dialog.getByText(q, { exact: true })).toBeVisible();
    }
    await expect(dialog.getByRole('button', { name: '提交上传' })).toBeVisible();
  });

  test('3 · 空标题提交 → 校验 snack「请输入视频标题」', async ({ page }) => {
    await gotoContentView(page, '高清发布');
    await page.getByText('点击或拖拽视频文件到此区域', { exact: false }).first().dispatchEvent('click'); // 数字人聊天气泡会拦截 pointer 事件,绕开
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await dialog.getByRole('button', { name: '提交上传' }).click();
    await expect(page.getByText('请输入视频标题')).toBeVisible({ timeout: 5_000 });
    // 弹窗仍在(未提交)
    await expect(dialog).toBeVisible();
  });

  test('4 · 提交上传 → POST 内容创建 + snack + 新卡进列表', async ({ page }) => {
    await gotoContentView(page, '高清发布');
    await page.getByText('点击或拖拽视频文件到此区域', { exact: false }).first().dispatchEvent('click'); // 数字人聊天气泡会拦截 pointer 事件,绕开
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const title = `E2E-HD-${Date.now()}`;
    await dialog.getByLabel('视频标题').fill(title);
    // 切换质量预设:4K → 1080P
    await dialog.getByText('1080P 高清', { exact: true }).click();

    const createReq = page.waitForRequest(
      (r) => r.method() === 'POST' && RX_CREATE.test(r.url()) && !r.url().includes('/action'),
      { timeout: 10_000 },
    );
    await dialog.getByRole('button', { name: '提交上传' }).click();

    // 真接口请求发出(失败也兜底,但请求必须到网关)
    const req = await createReq.catch(() => null);
    expect(req, '提交上传应发出 POST /api/content/module/content').toBeTruthy();

    await expect(page.getByText(`《${title}》已加入转码队列并同步创建内容记录`)).toBeVisible({ timeout: 8_000 });
    await expect(dialog).toBeHidden({ timeout: 5_000 });
    // 新卡以「转码中」状态出现在列表顶部(exact:snack 文案也含标题,会撞 strict)
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('tab', { name: /^转码中 [1-9]/ })).toBeVisible();
  });

  test('5 · 上传弹窗可取消关闭', async ({ page }) => {
    await gotoContentView(page, '高清发布');
    await page.getByText('点击或拖拽视频文件到此区域', { exact: false }).first().dispatchEvent('click'); // 数字人聊天气泡会拦截 pointer 事件,绕开
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await dialog.getByRole('button', { name: '取消' }).click();
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });
});

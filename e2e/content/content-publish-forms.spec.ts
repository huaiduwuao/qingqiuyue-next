import { test, expect, type Page } from '@playwright/test';
import { gotoContentView } from '../fixtures/content-nav';

/**
 * 创作者中心 · 发布中枢(hd-publish dispatcher,多类型 chip + 12 个 PublishForms 懒加载)。
 *
 * 覆盖:13 类型 chip 切换 → 对应 PublishForm 弹窗 + 标题/字段。
 * 不跑写路径(ImageForm/ArticleForm 等的提交涉及后端 mock 落库,且每个 form 状态机差异大,
 * 想覆盖应该在 PublishForms 内部用 vitest 单测,e2e 只验 dispatcher 调度本身)。
 */
test.describe('创作者中心 · 发布中枢(多类型 dispatcher)', () => {
  test('1 · 13 类型 chip 全可见 + 默认 video 选中', async ({ page }) => {
    await gotoContentView(page, '发布');
    // 13 chip: 全部 / 视频 / 图文 / 图片 MV / 文章 / 小说 / 新闻 / 音乐 / 漫画 / 短剧 / 电视剧 / 电影 / 动画 / 直播
    for (const label of ['全部', '视频', '图文', '图片 MV', '文章', '小说', '新闻', '音乐', '漫画', '短剧', '电视剧', '电影', '动画', '直播']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible({ timeout: 8_000 });
    }
  });

  test('2 · 点「图文」chip → ImageForm 弹窗(标题 / 简介 / 标签 / 上传区)', async ({ page }) => {
    await gotoContentView(page, '发布');
    await page.getByRole('button', { name: '图文', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    // 弹窗标题"发布「图文」"
    await expect(dialog.getByText('发布「图文」')).toBeVisible();
    // 表单字段:标题/简介/标签 + 上传占位区
    await expect(dialog.getByText('标题', { exact: true })).toBeVisible();
    await expect(dialog.getByText('简介', { exact: true })).toBeVisible();
    await expect(dialog.getByText('标签', { exact: true })).toBeVisible();
    await expect(dialog.getByText(/还能加.*张/)).toBeVisible();
    // 未传图时:提交按钮 disabled
    await expect(dialog.getByRole('button', { name: '发布', exact: true })).toBeDisabled();
  });

  test('3 · 点「文章」chip → ArticleForm(无图片,只有 标题/正文/标签)', async ({ page }) => {
    await gotoContentView(page, '发布');
    await page.getByRole('button', { name: '文章', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText('发布「文章」')).toBeVisible();
    // 文章没多图,只有 title + 正文 + 标签
    await expect(dialog.getByText('正文', { exact: true })).toBeVisible();
    await expect(dialog.getByText('标签', { exact: true })).toBeVisible();
    // 应没有"还能加 N 张"占位
    await expect(dialog.getByText(/还能加.*张/)).not.toBeVisible();
  });

  /**
   * ImageForm 状态机:拖入 1 张有效图 → 走 /file/upload → 进度 100% + 「已上传」标 → 提交按钮 enabled
   * 真实流程要 setInputFiles 触发 onChange。注:后端 mock 可能没 /file/upload,失败则 skip。
   */
  test('4 · ImageForm · 上传 1 张图 → 状态机 → 提交按钮可点', async ({ page }) => {
    await gotoContentView(page, '发布');
    await page.getByRole('button', { name: '图文', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // /file/upload 可能 404 / mock 失败 → 用 race 决定是否走完整断言
    const uploadResp = page.waitForResponse(
      (r) => r.url().includes('/file/upload') && r.request().method() === 'POST',
      { timeout: 10_000 },
    ).catch(() => null);

    const fileInput = dialog.locator('input[accept="image/*"]');
    await expect(fileInput).toBeAttached({ timeout: 5_000 });
    await fileInput.setInputFiles({
      name: 'e2e-image.png',
      mimeType: 'image/png',
      buffer: Buffer.from('FAKE-IMAGE-DATA-FOR-E2E'),
    });

    const resp = await uploadResp;
    if (!resp || resp.status() >= 400) {
      test.skip(true, `文件上传后端未就绪,跳过(后端 /file/upload resp=${resp?.status() ?? 'null'})`);
      return;
    }

    // 上传成功 → 显示「已上传」标 + 提交按钮 enabled
    await expect(dialog.getByText('已上传').first()).toBeVisible({ timeout: 5_000 });
    const submit = dialog.getByRole('button', { name: /^发布$/ });
    await expect(submit).toBeEnabled({ timeout: 5_000 });
  });
});

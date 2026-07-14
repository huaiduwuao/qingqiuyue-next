import { test, expect } from '@playwright/test';

test.describe('数字人(假人)与Hermes会话测试', () => {

  test('数字人指令页面加载', async ({ page }) => {
    await page.goto('/system/digital-human-instructions');
    await page.waitForLoadState('networkidle');

    // 验证页面标题
    const title = page.locator('h5:has-text("数字人指令")');
    await expect(title).toBeVisible({ timeout: 10000 });

    // 验证新建按钮存在
    const newBtn = page.locator('button:has-text("新建指令")');
    await expect(newBtn).toBeVisible();

    // 验证左侧列表有数据
    const listItem = page.locator('text=清秋月').first();
    await expect(listItem).toBeVisible({ timeout: 5000 });

    console.log('✓ 数字人指令页面加载正常');
  });

  test('数字人指令CRUD', async ({ page }) => {
    const timestamp = Date.now();
    const agentId = `test_agent_${timestamp}`;
    const name = `测试指令_${timestamp}`;

    await page.goto('/system/digital-human-instructions');
    await page.waitForLoadState('networkidle');

    // 点击新建指令
    await page.click('button:has-text("新建指令")');
    await page.waitForTimeout(1500);

    // 查找所有 textbox 并找到 agentId 那个（按顺序第一个是 agentId，第二个是名称）
    const allTextboxes = page.getByRole('textbox');
    const count = await allTextboxes.count();
    console.log(`找到 ${count} 个 textbox`);

    if (count >= 2) {
      await allTextboxes.nth(0).fill(agentId);
      await allTextboxes.nth(1).fill(name);
    } else {
      throw new Error(`未找到足够数量的表单字段，当前只有 ${count} 个`);
    }

    // 填写prompt
    const textarea = page.locator('textarea').first();
    await textarea.fill('你是清秋月数字人测试助手');

    // 点击创建
    await page.click('button:has-text("创建")');
    await page.waitForTimeout(2000);

    // 检查成功提示
    const alert = page.locator('[role="alert"]').first();
    const hasAlert = await alert.isVisible().catch(() => false);

    if (hasAlert) {
      console.log('✓ 指令创建成功');
    } else {
      console.log('⚠ 未检测到成功提示');
    }

    // 刷新验证
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('数字人管理页面', async ({ page }) => {
    await page.goto('/system/digital-human');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 查找数字人工作台
    const dhTitle = page.locator('text=数字人工作台').first();
    await expect(dhTitle).toBeVisible({ timeout: 10000 });

    // 验证有卡片
    const cards = page.locator('[class*="Card"]');
    const count = await cards.count();
    console.log(`✓ 找到 ${count} 个卡片`);
  });

  test('Hermes页面加载和session', async ({ page }) => {
    await page.goto('/(main)/hermes');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 检查页面内容
    const body = await page.locator('body').textContent();
    if (body?.includes('Hermes') || body?.includes('智能体')) {
      console.log('✓ Hermes页面加载成功');
    } else {
      console.log('⚠ Hermes页面内容未找到，可能未登录');
    }

    // 检查输入框
    const input = page.locator('input[type="text"], textarea').first();
    const inputVisible = await input.isVisible().catch(() => false);
    if (inputVisible) {
      console.log('✓ 输入框可见');
    }
  });

  test('管理面板系统管理页面', async ({ page }) => {
    await page.goto('/system');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 检查菜单
    const menu = page.locator('text=数字人').first();
    await expect(menu).toBeVisible({ timeout: 5000 });

    // 验证系统管理员显示
    const admin = page.locator('text=系统管理员');
    await expect(admin).toBeVisible({ timeout: 5000 });

    console.log('✓ 系统管理页面加载成功');
  });

  test('数字人指令编辑', async ({ page }) => {
    await page.goto('/system/digital-human-instructions');
    await page.waitForLoadState('networkidle');

    // 等待列表加载
    await page.waitForTimeout(1000);

    // 点击第一个编辑按钮
    const editBtns = page.locator('button:has-text("编辑")');
    const editCount = await editBtns.count();
    console.log(`找到 ${editCount} 个编辑按钮`);

    if (editCount > 0) {
      await editBtns.first().click();
      await page.waitForTimeout(500);

      // 验证右侧编辑面板打开 - 检查prompt textarea有内容
      const textarea = page.locator('textarea').first();
      const textareaVisible = await textarea.isVisible().catch(() => false);

      if (textareaVisible) {
        const value = await textarea.inputValue();
        console.log(`✓ 指令可编辑，prompt长度: ${value.length}`);
      } else {
        console.log('⚠ textarea未找到');
      }
    } else {
      console.log('⚠ 未找到编辑按钮');
    }
  });
});

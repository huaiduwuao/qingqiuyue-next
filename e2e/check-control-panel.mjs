import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  const errors = [];
  const failedRequests = [];

  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`[CONSOLE ERROR] ${msg.text()}`);
  });
  page.on('pageerror', err => errors.push(`[PAGE ERROR] ${err.message}`));
  page.on('response', resp => {
    if (resp.status() >= 400) {
      failedRequests.push(`${resp.status()} ${resp.url()}`);
    }
  });

  try {
    console.log('=== Step 1: Navigate to digital-human ===');
    await page.goto('http://localhost:3000/digital-human', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(6000);

    // 先关掉任何打开的 Modal/Drawer（按 ESC 或点击 backdrop）
    console.log('\n=== Step 2: Close any open dialogs ===');
    // 按 ESC 关闭弹窗
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // 如果 ESC 不管用，尝试找并关闭会话列表按钮
    const sessionBtn = page.locator('button[aria-label="会话列表"]');
    if (await sessionBtn.isVisible()) {
      // 如果已经打开，再点一次关掉
      await sessionBtn.click();
      await page.waitForTimeout(500);
    }

    // 点击"舞台控制台"按钮
    console.log('\n=== Step 3: Open Control Panel ===');
    const stageBtn = page.locator('button[aria-label="舞台控制台"]');
    await stageBtn.waitFor({ state: 'visible', timeout: 5000 });
    await stageBtn.click({ force: true }); // 用 force 跳过拦截
    console.log('Clicked: 舞台控制台 button');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'e2e/dh-control-panel.png', fullPage: true });
    console.log('Screenshot saved: e2e/dh-control-panel.png');

    // 收集控制面板内容
    const drawerContent = await page.evaluate(() => {
      const drawers = document.querySelectorAll('[class*="MuiDrawer"]');
      const results = [];
      drawers.forEach((d, i) => {
        const isOpen = !d.getAttribute('aria-hidden');
        if (isOpen) {
          results.push({
            index: i,
            anchor: d.getAttribute('aria-label') || 'no-label',
            text: d.textContent?.slice(0, 3000) || 'Empty'
          });
        }
      });
      return JSON.stringify(results, null, 2);
    });
    console.log('\n=== Open Drawers ===');
    console.log(drawerContent);

    // 查找跳舞开始按钮
    console.log('\n=== Step 4: Test Dance Control ===');
    const danceStartBtn = page.locator('button:has-text("开始")').first();
    if (await danceStartBtn.isVisible()) {
      console.log('Found dance button, clicking...');
      await danceStartBtn.click({ force: true });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'e2e/dh-dancing.png', fullPage: true });
      console.log('Dance started! Screenshot saved');
    }

    // 测试场景切换
    console.log('\n=== Step 5: Test Scene Switch ===');
    const sceneButtons = await page.$$('button');
    for (const btn of sceneButtons) {
      const text = await btn.textContent();
      if (text && ['舞台', '演唱会', '海边', '太空', '花园'].includes(text.trim())) {
        console.log(`Clicking scene: ${text}`);
        await btn.click({ force: true });
        await page.waitForTimeout(500);
        break;
      }
    }

    // 测试移动控制
    console.log('\n=== Step 6: Test Movement Control ===');
    const moveBtn = page.locator('button:has-text("↑")').first();
    if (await moveBtn.isVisible()) {
      console.log('Clicking forward move...');
      await moveBtn.click({ force: true });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'e2e/dh-moved.png', fullPage: true });
      console.log('Movement test done');
    }

    console.log('\n=== Errors ===');
    errors.forEach(e => console.log(e));
    console.log('\n=== Failed Requests (non-hermes) ===');
    failedRequests.filter(r => !r.includes('hermes')).forEach(r => console.log(r));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();

import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  try {
    await page.goto('http://localhost:3000/digital-human', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(6000); // VRM 加载

    // 打开控制面板
    console.log('=== Opening Control Panel ===');
    await page.evaluate(() => {
      document.querySelector('button[aria-label="舞台控制台"]')?.click();
    });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/dh-1-panel-open.png', fullPage: true });

    // 测试1：点击跳舞开始按钮
    console.log('\n=== Test 1: Start Dancing ===');
    const danceStart = page.locator('button:has-text("▶ 开始")');
    if (await danceStart.isVisible()) {
      console.log('Clicking dance start button...');
      await danceStart.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'e2e/dh-2-dancing.png', fullPage: true });

      // 检查按钮文字是否变成"■ 停止"
      const danceStop = page.locator('button:has-text("■ 停止")');
      const isDancing = await danceStop.isVisible();
      console.log(`Dance state: ${isDancing ? 'DANCING (stop button visible)' : 'NOT DANCING'}`);

      // 检查控制台是否有跳舞相关日志
      const danceLogs = await page.evaluate(() => {
        return window.__consoleLogs?.filter(l => l.includes('dance') || l.includes('Dance') || l.includes('bpm')) || [];
      });
      console.log('Dance-related console logs:', danceLogs);
    }

    // 测试2：切换场景
    console.log('\n=== Test 2: Switch Scene ===');
    const sceneButtons = ['舞台', '演唱会', '海边', '太空', '花园'];
    for (const sceneName of sceneButtons) {
      const btn = page.locator(`button:has-text("${sceneName}")`).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log(`Switching to scene: ${sceneName}`);
        await btn.click();
        await page.waitForTimeout(1000);
        break;
      }
    }
    await page.screenshot({ path: 'e2e/dh-3-scene.png', fullPage: true });

    // 测试3：移动控制（方向键）
    console.log('\n=== Test 3: Movement Control ===');
    const forwardBtn = page.locator('button:has-text("↑")').first();
    if (await forwardBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('Clicking forward move...');
      await forwardBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'e2e/dh-4-moved.png', fullPage: true });

      // 尝试回中
      const resetBtn = page.locator('button:has-text("回中")');
      if (await resetBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('Resetting position...');
        await resetBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // 测试4：停止跳舞
    console.log('\n=== Test 4: Stop Dancing ===');
    const stopBtn = page.locator('button:has-text("■ 停止")');
    if (await stopBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('Stopping dance...');
      await stopBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'e2e/dh-5-stopped.png', fullPage: true });
    }

    // 总结
    console.log('\n=== SUMMARY ===');
    console.log('All screenshots saved to e2e/ directory:');
    console.log('  - dh-1-panel-open.png: Control panel opened');
    console.log('  - dh-2-dancing.png: Dance started');
    console.log('  - dh-3-scene.png: Scene switched');
    console.log('  - dh-4-moved.png: Character moved');
    console.log('  - dh-5-stopped.png: Dance stopped');

    console.log('\n=== Console Errors (non-404-hermes) ===');
    errors.filter(e => !e.includes('hermes/conversations')).forEach(e => console.log(e));

  } catch (err) {
    console.error('Test error:', err.message);
  } finally {
    await browser.close();
  }
})();

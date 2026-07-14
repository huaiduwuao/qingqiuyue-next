import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // 1. 查看场景编辑器
    console.log('=== 场景编辑器 ===');
    await page.goto('http://localhost:3000/system/digital-human-config', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 点击 Scenes Tab
    const scenesTab = page.locator('button:has-text("场景")');
    if (await scenesTab.isVisible()) {
      await scenesTab.click();
      await page.waitForTimeout(500);
    }

    // 点击新建场景
    const newSceneBtn = page.locator('button:has-text("新建场景")');
    if (await newSceneBtn.isVisible()) {
      await newSceneBtn.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: 'e2e/scene-editor.png', fullPage: true });
    console.log('截图: e2e/scene-editor.png');

    // 2. 查看数字人页面
    console.log('\n=== 数字人控制面板 ===');
    await page.goto('http://localhost:3000/digital-human', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    // 打开控制面板
    const stageBtn = page.locator('button[aria-label="舞台控制台"]');
    await stageBtn.click({ force: true });
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'e2e/scene-preview.png', fullPage: true });
    console.log('截图: e2e/scene-preview.png');

    // 收集场景相关 UI
    const sceneUI = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'))
        .filter(e => e.textContent && (
          e.textContent.includes('演唱会') || e.textContent.includes('场景') ||
          e.textContent.includes('聚光') || e.textContent.includes('镜面')
        ))
        .map(e => ({
          tag: e.tagName,
          text: e.textContent.trim().slice(0, 100)
        }))
        .slice(0, 15);
      return JSON.stringify(elements, null, 2);
    });
    console.log('\n场景相关 UI 元素:');
    console.log(sceneUI);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();

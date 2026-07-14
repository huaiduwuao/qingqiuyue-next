import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('http://localhost:3000/digital-human', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(6000);

  // 截图初始状态
  await page.screenshot({ path: 'e2e/dh-initial.png', fullPage: true });

  // 直接用 JavaScript 点击按钮并等待
  console.log('=== Clicking stage control button via JS ===');
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="舞台控制台"]');
    console.log('Button found:', !!btn);
    if (btn) btn.click();
  });
  await page.waitForTimeout(2000);

  // 检查页面结构
  const pageState = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const sliders = Array.from(document.querySelectorAll('[class*="MuiSlider"]'));
    const switches = Array.from(document.querySelectorAll('[class*="MuiSwitch"]'));
    const drawers = Array.from(document.querySelectorAll('[class*="MuiDrawer"]'));

    return {
      buttonCount: buttons.length,
      sliderCount: sliders.length,
      switchCount: switches.length,
      drawerCount: drawers.length,
      drawerStates: drawers.map(d => ({
        class: d.className.slice(0, 60),
        open: !d.getAttribute('aria-hidden'),
        anchor: d.getAttribute('aria-label')
      })),
      bodyText: document.body.textContent?.slice(0, 3000)
    };
  });

  console.log('\n=== Page State ===');
  console.log(JSON.stringify(pageState, null, 2));

  // 再次截图
  await page.screenshot({ path: 'e2e/dh-after-click.png', fullPage: true });

  // 查找所有可见的文本（控制面板相关）
  const visibleText = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    const relevant = elements
      .filter(e => {
        const text = e.textContent?.trim();
        return text && ['跳舞', '场景', '表情', 'BPM', '开始', '停止', '移动', '舞台控制'].some(k => text.includes(k));
      })
      .map(e => ({
        tag: e.tagName,
        class: e.className.slice(0, 50),
        text: e.textContent?.trim().slice(0, 50)
      }))
      .slice(0, 30);
    return JSON.stringify(relevant, null, 2);
  });
  console.log('\n=== Relevant Text Elements ===');
  console.log(visibleText);

  await browser.close();
})();

import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('http://localhost:3000/digital-human', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  // 查找所有带图标的按钮（左侧边栏分类）
  const sidebarButtons = await page.$$eval('button', btns =>
    btns.map(b => {
      const svg = b.querySelector('svg');
      const text = b.textContent?.trim();
      const title = b.getAttribute('title');
      const aria = b.getAttribute('aria-label');
      return {
        text: text?.slice(0, 20),
        title,
        aria,
        hasSvg: !!svg,
        class: b.className?.slice(0, 60)
      };
    }).filter(b => b.hasSvg || b.title || b.aria || b.text)
  );

  console.log('=== All Sidebar/Control Buttons ===');
  sidebarButtons.forEach(b => console.log(JSON.stringify(b)));

  // 尝试点击每个带 SVG 的按钮看切换什么内容
  const svgButtons = await page.$$('button svg');
  console.log(`\n=== Found ${svgButtons.length} SVG icons in buttons ===`);

  // 查找可能包含"跳舞"、"场景"、"灯光"的文本
  const allText = await page.evaluate(() => document.body.innerText);
  const keywords = ['跳舞', '场景', '灯光', '移动', '控制', 'Dance', 'Scene', 'Light', 'Move'];
  keywords.forEach(kw => {
    if (allText.includes(kw)) {
      console.log(`\nFound keyword: "${kw}"`);
    }
  });

  // 检查是否有隐藏的 tab 或 drawer
  const hiddenElements = await page.$$eval('[class*="hidden"], [class*="drawer"], [class*="tab"]', els =>
    els.map(e => ({
      tag: e.tagName,
      class: e.className?.slice(0, 60),
      text: e.textContent?.trim().slice(0, 40)
    })).slice(0, 20)
  );
  console.log('\n=== Drawer/Tab Elements ===');
  hiddenElements.forEach(e => console.log(JSON.stringify(e)));

  await browser.close();
})();

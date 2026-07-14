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
    console.log('Navigating to digital-human...');
    await page.goto('http://localhost:3000/digital-human', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('Page loaded, waiting for VRM to initialize...');
    await page.waitForTimeout(8000); // 等待 VRM 和控制面板完全加载

    await page.screenshot({ path: 'e2e/dh-verify.png', fullPage: true });
    console.log('Screenshot saved to e2e/dh-verify.png');

    // 收集所有按钮
    const allButtons = await page.$$eval('button', btns =>
      btns.map(b => ({
        text: b.textContent?.trim().slice(0, 30),
        aria: b.getAttribute('aria-label'),
        title: b.getAttribute('title'),
        class: b.className?.slice(0, 50)
      })).filter(b => b.text || b.aria || b.title)
    );

    // 查找可能的面板容器
    const panels = await page.$$eval('div[class*="Mui"]', els =>
      els.map(e => ({
        class: e.className?.slice(0, 80),
        childCount: e.children.length,
        text: e.textContent?.trim().slice(0, 60)
      })).filter(e => e.childCount > 0 && e.text).slice(0, 40)
    );

    // 检查 URL hash/params
    const url = page.url();

    console.log('\n=== Page URL ===');
    console.log(url);

    console.log('\n=== Failed Requests (404 etc) ===');
    failedRequests.forEach(r => console.log(r));

    console.log('\n=== Console Errors ===');
    errors.forEach(e => console.log(e));

    console.log('\n=== All Buttons ===');
    allButtons.forEach(b => console.log(JSON.stringify(b)));

    console.log('\n=== MUI Panels/Containers ===');
    panels.forEach(p => console.log(JSON.stringify(p)));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();

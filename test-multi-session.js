import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const errors = [];
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', err => errors.push(err.message));

console.log('=== Testing Multi-Session Chat in agentmanager-ui ===\n');

// 1. Navigate to home page
console.log('1. Loading home page...');
await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

const title = await page.title();
console.log(`   Page title: "${title}"`);

// 2. Check page structure
console.log('\n2. Analyzing page structure...');
const buttons = await page.$$eval('button', els => els.map(e => e.textContent?.trim()).filter(Boolean));
console.log(`   Buttons found: ${buttons.slice(0, 10).join(', ')}`);

// 3. Look for chat elements
console.log('\n3. Looking for chat/session elements...');
const chatPatterns = [
  '[class*="session"]',
  '[class*="conversation"]',
  '[class*="chat"]',
  '[class*="message"]',
  'textarea',
  'input[type="text"]'
];

for (const pattern of chatPatterns) {
  const count = await page.$$eval(pattern, els => els.length);
  if (count > 0) console.log(`   ${pattern}: ${count} found`);
}

// 4. Check for session sidebar
console.log('\n4. Checking session sidebar...');
const sidebarText = await page.$eval('aside, nav, [class*="sidebar"]', el => el.textContent?.slice(0, 200) || '').catch(() => '');
console.log(`   Sidebar content: ${sidebarText ? 'Found' : 'Not found'}`);

// 5. Check localStorage for session data
console.log('\n5. Checking localStorage...');
const storage = await page.evaluate(() => {
  const ls = {};
  Object.keys(localStorage).forEach(k => {
    try {
      ls[k] = localStorage.getItem(k);
    } catch (e) {}
  });
  return ls;
});
Object.keys(storage).forEach(k => {
  const val = storage[k] || '';
  console.log(`   • ${k}: ${val.slice(0, 80)}${val.length > 80 ? '...' : ''}`);
});

// 6. Check API endpoints
console.log('\n6. Testing API endpoints...');
const apiTests = [
  '/api/agentmanager/sessions',
  '/api/agentmanager/agents'
];

for (const endpoint of apiTests) {
  try {
    const res = await page.evaluate(async (ep) => {
      const r = await fetch(ep);
      return { status: r.status, ok: r.ok };
    }, endpoint);
    console.log(`   ${endpoint}: ${res.status} ${res.ok ? '✓' : '✗'}`);
  } catch (e) {
    console.log(`   ${endpoint}: Error`);
  }
}

// 7. Try to find and use chat input
console.log('\n7. Testing chat interaction...');
const textarea = await page.$('textarea');
if (textarea) {
  await textarea.fill('Hello, this is a test message');
  await page.waitForTimeout(500);
  const value = await textarea.inputValue();
  console.log(`   Textarea accepts input: ${value.includes('test') ? '✓' : '✗'}`);

  // Find send button
  const sendBtn = await page.$('button:has-text("Send"), button:has-text("发送"), button[type="submit"]');
  if (sendBtn) {
    console.log('   Send button found: ✓');
  }
} else {
  // Try input
  const input = await page.$('input[type="text"]');
  if (input) {
    await input.fill('Test message');
    console.log('   Input field found: ✓');
  }
}

// 8. Take screenshot
await page.screenshot({ path: '../qingqiuyue-next/agentmanager-chat-test.png', fullPage: true });
console.log('\n8. Screenshot saved: agentmanager-chat-test.png');

// 9. Final error check
console.log('\n=== Console Errors ===');
if (errors.length > 0) {
  errors.forEach(e => console.log(`   ✗ ${e}`));
} else {
  console.log('   ✓ No JavaScript errors');
}

await browser.close();
console.log('\nTest complete!');

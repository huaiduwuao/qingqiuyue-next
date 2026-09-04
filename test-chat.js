import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const errors = [];
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', err => errors.push(err.message));

console.log('=== Testing agentmanager-ui Multi-Session Chat ===\n');

// 1. Navigate to chat mode
console.log('1. Loading /home?mode=chat...');
await page.goto('http://localhost:3001/home?mode=chat', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

// Check which app we're on
const title = await page.title();
console.log(`   Page title: "${title}"`);

// 2. Check page structure
console.log('\n2. Page structure:');
const bodyHtml = await page.$eval('body', el => el.innerHTML.slice(0, 500));
console.log(`   Body preview: ${bodyHtml.includes('chat') || bodyHtml.includes('session') ? 'Chat-related' : 'Unknown'}`);

// 3. Check for chat workspace elements
console.log('\n3. Looking for ChatWorkspace elements...');
const checks = [
  { selector: '[class*="session"]', name: 'Session elements' },
  { selector: '[class*="message"]', name: 'Message elements' },
  { selector: 'textarea', name: 'Textarea' },
  { selector: '[class*="sidebar"]', name: 'Sidebar' },
  { selector: 'button:has-text("新建")', name: 'New task button' },
  { selector: '[class*="history"]', name: 'History elements' },
];

for (const check of checks) {
  const count = await page.$$eval(check.selector, els => els.length).catch(() => 0);
  console.log(`   ${check.name}: ${count > 0 ? `✓ (${count})` : '✗'}`);
}

// 4. Check localStorage for session data
console.log('\n4. LocalStorage:');
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
  console.log(`   • ${k}: ${val.slice(0, 60)}${val.length > 60 ? '...' : ''}`);
});

// 5. Test API
console.log('\n5. Testing API endpoints:');
const apiTests = [
  { url: '/api/agentmanager/sessions', name: 'Sessions API' },
  { url: '/api/agentmanager/agents', name: 'Agents API' },
];

for (const test of apiTests) {
  try {
    const res = await page.evaluate(async (url) => {
      const r = await fetch(url);
      const data = await r.json();
      return { status: r.status, hasData: Array.isArray(data.list) || Array.isArray(data) };
    }, test.url);
    console.log(`   ${test.name}: ${res.status} ${res.hasData ? '✓' : '✗'}`);
  } catch (e) {
    console.log(`   ${test.name}: Error`);
  }
}

// 6. Try to interact
console.log('\n6. Interaction test:');
const textarea = await page.$('textarea');
if (textarea) {
  await textarea.fill('Hello, test message');
  await page.waitForTimeout(300);
  console.log('   Textarea: ✓');
} else {
  console.log('   Textarea: ✗ (not found)');
}

// 7. Get all buttons text
console.log('\n7. All buttons:');
const buttons = await page.$$eval('button', els => els.map(e => e.textContent?.trim()).filter(Boolean).slice(0, 15));
buttons.forEach(b => console.log(`   • ${b}`));

// 8. Screenshot
await page.screenshot({ path: 'agentmanager-chat-workspace.png', fullPage: true });
console.log('\n8. Screenshot saved: agentmanager-chat-workspace.png');

// 9. Console errors
console.log('\n=== Console Errors ===');
if (errors.length > 0) {
  errors.forEach(e => console.log(`   ✗ ${e}`));
} else {
  console.log('   ✓ No JavaScript errors');
}

await browser.close();
console.log('\nTest complete!');

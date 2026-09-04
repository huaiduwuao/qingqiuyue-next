import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const errors = [];
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text());
});

console.log('=== Detailed Multi-Session Chat Analysis ===\n');

await page.goto('http://localhost:3001/home?mode=chat', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

// Get detailed element info
const detailed = await page.evaluate(() => {
  const results = {
    allButtons: [],
    allInputs: [],
    allNavElements: [],
    allLists: [],
    interestingClasses: [],
    fullStructure: []
  };

  // Buttons
  document.querySelectorAll('button').forEach(el => {
    const text = (el.textContent || '').trim();
    if (text) results.allButtons.push(text.slice(0, 50));
  });

  // Inputs
  document.querySelectorAll('input, textarea').forEach(el => {
    results.allInputs.push({
      type: el.type || el.tagName,
      placeholder: el.placeholder || '',
      className: el.className
    });
  });

  // Nav elements
  document.querySelectorAll('nav, aside, header, [role="navigation"]').forEach(el => {
    results.allNavElements.push({
      tag: el.tagName,
      id: el.id,
      class: el.className.slice(0, 100)
    });
  });

  // Get all elements with classes
  document.querySelectorAll('[class]').forEach(el => {
    const className = typeof el.className === 'string' ? el.className : '';
    if (className && className.length < 200) {
      results.allLists.push({
        tag: el.tagName,
        class: className
      });
    }
  });

  return results;
});

console.log('=== Buttons ===');
detailed.allButtons.forEach(b => console.log(`  • ${b}`));

console.log('\n=== Inputs ===');
detailed.allInputs.forEach(i => console.log(`  • [${i.type}] placeholder="${i.placeholder}"`));

console.log('\n=== Navigation/Sidebar ===');
detailed.allNavElements.forEach(n => console.log(`  • <${n.tag}> id="${n.id}" class="${n.class}"`));

console.log('\n=== Class List (top 50) ===');
detailed.allLists.slice(0, 50).forEach(l => console.log(`  • <${l.tag}> ${l.class}`));

// Test message flow
console.log('\n=== Testing Message Flow ===');
const input = await page.$('input[type="text"]');
if (input) {
  await input.fill('Test message from Playwright');
  await page.waitForTimeout(300);

  // Find send button
  const sendBtn = await page.$('button[type="submit"]');
  if (sendBtn) {
    await sendBtn.click();
    console.log('  ✓ Sent message');

    // Wait for response
    await page.waitForTimeout(3000);

    // Check if message appeared
    const messageArea = await page.$('[class*="message"], [class*="chat"], [class*="conversation"]');
    if (messageArea) {
      const msgText = await messageArea.textContent();
      console.log(`  ✓ Message area has content: ${(msgText || '').length} chars`);
    }
  }
}

// Check for session tabs or conversation list
console.log('\n=== Session Management ===');
const sessionPatterns = [
  '[class*="session"]',
  '[class*="conversation"]',
  '[class*="chat-item"]',
  '[class*="thread"]',
  'ul[class*="list"]'
];

for (const pattern of sessionPatterns) {
  const elements = await page.$$(pattern);
  if (elements.length > 0) {
    console.log(`  ✓ Pattern "${pattern}": ${elements.length} found`);
  }
}

// Check localStorage after interaction
const storage = await page.evaluate(() => {
  const ls = {};
  Object.keys(localStorage).forEach(k => {
    try {
      ls[k] = localStorage.getItem(k);
    } catch (e) {}
  });
  return ls;
});
console.log('\n=== LocalStorage After Test ===');
Object.keys(storage).forEach(k => {
  const val = storage[k] || '';
  console.log(`  • ${k}: ${val.slice(0, 100)}${val.length > 100 ? '...' : ''}`);
});

// Take final screenshot
await page.screenshot({ path: 'chat-detailed-test.png', fullPage: true });
console.log('\n✓ Screenshot saved: chat-detailed-test.png');

// Report errors
if (errors.length > 0) {
  console.log('\n⚠ Console Errors:');
  errors.forEach(e => console.log(`  • ${e}`));
}

await browser.close();

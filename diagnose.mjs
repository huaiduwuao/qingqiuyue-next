import { chromium } from 'playwright';

async function diagnose() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const loginResponse = await page.request.post('http://localhost:3000/api/core/login', {
    data: { name: 'admin', password: 'admin123' },
    headers: { 'Content-Type': 'application/json' }
  });
  const loginData = await loginResponse.json();

  if (loginData.data?.session_id) {
    await page.context().addInitScript((t, u) => {
      localStorage.setItem('session_id', t);
      localStorage.setItem('user', JSON.stringify(u));
    }, loginData.data.session_id, loginData.data.user);
  }

  // 1. 获取 services 详细列表
  const servicesRes = await page.request.get('http://localhost:3000/api/updater/services');
  const servicesData = await servicesRes.json();

  console.log('📊 所有服务状态:\n');
  console.log('name'.padEnd(25), 'type'.padEnd(15), 'status'.padEnd(10), 'health');
  console.log('-'.repeat(70));
  for (const s of servicesData.services) {
    console.log(
      s.name.padEnd(25),
      s.type.padEnd(15),
      s.status.padEnd(10),
      s.health
    );
  }

  // 2. 看 history
  const historyRes = await page.request.get('http://localhost:3000/api/updater/history');
  const history = await historyRes.json();
  console.log(`\n📜 历史记录数: ${Array.isArray(history) ? history.length : '非数组'}`);
  if (Array.isArray(history)) {
    for (const h of history) {
      console.log(`   ${h.timestamp} ${h.event} ${h.commit?.substring(0, 8)} ${h.message}`);
    }
  }

  // 3. 看 log projects API
  console.log('\n🔍 日志相关 API 排查:');
  const logApis = [
    '/api/core/log/projects',
    '/api/core/log/list',
    '/api/core/log/services',
    '/api/log/projects',
  ];
  for (const path of logApis) {
    try {
      const res = await page.request.get(`http://localhost:3000${path}`);
      const body = await res.text();
      console.log(`   ${path} [${res.status()}]: ${body.substring(0, 100)}`);
    } catch (e) {
      console.log(`   ${path}: ❌ ${e.message}`);
    }
  }

  await browser.close();
}

diagnose();
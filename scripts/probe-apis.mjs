/**
 * 直接探测前端用到的全部 API 路径,定位哪些会 404。
 * 不走 UI,比 Playwright 走页快 50 倍。
 */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const BACKEND = 'http://10.9.1.2:10005';

const CLIENT_PREFIX = {
  adminClient: '/api/core',
  contentClient: '/api/content',
  rewardClient: '/api/core',
  wxClient: '/api/core',
  spiderClient: '/api/spider',
  imClient: '/api/realtime',
  accountClient: '/api/core',
  homeClient: '/api/content/home',
};

const files = execSync("grep -lE 'adminClient|contentClient|rewardClient|wxClient|spiderClient|imClient|accountClient|homeClient' src/apis/*.ts", { encoding: 'utf8' })
  .split('\n').filter(Boolean);

// 收集 client → path 映射
const calls = []; // {client, method, path}
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  // 找所有形如 client(`/path`, { method: 'POST', ... })
  const re = /(adminClient|contentClient|rewardClient|wxClient|spiderClient|imClient|accountClient|homeClient)\s*<\s*[^>]*\s*>\s*\(\s*(['"`])(\/[^'"`]*)\2\s*,?\s*(\{[^}]*\})?/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const client = m[1];
    const path = m[3];
    const opts = m[4] || '';
    const methodMatch = opts.match(/method:\s*['"`]([A-Z]+)['"`]/);
    const method = methodMatch ? methodMatch[1] : 'GET';
    calls.push({ file: f.replace('src/apis/', ''), client, method, path });
  }
}

const dedup = new Map();
for (const c of calls) {
  const k = `${c.client}|${c.method}|${c.path}`;
  if (!dedup.has(k)) dedup.set(k, c);
}
const uniq = [...dedup.values()];
console.error(`[probe] ${uniq.length} unique (client,method,path) tuples`);

async function login() {
  const res = await fetch(`${BACKEND}/api/core/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'admin', password: 'admin123' }),
  });
  const j = await res.json();
  if (!j.data?.token) throw new Error('login failed');
  return j.data.token;
}

const token = await login();

const results = [];
const CONC = 8;
async function probeOne(c) {
  const url = `${BACKEND}${CLIENT_PREFIX[c.client] || '/api/core'}${c.path}`;
  try {
    const r = await fetch(url, {
      method: c.method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: c.method === 'GET' ? undefined : '{}',
    });
    const s = r.status;
    const txt = (await r.text()).slice(0, 150);
    return { ...c, url, status: s, body: txt };
  } catch (e) {
    return { ...c, url, status: 0, error: String(e).slice(0, 100) };
  }
}

const queue = [...uniq];
async function worker() {
  while (queue.length) {
    const c = queue.shift();
    if (!c) break;
    const r = await probeOne(c);
    process.stdout.write(`  ${r.status} ${r.method} ${r.path}\n`);
    results.push(r);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));

const errs = results.filter((r) => r.status === 404 || r.status === 0 || (r.status >= 500));
writeFileSync('/tmp/qingqiuyue-probe-report.json', JSON.stringify(results, null, 2));
writeFileSync('/tmp/qingqiuyue-probe-404s.json', JSON.stringify(errs, null, 2));
console.error(`\n[done] ${results.length} probed, ${errs.length} bad (404/0/5xx). Reports:`);
console.error('  /tmp/qingqiuyue-probe-report.json');
console.error('  /tmp/qingqiuyue-probe-404s.json');

// 客户端(Tauri)打包用的前端构建:静态导出到 out/,并把接口 / WebSocket 指向线上网关。
// 客户端页面跑在 http://tauri.localhost(Windows/Android)或 tauri://localhost(macOS/iOS)上,
// 相对路径的 /api、/ws 会落到应用自身,所以两个地址都必须是绝对的。
// 需要指向其他环境时,用同名环境变量覆盖,例如:
//   NEXT_PUBLIC_API_BASE_URL=https://test.example.com pnpm app:windows
// 由 src-tauri/tauri.conf.json 的 beforeBuildCommand 调用,也可以单独运行。
import { spawnSync } from 'node:child_process';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://qingqiuyue.com';
// 显式传入的值优先于 .env.local(那里的 NEXT_PUBLIC_WS_BASE 是开发用的内网地址)
const wsBase = process.env.NEXT_PUBLIC_WS_BASE || apiBase.replace(/^http/, 'ws');

console.log(`[app-frontend] NEXT_PUBLIC_API_BASE_URL=${apiBase}`);
console.log(`[app-frontend] NEXT_PUBLIC_WS_BASE=${wsBase}`);

const result = spawnSync('pnpm', ['exec', 'next', 'build'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    NEXT_PUBLIC_API_BASE_URL: apiBase,
    NEXT_PUBLIC_WS_BASE: wsBase,
    // 让 next.config.ts 打开 trailingSlash:客户端里的页面必须是 xxx/index.html,
    // 否则 Tauri 找不到 key 会回退到根 index.html,硬加载任何二级路由都是白屏(详见 next.config.ts)
    NEXT_CLIENT_BUILD: '1',
    NEXT_TELEMETRY_DISABLED: '1',
  },
});

process.exit(result.status ?? 1);

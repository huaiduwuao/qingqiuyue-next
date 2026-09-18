// 客户端(Tauri)打包用的前端构建:静态导出到 out/,并把接口 / WebSocket 指向线上网关。
// 客户端页面跑在 http://tauri.localhost(Windows/Android)或 tauri://localhost(macOS/iOS)上,
// 相对路径的 /api、/ws 会落到应用自身,所以两个地址都必须是绝对的。
// 需要指向其他环境时,用同名环境变量覆盖,例如:
//   NEXT_PUBLIC_API_BASE_URL=https://test.example.com pnpm app:windows
// 由 src-tauri/tauri.conf.json 的 beforeBuildCommand 调用,也可以单独运行。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

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

if (result.status !== 0) process.exit(result.status ?? 1);

// ─────────────────────────────────────────────────────────────────────────────
// 导出目录瘦身:out/ 会被 Tauri 整个压进二进制,而且是每个 ABI 一份。
//
// public/ort-wasm/ 放着 8 个 ONNX Runtime 运行时(136 MB),但真正会被加载的只有一个:
// 装在 node_modules 里的是 onnxruntime-web 1.18,它按 (simd, threaded) 选文件 ——
//   simd ? (threaded ? ort-wasm-simd-threaded.wasm : ort-wasm-simd.wasm) : …
// wake-word.ts 里 numThreads = 1,所以取的是 ort-wasm-simd.wasm。
// 另外那 6 个(jsep/jspi/asyncify 变体,以及 .mjs —— 那是更新版 ORT 的文件名)在 1.18
// 下永远不会被请求。网站照旧全都留着,只有客户端包不带。
const KEEP_WASM = new Set(['ort-wasm-simd.wasm', 'ort-wasm-simd-threaded.wasm']);
const out = path.resolve('out');

function rm(p) {
  if (!fs.existsSync(p)) return 0;
  const size = fs.statSync(p).size;
  fs.rmSync(p);
  return size;
}

let saved = 0;
const ortDir = path.join(out, 'ort-wasm');
if (fs.existsSync(ortDir)) {
  for (const name of fs.readdirSync(ortDir)) {
    if (!KEEP_WASM.has(name)) saved += rm(path.join(ortDir, name));
  }
}
// 数字人流水线的测试素材,产品里没有任何地方引用
saved += rm(path.join(out, 'avatars', 'person-test.mp4'));

console.log(`[app-frontend] 客户端包剔除未使用的静态资源:${(saved / 1048576).toFixed(1)} MB`);


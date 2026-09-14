# Tauri 客户端

清秋月客户端 — Tauri v2 外壳 + 复用本仓库 Next.js 前端(静态导出)。
**各平台打包步骤见 [TAURI_BUILD.md](TAURI_BUILD.md)。**

## 架构

```
qingqiuyue-next/
├── src/tauri/api.ts              # 前端调用 Rust 命令的封装
├── scripts/app-frontend-build.mjs # 客户端用的前端构建(静态导出 + 线上网关地址)
├── out/                          # 静态导出产物,打包进客户端
└── src-tauri/
    ├── tauri.conf.json           # 应用名、版本号、窗口、各平台打包配置
    ├── Cargo.toml
    ├── src/lib.rs                # Rust 命令(系统信息、打开外链等)
    ├── capabilities/             # 前端可调用的权限
    ├── icons/                    # 各平台图标(`pnpm tauri icon <1024px png>` 重新生成)
    └── gen/
        ├── android/              # Android 原生工程(Manifest、签名、TV banner)
        └── apple/                # iOS Xcode 工程,Mac 上 `pnpm app:ios:init` 生成
```

客户端里页面由 Tauri 从本地加载,接口和 WebSocket 通过构建时写入的
`NEXT_PUBLIC_API_BASE_URL` / `NEXT_PUBLIC_WS_BASE` 直连线上网关(默认 `https://qingqiuyue.com`)。
`lib.rs` 里的 `get_api_base` / `set_api_base` 目前前端没有使用。

## 开发

```bash
pnpm install
pnpm app:dev      # 自动启动 next dev,并打开加载 localhost:3000 的桌面窗口
```

前端改动 HMR 生效;Rust 改动会自动重编译重启。

## 暴露给前端的命令

```typescript
import { getSystemInfo, openExternal, getVersion, isDev } from '@/tauri/api';

const sys = await getSystemInfo();       // { os, arch, ... }
await openExternal('https://example.com'); // 用系统浏览器打开
```

## 已知限制

1. 静态导出:依赖服务端渲染 / API 路由的功能在客户端内不可用,所有数据都走网关接口。
2. 电视端没有遥控器方向键焦点导航,见 TAURI_BUILD.md 的 Android TV 一节。
3. 未签名的 Windows / macOS 安装包会被 SmartScreen / Gatekeeper 提示,签名方式见 TAURI_BUILD.md。

# Tauri 桌面端

清秋月桌面端 — Tauri v2 + 复用 qingqiuyue-next 前端

## 架构

```
qingqiuyue-next/
├── src/                      # Next.js 源码
│   └── tauri/
│       └── api.ts            # Tauri API 调用（替代 wailsjs）
├── src-tauri/                 # ← Tauri Rust 后端
│   ├── Cargo.toml            # Rust 依赖
│   ├── tauri.conf.json       # Tauri 配置
│   ├── build.rs              # 构建脚本
│   ├── src/
│   │   ├── lib.rs           # 应用逻辑 + Tauri 命令
│   │   └── main.rs          # 入口点
│   ├── capabilities/         # 权限配置
│   └── icons/                # 应用图标
├── out/                      # pnpm build 产出
└── desktop/                  # (旧 Wails 代码，待删除)
```

## 前置条件

- **Node.js** 18+
- **Rust** 1.70+
- **pnpm** 8+
- 各平台 SDK:
  - **macOS**: Xcode CLI tools (`xcode-select --install`)
  - **Windows**: WebView2 Runtime (Win11 自带, Win10 需装)
  - **Linux**: `webkit2gtk-4.1` + `gtk-3`
  - **Android**: Android Studio / Android SDK
  - **iOS**: Xcode

## 安装

```bash
cd qingqiuyue-next

# 安装 Rust（如果没有）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Tauri CLI
pnpm add -D @tauri-apps/cli@latest

# 安装 Tauri API
pnpm add @tauri-apps/api@latest
```

## 开发流程

```bash
# 1. 启动 Next.js dev server (终端 1)
cd qingqiuyue-next
pnpm dev
# → http://localhost:3000

# 2. 启动 Tauri dev 模式 (终端 2)
pnpm tauri dev
# → 自动打开桌面窗口，加载 localhost:3000
# → 前端代码修改后 HMR 自动生效
# → Rust 代码修改后自动重编译重启
```

## 生产构建

```bash
# 仅桌面端 (Windows/macOS/Linux)
pnpm tauri build

# 打包移动端
pnpm tauri android build    # Android APK/AAB
pnpm tauri ios build       # iOS（需 macOS + Xcode）
```

### 多平台交叉编译

在 Windows 上打包 macOS 应用：
```bash
# 安装 macOS 交叉编译工具链
rustup target add aarch64-apple-darwin x86_64-apple-darwin
cargo install cross

cross build --target aarch64-apple-darwin --release
```

## 暴露给前端的 API

前端通过 `@tauri-apps/api/core` 调用 Rust 命令：

```typescript
import { getSystemInfo, getApiBase, openExternal, getVersion, isDev } from '@/tauri/api';

// 系统信息
const sys = await getSystemInfo();
console.log('OS:', sys.os, 'Arch:', sys.arch);

// API 地址
const apiBase = await getApiBase();
// 用作 axios baseURL

// 用系统浏览器打开 URL
await openExternal('https://example.com');

// 版本
const version = await getVersion();

// 是否开发模式
const dev = await isDev();
```

## 配置

API 地址默认 `http://localhost:9080`，存储在：

| 平台 | 路径 |
|------|------|
| Windows | `%LOCALAPPDATA%\qingqiuyue-desktop\config.json` |
| macOS | `~/Library/Application Support/qingqiuyue-desktop/config.json` |
| Linux | `~/.config/qingqiuyue-desktop/config.json` |

## 已知限制

1. **静态导出约束**: Next.js 16 部分 SSR 功能（动态路由 + cookies）会丢失。开发期用 `tauri dev`，生产期考虑 Tauri 的更好 SSR 支持。
2. **macOS 签名**: 未签名 .app 会被 Gatekeeper 拦截，需企业证书 + `codesign --deep --sign`
3. **首次启动配置**: `getApiBase()` 当前 hardcode 返回 `localhost:9080`，生产应读配置文件，首次启动 UI 引导用户填入

## 排错

```bash
# 检查 Tauri 环境
pnpm tauri info

# 清理缓存重新构建
pnpm tauri build --no-bundle
rm -rf src-tauri/target
```

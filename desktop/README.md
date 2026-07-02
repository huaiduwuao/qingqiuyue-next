# qingqiuyue-desktop

清秋月桌面端 — Wails v3 + 复用 qingqiuyue-next 前端

## 架构

```
qingqiuyue-next/             # Next.js 项目
├── (所有 page / api / component)
├── out/                     # next build 静态导出
└── desktop/                 # ← 当前目录
    ├── go.mod               # 独立 Go module
    ├── main.go              # Wails 入口
    ├── app.go               # 暴露给前端的系统 API
    ├── assets.go            # embed ../out 的资源
    ├── wails.json           # Wails 配置
    ├── frontend_dist/       # build 时由 ../out 复制
    └── build.sh             # 一键构建
```

## 前置条件

- Go 1.23+
- Wails v3 CLI:`go install github.com/wailsapp/wails/v3/cmd/wails3@latest`
- 各平台依赖:
  - **macOS**: Xcode CLI tools (`xcode-select --install`)
  - **Windows**: WebView2 Runtime (Win11 自带,Win10 需装)
  - **Linux**: `webkit2gtk-4.1` + `gtk-3`

## 开发流程

```bash
# 1. 启动 Next.js dev server (终端 1)
cd ..
pnpm install
pnpm dev
# → http://localhost:3000

# 2. 启动 Wails dev 模式 (终端 2)
cd desktop
wails3 dev
# → 自动打开桌面窗口,加载 localhost:3000
# → 前端代码修改后 HMR 自动生效
# → Go 代码修改后 wails 会自动重编译重启
```

## 生产构建

```bash
cd desktop
bash build.sh windows/amd64    # Windows .exe
bash build.sh darwin/universal # macOS .app (Intel + Apple Silicon)
bash build.sh darwin/arm64     # macOS Apple Silicon 单独
bash build.sh linux/amd64      # Linux AppImage

# 输出:desktop/build/bin/qingqiuyue-desktop{.exe|.app}
```

## 暴露给前端的 API

启动后,前端可通过 `window.qq.App.*` 调用(由 Wails 自动生成 TS 绑定):

| 方法 | 用途 |
|------|------|
| `SystemInfo()` | 返回 OS/Arch/NumCPU,前端能力检测 |
| `GetAPIBase()` | 返回后端 API 网关地址 |
| `SetAPIBase(url)` | 写入配置(待补持久化) |
| `OpenExternal(url)` | 用系统浏览器打开 URL |
| `GetVersion()` | 应用版本号 |
| `IsDev()` | 是否开发模式 |
| `ShowToast(msg)` | 系统通知(简化,待接 native) |

前端 TS 调用示例:

```typescript
import { SystemInfo, GetAPIBase, OpenExternal } from '../wailsjs/go/qq/App';

const sysInfo = await SystemInfo();
console.log('Running on:', sysInfo.os, sysInfo.arch);

const apiBase = await GetAPIBase();
// 用作 axios baseURL
```

## 已知限制

1. **静态导出约束**:Next.js 16 部分 SSR 功能(动态路由 + cookies)会丢失。如需保留,改用 `wails dev` 模式开发 + 生产期考虑 Tauri(更好的 SSR 支持)
2. **macOS 签名**:未签名 .app 会被 Gatekeeper 拦截,需企业证书 + `codesign --deep --sign`
3. **首次启动配置**:`GetAPIBase()` 当前 hardcode 返回 `localhost:9080`,生产应读 `~/Library/Application Support/qingqiuyue-desktop/config.json`,首次启动 UI 引导用户填入

## 排错

```bash
# Wails 检测环境
wails3 doctor

# 详细日志
WAILS_LOG_LEVEL=debug wails3 dev
```
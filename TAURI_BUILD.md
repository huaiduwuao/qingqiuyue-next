# Tauri 多平台构建指南

## 平台支持

| 平台 | 状态 | 输出文件 | 构建命令 |
|------|------|----------|----------|
| Windows | ✅ 已完成 | `.exe` / `.msi` | `pnpm tauri build --target x86_64-pc-windows-msvc` |
| macOS | 🔨 需要 Mac | `.app` / `.dmg` | `pnpm tauri build --target x86_64-apple-darwin` |
| iOS | 🔨 需要 Mac | `.ipa` / `.app` | `pnpm tauri build --target aarch64-apple-ios` |
| Android | ✅ 已完成 | `.apk` / `.aab` | `pnpm tauri build --target universal` |

## 环境要求

### Windows 构建
- Windows 10/11
- [Rust](https://rustup.rs/)
- [Node.js 18+](https://nodejs.org/)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/)
- [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

### macOS/iOS 构建
- macOS 10.15+
- Xcode 15+
- Rust
- Node.js 18+
- Apple Developer 账号（iOS 真机部署需要）

### Android 构建
- Windows/macOS/Linux
- Android SDK (API 24+)
- NDK
- Java JDK 17+

## 快速开始

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm tauri dev

# 构建所有平台
pnpm tauri build

# 构建指定平台
pnpm tauri build --target x86_64-pc-windows-msvc
pnpm tauri build --target x86_64-apple-darwin
pnpm tauri build --target aarch64-apple-ios
```

## 构建输出位置

```
src-tauri/target/release/bundle/
├── windows/          # Windows 安装包
│   ├── qingqiuyue_0.1.0_x64-setup.exe
│   └── qingqiuyue_0.1.0_x64.msi
├── macos/            # macOS 应用
│   └── qingqiuyue.app
├── ios/              # iOS 应用
│   └── qingqiuyue.ipa
└── android/          # Android 应用 (在 gen/android/ 目录)
    └── app/build/outputs/apk/
```

## Windows 构建

Windows 构建已在本地完成：

```bash
pnpm tauri build --target x86_64-pc-windows-msvc
```

输出：`src-tauri/target/release/qingqiuyue-desktop.exe`

## macOS 构建

在 Mac 上执行：

```bash
# 安装 Rust (如果未安装)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Xcode Command Line Tools
xcode-select --install

# 克隆项目
git clone https://your-repo/qingqiuyue-next.git
cd qingqiuyue-next

# 安装依赖
pnpm install

# 构建 macOS
pnpm tauri build --target x86_64-apple-darwin

# 或构建通用版本 (Intel + Apple Silicon)
pnpm tauri build --target universal-apple-darwin
```

输出：`src-tauri/target/release/bundle/macos/*.app`

## iOS 构建

### 模拟器构建 (免费，无需签名)

```bash
pnpm tauri build --target aarch64-apple-ios
```

### 真机部署

需要配置签名：

1. 在 [Apple Developer Portal](https://developer.apple.com/) 创建 App ID
2. 在 Xcode 中添加签名证书
3. 更新 `tauri.conf.json` 中的 iOS 配置：

```json
"ios": {
  "signingIdentity": "Apple Development: your-name (TEAM_ID)",
  "minimumOSVersion": "13.0"
}
```

4. 构建：
```bash
pnpm tauri build --target aarch64-apple-ios
```

## Android 构建

Android 构建已在本地完成，使用签名密钥 `src-tauri/qingqiuyue.keystore`。

### 重新构建

```bash
# Debug 版本 (自动签名)
pnpm tauri android build --debug

# Release 版本 (使用配置的签名)
pnpm tauri android build
```

### APK 位置

- Release 签名版：`src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-signed.apk`
- AAB (Google Play)：`src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`

## CI/CD 自动构建

推荐使用 GitHub Actions 跨平台构建：

```yaml
# .github/workflows/build.yml
name: Build

on:
  push:
    tags:
      - 'v*'

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm tauri build

  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm tauri build

  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm tauri android build
```

## 签名密钥管理

### Android 签名密钥
- 密钥库：`src-tauri/qingqiuyue.keystore`
- 别名：`qingqiuyue`
- **重要**：妥善保管密钥库，丢失后无法更新应用

### macOS 签名
- 使用 Apple Developer 证书
- 或使用 ad-hoc 签名进行测试

### iOS 签名
- 需要 Apple Developer 账号
- 配置证书和描述文件

## 故障排除

### Windows
- 确保安装 WebView2
- 使用 PowerShell 而非 Git Bash 运行构建命令

### macOS/iOS
- 确保 Xcode Command Line Tools 已安装
- 确保 Rust 目标平台已添加：`rustup target add aarch64-apple-ios x86_64-apple-ios`

### Android
- 确保 ANDROID_HOME 和 JAVA_HOME 已设置
- 使用代理解决 Gradle 下载问题（国内环境）

## 更新日志

- v1.0.0: 初始版本，支持 Windows/macOS/iOS/Android

# 客户端多平台构建指南

清秋月客户端 = Tauri v2 外壳 + 本仓库 Next.js 静态导出(`out/`)。所有平台共用同一套前端,
接口统一走线上网关 `https://qingqiuyue.com`。架构和开发说明见 [TAURI.md](TAURI.md)。

## 一览

| 平台 | 在哪台机器上构建 | 命令 | 产物 |
|------|------------------|------|------|
| Windows | Windows 10/11 | `pnpm app:windows` | `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe`、`bundle/msi/*.msi` |
| macOS | macOS(Apple Silicon 或 Intel) | `pnpm app:macos` | `src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg`、`bundle/macos/*.app` |
| Android | Windows / macOS / Linux | `pnpm app:android` | `src-tauri/gen/android/app/build/outputs/apk/universal/release/*.apk`、`bundle/universalRelease/*.aab` |
| Android TV | Windows / macOS / Linux | `pnpm app:android:tv` | 同上 `apk/universal/release/*.apk`(仅 arm64 + armv7,体积更小) |
| iOS | macOS + Xcode + Apple 开发者账号 | `pnpm app:ios` | `src-tauri/gen/apple/build/arm64/*.ipa` |

其它脚本:

| 命令 | 作用 |
|------|------|
| `pnpm app:info` | 检查本机 Rust / WebView / SDK 环境,构建失败先跑它 |
| `pnpm app:frontend` | 只构建前端静态导出(每个构建命令都会自动先跑它) |
| `pnpm app:dev` | 桌面开发模式,窗口加载 `localhost:3000`,支持 HMR |
| `pnpm app:android:dev` / `pnpm app:ios:dev` | 在模拟器/真机上跑开发版 |
| `pnpm app:ios:init` | 首次在 Mac 上生成 Xcode 工程 `src-tauri/gen/apple` |

> 不能跨系统打包:`.dmg` / `.ipa` 只能在 Mac 上构建,`.msi` / `.exe` 只能在 Windows 上构建。
> 没有 Mac 时用 GitHub Actions(见文末)。

## 通用前置条件

1. **Node.js 22** + **pnpm 9**,在仓库根目录执行 `pnpm install`
2. **Rust stable**:<https://rustup.rs>(Windows 下选默认的 MSVC 工具链)
3. 版本号只改 `src-tauri/tauri.conf.json` 的 `version`,Android 的 versionCode 由它自动推导

### 前端构建做了什么

`pnpm app:frontend`(`scripts/app-frontend-build.mjs`)会执行 `next build` 静态导出到 `out/`,并写死两个地址:

| 变量 | 默认值 | 用途 |
|------|--------|------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://qingqiuyue.com` | HTTP 接口、媒体资源 |
| `NEXT_PUBLIC_WS_BASE` | 由上一项推导出 `wss://qingqiuyue.com` | WebSocket |

客户端页面的源是 `http://tauri.localhost`(Windows/Android)或 `tauri://localhost`(macOS/iOS),
相对路径 `/api` 会落空,所以必须用绝对地址;网关已对这两个源放行 CORS。
要打测试环境的包,在命令前设置同名环境变量即可覆盖(显式设置的值优先于 `.env.local`)。

---

## Windows

**前置**

- [Visual Studio 2022 Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/),勾选「使用 C++ 的桌面开发」(提供 MSVC 链接器和 Windows SDK)
- WebView2:Win11 自带;Win10 缺失时安装包会自动下载引导程序

**构建**

```powershell
rustup target add x86_64-pc-windows-msvc
pnpm app:windows
```

同时生成 NSIS 安装包(`*-setup.exe`,推荐分发)和 MSI。MSI 已设 `wix.language = zh-CN`,
否则中文产品名「清秋月」会让 WiX 报 code page 1252 错误。

**签名(可选)**:未签名的 exe 会触发 SmartScreen「未知发布者」提示。有代码签名证书时,在
`tauri.conf.json` 的 `bundle.windows` 下配置 `certificateThumbprint` / `signCommand`。

## macOS

**前置**

- Xcode(或 `xcode-select --install` 装命令行工具)
- `rustup target add aarch64-apple-darwin x86_64-apple-darwin`

**构建**

```bash
pnpm app:macos
```

产出 Universal 二进制(同时支持 Apple Silicon 和 Intel),最低 macOS 12。

**签名与公证**

| 场景 | 做法 |
|------|------|
| 自己测试 | `APPLE_SIGNING_IDENTITY=- pnpm app:macos`(ad-hoc 签名)。别人下载后会被 Gatekeeper 拦截,需右键「打开」或执行 `xattr -cr /Applications/清秋月.app` |
| 对外分发 | 需要 Apple Developer Program($99/年)的 Developer ID 证书,设置 `APPLE_SIGNING_IDENTITY`、`APPLE_ID`、`APPLE_PASSWORD`(App 专用密码)、`APPLE_TEAM_ID` 后构建,Tauri 会自动签名 + 公证 |

## Android

**前置**

- JDK 17(Android Studio 自带的 JBR 也行)
- Android SDK:SDK Platform 36、Build-Tools 35、NDK r27(`ndk;27.0.12077973`),可用 Android Studio 的 SDK Manager 或 `sdkmanager` 安装
- 环境变量:

  ```powershell
  # Windows 示例,按实际路径调整
  $env:JAVA_HOME   = "C:\Program Files\Android\Android Studio\jbr"
  $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
  $env:NDK_HOME    = "$env:ANDROID_HOME\ndk\27.0.12077973"
  ```

- `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`

**签名**

release 包的签名信息从 `src-tauri/gen/android/keystore.properties` 读取(已 gitignore,不要提交):

```properties
storeFile=D:/keys/qingqiuyue-release.jks
storePassword=******
keyAlias=qingqiuyue
keyPassword=******
```

也可以用环境变量 `ANDROID_KEYSTORE_PATH` / `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD`(CI 就是这么用的)。
两者都没有时照样能构建,但得到的是未签名包,不能直接安装。

生成新密钥:

```bash
keytool -genkeypair -v -keystore qingqiuyue-release.jks -alias qingqiuyue -keyalg RSA -keysize 2048 -validity 10000
```

> ⚠️ 仓库里已提交过 `src-tauri/qingqiuyue.keystore`,等同于泄露,不要再用它签正式包。
> 密钥丢失后同一包名的应用将无法再升级,务必离线备份。

**构建**

```bash
pnpm app:android
```

- `*.apk`:官网直接下载安装,包含 arm64 / armv7 / x86 / x86_64 四种 ABI
- `*.aab`:上传 Google Play 或国内应用商店
- 最低 Android 7.0(API 24)

## Android TV

TV 和手机是**同一个应用**:Manifest 已声明 `LEANBACK_LAUNCHER`、TV 桌面横幅
`res/drawable-xhdpi/tv_banner.png`(320×180),且不强制触屏,所以手机包装到电视上也会出现在 TV 桌面。

```bash
pnpm app:android:tv   # 只打 arm64 + armv7,电视基本都是 ARM,包更小
```

安装到电视(电视需开启「开发者选项 → USB/网络调试」):

```bash
adb connect <电视IP>:5555
adb install -r src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
```

> 当前限制:界面还没有做遥控器方向键(D-pad)焦点导航,只能用鼠标/空鼠操作。
> Google TV / 国内电视应用商店审核会要求遥控器可用,上架前需先完成这部分适配。
> Apple TV、三星 Tizen、LG webOS 不在 Tauri 支持范围内。

## iOS

**前置**

- Mac + Xcode 15+(含 iOS SDK),`rustup target add aarch64-apple-ios aarch64-apple-ios-sim`
- Apple Developer Program 账号;设置团队 ID:`export APPLE_DEVELOPMENT_TEAM=XXXXXXXXXX`
- 首次执行 `pnpm app:ios:init` 生成 `src-tauri/gen/apple`,然后把它提交入库(Info.plist、权限配置都在里面改)

**构建**

```bash
pnpm app:ios --export-method app-store-connect   # 上传 App Store / TestFlight
pnpm app:ios --export-method release-testing     # Ad Hoc,装到已登记 UDID 的设备
pnpm app:ios:dev                                 # 模拟器调试
```

iOS 不能在官网直接下载安装,只能走 App Store / TestFlight(上传用 Xcode 或 Transporter)。

---

## GitHub Actions 自动构建

`.github/workflows/build.yml`:

- 每次 push / PR:只做前端检查(`tsc`;ESLint 暂不拦截)
- 打 `v*` tag 或在 Actions 页面手动触发:构建 Windows、macOS、Android;tag 构建会把安装包发布到 GitHub Release
- iOS:只有在仓库 **Variables** 里配置了 `APPLE_DEVELOPMENT_TEAM` 才会运行

```bash
# 发版:先改 src-tauri/tauri.conf.json 的 version,再
git tag v1.0.0 && git push origin v1.0.0
```

需要在仓库 Settings → Secrets and variables → Actions 配置的项(都不配也能出未签名包):

| 名称 | 类型 | 用途 |
|------|------|------|
| `ANDROID_KEYSTORE_BASE64` | Secret | `base64 -w0 release.jks` 的结果 |
| `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD` | Secret | Android 签名 |
| `APPLE_CERTIFICATE`(base64 的 .p12)/ `APPLE_CERTIFICATE_PASSWORD` / `APPLE_SIGNING_IDENTITY` | Secret | macOS Developer ID 签名 |
| `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` | Secret | macOS 公证 |
| `APPLE_DEVELOPMENT_TEAM` | Variable | iOS 团队 ID,配置后才构建 iOS |
| `IOS_CERTIFICATE` / `IOS_CERTIFICATE_PASSWORD` / `IOS_MOBILE_PROVISION` | Secret | iOS 发布证书与描述文件(base64) |

## 发布到官网下载页

CI 的 release job 会把安装包统一改名后发布到 GitHub Release:

| 文件 | 平台 |
|------|------|
| `qingqiuyue-windows-x64-setup.exe` / `qingqiuyue-windows-x64.msi` | Windows |
| `qingqiuyue-macos-universal.dmg` | macOS |
| `qingqiuyue-android.apk` / `qingqiuyue-android.aab` | Android / Android TV / 应用商店 |

`/download` 页面默认链接到 `https://github.com/huaiduwuao/qingqiuyue-next/releases/latest/download/<文件名>`,
**每次打 tag 发版后自动指向新版本,不需要重新部署网站**(页面上显示的版本号 `VERSION` 需要手动改)。
要换成其他下载地址(比如国内 CDN / MinIO 镜像),在网站构建时设置同名环境变量覆盖:
`NEXT_PUBLIC_CLIENT_URL_WINDOWS` / `_MACOS` / `_ANDROID` / `_IOS`;iOS 默认不显示,上架后填 App Store 链接。

## 常见问题

| 现象 | 处理 |
|------|------|
| `linker link.exe not found` | 没装 VS Build Tools 的 C++ 组件 |
| MSI 报 `LGHT0311 ... code page '1252'` | 确认 `bundle.windows.wix.language` 为 `zh-CN` |
| Android 报找不到 NDK | 设置 `NDK_HOME` 指向具体版本目录 |
| Gradle 依赖下载超时(国内) | 给 Gradle 配代理(`~/.gradle/gradle.properties` 的 `systemProp.https.proxyHost`)或镜像 |
| macOS 提示「已损坏,无法打开」 | 未公证的包被 Gatekeeper 拦截,见上文 macOS 签名 |
| `tauri ios` 提示 unrecognized subcommand | iOS 命令只在 macOS 上可用 |
| 客户端里接口 / WebSocket 连不上 | 检查构建日志开头打印的两个地址是否为线上网关 |

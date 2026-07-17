# GitHub Secrets 配置指南

本项目使用 GitHub Actions 进行跨平台 CI/CD 构建，以下是需要的 secrets 配置。

## 自动配置的 Secrets（无需手动设置）

- `GITHUB_TOKEN` - GitHub 自动提供，用于 API 操作

## 需要手动配置的 Secrets

### Apple 签名（iOS/macOS）

如果需要发布到 App Store 或签名正式版本，需要配置：

| Secret 名称 | 说明 | 获取方式 |
|-------------|------|----------|
| `APPLE_SIGNING_IDENTITY` | 签名证书名称 | Xcode -> Preferences -> Accounts -> 导出证书名称 |
| `APPLE_TEAM_ID` | Team ID | Apple Developer Portal |
| `KEYCHAIN_PASSWORD` | 钥匙串密码 | 用于解锁钥匙串 |

### Android 签名（正式发布）

如果你不使用项目中的 `qingqiuyue.keystore`，可以使用独立的签名配置：

| Secret 名称 | 说明 |
|-------------|------|
| `ANDROID_KEYSTORE_BASE64` | 密钥库 Base64 编码 |
| `ANDROID_KEYSTORE_PASSWORD` | 密钥库密码 |
| `ANDROID_KEY_ALIAS` | 密钥别名 |
| `ANDROID_KEY_PASSWORD` | 密钥密码 |

## 配置方法

1. 进入 GitHub 仓库 -> Settings -> Secrets and variables -> Actions
2. 点击 "New repository secret"
3. 输入名称和值

## 本地测试

在本地测试 CI 配置：

```bash
# 安装 act（GitHub Actions 本地运行器）
brew install act

# 运行构建 workflow
act -W .github/workflows/build.yml
```

## 示例：配置 iOS 签名

```bash
# 1. 导出证书（需要 Mac）
security find-identity -v -p codesigning

# 2. 导出为 p12 文件
security export -k ~/Library/Keychains/login.keychain-db -t identity -P "your-password" -o Certificates.p12

# 3. 在 GitHub 设置 secrets
# APPLE_SIGNING_IDENTITY = "Apple Development: Your Name (TEAMID)"
```

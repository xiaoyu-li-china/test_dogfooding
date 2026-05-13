# GitHub Actions CI/CD 配置指南

本指南将帮助你配置 Tauri 应用的跨平台自动构建和代码签名。

## 目录

1. [触发构建](#1-触发构建)
2. [GitHub Secrets 配置](#2-github-secrets-配置)
3. [Tauri 更新签名密钥](#3-tauri-更新签名密钥)
4. [Windows 代码签名](#4-windows-代码签名)
5. [macOS 代码签名和公证](#5-macos-代码签名和公证)
6. [构建产物说明](#6-构建产物说明)

---

## 1. 触发构建

### 方式一：通过 Git 标签（推荐）

```bash
# 创建版本标签
git tag -a v1.0.0 -m "Release v1.0.0"

# 推送标签到 GitHub
git push origin v1.0.0
```

当推送以 `v` 开头的标签时，GitHub Actions 会自动触发构建流程。

### 方式二：手动触发

在 GitHub 仓库页面：
1. 点击 **Actions** 标签
2. 选择 **Build and Release** 工作流
3. 点击 **Run workflow** 按钮
4. 选择分支并运行

手动触发的构建会创建一个 `dev-release` 的预发布版本。

---

## 2. GitHub Secrets 配置

在 GitHub 仓库中，进入 **Settings** → **Secrets and variables** → **Actions**，然后添加以下 Secrets：

| Secret 名称 | 必需 | 说明 |
|------------|------|------|
| `GITHUB_TOKEN` | ✅ | 自动提供，无需手动添加 |
| `TAURI_PRIVATE_KEY` | 可选 | Tauri 自动更新的私钥 |
| `TAURI_KEY_PASSWORD` | 可选 | Tauri 私钥密码（如果有） |
| `WINDOWS_CERTIFICATE` | 可选 | Windows 代码签名证书（Base64 编码） |
| `WINDOWS_CERTIFICATE_PASSWORD` | 可选 | Windows 证书密码 |
| `APPLE_CERTIFICATE` | 可选 | Apple 开发者证书（Base64 编码） |
| `APPLE_CERTIFICATE_PASSWORD` | 可选 | Apple 证书密码 |
| `APPLE_ID` | 可选 | Apple ID 邮箱 |
| `APPLE_PASSWORD` | 可选 | Apple 应用专用密码 |
| `APPLE_TEAM_ID` | 可选 | Apple 团队 ID |

---

## 3. Tauri 更新签名密钥

Tauri 支持自动更新功能，需要生成签名密钥。

### 生成密钥

```bash
# 使用 Tauri CLI 生成密钥对
npm run tauri key generate
```

这会生成两个文件：
- `tauri.key` - 私钥（保密，添加到 GitHub Secrets）
- `tauri.pub` - 公钥（放在 `src-tauri` 目录）

### 配置 Secrets

将私钥内容添加到 GitHub Secrets：

1. 复制 `tauri.key` 文件的全部内容
2. 在 GitHub Secrets 中创建 `TAURI_PRIVATE_KEY`，粘贴内容
3. 如果设置了密码，再创建 `TAURI_KEY_PASSWORD`

---

## 4. Windows 代码签名

### 4.1 获取代码签名证书

你需要购买一个 EV 或 OV 代码签名证书。推荐提供商：
- DigiCert
- Sectigo
- GlobalSign

### 4.2 导出为 PFX 格式

在 Windows 上，使用证书管理器导出证书：

```powershell
# 或者使用 openssl
openssl pkcs12 -export -out certificate.pfx -inkey private.key -in certificate.crt
```

### 4.3 Base64 编码证书

```powershell
# PowerShell
$certBytes = Get-Content -Path "certificate.pfx" -Encoding Byte
$base64Cert = [Convert]::ToBase64String($certBytes)
$base64Cert | Set-Content -Path "certificate-base64.txt"
```

```bash
# macOS/Linux
base64 -i certificate.pfx -o certificate-base64.txt
```

### 4.4 配置 GitHub Secrets

1. 创建 `WINDOWS_CERTIFICATE`：粘贴 `certificate-base64.txt` 的内容
2. 创建 `WINDOWS_CERTIFICATE_PASSWORD`：设置证书导出时的密码

### 4.5 工作流程

1. CI 从 Secrets 读取 Base64 编码的证书
2. 解码并保存为 PFX 文件
3. 导入到证书存储
4. 使用 `signtool.exe` 签名 .exe 和 .msi 文件
5. 添加时间戳（确保证书过期后仍然有效）

---

## 5. macOS 代码签名和公证

### 5.1 前置条件

1. **Apple 开发者账号** - 每年 $99
2. **Xcode** - 安装命令行工具
3. **App Store Connect API 密钥**（可选，用于公证）

### 5.2 创建 Apple 开发者证书

#### 步骤 1：创建 Certificate Signing Request (CSR)

```bash
openssl req -newkey rsa:2048 -nodes -keyout private.key -out CertificateSigningRequest.certSigningRequest -subj "/emailAddress=your@email.com, CN=Your Name, C=US"
```

#### 步骤 2：在 Apple Developer 网站创建证书

1. 访问 https://developer.apple.com/account/resources/certificates/list
2. 点击 **+** 创建新证书
3. 选择 **Developer ID Application**（用于分发）
4. 上传 CSR 文件
5. 下载生成的 `.cer` 文件

#### 步骤 3：导出为 P12 格式

```bash
# 导入证书到钥匙串
security import developerID.cer -k ~/Library/Keychains/login.keychain-db

# 导出为 P12
security export -k ~/Library/Keychains/login.keychain-db -t identities -f pkcs12 -P "yourpassword" -o certificate.p12
```

### 5.3 Base64 编码证书

```bash
base64 -i certificate.p12 -o certificate-base64.txt
```

### 5.4 创建 App 专用密码

1. 访问 https://appleid.apple.com
2. 登录你的 Apple ID
3. 进入 **App-Specific Passwords**
4. 点击 **Generate an app-specific password**
5. 输入描述（如 "GitHub Actions"）
6. 复制生成的密码

### 5.5 配置 GitHub Secrets

| Secret | 值 |
|--------|-----|
| `APPLE_CERTIFICATE` | certificate-base64.txt 的内容 |
| `APPLE_CERTIFICATE_PASSWORD` | P12 导出时的密码 |
| `APPLE_ID` | 你的 Apple ID 邮箱 |
| `APPLE_PASSWORD` | 应用专用密码 |
| `APPLE_TEAM_ID` | 开发者账号的 Team ID |

### 5.6 工作流程

1. CI 创建临时 Keychain
2. 导入 Apple 开发者证书
3. 设置 Keychain 为搜索优先级
4. 构建 Tauri 应用（自动签名）
5. 使用 `notarytool` 提交公证（如果配置了）
6. 等待公证完成后打包 DMG

---

## 6. 构建产物说明

每个平台会生成以下文件：

### Windows

| 文件 | 格式 | 说明 |
|------|------|------|
| `ScreenColorPicker-v1.0.0-x64.msi` | MSI | Windows Installer 安装包 |
| `ScreenColorPicker-v1.0.0-x64-setup.exe` | EXE | NSIS 安装程序（推荐） |

### macOS

| 文件 | 架构 | 说明 |
|------|------|------|
| `ScreenColorPicker-v1.0.0-x64.dmg` | x86_64 | Intel Mac 磁盘映像 |
| `ScreenColorPicker-v1.0.0-aarch64.dmg` | aarch64 | Apple Silicon (M1/M2/M3) 磁盘映像 |

### Linux

| 文件 | 格式 | 说明 |
|------|------|------|
| `ScreenColorPicker-v1.0.0-x86_64.AppImage` | AppImage | 便携式应用，无需安装 |
| `ScreenColorPicker-v1.0.0-amd64.deb` | DEB | Debian/Ubuntu 安装包 |

---

## 7. 常见问题

### Q: 构建失败，找不到图标文件？

确保 `src-tauri/icons/` 目录包含所需的图标文件。使用 `tauri icon` 命令生成：

```bash
npm run tauri icon path/to/your/icon.png
```

### Q: macOS 公证失败？

检查以下几点：
1. 证书是 **Developer ID Application** 类型，不是普通的开发证书
2. 应用的 bundle identifier (`com.screen.colorpicker`) 在你的账号下注册
3. 应用专用密码正确，不是 Apple ID 密码

### Q: Windows 签名后 SmartScreen 仍然警告？

这是正常的。EV 证书可以立即获得信任，OV 证书需要建立声誉（通常几天到几周）。

### Q: 如何测试签名？

**Windows:**
```powershell
# 检查签名
signtool verify /pa /v your-app.exe
```

**macOS:**
```bash
# 检查签名
codesign -dv --verbose=4 YourApp.app

# 检查公证
spctl -a -vvv -t execute YourApp.app
```

---

## 8. 工作流程图示

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Actions 工作流                          │
├─────────────────────────────────────────────────────────────────┤
│  1. 推送 v* 标签 或 手动触发                                       │
│         │                                                         │
│         ▼                                                         │
│  ┌─────────────────┐                                             │
│  │ create-release  │ → 创建 GitHub Release                         │
│  └────────┬────────┘                                             │
│           │                                                       │
│    ┌──────┼──────┐                                                 │
│    │      │      │                                                 │
│    ▼      ▼      ▼                                                 │
│  ┌────┐ ┌────┐ ┌────┐                                             │
│  │Win │ │Mac │ │Linux│  → 并行构建三个平台                          │
│  └────┘ └────┘ └────┘                                             │
│    │      │      │                                                 │
│    ▼      ▼      ▼                                                 │
│  ┌─────────────────┐                                             │
│  │ 上传到 Release   │ → 所有产物添加到同一个 Release                  │
│  └─────────────────┘                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. 后续优化建议

1. **添加测试工作流** - 在构建前运行单元测试
2. **添加 lint/typecheck** - 确保代码质量
3. **配置自动更新** - 使用 Tauri 的 updater 功能
4. **添加缓存** - 缓存 Cargo 和 npm 依赖，加快构建速度
5. **多环境配置** - 区分 staging 和 production 构建

如需进一步帮助，请参考 [Tauri 官方文档](https://tauri.app/v1/guides/)。

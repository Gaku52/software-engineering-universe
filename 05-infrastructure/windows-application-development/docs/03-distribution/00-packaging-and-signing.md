# Packaging and Signing

> Systematically learn the installer creation process for packaging Electron and Tauri applications for each OS, applying code signing to safely distribute to users.

---

## What You Will Learn

1. Master the packaging tools for both **Electron (Forge / Builder) and Tauri bundler**
2. Understand how **code signing** works and configure signing for Windows (Authenticode) and macOS (Apple signing)
3. Create **OS-specific installers** (NSIS, MSI, DMG, AppImage, deb)
4. Build **automated signing in CI/CD pipelines** to achieve a secure release flow
5. Understand **certificate lifecycle management** and plan for handling expiration and revocation


## Prerequisites

The following knowledge will help you understand this guide:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Packaging Overview

### 1.1 Overall Flow

```
Source Code
    │
    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Build       │     │ Packaging   │     │ Code Signing │
│             │     │             │     │             │
│ - TypeScript│────→│ - Bundle    │────→│ - Certificate│
│ - React     │     │ - asar      │     │ - Timestamp  │
│ - Rust      │     │ - Resources │     │ - Notarize   │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
                                    ┌─────────────────┐
                                    │ Installer Creation│
                                    │                 │
                                    │ Windows: NSIS/MSI│
                                    │ macOS: DMG      │
                                    │ Linux: AppImage │
                                    └─────────────────┘
```

### 1.2 Comparison of Installer Formats by OS

| Format | OS | Features | File Size |
|---|---|---|---|
| NSIS (.exe) | Windows | Custom installer. Most common | Small (high compression efficiency) |
| MSI | Windows | Windows Installer standard. For enterprise use | Medium |
| MSIX | Windows | Modern format. Supports Store distribution | Medium |
| DMG | macOS | Disk image. Drag & drop installation | Medium |
| pkg | macOS | Installer package. Supports Store distribution | Medium |
| AppImage | Linux | Single executable. No installation required | Large |
| deb | Linux | Debian/Ubuntu package | Medium |
| rpm | Linux | Red Hat/Fedora package | Medium |
| snap | Linux | Snap package. Supports automatic updates | Large |

### 1.3 Prerequisites for Packaging

Before starting the packaging process, verify the following prerequisites.

```
┌─────────────────────────────────────────────────────────────┐
│                Pre-Packaging Checklist                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  □ Node.js LTS (v20+) is installed                          │
│  □ npm / yarn / pnpm is available                           │
│  □ Build toolchains for each OS                             │
│    - Windows: Visual Studio Build Tools 2022                │
│    - macOS: Xcode Command Line Tools                        │
│    - Linux: build-essential, dpkg-dev, rpm                  │
│  □ Icon files prepared                                      │
│    - Windows: .ico (256x256 or larger)                      │
│    - macOS: .icns (1024x1024 or larger)                     │
│    - Linux: .png (512x512 or larger)                        │
│  □ Signing certificate obtained                             │
│    - Windows: OV/EV code signing certificate                │
│    - macOS: Apple Developer ID Application certificate      │
│  □ Certificate information registered in CI/CD Secrets      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.4 Generating Icon Files

Since required icon formats differ by OS, it is efficient to auto-generate them from a master image.

```bash
# electron-icon-maker を使ったアイコン一括生成
npm install -g electron-icon-maker

# 1024x1024 の PNG から各形式を生成
electron-icon-maker --input=icon-master.png --output=./resources

# 生成されるファイル:
# resources/
#   icons/
#     mac/
#       icon.icns
#     win/
#       icon.ico
#     png/
#       16x16.png
#       24x24.png
#       32x32.png
#       48x48.png
#       64x64.png
#       128x128.png
#       256x256.png
#       512x512.png
#       1024x1024.png
```

```bash
# Tauri 用のアイコン生成（Tauri CLI 内蔵）
cargo tauri icon ./icon-master.png

# 生成先: src-tauri/icons/
#   32x32.png
#   128x128.png
#   128x128@2x.png
#   icon.icns
#   icon.ico
#   Square30x30Logo.png
#   Square44x44Logo.png
#   Square71x71Logo.png
#   Square89x89Logo.png
#   Square107x107Logo.png
#   Square142x142Logo.png
#   Square150x150Logo.png
#   Square284x284Logo.png
#   Square310x310Logo.png
#   StoreLogo.png
```

---

## 2. Electron Packaging

### 2.1 Electron Forge vs Electron Builder

| Item | Electron Forge | Electron Builder |
|---|---|---|
| Maintainer | Electron official | Community |
| Configuration | `forge.config.ts` | `electron-builder.yml` |
| Plugins | Maker / Publisher | Single config file |
| Auto-update | `@electron-forge/publisher-*` | `electron-updater` |
| NSIS customization | Limited | Detailed control available |
| Use case | Officially recommended. Simple setup | Complex requirements. Fine-grained control |
| Native modules | Rebuild automatic | Rebuild automatic |
| Multi-architecture | Supported | Supported (including Universal Binary) |
| Monorepo support | Limited | Good |

### Code Example 1: Electron Forge Configuration

```typescript
// forge.config.ts — Electron Forge 設定ファイル
import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { MakerZIP } from '@electron-forge/maker-zip'
import { MakerDMG } from '@electron-forge/maker-dmg'
import { MakerDeb } from '@electron-forge/maker-deb'
import { MakerRpm } from '@electron-forge/maker-rpm'
import { VitePlugin } from '@electron-forge/plugin-vite'
import { PublisherGithub } from '@electron-forge/publisher-github'

const config: ForgeConfig = {
  // パッケージング設定
  packagerConfig: {
    // アプリ名
    name: 'MyApp',
    // 実行ファイル名
    executableName: 'my-app',
    // アイコン（拡張子なしで指定。OS に合わせて自動選択）
    icon: './resources/icon',
    // asar アーカイブ化（ソースコードの保護）
    asar: true,
    // 不要ファイルの除外パターン
    ignore: [
      /\.git/,
      /\.vscode/,
      /src\//,       // ソースコードは含めない
      /node_modules\/.*\/test/,
    ],
    // macOS 用署名設定
    osxSign: {},
    osxNotarize: {
      appleId: process.env.APPLE_ID!,
      appleIdPassword: process.env.APPLE_PASSWORD!,
      teamId: process.env.APPLE_TEAM_ID!,
    },
    // Windows 用署名設定
    windowsSign: {
      certificateFile: process.env.WIN_CERT_FILE,
      certificatePassword: process.env.WIN_CERT_PASSWORD,
    },
    // アプリのバージョン情報
    appVersion: process.env.npm_package_version,
    // ビルドバージョン（CI のビルド番号など）
    buildVersion: process.env.BUILD_NUMBER || '1',
    // 追加のリソースファイル
    extraResource: [
      './resources/data',
      './resources/templates',
    ],
    // プロトコルハンドラー登録
    protocols: [
      {
        name: 'MyApp Protocol',
        schemes: ['myapp'],
      },
    ],
  },

  // Maker 設定（インストーラー生成）
  makers: [
    // Windows: Squirrel インストーラー
    new MakerSquirrel({
      name: 'my-app',
      setupIcon: './resources/icon.ico',
    }),
    // macOS: DMG ディスクイメージ
    new MakerDMG({
      icon: './resources/icon.icns',
      format: 'ULFO',
    }),
    // macOS/Linux: ZIP（汎用）
    new MakerZIP({}, ['darwin', 'linux']),
    // Linux: deb パッケージ
    new MakerDeb({
      options: {
        maintainer: 'Dev Team',
        homepage: 'https://example.com',
        icon: './resources/icon.png',
        categories: ['Utility'],
      },
    }),
    // Linux: RPM パッケージ
    new MakerRpm({}),
  ],

  // Publisher 設定（配布先）
  publishers: [
    new PublisherGithub({
      repository: { owner: 'myorg', name: 'my-app' },
      prerelease: false,
    }),
  ],

  // Vite プラグイン
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main/index.ts', config: 'vite.main.config.ts' },
        { entry: 'src/preload/index.ts', config: 'vite.preload.config.ts' },
      ],
      renderer: [
        { name: 'main_window', config: 'vite.renderer.config.ts' },
      ],
    }),
  ],

  // フック設定
  hooks: {
    // パッケージング前の処理
    prePackage: async () => {
      console.log('パッケージング前の準備を実行中...')
      // 例: ビルドアーティファクトのクリーンアップ
    },
    // パッケージング後の処理
    postPackage: async (config, result) => {
      console.log(`パッケージング完了: ${result.outputPaths.join(', ')}`)
    },
    // Make 前の処理
    preMake: async () => {
      console.log('インストーラー作成前の処理...')
    },
  },
}

export default config
```

### Code Example 2: Electron Builder Configuration

```yaml
# electron-builder.yml — Electron Builder 設定ファイル
appId: com.example.my-app
productName: My App
copyright: Copyright (c) 2025 My Company

# ビルド出力ディレクトリ
directories:
  output: release
  buildResources: resources

# 共通設定
asar: true
compression: maximum  # 圧縮レベル: store / normal / maximum

# ファイルフィルター（含めるファイルを明示）
files:
  - "out/**/*"
  - "package.json"
  - "!node_modules/**/*.{md,txt,map}"
  - "!node_modules/**/{test,tests,__tests__}/**"

# 追加リソース（asar 外に配置されるファイル）
extraResources:
  - from: "resources/data"
    to: "data"
    filter:
      - "**/*"
      - "!*.draft"
  - from: "resources/templates"
    to: "templates"

# 追加ファイル（アプリのルートに配置）
extraFiles:
  - from: "resources/config"
    to: "config"

# Windows 設定
win:
  target:
    - target: nsis
      arch: [x64, arm64]
    - target: msi
      arch: [x64]
  icon: resources/icon.ico
  # コード署名
  signingHashAlgorithms: [sha256]
  certificateFile: ${WIN_CERT_FILE}
  certificatePassword: ${WIN_CERT_PASSWORD}
  # タイムスタンプサーバー
  rfc3161TimeStampServer: http://timestamp.digicert.com
  # リクエストされた実行レベル
  requestedExecutionLevel: asInvoker
  # ファイル関連付け
  fileAssociations:
    - ext: myapp
      name: MyApp Project File
      description: MyApp project file format
      icon: resources/file-icon.ico
      role: Editor

# NSIS インストーラー設定
nsis:
  oneClick: false           # ワンクリックインストールを無効化
  allowToChangeInstallationDirectory: true  # インストール先の変更を許可
  installerIcon: resources/icon.ico
  uninstallerIcon: resources/icon.ico
  installerHeaderIcon: resources/icon.ico
  createDesktopShortcut: true
  createStartMenuShortcut: true
  license: LICENSE.txt
  # 多言語対応
  language: 1041            # 日本語
  # インストール完了後にアプリを起動
  runAfterFinish: true
  # アンインストーラーの表示名
  uninstallDisplayName: "My App アンインストーラー"
  # 管理者権限が必要かどうか
  perMachine: false
  # インストールディレクトリ名
  installerSidebar: resources/installer-sidebar.bmp
  # カスタム NSIS スクリプト
  include: build/installer-scripts/custom.nsh
  script: build/installer-scripts/main.nsi

# MSI インストーラー設定
msi:
  oneClick: false
  perMachine: true
  # WiX Toolset のカスタマイズ
  warningsAsErrors: false
  # アップグレード GUID（固定値。変更しないこと）
  upgradeCode: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"

# macOS 設定
mac:
  target:
    - target: dmg
      arch: [x64, arm64]
    - target: zip
      arch: [x64, arm64]
  icon: resources/icon.icns
  category: public.app-category.productivity
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  # Universal Binary の生成
  # target で universal を指定すると x64 + arm64 を統合
  extendInfo:
    NSMicrophoneUsageDescription: "音声入力機能で使用します"
    NSCameraUsageDescription: "ビデオ通話機能で使用します"

# macOS 公証（Notarization）
afterSign: scripts/notarize.js

# DMG 設定
dmg:
  contents:
    - x: 410
      y: 150
      type: link
      path: /Applications
    - x: 130
      y: 150
      type: file
  window:
    width: 540
    height: 380
  background: resources/dmg-background.png
  iconSize: 80
  title: "My App ${version}"

# Linux 設定
linux:
  target:
    - target: AppImage
      arch: [x64]
    - target: deb
      arch: [x64]
    - target: rpm
      arch: [x64]
  icon: resources/icons
  category: Utility
  maintainer: dev@example.com
  synopsis: "生産性向上ツール"
  description: "チームの生産性を向上させるオールインワンツール"
  desktop:
    StartupWMClass: my-app
    MimeType: "x-scheme-handler/myapp"

# deb 固有設定
deb:
  depends:
    - libnotify4
    - libsecret-1-0
  afterInstall: build/linux/after-install.sh
  afterRemove: build/linux/after-remove.sh

# AppImage 固有設定
appImage:
  artifactName: "${productName}-${version}-${arch}.AppImage"
  # AppImageUpdate 用のアップデート情報
  category: Utility

# snap 設定
snap:
  grade: stable
  confinement: strict
  plugs:
    - default
    - home
    - network

# 自動更新設定（GitHub Releases）
publish:
  provider: github
  owner: myorg
  repo: my-app
  releaseType: release
```

### 2.2 NSIS Custom Scripts

When further customizing the NSIS installer, custom scripts can be used.

```nsis
; build/installer-scripts/custom.nsh — NSIS カスタムスクリプト
; electron-builder の nsis.include で読み込まれる

!macro customHeader
  ; インストーラーのヘッダーにカスタム処理を追加
  !system "echo カスタムヘッダーを読み込み中..."
!macroend

!macro preInit
  ; インストーラー初期化前の処理
  ; 管理者権限の確認など
  SetShellVarContext all
!macroend

!macro customInit
  ; インストーラー初期化時の処理
  ; 前バージョンのアンインストール確認
  ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\{${APP_ID}}" "UninstallString"
  ${If} $0 != ""
    MessageBox MB_YESNO|MB_ICONQUESTION "$(oldVersionFound)" IDYES uninst
    Abort
    uninst:
      ExecWait "$0 /S"
  ${EndIf}
!macroend

!macro customInstall
  ; インストール完了後のカスタム処理

  ; Windows Defender の除外パスに追加（オプション）
  ; nsExec::ExecToLog 'powershell -Command "Add-MpPreference -ExclusionPath \"$INSTDIR\""'

  ; ファイアウォールルールの追加
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="MyApp" dir=in action=allow program="$INSTDIR\my-app.exe" enable=yes'

  ; レジストリにプロトコルハンドラーを登録
  WriteRegStr HKCU "Software\Classes\myapp" "" "URL:MyApp Protocol"
  WriteRegStr HKCU "Software\Classes\myapp" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\myapp\shell\open\command" "" '"$INSTDIR\my-app.exe" "%1"'

  ; スタートアップ登録（オプション）
  ; WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "MyApp" "$INSTDIR\my-app.exe --minimized"
!macroend

!macro customUnInstall
  ; アンインストール時のクリーンアップ

  ; ファイアウォールルールの削除
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="MyApp"'

  ; プロトコルハンドラーの削除
  DeleteRegKey HKCU "Software\Classes\myapp"

  ; ユーザーデータの削除確認
  MessageBox MB_YESNO|MB_ICONQUESTION "ユーザーデータも削除しますか？" IDNO skipUserData
    RMDir /r "$APPDATA\my-app"
  skipUserData:
!macroend
```

### 2.3 Detailed asar Archive Configuration

```typescript
// asar の詳細設定（electron-builder.yml の asar セクション代替）
// forge.config.ts で packagerConfig.asar を詳細に指定する場合

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      // asar から除外するファイル（ネイティブモジュールなど）
      unpack: [
        '**/*.node',           // ネイティブアドオン
        '**/sharp/**',         // sharp ライブラリ
        '**/sqlite3/**',       // SQLite
        '**/node_modules/ffmpeg-static/**', // FFmpeg バイナリ
      ],
      // asar のインテグリティチェックを有効化
      // electron >= 30 で利用可能
    },
  },
}
```

```yaml
# electron-builder.yml での asar 設定
asar: true
asarUnpack:
  - "**/*.node"
  - "**/sharp/**"
  - "**/sqlite3/**"
  - "node_modules/ffmpeg-static/**"
```

### 2.4 Rebuilding Native Modules

```bash
# Electron のバージョンに合わせてネイティブモジュールをリビルド
npx electron-rebuild

# 特定のモジュールのみリビルド
npx electron-rebuild -m ./node_modules/better-sqlite3

# ターゲットアーキテクチャを指定してリビルド
npx electron-rebuild --arch=arm64

# Visual Studio のバージョンを指定（Windows）
npx electron-rebuild --vs-version=2022
```

```json
// package.json にリビルド設定を追加
{
  "scripts": {
    "postinstall": "electron-rebuild",
    "rebuild": "electron-rebuild -f -w better-sqlite3,sharp"
  },
  "build": {
    "npmRebuild": true,
    "nodeGypRebuild": false
  }
}
```

### 2.5 Build Size Optimization

```yaml
# electron-builder.yml — サイズ最適化設定
# 不要なロケールファイルを除外
electronLanguages:
  - ja
  - en

# 不要なファイルの除外
files:
  - "out/**/*"
  - "package.json"
  # 開発用ファイルを除外
  - "!**/*.{ts,tsx,map}"
  - "!**/*.{md,txt}"
  - "!**/CHANGELOG*"
  - "!**/LICENSE*"
  - "!**/{.eslintrc,.prettierrc,.editorconfig}"
  # テストファイルを除外
  - "!node_modules/**/{test,tests,__tests__,__mocks__}/**"
  - "!node_modules/**/*.test.{js,ts}"
  - "!node_modules/**/*.spec.{js,ts}"
  # TypeScript 型定義を除外
  - "!node_modules/**/*.d.ts"
  - "!node_modules/@types/**"
  # ドキュメントを除外
  - "!node_modules/**/docs/**"
  - "!node_modules/**/doc/**"
  - "!node_modules/**/example/**"
  - "!node_modules/**/examples/**"
```

```typescript
// vite.main.config.ts — メインプロセスのバンドル最適化
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    // Tree-shaking を有効化
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,  // console.log を除去（プロダクションビルド）
        drop_debugger: true,
        pure_funcs: ['console.debug', 'console.trace'],
      },
    },
    rollupOptions: {
      external: [
        'electron',
        'better-sqlite3',
        'sharp',
      ],
    },
  },
})
```

---

## 3. Tauri Packaging

### Code Example 3: Tauri Bundler Configuration

```json
// src-tauri/tauri.conf.json — バンドル設定
{
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "resources": [
      "assets/*"
    ],
    "copyright": "Copyright (c) 2025 My Company",
    "category": "Productivity",
    "shortDescription": "生産性向上ツール",
    "longDescription": "チームの生産性を向上させるためのオールインワンツール",

    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com",
      "nsis": {
        "languages": ["Japanese", "English"],
        "displayLanguageSelector": true,
        "installerIcon": "icons/icon.ico",
        "headerImage": "icons/nsis-header.bmp",
        "sidebarImage": "icons/nsis-sidebar.bmp"
      },
      "wix": {
        "language": ["ja-JP", "en-US"]
      },
      "webviewInstallMode": {
        "type": "downloadBootstrapper"
      }
    },

    "macOS": {
      "entitlements": "Entitlements.plist",
      "signingIdentity": "-",
      "minimumSystemVersion": "10.15",
      "frameworks": [],
      "exceptionDomain": ""
    },

    "linux": {
      "deb": {
        "depends": ["libwebkit2gtk-4.1-0", "libgtk-3-0"],
        "section": "utils",
        "priority": "optional"
      },
      "appimage": {
        "bundleMediaFramework": true
      },
      "rpm": {
        "depends": ["webkit2gtk4.1", "gtk3"]
      }
    }
  }
}
```

### 3.1 Extended Bundle Configuration for Tauri v2

```json
// src-tauri/tauri.conf.json — Tauri v2 の拡張設定
{
  "productName": "My App",
  "version": "1.0.0",
  "identifier": "com.example.myapp",
  "build": {
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev",
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173"
  },
  "app": {
    "windows": [
      {
        "title": "My App",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false,
        "decorations": true,
        "transparent": false
      }
    ],
    "security": {
      "csp": "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'"
    }
  },
  "bundle": {
    "active": true,
    "targets": ["nsis", "msi", "dmg", "appimage", "deb"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "resources": {
      "assets/*": "assets/",
      "data/*.db": "data/"
    },
    "fileAssociations": [
      {
        "ext": ["myapp"],
        "mimeType": "application/x-myapp",
        "description": "MyApp Project File"
      }
    ],
    "deepLink": {
      "scheme": ["myapp"]
    }
  }
}
```

```bash
# Tauri アプリのビルドとパッケージング
# 開発ビルド（デバッグモード）
cargo tauri build --debug

# リリースビルド（最適化あり）
cargo tauri build

# 特定ターゲットのみビルド
cargo tauri build --target x86_64-pc-windows-msvc
cargo tauri build --bundles nsis    # NSIS のみ
cargo tauri build --bundles msi     # MSI のみ
cargo tauri build --bundles dmg     # DMG のみ
cargo tauri build --bundles appimage # AppImage のみ

# 環境変数での署名設定
TAURI_SIGNING_PRIVATE_KEY="content_of_private_key" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="password" \
cargo tauri build

# フロントエンドのビルドをスキップ（事前にビルド済みの場合）
cargo tauri build --no-bundle
cargo tauri build --ci  # CI 環境用（対話なし）
```

### 3.2 Tauri Binary Size Optimization

```toml
# src-tauri/Cargo.toml — リリースビルドの最適化
[profile.release]
# 最大限の最適化
opt-level = "s"           # サイズ最適化（"z" はさらに小さくなるが遅い）
lto = true                # リンク時最適化
codegen-units = 1         # コード生成ユニット数（少ないほど最適化が良い）
strip = true              # デバッグシンボルを除去
panic = "abort"           # パニック時のスタックアンワインドを無効化

[profile.release.package.app]
opt-level = 3             # アプリコードは速度優先で最適化
```

```bash
# UPX（Ultimate Packer for eXecutables）による追加圧縮
# ※ 一部のアンチウイルスソフトが誤検知する場合があるため注意

# UPX インストール
# Windows: choco install upx
# macOS: brew install upx
# Linux: apt install upx

# バイナリの圧縮
upx --best --lzma target/release/my-app.exe

# 圧縮前後のサイズ比較
# Before: 12.5 MB
# After:   4.8 MB (62% 削減)
```

---

## 4. Code Signing

### 4.1 How Signing Works

```
+----------------------------------------------------------+
|                   Code Signing Flow                      |
+----------------------------------------------------------+
|                                                          |
|  Developer                                               |
|  ┌──────────────────────────────────────────────────┐    |
|  │  1. Obtain Certificate                            │    |
|  │     Purchase a Code Signing certificate from     │    |
|  │     a CA (Certificate Authority)                 │    |
|  │                                                  │    |
|  │  2. Sign the Binary                              │    |
|  │     Sign the binary's hash with the private key  │    |
|  │     ┌──────┐    ┌──────────┐    ┌─────────┐     │    |
|  │     │.exe  │ +  │Private   │ →  │Signed   │     │    |
|  │     │.dll  │    │Key(.pfx) │    │.exe     │     │    |
|  │     └──────┘    └──────────┘    └─────────┘     │    |
|  │                                                  │    |
|  │  3. Apply Timestamp                              │    |
|  │     Keeps the signature valid after the          │    |
|  │     certificate expires                          │    |
|  └──────────────────────────────────────────────────┘    |
|                                                          |
|  User                                                    |
|  ┌──────────────────────────────────────────────────┐    |
|  │  4. Verify Signature                             │    |
|  │     OS verifies the certificate chain            │    |
|  │     → SmartScreen / Gatekeeper warning disappears│    |
|  └──────────────────────────────────────────────────┘    |
+----------------------------------------------------------+
```

### 4.2 Windows (Authenticode) Signing

### Code Example 4: Windows Signing Configuration

```bash
# signtool.exe を使った手動署名（Windows SDK に含まれる）
# PFX ファイルの場合
signtool sign /f "certificate.pfx" \
  /p "パスワード" \
  /fd sha256 \
  /tr http://timestamp.digicert.com \
  /td sha256 \
  /d "My Application" \
  "path/to/app.exe"

# EV 証明書（ハードウェアトークン）の場合
signtool sign /n "Company Name" \
  /fd sha256 \
  /tr http://timestamp.digicert.com \
  /td sha256 \
  "path/to/app.exe"

# 署名の検証
signtool verify /pa /v "path/to/app.exe"

# 複数ファイルの一括署名
signtool sign /f "certificate.pfx" \
  /p "パスワード" \
  /fd sha256 \
  /tr http://timestamp.digicert.com \
  /td sha256 \
  /d "My Application" \
  "path/to/app.exe" \
  "path/to/helper.exe" \
  "path/to/native.dll"
```

```typescript
// Electron Builder での署名設定（環境変数で秘密情報を渡す）
// package.json の scripts
{
  "scripts": {
    "build:win": "cross-env CSC_LINK=./cert.pfx CSC_KEY_PASSWORD=$CERT_PASS electron-builder --win",
    "build:mac": "electron-builder --mac"
  }
}
```

### 4.3 Azure Trusted Signing (formerly Azure Code Signing)

Azure Trusted Signing is a cloud-based signing service that achieves EV-equivalent trust levels without a hardware token.

```yaml
# .github/workflows/sign-with-azure.yml
name: Sign with Azure Trusted Signing

on:
  workflow_call:
    inputs:
      file-path:
        required: true
        type: string

jobs:
  sign:
    runs-on: windows-latest
    steps:
      - name: Azure Login
        uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Sign with Trusted Signing
        uses: azure/trusted-signing-action@v0.3
        with:
          azure-tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          azure-client-id: ${{ secrets.AZURE_CLIENT_ID }}
          azure-client-secret: ${{ secrets.AZURE_CLIENT_SECRET }}
          endpoint: https://eus.codesigning.azure.net/
          trusted-signing-account-name: my-signing-account
          certificate-profile-name: my-cert-profile
          files-folder: ${{ inputs.file-path }}
          files-folder-filter: exe,dll,msi
          file-digest: SHA256
          timestamp-rfc3161: http://timestamp.acs.microsoft.com
          timestamp-digest: SHA256
```

```powershell
# PowerShell での Azure Trusted Signing 使用例
# Azure CLI で署名
az codesigning sign `
  --account-name "my-signing-account" `
  --certificate-profile-name "my-cert-profile" `
  --endpoint "https://eus.codesigning.azure.net/" `
  --file-path "path\to\app.exe" `
  --file-digest SHA256 `
  --timestamp-rfc3161 "http://timestamp.acs.microsoft.com" `
  --timestamp-digest SHA256
```

### 4.4 Signing with DigiCert KeyLocker

```bash
# DigiCert KeyLocker — クラウドベースの EV 署名
# smctl（DigiCert Software Trust Manager CLI）を使用

# 証明書の確認
smctl keypair ls

# 署名
smctl sign \
  --keypair-alias="ev-code-signing" \
  --input="path/to/app.exe" \
  --signature-algorithm="sha256"

# バッチ署名
smctl sign \
  --keypair-alias="ev-code-signing" \
  --input-dir="path/to/binaries/" \
  --file-filter="*.exe,*.dll" \
  --signature-algorithm="sha256"
```

```yaml
# GitHub Actions での DigiCert KeyLocker 統合
- name: Setup DigiCert KeyLocker
  env:
    SM_HOST: ${{ secrets.SM_HOST }}
    SM_API_KEY: ${{ secrets.SM_API_KEY }}
    SM_CLIENT_CERT_FILE_B64: ${{ secrets.SM_CLIENT_CERT_FILE_B64 }}
    SM_CLIENT_CERT_PASSWORD: ${{ secrets.SM_CLIENT_CERT_PASSWORD }}
  run: |
    echo "$SM_CLIENT_CERT_FILE_B64" | base64 -d > certificate_pkcs12.p12
    smctl setup
    smctl healthcheck

- name: Sign Executable
  run: |
    smctl sign --keypair-alias="ev-code-signing" \
      --input="release/my-app.exe" \
      --signature-algorithm="sha256"
```

### 4.5 macOS Signing and Notarization

```
macOS Code Signing + Notarization Flow:

  1. Enroll in the Apple Developer Program (annual $99)
  2. Obtain a Developer ID Application certificate
  3. Code sign the app
  4. Submit for Notarization to Apple
  5. Staple (attach the notarization ticket to the app)

  ┌─────────────┐    ┌───────────────┐    ┌──────────┐
  │ Code Sign    │───→│ Submit to     │───→│ Staple   │
  │ (codesign)  │    │ Apple         │    │          │
  └─────────────┘    │ (notarytool)  │    └──────────┘
                     └───────────────┘
                          ↓
                     Malware scan on
                     Apple servers
                     (a few minutes to tens of minutes)
```

### Code Example 5: macOS Notarization Script

```javascript
// scripts/notarize.js — Electron Builder の afterSign フック
const { notarize } = require('@electron/notarize')

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context

  // macOS 以外ではスキップ
  if (electronPlatformName !== 'darwin') {
    return
  }

  const appName = context.packager.appInfo.productFilename

  console.log(`公証を開始: ${appName}`)

  await notarize({
    // Apple ID（環境変数から取得）
    appleId: process.env.APPLE_ID,
    // App-specific password
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    // チーム ID
    teamId: process.env.APPLE_TEAM_ID,
    // アプリのパス
    appPath: `${appOutDir}/${appName}.app`,
  })

  console.log('公証が完了しました')
}
```

```xml
<!-- build/entitlements.mac.plist — macOS エンタイトルメント -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- ハードンドランタイム必須設定 -->
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <!-- 署名なしの実行可能ファイルを許可（Electron 用） -->
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <!-- dylib の読み込みを許可 -->
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
    <!-- ネットワークアクセス -->
    <key>com.apple.security.network.client</key>
    <true/>
    <!-- ファイルアクセス（ユーザー選択） -->
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
</dict>
</plist>
```

### 4.6 macOS Manual Signing Commands

```bash
# codesign を使った手動署名
# Developer ID Application 証明書で署名
codesign --deep --force --verbose \
  --sign "Developer ID Application: My Company (TEAM_ID)" \
  --options runtime \
  --entitlements build/entitlements.mac.plist \
  "MyApp.app"

# 署名の検証
codesign --verify --verbose=4 "MyApp.app"

# 詳細な署名情報の表示
codesign --display --verbose=4 "MyApp.app"

# 公証の送信（notarytool を使用 — Xcode 13+）
xcrun notarytool submit "MyApp.dmg" \
  --apple-id "developer@example.com" \
  --team-id "XXXXXXXXXX" \
  --password "@keychain:AC_PASSWORD" \
  --wait

# 公証のステータス確認
xcrun notarytool info <submission-id> \
  --apple-id "developer@example.com" \
  --team-id "XXXXXXXXXX" \
  --password "@keychain:AC_PASSWORD"

# 公証ログの取得（問題診断用）
xcrun notarytool log <submission-id> \
  --apple-id "developer@example.com" \
  --team-id "XXXXXXXXXX" \
  --password "@keychain:AC_PASSWORD" \
  notarization-log.json

# Staple（公証チケットをアプリに添付）
xcrun stapler staple "MyApp.dmg"

# Staple の検証
xcrun stapler validate "MyApp.dmg"
```

---

## 5. Certificate Types and Costs

| Certificate Type | Target OS | Estimated Annual Cost | Immediate SmartScreen Trust |
|---|---|---|---|
| OV (Organization Validation) | Windows | $200-400 | No (reputation accumulation required) |
| EV (Extended Validation) | Windows | $300-600 | Yes |
| Azure Trusted Signing | Windows | $9.99/month | Yes |
| Apple Developer ID | macOS | $99 | Yes (after notarization) |
| Self-signed certificate | Development only | Free | No |

### 5.1 Certificate Acquisition Process (Windows OV/EV)

```
┌─────────────────────────────────────────────────────────────┐
│          Windows Code Signing Certificate Acquisition Flow   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Choose a Certificate Authority (CA)                     │
│     - DigiCert (recommended): EV $449/yr, OV $349/yr        │
│     - Sectigo: EV $319/yr, OV $189/yr                       │
│     - GlobalSign: EV $399/yr, OV $249/yr                    │
│                                                             │
│  2. Required Documents for Application                      │
│     - Corporate registration certificate                    │
│     - Representative's identification                       │
│     - Email address receivable at company's domain          │
│     - DUNS number (for EV)                                  │
│                                                             │
│  3. Verification Process                                    │
│     - OV: Organization verification (3-5 business days)     │
│     - EV: Org verification + phone verification (5-10 days) │
│                                                             │
│  4. Receiving the Certificate                               │
│     - OV: Download as PFX file                             │
│     - EV: Delivered via hardware token (USB) by mail        │
│                                                             │
│  5. CI/CD Configuration                                     │
│     - OV: Base64-encode PFX and save to Secrets             │
│     - EV: Integrate with cloud signing service              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Certificate Lifecycle Management

```typescript
// scripts/check-cert-expiry.ts — 証明書の有効期限を監視するスクリプト
import { execSync } from 'child_process'

interface CertInfo {
  subject: string
  issuer: string
  validFrom: Date
  validTo: Date
  thumbprint: string
  daysRemaining: number
}

function checkWindowsCertificate(pfxPath: string, password: string): CertInfo {
  // PowerShell で証明書情報を取得
  const result = execSync(
    `powershell -Command "` +
    `$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('${pfxPath}', '${password}'); ` +
    `$cert | ConvertTo-Json"`,
    { encoding: 'utf-8' }
  )

  const cert = JSON.parse(result)
  const validTo = new Date(cert.NotAfter)
  const now = new Date()
  const daysRemaining = Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  return {
    subject: cert.Subject,
    issuer: cert.Issuer,
    validFrom: new Date(cert.NotBefore),
    validTo,
    thumbprint: cert.Thumbprint,
    daysRemaining,
  }
}

// 証明書の有効期限チェック
const cert = checkWindowsCertificate('./cert.pfx', process.env.CERT_PASSWORD!)

if (cert.daysRemaining < 30) {
  console.error(`⚠ 証明書の有効期限まで残り ${cert.daysRemaining} 日です！`)
  console.error(`  Subject: ${cert.subject}`)
  console.error(`  有効期限: ${cert.validTo.toISOString()}`)
  process.exit(1)
} else {
  console.log(`証明書は有効です（残り ${cert.daysRemaining} 日）`)
}
```

```yaml
# .github/workflows/cert-check.yml — 定期的な証明書有効期限チェック
name: Certificate Expiry Check

on:
  schedule:
    - cron: '0 9 * * 1'  # 毎週月曜 9:00 UTC

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check Certificate Expiry
        run: |
          echo "${{ secrets.WIN_CERT_BASE64 }}" | base64 -d > cert.pfx
          npx ts-node scripts/check-cert-expiry.ts
        env:
          CERT_PASSWORD: ${{ secrets.WIN_CERT_PASSWORD }}

      - name: Notify on Expiry Warning
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "⚠ コード署名証明書の有効期限が近づいています！更新を検討してください。"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 6. Automated Signing Pipeline in CI/CD

### 6.1 Full Automated Build and Signing with GitHub Actions

```yaml
# .github/workflows/build-and-sign.yml
name: Build, Sign, and Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

env:
  NODE_VERSION: '20'

jobs:
  # ── Windows Build ──
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - run: npm ci

      # 証明書のインポート
      - name: Import Code Signing Certificate
        shell: powershell
        run: |
          $pfxBytes = [Convert]::FromBase64String("${{ secrets.WIN_CERT_BASE64 }}")
          [IO.File]::WriteAllBytes("$env:RUNNER_TEMP\cert.pfx", $pfxBytes)

      # ビルドと署名
      - name: Build and Sign
        run: npx electron-builder --win --publish never
        env:
          CSC_LINK: ${{ runner.temp }}\cert.pfx
          CSC_KEY_PASSWORD: ${{ secrets.WIN_CERT_PASSWORD }}

      # アーティファクトのアップロード
      - name: Upload Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: windows-artifacts
          path: |
            release/*.exe
            release/*.msi
            release/*.blockmap
            release/latest.yml

      # 証明書のクリーンアップ
      - name: Cleanup Certificate
        if: always()
        shell: powershell
        run: |
          if (Test-Path "$env:RUNNER_TEMP\cert.pfx") {
            Remove-Item "$env:RUNNER_TEMP\cert.pfx" -Force
          }

  # ── macOS Build ──
  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - run: npm ci

      # macOS 証明書のインポート
      - name: Import Code Signing Certificate
        uses: apple-actions/import-codesign-certs@v2
        with:
          p12-file-base64: ${{ secrets.MAC_CERT_BASE64 }}
          p12-password: ${{ secrets.MAC_CERT_PASSWORD }}

      # ビルド、署名、公証
      - name: Build, Sign, and Notarize
        run: npx electron-builder --mac --publish never
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_ASP }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}

      # アーティファクトのアップロード
      - name: Upload Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: macos-artifacts
          path: |
            release/*.dmg
            release/*.zip
            release/*.blockmap
            release/latest-mac.yml

  # ── Linux Build ──
  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - run: npm ci

      - name: Build
        run: npx electron-builder --linux --publish never

      - name: Upload Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: linux-artifacts
          path: |
            release/*.AppImage
            release/*.deb
            release/*.rpm
            release/latest-linux.yml

  # ── Create Release ──
  create-release:
    needs: [build-windows, build-macos, build-linux]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # 全アーティファクトのダウンロード
      - uses: actions/download-artifact@v4
        with:
          path: artifacts
          merge-multiple: true

      # GitHub Release の作成
      - name: Create Release
        uses: softprops/action-gh-release@v2
        with:
          draft: true
          generate_release_notes: true
          files: artifacts/**/*
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 6.2 Signature Verification Script

```powershell
# scripts/verify-signatures.ps1 — ビルド成果物の署名検証
param(
    [Parameter(Mandatory=$true)]
    [string]$ArtifactsDir
)

$errors = 0

# EXE ファイルの署名検証
Get-ChildItem "$ArtifactsDir\*.exe" | ForEach-Object {
    $sig = Get-AuthenticodeSignature $_.FullName
    if ($sig.Status -ne "Valid") {
        Write-Error "署名無効: $($_.Name) - Status: $($sig.Status)"
        $errors++
    } else {
        Write-Host "署名有効: $($_.Name) - Subject: $($sig.SignerCertificate.Subject)" -ForegroundColor Green
    }
}

# MSI ファイルの署名検証
Get-ChildItem "$ArtifactsDir\*.msi" | ForEach-Object {
    $sig = Get-AuthenticodeSignature $_.FullName
    if ($sig.Status -ne "Valid") {
        Write-Error "署名無効: $($_.Name) - Status: $($sig.Status)"
        $errors++
    } else {
        Write-Host "署名有効: $($_.Name)" -ForegroundColor Green
    }
}

# タイムスタンプの検証
Get-ChildItem "$ArtifactsDir\*.exe" | ForEach-Object {
    $sig = Get-AuthenticodeSignature $_.FullName
    $ts = $sig.TimeStamperCertificate
    if ($null -eq $ts) {
        Write-Warning "タイムスタンプなし: $($_.Name)"
        $errors++
    } else {
        Write-Host "タイムスタンプ有効: $($_.Name) - 発行元: $($ts.Issuer)" -ForegroundColor Green
    }
}

if ($errors -gt 0) {
    Write-Error "署名検証エラーが $errors 件あります"
    exit 1
}

Write-Host "全ての署名検証が成功しました" -ForegroundColor Green
```

---

## 7. Anti-Patterns

### Anti-Pattern 1: Committing Private Keys or Certificate Passwords to the Repository

```yaml
# NG: ハードコードされた秘密情報
win:
  certificateFile: "./secrets/cert.pfx"         # リポジトリに含まれる
  certificatePassword: "my-secret-password-123"  # パスワードが平文
```

```yaml
# OK: 環境変数から秘密情報を参照
win:
  certificateFile: ${WIN_CERT_FILE}              # CI/CD の Secret から注入
  certificatePassword: ${WIN_CERT_PASSWORD}       # CI/CD の Secret から注入

# CI/CD (GitHub Actions) での設定例:
# secrets.WIN_CERT_FILE → Base64 エンコードされた PFX ファイル
# secrets.WIN_CERT_PASSWORD → 証明書のパスワード
```

### Anti-Pattern 2: Distributing an App Without Signing

```
Warnings displayed when the app is unsigned:

Windows:
┌──────────────────────────────────────────┐
│  Windows protected your PC               │
│                                          │
│  Windows SmartScreen prevented an        │
│  unrecognized app from starting.         │
│                                          │
│  [Don't run]  [More info → Run anyway]   │
└──────────────────────────────────────────┘

macOS:
┌──────────────────────────────────────────┐
│  "MyApp" cannot be opened because the    │
│  developer cannot be verified.           │
│                                          │
│  [Move to Trash]  [Cancel]               │
└──────────────────────────────────────────┘

→ Damages user trust and significantly reduces installation rates
→ Always perform code signing
```

### Anti-Pattern 3: Signing Without a Timestamp

```bash
# NG: タイムスタンプを省略して署名
signtool sign /f "cert.pfx" /p "password" /fd sha256 "app.exe"
# → 証明書の有効期限が切れると署名も無効になる

# OK: タイムスタンプサーバーを指定して署名
signtool sign /f "cert.pfx" /p "password" \
  /fd sha256 \
  /tr http://timestamp.digicert.com \
  /td sha256 \
  "app.exe"
# → 証明書の有効期限が切れても、署名時点で有効だったことが証明される
```

### Anti-Pattern 4: Distributing with asar Disabled

```yaml
# NG: ソースコードが平文で配布される
asar: false

# OK: asar を有効にしてソースコードを保護
asar: true
asarUnpack:
  - "**/*.node"  # ネイティブモジュールのみ除外
```

**Issue**: Disabling asar allows users to read the app's source code directly. While asar is not full encryption, it is essential as a minimum protection against casual reverse engineering.

### Anti-Pattern 5: Bundling All Architectures Into a Single Binary

```yaml
# NG: 全アーキテクチャのネイティブモジュールを同梱
files:
  - "node_modules/**/*"  # x64 と arm64 の両方のバイナリが含まれる

# OK: ターゲットアーキテクチャに合わせてビルド
win:
  target:
    - target: nsis
      arch: [x64]      # x64 用のインストーラー
    - target: nsis
      arch: [arm64]    # arm64 用のインストーラー（別ファイル）
```

**Issue**: Including binaries for unnecessary architectures can nearly double the installer size. The correct approach is to build separately for each architecture.

---

## 8. FAQ

### Q1: Should I choose an EV certificate or an OV certificate?

**A:** An EV certificate is recommended for the initial stage. An OV certificate requires weeks to months to build up SmartScreen trust, whereas an EV certificate immediately bypasses SmartScreen warnings. However, EV certificates require a hardware token (USB key), and for automated signing in CI/CD, they must be combined with a cloud signing service (DigiCert KeyLocker, Azure Trusted Signing, etc.). Since 2024, Azure Trusted Signing provides EV-equivalent trust for $9.99/month, making it a cost-effective option.

### Q2: How long does macOS Notarization take?

**A:** It typically completes in 1 to 5 minutes. However, depending on Apple server load, it may take more than 15 minutes. When setting up CI/CD pipelines, configure sufficient timeout for the notarization to complete (at least 30 minutes recommended). The `xcrun notarytool submit --wait` command can be used to wait for completion. If notarization fails, retrieve the log with `xcrun notarytool log` to identify the issue. Common failure causes include insufficient entitlements and missing Hardened Runtime configuration.

### Q3: Is code signing required for Linux apps?

**A:** Linux does not have an OS-level code signing check mechanism like Windows/macOS, so it is technically not required. However, you can use GPG signing to prove package integrity or embed signatures in AppImages. This should be considered based on the distribution channel (e.g., the Snap Store performs automatic signing).

### Q4: How do I securely manage certificates in CI/CD?

**A:** Base64-encode the PFX file and store it in GitHub Actions Encrypted Secrets. Decode it within the workflow and always delete it after use. For EV certificates, use a cloud signing service (Azure Trusted Signing, DigiCert KeyLocker) so that the private key never exists on the runner. Also, follow the principle of least privilege for certificate access, making it accessible only from the release workflow.

### Q5: How much do package sizes differ between Electron and Tauri?

**A:** For applications with equivalent functionality, a typical size comparison is as follows. Electron bundles Chromium, resulting in a base size of 80 to 150 MB. Tauri uses the OS standard WebView, so it can be as small as 2 to 10 MB. However, Electron can be reduced to roughly 60 to 80 MB by removing locale files and applying asar compression. Tauri can be made even smaller with UPX compression, but this carries a risk of false positives from antivirus software.

### Q6: What are best practices for multi-architecture (x64/ARM64) support?

**A:** The basic approach is to create separate installers for each architecture. On macOS, Universal Binary (x64 + ARM64 combined) is also an option, but it doubles the size. In CI/CD, use matrix builds to build in parallel and upload the respective artifacts to a GitHub Release. On the download page, it is desirable to have a mechanism that automatically detects the OS and architecture to present the appropriate binary.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just from theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners often make?

Skipping the basics and jumping to advanced topics. We recommend solidly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architectural design.

---

## 9. Summary

| Topic | Key Points |
|---|---|
| Electron Forge | Officially recommended tool. Extensible with Maker/Publisher plugins |
| Electron Builder | Detailed control available. Powerful NSIS customization |
| Tauri bundler | Generates NSIS/MSI/DMG/AppImage with `cargo tauri build` |
| Windows signing | Authenticode. EV certificate provides immediate SmartScreen bypass |
| Azure Trusted Signing | Cloud signing service with EV-equivalent trust for $9.99/month |
| macOS signing | Developer ID + Notarization + Staple are all required |
| Certificate management | Manage private keys in CI/CD Secrets. Never commit to repository |
| Certificate expiry monitoring | Regularly check expiry dates to prevent certificates from lapsing |
| Installers | NSIS (Win) + DMG (Mac) + AppImage (Linux) is the standard configuration |
| Build optimization | Minimize size with locale reduction, tree-shaking, and asar compression |
| CI/CD pipeline | Automate build, signing, and release for all OS with GitHub Actions |
| Multi-architecture | Process x64/ARM64 in parallel with matrix builds |

---

## Next Guides to Read

- **[01-auto-update.md](./01-auto-update.md)** — Implementing auto-update (electron-updater / Tauri updater)
- **[02-store-distribution.md](./02-store-distribution.md)** — Distribution to Microsoft Store / Mac App Store

---

## References

1. Electron Forge, "Configuration", https://www.electronforge.io/configuration
2. Electron Builder, "Configuration", https://www.electron.build/configuration
3. Tauri, "Building", https://v2.tauri.app/distribute/
4. Microsoft, "Authenticode Code Signing", https://learn.microsoft.com/windows/win32/seccrypto/cryptography-tools
5. Apple, "Notarizing macOS Software", https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution
6. Azure Trusted Signing, "Overview", https://learn.microsoft.com/azure/trusted-signing/overview
7. DigiCert, "KeyLocker Cloud Signing", https://docs.digicert.com/en/digicert-keylocker.html
8. Electron, "asar Archives", https://www.electronjs.org/docs/latest/tutorial/asar-archives
9. Tauri, "App Size Optimization", https://v2.tauri.app/concept/size/
10. NSIS, "Users Manual", https://nsis.sourceforge.io/Docs/

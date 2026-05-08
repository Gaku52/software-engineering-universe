# Store Distribution

> Learn the techniques for automated application distribution using Microsoft Store (MSIX), Mac App Store, and GitHub Releases in a CI/CD pipeline.

## What You Will Learn

1. **MSIX Packaging and Microsoft Store Distribution** -- Understand the full process of packaging Windows apps in MSIX format and publishing them to the Microsoft Store
2. **Mac App Store and GitHub Releases Distribution Strategies** -- Learn when to use macOS app sandboxing for the Mac App Store versus direct distribution via GitHub Releases
3. **Automated Build, Signing, and Publishing Pipelines with CI/CD** -- Build multi-platform release automation centered on GitHub Actions
4. **Linux Package Distribution** -- Understand distribution methods for Snap Store, Flathub, and self-hosted APT repositories
5. **Enterprise Distribution (LOB/MDM)** -- Understand enterprise app distribution using Microsoft Intune and Jamf


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Auto Update](./01-auto-update.md)

---

## 1. Overview of Distribution Channels

```
+------------------------------------------------------------------+
|                    Distribution Channel Selection Map             |
+------------------------------------------------------------------+
|                                                                  |
|  Source Code (GitHub / GitLab)                                   |
|       |                                                          |
|       v                                                          |
|  CI/CD Pipeline                                                  |
|       |                                                          |
|       +-----> Microsoft Store (MSIX)     [Windows Users]         |
|       |          - Auto-update & sandbox                         |
|       |          - Enterprise distribution (LOB)                 |
|       |                                                          |
|       +-----> Mac App Store (pkg/app)    [macOS Users]           |
|       |          - Sandbox required                              |
|       |          - Notarization required                         |
|       |                                                          |
|       +-----> GitHub Releases            [Developers/Power Users]|
|       |          - Direct download, flexible format              |
|       |          - electron-updater integration                  |
|       |                                                          |
|       +-----> Snap Store / Flathub       [Linux Users]           |
|       |          - Sandboxed distribution                        |
|       |          - Auto-update support                           |
|       |                                                          |
|       +-----> Own Website / CDN          [Enterprise]            |
|       |          - Full control                                  |
|       |          - Custom installer                              |
|       |                                                          |
|       +-----> Enterprise Distribution (LOB/MDM) [Internal Users] |
|                  - Intune / Jamf integration                     |
|                  - Silent installation                           |
|                                                                  |
+------------------------------------------------------------------+
```

### 1.1 Distribution Channel Comparison Table

| Item | Microsoft Store | Mac App Store | GitHub Releases | Snap Store | Own Website |
|------|----------------|---------------|-----------------|------------|-------------|
| Review | Yes (1-3 days) | Yes (1-7 days) | None | Yes (automated) | None |
| Fee | 15% (apps) / 12% (games) | 30% / 15% (small scale) | Free | Free | Free |
| Auto-update | OS standard | OS standard | Self-implemented | snapd | Self-implemented |
| Sandbox | MSIX has restrictions | Required | None | Yes (strict) | None |
| Reach | Windows 10/11 users | macOS users | Developers-focused | Ubuntu-centric | Any |
| Package format | MSIX / MSIX Bundle | pkg / app (zip) | exe/msi/dmg/AppImage | snap | Any |
| Enterprise distribution | LOB support | MDM support | Not supported | Not supported | Any |
| Offline install | Possible (sideload) | Not possible | Possible | Possible | Possible |

### 1.2 Distribution Channel Selection Flowchart

The following provides guidance for selecting the optimal distribution channel based on the nature of your application.

```
[Who is the target user?]
     |
     +--- General consumers (non-technical)
     |        |
     |        +--- Windows → Microsoft Store (MSIX) as first choice
     |        +--- macOS → Mac App Store as first choice
     |        +--- Linux → Snap Store / Flathub
     |
     +--- Developers / technical users
     |        |
     |        +--- GitHub Releases + auto-update (electron-updater / Tauri updater)
     |        +--- Supplement: also list on Store for discoverability
     |
     +--- Enterprise internal users
     |        |
     |        +--- Windows → Intune + MSIX sideload
     |        +--- macOS → Jamf + pkg
     |        +--- Common → Own CDN + MDM integration
     |
     +--- Maximum reach across all platforms
              |
              +--- Store + GitHub Releases + own website: three pillars
              +--- Simultaneous multi-channel delivery via CI/CD
```

---

## 2. Microsoft Store (MSIX) Distribution

### 2.1 MSIX Package Structure

```
+-----------------------------------------------+
|  MSIX Package (.msix)                          |
+-----------------------------------------------+
|                                               |
|  AppxManifest.xml    <- App info & permissions |
|  Assets/                                      |
|    +-- Square150x150Logo.png                  |
|    +-- Square44x44Logo.png                    |
|    +-- StoreLogo.png                          |
|    +-- Wide310x150Logo.png                    |
|    +-- LargeTile.png (310x310)               |
|    +-- SplashScreen.png (620x300)            |
|    +-- BadgeLogo.png (24x24)                 |
|  app/                                         |
|    +-- myapp.exe                              |
|    +-- resources/                             |
|    +-- node_modules/ (for Electron)           |
|  AppxBlockMap.xml    <- Block-level hashes     |
|  AppxSignature.p7x   <- Digital signature     |
|  [Content_Types].xml                          |
|                                               |
+-----------------------------------------------+
```

### 2.2 Generating MSIX with electron-builder

```yaml
# electron-builder.yml
appId: com.example.myapp
productName: MyApp
copyright: Copyright (c) 2025 Example Inc.

win:
  target:
    - target: msix
      arch: [x64, arm64]
    - target: nsis
      arch: [x64]

msix:
  identityName: "12345ExampleInc.MyApp"
  publisher: "CN=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
  publisherDisplayName: "Example Inc."
  applicationId: "MyApp"
  setBuildNumber: true
  languages:
    - "ja-JP"
    - "en-US"

publish:
  - provider: github
    owner: example-inc
    repo: myapp
```

### 2.3 AppxManifest.xml Configuration

```xml
<?xml version="1.0" encoding="utf-8"?>
<Package
  xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:uap3="http://schemas.microsoft.com/appx/manifest/uap/windows10/3"
  xmlns:desktop="http://schemas.microsoft.com/appx/manifest/desktop/windows10"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities">

  <Identity
    Name="12345ExampleInc.MyApp"
    Version="1.2.0.0"
    Publisher="CN=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
    ProcessorArchitecture="x64" />

  <Properties>
    <DisplayName>MyApp</DisplayName>
    <PublisherDisplayName>Example Inc.</PublisherDisplayName>
    <Logo>Assets\StoreLogo.png</Logo>
    <Description>高機能なデスクトップアプリケーション</Description>
  </Properties>

  <Dependencies>
    <TargetDeviceFamily
      Name="Windows.Desktop"
      MinVersion="10.0.17763.0"
      MaxVersionTested="10.0.22621.0" />
  </Dependencies>

  <Resources>
    <Resource Language="ja-JP" />
    <Resource Language="en-US" />
  </Resources>

  <Applications>
    <Application
      Id="MyApp"
      Executable="app\myapp.exe"
      EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements
        DisplayName="MyApp"
        Description="My awesome desktop application"
        BackgroundColor="transparent"
        Square150x150Logo="Assets\Square150x150Logo.png"
        Square44x44Logo="Assets\Square44x44Logo.png">
        <uap:DefaultTile
          Wide310x150Logo="Assets\Wide310x150Logo.png"
          Square310x310Logo="Assets\LargeTile.png"
          ShortName="MyApp" />
        <uap:SplashScreen Image="Assets\SplashScreen.png" />
      </uap:VisualElements>

      <!-- File associations -->
      <Extensions>
        <uap:Extension Category="windows.fileTypeAssociation">
          <uap:FileTypeAssociation Name="myapp-project">
            <uap:SupportedFileTypes>
              <uap:FileType>.myapp</uap:FileType>
              <uap:FileType>.myproj</uap:FileType>
            </uap:SupportedFileTypes>
            <uap:DisplayName>MyApp Project</uap:DisplayName>
            <uap:Logo>Assets\FileIcon.png</uap:Logo>
          </uap:FileTypeAssociation>
        </uap:Extension>

        <!-- Protocol handler (launch via myapp://) -->
        <uap:Extension Category="windows.protocol">
          <uap:Protocol Name="myapp">
            <uap:DisplayName>MyApp Protocol</uap:DisplayName>
          </uap:Protocol>
        </uap:Extension>

        <!-- Startup launch -->
        <desktop:Extension Category="windows.startupTask">
          <desktop:StartupTask
            TaskId="MyAppStartup"
            Enabled="false"
            DisplayName="MyApp を起動時に実行" />
        </desktop:Extension>

        <!-- Toast notification activation -->
        <desktop:Extension Category="windows.toastNotificationActivation">
          <desktop:ToastNotificationActivation
            ToastActivatorCLSID="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" />
        </desktop:Extension>
      </Extensions>
    </Application>
  </Applications>

  <Capabilities>
    <Capability Name="internetClient" />
    <Capability Name="internetClientServer" />
    <rescap:Capability Name="runFullTrust" />
    <uap3:Capability Name="backgroundMediaPlayback" />
  </Capabilities>
</Package>
```

### 2.4 Partner Center Submission Flow

```
+------------------------------------------------------------------+
|           Microsoft Store Submission Flow                         |
+------------------------------------------------------------------+
|                                                                  |
|  1. Create a Partner Center account ($19 one-time fee)           |
|       |                                                          |
|  2. Reserve the app name                                         |
|       |                                                          |
|  3. Retrieve identity information                                |
|     (identityName, publisher, publisherDisplayName)              |
|       |                                                          |
|  4. Build & sign the MSIX package                                |
|       |                                                          |
|  5. Upload to Partner Center                                     |
|     - Package (.msix / .msixbundle)                              |
|     - Screenshots (at least 1)                                   |
|     - Description (Japanese/English)                             |
|     - Privacy policy URL                                         |
|       |                                                          |
|  6. Certification testing (automated + manual)                   |
|     - Security scan                                              |
|     - API compliance check                                       |
|     - Content policy                                             |
|       |                                                          |
|  7. Publish (after passing review: immediate or scheduled)       |
|                                                                  |
+------------------------------------------------------------------+
```

### 2.5 Automated Submission via Partner Center API

The following script automatically submits MSIX packages to Partner Center from a CI/CD pipeline using the Partner Center Submission API.

```typescript
// scripts/submit-to-store.ts
// Partner Center Submission API を使った自動提出
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

interface SubmissionConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  appId: string;
}

interface AccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface Submission {
  id: string;
  status: string;
  statusDetails: {
    errors: Array<{ code: string; details: string }>;
    warnings: Array<{ code: string; details: string }>;
  };
  fileUploadUrl: string;
}

class PartnerCenterClient {
  private config: SubmissionConfig;
  private accessToken: string = '';

  constructor(config: SubmissionConfig) {
    this.config = config;
  }

  // Azure AD でアクセストークンを取得
  async authenticate(): Promise<void> {
    const tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'https://manage.devcenter.microsoft.com/.default',
      }),
    });

    const data = (await response.json()) as AccessTokenResponse;
    this.accessToken = data.access_token;
    console.log('Partner Center 認証成功');
  }

  // 新しいサブミッションを作成
  async createSubmission(): Promise<Submission> {
    const url = `https://manage.devcenter.microsoft.com/v1.0/my/applications/${this.config.appId}/submissions`;

    // 既存の保留中サブミッションを削除
    const pendingResponse = await fetch(url, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    const pending = await pendingResponse.json() as any;
    if (pending.pendingApplicationSubmission) {
      await fetch(`${url}/${pending.pendingApplicationSubmission.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      console.log('既存の保留中サブミッションを削除しました');
    }

    // 新規サブミッション作成
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const submission = (await response.json()) as Submission;
    console.log(`サブミッション作成: ${submission.id}`);
    return submission;
  }

  // MSIX パッケージをアップロード
  async uploadPackage(submission: Submission, msixPath: string): Promise<void> {
    const zipPath = msixPath.replace('.msix', '.zip');

    // MSIX を ZIP として準備（Azure Blob Storage への直接アップロード）
    const fileBuffer = fs.readFileSync(msixPath);

    const response = await fetch(submission.fileUploadUrl, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': 'application/octet-stream',
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      throw new Error(`パッケージアップロード失敗: ${response.status}`);
    }
    console.log('パッケージアップロード完了');
  }

  // サブミッションをコミット (審査に提出)
  async commitSubmission(submissionId: string): Promise<void> {
    const url =
      `https://manage.devcenter.microsoft.com/v1.0/my/applications/${this.config.appId}/submissions/${submissionId}/commit`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`サブミッションコミット失敗: ${response.status}`);
    }
    console.log('サブミッションをコミットしました（審査開始）');
  }

  // サブミッション状態のポーリング
  async waitForCompletion(submissionId: string): Promise<string> {
    const url =
      `https://manage.devcenter.microsoft.com/v1.0/my/applications/${this.config.appId}/submissions/${submissionId}/status`;

    const maxRetries = 60; // 最大60回 (= 1時間)
    for (let i = 0; i < maxRetries; i++) {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      const status = (await response.json()) as { status: string; statusDetails: any };

      console.log(`ステータス: ${status.status} (${i + 1}/${maxRetries})`);

      if (status.status === 'CommitFailed') {
        console.error('エラー:', JSON.stringify(status.statusDetails, null, 2));
        throw new Error('サブミッションのコミットが失敗しました');
      }

      if (status.status === 'PreProcessing' || status.status === 'Certification') {
        // まだ処理中
      }

      if (status.status === 'Published' || status.status === 'Release') {
        return status.status;
      }

      // 1分待機してリトライ
      await new Promise((resolve) => setTimeout(resolve, 60_000));
    }

    throw new Error('タイムアウト: サブミッション完了を待機中');
  }
}

// メイン実行
async function main(): Promise<void> {
  const config: SubmissionConfig = {
    tenantId: process.env.AZURE_TENANT_ID!,
    clientId: process.env.AZURE_CLIENT_ID!,
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
    appId: process.env.PARTNER_CENTER_APP_ID!,
  };

  const client = new PartnerCenterClient(config);

  await client.authenticate();
  const submission = await client.createSubmission();
  await client.uploadPackage(submission, path.resolve(process.argv[2]));
  await client.commitSubmission(submission.id);

  console.log('サブミッションが審査に提出されました');
  console.log('Partner Center ダッシュボードで進捗を確認してください');
}

main().catch((error) => {
  console.error('提出エラー:', error.message);
  process.exit(1);
});
```

### 2.6 Pre-validation with WACK (Windows App Certification Kit)

Before submitting to the Microsoft Store, use WACK to run pre-validation locally.

```powershell
# PowerShell: WACK による MSIX 検証
# WACK のパス (Windows 10 SDK に含まれる)
$wackPath = "C:\Program Files (x86)\Windows Kits\10\App Certification Kit\appcert.exe"

# テスト対象の MSIX パッケージ
$msixPath = ".\dist\MyApp-1.2.0-x64.msix"

# レポート出力先
$reportPath = ".\dist\wack-report.xml"

# MSIX パッケージのテスト実行
& $wackPath test -appxpackagepath $msixPath -reportoutputpath $reportPath

# レポートの解析
[xml]$report = Get-Content $reportPath
$overallResult = $report.REPORT.OVERALL_RESULT.InnerText

if ($overallResult -eq "PASS") {
    Write-Host "✓ WACK テスト合格" -ForegroundColor Green
} else {
    Write-Host "✗ WACK テスト不合格" -ForegroundColor Red

    # 失敗したテストの一覧を表示
    $failedTests = $report.REPORT.REQUIREMENTS.REQUIREMENT | Where-Object {
        $_.RESULT -eq "FAIL"
    }

    foreach ($test in $failedTests) {
        Write-Host "  不合格: $($test.TEST.NAME)" -ForegroundColor Yellow
        Write-Host "  理由: $($test.TEST.DESCRIPTION)" -ForegroundColor Yellow
    }
}
```

```powershell
# PowerShell: MSIX のサイドロードインストール（テスト用）
# 開発者モードの確認
$devMode = Get-WindowsDeveloperLicenseRegistration -ErrorAction SilentlyContinue
if (-not $devMode) {
    Write-Host "開発者モードを有効にしてください:" -ForegroundColor Yellow
    Write-Host "設定 → 更新とセキュリティ → 開発者向け → 開発者モード"
    exit 1
}

# MSIX パッケージのインストール
Add-AppxPackage -Path ".\dist\MyApp-1.2.0-x64.msix"

# インストール確認
$app = Get-AppxPackage | Where-Object { $_.Name -like "*MyApp*" }
if ($app) {
    Write-Host "インストール成功: $($app.Name) v$($app.Version)" -ForegroundColor Green
    Write-Host "PackageFamilyName: $($app.PackageFamilyName)"
} else {
    Write-Host "インストール失敗" -ForegroundColor Red
}
```

### 2.7 MSIX Bundle (Multi-Architecture)

```powershell
# PowerShell: 複数アーキテクチャの MSIX を Bundle にまとめる
$makeAppxPath = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\makeappx.exe"

# 各アーキテクチャの MSIX を作成済みとする
$x64Msix = ".\dist\MyApp-1.2.0-x64.msix"
$arm64Msix = ".\dist\MyApp-1.2.0-arm64.msix"

# Bundle の作成
$bundlePath = ".\dist\MyApp-1.2.0.msixbundle"
& $makeAppxPath bundle /d ".\dist\msix-packages" /p $bundlePath

# Bundle の署名
$signtoolPath = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe"
& $signtoolPath sign /fd SHA256 /a /f ".\certs\store-cert.pfx" /p $env:CERT_PASSWORD $bundlePath

Write-Host "MSIX Bundle 作成完了: $bundlePath"
```

---

## 3. Mac App Store Distribution

### 3.1 Sandbox-Compatible Entitlements

```xml
<!-- entitlements.mas.plist (Mac App Store 用) -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- App Sandbox 必須 -->
    <key>com.apple.security.app-sandbox</key>
    <true/>

    <!-- ネットワークアクセス -->
    <key>com.apple.security.network.client</key>
    <true/>

    <!-- ファイルアクセス (ユーザー選択のみ) -->
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>

    <!-- ダウンロードフォルダ -->
    <key>com.apple.security.files.downloads.read-write</key>
    <true/>

    <!-- Hardened Runtime -->
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
</dict>
</plist>
```

```xml
<!-- entitlements.mas.inherit.plist (子プロセス用) -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <true/>
    <key>com.apple.security.inherit</key>
    <true/>
</dict>
</plist>
```

```xml
<!-- entitlements.mac.plist (直接配布用 - サンドボックスなし) -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Hardened Runtime (Notarization に必要) -->
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>

    <!-- 直接配布ではサンドボックスなし -->
    <!-- ファイルシステム全体にアクセス可能 -->
</dict>
</plist>
```

### 3.2 electron-builder Mac App Store Configuration

```yaml
# electron-builder.yml (macOS 部分)
mac:
  target:
    - target: mas  # Mac App Store 用
      arch: [x64, arm64, universal]
    - target: dmg  # 直接配布用
      arch: [universal]
  category: public.app-category.developer-tools
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist

mas:
  entitlements: build/entitlements.mas.plist
  entitlementsInherit: build/entitlements.mas.inherit.plist
  provisioningProfile: build/embedded.provisionprofile
  # App Store 固有の設定
  binaries:
    # Electron Helper 等、子プロセスの署名設定
    - x86_64: false
      arm64: false

afterSign: scripts/notarize.js
```

### 3.3 Notarization Script

```javascript
// scripts/notarize.js
const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') return;

  // Mac App Store ビルドでは不要 (Apple が署名する)
  if (context.packager.config.mac?.target?.[0]?.target === 'mas') return;

  const appName = context.packager.appInfo.productFilename;

  console.log(`Notarizing ${appName}...`);

  await notarize({
    appBundleId: 'com.example.myapp',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });

  console.log('Notarization 完了');
};
```

### 3.4 Automating App Store Connect Submission

```bash
#!/bin/bash
# scripts/submit-to-app-store.sh
# App Store Connect への自動提出スクリプト

set -euo pipefail

APP_PATH="$1"
APPLE_ID="${APPLE_ID:?APPLE_ID が未設定です}"
APPLE_ASP="${APPLE_APP_SPECIFIC_PASSWORD:?APPLE_APP_SPECIFIC_PASSWORD が未設定です}"
TEAM_ID="${APPLE_TEAM_ID:?APPLE_TEAM_ID が未設定です}"

echo "=== App Store Connect 提出スクリプト ==="

# 1. pkg ファイルの作成（MAS ビルドの場合）
echo "[1/4] pkg ファイルの作成..."
INSTALLER_CERT="3rd Party Mac Developer Installer: Example Inc. (${TEAM_ID})"
PKG_PATH="${APP_PATH%.app}.pkg"

productbuild \
  --component "$APP_PATH" /Applications \
  --sign "$INSTALLER_CERT" \
  "$PKG_PATH"

echo "pkg 作成完了: $PKG_PATH"

# 2. パッケージの検証
echo "[2/4] パッケージの検証..."
xcrun altool --validate-app \
  --file "$PKG_PATH" \
  --type macos \
  --username "$APPLE_ID" \
  --password "$APPLE_ASP" \
  --team-id "$TEAM_ID"

echo "検証合格"

# 3. App Store Connect へアップロード
echo "[3/4] App Store Connect へアップロード..."
xcrun altool --upload-app \
  --file "$PKG_PATH" \
  --type macos \
  --username "$APPLE_ID" \
  --password "$APPLE_ASP" \
  --team-id "$TEAM_ID"

echo "アップロード完了"

# 4. (代替) notarytool を使った方法 (macOS 13+)
# xcrun notarytool submit "$PKG_PATH" \
#   --apple-id "$APPLE_ID" \
#   --password "$APPLE_ASP" \
#   --team-id "$TEAM_ID" \
#   --wait

echo "[4/4] App Store Connect ダッシュボードで審査を開始してください"
echo "=== 提出完了 ==="
```

### 3.5 Managing Provisioning Profiles

```bash
#!/bin/bash
# Mac App Store 用 Provisioning Profile のセットアップ
# CI 環境での自動化

set -euo pipefail

PROFILE_BASE64="${MAS_PROVISIONING_PROFILE_BASE64:?Profile が未設定です}"
PROFILE_DIR="$HOME/Library/MobileDevice/Provisioning Profiles"
PROFILE_PATH="${PROFILE_DIR}/embedded.provisionprofile"

# ディレクトリ作成
mkdir -p "$PROFILE_DIR"

# Base64 デコードして配置
echo "$PROFILE_BASE64" | base64 -d > "$PROFILE_PATH"

# プロファイル情報の確認
echo "=== Provisioning Profile 情報 ==="
security cms -D -i "$PROFILE_PATH" 2>/dev/null | \
  /usr/libexec/PlistBuddy -c "Print :Name" /dev/stdin
security cms -D -i "$PROFILE_PATH" 2>/dev/null | \
  /usr/libexec/PlistBuddy -c "Print :TeamIdentifier:0" /dev/stdin
security cms -D -i "$PROFILE_PATH" 2>/dev/null | \
  /usr/libexec/PlistBuddy -c "Print :ExpirationDate" /dev/stdin

echo "プロファイル配置完了: $PROFILE_PATH"

# ビルドディレクトリにもコピー（electron-builder が参照する）
cp "$PROFILE_PATH" "./build/embedded.provisionprofile"
```

### 3.6 Tauri App Support for Mac App Store

```rust
// src-tauri/src/main.rs
// Tauri v2 で Mac App Store 対応する場合の設定

#[cfg(target_os = "macos")]
mod mac_app_store {
    use std::path::PathBuf;

    /// Mac App Store のサンドボックス環境で正しいパスを取得
    pub fn get_container_path() -> Option<PathBuf> {
        // サンドボックス環境では ~/Library/Containers/<bundle-id>/Data 配下に制限
        let home = std::env::var("HOME").ok()?;
        let container = PathBuf::from(home);

        if container.to_string_lossy().contains("Containers") {
            // サンドボックス内で実行中
            Some(container)
        } else {
            // サンドボックス外 (開発時)
            None
        }
    }

    /// サンドボックス環境かどうかを判定
    pub fn is_sandboxed() -> bool {
        std::env::var("APP_SANDBOX_CONTAINER_ID").is_ok()
    }

    /// ブックマークを使った永続的なファイルアクセス (Security-Scoped Bookmarks)
    /// サンドボックスでユーザーが選択したファイルへの継続的アクセスを実現
    pub fn save_security_scoped_bookmark(url: &str) -> Result<Vec<u8>, String> {
        // macOS の Security-Scoped Bookmark API を呼び出す
        // 実際の実装では objc クレートや cocoa クレートが必要
        // ここでは概念的な実装を示す
        Err("未実装: objc バインディングが必要".to_string())
    }
}

use tauri::Manager;

#[tauri::command]
fn check_sandbox_status() -> serde_json::Value {
    #[cfg(target_os = "macos")]
    {
        let sandboxed = mac_app_store::is_sandboxed();
        let container = mac_app_store::get_container_path()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        serde_json::json!({
            "sandboxed": sandboxed,
            "containerPath": container,
            "platform": "macos"
        })
    }

    #[cfg(not(target_os = "macos"))]
    {
        serde_json::json!({
            "sandboxed": false,
            "containerPath": "",
            "platform": std::env::consts::OS
        })
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![check_sandbox_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 4. GitHub Releases Distribution

### 4.1 GitHub Actions Workflow (Electron)

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: windows-latest
            platform: win
          - os: macos-latest
            platform: mac
          - os: ubuntu-latest
            platform: linux

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      # Windows 署名
      - name: Import Windows Certificate
        if: matrix.platform == 'win'
        run: |
          echo "${{ secrets.WIN_CERT_BASE64 }}" | base64 -d > cert.pfx
        shell: bash

      # macOS 署名
      - name: Import macOS Certificate
        if: matrix.platform == 'mac'
        uses: apple-actions/import-codesign-certs@v2
        with:
          p12-file-base64: ${{ secrets.MAC_CERT_BASE64 }}
          p12-password: ${{ secrets.MAC_CERT_PASSWORD }}

      # ビルド & 公開
      - name: Build and Publish
        run: npx electron-builder --publish always
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          WIN_CSC_LINK: cert.pfx
          WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CERT_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_ASP }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}

      # リリースノート自動生成
      - name: Generate Release Notes
        if: matrix.platform == 'linux'  # 1回だけ実行
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
          draft: true
```

### 4.2 Tauri GitHub Actions Workflow

```yaml
# .github/workflows/tauri-release.yml
name: Tauri Release

on:
  push:
    tags:
      - 'v*'

jobs:
  create-release:
    runs-on: ubuntu-latest
    outputs:
      release_id: ${{ steps.create.outputs.result }}
    steps:
      - uses: actions/github-script@v7
        id: create
        with:
          script: |
            const { data } = await github.rest.repos.createRelease({
              owner: context.repo.owner,
              repo: context.repo.repo,
              tag_name: `${context.ref.replace('refs/tags/', '')}`,
              name: `Release ${context.ref.replace('refs/tags/', '')}`,
              draft: true,
              prerelease: false,
            });
            return data.id;

  build:
    needs: create-release
    strategy:
      matrix:
        include:
          - os: windows-latest
            target: x86_64-pc-windows-msvc
          - os: macos-latest
            target: aarch64-apple-darwin
          - os: macos-latest
            target: x86_64-apple-darwin
          - os: ubuntu-latest
            target: x86_64-unknown-linux-gnu

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      # Linux 依存パッケージ
      - name: Install Linux dependencies
        if: matrix.os == 'ubuntu-latest'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev \
            libappindicator3-dev \
            librsvg2-dev \
            patchelf

      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_KEY_PASS }}
        with:
          releaseId: ${{ needs.create-release.outputs.release_id }}
          args: --target ${{ matrix.target }}

  # Draft リリースを公開
  publish-release:
    needs: [create-release, build]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            await github.rest.repos.updateRelease({
              owner: context.repo.owner,
              repo: context.repo.repo,
              release_id: ${{ needs.create-release.outputs.release_id }},
              draft: false,
            });
```

### 4.3 Automated Release Notes Generation

```typescript
// scripts/generate-release-notes.ts
// Conventional Commits からリリースノートを自動生成
import { execSync } from 'child_process';

interface CommitInfo {
  hash: string;
  type: string;
  scope: string;
  subject: string;
  breaking: boolean;
}

function parseCommits(since: string): CommitInfo[] {
  const log = execSync(
    `git log ${since}..HEAD --pretty=format:"%H|%s" --no-merges`
  ).toString();

  return log
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, subject] = line.split('|');
      // Conventional Commit パターン: type(scope): subject
      const match = subject.match(/^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.*)$/);

      if (!match) {
        return { hash, type: 'other', scope: '', subject, breaking: false };
      }

      return {
        hash: hash.substring(0, 8),
        type: match[1],
        scope: match[2] || '',
        subject: match[4],
        breaking: match[3] === '!',
      };
    });
}

function generateNotes(commits: CommitInfo[]): string {
  const sections: Record<string, { title: string; items: string[] }> = {
    feat: { title: 'New Features', items: [] },
    fix: { title: 'Bug Fixes', items: [] },
    perf: { title: 'Performance Improvements', items: [] },
    refactor: { title: 'Refactoring', items: [] },
    docs: { title: 'Documentation', items: [] },
    chore: { title: 'Other', items: [] },
  };

  const breakingChanges: string[] = [];

  for (const commit of commits) {
    if (commit.breaking) {
      breakingChanges.push(`- ${commit.subject} (${commit.hash})`);
    }

    const section = sections[commit.type] || sections.chore;
    const scope = commit.scope ? `**${commit.scope}**: ` : '';
    section.items.push(`- ${scope}${commit.subject} (${commit.hash})`);
  }

  let notes = '';

  if (breakingChanges.length > 0) {
    notes += '## Breaking Changes\n\n';
    notes += breakingChanges.join('\n') + '\n\n';
  }

  for (const [_, section] of Object.entries(sections)) {
    if (section.items.length > 0) {
      notes += `## ${section.title}\n\n`;
      notes += section.items.join('\n') + '\n\n';
    }
  }

  return notes;
}

// 直前のタグから HEAD までのコミットを解析
const lastTag = execSync('git describe --tags --abbrev=0 HEAD~1 2>/dev/null || echo ""')
  .toString()
  .trim();

const since = lastTag || execSync('git rev-list --max-parents=0 HEAD').toString().trim();
const commits = parseCommits(since);
const notes = generateNotes(commits);

console.log(notes);
```

---

## 5. Linux Package Distribution

### 5.1 Snap Package

```yaml
# snap/snapcraft.yaml
name: myapp
base: core22
version: '1.2.0'
summary: Feature-rich desktop application
description: |
  MyApp is a feature-rich desktop application.
  Cross-platform with an intuitive UI.

grade: stable
confinement: strict

architectures:
  - build-on: [amd64]
  - build-on: [arm64]

apps:
  myapp:
    command: myapp
    desktop: usr/share/applications/myapp.desktop
    extensions: [gnome]
    plugs:
      - home
      - network
      - network-bind
      - desktop
      - desktop-legacy
      - wayland
      - x11
      - browser-support
      - removable-media

parts:
  myapp:
    plugin: dump
    source: dist/linux-unpacked/
    stage-packages:
      - libgtk-3-0
      - libnotify4
      - libnss3
      - libxss1
      - libxtst6
      - xdg-utils
      - libatspi2.0-0
      - libuuid1
      - libsecret-1-0
```

```bash
#!/bin/bash
# scripts/publish-to-snap-store.sh
# Snap Store への自動公開

set -euo pipefail

SNAP_FILE="$1"
CHANNEL="${2:-edge}"  # edge, beta, candidate, stable

echo "=== Snap Store 公開スクリプト ==="

# Snapcraft ログイン (CI 環境ではエクスポートした認証情報を使用)
if [ -n "${SNAPCRAFT_STORE_CREDENTIALS:-}" ]; then
    echo "$SNAPCRAFT_STORE_CREDENTIALS" | snapcraft login --with -
fi

# Snap パッケージの検証
echo "[1/3] パッケージ検証中..."
snap review "$SNAP_FILE" || true  # 警告は無視

# アップロード & リリース
echo "[2/3] $CHANNEL チャネルにアップロード中..."
snapcraft upload "$SNAP_FILE" --release="$CHANNEL"

# 公開状態の確認
echo "[3/3] 公開状態の確認..."
snapcraft status myapp

echo "=== Snap Store 公開完了 (チャネル: $CHANNEL) ==="
```

### 5.2 Flatpak Package

```yaml
# com.example.MyApp.yaml (Flatpak マニフェスト)
app-id: com.example.MyApp
runtime: org.freedesktop.Platform
runtime-version: '23.08'
sdk: org.freedesktop.Sdk
command: myapp
finish-args:
  - --share=ipc
  - --socket=x11
  - --socket=wayland
  - --socket=pulseaudio
  - --share=network
  - --device=dri
  - --filesystem=home
  - --filesystem=/tmp
  - --talk-name=org.freedesktop.Notifications
  - --talk-name=org.kde.StatusNotifierWatcher

modules:
  - name: myapp
    buildsystem: simple
    build-commands:
      - install -Dm755 myapp /app/bin/myapp
      - install -Dm644 myapp.desktop /app/share/applications/com.example.MyApp.desktop
      - install -Dm644 myapp-icon-256.png /app/share/icons/hicolor/256x256/apps/com.example.MyApp.png
    sources:
      - type: archive
        url: https://github.com/example-inc/myapp/releases/download/v1.2.0/myapp-linux-x64.tar.gz
        sha256: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### 5.3 Building a Self-Hosted APT Repository

```bash
#!/bin/bash
# scripts/setup-apt-repo.sh
# S3 + CloudFront を使った APT リポジトリの構築

set -euo pipefail

REPO_DIR="./apt-repo"
GPG_KEY_ID="${GPG_SIGNING_KEY_ID:?GPG_SIGNING_KEY_ID が未設定です}"
S3_BUCKET="${APT_REPO_BUCKET:?APT_REPO_BUCKET が未設定です}"

# ディレクトリ構成
mkdir -p "$REPO_DIR/pool/main"
mkdir -p "$REPO_DIR/dists/stable/main/binary-amd64"
mkdir -p "$REPO_DIR/dists/stable/main/binary-arm64"

# deb パッケージをプールに配置
cp dist/*.deb "$REPO_DIR/pool/main/"

# Packages ファイルの生成
cd "$REPO_DIR"
dpkg-scanpackages pool/main /dev/null > dists/stable/main/binary-amd64/Packages
gzip -k dists/stable/main/binary-amd64/Packages

# Release ファイルの生成
cat > dists/stable/Release << EOF
Origin: MyApp Repository
Label: MyApp
Suite: stable
Codename: stable
Version: 1.0
Architectures: amd64 arm64
Components: main
Description: MyApp APT Repository
EOF

# チェックサムの追加
apt-ftparchive release dists/stable >> dists/stable/Release

# GPG 署名
gpg --default-key "$GPG_KEY_ID" -abs -o dists/stable/Release.gpg dists/stable/Release
gpg --default-key "$GPG_KEY_ID" --clearsign -o dists/stable/InRelease dists/stable/Release

# S3 にアップロード
aws s3 sync "$REPO_DIR" "s3://$S3_BUCKET/" \
  --delete \
  --cache-control "max-age=300"

echo "=== APT リポジトリ更新完了 ==="
echo "User-side configuration:"
echo "  curl -fsSL https://apt.example.com/gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/myapp.gpg"
echo "  echo 'deb [signed-by=/etc/apt/keyrings/myapp.gpg] https://apt.example.com stable main' | sudo tee /etc/apt/sources.list.d/myapp.list"
echo "  sudo apt update && sudo apt install myapp"
```

---

## 6. CI/CD Pipeline Overall Design

### 6.1 Overview of the Release Pipeline

```
+------------------------------------------------------------------+
|                    Release Pipeline Overview                      |
+------------------------------------------------------------------+
|                                                                  |
|  [Developer]                                                     |
|     |                                                            |
|     v  git tag v1.2.0 && git push --tags                        |
|                                                                  |
|  [GitHub Actions]                                                |
|     |                                                            |
|     +---> [Windows Runner]                                       |
|     |       - npm ci                                             |
|     |       - npm test                                           |
|     |       - electron-builder --win (NSIS + MSIX)               |
|     |       - signtool (Authenticode signature)                  |
|     |       - Upload to GitHub Release                           |
|     |       - Upload to Partner Center (MSIX)                    |
|     |                                                            |
|     +---> [macOS Runner]                                         |
|     |       - npm ci                                             |
|     |       - npm test                                           |
|     |       - electron-builder --mac (DMG + MAS)                 |
|     |       - codesign + notarize                                |
|     |       - Upload to GitHub Release                           |
|     |       - Upload to App Store Connect (xcrun altool)         |
|     |                                                            |
|     +---> [Linux Runner]                                         |
|             - npm ci                                             |
|             - npm test                                           |
|             - electron-builder --linux (AppImage + deb + snap)   |
|             - Upload to GitHub Release                           |
|             - Upload to Snap Store                               |
|                                                                  |
+------------------------------------------------------------------+
```

### 6.2 Multi-Store Integrated Release Workflow

```yaml
# .github/workflows/multi-store-release.yml
# 全ストアへの統合リリースワークフロー
name: Multi-Store Release

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Release version (e.g. 1.2.0)'
        required: true
      channels:
        description: 'Release channels (comma separated: github,msstore,appstore,snap)'
        required: true
        default: 'github,msstore,appstore,snap'
      prerelease:
        description: 'Publish as pre-release'
        type: boolean
        default: false

jobs:
  # Step 1: Version bump and tag creation
  prepare:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.version }}
      tag: ${{ steps.version.outputs.tag }}
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.PAT_TOKEN }}

      - name: Set version
        id: version
        run: |
          VERSION="${{ inputs.version }}"
          echo "version=$VERSION" >> $GITHUB_OUTPUT
          echo "tag=v$VERSION" >> $GITHUB_OUTPUT

      - name: Bump version in package.json
        run: |
          npm version ${{ steps.version.outputs.version }} --no-git-tag-version
          git add package.json package-lock.json
          git commit -m "chore: bump version to v${{ steps.version.outputs.version }}"
          git tag v${{ steps.version.outputs.version }}
          git push --follow-tags

  # Step 2: Multi-platform build
  build-windows:
    needs: prepare
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: v${{ needs.prepare.outputs.version }}

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Build Windows packages
        run: npx electron-builder --win --publish never
        env:
          WIN_CSC_LINK: ${{ secrets.WIN_CERT_BASE64 }}
          WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CERT_PASSWORD }}

      - uses: actions/upload-artifact@v4
        with:
          name: windows-artifacts
          path: |
            dist/*.exe
            dist/*.msix
            dist/*.msixbundle
            dist/latest.yml

  build-macos:
    needs: prepare
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: v${{ needs.prepare.outputs.version }}

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - uses: apple-actions/import-codesign-certs@v2
        with:
          p12-file-base64: ${{ secrets.MAC_CERT_BASE64 }}
          p12-password: ${{ secrets.MAC_CERT_PASSWORD }}

      - run: npm ci

      - name: Build macOS packages
        run: npx electron-builder --mac --publish never
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_ASP }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}

      - uses: actions/upload-artifact@v4
        with:
          name: macos-artifacts
          path: |
            dist/*.dmg
            dist/*.pkg
            dist/*.zip
            dist/latest-mac.yml

  build-linux:
    needs: prepare
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: v${{ needs.prepare.outputs.version }}

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Build Linux packages
        run: npx electron-builder --linux --publish never

      - uses: actions/upload-artifact@v4
        with:
          name: linux-artifacts
          path: |
            dist/*.AppImage
            dist/*.deb
            dist/*.snap
            dist/latest-linux.yml

  # Step 3: GitHub Releases
  publish-github:
    needs: [prepare, build-windows, build-macos, build-linux]
    if: contains(inputs.channels, 'github')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: v${{ needs.prepare.outputs.version }}
          name: Release v${{ needs.prepare.outputs.version }}
          draft: false
          prerelease: ${{ inputs.prerelease }}
          generate_release_notes: true
          files: |
            windows-artifacts/*.exe
            windows-artifacts/*.msix
            windows-artifacts/latest.yml
            macos-artifacts/*.dmg
            macos-artifacts/*.zip
            macos-artifacts/latest-mac.yml
            linux-artifacts/*.AppImage
            linux-artifacts/*.deb
            linux-artifacts/latest-linux.yml

  # Step 4: Microsoft Store
  publish-msstore:
    needs: [prepare, build-windows]
    if: contains(inputs.channels, 'msstore')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: windows-artifacts

      - name: Submit to Partner Center
        run: npx ts-node scripts/submit-to-store.ts "*.msixbundle"
        env:
          AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
          AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
          AZURE_CLIENT_SECRET: ${{ secrets.AZURE_CLIENT_SECRET }}
          PARTNER_CENTER_APP_ID: ${{ secrets.PARTNER_CENTER_APP_ID }}

  # Step 5: Snap Store
  publish-snap:
    needs: [prepare, build-linux]
    if: contains(inputs.channels, 'snap')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: linux-artifacts

      - uses: snapcore/action-publish@v1
        env:
          SNAPCRAFT_STORE_CREDENTIALS: ${{ secrets.SNAPCRAFT_STORE_CREDENTIALS }}
        with:
          snap: "*.snap"
          release: stable
```

### 6.3 Semantic Versioning and Release Automation

```typescript
// scripts/bump-version.ts
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import semver from 'semver';

type ReleaseType = 'patch' | 'minor' | 'major';

interface VersionFile {
  path: string;
  // JSON パス (dot 区切り) でバージョンフィールドを指定
  jsonPath: string;
}

// バージョンを更新すべきファイルの一覧
const VERSION_FILES: VersionFile[] = [
  { path: 'package.json', jsonPath: 'version' },
  { path: 'src-tauri/tauri.conf.json', jsonPath: 'version' },
  { path: 'src-tauri/Cargo.toml', jsonPath: '' }, // TOML は別処理
];

function updateJsonVersion(filePath: string, jsonPath: string, newVersion: string): boolean {
  if (!existsSync(filePath)) return false;

  const content = JSON.parse(readFileSync(filePath, 'utf-8'));
  const keys = jsonPath.split('.');
  let obj = content;

  for (let i = 0; i < keys.length - 1; i++) {
    obj = obj[keys[i]];
    if (!obj) return false;
  }

  obj[keys[keys.length - 1]] = newVersion;
  writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
  console.log(`  Updated: ${filePath} -> ${newVersion}`);
  return true;
}

function updateCargoToml(filePath: string, newVersion: string): boolean {
  if (!existsSync(filePath)) return false;

  let content = readFileSync(filePath, 'utf-8');
  content = content.replace(
    /^version\s*=\s*"[^"]*"/m,
    `version = "${newVersion}"`
  );
  writeFileSync(filePath, content);
  console.log(`  Updated: ${filePath} -> ${newVersion}`);
  return true;
}

function bumpVersion(type: ReleaseType): void {
  const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
  const currentVersion = pkg.version;
  const newVersion = semver.inc(currentVersion, type)!;

  console.log(`Version update: ${currentVersion} -> ${newVersion}`);

  // Update version in each file
  for (const vf of VERSION_FILES) {
    if (vf.jsonPath) {
      updateJsonVersion(vf.path, vf.jsonPath, newVersion);
    } else if (vf.path.endsWith('.toml')) {
      updateCargoToml(vf.path, newVersion);
    }
  }

  // Update CHANGELOG if it exists
  if (existsSync('CHANGELOG.md')) {
    const changelog = readFileSync('CHANGELOG.md', 'utf-8');
    const date = new Date().toISOString().split('T')[0];
    const newEntry = `## [${newVersion}] - ${date}\n\n`;
    const updated = changelog.replace(
      /^## \[Unreleased\]/m,
      `## [Unreleased]\n\n${newEntry}`
    );
    writeFileSync('CHANGELOG.md', updated);
    console.log(`  Updated: CHANGELOG.md`);
  }

  // Git operations
  execSync(`git add -A`);
  execSync(`git commit -m "chore: bump version to v${newVersion}"`);
  execSync(`git tag v${newVersion}`);

  console.log(`\nVersion bumped: ${currentVersion} -> ${newVersion}`);
  console.log(`Run "git push --follow-tags" to trigger release`);
}

const type = (process.argv[2] as ReleaseType) || 'patch';
bumpVersion(type);
```

---

## 7. Enterprise Distribution (LOB / MDM)

### 7.1 Distribution via Microsoft Intune

```powershell
# PowerShell: Intune への LOB アプリ登録スクリプト
# Microsoft Graph API を使用

$TenantId = $env:AZURE_TENANT_ID
$ClientId = $env:AZURE_CLIENT_ID
$ClientSecret = $env:AZURE_CLIENT_SECRET
$MsixPath = $args[0]

# アクセストークン取得
$tokenBody = @{
    grant_type    = "client_credentials"
    client_id     = $ClientId
    client_secret = $ClientSecret
    scope         = "https://graph.microsoft.com/.default"
}

$tokenResponse = Invoke-RestMethod `
    -Uri "https://login.microsoftonline.com/$TenantId/oauth2/v2.0/token" `
    -Method POST `
    -ContentType "application/x-www-form-urlencoded" `
    -Body $tokenBody

$token = $tokenResponse.access_token
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
}

# LOB アプリの作成
$appBody = @{
    "@odata.type"       = "#microsoft.graph.windowsAppX"
    displayName         = "MyApp"
    description         = "In-house desktop application"
    publisher           = "Example Inc."
    applicableArchitectures = "x64"
    identityName        = "12345ExampleInc.MyApp"
    identityPublisherHash = "XXXXXXXX"
    identityVersion     = "1.2.0.0"
    minimumSupportedOperatingSystem = @{
        v10_1809 = $true
    }
} | ConvertTo-Json -Depth 10

$app = Invoke-RestMethod `
    -Uri "https://graph.microsoft.com/v1.0/deviceAppManagement/mobileApps" `
    -Method POST `
    -Headers $headers `
    -Body $appBody

Write-Host "LOB app created: $($app.id)"

# App assignment (deploy to all devices)
$assignmentBody = @{
    mobileAppAssignments = @(
        @{
            "@odata.type" = "#microsoft.graph.mobileAppAssignment"
            intent        = "required"  # required = forced installation
            target        = @{
                "@odata.type" = "#microsoft.graph.allDevicesAssignmentTarget"
            }
            settings      = @{
                "@odata.type"    = "#microsoft.graph.windowsAppXAppAssignmentSettings"
                useDeviceContext = $true  # Install in device context
            }
        }
    )
} | ConvertTo-Json -Depth 10

Invoke-RestMethod `
    -Uri "https://graph.microsoft.com/v1.0/deviceAppManagement/mobileApps/$($app.id)/assign" `
    -Method POST `
    -Headers $headers `
    -Body $assignmentBody

Write-Host "App assignment complete (required installation for all devices)"
```

### 7.2 macOS Distribution via Jamf Pro

```bash
#!/bin/bash
# scripts/deploy-to-jamf.sh
# Jamf Pro API を使った macOS アプリの企業配布

set -euo pipefail

JAMF_URL="${JAMF_PRO_URL:?JAMF_PRO_URL が未設定です}"
JAMF_USER="${JAMF_API_USER:?JAMF_API_USER が未設定です}"
JAMF_PASS="${JAMF_API_PASSWORD:?JAMF_API_PASSWORD が未設定です}"
PKG_PATH="$1"
APP_NAME="MyApp"

echo "=== Jamf Pro Deploy Script ==="

# 1. Obtain Bearer Token
echo "[1/4] Authenticating..."
TOKEN=$(curl -s -X POST "${JAMF_URL}/api/v1/auth/token" \
  -u "${JAMF_USER}:${JAMF_PASS}" | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

HEADERS=(
  -H "Authorization: Bearer ${TOKEN}"
  -H "Accept: application/json"
)

# 2. Upload package
echo "[2/4] Uploading package..."
UPLOAD_RESULT=$(curl -s -X POST "${JAMF_URL}/api/v1/packages" \
  "${HEADERS[@]}" \
  -F "file=@${PKG_PATH}" \
  -F "name=${APP_NAME}-$(date +%Y%m%d)")

PACKAGE_ID=$(echo "$UPLOAD_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Package ID: $PACKAGE_ID"

# 3. Create policy (distribution rules)
echo "[3/4] Creating distribution policy..."
POLICY_XML="<policy>
  <general>
    <name>Deploy ${APP_NAME}</name>
    <enabled>true</enabled>
    <trigger>recurring check-in</trigger>
    <frequency>Once per computer</frequency>
  </general>
  <scope>
    <all_computers>true</all_computers>
  </scope>
  <package_configuration>
    <packages>
      <size>1</size>
      <package>
        <id>${PACKAGE_ID}</id>
        <action>Install</action>
      </package>
    </packages>
  </package_configuration>
</policy>"

curl -s -X POST "${JAMF_URL}/JSSResource/policies" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/xml" \
  -d "$POLICY_XML"

echo "[4/4] Distribution policy created"
echo "=== Jamf Pro deploy complete ==="
```

---

## 8. Package Format Comparison

| Format | Platform | Sandbox | Auto-update | Size | Use case |
|--------|----------|---------|-------------|------|----------|
| MSIX | Windows 10+ | Partial | Via Store | Medium | Store distribution |
| NSIS | Windows | None | electron-updater | Small | Direct distribution |
| MSI | Windows | None | None (WiX) | Medium | Enterprise distribution |
| DMG | macOS | None | Self-managed | Large | Direct distribution |
| pkg (MAS) | macOS | Required | Via Store | Medium | App Store |
| AppImage | Linux | None | AppImageUpdate | Large | General purpose |
| deb | Debian/Ubuntu | None | apt repo | Small | Debian-based |
| snap | Linux | Yes (strict) | snapd | Large | Ubuntu-centric |
| flatpak | Linux | Yes | Flathub | Large | General purpose |
| RPM | RHEL/Fedora | None | dnf/yum repo | Small | RedHat-based |

### 8.1 Package Format Selection Guide

```
[Who is the distribution target?]
     |
     +--- General Windows users
     |        +--- Via Store → MSIX
     |        +--- Direct distribution → NSIS (exe)
     |        +--- Enterprise → MSI (Group Policy support)
     |
     +--- General macOS users
     |        +--- App Store → pkg (MAS)
     |        +--- Direct distribution → DMG + Notarization
     |
     +--- Linux
     |        +--- General → AppImage (no dependencies)
     |        +--- Ubuntu/GNOME → Snap
     |        +--- Fedora/KDE → Flatpak
     |        +--- Debian-based servers → deb + APT repository
     |        +--- RHEL-based servers → RPM + YUM/DNF repository
     |
     +--- All platforms
              +--- Store + direct distribution: two-pillar approach recommended
              +--- Auto-build all formats via CI/CD
```

---

## 9. Comprehensive Code Signing Guide

### 9.1 Windows (Authenticode) Signing

```powershell
# PowerShell: Windows コード署名の完全フロー

# 1. 証明書の取得方法
# EV (Extended Validation) コード署名証明書を推奨
# 発行元: DigiCert, Sectigo, GlobalSign 等

# 2. signtool によるバイナリ署名
$signtoolPath = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe"

# PFX ファイルを使った署名
& $signtoolPath sign `
    /f "certificate.pfx" `
    /p "$env:CERT_PASSWORD" `
    /fd SHA256 `
    /tr http://timestamp.digicert.com `
    /td SHA256 `
    /d "MyApp Desktop Application" `
    /du "https://www.example.com/myapp" `
    "dist\MyApp-Setup-1.2.0.exe"

# 3. 署名の検証
& $signtoolPath verify /pa /v "dist\MyApp-Setup-1.2.0.exe"

# 4. MSIX の署名
& $signtoolPath sign `
    /f "store-certificate.pfx" `
    /p "$env:STORE_CERT_PASSWORD" `
    /fd SHA256 `
    "dist\MyApp-1.2.0-x64.msix"

Write-Host "Code signing complete"
```

### 9.2 macOS (codesign + notarize) Signing

```bash
#!/bin/bash
# scripts/macos-sign-and-notarize.sh
# macOS アプリの完全な署名・Notarization フロー

set -euo pipefail

APP_PATH="$1"
DEVELOPER_ID="Developer ID Application: Example Inc. (XXXXXXXXXX)"
TEAM_ID="${APPLE_TEAM_ID:?APPLE_TEAM_ID が未設定です}"

echo "=== macOS Signing & Notarization Flow ==="

# 1. Deep signing (recursively sign all binaries)
echo "[1/5] Code signing..."
codesign --deep --force --verify --verbose \
  --sign "$DEVELOPER_ID" \
  --options runtime \
  --entitlements "build/entitlements.mac.plist" \
  --timestamp \
  "$APP_PATH"

# 2. Verify signature
echo "[2/5] Verifying signature..."
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
spctl --assess --type execute --verbose "$APP_PATH"

# 3. Create DMG
echo "[3/5] Creating DMG..."
DMG_PATH="${APP_PATH%.app}.dmg"
hdiutil create -volname "MyApp" \
  -srcfolder "$APP_PATH" \
  -ov -format UDZO \
  "$DMG_PATH"

# Sign the DMG as well
codesign --sign "$DEVELOPER_ID" --timestamp "$DMG_PATH"

# 4. Submit for Notarization
echo "[4/5] Submitting for Notarization..."
SUBMISSION_ID=$(xcrun notarytool submit "$DMG_PATH" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$TEAM_ID" \
  --wait 2>&1 | grep "id:" | head -1 | awk '{print $2}')

echo "Submission ID: $SUBMISSION_ID"

# 5. Stapling (embed Notarization ticket)
echo "[5/5] Stapling..."
xcrun stapler staple "$DMG_PATH"

# Final validation
xcrun stapler validate "$DMG_PATH"

echo "=== Signing & Notarization complete: $DMG_PATH ==="
```

---

## Anti-Patterns

### Anti-Pattern 1: Hardcoding Secrets

```yaml
# NG: シークレットを直接ワークフローに記述
- name: Sign
  run: signtool sign /f cert.pfx /p "MyP@ssw0rd123" app.exe

# OK: GitHub Secrets を使用
- name: Sign
  run: signtool sign /f cert.pfx /p "${{ secrets.WIN_CERT_PASSWORD }}" app.exe
  env:
    WIN_CSC_LINK: ${{ secrets.WIN_CERT_BASE64 }}
```

**Problem**: Passwords may be output in CI/CD logs, and the private key of the certificate could be exposed to anyone with repository access. Always use the Secrets management feature and confirm that log masking is enabled.

### Anti-Pattern 2: Releasing All Platforms Simultaneously

```yaml
# NG: 全プラットフォームを同時に公開
- name: Publish All
  run: npx electron-builder --publish always --win --mac --linux

# OK: Draft で作成し、テスト後に公開
- name: Build (Draft)
  run: npx electron-builder --publish always
  # GitHub Release は draft: true で作成
  # QA テスト完了後に手動で公開
```

**Problem**: If a problem occurs on one platform, the entire multi-platform release must be rolled back. It is safer to validate using a Draft release and only publish after verifying that everything works correctly.

### Anti-Pattern 3: Ignoring Store Review Requirements

```typescript
// NG: Mac App Store サンドボックスで禁止される操作
import { execSync } from 'child_process';

function runShellCommand(cmd: string): string {
  // サンドボックス内では exec が制限される
  return execSync(cmd).toString();
}

function readSystemFile(): string {
  // /etc や /usr 配下はアクセス不可
  return fs.readFileSync('/etc/hosts', 'utf-8');
}

// OK: サンドボックス対応の実装
import { app } from 'electron';
import * as path from 'path';

function getAppDataPath(): string {
  // サンドボックス内の正しいパスを使用
  return app.getPath('userData');
}

function readUserFile(): string {
  // ユーザーが明示的に選択したファイルのみアクセス
  // dialog.showOpenDialog() 経由でパスを取得
  const filePath = path.join(app.getPath('userData'), 'config.json');
  return fs.readFileSync(filePath, 'utf-8');
}
```

**Problem**: Implementations that ignore Mac App Store sandbox restrictions will be rejected during review. The same applies to Microsoft Store MSIX — writing to arbitrary paths or requesting administrator privileges should be avoided. A design that branches between Store builds and other builds is necessary.

### Anti-Pattern 4: Version Inconsistency

```json
// NG: 複数ファイルのバージョンが不一致
// package.json
{ "version": "1.2.0" }

// tauri.conf.json
{ "version": "1.1.0" }  // <- Still outdated!

// Cargo.toml
// version = "1.0.0"    // <- Forgotten to update!
```

```typescript
// OK: バージョンバンプスクリプトで一括更新
// Use scripts/bump-version.ts to update all files at once
// (See Section 6.3)
```

**Problem**: Mismatched version numbers can cause Store review rejections and cases where auto-updates do not work correctly. Either add a version consistency check to the CI/CD pipeline or manage everything with a bump script.

---

## FAQ

### Q1: What are the most common reasons for Microsoft Store review rejections?

**A**: The most frequent reasons are (1) missing or invalid privacy policy URL, (2) mismatch between the app description and screenshots, and (3) quality issues such as crashes or hangs. For Electron apps in particular, a slow startup time can negatively affect the review. It is strongly recommended to run the Windows App Certification Kit (WACK) for a self-check before submitting. Also, if the app uses certain APIs (location, camera, etc.), not declaring the corresponding Capability in AppxManifest.xml will result in review rejection.

### Q2: What features are problematic under Mac App Store sandbox restrictions?

**A**: Broad filesystem access, global keyboard shortcuts, inter-process communication with other apps, and kernel extensions are restricted in the sandbox. Developer tools in particular may have difficulty operating Terminal.app or accessing files under `/usr/local`. If these features are essential, consider distributing directly outside the Mac App Store (DMG + Notarization). Note that Security-Scoped Bookmarks allow continued access to directories the user has once approved, providing a partial workaround.

### Q3: Should I provide both GitHub Releases and Store distribution?

**A**: Ideally, both should be provided. Store distribution makes it easy for end users to install and update, and is also more trustworthy. GitHub Releases, on the other hand, is better for reaching the developer community and for immediate distribution without waiting for Store review. By designing the CI/CD pipeline to deploy to both channels simultaneously, the additional operational cost can be minimized.

### Q4: Which package format should I choose for Linux distribution?

**A**: It depends on the user base and use case. The most versatile is AppImage, which works as a single binary on any Linux distribution. If your audience is primarily Ubuntu users, Snap is a good choice (with auto-update support). For GNOME/KDE desktop users, Flatpak + Flathub offers better discoverability. For server environments or system administrators, deb/RPM + a self-hosted repository is more appropriate. Providing multiple formats in parallel is best, and electron-builder can achieve this with a single command.

### Q5: What are the types of code signing certificates and how do I choose one?

**A**: On Windows, there are Standard code signing certificates (software token) and EV (Extended Validation) code signing certificates (hardware token required). EV certificates can immediately gain SmartScreen trust, which is especially important in the early stages when download numbers are low. Prices range from around $200-500 per year. On macOS, you use the Developer ID certificate included in the Apple Developer Program ($99/year). In CI environments, certificates require careful handling — the common pattern is to Base64-encode them, store them in GitHub Secrets, and decode them at build time.

### Q6: Can MSIX be distributed within an enterprise without using the Microsoft Store?

**A**: Yes, it is possible. MSIX sideloading (LOB distribution) is supported on Windows 10 1809 and later. You can distribute via an MDM solution such as Intune, or install directly using PowerShell's `Add-AppxPackage` command. For sideloading, use an MSIX signed with your own certificate. Note that developer mode or sideloading must be enabled via Group Policy. Since the Store is not involved, no review is required, but auto-updates must be implemented on your own.

---

## Summary

| Item | Key Points |
|------|-----------|
| Microsoft Store | MSIX packaging + Partner Center submission. Review takes 1-3 days. Pre-validate with WACK |
| Mac App Store | Sandbox support + Notarization. Review takes 1-7 days. Manage Provisioning Profiles |
| GitHub Releases | Immediate distribution. Integrates with electron-updater / Tauri updater. Draft → QA → publish |
| Linux distribution | Auto-build multiple formats (Snap / Flatpak / AppImage / deb) via CI/CD |
| Enterprise distribution | Silent installation via Intune (Windows) / Jamf (macOS) + MDM integration |
| Package formats | MSIX (Win Store), NSIS (Win direct), DMG (Mac direct), AppImage (Linux) |
| CI/CD | GitHub Actions for multi-platform, multi-store automated build, signing, and publishing |
| Signing | Windows = Authenticode (EV recommended), macOS = codesign + notarize, both automated via CI |
| Release strategy | Staged process: Draft release → QA → publish. Multi-store integrated workflow |
| Version management | semver + git tags to auto-trigger releases. Bulk bump across all files |

## Next Guides to Read

- [Auto Update](./01-auto-update.md) -- OTA updates with electron-updater / Tauri updater
- Installer Customization -- Using NSIS scripts and the WiX Toolset
- Multi-Architecture Support -- Strategies for x64 / ARM64 / Universal Binary

## References

1. **Microsoft Store App Publishing Guide** -- https://learn.microsoft.com/ja-jp/windows/apps/publish/publish-your-app/overview -- Official guide from app submission to publishing on Partner Center
2. **Apple Developer - App Store Distribution** -- https://developer.apple.com/distribute/ -- Official documentation for Mac App Store submission and Notarization
3. **electron-builder Official Documentation** -- https://www.electron.build/ -- Comprehensive reference for multi-platform builds and signing
4. **GitHub Actions for Tauri** -- https://github.com/tauri-apps/tauri-action -- Action for cross-platform builds and releases of Tauri apps
5. **Snapcraft Documentation** -- https://snapcraft.io/docs -- Guide to creating Snap packages and publishing to the Snap Store
6. **Flatpak Documentation** -- https://docs.flatpak.org/ -- Creating Flatpak manifests and publishing to Flathub
7. **Microsoft Intune - LOB App Distribution** -- https://learn.microsoft.com/ja-jp/mem/intune/apps/lob-apps-windows -- Official guide for enterprise MSIX sideload distribution

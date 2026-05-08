# Auto Update

> Learn systematically the techniques for designing and implementing auto-update mechanisms for desktop applications, delivering updates to users transparently and securely.

## What You Will Learn

1. **Design philosophy and implementation patterns of electron-updater / Tauri updater** -- Build production-quality auto-updates by comparing the update mechanisms of major frameworks
2. **Building an update server and optimizing delta updates** -- Understand server architecture and delta updates for fast patch delivery while saving bandwidth
3. **Rollback strategies and disaster recovery** -- Build a robust update pipeline that preserves user experience through fallback design when updates fail
4. **Integration with CI/CD pipelines** -- Use GitHub Actions to build a fully automated workflow from build to signing and delivery


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of [Packaging and Signing](./00-packaging-and-signing.md)

---

## 1. Overall Auto-Update Architecture

### 1.1 Overview of the Update Flow

```
+------------------+     (1) Check request      +------------------+
|                  | -----------------------> |                  |
|   Desktop        |     (2) Manifest response  |   Update server  |
|   App            | <----------------------- |   (S3/GitHub etc)|
|                  |     (3) Binary DL          |                  |
|                  | -----------------------> |                  |
+------------------+                          +------------------+
        |
        v  (4) Verify & Install
+------------------+
|  Local deploy    |
|  Restart or      |
|  Background      |
+------------------+
```

### 1.2 Update Check Strategies

```
+-------------------------------------------------------------+
|                  Update Check Strategy Selection             |
+-------------------------------------------------------------+
| Strategy         | Trigger          | Use Case               |
|------------------|-----------------|------------------------|
| On-launch check  | App launch       | General desktop apps   |
| Periodic polling | Timer (1h, etc.) | Long-running apps      |
| Push notification| WebSocket/SSE    | When real-time needed  |
| Manual check     | User action      | Developer tools        |
+-------------------------------------------------------------+
```

### 1.3 Detailed Comparison of Update Methods

| Method | Advantages | Disadvantages | Use Case |
|--------|-----------|---------------|---------|
| Full replacement | Simple, reliable | Large download size | Small apps |
| Delta patch | Small download size | Complex patch generation | Large apps |
| asar replacement (Electron) | Updates only JS parts | Cannot change native | Frontend-centric |
| Side-by-side | Easy rollback | Increased disk usage | Enterprise |
| Background DL | Good UX | Memory/disk usage | General consumers |

---

## 2. Electron + electron-updater

### 2.1 Basic Setup

```typescript
// electron-builder.yml (excerpt)
// publish:
//   provider: github
//   owner: your-org
//   repo: your-app

// main.ts -- main process
import { autoUpdater } from 'electron-updater';
import { app, BrowserWindow, ipcMain } from 'electron';
import log from 'electron-log';

// Log configuration
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// Disable auto-download (when you want the user to confirm)
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function setupAutoUpdater(mainWindow: BrowserWindow): void {
  // Check for updates (3-second delay after launch)
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 3000);

  // Event handlers
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version);
    mainWindow.webContents.send('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', () => {
    log.info('Already up to date');
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('download-progress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('update-downloaded', info.version);
  });

  autoUpdater.on('error', (err) => {
    log.error('Update error:', err);
    mainWindow.webContents.send('update-error', err.message);
  });

  // Requests from renderer
  ipcMain.handle('start-download', () => autoUpdater.downloadUpdate());
  ipcMain.handle('install-update', () => autoUpdater.quitAndInstall());
}
```

### 2.2 Renderer-Side UI Implementation

```typescript
// renderer/update-manager.ts
const { ipcRenderer } = window.require('electron');

class UpdateUI {
  private banner: HTMLElement;

  constructor() {
    this.banner = document.getElementById('update-banner')!;
    this.setupListeners();
  }

  private setupListeners(): void {
    ipcRenderer.on('update-available', (_e, info) => {
      this.showBanner(
        `v${info.version} is available`,
        'Download',
        () => ipcRenderer.invoke('start-download')
      );
    });

    ipcRenderer.on('download-progress', (_e, progress) => {
      this.updateProgress(progress.percent);
    });

    ipcRenderer.on('update-downloaded', (_e, version) => {
      this.showBanner(
        `v${version} is ready`,
        'Restart and Update',
        () => ipcRenderer.invoke('install-update')
      );
    });

    ipcRenderer.on('update-error', (_e, message) => {
      console.error('Update error:', message);
      // Only notify the user here; retry will happen on next launch
    });
  }

  private showBanner(text: string, btnLabel: string, onClick: () => void): void {
    this.banner.innerHTML = `
      <span>${text}</span>
      <button id="update-action">${btnLabel}</button>
    `;
    this.banner.style.display = 'flex';
    document.getElementById('update-action')!.addEventListener('click', onClick);
  }

  private updateProgress(percent: number): void {
    const bar = this.banner.querySelector('.progress-bar') as HTMLElement;
    if (bar) bar.style.width = `${percent.toFixed(1)}%`;
  }
}
```

### 2.3 Comparison of electron-builder Publish Configurations

| Setting | GitHub Releases | S3 / R2 | Self-hosted Server |
|---------|----------------|---------|-------------------|
| `provider` | `github` | `s3` / `generic` | `generic` |
| Cost | Free (Public) | Pay-as-you-go | Server maintenance cost |
| Private repo | Token required | IAM role | Any auth |
| CDN | GitHub CDN | CloudFront, etc. | Self-built |
| Bandwidth limit | 1GB/month (Free) | Unlimited (paid) | Unlimited |
| Delta update | Not supported | Supported | Supported |
| Setup difficulty | Low | Medium | High |

### 2.4 Delivery Configuration with S3 / CloudFront

```yaml
# electron-builder.yml — S3 delivery configuration
publish:
  - provider: s3
    bucket: my-app-releases
    region: ap-northeast-1
    acl: public-read
    path: /releases/${os}/${arch}

# Set credentials via environment variables
# AWS_ACCESS_KEY_ID
# AWS_SECRET_ACCESS_KEY
```

```typescript
// main/auto-updater-s3.ts — Update check from S3
import { autoUpdater } from 'electron-updater';

// Configure updates from S3
autoUpdater.setFeedURL({
  provider: 's3',
  bucket: 'my-app-releases',
  region: 'ap-northeast-1',
  path: `/releases/${process.platform}/${process.arch}`,
});

// Updates from a generic server (self-hosted)
autoUpdater.setFeedURL({
  provider: 'generic',
  url: 'https://updates.example.com/releases',
  channel: 'latest',
  useMultipleRangeRequest: true, // Enable delta download
});
```

### 2.5 Implementing Periodic Polling

```typescript
// main/update-scheduler.ts — Periodic update checks
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

class UpdateScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly checkIntervalMs: number;

  constructor(intervalHours: number = 4) {
    this.checkIntervalMs = intervalHours * 60 * 60 * 1000;
  }

  start(): void {
    // First check 10 seconds after launch
    setTimeout(() => this.check(), 10_000);

    // Periodic checks thereafter
    this.intervalId = setInterval(() => this.check(), this.checkIntervalMs);
    log.info(`Update check scheduler started: every ${this.checkIntervalMs / 3600000} hours`);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log.info('Update check scheduler stopped');
    }
  }

  private async check(): Promise<void> {
    try {
      log.info('Running periodic update check');
      const result = await autoUpdater.checkForUpdates();
      if (result?.updateInfo) {
        log.info(`Update available: v${result.updateInfo.version}`);
      }
    } catch (error) {
      log.warn('Update check failed (will retry next time):', error);
      // If errors are consecutive, consider extending the check interval
    }
  }
}

export const updateScheduler = new UpdateScheduler(4); // every 4 hours
```

---

## 3. Tauri Updater

### 3.1 Configuring the Tauri v2 Updater Plugin

```bash
# In Tauri v2, the updater is provided as a plugin
cargo add tauri-plugin-updater
npm install @tauri-apps/plugin-updater
```

```json
// src-tauri/tauri.conf.json — Tauri v2 updater configuration
{
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBr...",
      "endpoints": [
        "https://releases.example.com/{{target}}/{{arch}}/{{current_version}}"
      ],
      "dialog": false
    }
  }
}
```

```json
// src-tauri/capabilities/default.json — updater plugin permissions
{
  "identifier": "main-capability",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "updater:default"
  ]
}
```

### 3.2 Generating a minisign Key Pair

```bash
# Install minisign
cargo install minisign

# Generate key pair (set a password)
minisign -G -p minisign.pub -s minisign.key

# Set the contents of the public key in pubkey in tauri.conf.json
cat minisign.pub

# Store the private key in CI/CD Secrets
# TAURI_SIGNING_PRIVATE_KEY = (contents of minisign.key)
# TAURI_SIGNING_PRIVATE_KEY_PASSWORD = (password set during generation)
```

### 3.3 Rust-Side Update Logic (v2 Plugin Version)

```rust
// src-tauri/src/main.rs — Registering the Tauri v2 updater plugin
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Start update check in background
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = check_for_updates(handle).await {
                    log::error!("Update check error: {}", e);
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Failed to launch Tauri app");
}

async fn check_for_updates(app: tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_updater::UpdaterExt;

    // Wait 5 seconds before checking (avoid immediately after launch)
    tokio::time::sleep(std::time::Duration::from_secs(5)).await;

    let updater = app.updater()?;
    let response = updater.check().await?;

    if let Some(update) = response {
        log::info!("Update available: v{}", update.version);

        // Notify frontend
        use tauri::Emitter;
        app.emit("update-available", serde_json::json!({
            "version": update.version,
            "body": update.body,
            "date": update.date,
        }))?;
    } else {
        log::info!("App is up to date");
    }

    Ok(())
}
```

```rust
// src-tauri/src/commands/updater.rs — Update commands
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

/// Command to check for updates
#[tauri::command]
pub async fn check_update(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let response = updater.check().await.map_err(|e| e.to_string())?;

    match response {
        Some(update) => Ok(Some(UpdateInfo {
            version: update.version.clone(),
            body: update.body.clone(),
            date: update.date.clone(),
        })),
        None => Ok(None),
    }
}

/// Command to download and install an update
#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    use tauri::Emitter;

    let updater = app.updater().map_err(|e| e.to_string())?;
    let response = updater.check().await.map_err(|e| e.to_string())?;

    if let Some(update) = response {
        // Send download progress to frontend
        let app_clone = app.clone();
        let mut downloaded: u64 = 0;

        update
            .download_and_install(
                move |chunk_length, content_length| {
                    downloaded += chunk_length as u64;
                    let percent = content_length
                        .map(|total| (downloaded as f64 / total as f64) * 100.0)
                        .unwrap_or(0.0);

                    let _ = app_clone.emit("update-progress", serde_json::json!({
                        "downloaded": downloaded,
                        "total": content_length,
                        "percent": percent,
                    }));
                },
                || {
                    log::info!("Download complete, preparing installation...");
                },
            )
            .await
            .map_err(|e| format!("Installation failed: {}", e))?;

        log::info!("Update installed. Restart required.");
        app.emit("update-installed", serde_json::json!({
            "version": update.version,
        })).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[derive(serde::Serialize)]
pub struct UpdateInfo {
    version: String,
    body: Option<String>,
    date: Option<String>,
}
```

### 3.4 Frontend (TypeScript) Side

```typescript
// src/lib/updater.ts — Using the Tauri v2 updater plugin
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { listen } from '@tauri-apps/api/event'

interface UpdateStatus {
  available: boolean
  version?: string
  body?: string
  date?: string
}

// Update check and state management
export class UpdateManager {
  private onStatusChange?: (status: UpdateStatus) => void
  private onProgressChange?: (percent: number) => void

  constructor(
    onStatusChange?: (status: UpdateStatus) => void,
    onProgressChange?: (percent: number) => void
  ) {
    this.onStatusChange = onStatusChange
    this.onProgressChange = onProgressChange
  }

  async checkForUpdate(): Promise<UpdateStatus> {
    try {
      const update = await check()

      if (update) {
        const status: UpdateStatus = {
          available: true,
          version: update.version,
          body: update.body ?? undefined,
          date: update.date ?? undefined,
        }
        this.onStatusChange?.(status)
        return status
      }

      const status: UpdateStatus = { available: false }
      this.onStatusChange?.(status)
      return status
    } catch (error) {
      console.error('Update check error:', error)
      return { available: false }
    }
  }

  async downloadAndInstall(): Promise<void> {
    try {
      const update = await check()
      if (!update) {
        throw new Error('No update found')
      }

      let downloaded = 0
      let contentLength: number | undefined

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength ?? undefined
            console.log(`Download started: ${contentLength} bytes`)
            break
          case 'Progress':
            downloaded += event.data.chunkLength
            if (contentLength) {
              const percent = (downloaded / contentLength) * 100
              this.onProgressChange?.(percent)
            }
            break
          case 'Finished':
            console.log('Download complete')
            this.onProgressChange?.(100)
            break
        }
      })

      // Restart after installation
      await relaunch()
    } catch (error) {
      console.error('Update installation error:', error)
      throw error
    }
  }
}
```

```tsx
// src/components/UpdateNotification.tsx — Update notification component
import { useState, useEffect, useCallback } from 'react'
import { UpdateManager } from '../lib/updater'

export function UpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [version, setVersion] = useState('')
  const [releaseNotes, setReleaseNotes] = useState('')
  const [progress, setProgress] = useState(0)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  const manager = useCallback(() => new UpdateManager(
    (status) => {
      setUpdateAvailable(status.available)
      if (status.version) setVersion(status.version)
      if (status.body) setReleaseNotes(status.body)
    },
    (percent) => {
      setProgress(percent)
    }
  ), [])

  useEffect(() => {
    const mgr = manager()
    // Check for updates 5 seconds after launch
    const timer = setTimeout(() => mgr.checkForUpdate(), 5000)
    return () => clearTimeout(timer)
  }, [manager])

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const mgr = manager()
      await mgr.downloadAndInstall()
      setIsInstalled(true)
    } catch {
      setIsDownloading(false)
    }
  }

  if (!updateAvailable) return null

  return (
    <div className="update-notification">
      <div className="update-info">
        <h3>New version v{version} is available</h3>
        {releaseNotes && (
          <div className="release-notes" dangerouslySetInnerHTML={{ __html: releaseNotes }} />
        )}
      </div>

      {isDownloading ? (
        <div className="progress-container">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
          <span>{progress.toFixed(1)}%</span>
        </div>
      ) : isInstalled ? (
        <p>Installation complete. Restarting the app...</p>
      ) : (
        <button onClick={handleDownload}>Update Now</button>
      )}
    </div>
  )
}
```

### 3.5 Tauri Update Manifest (JSON) Format

Understanding the specification of the JSON manifest returned by the update server is important.

```json
// Example JSON response returned by the update server
// GET https://releases.example.com/windows-x86_64/1.0.0
{
  "version": "1.1.0",
  "notes": "Bug fixes and new features\n- Faster file search\n- Dark mode support",
  "pub_date": "2025-12-15T10:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpLXBsdWdpbi11cGRhdGVy...",
      "url": "https://cdn.example.com/releases/v1.1.0/my-app_1.1.0_x64-setup.nsis.zip"
    },
    "darwin-aarch64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpLXBsdWdpbi11cGRhdGVy...",
      "url": "https://cdn.example.com/releases/v1.1.0/my-app_1.1.0_aarch64.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpLXBsdWdpbi11cGRhdGVy...",
      "url": "https://cdn.example.com/releases/v1.1.0/my-app_1.1.0_x64.app.tar.gz"
    },
    "linux-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpLXBsdWdpbi11cGRhdGVy...",
      "url": "https://cdn.example.com/releases/v1.1.0/my-app_1.1.0_amd64.AppImage.tar.gz"
    }
  }
}
```

---

## 4. Building an Update Server

### 4.1 Architecture

```
+------------------+      +-------------------+      +-----------+
|  CI/CD           |      |  Update server    |      |  CDN      |
|  (GitHub Actions)|----->|  (API + DB)       |----->|  (CF/S3)  |
|  Build & Sign    |      |  /update/check    |      |  Binaries |
+------------------+      |  /update/download  |      +-----------+
                          +-------------------+            |
                                   ^                       |
                                   |  (1) Check            |  (3) DL
                                   |                       v
                          +-------------------+
                          |  Desktop App      |
                          +-------------------+
```

### 4.2 Example Update Server API Implementation

```typescript
// server/routes/update.ts (Express)
import express from 'express';
import semver from 'semver';

const router = express.Router();

interface Release {
  version: string;
  platform: string;
  arch: string;
  url: string;
  signature: string;
  size: number;
  sha256: string;
  releaseDate: string;
  critical: boolean;
  minVersion?: string; // Force update for versions below this
}

// GET /update/check?platform=win32&arch=x64&version=1.2.0
router.get('/check', async (req, res) => {
  const { platform, arch, version } = req.query;

  const latest = await db.releases.findOne({
    where: { platform, arch, channel: 'stable' },
  });

  if (!latest || !semver.gt(latest.version, version as string)) {
    return res.status(204).end(); // No update
  }

  // Force update check
  const forceUpdate =
    latest.critical ||
    (latest.minVersion && semver.lt(version as string, latest.minVersion));

  res.json({
    version: latest.version,
    url: latest.url,
    signature: latest.signature,
    size: latest.size,
    sha256: latest.sha256,
    releaseNotes: latest.releaseNotes,
    forceUpdate,
    releaseDate: latest.releaseDate,
  });
});

// Phased rollout (canary)
router.get('/check/canary', async (req, res) => {
  const { platform, arch, version, userId } = req.query;
  const latest = await db.releases.findOne({
    where: { platform, arch, channel: 'canary' },
  });

  if (!latest) return res.status(204).end();

  // Deliver in phases based on hash of user ID (0-100%)
  const rolloutPercent = latest.rolloutPercent || 100;
  const hash = hashCode(userId as string) % 100;

  if (hash >= rolloutPercent) {
    return res.status(204).end(); // Not yet delivering to this user
  }

  res.json({ version: latest.version, url: latest.url });
});

export default router;
```

### 4.3 Example Update Server Implementation for Tauri

```typescript
// server/routes/tauri-update.ts — Update API in Tauri manifest format
import express from 'express';
import semver from 'semver';

const router = express.Router();

// Tauri updater endpoint
// GET /update/:target/:arch/:current_version
router.get('/:target/:arch/:current_version', async (req, res) => {
  const { target, arch, current_version } = req.params;

  // Platform name mapping
  const platform = `${target}-${arch}`;

  const latest = await db.releases.findOne({
    where: { channel: 'stable' },
  });

  if (!latest || !semver.gt(latest.version, current_version)) {
    return res.status(204).end(); // No update
  }

  // Return in Tauri manifest format
  const platformRelease = latest.platforms[platform];
  if (!platformRelease) {
    return res.status(204).end(); // No release for this platform
  }

  res.json({
    version: latest.version,
    notes: latest.releaseNotes || '',
    pub_date: latest.releaseDate,
    platforms: {
      [platform]: {
        signature: platformRelease.signature,
        url: platformRelease.url,
      },
    },
  });
});

export default router;
```

### 4.4 Update Server Using GitHub Releases as a Backend

```typescript
// server/routes/github-proxy.ts — Update server that proxies GitHub Releases
import express from 'express';
import { Octokit } from '@octokit/rest';

const router = express.Router();
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const OWNER = 'your-org';
const REPO = 'your-app';

router.get('/:target/:arch/:current_version', async (req, res) => {
  const { target, arch, current_version } = req.params;
  const platform = `${target}-${arch}`;

  try {
    // Get the latest release
    const { data: release } = await octokit.repos.getLatestRelease({
      owner: OWNER,
      repo: REPO,
    });

    const latestVersion = release.tag_name.replace('v', '');

    if (!semver.gt(latestVersion, current_version)) {
      return res.status(204).end();
    }

    // Find platform-specific assets
    const signatureAsset = release.assets.find(
      (a) => a.name.endsWith('.sig') && a.name.includes(platform)
    );
    const binaryAsset = release.assets.find(
      (a) => !a.name.endsWith('.sig') && a.name.includes(platform)
    );

    if (!binaryAsset || !signatureAsset) {
      return res.status(204).end();
    }

    // Get the contents of the signature file
    const signatureResponse = await fetch(signatureAsset.browser_download_url);
    const signature = await signatureResponse.text();

    res.json({
      version: latestVersion,
      notes: release.body || '',
      pub_date: release.published_at,
      platforms: {
        [platform]: {
          signature: signature.trim(),
          url: binaryAsset.browser_download_url,
        },
      },
    });
  } catch (error) {
    console.error('GitHub API error:', error);
    res.status(500).json({ error: 'Failed to check for updates' });
  }
});

export default router;
```

---

## 5. Delta Update

### 5.1 How Delta Updates Work

```
+-----------------------------------------------------------+
|              Delta Update Flow                             |
+-----------------------------------------------------------+
|                                                           |
|  v1.0.0 binary (80MB)                                    |
|     |                                                     |
|     v  bsdiff / zstd-delta                                |
|  Delta patch (2MB)  <- delta from v1.0.0 to v1.1.0       |
|     |                                                     |
|     v  bspatch (client side)                              |
|  v1.1.0 binary (81MB)                                    |
|     |                                                     |
|     v  SHA-256 verification                               |
|  Verified OK -> Replace & Restart                         |
|  Verified NG -> Fall back to full download                |
|                                                           |
+-----------------------------------------------------------+
```

### 5.2 Comparison of Delta Update Methods

| Method | Tool | Compression | Generation Speed | Apply Speed | Use Case |
|--------|------|-------------|-----------------|-------------|---------|
| bsdiff/bspatch | bsdiff | High (95%+) | Slow | Medium | Electron |
| courgette | Google-made | Best (97%+) | Slow | Medium | Chrome-based |
| zstd-delta | zstd | Medium (80%+) | Fast | Fast | Tauri / Rust |
| VCDIFF (xdelta3) | xdelta | Medium (85%+) | Medium | Fast | General |
| Windows Delta | msdelta | High (90%+) | Medium | Fast | MSIX only |

### 5.3 Delta Patch Generation Pipeline

```yaml
# .github/workflows/delta-update.yml — Delta patch generation
name: Generate Delta Patches

on:
  release:
    types: [published]

jobs:
  generate-delta:
    runs-on: ubuntu-latest
    steps:
      - name: Download previous release
        run: |
          # Get the previous release
          PREV_TAG=$(gh release list -L 2 --json tagName -q '.[1].tagName')
          gh release download "$PREV_TAG" -D previous/
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Download current release
        run: |
          gh release download "${{ github.event.release.tag_name }}" -D current/
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Generate bsdiff patches
        run: |
          for file in current/*.exe current/*.AppImage; do
            base=$(basename "$file")
            if [ -f "previous/$base" ]; then
              bsdiff "previous/$base" "current/$base" "patches/${base}.patch"
              echo "Patch generated: $base ($(stat -f%z "patches/${base}.patch") bytes)"
            fi
          done

      - name: Upload patches to release
        run: |
          for patch in patches/*; do
            gh release upload "${{ github.event.release.tag_name }}" "$patch"
          done
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 6. Rollback Strategy

### 6.1 Rollback Decision Flow

```
+------------------------------------------------------------------+
|                   Rollback Decision Flow                          |
+------------------------------------------------------------------+
|                                                                  |
|  Update installation complete                                    |
|      |                                                           |
|      v                                                           |
|  App launch -> Launch succeeded?                                 |
|      |            |                                              |
|     YES          NO (crash or timeout)                           |
|      |            |                                              |
|      v            v                                              |
|  Health check   Counter++                                        |
|  (API response, etc.)  |                                         |
|      |            v                                              |
|     OK?       3 consecutive failures?                            |
|    / \          /     \                                          |
|  YES  NO      YES     NO                                        |
|   |    |       |       |                                         |
|   v    v       v       v                                         |
| Normal Roll-  Roll-  Retry                                       |
| ops   back    back                                               |
|                                                                  |
+------------------------------------------------------------------+
```

### 6.2 Rollback Implementation (Electron)

```typescript
// main/rollback-manager.ts
import { app } from 'electron';
import fs from 'fs';
import path from 'path';

interface UpdateState {
  previousVersion: string;
  currentVersion: string;
  updateDate: string;
  crashCount: number;
  healthCheckPassed: boolean;
}

const STATE_FILE = path.join(app.getPath('userData'), 'update-state.json');
const MAX_CRASH_COUNT = 3;

export class RollbackManager {
  private state: UpdateState;

  constructor() {
    this.state = this.loadState();
  }

  /** Call on app launch */
  async onAppStart(): Promise<void> {
    if (!this.state.healthCheckPassed) {
      this.state.crashCount++;
      this.saveState();

      if (this.state.crashCount >= MAX_CRASH_COUNT) {
        console.error(`Failed to launch ${MAX_CRASH_COUNT} times in a row. Performing rollback`);
        await this.rollback();
        return;
      }
    }

    // Health check (treated as failure if not completed within 5 seconds)
    const healthy = await Promise.race([
      this.performHealthCheck(),
      new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(false), 5000)
      ),
    ]);

    if (healthy) {
      this.state.healthCheckPassed = true;
      this.state.crashCount = 0;
      this.saveState();
    }
  }

  private async performHealthCheck(): Promise<boolean> {
    try {
      // App-specific health check
      // e.g., DB connection, config file loading, plugin load
      return true;
    } catch {
      return false;
    }
  }

  private async rollback(): Promise<void> {
    const backupDir = path.join(app.getPath('userData'), 'backup');
    if (fs.existsSync(backupDir)) {
      // Restore from backup logic
      // In practice, depends on the installer mechanism
      console.log(`Rolling back to v${this.state.previousVersion}...`);
    }
  }

  private loadState(): UpdateState {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    } catch {
      return {
        previousVersion: '',
        currentVersion: app.getVersion(),
        updateDate: new Date().toISOString(),
        crashCount: 0,
        healthCheckPassed: true,
      };
    }
  }

  private saveState(): void {
    fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
  }
}
```

### 6.3 Rollback Implementation for Tauri

```rust
// src-tauri/src/rollback.rs — Rollback management for Tauri apps
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;

#[derive(Serialize, Deserialize, Default)]
pub struct RollbackState {
    previous_version: String,
    current_version: String,
    crash_count: u32,
    health_check_passed: bool,
    update_date: String,
}

const MAX_CRASH_COUNT: u32 = 3;

pub struct RollbackManager {
    state: RollbackState,
    state_file: PathBuf,
}

impl RollbackManager {
    pub fn new(app_data_dir: &PathBuf) -> Self {
        let state_file = app_data_dir.join("rollback-state.json");
        let state = Self::load_state(&state_file);
        Self { state, state_file }
    }

    pub fn on_app_start(&mut self) -> Result<(), String> {
        if !self.state.health_check_passed {
            self.state.crash_count += 1;
            self.save_state()?;

            if self.state.crash_count >= MAX_CRASH_COUNT {
                log::error!("Failed to launch {} times in a row. Rollback recommended", MAX_CRASH_COUNT);
                return Err("Rollback required".to_string());
            }
        }

        // Health check
        if self.perform_health_check() {
            self.state.health_check_passed = true;
            self.state.crash_count = 0;
            self.save_state()?;
        }

        Ok(())
    }

    pub fn on_update_applied(&mut self, new_version: &str) -> Result<(), String> {
        self.state.previous_version = self.state.current_version.clone();
        self.state.current_version = new_version.to_string();
        self.state.health_check_passed = false;
        self.state.crash_count = 0;
        self.state.update_date = chrono::Utc::now().to_rfc3339();
        self.save_state()
    }

    fn perform_health_check(&self) -> bool {
        // App-specific health check
        // DB connection test, config file loading, etc.
        true
    }

    fn load_state(path: &PathBuf) -> RollbackState {
        fs::read_to_string(path)
            .ok()
            .and_then(|content| serde_json::from_str(&content).ok())
            .unwrap_or_default()
    }

    fn save_state(&self) -> Result<(), String> {
        let content = serde_json::to_string_pretty(&self.state)
            .map_err(|e| format!("Serialization error: {}", e))?;
        fs::write(&self.state_file, content)
            .map_err(|e| format!("File write error: {}", e))?;
        Ok(())
    }
}
```

---

## 7. Code Signing and Verification

### 7.1 Platform-Specific Signing

| Item | Windows (Authenticode) | macOS (codesign) | Tauri (minisign) |
|------|----------------------|-----------------|-----------------|
| Tool | signtool.exe | codesign | minisign |
| Certificate | EV/OV code signing certificate | Developer ID | Ed25519 key pair |
| Cost | $200-500/year | Apple Developer $99/year | Free |
| SmartScreen | EV: instant trust | Gatekeeper compatible | Custom verification |
| Timestamp | RFC 3161 | Apple TS | Manual management |
| CI/CD integration | Azure Key Vault | Keychain | Environment variables |

### 7.2 Automated Signing with GitHub Actions

```yaml
# .github/workflows/sign-and-release.yml — Signed release
name: Sign and Release

on:
  push:
    tags: ['v*']

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Import certificate
        run: |
          $bytes = [Convert]::FromBase64String("${{ secrets.WIN_CERT_BASE64 }}")
          [IO.File]::WriteAllBytes("cert.pfx", $bytes)

      - name: Build Tauri
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_KEY_PASSWORD }}

      - name: Sign with Authenticode
        run: |
          & "C:\Program Files (x86)\Windows Kits\10\bin\x64\signtool.exe" sign `
            /f cert.pfx `
            /p "${{ secrets.WIN_CERT_PASSWORD }}" `
            /tr http://timestamp.comodoca.com `
            /td sha256 `
            /fd sha256 `
            src-tauri\target\release\bundle\nsis\*.exe

      - name: Clean up certificate
        if: always()
        run: Remove-Item -Force cert.pfx -ErrorAction SilentlyContinue
```

---

## 8. CI/CD Pipeline Integration

### 8.1 Complete Release Workflow for Tauri Apps

```yaml
# .github/workflows/tauri-release.yml — Complete release pipeline
name: Release

on:
  push:
    tags: ['v*']

permissions:
  contents: write

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
              tag_name: context.ref.replace('refs/tags/', ''),
              name: `Release ${context.ref.replace('refs/tags/', '')}`,
              draft: true,
              prerelease: false,
              generate_release_notes: true,
            });
            return data.id;

  build-tauri:
    needs: create-release
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: 'macos-latest'
            args: '--target aarch64-apple-darwin'
          - platform: 'macos-latest'
            args: '--target x86_64-apple-darwin'
          - platform: 'ubuntu-22.04'
            args: ''
          - platform: 'windows-latest'
            args: ''

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - name: Install dependencies (Ubuntu)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - run: npm ci

      - name: Build Tauri
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_KEY_PASSWORD }}
        with:
          releaseId: ${{ needs.create-release.outputs.release_id }}
          args: ${{ matrix.args }}

  publish-release:
    needs: [create-release, build-tauri]
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

  update-manifest:
    needs: publish-release
    runs-on: ubuntu-latest
    steps:
      - name: Generate update manifest
        uses: actions/github-script@v7
        with:
          script: |
            // Generate update manifest from assets of the latest release
            const { data: release } = await github.rest.repos.getLatestRelease({
              owner: context.repo.owner,
              repo: context.repo.repo,
            });

            const manifest = {
              version: release.tag_name.replace('v', ''),
              notes: release.body,
              pub_date: release.published_at,
              platforms: {},
            };

            // Pair signature files and binaries
            for (const asset of release.assets) {
              if (asset.name.endsWith('.sig')) {
                // Get contents of the signature file
                // Extract platform name and add to manifest
              }
            }

            console.log('Generated manifest:', JSON.stringify(manifest, null, 2));
```

---

## Anti-Patterns

### Anti-Pattern 1: Forced Immediate Restart

```typescript
// NG: Force restart interrupting user's work
autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall(); // Restarts immediately without user confirmation
});

// OK: Give the user a choice and update at an appropriate time
autoUpdater.on('update-downloaded', (info) => {
  const notification = new Notification({
    title: `v${info.version} is ready`,
    body: 'Will be applied automatically on next launch. You can also restart now.',
  });
  notification.on('click', () => {
    // Restart only when user explicitly clicks
    autoUpdater.quitAndInstall();
  });
  notification.show();
});
```

**Problem**: If the user is force-restarted while they have unsaved work, there is a risk of data loss. This is especially critical for document editing apps.

### Anti-Pattern 2: Skipping Signature Verification

```typescript
// NG: Skipping signature verification because it's too much trouble to implement
autoUpdater.allowDowngrade = true;
autoUpdater.channel = 'latest';
// Distributing unsigned binaries

// OK: Always verify signatures and use HTTPS + pinning
autoUpdater.allowDowngrade = false;
autoUpdater.autoRunAppAfterInstall = true;
// electron-builder publish settings distribute only signed binaries
// Tauri: Enable minisign verification via pubkey
```

**Problem**: Without signature verification, there is a risk that a man-in-the-middle attack could replace binaries with malware-infected ones. HTTPS alone is insufficient; the binary itself must be signed.

### Anti-Pattern 3: Missing Error Handling

```typescript
// NG: Ignoring update errors
autoUpdater.checkForUpdates(); // No error handling

// OK: Properly handle all error cases
try {
  const result = await autoUpdater.checkForUpdates();
  if (result) {
    log.info(`Update check complete: v${result.updateInfo.version}`);
  }
} catch (error) {
  if (error.message.includes('net::ERR_INTERNET_DISCONNECTED')) {
    log.warn('Skipping update check due to no network connection');
  } else if (error.message.includes('ECONNREFUSED')) {
    log.warn('Cannot connect to update server. Will retry later');
  } else {
    log.error('Unexpected error during update check:', error);
    // Report to error monitoring service such as Sentry
  }
}
```

**Problem**: Update checks can fail for many reasons including network errors, server downtime, and DNS failures. Swallowing errors means users may continue using an outdated version indefinitely.

---

## FAQ

### Q1: How frequently should update checks run?

**A**: For general desktop apps, "on launch + every 4-6 hours" is recommended. Checking only on launch causes delays for apps that run continuously for long periods. However, for urgent updates containing security fixes, a separate mechanism using push notifications (WebSocket, etc.) for immediate notification should be prepared. Since too-frequent checks increase server load and user bandwidth consumption, balance is important.

### Q2: How does the implementation difficulty of auto-update differ between Electron and Tauri?

**A**: Electron (electron-updater) is mature, and integration with GitHub Releases works with almost zero configuration. Tauri, on the other hand, requires minisign signing and the initial setup is somewhat more involved, but security is robust by default. In Tauri v2, the updater was separated as a plugin, enabling more flexible configuration. In both cases, building the CI/CD pipeline constitutes the majority of the actual workload.

### Q3: How should I implement phased rollout (canary release)?

**A**: The common approach is to use a hash of the user ID on the update server side to deliver updates based on the rollout rate. For example, deliver to 5% of users in the first 24 hours, then expand to 25% -> 50% -> 100% if the crash rate stays below the threshold. It is also important to integrate with Sentry or Crashlytics to automatically monitor crash rates and automatically stop delivery when anomalies are detected.

### Q4: How should I handle users in offline environments?

**A**: Since auto-updates do not function in offline environments, take the following measures: (1) Scheduling silent retries when an update check fails, (2) Providing offline update packages via USB drives etc., (3) For enterprise customers, integration with software distribution tools such as WSUS or SCCM, (4) Maintaining backend API version compatibility so that basic functionality works even with older versions.

### Q5: What happens if the app crashes during an update?

**A**: Behavior differs by framework. Electron's electron-updater creates a backup after download completes, and the old version remains if installation fails. Tauri executes installation only after the update binary download and signature verification are complete, so even a crash midway will not corrupt the original binary. However, in either case it is recommended to implement a rollback mechanism on the app side that reverts to the previous version if the app fails to launch 3 consecutive times.

---

## Summary

| Item | Key Points |
|------|-----------|
| Framework selection | Electron uses electron-updater, Tauri uses the updater plugin as standard |
| Update server | GitHub Releases (small scale), S3+CloudFront (medium to large), self-hosted (full control) |
| Delta update | bsdiff (Electron), zstd-delta (Tauri/Rust) can reduce bandwidth by over 90% |
| Signature verification | Always perform: Windows=Authenticode, macOS=codesign, Tauri=minisign |
| Rollback | Automatic rollback via crash counter method; backup retention is mandatory |
| Phased delivery | Minimize risk with canary releases using user ID hash |
| User experience | Avoid forced restart; background DL + apply on next launch is ideal |
| CI/CD | Fully automate signing, building, and publishing; eliminate manual releases |
| Error handling | Retry and fallback for network errors and server downtime |
| Tauri v2 updater | Plugin-based with flexible configuration. minisign signing is required |

## Next Guides to Read

- [Store Distribution (Microsoft Store / Mac App Store)](./02-store-distribution.md) -- Practical MSIX packaging and store review process
- Code Signing Details -- EV certificate acquisition and secure key management in CI/CD
- CI/CD Pipeline Setup -- Build automation with GitHub Actions / Azure Pipelines

## References

1. **electron-updater Official Documentation** -- https://www.electron.build/auto-update -- Comprehensive reference for electron-builder's auto-update module
2. **Tauri Updater Plugin** -- https://tauri.app/plugin/updater/ -- Tauri v2 updater plugin configuration and signing guide
3. **Squirrel.Windows** -- https://github.com/Squirrel/Squirrel.Windows -- .NET-based Windows auto-update framework (used internally by electron-updater)
4. **bsdiff / bspatch** -- https://www.daemonology.net/bsdiff/ -- Original paper and tools for the binary diff algorithm by Colin Percival
5. **minisign** -- https://jedisct1.github.io/minisign/ -- Minimal signing tool (used by Tauri)
6. **tauri-apps/tauri-action** -- https://github.com/tauri-apps/tauri-action -- GitHub Actions action for Tauri

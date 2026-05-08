# Tauri Setup

> Learn everything from environment setup and project creation to frontend integration, command definitions, and the event system for Tauri v2, a lightweight desktop application framework with a Rust backend.

---

## What You Will Learn

1. Set up the **Rust environment and Tauri CLI** and be able to create projects from scratch
2. Define **Tauri commands** and call Rust functions from the frontend
3. Use the **event system** to implement bidirectional communication between the frontend and backend
4. Understand **state management and lifecycle** to properly control application initialization and shutdown
5. Establish a **development workflow** and learn efficient approaches for hot reload, debugging, and testing


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [Electron Advanced](./01-electron-advanced.md)

---

## 1. What Is Tauri?

### 1.1 Comparison with Electron

```
+---------------------------+    +---------------------------+
|       Electron            |    |         Tauri             |
+---------------------------+    +---------------------------+
|                           |    |                           |
|  +---------------------+ |    |  +---------------------+  |
|  | Chromium (bundled)   | |    |  | OS WebView          |  |
|  | ~150MB              | |    |  | 0MB (built into OS)  |  |
|  +---------------------+ |    |  +---------------------+  |
|  | Node.js (bundled)   | |    |  | Rust binary          |  |
|  | ~40MB               | |    |  | ~3-5MB              |  |
|  +---------------------+ |    |  +---------------------+  |
|                           |    |                           |
|  Total: ~200MB+           |    |  Total: ~3-10MB          |
|  Memory: ~150MB+          |    |  Memory: ~30-50MB        |
+---------------------------+    +---------------------------+
```

### 1.2 Comparison Table

| Item | Electron | Tauri v2 |
|---|---|---|
| Backend language | JavaScript (Node.js) | Rust |
| WebView | Chromium (bundled) | OS native (WebView2/WebKit) |
| Binary size | 150-200 MB | 3-10 MB |
| Memory usage | 150-300 MB | 30-80 MB |
| Startup speed | 1-3 seconds | 0.3-1 second |
| Supported OS | Windows / macOS / Linux | Windows / macOS / Linux / iOS / Android |
| Security model | Preload + contextBridge | Capabilities (allowlist) |
| Ecosystem maturity | Very mature | Rapidly growing |
| Learning curve | Low (JS/TS only) | Medium to high (Rust knowledge required) |

### 1.3 Tauri v2 WebView Strategy

Since Tauri uses the WebView built into the OS, the WebView engine used differs per platform.

```
WebView engine by platform:

+------------------+------------------------------+------------------------+
| Platform         | WebView engine               | Notes                  |
+------------------+------------------------------+------------------------+
| Windows 10/11   | WebView2 (Chromium-based)    | Evergreen auto-update  |
| Windows 7/8     | WebView2 (manual install)    | Bundle bootstrapper    |
| macOS            | WKWebView (WebKit)           | Built into OS          |
| Linux            | WebKitGTK                    | Requires extra package |
| iOS              | WKWebView                    | Supported in Tauri v2  |
| Android          | Android WebView (Chromium)   | Supported in Tauri v2  |
+------------------+------------------------------+------------------------+
```

WebView2 Runtime is required on Windows, but it comes pre-installed on Windows 11. On Windows 10, bundling the bootstrapper in the app installer for automatic installation is recommended.

```rust
// You can specify the WebView2 installation strategy in Tauri's tauri.conf.json
// Configure under "bundle" > "windows" > "webviewInstallMode"
```

```json
{
  "bundle": {
    "windows": {
      "webviewInstallMode": {
        "type": "downloadBootstrapper"
      }
    }
  }
}
```

`webviewInstallMode` options:

| Mode | Description | Impact on binary size |
|---|---|---|
| `skip` | Skip automatic WebView2 installation | None |
| `downloadBootstrapper` | Installer automatically downloads | Minimal (~1.8MB added) |
| `embedBootstrapper` | Embed bootstrapper in binary | Small (~1.8MB added) |
| `offlineInstaller` | Bundle full WebView2 installer | Large (~130MB added) |
| `fixedVersion` | Bundle a specific version | Large (~130MB added) |

---

## 2. Environment Setup

### 2.1 Prerequisites

```
Required software by OS:

Windows:
├── Visual Studio Build Tools 2022
│   └── "Desktop development with C++" workload
├── WebView2 Runtime (pre-installed on Windows 11)
└── Rust toolchain

macOS:
├── Xcode Command Line Tools
│   $ xcode-select --install
└── Rust toolchain

Linux:
├── Various development libraries
│   $ sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev
└── Rust toolchain
```

### Code Example 1: Installing Rust and Tauri CLI

```bash
# Install Rust (via rustup)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Verify installation
rustc --version   # rustc 1.77.0 or later
cargo --version   # cargo 1.77.0 or later

# Install Tauri CLI (via cargo)
cargo install tauri-cli --version "^2.0.0"

# Use Tauri CLI as an npm package (alternative)
npm install -D @tauri-apps/cli@latest
```

### 2.2 Windows-Specific Setup Details

Visual Studio Build Tools is required for development on Windows. Follow these steps to set it up correctly.

```powershell
# Download and install Visual Studio Build Tools 2022
# Get the installer from https://visualstudio.microsoft.com/visual-cpp-build-tools/

# Install using winget (recommended)
winget install Microsoft.VisualStudio.2022.BuildTools --silent --override "--wait --quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"

# Verify WebView2 Runtime installation
# Check using registry
reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" /v pv

# Confirm Rust toolchain is using MSVC
rustup show
# Output should include "stable-x86_64-pc-windows-msvc"

# Explicitly set MSVC toolchain as default
rustup default stable-msvc
```

```powershell
# Common troubleshooting

# Error: "link.exe not found"
# Cause: Visual Studio Build Tools not installed correctly
# Fix: Reinstall with "Desktop development with C++" workload selected

# Error: "LINK : fatal error LNK1181: cannot open input file 'kernel32.lib'"
# Cause: Windows SDK is missing
# Fix: Add "Windows 11 SDK" via Visual Studio Installer

# Manual environment variable setup (usually not needed, but if PATH is not set)
$env:PATH += ";C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.39.33519\bin\Hostx64\x64"
```

### 2.3 Linux-Specific Setup Details

Required packages differ depending on the Linux distribution.

```bash
# Ubuntu / Debian
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf \
  libssl-dev \
  libsoup-3.0-dev \
  javascriptcoregtk-4.1-dev

# Fedora / RHEL
sudo dnf install -y \
  webkit2gtk4.1-devel \
  gtk3-devel \
  libappindicator-gtk3-devel \
  librsvg2-devel \
  patchelf \
  openssl-devel \
  libsoup3-devel \
  javascriptcoregtk4.1-devel

# Arch Linux
sudo pacman -S --needed \
  webkit2gtk-4.1 \
  gtk3 \
  libappindicator-gtk3 \
  librsvg \
  patchelf \
  openssl \
  libsoup3

# openSUSE
sudo zypper install -y \
  webkit2gtk3-devel \
  gtk3-devel \
  libappindicator-devel \
  librsvg-devel \
  patchelf \
  libopenssl-devel
```

### 2.4 Project Creation

### Code Example 2: Project Scaffolding

```bash
# Create a Tauri project interactively
# Select frontend: React + TypeScript (Vite)
cargo tauri init

# Or create via npm (with frontend template)
npm create tauri-app@latest my-tauri-app -- \
  --template react-ts

# Move to directory and install dependencies
cd my-tauri-app
npm install

# Start development server
cargo tauri dev
# or
npm run tauri dev
```

### Templates by Frontend Framework

Tauri can be combined with various frontend frameworks.

```bash
# React + TypeScript (Vite)
npm create tauri-app@latest my-app -- --template react-ts

# Vue + TypeScript (Vite)
npm create tauri-app@latest my-app -- --template vue-ts

# Svelte + TypeScript (Vite)
npm create tauri-app@latest my-app -- --template svelte-ts

# SolidJS + TypeScript (Vite)
npm create tauri-app@latest my-app -- --template solid-ts

# Angular (own build system)
npm create tauri-app@latest my-app -- --template angular

# Vanilla JavaScript (Vite)
npm create tauri-app@latest my-app -- --template vanilla

# Integration with Next.js (SSG mode)
npx create-next-app@latest my-next-tauri --typescript
cd my-next-tauri
npm install @tauri-apps/cli @tauri-apps/api
npx tauri init
```

### Next.js + Tauri Integration Configuration

When combining Next.js with Tauri, use SSG (Static Site Generation) mode.

```typescript
// next.config.ts — Change Next.js configuration to SSG mode
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export', // Static export (SSG mode)
  // Tauri serves via the file protocol, so use relative paths
  assetPrefix: process.env.TAURI_ENV_PLATFORM ? '/' : undefined,
  images: {
    unoptimized: true, // Disable image optimization in SSG
  },
}

export default nextConfig
```

```json
// src-tauri/tauri.conf.json — Configuration for Next.js
{
  "build": {
    "frontendDist": "../out",
    "devUrl": "http://localhost:3000",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  }
}
```

### 2.5 Directory Structure

```
my-tauri-app/
├── package.json                  ← Frontend dependencies
├── vite.config.ts                ← Vite configuration
├── tsconfig.json                 ← TypeScript configuration
│
├── src/                          ← Frontend (React)
│   ├── main.tsx                  ← Entry point
│   ├── App.tsx                   ← Root component
│   ├── components/               ← UI components
│   ├── hooks/                    ← Custom hooks
│   ├── lib/                      ← Utilities
│   │   └── tauri.ts              ← Tauri API wrapper
│   └── assets/                   ← Static assets
│
├── src-tauri/                    ← Tauri backend (Rust)
│   ├── Cargo.toml                ← Rust dependencies
│   ├── tauri.conf.json           ← Tauri configuration file
│   ├── capabilities/             ← Security permission definitions
│   │   └── default.json
│   ├── src/
│   │   ├── main.rs               ← Entry point
│   │   ├── lib.rs                ← Library root
│   │   └── commands/             ← Command definitions
│   │       ├── mod.rs
│   │       └── file_ops.rs
│   ├── icons/                    ← App icons
│   └── target/                   ← Build output
│
└── dist/                         ← Frontend build output
```

---

## 3. Tauri Configuration File

### Code Example 3: tauri.conf.json

```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-utils/schema.json",
  "productName": "My Tauri App",
  "version": "0.1.0",
  "identifier": "com.example.my-tauri-app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "title": "My Tauri App",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

### 3.1 Detailed Explanation of Configuration File

`tauri.conf.json` is the file that manages the core configuration of the application. It is important to understand the meaning and use of each section.

```json
{
  "productName": "My Tauri App",
  "version": "0.1.0",
  "identifier": "com.example.my-tauri-app",

  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },

  "app": {
    "windows": [
      {
        "label": "main",
        "title": "My Tauri App",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "maxWidth": 1920,
        "maxHeight": 1080,
        "resizable": true,
        "fullscreen": false,
        "center": true,
        "decorations": true,
        "transparent": false,
        "alwaysOnTop": false,
        "visible": true,
        "skipTaskbar": false,
        "fileDropEnabled": true,
        "url": "index.html"
      }
    ],
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: https: data:; connect-src 'self' https://api.example.com",
      "dangerousDisableAssetCspModification": false,
      "freezePrototype": true
    },
    "trayIcon": {
      "iconPath": "icons/tray-icon.png",
      "tooltip": "My Tauri App"
    },
    "withGlobalTauri": false
  },

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
      "assets/**/*"
    ],
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.comodoca.com",
      "wix": null,
      "nsis": {
        "installerIcon": "icons/icon.ico",
        "headerImage": "icons/nsis-header.bmp",
        "sidebarImage": "icons/nsis-sidebar.bmp",
        "installMode": "currentUser",
        "languages": ["Japanese", "English"],
        "displayLanguageSelector": true
      },
      "webviewInstallMode": {
        "type": "downloadBootstrapper"
      }
    },
    "macOS": {
      "frameworks": [],
      "minimumSystemVersion": "10.15",
      "signingIdentity": null,
      "entitlements": null
    },
    "linux": {
      "deb": {
        "depends": ["libwebkit2gtk-4.1-0", "libgtk-3-0"],
        "section": "utils"
      },
      "appimage": {
        "bundleMediaFramework": true
      }
    }
  }
}
```

### 3.2 Cargo.toml Configuration

```toml
# src-tauri/Cargo.toml — Rust project dependency configuration
[package]
name = "my-tauri-app"
version = "0.1.0"
description = "A Tauri desktop application"
authors = ["Your Name <your@email.com>"]
license = "MIT"
repository = "https://github.com/your-org/my-tauri-app"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-shell = "2"
tauri-plugin-store = "2"
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
tauri-plugin-notification = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
thiserror = "1"
dirs = "5"
hostname = "0.3"
log = "0.4"
env_logger = "0.10"

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]

# Optimization settings for release builds
[profile.release]
panic = "abort"       # Skip stack unwinding on panic (reduces binary size)
codegen-units = 1     # Single compilation unit (better optimization, longer build time)
lto = true            # Enable Link Time Optimization
opt-level = "s"       # Size optimization ("z" for even smaller)
strip = true          # Remove debug information
```

---

## 4. Command Definitions

### 4.1 Command Communication Flow

```
Frontend (TypeScript)                    Backend (Rust)
+----------------------------+          +----------------------------+
|                            |          |                            |
|  invoke('greet', {         |  ─IPC──→ | #[tauri::command]          |
|    name: 'Taro'            |          | fn greet(name: &str)       |
|  })                        |          |   -> String                |
|                            |          |                            |
|  .then(msg => {            |  ←─IPC── | return format!(            |
|    console.log(msg)        |          |   "Hello, {}!",            |
|  })                        |          |   name);                   |
+----------------------------+          +----------------------------+

  Communication: JSON serialization (serde)
  Error handling: Result<T, E> → Promise<T> | catch
```

### Code Example 4: Defining and Calling Commands

```rust
// src-tauri/src/main.rs — Tauri app entry point
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

fn main() {
    tauri::Builder::default()
        // Register commands
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::file_ops::read_file,
            commands::file_ops::write_file,
            commands::file_ops::list_directory,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri アプリの起動に失敗しました");
}
```

```rust
// src-tauri/src/commands/mod.rs — Command module
pub mod file_ops;

use serde::{Deserialize, Serialize};

/// Greeting command (simple example)
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("こんにちは、{}さん！Tauri からのメッセージです。", name)
}

/// Command returning structured data
#[derive(Serialize)]
pub struct SystemInfo {
    os: String,
    arch: String,
    hostname: String,
}

#[tauri::command]
pub fn get_system_info() -> SystemInfo {
    SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        hostname: hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "不明".to_string()),
    }
}
```

```rust
// src-tauri/src/commands/file_ops.rs — File operation commands
use std::fs;
use std::path::PathBuf;
use serde::Serialize;

/// Error type definition (error messages returned to the frontend)
#[derive(Debug, thiserror::Error)]
pub enum FileError {
    #[error("ファイルの読み込みに失敗: {0}")]
    ReadError(#[from] std::io::Error),

    #[error("許可されていないパスです: {0}")]
    ForbiddenPath(String),
}

// Allow Tauri to convert errors to JSON
impl serde::Serialize for FileError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Command to read a file
#[tauri::command]
pub fn read_file(path: String) -> Result<String, FileError> {
    let path = PathBuf::from(&path);

    // Security: verify the path is in an allowed directory
    validate_path(&path)?;

    let content = fs::read_to_string(&path)?;
    Ok(content)
}

/// Command to write to a file
#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), FileError> {
    let path = PathBuf::from(&path);
    validate_path(&path)?;
    fs::write(&path, content)?;
    Ok(())
}

/// Command to list directory contents
#[derive(Serialize)]
pub struct FileEntry {
    name: String,
    is_dir: bool,
    size: u64,
}

#[tauri::command]
pub fn list_directory(path: String) -> Result<Vec<FileEntry>, FileError> {
    let path = PathBuf::from(&path);
    validate_path(&path)?;

    let entries = fs::read_dir(&path)?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let metadata = entry.metadata().ok()?;
            Some(FileEntry {
                name: entry.file_name().to_string_lossy().to_string(),
                is_dir: metadata.is_dir(),
                size: metadata.len(),
            })
        })
        .collect();

    Ok(entries)
}

/// Path validation function
fn validate_path(path: &PathBuf) -> Result<(), FileError> {
    let canonical = path.canonicalize()
        .map_err(|_| FileError::ForbiddenPath(path.display().to_string()))?;

    // Allow access only under the home directory
    let home = dirs::home_dir()
        .ok_or_else(|| FileError::ForbiddenPath("ホームディレクトリが見つかりません".into()))?;

    if !canonical.starts_with(&home) {
        return Err(FileError::ForbiddenPath(canonical.display().to_string()));
    }

    Ok(())
}
```

### Calling from the Frontend

```typescript
// src/lib/tauri.ts — Type-safe wrapper for Tauri commands
import { invoke } from '@tauri-apps/api/core'

// Define return value types for commands
interface SystemInfo {
  os: string
  arch: string
  hostname: string
}

interface FileEntry {
  name: string
  is_dir: boolean
  size: number
}

// Type-safe API wrapper
export const tauriApi = {
  greet: (name: string): Promise<string> =>
    invoke('greet', { name }),

  getSystemInfo: (): Promise<SystemInfo> =>
    invoke('get_system_info'),

  readFile: (path: string): Promise<string> =>
    invoke('read_file', { path }),

  writeFile: (path: string, content: string): Promise<void> =>
    invoke('write_file', { path, content }),

  listDirectory: (path: string): Promise<FileEntry[]> =>
    invoke('list_directory', { path }),
}
```

```tsx
// src/App.tsx — Using commands from a React component
import { useState } from 'react'
import { tauriApi } from './lib/tauri'

function App() {
  const [greeting, setGreeting] = useState('')
  const [name, setName] = useState('')

  // Call a Tauri command
  const handleGreet = async () => {
    try {
      const message = await tauriApi.greet(name)
      setGreeting(message)
    } catch (error) {
      console.error('コマンド呼び出しエラー:', error)
    }
  }

  return (
    <div className="container">
      <h1>Tauri + React</h1>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="名前を入力"
      />
      <button onClick={handleGreet}>あいさつ</button>
      {greeting && <p>{greeting}</p>}
    </div>
  )
}

export default App
```

### 4.2 Advanced Command Patterns

#### Using Async Commands and AppHandle

```rust
// src-tauri/src/commands/advanced.rs — Advanced command patterns
use tauri::{AppHandle, Manager, State};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

/// Application state definition
#[derive(Default)]
pub struct AppState {
    pub counter: i32,
    pub history: Vec<String>,
}

/// Command that modifies state (injects State)
#[tauri::command]
pub fn increment_counter(state: State<'_, Mutex<AppState>>) -> Result<i32, String> {
    let mut state = state.lock().map_err(|e| e.to_string())?;
    state.counter += 1;
    state.history.push(format!("カウンター更新: {}", state.counter));
    Ok(state.counter)
}

/// Command using the Window handle
#[tauri::command]
pub async fn get_window_info(app: AppHandle) -> Result<WindowInfo, String> {
    let window = app.get_webview_window("main")
        .ok_or("メインウィンドウが見つかりません")?;

    let position = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let is_focused = window.is_focused().map_err(|e| e.to_string())?;

    Ok(WindowInfo {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        is_focused,
    })
}

#[derive(Serialize)]
pub struct WindowInfo {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    is_focused: bool,
}

/// Command with multiple arguments and complex return types
#[derive(Deserialize)]
pub struct SearchQuery {
    keyword: String,
    directory: String,
    extensions: Vec<String>,
    max_results: usize,
    case_sensitive: bool,
}

#[derive(Serialize)]
pub struct SearchResult {
    path: String,
    line_number: usize,
    content: String,
    score: f64,
}

#[tauri::command]
pub async fn search_files(query: SearchQuery) -> Result<Vec<SearchResult>, String> {
    use std::fs;

    let mut results = Vec::new();
    let dir = std::path::PathBuf::from(&query.directory);

    fn walk_dir(
        dir: &std::path::Path,
        query: &SearchQuery,
        results: &mut Vec<SearchResult>,
    ) -> Result<(), String> {
        let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;

        for entry in entries.flatten() {
            let path = entry.path();

            if path.is_dir() {
                walk_dir(&path, query, results)?;
            } else if let Some(ext) = path.extension() {
                let ext_str = ext.to_string_lossy().to_string();
                if query.extensions.contains(&ext_str) || query.extensions.is_empty() {
                    if let Ok(content) = fs::read_to_string(&path) {
                        for (i, line) in content.lines().enumerate() {
                            let matches = if query.case_sensitive {
                                line.contains(&query.keyword)
                            } else {
                                line.to_lowercase().contains(&query.keyword.to_lowercase())
                            };

                            if matches {
                                results.push(SearchResult {
                                    path: path.display().to_string(),
                                    line_number: i + 1,
                                    content: line.to_string(),
                                    score: 1.0,
                                });

                                if results.len() >= query.max_results {
                                    return Ok(());
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(())
    }

    walk_dir(&dir, &query, &mut results)?;
    Ok(results)
}
```

#### Registering State Management in main.rs

```rust
// src-tauri/src/main.rs — Entry point with state management
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use std::sync::Mutex;
use commands::advanced::AppState;

fn main() {
    tauri::Builder::default()
        // Manage application state
        .manage(Mutex::new(AppState::default()))
        // Initialization during setup
        .setup(|app| {
            // Create app data directory
            let app_dir = app.path().app_data_dir()
                .expect("アプリデータディレクトリの取得に失敗");
            std::fs::create_dir_all(&app_dir)
                .expect("ディレクトリの作成に失敗");

            log::info!("アプリデータディレクトリ: {:?}", app_dir);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::advanced::increment_counter,
            commands::advanced::get_window_info,
            commands::advanced::search_files,
            commands::file_ops::read_file,
            commands::file_ops::write_file,
            commands::file_ops::list_directory,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri アプリの起動に失敗しました");
}
```

---

## 5. Event System

### 5.1 Overview of Event Communication

```
+------------------------------------------------------+
|                 Tauri Event System                    |
+------------------------------------------------------+
|                                                      |
|  Frontend → Backend                                  |
|  emit('frontend-event', payload)                     |
|       └──→ app.listen('frontend-event', handler)     |
|                                                      |
|  Backend → Frontend                                  |
|  app.emit('backend-event', payload)                  |
|       └──→ listen('backend-event', callback)         |
|                                                      |
|  Backend → Specific window                           |
|  window.emit('window-event', payload)                |
|       └──→ listen('window-event', callback)          |
|                                                      |
|  Frontend → Frontend (within the same window)        |
|  emit('local-event', payload)                        |
|       └──→ listen('local-event', callback)           |
+------------------------------------------------------+
```

### Code Example 5: Sending and Receiving Events

```rust
// src-tauri/src/main.rs — Sending events from the backend
use tauri::{AppHandle, Manager, Emitter};
use std::time::Duration;

/// Command that periodically notifies progress
#[tauri::command]
async fn start_long_task(app: AppHandle) -> Result<String, String> {
    let total_steps = 10;

    for step in 1..=total_steps {
        // Simulate a time-consuming operation
        tokio::time::sleep(Duration::from_millis(500)).await;

        // Send a progress event to the frontend
        app.emit("task-progress", serde_json::json!({
            "current": step,
            "total": total_steps,
            "message": format!("ステップ {}/{} を処理中...", step, total_steps),
        })).map_err(|e| e.to_string())?;
    }

    // Send a completion event
    app.emit("task-complete", serde_json::json!({
        "result": "全ステップが完了しました"
    })).map_err(|e| e.to_string())?;

    Ok("タスク完了".to_string())
}
```

```typescript
// src/hooks/useTauriEvent.ts — Custom hook for receiving events
import { useEffect, useState } from 'react'
import { listen, UnlistenFn } from '@tauri-apps/api/event'

// General-purpose event listener hook
export function useTauriEvent<T>(
  eventName: string,
  handler: (payload: T) => void
): void {
  useEffect(() => {
    let unlisten: UnlistenFn | undefined

    // Register event listener
    listen<T>(eventName, (event) => {
      handler(event.payload)
    }).then((fn) => {
      unlisten = fn
    })

    // Cleanup: remove listener when component unmounts
    return () => {
      unlisten?.()
    }
  }, [eventName, handler])
}

// Specialized hook for progress display
interface Progress {
  current: number
  total: number
  message: string
}

export function useTaskProgress() {
  const [progress, setProgress] = useState<Progress | null>(null)
  const [isComplete, setIsComplete] = useState(false)

  useTauriEvent<Progress>('task-progress', (payload) => {
    setProgress(payload)
  })

  useTauriEvent<{ result: string }>('task-complete', () => {
    setIsComplete(true)
  })

  return { progress, isComplete }
}
```

```tsx
// src/components/TaskRunner.tsx — Progress display component
import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useTaskProgress } from '../hooks/useTauriEvent'

export function TaskRunner() {
  const [isRunning, setIsRunning] = useState(false)
  const { progress, isComplete } = useTaskProgress()

  const handleStart = async () => {
    setIsRunning(true)
    try {
      await invoke('start_long_task')
    } catch (error) {
      console.error('タスクエラー:', error)
    } finally {
      setIsRunning(false)
    }
  }

  // Calculate progress percentage
  const percentage = progress
    ? Math.round((progress.current / progress.total) * 100)
    : 0

  return (
    <div className="task-runner">
      <button onClick={handleStart} disabled={isRunning}>
        {isRunning ? '実行中...' : 'タスクを開始'}
      </button>

      {progress && (
        <div className="progress">
          <div className="progress-bar" style={{ width: `${percentage}%` }} />
          <span>{progress.message} ({percentage}%)</span>
        </div>
      )}

      {isComplete && <p>タスクが完了しました</p>}
    </div>
  )
}
```

### 5.2 Sending Events from the Frontend to the Backend

```typescript
// src/lib/events.ts — Sending events from the frontend
import { emit } from '@tauri-apps/api/event'

// Send an event from the frontend to the backend
export async function notifyBackend(eventName: string, data: unknown): Promise<void> {
  await emit(eventName, data)
}

// Example: notifying of a user action
export async function notifyUserAction(action: string, details: Record<string, unknown>): Promise<void> {
  await emit('user-action', {
    action,
    details,
    timestamp: Date.now(),
  })
}

// Listen to window lifecycle events
import { listen } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'

export async function setupWindowListeners(): Promise<void> {
  const appWindow = getCurrentWebviewWindow()

  // Window focus change
  await appWindow.onFocusChanged(({ payload: focused }) => {
    console.log(`ウィンドウフォーカス: ${focused ? '取得' : '喪失'}`)
  })

  // Window close event (cancelable)
  await appWindow.onCloseRequested(async (event) => {
    // Show confirmation dialog if there are unsaved changes
    const hasUnsavedChanges = checkUnsavedChanges()
    if (hasUnsavedChanges) {
      const confirmed = await confirm('未保存の変更があります。終了しますか？')
      if (!confirmed) {
        event.preventDefault() // Cancel close
      }
    }
  })

  // Window move event
  await appWindow.onMoved(({ payload: position }) => {
    console.log(`ウィンドウ移動: (${position.x}, ${position.y})`)
  })

  // Window resize event
  await appWindow.onResized(({ payload: size }) => {
    console.log(`ウィンドウリサイズ: ${size.width}x${size.height}`)
  })

  // File drop event
  await appWindow.onDragDropEvent((event) => {
    if (event.payload.type === 'drop') {
      console.log('ドロップされたファイル:', event.payload.paths)
    } else if (event.payload.type === 'hover') {
      console.log('ファイルがホバー中')
    } else if (event.payload.type === 'cancel') {
      console.log('ドラッグがキャンセルされました')
    }
  })
}

function checkUnsavedChanges(): boolean {
  // In a real app, determine from state management
  return false
}
```

```rust
// src-tauri/src/events.rs — Receiving events from the frontend in the backend
use tauri::{AppHandle, Listener};

/// Listen for events from the frontend in the backend
pub fn setup_event_listeners(app: &AppHandle) {
    // Listen for user actions
    let app_handle = app.clone();
    app.listen("user-action", move |event| {
        if let Some(payload) = event.payload().as_ref() {
            log::info!("ユーザーアクション受信: {}", payload);
            // Record to analytics log, etc.
        }
    });

    // Listen for settings changes
    let app_handle2 = app.clone();
    app.listen("settings-changed", move |event| {
        if let Some(payload) = event.payload().as_ref() {
            log::info!("設定変更: {}", payload);
            // Apply the settings
        }
    });
}
```

---

## 6. Development Workflow

### 6.1 How Hot Reload Works

In Tauri's development mode (`cargo tauri dev`), different hot reload mechanisms operate for the frontend and backend.

```
Development mode flow:

+-------------------------------------------------------------------+
|  $ cargo tauri dev                                                 |
|     |                                                              |
|     +---> [beforeDevCommand] npm run dev                           |
|     |       → Vite dev server starts at localhost:5173             |
|     |       → Frontend changes reflected instantly via HMR         |
|     |                                                              |
|     +---> [Rust build & launch]                                    |
|             → Compiles source code in src-tauri/                   |
|             → Auto-recompiles & restarts on Rust file changes      |
|             → Frontend WebView loads the devUrl                    |
+-------------------------------------------------------------------+
```

```json
// vite.config.ts — HMR configuration (for Tauri environment)
{
  "server": {
    "port": 5173,
    "strictPort": true,
    "host": "localhost",
    "hmr": {
      "protocol": "ws",
      "host": "localhost",
      "port": 5173
    },
    "watch": {
      "ignored": ["**/src-tauri/**"]
    }
  }
}
```

### 6.2 Debugging Techniques

```bash
# Enable log output for backend (Rust)
RUST_LOG=debug cargo tauri dev

# Debug only specific modules
RUST_LOG=my_tauri_app::commands=debug cargo tauri dev

# Open WebView DevTools in dev mode (F12 / right-click → Inspect)
# To enable DevTools in release builds:
# Set "devtools": true under "app" > "windows" in tauri.conf.json
```

```rust
// src-tauri/src/main.rs — Log initialization
fn main() {
    // Initialize env_logger (control level with RUST_LOG env var)
    env_logger::init();

    log::info!("アプリケーション開始");
    log::debug!("デバッグモード有効");

    tauri::Builder::default()
        .setup(|app| {
            log::info!("セットアップ開始");

            // Automatically open DevTools in debug builds
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Tauri アプリの起動に失敗しました");
}
```

### 6.3 Writing Tests

```rust
// src-tauri/src/commands/file_ops.rs — Unit tests
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_list_directory() {
        let temp_dir = TempDir::new().unwrap();
        let dir_path = temp_dir.path();

        // Create test files
        fs::write(dir_path.join("test.txt"), "hello").unwrap();
        fs::create_dir(dir_path.join("subdir")).unwrap();

        let result = list_directory(dir_path.display().to_string());
        // Note: validate_path needs to be mocked or skipped for testing
        // This example assumes the path is under the home directory

        match result {
            Ok(entries) => {
                assert!(entries.len() >= 2);
                assert!(entries.iter().any(|e| e.name == "test.txt" && !e.is_dir));
                assert!(entries.iter().any(|e| e.name == "subdir" && e.is_dir));
            }
            Err(_) => {
                // May return an error if tempdir is outside the home directory
            }
        }
    }

    #[test]
    fn test_greet() {
        let result = super::super::greet("テスト");
        assert!(result.contains("テスト"));
        assert!(result.contains("Tauri"));
    }
}
```

```typescript
// src/__tests__/tauri-mock.test.ts — Frontend mock tests
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock Tauri's invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'
import { tauriApi } from '../lib/tauri'

describe('tauriApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('greet calls invoke with the correct arguments', async () => {
    const mockInvoke = invoke as ReturnType<typeof vi.fn>
    mockInvoke.mockResolvedValue('こんにちは、太郎さん！')

    const result = await tauriApi.greet('太郎')

    expect(mockInvoke).toHaveBeenCalledWith('greet', { name: '太郎' })
    expect(result).toBe('こんにちは、太郎さん！')
  })

  it('readFile handles errors correctly', async () => {
    const mockInvoke = invoke as ReturnType<typeof vi.fn>
    mockInvoke.mockRejectedValue('許可されていないパスです')

    await expect(tauriApi.readFile('/etc/passwd')).rejects.toBe(
      '許可されていないパスです'
    )
  })

  it('getSystemInfo returns structured data', async () => {
    const mockInvoke = invoke as ReturnType<typeof vi.fn>
    mockInvoke.mockResolvedValue({
      os: 'windows',
      arch: 'x86_64',
      hostname: 'my-pc',
    })

    const info = await tauriApi.getSystemInfo()
    expect(info.os).toBe('windows')
    expect(info.arch).toBe('x86_64')
  })
})
```

---

## 7. Build and Optimization

### 7.1 Release Build

```bash
# Release build (for all platforms)
cargo tauri build

# Windows only (NSIS installer)
cargo tauri build --target x86_64-pc-windows-msvc

# macOS Universal Binary (Intel + Apple Silicon)
cargo tauri build --target universal-apple-darwin

# Linux (AppImage + deb)
cargo tauri build --target x86_64-unknown-linux-gnu

# Release build with debug information
cargo tauri build --debug

# Specify bundle type
cargo tauri build --bundles nsis,msi
cargo tauri build --bundles deb,appimage
cargo tauri build --bundles dmg,app
```

### 7.2 Binary Size Optimization

```toml
# Cargo.toml — Size optimization settings
[profile.release]
panic = "abort"
codegen-units = 1
lto = true
opt-level = "z"    # Even smaller than "s"
strip = true

# Additional compression via UPX (Tauri afterBuild hook)
```

```json
// tauri.conf.json — Settings to minimize bundle size
{
  "bundle": {
    "resources": [],
    "windows": {
      "nsis": {
        "compression": "lzma"
      }
    }
  }
}
```

```bash
# Check binary size after build
ls -lh src-tauri/target/release/my-tauri-app
ls -lh src-tauri/target/release/bundle/

# Compress with UPX (optional)
upx --best --lzma src-tauri/target/release/my-tauri-app.exe
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Overusing unwrap() and Causing Panics

```rust
// BAD: unwrap() causes the process to panic (crash) on error
#[tauri::command]
fn read_config() -> String {
    let content = std::fs::read_to_string("config.json").unwrap(); // Potential panic
    let config: serde_json::Value = serde_json::from_str(&content).unwrap();
    config["name"].as_str().unwrap().to_string()
}
```

```rust
// GOOD: Handle errors properly with Result type and propagate to frontend
#[tauri::command]
fn read_config() -> Result<String, String> {
    let content = std::fs::read_to_string("config.json")
        .map_err(|e| format!("設定ファイルの読み込みに失敗: {}", e))?;

    let config: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("JSON パースエラー: {}", e))?;

    config["name"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "設定に 'name' フィールドがありません".to_string())
}
```

### Anti-Pattern 2: Blocking the Main Thread in Async Commands

```rust
// BAD: Synchronous file I/O blocks the main thread
#[tauri::command]
fn process_large_file(path: String) -> Result<String, String> {
    // Reading a large file freezes the UI
    let data = std::fs::read_to_string(&path)
        .map_err(|e| e.to_string())?;
    // Heavy processing...
    Ok(process(data))
}
```

```rust
// GOOD: Run asynchronously with an async command
#[tauri::command]
async fn process_large_file(path: String) -> Result<String, String> {
    // Use tokio async I/O (does not block the main thread)
    let data = tokio::fs::read_to_string(&path).await
        .map_err(|e| e.to_string())?;

    // Delegate CPU-bound processing to a separate thread with spawn_blocking
    let result = tokio::task::spawn_blocking(move || {
        process(&data)
    }).await.map_err(|e| e.to_string())?;

    Ok(result)
}
```

### Anti-Pattern 3: Leaking Event Listeners in the Frontend

```typescript
// BAD: Register a listener without cleanup in useEffect
function BadComponent() {
  useEffect(() => {
    // Listener is registered but never removed → memory leak
    listen('some-event', (event) => {
      console.log(event.payload)
    })
  }, [])
  return <div>Bad</div>
}
```

```typescript
// GOOD: Always remove listeners in cleanup function
function GoodComponent() {
  useEffect(() => {
    let unlisten: (() => void) | undefined

    listen('some-event', (event) => {
      console.log(event.payload)
    }).then((fn) => {
      unlisten = fn
    })

    return () => {
      unlisten?.()
    }
  }, [])
  return <div>Good</div>
}
```

### Anti-Pattern 4: Disabling CSP

```json
// BAD: Completely disable Content Security Policy
{
  "app": {
    "security": {
      "csp": null
    }
  }
}
```

```json
// GOOD: Configure a minimal CSP
{
  "app": {
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: https: data:; connect-src 'self' https://api.example.com"
    }
  }
}
```

---


## 9. FAQ

### Q1: Can I use Tauri without knowing Rust?

**A:** For basic applications, many features can be implemented using only the JavaScript APIs provided by Tauri (file dialogs, notifications, clipboard, etc.). However, Rust knowledge becomes necessary for custom commands and plugin development. It is recommended to learn the basics of Rust's ownership system and error handling (Result/Option).

### Q2: What are the major differences between Tauri v1 and v2?

**A:** The main changes in Tauri v2 are as follows: (1) Mobile support (iOS/Android) was added, (2) The security model changed from `allowlist` to `capabilities`, (3) The plugin system was significantly revamped, (4) Import paths for `@tauri-apps/api` were changed. For migration from v1, refer to the official migration guide.

### Q3: How do I debug a Tauri app?

**A:** For the frontend, the browser's DevTools (F12 or right-click → Inspect) can be used just like regular web development. For the Rust backend, use `println!` macro for console output or the VS Code LLDB debugger extension. Detailed logs can be enabled with `RUST_LOG=debug cargo tauri dev`.

### Q4: Can Tauri fully replace Electron?

**A:** It can be a replacement for many use cases, but there are caveats. (1) Since WebView is platform-dependent, browser compatibility issues may arise (especially differences between Windows WebView2 and macOS WebKit). (2) Apps that depend on the Node.js ecosystem (e.g., native addons) have a high migration cost. (3) If Rust's learning curve does not align with the team's skill set. Tauri is advantageous when performance and binary size matter, while Electron is advantageous when utilizing the Node.js ecosystem or browser consistency is important.

### Q5: Can Tauri cross-compile?

**A:** Tauri fundamentally recommends native compilation (building on the target OS). This is because WebView dependencies are OS-specific. In CI/CD, the standard approach is to use GitHub Actions matrix builds with runners for each OS. However, Rust's own cross-compilation (`cargo build --target`) is possible and can be used for testing libraries excluding the Tauri parts.

### Q6: How can I reduce the memory usage of a Tauri app?

**A:** (1) Reduce the frontend JavaScript bundle size (tree shaking, code splitting). (2) Process large amounts of data on the Rust side and pass only the minimum data needed for display to the frontend. (3) Properly clean up event listeners to prevent memory leaks. (4) Lazy-load images and media. (5) Use `Box` and `Arc` on the Rust side to optimize heap usage.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. It is recommended to thoroughly understand the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architecture design.

---

## 10. Summary

| Topic | Key Points |
|---|---|
| Tauri advantages | Small size (3-10MB), low memory, uses OS WebView |
| Environment setup | Rust toolchain + OS-specific development libraries |
| Project structure | `src/` (frontend) + `src-tauri/` (backend) |
| Commands | Define Rust functions with `#[tauri::command]`, call with `invoke()` |
| Error handling | Use `Result<T, E>` to return error messages to the frontend |
| Events | Bidirectional async communication via `emit()` / `listen()` |
| Configuration | Set window, security, and bundle options in `tauri.conf.json` |
| State management | Share state in a thread-safe way with `Mutex<T>` + `.manage()` |
| Development workflow | Hot reload with `cargo tauri dev`, debug with DevTools |
| Testing | Use `#[cfg(test)]` on the Rust side, Vitest + mock on the frontend |
| Build optimization | Reduce binary size with `lto`, `strip`, `opt-level="z"` |

---

## What to Read Next

- **[03-tauri-advanced.md](./03-tauri-advanced.md)** — Advanced usage of plugins, custom protocols, and security configuration
- **[00-packaging-and-signing.md](../03-distribution/00-packaging-and-signing.md)** — Packaging and signing Tauri apps

---

## References

1. Tauri, "Getting Started", https://v2.tauri.app/start/
2. Tauri, "Command Guide", https://v2.tauri.app/develop/calling-rust/
3. Tauri, "Event System", https://v2.tauri.app/develop/calling-rust/#event-system
4. The Rust Programming Language, https://doc.rust-lang.org/book/
5. Tauri, "Configuration Reference", https://v2.tauri.app/reference/config/
6. Tauri, "Window Customization", https://v2.tauri.app/develop/window-customization/
7. Vite, "HMR Guide", https://vitejs.dev/guide/api-hmr.html

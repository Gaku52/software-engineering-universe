# Tauri Advanced

> Gain a deep understanding of Tauri v2's plugin system, custom protocols, sidecar binaries, multi-window management, and the capabilities-based security model to build production-grade desktop applications.

---

## What You Will Learn

1. Leverage the **plugin system** to design and implement reusable feature modules
2. Use **custom protocols and sidecars** to achieve advanced native integration
3. Configure **capabilities (permission model)** correctly to build secure applications
4. Implement **system tray and menus** to deliver an OS-native user experience
5. Master **database integration and persistence** patterns to implement robust data management


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of relevant foundational concepts
- Familiarity with the content in [Tauri Setup](./02-tauri-setup.md)

---

## 1. Plugin System

### 1.1 Plugin Architecture

```
+----------------------------------------------------------+
|                   Tauri Application                       |
+----------------------------------------------------------+
|                                                          |
|  tauri::Builder::default()                               |
|    .plugin(tauri_plugin_store::init())     ← Official    |
|    .plugin(tauri_plugin_sql::init())       ← Official    |
|    .plugin(my_custom_plugin::init())       ← Custom      |
|                                                          |
|  +---------------------------------------------------+   |
|  |  Plugin Internal Structure                        |   |
|  |                                                   |   |
|  |  ┌──────────┐  ┌──────────┐  ┌──────────────┐   |   |
|  |  │ Rust     │  │ JS API   │  │ Capabilities │   |   |
|  |  │ Backend  │  │ Bindings │  │ (permissions)│   |   |
|  |  │          │  │          │  │              │   |   |
|  |  │ commands │  │ invoke() │  │ permissions  │   |   |
|  |  │ state    │  │ listen() │  │ scopes       │   |   |
|  |  │ lifecycle│  │          │  │              │   |   |
|  |  └──────────┘  └──────────┘  └──────────────┘   |   |
|  +---------------------------------------------------+   |
+----------------------------------------------------------+
```

### 1.2 Official Plugin List

| Plugin | Functionality | Cargo Package |
|---|---|---|
| store | Key-Value storage | `tauri-plugin-store` |
| sql | SQLite / MySQL / PostgreSQL | `tauri-plugin-sql` |
| fs | File system operations | `tauri-plugin-fs` |
| dialog | File dialogs, message boxes | `tauri-plugin-dialog` |
| notification | OS notifications | `tauri-plugin-notification` |
| clipboard-manager | Clipboard operations | `tauri-plugin-clipboard-manager` |
| shell | External command execution | `tauri-plugin-shell` |
| http | HTTP client | `tauri-plugin-http` |
| updater | Auto-update | `tauri-plugin-updater` |
| log | Log output | `tauri-plugin-log` |
| window-state | Save window position and size | `tauri-plugin-window-state` |
| global-shortcut | Global keyboard shortcuts | `tauri-plugin-global-shortcut` |
| process | Process management (exit/restart) | `tauri-plugin-process` |
| os | Retrieve OS information | `tauri-plugin-os` |
| deep-link | Deep links (custom URL schemes) | `tauri-plugin-deep-link` |
| autostart | Auto-start on OS boot | `tauri-plugin-autostart` |

### Code Example 1: Adding Official Plugins

```bash
# Rust side: add plugins
cargo add tauri-plugin-store tauri-plugin-sql tauri-plugin-dialog

# Frontend side: add API packages
npm install @tauri-apps/plugin-store @tauri-apps/plugin-sql @tauri-apps/plugin-dialog
```

```rust
// src-tauri/src/main.rs — Register plugins
fn main() {
    tauri::Builder::default()
        // Key-Value store plugin
        .plugin(tauri_plugin_store::Builder::new().build())
        // SQLite database plugin
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:app.db",
                    vec![tauri_plugin_sql::Migration {
                        version: 1,
                        description: "初期テーブル作成",
                        sql: "CREATE TABLE IF NOT EXISTS tasks (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            title TEXT NOT NULL,
                            completed BOOLEAN DEFAULT FALSE
                        );",
                        kind: tauri_plugin_sql::MigrationKind::Up,
                    }],
                )
                .build(),
        )
        // File dialog plugin
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("Tauri アプリの起動に失敗しました");
}
```

```typescript
// src/lib/store.ts — Using the Key-Value store
import { Store } from '@tauri-apps/plugin-store'

// Initialize the store (file path is relative to the app data directory)
const store = await Store.load('settings.json')

// Save values
await store.set('theme', 'dark')
await store.set('language', 'ja')
await store.set('windowSize', { width: 1200, height: 800 })

// Retrieve values (type-safe via type parameter)
const theme = await store.get<string>('theme')
const size = await store.get<{ width: number; height: number }>('windowSize')

// Delete a value
await store.delete('obsoleteKey')

// Persist to disk (explicit save required)
await store.save()
```

### 1.3 Practical Usage Examples with Official Plugins

#### Combining File Dialog and File System

```typescript
// src/lib/file-manager.ts — Integrating file dialog and file operations
import { open, save, message, confirm } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'

// Open file dialog + read file
export async function openTextFile(): Promise<{ path: string; content: string } | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [
      { name: 'テキストファイル', extensions: ['txt', 'md', 'json'] },
      { name: 'すべてのファイル', extensions: ['*'] },
    ],
  })

  if (!selected) return null

  const path = typeof selected === 'string' ? selected : selected[0]
  const content = await readTextFile(path)
  return { path, content }
}

// Save As dialog + write file
export async function saveTextFileAs(content: string): Promise<string | null> {
  const filePath = await save({
    filters: [
      { name: 'テキストファイル', extensions: ['txt'] },
      { name: 'Markdown', extensions: ['md'] },
      { name: 'JSON', extensions: ['json'] },
    ],
    defaultPath: 'untitled.txt',
  })

  if (!filePath) return null

  await writeTextFile(filePath, content)
  return filePath
}

// Save a file to the app-specific data directory
export async function saveAppData(filename: string, data: string): Promise<void> {
  const dataDir = await appDataDir()
  const filePath = await join(dataDir, filename)

  // Create the directory if it does not exist
  const dirExists = await exists(dataDir)
  if (!dirExists) {
    await mkdir(dataDir, { recursive: true })
  }

  await writeTextFile(filePath, data)
}

// Save with an overwrite confirmation dialog
export async function saveWithConfirmation(path: string, content: string): Promise<boolean> {
  const fileExists = await exists(path)
  if (fileExists) {
    const shouldOverwrite = await confirm(
      `${path} は既に存在します。上書きしますか？`,
      { title: '上書き確認', kind: 'warning' }
    )
    if (!shouldOverwrite) return false
  }

  await writeTextFile(path, content)
  await message('ファイルを保存しました', { title: '保存完了', kind: 'info' })
  return true
}
```

#### Registering Global Shortcuts

```typescript
// src/lib/shortcuts.ts — Managing global shortcuts
import { register, unregisterAll, isRegistered } from '@tauri-apps/plugin-global-shortcut'

export async function setupGlobalShortcuts(): Promise<void> {
  // Clear all existing shortcuts
  await unregisterAll()

  // Ctrl+Shift+S for quick save
  await register('CmdOrCtrl+Shift+S', (event) => {
    if (event.state === 'Pressed') {
      console.log('クイック保存が実行されました')
      // Execute save logic
    }
  })

  // Ctrl+Shift+N for new window
  await register('CmdOrCtrl+Shift+N', (event) => {
    if (event.state === 'Pressed') {
      console.log('新しいウィンドウを開きます')
    }
  })

  // F5 to refresh
  await register('F5', (event) => {
    if (event.state === 'Pressed') {
      console.log('データをリフレッシュします')
    }
  })
}
```

### Code Example 2: Creating a Custom Plugin

```rust
// src-tauri/src/plugins/analytics.rs — Custom analytics plugin
use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Manager, Runtime, Emitter,
};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

/// Type definition for analytics events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsEvent {
    pub name: String,
    pub properties: serde_json::Value,
    pub timestamp: u64,
}

/// Internal state of the plugin
pub struct AnalyticsState {
    events: Vec<AnalyticsEvent>,
    enabled: bool,
}

/// Command to record an event
#[tauri::command]
async fn track_event<R: Runtime>(
    app: AppHandle<R>,
    name: String,
    properties: serde_json::Value,
) -> Result<(), String> {
    let state = app.state::<Mutex<AnalyticsState>>();
    let mut state = state.lock().map_err(|e| e.to_string())?;

    if !state.enabled {
        return Ok(());
    }

    let event = AnalyticsEvent {
        name: name.clone(),
        properties,
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    };

    state.events.push(event);

    // Flush when 100 events have accumulated
    if state.events.len() >= 100 {
        flush_events(&mut state.events)?;
    }

    Ok(())
}

/// Send accumulated events
fn flush_events(events: &mut Vec<AnalyticsEvent>) -> Result<(), String> {
    // Batch send logic (omitted)
    println!("分析イベント {} 件を送信", events.len());
    events.clear();
    Ok(())
}

/// Plugin initialization function
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("analytics")
        // Register commands within the plugin
        .invoke_handler(tauri::generate_handler![track_event])
        // Manage plugin state
        .setup(|app, _api| {
            app.manage(Mutex::new(AnalyticsState {
                events: Vec::new(),
                enabled: true,
            }));
            Ok(())
        })
        .build()
}
```

```typescript
// src/lib/analytics.ts — Frontend API for the custom plugin
import { invoke } from '@tauri-apps/api/core'

// Function to record an analytics event
export async function trackEvent(
  name: string,
  properties: Record<string, unknown> = {}
): Promise<void> {
  // Plugin commands are called in the format "plugin:plugin-name|command-name"
  await invoke('plugin:analytics|track_event', { name, properties })
}

// Usage examples
trackEvent('page_view', { page: '/dashboard' })
trackEvent('button_click', { button: 'save', section: 'editor' })
```

### Code Example 2b: More Advanced Custom Plugin — Encrypted Storage

```rust
// src-tauri/src/plugins/encrypted_store.rs — Encrypted storage plugin
use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Manager, Runtime,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::path::PathBuf;

/// Internal state of the encrypted storage
pub struct EncryptedStoreState {
    data: HashMap<String, serde_json::Value>,
    file_path: PathBuf,
    encryption_key: Vec<u8>,
    dirty: bool,
}

impl EncryptedStoreState {
    fn new(file_path: PathBuf, key: Vec<u8>) -> Self {
        Self {
            data: HashMap::new(),
            file_path,
            encryption_key: key,
            dirty: false,
        }
    }

    /// Load data from disk (decrypt)
    fn load(&mut self) -> Result<(), String> {
        if !self.file_path.exists() {
            return Ok(());
        }

        let encrypted = std::fs::read(&self.file_path)
            .map_err(|e| format!("ファイル読み込みエラー: {}", e))?;

        // Simple XOR encryption (use AES-256-GCM or similar in production)
        let decrypted = self.xor_cipher(&encrypted);
        let json_str = String::from_utf8(decrypted)
            .map_err(|e| format!("UTF-8 デコードエラー: {}", e))?;

        self.data = serde_json::from_str(&json_str)
            .map_err(|e| format!("JSON パースエラー: {}", e))?;

        Ok(())
    }

    /// Save data to disk (encrypt)
    fn save(&mut self) -> Result<(), String> {
        if !self.dirty {
            return Ok(());
        }

        let json_str = serde_json::to_string(&self.data)
            .map_err(|e| format!("JSON シリアライズエラー: {}", e))?;

        let encrypted = self.xor_cipher(json_str.as_bytes());

        // Create parent directory
        if let Some(parent) = self.file_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("ディレクトリ作成エラー: {}", e))?;
        }

        std::fs::write(&self.file_path, &encrypted)
            .map_err(|e| format!("ファイル書き込みエラー: {}", e))?;

        self.dirty = false;
        Ok(())
    }

    fn xor_cipher(&self, data: &[u8]) -> Vec<u8> {
        data.iter()
            .enumerate()
            .map(|(i, byte)| byte ^ self.encryption_key[i % self.encryption_key.len()])
            .collect()
    }
}

/// Command to retrieve a value
#[tauri::command]
async fn encrypted_get<R: Runtime>(
    app: AppHandle<R>,
    key: String,
) -> Result<Option<serde_json::Value>, String> {
    let state = app.state::<Mutex<EncryptedStoreState>>();
    let state = state.lock().map_err(|e| e.to_string())?;
    Ok(state.data.get(&key).cloned())
}

/// Command to set a value
#[tauri::command]
async fn encrypted_set<R: Runtime>(
    app: AppHandle<R>,
    key: String,
    value: serde_json::Value,
) -> Result<(), String> {
    let state = app.state::<Mutex<EncryptedStoreState>>();
    let mut state = state.lock().map_err(|e| e.to_string())?;
    state.data.insert(key, value);
    state.dirty = true;
    state.save()?;
    Ok(())
}

/// Command to delete a value
#[tauri::command]
async fn encrypted_delete<R: Runtime>(
    app: AppHandle<R>,
    key: String,
) -> Result<bool, String> {
    let state = app.state::<Mutex<EncryptedStoreState>>();
    let mut state = state.lock().map_err(|e| e.to_string())?;
    let removed = state.data.remove(&key).is_some();
    if removed {
        state.dirty = true;
        state.save()?;
    }
    Ok(removed)
}

/// Plugin initialization
pub fn init<R: Runtime>(encryption_key: &str) -> TauriPlugin<R> {
    let key = encryption_key.as_bytes().to_vec();

    Builder::new("encrypted-store")
        .invoke_handler(tauri::generate_handler![
            encrypted_get,
            encrypted_set,
            encrypted_delete,
        ])
        .setup(move |app, _api| {
            let app_dir = app.path().app_data_dir()
                .map_err(|e| e.into())?;
            let file_path = app_dir.join("encrypted_store.bin");

            let mut store = EncryptedStoreState::new(file_path, key.clone());
            store.load().map_err(|e| {
                log::error!("暗号化ストアの読み込みに失敗: {}", e);
                Box::new(std::io::Error::new(std::io::ErrorKind::Other, e)) as Box<dyn std::error::Error>
            })?;

            app.manage(Mutex::new(store));
            Ok(())
        })
        .build()
}
```

```typescript
// src/lib/encrypted-store.ts — Frontend API for encrypted storage
import { invoke } from '@tauri-apps/api/core'

export class EncryptedStore {
  async get<T>(key: string): Promise<T | null> {
    return invoke<T | null>('plugin:encrypted-store|encrypted_get', { key })
  }

  async set(key: string, value: unknown): Promise<void> {
    await invoke('plugin:encrypted-store|encrypted_set', { key, value })
  }

  async delete(key: string): Promise<boolean> {
    return invoke<boolean>('plugin:encrypted-store|encrypted_delete', { key })
  }
}

// Usage example
const secureStore = new EncryptedStore()
await secureStore.set('api_token', 'sk-xxxxxxxxxxxxx')
const token = await secureStore.get<string>('api_token')
```

---

## 2. Custom Protocols

### 2.1 Protocol Request Flow

```
Frontend                         Rust Backend
+------------------+             +---------------------------+
|                  |             |                           |
| <img src=        |  HTTP-like  | register_assetprotocol    |
|  "asset://       | ──request──→ |   _protocol("asset",     |
|   images/        |             |     |path| {              |
|   photo.jpg">   |             |       Read file            |
|                  |  ←response── |       Return bytes        |
|  [Image shown]   |   (bytes)   |     })                    |
+------------------+             +---------------------------+
```

### Code Example 3: Implementing a Custom Protocol

```rust
// src-tauri/src/main.rs — Serve local files safely via a custom protocol
use tauri::http::{Request, Response};
use std::path::PathBuf;

fn main() {
    tauri::Builder::default()
        // Register the "asset://" protocol
        .register_assetprotocol_handler("asset", |_ctx, request| {
            handle_asset_request(request)
        })
        .run(tauri::generate_context!())
        .expect("起動に失敗しました");
}

fn handle_asset_request(request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    let uri = request.uri().to_string();
    // "asset://localhost/images/photo.jpg" → "images/photo.jpg"
    let path = uri.replace("asset://localhost/", "");

    // Base path for the allowed directory
    let base_dir = dirs::document_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("my-app-assets");

    let file_path = base_dir.join(&path);

    // Prevent path traversal attacks
    match file_path.canonicalize() {
        Ok(canonical) if canonical.starts_with(&base_dir) => {
            match std::fs::read(&canonical) {
                Ok(data) => {
                    // Guess MIME type
                    let mime = mime_guess::from_path(&canonical)
                        .first_or_octet_stream()
                        .to_string();

                    Response::builder()
                        .status(200)
                        .header("Content-Type", mime)
                        .body(data)
                        .unwrap()
                }
                Err(_) => Response::builder()
                    .status(404)
                    .body(b"ファイルが見つかりません".to_vec())
                    .unwrap(),
            }
        }
        _ => Response::builder()
            .status(403)
            .body(b"アクセス禁止".to_vec())
            .unwrap(),
    }
}
```

### 2.2 Custom Protocol Application — Streaming Delivery

```rust
// src-tauri/src/protocols/media.rs — Streaming delivery for media files
use tauri::http::{Request, Response};
use std::io::Read;

/// Parse Range header and return partial content (for video streaming)
pub fn handle_media_request(request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    let uri = request.uri().to_string();
    let path = uri.replace("media://localhost/", "");
    let file_path = std::path::PathBuf::from(&path);

    // Retrieve file metadata
    let metadata = match std::fs::metadata(&file_path) {
        Ok(m) => m,
        Err(_) => {
            return Response::builder()
                .status(404)
                .body(b"Not Found".to_vec())
                .unwrap();
        }
    };

    let file_size = metadata.len();
    let mime = mime_guess::from_path(&file_path)
        .first_or_octet_stream()
        .to_string();

    // Check Range header
    let range_header = request.headers().get("Range")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if range_header.starts_with("bytes=") {
        // Handle Range request
        let range = &range_header[6..];
        let parts: Vec<&str> = range.split('-').collect();
        let start: u64 = parts[0].parse().unwrap_or(0);
        let end: u64 = if parts.len() > 1 && !parts[1].is_empty() {
            parts[1].parse().unwrap_or(file_size - 1)
        } else {
            // Chunk size: 1MB
            std::cmp::min(start + 1_048_576, file_size - 1)
        };

        let length = end - start + 1;

        // Read a portion of the file
        let mut file = std::fs::File::open(&file_path).unwrap();
        std::io::Seek::seek(&mut file, std::io::SeekFrom::Start(start)).unwrap();
        let mut buffer = vec![0u8; length as usize];
        file.read_exact(&mut buffer).unwrap_or_default();

        Response::builder()
            .status(206) // Partial Content
            .header("Content-Type", &mime)
            .header("Content-Length", length.to_string())
            .header("Content-Range", format!("bytes {}-{}/{}", start, end, file_size))
            .header("Accept-Ranges", "bytes")
            .body(buffer)
            .unwrap()
    } else {
        // Regular request (return the entire file)
        let data = std::fs::read(&file_path).unwrap_or_default();

        Response::builder()
            .status(200)
            .header("Content-Type", &mime)
            .header("Content-Length", file_size.to_string())
            .header("Accept-Ranges", "bytes")
            .body(data)
            .unwrap()
    }
}
```

```typescript
// src/components/MediaPlayer.tsx — Video player using a custom protocol
import { useState } from 'react'

interface MediaPlayerProps {
  filePath: string
}

export function MediaPlayer({ filePath }: MediaPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)

  // Reference a local file via the media:// protocol
  const mediaUrl = `media://localhost/${encodeURIComponent(filePath)}`

  return (
    <div className="media-player">
      <video
        src={mediaUrl}
        controls
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        style={{ maxWidth: '100%', maxHeight: '80vh' }}
      />
      <p>{isPlaying ? '再生中' : '停止中'}</p>
    </div>
  )
}
```

---

## 3. Sidecar (External Binaries)

### 3.1 How Sidecars Work

```
+----------------------------------------------------------+
|                   Tauri Application                       |
+----------------------------------------------------------+
|                                                          |
|  Rust Backend                                            |
|  ┌────────────────────────┐                              |
|  │  Command::new_sidecar  │                              |
|  │    ("ffmpeg")          │                              |
|  │         │              │                              |
|  └─────────│──────────────┘                              |
|            ↓                                             |
|  +---------------------+                                 |
|  | binaries/           |                                 |
|  |   ffmpeg-x86_64-    |  ← OS/architecture-specific    |
|  |   pc-windows-msvc   |    binary                       |
|  +---------------------+                                 |
|            ↓                                             |
|  [Run as a separate process]                             |
|  Communicate via stdin/stdout/stderr                     |
+----------------------------------------------------------+
```

### Code Example 4: Configuring and Using a Sidecar

```json
// tauri.conf.json — Register sidecar binaries
{
  "bundle": {
    "externalBin": [
      "binaries/ffmpeg"
    ]
  }
}
```

```
Binary placement (naming convention by OS/architecture):

src-tauri/binaries/
├── ffmpeg-x86_64-pc-windows-msvc.exe    ← Windows (x64)
├── ffmpeg-aarch64-pc-windows-msvc.exe   ← Windows (ARM64)
├── ffmpeg-x86_64-apple-darwin           ← macOS (Intel)
├── ffmpeg-aarch64-apple-darwin          ← macOS (Apple Silicon)
├── ffmpeg-x86_64-unknown-linux-gnu      ← Linux (x64)
└── ffmpeg-aarch64-unknown-linux-gnu     ← Linux (ARM64)
```

```rust
// src-tauri/src/commands/media.rs — Video conversion using a sidecar
use tauri_plugin_shell::ShellExt;
use tauri::AppHandle;

/// Command to convert a video
#[tauri::command]
async fn convert_video(
    app: AppHandle,
    input: String,
    output: String,
    format: String,
) -> Result<String, String> {
    // Get the sidecar binary as a command
    let shell = app.shell();

    let output_result = shell
        .sidecar("ffmpeg")
        .map_err(|e| format!("サイドカーの起動に失敗: {}", e))?
        .args([
            "-i", &input,        // Input file
            "-c:v", "libx264",   // Video codec
            "-c:a", "aac",       // Audio codec
            "-f", &format,       // Output format
            "-y",                // Allow overwrite
            &output,             // Output file
        ])
        .output()
        .await
        .map_err(|e| format!("変換に失敗: {}", e))?;

    if output_result.status.success() {
        Ok(format!("変換完了: {}", output))
    } else {
        let stderr = String::from_utf8_lossy(&output_result.stderr);
        Err(format!("変換エラー: {}", stderr))
    }
}

/// Stream sidecar output in real time
#[tauri::command]
async fn convert_video_with_progress(
    app: AppHandle,
    input: String,
    output: String,
) -> Result<(), String> {
    use tauri::Emitter;

    let shell = app.shell();

    let (mut rx, _child) = shell
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args(["-i", &input, "-y", &output, "-progress", "pipe:1"])
        .spawn()
        .map_err(|e| e.to_string())?;

    // Read child process output asynchronously
    while let Some(event) = rx.recv().await {
        match event {
            tauri_plugin_shell::process::CommandEvent::Stdout(line) => {
                // Send progress info to frontend as an event
                let line_str = String::from_utf8_lossy(&line);
                let _ = app.emit("conversion-progress", line_str.to_string());
            }
            tauri_plugin_shell::process::CommandEvent::Terminated(status) => {
                let _ = app.emit("conversion-complete", status.code);
                break;
            }
            _ => {}
        }
    }

    Ok(())
}
```

### 3.2 Advanced Sidecar Usage Pattern — Running Python Scripts

```rust
// src-tauri/src/commands/python_bridge.rs — Run Python scripts as a sidecar
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct PythonResult {
    pub success: bool,
    pub output: String,
    pub error: String,
}

/// Command to execute a Python script
#[tauri::command]
pub async fn run_python_script(
    app: AppHandle,
    script_name: String,
    args: Vec<String>,
) -> Result<PythonResult, String> {
    let shell = app.shell();

    // Run the Python binary as a sidecar
    let mut command_args = vec![
        format!("scripts/{}", script_name),
    ];
    command_args.extend(args);

    let output = shell
        .sidecar("python")
        .map_err(|e| format!("Python の起動に失敗: {}", e))?
        .args(&command_args)
        .output()
        .await
        .map_err(|e| format!("スクリプト実行エラー: {}", e))?;

    Ok(PythonResult {
        success: output.status.success(),
        output: String::from_utf8_lossy(&output.stdout).to_string(),
        error: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

/// Manage a long-running Python process
#[tauri::command]
pub async fn start_python_server(
    app: AppHandle,
    port: u16,
) -> Result<u32, String> {
    use tauri::Emitter;

    let shell = app.shell();

    let (mut rx, child) = shell
        .sidecar("python")
        .map_err(|e| e.to_string())?
        .args(["scripts/server.py", "--port", &port.to_string()])
        .spawn()
        .map_err(|e| e.to_string())?;

    let pid = child.pid();

    // Monitor output in the background
    let app_clone = app.clone();
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                tauri_plugin_shell::process::CommandEvent::Stdout(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    let _ = app_clone.emit("python-stdout", line_str.to_string());
                }
                tauri_plugin_shell::process::CommandEvent::Stderr(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    let _ = app_clone.emit("python-stderr", line_str.to_string());
                }
                tauri_plugin_shell::process::CommandEvent::Terminated(status) => {
                    let _ = app_clone.emit("python-terminated", status.code);
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(pid)
}
```

---

## 4. Multi-Window

### Code Example 5: Managing Multiple Windows

```rust
// src-tauri/src/commands/window.rs — Window management commands
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// Command to open a new window
#[tauri::command]
async fn open_window(
    app: AppHandle,
    label: String,
    title: String,
    url: String,
    width: f64,
    height: f64,
) -> Result<(), String> {
    // If the window already exists, focus it and return
    if let Some(window) = app.get_webview_window(&label) {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Create a new window
    WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::App(url.into()),
    )
    .title(&title)
    .inner_size(width, height)
    .min_inner_size(400.0, 300.0)
    .build()
    .map_err(|e| format!("ウィンドウ作成に失敗: {}", e))?;

    Ok(())
}

/// Command to send a message between windows
#[tauri::command]
async fn send_to_window(
    app: AppHandle,
    target_label: String,
    event: String,
    payload: serde_json::Value,
) -> Result<(), String> {
    use tauri::Emitter;

    if let Some(window) = app.get_webview_window(&target_label) {
        window.emit(&event, payload)
            .map_err(|e| e.to_string())?;
    } else {
        return Err(format!("ウィンドウ '{}' が見つかりません", target_label));
    }

    Ok(())
}

/// Command to list all windows
#[tauri::command]
fn list_windows(app: AppHandle) -> Vec<String> {
    app.webview_windows()
        .keys()
        .cloned()
        .collect()
}
```

```typescript
// src/lib/windows.ts — Window operations from the frontend
import { invoke } from '@tauri-apps/api/core'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

// Open the settings window
export async function openSettings(): Promise<void> {
  // Get the existing window if it exists
  const existing = await WebviewWindow.getByLabel('settings')
  if (existing) {
    await existing.setFocus()
    return
  }

  // Create a new window
  const settingsWindow = new WebviewWindow('settings', {
    url: '/settings',
    title: '設定',
    width: 600,
    height: 500,
    resizable: true,
    center: true,
  })

  // Wait for window creation to complete
  settingsWindow.once('tauri://created', () => {
    console.log('設定ウィンドウを作成しました')
  })

  settingsWindow.once('tauri://error', (e) => {
    console.error('ウィンドウ作成エラー:', e)
  })
}
```

### 4.1 Advanced Inter-Window Communication Patterns

```typescript
// src/lib/window-communication.ts — Inter-window communication manager
import { emit, listen, UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'

interface WindowMessage {
  from: string
  to: string
  type: string
  payload: unknown
  timestamp: number
}

export class WindowCommunicator {
  private windowLabel: string
  private listeners: Map<string, UnlistenFn> = new Map()

  constructor() {
    this.windowLabel = getCurrentWebviewWindow().label
  }

  // Send a message to a specific window
  async sendTo(targetLabel: string, type: string, payload: unknown): Promise<void> {
    const message: WindowMessage = {
      from: this.windowLabel,
      to: targetLabel,
      type,
      payload,
      timestamp: Date.now(),
    }
    await emit(`window-msg:${targetLabel}`, message)
  }

  // Broadcast (send to all windows)
  async broadcast(type: string, payload: unknown): Promise<void> {
    const message: WindowMessage = {
      from: this.windowLabel,
      to: '*',
      type,
      payload,
      timestamp: Date.now(),
    }
    await emit('window-broadcast', message)
  }

  // Register a message receive listener
  async onMessage(handler: (message: WindowMessage) => void): Promise<void> {
    // Messages addressed directly to this window
    const directUnlisten = await listen<WindowMessage>(
      `window-msg:${this.windowLabel}`,
      (event) => handler(event.payload)
    )
    this.listeners.set('direct', directUnlisten)

    // Broadcast messages
    const broadcastUnlisten = await listen<WindowMessage>(
      'window-broadcast',
      (event) => {
        // Skip if the sender is this window
        if (event.payload.from !== this.windowLabel) {
          handler(event.payload)
        }
      }
    )
    this.listeners.set('broadcast', broadcastUnlisten)
  }

  // Remove all listeners
  destroy(): void {
    for (const unlisten of this.listeners.values()) {
      unlisten()
    }
    this.listeners.clear()
  }
}
```

---

## 5. Security (Capabilities)

### 5.1 The Capabilities Model Concept

```
+----------------------------------------------------------+
|               Tauri v2 Security Model                     |
+----------------------------------------------------------+
|                                                          |
|  Capability (permission set)                             |
|  ┌────────────────────────────────────────────────────┐  |
|  │  "main-capability"                                 │  |
|  │                                                    │  |
|  │  Applies to: windows: ["main"]                     │  |
|  │                                                    │  |
|  │  Permissions (individual):                         │  |
|  │  ┌──────────────────┐  ┌──────────────────┐       │  |
|  │  │ fs:read          │  │ dialog:open      │       │  |
|  │  │ scope: ["$HOME"] │  │                  │       │  |
|  │  └──────────────────┘  └──────────────────┘       │  |
|  │  ┌──────────────────┐  ┌──────────────────┐       │  |
|  │  │ store:default    │  │ notification:    │       │  |
|  │  │                  │  │ default          │       │  |
|  │  └──────────────────┘  └──────────────────┘       │  |
|  └────────────────────────────────────────────────────┘  |
|                                                          |
|  Principle of least privilege — grant only what is       |
|  explicitly needed                                       |
+----------------------------------------------------------+
```

### 5.2 Configuring Capabilities

```json
// src-tauri/capabilities/default.json — Permission definition for the main window
{
  "identifier": "main-capability",
  "description": "Permissions granted to the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "notification:default",
    "clipboard-manager:default",
    "store:default",
    {
      "identifier": "fs:read",
      "allow": [
        { "path": "$HOME/Documents/**" },
        { "path": "$APPDATA/**" }
      ]
    },
    {
      "identifier": "fs:write",
      "allow": [
        { "path": "$APPDATA/**" }
      ]
    },
    {
      "identifier": "shell:default",
      "deny": [
        { "name": "rm" },
        { "name": "del" }
      ]
    },
    {
      "identifier": "http:default",
      "allow": [
        { "url": "https://api.example.com/**" }
      ]
    }
  ]
}
```

```json
// src-tauri/capabilities/settings.json — Restricted permissions for the settings window
{
  "identifier": "settings-capability",
  "description": "Restricted permissions for the settings window",
  "windows": ["settings"],
  "permissions": [
    "core:default",
    "store:default"
  ]
}
```

### 5.3 Permission Path Variables

| Variable | Windows | macOS | Description |
|---|---|---|---|
| `$HOME` | `C:\Users\{user}` | `/Users/{user}` | Home directory |
| `$APPDATA` | `%APPDATA%\{bundle}` | `~/Library/Application Support/{bundle}` | App data |
| `$DESKTOP` | `{HOME}\Desktop` | `~/Desktop` | Desktop |
| `$DOCUMENT` | `{HOME}\Documents` | `~/Documents` | Documents |
| `$DOWNLOAD` | `{HOME}\Downloads` | `~/Downloads` | Downloads |
| `$TEMP` | `%TEMP%` | `/tmp` | Temporary directory |

### 5.4 Defining Permissions for Custom Commands

Permissions can be set not only for plugins, but also for app-specific commands.

```json
// src-tauri/capabilities/default.json — Permissions for custom commands
{
  "identifier": "main-capability",
  "windows": ["main"],
  "permissions": [
    "core:default",
    {
      "identifier": "core:default",
      "allow": [
        { "cmd": "greet" },
        { "cmd": "get_system_info" },
        { "cmd": "read_file" },
        { "cmd": "write_file" },
        { "cmd": "list_directory" }
      ]
    }
  ]
}
```

---

## 6. System Tray and Menus

### 6.1 Implementing the System Tray

```rust
// src-tauri/src/tray.rs — System tray configuration
use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    Manager, Emitter,
};

pub fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Create menu items
    let show_item = MenuItemBuilder::with_id("show", "Show Window")
        .build(app)?;
    let hide_item = MenuItemBuilder::with_id("hide", "Hide Window")
        .build(app)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "Quit")
        .accelerator("CmdOrCtrl+Q")
        .build(app)?;

    // Build the menu
    let menu = MenuBuilder::new(app)
        .item(&show_item)
        .item(&hide_item)
        .item(&separator)
        .item(&quit_item)
        .build()?;

    // Build the tray icon
    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("My Tauri App")
        .menu(&menu)
        .on_menu_event(move |app, event| {
            match event.id().as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "hide" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.hide();
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            match event {
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } => {
                    let app = tray.app_handle();
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
                TrayIconEvent::DoubleClick {
                    button: MouseButton::Left,
                    ..
                } => {
                    let app = tray.app_handle();
                    if let Some(window) = app.get_webview_window("main") {
                        let visible = window.is_visible().unwrap_or(false);
                        if visible {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}
```

### 6.2 Configuring the Application Menu

```rust
// src-tauri/src/menu.rs — Building the application menu bar
use tauri::{
    menu::{MenuBuilder, SubmenuBuilder, MenuItemBuilder, PredefinedMenuItem, CheckMenuItemBuilder},
    Manager, Emitter,
};

pub fn setup_menu(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // File menu
    let new_item = MenuItemBuilder::with_id("file-new", "New")
        .accelerator("CmdOrCtrl+N")
        .build(app)?;
    let open_item = MenuItemBuilder::with_id("file-open", "Open...")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let save_item = MenuItemBuilder::with_id("file-save", "Save")
        .accelerator("CmdOrCtrl+S")
        .build(app)?;
    let save_as_item = MenuItemBuilder::with_id("file-save-as", "Save As...")
        .accelerator("CmdOrCtrl+Shift+S")
        .build(app)?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&new_item)
        .item(&open_item)
        .separator()
        .item(&save_item)
        .item(&save_as_item)
        .separator()
        .quit()
        .build()?;

    // Edit menu
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    // View menu
    let dark_mode = CheckMenuItemBuilder::with_id("view-dark-mode", "Dark Mode")
        .checked(false)
        .build(app)?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&dark_mode)
        .separator()
        .fullscreen()
        .build()?;

    // Build the menu bar
    let menu = MenuBuilder::new(app)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .build()?;

    app.set_menu(menu)?;

    // Handle menu events
    app.on_menu_event(move |app, event| {
        match event.id().as_ref() {
            "file-new" => {
                let _ = app.emit("menu-action", "new");
            }
            "file-open" => {
                let _ = app.emit("menu-action", "open");
            }
            "file-save" => {
                let _ = app.emit("menu-action", "save");
            }
            "file-save-as" => {
                let _ = app.emit("menu-action", "save-as");
            }
            "view-dark-mode" => {
                let _ = app.emit("menu-action", "toggle-dark-mode");
            }
            _ => {}
        }
    });

    Ok(())
}
```

```typescript
// src/hooks/useMenuActions.ts — Listener for menu actions
import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'

export function useMenuActions(handlers: {
  onNew?: () => void
  onOpen?: () => void
  onSave?: () => void
  onSaveAs?: () => void
  onToggleDarkMode?: () => void
}) {
  useEffect(() => {
    const unlisten = listen<string>('menu-action', (event) => {
      switch (event.payload) {
        case 'new':
          handlers.onNew?.()
          break
        case 'open':
          handlers.onOpen?.()
          break
        case 'save':
          handlers.onSave?.()
          break
        case 'save-as':
          handlers.onSaveAs?.()
          break
        case 'toggle-dark-mode':
          handlers.onToggleDarkMode?.()
          break
      }
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [handlers])
}
```

---

## 7. Database Integration

### 7.1 CRUD Operations with SQLite

```typescript
// src/lib/database.ts — SQLite database operations
import Database from '@tauri-apps/plugin-sql'

// Database connection (stored in the app data directory)
let db: Database | null = null

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:app.db')
  }
  return db
}

// Task type definition
interface Task {
  id: number
  title: string
  description: string
  completed: boolean
  created_at: string
  updated_at: string
}

// CRUD operations
export const taskRepository = {
  // Retrieve all tasks
  async findAll(): Promise<Task[]> {
    const db = await getDb()
    return db.select<Task[]>('SELECT * FROM tasks ORDER BY created_at DESC')
  },

  // Retrieve a task by ID
  async findById(id: number): Promise<Task | null> {
    const db = await getDb()
    const results = await db.select<Task[]>('SELECT * FROM tasks WHERE id = $1', [id])
    return results[0] || null
  },

  // Create a task
  async create(title: string, description: string): Promise<number> {
    const db = await getDb()
    const result = await db.execute(
      'INSERT INTO tasks (title, description, completed, created_at, updated_at) VALUES ($1, $2, 0, datetime("now"), datetime("now"))',
      [title, description]
    )
    return result.lastInsertId
  },

  // Update a task
  async update(id: number, updates: Partial<Task>): Promise<void> {
    const db = await getDb()
    const fields: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (updates.title !== undefined) {
      fields.push(`title = $${paramIndex++}`)
      values.push(updates.title)
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramIndex++}`)
      values.push(updates.description)
    }
    if (updates.completed !== undefined) {
      fields.push(`completed = $${paramIndex++}`)
      values.push(updates.completed ? 1 : 0)
    }

    fields.push(`updated_at = datetime("now")`)
    values.push(id)

    await db.execute(
      `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    )
  },

  // Delete a task
  async delete(id: number): Promise<void> {
    const db = await getDb()
    await db.execute('DELETE FROM tasks WHERE id = $1', [id])
  },

  // Search tasks
  async search(keyword: string): Promise<Task[]> {
    const db = await getDb()
    return db.select<Task[]>(
      'SELECT * FROM tasks WHERE title LIKE $1 OR description LIKE $1 ORDER BY created_at DESC',
      [`%${keyword}%`]
    )
  },
}
```

### 7.2 Advanced Database Operations on the Rust Side

```rust
// src-tauri/src/database.rs — SQLite operations on the Rust side (using rusqlite)
use rusqlite::{Connection, params};
use serde::Serialize;
use std::sync::Mutex;

pub struct Database {
    conn: Connection,
}

#[derive(Serialize)]
pub struct TaskStats {
    total: i64,
    completed: i64,
    pending: i64,
    completion_rate: f64,
}

impl Database {
    pub fn new(path: &str) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open(path)?;

        // Enable WAL mode (improves performance)
        conn.execute_batch("
            PRAGMA journal_mode=WAL;
            PRAGMA synchronous=NORMAL;
            PRAGMA foreign_keys=ON;
        ")?;

        // Create tables
        conn.execute_batch("
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                completed BOOLEAN DEFAULT 0,
                priority INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
            CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
        ")?;

        Ok(Self { conn })
    }

    pub fn get_stats(&self) -> Result<TaskStats, rusqlite::Error> {
        let total: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM tasks",
            [],
            |row| row.get(0),
        )?;

        let completed: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM tasks WHERE completed = 1",
            [],
            |row| row.get(0),
        )?;

        let pending = total - completed;
        let completion_rate = if total > 0 {
            (completed as f64 / total as f64) * 100.0
        } else {
            0.0
        };

        Ok(TaskStats {
            total,
            completed,
            pending,
            completion_rate,
        })
    }
}

/// Database command
#[tauri::command]
pub fn get_task_stats(
    db: tauri::State<'_, Mutex<Database>>,
) -> Result<TaskStats, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_stats().map_err(|e| e.to_string())
}
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Granting All Permissions in Capabilities

```json
// Bad: Grant all default permissions to every plugin for all windows
{
  "identifier": "everything",
  "windows": ["*"],
  "permissions": [
    "fs:default",
    "shell:default",
    "http:default"
  ]
}
```

```json
// Good: Grant only the minimum required permissions per window
{
  "identifier": "main-restricted",
  "windows": ["main"],
  "permissions": [
    {
      "identifier": "fs:read",
      "allow": [{ "path": "$DOCUMENT/my-app/**" }]
    },
    {
      "identifier": "http:default",
      "allow": [{ "url": "https://api.example.com/**" }]
    }
  ]
}
```

### Anti-Pattern 2: Holding a Mutex Lock During I/O in Plugin State Management

```rust
// Bad: Holding the Mutex lock while performing I/O
#[tauri::command]
async fn sync_data(state: tauri::State<'_, Mutex<AppState>>) -> Result<(), String> {
    let mut state = state.lock().unwrap(); // Acquire lock
    // HTTP request while holding the lock → blocks other commands
    let data = reqwest::get("https://api.example.com/data")
        .await.map_err(|e| e.to_string())?
        .json::<Data>().await.map_err(|e| e.to_string())?;
    state.data = data;
    Ok(())
} // Lock released here
```

```rust
// Good: Minimize the duration the lock is held
#[tauri::command]
async fn sync_data(state: tauri::State<'_, Mutex<AppState>>) -> Result<(), String> {
    // Fetch data first (no lock needed)
    let data = reqwest::get("https://api.example.com/data")
        .await.map_err(|e| e.to_string())?
        .json::<Data>().await.map_err(|e| e.to_string())?;

    // Hold the lock only briefly to update state
    {
        let mut state = state.lock().unwrap();
        state.data = data;
    } // Lock released immediately

    Ok(())
}
```

### Anti-Pattern 3: Leaking Sidecar Processes

```rust
// Bad: Launch a sidecar process and leave it unmanaged (becomes a zombie process)
#[tauri::command]
async fn run_background_process(app: AppHandle) -> Result<(), String> {
    let shell = app.shell();
    let (rx, child) = shell
        .sidecar("worker")
        .map_err(|e| e.to_string())?
        .spawn()
        .map_err(|e| e.to_string())?;

    // child is not retained and rx is not read → process leaks
    Ok(())
}
```

```rust
// Good: Properly manage the process lifecycle
#[tauri::command]
async fn run_background_process(
    app: AppHandle,
    state: tauri::State<'_, Mutex<ProcessManager>>,
) -> Result<u32, String> {
    let shell = app.shell();
    let (mut rx, child) = shell
        .sidecar("worker")
        .map_err(|e| e.to_string())?
        .spawn()
        .map_err(|e| e.to_string())?;

    let pid = child.pid();

    // Register the process in state management
    {
        let mut manager = state.lock().map_err(|e| e.to_string())?;
        manager.register(pid, child);
    }

    // Monitor output and clean up on termination
    let state_clone = state.inner().clone();
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            if let tauri_plugin_shell::process::CommandEvent::Terminated(_) = event {
                if let Ok(mut manager) = state_clone.lock() {
                    manager.unregister(pid);
                }
                break;
            }
        }
    });

    Ok(pid)
}
```

---

## 9. FAQ

### Q1: Should I publish a custom Tauri plugin as a crate?

**A:** If the logic is app-specific, placing it as a module within the project is sufficient. For reuse across multiple projects, the recommended approach is to publish it to crates.io using the `tauri-plugin-*` naming convention, or manage it as a path or Git dependency in Cargo within an internal Git repository. The official plugin template (`cargo tauri plugin init`) makes scaffolding straightforward.

### Q2: What should I do when a sidecar binary is large?

**A:** There are several options: (1) Download it from a server on first launch and cache it in the app data directory; (2) Reduce binary size with a compression tool such as UPX; (3) Link it directly as a Rust library crate instead of a sidecar (where possible). For large binaries like FFmpeg, approach (1) is the most practical.

### Q3: Can capabilities in Tauri v2 be added dynamically at runtime?

**A:** Capabilities are defined statically at build time and cannot be changed dynamically at runtime. However, since different capabilities can be assigned per window, practical dynamic control is possible by opening windows with different permission sets as needed. If finer-grained runtime control is required, implement access control logic on the Rust command side.

### Q4: How do I synchronize state in a multi-window app?

**A:** Using Tauri's event system is the simplest approach. When state changes, broadcast an event to all windows, and each window's frontend updates its own display. Using `Mutex<AppState>` on the Rust backend as a central single source of truth, accessed by all windows via commands, is also effective. For large-scale apps, it is recommended to adopt a unidirectional data flow pattern like Redux and use the backend as the store.

### Q5: How do I display OS native notifications in a Tauri app?

**A:** Use `tauri-plugin-notification`. Install it with `npm install @tauri-apps/plugin-notification` and add `notification:default` to your capabilities. On the frontend, you can easily send a notification with `sendNotification({ title: 'Title', body: 'Body' })`. It uses toast notifications on Windows, Notification Center on macOS, and libnotify on Linux. The plugin handles permission requests automatically.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is the most important thing. Rather than theory alone, understanding deepens by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional work?

Knowledge of this topic is frequently applied in day-to-day development work, particularly during code reviews and architectural design discussions.

---

## 10. Summary

| Topic | Key Points |
|---|---|
| Plugin system | Rich set of official plugins. Custom plugins are created with `Builder::new()` |
| Custom protocols | Use `register_assetprotocol_handler` to serve local files safely |
| Sidecar | Bundle external binaries per OS/architecture. Communicate via stdin/stdout |
| Multi-window | Create with `WebviewWindowBuilder`. Identify and manage by label |
| Capabilities | Principle of least privilege. Define permissions per window in JSON |
| State management | Use `Mutex` + `app.manage()` for thread-safe management. Minimize lock duration |
| System tray | Build tray icon and menu with `TrayIconBuilder` |
| Menu | Build native menu bar with `MenuBuilder` |
| Database | SQLite integration with `tauri-plugin-sql`. `rusqlite` is also an option on the Rust side |

---

## Recommended Next Guides

- **[00-packaging-and-signing.md](../03-distribution/00-packaging-and-signing.md)** — Packaging and signing Tauri apps
- **[01-auto-update.md](../03-distribution/01-auto-update.md)** — Auto-update using the Tauri updater

---

## References

1. Tauri, "Plugins", https://v2.tauri.app/develop/plugins/
2. Tauri, "Security — Capabilities", https://v2.tauri.app/security/capabilities/
3. Tauri, "Sidecar", https://v2.tauri.app/develop/sidecar/
4. Tauri, "Multi-Window", https://v2.tauri.app/develop/window-customization/
5. Tauri, "System Tray", https://v2.tauri.app/develop/system-tray/
6. Tauri, "Menu", https://v2.tauri.app/develop/menu/
7. rusqlite Documentation, https://docs.rs/rusqlite/

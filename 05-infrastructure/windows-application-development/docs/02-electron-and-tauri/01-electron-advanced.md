# Electron Advanced

> Master advanced techniques required for full-scale Electron app development, including multi-window management, custom title bars, native module integration, SQLite databases, and performance optimization.

---

## What You Will Learn

1. How to implement **multi-window management** and custom title bars
2. How to integrate **native modules (C++ add-ons) and SQLite**
3. How to identify **performance bottlenecks** and optimize startup time and memory usage


## Prerequisites

Having the following knowledge will deepen your understanding before reading this guide:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Electron Setup](./00-electron-setup.md)

---

## 1. Multi-Window Management

### 1.1 Window Management Architecture

```
+----------------------------------------------------------+
|                    Main Process                           |
|                                                          |
|  WindowManager                                           |
|  ┌─────────────────────────────────────────────────────┐  |
|  │  windows: Map<string, BrowserWindow>                │  |
|  │                                                     │  |
|  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │  |
|  │  │ main     │  │ settings │  │ about    │         │  |
|  │  │ (Main)   │  │ (Config) │  │ (About)  │         │  |
|  │  └──────────┘  └──────────┘  └──────────┘         │  |
|  └─────────────────────────────────────────────────────┘  |
|                                                          |
|  Inter-window communication: IPC via Main process        |
|  Window A  ───→  Main  ───→  Window B                    |
+----------------------------------------------------------+
```

### Code Example 1: WindowManager Class

```typescript
// src/main/window-manager.ts — Centralized window management class
import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

// Type definition for window configuration
interface WindowConfig {
  width?: number
  height?: number
  minWidth?: number
  minHeight?: number
  parent?: BrowserWindow   // Parent window (for modals)
  modal?: boolean          // Whether to make it a modal window
  route?: string           // Route path on the Renderer side
  resizable?: boolean
}

class WindowManager {
  // Managed with window ID as the key
  private windows = new Map<string, BrowserWindow>()

  // Create a window or focus an existing one
  createWindow(id: string, config: WindowConfig = {}): BrowserWindow {
    // If the window already exists, focus it and return
    const existing = this.windows.get(id)
    if (existing && !existing.isDestroyed()) {
      existing.focus()
      return existing
    }

    const {
      width = 800,
      height = 600,
      minWidth = 400,
      minHeight = 300,
      parent,
      modal = false,
      route = '/',
      resizable = true,
    } = config

    const win = new BrowserWindow({
      width,
      height,
      minWidth,
      minHeight,
      parent,
      modal,
      resizable,
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        sandbox: true,
      },
    })

    // Show after ready to prevent flickering
    win.once('ready-to-show', () => win.show())

    // Remove from map when window is closed
    win.on('closed', () => {
      this.windows.delete(id)
    })

    // Load the content
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      // Development: Vite Dev Server URL + route path
      win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${route}`)
    } else {
      // Production: built HTML + hash routing
      win.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: route,
      })
    }

    this.windows.set(id, win)
    return win
  }

  // Get all windows
  getWindow(id: string): BrowserWindow | undefined {
    return this.windows.get(id)
  }

  // Send a message to a specific window
  sendTo(id: string, channel: string, ...args: unknown[]): void {
    const win = this.windows.get(id)
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, ...args)
    }
  }

  // Broadcast to all windows
  broadcast(channel: string, ...args: unknown[]): void {
    for (const [, win] of this.windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, ...args)
      }
    }
  }

  // Close all windows
  closeAll(): void {
    for (const [, win] of this.windows) {
      if (!win.isDestroyed()) win.close()
    }
    this.windows.clear()
  }
}

// Export as singleton
export const windowManager = new WindowManager()
```

---

## 2. Custom Title Bar

### 2.1 Frameless Window Configuration

```
Default title bar:
+------------------------------------------------------+
| [icon] My App              [_] [□] [X]  ← OS native  |
+------------------------------------------------------+
| Content                                               |
+------------------------------------------------------+

Custom title bar:
+------------------------------------------------------+
| 🔍 Search...  |  File  Edit  View  | ● ● ●  ← Custom UI |
+------------------------------------------------------+
| Content                                               |
+------------------------------------------------------+
```

### Code Example 2: Implementing a Custom Title Bar

```typescript
// Main process: creating a frameless window
const win = new BrowserWindow({
  frame: false,            // Hide the OS default title bar
  titleBarStyle: 'hidden', // macOS: keep native traffic light buttons
  titleBarOverlay: {       // Windows: keep minimize/maximize/close buttons
    color: '#1e1e2e',      // Title bar background color
    symbolColor: '#cdd6f4', // Button icon color
    height: 40,            // Title bar height
  },
  // Adjust content area on Windows
  ...(process.platform === 'win32' && {
    backgroundMaterial: 'mica',
  }),
})
```

```tsx
// src/renderer/src/components/TitleBar.tsx — Custom title bar
import { useState, useEffect } from 'react'
import './TitleBar.css'

export function TitleBar(): JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    // Monitor window maximized state
    window.electronAPI.onWindowStateChange((maximized: boolean) => {
      setIsMaximized(maximized)
    })
  }, [])

  return (
    <div className="titlebar">
      {/* Draggable region (for moving the window) */}
      <div className="titlebar-drag-region">
        <span className="titlebar-title">My App</span>
      </div>

      {/* Menu region (non-draggable) */}
      <div className="titlebar-menu">
        <button className="menu-item">File</button>
        <button className="menu-item">Edit</button>
        <button className="menu-item">View</button>
      </div>

      {/* Window control buttons (hidden on macOS) */}
      {window.electronAPI.platform !== 'darwin' && (
        <div className="titlebar-controls">
          <button
            className="control-btn minimize"
            onClick={() => window.electronAPI.minimizeWindow()}
          >
            ─
          </button>
          <button
            className="control-btn maximize"
            onClick={() => window.electronAPI.maximizeWindow()}
          >
            {isMaximized ? '❐' : '□'}
          </button>
          <button
            className="control-btn close"
            onClick={() => window.electronAPI.closeWindow()}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
```

```css
/* src/renderer/src/components/TitleBar.css */
.titlebar {
  display: flex;
  align-items: center;
  height: 40px;
  background: var(--bg-primary);
  user-select: none; /* Disable text selection */
}

/* Draggable region: used for moving the window */
.titlebar-drag-region {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  padding-left: 16px;
  -webkit-app-region: drag; /* Make this region draggable for the window */
}

/* Menu and buttons must not be draggable */
.titlebar-menu,
.titlebar-controls {
  -webkit-app-region: no-drag;
}

/* Hover effect for the close button */
.control-btn.close:hover {
  background: #e81123;
  color: white;
}
```

---

## 3. Native Modules

### 3.1 Types of Native Modules

| Type | Build Tool | Language | Use Case |
|---|---|---|---|
| N-API (node-addon-api) | node-gyp / cmake-js | C / C++ | High-speed computation, OS API |
| Rust (napi-rs) | napi-rs | Rust | Safe high-performance processing |
| WASM | wasm-pack | Rust / C++ | Portable computation |
| FFI (ffi-napi) | None (dynamic loading) | C-compatible DLL | Calling existing DLLs |

### Code Example 3: Rust Native Module with napi-rs

```toml
# native-module/Cargo.toml — Rust project configuration
[package]
name = "my-native"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
napi = { version = "2", features = ["async"] }
napi-derive = "2"

[build-dependencies]
napi-build = "2"
```

```rust
// native-module/src/lib.rs — Fast image processing implemented in Rust
use napi::bindgen_prelude::*;
use napi_derive::napi;

/// A function that quickly resizes images
/// Callable directly from JavaScript
#[napi]
pub fn resize_image(
    input_path: String,
    output_path: String,
    width: u32,
    height: u32,
) -> Result<()> {
    let img = image::open(&input_path)
        .map_err(|e| Error::from_reason(format!("Cannot open image: {}", e)))?;

    let resized = img.resize_exact(
        width,
        height,
        image::imageops::FilterType::Lanczos3,
    );

    resized.save(&output_path)
        .map_err(|e| Error::from_reason(format!("Failed to save: {}", e)))?;

    Ok(())
}

/// Async functions can also be defined
#[napi]
pub async fn hash_file(path: String) -> Result<String> {
    use sha2::{Sha256, Digest};
    use tokio::fs;

    let data = fs::read(&path).await
        .map_err(|e| Error::from_reason(format!("File read error: {}", e)))?;

    let mut hasher = Sha256::new();
    hasher.update(&data);
    let result = hasher.finalize();

    Ok(format!("{:x}", result))
}
```

```typescript
// Using the Rust native module from TypeScript
import { resizeImage, hashFile } from 'my-native'

// Synchronous call (CPU-bound processing)
resizeImage('/path/to/input.jpg', '/path/to/output.jpg', 800, 600)

// Asynchronous call (I/O-bound processing)
const hash = await hashFile('/path/to/large-file.bin')
console.log(`File hash: ${hash}`)
```

---

## 4. SQLite Integration

### 4.1 SQLite Library Comparison

| Library | Type | Sync/Async | Electron Support |
|---|---|---|---|
| better-sqlite3 | Native (C) | Synchronous | Requires electron-rebuild |
| sql.js | WASM | Synchronous | Works out of the box |
| drizzle-orm + better-sqlite3 | ORM | Synchronous | Type-safe |
| prisma | ORM | Asynchronous | Complex configuration |

### Code Example 4: better-sqlite3 + drizzle-orm

```typescript
// src/main/database/schema.ts — Schema definition with drizzle-orm
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// Task table definition
export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  priority: text('priority', { enum: ['low', 'medium', 'high'] })
    .notNull()
    .default('medium'),
  completed: integer('completed', { mode: 'boolean' })
    .notNull()
    .default(false),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

// Automatically derive TypeScript types for tasks
export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
```

```typescript
// src/main/database/index.ts — Database connection and initialization
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { app } from 'electron'
import { join } from 'path'
import * as schema from './schema'

// Database file path (saved in the user data directory)
const DB_PATH = join(app.getPath('userData'), 'app-data.db')

// Create SQLite connection
const sqlite = new Database(DB_PATH)

// Enable WAL mode (improves concurrent read/write performance)
sqlite.pragma('journal_mode = WAL')

// Enable foreign key constraints
sqlite.pragma('foreign_keys = ON')

// Create drizzle ORM instance
export const db = drizzle(sqlite, { schema })

// Run migrations
export function runMigrations(): void {
  migrate(db, {
    migrationsFolder: join(__dirname, '../../drizzle'),
  })
}
```

```typescript
// src/main/database/task-repository.ts — Repository pattern implementation
import { eq, desc, and, like } from 'drizzle-orm'
import { db } from './index'
import { tasks, Task, NewTask } from './schema'

export class TaskRepository {
  // Get all tasks (newest first)
  findAll(): Task[] {
    return db.select().from(tasks).orderBy(desc(tasks.createdAt)).all()
  }

  // Get task by ID
  findById(id: number): Task | undefined {
    return db.select().from(tasks).where(eq(tasks.id, id)).get()
  }

  // Search tasks
  search(query: string): Task[] {
    return db.select().from(tasks)
      .where(like(tasks.title, `%${query}%`))
      .all()
  }

  // Create a task
  create(task: NewTask): Task {
    return db.insert(tasks).values(task).returning().get()
  }

  // Update a task
  update(id: number, data: Partial<NewTask>): Task | undefined {
    return db.update(tasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning()
      .get()
  }

  // Delete a task
  delete(id: number): void {
    db.delete(tasks).where(eq(tasks.id, id)).run()
  }

  // Bulk delete completed tasks
  deleteCompleted(): number {
    const result = db.delete(tasks)
      .where(eq(tasks.completed, true))
      .run()
    return result.changes
  }
}
```

---

## 5. Performance Optimization

### 5.1 Startup Time Optimization

```
Typical Electron app startup flow:

  Time axis (ms)
  0     200    400    600    800   1000   1200   1400
  |------|------|------|------|------|------|------|
  [== Electron initialization ==]
         [=== Main process startup ===]
                [== Preload execution ==]
                      [======= Renderer loading =======]
                                    [=== React init ===]
                                                  [Ready!]

  After optimization:
  0     200    400    600    800
  |------|------|------|------|
  [= Init =]
        [= Main =]
             [Preload]
               [=== Renderer ===]
                       [React]
                            [Ready!]
```

### Code Example 5: Collection of Startup Time Optimization Techniques

```typescript
// src/main/index.ts — Startup time optimization

// Optimization 1: Lazy import of required modules
// NG: import { autoUpdater } from 'electron-updater'
// OK: Import when actually needed
async function checkForUpdates(): Promise<void> {
  const { autoUpdater } = await import('electron-updater')
  autoUpdater.checkForUpdates()
}

// Optimization 2: Pre-warm the window
let splashWindow: BrowserWindow | null = null

function createSplashScreen(): void {
  // Immediately display a lightweight splash screen
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    webPreferences: { contextIsolation: true },
  })
  splashWindow.loadFile(join(__dirname, '../renderer/splash.html'))
  splashWindow.show()
}

async function createMainWindow(): Promise<void> {
  const mainWindow = new BrowserWindow({
    show: false, // Prepare the main window in the background
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
    },
  })

  // Optimization 3: Enable V8 code cache
  mainWindow.webContents.session.setCodeCachePath(
    join(app.getPath('userData'), 'code-cache')
  )

  // Start loading the Renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Close splash after the main window is ready
  mainWindow.show()
  splashWindow?.close()
  splashWindow = null
}

// Optimization 4: Run app initialization in parallel
app.whenReady().then(async () => {
  // Display splash screen immediately
  createSplashScreen()

  // Run initialization in parallel
  await Promise.all([
    createMainWindow(),
    runMigrations(),        // DB migrations
    loadUserPreferences(),  // Load user settings
  ])
})
```

### 5.2 Memory Optimization

```typescript
// Monitor and optimize memory usage

// Throttle background windows
mainWindow.on('blur', () => {
  // Lower the frame rate when the window is inactive
  mainWindow.webContents.setFrameRate(5)
})

mainWindow.on('focus', () => {
  // Restore normal frame rate when active
  mainWindow.webContents.setFrameRate(60)
})

// Periodic garbage collection (after processing large amounts of data)
function triggerGC(): void {
  if (global.gc) {
    global.gc()
  }
}

// Log memory usage
function logMemoryUsage(): void {
  const usage = process.memoryUsage()
  console.log({
    rss: `${(usage.rss / 1024 / 1024).toFixed(1)} MB`,
    heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(1)} MB`,
    heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(1)} MB`,
  })
}
```

---

## 6. Auto Updater

### 6.1 Automatic Updates with electron-updater

```typescript
// src/main/updater.ts — Auto update management
import { autoUpdater, UpdateCheckResult, UpdateInfo } from 'electron-updater'
import { BrowserWindow, dialog, app } from 'electron'
import { logger } from './logger'

interface UpdateState {
  checking: boolean
  available: boolean
  downloaded: boolean
  progress: number
  version: string | null
  error: Error | null
}

class AppUpdater {
  private state: UpdateState = {
    checking: false,
    available: false,
    downloaded: false,
    progress: 0,
    version: null,
    error: null,
  }

  private mainWindow: BrowserWindow | null = null

  constructor() {
    // Configure logging
    autoUpdater.logger = logger

    // Enable testing in development environment
    autoUpdater.forceDevUpdateConfig = false

    // Disable auto-download (download after user confirmation)
    autoUpdater.autoDownload = false

    // Whether to include pre-releases
    autoUpdater.allowPrerelease = false

    // Register event handlers
    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    autoUpdater.on('checking-for-update', () => {
      this.state.checking = true
      this.notifyRenderer('update:checking')
      logger.info('Checking for updates...')
    })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.state.checking = false
      this.state.available = true
      this.state.version = info.version
      this.notifyRenderer('update:available', info)
      logger.info(`Update available: v${info.version}`)

      // Show confirmation dialog to user
      this.promptUpdate(info)
    })

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      this.state.checking = false
      this.state.available = false
      this.notifyRenderer('update:not-available', info)
      logger.info('Already on the latest version')
    })

    autoUpdater.on('download-progress', (progress) => {
      this.state.progress = progress.percent
      this.notifyRenderer('update:progress', {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        total: progress.total,
        transferred: progress.transferred,
      })

      // Show taskbar progress (Windows)
      this.mainWindow?.setProgressBar(progress.percent / 100)
    })

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.state.downloaded = true
      this.state.progress = 100
      this.notifyRenderer('update:downloaded', info)
      this.mainWindow?.setProgressBar(-1) // Reset progress bar

      logger.info(`Update download complete: v${info.version}`)

      // Confirm restart
      this.promptRestart(info)
    })

    autoUpdater.on('error', (error: Error) => {
      this.state.checking = false
      this.state.error = error
      this.notifyRenderer('update:error', error.message)
      this.mainWindow?.setProgressBar(-1)
      logger.error('Update error', error)
    })
  }

  private async promptUpdate(info: UpdateInfo): Promise<void> {
    if (!this.mainWindow) return

    const result = await dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version v${info.version} is available.`,
      detail: `Current version: v${app.getVersion()}\n\nWould you like to download it?`,
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1,
    })

    if (result.response === 0) {
      autoUpdater.downloadUpdate()
    }
  }

  private async promptRestart(info: UpdateInfo): Promise<void> {
    if (!this.mainWindow) return

    const result = await dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `v${info.version} is ready to install.`,
      detail: 'Would you like to restart now to apply the update?',
      buttons: ['Restart Now', 'Restart Later'],
      defaultId: 0,
      cancelId: 1,
    })

    if (result.response === 0) {
      autoUpdater.quitAndInstall(false, true)
    }
  }

  private notifyRenderer(channel: string, data?: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }

  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win
  }

  async checkForUpdates(): Promise<UpdateCheckResult | null> {
    return autoUpdater.checkForUpdates()
  }

  getState(): UpdateState {
    return { ...this.state }
  }
}

export const appUpdater = new AppUpdater()
```

### 6.2 Update Distribution Server Configuration

```typescript
// Example update server configuration in electron-builder.yml

// Pattern 1: Using GitHub Releases (simplest)
// build section in package.json
const githubConfig = {
  publish: {
    provider: 'github',
    owner: 'your-org',
    repo: 'your-app',
    releaseType: 'release', // 'draft' | 'prerelease' | 'release'
  },
}

// Pattern 2: S3-compatible storage
const s3Config = {
  publish: {
    provider: 's3',
    bucket: 'your-update-bucket',
    region: 'ap-northeast-1',
    path: '/releases/',
  },
}

// Pattern 3: Generic server (for internal distribution)
const genericConfig = {
  publish: {
    provider: 'generic',
    url: 'https://updates.example.com/releases/',
    channel: 'latest',
  },
}
```

---

## 7. System Tray and Background Operation

### 7.1 Implementing a Tray Icon

```typescript
// src/main/tray.ts — System tray management
import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron'
import { join } from 'path'
import { windowManager } from './window-manager'

class TrayManager {
  private tray: Tray | null = null
  private isQuitting = false

  create(mainWindow: BrowserWindow): void {
    // Platform-specific icons
    const iconPath = process.platform === 'win32'
      ? join(__dirname, '../../resources/tray-icon.ico')    // Windows: ICO
      : process.platform === 'darwin'
      ? join(__dirname, '../../resources/tray-iconTemplate.png') // macOS: Template
      : join(__dirname, '../../resources/tray-icon.png')    // Linux: PNG

    const icon = nativeImage.createFromPath(iconPath)

    // macOS template image configuration
    if (process.platform === 'darwin') {
      icon.setTemplateImage(true)
    }

    this.tray = new Tray(icon)

    // Tooltip
    this.tray.setToolTip(`${app.getName()} v${app.getVersion()}`)

    // Build context menu
    this.updateContextMenu(mainWindow)

    // Show window on double-click (Windows/Linux)
    this.tray.on('double-click', () => {
      if (mainWindow.isVisible()) {
        mainWindow.focus()
      } else {
        mainWindow.show()
      }
    })

    // Minimize to tray on close button (minimize, not quit)
    mainWindow.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault()
        mainWindow.hide()

        // Show balloon notification on Windows
        if (process.platform === 'win32' && this.tray) {
          this.tray.displayBalloon({
            title: app.getName(),
            content: 'App is running in the system tray',
            iconType: 'info',
          })
        }
      }
    })

    // Actually quit when app.quit() is called
    app.on('before-quit', () => {
      this.isQuitting = true
    })
  }

  private updateContextMenu(mainWindow: BrowserWindow): void {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Window',
        click: () => {
          mainWindow.show()
          mainWindow.focus()
        },
      },
      { type: 'separator' },
      {
        label: 'Status',
        submenu: [
          { label: 'Online', type: 'radio', checked: true },
          { label: 'Busy', type: 'radio' },
          { label: 'Offline', type: 'radio' },
        ],
      },
      { type: 'separator' },
      {
        label: 'Settings',
        click: () => {
          windowManager.createWindow('settings', {
            route: '/settings',
            width: 600,
            height: 500,
            parent: mainWindow,
            modal: true,
          })
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          this.isQuitting = true
          app.quit()
        },
      },
    ])

    this.tray?.setContextMenu(contextMenu)
  }

  // Update badge count (e.g., notification count)
  updateBadge(count: number): void {
    if (process.platform === 'darwin') {
      app.dock.setBadge(count > 0 ? String(count) : '')
    }

    // Windows: taskbar overlay icon
    if (process.platform === 'win32') {
      const mainWindow = windowManager.getWindow('main')
      if (mainWindow && count > 0) {
        const badge = this.createBadgeImage(count)
        mainWindow.setOverlayIcon(badge, `${count} notifications`)
      } else if (mainWindow) {
        mainWindow.setOverlayIcon(null, '')
      }
    }
  }

  private createBadgeImage(count: number): Electron.NativeImage {
    // Generate badge image using Canvas (16x16 px)
    const size = 16
    const canvas = new OffscreenCanvas(size, size)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#e81123'
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 10px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(count > 99 ? '99+' : String(count), size / 2, size / 2)

    const buffer = Buffer.from(canvas.transferToImageBitmap() as unknown as ArrayBuffer)
    return nativeImage.createFromBuffer(buffer, { width: size, height: size })
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}

export const trayManager = new TrayManager()
```

---

## 8. File Associations and Protocol Handlers

### 8.1 Custom File Extension Associations

```typescript
// Define file associations in electron-builder configuration
// build section in package.json
const fileAssociations = {
  build: {
    fileAssociations: [
      {
        ext: 'myapp',             // Extension
        name: 'My App Document',  // Display name for the file type
        description: 'My App document file',
        mimeType: 'application/x-myapp',
        icon: 'resources/file-icon', // .ico / .icns
        role: 'Editor',           // macOS: Editor | Viewer | Shell | None
      },
      {
        ext: ['json', 'yaml', 'yml'],
        name: 'Configuration File',
        role: 'Viewer',
      },
    ],
  },
}
```

```typescript
// src/main/file-handler.ts — File open handling
import { app, ipcMain } from 'electron'
import { windowManager } from './window-manager'
import fs from 'fs'

// macOS: When a file is dropped or double-clicked to open
app.on('open-file', (event, filePath) => {
  event.preventDefault()

  if (app.isReady()) {
    handleFileOpen(filePath)
  } else {
    // Queue the file if it was passed before the app started
    pendingFiles.push(filePath)
  }
})

// Windows/Linux: Get file path from command-line arguments
const pendingFiles: string[] = []

function processCommandLineArgs(argv: string[]): void {
  // Skip the first argument (app path)
  const filePaths = argv.slice(1).filter(arg => {
    return !arg.startsWith('--') && fs.existsSync(arg)
  })

  for (const filePath of filePaths) {
    handleFileOpen(filePath)
  }
}

// Prevent duplicate instances + pass file to existing instance
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    // Focus the existing instance and open the file
    const mainWindow = windowManager.getWindow('main')
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      processCommandLineArgs(argv)
    }
  })
}

async function handleFileOpen(filePath: string): Promise<void> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8')
    const mainWindow = windowManager.getWindow('main')

    if (mainWindow) {
      mainWindow.webContents.send('file:opened', {
        path: filePath,
        name: path.basename(filePath),
        content,
      })
    }
  } catch (error) {
    logger.error(`Cannot open file: ${filePath}`, error as Error)
  }
}
```

### 8.2 Custom Protocol Handler

```typescript
// src/main/protocol.ts — Register custom protocol (myapp://)
import { app, protocol, net } from 'electron'
import { join } from 'path'
import { URL } from 'url'

// Register custom protocol (must be called before app.whenReady())
if (process.defaultApp) {
  // Development: register protocol with command-line argument
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('myapp', process.execPath, [
      join(__dirname, '..'),
    ])
  }
} else {
  // Production: register directly
  app.setAsDefaultProtocolClient('myapp')
}

// Handle protocol requests
app.whenReady().then(() => {
  // Handle myapp:// scheme
  protocol.handle('myapp', (request) => {
    const url = new URL(request.url)

    switch (url.hostname) {
      case 'open':
        // myapp://open?file=path/to/file
        const filePath = url.searchParams.get('file')
        if (filePath) handleFileOpen(filePath)
        return new Response('OK')

      case 'settings':
        // myapp://settings
        windowManager.createWindow('settings', { route: '/settings' })
        return new Response('OK')

      default:
        return new Response('Not Found', { status: 404 })
    }
  })
})

// macOS: When the app is launched with a protocol URL
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleProtocolUrl(url)
})

// Windows/Linux: Receive protocol URL on second instance
app.on('second-instance', (_event, argv) => {
  const url = argv.find(arg => arg.startsWith('myapp://'))
  if (url) handleProtocolUrl(url)
})

function handleProtocolUrl(url: string): void {
  try {
    const parsed = new URL(url)
    logger.info(`Processing protocol URL: ${parsed.hostname}${parsed.pathname}`)
    // Execute processing based on the URL
  } catch (error) {
    logger.error('Invalid protocol URL', error as Error)
  }
}
```

---

## 9. Drag & Drop and Clipboard

### 9.1 Implementing Drag & Drop

```tsx
// src/renderer/src/components/DropZone.tsx — File drop area
import { useState, useCallback, DragEvent } from 'react'

interface DroppedFile {
  name: string
  path: string
  size: number
  type: string
}

export function DropZone(): JSX.Element {
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<DroppedFile[]>([])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFiles: DroppedFile[] = []

    for (const file of Array.from(e.dataTransfer.files)) {
      droppedFiles.push({
        name: file.name,
        path: (file as File & { path: string }).path, // Electron extension
        size: file.size,
        type: file.type || 'application/octet-stream',
      })
    }

    setFiles(prev => [...prev, ...droppedFiles])

    // Send file paths to Main process for processing
    for (const file of droppedFiles) {
      await window.electronAPI.processDroppedFile(file.path)
    }
  }, [])

  return (
    <div
      className={`drop-zone ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging ? (
        <p>Drop files here</p>
      ) : (
        <p>Drag & drop files here</p>
      )}
      {files.length > 0 && (
        <ul className="file-list">
          {files.map((file, i) => (
            <li key={i}>
              <span>{file.name}</span>
              <span>{(file.size / 1024).toFixed(1)} KB</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

```css
/* Drop zone styles */
.drop-zone {
  border: 2px dashed var(--border-color, #ccc);
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  transition: all 0.2s ease;
  cursor: pointer;
}

.drop-zone.dragging {
  border-color: var(--accent-color, #0078d4);
  background: rgba(0, 120, 212, 0.05);
}
```

### 9.2 Drag-Out from App (File Export)

```typescript
// Main process: Handle drag-out
ipcMain.on('drag-out', (event, filePath: string) => {
  // Drag a file from the app to the desktop or file explorer
  event.sender.startDrag({
    file: filePath,
    icon: nativeImage.createFromPath(
      join(__dirname, '../../resources/file-drag-icon.png')
    ),
  })
})
```

```tsx
// Renderer side: Handle drag start
function FileItem({ file }: { file: { name: string; path: string } }) {
  const handleDragStart = (e: React.DragEvent) => {
    e.preventDefault()
    // Notify Main process of drag start
    window.electronAPI.startDrag(file.path)
  }

  return (
    <div draggable onDragStart={handleDragStart}>
      {file.name}
    </div>
  )
}
```

### 9.3 Clipboard Operations

```typescript
// src/main/clipboard-handler.ts — Advanced clipboard operations
import { clipboard, nativeImage, ipcMain } from 'electron'

// Read/write text
ipcMain.handle('clipboard:readText', () => {
  return clipboard.readText()
})

ipcMain.handle('clipboard:writeText', (_event, text: string) => {
  clipboard.writeText(text)
})

// Read/write rich text (HTML)
ipcMain.handle('clipboard:readHTML', () => {
  return clipboard.readHTML()
})

ipcMain.handle('clipboard:writeHTML', (_event, html: string) => {
  clipboard.writeText(html.replace(/<[^>]*>/g, '')) // Also set plain text simultaneously
  clipboard.writeHTML(html)
})

// Read/write images
ipcMain.handle('clipboard:readImage', () => {
  const image = clipboard.readImage()
  if (image.isEmpty()) return null
  return image.toDataURL()
})

ipcMain.handle('clipboard:writeImage', (_event, dataUrl: string) => {
  const image = nativeImage.createFromDataURL(dataUrl)
  clipboard.writeImage(image)
})

// Monitor clipboard changes
let previousContent = ''
const CLIPBOARD_POLL_INTERVAL = 1000

function startClipboardWatcher(callback: (content: string) => void): NodeJS.Timer {
  return setInterval(() => {
    const current = clipboard.readText()
    if (current !== previousContent && current.length > 0) {
      previousContent = current
      callback(current)
    }
  }, CLIPBOARD_POLL_INTERVAL)
}
```

---

## 10. Notifications and System Integration

### 10.1 Native Notifications

```typescript
// src/main/notifications.ts — Notification management
import { Notification, app, shell } from 'electron'

interface AppNotification {
  title: string
  body: string
  icon?: string
  urgency?: 'normal' | 'critical' | 'low'
  actions?: Array<{ type: 'button'; text: string }>
  silent?: boolean
  onClick?: () => void
}

class NotificationManager {
  private enabled = true

  async show(options: AppNotification): Promise<void> {
    if (!this.enabled) return

    // Check if notifications are supported
    if (!Notification.isSupported()) {
      logger.warn('Notifications are not supported')
      return
    }

    const notification = new Notification({
      title: options.title,
      body: options.body,
      icon: options.icon || join(__dirname, '../../resources/notification-icon.png'),
      urgency: options.urgency || 'normal',
      silent: options.silent || false,
      actions: options.actions,
    })

    if (options.onClick) {
      notification.on('click', options.onClick)
    }

    // Handle action button clicks
    notification.on('action', (_event, index) => {
      logger.info(`Notification action: index ${index}`)
    })

    notification.show()
  }

  // Toggle notifications on/off
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  // Windows: Check Focus Assist status
  isDoNotDisturbEnabled(): boolean {
    // Checking Windows 10+ Focus Assist / Do Not Disturb status
    // requires a native module (e.g., electron-windows-notifications)
    return false
  }
}

export const notificationManager = new NotificationManager()
```

### 10.2 Power State Monitoring

```typescript
// src/main/power-monitor.ts — Power management
import { powerMonitor, powerSaveBlocker, app } from 'electron'

class PowerManager {
  private saveBlockerId: number | null = null

  setup(): void {
    // Detect sleep/resume
    powerMonitor.on('suspend', () => {
      logger.info('System is going to sleep')
      // Auto-save unsaved data
      this.autoSave()
    })

    powerMonitor.on('resume', () => {
      logger.info('System resumed from sleep')
      // Re-establish network connection
      this.reconnect()
    })

    // Detect lock/unlock
    powerMonitor.on('lock-screen', () => {
      logger.info('Screen is locked')
    })

    powerMonitor.on('unlock-screen', () => {
      logger.info('Screen is unlocked')
    })

    // AC/battery switching
    powerMonitor.on('on-ac', () => {
      logger.info('Connected to AC power')
    })

    powerMonitor.on('on-battery', () => {
      logger.info('Switched to battery power')
      // Limit background processing on battery
    })

    // Shutdown detection
    powerMonitor.on('shutdown', () => {
      logger.info('System is shutting down')
      this.emergencySave()
    })
  }

  // Prevent sleep (used during long-running operations)
  preventSleep(reason: string): void {
    if (this.saveBlockerId !== null) return

    this.saveBlockerId = powerSaveBlocker.start('prevent-display-sleep')
    logger.info(`Sleep prevention started: ${reason}`)
  }

  allowSleep(): void {
    if (this.saveBlockerId !== null) {
      powerSaveBlocker.stop(this.saveBlockerId)
      this.saveBlockerId = null
      logger.info('Sleep prevention released')
    }
  }

  // Get battery info (available in Electron 30+)
  getBatteryInfo(): { level: number; charging: boolean } {
    return {
      level: powerMonitor.isOnBatteryPower() ? -1 : 100,
      charging: !powerMonitor.isOnBatteryPower(),
    }
  }

  private autoSave(): void {
    // Implement save logic
  }

  private reconnect(): void {
    // Implement reconnection logic
  }

  private emergencySave(): void {
    // Implement emergency save logic
  }
}

export const powerManager = new PowerManager()
```

---

## 11. Anti-Patterns

### Anti-Pattern 1: Running Heavy Processing Synchronously in the Main Process

```typescript
// NG: Synchronously processing a large number of files in the Main process
// → The UI freezes and the window becomes unresponsive
ipcMain.handle('process-files', (_event, paths: string[]) => {
  const results = []
  for (const path of paths) {
    // Synchronously read and process large numbers of files
    const data = fs.readFileSync(path)
    const processed = heavyComputation(data)
    results.push(processed)
  }
  return results
})
```

```typescript
// OK: Delegate to a Worker thread or UtilityProcess
import { utilityProcess } from 'electron'

ipcMain.handle('process-files', async (_event, paths: string[]) => {
  // Run heavy processing in a separate process with UtilityProcess
  const worker = utilityProcess.fork(
    join(__dirname, 'workers/file-processor.js')
  )

  return new Promise((resolve) => {
    worker.postMessage({ type: 'process', paths })
    worker.on('message', (result) => {
      resolve(result)
      worker.kill()
    })
  })
})
```

### Anti-Pattern 2: Creating BrowserWindows Without Limit

```typescript
// NG: Creating a new window on every user action
ipcMain.handle('open-detail', (_event, itemId: string) => {
  // Opening 100 items creates 100 windows → memory exhaustion
  const win = new BrowserWindow({ width: 600, height: 400 })
  win.loadURL(`app://detail/${itemId}`)
})
```

```typescript
// OK: Manage upper limit with a window pool
const MAX_WINDOWS = 10

ipcMain.handle('open-detail', (_event, itemId: string) => {
  const existing = windowManager.getWindow(`detail-${itemId}`)
  if (existing) {
    existing.focus()
    return
  }

  // Check window count limit
  if (windowManager.count() >= MAX_WINDOWS) {
    dialog.showMessageBox({
      type: 'warning',
      message: `You can open up to ${MAX_WINDOWS} windows`,
    })
    return
  }

  windowManager.createWindow(`detail-${itemId}`, {
    route: `/detail/${itemId}`,
    width: 600,
    height: 400,
  })
})
```

### Anti-Pattern 3: Accessing the File System Directly from the Renderer Process

```typescript
// NG: Using fs directly in the Renderer (with nodeIntegration: true)
// Very high security risk
import fs from 'fs'
const data = fs.readFileSync('/etc/passwd', 'utf-8') // Can read anything
```

```typescript
// OK: Delegate to the Main process via IPC with path validation
// Renderer side
const data = await window.electronAPI.readFile('data/config.json')

// Main side (with path validation)
ipcMain.handle('fs:readFile', (_event, relativePath: string) => {
  const safePath = join(app.getPath('userData'), relativePath)
  // Prevent path traversal attacks
  if (!safePath.startsWith(app.getPath('userData'))) {
    throw new Error('Invalid path')
  }
  return fs.readFileSync(safePath, 'utf-8')
})
```

---

## 12. FAQ

### Q1: When I upgrade the Electron version, better-sqlite3 stops working. What should I do?

**A:** Native modules need to be rebuilt to match the Electron version's Node.js version. The `electron-rebuild` package handles this automatically. Adding `"postinstall": "electron-rebuild"` to the `scripts` section of `package.json` is the standard approach. Alternatively, switching to `sql.js` (WASM-based) eliminates the need for rebuilds.

### Q2: What is the best way to share data between multiple windows?

**A:** The safest and most manageable approach is to use the Main process as a data hub and distribute data via IPC. It is recommended to place shared stores (SQLite or electron-store) in the Main process and have each window request data via IPC. By broadcasting change notifications with `BrowserWindow.webContents.send()`, all windows can synchronize in real time.

### Q3: How do I reduce the binary size of an Electron app?

**A:** Combine the following techniques: (1) Enable `asar` packing in `electron-builder`, (2) Properly separate `devDependencies` to exclude them from production builds, (3) Exclude unused `node_modules` using the `files` configuration, (4) Apply UPX compression (Windows/Linux). It is typically possible to reduce from 150-200MB to around 80-100MB.

---

### Q4: When should I use UtilityProcess vs Worker Threads?

**A:** `UtilityProcess` is an Electron-specific API that runs as a completely independent process. All Node.js APIs are available, and a crash does not affect the main process. `Worker Threads`, on the other hand, is Node.js's standard threading feature that can share memory with the main process (SharedArrayBuffer). `UtilityProcess` is suitable for CPU-bound heavy computation, while `Worker Threads` is appropriate for relatively lighter asynchronous tasks.

### Q5: What is the recommended database backup strategy for Electron apps?

**A:** For SQLite, the following strategy is recommended: (1) Use the `VACUUM INTO` command to periodically create backup files, (2) Enable WAL mode to allow safe copying even during writes, (3) Create a backup directory inside `app.getPath('userData')` with version management (e.g., keep the latest 5), (4) Include a timestamp in filenames (e.g., `backup-2024-01-15T10-30-00.db`), (5) Run automatic backups at app startup.

### Q6: Does implementing a custom title bar affect accessibility?

**A:** On Windows, using the `titleBarOverlay` option retains the native window control buttons (minimize, maximize, close), so the accessibility impact is minimal. However, keyboard navigation (Tab/Enter/Escape) must be properly implemented for the custom menu area. On macOS, it is recommended to keep the native traffic light buttons (red, yellow, green) using `titleBarStyle: 'hidden'`. A fully frameless window (`frame: false`) is not recommended.

---


## FAQ

### Q1: What is the most important point to keep in mind when learning this topic?

Gaining hands-on experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how it works.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping straight to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next steps.

### Q3: How is this used in professional practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architectural design.

---

## 13. Summary

| Topic | Key Points |
|---|---|
| Multi-window | Centralize management with WindowManager. Set an upper limit on window count |
| Custom title bar | `titleBarOverlay` (Windows) + `-webkit-app-region: drag` |
| Native modules | napi-rs (Rust) offers an excellent balance of safety and performance |
| SQLite | Type-safe DB operations with better-sqlite3 + drizzle-orm |
| Startup time | Splash screen + lazy imports + parallel initialization |
| Memory optimization | Background throttling + UtilityProcess |
| Auto updater | Dialog confirmation with electron-updater + delta downloads |
| System tray | Background residence with TrayManager + badge notifications |
| File associations | electron-builder config + protocol.handle for custom schemes |
| Drag & drop | Drop reception in Renderer + startDrag in Main for export |
| Security | All file operations via Main process + path validation |

---

## What to Read Next

- **[02-tauri-setup.md](./02-tauri-setup.md)** — Introduction to Tauri, a lightweight alternative framework
- **[00-packaging-and-signing.md](../03-distribution/00-packaging-and-signing.md)** — Packaging and signing Electron apps

---

## References

1. Electron, "Performance", https://www.electronjs.org/docs/latest/tutorial/performance
2. Electron, "UtilityProcess", https://www.electronjs.org/docs/latest/api/utility-process
3. napi-rs, "Getting Started", https://napi.rs/docs/introduction/getting-started
4. better-sqlite3, "API Documentation", https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md

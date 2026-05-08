# Electron Setup

> Set up an Electron desktop application development environment using Vite + React + TypeScript, and complete hot reload and DevTools integration.

---

## What You Will Learn in This Chapter

1. Understand the **Electron architecture** (Main / Renderer / Preload) and correctly structure your project
2. Build a modern development environment from scratch using **Vite + React + TypeScript**
3. Establish an efficient development workflow leveraging **hot reload and DevTools**


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Electron Architecture

### 1.1 Process Model

```
+----------------------------------------------------------+
|                    Electron App                           |
+----------------------------------------------------------+
|                                                          |
|  +------------------------+                              |
|  |    Main Process        |  ← Node.js Runtime           |
|  |    (main.ts)           |                              |
|  |                        |                              |
|  |  - BrowserWindow Mgmt  |                              |
|  |  - System APIs         |                              |
|  |  - Menu/Tray           |                              |
|  |  - IPC Handlers        |                              |
|  +--------+---+-----------+                              |
|           |   |                                          |
|     IPC   |   |  IPC                                     |
|           |   |                                          |
|  +--------v---+--------+   +-------------------------+   |
|  |  Renderer Process   |   |  Renderer Process       |   |
|  |  (Window 1)         |   |  (Window 2)             |   |
|  |                     |   |                         |   |
|  |  +---------------+  |   |  +------------------+   |   |
|  |  | Preload       |  |   |  | Preload          |   |   |
|  |  | (preload.ts)  |  |   |  | (preload.ts)     |   |   |
|  |  +-------+-------+  |   |  +--------+---------+   |   |
|  |          |           |   |           |             |   |
|  |  +-------v-------+  |   |  +--------v---------+   |   |
|  |  | Web Page      |  |   |  | Web Page          |   |   |
|  |  | (React App)   |  |   |  | (React App)      |   |   |
|  |  +---------------+  |   |  +------------------+   |   |
|  +---------------------+   +-------------------------+   |
+----------------------------------------------------------+
```

### 1.2 Role of Each Process

| Process | Runtime | Role | Security |
|---|---|---|---|
| Main | Node.js | Window management, OS APIs, file operations | Full access |
| Preload | Node.js (restricted) | Bridge between Main and Renderer | Controlled via contextBridge |
| Renderer | Chromium | UI rendering (React/Vue, etc.) | Sandboxed (equivalent to web) |

---

## 2. Creating a Project

### 2.1 Building with electron-vite (Recommended)

### Code Example 1: Project Initialization

```bash
# Scaffold with electron-vite (React + TypeScript template)
npm create @quick-start/electron@latest my-electron-app -- \
  --template react-ts

# Move to directory and install dependencies
cd my-electron-app
npm install

# Start dev server (hot reload enabled)
npm run dev
```

### 2.2 Directory Structure

```
my-electron-app/
├── package.json
├── electron.vite.config.ts       ← Vite config (shared for Main/Preload/Renderer)
├── tsconfig.json                 ← TypeScript config (root)
├── tsconfig.node.json            ← TypeScript config (for Main/Preload)
├── tsconfig.web.json             ← TypeScript config (for Renderer)
│
├── src/
│   ├── main/                     ← Main process
│   │   ├── index.ts              ← Entry point
│   │   └── ipc-handlers.ts       ← IPC handler definitions
│   │
│   ├── preload/                  ← Preload scripts
│   │   ├── index.ts              ← contextBridge definitions
│   │   └── index.d.ts            ← Type definitions
│   │
│   └── renderer/                 ← Renderer process (React app)
│       ├── index.html            ← HTML entry point
│       ├── src/
│       │   ├── main.tsx          ← React entry point
│       │   ├── App.tsx           ← Root component
│       │   ├── components/       ← UI components
│       │   ├── hooks/            ← Custom hooks
│       │   └── assets/           ← Static resources
│       └── env.d.ts              ← Vite environment type definitions
│
├── resources/                    ← Icons, native resources
│   └── icon.png
├── build/                        ← Build configuration
│   └── entitlements.mac.plist
└── out/                          ← Build output
```

### Code Example 2: Main Process (index.ts)

```typescript
// src/main/index.ts — Electron Main process entry point
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

// Hold a reference to the main window at module scope
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    // macOS: native tab support
    tabbingIdentifier: 'my-app',
    show: false, // Hide until ready to prevent flickering
    webPreferences: {
      // Path to the Preload script
      preload: join(__dirname, '../preload/index.js'),
      // Enable sandbox (recommended for security)
      sandbox: true,
      // Context isolation (required: prevents Renderer from directly using Node.js)
      contextIsolation: true,
      // Disable Node.js integration (recommended for security)
      nodeIntegration: false,
    },
  })

  // Show the window once it is ready
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // In development load the Vite Dev Server, in production load the built HTML
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Create the window after Electron initialization is complete
app.whenReady().then(() => {
  // Set app user model ID (used for Windows notifications and taskbar)
  electronApp.setAppUserModelId('com.example.my-app')

  // Dev: open DevTools with F12, reload with Ctrl+R
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  // macOS: re-create window when Dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Non-macOS: quit the app when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
```

### Code Example 3: Preload Script

```typescript
// src/preload/index.ts — Define the API exposed to the Renderer
import { contextBridge, ipcRenderer } from 'electron'

// Safely expose API via contextBridge
// Accessible from the Renderer as window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform information
  platform: process.platform,

  // File operations: delegated to Main process
  openFile: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openFile'),

  saveFile: (content: string): Promise<boolean> =>
    ipcRenderer.invoke('dialog:saveFile', content),

  // Store operations
  getStoreValue: (key: string): Promise<unknown> =>
    ipcRenderer.invoke('store:get', key),

  setStoreValue: (key: string, value: unknown): Promise<void> =>
    ipcRenderer.invoke('store:set', key, value),

  // Receive events from Main → Renderer
  onUpdateAvailable: (callback: (version: string) => void): void => {
    ipcRenderer.on('update-available', (_event, version) => {
      callback(version)
    })
  },
})
```

```typescript
// src/preload/index.d.ts — Type definitions used on the Renderer side
export interface ElectronAPI {
  platform: string
  openFile: () => Promise<string | null>
  saveFile: (content: string) => Promise<boolean>
  getStoreValue: (key: string) => Promise<unknown>
  setStoreValue: (key: string, value: unknown) => Promise<void>
  onUpdateAvailable: (callback: (version: string) => void) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
```

### Code Example 4: Renderer (React App)

```tsx
// src/renderer/src/App.tsx — React root component
import { useState } from 'react'
import './assets/main.css'

function App(): JSX.Element {
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [platform] = useState(window.electronAPI.platform)

  // Handler for the open file button
  const handleOpenFile = async () => {
    // Call the API defined in Preload (type-safe)
    const content = await window.electronAPI.openFile()
    if (content) {
      setFileContent(content)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Electron + React + TypeScript</h1>
        <p>Platform: {platform}</p>
      </header>

      <main className="app-main">
        <button onClick={handleOpenFile} className="btn-primary">
          Open File
        </button>

        {fileContent && (
          <pre className="file-preview">
            {fileContent}
          </pre>
        )}
      </main>
    </div>
  )
}

export default App
```

---

## 3. Vite Configuration

### Code Example 5: electron.vite.config.ts

```typescript
// electron.vite.config.ts — Unified Vite configuration for Main/Preload/Renderer
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Main process configuration
  main: {
    plugins: [
      // Externalize Node.js modules (exclude from bundle)
      externalizeDepsPlugin()
    ],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },

  // Preload script configuration
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },

  // Renderer process configuration (standard Vite + React)
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        // Path alias configuration
        '@': resolve(__dirname, 'src/renderer/src')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html')
        }
      }
    }
  }
})
```

---

## 4. Hot Reload and DevTools

### 4.1 Development Workflow

```
When running npm run dev:

  electron-vite dev
       |
       ├─→ Start Vite Dev Server (Renderer)
       |     localhost:5173
       |     HMR WebSocket connection
       |
       ├─→ Build & launch Main process
       |     File change detected → auto restart
       |
       └─→ Build Preload
             File change detected → Renderer reload

  Change propagation speed:
  ┌──────────────┬──────────────────────┐
  │ Renderer     │ ~50ms (HMR)          │
  │ Main         │ ~1s (process restart) │
  │ Preload      │ ~500ms (reload)      │
  └──────────────┴──────────────────────┘
```

### 4.2 Using DevTools

```typescript
// Automatically open DevTools in development only
if (is.dev) {
  mainWindow.webContents.openDevTools({ mode: 'right' })
}

// Add React DevTools (development only)
// npm install --save-dev electron-devtools-installer
import installExtension, { REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer'

app.whenReady().then(async () => {
  if (is.dev) {
    try {
      // Install React DevTools extension
      await installExtension(REACT_DEVELOPER_TOOLS)
      console.log('React DevTools installed')
    } catch (err) {
      console.error('DevTools installation error:', err)
    }
  }
  createWindow()
})
```

---

## 5. IPC Communication Best Practices

### 5.1 Communication Patterns

| Pattern | API | Direction | Use Case |
|---|---|---|---|
| invoke/handle | `ipcRenderer.invoke` → `ipcMain.handle` | Renderer → Main → Response | Data retrieval, dialogs |
| send/on | `ipcRenderer.send` → `ipcMain.on` | Renderer → Main (one-way) | Log sending, event notification |
| send/on | `webContents.send` → `ipcRenderer.on` | Main → Renderer (one-way) | Update notifications, state changes |

### Defining IPC Handlers

```typescript
// src/main/ipc-handlers.ts — Centralized IPC handler definitions
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readFile, writeFile } from 'fs/promises'

export function registerIpcHandlers(): void {
  // Open file dialog → return file content
  ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Text Files', extensions: ['txt', 'md', 'json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })

    if (canceled || filePaths.length === 0) return null

    // Read and return the file content
    const content = await readFile(filePaths[0], 'utf-8')
    return content
  })

  // Save file
  ipcMain.handle('dialog:saveFile', async (_event, content: string) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: 'untitled.txt',
    })

    if (canceled || !filePath) return false

    await writeFile(filePath, content, 'utf-8')
    return true
  })
}
```

---

## 6. Settings Management with electron-store

### 6.1 Setting Up electron-store

```bash
# Install electron-store
npm install electron-store
```

```typescript
// src/main/store.ts — Persisting application settings
import Store from 'electron-store'

// Schema definition for settings (type-safe)
interface AppConfig {
  window: {
    width: number
    height: number
    x?: number
    y?: number
    isMaximized: boolean
  }
  theme: 'light' | 'dark' | 'system'
  language: string
  recentFiles: string[]
  editor: {
    fontSize: number
    fontFamily: string
    tabSize: number
    wordWrap: boolean
    lineNumbers: boolean
    minimap: boolean
    autoSave: boolean
    autoSaveInterval: number
  }
  updates: {
    autoCheck: boolean
    channel: 'stable' | 'beta'
  }
}

// Define default values
const defaults: AppConfig = {
  window: {
    width: 1200,
    height: 800,
    isMaximized: false,
  },
  theme: 'system',
  language: 'en',
  recentFiles: [],
  editor: {
    fontSize: 14,
    fontFamily: 'Consolas, "Courier New", monospace',
    tabSize: 2,
    wordWrap: true,
    lineNumbers: true,
    minimap: true,
    autoSave: true,
    autoSaveInterval: 30000,
  },
  updates: {
    autoCheck: true,
    channel: 'stable',
  },
}

// Create a type-safe store
export const store = new Store<AppConfig>({
  defaults,
  // Schema validation (optional)
  schema: {
    theme: {
      type: 'string',
      enum: ['light', 'dark', 'system'],
    },
    'editor.fontSize': {
      type: 'number',
      minimum: 8,
      maximum: 72,
    },
    'editor.tabSize': {
      type: 'number',
      enum: [2, 4, 8],
    },
  },
  // Encryption (when storing sensitive data)
  // encryptionKey: 'your-encryption-key',
  // Migrations (handle schema changes between versions)
  migrations: {
    '1.0.0': (store) => {
      // Migration to v1.0.0
      store.set('editor.minimap', true)
    },
    '2.0.0': (store) => {
      // Migration to v2.0.0
      store.set('updates', { autoCheck: true, channel: 'stable' })
    },
  },
})
```

### 6.2 Accessing Settings via IPC

```typescript
// src/main/ipc-handlers.ts — IPC handlers for settings
import { ipcMain } from 'electron'
import { store } from './store'

export function registerStoreHandlers(): void {
  // Get a setting value
  ipcMain.handle('store:get', (_event, key: string) => {
    return store.get(key)
  })

  // Update a setting value
  ipcMain.handle('store:set', (_event, key: string, value: unknown) => {
    store.set(key, value)
  })

  // Get all settings
  ipcMain.handle('store:getAll', () => {
    return store.store
  })

  // Reset settings
  ipcMain.handle('store:reset', () => {
    store.clear()
  })

  // Add to recent files list
  ipcMain.handle('store:addRecentFile', (_event, filePath: string) => {
    const recent = store.get('recentFiles', [])
    // Remove duplicates, prepend, keep max 10 entries
    const updated = [filePath, ...recent.filter(f => f !== filePath)].slice(0, 10)
    store.set('recentFiles', updated)
    return updated
  })
}
```

```typescript
// src/preload/index.ts — Expose settings API to Renderer (additions)
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing APIs ...

  // Settings API
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
    getAll: () => ipcRenderer.invoke('store:getAll'),
    reset: () => ipcRenderer.invoke('store:reset'),
    addRecentFile: (path: string) => ipcRenderer.invoke('store:addRecentFile', path),
  },
})
```

```tsx
// src/renderer/src/hooks/useSettings.ts — Manage settings with a React Hook
import { useState, useEffect, useCallback } from 'react'

interface EditorSettings {
  fontSize: number
  fontFamily: string
  tabSize: number
  wordWrap: boolean
  lineNumbers: boolean
  minimap: boolean
  autoSave: boolean
  autoSaveInterval: number
}

export function useSettings() {
  const [settings, setSettings] = useState<EditorSettings | null>(null)
  const [loading, setLoading] = useState(true)

  // Initial load
  useEffect(() => {
    async function loadSettings() {
      const editor = await window.electronAPI.store.get('editor')
      setSettings(editor as EditorSettings)
      setLoading(false)
    }
    loadSettings()
  }, [])

  // Update a setting
  const updateSetting = useCallback(async <K extends keyof EditorSettings>(
    key: K,
    value: EditorSettings[K]
  ) => {
    await window.electronAPI.store.set(`editor.${key}`, value)
    setSettings(prev => prev ? { ...prev, [key]: value } : null)
  }, [])

  return { settings, loading, updateSetting }
}
```

---

## 7. Setting Up the Test Environment

### 7.1 Configuring Test Tools

```bash
# Install test tools
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom
npm install --save-dev @testing-library/user-event jsdom
npm install --save-dev @vitest/coverage-v8
```

```typescript
// vitest.config.ts — Test configuration
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/renderer/src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/main/',      // Main process tested separately
        'src/preload/',   // Preload covered by E2E tests
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src'),
    },
  },
})
```

```typescript
// src/renderer/src/test/setup.ts — Test setup
import '@testing-library/jest-dom'

// Mock window.electronAPI
const mockElectronAPI = {
  platform: 'win32',
  openFile: vi.fn().mockResolvedValue(null),
  saveFile: vi.fn().mockResolvedValue(true),
  getStoreValue: vi.fn().mockResolvedValue(null),
  setStoreValue: vi.fn().mockResolvedValue(undefined),
  onUpdateAvailable: vi.fn(),
  store: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue({}),
    reset: vi.fn().mockResolvedValue(undefined),
    addRecentFile: vi.fn().mockResolvedValue([]),
  },
}

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
})
```

### 7.2 Component Test Example

```tsx
// src/renderer/src/components/__tests__/FileExplorer.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileExplorer } from '../FileExplorer'

describe('FileExplorer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays the open file button', () => {
    render(<FileExplorer />)
    expect(screen.getByText('Open File')).toBeInTheDocument()
  })

  it('invokes the open file dialog', async () => {
    const user = userEvent.setup()

    window.electronAPI.openFile = vi.fn().mockResolvedValue('test content')

    render(<FileExplorer />)
    await user.click(screen.getByText('Open File'))

    expect(window.electronAPI.openFile).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.getByText('test content')).toBeInTheDocument()
    })
  })

  it('displays nothing when file selection is cancelled', async () => {
    const user = userEvent.setup()

    window.electronAPI.openFile = vi.fn().mockResolvedValue(null)

    render(<FileExplorer />)
    await user.click(screen.getByText('Open File'))

    expect(screen.queryByTestId('file-content')).not.toBeInTheDocument()
  })
})
```

### 7.3 E2E Testing (Playwright)

```typescript
// e2e/app.spec.ts — Electron E2E tests
import { test, expect, _electron as electron } from '@playwright/test'
import { ElectronApplication, Page } from 'playwright'

let electronApp: ElectronApplication
let page: Page

test.beforeAll(async () => {
  // Launch the Electron app
  electronApp = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  })

  // Get the main window
  page = await electronApp.firstWindow()

  // Wait for the window to be ready
  await page.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await electronApp.close()
})

test('application starts successfully', async () => {
  const title = await page.title()
  expect(title).toBe('Electron + React + TypeScript')
})

test('window size is correct', async () => {
  const windowState = await electronApp.evaluate(({ BrowserWindow }) => {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    const { width, height } = mainWindow.getBounds()
    return { width, height }
  })

  expect(windowState.width).toBeGreaterThanOrEqual(800)
  expect(windowState.height).toBeGreaterThanOrEqual(600)
})

test('open file button works', async () => {
  await page.click('button:has-text("Open File")')

  // The dialog is handled by the main process,
  // so use a mock or inject an actual file path
})
```

---

## 8. Log Management

```typescript
// src/main/logger.ts — Structured log management
import log from 'electron-log'
import { app } from 'electron'
import path from 'path'

// Configure log file path
log.transports.file.resolvePathFn = () =>
  path.join(app.getPath('logs'), 'main.log')

// Configure log format
log.transports.file.format = '{y}-{m}-{d} {h}:{i}:{s}.{ms} [{level}] {text}'

// Limit file size (rotate at 5MB)
log.transports.file.maxSize = 5 * 1024 * 1024

// Configure log levels
if (app.isPackaged) {
  // Production: warn and above only
  log.transports.console.level = 'warn'
  log.transports.file.level = 'info'
} else {
  // Development: all logs
  log.transports.console.level = 'debug'
  log.transports.file.level = 'debug'
}

// Custom log functions
export const logger = {
  info: (message: string, data?: Record<string, unknown>) => {
    log.info(message, data ? JSON.stringify(data) : '')
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    log.warn(message, data ? JSON.stringify(data) : '')
  },
  error: (message: string, error?: Error) => {
    log.error(message, error?.stack || '')
  },
  debug: (message: string, data?: Record<string, unknown>) => {
    log.debug(message, data ? JSON.stringify(data) : '')
  },
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error)
})

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason instanceof Error ? reason : new Error(String(reason)))
})

export default log
```

---

## 9. Detailed package.json Configuration

```json
{
  "name": "my-electron-app",
  "version": "1.0.0",
  "description": "Electron + React + TypeScript Desktop App",
  "main": "./out/main/index.js",
  "author": "Your Name <your@email.com>",
  "license": "MIT",
  "homepage": "https://github.com/yourname/my-electron-app",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourname/my-electron-app.git"
  },
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "format": "prettier --write 'src/**/*.{ts,tsx,css}'",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "package:win": "electron-builder --win",
    "package:mac": "electron-builder --mac",
    "package:linux": "electron-builder --linux",
    "package:all": "electron-builder --win --mac --linux",
    "postinstall": "electron-builder install-app-deps"
  },
  "dependencies": {
    "electron-log": "^5.1.0",
    "electron-store": "^8.2.0",
    "electron-updater": "^6.1.0"
  },
  "devDependencies": {
    "@electron-toolkit/eslint-config-ts": "^1.0.0",
    "@electron-toolkit/utils": "^3.0.0",
    "@electron/notarize": "^2.3.0",
    "@quick-start/electron": "^2.0.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^14.2.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "@vitest/coverage-v8": "^1.3.0",
    "electron": "^28.0.0",
    "electron-builder": "^24.13.0",
    "electron-vite": "^2.0.0",
    "eslint": "^8.56.0",
    "prettier": "^3.2.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0",
    "typescript": "^5.3.0",
    "vitest": "^1.3.0"
  },
  "build": {
    "appId": "com.example.my-electron-app",
    "productName": "My Electron App",
    "copyright": "Copyright (C) 2024 Your Name",
    "directories": {
      "output": "dist",
      "buildResources": "build"
    },
    "files": [
      "out/**/*",
      "!node_modules/**/*"
    ],
    "win": {
      "target": ["nsis", "portable"],
      "icon": "resources/icon.ico"
    },
    "mac": {
      "target": ["dmg", "zip"],
      "icon": "resources/icon.icns",
      "category": "public.app-category.productivity"
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "icon": "resources/icons",
      "category": "Utility"
    }
  }
}
```

---

## 10. Security Checklist

```typescript
// Security configuration validation utility
import { BrowserWindow } from 'electron'

function validateSecurityConfig(win: BrowserWindow): void {
  const webPreferences = win.webContents.getWebPreferences()

  // Required: context isolation must be enabled
  if (!webPreferences.contextIsolation) {
    console.error('[Security] contextIsolation is disabled!')
  }

  // Required: Node.js integration must be disabled
  if (webPreferences.nodeIntegration) {
    console.error('[Security] nodeIntegration is enabled!')
  }

  // Recommended: sandbox should be enabled
  if (!webPreferences.sandbox) {
    console.warn('[Security] sandbox is disabled')
  }

  // Recommended: webSecurity should be enabled
  if (webPreferences.webSecurity === false) {
    console.error('[Security] webSecurity is disabled!')
  }
}

// Configure CSP (Content Security Policy)
function setupCSP(win: BrowserWindow): void {
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self' data:",
          "connect-src 'self' https://api.example.com",
        ].join('; '),
      },
    })
  })
}

// Prevent navigation to external URLs
function preventNavigation(win: BrowserWindow): void {
  // Restrict navigation within the window
  win.webContents.on('will-navigate', (event, url) => {
    const appUrl = new URL(win.webContents.getURL())
    const targetUrl = new URL(url)

    // Prevent navigation to a different origin
    if (targetUrl.origin !== appUrl.origin) {
      event.preventDefault()
      // Open in external browser
      require('electron').shell.openExternal(url)
    }
  })

  // Restrict creation of new windows
  win.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url)
    return { action: 'deny' }
  })
}
```

---

## 11. Anti-Patterns

### Anti-Pattern 1: Enabling nodeIntegration

```typescript
// BAD: Allow direct access to Node.js APIs from the Renderer
const win = new BrowserWindow({
  webPreferences: {
    nodeIntegration: true,       // Dangerous: Renderer can use fs, child_process, etc.
    contextIsolation: false,     // Dangerous: Preload and Renderer share the same context
  }
})
```

```typescript
// GOOD: Safely expose APIs via contextIsolation + Preload
const win = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,      // Disable Node.js integration
    contextIsolation: true,      // Enable context isolation
    sandbox: true,               // Enable sandbox
    preload: join(__dirname, 'preload.js'),
  }
})
```

### Anti-Pattern 2: Scattering Hard-coded IPC Channel Names

```typescript
// BAD: String literals scattered across Main/Preload/Renderer → breeding ground for typos
// main.ts
ipcMain.handle('get-user-data', ...)
// preload.ts
ipcRenderer.invoke('get-userData')  // Typo goes unnoticed
```

```typescript
// GOOD: Centrally manage channel names as constants
// src/shared/ipc-channels.ts
export const IPC_CHANNELS = {
  GET_USER_DATA: 'user:getData',
  SET_USER_DATA: 'user:setData',
  OPEN_FILE: 'dialog:openFile',
  SAVE_FILE: 'dialog:saveFile',
} as const

// Use in a type-safe manner
import { IPC_CHANNELS } from '../shared/ipc-channels'
ipcMain.handle(IPC_CHANNELS.GET_USER_DATA, ...)
ipcRenderer.invoke(IPC_CHANNELS.GET_USER_DATA)
```

---

## 12. Debugging and Troubleshooting

### 12.1 Debugging the Main Process

```typescript
// launch.json — VS Code debug configuration
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Main Process",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron-vite",
      "args": ["dev", "--inspect=5858"],
      "sourceMaps": true,
      "outFiles": ["${workspaceFolder}/out/**/*.js"],
      "console": "integratedTerminal",
      "env": {
        "NODE_ENV": "development"
      }
    },
    {
      "name": "Debug Renderer Process",
      "type": "chrome",
      "request": "attach",
      "port": 9222,
      "webRoot": "${workspaceFolder}/src/renderer/src",
      "sourceMapPathOverrides": {
        "webpack:///./src/*": "${webRoot}/*"
      }
    }
  ],
  "compounds": [
    {
      "name": "Debug All",
      "configurations": ["Debug Main Process", "Debug Renderer Process"]
    }
  ]
}
```

### 12.2 Common Errors and Solutions

```typescript
// Error 1: "Cannot use import statement outside a module"
// Cause: ESM/CJS configuration mismatch in the Main process
// Solution: Configure correctly in electron.vite.config.ts

// electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        output: {
          format: 'cjs', // Main process uses CJS
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        output: {
          format: 'cjs', // Preload also uses CJS
        },
      },
    },
  },
  renderer: {
    // Renderer works fine with ESM
  },
})
```

```typescript
// Error 2: "contextBridge API can only be used when contextIsolation is enabled"
// Cause: contextIsolation is false in BrowserWindow webPreferences
// Solution: Always set contextIsolation: true

// Error 3: "Electron Security Warning (Insecure Content-Security-Policy)"
// Cause: CSP is not configured
// Solution: Apply the CSP configuration from Section 10

// Error 4: IPC handler returns undefined
// Cause: invoke is called before handle is registered
// Solution: Register handlers inside app.whenReady()
import { app, ipcMain } from 'electron'

app.whenReady().then(() => {
  // Register IPC handlers inside app.whenReady()
  ipcMain.handle('channel', async (_event, ...args) => {
    // Handler logic
    return result
  })

  // Also create windows here
  createWindow()
})
```

### 12.3 Performance Profiling

```typescript
// src/main/performance.ts — Performance measurement utility
import { performance, PerformanceObserver } from 'perf_hooks'
import { logger } from './logger'

// Start a performance measurement
export function startMeasure(name: string): void {
  performance.mark(`${name}-start`)
}

// End a performance measurement and log the result
export function endMeasure(name: string): number {
  performance.mark(`${name}-end`)
  performance.measure(name, `${name}-start`, `${name}-end`)

  const entries = performance.getEntriesByName(name)
  const duration = entries[entries.length - 1]?.duration ?? 0

  logger.info(`[Performance] ${name}: ${duration.toFixed(2)}ms`)

  // Clean up marks
  performance.clearMarks(`${name}-start`)
  performance.clearMarks(`${name}-end`)
  performance.clearMeasures(name)

  return duration
}

// Example: measuring startup time
export function measureStartupTime(): void {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      logger.info(`[Startup] ${entry.name}: ${entry.duration.toFixed(2)}ms`)
    }
  })

  observer.observe({ entryTypes: ['measure'] })

  performance.mark('app-start')

  app.on('ready', () => {
    performance.mark('app-ready')
    performance.measure('App Ready Time', 'app-start', 'app-ready')
  })
}
```

---

## 13. Managing Environment Variables and Configuration

```typescript
// src/main/env.ts — Type-safe management of environment variables
import { app } from 'electron'
import path from 'path'

interface AppEnvironment {
  isDev: boolean
  isProd: boolean
  isTest: boolean
  appVersion: string
  platform: NodeJS.Platform
  arch: string
  userDataPath: string
  logPath: string
  tempPath: string
}

export function getAppEnvironment(): AppEnvironment {
  return {
    isDev: !app.isPackaged,
    isProd: app.isPackaged,
    isTest: process.env.NODE_ENV === 'test',
    appVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    userDataPath: app.getPath('userData'),
    logPath: app.getPath('logs'),
    tempPath: app.getPath('temp'),
  }
}

// Load .env file (for development environment)
import { config } from 'dotenv'

if (!app.isPackaged) {
  config({
    path: path.join(app.getAppPath(), '.env.development'),
  })
}

// Validate environment variables
function validateEnv(): void {
  const required = ['API_BASE_URL'] as const

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Environment variable ${key} is not set`)
    }
  }
}
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Write test code as well

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise for basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main logic for data processing"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Retrieve processing results"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# Tests
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "An exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation to add the following functionality.

```python
# Exercise 2: Advanced patterns
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise for advanced patterns"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """Add an item (with size limit)"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """Search by key"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """Remove by key"""
        for i, item in enumerate(self._items):
            if item['key'] == key:
                self._items.pop(i)
                return True
        return False

    def stats(self) -> Dict:
        """Statistics"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# Tests
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # Size limit reached
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("All advanced tests passed!")

test_advanced()
```

### Exercise 3: Performance Optimization

Improve the performance of the following code.

```python
# Exercise 3: Performance optimization
import time
from functools import lru_cache

# Before optimization (O(n^2))
def slow_search(data: list, target: int) -> int:
    """Inefficient search"""
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[i] + data[j] == target:
                return (i, j)
    return (-1, -1)

# After optimization (O(n))
def fast_search(data: list, target: int) -> tuple:
    """Efficient search using a hash map"""
    seen = {}
    for i, num in enumerate(data):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (-1, -1)

# Benchmark
def benchmark():
    import random
    data = list(range(5000))
    random.shuffle(data)
    target = data[100] + data[4000]

    start = time.time()
    result1 = slow_search(data, target)
    slow_time = time.time() - start

    start = time.time()
    result2 = fast_search(data, target)
    fast_time = time.time() - start

    print(f"Slow version: {slow_time:.4f}s")
    print(f"Fast version: {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key points:**
- Be conscious of algorithm complexity
- Choose the appropriate data structure
- Measure the effect with benchmarks

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | Prioritize when | Can compromise when |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin dashboards, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow            │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. What is the team size?                      │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → Go to 2              │
│                                                 │
│  2. How often do you deploy?                    │
│    ├─ Weekly or less → Monolith + modules       │
│    └─ Daily / multiple times → Go to 3          │
│                                                 │
│  3. How independent are teams?                  │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Every technical decision involves trade-offs. Analyze from the following perspectives:

**1. Short-term vs. Long-term Costs**
- A fast short-term approach can become technical debt in the long run
- Conversely, over-engineering incurs high short-term costs and can delay a project

**2. Consistency vs. Flexibility**
- A unified technology stack has low learning costs
- Adopting diverse technologies allows for the right tool for the job, but increases operational costs

**3. Level of Abstraction**
- High abstraction offers greater reusability, but can make debugging harder
- Low abstraction is intuitive, but tends to lead to code duplication

```python
# Template for recording design decisions
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe the background and problem"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision"""
        self.decision = decision
        return self

    def add_consequence(self, consequence: str, positive: bool = True):
        """Add a consequence"""
        self.consequences.append({
            'description': consequence,
            'type': 'positive' if positive else 'negative'
        })
        return self

    def add_alternative(self, name: str, reason_rejected: str):
        """Add a rejected alternative"""
        self.alternatives.append({
            'name': name,
            'reason_rejected': reason_rejected
        })
        return self

    def to_markdown(self) -> str:
        """Output in Markdown format"""
        md = f"# ADR: {self.title}\n\n"
        md += f"## Background\n{self.context}\n\n"
        md += f"## Decision\n{self.decision}\n\n"
        md += "## Consequences\n"
        for c in self.consequences:
            icon = "✅" if c['type'] == 'positive' else "⚠️"
            md += f"- {icon} {c['description']}\n"
        md += "\n## Rejected Alternatives\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```
---

## 14. FAQ

### Q1: What is the difference between electron-vite and electron-forge + Vite?

**A:** `electron-vite` is an integrated tool that optimizes Vite for Electron, allowing you to manage all three processes (Main/Preload/Renderer) in a single configuration file. `electron-forge` is the official Electron build toolchain that covers packaging, signing, and distribution. A common setup is to develop with `electron-vite` for the great developer experience, and then use `electron-forge` or `electron-builder` for building and distribution.

### Q2: Why does an Electron app use so much memory?

**A:** Electron bundles Chromium, so it consumes at least around 80-100MB of memory. Each window having its own independent Renderer process is also a contributing factor. Countermeasures include: (1) lazy creation of unnecessary windows, (2) enabling `backgroundThrottling` for background windows, and (3) utilizing V8 snapshots.

### Q3: Can I use frameworks other than React (Vue, Svelte) with Electron?

**A:** Yes. Since the Renderer process is the same as a regular web application, any framework can be used. `electron-vite` officially provides templates for React, Vue, Svelte, and Solid.

### Q4: How can I improve Electron app startup speed?

**A:** Key measures include: (1) Minimizing the Preload script — avoid loading unnecessary modules. (2) Using `show: false` and displaying the window on the `ready-to-show` event — prevents white screen flickering. (3) Lazy-loading native modules — do not load all modules at startup. (4) Using V8 code caching — use the `v8-compile-cache` package. (5) Using a splash screen — improves perceived speed.

### Q5: How can I reduce the binary size of an Electron app?

**A:** Since Electron bundles Chromium, the minimum size is around 50-80MB. Reduction strategies include: (1) enabling asar archiving in `electron-builder`, (2) excluding unnecessary `node_modules` (controlled via the `files` option), (3) ensuring `devDependencies` are not included in the bundle, (4) eliminating unnecessary OS-specific code with platform-specific builds, (5) if size is a concern, consider migrating to Tauri (binary size is around 2-10MB).

### Q6: How does the auto-update mechanism work?

**A:** Use the `electron-updater` package. Host update files on GitHub Releases, S3, or a private server, and check for updates when the app launches. It supports delta updates for NSIS installers on Windows and DMG/ZIP on macOS. If code signing is correctly configured, updates can be delivered without showing a security warning to the user.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is the most important thing. Understanding deepens not just through theory but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this knowledge applied in practice?

Knowledge of this topic is frequently used in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 15. Summary

| Topic | Key Points |
|---|---|
| Architecture | Main (Node.js) + Renderer (Chromium) + Preload (bridge) |
| Project creation | Generate a React+TS template with `create @quick-start/electron` |
| Vite integration | `electron-vite` manages Main/Preload/Renderer in one place |
| Hot reload | Renderer uses HMR (~50ms), Main auto-restarts (~1s) |
| IPC communication | invoke/handle pattern is recommended; centralize channel names as constants |
| Settings management | Persist with electron-store including schema validation |
| Testing | Two-layer approach: Vitest (Unit) + Playwright (E2E) |
| Log management | File rotation logging with electron-log |
| Security | contextIsolation: true + sandbox: true + CSP configuration are mandatory |
| Debugging | Debug both Main and Renderer processes with the VS Code integrated debugger |
| DevTools | Auto-open in development + React DevTools extension |

---

## What to Read Next

- **[01-electron-advanced.md](./01-electron-advanced.md)** — Multi-window, native modules, performance optimization
- **[02-tauri-setup.md](./02-tauri-setup.md)** — Introduction to Tauri, a lightweight alternative framework

---

## References

1. Electron, "Official Documentation", https://www.electronjs.org/docs/latest/
2. electron-vite, "Getting Started", https://electron-vite.org/guide/
3. Electron, "Security Best Practices", https://www.electronjs.org/docs/latest/tutorial/security
4. Electron, "Process Model", https://www.electronjs.org/docs/latest/tutorial/process-model

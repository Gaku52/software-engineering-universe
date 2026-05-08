# Cross-Platform Support

> Support Windows, macOS, and Linux from a single codebase. This chapter covers cross-platform design: platform detection, abstraction of OS-specific APIs, path handling, and UI/UX difference handling.

## What You Will Learn

- [ ] Implement platform detection and conditional branching
- [ ] Handle OS-specific UI/UX differences
- [ ] Properly process environment differences such as paths and line endings
- [ ] Understand and handle differences in fonts, rendering, and file systems
- [ ] Set up multi-platform builds in CI/CD
- [ ] Properly support native features on each OS (notifications, tray, shortcuts)


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [Using Native Features](./02-native-features.md)

---

## 1. Platform Detection

### 1.1 Basic Platform Detection

```typescript
// Platform detection
const platform = process.platform;
// 'win32' | 'darwin' | 'linux'

// Abstraction of OS-specific processing
function getPlatformConfig() {
  switch (process.platform) {
    case 'win32':
      return {
        appDataPath: process.env.APPDATA!,
        separator: '\\',
        lineEnding: '\r\n',
        shortcutModifier: 'Ctrl',
      };
    case 'darwin':
      return {
        appDataPath: `${process.env.HOME}/Library/Application Support`,
        separator: '/',
        lineEnding: '\n',
        shortcutModifier: 'Cmd',
      };
    case 'linux':
      return {
        appDataPath: process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`,
        separator: '/',
        lineEnding: '\n',
        shortcutModifier: 'Ctrl',
      };
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}
```

### 1.2 Retrieving Detailed Platform Information

```typescript
import os from 'os';
import { app } from 'electron';

// Utility class for retrieving detailed system information
class SystemInfo {
  // OS version information
  static getOSVersion(): string {
    return os.release(); // e.g. '10.0.22631' (Windows 11)
  }

  // Returns the OS type as a friendly name
  static getOSName(): string {
    switch (process.platform) {
      case 'win32': return `Windows ${this.getWindowsVersion()}`;
      case 'darwin': return `macOS ${this.getMacOSVersion()}`;
      case 'linux': return this.getLinuxDistro();
      default: return 'Unknown';
    }
  }

  // Determine the Windows version
  private static getWindowsVersion(): string {
    const release = os.release();
    const build = parseInt(release.split('.')[2] || '0');
    if (build >= 22000) return '11';
    if (build >= 10240) return '10';
    return release;
  }

  // Determine the macOS version
  private static getMacOSVersion(): string {
    const release = os.release();
    const major = parseInt(release.split('.')[0]);
    // Mapping between Darwin kernel version and macOS version
    const macVersionMap: Record<number, string> = {
      23: '14 (Sonoma)',
      22: '13 (Ventura)',
      21: '12 (Monterey)',
      20: '11 (Big Sur)',
    };
    return macVersionMap[major] || release;
  }

  // Determine the Linux distribution
  private static getLinuxDistro(): string {
    try {
      const osRelease = require('fs').readFileSync('/etc/os-release', 'utf-8');
      const match = osRelease.match(/PRETTY_NAME="(.+)"/);
      return match ? match[1] : 'Linux';
    } catch {
      return 'Linux';
    }
  }

  // Get architecture
  static getArch(): string {
    return process.arch; // 'x64' | 'arm64' | 'ia32'
  }

  // Memory information
  static getMemoryInfo(): { total: number; free: number; used: number } {
    const total = os.totalmem();
    const free = os.freemem();
    return {
      total: Math.round(total / (1024 * 1024)),
      free: Math.round(free / (1024 * 1024)),
      used: Math.round((total - free) / (1024 * 1024)),
    };
  }

  // CPU information
  static getCPUInfo(): { model: string; cores: number; speed: number } {
    const cpus = os.cpus();
    return {
      model: cpus[0]?.model || 'Unknown',
      cores: cpus.length,
      speed: cpus[0]?.speed || 0,
    };
  }

  // User locale information
  static getLocale(): string {
    return app.getLocale(); // e.g. 'ja', 'en-US'
  }

  // Determine dark mode
  static isDarkMode(): boolean {
    const { nativeTheme } = require('electron');
    return nativeTheme.shouldUseDarkColors;
  }
}
```

### 1.3 Feature-Based Detection Pattern

```typescript
// Preferred design: branch on feature availability rather than OS
class FeatureDetector {
  // Whether the system tray is supported
  static supportsTray(): boolean {
    // Tray is not supported in some Linux environments
    if (process.platform === 'linux') {
      // System tray behavior differs in Wayland environments
      return process.env.XDG_SESSION_TYPE !== 'wayland' ||
             !!process.env.DBUS_SESSION_BUS_ADDRESS;
    }
    return true;
  }

  // Whether native notifications are supported
  static supportsNotification(): boolean {
    const { Notification } = require('electron');
    return Notification.isSupported();
  }

  // Whether a touch screen is available
  static hasTouchScreen(): boolean {
    // Used in the Renderer process
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  // Whether high contrast mode is enabled
  static isHighContrast(): boolean {
    const { nativeTheme } = require('electron');
    return nativeTheme.shouldUseHighContrastColors;
  }

  // Whether the device is Apple Silicon (ARM)
  static isAppleSilicon(): boolean {
    return process.platform === 'darwin' && process.arch === 'arm64';
  }

  // Check if running on Windows 11 or later
  static isWindows11OrLater(): boolean {
    if (process.platform !== 'win32') return false;
    const build = parseInt(require('os').release().split('.')[2] || '0');
    return build >= 22000;
  }

  // Whether Mica / Acrylic is available (Windows 11 and later)
  static supportsMica(): boolean {
    return this.isWindows11OrLater();
  }
}
```

---

## 2. Path Handling

### 2.1 Basic Path Handling

```
Path handling notes:

  Windows: C:\Users\gaku\Documents\file.txt
  macOS:   /Users/gaku/Documents/file.txt
  Linux:   /home/gaku/Documents/file.txt

  Solution: Always use the path module
```

```typescript
import path from 'path';
import { app } from 'electron';

// Correct: use path.join
const configPath = path.join(app.getPath('userData'), 'config.json');

// Incorrect: string concatenation
const badPath = app.getPath('userData') + '/config.json'; // Breaks on Windows

// App data storage locations
const paths = {
  userData: app.getPath('userData'),      // App settings
  documents: app.getPath('documents'),    // User documents
  downloads: app.getPath('downloads'),    // Downloads
  temp: app.getPath('temp'),              // Temporary files
  home: app.getPath('home'),              // Home
  desktop: app.getPath('desktop'),        // Desktop
};
```

### 2.2 Advanced Path Handling Utilities

```typescript
import path from 'path';
import fs from 'fs/promises';
import { app } from 'electron';

class PathUtils {
  // Safely construct application-specific paths
  static getAppPath(...segments: string[]): string {
    const basePath = app.getPath('userData');
    const resolved = path.resolve(basePath, ...segments);
    // Prevent path traversal attacks
    if (!resolved.startsWith(basePath)) {
      throw new Error(`Invalid path: ${resolved}`);
    }
    return resolved;
  }

  // Sanitize a filename to be compatible with the current platform
  static sanitizeFileName(name: string): string {
    // Remove characters not allowed on Windows
    const windowsForbidden = /[<>:"/\\|?*\x00-\x1f]/g;
    let sanitized = name.replace(windowsForbidden, '_');

    // Avoid Windows reserved names
    const windowsReserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
    if (windowsReserved.test(sanitized)) {
      sanitized = `_${sanitized}`;
    }

    // Colons are also problematic on macOS
    if (process.platform === 'darwin') {
      sanitized = sanitized.replace(/:/g, '_');
    }

    // Limit filename length (ext4: 255 bytes, NTFS: 255 characters)
    if (sanitized.length > 200) {
      const ext = path.extname(sanitized);
      sanitized = sanitized.substring(0, 200 - ext.length) + ext;
    }

    return sanitized;
  }

  // Check maximum path length
  static validatePathLength(filePath: string): boolean {
    if (process.platform === 'win32') {
      // Windows: MAX_PATH is 260 characters (when long paths are not enabled)
      return filePath.length < 260;
    }
    // macOS / Linux: PATH_MAX is typically 4096
    return filePath.length < 4096;
  }

  // Handle UNC paths (Windows network drives)
  static isUNCPath(filePath: string): boolean {
    return filePath.startsWith('\\\\') || filePath.startsWith('//');
  }

  // Expand home directory (~/ → actual path)
  static expandHome(filePath: string): string {
    if (filePath.startsWith('~/') || filePath === '~') {
      return filePath.replace('~', app.getPath('home'));
    }
    return filePath;
  }

  // Create a cross-platform temporary file
  static async createTempFile(prefix: string, extension: string): Promise<string> {
    const tempDir = app.getPath('temp');
    const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const tempPath = path.join(tempDir, fileName);
    await fs.writeFile(tempPath, '');
    return tempPath;
  }

  // Recursively create a directory (only if it does not exist)
  static async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  // Resolve symbolic links (commonly used on Linux/macOS)
  static async resolveSymlinks(filePath: string): Promise<string> {
    try {
      return await fs.realpath(filePath);
    } catch {
      return filePath;
    }
  }
}
```

### 2.3 Handling File System Differences

```typescript
import fs from 'fs/promises';
import path from 'path';

class FileSystemCompat {
  // Case sensitivity of the file system
  // Windows: case-insensitive (NTFS)
  // macOS: case-insensitive by default (APFS preserves case but ignores it in searches)
  // Linux: case-sensitive (ext4)
  static isCaseSensitive(): boolean {
    return process.platform === 'linux';
  }

  // Set file permissions (differs between Unix-based systems and Windows)
  static async setFilePermissions(
    filePath: string,
    mode: 'readable' | 'writable' | 'executable'
  ): Promise<void> {
    if (process.platform === 'win32') {
      // POSIX permissions work only in a limited way on Windows
      // The icacls command may be used in some cases
      return;
    }

    const modeMap = {
      readable: 0o644,    // rw-r--r--
      writable: 0o666,    // rw-rw-rw-
      executable: 0o755,  // rwxr-xr-x
    };

    await fs.chmod(filePath, modeMap[mode]);
  }

  // Handle file locking (exclusive control)
  static async acquireFileLock(lockPath: string): Promise<boolean> {
    try {
      // Atomically create with O_EXCL flag (error if already exists)
      const fd = await fs.open(lockPath, 'wx');
      await fd.writeFile(String(process.pid));
      await fd.close();
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        return false; // Already locked
      }
      throw error;
    }
  }

  // Release a file lock
  static async releaseFileLock(lockPath: string): Promise<void> {
    try {
      await fs.unlink(lockPath);
    } catch {
      // Ignore if lock file does not exist
    }
  }

  // Cross-platform file watching
  static watchFile(
    filePath: string,
    callback: (eventType: string, filename: string) => void
  ): fs.FileHandle | null {
    // Use a wrapper because the behavior of fs.watch differs by OS
    // Note: on macOS, rename events may fire frequently
    try {
      const watcher = require('fs').watch(filePath, (eventType: string, filename: string) => {
        callback(eventType, filename || path.basename(filePath));
      });
      return watcher;
    } catch {
      return null;
    }
  }

  // Normalize line endings
  static normalizeLineEndings(content: string): string {
    // Normalize Windows CRLF → LF
    return content.replace(/\r\n/g, '\n');
  }

  // Convert to the platform-specific line ending
  static toPlatformLineEndings(content: string): string {
    const normalized = content.replace(/\r\n/g, '\n');
    if (process.platform === 'win32') {
      return normalized.replace(/\n/g, '\r\n');
    }
    return normalized;
  }
}
```

---

## 3. Menu Bar OS Differences

### 3.1 Structural Differences in the Menu Bar

```
Menu bar differences:

  macOS:   Global menu bar at the top of the screen
           App name menu (About/Preferences/Quit) is required
           Cmd+Q to quit

  Windows: Menu bar at the top of the window
           Exit in the File menu
           Alt+F4 to quit

  Linux:   At the top of the window (depends on desktop environment)
           Quit in the File menu
           GNOME may use a global menu bar
```

### 3.2 Complete Menu Implementation Example

```typescript
import { Menu, app, shell, dialog, BrowserWindow } from 'electron';

function createMenu() {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    // macOS: app name menu
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { label: 'Preferences...', accelerator: 'Cmd+,', click: openSettings },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    // File menu
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: newFile },
        { label: 'Open', accelerator: 'CmdOrCtrl+O', click: openFile },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: saveFile },
        { label: 'Save As...', accelerator: 'CmdOrCtrl+Shift+S', click: saveFileAs },
        { type: 'separator' },
        ...(isMac ? [] : [
          { label: 'Preferences', accelerator: 'Ctrl+,', click: openSettings },
          { type: 'separator' as const },
          { label: 'Exit', accelerator: 'Alt+F4', click: () => app.quit() },
        ]),
      ],
    },
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const, label: 'Undo' },
        { role: 'redo' as const, label: 'Redo' },
        { type: 'separator' as const },
        { role: 'cut' as const, label: 'Cut' },
        { role: 'copy' as const, label: 'Copy' },
        { role: 'paste' as const, label: 'Paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' as const, label: 'Paste and Match Style' },
          { role: 'delete' as const, label: 'Delete' },
          { role: 'selectAll' as const, label: 'Select All' },
          { type: 'separator' as const },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' as const, label: 'Start Speaking' },
              { role: 'stopSpeaking' as const, label: 'Stop Speaking' },
            ],
          },
        ] : [
          { role: 'delete' as const, label: 'Delete' },
          { type: 'separator' as const },
          { role: 'selectAll' as const, label: 'Select All' },
        ]),
      ],
    },
    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const, label: 'Reload' },
        { role: 'forceReload' as const, label: 'Force Reload' },
        { role: 'toggleDevTools' as const, label: 'Developer Tools' },
        { type: 'separator' as const },
        { role: 'resetZoom' as const, label: 'Reset Zoom' },
        { role: 'zoomIn' as const, label: 'Zoom In' },
        { role: 'zoomOut' as const, label: 'Zoom Out' },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const, label: 'Full Screen' },
      ],
    },
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const, label: 'Minimize' },
        { role: 'zoom' as const, label: 'Zoom' },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const, label: 'Bring All to Front' },
          { type: 'separator' as const },
          { role: 'window' as const },
        ] : [
          { role: 'close' as const, label: 'Close' },
        ]),
      ],
    },
    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            await shell.openExternal('https://example.com/docs');
          },
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About',
              message: `${app.name} v${app.getVersion()}`,
              detail: `Electron: ${process.versions.electron}\nNode.js: ${process.versions.node}\nChromium: ${process.versions.chrome}\nOS: ${process.platform} ${process.arch}`,
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
```

### 3.3 Context Menu (Right-Click Menu) Implementation

```typescript
import { Menu, MenuItem, BrowserWindow } from 'electron';

// Context menu called from the Renderer
function showContextMenu(
  window: BrowserWindow,
  params: { x: number; y: number; isEditable: boolean; selectedText: string }
): void {
  const menu = new Menu();

  if (params.isEditable) {
    // For editable text elements
    menu.append(new MenuItem({
      label: 'Undo',
      role: 'undo',
      accelerator: 'CmdOrCtrl+Z',
    }));
    menu.append(new MenuItem({
      label: 'Redo',
      role: 'redo',
      accelerator: 'CmdOrCtrl+Shift+Z',
    }));
    menu.append(new MenuItem({ type: 'separator' }));
    menu.append(new MenuItem({
      label: 'Cut',
      role: 'cut',
      accelerator: 'CmdOrCtrl+X',
    }));
    menu.append(new MenuItem({
      label: 'Copy',
      role: 'copy',
      accelerator: 'CmdOrCtrl+C',
    }));
    menu.append(new MenuItem({
      label: 'Paste',
      role: 'paste',
      accelerator: 'CmdOrCtrl+V',
    }));
    menu.append(new MenuItem({
      label: 'Select All',
      role: 'selectAll',
      accelerator: 'CmdOrCtrl+A',
    }));
  } else if (params.selectedText) {
    // When text is selected
    menu.append(new MenuItem({
      label: 'Copy',
      role: 'copy',
      accelerator: 'CmdOrCtrl+C',
    }));
    menu.append(new MenuItem({ type: 'separator' }));
    menu.append(new MenuItem({
      label: `Search for "${params.selectedText.substring(0, 20)}..."`,
      click: () => {
        const { shell } = require('electron');
        shell.openExternal(
          `https://www.google.com/search?q=${encodeURIComponent(params.selectedText)}`
        );
      },
    }));
  }

  menu.popup({ window, x: params.x, y: params.y });
}
```

---

## 4. Window Management Differences

### 4.1 Basic Window Lifecycle

```typescript
import { app, BrowserWindow } from 'electron';

// macOS: closing all windows does not quit the app
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// macOS: clicking the Dock icon recreates the window
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Title bar customization
const win = new BrowserWindow({
  titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  // macOS: position of traffic lights (close/minimize/maximize)
  trafficLightPosition: { x: 15, y: 15 },
  // Windows: frame when title bar is hidden
  frame: process.platform === 'darwin' ? true : true,
});
```

### 4.2 Saving and Restoring Window Position and Size

```typescript
import { BrowserWindow, screen } from 'electron';
import Store from 'electron-store';

interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
  isFullScreen: boolean;
}

class WindowStateManager {
  private store: Store;
  private windowId: string;
  private defaultState: WindowState;

  constructor(windowId: string, defaults: Partial<WindowState> = {}) {
    this.store = new Store({ name: 'window-state' });
    this.windowId = windowId;
    this.defaultState = {
      x: 0,
      y: 0,
      width: defaults.width || 1200,
      height: defaults.height || 800,
      isMaximized: false,
      isFullScreen: false,
    };
  }

  // Get the saved state
  getState(): WindowState {
    const saved = this.store.get(`windows.${this.windowId}`) as WindowState | undefined;
    if (!saved) return this.defaultState;

    // Validate that the saved position fits within the current display
    const displays = screen.getAllDisplays();
    const isVisible = displays.some(display => {
      const bounds = display.bounds;
      return (
        saved.x >= bounds.x &&
        saved.y >= bounds.y &&
        saved.x + saved.width <= bounds.x + bounds.width &&
        saved.y + saved.height <= bounds.y + bounds.height
      );
    });

    return isVisible ? saved : this.defaultState;
  }

  // Monitor window state changes and auto-save
  track(window: BrowserWindow): void {
    const saveState = (): void => {
      if (window.isDestroyed()) return;

      const bounds = window.getBounds();
      const state: WindowState = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: window.isMaximized(),
        isFullScreen: window.isFullScreen(),
      };

      this.store.set(`windows.${this.windowId}`, state);
    };

    // Save state on various events
    window.on('resize', saveState);
    window.on('move', saveState);
    window.on('maximize', saveState);
    window.on('unmaximize', saveState);
    window.on('enter-full-screen', saveState);
    window.on('leave-full-screen', saveState);
    window.on('close', saveState);
  }

  // Restore the window with the saved state
  restore(window: BrowserWindow): void {
    const state = this.getState();

    if (state.isMaximized) {
      window.maximize();
    } else if (state.isFullScreen) {
      window.setFullScreen(true);
    }
  }
}

// Usage example
function createWindow(): BrowserWindow {
  const stateManager = new WindowStateManager('main', {
    width: 1200,
    height: 800,
  });

  const state = stateManager.getState();

  const win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });

  stateManager.track(win);
  stateManager.restore(win);

  win.once('ready-to-show', () => win.show());

  return win;
}
```

### 4.3 Multi-Display Support

```typescript
import { screen, BrowserWindow } from 'electron';

class DisplayManager {
  // Get information about all displays
  static getAllDisplays() {
    return screen.getAllDisplays().map(display => ({
      id: display.id,
      label: display.label,
      bounds: display.bounds,
      workArea: display.workArea,
      scaleFactor: display.scaleFactor,
      isPrimary: display.id === screen.getPrimaryDisplay().id,
    }));
  }

  // Get the display at the cursor position
  static getDisplayAtCursor() {
    const cursor = screen.getCursorScreenPoint();
    return screen.getDisplayNearestPoint(cursor);
  }

  // Center the window on a specific display
  static centerOnDisplay(window: BrowserWindow, displayId?: number): void {
    const display = displayId
      ? screen.getAllDisplays().find(d => d.id === displayId) || screen.getPrimaryDisplay()
      : screen.getPrimaryDisplay();

    const { x, y, width, height } = display.workArea;
    const [winWidth, winHeight] = window.getSize();

    window.setPosition(
      Math.round(x + (width - winWidth) / 2),
      Math.round(y + (height - winHeight) / 2)
    );
  }

  // Handle DPI scaling
  static getScaleFactor(): number {
    const primaryDisplay = screen.getPrimaryDisplay();
    return primaryDisplay.scaleFactor;
  }
}
```

---

## 5. System Tray OS Differences

### 5.1 Tray Implementation

```typescript
import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'path';

class TrayManager {
  private tray: Tray | null = null;

  create(): void {
    // Icon size differs by OS
    const iconPath = this.getIconPath();
    const icon = nativeImage.createFromPath(iconPath);

    // macOS: using a template image automatically handles dark mode
    if (process.platform === 'darwin') {
      icon.setTemplateImage(true);
    }

    this.tray = new Tray(icon);

    // Set tooltip
    this.tray.setToolTip(app.name);

    // Set context menu
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Window',
        click: () => {
          const windows = BrowserWindow.getAllWindows();
          if (windows.length > 0) {
            windows[0].show();
            windows[0].focus();
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Status',
        enabled: false,
        // Show icon (automatically resized on macOS)
        icon: nativeImage.createFromPath(
          path.join(__dirname, '../../resources/status-ok.png')
        ).resize({ width: 16, height: 16 }),
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => app.quit(),
      },
    ]);

    this.tray.setContextMenu(contextMenu);

    // Windows / Linux: click to show window
    // macOS: click to show menu (default behavior)
    if (process.platform !== 'darwin') {
      this.tray.on('click', () => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          if (windows[0].isVisible()) {
            windows[0].hide();
          } else {
            windows[0].show();
            windows[0].focus();
          }
        }
      });
    }

    // macOS: double-click to show window
    if (process.platform === 'darwin') {
      this.tray.on('double-click', () => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          windows[0].show();
          windows[0].focus();
        }
      });
    }
  }

  // Platform-specific icon path
  private getIconPath(): string {
    const resourcesPath = path.join(__dirname, '../../resources');

    switch (process.platform) {
      case 'win32':
        // Windows: use .ico file (contains 16x16, 32x32, 48x48)
        return path.join(resourcesPath, 'tray-icon.ico');
      case 'darwin':
        // macOS: PNG template image including @2x (16x16 + 32x32)
        return path.join(resourcesPath, 'tray-iconTemplate.png');
      case 'linux':
        // Linux: PNG file (24x24 recommended)
        return path.join(resourcesPath, 'tray-icon.png');
      default:
        return path.join(resourcesPath, 'tray-icon.png');
    }
  }

  // Update tray badge (e.g. unread count)
  updateBadge(count: number): void {
    if (!this.tray) return;

    if (process.platform === 'darwin') {
      // macOS: show badge on the Dock
      app.dock.setBadge(count > 0 ? String(count) : '');
    }

    // Update tray tooltip
    this.tray.setToolTip(
      count > 0 ? `${app.name} (${count} notifications)` : app.name
    );
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }
}
```

---

## 6. Notification OS Differences

```typescript
import { Notification, app } from 'electron';

class NotificationManager {
  // Send a cross-platform notification
  static send(options: {
    title: string;
    body: string;
    icon?: string;
    urgency?: 'normal' | 'critical' | 'low';
    silent?: boolean;
    actions?: Array<{ text: string; type: string }>;
  }): void {
    if (!Notification.isSupported()) {
      console.warn('Notifications are not supported in this environment');
      return;
    }

    const notification = new Notification({
      title: options.title,
      body: options.body,
      icon: options.icon,
      silent: options.silent || false,
      // macOS: action buttons
      ...(process.platform === 'darwin' && options.actions && {
        actions: options.actions.map(a => ({
          text: a.text,
          type: a.type as 'button',
        })),
        hasReply: false,
      }),
      // Linux: set urgency
      ...(process.platform === 'linux' && {
        urgency: options.urgency || 'normal',
      }),
    });

    // Handle notification click
    notification.on('click', () => {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        windows[0].show();
        windows[0].focus();
      }
    });

    // macOS: handle action button click
    notification.on('action', (_event, index) => {
      console.log(`Action ${index} was clicked`);
    });

    notification.show();
  }

  // Windows-specific: setup for toast notifications
  static setupWindowsNotifications(): void {
    if (process.platform !== 'win32') return;

    // Set AppUserModelId (must match the shortcut in the Start menu)
    app.setAppUserModelId('com.example.myapp');
  }
}
```

---

## 7. Unifying Keyboard Shortcuts

### 7.1 Using CmdOrCtrl

```typescript
import { globalShortcut, app } from 'electron';

// Register global shortcuts
function registerGlobalShortcuts(): void {
  // CmdOrCtrl automatically switches based on the OS
  globalShortcut.register('CmdOrCtrl+Shift+Space', () => {
    // Quick action (common to all OS)
    showQuickAction();
  });

  // OS-specific shortcuts
  if (process.platform === 'darwin') {
    // macOS-specific: Cmd+Option+I matches Safari's inspector
    globalShortcut.register('Cmd+Option+I', () => {
      toggleDevTools();
    });
  }
}

// Unregister global shortcuts when the app quits
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
```

### 7.2 Displaying a Keyboard Shortcut List

```typescript
// Shortcut list component on the Renderer side
interface ShortcutEntry {
  action: string;
  windows: string;
  mac: string;
  linux: string;
}

const shortcuts: ShortcutEntry[] = [
  { action: 'New File', windows: 'Ctrl+N', mac: 'Cmd+N', linux: 'Ctrl+N' },
  { action: 'Open', windows: 'Ctrl+O', mac: 'Cmd+O', linux: 'Ctrl+O' },
  { action: 'Save', windows: 'Ctrl+S', mac: 'Cmd+S', linux: 'Ctrl+S' },
  { action: 'Close', windows: 'Ctrl+W', mac: 'Cmd+W', linux: 'Ctrl+W' },
  { action: 'Preferences', windows: 'Ctrl+,', mac: 'Cmd+,', linux: 'Ctrl+,' },
  { action: 'Find', windows: 'Ctrl+F', mac: 'Cmd+F', linux: 'Ctrl+F' },
  { action: 'Replace', windows: 'Ctrl+H', mac: 'Cmd+Option+F', linux: 'Ctrl+H' },
  { action: 'Full Screen', windows: 'F11', mac: 'Ctrl+Cmd+F', linux: 'F11' },
  { action: 'Quit', windows: 'Alt+F4', mac: 'Cmd+Q', linux: 'Ctrl+Q' },
  { action: 'DevTools', windows: 'F12', mac: 'Cmd+Option+I', linux: 'F12' },
];

// Get the shortcut for the current platform
function getShortcutForPlatform(entry: ShortcutEntry): string {
  switch (process.platform) {
    case 'darwin': return entry.mac;
    case 'win32': return entry.windows;
    case 'linux': return entry.linux;
    default: return entry.windows;
  }
}
```

---

## 8. Font and Rendering Differences

```typescript
// Cross-platform font settings
const fontFamilies = {
  win32: {
    sansSerif: '"Segoe UI", "Yu Gothic UI", "Meiryo", sans-serif',
    monospace: '"Cascadia Code", "Consolas", "MS Gothic", monospace',
    system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  darwin: {
    sansSerif: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif',
    monospace: '"SF Mono", "Menlo", "Osaka-Mono", monospace',
    system: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif',
  },
  linux: {
    sansSerif: '"Noto Sans CJK JP", "Ubuntu", sans-serif',
    monospace: '"Ubuntu Mono", "DejaVu Sans Mono", "Noto Sans Mono CJK JP", monospace',
    system: '"Noto Sans CJK JP", "Ubuntu", sans-serif',
  },
};

// Cross-platform CSS
const crossPlatformCSS = `
/* Recommended settings for using system fonts */
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
               "Hiragino Sans", "Noto Sans CJK JP", "Yu Gothic UI",
               "Meiryo", sans-serif;

  /* Adjust font rendering differences per OS */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/* macOS-specific: subpixel rendering */
@media screen and (-webkit-min-device-pixel-ratio: 2) {
  body {
    -webkit-font-smoothing: subpixel-antialiased;
  }
}

/* Windows-specific: ClearType optimization */
@media screen and (-ms-high-contrast: none) {
  body {
    font-feature-settings: "liga" 0; /* Disable ligatures (compatibility with ClearType) */
  }
}

/* Scrollbar customization (unified across OS) */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.4);
  border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(128, 128, 128, 0.6);
}

/* macOS: hide scrollbar when using overlay scrollbars */
@supports (-webkit-overflow-scrolling: touch) {
  ::-webkit-scrollbar {
    display: none;
  }
}
`;
```

---

## 9. Native Dialog Differences

```typescript
import { dialog, BrowserWindow } from 'electron';

class DialogManager {
  // File selection dialog (appearance differs by OS)
  static async openFile(parentWindow: BrowserWindow): Promise<string | null> {
    const result = await dialog.showOpenDialog(parentWindow, {
      title: 'Select File',
      // macOS: allows simultaneous selection of files and folders
      properties: [
        'openFile',
        ...(process.platform === 'darwin' ? ['treatPackageAsDirectory' as const] : []),
      ],
      filters: [
        { name: 'Text Files', extensions: ['txt', 'md', 'json'] },
        { name: 'Images', extensions: ['png', 'jpg', 'gif', 'svg'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      // macOS: displayed as a sheet dialog (attached to the parent window)
      // Windows / Linux: standalone dialog
    });

    return result.canceled ? null : result.filePaths[0];
  }

  // Confirmation dialog
  static async confirm(
    parentWindow: BrowserWindow,
    message: string,
    detail?: string
  ): Promise<boolean> {
    const result = await dialog.showMessageBox(parentWindow, {
      type: 'question',
      title: 'Confirm',
      message,
      detail,
      buttons: process.platform === 'darwin'
        ? ['Cancel', 'OK'] // macOS: affirmative button on the right
        : ['OK', 'Cancel'], // Windows/Linux: affirmative button on the left
      defaultId: process.platform === 'darwin' ? 1 : 0,
      cancelId: process.platform === 'darwin' ? 0 : 1,
      // macOS: can add a checkbox
      checkboxLabel: process.platform === 'darwin' ? 'Do not show again' : undefined,
    });

    return result.response === (process.platform === 'darwin' ? 1 : 0);
  }

  // Error dialog
  static showError(title: string, content: string): void {
    dialog.showErrorBox(title, content);
  }
}
```

---

## 10. Auto-Update Platform Differences

```typescript
import { autoUpdater, UpdateCheckResult } from 'electron-updater';
import { app, BrowserWindow, dialog } from 'electron';
import log from 'electron-log';

class UpdateManager {
  private mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.configure();
  }

  private configure(): void {
    // Configure logging
    autoUpdater.logger = log;

    // Configure automatic download
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // macOS: require code signature verification
    if (process.platform === 'darwin') {
      autoUpdater.autoRunAppAfterInstall = true;
    }

    // Set up event listeners
    autoUpdater.on('update-available', async (info) => {
      const result = await dialog.showMessageBox(this.mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `Version ${info.version} is available. Download now?`,
        buttons: ['Download', 'Later'],
        defaultId: 0,
      });

      if (result.response === 0) {
        autoUpdater.downloadUpdate();
      }
    });

    autoUpdater.on('update-downloaded', async () => {
      const result = await dialog.showMessageBox(this.mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: 'Restart and apply the update?',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      });

      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });

    autoUpdater.on('error', (error) => {
      log.error('Auto-update error:', error);
    });
  }

  // Run update check
  async checkForUpdates(): Promise<void> {
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      log.error('Update check failed:', error);
    }
  }
}
```

---

## 11. CI/CD Multi-Platform Build

### 11.1 GitHub Actions Configuration

```yaml
# .github/workflows/build.yml
name: Build
on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: windows-latest
            target: win
          - os: macos-latest
            target: mac
          - os: ubuntu-latest
            target: linux

    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: pnpm install
      - run: pnpm build
      - run: pnpm package:${{ matrix.target }}
      - uses: actions/upload-artifact@v4
        with:
          name: app-${{ matrix.target }}
          path: out/make/**/*
```

### 11.2 electron-builder Multi-Platform Configuration

```yaml
# electron-builder.yml
appId: com.example.myapp
productName: My App

# Windows-specific settings
win:
  target:
    - target: nsis
      arch: [x64, arm64]
    - target: portable
      arch: [x64]
  icon: resources/icon.ico
  # Code signing
  certificateFile: ${env.WIN_CERT_FILE}
  certificatePassword: ${env.WIN_CERT_PASSWORD}

nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: My App
  # Japanese installer UI
  language: 1041

# macOS-specific settings
mac:
  target:
    - target: dmg
      arch: [universal]
    - target: zip
      arch: [universal]
  icon: resources/icon.icns
  category: public.app-category.productivity
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  # Notarization
  notarize:
    teamId: ${env.APPLE_TEAM_ID}

dmg:
  sign: false
  contents:
    - x: 130
      y: 220
    - x: 410
      y: 220
      type: link
      path: /Applications

# Linux-specific settings
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
  maintainer: developer@example.com
  synopsis: A cross-platform desktop application
  description: |
    My App is a cross-platform desktop application
    that supports Windows, macOS, and Linux.

deb:
  depends:
    - gconf2
    - gconf-service
    - libnotify4
    - libappindicator1
    - libxtst6
    - libnss3

# Auto-update settings
publish:
  provider: github
  owner: myorg
  repo: myapp
```

### 11.3 macOS Notarization Script

```bash
#!/bin/bash
# scripts/notarize.sh — macOS app notarization script

set -e

APP_PATH="$1"
APPLE_ID="${APPLE_ID}"
APPLE_PASSWORD="${APPLE_APP_SPECIFIC_PASSWORD}"
TEAM_ID="${APPLE_TEAM_ID}"

echo "Starting notarization: $APP_PATH"

# Compress the app to zip
ditto -c -k --keepParent "$APP_PATH" "$APP_PATH.zip"

# Submit to Apple for notarization
xcrun notarytool submit "$APP_PATH.zip" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$TEAM_ID" \
  --wait

# Staple the notarization result to the app
xcrun stapler staple "$APP_PATH"

echo "Notarization complete"
```

---

## 12. Cross-Platform Testing

```typescript
import { describe, it, expect, beforeAll } from 'vitest';

// Helper to skip platform-dependent tests
const onlyOnWindows = process.platform === 'win32' ? describe : describe.skip;
const onlyOnMac = process.platform === 'darwin' ? describe : describe.skip;
const onlyOnLinux = process.platform === 'linux' ? describe : describe.skip;
const skipOnCI = process.env.CI ? describe.skip : describe;

describe('PathUtils', () => {
  it('sanitizeFileName handles Windows reserved names', () => {
    expect(PathUtils.sanitizeFileName('CON')).toBe('_CON');
    expect(PathUtils.sanitizeFileName('NUL.txt')).toBe('_NUL.txt');
    expect(PathUtils.sanitizeFileName('normal.txt')).toBe('normal.txt');
  });

  it('sanitizeFileName removes invalid characters', () => {
    expect(PathUtils.sanitizeFileName('file<>:name.txt')).toBe('file___name.txt');
    expect(PathUtils.sanitizeFileName('file|name?.txt')).toBe('file_name_.txt');
  });

  it('expandHome expands the home directory', () => {
    const expanded = PathUtils.expandHome('~/Documents/test.txt');
    expect(expanded).not.toContain('~');
    expect(expanded).toContain('Documents/test.txt');
  });
});

onlyOnWindows('Windows-specific tests', () => {
  it('correctly detects UNC paths', () => {
    expect(PathUtils.isUNCPath('\\\\server\\share')).toBe(true);
    expect(PathUtils.isUNCPath('C:\\Users')).toBe(false);
  });

  it('validates Windows path length limit', () => {
    const longPath = 'C:\\' + 'a'.repeat(260);
    expect(PathUtils.validatePathLength(longPath)).toBe(false);
  });
});

onlyOnMac('macOS-specific tests', () => {
  it('correctly detects macOS version', () => {
    const version = SystemInfo.getOSName();
    expect(version).toContain('macOS');
  });
});

onlyOnLinux('Linux-specific tests', () => {
  it('file system is case-sensitive', () => {
    expect(FileSystemCompat.isCaseSensitive()).toBe(true);
  });
});
```

---

## 13. Cross-Platform Support with Tauri

```rust
// src-tauri/src/platform.rs — Platform-specific processing in Tauri

use std::env;

/// Get the platform-specific configuration directory
pub fn get_config_dir() -> std::path::PathBuf {
    #[cfg(target_os = "windows")]
    {
        let appdata = env::var("APPDATA").expect("APPDATA not set");
        std::path::PathBuf::from(appdata).join("com.example.myapp")
    }

    #[cfg(target_os = "macos")]
    {
        let home = env::var("HOME").expect("HOME not set");
        std::path::PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("com.example.myapp")
    }

    #[cfg(target_os = "linux")]
    {
        let config_dir = env::var("XDG_CONFIG_HOME")
            .unwrap_or_else(|_| {
                let home = env::var("HOME").expect("HOME not set");
                format!("{}/.config", home)
            });
        std::path::PathBuf::from(config_dir).join("com.example.myapp")
    }
}

/// Platform-specific initialization
pub fn platform_init() {
    #[cfg(target_os = "windows")]
    {
        // Windows: configure DPI awareness
        unsafe {
            winapi::um::shellscalingapi::SetProcessDpiAwareness(
                winapi::um::shellscalingapi::PROCESS_PER_MONITOR_DPI_AWARE,
            );
        }
    }

    #[cfg(target_os = "macos")]
    {
        // macOS: no special initialization needed (handled by Tauri)
    }

    #[cfg(target_os = "linux")]
    {
        // Linux: set GTK theme
        env::set_var("GTK_THEME", "Adwaita:dark");
    }
}
```

```toml
# src-tauri/Cargo.toml — Platform-specific dependencies

[target.'cfg(target_os = "windows")'.dependencies]
winapi = { version = "0.3", features = ["shellscalingapi", "winuser"] }
windows-sys = "0.52"

[target.'cfg(target_os = "macos")'.dependencies]
cocoa = "0.25"
objc = "0.2"

[target.'cfg(target_os = "linux")'.dependencies]
gtk = "0.18"
```

---

## FAQ

### Q1: How do I unify keyboard shortcuts between Windows and macOS?
Use `CmdOrCtrl`. It is automatically mapped to Cmd on macOS and Ctrl on Windows/Linux. However, macOS-specific modifier key combinations such as `Cmd+Option` require separate handling. Using `CmdOrCtrl` in Electron's `accelerator` string is the most convenient approach.

### Q2: How do I support dark mode on macOS?
Detect the current theme with `nativeTheme.shouldUseDarkColors`. Monitor changes with `nativeTheme.on('updated', ...)`. On the CSS side, use the `prefers-color-scheme` media query. On the Electron side, set `nativeTheme.themeSource` to `'system'`, `'dark'`, or `'light'` to control the theme.

### Q3: How do I support both Apple Silicon (arm64) and Intel (x64)?
Electron: create a universal binary with `--arch=universal`. Tauri: build separately with `--target aarch64-apple-darwin` and `--target x86_64-apple-darwin`, then combine with `lipo`. In CI/CD, building on both a `macos-latest` runner (Apple Silicon) and `macos-13` (Intel) and merging with `lipo -create` is the most reliable method.

### Q4: How do I support multiple Linux distributions?
The AppImage format is the most portable and works on almost all Linux distributions. It is common to additionally provide `.deb` for Debian/Ubuntu and `.rpm` for Fedora/RHEL. Snap and Flatpak are excellent as distribution mechanisms, but be careful about sandbox restrictions.

### Q5: What should I do if native notifications are not displayed on Windows?
On Windows 10/11, you need to correctly set the application ID with `app.setAppUserModelId()`. Also, toast notifications may not appear if no shortcut exists in the Start menu. Either create a shortcut with the NSIS installer, or check in advance with `Notification.isSupported()` during development.

### Q6: How do I handle the issue where file drag & drop paths differ by OS?
Monitor the `will-navigate` event in Electron's `webContents` and normalize the dropped file path with `path.normalize()`. On macOS, the `file://` protocol may be prepended, so extract the path with `new URL(path).pathname`. On Windows, backslashes may need to be converted to forward slashes.

---

## Summary

| Item | Windows | macOS | Linux |
|------|---------|-------|-------|
| Path separator | `\` | `/` | `/` |
| Line ending | `\r\n` | `\n` | `\n` |
| Modifier key | Ctrl | Cmd | Ctrl |
| Menu position | Inside window | Top of screen | Inside window |
| Quit behavior | All windows closed → quit | Window closed → stays resident | All windows closed → quit |
| Case sensitivity | Case-insensitive (NTFS) | Case-insensitive (APFS) | Case-sensitive (ext4) |
| Icon format | .ico | .icns | .png |
| Installer | NSIS / MSI / MSIX | DMG / PKG | AppImage / deb / rpm |
| Notifications | Toast (Win10+) | Notification Center | libnotify |
| Tray | Always supported | Supported | Depends on DE |
| Auto-update | NSIS / Squirrel | DMG / ZIP | AppImage only |
| DPI support | Manual setup may be required | Automatic (Retina) | Manual setup may be required |

---

## Further Reading

---

## References
1. Electron. "Platform Considerations." electronjs.org/docs, 2024.
2. Apple. "Human Interface Guidelines." developer.apple.com/design, 2024.
3. Microsoft. "Windows App Design." learn.microsoft.com, 2024.
4. Tauri. "Cross-Platform Development." tauri.app/guides, 2024.
5. Electron. "Notifications." electronjs.org/docs/latest/tutorial/notifications, 2024.
6. Electron Builder. "Multi-Platform Build." electron.build/multi-platform-build, 2024.
7. freedesktop.org. "Desktop Entry Specification." specifications.freedesktop.org, 2024.

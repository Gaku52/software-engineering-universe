# Leveraging Native Features

> The true value of desktop applications lies in native features. This guide covers deep OS integration including file system access, system notifications, tray icons, auto-start, global shortcuts, clipboard, and drag & drop. It also comprehensively covers Win32 API calls via P/Invoke, registry operations, Windows service integration, Task Scheduler registration, and shell integration in .NET desktop (WPF/WinUI 3).

## What You Will Learn

- [ ] Implement file dialogs and file system operations
- [ ] Utilize system notifications and tray icons
- [ ] Configure global shortcuts and auto-start
- [ ] Understand how to call Win32 APIs via P/Invoke
- [ ] Perform registry operations and environment variable management
- [ ] Implement shell integration (context menus and file associations)
- [ ] Understand patterns for integrating with Windows services


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Architecture Patterns](./01-architecture-patterns.md)

---

## 1. File System Access

```
File Operation Flow:

  User Action           Main Process            OS
  ┌──────┐  IPC      ┌──────────┐  API    ┌────┐
  │Open  │ ──────→ │dialog.   │ ─────→ │FS  │
  │Button│         │showOpen  │        │    │
  │Click │         │Dialog()  │        │    │
  └──────┘          └─────┬────┘        └──┬─┘
                          │ Path            │ Data
                          ▼                │
                    ┌──────────┐           │
                    │fs.read   │ ←─────────┘
                    │File()    │
                    └─────┬────┘
                          │ Content
                    IPC   ▼
  ┌──────┐        ┌──────────┐
  │Editor│ ←───── │Response  │
  │View  │        │Return    │
  └──────┘        └──────────┘
```

### 1.1 Electron Implementation

```typescript
// main.ts — File dialog
import { dialog, ipcMain } from 'electron';
import fs from 'fs/promises';

ipcMain.handle('file:open', async () => {
  const result = await dialog.showOpenDialog({
    title: 'ファイルを開く',
    filters: [
      { name: 'テキスト', extensions: ['txt', 'md'] },
      { name: 'JSON', extensions: ['json'] },
      { name: 'すべて', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (result.canceled || !result.filePaths[0]) return null;

  const filePath = result.filePaths[0];
  const content = await fs.readFile(filePath, 'utf-8');
  return { path: filePath, content };
});

ipcMain.handle('file:save', async (_event, filePath: string, content: string) => {
  await fs.writeFile(filePath, content, 'utf-8');
  return true;
});

ipcMain.handle('file:saveAs', async (_event, content: string) => {
  const result = await dialog.showSaveDialog({
    title: '名前を付けて保存',
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  });

  if (result.canceled || !result.filePath) return null;
  await fs.writeFile(result.filePath, content, 'utf-8');
  return result.filePath;
});

// Batch selection of multiple files
ipcMain.handle('file:openMultiple', async () => {
  const result = await dialog.showOpenDialog({
    title: '複数ファイルを開く',
    filters: [
      { name: '画像', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
    ],
    properties: ['openFile', 'multiSelections'],
  });

  if (result.canceled) return [];

  const files = await Promise.all(
    result.filePaths.map(async (filePath) => {
      const stat = await fs.stat(filePath);
      return {
        path: filePath,
        name: path.basename(filePath),
        size: stat.size,
        lastModified: stat.mtime,
      };
    })
  );

  return files;
});

// Directory selection
ipcMain.handle('file:selectDirectory', async () => {
  const result = await dialog.showOpenDialog({
    title: 'フォルダを選択',
    properties: ['openDirectory', 'createDirectory'],
  });

  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
});
```

### 1.2 Tauri Implementation

```typescript
// Frontend — Tauri file operations
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

async function openFile() {
  const path = await open({
    title: 'ファイルを開く',
    filters: [{ name: 'Text', extensions: ['txt', 'md'] }],
  });
  if (!path) return null;

  const content = await readTextFile(path as string);
  return { path, content };
}

async function saveFile(path: string, content: string) {
  await writeTextFile(path, content);
}
```

### 1.3 File Dialogs in WPF/WinUI 3

```csharp
// WPF — File dialog using Microsoft.Win32
using Microsoft.Win32;

public class FileDialogService : IFileDialogService
{
    public string? OpenFile(string title, string filter)
    {
        var dialog = new OpenFileDialog
        {
            Title = title,
            Filter = filter,
            // Example: "テキストファイル (*.txt)|*.txt|すべてのファイル (*.*)|*.*"
            CheckFileExists = true,
            Multiselect = false,
            InitialDirectory = Environment.GetFolderPath(
                Environment.SpecialFolder.MyDocuments),
        };

        return dialog.ShowDialog() == true ? dialog.FileName : null;
    }

    public string[]? OpenFiles(string title, string filter)
    {
        var dialog = new OpenFileDialog
        {
            Title = title,
            Filter = filter,
            Multiselect = true,
        };

        return dialog.ShowDialog() == true ? dialog.FileNames : null;
    }

    public string? SaveFile(string title, string filter, string defaultFileName)
    {
        var dialog = new SaveFileDialog
        {
            Title = title,
            Filter = filter,
            FileName = defaultFileName,
            OverwritePrompt = true,
        };

        return dialog.ShowDialog() == true ? dialog.FileName : null;
    }

    public string? SelectFolder(string title)
    {
        // FolderBrowserDialog has been improved in .NET 8 and later
        var dialog = new OpenFolderDialog
        {
            Title = title,
            Multiselect = false,
        };

        return dialog.ShowDialog() == true ? dialog.FolderName : null;
    }
}
```

```csharp
// WinUI 3 — Windows.Storage.Pickers
using Windows.Storage.Pickers;
using WinRT.Interop;

public class WinUIFileDialogService : IFileDialogService
{
    private readonly Window _window;

    public WinUIFileDialogService(Window window)
    {
        _window = window;
    }

    public async Task<StorageFile?> OpenFileAsync()
    {
        var picker = new FileOpenPicker();
        picker.FileTypeFilter.Add(".txt");
        picker.FileTypeFilter.Add(".md");
        picker.FileTypeFilter.Add(".json");

        // WinUI 3 requires setting the HWND
        var hwnd = WindowNative.GetWindowHandle(_window);
        InitializeWithWindow.Initialize(picker, hwnd);

        return await picker.PickSingleFileAsync();
    }

    public async Task<StorageFile?> SaveFileAsync(string suggestedName)
    {
        var picker = new FileSavePicker();
        picker.SuggestedFileName = suggestedName;
        picker.FileTypeChoices.Add("Markdown", new List<string> { ".md" });
        picker.FileTypeChoices.Add("テキスト", new List<string> { ".txt" });

        var hwnd = WindowNative.GetWindowHandle(_window);
        InitializeWithWindow.Initialize(picker, hwnd);

        return await picker.PickSaveFileAsync();
    }

    public async Task<StorageFolder?> SelectFolderAsync()
    {
        var picker = new FolderPicker();
        picker.FileTypeFilter.Add("*");

        var hwnd = WindowNative.GetWindowHandle(_window);
        InitializeWithWindow.Initialize(picker, hwnd);

        return await picker.PickSingleFolderAsync();
    }
}
```

### 1.4 File Monitoring (FileSystemWatcher)

```csharp
// Real-time monitoring of file system changes
using System.IO;

public class FileWatcherService : IDisposable
{
    private readonly FileSystemWatcher _watcher;
    private readonly Subject<FileChangeEvent> _changes = new();

    public IObservable<FileChangeEvent> Changes => _changes.AsObservable();

    public FileWatcherService(string directoryPath, string filter = "*.*")
    {
        _watcher = new FileSystemWatcher(directoryPath)
        {
            Filter = filter,
            NotifyFilter = NotifyFilters.FileName
                | NotifyFilters.LastWrite
                | NotifyFilters.Size
                | NotifyFilters.CreationTime,
            IncludeSubdirectories = true,
            EnableRaisingEvents = true,
        };

        _watcher.Created += (s, e) => _changes.OnNext(
            new FileChangeEvent(e.FullPath, FileChangeType.Created));
        _watcher.Changed += (s, e) => _changes.OnNext(
            new FileChangeEvent(e.FullPath, FileChangeType.Modified));
        _watcher.Deleted += (s, e) => _changes.OnNext(
            new FileChangeEvent(e.FullPath, FileChangeType.Deleted));
        _watcher.Renamed += (s, e) => _changes.OnNext(
            new FileChangeEvent(e.FullPath, FileChangeType.Renamed, e.OldFullPath));
        _watcher.Error += (s, e) => _changes.OnError(e.GetException());
    }

    public void Dispose()
    {
        _watcher.EnableRaisingEvents = false;
        _watcher.Dispose();
        _changes.Dispose();
    }
}

public record FileChangeEvent(
    string Path,
    FileChangeType Type,
    string? OldPath = null);

public enum FileChangeType { Created, Modified, Deleted, Renamed }
```

```csharp
// Electron — File monitoring
// main.ts
import { watch } from 'chokidar';

const watcher = watch('/path/to/watch', {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 300,
    pollInterval: 100,
  },
});

watcher.on('change', (path) => {
  mainWindow?.webContents.send('file:changed', { path, type: 'change' });
});
watcher.on('add', (path) => {
  mainWindow?.webContents.send('file:changed', { path, type: 'add' });
});
watcher.on('unlink', (path) => {
  mainWindow?.webContents.send('file:changed', { path, type: 'unlink' });
});
```

---

## 2. System Notifications

```typescript
// Electron — Notifications
import { Notification } from 'electron';

function showNotification(title: string, body: string) {
  const notification = new Notification({
    title,
    body,
    icon: path.join(__dirname, 'assets/icon.png'),
    silent: false,
  });

  notification.on('click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  notification.show();
}

// Tauri — Notifications
import { sendNotification, requestPermission, isPermissionGranted }
  from '@tauri-apps/plugin-notification';

async function notify(title: string, body: string) {
  let granted = await isPermissionGranted();
  if (!granted) {
    const permission = await requestPermission();
    granted = permission === 'granted';
  }
  if (granted) {
    sendNotification({ title, body });
  }
}
```

### 2.1 .NET Desktop Notifications

```csharp
// WinUI 3 — Toast notifications using AppNotificationManager
using Microsoft.Windows.AppNotifications;
using Microsoft.Windows.AppNotifications.Builder;

public class NotificationService
{
    public void Initialize()
    {
        // Initialize the notification manager
        AppNotificationManager.Default.NotificationInvoked += OnNotificationInvoked;
        AppNotificationManager.Default.Register();
    }

    /// <summary>
    /// Show a simple toast notification
    /// </summary>
    public void ShowSimple(string title, string message)
    {
        var builder = new AppNotificationBuilder()
            .AddText(title)
            .AddText(message);

        var notification = builder.BuildNotification();
        AppNotificationManager.Default.Show(notification);
    }

    /// <summary>
    /// Toast notification with action buttons
    /// </summary>
    public void ShowWithActions(string title, string message,
        params (string Label, string ActionId)[] actions)
    {
        var builder = new AppNotificationBuilder()
            .AddText(title)
            .AddText(message);

        foreach (var (label, actionId) in actions)
        {
            builder.AddButton(new AppNotificationButton(label)
                .AddArgument("action", actionId));
        }

        var notification = builder.BuildNotification();
        AppNotificationManager.Default.Show(notification);
    }

    /// <summary>
    /// Notification with progress bar
    /// </summary>
    public void ShowProgress(string title, double progress, string status)
    {
        var builder = new AppNotificationBuilder()
            .AddText(title)
            .AddProgressBar(new AppNotificationProgressBar()
            {
                Title = "ダウンロード中",
                Value = progress,
                ValueStringOverride = $"{progress * 100:F0}%",
                Status = status,
            });

        var notification = builder.BuildNotification();
        notification.Tag = "download-progress";
        notification.Group = "downloads";
        AppNotificationManager.Default.Show(notification);
    }

    /// <summary>
    /// Notification with image
    /// </summary>
    public void ShowWithImage(string title, string message, string imagePath)
    {
        var builder = new AppNotificationBuilder()
            .AddText(title)
            .AddText(message)
            .SetInlineImage(new Uri(imagePath));

        var notification = builder.BuildNotification();
        AppNotificationManager.Default.Show(notification);
    }

    private void OnNotificationInvoked(
        AppNotificationManager sender,
        AppNotificationActivatedEventArgs args)
    {
        // Handles notification click or action button press
        var actionId = args.Arguments.ContainsKey("action")
            ? args.Arguments["action"]
            : "default";

        // Process on UI thread
        App.MainWindow.DispatcherQueue.TryEnqueue(() =>
        {
            HandleNotificationAction(actionId);
        });
    }

    private void HandleNotificationAction(string actionId)
    {
        switch (actionId)
        {
            case "open-file":
                // Handle file open
                break;
            case "dismiss":
                // Dismiss the notification
                break;
            default:
                // Bring app to foreground
                App.MainWindow.Activate();
                break;
        }
    }

    public void Cleanup()
    {
        AppNotificationManager.Default.Unregister();
    }
}
```

```xml
<!-- XML-based toast notification template (advanced customization) -->
<!--
<toast launch="action=viewConversation&amp;conversationId=9813">
  <visual>
    <binding template="ToastGeneric">
      <text>新着メッセージ</text>
      <text>田中さんからメッセージが届きました</text>
      <image placement="appLogoOverride"
             hint-crop="circle"
             src="ms-appx:///Assets/user-avatar.png"/>
    </binding>
  </visual>
  <actions>
    <input id="replyBox" type="text" placeHolderContent="返信を入力..." />
    <action content="送信"
            arguments="action=reply&amp;conversationId=9813"
            activationType="background"
            hint-inputId="replyBox" />
    <action content="既読にする"
            arguments="action=markRead&amp;conversationId=9813"
            activationType="background" />
  </actions>
  <audio src="ms-winsoundevent:Notification.IM" />
</toast>
-->
```

---

## 3. System Tray

```typescript
// Electron — Tray icon
import { Tray, Menu, nativeImage } from 'electron';

let tray: Tray | null = null;

function createTray() {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, 'assets/tray-icon.png')
  );
  // macOS: 16x16 or 22x22, Windows: 16x16
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    { label: '表示', click: () => mainWindow?.show() },
    { label: '設定', click: () => openSettings() },
    { type: 'separator' },
    { label: '終了', click: () => app.quit() },
  ]);

  tray.setToolTip('My App');
  tray.setContextMenu(contextMenu);

  // Show window on click
  tray.on('click', () => {
    mainWindow?.isVisible() ? mainWindow.hide() : mainWindow?.show();
  });
}
```

### 3.1 .NET WPF System Tray

```csharp
// WPF — System tray using NotifyIcon
// NuGet: Hardcodet.NotifyIcon.Wpf
using Hardcodet.Wpf.TaskbarNotification;
using System.Windows;

public partial class App : Application
{
    private TaskbarIcon? _trayIcon;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        _trayIcon = new TaskbarIcon
        {
            IconSource = new BitmapImage(
                new Uri("pack://application:,,,/Assets/tray-icon.ico")),
            ToolTipText = "My Application",
        };

        // Create the context menu
        var contextMenu = new ContextMenu();
        contextMenu.Items.Add(new MenuItem
        {
            Header = "表示",
            Command = new RelayCommand(() => MainWindow?.Show()),
        });
        contextMenu.Items.Add(new MenuItem
        {
            Header = "設定",
            Command = new RelayCommand(OpenSettings),
        });
        contextMenu.Items.Add(new Separator());
        contextMenu.Items.Add(new MenuItem
        {
            Header = "終了",
            Command = new RelayCommand(() => Shutdown()),
        });

        _trayIcon.ContextMenu = contextMenu;

        // Show window on double-click
        _trayIcon.TrayMouseDoubleClick += (s, _) =>
        {
            MainWindow?.Show();
            MainWindow?.Activate();
        };

        // Show balloon notification
        _trayIcon.ShowBalloonTip(
            "アプリ起動",
            "バックグラウンドで実行中です",
            BalloonIcon.Info);
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _trayIcon?.Dispose();
        base.OnExit(e);
    }
}

// Change window minimize behavior to hide in tray
public partial class MainWindow : Window
{
    protected override void OnClosing(CancelEventArgs e)
    {
        // Hide the window on close button (do not exit)
        e.Cancel = true;
        this.Hide();
    }
}
```

### 3.2 WinUI 3 System Tray

```csharp
// WinUI 3 — System tray using H.NotifyIcon
// NuGet: H.NotifyIcon.WinUI
using H.NotifyIcon;

public sealed partial class MainWindow : Window
{
    private TaskbarIcon? _trayIcon;

    public MainWindow()
    {
        InitializeComponent();
        SetupTrayIcon();
    }

    private void SetupTrayIcon()
    {
        _trayIcon = new TaskbarIcon
        {
            // Set icon
            Icon = new System.Drawing.Icon("Assets/tray-icon.ico"),
            ToolTipText = "My WinUI App",
        };

        // Menu flyout (WinUI 3 style)
        var flyout = new MenuFlyout();

        var showItem = new MenuFlyoutItem { Text = "表示" };
        showItem.Click += (_, _) =>
        {
            this.Activate();
            // Bring window to the front
            var hwnd = WindowNative.GetWindowHandle(this);
            SetForegroundWindow(hwnd);
        };
        flyout.Items.Add(showItem);

        flyout.Items.Add(new MenuFlyoutSeparator());

        var exitItem = new MenuFlyoutItem { Text = "終了" };
        exitItem.Click += (_, _) =>
        {
            _trayIcon?.Dispose();
            this.Close();
        };
        flyout.Items.Add(exitItem);

        _trayIcon.ContextFlyout = flyout;

        // Double-click
        _trayIcon.TrayMouseDoubleClick += (_, _) => this.Activate();
    }

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);
}
```

---

## 4. Global Shortcuts

```typescript
// Electron — Global shortcuts
import { globalShortcut } from 'electron';

app.whenReady().then(() => {
  // Show/hide app with Ctrl+Shift+Space
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
```

### 4.1 .NET Global Hotkeys

```csharp
// Global hotkey registration using Win32 API
using System.Runtime.InteropServices;
using System.Windows.Interop;

public class GlobalHotKey : IDisposable
{
    [DllImport("user32.dll")]
    private static extern bool RegisterHotKey(
        IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll")]
    private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    private const int WM_HOTKEY = 0x0312;

    // Modifier key constants
    public const uint MOD_ALT = 0x0001;
    public const uint MOD_CONTROL = 0x0002;
    public const uint MOD_SHIFT = 0x0004;
    public const uint MOD_WIN = 0x0008;
    public const uint MOD_NOREPEAT = 0x4000;

    private readonly IntPtr _hwnd;
    private readonly Dictionary<int, Action> _hotkeys = new();
    private int _nextId = 1;
    private HwndSource? _source;

    public GlobalHotKey(Window window)
    {
        var interopHelper = new WindowInteropHelper(window);
        _hwnd = interopHelper.Handle;

        // Set up message hook
        _source = HwndSource.FromHwnd(_hwnd);
        _source?.AddHook(WndProc);
    }

    /// <summary>
    /// Register a global hotkey
    /// </summary>
    public int Register(uint modifiers, uint key, Action callback)
    {
        var id = _nextId++;
        if (!RegisterHotKey(_hwnd, id, modifiers | MOD_NOREPEAT, key))
        {
            throw new InvalidOperationException(
                $"Failed to register hotkey (error: {Marshal.GetLastWin32Error()})");
        }
        _hotkeys[id] = callback;
        return id;
    }

    /// <summary>
    /// Unregister a specific hotkey
    /// </summary>
    public void Unregister(int id)
    {
        UnregisterHotKey(_hwnd, id);
        _hotkeys.Remove(id);
    }

    private IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam,
        IntPtr lParam, ref bool handled)
    {
        if (msg == WM_HOTKEY)
        {
            int id = wParam.ToInt32();
            if (_hotkeys.TryGetValue(id, out var callback))
            {
                callback();
                handled = true;
            }
        }
        return IntPtr.Zero;
    }

    public void Dispose()
    {
        foreach (var id in _hotkeys.Keys.ToList())
        {
            UnregisterHotKey(_hwnd, id);
        }
        _hotkeys.Clear();
        _source?.RemoveHook(WndProc);
    }
}

// Usage example
public partial class MainWindow : Window
{
    private GlobalHotKey? _hotkey;

    protected override void OnSourceInitialized(EventArgs e)
    {
        base.OnSourceInitialized(e);

        _hotkey = new GlobalHotKey(this);

        // Toggle show/hide with Ctrl+Shift+Space
        _hotkey.Register(
            GlobalHotKey.MOD_CONTROL | GlobalHotKey.MOD_SHIFT,
            0x20, // VK_SPACE
            () =>
            {
                if (IsVisible)
                {
                    Hide();
                }
                else
                {
                    Show();
                    Activate();
                }
            });

        // Create new with Ctrl+Alt+N
        _hotkey.Register(
            GlobalHotKey.MOD_CONTROL | GlobalHotKey.MOD_ALT,
            0x4E, // VK_N
            () =>
            {
                Show();
                Activate();
                CreateNewDocument();
            });
    }

    protected override void OnClosed(EventArgs e)
    {
        _hotkey?.Dispose();
        base.OnClosed(e);
    }
}
```

---

## 5. Auto-Start

```typescript
// Electron — Auto-start at login
import { app } from 'electron';

function setAutoLaunch(enabled: boolean) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true, // macOS: launch hidden
    args: ['--hidden'],  // Windows: arguments
  });
}

function getAutoLaunchStatus(): boolean {
  return app.getLoginItemSettings().openAtLogin;
}
```

### 5.1 .NET Auto-Start Configuration

```csharp
// Auto-start configuration using registry (Windows)
using Microsoft.Win32;

public class AutoStartService
{
    private const string RunKey = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
    private readonly string _appName;
    private readonly string _appPath;

    public AutoStartService(string appName)
    {
        _appName = appName;
        _appPath = Environment.ProcessPath
            ?? throw new InvalidOperationException("Cannot determine process path");
    }

    /// <summary>
    /// Enable or disable auto-start
    /// </summary>
    public void SetAutoStart(bool enabled)
    {
        using var key = Registry.CurrentUser.OpenSubKey(RunKey, writable: true);
        if (key is null) return;

        if (enabled)
        {
            key.SetValue(_appName, $"\"{_appPath}\" --minimized");
        }
        else
        {
            key.DeleteValue(_appName, throwOnMissingValue: false);
        }
    }

    /// <summary>
    /// Get whether auto-start is enabled
    /// </summary>
    public bool IsAutoStartEnabled()
    {
        using var key = Registry.CurrentUser.OpenSubKey(RunKey);
        return key?.GetValue(_appName) is not null;
    }
}

// Auto-start using Task Scheduler (no admin rights required, more advanced control)
using System.Diagnostics;

public class TaskSchedulerAutoStart
{
    private readonly string _taskName;
    private readonly string _appPath;

    public TaskSchedulerAutoStart(string taskName)
    {
        _taskName = taskName;
        _appPath = Environment.ProcessPath!;
    }

    /// <summary>
    /// Register a task to run at logon
    /// </summary>
    public void Register()
    {
        // Create task using schtasks command
        var args = $"/create /tn \"{_taskName}\" " +
                   $"/tr \"\\\"{_appPath}\\\" --minimized\" " +
                   "/sc onlogon /rl limited /f";

        var process = Process.Start(new ProcessStartInfo
        {
            FileName = "schtasks.exe",
            Arguments = args,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        });

        process?.WaitForExit();
    }

    /// <summary>
    /// Delete the task
    /// </summary>
    public void Unregister()
    {
        var process = Process.Start(new ProcessStartInfo
        {
            FileName = "schtasks.exe",
            Arguments = $"/delete /tn \"{_taskName}\" /f",
            UseShellExecute = false,
            CreateNoWindow = true,
        });
        process?.WaitForExit();
    }

    /// <summary>
    /// Check if the task is registered
    /// </summary>
    public bool IsRegistered()
    {
        var process = Process.Start(new ProcessStartInfo
        {
            FileName = "schtasks.exe",
            Arguments = $"/query /tn \"{_taskName}\"",
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        });

        process?.WaitForExit();
        return process?.ExitCode == 0;
    }
}
```

---

## 6. Clipboard and Drag & Drop

```typescript
// Electron — Clipboard
import { clipboard } from 'electron';

ipcMain.handle('clipboard:read', () => clipboard.readText());
ipcMain.handle('clipboard:write', (_e, text: string) => clipboard.writeText(text));
ipcMain.handle('clipboard:readImage', () => {
  const image = clipboard.readImage();
  return image.isEmpty() ? null : image.toDataURL();
});

// Renderer — Drag & Drop
// React component
function DropZone() {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      console.log('Dropped:', file.path, file.name, file.size);
    });
  };

  return (
    <div
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
      style={{ border: '2px dashed #ccc', padding: 40 }}
    >
      ファイルをドロップ
    </div>
  );
}
```

### 6.1 .NET Clipboard Operations

```csharp
// WPF — Clipboard operations
using System.Windows;

public class ClipboardService : IClipboardService
{
    /// <summary>
    /// Copy text to clipboard
    /// </summary>
    public void CopyText(string text)
    {
        Clipboard.SetText(text);
    }

    /// <summary>
    /// Get text from clipboard
    /// </summary>
    public string? PasteText()
    {
        return Clipboard.ContainsText() ? Clipboard.GetText() : null;
    }

    /// <summary>
    /// Copy image to clipboard
    /// </summary>
    public void CopyImage(BitmapSource image)
    {
        Clipboard.SetImage(image);
    }

    /// <summary>
    /// Get image from clipboard
    /// </summary>
    public BitmapSource? PasteImage()
    {
        return Clipboard.ContainsImage() ? Clipboard.GetImage() : null;
    }

    /// <summary>
    /// Copy file paths to clipboard (equivalent to Explorer copy)
    /// </summary>
    public void CopyFiles(IEnumerable<string> filePaths)
    {
        var collection = new System.Collections.Specialized.StringCollection();
        foreach (var path in filePaths)
        {
            collection.Add(path);
        }
        Clipboard.SetFileDropList(collection);
    }

    /// <summary>
    /// Set multiple format data to clipboard
    /// </summary>
    public void CopyRichContent(string plainText, string htmlText)
    {
        var dataObject = new DataObject();
        dataObject.SetText(plainText, TextDataFormat.UnicodeText);
        dataObject.SetText(htmlText, TextDataFormat.Html);
        Clipboard.SetDataObject(dataObject, copy: true);
    }

    /// <summary>
    /// Monitor clipboard changes
    /// </summary>
    public void StartMonitoring(Action onClipboardChanged)
    {
        // Monitor clipboard changes using Win32 API
        // Uses AddClipboardFormatListener
        ClipboardMonitor.Start(onClipboardChanged);
    }
}
```

### 6.2 .NET Drag & Drop

```xml
<!-- WPF — Drag & drop XAML -->
<Border
    AllowDrop="True"
    Drop="OnDrop"
    DragEnter="OnDragEnter"
    DragLeave="OnDragLeave"
    BorderBrush="{Binding DropBorderBrush}"
    BorderThickness="2"
    BorderDashStyle="Dash"
    Padding="40">
    <TextBlock Text="ファイルをここにドロップ"
               HorizontalAlignment="Center"
               VerticalAlignment="Center" />
</Border>
```

```csharp
// WPF — Drag & drop code-behind
public partial class DropZoneControl : UserControl
{
    public DropZoneControl()
    {
        InitializeComponent();
        AllowDrop = true;
    }

    private void OnDragEnter(object sender, DragEventArgs e)
    {
        if (e.Data.GetDataPresent(DataFormats.FileDrop))
        {
            e.Effects = DragDropEffects.Copy;
            // Highlight the drop zone
            DropBorder.BorderBrush = Brushes.DodgerBlue;
            DropBorder.Background = new SolidColorBrush(
                Color.FromArgb(30, 30, 144, 255));
        }
        else
        {
            e.Effects = DragDropEffects.None;
        }
        e.Handled = true;
    }

    private void OnDragLeave(object sender, DragEventArgs e)
    {
        DropBorder.BorderBrush = Brushes.Gray;
        DropBorder.Background = Brushes.Transparent;
    }

    private async void OnDrop(object sender, DragEventArgs e)
    {
        DropBorder.BorderBrush = Brushes.Gray;
        DropBorder.Background = Brushes.Transparent;

        if (e.Data.GetDataPresent(DataFormats.FileDrop))
        {
            var files = (string[])e.Data.GetData(DataFormats.FileDrop)!;
            foreach (var filePath in files)
            {
                var fileInfo = new FileInfo(filePath);
                StatusText.Text = $"受信: {fileInfo.Name} ({fileInfo.Length:N0} bytes)";

                // Process the file
                await ProcessDroppedFileAsync(filePath);
            }
        }
    }

    // Drag source implementation (dragging items from a list)
    private void ListItem_MouseMove(object sender, MouseEventArgs e)
    {
        if (e.LeftButton == MouseButtonState.Pressed)
        {
            if (sender is FrameworkElement element &&
                element.DataContext is FileItem item)
            {
                var data = new DataObject(DataFormats.FileDrop,
                    new string[] { item.FullPath });
                DragDrop.DoDragDrop(element, data, DragDropEffects.Copy);
            }
        }
    }
}
```

---

## 7. Registry Operations

```csharp
// Reading and writing the Windows registry
using Microsoft.Win32;

public class RegistryService
{
    private readonly string _appKey;

    public RegistryService(string appName)
    {
        _appKey = $@"SOFTWARE\{appName}";
    }

    /// <summary>
    /// Save application settings to registry
    /// </summary>
    public void SaveSetting(string name, object value)
    {
        using var key = Registry.CurrentUser.CreateSubKey(_appKey);
        key.SetValue(name, value);
    }

    /// <summary>
    /// Read application settings from registry
    /// </summary>
    public T? ReadSetting<T>(string name, T? defaultValue = default)
    {
        using var key = Registry.CurrentUser.OpenSubKey(_appKey);
        var value = key?.GetValue(name);

        if (value is null) return defaultValue;

        return (T)Convert.ChangeType(value, typeof(T));
    }

    /// <summary>
    /// Delete all registry keys for the application
    /// </summary>
    public void DeleteAllSettings()
    {
        Registry.CurrentUser.DeleteSubKeyTree(_appKey, throwOnMissingSubKey: false);
    }

    /// <summary>
    /// Register a file association
    /// </summary>
    public void RegisterFileAssociation(
        string extension,
        string progId,
        string description,
        string appPath,
        string iconPath)
    {
        // Register the extension
        using (var extKey = Registry.CurrentUser.CreateSubKey(
            $@"SOFTWARE\Classes\{extension}"))
        {
            extKey.SetValue("", progId);
        }

        // Register the ProgID
        using (var progKey = Registry.CurrentUser.CreateSubKey(
            $@"SOFTWARE\Classes\{progId}"))
        {
            progKey.SetValue("", description);

            using (var iconKey = progKey.CreateSubKey("DefaultIcon"))
            {
                iconKey.SetValue("", $"\"{iconPath}\",0");
            }

            using (var commandKey = progKey.CreateSubKey(@"shell\open\command"))
            {
                commandKey.SetValue("", $"\"{appPath}\" \"%1\"");
            }
        }

        // Notify the shell
        SHChangeNotify(0x08000000, 0, IntPtr.Zero, IntPtr.Zero);
    }

    [DllImport("shell32.dll")]
    private static extern void SHChangeNotify(
        int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);
}
```

---

## 8. Shell Integration

```csharp
// Add an entry to Explorer's context menu
public class ContextMenuRegistration
{
    /// <summary>
    /// Add app entry to right-click menu
    /// </summary>
    public static void Register(
        string appName,
        string appPath,
        string menuText,
        string iconPath,
        string[] extensions)
    {
        foreach (var ext in extensions)
        {
            var keyPath = $@"SOFTWARE\Classes\{ext}\shell\{appName}";

            using var key = Registry.CurrentUser.CreateSubKey(keyPath);
            key.SetValue("", menuText);
            key.SetValue("Icon", $"\"{iconPath}\"");

            using var commandKey = key.CreateSubKey("command");
            commandKey.SetValue("", $"\"{appPath}\" \"%1\"");
        }
    }

    /// <summary>
    /// Add to directory right-click menu
    /// </summary>
    public static void RegisterForDirectories(
        string appName,
        string appPath,
        string menuText)
    {
        var keyPath = $@"SOFTWARE\Classes\Directory\shell\{appName}";
        using var key = Registry.CurrentUser.CreateSubKey(keyPath);
        key.SetValue("", menuText);

        using var commandKey = key.CreateSubKey("command");
        commandKey.SetValue("", $"\"{appPath}\" \"%V\"");

        // Also add to background right-click menu
        var bgKeyPath = $@"SOFTWARE\Classes\Directory\Background\shell\{appName}";
        using var bgKey = Registry.CurrentUser.CreateSubKey(bgKeyPath);
        bgKey.SetValue("", menuText);

        using var bgCommandKey = bgKey.CreateSubKey("command");
        bgCommandKey.SetValue("", $"\"{appPath}\" \"%V\"");
    }

    /// <summary>
    /// Remove context menu entries
    /// </summary>
    public static void Unregister(string appName, string[] extensions)
    {
        foreach (var ext in extensions)
        {
            var keyPath = $@"SOFTWARE\Classes\{ext}\shell\{appName}";
            Registry.CurrentUser.DeleteSubKeyTree(keyPath,
                throwOnMissingSubKey: false);
        }

        Registry.CurrentUser.DeleteSubKeyTree(
            $@"SOFTWARE\Classes\Directory\shell\{appName}",
            throwOnMissingSubKey: false);
        Registry.CurrentUser.DeleteSubKeyTree(
            $@"SOFTWARE\Classes\Directory\Background\shell\{appName}",
            throwOnMissingSubKey: false);
    }
}
```

```csharp
// Windows Jump List (taskbar right-click menu)
// WPF implementation
using System.Windows.Shell;

public class JumpListService
{
    public void SetupJumpList()
    {
        var jumpList = new JumpList();

        // Recent files category
        jumpList.ShowRecentCategory = true;

        // Custom tasks
        jumpList.JumpItems.Add(new JumpTask
        {
            Title = "新規ドキュメント",
            Description = "新しいドキュメントを作成します",
            ApplicationPath = Environment.ProcessPath!,
            Arguments = "--new",
            IconResourcePath = Environment.ProcessPath!,
            IconResourceIndex = 0,
        });

        jumpList.JumpItems.Add(new JumpTask
        {
            Title = "設定を開く",
            Description = "アプリケーション設定を開きます",
            ApplicationPath = Environment.ProcessPath!,
            Arguments = "--settings",
        });

        // Custom category
        jumpList.JumpItems.Add(new JumpTask
        {
            Title = "テンプレート A",
            CustomCategory = "テンプレート",
            ApplicationPath = Environment.ProcessPath!,
            Arguments = "--template A",
        });

        JumpList.SetJumpList(Application.Current, jumpList);
    }

    /// <summary>
    /// Add a recently used file to the jump list
    /// </summary>
    public void AddRecentFile(string filePath)
    {
        JumpList.AddToRecentCategory(filePath);
    }
}
```

---

## 9. P/Invoke for Win32 APIs

```csharp
// Collection of common Win32 API P/Invoke definitions
using System.Runtime.InteropServices;

public static partial class NativeMethods
{
    // Bring window to foreground
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    // Change window visibility state
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    // Check if window is minimized
    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    // Flash (blink in taskbar)
    [DllImport("user32.dll")]
    public static extern bool FlashWindowEx(ref FLASHWINFO pwfi);

    // Get monitor information
    [DllImport("user32.dll")]
    public static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);

    [DllImport("user32.dll")]
    public static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint dwFlags);

    // Get DPI
    [DllImport("shcore.dll")]
    public static extern int GetDpiForMonitor(
        IntPtr hMonitor, int dpiType, out uint dpiX, out uint dpiY);

    // Get power status
    [DllImport("kernel32.dll")]
    public static extern bool GetSystemPowerStatus(
        out SYSTEM_POWER_STATUS lpSystemPowerStatus);

    // Set process priority
    [DllImport("kernel32.dll")]
    public static extern bool SetPriorityClass(IntPtr hProcess, uint dwPriorityClass);

    // Check file lock state
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr CreateFile(
        string lpFileName, uint dwDesiredAccess,
        uint dwShareMode, IntPtr lpSecurityAttributes,
        uint dwCreationDisposition, uint dwFlagsAndAttributes,
        IntPtr hTemplateFile);

    // Constants
    public const int SW_SHOW = 5;
    public const int SW_MINIMIZE = 6;
    public const int SW_RESTORE = 9;
    public const uint MONITOR_DEFAULTTONEAREST = 2;
}

[StructLayout(LayoutKind.Sequential)]
public struct FLASHWINFO
{
    public uint cbSize;
    public IntPtr hwnd;
    public uint dwFlags;
    public uint uCount;
    public uint dwTimeout;
}

[StructLayout(LayoutKind.Sequential)]
public struct MONITORINFO
{
    public int cbSize;
    public RECT rcMonitor;
    public RECT rcWork;
    public uint dwFlags;
}

[StructLayout(LayoutKind.Sequential)]
public struct RECT
{
    public int Left, Top, Right, Bottom;
}

[StructLayout(LayoutKind.Sequential)]
public struct SYSTEM_POWER_STATUS
{
    public byte ACLineStatus;
    public byte BatteryFlag;
    public byte BatteryLifePercent;
    public byte SystemStatusFlag;
    public int BatteryLifeTime;
    public int BatteryFullLifeTime;
}
```

```csharp
// P/Invoke usage example — Window flash notification
public static class WindowFlasher
{
    private const uint FLASHW_STOP = 0;
    private const uint FLASHW_CAPTION = 1;
    private const uint FLASHW_TRAY = 2;
    private const uint FLASHW_ALL = FLASHW_CAPTION | FLASHW_TRAY;
    private const uint FLASHW_TIMER = 4;
    private const uint FLASHW_TIMERNOFG = 12;

    /// <summary>
    /// Flash the window in the taskbar to get attention
    /// </summary>
    public static void Flash(IntPtr hwnd, uint count = 5)
    {
        var info = new FLASHWINFO
        {
            cbSize = (uint)Marshal.SizeOf<FLASHWINFO>(),
            hwnd = hwnd,
            dwFlags = FLASHW_ALL | FLASHW_TIMERNOFG,
            uCount = count,
            dwTimeout = 0,
        };

        NativeMethods.FlashWindowEx(ref info);
    }

    /// <summary>
    /// Stop flashing
    /// </summary>
    public static void StopFlash(IntPtr hwnd)
    {
        var info = new FLASHWINFO
        {
            cbSize = (uint)Marshal.SizeOf<FLASHWINFO>(),
            hwnd = hwnd,
            dwFlags = FLASHW_STOP,
        };

        NativeMethods.FlashWindowEx(ref info);
    }
}

// Power status monitoring
public class PowerMonitor
{
    /// <summary>
    /// Get battery percentage
    /// </summary>
    public static int GetBatteryPercentage()
    {
        NativeMethods.GetSystemPowerStatus(out var status);
        return status.BatteryLifePercent;
    }

    /// <summary>
    /// Check if connected to AC power
    /// </summary>
    public static bool IsOnAcPower()
    {
        NativeMethods.GetSystemPowerStatus(out var status);
        return status.ACLineStatus == 1;
    }
}
```

---

## 10. Single Instance Control

```csharp
// Prevent multiple instances of the app
using System.Threading;

public class SingleInstanceGuard : IDisposable
{
    private readonly Mutex _mutex;
    private bool _hasHandle;

    public SingleInstanceGuard(string appId)
    {
        _mutex = new Mutex(false, $"Global\\{appId}");
    }

    /// <summary>
    /// Check that no other instance is running
    /// </summary>
    public bool TryAcquire()
    {
        try
        {
            _hasHandle = _mutex.WaitOne(0, false);
            return _hasHandle;
        }
        catch (AbandonedMutexException)
        {
            _hasHandle = true;
            return true;
        }
    }

    public void Dispose()
    {
        if (_hasHandle)
        {
            _mutex.ReleaseMutex();
        }
        _mutex.Dispose();
    }
}

// Usage in App.xaml.cs
public partial class App : Application
{
    private SingleInstanceGuard? _guard;

    protected override void OnStartup(StartupEventArgs e)
    {
        _guard = new SingleInstanceGuard("com.mycompany.myapp");

        if (!_guard.TryAcquire())
        {
            // Activate the existing instance
            ActivateExistingInstance();
            Shutdown();
            return;
        }

        base.OnStartup(e);
    }

    private void ActivateExistingInstance()
    {
        // Notify the existing instance via named pipe
        using var client = new NamedPipeClientStream(".", "MyApp-IPC",
            PipeDirection.Out);
        try
        {
            client.Connect(1000);
            using var writer = new StreamWriter(client);
            writer.WriteLine("ACTIVATE");
            // Forward command-line arguments as well
            writer.WriteLine(string.Join("|", Environment.GetCommandLineArgs()));
        }
        catch (TimeoutException)
        {
            MessageBox.Show("アプリケーションは既に実行中です。");
        }
    }
}

// Listener for the existing instance
public class SingleInstanceListener : IDisposable
{
    private readonly CancellationTokenSource _cts = new();

    public event Action<string[]>? ArgumentsReceived;

    public void Start()
    {
        Task.Run(async () =>
        {
            while (!_cts.Token.IsCancellationRequested)
            {
                using var server = new NamedPipeServerStream("MyApp-IPC",
                    PipeDirection.In, 1);
                await server.WaitForConnectionAsync(_cts.Token);

                using var reader = new StreamReader(server);
                var command = await reader.ReadLineAsync();
                var argsLine = await reader.ReadLineAsync();

                if (command == "ACTIVATE")
                {
                    var args = argsLine?.Split('|') ?? Array.Empty<string>();
                    ArgumentsReceived?.Invoke(args);
                }
            }
        }, _cts.Token);
    }

    public void Dispose()
    {
        _cts.Cancel();
        _cts.Dispose();
    }
}
```

---

## 11. Print Functionality

```csharp
// WPF — Implementing print functionality
using System.Printing;
using System.Windows.Controls;
using System.Windows.Documents;

public class PrintService
{
    /// <summary>
    /// Show a print dialog and print the document
    /// </summary>
    public bool PrintDocument(FlowDocument document, string title)
    {
        var printDialog = new PrintDialog();

        if (printDialog.ShowDialog() != true)
            return false;

        // Convert FlowDocument to DocumentPaginator
        var paginator = ((IDocumentPaginatorSource)document)
            .DocumentPaginator;

        // Set page size
        paginator.PageSize = new Size(
            printDialog.PrintableAreaWidth,
            printDialog.PrintableAreaHeight);

        printDialog.PrintDocument(paginator, title);
        return true;
    }

    /// <summary>
    /// Print a visual element directly
    /// </summary>
    public bool PrintVisual(Visual visual, string title)
    {
        var printDialog = new PrintDialog();

        if (printDialog.ShowDialog() != true)
            return false;

        printDialog.PrintVisual(visual, title);
        return true;
    }

    /// <summary>
    /// Get a list of available printers
    /// </summary>
    public IReadOnlyList<string> GetAvailablePrinters()
    {
        var server = new PrintServer();
        return server.GetPrintQueues()
            .Select(q => q.FullName)
            .ToList();
    }
}
```

---

## FAQ

### Q1: What about file access security?
Always validate paths in the main process. Deny access to any paths other than those selected by the user. Tauri uses capabilities for control. In .NET apps, use Environment.SpecialFolder to obtain safe paths.

### Q2: Do notifications behave differently on macOS and Windows?
macOS goes through Notification Center, Windows through Action Center. Icon sizes and action button specifications differ. WinUI 3's AppNotificationManager fully supports Windows 10/11 toast notifications.

### Q3: What is the recommended tray icon size?
macOS: 16x16 to 22x22 (@2x support), Windows: 16x16 to 32x32. Using Template Image (macOS) enables dark mode support. WPF/WinUI 3 uses .ico files.

### Q4: Can P/Invoke still be used in .NET 8 and later?
Yes. Furthermore, the LibraryImport attribute (Source Generator based) is recommended. It is more type-safe and faster than DllImport.

### Q5: How do you integrate a Windows service with a desktop app?
Communicate via named pipes, TCP/IP sockets, or memory-mapped files. Note that Windows services run in Session 0 and cannot directly manipulate the UI.

### Q6: Can file associations be configured in an MSIX package?
Yes. They can be declared using the uap:FileTypeAssociation element in Package.appxmanifest. No registry operations are needed, and they are automatically cleaned up on uninstall.

### Q7: Are there alternatives to Mutex for preventing multiple instances?
Named pipes, file locks, or binding a local TCP port can also achieve this. Mutex is the lightest and simplest. For MSIX packages, AppInstance.FindOrRegisterForKey() can be used.

---

## Summary

| Feature | Electron | Tauri | WPF/WinUI 3 |
|---------|----------|-------|-------------|
| File dialog | dialog.showOpenDialog | @tauri-apps/plugin-dialog | OpenFileDialog / FileOpenPicker |
| Notifications | Notification | @tauri-apps/plugin-notification | AppNotificationManager |
| Tray | Tray | TrayIcon | NotifyIcon / H.NotifyIcon |
| Shortcuts | globalShortcut | @tauri-apps/plugin-global-shortcut | RegisterHotKey (P/Invoke) |
| Auto-start | app.setLoginItemSettings | @tauri-apps/plugin-autostart | Registry / Task Scheduler |
| Clipboard | clipboard | @tauri-apps/plugin-clipboard | System.Windows.Clipboard |
| Drag & Drop | HTML5 DnD API | HTML5 DnD API | WPF DragDrop |
| File monitoring | chokidar | notify (Rust) | FileSystemWatcher |
| Registry | N/A | N/A | Microsoft.Win32.Registry |
| Printing | webContents.print() | N/A | PrintDialog |
| Single instance | app.requestSingleInstanceLock() | N/A | Mutex / NamedPipe |

---

## Further Reading

---

## References
1. Electron. "Native File Dialogs." electronjs.org/docs, 2024.
2. Electron. "Tray." electronjs.org/docs/api/tray, 2024.
3. Tauri. "Plugins." tauri.app/plugin, 2024.
4. Microsoft. "Windows App SDK — App Notifications." learn.microsoft.com/windows/apps/windows-app-sdk/notifications, 2024.
5. Microsoft. "P/Invoke in .NET." learn.microsoft.com/dotnet/standard/native-interop/pinvoke, 2024.
6. Microsoft. "JumpList Class." learn.microsoft.com/dotnet/api/system.windows.shell.jumplist, 2024.
7. Microsoft. "File System Watcher." learn.microsoft.com/dotnet/api/system.io.filesystemwatcher, 2024.
8. Microsoft. "Windows Registry." learn.microsoft.com/dotnet/api/microsoft.win32.registry, 2024.

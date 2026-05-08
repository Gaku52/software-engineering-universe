# Architecture Patterns

> The core of desktop app architecture lies in process isolation and IPC communication. This guide explains safe and robust app design covering the main process/renderer model, secure IPC design, preload scripts, and context isolation. It also comprehensively covers MVVM, clean architecture, and DI container configuration for .NET desktop, Win32 message loop design, and multi-window management patterns.

## What You Will Learn

- [ ] Understand the main process/renderer process model
- [ ] Implement IPC communication patterns (invoke/handle, send/on)
- [ ] Build a secure bridge using preload scripts
- [ ] Design architecture layers for .NET desktop applications
- [ ] Understand how Win32 message loops work
- [ ] Build multi-window management and plugin architecture
- [ ] Create testable designs using dependency injection (DI) containers


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Having read [Desktop App Overview](./00-desktop-app-overview.md)

---

## 1. Process Model

```
Desktop app process structure:

  ┌─────────────────────────────────────────────┐
  │              Main Process                    │
  │  (Node.js / Rust Backend)                   │
  │                                              │
  │  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
  │  │ File I/O │  │ Native   │  │ OS API   │   │
  │  │          │  │ Menu     │  │ Notif/Tray│   │
  │  └──────────┘  └──────────┘  └──────────┘   │
  │              ▲  IPC  ▼                       │
  ├──────────────┼──────┼───────────────────────┤
  │              ▼      ▲                        │
  │         ┌───────────────┐                    │
  │         │ preload.js    │ ← Bridge layer     │
  │         │ contextBridge │                    │
  │         └───────┬───────┘                    │
  │                 │                            │
  │  ┌──────────────▼──────────────┐             │
  │  │     Renderer Process        │             │
  │  │  (Chromium / WebView)       │             │
  │  │  React / Vue / Svelte       │             │
  │  │  HTML / CSS / JavaScript    │             │
  │  └─────────────────────────────┘             │
  └─────────────────────────────────────────────┘

  Electron process model:
    Main process:     1 (Node.js runtime)
    Renderer process: 1 per window (Chromium)
    preload:          1 per renderer (isolated context)

  Tauri process model:
    Core process:     1 (Rust backend)
    WebView process:  1 per window (OS WebView)
    → Lightweight because Chromium is not bundled

  .NET Desktop (WPF/WinUI 3) process model:
    Single process:   UI thread + background threads
    UI thread:        Manages UI via message loop (Dispatcher)
    Worker thread:    Async processing via Task / ThreadPool
```

### 1.1 Electron Main Process

```typescript
// main.ts — Electron main process
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // Security settings
      nodeIntegration: false,      // Disable Node.js in renderer
      contextIsolation: true,      // Enable context isolation
      sandbox: true,               // Enable sandbox
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Development: Vite dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

### 1.2 Tauri Core Process

```rust
// src-tauri/src/main.rs — Tauri core process
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! From Rust backend.", name)
}

#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path)
        .map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet, read_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 1.3 .NET Desktop Process Model

```
.NET desktop app thread model:

  ┌──────────────────────────────────────────────┐
  │              Application                      │
  │                                               │
  │  ┌─────────────────────────────────────────┐  │
  │  │           UI Thread (STA)               │  │
  │  │  ┌─────────┐  ┌──────────┐  ┌────────┐ │  │
  │  │  │DispatcherQueue│  │ XAML    │  │Message │ │  │
  │  │  │ Message Loop  │  │Rendering│  │ Pump   │ │  │
  │  │  └─────────┘  └──────────┘  └────────┘ │  │
  │  └──────────────┬──────────────────────────┘  │
  │                 │ Dispatcher.Invoke            │
  │                 │ DispatcherQueue.TryEnqueue    │
  │  ┌──────────────▼──────────────────────────┐  │
  │  │        Background Threads               │  │
  │  │  ┌─────────┐  ┌──────────┐  ┌────────┐ │  │
  │  │  │ Task     │  │ ThreadPool│  │ Timer  │ │  │
  │  │  │ async/await│  │ WorkItem │  │        │ │  │
  │  │  └─────────┘  └──────────┘  └────────┘ │  │
  │  └─────────────────────────────────────────┘  │
  └──────────────────────────────────────────────┘
```

```csharp
// WPF UI thread and background processing
using System.Windows;
using System.Windows.Threading;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }

    private async void LoadDataButton_Click(object sender, RoutedEventArgs e)
    {
        // Disable button on UI thread
        LoadDataButton.IsEnabled = false;
        StatusText.Text = "Loading...";

        try
        {
            // Run heavy processing on background thread
            var data = await Task.Run(() =>
            {
                // CPU-bound processing (runs on separate thread)
                Thread.Sleep(3000); // Simulation
                return LoadExpensiveData();
            });

            // After await, automatically returns to UI thread
            StatusText.Text = $"Done: {data.Count} items retrieved";
            DataGrid.ItemsSource = data;
        }
        catch (Exception ex)
        {
            StatusText.Text = $"Error: {ex.Message}";
        }
        finally
        {
            LoadDataButton.IsEnabled = true;
        }
    }

    // Explicit marshaling to UI thread using Dispatcher
    private void BackgroundWorker_DoWork()
    {
        for (int i = 0; i < 100; i++)
        {
            Thread.Sleep(50);
            // Update progress on UI thread
            Dispatcher.Invoke(() =>
            {
                ProgressBar.Value = i + 1;
            });
        }
    }
}
```

```csharp
// Thread management using DispatcherQueue in WinUI 3
using Microsoft.UI.Dispatching;

public sealed partial class MainPage : Page
{
    private readonly DispatcherQueue _dispatcherQueue;

    public MainPage()
    {
        InitializeComponent();
        _dispatcherQueue = DispatcherQueue.GetForCurrentThread();
    }

    private void StartBackgroundWork()
    {
        Task.Run(() =>
        {
            // Background processing
            var result = PerformHeavyComputation();

            // Return result to UI thread
            _dispatcherQueue.TryEnqueue(() =>
            {
                ResultText.Text = result.ToString();
            });
        });
    }

    // Specify DispatcherQueue priority
    private void UpdateUIWithPriority(string message,
        DispatcherQueuePriority priority = DispatcherQueuePriority.Normal)
    {
        _dispatcherQueue.TryEnqueue(priority, () =>
        {
            StatusText.Text = message;
        });
    }
}
```

---

## 2. IPC Communication Patterns

```
IPC (Inter-Process Communication) patterns:

  Pattern 1: Request-Response (invoke/handle)
  ┌──────────┐  invoke('get-data', args)  ┌──────────┐
  │ Renderer │ ───────────────────────→  │ Main     │
  │          │                            │          │
  │          │  ←──────────────────────── │          │
  │          │  Promise<result>           │          │
  └──────────┘                            └──────────┘

  Pattern 2: Fire-and-Forget (send/on)
  ┌──────────┐  send('log', data)         ┌──────────┐
  │ Renderer │ ───────────────────────→  │ Main     │
  │          │  (no response)             │          │
  └──────────┘                            └──────────┘

  Pattern 3: Push (main → renderer)
  ┌──────────┐                            ┌──────────┐
  │ Renderer │  ←──────────────────────  │ Main     │
  │          │  webContents.send('event') │          │
  └──────────┘                            └──────────┘

  Pattern 4: Bidirectional Stream (MessagePort)
  ┌──────────┐  port.postMessage(data)    ┌──────────┐
  │ Renderer │ ←───────────────────────→ │ Main     │
  │          │  port.onmessage            │          │
  └──────────┘                            └──────────┘
```

### 2.1 Electron IPC Implementation

```typescript
// preload.ts — Secure bridge
import { contextBridge, ipcRenderer } from 'electron';

// APIs exposed to renderer (whitelist approach)
contextBridge.exposeInMainWorld('electronAPI', {
  // Pattern 1: Request-Response
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  readFile: (path: string) => ipcRenderer.invoke('read-file', path),
  saveFile: (path: string, data: string) =>
    ipcRenderer.invoke('save-file', path, data),

  // Pattern 2: Fire-and-Forget
  logEvent: (event: string) => ipcRenderer.send('log-event', event),

  // Pattern 3: Receive notifications from main
  onUpdateAvailable: (callback: (version: string) => void) => {
    const handler = (_event: any, version: string) => callback(version);
    ipcRenderer.on('update-available', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('update-available', handler);
  },
});

// main.ts — Register handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('read-file', async (_event, filePath: string) => {
  // Path validation (security)
  const safePath = path.resolve(filePath);
  if (!safePath.startsWith(app.getPath('documents'))) {
    throw new Error('Access denied: path outside documents');
  }
  return fs.promises.readFile(safePath, 'utf-8');
});

ipcMain.handle('save-file', async (_event, filePath: string, data: string) => {
  const safePath = path.resolve(filePath);
  if (!safePath.startsWith(app.getPath('documents'))) {
    throw new Error('Access denied');
  }
  await fs.promises.writeFile(safePath, data, 'utf-8');
  return { success: true };
});

// Main → Renderer notification
function notifyUpdate(version: string) {
  mainWindow?.webContents.send('update-available', version);
}
```

### 2.2 Tauri Command Communication

```typescript
// Frontend (TypeScript)
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Command call (Request-Response)
const greeting = await invoke<string>('greet', { name: 'Gaku' });

// Event reception (main → frontend)
const unlisten = await listen<string>('file-changed', (event) => {
  console.log('File changed:', event.payload);
});

// Cleanup
unlisten();
```

### 2.3 High-Speed Bidirectional Communication via MessagePort

```typescript
// main.ts — Create and transfer MessagePort
import { MessageChannelMain } from 'electron';

function setupMessagePort() {
  const { port1, port2 } = new MessageChannelMain();

  // Use port on main process side
  port1.on('message', (event) => {
    console.log('Received from renderer:', event.data);
    // Process streaming data
    if (event.data.type === 'audio-chunk') {
      processAudioChunk(event.data.buffer);
    }
  });
  port1.start();

  // Transfer port to renderer
  mainWindow.webContents.postMessage('port-transfer', null, [port2]);
}

// preload.ts — Receive MessagePort
ipcRenderer.on('port-transfer', (event) => {
  const port = event.ports[0];
  contextBridge.exposeInMainWorld('dataChannel', {
    send: (data: any) => port.postMessage(data),
    onMessage: (callback: (data: any) => void) => {
      port.onmessage = (event) => callback(event.data);
    },
  });
});
```

### 2.4 Shared Memory Communication via SharedArrayBuffer

```typescript
// main.ts — High-performance data sharing with SharedArrayBuffer
// Note: CSP requires cross-origin-opener-policy and
//       cross-origin-embedder-policy settings

function setupSharedMemory() {
  // Create shared buffer (1MB)
  const sharedBuffer = new SharedArrayBuffer(1024 * 1024);
  const view = new Int32Array(sharedBuffer);

  // Write data in main process
  Atomics.store(view, 0, 42);

  // Send SharedArrayBuffer to renderer
  mainWindow.webContents.send('shared-buffer', sharedBuffer);
}

// renderer — Use SharedArrayBuffer
window.electronAPI.onSharedBuffer((buffer: SharedArrayBuffer) => {
  const view = new Int32Array(buffer);
  // Thread-safe access via Atomics API
  const value = Atomics.load(view, 0);
  console.log('Shared value:', value); // 42

  // Update value (immediately reflected to other threads)
  Atomics.store(view, 0, 100);
});
```

### 2.5 Communication Patterns Within .NET Applications

```csharp
// Messenger pattern (CommunityToolkit.Mvvm)
// Achieves loosely-coupled communication between ViewModels

// Message definition
public sealed class NavigationMessage : ValueChangedMessage<string>
{
    public NavigationMessage(string pageName) : base(pageName) { }
}

public sealed class DataLoadedMessage
{
    public List<Customer> Customers { get; init; } = new();
    public DateTime LoadedAt { get; init; } = DateTime.Now;
}

// Sender ViewModel
public partial class SidebarViewModel : ObservableRecipient
{
    [RelayCommand]
    private void NavigateTo(string pageName)
    {
        // Send message
        Messenger.Send(new NavigationMessage(pageName));
    }
}

// Receiver ViewModel
public partial class ShellViewModel : ObservableRecipient,
    IRecipient<NavigationMessage>
{
    public ShellViewModel()
    {
        // Register with messenger (auto-register when IsActive = true)
        IsActive = true;
    }

    public void Receive(NavigationMessage message)
    {
        // Receive and process message
        CurrentPage = message.Value switch
        {
            "Home" => new HomeViewModel(),
            "Settings" => new SettingsViewModel(),
            _ => throw new ArgumentException($"Unknown page: {message.Value}")
        };
    }
}
```

```csharp
// EventAggregator pattern (Prism framework)
using Prism.Events;

// Event definition
public class OrderCreatedEvent : PubSubEvent<Order> { }
public class CustomerSelectedEvent : PubSubEvent<Customer> { }

// Publisher
public class OrderViewModel
{
    private readonly IEventAggregator _eventAggregator;

    public OrderViewModel(IEventAggregator eventAggregator)
    {
        _eventAggregator = eventAggregator;
    }

    private void CreateOrder()
    {
        var order = new Order { /* ... */ };
        // Publish event
        _eventAggregator.GetEvent<OrderCreatedEvent>().Publish(order);
    }
}

// Subscriber
public class DashboardViewModel
{
    public DashboardViewModel(IEventAggregator eventAggregator)
    {
        // Subscribe to event
        eventAggregator.GetEvent<OrderCreatedEvent>()
            .Subscribe(OnOrderCreated,
                ThreadOption.UIThread,       // Execute on UI thread
                keepSubscriberReferenceAlive: false,  // Weak reference
                filter: order => order.Amount > 1000); // Filter condition
    }

    private void OnOrderCreated(Order order)
    {
        // Process when order is created
        TotalOrders++;
        RecentOrders.Insert(0, order);
    }
}
```

---

## 3. Security Model

```
Defense-in-depth security:

  Layer 1: Process isolation
    → Renderer cannot access Node.js APIs
    → nodeIntegration: false (required)

  Layer 2: Context isolation
    → contextIsolation: true (required)
    → preload and web page have separate contexts

  Layer 3: Sandbox
    → sandbox: true
    → No direct access to filesystem or processes

  Layer 4: CSP (Content Security Policy)
    → Inline scripts forbidden
    → Restrict external resource loading

  Layer 5: API whitelist
    → Expose only necessary APIs via contextBridge
    → Input validation performed on main process side

  Tauri security model:
    → Per-API permission grants via Capabilities
    → All APIs disabled by default
    → Permissions configurable per window

  .NET Desktop security model:
    → CAS (Code Access Security) deprecated since .NET Core
    → Sandbox distribution possible via MSIX package
    → Windows Defender Application Control (WDAC) support
    → Code signing prevents tampering
```

```typescript
// Electron — CSP configuration
// main.ts
mainWindow.webContents.session.webRequest.onHeadersReceived(
  (details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self';" +
          "script-src 'self';" +
          "style-src 'self' 'unsafe-inline';" +
          "img-src 'self' data: https:;" +
          "connect-src 'self' https://api.example.com;"
        ],
      },
    });
  }
);
```

```json
// Tauri — capabilities configuration
// src-tauri/capabilities/default.json
{
  "identifier": "default",
  "description": "Default capabilities",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:allow-open",
    "dialog:allow-save",
    "fs:allow-read",
    "notification:default"
  ]
}
```

### 3.1 Tauri Scoped File Access

```json
// src-tauri/capabilities/file-access.json
{
  "identifier": "file-access",
  "description": "Scoped file system access",
  "windows": ["main"],
  "permissions": [
    {
      "identifier": "fs:allow-read",
      "allow": [
        { "path": "$DOCUMENT/**" },
        { "path": "$APPDATA/**" }
      ],
      "deny": [
        { "path": "$DOCUMENT/secret/**" }
      ]
    },
    {
      "identifier": "fs:allow-write",
      "allow": [
        { "path": "$APPDATA/**" }
      ]
    }
  ]
}
```

```rust
// src-tauri/src/security.rs — Input validation and sanitization
use std::path::{Path, PathBuf};
use tauri::AppHandle;

/// Path validation to prevent path traversal attacks
pub fn validate_path(
    app: &AppHandle,
    requested_path: &str,
) -> Result<PathBuf, String> {
    let base_dir = app
        .path()
        .document_dir()
        .map_err(|e| format!("Failed to get document dir: {}", e))?;

    let resolved = base_dir.join(requested_path);
    let canonical = resolved
        .canonicalize()
        .map_err(|e| format!("Invalid path: {}", e))?;

    // Verify that the canonicalized path is within the base directory
    if !canonical.starts_with(&base_dir) {
        return Err("Access denied: path traversal detected".to_string());
    }

    Ok(canonical)
}

/// Filename sanitization
pub fn sanitize_filename(name: &str) -> String {
    name.chars()
        .filter(|c| !matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
        .collect::<String>()
        .trim()
        .to_string()
}

#[tauri::command]
pub async fn secure_read_file(
    app: AppHandle,
    path: String,
) -> Result<String, String> {
    let safe_path = validate_path(&app, &path)?;

    // File size check (100MB limit)
    let metadata = std::fs::metadata(&safe_path)
        .map_err(|e| format!("Cannot read metadata: {}", e))?;
    if metadata.len() > 100 * 1024 * 1024 {
        return Err("File too large (max 100MB)".to_string());
    }

    std::fs::read_to_string(&safe_path)
        .map_err(|e| format!("Read failed: {}", e))
}
```

### 3.2 .NET Desktop Security Implementation

```csharp
// Secure data storage (using DPAPI)
using System.Security.Cryptography;
using System.Text;

public class SecureStorage
{
    private readonly string _storagePath;

    public SecureStorage(string appName)
    {
        _storagePath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            appName,
            "secure");
        Directory.CreateDirectory(_storagePath);
    }

    /// <summary>
    /// Encrypt and save using DPAPI (Data Protection API)
    /// Only the current user can decrypt
    /// </summary>
    public void SaveSecure(string key, string value)
    {
        var data = Encoding.UTF8.GetBytes(value);
        var encrypted = ProtectedData.Protect(
            data,
            entropy: Encoding.UTF8.GetBytes(key),
            scope: DataProtectionScope.CurrentUser);

        var filePath = Path.Combine(_storagePath, SanitizeKey(key));
        File.WriteAllBytes(filePath, encrypted);
    }

    /// <summary>
    /// Decrypt and read using DPAPI
    /// </summary>
    public string? LoadSecure(string key)
    {
        var filePath = Path.Combine(_storagePath, SanitizeKey(key));
        if (!File.Exists(filePath)) return null;

        try
        {
            var encrypted = File.ReadAllBytes(filePath);
            var decrypted = ProtectedData.Unprotect(
                encrypted,
                entropy: Encoding.UTF8.GetBytes(key),
                scope: DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(decrypted);
        }
        catch (CryptographicException)
        {
            // Data from another user or tampered data
            return null;
        }
    }

    private static string SanitizeKey(string key) =>
        Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(key)))
            .Replace("/", "_")
            .Replace("+", "-");
}
```

```csharp
// Credential management using Windows Credential Manager
using System.Runtime.InteropServices;

public static class CredentialManager
{
    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CredWrite(ref CREDENTIAL credential, uint flags);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CredRead(
        string target,
        CRED_TYPE type,
        uint reservedFlag,
        out IntPtr credentialPtr);

    [DllImport("advapi32.dll")]
    private static extern void CredFree(IntPtr credential);

    public static void Save(string target, string username, string password)
    {
        var credential = new CREDENTIAL
        {
            TargetName = target,
            UserName = username,
            CredentialBlob = Marshal.StringToCoTaskMemUni(password),
            CredentialBlobSize = (uint)(password.Length * 2),
            Type = CRED_TYPE.GENERIC,
            Persist = CRED_PERSIST.LOCAL_MACHINE,
        };

        if (!CredWrite(ref credential, 0))
        {
            throw new InvalidOperationException(
                $"Failed to save credential: {Marshal.GetLastWin32Error()}");
        }
    }

    public static (string Username, string Password)? Load(string target)
    {
        if (!CredRead(target, CRED_TYPE.GENERIC, 0, out var credPtr))
            return null;

        try
        {
            var cred = Marshal.PtrToStructure<CREDENTIAL>(credPtr);
            var password = Marshal.PtrToStringUni(
                cred.CredentialBlob, (int)cred.CredentialBlobSize / 2);
            return (cred.UserName, password ?? "");
        }
        finally
        {
            CredFree(credPtr);
        }
    }
}
```

---

## 4. Preload Script Design

```
Preload design principles:

  ✓ Whitelist approach (expose only necessary APIs)
  ✓ Input sanitization (do not trust input from renderer)
  ✓ Type-safe API definitions
  ✗ Do not expose ipcRenderer directly
  ✗ Do not expose require/import
  ✗ Do not expose Node.js APIs directly
```

```typescript
// preload.ts — Type-safe API design
import { contextBridge, ipcRenderer } from 'electron';

// API type definitions
export interface ElectronAPI {
  // File operations
  file: {
    open: () => Promise<{ path: string; content: string } | null>;
    save: (content: string) => Promise<boolean>;
    saveAs: (content: string) => Promise<string | null>;
  };
  // App information
  app: {
    getVersion: () => Promise<string>;
    getPlatform: () => string;
  };
  // Events
  events: {
    onMenuAction: (callback: (action: string) => void) => () => void;
  };
}

contextBridge.exposeInMainWorld('electronAPI', {
  file: {
    open: () => ipcRenderer.invoke('file:open'),
    save: (content: string) => ipcRenderer.invoke('file:save', content),
    saveAs: (content: string) => ipcRenderer.invoke('file:saveAs', content),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:version'),
    getPlatform: () => process.platform,
  },
  events: {
    onMenuAction: (callback: (action: string) => void) => {
      const handler = (_: any, action: string) => callback(action);
      ipcRenderer.on('menu:action', handler);
      return () => ipcRenderer.removeListener('menu:action', handler);
    },
  },
} satisfies ElectronAPI);

// renderer.d.ts — Type definitions for renderer side
declare global {
  interface Window {
    electronAPI: import('./preload').ElectronAPI;
  }
}
```

### 4.1 Advanced Preload Patterns

```typescript
// preload.ts — API design with validation
import { contextBridge, ipcRenderer } from 'electron';

// Input validation functions
function validateFilePath(path: string): string {
  if (typeof path !== 'string') throw new Error('Path must be a string');
  if (path.length === 0) throw new Error('Path cannot be empty');
  if (path.length > 32767) throw new Error('Path too long');
  // Prevent path traversal
  if (path.includes('..')) throw new Error('Path traversal not allowed');
  return path;
}

function validateContent(content: string, maxSize = 10 * 1024 * 1024): string {
  if (typeof content !== 'string') throw new Error('Content must be a string');
  if (content.length > maxSize) throw new Error('Content too large');
  return content;
}

// Rate limiter (prevent excessive calls from renderer)
function createRateLimiter(maxCalls: number, windowMs: number) {
  const calls: number[] = [];
  return () => {
    const now = Date.now();
    // Remove old calls outside the window
    while (calls.length > 0 && calls[0]! < now - windowMs) {
      calls.shift();
    }
    if (calls.length >= maxCalls) {
      throw new Error('Rate limit exceeded');
    }
    calls.push(now);
  };
}

const fileOpenLimiter = createRateLimiter(10, 60000); // Up to 10 times per minute
const fileSaveLimiter = createRateLimiter(5, 60000);  // Up to 5 times per minute

contextBridge.exposeInMainWorld('electronAPI', {
  file: {
    open: () => {
      fileOpenLimiter();
      return ipcRenderer.invoke('file:open');
    },
    save: (path: string, content: string) => {
      fileSaveLimiter();
      return ipcRenderer.invoke('file:save',
        validateFilePath(path),
        validateContent(content));
    },
    watch: (path: string, callback: (event: string) => void) => {
      validateFilePath(path);
      const handler = (_: any, event: string) => callback(event);
      ipcRenderer.on(`file:changed:${path}`, handler);
      ipcRenderer.send('file:watch', path);
      return () => {
        ipcRenderer.removeListener(`file:changed:${path}`, handler);
        ipcRenderer.send('file:unwatch', path);
      };
    },
  },
});
```

---

## 5. Clean Architecture (.NET Desktop)

```
Clean architecture layer structure:

  ┌─────────────────────────────────────────────┐
  │          Presentation Layer                  │
  │  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
  │  │ View     │  │ ViewModel│  │ Converter │ │
  │  │ (XAML)   │  │          │  │           │ │
  │  └──────────┘  └──────────┘  └───────────┘ │
  ├─────────────────────────────────────────────┤
  │          Application Layer                   │
  │  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
  │  │ UseCase  │  │ DTO      │  │ Service   │ │
  │  │ (CQRS)   │  │          │  │ Interface │ │
  │  └──────────┘  └──────────┘  └───────────┘ │
  ├─────────────────────────────────────────────┤
  │          Domain Layer                        │
  │  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
  │  │ Entity   │  │ValueObject│  │ Repository│ │
  │  │          │  │          │  │ Interface │ │
  │  └──────────┘  └──────────┘  └───────────┘ │
  ├─────────────────────────────────────────────┤
  │          Infrastructure Layer                │
  │  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
  │  │ DB Access│  │ File I/O │  │ HTTP      │ │
  │  │ (EF Core)│  │          │  │ Client    │ │
  │  └──────────┘  └──────────┘  └───────────┘ │
  └─────────────────────────────────────────────┘

  Direction of dependencies: outer → inner (inner does not depend on outer)
```

```csharp
// Domain layer — Entities and value objects
namespace MyApp.Domain.Entities;

public class Customer
{
    public CustomerId Id { get; private set; }
    public string Name { get; private set; }
    public Email Email { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    // Factory method with validation
    public static Customer Create(string name, string email)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("Name is required");
        if (name.Length > 100)
            throw new DomainException("Name must be 100 chars or less");

        return new Customer
        {
            Id = CustomerId.New(),
            Name = name.Trim(),
            Email = Email.Create(email),
            CreatedAt = DateTime.UtcNow,
        };
    }

    public void UpdateName(string newName)
    {
        if (string.IsNullOrWhiteSpace(newName))
            throw new DomainException("Name is required");
        Name = newName.Trim();
        UpdatedAt = DateTime.UtcNow;
    }
}

// Value object
public record Email
{
    public string Value { get; }

    private Email(string value) => Value = value;

    public static Email Create(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            throw new DomainException("Email is required");
        if (!email.Contains('@'))
            throw new DomainException("Invalid email format");
        return new Email(email.ToLowerInvariant().Trim());
    }
}

public record CustomerId(Guid Value)
{
    public static CustomerId New() => new(Guid.NewGuid());
}
```

```csharp
// Domain layer — Repository interface
namespace MyApp.Domain.Repositories;

public interface ICustomerRepository
{
    Task<Customer?> GetByIdAsync(CustomerId id, CancellationToken ct = default);
    Task<IReadOnlyList<Customer>> GetAllAsync(CancellationToken ct = default);
    Task<IReadOnlyList<Customer>> SearchAsync(string query, CancellationToken ct = default);
    Task AddAsync(Customer customer, CancellationToken ct = default);
    Task UpdateAsync(Customer customer, CancellationToken ct = default);
    Task DeleteAsync(CustomerId id, CancellationToken ct = default);
}
```

```csharp
// Application layer — Use cases (CQRS pattern)
using MediatR;

namespace MyApp.Application.Customers.Commands;

// Command definition
public record CreateCustomerCommand(string Name, string Email) : IRequest<CustomerId>;

// Command handler
public class CreateCustomerHandler : IRequestHandler<CreateCustomerCommand, CustomerId>
{
    private readonly ICustomerRepository _repository;
    private readonly IUnitOfWork _unitOfWork;

    public CreateCustomerHandler(
        ICustomerRepository repository,
        IUnitOfWork unitOfWork)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
    }

    public async Task<CustomerId> Handle(
        CreateCustomerCommand command,
        CancellationToken ct)
    {
        var customer = Customer.Create(command.Name, command.Email);
        await _repository.AddAsync(customer, ct);
        await _unitOfWork.SaveChangesAsync(ct);
        return customer.Id;
    }
}

// Query definition
public record GetCustomerByIdQuery(CustomerId Id) : IRequest<CustomerDto?>;

public class GetCustomerByIdHandler : IRequestHandler<GetCustomerByIdQuery, CustomerDto?>
{
    private readonly ICustomerRepository _repository;

    public GetCustomerByIdHandler(ICustomerRepository repository)
    {
        _repository = repository;
    }

    public async Task<CustomerDto?> Handle(
        GetCustomerByIdQuery query,
        CancellationToken ct)
    {
        var customer = await _repository.GetByIdAsync(query.Id, ct);
        return customer is null ? null : CustomerDto.FromEntity(customer);
    }
}

// DTO
public record CustomerDto(Guid Id, string Name, string Email, DateTime CreatedAt)
{
    public static CustomerDto FromEntity(Customer c) =>
        new(c.Id.Value, c.Name, c.Email.Value, c.CreatedAt);
}
```

```csharp
// Infrastructure layer — EF Core repository implementation
using Microsoft.EntityFrameworkCore;

namespace MyApp.Infrastructure.Persistence;

public class CustomerRepository : ICustomerRepository
{
    private readonly AppDbContext _context;

    public CustomerRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Customer?> GetByIdAsync(
        CustomerId id, CancellationToken ct = default)
    {
        return await _context.Customers
            .FirstOrDefaultAsync(c => c.Id == id, ct);
    }

    public async Task<IReadOnlyList<Customer>> GetAllAsync(
        CancellationToken ct = default)
    {
        return await _context.Customers
            .OrderBy(c => c.Name)
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<Customer>> SearchAsync(
        string query, CancellationToken ct = default)
    {
        return await _context.Customers
            .Where(c => c.Name.Contains(query) ||
                        c.Email.Value.Contains(query))
            .OrderBy(c => c.Name)
            .ToListAsync(ct);
    }

    public async Task AddAsync(Customer customer, CancellationToken ct = default)
    {
        await _context.Customers.AddAsync(customer, ct);
    }

    public Task UpdateAsync(Customer customer, CancellationToken ct = default)
    {
        _context.Customers.Update(customer);
        return Task.CompletedTask;
    }

    public async Task DeleteAsync(CustomerId id, CancellationToken ct = default)
    {
        var customer = await GetByIdAsync(id, ct);
        if (customer is not null)
            _context.Customers.Remove(customer);
    }
}
```

---

## 6. Dependency Injection (DI) Design

```csharp
// App.xaml.cs — DI container configuration (WinUI 3)
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace MyApp;

public partial class App : Application
{
    public IHost Host { get; }

    public static T GetService<T>() where T : class
    {
        var app = (App)Current;
        return app.Host.Services.GetRequiredService<T>();
    }

    public App()
    {
        InitializeComponent();

        Host = Microsoft.Extensions.Hosting.Host
            .CreateDefaultBuilder()
            .ConfigureServices((context, services) =>
            {
                // Register ViewModels
                services.AddTransient<MainViewModel>();
                services.AddTransient<SettingsViewModel>();
                services.AddTransient<CustomerListViewModel>();
                services.AddTransient<CustomerDetailViewModel>();

                // Register Views
                services.AddTransient<MainPage>();
                services.AddTransient<SettingsPage>();
                services.AddTransient<CustomerListPage>();

                // Register services
                services.AddSingleton<INavigationService, NavigationService>();
                services.AddSingleton<IDialogService, DialogService>();
                services.AddSingleton<ISettingsService, SettingsService>();

                // Register repositories
                services.AddScoped<ICustomerRepository, CustomerRepository>();
                services.AddScoped<IUnitOfWork, UnitOfWork>();

                // Database context
                services.AddDbContext<AppDbContext>(options =>
                {
                    var dbPath = Path.Combine(
                        Environment.GetFolderPath(
                            Environment.SpecialFolder.LocalApplicationData),
                        "MyApp", "app.db");
                    options.UseSqlite($"Data Source={dbPath}");
                });

                // HTTP client
                services.AddHttpClient<IApiClient, ApiClient>(client =>
                {
                    client.BaseAddress = new Uri("https://api.example.com");
                    client.Timeout = TimeSpan.FromSeconds(30);
                });

                // MediatR (CQRS)
                services.AddMediatR(cfg =>
                {
                    cfg.RegisterServicesFromAssemblyContaining<CreateCustomerCommand>();
                    cfg.AddBehavior(typeof(IPipelineBehavior<,>),
                        typeof(ValidationBehavior<,>));
                    cfg.AddBehavior(typeof(IPipelineBehavior<,>),
                        typeof(LoggingBehavior<,>));
                });

                // Logging
                services.AddLogging(builder =>
                {
                    builder.AddDebug();
                    builder.AddFile("logs/app-{Date}.log");
                });
            })
            .Build();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        _window = new MainWindow();
        _window.Activate();
    }
}
```

```csharp
// Example of DI usage in ViewModel
public partial class CustomerListViewModel : ObservableObject
{
    private readonly IMediator _mediator;
    private readonly INavigationService _navigation;
    private readonly IDialogService _dialog;

    // Constructor injection
    public CustomerListViewModel(
        IMediator mediator,
        INavigationService navigation,
        IDialogService dialog)
    {
        _mediator = mediator;
        _navigation = navigation;
        _dialog = dialog;
    }

    [ObservableProperty]
    private ObservableCollection<CustomerDto> _customers = new();

    [ObservableProperty]
    private string _searchQuery = "";

    [ObservableProperty]
    private bool _isLoading;

    [RelayCommand]
    private async Task LoadCustomersAsync()
    {
        IsLoading = true;
        try
        {
            var result = await _mediator.Send(new GetAllCustomersQuery());
            Customers = new ObservableCollection<CustomerDto>(result);
        }
        finally
        {
            IsLoading = false;
        }
    }

    [RelayCommand]
    private async Task DeleteCustomerAsync(CustomerDto customer)
    {
        var confirmed = await _dialog.ShowConfirmAsync(
            "Delete Confirmation",
            $"Delete {customer.Name}?");

        if (confirmed)
        {
            await _mediator.Send(
                new DeleteCustomerCommand(new CustomerId(customer.Id)));
            Customers.Remove(customer);
        }
    }

    [RelayCommand]
    private void NavigateToDetail(CustomerDto customer)
    {
        _navigation.NavigateTo<CustomerDetailPage>(customer.Id);
    }
}
```

---

## 7. Multi-Window Management

```csharp
// Multi-window management in WinUI 3
using Microsoft.UI;
using Microsoft.UI.Windowing;
using WinRT.Interop;

public class WindowManager
{
    private readonly Dictionary<string, Window> _windows = new();

    /// <summary>
    /// Create and display a new window
    /// </summary>
    public Window CreateWindow(string id, string title, Type pageType,
        int width = 800, int height = 600)
    {
        if (_windows.TryGetValue(id, out var existing))
        {
            // Activate existing window
            ActivateWindow(existing);
            return existing;
        }

        var window = new Window
        {
            Title = title,
            Content = (Page)App.GetService(pageType),
        };

        // Set size and position with AppWindow
        var appWindow = GetAppWindow(window);
        appWindow.Resize(new Windows.Graphics.SizeInt32(width, height));

        // Handle window close
        window.Closed += (_, _) =>
        {
            _windows.Remove(id);
        };

        _windows[id] = window;
        window.Activate();
        return window;
    }

    /// <summary>
    /// Get a window by ID
    /// </summary>
    public Window? GetWindow(string id) =>
        _windows.TryGetValue(id, out var w) ? w : null;

    /// <summary>
    /// Close all windows
    /// </summary>
    public void CloseAll()
    {
        foreach (var window in _windows.Values.ToList())
        {
            window.Close();
        }
        _windows.Clear();
    }

    private static AppWindow GetAppWindow(Window window)
    {
        var hwnd = WindowNative.GetWindowHandle(window);
        var windowId = Win32Interop.GetWindowIdFromWindow(hwnd);
        return AppWindow.GetFromWindowId(windowId);
    }

    private static void ActivateWindow(Window window)
    {
        var hwnd = WindowNative.GetWindowHandle(window);
        var windowId = Win32Interop.GetWindowIdFromWindow(hwnd);
        var appWindow = AppWindow.GetFromWindowId(windowId);
        // Bring window to front
        if (appWindow.Presenter is OverlappedPresenter presenter)
        {
            presenter.IsMinimizable = true;
            presenter.Restore();
        }
        window.Activate();
    }
}
```

```csharp
// Electron multi-window management (TypeScript)
// Note: Listed after .NET for comparison
```

```typescript
// main.ts — Electron multi-window management
class WindowManager {
  private windows = new Map<string, BrowserWindow>();

  createWindow(
    id: string,
    options: {
      title: string;
      url: string;
      width?: number;
      height?: number;
      parent?: BrowserWindow;
    }
  ): BrowserWindow {
    // Bring existing window to front if it exists
    const existing = this.windows.get(id);
    if (existing && !existing.isDestroyed()) {
      existing.focus();
      return existing;
    }

    const win = new BrowserWindow({
      width: options.width ?? 800,
      height: options.height ?? 600,
      title: options.title,
      parent: options.parent,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    win.loadURL(options.url);

    win.on('closed', () => {
      this.windows.delete(id);
    });

    this.windows.set(id, win);
    return win;
  }

  getWindow(id: string): BrowserWindow | undefined {
    const win = this.windows.get(id);
    return win && !win.isDestroyed() ? win : undefined;
  }

  closeAll(): void {
    for (const [id, win] of this.windows) {
      if (!win.isDestroyed()) win.close();
    }
    this.windows.clear();
  }

  // Inter-window communication
  sendToWindow(id: string, channel: string, ...args: any[]): void {
    const win = this.getWindow(id);
    win?.webContents.send(channel, ...args);
  }

  // Broadcast to all windows
  broadcast(channel: string, ...args: any[]): void {
    for (const [, win] of this.windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, ...args);
      }
    }
  }
}
```

---

## 8. Plugin Architecture

```csharp
// Plugin interface
namespace MyApp.Plugins;

/// <summary>
/// Base interface for plugins
/// </summary>
public interface IPlugin
{
    string Id { get; }
    string Name { get; }
    string Version { get; }
    string Description { get; }

    /// <summary>
    /// Initialize the plugin
    /// </summary>
    Task InitializeAsync(IPluginContext context);

    /// <summary>
    /// Dispose the plugin
    /// </summary>
    Task ShutdownAsync();
}

/// <summary>
/// Context provided to plugins
/// </summary>
public interface IPluginContext
{
    /// <summary>
    /// Add an item to the menu
    /// </summary>
    void RegisterMenuItem(string menuPath, string label, Action handler);

    /// <summary>
    /// Add a command to the command palette
    /// </summary>
    void RegisterCommand(string id, string label, Func<Task> handler);

    /// <summary>
    /// Add a panel to the sidebar
    /// </summary>
    void RegisterSidebarPanel(string id, string title, Type panelType);

    /// <summary>
    /// Subscribe to events
    /// </summary>
    IDisposable Subscribe<TEvent>(Action<TEvent> handler);

    /// <summary>
    /// Read and write settings
    /// </summary>
    IPluginSettings Settings { get; }
}

// Plugin loader
public class PluginLoader
{
    private readonly List<IPlugin> _plugins = new();
    private readonly string _pluginDir;
    private readonly IPluginContext _context;

    public PluginLoader(string pluginDir, IPluginContext context)
    {
        _pluginDir = pluginDir;
        _context = context;
    }

    /// <summary>
    /// Load all plugins from the plugin directory
    /// </summary>
    public async Task LoadAllAsync()
    {
        if (!Directory.Exists(_pluginDir)) return;

        foreach (var dir in Directory.GetDirectories(_pluginDir))
        {
            var dllFiles = Directory.GetFiles(dir, "*.dll");
            foreach (var dll in dllFiles)
            {
                try
                {
                    await LoadPluginAsync(dll);
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"Failed to load plugin {dll}: {ex.Message}");
                }
            }
        }
    }

    private async Task LoadPluginAsync(string dllPath)
    {
        // Load isolated with AssemblyLoadContext
        var loadContext = new PluginLoadContext(dllPath);
        var assembly = loadContext.LoadFromAssemblyPath(dllPath);

        var pluginTypes = assembly.GetTypes()
            .Where(t => typeof(IPlugin).IsAssignableFrom(t) && !t.IsAbstract);

        foreach (var type in pluginTypes)
        {
            if (Activator.CreateInstance(type) is IPlugin plugin)
            {
                await plugin.InitializeAsync(_context);
                _plugins.Add(plugin);
            }
        }
    }

    /// <summary>
    /// Shut down all plugins
    /// </summary>
    public async Task UnloadAllAsync()
    {
        foreach (var plugin in _plugins)
        {
            try
            {
                await plugin.ShutdownAsync();
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error shutting down {plugin.Name}: {ex.Message}");
            }
        }
        _plugins.Clear();
    }
}

/// <summary>
/// Isolated AssemblyLoadContext for plugins
/// </summary>
public class PluginLoadContext : AssemblyLoadContext
{
    private readonly AssemblyDependencyResolver _resolver;

    public PluginLoadContext(string pluginPath) : base(isCollectible: true)
    {
        _resolver = new AssemblyDependencyResolver(pluginPath);
    }

    protected override Assembly? Load(AssemblyName assemblyName)
    {
        var assemblyPath = _resolver.ResolveAssemblyToPath(assemblyName);
        return assemblyPath is not null
            ? LoadFromAssemblyPath(assemblyPath)
            : null;
    }
}
```

---

## 9. Understanding the Win32 Message Loop

```
Win32 message loop:

  ┌──────────┐     ┌───────────────┐     ┌──────────────┐
  │  OS      │────→│ Message Queue │────→│ WndProc      │
  │ (input)  │     │               │     │ (msg handler)│
  │ Mouse    │     │ WM_PAINT      │     │              │
  │ Keyboard │     │ WM_KEYDOWN    │     │ switch(msg)  │
  │ Timer    │     │ WM_MOUSEMOVE  │     │  case ...    │
  └──────────┘     └───────────────┘     └──────────────┘

  GetMessage() → TranslateMessage() → DispatchMessage() → WndProc()
```

```csharp
// Win32 message loop basics (P/Invoke)
// Not normally manipulated directly in WPF/WinUI 3, but understanding is important

using System.Runtime.InteropServices;

public class Win32MessageLoop
{
    [StructLayout(LayoutKind.Sequential)]
    public struct MSG
    {
        public IntPtr hwnd;
        public uint message;
        public IntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public POINT pt;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT
    {
        public int x;
        public int y;
    }

    [DllImport("user32.dll")]
    private static extern bool GetMessage(
        out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

    [DllImport("user32.dll")]
    private static extern bool TranslateMessage(ref MSG lpMsg);

    [DllImport("user32.dll")]
    private static extern IntPtr DispatchMessage(ref MSG lpMsg);

    // Standard message loop (for reference — managed by the framework in practice)
    public static void RunMessageLoop()
    {
        MSG msg;
        while (GetMessage(out msg, IntPtr.Zero, 0, 0))
        {
            TranslateMessage(ref msg);
            DispatchMessage(ref msg);
        }
    }

    // Common Win32 message constants
    public const uint WM_PAINT = 0x000F;
    public const uint WM_CLOSE = 0x0010;
    public const uint WM_DESTROY = 0x0002;
    public const uint WM_KEYDOWN = 0x0100;
    public const uint WM_LBUTTONDOWN = 0x0201;
    public const uint WM_MOUSEMOVE = 0x0200;
    public const uint WM_SIZE = 0x0005;
    public const uint WM_COPYDATA = 0x004A;
    public const uint WM_USER = 0x0400;
    public const uint WM_APP = 0x8000;
}
```

```csharp
// Win32 message hook in WPF (advanced usage)
using System.Windows.Interop;

public partial class MainWindow : Window
{
    private HwndSource? _hwndSource;

    protected override void OnSourceInitialized(EventArgs e)
    {
        base.OnSourceInitialized(e);

        // Get window handle and set up message hook
        _hwndSource = PresentationSource.FromVisual(this) as HwndSource;
        _hwndSource?.AddHook(WndProc);
    }

    private IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam,
        IntPtr lParam, ref bool handled)
    {
        switch ((uint)msg)
        {
            case Win32MessageLoop.WM_COPYDATA:
                // Receive data from other applications
                HandleCopyData(lParam);
                handled = true;
                break;

            case Win32MessageLoop.WM_APP + 1:
                // Handle custom messages
                HandleCustomMessage(wParam, lParam);
                handled = true;
                break;
        }

        return IntPtr.Zero;
    }

    protected override void OnClosed(EventArgs e)
    {
        _hwndSource?.RemoveHook(WndProc);
        base.OnClosed(e);
    }
}
```

---

## 10. State Management Patterns

```csharp
// Application state management — Redux-style pattern
namespace MyApp.State;

// State definition (Immutable)
public record AppState
{
    public IReadOnlyList<Customer> Customers { get; init; } = Array.Empty<Customer>();
    public Customer? SelectedCustomer { get; init; }
    public bool IsLoading { get; init; }
    public string? ErrorMessage { get; init; }
    public ThemeMode Theme { get; init; } = ThemeMode.System;
}

// Action definitions
public abstract record AppAction;
public record LoadCustomersAction : AppAction;
public record CustomersLoadedAction(IReadOnlyList<Customer> Customers) : AppAction;
public record SelectCustomerAction(Customer Customer) : AppAction;
public record SetErrorAction(string Message) : AppAction;
public record ClearErrorAction : AppAction;
public record ChangeThemeAction(ThemeMode Theme) : AppAction;

// Reducer
public static class AppReducer
{
    public static AppState Reduce(AppState state, AppAction action)
    {
        return action switch
        {
            LoadCustomersAction =>
                state with { IsLoading = true, ErrorMessage = null },

            CustomersLoadedAction a =>
                state with { Customers = a.Customers, IsLoading = false },

            SelectCustomerAction a =>
                state with { SelectedCustomer = a.Customer },

            SetErrorAction a =>
                state with { ErrorMessage = a.Message, IsLoading = false },

            ClearErrorAction =>
                state with { ErrorMessage = null },

            ChangeThemeAction a =>
                state with { Theme = a.Theme },

            _ => state,
        };
    }
}

// Store
public class Store : ObservableObject
{
    private AppState _state = new();

    public AppState State
    {
        get => _state;
        private set => SetProperty(ref _state, value);
    }

    public void Dispatch(AppAction action)
    {
        State = AppReducer.Reduce(State, action);
    }

    // Async action (Thunk)
    public async Task DispatchAsync(
        Func<Func<AppAction, void>, Task> thunk)
    {
        await thunk(Dispatch);
    }
}

// Usage example
public partial class CustomerListViewModel : ObservableObject
{
    private readonly Store _store;
    private readonly ICustomerRepository _repository;

    public CustomerListViewModel(Store store, ICustomerRepository repository)
    {
        _store = store;
        _repository = repository;
    }

    [RelayCommand]
    private async Task LoadAsync()
    {
        _store.Dispatch(new LoadCustomersAction());
        try
        {
            var customers = await _repository.GetAllAsync();
            _store.Dispatch(new CustomersLoadedAction(customers));
        }
        catch (Exception ex)
        {
            _store.Dispatch(new SetErrorAction(ex.Message));
        }
    }
}
```

---

## 11. Anti-Patterns

```
Common mistakes:

  ✗ Setting nodeIntegration: true
    → Node.js APIs directly accessible from renderer
    → Risk of arbitrary code execution via XSS attacks

  ✗ Setting contextIsolation: false
    → preload context shared with web page
    → Risk of prototype pollution attacks

  ✗ Exposing ipcRenderer wholesale
    → Messages can be sent to any channel
    → Should be restricted with whitelist approach

  ✗ Not validating input in main process
    → Input from renderer is never trustworthy
    → Risk of path traversal and injection attacks

  ✗ Running heavy processing on UI thread (.NET)
    → UI freeze (not responding dialog)
    → Avoid with Task.Run + async/await

  ✗ Putting framework-dependent code in ViewModel
    → Reduces testability
    → Should abstract with service interfaces

  ✗ Creating dependencies with new instead of using DI
    → High coupling, difficult to mock
    → Use constructor injection

  ✗ Managing state scattered across multiple locations
    → State inconsistencies occur easily
    → Centrally manage with a single Store / ViewModel
```

---

## FAQ

### Q1: What is the difference between Electron and Tauri security models?
Electron has permissive defaults (manual hardening required). Tauri has everything disabled by default (only explicitly permitted APIs are granted via capabilities). Tauri is secure by default.

### Q2: Can multiple preload scripts be used?
In Electron, one preload can be specified per BrowserWindow. Multiple features should be modularized and managed within a single preload.

### Q3: What is the performance of IPC communication?
invoke/handle has overhead on the order of a few hundred microseconds. For large data transfers, consider using MessagePort or SharedArrayBuffer.

### Q4: Which DI container should be used for WPF/WinUI 3?
Microsoft.Extensions.DependencyInjection is the standard choice. Configure using the Generic Host pattern. Autofac and DryIoc are also options, but the standard one is sufficient unless there is a specific reason.

### Q5: What is the difference between MVVM and MVC?
In MVC, the controller receives input and manipulates the model. In MVVM, the View and ViewModel are bound via data binding, and the ViewModel handles presentation logic. MVVM is optimal for XAML-based desktop apps.

### Q6: When to use CommunityToolkit.Mvvm vs Prism?
CommunityToolkit.Mvvm is lightweight and Source Generator-based. Prism offers rich features for large-scale applications such as modularization, region management, and dialog services. Consider CommunityToolkit for small-to-medium scale, and Prism for large enterprise applications.

### Q7: Is clean architecture necessary for desktop apps?
It can be over-engineering for small apps. Recommended for medium and larger applications, or those expected to require long-term maintenance. A practical approach is to start with MVVM + DI and add layers as needed.

---

## Summary

| Concept | Key Points |
|---------|-----------|
| Process isolation | Separate main (backend) and renderer (UI) |
| IPC | invoke/handle (Request-Response) is the foundation |
| preload | Expose APIs via whitelist approach using contextBridge |
| Security | nodeIntegration:false + contextIsolation:true + sandbox:true |
| Tauri | Per-API permission management via Capabilities |
| .NET MVVM | Loosely-coupled design with CommunityToolkit.Mvvm + DI |
| Clean architecture | Domain → Application → Infrastructure → Presentation |
| State management | Centralized management with Store pattern or ViewModel |
| Multi-window | ID-based management with WindowManager |
| Plugins | Isolated loading with AssemblyLoadContext |

---

## Further Reading

---

## References
1. Electron. "Security." electronjs.org/docs/tutorial/security, 2024.
2. Electron. "Context Isolation." electronjs.org/docs/tutorial/context-isolation, 2024.
3. Tauri. "Security." tauri.app/security, 2024.
4. Microsoft. "Dependency Injection in .NET." learn.microsoft.com/dotnet/core/extensions/dependency-injection, 2024.
5. Microsoft. "Windows App SDK Architecture." learn.microsoft.com/windows/apps/windows-app-sdk, 2024.
6. Microsoft. "CommunityToolkit.Mvvm." learn.microsoft.com/dotnet/communitytoolkit/mvvm, 2024.
7. Jason Taylor. "Clean Architecture with .NET." github.com/jasontaylordev/CleanArchitecture, 2024.
8. Microsoft. "MSIX Packaging." learn.microsoft.com/windows/msix, 2024.

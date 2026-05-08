# Desktop Application Overview

> Desktop app development has changed significantly with the evolution of web technologies. This guide explains the characteristics of native, hybrid, and web-based approaches, and the criteria for selecting the best technology for your project.

## What You Will Learn in This Chapter

- [ ] Understand the types and technology stacks of desktop applications
- [ ] Understand the differences between web-based and native approaches
- [ ] Be able to select technology based on project requirements
- [ ] Understand the architecture and process models of each technology
- [ ] Understand the security model of desktop applications
- [ ] Be able to perform practical technology comparison and evaluation


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Types of Desktop Applications

### 1.1 Overall Classification

```
Desktop Application Categories:

  +------------------------------------------+
  |           Desktop Applications             |
  +------------------------------------------+
  |                                          |
  |  ① Native              ② Cross-Platform  |
  |  ├─ WPF / WinUI 3     ├─ .NET MAUI      |
  |  ├─ Win32 / MFC       ├─ Qt             |
  |  ├─ SwiftUI / AppKit  ├─ Flutter Desktop |
  |  └─ GTK               └─ Avalonia UI    |
  |                                          |
  |  ③ Web-Based            ④ PWA            |
  |  ├─ Electron          └─ Browser-based  |
  |  ├─ Tauri                installable    |
  |  ├─ Neutralinojs                         |
  |  └─ Wails                                |
  |                                          |
  +------------------------------------------+
```

### 1.2 Native Applications

Applications that use the OS's native APIs directly. They achieve the best performance and OS integration, but require a separate implementation for each OS.

```
Characteristics of Native Apps:

  Windows Native:
    ┌─────────────────────────────────────────────────┐
    │ WPF (Windows Presentation Foundation)            │
    │ ├─ Runs on .NET Framework / .NET 8+              │
    │ ├─ Declarative UI based on XAML                  │
    │ ├─ Data binding / MVVM pattern                   │
    │ ├─ DirectX-based rendering                       │
    │ └─ De facto standard for business applications   │
    ├─────────────────────────────────────────────────┤
    │ WinUI 3 (Windows App SDK)                        │
    │ ├─ Modern UI framework succeeding WPF            │
    │ ├─ Full Fluent Design System support             │
    │ ├─ Access to both Win32 / UWP APIs               │
    │ ├─ Secure distribution via MSIX packaging        │
    │ └─ Supports Windows 10 1809+ / Windows 11        │
    ├─────────────────────────────────────────────────┤
    │ Win32 / MFC / ATL                                │
    │ ├─ Lowest-level API written in C/C++             │
    │ ├─ Minimal memory footprint                      │
    │ ├─ Full OS API access                            │
    │ ├─ Compatibility with legacy systems             │
    │ └─ Low development productivity                  │
    └─────────────────────────────────────────────────┘

  macOS Native:
    ┌─────────────────────────────────────────────────┐
    │ SwiftUI                                          │
    │ ├─ Apple's latest UI framework                   │
    │ ├─ Declarative syntax, preview support           │
    │ └─ Supports macOS 11+ / iOS 15+                 │
    ├─────────────────────────────────────────────────┤
    │ AppKit (Cocoa)                                   │
    │ ├─ Mature UI framework for macOS                 │
    │ ├─ Written in Objective-C / Swift                │
    │ └─ Most fine-grained macOS UI customization      │
    └─────────────────────────────────────────────────┘

  Linux Native:
    ┌─────────────────────────────────────────────────┐
    │ GTK (GIMP Toolkit)                               │
    │ ├─ Standard for the GNOME desktop environment    │
    │ ├─ Can be written in C / Python / Vala / Rust    │
    │ └─ Significant performance improvements in GTK 4 │
    ├─────────────────────────────────────────────────┤
    │ Qt                                               │
    │ ├─ Cross-platform support with C++ / QML         │
    │ ├─ Standard for the KDE desktop environment      │
    │ └─ Dual license: commercial and LGPL             │
    └─────────────────────────────────────────────────┘
```

### 1.3 Cross-Platform Native

An approach that supports multiple OSes from a single codebase. It uses OS-specific UI rendering engines to achieve near-native performance.

```
Cross-Platform Native Comparison:

  .NET MAUI:
    Language: C# / XAML
    Supported OS: Windows, macOS, iOS, Android
    Rendering: Native controls of each OS
    Features:
      → Successor to Xamarin.Forms
      → Integration with .NET ecosystem
      → Hot Reload support
      → Integrated development environment in Visual Studio
    Use cases:
      → Multi-platform support for internal business apps
      → Mobile deployment for companies with .NET assets

  Qt:
    Language: C++ / QML
    Supported OS: Windows, macOS, Linux, iOS, Android, embedded
    Rendering: Proprietary rendering engine
    Features:
      → Over 20 years of proven track record
      → Widest OS support
      → High performance
      → Signal/slot event system
    Use cases:
      → CAD / 3D modeling software
      → Industrial control systems
      → Media players

  Flutter Desktop:
    Language: Dart
    Supported OS: Windows, macOS, Linux, iOS, Android, Web
    Rendering: Impeller (proprietary rendering engine)
    Features:
      → Developed by Google
      → Fully custom rendering (does not use OS native UI)
      → Fast development with Hot Reload
      → Unified UI / UX
    Use cases:
      → Multi-platform apps where unified UI is important
      → Desktop extensions of mobile-first apps

  Avalonia UI:
    Language: C# / AXAML
    Supported OS: Windows, macOS, Linux, iOS, Android, Web
    Rendering: Skia-based proprietary rendering
    Features:
      → WPF-like API
      → MVVM pattern support
      → Utilizes the .NET ecosystem
      → Stable UI on Linux
    Use cases:
      → Porting WPF apps to Linux / macOS
      → Cross-platform apps based on .NET
```

### 1.4 Web Technology-Based Applications

Applications that build UI using HTML/CSS/JavaScript. Web developer skills can be applied directly, and a rich ecosystem is available.

```
Web Technology-Based Comparison:

  Electron:
    Architecture:
      ┌──────────────────────────────┐
      │  Main Process (Node.js)       │
      │  ├─ App lifecycle management  │
      │  ├─ Native API access         │
      │  ├─ File system operations    │
      │  └─ IPC communication         │
      ├──────────────────────────────┤
      │  Renderer Process (Chromium)  │
      │  ├─ UI rendered with HTML/CSS/JS│
      │  ├─ React/Vue/Svelte, etc.   │
      │  └─ 1 process per window     │
      └──────────────────────────────┘
    Features:
      → Consistent rendering with bundled Chromium
      → Full power of Node.js
      → Largest community and ecosystem
    Challenges:
      → Bundle size ~150MB
      → High memory usage (~200MB+)
      → Chromium version management

  Tauri v2:
    Architecture:
      ┌──────────────────────────────┐
      │  Backend (Rust)               │
      │  ├─ Command handlers          │
      │  ├─ Plugin system             │
      │  ├─ Native API access         │
      │  └─ Security controls         │
      ├──────────────────────────────┤
      │  Frontend (OS WebView)        │
      │  ├─ UI rendered with HTML/CSS/JS│
      │  ├─ React/Vue/Svelte, etc.   │
      │  └─ Uses the OS WebView      │
      └──────────────────────────────┘
    Features:
      → Uses OS WebView (no bundled Chromium required)
      → Rust safety and performance
      → Bundle size ~5MB
      → Security-first design
    Challenges:
      → WebView version differences across OSes
      → Rust learning curve
      → Smaller ecosystem than Electron

  Neutralinojs:
    Architecture:
      → Lightweight C++ backend + OS WebView
      → Less than 1/10 the size of Electron
      → No Node.js required
    Features:
      → Simple API
      → Low learning curve
      → Best for small-scale apps

  Wails:
    Architecture:
      → Go backend + OS WebView
      → Leverages the Go ecosystem
    Features:
      → For Go developers
      → High performance
      → Simple build process
```

### 1.5 PWA (Progressive Web App)

```
PWA Positioning:

  Browser-based installable app:
    ┌──────────────────────────────────────────────┐
    │  Service Worker                               │
    │  ├─ Offline caching                           │
    │  ├─ Background sync                           │
    │  └─ Push notifications                        │
    ├──────────────────────────────────────────────┤
    │  Web App Manifest                             │
    │  ├─ App name, icon, theme color               │
    │  ├─ Standalone display mode                   │
    │  └─ OS integration (shortcuts, etc.)          │
    ├──────────────────────────────────────────────┤
    │  Available APIs                               │
    │  ├─ File System Access API                    │
    │  ├─ Web Bluetooth / Web USB                   │
    │  ├─ Web Share API                             │
    │  ├─ Notifications API                         │
    │  └─ * Native features depend on browser support│
    └──────────────────────────────────────────────┘

  PWA advantages:
    → Easiest distribution (just a URL to get started)
    → Automatic updates (via Service Worker)
    → Minimal storage consumption
    → Can be used without installation

  PWA limitations:
    → Limited native API access
    → Restricted file system access
    → Dependent on browser engine
    → Incomplete OS integration (especially on macOS / Linux)
```

---

## 2. Detailed Technology Stack Comparison

### 2.1 Basic Specification Comparison

```
Comparison of Major Technologies:

  Technology  │ Language  │ Size   │ Memory │ OS Support      │ Use Case
  ────────────┼───────────┼────────┼────────┼─────────────────┼──────────
  Electron    │ JS/TS     │ ~150MB │ 200MB  │ Win/Mac/Linux   │ General
  Tauri v2    │ Rust+JS   │ ~5MB   │ 50MB   │ Win/Mac/Linux   │ Lightweight
  WPF         │ C#/XAML   │ ~20MB  │ 100MB  │ Windows only    │ Business
  WinUI 3     │ C#/XAML   │ ~20MB  │ 100MB  │ Windows only    │ Modern UI
  MAUI        │ C#/XAML   │ ~30MB  │ 120MB  │ Win/Mac/and     │ Cross
  Flutter     │ Dart      │ ~20MB  │ 80MB   │ Win/Mac/Linux   │ Cross
  Qt          │ C++       │ ~30MB  │ 60MB   │ Win/Mac/Linux   │ High perf
  Avalonia    │ C#/AXAML  │ ~25MB  │ 90MB   │ Win/Mac/Linux   │ Cross
  Wails       │ Go+JS     │ ~8MB   │ 50MB   │ Win/Mac/Linux   │ Lightweight

Technology stacks of well-known apps:

  Electron:
    → VS Code, Slack, Discord, Notion, Figma Desktop
    → Spotify Desktop, GitHub Desktop, Postman
    → 1Password (v8), Microsoft Teams, Obsidian
    → Signal Desktop, Bitwarden Desktop

  Tauri:
    → Cody (Sourcegraph), Crabnebula
    → Increasing adoption in new projects
    → Growing adoption in DevTools

  WPF/WinUI:
    → Visual Studio, Windows Terminal
    → Windows standard apps
    → Paint.NET, LINQPad

  Qt:
    → VirtualBox, OBS Studio
    → Adobe Substance, Autodesk Maya
    → VLC Media Player, KDE Plasma

  Flutter Desktop:
    → Google Earth, Superlist
    → Ente (photo management), AppFlowy
```

### 2.2 Detailed Performance Comparison

```
Startup time comparison (typical medium-sized app):

  Technology    │ Cold Start   │ Warm Start   │ First Paint
  ──────────────┼──────────────┼──────────────┼─────────────
  Win32/MFC     │    100ms     │     30ms     │   50ms
  WPF           │    500ms     │    200ms     │  300ms
  WinUI 3       │    600ms     │    250ms     │  350ms
  Qt            │    300ms     │    100ms     │  150ms
  Flutter       │    400ms     │    150ms     │  200ms
  Tauri v2      │    800ms     │    300ms     │  500ms
  Electron      │   1500ms     │    500ms     │  800ms

  * Cold start = first launch after OS boot
  * Warm start = second and subsequent launches (cached)

Memory usage comparison (empty window displayed):

  Technology    │ Initial Mem │ Stable Mem  │ Process Count
  ──────────────┼─────────────┼─────────────┼───────────────
  Win32/MFC     │   5MB       │   8MB       │    1
  WPF           │  30MB       │  50MB       │    1
  WinUI 3       │  35MB       │  55MB       │    1
  Qt            │  20MB       │  35MB       │    1
  Flutter       │  25MB       │  45MB       │    1
  Tauri v2      │  15MB       │  30MB       │    2
  Electron      │  80MB       │ 120MB       │    3+

CPU usage comparison (idle):

  Technology    │ Idle CPU    │ During Animation
  ──────────────┼─────────────┼──────────────────
  Win32/MFC     │    0.0%     │     2-5%
  WPF           │    0.1%     │     3-8%
  WinUI 3       │    0.1%     │     2-6%
  Qt            │    0.0%     │     2-5%
  Flutter       │    0.1%     │     3-7%
  Tauri v2      │    0.2%     │     5-10%
  Electron      │    0.5%     │     8-15%
```

### 2.3 Development Productivity Comparison

```
Development Productivity Evaluation:

  Technology  │ Learning Curve │ Hot Reload │ Debugging │ Testing │ CI/CD
  ────────────┼────────────────┼────────────┼───────────┼─────────┼───────
  Electron    │  Low           │    ○       │  Excellent│  Rich   │ Easy
  Tauri v2    │  Medium        │    ○       │  Good     │  Rich   │ Easy
  WPF         │  Medium        │    △       │  Excellent│  Good   │ Medium
  WinUI 3     │  Medium        │    △       │  Good     │  Good   │ Medium
  MAUI        │  Medium        │    ○       │  Good     │  Good   │ Complex
  Flutter     │  Medium        │    ◎       │  Excellent│  Rich   │ Easy
  Qt          │  High          │    △       │  Good     │  Good   │ Complex

  * ◎=Excellent ○=Good △=Limited

Developer ecosystem size:

  Technology  │ npm/packages   │ Stack Overflow │ GitHub Stars
  ────────────┼────────────────┼────────────────┼─────────────
  Electron    │  All of npm    │    50,000+     │   115,000+
  Tauri v2    │  npm + crates  │    10,000+     │    85,000+
  WPF         │  NuGet         │    80,000+     │    N/A
  WinUI 3     │  NuGet         │     5,000+     │     4,000+
  Flutter     │  pub.dev       │    60,000+     │   165,000+
  Qt          │  Proprietary   │    70,000+     │    N/A
```

---

## 3. Technology Selection Guide

### 3.1 Selection Flowchart

```
Selection Flowchart:

  Confirm project requirements
  │
  ├─ Q1: What is the target OS?
  │   ├─ Windows only → Q2a
  │   ├─ Windows + macOS → Q3
  │   └─ All OS support → Q3
  │
  ├─ Q2a: Is a Windows native look required?
  │   ├─ Yes → Q2b
  │   └─ No → Q3
  │
  ├─ Q2b: Do you have existing .NET / C# assets?
  │   ├─ Yes → WinUI 3 or WPF
  │   └─ No → Q3
  │
  ├─ Q3: What are the team's skills?
  │   ├─ Mainly web technologies → Q4
  │   ├─ Mainly .NET / C# → MAUI / Avalonia
  │   ├─ Mainly C++ → Qt
  │   └─ Dart / Flutter experience → Flutter Desktop
  │
  ├─ Q4: How strict are bundle size and memory constraints?
  │   ├─ Strict (under 10MB) → Tauri v2
  │   ├─ Moderate (under 50MB) → Tauri v2
  │   └─ No constraints → Q5
  │
  └─ Q5: How dependent are you on the Node.js ecosystem?
      ├─ High (many existing npm packages) → Electron
      ├─ Moderate → Tauri v2 or Electron
      └─ Low → Tauri v2
```

### 3.2 Recommended Technology by Use Case

```
Recommended Technology by Use Case:

  ① Internal business app (Windows only):
     Recommended: WinUI 3 / WPF
     Reasons:
       → Easy integration with Active Directory / LDAP
       → Rich .NET business libraries
       → Internal distribution management with MSIX packages
       → Controllable via Group Policy
     Alternative: Electron + electron-edge-js

  ② Desktopifying an existing web app:
     Recommended: Electron
     Reasons:
       → Maximum reuse of existing code
       → Integration with Node.js backend
       → Proven framework
     Alternative: Tauri v2 (if much of it is new)

  ③ Developer tools:
     Recommended: Electron or Tauri v2
     Reasons:
       → Ecosystem like VS Code extensions
       → Highly customizable UI
       → Command palette / terminal integration
     Examples: VS Code, Postman, Insomnia

  ④ Media / Creative tools:
     Recommended: Qt or WinUI 3
     Reasons:
       → Easy GPU rendering
       → Custom drawing performance
       → Real-time processing
     Examples: OBS Studio, VLC, Blender

  ⑤ IoT / Edge devices:
     Recommended: Qt or Tauri v2
     Reasons:
       → Low resource consumption
       → Cross-platform
       → Embedded Linux support
     Alternative: Flutter (when touch UI is central)

  ⑥ Enterprise multi-platform:
     Recommended: Electron or Flutter
     Reasons:
       → Unified UI / UX
       → Structure suited for large-team development
       → Rich CI/CD pipeline support
     Alternative: .NET MAUI (for .NET ecosystem)
```

### 3.3 Selection by Non-Functional Requirements

```
Non-Functional Requirements Matrix:

  Requirement       │ Best Technology     │ Reason
  ──────────────────┼─────────────────────┼──────────────────────
  Startup speed     │ Win32, Qt           │ Native rendering
  Memory efficiency │ Tauri, Win32        │ Lightweight runtime
  Bundle size       │ Tauri, PWA          │ WebView reuse / web-based
  Security          │ Tauri, WinUI 3      │ Sandbox / MSIX
  Accessibility     │ WPF, WinUI 3        │ Full UI Automation support
  Offline operation │ All native tech     │ Local execution
  Auto-update       │ Electron, Tauri     │ Built-in updater
  Multi-monitor     │ WPF, Electron       │ Advanced window management
  Touch support     │ WinUI 3, Flutter    │ Touch-optimized
  GPU utilization   │ Qt, Flutter, WPF    │ Hardware acceleration

Selection by performance requirements:
  High performance required:  Qt > Win32 > WPF > Tauri > Electron
  Development speed priority: Electron > Flutter > Tauri > WinUI 3 > Qt
  Memory efficiency priority: Win32 > Tauri > Qt > Flutter > Electron
  Security priority:          Tauri > WinUI 3 > Electron > Qt > Win32
```

---

## 4. Advantages and Challenges of Web Technology-Based Approaches

### 4.1 Advantages of Web Technology-Based Approaches

```
Advantages of Web Technology-Based Approaches (Detailed):

  ① Large developer pool:
     → Web developers are the most numerous technical workforce in the world
     → Many professionals skilled in JavaScript/TypeScript
     → Easy to hire and build teams quickly
     → Personnel capable of both frontend and desktop development

  ② Rich ecosystem:
     → Over 2 million packages in the npm registry
     → Mature UI frameworks such as React/Vue/Svelte/Angular
     → UI component libraries (shadcn/ui, Radix, MUI, etc.)
     → Testing tools (Vitest, Playwright, Cypress)
     → Build tools (Vite, webpack, esbuild)

  ③ Fast development cycle:
     → Instant preview with hot reload / HMR
     → Debugging with browser DevTools
     → Pixel-perfect UI control with CSS
     → Declarative UI productivity

  ④ Code sharing:
     → Share code between web and desktop versions
     → Common business logic
     → Common UI components
     → Manageable in a monorepo
```

### 4.2 Challenges and Solutions for Web Technology-Based Approaches

```
Challenges and Solutions:

  ① Memory consumption:
     Challenges:
       → Electron: minimum ~80MB with bundled Chromium
       → Each process gets memory allocation for multiple windows
       → Memory leaks are prone to occur

     Solutions:
       → Migrate to Tauri to use OS WebView
       → For Electron: properly dispose of unused windows
       → Perform memory profiling regularly
       → Isolate memory-intensive processing with Web Workers

     Implementation example (Electron memory optimization):
```

```javascript
// Electron: BrowserWindow のメモリ最適化
const { BrowserWindow } = require('electron');

function createOptimizedWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // 不要な機能を無効化してメモリ節約
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // 背景スロットリングを有効化
      backgroundThrottling: true,
      // スペルチェックを無効化（不要な場合）
      spellcheck: false,
    },
    // GPU アクセラレーションの制御
    // 必要に応じて無効化
    show: false, // ready-to-show で表示してフリッカー防止
  });

  // ウィンドウが非表示の間はレンダリングを抑制
  win.on('hide', () => {
    win.webContents.setBackgroundThrottling(true);
  });

  // 準備完了後に表示
  win.once('ready-to-show', () => {
    win.show();
  });

  // ウィンドウ破棄時のクリーンアップ
  win.on('closed', () => {
    // 参照をクリアしてGC対象にする
    // win = null; は呼び出し元で実行
  });

  return win;
}
```

```
  ② Startup time:
     Challenges:
       → Chromium initialization takes time
       → JavaScript parsing and compilation time
       → Loading a large number of npm dependencies

     Solutions:
       → Improve perceived speed with a splash screen
       → Minimize initial load with code splitting
       → Speed up startup with V8 snapshots
       → Load modules on demand with lazy imports

  ③ Limited OS API access:
     Challenges:
       → Restricted access to native features
       → Cannot use OS-specific UI components
       → System tray and similar integrations may be incomplete

     Solutions:
       → Electron: C++ addons via Native Node Modules
       → Tauri: Any native API via Rust plugins
       → Utilize FFI (Foreign Function Interface)
       → Hybrid configuration of WebView + native
```

### 4.3 Security Model Comparison

```
Security Models:

  Electron Security:
    ┌──────────────────────────────────────┐
    │  Main Process                         │
    │  ├─ Full Node.js access               │
    │  ├─ File system operations            │
    │  └─ OS API access                     │
    ├──────────────────────────────────────┤
    │  preload script (bridge)              │
    │  ├─ Safe API exposure via contextBridge│
    │  └─ IPC communication intermediary    │
    ├──────────────────────────────────────┤
    │  Renderer Process (sandboxed)         │
    │  ├─ contextIsolation: true            │
    │  ├─ nodeIntegration: false            │
    │  └─ sandbox: true                     │
    └──────────────────────────────────────┘

    Notes:
      → nodeIntegration: true is dangerous (XSS gives full OS access)
      → The remote module is deprecated (security risk)
      → CSP (Content Security Policy) configuration is important

  Tauri Security:
    ┌──────────────────────────────────────┐
    │  Rust Backend                         │
    │  ├─ Explicit allowlist of commands    │
    │  ├─ File system scope restrictions    │
    │  └─ Fine-grained API permission control│
    ├──────────────────────────────────────┤
    │  OS WebView (sandboxed)               │
    │  ├─ OS-level security                 │
    │  ├─ Process isolation                 │
    │  └─ No Node.js (smaller attack surface)│
    └──────────────────────────────────────┘

    Advantages:
      → Secure by default (allowlist approach)
      → Rust memory safety
      → Smaller attack surface without Node.js
      → Strict CSP by default
```

Security configuration implementation example:

```javascript
// Electron: セキュアな BrowserWindow 設定
const { BrowserWindow, session } = require('electron');

function createSecureWindow() {
  const win = new BrowserWindow({
    webPreferences: {
      // セキュリティ必須設定
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // リモートコンテンツの制限
      webSecurity: true,
      allowRunningInsecureContent: false,
      // preload スクリプトのみを許可
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // CSP の設定
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';"
        ],
      },
    });
  });

  // 外部リンクのナビゲーション制限
  win.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    if (parsedUrl.origin !== 'http://localhost:3000') {
      event.preventDefault();
    }
  });

  // 新しいウィンドウの作成を制限
  win.webContents.setWindowOpenHandler(({ url }) => {
    // 外部URLはデフォルトブラウザで開く
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}
```

```json
// Tauri: tauri.conf.json のセキュリティ設定
{
  "app": {
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';",
      "dangerousDisableAssetCspModification": false,
      "freezePrototype": true
    }
  },
  "plugins": {
    "fs": {
      "scope": {
        "allow": ["$APPDATA/**", "$DOWNLOAD/**"],
        "deny": ["$HOME/.ssh/**", "$HOME/.gnupg/**"]
      }
    },
    "shell": {
      "scope": {
        "allow": [
          { "name": "open-url", "cmd": "open", "args": true }
        ]
      }
    }
  }
}
```

---

## 5. Process Models and Architecture

### 5.1 Process Model Details

```
Process Models for Each Technology:

  Electron:
    ┌─────────────┐   IPC    ┌─────────────────┐
    │ Main Process│◄────────►│ Renderer Process │ (Window 1)
    │ (Node.js)   │          └─────────────────┘
    │             │   IPC    ┌─────────────────┐
    │ ・ app      │◄────────►│ Renderer Process │ (Window 2)
    │ ・ ipcMain  │          └─────────────────┘
    │ ・ dialog   │   IPC    ┌─────────────────┐
    │ ・ Menu     │◄────────►│ Utility Process  │ (heavy tasks)
    └─────────────┘          └─────────────────┘

    Features:
      → Stability ensured with multi-process model
      → 1 window = 1 renderer process
      → Can isolate heavy tasks in Utility Process
      → Inter-process memory sharing via SharedArrayBuffer

  Tauri:
    ┌─────────────┐  invoke  ┌─────────────────┐
    │ Rust Core   │◄────────►│ WebView Process  │
    │             │          │ (OS WebView)      │
    │ ・ commands │  events  │                   │
    │ ・ plugins  │◄────────►│ ・ HTML/CSS/JS    │
    │ ・ state    │          │ ・ React/Vue/etc  │
    └─────────────┘          └─────────────────┘

    Features:
      → 2-process model (Core + WebView)
      → Bidirectional communication via invoke/events
      → State management on the Rust side
      → Feature extension via plugin system

  WPF / WinUI 3:
    ┌──────────────────────────────────┐
    │ Single Process                    │
    │ ├─ UI Thread (main thread)        │
    │ │   ├─ XAML rendering             │
    │ │   ├─ Event handling             │
    │ │   └─ Data binding update        │
    │ ├─ Composition Thread             │
    │ │   └─ DirectX rendering          │
    │ └─ Background Thread              │
    │     └─ Task.Run / ThreadPool      │
    └──────────────────────────────────┘

    Features:
      → Efficient with a single process
      → Separation of UI thread and background
      → Inter-thread communication via Dispatcher
      → Asynchronous processing with async/await
```

### 5.2 IPC (Inter-Process Communication) Patterns

```typescript
// Electron IPC パターン

// --- preload.js ---
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // レンダラー → メインへのリクエスト
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (data: string) => ipcRenderer.invoke('file:save', data),

  // メイン → レンダラーへの通知を購読
  onUpdateAvailable: (callback: Function) => {
    ipcRenderer.on('update-available', (_event, info) => callback(info));
  },

  // 双方向ストリーミング
  onProgressUpdate: (callback: Function) => {
    ipcRenderer.on('progress', (_event, value) => callback(value));
  },
});

// --- main.js ---
const { ipcMain, dialog } = require('electron');

// invoke ハンドラ（Promise ベース）
ipcMain.handle('dialog:openFile', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'テキスト', extensions: ['txt', 'md'] },
      { name: '全ファイル', extensions: ['*'] },
    ],
  });

  if (!result.canceled) {
    const content = await fs.readFile(result.filePaths[0], 'utf-8');
    return { path: result.filePaths[0], content };
  }
  return null;
});

ipcMain.handle('file:save', async (event, data) => {
  const result = await dialog.showSaveDialog({
    defaultPath: 'untitled.txt',
  });

  if (!result.canceled) {
    await fs.writeFile(result.filePath, data, 'utf-8');
    return { success: true, path: result.filePath };
  }
  return { success: false };
});

// --- renderer.js ---
// preload で公開された API を使用
async function handleOpenFile() {
  const result = await window.electronAPI.openFile();
  if (result) {
    editor.setValue(result.content);
    setCurrentPath(result.path);
  }
}
```

```rust
// Tauri IPC パターン

// --- src-tauri/src/main.rs ---
use tauri::Manager;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct FileResult {
    path: String,
    content: String,
}

// コマンドハンドラ
#[tauri::command]
async fn open_file(app: tauri::AppHandle) -> Result<Option<FileResult>, String> {
    use tauri_plugin_dialog::DialogExt;

    let file_path = app.dialog()
        .file()
        .add_filter("テキスト", &["txt", "md"])
        .blocking_pick_file();

    match file_path {
        Some(path) => {
            let content = std::fs::read_to_string(&path.path)
                .map_err(|e| e.to_string())?;
            Ok(Some(FileResult {
                path: path.path.to_string_lossy().to_string(),
                content,
            }))
        }
        None => Ok(None),
    }
}

#[tauri::command]
async fn save_file(path: String, content: String) -> Result<bool, String> {
    std::fs::write(&path, &content).map_err(|e| e.to_string())?;
    Ok(true)
}

// イベント発行（バックエンド → フロントエンド）
fn emit_progress(app: &tauri::AppHandle, progress: f64) {
    app.emit("progress", progress).unwrap();
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![open_file, save_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

```typescript
// Tauri フロントエンド側
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// コマンド呼び出し
async function handleOpenFile() {
  const result = await invoke<{ path: string; content: string } | null>('open_file');
  if (result) {
    editor.setValue(result.content);
    setCurrentPath(result.path);
  }
}

// イベントリスナー
const unlisten = await listen<number>('progress', (event) => {
  updateProgressBar(event.payload);
});

// クリーンアップ
onDestroy(() => {
  unlisten();
});
```

---

## 6. Development Environment Setup

### 6.1 Common Development Tools

```
Common Development Environment:

  Editor / IDE:
    ┌─────────────────────────────────────────────┐
    │ VS Code (recommended)                         │
    │ ├─ Extensions: ESLint, Prettier, TypeScript   │
    │ ├─ Extension: Tauri (tauri-apps.tauri-vscode) │
    │ ├─ Extension: rust-analyzer (for Tauri dev)   │
    │ ├─ Extension: C# Dev Kit (for WPF/WinUI dev)  │
    │ └─ Extension: XAML Styler                     │
    ├─────────────────────────────────────────────┤
    │ Visual Studio 2022 (for WPF/WinUI development)│
    │ ├─ .NET Desktop Development workload          │
    │ ├─ Windows App SDK                            │
    │ ├─ XAML Designer                              │
    │ └─ Hot Reload support                         │
    ├─────────────────────────────────────────────┤
    │ JetBrains Rider (for .NET in general)         │
    │ └─ Supports WPF / MAUI / Avalonia             │
    └─────────────────────────────────────────────┘

  Package managers:
    → pnpm (recommended: fast, disk-efficient)
    → npm / yarn (alternatives)
    → NuGet (.NET projects)
    → Cargo (Rust / Tauri)

  Version control:
    → Git + GitHub / GitLab / Azure DevOps
    → Large binaries: Git LFS

  CI/CD:
    → GitHub Actions (most common)
    → Azure Pipelines (Windows-focused)
    → GitLab CI/CD
```

### 6.2 Electron Development Environment

```bash
# Electron 開発環境のセットアップ

# 前提条件
node --version  # v20.0.0 以上

# プロジェクト作成（electron-forge 推奨）
npm init electron-app@latest my-electron-app -- \
  --template=vite-typescript

cd my-electron-app

# 基本的な依存関係
npm install electron-store     # データ永続化
npm install electron-updater   # 自動更新
npm install electron-log       # ログ管理

# 開発用依存関係
npm install -D @electron/rebuild  # ネイティブモジュール再ビルド
npm install -D electron-devtools-installer  # DevTools

# プロジェクト構造
# my-electron-app/
# ├── src/
# │   ├── main/           # メインプロセス
# │   │   ├── index.ts    # エントリポイント
# │   │   └── preload.ts  # preload スクリプト
# │   ├── renderer/       # レンダラープロセス
# │   │   ├── index.html
# │   │   ├── App.tsx     # React コンポーネント
# │   │   └── main.tsx    # レンダラーエントリ
# │   └── shared/         # 共有型定義
# │       └── types.ts
# ├── forge.config.ts     # Electron Forge 設定
# ├── vite.main.config.ts
# ├── vite.renderer.config.ts
# ├── tsconfig.json
# └── package.json

# 開発サーバー起動
npm start

# ビルド
npm run make
```

### 6.3 Tauri Development Environment

```bash
# Tauri v2 開発環境のセットアップ

# 前提条件
# Rust のインストール
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustc --version  # 1.77.0 以上

# Node.js
node --version  # v20.0.0 以上

# OS 別の追加依存関係
# Windows:
#   → Visual Studio Build Tools 2022
#   → WebView2 Runtime（Windows 10+ にはプリインストール）
#
# macOS:
#   → Xcode Command Line Tools: xcode-select --install
#
# Linux (Ubuntu/Debian):
#   sudo apt install libwebkit2gtk-4.1-dev build-essential \
#     curl wget file libxdo-dev libssl-dev \
#     libayatana-appindicator3-dev librsvg2-dev

# プロジェクト作成
npm create tauri-app@latest my-tauri-app
cd my-tauri-app

# フロントエンドフレームワーク選択時の推奨:
#   → React + TypeScript + Vite
#   → SvelteKit
#   → Vue + Vite

# プロジェクト構造
# my-tauri-app/
# ├── src/                    # フロントエンド
# │   ├── App.tsx
# │   ├── main.tsx
# │   └── styles.css
# ├── src-tauri/              # Rust バックエンド
# │   ├── src/
# │   │   ├── main.rs         # エントリポイント
# │   │   ├── commands.rs     # コマンドハンドラ
# │   │   └── lib.rs
# │   ├── Cargo.toml          # Rust 依存関係
# │   ├── tauri.conf.json     # Tauri 設定
# │   ├── capabilities/       # 権限設定
# │   └── icons/              # アプリアイコン
# ├── package.json
# ├── tsconfig.json
# └── vite.config.ts

# 開発サーバー起動
npm run tauri dev

# ビルド
npm run tauri build
```

### 6.4 WinUI 3 Development Environment

```powershell
# WinUI 3 開発環境のセットアップ（Windows のみ）

# 前提条件
# Visual Studio 2022 のインストール
# ワークロード: .NET デスクトップ開発 + Windows アプリ開発
# 個別コンポーネント: Windows App SDK

# .NET SDK
dotnet --version  # 8.0 以上

# プロジェクト作成
dotnet new winui3 -n MyWinUIApp
cd MyWinUIApp

# NuGet パッケージの追加
dotnet add package CommunityToolkit.Mvvm        # MVVM ツールキット
dotnet add package CommunityToolkit.WinUI       # UI コンポーネント
dotnet add package Microsoft.Extensions.DependencyInjection  # DI

# プロジェクト構造
# MyWinUIApp/
# ├── App.xaml             # アプリケーション定義
# ├── App.xaml.cs          # アプリケーション起動ロジック
# ├── MainWindow.xaml      # メインウィンドウ
# ├── MainWindow.xaml.cs   # コードビハインド
# ├── ViewModels/          # ViewModel 層
# │   └── MainViewModel.cs
# ├── Views/               # View 層
# │   └── SettingsPage.xaml
# ├── Models/              # Model 層
# │   └── AppSettings.cs
# ├── Services/            # サービス層
# │   └── NavigationService.cs
# ├── Helpers/             # ユーティリティ
# ├── Assets/              # 画像・アイコン
# ├── Strings/             # ローカライゼーション
# ├── Package.appxmanifest # パッケージマニフェスト
# └── MyWinUIApp.csproj    # プロジェクトファイル

# ビルド・実行
dotnet build
dotnet run
```

---

## 7. Desktop Application Lifecycle

### 7.1 Application Lifecycle

```
Desktop Application Lifecycle:

  ┌──────────────────────────────────────────────────────┐
  │                    Startup Phase                       │
  ├──────────────────────────────────────────────────────┤
  │ 1. Process launch                                     │
  │ 2. Runtime initialization (.NET CLR / V8 / Rust Runtime)│
  │ 3. Load application configuration                     │
  │ 4. Set up DI container                                │
  │ 5. Create main window                                 │
  │ 6. Initial UI rendering                               │
  │ 7. Start background services                          │
  ├──────────────────────────────────────────────────────┤
  │                    Running Phase                       │
  ├──────────────────────────────────────────────────────┤
  │ ・ Event loop (message pump)                          │
  │ ・ Process user input                                 │
  │ ・ Update UI                                          │
  │ ・ Background processing                              │
  │ ・ File I/O / network communication                   │
  │ ・ State persistence                                  │
  ├──────────────────────────────────────────────────────┤
  │                   Shutdown Phase                       │
  ├──────────────────────────────────────────────────────┤
  │ 1. Shutdown request (user action / OS shutdown)       │
  │ 2. Unsaved data confirmation dialog                   │
  │ 3. Stop background services                           │
  │ 4. Release resources                                  │
  │ 5. Save settings                                      │
  │ 6. Terminate process                                  │
  └──────────────────────────────────────────────────────┘
```

### 7.2 Lifecycle Management in Each Technology

```typescript
// Electron のライフサイクル管理
import { app, BrowserWindow } from 'electron';

// 単一インスタンスの保証
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // 2つ目のインスタンスが起動された場合、最初のウィンドウにフォーカス
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// アプリの準備完了
app.whenReady().then(async () => {
  // 設定の読み込み
  await loadSettings();

  // メインウィンドウ作成
  createMainWindow();

  // 自動更新チェック
  checkForUpdates();

  // macOS: ドックアイコンクリックでウィンドウ再作成
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// すべてのウィンドウが閉じられた時
app.on('window-all-closed', () => {
  // macOS 以外はアプリを終了
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 終了前の処理
app.on('before-quit', async (event) => {
  event.preventDefault();

  // 未保存データの確認
  const hasUnsaved = await checkUnsavedChanges();
  if (hasUnsaved) {
    const result = await dialog.showMessageBox({
      type: 'question',
      buttons: ['保存して終了', '保存せず終了', 'キャンセル'],
      message: '未保存の変更があります。',
    });

    if (result.response === 2) return; // キャンセル
    if (result.response === 0) await saveAll(); // 保存
  }

  // クリーンアップ
  await cleanup();
  app.exit(0);
});

// クラッシュレポート
app.on('render-process-gone', (event, webContents, details) => {
  console.error('Renderer process gone:', details.reason);
  // クラッシュレポートの送信
  reportCrash(details);
});
```

```csharp
// WinUI 3 のライフサイクル管理
// App.xaml.cs
using Microsoft.UI.Xaml;
using Microsoft.Windows.AppLifecycle;
using Windows.ApplicationModel.Activation;

public partial class App : Application
{
    private Window? _mainWindow;

    public App()
    {
        InitializeComponent();

        // 未処理の例外ハンドラ
        UnhandledException += OnUnhandledException;
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        // 単一インスタンスの保証
        var mainInstance = AppInstance.FindOrRegisterForKey("main");
        if (!mainInstance.IsCurrent)
        {
            // 既存インスタンスにリダイレクト
            var activatedArgs = AppInstance.GetCurrent().GetActivatedEventArgs();
            mainInstance.RedirectActivationToAsync(activatedArgs).AsTask().Wait();
            System.Diagnostics.Process.GetCurrentProcess().Kill();
            return;
        }

        // アクティベーション処理の登録
        mainInstance.Activated += OnActivated;

        // DI コンテナの構築
        ConfigureServices();

        // メインウィンドウの作成
        _mainWindow = new MainWindow();
        _mainWindow.Activate();

        // ウィンドウ閉じる時の処理
        _mainWindow.Closed += async (sender, e) =>
        {
            // 未保存データの確認
            if (await HasUnsavedChangesAsync())
            {
                e.Handled = true; // 閉じるのをキャンセル
                await PromptSaveAsync();
            }
        };
    }

    private void OnActivated(object? sender, AppActivationArguments args)
    {
        // アプリがアクティベートされた時（ファイルの関連付け等）
        _mainWindow?.DispatcherQueue.TryEnqueue(() =>
        {
            (_mainWindow as MainWindow)?.BringToFront();
        });
    }

    private void OnUnhandledException(object sender,
        Microsoft.UI.Xaml.UnhandledExceptionEventArgs e)
    {
        // クラッシュレポート
        LogError(e.Exception);
        e.Handled = true;
    }
}
```

---

## 8. Data Persistence Patterns

### 8.1 Data Storage in Desktop Applications

```
Data Persistence Options:

  ① File-based:
     ├─ JSON / YAML: Configuration files, small-scale data
     ├─ SQLite: Structured data, when queries are needed
     ├─ LevelDB / RocksDB: Key-value store
     └─ Protocol Buffers: Binary serialization

  ② OS-provided storage:
     ├─ Windows: Registry, Credential Manager
     ├─ macOS: UserDefaults, Keychain
     └─ Linux: GSettings, Secret Service API

  ③ Encrypted storage:
     ├─ electron-store + safeStorage
     ├─ tauri-plugin-store
     └─ DPAPI (Windows) / Keychain (macOS)

  Best practices for storage locations:
    ┌─────────────────────────────────────────────────┐
    │ Data type          │ Storage location             │
    │ ───────────────────┼─────────────────────────────│
    │ App settings       │ %APPDATA% / ~/Library/...    │
    │ User data          │ Documents folder             │
    │ Cache              │ %TEMP% / ~/Library/Caches    │
    │ Logs               │ %APPDATA%/logs               │
    │ Credentials        │ OS credential manager        │
    └─────────────────────────────────────────────────┘
```

```typescript
// Electron でのデータ永続化

// electron-store を使用した設定管理
import Store from 'electron-store';

interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  windowBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  recentFiles: string[];
  autoSave: boolean;
  autoSaveInterval: number; // 秒
}

const store = new Store<AppSettings>({
  defaults: {
    theme: 'system',
    language: 'ja',
    windowBounds: { x: 100, y: 100, width: 1200, height: 800 },
    recentFiles: [],
    autoSave: true,
    autoSaveInterval: 300,
  },
  // 暗号化が必要な場合
  encryptionKey: 'your-encryption-key',
  // スキーマバリデーション
  schema: {
    theme: { type: 'string', enum: ['light', 'dark', 'system'] },
    language: { type: 'string' },
    autoSaveInterval: { type: 'number', minimum: 30, maximum: 3600 },
  },
});

// 使用例
store.set('theme', 'dark');
const theme = store.get('theme');

// ウィンドウ位置の保存と復元
function saveWindowBounds(win: BrowserWindow) {
  const bounds = win.getBounds();
  store.set('windowBounds', bounds);
}

function restoreWindowBounds(): Electron.Rectangle {
  return store.get('windowBounds');
}

// 最近使ったファイルの管理
function addRecentFile(filePath: string) {
  const recent = store.get('recentFiles');
  const updated = [filePath, ...recent.filter(f => f !== filePath)].slice(0, 10);
  store.set('recentFiles', updated);

  // OS のジャンプリスト / 最近使った項目にも追加
  app.addRecentDocument(filePath);
}

// 認証情報の安全な保存（safeStorage）
import { safeStorage } from 'electron';

function saveCredential(key: string, value: string) {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(value);
    store.set(`credentials.${key}`, encrypted.toString('base64'));
  }
}

function loadCredential(key: string): string | null {
  const encrypted = store.get(`credentials.${key}`) as string | undefined;
  if (encrypted && safeStorage.isEncryptionAvailable()) {
    const buffer = Buffer.from(encrypted, 'base64');
    return safeStorage.decryptString(buffer);
  }
  return null;
}
```

```rust
// Tauri でのデータ永続化

// Cargo.toml
// [dependencies]
// tauri-plugin-store = "2"
// serde = { version = "1", features = ["derive"] }
// serde_json = "1"

use serde::{Deserialize, Serialize};
use tauri_plugin_store::StoreExt;

#[derive(Serialize, Deserialize, Clone)]
struct AppSettings {
    theme: String,
    language: String,
    auto_save: bool,
    auto_save_interval: u32,
    recent_files: Vec<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            language: "ja".to_string(),
            auto_save: true,
            auto_save_interval: 300,
            recent_files: Vec::new(),
        }
    }
}

#[tauri::command]
fn save_settings(app: tauri::AppHandle, settings: AppSettings) -> Result<(), String> {
    let store = app.store("settings.json")
        .map_err(|e| e.to_string())?;

    store.set("theme", serde_json::to_value(&settings.theme).unwrap());
    store.set("language", serde_json::to_value(&settings.language).unwrap());
    store.set("auto_save", serde_json::to_value(&settings.auto_save).unwrap());
    store.set("recent_files", serde_json::to_value(&settings.recent_files).unwrap());

    store.save().map_err(|e| e.to_string())
}

#[tauri::command]
fn load_settings(app: tauri::AppHandle) -> Result<AppSettings, String> {
    let store = app.store("settings.json")
        .map_err(|e| e.to_string())?;

    let theme = store.get("theme")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_else(|| "system".to_string());

    Ok(AppSettings {
        theme,
        ..Default::default()
    })
}
```

---

## 9. Testing Strategy

### 9.1 Testing Pyramid for Desktop Applications

```
Testing Pyramid:

                    ┌─────────────┐
                    │   E2E Tests  │  ← Few, slow, high cost
                    │  (Playwright) │
                  ┌─┴─────────────┴─┐
                  │  Integration Tests│  ← Moderate
                  │  (Components)    │
                ┌─┴─────────────────┴─┐
                │  Unit Tests          │  ← Many, fast, low cost
                │  (Vitest / xUnit)   │
                └─────────────────────┘

  Electron testing strategy:
    Unit tests:
      → Test business logic with Vitest
      → Mock the main process
      → Individual tests for IPC handlers

    Integration tests:
      → UI components with React Testing Library
      → Mock Electron APIs

    E2E tests:
      → Playwright + @playwright/test
      → Launch, operate, and verify Electron app

  Tauri testing strategy:
    Unit tests:
      → Test frontend with Vitest
      → Test Rust backend with cargo test
      → Individual tests for Tauri commands

    Integration tests:
      → Component tests
      → Tauri mock IPC

    E2E tests:
      → WebDriver (tauri-driver)
      → Playwright (experimental support)
```

```typescript
// Electron E2E テスト（Playwright）
import { test, expect, _electron as electron } from '@playwright/test';

test.describe('メインウィンドウ', () => {
  let electronApp: any;
  let page: any;

  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });
    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('アプリが正常に起動する', async () => {
    const title = await page.title();
    expect(title).toBe('My Electron App');
  });

  test('ファイルを開くダイアログが表示される', async () => {
    await page.click('[data-testid="open-file-btn"]');
    // ダイアログの処理をモック
    const isDialogShown = await electronApp.evaluate(({ dialog }: any) => {
      return dialog.showOpenDialog !== undefined;
    });
    expect(isDialogShown).toBe(true);
  });

  test('テーマの切り替えが動作する', async () => {
    await page.click('[data-testid="theme-toggle"]');
    const isDarkMode = await page.evaluate(() => {
      return document.documentElement.classList.contains('dark');
    });
    expect(isDarkMode).toBe(true);
  });
});
```

---

## 10. Practical Technology Selection Case Studies

### 10.1 Case Study: Internal Document Management System

```
Requirements:
  ・ Runs on Windows 10/11 company PCs
  ・ Active Directory authentication
  ・ Encrypted local file storage
  ・ PDF preview
  ・ Offline operation required
  ・ Distributed via internal network

Technology selection considerations:

  Candidate ①: WinUI 3
    Advantages:
      → Windows native appearance
      → Easy AD authentication with .NET libraries
      → File encryption with DPAPI
      → Internal distribution management with MSIX packages via Group Policy
    Disadvantages:
      → Windows only (future macOS support not possible)
      → XAML learning curve

  Candidate ②: Electron
    Advantages:
      → Leverages web team's skills
      → Easy PDF preview with PDF.js
      → Future macOS support possible
    Disadvantages:
      → Large bundle size
      → Complex AD authentication implementation
      → High memory consumption

  Candidate ③: Tauri v2
    Advantages:
      → Lightweight with low load on company PCs
      → Secure encryption processing with Rust
      → Future cross-platform support
    Disadvantages:
      → Limited Rust libraries for AD authentication
      → Few Rust personnel in-house

  Final selection: WinUI 3
  Reasons:
    → Best fit for Windows-only requirements
    → .NET business library assets
    → Ease of AD integration was the deciding factor
    → Compatibility with IT department's MSIX distribution requirements
```

### 10.2 Case Study: Cross-Platform Chat Application

```
Requirements:
  ・ Supports Windows / macOS / Linux
  ・ Real-time messaging (WebSocket)
  ・ File sharing / image preview
  ・ Notifications (system tray resident)
  ・ Auto-update
  ・ Screenshot capture

Technology selection considerations:

  Candidate ①: Electron
    Advantages:
      → Proven by Slack / Discord
      → WebSocket is easy with web standards
      → Mature notification API
      → Auto-update with electron-updater
      → Screenshots with desktopCapturer
    Disadvantages:
      → High memory consumption (burden as a resident app)
      → Bundle size

  Candidate ②: Tauri v2
    Advantages:
      → Low memory consumption as a resident app
      → Easy implementation with tray icon plugin
      → Auto-update with tauri-plugin-updater
    Disadvantages:
      → Complex implementation of screenshot feature
      → WebSocket handled on the frontend side

  Final selection: Electron
  Reasons:
    → Rich media features (screenshots, video call extension)
    → Easy WebRTC integration
    → Proven track record in chat apps (Slack, Discord, Signal)
    → Memory consumption accepted as a trade-off
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next steps.

### Q3: How is this used in professional practice?

Knowledge of this topic is frequently applied in daily development work. It is especially important during code reviews and architecture design.

---

## Summary

| Technology | Best Use Case | Bundle Size | Memory | Learning Cost |
|------------|--------------|-------------|--------|---------------|
| Electron | Desktopifying existing web apps | ~150MB | ~200MB | Low |
| Tauri v2 | New lightweight desktop apps | ~5MB | ~50MB | Medium |
| WinUI 3 | Windows native business apps | ~20MB | ~100MB | Medium |
| WPF | Windows business apps (including legacy) | ~20MB | ~100MB | Medium |
| MAUI | .NET multi-platform | ~30MB | ~120MB | Medium |
| Flutter | Multi-platform with unified UI | ~20MB | ~80MB | Medium |
| Qt | High performance / industrial use | ~30MB | ~60MB | High |
| PWA | Lightweight web-based apps | 0MB | Browser dependent | Low |

---

## Next Guides to Read

---

## References
1. Electron. "Quick Start." electronjs.org/docs, 2024.
2. Tauri. "Prerequisites." tauri.app/start, 2024.
3. Microsoft. "Windows App SDK." learn.microsoft.com, 2024.
4. Microsoft. "WPF Overview." learn.microsoft.com, 2024.
5. Flutter. "Desktop support for Flutter." flutter.dev, 2024.
6. Qt. "Qt for Application Development." qt.io, 2024.
7. Electron. "Security Best Practices." electronjs.org/docs/latest/tutorial/security, 2024.
8. Tauri. "Security." tauri.app/security, 2024.

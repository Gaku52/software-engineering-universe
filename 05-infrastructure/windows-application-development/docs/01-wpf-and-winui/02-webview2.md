# WebView2 Integration

> Learn hybrid application design by embedding web content in native apps using the WebView2 control, which is based on Microsoft Edge (Chromium).

---

## What You Will Learn

1. Understand **how to set up the WebView2 control** and integrate it into WinUI 3 / WPF applications
2. Implement **bidirectional communication between Web and Native** (JavaScript ↔ C#)
3. Understand the **security model** and design safe hybrid applications
4. Master **performance optimization** and **debugging techniques** to build production-quality hybrid applications


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [WinUI 3 Basics](./01-winui3-basics.md)

---

## 1. What Is WebView2?

### 1.1 Architecture

```
+----------------------------------------------+
|            Host Application                   |
|  (WinUI 3 / WPF / WinForms / Win32)         |
|                                              |
|  +-----------------------------------------+ |
|  |           WebView2 Control               | |
|  |  +-----------------------------------+  | |
|  |  |   Chromium Rendering Engine       |  | |
|  |  |   (Edge WebView2 Runtime)         |  | |
|  |  +-----------------------------------+  | |
|  |       ↕ IPC (COM/JSON)                  | |
|  |  +-----------------------------------+  | |
|  |  |   Native Host (C# / C++)          |  | |
|  |  +-----------------------------------+  | |
|  +-----------------------------------------+ |
+----------------------------------------------+
```

WebView2 uses the same Chromium engine as Microsoft Edge, but runs as an **independent browser process** inside the application. This enables tight integration with native apps while supporting modern web standards.

### 1.2 Process Model Details

WebView2 consists of multiple processes. The host application runs in a single Main process, and WebView2 separately launches a browser process, GPU process, utility processes, and renderer processes.

```
+----------------------------------------------------------+
|  Host App (Main Process)                                  |
|    └── CoreWebView2Environment                            |
|         └── CoreWebView2Controller                        |
|              └── CoreWebView2                             |
|                   ├── Browser Process (shared)            |
|                   │   ├── GPU Process                     |
|                   │   └── Utility Processes               |
|                   └── Renderer Process (per WebView2)     |
|                        └── V8 JavaScript Engine           |
+----------------------------------------------------------+
```

This isolation model ensures that a crash in the web content does not affect the host app and that security boundaries are clearly maintained.

### 1.3 Comparison: WebView2 vs. CEF / Electron

| Item | WebView2 | CEF (CefSharp) | Electron |
|---|---|---|---|
| Engine | Edge Chromium | Chromium (custom build) | Chromium (bundled) |
| Runtime Size | Shared (0 MB added*) | ~200 MB | ~150 MB |
| Update Method | OS/runtime update | Bundled with app | Bundled with app |
| Host Language | C# / C++ / Win32 | C# | JavaScript/TypeScript |
| Process Model | Isolated processes | Isolated processes | Main + Renderer |
| License | Free | BSD | MIT |
| Communication | PostMessage / HostObject | CefSharp API | IPC (contextBridge) |
| Cross-platform | Windows only | Windows / macOS / Linux | Windows / macOS / Linux |
| Memory Usage | Low–medium (shared runtime) | Medium–high | High |
| Startup Speed | Fast (runtime pre-loaded) | Moderate | Slow |

*Windows 11 has the WebView2 Runtime pre-installed. Windows 10 requires a separate installation.

---

## 2. Setup

### Code Example 1: Adding the NuGet Package

```xml
<!-- Add the WebView2 package to the project file (.csproj) -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0-windows10.0.19041.0</TargetFramework>
    <UseWinUI>true</UseWinUI>
  </PropertyGroup>

  <ItemGroup>
    <!-- WebView2 SDK -->
    <PackageReference Include="Microsoft.Web.WebView2" Version="1.0.2478.35" />
    <!-- Windows App SDK -->
    <PackageReference Include="Microsoft.WindowsAppSDK" Version="1.5.240627000" />
  </ItemGroup>
</Project>
```

### Code Example 2: Basic WebView2 Layout (WinUI 3)

```xml
<!-- WebView2Page.xaml — XAML for placing the WebView2 control -->
<Page
    x:Class="HybridApp.WebView2Page"
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    xmlns:controls="using:Microsoft.UI.Xaml.Controls">

    <Grid>
        <Grid.RowDefinitions>
            <!-- Navigation bar -->
            <RowDefinition Height="Auto" />
            <!-- WebView2 content -->
            <RowDefinition Height="*" />
        </Grid.RowDefinitions>

        <!-- Address bar UI -->
        <StackPanel Grid.Row="0" Orientation="Horizontal"
                    Spacing="8" Padding="8">
            <Button Content="←" Click="GoBack_Click" />
            <Button Content="→" Click="GoForward_Click" />
            <Button Content="↻" Click="Reload_Click" />
            <TextBox x:Name="AddressBar" Width="400"
                     KeyDown="AddressBar_KeyDown" />
        </StackPanel>

        <!-- WebView2 control -->
        <WebView2 x:Name="WebView" Grid.Row="1"
                  NavigationCompleted="WebView_NavigationCompleted" />
    </Grid>
</Page>
```

```csharp
// WebView2Page.xaml.cs — WebView2 initialization and basic operations
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.Web.WebView2.Core;

namespace HybridApp;

public sealed partial class WebView2Page : Page
{
    public WebView2Page()
    {
        this.InitializeComponent();
        // Initialize WebView2 after the page has loaded
        this.Loaded += async (s, e) => await InitializeWebView();
    }

    private async Task InitializeWebView()
    {
        // Initialize the WebView2 environment (detect and connect to the runtime)
        await WebView.EnsureCoreWebView2Async();

        // Navigate to the initial page
        WebView.CoreWebView2.Navigate("https://example.com");

        // Setting: enable developer tools (recommended only during debugging)
        WebView.CoreWebView2.Settings.AreDevToolsEnabled = true;

        // Setting: disable context menu (for production)
        WebView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
    }

    // Update the address bar when navigation completes
    private void WebView_NavigationCompleted(
        WebView2 sender, CoreWebView2NavigationCompletedEventArgs args)
    {
        AddressBar.Text = WebView.CoreWebView2.Source;
    }

    private void GoBack_Click(object s, RoutedEventArgs e)
        => WebView.CoreWebView2?.GoBack();

    private void GoForward_Click(object s, RoutedEventArgs e)
        => WebView.CoreWebView2?.GoForward();

    private void Reload_Click(object s, RoutedEventArgs e)
        => WebView.CoreWebView2?.Reload();

    // Navigate to the URL when Enter is pressed
    private void AddressBar_KeyDown(object s, KeyRoutedEventArgs e)
    {
        if (e.Key == Windows.System.VirtualKey.Enter)
        {
            WebView.CoreWebView2?.Navigate(AddressBar.Text);
        }
    }
}
```

### Code Example 2b: WebView2 Layout in WPF

```xml
<!-- MainWindow.xaml — WebView2 layout in WPF -->
<Window x:Class="HybridApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:wv2="clr-namespace:Microsoft.Web.WebView2.Wpf;assembly=Microsoft.Web.WebView2.Wpf"
        Title="WebView2 Hybrid App" Height="700" Width="1100">

    <Grid>
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
            <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>

        <!-- Toolbar -->
        <ToolBar Grid.Row="0">
            <Button Content="Back" Click="GoBack_Click"/>
            <Button Content="Forward" Click="GoForward_Click"/>
            <Button Content="Refresh" Click="Reload_Click"/>
            <Separator/>
            <TextBox x:Name="UrlTextBox" Width="500"
                     KeyDown="UrlTextBox_KeyDown"/>
            <Button Content="Go" Click="Navigate_Click"/>
        </ToolBar>

        <!-- WebView2 control (WPF version) -->
        <wv2:WebView2 x:Name="WebView" Grid.Row="1"
                      Source="https://example.com"
                      NavigationCompleted="WebView_NavigationCompleted"
                      CoreWebView2InitializationCompleted="WebView_CoreWebView2InitializationCompleted"/>

        <!-- Status bar -->
        <StatusBar Grid.Row="2">
            <StatusBarItem>
                <TextBlock x:Name="StatusText" Text="Ready"/>
            </StatusBarItem>
        </StatusBar>
    </Grid>
</Window>
```

```csharp
// MainWindow.xaml.cs — WPF initialization code
using System.Windows;
using System.Windows.Input;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace HybridApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }

    // CoreWebView2 initialization completed event
    private void WebView_CoreWebView2InitializationCompleted(
        object? sender, CoreWebView2InitializationCompletedEventArgs e)
    {
        if (!e.IsSuccess)
        {
            StatusText.Text = $"WebView2 initialization error: {e.InitializationException?.Message}";
            return;
        }

        var settings = WebView.CoreWebView2.Settings;
        settings.AreDevToolsEnabled = true;
        settings.IsStatusBarEnabled = false;
        settings.AreDefaultContextMenusEnabled = false;

        // Subscribe to navigation started event
        WebView.CoreWebView2.NavigationStarting += (s, args) =>
        {
            StatusText.Text = $"Loading: {args.Uri}";
        };

        // Subscribe to download started event
        WebView.CoreWebView2.DownloadStarting += (s, args) =>
        {
            // Customize the download destination
            args.ResultFilePath = System.IO.Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
                "HybridApp", "Downloads",
                System.IO.Path.GetFileName(args.ResultFilePath));
        };

        StatusText.Text = "WebView2 initialization complete";
    }

    private void WebView_NavigationCompleted(
        object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        UrlTextBox.Text = WebView.CoreWebView2.Source;
        StatusText.Text = e.IsSuccess ? "Load complete" : $"Error: {e.WebErrorStatus}";
    }

    private void GoBack_Click(object sender, RoutedEventArgs e)
        => WebView.CoreWebView2?.GoBack();

    private void GoForward_Click(object sender, RoutedEventArgs e)
        => WebView.CoreWebView2?.GoForward();

    private void Reload_Click(object sender, RoutedEventArgs e)
        => WebView.CoreWebView2?.Reload();

    private void Navigate_Click(object sender, RoutedEventArgs e)
        => NavigateToUrl();

    private void UrlTextBox_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter) NavigateToUrl();
    }

    private void NavigateToUrl()
    {
        var url = UrlTextBox.Text;
        if (!url.StartsWith("http://") && !url.StartsWith("https://"))
            url = "https://" + url;
        WebView.CoreWebView2?.Navigate(url);
    }
}
```

### Code Example 2c: Custom WebView2 Environment Configuration

```csharp
// Initialize WebView2 with custom environment settings
private async Task InitializeWithCustomEnvironment()
{
    // Customize the user data folder
    // (useful when isolating multiple WebView2 instances from each other)
    var userDataFolder = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "HybridApp", "WebView2Data");

    // Configure environment options
    var options = new CoreWebView2EnvironmentOptions
    {
        // Additional browser arguments
        AdditionalBrowserArguments = "--disable-web-security=false --enable-features=msWebView2EnableDraggableRegions",
        // Language setting
        Language = "ja",
        // Proxy settings
        // AdditionalBrowserArguments = "--proxy-server=\"socks5://proxy.example.com:1080\"",
    };

    // Initialize WebView2 with the custom environment
    var environment = await CoreWebView2Environment.CreateAsync(
        browserExecutableFolder: null,  // null = use the system Edge
        userDataFolder: userDataFolder,
        options: options);

    await WebView.EnsureCoreWebView2Async(environment);

    // Configure the cookie manager
    var cookieManager = WebView.CoreWebView2.CookieManager;
    // Set a specific cookie
    var cookie = cookieManager.CreateCookie(
        name: "session",
        value: "abc123",
        domain: "app.local",
        path: "/");
    cookie.IsSecure = true;
    cookie.IsHttpOnly = true;
    cookie.SameSite = CoreWebView2CookieSameSiteKind.Strict;
    cookieManager.AddOrUpdateCookie(cookie);
}
```

---

## 3. Web ↔ Native Communication

### 3.1 Communication Architecture

```
+----------------------------+     +----------------------------+
|      Web (JavaScript)      |     |     Native (C#)            |
|                            |     |                            |
|  window.chrome.webview     |     |  CoreWebView2              |
|    .postMessage(json) ──────────→  .WebMessageReceived       |
|                            |     |                            |
|  window.chrome.webview     |     |  CoreWebView2              |
|    .addEventListener() ←────────  .PostWebMessageAsJson()    |
|                            |     |                            |
|  window.nativeApi          |     |  AddHostObjectToScript()   |
|    .methodCall() ────────────────→  [ComVisible] class        |
+----------------------------+     +----------------------------+
        ↕ PostMessage                     ↕ HostObject
   (async, JSON string)           (sync/async, direct call)
```

### Code Example 3: Bidirectional Communication via PostMessage

```csharp
// Native side: message send/receive setup
private async Task SetupMessaging()
{
    await WebView.EnsureCoreWebView2Async();

    // Web → Native: message receive handler
    WebView.CoreWebView2.WebMessageReceived += (sender, args) =>
    {
        // Receive the message as a JSON string
        string message = args.WebMessageAsJson;
        var data = JsonSerializer.Deserialize<MessagePayload>(message);

        switch (data?.Type)
        {
            case "saveFile":
                // Use the native file save dialog
                HandleSaveFile(data.Content);
                break;
            case "getSystemInfo":
                // Return system information to the web side
                var info = new { os = Environment.OSVersion.ToString(),
                                 memory = GC.GetTotalMemory(false) };
                string response = JsonSerializer.Serialize(info);
                // Native → Web: send message
                WebView.CoreWebView2.PostWebMessageAsJson(response);
                break;
        }
    };
}

// Message payload type definition
record MessagePayload(string Type, string Content);
```

```javascript
// Web side (JavaScript): message send/receive

// Function to send a message to Native
function sendToNative(type, content) {
  // Send data to the Native side via chrome.webview.postMessage
  window.chrome.webview.postMessage(
    JSON.stringify({ type, content })
  );
}

// Listener to receive messages from Native
window.chrome.webview.addEventListener('message', (event) => {
  // event.data contains the JSON sent from Native
  const data = JSON.parse(event.data);
  console.log('Response from native:', data);
  document.getElementById('result').textContent = JSON.stringify(data);
});

// Usage: request a file save
document.getElementById('saveBtn').addEventListener('click', () => {
  sendToNative('saveFile', 'Content to save here');
});

// Usage: get system information
document.getElementById('infoBtn').addEventListener('click', () => {
  sendToNative('getSystemInfo', '');
});
```

### Code Example 3b: Building a Type-Safe Communication Layer

```csharp
// Native side: implementing a structured message router
using System.Text.Json;
using System.Text.Json.Serialization;

namespace HybridApp.Communication;

// Base class for messages
public record BridgeMessage
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = Guid.NewGuid().ToString();

    [JsonPropertyName("type")]
    public string Type { get; init; } = "";

    [JsonPropertyName("payload")]
    public JsonElement? Payload { get; init; }
}

// Response message
public record BridgeResponse
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = "";

    [JsonPropertyName("success")]
    public bool Success { get; init; }

    [JsonPropertyName("data")]
    public object? Data { get; init; }

    [JsonPropertyName("error")]
    public string? Error { get; init; }
}

// Message router: dispatches messages to handlers based on message type
public class MessageRouter
{
    private readonly Dictionary<string, Func<JsonElement?, Task<object?>>> _handlers = new();

    // Register a handler
    public void Register(string messageType, Func<JsonElement?, Task<object?>> handler)
    {
        _handlers[messageType] = handler;
    }

    // Register a type-safe handler
    public void Register<TPayload, TResult>(
        string messageType,
        Func<TPayload, Task<TResult>> handler) where TPayload : class
    {
        _handlers[messageType] = async (payload) =>
        {
            var typedPayload = payload.HasValue
                ? JsonSerializer.Deserialize<TPayload>(payload.Value.GetRawText())
                : null;

            if (typedPayload == null)
                throw new ArgumentException($"Failed to deserialize payload: {messageType}");

            return await handler(typedPayload);
        };
    }

    // Route a message
    public async Task<BridgeResponse> Route(BridgeMessage message)
    {
        if (!_handlers.TryGetValue(message.Type, out var handler))
        {
            return new BridgeResponse
            {
                Id = message.Id,
                Success = false,
                Error = $"Unknown message type: {message.Type}"
            };
        }

        try
        {
            var result = await handler(message.Payload);
            return new BridgeResponse
            {
                Id = message.Id,
                Success = true,
                Data = result
            };
        }
        catch (Exception ex)
        {
            return new BridgeResponse
            {
                Id = message.Id,
                Success = false,
                Error = ex.Message
            };
        }
    }
}

// Usage example: setting up the message router
public class HybridBridge
{
    private readonly MessageRouter _router = new();
    private readonly CoreWebView2 _webView;

    public HybridBridge(CoreWebView2 webView)
    {
        _webView = webView;

        // Register handlers
        _router.Register<SaveFileRequest, SaveFileResult>(
            "saveFile", HandleSaveFile);

        _router.Register<SearchRequest, SearchResult>(
            "search", HandleSearch);

        // Configure WebView2 message reception
        _webView.WebMessageReceived += OnWebMessageReceived;
    }

    private async void OnWebMessageReceived(object? sender,
        CoreWebView2WebMessageReceivedEventArgs args)
    {
        var message = JsonSerializer.Deserialize<BridgeMessage>(args.WebMessageAsJson);
        if (message == null) return;

        var response = await _router.Route(message);
        var responseJson = JsonSerializer.Serialize(response);
        _webView.PostWebMessageAsJson(responseJson);
    }

    private async Task<SaveFileResult> HandleSaveFile(SaveFileRequest request)
    {
        // File save implementation
        await File.WriteAllTextAsync(request.Path, request.Content);
        return new SaveFileResult { BytesWritten = request.Content.Length };
    }

    private async Task<SearchResult> HandleSearch(SearchRequest request)
    {
        // Search implementation
        await Task.Delay(100); // Simulation
        return new SearchResult
        {
            Results = new[] { "Result 1", "Result 2", "Result 3" },
            TotalCount = 3
        };
    }
}

// Request/response type definitions
public record SaveFileRequest(string Path, string Content);
public record SaveFileResult { public int BytesWritten { get; init; } }
public record SearchRequest(string Query, int MaxResults);
public record SearchResult
{
    public string[] Results { get; init; } = Array.Empty<string>();
    public int TotalCount { get; init; }
}
```

```javascript
// Web side: type-safe communication wrapper (written in TypeScript style)

// Bridge class: Promise-based request/response management
class NativeBridge {
  constructor() {
    this.pendingRequests = new Map();

    // Receive responses from Native
    window.chrome.webview.addEventListener('message', (event) => {
      const response = JSON.parse(event.data);
      const pending = this.pendingRequests.get(response.id);
      if (pending) {
        this.pendingRequests.delete(response.id);
        if (response.success) {
          pending.resolve(response.data);
        } else {
          pending.reject(new Error(response.error));
        }
      }
    });
  }

  // Send a request to Native and return the response as a Promise
  invoke(type, payload) {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      this.pendingRequests.set(id, { resolve, reject });

      window.chrome.webview.postMessage(JSON.stringify({
        id,
        type,
        payload
      }));

      // Set timeout (30 seconds)
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timed out: ${type}`));
        }
      }, 30000);
    });
  }
}

// Global instance
const bridge = new NativeBridge();

// Usage examples
async function saveDocument(content) {
  try {
    const result = await bridge.invoke('saveFile', {
      path: 'document.txt',
      content: content
    });
    console.log(`Save complete: ${result.bytesWritten} bytes`);
  } catch (error) {
    console.error('Save error:', error.message);
  }
}

async function searchDocuments(query) {
  const result = await bridge.invoke('search', {
    query: query,
    maxResults: 10
  });
  return result.results;
}
```

### Code Example 4: Direct Method Calls via HostObject

```csharp
// Native side: define a COM-visible host object
using System.Runtime.InteropServices;

namespace HybridApp;

// A class that can be called directly from JavaScript via COM
[ClassInterface(ClassInterfaceType.AutoDual)]
[ComVisible(true)]
public class NativeApi
{
    // Read a file
    public string ReadFile(string path)
    {
        if (!IsPathAllowed(path))
            throw new UnauthorizedAccessException("Access to this path is not permitted");

        return File.ReadAllText(path);
    }

    // Show a notification
    public void ShowNotification(string title, string message)
    {
        // Call the Windows notification API
        new ToastContentBuilder()
            .AddText(title)
            .AddText(message)
            .Show();
    }

    // Path allowance check (security)
    private bool IsPathAllowed(string path)
    {
        var allowedBase = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
            "HybridApp");
        return Path.GetFullPath(path).StartsWith(allowedBase);
    }
}

// Register the HostObject with WebView2
private async Task RegisterHostObject()
{
    await WebView.EnsureCoreWebView2Async();

    // Make it accessible from JavaScript under the name "nativeApi"
    WebView.CoreWebView2.AddHostObjectToScript("nativeApi", new NativeApi());
}
```

```javascript
// Web side: calling native APIs using HostObject

// Get a proxy to the HostObject (asynchronous)
const nativeApi = window.chrome.webview.hostObjects.nativeApi;

// Call a native method (result is returned asynchronously)
async function readNativeFile() {
  try {
    const content = await nativeApi.ReadFile('C:\\Users\\docs\\data.txt');
    document.getElementById('fileContent').textContent = content;
  } catch (error) {
    console.error('File read error:', error);
  }
}

// Show a notification (no return value)
async function showNotification() {
  await nativeApi.ShowNotification(
    'Task Complete',
    'Data synchronization has finished'
  );
}
```

---

## 4. Hybrid App Design Patterns

### 4.1 Comparison of Design Patterns

| Pattern | Description | Use Case |
|---|---|---|
| Web Primary | Most of the UI is built with web; native is a thin shell | Turning an existing web app into a desktop app |
| Native Primary | Native UI is the main interface, with some parts displayed in WebView2 | Dashboards, report display |
| Hybrid Split | Use web or native on a per-screen basis | Complex apps undergoing incremental migration |
| Micro Frontend | Integrate different web apps using multiple WebView2 instances | Microservice-style UI integration |

### Code Example 5: Serving Local Content

```csharp
// Configuration to securely serve local HTML/JS/CSS
private async Task SetupLocalContent()
{
    await WebView.EnsureCoreWebView2Async();

    // Map a virtual host name to a local folder
    // Accessing the host name "app.local" returns local files
    WebView.CoreWebView2.SetVirtualHostNameToFolderMapping(
        hostName: "app.local",
        folderPath: Path.Combine(AppContext.BaseDirectory, "WebContent"),
        accessKind: CoreWebView2HostResourceAccessKind.Allow
    );

    // Access local content via the virtual URL
    WebView.CoreWebView2.Navigate("https://app.local/index.html");
}
```

```
Project directory structure:

HybridApp/
├── HybridApp.csproj
├── App.xaml / App.xaml.cs
├── MainWindow.xaml / MainWindow.xaml.cs
├── NativeApi.cs                  ← HostObject definition
├── WebContent/                   ← Web content (build artifacts)
│   ├── index.html
│   ├── assets/
│   │   ├── app.js
│   │   └── style.css
│   └── images/
└── Services/
    ├── FileService.cs            ← File operation service
    └── NotificationService.cs    ← Notification service
```

### Code Example 5b: Integrating a React SPA as Local Content

```csharp
// Configuration to display React build artifacts in WebView2
private async Task SetupReactApp()
{
    await WebView.EnsureCoreWebView2Async();

    // Map the React build output
    var webContentPath = Path.Combine(AppContext.BaseDirectory, "wwwroot");

    WebView.CoreWebView2.SetVirtualHostNameToFolderMapping(
        hostName: "app.local",
        folderPath: webContentPath,
        accessKind: CoreWebView2HostResourceAccessKind.Allow
    );

    // Intercept requests to the API server
    WebView.CoreWebView2.AddWebResourceRequestedFilter(
        "https://api.local/*",
        CoreWebView2WebResourceContext.All);

    WebView.CoreWebView2.WebResourceRequested += async (sender, args) =>
    {
        var deferral = args.GetDeferral();
        try
        {
            var uri = new Uri(args.Request.Uri);
            var apiPath = uri.PathAndQuery.TrimStart('/');

            // Route to the local API handler
            var (statusCode, responseBody) = await HandleApiRequest(
                args.Request.Method, apiPath, args.Request.Content);

            var stream = new MemoryStream(
                System.Text.Encoding.UTF8.GetBytes(responseBody));

            args.Response = WebView.CoreWebView2.Environment
                .CreateWebResourceResponse(
                    stream, statusCode, "OK", "Content-Type: application/json");
        }
        finally
        {
            deferral.Complete();
        }
    };

    WebView.CoreWebView2.Navigate("https://app.local/index.html");
}

// Handle local API requests
private async Task<(int statusCode, string body)> HandleApiRequest(
    string method, string path, Stream? requestBody)
{
    // REST API-style routing
    return path switch
    {
        "api/tasks" when method == "GET" =>
            (200, JsonSerializer.Serialize(await GetAllTasks())),
        "api/tasks" when method == "POST" =>
            (201, JsonSerializer.Serialize(await CreateTask(requestBody))),
        _ => (404, "{\"error\": \"Not Found\"}")
    };
}
```

### Code Example 5c: Managing Multiple WebView2 Instances

```csharp
// Manager for handling multiple WebView2 panels
public class WebViewPanelManager
{
    private readonly Dictionary<string, WebView2> _panels = new();
    private readonly CoreWebView2Environment _sharedEnvironment;

    public WebViewPanelManager(CoreWebView2Environment environment)
    {
        _sharedEnvironment = environment;
    }

    // Create a new WebView2 panel
    public async Task<WebView2> CreatePanel(
        string panelId, Panel container, string initialUrl)
    {
        if (_panels.ContainsKey(panelId))
        {
            return _panels[panelId];
        }

        var webView = new WebView2();
        container.Children.Add(webView);

        // Initialize using the shared environment (better memory efficiency)
        await webView.EnsureCoreWebView2Async(_sharedEnvironment);

        // Inject a script for inter-panel communication
        await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(@"
            window.panelId = '" + panelId + @"';
            window.sendToPanel = function(targetPanelId, message) {
                window.chrome.webview.postMessage(JSON.stringify({
                    type: 'panel-message',
                    source: window.panelId,
                    target: targetPanelId,
                    data: message
                }));
            };
        ");

        // Route inter-panel messages
        webView.CoreWebView2.WebMessageReceived += (sender, args) =>
        {
            var message = JsonSerializer.Deserialize<PanelMessage>(args.WebMessageAsJson);
            if (message?.Type == "panel-message" && _panels.TryGetValue(message.Target, out var targetPanel))
            {
                targetPanel.CoreWebView2.PostWebMessageAsJson(
                    JsonSerializer.Serialize(new { source = message.Source, data = message.Data }));
            }
        };

        webView.CoreWebView2.Navigate(initialUrl);
        _panels[panelId] = webView;

        return webView;
    }

    // Destroy a panel
    public void DestroyPanel(string panelId)
    {
        if (_panels.TryGetValue(panelId, out var webView))
        {
            webView.CoreWebView2?.Stop();
            webView.Dispose();
            _panels.Remove(panelId);
        }
    }

    // Broadcast to all panels
    public void Broadcast(string message)
    {
        foreach (var (_, panel) in _panels)
        {
            panel.CoreWebView2?.PostWebMessageAsJson(message);
        }
    }
}

record PanelMessage(string Type, string Source, string Target, JsonElement Data);
```

---

## 5. Security

### 5.1 Overview of Security Settings

```
+------------------------------------------+
|         WebView2 Security Layers          |
+------------------------------------------+
|                                          |
|  1. Navigation Control                   |
|     → Whitelist of allowed URLs          |
|                                          |
|  2. Script Execution Control             |
|     → Only trusted scripts allowed       |
|                                          |
|  3. HostObject Access Control            |
|     → Expose only minimal APIs           |
|                                          |
|  4. Content Security Policy              |
|     → CSP headers to prevent XSS         |
|                                          |
|  5. Process Isolation                    |
|     → WebView2 runs in a separate process|
|                                          |
|  6. Download Control                     |
|     → Only permitted file types          |
|                                          |
|  7. Certificate Validation               |
|     → Custom certificate validation logic|
+------------------------------------------+
```

### Security Configuration Code

```csharp
// Strengthen WebView2 security settings
private async Task ConfigureSecurity()
{
    await WebView.EnsureCoreWebView2Async();
    var settings = WebView.CoreWebView2.Settings;

    // Disable developer tools in production
    settings.AreDevToolsEnabled = false;

    // Disable right-click menu
    settings.AreDefaultContextMenusEnabled = false;

    // Disable the built-in PDF viewer (if not needed)
    settings.IsBuiltInErrorPageEnabled = false;

    // Disable the status bar
    settings.IsStatusBarEnabled = false;

    // Navigation control: block navigation to non-allowed domains
    WebView.CoreWebView2.NavigationStarting += (sender, args) =>
    {
        var uri = new Uri(args.Uri);
        var allowedHosts = new[] { "app.local", "api.example.com" };

        if (!allowedHosts.Contains(uri.Host))
        {
            // Cancel navigation to domains not on the allowlist
            args.Cancel = true;
            System.Diagnostics.Debug.WriteLine(
                $"Blocked: {args.Uri} is not in the allowlist");
        }
    };

    // Block opening new windows
    WebView.CoreWebView2.NewWindowRequested += (sender, args) =>
    {
        // Prevent popups and navigate within the current window
        args.Handled = true;
        WebView.CoreWebView2.Navigate(args.Uri);
    };
}
```

### Code Example 5d: Advanced Security Configuration

```csharp
// Dynamically inject a Content Security Policy
private async Task SetupCSP()
{
    await WebView.EnsureCoreWebView2Async();

    // Monitor response headers via WebResourceResponseReceived
    WebView.CoreWebView2.WebResourceResponseReceived += (sender, args) =>
    {
        var headers = args.Response.Headers;
        // Check for CSP header (for debugging)
        if (headers.Contains("Content-Security-Policy"))
        {
            var enumerator = headers.GetEnumerator();
            while (enumerator.MoveNext())
            {
                System.Diagnostics.Debug.WriteLine(
                    $"Header: {enumerator.Current.Key} = {enumerator.Current.Value}");
            }
        }
    };

    // Script to inject CSP on page load
    await WebView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(@"
        // Add a CSP meta tag
        const meta = document.createElement('meta');
        meta.httpEquiv = 'Content-Security-Policy';
        meta.content = ""default-src 'self' https://app.local; "" +
                       ""script-src 'self' https://app.local; "" +
                       ""style-src 'self' https://app.local 'unsafe-inline'; "" +
                       ""img-src 'self' https://app.local data:; "" +
                       ""connect-src 'self' https://api.example.com;"";
        document.head.prepend(meta);
    ");
}

// Implement download control
private void SetupDownloadControl()
{
    var allowedExtensions = new HashSet<string>
    {
        ".pdf", ".csv", ".xlsx", ".docx", ".txt", ".json"
    };

    WebView.CoreWebView2.DownloadStarting += (sender, args) =>
    {
        var ext = Path.GetExtension(args.ResultFilePath).ToLowerInvariant();

        if (!allowedExtensions.Contains(ext))
        {
            // Cancel downloads of non-permitted file types
            args.Cancel = true;
            System.Diagnostics.Debug.WriteLine(
                $"Download blocked: {args.ResultFilePath} (extension: {ext})");
            return;
        }

        // Restrict the download destination to the app's download folder
        var safeDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
            "HybridApp", "Downloads");
        Directory.CreateDirectory(safeDir);
        args.ResultFilePath = Path.Combine(safeDir, Path.GetFileName(args.ResultFilePath));
    };
}

// Handle certificate errors
private void SetupCertificateHandling()
{
    WebView.CoreWebView2.ServerCertificateErrorDetected += (sender, args) =>
    {
        // Allow self-signed certificates in development (prohibited in production)
#if DEBUG
        if (args.RequestUri.StartsWith("https://localhost"))
        {
            args.Action = CoreWebView2ServerCertificateErrorAction.AlwaysAllow;
            return;
        }
#endif
        // Reject certificate errors in production
        args.Action = CoreWebView2ServerCertificateErrorAction.Cancel;
        System.Diagnostics.Debug.WriteLine(
            $"Certificate error: {args.RequestUri} - {args.ErrorStatus}");
    };
}
```

---

## 6. Performance Optimization

### 6.1 Optimizing WebView2 Startup Time

```csharp
// Performance optimization: pre-create the environment
public class WebView2EnvironmentPool
{
    private static CoreWebView2Environment? _sharedEnvironment;
    private static readonly SemaphoreSlim _lock = new(1);

    // Pre-create the environment as a singleton
    public static async Task<CoreWebView2Environment> GetOrCreateAsync()
    {
        if (_sharedEnvironment != null) return _sharedEnvironment;

        await _lock.WaitAsync();
        try
        {
            if (_sharedEnvironment != null) return _sharedEnvironment;

            var userDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "HybridApp", "WebView2");

            _sharedEnvironment = await CoreWebView2Environment.CreateAsync(
                browserExecutableFolder: null,
                userDataFolder: userDataFolder,
                options: new CoreWebView2EnvironmentOptions
                {
                    Language = "ja",
                });

            return _sharedEnvironment;
        }
        finally
        {
            _lock.Release();
        }
    }
}

// Pre-warm the environment at app startup
public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        // Pre-create the WebView2 environment in the background
        _ = WebView2EnvironmentPool.GetOrCreateAsync();
    }
}
```

### 6.2 Optimizing JavaScript Execution

```csharp
// Optimized script execution techniques
private async Task OptimizedScriptExecution()
{
    await WebView.EnsureCoreWebView2Async();

    // Optimization 1: inject scripts only once at document creation
    // (more efficient than calling ExecuteScriptAsync each time)
    var scriptId = await WebView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(@"
        // Pre-define helper functions
        window.__appBridge = {
            cache: new Map(),
            batchQueue: [],
            flushInterval: null,

            // Batch processing: send multiple messages together
            queueMessage(msg) {
                this.batchQueue.push(msg);
                if (!this.flushInterval) {
                    this.flushInterval = setTimeout(() => {
                        this.flush();
                    }, 16); // Batch interval aligned to 60fps
                }
            },

            flush() {
                if (this.batchQueue.length > 0) {
                    window.chrome.webview.postMessage(JSON.stringify({
                        type: 'batch',
                        messages: this.batchQueue
                    }));
                    this.batchQueue = [];
                }
                this.flushInterval = null;
            }
        };
    ");

    // Optimization 2: cache DOM element references to avoid repeated queries
    await WebView.CoreWebView2.ExecuteScriptAsync(@"
        // Cache frequently used DOM references
        const elements = {
            output: document.getElementById('output'),
            status: document.getElementById('status'),
            list: document.getElementById('list')
        };
        window.__cachedElements = elements;
    ");
}

// Handle batch messages
private void HandleBatchMessages(string jsonMessage)
{
    var batch = JsonSerializer.Deserialize<BatchMessage>(jsonMessage);
    if (batch?.Type == "batch" && batch.Messages != null)
    {
        foreach (var msg in batch.Messages)
        {
            ProcessSingleMessage(msg);
        }
    }
}

record BatchMessage(string Type, JsonElement[]? Messages);
```

### 6.3 Memory Management

```csharp
// Monitor and manage memory usage
public class WebView2MemoryMonitor
{
    private readonly WebView2 _webView;
    private readonly Timer _monitorTimer;
    private const long MemoryWarningThreshold = 500 * 1024 * 1024; // 500MB

    public WebView2MemoryMonitor(WebView2 webView)
    {
        _webView = webView;
        _monitorTimer = new Timer(CheckMemory, null, TimeSpan.Zero, TimeSpan.FromMinutes(1));
    }

    private async void CheckMemory(object? state)
    {
        try
        {
            // Get JavaScript heap memory usage
            var result = await _webView.CoreWebView2.ExecuteScriptAsync(@"
                JSON.stringify({
                    jsHeapSizeLimit: performance.memory?.jsHeapSizeLimit || 0,
                    totalJSHeapSize: performance.memory?.totalJSHeapSize || 0,
                    usedJSHeapSize: performance.memory?.usedJSHeapSize || 0
                })
            ");

            var memory = JsonSerializer.Deserialize<MemoryInfo>(result.Trim('"'));
            if (memory != null && memory.UsedJSHeapSize > MemoryWarningThreshold)
            {
                System.Diagnostics.Debug.WriteLine(
                    $"Memory warning: JS heap usage {memory.UsedJSHeapSize / 1024 / 1024}MB");

                // Encourage garbage collection
                await _webView.CoreWebView2.ExecuteScriptAsync("window.gc?.()");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Memory monitoring error: {ex.Message}");
        }
    }

    public void Dispose()
    {
        _monitorTimer.Dispose();
    }
}

record MemoryInfo(long JsHeapSizeLimit, long TotalJSHeapSize, long UsedJSHeapSize);
```

---

## 7. Debugging and Troubleshooting

### 7.1 Debugging Tools

```csharp
// Helper configuration for debugging
private async Task SetupDebugging()
{
    await WebView.EnsureCoreWebView2Async();

#if DEBUG
    // Enable DevTools
    WebView.CoreWebView2.Settings.AreDevToolsEnabled = true;

    // Also capture console messages on the C# side
    WebView.CoreWebView2.ConsoleMessageReceived += (sender, args) =>
    {
        var level = args.Level switch
        {
            CoreWebView2ConsoleMessageLevel.Log => "LOG",
            CoreWebView2ConsoleMessageLevel.Warning => "WARN",
            CoreWebView2ConsoleMessageLevel.Error => "ERROR",
            CoreWebView2ConsoleMessageLevel.Info => "INFO",
            _ => "DEBUG"
        };
        System.Diagnostics.Debug.WriteLine(
            $"[WebView2 {level}] {args.Message} ({args.Source}:{args.LineNumber})");
    };

    // Monitor process errors
    WebView.CoreWebView2.ProcessFailed += (sender, args) =>
    {
        System.Diagnostics.Debug.WriteLine(
            $"WebView2 process error: {args.ProcessFailedKind} - {args.Reason}");

        switch (args.ProcessFailedKind)
        {
            case CoreWebView2ProcessFailedKind.BrowserProcessExited:
                // If the browser process exits unexpectedly, restart the app
                System.Diagnostics.Debug.WriteLine("Browser process exited. A restart is required.");
                break;
            case CoreWebView2ProcessFailedKind.RenderProcessExited:
            case CoreWebView2ProcessFailedKind.RenderProcessUnresponsive:
                // If the renderer process exits unexpectedly, reload
                WebView.CoreWebView2.Reload();
                break;
        }
    };

    // Enable performance logging
    WebView.CoreWebView2.NavigationStarting += (s, args) =>
    {
        _navigationStartTime = DateTime.UtcNow;
    };

    WebView.CoreWebView2.NavigationCompleted += (s, args) =>
    {
        var duration = DateTime.UtcNow - _navigationStartTime;
        System.Diagnostics.Debug.WriteLine(
            $"Navigation complete: {duration.TotalMilliseconds}ms (success: {args.IsSuccess})");
    };
#endif
}

private DateTime _navigationStartTime;
```

### 7.2 Common Issues and Solutions

```
+----------------------------------------------------------+
| Problem                     | Cause             | Solution  |
+----------------------------------------------------------+
| WebView2 not displayed       | Runtime not installed | Detect runtime + fallback |
| PostMessage not received     | Timing issue      | Send after NavigationCompleted |
| HostObject method missing    | COM not registered | ComVisible + ClassInterface |
| JavaScript errors not visible| Console not subscribed | ConsoleMessageReceived |
| Memory leak                  | Event not unsubscribed | Explicitly unsubscribe in Dispose |
| Screen flickering            | Initialization display timing | show: false + ready-to-show |
| Slow navigation              | Cache disabled    | Set CacheControl |
+----------------------------------------------------------+
```

---

## 8. WebView2 Runtime Distribution Strategy

### 8.1 Comparison of Distribution Models

| Model | Description | App Size | Updates |
|---|---|---|---|
| Evergreen (recommended) | Use the OS runtime | +0 MB | Automatic |
| Fixed Version | Bundle a specific version | +150 MB | Manual |
| Bootstrapper | Download on first launch | +2 MB | Automatic |

### Code Example 8a: Runtime Detection and Bootstrapper

```csharp
// Detect and automatically install the WebView2 runtime
public static class WebView2RuntimeChecker
{
    public static bool IsRuntimeInstalled()
    {
        try
        {
            var version = CoreWebView2Environment.GetAvailableBrowserVersionString();
            return !string.IsNullOrEmpty(version);
        }
        catch
        {
            return false;
        }
    }

    public static async Task EnsureRuntimeAsync()
    {
        if (IsRuntimeInstalled()) return;

        var result = MessageBox.Show(
            "This application requires the WebView2 Runtime.\n" +
            "Would you like to download and install it now?",
            "WebView2 Runtime Required",
            MessageBoxButton.YesNo,
            MessageBoxImage.Question);

        if (result == MessageBoxResult.Yes)
        {
            await DownloadAndInstallRuntime();
        }
        else
        {
            Application.Current.Shutdown();
        }
    }

    private static async Task DownloadAndInstallRuntime()
    {
        var bootstrapperUrl = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";
        var tempPath = Path.Combine(Path.GetTempPath(), "MicrosoftEdgeWebview2Setup.exe");

        using var httpClient = new HttpClient();
        var data = await httpClient.GetByteArrayAsync(bootstrapperUrl);
        await File.WriteAllBytesAsync(tempPath, data);

        var process = Process.Start(new ProcessStartInfo
        {
            FileName = tempPath,
            Arguments = "/silent /install",
            UseShellExecute = true,
            Verb = "runas" // Run with administrator privileges
        });

        await process!.WaitForExitAsync();

        if (!IsRuntimeInstalled())
        {
            MessageBox.Show(
                "Failed to install the WebView2 Runtime.\n" +
                "Please install it manually.",
                "Error",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
    }
}
```

---

## 9. Anti-Patterns

### Anti-Pattern 1: Exposing All APIs Through HostObject Without Restrictions

```csharp
// Bad: expose an API that allows access to the entire file system
[ComVisible(true)]
public class UnsafeApi
{
    // Allows reading and writing files at any path
    public string ReadAnyFile(string path) => File.ReadAllText(path);
    public void WriteAnyFile(string path, string content) => File.WriteAllText(path, content);
    // Even exposes the registry and environment variables → high security risk
    public string GetEnvVar(string name) => Environment.GetEnvironmentVariable(name) ?? "";
}
```

```csharp
// Good: expose only necessary APIs safely, based on the principle of least privilege
[ComVisible(true)]
public class SafeApi
{
    private readonly string _sandboxDir;

    public SafeApi(string sandboxDir)
    {
        _sandboxDir = sandboxDir;
    }

    // Read-only access within the sandbox directory
    public string ReadFile(string relativePath)
    {
        var fullPath = Path.GetFullPath(
            Path.Combine(_sandboxDir, relativePath));

        // Prevent path traversal attacks
        if (!fullPath.StartsWith(_sandboxDir))
            throw new UnauthorizedAccessException("Access outside the sandbox is prohibited");

        return File.ReadAllText(fullPath);
    }
}
```

### Anti-Pattern 2: Not Checking for the WebView2 Runtime

```csharp
// Bad: crashes in environments where the runtime is not installed
public MainWindow()
{
    InitializeComponent();
    WebView.Source = new Uri("https://example.com"); // ← crashes if runtime not found
}
```

```csharp
// Good: check for the runtime and provide a fallback
public MainWindow()
{
    InitializeComponent();
    CheckWebView2Runtime();
}

private async void CheckWebView2Runtime()
{
    try
    {
        // Get the runtime version to confirm it exists
        var version = CoreWebView2Environment.GetAvailableBrowserVersionString();
        await WebView.EnsureCoreWebView2Async();
        WebView.CoreWebView2.Navigate("https://example.com");
    }
    catch (WebView2RuntimeNotFoundException)
    {
        // Fallback when runtime is not installed
        ShowFallbackUI("The WebView2 Runtime is not installed. "
            + "Would you like to open the download page?");
    }
}
```

### Anti-Pattern 3: Starting Communication Before Navigation Completes

```csharp
// Bad: send a message before WebView2 has finished initializing
public MainWindow()
{
    InitializeComponent();
    // CoreWebView2 is still null at this point
    WebView.CoreWebView2.PostWebMessageAsJson("{}"); // NullReferenceException
}
```

```csharp
// Good: wait for initialization to complete before starting communication
public MainWindow()
{
    InitializeComponent();
    Loaded += async (s, e) =>
    {
        await WebView.EnsureCoreWebView2Async();
        WebView.CoreWebView2.NavigationCompleted += (sender, args) =>
        {
            if (args.IsSuccess)
            {
                // Send message after navigation completes
                WebView.CoreWebView2.PostWebMessageAsJson(
                    JsonSerializer.Serialize(new { type = "init", version = "1.0" }));
            }
        };
        WebView.CoreWebView2.Navigate("https://app.local/index.html");
    };
}
```

### Anti-Pattern 4: Not Unsubscribing Event Handlers

```csharp
// Bad: event handlers accumulate on each page navigation
private void SetupPage()
{
    // A new handler is added each time this function is called → memory leak
    WebView.CoreWebView2.WebMessageReceived += OnMessageReceived;
    WebView.CoreWebView2.NavigationCompleted += OnNavigationCompleted;
}
```

```csharp
// Good: manage event handlers properly
private EventHandler<CoreWebView2WebMessageReceivedEventArgs>? _messageHandler;
private EventHandler<CoreWebView2NavigationCompletedEventArgs>? _navigationHandler;

private void SetupPage()
{
    // Unsubscribe existing handlers before registering new ones
    CleanupHandlers();

    _messageHandler = OnMessageReceived;
    _navigationHandler = OnNavigationCompleted;

    WebView.CoreWebView2.WebMessageReceived += _messageHandler;
    WebView.CoreWebView2.NavigationCompleted += _navigationHandler;
}

private void CleanupHandlers()
{
    if (_messageHandler != null)
        WebView.CoreWebView2.WebMessageReceived -= _messageHandler;
    if (_navigationHandler != null)
        WebView.CoreWebView2.NavigationCompleted -= _navigationHandler;
}

// Clean up when the window is closed
protected override void OnClosed(EventArgs e)
{
    CleanupHandlers();
    WebView?.Dispose();
    base.OnClosed(e);
}
```

---

## 10. FAQ

### Q1: Can the WebView2 Runtime be bundled with the app?

**A:** Yes. Using "Fixed Version Distribution" mode, you can bundle a specific version of the WebView2 Runtime with your app. However, this increases the app size by approximately 150 MB and requires you to manage security updates yourself. In general, "Evergreen Distribution" (automatic updates via the OS) is recommended.

### Q2: Can WebView2 directly access local files?

**A:** The `file://` protocol is restricted by default. The recommended and safe approach for serving local content is to use `SetVirtualHostNameToFolderMapping()` to assign a virtual host name. This also avoids CORS issues.

### Q3: How does WebView2 performance compare to Electron?

**A:** Because WebView2 uses a shared runtime already installed on the OS, the app size is significantly smaller. Memory usage also tends to be lower than Electron (since Electron bundles Chromium with each app). Rendering performance itself is essentially the same, as both use the same Chromium engine.

### Q4: Can React / Vue / Angular and other frameworks be used with WebView2?

**A:** Yes. Because WebView2 is Chromium-based, any web framework such as React, Vue, Angular, or Svelte works without issues. A typical workflow is to use Vite or Webpack's DevServer with Hot Module Replacement during development, and to serve build artifacts via `SetVirtualHostNameToFolderMapping` in production.

### Q5: Can multiple WebView2 instances be used simultaneously?

**A:** Yes. Multiple WebView2 controls can be placed within the same application. Sharing a `CoreWebView2Environment` allows the browser process to be shared, improving memory efficiency. Note, however, that each WebView2 has its own renderer process, so memory usage increases as the number of instances grows.

### Q6: How should printing be implemented in WebView2?

**A:** Use the `CoreWebView2.PrintAsync()` method. `CoreWebView2PrintSettings` allows you to customize page size, margins, orientation, headers/footers, and more. You can also export to PDF using `PrintToPdfAsync()`.

```csharp
// Example printing implementation
private async Task PrintDocument()
{
    var printSettings = WebView.CoreWebView2.Environment.CreatePrintSettings();
    printSettings.Orientation = CoreWebView2PrintOrientation.Portrait;
    printSettings.ScaleFactor = 1.0;
    printSettings.ShouldPrintBackgrounds = true;
    printSettings.ShouldPrintHeaderAndFooter = false;

    // Show the printer dialog and print
    var result = await WebView.CoreWebView2.PrintAsync(printSettings);

    // Or export to PDF
    await WebView.CoreWebView2.PrintToPdfAsync(
        Path.Combine(Environment.GetFolderPath(
            Environment.SpecialFolder.MyDocuments), "output.pdf"),
        printSettings);
}
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping into advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architectural design.

---

## 11. Summary

| Topic | Key Points |
|---|---|
| Role of WebView2 | Official control for embedding the Edge Chromium engine in applications |
| Setup | Add NuGet package + EnsureCoreWebView2Async() |
| PostMessage Communication | Asynchronous JSON string messaging. Loosely coupled and recommended |
| HostObject | Direct method calls via COM. Powerful but requires security measures |
| Local Content | Serve securely using SetVirtualHostNameToFolderMapping |
| Security | Navigation restrictions + minimal API exposure + CSP are the three pillars |
| Runtime | Evergreen (auto-update) recommended. Fixed version is also an option |
| Performance | Share environment, batch messaging, pre-inject scripts |
| Debugging | Detect errors with ConsoleMessageReceived + ProcessFailed |
| WPF Support | Integrate into WPF apps with the Microsoft.Web.WebView2.Wpf package |

---

## Further Reading

- **[00-electron-setup.md](../02-electron-and-tauri/00-electron-setup.md)** — Introduction to Electron for building desktop apps with web technologies
- **[02-tauri-setup.md](../02-electron-and-tauri/02-tauri-setup.md)** — Tauri, a lightweight Rust-based alternative framework

---

## References

1. Microsoft, "WebView2 — Introduction", https://learn.microsoft.com/microsoft-edge/webview2/
2. Microsoft, "WebView2 API Reference", https://learn.microsoft.com/microsoft-edge/webview2/reference/winrt/microsoft_web_webview2_core/
3. Microsoft, "WebView2 Sample Apps", https://github.com/AltF5/AltF5-WebView2-Sample
4. Microsoft, "Web/Native Interop", https://learn.microsoft.com/microsoft-edge/webview2/how-to/communicate-btwn-web-native
5. Microsoft, "WebView2 Distribution", https://learn.microsoft.com/microsoft-edge/webview2/concepts/distribution
6. Microsoft, "WebView2 Security Best Practices", https://learn.microsoft.com/microsoft-edge/webview2/concepts/security

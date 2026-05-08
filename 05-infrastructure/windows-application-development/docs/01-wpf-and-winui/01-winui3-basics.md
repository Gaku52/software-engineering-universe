# WinUI 3 Basics

> A systematic guide to building Fluent Design-compliant desktop applications using WinUI 3, the latest UI framework included in the Windows App SDK.

---

## What You Will Learn

1. Understand the complete workflow from **WinUI 3 project creation** through building and running
2. Master **XAML basic syntax**, data binding, and the usage of key controls
3. Learn to implement **Fluent Design System** styles, themes, and navigation patterns
4. Acquire maintainable app design skills using **dependency injection** and the **MVVM pattern**
5. Become proficient with WinUI 3-specific controls such as **ContentDialog** and **TeachingTip**


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Windows UI Framework Comparison](./00-windows-ui-frameworks.md)

---

## 1. What Is WinUI 3

### 1.1 Positioning

```
+--------------------------------------------------+
|              Windows App SDK                     |
|  +--------------------------------------------+  |
|  |              WinUI 3                        |  |
|  |  +----------+  +----------+  +-----------+ |  |
|  |  |  XAML    |  | Controls |  |  Fluent   | |  |
|  |  |  Engine  |  |  Library |  |  Design   | |  |
|  |  +----------+  +----------+  +-----------+ |  |
|  +--------------------------------------------+  |
|  +------------+  +-------------+  +-----------+  |
|  | App        |  | Windowing   |  | MRT       |  |
|  | Lifecycle  |  | (AppWindow) |  | (Resource)|  |
|  +------------+  +-------------+  +-----------+  |
+--------------------------------------------------+
```

WinUI 3 is part of the **Windows App SDK** and makes UWP's XAML technology available to Win32 desktop apps. It uses a different rendering engine from WPF and achieves high-speed drawing based on DirectX.

### 1.2 Comparison: WPF / UWP / WinUI 3

| Item | WPF | UWP | WinUI 3 |
|---|---|---|---|
| Target framework | .NET Framework / .NET | UWP (.NET Native) | .NET 6+ |
| XAML version | WPF XAML | UWP XAML | WinUI XAML |
| Distribution | exe / MSI / MSIX | MSIX only | exe / MSIX |
| Sandbox | None | Yes (strict) | None (optional MSIX) |
| Latest UI controls | Manual addition required | Partial support | Full support |
| Win32 API calls | Unrestricted | Restricted | Unrestricted |
| Recommended use | Legacy maintenance | Store apps | New development in general |

### 1.3 Windows App SDK Versions and Features

```
Windows App SDK version history:

  1.0 (2021-11) ─── Initial stable release
                    · WinUI 3 basic control set
                    · AppWindow API
                    · MRT (resource management)

  1.1 (2022-03) ─── Feature enhancements
                    · Mica background support
                    · Self-contained deployment
                    · Environment manager

  1.2 (2022-08) ─── Performance improvements
                    · AppNotification API
                    · Widget support
                    · Improved AppWindow

  1.3 (2023-02) ─── Stability improvements
                    · Improved non-MSIX deployment
                    · New MapControl

  1.4 (2023-08) ─── Latest
                    · Improved ItemsView
                    · WebView2 improvements
                    · New AnnotatedScrollBar

  1.5+ (2024)  ─── Continuous improvements
                    · Performance optimization
                    · Enhanced .NET 8 support
```

---

## 2. Creating a Project

### 2.1 Prerequisites

- Visual Studio 2022 17.8 or later
- Windows App SDK extension (NuGet: `Microsoft.WindowsAppSDK`)
- .NET 8 SDK or later
- Windows 10 version 1809 (build 17763) or later

### 2.2 Creating from a Template

```
Visual Studio → Create a new project
  → Select "Blank App, Packaged (WinUI 3 in Desktop)"
  → Project name: MyFirstWinUI
  → Target framework: net8.0-windows10.0.19041.0
```

### 2.3 Project Structure

```
MyFirstWinUI/
├── MyFirstWinUI.csproj           ← Project settings
├── app.manifest                  ← App manifest (DPI settings, etc.)
├── Package.appxmanifest          ← MSIX package settings
├── App.xaml                      ← App-wide resource definitions
├── App.xaml.cs                   ← App entry point
├── MainWindow.xaml               ← Main window XAML
├── MainWindow.xaml.cs            ← Main window code-behind
├── Assets/                       ← Icons and splash images
│   ├── LockScreenLogo.png
│   ├── SplashScreen.png
│   ├── Square44x44Logo.png
│   ├── Square150x150Logo.png
│   ├── StoreLogo.png
│   └── Wide310x150Logo.png
├── ViewModels/                   ← ViewModel layer
│   └── MainViewModel.cs
├── Views/                        ← Page (View) layer
│   ├── HomePage.xaml
│   ├── HomePage.xaml.cs
│   ├── SettingsPage.xaml
│   └── SettingsPage.xaml.cs
├── Models/                       ← Model layer
│   └── AppConfig.cs
├── Services/                     ← Service layer
│   ├── INavigationService.cs
│   └── NavigationService.cs
└── Helpers/                      ← Utilities
    └── WindowHelper.cs
```

### 2.4 csproj Configuration

```xml
<!-- MyFirstWinUI.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net8.0-windows10.0.19041.0</TargetFramework>
    <TargetPlatformMinVersion>10.0.17763.0</TargetPlatformMinVersion>
    <RootNamespace>MyFirstWinUI</RootNamespace>
    <ApplicationManifest>app.manifest</ApplicationManifest>
    <Platforms>x86;x64;ARM64</Platforms>
    <RuntimeIdentifiers>win-x86;win-x64;win-arm64</RuntimeIdentifiers>
    <UseWinUI>true</UseWinUI>
    <WindowsSdkPackageVersion>10.0.19041.38</WindowsSdkPackageVersion>
    <!-- Enable nullable reference types -->
    <Nullable>enable</Nullable>
    <!-- Trimming support (for self-contained deployment) -->
    <PublishTrimmed>true</PublishTrimmed>
    <TrimMode>partial</TrimMode>
  </PropertyGroup>

  <ItemGroup>
    <!-- Windows App SDK -->
    <PackageReference Include="Microsoft.WindowsAppSDK" Version="1.5.240607001" />
    <!-- CommunityToolkit.Mvvm -->
    <PackageReference Include="CommunityToolkit.Mvvm" Version="8.2.2" />
    <!-- DI container -->
    <PackageReference Include="Microsoft.Extensions.DependencyInjection" Version="8.0.0" />
    <!-- WinUI Community Toolkit -->
    <PackageReference Include="CommunityToolkit.WinUI.UI.Controls" Version="7.1.2" />
  </ItemGroup>
</Project>
```

### Code Example 1: App.xaml.cs — Application Entry Point

```csharp
// App.xaml.cs — アプリケーションのエントリポイント
using Microsoft.Extensions.DependencyInjection;
using Microsoft.UI.Xaml;

namespace MyFirstWinUI;

public partial class App : Application
{
    private Window? _window;

    // DI コンテナ
    public IServiceProvider Services { get; }
    public static new App Current => (App)Application.Current;

    public App()
    {
        this.InitializeComponent();

        // サービスの登録
        var services = new ServiceCollection();
        ConfigureServices(services);
        Services = services.BuildServiceProvider();
    }

    private static void ConfigureServices(IServiceCollection services)
    {
        // ViewModel の登録
        services.AddTransient<ViewModels.MainViewModel>();
        services.AddTransient<ViewModels.SettingsViewModel>();

        // サービスの登録
        services.AddSingleton<Services.INavigationService, Services.NavigationService>();
        services.AddSingleton<Services.IThemeService, Services.ThemeService>();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        // メインウィンドウを生成して表示
        _window = new MainWindow();
        _window.Activate();
    }
}
```

### Code Example 2: MainWindow.xaml — First XAML Page

```xml
<!-- MainWindow.xaml — メインウィンドウの XAML 定義 -->
<Window
    x:Class="MyFirstWinUI.MainWindow"
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    Title="はじめての WinUI 3">

    <!-- StackPanel で垂直にコントロールを配置 -->
    <StackPanel
        HorizontalAlignment="Center"
        VerticalAlignment="Center"
        Spacing="16">

        <!-- テキスト表示 -->
        <TextBlock
            Text="Hello, WinUI 3!"
            Style="{StaticResource TitleTextBlockStyle}" />

        <!-- ボタン：クリックイベントをコードビハインドで処理 -->
        <Button
            x:Name="ClickMeButton"
            Content="クリックしてください"
            Click="ClickMeButton_Click" />

        <!-- 結果表示用テキスト -->
        <TextBlock x:Name="ResultText" />
    </StackPanel>
</Window>
```

```csharp
// MainWindow.xaml.cs — コードビハインド
using Microsoft.UI.Xaml;

namespace MyFirstWinUI;

public sealed partial class MainWindow : Window
{
    private int _clickCount = 0;

    public MainWindow()
    {
        this.InitializeComponent();

        // ウィンドウサイズの設定
        var appWindow = this.AppWindow;
        appWindow.Resize(new Windows.Graphics.SizeInt32(1200, 800));

        // タイトルバーのカスタマイズ
        ExtendsContentIntoTitleBar = true;
        SetTitleBar(null); // デフォルトのドラッグ可能領域を使用
    }

    // ボタンクリック時のイベントハンドラ
    private void ClickMeButton_Click(object sender, RoutedEventArgs e)
    {
        _clickCount++;
        ResultText.Text = $"クリック回数: {_clickCount}";
    }
}
```

---

## 3. XAML Basics

### 3.1 XAML Structure

```
<Window>                          -- Root element
  +-- <StackPanel>                -- Layout panel
  |   +-- <TextBlock Text="..." />  -- Content element
  |   +-- <Button Content="..." />  -- Interactive element
  |   +-- <Image Source="..." />    -- Media element
  +-- <Window.Resources>           -- Resource definitions
      +-- <Style TargetType="..." /> -- Style
```

### 3.2 Layout Panel Comparison

| Panel | Arrangement | Primary Use |
|---|---|---|
| `StackPanel` | Serial horizontal or vertical | Simple forms, toolbars |
| `Grid` | Row and column cell layout | Complex layouts in general |
| `RelativePanel` | Relative positioning | Responsive layouts |
| `Canvas` | Absolute coordinate positioning | Drawing, drag operations |
| `WrapPanel`* | Wrapping layout | Tag lists, thumbnails |
| `UniformGrid`* | Uniform layout | Calendars, button grids |

*Provided by the WinUI 3 Community Toolkit

### Code Example 3: Grid Layout

```xml
<!-- Grid を使った 2 列レイアウト -->
<Grid ColumnSpacing="16" RowSpacing="8" Padding="24">
    <Grid.ColumnDefinitions>
        <!-- 左列: ラベル（幅自動） -->
        <ColumnDefinition Width="Auto" />
        <!-- 右列: 入力（残り全て） -->
        <ColumnDefinition Width="*" />
    </Grid.ColumnDefinitions>
    <Grid.RowDefinitions>
        <RowDefinition Height="Auto" />
        <RowDefinition Height="Auto" />
        <RowDefinition Height="Auto" />
    </Grid.RowDefinitions>

    <!-- 行0: 名前入力 -->
    <TextBlock Grid.Row="0" Grid.Column="0"
               Text="名前:" VerticalAlignment="Center" />
    <TextBox Grid.Row="0" Grid.Column="1"
             PlaceholderText="山田太郎" />

    <!-- 行1: メールアドレス入力 -->
    <TextBlock Grid.Row="1" Grid.Column="0"
               Text="メール:" VerticalAlignment="Center" />
    <TextBox Grid.Row="1" Grid.Column="1"
             PlaceholderText="taro@example.com" />

    <!-- 行2: 送信ボタン（2列にまたがる） -->
    <Button Grid.Row="2" Grid.Column="0" Grid.ColumnSpan="2"
            Content="送信" HorizontalAlignment="Stretch" />
</Grid>
```

### 3.3 Margin and Padding Configuration

```xml
<!-- マージン・パディングの記法 -->

<!-- 全方向同じ値 -->
<Button Margin="16" Padding="8" Content="ボタン" />

<!-- 水平, 垂直 -->
<Button Margin="16,8" Content="ボタン" />

<!-- 左, 上, 右, 下（時計回り） -->
<Button Margin="16,8,16,24" Content="ボタン" />

<!-- Alignment の組み合わせ -->
<StackPanel HorizontalAlignment="Center"
            VerticalAlignment="Top"
            Margin="0,24,0,0">
    <TextBlock Text="中央上部に配置"
               TextAlignment="Center" />
</StackPanel>
```

---

## 4. Key Controls Overview

### 4.1 Input Controls

```
+-------------------+------------------------------------------+
| Control           | Purpose                                   |
+-------------------+------------------------------------------+
| TextBox           | Single-line text input                    |
| PasswordBox       | Password input (masked display)           |
| NumberBox         | Numeric input (with increment buttons)    |
| ComboBox          | Dropdown selection                        |
| RadioButtons      | Exclusive selection (group support)       |
| CheckBox          | Boolean toggle                            |
| ToggleSwitch      | ON/OFF toggle                             |
| Slider            | Numeric value selection within a range    |
| DatePicker        | Date selection                            |
| TimePicker        | Time selection                            |
| CalendarDatePicker| Date selection with calendar              |
| ColorPicker       | Color selection                           |
| RatingControl     | Star rating input                         |
| AutoSuggestBox    | Text input with autocomplete              |
+-------------------+------------------------------------------+
```

### 4.2 Display Controls

```xml
<!-- InfoBar: Information bar (displays success/warning/error messages) -->
<InfoBar
    Title="Save Complete"
    Message="Settings have been saved successfully."
    Severity="Success"
    IsOpen="{x:Bind ViewModel.ShowSuccessBar, Mode=OneWay}" />

<InfoBar
    Title="Error"
    Message="Please check your network connection."
    Severity="Error"
    IsOpen="True"
    IsClosable="True" />

<!-- ProgressBar: Progress bar -->
<ProgressBar Value="{x:Bind ViewModel.Progress, Mode=OneWay}"
             Maximum="100" />

<!-- Indeterminate progress (loading) -->
<ProgressBar IsIndeterminate="True" />

<!-- ProgressRing: Loading spinner -->
<ProgressRing IsActive="{x:Bind ViewModel.IsLoading, Mode=OneWay}" />

<!-- Expander: Expandable panel -->
<Expander Header="Advanced Settings" IsExpanded="False">
    <StackPanel Spacing="8">
        <TextBox Header="API Key" />
        <NumberBox Header="Timeout (seconds)" Value="30" />
    </StackPanel>
</Expander>

<!-- TeachingTip: Tooltip-style guidance -->
<TeachingTip
    x:Name="SaveTip"
    Target="{x:Bind SaveButton}"
    Title="Auto-save is enabled"
    Subtitle="Changes are saved automatically. You do not need to save manually."
    PreferredPlacement="Bottom"
    IsLightDismissEnabled="True" />

<!-- Breadcrumb: Breadcrumb navigation -->
<BreadcrumbBar ItemsSource="{x:Bind ViewModel.BreadcrumbItems}">
    <BreadcrumbBar.ItemTemplate>
        <DataTemplate x:DataType="x:String">
            <TextBlock Text="{x:Bind}" />
        </DataTemplate>
    </BreadcrumbBar.ItemTemplate>
</BreadcrumbBar>
```

### 4.3 Collection Display Controls

```xml
<!-- ListView: Vertical list -->
<ListView ItemsSource="{x:Bind ViewModel.Tasks, Mode=OneWay}"
          SelectionMode="Single"
          SelectedItem="{x:Bind ViewModel.SelectedTask, Mode=TwoWay}">
    <ListView.ItemTemplate>
        <DataTemplate x:DataType="models:TaskItem">
            <Grid Padding="8" ColumnSpacing="12">
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="Auto" />
                    <ColumnDefinition Width="*" />
                    <ColumnDefinition Width="Auto" />
                </Grid.ColumnDefinitions>

                <CheckBox Grid.Column="0"
                          IsChecked="{x:Bind IsCompleted, Mode=TwoWay}" />
                <StackPanel Grid.Column="1">
                    <TextBlock Text="{x:Bind Title}"
                               Style="{StaticResource BodyStrongTextBlockStyle}" />
                    <TextBlock Text="{x:Bind Description}"
                               Style="{StaticResource CaptionTextBlockStyle}"
                               Opacity="0.7" />
                </StackPanel>
                <TextBlock Grid.Column="2"
                           Text="{x:Bind Priority}"
                           VerticalAlignment="Center" />
            </Grid>
        </DataTemplate>
    </ListView.ItemTemplate>
</ListView>

<!-- GridView: Grid display -->
<GridView ItemsSource="{x:Bind ViewModel.Images, Mode=OneWay}"
          SelectionMode="Multiple"
          IsItemClickEnabled="True"
          ItemClick="GridView_ItemClick">
    <GridView.ItemTemplate>
        <DataTemplate x:DataType="models:ImageItem">
            <Grid Width="200" Height="200" CornerRadius="8">
                <Image Source="{x:Bind ThumbnailUrl}"
                       Stretch="UniformToFill" />
                <TextBlock Text="{x:Bind FileName}"
                           VerticalAlignment="Bottom"
                           Padding="8"
                           Background="{ThemeResource AcrylicInAppFillColorDefaultBrush}"
                           Foreground="{ThemeResource TextFillColorPrimaryBrush}" />
            </Grid>
        </DataTemplate>
    </GridView.ItemTemplate>
</GridView>
```

### Code Example 4: Data Binding and MVVM

```csharp
// ViewModels/MainViewModel.cs — MVVM パターンの ViewModel
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using System.Collections.ObjectModel;

namespace MyFirstWinUI.ViewModels;

// ObservableObject を継承して変更通知を自動実装
public partial class MainViewModel : ObservableObject
{
    // [ObservableProperty] で自動的に Name プロパティと
    // PropertyChanged 通知が生成される
    [ObservableProperty]
    private string _name = string.Empty;

    [ObservableProperty]
    private string _greeting = string.Empty;

    [ObservableProperty]
    private bool _isLoading;

    [ObservableProperty]
    private ObservableCollection<TaskItem> _tasks = new();

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(DeleteTaskCommand))]
    private TaskItem? _selectedTask;

    // [RelayCommand] でコマンドが自動生成される（GreetCommand）
    [RelayCommand]
    private void Greet()
    {
        Greeting = string.IsNullOrWhiteSpace(Name)
            ? "名前を入力してください"
            : $"こんにちは、{Name} さん！";
    }

    [RelayCommand]
    private async Task LoadTasksAsync()
    {
        IsLoading = true;
        try
        {
            // 非同期でデータを取得
            await Task.Delay(500); // シミュレーション
            Tasks = new ObservableCollection<TaskItem>(
                new[]
                {
                    new TaskItem { Title = "設計レビュー", Priority = "高", IsCompleted = false },
                    new TaskItem { Title = "テスト作成", Priority = "中", IsCompleted = true },
                    new TaskItem { Title = "ドキュメント更新", Priority = "低", IsCompleted = false },
                });
        }
        finally
        {
            IsLoading = false;
        }
    }

    private bool CanDeleteTask() => SelectedTask != null;

    [RelayCommand(CanExecute = nameof(CanDeleteTask))]
    private void DeleteTask()
    {
        if (SelectedTask != null)
        {
            Tasks.Remove(SelectedTask);
            SelectedTask = null;
        }
    }
}

public class TaskItem
{
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string Priority { get; set; } = "中";
    public bool IsCompleted { get; set; }
}
```

```xml
<!-- MainPage.xaml — ViewModel へのバインディング -->
<Page
    x:Class="MyFirstWinUI.MainPage"
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    xmlns:vm="using:MyFirstWinUI.ViewModels">

    <Page.DataContext>
        <vm:MainViewModel />
    </Page.DataContext>

    <StackPanel Spacing="12" Padding="24">
        <!-- 双方向バインディングで ViewModel の Name と同期 -->
        <TextBox
            Text="{x:Bind ViewModel.Name, Mode=TwoWay, UpdateSourceTrigger=PropertyChanged}"
            PlaceholderText="名前を入力" />

        <!-- コマンドバインディング -->
        <Button
            Content="あいさつ"
            Command="{x:Bind ViewModel.GreetCommand}" />

        <!-- 一方向バインディングで結果を表示 -->
        <TextBlock
            Text="{x:Bind ViewModel.Greeting, Mode=OneWay}"
            Style="{StaticResource SubtitleTextBlockStyle}" />
    </StackPanel>
</Page>
```

---

## 5. Styles and Themes

### 5.1 Theme System

WinUI 3 natively supports three themes: Light, Dark, and HighContrast.

```xml
<!-- App.xaml — テーマリソースの定義 -->
<Application.Resources>
    <ResourceDictionary>
        <ResourceDictionary.MergedDictionaries>
            <!-- WinUI 標準テーマリソース -->
            <XamlControlsResources xmlns="using:Microsoft.UI.Xaml.Controls" />
        </ResourceDictionary.MergedDictionaries>

        <!-- カスタムカラーの定義 -->
        <Color x:Key="BrandColor">#6366F1</Color>
        <SolidColorBrush x:Key="BrandBrush" Color="{StaticResource BrandColor}" />

        <!-- ボタンのスタイルをカスタマイズ -->
        <Style x:Key="BrandButtonStyle" TargetType="Button"
               BasedOn="{StaticResource AccentButtonStyle}">
            <Setter Property="Background" Value="{StaticResource BrandBrush}" />
            <Setter Property="CornerRadius" Value="8" />
            <Setter Property="Padding" Value="16,8" />
        </Style>

        <!-- カスタムリソースディクショナリの読み込み -->
        <!-- <ResourceDictionary Source="Styles/CustomStyles.xaml" /> -->
    </ResourceDictionary>
</Application.Resources>
```

### 5.2 Implementing Theme Switching

```csharp
// テーマサービスの実装
using Microsoft.UI.Xaml;

namespace MyFirstWinUI.Services;

public interface IThemeService
{
    ElementTheme CurrentTheme { get; }
    void SetTheme(ElementTheme theme);
    void ToggleTheme();
}

public class ThemeService : IThemeService
{
    private ElementTheme _currentTheme = ElementTheme.Default;

    public ElementTheme CurrentTheme => _currentTheme;

    public void SetTheme(ElementTheme theme)
    {
        _currentTheme = theme;

        // ルート要素のテーマを変更
        if (App.MainWindow?.Content is FrameworkElement rootElement)
        {
            rootElement.RequestedTheme = theme;
        }
    }

    public void ToggleTheme()
    {
        var currentTheme = _currentTheme;
        if (currentTheme == ElementTheme.Dark)
        {
            SetTheme(ElementTheme.Light);
        }
        else
        {
            SetTheme(ElementTheme.Dark);
        }
    }
}
```

### 5.3 Custom Style Details

```xml
<!-- Styles/CustomStyles.xaml — カスタムスタイル集 -->
<ResourceDictionary
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">

    <!-- カード風パネルのスタイル -->
    <Style x:Key="CardStyle" TargetType="Border">
        <Setter Property="Background"
                Value="{ThemeResource CardBackgroundFillColorDefaultBrush}" />
        <Setter Property="BorderBrush"
                Value="{ThemeResource CardStrokeColorDefaultBrush}" />
        <Setter Property="BorderThickness" Value="1" />
        <Setter Property="CornerRadius" Value="8" />
        <Setter Property="Padding" Value="16" />
    </Style>

    <!-- セクションヘッダーのスタイル -->
    <Style x:Key="SectionHeaderStyle" TargetType="TextBlock"
           BasedOn="{StaticResource SubtitleTextBlockStyle}">
        <Setter Property="Margin" Value="0,24,0,8" />
    </Style>

    <!-- 設定項目のスタイル -->
    <Style x:Key="SettingItemStyle" TargetType="Grid">
        <Setter Property="Padding" Value="16" />
        <Setter Property="Background"
                Value="{ThemeResource CardBackgroundFillColorDefaultBrush}" />
        <Setter Property="CornerRadius" Value="4" />
        <Setter Property="Margin" Value="0,2" />
    </Style>

    <!-- サブテキストのスタイル -->
    <Style x:Key="SubtextStyle" TargetType="TextBlock"
           BasedOn="{StaticResource CaptionTextBlockStyle}">
        <Setter Property="Foreground"
                Value="{ThemeResource TextFillColorSecondaryBrush}" />
        <Setter Property="TextWrapping" Value="Wrap" />
    </Style>
</ResourceDictionary>
```

---

## 6. Navigation

### 6.1 NavigationView Pattern

```
+-------+----------------------------------+
| =     |  Page Title                [ _ # X ] |
+-------+----------------------------------+
| Home  |                                |
| Analytics |     <-- Page Content -->       |
| Settings  |                                |
|         |                                |
|         |                                |
+-------+----------------------------------+
     ^                    ^
  NavigationView      Frame (page switching)
```

### Code Example 5: Page Navigation with NavigationView

```xml
<!-- ShellPage.xaml — ナビゲーションシェル -->
<Page x:Class="MyFirstWinUI.ShellPage"
      xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
      xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">

    <NavigationView
        x:Name="NavView"
        IsBackButtonVisible="Auto"
        SelectionChanged="NavView_SelectionChanged"
        BackRequested="NavView_BackRequested"
        PaneDisplayMode="Left"
        IsPaneToggleButtonVisible="True"
        IsSettingsVisible="True">

        <!-- ヘッダー -->
        <NavigationView.AutoSuggestBox>
            <AutoSuggestBox PlaceholderText="検索..."
                            QueryIcon="Find" />
        </NavigationView.AutoSuggestBox>

        <!-- ナビゲーション項目の定義 -->
        <NavigationView.MenuItems>
            <NavigationViewItem Content="ホーム" Tag="Home">
                <NavigationViewItem.Icon>
                    <SymbolIcon Symbol="Home" />
                </NavigationViewItem.Icon>
            </NavigationViewItem>

            <NavigationViewItem Content="分析" Tag="Analytics">
                <NavigationViewItem.Icon>
                    <SymbolIcon Symbol="ViewAll" />
                </NavigationViewItem.Icon>
            </NavigationViewItem>

            <NavigationViewItemSeparator />

            <NavigationViewItemHeader Content="管理" />

            <NavigationViewItem Content="ユーザー" Tag="Users">
                <NavigationViewItem.Icon>
                    <SymbolIcon Symbol="People" />
                </NavigationViewItem.Icon>
            </NavigationViewItem>
        </NavigationView.MenuItems>

        <!-- 設定ページ（フッター位置に自動配置） -->
        <NavigationView.FooterMenuItems>
            <NavigationViewItem Content="設定" Tag="Settings">
                <NavigationViewItem.Icon>
                    <SymbolIcon Symbol="Setting" />
                </NavigationViewItem.Icon>
            </NavigationViewItem>
        </NavigationView.FooterMenuItems>

        <!-- ページ表示用 Frame -->
        <Frame x:Name="ContentFrame" />
    </NavigationView>
</Page>
```

```csharp
// ShellPage.xaml.cs — ナビゲーションロジック
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;

namespace MyFirstWinUI;

public sealed partial class ShellPage : Page
{
    // タグ名とページ型のマッピング辞書
    private readonly Dictionary<string, Type> _pages = new()
    {
        { "Home", typeof(HomePage) },
        { "Analytics", typeof(AnalyticsPage) },
        { "Users", typeof(UsersPage) },
        { "Settings", typeof(SettingsPage) },
    };

    public ShellPage()
    {
        this.InitializeComponent();

        // 初期ページへ遷移
        ContentFrame.Navigate(typeof(HomePage));

        // フレームのナビゲーション完了イベント
        ContentFrame.Navigated += ContentFrame_Navigated;
    }

    // ナビゲーション項目選択時の処理
    private void NavView_SelectionChanged(
        NavigationView sender,
        NavigationViewSelectionChangedEventArgs args)
    {
        if (args.IsSettingsSelected)
        {
            // 設定ページへ遷移
            ContentFrame.Navigate(typeof(SettingsPage));
            return;
        }

        if (args.SelectedItemContainer is NavigationViewItem item
            && item.Tag is string tag
            && _pages.TryGetValue(tag, out var pageType))
        {
            ContentFrame.Navigate(pageType);
        }
    }

    // 戻るボタン押下時の処理
    private void NavView_BackRequested(
        NavigationView sender,
        NavigationViewBackRequestedEventArgs args)
    {
        if (ContentFrame.CanGoBack)
        {
            ContentFrame.GoBack();
        }
    }

    // ナビゲーション完了時にナビゲーション項目のハイライトを同期
    private void ContentFrame_Navigated(object sender, NavigationEventArgs e)
    {
        // 戻るボタンの表示/非表示
        NavView.IsBackEnabled = ContentFrame.CanGoBack;

        // 現在のページに対応するナビゲーション項目を選択
        var pageType = ContentFrame.CurrentSourcePageType;
        var tag = _pages.FirstOrDefault(p => p.Value == pageType).Key;

        if (tag != null)
        {
            foreach (NavigationViewItem item in NavView.MenuItems.OfType<NavigationViewItem>())
            {
                if (item.Tag?.ToString() == tag)
                {
                    NavView.SelectedItem = item;
                    break;
                }
            }
        }
    }
}
```

---

## 7. Fluent Design System

### 7.1 The 5 Principles of Fluent Design

```
+----------------------------------------------------------+
|                  Fluent Design System                     |
+----------------------------------------------------------+
|                                                          |
|  Light        Material       Depth                       |
|               (Material)     (Depth)                     |
|  +-----+     +-----+      +-----+                       |
|  | ### |     | ### |      |  *  |                       |
|  | Light|    | Mica |      |Shadow|                      |
|  +-----+     +-----+      +-----+                       |
|                                                          |
|  Motion                    Scale                         |
|  (Motion)                 (Scale)                        |
|  +-----+                  +-----+                        |
|  | --> |                  | [ ] |                        |
|  | Anim|                  | Resp|                        |
|  +-----+                  +-----+                        |
+----------------------------------------------------------+
```

### 7.2 Applying Mica / Acrylic

```xml
<!-- ウィンドウ背景に Mica を適用 -->
<Window
    x:Class="MyFirstWinUI.MainWindow"
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">

    <!-- SystemBackdrop で Mica を設定 -->
    <Window.SystemBackdrop>
        <MicaBackdrop />
    </Window.SystemBackdrop>

    <Grid>
        <!-- Acrylic パネル（半透明） -->
        <Grid Background="{ThemeResource AcrylicInAppFillColorDefaultBrush}"
              CornerRadius="8" Padding="16" Margin="24">
            <TextBlock Text="Acrylic 背景のパネル"
                       Style="{StaticResource BodyStrongTextBlockStyle}" />
        </Grid>
    </Grid>
</Window>
```

### 7.3 Implementing Animations

```csharp
// Composition API を使ったアニメーション
using Microsoft.UI.Composition;
using Microsoft.UI.Xaml.Hosting;

public static class AnimationHelper
{
    // フェードインアニメーション
    public static void FadeIn(UIElement element, TimeSpan duration)
    {
        var visual = ElementCompositionPreview.GetElementVisual(element);
        var compositor = visual.Compositor;

        var animation = compositor.CreateScalarKeyFrameAnimation();
        animation.InsertKeyFrame(0f, 0f);
        animation.InsertKeyFrame(1f, 1f);
        animation.Duration = duration;

        visual.StartAnimation("Opacity", animation);
    }

    // スライドインアニメーション
    public static void SlideIn(UIElement element, TimeSpan duration, float offsetX = 0, float offsetY = 50)
    {
        var visual = ElementCompositionPreview.GetElementVisual(element);
        var compositor = visual.Compositor;

        // オフセットアニメーション
        var offsetAnimation = compositor.CreateVector3KeyFrameAnimation();
        offsetAnimation.InsertKeyFrame(0f, new System.Numerics.Vector3(offsetX, offsetY, 0));
        offsetAnimation.InsertKeyFrame(1f, new System.Numerics.Vector3(0, 0, 0));
        offsetAnimation.Duration = duration;

        // フェードアニメーション
        var fadeAnimation = compositor.CreateScalarKeyFrameAnimation();
        fadeAnimation.InsertKeyFrame(0f, 0f);
        fadeAnimation.InsertKeyFrame(1f, 1f);
        fadeAnimation.Duration = duration;

        visual.StartAnimation("Offset", offsetAnimation);
        visual.StartAnimation("Opacity", fadeAnimation);
    }

    // スケールアニメーション
    public static void ScaleIn(UIElement element, TimeSpan duration)
    {
        var visual = ElementCompositionPreview.GetElementVisual(element);
        var compositor = visual.Compositor;

        // 中央からスケール
        visual.CenterPoint = new System.Numerics.Vector3(
            (float)(element as FrameworkElement)?.ActualWidth / 2 ?? 0,
            (float)(element as FrameworkElement)?.ActualHeight / 2 ?? 0,
            0);

        var scaleAnimation = compositor.CreateVector3KeyFrameAnimation();
        scaleAnimation.InsertKeyFrame(0f, new System.Numerics.Vector3(0.8f, 0.8f, 1f));
        scaleAnimation.InsertKeyFrame(1f, new System.Numerics.Vector3(1f, 1f, 1f));
        scaleAnimation.Duration = duration;

        visual.StartAnimation("Scale", scaleAnimation);
    }
}
```

```xml
<!-- XAML でのアニメーション（Storyboard） -->
<Page.Resources>
    <Storyboard x:Key="FadeInStoryboard">
        <DoubleAnimation
            Storyboard.TargetName="ContentPanel"
            Storyboard.TargetProperty="Opacity"
            From="0" To="1" Duration="0:0:0.5">
            <DoubleAnimation.EasingFunction>
                <CubicEase EasingMode="EaseOut" />
            </DoubleAnimation.EasingFunction>
        </DoubleAnimation>
    </Storyboard>
</Page.Resources>

<!-- EntranceThemeTransition: ページ遷移時のアニメーション -->
<StackPanel x:Name="ContentPanel">
    <StackPanel.ChildrenTransitions>
        <EntranceThemeTransition IsStaggeringEnabled="True" />
    </StackPanel.ChildrenTransitions>
    <!-- 子要素が順番にフェードインする -->
    <TextBlock Text="項目1" />
    <TextBlock Text="項目2" />
    <TextBlock Text="項目3" />
</StackPanel>
```

---

## 8. Implementing ContentDialog

```csharp
// ContentDialog: モーダルダイアログの実装
using Microsoft.UI.Xaml.Controls;

public static class DialogHelper
{
    // 確認ダイアログ
    public static async Task<bool> ShowConfirmAsync(
        XamlRoot xamlRoot,
        string title,
        string content)
    {
        var dialog = new ContentDialog
        {
            Title = title,
            Content = content,
            PrimaryButtonText = "はい",
            SecondaryButtonText = "キャンセル",
            DefaultButton = ContentDialogButton.Primary,
            XamlRoot = xamlRoot,
        };

        var result = await dialog.ShowAsync();
        return result == ContentDialogResult.Primary;
    }

    // カスタムコンテンツのダイアログ
    public static async Task<string?> ShowInputDialogAsync(
        XamlRoot xamlRoot,
        string title,
        string placeholder = "")
    {
        var inputBox = new TextBox
        {
            PlaceholderText = placeholder,
            AcceptsReturn = false,
        };

        var dialog = new ContentDialog
        {
            Title = title,
            Content = inputBox,
            PrimaryButtonText = "OK",
            SecondaryButtonText = "キャンセル",
            DefaultButton = ContentDialogButton.Primary,
            XamlRoot = xamlRoot,
        };

        var result = await dialog.ShowAsync();
        return result == ContentDialogResult.Primary
            ? inputBox.Text
            : null;
    }
}
```

```xml
<!-- XAML で定義する ContentDialog -->
<ContentDialog
    x:Name="DeleteConfirmDialog"
    Title="タスクの削除"
    PrimaryButtonText="削除"
    SecondaryButtonText="キャンセル"
    DefaultButton="Secondary"
    PrimaryButtonClick="DeleteConfirmDialog_PrimaryButtonClick">
    <StackPanel Spacing="8">
        <TextBlock Text="本当にこのタスクを削除しますか？" />
        <TextBlock Text="この操作は取り消せません。"
                   Style="{StaticResource CaptionTextBlockStyle}"
                   Foreground="{ThemeResource SystemFillColorCriticalBrush}" />
    </StackPanel>
</ContentDialog>
```

---

## 9. Window Management (AppWindow API)

```csharp
// AppWindow を使ったウィンドウの高度な制御
using Microsoft.UI;
using Microsoft.UI.Windowing;
using Windows.Graphics;

public sealed partial class MainWindow : Window
{
    private AppWindow _appWindow;

    public MainWindow()
    {
        this.InitializeComponent();

        // AppWindow の取得
        _appWindow = this.AppWindow;

        // ウィンドウサイズの設定
        _appWindow.Resize(new SizeInt32(1200, 800));

        // 最小サイズの設定
        _appWindow.Changed += (sender, args) =>
        {
            if (args.DidSizeChange)
            {
                var size = sender.Size;
                if (size.Width < 800 || size.Height < 600)
                {
                    sender.Resize(new SizeInt32(
                        Math.Max(size.Width, 800),
                        Math.Max(size.Height, 600)));
                }
            }
        };

        // タイトルバーの色をカスタマイズ
        if (AppWindowTitleBar.IsCustomizationSupported())
        {
            var titleBar = _appWindow.TitleBar;
            titleBar.ExtendsContentIntoTitleBar = true;
            titleBar.ButtonBackgroundColor = Colors.Transparent;
            titleBar.ButtonInactiveBackgroundColor = Colors.Transparent;
            titleBar.ButtonHoverBackgroundColor = Windows.UI.Color.FromArgb(25, 255, 255, 255);
        }

        // フルスクリーンの切り替え
        // _appWindow.SetPresenter(AppWindowPresenterKind.FullScreen);

        // コンパクトオーバーレイ（ピクチャ・イン・ピクチャ風）
        // _appWindow.SetPresenter(AppWindowPresenterKind.CompactOverlay);
    }

    // ウィンドウを画面中央に配置
    private void CenterWindow()
    {
        var displayArea = DisplayArea.GetFromWindowId(
            _appWindow.Id, DisplayAreaFallback.Nearest);
        var workArea = displayArea.WorkArea;
        var windowSize = _appWindow.Size;

        _appWindow.Move(new PointInt32(
            (workArea.Width - windowSize.Width) / 2 + workArea.X,
            (workArea.Height - windowSize.Height) / 2 + workArea.Y));
    }
}
```

---

## 10. Anti-Patterns

### Anti-Pattern 1: Writing All Logic in Code-Behind

```csharp
// NG: コードビハインドにビジネスロジックを直接記述
public sealed partial class OrderPage : Page
{
    private async void SubmitButton_Click(object sender, RoutedEventArgs e)
    {
        // データベース接続からUI更新まで全てここに書く → テスト不能
        var conn = new SqlConnection("...");
        await conn.OpenAsync();
        var cmd = new SqlCommand("INSERT INTO Orders ...", conn);
        await cmd.ExecuteNonQueryAsync();
        ResultText.Text = "注文完了";
    }
}
```

```csharp
// OK: MVVM パターンで ViewModel にロジックを分離
public partial class OrderViewModel : ObservableObject
{
    private readonly IOrderService _orderService;

    public OrderViewModel(IOrderService orderService)
    {
        _orderService = orderService;
    }

    [ObservableProperty]
    private string _statusMessage = "";

    [RelayCommand]
    private async Task SubmitOrderAsync()
    {
        // サービス層に委譲 → テスト可能
        await _orderService.CreateOrderAsync(CurrentOrder);
        StatusMessage = "注文完了";
    }
}
```

### Anti-Pattern 2: Using UWP APIs Directly in WinUI 3

```csharp
// NG: UWP の名前空間を直接使用（WinUI 3 では動作しない場合がある）
using Windows.UI.Xaml; // UWP 用名前空間

// OK: WinUI 3 の名前空間を使用
using Microsoft.UI.Xaml; // WinUI 3 用名前空間
```

When migrating from UWP, pay particular attention to the fact that namespace prefixes have changed from `Windows.UI` to `Microsoft.UI`.

### Anti-Pattern 3: Blocking the UI Thread

```csharp
// NG: UI スレッドで同期的に重い処理を実行
private void LoadData_Click(object sender, RoutedEventArgs e)
{
    // Thread.Sleep や同期 I/O は UI をフリーズさせる
    Thread.Sleep(3000);
    var data = File.ReadAllText("large-file.txt"); // 同期 I/O
    DataText.Text = data;
}
```

```csharp
// OK: 非同期処理で UI スレッドをブロックしない
private async void LoadData_Click(object sender, RoutedEventArgs e)
{
    LoadingRing.IsActive = true;
    LoadButton.IsEnabled = false;

    try
    {
        // 非同期 I/O で UI をブロックしない
        var data = await File.ReadAllTextAsync("large-file.txt");

        // DispatcherQueue を使って UI スレッドで更新
        DispatcherQueue.TryEnqueue(() =>
        {
            DataText.Text = data;
        });
    }
    catch (Exception ex)
    {
        // エラー表示
        ErrorBar.Message = ex.Message;
        ErrorBar.IsOpen = true;
    }
    finally
    {
        LoadingRing.IsActive = false;
        LoadButton.IsEnabled = true;
    }
}
```

---

## 11. Implementing Tests

```csharp
// ViewModel のユニットテスト
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Moq;

[TestClass]
public class MainViewModelTests
{
    [TestMethod]
    public void Greet_WithName_ReturnsGreeting()
    {
        // Arrange
        var viewModel = new MainViewModel();
        viewModel.Name = "太郎";

        // Act
        viewModel.GreetCommand.Execute(null);

        // Assert
        Assert.AreEqual("こんにちは、太郎 さん！", viewModel.Greeting);
    }

    [TestMethod]
    public void Greet_WithEmptyName_ReturnsPrompt()
    {
        var viewModel = new MainViewModel();
        viewModel.Name = "";

        viewModel.GreetCommand.Execute(null);

        Assert.AreEqual("名前を入力してください", viewModel.Greeting);
    }

    [TestMethod]
    public async Task LoadTasks_SetsIsLoading()
    {
        var viewModel = new MainViewModel();

        var loadTask = viewModel.LoadTasksCommand.ExecuteAsync(null);

        // LoadTasks 実行中は IsLoading が true
        Assert.IsTrue(viewModel.IsLoading);

        await loadTask;

        // 完了後は false
        Assert.IsFalse(viewModel.IsLoading);
    }

    [TestMethod]
    public void DeleteTask_WithSelection_RemovesTask()
    {
        var viewModel = new MainViewModel();
        var task = new TaskItem { Title = "テスト" };
        viewModel.Tasks.Add(task);
        viewModel.SelectedTask = task;

        viewModel.DeleteTaskCommand.Execute(null);

        Assert.AreEqual(0, viewModel.Tasks.Count);
        Assert.IsNull(viewModel.SelectedTask);
    }

    [TestMethod]
    public void DeleteTask_WithoutSelection_CannotExecute()
    {
        var viewModel = new MainViewModel();
        viewModel.SelectedTask = null;

        Assert.IsFalse(viewModel.DeleteTaskCommand.CanExecute(null));
    }
}
```

---

## 12. FAQ

### Q1: How does WinUI 3 differ from .NET MAUI?

**A:** WinUI 3 is a Windows-only UI framework that makes maximum use of Windows native features. .NET MAUI, on the other hand, targets cross-platform development (Windows / macOS / iOS / Android) and converts to each OS's native UI. If you are targeting Windows only and need high-quality UI, choose WinUI 3; if you need multi-platform deployment, choose MAUI.

### Q2: Does a WinUI 3 app run on Windows 10?

**A:** Yes. The Windows App SDK supports Windows 10 version 1809 (build 17763) or later. However, some features such as Mica and SnapLayout are only available on Windows 11. It is recommended to use `ApiInformation.IsApiContractPresent()` to check for feature availability.

### Q3: How do I migrate an existing WPF app to WinUI 3?

**A:** No fully automatic migration tool is provided. The recommended gradual migration strategy is: (1) first reorganize into the MVVM pattern so that ViewModels are framework-independent, (2) use XAML Islands to embed WinUI 3 controls inside the WPF app, and (3) finally rebuild the entire app in WinUI 3.

### Q4: How do I use WebView2 in WinUI 3?

**A:** Install the NuGet package `Microsoft.Web.WebView2` and place `<WebView2 Source="https://example.com" />` in your XAML. WebView2 is a Chromium-based browser control that uses the Edge (Chromium) Evergreen runtime. Two-way communication with JavaScript is also possible, making it well-suited for building hybrid apps.

### Q5: What is the difference between MSIX-packaged and unpackaged WinUI 3?

**A:** With MSIX packaging, you get clean install/uninstall, automatic updates, and Windows Store distribution. With unpackaged (Unpackaged) mode, you can distribute freely like a traditional exe and get full access to the registry and file system. MSIX packaging is recommended for new projects, but choose unpackaged when compatibility with existing distribution infrastructure is required.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is the most important thing. Understanding deepens not just through theory but by actually writing code and verifying how it behaves.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend fully understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this knowledge used in practice?

Knowledge of this topic is frequently used in day-to-day development work. It becomes especially important during code reviews and when designing architecture.

---

## 13. Summary

| Topic | Key Points |
|---|---|
| WinUI 3 positioning | UI layer of Windows App SDK. Recommended for new development as the successor to WPF |
| Project creation | Visual Studio template + Windows App SDK NuGet |
| XAML | Declarative UI description. Build layouts with Grid / StackPanel |
| Data binding | Type-safe binding via `x:Bind` is recommended |
| MVVM | Reduce boilerplate with CommunityToolkit.Mvvm |
| Styles and themes | Standard Light / Dark theme support. Managed with resource dictionaries |
| Navigation | NavigationView + Frame pattern is standard |
| Fluent Design | Achieve a modern appearance with Mica / Acrylic / animations |
| Dialogs | Implement modal UI with ContentDialog |
| Window management | Control size, position, and presenter with AppWindow API |
| Testing | Ensure quality with ViewModel unit tests |

---

## What to Read Next

- **[02-webview2.md](./02-webview2.md)** -- How to build hybrid apps by integrating WebView2
- **Packaging and signing** -- How to distribute using MSIX packages

---

## References

1. Microsoft, "Windows App SDK -- WinUI 3", https://learn.microsoft.com/windows/apps/winui/winui3/
2. Microsoft, "XAML Controls Gallery", https://github.com/microsoft/Xaml-Controls-Gallery
3. Microsoft, "CommunityToolkit.Mvvm", https://learn.microsoft.com/dotnet/communitytoolkit/mvvm/
4. Microsoft, "Fluent Design System", https://fluent2.microsoft.design/
5. Microsoft, "AppWindow Class", https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.windowing.appwindow
6. Microsoft, "Windows App SDK Release Notes", https://learn.microsoft.com/windows/apps/windows-app-sdk/stable-channel

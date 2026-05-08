# Windows UI Frameworks Comparison

> Windows native UI frameworks have evolved from WPF to WinUI 3. This guide covers the history and selection criteria for WPF, WinUI 3, UWP, and MAUI, as well as XAML fundamentals, data binding, and the MVVM pattern.

## What You Will Learn

- [ ] Understand the history and selection criteria for Windows UI frameworks
- [ ] Grasp the basic XAML syntax
- [ ] Understand the MVVM pattern and data binding
- [ ] Understand implementation differences through concrete code examples for each framework
- [ ] Select the appropriate framework based on project requirements


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Framework History and Comparison

### 1.1 Evolution of Windows UI Frameworks

```
Evolution of Windows UI Frameworks:

  2002 ─── Windows Forms (.NET Framework 1.0)
            │  GDI+-based UI
            │  Event-driven programming
            │  Drag-and-drop design
            │
  2006 ─── WPF (.NET Framework 3.0)
            │  XAML + data binding
            │  DirectX-based vector rendering
            │  New standard for desktop apps
            │
  2012 ─── WinRT / Windows 8 Apps
            │  Sandboxed, touch-enabled
            │  Modern UI (Metro)
            │
  2015 ─── UWP (Universal Windows Platform)
            │  Windows 10 unified platform
            │  Fluent Design System
            │  Microsoft Store distribution
            │  XAML Islands (gradual migration from WPF)
            │
  2021 ─── WinUI 3 (Windows App SDK)
            │  Use UWP UI in Win32 apps
            │  Latest Fluent Design
            │  .NET 8+ / C++ support
            │  Full Win32 API access
            │
  2022 ─── .NET MAUI
               Cross-platform
               Windows + macOS + iOS + Android
               Successor to Xamarin.Forms
```

### 1.2 Detailed Comparison Table

```
Framework Comparison:

  Item       │ WPF        │ WinUI 3    │ UWP        │ MAUI
  ──────────┼───────────┼───────────┼───────────┼──────────
  OS Support │ Windows    │ Windows    │ Windows    │ Multi
  .NET       │ Framework/8│ 8+         │ Limited    │ 8+
  UI Tech    │ XAML       │ XAML       │ XAML       │ XAML
  Design     │ Classic    │ Fluent     │ Fluent     │ Native
  Win32 API  │ Full       │ Full       │ Limited    │ Limited
  Distribution│ Free      │ Free       │ Store rec. │ Free
  Status     │ Maintained │ Recommended│ Deprecated │ Active

  Selection Guide:
    New Windows app → WinUI 3
    Existing WPF codebase → Continue WPF (gradual migration to WinUI 3)
    Cross-platform → MAUI
    UWP app → Recommended to migrate to WinUI 3
```

### 1.3 Rendering Engine Differences

```
Rendering Architecture:

  Windows Forms:
    GDI/GDI+ → CPU rendering → Rasterization
    · Pixel-based drawing
    · May appear blurry at high DPI
    · Simple but limited expressiveness

  WPF:
    XAML → MIL (Media Integration Layer) → DirectX 9/11 → GPU rendering
    · Vector-based drawing
    · High DPI support
    · 3D, animations, effects

  WinUI 3:
    XAML → Windows.UI.Composition → DirectX 12 → GPU rendering
    · Composition-based drawing
    · Mica/Acrylic effects
    · Best performance
    · Smooth animations via DirectComposition

  MAUI:
    XAML → Handlers → Platform-native UI
    · Maps to WinUI 3 on Windows
    · Maps to Catalyst on macOS
    · Overhead from abstraction layer
```

---

## 2. XAML Fundamentals

### 2.1 Basic XAML Syntax

```xml
<!-- Basic XAML syntax -->
<Window
    x:Class="MyApp.MainWindow"
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    Title="My Application" Height="600" Width="800">

    <Grid>
        <!-- Row and column definitions -->
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto" />
            <RowDefinition Height="*" />
            <RowDefinition Height="Auto" />
        </Grid.RowDefinitions>

        <!-- Header -->
        <TextBlock Grid.Row="0" Text="Header"
                   FontSize="24" Margin="16" />

        <!-- Content -->
        <StackPanel Grid.Row="1" Margin="16">
            <TextBox x:Name="NameInput"
                     PlaceholderText="Enter your name"
                     Text="{x:Bind ViewModel.Name, Mode=TwoWay}" />

            <Button Content="Greet"
                    Click="OnGreetClick"
                    Margin="0,8,0,0" />

            <TextBlock Text="{x:Bind ViewModel.Greeting, Mode=OneWay}"
                       Margin="0,16,0,0" />
        </StackPanel>

        <!-- Footer -->
        <TextBlock Grid.Row="2" Text="(C) 2024" Margin="16" />
    </Grid>
</Window>
```

### 2.2 Namespaces and xmlns Declarations

```xml
<!-- Namespace details -->
<Page
    <!-- Default XAML namespace (UI controls) -->
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"

    <!-- x: namespace (XAML built-in features: x:Name, x:Class, x:Bind) -->
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"

    <!-- Local namespace (reference your own classes) -->
    xmlns:local="using:MyApp"

    <!-- ViewModel namespace -->
    xmlns:vm="using:MyApp.ViewModels"

    <!-- CommunityToolkit controls -->
    xmlns:toolkit="using:CommunityToolkit.WinUI.UI.Controls"

    <!-- Design-time data (ignored at runtime) -->
    xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
    xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
    mc:Ignorable="d"
    d:DesignHeight="600"
    d:DesignWidth="800">

    <!-- Page content -->
</Page>
```

### 2.3 Layout Panels in Detail

```xml
<!-- StackPanel: Sequential horizontal or vertical arrangement -->
<StackPanel Orientation="Vertical" Spacing="8">
    <TextBlock Text="Item 1" />
    <TextBlock Text="Item 2" />
    <TextBlock Text="Item 3" />
</StackPanel>

<!-- Grid: Matrix arrangement of rows and columns -->
<Grid ColumnSpacing="16" RowSpacing="8" Padding="24">
    <Grid.ColumnDefinitions>
        <ColumnDefinition Width="Auto" />   <!-- Fit to content -->
        <ColumnDefinition Width="*" />      <!-- Take remaining space -->
        <ColumnDefinition Width="2*" />     <!-- Twice the remaining space -->
        <ColumnDefinition Width="200" />    <!-- Fixed width -->
    </Grid.ColumnDefinitions>
    <Grid.RowDefinitions>
        <RowDefinition Height="Auto" />
        <RowDefinition Height="*" />
    </Grid.RowDefinitions>

    <TextBlock Grid.Row="0" Grid.Column="0" Text="Top Left" />
    <TextBlock Grid.Row="0" Grid.Column="1" Grid.ColumnSpan="2" Text="Spans 2 columns" />
    <TextBlock Grid.Row="1" Grid.Column="0" Grid.RowSpan="1" Text="Bottom Left" />
</Grid>

<!-- RelativePanel: Relative positioning -->
<RelativePanel>
    <TextBlock x:Name="Header" Text="Header"
               RelativePanel.AlignTopWithPanel="True"
               RelativePanel.AlignLeftWithPanel="True"
               RelativePanel.AlignRightWithPanel="True" />

    <TextBox x:Name="SearchBox"
             RelativePanel.Below="Header"
             RelativePanel.AlignLeftWithPanel="True"
             Width="300" Margin="0,8,0,0" />

    <Button Content="Search"
            RelativePanel.Below="Header"
            RelativePanel.RightOf="SearchBox"
            Margin="8,8,0,0" />
</RelativePanel>

<!-- Canvas: Absolute coordinate positioning -->
<Canvas Width="400" Height="300">
    <Rectangle Canvas.Left="10" Canvas.Top="10"
               Width="100" Height="80"
               Fill="Blue" />
    <Ellipse Canvas.Left="150" Canvas.Top="50"
             Width="80" Height="80"
             Fill="Red" />
</Canvas>
```

### 2.4 Resources and Styles

```xml
<!-- Defining and using resources -->
<Page.Resources>
    <!-- Color definition -->
    <Color x:Key="PrimaryColor">#6366F1</Color>
    <SolidColorBrush x:Key="PrimaryBrush" Color="{StaticResource PrimaryColor}" />

    <!-- Common margin definition -->
    <Thickness x:Key="StandardMargin">16,8,16,8</Thickness>

    <!-- String resource -->
    <x:String x:Key="AppTitle">My Application</x:String>

    <!-- Button style definition -->
    <Style x:Key="PrimaryButtonStyle" TargetType="Button">
        <Setter Property="Background" Value="{StaticResource PrimaryBrush}" />
        <Setter Property="Foreground" Value="White" />
        <Setter Property="CornerRadius" Value="8" />
        <Setter Property="Padding" Value="24,12" />
        <Setter Property="FontWeight" Value="SemiBold" />
    </Style>

    <!-- Implicit style (no x:Key → applied to all TextBlocks) -->
    <Style TargetType="TextBlock">
        <Setter Property="FontFamily" Value="Segoe UI" />
        <Setter Property="FontSize" Value="14" />
    </Style>

    <!-- Style inheritance -->
    <Style x:Key="DangerButtonStyle" TargetType="Button"
           BasedOn="{StaticResource PrimaryButtonStyle}">
        <Setter Property="Background" Value="#EF4444" />
    </Style>
</Page.Resources>

<!-- Using resources -->
<StackPanel>
    <TextBlock Text="{StaticResource AppTitle}" />
    <Button Style="{StaticResource PrimaryButtonStyle}" Content="Save" />
    <Button Style="{StaticResource DangerButtonStyle}" Content="Delete" />
</StackPanel>
```

---

## 3. Data Binding

### 3.1 Binding Modes in Detail

```
Binding Modes:

  OneWay:     ViewModel → View (display only)
              Property change → UI auto-updates
              Example: text display, list display

  TwoWay:     ViewModel <-> View (bidirectional)
              UI input → property auto-updates
              Example: text input, checkbox, slider

  OneTime:    Set initial value only (no change tracking)
              Best performance
              Example: constant display, initial load of settings

  OneWayToSource: View → ViewModel (reverse direction only)
              Reflects UI value to ViewModel but not the reverse
              Example: retrieving password input value
```

### 3.2 Differences Between x:Bind and Binding

```xml
<!-- x:Bind (compile-time binding) — recommended for WinUI 3 -->
<!-- Advantages: type-safe, compile-time error detection, fast -->
<TextBlock Text="{x:Bind ViewModel.Name, Mode=OneWay}" />
<TextBox Text="{x:Bind ViewModel.Email, Mode=TwoWay, UpdateSourceTrigger=PropertyChanged}" />
<Button Command="{x:Bind ViewModel.SaveCommand}" />

<!-- Binding (runtime binding) — WPF compatible -->
<!-- Advantages: flexible binding via DataContext -->
<TextBlock Text="{Binding Name}" />
<TextBox Text="{Binding Email, Mode=TwoWay, UpdateSourceTrigger=PropertyChanged}" />
<Button Command="{Binding SaveCommand}" />

<!--
x:Bind vs Binding comparison:
┌─────────────┬────────────────────┬────────────────────┐
│ Item        │ x:Bind             │ Binding            │
├─────────────┼────────────────────┼────────────────────┤
│ Resolution  │ Compile time       │ Runtime            │
│ Type safety │ Yes                │ No                 │
│ Performance │ Fast               │ Slightly slower    │
│ Default mode│ OneTime            │ OneWay             │
│ DataContext │ Not needed (direct)│ Required           │
│ Frameworks  │ WinUI 3 / UWP     │ WPF / WinUI 3     │
│ Expressions │ Function calls OK  │ Converter required │
└─────────────┴────────────────────┴────────────────────┘
-->
```

### 3.3 Basic ViewModel Implementation (INotifyPropertyChanged)

```csharp
// ViewModel — INotifyPropertyChanged implementation (manual)
public class MainViewModel : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;

    private string _name = "";
    public string Name
    {
        get => _name;
        set
        {
            if (_name != value)
            {
                _name = value;
                OnPropertyChanged(nameof(Name));
                OnPropertyChanged(nameof(Greeting));
            }
        }
    }

    private string _email = "";
    public string Email
    {
        get => _email;
        set
        {
            if (_email != value)
            {
                _email = value;
                OnPropertyChanged(nameof(Email));
                OnPropertyChanged(nameof(IsValid));
            }
        }
    }

    public string Greeting => string.IsNullOrEmpty(Name)
        ? ""
        : $"Hello, {Name}!";

    public bool IsValid => !string.IsNullOrEmpty(Name) &&
                           !string.IsNullOrEmpty(Email) &&
                           Email.Contains('@');

    protected void OnPropertyChanged(string propertyName)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}
```

### 3.4 Collection Binding

```csharp
// List binding using ObservableCollection
using System.Collections.ObjectModel;

public class TaskListViewModel : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;

    // ObservableCollection: additions and deletions are automatically reflected in the UI
    public ObservableCollection<TaskItem> Tasks { get; } = new();

    private TaskItem? _selectedTask;
    public TaskItem? SelectedTask
    {
        get => _selectedTask;
        set
        {
            _selectedTask = value;
            OnPropertyChanged(nameof(SelectedTask));
            OnPropertyChanged(nameof(HasSelection));
        }
    }

    public bool HasSelection => SelectedTask != null;

    public void AddTask(string title)
    {
        Tasks.Add(new TaskItem { Title = title, CreatedAt = DateTime.Now });
    }

    public void RemoveTask(TaskItem task)
    {
        Tasks.Remove(task);
        if (SelectedTask == task) SelectedTask = null;
    }

    protected void OnPropertyChanged(string propertyName)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}

public class TaskItem : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;

    private string _title = "";
    public string Title
    {
        get => _title;
        set { _title = value; PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Title))); }
    }

    private bool _isCompleted;
    public bool IsCompleted
    {
        get => _isCompleted;
        set { _isCompleted = value; PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(IsCompleted))); }
    }

    public DateTime CreatedAt { get; set; }
}
```

```xml
<!-- List binding -->
<ListView ItemsSource="{x:Bind ViewModel.Tasks}"
          SelectedItem="{x:Bind ViewModel.SelectedTask, Mode=TwoWay}">
    <ListView.ItemTemplate>
        <DataTemplate x:DataType="local:TaskItem">
            <StackPanel Orientation="Horizontal" Spacing="8" Padding="8">
                <CheckBox IsChecked="{x:Bind IsCompleted, Mode=TwoWay}" />
                <TextBlock Text="{x:Bind Title}" VerticalAlignment="Center" />
                <TextBlock Text="{x:Bind CreatedAt}" Opacity="0.6"
                           VerticalAlignment="Center" FontSize="12" />
            </StackPanel>
        </DataTemplate>
    </ListView.ItemTemplate>
</ListView>

<!-- UI display control based on selection state -->
<Button Content="Delete"
        IsEnabled="{x:Bind ViewModel.HasSelection, Mode=OneWay}"
        Click="OnDeleteClick" />
```

### 3.5 Value Converters

```csharp
// Value converter: bool → Visibility conversion
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Data;

public class BoolToVisibilityConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        if (value is bool boolValue)
        {
            // Invert if parameter is "Invert"
            bool invert = parameter?.ToString() == "Invert";
            bool isVisible = invert ? !boolValue : boolValue;
            return isVisible ? Visibility.Visible : Visibility.Collapsed;
        }
        return Visibility.Collapsed;
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language)
    {
        if (value is Visibility visibility)
        {
            bool invert = parameter?.ToString() == "Invert";
            bool result = visibility == Visibility.Visible;
            return invert ? !result : result;
        }
        return false;
    }
}

// Date format converter
public class DateFormatConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        if (value is DateTime dateTime)
        {
            string format = parameter?.ToString() ?? "yyyy/MM/dd HH:mm";
            return dateTime.ToString(format);
        }
        return value?.ToString() ?? "";
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language)
    {
        if (value is string str && DateTime.TryParse(str, out var result))
        {
            return result;
        }
        return DateTime.MinValue;
    }
}

// Number → color conversion (e.g., color based on priority)
public class PriorityToColorConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        if (value is string priority)
        {
            return priority switch
            {
                "high" => new SolidColorBrush(Windows.UI.Color.FromArgb(255, 239, 68, 68)),   // Red
                "medium" => new SolidColorBrush(Windows.UI.Color.FromArgb(255, 245, 158, 11)), // Yellow
                "low" => new SolidColorBrush(Windows.UI.Color.FromArgb(255, 34, 197, 94)),     // Green
                _ => new SolidColorBrush(Windows.UI.Color.FromArgb(255, 156, 163, 175)),       // Gray
            };
        }
        return new SolidColorBrush(Windows.UI.Color.FromArgb(255, 156, 163, 175));
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language)
    {
        throw new NotImplementedException();
    }
}
```

```xml
<!-- Using converters -->
<Page.Resources>
    <local:BoolToVisibilityConverter x:Key="BoolToVisibility" />
    <local:DateFormatConverter x:Key="DateFormat" />
    <local:PriorityToColorConverter x:Key="PriorityColor" />
</Page.Resources>

<!-- Visibility control -->
<ProgressRing Visibility="{x:Bind ViewModel.IsLoading, Mode=OneWay,
              Converter={StaticResource BoolToVisibility}}" />

<!-- To hide, specify Invert in parameter -->
<TextBlock Text="No data"
           Visibility="{x:Bind ViewModel.HasData, Mode=OneWay,
           Converter={StaticResource BoolToVisibility}, ConverterParameter=Invert}" />

<!-- Date formatting -->
<TextBlock Text="{x:Bind ViewModel.CreatedAt, Mode=OneWay,
           Converter={StaticResource DateFormat}, ConverterParameter='MM/dd/yyyy'}" />

<!-- Color display based on priority -->
<Border Background="{x:Bind Priority, Converter={StaticResource PriorityColor}}"
        CornerRadius="4" Padding="8,4">
    <TextBlock Text="{x:Bind Priority}" Foreground="White" />
</Border>
```

---

## 4. MVVM Pattern

### 4.1 MVVM Architecture

```
MVVM (Model-View-ViewModel):

  ┌──────────┐
  │   View   │  XAML + code-behind
  │  (XAML)  │  UI display and user input
  └────┬─────┘
       │ Data binding
       │ Command binding
  ┌────▼─────┐
  │ViewModel │  Presentation logic
  │          │  INotifyPropertyChanged
  │          │  ICommand
  └────┬─────┘
       │ Dependency injection
  ┌────▼─────┐
  │  Model   │  Business logic
  │          │  Data access
  └──────────┘

  Benefits:
    - Separation of UI and logic
    - Improved testability
    - Division of work between designer and developer
    - Improved reusability
```

### 4.2 Concise ViewModel Using CommunityToolkit.Mvvm

```csharp
// Concise ViewModel using CommunityToolkit.Mvvm
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

public partial class MainViewModel : ObservableObject
{
    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(Greeting))]
    private string _name = "";

    public string Greeting => string.IsNullOrEmpty(Name)
        ? "" : $"Hello, {Name}!";

    [RelayCommand]
    private async Task SaveAsync()
    {
        await _fileService.SaveAsync(Name);
    }
}
```

### 4.3 Combining with Dependency Injection

```csharp
// Service definition
public interface ITaskService
{
    Task<IReadOnlyList<TaskItem>> GetAllAsync();
    Task<TaskItem> CreateAsync(string title);
    Task UpdateAsync(TaskItem task);
    Task DeleteAsync(int id);
}

// Service implementation
public class TaskService : ITaskService
{
    private readonly HttpClient _httpClient;

    public TaskService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<IReadOnlyList<TaskItem>> GetAllAsync()
    {
        var response = await _httpClient.GetAsync("/api/tasks");
        response.EnsureSuccessStatusCode();
        var tasks = await response.Content.ReadFromJsonAsync<List<TaskItem>>();
        return tasks ?? new List<TaskItem>();
    }

    public async Task<TaskItem> CreateAsync(string title)
    {
        var response = await _httpClient.PostAsJsonAsync("/api/tasks", new { title });
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<TaskItem>()
            ?? throw new InvalidOperationException("Failed to create task");
    }

    public async Task UpdateAsync(TaskItem task)
    {
        var response = await _httpClient.PutAsJsonAsync($"/api/tasks/{task.Id}", task);
        response.EnsureSuccessStatusCode();
    }

    public async Task DeleteAsync(int id)
    {
        var response = await _httpClient.DeleteAsync($"/api/tasks/{id}");
        response.EnsureSuccessStatusCode();
    }
}

// ViewModel: receives services via dependency injection
public partial class TaskListViewModel : ObservableObject
{
    private readonly ITaskService _taskService;

    public TaskListViewModel(ITaskService taskService)
    {
        _taskService = taskService;
    }

    [ObservableProperty]
    private ObservableCollection<TaskItem> _tasks = new();

    [ObservableProperty]
    private bool _isLoading;

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(DeleteTaskCommand))]
    private TaskItem? _selectedTask;

    [ObservableProperty]
    private string _newTaskTitle = "";

    [RelayCommand]
    private async Task LoadTasksAsync()
    {
        try
        {
            IsLoading = true;
            var tasks = await _taskService.GetAllAsync();
            Tasks = new ObservableCollection<TaskItem>(tasks);
        }
        catch (Exception ex)
        {
            // Error handling
            Debug.WriteLine($"Task load error: {ex.Message}");
        }
        finally
        {
            IsLoading = false;
        }
    }

    [RelayCommand]
    private async Task AddTaskAsync()
    {
        if (string.IsNullOrWhiteSpace(NewTaskTitle)) return;

        var task = await _taskService.CreateAsync(NewTaskTitle);
        Tasks.Add(task);
        NewTaskTitle = "";
    }

    private bool CanDeleteTask() => SelectedTask != null;

    [RelayCommand(CanExecute = nameof(CanDeleteTask))]
    private async Task DeleteTaskAsync()
    {
        if (SelectedTask == null) return;

        await _taskService.DeleteAsync(SelectedTask.Id);
        Tasks.Remove(SelectedTask);
        SelectedTask = null;
    }
}
```

### 4.4 DI Container Configuration (WinUI 3)

```csharp
// App.xaml.cs — DI container configuration
using Microsoft.Extensions.DependencyInjection;
using Microsoft.UI.Xaml;

public partial class App : Application
{
    public IServiceProvider Services { get; }
    public static new App Current => (App)Application.Current;

    public App()
    {
        this.InitializeComponent();

        // Build the DI container
        var services = new ServiceCollection();

        // Register services
        services.AddHttpClient<ITaskService, TaskService>(client =>
        {
            client.BaseAddress = new Uri("https://api.example.com");
        });

        // Register ViewModels
        services.AddTransient<MainViewModel>();
        services.AddTransient<TaskListViewModel>();
        services.AddTransient<SettingsViewModel>();

        // Register navigation service
        services.AddSingleton<INavigationService, NavigationService>();

        Services = services.BuildServiceProvider();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        var window = new MainWindow();
        window.Activate();
    }
}

// Obtaining ViewModel in a page
public sealed partial class TaskListPage : Page
{
    public TaskListViewModel ViewModel { get; }

    public TaskListPage()
    {
        ViewModel = App.Current.Services.GetRequiredService<TaskListViewModel>();
        this.InitializeComponent();

        // Load data when page loads
        Loaded += async (_, _) => await ViewModel.LoadTasksCommand.ExecuteAsync(null);
    }
}
```

---

## 5. Code Comparison Across Frameworks

### 5.1 Implementation Example in WPF

```csharp
// WPF: MainWindow.xaml.cs
using System.Windows;

namespace WpfApp;

public partial class MainWindow : Window
{
    public MainViewModel ViewModel { get; }

    public MainWindow()
    {
        ViewModel = new MainViewModel();
        DataContext = ViewModel;
        InitializeComponent();
    }
}
```

```xml
<!-- WPF: MainWindow.xaml -->
<Window x:Class="WpfApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="WPF App" Height="400" Width="600">
    <StackPanel Margin="16">
        <!-- WPF uses Binding (runtime) -->
        <TextBox Text="{Binding Name, UpdateSourceTrigger=PropertyChanged}"
                 Margin="0,0,0,8" />
        <Button Content="Greet" Command="{Binding GreetCommand}"
                Margin="0,0,0,8" />
        <TextBlock Text="{Binding Greeting}" FontSize="18" />
    </StackPanel>
</Window>
```

### 5.2 Implementation Example in WinUI 3

```csharp
// WinUI 3: MainWindow.xaml.cs
using Microsoft.UI.Xaml;

namespace WinUIApp;

public sealed partial class MainWindow : Window
{
    public MainViewModel ViewModel { get; } = new();

    public MainWindow()
    {
        this.InitializeComponent();
    }
}
```

```xml
<!-- WinUI 3: MainWindow.xaml -->
<Window x:Class="WinUIApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="WinUI 3 App">
    <StackPanel Margin="16" Spacing="8">
        <!-- WinUI 3 recommends x:Bind (compile-time) -->
        <TextBox Text="{x:Bind ViewModel.Name, Mode=TwoWay, UpdateSourceTrigger=PropertyChanged}" />
        <Button Content="Greet" Command="{x:Bind ViewModel.GreetCommand}" />
        <TextBlock Text="{x:Bind ViewModel.Greeting, Mode=OneWay}"
                   Style="{StaticResource SubtitleTextBlockStyle}" />
    </StackPanel>
</Window>
```

### 5.3 Implementation Example in .NET MAUI

```csharp
// MAUI: MainPage.xaml.cs
namespace MauiApp;

public partial class MainPage : ContentPage
{
    public MainViewModel ViewModel { get; } = new();

    public MainPage()
    {
        BindingContext = ViewModel;
        InitializeComponent();
    }
}
```

```xml
<!-- MAUI: MainPage.xaml -->
<ContentPage xmlns="http://schemas.microsoft.com/dotnet/2021/maui"
             xmlns:x="http://schemas.microsoft.com/winfx/2009/xaml"
             x:Class="MauiApp.MainPage">
    <VerticalStackLayout Spacing="8" Padding="16">
        <!-- MAUI uses Binding -->
        <Entry Text="{Binding Name}" Placeholder="Enter your name" />
        <Button Text="Greet" Command="{Binding GreetCommand}" />
        <Label Text="{Binding Greeting}" FontSize="18" />
    </VerticalStackLayout>
</ContentPage>
```

### 5.4 API Correspondence Table Between Frameworks

```
Differences in control names across frameworks:

  Concept         │ WPF           │ WinUI 3       │ MAUI
  ─────────────────┼──────────────┼──────────────┼──────────────
  Text display    │ TextBlock     │ TextBlock     │ Label
  Text input      │ TextBox       │ TextBox       │ Entry
  Multi-line input│ TextBox       │ TextBox       │ Editor
  Button          │ Button        │ Button        │ Button
  Checkbox        │ CheckBox      │ CheckBox      │ CheckBox
  Dropdown        │ ComboBox      │ ComboBox      │ Picker
  List            │ ListView      │ ListView      │ CollectionView
  Scroll          │ ScrollViewer  │ ScrollViewer  │ ScrollView
  Vertical stack  │ StackPanel    │ StackPanel    │ VerticalStackLayout
  Horizontal stack│ StackPanel    │ StackPanel    │ HorizontalStackLayout
  Grid            │ Grid          │ Grid          │ Grid
  Image           │ Image         │ Image         │ Image
  Slider          │ Slider        │ Slider        │ Slider
  Toggle          │ ToggleButton  │ ToggleSwitch  │ Switch
  Navigation      │ Frame         │ NavigationView│ Shell
  Dialog          │ MessageBox    │ ContentDialog │ DisplayAlert
```

---

## 6. Migration Guide from Windows Forms

### 6.1 Choosing a Migration Path

```
Windows Forms → WPF / WinUI 3 Migration Decision Criteria:

  WForms → WPF:
    · Gradual migration from .NET Framework
    · Existing WinForms controls can be hosted in WPF
    · Coexistence via WindowsFormsHost control

  WForms → WinUI 3:
    · Modern UI required
    · Already migrated to newer .NET (.NET 8+)
    · Fluent Design required

  Migration Priority:
    1. Separate business logic (decouple from UI)
    2. Convert event handlers to MVVM pattern
    3. Incrementally rewrite the UI
    4. Add tests
```

### 6.2 Converting from Event-Driven to MVVM

```csharp
// Before: Windows Forms event-driven style
// Button click → direct DB operation → UI update
public partial class OrderForm : Form
{
    private void btnSubmit_Click(object sender, EventArgs e)
    {
        // Business logic tightly coupled to UI
        var order = new Order
        {
            CustomerName = txtCustomerName.Text,
            Amount = decimal.Parse(txtAmount.Text),
        };

        using var conn = new SqlConnection(connectionString);
        conn.Open();
        // ... SQL execution

        lblStatus.Text = "Order completed";
        txtCustomerName.Text = "";
        txtAmount.Text = "";
    }
}
```

```csharp
// After: MVVM pattern (WPF / WinUI 3)
// ViewModel: logic completely independent from UI
public partial class OrderViewModel : ObservableObject
{
    private readonly IOrderService _orderService;

    public OrderViewModel(IOrderService orderService)
    {
        _orderService = orderService;
    }

    [ObservableProperty]
    private string _customerName = "";

    [ObservableProperty]
    private string _amount = "";

    [ObservableProperty]
    private string _statusMessage = "";

    [RelayCommand]
    private async Task SubmitOrderAsync()
    {
        if (!decimal.TryParse(Amount, out var amountValue))
        {
            StatusMessage = "Invalid amount";
            return;
        }

        var order = new Order
        {
            CustomerName = CustomerName,
            Amount = amountValue,
        };

        await _orderService.CreateAsync(order);
        StatusMessage = "Order completed";
        CustomerName = "";
        Amount = "";
    }
}
```

---

## 7. Performance Comparison

```
Performance characteristics by framework:

  ┌────────────┬──────────┬──────────┬──────────┬──────────┐
  │ Metric     │ WForms   │ WPF      │ WinUI 3  │ MAUI     │
  ├────────────┼──────────┼──────────┼──────────┼──────────┤
  │ Startup    │ Fastest  │ Slower   │ Slower   │ Slow     │
  │ Memory     │ Minimal  │ Medium   │ Medium   │ Slightly more│
  │ GPU use    │ None     │ Yes      │ Optimal  │ OS-dependent│
  │ Large data │ Good     │ Virtual  │ Virtual  │ Virtual  │
  │ Animation  │ Limited  │ Good     │ Best     │ OS-dependent│
  │ High DPI   │ Manual   │ Good     │ Best     │ Automatic│
  └────────────┴──────────┴──────────┴──────────┴──────────┘

  Performance optimization tips:

  WPF:
    · Virtualize large lists with VirtualizingStackPanel
    · Freeze Freezable objects (brushes, geometries, etc.)
    · Actively use BindingMode=OneTime
    · Async data loading (async/await)

  WinUI 3:
    · Compile-time binding with x:Bind
    · Lazy loading with x:Load / x:DeferLoadStrategy
    · Replace ListView with ItemsRepeater for large data
    · Animation optimization with Composition API
```

---

## 8. Accessibility Support

```csharp
// Accessibility implementation example in WinUI 3
// Provide information to assistive technologies via AutomationProperties
```

```xml
<!-- Accessibility-aware XAML -->
<StackPanel>
    <!-- Setting name for screen readers -->
    <TextBox
        AutomationProperties.Name="Username input field"
        AutomationProperties.HelpText="Enter the username used to log in"
        PlaceholderText="Username" />

    <!-- Setting landmarks -->
    <NavigationView
        AutomationProperties.LandmarkType="Navigation"
        AutomationProperties.Name="Main navigation">
        <!-- ... -->
    </NavigationView>

    <!-- Live region (dynamically changing text) -->
    <TextBlock
        x:Name="StatusText"
        AutomationProperties.LiveSetting="Polite"
        AutomationProperties.Name="Status message" />

    <!-- High contrast mode support -->
    <Button Content="Save"
            Style="{ThemeResource AccentButtonStyle}">
        <!-- Using ThemeResource automatically supports high contrast mode -->
    </Button>

    <!-- Keyboard navigation -->
    <Grid KeyboardAcceleratorPlacementMode="Hidden">
        <Grid.KeyboardAccelerators>
            <KeyboardAccelerator Key="S" Modifiers="Control"
                                 Invoked="SaveAccelerator_Invoked" />
        </Grid.KeyboardAccelerators>
    </Grid>
</StackPanel>
```

```csharp
// Tab order control
public sealed partial class LoginPage : Page
{
    public LoginPage()
    {
        InitializeComponent();

        // Explicitly set tab order
        UsernameBox.TabIndex = 1;
        PasswordBox.TabIndex = 2;
        LoginButton.TabIndex = 3;
        ForgotPasswordLink.TabIndex = 4;

        // Set initial focus
        Loaded += (_, _) => UsernameBox.Focus(FocusState.Programmatic);
    }
}
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Validate input data
- Implement appropriate error handling
- Also create test code

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
        assert False, "Exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation to add the following features.

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
        """Add item (with size limit)"""
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
        """Delete by key"""
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
    assert ex.add("d", 4) == False  # Size limit
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

    print(f"Inefficient version: {slow_time:.4f}s")
    print(f"Efficient version:   {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be mindful of algorithmic complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Missing or malformed config file | Verify config file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check execution user permissions and review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check error messages**: Read the stack trace to identify the location of the error
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Formulate hypotheses**: List possible causes
4. **Stepwise verification**: Verify hypotheses using log output or a debugger
5. **Fix and regression test**: After fixing, also run tests for related areas

```python
# Debugging utility
import logging
import traceback
from functools import wraps

# Logger configuration
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

def debug_decorator(func):
    """Decorator to log function inputs and outputs"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Call: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception in: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """Data processing (debug target)"""
    if not items:
        raise ValueError("Empty data")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps for diagnosing performance problems:

1. **Identify bottlenecks**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check I/O waits**: Review disk and network I/O status
4. **Check concurrent connections**: Verify connection pool status

| Problem Type | Diagnostic Tool | Solution |
|-----------|-----------|------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexing, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology selections.

| Criteria | When to prioritize | When to compromise |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time to market | Quality-first, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow            │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. What is the team size?                      │
│    ├─ Small (1-5) → Monolith                    │
│    └─ Large (10+) → Go to 2                     │
│                                                 │
│  2. What is the deployment frequency?           │
│    ├─ Weekly or less → Monolith + modular split  │
│    └─ Daily / multiple times → Go to 3          │
│                                                 │
│  3. How independent are teams?                  │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs. Long-term Cost**
- A faster short-term approach can become technical debt in the long term
- Conversely, over-engineering incurs high short-term costs and can delay the project

**2. Consistency vs. Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies allows the right tool for the job but increases operational costs

**3. Level of Abstraction**
- High abstraction improves reusability but can make debugging difficult
- Low abstraction is intuitive but tends to lead to code duplication

```python
# Design decision record template
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe background and problem"""
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
        md += f"## Context\n{self.context}\n\n"
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

## FAQ

### Q1: Should I migrate from WPF to WinUI 3?
WinUI 3 is recommended for new development. There is no rush to migrate existing WPF apps that are running stably. XAML Islands allows gradual introduction of WinUI 3 controls. However, since WPF continues to be supported in .NET 8 and beyond, migration urgency is low. Migration to WinUI 3 is particularly worthwhile when Fluent Design support is needed or when you want to leverage Windows 11-specific features (Mica, Snap Layouts, etc.).

### Q2: Is MAUI production-ready?
It is viable for Windows + macOS. iOS/Android are supported but fall short of native polish. For Windows-only applications, WinUI 3 is better. MAUI is the successor to Xamarin.Forms and is suitable for business applications that need cross-platform deployment. However, when highly customized platform-specific UI is required, it is more efficient to use each OS's native framework directly.

### Q3: Should I use CommunityToolkit.Mvvm?
Recommended. INotifyPropertyChanged boilerplate is auto-generated by the Source Generator. RelayCommand can also be written concisely. Compared to manual implementation, code volume can be reduced by 50-70%. It can be used with WPF, WinUI 3, and MAUI, and makes sharing ViewModels across frameworks easy. Simply install the `CommunityToolkit.Mvvm` NuGet package to get started.

### Q4: Can Windows Forms still be used?
Yes. Support continues in .NET 8 and beyond, and new features are being added. There is no need to hurry to migrate existing Windows Forms applications. However, there are few compelling reasons to choose Windows Forms for new development. When high DPI support or modern UI design is required, WPF or WinUI 3 should be chosen.

### Q5: What WPF features are not yet supported in WinUI 3?
Some WPF features have not yet been ported to WinUI 3. Notable examples include FlowDocument (rich text display), XPS print support, some 3D rendering capabilities, and RibbonControl. If these features are needed, you must continue using WPF or substitute with third-party libraries.

---

## Summary

| Framework | Recommended Use Case | Status |
|-------------|---------|------|
| WinUI 3 | New Windows native development | Recommended |
| WPF | Maintenance and extension of existing apps | Maintenance mode |
| MAUI | Cross-platform | Active |
| UWP | None (recommend migrating to WinUI 3) | Deprecated |
| Windows Forms | Maintenance of legacy apps | Supported |

---

## What to Read Next

---

## References
1. Microsoft. "WinUI 3." learn.microsoft.com/windows/apps/winui, 2024.
2. Microsoft. "WPF Documentation." learn.microsoft.com/dotnet/desktop/wpf, 2024.
3. Microsoft. ".NET MAUI." learn.microsoft.com/dotnet/maui, 2024.
4. Microsoft. "CommunityToolkit.Mvvm." learn.microsoft.com/dotnet/communitytoolkit/mvvm, 2024.
5. Microsoft. "Windows Forms." learn.microsoft.com/dotnet/desktop/winforms, 2024.
6. Microsoft. "XAML Overview." learn.microsoft.com/windows/uwp/xaml-platform, 2024.
7. Microsoft. "Windows App SDK." learn.microsoft.com/windows/apps/windows-app-sdk, 2024.

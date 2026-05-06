# Terminal Setup

> A practical guide to building a modern terminal emulator and shell environment to maximize the efficiency of command-line work.

## What You Will Learn

1. Installing and advanced customization of iTerm2 / Windows Terminal / Alacritty / Warp
2. Configuring zsh / fish / PowerShell and customizing prompts with Starship
3. Practical techniques for session management and pane splitting with tmux
4. Installing and integrating modern CLI tools
5. Backing up and rebuilding your terminal environment


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [VS Code Setup](./00-vscode-setup.md)

---

## 1. Choosing a Terminal Emulator

### 1.1 Comparison of Major Terminals

| Feature | iTerm2 (macOS) | Windows Terminal | Alacritty | Warp | Kitty | WezTerm |
|---------|----------------|------------------|-----------|------|-------|---------|
| OS | macOS | Windows | Cross-platform | macOS / Linux | Cross-platform | Cross-platform |
| GPU Acceleration | Partial | Yes | Yes | Yes | Yes | Yes |
| Tabs/Panes | Yes | Yes | No (use tmux) | Yes | Yes | Yes |
| Config Format | GUI + Plist | JSON | TOML | GUI | conf | Lua |
| Search | Advanced | Yes | Basic | AI-powered | Yes | Yes |
| Image Display | Yes | Limited | No | Yes | Yes (icat) | Yes |
| Ligatures | Yes | Yes | No | Yes | Yes | Yes |
| Price | Free | Free | Free | Freemium | Free | Free |
| Rendering Engine | Metal | DirectX | OpenGL/Metal | Metal | OpenGL | OpenGL |
| Memory Usage | Medium | Medium | Low | High | Low | Medium |

### 1.2 iTerm2 Setup (macOS)

```bash
# Install
brew install --cask iterm2

# Import a color scheme
# Download a .itermcolors file from https://iterm2colorschemes.com/
# Preferences → Profiles → Colors → Color Presets → Import

# Popular color schemes
# - Catppuccin Mocha (dark theme, easy on the eyes)
# - Tokyo Night (calm dark)
# - Dracula (high-contrast dark)
# - One Half Dark (VS Code-style)
# - Solarized Dark (a classic)
# - Nord (cool blue theme)
```

Recommended settings:

```
iTerm2 Recommended Settings:
┌─────────────────────────────────────────┐
│ Preferences → General                    │
│   ✅ Closing → Confirm "Quit iTerm2"    │
│   ✅ Selection → Copy to pasteboard     │
│      on selection                        │
│   ✅ Magic → Enable Python API          │
│                                           │
│ Preferences → Appearance                 │
│   Theme: Minimal (modern look)           │
│   Tab bar location: Top                  │
│   Status bar location: Bottom            │
│                                           │
│ Preferences → Profiles → General        │
│   Working Directory: "Reuse previous"    │
│   Title: Name + Job                      │
│                                           │
│ Preferences → Profiles → Text           │
│   Font: JetBrains Mono Nerd Font 14pt   │
│   ✅ Use ligatures                       │
│   ✅ Anti-aliased                        │
│   Use thin strokes: Retina              │
│                                           │
│ Preferences → Profiles → Window         │
│   Transparency: 5-10%                    │
│   Blur: 10                               │
│   Columns: 120, Rows: 35                │
│   Style: Normal                          │
│                                           │
│ Preferences → Profiles → Terminal       │
│   Scrollback lines: 10000               │
│   ✅ Unlimited scrollback               │
│   ✅ Save lines to scrollback in        │
│      alternate screen mode              │
│                                           │
│ Preferences → Profiles → Session        │
│   ✅ Status bar enabled                 │
│   Configure: CPU / Memory / Network     │
│                                           │
│ Preferences → Profiles → Keys           │
│   Left Option Key: Esc+                  │
│   (required for word-by-word movement)   │
│   Right Option Key: Esc+                 │
│                                           │
│ Preferences → Keys → Key Bindings       │
│   ⌘← : Send Hex Codes: 0x01 (line start) │
│   ⌘→ : Send Hex Codes: 0x05 (line end)  │
│   ⌥← : Send Escape Sequence: b (word left) │
│   ⌥→ : Send Escape Sequence: f (word right) │
└─────────────────────────────────────────┘
```

#### Advanced iTerm2 Features

```bash
# ─── Trigger Settings (Auto-Highlight) ───
# Preferences → Profiles → Advanced → Triggers
# Regular Expression: ERROR|FATAL|CRITICAL
# Action: Highlight Text
# Parameters: Red background

# ─── Automatic Profile Switching ───
# Change background color per SSH server
# Preferences → Profiles → Advanced → Automatic Profile Switching
# Hostname pattern: *.production.* → "Production" profile (red background)
# Hostname pattern: *.staging.*    → "Staging" profile (yellow background)

# ─── Shell Integration (very useful) ───
# Install iTerm2 Shell Integration
curl -L https://iterm2.com/shell_integration/install_shell_integration.sh | bash

# Shell Integration features:
# - Show success/failure next to the prompt
# - Click to select previous command output
# - Display images in the terminal with imgcat
# - Clipboard operations with it2copy / it2paste
# - Timestamps and execution time in command history

# ─── Display images with imgcat ───
imgcat screenshot.png

# ─── Badge Setting (for pane identification) ───
# Preferences → Profiles → General → Badge
# Set \(session.hostname) to display the hostname
# faintly in each pane
```

#### iTerm2 Keyboard Shortcuts

```
iTerm2 Essential Shortcuts:
┌──────────────────────────────────────────┐
│ Window/Tab Operations                     │
│   ⌘T        New tab                      │
│   ⌘N        New window                   │
│   ⌘W        Close tab                    │
│   ⌘1-9      Switch tabs                  │
│   ⌘←→       Previous/next tab            │
│                                           │
│ Pane Operations                           │
│   ⌘D        Vertical split               │
│   ⌘⇧D      Horizontal split             │
│   ⌘⌥←→↑↓   Move between panes           │
│   ⌘⇧Enter   Maximize/restore pane        │
│                                           │
│ Search                                    │
│   ⌘F        Search                       │
│   ⌘⇧F      Search all tabs              │
│   ⌘⌥B      Go back with timestamp       │
│                                           │
│ Other                                     │
│   ⌘;        Autocomplete                 │
│   ⌘⇧H      Paste history                │
│   ⌘⌥E      Broadcast input to all panes │
│   ⌘/        Highlight cursor position    │
│   ⌘U        Toggle transparency          │
└──────────────────────────────────────────┘
```

### 1.3 Windows Terminal Setup

```jsonc
// settings.json (Windows Terminal)
// Location: %LOCALAPPDATA%\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json
{
  "$help": "https://aka.ms/terminal-documentation",
  "$schema": "https://aka.ms/terminal-profiles-schema",
  "defaultProfile": "{your-powershell-guid}",
  "copyOnSelect": true,
  "copyFormatting": "none",
  "trimBlockSelection": true,
  "wordDelimiters": " /\\()\"'-.,:;<>~!@#$%^&*|+=[]{}~?",

  "profiles": {
    "defaults": {
      "font": {
        "face": "JetBrains Mono Nerd Font",
        "size": 12,
        "weight": "normal"
      },
      "colorScheme": "One Half Dark",
      "opacity": 95,
      "useAcrylic": true,
      "acrylicOpacity": 0.85,
      "padding": "8",
      "cursorShape": "bar",
      "cursorColor": "#FFFFFF",
      "antialiasingMode": "cleartype",
      "scrollbarState": "hidden",
      "bellStyle": "none",
      "snapOnInput": true,
      "altGrAliasing": true
    },
    "list": [
      {
        "name": "PowerShell 7",
        "source": "Windows.Terminal.PowershellCore",
        "startingDirectory": "%USERPROFILE%",
        "icon": "ms-appx:///ProfileIcons/pwsh.png",
        "commandline": "pwsh.exe -NoLogo"
      },
      {
        "name": "Ubuntu (WSL)",
        "source": "Windows.Terminal.Wsl",
        "startingDirectory": "~",
        "colorScheme": "Catppuccin Mocha"
      },
      {
        "name": "Git Bash",
        "commandline": "C:\\Program Files\\Git\\bin\\bash.exe --login -i",
        "startingDirectory": "%USERPROFILE%",
        "icon": "C:\\Program Files\\Git\\mingw64\\share\\git\\git-for-windows.ico"
      },
      {
        "name": "Azure Cloud Shell",
        "source": "Windows.Terminal.Azure"
      }
    ]
  },

  // Custom color schemes
  "schemes": [
    {
      "name": "Catppuccin Mocha",
      "foreground": "#CDD6F4",
      "background": "#1E1E2E",
      "cursorColor": "#F5E0DC",
      "selectionBackground": "#585B70",
      "black": "#45475A",
      "red": "#F38BA8",
      "green": "#A6E3A1",
      "yellow": "#F9E2AF",
      "blue": "#89B4FA",
      "purple": "#F5C2E7",
      "cyan": "#94E2D5",
      "white": "#BAC2DE",
      "brightBlack": "#585B70",
      "brightRed": "#F38BA8",
      "brightGreen": "#A6E3A1",
      "brightYellow": "#F9E2AF",
      "brightBlue": "#89B4FA",
      "brightPurple": "#F5C2E7",
      "brightCyan": "#94E2D5",
      "brightWhite": "#A6ADC8"
    }
  ],

  "actions": [
    { "command": "toggleFocusMode", "keys": "f11" },
    { "command": "toggleFullscreen", "keys": "alt+enter" },
    { "command": { "action": "splitPane", "split": "horizontal" }, "keys": "alt+shift+-" },
    { "command": { "action": "splitPane", "split": "vertical" }, "keys": "alt+shift+=" },
    { "command": { "action": "moveFocus", "direction": "left" }, "keys": "alt+h" },
    { "command": { "action": "moveFocus", "direction": "down" }, "keys": "alt+j" },
    { "command": { "action": "moveFocus", "direction": "up" }, "keys": "alt+k" },
    { "command": { "action": "moveFocus", "direction": "right" }, "keys": "alt+l" },
    { "command": { "action": "resizePane", "direction": "left" }, "keys": "alt+shift+h" },
    { "command": { "action": "resizePane", "direction": "down" }, "keys": "alt+shift+j" },
    { "command": { "action": "resizePane", "direction": "up" }, "keys": "alt+shift+k" },
    { "command": { "action": "resizePane", "direction": "right" }, "keys": "alt+shift+l" },
    { "command": { "action": "newTab" }, "keys": "ctrl+shift+t" },
    { "command": "find", "keys": "ctrl+shift+f" },
    { "command": { "action": "switchToTab", "index": 0 }, "keys": "alt+1" },
    { "command": { "action": "switchToTab", "index": 1 }, "keys": "alt+2" },
    { "command": { "action": "switchToTab", "index": 2 }, "keys": "alt+3" }
  ]
}
```

### 1.4 Alacritty Setup

```bash
# Install
brew install --cask alacritty    # macOS
sudo apt install alacritty       # Ubuntu
cargo install alacritty          # Build from source
```

```toml
# ~/.config/alacritty/alacritty.toml

# ─── Window Settings ───
[window]
dimensions = { columns = 120, lines = 35 }
padding = { x = 8, y = 8 }
decorations = "Buttonless"
opacity = 0.95
startup_mode = "Windowed"
dynamic_title = true

# ─── Font Settings ───
[font]
size = 14.0

[font.normal]
family = "JetBrains Mono Nerd Font"
style = "Regular"

[font.bold]
family = "JetBrains Mono Nerd Font"
style = "Bold"

[font.italic]
family = "JetBrains Mono Nerd Font"
style = "Italic"

[font.bold_italic]
family = "JetBrains Mono Nerd Font"
style = "Bold Italic"

# ─── Cursor Settings ───
[cursor]
style = { shape = "Beam", blinking = "On" }
vi_mode_style = { shape = "Block", blinking = "Off" }
blink_interval = 500
blink_timeout = 5

# ─── Scrolling Settings ───
[scrolling]
history = 10000
multiplier = 3

# ─── Color Scheme (Catppuccin Mocha) ───
[colors.primary]
background = "#1E1E2E"
foreground = "#CDD6F4"
dim_foreground = "#CDD6F4"
bright_foreground = "#CDD6F4"

[colors.cursor]
text = "#1E1E2E"
cursor = "#F5E0DC"

[colors.vi_mode_cursor]
text = "#1E1E2E"
cursor = "#B4BEFE"

[colors.search.matches]
foreground = "#1E1E2E"
background = "#A6ADC8"

[colors.search.focused_match]
foreground = "#1E1E2E"
background = "#A6E3A1"

[colors.normal]
black = "#45475A"
red = "#F38BA8"
green = "#A6E3A1"
yellow = "#F9E2AF"
blue = "#89B4FA"
magenta = "#F5C2E7"
cyan = "#94E2D5"
white = "#BAC2DE"

[colors.bright]
black = "#585B70"
red = "#F38BA8"
green = "#A6E3A1"
yellow = "#F9E2AF"
blue = "#89B4FA"
magenta = "#F5C2E7"
cyan = "#94E2D5"
white = "#A6ADC8"

# ─── Key Bindings ───
key = "N"
mods = "Command"
action = "SpawnNewInstance"

key = "Return"
mods = "Command"
action = "ToggleFullscreen"

# tmux integration (pass Ctrl+a through)
key = "A"
mods = "Control"
chars = "\u0001"
```

### 1.5 Warp Terminal Features and Settings

```bash
# Install
brew install --cask warp

# Warp's unique features:
# 1. AI Command Search: search for commands in natural language
#    Example: "find large files" → find . -type f -size +100M
#
# 2. Blocks: commands and output managed as individual blocks
#    - Copy/share each block independently
#    - Collapse output
#
# 3. Workflows: save frequently used command sequences
#    - Templates with parameters
#    - Shareable with your team
#
# 4. Warp Drive: cloud sync
#    - Sync settings
#    - Share workflows
```

```yaml
# ~/.warp/themes/custom.yaml
# Custom theme definition
accent: "#89B4FA"
background: "#1E1E2E"
foreground: "#CDD6F4"
details: "darker"
terminal_colors:
  normal:
    black: "#45475A"
    red: "#F38BA8"
    green: "#A6E3A1"
    yellow: "#F9E2AF"
    blue: "#89B4FA"
    magenta: "#F5C2E7"
    cyan: "#94E2D5"
    white: "#BAC2DE"
  bright:
    black: "#585B70"
    red: "#F38BA8"
    green: "#A6E3A1"
    yellow: "#F9E2AF"
    blue: "#89B4FA"
    magenta: "#F5C2E7"
    cyan: "#94E2D5"
    white: "#A6ADC8"
```

---

## 2. Shell Configuration

### 2.1 Shell Comparison

| Feature | zsh | fish | PowerShell 7 | bash | nushell |
|---------|-----|------|-------------|------|---------|
| POSIX Compatible | Yes | No | No | Yes | No |
| Default OS | macOS | None | Windows | Linux | None |
| Completion | Requires plugins | Built-in | Built-in | Basic | Built-in |
| Script Compatibility | Nearly same as bash | Own syntax | .NET based | Standard | Own syntax |
| Learning Curve | Low | Low | Medium | Low | Medium |
| Plugin Ecosystem | Very rich | Rich | Growing | Limited | Growing |
| Startup Speed | Plugin-dependent | Fast | Slow | Fast | Fast |
| Structured Data | None | None | Objects | None | Tables |
| Pipes | Text | Text | Objects | Text | Structured |

### 2.2 zsh Configuration

```bash
# If zsh is not the default
chsh -s $(which zsh)

# Basic .zshrc configuration
cat << 'EOF' >> ~/.zshrc
# ─── Basic Settings ───
export LANG=ja_JP.UTF-8
export EDITOR="code --wait"
export VISUAL="code --wait"
export PAGER="less -R"
export LESS="-i -M -R -S -W -z-4"

# XDG Base Directory compliance
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_DATA_HOME="$HOME/.local/share"
export XDG_CACHE_HOME="$HOME/.cache"
export XDG_STATE_HOME="$HOME/.local/state"

# ─── History Settings ───
HISTFILE=~/.zsh_history
HISTSIZE=100000
SAVEHIST=100000
setopt HIST_IGNORE_DUPS      # Ignore duplicate commands
setopt HIST_IGNORE_ALL_DUPS  # Remove old duplicates
setopt HIST_REDUCE_BLANKS    # Remove extra whitespace
setopt SHARE_HISTORY         # Share across sessions
setopt INC_APPEND_HISTORY    # Append immediately
setopt HIST_EXPIRE_DUPS_FIRST # Expire old duplicates first
setopt HIST_FIND_NO_DUPS     # Exclude duplicates during search
setopt HIST_SAVE_NO_DUPS     # Exclude duplicates when saving
setopt EXTENDED_HISTORY       # Record timestamps

# ─── Directory Navigation ───
setopt AUTO_CD               # cd by typing directory name alone
setopt AUTO_PUSHD            # Push to stack on cd
setopt PUSHD_IGNORE_DUPS     # No duplicates in stack
setopt PUSHD_MINUS           # Reverse meaning of +/-
DIRSTACKSIZE=20              # Stack size

# ─── Completion Settings ───
autoload -Uz compinit && compinit
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Z}'  # Case-insensitive
zstyle ':completion:*' menu select                     # Menu selection
zstyle ':completion:*' list-colors ''                  # Colored output
zstyle ':completion:*' use-cache yes                   # Completion cache
zstyle ':completion:*' cache-path "$XDG_CACHE_HOME/zsh/.zcompcache"
zstyle ':completion:*:descriptions' format '%B%d%b'    # Description format
zstyle ':completion:*:warnings' format 'No matches for: %d'
zstyle ':completion:*' group-name ''                   # Show group names
zstyle ':completion:*:*:kill:*' menu yes select        # kill completion
zstyle ':completion:*:*:kill:*:processes' list-colors '=(#b) #([0-9]#)*=0=01;31'

# ─── Key Bindings (Emacs mode) ───
bindkey -e
bindkey '^[[A' history-search-backward    # ↑ for prefix search backward
bindkey '^[[B' history-search-forward     # ↓ for prefix search forward
bindkey '^[b' backward-word               # Alt+b move word back
bindkey '^[f' forward-word                # Alt+f move word forward
bindkey '^U' backward-kill-line           # Ctrl+U delete to line start
bindkey '^K' kill-line                    # Ctrl+K delete to line end

# ─── Aliases ───
alias ll='ls -la'
alias la='ls -A'
alias l='ls -CF'
alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'
alias g='git'
alias gs='git status'
alias gd='git diff'
alias gc='git commit'
alias gp='git push'
alias gl='git log --oneline -20'
alias k='kubectl'
alias d='docker'
alias dc='docker compose'
alias tf='terraform'
alias py='python3'
alias pip='pip3'

# ─── Utility Functions ───
# mkcd: create directory & move into it
mkcd() { mkdir -p "$1" && cd "$1" }

# extract: unified extraction command
extract() {
  if [ -f "$1" ]; then
    case "$1" in
      *.tar.bz2) tar xjf "$1" ;;
      *.tar.gz)  tar xzf "$1" ;;
      *.tar.xz)  tar xJf "$1" ;;
      *.bz2)     bunzip2 "$1" ;;
      *.gz)      gunzip "$1" ;;
      *.tar)     tar xf "$1" ;;
      *.tbz2)    tar xjf "$1" ;;
      *.tgz)     tar xzf "$1" ;;
      *.zip)     unzip "$1" ;;
      *.Z)       uncompress "$1" ;;
      *.7z)      7z x "$1" ;;
      *.rar)     unrar x "$1" ;;
      *)         echo "Cannot extract '$1'" ;;
    esac
  else
    echo "'$1' is not a valid file"
  fi
}

# port: show the process using the specified port
port() { lsof -i :"$1" }

# weather: display weather forecast
weather() { curl "wttr.in/${1:-Tokyo}?lang=ja" }
EOF
```

#### zsh Plugin Management (zinit)

```bash
# ─── zinit (fast plugin manager) ───
# Install
bash -c "$(curl --fail --show-error --silent --location https://raw.githubusercontent.com/zdharma-continuum/zinit/HEAD/scripts/install.sh)"

# Add plugins to ~/.zshrc
cat << 'EOF' >> ~/.zshrc

# ─── zinit Plugins ───
# Lazy-load for faster startup
zinit light zsh-users/zsh-autosuggestions          # Auto command suggestions
zinit light zsh-users/zsh-syntax-highlighting       # Syntax highlighting
zinit light zsh-users/zsh-completions               # Additional completions

# Enhanced history search
zinit light zsh-users/zsh-history-substring-search

# ─── Use Oh My Zsh snippets (only what you need) ───
zinit snippet OMZP::git                # git aliases
zinit snippet OMZP::docker             # docker completions
zinit snippet OMZP::docker-compose     # docker compose completions
zinit snippet OMZP::kubectl            # kubectl completions
zinit snippet OMZP::aws                # AWS CLI completions
zinit snippet OMZP::terraform          # Terraform completions
zinit snippet OMZP::npm                # npm completions

# ─── Autosuggestion Settings ───
ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=243'  # Suggestion color
ZSH_AUTOSUGGEST_STRATEGY=(history completion)  # Suggestion priority
ZSH_AUTOSUGGEST_BUFFER_MAX_SIZE=20  # Max characters
bindkey '^ ' autosuggest-accept  # Ctrl+Space to accept suggestion
EOF
```

#### Measuring and Optimizing zsh Startup Speed

```bash
# Measure startup time
time zsh -i -c exit

# Detailed profiling
# Add to the top of .zshrc:
# zmodload zsh/zprof
# Add to the bottom of .zshrc:
# zprof

# Target: under 200ms
# Common causes of delay:
# - nvm initialization (~300ms) → solved by switching to fnm
# - Duplicate compinit calls   → solved with cache
# - Loading all of Oh My Zsh   → use zinit to load only what you need

# compinit cache optimization
autoload -Uz compinit
if [[ -n ${ZDOTDIR:-$HOME}/.zcompdump(#qN.mh+24) ]]; then
  compinit
else
  compinit -C  # Use cache (if within 24 hours)
fi
```

### 2.3 fish Configuration

```fish
# Install
# macOS
brew install fish

# Ubuntu
sudo apt-add-repository ppa:fish-shell/release-3
sudo apt update
sudo apt install fish

# Set fish as the default shell
echo $(which fish) | sudo tee -a /etc/shells
chsh -s $(which fish)

# ~/.config/fish/config.fish
set -gx LANG ja_JP.UTF-8
set -gx EDITOR "code --wait"
set -gx VISUAL "code --wait"

# XDG Base Directory
set -gx XDG_CONFIG_HOME $HOME/.config
set -gx XDG_DATA_HOME $HOME/.local/share
set -gx XDG_CACHE_HOME $HOME/.cache

# Path settings
fish_add_path ~/.local/bin
fish_add_path ~/.cargo/bin

# Aliases (fish recommends abbr)
abbr -a g git
abbr -a gs "git status"
abbr -a gd "git diff"
abbr -a gc "git commit"
abbr -a gp "git push"
abbr -a gl "git log --oneline -20"
abbr -a ll "ls -la"
abbr -a .. "cd .."
abbr -a ... "cd ../.."
abbr -a d docker
abbr -a dc "docker compose"
abbr -a k kubectl
abbr -a py python3

# ─── fish's Unique Features ───
# Difference between abbr and alias:
# - abbr: expanded at input time (original command stays in history)
# - alias: converted at execution time (alias name stays in history)
# → abbr recommended: has a learning effect, works in other environments too

# Install Fisher (plugin manager)
curl -sL https://raw.githubusercontent.com/jorgebucaran/fisher/main/functions/fisher.fish | source && fisher install jorgebucaran/fisher

# Recommended plugins
fisher install jethrokuan/z               # Directory jumping
fisher install PatrickF1/fzf.fish         # fzf integration
fisher install jorgebucaran/autopair.fish  # Auto bracket completion
fisher install meaningful-ooo/sponge      # Exclude failed commands from history
fisher install jorgebucaran/nvm.fish      # Node.js version management
fisher install laughedelic/pisces          # Pair character completion

# ─── Custom Functions ───
# ~/.config/fish/functions/mkcd.fish
function mkcd
    mkdir -p $argv[1]; and cd $argv[1]
end

# ~/.config/fish/functions/port.fish
function port
    lsof -i :$argv[1]
end
```

### 2.4 PowerShell 7 Configuration (Windows / Cross-Platform)

```powershell
# Install
# Windows
winget install Microsoft.PowerShell
# macOS
brew install powershell/tap/powershell
# Linux
sudo apt install powershell

# Check profile location
echo $PROFILE
# Typically: ~/Documents/PowerShell/Microsoft.PowerShell_profile.ps1

# ─── $PROFILE configuration ───
# Install modules
Install-Module posh-git -Scope CurrentUser
Install-Module PSReadLine -Scope CurrentUser -Force
Install-Module Terminal-Icons -Scope CurrentUser
Install-Module PSFzf -Scope CurrentUser
Install-Module z -Scope CurrentUser

# Add to $PROFILE
@'
# ─── Load Modules ───
Import-Module posh-git
Import-Module Terminal-Icons
Import-Module PSFzf
Import-Module z

# ─── PSReadLine Settings ───
Set-PSReadLineOption -PredictionSource HistoryAndPlugin
Set-PSReadLineOption -PredictionViewStyle ListView
Set-PSReadLineOption -EditMode Emacs
Set-PSReadLineOption -HistorySearchCursorMovesToEnd
Set-PSReadLineKeyHandler -Key UpArrow -Function HistorySearchBackward
Set-PSReadLineKeyHandler -Key DownArrow -Function HistorySearchForward
Set-PSReadLineKeyHandler -Key Tab -Function MenuComplete
Set-PSReadLineKeyHandler -Key Ctrl+d -Function DeleteChar

# ─── Aliases ───
Set-Alias -Name g -Value git
Set-Alias -Name k -Value kubectl
Set-Alias -Name ll -Value Get-ChildItem
Set-Alias -Name which -Value Get-Command

# ─── Starship Prompt ───
Invoke-Expression (&starship init powershell)

# ─── fzf Settings ───
Set-PsFzfOption -PSReadlineChordProvider 'Ctrl+t' -PSReadlineChordReverseHistory 'Ctrl+r'
'@ | Out-File -FilePath $PROFILE -Encoding utf8
```

---

## 3. Starship Prompt

### 3.1 Installation and Basic Configuration

```bash
# Install
curl -sS https://starship.rs/install.sh | sh

# Or via package manager
brew install starship          # macOS
sudo snap install starship     # Ubuntu
winget install Starship.Starship  # Windows

# Add to shell
# zsh: add to the end of ~/.zshrc
eval "$(starship init zsh)"

# fish: add to ~/.config/fish/config.fish
starship init fish | source

# PowerShell: add to $PROFILE
Invoke-Expression (&starship init powershell)

# bash: add to the end of ~/.bashrc
eval "$(starship init bash)"
```

### 3.2 Configuration File

```toml
# ~/.config/starship.toml

# Overall prompt format
format = """
$username\
$hostname\
$directory\
$git_branch\
$git_status\
$git_state\
$nodejs\
$python\
$rust\
$golang\
$java\
$docker_context\
$kubernetes\
$terraform\
$aws\
$cmd_duration\
$line_break\
$jobs\
$character"""

# Right prompt
right_format = """$time"""

# Insert a blank line
add_newline = true

# Command timeout
command_timeout = 1000

# Username (shown only during SSH)
[username]
show_always = false
style_user = "bold blue"
style_root = "bold red"
format = "$user@"

# Hostname (shown only during SSH)
[hostname]
ssh_only = true
format = "$ssh_symbol$hostname "
style = "bold green"

# Directory display
[directory]
truncation_length = 3
truncation_symbol = ".../"
style = "bold cyan"
read_only = " 🔒"
home_symbol = "~"
truncate_to_repo = true

# Directory substitutions (shorten long paths)
[directory.substitutions]
"Documents" = "DOC"
"Downloads" = "DL"
"src/components" = "comp"

# Git branch
[git_branch]
format = "$symbol$branch(:$remote_branch) "
symbol = " "
style = "bold purple"
truncation_length = 30
truncation_symbol = "..."

# Git status
[git_status]
format = '($all_status$ahead_behind )'
style = "bold red"
conflicted = "="
ahead = "⇡${count}"
behind = "⇣${count}"
diverged = "⇕⇡${ahead_count}⇣${behind_count}"
untracked = "?${count}"
stashed = "*${count}"
modified = "!${count}"
staged = "+${count}"
renamed = "»${count}"
deleted = "✘${count}"

# Git operation state
[git_state]
format = '\($state( $progress_current of $progress_total)\) '
rebase = "REBASING"
merge = "MERGING"
revert = "REVERTING"
cherry_pick = "CHERRY-PICKING"
bisect = "BISECTING"

# Node.js
[nodejs]
format = "$symbol($version) "
symbol = " "
style = "bold green"
detect_files = ["package.json", ".node-version", ".nvmrc"]
detect_folders = ["node_modules"]

# Python
[python]
format = "$symbol$pyenv_prefix($version)( \\($virtualenv\\)) "
symbol = " "
style = "bold yellow"
detect_extensions = ["py"]
detect_files = ["requirements.txt", "pyproject.toml", "setup.py", "Pipfile"]

# Rust
[rust]
format = "$symbol($version) "
symbol = " "
style = "bold red"

# Go
[golang]
format = "$symbol($version) "
symbol = " "
style = "bold cyan"

# Java
[java]
format = "$symbol($version) "
symbol = " "
style = "bold orange"

# Docker
[docker_context]
format = "$symbol$context "
symbol = " "
style = "bold blue"
only_with_files = true

# Kubernetes
[kubernetes]
format = "$symbol$context( \\($namespace\\)) "
symbol = "⎈ "
style = "bold blue"
disabled = false
detect_files = ["k8s", "kubernetes"]

[kubernetes.context_aliases]
"arn:aws:eks:*:*:cluster/production" = "PROD"
"arn:aws:eks:*:*:cluster/staging" = "STG"

# Terraform
[terraform]
format = "$symbol$workspace "
symbol = "💠 "
style = "bold purple"

# AWS
[aws]
format = "$symbol($profile)(\\($region\\)) "
symbol = "☁️ "
style = "bold yellow"

[aws.region_aliases]
ap-northeast-1 = "tokyo"
us-east-1 = "virginia"
eu-west-1 = "ireland"

# Command execution time
[cmd_duration]
min_time = 2_000  # Show if over 2 seconds
format = "$duration "
style = "bold yellow"
show_milliseconds = false
show_notifications = true
min_time_to_notify = 30_000  # Notify if over 30 seconds

# Prompt character
[character]
success_symbol = "❯"
error_symbol = "❯"
vimcmd_symbol = "❮"

# Background jobs
[jobs]
symbol = "✦ "
threshold = 1
format = "$symbol$number "

# Time display
[time]
disabled = false
format = "$time"
style = "dimmed white"
time_format = "%H:%M"
```

### 3.3 Prompt Display Example

```
Prompt display example:

  ~/.../my-project  main !2 +1  v20.11.0  3s         14:30
  ❯ _

  ├── Directory (truncated)
  │   ├── Git branch name
  │   │   ├── Git status (2 changes, 1 staged)
  │   │   │   ├── Node.js version
  │   │   │   │   ├── Command execution time
  │   │   │   │   │              └── Time (right-aligned)
  │   │   │   │   │
  └───┴───┴───┴───┴── Compact display that fits on one line

  When connected via SSH:
  gaku@production ~/.../deploy  main  🐳docker  ⎈PROD(default)
  ❯ _

  Python project:
  ~/.../ml-project  feature/model !1  3.12.3 (venv)  15s
  ❯ _
```

### 3.4 Using Presets

```bash
# Starship comes with various presets
# List available presets
starship preset --list

# Apply a preset
starship preset nerd-font-symbols -o ~/.config/starship.toml
starship preset tokyo-night -o ~/.config/starship.toml
starship preset pastel-powerline -o ~/.config/starship.toml

# You can also customize on top of a preset
```

---

## 4. tmux

### 4.1 Installation and Basic Configuration

```bash
# Install
brew install tmux        # macOS
sudo apt install tmux    # Ubuntu

# Check version (3.2+ recommended)
tmux -V

# ~/.tmux.conf
cat << 'EOF' > ~/.tmux.conf
# ─── Change Prefix Key ───
unbind C-b
set -g prefix C-a
bind C-a send-prefix

# ─── Basic Settings ───
set -g default-terminal "tmux-256color"
set -ag terminal-overrides ",xterm-256color:RGB"
set -g mouse on
set -g history-limit 50000
set -g base-index 1
setw -g pane-base-index 1
set -g renumber-windows on
set -sg escape-time 0
set -g focus-events on
set -g set-clipboard on
set -g display-time 4000
set -g display-panes-time 1500

# ─── Copy Mode (vi key bindings) ───
setw -g mode-keys vi
bind -T copy-mode-vi v send -X begin-selection
bind -T copy-mode-vi y send -X copy-pipe-and-cancel "pbcopy"  # macOS
# bind -T copy-mode-vi y send -X copy-pipe-and-cancel "xclip -selection clipboard"  # Linux
bind -T copy-mode-vi MouseDragEnd1Pane send-keys -X copy-pipe-and-cancel "pbcopy"
bind -T copy-mode-vi Escape send -X cancel

# ─── Pane Splitting ───
bind | split-window -h -c "#{pane_current_path}"
bind - split-window -v -c "#{pane_current_path}"
bind _ split-window -v -c "#{pane_current_path}" -p 30  # Bottom 30%
unbind '"'
unbind %

# ─── Pane Movement (vim-style) ───
bind h select-pane -L
bind j select-pane -D
bind k select-pane -U
bind l select-pane -R

# ─── Alt+Arrow for pane movement (no prefix needed) ───
bind -n M-Left select-pane -L
bind -n M-Right select-pane -R
bind -n M-Up select-pane -U
bind -n M-Down select-pane -D

# ─── Resize ───
bind -r H resize-pane -L 5
bind -r J resize-pane -D 5
bind -r K resize-pane -U 5
bind -r L resize-pane -R 5

# ─── Window Operations ───
bind c new-window -c "#{pane_current_path}"
bind -n S-Left previous-window   # Shift+← for previous window
bind -n S-Right next-window      # Shift+→ for next window
bind -r < swap-window -t -1 \; previous-window  # Swap windows
bind -r > swap-window -t +1 \; next-window

# ─── Session Operations ───
bind S choose-session             # Session list
bind R command-prompt -I "#{session_name}" "rename-session '%%'"

# ─── Reload Config ───
bind r source-file ~/.tmux.conf \; display "Config reloaded!"

# ─── Status Bar ───
set -g status-position top
set -g status-interval 5
set -g status-style "bg=#1e1e2e,fg=#cdd6f4"
set -g status-left-length 40
set -g status-right-length 80
set -g status-left "#[fg=#1e1e2e,bg=#89b4fa,bold] #S #[fg=#89b4fa,bg=#1e1e2e]"
set -g status-right "#[fg=#a6adc8] #(whoami)@#H  %Y-%m-%d %H:%M "

# ─── Window Display ───
setw -g window-status-format "#[fg=#6c7086] #I:#W "
setw -g window-status-current-format "#[fg=#1e1e2e,bg=#a6e3a1,bold] #I:#W "
setw -g window-status-separator ""

# ─── Pane Borders ───
set -g pane-border-style "fg=#313244"
set -g pane-active-border-style "fg=#89b4fa"

# ─── Messages ───
set -g message-style "fg=#cdd6f4,bg=#313244,bold"
EOF
```

### 4.2 tmux Layouts

```
Typical tmux development layout:

┌─────────────────────────────────────────┐
│ Session: my-project                [top] │
├──────────────────┬──────────────────────┤
│                  │                      │
│   Editor         │   Run Tests          │
│   (vim/code)     │   (npm test --watch) │
│                  │                      │
│                  │                      │
│                  ├──────────────────────┤
│                  │                      │
│                  │   Server Logs        │
│                  │   (npm run dev)      │
│                  │                      │
├──────────────────┴──────────────────────┤
│ Window: 1:code  2:server  3:db   [tabs] │
└─────────────────────────────────────────┘

Operations:
  Ctrl+a |    → Vertical split
  Ctrl+a -    → Horizontal split
  Ctrl+a h/j/k/l → Move between panes
  Ctrl+a c    → New window
  Ctrl+a 1-9  → Switch window
  Ctrl+a d    → Detach
  tmux attach → Reattach
  Ctrl+a [    → Copy mode (vi movement)
  Ctrl+a z    → Maximize/restore pane
  Ctrl+a !    → Break pane into window
  Ctrl+a S    → Session list
```

### 4.3 tmux Script (Auto-Create Project Session)

```bash
#!/bin/bash
# ~/.local/bin/tmux-project.sh
# Automatically set up a tmux session for a project

PROJECT_DIR="${1:-.}"
SESSION_NAME=$(basename "$PROJECT_DIR")

# Attach if session already exists
tmux has-session -t "$SESSION_NAME" 2>/dev/null && {
  tmux attach -t "$SESSION_NAME"
  exit 0
}

# Create new session
tmux new-session -d -s "$SESSION_NAME" -c "$PROJECT_DIR"

# Window 1: Editor
tmux rename-window -t "$SESSION_NAME:1" "editor"
tmux send-keys -t "$SESSION_NAME:1" "code ." C-m

# Window 2: Dev server + tests
tmux new-window -t "$SESSION_NAME" -n "dev" -c "$PROJECT_DIR"
tmux split-window -h -t "$SESSION_NAME:2" -c "$PROJECT_DIR"
tmux send-keys -t "$SESSION_NAME:2.1" "npm run dev" C-m
tmux send-keys -t "$SESSION_NAME:2.2" "npm test -- --watch" C-m

# Window 3: Git / work
tmux new-window -t "$SESSION_NAME" -n "git" -c "$PROJECT_DIR"
tmux send-keys -t "$SESSION_NAME:3" "git status" C-m

# Window 4: DB / logs
tmux new-window -t "$SESSION_NAME" -n "misc" -c "$PROJECT_DIR"
tmux split-window -v -t "$SESSION_NAME:4" -c "$PROJECT_DIR"

# Return to window 1
tmux select-window -t "$SESSION_NAME:1"

# Attach
tmux attach -t "$SESSION_NAME"
```

```bash
# Register as an alias
alias tp='~/.local/bin/tmux-project.sh'

# Usage examples
tp ~/projects/my-app    # Auto-build my-app session
tp                      # Create session in current directory
```

### 4.4 TPM (tmux Plugin Manager)

```bash
# Install TPM
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm

# Add to ~/.tmux.conf
cat << 'EOF' >> ~/.tmux.conf

# ─── Plugins ───
set -g @plugin 'tmux-plugins/tpm'
set -g @plugin 'tmux-plugins/tmux-sensible'
set -g @plugin 'tmux-plugins/tmux-resurrect'   # Session restore
set -g @plugin 'tmux-plugins/tmux-continuum'    # Auto-save
set -g @plugin 'tmux-plugins/tmux-yank'         # Clipboard integration
set -g @plugin 'tmux-plugins/tmux-pain-control' # Enhanced pane control
set -g @plugin 'tmux-plugins/tmux-sessionist'   # Enhanced session control
set -g @plugin 'catppuccin/tmux'                # Theme
set -g @plugin 'tmux-plugins/tmux-cpu'          # CPU usage display
set -g @plugin 'tmux-plugins/tmux-battery'      # Battery display

# ─── Resurrect Settings ───
set -g @resurrect-capture-pane-contents 'on'
set -g @resurrect-strategy-vim 'session'
set -g @resurrect-strategy-nvim 'session'
set -g @resurrect-processes '~vim ~nvim ~less ~more ~man ~top ~htop'

# ─── Continuum Settings ───
set -g @continuum-restore 'on'
set -g @continuum-save-interval '15'  # Auto-save every 15 minutes

# ─── Catppuccin Theme Settings ───
set -g @catppuccin_flavor 'mocha'
set -g @catppuccin_window_status_style "rounded"
set -g @catppuccin_status_left_separator "█"
set -g @catppuccin_status_right_separator "█"

# TPM initialization (this line must always be last)
run '~/.tmux/plugins/tpm/tpm'
EOF

# Install plugins: press Ctrl+a I inside tmux
# Update plugins: press Ctrl+a U inside tmux
# Remove plugins: remove from list, then press Ctrl+a alt+u
```

### 4.5 Useful tmux Commands

```bash
# ─── Session Management ───
tmux new -s work                     # Create "work" session
tmux new -s work -d                  # Create in detached state
tmux ls                              # List sessions
tmux attach -t work                  # Attach to session
tmux kill-session -t work            # Delete session
tmux kill-server                     # Delete all sessions
tmux switch -t work                  # Switch session

# ─── Window/Pane Information ───
tmux list-windows                    # List windows
tmux list-panes                      # List panes
tmux display-panes                   # Show pane numbers

# ─── Send Commands (from scripts) ───
tmux send-keys -t work:1 "npm start" C-m
tmux send-keys -t work:2.1 "npm test" C-m

# ─── Change Layout ───
# Cycle through layouts with Ctrl+a Space
# even-horizontal : equal-width side by side
# even-vertical   : equal-height stacked
# main-horizontal : main pane on top, split below
# main-vertical   : main pane on left, split right
# tiled           : tiled arrangement
```

---

## 5. Useful Tools

### 5.1 Modern CLI Tools

```bash
# Bulk install (macOS)
brew install \
  bat        `# cat replacement (syntax highlighting)` \
  eza        `# ls replacement (icons, Git support)` \
  fd         `# find replacement (fast)` \
  ripgrep    `# grep replacement (ultra-fast)` \
  fzf        `# fuzzy finder` \
  zoxide     `# cd replacement (learning-based)` \
  delta      `# diff replacement (beautiful display)` \
  tldr       `# man replacement (example-based)` \
  jq         `# JSON parser` \
  httpie     `# curl replacement (human-friendly)` \
  dust       `# du replacement (visual)` \
  duf        `# df replacement (visual)` \
  bottom     `# top replacement (rich UI)` \
  procs      `# ps replacement (modern display)` \
  sd         `# sed replacement (intuitive)` \
  tokei      `# code line counter` \
  hyperfine  `# benchmarking tool` \
  gping      `# graphical ping` \
  dog        `# dig replacement (DNS)` \
  xh         `# HTTPie in Rust (ultra-fast)`

# For Ubuntu
sudo apt install bat fd-find ripgrep fzf jq httpie
# Note: on Ubuntu, bat → batcat, fd → fdfind
# Aliases are needed:
alias bat='batcat'
alias fd='fdfind'

# Alias settings (~/.zshrc)
alias cat='bat --paging=never'
alias ls='eza --icons'
alias ll='eza --icons -la --git'
alias lt='eza --icons --tree --level=3'
alias tree='eza --icons --tree'
alias find='fd'
alias grep='rg'
alias du='dust'
alias df='duf'
alias top='btm'
alias ps='procs'
alias sed='sd'
alias dig='dog'
alias ping='gping'
```

### 5.2 Detailed Settings for Each Tool

```bash
# ─── bat configuration ───
# List themes
bat --list-themes

# ~/.config/bat/config
cat << 'EOF' > ~/.config/bat/config
--theme="Catppuccin Mocha"
--style="numbers,changes,header,grid"
--italic-text=always
--map-syntax "*.conf:INI"
--map-syntax ".ignore:Git Ignore"
--map-syntax "*.npmrc:INI"
--pager="less -RF"
EOF

# ─── Advanced eza usage ───
# List with Git status
eza -la --git --icons --group-directories-first
# Tree view (3 levels, excluding .gitignore)
eza --tree --level=3 --icons --git-ignore
# Sorted by file size
eza -la --sort=size --reverse --icons
# Recently modified files
eza -la --sort=modified --icons | head -20

# ─── ripgrep configuration ───
# ~/.config/ripgrep/config (specify with RIPGREP_CONFIG_PATH)
export RIPGREP_CONFIG_PATH="$HOME/.config/ripgrep/config"
cat << 'EOF' > ~/.config/ripgrep/config
--smart-case
--hidden
--glob=!.git
--glob=!node_modules
--glob=!.next
--glob=!dist
--glob=!*.min.js
--glob=!*.map
--colors=line:fg:yellow
--colors=path:fg:green
--colors=match:bg:yellow
--colors=match:fg:black
--max-columns=200
--max-columns-preview
EOF

# ─── zoxide configuration ───
# Add to ~/.zshrc
eval "$(zoxide init zsh)"
# Usage:
# z foo      → Jump to a recent directory containing "foo"
# z foo bar  → Directory containing both "foo" and "bar"
# zi foo     → Interactive selection with fzf
# zoxide query --list  → Show database contents

# ─── delta configuration ───
# [delta] section in ~/.gitconfig
# (detailed in 02-git-config.md)
```

### 5.3 fzf Integration

```bash
# Install fzf & shell integration
brew install fzf
$(brew --prefix)/opt/fzf/install

# Ctrl+R: history search
# Ctrl+T: file search
# Alt+C:  change directory

# Custom settings (~/.zshrc)
export FZF_DEFAULT_OPTS='
  --height 60%
  --layout=reverse
  --border=rounded
  --preview-window=right:60%:wrap
  --preview "bat --style=numbers --color=always --line-range :500 {}"
  --bind "ctrl-d:half-page-down,ctrl-u:half-page-up"
  --bind "ctrl-y:execute-silent(echo {} | pbcopy)+abort"
  --color=bg+:#313244,bg:#1e1e2e,spinner:#f5e0dc,hl:#f38ba8
  --color=fg:#cdd6f4,header:#f38ba8,info:#cba6f7,pointer:#f5e0dc
  --color=marker:#f5e0dc,fg+:#cdd6f4,prompt:#cba6f7,hl+:#f38ba8
'
export FZF_DEFAULT_COMMAND='fd --type f --hidden --follow --exclude .git'
export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
export FZF_ALT_C_COMMAND='fd --type d --hidden --follow --exclude .git'

# ─── Custom fzf functions ───

# fkill: interactively kill a process
fkill() {
  local pid
  pid=$(ps -ef | sed 1d | fzf -m --header='Select process to kill' | awk '{print $2}')
  if [ -n "$pid" ]; then
    echo "$pid" | xargs kill -${1:-9}
  fi
}

# fbr: interactively switch branches
fbr() {
  local branches branch
  branches=$(git --no-pager branch -vv) &&
  branch=$(echo "$branches" | fzf +m --header='Select branch') &&
  git checkout $(echo "$branch" | awk '{print $1}' | sed "s/.* //")
}

# flog: interactively view commit log
flog() {
  git log --oneline --graph --color=always |
  fzf --ansi --preview 'git show --color=always {1}' \
    --bind 'enter:execute(git show --color=always {1} | less -R)'
}

# fenv: interactively search environment variables
fenv() {
  local var
  var=$(env | sort | fzf --header='Select environment variable') &&
  echo "$var"
}

# fdoc: interactively operate Docker containers
fdoc() {
  local container
  container=$(docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}" |
    sed 1d | fzf --header='Select container') &&
  docker exec -it $(echo "$container" | awk '{print $1}') /bin/sh
}
```

---

## 6. Backing Up and Rebuilding the Terminal Environment

### 6.1 dotfiles Repository

```bash
# dotfiles repository structure
dotfiles/
├── .zshrc
├── .config/
│   ├── starship.toml
│   ├── alacritty/
│   │   └── alacritty.toml
│   ├── bat/
│   │   └── config
│   ├── ripgrep/
│   │   └── config
│   └── fish/
│       └── config.fish
├── .tmux.conf
├── .gitconfig
├── .ssh/
│   └── config
├── Brewfile
└── setup.sh

# ─── setup.sh (new machine setup script) ───
#!/bin/bash
set -euo pipefail

echo "=== Starting development environment setup ==="

# Homebrew
if ! command -v brew &>/dev/null; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Install from Brewfile
brew bundle install

# Create symbolic links
DOTFILES_DIR="$(cd "$(dirname "$0")" && pwd)"
ln -sf "$DOTFILES_DIR/.zshrc" ~/.zshrc
ln -sf "$DOTFILES_DIR/.tmux.conf" ~/.tmux.conf
ln -sf "$DOTFILES_DIR/.gitconfig" ~/.gitconfig
mkdir -p ~/.config
ln -sf "$DOTFILES_DIR/.config/starship.toml" ~/.config/starship.toml
ln -sf "$DOTFILES_DIR/.config/bat" ~/.config/bat
ln -sf "$DOTFILES_DIR/.config/ripgrep" ~/.config/ripgrep

# Install zinit plugins
zsh -c 'source ~/.zshrc'

# TPM (tmux Plugin Manager)
if [ ! -d ~/.tmux/plugins/tpm ]; then
  git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
fi

# Nerd Font
brew install --cask font-jetbrains-mono-nerd-font

echo "=== Setup complete ==="
echo "Please restart your terminal"
```

### 6.2 Management with GNU Stow

```bash
# GNU Stow: automatic symbolic link management
brew install stow

# Directory structure
dotfiles/
├── zsh/
│   └── .zshrc              → ~/.zshrc
├── tmux/
│   └── .tmux.conf          → ~/.tmux.conf
├── git/
│   └── .gitconfig          → ~/.gitconfig
├── starship/
│   └── .config/
│       └── starship.toml   → ~/.config/starship.toml
└── alacritty/
    └── .config/
        └── alacritty/
            └── alacritty.toml → ~/.config/alacritty/alacritty.toml

# Link all at once with Stow
cd ~/dotfiles
stow zsh tmux git starship alacritty

# Manage individually
stow zsh          # Link only zsh config
stow -D tmux      # Unlink tmux
stow -R starship  # Re-create starship links
```

---

## 7. Anti-Patterns

### 7.1 Continuing to Use Plain bash Without Customization

```
❌ Anti-pattern: Using default bash/zsh without any configuration

Problems:
  - Poor completion leads to more typos
  - Inefficient history search
  - Directory navigation takes time
  - Git branch status is invisible
  - Cannot automate repetitive tasks

✅ Correct approach:
  - Use Starship to make the prompt information-rich
  - Speed up navigation with fzf + zoxide
  - Shorten commands with abbr/alias
  - Add a syntax highlighting plugin
  - Reduce typos with auto-completion plugins
```

### 7.2 Not Using tmux Session Management

```
❌ Anti-pattern: Opening many new terminal tabs per project

Problems:
  - Too many tabs become unmanageable
  - All processes terminate on SSH disconnect
  - Rebuilding the environment takes time every time
  - Increased context-switching cost

✅ Correct approach:
  - Create tmux sessions per project
  - Persist the environment with tmux-resurrect
  - Organize with named sessions: tmux new -s project-name
  - Auto-build the environment with tmux-project.sh script
```

### 7.3 Not Managing dotfiles

```
❌ Anti-pattern: Manually managing config files without version control

Problems:
  - Rebuilding the environment when replacing a machine takes a full day
  - Cannot share settings with team members
  - Cannot track the history of config changes
  - Settings are out of sync across multiple machines

✅ Correct approach:
  - Manage the dotfiles repository with Git
  - Automate symbolic links with GNU Stow
  - Manage tool list with Brewfile
  - Automate new machine setup with setup.sh
  - Store in a private repository (exclude SSH keys and tokens)
```

### 7.4 Overly Heavy Plugin Configuration

```
❌ Anti-pattern: Using Oh My Zsh with all plugins enabled

Problems:
  - Shell startup takes 2-5 seconds
  - Stress every time you open a terminal
  - Unused plugins consume memory
  - Updates cause unexpected breaking changes

✅ Correct approach:
  - Use zinit to lazy-load only the plugins you need
  - Use Oh My Zsh snippets to take only what you need
  - Regularly profile startup time with zprof
  - Target startup time: under 200ms
  - Actively remove unused plugins
```

---

## 8. Troubleshooting

### 8.1 Common Issues and Solutions

```bash
# ─── Garbled characters (tofu □) ───
# Cause: Nerd Font is not installed
# Solution:
brew install --cask font-jetbrains-mono-nerd-font
# Select "JetBrains Mono Nerd Font" in terminal font settings

# ─── zsh startup is slow ───
# Identify the cause:
zmodload zsh/zprof  # Add to the top of .zshrc
zprof               # Add to the bottom of .zshrc
# → Identify slow plugins and switch to lazy loading

# ─── tmux colors look wrong ───
# Cause: TERM setting mismatch
# Solution:
# .tmux.conf:
set -g default-terminal "tmux-256color"
set -ag terminal-overrides ",xterm-256color:RGB"
# .zshrc:
export TERM="xterm-256color"

# ─── pbcopy doesn't work inside tmux ───
# For macOS:
brew install reattach-to-user-namespace
# Add to .tmux.conf:
# set -g default-command "reattach-to-user-namespace -l $SHELL"
# Note: Often not needed in tmux 2.6+

# ─── Starship not displayed on SSH destination ───
# Starship must also be installed on the SSH target
# Or fall back to a lightweight prompt using PROMPT_COMMAND on the remote

# ─── fzf Ctrl+R doesn't work ───
# Reinstall fzf shell integration
$(brew --prefix)/opt/fzf/install --all
# Check the load order in .zshrc (fzf should come after zinit)

# ─── eza doesn't show Git status ───
# Running in a location without a .git directory
# Or git is not installed
git --version  # Check
```

### 8.2 Performance Tuning

```bash
# ─── Benchmark shell startup time ───
# Measure 10-run average
for i in $(seq 1 10); do time zsh -i -c exit; done

# Precise measurement with hyperfine
hyperfine 'zsh -i -c exit' --warmup 3

# ─── Monitor tmux memory usage ───
tmux list-sessions -F '#{session_name}: #{session_windows} windows, #{session_attached} attached'
# Regularly delete unnecessary sessions

# ─── Check disk usage ───
# Size of zinit plugins
du -sh ~/.local/share/zinit/plugins/* | sort -rh | head -10
# Size of tmux plugins
du -sh ~/.tmux/plugins/* | sort -rh
```

---

## 9. FAQ

### Q1: Which should I choose, zsh or fish?

**A:** Choose zsh if you need POSIX compatibility — the ability to use existing shell scripts as-is is a major advantage. On the other hand, if you want a comfortable experience from the start without any configuration, fish is recommended. fish's auto-completion and syntax highlighting work without any setup. However, compatibility with bash scripts is low. If you share shell scripts in team development, zsh is safer. If personal productivity is your top priority, fish is extremely comfortable. Note that fish is not POSIX-compatible, so there are syntax differences such as using `; and` instead of `&&` (fish 3.0+ does support `&&`).

### Q2: Is a Nerd Font really necessary?

**A:** Yes, it is essential if you want icon display in Starship and modern CLI tools like eza. Install it with the following command.

```bash
brew install --cask font-jetbrains-mono-nerd-font
```

Without a Nerd Font, tofu characters (□) will be displayed. Select "JetBrains Mono Nerd Font" in your terminal's font settings. "FiraCode Nerd Font" and "Hack Nerd Font" are also popular alternatives. Nerd Font configuration is also required in VS Code's terminal: add `"terminal.integrated.fontFamily": "JetBrains Mono Nerd Font"` to settings.json.

### Q3: On macOS, which is better, iTerm2 or Warp?

**A:** Choose iTerm2 for stability and a proven track record. Choose Warp if you want AI-assisted completion and a modern UI. Warp's AI command suggestions are powerful, but as it is built with Rust, its extensibility is inferior to iTerm2. iTerm2 is safer as a team standard. However, Warp's Blocks feature (managing commands and their output as individual blocks) is very useful, letting you quickly find specific command results within long output. Recently, the combination of Alacritty + tmux has also grown in popularity. GPU acceleration provides fast rendering, and you can unify your key bindings with tmux.

### Q4: Which should I use for pane splitting — tmux or iTerm2?

**A:** If you frequently use remote servers over SSH, tmux is the only choice. tmux runs on the server side, so sessions are maintained even after SSH disconnects. If you only do local development, iTerm2's pane splitting is sufficient. However, once you get used to tmux, you can use the same workflow regardless of the environment, so learning tmux is recommended for the long term. If you combine iTerm2 with tmux, it is also worth considering iTerm2's tmux integration mode (`tmux -CC`).

### Q5: What is an appropriate shell startup time?

**A:** A good target is under 200ms. Once it exceeds 500ms, you start to feel the stress. Measure with `time zsh -i -c exit`, and if it exceeds 200ms, try the following in order: 1) Replace nvm with fnm (most effective), 2) Enable compinit caching, 3) Migrate from Oh My Zsh to zinit, 4) Remove unused plugins. You can get more precise measurements with `hyperfine 'zsh -i -c exit'`.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just from theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners often make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 10. Summary

| Item | macOS Recommended | Windows Recommended | Linux Recommended |
|------|-------------------|---------------------|-------------------|
| Terminal | iTerm2 / Warp | Windows Terminal | Alacritty / Kitty |
| Shell | zsh | PowerShell 7 | zsh / fish |
| Prompt | Starship | Starship | Starship |
| Multiplexer | tmux | tmux (WSL) | tmux |
| Font | JetBrains Mono NF | JetBrains Mono NF | JetBrains Mono NF |
| Fuzzy Finder | fzf | fzf | fzf |
| Directory Jump | zoxide | zoxide | zoxide |
| Plugin Manager (zsh) | zinit | - | zinit |
| dotfiles Management | GNU Stow + Git | GNU Stow + Git | GNU Stow + Git |
| cat replacement | bat | bat | bat |
| ls replacement | eza | eza | eza |
| grep replacement | ripgrep | ripgrep | ripgrep |
| find replacement | fd | fd | fd |

---

## What to Read Next

- [00-vscode-setup.md](./00-vscode-setup.md) -- Integration with VS Code
- [02-git-config.md](./02-git-config.md) -- Detailed Git configuration (diff/merge tool integration)
- [../01-runtime-and-package/00-version-managers.md](../01-runtime-and-package/00-version-managers.md) -- Runtime version management

---

## References

1. **iTerm2 Documentation** -- https://iterm2.com/documentation.html -- Full feature documentation for iTerm2, including Shell Integration setup.
2. **Starship: Cross-Shell Prompt** -- https://starship.rs/config/ -- Starship configuration reference covering all modules in detail.
3. **tmux 2: Productive Mouse-Free Development** (Brian P. Hogan) -- https://pragprog.com/titles/bhtmux2/ -- The definitive book on tmux.
4. **Modern Unix** -- https://github.com/ibraheemdev/modern-unix -- A curated list of modern CLI tools.
5. **zinit Documentation** -- https://zdharma-continuum.github.io/zinit/wiki/ -- Official zinit documentation. Detailed lazy-loading configuration.
6. **Alacritty Configuration** -- https://alacritty.org/config-alacritty.html -- Alacritty configuration reference in TOML format.
7. **fish shell Documentation** -- https://fishshell.com/docs/current/ -- Official fish shell documentation explaining its unique syntax.
8. **GNU Stow** -- https://www.gnu.org/software/stow/ -- Official documentation for the symbolic link management tool.
9. **fzf Examples** -- https://github.com/junegunn/fzf/wiki/Examples -- A large collection of custom fzf functions and integration examples.
10. **Catppuccin** -- https://catppuccin.com/ -- A popular color scheme with themes for all tools.

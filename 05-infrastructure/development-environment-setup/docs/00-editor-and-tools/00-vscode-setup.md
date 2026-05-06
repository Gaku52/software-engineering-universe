# VS Code Setup

> A complete guide to maximizing development productivity — from installing Visual Studio Code to practical customization.

## What You Will Learn

1. How to correctly configure VS Code installation, initial settings, and settings sync
2. Techniques for selecting and managing extensions that dramatically improve development efficiency
3. Practical techniques for mastering multi-cursor, snippets, and key bindings
4. How to build a unified team environment using workspace settings
5. Practical configuration methods for debugging, tasks, and remote development
6. A systematic approach to performance optimization and troubleshooting


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Installation and Initial Setup

### 1.1 Platform-specific Installation

```bash
# macOS (Homebrew)
brew install --cask visual-studio-code

# macOS (after manual download, check version via CLI)
# Download from https://code.visualstudio.com/download
# Drag & drop to /Applications/Visual Studio Code.app

# Ubuntu/Debian
sudo apt install wget gpg
wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
sudo install -D -o root -g root -m 644 packages.microsoft.gpg /etc/apt/keyrings/packages.microsoft.gpg
sudo sh -c 'echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list'
sudo apt update && sudo apt install code

# Fedora/RHEL
sudo rpm --import https://packages.microsoft.com/keys/microsoft.asc
sudo sh -c 'echo -e "[code]\nname=Visual Studio Code\nbaseurl=https://packages.microsoft.com/yumrepos/vscode\nenabled=1\ngpgcheck=1\ngpgkey=https://packages.microsoft.com/keys/microsoft.asc" > /etc/yum.repos.d/vscode.repo'
sudo dnf install code

# Windows (winget)
winget install Microsoft.VisualStudioCode

# Windows (Chocolatey)
choco install vscode

# Windows (Scoop)
scoop bucket add extras
scoop install vscode
```

### 1.2 Enabling the `code` CLI Tool

On macOS, you may need to manually add the path.

```
Command Palette (Cmd+Shift+P)
  → "Shell Command: Install 'code' command in PATH"
    → Done
```

Verify:

```bash
code --version
# 1.96.2
# e54c774e0add60467559eb0d1e229c6452cf8447
# arm64
```

Useful CLI usage:

```bash
# Open current directory in VS Code
code .

# Open a specific file
code src/index.ts

# Show diff
code --diff file1.ts file2.ts

# Open and jump to a specific line
code --goto src/app.ts:42:10

# Install an extension
code --install-extension dbaeumer.vscode-eslint

# List extensions
code --list-extensions

# Uninstall an extension
code --uninstall-extension <extension-id>

# Open in a new window
code --new-window .

# Add to existing window
code --add /path/to/another/folder

# Launch with a specified user data directory (portable mode)
code --user-data-dir /path/to/portable-data .

# Launch with extensions disabled (troubleshooting)
code --disable-extensions .

# Install a specific version of an extension
code --install-extension dbaeumer.vscode-eslint@2.4.0

# Specify VS Code log level
code --log trace
```

### 1.3 Architecture Overview

```
+--------------------------------------------------+
|                VS Code Architecture               |
+--------------------------------------------------+
|  UI Layer (Electron)                              |
|  +--------------------------------------------+  |
|  |  Editor        | Activity Bar | Side Bar   |  |
|  |  (Monaco)      | (Icons)     | (Explorer)  |  |
|  +--------------------------------------------+  |
|  |  Status Bar    | Panel (Terminal/Output)    |  |
|  +--------------------------------------------+  |
|                                                    |
|  Extension Host (Node.js process)                 |
|  +--------------------------------------------+  |
|  |  Language Server Protocol (LSP)             |  |
|  |  Debug Adapter Protocol (DAP)               |  |
|  |  Extension API                              |  |
|  +--------------------------------------------+  |
|                                                    |
|  Workspace Storage / Settings                     |
|  +--------------------------------------------+  |
|  |  User Settings    | Workspace Settings     |  |
|  |  (~/.config/Code) | (.vscode/settings.json)|  |
|  +--------------------------------------------+  |
+--------------------------------------------------+

Process model:
┌──────────────────────────────────────────────────┐
│  Main Process (Electron)                          │
│  ├── Renderer Process (UI / Monaco Editor)        │
│  ├── Extension Host Process (Node.js)             │
│  │   ├── Language Extension (TypeScript, Python)  │
│  │   ├── Linter Extension (ESLint)                │
│  │   └── Theme Extension                          │
│  ├── Shared Process (Extension management, Settings Sync) │
│  ├── File Watcher Process (chokidar)              │
│  ├── Search Process (ripgrep)                     │
│  └── Terminal Process (pty)                       │
└──────────────────────────────────────────────────┘
```

### 1.4 Things to Do on First Launch

```
VS Code Initial Setup Checklist:

□ 1. Enable Settings Sync (link with GitHub account)
□ 2. Select a color theme
     Command Palette → "Preferences: Color Theme"
□ 3. Install and configure fonts
     - JetBrains Mono: https://www.jetbrains.com/lp/mono/
     - Fira Code: https://github.com/tonsky/FiraCode
□ 4. Japanese UI (if needed)
     Extension: MS-CEINTL.vscode-language-pack-ja
□ 5. Set the default terminal shell
□ 6. Register the code CLI command in PATH (macOS)
□ 7. Install project-specific extensions
□ 8. Review and configure the .vscode folder
```

---

## 2. Settings File (settings.json)

### 2.1 Recommended Initial Settings (Detailed Version)

```jsonc
// .vscode/settings.json (workspace settings)
{
  // ===================================
  // Editor Basic Settings
  // ===================================
  "editor.fontSize": 14,
  "editor.fontFamily": "'JetBrains Mono', 'Fira Code', Menlo, monospace",
  "editor.fontLigatures": true,
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "editor.renderWhitespace": "boundary",
  "editor.wordWrap": "on",
  "editor.minimap.enabled": false,
  "editor.bracketPairColorization.enabled": true,
  "editor.guides.bracketPairs": "active",
  "editor.stickyScroll.enabled": true,
  "editor.linkedEditing": true,
  "editor.cursorBlinking": "smooth",
  "editor.cursorSmoothCaretAnimation": "on",
  "editor.smoothScrolling": true,
  "editor.suggest.preview": true,
  "editor.suggest.showMethods": true,
  "editor.suggest.showFunctions": true,
  "editor.inlineSuggest.enabled": true,
  "editor.parameterHints.enabled": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.rulers": [80, 120],
  "editor.renderLineHighlight": "all",
  "editor.occurrencesHighlight": "singleFile",
  "editor.unicodeHighlight.ambiguousCharacters": true,

  // ===================================
  // Auto-processing on Save
  // ===================================
  "editor.formatOnSave": true,
  "editor.formatOnPaste": false,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit",
    "source.removeUnusedImports": "explicit"
  },

  // ===================================
  // File Settings
  // ===================================
  "files.autoSave": "onFocusChange",
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,
  "files.trimFinalNewlines": true,
  "files.encoding": "utf8",
  "files.eol": "\n",
  "files.exclude": {
    "**/.git": true,
    "**/node_modules": true,
    "**/.DS_Store": true,
    "**/*.pyc": true,
    "**/__pycache__": true
  },
  "files.associations": {
    "*.env.*": "dotenv",
    "*.css": "css",
    "*.mdx": "mdx",
    "Dockerfile.*": "dockerfile"
  },
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/.git/objects/**": true,
    "**/.git/subtree-cache/**": true,
    "**/dist/**": true,
    "**/.next/**": true
  },

  // ===================================
  // Terminal Settings
  // ===================================
  "terminal.integrated.fontSize": 13,
  "terminal.integrated.fontFamily": "'JetBrains Mono', 'MesloLGS NF', monospace",
  "terminal.integrated.defaultProfile.osx": "zsh",
  "terminal.integrated.scrollback": 10000,
  "terminal.integrated.copyOnSelection": true,
  "terminal.integrated.cursorBlinking": true,
  "terminal.integrated.env.osx": {
    "EDITOR": "code --wait"
  },

  // ===================================
  // Search Settings
  // ===================================
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.next": true,
    "**/coverage": true,
    "**/build": true,
    "**/.turbo": true,
    "**/package-lock.json": true,
    "**/yarn.lock": true,
    "**/pnpm-lock.yaml": true
  },
  "search.useIgnoreFiles": true,
  "search.smartCase": true,

  // ===================================
  // Explorer Settings
  // ===================================
  "explorer.confirmDelete": false,
  "explorer.confirmDragAndDrop": false,
  "explorer.compactFolders": true,
  "explorer.fileNesting.enabled": true,
  "explorer.fileNesting.expand": false,
  "explorer.fileNesting.patterns": {
    "*.ts": "${capture}.test.ts, ${capture}.spec.ts, ${capture}.d.ts",
    "*.tsx": "${capture}.test.tsx, ${capture}.spec.tsx, ${capture}.stories.tsx",
    "package.json": "package-lock.json, yarn.lock, pnpm-lock.yaml, .npmrc, .yarnrc.yml",
    "tsconfig.json": "tsconfig.*.json",
    ".eslintrc.*": ".eslintignore, .prettierrc*, .prettierignore",
    "tailwind.config.*": "postcss.config.*"
  },

  // ===================================
  // Language-specific Settings
  // ===================================
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.tabSize": 2
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.tabSize": 2
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.tabSize": 2
  },
  "[python]": {
    "editor.defaultFormatter": "ms-python.black-formatter",
    "editor.tabSize": 4,
    "editor.formatOnSave": true
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.tabSize": 2
  },
  "[jsonc]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[markdown]": {
    "editor.wordWrap": "on",
    "editor.quickSuggestions": {
      "other": false,
      "comments": false,
      "strings": false
    },
    "files.trimTrailingWhitespace": false
  },
  "[yaml]": {
    "editor.tabSize": 2,
    "editor.autoIndent": "advanced"
  },
  "[go]": {
    "editor.defaultFormatter": "golang.go",
    "editor.tabSize": 4,
    "editor.insertSpaces": false
  },
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer",
    "editor.tabSize": 4
  },
  "[css]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[html]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[dockerfile]": {
    "editor.defaultFormatter": "ms-azuretools.vscode-docker"
  },
  "[shellscript]": {
    "editor.tabSize": 2,
    "editor.defaultFormatter": "foxundermoon.shell-format"
  },

  // ===================================
  // Git Settings
  // ===================================
  "git.autofetch": true,
  "git.confirmSync": false,
  "git.enableSmartCommit": true,
  "git.openRepositoryInParentFolders": "always",
  "diffEditor.ignoreTrimWhitespace": false,

  // ===================================
  // Workbench Settings
  // ===================================
  "workbench.startupEditor": "none",
  "workbench.editor.enablePreview": true,
  "workbench.editor.closeOnFileDelete": true,
  "workbench.tree.indent": 16,
  "workbench.iconTheme": "material-icon-theme",
  "workbench.colorTheme": "One Dark Pro",
  "workbench.editor.labelFormat": "short",
  "workbench.editor.tabSizing": "shrink",

  // ===================================
  // Breadcrumbs
  // ===================================
  "breadcrumbs.enabled": true,
  "breadcrumbs.filePath": "on",
  "breadcrumbs.symbolPath": "on"
}
```

### 2.2 Settings Priority

```
High ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ → Low

  Workspace      >    User       >   Default
  Folder              Settings       Settings
  (.vscode/           (~/.config/
   settings.json)      Code/User/
                       settings.json)

* Workspace settings override User settings
* In a multi-root workspace, Folder settings take the highest priority
* Language-specific settings (e.g., [typescript]) take priority over general settings at the same level

Detailed priority chain:
  1. Language-specific workspace folder settings
  2. Workspace folder settings
  3. Language-specific workspace settings
  4. Workspace settings
  5. Language-specific user settings
  6. User settings
  7. Default settings
```

### 2.3 Multi-root Workspace Settings

```jsonc
// workspace.code-workspace (multi-root configuration file)
{
  "folders": [
    {
      "name": "Frontend",
      "path": "./packages/frontend"
    },
    {
      "name": "Backend API",
      "path": "./packages/api"
    },
    {
      "name": "Shared Library",
      "path": "./packages/shared"
    },
    {
      "name": "Infrastructure",
      "path": "./infra"
    }
  ],
  "settings": {
    // Settings applied to the entire workspace
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "search.exclude": {
      "**/node_modules": true,
      "**/dist": true,
      "**/coverage": true
    },
    // Folder-specific settings are written in each folder's .vscode/settings.json
    "files.exclude": {
      "**/.git": true,
      "**/node_modules": true
    }
  },
  "extensions": {
    "recommendations": [
      "dbaeumer.vscode-eslint",
      "esbenp.prettier-vscode"
    ]
  }
}
```

### 2.4 Exporting and Importing Settings

```bash
# Check current settings
cat ~/Library/Application\ Support/Code/User/settings.json

# Export extension list
code --list-extensions > vscode-extensions.txt

# Batch install extensions
cat vscode-extensions.txt | xargs -L 1 code --install-extension

# Export profile (CLI)
# Also available via Command Palette → "Profiles: Export Profile"
```

---

## 3. Recommended Extensions List

### 3.1 Categorized List (Detailed Version)

| Category | Extension | ID | Purpose |
|---------|---------|-----|------|
| **Language Support** | ESLint | `dbaeumer.vscode-eslint` | JavaScript/TypeScript linting |
| | Prettier | `esbenp.prettier-vscode` | Code formatter |
| | Python | `ms-python.python` | Python language support |
| | Pylance | `ms-python.vscode-pylance` | Fast Python type checking |
| | Black Formatter | `ms-python.black-formatter` | Python formatter |
| | Rust Analyzer | `rust-lang.rust-analyzer` | Rust language support |
| | Go | `golang.go` | Go language support |
| | C/C++ | `ms-vscode.cpptools` | C/C++ language support |
| **TypeScript** | Pretty TypeScript Errors | `yoavbls.pretty-ts-errors` | Makes TS errors readable |
| | TypeScript Importer | `pmneo.tsimporter` | Auto import |
| | Total TypeScript | `mattpocock.ts-error-translator` | TS error translation |
| **Git** | GitLens | `eamodio.gitlens` | Git history and blame display |
| | Git Graph | `mhutchie.git-graph` | Branch graph visualization |
| | Conventional Commits | `vivaxy.vscode-conventional-commits` | Commit message assistance |
| **AI** | GitHub Copilot | `github.copilot` | AI code completion |
| | GitHub Copilot Chat | `github.copilot-chat` | AI chat |
| **Productivity** | Error Lens | `usernamehw.errorlens` | Inline error display |
| | TODO Highlight | `wayou.vscode-todo-highlight` | TODO/FIXME highlighting |
| | Path Intellisense | `christian-kohler.path-intellisense` | Path auto-completion |
| | Auto Rename Tag | `formulahendry.auto-rename-tag` | HTML/JSX tag sync rename |
| | Code Spell Checker | `streetsidesoftware.code-spell-checker` | Spell checking |
| | Better Comments | `aaron-bond.better-comments` | Comment color coding |
| | Bookmarks | `alefragnani.bookmarks` | Code bookmarks |
| | Import Cost | `wix.vscode-import-cost` | Display import size |
| **Testing** | Jest Runner | `firsttris.vscode-jest-runner` | Run Jest tests |
| | Vitest | `vitest.explorer` | Run Vitest tests |
| | Test Explorer UI | `hbenl.vscode-test-explorer` | Unified test UI |
| **Appearance** | Material Icon Theme | `pkief.material-icon-theme` | File icons |
| | One Dark Pro | `zhuangtongfa.material-theme` | Color theme |
| | GitHub Theme | `github.github-vscode-theme` | GitHub-style theme |
| | Catppuccin | `catppuccin.catppuccin-vsc` | Pastel theme |
| | Indent Rainbow | `oderwat.indent-rainbow` | Indent visualization |
| **Containers** | Dev Containers | `ms-vscode-remote.remote-containers` | Docker dev environment |
| | Docker | `ms-azuretools.vscode-docker` | Docker management |
| **Remote** | Remote - SSH | `ms-vscode-remote.remote-ssh` | SSH remote development |
| | Remote - WSL | `ms-vscode-remote.remote-wsl` | WSL integration |
| | Remote - Tunnels | `ms-vscode.remote-server` | Tunnel connection |
| **Data** | Thunder Client | `rangav.vscode-thunder-client` | REST API client |
| | Database Client | `cweijan.vscode-database-client2` | DB client |
| | YAML | `redhat.vscode-yaml` | YAML validation |
| | DotENV | `mikestead.dotenv` | .env highlighting |
| **Markdown** | Markdown All in One | `yzhang.markdown-all-in-one` | Markdown enhancements |
| | Markdown Preview Enhanced | `shd101wyy.markdown-preview-enhanced` | Markdown preview |
| | Mermaid Preview | `bierner.markdown-mermaid` | Mermaid diagram preview |
| **CSS/HTML** | Tailwind CSS IntelliSense | `bradlc.vscode-tailwindcss` | Tailwind completion |
| | CSS Peek | `pranaygp.vscode-css-peek` | Jump to CSS definitions |
| | HTML CSS Support | `ecmel.vscode-html-css` | HTML/CSS completion |

### 3.2 Batch Extension Installation

```bash
# Batch install recommended extensions for a project
cat extensions.txt | xargs -L 1 code --install-extension

# Example extensions.txt:
# dbaeumer.vscode-eslint
# esbenp.prettier-vscode
# eamodio.gitlens
# github.copilot
# usernamehw.errorlens
# pkief.material-icon-theme

# Setup script by project type
# setup-vscode-extensions.sh
#!/bin/bash

COMMON_EXTENSIONS=(
  "dbaeumer.vscode-eslint"
  "esbenp.prettier-vscode"
  "eamodio.gitlens"
  "mhutchie.git-graph"
  "usernamehw.errorlens"
  "pkief.material-icon-theme"
  "streetsidesoftware.code-spell-checker"
  "github.copilot"
  "github.copilot-chat"
  "aaron-bond.better-comments"
)

FRONTEND_EXTENSIONS=(
  "bradlc.vscode-tailwindcss"
  "formulahendry.auto-rename-tag"
  "yoavbls.pretty-ts-errors"
  "wix.vscode-import-cost"
  "vitest.explorer"
  "styled-components.vscode-styled-components"
)

BACKEND_EXTENSIONS=(
  "ms-python.python"
  "ms-python.vscode-pylance"
  "ms-python.black-formatter"
  "golang.go"
  "rangav.vscode-thunder-client"
  "cweijan.vscode-database-client2"
)

DEVOPS_EXTENSIONS=(
  "ms-vscode-remote.remote-containers"
  "ms-azuretools.vscode-docker"
  "hashicorp.terraform"
  "ms-kubernetes-tools.vscode-kubernetes-tools"
  "redhat.vscode-yaml"
)

install_extensions() {
  local extensions=("$@")
  for ext in "${extensions[@]}"; do
    echo "Installing: $ext"
    code --install-extension "$ext" --force
  done
}

echo "=== Installing Common Extensions ==="
install_extensions "${COMMON_EXTENSIONS[@]}"

case "$1" in
  "frontend")
    echo "=== Installing Frontend Extensions ==="
    install_extensions "${FRONTEND_EXTENSIONS[@]}"
    ;;
  "backend")
    echo "=== Installing Backend Extensions ==="
    install_extensions "${BACKEND_EXTENSIONS[@]}"
    ;;
  "devops")
    echo "=== Installing DevOps Extensions ==="
    install_extensions "${DEVOPS_EXTENSIONS[@]}"
    ;;
  "all")
    echo "=== Installing All Extensions ==="
    install_extensions "${FRONTEND_EXTENSIONS[@]}"
    install_extensions "${BACKEND_EXTENSIONS[@]}"
    install_extensions "${DEVOPS_EXTENSIONS[@]}"
    ;;
  *)
    echo "Usage: $0 {frontend|backend|devops|all}"
    ;;
esac
```

### 3.3 Workspace Recommendation Settings

```jsonc
// .vscode/extensions.json
{
  "recommendations": [
    // Required
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "eamodio.gitlens",
    "github.copilot",
    "usernamehw.errorlens",
    // Frontend
    "bradlc.vscode-tailwindcss",
    "formulahendry.auto-rename-tag",
    "yoavbls.pretty-ts-errors",
    // Testing
    "vitest.explorer"
  ],
  "unwantedRecommendations": [
    "hookyqr.beautify",   // Conflicts with Prettier
    "esbenp.prettier-vscode" // For Python projects
  ]
}
```

### 3.4 Extension Conflicts and Solutions

```
Common extension conflict patterns:

1. Formatter conflicts
   ❌ Prettier + Beautify both enabled simultaneously
   ✅ Explicitly specify with defaultFormatter
   "[typescript]": {
     "editor.defaultFormatter": "esbenp.prettier-vscode"
   }

2. Linter conflicts
   ❌ ESLint + TSLint running simultaneously
   ✅ TSLint is deprecated. Consolidate to ESLint.

3. IntelliSense conflicts
   ❌ Tabnine + Copilot + IntelliCode all enabled simultaneously
   ✅ Limit to one AI completion tool (recommended: Copilot)

4. Git extension conflicts
   ❌ GitLens + Git History + Git Blame running simultaneously
   ✅ GitLens alone covers everything. Disable others.

5. Bracket pair colorization
   ❌ Bracket Pair Colorizer extension (deprecated)
   ✅ Use VS Code's native feature
   "editor.bracketPairColorization.enabled": true
```

---

## 4. Key Bindings

### 4.1 Essential Shortcuts List

| Action | macOS | Windows/Linux |
|------|-------|---------------|
| Command Palette | `Cmd+Shift+P` | `Ctrl+Shift+P` |
| File search | `Cmd+P` | `Ctrl+P` |
| Symbol search (workspace) | `Cmd+T` | `Ctrl+T` |
| Symbol search (in file) | `Cmd+Shift+O` | `Ctrl+Shift+O` |
| Global search | `Cmd+Shift+F` | `Ctrl+Shift+F` |
| Global replace | `Cmd+Shift+H` | `Ctrl+Shift+H` |
| Toggle terminal | `` Ctrl+` `` | `` Ctrl+` `` |
| New terminal | `` Ctrl+Shift+` `` | `` Ctrl+Shift+` `` |
| Toggle sidebar | `Cmd+B` | `Ctrl+B` |
| Toggle panel | `Cmd+J` | `Ctrl+J` |
| Move line | `Alt+Up/Down` | `Alt+Up/Down` |
| Duplicate line | `Shift+Alt+Up/Down` | `Shift+Alt+Up/Down` |
| Delete line | `Cmd+Shift+K` | `Ctrl+Shift+K` |
| Go to definition | `F12` | `F12` |
| Peek definition | `Alt+F12` | `Alt+F12` |
| Go to type definition | `Cmd+Click` | `Ctrl+Click` |
| Find references | `Shift+F12` | `Shift+F12` |
| Rename | `F2` | `F2` |
| Quick fix | `Cmd+.` | `Ctrl+.` |
| Close file | `Cmd+W` | `Ctrl+W` |
| Close all files | `Cmd+K Cmd+W` | `Ctrl+K Ctrl+W` |
| Split editor | `Cmd+\` | `Ctrl+\` |
| Switch editor group | `Cmd+1/2/3` | `Ctrl+1/2/3` |
| Fold | `Cmd+Shift+[` | `Ctrl+Shift+[` |
| Unfold | `Cmd+Shift+]` | `Ctrl+Shift+]` |
| Toggle comment | `Cmd+/` | `Ctrl+/` |
| Block comment | `Shift+Alt+A` | `Shift+Alt+A` |
| Increase indent | `Cmd+]` | `Ctrl+]` |
| Decrease indent | `Cmd+[` | `Ctrl+[` |
| Go back | `Ctrl+-` | `Alt+Left` |
| Go forward | `Ctrl+Shift+-` | `Alt+Right` |
| Zen Mode | `Cmd+K Z` | `Ctrl+K Z` |

### 4.2 Custom Key Bindings

```jsonc
// keybindings.json
[
  // --- Basic Editing ---
  {
    "key": "cmd+shift+d",
    "command": "editor.action.copyLinesDownAction",
    "when": "editorTextFocus"
  },
  {
    "key": "cmd+shift+k",
    "command": "editor.action.deleteLines",
    "when": "editorTextFocus"
  },
  {
    "key": "cmd+shift+l",
    "command": "editor.action.selectHighlights",
    "when": "editorTextFocus"
  },

  // --- File Operations ---
  {
    "key": "cmd+k cmd+o",
    "command": "workbench.action.openRecent"
  },

  // --- Terminal ---
  {
    "key": "cmd+shift+t",
    "command": "workbench.action.terminal.new"
  },
  {
    "key": "cmd+shift+[",
    "command": "workbench.action.terminal.focusPrevious",
    "when": "terminalFocus"
  },
  {
    "key": "cmd+shift+]",
    "command": "workbench.action.terminal.focusNext",
    "when": "terminalFocus"
  },

  // --- Panel Operations ---
  {
    "key": "cmd+shift+m",
    "command": "workbench.actions.view.problems"
  },
  {
    "key": "cmd+shift+u",
    "command": "workbench.action.output.toggleOutput"
  },

  // --- Git Operations ---
  {
    "key": "cmd+shift+g cmd+shift+g",
    "command": "workbench.view.scm"
  },

  // --- Test Execution (Jest/Vitest) ---
  {
    "key": "cmd+shift+r",
    "command": "testing.runAtCursor",
    "when": "editorTextFocus"
  },
  {
    "key": "cmd+shift+e",
    "command": "testing.debugAtCursor",
    "when": "editorTextFocus"
  },

  // --- Reveal file in Explorer ---
  {
    "key": "cmd+shift+1",
    "command": "revealFileInOS"
  },

  // --- Multi-cursor Operations ---
  {
    "key": "cmd+alt+up",
    "command": "editor.action.insertCursorAbove",
    "when": "editorTextFocus"
  },
  {
    "key": "cmd+alt+down",
    "command": "editor.action.insertCursorBelow",
    "when": "editorTextFocus"
  }
]
```

### 4.3 Introducing Vim Key Bindings

```jsonc
// Settings when using the Vim extension (vscodevim.vim)
// Add to settings.json
{
  "vim.enable": true,
  "vim.leader": "<space>",
  "vim.useSystemClipboard": true,
  "vim.useCtrlKeys": true,
  "vim.handleKeys": {
    "<C-a>": false,   // Keep VS Code "Select All"
    "<C-f>": false,   // Keep VS Code "Find"
    "<C-c>": false,   // Keep VS Code "Copy"
    "<C-v>": false,   // Keep VS Code "Paste"
    "<C-x>": false,   // Keep VS Code "Cut"
    "<C-z>": false,   // Keep VS Code "Undo"
    "<C-shift-p>": false  // Keep Command Palette
  },
  "vim.normalModeKeyBindingsNonRecursive": [
    // <space>f for file search
    { "before": ["<leader>", "f"], "commands": ["workbench.action.quickOpen"] },
    // <space>g for global search
    { "before": ["<leader>", "g"], "commands": ["workbench.action.findInFiles"] },
    // <space>e to toggle Explorer
    { "before": ["<leader>", "e"], "commands": ["workbench.view.explorer"] },
    // <space>w to save
    { "before": ["<leader>", "w"], "commands": [":w"] },
    // <space>q to close
    { "before": ["<leader>", "q"], "commands": [":q"] },
    // gh to show hover
    { "before": ["g", "h"], "commands": ["editor.action.showHover"] },
    // gd to jump to definition
    { "before": ["g", "d"], "commands": ["editor.action.revealDefinition"] },
    // gr to find references
    { "before": ["g", "r"], "commands": ["editor.action.goToReferences"] }
  ],
  "vim.visualModeKeyBindingsNonRecursive": [
    // > to indent (remain in visual mode)
    { "before": [">"], "commands": ["editor.action.indentLines"] },
    { "before": ["<"], "commands": ["editor.action.outdentLines"] }
  ]
}
```

---

## 5. Multi-cursor

### 5.1 Basic Operations

```
Text example:
  const firstName = "Alice";
  const lastName = "Bob";
  const nickName = "Charlie";

Action: Select "Name" consecutively with Cmd+D → edit 3 locations simultaneously

  1. Place cursor on "Name" in "firstName"
  2. Cmd+D → also selects "Name" in "lastName"
  3. Cmd+D → also selects "Name" in "nickName"
  4. Edit all at once: "Name" → "Label"

Result:
  const firstLabel = "Alice";
  const lastLabel = "Bob";
  const nickLabel = "Charlie";
```

### 5.2 Column Selection

```
Operation flow:

  Step 1: Alt+Shift+Drag for column selection
  ┌─────────────────────────┐
  │ item1: "apple"          │
  │ item2: "banana"    ←──── Add cursors vertically
  │ item3: "cherry"         │
  └─────────────────────────┘

  Step 2: Type simultaneously
  ┌─────────────────────────┐
  │ item1: "fresh_apple"    │
  │ item2: "fresh_banana"   │
  │ item3: "fresh_cherry"   │
  └─────────────────────────┘
```

### 5.3 Practical Multi-cursor Examples

```
Example 1: Batch rename JSON keys

Before:
{
  "user_name": "Alice",
  "user_age": 30,
  "user_email": "alice@example.com",
  "user_phone": "090-1234-5678"
}

Action:
  1. Select "user_"
  2. Cmd+Shift+L → select all "user_" at once
  3. Delete all of them

After:
{
  "name": "Alice",
  "age": 30,
  "email": "alice@example.com",
  "phone": "090-1234-5678"
}

─────────────────────────────────

Example 2: Convert array elements to objects

Before:
const colors = [
  "red",
  "green",
  "blue",
  "yellow",
];

Action:
  1. Place cursor at the leading " of each line (add with Alt+Click)
  2. Type "{ name: "
  3. Move to end of line with End key
  4. Type ", value: '#000' }"

After:
const colors = [
  { name: "red", value: '#000' },
  { name: "green", value: '#000' },
  { name: "blue", value: '#000' },
  { name: "yellow", value: '#000' },
];

─────────────────────────────────

Example 3: Batch add CSS properties

Before:
.card {
  border-radius: 8px;
}
.button {
  border-radius: 4px;
}
.input {
  border-radius: 6px;
}

Action:
  1. Search for "border-radius" with Cmd+Shift+F
  2. Add cursors to the end of each line
  3. Press Enter and type "overflow: hidden;" on the new line
```

---

## 6. Snippets

### 6.1 User Snippet Definitions (Extended Version)

```jsonc
// .vscode/project.code-snippets
{
  // ===================================
  // React Components
  // ===================================
  "React Functional Component": {
    "prefix": "rfc",
    "scope": "typescriptreact",
    "body": [
      "type ${1:Component}Props = {",
      "  $2",
      "};",
      "",
      "export function ${1:Component}({ $3 }: ${1:Component}Props) {",
      "  return (",
      "    <div>",
      "      $0",
      "    </div>",
      "  );",
      "}"
    ],
    "description": "React Functional Component with TypeScript"
  },
  "React Component with useState": {
    "prefix": "rfcs",
    "scope": "typescriptreact",
    "body": [
      "import { useState } from 'react';",
      "",
      "type ${1:Component}Props = {",
      "  $2",
      "};",
      "",
      "export function ${1:Component}({ $3 }: ${1:Component}Props) {",
      "  const [${4:state}, set${4/(.*)/${1:/capitalize}/}] = useState<${5:string}>($6);",
      "",
      "  return (",
      "    <div>",
      "      $0",
      "    </div>",
      "  );",
      "}"
    ],
    "description": "React Component with useState hook"
  },
  "React Custom Hook": {
    "prefix": "rhook",
    "scope": "typescript,typescriptreact",
    "body": [
      "import { useState, useEffect } from 'react';",
      "",
      "export function use${1:Hook}(${2:params}: ${3:ParamType}) {",
      "  const [${4:data}, set${4/(.*)/${1:/capitalize}/}] = useState<${5:DataType}>();",
      "  const [isLoading, setIsLoading] = useState(false);",
      "  const [error, setError] = useState<Error | null>(null);",
      "",
      "  useEffect(() => {",
      "    $0",
      "  }, [${2:params}]);",
      "",
      "  return { ${4:data}, isLoading, error };",
      "}"
    ],
    "description": "React Custom Hook"
  },

  // ===================================
  // Testing
  // ===================================
  "Describe Block": {
    "prefix": "desc",
    "scope": "typescript,typescriptreact,javascript",
    "body": [
      "describe('${1:subject}', () => {",
      "  $0",
      "});"
    ],
    "description": "Jest/Vitest describe block"
  },
  "Test Case": {
    "prefix": "it",
    "scope": "typescript,typescriptreact,javascript",
    "body": [
      "it('should ${1:description}', () => {",
      "  // Arrange",
      "  $2",
      "",
      "  // Act",
      "  $3",
      "",
      "  // Assert",
      "  expect($4).${5:toBe}($6);",
      "});"
    ],
    "description": "Test case with AAA pattern"
  },
  "Async Test Case": {
    "prefix": "ita",
    "scope": "typescript,typescriptreact,javascript",
    "body": [
      "it('should ${1:description}', async () => {",
      "  // Arrange",
      "  $2",
      "",
      "  // Act",
      "  const result = await ${3:asyncFunction}();",
      "",
      "  // Assert",
      "  expect(result).${4:toBe}($5);",
      "});"
    ],
    "description": "Async test case"
  },

  // ===================================
  // Common Patterns
  // ===================================
  "Console Log Variable": {
    "prefix": "clv",
    "scope": "javascript,typescript,typescriptreact,javascriptreact",
    "body": [
      "console.log('${1:variable}:', ${1:variable});"
    ],
    "description": "Console log with variable name"
  },
  "Console Log JSON": {
    "prefix": "clj",
    "scope": "javascript,typescript,typescriptreact,javascriptreact",
    "body": [
      "console.log('${1:variable}:', JSON.stringify(${1:variable}, null, 2));"
    ],
    "description": "Console log with JSON stringify"
  },
  "Try-Catch Block": {
    "prefix": "trycatch",
    "scope": "typescript,javascript",
    "body": [
      "try {",
      "  $1",
      "} catch (error) {",
      "  if (error instanceof Error) {",
      "    console.error(error.message);",
      "  }",
      "  throw error;",
      "}"
    ],
    "description": "Try-catch with type guard"
  },
  "Async Arrow Function": {
    "prefix": "aaf",
    "scope": "typescript,javascript,typescriptreact",
    "body": [
      "const ${1:functionName} = async (${2:params}: ${3:ParamType}): Promise<${4:ReturnType}> => {",
      "  $0",
      "};"
    ],
    "description": "Async arrow function with types"
  },
  "Zod Schema": {
    "prefix": "zod",
    "scope": "typescript,typescriptreact",
    "body": [
      "import { z } from 'zod';",
      "",
      "export const ${1:name}Schema = z.object({",
      "  ${2:field}: z.${3:string}(),",
      "  $0",
      "});",
      "",
      "export type ${1:name} = z.infer<typeof ${1:name}Schema>;"
    ],
    "description": "Zod schema definition"
  },

  // ===================================
  // Next.js
  // ===================================
  "Next.js Page Component": {
    "prefix": "npage",
    "scope": "typescriptreact",
    "body": [
      "export default function ${1:Page}() {",
      "  return (",
      "    <main>",
      "      <h1>${2:Title}</h1>",
      "      $0",
      "    </main>",
      "  );",
      "}"
    ],
    "description": "Next.js App Router page component"
  },
  "Next.js Server Action": {
    "prefix": "naction",
    "scope": "typescript,typescriptreact",
    "body": [
      "'use server';",
      "",
      "export async function ${1:actionName}(formData: FormData) {",
      "  const ${2:field} = formData.get('${2:field}') as string;",
      "",
      "  $0",
      "}"
    ],
    "description": "Next.js Server Action"
  },

  // ===================================
  // Documentation Comments
  // ===================================
  "JSDoc Function": {
    "prefix": "jsdoc",
    "scope": "typescript,javascript,typescriptreact",
    "body": [
      "/**",
      " * ${1:Description}",
      " *",
      " * @param ${2:param} - ${3:description}",
      " * @returns ${4:description}",
      " * @throws {${5:Error}} ${6:description}",
      " *",
      " * @example",
      " * ```typescript",
      " * ${7:example}",
      " * ```",
      " */"
    ],
    "description": "JSDoc function documentation"
  }
}
```

### 6.2 Snippet Variable Reference

```
Built-in variables available in VS Code snippets:

File-related:
  $TM_FILENAME          → "index.ts"
  $TM_FILENAME_BASE     → "index"
  $TM_DIRECTORY         → "/Users/gaku/project/src"
  $TM_FILEPATH          → "/Users/gaku/project/src/index.ts"
  $RELATIVE_FILEPATH    → "src/index.ts"
  $WORKSPACE_NAME       → "my-project"
  $WORKSPACE_FOLDER     → "/Users/gaku/project"

Date and time:
  $CURRENT_YEAR         → "2026"
  $CURRENT_MONTH        → "02"
  $CURRENT_DATE         → "15"
  $CURRENT_HOUR         → "14"
  $CURRENT_MINUTE       → "30"
  $CURRENT_SECOND       → "00"

Other:
  $CLIPBOARD            → Clipboard contents
  $LINE_COMMENT         → Language line comment (// or #)
  $BLOCK_COMMENT_START  → Language block comment start (/* or <!--)
  $BLOCK_COMMENT_END    → Language block comment end (*/ or -->)
  $UUID                 → Generate UUID v4
  $RANDOM               → 6-digit random integer
  $RANDOM_HEX           → 6-digit random hex

Transforms:
  ${1/(.*)/${1:/upcase}/}      → Uppercase
  ${1/(.*)/${1:/downcase}/}    → Lowercase
  ${1/(.*)/${1:/capitalize}/}  → Capitalize first letter
  ${1/(.*)/${1:/pascalcase}/}  → PascalCase
  ${1/(.*)/${1:/camelcase}/}   → camelCase

Placeholders:
  $1, $2, ...           → Tab stops (in input order)
  $0                    → Final cursor position
  ${1:default}          → Tab stop with default value
  ${1|one,two,three|}   → Tab stop with choices
```

---

## 7. Debug Configuration

### 7.1 Basic launch.json Structure

```jsonc
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    // ===================================
    // Node.js Applications
    // ===================================
    {
      "name": "Node.js: Current File",
      "type": "node",
      "request": "launch",
      "program": "${file}",
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Node.js: ts-node",
      "type": "node",
      "request": "launch",
      "runtimeArgs": ["-r", "ts-node/register"],
      "args": ["${file}"],
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"],
      "env": {
        "TS_NODE_PROJECT": "${workspaceFolder}/tsconfig.json"
      }
    },

    // ===================================
    // Next.js
    // ===================================
    {
      "name": "Next.js: Dev Server",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["next", "dev"],
      "console": "integratedTerminal",
      "serverReadyAction": {
        "pattern": "- Local:.+(https?://.+)",
        "uriFormat": "%s",
        "action": "debugWithChrome"
      }
    },
    {
      "name": "Next.js: Server-side",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["next", "dev"],
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal",
      "env": {
        "NODE_OPTIONS": "--inspect"
      }
    },

    // ===================================
    // Testing
    // ===================================
    {
      "name": "Jest: Current File",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npx",
      "runtimeArgs": [
        "jest",
        "--runInBand",
        "--no-coverage",
        "${relativeFile}"
      ],
      "console": "integratedTerminal",
      "cwd": "${workspaceFolder}"
    },
    {
      "name": "Vitest: Current File",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npx",
      "runtimeArgs": [
        "vitest",
        "run",
        "${relativeFile}"
      ],
      "console": "integratedTerminal",
      "cwd": "${workspaceFolder}"
    },

    // ===================================
    // Python
    // ===================================
    {
      "name": "Python: Current File",
      "type": "debugpy",
      "request": "launch",
      "program": "${file}",
      "console": "integratedTerminal",
      "justMyCode": true
    },
    {
      "name": "Python: FastAPI",
      "type": "debugpy",
      "request": "launch",
      "module": "uvicorn",
      "args": ["main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"],
      "console": "integratedTerminal",
      "cwd": "${workspaceFolder}",
      "env": {
        "PYTHONPATH": "${workspaceFolder}"
      }
    },
    {
      "name": "Python: Django",
      "type": "debugpy",
      "request": "launch",
      "program": "${workspaceFolder}/manage.py",
      "args": ["runserver", "0.0.0.0:8000"],
      "django": true,
      "console": "integratedTerminal"
    },
    {
      "name": "Python: pytest",
      "type": "debugpy",
      "request": "launch",
      "module": "pytest",
      "args": ["-xvs", "${file}"],
      "console": "integratedTerminal",
      "cwd": "${workspaceFolder}"
    },

    // ===================================
    // Go
    // ===================================
    {
      "name": "Go: Launch Package",
      "type": "go",
      "request": "launch",
      "mode": "auto",
      "program": "${workspaceFolder}/cmd/server",
      "env": {
        "GO_ENV": "development"
      }
    },
    {
      "name": "Go: Test Current File",
      "type": "go",
      "request": "launch",
      "mode": "test",
      "program": "${file}"
    },

    // ===================================
    // Browser
    // ===================================
    {
      "name": "Chrome: Open URL",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/src",
      "sourceMapPathOverrides": {
        "webpack:///./src/*": "${webRoot}/*"
      }
    },

    // ===================================
    // Docker (Remote Attach)
    // ===================================
    {
      "name": "Docker: Attach to Node",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "address": "localhost",
      "localRoot": "${workspaceFolder}",
      "remoteRoot": "/app",
      "restart": true,
      "skipFiles": ["<node_internals>/**"]
    }
  ],

  // ===================================
  // Compound Configurations
  // ===================================
  "compounds": [
    {
      "name": "Full Stack: Frontend + Backend",
      "configurations": [
        "Next.js: Dev Server",
        "Python: FastAPI"
      ],
      "stopAll": true
    }
  ]
}
```

### 7.2 Debugging Techniques

```
Breakpoint types:

1. Standard breakpoint
   - Click to the left of the line number (red circle)
   - Toggle with F9

2. Conditional breakpoint
   - Right-click breakpoint → "Edit Breakpoint"
   - Condition expression: i > 100 && user.role === "admin"

3. Logpoint
   - Output logs without stopping execution
   - Right-click breakpoint → "Add Logpoint"
   - Message: "User: {user.name}, Count: {count}"
   - Displayed as a diamond-shaped icon

4. Hit count breakpoint
   - Stop on the Nth hit
   - Condition: "Hit Count" → 100

5. Exception breakpoint
   - Debug panel → Breakpoints → Check "Caught Exceptions"
   - Stop on all exceptions

Using the debug console:
  - Evaluate variables while paused: user.name
  - Call methods: JSON.stringify(data, null, 2)
  - Change values: user.name = "NewValue" (use with caution)
```

---

## 8. Task Configuration

### 8.1 tasks.json Structure

```jsonc
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    // ===================================
    // Build Tasks
    // ===================================
    {
      "label": "Build: TypeScript",
      "type": "shell",
      "command": "npx tsc --build",
      "group": {
        "kind": "build",
        "isDefault": true
      },
      "problemMatcher": ["$tsc"],
      "presentation": {
        "reveal": "silent",
        "panel": "shared"
      }
    },
    {
      "label": "Build: Next.js",
      "type": "shell",
      "command": "npx next build",
      "group": "build",
      "problemMatcher": [],
      "presentation": {
        "reveal": "always",
        "panel": "dedicated"
      }
    },

    // ===================================
    // Dev Servers
    // ===================================
    {
      "label": "Dev: Frontend",
      "type": "shell",
      "command": "npm run dev",
      "isBackground": true,
      "problemMatcher": {
        "pattern": {
          "regexp": ".",
          "file": 1,
          "location": 2,
          "message": 3
        },
        "background": {
          "activeOnStart": true,
          "beginsPattern": ".",
          "endsPattern": "ready"
        }
      },
      "presentation": {
        "reveal": "always",
        "panel": "dedicated",
        "group": "dev"
      }
    },
    {
      "label": "Dev: Backend",
      "type": "shell",
      "command": "python -m uvicorn main:app --reload",
      "isBackground": true,
      "presentation": {
        "reveal": "always",
        "panel": "dedicated",
        "group": "dev"
      }
    },
    {
      "label": "Dev: Full Stack",
      "dependsOn": ["Dev: Frontend", "Dev: Backend"],
      "dependsOrder": "parallel",
      "problemMatcher": []
    },

    // ===================================
    // Testing
    // ===================================
    {
      "label": "Test: Unit",
      "type": "shell",
      "command": "npx vitest run",
      "group": {
        "kind": "test",
        "isDefault": true
      },
      "presentation": {
        "reveal": "always",
        "panel": "shared"
      }
    },
    {
      "label": "Test: Watch",
      "type": "shell",
      "command": "npx vitest watch",
      "isBackground": true,
      "presentation": {
        "reveal": "always",
        "panel": "dedicated"
      }
    },
    {
      "label": "Test: E2E",
      "type": "shell",
      "command": "npx playwright test",
      "presentation": {
        "reveal": "always",
        "panel": "dedicated"
      }
    },

    // ===================================
    // Lint & Format
    // ===================================
    {
      "label": "Lint: ESLint Fix",
      "type": "shell",
      "command": "npx eslint . --fix",
      "problemMatcher": ["$eslint-stylish"]
    },
    {
      "label": "Format: Prettier",
      "type": "shell",
      "command": "npx prettier --write .",
      "presentation": {
        "reveal": "silent"
      }
    },
    {
      "label": "Lint: Type Check",
      "type": "shell",
      "command": "npx tsc --noEmit",
      "problemMatcher": ["$tsc"]
    },

    // ===================================
    // Docker
    // ===================================
    {
      "label": "Docker: Up",
      "type": "shell",
      "command": "docker compose up -d",
      "presentation": {
        "reveal": "always"
      }
    },
    {
      "label": "Docker: Down",
      "type": "shell",
      "command": "docker compose down",
      "presentation": {
        "reveal": "always"
      }
    },
    {
      "label": "Docker: Rebuild",
      "type": "shell",
      "command": "docker compose up -d --build",
      "presentation": {
        "reveal": "always"
      }
    },

    // ===================================
    // Database
    // ===================================
    {
      "label": "DB: Migrate",
      "type": "shell",
      "command": "npx prisma migrate dev",
      "presentation": {
        "reveal": "always"
      }
    },
    {
      "label": "DB: Seed",
      "type": "shell",
      "command": "npx prisma db seed",
      "presentation": {
        "reveal": "always"
      }
    },
    {
      "label": "DB: Studio",
      "type": "shell",
      "command": "npx prisma studio",
      "isBackground": true,
      "presentation": {
        "reveal": "always",
        "panel": "dedicated"
      }
    }
  ]
}
```

### 8.2 How to Run Tasks

```
Shortcuts for running tasks:

1. From the Command Palette:
   Cmd+Shift+P → "Tasks: Run Task" → Select task

2. Shortcut keys:
   Cmd+Shift+B → Run the default build task
   (Test tasks can also be bound to keys)

3. Terminal task display:
   Terminal panel → Switch between task terminals via dropdown

4. Using compound tasks:
   Run multiple tasks in parallel or sequence with dependsOn
   dependsOrder: "parallel" | "sequence"
```

---

## 9. Settings Sync

### 9.1 Settings Sync Configuration

```
Items synced by Settings Sync:
┌─────────────────────────────────────┐
│  ✅ Settings (settings.json)         │
│  ✅ Keyboard Shortcuts               │
│  ✅ Extensions                        │
│  ✅ User Snippets                     │
│  ✅ UI State                          │
│                                       │
│  Sync methods:                        │
│  ├── GitHub account                  │
│  └── Microsoft account               │
│                                       │
│  Enable:                              │
│  Cmd+Shift+P → "Settings Sync: Turn On" │
└─────────────────────────────────────┘

Resolving sync conflicts:
  - Choose "Merge" or "Replace" on first sync
  - Diff between local and remote is previewed
  - Sync can be enabled/disabled per setting item

Settings to exclude from sync:
  Add the following to settings.json:
  "settingsSync.ignoredSettings": [
    "editor.fontSize",     // Varies by personal preference
    "terminal.integrated.fontSize",
    "workbench.colorTheme"
  ]
```

### 9.2 Profile Feature

```bash
# Manage purpose-specific environments by switching profiles
#
# Example: "Frontend" profile
#   - ESLint, Prettier, Tailwind CSS IntelliSense
#   - React/Vue extensions
#   - Frontend-oriented theme
#
# Example: "Backend" profile
#   - Python, Go, Rust language support
#   - REST Client, Database Client
#   - Simple theme
#
# Example: "Python Data Science" profile
#   - Python, Jupyter, Pylance
#   - Data visualization extensions
#   - Analytics-oriented settings
#
# Example: "DevOps" profile
#   - Docker, Kubernetes, Terraform
#   - YAML, Helm
#   - SSH Remote
#
# Example: "Writing" profile
#   - Markdown All in One
#   - Spell Checker
#   - Zen Mode settings

# Launch with a specified profile via CLI
code --profile "Frontend" .

# Managing profiles
# Command Palette → "Profiles: Create Profile"
# Command Palette → "Profiles: Switch Profile"
# Command Palette → "Profiles: Delete Profile"
# Command Palette → "Profiles: Export Profile"
# Command Palette → "Profiles: Import Profile"

# Sharing profiles
# Exported profiles can be shared as URLs
# Team members can set up the same environment with a single click
```

---

## 10. Remote Development

### 10.1 Remote - SSH

```jsonc
// SSH configuration (~/.ssh/config)
// Host dev-server
//   HostName 192.168.1.100
//   User developer
//   Port 22
//   IdentityFile ~/.ssh/id_ed25519
//   ForwardAgent yes

// VS Code settings (settings.json)
{
  "remote.SSH.remotePlatform": {
    "dev-server": "linux"
  },
  "remote.SSH.useLocalServer": true,
  "remote.SSH.connectTimeout": 30,
  "remote.SSH.defaultExtensions": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode"
  ]
}
```

```
Remote SSH connection flow:

Local PC                      Remote Server
┌──────────┐                ┌──────────────────┐
│ VS Code  │ ── SSH ───── →│ VS Code Server   │
│ (UI)     │                │ (Extension Host) │
│          │← File Ops ─── │                  │
│          │← LSP Data ─── │ Source code       │
│          │← Terminal ─── │ Runtime           │
└──────────┘                └──────────────────┘

Performance optimization:
  1. Add large directories to files.watcherExclude
  2. Exclude unnecessary paths with search.exclude
  3. Install only required extensions on the remote side
  4. Reuse connections with SSH ControlMaster

  Add to ~/.ssh/config:
  Host *
    ControlMaster auto
    ControlPath ~/.ssh/sockets/%r@%h-%p
    ControlPersist 600
```

### 10.2 Remote - WSL

```jsonc
// Settings for WSL environment
{
  "remote.WSL.useShellEnvironment": true,
  "terminal.integrated.defaultProfile.linux": "zsh",
  // Convert Windows paths to WSL paths
  "remote.WSL.fileWatcher.polling": false
}
```

```bash
# Open VS Code from WSL
wsl
cd /home/user/project
code .

# Specify a specific distribution
code --remote wsl+Ubuntu-22.04 /home/user/project
```

### 10.3 Remote Tunnels (VS Code Server)

```bash
# Start VS Code Server on remote machine
# Accessible from a browser or another VS Code instance

# Create tunnel on server side
code tunnel

# Named tunnel
code tunnel --name my-dev-server

# Register as a service (Linux)
code tunnel service install

# Connect from client side
# Access vscode.dev → select remote machine
# Or connect remotely from VS Code desktop
```

---

## 11. Performance Optimization

### 11.1 Improving Startup Speed

```
Checklist when VS Code is slow:

□ 1. Check the number of extensions
     Command Palette → "Extensions: Show Running Extensions"
     Startup time is displayed. Focus on extensions over 100ms.

□ 2. Disable unnecessary extensions
     Enable only required extensions per workspace
     Manage by purpose using the profile feature

□ 3. Configure files.exclude / files.watcherExclude
     Exclude node_modules, .git, dist, build, etc.

□ 4. Configure search.exclude
     Exclude large binaries and lock files

□ 5. Check memory usage
     Command Palette → "Developer: Open Process Explorer"
     If Extension Host memory exceeds 500MB, review extensions

□ 6. Review settings
     editor.minimap.enabled: false (reduce CPU load)
     editor.renderWhitespace: "boundary" (avoid "all")
     editor.occurrencesHighlight: false (smoother on large files)

□ 7. TypeScript configuration
     Properly configure include/exclude in tsconfig.json
     Exclude unnecessary files from type checking
```

### 11.2 Strategies for Large Projects

```jsonc
// Settings example for large monorepos
{
  // File watcher optimization
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/.git/objects/**": true,
    "**/.git/subtree-cache/**": true,
    "**/dist/**": true,
    "**/.next/**": true,
    "**/coverage/**": true,
    "**/.turbo/**": true,
    "**/build/**": true,
    "**/.cache/**": true,
    "**/tmp/**": true
  },

  // Search exclusions
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.next": true,
    "**/coverage": true,
    "**/package-lock.json": true,
    "**/yarn.lock": true,
    "**/pnpm-lock.yaml": true,
    "**/*.min.js": true,
    "**/*.map": true,
    "**/.turbo": true
  },

  // TypeScript optimization
  "typescript.tsserver.maxTsServerMemory": 4096,
  "typescript.tsserver.watchOptions": {
    "watchFile": "useFsEventsOnParentDirectory",
    "watchDirectory": "useFsEvents"
  },

  // ESLint optimization
  "eslint.workingDirectories": [
    { "mode": "auto" }
  ],

  // Git optimization
  "git.repositoryScanMaxDepth": 1
}
```

### 11.3 Diagnosing Startup Performance

```bash
# VS Code startup performance report
code --status

# Check extension startup time
# Command Palette → "Developer: Startup Performance"
# Shows elapsed time for each phase:
#   - Electron Main → Window Load
#   - Window Load → Require Main
#   - Require Main → Workbench Ready
#   - Extensions Activated

# Extension Bisect (identify problematic extensions)
# Command Palette → "Help: Start Extension Bisect"
# Automatically identifies problematic extensions via binary search

# Launch with verbose logging
code --verbose --log trace
```

---

## 12. Anti-patterns

### 12.1 Installing Too Many Extensions

```
❌ Anti-pattern: Installing more than 100 extensions

Problems:
  - Startup time increases to over 10 seconds
  - Memory usage exceeds 2GB
  - Extension conflicts (e.g., double formatter application)
  - IntelliSense response delays

✅ Correct approach:
  - Separate by project type using the profile feature
  - Disable/uninstall unused extensions
  - Recommend/restrict extensions per workspace
  - Identify problematic extensions with Extension Bisect
```

### 12.2 Writing Project-specific Settings in User Settings

```
❌ Anti-pattern: Writing settings specific to a framework
   in User Settings shared across all projects

{
  // Written in User settings.json
  "eslint.workingDirectories": [{ "mode": "auto" }],
  "tailwindCSS.experimental.classRegex": [...]
}

✅ Correct approach:
  - Write project-specific settings in .vscode/settings.json
  - Commit settings that should be shared with the team to the repository
  - Keep only personal appearance settings in User Settings
```

### 12.3 Other Anti-patterns

```
❌ Adding the .vscode folder to .gitignore
  → Team unified settings cannot be shared

✅ Files that should be committed:
  - .vscode/settings.json (project settings)
  - .vscode/extensions.json (recommended extensions)
  - .vscode/launch.json (debug configuration)
  - .vscode/*.code-snippets (snippets)

✅ Files that should be in .gitignore:
  - .vscode/tasks.json (when it's a personal task config)
  - .vscode/*.code-workspace (when it's a personal workspace config)

─────────────────────────────────

❌ Disabling formatOnSave and formatting manually
  → Missed formatting, differences between team members

✅ Correct approach:
  - Always enable formatOnSave: true
  - Unify rules with .prettierrc
  - Run format checks in CI as well

─────────────────────────────────

❌ Writing secrets in settings.json
  → API keys and credentials leak into the repository

✅ Correct approach:
  - Separate into .env files
  - Add .env to .gitignore
  - Commit .env.example as a template

─────────────────────────────────

❌ Settings that ignore all warnings and errors
  → Code quality degrades

✅ Correct approach:
  - Disable only specific rules as needed
  - Include a comment with the reason when using eslint-disable
  - Configure common exclusion rules as a team
```

---

## 13. Practical Workflows

### 13.1 Daily Development Workflow

```
Typical VS Code development workflow:

1. Open project
   $ code ~/projects/my-app

2. Start dev server from terminal
   Ctrl+` → npm run dev

3. Coding
   - Cmd+P to search files
   - F12 to jump to definition
   - Shift+F12 to find references
   - Cmd+Shift+O for symbol search

4. Git operations
   - Cmd+Shift+G for Source Control panel
   - Stage changes (+ button)
   - Enter commit message → Cmd+Enter to commit
   - Check blame with GitLens

5. Debugging
   - Set breakpoints
   - F5 to start debugging
   - F10 step over
   - F11 step into
   - Shift+F11 step out

6. Testing
   - Display test list in Testing panel
   - Run and debug tests
   - Check coverage

7. Pre-PR checks
   - Cmd+Shift+B to build
   - Type check (tsc --noEmit)
   - Lint check
   - Run all tests
```

### 13.2 Code Review Workflow

```
Conducting PR reviews in VS Code:

1. Install GitHub Pull Requests extension
   code --install-extension github.vscode-pull-request-github

2. Display PR list
   Activity Bar → GitHub icon → Pull Requests

3. Review operations
   - Select PR → Checkout
   - View diff of changed files
   - Add inline comments
   - Approve / Request Changes

4. Suggested Changes
   - Add code changes as suggestions
   - Reviewer can apply with a single click

Settings:
{
  "githubPullRequests.pullBranch": "prompt",
  "githubPullRequests.defaultMergeMethod": "squash",
  "githubPullRequests.showPullRequestNumberInTree": true
}
```

### 13.3 Pair Programming (Live Share)

```
Using VS Code Live Share:

Setup:
  1. Install extension: ms-vsliveshare.vsliveshare
  2. Sign in with GitHub / Microsoft account
  3. Click "Live Share" in the status bar → "Share"
  4. Send the sharing link to team members

Features:
  - Real-time collaborative code editing
  - Cursor position sharing
  - Terminal sharing
  - Local server sharing (port forwarding)
  - Debug session sharing
  - Voice calls (Live Share Audio extension)

Settings:
{
  "liveshare.presence": true,
  "liveshare.guestApprovalRequired": true,
  "liveshare.focusBehavior": "prompt",
  "liveshare.allowGuestTaskControl": false,
  "liveshare.allowGuestDebugControl": false
}
```

---

## 14. FAQ

### Q1: What is the difference between VS Code and VS Code Insiders?

**A:** Insiders is a preview version updated daily. You can try the latest features early, but stability is lower. The stable version is recommended for production development. Insiders can coexist as a separate app, so ideally install both and use them as needed.

### Q2: Should the `.vscode` folder be committed to the repository?

**A:** Use the following rules to decide.

| File | Commit | Reason |
|---------|---------|------|
| `settings.json` | Yes | Team common settings (formatter, etc.) |
| `extensions.json` | Yes | Share recommended extensions |
| `launch.json` | Yes | Share debug configuration |
| `*.code-snippets` | Yes | Project-specific snippets |
| `tasks.json` | Depends | Check for overlap with CI |

### Q3: What to do when Remote Development (SSH/WSL) is slow?

**A:** Check the following.
1. Set `remote.SSH.useLocalServer` to `true`
2. Disable unnecessary extensions on the remote side
3. Add `node_modules` etc. to `files.watcherExclude`
4. Configure `ControlMaster` for SSH connection reuse
5. Explicitly set `remote.SSH.remotePlatform` (skip OS auto-detection)

### Q4: What to do when VS Code uses too much memory?

**A:** Investigate and address with the following steps.

```bash
# Check with Process Explorer
# Command Palette → "Developer: Open Process Explorer"

# Solutions:
# 1. Review extensions (check startup time with Running Extensions)
# 2. Limit TypeScript server memory
"typescript.tsserver.maxTsServerMemory": 2048

# 3. Optimize file watching
"files.watcherExclude": { ... }

# 4. Auto-fold large files
"editor.foldingMaximumRegions": 5000

# 5. Disable minimap
"editor.minimap.enabled": false
```

### Q5: How to use different settings across multiple VS Code windows?

**A:** Use the profile feature. Each profile maintains independent settings, extensions, and snippets. You can launch with a specific profile using `code --profile "ProfileName" .`.

### Q6: How to use VS Code in portable mode?

**A:** Launch with `--user-data-dir` and `--extensions-dir` specified.

```bash
# Portable mode
code \
  --user-data-dir /path/to/portable/data \
  --extensions-dir /path/to/portable/extensions \
  /path/to/project
```

You can carry VS Code and its settings on a USB drive.

### Q7: How to use different formatters for specific file types?

**A:** Specify `editor.defaultFormatter` in language-specific settings.

```jsonc
{
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[python]": {
    "editor.defaultFormatter": "ms-python.black-formatter"
  },
  "[go]": {
    "editor.defaultFormatter": "golang.go"
  },
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer"
  }
}
```

### Q8: What to do when VS Code is slow opening large files (1MB or more)?

**A:** Adjust the following settings.

```jsonc
{
  // Large file handling
  "editor.largeFileOptimizations": true,
  // Tokenization limit (lines)
  "editor.maxTokenizationLineLength": 20000,
  // Disable minimap
  "editor.minimap.enabled": false,
  // Disable folding
  "editor.folding": false,
  // Disable word wrap
  "editor.wordWrap": "off"
}
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Jumping to advanced topics without mastering the basics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 15. Summary

| Item | Recommended Setting/Tool | Notes |
|------|-----------------|------|
| Installation | Homebrew / winget | Via package manager |
| Font | JetBrains Mono | Ligature support |
| Theme | One Dark Pro / GitHub Theme | Choose by preference |
| Formatter | Prettier | Enable `formatOnSave` |
| Linter | ESLint | Integrate with `codeActionsOnSave` |
| Git | GitLens + Git Graph | Essential level |
| AI | GitHub Copilot | Paid but high ROI |
| Settings sync | Settings Sync | GitHub account recommended |
| Profiles | Separate by purpose | Frontend / Backend / Data |
| Debugging | launch.json | Configure per language/framework |
| Tasks | tasks.json | Build / Test / Dev Server |
| Remote | Remote SSH / WSL / Tunnels | Choose based on use case |
| Performance | watcherExclude / search.exclude | For large projects |

---

## What to Read Next

- [01-terminal-setup.md](./01-terminal-setup.md) -- Building a terminal environment
- [02-git-config.md](./02-git-config.md) -- Detailed Git configuration
- [03-ai-tools.md](./03-ai-tools.md) -- Introduction to AI development tools

---

## References

1. **Visual Studio Code Documentation** -- https://code.visualstudio.com/docs -- Official documentation. The settings reference is the most accurate.
2. **VS Code Can Do That?!** (Burke Holland, Sarah Drasner) -- https://vscodecandothat.com/ -- A collection of little-known useful features.
3. **Awesome VS Code** -- https://github.com/viatsko/awesome-vscode -- Community-maintained collection of extensions and resources.
4. **VS Code Tips and Tricks** -- https://code.visualstudio.com/docs/getstarted/tips-and-tricks -- Official tips collection. Useful for beginners through advanced users.
5. **VS Code API Reference** -- https://code.visualstudio.com/api -- API reference for extension developers.
6. **Language Server Protocol** -- https://microsoft.github.io/language-server-protocol/ -- LSP specification. The foundation of VS Code's language support.
7. **Debug Adapter Protocol** -- https://microsoft.github.io/debug-adapter-protocol/ -- DAP specification. The foundation of debugging features.

# Version Managers

> A guide to managing programming language versions per project, enabling a unified development environment across the entire team.

## What You Will Learn

1. Node.js version management with nvm / fnm / Volta, and how to choose between them
2. Setting up and operating pyenv (Python) and rustup (Rust)
3. Integrated version management using mise (formerly rtx)
4. Version management for other languages such as Go, Java, and Ruby
5. Integrating version managers with CI/CD pipelines
6. Troubleshooting and migration guides


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Why Version Managers Are Necessary

### 1.1 Problems Without Version Management

```
World without version managers:

  Developer A (Node 18)          Developer B (Node 20)
  ┌──────────────────┐      ┌──────────────────┐
  │ npm install      │      │ npm install      │
  │   → Success ✅   │      │   → Failure ❌    │
  │                  │      │ (engines mismatch)│
  │ npm run build    │      │ npm run build    │
  │   → Success ✅   │      │   → Type error ❌ │
  └──────────────────┘      └──────────────────┘

  CI (Node 22)
  ┌──────────────────┐
  │ npm test         │
  │   → Failure ❌    │
  │ (API difference) │
  └──────────────────┘

  Everyone on different versions → "But it works on my machine..."
```

### 1.2 Benefits of Version Management

```
World unified by version managers:

  .node-version: "20.11.0"
         │
         ├──→ Developer A: fnm use → Node 20.11.0
         ├──→ Developer B: fnm use → Node 20.11.0
         ├──→ CI:          setup-node → Node 20.11.0
         └──→ Docker:      FROM node:20.11.0

  Everyone on the same version → 100% reproducibility

  Additional benefits:
  ┌─────────────────────────────────────────────┐
  │ 1. Shorter onboarding time                  │
  │    New members can start developing with    │
  │    cd project && fnm use                    │
  │                                             │
  │ 2. Easier bug reproduction                  │
  │    Same environment → same results          │
  │    guaranteed                               │
  │                                             │
  │ 3. Unified security patch application       │
  │    Update version file → automatically      │
  │    reflected for everyone                   │
  │                                             │
  │ 4. Parallel development across projects     │
  │    Develop Project A (Node 18) and          │
  │    Project B (Node 22) simultaneously       │
  └─────────────────────────────────────────────┘
```

### 1.3 Major Tool Comparison

| Tool | Target Language | Speed | .nvmrc Compatible | Shell Startup Impact | Auto-switch |
|------|----------------|-------|-------------------|---------------------|-------------|
| nvm | Node.js | Slow | Native | Large | Yes |
| fnm | Node.js | Fast | Yes | Small | Yes |
| Volta | Node.js (+npm/yarn) | Fast | Partial | None | Yes |
| pyenv | Python | Average | - | Medium | Yes |
| rustup | Rust | Fast | - | None | Yes |
| mise | Multi-language | Fast | Yes | Small | Yes |
| asdf | Multi-language | Slow | Plugin | Medium | Yes |
| goenv | Go | Average | - | Medium | Yes |
| sdkman | Java/Kotlin/Scala | Average | - | Medium | Yes |
| rbenv | Ruby | Average | - | Medium | Yes |

### 1.4 How Version Managers Work

```
Common mechanisms of version managers:

  1. PATH shim method (pyenv, rbenv)
  ┌────────────────────────────────────────────┐
  │ Insert a shim directory at the front of    │
  │ PATH                                       │
  │                                            │
  │ PATH=~/.pyenv/shims:$ORIGINAL_PATH         │
  │                                            │
  │ When python command is executed:           │
  │   ~/.pyenv/shims/python (shim script)      │
  │     → reads .python-version               │
  │     → forwards to the correct version of  │
  │       python                              │
  │     → ~/.pyenv/versions/3.12.3/bin/python │
  └────────────────────────────────────────────┘

  2. Dynamic PATH rewrite method (fnm, mise)
  ┌────────────────────────────────────────────┐
  │ Shell hook rewrites PATH on cd             │
  │                                            │
  │ When cd ~/project-a:                       │
  │   PATH=~/.fnm/node-versions/v20/bin:...   │
  │                                            │
  │ When cd ~/project-b:                       │
  │   PATH=~/.fnm/node-versions/v22/bin:...   │
  │                                            │
  │ Advantage: no shim overhead                │
  └────────────────────────────────────────────┘

  3. Proxy binary method (Volta)
  ┌────────────────────────────────────────────┐
  │ The node binary that Volta installs acts   │
  │ as a proxy                                 │
  │                                            │
  │ When ~/.volta/bin/node is executed:        │
  │   1. Check package.json in current dir     │
  │   2. Identify version from volta.node      │
  │      field                                 │
  │   3. Execute with the correct Node.js      │
  │      version                               │
  │                                            │
  │ Advantage: no shell hooks, zero startup    │
  │            impact                          │
  └────────────────────────────────────────────┘
```

---

## 2. Node.js Version Management

### 2.1 fnm (Fast Node Manager) -- Recommended

```bash
# ─── Installation ───
# macOS
brew install fnm
# Linux/macOS (curl)
curl -fsSL https://fnm.vercel.app/install | bash
# Windows
winget install Schniz.fnm
# Cargo (if Rust environment is available)
cargo install fnm

# ─── Shell configuration ───
# Add to ~/.zshrc
eval "$(fnm env --use-on-cd --shell zsh)"
# Add to ~/.bashrc
eval "$(fnm env --use-on-cd --shell bash)"
# Add to ~/.config/fish/config.fish
fnm env --use-on-cd --shell fish | source
# PowerShell (add to $PROFILE)
fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression

# ─── Basic operations ───
fnm list-remote              # List available versions
fnm install 20               # Install latest Node.js 20.x
fnm install 22               # Install latest Node.js 22.x
fnm install --lts            # Install latest LTS
fnm use 20                   # Switch in current shell
fnm default 20               # Set default version
fnm list                     # List installed versions
fnm current                  # Check current version
fnm uninstall 18             # Remove unnecessary version

# ─── Project configuration ───
echo "20" > .node-version    # Place at project root
# → auto-switch when entering the directory with cd (--use-on-cd)

# ─── Specifying a specific minor/patch version ───
echo "20.11.0" > .node-version
fnm install                  # Install version specified in .node-version
fnm use                      # Switch to version specified in .node-version
```

### 2.1.1 Advanced fnm Configuration

```bash
# ─── Customization via fnm environment variables ───
# Add to ~/.zshrc

# Change installation directory
export FNM_DIR="$HOME/.fnm"

# Auto-enable Corepack
export FNM_COREPACK_ENABLED="true"

# Version resolution strategy (also search parent directories for .node-version)
export FNM_RESOLVE_ENGINES="true"

# Log level setting
export FNM_LOGLEVEL="info"  # quiet, info, all, error

# Full configuration including all options
eval "$(fnm env --use-on-cd --version-file-strategy=recursive --corepack-enabled --shell zsh)"

# ─── Version file strategy ───
# recursive: recursively search from current to parent directories
# local: current directory only
eval "$(fnm env --use-on-cd --version-file-strategy=recursive --shell zsh)"

# ─── fnm completions ───
# Enable zsh completion
fnm completions --shell zsh > "${fpath[1]}/_fnm"
# bash completion
fnm completions --shell bash > /etc/bash_completion.d/fnm

# ─── Alias management ───
fnm alias 20.11.0 lts-iron   # Create custom alias
fnm alias 22.0.0 latest      # Alias for latest version
fnm alias list                # List aliases
fnm default lts-iron          # Set alias as default
```

### 2.1.2 fnm Benchmarks

```
Shell startup time comparison: fnm vs nvm

  With nvm loaded:
  $ time zsh -i -c exit
  real    0m0.523s    ← 500ms+ overhead
  user    0m0.312s
  sys     0m0.178s

  With fnm loaded:
  $ time zsh -i -c exit
  real    0m0.047s    ← under 50ms
  user    0m0.028s
  sys     0m0.015s

  Difference: approximately 10x speed difference
  (Opening terminal 100 times a day = 4.8 hours difference per year)

  Version switching speed comparison:
  ┌──────────┬─────────┬─────────┐
  │ Operation│   nvm   │   fnm   │
  ├──────────┼─────────┼─────────┤
  │ use      │  280ms  │   12ms  │
  │ install  │ 15.2s   │  14.8s  │ ← small difference due to download
  │ list     │  150ms  │    8ms  │
  │ current  │  120ms  │    3ms  │
  └──────────┴─────────┴─────────┘
```

### 2.2 nvm (Node Version Manager)

```bash
# ─── Installation ───
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# ─── Configuration automatically added to ~/.zshrc ───
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# ─── Basic operations ───
nvm install 20               # Install
nvm install --lts            # Latest LTS
nvm use 20                   # Switch
nvm alias default 20         # Set default
nvm ls                       # List installed versions
nvm ls-remote --lts          # List remote LTS versions
nvm uninstall 18             # Remove unnecessary version

# ─── .nvmrc ───
echo "20" > .nvmrc
nvm use                      # Use version from .nvmrc

# ─── Auto-switch script (add to ~/.zshrc) ───
autoload -U add-zsh-hook
load-nvmrc() {
  local nvmrc_path="$(nvm_find_nvmrc)"
  if [ -n "$nvmrc_path" ]; then
    local nvmrc_node_version=$(nvm version "$(cat "${nvmrc_path}")")
    if [ "$nvmrc_node_version" = "N/A" ]; then
      nvm install
    elif [ "$nvmrc_node_version" != "$(nvm version)" ]; then
      nvm use
    fi
  fi
}
add-zsh-hook chpwd load-nvmrc
load-nvmrc
```

### 2.2.1 nvm Lazy Load Optimization

```bash
# Lazy load configuration to improve nvm shell startup time
# Add to ~/.zshrc (use instead of standard nvm configuration)

export NVM_DIR="$HOME/.nvm"

# Functions that lazy-load nvm
lazy_load_nvm() {
  unset -f nvm node npm npx yarn pnpm corepack
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
}

# Load on first command invocation
nvm() { lazy_load_nvm; nvm "$@"; }
node() { lazy_load_nvm; node "$@"; }
npm() { lazy_load_nvm; npm "$@"; }
npx() { lazy_load_nvm; npx "$@"; }
yarn() { lazy_load_nvm; yarn "$@"; }
pnpm() { lazy_load_nvm; pnpm "$@"; }
corepack() { lazy_load_nvm; corepack "$@"; }

# Effect:
# - Shell startup time: 500ms → 50ms (defer loading of nvm itself)
# - Only loads once on first node command execution
# - Downside: first command is slightly slower (about 500ms additional delay)
```

### 2.2.2 Preserving Packages When Migrating from nvm

```bash
# Carry over globally installed packages to a new version with nvm
nvm install 22 --reinstall-packages-from=20

# Migration steps from nvm to fnm
# 1. Check current versions
nvm ls
#   v18.19.1
#   v20.11.0
# → default -> 20

# 2. Install fnm
brew install fnm

# 3. Replace shell configuration
# Remove nvm-related lines from ~/.zshrc and add:
eval "$(fnm env --use-on-cd --shell zsh)"

# 4. Install the same versions
fnm install 18
fnm install 20
fnm default 20

# 5. .nvmrc can be used as-is (fnm can read .nvmrc)

# 6. Remove nvm
rm -rf ~/.nvm
# Remove NVM_DIR-related lines from ~/.zshrc
```

### 2.3 Volta

```bash
# ─── Installation ───
# macOS / Linux
curl https://get.volta.sh | bash
# Windows
# Download .msi from https://github.com/volta-cli/volta/releases

# ─── Basic operations ───
volta install node@20        # Install Node.js
volta install node@latest    # Install latest version
volta install npm@10         # Pin npm version
volta install yarn@4         # Pin yarn version
volta install pnpm@9         # Pin pnpm version

# ─── Project pinning (recorded in package.json) ───
volta pin node@20
volta pin npm@10
volta pin yarn@4

# Automatically appended to package.json:
# {
#   "volta": {
#     "node": "20.11.0",
#     "npm": "10.2.4",
#     "yarn": "4.1.0"
#   }
# }

# ─── Installing global tools ───
volta install typescript      # Make tsc command globally available
volta install @angular/cli    # Make ng command globally available
volta install create-react-app

# ─── Information ───
volta list                   # List installed tools
volta list all               # List all versions
volta which node             # Path to node used in current project
```

### 2.3.1 Volta's Special Features

```bash
# ─── Volta's automatic project detection ───
# When entering a directory with a volta field in package.json,
# that version of Node.js is automatically used

# Project A (Node 18)
$ cd ~/projects/legacy-app
$ node --version
v18.19.1

# Project B (Node 22)
$ cd ~/projects/new-app
$ node --version
v22.0.0

# No shell hooks needed — Volta's own node binary acts as a proxy

# ─── Volta's toolchain management ───
# Volta can also pin the version of the package manager
volta pin node@20.11.0
volta pin npm@10.2.4
volta pin yarn@4.1.0

# If team members use Volta,
# they can start developing with the same versions immediately after clone

# ─── Integration with package.json engines field ───
# Volta also references the engines field, but
# the volta field takes priority
{
  "engines": {
    "node": ">=20.0.0"
  },
  "volta": {
    "node": "20.11.0"
  }
}

# ─── Volta hooks ───
# Additional configuration possible via ~/.volta/hooks.json
{
  "node": {
    "index": {
      "prefix": "https://your-mirror.example.com/node/"
    }
  }
}
```

### 2.4 Node.js Version Manager Selection Flow

```
Which Node.js version manager should you use?

                    START
                      │
                      ▼
              Team development? ──── No ──→ fnm (lightweight & fast)
                   │
                  Yes
                   │
                   ▼
          Also want to pin
          npm/yarn versions? ──── Yes ──→ Volta
                   │                        (managed in package.json)
                  No
                   │
                   ▼
          Existing .nvmrc
          files? ──── Yes ──→ fnm (.nvmrc compatible + fast)
                   │
                  No
                   │
                   ▼
          Multi-language project? ──── Yes ──→ mise (unified management)
                   │
                  No
                   │
                   ▼
              fnm (default recommendation)
```

### 2.5 Understanding the Node.js LTS Schedule

```
Node.js release schedule:

  Version   │ Status      │ LTS Start  │ EOL
  ──────────┼─────────────┼────────────┼──────────
  18.x      │ Maintenance │ 2022-10    │ 2025-04
  20.x      │ LTS Active  │ 2023-10    │ 2026-04
  22.x      │ LTS Active  │ 2024-10    │ 2027-04
  24.x      │ Current     │ 2025-10    │ 2028-04

  Even-numbered versions = eligible for LTS
  Odd-numbered versions = Current only (short-lived)

  Recommended strategy:
  ┌─────────────────────────────────────────────┐
  │ Production: use the latest Active LTS        │
  │ Development: test Active LTS + next Current  │
  │ Legacy: Maintenance LTS (patches only)       │
  │                                              │
  │ Timing for version upgrades:                 │
  │   Start validation 1-2 months after          │
  │   new LTS release                            │
  │   Migrate after confirming ecosystem         │
  │   compatibility                              │
  └─────────────────────────────────────────────┘
```

---

## 3. Python Version Management (pyenv)

### 3.1 Setup

```bash
# ─── Installation ───
# macOS
brew install pyenv pyenv-virtualenv

# Linux (Ubuntu/Debian)
curl https://pyenv.run | bash

# Linux (build dependencies must be installed)
sudo apt-get update && sudo apt-get install -y \
  make build-essential libssl-dev zlib1g-dev \
  libbz2-dev libreadline-dev libsqlite3-dev wget curl llvm \
  libncursesw5-dev xz-utils tk-dev libxml2-dev libxmlsec1-dev \
  libffi-dev liblzma-dev

# ─── Shell configuration (~/.zshrc) ───
export PYENV_ROOT="$HOME/.pyenv"
[[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"
eval "$(pyenv virtualenv-init -)"

# ─── For bash (~/.bashrc) ───
export PYENV_ROOT="$HOME/.pyenv"
command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"
eval "$(pyenv virtualenv-init -)"

# ─── Install build dependencies (macOS) ───
brew install openssl readline sqlite3 xz zlib tcl-tk

# ─── Basic operations ───
pyenv install --list | grep '3.12'   # Available versions
pyenv install --list | grep '3.13'   # Check latest versions
pyenv install 3.12.3                  # Install
pyenv global 3.12.3                   # Set global default
pyenv local 3.12.3                    # Pin to project (.python-version)
pyenv versions                        # List installed versions
pyenv version                         # Current version
pyenv uninstall 3.11.0                # Remove unnecessary version

# ─── Virtual environments ───
pyenv virtualenv 3.12.3 myproject-env
pyenv activate myproject-env
pyenv deactivate
```

### 3.2 pyenv Build Troubleshooting

```bash
# ─── Common build errors and solutions on macOS ───

# Error: "zlib not available"
CFLAGS="-I$(brew --prefix zlib)/include" \
LDFLAGS="-L$(brew --prefix zlib)/lib" \
pyenv install 3.12.3

# Error: "openssl not found"
CONFIGURE_OPTS="--with-openssl=$(brew --prefix openssl@3)" \
pyenv install 3.12.3

# Comprehensive environment variable settings for macOS Sonoma and later
export LDFLAGS="-L$(brew --prefix openssl@3)/lib -L$(brew --prefix readline)/lib -L$(brew --prefix zlib)/lib"
export CPPFLAGS="-I$(brew --prefix openssl@3)/include -I$(brew --prefix readline)/include -I$(brew --prefix zlib)/include"
export PKG_CONFIG_PATH="$(brew --prefix openssl@3)/lib/pkgconfig:$(brew --prefix readline)/lib/pkgconfig:$(brew --prefix zlib)/lib/pkgconfig"
pyenv install 3.12.3

# ─── Common build errors on Linux ───

# Error: "No module named '_ctypes'"
sudo apt-get install libffi-dev
pyenv install 3.12.3

# Error: "ModuleNotFoundError: No module named '_lzma'"
sudo apt-get install liblzma-dev
pyenv install 3.12.3

# Error: "WARNING: The Python tkinter extension was not compiled"
sudo apt-get install tk-dev
pyenv install 3.12.3

# ─── Optimized build ───
# Enable profile-guided optimization (PGO) with PROFILE_TASK
PYTHON_CONFIGURE_OPTS="--enable-optimizations --with-lto" \
PYTHON_CFLAGS="-march=native -mtune=native" \
pyenv install 3.12.3

# ─── Debug build ───
# For investigating memory leaks or segfaults
pyenv install --debug 3.12.3
```

### 3.3 Advanced pyenv-virtualenv Usage

```bash
# ─── Creating and managing virtual environments ───
pyenv virtualenv 3.12.3 myproject-3.12    # Virtual environment with version name
pyenv virtualenvs                          # List virtual environments
pyenv virtualenv-delete myproject-3.12     # Delete virtual environment

# ─── Auto-activation per project ───
cd ~/projects/myproject
pyenv local myproject-3.12
# → "myproject-3.12" is written to .python-version
# → the virtual environment automatically activates when entering this directory

# ─── Testing across multiple Python versions ───
# Use with tox or nox for multi-version testing
pyenv install 3.11.8
pyenv install 3.12.3
pyenv install 3.13.0
pyenv local 3.12.3 3.11.8 3.13.0  # Set multiple versions

# tox.ini
# [tox]
# envlist = py311, py312, py313
# [testenv]
# commands = pytest

# ─── Using pyenv together with uv ───
# Manage Python versions with pyenv and packages with uv
pyenv local 3.12.3
uv venv                      # Create virtual environment using pyenv's Python
uv pip install -r requirements.txt
```

### 3.4 Python Version Management with uv

```bash
# uv can also be used as an alternative to pyenv (recommended from 2025 onward)
# Capable of installing and managing Python itself

# ─── Installing Python ───
uv python install 3.12       # Install Python 3.12
uv python install 3.11 3.12 3.13  # Install multiple versions at once
uv python list                # List available versions
uv python find 3.12           # Show path to installed 3.12

# ─── Project pinning ───
uv python pin 3.12            # Generate .python-version

# ─── Differences from pyenv ───
# pyenv: builds from source (requires build dependencies, takes time)
# uv:    downloads pre-built binaries (completes in seconds)
#        → uses binaries from the python-build-standalone project

# ─── Unified management of Python + packages with uv ───
uv init my-project            # Initialize project
cd my-project
uv python pin 3.12            # Pin Python version
uv add requests flask         # Add packages
uv run python main.py         # Execute inside virtual environment
```

---

## 4. Rust Version Management (rustup)

### 4.1 Setup

```bash
# ─── Installation ───
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Options during installation
# 1) Proceed with standard installation (default)
# 2) Customize installation
# 3) Cancel installation
# → Usually select 1

# ─── Shell configuration (automatically added, but verify) ───
# ~/.zshrc or ~/.bashrc
source "$HOME/.cargo/env"

# ─── Basic operations ───
rustup show                          # Current toolchain
rustup update                        # Update all toolchains
rustup default stable                # Set default
rustup default nightly               # Set nightly as default
rustup toolchain install nightly     # Install nightly
rustup toolchain install 1.77.0     # Install specific version
rustup toolchain list                # List installed toolchains
rustup toolchain uninstall nightly   # Remove unnecessary toolchain

# ─── Project pinning ───
# rust-toolchain.toml (project root)
cat << 'EOF' > rust-toolchain.toml
[toolchain]
channel = "1.77.0"
components = ["rustfmt", "clippy"]
targets = ["wasm32-unknown-unknown"]
EOF

# ─── Component management ───
rustup component add rustfmt         # Formatter
rustup component add clippy          # Linter
rustup component add rust-analyzer   # LSP
rustup component add rust-src        # Source code (for IDE completion)
rustup component add llvm-tools      # LLVM tools (for coverage, etc.)
rustup component add miri            # Undefined behavior detector (nightly only)
rustup component list                # List available components
```

### 4.2 Advanced rustup Usage

```bash
# ─── Cross-compilation ───
# Adding target platforms
rustup target add x86_64-unknown-linux-musl     # Statically linked Linux
rustup target add aarch64-unknown-linux-gnu     # ARM64 Linux
rustup target add wasm32-unknown-unknown        # WebAssembly
rustup target add aarch64-apple-darwin          # Apple Silicon
rustup target add x86_64-pc-windows-msvc        # Windows

# Running cross-compilation
cargo build --target x86_64-unknown-linux-musl

# ─── Using nightly features ───
# Use nightly for specific files
rustup run nightly cargo build
rustup run nightly cargo +nightly fmt

# Using nightly-only features in a project
cat << 'EOF' > rust-toolchain.toml
[toolchain]
channel = "nightly-2024-03-15"
components = ["rustfmt", "clippy", "miri", "rust-src"]
EOF

# ─── Proxy configuration for rustup ───
# Configuration for corporate proxy environments
export RUSTUP_DIST_SERVER="https://your-mirror.example.com/rustup"
export RUSTUP_UPDATE_ROOT="https://your-mirror.example.com/rustup/rustup"

# ─── rustup self commands ───
rustup self update              # Update rustup itself
rustup self uninstall           # Remove rustup and all toolchains

# ─── Overrides ───
# Use a different toolchain for a specific directory
rustup override set nightly     # For current directory
rustup override list            # List overrides
rustup override unset           # Remove override
```

### 4.3 Detailed rust-toolchain.toml Configuration

```toml
# rust-toolchain.toml - place at project root

[toolchain]
# Channel specification (one of the following)
channel = "1.77.0"          # Specific version
# channel = "stable"        # Latest stable (not recommended: low reproducibility)
# channel = "nightly"       # Latest nightly
# channel = "nightly-2024-03-15"  # Date-specified nightly

# Required components
components = [
  "rustfmt",        # Code formatter
  "clippy",         # Linter
  "rust-analyzer",  # LSP server
  "rust-src",       # Source code (required for IDE completion)
]

# Cross-compilation targets
targets = [
  "x86_64-unknown-linux-musl",
  "wasm32-unknown-unknown",
  "aarch64-apple-darwin",
]

# Profile (minimal, default, complete)
profile = "default"
```

---

## 5. mise (Unified Version Manager)

### 5.1 Setup

```bash
# ─── Installation ───
# macOS
brew install mise
# Linux (recommended)
curl https://mise.run | sh
# npm
npm install -g @jdx/mise
# cargo
cargo install mise

# ─── Shell configuration ───
# ~/.zshrc
eval "$(mise activate zsh)"
# ~/.bashrc
eval "$(mise activate bash)"
# ~/.config/fish/config.fish
mise activate fish | source

# ─── Basic operations ───
mise use node@20              # Install & configure Node.js
mise use python@3.12          # Install & configure Python
mise use go@1.22              # Install & configure Go
mise use java@21              # Install & configure Java
mise use ruby@3.3             # Install & configure Ruby

# ─── Project configuration (.mise.toml) ───
cat << 'EOF' > .mise.toml
[tools]
node = "20"
python = "3.12"
terraform = "1.7"

[env]
NODE_ENV = "development"
DATABASE_URL = "postgresql://localhost:5432/mydb"
EOF

# mise can also read .nvmrc, .python-version, .tool-versions
mise ls                       # List installed tools
mise outdated                 # Show tools with available updates
mise prune                    # Remove unused versions
```

### 5.2 mise Architecture

```
How mise works:

  .mise.toml / .nvmrc / .tool-versions
         │
         ▼
  ┌──────────────────────────────────────┐
  │  mise activate (shell hook)          │
  │                                      │
  │  On cd command:                      │
  │    1. Search for config files        │
  │    2. Identify required versions     │
  │    3. Dynamically rewrite PATH       │
  │                                      │
  │  ~/.local/share/mise/installs/       │
  │  ├── node/                           │
  │  │   ├── 18.19.0/                    │
  │  │   └── 20.11.0/ ← added to PATH   │
  │  ├── python/                         │
  │  │   └── 3.12.3/                     │
  │  └── go/                             │
  │      └── 1.22.0/                     │
  └──────────────────────────────────────┘

  Config file priority:
  ┌──────────────────────────────────────┐
  │ 1. .mise.local.toml  (add to         │
  │    .gitignore)                       │
  │ 2. .mise.toml                        │
  │ 3. .mise/config.toml                 │
  │ 4. .tool-versions   (asdf compat)    │
  │ 5. .node-version    (fnm/nvm compat) │
  │ 6. .python-version  (pyenv compat)   │
  │ 7. ~/.config/mise/config.toml        │
  │    (global)                          │
  └──────────────────────────────────────┘
```

### 5.3 Advanced mise Configuration

```toml
# .mise.toml - configuration example using all features

# Tool version specification
[tools]
node = "20"                    # Major version (automatically selects latest patch)
python = "3.12.3"              # Full version specification
go = "latest"                  # Always use latest
rust = "1.77.0"                # Rust (integrates with rustup)
terraform = "1.7"              # HashiCorp Terraform
kubectl = "1.29"               # Kubernetes CLI
awscli = "2"                   # AWS CLI v2
java = "temurin-21"            # Eclipse Temurin JDK 21

# Environment variable settings
[env]
NODE_ENV = "development"
PYTHONDONTWRITEBYTECODE = "1"
RUST_BACKTRACE = "1"
LOG_LEVEL = "debug"

# Load .env file
# mise can also automatically load .env files
_.file = ".env"
_.path = "./node_modules/.bin"  # Add to PATH

# Task definitions (mise tasks)
[tasks.dev]
run = "npm run dev"
description = "Start development server"

[tasks.test]
run = "npm test"
description = "Run tests"

[tasks.lint]
run = ["npm run lint", "npm run typecheck"]
description = "Lint & type check"

[tasks.setup]
run = """
npm install
cp .env.example .env
npm run db:migrate
"""
description = "Initial project setup"
```

```bash
# ─── Running mise tasks ───
mise run dev                  # Start development server
mise run test                 # Run tests
mise run lint                 # Lint & type check
mise tasks                    # List available tasks

# ─── mise global configuration ───
# ~/.config/mise/config.toml
cat << 'EOF' > ~/.config/mise/config.toml
[tools]
node = "20"          # Default Node.js version
python = "3.12"      # Default Python version

[settings]
experimental = true   # Enable experimental features
verbose = false       # Disable verbose output
asdf_compat = true    # asdf compatibility mode

[env]
EDITOR = "code --wait"
EOF
```

### 5.4 Migrating from asdf

```bash
# mise can be used as a drop-in replacement for asdf

# Can read asdf's .tool-versions directly
# .tool-versions
# nodejs 20.11.0
# python 3.12.3
# golang 1.22.0

# Migration steps from asdf to mise
# 1. Install mise
brew install mise

# 2. Update shell configuration
# Remove asdf-related lines from ~/.zshrc
# Add:
eval "$(mise activate zsh)"

# 3. Enable asdf compatibility mode
mise settings set asdf_compat true

# 4. .tool-versions can be used as-is
# (mise automatically reads .tool-versions)
# No plugin installation needed

# 5. Verify
mise ls                       # Shows tools previously managed by asdf
node --version
python --version

# 6. Optionally migrate .tool-versions → .mise.toml
# .tool-versions:
# nodejs 20.11.0
# python 3.12.3
#
# → .mise.toml:
# [tools]
# node = "20.11.0"
# python = "3.12.3"

# 7. Uninstall asdf
brew uninstall asdf
rm -rf ~/.asdf
```

---

## 6. Go Version Management

### 6.1 Version Management with goenv

```bash
# ─── Installation ───
git clone https://github.com/go-nv/goenv.git ~/.goenv

# ─── Shell configuration (~/.zshrc) ───
export GOENV_ROOT="$HOME/.goenv"
export PATH="$GOENV_ROOT/bin:$PATH"
eval "$(goenv init -)"
export PATH="$GOROOT/bin:$PATH"
export PATH="$GOPATH/bin:$PATH"

# ─── Basic operations ───
goenv install --list           # Available versions
goenv install 1.22.0           # Install
goenv global 1.22.0            # Set global default
goenv local 1.22.0             # Pin to project (.go-version)
goenv versions                 # List installed versions
```

### 6.2 Go Version Management with mise (Recommended)

```bash
# Using mise instead of goenv is simpler
mise use go@1.22               # Install & configure Go 1.22

# .mise.toml
# [tools]
# go = "1.22"

# Verify consistency with go directive in go.mod
# go.mod:
# module example.com/myproject
# go 1.22
```

---

## 7. Java Version Management (SDKMAN / mise)

### 7.1 SDKMAN

```bash
# ─── Installation ───
curl -s "https://get.sdkman.io" | bash

# ─── Basic operations ───
sdk list java                   # List available versions
sdk install java 21.0.2-tem    # Eclipse Temurin JDK 21
sdk install java 21.0.2-graal  # GraalVM CE 21
sdk install java 17.0.10-tem   # JDK 17 (LTS)
sdk use java 21.0.2-tem        # Switch in current shell
sdk default java 21.0.2-tem    # Set default
sdk current java                # Current version

# ─── Project pinning with .sdkmanrc ───
cat << 'EOF' > .sdkmanrc
java=21.0.2-tem
gradle=8.5
maven=3.9.6
EOF

sdk env                         # Apply settings from .sdkmanrc
sdk env install                 # Install tools from .sdkmanrc

# ─── Enable auto-switch ───
sdk config
# Set sdkman_auto_env=true
```

### 7.2 Java Management with mise

```bash
# Use mise as an alternative to SDKMAN
mise use java@temurin-21       # Temurin JDK 21
mise use java@corretto-21      # Amazon Corretto 21
mise use java@graalvm-21       # GraalVM CE 21

# .mise.toml
# [tools]
# java = "temurin-21"

# Available distributions
mise ls-remote java | head -20
# temurin-21.0.2
# corretto-21.0.2
# graalvm-21.0.2
# zulu-21.0.2
# liberica-21.0.2
```

---

## 8. Ruby Version Management (rbenv)

### 8.1 Setup

```bash
# ─── Installation ───
# macOS
brew install rbenv ruby-build

# Linux
git clone https://github.com/rbenv/rbenv.git ~/.rbenv
git clone https://github.com/rbenv/ruby-build.git ~/.rbenv/plugins/ruby-build

# ─── Shell configuration (~/.zshrc) ───
eval "$(rbenv init - zsh)"

# ─── Basic operations ───
rbenv install --list           # Available versions
rbenv install 3.3.0            # Install
rbenv global 3.3.0             # Set global default
rbenv local 3.3.0              # Pin to project (.ruby-version)
rbenv versions                 # List installed versions
rbenv rehash                   # Rebuild shims

# ─── Alternative with mise (recommended) ───
mise use ruby@3.3              # Install & configure Ruby 3.3
```

---

## 9. Team Operation Best Practices

### 9.1 Project Template

```bash
# Files to place at the project root
my-project/
├── .node-version          # Node.js version (fnm/nvm compatible)
├── .nvmrc                 # nvm compatible (= same value as .node-version)
├── .python-version        # For pyenv
├── .mise.toml             # For mise (unified)
├── .mise.local.toml       # Local config (add to .gitignore)
├── rust-toolchain.toml    # For Rust
├── .go-version            # For Go (goenv)
├── .ruby-version          # For Ruby (rbenv)
├── .sdkmanrc              # For Java (SDKMAN)
└── package.json           # Specify here for Volta
```

### 9.2 Version File Synchronization Script

```bash
#!/usr/bin/env bash
# scripts/sync-versions.sh
# Centrally manage version files for each tool

set -euo pipefail

# Load from definition file
NODE_VERSION="20.11.0"
PYTHON_VERSION="3.12.3"

# Node.js
echo "$NODE_VERSION" > .node-version
echo "$NODE_VERSION" > .nvmrc

# Python
echo "$PYTHON_VERSION" > .python-version

# mise
cat > .mise.toml << EOF
[tools]
node = "$NODE_VERSION"
python = "$PYTHON_VERSION"
EOF

# Update engines field in package.json
# (requires jq)
if command -v jq &> /dev/null && [ -f package.json ]; then
  jq --arg node "$NODE_VERSION" \
     '.engines.node = ">=" + ($node | split(".") | .[0] + ".0.0")' \
     package.json > package.json.tmp && mv package.json.tmp package.json
fi

echo "Version files synchronized"
echo "  Node.js: $NODE_VERSION"
echo "  Python:  $PYTHON_VERSION"
```

### 9.3 New Member Onboarding Script

```bash
#!/usr/bin/env bash
# scripts/setup-dev.sh
# Script to be run by new members first

set -euo pipefail

echo "=== Starting development environment setup ==="

# ─── Check version managers ───
check_command() {
  if ! command -v "$1" &> /dev/null; then
    echo "❌ $1 not found"
    echo "   Install: $2"
    return 1
  else
    echo "✅ $1 $(eval "$1 --version 2>&1 | head -1")"
  fi
}

echo ""
echo "--- Tool check ---"
check_command fnm "brew install fnm" || MISSING=true
check_command pyenv "brew install pyenv" || MISSING=true

if [ "${MISSING:-}" = "true" ]; then
  echo ""
  echo "Please install missing tools and run again"
  exit 1
fi

# ─── Install Node.js version ───
echo ""
echo "--- Node.js setup ---"
if [ -f .node-version ]; then
  NODE_VER=$(cat .node-version)
  echo "  .node-version: $NODE_VER"
  fnm install "$NODE_VER"
  fnm use "$NODE_VER"
  echo "  ✅ Using Node.js $(node --version)"
fi

# ─── Install Python version ───
echo ""
echo "--- Python setup ---"
if [ -f .python-version ]; then
  PYTHON_VER=$(cat .python-version)
  echo "  .python-version: $PYTHON_VER"
  pyenv install -s "$PYTHON_VER"
  pyenv local "$PYTHON_VER"
  echo "  ✅ Using Python $(python --version)"
fi

# ─── Install dependencies ───
echo ""
echo "--- Dependency installation ---"
if [ -f package.json ]; then
  echo "  Running npm ci..."
  npm ci
  echo "  ✅ Node.js dependencies installed"
fi

if [ -f requirements.txt ]; then
  echo "  Running pip install..."
  pip install -r requirements.txt
  echo "  ✅ Python dependencies installed"
fi

echo ""
echo "=== Setup complete ==="
```

### 9.4 Unifying with CI

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Auto-detect .node-version / .nvmrc
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.node-version'
          cache: 'npm'  # Enable npm cache

      # Auto-detect .python-version
      - uses: actions/setup-python@v5
        with:
          python-version-file: '.python-version'
          cache: 'pip'  # Enable pip cache

      - run: npm ci
      - run: npm test
```

### 9.4.1 Rust Setup in CI

```yaml
# .github/workflows/rust-ci.yml
name: Rust CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Auto-detect rust-toolchain.toml
      - uses: dtolnay/rust-toolchain@stable
        # Automatically loaded if rust-toolchain.toml exists

      # Rust build cache
      - uses: Swatinem/rust-cache@v2
        with:
          cache-on-failure: true

      - run: cargo test
      - run: cargo clippy -- -D warnings
      - run: cargo fmt -- --check
```

### 9.4.2 mise Setup in CI

```yaml
# .github/workflows/mise-ci.yml
name: CI with mise
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Set up all tools at once with mise
      - uses: jdx/mise-action@v2
        with:
          experimental: true

      # mise reads .mise.toml and installs all tools
      - run: node --version
      - run: python --version
      - run: npm ci
      - run: npm test
```

### 9.5 Version Unification with Docker

```dockerfile
# Dockerfile
# Receive .node-version value as a build argument

ARG NODE_VERSION=20.11.0
FROM node:${NODE_VERSION}-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY . .
CMD ["node", "server.js"]
```

```bash
# Read .node-version from docker-compose.yml
# docker-compose.yml
# services:
#   app:
#     build:
#       context: .
#       args:
#         NODE_VERSION: ${NODE_VERSION:-20.11.0}

# Reference .node-version at build time
NODE_VERSION=$(cat .node-version) docker compose build
```

### 9.6 Automated Version Updates with Renovate / Dependabot

```json
// renovate.json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:base"],
  "regexManagers": [
    {
      "fileMatch": ["^\\.node-version$"],
      "matchStrings": ["(?<currentValue>\\d+\\.\\d+\\.\\d+)"],
      "depNameTemplate": "node",
      "datasourceTemplate": "node-version",
      "versioningTemplate": "node"
    },
    {
      "fileMatch": ["^\\.python-version$"],
      "matchStrings": ["(?<currentValue>\\d+\\.\\d+\\.\\d+)"],
      "depNameTemplate": "python",
      "datasourceTemplate": "docker",
      "packageNameTemplate": "python"
    },
    {
      "fileMatch": ["^rust-toolchain\\.toml$"],
      "matchStrings": ["channel\\s*=\\s*\"(?<currentValue>[^\"]+)\""],
      "depNameTemplate": "rust",
      "datasourceTemplate": "docker",
      "packageNameTemplate": "rust"
    }
  ]
}
```

---

## 10. Migrating Between Version Managers

### 10.1 nvm to fnm Migration Checklist

```
nvm → fnm migration checklist:

  ☐ 1. Record current nvm version list
       nvm ls > ~/nvm-versions-backup.txt

  ☐ 2. Record global package list
       nvm use default
       npm list -g --depth=0 > ~/global-packages-backup.txt

  ☐ 3. Install fnm
       brew install fnm

  ☐ 4. Update shell configuration (~/.zshrc)
       # Remove:
       # export NVM_DIR="$HOME/.nvm"
       # [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
       # (also remove auto-switch script)
       # Add:
       eval "$(fnm env --use-on-cd --shell zsh)"

  ☐ 5. Install required versions with fnm
       fnm install 18
       fnm install 20
       fnm default 20

  ☐ 6. Existing .nvmrc does not need to be changed (fnm can read it)

  ☐ 7. Reinstall global packages (only if needed)
       npm install -g typescript @angular/cli

  ☐ 8. Verify operation
       cd ~/projects/project-a && node --version
       cd ~/projects/project-b && node --version

  ☐ 9. Uninstall nvm
       rm -rf ~/.nvm
       # Remove remaining NVM settings from ~/.zshrc

  ☐ 10. Notify team members of migration
```

### 10.2 asdf to mise Migration Checklist

```
asdf → mise migration checklist:

  ☐ 1. Record current asdf tool list
       asdf list > ~/asdf-tools-backup.txt

  ☐ 2. Install mise
       brew install mise

  ☐ 3. Update shell configuration (~/.zshrc)
       # Remove:
       # . $(brew --prefix asdf)/libexec/asdf.sh
       # Add:
       eval "$(mise activate zsh)"

  ☐ 4. Enable asdf compatibility mode
       mise settings set asdf_compat true

  ☐ 5. .tool-versions can be used as-is
       # mise automatically reads .tool-versions
       # No plugin installation required

  ☐ 6. Verify operation
       mise ls        # List managed tools
       node --version
       python --version

  ☐ 7. (Optional) Convert .tool-versions → .mise.toml
       # .tool-versions:
       # nodejs 20.11.0
       # python 3.12.3
       #
       # → .mise.toml:
       # [tools]
       # node = "20.11.0"
       # python = "3.12.3"

  ☐ 8. Uninstall asdf
       brew uninstall asdf
       rm -rf ~/.asdf
```

### 10.3 Migrating from Individual Tools to mise

```bash
# Consolidate multiple version managers into a single mise

# Before:
#   fnm (Node.js) + pyenv (Python) + goenv (Go) + rbenv (Ruby)
#
# After:
#   mise (all)

# ─── Check current versions ───
echo "Node.js: $(node --version)"
echo "Python: $(python --version)"
echo "Go: $(go version)"
echo "Ruby: $(ruby --version)"

# ─── Install mise ───
brew install mise

# ─── Consolidate shell configuration ───
# Remove all of the following from ~/.zshrc:
# eval "$(fnm env --use-on-cd --shell zsh)"
# eval "$(pyenv init -)"
# eval "$(pyenv virtualenv-init -)"
# eval "$(goenv init -)"
# eval "$(rbenv init - zsh)"

# Replace with:
# eval "$(mise activate zsh)"

# ─── Install required versions ───
mise use --global node@20
mise use --global python@3.12
mise use --global go@1.22
mise use --global ruby@3.3

# ─── Create project .mise.toml ───
cat << 'EOF' > .mise.toml
[tools]
node = "20.11.0"
python = "3.12.3"
go = "1.22.0"
ruby = "3.3.0"
EOF

# ─── Verify operation ───
mise ls                       # List all tools
node --version
python --version
go version
ruby --version

# ─── Remove old tools ───
brew uninstall fnm
brew uninstall pyenv pyenv-virtualenv
rm -rf ~/.goenv
brew uninstall rbenv
```

---

## 11. Anti-patterns

### 11.1 Installing Directly to the System Global

```
❌ Anti-pattern: installing directly with brew install node

Problems:
  - Cannot switch versions between projects
  - Conflicts with version managers
  - May require sudo

✅ Correct approach:
  - Install via version manager
  - Remove Homebrew's node/python
  - brew uninstall node python
```

### 11.2 Not Committing Version Specification Files

```
❌ Anti-pattern: adding .node-version to .gitignore

Problems:
  - Team members use different versions
  - Mismatch between CI and development environment
  - "Works on my machine" problem recurs

✅ Correct approach:
  - Always commit .node-version and .python-version
  - Also set the engines field in package.json
  - Reference the same version specification files in CI
```

### 11.3 Specifying Only the Major Version

```
❌ Anti-pattern: writing only "20" in .node-version

Problems:
  - Developer A uses 20.10.0
  - Developer B uses 20.11.0
  - Subtle bugs from patch version differences
  (e.g., TLS behavior changes, V8 engine optimization differences)

✅ Correct approach:
  - Specify down to the patch version: "20.11.0"
  - Use a range in the engines field: ">=20.11.0 <21"
  - Match exactly with the production environment
```

### 11.4 Mixing Multiple Version Managers

```
❌ Anti-pattern: using fnm and nvm simultaneously

Problems:
  - PATH priority is undefined
  - Unpredictable which node will be used
  - Shell startup time doubles
  - Difficult to debug

✅ Correct approach:
  - Unify the entire team on one tool
  - Keep the transition period short (within 2 weeks)
  - Completely remove old tools

Verification:
  which -a node
  # Should show only one result
  # Multiple results indicate a conflict
```

### 11.5 Not Updating the Version Manager

```
❌ Anti-pattern: leaving the version manager untouched after installation

Problems:
  - Cannot install new runtime versions
  - Security fixes are not applied
  - Compatibility issues with the latest OS

✅ Correct approach:
  Regular update schedule:
  - Homebrew: brew upgrade fnm mise (monthly)
  - rustup: rustup self update (automatic)
  - nvm: re-run the nvm installation script
  - mise: mise self-update (built-in feature)
```

---

## 12. Troubleshooting

### 12.1 "command not found" Error

```bash
# ─── When node is not found ───

# 1. Check if the version manager is loaded
which fnm        # Does it return the path to fnm itself?
fnm current      # Does it show the current version?

# 2. Check if shell configuration is correct
cat ~/.zshrc | grep fnm
# Check if eval "$(fnm env --use-on-cd --shell zsh)" is included

# 3. Check if a version is installed in fnm
fnm list
# If nothing is shown:
fnm install --lts

# 4. Open a new shell and verify
exec zsh
node --version

# ─── When pyenv's python is not found ───

# 1. Check pyenv shims
which python
# Should return ~/.pyenv/shims/python

# 2. Rebuild shims
pyenv rehash

# 3. Check if a version is configured
pyenv version
# If "system" is shown, it is not configured
pyenv global 3.12.3
```

### 12.2 Version Not Switching

```bash
# ─── When auto-switch does not work on cd ───

# 1. Check if fnm's --use-on-cd is enabled
fnm env | grep "FNM_VERSION_FILE_STRATEGY"
# "recursive" is recommended

# 2. Check contents of .node-version file
cat .node-version
# Note line endings (should be LF; CRLF can cause issues)
file .node-version
# Should show "ASCII text"

# 3. Check if the version is actually installed
fnm list
# Check if the version written in .node-version is in the list

# 4. Does manual switching work?
fnm use
# If an error occurs, run fnm install first

# ─── When Volta does not switch ───
# Check the volta field in package.json
cat package.json | jq '.volta'
# If null, run volta pin node@20
```

### 12.3 Resolving PATH Conflicts

```bash
# ─── When multiple version managers conflict ───

# 1. Check all locations of node
which -a node
type -a node

# Expected output (for fnm):
# /Users/username/.fnm/node-versions/v20.11.0/installation/bin/node

# Problematic output example:
# /opt/homebrew/bin/node          ← remnant of brew install node
# /Users/username/.nvm/versions/node/v20.11.0/bin/node  ← remnant of nvm
# /Users/username/.fnm/node-versions/v20.11.0/installation/bin/node

# 2. Remove unnecessary installations
brew uninstall node              # Remove Homebrew's node
rm -rf ~/.nvm                    # Completely remove nvm

# 3. Check PATH order
echo $PATH | tr ':' '\n' | head -20
# Version manager path should come before /usr/local/bin

# 4. Check if unnecessary paths are added in shell configuration
grep -n 'PATH' ~/.zshrc
grep -n 'PATH' ~/.zprofile
grep -n 'PATH' ~/.bash_profile
```

### 12.4 pyenv Build Failures

```bash
# ─── Build errors on macOS Sonoma/Sequoia ───

# Debugging steps for "Build failed":

# 1. Update Xcode Command Line Tools
xcode-select --install
# If already installed:
sudo rm -rf /Library/Developer/CommandLineTools
xcode-select --install

# 2. Reinstall build dependencies
brew reinstall openssl readline sqlite3 xz zlib tcl-tk

# 3. Build with environment variables set
LDFLAGS="-L$(brew --prefix openssl@3)/lib \
  -L$(brew --prefix readline)/lib \
  -L$(brew --prefix sqlite3)/lib \
  -L$(brew --prefix zlib)/lib \
  -L$(brew --prefix xz)/lib" \
CPPFLAGS="-I$(brew --prefix openssl@3)/include \
  -I$(brew --prefix readline)/include \
  -I$(brew --prefix sqlite3)/include \
  -I$(brew --prefix zlib)/include \
  -I$(brew --prefix xz)/include" \
PKG_CONFIG_PATH="$(brew --prefix openssl@3)/lib/pkgconfig:\
$(brew --prefix readline)/lib/pkgconfig:\
$(brew --prefix sqlite3)/lib/pkgconfig:\
$(brew --prefix zlib)/lib/pkgconfig:\
$(brew --prefix xz)/lib/pkgconfig" \
pyenv install 3.12.3

# 4. If still failing, consider uv as an alternative
uv python install 3.12  # Pre-built binary, no build errors
```

---

## 13. FAQ

### Q1: Which should I choose, fnm or nvm?

**A:** For new projects, fnm is recommended for the following reasons:
- Written in Rust, over 40x faster startup (affects shell startup time)
- Easy migration from nvm as `.nvmrc` is compatible
- Auto-switch on directory change is a built-in feature with `--use-on-cd`
- Cross-platform support (including native Windows)
- Corepack support is built in

nvm has the most mature ecosystem, but is inferior to fnm in terms of speed.

### Q2: Can mise replace nvm/pyenv?

**A:** Yes, mise can centrally manage many tools including Node.js, Python, Go, Rust, Terraform, and more. Since it can read existing `.nvmrc`, `.python-version`, and `.tool-versions` (asdf format), migration is easy. However, if you depend on pyenv's virtualenv integration or nvm-specific scripts, it is safer to migrate gradually.

### Q3: What is the difference between .node-version and .nvmrc?

**A:** The content is the same (just write a version number on one line). Both fnm and nvm can read both files. Volta uses the volta field in package.json. If you want to unify within the team, `.node-version` is recommended (fnm's default; GitHub Actions' setup-node also supports it).

### Q4: Is it better to manage Python versions with uv or pyenv?

**A:** For new projects from 2025 onward, uv is recommended for the following reasons:
- No build errors since it downloads pre-built binaries
- No need to install pyenv build dependencies (openssl, readline, etc.)
- Package management and Python version management can be handled by uv alone
- Installation completes in seconds (pyenv can take several minutes)

However, there are cases where pyenv is necessary:
- When special build options are needed (debug builds, PGO optimization, etc.)
- When you need to use CPython implementations other than the standard (e.g., PyPy)

### Q5: How should I choose between Volta and fnm?

**A:** The decision criteria are as follows:

Cases where Volta is appropriate:
- You want to strictly pin the versions of npm/yarn/pnpm as well
- You want to consolidate all settings in package.json
- You prefer a mechanism that requires no shell hooks (zero shell startup impact)

Cases where fnm is appropriate:
- Managing just the Node.js version is sufficient
- .nvmrc compatibility is important (migrating from nvm)
- You prefer a lightweight, fast tool

### Q6: Is it okay if the team uses different version managers?

**A:** As long as the version files are unified, there is no practical problem. For example, the `.node-version` file can be read by fnm, nvm, and mise alike. However, the following points need attention:
- Some combinations are not compatible in version file format (e.g., Volta does not read .nvmrc)
- Unified support during troubleshooting is difficult
- If possible, it is recommended to unify the entire team on one tool

### Q7: When should I upgrade the Node.js version?

**A:** The following schedule is recommended:
1. **Right after a new LTS release (October)**: Run compatibility tests on dependencies in a verification branch
2. **1-2 months after release**: Confirm support from major libraries
3. **3 months after release**: Plan and execute production migration
4. **3 months before old LTS EOL**: Complete migration

### Q8: Should the version manager itself be version-pinned?

**A:** It is recommended to use the latest version of the version manager itself. Unlike runtime versions, breaking changes from version manager updates are rare. However, in CI, it is safer to pin to a major version such as `actions/setup-node@v4`.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and confirming how it works.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to applications. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next steps.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work, particularly during code reviews and architecture design.

---

## 14. Summary

| Language | Recommended Tool | Config File | Notes |
|----------|-----------------|-------------|-------|
| Node.js | fnm | `.node-version` | Fast, .nvmrc compatible |
| Node.js (team) | Volta | `package.json` | Also pins npm/yarn |
| Python (new) | uv | `.python-version` | Ultra-fast, no build required |
| Python (existing) | pyenv | `.python-version` | virtualenv integration |
| Rust | rustup | `rust-toolchain.toml` | Official tool |
| Go | mise | `.mise.toml` | More integrated than goenv |
| Java | SDKMAN / mise | `.sdkmanrc` / `.mise.toml` | Distribution selection available |
| Ruby | rbenv / mise | `.ruby-version` / `.mise.toml` | mise integration recommended |
| Multi-language | mise | `.mise.toml` | All languages with one tool |
| CI | actions/setup-* | References files above | Auto-detection supported |

### 5 Principles of Version Management

```
1. Pin down to the patch version
   → "20.11.0", not "20"

2. Always commit version files
   → Do not add .node-version, .python-version to .gitignore

3. Use the same version in CI and development environment
   → Reference version files in CI as well

4. Use the same version manager across the entire team
   → Mixing leads to PATH conflicts and support difficulties

5. Update versions regularly
   → Planned updates aligned with LTS schedule
```

---

## What to Read Next

- [01-package-managers.md](./01-package-managers.md) -- Package manager configuration
- [../00-editor-and-tools/01-terminal-setup.md](../00-editor-and-tools/01-terminal-setup.md) -- Integration with shell configuration
- [../03-team-setup/00-project-standards.md](../03-team-setup/00-project-standards.md) -- Team standards configuration

---

## References

1. **fnm (Fast Node Manager)** -- https://github.com/Schniz/fnm -- Official fnm repository. Includes benchmark comparisons.
2. **mise documentation** -- https://mise.jdx.dev/ -- Official mise documentation. Full list of supported tools.
3. **pyenv** -- https://github.com/pyenv/pyenv -- Official pyenv. Extensive build dependency troubleshooting.
4. **Volta** -- https://volta.sh/ -- Official Volta site. Detailed explanation of package.json integration.
5. **rustup** -- https://rust-lang.github.io/rustup/ -- Official rustup documentation. Detailed toolchain management.
6. **uv** -- https://docs.astral.sh/uv/ -- Official uv documentation. Explanation of Python version management features.
7. **Node.js Release Schedule** -- https://github.com/nodejs/release -- Node.js release schedule and EOL information.
8. **SDKMAN** -- https://sdkman.io/ -- Official SDKMAN site. Guide for selecting Java distributions.
9. **rbenv** -- https://github.com/rbenv/rbenv -- Official rbenv repository. Ruby version management.
10. **goenv** -- https://github.com/go-nv/goenv -- Official goenv repository. Go version management.

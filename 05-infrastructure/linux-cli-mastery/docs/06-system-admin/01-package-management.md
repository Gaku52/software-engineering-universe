# Package Management

> Package managers provide a safe mechanism for installing, updating, and removing software.

## What You Will Learn

- [ ] Understand how to use major package managers
- [ ] Search for, install, update, and remove packages
- [ ] Understand the differences between macOS and Linux package management
- [ ] Add and manage repositories
- [ ] Understand package security practices
- [ ] Write automated environment setup scripts


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of [systemd and Service Management](./00-systemd.md)

---

## 1. apt (Debian / Ubuntu)

### 1.1 Basic Operations

```bash
# Update package list
sudo apt update                  # Refresh repository information

# Install
sudo apt install nginx           # Install
sudo apt install -y nginx        # Install without confirmation
sudo apt install nginx=1.24.0-1  # Specify version
sudo apt install nginx curl wget # Multiple packages

# Update
sudo apt upgrade                 # Update all packages
sudo apt full-upgrade            # Update including dependency changes
sudo apt update && sudo apt upgrade -y  # Standard pattern

# Remove
sudo apt remove nginx            # Remove package (keep config)
sudo apt purge nginx             # Remove including config files
sudo apt autoremove              # Remove unnecessary dependency packages
sudo apt autoremove --purge      # Remove unnecessary packages including config
```

### 1.2 Search and Information Display

```bash
# Search and information
apt search nginx                 # Search packages
apt show nginx                   # Show detailed information
apt list --installed             # List installed packages
apt list --upgradable            # List upgradable packages
dpkg -l | grep nginx             # Search installed packages
dpkg -L nginx                    # List package files
dpkg -S /usr/bin/curl            # Package containing the file
apt-cache depends nginx          # Dependencies
apt-cache rdepends nginx         # Reverse dependencies

# Package changelog
apt changelog nginx

# Package policy (version and priority)
apt-cache policy nginx

# Example output:
# nginx:
#   Installed: 1.24.0-1ubuntu1
#   Candidate: 1.24.0-1ubuntu1
#   Version table:
#  *** 1.24.0-1ubuntu1 500
#         500 http://archive.ubuntu.com/ubuntu jammy/main amd64 Packages
#         100 /var/lib/dpkg/status
```

### 1.3 Direct Operations with deb Packages

```bash
# Install directly from .deb file
sudo dpkg -i package.deb
sudo apt install -f              # Resolve dependencies

# Safer method (also resolves dependencies automatically)
sudo apt install ./package.deb

# Inspect deb package contents
dpkg-deb -c package.deb         # List files
dpkg-deb -I package.deb         # Package information
dpkg-deb -x package.deb /tmp/extract  # Extract

# Package reconfiguration
sudo dpkg --configure -a         # Configure unconfigured packages
sudo dpkg --reconfigure tzdata   # Reconfigure a package
```

### 1.4 Repository Management

```bash
# Check repositories
cat /etc/apt/sources.list
ls /etc/apt/sources.list.d/

# Add PPA (Ubuntu)
sudo add-apt-repository ppa:deadsnakes/ppa
sudo apt update

# Remove PPA
sudo add-apt-repository --remove ppa:deadsnakes/ppa

# Add third-party repository (new method, Ubuntu 22.04+)
# 1. Download GPG key
curl -fsSL https://packages.example.com/gpg.key | \
    sudo gpg --dearmor -o /usr/share/keyrings/example-archive-keyring.gpg

# 2. Add repository
echo "deb [signed-by=/usr/share/keyrings/example-archive-keyring.gpg] \
    https://packages.example.com/apt stable main" | \
    sudo tee /etc/apt/sources.list.d/example.list

# 3. Update
sudo apt update

# Example: Add Docker repository
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io

# Example: Add Node.js repository (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs
```

### 1.5 Package Pinning (Hold)

```bash
# Pin a specific package version (prevent updates)
sudo apt-mark hold nginx
sudo apt-mark hold linux-image-generic  # Prevent kernel updates

# Release the pin
sudo apt-mark unhold nginx

# Check pinned packages
apt-mark showhold

# Pin using dpkg
echo "nginx hold" | sudo dpkg --set-selections

# Check pin status
dpkg --get-selections | grep hold
```

### 1.6 Automatic Update Configuration for apt

```bash
# unattended-upgrades: Automatically apply security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades

# Config file: /etc/apt/apt.conf.d/50unattended-upgrades
# Unattended-Upgrade::Allowed-Origins {
#     "${distro_id}:${distro_codename}";
#     "${distro_id}:${distro_codename}-security";
# };
# Unattended-Upgrade::Mail "admin@example.com";
# Unattended-Upgrade::Automatic-Reboot "false";
# Unattended-Upgrade::Automatic-Reboot-Time "02:00";

# Test automatic updates
sudo unattended-upgrade --dry-run --debug

# Check automatic update log
cat /var/log/unattended-upgrades/unattended-upgrades.log
```

### 1.7 Cache Management

```bash
# Manage apt cache
sudo apt clean                   # Remove all downloaded packages
sudo apt autoclean               # Remove only old version cache

# Cache location
ls /var/cache/apt/archives/

# Check cache size
du -sh /var/cache/apt/archives/

# Rebuild package list
sudo apt update --fix-missing
```

---

## 2. dnf / yum (RHEL / Fedora / Rocky)

### 2.1 Basic Operations

```bash
# dnf (successor to yum)
sudo dnf install nginx           # Install
sudo dnf install -y nginx        # Install without confirmation
sudo dnf remove nginx            # Remove
sudo dnf update                  # Update all packages
sudo dnf upgrade                 # Same as update (in dnf)
sudo dnf check-update            # Check for updatable packages

# Search and information
sudo dnf search nginx            # Search
sudo dnf info nginx              # Detailed information
sudo dnf list installed          # List installed packages
sudo dnf list available          # List available packages
sudo dnf provides /usr/bin/curl  # Package containing the file
sudo dnf repoquery --whatrequires nginx  # Reverse dependencies
```

### 2.2 Group and Module Management

```bash
# Group management
sudo dnf group list              # List groups
sudo dnf group info "Development Tools"  # Group details
sudo dnf group install "Development Tools"  # Install development tools at once
sudo dnf group remove "Development Tools"   # Remove group

# Modules (RHEL 8+ / Fedora)
sudo dnf module list             # List available modules
sudo dnf module list nodejs      # List streams for a specific module
sudo dnf module enable nodejs:20 # Enable Node.js 20
sudo dnf module install nodejs:20
sudo dnf module disable nodejs   # Disable module
sudo dnf module reset nodejs     # Reset module

# Switching module streams
sudo dnf module reset nodejs
sudo dnf module enable nodejs:22
sudo dnf module install nodejs:22
```

### 2.3 Repository Management

```bash
# Check repositories
dnf repolist                     # Enabled repositories
dnf repolist all                 # All repositories
dnf repoinfo                     # Repository details

# Enable/disable repositories
sudo dnf config-manager --set-enabled powertools
sudo dnf config-manager --set-disabled powertools

# Add third-party repository
sudo dnf config-manager --add-repo https://packages.example.com/repo

# Add EPEL repository (RHEL/Rocky/AlmaLinux)
sudo dnf install epel-release

# Add RPM Fusion repository (Fedora)
sudo dnf install \
    https://download1.rpmfusion.org/free/fedora/rpmfusion-free-release-$(rpm -E %fedora).noarch.rpm \
    https://download1.rpmfusion.org/nonfree/fedora/rpmfusion-nonfree-release-$(rpm -E %fedora).noarch.rpm
```

### 2.4 Direct rpm Operations

```bash
# .rpm files
sudo dnf install package.rpm     # Recommended (auto-resolves dependencies)
sudo rpm -ivh package.rpm        # Direct rpm (manual dependencies)

# Display information with rpm
rpm -qa | grep nginx             # Search installed packages
rpm -ql nginx                    # List files
rpm -qi nginx                    # Package information
rpm -qf /usr/bin/curl            # Package owning the file
rpm -qp package.rpm              # Information for uninstalled package

# GPG key management
rpm --import https://packages.example.com/gpg.key
rpm -qa gpg-pubkey*              # List imported keys
```

### 2.5 dnf History Management

```bash
# dnf transaction history
dnf history                      # List history
dnf history info 15              # Details of a specific transaction
dnf history undo 15              # Undo a specific transaction
dnf history rollback 15          # Roll back to a specific point

# Recent operation log
cat /var/log/dnf.log
```

### 2.6 Package Pinning

```bash
# Version pinning with dnf
sudo dnf install dnf-plugin-versionlock
sudo dnf versionlock add nginx
sudo dnf versionlock list
sudo dnf versionlock delete nginx
```

---

## 3. Homebrew (macOS / Linux)

### 3.1 Basic Operations

```bash
# Install
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Basic operations
brew install wget                # Install CLI tool
brew install --cask firefox      # Install GUI application
brew uninstall wget              # Remove
brew upgrade                     # Update all packages
brew upgrade wget                # Update specific package
brew update                      # Update Homebrew itself

# Search and information
brew search nginx                # Search
brew info nginx                  # Detailed information
brew list                        # List installed packages
brew list --cask                 # List GUI applications
brew deps nginx                  # Dependencies
brew deps --tree nginx           # Dependency tree
brew uses --installed nginx      # Reverse dependencies
brew outdated                    # List updatable packages

# Maintenance
brew cleanup                     # Remove old versions
brew cleanup -n                  # Check what would be removed (dry-run)
brew cleanup --prune=30          # Remove cache older than 30 days
brew doctor                      # Diagnose issues
brew autoremove                  # Remove unnecessary dependencies
brew missing                     # Missing dependencies
```

### 3.2 Advanced Homebrew Operations

```bash
# Version management
brew list --versions nginx       # Installed versions
brew pin nginx                   # Pin version
brew unpin nginx                 # Unpin
brew list --pinned               # Pinned packages

# Install a specific version
brew install nginx@1.24          # Specific version (if available)
brew install --HEAD nginx        # Development version (HEAD)

# Detailed package operations
brew link nginx                  # Create symbolic links
brew unlink nginx                # Remove symbolic links
brew link --overwrite nginx      # Force link
brew --prefix nginx              # Check installation location

# Configuration information
brew config                      # Homebrew configuration information
brew --prefix                    # Homebrew installation location
brew --cellar                    # Cellar location
brew --cache                     # Cache location
```

### 3.3 Service Management (Integrated with macOS launchd)

```bash
# Service management
brew services list               # List services
brew services start nginx        # Start (also configure autostart)
brew services stop nginx         # Stop
brew services restart nginx      # Restart
brew services run nginx          # Start only (no autostart)
brew services info nginx         # Service information

# plist file locations
ls ~/Library/LaunchAgents/       # User services
ls /Library/LaunchDaemons/       # System services
```

### 3.4 Tap (Third-Party Repositories)

```bash
# Tap management
brew tap                         # List added taps
brew tap homebrew/cask-fonts     # Add tap for fonts
brew tap homebrew/cask-versions  # Old versions cask
brew tap user/repo               # Custom tap
brew untap homebrew/cask-fonts   # Remove tap

# Install from a specific tap
brew install homebrew/cask-fonts/font-fira-code
```

### 3.5 Bundle (Batch Management)

```bash
# Bundle (batch management)
# Describe in Brewfile and install all at once
brew bundle dump                 # Output current state to Brewfile
brew bundle dump --force         # Overwrite
brew bundle install              # Install from Brewfile
brew bundle check                # Check if all are installed
brew bundle cleanup              # Remove packages not in Brewfile
brew bundle cleanup --force      # Remove without confirmation
brew bundle list                 # Show Brewfile contents
```

### 3.6 Brewfile Example

```ruby
# Brewfile

# Tap
tap "homebrew/cask"
tap "homebrew/cask-fonts"

# CLI tools - basic
brew "git"
brew "gh"
brew "curl"
brew "wget"

# CLI tools - modern alternatives
brew "ripgrep"                  # grep alternative
brew "fd"                       # find alternative
brew "bat"                      # cat alternative
brew "eza"                      # ls alternative
brew "fzf"                      # fuzzy finder
brew "zoxide"                   # cd alternative
brew "delta"                    # diff alternative
brew "dust"                     # du alternative
brew "duf"                      # df alternative
brew "procs"                    # ps alternative
brew "bottom"                   # top alternative
brew "hyperfine"                # benchmarking

# CLI tools - development
brew "jq"                       # JSON processing
brew "yq"                       # YAML processing
brew "starship"                 # prompt
brew "tmux"                     # terminal multiplexer
brew "shellcheck"               # shell script linter

# CLI tools - infrastructure
brew "awscli"
brew "terraform"
brew "ansible"
brew "kubectl"
brew "helm"

# Languages and runtimes
brew "node"
brew "python@3.12"
brew "go"
brew "rust"

# Applications (GUI)
cask "visual-studio-code"
cask "iterm2"
cask "docker"
cask "firefox"
cask "google-chrome"
cask "slack"
cask "1password"
cask "rectangle"                # window management

# Fonts
cask "font-fira-code-nerd-font"
cask "font-jetbrains-mono-nerd-font"

# Mac App Store (requires mas command)
# mas "Xcode", id: 497799835
# mas "Keynote", id: 409183694
```

### 3.7 Homebrew on Linux

```bash
# Homebrew on Linux (Linuxbrew)
# Install
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Path configuration (add to ~/.bashrc or ~/.zshrc)
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"

# Advantages on Linux:
# - Install latest tool versions without root
# - Distribution-independent
# - Share the same Brewfile as macOS

# Notes:
# - Installed to /home/linuxbrew/.linuxbrew/
# - Requires glibc 2.13+
# - Build tools (gcc, make) must be installed first
sudo apt install build-essential curl file git
```

---

## 4. pacman (Arch Linux)

### 4.1 Basic Operations

```bash
# pacman (Arch Linux / Manjaro)
sudo pacman -S nginx             # Install
sudo pacman -R nginx             # Remove
sudo pacman -Rs nginx            # Remove including dependencies
sudo pacman -Rns nginx           # Complete removal including config files
sudo pacman -Syu                 # Full update (sync + upgrade)
sudo pacman -Syy                 # Force database update
sudo pacman -Ss nginx            # Search
sudo pacman -Si nginx            # Repository package information
sudo pacman -Qi nginx            # Installed package information
sudo pacman -Ql nginx            # List files
sudo pacman -Qo /usr/bin/curl    # Package owning the file
sudo pacman -Qe                  # Explicitly installed packages
sudo pacman -Qd                  # Packages installed as dependencies
sudo pacman -Qdt                 # Orphaned packages (unnecessary dependencies)

# Cache management
sudo pacman -Sc                  # Remove old cache
sudo pacman -Scc                 # Remove all cache

# AUR (Arch User Repository) helper
# Install yay
git clone https://aur.archlinux.org/yay.git
cd yay && makepkg -si

# Using yay (same syntax as pacman)
yay -S google-chrome             # Install from AUR
yay -Syu                         # Full update (official + AUR)
yay -Ss keyword                  # Search (official + AUR)
```

### 4.2 pacman Flag Quick Reference

```bash
# pacman flag system:
# -S: Sync (repository operations)
#   -S pkg    → install
#   -Ss       → search
#   -Si       → show information
#   -Sy       → update database
#   -Su       → upgrade
#   -Syu      → update + upgrade
#   -Sc       → remove cache

# -R: Remove (removal operations)
#   -R pkg    → remove
#   -Rs       → remove with dependencies
#   -Rn       → remove config files too
#   -Rns      → complete removal

# -Q: Query (query operations)
#   -Q        → list installed
#   -Qs       → search
#   -Qi       → show information
#   -Ql       → list files
#   -Qo file  → owning package
#   -Qe       → explicitly installed
#   -Qd       → installed as dependency
#   -Qdt      → orphaned packages

# -F: File (file search)
#   -Fy       → update file database
#   -Fs file  → search package containing file
```

---

## 5. Other Package Managers

### 5.1 snap (Ubuntu)

```bash
# snap: sandboxed packages
sudo snap install code --classic # Install (--classic: no sandbox)
sudo snap install firefox        # Install with sandbox
snap list                        # List
snap info firefox                # Detailed information
sudo snap refresh                # Update all
sudo snap refresh firefox        # Update specific package
sudo snap remove firefox         # Remove
sudo snap revert firefox         # Revert to previous version

# Channel management
snap info --verbose firefox      # Available channels
sudo snap install firefox --channel=esr/stable  # ESR version

# snap maintenance
snap changes                     # Change history
snap connections firefox         # Interface connections
sudo snap connect firefox:camera # Allow camera access

# Control snap auto-updates
sudo snap set system refresh.timer=sat,04:00  # Update Saturday at 4:00
```

### 5.2 flatpak

```bash
# flatpak: cross-distribution packages
sudo apt install flatpak         # Install flatpak
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo

# Basic operations
flatpak install flathub org.gimp.GIMP
flatpak list                     # List
flatpak update                   # Update
flatpak uninstall org.gimp.GIMP  # Remove
flatpak search gimp              # Search
flatpak info org.gimp.GIMP       # Information

# Runtime management
flatpak list --runtime           # List installed runtimes
flatpak uninstall --unused       # Remove unused runtimes
```

### 5.3 nix (Declarative Package Management)

```bash
# nix: declarative and reproducible package management
# Install
sh <(curl -L https://nixos.org/nix/install) --daemon

# Basic operations (traditional commands)
nix-env -iA nixpkgs.nginx       # Install
nix-env -q                      # List
nix-env -u                      # Update
nix-env -e nginx                # Remove

# New commands (Nix 2.4+, experimental)
nix profile install nixpkgs#nginx
nix profile list
nix profile upgrade
nix profile remove nginx

# Temporary use (run without installing)
nix-shell -p nginx               # Temporary environment
nix run nixpkgs#cowsay -- "Hello" # Temporary execution

# Advantages of nix:
# - Reproducible with declarative configuration
# - Multiple versions can coexist
# - Easy rollback
# - Same across all distributions
```

### 5.4 AppImage

```bash
# AppImage: portable Linux applications
# Just download and set execute permission
chmod +x MyApp.AppImage
./MyApp.AppImage

# System integration with AppImageLauncher
# - Automatic desktop entry creation
# - Update management
sudo apt install appimagelauncher

# Management best practices
mkdir -p ~/Applications
mv MyApp.AppImage ~/Applications/
```

---

## 6. Language-Specific Package Managers

### 6.1 Node.js / JavaScript

```bash
# npm (bundled with Node.js)
npm install -g typescript        # Global
npm install express              # Local (within project)
npm install -D jest              # Development dependency
npx create-react-app myapp       # Temporary execution

npm list -g --depth=0            # Globally installed packages
npm outdated                     # Updatable packages
npm update                       # Update
npm audit                        # Security audit
npm audit fix                    # Auto-fix

# pnpm (fast and disk-efficient)
npm install -g pnpm
pnpm install                     # Install from package.json
pnpm add express                 # Add package
pnpm add -D jest                 # Development dependency
pnpm remove express              # Remove

# Bun (fast JavaScript runtime + package manager)
curl -fsSL https://bun.sh/install | bash
bun install                      # Install from package.json
bun add express                  # Add package
bun run dev                      # Run script

# Version management (Node.js itself)
# fnm (recommended)
curl -fsSL https://fnm.vercel.app/install | bash
fnm install 20                   # Install Node.js 20
fnm use 20                       # Switch version
fnm list                         # List installed versions
fnm default 20                   # Default version

# nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
nvm alias default 20
```

### 6.2 Python

```bash
# pip
pip install requests             # Install
pip install requests==2.31.0     # Specify version
pip install -r requirements.txt  # Batch install
pip list                         # List
pip show requests                # Show information
pip freeze > requirements.txt    # Export dependencies
pip install --upgrade requests   # Update

# pipx: recommended for installing CLI tools (isolated environment)
pip install pipx
pipx install black
pipx install ruff
pipx install poetry
pipx list                        # Installed packages
pipx upgrade-all                 # Update all

# uv: fast Python package manager
curl -LsSf https://astral.sh/uv/install.sh | sh
uv pip install requests          # pip-compatible
uv pip compile requirements.in -o requirements.txt  # Lock
uv venv                          # Create virtual environment
uv run script.py                 # Run script

# uvx: alternative to pipx (built into uv)
uvx black file.py                # Temporary execution
uvx ruff check .                 # Run linter

# Virtual environments
python -m venv .venv             # Create virtual environment
source .venv/bin/activate        # Activate
deactivate                       # Deactivate

# Version management (Python itself)
# pyenv
curl https://pyenv.run | bash
pyenv install 3.12.0
pyenv global 3.12.0
pyenv local 3.12.0               # Set per directory
pyenv versions                   # List installed versions
```

### 6.3 Rust

```bash
# rustup (Rust toolchain management)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup update                    # Update toolchain
rustup component add clippy      # Add component
rustup target add wasm32-unknown-unknown  # Add target

# cargo (Rust package manager)
cargo install ripgrep            # Install binary
cargo install --locked bat       # Respect Cargo.lock
cargo install-update -a          # Update installed binaries (requires cargo-update)
```

### 6.4 Go

```bash
# Install Go tools
go install golang.org/x/tools/gopls@latest
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

# Go version management
go install golang.org/dl/go1.22.0@latest
go1.22.0 download
```

### 6.5 Ruby

```bash
# gem
gem install bundler
gem install rails
gem list                         # List installed
gem update                       # Update all

# bundle (Bundler)
bundle init                      # Create Gemfile
bundle install                   # Install from Gemfile
bundle update                    # Update dependencies
bundle exec rails server         # Run within environment

# rbenv (version management)
brew install rbenv ruby-build
rbenv install 3.3.0
rbenv global 3.3.0
rbenv versions
```

---

## 7. Package Management Inside Containers

```bash
# Dockerfile best practices

# Debian/Ubuntu base
# --- Recommended pattern ---
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
        nginx && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Key points:
# - Use apt-get instead of apt (better suited for non-interactive use)
# - --no-install-recommends to skip recommended packages
# - Clean cache in a single RUN to reduce layer size
# - Remove /var/lib/apt/lists/*

# Alpine Linux base (lightweight containers)
RUN apk add --no-cache \
    curl \
    nginx

# RHEL/Fedora base
RUN dnf install -y --setopt=install_weak_deps=False \
        curl \
        nginx && \
    dnf clean all

# Package management with multi-stage builds
FROM golang:1.22 AS builder
RUN go build -o /app .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /app /app
CMD ["/app"]
```

---

## 8. Security and Best Practices

### 8.1 Package Security Verification

```bash
# Ubuntu: Check for security updates
sudo apt list --upgradable 2>/dev/null | grep -i security

# Apply only security updates
sudo apt-get -s dist-upgrade | grep "^Inst" | grep -i securi
sudo unattended-upgrade --dry-run

# RHEL/Fedora: Security advisories
sudo dnf updateinfo list security
sudo dnf update --security       # Apply only security updates
sudo dnf updateinfo info RHSA-2025:0001  # Details of a specific advisory

# Package integrity check
# Debian/Ubuntu
debsums -c                       # Detect modified files
sudo debsums -a nginx            # Specific package

# RHEL/Fedora
rpm -Va                          # Verify all packages
rpm -V nginx                     # Verify specific package
```

### 8.2 GPG Key Management

```bash
# apt GPG key management (new method)
# Keyring directory
ls /usr/share/keyrings/
ls /etc/apt/trusted.gpg.d/

# Download and convert key
curl -fsSL https://example.com/gpg.key | \
    sudo gpg --dearmor -o /usr/share/keyrings/example.gpg

# Specify in sources.list
# deb [signed-by=/usr/share/keyrings/example.gpg] https://packages.example.com/apt stable main

# rpm GPG key management
sudo rpm --import https://packages.example.com/gpg.key
rpm -qa gpg-pubkey*              # Imported keys
```

### 8.3 Package Management Best Practices

```bash
# 1. Always update the repository before installing
sudo apt update && sudo apt install package

# 2. Pin versions in production environments
sudo apt install nginx=1.24.0-1ubuntu1
# or
sudo apt-mark hold nginx

# 3. Regularly apply security updates
# Configure automatic updates
sudo apt install unattended-upgrades

# 4. Remove unnecessary packages to reduce attack surface
sudo apt autoremove --purge
dpkg -l | grep '^rc' | awk '{print $2}' | xargs sudo dpkg --purge

# 5. Use only trusted repositories
# Verify GPG signature before installing

# 6. Verify package origin
apt-cache policy nginx           # Which repository it comes from
```

---

## 9. Practical Patterns

### 9.1 Initial Server Setup

```bash
#!/bin/bash
set -euo pipefail

# Ubuntu server initial setup script
echo "=== System Update ==="
sudo apt update && sudo apt upgrade -y

echo "=== Install Essential Packages ==="
sudo apt install -y \
    git curl wget \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    unzip \
    jq \
    htop \
    tmux \
    vim \
    ufw \
    fail2ban

echo "=== Install Web Server ==="
sudo apt install -y nginx

echo "=== Install Database ==="
sudo apt install -y postgresql postgresql-client

echo "=== Install Redis ==="
sudo apt install -y redis-server

echo "=== Configure Firewall ==="
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

echo "=== Enable Services ==="
sudo systemctl enable --now nginx postgresql redis-server

echo "=== Setup Automatic Security Updates ==="
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

echo "=== Cleanup ==="
sudo apt autoremove -y
sudo apt clean

echo "=== Setup Complete ==="
```

### 9.2 Automated Development Machine Setup (macOS)

```bash
#!/bin/bash
set -euo pipefail

# macOS development environment setup script

echo "=== Installing Xcode Command Line Tools ==="
xcode-select --install 2>/dev/null || true

echo "=== Installing Homebrew ==="
if ! command -v brew &>/dev/null; then
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

echo "=== Installing from Brewfile ==="
brew bundle install --file=Brewfile

echo "=== Setting up Shell ==="
# zsh plugins
if [[ ! -d "$HOME/.oh-my-zsh" ]]; then
    sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended
fi

echo "=== Setting up fzf ==="
"$(brew --prefix)/opt/fzf/install" --all --no-bash --no-fish

echo "=== Setting up Starship ==="
mkdir -p ~/.config
[[ -f ~/.config/starship.toml ]] || cat > ~/.config/starship.toml <<'EOF'
[character]
success_symbol = ">"
error_symbol = ">"

[directory]
truncation_length = 3
EOF

echo "=== Setting up Git ==="
git config --global init.defaultBranch main
git config --global pull.rebase true
git config --global core.autocrlf input

echo "=== Setting up Node.js (fnm) ==="
if command -v fnm &>/dev/null; then
    fnm install --lts
    fnm default lts-latest
fi

echo "=== Setting up Python (pyenv) ==="
if command -v pyenv &>/dev/null; then
    pyenv install 3.12 --skip-existing
    pyenv global 3.12
fi

echo "=== Setup Complete ==="
echo "Please restart your terminal."
```

### 9.3 Batch Package Update Script

```bash
#!/bin/bash
set -euo pipefail

# Batch update script for all package managers
LOG_FILE="/tmp/update-all-$(date +%Y%m%d).log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "=== Update All Packages: $(date) ==="

# macOS / Homebrew
if command -v brew &>/dev/null; then
    echo "--- Homebrew ---"
    brew update
    brew upgrade
    brew cleanup
    brew autoremove
fi

# apt (Debian/Ubuntu)
if command -v apt &>/dev/null; then
    echo "--- APT ---"
    sudo apt update
    sudo apt upgrade -y
    sudo apt autoremove -y
fi

# dnf (RHEL/Fedora)
if command -v dnf &>/dev/null; then
    echo "--- DNF ---"
    sudo dnf upgrade -y
    sudo dnf autoremove -y
fi

# snap
if command -v snap &>/dev/null; then
    echo "--- Snap ---"
    sudo snap refresh
fi

# flatpak
if command -v flatpak &>/dev/null; then
    echo "--- Flatpak ---"
    flatpak update -y
fi

# npm (global packages)
if command -v npm &>/dev/null; then
    echo "--- npm (global) ---"
    npm update -g
fi

# pip (pipx-managed tools)
if command -v pipx &>/dev/null; then
    echo "--- pipx ---"
    pipx upgrade-all
fi

# Rust
if command -v rustup &>/dev/null; then
    echo "--- Rust ---"
    rustup update
fi

echo "=== Update Complete: $(date) ==="
echo "Log saved to: $LOG_FILE"
```

### 9.4 Package Comparison and Migration

```bash
# Compare packages between servers
# Package list from server A
ssh server-a "dpkg --get-selections" > /tmp/server-a-packages.txt

# Package list from server B
ssh server-b "dpkg --get-selections" > /tmp/server-b-packages.txt

# Check differences
diff /tmp/server-a-packages.txt /tmp/server-b-packages.txt

# Migrate package list
# Export
dpkg --get-selections > packages.txt

# Import (on another server)
sudo dpkg --set-selections < packages.txt
sudo apt-get dselect-upgrade

# macOS package migration
# Export
brew bundle dump --force --file=Brewfile

# Import (on another machine)
brew bundle install --file=Brewfile
```

---

## 10. Alpine Linux Package Management (apk)

```bash
# apk (Alpine Package Keeper)
# Lightweight distribution most commonly used in Docker containers

# Basic operations
apk update                       # Update package list
apk upgrade                      # Update all packages
apk add nginx                    # Install
apk add --no-cache nginx         # Install without keeping cache
apk del nginx                    # Remove

# Search and information
apk search nginx                 # Search packages
apk info nginx                   # Package information
apk info -L nginx                # List files
apk list --installed             # List installed packages

# Virtual packages (manage packages needed only during build)
apk add --virtual .build-deps gcc musl-dev python3-dev
# Remove all at once after build
apk del .build-deps

# Typical pattern in Dockerfile
# RUN apk add --no-cache --virtual .build-deps \
#         gcc musl-dev python3-dev && \
#     pip install --no-cache-dir -r requirements.txt && \
#     apk del .build-deps

# Repository management
cat /etc/apk/repositories
# Enable community repository
# echo "http://dl-cdn.alpinelinux.org/alpine/v3.19/community" >> /etc/apk/repositories

# Install from edge (testing) repository
apk add --repository=http://dl-cdn.alpinelinux.org/alpine/edge/testing package-name
```

---

## 11. Package Manager Comparison and Selection Guide

### 11.1 System Package Manager Comparison

```bash
# === Package format comparison ===
# deb (Debian/Ubuntu):
#   - Widest ecosystem
#   - Easy third-party repositories via PPA
#   - apt automatically resolves dependencies
#   - Largest number of packages

# rpm (RHEL/Fedora):
#   - Enterprise-grade stability
#   - SELinux integration
#   - Version management via module streams
#   - Commercial support available (Red Hat)

# PKGBUILD (Arch):
#   - Latest packages available fastest
#   - Vast community packages via AUR
#   - Simple package build system
#   - Rolling release

# Homebrew (macOS/Linux):
#   - De facto standard for macOS
#   - Rich developer tooling
#   - Declarative management via Brewfile
#   - No root privileges required
```

### 11.2 Universal Package Comparison

```bash
# === snap vs flatpak vs AppImage ===

# snap:
#   - Developed by Canonical (Ubuntu)
#   - Supports server-side apps as well
#   - Automatic updates
#   - Centralized (Snap Store)
#   - Slightly slower startup

# flatpak:
#   - Community-driven
#   - Focused on desktop applications
#   - Multiple remote repositories
#   - Strong sandboxing
#   - Runtime sharing for disk efficiency

# AppImage:
#   - No package manager required
#   - 1 file = 1 application
#   - Portable (can be carried on USB drive)
#   - Weak auto-update mechanism
#   - No sandbox

# Selection guide:
# Server → snap (or traditional packages)
# Desktop → flatpak (distribution-independent)
# Portable → AppImage
```

### 11.3 Package Management Troubleshooting

```bash
# === apt troubleshooting ===
# Lock file issues
sudo rm /var/lib/dpkg/lock-frontend
sudo rm /var/lib/apt/lists/lock
sudo dpkg --configure -a

# Repair broken packages
sudo apt --fix-broken install
sudo dpkg --configure -a
sudo apt update --fix-missing

# sources.list errors
sudo apt update 2>&1 | grep "NO_PUBKEY" | awk '{print $NF}' | \
    xargs -I {} sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-keys {}

# === dnf troubleshooting ===
# Corrupted cache
sudo dnf clean all
sudo dnf makecache

# Broken RPM database
sudo rpm --rebuilddb

# === Homebrew troubleshooting ===
# Diagnose issues
brew doctor

# Reinstall Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/uninstall.sh)"
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Link issues
brew link --overwrite package
brew link --overwrite --dry-run package  # Check only

# Permission issues
sudo chown -R $(whoami) $(brew --prefix)/*
```


---

## Practice Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also write test code

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
        """Main data processing logic"""
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

### Exercise 2: Advanced Pattern

Extend the basic implementation to add the following features.

```python
# Exercise 2: Advanced pattern
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

    print(f"Slow version: {slow_time:.4f}s")
    print(f"Fast version: {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be aware of algorithm complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Missing or invalid config file | Check config file path and format |
| Timeout | Network delay / insufficient resources | Adjust timeout value, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check user permissions, review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check error messages**: Read the stack trace to identify where the error occurs
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Stepwise verification**: Verify hypotheses using log output or a debugger
5. **Fix and regression test**: After fixing, run tests for related areas as well

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
    """Decorator to log function input and output"""
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
2. **Check memory usage**: Verify presence of memory leaks
3. **Check for I/O waits**: Review disk and network I/O status
4. **Check concurrent connections**: Check connection pool status

| Issue Type | Diagnostic Tool | Solution |
|-----------|----------------|---------|
| High CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB slowness | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | Prioritize when | Can compromise when |
|----------|----------------|-------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

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
│  2. How often do you deploy?                    │
│    ├─ Weekly or less → Monolith + modules       │
│    └─ Daily / multiple times → Go to 3          │
│                                                 │
│  3. How independent are the teams?              │
│    ├─ High → Microservices                      │
│    └─ Medium → Modular monolith                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- A fast short-term approach can become long-term technical debt
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs Flexibility**
- A unified tech stack reduces learning costs
- Adopting diverse technologies enables best-fit choices but increases operational costs

**3. Level of Abstraction**
- High abstraction improves reusability but can make debugging harder
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
        """Describe background and issues"""
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

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Distribution | Manager | Install | Update | Search |
|-------------|---------|---------|--------|--------|
| Ubuntu/Debian | apt | apt install pkg | apt upgrade | apt search pkg |
| RHEL/Fedora | dnf | dnf install pkg | dnf update | dnf search pkg |
| Arch Linux | pacman | pacman -S pkg | pacman -Syu | pacman -Ss pkg |
| macOS | brew | brew install pkg | brew upgrade | brew search pkg |
| Ubuntu (snap) | snap | snap install pkg | snap refresh | snap find pkg |
| Cross-distro | flatpak | flatpak install pkg | flatpak update | flatpak search pkg |
| Declarative | nix | nix-env -iA pkg | nix-env -u | nix search pkg |

---

## What to Read Next

---

## References
1. "APT User's Guide." Debian Documentation.
2. "Homebrew Documentation." brew.sh.
3. "DNF Documentation." dnf.readthedocs.io.
4. "Arch Wiki: pacman." wiki.archlinux.org/title/pacman.
5. "Nix Package Manager Guide." nixos.org/manual/nix.
6. Barrett, D. "Efficient Linux at the Command Line." Ch.9, O'Reilly, 2022.

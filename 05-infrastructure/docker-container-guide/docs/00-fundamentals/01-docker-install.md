# Docker Installation Guide

> A practical setup guide covering how to install Docker Desktop and Docker Engine, initial configuration, and verification steps.

---

## What You Will Learn in This Chapter

1. **Select the optimal Docker installation method for each OS** and complete the setup reliably
2. **Understand the differences between Docker Desktop and Docker Engine** and use each appropriately for your needs
3. **Complete post-installation initial configuration and verification** so you are ready to start development
4. **Understand Docker's architecture** so you can handle issues appropriately when problems arise
5. **Optimize network and storage initial settings** to build a stable development environment


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Having read [Container Technology Overview](./00-container-overview.md)

---

## 1. Docker Desktop vs Docker Engine

### 1.1 Product Comparison

```
+------------------------------------------------------------+
|                Docker のプロダクトライン                      |
|                                                            |
|  +------------------------+  +-------------------------+  |
|  |   Docker Desktop       |  |   Docker Engine         |  |
|  |                        |  |                         |  |
|  |  - macOS / Windows     |  |  - Linux サーバー向け    |  |
|  |  - GUI ダッシュボード   |  |  - CLI のみ             |  |
|  |  - VM 内蔵             |  |  - ネイティブ動作        |  |
|  |  - Docker Compose 同梱 |  |  - 手動でCompose導入    |  |
|  |  - Kubernetes 同梱     |  |  - 軽量・高速            |  |
|  |  - 自動アップデート     |  |  - 手動アップデート      |  |
|  |                        |  |                         |  |
|  |  個人開発/小企業: 無料  |  |  完全無料 (OSS)         |  |
|  |  大企業: 有料           |  |                         |  |
|  +------------------------+  +-------------------------+  |
+------------------------------------------------------------+
```

### Comparison Table 1: Docker Desktop vs Docker Engine

| Item | Docker Desktop | Docker Engine |
|---|---|---|
| Supported OS | macOS, Windows, Linux | Linux only |
| License | Paid for large enterprises (250+ employees / $10M+ revenue) | Free (Apache 2.0) |
| GUI | Yes (dashboard) | No |
| Compose | Bundled | Separate install required (plugin) |
| Kubernetes | Bundled (one-click enable) | Separate install required |
| VM | Built-in (macOS/Windows) | Not needed |
| Resource usage | High (VM overhead) | Low |
| Use case | Local development | Production servers, CI/CD |
| Extensions | Available from marketplace | None |
| Dev Environments | Supported | None |
| Volume Management | Manageable via GUI | CLI only |

### 1.2 Docker Architecture

```
+--------------------------------------------------------------------+
|                     Docker のアーキテクチャ                           |
|                                                                    |
|  +-------------------+     +------------------------------+       |
|  |   Docker Client   |     |   Docker Host (デーモン)       |       |
|  |                   |     |                              |       |
|  |  docker build     | --> |  +------------------------+  |       |
|  |  docker pull      | API |  |     Docker Daemon       |  |       |
|  |  docker run       | --> |  |     (dockerd)           |  |       |
|  |  docker compose   |     |  +------|-------|----------+  |       |
|  +-------------------+     |         |       |             |       |
|                            |    +----v--+ +--v--------+   |       |
|                            |    |Images | |Containers |   |       |
|                            |    +-------+ +-----------+   |       |
|                            |    |Networks| |Volumes    |   |       |
|                            |    +-------+ +-----------+   |       |
|                            +------------------------------+       |
|                                         |                         |
|                                         | docker push/pull        |
|                                         v                         |
|                            +------------------------------+       |
|                            |       Registry               |       |
|                            |   (Docker Hub, GHCR, ECR)    |       |
|                            +------------------------------+       |
+--------------------------------------------------------------------+
```

Docker uses a **client-server architecture**. The Docker Client (CLI) sends commands to the Docker Daemon (dockerd) via REST API, and the daemon handles creating, running, and managing containers. Understanding this mechanism is useful for troubleshooting connection errors and permission issues.

### 1.3 Container Runtime Options

Container runtimes other than Docker also exist. Select the appropriate tool based on your project requirements.

| Runtime | Features | Use Case |
|---|---|---|
| Docker Engine | Most widely used | Development and production in general |
| Podman | Daemonless, rootless | RHEL/Fedora environments |
| containerd | Lightweight runtime | Kubernetes CRI |
| CRI-O | Kubernetes-specific | Kubernetes nodes |
| nerdctl | containerd CLI | Docker CLI compatible |
| Colima | Lightweight VM for macOS | Docker Desktop alternative |
| Rancher Desktop | GUI-based alternative | Docker Desktop alternative |
| OrbStack | High-speed VM for macOS only | Docker Desktop alternative (fast) |

---

## 2. Installation on macOS

### 2.1 Docker Desktop (Recommended)

```bash
# Method 1: Download from the official website
# https://www.docker.com/products/docker-desktop/
# Choose between Apple Silicon (M1/M2/M3/M4) and Intel versions

# Method 2: Install via Homebrew
brew install --cask docker

# After installation, launch Docker.app from Applications
open /Applications/Docker.app

# On first launch, you will be prompted to allow installation of helper tools
# Enter your password to allow
```

### 2.2 Colima (Docker Desktop Alternative)

If Docker Desktop licensing is a concern, or if you need a lighter-weight environment, Colima is available.

```bash
# Install Colima
brew install colima docker docker-compose docker-credential-helper

# Start Colima (default settings: 2 CPU, 2 GB memory)
colima start

# Start with custom settings
colima start --cpu 4 --memory 8 --disk 60

# x86_64 emulation on Apple Silicon
colima start --arch x86_64

# Start with Kubernetes
colima start --kubernetes

# Check status
colima status

# Stop
colima stop

# Delete
colima delete
```

### 2.3 OrbStack (Fast Alternative)

OrbStack is a macOS-only Docker Desktop alternative that excels in startup speed and resource efficiency.

```bash
# Install OrbStack
brew install --cask orbstack

# After installation, the docker command automatically connects to OrbStack
docker version
# Client: OrbStack
# Server: Docker Engine via OrbStack

# Switching between Docker Desktop
# Co-existence settings with Docker Desktop are available in OrbStack's settings
```

### 2.4 Verification

```bash
# Check that the Docker daemon is running
docker version

# Expected output:
# Client:
#  Cloud integration: v1.0.35
#  Version:           24.0.7
# Server: Docker Desktop 4.x.x
#  Engine:
#   Version:          24.0.7

# Run the Hello World container
docker run --rm hello-world

# Expected output:
# Hello from Docker!
# This message shows that your installation appears to be working correctly.

# Check Docker Compose version
docker compose version
# Docker Compose version v2.x.x

# Check detailed Docker information
docker info
# Server Version, Storage Driver, OS/Arch, etc. are displayed

# Check if BuildKit is enabled
docker buildx version
# github.com/docker/buildx v0.x.x
```

### 2.5 Notes for Apple Silicon (ARM64)

```bash
# Check if an ARM64 image exists
docker manifest inspect --verbose nginx:alpine | grep architecture
# "architecture": "arm64"

# Force use of AMD64 image (when there are compatibility issues)
docker run --platform linux/amd64 --rm nginx:alpine nginx -v

# Prepare for multi-platform builds
docker buildx create --name mybuilder --use
docker buildx inspect --bootstrap

# Run a multi-platform build
docker buildx build --platform linux/amd64,linux/arm64 \
    -t my-app:v1.0.0 --push .

# Check Rosetta 2 emulation
# Docker Desktop > Settings > General > Use Rosetta for x86_64/amd64 emulation
# Enabling Rosetta speeds up execution of amd64 images

# When using QEMU-based emulation
docker run --platform linux/amd64 --rm alpine uname -m
# x86_64

# Check platform information
docker run --rm alpine uname -m
# aarch64 (when running ARM64 natively)
```

### 2.6 VirtioFS Settings on macOS

On macOS, Docker runs inside a VM, so file system performance is important.

```bash
# Check VirtioFS (Docker Desktop > Settings > General)
# "Choose file sharing implementation for your containers"
# -> Select VirtioFS (recommended)

# Performance comparison: VirtioFS vs gRPC FUSE vs osxfs
# Benchmark example: npm install for a Node.js project
# osxfs:    120 seconds
# gRPC FUSE: 80 seconds
# VirtioFS:  45 seconds

# Optimized file sync settings
# Specify the consistency option in docker-compose.yml
# services:
#   app:
#     volumes:
#       - ./src:/app/src:cached    # Delayed sync host -> container is OK
#       - ./logs:/app/logs:delegated  # Delayed sync container -> host is OK
```

---

## 3. Installation on Windows

### 3.1 Prerequisite: WSL2

```
+----------------------------------------------------+
|              Windows での Docker 構成                |
|                                                    |
|  +----------------------------------------------+ |
|  |            Docker Desktop                     | |
|  |  +------+  +-----+  +----+  +-------------+ | |
|  |  | CLI  |  | GUI |  | API|  | Compose     | | |
|  |  +------+  +-----+  +----+  +-------------+ | |
|  +---------------------|------------------------+ |
|                        v                          |
|  +----------------------------------------------+ |
|  |              WSL2 (Linux カーネル)             | |
|  |  +----------------------------------------+  | |
|  |  |      Docker Engine (Linux)             |  | |
|  |  |  +----------+  +------------------+   |  | |
|  |  |  |containerd|  | イメージストレージ  |   |  | |
|  |  |  +----------+  +------------------+   |  | |
|  |  +----------------------------------------+  | |
|  +----------------------------------------------+ |
|              Windows ホスト OS                     |
+----------------------------------------------------+
```

```powershell
# Enable WSL2 in PowerShell (Administrator)
wsl --install

# Install a specific distribution
wsl --install -d Ubuntu-22.04

# Confirm WSL2 is the default
wsl --set-default-version 2

# Check WSL version
wsl --list --verbose
# NAME                   STATE           VERSION
# * Ubuntu               Running         2

# List available distributions
wsl --list --online

# Configure WSL2 memory limits (recommended)
# Create %USERPROFILE%\.wslconfig
# [wsl2]
# memory=8GB
# processors=4
# swap=2GB
# localhostForwarding=true
```

### 3.2 Docker Desktop Installation

```powershell
# Method 1: Download from the official website
# https://www.docker.com/products/docker-desktop/

# Method 2: Install via winget
winget install Docker.DockerDesktop

# Method 3: Install via Chocolatey
choco install docker-desktop

# A restart may be required after installation
# Check Settings > General > "Use the WSL 2 based engine"
```

### 3.3 Windows-Specific Settings

```powershell
# Configure WSL2 integration
# Docker Desktop > Settings > Resources > WSL integration
# Select the WSL distribution to use

# Windows Firewall settings
# Docker Desktop automatically adds firewall rules during installation
# If there are issues, manually allow Docker Desktop Backend

# Windows Defender exclusion settings (performance improvement)
# Add the following paths to exclusions:
# - C:\ProgramData\Docker
# - C:\Users\<username>\AppData\Local\Docker
# - WSL2 file system (\\wsl$)

# Add exclusions via PowerShell
Add-MpPreference -ExclusionPath "C:\ProgramData\Docker"
Add-MpPreference -ExclusionPath "$env:LOCALAPPDATA\Docker"
```

### 3.4 Verification

```powershell
# Check via PowerShell
docker version
docker run --rm hello-world

# Confirm you can also use it from within the WSL2 distribution
wsl -d Ubuntu -e docker version

# Check Docker Compose
docker compose version

# Check volume path conversion
# Conversion between Windows paths and Linux paths
docker run --rm -v "C:\Users\user\project:/app" alpine ls /app
# Or from within WSL2
docker run --rm -v "/mnt/c/Users/user/project:/app" alpine ls /app

# Switching to Windows containers (if needed)
# Select "Switch to Windows containers" from the Docker Desktop tray icon
# * Linux containers are normally used
```

### 3.5 WSL2 Troubleshooting

```powershell
# If WSL2 does not start
# 1. Check if virtualization is enabled (configure in BIOS/UEFI)
systeminfo | findstr /i "Hyper-V"

# 2. Update WSL2 kernel
wsl --update

# 3. Reset WSL2
wsl --shutdown
wsl

# 4. If the Docker daemon does not start
# Check Docker Desktop logs
# %LOCALAPPDATA%\Docker\log\

# 5. DNS resolution issues
# Check /etc/resolv.conf inside WSL2
wsl -d Ubuntu -e cat /etc/resolv.conf
# Confirm nameserver is configured

# 6. If memory consumption is high
# Set memory limit in .wslconfig
# [wsl2]
# memory=4GB

# Apply settings
wsl --shutdown
```

---

## 4. Installation on Linux (Ubuntu/Debian)

### 4.1 Docker Engine Installation

```bash
# Remove old versions
sudo apt-get remove docker docker-engine docker.io containerd runc

# Install required packages
sudo apt-get update
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add the repository
echo \
  "deb [arch=$(dpkg --print-architecture) \
  signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install -y \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin
```

### 4.2 Installation on Linux (RHEL/Fedora)

```bash
# Remove old versions
sudo dnf remove docker docker-client docker-client-latest \
    docker-common docker-latest docker-latest-logrotate \
    docker-logrotate docker-engine

# Add the repository
sudo dnf -y install dnf-plugins-core
sudo dnf config-manager --add-repo \
    https://download.docker.com/linux/fedora/docker-ce.repo

# Install Docker Engine
sudo dnf install -y \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin

# Start and enable the service
sudo systemctl start docker
sudo systemctl enable docker
```

### 4.3 Installation on Linux (Arch Linux)

```bash
# Install Docker
sudo pacman -S docker docker-compose docker-buildx

# Start and enable the service
sudo systemctl start docker
sudo systemctl enable docker

# Add user to the docker group
sudo usermod -aG docker $USER
newgrp docker
```

### 4.4 Installation on Linux (Alpine)

```bash
# Install Docker
sudo apk add docker docker-compose docker-cli-buildx

# Start and enable the service
sudo rc-update add docker boot
sudo service docker start

# Add user to the docker group
sudo addgroup $USER docker
```

### 4.5 Post-Installation Configuration

```bash
# Add user to the docker group (allows running without sudo)
sudo usermod -aG docker $USER

# Apply group change (re-login or run the following)
newgrp docker

# Verify
docker run --rm hello-world
# Success if it runs without sudo

# Check Docker service status
sudo systemctl status docker

# Configure Docker service to start automatically
sudo systemctl enable docker.service
sudo systemctl enable containerd.service
```

### 4.6 Installing a Specific Version

```bash
# List available versions
apt-cache madison docker-ce
# docker-ce | 5:24.0.7-1~ubuntu.22.04~jammy | ...
# docker-ce | 5:24.0.6-1~ubuntu.22.04~jammy | ...

# Install a specific version
VERSION_STRING=5:24.0.7-1~ubuntu.22.04~jammy
sudo apt-get install -y \
    docker-ce=$VERSION_STRING \
    docker-ce-cli=$VERSION_STRING \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin

# Pin the version (prevent automatic updates)
sudo apt-mark hold docker-ce docker-ce-cli

# Unpin
sudo apt-mark unhold docker-ce docker-ce-cli
```

### 4.7 Convenience Script (Not Recommended but Useful)

```bash
# Docker's official convenience script (for test/development environments)
# For production, use the manual installation above
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# DRY RUN (does not actually install)
DRY_RUN=1 sh ./get-docker.sh

# Note: the convenience script is not recommended for production for these reasons:
# - May overwrite existing Docker configuration
# - Runs with root privileges without a security review
# - Cannot control version precisely
```

---

## 5. Initial Configuration

### 5.1 Docker Daemon Configuration

```bash
# Create/edit /etc/docker/daemon.json
sudo tee /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "default-address-pools": [
    {
      "base": "172.17.0.0/16",
      "size": 24
    }
  ],
  "dns": ["8.8.8.8", "8.8.4.4"],
  "features": {
    "buildkit": true
  }
}
EOF

# Apply settings
sudo systemctl restart docker
```

### 5.2 Detailed daemon.json Configuration

```bash
# Detailed configuration example for production environments
sudo tee /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "5",
    "compress": "true"
  },
  "storage-driver": "overlay2",
  "storage-opts": [
    "overlay2.override_kernel_check=true"
  ],
  "default-address-pools": [
    {
      "base": "172.17.0.0/12",
      "size": 24
    }
  ],
  "dns": ["8.8.8.8", "8.8.4.4"],
  "dns-search": ["example.com"],
  "bip": "172.17.0.1/16",
  "fixed-cidr": "172.17.0.0/24",
  "features": {
    "buildkit": true
  },
  "live-restore": true,
  "userland-proxy": false,
  "no-new-privileges": true,
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 65536,
      "Soft": 32768
    },
    "nproc": {
      "Name": "nproc",
      "Hard": 4096,
      "Soft": 2048
    }
  },
  "max-concurrent-downloads": 10,
  "max-concurrent-uploads": 5,
  "max-download-attempts": 5,
  "shutdown-timeout": 15,
  "debug": false,
  "tls": false,
  "insecure-registries": [],
  "registry-mirrors": []
}
EOF

# Validate configuration (before restarting the daemon)
sudo dockerd --validate --config-file /etc/docker/daemon.json

# Apply settings
sudo systemctl daemon-reload
sudo systemctl restart docker

# Verify settings were applied
docker info
```

### 5.3 daemon.json Settings Reference

| Setting | Description | Recommended Value |
|---|---|---|
| `log-driver` | Log driver | `json-file` (default) |
| `log-opts.max-size` | Maximum log file size | `10m` - `50m` |
| `log-opts.max-file` | Number of log file rotations | `3` - `5` |
| `storage-driver` | Storage driver | `overlay2` |
| `live-restore` | Keep containers running when daemon stops | `true` (production) |
| `userland-proxy` | Userland proxy | `false` (performance) |
| `no-new-privileges` | Prevent privilege escalation | `true` (security) |
| `default-ulimits` | Default ulimit for containers | Depends on project |
| `max-concurrent-downloads` | Number of concurrent downloads | `10` |
| `insecure-registries` | Non-HTTPS registries | Empty in production |
| `registry-mirrors` | Registry mirrors | Configure as rate limit countermeasure |
| `debug` | Debug mode | `false` (production) |

### 5.4 Docker Desktop Settings (GUI)

```
+------------------------------------------------------------+
|  Docker Desktop Settings                                   |
|                                                            |
|  General                                                   |
|  [x] Start Docker Desktop when you sign in                |
|  [x] Use the WSL 2 based engine (Windows)                 |
|  [x] Use Virtualization framework (macOS)                 |
|  [x] VirtioFS (macOS, recommended)                        |
|                                                            |
|  Resources                                                 |
|  +------------------------------------------------------+ |
|  |  CPUs:    [====------]  4 / 10                       | |
|  |  Memory:  [======----]  8 GB / 16 GB                 | |
|  |  Swap:    [==--------]  1 GB                         | |
|  |  Disk:    [========--]  64 GB                        | |
|  +------------------------------------------------------+ |
|                                                            |
|  Docker Engine (daemon.json can be edited directly)        |
|  Kubernetes                                                |
|  [x] Enable Kubernetes                                    |
|                                                            |
|  Software Updates                                          |
|  [x] Automatically check for updates                      |
|  [ ] Always download updates                              |
+------------------------------------------------------------+
```

### 5.5 Configuration for Proxy Environments

Configuration for when a proxy is used in a corporate network or similar environment.

```bash
# Docker daemon proxy settings
sudo mkdir -p /etc/systemd/system/docker.service.d/
sudo tee /etc/systemd/system/docker.service.d/http-proxy.conf <<'EOF'
[Service]
Environment="HTTP_PROXY=http://proxy.example.com:8080"
Environment="HTTPS_PROXY=http://proxy.example.com:8080"
Environment="NO_PROXY=localhost,127.0.0.1,docker-registry.example.com,.corp"
EOF

# Apply settings
sudo systemctl daemon-reload
sudo systemctl restart docker

# Verify settings
sudo systemctl show --property=Environment docker

# Docker client-side proxy settings
mkdir -p ~/.docker
cat > ~/.docker/config.json <<'EOF'
{
  "proxies": {
    "default": {
      "httpProxy": "http://proxy.example.com:8080",
      "httpsProxy": "http://proxy.example.com:8080",
      "noProxy": "localhost,127.0.0.1,.corp"
    }
  }
}
EOF

# Proxy settings at build time
docker build \
    --build-arg HTTP_PROXY=http://proxy.example.com:8080 \
    --build-arg HTTPS_PROXY=http://proxy.example.com:8080 \
    --build-arg NO_PROXY=localhost,127.0.0.1 \
    -t my-app .
```

### 5.6 Docker Storage Settings

```bash
# When changing the Docker data directory
# Default: /var/lib/docker
# For example, when you want to change to a high-capacity storage

# Method 1: Specify in daemon.json
sudo tee /etc/docker/daemon.json <<'EOF'
{
  "data-root": "/mnt/docker-data"
}
EOF

# Method 2: Migrate existing data
sudo systemctl stop docker
sudo rsync -aP /var/lib/docker/ /mnt/docker-data/
sudo mv /var/lib/docker /var/lib/docker.bak
sudo ln -s /mnt/docker-data /var/lib/docker
sudo systemctl start docker

# Check storage driver
docker info | grep "Storage Driver"
# Storage Driver: overlay2

# Check disk usage
docker system df
# TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
# Images          15        5         4.2GB     2.8GB (66%)
# Containers      8         3         120MB     80MB (66%)
# Local Volumes   12        4         1.5GB     800MB (53%)
# Build Cache     50        0         2.1GB     2.1GB
```

### Comparison Table 2: Installation Methods by Linux Distribution

| Distribution | Package Manager | Repository Setup | Notes |
|---|---|---|---|
| Ubuntu 22.04/24.04 | apt | docker.list | Most stable |
| Debian 12 (Bookworm) | apt | docker.list | Same as Ubuntu |
| Fedora 38/39/40 | dnf | docker-ce.repo | Note SELinux |
| RHEL 9 / Rocky 9 | dnf | docker-ce.repo | Podman is default |
| Arch Linux | pacman | Official repository | `pacman -S docker` |
| Alpine | apk | community repository | `apk add docker` |
| openSUSE | zypper | Docker official repo | `zypper install docker` |
| Amazon Linux 2023 | dnf | extras repository | `dnf install docker` |

---

## 6. Verification Checklist

### 6.1 Basic Checks

```bash
# 1. Check Docker version
docker version
# Both Client and Server versions should be displayed

# 2. Check Docker information
docker info
# Confirm Server Version, Storage Driver, OS/Arch are correct

# 3. Run Hello World
docker run --rm hello-world
# "Hello from Docker!" message should be displayed

# 4. Verify container lifecycle
docker run -d --name test-nginx -p 8080:80 nginx:alpine
curl http://localhost:8080  # nginx default page
docker stop test-nginx
docker rm test-nginx

# 5. Verify volume behavior
docker volume create test-vol
docker run --rm -v test-vol:/data alpine sh -c "echo 'test' > /data/test.txt"
docker run --rm -v test-vol:/data alpine cat /data/test.txt
# "test" should be displayed
docker volume rm test-vol

# 6. Verify Docker Compose
docker compose version
# Docker Compose version v2.x.x

# 7. Verify BuildKit
docker buildx version
# github.com/docker/buildx v0.x.x
```

### 6.2 Detailed Checks

```bash
# 8. Check networks
docker network ls
# NETWORK ID     NAME      DRIVER    SCOPE
# abc123         bridge    bridge    local
# def456         host      host      local
# ghi789         none      null      local

# 9. Check DNS resolution
docker run --rm alpine nslookup google.com
# Name:      google.com
# Address 1: xxx.xxx.xxx.xxx

# 10. Check image pull
docker pull alpine:latest
docker pull nginx:alpine

# 11. Check inter-container communication
docker network create test-net
docker run -d --name server --network test-net nginx:alpine
docker run --rm --network test-net alpine \
    wget -qO- http://server:80
docker stop server && docker rm server
docker network rm test-net

# 12. Check resource limit behavior
docker run --rm --memory=128m --cpus=0.5 alpine \
    sh -c "cat /sys/fs/cgroup/memory.max 2>/dev/null || echo 'cgroup v1'"

# 13. Docker Compose integration test
cat > /tmp/docker-compose-test.yml <<'EOF'
services:
  web:
    image: nginx:alpine
    ports:
      - "8888:80"
  app:
    image: alpine
    command: sleep 30
    depends_on:
      - web
EOF
docker compose -f /tmp/docker-compose-test.yml up -d
docker compose -f /tmp/docker-compose-test.yml ps
docker compose -f /tmp/docker-compose-test.yml down
rm /tmp/docker-compose-test.yml
```

### 6.3 Performance Benchmark

```bash
# Disk I/O test
docker run --rm alpine sh -c "
    dd if=/dev/zero of=/tmp/testfile bs=1M count=100 conv=fsync 2>&1 | tail -1
    rm /tmp/testfile
"

# Network throughput test
docker run --rm alpine sh -c "
    apk add --no-cache curl > /dev/null 2>&1
    curl -o /dev/null -s -w '%{speed_download}' https://speed.cloudflare.com/__down?bytes=10000000
    echo ' bytes/sec'
"

# Build speed test
time docker build --no-cache -t test-build - <<'EOF'
FROM alpine:latest
RUN apk add --no-cache curl wget git
RUN echo "Build test complete"
EOF
docker rmi test-build
```

---

## 7. Security Settings

### 7.1 Protecting the Docker Socket

```bash
# Check Docker socket permissions
ls -la /var/run/docker.sock
# srw-rw---- 1 root docker 0 ... /var/run/docker.sock

# Check docker group members
getent group docker
# docker:x:999:user1,user2

# Note: members of the docker group effectively have root privileges
# Only add trusted users

# Remote access via TCP socket (TLS required)
# Use TLS certificates in production environments

# Generate CA certificate
openssl genrsa -aes256 -out ca-key.pem 4096
openssl req -new -x509 -days 365 -key ca-key.pem -sha256 -out ca.pem

# Generate server certificate
openssl genrsa -out server-key.pem 4096
openssl req -subj "/CN=docker-host" -sha256 -new -key server-key.pem -out server.csr
echo subjectAltName = DNS:docker-host,IP:192.168.1.100 > extfile.cnf
openssl x509 -req -days 365 -sha256 -in server.csr -CA ca.pem \
    -CAkey ca-key.pem -CAcreateserial -out server-cert.pem -extfile extfile.cnf

# Add TLS settings to daemon.json
sudo tee /etc/docker/daemon.json <<'EOF'
{
  "tls": true,
  "tlscacert": "/etc/docker/certs/ca.pem",
  "tlscert": "/etc/docker/certs/server-cert.pem",
  "tlskey": "/etc/docker/certs/server-key.pem",
  "hosts": ["unix:///var/run/docker.sock", "tcp://0.0.0.0:2376"]
}
EOF
```

### 7.2 Rootless Docker

```bash
# Install Rootless Docker (run Docker without root privileges)
# For Ubuntu/Debian
sudo apt-get install -y uidmap dbus-user-session

# Set up Rootless Docker
dockerd-rootless-setuptool.sh install

# Configure environment variables
export PATH=/usr/bin:$PATH
export DOCKER_HOST=unix:///run/user/$(id -u)/docker.sock

# Add to ~/.bashrc
echo 'export DOCKER_HOST=unix:///run/user/$(id -u)/docker.sock' >> ~/.bashrc

# Start Rootless Docker
systemctl --user start docker
systemctl --user enable docker

# Verify
docker info | grep "rootless"
# rootless: true
```

### 7.3 Security Best Practices

```bash
# Run Docker Bench for Security
docker run --rm --net host --pid host \
    --cap-add audit_control \
    -v /var/lib:/var/lib:ro \
    -v /var/run/docker.sock:/var/run/docker.sock:ro \
    -v /usr/lib/systemd:/usr/lib/systemd:ro \
    -v /etc:/etc:ro \
    docker/docker-bench-security

# Enable Content Trust (allow only signed images)
export DOCKER_CONTENT_TRUST=1

# Check AppArmor profile (Ubuntu)
docker info | grep "Security Options"
# Security Options: apparmor, seccomp, cgroupns

# Check seccomp profile
docker info --format '{{ .SecurityOptions }}'
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Installing from OS Default Packages Instead of Official Repository

```bash
# NG: The Docker in OS default repositories is often outdated
sudo apt install docker.io
# -> Version may be old, and BuildKit and Compose V2 may not be available

# OK: Install from Docker's official repository
# (Follow the steps in Section 4 above)
sudo apt-get install docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
# -> Latest features and security patches are applied
```

### Anti-Pattern 2: Running Docker Directly as Root

```bash
# NG: Always using sudo with Docker
sudo docker run ...
sudo docker build ...
# -> Files created become root-owned, causing permission issues

# OK: Add user to the docker group
sudo usermod -aG docker $USER
newgrp docker
docker run ...
# -> Runs with user privileges. However, note that the docker group
#    has root-equivalent permissions (only add trusted users)
```

### Anti-Pattern 3: Using Docker Desktop with Default Resource Settings

```bash
# NG: Developing with default settings
# -> Builds are slow due to insufficient memory, containers stop with OOM

# OK: Adjust resources according to the project
# Docker Desktop > Settings > Resources
# - For development: CPU 4 cores / Memory 8GB
# - Build-focused: CPU 6 cores / Memory 12GB
# - Production testing: CPU 8 cores / Memory 16GB
```

### Anti-Pattern 4: Not Configuring Logging

```bash
# NG: Running containers long-term without log limits
docker run -d --name app my-app
# -> Log files grow infinitely and consume disk space

# OK: Set default log limits in daemon.json
# "log-opts": { "max-size": "10m", "max-file": "3" }
# Or specify per container
docker run -d --name app \
    --log-opt max-size=10m \
    --log-opt max-file=3 \
    my-app
```

### Anti-Pattern 5: Mounting the Docker Socket into a Container

```bash
# NG: Mounting the Docker socket without restrictions
docker run -v /var/run/docker.sock:/var/run/docker.sock my-tool
# -> Container can access all Docker resources on the host
# -> Becomes an attack vector for container escape

# OK: If necessary, use read-only + least-privilege user
docker run \
    -v /var/run/docker.sock:/var/run/docker.sock:ro \
    --user $(id -u):$(getent group docker | cut -d: -f3) \
    my-tool
# Or use a Docker API proxy (Tecnativa/docker-socket-proxy)
```

---

## 8. Troubleshooting

### 8.1 Common Errors and Solutions

```bash
# Error: "Cannot connect to the Docker daemon"
# Cause: Docker daemon is not running
# Solution:
sudo systemctl start docker
# For Docker Desktop, launch the application

# Error: "Got permission denied while trying to connect to the Docker daemon socket"
# Cause: User does not belong to the docker group
# Solution:
sudo usermod -aG docker $USER
# Log out -> Log in (or newgrp docker)

# Error: "no space left on device"
# Cause: Docker disk space is exhausted
# Solution:
docker system prune -a --volumes
docker system df  # Check usage

# Error: "port is already allocated"
# Cause: Port is being used by another process
# Solution:
# Linux
sudo lsof -i :8080
sudo ss -tlnp | grep 8080
# macOS
lsof -i :8080

# Error: "image platform does not match"
# Cause: Architecture mismatch (ARM vs x86)
# Solution:
docker run --platform linux/amd64 my-image
# Or use an image for the appropriate platform

# Error: "OCI runtime create failed"
# Cause: Container runtime issue
# Solution:
sudo systemctl restart docker
# Or restart containerd
sudo systemctl restart containerd
```

### 8.2 How to Check Logs

```bash
# Check Docker daemon logs
# For systemd
sudo journalctl -u docker.service -f
sudo journalctl -u docker.service --since "1 hour ago"

# Docker Desktop logs
# macOS: ~/Library/Containers/com.docker.docker/Data/log/
# Windows: %LOCALAPPDATA%\Docker\log\

# Check container logs
docker logs <container-name>
docker logs -f --tail 100 <container-name>

# Monitor Docker events
docker events
docker events --since "30m"
docker events --filter 'type=container' --filter 'event=die'
```

### 8.3 Resetting Docker

```bash
# Stop and remove all containers
docker stop $(docker ps -aq) 2>/dev/null
docker rm $(docker ps -aq) 2>/dev/null

# Remove all images
docker rmi $(docker images -aq) 2>/dev/null

# Remove all volumes
docker volume prune -f

# Remove all networks
docker network prune -f

# Remove build cache
docker builder prune -af

# Full reset (remove all resources)
docker system prune -af --volumes

# Full reset of Docker Desktop
# Docker Desktop > Troubleshoot > Reset to factory defaults

# Complete uninstall and reinstall of Docker Engine on Linux
sudo systemctl stop docker
sudo apt-get purge docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
sudo rm -rf /var/lib/docker
sudo rm -rf /var/lib/containerd
sudo rm -f /etc/docker/daemon.json
# Run the reinstall procedure
```


---

## Practice Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement error handling appropriately
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
            raise ValueError("入力値がNoneです")
        return True

    def process(self, value):
        """Main logic for data processing"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Get processing results"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# Test
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "例外が発生するべき"
    except ValueError:
        pass

    print("全テスト合格!")

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
        """Add an item (with size limit)"""
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
        """Remove by key"""
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

# Test
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
    print("応用テスト全合格!")

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

    print(f"非効率版: {slow_time:.4f}秒")
    print(f"効率版:   {fast_time:.6f}秒")
    print(f"高速化率: {slow_time/fast_time:.0f}倍")

benchmark()
```

**Key Points:**
- Be aware of algorithm complexity
- Select appropriate data structures
- Measure effectiveness with benchmarks

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the decision criteria for making technology choices.

| Criteria | When to Prioritize | When to Compromise |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin screens, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│              アーキテクチャ選択フロー              │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① チーム規模は？                                │
│    ├─ 小規模（1-5人）→ モノリス                   │
│    └─ 大規模（10人+）→ ②へ                       │
│                                                 │
│  ② デプロイ頻度は？                               │
│    ├─ 週1回以下 → モノリス + モジュール分割         │
│    └─ 毎日/複数回 → ③へ                          │
│                                                 │
│  ③ チーム間の独立性は？                            │
│    ├─ 高い → マイクロサービス                      │
│    └─ 中程度 → モジュラーモノリス                   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- A faster approach in the short term can become technical debt in the long term
- Conversely, over-engineering has high short-term costs and can delay the project

**2. Consistency vs Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies allows best-fit choices but increases operational costs

**3. Level of Abstraction**
- High abstraction has high reusability but can make debugging difficult
- Low abstraction is intuitive but tends to cause code duplication

```python
# Design decision recording template
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
        md += f"## 背景\n{self.context}\n\n"
        md += f"## 決定\n{self.decision}\n\n"
        md += "## 結果\n"
        for c in self.consequences:
            icon = "✅" if c['type'] == 'positive' else "⚠️"
            md += f"- {icon} {c['description']}\n"
        md += "\n## 却下した代替案\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```
---

## 9. FAQ

### Q1: What scope does the Docker Desktop paid license apply to?

**A:** Docker Desktop requires a paid subscription for commercial use in companies with 250 or more employees AND annual revenue of $10M or more (as of 2024). Individual developers, open source projects, small businesses, and educational use are free. Docker Engine (CLI only) is fully open source and free regardless of company size. For large enterprises using Docker Desktop, consider the Docker Business plan ($24 per user per month). Alternatives include open source tools such as Colima, Rancher Desktop, and OrbStack.

### Q2: Docker is slow on macOS. How can I improve this?

**A:** On macOS, Docker runs inside a VM, so I/O is slower than native Linux. Improvement options include:
- Enable **VirtioFS** (Docker Desktop > Settings > General > VirtioFS)
- **Reduce unnecessary bind mounts** (use named volumes for node_modules, etc.)
- **Increase resource allocation** (CPU / Memory)
- Exclude unnecessary files from the build context with **.dockerignore**
- Enable **Rosetta 2 emulation** (when using amd64 images on Apple Silicon)
- Switch to **OrbStack** (often faster than Docker Desktop)
- Use `cached` / `delegated` mount options in **development docker-compose.yml**

### Q3: Which is better, WSL2 or Hyper-V backend?

**A:** The WSL2 backend is recommended. Compared to Hyper-V, WSL2 uses less memory, starts faster, and has better compatibility with the Linux file system. You can also use Docker CLI directly from within WSL2 distributions, providing a development experience close to Linux native. Another consideration is that the Hyper-V backend cannot be used on Windows Home Edition.

### Q4: How do I upgrade Docker?

**A:** For Docker Desktop, automatic updates are available from the GUI. For Docker Engine, follow these steps:

```bash
# Check current version
docker version

# Update packages
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io

# Check after update
docker version
```

It is recommended to stop containers and take backups before updating. If `live-restore: true` is configured, containers will be preserved when the daemon restarts.

### Q5: Should I use Docker or Podman?

**A:** Docker is the most widely used with a rich ecosystem and extensive documentation. Podman is provided as the default tool in RHEL/Fedora environments and has security advantages due to being daemonless and rootless. It has high compatibility with the Docker CLI, so migration is often possible with `alias docker=podman`. Choose based on your company's policies and OS environment.

### Q6: How do I install Docker in a CI/CD environment?

**A:** In CI/CD environments, Docker-in-Docker (DinD) or mounting the Docker socket are common approaches:

```yaml
# Docker setup in GitHub Actions
# Docker is pre-installed, so no additional setup is needed

# DinD in GitLab CI
services:
  - docker:dind
variables:
  DOCKER_HOST: tcp://docker:2375

# Docker in Jenkins
# Install Docker on the Jenkins agent
# Or use the Docker Pipeline plugin
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and confirming behavior.

### Q2: What mistakes do beginners often make?

Skipping the basics and moving on to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 10. Summary

| Item | Key Points |
|---|---|
| macOS | Install Docker Desktop via Homebrew or the official website. Alternatives: Colima, OrbStack |
| Windows | Enable WSL2 and install Docker Desktop. Limit resources via .wslconfig |
| Linux | Install Docker Engine from Docker's official repository. Avoid OS default packages |
| Initial Setup | Configure logging, storage, and DNS in daemon.json. Enable live-restore in production |
| User Permissions | Add user to the docker group. Consider Rootless Docker for production |
| Verification | Verify with `docker run --rm hello-world`. Also check network and volumes |
| Resources | Adjust CPU/Memory according to the project. Improve I/O performance with VirtioFS |
| Security | Audit with Docker Bench. Use TLS settings, Content Trust, and seccomp |
| Proxy | In corporate environments, proxy settings are required for both daemon and client |

---

## What to Read Next

- [02-docker-basics.md](./02-docker-basics.md) -- Basic Docker operations (run, stop, rm, logs, exec)
- [03-image-management.md](./03-image-management.md) -- Image management and registries
- [../01-dockerfile/00-dockerfile-basics.md](../01-dockerfile/00-dockerfile-basics.md) -- Dockerfile basics

---

## References

1. **Docker Documentation - Install Docker Engine** https://docs.docker.com/engine/install/ -- Official installation instructions for each OS. Always refer here for the latest procedures.
2. **Docker Desktop Release Notes** https://docs.docker.com/desktop/release-notes/ -- Docker Desktop changelog. Used to check new features and bug fixes.
3. **Microsoft - WSL2 Documentation** https://learn.microsoft.com/en-us/windows/wsl/ -- Official WSL2 documentation. Essential for using Docker on Windows.
4. **Docker Documentation - Post-installation steps for Linux** https://docs.docker.com/engine/install/linux-postinstall/ -- Recommended settings after Linux installation.
5. **Docker Documentation - Docker daemon configuration** https://docs.docker.com/reference/cli/dockerd/#daemon-configuration-file -- Reference for all daemon.json settings.
6. **Docker Security Best Practices** https://docs.docker.com/develop/security-best-practices/ -- Docker security best practices guide.
7. **Colima - Container runtimes on macOS** https://github.com/abiosoft/colima -- Docker Desktop alternative for macOS.
8. **OrbStack - Fast, light, simple Docker** https://orbstack.dev/ -- High-speed Docker environment for macOS.

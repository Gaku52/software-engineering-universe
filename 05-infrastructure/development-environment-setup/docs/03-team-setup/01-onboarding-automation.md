# Onboarding Automation

> Learn how to design setup scripts and Makefiles that let new members build their development environment with a single command, reducing onboarding time from days to minutes.

## What You Will Learn

1. **Designing and implementing setup scripts** -- Build scripts that abstract platform differences and automate everything from dependency installation to the first build
2. **Building a task runner with Makefile** -- Standardize common development tasks under `make` commands to replace written procedures
3. **Automating environment validation and troubleshooting** -- Establish mechanisms to automatically verify setup success and collect diagnostic information when problems occur
4. **Best practices for multi-platform support** -- Learn cross-platform script design techniques that handle the differences between macOS, Linux, and Windows (WSL2)
5. **Validating setup scripts in CI/CD** -- Build automated tests to prevent setup scripts from becoming stale


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Project Standards](./00-project-standards.md)

---

## 1. The Onboarding Problem

```
+------------------------------------------------------------------+
|          Traditional Onboarding vs. Automation                   |
+------------------------------------------------------------------+
|                                                                  |
|  [Traditional - Documentation-Based]                            |
|  1. Read Confluence documentation (30 min)                       |
|  2. Install Homebrew (10 min)                                    |
|  3. Install Node.js -> wrong version (30 min)                   |
|  4. npm install -> error (1 hour)                                |
|  5. Install PostgreSQL -> configuration unclear (1 hour)         |
|  6. Set environment variables -> unclear what to set (30 min)   |
|  7. Ask a senior dev -> consuming their time too (2 hours)       |
|  Total: 1-2 days                                                 |
|                                                                  |
|  [Automated]                                                     |
|  1. git clone && make setup                                      |
|  Total: 5-15 minutes                                             |
|                                                                  |
+------------------------------------------------------------------+
```

### 1.1 Return on Investment for Onboarding Automation

| Metric | Manual (per year) | Automated (per year) | Reduction |
|--------|------------------|---------------------|-----------|
| Setup time per new member | 8-16 hours | 0.5-1 hour | 90% reduction |
| Senior engineer support time | 4-8 hours | 0-0.5 hours | 95% reduction |
| Total effort for 5 new hires per year | 60-120 hours | 2.5-7.5 hours | 95% reduction |
| Setup-related inquiries | 10-20 per month | 0-2 per month | 90% reduction |
| Bugs due to environment mismatch | 5-10 per month | 0-1 per month | 90% reduction |
| Initial automation script build cost | -- | 8-16 hours | -- |
| Monthly maintenance cost | -- | 1-2 hours | -- |

### 1.2 Onboarding Automation Architecture

```
+------------------------------------------------------------------+
|              Onboarding Automation Overview                       |
+------------------------------------------------------------------+
|                                                                  |
|  [Entry Point]                                                   |
|  make setup                                                      |
|    |                                                             |
|    v                                                             |
|  scripts/setup.sh                                                |
|    |                                                             |
|    +-- OS detection (macOS / Linux / WSL2)                       |
|    +-- Prerequisite tool check & install                         |
|    |   +-- Homebrew (macOS)                                      |
|    |   +-- git, curl, jq                                         |
|    |   +-- Docker Desktop / Docker Engine                        |
|    |   +-- Node.js version manager (fnm)                         |
|    +-- Node.js setup (per .nvmrc)                                |
|    +-- Dependency installation (pnpm install)                    |
|    +-- Environment variable setup (.env.example -> .env)         |
|    +-- Docker service startup (DB, Redis, etc.)                  |
|    +-- Database migration & seed                                 |
|    +-- Health check & validation                                 |
|    |                                                             |
|    v                                                             |
|  "Setup Complete! Run: make dev"                                 |
|                                                                  |
|  [Daily Operations]                                              |
|  make dev      -- Start development server                       |
|  make test     -- Run tests                                      |
|  make lint     -- Run lint checks                                |
|  make doctor   -- Diagnose environment                           |
|  make help     -- List all commands                              |
|                                                                  |
+------------------------------------------------------------------+
```

---

## 2. Setup Scripts

### 2.1 Main Script

```bash
#!/bin/bash
# scripts/setup.sh
# Initial project setup script

set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# OS detection
detect_os() {
  case "$(uname -s)" in
    Darwin*) echo "macos" ;;
    Linux*)  echo "linux" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *) echo "unknown" ;;
  esac
}

OS=$(detect_os)
log_info "OS detected: $OS"

# ======================================
# 1. Check and install prerequisites
# ======================================
check_prerequisites() {
  log_info "Checking prerequisites..."

  # Git
  if command -v git &>/dev/null; then
    log_ok "Git $(git --version | cut -d' ' -f3)"
  else
    log_error "Git not found"
    exit 1
  fi

  # Docker
  if command -v docker &>/dev/null; then
    log_ok "Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"
  else
    log_warn "Docker is not installed. Required for local services such as DB"
    log_info "  macOS: brew install --cask docker"
    log_info "  Linux: https://docs.docker.com/engine/install/"
  fi

  # Node.js version manager
  if command -v fnm &>/dev/null; then
    log_ok "fnm $(fnm --version)"
  elif command -v nvm &>/dev/null; then
    log_ok "nvm installed"
  elif command -v volta &>/dev/null; then
    log_ok "volta $(volta --version)"
  else
    log_warn "No Node.js version manager installed"
    install_node_manager
  fi
}

install_node_manager() {
  log_info "Installing fnm..."
  case "$OS" in
    macos)
      if command -v brew &>/dev/null; then
        brew install fnm
      else
        curl -fsSL https://fnm.vercel.app/install | bash
      fi
      ;;
    linux)
      curl -fsSL https://fnm.vercel.app/install | bash
      ;;
    *)
      log_error "Please install fnm manually: https://github.com/Schniz/fnm"
      ;;
  esac
}

# ======================================
# 2. Node.js setup
# ======================================
setup_node() {
  log_info "Setting up Node.js..."

  # Read version from .nvmrc
  if [ -f .nvmrc ]; then
    NODE_VERSION=$(cat .nvmrc | tr -d '[:space:]')
  elif [ -f .node-version ]; then
    NODE_VERSION=$(cat .node-version | tr -d '[:space:]')
  else
    NODE_VERSION="20"
  fi

  if command -v fnm &>/dev/null; then
    fnm install "$NODE_VERSION"
    fnm use "$NODE_VERSION"
  elif command -v nvm &>/dev/null; then
    nvm install "$NODE_VERSION"
    nvm use "$NODE_VERSION"
  fi

  log_ok "Node.js $(node --version)"
}

# ======================================
# 3. Install dependencies
# ======================================
install_dependencies() {
  log_info "Installing dependencies..."

  if [ -f pnpm-lock.yaml ]; then
    if ! command -v pnpm &>/dev/null; then
      npm install -g pnpm
    fi
    pnpm install --frozen-lockfile
    log_ok "pnpm install complete"
  elif [ -f yarn.lock ]; then
    if ! command -v yarn &>/dev/null; then
      npm install -g yarn
    fi
    yarn install --frozen-lockfile
    log_ok "yarn install complete"
  else
    npm ci
    log_ok "npm ci complete"
  fi
}

# ======================================
# 4. Environment variable setup
# ======================================
setup_env() {
  log_info "Setting up environment variables..."

  if [ -f .env.example ] && [ ! -f .env ]; then
    cp .env.example .env
    log_ok "Created .env from .env.example"
    log_warn "Please review .env values and update as needed"
  elif [ -f .env ]; then
    log_ok ".env already exists"
  else
    log_warn ".env.example not found"
  fi
}

# ======================================
# 5. Start Docker services
# ======================================
setup_services() {
  log_info "Starting Docker services..."

  if command -v docker &>/dev/null && [ -f docker-compose.yml ]; then
    docker compose up -d
    log_info "Waiting for services to start..."
    sleep 5
    log_ok "Docker services started"
  else
    log_warn "Skipping Docker Compose"
  fi
}

# ======================================
# 6. Database setup
# ======================================
setup_database() {
  log_info "Setting up database..."

  if [ -f prisma/schema.prisma ]; then
    npx prisma migrate dev 2>/dev/null || npx prisma migrate deploy
    log_ok "Prisma migration complete"

    if npx prisma db seed 2>/dev/null; then
      log_ok "Seed data inserted"
    fi
  elif [ -f knexfile.js ] || [ -f knexfile.ts ]; then
    npx knex migrate:latest
    npx knex seed:run 2>/dev/null || true
    log_ok "Knex migration complete"
  fi
}

# ======================================
# 7. Validation
# ======================================
verify_setup() {
  log_info "Verifying setup..."
  local errors=0

  # Node.js version
  if node --version &>/dev/null; then
    log_ok "Node.js: $(node --version)"
  else
    log_error "Node.js is not working"
    ((errors++))
  fi

  # TypeScript compilation
  if npx tsc --noEmit 2>/dev/null; then
    log_ok "TypeScript compilation successful"
  else
    log_warn "TypeScript has errors (can be fixed later)"
  fi

  # DB connection
  if command -v docker &>/dev/null; then
    if docker compose exec -T postgres pg_isready 2>/dev/null; then
      log_ok "PostgreSQL connection available"
    else
      log_warn "Cannot connect to PostgreSQL"
    fi
  fi

  if [ "$errors" -gt 0 ]; then
    log_error "$errors error(s) found"
    return 1
  fi

  return 0
}

# ======================================
# Main execution
# ======================================
main() {
  echo ""
  echo "=================================="
  echo "  Project Setup Script"
  echo "=================================="
  echo ""

  check_prerequisites
  setup_node
  install_dependencies
  setup_env
  setup_services
  setup_database
  verify_setup

  echo ""
  echo "=================================="
  echo -e "  ${GREEN}Setup Complete!${NC}"
  echo "=================================="
  echo ""
  echo "You can start development with the following commands:"
  echo ""
  echo "  make dev    # Start development server"
  echo "  make test   # Run tests"
  echo "  make help   # List all commands"
  echo ""
}

main "$@"
```

### 2.2 macOS Setup with Homebrew

On macOS, you can use Homebrew's Brewfile to declaratively install required tools.

```ruby
# Brewfile
# Declaratively install macOS development tools
# Run: brew bundle

# === CLI Tools ===
brew "git"
brew "gh"           # GitHub CLI
brew "jq"           # JSON parser
brew "yq"           # YAML parser
brew "fnm"          # Node.js version manager
brew "mise"         # Multi-language version manager
brew "shellcheck"   # Shell script linter
brew "act"          # Run GitHub Actions locally
brew "direnv"       # Per-directory environment variables

# === Containers ===
cask "docker"       # Docker Desktop
brew "lazydocker"   # Docker TUI

# === Database Tools ===
brew "postgresql@16"  # PostgreSQL client (psql)
brew "redis"          # Redis client

# === Editor ===
cask "visual-studio-code"
# cask "cursor"       # AI editor

# === Fonts ===
cask "font-jetbrains-mono"
cask "font-jetbrains-mono-nerd-font"

# === Other Tools ===
cask "iterm2"       # Terminal
cask "raycast"      # Launcher
cask "figma"        # Design tool
```

```bash
# Setup script using Brewfile (for macOS)
#!/bin/bash
# scripts/setup-macos.sh

set -euo pipefail

# If Homebrew is not installed
if ! command -v brew &>/dev/null; then
  echo "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Install Brewfile packages
echo "Installing Brewfile packages..."
brew bundle --file=Brewfile

# Add fnm shell configuration
if ! grep -q "fnm env" ~/.zshrc 2>/dev/null; then
  echo 'eval "$(fnm env --use-on-cd)"' >> ~/.zshrc
  echo "Added fnm shell configuration to .zshrc"
fi

echo "macOS setup complete"
```

### 2.3 Linux (Ubuntu/Debian) Setup

```bash
#!/bin/bash
# scripts/setup-linux.sh
# Setup script for Ubuntu/Debian

set -euo pipefail

log_info() { echo -e "\033[0;34m[INFO]\033[0m  $1"; }
log_ok()   { echo -e "\033[0;32m[OK]\033[0m    $1"; }

# Install base packages
log_info "Installing base packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
  build-essential \
  curl \
  wget \
  git \
  jq \
  unzip \
  ca-certificates \
  gnupg \
  lsb-release

# Install Docker
if ! command -v docker &>/dev/null; then
  log_info "Installing Docker..."
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  log_ok "Docker installation complete (re-login required)"
fi

# Verify Docker Compose V2
if docker compose version &>/dev/null; then
  log_ok "Docker Compose $(docker compose version --short)"
fi

# Install fnm
if ! command -v fnm &>/dev/null; then
  log_info "Installing fnm..."
  curl -fsSL https://fnm.vercel.app/install | bash
  export PATH="$HOME/.local/share/fnm:$PATH"
  eval "$(fnm env)"
fi

# Install GitHub CLI
if ! command -v gh &>/dev/null; then
  log_info "Installing GitHub CLI..."
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | \
    sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | \
    sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq gh
fi

log_ok "Linux setup complete"
```

### 2.4 WSL2 Environment Setup

```bash
#!/bin/bash
# scripts/setup-wsl.sh
# Additional setup for WSL2 (Windows Subsystem for Linux)

set -euo pipefail

log_info() { echo -e "\033[0;34m[INFO]\033[0m  $1"; }
log_ok()   { echo -e "\033[0;32m[OK]\033[0m    $1"; }
log_warn() { echo -e "\033[0;33m[WARN]\033[0m  $1"; }

# Detect WSL2
if [ -z "${WSL_DISTRO_NAME:-}" ]; then
  echo "Please run this script in a WSL2 environment"
  exit 1
fi

log_info "WSL2 environment: ${WSL_DISTRO_NAME}"

# Check configuration to use Docker Desktop on the Windows side
if command -v docker &>/dev/null; then
  log_ok "Docker is available"
else
  log_warn "Please install Docker Desktop for Windows and enable WSL2 integration"
  log_info "  Settings > Resources > WSL Integration > Enable ${WSL_DISTRO_NAME}"
fi

# Guide to use WSL filesystem instead of /mnt/c
CURRENT_DIR=$(pwd)
if [[ "$CURRENT_DIR" == /mnt/* ]]; then
  log_warn "Working on Windows filesystem"
  log_warn "For better performance, place your repository on the WSL filesystem (e.g., ~/projects/)"
  log_info "  Example: cd ~ && mkdir -p projects && cd projects"
fi

# Git line ending configuration
git config --global core.autocrlf input
log_ok "Set Git autocrlf to input"

# Run Linux setup
bash scripts/setup-linux.sh

log_ok "WSL2 setup complete"
```

---

## 3. Makefile

### 3.1 Project Makefile

```makefile
# Makefile
.PHONY: help setup dev test lint format build clean docker-up docker-down db-migrate db-seed

# Default target
.DEFAULT_GOAL := help

# Variables
NODE_BIN := ./node_modules/.bin
DOCKER_COMPOSE := docker compose

# ======================================
# Help (make help)
# ======================================
help: ## Display list of commands
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ======================================
# Initial setup
# ======================================
setup: ## Initial setup (new members run this)
	@bash scripts/setup.sh

setup-quick: node_modules .env ## Quick setup (dependencies only)
	@echo "Quick setup complete"

node_modules: package.json pnpm-lock.yaml
	pnpm install --frozen-lockfile
	@touch node_modules

.env:
	cp .env.example .env
	@echo ".env created from .env.example"

# ======================================
# Development
# ======================================
dev: ## Start development server
	$(NODE_BIN)/next dev

dev-all: docker-up ## Start all services + development server
	$(NODE_BIN)/next dev

dev-turbo: ## Start development server in turbo mode
	$(NODE_BIN)/next dev --turbo

# ======================================
# Testing
# ======================================
test: ## Run tests
	$(NODE_BIN)/vitest run

test-watch: ## Run tests (watch mode)
	$(NODE_BIN)/vitest

test-coverage: ## Run tests + coverage
	$(NODE_BIN)/vitest run --coverage

test-e2e: ## Run E2E tests
	$(NODE_BIN)/playwright test

test-e2e-ui: ## Run E2E tests (UI mode)
	$(NODE_BIN)/playwright test --ui

# ======================================
# Code quality
# ======================================
lint: ## Run lint checks
	$(NODE_BIN)/eslint src/
	$(NODE_BIN)/tsc --noEmit

lint-fix: ## Auto-fix lint issues
	$(NODE_BIN)/eslint src/ --fix

format: ## Format code
	$(NODE_BIN)/prettier --write "src/**/*.{ts,tsx,json,css}"

format-check: ## Check formatting (for CI)
	$(NODE_BIN)/prettier --check "src/**/*.{ts,tsx,json,css}"

typecheck: ## TypeScript type check
	$(NODE_BIN)/tsc --noEmit

check: lint format-check typecheck test ## Run all quality checks (equivalent to CI)

# ======================================
# Build
# ======================================
build: ## Production build
	$(NODE_BIN)/next build

build-analyze: ## Build with bundle analysis
	ANALYZE=true $(NODE_BIN)/next build

# ======================================
# Docker
# ======================================
docker-up: ## Start Docker services
	$(DOCKER_COMPOSE) up -d
	@echo "Waiting for services..."
	@sleep 3
	@$(DOCKER_COMPOSE) ps

docker-down: ## Stop Docker services
	$(DOCKER_COMPOSE) down

docker-logs: ## Show Docker logs
	$(DOCKER_COMPOSE) logs -f

docker-clean: ## Remove everything including Docker volumes
	$(DOCKER_COMPOSE) down -v --remove-orphans

docker-rebuild: ## Rebuild Docker images
	$(DOCKER_COMPOSE) build --no-cache
	$(DOCKER_COMPOSE) up -d

# ======================================
# Database
# ======================================
db-migrate: ## Run migrations
	$(NODE_BIN)/prisma migrate dev

db-seed: ## Insert seed data
	$(NODE_BIN)/prisma db seed

db-reset: ## Reset DB (delete all data)
	$(NODE_BIN)/prisma migrate reset --force

db-studio: ## Start Prisma Studio
	$(NODE_BIN)/prisma studio

db-generate: ## Regenerate Prisma Client
	$(NODE_BIN)/prisma generate

# ======================================
# Code generation
# ======================================
generate: ## Run all code generation
	$(NODE_BIN)/prisma generate
	$(NODE_BIN)/graphql-codegen

generate-api: ## Generate client from OpenAPI
	$(NODE_BIN)/openapi-typescript api/openapi.yaml -o src/types/api.d.ts

# ======================================
# Utilities
# ======================================
clean: ## Delete build artifacts
	rm -rf .next dist node_modules/.cache

clean-all: clean ## Delete all caches (including node_modules)
	rm -rf node_modules

doctor: ## Diagnose environment
	@bash scripts/doctor.sh

update-deps: ## Check for dependency updates
	$(NODE_BIN)/npm-check-updates -u
	pnpm install

storybook: ## Start Storybook
	$(NODE_BIN)/storybook dev -p 6006

storybook-build: ## Build Storybook
	$(NODE_BIN)/storybook build
```

### 3.2 Flow Visualization

```
+------------------------------------------------------------------+
|              Makefile Task Dependencies                          |
+------------------------------------------------------------------+
|                                                                  |
|  [Initial Setup]                                                 |
|  make setup                                                      |
|    +-- scripts/setup.sh                                          |
|        +-- check_prerequisites                                   |
|        +-- setup_node                                            |
|        +-- install_dependencies (= node_modules)                 |
|        +-- setup_env (= .env)                                    |
|        +-- setup_services (= docker-up)                          |
|        +-- setup_database (= db-migrate + db-seed)               |
|        +-- verify_setup                                          |
|                                                                  |
|  [Daily Development]                                             |
|  make dev-all                                                    |
|    +-- docker-up (DB, Redis, etc.)                               |
|    +-- next dev                                                  |
|                                                                  |
|  [CI]                                                            |
|  make check                                                      |
|    +-- lint (ESLint + TypeScript)                                |
|    +-- format-check (Prettier)                                   |
|    +-- typecheck (tsc --noEmit)                                  |
|    +-- test (Vitest)                                             |
|                                                                  |
|  [Release]                                                       |
|  make build                                                      |
|    +-- next build                                                |
|                                                                  |
+------------------------------------------------------------------+
```

### 3.3 Advanced Makefile Techniques

```makefile
# Makefile (advanced configuration example)

# Specify shell (to use bash features)
SHELL := /bin/bash

# Variables
-include .env  # Load .env file (skip if not present)

PROJECT_NAME := myapp
GIT_HASH := $(shell git rev-parse --short HEAD)
GIT_BRANCH := $(shell git rev-parse --abbrev-ref HEAD)
TIMESTAMP := $(shell date +%Y%m%d-%H%M%S)

# Conditional execution based on file dependencies
# Re-install only if node_modules is older than package.json
node_modules: package.json pnpm-lock.yaml
	pnpm install --frozen-lockfile
	@touch $@

# Environment variable validation
.PHONY: check-env
check-env: ## Validate environment variables
	@test -n "$(DATABASE_URL)" || (echo "DATABASE_URL is not set" && exit 1)
	@test -n "$(REDIS_URL)" || (echo "REDIS_URL is not set" && exit 1)
	@echo "Environment variables OK"

# Parallel execution example
.PHONY: ci
ci: ## Run CI pipeline in parallel
	@$(MAKE) -j4 lint typecheck format-check test

# Container image build
.PHONY: docker-build
docker-build: ## Build Docker image
	docker build \
		--build-arg GIT_HASH=$(GIT_HASH) \
		--build-arg BUILD_TIME=$(TIMESTAMP) \
		-t $(PROJECT_NAME):$(GIT_HASH) \
		-t $(PROJECT_NAME):latest \
		.

# Secret leak detection
.PHONY: secrets-scan
secrets-scan: ## Check for secret leaks
	@if command -v gitleaks &>/dev/null; then \
		gitleaks detect --source . --verbose; \
	else \
		echo "gitleaks is not installed: brew install gitleaks"; \
	fi

# License check
.PHONY: license-check
license-check: ## Check licenses of dependency packages
	$(NODE_BIN)/license-checker --production --onlyAllow \
		'MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;0BSD;CC0-1.0'
```

---

## 4. Environment Diagnostic Script (doctor)

```bash
#!/bin/bash
# scripts/doctor.sh
# Script to diagnose environment problems

set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

pass=0
warn=0
fail=0

check() {
  local name="$1"
  local cmd="$2"
  local expected="$3"

  if eval "$cmd" &>/dev/null; then
    echo -e "${GREEN}PASS${NC}  $name"
    ((pass++))
  elif [ -n "$expected" ]; then
    echo -e "${RED}FAIL${NC}  $name -- $expected"
    ((fail++))
  else
    echo -e "${YELLOW}WARN${NC}  $name"
    ((warn++))
  fi
}

check_version() {
  local name="$1"
  local cmd="$2"
  local expected="$3"
  local actual

  actual=$(eval "$cmd" 2>/dev/null | tr -d '[:space:]' || echo "")
  expected=$(echo "$expected" | tr -d '[:space:]')

  if [ "$actual" = "$expected" ]; then
    echo -e "${GREEN}PASS${NC}  $name: $actual"
    ((pass++))
  elif [ -n "$actual" ]; then
    echo -e "${YELLOW}WARN${NC}  $name: $actual (expected: $expected)"
    ((warn++))
  else
    echo -e "${RED}FAIL${NC}  $name: not found"
    ((fail++))
  fi
}

echo ""
echo "=== Environment Doctor ==="
echo ""

echo "--- System ---"
echo -e "${BLUE}INFO${NC}  OS: $(uname -s) $(uname -r)"
echo -e "${BLUE}INFO${NC}  Shell: $SHELL"
echo -e "${BLUE}INFO${NC}  User: $(whoami)"
echo ""

echo "--- Tools ---"
check "Git" "command -v git" "Please install git"
check "Node.js" "command -v node" "Please install Node.js"
check "Docker" "command -v docker" "Please install Docker"
check "Docker Compose" "docker compose version" "Docker Compose V2 is required"
check "pnpm" "command -v pnpm" "Run: npm install -g pnpm"
check "GitHub CLI (gh)" "command -v gh" "Optional: brew install gh"

echo ""
echo "--- Node.js ---"
if [ -f .nvmrc ]; then
  check_version "Node version matches .nvmrc" \
    "node -v | tr -d 'v'" \
    "$(cat .nvmrc 2>/dev/null)"
elif [ -f .node-version ]; then
  check_version "Node version matches .node-version" \
    "node -v | tr -d 'v'" \
    "$(cat .node-version 2>/dev/null)"
fi
check "node_modules exists" "[ -d node_modules ]" "Run: make setup"
check "TypeScript compiles" "npx tsc --noEmit 2>/dev/null" ""

echo ""
echo "--- Services ---"
check "Docker daemon running" "docker info" "Please start Docker Desktop"
check "PostgreSQL reachable" "pg_isready -h localhost -p 5432 2>/dev/null" ""
check "Redis reachable" "redis-cli -h localhost ping 2>/dev/null" ""

echo ""
echo "--- Files ---"
check ".env exists" "[ -f .env ]" "Run: cp .env.example .env"
check ".env has DATABASE_URL" "grep -q DATABASE_URL .env 2>/dev/null" ""
check ".env has REDIS_URL" "grep -q REDIS_URL .env 2>/dev/null" ""

echo ""
echo "--- Ports ---"
check "Port 3000 available" "! lsof -i :3000 -sTCP:LISTEN" "Port 3000 is in use"
check "Port 5432 (PostgreSQL)" "lsof -i :5432 -sTCP:LISTEN" ""
check "Port 6379 (Redis)" "lsof -i :6379 -sTCP:LISTEN" ""

echo ""
echo "--- Git ---"
check "Git user.name configured" "git config user.name" "git config --global user.name 'Your Name'"
check "Git user.email configured" "git config user.email" "git config --global user.email 'your@email.com'"
check "On main/develop branch" "git rev-parse --abbrev-ref HEAD | grep -E '^(main|develop)$'" ""

echo ""
echo "==========================="
echo -e "Results: ${GREEN}${pass} passed${NC}, ${YELLOW}${warn} warnings${NC}, ${RED}${fail} failed${NC}"
echo ""

if [ "$fail" -gt 0 ]; then
  echo -e "${RED}There are issues with your environment. Please fix the FAIL items above.${NC}"
  echo ""
fi

exit $fail
```

### 4.1 Auto-fix Script (doctor --fix)

```bash
#!/bin/bash
# scripts/doctor-fix.sh
# Fix automatically repairable issues

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

log_fix()  { echo -e "${GREEN}[FIX]${NC}  $1"; }
log_skip() { echo -e "${YELLOW}[SKIP]${NC} $1"; }

echo ""
echo "=== Auto Fix ==="
echo ""

# Create .env file
if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
  log_fix "Created .env file"
else
  log_skip ".env already exists"
fi

# Install node_modules
if [ ! -d node_modules ]; then
  echo "Installing node_modules..."
  if [ -f pnpm-lock.yaml ]; then
    pnpm install --frozen-lockfile
  elif [ -f yarn.lock ]; then
    yarn install --frozen-lockfile
  else
    npm ci
  fi
  log_fix "Installed node_modules"
else
  log_skip "node_modules already exists"
fi

# Start Docker services
if command -v docker &>/dev/null && [ -f docker-compose.yml ]; then
  RUNNING=$(docker compose ps --services --filter "status=running" 2>/dev/null | wc -l | tr -d ' ')
  DEFINED=$(docker compose config --services 2>/dev/null | wc -l | tr -d ' ')

  if [ "$RUNNING" -lt "$DEFINED" ]; then
    docker compose up -d
    log_fix "Started Docker services"
  else
    log_skip "All Docker services are already running"
  fi
fi

# Switch Node.js version
if [ -f .nvmrc ]; then
  EXPECTED=$(cat .nvmrc | tr -d '[:space:]')
  ACTUAL=$(node -v 2>/dev/null | tr -d 'v[:space:]')

  if [ "$ACTUAL" != "$EXPECTED" ]; then
    if command -v fnm &>/dev/null; then
      fnm install "$EXPECTED" && fnm use "$EXPECTED"
      log_fix "Switched Node.js to $EXPECTED"
    elif command -v nvm &>/dev/null; then
      nvm install "$EXPECTED" && nvm use "$EXPECTED"
      log_fix "Switched Node.js to $EXPECTED"
    fi
  else
    log_skip "Node.js version is correct ($ACTUAL)"
  fi
fi

# Regenerate Prisma Client
if [ -f prisma/schema.prisma ]; then
  npx prisma generate 2>/dev/null
  log_fix "Regenerated Prisma Client"
fi

echo ""
echo "=== Fix Complete ==="
echo "Run 'make doctor' to verify the state"
echo ""
```

---

## 5. .env.example Template

```bash
# .env.example
# Copy this file to create .env
# cp .env.example .env

# ===== Application =====
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
APP_NAME=MyApp

# ===== Database =====
# Must match the settings in docker-compose.yml
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/myapp_development

# ===== Redis =====
REDIS_URL=redis://localhost:6379

# ===== Email (MailHog) =====
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@example.com

# ===== Storage (MinIO) =====
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=uploads
S3_REGION=us-east-1

# ===== Authentication =====
JWT_SECRET=dev-secret-change-in-production
SESSION_SECRET=dev-session-secret
# OAuth (Google)
# GOOGLE_CLIENT_ID=xxx
# GOOGLE_CLIENT_SECRET=xxx
# OAuth (GitHub)
# GITHUB_CLIENT_ID=xxx
# GITHUB_CLIENT_SECRET=xxx

# ===== External APIs (development dummy values) =====
# STRIPE_SECRET_KEY=sk_test_xxx
# SENDGRID_API_KEY=SG.xxx
# OPENAI_API_KEY=sk-xxx

# ===== Monitoring =====
# SENTRY_DSN=https://xxx@sentry.io/xxx
# DATADOG_API_KEY=xxx

# ===== Logging =====
LOG_LEVEL=debug
LOG_FORMAT=pretty
```

### 5.1 .env Management Strategy

```
+------------------------------------------------------------------+
|              .env File Management Strategy                       |
+------------------------------------------------------------------+
|                                                                  |
|  .env.example          -- Committed to Git. Template file        |
|  .env                  -- Not in Git. Local configuration        |
|  .env.test             -- Can be committed. Test settings        |
|  .env.development      -- Can be committed. Shared dev settings  |
|  .env.local            -- Not in Git. Personal settings          |
|  .env.production.local -- Not in Git. Production settings        |
|                                                                  |
|  Load priority (for Next.js):                                    |
|  .env.local > .env.development > .env                            |
|                                                                  |
|  Secret Manager (production environment):                        |
|  - AWS Secrets Manager                                           |
|  - Google Secret Manager                                         |
|  - HashiCorp Vault                                               |
|  - Doppler                                                       |
|  - Infisical                                                     |
|                                                                  |
+------------------------------------------------------------------+
```

### 5.2 .env Validation Script

```bash
#!/bin/bash
# scripts/validate-env.sh
# Validate required fields in .env file

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

ENV_FILE="${1:-.env}"
ERRORS=0

# List of required environment variables
REQUIRED_VARS=(
  "DATABASE_URL"
  "REDIS_URL"
  "JWT_SECRET"
  "SESSION_SECRET"
)

# Warning-level environment variables
OPTIONAL_VARS=(
  "SMTP_HOST"
  "S3_ENDPOINT"
)

echo "=== .env Validation ==="
echo "File: $ENV_FILE"
echo ""

if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}FAIL${NC} $ENV_FILE not found"
  echo "  Run: cp .env.example .env"
  exit 1
fi

# Required checks
echo "--- Required ---"
for var in "${REQUIRED_VARS[@]}"; do
  if grep -q "^${var}=" "$ENV_FILE" 2>/dev/null; then
    VALUE=$(grep "^${var}=" "$ENV_FILE" | cut -d'=' -f2-)
    if [ -z "$VALUE" ] || [ "$VALUE" = "xxx" ]; then
      echo -e "${RED}FAIL${NC} $var: value is not set"
      ((ERRORS++))
    else
      echo -e "${GREEN}PASS${NC} $var"
    fi
  else
    echo -e "${RED}FAIL${NC} $var: key not found"
    ((ERRORS++))
  fi
done

echo ""

# Optional checks
echo "--- Optional ---"
for var in "${OPTIONAL_VARS[@]}"; do
  if grep -q "^${var}=" "$ENV_FILE" 2>/dev/null; then
    echo -e "${GREEN}SET ${NC} $var"
  else
    echo -e "SKIP $var (not set)"
  fi
done

echo ""

# Security checks
echo "--- Security ---"
# Check for remaining default values
if grep -q "dev-secret-change-in-production" "$ENV_FILE" 2>/dev/null; then
  echo -e "${RED}WARN${NC} JWT_SECRET is the default value (change it in non-development environments)"
fi

# Check for production secrets
if grep -qE "^(STRIPE_SECRET_KEY|SENDGRID_API_KEY)=.+[^x]" "$ENV_FILE" 2>/dev/null; then
  echo -e "${RED}WARN${NC} Production API keys may be present"
fi

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo -e "${RED}$ERRORS error(s) found${NC}"
  exit 1
else
  echo -e "${GREEN}Validation OK${NC}"
fi
```

---

## 6. Docker Compose Development Environment

### 6.1 Standard docker-compose.yml Template

```yaml
# docker-compose.yml
# Service configuration for local development

services:
  # === PostgreSQL ===
  postgres:
    image: postgres:16-alpine
    container_name: myapp-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: myapp_development
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  # === Redis ===
  redis:
    image: redis:7-alpine
    container_name: myapp-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  # === MailHog (email verification) ===
  mailhog:
    image: mailhog/mailhog:latest
    container_name: myapp-mailhog
    ports:
      - "1025:1025"   # SMTP
      - "8025:8025"   # Web UI

  # === MinIO (S3-compatible storage) ===
  minio:
    image: minio/minio:latest
    container_name: myapp-minio
    ports:
      - "9000:9000"   # API
      - "9001:9001"   # Console
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

### 6.2 Service Wait Script

```bash
#!/bin/bash
# scripts/wait-for-services.sh
# Wait until Docker services become available

set -euo pipefail

MAX_RETRIES=30
RETRY_INTERVAL=2

wait_for_service() {
  local name="$1"
  local check_cmd="$2"
  local retries=0

  echo -n "Waiting for $name..."
  while ! eval "$check_cmd" &>/dev/null; do
    retries=$((retries + 1))
    if [ "$retries" -ge "$MAX_RETRIES" ]; then
      echo " TIMEOUT"
      return 1
    fi
    echo -n "."
    sleep "$RETRY_INTERVAL"
  done
  echo " OK"
}

wait_for_service "PostgreSQL" "pg_isready -h localhost -p 5432"
wait_for_service "Redis" "redis-cli -h localhost ping"

echo ""
echo "All services are ready!"
```

---

## 7. Task Runner Comparison

| Tool | Config File | Language | Parallel Execution | Dependency Management | Learning Cost |
|------|------------|---------|-------------------|----------------------|--------------|
| Make | Makefile | Shell | Limited | File dependencies | Low |
| npm scripts | package.json | Shell | npm-run-all | None | Lowest |
| just | justfile | Shell | None | None | Low |
| task (Taskfile) | Taskfile.yml | YAML+Shell | Yes | Task dependencies | Low |
| turbo | turbo.json | JSON | Yes (fast) | Package dependencies | Medium |
| nx | nx.json | JSON | Yes (fast) | Project graph | High |

### 7.1 just Configuration Example

just is a Rust-based command runner designed as a Make alternative that eliminates the complexity of Makefiles.

```just
# justfile

# Default recipe
default:
  @just --list

# Initial setup
setup:
  bash scripts/setup.sh

# Start development server
dev:
  pnpm next dev

# Start all services + development server
dev-all: docker-up
  pnpm next dev

# Test
test *ARGS:
  pnpm vitest run {{ARGS}}

# Test (watch mode)
test-watch:
  pnpm vitest

# Lint
lint:
  pnpm eslint src/
  pnpm tsc --noEmit

# Auto-fix lint
lint-fix:
  pnpm eslint src/ --fix

# Format
format:
  pnpm prettier --write "src/**/*.{ts,tsx,json,css}"

# Build
build:
  pnpm next build

# Start Docker
docker-up:
  docker compose up -d

# Stop Docker
docker-down:
  docker compose down

# DB migration
db-migrate:
  pnpm prisma migrate dev

# DB reset
db-reset:
  pnpm prisma migrate reset --force

# Environment diagnostics
doctor:
  bash scripts/doctor.sh

# Run all quality checks (equivalent to CI)
check: lint
  pnpm prettier --check "src/**/*.{ts,tsx,json,css}"
  pnpm vitest run
```

### 7.2 Taskfile (task) Configuration Example

```yaml
# Taskfile.yml
version: '3'

vars:
  NODE_BIN: ./node_modules/.bin

tasks:
  default:
    desc: Display list of commands
    cmds:
      - task --list

  setup:
    desc: Initial setup
    cmds:
      - bash scripts/setup.sh

  dev:
    desc: Start development server
    cmds:
      - "{{.NODE_BIN}}/next dev"

  test:
    desc: Run tests
    cmds:
      - "{{.NODE_BIN}}/vitest run"

  lint:
    desc: Run lint checks
    cmds:
      - "{{.NODE_BIN}}/eslint src/"
      - "{{.NODE_BIN}}/tsc --noEmit"

  build:
    desc: Production build
    cmds:
      - "{{.NODE_BIN}}/next build"

  docker:up:
    desc: Start Docker services
    cmds:
      - docker compose up -d
      - sleep 3
      - docker compose ps

  docker:down:
    desc: Stop Docker services
    cmds:
      - docker compose down

  db:migrate:
    desc: Run DB migration
    cmds:
      - "{{.NODE_BIN}}/prisma migrate dev"

  check:
    desc: Run all quality checks
    deps: [lint]
    cmds:
      - "{{.NODE_BIN}}/prettier --check 'src/**/*.{ts,tsx,json,css}'"
      - "{{.NODE_BIN}}/vitest run"
```

---

## 8. Setup Validation in CI/CD

### 8.1 Fresh Install Test

To prevent setup scripts from becoming stale, run fresh installs periodically in CI.

```yaml
# .github/workflows/fresh-install-test.yml
name: Fresh Install Test

on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9:00 UTC
  workflow_dispatch:

jobs:
  fresh-install:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20, 22]
    steps:
      - uses: actions/checkout@v4

      - name: Clean environment (simulate new developer)
        run: |
          rm -rf node_modules .env dist .next

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Run setup script
        run: |
          cp .env.example .env
          pnpm install --frozen-lockfile

      - name: Verify build
        run: pnpm run build

      - name: Verify tests pass
        run: pnpm run test -- --run

      - name: Verify lint passes
        run: pnpm run lint

  fresh-install-docker:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: myapp_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: '.node-version'

      - name: Setup with DB
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/myapp_test
          REDIS_URL: redis://localhost:6379
        run: |
          cp .env.example .env
          pnpm install --frozen-lockfile
          pnpm prisma migrate deploy
          pnpm prisma db seed
          pnpm run test -- --run
```

### 8.2 Automatic Setup Documentation Generation

```bash
#!/bin/bash
# scripts/generate-setup-docs.sh
# Automatically extract and document information needed for setup

set -euo pipefail

echo "# Development Environment Setup Guide"
echo ""
echo "Auto-generated: $(date +%Y-%m-%d)"
echo ""

# Node.js version
echo "## Required Node.js Version"
if [ -f .nvmrc ]; then
  echo "- Node.js: $(cat .nvmrc)"
elif [ -f .node-version ]; then
  echo "- Node.js: $(cat .node-version)"
fi
echo ""

# Package manager
echo "## Package Manager"
if [ -f pnpm-lock.yaml ]; then
  echo "- pnpm"
  PNPM_VERSION=$(grep -m1 'packageManager' package.json 2>/dev/null | grep -oP 'pnpm@\K[^"]+' || echo "latest")
  echo "- Version: $PNPM_VERSION"
elif [ -f yarn.lock ]; then
  echo "- yarn"
else
  echo "- npm"
fi
echo ""

# Docker services
if [ -f docker-compose.yml ]; then
  echo "## Docker Services"
  docker compose config --services 2>/dev/null | while read -r service; do
    IMAGE=$(docker compose config 2>/dev/null | grep -A5 "^  $service:" | grep "image:" | awk '{print $2}' || echo "custom")
    echo "- $service ($IMAGE)"
  done
  echo ""
fi

# Environment variables
if [ -f .env.example ]; then
  echo "## Environment Variables"
  echo ""
  echo '```bash'
  cat .env.example
  echo '```'
  echo ""
fi

# Make commands
if [ -f Makefile ]; then
  echo "## Available Commands"
  echo ""
  echo '```'
  grep -E '^[a-zA-Z_-]+:.*?## .*$' Makefile | sort | \
    awk 'BEGIN {FS = ":.*?## "}; {printf "make %-20s %s\n", $1, $2}'
  echo '```'
fi
```

---

## 9. Onboarding Checklist

### 9.1 Checklist for New Members

```markdown
# New Member Onboarding Checklist

## Day 1: Environment Setup
- [ ] Confirm you have been invited to the organization with your GitHub account
- [ ] Verify repository access permissions
- [ ] Clone the repository with `git clone`
- [ ] Run `make setup` (5-15 minutes)
- [ ] Confirm the development server starts with `make dev`
- [ ] Confirm tests pass with `make test`
- [ ] Confirm no environment issues with `make doctor`

## Day 1-2: Understanding the Development Flow
- [ ] Understand the branching strategy (main / develop / feature/*)
- [ ] Review the PR template
- [ ] Understand the commit message convention (Conventional Commits)
- [ ] Review the CI/CD pipeline flow
- [ ] Read the code review guidelines

## Day 2-3: Understanding the Codebase
- [ ] Review the directory structure
- [ ] Understand the overview of key modules
- [ ] Read the ADRs (Architecture Decision Records)
- [ ] Review the API documentation
- [ ] Understand the testing strategy

## Week 1: First Contribution
- [ ] Complete one Good First Issue
- [ ] Create a PR and receive a review
- [ ] Incorporate review feedback and get merged

## Reference Links
- Documentation site: http://docs.example.com
- Figma design: https://figma.com/xxx
- Slack channel: #team-dev
```

### 9.2 Checklist Automation

```bash
#!/bin/bash
# scripts/onboarding-check.sh
# Automatically check new member onboarding progress

set -uo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

total=0
passed=0

check_item() {
  local description="$1"
  local check_cmd="$2"
  ((total++))

  if eval "$check_cmd" &>/dev/null; then
    echo -e "${GREEN}[x]${NC} $description"
    ((passed++))
  else
    echo -e "${RED}[ ]${NC} $description"
  fi
}

echo ""
echo "=== Onboarding Progress Check ==="
echo ""

echo "--- Environment Setup ---"
check_item "Git is configured" "git config user.name && git config user.email"
check_item "Node.js is the correct version" "[ \"\$(node -v | tr -d 'v')\" = \"\$(cat .nvmrc 2>/dev/null | tr -d '[:space:]')\" ]"
check_item "node_modules is installed" "[ -d node_modules ]"
check_item ".env is configured" "[ -f .env ]"
check_item "Docker services are running" "docker compose ps --services --filter 'status=running' | grep -q ."
check_item "Tests pass" "npx vitest run --reporter=silent 2>/dev/null"

echo ""
echo "--- Git Configuration ---"
check_item "SSH key is configured" "ssh -T git@github.com 2>&1 | grep -qi 'success\\|authenticated'"
check_item "GitHub CLI is authenticated" "gh auth status 2>/dev/null"
check_item "husky hooks are installed" "[ -d .husky ]"

echo ""
echo "--- Tools ---"
check_item "VS Code is installed" "command -v code"
check_item "Docker is installed" "command -v docker"
check_item "pnpm is installed" "command -v pnpm"

echo ""
echo "==========================="
echo -e "Progress: ${GREEN}${passed}${NC}/${total} ($(( passed * 100 / total ))%)"
echo ""
```

---

## Anti-patterns

### Anti-pattern 1: Using Documentation Without Automation

```
# Bad: Manual steps written in Confluence
1. Download Node.js v20 from https://nodejs.org
2. Run the installer
3. Open terminal and run npm install
4. Copy .env.example to .env
5. Set DATABASE_URL as follows...
(continues for 20 steps)

# Good: Complete with 1 command
$ make setup
```

**Problem**: Documentation starts becoming outdated the moment it is written. Missing steps, wrong order, and unaddressed OS differences accumulate, causing new members to spend an entire day on configuration. When scripted, the documentation itself is validated and maintained as code.

### Anti-pattern 2: Setup Scripts Without Error Handling

```bash
# Bad: Continue ignoring errors
npm install
cp .env.example .env
npx prisma migrate dev
echo "Setup complete!"  # Displayed even if there was an error midway

# Good: Stop immediately on error with a clear message
set -euo pipefail

npm ci || { echo "npm ci failed. Check Node.js version."; exit 1; }

if [ ! -f .env ]; then
  cp .env.example .env
  echo ".env created. Review and update values."
fi

npx prisma migrate dev || { echo "DB migration failed. Is PostgreSQL running?"; exit 1; }

echo "Setup complete!"
```

**Problem**: Without `set -e`, errors are swallowed and subsequent steps run in an invalid state. New members end up in a situation where "the script succeeded but nothing works," wasting extra time on debugging.

### Anti-pattern 3: Scripts That Require Root Privileges

```bash
# Bad: Script that overuses sudo
sudo apt-get install nodejs
sudo npm install -g pnpm
sudo chmod -R 777 /var/data

# Good: Design to operate with user permissions
# Install in user space using version manager
fnm install 20
fnm use 20
# Set npm global installs to home directory
npm config set prefix ~/.npm-global
```

**Problem**: Scripts requiring `sudo` carry high security risk and administrator privileges are often restricted in corporate environments. Design scripts to complete entirely in user space where possible, and explicitly separate operations that require root privileges.

### Anti-pattern 4: Scripts That Don't Account for OS Differences

```bash
# Bad: Only works on macOS
brew install postgresql
open -a "Docker"

# Good: Detect OS and branch accordingly
case "$(uname -s)" in
  Darwin*)
    brew install postgresql
    open -a "Docker"
    ;;
  Linux*)
    sudo apt-get install -y postgresql-client
    sudo systemctl start docker
    ;;
  *)
    echo "Unsupported OS. Please install manually."
    exit 1
    ;;
esac
```

**Problem**: Scripts that only assume macOS cannot be used by CI/CD on Linux or WSL2 users. Detecting the OS and branching the process enables cross-platform support.

---

## FAQ

### Q1: Should I use Make or npm scripts?

**A**: Using both is practical. npm scripts are suited for package lifecycle hooks (`prepare`, `pretest`, etc.), while Make is suited for OS-level tasks (Docker operations, DB migrations, multi-step workflows). Makefile can list all commands with `make help`, giving high discoverability for new members. Where npm scripts and Make overlap, it is easier to manage by having Make call npm scripts.

### Q2: Can I use Make in a Windows environment?

**A**: It works fine via WSL2 (Windows Subsystem for Linux). The make included with Git for Windows (MinGW) is also usable. However, make is often not present in native Windows environments. As alternatives, consider `just` (Rust-based, native Windows support) or `Taskfile.yml` (Go-based, cross-platform). When using Dev Containers, the environment is Linux so make works without issues.

### Q3: How often should setup scripts be maintained?

**A**: At a minimum, update them at the following times: (1) when the Node.js version changes, (2) when new services (DB, Redis, etc.) are added, (3) when dependent tools change (e.g., migrating from npm to pnpm). By incorporating a "fresh install test" that runs the setup script periodically in CI/CD, you can automatically detect when scripts become stale. It is also effective to run the script from a new member's perspective once a month.

### Q4: Does using Dev Containers eliminate the need for setup scripts?

**A**: Dev Containers provide complete reproducibility of the development environment, but setup scripts are still necessary. The most effective design is to call setup scripts from the Dev Container's `postCreateCommand`. Setup scripts for native environments should also be maintained for members who do not use Dev Containers (due to performance requirements or hardware constraints).

### Q5: How do you design setup for a monorepo?

**A**: In a monorepo, the basic structure calls each package's setup from the root Makefile.

```makefile
# Root Makefile
setup: ## Setup all packages
	pnpm install --frozen-lockfile
	$(MAKE) -C apps/web setup
	$(MAKE) -C apps/api setup
	$(MAKE) -C packages/shared setup

# apps/web/Makefile
setup:
	cp .env.example .env
```

When using Turborepo or Nx, `turbo run setup` enables parallel setup considering inter-package dependencies.

### Q6: How do you handle corporate proxy environments?

**A**: In proxy environments, add processing to detect and apply proxy settings in the setup script.

```bash
# Detect and apply proxy settings
if [ -n "${HTTP_PROXY:-}" ]; then
  npm config set proxy "$HTTP_PROXY"
  npm config set https-proxy "${HTTPS_PROXY:-$HTTP_PROXY}"
  git config --global http.proxy "$HTTP_PROXY"
  echo "Proxy configured: $HTTP_PROXY"
fi
```

---

## Summary

| Item | Key Points |
|------|-----------|
| setup.sh | OS detection, tool installation, dependencies, and DB setup with 1 command |
| Makefile | `make help` lists all tasks. Entry point for new members |
| doctor.sh | Automatically diagnose environment issues. First step in troubleshooting |
| doctor --fix | Automatically fix auto-repairable issues |
| .env.example | Template for environment variables. Clearly document required values with comments |
| .env validation | Check for required fields and security verification |
| Error handling | `set -euo pipefail` + clear error messages |
| Cross-platform | Handle macOS / Linux / WSL2 differences with OS detection |
| CI integration | Run setup scripts periodically in CI to prevent staleness |
| Docker Compose | Manage local services declaratively. With health checks |
| Task runner | Combination of Make (general purpose) + npm scripts (packages) is practical |
| Onboarding check | Automatically check new member progress |

## Further Reading

- [Documentation Environment](./02-documentation-setup.md) -- Documentation infrastructure with VitePress / Docusaurus / ADR
- [Project Standards](./00-project-standards.md) -- Common settings for EditorConfig / .npmrc
- [Dev Container](../02-docker-dev/01-devcontainer.md) -- Further simplify onboarding with container-based environments

## References

1. **GNU Make Manual** -- https://www.gnu.org/software/make/manual/ -- Complete Make reference
2. **just (command runner)** -- https://github.com/casey/just -- Rust-based task runner as a Make alternative
3. **The Twelve-Factor App - Dev/prod parity** -- https://12factor.net/dev-prod-parity -- Principle of matching development and production environments
4. **Taskfile** -- https://taskfile.dev/ -- YAML-based task runner
5. **Homebrew Bundle** -- https://github.com/Homebrew/homebrew-bundle -- Declarative macOS package management
6. **direnv** -- https://direnv.net/ -- Per-directory environment variable management
7. **Doppler** -- https://www.doppler.com/ -- Secret management service for teams

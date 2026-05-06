# Docker for Development

> A practical guide for building highly reproducible development environments using Docker Desktop, Dev Containers, and docker compose.

## What You Will Learn

1. Installing Docker Desktop, configuring resources, and performance tuning
2. Building and managing development environments with docker compose
3. Practical techniques for hot reload, volume mounts, and network design
4. Separating development and production images with multi-stage builds
5. Docker security best practices and operational know-how
6. Troubleshooting and integration with CI/CD pipelines


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Docker Desktop Setup

### 1.1 Installation

```bash
# macOS (Homebrew)
brew install --cask docker

# macOS (OrbStack -- recommended alternative)
brew install --cask orbstack

# Windows (WSL2 backend recommended)
winget install Docker.DockerDesktop

# Linux (Docker Engine -- official script)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Effective after re-login

# Linux (Ubuntu -- apt)
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 1.2 Resource Configuration

```
Docker Desktop recommended resource settings:

┌─────────────────────────────────────┐
│ Settings → Resources                │
│                                      │
│  CPU:     4+ cores (half of host)   │
│  Memory:  4-8 GB                     │
│  Swap:    1 GB                       │
│  Disk:    64+ GB                     │
│                                      │
│ Settings → General                   │
│  ✅ Use virtualization framework     │
│  ✅ VirtioFS (macOS - fast)          │
│  ✅ Use Rosetta for x86/amd64       │
│     emulation (Apple Silicon)        │
│                                      │
│ Settings → Docker Engine             │
│  {                                   │
│    "builder": {                      │
│      "gc": {                         │
│        "enabled": true,              │
│        "defaultKeepStorage": "20GB"  │
│      }                               │
│    },                                │
│    "features": {                     │
│      "buildkit": true                │
│    },                                │
│    "log-driver": "json-file",        │
│    "log-opts": {                     │
│      "max-size": "10m",              │
│      "max-file": "3"                 │
│    }                                 │
│  }                                   │
└─────────────────────────────────────┘

Recommendations by project scale:
┌──────────────────┬────────┬────────┬──────┐
│ Scale            │ CPU    │ Memory │ Disk │
├──────────────────┼────────┼────────┼──────┤
│ Small (1-2)      │ 2 core │ 2 GB   │ 32GB │
│ Medium (3-5)     │ 4 core │ 4 GB   │ 64GB │
│ Large (5+)       │ 6 core │ 8 GB   │ 128GB│
│ ML/AI dev        │ 8 core │ 16 GB  │ 256GB│
└──────────────────┴────────┴────────┴──────┘
```

### 1.3 Alternative Tools

| Tool | OS | Features | Pricing |
|------|-----|----------|---------|
| Docker Desktop | All OS | Official, GUI included | Free personal / Paid enterprise |
| OrbStack | macOS | Lightweight, fast, low memory | Free personal |
| Rancher Desktop | All OS | OSS, containerd support | Free |
| Podman Desktop | All OS | Rootless, daemonless | Free |
| Colima | macOS/Linux | CLI only, lightweight | Free |
| Lima | macOS | VM-based, flexible | Free |

```
Alternative tool selection flowchart:

  Q1: What OS?
  │
  ├── macOS
  │   │
  │   └── Q2: Is GUI needed?
  │       ├── Yes → OrbStack (recommended) / Docker Desktop
  │       └── No  → Colima
  │
  ├── Windows
  │   │
  │   └── Q2: Can use WSL2?
  │       ├── Yes → Docker Desktop / Rancher Desktop
  │       └── No  → Docker Desktop (Hyper-V)
  │
  └── Linux
      │
      └── Q2: Is rootless needed?
          ├── Yes → Podman
          └── No  → Docker Engine (official)

  OrbStack vs Docker Desktop (macOS):
  ┌────────────────────┬───────────┬──────────────┐
  │ Item               │ OrbStack  │ Docker Desktop│
  ├────────────────────┼───────────┼──────────────┤
  │ Memory usage       │ ~200 MB   │ ~1-2 GB      │
  │ Startup time       │ ~2 sec    │ ~30 sec      │
  │ File I/O speed     │ Fast      │ Average      │
  │ License issues     │ None      │ Paid for large orgs│
  │ Docker CLI compat  │ 100%      │ 100%         │
  │ K8s support        │ Yes       │ Yes          │
  │ GUI                │ Yes       │ Yes          │
  └────────────────────┴───────────┴──────────────┘
```

### 1.4 Basic Docker CLI Verification

```bash
# Check version
docker version
docker compose version

# System information
docker system info

# Disk usage
docker system df
docker system df -v     # Verbose output

# Health check
docker run --rm hello-world
```

---

## 2. Dockerfile for Development

### 2.1 Multi-Stage Build

```dockerfile
# ─── Stage 1: Install dependencies ───
FROM node:20-slim AS deps
WORKDIR /app

# Enable package manager
RUN corepack enable

# Copy only package definition files (leverage cache)
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# ─── Stage 2: Development environment ───
FROM node:20-slim AS dev
WORKDIR /app

RUN corepack enable

# Tools needed for development
RUN apt-get update && apt-get install -y \
    git \
    curl \
    jq \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3000
CMD ["pnpm", "dev"]

# ─── Stage 3: Build ───
FROM node:20-slim AS build
WORKDIR /app

RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time environment variables
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

RUN pnpm build

# Reinstall only production dependencies
RUN pnpm install --prod --frozen-lockfile

# ─── Stage 4: Production ───
FROM node:20-slim AS production
WORKDIR /app

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy only files needed for production
COPY --from=build --chown=appuser:nodejs /app/dist ./dist
COPY --from=build --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=appuser:nodejs /app/package.json ./package.json

# Security: support read-only filesystem
USER appuser

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "dist/index.js"]
```

### 2.2 Dockerfile for Python Projects

```dockerfile
# ─── Stage 1: Builder ───
FROM python:3.12-slim AS builder
WORKDIR /app

# Fast installation using uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy only dependency definitions
COPY pyproject.toml uv.lock ./

# Create virtual environment and install dependencies
RUN uv sync --frozen --no-dev

# ─── Stage 2: Development environment ───
FROM python:3.12-slim AS dev
WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Development tools
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen

COPY . .

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ─── Stage 3: Production ───
FROM python:3.12-slim AS production
WORKDIR /app

RUN adduser --system --uid 1001 appuser

COPY --from=builder /app/.venv /app/.venv
COPY . .

ENV PATH="/app/.venv/bin:$PATH"

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 2.3 Stage Structure

```
Multi-stage build flow:

  deps ──→ dev (for development)
    │
    └──→ build ──→ production (for production)

  Development:
    docker compose up     → Uses dev stage
                           (mount source + hot reload)

  Production:
    docker build --target production → Minimal image
                                       (only node_modules + dist)

  Image size comparison:
  ┌────────────────────────┬───────────┬──────────────────┐
  │ Stage                  │ Size      │ Contents         │
  ├────────────────────────┼───────────┼──────────────────┤
  │ dev (all deps + src)   │ ~800 MB   │ devDeps + tools  │
  │ build (all deps+output)│ ~700 MB   │ Build artifacts  │
  │ production (minimal)   │ ~150 MB   │ prodDeps + dist  │
  │ distroless             │ ~80 MB    │ Runtime only     │
  └────────────────────────┴───────────┴──────────────────┘
```

### 2.4 .dockerignore

```bash
# .dockerignore
node_modules
.next
dist
build
coverage
.turbo
.env.local
.env.*.local
*.log
.git
.vscode
.idea
*.md
!README.md
Dockerfile*
docker-compose*.yml
compose*.yaml
.dockerignore
```

### 2.5 Dockerfile Best Practices

```
Dockerfile optimization checklist:

□ Using multi-stage builds
□ Minimize build context with .dockerignore
□ COPY in order from least-changed to most-changed files
  (package.json → lockfile → source code)
□ Chain RUN with && to reduce layers
□ apt-get: run rm -rf /var/lib/apt/lists/* after install
□ Run as non-root user (USER)
□ Set HEALTHCHECK
□ Do not include unnecessary env vars in production image
□ Use slim / alpine base images
□ Add metadata with LABEL
□ Set file permissions with COPY --chown
□ Use ARG to inject environment-specific values
```

---

## 3. Building a Development Environment with docker compose

### 3.1 Basic Configuration

```yaml
# compose.yaml (docker compose v2 format)
name: my-project

services:
  # ─── Application ───
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: dev
      args:
        NODE_VERSION: "20"
    ports:
      - "3000:3000"
    volumes:
      - .:/app                           # Source code mount
      - /app/node_modules                # Use node_modules inside container
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/mydb
      - REDIS_URL=redis://redis:6379
      - LOG_LEVEL=debug
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    develop:
      watch:                             # For docker compose watch
        - action: sync
          path: ./src
          target: /app/src
        - action: rebuild
          path: package.json
        - action: rebuild
          path: pnpm-lock.yaml
    restart: unless-stopped

  # ─── Database ───
  db:
    image: postgres:16-alpine
    container_name: ${COMPOSE_PROJECT_NAME:-myproject}-db
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: mydb
      POSTGRES_INITDB_ARGS: "--encoding=UTF-8 --lc-collate=C --lc-ctype=C"
      TZ: Asia/Tokyo
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s
    restart: unless-stopped

  # ─── Cache ───
  redis:
    image: redis:7-alpine
    container_name: ${COMPOSE_PROJECT_NAME:-myproject}-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

  # ─── Mail testing ───
  mailpit:
    image: axllent/mailpit:latest
    container_name: ${COMPOSE_PROJECT_NAME:-myproject}-mail
    ports:
      - "1025:1025"    # SMTP
      - "8025:8025"    # Web UI
    environment:
      MP_SMTP_AUTH_ACCEPT_ANY: 1
      MP_SMTP_AUTH_ALLOW_INSECURE: 1
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 3.2 docker compose Override Pattern

```yaml
# compose.yaml (base -- shared for CI/production)
services:
  app:
    build:
      context: .
      target: production
    environment:
      - NODE_ENV=production
```

```yaml
# compose.override.yaml (for local development -- auto-loaded)
services:
  app:
    build:
      target: dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

```yaml
# compose.ci.yaml (for CI)
services:
  app:
    build:
      target: build
    environment:
      - NODE_ENV=test
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/testdb

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: testdb
    tmpfs:
      - /var/lib/postgresql/data  # In-memory for faster CI
```

```bash
# Usage
docker compose up                                    # base + override (automatic)
docker compose -f compose.yaml -f compose.ci.yaml up # base + CI
docker compose -f compose.yaml up                    # base only
```

### 3.3 Commonly Used Commands

```bash
# ─── Start ───
docker compose up -d                    # Start in background
docker compose up --build               # Rebuild and start
docker compose up --build --force-recreate  # Force recreate
docker compose watch                    # Watch file changes (v2.22+)
docker compose up -d --wait             # Wait until health checks pass

# ─── Logs ───
docker compose logs -f app              # Follow app logs
docker compose logs --tail 100 db       # Last 100 lines of db
docker compose logs --since 5m          # Logs from last 5 minutes
docker compose logs -f --no-log-prefix  # Without prefix

# ─── Operations ───
docker compose exec app sh              # Shell inside container
docker compose exec app bash            # If bash is available
docker compose exec db psql -U postgres # Connect to DB
docker compose exec redis redis-cli     # Redis CLI
docker compose run --rm app pnpm test   # Run tests in temporary container
docker compose run --rm app pnpm prisma migrate dev  # Migration

# ─── Scaling ───
docker compose up -d --scale worker=3   # Scale worker to 3 instances

# ─── Status ───
docker compose ps                       # List services
docker compose ps -a                    # Include stopped
docker compose top                      # Process list
docker compose stats                    # Resource usage

# ─── Stop and remove ───
docker compose down                     # Stop
docker compose down -v                  # Also remove volumes
docker compose down --rmi all           # Also remove images
docker compose down --remove-orphans    # Also remove orphan containers

# ─── Cleanup ───
docker system prune -af                 # Remove all unused resources
docker volume prune                     # Remove unused volumes
docker builder prune -af                # Remove build cache
docker image prune -af                  # Remove unused images
```

### 3.4 Simplify Operations with Makefile

```makefile
# Makefile
.PHONY: up down restart build logs shell db-cli redis-cli seed clean

# ─── Start / Stop ───
up:
	docker compose up -d --wait

down:
	docker compose down

restart:
	docker compose restart

build:
	docker compose up -d --build --wait

# ─── Logs ───
logs:
	docker compose logs -f

logs-app:
	docker compose logs -f app

# ─── Shell ───
shell:
	docker compose exec app sh

db-cli:
	docker compose exec db psql -U postgres -d mydb

redis-cli:
	docker compose exec redis redis-cli

# ─── Database ───
migrate:
	docker compose exec app pnpm prisma migrate dev

seed:
	docker compose exec app pnpm prisma db seed

db-reset:
	docker compose exec app pnpm prisma migrate reset --force

# ─── Testing ───
test:
	docker compose run --rm app pnpm test

test-watch:
	docker compose run --rm app pnpm test:watch

# ─── Cleanup ───
clean:
	docker compose down -v --rmi all --remove-orphans
	docker system prune -af

# ─── CI ───
ci:
	docker compose -f compose.yaml -f compose.ci.yaml up -d --wait
	docker compose exec app pnpm test
	docker compose -f compose.yaml -f compose.ci.yaml down -v
```

---

## 4. Volume Mounts and Performance

### 4.1 macOS Performance Issues and Solutions

```
File system performance on macOS:

  ┌─────────────────────────────────────┐
  │  macOS host                          │
  │  ┌───────────────────────────────┐  │
  │  │  Source code (/Users/...)     │  │
  │  └───────────┬───────────────────┘  │
  │              │                       │
  │         VirtioFS / gRPC FUSE         │
  │         (File sharing layer)         │
  │              │                       │
  │  ┌───────────┴───────────────────┐  │
  │  │  Linux VM (Docker Engine)      │  │
  │  │  ┌─────────────────────────┐  │  │
  │  │  │  Container               │  │  │
  │  │  │  /app (mount point)      │  │  │
  │  │  └─────────────────────────┘  │  │
  │  └───────────────────────────────┘  │
  └─────────────────────────────────────┘

  Performance (npm install comparison):
  ┌──────────────────────┬──────────┬──────────┐
  │ Method               │ Speed    │ Recommended│
  ├──────────────────────┼──────────┼──────────┤
  │ Native (host)        │ 1x (base)│ -        │
  │ VirtioFS             │ 1.5-2x  │ ★★★★    │
  │ gRPC FUSE            │ 3-5x    │ ★★      │
  │ Named volume         │ 1.1x    │ ★★★★★  │
  │ OrbStack             │ 1.2x    │ ★★★★★  │
  │ Anonymous volume     │ 1.1x    │ ★★★     │
  └──────────────────────┴──────────┴──────────┘

  * Named volumes are fastest but not directly accessible from host
  * VirtioFS is the default since Docker Desktop v4.6+
```

### 4.2 Performance Optimization

```yaml
# compose.yaml best practices
services:
  app:
    volumes:
      # Source code as bind mount (for hot reload)
      - .:/app

      # node_modules as named volume (faster)
      - node_modules:/app/node_modules

      # Build cache also as named volume
      - next_cache:/app/.next
      - turbo_cache:/app/.turbo

      # Temporary files as tmpfs (in memory)
      - type: tmpfs
        target: /app/tmp

volumes:
  node_modules:
  next_cache:
  turbo_cache:
```

```
Volume strategy guide:

  ┌──────────────────────┬──────────────────────────────┐
  │ Data type            │ Recommended mount method      │
  ├──────────────────────┼──────────────────────────────┤
  │ Source code          │ Bind mount (host → container) │
  │ node_modules         │ Named volume                  │
  │ DB data              │ Named volume                  │
  │ Build cache          │ Named volume                  │
  │ Logs (temporary)     │ tmpfs                         │
  │ Test artifacts       │ Bind mount (to retrieve results)│
  │ Config files         │ Bind mount (read-only)        │
  └──────────────────────┴──────────────────────────────┘
```

### 4.3 docker compose watch

```yaml
# compose.yaml (docker compose watch configuration)
services:
  app:
    build:
      context: .
      target: dev
    develop:
      watch:
        # Source code change → copy to container (fast)
        - action: sync
          path: ./src
          target: /app/src
          ignore:
            - "**/*.test.ts"

        # Config file change → copy to container
        - action: sync
          path: ./public
          target: /app/public

        # Dependency change → rebuild container
        - action: rebuild
          path: package.json

        - action: rebuild
          path: pnpm-lock.yaml

        # Dockerfile change → rebuild container
        - action: rebuild
          path: Dockerfile
```

```bash
# Run docker compose watch
docker compose watch

# Run in background
docker compose watch &

# Also show logs
docker compose watch --no-up  # When already running
```

```
docker compose watch behavior:

  Detect file change on host side
       │
       ▼
  ┌──────────────────────┐
  │  action: sync        │ → Copy file to container
  │  (src/ change)       │   No rebuild needed, immediate
  │                      │   Hot reload works
  ├──────────────────────┤
  │  action: rebuild     │ → Rebuild container
  │  (package.json chg)  │   Reflect new dependencies
  │                      │   Takes tens of seconds
  ├──────────────────────┤
  │  action: sync+restart│ → Copy file then restart
  │  (config file change)│   Needed for process reload
  └──────────────────────┘

  vs bind mount:
  ┌────────────────────────┬──────────────────────┐
  │ Bind mount             │ docker compose watch  │
  ├────────────────────────┼──────────────────────┤
  │ Real-time reflection   │ Event-driven          │
  │ High I/O overhead      │ Only on copy          │
  │ Slow on macOS          │ OS-independent        │
  │ Shares node_modules    │ Only sync targets     │
  │ No configuration       │ develop.watch needed  │
  └────────────────────────┴──────────────────────┘
```

---

## 5. Environment Variable Management

### 5.1 .env File Structure

```bash
# .env (auto-loaded by docker compose -- shared with team)
COMPOSE_PROJECT_NAME=my-project
NODE_ENV=development

# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=mydb
DATABASE_URL=postgresql://postgres:postgres@db:5432/mydb

# Redis
REDIS_URL=redis://redis:6379

# .env.local (personal settings -- add to .gitignore)
GITHUB_TOKEN=ghp_xxxxx
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# .env.example (template -- commit to repository)
# Copy to create .env.local: cp .env.example .env.local
GITHUB_TOKEN=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

```yaml
# compose.yaml
services:
  app:
    env_file:
      - path: .env
        required: true
      - path: .env.local
        required: false   # No error if not present
    environment:
      # Override env_file values
      - LOG_LEVEL=debug
      - ENABLE_FEATURE_X=true
```

### 5.2 Secret Management

```yaml
# compose.yaml (management using Docker Secrets)
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt   # Local file
    # or
    # environment: DB_PASSWORD        # From environment variable
```

```
Secret management best practices:

  Development environment:
  ├── .env (shared settings) → commit to repository
  ├── .env.local (personal secrets) → .gitignore
  └── .env.example (template) → commit to repository

  CI environment:
  ├── GitHub Actions Secrets → injected as environment variables
  └── GitHub Actions Variables → non-sensitive settings

  Production environment:
  ├── AWS Secrets Manager / SSM Parameter Store
  ├── HashiCorp Vault
  └── Docker Secrets (when using Swarm)

  Things you must never do:
  ❌ Commit .env.local to repository
  ❌ Embed secrets using ENV in Dockerfile
  ❌ Write passwords directly in docker-compose.yml (except for development)
  ❌ Include secrets in built images
```

---

## 6. Network Design

### 6.1 Inter-Service Communication

```
docker compose networking:

  ┌─────────────── my-project_default ──────────────┐
  │            (Docker internal network)              │
  │                                                    │
  │  ┌─────────┐   ┌──────┐   ┌───────┐              │
  │  │   app   │──→│  db  │   │ redis │              │
  │  │ :3000   │   │:5432 │   │ :6379 │              │
  │  └────┬────┘   └──────┘   └───────┘              │
  │       │                                            │
  │  Communicate by service name:                      │
  │  db:5432 (NOT localhost:5432)                      │
  │  redis:6379 (NOT localhost:6379)                   │
  └────┬──────────────────────────────────────────────┘
       │
       │ ports: "3000:3000"
       ▼
  ┌──────────┐
  │  Host    │
  │ localhost │
  │  :3000    │
  └──────────┘

  * Access from host via localhost:3000
  * Containers communicate by service name
  * DNS resolution handled automatically by Docker's internal DNS
```

### 6.2 Custom Networks

```yaml
# compose.yaml (multiple networks)
services:
  app:
    networks:
      - frontend
      - backend

  web:
    image: nginx:alpine
    networks:
      - frontend
    ports:
      - "80:80"

  db:
    networks:
      - backend
    # ↑ Not accessible from frontend (security)

  redis:
    networks:
      - backend

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # Block external access
```

### 6.3 Communication Between Multiple Projects

```yaml
# project-a/compose.yaml
services:
  api:
    networks:
      - shared

networks:
  shared:
    name: shared-network
    external: true

# project-b/compose.yaml
services:
  web:
    networks:
      - shared
    environment:
      - API_URL=http://api:3000

networks:
  shared:
    name: shared-network
    external: true
```

```bash
# Create shared network
docker network create shared-network

# Start both projects
cd project-a && docker compose up -d
cd project-b && docker compose up -d

# project-b's web can access project-a's api
```

---

## 7. Docker Build Optimization

### 7.1 Leveraging BuildKit

```dockerfile
# syntax=docker/dockerfile:1

# BuildKit cache mount
FROM node:20-slim AS deps
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./

# Mount package manager cache
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Secret mount (does not remain in image)
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) pnpm install
```

```bash
# Build with BuildKit enabled
DOCKER_BUILDKIT=1 docker build .

# Build with secret passed
docker build --secret id=npm_token,src=./.npmrc .

# Multi-platform build
docker buildx build --platform linux/amd64,linux/arm64 -t myapp:latest .
```

### 7.2 Build Cache Optimization

```
How Docker layer caching works:

  Each instruction in Dockerfile (FROM, COPY, RUN, etc.) creates a layer
  Layers cache results from previous builds
  All layers after a changed layer are re-executed

  Optimization principles:
  1. Put less-frequently-changed items at the top
  2. Put more-frequently-changed items at the bottom

  ❌ Bad example:
  COPY . .                    # ← Re-runs every time source changes
  RUN pnpm install            # ← Re-runs even when dependencies haven't changed

  ✅ Good example:
  COPY package.json pnpm-lock.yaml ./  # ← Dependency definitions only
  RUN pnpm install                      # ← Only when dependencies change
  COPY . .                              # ← Source change at the end
```

---

## 8. Security Best Practices

### 8.1 Image Security

```dockerfile
# ─── Best practices ───

# 1. Specify exact version (do not use latest)
FROM node:20.12.0-slim   # ✅ Pinned version
# FROM node:latest       # ❌ Version undefined

# 2. Run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser
USER appuser

# 3. Read-only filesystem
# In compose.yaml: read_only: true

# 4. Security scanning
# docker scout quickview myapp:latest
# docker scout cves myapp:latest

# 5. Do not include unnecessary packages
# Use slim / distroless images
```

### 8.2 Security Configuration in compose.yaml

```yaml
services:
  app:
    # Security options
    security_opt:
      - no-new-privileges:true    # Prevent privilege escalation
    read_only: true               # Read-only filesystem
    tmpfs:
      - /tmp                      # Writable temporary area
      - /app/tmp
    cap_drop:
      - ALL                       # Drop all capabilities
    cap_add:
      - NET_BIND_SERVICE          # Add only what is needed
```

---

## 9. Troubleshooting

### 9.1 Common Issues and Solutions

```
Issue: Container does not start / exits immediately

Solution:
  1. Check logs: docker compose logs app
  2. Start interactively: docker compose run --rm app sh
  3. Check CMD: docker inspect myapp:latest | jq '.[0].Config.Cmd'
  4. Health check status: docker compose ps (STATUS column)

---

Issue: Port already in use

Solution:
  1. Check what is using the port: lsof -i :3000
  2. Change port in compose.yaml: "3001:3000"
  3. Stop existing containers: docker compose down
  4. Stop the process on the host

---

Issue: node_modules conflicts between host and container

Solution:
  1. Isolate with named volume:
     volumes:
       - node_modules:/app/node_modules
  2. Also run pnpm install on host (for IDE completion)
  3. Use Dev Container (recommended)

---

Issue: File changes not reflected in container

Solution:
  1. Check volume mount: docker compose config
  2. Check .dockerignore (is it excluded from mount?)
  3. Use docker compose watch
  4. Check inotify limit (Linux):
     echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf

---

Issue: Container running out of disk space

Solution:
  1. Remove unused resources: docker system prune -af
  2. Remove build cache: docker builder prune -af
  3. Expand disk size in Docker Desktop
  4. Set up periodic automatic cleanup script

---

Issue: Slow build / I/O on macOS

Solution:
  1. Enable VirtioFS (Docker Desktop Settings)
  2. Switch to OrbStack
  3. Move node_modules to named volume
  4. Configure .dockerignore properly
  5. Use docker compose watch (alternative to bind mount)
```

### 9.2 Debug Commands

```bash
# ─── Check container state ───
docker compose ps -a
docker compose logs --tail 50 app
docker inspect <container_id>

# ─── Check network ───
docker network ls
docker network inspect my-project_default
docker compose exec app ping db    # Verify inter-service connectivity

# ─── Check resources ───
docker stats                        # Real-time resource usage
docker compose top                  # Processes inside container
docker system df -v                 # Detailed disk usage

# ─── Check image contents ───
docker run --rm -it myapp:latest sh
docker history myapp:latest         # Layer history
docker inspect myapp:latest | jq '.[0].Config'  # Check configuration

# ─── Debug build ───
docker build --progress=plain .     # Verbose build log output
docker build --no-cache .           # Build without cache
```

---

## 10. CI/CD Integration

### 10.1 Docker Build in GitHub Actions

```yaml
# .github/workflows/docker.yml
name: Docker Build
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Set up Docker Buildx
      - uses: docker/setup-buildx-action@v3

      # Docker layer cache
      - uses: actions/cache@v4
        with:
          path: /tmp/.buildx-cache
          key: ${{ runner.os }}-buildx-${{ github.sha }}
          restore-keys: |
            ${{ runner.os }}-buildx-

      # Build
      - uses: docker/build-push-action@v5
        with:
          context: .
          target: production
          push: false
          cache-from: type=local,src=/tmp/.buildx-cache
          cache-to: type=local,dest=/tmp/.buildx-cache-new,mode=max

      # Update cache
      - run: |
          rm -rf /tmp/.buildx-cache
          mv /tmp/.buildx-cache-new /tmp/.buildx-cache
```

### 10.2 Testing with docker compose

```yaml
# .github/workflows/test.yml
name: Test with Docker Compose
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Start services
        run: docker compose -f compose.yaml -f compose.ci.yaml up -d --wait

      - name: Run tests
        run: docker compose exec -T app pnpm test

      - name: Run lint
        run: docker compose exec -T app pnpm lint

      - name: Cleanup
        if: always()
        run: docker compose -f compose.yaml -f compose.ci.yaml down -v
```

---

## 11. Anti-Patterns

### 11.1 Using the Same Dockerfile for Development and Production

```
❌ Anti-pattern: Sharing one Dockerfile across all environments

FROM node:20
WORKDIR /app
COPY . .
RUN npm install       # devDependencies also installed
CMD ["npm", "start"]  # Huge image including dev tools

Problems:
  - Production image is unnecessarily large
  - Dev tools (eslint, etc.) included in production
  - Increased security risk
  - Expanded attack surface

✅ Correct approach:
  - Separate with multi-stage builds
  - dev stage: all dependencies + hot reload
  - production stage: minimal dependencies + build artifacts only
  - Use --target flag to switch
```

### 11.2 Not Backing Up Volume Data

```
❌ Anti-pattern: Losing all development data with docker compose down -v

Problems:
  - Recreating test data takes time
  - Seed data is lost
  - "Can't reproduce that bug anymore"

✅ Correct approach:
  - Prepare seed scripts (init.sql, seed.ts)
  - Place initialization SQL in docker-entrypoint-initdb.d/
  - Define seed command in Makefile
  - Run regular docker compose down without -v
  - Prepare pg_dump backup script for important data
```

### 11.3 Using the latest Tag

```
❌ Anti-pattern: Using latest for base images

FROM node:latest
FROM postgres:latest

Problems:
  - Different versions may be used for each build
  - "It worked last week" problem
  - No reproducibility

✅ Correct approach:
  FROM node:20.12.0-slim
  FROM postgres:16.2-alpine
  - Pin to major.minor.patch
  - Use Renovate / Dependabot for automatic update PRs
```

### 11.4 Running as Root User

```
❌ Anti-pattern: Running production containers as root

FROM node:20
WORKDIR /app
COPY . .
# No USER specified → runs as root

Problems:
  - Host root privileges obtained on container escape
  - File permission issues
  - Flagged in security audits

✅ Correct approach:
  RUN adduser --system --uid 1001 appuser
  USER appuser
  - Root is acceptable during development (Dev Container, etc.)
  - Always non-root in production
```


---

## Practice Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also write test code

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise on basic implementation patterns"""

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
    """Exercise on advanced patterns"""

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
    """Efficient search using hash map"""
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

**Key points:**
- Be aware of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | Prioritize when | Can compromise when |
|-----------|----------------|---------------------|
| Performance | Real-time processing, large-scale data | Admin screens, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal info, financial data | Public data, internal use |
| Development speed | MVP, time to market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│          Architecture Selection Flow             │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① Team size?                                   │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → go to ②             │
│                                                 │
│  ② Deployment frequency?                        │
│    ├─ Weekly or less → Monolith + module split  │
│    └─ Daily/multiple times → go to ③           │
│                                                 │
│  ③ Team independence?                           │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs long-term cost**
- A short-term fast approach can become technical debt in the long term
- Conversely, over-engineering has high short-term costs and can delay the project

**2. Consistency vs flexibility**
- A unified technology stack has low learning costs
- Adopting diverse technologies enables best-fit choices but increases operational costs

**3. Level of abstraction**
- High abstraction increases reusability but can make debugging difficult
- Low abstraction is intuitive but prone to code duplication

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
        """Describe decision content"""
        self.decision = decision
        return self

    def add_consequence(self, consequence: str, positive: bool = True):
        """Add consequence"""
        self.consequences.append({
            'description': consequence,
            'type': 'positive' if positive else 'negative'
        })
        return self

    def add_alternative(self, name: str, reason_rejected: str):
        """Add rejected alternative"""
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

## Real-World Application Scenarios

### Scenario 1: MVP Development at a Startup

**Situation:** Need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on minimum necessary features
- Automated tests for critical paths only
- Introduce monitoring from early on

**Lessons learned:**
- Don't aim for perfection (YAGNI principle)
- Get user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Gradually renewing a system that has been in operation for over 10 years

**Approach:**
- Migrate gradually using the Strangler Fig pattern
- Create Characterization Tests first if no existing tests
- Coexist old and new systems with an API gateway
- Perform data migration in stages

| Phase | Work content | Estimated duration | Risk |
|-------|-------------|-------------------|------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Start migration | Migrate peripheral functions first | 3-6 months | Medium |
| 4. Core migration | Migrate core functions | 6-12 months | High |
| 5. Completion | Decommission old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers developing the same product

**Approach:**
- Clarify boundaries with domain-driven design
- Set ownership per team
- Manage shared libraries with Inner Source approach
- Design API-first to minimize inter-team dependencies

```python
# API contract definition between teams
from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

class Priority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class APIContract:
    """API contract between teams"""
    endpoint: str
    method: str
    owner_team: str
    consumers: List[str]
    sla_ms: int  # Response time SLA
    priority: Priority

    def validate_sla(self, actual_ms: int) -> bool:
        """Check SLA compliance"""
        return actual_ms <= self.sla_ms

    def to_openapi(self) -> dict:
        """Output in OpenAPI format"""
        return {
            'path': self.endpoint,
            'method': self.method,
            'x-owner': self.owner_team,
            'x-consumers': self.consumers,
            'x-sla-ms': self.sla_ms
        }

# Usage example
contracts = [
    APIContract(
        endpoint="/api/v1/users",
        method="GET",
        owner_team="user-team",
        consumers=["order-team", "notification-team"],
        sla_ms=200,
        priority=Priority.HIGH
    ),
    APIContract(
        endpoint="/api/v1/orders",
        method="POST",
        owner_team="order-team",
        consumers=["payment-team", "inventory-team"],
        sla_ms=500,
        priority=Priority.CRITICAL
    )
]
```

### Scenario 4: Performance-Critical Systems

**Situation:** A system where millisecond-level response times are required

**Optimization points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization method | Effect | Implementation cost | Use case |
|--------------------|--------|---------------------|----------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy processing |
| DB optimization | High | High | When queries are slow |
| Code optimization | Low-Medium | High | CPU-bound cases |
---

## 12. FAQ

### Q1: Which should I use, Docker Desktop or OrbStack?

**A:** OrbStack is recommended for macOS users. Compared to Docker Desktop, memory usage is less than half (~200MB vs 1-2GB), startup completes in a few seconds, and file system performance is superior. Migration cost is zero since it is fully compatible with Docker CLI. It also avoids Docker Desktop's license issue (companies with 250+ employees or annual revenue over $10M must pay).

### Q2: What is the difference between `docker compose up` and `docker compose watch`?

**A:** `docker compose up` only starts containers. File changes are reflected via volume mounts, but changes like `package.json` require a manual rebuild. `docker compose watch` automatically detects file changes based on the `develop.watch` section in `compose.yaml` and performs sync (copy) or rebuild automatically. When bind mount performance is an issue on macOS, the watch sync approach is effective.

### Q3: What do I do when node_modules inside the container and IDE completion on the host don't match?

**A:** When node_modules is isolated with a named volume, IDE completion doesn't work because node_modules doesn't exist on the host. The workarounds are as follows:
1. Also run `pnpm install` on the host (becomes double management but is easiest)
2. Use Dev Containers to run VS Code inside the container (recommended)
3. Don't use volume mounts at all, and use `docker compose watch` sync instead
4. Configure `.vscode/settings.json` to point to the TypeScript SDK path inside the container

### Q4: What should I be aware of when using amd64 images on Apple Silicon (M1/M2/M3)?

**A:** It works via Rosetta 2 emulation, but performance degrades. Enabling "Use Rosetta for x86_64/amd64 emulation on Apple Silicon" in Docker Desktop Settings > General makes it faster than qemu. However, you should use arm64-compatible images (most `:alpine`, `:slim` are multi-arch) wherever possible. Specifying `--platform linux/arm64` explicitly achieves native speed.

### Q5: What is the priority order for environment variables in docker compose?

**A:** Applied in the following priority order (higher is first):
1. `docker compose run -e KEY=VALUE` (command line)
2. `environment:` section (compose.yaml)
3. Files specified in `env_file:`
4. `ENV` in Dockerfile
5. Shell environment variables

Since `environment:` takes priority over `env_file:`, the pattern of setting default values with `env_file` and overriding with `environment` is effective.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architecture design.

---

## 13. Summary

| Component | Recommended | Notes |
|-----------|-------------|-------|
| Runtime | Docker Desktop / OrbStack | OrbStack recommended for macOS |
| Dockerfile | Multi-stage | Separate dev / production |
| Base image | slim / alpine | Version pinning required |
| Compose format | compose.yaml (v2) | docker-compose.yml is old format |
| File sharing | VirtioFS + named volumes | Isolate node_modules |
| File sync | docker compose watch | Alternative to bind mount |
| Environment variables | .env + .env.local | .env.local in gitignore |
| Health check | Required | condition for depends_on |
| Security | Non-root + no-new-privileges | Required for production |
| Cleanup | docker system prune | Recommended to run periodically |
| Simplify operations | Makefile | Common interface for the team |
| CI integration | BuildKit + layer cache | Reduce build time |

---

## Next Guides to Read

- [01-devcontainer.md](./01-devcontainer.md) -- Run VS Code inside a container with Dev Container
- [02-local-services.md](./02-local-services.md) -- Build local services for DB, cache, etc.
- [../03-team-setup/01-onboarding-automation.md](../03-team-setup/01-onboarding-automation.md) -- Automate onboarding using Docker

---

## References

1. **Docker Compose Documentation** -- https://docs.docker.com/compose/ -- Official documentation for docker compose.
2. **Docker Development Best Practices** -- https://docs.docker.com/develop/dev-best-practices/ -- Official best practices guide.
3. **OrbStack** -- https://orbstack.dev/ -- Fast Docker alternative for macOS.
4. **Dockerfile Best Practices** -- https://docs.docker.com/build/building/best-practices/ -- Official guide for multi-stage builds and more.
5. **Docker Compose Watch** -- https://docs.docker.com/compose/file-watch/ -- Official documentation for file watching and sync features.
6. **Docker Security** -- https://docs.docker.com/engine/security/ -- Docker security best practices.
7. **BuildKit** -- https://docs.docker.com/build/buildkit/ -- Official guide for the fast build engine.

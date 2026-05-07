# Multi-Stage Builds

> A practical guide to leveraging the builder pattern to dramatically reduce image size while balancing security and efficiency. Includes language-specific examples for Node.js, Go, and Rust.

---

## What You Will Learn

1. **Understand how multi-stage builds work** and separate build environments from runtime environments
2. **Implement language-specific optimal builder patterns** to produce minimal-size images
3. **Leverage cache strategies and intermediate stages** to optimize build speed and image quality
4. **Integrate with CI/CD pipelines** to embed tests, linting, and security scans into the build process


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [Dockerfile Basics](./00-dockerfile-basics.md)

---

## 1. What Are Multi-Stage Builds?

### 1.1 The Problem: Challenges of Single-Stage Builds

```
+------------------------------------------------------+
|         Single-Stage Build (Traditional)              |
|                                                      |
|  FROM node:20                                        |
|  +------------------------------------------------+ |
|  |  Node.js runtime            ~300 MB             | |
|  |  npm / yarn                 ~50 MB              | |
|  |  Build tools (gcc, etc.)    ~200 MB             | |
|  |  node_modules (incl. dev)   ~400 MB             | |
|  |  Source code                ~10 MB              | |
|  |  Build artifacts            ~5 MB               | |
|  +------------------------------------------------+ |
|  Total: ~965 MB  <- Build tools are unnecessary at runtime |
|                                                      |
|         Multi-Stage Build                            |
|                                                      |
|  Stage 1: Build              Stage 2: Run            |
|  +--------------------+     +--------------------+  |
|  | Node.js + npm      |     | Node.js (Alpine)   |  |
|  | Build tools        |     | Production         |  |
|  | All node_modules   | --> | node_modules       |  |
|  | Source code        |COPY | Build artifacts    |  |
|  +--------------------+     | (only what's needed)|  |
|  ~965 MB (discarded)        +--------------------+  |
|                              ~150 MB (final image)  |
+------------------------------------------------------+
```

In a single-stage build, all compilers, linkers, development libraries, and test frameworks required to build the application end up in the final image. This causes the following problems:

- **Image size bloat**: Unnecessary tools occupy hundreds of MB
- **Increased security risk**: The attack surface expands. Vulnerabilities in build tools affect the production environment as well
- **Longer download times**: Image pull time during deployment increases
- **Higher storage costs**: Registry storage capacity and data transfer volume increase

Multi-stage builds solve these problems by defining multiple build stages within a single Dockerfile and copying only the necessary files into the final stage.

### 1.2 Basic Syntax

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Run (final image)
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

```bash
# Build (only the final stage is included in the image)
docker build -t my-app:v1.0.0 .

# Build up to a specific stage
docker build --target builder -t my-app-builder .

# Show detailed build progress
DOCKER_BUILDKIT=1 docker build --progress=plain -t my-app:v1.0.0 .
```

### 1.3 How COPY --from Works

```
+------------------------------------------------------+
|          How COPY --from operates                    |
|                                                      |
|  COPY --from=builder /app/dist ./dist                |
|                |          |          |               |
|                |          |          +-- Destination |
|                |          |              in current  |
|                |          |              stage       |
|                |          +-- Source path in the     |
|                |              source stage           |
|                +-- Stage name (as specified by AS)   |
|                                                      |
|  Other ways to specify:                              |
|  COPY --from=0 ...    # Stage number (0-indexed)     |
|  COPY --from=nginx:alpine ...  # External image      |
+------------------------------------------------------+
```

---

## 2. Multi-Stage Builds by Language

### 2.1 Node.js (Express + TypeScript)

```dockerfile
# === Stage 1: Install dependencies ===
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# === Stage 2: Build ===
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
# Compiled JS is generated in the dist/ directory

# === Stage 3: Production dependencies ===
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# === Stage 4: Run ===
FROM node:20-alpine
RUN addgroup -S app && adduser -S app -G app

# Resolve PID 1 issue
RUN apk add --no-cache dumb-init

WORKDIR /app

COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --chown=app:app package.json ./

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
```

#### Details on Dependency Separation in Node.js

```
+------------------------------------------------------+
|     Why the 4-stage Node.js configuration?           |
|                                                      |
|  deps (all dependencies)                             |
|  └── Includes devDependencies (TypeScript compiler,  |
|      etc.)                                           |
|      ↓                                               |
|  builder (build)                                     |
|  └── Uses deps' node_modules to compile TypeScript   |
|      to JavaScript                                   |
|      ↓                                               |
|  prod-deps (production dependencies)                 |
|  └── Creates node_modules excluding devDependencies  |
|      ↓                                               |
|  runner (run)                                        |
|  └── Only prod-deps' node_modules + builder's dist   |
|                                                      |
|  Why separate deps and prod-deps:                    |
|  Running npm ci --only=production in the builder     |
|  stage would re-execute on every source code change. |
|  Separating into its own stage enables caching.      |
+------------------------------------------------------+
```

### 2.2 Go

```dockerfile
# === Stage 1: Build ===
FROM golang:1.22-alpine AS builder

# Security: prepare certificates and non-root user in advance
RUN apk add --no-cache ca-certificates tzdata
RUN adduser -D -g '' appuser

WORKDIR /app

# Download dependencies first (for cache efficiency)
COPY go.mod go.sum ./
RUN go mod download && go mod verify

# Copy source code and build
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s" -o /server ./cmd/server

# === Stage 2: Run (scratch = empty base image) ===
FROM scratch

# Copy only required files from the build stage
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /server /server

USER appuser
EXPOSE 8080
ENTRYPOINT ["/server"]
```

```bash
# Build and check size
docker build -t go-app .
docker images go-app
# REPOSITORY   TAG       IMAGE ID       CREATED          SIZE
# go-app       latest    abc123         10 seconds ago   12.3MB
# <- Go binary + certificates only. No OS at all.
```

#### Cross-Compilation Support for Go

```dockerfile
# Multi-platform Go build
FROM --platform=$BUILDPLATFORM golang:1.22-alpine AS builder

ARG TARGETOS
ARG TARGETARCH

RUN apk add --no-cache ca-certificates tzdata git

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Cross-compile (independent of the build machine's architecture)
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build \
        -ldflags="-w -s -X main.version=$(git describe --tags 2>/dev/null || echo dev)" \
        -o /server \
        ./cmd/server

FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /server /server
ENTRYPOINT ["/server"]
```

```bash
# Multi-platform build
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    -t ghcr.io/myorg/go-app:v1.0.0 \
    --push .
```

### 2.3 Rust

```dockerfile
# === Stage 1: Dependency build (for caching) ===
FROM rust:1.75-alpine AS chef
RUN apk add --no-cache musl-dev
RUN cargo install cargo-chef
WORKDIR /app

# === Stage 2: Generate recipe ===
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# === Stage 3: Build dependencies ===
FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
# Build dependencies only (cache is effective on source code changes)
RUN cargo chef cook --release --recipe-path recipe.json

# Build application
COPY . .
RUN cargo build --release

# === Stage 4: Run ===
FROM alpine:3.19
RUN apk add --no-cache ca-certificates
RUN addgroup -S app && adduser -S app -G app

COPY --from=builder /app/target/release/myapp /usr/local/bin/

USER app
EXPOSE 8080
CMD ["myapp"]
```

#### Using scratch with Static Linking in Rust

```dockerfile
FROM rust:1.75-alpine AS builder
RUN apk add --no-cache musl-dev

WORKDIR /app

# Add target
RUN rustup target add x86_64-unknown-linux-musl

COPY Cargo.toml Cargo.lock ./
# Compile only dependencies with a dummy build
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release --target x86_64-unknown-linux-musl
RUN rm -rf src

# Build with actual source
COPY src ./src
RUN touch src/main.rs
RUN RUSTFLAGS="-C target-feature=+crt-static" \
    cargo build --release --target x86_64-unknown-linux-musl

FROM scratch
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/myapp /myapp
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

EXPOSE 8080
ENTRYPOINT ["/myapp"]
```

### 2.4 Next.js (Standalone Output)

```dockerfile
# === Stage 1: Dependencies ===
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# === Stage 2: Build ===
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Enable Next.js standalone output
# Requires output: 'standalone' in next.config.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# === Stage 3: Run ===
FROM node:20-alpine
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

# Copy only the standalone output (includes a minimal subset of node_modules)
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public

USER app
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["node", "server.js"]
```

#### next.config.js Configuration

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',  // Enable standalone output
  // Additional settings as needed
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.example.com' },
    ],
  },
}

module.exports = nextConfig
```

### 2.5 Java (Spring Boot)

```dockerfile
# === Stage 1: Build ===
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app

COPY gradlew build.gradle.kts settings.gradle.kts ./
COPY gradle ./gradle
RUN ./gradlew dependencies --no-daemon

COPY src ./src
RUN ./gradlew bootJar --no-daemon

# Extract layered JAR (Spring Boot 3.x)
RUN java -Djarmode=layertools -jar build/libs/*.jar extract --destination extracted

# === Stage 2: Run ===
FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app

# Copy in order of layer (change frequency: low -> high)
COPY --from=builder /app/extracted/dependencies/ ./
COPY --from=builder /app/extracted/spring-boot-loader/ ./
COPY --from=builder /app/extracted/snapshot-dependencies/ ./
COPY --from=builder /app/extracted/application/ ./

USER app
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
```

#### Spring Boot Layered JAR

```
+------------------------------------------------------+
|     Spring Boot Layered JAR Structure                |
|                                                      |
|  dependencies/                Change frequency: lowest|
|  └── BOOT-INF/lib/*.jar     (third-party deps)      |
|                                                      |
|  spring-boot-loader/          Change frequency: low  |
|  └── org/springframework/    (Boot loader)           |
|                                                      |
|  snapshot-dependencies/       Change frequency: medium|
|  └── BOOT-INF/lib/*-SNAPSHOT.jar                     |
|                                                      |
|  application/                 Change frequency: high  |
|  └── BOOT-INF/classes/       (application code)      |
|      META-INF/                                       |
|                                                      |
|  With Docker layer caching, if dependencies haven't  |
|  changed, no re-download is needed, enabling fast    |
|  builds.                                             |
+------------------------------------------------------+
```

### 2.6 Python (FastAPI / Django)

```dockerfile
# === Stage 1: Build ===
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Install Python packages (isolated with prefix)
COPY requirements.txt .
RUN pip install --prefix=/install -r requirements.txt

# === Stage 2: Run ===
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Runtime dependencies only (gcc is not needed)
RUN apt-get update && \
    apt-get install -y --no-install-recommends libpq5 curl && \
    rm -rf /var/lib/apt/lists/*

# Copy installed packages from the build stage
COPY --from=builder /install /usr/local

RUN useradd --create-home --shell /bin/bash appuser
COPY --chown=appuser:appuser . .

USER appuser
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker", "app.main:app"]
```

### 2.7 PHP (Laravel)

```dockerfile
# === Stage 1: Composer dependencies ===
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --no-scripts \
    --ignore-platform-reqs \
    --prefer-dist

# === Stage 2: Frontend build ===
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY resources ./resources
COPY vite.config.js ./
RUN npm run build

# === Stage 3: Run ===
FROM php:8.3-fpm-alpine

# PHP extensions
RUN docker-php-ext-install pdo pdo_mysql opcache

# Copy Composer vendor directory
COPY --from=vendor /app/vendor ./vendor

# Copy frontend build artifacts
COPY --from=frontend /app/public/build ./public/build

# Application code
COPY . .

# PHP-FPM configuration
COPY docker/php/php.ini /usr/local/etc/php/php.ini

RUN chown -R www-data:www-data /app/storage /app/bootstrap/cache

USER www-data
EXPOSE 9000
CMD ["php-fpm"]
```

---

## 3. Image Size Comparison

### Comparison Table 1: Single-Stage vs Multi-Stage

| Application | Single-Stage | Multi-Stage | Reduction |
|---|---|---|---|
| Node.js (Express) | ~950 MB | ~150 MB | 84% |
| Go (Web API) | ~800 MB | ~12 MB | 98% |
| Rust (Web API) | ~1.5 GB | ~15 MB | 99% |
| Java (Spring Boot) | ~600 MB | ~200 MB | 67% |
| Next.js (SSR) | ~1.2 GB | ~120 MB | 90% |
| Python (FastAPI) | ~900 MB | ~180 MB | 80% |
| PHP (Laravel) | ~700 MB | ~250 MB | 64% |

### Comparison Table 2: Size by Base Image

| Base Image | Size | Use Case | Package Manager |
|---|---|---|---|
| `ubuntu:22.04` | ~77 MB | General development | apt |
| `debian:bookworm-slim` | ~74 MB | General (slim version) | apt |
| `alpine:3.19` | ~7 MB | Minimal Linux | apk |
| `node:20` | ~1.1 GB | Node.js development | apt |
| `node:20-slim` | ~200 MB | Node.js production | apt |
| `node:20-alpine` | ~130 MB | Node.js minimal | apk |
| `gcr.io/distroless/nodejs20` | ~120 MB | Node.js minimal (Distroless) | none |
| `python:3.12` | ~1.0 GB | Python development | apt |
| `python:3.12-slim` | ~130 MB | Python production | apt |
| `scratch` | 0 B | Static binaries only | none |

### Comparison Table 3: Base Image Characteristics

| Characteristic | scratch | distroless | alpine | slim | full |
|---|---|---|---|---|---|
| Shell | none | none* | ash | bash | bash |
| Package Mgr | none | none | apk | apt | apt |
| libc | none | glibc | musl | glibc | glibc |
| Debugging | not possible | :debug tag | possible | possible | possible |
| Attack surface | minimal | very small | small | medium | large |
| Size | 0 MB | 20-120 MB | 7 MB | 70-130 MB | 300+ MB |

\* The distroless `:debug` variant includes a busybox shell

---

## 4. Advanced Techniques

### 4.1 Copying from External Images

```dockerfile
# Copy files from other images
FROM alpine:3.19
COPY --from=nginx:alpine /etc/nginx/nginx.conf /etc/nginx/
COPY --from=busybox:uclibc /bin/wget /usr/local/bin/

# Bring in only specific binary tools
FROM alpine:3.19
COPY --from=docker:24-cli /usr/local/bin/docker /usr/local/bin/
COPY --from=docker/compose:v2.24.0 /usr/local/bin/docker-compose /usr/local/bin/
```

### 4.2 Embedding Test Stages

```dockerfile
# === Build stage ===
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o /server ./cmd/server

# === Test stage ===
FROM builder AS tester
RUN go test -v ./...
RUN go vet ./...

# === Lint stage ===
FROM builder AS linter
RUN go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
RUN golangci-lint run

# === Run stage ===
FROM scratch
COPY --from=builder /server /server
ENTRYPOINT ["/server"]
```

```bash
# Run tests only
docker build --target tester .

# Run linting only
docker build --target linter .

# Run all stages (test -> lint -> build -> final image)
docker build .

# If tests fail, the final stage will not be built
# (useful in CI/CD)
```

#### Test Integration for Node.js

```dockerfile
# === Dependencies ===
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# === Lint ===
FROM deps AS linter
COPY . .
RUN npm run lint
RUN npm run type-check

# === Test ===
FROM deps AS tester
COPY . .
RUN npm run test -- --coverage

# === Build ===
FROM deps AS builder
COPY . .
RUN npm run build

# === Production ===
FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app

COPY --from=builder --chown=app:app /app/dist ./dist
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

USER app
CMD ["node", "dist/server.js"]
```

```bash
# Staged execution in CI/CD
docker build --target linter -t lint-check .     # Lint only
docker build --target tester -t test-check .     # Test only
docker build --target production -t my-app .      # Production build
```

### 4.3 BuildKit Mount Cache

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./

# Mount package cache (reused across builds)
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -o /server ./cmd/server

FROM scratch
COPY --from=builder /server /server
ENTRYPOINT ["/server"]
```

```dockerfile
# Node.js npm cache
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY . .
RUN npm run build
```

```dockerfile
# Python pip cache
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --prefix=/install -r requirements.txt

FROM python:3.12-slim
COPY --from=builder /install /usr/local
COPY . .
CMD ["python", "app.py"]
```

```dockerfile
# Rust cargo cache
FROM rust:1.75-alpine AS builder
RUN apk add --no-cache musl-dev
WORKDIR /app
COPY . .
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release && \
    cp target/release/myapp /usr/local/bin/

FROM alpine:3.19
COPY --from=builder /usr/local/bin/myapp /usr/local/bin/
CMD ["myapp"]
```

### 4.4 Secret Mounts

```dockerfile
# Build-time secrets (will not remain in the image)
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./

# Mount private registry credentials
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci

COPY . .
CMD ["node", "server.js"]
```

```bash
# Build with a secret specified
docker build --secret id=npmrc,src=.npmrc -t my-app .

# Multiple secrets
docker build \
    --secret id=npmrc,src=.npmrc \
    --secret id=aws,src=$HOME/.aws/credentials \
    -t my-app .
```

### 4.5 SSH Mounts

```dockerfile
# Clone a private repository using an SSH key
FROM golang:1.22-alpine AS builder
RUN apk add --no-cache git openssh-client

# Configure SSH known_hosts
RUN mkdir -p -m 0700 ~/.ssh && \
    ssh-keyscan github.com >> ~/.ssh/known_hosts

WORKDIR /app
COPY go.mod go.sum ./
RUN --mount=type=ssh go mod download

COPY . .
RUN go build -o /server .

FROM scratch
COPY --from=builder /server /server
ENTRYPOINT ["/server"]
```

```bash
# Build using the SSH agent
docker build --ssh default -t my-app .

# Specify a particular SSH key
docker build --ssh default=$HOME/.ssh/id_rsa -t my-app .
```

---

## 5. Stage Configuration Patterns

```
+------------------------------------------------------+
|          Multi-Stage Configuration Patterns          |
|                                                      |
|  Pattern 1: Simple (2 stages)                        |
|  [builder] --COPY--> [runner]                        |
|                                                      |
|  Pattern 2: Dependency separation (3 stages)         |
|  [deps] --COPY--> [builder] --COPY--> [runner]       |
|                                                      |
|  Pattern 3: Test integration (4 stages)              |
|  [deps] --> [builder] --> [tester]                   |
|                 |                                    |
|                 +--COPY--> [runner]                   |
|                                                      |
|  Pattern 4: Development/production branching         |
|  [base] --> [dev]  (hot reload, debug tools)         |
|         --> [builder] --> [prod] (minimal config)    |
|                                                      |
|  Pattern 5: Parallel build                           |
|  [api-builder]   --+                                 |
|  [worker-builder] -+--COPY--> [runner]               |
|  [frontend]      --+                                 |
+------------------------------------------------------+
```

### Development/Production Branching Example

```dockerfile
# === Common base ===
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./

# === Development environment ===
FROM base AS development
RUN npm install  # Includes devDependencies
COPY . .
# Development tools
RUN apk add --no-cache git curl
EXPOSE 3000
CMD ["npm", "run", "dev"]

# === Build ===
FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build
RUN npm run test

# === Production environment ===
FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
RUN apk add --no-cache dumb-init

COPY --from=builder --chown=app:app /app/dist ./dist
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
```

```bash
# Build for development
docker build --target development -t my-app:dev .

# Build for production
docker build --target production -t my-app:prod .

# Usage differentiation in docker-compose.yml
```

```yaml
# docker-compose.yml (for development)
services:
  app:
    build:
      context: .
      target: development
    volumes:
      - .:/app
      - /app/node_modules
    ports:
      - "3000:3000"
    command: npm run dev
```

```yaml
# docker-compose.prod.yml (for production)
services:
  app:
    build:
      context: .
      target: production
    ports:
      - "3000:3000"
    restart: unless-stopped
```

### Parallel Build Pattern

```dockerfile
# BuildKit automatically builds stages with no dependencies in parallel

# === API build ===
FROM golang:1.22-alpine AS api-builder
WORKDIR /app/api
COPY api/ .
RUN go build -o /api-server .

# === Worker build (runs in parallel with API) ===
FROM golang:1.22-alpine AS worker-builder
WORKDIR /app/worker
COPY worker/ .
RUN go build -o /worker .

# === Frontend build (runs in parallel with the above) ===
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# === Final image ===
FROM alpine:3.19
RUN apk add --no-cache ca-certificates

COPY --from=api-builder /api-server /usr/local/bin/
COPY --from=worker-builder /worker /usr/local/bin/
COPY --from=frontend-builder /app/frontend/dist /var/www/html/

EXPOSE 8080
CMD ["api-server"]
```

---

## 6. CI/CD Integration

### 6.1 Using Multi-Stage Builds in GitHub Actions

```yaml
# .github/workflows/docker.yml
name: Docker Build and Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v5
        with:
          context: .
          target: linter
          cache-from: type=gha
          cache-to: type=gha,mode=max

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v5
        with:
          context: .
          target: tester
          cache-from: type=gha
          cache-to: type=gha,mode=max

  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          target: production
          push: ${{ github.event_name != 'pull_request' }}
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### 6.2 Cache Strategies

```
+------------------------------------------------------+
|          Cache Strategies in CI/CD                   |
|                                                      |
|  1. GitHub Actions Cache (GHA)                       |
|     cache-from: type=gha                             |
|     cache-to: type=gha,mode=max                      |
|     -> Uses GitHub's Cache API                       |
|     -> Shares cache across same branch + default     |
|        branch                                        |
|                                                      |
|  2. Registry cache                                   |
|     cache-from: type=registry,ref=img:cache           |
|     cache-to: type=registry,ref=img:cache,mode=max    |
|     -> Stores cache layers in the registry           |
|     -> Cache shared across different CI runners      |
|                                                      |
|  3. Local cache                                      |
|     cache-from: type=local,src=/tmp/.buildx-cache     |
|     cache-to: type=local,dest=/tmp/.buildx-cache-new  |
|     -> Used on self-hosted CI servers                |
|                                                      |
|  4. Inline cache                                     |
|     --build-arg BUILDKIT_INLINE_CACHE=1               |
|     -> Embeds cache metadata directly in the image   |
|     -> Simplest option but lowest cache efficiency   |
+------------------------------------------------------+
```

---

## 7. Anti-Patterns

### Anti-Pattern 1: Copying the Entire Build Stage Artifacts

```dockerfile
# NG: Copy all files from the build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app .  # <- Copies everything (source, devDependencies)
CMD ["node", "dist/server.js"]
# -> Defeats the purpose of multi-stage builds

# OK: Copy only required files
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
CMD ["node", "dist/server.js"]
```

### Anti-Pattern 2: Forgetting Certificates When Using scratch for Go

```dockerfile
# NG: Cannot make HTTPS connections
FROM golang:1.22 AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o /server .

FROM scratch
COPY --from=builder /server /server
ENTRYPOINT ["/server"]
# -> Certificate error when making HTTPS calls to external APIs

# OK: Copy CA certificates
FROM golang:1.22-alpine AS builder
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o /server .

FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /server /server
ENTRYPOINT ["/server"]
```

### Anti-Pattern 3: Ignoring Cache Efficiency in the Build Stage

```dockerfile
# NG: Reinstall all dependencies every time
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .                    # Source code change -> invalidates all cache
RUN npm ci                  # Re-executes every time
RUN npm run build

# OK: Copy dependency files first
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./  # Cache invalidated only on dependency changes
RUN npm ci                               # Cache is effective
COPY . .                                 # Only source code re-copied
RUN npm run build
```

### Anti-Pattern 4: Undebuggable Images with scratch

```dockerfile
# Problem: scratch has no shell, making debugging difficult
FROM scratch
COPY --from=builder /server /server
ENTRYPOINT ["/server"]
# -> Cannot enter a shell with docker exec
# -> Cannot inspect the filesystem

# Solution 1: Provide a debug tag
FROM alpine:3.19 AS debug
COPY --from=builder /server /server
ENTRYPOINT ["/server"]

FROM scratch AS production
COPY --from=builder /server /server
ENTRYPOINT ["/server"]

# Solution 2: distroless debug variant
FROM gcr.io/distroless/static-debian12:debug
COPY --from=builder /server /server
ENTRYPOINT ["/server"]
# -> Can debug with busybox shell
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Write test code as well

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
        assert False, "An exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Applied Patterns

Extend the basic implementation to add the following features.

```python
# Exercise 2: Applied patterns
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise for applied patterns"""

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
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured configuration file | Check configuration file path and format |
| Timeout | Network delay / insufficient resources | Adjust timeout value, add retry logic |
| Out of memory | Increased data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access permissions | Check executing user permissions, review settings |
| Data inconsistency | Race condition in concurrent processing | Introduce locking mechanism, transaction management |

### Debugging Steps

1. **Check the error message**: Read the stack trace and identify where it occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Formulate hypotheses**: List possible causes
4. **Incremental validation**: Use log output or a debugger to validate hypotheses
5. **Fix and regression testing**: After fixing, also run tests for related areas

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

Diagnostic steps when a performance issue occurs:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check for I/O waits**: Check the status of disk and network I/O
4. **Check concurrent connections**: Check the state of the connection pool

| Problem Type | Diagnostic Tool | Countermeasure |
|-----------|-----------|------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Index, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes decision criteria when making technology choices.

| Criterion | When to prioritize | When it can be compromised |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│              Architecture Selection Flow          │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. What is the team size?                       │
│    ├─ Small (1-5 people) -> Monolith             │
│    └─ Large (10+ people) -> go to 2              │
│                                                 │
│  2. How often do you deploy?                     │
│    ├─ Once a week or less -> Monolith +          │
│    │  modular separation                         │
│    └─ Daily / multiple times -> go to 3          │
│                                                 │
│  3. How independent are the teams?               │
│    ├─ High -> Microservices                      │
│    └─ Moderate -> Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- A fast short-term approach can become technical debt in the long run
- Conversely, over-engineering has a high short-term cost and can delay projects

**2. Consistency vs Flexibility**
- A unified technology stack has a lower learning cost
- Adopting diverse technologies enables the right tool for the right job, but increases operational cost

**3. Level of Abstraction**
- High abstraction has high reusability but can make debugging difficult
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
        """Describe the background and problem"""
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
        md += f"## Background\n{self.context}\n\n"
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

## 8. FAQ

### Q1: Does multi-stage build increase build time?

**A:** Since the number of stages increases, the initial build takes slightly longer, but subsequent builds with a warm cache are often faster. By separating dependency installation from source code copying, re-installation of dependencies can be skipped on source code changes. Using BuildKit's `--mount=type=cache` further improves cache efficiency. Also, BuildKit automatically builds stages with no dependencies in parallel, so properly splitting stages can reduce build time.

### Q2: What is the difference between scratch and distroless?

**A:** `scratch` is a completely empty base image with no shell or filesystem utilities. It is intended for statically linked binaries (Go, Rust). `distroless` (provided by Google) includes a minimal runtime (glibc, CA certificates, etc.) and can be used with languages that require dynamic linking (Node.js, Java, Python). A `:debug` tag variant with a busybox shell is also provided for debugging purposes.

### Q3: What should the cache strategy be in CI/CD?

**A:** The following options are available:
- **GitHub Actions Cache**: Use GitHub's Cache API with `type=gha`. The simplest to configure.
- **Registry cache**: Store cache layers in a registry with `type=registry`. Can be shared across different CI runners.
- **BuildKit inline cache**: Embed cache metadata in the image with `BUILDKIT_INLINE_CACHE=1`. No additional infrastructure required but cache efficiency is low.
- **Local cache**: Cache on the CI server's local disk with `type=local`. For self-hosted CI environments.

### Q4: Are intermediate stage images deleted after a multi-stage build?

**A:** After the build completes, intermediate stage layers are retained as build cache but are not included in the final image. Build cache can be manually deleted with `docker system prune` or `docker builder prune`. When a specific stage is targeted with `--target`, that stage becomes the final image.

### Q5: Is COPY --from the only way to share files between stages?

**A:** `COPY --from` is the primary method, but BuildKit mount options can also be used:
- `RUN --mount=type=bind,from=builder,source=/app/dist,target=/tmp/dist ...` mounts temporarily for reference (unlike COPY, this does not create a layer)
- Volume mounts (with docker compose during development)

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Rather than theory alone, writing actual code and verifying its behavior deepens understanding.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next steps.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 9. Summary

| Item | Key Point |
|---|---|
| Core concept | Separate build and runtime environments to minimize the final image |
| COPY --from | Copy only necessary files from build stages to the run stage |
| Go / Rust | scratch-based images as small as 10-15 MB are possible |
| Node.js | Reduce to 100-150 MB with Alpine + standalone output |
| Java | Reduce to around 200 MB with JRE + layered JAR |
| Python | Isolate build tools with slim + prefix install |
| Caching | Maximize cache efficiency by separating dependencies and source code |
| Test integration | Embed test stages into the build pipeline |
| Dev/Prod | Switch between development, test, and production with --target |
| CI/CD | Accelerate with BuildKit cache (gha, registry, local) |

---

## Next Guides to Read

- [02-optimization.md](./02-optimization.md) -- Dockerfile optimization and security
- [03-language-specific.md](./03-language-specific.md) -- Language-specific Dockerfile template collection
- [../02-compose/00-compose-basics.md](../02-compose/00-compose-basics.md) -- Docker Compose basics

---

## References

1. **Docker Documentation - Multi-stage builds** https://docs.docker.com/build/building/multi-stage/ -- Official guide to multi-stage builds.
2. **Google - Distroless Container Images** https://github.com/GoogleContainerTools/distroless -- Official repository for Distroless images. Supported languages and usage.
3. **BuildKit - Dockerfile frontend** https://github.com/moby/buildkit/blob/master/frontend/dockerfile/docs/reference.md -- Reference for advanced features such as `--mount=type=cache` and `--mount=type=secret`.
4. **cargo-chef** https://github.com/LukeMathWalker/cargo-chef -- A tool that optimizes Docker build caching for Rust projects.
5. **Next.js - Docker Deployment** https://nextjs.org/docs/app/building-your-application/deploying#docker-image -- Official Next.js Docker deployment guide.
6. **Spring Boot - Container Images** https://docs.spring.io/spring-boot/docs/current/reference/html/container-images.html -- Container image optimization guide for Spring Boot.
7. **Docker Build Cache** https://docs.docker.com/build/cache/ -- Official guide to build cache mechanisms and optimization techniques.
8. **Python Speed - Multi-stage Docker builds** https://pythonspeed.com/articles/multi-stage-docker-python/ -- Practical patterns for multi-stage builds in Python.

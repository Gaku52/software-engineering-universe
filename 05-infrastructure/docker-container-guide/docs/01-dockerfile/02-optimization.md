# Dockerfile Optimization

> A comprehensive guide covering layer cache utilization, .dockerignore design, security scanning, and best practices for building production-quality container images.

---

## What You Will Learn

1. Deeply understand **how layer caching works** and implement strategies to minimize build times
2. Perform **security scanning and hardening** to build images with fewer vulnerabilities
3. Systematically apply **Dockerfile best practices** to create maintainable and efficient images
4. Understand the design and execution of **multi-platform builds** to distribute images supporting both AMD64 and ARM64
5. Understand build optimization techniques in **CI/CD pipelines** and apply them in practice


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding the content of [Multi-Stage Builds](./01-multi-stage-build.md)

---

## 1. Layer Cache Strategy

### 1.1 How Caching Works

```
+------------------------------------------------------+
|              Cache Decision Flow                      |
|                                                      |
|  For each instruction:                               |
|                                                      |
|  1. FROM: Is the base image the same?                |
|     -> If different, rebuild all layers              |
|                                                      |
|  2. RUN: Is the command string the same?             |
|     -> Rebuild if even one character differs         |
|     -> Does not compare the execution result         |
|                                                      |
|  3. COPY/ADD: Is the file checksum the same?         |
|     -> Cache invalidated if file content changes     |
|     -> Timestamps are ignored (content only)         |
|                                                      |
|  Important: Once a layer's cache is invalidated,     |
|             all subsequent layers are rebuilt        |
|                                                      |
|  [Cache Hit] -> [Cache Hit] -> [Miss!]               |
|  -> [Rebuild] -> [Rebuild] -> [Rebuild]              |
+------------------------------------------------------+
```

Docker's build cache is evaluated per layer (per instruction in the Dockerfile). The build engine processes layers from top to bottom, determining whether the cache for each layer is valid. For FROM instructions, it checks whether the base image digest matches. For RUN instructions, it checks for an exact match of the command string. For COPY and ADD, it compares the metadata (size, permissions, content hash) of the copied files.

The most important characteristic of the cache is "cascade invalidation." When a cache miss occurs at a layer, all subsequent layers are rebuilt. This is because each layer depends on the result of the previous one. Understanding this behavior is the foundation of cache optimization.

### 1.2 Optimal Layer Ordering

```dockerfile
# === Optimized Dockerfile ===

# 1. Base image (change frequency: lowest)
FROM node:20-alpine

WORKDIR /app

# 2. System dependencies (change frequency: low)
RUN apk add --no-cache curl

# 3. Language dependency definition files (change frequency: medium-low)
COPY package.json package-lock.json ./

# 4. Dependency installation (change frequency: medium-low)
RUN npm ci --only=production

# 5. Configuration files (change frequency: medium)
COPY tsconfig.json ./

# 6. Source code (change frequency: highest)
COPY src/ ./src/

# 7. Build
RUN npm run build

CMD ["node", "dist/server.js"]
```

The optimization principle for layer ordering is to place less frequently changed items at the top and more frequently changed items at the bottom. Source code changes most often, so it goes at the very bottom of the Dockerfile. Dependency definition files (such as package.json) are relatively stable, so they are placed above the source code.

### 1.3 BuildKit Mount Cache

```dockerfile
# syntax=docker/dockerfile:1

FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./

# Mount the npm cache directory
# Reused across builds (not included in the layer)
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production

COPY . .
RUN npm run build

CMD ["node", "dist/server.js"]
```

```dockerfile
# Python pip cache
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt
COPY . .
CMD ["python", "app.py"]
```

```dockerfile
# Go module + build cache
FROM golang:1.22-alpine
WORKDIR /app
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -o /server .
```

BuildKit's mount cache works differently from layer caching. The directory specified with `--mount=type=cache` is persisted across builds but is not included in the image. This allows package manager caches to be efficiently reused.

### 1.4 Mount Cache Detailed Options

```dockerfile
# Specify a cache ID (shares cache with the same ID)
RUN --mount=type=cache,id=npm-cache,target=/root/.npm \
    npm ci

# Cache sharing modes
# shared: multiple builds can access simultaneously (default)
# private: only one build can access at a time
# locked: exclusive access control for simultaneous access
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci

# Read-only mount
RUN --mount=type=cache,target=/root/.npm,readonly \
    npm ls

# Set initial cache value from a directory
RUN --mount=type=cache,target=/root/.npm,from=base-deps \
    npm ci
```

### 1.5 Techniques to Avoid Cache Invalidation

```dockerfile
# NG: Commands containing timestamps always invalidate the cache
RUN echo "Build date: $(date)" > /app/build-info.txt

# OK: Control with ARG (cache is valid for the same value)
ARG BUILD_DATE=unknown
RUN echo "Build date: $BUILD_DATE" > /app/build-info.txt

# NG: Running apt-get update alone
RUN apt-get update
RUN apt-get install -y curl  # the update cache becomes stale

# OK: Combine update and install into a single RUN
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Technique: Pass git revision as a build argument
ARG GIT_REVISION
LABEL git.revision=$GIT_REVISION
# At build time: docker build --build-arg GIT_REVISION=$(git rev-parse HEAD) .
```

### 1.6 Conditional Cache Busting

```dockerfile
# Invalidate the cache only under specific conditions
# Example: reinstall only when the dependency file changes

FROM node:20-alpine
WORKDIR /app

# Copy package.json first (cache is effective if unchanged)
COPY package.json package-lock.json ./

# Detect changes via checksum
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Changing tsconfig.json does not require reinstalling dependencies
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build
```

---

## 2. .dockerignore Design

### 2.1 Comprehensive .dockerignore

```bash
# ==========================================
# .dockerignore
# ==========================================

# --- Version control ---
.git
.gitignore
.gitattributes

# --- Dependencies (reinstalled inside the container) ---
node_modules
vendor
.venv
__pycache__
*.pyc

# --- Build artifacts (rebuilt inside the container) ---
dist
build
out
target
*.o
*.a

# --- IDE / Editor ---
.vscode
.idea
*.swp
*.swo
*~

# --- Docker-related ---
Dockerfile*
docker-compose*.yml
.dockerignore

# --- Documentation ---
README.md
LICENSE
CHANGELOG.md
docs/

# --- Tests ---
coverage
.nyc_output
*.test.js
*.spec.js
__tests__
tests

# --- Environment variables / Secrets ---
.env
.env.*
!.env.example
*.pem
*.key
credentials.json

# --- OS files ---
.DS_Store
Thumbs.db

# --- CI/CD ---
.github
.gitlab-ci.yml
Jenkinsfile
```

### 2.2 Effect of .dockerignore

```
+------------------------------------------------------+
|       Comparison Before and After .dockerignore       |
|                                                      |
|  Before:                                             |
|  $ docker build . 2>&1 | grep "Sending"              |
|  Sending build context to Docker daemon  500MB        |
|                                                      |
|  Breakdown:                                          |
|  +-- .git/          200 MB  <- not needed            |
|  +-- node_modules/  280 MB  <- reinstalled in container|
|  +-- src/            10 MB  <- needed                |
|  +-- other           10 MB                           |
|                                                      |
|  After:                                              |
|  $ docker build . 2>&1 | grep "Sending"              |
|  Sending build context to Docker daemon  15MB         |
|                                                      |
|  Effect: 97% reduction, build time also significantly reduced|
+------------------------------------------------------+
```

### 2.3 Language-Specific .dockerignore Templates

```bash
# === For Node.js projects ===
node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*
dist
build
.next
.nuxt
coverage
.nyc_output
*.test.js
*.spec.js
*.test.ts
*.spec.ts
__tests__
jest.config.*
.eslintrc*
.prettierrc*
tsconfig.tsbuildinfo
```

```bash
# === For Python projects ===
__pycache__
*.pyc
*.pyo
*.pyd
.Python
*.egg-info
.eggs
*.egg
dist
build
.venv
venv
env
.mypy_cache
.pytest_cache
.tox
htmlcov
.coverage
*.cover
```

```bash
# === For Go projects ===
vendor/
*.test
*.out
*.exe
*.dll
*.so
*.dylib
coverage.txt
profile.out
```

```bash
# === For Java projects ===
target/
build/
*.class
*.jar
*.war
*.ear
.gradle
.mvn/wrapper/maven-wrapper.jar
*.iml
.idea
out/
```

### 2.4 Debugging .dockerignore

```bash
# Methods to verify files included in the build context

# 1. Check context size
docker build --no-cache -t test . 2>&1 | head -5

# 2. Check context transfer size with BuildKit
DOCKER_BUILDKIT=1 docker build --progress=plain -t test . 2>&1 | grep "transferring"

# 3. Test .dockerignore effect (with an empty Dockerfile)
echo "FROM scratch" > Dockerfile.test
docker build -f Dockerfile.test . 2>&1 | grep "Sending"
rm Dockerfile.test

# 4. Use rsync --dry-run to check excluded files
rsync -avz --dry-run --exclude-from=.dockerignore . /dev/null
```

---

## 3. Image Size Optimization

### 3.1 Choosing a Base Image

```dockerfile
# Builds for size comparison
# === ubuntu base (~77MB) ===
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y nodejs npm

# === slim base (~74MB) ===
FROM node:20-slim

# === alpine base (~7MB) ===
FROM node:20-alpine

# === distroless (~120MB including Node.js) ===
FROM gcr.io/distroless/nodejs20-debian12
```

```bash
# Check sizes
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
```

### 3.2 Detailed Base Image Comparison

| Base Image | Size | C Library | Package Manager | Shell | Security | Use Case |
|---|---|---|---|---|---|---|
| ubuntu:22.04 | ~77MB | glibc | apt | bash | Low | General development |
| debian:bookworm-slim | ~74MB | glibc | apt | bash | Medium | General server |
| alpine:3.19 | ~7MB | musl | apk | ash | High | Lightweight container |
| distroless | ~few MB | glibc | None | None | Highest | Production runtime only |
| scratch | 0MB | None | None | None | Highest | Static binaries |
| chainguard/static | ~few MB | None | None | None | Highest | Distroless alternative |
| wolfi-base | ~12MB | glibc | apk | ash | High | Chainguard recommended |

### 3.3 Package Cleanup

```dockerfile
# Debian/Ubuntu: delete cache
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Alpine: use --no-cache to avoid leaving cache
RUN apk add --no-cache curl ca-certificates

# pip: disable cache
RUN pip install --no-cache-dir -r requirements.txt

# npm: clear cache
RUN npm ci --only=production && npm cache clean --force

# Remove unnecessary files
RUN rm -rf /tmp/* /var/tmp/* /usr/share/doc /usr/share/man
```

### 3.4 Optimizing the Number of Layers

```dockerfile
# NG: too many layers
FROM alpine:3.19
RUN apk add --no-cache curl
RUN apk add --no-cache git
RUN apk add --no-cache bash
RUN mkdir /app
RUN chmod 755 /app
# -> 5 layers

# OK: combine them
FROM alpine:3.19
RUN apk add --no-cache curl git bash && \
    mkdir /app && \
    chmod 755 /app
# -> 1 layer
```

### 3.5 Size Reduction with Multi-Stage Builds

```dockerfile
# === Typical multi-stage build pattern ===

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production (minimal image)
FROM node:20-alpine AS production
WORKDIR /app

# Production dependencies only
COPY --from=deps /app/node_modules ./node_modules
# Build artifacts only
COPY --from=builder /app/dist ./dist
COPY package.json ./

RUN addgroup -S app && adduser -S app -G app
USER app

CMD ["node", "dist/server.js"]

# Result:
# deps stage:       includes devDependencies (~500MB)
# builder stage:    includes source code + build tools (~600MB)
# final image:      production deps + dist only (~150MB)
```

### 3.6 Binary Compression with UPX

```dockerfile
# Example of compressing a Go binary with UPX
FROM golang:1.22-alpine AS builder
RUN apk add --no-cache upx

WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-w -s" -o /server .

# Compress with UPX (50-70% size reduction)
RUN upx --best --lzma /server

FROM scratch
COPY --from=builder /server /server
ENTRYPOINT ["/server"]

# Before compression: 15MB -> After compression: 5MB (startup time increases slightly)
```

### 3.7 Identifying and Removing Unnecessary Files

```bash
# Check large files inside the image
docker run --rm myapp:latest find / -type f -size +1M -exec ls -lh {} \; 2>/dev/null

# Check size per layer
docker history myapp:latest --format "table {{.ID}}\t{{.CreatedBy}}\t{{.Size}}"

# Visually analyze layers with the dive tool
docker run --rm -it \
    -v /var/run/docker.sock:/var/run/docker.sock \
    wagoodman/dive:latest myapp:latest
```

---

## 4. Security Hardening

### 4.1 Non-Root User

```dockerfile
# For Alpine
FROM node:20-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --chown=app:app . .
RUN npm ci --only=production
USER app
CMD ["node", "server.js"]

# For Debian
FROM node:20-slim
RUN groupadd -r app && useradd -r -g app -d /app -s /sbin/nologin app
WORKDIR /app
COPY --chown=app:app . .
USER app
```

### 4.2 Read-Only Filesystem

```bash
# Run with read-only filesystem
docker run --read-only \
    --tmpfs /tmp:rw,size=100m \
    --tmpfs /var/run:rw \
    my-app

# Configuration in docker-compose.yml
# services:
#   app:
#     read_only: true
#     tmpfs:
#       - /tmp
#       - /var/run
```

### 4.3 Integrating Vulnerability Scanning

```
+------------------------------------------------------+
|         Scan Flow in CI/CD Pipeline                   |
|                                                      |
|  [Code Change] --> [Build] --> [Scan] --> [Push]      |
|                                  |                   |
|                            +-----+-----+             |
|                            |           |             |
|                         [Pass]      [Fail]           |
|                            |           |             |
|                         [Push]     [Block]           |
|                                   [Notify]           |
+------------------------------------------------------+
```

```bash
# Scan with Trivy
trivy image --severity HIGH,CRITICAL my-app:v1.0.0

# Fail the build if vulnerabilities are found
trivy image --exit-code 1 --severity CRITICAL my-app:v1.0.0

# Docker Scout
docker scout cves my-app:v1.0.0
docker scout recommendations my-app:v1.0.0

# Lint the Dockerfile itself
docker run --rm -i hadolint/hadolint < Dockerfile
```

### 4.4 Secret Management

```dockerfile
# NG: Embed secrets in environment variables (persisted in the image)
ENV DATABASE_URL=postgres://user:password@host/db
# -> visible with docker history

# NG: Pass secrets via ARG (may persist in build cache)
ARG SECRET_KEY
RUN echo $SECRET_KEY > /app/.secret

# OK: BuildKit secret mount (does not persist in the image)
RUN --mount=type=secret,id=db_url \
    cat /run/secrets/db_url > /dev/null && \
    ./setup-database.sh

# OK: Pass via environment variable at runtime
# docker run -e DATABASE_URL=postgres://... my-app
```

```bash
# Build using secrets
docker build \
    --secret id=db_url,src=./db_url.txt \
    --secret id=api_key,src=./api_key.txt \
    -t my-app .
```

### 4.5 Restricting Container Privileges

```dockerfile
# Security-hardened Dockerfile
FROM node:20-alpine

# Remove unnecessary setuid/setgid bits
RUN find / -perm /6000 -type f -exec chmod a-s {} \; 2>/dev/null || true

# Create a non-root user
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app
COPY --chown=app:app . .
RUN npm ci --only=production

USER app

# Health check (command that works even as non-root)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
```

```bash
# Security options at runtime
docker run \
    --read-only \
    --cap-drop ALL \
    --cap-add NET_BIND_SERVICE \
    --security-opt no-new-privileges:true \
    --tmpfs /tmp:rw,noexec,nosuid,size=100m \
    --pids-limit 100 \
    --memory 512m \
    --cpus 1.0 \
    my-app:latest
```

### 4.6 Generating SBOM (Software Bill of Materials)

```bash
# Generate SBOM with Docker BuildKit
docker buildx build --sbom=true -t my-app:v1.0.0 .

# Generate SBOM with Syft
syft my-app:v1.0.0 -o spdx-json > sbom.json

# Check for vulnerabilities from SBOM
grype sbom:sbom.json

# Generate SBOM with Trivy
trivy image --format spdx-json --output sbom.json my-app:v1.0.0
```

### 4.7 Image Signing and Verification

```bash
# Sign an image with cosign
cosign sign --key cosign.key myregistry/my-app:v1.0.0

# Verify the signature
cosign verify --key cosign.pub myregistry/my-app:v1.0.0

# Keyless signing (Sigstore/Fulcio)
cosign sign myregistry/my-app:v1.0.0
# -> Authenticate with an OIDC provider

# Docker Content Trust
export DOCKER_CONTENT_TRUST=1
docker push myregistry/my-app:v1.0.0  # automatically signed
docker pull myregistry/my-app:v1.0.0  # signature verified
```

---

## 5. Build Performance

### 5.1 Leveraging BuildKit

```bash
# Enable BuildKit (default in Docker 23.0+)
export DOCKER_BUILDKIT=1

# Verify parallel builds
docker build --progress=plain -t my-app .

# Export/import build cache
docker build \
    --cache-from type=registry,ref=myregistry/my-app:cache \
    --cache-to type=registry,ref=myregistry/my-app:cache,mode=max \
    -t my-app .

# Local cache
docker build \
    --cache-from type=local,src=/tmp/docker-cache \
    --cache-to type=local,dest=/tmp/docker-cache \
    -t my-app .
```

### 5.2 Multi-Platform Builds

```bash
# Create a buildx builder
docker buildx create --name multiarch --use
docker buildx inspect --bootstrap

# Multi-platform build
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    -t myregistry/my-app:v1.0.0 \
    --push .
```

### 5.3 Parallel Stage Builds

```dockerfile
# syntax=docker/dockerfile:1

# Stages that can run in parallel
FROM node:20-alpine AS frontend-deps
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

FROM python:3.12-slim AS backend-deps
WORKDIR /backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY --from=frontend-deps /frontend/node_modules ./node_modules
COPY frontend/ .
RUN npm run build

# Integrate in the final stage
FROM python:3.12-slim AS production
WORKDIR /app
COPY --from=backend-deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=frontend-build /frontend/dist ./static
COPY backend/ .
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "app:app"]

# frontend-deps and backend-deps are built in parallel (BuildKit)
```

### 5.4 Build Cache Strategy in CI

```yaml
# Cache configuration in GitHub Actions
name: Build
on: push

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

```yaml
# Cache configuration in GitLab CI
build:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  variables:
    DOCKER_BUILDKIT: "1"
  script:
    - docker build
      --cache-from type=registry,ref=$CI_REGISTRY_IMAGE:cache
      --cache-to type=registry,ref=$CI_REGISTRY_IMAGE:cache,mode=max
      -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
      --push .
```

### 5.5 Measuring and Analyzing Build Times

```bash
# Display build time in detail
DOCKER_BUILDKIT=1 docker build --progress=plain -t my-app . 2>&1 | tee build.log

# Extract time per stage
grep -E "^#[0-9]+ (DONE|CACHED)" build.log

# Check BuildKit status
docker buildx du
docker buildx prune  # delete unnecessary cache

# Check build cache usage
docker system df
docker builder prune --all --force  # delete all cache
```

---

## 6. Dockerfile Linting

### 6.1 Hadolint

```bash
# Run Hadolint
docker run --rm -i hadolint/hadolint < Dockerfile

# Example output:
# DL3008 warning: Pin versions in apt get install
# DL3009 info: Delete the apt-get lists after installing
# DL3018 warning: Pin versions in apk add
# DL4006 warning: Set the SHELL option -o pipefail
# SC2086 info: Double quote to prevent globbing

# Ignore specific rules
docker run --rm -i hadolint/hadolint \
    --ignore DL3008 --ignore DL3018 < Dockerfile

# Configure with .hadolint.yaml
# ignored:
#   - DL3008
# trustedRegistries:
#   - docker.io
#   - ghcr.io
```

### 6.2 Hadolint CI Integration

```yaml
# Hadolint in GitHub Actions
name: Lint Dockerfile
on: pull_request

jobs:
  hadolint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hadolint/hadolint-action@v3.1.0
        with:
          dockerfile: Dockerfile
          failure-threshold: warning
```

```yaml
# Detailed settings in .hadolint.yaml
ignored:
  - DL3008  # apt package version not pinned
  - DL3018  # apk package version not pinned

trustedRegistries:
  - docker.io
  - ghcr.io
  - gcr.io

override:
  error:
    - DL3001  # invalid command
    - DL3002  # root user
  warning:
    - DL3006  # FROM without tag
  info:
    - DL3009  # apt lists not deleted
  style:
    - DL3015  # apt --no-install-recommends not used
```

### Comparison Table 1: Key Hadolint Rules

| Rule ID | Severity | Description | Fix |
|---|---|---|---|
| DL3006 | warning | No tag specified in FROM | Use `FROM image:tag` |
| DL3008 | warning | apt package version not pinned | `apt-get install pkg=version` |
| DL3009 | info | apt-get lists not deleted | `rm -rf /var/lib/apt/lists/*` |
| DL3018 | warning | apk package version not pinned | `apk add pkg=version` |
| DL3025 | warning | CMD in shell form | Use exec form `CMD ["cmd"]` |
| DL4006 | warning | pipefail not set | `SHELL ["/bin/bash", "-o", "pipefail", "-c"]` |
| DL3002 | warning | USER is still root | Add `USER nonroot` |
| DL3003 | error | Use of sudo | Perform required operations before switching to non-root user |
| DL3007 | warning | Using latest tag in FROM | Specify an explicit version tag |
| DL3013 | warning | pip --no-cache-dir not used | `pip install --no-cache-dir` |
| DL3015 | info | apt --no-install-recommends not used | Add `--no-install-recommends` |
| DL3020 | error | Use COPY instead of ADD | Use COPY for anything other than URLs or tar extraction |
| DL3028 | warning | gem --no-document not used | `gem install --no-document` |

### Comparison Table 2: Security Scanning Tool Comparison

| Tool | Type | Target | CI Integration | Features |
|---|---|---|---|---|
| Hadolint | Linter | Dockerfile | GitHub Actions, GitLab CI | Checks Dockerfile writing style |
| Trivy | Scanner | Image, FS, Repo | All major CI | OSS, fast, comprehensive |
| Docker Scout | Scanner | Image | Docker Desktop | Docker integration, SBOM |
| Snyk | Scanner | Image, Code | All major CI | Rich fix suggestions |
| Grype | Scanner | Image, FS | GitHub Actions | By Anchore, fast |
| Dockle | Linter | Image | GitHub Actions | CIS Benchmark compliant |
| cosign | Signing | Image | GitHub Actions | Sigstore ecosystem |
| syft | SBOM | Image, FS | GitHub Actions | SBOM generation tool |

---

## 7. Best Practices Checklist

```
+------------------------------------------------------+
|         Dockerfile Best Practices                     |
|                                                      |
|  Basics                                              |
|  [x] Pin version tags in FROM                        |
|  [x] Configure .dockerignore                         |
|  [x] Use multi-stage builds                          |
|  [x] Place less frequently changed instructions at top|
|                                                      |
|  Security                                            |
|  [x] Run as non-root user                            |
|  [x] Use minimal base image (alpine/distroless)      |
|  [x] Integrate vulnerability scanning into CI        |
|  [x] Do not include secrets in the image             |
|  [x] Define HEALTHCHECK                              |
|  [x] Remove setuid/setgid bits                       |
|  [x] Run with --cap-drop ALL                         |
|                                                      |
|  Efficiency                                          |
|  [x] Consolidate RUN instructions to reduce layers   |
|  [x] Delete package cache                            |
|  [x] Use --no-install-recommends / --no-cache        |
|  [x] Leverage BuildKit mount cache                   |
|  [x] Design parallel stage builds                    |
|                                                      |
|  Maintainability                                     |
|  [x] Add metadata with LABEL                         |
|  [x] Use exec form for CMD/ENTRYPOINT                |
|  [x] Lint with Hadolint                              |
|  [x] Document ports with EXPOSE                      |
|  [x] Set default values for environment variables    |
+------------------------------------------------------+
```

### 7.1 LABEL Best Practices

```dockerfile
# OCI standard labels
LABEL org.opencontainers.image.title="My Application" \
      org.opencontainers.image.description="Production-ready API server" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.authors="team@example.com" \
      org.opencontainers.image.source="https://github.com/example/my-app" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.created="2024-01-15T10:30:00Z" \
      org.opencontainers.image.revision="abc123"

# Set build information dynamically
ARG BUILD_DATE
ARG GIT_REVISION
ARG VERSION
LABEL org.opencontainers.image.created=$BUILD_DATE \
      org.opencontainers.image.revision=$GIT_REVISION \
      org.opencontainers.image.version=$VERSION
```

### 7.2 HEALTHCHECK Design Patterns

```dockerfile
# Health check against an HTTP endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Check a TCP port
HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
    CMD nc -z localhost 8080 || exit 1

# Custom script
COPY healthcheck.sh /usr/local/bin/
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD ["healthcheck.sh"]

# Health check for gRPC services
HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
    CMD ["grpc_health_probe", "-addr=:50051"]
```

### 7.3 Choosing Between ENTRYPOINT and CMD

```dockerfile
# Pattern 1: CMD only (simplest)
CMD ["node", "server.js"]
# -> docker run myapp (default execution)
# -> docker run myapp node repl (override command)

# Pattern 2: ENTRYPOINT + CMD (recommended)
ENTRYPOINT ["node"]
CMD ["server.js"]
# -> docker run myapp (executes node server.js)
# -> docker run myapp repl (executes node repl)

# Pattern 3: entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
```

```bash
#!/bin/sh
# docker-entrypoint.sh

set -e

# Initialization based on environment variables
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "Running database migrations..."
    npx prisma migrate deploy
fi

# Use exec to forward signals
exec "$@"
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Separating apt-get update and install into different layers

```dockerfile
# NG: update and install in separate layers
RUN apt-get update
RUN apt-get install -y curl
# -> The update cache persists and packages may be installed from a stale package list

# OK: Combine into the same RUN
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*
```

### Anti-Pattern 2: Leaving build tools in the final image

```dockerfile
# NG: build tools remain
FROM python:3.12-slim
RUN apt-get update && \
    apt-get install -y gcc python3-dev && \
    pip install numpy pandas
# -> gcc, python3-dev remain in the final image (hundreds of MB)

# OK: Isolate build tools with multi-stage builds
FROM python:3.12-slim AS builder
RUN apt-get update && apt-get install -y gcc python3-dev
COPY requirements.txt .
RUN pip install --prefix=/install -r requirements.txt

FROM python:3.12-slim
COPY --from=builder /install /usr/local
COPY . /app
CMD ["python", "/app/main.py"]
```

### Anti-Pattern 3: Running COPY . . multiple times

```dockerfile
# NG: copying the same files multiple times
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci
COPY . .  # <- pointless second copy (also busts the cache)
RUN npm run build

# OK: copy files incrementally as needed
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
```

### Anti-Pattern 4: Using ADD instead of COPY

```dockerfile
# NG: using ADD unnecessarily
ADD ./src /app/src          # COPY is sufficient
ADD https://example.com/file.txt /app/  # layer cache does not work

# OK: use COPY, fetch URLs with RUN
COPY ./src /app/src
RUN curl -L -o /app/file.txt https://example.com/file.txt

# Appropriate use of ADD: automatic tar archive extraction
ADD archive.tar.gz /app/    # automatically extracted
```

### Anti-Pattern 5: Setting frequently changing values with ENV

```dockerfile
# NG: setting version info with ENV (busts the cache)
FROM node:20-alpine
ENV APP_VERSION=1.0.0      # changes every release -> all subsequent layers rebuilt
WORKDIR /app
COPY package.json .
RUN npm ci
COPY . .

# OK: place ENV at the bottom, or use LABEL
FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm ci
COPY . .
ARG APP_VERSION=unknown
LABEL version=$APP_VERSION
ENV APP_VERSION=$APP_VERSION
```

### Anti-Pattern 6: Not ignoring a large context

```dockerfile
# NG: including node_modules without .dockerignore
FROM node:20-alpine
WORKDIR /app
COPY . .           # node_modules (300MB+) is also copied
RUN npm ci         # completely wasteful since it reinstalls

# OK: exclude with .dockerignore + incremental copy
# add node_modules to .dockerignore
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
```

---

## 9. Advanced Optimization Techniques

### 9.1 Heredoc Syntax (BuildKit)

```dockerfile
# syntax=docker/dockerfile:1

FROM debian:bookworm-slim

# Write multi-line scripts with Heredoc
RUN <<EOF
apt-get update
apt-get install -y --no-install-recommends curl ca-certificates
rm -rf /var/lib/apt/lists/*
EOF

# Can also be used to generate files
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name localhost;
    location / {
        proxy_pass http://app:3000;
    }
}
EOF
```

### 9.2 Conditional Builds

```dockerfile
# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app

# Run different builds depending on the environment
ARG NODE_ENV=production

FROM base AS development
RUN npm install
CMD ["npm", "run", "dev"]

FROM base AS production
RUN npm ci --only=production
CMD ["node", "dist/server.js"]

# Specify the target at build time
# docker build --target development -t my-app:dev .
# docker build --target production -t my-app:prod .
```

### 9.3 Copying Files from External Images

```dockerfile
FROM node:20-alpine

# Copy files directly from external images
COPY --from=busybox:latest /bin/wget /usr/local/bin/wget
COPY --from=ghcr.io/grpc-ecosystem/grpc-health-probe:v0.4.25 \
    /ko-app/grpc-health-probe /usr/local/bin/grpc_health_probe

# Pattern for obtaining binaries from another image
COPY --from=minio/mc:latest /usr/bin/mc /usr/local/bin/mc
```

### 9.4 Flexible Dockerfile with Build Arguments

```dockerfile
# syntax=docker/dockerfile:1

# Switch base image with an argument
ARG BASE_IMAGE=node:20-alpine
FROM ${BASE_IMAGE}

ARG NODE_ENV=production
ARG PORT=3000
ARG LOG_LEVEL=info

WORKDIR /app

# Conditional installation
COPY package.json package-lock.json ./
RUN if [ "$NODE_ENV" = "development" ]; then \
        npm install; \
    else \
        npm ci --only=production; \
    fi

COPY . .

ENV NODE_ENV=$NODE_ENV \
    PORT=$PORT \
    LOG_LEVEL=$LOG_LEVEL

EXPOSE $PORT
CMD ["node", "server.js"]
```

---

## 10. Continuous Image Optimization

### 10.1 Regular Base Image Updates

```bash
# Check for base image updates
docker pull node:20-alpine
docker images --digests node:20-alpine

# Automate with Dependabot / Renovate Bot
# Example renovate.json:
# {
#   "docker": {
#     "fileMatch": ["Dockerfile$"],
#     "pinDigests": true
#   }
# }
```

```dockerfile
# Specify the base image with a pinned digest (maximum reproducibility)
FROM node:20-alpine@sha256:abc123def456...
```

### 10.2 Monitoring Image Size

```bash
# Record image size history
docker images myapp --format "{{.Tag}}\t{{.Size}}" | sort -V

# Size check in CI
MAX_SIZE_MB=200
SIZE=$(docker image inspect myapp:latest --format '{{.Size}}')
SIZE_MB=$((SIZE / 1024 / 1024))
if [ $SIZE_MB -gt $MAX_SIZE_MB ]; then
    echo "ERROR: Image size ($SIZE_MB MB) exceeds limit ($MAX_SIZE_MB MB)"
    exit 1
fi
```

### 10.3 Layer Analysis Tools

```bash
# Analyze layers with dive
dive myapp:latest

# Check the size of each layer with docker history
docker history --no-trunc --format "table {{.Size}}\t{{.CreatedBy}}" myapp:latest

# Get detailed build information with buildctl
docker buildx build --progress=plain --metadata-file build-metadata.json -t myapp .
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
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
        """Retrieve processing results"""
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

### Exercise 2: Applied Pattern

Extend the basic implementation to add the following features.

```python
# Exercise 2: Applied pattern
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

# Test
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # size limit
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

**Key points:**
- Be conscious of algorithm complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured configuration file | Check the path and format of the configuration file |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increased data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access permissions | Verify the executing user's permissions, review settings |
| Data inconsistency | Concurrent process contention | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace to identify where it occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Stepwise verification**: Use log output or a debugger to verify hypotheses
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
    """Decorator that logs function input and output"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"呼び出し: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"戻り値: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"例外発生: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """Data processing (debug target)"""
    if not items:
        raise ValueError("空のデータ")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps for diagnosing performance issues:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Check for memory leaks
3. **Check for I/O waits**: Check disk and network I/O status
4. **Check concurrent connection count**: Check the state of connection pools

| Problem Type | Diagnostic Tool | Countermeasure |
|-----------|-----------|------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexing, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology selections.

| Criterion | When to prioritize | When it can be deprioritized |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin screens, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, speed to market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│              Architecture Selection Flow          │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. What is the team size?                       │
│    ├─ Small (1-5 people) -> Monolith             │
│    └─ Large (10+ people) -> Go to 2              │
│                                                 │
│  2. How often do you deploy?                     │
│    ├─ Once a week or less -> Monolith + modules  │
│    └─ Daily / multiple times -> Go to 3          │
│                                                 │
│  3. How independent are the teams?               │
│    ├─ High -> Microservices                      │
│    └─ Medium -> Modular Monolith                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term costs**
- A fast short-term approach can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay the project

**2. Consistency vs Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies allows the right tool for the job, but increases operational costs

**3. Level of abstraction**
- High abstraction increases reusability, but can make debugging difficult
- Low abstraction is intuitive, but prone to code duplication

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
        """Describe the background and challenge"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision content"""
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

## 11. FAQ

### Q1: Which should I choose, Alpine or Debian slim?

**A:** Alpine (musl libc) is very small (~7MB), but compatibility issues with glibc-based binaries can occur. In particular, building Python native extensions (such as numpy) or Node.js native modules can take longer or fail. Choose Alpine if there are no compatibility issues; choose Debian slim if there are. Alpine is ideal for binaries that link statically, such as Go or Rust.

### Q2: Why doesn't layer caching work in CI?

**A:** CI environments are typically stateless, so the cache is lost on each build. The following countermeasures are available:
- **Registry cache**: Use `--cache-from type=registry` to reuse the previous image as cache
- **GitHub Actions Cache**: Use the cache feature of `docker/build-push-action`
- **BuildKit remote cache**: Persist cache with `--cache-to` / `--cache-from`
Configuring these can achieve a cache hit rate of around 50-80% in CI as well.

### Q3: How should I configure HEALTHCHECK?

**A:** It is common to check against the application's `/health` endpoint. Key configuration points are:
- **interval**: About 30 seconds (too frequent causes overhead)
- **timeout**: 5 seconds (timeout when no response is returned)
- **retries**: 3 times (tolerate temporary failures)
- **start-period**: Application startup time (e.g., 60 seconds for Java)
If curl is not available, use wget or a dedicated health check binary.

### Q4: How do I debug a distroless image?

**A:** Distroless has no shell, making debugging difficult. The following approaches are available:
- **debug variant**: `gcr.io/distroless/base:debug` includes a busybox shell
- **ephemeral container**: Attach a temporary debug container with `kubectl debug` (Kubernetes)
- **docker exec alternative**: Copy files with `docker cp` to inspect them
- **Leverage multi-stage**: Use Alpine for the development stage, and distroless only for production

### Q5: Is it necessary to pin Docker image digests?

**A:** It is recommended from the perspectives of security and reproducibility. Tags such as `node:20-alpine` can be overwritten, and different images may be distributed under the same tag. Pinning the digest like `node:20-alpine@sha256:...` guarantees a completely identical image. However, since automatic application of security patches is impeded, the practical best practice is to combine this with automatic updates via Renovate / Dependabot.

### Q6: Is there a limit on the number of stages in a multi-stage build?

**A:** There is no upper limit on the number of stages per the Dockerfile specification. In practice, however, 3-5 stages is common (dependencies, build, test, production). Too many stages reduce Dockerfile readability, so for complex cases, consider splitting into separate Dockerfiles or managing with build scripts.

### Q7: How do I choose between BuildKit secret mounts and environment variables?

**A:** Secrets needed only at build time (such as authentication tokens for private registries) should be passed with `--mount=type=secret`. This is safe because it does not persist in image layers. Secrets needed at runtime (such as DB passwords) should be injected at runtime via `docker run -e`, Docker Secrets, or Kubernetes Secrets. Never use `ARG` or `ENV` to pass secrets, as they can be seen with `docker history`.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and confirming its behavior.

### Q2: What mistakes do beginners often make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architecture design.

---

## 12. Summary

| Item | Key Points |
|---|---|
| Cache strategy | Place less frequently changed instructions at the top, more frequently changed ones at the bottom |
| .dockerignore | Minimize context by excluding node_modules, .git, .env, etc. |
| Base image | Choose Alpine/slim/distroless based on the use case |
| Security | non-root, vulnerability scanning, secret mounts, SBOM |
| Linting | Automatically detect best practice violations with Hadolint |
| BuildKit | Leverage mount cache, secrets, and parallel builds |
| CI/CD | Reduce CI build times with registry cache |
| Multi-platform | Build AMD64/ARM64 compatible images with buildx |
| Signing and verification | Ensure image trustworthiness with cosign/Docker Content Trust |
| Continuous optimization | Monitor image size, automate base image updates |

---

## What to Read Next

- [03-language-specific.md](./03-language-specific.md) -- Language-specific Dockerfile template collection
- [../02-compose/00-compose-basics.md](../02-compose/00-compose-basics.md) -- Docker Compose basics
- [../02-compose/02-development-workflow.md](../02-compose/02-development-workflow.md) -- Compose development workflow

---

## References

1. **Docker Documentation - Build best practices** https://docs.docker.com/build/building/best-practices/ -- Docker's official build best practices.
2. **Hadolint** https://github.com/hadolint/hadolint -- Official repository for the Dockerfile linter. Explains all rules and configuration methods.
3. **Aqua Security - Trivy** https://aquasecurity.github.io/trivy/ -- Official documentation for the vulnerability scanner. Rich with CI integration configuration examples.
4. **Sysdig - Dockerfile Best Practices** https://sysdig.com/blog/dockerfile-best-practices/ -- Dockerfile best practices from a security perspective.
5. **Docker BuildKit** https://docs.docker.com/build/buildkit/ -- Official documentation for BuildKit features and configuration.
6. **Sigstore - cosign** https://docs.sigstore.dev/cosign/overview/ -- Tool for signing and verifying container images.
7. **dive** https://github.com/wagoodman/dive -- Tool for analyzing Docker image layers.
8. **Chainguard Images** https://www.chainguard.dev/chainguard-images -- Minimal container images focused on security.

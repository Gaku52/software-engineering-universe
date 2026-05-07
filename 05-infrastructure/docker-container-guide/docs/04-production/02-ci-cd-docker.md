# Docker CI/CD

> Centered on GitHub Actions, this guide covers building automated Docker image build, test, registry push, and deployment pipelines.

---

## What You Will Learn

1. Understand workflow design for **automated Docker image build and push with GitHub Actions**
2. Learn optimization techniques using **multi-platform builds and cache strategies**
3. Be able to build a **deployment pipeline from staging to production**
4. Understand how to integrate **security scanning and image signing** into CI/CD
5. Learn Docker integration patterns with other CI/CD tools such as **GitLab CI / CircleCI**


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Monitoring](./01-monitoring.md)

---

## 1. Overview of the Docker CI/CD Pipeline

### Pipeline Architecture

```
┌─────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Code   │    │  Build   │    │  Test    │    │  Deploy  │
│  Push   │───►│  Image   │───►│  Scan   │───►│  Release │
│         │    │          │    │  Verify  │    │          │
└─────────┘    └──────────┘    └──────────┘    └──────────┘
     │              │               │               │
     ▼              ▼               ▼               ▼
  git push     docker build    trivy scan     docker push
  Create PR    multi-stage     unit test      kubectl apply
  Create tag   layer cache     integration    docker compose
```

### CI/CD Pipeline Principles

```
┌─────────────────────────────────────────────────────────┐
│              5 Principles of CI/CD Pipelines             │
│                                                          │
│  1. Reproducibility  Always produce the same image       │
│                      from the same commit                │
│  2. Immutability     Never modify a built image          │
│  3. Speed            Optimize with caching & parallel    │
│                      execution                           │
│  4. Security         Secret management, scanning,        │
│                      signing                             │
│  5. Observability    Integrate build logs, metrics,      │
│                      and notifications                   │
└─────────────────────────────────────────────────────────┘
```

### CI/CD Tool Comparison

| Tool | Docker Integration | Features | Free Tier |
|--------|-----------|------|--------|
| GitHub Actions | Official Docker Action | GitHub integration, GHCR support | 2,000 min/month |
| GitLab CI | Docker-in-Docker | Built-in registry | 400 min/month |
| CircleCI | Docker Executor | Fast, Docker Layer Cache | 6,000 min/month |
| AWS CodeBuild | ECR integration | AWS-native | 100 min/month |
| Jenkins | Docker Plugin | Self-hosted, highly customizable | Unlimited (self-hosted) |

---

## 2. GitHub Actions Basic Configuration

### Code Example 1: Basic Docker Build and Push

```yaml
# .github/workflows/docker-build.yml
name: Docker Build and Push

on:
  push:
    branches: [main, develop]
    tags: ["v*"]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      # 1. Checkout
      - name: Checkout repository
        uses: actions/checkout@v4

      # 2. Set up Docker Buildx
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      # 3. Log in to registry
      - name: Log in to Container Registry
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      # 4. Extract metadata (tags, labels)
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            # Branch name tag
            type=ref,event=branch
            # PR number tag
            type=ref,event=pr
            # Semantic versioning
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=semver,pattern={{major}}
            # Git SHA (short)
            type=sha,prefix=sha-
            # latest (main branch only)
            type=raw,value=latest,enable={{is_default_branch}}

      # 5. Build & Push
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64,linux/arm64
```

### Tag Strategy Flow

```
git push main
    └──► ghcr.io/user/app:main
         ghcr.io/user/app:sha-abc1234
         ghcr.io/user/app:latest

git push develop
    └──► ghcr.io/user/app:develop
         ghcr.io/user/app:sha-def5678

git tag v1.2.3
    └──► ghcr.io/user/app:1.2.3
         ghcr.io/user/app:1.2
         ghcr.io/user/app:1
         ghcr.io/user/app:sha-ghi9012
         ghcr.io/user/app:latest

Pull Request #42
    └──► ghcr.io/user/app:pr-42  (not pushed)
```

### Tag Strategy Comparison

| Strategy | Example | Use Case | Characteristics |
|------|---|------|------|
| Semantic version | v1.2.3 | Production release | Human-readable |
| Git SHA | sha-abc1234 | All builds | Full traceability |
| Branch name | main, develop | Development/staging | Auto-updated |
| Timestamp | 20240115-1030 | CI/CD internal | Clear chronological order |
| latest | latest | Development use only | **Prohibited in production** |

---

## 3. Test Integration

### Code Example 2: Test and Security Scan Integration Pipeline

```yaml
# .github/workflows/ci-pipeline.yml
name: CI Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  # === Unit Tests ===
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run unit tests in Docker
        run: |
          docker compose -f docker-compose.test.yml run --rm \
            --build \
            test npm run test:ci

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: coverage/

  # === Lint & Static Analysis ===
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Lint Dockerfile
        uses: hadolint/hadolint-action@v3.1.0
        with:
          dockerfile: Dockerfile
          failure-threshold: warning

      - name: Lint docker-compose files
        run: |
          docker compose -f docker-compose.yml config -q
          docker compose -f docker-compose.prod.yml config -q

  # === Image Build ===
  build:
    needs: [test, lint]
    runs-on: ubuntu-latest
    outputs:
      image-digest: ${{ steps.build.outputs.digest }}
      image-tag: ${{ steps.meta.outputs.version }}
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=sha,prefix=sha-

      - name: Build and push
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          provenance: true
          sbom: true

  # === Security Scan ===
  security-scan:
    needs: [build]
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ghcr.io/${{ github.repository }}:${{ github.sha }}
          format: "sarif"
          output: "trivy-results.sarif"
          severity: "CRITICAL,HIGH"
          exit-code: "1"  # Fail if CRITICAL/HIGH found

      - name: Upload Trivy scan results
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: "trivy-results.sarif"

  # === Dockerfile Best Practices Check ===
  dockerfile-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Dockle
        uses: erzz/dockle-action@v1
        with:
          image: ghcr.io/${{ github.repository }}:${{ github.sha }}
          exit-code: "1"
          exit-level: "WARN"

  # === Integration Tests ===
  integration-test:
    needs: [build]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run integration tests
        env:
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker compose -f docker-compose.integration.yml up -d

          # Wait for health check
          for i in $(seq 1 30); do
            if docker compose -f docker-compose.integration.yml exec -T api \
              wget -q --spider http://localhost:8080/health 2>/dev/null; then
              echo "Service is healthy"
              break
            fi
            echo "Waiting for services... ($i/30)"
            sleep 2
          done

          # Run tests
          docker compose -f docker-compose.integration.yml run --rm \
            test npm run test:integration

          # Cleanup
          docker compose -f docker-compose.integration.yml down -v
```

```yaml
# docker-compose.test.yml
version: "3.9"

services:
  test:
    build:
      context: .
      target: test  # Test stage
    volumes:
      - ./coverage:/app/coverage
    environment:
      NODE_ENV: test
      DATABASE_URL: postgres://test:test@db:5432/testdb

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: testdb
    tmpfs:
      - /var/lib/postgresql/data  # Tests run fast in memory
```

```yaml
# docker-compose.integration.yml
version: "3.9"

services:
  api:
    image: ghcr.io/${GITHUB_REPOSITORY}:${IMAGE_TAG}
    environment:
      NODE_ENV: test
      DATABASE_URL: postgres://test:test@db:5432/testdb
      REDIS_URL: redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/health"]
      interval: 5s
      timeout: 3s
      retries: 10

  test:
    build:
      context: .
      target: test
    environment:
      API_URL: http://api:8080
      NODE_ENV: test
    depends_on:
      api:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: testdb
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test"]
      interval: 5s
      timeout: 3s
      retries: 5
    tmpfs:
      - /var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
```

---

## 4. Cache Strategies

### Code Example 3: Advanced Cache Configuration

```yaml
# .github/workflows/cached-build.yml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      # Method 1: GitHub Actions Cache (recommended)
      - name: Build with GHA cache
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      # Method 2: Registry cache
      # cache-from: type=registry,ref=ghcr.io/${{ github.repository }}:buildcache
      # cache-to: type=registry,ref=ghcr.io/${{ github.repository }}:buildcache,mode=max

      # Method 3: Local cache
      # cache-from: type=local,src=/tmp/.buildx-cache
      # cache-to: type=local,dest=/tmp/.buildx-cache-new,mode=max
```

### Cache Method Comparison

| Method | Speed | Storage Limit | Shared Across CI | Ease of Setup | Cost |
|------|------|---------|---------|-------------|--------|
| GHA Cache | Fast | 10GB | Same repo | Easiest | Free |
| Registry Cache | Medium | Unlimited | All environments | Moderate | Registry fees |
| Local Cache | Fastest | Disk-dependent | Not possible | Easy | Free |
| Inline Cache | Medium | Inside image | All environments | Easy | Free |
| S3 Cache | Medium | Unlimited | All environments | Somewhat complex | S3 fees |

### How Caching Works

```
First build (no cache)
┌──────────────────────────────────┐
│ Layer 1: FROM node:20-alpine     │  ← Download
│ Layer 2: COPY package*.json      │  ← New creation
│ Layer 3: RUN npm ci              │  ← New creation (slow)
│ Layer 4: COPY . .                │  ← New creation
│ Layer 5: RUN npm run build       │  ← New creation
└──────────────────────────────────┘
  Total: 3 minutes

Second build (only source code changed)
┌──────────────────────────────────┐
│ Layer 1: FROM node:20-alpine     │  ← Cache HIT
│ Layer 2: COPY package*.json      │  ← Cache HIT
│ Layer 3: RUN npm ci              │  ← Cache HIT ★ Fast
│ Layer 4: COPY . .                │  ← Rebuilt (change detected)
│ Layer 5: RUN npm run build       │  ← Rebuilt
└──────────────────────────────────┘
  Total: 30 seconds
```

### Dockerfile Cache Optimization

```dockerfile
# === Dockerfile that maximizes cache usage ===
FROM node:20-alpine AS builder

WORKDIR /app

# 1. Copy only package manager lock files first
# → This layer is cached as long as dependencies don't change
COPY package.json package-lock.json ./

# 2. Install dependencies (slowest step)
# → Only re-executed when lock file changes
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# 3. Copy source code (changes frequently)
COPY tsconfig.json ./
COPY src/ ./src/

# 4. Build
RUN npm run build

# === Production stage ===
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production

# Copy build artifacts
COPY --from=builder /app/dist ./dist

USER node
CMD ["node", "dist/server.js"]
```

### BuildKit Mount Cache

```dockerfile
# Leverage BuildKit cache mounts (--mount=type=cache)
# Share package manager caches across builds

# Go
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -o /app/server ./cmd/server

# Python
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# Rust
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release

# Java/Maven
RUN --mount=type=cache,target=/root/.m2 \
    mvn package -DskipTests

# Java/Gradle
RUN --mount=type=cache,target=/root/.gradle \
    gradle build -x test
```

---

## 5. Deployment Pipeline

### Code Example 4: Staging to Production Deployment

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    tags: ["v*"]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    outputs:
      version: ${{ steps.version.outputs.version }}
      digest: ${{ steps.build.outputs.digest }}
    steps:
      - uses: actions/checkout@v4

      - name: Extract version
        id: version
        run: echo "version=${GITHUB_REF_NAME#v}" >> $GITHUB_OUTPUT

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ steps.version.outputs.version }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
          provenance: true
          sbom: true

  # === Security Scan ===
  security-scan:
    needs: [build]
    runs-on: ubuntu-latest
    steps:
      - name: Run Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ needs.build.outputs.version }}
          severity: "CRITICAL"
          exit-code: "1"

  # === Staging Deploy ===
  deploy-staging:
    needs: [build, security-scan]
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.example.com
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to staging
        env:
          VERSION: ${{ needs.build.outputs.version }}
        run: |
          # Deploy via SSH
          ssh -o StrictHostKeyChecking=no deploy@staging.example.com << EOF
            cd /opt/app
            export VERSION=${VERSION}
            docker compose pull
            docker compose up -d --remove-orphans
            docker compose exec -T api wget -q --spider http://localhost:8080/health
          EOF

      - name: Run smoke tests
        run: |
          sleep 10
          curl -f https://staging.example.com/health || exit 1
          curl -f https://staging.example.com/api/status || exit 1

      - name: Run E2E tests
        run: |
          docker run --rm \
            -e BASE_URL=https://staging.example.com \
            my-e2e-tests:latest \
            npm run test:e2e

  # === Production Deploy (after manual approval) ===
  deploy-production:
    needs: [deploy-staging]
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://www.example.com
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to production
        env:
          VERSION: ${{ needs.build.outputs.version }}
        run: |
          ssh -o StrictHostKeyChecking=no deploy@prod.example.com << 'EOF'
            cd /opt/app

            # Rolling deploy
            export VERSION=${{ env.VERSION }}
            docker compose pull
            docker compose up -d --remove-orphans --scale api=3

            # Health check
            for i in $(seq 1 30); do
              if docker compose exec -T api wget -q --spider http://localhost:8080/health; then
                echo "Health check passed"
                break
              fi
              echo "Waiting for health check... ($i/30)"
              sleep 2
            done

            # Remove old images
            docker image prune -af --filter "until=168h"
          EOF

      - name: Verify deployment
        run: |
          curl -f https://www.example.com/health
          curl -f https://www.example.com/api/status

      - name: Notify deployment
        if: success()
        uses: slackapi/slack-github-action@v1.24.0
        with:
          channel-id: "#deployments"
          slack-message: "Deployed v${{ needs.build.outputs.version }} to production"
        env:
          SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
```

### Deployment Flow

```
git tag v1.2.3 && git push --tags
    │
    ▼
┌──────────┐     ┌─────────────┐     ┌──────────────┐
│  Build   │────►│  Security   │────►│  Staging     │
│  & Push  │     │  Scan       │     │  Deploy      │
│          │     │             │     │  (automatic) │
└──────────┘     └─────────────┘     └──────┬───────┘
                                             │
                                        Smoke Test
                                        E2E Test
                                             │
                                    ┌────────▼───────┐
                                    │  Production    │
                                    │  Deploy        │
                                    │  (manual       │
                                    │   approval)    │
                                    └────────┬───────┘
                                             │
                                        Health Check
                                        Rolling Update
                                        Slack Notification
```

### Rollback Strategy

```yaml
# .github/workflows/rollback.yml
name: Rollback Production

on:
  workflow_dispatch:
    inputs:
      version:
        description: "Version to rollback to (e.g., 1.2.2)"
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    environment:
      name: production
    steps:
      - uses: actions/checkout@v4

      - name: Verify image exists
        run: |
          docker pull ghcr.io/${{ github.repository }}:${{ inputs.version }}

      - name: Rollback production
        run: |
          ssh deploy@prod.example.com << EOF
            cd /opt/app
            export VERSION=${{ inputs.version }}
            docker compose pull
            docker compose up -d --remove-orphans

            # Health check
            for i in $(seq 1 30); do
              if docker compose exec -T api wget -q --spider http://localhost:8080/health; then
                echo "Rollback successful - v${{ inputs.version }}"
                break
              fi
              sleep 2
            done
          EOF

      - name: Notify rollback
        uses: slackapi/slack-github-action@v1.24.0
        with:
          channel-id: "#deployments"
          slack-message: "ROLLBACK: Production rolled back to v${{ inputs.version }}"
        env:
          SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
```

---

## 6. Multi-Platform Builds

### Code Example 5: ARM64 + AMD64 Multi-Platform

```yaml
# .github/workflows/multi-platform.yml
name: Multi-Platform Build

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3
        with:
          platforms: linux/amd64,linux/arm64

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push multi-platform
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          platforms: linux/amd64,linux/arm64
          tags: |
            ghcr.io/${{ github.repository }}:latest
            ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Matrix Strategy for Per-Platform Builds

```yaml
# Speed up: build each platform in parallel, then merge manifests
jobs:
  build-platform:
    strategy:
      matrix:
        platform:
          - linux/amd64
          - linux/arm64
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push by digest
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: ${{ matrix.platform }}
          outputs: type=image,name=ghcr.io/${{ github.repository }},push-by-digest=true,name-canonical=true,push=true
          cache-from: type=gha,scope=${{ matrix.platform }}
          cache-to: type=gha,scope=${{ matrix.platform }},mode=max

      - name: Export digest
        run: echo "${{ steps.build.outputs.digest }}" > /tmp/digest-${{ strategy.job-index }}

      - uses: actions/upload-artifact@v4
        with:
          name: digest-${{ strategy.job-index }}
          path: /tmp/digest-*

  # Create manifest list
  merge:
    needs: [build-platform]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          pattern: digest-*
          merge-multiple: true
          path: /tmp/digests

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Create manifest list
        run: |
          digests=$(cat /tmp/digests/digest-*)
          docker buildx imagetools create \
            -t ghcr.io/${{ github.repository }}:latest \
            $digests
```

---

## 7. Reproducing CI Locally with Docker Compose

### Code Example 6: Reproduce CI Pipeline Locally

```yaml
# docker-compose.ci.yml
version: "3.9"

services:
  lint:
    image: hadolint/hadolint:latest-alpine
    volumes:
      - ./Dockerfile:/Dockerfile:ro
    command: hadolint /Dockerfile

  test:
    build:
      context: .
      target: test
    command: npm run test:ci
    environment:
      NODE_ENV: test
      DATABASE_URL: postgres://ci:ci@db:5432/ci_test
    depends_on:
      db:
        condition: service_healthy

  security-scan:
    image: aquasec/trivy:latest
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - trivy-cache:/root/.cache/
    command: image --severity HIGH,CRITICAL my-app:test

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ci
      POSTGRES_PASSWORD: ci
      POSTGRES_DB: ci_test
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ci"]
      interval: 5s
      timeout: 3s
      retries: 5
    tmpfs:
      - /var/lib/postgresql/data

volumes:
  trivy-cache:
```

```bash
# Run CI pipeline locally
docker compose -f docker-compose.ci.yml run --rm lint
docker compose -f docker-compose.ci.yml run --rm test
docker compose -f docker-compose.ci.yml run --rm security-scan
docker compose -f docker-compose.ci.yml down -v
```

### CI/CD Task Management with Makefile

```makefile
# Makefile - Unified interface for CI/CD tasks
.PHONY: build test lint scan deploy-staging deploy-production

# Variables
IMAGE_NAME := ghcr.io/myorg/myapp
VERSION := $(shell git describe --tags --always)

# Build
build:
	docker build -t $(IMAGE_NAME):$(VERSION) -t $(IMAGE_NAME):latest .

# Test
test:
	docker compose -f docker-compose.test.yml run --rm --build test

# Lint
lint:
	docker run --rm -v $(PWD)/Dockerfile:/Dockerfile \
		hadolint/hadolint:latest-alpine hadolint /Dockerfile

# Security scan
scan:
	trivy image --severity HIGH,CRITICAL $(IMAGE_NAME):$(VERSION)

# Run all CI steps
ci: lint test build scan

# Staging deploy
deploy-staging:
	VERSION=$(VERSION) docker compose -f docker-compose.staging.yml pull
	VERSION=$(VERSION) docker compose -f docker-compose.staging.yml up -d

# Production deploy
deploy-production:
	@echo "Deploying $(VERSION) to production..."
	VERSION=$(VERSION) docker compose -f docker-compose.prod.yml pull
	VERSION=$(VERSION) docker compose -f docker-compose.prod.yml up -d --remove-orphans

# Cleanup
clean:
	docker compose -f docker-compose.test.yml down -v
	docker image prune -f
```

---

## 8. Docker CI/CD with GitLab CI / CircleCI

### Docker Build with GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - scan
  - deploy

variables:
  DOCKER_IMAGE: $CI_REGISTRY_IMAGE
  DOCKER_TAG: $CI_COMMIT_SHORT_SHA

# Test
test:
  stage: test
  image: docker:24-dind
  services:
    - docker:24-dind
  script:
    - docker compose -f docker-compose.test.yml run --rm test

# Build & Push
build:
  stage: build
  image: docker:24-dind
  services:
    - docker:24-dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - docker build -t $DOCKER_IMAGE:$DOCKER_TAG -t $DOCKER_IMAGE:latest .
    - docker push $DOCKER_IMAGE:$DOCKER_TAG
    - docker push $DOCKER_IMAGE:latest

# Security scan
scan:
  stage: scan
  image: aquasec/trivy:latest
  script:
    - trivy image --severity CRITICAL,HIGH $DOCKER_IMAGE:$DOCKER_TAG

# Staging deploy
deploy-staging:
  stage: deploy
  environment:
    name: staging
    url: https://staging.example.com
  script:
    - ssh deploy@staging.example.com "cd /opt/app && VERSION=$DOCKER_TAG docker compose up -d"
  only:
    - main

# Production deploy (manual)
deploy-production:
  stage: deploy
  environment:
    name: production
    url: https://www.example.com
  script:
    - ssh deploy@prod.example.com "cd /opt/app && VERSION=$DOCKER_TAG docker compose up -d"
  when: manual
  only:
    - tags
```

### Docker Build with CircleCI

```yaml
# .circleci/config.yml
version: 2.1

orbs:
  docker: circleci/docker@2.4.0

executors:
  docker-executor:
    docker:
      - image: cimg/base:2024.01

jobs:
  build-and-push:
    executor: docker-executor
    steps:
      - checkout
      - setup_remote_docker:
          docker_layer_caching: true  # DLC (paid feature)
      - docker/check:
          registry: ghcr.io
          docker-username: GHCR_USER
          docker-password: GHCR_TOKEN
      - docker/build:
          image: $CIRCLE_PROJECT_USERNAME/$CIRCLE_PROJECT_REPONAME
          registry: ghcr.io
          tag: ${CIRCLE_SHA1:0:8},latest
      - docker/push:
          image: $CIRCLE_PROJECT_USERNAME/$CIRCLE_PROJECT_REPONAME
          registry: ghcr.io
          tag: ${CIRCLE_SHA1:0:8},latest

  security-scan:
    docker:
      - image: aquasec/trivy:latest
    steps:
      - run:
          name: Scan image
          command: |
            trivy image --severity CRITICAL,HIGH \
              ghcr.io/$CIRCLE_PROJECT_USERNAME/$CIRCLE_PROJECT_REPONAME:${CIRCLE_SHA1:0:8}

workflows:
  build-deploy:
    jobs:
      - build-and-push:
          context: docker-credentials
      - security-scan:
          requires:
            - build-and-push
```

---

## 9. Image Signing and Supply Chain Security

### Image Signing with Cosign

```yaml
# Image signing in GitHub Actions
- name: Install Cosign
  uses: sigstore/cosign-installer@v3

- name: Sign the image
  env:
    COSIGN_EXPERIMENTAL: "1"
  run: |
    cosign sign --yes \
      ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}

- name: Verify the signature
  run: |
    cosign verify \
      --certificate-identity "https://github.com/${{ github.repository }}/.github/workflows/docker-build.yml@refs/heads/main" \
      --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
      ghcr.io/${{ github.repository }}:latest
```

### Generating an SBOM (Software Bill of Materials)

```yaml
# Automatically generate SBOM at build time
- name: Build with SBOM
  uses: docker/build-push-action@v5
  with:
    context: .
    push: true
    tags: ghcr.io/${{ github.repository }}:latest
    sbom: true        # SBOM generation by BuildKit
    provenance: true  # Attach SLSA Provenance

# Or explicitly generate SBOM with Syft
- name: Generate SBOM with Syft
  uses: anchore/sbom-action@v0
  with:
    image: ghcr.io/${{ github.repository }}:latest
    format: spdx-json
    output-file: sbom.spdx.json

- name: Upload SBOM
  uses: actions/upload-artifact@v4
  with:
    name: sbom
    path: sbom.spdx.json
```

---

## 10. Deploying to AWS ECR / Docker Hub

### Pushing to AWS ECR

```yaml
# .github/workflows/ecr-push.yml
jobs:
  build-push-ecr:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions-ecr
          aws-region: ap-northeast-1

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push to ECR
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ steps.login-ecr.outputs.registry }}/my-app:${{ github.sha }}
            ${{ steps.login-ecr.outputs.registry }}/my-app:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Pushing to Docker Hub

```yaml
# .github/workflows/dockerhub-push.yml
jobs:
  build-push-dockerhub:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Build and push to Docker Hub
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            myorg/my-app:${{ github.sha }}
            myorg/my-app:latest
```

---

## Anti-Patterns

### Anti-Pattern 1: Deploying with Only the `latest` Tag

```yaml
# BAD: Deploy with only the latest tag
services:
  app:
    image: my-app:latest  # Unclear which version is running

# GOOD: Explicit version tag
services:
  app:
    image: my-app:1.2.3   # Full version specification
    # or
    image: my-app:sha-abc1234  # Identified by Git SHA
```

**Why it's a problem**: The `latest` tag is mutable (can be overwritten), making it impossible to track which commit's code is running in production. Rollbacks also become difficult.

### Anti-Pattern 2: Hardcoding Secrets in CI

```yaml
# BAD: Write secrets directly in the workflow
- name: Login to Docker Hub
  run: docker login -u myuser -p MyP@ssw0rd!

# GOOD: Use GitHub Secrets
- name: Login to Docker Hub
  uses: docker/login-action@v3
  with:
    username: ${{ secrets.DOCKERHUB_USERNAME }}
    password: ${{ secrets.DOCKERHUB_TOKEN }}
```

**Why it's a problem**: Secrets leak into the repository and credentials can be exploited by third parties. GitHub Secrets are encrypted and masked even in logs.

### Anti-Pattern 3: Deploying Without Tests

```yaml
# BAD: Deploy immediately after build
jobs:
  build-and-deploy:
    steps:
      - uses: docker/build-push-action@v5
      - run: ssh prod "docker pull && docker compose up -d"

# GOOD: Test → Scan → Staging → Approval → Production
jobs:
  test: ...
  build: { needs: [test] }
  scan: { needs: [build] }
  deploy-staging: { needs: [scan] }
  deploy-production: { needs: [deploy-staging] }
```

**Why it's a problem**: Skipping tests and security scans allows bugs and vulnerabilities to reach production. Validating through staging reduces the risk of production incidents.

### Anti-Pattern 4: Tightly Coupled Build and Deploy

```yaml
# BAD: Run from build to deploy in a single job
jobs:
  all-in-one:
    steps:
      - run: docker build .
      - run: docker push
      - run: ssh prod "deploy"

# GOOD: Separate by stage and add gates
jobs:
  build: ...
  test: { needs: [build] }
  deploy: { needs: [test], environment: production }
```

**Why it's a problem**: Tight coupling risks running a deploy even when tests fail. It also requires a rebuild when deploying the same image to multiple environments.


---

## Practice Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

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
| Initialization error | Misconfigured config file | Check config file path and format |
| Timeout | Network latency / resource shortage | Adjust timeout values, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check executing user's permissions, review settings |
| Data inconsistency | Race condition in concurrent processing | Introduce locking mechanism, transaction management |

### Debugging Steps

1. **Check error messages**: Read the stack trace to identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Validate incrementally**: Use log output or a debugger to verify hypotheses
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
    """Decorator that logs function input/output"""
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

Steps to diagnose when performance issues occur:

1. **Identify bottlenecks**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check for I/O waits**: Check disk and network I/O status
4. **Check concurrent connections**: Review connection pool state

| Problem Type | Diagnostic Tool | Solution |
|-----------|-----------|------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |
---

## FAQ

### Q1: Should I use Docker Hub or GitHub Container Registry (GHCR)?

**GHCR recommended**: Seamless integration with GitHub Actions (authentication with `GITHUB_TOKEN`), visibility tied to repository visibility, sufficient free tier. Docker Hub is suitable for distributing public images, but pull rate limits (100 pulls/6 hours) can be problematic in CI environments.

### Q2: What can I do if Docker builds on CI are slow?

1. **Layer cache**: Set `cache-from: type=gha`
2. **Multi-stage build**: Separate test and production stages
3. **Dependency isolation**: COPY `package.json` first, cache the `npm ci` layer
4. **BuildKit mount cache**: Share package caches with `--mount=type=cache`
5. **Parallel builds**: Use `matrix` strategy to run independent services in parallel
6. **Upgrade runner spec**: Use larger runners such as `runs-on: ubuntu-latest-8-cores`

### Q3: How do I perform a rollback?

```bash
# Immediately revert to a previous version
docker compose pull  # Switch to the old version tag
VERSION=1.2.2 docker compose up -d

# Or revert to a specific SHA
docker compose up -d --no-deps \
  -e IMAGE_TAG=sha-abc1234 \
  api
```

Using immutable tags for deployment enables instant rollback to any version.

### Q4: What should I check if I can't push to GHCR with GITHUB_TOKEN?

Check the following:
1. Is `packages: write` set in the workflow's `permissions`?
2. Is the repository's Settings > Actions > General > Workflow permissions set to "Read and write permissions"?
3. For organizations, is the package visibility setting correct?

### Q5: How should Docker CI/CD be designed for a monorepo?

```yaml
# Build only services that have changes using path filters
on:
  push:
    paths:
      - "services/api/**"
      - "shared/**"

# Or build all services in parallel with matrix strategy
jobs:
  build:
    strategy:
      matrix:
        service: [api, worker, frontend]
    steps:
      - name: Build ${{ matrix.service }}
        uses: docker/build-push-action@v5
        with:
          context: ./services/${{ matrix.service }}
          tags: ghcr.io/${{ github.repository }}/${{ matrix.service }}:${{ github.sha }}
```

---

## Summary

| Topic | Key Point |
|------|---------|
| GitHub Actions | Use official Docker Actions. GHCR integration is the simplest |
| Tag strategy | Semantic versioning + Git SHA. Do not rely solely on latest |
| Cache | GHA Cache is recommended. Maximize effectiveness by optimizing layer order |
| Security | Always use Trivy scan, Hadolint, and GitHub Secrets |
| Testing | Reproduce test environment with Docker Compose. Identical in CI and locally |
| Deployment | Gated pipeline: staging → approval → production |
| Rollback | Instant rollback to any version with immutable tags |
| Image signing | Guarantee image authenticity with Cosign |
| SBOM | Ensure supply chain transparency |
| Multi-platform | Support ARM64/AMD64 with QEMU + Buildx |

---

## Further Reading

- [Orchestration Overview](../05-orchestration/00-orchestration-overview.md) -- Extend deployments to K8s/Swarm
- [Container Security](../06-security/00-container-security.md) -- Enhance image scanning in CI
- [Supply Chain Security](../06-security/01-supply-chain-security.md) -- Image signing and SBOM

---

## References

1. GitHub Actions official docs "Building and testing containers" -- https://docs.github.com/en/actions/publishing-packages/publishing-docker-images
2. Docker official GitHub Actions -- https://github.com/docker/build-push-action
3. Docker official docs "CI/CD best practices" -- https://docs.docker.com/build/ci/github-actions/
4. Hadolint (Dockerfile Linter) -- https://github.com/hadolint/hadolint
5. Aqua Security Trivy -- https://github.com/aquasecurity/trivy
6. Sigstore Cosign -- https://github.com/sigstore/cosign
7. SLSA (Supply chain Levels for Software Artifacts) -- https://slsa.dev/
8. Docker official docs "BuildKit" -- https://docs.docker.com/build/buildkit/

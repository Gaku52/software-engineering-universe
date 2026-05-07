# Language-Specific Dockerfiles

> A practical reference showing optimal Dockerfile patterns for Node.js, Python, Go, Rust, and Java in both development and production environments.

---

## What You Will Learn

1. Understand the **build characteristics specific to each language** and write language-optimized Dockerfiles
2. **Design separate stages for development and production** and build images suited to each use case
3. Apply **best practices for each language** (dependency management, caching, security)
4. Understand **cache strategies per package manager** and minimize build time


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Dockerfile Optimization](./02-optimization.md)

---

## 1. Node.js

### 1.1 Express / Fastify (API Server)

```dockerfile
# syntax=docker/dockerfile:1

# === Install dependencies ===
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production

# === Build (TypeScript) ===
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY src/ ./src/
RUN npm run build

# === Production ===
FROM node:20-alpine
RUN addgroup -S app && adduser -S app -G app

# Security: remove unnecessary tools
RUN apk add --no-cache dumb-init

WORKDIR /app

COPY --from=deps --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --chown=app:app package.json ./

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# dumb-init: resolves PID 1 problem (signal forwarding)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
```

### 1.2 Next.js (SSR)

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Inject environment variables at build time
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app

# Next.js standalone output
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public

USER app
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

### 1.3 NestJS

```dockerfile
# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production

FROM node:20-alpine
RUN addgroup -S app && adduser -S app -G app
RUN apk add --no-cache dumb-init

WORKDIR /app

COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --chown=app:app package.json ./

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
```

### 1.4 Node.js Development Environment

```dockerfile
# === Dockerfile for development environment ===
FROM node:20-alpine AS development

# Install development tools
RUN apk add --no-cache git curl

WORKDIR /app

# Install dependencies (including devDependencies)
COPY package.json package-lock.json ./
RUN npm install

# No COPY needed for source code — share via bind mount
# Set volumes: [".:/app"] in docker-compose.yml

EXPOSE 3000

# Hot reload support
CMD ["npm", "run", "dev"]
```

### 1.5 Node.js-Specific Points

```
+------------------------------------------------------+
|          Node.js Dockerfile Key Points               |
|                                                      |
|  1. npm ci vs npm install                            |
|     npm ci: exact match to lockfile, for CI, fast    |
|     npm install: may update the lockfile             |
|                                                      |
|  2. PID 1 Problem                                    |
|     node running as PID 1 handles signals poorly     |
|     -> use dumb-init or tini                         |
|     -> or --init flag: docker run --init ...         |
|                                                      |
|  3. NODE_ENV                                         |
|     production: skip devDependencies                 |
|     use with npm ci --only=production                |
|                                                      |
|  4. Handling .npmrc                                  |
|     use --mount=type=secret for private registry auth|
|                                                      |
|  5. Alpine compatibility issues                      |
|     Native binaries (sharp, bcrypt, etc.) may fail   |
|     on Alpine (musl)                                 |
|     -> npm rebuild may resolve the issue             |
|     -> if not, switch to node:20-slim                |
+------------------------------------------------------+
```

#### npm vs yarn vs pnpm Comparison

| Item | npm | yarn (v3+) | pnpm |
|---|---|---|---|
| Lock file | package-lock.json | yarn.lock | pnpm-lock.yaml |
| CI install | `npm ci` | `yarn install --immutable` | `pnpm install --frozen-lockfile` |
| Cache path | `/root/.npm` | `/root/.yarn/cache` | `/root/.local/share/pnpm/store` |
| Workspaces | npm workspaces | yarn workspaces | pnpm workspaces |
| Disk efficiency | Normal | Improved with PnP | Best with hard links |

#### Dockerfile Using pnpm

```dockerfile
FROM node:20-alpine AS builder
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

FROM node:20-alpine AS prod-deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

FROM node:20-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist ./dist
USER app
CMD ["node", "dist/server.js"]
```

---

## 2. Python

### 2.1 Flask / FastAPI

```dockerfile
# syntax=docker/dockerfile:1

FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Build dependencies (for compiling native extensions)
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --prefix=/install -r requirements.txt

# === Production ===
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Runtime dependencies only (gcc not needed)
RUN apt-get update && \
    apt-get install -y --no-install-recommends libpq5 curl && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

RUN useradd --create-home --shell /bin/bash appuser
COPY --chown=appuser:appuser . .

USER appuser
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "app:app"]
```

### 2.2 FastAPI + uvicorn

```dockerfile
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --prefix=/install -r requirements.txt

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY --from=builder /install /usr/local

RUN useradd --create-home appuser
COPY --chown=appuser:appuser . .
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Start async server with uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### 2.3 Using Poetry

```dockerfile
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN pip install poetry==1.7.1
RUN poetry config virtualenvs.create false

WORKDIR /app
COPY pyproject.toml poetry.lock ./
RUN poetry install --no-dev --no-interaction --no-ansi

# === Production ===
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

RUN useradd --create-home appuser
COPY --chown=appuser:appuser . .
USER appuser

EXPOSE 8000
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "app:app"]
```

### 2.4 Using uv (Fast Package Manager)

```dockerfile
FROM python:3.12-slim AS builder

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /app

# Install dependencies
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

# Application code
COPY . .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

FROM python:3.12-slim
WORKDIR /app

RUN useradd --create-home appuser

COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app .

ENV PATH="/app/.venv/bin:$PATH"

USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 2.5 Django

```dockerfile
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --prefix=/install -r requirements.txt

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.production

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends libpq5 && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local
COPY . .

# Collect static files
RUN python manage.py collectstatic --noinput

RUN useradd --create-home appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health/')" || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "config.wsgi:application"]
```

### 2.6 Python-Specific Points

```
+------------------------------------------------------+
|          Python Dockerfile Key Points                |
|                                                      |
|  Important environment variables                     |
|  +------------------------------------------------+ |
|  | PYTHONDONTWRITEBYTECODE=1 | Suppress .pyc gen  | |
|  | PYTHONUNBUFFERED=1        | No buffering        | |
|  | PIP_NO_CACHE_DIR=1        | Disable pip cache   | |
|  | PIP_DISABLE_PIP_VERSION_CHECK=1 | Skip update  | |
|  +------------------------------------------------+ |
|                                                      |
|  Choosing a package manager                          |
|  +------------------------------------------------+ |
|  | pip        | Standard, simplest                 | |
|  | poetry     | pyproject.toml, excellent dep mgmt | |
|  | uv         | Rust-based, very fast (10-100x pip) | |
|  | pipenv     | Pipfile, integrated virtualenv      | |
|  | pdm        | PEP 582 compliant, modern           | |
|  +------------------------------------------------+ |
|                                                      |
|  Multi-stage tips                                    |
|  - Use pip install --prefix=/install to isolate      |
|  - Install gcc only in the build stage               |
|  - Runtime stage needs only shared libraries (.so)   |
+------------------------------------------------------+
```

---

## 3. Go

### 3.1 Web API Server

```dockerfile
# syntax=docker/dockerfile:1

FROM golang:1.22-alpine AS builder

# Fetch CA certificates and timezone data
RUN apk add --no-cache ca-certificates tzdata

# Pre-create non-root user
RUN adduser -D -g '' appuser

WORKDIR /app

# Download dependencies first
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download && go mod verify

# Copy source code and build
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build \
        -ldflags="-w -s -X main.version=$(git describe --tags 2>/dev/null || echo dev)" \
        -o /server \
        ./cmd/server

# === Production (scratch) ===
FROM scratch

# Copy only required files
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /server /server

USER appuser
EXPOSE 8080
ENTRYPOINT ["/server"]
```

### 3.2 When CGO Is Required

```dockerfile
FROM golang:1.22-alpine AS builder
RUN apk add --no-cache gcc musl-dev

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
# Static linking with CGO_ENABLED=1 (default)
RUN go build -ldflags="-w -s -linkmode external -extldflags '-static'" \
    -o /server ./cmd/server

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
RUN adduser -D appuser
COPY --from=builder /server /server
USER appuser
EXPOSE 8080
ENTRYPOINT ["/server"]
```

### 3.3 Multi-Platform Support

```dockerfile
FROM --platform=$BUILDPLATFORM golang:1.22-alpine AS builder

ARG TARGETOS
ARG TARGETARCH

RUN apk add --no-cache ca-certificates tzdata git
RUN adduser -D -g '' appuser

WORKDIR /app
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -ldflags="-w -s" -o /server ./cmd/server

FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /server /server
USER appuser
EXPOSE 8080
ENTRYPOINT ["/server"]
```

### 3.4 Go-Specific Points

```
+------------------------------------------------------+
|              Go Dockerfile Key Points                |
|                                                      |
|  Build flags                                         |
|  +------------------------------------------------+ |
|  | CGO_ENABLED=0  | No C library dependency        | |
|  |                | -> enables use of scratch       | |
|  | -ldflags="-w"  | Strip DWARF debug info          | |
|  | -ldflags="-s"  | Strip symbol table              | |
|  | GOOS=linux     | Binary for Linux                | |
|  | GOARCH=amd64   | x86_64 architecture             | |
|  +------------------------------------------------+ |
|                                                      |
|  Base image selection                                |
|  +------------------------------------------------+ |
|  | scratch        | Minimal (binary only)           | |
|  | alpine         | Shell available (for debugging) | |
|  | distroless     | Middle ground (with glibc)      | |
|  +------------------------------------------------+ |
|                                                      |
|  Additional files needed for scratch                 |
|  +------------------------------------------------+ |
|  | /etc/ssl/certs/    | CA certs for HTTPS          | |
|  | /usr/share/zoneinfo| Timezone data               | |
|  | /etc/passwd        | Non-root user info          | |
|  | /tmp               | Temp files (if needed)      | |
|  +------------------------------------------------+ |
+------------------------------------------------------+
```

---

## 4. Rust

### 4.1 Actix-web / Axum

```dockerfile
# syntax=docker/dockerfile:1

# === Dependency planning ===
FROM rust:1.75-alpine AS chef
RUN apk add --no-cache musl-dev
RUN cargo install cargo-chef --locked
WORKDIR /app

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# === Dependency build (for caching) ===
FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json

# Build only dependencies (cache is effective on source code changes)
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    cargo chef cook --release --recipe-path recipe.json

# Application build
COPY . .
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release && \
    cp target/release/myapp /usr/local/bin/

# === Production ===
FROM alpine:3.19
RUN apk add --no-cache ca-certificates
RUN addgroup -S app && adduser -S app -G app

COPY --from=builder /usr/local/bin/myapp /usr/local/bin/

USER app
EXPOSE 8080
CMD ["myapp"]
```

### 4.2 Using scratch with Static Linking (musl)

```dockerfile
FROM rust:1.75-alpine AS builder
RUN apk add --no-cache musl-dev

WORKDIR /app
COPY . .

# Static linking with musl target
RUN rustup target add x86_64-unknown-linux-musl
RUN RUSTFLAGS="-C target-feature=+crt-static" \
    cargo build --release --target x86_64-unknown-linux-musl

FROM scratch
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/myapp /myapp
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

EXPOSE 8080
ENTRYPOINT ["/myapp"]
```

### 4.3 Compile Cache with sccache

```dockerfile
FROM rust:1.75-alpine AS builder
RUN apk add --no-cache musl-dev

# Install sccache
RUN cargo install sccache --locked
ENV RUSTC_WRAPPER=sccache
ENV SCCACHE_DIR=/sccache

WORKDIR /app
COPY . .

RUN --mount=type=cache,target=/sccache \
    --mount=type=cache,target=/usr/local/cargo/registry \
    cargo build --release && \
    cp target/release/myapp /usr/local/bin/

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /usr/local/bin/myapp /usr/local/bin/
EXPOSE 8080
CMD ["myapp"]
```

### 4.4 Rust-Specific Points

```
+------------------------------------------------------+
|           Rust Dockerfile Key Points                 |
|                                                      |
|  Challenge: Rust builds are very slow                |
|  (full build takes minutes to tens of minutes)       |
|                                                      |
|  Solutions:                                          |
|  1. cargo-chef: build only dependencies first        |
|     -> dependency cache is effective on src changes  |
|                                                      |
|  2. BuildKit mount cache                             |
|     -> cache cargo registry and target               |
|                                                      |
|  3. sccache (shared compile cache)                   |
|     -> share cache across multiple builds in CI      |
|                                                      |
|  4. Dummy main.rs pattern                            |
|     -> dependency caching without cargo-chef         |
|                                                      |
|  Static linking: compile with musl libc              |
|  -> scratch-based image possible at 5-15MB           |
+------------------------------------------------------+
```

---

## 5. Java

### 5.1 Spring Boot (Gradle)

```dockerfile
# syntax=docker/dockerfile:1

# === Build ===
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app

# Gradle Wrapper and config files
COPY gradlew build.gradle.kts settings.gradle.kts ./
COPY gradle ./gradle

# Download dependencies (for caching)
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew dependencies --no-daemon

# Copy source code and build
COPY src ./src
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew bootJar --no-daemon

# Extract JAR layers
RUN java -Djarmode=layertools \
    -jar build/libs/*.jar extract --destination extracted

# === Production ===
FROM eclipse-temurin:21-jre-alpine

RUN addgroup -S app && adduser -S app -G app
WORKDIR /app

# Spring Boot layers (change frequency: low -> high)
COPY --from=builder --chown=app:app /app/extracted/dependencies/ ./
COPY --from=builder --chown=app:app /app/extracted/spring-boot-loader/ ./
COPY --from=builder --chown=app:app /app/extracted/snapshot-dependencies/ ./
COPY --from=builder --chown=app:app /app/extracted/application/ ./

USER app
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1

# JVM tuning
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS org.springframework.boot.loader.launch.JarLauncher"]
```

### 5.2 Using Maven

```dockerfile
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app

COPY pom.xml ./
COPY .mvn ./.mvn
COPY mvnw ./
RUN --mount=type=cache,target=/root/.m2 \
    ./mvnw dependency:go-offline -B

COPY src ./src
RUN --mount=type=cache,target=/root/.m2 \
    ./mvnw package -DskipTests -B

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=builder --chown=app:app /app/target/*.jar app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### 5.3 GraalVM Native Image

```dockerfile
# === Stage 1: Native image build ===
FROM ghcr.io/graalvm/native-image-community:21 AS builder
WORKDIR /app

COPY gradlew build.gradle.kts settings.gradle.kts ./
COPY gradle ./gradle
COPY src ./src

# Build native image (takes a long time)
RUN ./gradlew nativeCompile --no-daemon

# === Stage 2: Runtime ===
FROM debian:bookworm-slim
RUN addgroup --system app && adduser --system --ingroup app app

COPY --from=builder /app/build/native/nativeCompile/myapp /usr/local/bin/

USER app
EXPOSE 8080
ENTRYPOINT ["myapp"]
```

### 5.4 Java-Specific Points

```
+------------------------------------------------------+
|            Java Dockerfile Key Points                |
|                                                      |
|  JDK vs JRE                                          |
|  +------------------------------------------------+ |
|  | Build:   eclipse-temurin:21-jdk-alpine          | |
|  | Runtime: eclipse-temurin:21-jre-alpine          | |
|  |   JRE excludes the compiler -> lighter           | |
|  +------------------------------------------------+ |
|                                                      |
|  JVM container support (Java 10+)                    |
|  +------------------------------------------------+ |
|  | -XX:+UseContainerSupport  | Container-aware     | |
|  | -XX:MaxRAMPercentage=75.0 | Use 75% of memory   | |
|  | -XX:InitialRAMPercentage  | Initial heap         | |
|  +------------------------------------------------+ |
|                                                      |
|  Startup time improvements                           |
|  +------------------------------------------------+ |
|  | Spring Boot Layered JAR | Layer caching          | |
|  | CDS (Class Data Sharing)| Faster class loading   | |
|  | GraalVM Native Image    | Native compilation     | |
|  | Spring AOT              | Build-time optimization| |
|  +------------------------------------------------+ |
|                                                      |
|  GraalVM Native Image characteristics               |
|  +------------------------------------------------+ |
|  | Startup: tens of ms (JVM: seconds to tens of s) | |
|  | Memory usage: significantly reduced             | |
|  | Build time: very long (minutes to tens of min)  | |
|  | Reflection: requires configuration              | |
|  | Library support: some restrictions              | |
|  +------------------------------------------------+ |
+------------------------------------------------------+
```

---

## 6. Ruby

### 6.1 Ruby on Rails

```dockerfile
FROM ruby:3.3-slim AS builder

ENV RAILS_ENV=production \
    BUNDLE_WITHOUT=development:test \
    BUNDLE_DEPLOYMENT=1

WORKDIR /app

# System dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        git && \
    rm -rf /var/lib/apt/lists/*

# Install Gems
COPY Gemfile Gemfile.lock ./
RUN --mount=type=cache,target=/usr/local/bundle/cache \
    bundle install --jobs 4 --retry 3

# Application code
COPY . .

# Asset precompilation
RUN SECRET_KEY_BASE=dummy bundle exec rails assets:precompile

# === Production ===
FROM ruby:3.3-slim

ENV RAILS_ENV=production \
    RAILS_LOG_TO_STDOUT=true \
    RAILS_SERVE_STATIC_FILES=true \
    BUNDLE_WITHOUT=development:test \
    BUNDLE_DEPLOYMENT=1

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libpq5 \
        curl && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/bundle /usr/local/bundle
COPY --from=builder /app .

RUN useradd --create-home --shell /bin/bash rails && \
    chown -R rails:rails /app/log /app/tmp /app/storage
USER rails

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
```

---

## 7. PHP

### 7.1 Laravel

```dockerfile
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-scripts --prefer-dist

FROM node:20-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY resources ./resources
COPY vite.config.js ./
RUN npm run build

FROM php:8.3-fpm-alpine

# Install PHP extensions
RUN docker-php-ext-install pdo pdo_mysql opcache bcmath

# vendor from Composer
COPY --from=vendor /app/vendor ./vendor

# Frontend assets
COPY --from=frontend /app/public/build ./public/build

# Application code
COPY . .

# Set permissions
RUN chown -R www-data:www-data storage bootstrap/cache

# PHP configuration
COPY docker/php/php.ini /usr/local/etc/php/php.ini
COPY docker/php/opcache.ini /usr/local/etc/php/conf.d/opcache.ini

USER www-data
EXPOSE 9000
CMD ["php-fpm"]
```

---

## 8. Comparison Tables

### Comparison Table 1: Language-Specific Dockerfile Characteristics

| Language | Base Image (Production) | Typical Size | Build Time | Special Considerations |
|---|---|---|---|---|
| Node.js | node:20-alpine | 100-200MB | Medium | PID 1 problem, standalone output |
| Python | python:3.12-slim | 100-300MB | Medium | No venv needed, native extensions |
| Go | scratch | 5-20MB | Fast | Static binary, CA certificates |
| Rust | scratch / alpine | 5-20MB | Slow | cargo-chef, long compile times |
| Java | temurin:21-jre-alpine | 150-300MB | Medium-Slow | JVM tuning, Layered JAR |
| Ruby | ruby:3.3-slim | 200-400MB | Medium | native gems, asset compilation |
| PHP | php:8.3-fpm-alpine | 100-250MB | Fast | Extension installation, composer |

### Comparison Table 2: Dependency Management Cache Strategies

| Language | Lock File | Cache Target | Mount Cache Path |
|---|---|---|---|
| Node.js (npm) | package-lock.json | node_modules | `/root/.npm` |
| Node.js (pnpm) | pnpm-lock.yaml | pnpm store | `/root/.local/share/pnpm/store` |
| Node.js (yarn) | yarn.lock | yarn cache | `/root/.yarn/cache` |
| Python (pip) | requirements.txt | site-packages | `/root/.cache/pip` |
| Python (Poetry) | poetry.lock | site-packages | `/root/.cache/pypoetry` |
| Python (uv) | uv.lock | uv cache | `/root/.cache/uv` |
| Go | go.sum | module cache | `/go/pkg/mod` |
| Rust | Cargo.lock | registry + target | `/usr/local/cargo/registry` |
| Java (Gradle) | gradle.lockfile | .gradle | `/root/.gradle` |
| Java (Maven) | pom.xml | .m2 | `/root/.m2` |
| Ruby | Gemfile.lock | bundle | `/usr/local/bundle/cache` |
| PHP | composer.lock | vendor | `/tmp/composer-cache` |

### Comparison Table 3: .dockerignore Templates (Per Language)

| Language | Files to Exclude |
|---|---|
| Node.js | `node_modules`, `dist`, `.next`, `coverage`, `.env` |
| Python | `__pycache__`, `*.pyc`, `.venv`, `*.egg-info`, `.mypy_cache` |
| Go | `vendor/` (when using go mod), `*.test`, `coverage.out` |
| Rust | `target/`, `*.pdb` |
| Java | `build/`, `target/`, `.gradle/`, `*.class`, `*.jar` |
| Ruby | `vendor/bundle`, `node_modules`, `tmp/`, `log/` |
| PHP | `vendor/`, `node_modules/`, `storage/logs/` |

---

## 9. Anti-Patterns

### Anti-Pattern 1: Including Development Dependencies in the Production Image

```dockerfile
# NG: devDependencies are included
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install  # <- devDependencies are also installed
CMD ["node", "server.js"]
# -> eslint, jest, typescript, etc. end up in the image

# OK: Only production dependencies
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
CMD ["node", "dist/server.js"]
```

### Anti-Pattern 2: Using the Same Base Image for All Languages

```dockerfile
# NG: Using ubuntu for a Go app
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y golang
COPY . /app
RUN cd /app && go build -o /server
CMD ["/server"]
# -> 800MB+ from unnecessary OS packages

# OK: Minimal image with scratch
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o /server .

FROM scratch
COPY --from=builder /server /server
ENTRYPOINT ["/server"]
# -> ~12MB
```

### Anti-Pattern 3: Not Using a Dependency Lock File

```dockerfile
# NG: Versions are not pinned
FROM python:3.12-slim
COPY requirements.txt .
# requirements.txt uses range specs like numpy>=1.0
RUN pip install -r requirements.txt
# -> Different versions may be installed on each build

# OK: Strict version pinning
FROM python:3.12-slim
COPY requirements.txt .
# requirements.txt uses exact pins like numpy==1.26.4
# or generated by pip-compile
RUN pip install --no-cache-dir -r requirements.txt
```

### Anti-Pattern 4: Leaving Build Tools in the Production Image

```dockerfile
# NG: gcc remains in the image
FROM python:3.12-slim
RUN apt-get update && apt-get install -y gcc libpq-dev
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["gunicorn", "app:app"]
# -> gcc (~200MB) is included in the image even though it is unnecessary

# OK: Separate build tools with multi-stage
FROM python:3.12-slim AS builder
RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --prefix=/install -r requirements.txt

FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /install /usr/local
COPY . .
CMD ["gunicorn", "app:app"]
```

### Anti-Pattern 5: Omitting HEALTHCHECK

```dockerfile
# NG: No health check
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci --only=production
CMD ["node", "server.js"]
# -> Cannot detect if the container is running but the app has crashed

# OK: Appropriate health check per language
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci --only=production && apk add --no-cache curl
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1
CMD ["node", "server.js"]
```

**Problem**: Without HEALTHCHECK, if a process is alive but the application has become unresponsive due to a deadlock or memory leak, it cannot be detected. Especially with runtimes like Java or Node.js, it is common for the process to remain alive while becoming unresponsive. An appropriate health check command should be configured per language.

### Anti-Pattern 6: Non-Multi-Platform Configuration

```dockerfile
# NG: Hardcode an amd64-specific binary
FROM node:20-alpine
RUN wget https://example.com/tool-linux-amd64 -O /usr/local/bin/tool
# -> Does not work on ARM (Apple Silicon M1/M2/M3, Graviton)

# OK: Select binary based on platform
FROM node:20-alpine
ARG TARGETARCH
RUN wget "https://example.com/tool-linux-${TARGETARCH}" -O /usr/local/bin/tool && \
    chmod +x /usr/local/bin/tool
```

**Problem**: With the growing adoption of Apple Silicon Macs and AWS Graviton, ARM64 support is becoming essential. Even if the base image itself supports multiple platforms, additionally downloaded binaries or native extensions may be architecture-specific. Use the `TARGETARCH` build argument to write platform-independent Dockerfiles.


---

## Practical Exercises

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
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Missing or invalid config file | Check config file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check execution user permissions, review configuration |
| Data inconsistency | Concurrent access conflicts | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace and identify where it occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Verify step by step**: Validate hypotheses using log output or a debugger
5. **Fix and run regression tests**: After fixing, run tests for related areas

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

1. **Identify bottlenecks**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check I/O wait**: Inspect disk and network I/O status
4. **Check concurrent connections**: Check the state of connection pools

| Issue Type | Diagnostic Tool | Countermeasure |
|-----------|-----------|------|
| CPU load | cProfile, py-spy | Algorithm improvements, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criteria | When to Prioritize | When to Compromise |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin screens, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, speed to market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│              Architecture Selection Flow         │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. What is the team size?                      │
│    ├─ Small (1-5 people) -> Monolith            │
│    └─ Large (10+ people) -> Go to 2             │
│                                                 │
│  2. How often do you deploy?                    │
│    ├─ Once a week or less -> Monolith + modules │
│    └─ Daily / multiple times -> Go to 3         │
│                                                 │
│  3. How independent are the teams?              │
│    ├─ High -> Microservices                     │
│    └─ Moderate -> Modular monolith              │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Every technical decision involves trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- A short-term fast approach can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay the project

**2. Consistency vs Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies allows best-fit choices but increases operational costs

**3. Level of Abstraction**
- High abstraction increases reusability but can make debugging harder
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
        """Describe background and problem"""
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

## 10. FAQ

### Q1: What do you do when using npm packages with binaries (such as sharp) in Node.js?

**A:** On Alpine, native binary compatibility issues may arise. The countermeasures are as follows:
- Run `npm ci --only=production` on Alpine (native binaries will be built for Alpine)
- For `sharp`, specify `--platform=linuxmusl`
- If the issue cannot be resolved, switch to `node:20-slim` (Debian-based)
- Run `npm rebuild` to recompile native modules

### Q2: Is a virtual environment (venv) needed inside a container for Python?

**A:** Basically, no. Since the container itself is an isolated environment, double isolation with venv is normally unnecessary. However, it is recommended to use a pattern where dependencies are installed to a specific directory with `pip install --prefix=/install` in a multi-stage build and then copied to the runtime stage. When using Poetry, disable venv with `virtualenvs.create false`. When using uv, copying the entire `.venv` directory is the standard pattern.

### Q3: Is GraalVM Native Image effective in containers for Java?

**A:** It is extremely effective. While the normal JVM mode takes several seconds to tens of seconds to start, Native Image starts in tens of milliseconds and significantly reduces memory usage. However, there are constraints: build time is very long (minutes to tens of minutes), reflection configuration is required, and some libraries are not supported. It is especially effective in serverless environments or where scale-out is frequent.

### Q4: How do you debug a Go scratch image?

**A:** Since scratch has no shell, use the following methods to debug:
- **Alpine-based debug image**: Prepare a separate stage based on `FROM alpine:3.19` and build with `--target debug`
- **distroless debug variant**: Use `FROM gcr.io/distroless/static-debian12:debug` to access a busybox shell
- **kubectl debug** (Kubernetes): Attach a debug container with an ephemeral container
- **docker cp**: Copy files from the container to the host for inspection

### Q5: Should I use the same Dockerfile for development and production?

**A:** It is recommended to use the `--target` option of multi-stage builds to branch development and production environments within the same Dockerfile. Include devDependencies, debug tools, and hot reload settings in the development stage, and keep the production stage minimal. By specifying `build.target` in `docker-compose.yml`, different images can be built from the same Dockerfile.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners often make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real work?

Knowledge of this topic is frequently used in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 11. Summary

| Item | Key Points |
|---|---|
| Node.js | npm ci + Alpine + standalone output. Watch out for PID 1 problem. pnpm/yarn also supported |
| Python | slim base + multi-stage to separate build tools. Speed up with uv |
| Go | scratch base for minimal image. Don't forget to copy CA certificates |
| Rust | cargo-chef + mount cache to ease long build times |
| Java | JRE + Layered JAR. Tune JVM container support |
| Ruby | slim + bundle cache. Separate build dependencies for native gems |
| PHP | fpm-alpine + composer + node (frontend). Extension management is important |
| Common | Non-root user, HEALTHCHECK, .dockerignore, multi-stage |

---

## What to Read Next

- [../02-compose/00-compose-basics.md](../02-compose/00-compose-basics.md) -- Docker Compose Basics
- [../02-compose/02-development-workflow.md](../02-compose/02-development-workflow.md) -- Compose Development Workflow
- [02-optimization.md](./02-optimization.md) -- Dockerfile Optimization

---

## References

1. **Node.js Docker Best Practices** https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md -- Official Node.js Docker best practices.
2. **Python Speed - Docker packaging guide** https://pythonspeed.com/docker/ -- A comprehensive guide to optimizing Python containers.
3. **Google - Distroless Images** https://github.com/GoogleContainerTools/distroless -- Description and usage of Distroless images for each language.
4. **cargo-chef documentation** https://github.com/LukeMathWalker/cargo-chef -- Rust Docker build cache optimization tool.
5. **GraalVM Native Image** https://www.graalvm.org/latest/reference-manual/native-image/ -- Official documentation for GraalVM Native Image.
6. **uv - Python package manager** https://docs.astral.sh/uv/ -- A fast Python package manager written in Rust.

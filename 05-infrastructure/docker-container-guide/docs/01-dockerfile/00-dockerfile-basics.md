# Dockerfile Basics

> Understand the core Dockerfile instructions (FROM, RUN, COPY, CMD, ENTRYPOINT), the layer structure, and build context to build reproducible container images.

---

## What You Will Learn

1. Understand the **main Dockerfile instructions** and choose the right one for each purpose
2. Grasp the **layer structure and build cache** mechanism to perform efficient builds
3. **Optimize the build context** to achieve fast and secure image builds
4. Leverage **BuildKit extensions** to implement advanced builds such as secret management and cache mounts


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. What Is a Dockerfile?

A Dockerfile is a set of instructions for building a container image. Because it is managed as a text file, it supports version control, review, and automation. Using a Dockerfile follows the "Infrastructure as Code" principle and enables reproducible image builds.

### 1.1 A Basic Dockerfile

```dockerfile
# Specify the base image
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose the port (for documentation purposes)
EXPOSE 3000

# Command to run when the container starts
CMD ["node", "server.js"]
```

### 1.2 Building and Running

```bash
# Build the image
docker build -t my-app:v1.0.0 .

# -t: specify the tag name
# . : build context (current directory)

# Run using the built image
docker run -d -p 3000:3000 my-app:v1.0.0

# Pass build arguments at build time
docker build --build-arg NODE_ENV=production -t my-app:v1.0.0 .

# Explicitly specify the path to the Dockerfile
docker build -f docker/Dockerfile.production -t my-app:prod .

# Show detailed build progress (BuildKit)
DOCKER_BUILDKIT=1 docker build --progress=plain -t my-app:v1.0.0 .

# Full build without using the build cache
docker build --no-cache -t my-app:v1.0.0 .

# Build up to a specific stage (for multi-stage builds)
docker build --target builder -t my-app-builder .
```

### 1.3 Dockerfile Naming Conventions and Directory Structure

```
project/
├── Dockerfile              # Default Dockerfile
├── Dockerfile.dev          # For development
├── Dockerfile.test         # For testing
├── docker/
│   ├── Dockerfile.api      # For the API server
│   ├── Dockerfile.worker   # For workers
│   └── Dockerfile.nginx    # For the reverse proxy
├── .dockerignore           # Exclusion rules for the build context
├── docker-compose.yml      # Compose configuration
└── src/
    └── ...
```

---

## 2. Key Instructions

### 2.1 FROM - Base Image

```dockerfile
# Use an official image
FROM ubuntu:22.04

# Alpine-based (lightweight)
FROM node:20-alpine

# Distroless (minimal configuration)
FROM gcr.io/distroless/static-debian12

# scratch (empty base, for Go binaries, etc.)
FROM scratch

# Pin to a specific digest (full reproducibility)
FROM node:20-alpine@sha256:abc123def456...

# Name a build stage (for multi-stage builds)
FROM node:20-alpine AS builder

# Dynamically specify the base image with a build argument
ARG BASE_IMAGE=node:20-alpine
FROM ${BASE_IMAGE}
```

#### Base Image Selection Guide

```
+------------------------------------------------------+
|           Base Image Selection Criteria              |
|                                                      |
|  Choose based on your use case:                      |
|                                                      |
|  [Minimal / Static Binary]                           |
|  scratch       -> For Go, Rust static binaries only  |
|                   No shell, no package manager       |
|                                                      |
|  [Minimal / Runtime Required]                        |
|  distroless    -> Node.js, Java, Python runtimes     |
|                   No shell (debug tag has one)       |
|                                                      |
|  [Lightweight / General Purpose]                     |
|  alpine        -> 7MB. apk package manager           |
|                   musl libc (watch for glibc deps)   |
|                                                      |
|  [Standard / Compatibility Focused]                  |
|  debian-slim   -> 74MB. apt package manager          |
|                   glibc. Fewer compatibility issues  |
|                                                      |
|  [Full / Development Oriented]                       |
|  ubuntu/debian -> 77MB+. Rich dev tooling            |
|                   Overkill for production            |
+------------------------------------------------------+
```

### 2.2 RUN - Execute Commands

```dockerfile
# Shell form (executed via /bin/sh -c)
RUN apt-get update && apt-get install -y curl

# Exec form (does not go through a shell)
RUN ["apt-get", "update"]

# Combine multiple commands into one RUN (reduces layers)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
        git && \
    rm -rf /var/lib/apt/lists/*

# For Alpine
RUN apk add --no-cache curl git

# BuildKit: cache mount (reuse package cache across builds)
RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/var/lib/apt \
    apt-get update && apt-get install -y --no-install-recommends curl

# BuildKit: secret mount (credentials do not remain in layers)
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci

# BuildKit: bind mount (temporary file reference)
RUN --mount=type=bind,source=scripts/setup.sh,target=/tmp/setup.sh \
    bash /tmp/setup.sh

# heredoc syntax (BuildKit, Docker 1.5+)
RUN <<EOF
apt-get update
apt-get install -y curl git
rm -rf /var/lib/apt/lists/*
EOF
```

#### Best Practices for Package Installation

```dockerfile
# For Debian / Ubuntu
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        # Network tools
        curl \
        wget \
        ca-certificates \
        # Build tools (only if needed)
        gcc \
        make \
        # Runtime dependencies
        libpq5 && \
    # Clear cache (reduce layer size)
    rm -rf /var/lib/apt/lists/* && \
    # Clear APT cache
    apt-get clean

# For Alpine
RUN apk add --no-cache \
        curl \
        wget \
        ca-certificates \
        # Group build dependencies with --virtual
    && apk add --no-cache --virtual .build-deps \
        gcc \
        musl-dev \
        python3-dev \
    # Remove them all after the build
    && pip install --no-cache-dir -r requirements.txt \
    && apk del .build-deps
```

### 2.3 COPY and ADD

```dockerfile
# Basic file copy (recommended)
COPY package.json /app/
COPY src/ /app/src/

# Wildcard
COPY *.json /app/

# Specify the owner with --chown
COPY --chown=node:node . /app/

# Specify permissions with --chmod (BuildKit)
COPY --chmod=755 entrypoint.sh /usr/local/bin/

# Isolate layers with --link (speeds up parallel builds, BuildKit)
COPY --link package.json /app/

# ADD - Download from URL (not recommended; use curl + RUN instead)
ADD https://example.com/file.tar.gz /tmp/

# ADD - Automatic tar extraction
ADD archive.tar.gz /app/
# -> Extracted into /app/

# In general, use COPY; only use ADD when tar extraction is needed
```

#### Decision Flow for COPY vs ADD

```
+------------------------------------------------------+
|          COPY / ADD Usage Guide                      |
|                                                      |
|  Copying a file?                                     |
|  └── Yes → Use COPY                                  |
|                                                      |
|  Need automatic tar archive extraction?              |
|  └── Yes → Use ADD                                   |
|                                                      |
|  Downloading a file from a URL?                      |
|  └── Yes → Use RUN curl/wget + COPY                  |
|        (ADD's URL feature is not recommended)        |
|                                                      |
|  Reason: COPY is predictable and explicit.           |
|          ADD has implicit behaviors like tar         |
|          extraction that can lead to unintended      |
|          results.                                    |
+------------------------------------------------------+
```

### 2.4 WORKDIR - Working Directory

```dockerfile
# Set the working directory
WORKDIR /app

# Created automatically if it does not exist
WORKDIR /app/src/components

# Relative paths are also supported (relative to the previous WORKDIR)
WORKDIR /app
WORKDIR src     # -> /app/src
WORKDIR tests   # -> /app/src/tests

# Use an environment variable
ENV APP_HOME=/opt/myapp
WORKDIR $APP_HOME
```

### 2.5 CMD and ENTRYPOINT

```
+------------------------------------------------------+
|          Relationship Between CMD and ENTRYPOINT     |
|                                                      |
|  ENTRYPOINT = The command to execute (fixed part)    |
|  CMD        = Default arguments (can be overridden)  |
|                                                      |
|  Example: ENTRYPOINT ["python"] + CMD ["app.py"]     |
|                                                      |
|  docker run my-app                                   |
|  -> python app.py                                    |
|                                                      |
|  docker run my-app test.py                           |
|  -> python test.py  (CMD is overridden)              |
|                                                      |
|  docker run --entrypoint sh my-app                   |
|  -> sh  (ENTRYPOINT is overridden)                   |
+------------------------------------------------------+
```

```dockerfile
# CMD only (most common)
CMD ["node", "server.js"]

# docker run my-app           -> node server.js
# docker run my-app bash      -> bash (CMD is overridden)

# ENTRYPOINT + CMD (recommended pattern)
ENTRYPOINT ["python"]
CMD ["app.py"]

# docker run my-app           -> python app.py
# docker run my-app test.py   -> python test.py

# ENTRYPOINT only (argument required)
ENTRYPOINT ["curl"]

# docker run my-app https://example.com -> curl https://example.com

# Shell form (not recommended - signals are not properly forwarded)
CMD node server.js
# -> Executed as /bin/sh -c "node server.js"
```

#### ENTRYPOINT Script Pattern

```dockerfile
# Pattern using an entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["server"]
```

```bash
#!/bin/sh
# docker-entrypoint.sh
set -e

# Initialization
echo "Starting application..."
echo "Environment: ${APP_ENV:-development}"

# Database migration (if needed)
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "Running database migrations..."
    python manage.py migrate
fi

# Branch based on arguments
case "$1" in
    server)
        echo "Starting web server..."
        exec gunicorn --bind 0.0.0.0:8000 app:app
        ;;
    worker)
        echo "Starting background worker..."
        exec celery -A tasks worker
        ;;
    shell)
        exec /bin/sh
        ;;
    *)
        # Execute arguments as-is
        exec "$@"
        ;;
esac
```

```bash
# Usage examples
docker run my-app                    # -> Start gunicorn (default: server)
docker run my-app worker             # -> Start celery worker
docker run my-app shell              # -> Start shell
docker run my-app python script.py   # -> Run python script.py
```

### 2.6 ENV - Environment Variables

```dockerfile
# ENV - Environment variables (available at build time + runtime)
ENV NODE_ENV=production
ENV APP_PORT=3000

# Multiple environment variables on one line (legacy syntax)
ENV NODE_ENV=production APP_PORT=3000

# Reference an environment variable in later instructions
ENV APP_HOME=/app
WORKDIR $APP_HOME
COPY . $APP_HOME

# Override an environment variable (at docker run time)
# docker run -e NODE_ENV=development my-app
```

### 2.7 ARG - Build-Time Variables

```dockerfile
# ARG - Build-time variables (not available at runtime)
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine

# Must be re-declared after FROM (scope resets at FROM)
ARG BUILD_DATE
ARG VCS_REF

LABEL build-date=${BUILD_DATE}
LABEL vcs-ref=${VCS_REF}

# docker build \
#   --build-arg BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
#   --build-arg VCS_REF=$(git rev-parse --short HEAD) \
#   .

# ARG default value and override
ARG APP_ENV=production
RUN echo "Building for ${APP_ENV}"
# docker build --build-arg APP_ENV=staging .
```

#### Differences Between ENV and ARG

```
+------------------------------------------------------+
|          ENV vs ARG Comparison                       |
|                                                      |
|  ARG:                                                |
|  - Available at build time only                      |
|  - Can be overridden with docker build --build-arg   |
|  - Can be declared before FROM (usable in FROM)      |
|  - Must be re-declared after FROM                    |
|  - Does not remain in the final image metadata       |
|                                                      |
|  ENV:                                                |
|  - Available at build time + runtime                 |
|  - Can be overridden with docker run -e              |
|  - Included in the final image metadata              |
|  - Visible via docker inspect                        |
|                                                      |
|  Security note:                                      |
|  - ARG values may be visible in docker history       |
|  - For passwords and secrets, use                    |
|    --mount=type=secret instead of ARG/ENV            |
+------------------------------------------------------+
```

### 2.8 EXPOSE - Port Declaration

```dockerfile
# EXPOSE - Documents the port (actual port publishing is done with -p)
EXPOSE 3000
EXPOSE 8080/tcp
EXPOSE 53/udp

# Expose multiple ports
EXPOSE 80 443
```

### 2.9 LABEL - Metadata

```dockerfile
# LABEL - Metadata
LABEL maintainer="team@example.com"
LABEL version="1.0.0"
LABEL description="My application"

# OCI Image Spec compliant labels
LABEL org.opencontainers.image.title="My App"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.authors="team@example.com"
LABEL org.opencontainers.image.source="https://github.com/org/repo"
LABEL org.opencontainers.image.licenses="MIT"

# Multiple labels in a single LABEL instruction
LABEL \
    org.opencontainers.image.title="My App" \
    org.opencontainers.image.version="1.0.0" \
    org.opencontainers.image.authors="team@example.com"
```

### 2.10 USER - Switch the Running User

```dockerfile
# Create a non-root user (Alpine)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create a non-root user (Debian/Ubuntu)
RUN groupadd -r appgroup && useradd --no-log-init -r -g appgroup appuser

# Switch the user
USER appuser

# Specify by UID/GID
USER 1001:1001

# For the node image (the node user is pre-defined)
USER node
```

### 2.11 HEALTHCHECK - Health Check

```dockerfile
# Health check using an HTTP endpoint
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
    CMD curl -f http://localhost:3000/health || exit 1

# Using wget (for Alpine when curl is not available)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Custom health check script
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \
    CMD /usr/local/bin/healthcheck.sh || exit 1

# Disable health check (when configured in the base image)
HEALTHCHECK NONE
```

```
+------------------------------------------------------+
|          HEALTHCHECK Parameters                      |
|                                                      |
|  --interval=30s   : Check interval (default: 30s)   |
|  --timeout=5s     : Timeout (default: 30s)          |
|  --retries=3      : Failures before unhealthy (def 3)|
|  --start-period=0 : Init grace period (default: 0s) |
|                                                      |
|  Return values:                                      |
|  0 = healthy                                         |
|  1 = unhealthy                                       |
|                                                      |
|  Shown in docker ps:                                 |
|  STATUS: Up 5 minutes (healthy)                      |
|  STATUS: Up 5 minutes (unhealthy)                    |
+------------------------------------------------------+
```

### 2.12 VOLUME - Volume Mount Points

```dockerfile
# VOLUME - Volume mount points
VOLUME ["/data", "/logs"]

# Single volume
VOLUME /var/lib/postgresql/data

# Note: Files written to paths declared with VOLUME in subsequent
# Dockerfile instructions may not be reflected in the final image
```

### 2.13 SHELL - Change the Default Shell

```dockerfile
# SHELL - Change the default shell
SHELL ["/bin/bash", "-c"]

# PowerShell (Windows containers)
SHELL ["powershell", "-Command"]
RUN Get-ChildItem

# When using bash-specific features
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN curl -fsSL https://example.com/script.sh | bash
```

### 2.14 STOPSIGNAL - Stop Signal

```dockerfile
# Default is SIGTERM
STOPSIGNAL SIGTERM

# Use SIGQUIT (for nginx graceful shutdown)
STOPSIGNAL SIGQUIT

# Can also be specified as a number
STOPSIGNAL 9  # SIGKILL
```

---

## 3. Layer Structure

### 3.1 Layer Generation

```
+------------------------------------------------------+
|              Dockerfile -> Layers                    |
|                                                      |
|  FROM node:20-alpine     -> Base image layer         |
|  WORKDIR /app            -> Metadata only (no layer) |
|  COPY package.json .     -> New layer (Layer A)      |
|  RUN npm ci              -> New layer (Layer B)      |
|  COPY . .                -> New layer (Layer C)      |
|  EXPOSE 3000             -> Metadata only (no layer) |
|  CMD ["node","server.js"]-> Metadata only (no layer) |
|                                                      |
|  Layer-creating instructions: FROM, RUN, COPY, ADD   |
|  Metadata-only instructions: WORKDIR, EXPOSE, ENV,   |
|                              CMD, ENTRYPOINT, LABEL  |
+------------------------------------------------------+
```

### 3.2 Build Cache

```
+------------------------------------------------------+
|              How the Build Cache Works               |
|                                                      |
|  First build:                                        |
|  FROM node:20-alpine    [executed] ----+             |
|  COPY package.json .    [executed] ----|-- cache saved|
|  RUN npm ci             [executed] ----+             |
|  COPY . .               [executed] ----+             |
|                                                      |
|  Second build (only source code changed):            |
|  FROM node:20-alpine    [cache hit]                  |
|  COPY package.json .    [cache hit] <- no change     |
|  RUN npm ci             [cache hit] <- no change     |
|  COPY . .               [re-executed] <- rebuild here|
|                                                      |
|  Important: When a cache is invalidated, all         |
|  subsequent layers are rebuilt (cache busting).      |
+------------------------------------------------------+
```

#### Conditions That Invalidate the Cache

```
+------------------------------------------------------+
|          Conditions That Invalidate the Cache        |
|                                                      |
|  1. FROM: The base image has changed                 |
|                                                      |
|  2. RUN: The command string has changed              |
|     - "RUN apt-get install -y curl"                  |
|       -> If the curl version changes but the         |
|          command string is the same, cache is valid  |
|     -> Use --no-cache to force cache invalidation    |
|                                                      |
|  3. COPY/ADD: File contents (checksum) have changed  |
|     - Determined by the hash of the file contents   |
|     - Timestamps and permissions are ignored         |
|                                                      |
|  4. ARG: A build argument value has changed          |
|     - Invalidates cache for instructions using ARG  |
|                                                      |
|  5. Parent layer: If a parent layer's cache is       |
|     invalidated, all subsequent layers' caches are   |
|     also invalidated                                 |
+------------------------------------------------------+
```

```bash
# Build using cache (default)
docker build -t my-app .

# Full rebuild ignoring cache
docker build --no-cache -t my-app .

# Build up to a specific stage
docker build --target builder -t my-app-builder .

# Show detailed cache information with BuildKit
DOCKER_BUILDKIT=1 docker build --progress=plain -t my-app .

# Use an external cache source
docker build --cache-from my-app:latest -t my-app:v2.0.0 .

# BuildKit inline cache (embed cache info into the registry)
docker build --build-arg BUILDKIT_INLINE_CACHE=1 -t my-app:latest .
docker push my-app:latest
# Use as cache in the next build
docker build --cache-from my-app:latest -t my-app:v2.0.0 .
```

---

## 4. Build Context

### 4.1 What Is the Build Context?

```
+------------------------------------------------------+
|              Build Context                           |
|                                                      |
|  docker build -t my-app .                            |
|                          ^                           |
|                          |                           |
|                    Build context                     |
|                    (current directory in this case)  |
|                                                      |
|  project/                                            |
|  +-- src/                                            |
|  |   +-- app.js          <- usable with COPY         |
|  +-- package.json        <- usable with COPY         |
|  +-- Dockerfile                                      |
|  +-- .dockerignore       <- exclusion rules          |
|  +-- node_modules/       <- should be excluded       |
|  +-- .git/               <- should be excluded       |
|  +-- .env                <- should be excluded       |
|                                                      |
|  The entire build context is sent to the Docker      |
|  daemon -> exclude unnecessary files with            |
|  .dockerignore                                       |
+------------------------------------------------------+
```

### 4.2 .dockerignore

```bash
# Example .dockerignore file

# Version control
.git
.gitignore
.gitattributes

# Dependencies (reinstalled inside the container)
node_modules
vendor
__pycache__
*.pyc

# Build artifacts
dist
build
coverage
.next

# Environment config / sensitive information
.env
.env.*
*.pem
*.key
credentials.json

# Docker-related (avoid double copying)
Dockerfile
Dockerfile.*
docker-compose*.yml
.dockerignore

# IDE / Editor
.vscode
.idea
*.swp
*.swo
*~

# Documentation
README.md
LICENSE
CHANGELOG.md
docs/

# Tests
tests/
test/
__tests__
*.test.js
*.spec.js
.nyc_output
jest.config.js

# CI/CD
.github
.gitlab-ci.yml
.circleci
Makefile

# OS-generated files
.DS_Store
Thumbs.db
```

```bash
# Check the size of the build context
docker build -t my-app . 2>&1 | grep "Sending build context"
# Sending build context to Docker daemon  2.048kB  <- smaller is better

# Without .dockerignore
# Sending build context to Docker daemon  500MB  <- includes node_modules, etc.

# Test .dockerignore (verify what is being sent)
# With BuildKit, unnecessary files are not sent in the first place
```

### 4.3 Remote Build Context

```bash
# Build directly from a Git repository
docker build https://github.com/user/repo.git#main

# Specify a particular directory
docker build https://github.com/user/repo.git#main:docker

# Build from a tar archive
docker build - < archive.tar.gz

# Build from a Dockerfile on stdin (no context)
echo "FROM alpine" | docker build -t test -

# Dockerfile on stdin + local context
docker build -f - . <<EOF
FROM alpine
COPY . /app
EOF
```

---

## 5. Practical Examples

### 5.1 Express.js Application

```dockerfile
FROM node:20-alpine

# Security: non-root user
RUN addgroup -S app && adduser -S app -G app

# tini (resolves the PID 1 problem)
RUN apk add --no-cache tini

WORKDIR /app

# Copy dependencies first (improves cache efficiency)
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY --chown=app:app . .

USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

ENTRYPOINT ["tini", "--"]
CMD ["node", "server.js"]
```

### 5.2 Python Flask Application

```dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# System dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY . .

# Non-root user
RUN useradd --create-home appuser
USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "app:app"]
```

### 5.3 Go Application

```dockerfile
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache ca-certificates tzdata
RUN adduser -D -g '' appuser

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /server ./cmd/server

# Minimal runtime environment
FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /server /server
USER appuser
EXPOSE 8080
ENTRYPOINT ["/server"]
```

### 5.4 Static Website (nginx)

```dockerfile
FROM nginx:alpine

# Custom configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static files
COPY dist/ /usr/share/nginx/html/

# Additional configuration for security headers
COPY security-headers.conf /etc/nginx/conf.d/security-headers.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1
```

### 5.5 Entrypoint Script for Multiple Commands

```dockerfile
FROM postgres:16-alpine

# Copy initialization scripts
COPY init-scripts/ /docker-entrypoint-initdb.d/

# Custom entrypoint
COPY entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["entrypoint.sh"]
CMD ["postgres"]
```

```bash
#!/bin/sh
# entrypoint.sh
set -e

# Pre-processing based on environment
echo "Starting with environment: $APP_ENV"

# Delegate to the original entrypoint
exec docker-entrypoint.sh "$@"
```

### 5.6 Ruby on Rails Application

```dockerfile
FROM ruby:3.3-slim

ENV RAILS_ENV=production \
    RAILS_LOG_TO_STDOUT=true \
    BUNDLE_WITHOUT=development:test

WORKDIR /app

# System dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        nodejs \
        yarn && \
    rm -rf /var/lib/apt/lists/*

# Gem dependencies
COPY Gemfile Gemfile.lock ./
RUN bundle install --jobs 4 --retry 3

# Asset precompilation
COPY . .
RUN bundle exec rails assets:precompile

# Non-root user
RUN useradd --create-home --shell /bin/bash rails
USER rails

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
```

### 5.7 Rust Application

```dockerfile
FROM rust:1.75-alpine AS builder

RUN apk add --no-cache musl-dev

WORKDIR /app
COPY Cargo.toml Cargo.lock ./

# Build only dependencies with a dummy main.rs (for caching)
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

# Build with the actual source code
COPY src ./src
RUN touch src/main.rs && cargo build --release

FROM scratch
COPY --from=builder /app/target/release/myapp /myapp
EXPOSE 8080
ENTRYPOINT ["/myapp"]
```

---

## 6. Advanced BuildKit Features

### 6.1 The syntax Directive

```dockerfile
# syntax=docker/dockerfile:1
# Use the latest Dockerfile parser

FROM node:20-alpine
WORKDIR /app
COPY . .
CMD ["node", "server.js"]
```

### 6.2 heredoc Syntax

```dockerfile
# syntax=docker/dockerfile:1

# Write multi-line scripts in a readable way
RUN <<EOF
apt-get update
apt-get install -y --no-install-recommends \
    curl \
    git \
    ca-certificates
rm -rf /var/lib/apt/lists/*
EOF

# Generate a file
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    location / {
        proxy_pass http://app:3000;
    }
}
EOF

# Generate multiple files at once
COPY <<nginx.conf /etc/nginx/nginx.conf
user nginx;
worker_processes auto;
nginx.conf

COPY <<app.conf /etc/nginx/conf.d/app.conf
server {
    listen 80;
    root /usr/share/nginx/html;
}
app.conf
```

### 6.3 Mount Options

```dockerfile
# Cache mount (reuse cache across builds)
RUN --mount=type=cache,target=/root/.npm \
    npm ci

RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -o /app .

# Secret mount (does not remain in the image)
RUN --mount=type=secret,id=aws_credentials,target=/root/.aws/credentials \
    aws s3 cp s3://bucket/file /app/

# SSH mount (access private repositories using SSH keys)
RUN --mount=type=ssh \
    git clone git@github.com:private/repo.git

# Bind mount (reference files outside the build context)
RUN --mount=type=bind,from=builder,source=/app/dist,target=/dist \
    cp -r /dist /usr/share/nginx/html/
```

---

## 7. Comparison Tables

### Table 1: CMD vs ENTRYPOINT

| Item | CMD | ENTRYPOINT |
|---|---|---|
| Purpose | Default command/arguments | Fixed main command |
| Override with docker run | Can be overridden with command arguments | Only overridden with `--entrypoint` |
| Format | exec form `["cmd","arg"]` / shell form `cmd arg` | exec form recommended |
| Combined use | Acts as default arguments for ENTRYPOINT | Can be combined with CMD |
| Typical use case | Application startup command | CLI tools, wrapper scripts |
| Example | `CMD ["npm", "start"]` | `ENTRYPOINT ["python"]` |

### Table 2: COPY vs ADD

| Item | COPY | ADD |
|---|---|---|
| Copy local files | Yes | Yes |
| Download from URL | No | Yes (not recommended) |
| Automatic tar extraction | No | Yes |
| Predictability | High (simple copy) | Low (implicit behaviors like auto-extraction) |
| Recommendation | Use this by default | Only when tar extraction is needed |
| --chown | Supported | Supported |
| --chmod (BuildKit) | Supported | Supported |
| --link (BuildKit) | Supported | Supported |

### Table 3: All Instructions Reference

| Instruction | Layer | Purpose | Scope |
|---|---|---|---|
| FROM | Created | Specify base image | Stage separator |
| RUN | Created | Execute commands | Build time |
| COPY | Created | Copy files | Build time |
| ADD | Created | Copy files + extract | Build time |
| CMD | None | Default command | Runtime |
| ENTRYPOINT | None | Entry point | Runtime |
| ENV | None | Environment variables | Build time + runtime |
| ARG | None | Build arguments | Build time only |
| EXPOSE | None | Port declaration | Documentation |
| WORKDIR | None | Working directory | Build time + runtime |
| USER | None | Running user | Build time + runtime |
| VOLUME | None | Volume mount point | Runtime |
| LABEL | None | Metadata | Image metadata |
| HEALTHCHECK | None | Health check | Runtime |
| SHELL | None | Default shell | Build time |
| STOPSIGNAL | None | Stop signal | Runtime |
| ONBUILD | None | Trigger for derived images | Derived build time |

---

## 8. Anti-Patterns

### Anti-Pattern 1: Layer Order That Ignores Change Frequency

```dockerfile
# BAD: Copy source code first
FROM node:20-alpine
WORKDIR /app
COPY . .                        # <- Source change triggers full rebuild
RUN npm ci --only=production    # <- npm install runs every time
CMD ["node", "server.js"]

# GOOD: Copy less frequently changed files first
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./  # <- Changes infrequently
RUN npm ci --only=production            # <- Cache is effective
COPY . .                                # <- Only this layer rebuilds on source change
CMD ["node", "server.js"]
```

### Anti-Pattern 2: Too Many Separate RUN Instructions

```dockerfile
# BAD: Each command in its own RUN
FROM ubuntu:22.04
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get install -y git
RUN apt-get install -y vim
RUN rm -rf /var/lib/apt/lists/*
# -> 5 layers are created
# -> apt-get update cache may become stale

# GOOD: Combine into one RUN
FROM ubuntu:22.04
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        git \
        vim && \
    rm -rf /var/lib/apt/lists/*
# -> Done in a single layer
# -> update and install run in the same layer
```

### Anti-Pattern 3: Running the Application as Root

```dockerfile
# BAD: Running as root
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci
CMD ["node", "server.js"]
# -> Runs with root privileges inside the container (security risk)

# GOOD: Create and switch to a non-root user
FROM node:20-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --chown=app:app . .
RUN npm ci
USER app
CMD ["node", "server.js"]
```

### Anti-Pattern 4: Not Using .dockerignore

```dockerfile
# BAD: Without .dockerignore
FROM node:20-alpine
WORKDIR /app
COPY . .    # <- Includes node_modules, .git, .env, tests, etc.
            # -> Build context becomes huge
            # -> Sensitive information is included in the image

# GOOD: Exclude unnecessary files with .dockerignore
# .dockerignore:
# node_modules
# .git
# .env
# tests/
# coverage/
```

### Anti-Pattern 5: Setting Secrets via ENV

```dockerfile
# BAD: Putting a password directly in an environment variable
FROM node:20-alpine
ENV DATABASE_PASSWORD=supersecret123
# -> Visible via docker inspect
# -> Remains in all layers of the image

# GOOD: Pass the environment variable at runtime
FROM node:20-alpine
# docker run -e DATABASE_PASSWORD=supersecret123 my-app
# or manage with env_file in docker-compose.yml
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
    """Exercise on basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate the input value"""
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

### Exercise 2: Applied Pattern

Extend the basic implementation by adding the following features.

```python
# Exercise 2: Applied pattern
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise on applied patterns"""

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
- Be mindful of algorithmic complexity
- Choose the appropriate data structure
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured configuration file | Check the path and format of the configuration file |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check the running user's permissions, review settings |
| Data inconsistency | Concurrent processing conflict | Introduce a locking mechanism, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace and identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Formulate a hypothesis**: List possible causes
4. **Gradual verification**: Use log output or a debugger to verify the hypothesis
5. **Fix and regression test**: After fixing, run tests for related areas as well

```python
# Debug utility
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

Steps for diagnosing performance issues:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Check for memory leaks
3. **Check for I/O waits**: Check the status of disk and network I/O
4. **Check concurrent connections**: Check the connection pool status

| Problem Type | Diagnostic Tool | Solution |
|-----------|-----------|------|
| High CPU | cProfile, py-spy | Algorithm improvements, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Asynchronous I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexing, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

Here is a summary of the criteria for making technology choices.

| Criterion | Prioritize when | Can compromise when |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, speed to market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│              Architecture Selection Flow         │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① What is the team size?                        │
│    ├─ Small (1-5) → Monolith                     │
│    └─ Large (10+) → Go to ②                      │
│                                                 │
│  ② What is the deployment frequency?            │
│    ├─ Weekly or less → Monolith + modular split  │
│    └─ Daily/multiple times → Go to ③            │
│                                                 │
│  ③ How independent are the teams?               │
│    ├─ High → Microservices                       │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- A quick short-term solution can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can cause project delays

**2. Consistency vs Flexibility**
- A unified technology stack has a lower learning curve
- Adopting diverse technologies allows for the right tool for the job, but increases operational costs

**3. Level of Abstraction**
- High abstraction leads to better reusability, but can make debugging more difficult
- Low abstraction is more intuitive, but code duplication tends to occur

```python
# Design decision record template
class ArchitectureDecisionRecord:
    """Create an ADR (Architecture Decision Record)"""

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

## 9. FAQ

### Q1: Should I use exec form or shell form?

**A:** For CMD and ENTRYPOINT, **exec form** `["cmd", "arg"]` is recommended. Shell form `cmd arg` is executed via `/bin/sh -c`, so signals like SIGTERM are not delivered directly to the application, which can cause graceful shutdown to fail. Shell form is fine for RUN instructions (since they only run at build time). However, if you use shell features like pipes, you should use the `SHELL` instruction in combination with the `pipefail` option.

### Q2: Is EXPOSE required?

**A:** EXPOSE is for documentation purposes only; actual port publishing is done with `docker run -p`. Port mapping with `-p` is possible even without EXPOSE, but writing EXPOSE makes it explicit which ports the container uses, and tools like Docker Compose and Kubernetes use it as metadata. It is recommended to include it.

### Q3: Can I use `RUN cd /app` instead of WORKDIR?

**A:** You should not. `RUN cd /app` is executed in a new shell, so the next RUN instruction will return to the original directory. `WORKDIR /app` works as metadata that affects all subsequent instructions (RUN, CMD, ENTRYPOINT, COPY, ADD), and automatically creates the directory if it does not exist.

### Q4: How do I enable BuildKit?

**A:** BuildKit is enabled by default in Docker Desktop. For Docker Engine on Linux, set the environment variable `DOCKER_BUILDKIT=1`, or add `{"features": {"buildkit": true}}` to `/etc/docker/daemon.json`. Docker Engine 23.0 and later use BuildKit by default. You can tell whether BuildKit is enabled by the output format of `docker build` (BuildKit shows stage names instead of step numbers).

### Q5: Is there a size limit for a Dockerfile?

**A:** There is no strict limit on the size of a Dockerfile itself, but there is a limit of 127 layers (for OverlayFS). Using a large number of RUN / COPY instructions in a single Dockerfile can reach this limit. In multi-stage builds, the layers of each stage are counted independently, so only the final stage's layer count matters.

### Q6: How do I debug a slow build?

**A:** Identify the cause using the following methods:
1. Use `--progress=plain` to display detailed build logs and identify which step is slow
2. Check the build cache status with `docker system df`
3. Check the size of the build context and optimize `.dockerignore`
4. Review layer order and place frequently changed items later
5. Reuse package manager caches with BuildKit's `--mount=type=cache`
6. Use multi-stage builds to exclude unnecessary build tools from the final image

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently used in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 10. Summary

| Item | Key Points |
|---|---|
| FROM | Base image. Use Alpine or Distroless for a smaller footprint |
| RUN | Combine instructions into one RUN. Don't forget to clean up the cache |
| COPY | Use COPY for file copying. Use ADD only for tar extraction |
| CMD / ENTRYPOINT | Use exec form. Combine them according to the use case |
| ENV / ARG | ENV is valid at runtime too; ARG is build-time only. Do not use for secrets |
| Layers | Place less frequently changed items first (improves cache efficiency) |
| Build context | Exclude unnecessary files with .dockerignore |
| Security | Run as a non-root user. Use --mount=type=secret for secrets |
| HEALTHCHECK | Regularly verify the health of the application |
| BuildKit | Leverage extensions like cache mounts, secret mounts, and heredocs |

---

## What to Read Next

- [01-multi-stage-build.md](./01-multi-stage-build.md) -- Reducing image size with multi-stage builds
- [02-optimization.md](./02-optimization.md) -- Dockerfile optimization and best practices
- [03-language-specific.md](./03-language-specific.md) -- Language-specific Dockerfile templates

---

## References

1. **Docker Documentation - Dockerfile reference** https://docs.docker.com/reference/dockerfile/ -- Official reference for all Dockerfile instructions.
2. **Docker Documentation - Best practices for Dockerfile** https://docs.docker.com/develop/develop-images/dockerfile_best-practices/ -- Docker's official best practices guide.
3. **BuildKit - Advanced Dockerfile features** https://github.com/moby/buildkit/blob/master/frontend/dockerfile/docs/reference.md -- Reference for BuildKit-specific extensions (--mount, --security, etc.).
4. **Dockerfile heredocs** https://www.docker.com/blog/introduction-to-heredocs-in-dockerfiles/ -- Introduction to heredoc syntax in Dockerfiles.
5. **Docker BuildKit** https://docs.docker.com/build/buildkit/ -- Official BuildKit documentation. Parallel builds, cache control, and secret management.

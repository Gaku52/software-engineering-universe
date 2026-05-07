# Production Best Practices

> Systematically learn the four pillars essential for Docker production environments: running containers as non-root users, health checks, resource limits, and logging strategy.

---

## What You Will Learn

1. Understand **running containers as non-root users** and techniques for security hardening
2. Master **health checks and resource limits** for robust operational design
3. Learn to build an efficient logging strategy using **structured logs and log drivers**
4. Acquire correct implementation patterns for **Graceful Shutdown** and signal handling
5. Practice security and performance optimization for **production Dockerfiles** and **docker-compose configurations**


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Running as Non-Root User

The default container runs as root. This means that if a container escape vulnerability is exploited, there is a risk of gaining root privileges on the host.

### Code Example 1: Configuring a Non-Root User

```dockerfile
# Dockerfile - Node.js Application
FROM node:20-alpine

# Create application directory
WORKDIR /app

# Install dependencies (run as root)
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY --chown=node:node . .

# Switch to non-root user
USER node

EXPOSE 3000
CMD ["node", "server.js"]
```

```dockerfile
# Dockerfile - Python Application (user creation pattern)
FROM python:3.12-slim

RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --shell /bin/false --create-home appuser

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=appuser:appgroup . .

USER appuser

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "app:create_app()"]
```

```dockerfile
# Dockerfile - Go Application (scratch-based)
FROM golang:1.22-alpine AS builder

WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/server ./cmd/server

# Production stage: minimal configuration based on scratch
FROM scratch

# Configure non-root user (copy /etc/passwd)
COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /etc/group /etc/group

# Copy TLS certificates (for external HTTPS access)
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy binary
COPY --from=builder --chown=1001:1001 /app/server /server

USER 1001

EXPOSE 8080
ENTRYPOINT ["/server"]
```

```dockerfile
# Dockerfile - Java Application (Spring Boot)
FROM eclipse-temurin:21-jre-alpine

RUN addgroup -g 1001 -S spring && \
    adduser -u 1001 -S spring -G spring -s /bin/false

WORKDIR /app

COPY --chown=spring:spring target/*.jar app.jar

# JVM security settings
ENV JAVA_OPTS="-XX:+UseContainerSupport \
    -XX:MaxRAMPercentage=75.0 \
    -Djava.security.egd=file:/dev/./urandom"

USER spring

EXPOSE 8080
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
```

### Dangers of the Root User

```
┌─────────────────────────────────────────────────┐
│  Container (root)                               │
│  UID=0                                          │
│                                                 │
│  Container escape vulnerability                 │
│       │                                         │
│       ▼                                         │
│  ┌─────────────────────────────────────┐       │
│  │  Host (root)                        │       │
│  │  UID=0 → Full control of host       │       │
│  └─────────────────────────────────────┘       │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Container (non-root)                           │
│  UID=1001                                       │
│                                                 │
│  Container escape vulnerability                 │
│       │                                         │
│       ▼                                         │
│  ┌─────────────────────────────────────┐       │
│  │  Host (UID=1001)                    │       │
│  │  No privileges → Damage minimized  │       │
│  └─────────────────────────────────────┘       │
└─────────────────────────────────────────────────┘
```

### User Namespace Remapping

As an additional defense at the Docker host level, you can configure User Namespace Remapping. This maps root (UID=0) inside the container to an unprivileged UID on the host.

```json
// /etc/docker/daemon.json
{
  "userns-remap": "default"
}
```

```bash
# Verifying User Namespace Remapping
# Even when running as root inside the container,
# it is mapped to a different UID on the host
docker run --rm alpine id
# uid=0(root) gid=0(root) ← root inside the container

# Checking the actual UID on the host
ps aux | grep "container process"
# Running as 165536 (unprivileged UID)
```

### Rootless Docker

Rootless mode, which runs the Docker daemon itself as non-root, is also an option worth considering for production environments.

```bash
# Installing Rootless Docker
curl -fsSL https://get.docker.com/rootless | sh

# Setting environment variables
export PATH=$HOME/bin:$PATH
export DOCKER_HOST=unix://$XDG_RUNTIME_DIR/docker.sock

# Verifying Rootless Docker operation
docker info | grep -i "root"
# rootless: true
```

---

## 2. Health Checks

### Code Example 2: Various Health Check Configurations

```dockerfile
# Health check definition in Dockerfile
FROM nginx:alpine

# Health check via HTTP endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1
```

```dockerfile
# Health check for PostgreSQL
FROM postgres:16-alpine

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD pg_isready -U postgres -d mydb || exit 1
```

```dockerfile
# Health check for Redis
FROM redis:7-alpine

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD redis-cli ping | grep -q PONG || exit 1
```

```dockerfile
# Health check for MongoDB
FROM mongo:7

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD mongosh --eval "db.adminCommand('ping').ok" --quiet || exit 1
```

```yaml
# Health check definition in docker-compose.yml
version: "3.9"

services:
  api:
    image: my-api:latest
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 30s
      start_interval: 5s  # Check interval during startup period (Compose v2.3+)

  postgres:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

  # Start after waiting for dependent services' health checks
  app:
    image: my-app:latest
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
```

### Health Check Parameter Comparison Table

| Parameter | Description | Recommended Value | Notes |
|-----------|-------------|-------------------|-------|
| interval | Check interval | 10-30s | Too short increases load |
| timeout | Timeout | 3-10s | Set shorter than interval |
| retries | Failure tolerance count | 3-5 | Allows for temporary failures |
| start_period | Startup grace period | 10-60s | Align with application startup time |
| start_interval | Check interval during startup | 3-5s | Quickly detect startup completion |

### Health Check Best Practices

```
Health check design decision flow:

1. Endpoint selection
   ├── Web app → HTTP GET /health
   ├── Database → Dedicated command (pg_isready, redis-cli ping)
   ├── Message queue → Connection verification
   └── Batch processing → Process existence check or file timestamp

2. Check depth
   ├── Shallow: Does the process respond?
   │   └── Fast, low load, basic liveness monitoring
   ├── Medium: Verify connection to dependent services
   │   └── DB connection pool, cache connection
   └── Deep: Full functional test
       └── High cost, use with care in production

3. Recommendation: /health for Shallow, /ready for Medium
```

### Application-Side Health Check Endpoint Implementation

```javascript
// Node.js/Express - Health check endpoint
const express = require("express");
const app = express();

// Shallow Health Check (for Liveness)
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Deep Health Check (for Readiness)
app.get("/ready", async (req, res) => {
  const checks = {};
  let isReady = true;

  // Database connection check
  try {
    await db.query("SELECT 1");
    checks.database = "ok";
  } catch (err) {
    checks.database = "error";
    isReady = false;
  }

  // Redis connection check
  try {
    await redis.ping();
    checks.redis = "ok";
  } catch (err) {
    checks.redis = "error";
    isReady = false;
  }

  // External API connection check
  try {
    await fetch("https://api.external.com/status", { timeout: 3000 });
    checks.externalApi = "ok";
  } catch (err) {
    checks.externalApi = "error";
    isReady = false;
  }

  const statusCode = isReady ? 200 : 503;
  res.status(statusCode).json({
    status: isReady ? "ready" : "not_ready",
    checks,
    timestamp: new Date().toISOString(),
  });
});
```

```python
# Python/FastAPI - Health check endpoint
from fastapi import FastAPI, Response
from datetime import datetime
import asyncpg
import aioredis

app = FastAPI()

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
    }

@app.get("/ready")
async def readiness_check(response: Response):
    checks = {}
    is_ready = True

    # Database check
    try:
        conn = await asyncpg.connect(dsn=DATABASE_URL)
        await conn.fetchval("SELECT 1")
        await conn.close()
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "error"
        is_ready = False

    # Redis check
    try:
        redis = await aioredis.from_url(REDIS_URL)
        await redis.ping()
        await redis.close()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "error"
        is_ready = False

    if not is_ready:
        response.status_code = 503

    return {
        "status": "ready" if is_ready else "not_ready",
        "checks": checks,
        "timestamp": datetime.utcnow().isoformat(),
    }
```

---

## 3. Resource Limits

### Code Example 3: Memory and CPU Limits

```yaml
# docker-compose.yml
version: "3.9"

services:
  api:
    image: my-api:latest
    deploy:
      resources:
        limits:
          memory: 512M       # Hard limit (OOM Kill if exceeded)
          cpus: "1.0"        # 1 CPU core
        reservations:
          memory: 256M       # Minimum guaranteed memory
          cpus: "0.25"       # Minimum guaranteed CPU

  worker:
    image: my-worker:latest
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: "2.0"
        reservations:
          memory: 512M
          cpus: "0.5"
      # OOM priority (OOM score adjustment)
    oom_score_adj: 100  # Positive value → more likely to be OOM Killed

  database:
    image: postgres:16-alpine
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: "2.0"
        reservations:
          memory: 1G
          cpus: "1.0"
    oom_score_adj: -500  # Negative value → less likely to be OOM Killed
```

```bash
# Resource limits with docker run
docker run -d \
  --name api \
  --memory=512m \
  --memory-swap=512m \       # Disable swap (same value as memory)
  --memory-reservation=256m \
  --cpus=1.0 \
  --cpu-shares=512 \         # Relative CPU allocation (default 1024)
  --pids-limit=100 \         # Process count limit (fork bomb protection)
  --ulimit nofile=65535:65535 \  # File descriptor limit
  my-api:latest

# Real-time resource usage monitoring
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.PIDs}}"
```

### Resource Limit Behavior

```
┌──────────────────────────────────────────┐
│            Docker Host (8GB RAM)         │
│                                          │
│  ┌──────────────┐  ┌──────────────┐    │
│  │   API        │  │   Worker     │    │
│  │  limit: 512M │  │  limit: 1G   │    │
│  │  ┌────────┐  │  │  ┌────────┐  │    │
│  │  │Usage:  │  │  │  │Usage:  │  │    │
│  │  │ 300M   │  │  │  │ 800M   │  │    │
│  │  └────────┘  │  │  └────────┘  │    │
│  │              │  │              │    │
│  │  512M hit → │  │  1G hit →   │    │
│  │  OOM Kill!  │  │  OOM Kill!  │    │
│  └──────────────┘  └──────────────┘    │
│                                          │
│  reservations: minimum guarantee         │
│  limits: hard limit (OOM Kill if exceeded)│
└──────────────────────────────────────────┘
```

### Memory Configuration by Language Runtime

Some language runtimes require configuration to recognize the container's memory limits.

```bash
# Java - Automatically recognize container memory limits
# UseContainerSupport is enabled by default in JDK 8u191+ / JDK 11+
docker run -d \
  --memory=512m \
  -e JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0" \
  my-java-app:latest

# Node.js - Heap size limit
docker run -d \
  --memory=512m \
  -e NODE_OPTIONS="--max-old-space-size=384" \
  my-node-app:latest

# Python - Memory limits are OS-dependent (no special config needed, but monitoring is required)
docker run -d \
  --memory=512m \
  -e PYTHONDONTWRITEBYTECODE=1 \
  my-python-app:latest

# Go - Optimize GC with GOMEMLIMIT (Go 1.19+)
docker run -d \
  --memory=512m \
  -e GOMEMLIMIT=400MiB \
  my-go-app:latest
```

### Resource Sizing Guidelines

| Service Type | Memory Estimate | CPU Estimate | Notes |
|--------------|----------------|--------------|-------|
| Web frontend (nginx) | 64-128M | 0.1-0.5 | Static serving is lightweight |
| API server (Node.js) | 256-512M | 0.25-1.0 | Watch heap size |
| API server (Java) | 512M-2G | 0.5-2.0 | JVM heap size config required |
| Worker/Batch | 512M-4G | 1.0-4.0 | Highly dependent on workload |
| PostgreSQL | 1-4G | 1.0-4.0 | shared_buffers = 25% of memory |
| Redis | 256M-2G | 0.5-1.0 | maxmemory config required |
| Elasticsearch | 2-8G | 2.0-4.0 | Heap = 50% of memory |

---

## 4. Logging Strategy

### Code Example 4: Structured Log Design

```dockerfile
# Dockerfile - Logging best practices
FROM node:20-alpine

WORKDIR /app
COPY . .

# Application outputs to stdout/stderr
# Do not write to files
CMD ["node", "server.js"]

# Example log output in server.js:
# console.log(JSON.stringify({
#   timestamp: new Date().toISOString(),
#   level: "info",
#   message: "Request handled",
#   method: "GET",
#   path: "/api/users",
#   status: 200,
#   duration_ms: 45,
#   request_id: "abc-123"
# }));
```

```yaml
# docker-compose.yml - Log driver configuration
version: "3.9"

services:
  api:
    image: my-api:latest
    logging:
      driver: json-file    # Default driver
      options:
        max-size: "10m"    # Maximum log file size
        max-file: "5"      # Number of rotation files
        compress: "true"   # Enable compression
        tag: "{{.Name}}/{{.ID}}"  # Tagging

  # Forwarding to Fluentd
  worker:
    image: my-worker:latest
    logging:
      driver: fluentd
      options:
        fluentd-address: "localhost:24224"
        tag: "docker.{{.Name}}"
        fluentd-async: "true"     # Asynchronous send (risk of log loss)
        fluentd-retry-wait: "1s"
        fluentd-max-retries: "10"
```

### Log Output Best Practices Comparison Table

| Policy | Recommended | Not Recommended | Reason |
|--------|-------------|-----------------|--------|
| Output destination | stdout / stderr | Files | Handled by Docker log driver |
| Format | JSON structured | Plain text | Easy to parse and filter |
| Level management | Controlled via env vars | Hard-coded | Output only INFO and above in production |
| Rotation | Delegate to Docker driver | In-app logrotate | Unified management possible |
| Correlation ID | Include request_id / trace_id | No ID | Essential for distributed tracing |
| Sensitive info | Mask or exclude | Output as-is | Prevent password/token leakage |

### Log Driver Comparison

| Driver | Characteristics | Use Case | `docker logs` Support |
|--------|----------------|----------|----------------------|
| json-file | Default, saved as JSON | Small-scale, development | Supported |
| local | Optimized file format | Single-host production | Supported |
| fluentd | Forward to Fluentd | Medium to large-scale | Not supported |
| syslog | Forward to syslog | Linux native | Not supported |
| awslogs | Forward to CloudWatch Logs | AWS environments | Not supported |
| gcplogs | Forward to Cloud Logging | GCP environments | Not supported |
| gelf | Forward to Graylog | When using Graylog | Not supported |

### Docker Daemon-Level Log Configuration

```json
// /etc/docker/daemon.json - Common log settings for all containers
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3",
    "compress": "true",
    "labels": "environment,service",
    "tag": "{{.ImageName}}/{{.Name}}/{{.ID}}"
  }
}
```

### Structured Log Implementation Patterns (Per Language)

```python
# Python - Structured logging with structlog
import structlog
import logging

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    logger_factory=structlog.PrintLoggerFactory(),
)

logger = structlog.get_logger()

# Usage example
logger.info("request_handled",
    method="GET",
    path="/api/users",
    status=200,
    duration_ms=45,
    request_id="abc-123",
)
# Output: {"event":"request_handled","method":"GET","path":"/api/users","status":200,"duration_ms":45,"request_id":"abc-123","timestamp":"2024-01-15T10:30:00Z","level":"info"}
```

```go
// Go - Structured logging with slog (Go 1.21+)
package main

import (
    "log/slog"
    "os"
)

func main() {
    // Output to stdout in JSON format
    logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
        Level: slog.LevelInfo,
    }))
    slog.SetDefault(logger)

    // Usage example
    slog.Info("request_handled",
        "method", "GET",
        "path", "/api/users",
        "status", 200,
        "duration_ms", 45,
        "request_id", "abc-123",
    )
}
```

---

## 5. Graceful Shutdown

### Code Example 5: Signal Handling

```javascript
// server.js - Node.js Graceful Shutdown
const http = require("http");

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("OK");
});

server.listen(3000, () => {
  console.log("Server started on port 3000");
});

// SIGTERM: Signal sent by docker stop
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");

  server.close(() => {
    console.log("HTTP server closed");
    // DB connection cleanup
    // Message queue disconnection
    process.exit(0);
  });

  // Forced shutdown timeout (self-exit before SIGKILL)
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
});
```

```python
# Python/FastAPI - Graceful Shutdown
import signal
import asyncio
import uvicorn
from fastapi import FastAPI

app = FastAPI()
shutdown_event = asyncio.Event()

@app.on_event("shutdown")
async def shutdown():
    print("Shutting down gracefully...")
    # Close DB connection pool
    await database.disconnect()
    # Wait for background tasks to complete
    await task_queue.close()
    print("Cleanup completed")

# uvicorn handles SIGTERM automatically
if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        timeout_graceful_shutdown=30,
    )
```

```go
// Go - Graceful Shutdown
package main

import (
    "context"
    "log"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"
)

func main() {
    srv := &http.Server{Addr: ":8080"}

    // Signal handling
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, syscall.SIGTERM, syscall.SIGINT)

    go func() {
        if err := srv.ListenAndServe(); err != http.ErrServerClosed {
            log.Fatalf("Server error: %v", err)
        }
    }()

    log.Println("Server started on :8080")

    // Wait for signal
    sig := <-sigChan
    log.Printf("Received signal: %s. Shutting down...", sig)

    // Graceful Shutdown (30 second timeout)
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    if err := srv.Shutdown(ctx); err != nil {
        log.Printf("Forced shutdown: %v", err)
    }

    log.Println("Server stopped")
}
```

```dockerfile
# Dockerfile - Correct entrypoint configuration
FROM node:20-alpine

WORKDIR /app
COPY . .

# NG: Shell form (signal reaches /bin/sh and does not propagate to node process)
# CMD node server.js

# OK: Exec form (node process starts as PID 1 and directly receives signals)
CMD ["node", "server.js"]

# Or, use tini to solve PID 1 problem
# RUN apk add --no-cache tini
# ENTRYPOINT ["tini", "--"]
# CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml
services:
  api:
    image: my-api:latest
    stop_grace_period: 30s  # Grace period from SIGTERM to SIGKILL
    stop_signal: SIGTERM    # Default
```

### Signal Handling Flow

```
docker stop container
    │
    ▼
Send SIGTERM to PID 1
    │
    ▼
┌────────────────────────────────────────┐
│  Application                           │
│  1. Stop accepting new requests        │
│  2. Complete in-flight requests        │
│  3. Close DB connections               │
│  4. Close file handles                 │
│  5. Normal exit with exit(0)           │
└────────────────────────────────────────┘
    │
    │ stop_grace_period elapsed (default 10 seconds)
    ▼
Send SIGKILL (forced termination)
```

### PID 1 Problem and tini/dumb-init

The PID 1 process inside a container has special behavior different from normal Linux processes.

```
Special characteristics of PID 1:
- The default SIGTERM behavior (termination) does not apply
- Responsible for reaping terminated child processes (zombie processes)
- With shell-form CMD, /bin/sh becomes PID 1
  and signals do not propagate to the application process

Solutions:
┌─────────────────────────────────────────────┐
│ 1. Exec-form CMD (recommended)              │
│    CMD ["node", "server.js"]                │
│    → node directly receives signals as PID 1│
│                                              │
│ 2. Use tini / dumb-init (more robust)       │
│    ENTRYPOINT ["tini", "--"]                │
│    CMD ["node", "server.js"]                │
│    → tini is PID 1, node is PID 2           │
│    → Zombie process reaping + signal forward│
│                                              │
│ 3. Docker's --init flag                     │
│    docker run --init my-app:latest          │
│    → Docker automatically injects tini      │
└─────────────────────────────────────────────┘
```

---

## 6. Production Dockerfile Templates

### Code Example 6: Production-Grade Multi-Stage Dockerfile

```dockerfile
# === Build Stage ===
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (leveraging cache)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Remove unnecessary dev dependencies
RUN npm prune --production

# === Production Stage ===
FROM node:20-alpine AS production

# Security updates
RUN apk update && apk upgrade --no-cache && \
    apk add --no-cache tini dumb-init

# Non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

# Copy only build artifacts
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Metadata
LABEL maintainer="team@example.com" \
      version="1.0.0" \
      description="Production API server"

# Run as non-root user
USER appuser

EXPOSE 3000

# Solve PID 1 problem with tini
ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/server.js"]
```

### Python Production Dockerfile

```dockerfile
# === Build Stage ===
FROM python:3.12-slim AS builder

WORKDIR /app

# Use virtual environment to avoid polluting system Python
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# === Production Stage ===
FROM python:3.12-slim AS production

# Security updates
RUN apt-get update && apt-get upgrade -y --no-install-recommends && \
    apt-get install -y --no-install-recommends tini wget && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -s /bin/false -m appuser

WORKDIR /app

# Copy virtual environment
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application code
COPY --chown=appuser:appgroup . .

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/health || exit 1

# Environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

USER appuser

EXPOSE 8000

ENTRYPOINT ["tini", "--"]
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "--timeout", "120", "app:create_app()"]
```

### Go Production Dockerfile

```dockerfile
# === Build Stage ===
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download && go mod verify

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w -X main.version=$(cat VERSION)" \
    -o /app/server ./cmd/server

# === Production Stage (distroless) ===
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app/server /server

EXPOSE 8080

USER nonroot:nonroot

ENTRYPOINT ["/server"]
```

---

## 7. Production Checklist

### Code Example 7: docker-compose Production Configuration

```yaml
# docker-compose.prod.yml
version: "3.9"

services:
  api:
    image: registry.example.com/api:${VERSION:-latest}
    restart: unless-stopped        # Auto-restart
    read_only: true                # Root FS read-only
    tmpfs:
      - /tmp:size=100m,noexec     # Only tmp is writable
    security_opt:
      - no-new-privileges:true     # Prohibit privilege escalation
    cap_drop:
      - ALL                        # Remove all Capabilities
    cap_add:
      - NET_BIND_SERVICE           # Add only what is needed
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
    environment:
      NODE_ENV: production
      LOG_LEVEL: info
    networks:
      - app-net
```

### Pre-Production Deployment Checklist

All items in the following checklist must pass before proceeding with production deployment.

```
## Security Checks
□ Running as non-root user (USER instruction)
□ read_only: true configured
□ cap_drop: ALL + only necessary cap_add
□ no-new-privileges: true
□ Sensitive info via environment variables or secret management
□ Security updates applied to base image
□ Image scanned with Trivy (no CRITICAL/HIGH)
□ .env, .git, node_modules excluded via .dockerignore

## Reliability Checks
□ HEALTHCHECK defined
□ restart: unless-stopped configured
□ Memory limit (deploy.resources.limits.memory)
□ CPU limit (deploy.resources.limits.cpus)
□ Graceful Shutdown implemented (SIGTERM handling)
□ stop_grace_period configured
□ Dependent services have healthcheck + depends_on condition

## Logging and Monitoring Checks
□ Logs output to stdout/stderr
□ JSON structured logging
□ Log rotation configured (max-size, max-file)
□ /health endpoint implemented
□ /metrics endpoint implemented (Prometheus)
□ request_id / trace_id included in logs

## Image Checks
□ Multi-stage build (build tools not needed in production stage)
□ Explicit version tags (no use of latest tag)
□ Unnecessary files excluded via .dockerignore
□ Metadata added with LABEL
□ Exec-form CMD (not shell-form)
□ PID 1 problem resolved with tini or dumb-init

## Network Checks
□ No unnecessary ports EXPOSEd
□ Internal communication networks use internal: true
□ TLS/SSL configured (directly or via reverse proxy)
```

### Environment Variables and Secret Management

```yaml
# docker-compose.prod.yml - Secret management
version: "3.9"

services:
  api:
    image: my-api:latest
    environment:
      # Non-sensitive config specified directly as environment variables
      NODE_ENV: production
      LOG_LEVEL: info
      PORT: "3000"
    env_file:
      - .env.production  # Environment-specific settings
    secrets:
      - db_password
      - api_key
      - jwt_secret

secrets:
  db_password:
    file: ./secrets/db_password.txt    # File-based
  api_key:
    external: true                      # Docker Swarm secret
  jwt_secret:
    environment: JWT_SECRET             # From environment variable (Compose v2.17+)
```

```javascript
// Node.js - Reading Docker secrets
const fs = require("fs");
const path = require("path");

function readSecret(secretName) {
  const secretPath = path.join("/run/secrets", secretName);
  try {
    return fs.readFileSync(secretPath, "utf8").trim();
  } catch (err) {
    // Fall back to environment variable if secret file is not found
    return process.env[secretName.toUpperCase()];
  }
}

const dbPassword = readSecret("db_password");
const jwtSecret = readSecret("jwt_secret");
```

---

## 8. Network Security

### Production Network Design

```yaml
# docker-compose.prod.yml - Network isolation
version: "3.9"

services:
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    networks:
      - frontend
    # Only nginx is exposed externally

  api:
    image: my-api:latest
    networks:
      - frontend    # Receives requests from nginx
      - backend     # Connects to DB/Redis
    # Ports are not published (only via nginx)

  postgres:
    image: postgres:16-alpine
    networks:
      - backend     # Accessible only from API
    # Ports are not published

  redis:
    image: redis:7-alpine
    networks:
      - backend
    # Ports are not published

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # No external access (no internet connection)
```

```
Network isolation diagram:

Internet
    │
    │ :443
    ▼
┌─────────────────────────────────────────┐
│  frontend network                       │
│  ┌──────────┐       ┌──────────┐       │
│  │  nginx   │──────►│   api    │       │
│  │ :443     │       │          │       │
│  └──────────┘       └────┬─────┘       │
│                          │              │
├──────────────────────────┼──────────────┤
│  backend network         │ (internal)   │
│                     ┌────▼─────┐        │
│  ┌──────────┐      │   api    │        │
│  │ postgres │◄─────│          │        │
│  │          │      └────┬─────┘        │
│  └──────────┘           │               │
│  ┌──────────┐      ┌───▼──────┐        │
│  │  redis   │◄─────│   api    │        │
│  └──────────┘      └──────────┘        │
│                                         │
│  ※ internal: true blocks               │
│    external internet communication      │
└─────────────────────────────────────────┘
```

---

## Anti-Patterns

### Anti-Pattern 1: Running Containers as Root

```dockerfile
# NG: No USER specified (runs as root)
FROM node:20-alpine
WORKDIR /app
COPY . .
CMD ["node", "server.js"]

# OK: Run as a dedicated user
FROM node:20-alpine
WORKDIR /app
COPY . .
USER node
CMD ["node", "server.js"]
```

**Why it's a problem**: If a container running as root is compromised, there is a risk that host root privileges can be obtained. Follow the principle of least privilege and run as a dedicated user.

### Anti-Pattern 2: Running in Production Without Resource Limits

```yaml
# NG: No resource limits
services:
  api:
    image: my-api:latest
    # → Memory leak can crash the host, taking down other containers

# OK: Set appropriate resource limits
services:
  api:
    image: my-api:latest
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"
```

**Why it's a problem**: If a container without resource limits experiences a memory leak, it will consume all host memory and affect all other containers and the host OS.

### Anti-Pattern 3: Accumulating Log Files Inside the Container

```bash
# NG: Write logs to a file inside the container
# App writes to /var/log/app.log → Container size bloat

# OK: Output to stdout/stderr and delegate to Docker log driver
# Use console.log(), print(), fmt.Println()
```

**Why it's a problem**: The container filesystem is ephemeral, and logs are lost when the container restarts. Also, container disk usage grows continuously.

### Anti-Pattern 4: Writing Secrets Directly in Environment Variables

```yaml
# NG: Write passwords directly in docker-compose.yml
services:
  api:
    environment:
      DB_PASSWORD: "MySecretPassword123!"
      API_KEY: "sk-1234567890abcdef"

# OK: Use Docker Secrets or .env file (included in .gitignore)
services:
  api:
    env_file:
      - .env.production  # Include in .gitignore
    secrets:
      - db_password
```

**Why it's a problem**: Committing docker-compose.yml to a Git repository leaves secrets in the history, leading to leakage.

### Anti-Pattern 5: Shell-Form CMD

```dockerfile
# NG: Shell form (wrapped in /bin/sh -c)
CMD node server.js
# PID 1 = /bin/sh, PID 2 = node
# → SIGTERM reaches /bin/sh and does not propagate to node

# OK: Exec form
CMD ["node", "server.js"]
# PID 1 = node
# → SIGTERM reaches node directly
```

**Why it's a problem**: With shell form, the SIGTERM signal reaches the shell process and is not forwarded to the application process by default. Graceful Shutdown will not work.


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement appropriate error handling
- Also create test code

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise on basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Input value validation"""
        if value is None:
            raise ValueError("Input value is None")
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
        assert False, "Exception should be raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Applied Pattern

Extend the basic implementation to add the following features.

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

    print(f"Inefficient version: {slow_time:.4f}s")
    print(f"Efficient version:   {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Configuration file issues | Check configuration file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry processing |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access privileges | Check running user privileges, review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check error messages**: Read the stack trace to identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Stepwise verification**: Verify hypotheses using log output or a debugger
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
        logger.debug(f"Call: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return value: {func.__name__} -> {result}")
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

1. **Identify bottlenecks**: Measure with profiling tools
2. **Check memory usage**: Check for memory leaks
3. **Check I/O waits**: Check disk and network I/O status
4. **Check concurrent connections**: Check connection pool status

| Problem Type | Diagnostic Tool | Solution |
|-------------|----------------|----------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | Prioritize When | Acceptable to Compromise When |
|-----------|----------------|-------------------------------|
| Performance | Real-time processing, large-scale data | Admin screens, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│          Architecture Selection Flow             │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① What is the team size?                       │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → Go to ②              │
│                                                 │
│  ② What is the deployment frequency?            │
│    ├─ Weekly or less → Monolith + module split  │
│    └─ Daily/multiple times → Go to ③            │
│                                                 │
│  ③ How independent are the teams?               │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Conduct analysis from the following perspectives:

**1. Short-term vs. Long-term costs**
- A method that is fast in the short term may become technical debt in the long term
- Conversely, over-engineering incurs high short-term costs and can delay the project

**2. Consistency vs. Flexibility**
- A unified technology stack has low learning costs
- Adopting diverse technologies allows using the right tool for the job, but increases operational costs

**3. Level of abstraction**
- High abstraction has high reusability but can make debugging difficult
- Low abstraction is intuitive but prone to code duplication

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
        """Describe background and challenges"""
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

### Q1: What is the difference between `restart: always` and `restart: unless-stopped`?

`always` always restarts the container when the Docker daemon starts. `unless-stopped` does not restart containers that were explicitly stopped by the user when the daemon restarts. `unless-stopped` is recommended for production. This prevents containers stopped for maintenance from being unintentionally restarted.

### Q2: Should I use curl or wget for the health check test command?

Alpine-based images include `wget` but not `curl`. Installing additional packages increases image size, so use `wget` with alpine-based images. `curl` is available on Debian-based images. The lightest approach is to embed a health check CLI within the application itself.

### Q3: What should I do when the application does not work with `read_only: true`?

Provide a temporary write area with `tmpfs` mounts. Many applications need to write to `/tmp` or `/var/run`.

```yaml
services:
  api:
    read_only: true
    tmpfs:
      - /tmp:size=100m
      - /var/run:size=10m
```

### Q4: Is Docker Compose recommended for production use?

Docker Compose is fully capable of handling single-host production operations. However, use it with an understanding of the following limitations:

- **Single point of failure**: All services stop if the host fails
- **Scaling**: Scaling is only possible within the same host
- **Zero-downtime deployment**: Can be approximated with `--scale` and healthcheck, but not complete

For medium to large scale or when high availability is required, consider migrating to Docker Swarm or Kubernetes.

### Q5: How frequently should container security scans be performed?

- **CI pipeline**: Scan on every build (mandatory)
- **Regular scans**: Scan deployed images at least once a week
- **On base image updates**: Rebuild and scan immediately

```bash
# Image scanning with Trivy
trivy image --severity CRITICAL,HIGH my-app:latest

# Detect only known vulnerabilities (fixable ones)
trivy image --ignore-unfixed --severity CRITICAL my-app:latest

# Generate SBOM (Software Bill of Materials)
trivy image --format spdx-json --output sbom.json my-app:latest
```

### Q6: What are distroless images? Should I use them?

Minimal container images provided by Google. They do not include shells, package managers, or other OS utilities. The attack surface is minimal, and the number of CVEs is at a minimum. Ideal for applications like Go or Java that produce a single binary/JAR.

```dockerfile
# Go application using distroless
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /app/server /server
USER nonroot:nonroot
ENTRYPOINT ["/server"]
```

Use the `:debug` tag for debugging, which includes a shell.

---

## Summary

| Item | Key Points |
|------|-----------|
| Non-root user | Switch to a dedicated user with the `USER` instruction. Principle of least privilege |
| Health check | Set the 4 parameters interval/timeout/retries/start_period appropriately |
| Resource limits | Memory limits are mandatory. Also configure cpus/pids-limit. Prevent OOM Kill |
| Logging strategy | JSON structured output to stdout/stderr. Forward with log driver |
| Graceful Shutdown | SIGTERM handling. Exec-form CMD. Use tini |
| Read-only FS | Minimize writes with `read_only: true` + tmpfs |
| Capabilities | `cap_drop: ALL` + `cap_add` only what is necessary |
| Network isolation | Separate frontend/backend. Block external access with internal: true |
| Secret management | Docker Secrets / env_file. Never hard-code secrets |
| Image security | Trivy scan. Minimal configuration with distroless / alpine |

---

## What to Read Next

- [Monitoring](./01-monitoring.md) -- Building a monitoring system with Prometheus/Grafana
- [Docker CI/CD](./02-ci-cd-docker.md) -- Build and deploy automation pipeline
- [Container Security](../06-security/00-container-security.md) -- Comprehensive security practices

---

## References

1. Docker Official Documentation "Docker security" -- https://docs.docker.com/engine/security/
2. CIS Docker Benchmark -- https://www.cisecurity.org/benchmark/docker
3. NIST SP 800-190 "Application Container Security Guide" -- https://csrc.nist.gov/publications/detail/sp/800-190/final
4. Liz Rice (2020) *Container Security: Fundamental Technology Concepts that Protect Containerized Applications*, O'Reilly
5. Docker Official Documentation "Configure logging drivers" -- https://docs.docker.com/config/containers/logging/
6. Google "Distroless" Container Images -- https://github.com/GoogleContainerTools/distroless
7. Docker Official Documentation "Rootless mode" -- https://docs.docker.com/engine/security/rootless/
8. Adrian Mouat (2023) *Docker: Up & Running*, 3rd Edition, O'Reilly

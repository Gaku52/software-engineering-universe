# Docker Compose Advanced

> Leverage advanced Docker Compose features — profiles, fine-grained depends_on control, healthchecks, and environment variable management patterns — to build production-quality configurations.

## What You Will Learn

1. **Selective service startup with profiles** -- Group services by purpose (development, testing, monitoring, etc.) and start only what you need
2. **Advanced depends_on and healthcheck control** -- Precisely manage inter-service dependencies and guarantee a reliable startup order
3. **Environment variable and configuration management patterns** -- Switch settings across multiple environments, manage secrets, and layer file overrides
4. **YAML anchors and Extension Fields** -- Keep configuration DRY and improve maintainability
5. **Resource limits, logging, and security settings** -- Build production-quality Compose configurations


## Prerequisites

The following knowledge will help you get the most out of this guide:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [Docker Compose Basics](./00-compose-basics.md)

---

## 1. Profiles

### 1.1 Overview of Profiles

The Docker Compose profiles feature lets you group services logically and start only the ones you need on demand. It is ideal for managing services that do not need to run all the time — development tools, test runners, monitoring stacks, and debugging utilities.

Services without a profile assigned are treated as "default" and are always started. Services assigned to a profile are only started when that profile is explicitly enabled.

```
+------------------------------------------------------------------+
|              Service grouping by profile                         |
+------------------------------------------------------------------+
|                                                                  |
|  [Default] (no profile → always started)                        |
|    app, db, redis                                                |
|                                                                  |
|  [debug profile] (started with --profile debug)                 |
|    pgadmin, redis-commander                                      |
|                                                                  |
|  [monitoring profile] (started with --profile monitoring)       |
|    prometheus, grafana, alertmanager                             |
|                                                                  |
|  [test profile] (started with --profile test)                   |
|    test-runner, db-test, test-mail                               |
|                                                                  |
|  [seed profile] (started with --profile seed)                   |
|    db-seeder, sample-data-loader                                 |
|                                                                  |
+------------------------------------------------------------------+
```

### 1.2 Configuring Profiles

```yaml
# docker-compose.yml
services:
  # No profile → always started
  app:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: postgres
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine

  # debug profile
  pgadmin:
    image: dpage/pgadmin4:latest
    profiles: ["debug"]
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"

  redis-commander:
    image: rediscommander/redis-commander:latest
    profiles: ["debug"]
    environment:
      REDIS_HOSTS: local:redis:6379
    ports:
      - "8081:8081"

  # monitoring profile
  prometheus:
    image: prom/prometheus:latest
    profiles: ["monitoring"]
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    profiles: ["monitoring"]
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana

  alertmanager:
    image: prom/alertmanager:latest
    profiles: ["monitoring"]
    volumes:
      - ./monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml
    ports:
      - "9093:9093"

  # test profile
  test-runner:
    build:
      context: .
      target: test
    profiles: ["test"]
    depends_on:
      db:
        condition: service_healthy
    command: npm test

  # seed profile (initial data loading)
  db-seeder:
    build:
      context: .
      dockerfile: Dockerfile.seed
    profiles: ["seed"]
    depends_on:
      db:
        condition: service_healthy
    command: npx prisma db seed
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/myapp

volumes:
  grafana_data:
```

### 1.3 Profile Startup Commands

```bash
# Start default services only
docker compose up -d

# Add debug tools
docker compose --profile debug up -d

# Multiple profiles at once
docker compose --profile debug --profile monitoring up -d

# Run tests
docker compose --profile test run --rm test-runner

# Specify profiles via environment variable
COMPOSE_PROFILES=debug,monitoring docker compose up -d

# Stop only services belonging to a specific profile
docker compose --profile debug stop

# List services for a specific profile
docker compose --profile test ps

# Check state of all services including all profiles
docker compose --profile "*" ps
```

### 1.4 Practical Profile Patterns

#### Pattern A: Switching Between Development / Staging / Production

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"

  # Mail catcher for development only
  mailhog:
    image: mailhog/mailhog:latest
    profiles: ["dev"]
    ports:
      - "1025:1025"
      - "8025:8025"    # Web UI

  # Load testing tool for staging
  k6:
    image: grafana/k6:latest
    profiles: ["staging"]
    volumes:
      - ./tests/load:/scripts
    command: run /scripts/load-test.js

  # Log collector for production
  fluentd:
    image: fluent/fluentd:v1.16
    profiles: ["production"]
    volumes:
      - ./fluentd/conf:/fluentd/etc
    ports:
      - "24224:24224"
```

#### Pattern B: Database Migration Management

```yaml
services:
  db:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Run migrations
  migrate:
    build: .
    profiles: ["migrate"]
    depends_on:
      db:
        condition: service_healthy
    command: npx prisma migrate deploy
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/myapp

  # Generate migrations (development only)
  migrate-dev:
    build: .
    profiles: ["migrate-dev"]
    depends_on:
      db:
        condition: service_healthy
    command: npx prisma migrate dev
    volumes:
      - ./prisma:/app/prisma
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/myapp

  # Reset DB schema (destructive operation)
  db-reset:
    build: .
    profiles: ["db-reset"]
    depends_on:
      db:
        condition: service_healthy
    command: npx prisma migrate reset --force
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/myapp
```

---

## 2. depends_on and healthcheck

### 2.1 Three Conditions for depends_on

Docker Compose lets you control inter-service dependencies with three conditions. This enables everything from simple startup-order control to waiting for a healthcheck to pass or a one-shot task to complete.

```yaml
services:
  app:
    depends_on:
      db:
        condition: service_healthy    # Wait until healthcheck passes
      redis:
        condition: service_started    # OK as soon as the container starts
      migration:
        condition: service_completed_successfully  # Wait for clean exit
        restart: true                 # Also wait on restarts
```

The detailed behavior of each condition is as follows.

| Condition | Behavior | Typical use case |
|-----------|----------|-----------------|
| `service_started` | Proceeds immediately once the container process has started | Fast-starting services (Redis, etc.) |
| `service_healthy` | Waits until the healthcheck reports passing | Services with slow initialization such as databases or Elasticsearch |
| `service_completed_successfully` | Waits until the container exits with code 0 | Migrations, seed scripts, initialization tasks |

### 2.2 Detailed healthcheck Configuration

The following examples show healthcheck implementations for various datastores and services. Healthchecks are essential not just to confirm that a service has "started" but to verify that it is "ready to accept requests."

```yaml
services:
  # PostgreSQL
  db:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d myapp"]
      interval: 5s        # Check interval
      timeout: 5s          # Timeout
      retries: 5           # Allowed failure count
      start_period: 30s    # Grace period on startup (failures during this window are not counted)

  # MySQL
  mysql:
    image: mysql:8.0
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p$$MYSQL_ROOT_PASSWORD"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 30s

  # MariaDB
  mariadb:
    image: mariadb:11
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 30s

  # Redis
  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  # Redis (with password)
  redis-auth:
    image: redis:7-alpine
    command: redis-server --requirepass mypassword
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "mypassword", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  # MongoDB
  mongodb:
    image: mongo:7
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  # HTTP service
  api:
    build: .
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 15s

  # HTTP service (using wget — for images without curl)
  api-alpine:
    build: .
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 15s

  # Elasticsearch
  elasticsearch:
    image: elasticsearch:8.12.0
    healthcheck:
      test: ["CMD-SHELL", "curl -s http://localhost:9200/_cluster/health | grep -q '\"status\":\"green\"\\|\"status\":\"yellow\"'"]
      interval: 10s
      timeout: 10s
      retries: 10
      start_period: 60s

  # RabbitMQ
  rabbitmq:
    image: rabbitmq:3-management-alpine
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      timeout: 10s
      retries: 5
      start_period: 30s

  # Kafka (KRaft mode)
  kafka:
    image: bitnami/kafka:3.7
    healthcheck:
      test: ["CMD-SHELL", "kafka-broker-api-versions.sh --bootstrap-server localhost:9092 > /dev/null 2>&1"]
      interval: 10s
      timeout: 10s
      retries: 10
      start_period: 60s

  # MinIO (S3-compatible storage)
  minio:
    image: minio/minio:latest
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s
```

### 2.3 Dependency Graph Visualization

```
+------------------------------------------------------------------+
|              Service dependency graph                            |
+------------------------------------------------------------------+
|                                                                  |
|  migration ──(completed)──> db ──(healthy)──+                    |
|                              ^               |                   |
|                              |               v                   |
|  seed ──(completed)──────────+             app ──> redis         |
|                                              |    (started)      |
|                                              v                   |
|                                           worker ──> redis       |
|                                           (started)              |
|                                                                  |
+------------------------------------------------------------------+
```

### 2.4 Implementing a Complex Dependency Chain

Real-world applications often require a sequence such as: start DB → run migrations → seed data → start app. The following is a complete implementation example.

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: myapp
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d myapp"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 30s
    volumes:
      - pgdata:/var/lib/postgresql/data

  # Step 1: Run migrations
  migration:
    build:
      context: .
      target: migration
    depends_on:
      db:
        condition: service_healthy
    command: npx prisma migrate deploy
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/myapp

  # Step 2: Seed data (after migrations complete)
  seed:
    build:
      context: .
      target: seed
    depends_on:
      migration:
        condition: service_completed_successfully
    command: npx prisma db seed
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/myapp

  # Step 3: Start the app (after seeding completes)
  app:
    build:
      context: .
      target: production
    depends_on:
      seed:
        condition: service_completed_successfully
      redis:
        condition: service_healthy
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/myapp
      REDIS_URL: redis://redis:6379

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  # Worker process (same dependencies as app)
  worker:
    build:
      context: .
      target: production
    depends_on:
      seed:
        condition: service_completed_successfully
      redis:
        condition: service_healthy
    command: node dist/worker.js
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/myapp
      REDIS_URL: redis://redis:6379

volumes:
  pgdata:
```

### 2.5 Custom Healthcheck Scripts

When a complex healthcheck is needed, prepare a dedicated script and copy it into the container.

```bash
#!/bin/bash
# healthcheck.sh - Composite health check

# 1. Check HTTP endpoint
if ! curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    echo "HTTP health check failed"
    exit 1
fi

# 2. Check DB connection
if ! node -e "
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  prisma.\$queryRaw\`SELECT 1\`.then(() => process.exit(0)).catch(() => process.exit(1));
" 2>/dev/null; then
    echo "Database connection check failed"
    exit 1
fi

# 3. Check Redis connection
if ! node -e "
  const Redis = require('ioredis');
  const redis = new Redis(process.env.REDIS_URL);
  redis.ping().then(() => process.exit(0)).catch(() => process.exit(1));
" 2>/dev/null; then
    echo "Redis connection check failed"
    exit 1
fi

echo "All health checks passed"
exit 0
```

```dockerfile
# Dockerfile
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY healthcheck.sh /usr/local/bin/healthcheck.sh
RUN chmod +x /usr/local/bin/healthcheck.sh
HEALTHCHECK --interval=15s --timeout=10s --retries=3 --start-period=30s \
    CMD /usr/local/bin/healthcheck.sh
```

---

## 3. Environment Variable Management

### 3.1 Environment Variable Priority

When environment variable values are supplied from multiple sources, Docker Compose applies a well-defined priority order.

```
+------------------------------------------------------------------+
|           Environment variable priority (highest first)          |
+------------------------------------------------------------------+
|                                                                  |
|  1. docker compose run -e VAR=value  (direct CLI flag)           |
|  2. environment: section                                         |
|  3. File specified with --env-file                               |
|  4. env_file: section                                            |
|  5. Dockerfile ENV                                               |
|  6. Shell environment variables (via .env file)                  |
|                                                                  |
+------------------------------------------------------------------+
```

### 3.2 Using Multiple .env Files

```bash
# .env (For Compose variable expansion — loaded automatically by docker compose)
COMPOSE_PROJECT_NAME=myapp
POSTGRES_VERSION=16
NODE_VERSION=20
APP_PORT=3000

# .env.development (For the application — loaded explicitly via env_file)
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@db:5432/myapp_dev
REDIS_URL=redis://redis:6379
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:3000
SESSION_SECRET=dev-secret-key-not-for-production
SMTP_HOST=mailhog
SMTP_PORT=1025

# .env.staging (For staging)
NODE_ENV=staging
DATABASE_URL=postgresql://staging_user:staging_pass@db:5432/myapp_staging
REDIS_URL=redis://redis:6379
LOG_LEVEL=info
CORS_ORIGIN=https://staging.example.com

# .env.production (For production)
NODE_ENV=production
DATABASE_URL=postgresql://user:password@db-prod:5432/myapp
LOG_LEVEL=warn
CORS_ORIGIN=https://www.example.com
```

```yaml
# docker-compose.yml
services:
  app:
    image: node:${NODE_VERSION}-alpine  # Use variable from .env
    env_file:
      - .env.development                # Application environment variables
    environment:
      # Override values from env_file
      LOG_LEVEL: ${LOG_LEVEL:-info}     # With default value

  db:
    image: postgres:${POSTGRES_VERSION}-alpine
```

### 3.3 Variable Expansion Syntax

```yaml
services:
  app:
    environment:
      # Basic form
      DB_HOST: ${DB_HOST}

      # Default value (when unset or empty)
      DB_PORT: ${DB_PORT:-5432}

      # Default value (when undefined only)
      DB_NAME: ${DB_NAME-myapp}

      # Error when unset
      DB_PASSWORD: ${DB_PASSWORD:?Database password must be set}

      # Use alternate value when set
      DB_SSL: ${DB_HOST:+true}

      # Nested variable expansion (Compose V2.24+)
      FULL_DB_URL: "postgresql://${DB_USER:-postgres}:${DB_PASSWORD}@${DB_HOST:-db}:${DB_PORT:-5432}/${DB_NAME:-myapp}"
```

### 3.4 Secret Management

Docker Compose's secrets feature provides a way to manage sensitive information such as passwords and API keys without writing them directly into environment variables.

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password

  app:
    build: .
    secrets:
      - db_password
      - api_key
      - jwt_secret
    environment:
      # Application reads the secret files
      DB_PASSWORD_FILE: /run/secrets/db_password
      API_KEY_FILE: /run/secrets/api_key
      JWT_SECRET_FILE: /run/secrets/jwt_secret

secrets:
  db_password:
    file: ./secrets/db_password.txt     # Read from file
  api_key:
    environment: API_KEY                 # From environment variable (Compose V2.22+)
  jwt_secret:
    file: ./secrets/jwt_secret.txt
```

Application-side implementation for reading secret files (Node.js):

```javascript
// config/secrets.js
const fs = require('fs');
const path = require('path');

function readSecret(name) {
  const filePath = process.env[`${name}_FILE`];
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8').trim();
  }
  // Fallback: read directly from environment variable
  return process.env[name];
}

module.exports = {
  dbPassword: readSecret('DB_PASSWORD'),
  apiKey: readSecret('API_KEY'),
  jwtSecret: readSecret('JWT_SECRET'),
};
```

### 3.5 .gitignore Configuration for .env Files

```gitignore
# .gitignore
.env
.env.local
.env.*.local
.env.production
.env.staging
secrets/

# Templates should be committed
!.env.example
!.env.development.example
```

```bash
# .env.example (committed as a template)
COMPOSE_PROJECT_NAME=myapp
POSTGRES_VERSION=16
NODE_VERSION=20
DB_PASSWORD=<SET_YOUR_PASSWORD>
API_KEY=<SET_YOUR_API_KEY>
```

---

## 4. Merging Multiple Compose Files

### 4.1 Override Pattern

Docker Compose can merge multiple configuration files into a single configuration. This allows you to separate base settings from environment-specific settings, achieving DRY configuration management.

```yaml
# docker-compose.yml (base configuration)
services:
  app:
    build: .
    environment:
      NODE_ENV: production

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

volumes:
  pgdata:
```

```yaml
# docker-compose.override.yml (development overrides — merged automatically)
services:
  app:
    build:
      target: development
    environment:
      NODE_ENV: development
      DEBUG: "true"
    volumes:
      - .:/app
      - node_modules:/app/node_modules
    ports:
      - "3000:3000"
      - "9229:9229"   # Debugger port

  db:
    ports:
      - "5432:5432"   # Exposed externally in development only
    environment:
      POSTGRES_PASSWORD: postgres

volumes:
  node_modules:
```

```yaml
# docker-compose.prod.yml (production)
services:
  app:
    restart: always
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 128M
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  db:
    restart: always
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 1G

  redis:
    restart: always
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
```

```yaml
# docker-compose.ci.yml (CI only)
services:
  app:
    build:
      target: test
    environment:
      NODE_ENV: test
      DATABASE_URL: postgresql://postgres:postgres@db:5432/myapp_test

  db:
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: myapp_test
    tmpfs:
      - /var/lib/postgresql/data    # Use in-memory for speed in CI
```

### 4.2 Merge Commands

```bash
# Development (compose.yml + compose.override.yml are merged automatically)
docker compose up -d

# Production (exclude override, apply prod)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# CI (exclude override, apply ci)
docker compose -f docker-compose.yml -f docker-compose.ci.yml up -d

# Inspect the merged configuration
docker compose -f docker-compose.yml -f docker-compose.prod.yml config

# Inspect merged result for specific services
docker compose -f docker-compose.yml -f docker-compose.prod.yml config --services

# Output merged result to a file
docker compose -f docker-compose.yml -f docker-compose.prod.yml config > docker-compose.resolved.yml
```

### 4.3 Merge Rules in Detail

| Configuration key | Merge behavior |
|-------------------|----------------|
| `image`, `command`, `entrypoint` | Overwritten by the later file |
| `environment` | Merged (overwritten per key) |
| `volumes` | Merged (entries are added) |
| `ports` | Merged (entries are added) |
| `networks` | Merged (entries are added) |
| `labels` | Merged (overwritten per key) |
| `deploy` | Deep merged |
| `build.args` | Merged (overwritten per key) |
| `healthcheck` | Completely overwritten by the later file |

### 4.4 Automatic File Selection via COMPOSE_FILE

```bash
# Specify files to load in the .env file
# Development environment
COMPOSE_FILE=docker-compose.yml:docker-compose.override.yml

# Staging environment
COMPOSE_FILE=docker-compose.yml:docker-compose.staging.yml

# Production environment
COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml

# The separator is ":" by default (Linux/macOS) or ";" (Windows)
```

---

## 5. Resource Limits and Logging

### 5.1 Resource Limits

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '0.5'        # 0.5 CPU cores
          memory: 256M        # 256 MB of memory
          pids: 100           # Maximum number of processes
        reservations:
          cpus: '0.25'       # Guaranteed minimum CPU
          memory: 128M        # Guaranteed minimum memory

    # Behavior on OOM
    oom_kill_disable: false
    oom_score_adj: 100         # OOM score adjustment (-1000 to 1000)

    # File descriptor limits
    ulimits:
      nofile:
        soft: 65536
        hard: 65536
      nproc:
        soft: 4096
        hard: 4096

    # SHM size limit (shared memory)
    shm_size: '256m'

    # Stop signal and timeout
    stop_signal: SIGTERM
    stop_grace_period: 30s
```

### 5.2 Recommended Resource Settings for Each Service

```yaml
services:
  # Node.js app
  app:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 128M

  # PostgreSQL
  db:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 256M
    shm_size: '256m'    # PostgreSQL makes heavy use of shared memory

  # Redis
  redis:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.1'
          memory: 64M

  # Elasticsearch
  elasticsearch:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G
    environment:
      ES_JAVA_OPTS: "-Xms512m -Xmx1g"   # Align JVM heap with memory limits
```

### 5.3 Logging Configuration

```yaml
services:
  app:
    logging:
      driver: json-file
      options:
        max-size: "10m"      # Maximum log file size
        max-file: "3"        # Number of rotations
        compress: "true"     # Compression
        labels: "service"
        tag: "{{.Name}}/{{.ID}}"  # Custom log tag

  # Shared log configuration for all services (YAML anchor)
  db:
    logging: &default-logging
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  redis:
    logging: *default-logging  # Reference the anchor
```

### 5.4 External Logging Driver Configuration

```yaml
services:
  # Fluentd driver
  app:
    logging:
      driver: fluentd
      options:
        fluentd-address: localhost:24224
        tag: myapp.{{.Name}}
        fluentd-async: "true"
        fluentd-retry-wait: "1s"
        fluentd-max-retries: "10"

  # syslog driver
  api:
    logging:
      driver: syslog
      options:
        syslog-address: "tcp://logserver:514"
        syslog-facility: "daemon"
        tag: "{{.Name}}"

  # Disable logging (for very noisy services)
  noisy-service:
    logging:
      driver: none
```

---

## 6. YAML Anchors and Aliases

### 6.1 Basic Anchors and Aliases

```yaml
# Define common settings with anchors
x-common-env: &common-env
  TZ: Asia/Tokyo
  LANG: ja_JP.UTF-8

x-healthcheck-defaults: &healthcheck-defaults
  interval: 10s
  timeout: 5s
  retries: 3
  start_period: 30s

x-logging: &default-logging
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"

services:
  app:
    environment:
      <<: *common-env          # Merge (expand anchor)
      NODE_ENV: production
    healthcheck:
      <<: *healthcheck-defaults
      test: ["CMD-SHELL", "curl -f http://localhost:3000/health"]
    logging: *default-logging

  worker:
    environment:
      <<: *common-env
      WORKER_TYPE: background
    healthcheck:
      <<: *healthcheck-defaults
      test: ["CMD-SHELL", "curl -f http://localhost:3001/health"]
    logging: *default-logging
```

### 6.2 Advanced Use of Extension Fields (x- prefix)

Extension Fields are custom fields ignored by Compose that serve as anchor definition points. They are particularly effective for sharing entire service definitions.

```yaml
# Service template
x-app-base: &app-base
  build:
    context: .
    dockerfile: Dockerfile
  restart: always
  networks:
    - app-net
  logging: &default-logging
    driver: json-file
    options:
      max-size: "10m"
      max-file: "3"
  deploy:
    resources:
      limits:
        cpus: '1.0'
        memory: 512M
      reservations:
        cpus: '0.25'
        memory: 128M
  environment: &common-env
    TZ: Asia/Tokyo
    LANG: ja_JP.UTF-8
    NODE_ENV: production
    DATABASE_URL: postgresql://postgres:${DB_PASSWORD}@db:5432/myapp
    REDIS_URL: redis://redis:6379

x-db-healthcheck: &db-healthcheck
  test: ["CMD-SHELL", "pg_isready -U postgres"]
  interval: 5s
  timeout: 5s
  retries: 5
  start_period: 30s

services:
  # Inherit and customize the template
  web:
    <<: *app-base
    ports:
      - "3000:3000"
    command: node dist/web.js
    environment:
      <<: *common-env
      SERVER_TYPE: web
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  api:
    <<: *app-base
    ports:
      - "8080:8080"
    command: node dist/api.js
    environment:
      <<: *common-env
      SERVER_TYPE: api

  worker:
    <<: *app-base
    command: node dist/worker.js
    environment:
      <<: *common-env
      SERVER_TYPE: worker
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 1G  # Workers use more memory

  scheduler:
    <<: *app-base
    command: node dist/scheduler.js
    environment:
      <<: *common-env
      SERVER_TYPE: scheduler

  db:
    image: postgres:16-alpine
    restart: always
    healthcheck:
      <<: *db-healthcheck
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - app-net
    logging: *default-logging

networks:
  app-net:

volumes:
  pgdata:
```

### 6.3 Conditional Configuration (Combining Anchors and Overrides)

```yaml
# docker-compose.yml
x-app-volumes: &app-volumes
  volumes:
    - app-data:/data

services:
  app:
    <<: *app-volumes
    image: myapp:latest
```

```yaml
# docker-compose.override.yml (overrides for development environment)
services:
  app:
    volumes:
      - .:/app
      - app-data:/data    # Keep the original volume as well
```

---

## 7. Advanced Network Isolation

### 7.1 Multi-Network Configuration

```yaml
services:
  # Frontend (public + app-tier only)
  nginx:
    image: nginx:alpine
    networks:
      - public
      - app-tier
    ports:
      - "80:80"
      - "443:443"

  # Application (app-tier + data-tier)
  app:
    build: .
    networks:
      - app-tier
      - data-tier
      - cache-tier

  # Database (data-tier only / no external access)
  db:
    image: postgres:16-alpine
    networks:
      - data-tier

  # Redis (cache-tier only)
  redis:
    image: redis:7-alpine
    networks:
      - cache-tier

networks:
  public:
    driver: bridge
  app-tier:
    driver: bridge
  data-tier:
    driver: bridge
    internal: true     # Block all external access
  cache-tier:
    driver: bridge
    internal: true
```

### 7.2 Fixed IP Addresses

```yaml
services:
  app:
    networks:
      app-net:
        ipv4_address: 172.28.0.10

  db:
    networks:
      app-net:
        ipv4_address: 172.28.0.20

networks:
  app-net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/24
          gateway: 172.28.0.1
```

---

## 8. Advanced Configuration Comparison

| Feature | Basic | Advanced |
|---------|-------|----------|
| Service startup | `depends_on: [db]` | `depends_on: { db: { condition: service_healthy } }` |
| Environment variables | `environment: {KEY: val}` | `env_file` + `secrets` + priority management |
| Networking | Default | `internal: true` + multiple network isolation |
| Logging | Default (unlimited) | `json-file` + `max-size` + `max-file` |
| Resources | Unlimited | `deploy.resources.limits` for CPU/memory limits |
| Profiles | All services started | `profiles` for purpose-based grouping |
| Configuration management | Single file | `override.yml` + `prod.yml` layering |
| Healthcheck | None | Dedicated check per service + custom scripts |
| Secrets | Written directly in environment variables | `secrets` + `*_FILE` pattern |
| YAML reuse | Copy & paste | `x-` Extension Fields + anchors |

---

## 9. Useful Compose Command Reference

### 9.1 Daily Operations

```bash
# Check service status
docker compose ps
docker compose ps -a    # Include stopped containers

# View logs
docker compose logs -f              # Follow logs for all services
docker compose logs -f app worker   # Specific services only
docker compose logs --tail=50 app   # Last 50 lines
docker compose logs --since=1h      # Logs from the past 1 hour

# Restart services
docker compose restart app          # Restart app only
docker compose up -d --force-recreate app   # Force recreate

# Inspect configuration
docker compose config               # Show merged result
docker compose config --services    # List services
docker compose config --volumes     # List volumes

# Build images
docker compose build                # Build all services
docker compose build --no-cache     # Build without cache
docker compose build --parallel     # Build in parallel
docker compose build app worker     # Specific services only

# Execute commands in containers
docker compose exec app sh                  # Open a shell
docker compose exec -T app npm run migrate  # No TTY (for scripts)
docker compose run --rm app npm test         # One-shot execution
```

### 9.2 Cleanup

```bash
# Stop services
docker compose stop                 # Stop only
docker compose down                 # Stop + remove containers
docker compose down -v              # Stop + remove containers + volumes
docker compose down --remove-orphans # Remove orphaned containers as well
docker compose down --rmi local     # Remove local images as well
docker compose down -v --rmi all    # Remove everything

# Stop specific services only
docker compose stop app
docker compose rm -f app
```

---

## Anti-Patterns

### Anti-Pattern 1: depends_on Without a Healthcheck

```yaml
# BAD: no condition specified → mistakenly assumes container started = service ready
services:
  app:
    depends_on:
      - db         # app starts the instant the DB container starts
                   # → DB is not yet accepting connections, app crashes

# GOOD: use healthcheck + condition to wait reliably
services:
  app:
    depends_on:
      db:
        condition: service_healthy
  db:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
```

**Problem**: It takes several seconds to tens of seconds after a PostgreSQL container starts before it actually begins accepting connections. Without a healthcheck, the app crashes with a connection error and requires a manual restart.

### Anti-Pattern 2: No Log Rotation

```yaml
# BAD: no logging config → disk exhaustion
services:
  app:
    image: myapp:latest
    # logging not set → json-file driver with unlimited size

# GOOD: configure log size and rotation
services:
  app:
    image: myapp:latest
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

**Problem**: Docker's default log driver (json-file) accumulates logs without a size limit. For long-running services, log files will fill the disk, eventually exhausting the host machine's storage and bringing down the entire system.

### Anti-Pattern 3: Writing Secrets Directly in Environment Variables

```yaml
# BAD: password written directly in the file
services:
  db:
    environment:
      POSTGRES_PASSWORD: my_super_secret_password  # Gets committed to Git

# GOOD: use .env file or secrets
services:
  db:
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}  # Read from .env
    # or use secrets
    secrets:
      - db_password
```

**Problem**: Passwords hardcoded in `docker-compose.yml` will be committed to the Git repository, creating an extremely high risk of leakage. Add `.env` files to `.gitignore`, or use Docker's `secrets` feature.

### Anti-Pattern 4: Running Production Without Resource Limits

```yaml
# BAD: no resource limits → one service can exhaust all host resources
services:
  app:
    image: myapp:latest
    # deploy.resources not set

# GOOD: configure appropriate resource limits
services:
  app:
    image: myapp:latest
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 128M
```

**Problem**: If a memory leak or CPU runaway occurs, the lack of limits allows the entire host's resources to be exhausted, affecting other services and even SSH connectivity. Always set limits in production environments.


---

## Hands-On Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement appropriate error handling
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
        assert False, "例外が発生するべき"
    except ValueError:
        pass

    print("全テスト合格!")

test_exercise1()
```

### Exercise 2: Advanced Pattern

Extend the basic implementation by adding the following features.

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

**Key points:**
- Be mindful of algorithmic complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Misconfigured configuration file | Check the configuration file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Growing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check the executing user's permissions, review configuration |
| Data inconsistency | Concurrent processing conflict | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace to identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form a hypothesis**: List possible causes
4. **Incremental verification**: Use log output or a debugger to verify hypotheses
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
    """Decorator that logs function inputs and outputs"""
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

Diagnosis steps when a performance issue occurs:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check I/O wait**: Examine disk and network I/O status
4. **Check concurrent connections**: Inspect the connection pool state

| Problem type | Diagnostic tool | Countermeasure |
|--------------|-----------------|----------------|
| High CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Asynchronous I/O, caching |
| DB slowness | EXPLAIN, slow query log | Indexing, query optimization |
---

## FAQ

### Q1: What is the difference between YAML anchors and Extension Fields (x- prefix)?

**A**: YAML anchors (`&` / `*`) are a YAML-standard reference mechanism for reusing the same value in multiple places. Extension Fields (`x-` prefix) are a Compose spec feature that lets you define custom fields which Compose ignores. The common pattern is to combine both: define shared configuration at the top level with `x-common: &common`, then expand it in each service with `<<: *common`.

### Q2: Should I use profiles or multiple Compose files?

**A**: Use profiles when you want to group services by purpose within the same `docker-compose.yml` (e.g., debug tools, monitoring tools). Use multiple file overrides when you want to switch the entire environment configuration (development vs. production, whether ports are exposed, resource limits, etc.). You can also combine both approaches.

### Q3: What interpolation (variable expansion) syntax can be used in Compose?

**A**: `${VARIABLE}` is the basic form. For default values, use `${VARIABLE:-default}` (when unset or empty) or `${VARIABLE-default}` (when undefined only). To raise an error use `${VARIABLE:?error message}`. Values are taken from the `.env` file or shell environment variables. Note that values in the `environment:` section of the Compose file are expanded, but this is distinct from expansion inside the container.

### Q4: What is the `restart: true` option in depends_on?

**A**: Added in Compose V2.20+, this option causes the dependent service to automatically restart whenever the service it depends on is restarted. For example, use it when you want the app container to restart automatically whenever the DB container restarts.

```yaml
services:
  app:
    depends_on:
      db:
        condition: service_healthy
        restart: true    # Restart app when db restarts
```

### Q5: How should I set the healthcheck start_period?

**A**: Set `start_period` based on an estimate of the time needed for the service to initialize. Healthcheck failures during this window are not counted toward the retry limit. A rough guide is 30 seconds for PostgreSQL and 60 seconds for Elasticsearch. Measure how long it takes from `docker compose up` until the service actually responds in a test environment, then set the value to 1.5–2x that measured time for safety.

### Q6: What is the difference between Compose V2 and V1 (docker-compose command)?

**A**: Compose V2 is a Go-based plugin invoked as `docker compose` (no hyphen). V1 was a Python implementation invoked as `docker-compose` (with a hyphen) and reached EOL in 2023. In V2, the `version:` field is no longer needed, and many new features have been added including `profiles`, `watch`, and `include`. All new projects should use V2.

---

## Summary

| Topic | Key points |
|-------|-----------|
| Profiles | Group services with `profiles:` and start selectively with `--profile` |
| depends_on | Use `condition: service_healthy` to guarantee a reliable startup order |
| healthcheck | Configure appropriate check commands for each type: DB / Redis / HTTP |
| Environment variables | Use `.env` (Compose vars) + `env_file` (app vars) + `secrets` appropriately |
| File merging | Layer configuration with `override.yml` (development) + `prod.yml` (production) |
| YAML anchors | Use `x-` Extension Fields + anchors to keep configuration DRY |
| Resource limits | Use `deploy.resources.limits` to cap CPU and memory |
| Log management | Prevent disk exhaustion with `max-size` + `max-file` |
| Network isolation | Strengthen security with `internal: true` + multiple networks |
| Secret management | Manage sensitive information safely with `secrets` + `*_FILE` pattern |

## Further Reading

- [Compose Development Workflow](./02-development-workflow.md) -- Hot reload, debugging, CI integration
- [Docker Compose Basics](./00-compose-basics.md) -- Review of basic syntax
- [Container Security](../06-security/00-container-security.md) -- Security best practices

## References

1. **Compose Specification - Profiles** -- https://docs.docker.com/compose/profiles/ -- Official documentation for the profiles feature
2. **Compose Specification - Healthcheck** -- https://docs.docker.com/compose/compose-file/05-services/#healthcheck -- Detailed healthcheck configuration
3. **Environment variables in Compose** -- https://docs.docker.com/compose/environment-variables/ -- Environment variable priority and management
4. **Compose file merge** -- https://docs.docker.com/compose/multiple-compose-files/ -- Rules for merging multiple files
5. **Compose Specification - Extension Fields** -- https://docs.docker.com/compose/compose-file/11-extension/ -- Extension Fields specification
6. **Compose Specification - Secrets** -- https://docs.docker.com/compose/use-secrets/ -- Official documentation for secret management
7. **Docker Compose V2 Release Notes** -- https://docs.docker.com/compose/release-notes/ -- New features and changes in V2

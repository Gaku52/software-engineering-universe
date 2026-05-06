# Dockerizing Local Services

> Learn how to centrally manage development services such as PostgreSQL, MySQL, Redis, MailHog, and MinIO with Docker, and set up an infrastructure configuration where all team members can develop in an identical local environment.

## What You Will Learn

1. **Dockerizing Databases (PostgreSQL / MySQL)** -- Master the patterns for building development DB containers, including automatic injection of initial schemas and seed data
2. **Dockerizing Cache, Mail, and Storage** -- Learn how to configure a development infrastructure combining Redis, MailHog, and MinIO
3. **Integrated Management and Data Persistence with Docker Compose** -- Practice managing dependencies between multiple services, Volume design, and health checks

## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Dev Container](./01-devcontainer.md)

---

## 1. Overall Architecture

```
+------------------------------------------------------------------+
|              Local Development Services Architecture             |
+------------------------------------------------------------------+
|                                                                  |
|  [Application]                                                   |
|       |         |          |          |           |              |
|       v         v          v          v           v              |
|  +--------+ +--------+ +-------+ +--------+ +---------+         |
|  |Postgres| | MySQL  | | Redis | |MailHog | | MinIO   |         |
|  |  :5432 | |  :3306 | | :6379 | | :1025  | |  :9000  |         |
|  |        | |        | |       | | :8025  | |  :9001  |         |
|  +--------+ +--------+ +-------+ +--------+ +---------+         |
|       |         |          |          |           |              |
|       v         v          v          v           v              |
|  [pgdata]  [mysqldata] (ephemeral) (ephemeral) [miniodata]      |
|  Named Vol  Named Vol                          Named Vol        |
|                                                                  |
+------------------------------------------------------------------+
```

### 1.1 Criteria for Selecting Services

Which services to Dockerize for local development depends on the project requirements. Refer to the following flowchart as a guide.

```
+------------------------------------------------------------------+
|        Local Service Selection Flow                              |
+------------------------------------------------------------------+
|                                                                  |
|  Do you need an RDB?                                             |
|    |                                                             |
|    +--[Yes]--> Lots of JSON/array types? → PostgreSQL            |
|    |           Simple CRUD? → MySQL is also fine                 |
|    |           Already using MySQL? → Continue with MySQL        |
|    |                                                             |
|    +--[No]---> Do you need NoSQL?                                |
|                  |                                               |
|                  +--[Yes]--> MongoDB / DynamoDB Local            |
|                  +--[No]---> SQLite may be sufficient            |
|                                                                  |
|  Do you need caching? → Redis                                    |
|  Do you need a session store? → Redis                            |
|  Do you need mail send testing? → Mailpit (MailHog successor)    |
|  Do you need file uploads? → MinIO (S3 compatible)               |
|  Do you need full-text search? → Meilisearch or Elasticsearch    |
|  Do you need a message queue? → RabbitMQ or Redis Streams        |
|  Do you need auth testing? → Keycloak or mock-oauth2-server      |
|                                                                  |
+------------------------------------------------------------------+
```

### 1.2 Port Management Strategy

When using multiple projects or multiple databases simultaneously, a strategy to avoid port conflicts is necessary.

| Strategy | Description | Suitable Cases |
|----------|-------------|----------------|
| Offset per project | Project A: 5432, Project B: 5433 | Simultaneous development of 2-3 projects |
| Parameterize ports in `.env` | `${DB_PORT:-5432}` | Flexible team operation |
| Docker network isolation | No port exposure, container-to-container only | Dev Container environments |
| Exclusive management with profiles | `docker compose --profile projectA up` | Many projects |

```yaml
# Example of parameterizing ports in .env
# .env
POSTGRES_PORT=5432
REDIS_PORT=6379
MAIL_SMTP_PORT=1025
MAIL_UI_PORT=8025
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001
```

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "${POSTGRES_PORT:-5432}:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "${REDIS_PORT:-6379}:6379"
```

---

## 2. Dockerizing PostgreSQL

### 2.1 Basic Configuration

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    container_name: myapp-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: myapp_development
      POSTGRES_INITDB_ARGS: "--encoding=UTF-8 --lc-collate=C --lc-ctype=C"
      TZ: Asia/Tokyo
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/postgres/init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

volumes:
  pgdata:
    driver: local
```

### 2.2 Initialization Scripts

Files placed in `/docker-entrypoint-initdb.d/` are executed in alphabetical order on the first container startup. `.sql`, `.sql.gz`, and `.sh` files are supported.

```sql
-- docker/postgres/init/01-create-databases.sql
-- Automatically create development and test DBs

CREATE DATABASE myapp_test;

-- Test user
CREATE USER test_user WITH PASSWORD 'test_password';
GRANT ALL PRIVILEGES ON DATABASE myapp_test TO test_user;

-- Install extensions
\c myapp_development
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "hstore";

\c myapp_test
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

```bash
#!/bin/bash
# docker/postgres/init/02-seed-data.sh
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname myapp_development <<-EOSQL
  INSERT INTO users (name, email) VALUES
    ('開発太郎', 'dev@example.com'),
    ('テスト花子', 'test@example.com')
  ON CONFLICT DO NOTHING;
EOSQL
```

```sql
-- docker/postgres/init/03-create-schemas.sql
-- Schema separation pattern for multi-tenancy

\c myapp_development

-- Per-tenant schemas
CREATE SCHEMA IF NOT EXISTS tenant_demo;
CREATE SCHEMA IF NOT EXISTS tenant_test;

-- Shared tables (public schema)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    schema_name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.tenants (name, schema_name) VALUES
    ('Demo Company', 'tenant_demo'),
    ('Test Company', 'tenant_test')
ON CONFLICT DO NOTHING;
```

### 2.3 Customizing PostgreSQL Configuration

```conf
# docker/postgres/postgresql.conf (optimized for development)
# Performance (for development machines)
shared_buffers = 256MB
work_mem = 16MB
maintenance_work_mem = 128MB
effective_cache_size = 512MB

# WAL settings (for development)
wal_buffers = 16MB
checkpoint_completion_target = 0.9
max_wal_size = 1GB

# Logging (easy to debug)
log_statement = 'all'
log_duration = on
log_min_duration_statement = 100
log_line_prefix = '%t [%p] %u@%d '
log_lock_waits = on
log_temp_files = 0

# Development settings (do not use in production)
fsync = off
synchronous_commit = off
full_page_writes = off

# Connection settings
max_connections = 100
```

To apply a custom configuration file, specify it in the Compose file as follows.

```yaml
services:
  postgres:
    image: postgres:16-alpine
    command: >
      postgres
        -c config_file=/etc/postgresql/postgresql.conf
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/postgres/postgresql.conf:/etc/postgresql/postgresql.conf:ro
      - ./docker/postgres/init:/docker-entrypoint-initdb.d
```

### 2.4 PostgreSQL Backup and Restore

The procedure for saving and restoring the database state during development is as follows.

```bash
# Backup (dump)
docker compose exec postgres pg_dump -U postgres -d myapp_development \
  --format=custom --file=/tmp/backup.dump

# Copy to host
docker compose cp postgres:/tmp/backup.dump ./backups/

# Restore
docker compose cp ./backups/backup.dump postgres:/tmp/
docker compose exec postgres pg_restore -U postgres -d myapp_development \
  --clean --if-exists /tmp/backup.dump

# Text format dump (easy to manage with Git)
docker compose exec postgres pg_dump -U postgres -d myapp_development \
  --schema-only --no-owner --no-privileges > ./docker/postgres/schema.sql

# Data-only dump
docker compose exec postgres pg_dump -U postgres -d myapp_development \
  --data-only --inserts > ./docker/postgres/seed-data.sql
```

### 2.5 PostgreSQL Monitoring and Debugging

```bash
# Check running queries
docker compose exec postgres psql -U postgres -d myapp_development -c \
  "SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
   FROM pg_stat_activity
   WHERE state != 'idle' AND query NOT ILIKE '%pg_stat_activity%'
   ORDER BY duration DESC;"

# Check table sizes
docker compose exec postgres psql -U postgres -d myapp_development -c \
  "SELECT schemaname, tablename,
          pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size
   FROM pg_tables
   WHERE schemaname = 'public'
   ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;"

# Index usage statistics
docker compose exec postgres psql -U postgres -d myapp_development -c \
  "SELECT relname, indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
   FROM pg_stat_user_indexes
   ORDER BY idx_scan ASC;"

# Check connection count
docker compose exec postgres psql -U postgres -c \
  "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
```

### 2.6 Adding pgAdmin (GUI Management Tool)

```yaml
# Add to docker-compose.yml
services:
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: myapp-pgadmin
    restart: unless-stopped
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin
      PGADMIN_LISTEN_PORT: 5050
    ports:
      - "5050:5050"
    volumes:
      - pgadmin_data:/var/lib/pgadmin
      - ./docker/pgadmin/servers.json:/pgadmin4/servers.json:ro
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  pgadmin_data:
```

```json
// docker/pgadmin/servers.json (auto-connection settings)
{
  "Servers": {
    "1": {
      "Name": "Local Development",
      "Group": "Development",
      "Host": "postgres",
      "Port": 5432,
      "MaintenanceDB": "postgres",
      "Username": "postgres",
      "SSLMode": "prefer",
      "PassFile": "/tmp/pgpassfile"
    }
  }
}
```

---

## 3. Dockerizing MySQL

### 3.1 Basic Configuration

```yaml
# docker-compose.yml (MySQL version)
services:
  mysql:
    image: mysql:8.0
    container_name: myapp-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: myapp_development
      MYSQL_USER: developer
      MYSQL_PASSWORD: developer
      TZ: Asia/Tokyo
    ports:
      - "3306:3306"
    volumes:
      - mysqldata:/var/lib/mysql
      - ./docker/mysql/init:/docker-entrypoint-initdb.d
      - ./docker/mysql/my.cnf:/etc/mysql/conf.d/custom.cnf
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      timeout: 5s
      retries: 5
    command: >
      --default-authentication-plugin=mysql_native_password
      --character-set-server=utf8mb4
      --collation-server=utf8mb4_unicode_ci

volumes:
  mysqldata:
    driver: local
```

### 3.2 MySQL Custom Configuration

```ini
# docker/mysql/my.cnf
[mysqld]
# Character set
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

# Performance (for development)
innodb_buffer_pool_size = 256M
innodb_log_file_size = 64M
innodb_flush_log_at_trx_commit = 0
sync_binlog = 0
innodb_flush_method = O_DIRECT

# Logging
general_log = 1
general_log_file = /var/log/mysql/general.log
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 1

# Timezone
default-time-zone = '+09:00'

# Connection settings
max_connections = 100
wait_timeout = 28800
interactive_timeout = 28800

[client]
default-character-set = utf8mb4
```

### 3.3 MySQL Initialization Scripts

```sql
-- docker/mysql/init/01-create-databases.sql
CREATE DATABASE IF NOT EXISTS myapp_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Grant privileges to test user
GRANT ALL PRIVILEGES ON myapp_test.* TO 'developer'@'%';
FLUSH PRIVILEGES;
```

```sql
-- docker/mysql/init/02-create-tables.sql
USE myapp_development;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3.4 MySQL Backup and Restore

```bash
# Backup
docker compose exec mysql mysqldump -u root -proot \
  --single-transaction --routines --triggers \
  myapp_development > ./backups/mysql_backup.sql

# Restore
docker compose exec -T mysql mysql -u root -proot \
  myapp_development < ./backups/mysql_backup.sql

# Dump specific tables only
docker compose exec mysql mysqldump -u root -proot \
  myapp_development users orders > ./backups/partial_backup.sql

# Schema-only dump
docker compose exec mysql mysqldump -u root -proot \
  --no-data myapp_development > ./docker/mysql/schema.sql
```

### 3.5 Migrating to MySQL 8.4

In MySQL 8.4 LTS, `mysql_native_password` is deprecated and `caching_sha2_password` is now the default.

```yaml
# MySQL 8.4 LTS compatible
services:
  mysql:
    image: mysql:8.4
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: myapp_development
    # mysql_native_password is deprecated
    # Verify your application's MySQL client supports caching_sha2_password
    command: >
      --character-set-server=utf8mb4
      --collation-server=utf8mb4_unicode_ci
```

---

## 4. Dockerizing Redis

### 4.1 Basic Configuration

```yaml
# Add to docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    container_name: myapp-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - ./docker/redis/redis.conf:/usr/local/etc/redis/redis.conf
    command: redis-server /usr/local/etc/redis/redis.conf
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
```

### 4.2 Redis Configuration

```conf
# docker/redis/redis.conf (for development)
# Memory limit
maxmemory 128mb
maxmemory-policy allkeys-lru

# Persistence (disable if not needed in development)
save ""
appendonly no

# Logging
loglevel verbose

# Password (development environment)
# requirepass dev_redis_password

# Key expiry notifications (receive expiry events via Pub/Sub)
notify-keyspace-events Ex
```

### 4.3 Redis Configuration Patterns by Use Case

#### When Using as a Session Store

```conf
# docker/redis/redis-session.conf
# Session data requires persistence
save 60 1000
save 300 100
appendonly yes
appendfsync everysec

maxmemory 256mb
maxmemory-policy volatile-lru
```

#### When Using as a Cache

```conf
# docker/redis/redis-cache.conf
# Cache does not require persistence
save ""
appendonly no

maxmemory 512mb
maxmemory-policy allkeys-lfu
```

#### When Using as a Job Queue (BullMQ / Sidekiq)

```conf
# docker/redis/redis-queue.conf
# Job data requires persistence
save 60 1
appendonly yes
appendfsync everysec

maxmemory 256mb
maxmemory-policy noeviction  # Do not evict queue data
```

### 4.4 Redis Monitoring and Debugging

```bash
# Display Redis information
docker compose exec redis redis-cli INFO

# Memory usage
docker compose exec redis redis-cli INFO memory

# Real-time command monitoring
docker compose exec redis redis-cli MONITOR

# List keys (development environment only)
docker compose exec redis redis-cli KEYS "*"

# Check the content of a specific key
docker compose exec redis redis-cli GET "session:abc123"
docker compose exec redis redis-cli HGETALL "user:1"

# Check key expiry
docker compose exec redis redis-cli TTL "cache:products"

# Delete all keys (development environment only)
docker compose exec redis redis-cli FLUSHALL

# Check slow queries
docker compose exec redis redis-cli SLOWLOG GET 10
```

### 4.5 Connecting Redis from Your Application

```typescript
// config/redis.ts
import { Redis } from 'ioredis';

function createRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    // Auto-reconnect on connection drop
    reconnectOnError(err) {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    },
  });

  client.on('error', (err) => {
    console.error('Redis connection error:', err);
  });

  client.on('connect', () => {
    console.log('Redis connected');
  });

  return client;
}

export const redis = createRedisClient();
```

### 4.6 RedisInsight (GUI Management Tool)

```yaml
# Add to docker-compose.yml
services:
  redis-insight:
    image: redis/redisinsight:latest
    container_name: myapp-redis-insight
    restart: unless-stopped
    ports:
      - "5540:5540"
    volumes:
      - redisinsight_data:/data
    depends_on:
      redis:
        condition: service_healthy

volumes:
  redisinsight_data:
```

---

## 5. MailHog / Mailpit (Mail Testing)

### 5.1 Mailpit (Recommended -- MailHog Successor)

MailHog is no longer maintained, so its successor Mailpit is recommended. It has API compatibility, making migration straightforward.

```yaml
# Add to docker-compose.yml
services:
  mailpit:
    image: axllent/mailpit:latest
    container_name: myapp-mailpit
    restart: unless-stopped
    ports:
      - "1025:1025"    # SMTP server
      - "8025:8025"    # Web UI
    environment:
      MP_SMTP_AUTH_ACCEPT_ANY: 1
      MP_SMTP_AUTH_ALLOW_INSECURE: 1
      MP_MAX_MESSAGES: 5000
      MP_DATABASE: /data/mailpit.db
      MP_SMTP_RELAY_CONFIG: ""
    volumes:
      - mailpit_data:/data

volumes:
  mailpit_data:
```

### 5.2 MailHog (Legacy)

The configuration for projects that are still using MailHog is as follows.

```yaml
# Add to docker-compose.yml
services:
  mailhog:
    image: mailhog/mailhog:latest
    container_name: myapp-mailhog
    restart: unless-stopped
    ports:
      - "1025:1025"    # SMTP server
      - "8025:8025"    # Web UI
    environment:
      MH_STORAGE: memory
      MH_SMTP_BIND_ADDR: 0.0.0.0:1025
      MH_UI_BIND_ADDR: 0.0.0.0:8025
```

### 5.3 Connection Settings from Your Application

```typescript
// config/mail.ts
import nodemailer from 'nodemailer';

function createMailTransport() {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    // Mailpit / MailHog (SMTP compatible)
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '1025'),
      secure: false,
      // Mailpit / MailHog require no authentication
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  // Production environment
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export const mailTransport = createMailTransport();
```

```python
# config/mail.py (Python / Django)
import os

if os.getenv('ENVIRONMENT', 'development') == 'development':
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = os.getenv('SMTP_HOST', 'localhost')
    EMAIL_PORT = int(os.getenv('SMTP_PORT', '1025'))
    EMAIL_USE_TLS = False
    EMAIL_HOST_USER = ''
    EMAIL_HOST_PASSWORD = ''
else:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = os.getenv('SMTP_HOST')
    EMAIL_PORT = int(os.getenv('SMTP_PORT', '587'))
    EMAIL_USE_TLS = True
    EMAIL_HOST_USER = os.getenv('SMTP_USER')
    EMAIL_HOST_PASSWORD = os.getenv('SMTP_PASS')
```

### 5.4 Using the Mailpit API (E2E Testing)

You can use the Mailpit API to verify email sending in E2E tests.

```typescript
// tests/helpers/mail.ts
interface MailpitMessage {
  ID: string;
  From: { Address: string; Name: string };
  To: { Address: string; Name: string }[];
  Subject: string;
  Snippet: string;
  Created: string;
}

interface MailpitSearchResult {
  total: number;
  messages: MailpitMessage[];
}

export async function waitForEmail(
  to: string,
  subject?: string,
  timeout = 10000
): Promise<MailpitMessage> {
  const startTime = Date.now();
  const mailpitUrl = process.env.MAILPIT_URL || 'http://localhost:8025';

  while (Date.now() - startTime < timeout) {
    const query = subject
      ? `to:${to} subject:"${subject}"`
      : `to:${to}`;

    const res = await fetch(
      `${mailpitUrl}/api/v1/search?query=${encodeURIComponent(query)}`
    );
    const data: MailpitSearchResult = await res.json();

    if (data.total > 0) {
      return data.messages[0];
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Email not received within ${timeout}ms`);
}

export async function getEmailHtml(messageId: string): Promise<string> {
  const mailpitUrl = process.env.MAILPIT_URL || 'http://localhost:8025';
  const res = await fetch(`${mailpitUrl}/api/v1/message/${messageId}`);
  const data = await res.json();
  return data.HTML;
}

export async function deleteAllEmails(): Promise<void> {
  const mailpitUrl = process.env.MAILPIT_URL || 'http://localhost:8025';
  await fetch(`${mailpitUrl}/api/v1/messages`, { method: 'DELETE' });
}
```

```typescript
// tests/e2e/password-reset.test.ts
import { test, expect } from '@playwright/test';
import { waitForEmail, getEmailHtml, deleteAllEmails } from '../helpers/mail';

test.beforeEach(async () => {
  await deleteAllEmails();
});

test('パスワードリセットメールが送信される', async ({ page }) => {
  // パスワードリセットを要求
  await page.goto('/forgot-password');
  await page.fill('[name="email"]', 'user@example.com');
  await page.click('button[type="submit"]');

  // メールが届くまで待機
  const email = await waitForEmail('user@example.com', 'パスワードリセット');

  expect(email.Subject).toContain('パスワードリセット');

  // メール本文からリセットリンクを取得
  const html = await getEmailHtml(email.ID);
  const resetLink = html.match(/href="([^"]*reset-password[^"]*)"/)?.[1];

  expect(resetLink).toBeTruthy();

  // リセットリンクにアクセス
  await page.goto(resetLink!);
  await expect(page.locator('h1')).toContainText('新しいパスワード');
});
```

---

## 6. MinIO (S3 Compatible Storage)

### 6.1 Configuration

```yaml
# Add to docker-compose.yml
services:
  minio:
    image: minio/minio:latest
    container_name: myapp-minio
    restart: unless-stopped
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"    # API
      - "9001:9001"    # Console
    volumes:
      - miniodata:/data
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Initial bucket creation
  minio-init:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 minioadmin minioadmin;
      mc mb local/uploads --ignore-existing;
      mc mb local/avatars --ignore-existing;
      mc mb local/documents --ignore-existing;
      mc anonymous set download local/avatars;
      mc ilm rule add local/uploads --expire-days 30;
      echo 'MinIO buckets initialized';
      "

volumes:
  miniodata:
    driver: local
```

### 6.2 Connecting with the AWS SDK

```typescript
// config/storage.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function createStorageClient(): S3Client {
  if (process.env.NODE_ENV === 'development') {
    return new S3Client({
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
      },
      forcePathStyle: true, // Path style is required for MinIO
    });
  }

  // Production uses standard S3
  return new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-1' });
}

export const storageClient = createStorageClient();

// File upload
export async function uploadFile(
  bucket: string,
  key: string,
  body: Buffer | ReadableStream,
  contentType: string
): Promise<string> {
  await storageClient.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  if (process.env.NODE_ENV === 'development') {
    return `http://localhost:9000/${bucket}/${key}`;
  }
  return `https://${bucket}.s3.amazonaws.com/${key}`;
}

// Generate presigned URL
export async function getPresignedUrl(
  bucket: string,
  key: string,
  expiresIn = 3600
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(storageClient, command, { expiresIn });
}

// Delete file
export async function deleteFile(bucket: string, key: string): Promise<void> {
  await storageClient.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: key })
  );
}
```

### 6.3 MinIO Management Commands

```bash
# Configure MinIO Client (mc)
docker compose exec minio mc alias set local http://localhost:9000 minioadmin minioadmin

# List buckets
docker compose exec minio mc ls local

# List objects in a bucket
docker compose exec minio mc ls local/uploads --recursive

# Upload a file (from host)
docker compose exec minio mc cp /data/test.jpg local/uploads/test.jpg

# Check bucket policy
docker compose exec minio mc anonymous get local/avatars

# Bucket statistics
docker compose exec minio mc stat local/uploads

# Delete all objects
docker compose exec minio mc rm --recursive --force local/uploads
```

---

## 7. Additional Services

### 7.1 Elasticsearch / OpenSearch

```yaml
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.12.0
    container_name: myapp-elasticsearch
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
    volumes:
      - esdata:/usr/share/elasticsearch/data
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9200/_cluster/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Kibana (management UI)
  kibana:
    image: docker.elastic.co/kibana/kibana:8.12.0
    container_name: myapp-kibana
    ports:
      - "5601:5601"
    environment:
      ELASTICSEARCH_HOSTS: '["http://elasticsearch:9200"]'
    depends_on:
      elasticsearch:
        condition: service_healthy

volumes:
  esdata:
```

### 7.2 Meilisearch (Lightweight Full-Text Search)

Meilisearch is a suitable alternative when Elasticsearch is too heavy.

```yaml
services:
  meilisearch:
    image: getmeili/meilisearch:v1.6
    container_name: myapp-meilisearch
    restart: unless-stopped
    environment:
      MEILI_ENV: development
      MEILI_MASTER_KEY: dev_master_key
      MEILI_NO_ANALYTICS: true
    ports:
      - "7700:7700"
    volumes:
      - meilidata:/meili_data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7700/health"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  meilidata:
```

### 7.3 RabbitMQ (Message Queue)

```yaml
services:
  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    container_name: myapp-rabbitmq
    restart: unless-stopped
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    ports:
      - "5672:5672"    # AMQP
      - "15672:15672"  # Management UI
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "check_port_connectivity"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  rabbitmq_data:
```

### 7.4 MongoDB

```yaml
services:
  mongodb:
    image: mongo:7.0
    container_name: myapp-mongodb
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: root
      MONGO_INITDB_ROOT_PASSWORD: root
      MONGO_INITDB_DATABASE: myapp_development
    ports:
      - "27017:27017"
    volumes:
      - mongodata:/data/db
      - ./docker/mongo/init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 5s
      timeout: 3s
      retries: 5

  # Mongo Express (management UI)
  mongo-express:
    image: mongo-express:latest
    container_name: myapp-mongo-express
    restart: unless-stopped
    ports:
      - "8081:8081"
    environment:
      ME_CONFIG_MONGODB_ADMINUSERNAME: root
      ME_CONFIG_MONGODB_ADMINPASSWORD: root
      ME_CONFIG_MONGODB_URL: mongodb://root:root@mongodb:27017/
      ME_CONFIG_BASICAUTH_USERNAME: admin
      ME_CONFIG_BASICAUTH_PASSWORD: admin
    depends_on:
      mongodb:
        condition: service_healthy

volumes:
  mongodata:
```

### 7.5 Keycloak (Authentication Server)

Use Keycloak for testing OAuth2 / OpenID Connect.

```yaml
services:
  keycloak:
    image: quay.io/keycloak/keycloak:24.0
    container_name: myapp-keycloak
    restart: unless-stopped
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres:5432/keycloak
      KC_DB_USERNAME: postgres
      KC_DB_PASSWORD: postgres
    ports:
      - "8080:8080"
    command: start-dev
    depends_on:
      postgres:
        condition: service_healthy
```

### 7.6 LocalStack (AWS Service Emulator)

```yaml
services:
  localstack:
    image: localstack/localstack:latest
    container_name: myapp-localstack
    restart: unless-stopped
    environment:
      SERVICES: s3,sqs,sns,dynamodb,ses,lambda
      DEBUG: 1
      DEFAULT_REGION: ap-northeast-1
    ports:
      - "4566:4566"      # Gateway
      - "4510-4559:4510-4559"  # Service ports
    volumes:
      - localstack_data:/var/lib/localstack
      - /var/run/docker.sock:/var/run/docker.sock
      - ./docker/localstack/init:/etc/localstack/init/ready.d

volumes:
  localstack_data:
```

```bash
#!/bin/bash
# docker/localstack/init/init-aws.sh
# LocalStack initialization script

# Create S3 buckets
awslocal s3 mb s3://uploads
awslocal s3 mb s3://avatars

# Create SQS queues
awslocal sqs create-queue --queue-name email-queue
awslocal sqs create-queue --queue-name notification-queue

# Create DynamoDB table
awslocal dynamodb create-table \
  --table-name Sessions \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

echo "LocalStack initialization complete"
```

---

## 8. Integrated Docker Compose

### 8.1 Complete Configuration Example

```yaml
# docker-compose.yml (integrated version)
services:
  postgres:
    image: postgres:16-alpine
    container_name: myapp-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: myapp_development
      TZ: Asia/Tokyo
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/postgres/init:/docker-entrypoint-initdb.d
      - ./docker/postgres/postgresql.conf:/etc/postgresql/postgresql.conf:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    command: postgres -c config_file=/etc/postgresql/postgresql.conf

  redis:
    image: redis:7-alpine
    container_name: myapp-redis
    restart: unless-stopped
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - ./docker/redis/redis.conf:/usr/local/etc/redis/redis.conf:ro
    command: redis-server /usr/local/etc/redis/redis.conf
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  mailpit:
    image: axllent/mailpit:latest
    container_name: myapp-mailpit
    restart: unless-stopped
    ports:
      - "${MAIL_SMTP_PORT:-1025}:1025"
      - "${MAIL_UI_PORT:-8025}:8025"
    environment:
      MP_SMTP_AUTH_ACCEPT_ANY: 1
      MP_SMTP_AUTH_ALLOW_INSECURE: 1
      MP_MAX_MESSAGES: 5000

  minio:
    image: minio/minio:latest
    container_name: myapp-minio
    restart: unless-stopped
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "${MINIO_API_PORT:-9000}:9000"
      - "${MINIO_CONSOLE_PORT:-9001}:9001"
    volumes:
      - miniodata:/data
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 5

  minio-init:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    restart: "no"
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 minioadmin minioadmin;
      mc mb local/uploads --ignore-existing;
      mc mb local/avatars --ignore-existing;
      mc anonymous set download local/avatars;
      echo 'MinIO buckets initialized';
      "

volumes:
  pgdata:
  miniodata:
```

### 8.2 Service Isolation Using Profiles

```yaml
# docker-compose.yml (with profiles)
services:
  postgres:
    image: postgres:16-alpine
    # ... (basic settings)
    profiles: ["db", "full"]

  mysql:
    image: mysql:8.0
    # ... (basic settings)
    profiles: ["mysql", "full"]

  redis:
    image: redis:7-alpine
    # ... (basic settings)
    profiles: ["cache", "full"]

  mailpit:
    image: axllent/mailpit:latest
    # ... (basic settings)
    profiles: ["mail", "full"]

  minio:
    image: minio/minio:latest
    # ... (basic settings)
    profiles: ["storage", "full"]

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.12.0
    # ... (basic settings)
    profiles: ["search", "full"]
```

```bash
# Start only the necessary services
docker compose --profile db --profile cache up -d

# Start all services
docker compose --profile full up -d
```

### 8.3 Simplifying Operations with a Makefile

```makefile
# Makefile
.PHONY: up down restart logs status clean db-shell redis-shell psql

# Start services
up:
	docker compose up -d

# Stop services
down:
	docker compose down

# Restart services
restart:
	docker compose restart

# Show logs
logs:
	docker compose logs -f

# Logs for a specific service
logs-%:
	docker compose logs -f $*

# Check status
status:
	docker compose ps

# Database shell
db-shell:
	docker compose exec postgres psql -U postgres -d myapp_development

# Redis shell
redis-shell:
	docker compose exec redis redis-cli

# MySQL shell
mysql-shell:
	docker compose exec mysql mysql -u root -proot myapp_development

# Reset database
db-reset:
	docker compose down -v
	docker compose up -d postgres
	@echo "Waiting for PostgreSQL to be ready..."
	@sleep 5
	@echo "Database reset complete"

# Delete all data
clean:
	docker compose down -v --remove-orphans
	docker volume prune -f

# Backup
backup:
	@mkdir -p backups
	docker compose exec postgres pg_dump -U postgres -d myapp_development \
		--format=custom > backups/backup_$(shell date +%Y%m%d_%H%M%S).dump
	@echo "Backup created"

# Restore (usage: make restore FILE=backups/backup_xxx.dump)
restore:
	docker compose exec -T postgres pg_restore -U postgres -d myapp_development \
		--clean --if-exists < $(FILE)
	@echo "Restore complete"
```

---

## 9. Local Service Connection Reference

```
+------------------------------------------------------------------+
|           Local Service Connection Reference                     |
+------------------------------------------------------------------+
| Service      | Host:Port           | UI / Admin Panel            |
|-------------|--------------------|-----------------------------|
| PostgreSQL  | localhost:5432     | pgAdmin (localhost:5050)    |
| MySQL       | localhost:3306     | phpMyAdmin or DBeaver       |
| Redis       | localhost:6379     | RedisInsight (localhost:5540)|
| Mailpit     | localhost:1025(SMTP)| http://localhost:8025       |
| MinIO       | localhost:9000(API) | http://localhost:9001       |
| Elasticsearch| localhost:9200    | Kibana (localhost:5601)     |
| Meilisearch | localhost:7700     | http://localhost:7700       |
| RabbitMQ    | localhost:5672     | http://localhost:15672      |
| MongoDB     | localhost:27017    | Mongo Express (localhost:8081)|
| Keycloak    | localhost:8080     | http://localhost:8080/admin |
| LocalStack  | localhost:4566     | -                           |
+------------------------------------------------------------------+
```

### Service Selection Guide

| Requirement | Recommended Service | Alternative | Notes |
|-------------|--------------------|-----------|----|
| RDB (general) | PostgreSQL 16 | MySQL 8.0 | Rich JSON and array types |
| RDB (legacy) | MySQL 8.0 | MariaDB 11 | Compatibility with existing assets |
| Cache | Redis 7 | Memcached | Pub/Sub also available |
| Session | Redis 7 | PostgreSQL | Enable persistence settings |
| Mail testing | Mailpit | MailHog (deprecated) | API-based test verification available |
| S3-compatible storage | MinIO | LocalStack | Lightweight and fast |
| AWS in general | LocalStack | - | Emulates multiple services |
| Full-text search (lightweight) | Meilisearch | - | Easy to set up |
| Full-text search (advanced) | Elasticsearch | OpenSearch | Rich aggregation and analytics |
| Message queue | RabbitMQ | Redis Streams | Complex routing |
| NoSQL | MongoDB 7 | DynamoDB (LocalStack) | Document DB |
| Auth testing | Keycloak | mock-oauth2-server | Full OAuth2/OIDC support |

---

## 10. Health Checks and Service Startup Order

### 10.1 Importance of Health Checks

`depends_on` alone only guarantees container "startup" and does not wait until the service becomes "usable." By combining `healthcheck` with `condition: service_healthy`, a reliable startup order is achieved.

```yaml
services:
  app:
    build: .
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      mailpit:
        condition: service_started  # For services that don't need a health check

  postgres:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s  # Do not check during initialization

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
```

### 10.2 Application-Side Retry Logic

Do not rely solely on health checks; implement retry logic on the application side as well.

```typescript
// lib/db.ts
import { PrismaClient } from '@prisma/client';

async function createPrismaClient(maxRetries = 5): Promise<PrismaClient> {
  const prisma = new PrismaClient();

  for (let i = 0; i < maxRetries; i++) {
    try {
      await prisma.$connect();
      console.log('Database connected');
      return prisma;
    } catch (error) {
      console.log(`Database connection attempt ${i + 1}/${maxRetries} failed`);
      if (i === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  throw new Error('Failed to connect to database');
}

export const prisma = await createPrismaClient();
```

---

## Anti-Patterns

### Anti-Pattern 1: Operating a Database Without Volumes

```yaml
# NG: No Volume set → all data lost on docker-compose down
services:
  postgres:
    image: postgres:16-alpine
    # volumes not configured

# OK: Persist data with named Volumes
services:
  postgres:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
    driver: local
```

**Problem**: Without Volumes, all database data is lost when running `docker-compose down` or `docker-compose rm`. Test data and migration state accumulated during development are lost, and rebuilding takes time.

### Anti-Pattern 2: Using Production Credentials Locally

```yaml
# NG: Using production credentials as-is
services:
  postgres:
    environment:
      POSTGRES_PASSWORD: ${PROD_DB_PASSWORD}  # Production password

# OK: Fixed password dedicated to development
services:
  postgres:
    environment:
      POSTGRES_PASSWORD: postgres  # Development only
```

**Problem**: If production credentials remain in the local environment, there is a risk of leakage through committing `docker-compose.yml` or accidentally sharing `.env`. Use fixed, simple passwords in development environments and keep them completely separate from production.

### Anti-Pattern 3: Managing Database Data with Bind Mounts

```yaml
# NG: Bind mount (slow I/O + permission issues)
services:
  postgres:
    volumes:
      - ./data/postgres:/var/lib/postgresql/data

# OK: Named Volume (fast + no permission issues)
services:
  postgres:
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

**Problem**: On macOS / Windows, bind mount I/O performance is poor and significantly impacts database write performance in particular. Permission mismatches between the container's UID/GID and the host can also occur frequently. Named Volumes avoid these problems.

### Anti-Pattern 4: depends_on Without Health Checks

```yaml
# NG: No health check → app tries to connect before DB is ready
services:
  app:
    depends_on:
      - postgres  # Only guarantees container startup

# OK: Guarantee startup completion with health checks
services:
  app:
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
```

**Problem**: `depends_on` only guarantees the container startup order. Even after a PostgreSQL container starts, it takes several seconds until initialization scripts finish running and the socket starts listening. If the application tries to connect during this time, a connection error occurs.

### Anti-Pattern 5: Using the latest Tag for Production-Equivalent Services

```yaml
# NG: Version is indeterminate
services:
  postgres:
    image: postgres:latest
  redis:
    image: redis:latest

# OK: Pin major versions
services:
  postgres:
    image: postgres:16-alpine
  redis:
    image: redis:7-alpine
```

**Problem**: The `latest` tag may fetch a different version at the time of `docker pull`. If versions differ between team members, compatibility issues and data format inconsistencies can arise. Pin the major version and intentionally update minor versions.

---

## FAQ

### Q1: Database I/O is slow on Docker for Mac/Windows. How can I improve it?

**A**: Using named Volumes is the most effective approach. Bind mounts (`./data:/var/lib/postgresql/data`) have significant filesystem conversion overhead on macOS/Windows. Named Volumes use the native filesystem inside the Docker VM, greatly improving I/O performance. For PostgreSQL, adding `fsync=off` and `synchronous_commit=off` as development-only settings is also effective. On macOS, using OrbStack is also worth considering.

### Q2: What should I do when I want to use the same port (e.g., 5432) across multiple projects?

**A**: Offset ports per project (`5432`, `5433`, `5434`, etc.) or use Docker Compose profiles to start them exclusively. Another approach is to manage a single shared development infrastructure for all projects in one `docker-compose.yml` and isolate by database name. When using Dev Containers, port conflicts do not occur because access is made via Docker network from inside the container. Parameterizing port numbers in `.env` files is also an effective strategy.

### Q3: Should I use Mailpit instead of MailHog?

**A**: Yes. MailHog is no longer maintained, and Mailpit is actively developed as its successor. Mailpit has API compatibility with MailHog, is faster, and has improved HTML mail rendering and attachment display. The Docker image is `axllent/mailpit`, and migration is possible with the same settings: SMTP port `1025` and Web UI `8025`. Furthermore, Mailpit has a rich search API, making it excellent for email verification in E2E tests.

### Q4: What is the difference between docker compose down and docker compose stop?

**A**: `docker compose stop` only stops containers; containers and networks are retained. You can resume quickly with `docker compose start` next time. On the other hand, `docker compose down` removes containers and networks. Adding the `-v` flag also removes Volumes. It is efficient to use `stop` / `start` during development and only use `down` when you want to reset the environment.

### Q5: Why aren't initialization scripts re-executed?

**A**: PostgreSQL / MySQL initialization scripts (`docker-entrypoint-initdb.d/`) are only executed when the data directory is empty. They are skipped if data remains in the Volume. To re-run initialization scripts, you need to delete and recreate the Volume: `docker compose down -v && docker compose up -d`.

### Q6: How do I choose between LocalStack and MinIO?

**A**: MinIO is specialized for S3-compatible storage and is lightweight and fast. If you only need S3, MinIO is recommended. LocalStack emulates many AWS services beyond S3, including SQS, SNS, DynamoDB, Lambda, and SES. LocalStack is suitable when you use multiple AWS services. However, some services in LocalStack are only supported in the Pro (paid) version.

### Q7: What is the best way to manage test databases?

**A**: There are three patterns:
1. **Create a separate test DB**: Create `myapp_test` DB in initialization scripts and run migrations before test execution
2. **Reset per test**: Start a transaction before each test and roll back after completion
3. **Dedicated test container**: Start a dedicated container with `docker compose --profile test up -d`

The most common approach is a combination of Pattern 1 + Pattern 2: prepare the test DB with Pattern 1 and achieve test isolation with Pattern 2.

---

## Summary

| Item | Key Points |
|------|-----------|
| PostgreSQL | Auto-build development DB with alpine image + init scripts |
| MySQL | Manage `utf8mb4` + development performance settings via `my.cnf` |
| Redis | Separate configuration by use case (cache / session / queue) |
| Mailpit | MailHog successor. Ideal for SMTP testing + API test verification |
| MinIO | S3-compatible API. `forcePathStyle: true` is required |
| LocalStack | Emulation of multiple AWS services |
| Meilisearch | Lightweight full-text search. Alternative to Elasticsearch |
| Volume design | Use named Volumes for DB data. Avoid bind mounts |
| Health checks | Set `healthcheck` for all services to guarantee dependency order |
| Port management | Parameterize with `.env`, or use profiles for exclusive management |
| Profiles | Use `--profile` to start only needed services |
| Makefile | Simplify frequently used commands |
| Backup | Manage schema and data with `pg_dump` / `mysqldump` |
| GUI tools | Add pgAdmin / RedisInsight / Kibana as needed |

## Guides to Read Next

- [Dev Container](./01-devcontainer.md) -- Integrate Docker development environment with VS Code / Codespaces
- Docker Compose Basics -- Compose file syntax and design patterns
- [Project Standards](../03-team-setup/00-project-standards.md) -- Managing shared configuration files across teams

## References

1. **Docker Hub Official Images** -- https://hub.docker.com/ -- Official images and configuration options for PostgreSQL, MySQL, Redis, etc.
2. **Mailpit Official** -- https://mailpit.axllent.org/ -- SMTP testing tool, successor to MailHog
3. **MinIO Official Documentation** -- https://min.io/docs/minio/container/index.html -- MinIO Docker deployment and client configuration
4. **Docker Compose Official Reference** -- https://docs.docker.com/compose/compose-file/ -- Detailed Compose file specification
5. **LocalStack Official** -- https://localstack.cloud/ -- Local emulation of AWS services
6. **Meilisearch Official** -- https://www.meilisearch.com/ -- Lightweight full-text search engine
7. **Redis Official Documentation** -- https://redis.io/docs/ -- Redis configuration and command reference

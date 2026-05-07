# Docker Compose Development Workflow

> Learn practical patterns for optimizing your daily development workflow with Docker Compose, including hot reload, debugger attachment, and CI integration.

## What You Will Learn

1. **Hot Reload and File Sync Optimization** -- Achieve instant reflection of code changes inside containers and build a comfortable development experience
2. **Setting Up a Debug Environment** -- Learn how to attach a debugger from VS Code / JetBrains to processes running inside containers
3. **CI/CD Pipeline Integration** -- Incorporate Docker Compose into your CI/CD for testing and building to ensure environment consistency
4. **E2E Test Environment Setup** -- Run browser tests using Playwright / Cypress on containers
5. **Scripts and Tools to Boost Development Efficiency** -- Automate daily tasks with Makefile, shell scripts, and pre-commit hooks


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Docker Compose Advanced (Compose Advanced)](./01-compose-advanced.md)

---

## 1. Overview of the Development Workflow

```
+------------------------------------------------------------------+
|              Docker Compose 開発ワークフロー                        |
+------------------------------------------------------------------+
|                                                                  |
|  [ローカル開発]                                                   |
|  1. git clone && make setup                                      |
|  2. docker compose up -d (DB, Redis 等)                          |
|  3. エディタでコード編集                                          |
|     → バインドマウントでコンテナに即時反映                         |
|     → ホットリロードで自動再読み込み                               |
|  4. デバッガ接続 (ブレークポイント)                                |
|  5. docker compose logs -f で確認                                |
|                                                                  |
|  [テスト]                                                        |
|  1. docker compose --profile test run --rm test-runner           |
|  2. テスト用 DB を自動作成 → テスト → 破棄                        |
|                                                                  |
|  [E2E テスト]                                                    |
|  1. docker compose --profile e2e up -d                          |
|  2. Playwright / Cypress でブラウザテスト実行                     |
|  3. スクリーンショット・動画の収集                                 |
|                                                                  |
|  [CI/CD]                                                         |
|  1. docker compose -f docker-compose.ci.yml up -d               |
|  2. テスト実行 → カバレッジ → ビルド                              |
|  3. docker compose down -v (クリーンアップ)                       |
|                                                                  |
+------------------------------------------------------------------+
```

---

## 2. Hot Reload Configuration

### 2.1 Node.js (Next.js / Vite) Hot Reload

```yaml
# docker-compose.yml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
      - "24678:24678"   # Vite HMR WebSocket ポート
    volumes:
      # ソースコードをバインドマウント
      - .:/app
      # node_modules はボリュームで分離 (パフォーマンス)
      - node_modules:/app/node_modules
    environment:
      # Vite: コンテナ外からの HMR 接続を許可
      VITE_HMR_HOST: localhost
      VITE_HMR_PORT: 24678
      # Next.js: ファイル監視に polling を使用
      WATCHPACK_POLLING: "true"
      # Chokidar: polling fallback
      CHOKIDAR_USEPOLLING: "true"
    command: npm run dev

volumes:
  node_modules:
```

### 2.2 Dockerfile.dev (for Development)

```dockerfile
# Dockerfile.dev
FROM node:20-alpine

WORKDIR /app

# 依存関係のみ先にコピー (キャッシュ活用)
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

# ソースコードはバインドマウントされるため COPY 不要
# COPY . . ← 開発用では不要

EXPOSE 3000

CMD ["pnpm", "dev"]
```

### 2.3 Python (FastAPI / Django) Hot Reload

```yaml
# docker-compose.yml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "8000:8000"
    volumes:
      - .:/app
    environment:
      PYTHONDONTWRITEBYTECODE: "1"
      PYTHONUNBUFFERED: "1"
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload --reload-dir /app/src
```

```dockerfile
# Dockerfile.dev (Python)
FROM python:3.12-slim

WORKDIR /app

# システム依存パッケージのインストール
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 依存関係のインストール
COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements-dev.txt

# ソースコードはバインドマウントで注入
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

### 2.4 Go Hot Reload (Air)

```yaml
# docker-compose.yml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "8080:8080"
    volumes:
      - .:/app
    command: air -c .air.toml
```

```toml
# .air.toml
root = "."
tmp_dir = "tmp"

[build]
cmd = "go build -o ./tmp/main ./cmd/server"
bin = "./tmp/main"
full_bin = "./tmp/main"
include_ext = ["go", "tpl", "tmpl", "html"]
exclude_dir = ["assets", "tmp", "vendor", "node_modules"]
delay = 1000
```

```dockerfile
# Dockerfile.dev (Go)
FROM golang:1.22-alpine

WORKDIR /app

# Air (ホットリロードツール) のインストール
RUN go install github.com/air-verse/air@latest

# 依存関係のダウンロード
COPY go.mod go.sum ./
RUN go mod download

EXPOSE 8080

CMD ["air", "-c", ".air.toml"]
```

### 2.5 Ruby on Rails Hot Reload

```yaml
# docker-compose.yml
services:
  web:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - bundle_cache:/usr/local/bundle
    environment:
      RAILS_ENV: development
      DATABASE_URL: postgresql://postgres:postgres@db:5432/myapp_dev
    depends_on:
      db:
        condition: service_healthy
    command: bin/rails server -b 0.0.0.0

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: postgres
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  bundle_cache:
  pgdata:
```

### 2.6 Docker Compose Watch (V2.22+)

```yaml
# docker-compose.yml (watch 機能)
services:
  app:
    build: .
    ports:
      - "3000:3000"
    develop:
      watch:
        # ソースファイル変更 → コンテナ内に同期
        - action: sync
          path: ./src
          target: /app/src
          ignore:
            - node_modules/
            - "**/*.test.ts"

        # package.json 変更 → rebuild
        - action: rebuild
          path: ./package.json

        # 設定ファイル変更 → コンテナ再起動
        - action: sync+restart
          path: ./config
          target: /app/config
```

```bash
# watch モードで起動
docker compose watch

# 通常起動 + watch
docker compose up -d && docker compose watch

# 特定サービスのみ watch
docker compose watch app
```

### 2.7 Docker Compose Watch Detailed Configuration Example

```yaml
# docker-compose.yml - フルスタックアプリの Watch 設定
services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    develop:
      watch:
        # TypeScript ソースの同期
        - action: sync
          path: ./frontend/src
          target: /app/src
          ignore:
            - "**/*.test.tsx"
            - "**/*.spec.tsx"
            - "**/__tests__/"
            - "**/__mocks__/"

        # 静的アセットの同期
        - action: sync
          path: ./frontend/public
          target: /app/public

        # package.json / lockfile 変更 → 再ビルド
        - action: rebuild
          path: ./frontend/package.json
        - action: rebuild
          path: ./frontend/pnpm-lock.yaml

        # Vite 設定変更 → 再起動
        - action: sync+restart
          path: ./frontend/vite.config.ts
          target: /app/vite.config.ts

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    develop:
      watch:
        - action: sync
          path: ./backend/src
          target: /app/src

        - action: sync+restart
          path: ./backend/config
          target: /app/config

        - action: rebuild
          path: ./backend/package.json
```

### 2.8 Comparison of File Sync Methods

| Method | Speed | Configuration Difficulty | Bidirectional | Use Case |
|--------|-------|--------------------------|---------------|----------|
| Bind Mount | macOS: slow / Linux: fast | Low | Yes | General development |
| Volume + sync | Medium | Medium | No | Performance improvement on macOS |
| Compose Watch | Fast | Low | No | Recommended for Compose V2.22+ |
| Mutagen | Very fast | Medium | Configurable | Large-scale projects on macOS |
| Docker Desktop VirtioFS | Fast | None needed | Yes | When using Docker Desktop |

---

## 3. Debug Environment

### 3.1 Node.js Debugging

```yaml
# docker-compose.yml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
      - "9229:9229"     # Node.js デバッガポート
    volumes:
      - .:/app
      - node_modules:/app/node_modules
    command: >
      node --inspect=0.0.0.0:9229 node_modules/.bin/next dev
    # または
    # command: node --inspect=0.0.0.0:9229 src/index.ts
```

### 3.2 VS Code launch.json

```jsonc
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Docker: Attach to Node",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "address": "localhost",
      "localRoot": "${workspaceFolder}",
      "remoteRoot": "/app",
      "restart": true,
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Docker: Debug Tests",
      "type": "node",
      "request": "attach",
      "port": 9230,
      "address": "localhost",
      "localRoot": "${workspaceFolder}",
      "remoteRoot": "/app",
      "restart": true
    }
  ]
}
```

### 3.3 Python Debugging (debugpy)

```yaml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "8000:8000"
      - "5678:5678"     # debugpy ポート
    volumes:
      - .:/app
    command: >
      python -m debugpy --listen 0.0.0.0:5678 --wait-for-client
      -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

```jsonc
// .vscode/launch.json (Python)
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Docker: Attach to Python",
      "type": "debugpy",
      "request": "attach",
      "connect": {
        "host": "localhost",
        "port": 5678
      },
      "pathMappings": [
        {
          "localRoot": "${workspaceFolder}",
          "remoteRoot": "/app"
        }
      ]
    }
  ]
}
```

### 3.4 Go Debugging (Delve)

```yaml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.debug
    ports:
      - "8080:8080"
      - "2345:2345"     # Delve デバッガポート
    volumes:
      - .:/app
    security_opt:
      - "seccomp:unconfined"   # Delve が ptrace を使用するために必要
    command: >
      dlv debug ./cmd/server --headless --listen=:2345
      --api-version=2 --accept-multiclient --continue
```

```dockerfile
# Dockerfile.debug (Go)
FROM golang:1.22

WORKDIR /app

# Delve デバッガのインストール
RUN go install github.com/go-delve/delve/cmd/dlv@latest

COPY go.mod go.sum ./
RUN go mod download

COPY . .

EXPOSE 8080 2345

CMD ["dlv", "debug", "./cmd/server", "--headless", "--listen=:2345", "--api-version=2", "--accept-multiclient", "--continue"]
```

```jsonc
// .vscode/launch.json (Go)
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Docker: Attach to Go (Delve)",
      "type": "go",
      "request": "attach",
      "mode": "remote",
      "remotePath": "/app",
      "port": 2345,
      "host": "127.0.0.1",
      "showLog": true
    }
  ]
}
```

### 3.5 Remote Debugging with JetBrains IDEs

Remote debugging configuration in JetBrains IDEs (IntelliJ IDEA, GoLand, PyCharm, WebStorm) follows these steps.

```
1. Run → Edit Configurations → + (Add)
2. Select "Remote JVM Debug" (Java) / "Go Remote" (Go) / "Python Debug Server" (Python)
3. Configuration:
   - Host: localhost
   - Port: <debugger port> (e.g. 9229, 5678, 2345)
   - Path mappings: local path ↔ path inside container
4. Start the container with docker compose up -d
5. Attach with Run → Debug
```

### 3.6 Debugging Troubleshooting

```bash
# デバッガポートが開いているか確認
docker compose exec app sh -c "netstat -tlnp | grep 9229"

# デバッグモードでプロセスが起動しているか確認
docker compose exec app ps aux | grep inspect

# ネットワーク接続テスト（ホスト側から）
nc -zv localhost 9229

# コンテナのログでデバッグ情報を確認
docker compose logs -f app | grep -i "debugger"
```

---

## 4. Test Environment

### 4.1 Compose Configuration for Testing

```yaml
# docker-compose.yml
services:
  app:
    build: .
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: myapp_dev
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  # テストランナー (プロファイル)
  test:
    profiles: ["test"]
    build:
      context: .
      target: test
    environment:
      NODE_ENV: test
      DATABASE_URL: postgresql://postgres:postgres@db-test:5432/myapp_test
    depends_on:
      db-test:
        condition: service_healthy
    command: npm run test:ci

  # テスト専用 DB
  db-test:
    profiles: ["test"]
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: myapp_test
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    # tmpfs でテスト高速化 (永続化不要)
    tmpfs:
      - /var/lib/postgresql/data
```

### 4.2 Test Execution Commands

```bash
# テスト実行
docker compose --profile test run --rm test

# テスト後のクリーンアップ
docker compose --profile test down -v

# E2E テスト (ブラウザ付き)
docker compose --profile e2e run --rm e2e-tests

# カバレッジレポート出力
docker compose --profile test run --rm \
  -v ./coverage:/app/coverage \
  test npm run test:coverage

# 特定のテストファイルのみ実行
docker compose --profile test run --rm \
  test npm test -- --testPathPattern="auth"

# ウォッチモードでテスト実行（開発中）
docker compose --profile test run --rm \
  test npm test -- --watch
```

### 4.3 E2E Test Environment (Playwright)

```yaml
# docker-compose.yml
services:
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
      POSTGRES_DB: myapp_test
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    tmpfs:
      - /var/lib/postgresql/data

  # Playwright E2E テスト
  e2e:
    profiles: ["e2e"]
    image: mcr.microsoft.com/playwright:v1.42.0-jammy
    working_dir: /app
    volumes:
      - .:/app
      - node_modules:/app/node_modules
      - ./test-results:/app/test-results
      - ./playwright-report:/app/playwright-report
    environment:
      BASE_URL: http://app:3000
      CI: "true"
    depends_on:
      app:
        condition: service_healthy
    command: npx playwright test --reporter=html
    networks:
      - default

volumes:
  node_modules:
```

### 4.4 E2E Test Environment (Cypress)

```yaml
services:
  # Cypress E2E テスト
  cypress:
    profiles: ["e2e"]
    image: cypress/included:13.6.0
    working_dir: /e2e
    volumes:
      - ./cypress:/e2e/cypress
      - ./cypress.config.ts:/e2e/cypress.config.ts
      - ./cypress/screenshots:/e2e/cypress/screenshots
      - ./cypress/videos:/e2e/cypress/videos
    environment:
      CYPRESS_baseUrl: http://app:3000
      CYPRESS_RECORD_KEY: ${CYPRESS_RECORD_KEY:-}
    depends_on:
      app:
        condition: service_healthy
    command: cypress run --browser chrome
```

### 4.5 Parallel Execution of Test Databases

A pattern to prevent database conflicts when running tests in parallel.

```yaml
services:
  # Test DB pool (assign a dedicated DB to each worker)
  db-test:
    profiles: ["test"]
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: myapp_test
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    tmpfs:
      - /var/lib/postgresql/data
    volumes:
      - ./scripts/create-test-databases.sh:/docker-entrypoint-initdb.d/create-test-databases.sh
```

```bash
#!/bin/bash
# scripts/create-test-databases.sh
# テストワーカー用のデータベースを事前作成

for i in $(seq 1 4); do
  psql -U postgres -c "CREATE DATABASE myapp_test_${i};"
done
echo "Test databases created: myapp_test_1 through myapp_test_4"
```

---

## 5. CI/CD Integration

### 5.1 Using Compose in GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      # Docker Compose は GitHub Actions に標準搭載
      - name: Start services
        run: docker compose -f docker-compose.ci.yml up -d

      - name: Wait for DB
        run: |
          until docker compose -f docker-compose.ci.yml exec -T db \
            pg_isready -U postgres; do
            echo "Waiting for DB..."
            sleep 2
          done

      - name: Run migrations
        run: docker compose -f docker-compose.ci.yml exec -T app \
          npx prisma migrate deploy

      - name: Run tests
        run: docker compose -f docker-compose.ci.yml exec -T app \
          npm run test:ci

      - name: Run lint
        run: docker compose -f docker-compose.ci.yml exec -T app \
          npm run lint

      - name: Collect coverage
        run: docker compose -f docker-compose.ci.yml exec -T app \
          npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          file: ./coverage/lcov.info

      - name: Cleanup
        if: always()
        run: docker compose -f docker-compose.ci.yml down -v
```

### 5.2 Compose File for CI

```yaml
# docker-compose.ci.yml
services:
  app:
    build:
      context: .
      target: test       # テストステージを使用
    environment:
      NODE_ENV: test
      DATABASE_URL: postgresql://postgres:postgres@db:5432/myapp_test
      REDIS_URL: redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - coverage:/app/coverage

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: myapp_test
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 3s
      timeout: 3s
      retries: 10
    tmpfs:
      - /var/lib/postgresql/data   # CI ではメモリ上で高速化

  redis:
    image: redis:7-alpine
    tmpfs:
      - /data

volumes:
  coverage:
```

### 5.3 Using Compose in GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy

variables:
  DOCKER_HOST: tcp://docker:2376
  DOCKER_TLS_CERTDIR: "/certs"
  COMPOSE_PROJECT_NAME: "ci-${CI_PIPELINE_ID}"

test:
  stage: test
  image: docker:24.0
  services:
    - docker:24.0-dind
  before_script:
    - apk add --no-cache docker-compose
  script:
    - docker compose -f docker-compose.ci.yml up -d
    - docker compose -f docker-compose.ci.yml exec -T app npm run test:ci
    - docker compose -f docker-compose.ci.yml exec -T app npm run lint
  after_script:
    - docker compose -f docker-compose.ci.yml down -v
  artifacts:
    reports:
      junit: test-results/junit.xml
    paths:
      - coverage/
    expire_in: 7 days
```

### 5.4 Build Cache Strategy for CI

```yaml
# .github/workflows/ci.yml (cache-optimized version)
name: CI with Cache

on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      # Docker レイヤーキャッシュ
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Cache Docker layers
        uses: actions/cache@v4
        with:
          path: /tmp/.buildx-cache
          key: ${{ runner.os }}-buildx-${{ hashFiles('**/Dockerfile', '**/package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-buildx-

      # キャッシュを活用してビルド
      - name: Build test image
        run: |
          docker buildx build \
            --cache-from type=local,src=/tmp/.buildx-cache \
            --cache-to type=local,dest=/tmp/.buildx-cache-new,mode=max \
            --target test \
            --load \
            -t myapp:test \
            .

      - name: Start services
        run: docker compose -f docker-compose.ci.yml up -d

      - name: Run tests
        run: docker compose -f docker-compose.ci.yml exec -T app npm run test:ci

      # キャッシュのローテーション（サイズ肥大防止）
      - name: Rotate cache
        run: |
          rm -rf /tmp/.buildx-cache
          mv /tmp/.buildx-cache-new /tmp/.buildx-cache

      - name: Cleanup
        if: always()
        run: docker compose -f docker-compose.ci.yml down -v
```

### 5.5 Running E2E Tests in CI

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - name: Start application
        run: docker compose -f docker-compose.ci.yml up -d

      - name: Wait for application to be ready
        run: |
          timeout 60 bash -c 'until curl -sf http://localhost:3000/health; do sleep 2; done'

      - name: Run E2E tests
        run: |
          docker compose --profile e2e run --rm \
            -e CI=true \
            -e BASE_URL=http://app:3000 \
            e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

      - name: Upload screenshots
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-screenshots
          path: test-results/
          retention-days: 7

      - name: Cleanup
        if: always()
        run: docker compose -f docker-compose.ci.yml --profile e2e down -v
```

---

## 6. Performance Optimization

### 6.1 Performance Improvements on macOS

```
+------------------------------------------------------------------+
|          macOS でのファイル I/O パフォーマンス比較                   |
+------------------------------------------------------------------+
|                                                                  |
|  方式                    | npm install 時間 | HMR 反映速度       |
|--------------------------|-----------------|-------------------|
|  バインドマウント (grpcfuse)| 120秒          | 2-5秒             |
|  バインドマウント (VirtioFS)| 60秒           | 0.5-2秒           |
|  名前付き Volume          | 15秒            | N/A (同期なし)     |
|  Compose Watch           | 15秒            | 0.5-1秒           |
|  Mutagen                 | 15秒            | 0.3-0.5秒         |
|                                                                  |
|  推奨: VirtioFS + node_modules は Volume 分離                    |
|                                                                  |
+------------------------------------------------------------------+
```

### 6.2 Docker Desktop Settings Optimization

```json
// Docker Desktop settings.json
{
  "filesharingDirectories": [
    "/Users/<username>/projects"
  ],
  "memoryMiB": 8192,
  "cpus": 4,
  "diskSizeMiB": 65536,
  "swapMiB": 1024,
  "useVirtualizationFrameworkVirtioFS": true,
  "useVirtualizationFrameworkRosetta": true
}
```

### 6.3 node_modules Volume Isolation Pattern

```yaml
# docker-compose.yml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      # ソースコードはバインドマウント
      - .:/app
      # node_modules は名前付きボリュームで分離
      # → macOS のファイルI/Oボトルネックを回避
      - node_modules:/app/node_modules
      # .next キャッシュも分離（Next.js の場合）
      - next_cache:/app/.next
    # ボリュームの初期化（コンテナ起動時に依存関係をインストール）
    entrypoint: >
      sh -c "
        if [ ! -d /app/node_modules/.package-lock.json ]; then
          echo 'Installing dependencies...'
          pnpm install --frozen-lockfile
        fi
        exec pnpm dev
      "

volumes:
  node_modules:
  next_cache:
```

### 6.4 Leveraging Build Cache

```dockerfile
# Dockerfile (マルチステージ + キャッシュ)
FROM node:20-alpine AS base
WORKDIR /app

# 依存関係レイヤー (変更頻度: 低)
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    corepack enable && pnpm install --frozen-lockfile

# 開発ステージ
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["pnpm", "dev"]

# ビルドステージ
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# テストステージ
FROM base AS test
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["pnpm", "test"]

# 本番ステージ
FROM base AS production
COPY --from=build /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
```

### 6.5 Build Context Optimization

```dockerignore
# .dockerignore
node_modules
.next
dist
build
coverage
test-results
playwright-report

# Git
.git
.gitignore

# IDE
.vscode
.idea

# Docker
docker-compose*.yml
Dockerfile*
.dockerignore

# ドキュメント
*.md
LICENSE

# テスト
__tests__
*.test.ts
*.spec.ts
cypress
```

---

## 7. Useful Scripts and Tasks

### 7.1 Makefile Development Tasks

```makefile
# Makefile (Docker Compose 関連)
.PHONY: dev up down logs shell db-shell test clean setup help

# デフォルトターゲット
.DEFAULT_GOAL := help

help: ## Show help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

setup: ## Initial setup (copy .env, install dependencies)
	@test -f .env || cp .env.example .env
	docker compose build
	docker compose up -d db redis
	@echo "Waiting for DB..."
	@sleep 5
	docker compose run --rm app npx prisma migrate deploy
	docker compose run --rm app npx prisma db seed
	@echo "Setup complete! Run 'make dev' to start."

dev: up ## Start development server (Docker + local)
	npm run dev

up: ## Start Docker services
	docker compose up -d
	@docker compose ps

down: ## Stop Docker services
	docker compose down

logs: ## Show logs
	docker compose logs -f --tail=100

logs-app: ## Show app logs only
	docker compose logs -f --tail=100 app

shell: ## Enter the app container
	docker compose exec app sh

db-shell: ## Connect to DB
	docker compose exec db psql -U postgres -d myapp_dev

db-dump: ## Dump DB
	docker compose exec db pg_dump -U postgres myapp_dev > backup.sql

db-restore: ## Restore DB
	cat backup.sql | docker compose exec -T db psql -U postgres myapp_dev

db-reset: ## Reset DB (re-run migrations)
	docker compose exec app npx prisma migrate reset --force

test: ## Run tests (on Docker)
	docker compose --profile test run --rm test

test-watch: ## Run tests in watch mode
	docker compose --profile test run --rm test npm test -- --watch

test-e2e: ## Run E2E tests
	docker compose --profile e2e run --rm e2e

lint: ## Run lint
	docker compose exec app npm run lint

format: ## Format code
	docker compose exec app npm run format

typecheck: ## Type check
	docker compose exec app npm run typecheck

clean: ## Remove everything (including volumes)
	docker compose down -v --remove-orphans
	docker system prune -f

rebuild: ## Rebuild image and start
	docker compose build --no-cache
	docker compose up -d

update-deps: ## Update dependencies
	docker compose exec app pnpm update
	docker compose exec app pnpm install --frozen-lockfile
```

### 7.2 Automating Setup with Shell Scripts

```bash
#!/bin/bash
# scripts/setup.sh - Project initial setup

set -euo pipefail

echo "=== Project Setup ==="

# 1. Copy environment variables file
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo "  Please edit .env with your settings"
fi

# 2. Docker Compose build
echo "Building Docker images..."
docker compose build

# 3. Start services
echo "Starting services..."
docker compose up -d db redis

# 4. Wait for DB to be ready
echo "Waiting for database..."
until docker compose exec -T db pg_isready -U postgres 2>/dev/null; do
    printf "."
    sleep 1
done
echo " Ready!"

# 5. Run migrations
echo "Running migrations..."
docker compose run --rm app npx prisma migrate deploy

# 6. Seed data
echo "Seeding database..."
docker compose run --rm app npx prisma db seed

# 7. Start all services
echo "Starting all services..."
docker compose up -d

echo ""
echo "=== Setup Complete ==="
echo "  App: http://localhost:3000"
echo "  DB:  localhost:5432"
echo ""
echo "Run 'make dev' or 'docker compose up -d' to start."
```

### 7.3 pre-commit Hooks

```bash
#!/bin/bash
# .git/hooks/pre-commit
# Run lint + typecheck inside the container before committing

echo "Running pre-commit checks..."

# Lint check
if ! docker compose exec -T app npm run lint --quiet 2>/dev/null; then
    echo "Lint check failed. Please fix the errors and try again."
    exit 1
fi

# Type check
if ! docker compose exec -T app npm run typecheck 2>/dev/null; then
    echo "Type check failed. Please fix the errors and try again."
    exit 1
fi

echo "Pre-commit checks passed."
```

### 7.4 VS Code Task Configuration

```jsonc
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Docker: Up",
      "type": "shell",
      "command": "docker compose up -d",
      "group": "build",
      "presentation": {
        "reveal": "silent"
      }
    },
    {
      "label": "Docker: Down",
      "type": "shell",
      "command": "docker compose down",
      "group": "build"
    },
    {
      "label": "Docker: Logs",
      "type": "shell",
      "command": "docker compose logs -f --tail=100",
      "group": "build",
      "isBackground": true
    },
    {
      "label": "Docker: Test",
      "type": "shell",
      "command": "docker compose --profile test run --rm test",
      "group": "test"
    },
    {
      "label": "Docker: Shell",
      "type": "shell",
      "command": "docker compose exec app sh",
      "group": "none"
    },
    {
      "label": "Docker: DB Reset",
      "type": "shell",
      "command": "docker compose exec app npx prisma migrate reset --force",
      "group": "none",
      "problemMatcher": []
    }
  ]
}
```

### 7.5 devcontainer.json Configuration

Using the VS Code Dev Containers extension allows you to develop directly inside a container.

```jsonc
// .devcontainer/devcontainer.json
{
  "name": "My App Dev Container",
  "dockerComposeFile": ["../docker-compose.yml", "docker-compose.devcontainer.yml"],
  "service": "app",
  "workspaceFolder": "/app",

  "features": {
    "ghcr.io/devcontainers/features/git:1": {},
    "ghcr.io/devcontainers/features/github-cli:1": {}
  },

  "customizations": {
    "vscode": {
      "extensions": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "Prisma.prisma",
        "ms-vscode.vscode-typescript-next"
      ],
      "settings": {
        "editor.formatOnSave": true,
        "editor.defaultFormatter": "esbenp.prettier-vscode",
        "terminal.integrated.defaultProfile.linux": "zsh"
      }
    }
  },

  "forwardPorts": [3000, 5432, 6379],

  "postCreateCommand": "pnpm install && npx prisma generate",

  "remoteUser": "node"
}
```

```yaml
# .devcontainer/docker-compose.devcontainer.yml
services:
  app:
    build:
      context: ..
      dockerfile: Dockerfile.dev
    volumes:
      - ..:/app:cached
      - node_modules:/app/node_modules
    command: sleep infinity   # Dev Container はシェルを使うため
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/myapp_dev
      REDIS_URL: redis://redis:6379

volumes:
  node_modules:
```

---

## 8. Complete Development Environment Configuration Example

### 8.1 Full-Stack Web Application

```yaml
# docker-compose.yml - Complete development environment
services:
  # --- Frontend ---
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - frontend_node_modules:/app/node_modules
    environment:
      VITE_API_URL: http://localhost:8080
      VITE_HMR_HOST: localhost
    command: pnpm dev --host

  # --- Backend API ---
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    ports:
      - "8080:8080"
      - "9229:9229"    # Debugger port
    volumes:
      - ./backend:/app
      - backend_node_modules:/app/node_modules
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://postgres:postgres@db:5432/myapp_dev
      REDIS_URL: redis://redis:6379
      SMTP_HOST: mailhog
      SMTP_PORT: 1025
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: minioadmin
      S3_SECRET_KEY: minioadmin
      S3_BUCKET: uploads
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    command: >
      node --inspect=0.0.0.0:9229 node_modules/.bin/tsx watch src/index.ts

  # --- Database ---
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: myapp_dev
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    ports:
      - "5432:5432"    # Accessible from outside during development
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql

  # --- Redis ---
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  # --- Object Storage (S3-compatible) ---
  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"    # Console
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"

  # --- Mail Catcher ---
  mailhog:
    image: mailhog/mailhog:latest
    profiles: ["debug"]
    ports:
      - "1025:1025"    # SMTP
      - "8025:8025"    # Web UI

  # --- DB Administration Tool ---
  pgadmin:
    image: dpage/pgadmin4:latest
    profiles: ["debug"]
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"

  # --- Redis Administration Tool ---
  redis-commander:
    image: rediscommander/redis-commander:latest
    profiles: ["debug"]
    environment:
      REDIS_HOSTS: local:redis:6379
    ports:
      - "8081:8081"

volumes:
  frontend_node_modules:
  backend_node_modules:
  pgdata:
  redis_data:
  minio_data:
```

---

## Anti-Patterns

### Anti-Pattern 1: Using the Production Dockerfile Directly for Development

```dockerfile
# NG: Using the production Dockerfile as-is for development
FROM node:20-alpine
WORKDIR /app
COPY . .               # Copies all files → conflicts with bind mount
RUN npm ci --production # devDependencies are missing
CMD ["node", "dist/index.js"]  # Assumes pre-built output

# OK: Use multi-stage builds with a dedicated development stage
FROM node:20-alpine AS development
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install  # Includes devDependencies
# COPY is omitted → source is injected via bind mount
CMD ["pnpm", "dev"]
```

**Problem**: The production Dockerfile includes only the minimum file copies and production dependencies. devDependencies needed during development (test frameworks, lint tools, etc.) are missing, and the COPY directive conflicts with bind mounts, breaking file synchronization.

### Anti-Pattern 2: Leaving docker compose up Running in CI Without Cleanup

```yaml
# NG: Forgetting to clean up
steps:
  - run: docker compose up -d
  - run: npm test
  # Forgot docker compose down → port conflicts on the next run

# OK: Guarantee cleanup with an always step
steps:
  - run: docker compose -f docker-compose.ci.yml up -d
  - run: npm test
  - name: Cleanup
    if: always()  # Always runs even when tests fail
    run: docker compose -f docker-compose.ci.yml down -v --remove-orphans
```

**Problem**: If containers are not stopped in the CI environment, the next CI run will encounter port conflicts and leftover volumes, causing tests to become unstable. Use `if: always()` to ensure cleanup always runs.

### Anti-Pattern 3: Leaving Debugger Ports Open in Production

```yaml
# NG: Debugger port exposed in production
services:
  app:
    ports:
      - "3000:3000"
      - "9229:9229"    # Debugger port → absolutely not for production
    command: node --inspect=0.0.0.0:9229 dist/index.js

# OK: Debugger port only in development override
# docker-compose.yml (base)
services:
  app:
    ports:
      - "3000:3000"
    command: node dist/index.js

# docker-compose.override.yml (development)
services:
  app:
    ports:
      - "9229:9229"
    command: node --inspect=0.0.0.0:9229 node_modules/.bin/tsx watch src/index.ts
```

**Problem**: Deploying to production with the `--inspect` option enabled exposes a debug interface that allows arbitrary code execution externally. This is one of the most critical security vulnerabilities.

### Anti-Pattern 4: Sharing node_modules via Bind Mount

```yaml
# NG: Host node_modules overwrite the container's
services:
  app:
    volumes:
      - .:/app        # node_modules is included
    # → Host (macOS) binaries won't work in a Linux container

# OK: Isolate node_modules using a volume
services:
  app:
    volumes:
      - .:/app
      - node_modules:/app/node_modules   # Container-specific
volumes:
  node_modules:
```

**Problem**: Native binaries installed on the host (macOS/Windows), such as `bcrypt` and `sharp`, do not work inside a Linux container. Isolating `node_modules` in a volume ensures that the correct platform-specific binaries are used inside the container.


---

## Practice Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Write test code as well

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """基本的な実装パターンの演習"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """入力値の検証"""
        if value is None:
            raise ValueError("入力値がNoneです")
        return True

    def process(self, value):
        """データ処理のメインロジック"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """処理結果の取得"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# テスト
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

Extend the basic implementation to add the following features.

```python
# Exercise 2: Advanced pattern
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """応用パターンの演習"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """アイテムの追加（サイズ制限付き）"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """キーによる検索"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """キーによる削除"""
        for i, item in enumerate(self._items):
            if item['key'] == key:
                self._items.pop(i)
                return True
        return False

    def stats(self) -> Dict:
        """統計情報"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# テスト
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # サイズ制限
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

# 最適化前（O(n^2)）
def slow_search(data: list, target: int) -> int:
    """非効率な検索"""
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[i] + data[j] == target:
                return (i, j)
    return (-1, -1)

# 最適化後（O(n)）
def fast_search(data: list, target: int) -> tuple:
    """ハッシュマップを使った効率的な検索"""
    seen = {}
    for i, num in enumerate(data):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (-1, -1)

# ベンチマーク
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
- Be mindful of algorithm time complexity
- Choose appropriate data structures
- Measure the effect with benchmarks
---

## FAQ

### Q1: Should I use bind mounts or Compose Watch?

**A**: On Linux, bind mounts are the fastest and simplest to configure, so you can use them as-is. On macOS / Windows, bind mount I/O is slow, so Compose Watch (V2.22+) is recommended. Watch detects changes and syncs them into the container, avoiding file system overhead. Note that it is not bidirectional, so files generated inside the container (build artifacts, etc.) will not be reflected on the host side.

### Q2: Breakpoint line numbers are off when using a debugger inside a container. Why?

**A**: The cause is often incorrect source map and path mapping configuration. Verify that `localRoot` (host-side path) and `remoteRoot` (path inside the container) in VS Code's `launch.json` correspond correctly. For TypeScript, set `"sourceMap": true` in `tsconfig.json` and set breakpoints on the source files, not the transpiled files.

### Q3: Compose builds are slow every time in CI. How can I enable caching?

**A**: (1) Save Docker layer cache using `actions/cache` in GitHub Actions. (2) Enable inline cache with `docker compose build --build-arg BUILDKIT_INLINE_CACHE=1` and specify the previous image in `cache_from`. (3) Use `RUN --mount=type=cache` in the Dockerfile to share npm/pip caches between builds. (4) For GitHub Actions, the most effective approach is to use `setup-buildx-action` + `build-push-action` to store the cache in GHCR.

### Q4: Should I separate Dockerfiles for development and production environments?

**A**: You should not. Use multi-stage builds to define `development`, `test`, and `production` stages within a single Dockerfile. Specify the stage to use with `build.target` on the `docker compose` side. This reduces Dockerfile maintenance cost and minimizes differences between environments.

### Q5: What is the difference between Docker Desktop VirtioFS and gRPC FUSE?

**A**: VirtioFS is a high-speed file sharing method using macOS's Virtualization.framework, offering 2 to 5 times the performance improvement compared to gRPC FUSE (the older method). It is enabled by default in Docker Desktop 4.15+. You can verify and configure it at Settings → General → "Use VirtioFS". For large-scale projects, the most effective combination is VirtioFS combined with node_modules volume isolation.

### Q6: Which is better, Dev Containers or standard Docker Compose development?

**A**: If everyone on the team uses VS Code, Dev Containers can provide a unified development experience. For teams with mixed editors, the bind mount approach is more flexible. The advantage of Dev Containers is that editor extensions and terminals run inside the container, delivering a completely identical development environment without dependence on the host. The disadvantages are that VS Code is required and there is waiting time when rebuilding the container.

---

## Summary

| Item | Key Points |
|------|------------|
| Hot Reload | Bind mount + Volume isolation (node_modules) is the foundation |
| Compose Watch | Official sync feature in V2.22+. Recommended for macOS/Windows |
| Debugging | Achieved with `--inspect=0.0.0.0:9229` + VS Code Attach |
| Testing | Build a fast dedicated test DB with profiles + tmpfs |
| E2E Testing | Containerize Playwright/Cypress for stable execution |
| CI Integration | Dedicated Compose file + `if: always()` cleanup |
| Performance | Optimize with VirtioFS + Volume isolation + BuildKit cache |
| Multi-stage | Separate development / test / production stages |
| Makefile | Consolidate daily tasks into make commands |
| Dev Containers | VS Code + container for a fully unified development environment |

## Guides to Read Next

- [Compose Advanced](./01-compose-advanced.md) -- Advanced configuration of profiles, healthcheck, and environment variables
- [Docker Compose Basics](./00-compose-basics.md) -- Basic Compose syntax
- [Container Security](../06-security/00-container-security.md) -- Security practices to be aware of even in development environments

## References

1. **Docker Compose Watch** -- https://docs.docker.com/compose/file-watch/ -- Official documentation for the Compose Watch feature
2. **VS Code Remote Debugging** -- https://code.visualstudio.com/docs/nodejs/nodejs-debugging -- Remote debugging configuration from VS Code
3. **Docker Build Cache** -- https://docs.docker.com/build/cache/ -- BuildKit cache mechanism and optimization
4. **Docker Compose in CI** -- https://docs.docker.com/compose/ci-cd/ -- How to use Compose in CI/CD environments
5. **Dev Containers** -- https://containers.dev/ -- Official Dev Containers specification
6. **Playwright Docker** -- https://playwright.dev/docs/docker -- Guide for running Playwright in containers
7. **Docker Desktop VirtioFS** -- https://docs.docker.com/desktop/settings/mac/ -- VirtioFS configuration and optimization

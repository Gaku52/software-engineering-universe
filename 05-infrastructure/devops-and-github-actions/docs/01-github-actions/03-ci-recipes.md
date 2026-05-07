# CI Recipe Collection

> A comprehensive collection of practical CI configurations for Node.js, Python, Go, Rust, and Docker, providing standard patterns for testing, linting, and building

## What You Will Learn

1. Understand CI configuration patterns for major languages and frameworks
2. Learn how to integrate testing, linting, type checking, and security scanning
3. Implement automated Docker image builds and pushes
4. Understand efficient CI configuration for monorepo environments
5. Apply techniques to speed up CI pipelines


## Prerequisites

Before reading this guide, the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [Reusable Workflows](./02-reusable-workflows.md)

---

## 1. Node.js / TypeScript CI

### 1.1 Full-Stack Node.js CI

```yaml
name: Node.js CI
on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read
  pull-requests: write

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Lint (ESLint + Prettier)
        run: |
          npm run lint
          npm run format:check

      - name: Type check
        run: npx tsc --noEmit

      - name: Unit tests
        run: npm test -- --coverage --coverageReporters=json-summary

      - name: Build
        run: npm run build

      - name: E2E tests (Playwright)
        if: github.event_name == 'push'
        run: |
          npx playwright install --with-deps chromium
          npm run test:e2e
```

### 1.2 Monorepo (Turborepo) CI

```yaml
name: Monorepo CI
on: [push, pull_request]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2  # Required for diff detection

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      # Turborepo remote cache
      - name: Run affected checks
        run: npx turbo run lint typecheck test build --filter='...[HEAD~1]'
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

### 1.3 Monorepo CI with pnpm

```yaml
name: pnpm Monorepo CI
on: [push, pull_request]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm run -r lint

      - name: Type check
        run: pnpm run -r typecheck

      - name: Test
        run: pnpm run -r test -- --coverage

      - name: Build
        run: pnpm run -r build
```

### 1.4 Next.js-Specific CI

```yaml
name: Next.js CI
on: [push, pull_request]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

      - name: Unit tests
        run: npm test -- --coverage

      - name: Build
        run: npm run build
        env:
          NEXT_TELEMETRY_DISABLED: 1

      # Next.js build cache
      - uses: actions/cache@v4
        with:
          path: .next/cache
          key: ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}-${{ hashFiles('**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx') }}
          restore-keys: |
            ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}-

      # Lighthouse CI
      - name: Lighthouse CI
        if: github.event_name == 'pull_request'
        run: |
          npm install -g @lhci/cli
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

### 1.5 Vitest + React Testing Library CI

```yaml
name: Frontend CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Unit tests with coverage
        run: npx vitest run --coverage --reporter=json --outputFile=test-results.json

      - name: Upload coverage to Codecov
        if: github.event_name == 'push'
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/lcov.info

      - name: Comment PR with coverage
        if: github.event_name == 'pull_request'
        uses: davelosert/vitest-coverage-report-action@v2
```

### 1.6 Playwright E2E Test CI

```yaml
name: E2E Tests
on:
  push:
    branches: [main]
  pull_request:

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps

      - name: Build application
        run: npm run build

      - name: Run E2E tests
        run: npx playwright test
        env:
          CI: true
          BASE_URL: http://localhost:3000

      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

      - name: Upload traces on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-traces
          path: test-results/
          retention-days: 7

  # Test sharding (for large-scale projects)
  e2e-sharded:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [1/4, 2/4, 3/4, 4/4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
      - name: Run E2E tests (shard ${{ matrix.shard }})
        run: npx playwright test --shard=${{ matrix.shard }}
```

### 1.7 npm Package Publishing CI

```yaml
name: Publish Package
on:
  release:
    types: [published]

permissions:
  contents: read
  id-token: write  # Required for npm provenance

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci
      - run: npm test
      - run: npm run build

      - name: Publish to npm
        run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## 2. Python CI

### 2.1 Python Project CI

```yaml
name: Python CI
on: [push, pull_request]

jobs:
  ci:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ['3.11', '3.12']

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
          cache: 'pip'

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          pip install -r requirements-dev.txt

      - name: Lint (Ruff)
        run: |
          ruff check .
          ruff format --check .

      - name: Type check (mypy)
        run: mypy src/

      - name: Test (pytest)
        run: pytest --cov=src --cov-report=xml -v

      - name: Security check (bandit)
        run: bandit -r src/ -c pyproject.toml
```

### 2.2 Python CI with Poetry

```yaml
name: Python CI (Poetry)
on: [push, pull_request]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install Poetry
        run: pipx install poetry

      - name: Configure Poetry
        run: poetry config virtualenvs.in-project true

      - uses: actions/cache@v4
        with:
          path: .venv
          key: ${{ runner.os }}-poetry-${{ hashFiles('poetry.lock') }}

      - run: poetry install --no-interaction
      - run: poetry run ruff check .
      - run: poetry run mypy src/
      - run: poetry run pytest --cov
```

### 2.3 Fast Python CI with uv

```yaml
name: Python CI (uv)
on: [push, pull_request]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v4
        with:
          version: "latest"

      - name: Set up Python
        run: uv python install 3.12

      - name: Install dependencies
        run: uv sync --all-extras --dev

      - name: Lint
        run: |
          uv run ruff check .
          uv run ruff format --check .

      - name: Type check
        run: uv run mypy src/

      - name: Test
        run: uv run pytest --cov=src --cov-report=xml -v

      - name: Security check
        run: uv run bandit -r src/ -c pyproject.toml
```

### 2.4 Django Project CI

```yaml
name: Django CI
on: [push, pull_request]

jobs:
  ci:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: testuser
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: testdb
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        ports:
          - 6379:6379

    env:
      DATABASE_URL: postgres://testuser:testpass@localhost:5432/testdb
      REDIS_URL: redis://localhost:6379

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: 'pip'

      - run: pip install -r requirements.txt

      - name: Lint
        run: |
          ruff check .
          ruff format --check .

      - name: Type check
        run: mypy .

      - name: Run migrations
        run: python manage.py migrate

      - name: Run tests
        run: python manage.py test --parallel --verbosity=2

      - name: Check for missing migrations
        run: python manage.py makemigrations --check --dry-run
```

### 2.5 FastAPI Project CI

```yaml
name: FastAPI CI
on: [push, pull_request]

jobs:
  ci:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: 'pip'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r requirements-dev.txt

      - name: Lint and format
        run: |
          ruff check .
          ruff format --check .

      - name: Type check
        run: mypy app/

      - name: Test
        run: pytest --cov=app --cov-report=xml -v --tb=short
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/postgres
          TESTING: "1"

      - name: OpenAPI schema validation
        run: |
          python -c "
          from app.main import app
          import json
          schema = app.openapi()
          with open('openapi.json', 'w') as f:
              json.dump(schema, f, indent=2)
          print('OpenAPI schema generated successfully')
          "
```

### 2.6 PyPI Package Publishing CI

```yaml
name: Publish to PyPI
on:
  release:
    types: [published]

permissions:
  contents: read
  id-token: write  # Required for Trusted Publisher

jobs:
  publish:
    runs-on: ubuntu-latest
    environment:
      name: pypi
      url: https://pypi.org/p/my-package
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install build tools
        run: pip install build

      - name: Build package
        run: python -m build

      - name: Publish to PyPI
        uses: pypa/gh-action-pypi-publish@release/v1
        # No token needed — uses OIDC (Trusted Publisher)
```

---

## 3. Go CI

### 3.1 Go Project CI

```yaml
name: Go CI
on: [push, pull_request]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'

      - name: Lint (golangci-lint)
        uses: golangci/golangci-lint-action@v4
        with:
          version: latest

      - name: Test
        run: go test -v -race -coverprofile=coverage.out ./...

      - name: Build
        run: go build -v ./...

      - name: Security (govulncheck)
        run: |
          go install golang.org/x/vuln/cmd/govulncheck@latest
          govulncheck ./...
```

### 3.2 Go Multi-Platform Build

```yaml
name: Go Release
on:
  push:
    tags: ['v*']

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        include:
          - goos: linux
            goarch: amd64
          - goos: linux
            goarch: arm64
          - goos: darwin
            goarch: amd64
          - goos: darwin
            goarch: arm64
          - goos: windows
            goarch: amd64
            ext: .exe

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'

      - name: Build
        run: |
          GOOS=${{ matrix.goos }} GOARCH=${{ matrix.goarch }} \
          go build -ldflags "-s -w -X main.version=${{ github.ref_name }}" \
          -o myapp-${{ matrix.goos }}-${{ matrix.goarch }}${{ matrix.ext }} \
          ./cmd/myapp/

      - name: Upload release asset
        uses: softprops/action-gh-release@v2
        with:
          files: myapp-*
```

### 3.3 Go + Protocol Buffers CI

```yaml
name: Go + Protobuf CI
on: [push, pull_request]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'

      - name: Install protoc
        uses: arduino/setup-protoc@v3
        with:
          version: '25.x'

      - name: Install protoc-gen-go
        run: |
          go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
          go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

      - name: Generate protobuf code
        run: |
          protoc --go_out=. --go_opt=paths=source_relative \
                 --go-grpc_out=. --go-grpc_opt=paths=source_relative \
                 proto/*.proto

      - name: Check generated code is up to date
        run: |
          git diff --exit-code || \
            (echo "Generated code is out of date. Run 'make proto' and commit." && exit 1)

      - name: Lint
        uses: golangci/golangci-lint-action@v4

      - name: Test
        run: go test -v -race ./...
```

---

## 4. Rust CI

### 4.1 Rust Project CI

```yaml
name: Rust CI
on: [push, pull_request]

env:
  CARGO_TERM_COLOR: always

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: dtolnay/rust-toolchain@stable
        with:
          components: rustfmt, clippy

      - uses: actions/cache@v4
        with:
          path: |
            ~/.cargo/bin/
            ~/.cargo/registry/
            ~/.cargo/git/
            target/
          key: ${{ runner.os }}-cargo-${{ hashFiles('Cargo.lock') }}

      - name: Format check
        run: cargo fmt --all -- --check

      - name: Clippy (lint)
        run: cargo clippy --all-targets --all-features -- -D warnings

      - name: Test
        run: cargo test --all-features

      - name: Build (release)
        run: cargo build --release

      - name: Security audit
        run: |
          cargo install cargo-audit
          cargo audit
```

### 4.2 Rust Multi-Platform Release

```yaml
name: Rust Release
on:
  push:
    tags: ['v*']

permissions:
  contents: write

jobs:
  build:
    strategy:
      matrix:
        include:
          - target: x86_64-unknown-linux-gnu
            os: ubuntu-latest
          - target: aarch64-unknown-linux-gnu
            os: ubuntu-latest
          - target: x86_64-apple-darwin
            os: macos-latest
          - target: aarch64-apple-darwin
            os: macos-latest
          - target: x86_64-pc-windows-msvc
            os: windows-latest

    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Install cross-compilation tools
        if: matrix.target == 'aarch64-unknown-linux-gnu'
        run: |
          sudo apt-get update
          sudo apt-get install -y gcc-aarch64-linux-gnu

      - name: Build
        run: cargo build --release --target ${{ matrix.target }}

      - name: Package (Unix)
        if: runner.os != 'Windows'
        run: |
          cd target/${{ matrix.target }}/release
          tar -czf ../../../myapp-${{ matrix.target }}.tar.gz myapp

      - name: Package (Windows)
        if: runner.os == 'Windows'
        run: |
          cd target/${{ matrix.target }}/release
          7z a ../../../myapp-${{ matrix.target }}.zip myapp.exe

      - name: Upload release asset
        uses: softprops/action-gh-release@v2
        with:
          files: |
            myapp-*.tar.gz
            myapp-*.zip
```

### 4.3 Rust + WebAssembly CI

```yaml
name: Rust WASM CI
on: [push, pull_request]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: wasm32-unknown-unknown
          components: rustfmt, clippy

      - name: Install wasm-pack
        run: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

      - name: Lint
        run: |
          cargo fmt --all -- --check
          cargo clippy --target wasm32-unknown-unknown -- -D warnings

      - name: Test (native)
        run: cargo test

      - name: Test (wasm)
        run: wasm-pack test --headless --chrome

      - name: Build WASM package
        run: wasm-pack build --target web --release

      - name: Upload WASM artifact
        uses: actions/upload-artifact@v4
        with:
          name: wasm-package
          path: pkg/
```

---

## 5. Docker CI

### 5.1 Docker Build and Push

```yaml
name: Docker Build
on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:

permissions:
  contents: read
  packages: write

jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        if: github.event_name != 'pull_request'
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha

      - uses: docker/build-push-action@v5
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64,linux/arm64
```

### 5.2 Multi-Stage Dockerfile

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY . .
RUN npm run build

# Runtime stage
FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER nextjs
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### 5.3 Dockerfile Lint + Security Scan

```yaml
name: Docker Security
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Hadolint (Dockerfile lint)
        uses: hadolint/hadolint-action@v3.1.0
        with:
          dockerfile: Dockerfile
          failure-threshold: warning

  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build image for scanning
        run: docker build -t myapp:scan .

      - name: Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'myapp:scan'
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'

      # Second opinion via Grype
      - name: Grype vulnerability scanner
        uses: anchore/scan-action@v4
        with:
          image: 'myapp:scan'
          severity-cutoff: high
          fail-build: true
```

### 5.4 Integration Testing with Docker Compose

```yaml
name: Integration Tests
on: [push, pull_request]

jobs:
  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Start services
        run: docker compose -f docker-compose.test.yml up -d --wait

      - name: Run integration tests
        run: |
          docker compose -f docker-compose.test.yml exec -T app \
            npm run test:integration

      - name: Collect logs on failure
        if: failure()
        run: docker compose -f docker-compose.test.yml logs > docker-logs.txt

      - name: Upload logs
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: docker-logs
          path: docker-logs.txt

      - name: Cleanup
        if: always()
        run: docker compose -f docker-compose.test.yml down -v
```

---

## 6. Additional Languages and Frameworks CI

### 6.1 Java (Gradle) CI

```yaml
name: Java CI
on: [push, pull_request]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '21'
          cache: 'gradle'

      - name: Lint (Checkstyle)
        run: ./gradlew checkstyleMain checkstyleTest

      - name: Test
        run: ./gradlew test

      - name: Build
        run: ./gradlew build

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: build/reports/tests/
```

### 6.2 Terraform CI

```yaml
name: Terraform CI
on:
  pull_request:
    paths:
      - 'terraform/**'
      - '.github/workflows/terraform.yml'

permissions:
  contents: read
  pull-requests: write
  id-token: write

jobs:
  plan:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        environment: [staging, production]
    defaults:
      run:
        working-directory: terraform/environments/${{ matrix.environment }}
    steps:
      - uses: actions/checkout@v4

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: '1.7'

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets[format('{0}_AWS_ROLE_ARN', matrix.environment)] }}
          aws-region: ap-northeast-1

      - name: Terraform Format
        run: terraform fmt -check -recursive

      - name: Terraform Init
        run: terraform init

      - name: Terraform Validate
        run: terraform validate

      - name: Terraform Plan
        id: plan
        run: terraform plan -no-color -out=tfplan
        continue-on-error: true

      - name: Comment PR with plan
        uses: peter-evans/create-or-update-comment@v4
        with:
          issue-number: ${{ github.event.pull_request.number }}
          body: |
            ### Terraform Plan: `${{ matrix.environment }}`
            ```
            ${{ steps.plan.outputs.stdout }}
            ```

      - name: Terraform Plan Status
        if: steps.plan.outcome == 'failure'
        run: exit 1

      # tfsec security scan
      - name: tfsec security scan
        uses: aquasecurity/tfsec-action@v1.0.0
        with:
          working_directory: terraform/environments/${{ matrix.environment }}
```

### 6.3 Helm Chart CI

```yaml
name: Helm CI
on:
  push:
    paths:
      - 'charts/**'
  pull_request:
    paths:
      - 'charts/**'

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: azure/setup-helm@v4
        with:
          version: 'v3.14.0'

      - name: Helm lint
        run: |
          for chart in charts/*/; do
            echo "Linting $chart"
            helm lint "$chart" --strict
          done

      - name: Template validation
        run: |
          for chart in charts/*/; do
            echo "Templating $chart"
            helm template test "$chart" --debug
          done

      - name: Kubeval validation
        run: |
          wget -q https://github.com/instrumenta/kubeval/releases/latest/download/kubeval-linux-amd64.tar.gz
          tar xf kubeval-linux-amd64.tar.gz
          for chart in charts/*/; do
            helm template test "$chart" | ./kubeval --strict
          done
```

---

## 7. CI Pipeline Configuration Comparison

```
Pipeline stages by language:

Node.js:   Lint → TypeCheck → UnitTest → Build → E2E
Python:    Lint → TypeCheck → UnitTest → Security
Go:        Lint → Test(race) → Build → Vulncheck
Rust:      Fmt → Clippy → Test → Build → Audit
Docker:    Lint(hadolint) → Build → Scan(trivy) → Push
Java:      Lint → Test → Build → Publish
Terraform: Fmt → Validate → Plan → tfsec
```

### 7.1 Tool Comparison by Language

| Purpose | Node.js | Python | Go | Rust | Java |
|---|---|---|---|---|---|
| Linter | ESLint | Ruff | golangci-lint | Clippy | Checkstyle |
| Formatter | Prettier | Ruff/Black | gofmt | rustfmt | Spotless |
| Type check | TypeScript | mypy/pyright | (built-in) | (built-in) | (built-in) |
| Testing | Jest/Vitest | pytest | go test | cargo test | JUnit |
| Coverage | c8/istanbul | coverage.py | go test -cover | cargo-tarpaulin | JaCoCo |
| Security | npm audit | bandit/safety | govulncheck | cargo-audit | SpotBugs |
| Package mgmt | npm/pnpm | pip/uv/poetry | go mod | cargo | Gradle/Maven |

### 7.2 CI Speed Benchmarks

| Language | Lint | Test | Build | Total Target |
|---|---|---|---|---|
| Node.js (medium) | ~15s | ~60s | ~30s | < 3 min |
| Python (medium) | ~10s | ~45s | N/A | < 2 min |
| Go (medium) | ~20s | ~30s | ~15s | < 2 min |
| Rust (medium) | ~30s | ~120s | ~180s | < 6 min |
| Docker build | ~5s | N/A | ~120s | < 3 min |
| Java (medium) | ~15s | ~60s | ~30s | < 3 min |

### 7.3 CI Speed Optimization Techniques

```
1. Dependency caching
   - Use actions/cache or the cache option in each setup action
   - Use lockfile hash as the cache key

2. Parallel execution
   - Split jobs for parallel execution (lint / test / build as separate jobs)
   - Test sharding (--shard option)
   - Multi-version testing with matrix strategy

3. Diff detection
   - Detect changed files with dorny/paths-filter
   - Turborepo / Nx affected feature
   - Identify changed packages with git diff

4. Fail fast
   - Run lint and type checks first (fast and catches issues early)
   - fail-fast: true (default) to short-circuit matrix early

5. Build caching
   - Docker: GHA cache (type=gha)
   - Next.js: Cache .next/cache
   - Rust: Cache target/ directory
   - Go: Cache GOMODCACHE and GOCACHE

6. Concurrency control
   - Cancel outdated runs for the same branch
   - cancel-in-progress: true

7. Conditional branching
   - Skip E2E tests on PRs
   - Docker build and deploy only on main push
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: CI Without Tests

```yaml
# Bad example: "CI passed" with only a build
jobs:
  ci:
    steps:
      - run: npm run build
      # No tests → passing the build is not enough

# Improvement: stage configuration based on test pyramid
jobs:
  ci:
    steps:
      - run: npm run lint
      - run: npm run type-check
      - run: npm test -- --coverage
      - run: npm run build
      # fail fast order: lint → type → test → build
```

### Anti-Pattern 2: Ignoring Slow CI

```
Problem:
  CI takes more than 15 minutes, causing developers to merge without waiting for results.

Improvement checklist:
  [ ] Is dependency caching configured?
  [ ] Are tests running in parallel? (--shard, -j)
  [ ] Have unnecessary steps been removed?
  [ ] Is lint / type-check running first?
  [ ] Is Docker layer caching being used?
  [ ] Are only changed files being tested? (affected)
  [ ] Is concurrency canceling old runs?
```

### Anti-Pattern 3: Poor Cache Key Design

```yaml
# Bad example: Fixed cache key that never updates
- uses: actions/cache@v4
  with:
    path: node_modules
    key: node-modules-cache  # Same key always, so never updated

# Bad example: Cache key too granular to be reused
- uses: actions/cache@v4
  with:
    path: node_modules
    key: ${{ runner.os }}-node-${{ github.sha }}  # New cache every commit

# Good example: Lockfile-based cache key
- uses: actions/cache@v4
  with:
    path: node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

### Anti-Pattern 4: Exposing Secrets in CI Logs

```yaml
# Bad example: Dumping all environment variables
- run: env | sort  # Secrets may appear in logs

# Bad example: Debug output
- run: echo "Token is ${{ secrets.API_TOKEN }}"  # Masked, but still avoid

# Good example: Output only necessary information
- run: echo "Using API endpoint: ${{ vars.API_URL }}"
  # Use Variables instead of Secrets
```


---

## Hands-On Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Write test code as well

```python
# Exercise 1: Template for basic implementation
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
        """Get processing results"""
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
        assert False, "Should have raised an exception"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation to add the following functionality.

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
    assert ex.add("d", 4) == False  # Size limit reached
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
    print(f"Speedup:      {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure the effect with benchmarks
---

## 9. FAQ

### Q1: How do I run different steps for PR CI versus main branch CI?

Branch using `github.event_name`. For PRs, run `lint + test + build`; for main pushes, additionally run `e2e + docker build + deploy`. Using environments to restrict deployments to the main branch only is also effective.

### Q2: How do I configure parallel test execution?

Jest supports the `--shard` option, Playwright supports the `--shard` option, and pytest supports parallelization via `pytest-xdist` with `-n auto`. Combining this with matrix strategy to distribute across multiple jobs is effective in CI.

### Q3: Should security scanning be integrated into CI?

Yes. `npm audit`, `govulncheck`, `cargo audit`, `trivy` (Docker), and `Dependabot` are the minimum to incorporate. However, making everything blocking slows development, so a staged approach is recommended: block only Critical/High, and warn for Medium and below.

### Q4: What should I do when CI takes more than 10 minutes?

First identify which step takes the longest. Common remedies are: (1) review dependency caching, (2) parallelize tests (sharding), (3) remove unnecessary steps, (4) run lint/type-check first for early failure, (5) optimize Docker build layer caching. If still not improved, consider using Larger Runners.

### Q5: How should I configure CI for a project using multiple languages?

Split into jobs per language and use paths filters to run only for changed areas. Extract common setup steps into Composite Actions. If there are overall dependencies (e.g., frontend build required for backend tests), control with `needs`.

### Q6: How do I run tests that use a database in CI?

Use GitHub Actions' `services` feature to launch containers for PostgreSQL, MySQL, Redis, etc. as sidecars. Configure `--health-cmd` in `options` to ensure the database is fully started before running tests. See the Django CI recipe (section 2.4).

### Q7: How should CI be configured for Dependabot / Renovate update PRs?

Running the same CI as regular PRs is the baseline. Additionally, configuring auto-merge for PRs labeled `dependabot` makes operations easier.

```yaml
name: Auto-merge Dependabot
on:
  pull_request:

permissions:
  contents: write
  pull-requests: write

jobs:
  auto-merge:
    if: github.actor == 'dependabot[bot]'
    runs-on: ubuntu-latest
    steps:
      - uses: dependabot/fetch-metadata@v2
        id: metadata

      # Auto-merge only patch/minor updates
      - if: steps.metadata.outputs.update-type != 'version-update:semver-major'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 10. CI Metrics and Visualization

### 10.1 Tracking CI Performance

```yaml
# .github/workflows/ci-metrics.yml — CI metrics collection
name: CI Metrics Collection

on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]

jobs:
  collect-metrics:
    runs-on: ubuntu-latest
    permissions:
      actions: read
    steps:
      - name: Collect workflow metrics
        uses: actions/github-script@v7
        with:
          script: |
            const run = context.payload.workflow_run;
            const jobs = await github.rest.actions.listJobsForWorkflowRun({
              owner: context.repo.owner,
              repo: context.repo.repo,
              run_id: run.id,
            });

            const metrics = {
              workflow_name: run.name,
              run_id: run.id,
              conclusion: run.conclusion,
              duration_seconds: Math.round(
                (new Date(run.updated_at) - new Date(run.run_started_at)) / 1000
              ),
              branch: run.head_branch,
              commit_sha: run.head_sha,
              jobs: jobs.data.jobs.map(job => ({
                name: job.name,
                conclusion: job.conclusion,
                duration_seconds: Math.round(
                  (new Date(job.completed_at) - new Date(job.started_at)) / 1000
                ),
                steps: job.steps?.map(step => ({
                  name: step.name,
                  conclusion: step.conclusion,
                  duration_seconds: step.completed_at && step.started_at
                    ? Math.round(
                        (new Date(step.completed_at) - new Date(step.started_at)) / 1000
                      )
                    : 0,
                })),
              })),
            };

            console.log(JSON.stringify(metrics, null, 2));

            // Send to CloudWatch / Datadog / Grafana, etc.
            // await fetch('https://metrics.example.com/ci', {
            //   method: 'POST',
            //   body: JSON.stringify(metrics),
            // });
```

### 10.2 Test Coverage PR Comment

```yaml
# Post test coverage as a PR comment
- name: Run Tests with Coverage
  run: npx vitest run --coverage --reporter=json --outputFile=coverage.json

- name: Post Coverage Comment
  if: github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      const fs = require('fs');
      const coverage = JSON.parse(fs.readFileSync('coverage.json', 'utf8'));
      const summary = coverage.total;

      const table = [
        '| Metric | Coverage |',
        '|--------|----------|',
        `| Statements | ${summary.statements.pct}% |`,
        `| Branches | ${summary.branches.pct}% |`,
        `| Functions | ${summary.functions.pct}% |`,
        `| Lines | ${summary.lines.pct}% |`,
      ].join('\n');

      const body = `## Test Coverage Report\n\n${table}\n\n` +
        `${summary.lines.pct >= 80 ? '✅' : '⚠️'} ` +
        `Line coverage: ${summary.lines.pct}% (threshold: 80%)`;

      const { data: comments } = await github.rest.issues.listComments({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
      });

      const existing = comments.find(c => c.body.includes('Test Coverage Report'));
      if (existing) {
        await github.rest.issues.updateComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          comment_id: existing.id,
          body,
        });
      } else {
        await github.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: context.issue.number,
          body,
        });
      }
```

### 10.3 Automatic Notification on CI Failure

```yaml
# Slack notification on CI failure
- name: Notify CI Failure
  if: failure() && github.ref == 'refs/heads/main'
  uses: slackapi/slack-github-action@v2.0.0
  with:
    webhook: ${{ secrets.SLACK_CI_WEBHOOK }}
    webhook-type: incoming-webhook
    payload: |
      {
        "text": "CI Failed on main",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*CI Failed* :red_circle:\n*Branch*: `${{ github.ref_name }}`\n*Commit*: `${{ github.sha }}`\n*Author*: ${{ github.actor }}\n*<${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}|View Run>*"
            }
          }
        ]
      }
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Jumping to advanced topics without mastering the basics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional settings?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|---|---|
| Node.js | ESLint + Prettier + TypeScript + Jest/Vitest |
| Python | Ruff + mypy + pytest + bandit |
| Go | golangci-lint + go test -race + govulncheck |
| Rust | clippy + rustfmt + cargo test + cargo audit |
| Docker | Buildx + GHA cache + multi-platform |
| Java | Checkstyle + JUnit + Gradle |
| Terraform | fmt + validate + plan + tfsec |
| Common Principles | Lint first, leverage caching, complete within 10 minutes |
| Speed Optimization | Caching + parallelization + diff detection + fail fast |
| Security | Block Critical/High only, warn for Medium and below |
| Metrics | Track CI run time and success rate to drive continuous improvement |

---

## Further Reading

- [Actions Security](./04-security-actions.md) -- Supply chain protection
- [Deployment Strategies](../02-deployment/00-deployment-strategies.md) -- CD comes after CI
- [Actions Advanced](./01-actions-advanced.md) -- Details on matrix and caching

---

## References

1. GitHub. "Building and testing Node.js." https://docs.github.com/en/actions/automating-builds-and-tests/building-and-testing-nodejs
2. GitHub. "Building and testing Python." https://docs.github.com/en/actions/automating-builds-and-tests/building-and-testing-python
3. GitHub. "Publishing Docker images." https://docs.github.com/en/actions/publishing-packages/publishing-docker-images
4. Docker. "Build with GitHub Actions." https://docs.docker.com/build/ci/github-actions/
5. Playwright. "CI integration." https://playwright.dev/docs/ci
6. Rust. "CI with GitHub Actions." https://doc.rust-lang.org/cargo/guide/continuous-integration.html

# GitHub Actions Advanced

> Build advanced CI/CD pipelines using matrix builds, cache strategies, artifact management, secret management, and Environments

## What You Will Learn

1. Design cross-platform and multi-version tests using matrix strategies
2. Use caches and artifacts appropriately to speed up pipelines
3. Implement secure deployment control with secrets and Environments
4. Structure pipelines with reusable workflows and Composite Actions
5. Implement secretless cloud integration using OIDC authentication
6. Understand how to set up, operate, and secure Self-hosted runners


## Prerequisites

The following knowledge will help you understand this guide:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [GitHub Actions Basics](./00-actions-basics.md)

---

## 1. Matrix Strategy

### 1.1 Basic Matrix

```yaml
name: Matrix CI
on: [push]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node-version: [18, 20, 22]
      fail-fast: false  # 1つ失敗しても他を継続
      max-parallel: 4   # 最大並列数

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
```

```
Matrix expansion visualization:

             node-18    node-20    node-22
ubuntu     [  Job 1  ] [  Job 2  ] [  Job 3  ]
macos      [  Job 4  ] [  Job 5  ] [  Job 6  ]
windows    [  Job 7  ] [  Job 8  ] [  Job 9  ]

Total: 3 x 3 = 9 jobs run in parallel
```

### 1.2 Advanced Matrix: include / exclude

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
        node-version: [18, 20]
        # 特定の組み合わせを追加
        include:
          - os: ubuntu-latest
            node-version: 22
            experimental: true
          - os: windows-latest
            node-version: 20
        # 特定の組み合わせを除外
        exclude:
          - os: macos-latest
            node-version: 18

    continue-on-error: ${{ matrix.experimental == true }}

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
```

### 1.3 Dynamic Matrix

```yaml
jobs:
  # マトリクスの値を動的に生成
  prepare:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.set-matrix.outputs.matrix }}
    steps:
      - uses: actions/checkout@v4
      - id: set-matrix
        run: |
          # 変更されたパッケージだけをテスト対象にする
          PACKAGES=$(find packages -name "package.json" -exec dirname {} \; | jq -R -s -c 'split("\n")[:-1]')
          echo "matrix={\"package\":$PACKAGES}" >> "$GITHUB_OUTPUT"

  test:
    needs: prepare
    runs-on: ubuntu-latest
    strategy:
      matrix: ${{ fromJson(needs.prepare.outputs.matrix) }}
    steps:
      - uses: actions/checkout@v4
      - run: cd ${{ matrix.package }} && npm test
```

### 1.4 Change-Detection-Based Dynamic Matrix

In monorepo environments, targeting only changed packages for testing can significantly reduce CI time.

```yaml
name: Monorepo Dynamic Matrix
on:
  pull_request:
    branches: [main]

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.changes.outputs.matrix }}
      has_changes: ${{ steps.changes.outputs.has_changes }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # 全履歴取得（diff に必要）

      - id: changes
        run: |
          # main ブランチとの差分からパッケージを特定
          CHANGED_FILES=$(git diff --name-only origin/main...HEAD)
          echo "Changed files:"
          echo "$CHANGED_FILES"

          # 変更されたパッケージディレクトリを抽出
          PACKAGES=()
          for dir in packages/*/; do
            PKG_NAME=$(basename "$dir")
            if echo "$CHANGED_FILES" | grep -q "^packages/$PKG_NAME/"; then
              PACKAGES+=("$PKG_NAME")
            fi
          done

          # 共通ファイルの変更は全パッケージに影響
          if echo "$CHANGED_FILES" | grep -qE "^(package\.json|tsconfig\.base\.json|\.eslintrc)"; then
            PACKAGES=($(ls -d packages/*/ | xargs -n1 basename))
          fi

          if [ ${#PACKAGES[@]} -eq 0 ]; then
            echo "has_changes=false" >> "$GITHUB_OUTPUT"
            echo "matrix={\"package\":[]}" >> "$GITHUB_OUTPUT"
          else
            JSON=$(printf '%s\n' "${PACKAGES[@]}" | jq -R . | jq -s -c .)
            echo "has_changes=true" >> "$GITHUB_OUTPUT"
            echo "matrix={\"package\":$JSON}" >> "$GITHUB_OUTPUT"
          fi

  test:
    needs: detect-changes
    if: needs.detect-changes.outputs.has_changes == 'true'
    runs-on: ubuntu-latest
    strategy:
      matrix: ${{ fromJson(needs.detect-changes.outputs.matrix) }}
      fail-fast: false
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test --workspace=packages/${{ matrix.package }}
```

### 1.5 Matrix Conditional Branching Patterns

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node-version: [18, 20, 22]
        include:
          # Ubuntu + Node 22 のみでカバレッジを計測
          - os: ubuntu-latest
            node-version: 22
            coverage: true
          # Windows ではタイムアウトを長く
          - os: windows-latest
            node-version: 20
            timeout: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test

      # カバレッジは特定の組み合わせでのみ実行
      - name: Coverage
        if: matrix.coverage == true
        run: npm run test:coverage

      - name: Upload coverage
        if: matrix.coverage == true
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/

      # OS固有のステップ
      - name: Windows specific cleanup
        if: runner.os == 'Windows'
        run: |
          # Windows固有のクリーンアップ
          Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
        shell: pwsh
```

### 1.6 Matrix Job Limits and Constraints

```
Matrix limits:
┌─────────────────────────────────────────────────────┐
│ Max jobs: 256 jobs/workflow                          │
│ Max matrix size: 256 combinations                    │
│ Concurrent runners (Free): 20 (ubuntu) / 5 (macOS)  │
│ Concurrent runners (Team): 60 (ubuntu) / 5 (macOS)  │
│ Concurrent runners (Ent): 500 (ubuntu) / 50 (macOS) │
│                                                       │
│ Recommended max-parallel values:                      │
│   Free   → 3-5 (accounting for shared runners)       │
│   Team   → 10-20                                      │
│   Ent    → 50-100                                     │
└─────────────────────────────────────────────────────┘

Cost calculation:
  Matrix 3 OS x 3 Node x 10 min/job = 90 minutes consumed
  macOS costs 10x more than Linux
  → Keep macOS matrix to a minimum
```

---

## 2. Cache Strategy

### 2.1 Caching Dependencies

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # 方法1: setup-node の組み込みキャッシュ (推奨)
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'  # package-lock.json のハッシュがキー

      # 方法2: 明示的なキャッシュ (より細かい制御)
      - uses: actions/cache@v4
        id: npm-cache
        with:
          path: node_modules
          key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-node-

      - name: Install (cache miss only)
        if: steps.npm-cache.outputs.cache-hit != 'true'
        run: npm ci

      - run: npm test
```

### 2.2 How Caching Works

```
Cache lifecycle:

  First run (cache miss):
  ┌─────────┐    ┌──────────────┐    ┌──────────┐
  │ npm ci   │ →  │ node_modules │ →  │  Save to │
  │ (90s)    │    │  generated   │    │  cache   │
  └─────────┘    └──────────────┘    └──────────┘

  Subsequent runs (cache hit):
  ┌──────────┐    ┌──────────────┐
  │ Restore  │ →  │ node_modules │    npm ci skipped!
  │ from     │    │ (3s)         │    87 seconds saved
  │ cache    │    └──────────────┘
  └──────────┘

How keys work:
  key: Linux-node-abc123def456
                   └── hashFiles('package-lock.json')

  Cache hits as long as package-lock.json does not change.
  If it changes, restore-keys provides a partial match → npm ci runs.
```

### 2.3 Language-Specific Cache Configuration

```yaml
# Python (pip)
- uses: actions/setup-python@v5
  with:
    python-version: '3.12'
    cache: 'pip'

# Go
- uses: actions/setup-go@v5
  with:
    go-version: '1.22'
    cache: true

# Rust (手動キャッシュ)
- uses: actions/cache@v4
  with:
    path: |
      ~/.cargo/bin/
      ~/.cargo/registry/index/
      ~/.cargo/registry/cache/
      target/
    key: ${{ runner.os }}-cargo-${{ hashFiles('Cargo.lock') }}

# Docker レイヤーキャッシュ
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

### 2.4 Advanced Cache Patterns

```yaml
# パターン1: 複合キーによる段階的フォールバック
- uses: actions/cache@v4
  with:
    path: |
      node_modules
      ~/.npm
    key: ${{ runner.os }}-node-${{ matrix.node-version }}-${{ hashFiles('package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-${{ matrix.node-version }}-
      ${{ runner.os }}-node-
      ${{ runner.os }}-

# パターン2: ビルドキャッシュ (Next.js)
- uses: actions/cache@v4
  with:
    path: |
      ${{ github.workspace }}/.next/cache
    key: ${{ runner.os }}-nextjs-${{ hashFiles('package-lock.json') }}-${{ hashFiles('**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx') }}
    restore-keys: |
      ${{ runner.os }}-nextjs-${{ hashFiles('package-lock.json') }}-

# パターン3: Gradle ビルドキャッシュ
- uses: actions/cache@v4
  with:
    path: |
      ~/.gradle/caches
      ~/.gradle/wrapper
    key: ${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle*', '**/gradle-wrapper.properties') }}
    restore-keys: |
      ${{ runner.os }}-gradle-
```

### 2.5 Cache Scope and Lifecycle

```
Cache scope hierarchy:

  Branch feature/xyz
       ↓ search
  ┌──────────────────────┐
  │ Cache for feature/xyz │ ← searched first
  └──────────┬───────────┘
             │ miss
             ↓
  ┌──────────────────────┐
  │ Cache for main        │ ← fallback to default branch
  └──────────┬───────────┘
             │ miss
             ↓
  ┌──────────────────────┐
  │ No cache → npm ci     │ ← full run
  └──────────────────────┘

Cache lifecycle management:
  - Max size: 10GB/repository
  - Auto-deleted after 7 days of no access
  - FIFO (oldest caches deleted first)
  - Manual clear: GitHub UI or gh CLI
    gh cache list
    gh cache delete <key>
    gh actions-cache delete --all  # delete all caches
```

### 2.6 Measuring and Optimizing Cache Efficiency

```yaml
name: Cache Efficiency Report
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - name: Check cache stats
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          echo "## Cache Usage Report"
          echo ""

          # キャッシュ一覧を取得
          CACHES=$(gh cache list --repo ${{ github.repository }} --json key,sizeInBytes,lastAccessedAt)

          # 合計サイズ
          TOTAL=$(echo "$CACHES" | jq '[.[].sizeInBytes] | add // 0')
          echo "Total cache size: $(numfmt --to=iec $TOTAL)"

          # 7日以上アクセスのないキャッシュ
          STALE=$(echo "$CACHES" | jq '[.[] | select(
            (.lastAccessedAt | fromdateiso8601) < (now - 604800)
          )] | length')
          echo "Stale caches (>7 days): $STALE"

          # サイズが大きいキャッシュ Top 5
          echo ""
          echo "### Top 5 largest caches:"
          echo "$CACHES" | jq -r 'sort_by(-.sizeInBytes) | .[0:5] | .[] |
            "\(.key): \(.sizeInBytes / 1048576 | floor)MB"'
```

---

## 3. Artifact Management

### 3.1 Use Cases for Artifacts

```
Cache vs Artifact:

  Cache (actions/cache):
  ┌──────────────────────────────────┐
  │ Purpose: Speed up builds         │
  │ Retention: Branch-scoped, 7 days │
  │ Sharing: Between jobs in same    │
  │          workflow                │
  │ Examples: node_modules, .cache   │
  └──────────────────────────────────┘

  Artifact (actions/upload-artifact):
  ┌──────────────────────────────────┐
  │ Purpose: Save and pass build     │
  │          outputs                 │
  │ Retention: Configurable (1-90d)  │
  │ Sharing: Between jobs + UI       │
  │          download                │
  │ Examples: dist/, coverage/, logs/│
  └──────────────────────────────────┘
```

### 3.2 Passing Artifacts Between Jobs

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build

      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: dist/
          retention-days: 1       # 短期保存
          if-no-files-found: error # ファイルがなければエラー

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: build-output
          path: dist/

      - run: ls -la dist/  # ビルド成果物を確認
      - run: ./deploy.sh dist/

  test-report:
    needs: build
    if: always()  # ビルドが失敗してもレポートは取得
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: build-output
          path: dist/
```

### 3.3 Merging Multiple Artifacts

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test

      # OS ごとにユニークな名前で保存
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results-${{ matrix.os }}
          path: |
            test-results/
            coverage/
          retention-days: 5

  merge-reports:
    needs: test
    if: always()
    runs-on: ubuntu-latest
    steps:
      # 全アーティファクトを一括ダウンロード
      - uses: actions/download-artifact@v4
        with:
          pattern: test-results-*
          merge-multiple: true   # v4 の新機能: 複数を統合
          path: all-results/

      - name: Generate combined report
        run: |
          echo "## Test Results Summary"
          for dir in all-results/*/; do
            OS_NAME=$(basename "$dir")
            PASS=$(grep -c "PASS" "$dir/results.txt" || true)
            FAIL=$(grep -c "FAIL" "$dir/results.txt" || true)
            echo "- $OS_NAME: $PASS passed, $FAIL failed"
          done

      - uses: actions/upload-artifact@v4
        with:
          name: combined-report
          path: combined-report.html
          retention-days: 30
```

### 3.4 Optimizing Artifact Size

```yaml
steps:
  - name: Build
    run: npm run build

  # 悪い例: 不要なファイルを含む
  # - uses: actions/upload-artifact@v4
  #   with:
  #     name: build
  #     path: .   # リポジトリ全体！

  # 良い例: 必要なファイルのみ
  - uses: actions/upload-artifact@v4
    with:
      name: build
      path: |
        dist/
        !dist/**/*.map       # Source map を除外
        !dist/**/*.test.*    # テストファイルを除外
      compression-level: 9   # 最大圧縮
      retention-days: 1      # 短期保存

  # テスト結果: 要約のみアップロード
  - name: Minimize test output
    if: always()
    run: |
      # 大きなスナップショットファイルを除外
      find test-results -name "*.snap" -delete
      # HTMLレポートを圧縮
      tar czf test-report.tar.gz test-results/

  - uses: actions/upload-artifact@v4
    if: always()
    with:
      name: test-report
      path: test-report.tar.gz
      retention-days: 7
```

---

## 4. Secret Management

### 4.1 Types of Secrets

```yaml
# Repository Secrets: per repository
# Organization Secrets: shared across multiple repos in an org
# Environment Secrets: different values per environment (staging/prod)

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production  # Use Environment Secrets
    steps:
      # Referencing secrets
      - name: Deploy
        run: ./deploy.sh
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          API_KEY: ${{ secrets.API_KEY }}

      # Note: secrets are masked in logs
      - run: echo "${{ secrets.API_KEY }}"
        # Output: ***
```

### 4.2 GITHUB_TOKEN

```yaml
jobs:
  pr-comment:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write  # 必要な権限のみ付与
    steps:
      - uses: actions/github-script@v7
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          script: |
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: 'CI passed! Ready for review.'
            })
```

### 4.3 GITHUB_TOKEN Permission Model

```yaml
# GITHUB_TOKEN のデフォルト権限 (リポジトリ設定で制御)
# "Read repository contents and packages permissions" (推奨)
# または "Read and write permissions" (レガシー)

# Explicitly specify permissions at the workflow level
permissions:
  contents: read          # Read repository contents
  pull-requests: write    # Comment on PRs
  issues: write           # Manage issues
  packages: write         # Publish packages
  deployments: write      # Update deployment status
  statuses: write         # Update commit statuses
  checks: write           # Create/update checks
  id-token: write         # Obtain OIDC token

# Job-level permissions (take precedence over workflow-level)
jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4

  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write     # Required for AWS OIDC authentication
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/deploy-role
          aws-region: ap-northeast-1
```

### 4.4 Secretless Authentication with OIDC (OpenID Connect)

```yaml
# Traditional: long-lived access keys stored as secrets
# OIDC: dynamically obtain short-lived tokens (no key management required)

name: Deploy with OIDC
on:
  push:
    branches: [main]

permissions:
  id-token: write   # Required to obtain OIDC token
  contents: read

jobs:
  deploy-aws:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # AWS OIDC 認証
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions-deploy
          aws-region: ap-northeast-1
          # audience: sts.amazonaws.com  # デフォルト

      - run: aws s3 sync ./dist s3://my-bucket/

  deploy-gcp:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # GCP OIDC 認証
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: 'projects/123456/locations/global/workloadIdentityPools/github-pool/providers/github-provider'
          service_account: 'deploy@my-project.iam.gserviceaccount.com'

      - uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: my-service
          region: asia-northeast1
          image: gcr.io/my-project/my-app:${{ github.sha }}

  deploy-azure:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Azure OIDC 認証
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - uses: azure/webapps-deploy@v3
        with:
          app-name: my-web-app
          package: ./dist
```

```
OIDC authentication flow:

  GitHub Actions Runner        GitHub OIDC Provider        Cloud Provider (AWS/GCP/Azure)
       │                              │                              │
       │  1. Request OIDC token       │                              │
       │─────────────────────────────→│                              │
       │                              │                              │
       │  2. Issue JWT token          │                              │
       │  (sub: repo, ref, etc.)      │                              │
       │←─────────────────────────────│                              │
       │                              │                              │
       │  3. Request temp credentials using JWT                       │
       │──────────────────────────────────────────────────────────────→│
       │                              │                              │
       │                              │  4. Validate JWT             │
       │                              │←─────────────────────────────│
       │                              │                              │
       │  5. Return temporary access token                            │
       │←──────────────────────────────────────────────────────────────│
       │                              │                              │
       │  6. Call API with temp token                                  │
       │──────────────────────────────────────────────────────────────→│

Benefits:
  - No long-lived secrets required
  - Tokens expire quickly (default 1 hour)
  - Authentication scope can be limited by branch or tag
  - No secret rotation needed
```

### 4.5 Integration with External Secret Managers

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      # HashiCorp Vault からシークレットを取得
      - uses: hashicorp/vault-action@v3
        with:
          url: https://vault.example.com
          method: jwt
          role: github-actions
          jwtGithubAudience: https://vault.example.com
          secrets: |
            secret/data/prod/db DB_PASSWORD | DB_PASSWORD ;
            secret/data/prod/api API_KEY | API_KEY

      - run: ./deploy.sh
        env:
          DB_PASSWORD: ${{ env.DB_PASSWORD }}
          API_KEY: ${{ env.API_KEY }}

      # AWS Secrets Manager からシークレットを取得
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ap-northeast-1

      - name: Get secrets from AWS Secrets Manager
        run: |
          SECRET_JSON=$(aws secretsmanager get-secret-value \
            --secret-id prod/app/config \
            --query SecretString \
            --output text)
          echo "DB_HOST=$(echo $SECRET_JSON | jq -r .db_host)" >> "$GITHUB_ENV"
          # シークレット値をマスク
          echo "::add-mask::$(echo $SECRET_JSON | jq -r .db_password)"
          echo "DB_PASSWORD=$(echo $SECRET_JSON | jq -r .db_password)" >> "$GITHUB_ENV"
```

### 4.6 Security Best Practices for Secrets

```
Secret management best practices:

  1. Principle of Least Privilege
     ┌───────────────────────────────────┐
     │ - Prefer Repository over Org      │
     │ - Isolate per env with Environments│
     │ - Restrict GITHUB_TOKEN with      │
     │   permissions                     │
     └───────────────────────────────────┘

  2. Rotation
     ┌───────────────────────────────────┐
     │ - Rotate within 90 days           │
     │ - Eliminate long-lived keys with  │
     │   OIDC                            │
     │ - Automate with Vault/SecretsManager│
     └───────────────────────────────────┘

  3. Auditing
     ┌───────────────────────────────────┐
     │ - Check secret access in audit log│
     │ - Enable GitHub Secret scanning   │
     │ - Verify secrets don't leak in PRs│
     └───────────────────────────────────┘

  4. Fork protection
     ┌───────────────────────────────────┐
     │ - Secrets are not passed to PRs   │
     │   from forks (pull_request)       │
     │ - Use pull_request_target with    │
     │   caution                         │
     │ - Only allow approved forks to    │
     │   build                           │
     └───────────────────────────────────┘
```

---

## 5. Environments

### 5.1 Configuring Environments

```yaml
jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.example.com
    steps:
      - run: ./deploy.sh staging

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://example.com
    # Configure the production environment with:
    # - Required reviewers: 2 approvals required
    # - Wait timer: 5-minute wait time
    # - Deployment branches: main only
    steps:
      - run: ./deploy.sh production
```

```
Environment deployment flow:

  PR merge to main
       │
       ↓
  ┌──────────┐
  │ CI Tests  │
  └────┬─────┘
       │
       ↓
  ┌──────────────────────┐
  │ Deploy to Staging     │ ← environment: staging
  │ (automatic)           │
  └────┬─────────────────┘
       │
       ↓
  ┌──────────────────────┐
  │ Waiting for approval  │ ← Required reviewers
  │ (Slack notification)  │
  └────┬─────────────────┘
       │ approved
       ↓
  ┌──────────────────────┐
  │ Wait Timer (5 min)    │ ← Final confirmation window
  └────┬─────────────────┘
       │
       ↓
  ┌──────────────────────┐
  │ Deploy to Production  │ ← environment: production
  │ (auto after approval) │
  └──────────────────────┘
```

### 5.2 Multi-Stage Deploy Pipeline

```yaml
name: Multi-stage Deploy
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      image_tag: ${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v4

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: type=sha,prefix=

      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-dev:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: development
      url: https://dev.example.com
    steps:
      - uses: actions/checkout@v4
      - run: |
          helm upgrade --install my-app ./charts/my-app \
            --set image.tag=${{ needs.build.outputs.image_tag }} \
            --namespace dev

  integration-tests:
    needs: deploy-dev
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run test:integration
        env:
          BASE_URL: https://dev.example.com

  deploy-staging:
    needs: integration-tests
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.example.com
    steps:
      - uses: actions/checkout@v4
      - run: |
          helm upgrade --install my-app ./charts/my-app \
            --set image.tag=${{ needs.build.outputs.image_tag }} \
            --namespace staging

  smoke-tests:
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          # ヘルスチェック
          for i in {1..30}; do
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://staging.example.com/health)
            if [ "$STATUS" = "200" ]; then
              echo "Health check passed"
              exit 0
            fi
            echo "Waiting... ($i/30)"
            sleep 10
          done
          echo "Health check failed"
          exit 1

      - run: npm run test:smoke
        env:
          BASE_URL: https://staging.example.com

  deploy-production:
    needs: smoke-tests
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://example.com
    steps:
      - uses: actions/checkout@v4
      - run: |
          helm upgrade --install my-app ./charts/my-app \
            --set image.tag=${{ needs.build.outputs.image_tag }} \
            --namespace production

  post-deploy-verification:
    needs: deploy-production
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run test:smoke
        env:
          BASE_URL: https://example.com

      # Deploy notification
      - uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Production deploy completed: ${{ needs.build.outputs.image_tag }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### 5.3 Environment Variables and Per-Environment Configuration

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment || 'staging' }}
    steps:
      - uses: actions/checkout@v4

      # Load per-environment config file
      - name: Load environment config
        run: |
          ENV_NAME=${{ github.event.inputs.environment || 'staging' }}
          if [ -f "config/${ENV_NAME}.env" ]; then
            # .env ファイルから環境変数を読み込み
            while IFS= read -r line; do
              # コメントと空行をスキップ
              [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
              echo "$line" >> "$GITHUB_ENV"
            done < "config/${ENV_NAME}.env"
          fi

      - name: Deploy with environment-specific config
        run: |
          echo "Deploying to: $DEPLOY_TARGET"
          echo "Replicas: $REPLICAS"
          echo "Region: $AWS_REGION"
          ./deploy.sh
```

### 5.4 Custom Deployment Protection Rules

```
List of environment protection rules:

  ┌────────────────────────────────────────────────────┐
  │ Required reviewers                                   │
  │ - Up to 6 people specified                          │
  │ - Proceed with at least 1 approval                  │
  │ - Teams can be specified                            │
  ├────────────────────────────────────────────────────┤
  │ Wait timer                                           │
  │ - 0-43200 minutes (up to 30 days)                   │
  │ - Additional wait time after approval               │
  │ - Can be cancelled                                  │
  ├────────────────────────────────────────────────────┤
  │ Deployment branches                                  │
  │ - All branches: no restriction                      │
  │ - Protected branches: protected branches only       │
  │ - Selected branches: specify by pattern             │
  │   Example: main, release/*                         │
  ├────────────────────────────────────────────────────┤
  │ Custom deployment protection rules                   │
  │ - External checks via GitHub App                    │
  │ - Example: Datadog monitoring check                 │
  │ - Example: PagerDuty incident status check          │
  │ - Example: approval workflow (ServiceNow, etc.)     │
  └────────────────────────────────────────────────────┘
```

---

## 6. Reusable Workflows

### 6.1 Defining a Reusable Workflow

```yaml
# .github/workflows/reusable-build.yml
name: Reusable Build Workflow
on:
  workflow_call:
    inputs:
      node-version:
        description: 'Node.js version'
        required: false
        type: string
        default: '20'
      environment:
        description: 'Target environment'
        required: true
        type: string
      deploy:
        description: 'Whether to deploy'
        required: false
        type: boolean
        default: false
    secrets:
      npm-token:
        description: 'NPM authentication token'
        required: false
      deploy-key:
        description: 'Deployment SSH key'
        required: false
    outputs:
      artifact-name:
        description: 'Name of the uploaded artifact'
        value: ${{ jobs.build.outputs.artifact-name }}

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      artifact-name: ${{ steps.upload.outputs.artifact-name }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
          cache: 'npm'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci
        env:
          NODE_AUTH_TOKEN: ${{ secrets.npm-token }}

      - run: npm run build -- --mode ${{ inputs.environment }}

      - run: npm test

      - id: upload
        uses: actions/upload-artifact@v4
        with:
          name: build-${{ inputs.environment }}-${{ github.sha }}
          path: dist/
          retention-days: 7

      - name: Deploy
        if: inputs.deploy
        run: ./deploy.sh ${{ inputs.environment }}
        env:
          DEPLOY_KEY: ${{ secrets.deploy-key }}
```

### 6.2 Calling a Reusable Workflow

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline
on:
  push:
    branches: [main]
  pull_request:

jobs:
  # Build only on PRs
  build-pr:
    if: github.event_name == 'pull_request'
    uses: ./.github/workflows/reusable-build.yml
    with:
      environment: development
      deploy: false
    secrets:
      npm-token: ${{ secrets.NPM_TOKEN }}

  # Deploy to staging on merge to main
  build-staging:
    if: github.ref == 'refs/heads/main'
    uses: ./.github/workflows/reusable-build.yml
    with:
      environment: staging
      deploy: true
    secrets:
      npm-token: ${{ secrets.NPM_TOKEN }}
      deploy-key: ${{ secrets.STAGING_DEPLOY_KEY }}

  # Deploy to production after staging succeeds
  build-production:
    needs: build-staging
    if: github.ref == 'refs/heads/main'
    uses: ./.github/workflows/reusable-build.yml
    with:
      environment: production
      deploy: true
    secrets:
      npm-token: ${{ secrets.NPM_TOKEN }}
      deploy-key: ${{ secrets.PRODUCTION_DEPLOY_KEY }}

  # Call a workflow from another repository
  shared-security-scan:
    uses: my-org/shared-workflows/.github/workflows/security-scan.yml@v2
    with:
      scan-level: full
    secrets: inherit  # Inherit all secrets
```

### 6.3 Composite Actions

```yaml
# .github/actions/setup-project/action.yml
name: 'Setup Project'
description: 'Setup Node.js, install dependencies, and prepare the project'
inputs:
  node-version:
    description: 'Node.js version'
    required: false
    default: '20'
  install-playwright:
    description: 'Install Playwright browsers'
    required: false
    default: 'false'
runs:
  using: 'composite'
  steps:
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
        cache: 'npm'

    - name: Install dependencies
      shell: bash
      run: npm ci

    - name: Install Playwright
      if: inputs.install-playwright == 'true'
      shell: bash
      run: npx playwright install --with-deps chromium

    - name: Cache Playwright browsers
      if: inputs.install-playwright == 'true'
      uses: actions/cache@v4
      with:
        path: ~/.cache/ms-playwright
        key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
```

```yaml
# Usage example
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-project
        with:
          install-playwright: 'true'
      - run: npm test
      - run: npx playwright test
```

### 6.4 Reusable Workflow vs Composite Actions Comparison

```
Reusable Workflow vs Composite Actions:

┌─────────────────┬────────────────────────┬────────────────────────┐
│ Item            │ Reusable Workflow       │ Composite Action       │
├─────────────────┼────────────────────────┼────────────────────────┤
│ Reuse unit      │ Entire workflow         │ Collection of steps    │
│ Job definition  │ Possible (multi-job)   │ Not possible           │
│ Secrets         │ Explicit / inherit      │ Auto-inherited         │
│ Env spec        │ Inside workflow         │ In calling job         │
│ Nesting         │ Max 4 levels            │ Max 10 levels          │
│ Conditions      │ Job/step level          │ Step level             │
│ Call syntax     │ uses: org/repo/...@ref │ uses: ./.github/actions│
│ Typical use     │ Full CI/CD pipelines    │ Setup, common tasks    │
└─────────────────┴────────────────────────┴────────────────────────┘

When to use which:
  - Common setup steps → Composite Action
  - Common CI/CD pipeline → Reusable Workflow
  - Shared across multiple repositories → Reusable Workflow (external ref)
  - Local repetition → Composite Action
```

---

## 7. Self-hosted Runner

### 7.1 Self-hosted Runner Architecture

```
Runner architecture:

  GitHub.com                           Organization infrastructure
  ┌────────────┐                      ┌─────────────────────┐
  │ Workflow    │ ← Long Poll →       │ Self-hosted Runner  │
  │ queue       │                      │                     │
  │             │  Job assignment       │ ┌─────────────────┐ │
  │             │─────────────────────→│ │ Runner Agent     │ │
  │             │                      │ │ (always running) │ │
  │             │  Result report        │ └────────┬────────┘ │
  │             │←─────────────────────│          │           │
  └────────────┘                      │ ┌────────↓────────┐ │
                                      │ │ Job execution    │ │
                                      │ │ environment      │ │
                                      │ │ (Docker/VM)      │ │
                                      │ └─────────────────┘ │
                                      └─────────────────────┘
```

### 7.2 Self-hosted Runner on Kubernetes (ARC)

```yaml
# Actions Runner Controller (ARC) のデプロイ
# Helm で ARC をインストール
# helm install arc \
#   --namespace arc-systems \
#   oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set-controller

# RunnerScaleSet の定義
apiVersion: actions.github.com/v1alpha1
kind: AutoscalingRunnerSet
metadata:
  name: my-runners
  namespace: arc-runners
spec:
  githubConfigUrl: "https://github.com/my-org"
  githubConfigSecret: github-config-secret
  maxRunners: 20
  minRunners: 2
  template:
    spec:
      containers:
        - name: runner
          image: ghcr.io/actions/actions-runner:latest
          resources:
            requests:
              cpu: "2"
              memory: "4Gi"
            limits:
              cpu: "4"
              memory: "8Gi"
          volumeMounts:
            - name: work
              mountPath: /home/runner/_work
            - name: docker-sock
              mountPath: /var/run/docker.sock
      volumes:
        - name: work
          emptyDir: {}
        - name: docker-sock
          hostPath:
            path: /var/run/docker.sock
```

```yaml
# Using Self-hosted Runner in a workflow
jobs:
  build:
    runs-on: arc-runner-set  # Runner set name defined in ARC
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build

  # Specify a particular runner using labels
  gpu-test:
    runs-on: [self-hosted, linux, gpu, a100]
    steps:
      - uses: actions/checkout@v4
      - run: python train.py --test

  # Choosing between GitHub-hosted and Self-hosted
  lint:
    runs-on: ubuntu-latest  # Lightweight tasks on GitHub-hosted
    steps:
      - uses: actions/checkout@v4
      - run: npm run lint

  heavy-build:
    runs-on: [self-hosted, linux, x64, large]  # Heavy tasks on Self-hosted
    steps:
      - uses: actions/checkout@v4
      - run: npm run build:all
```

### 7.3 Self-hosted Runner Security

```
Self-hosted runner security considerations:

  1. Runner isolation
     ┌──────────────────────────────────────────┐
     │ - Do not use with public repositories    │
     │ - Use ephemeral environments             │
     │ - Isolate execution with Docker-in-Docker│
     │ - Ensure a clean environment per job     │
     └──────────────────────────────────────────┘

  2. Ephemeral runners
     ┌──────────────────────────────────────────┐
     │ - Use --ephemeral flag to exit after 1   │
     │   job                                    │
     │ - No leftover artifacts from prior jobs  │
     │ - ARC uses ephemeral mode by default     │
     └──────────────────────────────────────────┘

  3. Network isolation
     ┌──────────────────────────────────────────┐
     │ - Restrict outbound access from runners  │
     │ - Whitelist only required endpoints:     │
     │   - github.com                           │
     │   - api.github.com                       │
     │   - *.actions.githubusercontent.com      │
     │   - ghcr.io (container registry)         │
     │ - Control internal network access via VPC│
     └──────────────────────────────────────────┘

  4. Permission management
     ┌──────────────────────────────────────────┐
     │ - Run runners as non-root user           │
     │ - Minimize sudo privileges               │
     │ - Restrict write access to filesystem    │
     │ - Isolate with network namespaces        │
     └──────────────────────────────────────────┘
```

---

## 8. Debugging and Troubleshooting Workflows

### 8.1 Enabling Debug Logs

```yaml
# Method 1: Set via repository secrets
# ACTIONS_RUNNER_DEBUG = true
# ACTIONS_STEP_DEBUG = true

# Method 2: Output debug info within the workflow
steps:
  - name: Debug context
    run: |
      echo "Event name: ${{ github.event_name }}"
      echo "Ref: ${{ github.ref }}"
      echo "SHA: ${{ github.sha }}"
      echo "Actor: ${{ github.actor }}"
      echo "Workflow: ${{ github.workflow }}"
      echo "Run ID: ${{ github.run_id }}"
      echo "Run number: ${{ github.run_number }}"
      echo "Run attempt: ${{ github.run_attempt }}"

  - name: Dump contexts
    env:
      GITHUB_CONTEXT: ${{ toJson(github) }}
      JOB_CONTEXT: ${{ toJson(job) }}
      STEPS_CONTEXT: ${{ toJson(steps) }}
    run: |
      echo "::group::GitHub Context"
      echo "$GITHUB_CONTEXT"
      echo "::endgroup::"
      echo "::group::Job Context"
      echo "$JOB_CONTEXT"
      echo "::endgroup::"
      echo "::group::Steps Context"
      echo "$STEPS_CONTEXT"
      echo "::endgroup::"
```

### 8.2 Common Errors and Solutions

```yaml
# Error 1: "Resource not accessible by integration"
# Cause: Insufficient GITHUB_TOKEN permissions
# Solution:
permissions:
  contents: read
  pull-requests: write  # Add required permission for PR operations

# Error 2: "No space left on device"
# Cause: Runner disk space exhausted
# Solution:
steps:
  - name: Free disk space
    run: |
      # Remove unnecessary pre-installed software
      sudo rm -rf /usr/share/dotnet
      sudo rm -rf /opt/ghc
      sudo rm -rf /usr/local/share/boost
      sudo rm -rf "$AGENT_TOOLSDIRECTORY"
      df -h

# Error 3: "The job was not started because recent account payments have failed"
# Cause: GitHub Actions billing issue
# Solution: Update payment information

# Error 4: Cache is not restored
# Cause: Key mismatch or branch scope issue
# Solution:
steps:
  - name: Debug cache
    run: |
      echo "Expected key: ${{ runner.os }}-node-$(sha256sum package-lock.json | cut -d ' ' -f1)"
      # Check cache list
      gh cache list --limit 20
    env:
      GH_TOKEN: ${{ github.token }}

# Error 5: "Error: Process completed with exit code 1"
# Cause: Script execution error
# Solution: Use set -euo pipefail with error handling
steps:
  - name: Run with error handling
    run: |
      set -euo pipefail
      # Output info on error
      trap 'echo "Error on line $LINENO. Exit code: $?"' ERR
      # Actual command
      npm run build 2>&1 | tee build.log
    shell: bash

# Error 6: Timeout
# Cause: Job exceeded runtime limit (default 6 hours)
# Solution:
jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 30  # Job-level timeout
    steps:
      - name: Long running task
        timeout-minutes: 10  # Step-level timeout
        run: npm run build
```

### 8.3 Workflow Re-runs and Retries

```yaml
# Implementing automatic retry
jobs:
  flaky-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci

      # Run tests with retry
      - name: Run tests with retry
        uses: nick-fields/retry@v3
        with:
          timeout_minutes: 10
          max_attempts: 3
          retry_wait_seconds: 30
          command: npm test

      # Retry using shell script
      - name: Deploy with retry
        run: |
          MAX_RETRIES=3
          RETRY_DELAY=10
          for i in $(seq 1 $MAX_RETRIES); do
            echo "Attempt $i of $MAX_RETRIES"
            if ./deploy.sh; then
              echo "Deploy succeeded on attempt $i"
              exit 0
            fi
            if [ $i -lt $MAX_RETRIES ]; then
              echo "Retrying in ${RETRY_DELAY}s..."
              sleep $RETRY_DELAY
              RETRY_DELAY=$((RETRY_DELAY * 2))  # Exponential backoff
            fi
          done
          echo "All retries failed"
          exit 1
```

---

## 9. Performance Optimization

### 9.1 Analyzing Workflow Run Times

```
Performance optimization checklist:

  1. Bottleneck analysis
     ┌─────────────────────────────────────────┐
     │ - Check step durations in Actions tab   │
     │ - Identify the slowest steps            │
     │ - Monitor cache hit rates               │
     └─────────────────────────────────────────┘

  2. Parallelization
     ┌─────────────────────────────────────────┐
     │ - Run independent jobs in parallel      │
     │ - Test multiple environments in parallel│
     │   using matrix                          │
     │ - Parallelize builds and linting        │
     └─────────────────────────────────────────┘

  3. Cache utilization
     ┌─────────────────────────────────────────┐
     │ - Dependency cache                      │
     │ - Build cache (Next.js, Webpack, etc.)  │
     │ - Docker layer cache                    │
     │ - Test snapshot cache                   │
     └─────────────────────────────────────────┘

  4. Reducing unnecessary work
     ┌─────────────────────────────────────────┐
     │ - Use path filters to run only on       │
     │   changed files                         │
     │ - Skip via change detection             │
     │ - Fail fast (lint → build → test)       │
     └─────────────────────────────────────────┘
```

### 9.2 Efficient Pipeline Design

```yaml
name: Optimized Pipeline
on:
  pull_request:
    branches: [main]
    paths-ignore:
      - '**/*.md'
      - 'docs/**'
      - '.github/ISSUE_TEMPLATE/**'

# Prevent concurrent runs on the same PR
concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref || github.ref }}
  cancel-in-progress: true

jobs:
  # Lint first (fastest to detect failures)
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  # Build after lint passes
  build:
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build
          path: dist/
          retention-days: 1

  # Run tests in parallel using build artifact
  unit-test:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit -- --shard=1/2

  unit-test-2:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit -- --shard=2/2

  e2e-test:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - uses: actions/download-artifact@v4
        with:
          name: build
          path: dist/
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```

### 9.3 Test Sharding

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci

      # Jest sharding
      - run: npx jest --shard=${{ matrix.shard }}/4

      # Playwright sharding
      - run: npx playwright test --shard=${{ matrix.shard }}/4

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results-shard-${{ matrix.shard }}
          path: test-results/

  merge-results:
    needs: test
    if: always()
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          pattern: test-results-shard-*
          merge-multiple: true
          path: all-results/

      - name: Generate report
        run: |
          # Merge test results and generate report
          npx jest-html-reporter --input all-results/ --output report.html
```

---

## 10. Release Automation

### 10.1 Semantic Versioning and Releases

```yaml
name: Release
on:
  push:
    tags:
      - 'v*.*.*'

permissions:
  contents: write
  packages: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # 全タグ取得

      - name: Get version from tag
        id: version
        run: |
          TAG=${GITHUB_REF#refs/tags/}
          VERSION=${TAG#v}
          echo "tag=$TAG" >> "$GITHUB_OUTPUT"
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"

          # Get previous tag (for release notes generation)
          PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
          echo "prev_tag=$PREV_TAG" >> "$GITHUB_OUTPUT"

      - name: Generate changelog
        id: changelog
        run: |
          if [ -n "${{ steps.version.outputs.prev_tag }}" ]; then
            CHANGES=$(git log ${{ steps.version.outputs.prev_tag }}..HEAD \
              --pretty=format:"- %s (%h)" --no-merges)
          else
            CHANGES=$(git log --pretty=format:"- %s (%h)" --no-merges)
          fi

          # Categorize changes
          FEATURES=$(echo "$CHANGES" | grep -i "^- feat" || true)
          FIXES=$(echo "$CHANGES" | grep -i "^- fix" || true)
          OTHERS=$(echo "$CHANGES" | grep -iv "^- feat\|^- fix" || true)

          {
            echo "changelog<<EOF"
            [ -n "$FEATURES" ] && echo "### Features" && echo "$FEATURES" && echo ""
            [ -n "$FIXES" ] && echo "### Bug Fixes" && echo "$FIXES" && echo ""
            [ -n "$OTHERS" ] && echo "### Other Changes" && echo "$OTHERS" && echo ""
            echo "EOF"
          } >> "$GITHUB_OUTPUT"

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build

      # Create GitHub Release
      - uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ steps.version.outputs.tag }}
          name: Release ${{ steps.version.outputs.version }}
          body: ${{ steps.changelog.outputs.changelog }}
          draft: false
          prerelease: ${{ contains(steps.version.outputs.tag, '-') }}
          files: |
            dist/*.tar.gz
            dist/*.zip

      # Publish npm package
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      # Publish Docker image
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:${{ steps.version.outputs.version }}
            ghcr.io/${{ github.repository }}:latest
```

### 10.2 Automated Version Bump and Release

```yaml
name: Auto Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      # Automatically determine version from Conventional Commits
      - uses: googleapis/release-please-action@v4
        id: release
        with:
          release-type: node
          # package-name: my-package
          # Customize with changelog-types

      # Only proceed if a release was created
      - name: Build and publish
        if: steps.release.outputs.release_created
        run: |
          echo "New version: ${{ steps.release.outputs.major }}.${{ steps.release.outputs.minor }}.${{ steps.release.outputs.patch }}"
          npm ci
          npm run build
          npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## 11. Advanced Workflow Patterns

### 11.1 Deploy with Approval Flow

```yaml
name: Deploy with Approval
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deploy target'
        required: true
        type: choice
        options:
          - staging
          - production
      version:
        description: 'Version to deploy'
        required: true
        type: string
      dry_run:
        description: 'Dry run (no actual deploy)'
        required: false
        type: boolean
        default: false

jobs:
  validate:
    runs-on: ubuntu-latest
    outputs:
      image_exists: ${{ steps.check.outputs.exists }}
    steps:
      - name: Validate version
        id: check
        run: |
          # Check if image exists
          if docker manifest inspect ghcr.io/${{ github.repository }}:${{ inputs.version }} > /dev/null 2>&1; then
            echo "exists=true" >> "$GITHUB_OUTPUT"
          else
            echo "exists=false" >> "$GITHUB_OUTPUT"
            echo "::error::Image version ${{ inputs.version }} not found"
            exit 1
          fi

  deploy:
    needs: validate
    runs-on: ubuntu-latest
    environment:
      name: ${{ inputs.environment }}
      url: https://${{ inputs.environment == 'production' && '' || 'staging.' }}example.com
    steps:
      - uses: actions/checkout@v4

      - name: Deploy
        if: inputs.dry_run == false
        run: |
          echo "Deploying version ${{ inputs.version }} to ${{ inputs.environment }}"
          helm upgrade --install my-app ./charts/my-app \
            --set image.tag=${{ inputs.version }} \
            --namespace ${{ inputs.environment }}

      - name: Dry run
        if: inputs.dry_run == true
        run: |
          echo "DRY RUN: Would deploy ${{ inputs.version }} to ${{ inputs.environment }}"
          helm upgrade --install my-app ./charts/my-app \
            --set image.tag=${{ inputs.version }} \
            --namespace ${{ inputs.environment }} \
            --dry-run

      - name: Notify
        if: inputs.dry_run == false
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "${{ inputs.environment }} deployed: v${{ inputs.version }} by ${{ github.actor }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### 11.2 Conditional Workflow Execution

```yaml
name: Conditional Workflow
on:
  pull_request:
    branches: [main]

jobs:
  # Detect changed files
  changes:
    runs-on: ubuntu-latest
    outputs:
      frontend: ${{ steps.filter.outputs.frontend }}
      backend: ${{ steps.filter.outputs.backend }}
      infra: ${{ steps.filter.outputs.infra }}
      docs: ${{ steps.filter.outputs.docs }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            frontend:
              - 'packages/frontend/**'
              - 'packages/shared/**'
            backend:
              - 'packages/backend/**'
              - 'packages/shared/**'
            infra:
              - 'terraform/**'
              - 'k8s/**'
            docs:
              - 'docs/**'
              - '**/*.md'

  frontend-ci:
    needs: changes
    if: needs.changes.outputs.frontend == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd packages/frontend && npm ci && npm test

  backend-ci:
    needs: changes
    if: needs.changes.outputs.backend == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd packages/backend && npm ci && npm test

  infra-plan:
    needs: changes
    if: needs.changes.outputs.infra == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: cd terraform && terraform init && terraform plan

  # Aggregate all job results (for required status checks)
  ci-status:
    needs: [frontend-ci, backend-ci, infra-plan]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Check results
        run: |
          # Skipped jobs are treated as success
          RESULTS=("${{ needs.frontend-ci.result }}" "${{ needs.backend-ci.result }}" "${{ needs.infra-plan.result }}")
          for result in "${RESULTS[@]}"; do
            if [[ "$result" == "failure" || "$result" == "cancelled" ]]; then
              echo "CI failed: $result"
              exit 1
            fi
          done
          echo "All checks passed or were skipped"
```

### 11.3 Cross-Workflow Trigger Chaining

```yaml
# workflow_run: triggered when another workflow completes
name: Post-CI Actions
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]

jobs:
  on-success:
    if: github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    steps:
      - name: Download artifact from triggering workflow
        uses: actions/download-artifact@v4
        with:
          name: build-output
          github-token: ${{ secrets.GITHUB_TOKEN }}
          run-id: ${{ github.event.workflow_run.id }}

      - name: Deploy
        run: ./deploy.sh

  on-failure:
    if: github.event.workflow_run.conclusion == 'failure'
    runs-on: ubuntu-latest
    steps:
      - name: Notify failure
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "CI failed on main: ${{ github.event.workflow_run.html_url }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### 11.4 Scheduled Runs and Maintenance Jobs

```yaml
name: Scheduled Maintenance
on:
  schedule:
    # Every day at 3:00 AM JST (UTC 18:00)
    - cron: '0 18 * * *'
  workflow_dispatch:  # Also supports manual runs

jobs:
  stale-cache-cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Clean up stale caches
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          echo "Cleaning up stale caches..."
          # Delete caches for merged branches
          gh cache list --json key,ref | jq -r '.[] |
            select(.ref != "refs/heads/main") | .key' | while read key; do
            echo "Deleting cache: $key"
            gh cache delete "$key" || true
          done

  dependency-update-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - name: Check for vulnerabilities
        run: |
          npm audit --audit-level=high || {
            echo "::warning::High severity vulnerabilities found"
          }
      - name: Check outdated packages
        run: npm outdated || true

  stale-branches:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Find stale branches
        run: |
          echo "## Stale Branches (>30 days)" >> $GITHUB_STEP_SUMMARY
          git for-each-ref --sort=committerdate refs/remotes/origin \
            --format='%(committerdate:iso8601) %(refname:short)' | \
            while read date branch; do
              AGE=$(( ($(date +%s) - $(date -d "$date" +%s)) / 86400 ))
              if [ $AGE -gt 30 ] && [ "$branch" != "origin/main" ]; then
                echo "- $branch ($AGE days old)" >> $GITHUB_STEP_SUMMARY
              fi
            done
```

---

## 12. Comparison Tables

### 12.1 Cache vs Artifact

| Item | Cache | Artifact |
|---|---|---|
| Primary use | Speed up builds | Save and pass build outputs |
| Retention | 7 days (no access) | 1-90 days (configurable) |
| Scope | Branch (with fallback) | Per workflow run |
| UI download | Not available | Available |
| Max size | 10GB/repository | 500MB/artifact |
| Typical examples | node_modules, pip cache | dist/, coverage/, logs |

### 12.2 Secret Scope Comparison

| Scope | Where set | Sharing range | Use case |
|---|---|---|---|
| Repository | Repository settings | 1 repository | API keys, tokens |
| Environment | Environment settings | Environment-specific jobs | Per-environment credentials |
| Organization | Organization settings | Specified repositories | Shared credentials |
| GITHUB_TOKEN | Auto-generated | Current workflow | GitHub API operations |

### 12.3 Authentication Method Comparison

| Method | Security | Management cost | Use case |
|---|---|---|---|
| Static Secrets | Low | High (rotation required) | Legacy systems |
| OIDC | High | Low | AWS/GCP/Azure integration |
| Vault integration | Highest | Medium | Multi-cloud, strict environments |
| GITHUB_TOKEN | Medium | Lowest | GitHub API operations |

### 12.4 GitHub-hosted vs Self-hosted Runner

| Item | GitHub-hosted | Self-hosted |
|---|---|---|
| Setup | Not required | Required |
| Maintenance | Managed by GitHub | Self-managed |
| Cost | Pay-per-use | Infrastructure cost |
| Customization | Limited | Unrestricted |
| Security | Pre-isolated | Self-managed |
| Performance | Standard | Hardware-dependent |
| GPU support | None (some via Larger Runners) | Available |
| Internal network | Not available | Available |
| Typical use | General CI/CD | Special requirements, large builds |

---

## 13. Anti-patterns

### Anti-pattern 1: Indirect Secret Leakage

```yaml
# Bad: Printing secrets to logs via environment variables
steps:
  - run: |
      echo "Deploying with config:"
      env  # Prints all env vars → secret leakage!
    env:
      API_KEY: ${{ secrets.API_KEY }}

  - run: |
      curl -v https://api.example.com/deploy  # -v prints auth headers
    env:
      AUTH_TOKEN: ${{ secrets.AUTH_TOKEN }}

# Better: Minimize what is printed to logs
steps:
  - run: |
      # Reference secrets directly, do not log them
      ./deploy.sh  # Secrets used inside the script
    env:
      API_KEY: ${{ secrets.API_KEY }}
```

### Anti-pattern 2: Over-trusting the Cache

```yaml
# Bad: Not accounting for a corrupt cache
steps:
  - uses: actions/cache@v4
    with:
      path: node_modules
      key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}
  # Skips npm ci on cache hit
  # → Inexplicable errors from a corrupted cache

# Better: Provide a fallback for cache misses
steps:
  - uses: actions/cache@v4
    id: cache
    with:
      path: node_modules
      key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}
  - if: steps.cache.outputs.cache-hit != 'true'
    run: npm ci
  # Also set up a mechanism to periodically clear the cache
```

### Anti-pattern 3: Monolithic Workflow

```yaml
# Bad: Cramming everything into one workflow
name: Everything
on: [push]
jobs:
  do-everything:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint
      - run: npm run build
      - run: npm test
      - run: npm run e2e
      - run: ./deploy.sh staging
      - run: ./deploy.sh production
      # → One step failure stops everything
      # → Cannot parallelize
      # → Re-runs require redoing everything

# Better: Split jobs to parallelize and clarify dependencies
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint

  build:
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - run: npm run build

  test:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: npm test

  deploy-staging:
    needs: test
    environment: staging
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh staging
```

### Anti-pattern 4: Running All Tests Unnecessarily

```yaml
# Bad: Running full test suite on every change
on:
  push:
    # CI runs even on README changes

# Better: Use path filters to prevent unnecessary runs
on:
  push:
    paths-ignore:
      - '**/*.md'
      - 'docs/**'
      - '.github/ISSUE_TEMPLATE/**'
      - 'LICENSE'
      - '.gitignore'
```

### Anti-pattern 5: No Timeout on Long-Running Jobs

```yaml
# Bad: No timeout (default 6 hours)
jobs:
  build:
    runs-on: ubuntu-latest  # Could consume up to 6 hours of billing

# Better: Set appropriate timeouts
jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - run: npm run build
        timeout-minutes: 10
```

---

## 14. FAQ

### Q1: How do I apply different settings to specific matrix combinations?

Use `include` to add extra properties to specific combinations. For example, `include: [{os: ubuntu-latest, node-version: 22, coverage: true}]` makes `matrix.coverage` equal to `true` only for that combination, which you can then use in conditionals.

### Q2: What happens when cache keys collide?

Caches with the same key are not overwritten (they are immutable). Caches from different branches fall back via prefix matching in `restore-keys`. Caches from the default branch are accessible from all branches. To force a cache update, include a random value or version number in the key.

### Q3: Can Environment approvals be automated?

You can approve deployment reviews via the GitHub API, but full automation is not recommended for security reasons. A practical alternative is to design an automatic deploy (canary) contingent on smoke test success in the staging environment, then have an approver click once to approve the production deploy.

### Q4: Should I use OIDC or secret-based authentication?

Use OIDC whenever possible. OIDC eliminates the need to store long-lived secrets and significantly reduces security risk by using short-lived tokens. However, you still need the traditional secrets approach for services that do not support OIDC (e.g., some SaaS providers). Cloud providers that support OIDC: AWS, GCP, Azure, HashiCorp Vault, Terraform Cloud.

### Q5: Is it safe to use Self-hosted Runners with public repositories?

Generally not recommended. In public repositories, anyone can create a PR from a fork, and malicious code could run on your runner. If you must use them, use ephemeral runners (destroyed after a job), run them in a fully isolated environment, and do not auto-run on `pull_request` events.

### Q6: What is the most effective way to reduce workflow run time?

In order of effectiveness: (1) Use path filters to prevent unnecessary runs, (2) Configure dependency caching, (3) Parallelize jobs, (4) Shard tests, (5) Use Larger Runners, (6) Use build caches (Next.js, Docker layers, etc.). Actual run times are visible in the Actions tab; analyze each step's duration to identify bottlenecks.

### Q7: What are the limitations of Reusable Workflows?

Key limitations: (1) Nesting is limited to 4 levels, (2) The `env` context from the calling workflow is not inherited, (3) `strategy.matrix` and a reusable workflow call cannot be in the same job (define the matrix in the caller), (4) Without `secrets: inherit`, secrets must be passed explicitly, (5) When calling the same workflow file multiple times, each call must use a different job name.

### Q8: What is the difference between `workflow_run` and `workflow_dispatch`?

`workflow_run` is an event that triggers automatically when another workflow completes. `workflow_dispatch` is a manual trigger from the UI, API, or gh CLI. Use `workflow_run` for chained execution such as deploying after CI succeeds, and `workflow_dispatch` for on-demand deployments or maintenance tasks.

### Q9: What is the standard approach for CI optimization in large monorepos?

(1) Use `dorny/paths-filter` to detect changes and test only affected packages, (2) Use dynamic matrix to build only changed packages, (3) Leverage Turborepo/Nx remote cache, (4) Share build artifacts between jobs as artifacts, (5) Use `concurrency` to prevent duplicate runs on the same PR. Combining these approaches has resulted in 70-90% reductions in CI time.

### Q10: How can I reduce GitHub Actions costs?

(1) Use `concurrency` + `cancel-in-progress` to cancel old runs on the same PR, (2) Use path filters to eliminate unnecessary runs, (3) Minimize macOS runner usage (10x the cost of Linux), (4) Handle large volume builds on Self-hosted Runners, (5) Use caching effectively to reduce build time, (6) Set `timeout-minutes` appropriately to prevent billing from hung jobs. The GitHub Free plan includes 2,000 minutes/month (Linux) at no cost; beyond that it becomes pay-as-you-go.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is the most important thing. Understanding deepens not just through theory but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Jumping to advanced topics without mastering the basics. It is recommended to thoroughly understand the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and when making architecture decisions.

---

## Summary

| Item | Key Points |
|---|---|
| Matrix | Parallel testing across platforms and versions |
| Cache | Store dependencies to speed up builds (node_modules, etc.) |
| Artifact | Pass build outputs between jobs and make them available in the UI |
| Secrets | Encrypted sensitive information managed by scope |
| Environments | Approval rules and protection settings for deployment targets |
| GITHUB_TOKEN | Auto-generated; specify minimum permissions with `permissions` |
| OIDC | Secretless authentication using short-lived tokens |
| Reusable Workflow | DRY-principle workflow reuse |
| Composite Actions | Package common steps |
| Self-hosted Runner | Custom hardware, internal network access |
| Performance | Parallelization, caching, sharding, path filters |
| Release automation | Tag-based, Conventional Commits, release-please |

---

## Next Guides to Read

- [Reusable Workflows](./02-reusable-workflows.md) -- DRY-principle workflow design
- [CI Recipe Collection](./03-ci-recipes.md) -- Practical CI configurations by language
- [Actions Security](./04-security-actions.md) -- OIDC, dependency pinning

---

## References

1. GitHub. "Using a matrix for your jobs." https://docs.github.com/en/actions/using-jobs/using-a-matrix-for-your-jobs
2. GitHub. "Caching dependencies to speed up workflows." https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows
3. GitHub. "Using environments for deployment." https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment
4. GitHub. "Reusing workflows." https://docs.github.com/en/actions/using-workflows/reusing-workflows
5. GitHub. "Creating a composite action." https://docs.github.com/en/actions/creating-actions/creating-a-composite-action
6. GitHub. "About security hardening with OpenID Connect." https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect
7. GitHub. "About self-hosted runners." https://docs.github.com/en/actions/hosting-your-own-runners/about-self-hosted-runners
8. GitHub. "Usage limits, billing, and administration." https://docs.github.com/en/actions/learn-github-actions/usage-limits-billing-and-administration
9. Google Cloud. "Enabling keyless authentication from GitHub Actions." https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines
10. AWS. "Configuring OpenID Connect in Amazon Web Services." https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services

# Reusable Workflows

> Design maintainable CI/CD pipelines based on the DRY principle using Composite Actions and Reusable Workflows

## What You Will Learn

1. Understand the differences between Composite Actions and Reusable Workflows and when to use each
2. Learn how to design, implement, and publish reusable workflows
3. Understand patterns for building a CI/CD library shared across an organization
4. Establish versioning strategies and maintenance practices
5. Learn test-driven techniques to ensure quality of actions and workflows


## Prerequisites

The following knowledge will help you get more out of this guide:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [GitHub Actions Advanced](./01-actions-advanced.md)

---

## 1. Two Approaches to Reuse

### 1.1 Overview

```
Reuse hierarchy:

┌──────────────────────────────────────────────┐
│ Reusable Workflow (workflow_call)              │
│ Reuse an entire workflow                       │
│ ┌──────────────────────────────────────────┐  │
│ │ Job A                                     │  │
│ │ ┌──────────────────────────────────────┐ │  │
│ │ │ Step 1: Composite Action             │ │  │
│ │ │ (reusable unit grouping multiple     │ │  │
│ │ │  steps)                              │ │  │
│ │ ├──────────────────────────────────────┤ │  │
│ │ │ Step 2: Regular action               │ │  │
│ │ ├──────────────────────────────────────┤ │  │
│ │ │ Step 3: run command                  │ │  │
│ │ └──────────────────────────────────────┘ │  │
│ └──────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘

Composite Action:
  - Reuse at the step level
  - Groups multiple steps within a single job
  - Defined in action.yml

Reusable Workflow:
  - Reuse at the workflow level
  - Calls a workflow that includes entire jobs
  - Defined with the workflow_call trigger
```

### 1.2 Design Principles for Reuse

Keep the following principles in mind when designing reusable components.

```
Design principles:

1. Single Responsibility Principle (SRP)
   - Each action/workflow has one clear responsibility
   - Do not combine "setup", "test", and "deploy" into one

2. Clear inputs
   - Clearly distinguish required parameters from optional ones
   - Set appropriate default values so the component works without configuration

3. Consistent outputs
   - Clearly expose information callers need via outputs
   - Standardize error message formats

4. Versioning
   - Adopt semantic versioning
   - Increment the major version for breaking changes

5. Documentation
   - Document usage and all inputs/outputs in README.md
   - Track change history in CHANGELOG.md
```

---

## 2. Composite Actions

### 2.1 Basic Structure

```yaml
# .github/actions/setup-and-build/action.yml
name: 'Setup and Build'
description: 'Node.js のセットアップ、依存インストール、ビルドを一括実行'

inputs:
  node-version:
    description: 'Node.js バージョン'
    required: false
    default: '20'
  working-directory:
    description: '作業ディレクトリ'
    required: false
    default: '.'

outputs:
  build-path:
    description: 'ビルド出力パス'
    value: ${{ steps.build.outputs.path }}

runs:
  using: 'composite'
  steps:
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
        cache: 'npm'
        cache-dependency-path: ${{ inputs.working-directory }}/package-lock.json

    - name: Install dependencies
      shell: bash
      working-directory: ${{ inputs.working-directory }}
      run: npm ci

    - name: Build
      id: build
      shell: bash
      working-directory: ${{ inputs.working-directory }}
      run: |
        npm run build
        echo "path=${{ inputs.working-directory }}/dist" >> "$GITHUB_OUTPUT"
```

### 2.2 Using a Composite Action

```yaml
# .github/workflows/ci.yml
name: CI
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # ローカルの Composite Action を使用
      - uses: ./.github/actions/setup-and-build
        id: build
        with:
          node-version: '20'

      - run: echo "Build output at ${{ steps.build.outputs.build-path }}"
```

### 2.3 Practical Composite Action: Running Tests

```yaml
# .github/actions/run-tests/action.yml
name: 'Run Tests'
description: 'テスト実行とカバレッジレポート生成'

inputs:
  test-command:
    description: 'テストコマンド'
    default: 'npm test -- --coverage'
  coverage-threshold:
    description: 'カバレッジ閾値(%)'
    default: '80'

outputs:
  coverage-percent:
    description: 'カバレッジ率'
    value: ${{ steps.coverage.outputs.percent }}

runs:
  using: 'composite'
  steps:
    - name: Run tests
      shell: bash
      run: ${{ inputs.test-command }}

    - name: Check coverage threshold
      id: coverage
      shell: bash
      run: |
        COVERAGE=$(jq '.total.lines.pct' coverage/coverage-summary.json)
        echo "percent=$COVERAGE" >> "$GITHUB_OUTPUT"
        if (( $(echo "$COVERAGE < ${{ inputs.coverage-threshold }}" | bc -l) )); then
          echo "::error::Coverage ${COVERAGE}% is below threshold ${{ inputs.coverage-threshold }}%"
          exit 1
        fi
        echo "Coverage: ${COVERAGE}% (threshold: ${{ inputs.coverage-threshold }}%)"

    - name: Upload coverage
      uses: actions/upload-artifact@v4
      with:
        name: coverage-report
        path: coverage/
        retention-days: 7
```

### 2.4 Practical Composite Action: Docker Setup

```yaml
# .github/actions/docker-setup/action.yml
name: 'Docker Build Setup'
description: 'Docker Buildx のセットアップとレジストリログインを一括実行'

inputs:
  registry:
    description: 'コンテナレジストリ URL'
    required: false
    default: 'ghcr.io'
  username:
    description: 'レジストリのユーザー名'
    required: true
  password:
    description: 'レジストリのパスワードまたはトークン'
    required: true
  platforms:
    description: 'ビルド対象プラットフォーム'
    required: false
    default: 'linux/amd64,linux/arm64'

outputs:
  builder-name:
    description: 'Buildx ビルダー名'
    value: ${{ steps.buildx.outputs.name }}

runs:
  using: 'composite'
  steps:
    - name: Set up QEMU
      uses: docker/setup-qemu-action@v3
      with:
        platforms: ${{ inputs.platforms }}

    - name: Set up Docker Buildx
      id: buildx
      uses: docker/setup-buildx-action@v3
      with:
        install: true

    - name: Login to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ inputs.registry }}
        username: ${{ inputs.username }}
        password: ${{ inputs.password }}

    - name: Verify login
      shell: bash
      run: |
        echo "Logged in to ${{ inputs.registry }} as ${{ inputs.username }}"
        echo "Builder: ${{ steps.buildx.outputs.name }}"
        echo "Platforms: ${{ inputs.platforms }}"
```

### 2.5 Practical Composite Action: Slack Notifications

```yaml
# .github/actions/notify-slack/action.yml
name: 'Notify Slack'
description: 'ワークフロー結果を Slack に通知する'

inputs:
  webhook-url:
    description: 'Slack Incoming Webhook URL'
    required: true
  status:
    description: 'ジョブのステータス (success, failure, cancelled)'
    required: true
  channel:
    description: '通知先チャンネル'
    required: false
    default: '#deployments'
  mention:
    description: '失敗時にメンションするグループ'
    required: false
    default: ''
  custom-message:
    description: 'カスタムメッセージ（省略時は自動生成）'
    required: false
    default: ''

runs:
  using: 'composite'
  steps:
    - name: Determine emoji and color
      id: style
      shell: bash
      run: |
        case "${{ inputs.status }}" in
          success)
            echo "emoji=:white_check_mark:" >> "$GITHUB_OUTPUT"
            echo "color=#36a64f" >> "$GITHUB_OUTPUT"
            echo "text=成功" >> "$GITHUB_OUTPUT"
            ;;
          failure)
            echo "emoji=:x:" >> "$GITHUB_OUTPUT"
            echo "color=#dc3545" >> "$GITHUB_OUTPUT"
            echo "text=失敗" >> "$GITHUB_OUTPUT"
            ;;
          cancelled)
            echo "emoji=:warning:" >> "$GITHUB_OUTPUT"
            echo "color=#ffc107" >> "$GITHUB_OUTPUT"
            echo "text=キャンセル" >> "$GITHUB_OUTPUT"
            ;;
        esac

    - name: Build message
      id: message
      shell: bash
      run: |
        if [ -n "${{ inputs.custom-message }}" ]; then
          MSG="${{ inputs.custom-message }}"
        else
          MSG="${{ steps.style.outputs.emoji }} *${{ github.workflow }}* が ${{ steps.style.outputs.text }} しました"
        fi

        MENTION=""
        if [ "${{ inputs.status }}" = "failure" ] && [ -n "${{ inputs.mention }}" ]; then
          MENTION="\n<!subteam^${{ inputs.mention }}> 対応をお願いします"
        fi

        echo "body=${MSG}${MENTION}" >> "$GITHUB_OUTPUT"

    - name: Send Slack notification
      shell: bash
      env:
        WEBHOOK_URL: ${{ inputs.webhook-url }}
      run: |
        curl -s -X POST "$WEBHOOK_URL" \
          -H 'Content-Type: application/json' \
          -d '{
            "channel": "${{ inputs.channel }}",
            "attachments": [{
              "color": "${{ steps.style.outputs.color }}",
              "text": "${{ steps.message.outputs.body }}",
              "fields": [
                {"title": "リポジトリ", "value": "<${{ github.server_url }}/${{ github.repository }}|${{ github.repository }}>", "short": true},
                {"title": "ブランチ", "value": "`${{ github.ref_name }}`", "short": true},
                {"title": "コミット", "value": "<${{ github.server_url }}/${{ github.repository }}/commit/${{ github.sha }}|${{ github.sha }}>", "short": true},
                {"title": "実行者", "value": "${{ github.actor }}", "short": true}
              ],
              "footer": "GitHub Actions",
              "ts": "'$(date +%s)'"
            }]
          }'
```

### 2.6 Practical Composite Action: PR Comments

```yaml
# .github/actions/pr-comment/action.yml
name: 'PR Comment'
description: 'PR にコメントを投稿（既存コメントがあれば更新）'

inputs:
  github-token:
    description: 'GitHub Token'
    required: true
  body:
    description: 'コメント本文（Markdown 対応）'
    required: true
  comment-tag:
    description: 'コメント識別タグ（更新時のマッチングに使用）'
    required: false
    default: 'github-actions-bot'

runs:
  using: 'composite'
  steps:
    - name: Find existing comment
      id: find
      uses: peter-evans/find-comment@v3
      with:
        issue-number: ${{ github.event.pull_request.number }}
        body-includes: "<!-- ${{ inputs.comment-tag }} -->"

    - name: Create or update comment
      uses: peter-evans/create-or-update-comment@v4
      with:
        token: ${{ inputs.github-token }}
        comment-id: ${{ steps.find.outputs.comment-id }}
        issue-number: ${{ github.event.pull_request.number }}
        body: |
          <!-- ${{ inputs.comment-tag }} -->
          ${{ inputs.body }}
        edit-mode: replace
```

### 2.7 Debugging Techniques for Composite Actions

```yaml
# デバッグ用の環境変数を活用
runs:
  using: 'composite'
  steps:
    - name: Debug info
      if: runner.debug == '1'
      shell: bash
      run: |
        echo "::group::Input values"
        echo "node-version: ${{ inputs.node-version }}"
        echo "working-directory: ${{ inputs.working-directory }}"
        echo "::endgroup::"

        echo "::group::Environment"
        env | sort
        echo "::endgroup::"

    - name: Main step
      shell: bash
      run: |
        # ACTIONS_STEP_DEBUG=true の場合にのみ詳細ログ出力
        if [ "$RUNNER_DEBUG" = "1" ]; then
          set -x
        fi
        npm ci
```

---

## 3. Reusable Workflows

### 3.1 Definition

```yaml
# .github/workflows/reusable-ci.yml
name: Reusable CI

on:
  workflow_call:
    inputs:
      node-version:
        type: string
        default: '20'
      working-directory:
        type: string
        default: '.'
      run-e2e:
        type: boolean
        default: false
    secrets:
      NPM_TOKEN:
        required: false
    outputs:
      build-version:
        description: 'ビルドバージョン'
        value: ${{ jobs.build.outputs.version }}

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
          cache: 'npm'
      - run: npm ci
        working-directory: ${{ inputs.working-directory }}
      - run: npm run lint
        working-directory: ${{ inputs.working-directory }}

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
          cache: 'npm'
      - run: npm ci
        working-directory: ${{ inputs.working-directory }}
      - run: npm test
        working-directory: ${{ inputs.working-directory }}

  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.value }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
          cache: 'npm'
      - run: npm ci
        working-directory: ${{ inputs.working-directory }}
      - run: npm run build
        working-directory: ${{ inputs.working-directory }}
      - id: version
        run: echo "value=$(jq -r .version package.json)" >> "$GITHUB_OUTPUT"
        working-directory: ${{ inputs.working-directory }}

  e2e:
    if: inputs.run-e2e
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npx playwright install --with-deps
      - run: npm run test:e2e
```

### 3.2 Calling a Reusable Workflow

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    uses: ./.github/workflows/reusable-ci.yml
    with:
      node-version: '20'
      run-e2e: ${{ github.event_name == 'push' }}
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}

  deploy:
    needs: ci
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploy version ${{ needs.ci.outputs.build-version }}"
```

### 3.3 Calling a Reusable Workflow from Another Repository

```yaml
# 組織共通のワークフローを呼び出す
name: CI
on: [push]

jobs:
  ci:
    uses: my-org/shared-workflows/.github/workflows/node-ci.yml@v1
    with:
      node-version: '20'
    secrets: inherit  # 呼び出し元のシークレットを全て継承
```

### 3.4 Practical Reusable Workflow: Docker Build & Push

```yaml
# .github/workflows/reusable-docker.yml
name: Reusable Docker Build

on:
  workflow_call:
    inputs:
      image-name:
        type: string
        required: true
        description: 'Docker イメージ名（例: ghcr.io/myorg/myapp）'
      dockerfile:
        type: string
        default: './Dockerfile'
        description: 'Dockerfile のパス'
      context:
        type: string
        default: '.'
        description: 'Docker ビルドコンテキスト'
      platforms:
        type: string
        default: 'linux/amd64,linux/arm64'
        description: 'ビルド対象プラットフォーム'
      push:
        type: boolean
        default: true
        description: 'レジストリにプッシュするか'
      build-args:
        type: string
        default: ''
        description: 'ビルド引数（改行区切り）'
    secrets:
      REGISTRY_TOKEN:
        required: false
        description: 'レジストリ認証トークン'
    outputs:
      image-digest:
        description: 'プッシュされたイメージのダイジェスト'
        value: ${{ jobs.build.outputs.digest }}
      image-tags:
        description: '生成されたタグ一覧'
        value: ${{ jobs.build.outputs.tags }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    outputs:
      digest: ${{ steps.build-push.outputs.digest }}
      tags: ${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-qemu-action@v3
        with:
          platforms: ${{ inputs.platforms }}

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        if: inputs.push
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.REGISTRY_TOKEN || secrets.GITHUB_TOKEN }}

      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ${{ inputs.image-name }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix=

      - uses: docker/build-push-action@v5
        id: build-push
        with:
          context: ${{ inputs.context }}
          file: ${{ inputs.dockerfile }}
          push: ${{ inputs.push }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          platforms: ${{ inputs.platforms }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: ${{ inputs.build-args }}

      - name: Output summary
        run: |
          echo "## Docker Build Summary" >> "$GITHUB_STEP_SUMMARY"
          echo "| Property | Value |" >> "$GITHUB_STEP_SUMMARY"
          echo "|----------|-------|" >> "$GITHUB_STEP_SUMMARY"
          echo "| Image | ${{ inputs.image-name }} |" >> "$GITHUB_STEP_SUMMARY"
          echo "| Digest | ${{ steps.build-push.outputs.digest }} |" >> "$GITHUB_STEP_SUMMARY"
          echo "| Tags | ${{ steps.meta.outputs.tags }} |" >> "$GITHUB_STEP_SUMMARY"
```

### 3.5 Practical Reusable Workflow: Deployment

```yaml
# .github/workflows/reusable-deploy.yml
name: Reusable Deploy

on:
  workflow_call:
    inputs:
      environment:
        type: string
        required: true
        description: 'Target deployment environment (staging, production)'
      version:
        type: string
        required: true
        description: 'Version to deploy'
      dry-run:
        type: boolean
        default: false
        description: 'Perform a dry run'
      rollback-version:
        type: string
        default: ''
        description: 'Version to roll back to (empty for normal deploy)'
    secrets:
      AWS_ROLE_ARN:
        required: true
      SLACK_WEBHOOK_URL:
        required: false
    outputs:
      deploy-url:
        description: 'Deployed URL'
        value: ${{ jobs.deploy.outputs.url }}
      deploy-status:
        description: 'Deployment result (success / failure)'
        value: ${{ jobs.deploy.outputs.status }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    permissions:
      id-token: write
      contents: read
    outputs:
      url: ${{ steps.deploy.outputs.url }}
      status: ${{ steps.result.outputs.status }}
    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ap-northeast-1

      - name: Pre-deploy validation
        run: |
          echo "Environment: ${{ inputs.environment }}"
          echo "Version: ${{ inputs.version }}"
          echo "Dry-run: ${{ inputs.dry-run }}"

          # ヘルスチェックエンドポイントの事前確認
          if [ "${{ inputs.environment }}" = "production" ]; then
            echo "::notice::本番環境へのデプロイです。承認が必要です。"
          fi

      - name: Deploy
        id: deploy
        run: |
          if [ "${{ inputs.dry-run }}" = "true" ]; then
            echo "::notice::ドライラン実行中。実際のデプロイは行いません。"
            echo "url=https://dry-run.example.com" >> "$GITHUB_OUTPUT"
          else
            # 実際のデプロイコマンド
            aws ecs update-service \
              --cluster my-cluster-${{ inputs.environment }} \
              --service my-service \
              --task-definition my-task:${{ inputs.version }} \
              --force-new-deployment

            echo "url=https://${{ inputs.environment }}.example.com" >> "$GITHUB_OUTPUT"
          fi

      - name: Wait for deployment
        if: inputs.dry-run == false
        run: |
          aws ecs wait services-stable \
            --cluster my-cluster-${{ inputs.environment }} \
            --services my-service
          echo "デプロイが安定しました"

      - name: Health check
        if: inputs.dry-run == false
        run: |
          for i in $(seq 1 5); do
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
              https://${{ inputs.environment }}.example.com/health)
            if [ "$STATUS" = "200" ]; then
              echo "ヘルスチェック成功"
              exit 0
            fi
            echo "ヘルスチェック試行 $i/5: ステータス $STATUS"
            sleep 10
          done
          echo "::error::ヘルスチェックが5回連続で失敗しました"
          exit 1

      - name: Set result
        id: result
        if: always()
        run: |
          if [ "${{ job.status }}" = "success" ]; then
            echo "status=success" >> "$GITHUB_OUTPUT"
          else
            echo "status=failure" >> "$GITHUB_OUTPUT"
          fi

  notify:
    needs: deploy
    if: always() && inputs.dry-run == false
    runs-on: ubuntu-latest
    steps:
      - name: Notify Slack
        if: secrets.SLACK_WEBHOOK_URL != ''
        run: |
          STATUS="${{ needs.deploy.outputs.status }}"
          COLOR=$([ "$STATUS" = "success" ] && echo "#36a64f" || echo "#dc3545")
          EMOJI=$([ "$STATUS" = "success" ] && echo ":rocket:" || echo ":fire:")

          curl -s -X POST "${{ secrets.SLACK_WEBHOOK_URL }}" \
            -H 'Content-Type: application/json' \
            -d "{
              \"attachments\": [{
                \"color\": \"$COLOR\",
                \"text\": \"$EMOJI デプロイ $STATUS: ${{ inputs.environment }} v${{ inputs.version }}\",
                \"footer\": \"${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}\"
              }]
            }"
```

### 3.6 Using a Matrix with Reusable Workflows

```yaml
# 呼び出し元でマトリクスを使って同一ワークフローを複数パラメータで呼び出す
name: Multi-environment Deploy
on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to deploy'
        required: true

jobs:
  deploy-staging:
    uses: ./.github/workflows/reusable-deploy.yml
    with:
      environment: staging
      version: ${{ github.event.inputs.version }}
    secrets:
      AWS_ROLE_ARN: ${{ secrets.STAGING_AWS_ROLE_ARN }}
      SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

  deploy-production:
    needs: deploy-staging
    if: needs.deploy-staging.outputs.deploy-status == 'success'
    uses: ./.github/workflows/reusable-deploy.yml
    with:
      environment: production
      version: ${{ github.event.inputs.version }}
    secrets:
      AWS_ROLE_ARN: ${{ secrets.PRODUCTION_AWS_ROLE_ARN }}
      SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 3.7 Reusable Workflows and Environment Protection Rules

```yaml
# Reusable Workflow 内で environment を使用することで
# デプロイ前に承認フローを挟むことができる

# GitHub リポジトリ設定:
# Settings → Environments → production
#   - Required reviewers: team-lead, devops-lead
#   - Wait timer: 5 minutes
#   - Deployment branches: main のみ

# Reusable Workflow 側
on:
  workflow_call:
    inputs:
      environment:
        type: string
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    # ↑ environment を指定すると、GitHub が保護ルールを自動適用
    # production の場合、承認者がApproveするまでジョブは開始されない
    steps:
      - uses: actions/checkout@v4
      - run: echo "Deploying to ${{ inputs.environment }}"
```

---

## 4. Composite Actions vs Reusable Workflows

### 4.1 Comparison Table

| Item | Composite Action | Reusable Workflow |
|---|---|---|
| Unit of reuse | Group of steps | Group of jobs (entire workflow) |
| Definition location | action.yml | .github/workflows/*.yml |
| Runner specification | Determined by caller | Specified internally via runs-on |
| Secrets | Available in caller's context | Passed explicitly via secrets |
| Nesting | Supported (action calling action) | Up to 4 levels |
| Marketplace | Can be published | Can be published (via repository reference) |
| Use case | Common setup procedures | Standardized CI/CD flows |
| Flexibility | High (step level) | Medium (job level) |
| Conditional branching | Controlled with steps if | Controlled with jobs if |
| Service containers | Not available | Available |
| Environment variable inheritance | Inherits env from caller | Passed explicitly via inputs |
| environment | Not available | Available (supports approval flows) |
| concurrency | Not available | Available |
| strategy/matrix | Not available | Available |

### 4.2 Decision Guide

```
Decision flowchart:

  What do you want to reuse?
         │
  ┌──────┴──────┐
  │             │
  Steps         Entire jobs
  (procedures)  (flow)
  │             │
  ↓             ↓
  Composite     Reusable
  Action        Workflow

  Additionally:
  - Caller decides the runner → Composite Action
  - Need to use environment → Reusable Workflow
  - Want to publish to Marketplace → Composite Action
  - Enforce org-wide standard CI flow → Reusable Workflow
  - Need service containers (DB, etc.) → Reusable Workflow
  - Includes dependencies across multiple jobs → Reusable Workflow
  - Sharing part of an existing workflow → Composite Action
```

### 4.3 Combining Both

Composite Actions and Reusable Workflows are not mutually exclusive — combining them is the most effective approach.

```yaml
# Reusable Workflow 内で Composite Action を使う
# .github/workflows/reusable-fullstack-ci.yml
name: Reusable Full-Stack CI

on:
  workflow_call:
    inputs:
      node-version:
        type: string
        default: '20'
      python-version:
        type: string
        default: '3.12'

jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # Composite Action でフロントエンドのセットアップを共通化
      - uses: ./.github/actions/setup-and-build
        with:
          node-version: ${{ inputs.node-version }}
          working-directory: ./frontend
      # Composite Action でテスト実行を共通化
      - uses: ./.github/actions/run-tests
        with:
          test-command: 'cd frontend && npm test -- --coverage'

  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ inputs.python-version }}
      - run: |
          cd backend
          pip install -r requirements.txt
          pytest --cov
```

---

## 5. Publishing Actions

### 5.1 Directory Structure

```
my-action/
├── action.yml          # Action definition
├── src/
│   └── index.ts        # For JavaScript Actions
├── dist/
│   └── index.js        # Built file
├── __tests__/
│   └── index.test.ts   # Tests
├── package.json
├── tsconfig.json
├── LICENSE
├── README.md
└── CHANGELOG.md
```

### 5.2 Example JavaScript Action

```yaml
# action.yml
name: 'PR Size Label'
description: '変更行数に基づいてPRにサイズラベルを付与する'
author: 'your-name'

inputs:
  github-token:
    description: 'GitHub Token'
    required: true
  xs-threshold:
    description: 'XSの閾値'
    default: '10'
  s-threshold:
    description: 'Sの閾値'
    default: '50'
  m-threshold:
    description: 'Mの閾値'
    default: '200'
  l-threshold:
    description: 'Lの閾値'
    default: '500'

outputs:
  label:
    description: '付与されたラベル名'
  total-changes:
    description: '変更行数の合計'

runs:
  using: 'node20'
  main: 'dist/index.js'

branding:
  icon: 'tag'
  color: 'blue'
```

```typescript
// src/index.ts
import * as core from '@actions/core';
import * as github from '@actions/github';

interface SizeConfig {
  label: string;
  threshold: number;
}

async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token', { required: true });
    const xsThreshold = parseInt(core.getInput('xs-threshold'));
    const sThreshold = parseInt(core.getInput('s-threshold'));
    const mThreshold = parseInt(core.getInput('m-threshold'));
    const lThreshold = parseInt(core.getInput('l-threshold'));

    const octokit = github.getOctokit(token);
    const { context } = github;

    if (!context.payload.pull_request) {
      core.info('Not a PR event, skipping.');
      return;
    }

    const prNumber = context.payload.pull_request.number;

    const { data: pr } = await octokit.rest.pulls.get({
      ...context.repo,
      pull_number: prNumber,
    });

    const totalChanges = pr.additions + pr.deletions;
    core.setOutput('total-changes', totalChanges.toString());

    // サイズ判定
    const sizes: SizeConfig[] = [
      { label: 'size/XS', threshold: xsThreshold },
      { label: 'size/S', threshold: sThreshold },
      { label: 'size/M', threshold: mThreshold },
      { label: 'size/L', threshold: lThreshold },
    ];

    let label = 'size/XL';
    for (const size of sizes) {
      if (totalChanges < size.threshold) {
        label = size.label;
        break;
      }
    }

    // 既存のサイズラベルを削除
    const existingLabels = pr.labels
      .filter((l) => l.name?.startsWith('size/'))
      .map((l) => l.name!);

    for (const existingLabel of existingLabels) {
      if (existingLabel !== label) {
        await octokit.rest.issues.removeLabel({
          ...context.repo,
          issue_number: prNumber,
          name: existingLabel,
        });
      }
    }

    // 新しいラベルを追加
    if (!existingLabels.includes(label)) {
      await octokit.rest.issues.addLabels({
        ...context.repo,
        issue_number: prNumber,
        labels: [label],
      });
    }

    core.setOutput('label', label);
    core.info(
      `PR #${prNumber}: ${totalChanges} changes → ${label}`
    );
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

run();
```

### 5.3 Testing Actions

```typescript
// __tests__/index.test.ts
import * as core from '@actions/core';
import * as github from '@actions/github';

// モックの設定
jest.mock('@actions/core');
jest.mock('@actions/github');

describe('PR Size Label Action', () => {
  const mockGetInput = core.getInput as jest.MockedFunction<
    typeof core.getInput
  >;
  const mockSetOutput = core.setOutput as jest.MockedFunction<
    typeof core.setOutput
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'github-token': 'fake-token',
        'xs-threshold': '10',
        's-threshold': '50',
        'm-threshold': '200',
        'l-threshold': '500',
      };
      return inputs[name] ?? '';
    });
  });

  it('should label XS for small changes', async () => {
    // PR のモック: 5行追加、2行削除 = 合計7行
    (github.getOctokit as jest.Mock).mockReturnValue({
      rest: {
        pulls: {
          get: jest.fn().mockResolvedValue({
            data: { additions: 5, deletions: 2, labels: [] },
          }),
        },
        issues: {
          addLabels: jest.fn().mockResolvedValue({}),
          removeLabel: jest.fn().mockResolvedValue({}),
        },
      },
    });

    // テスト実行
    // ...
    expect(mockSetOutput).toHaveBeenCalledWith('label', 'size/XS');
  });
});
```

### 5.4 Action Release Workflow

```yaml
# .github/workflows/release-action.yml
name: Release Action

on:
  push:
    tags: ['v*']

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci
      - run: npm run build
      - run: npm test

      # dist/ をコミットに含める
      - name: Update dist
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add dist/ -f
          git diff --staged --quiet || git commit -m "chore: update dist for ${{ github.ref_name }}"

      # メジャーバージョンタグの更新 (v1 → v1.2.3 を指す)
      - name: Update major version tag
        run: |
          MAJOR_VERSION=$(echo "${{ github.ref_name }}" | grep -oP 'v\d+')
          git tag -f "$MAJOR_VERSION"
          git push origin "$MAJOR_VERSION" --force
          git push origin "${{ github.ref_name }}"

      - name: Create Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
```

---

## 6. Patterns for Organization-Wide Shared Workflows

### 6.1 Repository Structure

```
Organization-wide shared repository structure:

  my-org/shared-workflows/
  ├── .github/
  │   └── workflows/
  │       ├── node-ci.yml        # Node.js CI
  │       ├── python-ci.yml      # Python CI
  │       ├── docker-build.yml   # Docker build
  │       ├── deploy-ecs.yml     # ECS deploy
  │       ├── deploy-lambda.yml  # Lambda deploy
  │       └── release.yml        # Release management
  ├── actions/
  │   ├── setup-node/
  │   │   └── action.yml
  │   ├── setup-python/
  │   │   └── action.yml
  │   ├── security-scan/
  │   │   └── action.yml
  │   ├── notify-slack/
  │   │   └── action.yml
  │   └── pr-comment/
  │       └── action.yml
  ├── docs/
  │   ├── MIGRATION.md          # Version upgrade guide
  │   └── USAGE.md              # Usage instructions
  ├── CHANGELOG.md
  └── README.md

  Each project repository:
  my-org/my-app/.github/workflows/ci.yml
    → uses: my-org/shared-workflows/.github/workflows/node-ci.yml@v1
```

### 6.2 Gradual Adoption of Shared Workflows

```yaml
# Phase 1: 基本的な CI をまず共通化
# my-org/my-app/.github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  ci:
    uses: my-org/shared-workflows/.github/workflows/node-ci.yml@v1
    with:
      node-version: '20'
    secrets: inherit

---
# Phase 2: Docker ビルドも共通化
# my-org/my-app/.github/workflows/docker.yml
name: Docker
on:
  push:
    branches: [main]

jobs:
  build:
    uses: my-org/shared-workflows/.github/workflows/docker-build.yml@v1
    with:
      image-name: ghcr.io/my-org/my-app
    secrets: inherit

---
# Phase 3: デプロイまで共通化
# my-org/my-app/.github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  ci:
    uses: my-org/shared-workflows/.github/workflows/node-ci.yml@v1
    secrets: inherit

  deploy-staging:
    needs: ci
    uses: my-org/shared-workflows/.github/workflows/deploy-ecs.yml@v1
    with:
      environment: staging
      version: ${{ needs.ci.outputs.build-version }}
    secrets: inherit

  deploy-production:
    needs: deploy-staging
    uses: my-org/shared-workflows/.github/workflows/deploy-ecs.yml@v1
    with:
      environment: production
      version: ${{ needs.ci.outputs.build-version }}
    secrets: inherit
```

### 6.3 Versioning Strategy for Shared Workflows

```
Versioning policy:

  Release tag management:
    v1.0.0 — Initial release
    v1.1.0 — Backward-compatible feature additions
    v1.1.1 — Bug fixes
    v2.0.0 — Breaking changes

  Major version tags:
    v1 → points to v1.3.2 (latest v1.x.x)
    v2 → points to v2.1.0 (latest v2.x.x)

  How consumers reference versions:
    Stability-focused: my-org/shared-workflows/.github/workflows/ci.yml@v1
    Pinned:           my-org/shared-workflows/.github/workflows/ci.yml@v1.3.2
    Most fixed:       my-org/shared-workflows/.github/workflows/ci.yml@abc1234def

  Migration procedure for breaking changes:
    1. Develop new version on v2 branch
    2. Document migration steps in MIGRATION.md
    3. Release v2.0.0
    4. Notify all teams and set a migration deadline
    5. Provide a v1 maintenance period (3 months)
    6. Deprecate v1 and eventually remove it
```

### 6.4 Required Workflows (Enforced Across the Organization)

```
Using GitHub Organization's Required Workflows feature, you can
enforce execution of specific workflows across all repositories
in the organization (or selected ones).

How to configure:
  Organization Settings → Actions → Required workflows

Use cases:
  - Enforce security scanning
  - Enforce license checks
  - Enforce coding standards checks

Notes:
  - Required Workflows appear as PR status checks
  - Failing checks block merges
  - Repository maintainers cannot skip them
```

---

## 7. Anti-Patterns

### Anti-Pattern 1: Over-abstraction

```yaml
# Bad example: making everything a Reusable Workflow leads to incomprehensibility
jobs:
  setup:
    uses: ./.github/workflows/reusable-setup.yml
  lint:
    uses: ./.github/workflows/reusable-lint.yml
  test:
    uses: ./.github/workflows/reusable-test.yml
  build:
    uses: ./.github/workflows/reusable-build.yml
  # You have to look at 5 files to understand the full picture

# Improvement: abstract at an appropriate granularity
# - Only make Reusable what should be shared organization-wide
# - Keep project-specific logic inline
```

### Anti-Pattern 2: Referencing Without Version Pinning

```yaml
# Bad example: branch reference → breaks with unexpected changes
jobs:
  ci:
    uses: my-org/shared-workflows/.github/workflows/ci.yml@main

# Improvement: pin with semantic versioning
jobs:
  ci:
    uses: my-org/shared-workflows/.github/workflows/ci.yml@v2
    # Or pin to a commit SHA
    # uses: my-org/shared-workflows/.github/workflows/ci.yml@abc1234
```

### Anti-Pattern 3: Too Many Input Parameters

```yaml
# Bad example: too many inputs make the workflow hard to use
on:
  workflow_call:
    inputs:
      node-version: { type: string }
      npm-token: { type: string }
      lint-command: { type: string }
      test-command: { type: string }
      build-command: { type: string }
      e2e-command: { type: string }
      coverage-threshold: { type: string }
      docker-registry: { type: string }
      docker-image-name: { type: string }
      deploy-target: { type: string }
      slack-channel: { type: string }
      # ... 20+ parameters

# Improvement: split responsibilities into multiple Reusable Workflows
# reusable-ci.yml     → Focus on CI (lint, test, build)
# reusable-docker.yml → Focus on Docker builds
# reusable-deploy.yml → Focus on deployment
# Aim for 5 or fewer parameters per workflow
```

### Anti-Pattern 4: Publishing Shared Actions Without Tests

```yaml
# Bad example: publishing shared actions without tests
# → Risk of breaking CI across all projects simultaneously

# Improvement: set up CI for the action itself
# .github/workflows/test-action.yml
name: Test Action
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Unit tests
      - run: npm ci && npm test

      # Integration test: actually run the action
      - uses: ./  # Test itself
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Anti-Pattern 5: Logging Secrets

```yaml
# Bad example: logging secrets for debugging purposes
runs:
  using: 'composite'
  steps:
    - shell: bash
      run: |
        echo "Token: ${{ inputs.github-token }}"  # シークレットがログに表示される！
        curl -H "Authorization: Bearer ${{ inputs.github-token }}" ...

# Improvement: pass secrets via environment variables
runs:
  using: 'composite'
  steps:
    - shell: bash
      env:
        GH_TOKEN: ${{ inputs.github-token }}
      run: |
        # GH_TOKEN はマスクされ、ログに表示されない
        curl -H "Authorization: Bearer $GH_TOKEN" ...
```

---

## 8. Advanced Patterns

### 8.1 Combining Dynamic Matrices with Reusable Workflows

```yaml
# .github/workflows/dynamic-matrix.yml
name: Dynamic Matrix CI
on: [push]

jobs:
  determine-matrix:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.set-matrix.outputs.matrix }}
    steps:
      - uses: actions/checkout@v4
      - id: set-matrix
        run: |
          # 変更されたパッケージを検出してマトリクスを動的に生成
          CHANGED_PACKAGES=$(git diff --name-only HEAD~1 | \
            grep -oP 'packages/\K[^/]+' | sort -u | jq -R -s -c 'split("\n")[:-1]')
          echo "matrix={\"package\":$CHANGED_PACKAGES}" >> "$GITHUB_OUTPUT"

  ci:
    needs: determine-matrix
    if: needs.determine-matrix.outputs.matrix != '{"package":[]}'
    strategy:
      matrix: ${{ fromJSON(needs.determine-matrix.outputs.matrix) }}
    uses: ./.github/workflows/reusable-ci.yml
    with:
      working-directory: packages/${{ matrix.package }}
    secrets: inherit
```

### 8.2 Chaining Composite Actions

```yaml
# 複数の Composite Action を連携させるパターン
# .github/workflows/full-pipeline.yml
name: Full Pipeline
on: [push]

jobs:
  pipeline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Step 1: セットアップとビルド
      - uses: ./.github/actions/setup-and-build
        id: build
        with:
          node-version: '20'

      # Step 2: テスト実行
      - uses: ./.github/actions/run-tests
        id: test
        with:
          coverage-threshold: '80'

      # Step 3: セキュリティスキャン
      - uses: ./.github/actions/security-scan
        id: security

      # Step 4: PRコメントで結果を報告
      - uses: ./.github/actions/pr-comment
        if: github.event_name == 'pull_request'
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          body: |
            ## CI Results
            | Check | Result |
            |-------|--------|
            | Build | ${{ steps.build.outputs.build-path && '✅' || '❌' }} |
            | Coverage | ${{ steps.test.outputs.coverage-percent }}% |
            | Security | ${{ steps.security.outputs.vulnerabilities == '0' && '✅' || '⚠️' }} |
```

### 8.3 Sharing Artifacts Between Workflows

```yaml
# Reusable Workflow 間でアーティファクトを共有する
# .github/workflows/build-and-deploy.yml
name: Build and Deploy
on:
  push:
    branches: [main]

jobs:
  build:
    uses: ./.github/workflows/reusable-ci.yml
    with:
      node-version: '20'
    secrets: inherit

  # Pass build output to the next job via artifacts
  package:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: build-output
          path: ./dist

      - name: Package
        run: |
          tar -czf app.tar.gz dist/
          echo "Packaged successfully"

      - uses: actions/upload-artifact@v4
        with:
          name: deployment-package
          path: app.tar.gz
          retention-days: 1

  deploy:
    needs: package
    uses: ./.github/workflows/reusable-deploy.yml
    with:
      environment: production
      version: ${{ needs.build.outputs.build-version }}
    secrets: inherit
```

### 8.4 Conditional Reusable Workflow Calls

```yaml
# Run only necessary workflows using path filters
name: Smart CI
on:
  pull_request:

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      frontend: ${{ steps.filter.outputs.frontend }}
      backend: ${{ steps.filter.outputs.backend }}
      infra: ${{ steps.filter.outputs.infra }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            frontend:
              - 'frontend/**'
              - 'package.json'
            backend:
              - 'backend/**'
              - 'requirements.txt'
            infra:
              - 'terraform/**'
              - 'Dockerfile'

  frontend-ci:
    needs: changes
    if: needs.changes.outputs.frontend == 'true'
    uses: ./.github/workflows/reusable-node-ci.yml
    with:
      working-directory: frontend
    secrets: inherit

  backend-ci:
    needs: changes
    if: needs.changes.outputs.backend == 'true'
    uses: ./.github/workflows/reusable-python-ci.yml
    with:
      working-directory: backend
    secrets: inherit

  infra-check:
    needs: changes
    if: needs.changes.outputs.infra == 'true'
    uses: ./.github/workflows/reusable-terraform-plan.yml
    secrets: inherit
```

---

## 9. FAQ

### Q1: How many levels of nesting are supported for Reusable Workflows?

Up to 4 levels. However, deep nesting significantly harms readability, so 2 levels or fewer is recommended. If you need more sharing beyond that, extract it into a Composite Action and use it within Reusable Workflow steps.

### Q2: Can matrices be used in Reusable Workflows?

Yes — the caller can use a matrix to call the same Reusable Workflow with different parameters. Matrices can also be used inside Reusable Workflows. However, combining a caller-side matrix with an internal matrix can cause the job count to explode, so be careful.

### Q3: Is `secrets: inherit` safe?

`secrets: inherit` passes all of the caller's secrets. It is convenient, but should only be used when the Reusable Workflow is in a trusted repository. For external repositories, it is safer to explicitly pass only the secrets that are needed.

### Q4: What happens if you omit `shell` in a Composite Action?

The `shell` field is required in `run` steps of a Composite Action. Omitting it will result in an error. This differs from `run` steps in regular workflows (which default to bash), so be careful. Typically you should specify `shell: bash`. Consider `shell: pwsh` if you need to support Windows runners.

### Q5: Can arrays or objects be passed as Reusable Workflow inputs?

Direct array or object types are not supported. The common pattern is to pass them as a JSON string with `type: string` and convert them inside the workflow using `fromJSON()`.

```yaml
# Caller
jobs:
  ci:
    uses: ./.github/workflows/reusable-ci.yml
    with:
      environments: '["staging", "production"]'

# Inside the Reusable Workflow
jobs:
  deploy:
    strategy:
      matrix:
        env: ${{ fromJSON(inputs.environments) }}
```

### Q6: Can a Composite Action call another Composite Action?

Yes. You can reference another Action using `uses:` within a Composite Action's steps. However, deep nesting makes debugging difficult, so it is recommended to keep nesting to 2 levels or fewer.

### Q7: Can a Reusable Workflow be used with both `workflow_dispatch` and `workflow_call`?

Yes — you can define both triggers in a single workflow file. This allows it to be called from other workflows as well as triggered manually.

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment target'
        type: choice
        options:
          - staging
          - production
  workflow_call:
    inputs:
      environment:
        type: string
        required: true
```

### Q8: Where can I view execution logs for a Reusable Workflow?

The jobs of a Reusable Workflow appear nested within the execution log of the calling workflow. Click on each job to view detailed step logs. A link is also displayed next to `uses:`, so you can jump directly to the Reusable Workflow's source code.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just through theory, but by actually writing code and confirming behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping straight to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work, especially during code reviews and architectural design.

---

## Summary

| Item | Key Point |
|---|---|
| Composite Action | Groups steps for reuse; defined in action.yml |
| Reusable Workflow | Groups jobs for reuse; defined with workflow_call |
| When to use which | Setup procedures → Composite; CI flows → Reusable |
| Combining both | Using Composite Actions inside Reusable Workflows is most effective |
| Publishing | Marketplace (Actions), repository reference (Workflows) |
| Versioning | Must pin to semantic version or SHA |
| Org-wide pattern | Consolidate in a shared-workflows repository |
| Testing | Set up CI for the action itself to prevent breakage |
| Parameter design | Aim for 5 or fewer inputs per workflow |
| Gradual adoption | Standardize in order: CI → Docker → Deploy |

---

## What to Read Next

- [CI Recipe Collection](./03-ci-recipes.md) -- Practical examples using reusable workflows
- [Actions Security](./04-security-actions.md) -- Security for published actions
- [GitHub Actions Basics](./00-actions-basics.md) -- Review of basic syntax

---

## References

1. GitHub. "Reusing workflows." https://docs.github.com/en/actions/using-workflows/reusing-workflows
2. GitHub. "Creating a composite action." https://docs.github.com/en/actions/creating-actions/creating-a-composite-action
3. GitHub. "Publishing actions in GitHub Marketplace." https://docs.github.com/en/actions/creating-actions/publishing-actions-in-github-marketplace
4. GitHub. "Required workflows." https://docs.github.com/en/actions/using-workflows/required-workflows
5. GitHub. "Sharing workflows with your organization." https://docs.github.com/en/actions/using-workflows/sharing-workflows-secrets-and-runners-with-your-organization

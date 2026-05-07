# GitHub Actions Basics

> A CI/CD platform integrated into GitHub — understand the hierarchical structure of workflows, jobs, and steps, along with YAML syntax

## What You Will Learn

1. Understand the relationship between workflows, jobs, and steps, and their execution model
2. Learn the types of triggers (events) and when to use each
3. Be able to read and write basic workflow YAML
4. Use expressions, functions, and contexts for dynamic control
5. Understand how to use common actions and follow best practices


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. GitHub Actions Structure

### 1.1 Hierarchical Structure

```
┌──────────────────────────────────────────────────┐
│ Workflow (.github/workflows/*.yml)                │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ Job 1 (runs-on: ubuntu-latest)               │ │
│  │  ┌──────────────────────────────────────────┐│ │
│  │  │ Step 1: actions/checkout@v4              ││ │
│  │  ├──────────────────────────────────────────┤│ │
│  │  │ Step 2: actions/setup-node@v4            ││ │
│  │  ├──────────────────────────────────────────┤│ │
│  │  │ Step 3: run: npm ci                      ││ │
│  │  ├──────────────────────────────────────────┤│ │
│  │  │ Step 4: run: npm test                    ││ │
│  │  └──────────────────────────────────────────┘│ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ Job 2 (needs: job1, runs-on: ubuntu-latest)  │ │
│  │  ┌──────────────────────────────────────────┐│ │
│  │  │ Step 1: run: npm run build               ││ │
│  │  └──────────────────────────────────────────┘│ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘

Key relationships:
- Workflow: one YAML file = one workflow
- Job: the unit executed on a single runner (virtual machine)
- Step: individual tasks executed sequentially within a job
- Jobs run in parallel by default; use needs to define dependencies
```

### 1.2 Execution Environment

```
Runner:
  GitHub-hosted runners:
  ┌──────────────────────────────────┐
  │ ubuntu-latest (Ubuntu 22.04)      │ ← most common
  │ ubuntu-24.04                      │
  │ windows-latest                    │
  │ macos-latest                      │
  │ macos-14 (Apple Silicon)          │
  └──────────────────────────────────┘

  Larger Runners (paid):
  ┌──────────────────────────────────┐
  │ ubuntu-latest-4-cores            │
  │ ubuntu-latest-8-cores            │
  │ ubuntu-latest-16-cores           │
  │ windows-latest-8-cores           │
  │ macos-latest-xlarge (M1)         │
  └──────────────────────────────────┘

  Self-hosted runners:
  ┌──────────────────────────────────┐
  │ runs-on: self-hosted             │ ← your own machine
  │ runs-on: [self-hosted, gpu]      │ ← select by label
  │ runs-on: [self-hosted, linux, x64]│ ← multiple labels
  └──────────────────────────────────┘
```

### 1.3 Runner Specifications

| Runner | CPU | Memory | Storage | Consumption Rate |
|---|---|---|---|---|
| ubuntu-latest | 2 vCPU | 7 GB | 14 GB SSD | 1x |
| windows-latest | 2 vCPU | 7 GB | 14 GB SSD | 2x |
| macos-latest | 3 vCPU | 14 GB | 14 GB SSD | 10x |
| macos-14 (M1) | 3 vCPU | 7 GB | 14 GB SSD | 10x |
| ubuntu-latest-4-cores | 4 vCPU | 16 GB | 150 GB SSD | paid |
| ubuntu-latest-16-cores | 16 vCPU | 64 GB | 150 GB SSD | paid |

### 1.4 Pre-installed Software

```
Pre-installed on ubuntu-latest:
  ├── Languages: Node.js, Python, Go, Java, Ruby, .NET, Rust
  ├── Package managers: npm, pip, Maven, Gradle
  ├── Containers: Docker, Docker Compose
  ├── CLIs: AWS CLI, Azure CLI, gcloud, gh (GitHub CLI)
  ├── Build tools: Make, CMake, gcc, g++
  ├── Databases: PostgreSQL, MySQL (available as services)
  └── Other: Git, curl, wget, jq, zip, unzip

Reference:
  https://github.com/actions/runner-images
```

---

## 2. Basic Syntax

### 2.1 Minimal Workflow

```yaml
# .github/workflows/ci.yml
name: CI                           # workflow name
                                   # (shown in the Actions tab of GitHub UI)

on:                                # trigger
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:                              # job definitions
  test:                            # job ID (alphanumeric and hyphens)
    runs-on: ubuntu-latest         # execution environment
    steps:                         # steps
      - uses: actions/checkout@v4  # call an action
      - run: echo "Hello, World!" # run a shell command
```

### 2.2 Full CI Workflow

```yaml
name: CI Pipeline

on:
  push:
    branches: [main]
    paths-ignore:
      - '**.md'
      - 'docs/**'
  pull_request:
    branches: [main]

# Workflow-level permission settings
permissions:
  contents: read
  pull-requests: write

# Control concurrent runs on the same branch
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '20'

jobs:
  lint-and-typecheck:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: ESLint
        run: npm run lint

      - name: TypeScript
        run: npm run type-check

  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci
      - run: npm test -- --coverage

      - name: Upload coverage
        if: github.event_name == 'pull_request'
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/

  build:
    name: Build
    needs: [lint-and-typecheck, test]   # runs after both jobs succeed
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci
      - run: npm run build

      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: dist/
          retention-days: 7
```

### 2.3 Workflow YAML Structure Explained

```yaml
# Basic YAML structure
name: string          # workflow name (not required but recommended)

on:                   # trigger definition (required)
  event: ...

permissions:          # GITHUB_TOKEN permissions (recommended: least privilege)
  contents: read
  pull-requests: write

concurrency:          # concurrent run control (recommended: prevents duplicate PR runs)
  group: string
  cancel-in-progress: boolean

env:                  # workflow-level environment variables
  KEY: value

defaults:             # default settings for jobs/steps
  run:
    shell: bash
    working-directory: ./app

jobs:                 # job definitions (required)
  job-id:
    name: string              # display name
    runs-on: string           # runner (required)
    needs: [job-id, ...]      # dependent jobs
    if: expression            # execution condition
    timeout-minutes: number   # timeout (default: 360 minutes)
    continue-on-error: bool   # proceed to next job even if this one fails
    strategy:                 # matrix, etc.
      matrix: ...
    env:                      # job-level environment variables
      KEY: value
    outputs:                  # job outputs
      key: value
    services:                 # service containers
      name:
        image: ...
    steps:                    # steps (required)
      - uses: action@version  # action call
        with:                 # action inputs
          key: value
      - run: command          # shell command
        env:                  # step-level environment variables
          KEY: value
```

---

## 3. Triggers (Events)

### 3.1 Common Triggers Overview

```yaml
on:
  # Git events
  push:
    branches: [main, 'release/**']
    tags: ['v*']
    paths: ['src/**', 'package.json']
    paths-ignore: ['**.md']

  pull_request:
    types: [opened, synchronize, reopened]
    branches: [main]

  pull_request_target:
    types: [opened, synchronize]
    # Can access secrets even from fork PRs (caution: security risk)

  # Schedule (cron)
  schedule:
    - cron: '0 9 * * 1'  # every Monday at 9:00 UTC
    - cron: '0 0 1 * *'  # first of every month at 0:00 UTC

  # Manual execution
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deploy environment'
        required: true
        type: choice
        options: [dev, staging, prod]
      dry_run:
        description: 'Dry run mode'
        type: boolean
        default: false
      version:
        description: 'Version to deploy'
        type: string
        required: false

  # Called from other workflows
  workflow_call:
    inputs:
      node-version:
        type: string
        default: '20'
    secrets:
      npm-token:
        required: true

  # Release events
  release:
    types: [published]

  # Issue / PR comments
  issue_comment:
    types: [created]

  # Deployment status
  deployment_status:

  # Label operations
  label:
    types: [created, edited, deleted]

  # Workflow completion
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]
```

### 3.2 Trigger Comparison Table

| Trigger | Use Case | Context | Notes |
|---|---|---|---|
| push | Main branch CI, deployments | github.sha = pushed commit | Use paths filter |
| pull_request | PR CI, review assistance | github.sha = merge commit | Fork PRs have restricted permissions |
| pull_request_target | CI for fork PRs | base branch context | Be cautious of security risks |
| schedule | Periodic batches, dependency updates | Default branch | Delays possible (not guaranteed) |
| workflow_dispatch | Manual deployments, operations | Receive args via inputs | Run from GitHub UI |
| workflow_call | Reusable workflows | Caller's context | Define inputs/secrets |
| release | Release automation | Tag info available | Use published type |
| workflow_run | Post-processing, notifications | Result of previous workflow | Branch filter required |

### 3.3 Filtering Details

```yaml
# Filtering for push events
on:
  push:
    # Branch filter (glob patterns supported)
    branches:
      - main
      - 'release/**'        # release/1.0, release/2.0, etc.
      - '!release/**-beta'  # exclude release/1.0-beta
    branches-ignore:
      - 'feature/**'

    # Tag filter
    tags:
      - 'v*'                # v1.0.0, v2.0.0, etc.
    tags-ignore:
      - 'v*-rc*'            # exclude v1.0.0-rc1

    # Path filter (narrow down by changed files)
    paths:
      - 'src/**'
      - 'package.json'
      - '!src/**/*.test.ts'  # exclude changes to test files
    paths-ignore:
      - '**.md'
      - 'docs/**'
      - '.github/**'
```

### 3.4 workflow_dispatch Practical Example

```yaml
# Manual deployment workflow
name: Manual Deploy
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: choice
        options:
          - dev
          - staging
          - production
      version:
        description: 'Image tag to deploy (e.g., v1.2.3 or abc1234)'
        required: true
        type: string
      skip_tests:
        description: 'Skip smoke tests after deploy'
        required: false
        type: boolean
        default: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    steps:
      - uses: actions/checkout@v4

      - name: Deploy
        run: |
          echo "Deploying ${{ github.event.inputs.version }} to ${{ github.event.inputs.environment }}"
          ./scripts/deploy.sh \
            --env ${{ github.event.inputs.environment }} \
            --version ${{ github.event.inputs.version }}

      - name: Smoke test
        if: github.event.inputs.skip_tests != 'true'
        run: ./scripts/smoke-test.sh ${{ github.event.inputs.environment }}
```

---

## 4. Expressions and Functions

### 4.1 Contexts and Expressions

```yaml
jobs:
  example:
    runs-on: ubuntu-latest
    steps:
      # Basic expression syntax: ${{ expression }}
      - run: echo "Branch: ${{ github.ref_name }}"
      - run: echo "Actor: ${{ github.actor }}"
      - run: echo "SHA: ${{ github.sha }}"
      - run: echo "Event: ${{ github.event_name }}"
      - run: echo "Repository: ${{ github.repository }}"
      - run: echo "Run ID: ${{ github.run_id }}"
      - run: echo "Run Number: ${{ github.run_number }}"

      # Conditional branching
      - name: Deploy (main only)
        if: github.ref == 'refs/heads/main'
        run: ./deploy.sh

      # Conditional on previous step result
      - name: On failure
        if: failure()
        run: echo "The previous step failed"

      # Always run (e.g., cleanup)
      - name: Cleanup
        if: always()
        run: rm -rf tmp/

      # Functions within expressions
      - name: Contains check
        if: contains(github.event.head_commit.message, '[skip ci]')
        run: echo "CI skipped"

      - name: String comparison
        if: startsWith(github.ref, 'refs/tags/v')
        run: echo "Tag push detected"

      # Compound conditions
      - name: Deploy on main push only
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        run: ./deploy.sh

      # Check if running from a PR
      - name: PR only
        if: github.event_name == 'pull_request'
        run: echo "Running on PR #${{ github.event.pull_request.number }}"
```

### 4.2 Main Contexts Overview

| Context | Description | Example |
|---|---|---|
| github | Event information | github.sha, github.ref, github.actor |
| env | Environment variables | env.NODE_VERSION |
| vars | Repository/organization variables | vars.DEPLOY_URL |
| secrets | Secrets | secrets.API_KEY |
| job | Current job information | job.status |
| steps | Step outputs | steps.step-id.outputs.key |
| matrix | Matrix values | matrix.node-version |
| needs | Dependent job outputs | needs.build.outputs.version |
| runner | Runner information | runner.os, runner.arch |
| strategy | Matrix strategy | strategy.fail-fast |
| inputs | workflow_dispatch inputs | inputs.environment |

### 4.3 Passing Data Between Jobs

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.value }}
      should-deploy: ${{ steps.check.outputs.deploy }}
    steps:
      - uses: actions/checkout@v4

      - id: version
        run: echo "value=$(cat package.json | jq -r .version)" >> "$GITHUB_OUTPUT"

      - id: check
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            echo "deploy=true" >> "$GITHUB_OUTPUT"
          else
            echo "deploy=false" >> "$GITHUB_OUTPUT"
          fi

  deploy:
    needs: build
    if: needs.build.outputs.should-deploy == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying version ${{ needs.build.outputs.version }}"
```

### 4.4 Main Functions Overview

```yaml
# String functions
contains('Hello World', 'World')     # true
startsWith('Hello', 'He')            # true
endsWith('Hello', 'lo')              # true
format('Hello {0}', 'World')         # 'Hello World'
join(github.event.commits.*.message, ', ')  # join commit messages

# Status check functions
success()                             # previous step succeeded
failure()                             # previous step failed
always()                              # always runs
cancelled()                           # was cancelled

# JSON functions
toJSON(github.event)                  # convert to JSON
fromJSON('{"key": "value"}')          # parse JSON

# Hash functions
hashFiles('**/package-lock.json')     # SHA-256 hash of files
hashFiles('**/*.go', 'go.sum')        # hash of multiple files
```

---

## 5. Common Actions

### 5.1 Frequently Used Actions

```yaml
steps:
  # Checkout repository
  - uses: actions/checkout@v4
    with:
      fetch-depth: 0  # full history (needed for tags, etc.)
      ref: ${{ github.head_ref }}  # PR source branch
      token: ${{ secrets.PAT }}    # for private submodules

  # Set up Node.js
  - uses: actions/setup-node@v4
    with:
      node-version: '20'
      node-version-file: '.node-version'  # read version from file
      cache: 'npm'
      registry-url: 'https://npm.pkg.github.com'

  # Set up Python
  - uses: actions/setup-python@v5
    with:
      python-version: '3.12'
      cache: 'pip'
      cache-dependency-path: 'requirements*.txt'

  # Set up Go
  - uses: actions/setup-go@v5
    with:
      go-version: '1.22'
      go-version-file: 'go.mod'  # read version from go.mod
      cache: true

  # Set up Java
  - uses: actions/setup-java@v4
    with:
      distribution: 'temurin'
      java-version: '21'
      cache: 'maven'

  # Cache
  - uses: actions/cache@v4
    with:
      path: ~/.npm
      key: ${{ runner.os }}-npm-${{ hashFiles('package-lock.json') }}
      restore-keys: |
        ${{ runner.os }}-npm-

  # Upload artifact
  - uses: actions/upload-artifact@v4
    with:
      name: my-artifact
      path: |
        dist/
        !dist/**/*.map
      retention-days: 7
      if-no-files-found: error

  # Download artifact
  - uses: actions/download-artifact@v4
    with:
      name: my-artifact
      path: dist/
```

### 5.2 GitHub Script Action

```yaml
# actions/github-script: interact with the GitHub API using JavaScript
steps:
  - uses: actions/github-script@v7
    with:
      script: |
        // Add a comment to a PR
        await github.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: context.issue.number,
          body: '## CI Results\n\nAll checks passed!'
        });

  - uses: actions/github-script@v7
    id: get-pr
    with:
      result-encoding: string
      script: |
        // Get PR labels
        const { data: labels } = await github.rest.issues.listLabelsOnIssue({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: context.issue.number,
        });
        return labels.map(l => l.name).join(',');

  - run: echo "Labels: ${{ steps.get-pr.outputs.result }}"
```

### 5.3 Docker Actions

```yaml
# Build & push Docker image
steps:
  - uses: actions/checkout@v4

  # Set up Docker Buildx
  - uses: docker/setup-buildx-action@v3

  # Log in to container registry
  - uses: docker/login-action@v3
    with:
      registry: ghcr.io
      username: ${{ github.actor }}
      password: ${{ secrets.GITHUB_TOKEN }}

  # Generate metadata (tags, labels)
  - uses: docker/metadata-action@v5
    id: meta
    with:
      images: ghcr.io/${{ github.repository }}
      tags: |
        type=sha,prefix=
        type=semver,pattern={{version}}
        type=semver,pattern={{major}}.{{minor}}

  # Build & push
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

---

## 6. Services (Service Containers)

### 6.1 Database Services

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: testdb
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      elasticsearch:
        image: elasticsearch:8.11.0
        ports:
          - 9200:9200
        env:
          discovery.type: single-node
          xpack.security.enabled: "false"
        options: >-
          --health-cmd "curl -f http://localhost:9200/_cluster/health"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 10

    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/testdb
          REDIS_URL: redis://localhost:6379
          ELASTICSEARCH_URL: http://localhost:9200
```

---

## 7. Execution Flow Diagram

```
Workflow execution flow:

  Event occurs (push, PR, etc.)
       │
       ↓
  ┌──────────────────┐
  │ Evaluate trigger  │ ← branches, paths filters
  │ Does it match?    │
  └────────┬─────────┘
           │ Yes
           ↓
  ┌──────────────────┐
  │ Evaluate          │ ← cancel runs in the same group?
  │ concurrency       │
  └────────┬─────────┘
           │
           ↓
  ┌──────────────────┐
  │ Build job graph   │ ← resolve dependencies via needs
  └────────┬─────────┘
           │
     ┌─────┼─────┐
     ↓     ↓     ↓
  ┌─────┐┌─────┐┌─────┐
  │Job A ││Job B ││Job C │  ← parallel execution (no dependencies)
  └──┬──┘└──┬──┘└─────┘
     │      │
     ↓      ↓
  ┌──────────┐
  │  Job D    │  ← needs: [A, B]
  └──────────┘
       │
       ↓
  ┌──────────┐
  │ Complete  │
  └──────────┘

Steps within each job run sequentially:
  Step 1 → Step 2 → Step 3 → ... → Step N
  (if one fails, the job stops, except for steps with if: always())
```

---

## 8. Permissions

### 8.1 Principle of Least Privilege

```yaml
# Restrict permissions at the workflow level (recommended)
permissions:
  contents: read        # read repository
  pull-requests: write  # comment on PRs
  issues: write         # operate on issues

# Override at the job level
jobs:
  deploy:
    permissions:
      id-token: write   # for OIDC authentication
      contents: read
    steps: ...

  comment:
    permissions:
      pull-requests: write
    steps: ...
```

### 8.2 Available Permissions

| Permission | Purpose | Typical Use Case |
|---|---|---|
| contents | Repository code | checkout, creating releases |
| pull-requests | PR operations | comments, reviews |
| issues | Issue operations | creating issues, adding labels |
| actions | Actions operations | workflow management |
| checks | Check runs | status checks |
| deployments | Deployment management | deployment status |
| id-token | OIDC token | OIDC authentication for AWS/GCP |
| packages | Package management | pushing to GHCR |
| security-events | Security | uploading SARIF |
| statuses | Commit statuses | status updates |

---

## 9. Concurrency

```yaml
# Keep only the latest run per PR (cancel older runs)
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

# Example: consecutive pushes to the same PR
# Push 1 → CI starts
# Push 2 → cancels Push 1's CI → Push 2's CI starts
# Push 3 → cancels Push 2's CI → Push 3's CI starts

# Prevent concurrent deployments (without cancelling)
concurrency:
  group: deploy-${{ github.event.inputs.environment }}
  cancel-in-progress: false
# → waits for the previous deployment to complete before starting the next
```

---

## 10. Environment Variables and GITHUB_OUTPUT

### 10.1 Environment Variable Scopes

```yaml
# Workflow level
env:
  NODE_VERSION: '20'
  CI: true

jobs:
  build:
    # Job level
    env:
      BUILD_MODE: production
    steps:
      # Step level
      - run: npm run build
        env:
          VITE_API_URL: https://api.example.com

      # Set environment variables dynamically (available in subsequent steps)
      - run: echo "VERSION=1.2.3" >> "$GITHUB_ENV"
      - run: echo "Version is $VERSION"  # 1.2.3
```

### 10.2 GITHUB_OUTPUT (Passing Data Between Steps)

```yaml
steps:
  # Set output
  - id: extract
    run: |
      echo "version=$(cat package.json | jq -r .version)" >> "$GITHUB_OUTPUT"
      echo "commit_count=$(git rev-list --count HEAD)" >> "$GITHUB_OUTPUT"

      # Multi-line output
      echo "changelog<<EOF" >> "$GITHUB_OUTPUT"
      git log --oneline -5 >> "$GITHUB_OUTPUT"
      echo "EOF" >> "$GITHUB_OUTPUT"

  # Reference output
  - run: |
      echo "Version: ${{ steps.extract.outputs.version }}"
      echo "Commits: ${{ steps.extract.outputs.commit_count }}"
      echo "Changelog:"
      echo "${{ steps.extract.outputs.changelog }}"
```

---

## 11. Anti-Patterns

### Anti-Pattern 1: Bloated Workflows

```yaml
# Bad: stuffing everything into one workflow
name: Everything
on: [push]
jobs:
  everything:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint        # 10s
      - run: npm test            # 60s
      - run: npm run build       # 30s
      - run: npm run e2e         # 300s
      - run: docker build .      # 120s
      - run: ./deploy.sh         # 60s
      # total ~10 minutes; if one step fails, everything must be retried

# Improved: split into jobs for parallel execution
name: CI
on: [push]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
```

### Anti-Pattern 2: Hardcoded Versions

```yaml
# Bad: version definitions scattered across files
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: '20'
  - run: npm ci
  - run: npm test

# The same definition is repeated in other workflows...

# Improved: centralize with environment variables or Reusable Workflows
env:
  NODE_VERSION: '20'

jobs:
  ci:
    uses: ./.github/workflows/reusable-ci.yml
    with:
      node-version: '20'
```

### Anti-Pattern 3: Improper Use of Secrets

```yaml
# Bad: using secrets in fork PRs
on:
  pull_request_target:
    types: [opened, synchronize]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          # Checking out untrusted code from a fork
      - run: npm ci && npm test
        env:
          SECRET_KEY: ${{ secrets.SECRET_KEY }}
          # → Risk of secrets leaking from fork PRs!

# Improved: do not run untrusted code in pull_request_target
# Or introduce a label-based approval flow
```

### Anti-Pattern 4: Not Using Cache

```yaml
# Bad: installing dependencies every time
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: '20'
      # cache: 'npm'  ← missing!
  - run: npm ci  # 90 seconds every time

# Improved: leverage caching
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: '20'
      cache: 'npm'  # ← enable cache
  - run: npm ci  # 3 seconds on cache hit
```


---

## Hands-on Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement appropriate error handling
- Also write test code

```python
# Exercise 1: basic implementation template
class Exercise1:
    """Exercise on basic implementation patterns"""

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
        assert False, "An exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation to add the following features.

```python
# Exercise 2: advanced patterns
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise on advanced patterns"""

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
    assert ex.add("d", 4) == False  # size limit
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
# Exercise 3: performance optimization
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
- Choose the appropriate data structure
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured settings file | Check the settings file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check the executing user's permissions, review settings |
| Data inconsistency | Race condition in concurrent processing | Introduce locking mechanism, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace to identify the location of the error
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Validate incrementally**: Use log output or a debugger to verify hypotheses
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
    """Decorator that logs function inputs and outputs"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Calling: {func.__name__}(args={args}, kwargs={kwargs})")
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

Steps for diagnosing performance problems:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check for I/O waits**: Examine disk and network I/O status
4. **Check concurrent connections**: Monitor the connection pool state

| Problem Type | Diagnostic Tool | Solution |
|-----------|-----------|------|
| CPU load | cProfile, py-spy | Improve algorithm, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

Here is a summary of the criteria for making technology decisions.

| Criterion | Prioritize When | Can Compromise When |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, speed to market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│          Architecture Selection Flow             │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. What is the team size?                      │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → go to 2             │
│                                                 │
│  2. How often do you deploy?                    │
│    ├─ Weekly or less → Monolith + modules       │
│    └─ Daily / multiple times → go to 3         │
│                                                 │
│  3. How independent are the teams?              │
│    ├─ High → Microservices                      │
│    └─ Medium → Modular monolith                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs. Long-term Cost**
- A faster short-term approach can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay a project

**2. Consistency vs. Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies allows for the right tool for the job, but increases operational costs

**3. Level of Abstraction**
- High abstraction improves reusability but can make debugging harder
- Low abstraction is intuitive but tends to lead to code duplication

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

## 12. FAQ

### Q1: How much free tier does GitHub Actions provide?

Public repositories are unlimited and free. Private repositories get 2,000 minutes/month on GitHub Free, 3,000 minutes/month on Team, and 50,000 minutes/month on Enterprise. macOS runners consume at 10x the rate of Linux, and Windows runners at 2x. Storage ranges from 500 MB (Free) to 50 GB (Enterprise).

### Q2: What does `actions/checkout@v4` do?

It clones the repository code onto the runner's virtual machine. It must be run at the beginning of the steps. Use `fetch-depth: 0` to fetch full history (the default is a shallow clone with depth=1). For PRs, it checks out the merge commit. Submodule fetching is enabled with `submodules: true`.

### Q3: How do I share files between jobs?

Since jobs run on separate runners (VMs), the filesystem is not shared. Use `actions/upload-artifact` and `actions/download-artifact` to pass files via artifacts. For small values, use `outputs`. For large numbers of files, uploading and downloading artifacts takes time, so consider completing the processing within a single job if possible.

### Q4: Are third-party actions safe?

Third-party actions can access repository code and secrets, so verifying their trustworthiness is important. Mitigations include: (1) pin by SHA (not tag), (2) prefer actions officially managed by GitHub (actions/*), (3) check popularity and maintenance status, (4) review the source code. Using Dependabot to automatically update action versions is also recommended.

### Q5: How can I test workflows locally?

Using `act` (https://github.com/nektos/act) allows you to run GitHub Actions locally. You can specify a job with `act -j test`. However, services and some actions are not supported. For complete testing, running in a private repository is the most reliable approach.

### Q6: What is the difference between `pull_request` and `pull_request_target`?

`pull_request` runs in the context of the PR's head branch and cannot access secrets from fork PRs (safe). `pull_request_target` runs in the context of the base branch (e.g., main) and can access secrets. Combining `pull_request_target` with `actions/checkout@v4 ref: head.sha` is dangerous because it allows untrusted code from fork PRs to access secrets. Always use `pull_request` when running code from fork PRs.

### Q7: How can I send notifications based on job results within a workflow?

Using `if: always()` allows subsequent jobs to run even if a preceding job fails. You can reference preceding job results (`success`, `failure`, `cancelled`, `skipped`) via `needs.xxx.result` and use them for conditional branching to send Slack notifications or emails. Example: `if: always() && needs.test.result == 'failure'`.

### Q8: Can you trigger another workflow from within the same workflow?

Events triggered by the default `GITHUB_TOKEN` (push, tag creation, etc.) will not trigger other workflows, to prevent recursive workflow execution. Workarounds include: (1) use a Personal Access Token (PAT), (2) use a GitHub App installation token, (3) explicitly trigger via the API using `workflow_dispatch`. From a security perspective, using a GitHub App token is recommended.

### Q9: What should I do if the runner runs out of disk space?

GitHub-hosted runners have approximately 14 GB of usable disk space. If it runs out, you can: (1) delete unnecessary pre-installed software (`sudo rm -rf /usr/share/dotnet /opt/ghc`), (2) prune Docker images, (3) delete intermediate build artifacts. As a fundamental solution, set up a self-hosted runner with a larger disk, or use a Larger Runner (a high-spec runner provided by GitHub).

### Q10: What is the difference between `continue-on-error` and `if: failure()`?

`continue-on-error: true` treats a failed step as a success for the overall job. Use it for non-critical checks (e.g., experimental linting, optional tests). `if: failure()` is a condition that runs only when the previous step fails, and is used for collecting error reports or cleanup. `if: always()` always runs regardless of success or failure.

---

## 13. Workflow Commands

### 13.1 Controlling Log Output

```yaml
steps:
  - name: Workflow commands demo
    run: |
      # Grouping (collapsible log section)
      echo "::group::Dependencies Installation"
      npm ci
      echo "::endgroup::"

      # Warning message
      echo "::warning file=src/app.js,line=10,col=5::Deprecated API usage"

      # Error message
      echo "::error file=src/app.js,line=20::Missing required import"

      # Debug message (only shown when ACTIONS_STEP_DEBUG=true)
      echo "::debug::Current working directory: $(pwd)"

      # Notice message
      echo "::notice::Build completed successfully"

      # Mask a value (hide from logs)
      DYNAMIC_SECRET=$(some-command)
      echo "::add-mask::$DYNAMIC_SECRET"
      echo "Using secret: $DYNAMIC_SECRET"  # displayed as ***
```

### 13.2 Job Summary

```yaml
steps:
  - name: Generate job summary
    run: |
      # Add Markdown information to Job Summary
      echo "## Build Report" >> $GITHUB_STEP_SUMMARY
      echo "" >> $GITHUB_STEP_SUMMARY
      echo "| Item | Status |" >> $GITHUB_STEP_SUMMARY
      echo "|------|--------|" >> $GITHUB_STEP_SUMMARY
      echo "| Lint | :white_check_mark: Pass |" >> $GITHUB_STEP_SUMMARY
      echo "| Test | :white_check_mark: Pass |" >> $GITHUB_STEP_SUMMARY
      echo "| Build | :white_check_mark: Pass |" >> $GITHUB_STEP_SUMMARY
      echo "" >> $GITHUB_STEP_SUMMARY
      echo "**Duration**: 3m 42s" >> $GITHUB_STEP_SUMMARY
      echo "" >> $GITHUB_STEP_SUMMARY

      # Code block
      echo '```' >> $GITHUB_STEP_SUMMARY
      echo "Node: $(node --version)" >> $GITHUB_STEP_SUMMARY
      echo "npm: $(npm --version)" >> $GITHUB_STEP_SUMMARY
      echo '```' >> $GITHUB_STEP_SUMMARY

  - name: Coverage summary
    run: |
      # Test coverage summary
      COVERAGE=$(npx jest --coverage --coverageReporters=text-summary 2>/dev/null | tail -5)
      echo "### Test Coverage" >> $GITHUB_STEP_SUMMARY
      echo '```' >> $GITHUB_STEP_SUMMARY
      echo "$COVERAGE" >> $GITHUB_STEP_SUMMARY
      echo '```' >> $GITHUB_STEP_SUMMARY
```

---

## 14. Default Shell and Shell Settings

```yaml
# Set default shell at the workflow level
defaults:
  run:
    shell: bash
    working-directory: ./app

jobs:
  build:
    runs-on: ubuntu-latest
    # Can be overridden at the job level
    defaults:
      run:
        working-directory: ./app/frontend
    steps:
      - uses: actions/checkout@v4

      # Default: bash + ./app/frontend
      - run: npm ci

      # Override at the step level
      - run: pip install -r requirements.txt
        shell: bash
        working-directory: ./app/backend

      # PowerShell on Windows runner
      # - run: Get-ChildItem
      #   shell: pwsh

      # Run as a Python script
      - run: |
          import json
          with open('package.json') as f:
              data = json.load(f)
              print(f"Version: {data['version']}")
        shell: python
```

```
Available shells:

┌─────────┬──────────────────────────────────────────────┐
│ shell   │ Description                                   │
├─────────┼──────────────────────────────────────────────┤
│ bash    │ Default (Linux/macOS). set -eo pipefail       │
│ sh      │ POSIX-compatible shell                        │
│ pwsh    │ PowerShell Core (all OS)                      │
│ python  │ Run as a Python script                        │
│ cmd     │ Windows cmd.exe                               │
│ powershell │ Windows PowerShell (legacy)               │
└─────────┴──────────────────────────────────────────────┘

Default bash behavior:
  set -e         → stop immediately on error
  set -o pipefail → also detect errors in pipes
  Note: set -u (error on undefined variables) is NOT included;
    set it explicitly if you want strict behavior
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|---|---|
| Hierarchy | Workflow > Job > Step |
| Job execution | Parallel by default; use needs to define dependencies |
| Step execution | Sequential; uses (action) and run (command) |
| Triggers | push, pull_request, schedule, workflow_dispatch, etc. |
| Expressions | Reference contexts and branch conditionally with ${{ expression }} |
| Permissions | Set least privilege with permissions |
| Concurrency | Manage duplicate runs with concurrency |
| Data passing | GITHUB_OUTPUT (between steps), outputs (between jobs), artifact (files) |
| Runner | ubuntu-latest is most common; self-hosted is also possible |

---

## What to Read Next

- [Actions Advanced](./01-actions-advanced.md) -- matrix, caching, secrets
- [Reusable Workflows](./02-reusable-workflows.md) -- DRY workflow design
- [CI Recipe Collection](./03-ci-recipes.md) -- practical CI configurations by language
- [Actions Security](./04-security-actions.md) -- OIDC, dependency pinning

---

## References

1. GitHub. "GitHub Actions Documentation." https://docs.github.com/en/actions
2. GitHub. "Workflow syntax for GitHub Actions." https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions
3. GitHub. "Events that trigger workflows." https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows
4. GitHub. "Security hardening for GitHub Actions." https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions
5. GitHub. "Using GitHub-hosted runners." https://docs.github.com/en/actions/using-github-hosted-runners
6. nektos. "act - Run your GitHub Actions locally." https://github.com/nektos/act

# CI/CD Concepts

> Understand the three stages of Continuous Integration (CI), Continuous Delivery (CD), and Continuous Deployment, and design reliable pipelines

## What You Will Learn

1. Understand the differences between CI/CD/CDeploy and a phased adoption approach
2. Master pipeline design principles and stage composition
3. Understand branch strategy and CI/CD integration patterns
4. Learn how to connect test strategies with CI/CD in practice
5. Understand CI/CD design patterns for monorepos and microservices


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [DevOps Overview](./00-devops-overview.md)

---

## 1. The Three Stages of CI/CD

### 1.1 Overview

```
Code Change → CI → CD (Delivery) → CD (Deployment)

+--------+    +------------------+    +-------------------+    +------------------+
| Dev    | → | CI               | → | CD (Delivery)      | → | CD (Deploy)      |
| Code   |    | Build & Test     |    | Staging Deploy     |    | Prod Auto Deploy  |
| Change |    | Auto Execute     |    | Awaiting Approval  |    | Auto Execute      |
+--------+    +------------------+    +-------------------+    +------------------+
                                                  ^
                                        Manual Approval Gate
                                           (for Delivery)
```

### 1.2 Continuous Integration (CI)

A practice where developers integrate code into the main branch frequently (multiple times a day), automatically running builds and tests each time. A concept systematized by Martin Fowler in 2006, with the primary goal of avoiding "Integration Hell."

**Core Principles of CI:**

- Code is integrated into the main branch at least once a day
- Builds and tests are automatically executed for every commit
- A broken build is the top priority to fix (the 10-minute rule)
- Tests must be fast and reliable

```yaml
# Basic CI pipeline example (GitHub Actions)
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run type-check

      - name: Unit tests
        run: npm test -- --coverage

      - name: Build
        run: npm run build
```

**CI Adoption Checklist:**

```
□ Source code is managed in a single repository
□ Build is automated (buildable with a single command)
□ A test suite exists and runs automatically
□ CI is configured to run on every commit
□ CI results are immediately notified to developers
□ A remediation flow for build failures is established
□ CI completes within 10 minutes
□ The main branch always maintains a green (build passing) state
```

### 1.3 Continuous Delivery

In addition to CI, automatically generates releasable artifacts and deploys to a staging environment. Production deployment is executed after manual approval. A concept defined by Jez Humble and David Farley in their 2010 book, with the goal of always maintaining a state where software "can be safely released at any time."

**Principles of Continuous Delivery:**

- Software always maintains a releasable state
- Releasing is a business decision, not a technical one
- The deployment process is fully automated
- The same process used for production deployment is used across all environments

```yaml
# Continuous Delivery example
name: Continuous Delivery
on:
  push:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test && npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: dist/

  deploy-staging:
    needs: build-and-test
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: build-output
      - run: ./scripts/deploy.sh staging

  # Smoke tests against staging environment
  smoke-test-staging:
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run smoke tests against staging
        run: |
          npm ci
          ENVIRONMENT=staging npm run test:smoke
        env:
          BASE_URL: https://staging.example.com

  deploy-production:
    needs: smoke-test-staging
    runs-on: ubuntu-latest
    environment:
      name: production
      # Manual approval required (GitHub Environment Protection Rules)
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: build-output
      - run: ./scripts/deploy.sh production
```

### 1.4 Continuous Deployment

Every change that passes all tests is automatically deployed to production without human intervention. This is an extension of Continuous Delivery and is the most mature form of CI/CD. Facebook, Netflix, Etsy, and GitHub itself have adopted this approach.

**Prerequisites for Continuous Deployment:**

- High test coverage (80%+ for both line and branch)
- Comprehensive automated testing (unit, integration, E2E, performance)
- Automated rollback mechanism
- Canary deployment or Blue-Green deployment
- Feature Flags for gradual feature rollout
- Robust monitoring and alerting (SLO/SLI based)
- Organization-wide risk tolerance and cultural maturity

```
Continuous Deployment flow:

Push → Build → Unit Test → Integration Test → E2E Test
  → Security Scan → Stage Deploy → Smoke Test
  → Canary Deploy (5%) → Metrics monitoring (15 min)
  → Progressive Rollout (25% → 50% → 100%)
  → Auto rollback on anomaly detection
```

```yaml
# Continuous Deployment implementation example (Kubernetes + ArgoCD integration)
name: Continuous Deployment
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:all -- --coverage
      - name: Check coverage threshold
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage $COVERAGE% is below 80% threshold"
            exit 1
          fi

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Trivy vulnerability scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'

  build-and-push:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v4
      - name: Build and push Docker image
        id: meta
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  update-manifests:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          repository: myorg/k8s-manifests
          token: ${{ secrets.MANIFEST_REPO_TOKEN }}
      - name: Update image tag
        run: |
          cd overlays/production
          kustomize edit set image my-app=ghcr.io/${{ github.repository }}:${{ github.sha }}
      - name: Commit and push
        run: |
          git config user.name "ci-bot"
          git config user.email "ci@example.com"
          git add .
          git commit -m "chore: update my-app to ${{ github.sha }}"
          git push
      # ArgoCD detects the change and auto-syncs → canary deploy
```

### 1.5 Phased Adoption Strategy for the Three Stages

Most organizations cannot jump straight to Continuous Deployment. The following phased approach is realistic.

```
Phase 1: Establish CI (1-3 months)
  ├── Set up automated builds
  ├── Prepare unit tests (target coverage: 60%)
  ├── Introduce Lint / static analysis
  └── Establish PR review process

Phase 2: Establish Continuous Delivery (3-6 months)
  ├── Automated deployment to staging environment
  ├── Prepare integration tests and E2E tests (target coverage: 80%)
  ├── Configure Environment Protection Rules
  ├── Automate deployment procedures
  └── Establish rollback procedures

Phase 3: Establish Continuous Deployment (6-12 months)
  ├── Introduce canary deployment
  ├── Implement automated rollback mechanism
  ├── SLO/SLI-based monitoring
  ├── Introduce Feature Flags
  └── Cultural transformation (culture of tolerating failure)
```

---

## 2. Comparison of CI/CD Stages

### 2.1 Comparison Table of Three Stages

| Item | CI | CD (Delivery) | CD (Deployment) |
|---|---|---|---|
| Automated Build | Yes | Yes | Yes |
| Automated Test | Yes | Yes | Yes |
| Staging Deploy | Optional | Automatic | Automatic |
| Production Deploy | Manual | Automatic after manual approval | Fully automatic |
| Risk | Low | Medium | High (requires maturity) |
| Prerequisites | Test infrastructure | CI + environment management | CD + high test coverage |
| Suitable Team | All teams | CI-mature teams | CD-mature teams |
| Release Frequency | - | 1-2 times/week | Multiple to tens of times/day |
| Feedback Speed | Minutes | Hours | Minutes |
| Adoption Period | 1-3 months | 3-6 months | 6-12 months |

### 2.2 Pipeline Tool Comparison

| Tool | Hosting | Config Format | Features | Use Case |
|---|---|---|---|---|
| GitHub Actions | SaaS (GitHub) | YAML | GitHub integration, marketplace | GitHub projects |
| GitLab CI | SaaS / Self-hosted | YAML | GitLab integration, Auto DevOps | GitLab projects |
| CircleCI | SaaS | YAML | Fast, Docker-optimized | Performance-focused |
| Jenkins | Self-hosted | Groovy/YAML | High extensibility, plugins | Enterprise |
| Dagger | Local / CI | CUE/Go/Python | Portable, local reproducibility | Multi-CI environments |
| AWS CodePipeline | SaaS (AWS) | JSON/YAML | AWS integration, CodeBuild support | AWS-centric projects |
| Azure DevOps | SaaS / Self-hosted | YAML | Azure integration, Boards integration | Microsoft ecosystem |
| Buildkite | SaaS + Self-hosted | YAML | High scalability | Large organizations |

### 2.3 Tool Selection Decision Tree

```
CI/CD Tool Selection:

Using GitHub?
├── Yes → GitHub Actions (first choice)
│         ├── Need self-hosted runners? → Actions + Self-hosted Runner
│         └── AWS deployment focus? → Actions + aws-actions/*
└── No → Using GitLab?
          ├── Yes → GitLab CI/CD
          └── No → Enterprise requirements?
                    ├── Yes → Jenkins / Azure DevOps
                    └── No → Multi-CI environment needed?
                              ├── Yes → Dagger
                              └── No → CircleCI / Buildkite
```

---

## 3. Pipeline Design Principles

### 3.1 Standard Stage Composition for Pipelines

```
+-------+    +------+    +------+    +--------+    +--------+    +--------+
| Lint  | → | Build | → | Test  | → | Scan   | → | Stage  | → | Prod   |
| Static|    | Build |    | Verify|    | Vuln.  |    | Env    |    | Env    |
| Anal. |    |       |    |       |    | Scan   |    | Deploy |    | Deploy |
+-------+    +------+    +------+    +--------+    +--------+    +--------+
  ~10s        ~30s        ~2min       ~1min         ~3min         ~3min

                    ← Fast Feedback →            ← Reliability →
              (Detect failures early, fix fast)   (Gradually approach production)
```

### 3.2 Feedback Speed Principle

```python
# Pipeline optimization: fast feedback first
pipeline_stages = {
    "lint":           {"time": "10s",  "fail_rate": "20%", "order": 1},
    "type_check":     {"time": "15s",  "fail_rate": "10%", "order": 2},
    "unit_test":      {"time": "60s",  "fail_rate": "15%", "order": 3},
    "build":          {"time": "30s",  "fail_rate": "5%",  "order": 4},
    "integration_test":{"time": "180s", "fail_rate": "8%",  "order": 5},
    "e2e_test":       {"time": "300s", "fail_rate": "5%",  "order": 6},
    "security_scan":  {"time": "60s",  "fail_rate": "3%",  "order": 7},
}

# Principle: Run stages with higher failure rates first
# Principle: Run shorter stages first
# Principle: Run independent stages in parallel
```

**Feedback Speed Targets:**

| Phase | Target Time | Included Processes |
|---|---|---|
| Local Check | Within 30 seconds | Lint, formatting |
| PR CI | Within 10 minutes | Build, tests, static analysis |
| Staging Deploy | Within 15 minutes | Build, tests, deploy |
| Production Deploy | Within 30 minutes | All tests, approval, deploy, verification |

### 3.3 Parallelism and Caching

```yaml
# Pipeline acceleration through parallelism
name: Optimized CI
on: [push]

jobs:
  # Phase 1: Run independent jobs in parallel
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

  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run type-check

  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test -- --coverage
      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/

  # Phase 2: Run after all Phase 1 jobs succeed
  build:
    needs: [lint, type-check, unit-test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci && npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: dist/

  # Phase 3: E2E tests (parallelized via matrix)
  e2e-test:
    needs: build
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
      - run: npx playwright install --with-deps
      - run: npx playwright test --shard=${{ matrix.shard }}/4
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report-${{ matrix.shard }}
          path: playwright-report/

  # Phase 4: Security scan (can run in parallel with Phase 2)
  security-scan:
    needs: [lint, type-check, unit-test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Snyk
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

### 3.4 Pipeline Metrics

Track the following metrics to measure pipeline health.

```
CI/CD Metrics (DORA Metrics):

1. Deployment Frequency
   Elite: On-demand (multiple times per day)
   High: Once per day to once per week
   Medium: Once per week to once per month
   Low: Less than once per month

2. Lead Time for Changes
   Elite: Less than 1 hour
   High: 1 day to 1 week
   Medium: 1 week to 1 month
   Low: More than 1 month

3. Change Failure Rate
   Elite: 0-15%
   High: 16-30%
   Medium: 16-30%
   Low: 46-60%

4. Time to Restore Service
   Elite: Less than 1 hour
   High: Less than 1 day
   Medium: 1 day to 1 week
   Low: More than 1 week
```

```yaml
# CI metrics collection example
name: CI Metrics
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]

jobs:
  collect-metrics:
    runs-on: ubuntu-latest
    steps:
      - name: Calculate CI duration
        uses: actions/github-script@v7
        with:
          script: |
            const run = context.payload.workflow_run;
            const duration = (new Date(run.updated_at) - new Date(run.created_at)) / 1000;
            const status = run.conclusion;

            // Send metrics to Datadog, etc.
            console.log(`CI Duration: ${duration}s, Status: ${status}`);
            console.log(`Branch: ${run.head_branch}`);
            console.log(`Commit: ${run.head_sha}`);
```

---

## 4. Branch Strategies and CI/CD

### 4.1 Trunk-Based Development

```
main ─────●────●────●────●────●────●── (always deployable)
          │    │    │    │    │    │
          └─●──┘    └─●──┘    └─●──┘
         short-lived  short-lived  short-lived
         branch       branch       branch
         (hours~1day) (hours~1day) (hours~1day)

Characteristics:
- main branch is always deployable
- Feature branches are short-lived (max 1-2 days)
- Feature Flags hide incomplete features
- Works well with Continuous Deployment
```

**CI/CD Configuration for Trunk-Based Development:**

```yaml
# CI/CD for trunk-based development
name: Trunk-Based CD
on:
  push:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint
      - run: npm test -- --coverage
      - run: npm run build

  deploy:
    needs: ci
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy with feature flags
        run: |
          # Deploy reflecting Feature Flag state
          ./scripts/deploy.sh \
            --image ghcr.io/myorg/app:${{ github.sha }} \
            --feature-flags-config flags.json
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
```

### 4.2 GitHub Flow

```
main ─────●─────────●─────────●──────── (protected branch)
          │         ↑         │
          └──●──●──PR──merge──┘
          feature/xxx
          (PR review required)

Characteristics:
- Simple branch model
- PR-based code review
- CI runs on PRs
- Deploy after merging to main
```

### 4.3 Git Flow

```
main ───────────────●──────────────●──── (release tags)
                    ↑              ↑
develop ──●──●──●───┤──●──●──●────┤──── (integration branch)
          │  │  │   │  │  │  │    │
          └──┘  │   │  └──┘  │    │
        feature │   │  feature│    │
                │   │         │    │
            release  │     release │
              │      │         │   │
              └──→───┘         └──→┘

Characteristics:
- Complex but strict release management
- main, develop, feature, release, hotfix branches
- Suited for long-term maintenance software
- Integration with CI/CD tends to be complex
```

```yaml
# CI/CD for Git Flow
name: Git Flow CI/CD
on:
  push:
    branches: [main, develop, 'release/**', 'hotfix/**']
  pull_request:
    branches: [main, develop]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test && npm run build

  deploy-dev:
    if: github.ref == 'refs/heads/develop'
    needs: ci
    runs-on: ubuntu-latest
    environment: development
    steps:
      - run: ./deploy.sh development

  deploy-staging:
    if: startsWith(github.ref, 'refs/heads/release/')
    needs: ci
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - run: ./deploy.sh staging

  deploy-production:
    if: github.ref == 'refs/heads/main'
    needs: ci
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: ./deploy.sh production
```

### 4.4 Branch Strategy Comparison

| Item | Trunk-Based | GitHub Flow | Git Flow |
|---|---|---|---|
| Complexity | Low | Low | High |
| Number of Branches | Minimum | Few | Many |
| Release Frequency | Very high | High | Medium to low |
| Feature Flag Need | High | Medium | Low |
| CI/CD Compatibility | Best | Good | Complex |
| Use Cases | SaaS, Web | General projects | Packages, libraries |
| Team Size | Small to large | Small to medium | Medium to large |

---

## 5. Test Strategies

### 5.1 Test Pyramid

```
            /\
           /  \
          / E2E \          Few, high cost, slow
         /------\
        /Integration\      Moderate
       /   Tests    \
      /------------\
     /  Unit Tests   \     Many, low cost, fast
    /                 \
   /------------------\

Recommended ratio:
  Unit     : Integration : E2E = 70 : 20 : 10
```

### 5.2 Characteristics of Each Test Level

| Test Level | Execution Time | Coverage Target | Test Target | Tool Examples |
|---|---|---|---|---|
| Unit | Milliseconds to seconds | 80%+ | Functions, classes | Jest, Vitest, pytest |
| Integration | Seconds to minutes | 60%+ | APIs, DB integration | Supertest, TestContainers |
| E2E | Minutes to tens of minutes | Key flows | User scenarios | Playwright, Cypress |
| Performance | Minutes to hours | SLO targets | Response time | k6, Artillery |
| Security | Minutes | Zero vulnerabilities | Dependencies, code | Snyk, Trivy, tfsec |

### 5.3 Test Execution Example in CI

```yaml
# CI configuration based on the test pyramid
name: Test Pipeline
on: [push]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:unit -- --coverage --coverageThreshold='{"global":{"branches":80}}'
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          fail_ci_if_error: true

  integration-tests:
    needs: unit-tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: testdb
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        ports: ['6379:6379']
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/testdb
          REDIS_URL: redis://localhost:6379

  e2e-tests:
    needs: integration-tests
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3]
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e -- --shard=${{ matrix.shard }}/3
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: e2e-results-${{ matrix.shard }}
          path: |
            playwright-report/
            test-results/

  performance-tests:
    needs: integration-tests
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Run k6 load tests
        uses: grafana/k6-action@v0.3.1
        with:
          filename: tests/performance/load-test.js
        env:
          K6_CLOUD_TOKEN: ${{ secrets.K6_CLOUD_TOKEN }}
```

### 5.4 Test Quality Metrics

```yaml
# Measure test quality with Mutation Testing
name: Mutation Testing
on:
  schedule:
    - cron: '0 3 * * 1'  # Every Monday at 3:00 AM

jobs:
  mutation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: Run Stryker Mutation Testing
        run: npx stryker run
      - name: Check mutation score
        run: |
          SCORE=$(cat reports/mutation/mutation.json | jq '.schemaVersion' )
          echo "Mutation Score: $SCORE%"
          # Require 70% or above
```

---

## 6. CI/CD in Monorepos

### 6.1 CI/CD Challenges in Monorepos

```
Example monorepo structure:
monorepo/
├── packages/
│   ├── web/          # Frontend
│   ├── api/          # Backend
│   ├── shared/       # Shared library
│   └── mobile/       # Mobile app
├── package.json
└── turbo.json

Challenges:
- Running CI for all packages takes too long
- Testing packages that haven't changed is wasteful
- Need to account for inter-package dependencies
```

### 6.2 Affected Strategy

```yaml
# Affected build using Turborepo
name: Monorepo CI
on: [push, pull_request]

jobs:
  determine-affected:
    runs-on: ubuntu-latest
    outputs:
      web: ${{ steps.filter.outputs.web }}
      api: ${{ steps.filter.outputs.api }}
      shared: ${{ steps.filter.outputs.shared }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            web:
              - 'packages/web/**'
              - 'packages/shared/**'
            api:
              - 'packages/api/**'
              - 'packages/shared/**'
            shared:
              - 'packages/shared/**'

  test-web:
    needs: determine-affected
    if: needs.determine-affected.outputs.web == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx turbo test --filter=web...

  test-api:
    needs: determine-affected
    if: needs.determine-affected.outputs.api == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx turbo test --filter=api...

  # Batch execution using Turborepo (affected only)
  turbo-ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - run: npm ci
      - name: Build and test affected packages
        run: npx turbo build test lint --filter='...[HEAD~1]'
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

### 6.3 Monorepo CI with Nx

```yaml
# Using Nx affected commands
name: Nx Monorepo CI
on: [push, pull_request]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: nrwl/nx-set-shas@v4

      - run: npm ci

      - name: Lint affected
        run: npx nx affected -t lint --parallel=3

      - name: Test affected
        run: npx nx affected -t test --parallel=3 --ci

      - name: Build affected
        run: npx nx affected -t build --parallel=3

      - name: E2E affected
        run: npx nx affected -t e2e --parallel=1
```

---

## 7. CI/CD for Microservices

### 7.1 Independent Pipelines per Service

```yaml
# CI/CD pipeline per service
name: User Service CI/CD
on:
  push:
    branches: [main]
    paths:
      - 'services/user-service/**'
      - 'libs/common/**'

jobs:
  ci:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: services/user-service
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
      - run: npm run build

  build-image:
    needs: ci
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/build-push-action@v5
        with:
          context: services/user-service
          push: true
          tags: |
            ghcr.io/myorg/user-service:${{ github.sha }}
            ghcr.io/myorg/user-service:latest

  deploy:
    needs: build-image
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy user-service
        run: |
          kubectl set image deployment/user-service \
            app=ghcr.io/myorg/user-service:${{ github.sha }}
```

### 7.2 Contract Testing

Incorporate contract tests into CI to ensure API compatibility between microservices.

```yaml
# Contract tests with Pact
name: Contract Tests
on: [push]

jobs:
  consumer-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: Run consumer contract tests
        run: npm run test:contract:consumer
      - name: Publish pacts
        run: |
          npx pact-broker publish pacts/ \
            --broker-base-url=${{ secrets.PACT_BROKER_URL }} \
            --consumer-app-version=${{ github.sha }}

  provider-verification:
    needs: consumer-tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: Verify provider contracts
        run: npm run test:contract:provider
        env:
          PACT_BROKER_URL: ${{ secrets.PACT_BROKER_URL }}
          PACT_PROVIDER_VERSION: ${{ github.sha }}
```

---

## 8. Integration with Deployment Strategies

### 8.1 Blue-Green Deployment

```yaml
# CI/CD integration for Blue-Green deployment
name: Blue-Green Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Determine current environment
        id: current
        run: |
          CURRENT=$(aws elbv2 describe-target-groups \
            --names prod-active | jq -r '.TargetGroups[0].Tags[] | select(.Key=="color") | .Value')
          if [ "$CURRENT" = "blue" ]; then
            echo "deploy_to=green" >> "$GITHUB_OUTPUT"
          else
            echo "deploy_to=blue" >> "$GITHUB_OUTPUT"
          fi

      - name: Deploy to inactive environment
        run: ./deploy.sh ${{ steps.current.outputs.deploy_to }}

      - name: Run smoke tests
        run: ./smoke-test.sh ${{ steps.current.outputs.deploy_to }}

      - name: Switch traffic
        run: |
          aws elbv2 modify-listener \
            --listener-arn ${{ secrets.ALB_LISTENER_ARN }} \
            --default-actions Type=forward,TargetGroupArn=${{ steps.current.outputs.deploy_to }}-tg-arn
```

### 8.2 Canary Deployment

```yaml
# CI/CD integration for canary deployment
name: Canary Deploy
on:
  push:
    branches: [main]

jobs:
  canary:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Deploy canary (5%)
        run: |
          kubectl apply -f k8s/canary-deployment.yaml
          kubectl set image deployment/app-canary \
            app=ghcr.io/myorg/app:${{ github.sha }}

      - name: Wait and monitor (15 minutes)
        run: |
          for i in $(seq 1 15); do
            ERROR_RATE=$(curl -s "$PROMETHEUS_URL/api/v1/query?query=rate(http_requests_total{status=~'5..'}[5m])" | jq '.data.result[0].value[1]')
            echo "Minute $i: Error rate = $ERROR_RATE"
            if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
              echo "Error rate exceeded threshold, rolling back"
              kubectl rollout undo deployment/app-canary
              exit 1
            fi
            sleep 60
          done

      - name: Progressive rollout
        run: |
          for WEIGHT in 25 50 75 100; do
            echo "Rolling out to ${WEIGHT}%"
            kubectl patch deployment/app-production \
              -p "{\"spec\":{\"replicas\":$((WEIGHT * TOTAL_REPLICAS / 100))}}"
            sleep 300  # Monitor for 5 minutes
          done
```

---

## 9. Anti-Patterns

### Anti-Pattern 1: CI Theater

```
Problem:
  A CI pipeline exists but is a mere formality.
  - Low test coverage means passing tests don't guarantee quality
  - Failed tests are ignored with skip or ignore
  - False sense of security: "CI passed = safe"

Symptoms:
  ✗ "CI passed" with 20% test coverage
  ✗ More than 50 @skip annotations
  ✗ CI passes but production outages are frequent
  ✗ Flaky tests (unstable tests) are left unaddressed

Improvements:
  1. Set coverage thresholds (minimum 80%)
  2. Periodically review @skip tests
  3. Add regression tests for every production incident
  4. Introduce Mutation Testing
  5. Manage flaky tests with a dedicated tracker
```

### Anti-Pattern 2: Massive Monolithic Pipeline

```
Problem:
  Everything is crammed into one pipeline, taking 30 minutes to over an hour.
  Feedback is slow, and developers start ignoring CI.

  Push → Lint → Build → Unit → Integration → E2E → Deploy
  |                  30 minutes to 1 hour                   |

Improvements:
  1. Parallelize stages
  2. Test only changed packages (affected)
  3. Split test execution (sharding)
  4. Use caching
  5. Incremental builds

  Goal: PR CI completes within 10 minutes
```

### Anti-Pattern 3: Ignoring Environment Differences

```
Problem:
  Local, CI, staging, and production environments differ.
  "It works locally but fails in CI" happens frequently.

Symptoms:
  ✗ Local uses Node 18, CI uses Node 20
  ✗ CI has no database, so integration tests are skipped
  ✗ Staging and production have different infrastructure configurations

Improvements:
  1. Unify development environment with Docker / Dev Containers
  2. Pin language versions with .node-version, .tool-versions
  3. Start databases etc. in CI with services:
  4. Manage infrastructure for all environments with IaC
  5. Centralize environment variable management
```

### Anti-Pattern 4: Manual Release Process

```
Problem:
  CI is automated, but releases are manual.
  A "release runbook" exists with risk of following steps incorrectly.

Symptoms:
  ✗ 30-step release checklist
  ✗ Designating a "release person" for every release
  ✗ Overtime is a given on release days

Improvements:
  1. Define the release process as a workflow
  2. Automate versioning with semantic-release / Release Please
  3. Automate approval flows with Environment Protection Rules
  4. Define rollback procedures as a workflow too
```

---

## 10. Security and CI/CD

### 10.1 Supply Chain Security

```yaml
# Dependency vulnerability scanning
name: Security Scan
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 9 * * 1'  # Every Monday

jobs:
  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Dependency Review (PR only)
        if: github.event_name == 'pull_request'
        uses: actions/dependency-review-action@v4
        with:
          fail-on-severity: high

      - name: Trivy vulnerability scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          severity: 'CRITICAL,HIGH'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload scan results
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'

  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: CodeQL Analysis
        uses: github/codeql-action/init@v3
        with:
          languages: javascript
      - uses: github/codeql-action/analyze@v3

  container-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -t app:scan .
      - name: Scan container image
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'app:scan'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'
```

### 10.2 Security Best Practices for CI/CD Pipelines

```
1. Principle of Least Privilege
   - Explicitly set permissions for GITHUB_TOKEN
   - Grant only the minimum required permissions to each job
   - Pin third-party actions to a SHA

2. Secret Management
   - Use Environment Secrets to isolate per environment
   - Authenticate to cloud providers with OIDC (no long-lived keys needed)
   - Automate secret rotation

3. Supply Chain Protection
   - Use Dependabot / Renovate to auto-update dependencies
   - Commit lockfiles (package-lock.json)
   - Integrate npm audit / pip audit into CI
   - Prove builds with SLSA / Sigstore

4. Branch Protection
   - Prohibit direct pushes to main branch
   - Require PR reviews (minimum 2 reviewers)
   - Require CI passing before merge
   - Encourage signed commits
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Write test code as well

```python
# Exercise 1: Basic implementation template
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
        assert False, "Should raise an exception"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation by adding the following features.

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
- Be aware of algorithm complexity
- Choose appropriate data structures
- Measure results with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured config file | Check the path and format of the config file |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increased data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check execution user permissions, review configuration |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check error messages**: Read the stack trace and identify the source of the error
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Stepwise validation**: Validate hypotheses using log output or a debugger
5. **Fix and regression test**: After fixing, also run tests for related areas

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

Steps to diagnose performance issues when they occur:

1. **Identify bottlenecks**: Measure with profiling tools
2. **Check memory usage**: Check for memory leaks
3. **Check for I/O wait**: Review disk and network I/O status
4. **Check concurrent connections**: Review connection pool status

| Issue Type | Diagnostic Tool | Countermeasure |
|-----------|-----------|------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the decision criteria when making technology choices.

| Decision Criteria | Prioritize When | Can Compromise When |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development Speed | MVP, time-to-market | Quality-focused, mission-critical |

### Selecting Architecture Patterns

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow            │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① Team size?                                   │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → Go to ②             │
│                                                 │
│  ② Deployment frequency?                        │
│    ├─ Weekly or less → Monolith + module split  │
│    └─ Daily / multiple times → Go to ③         │
│                                                 │
│  ③ Team independence?                           │
│    ├─ High → Microservices                      │
│    └─ Medium → Modular Monolith                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Tradeoff Analysis

Technical decisions always involve tradeoffs. Analyze from the following perspectives:

**1. Short-term vs Long-term Costs**
- A quick short-term approach can become long-term technical debt
- Conversely, over-engineering incurs high short-term costs and causes project delays

**2. Consistency vs Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies allows best-fit choices, but increases operational costs

**3. Level of Abstraction**
- High abstraction improves reusability but can make debugging difficult
- Low abstraction is intuitive but prone to code duplication

```python
# Architecture decision record template
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

## 11. FAQ

### Q1: What is the ideal execution time for a CI/CD pipeline?

The target for CI on a PR is within 10 minutes. Feedback must be returned before a developer loses their focus. If it exceeds 10 minutes, consider parallelism, caching, test splitting, and incremental builds. For deployment pipelines, 15 minutes is the guideline. According to Google's research (DORA), elite teams have a lead time of under 1 hour.

### Q2: What are the prerequisites for introducing Continuous Deployment?

(1) High test coverage (80%+), (2) automated rollback mechanism, (3) canary deployment / Feature Flags, (4) robust monitoring and alerting, (5) organizational trust and risk tolerance. Introducing it without all of these in place will lead to frequent incidents. It is recommended to introduce it gradually, first establishing Continuous Delivery.

### Q3: How do you design CI/CD for a monorepo?

The foundational strategy is "affected" — targeting only the changed packages for testing and building. Monorepo tools like Nx, Turborepo, and Bazel provide change detection. In addition, downstream packages affected by inter-package dependency graphs should also be included in testing. Utilizing Remote Cache (Turborepo Cloud, Nx Cloud) contributes greatly to accelerating CI.

### Q4: How do you handle flaky tests (unstable tests)?

First, identify unstable tests and manage them with a dedicated tracker (issues, spreadsheet, etc.). Root causes are often: (1) dependencies between tests, (2) insufficient waiting for async operations, (3) dependencies on external services, (4) time-dependent logic. In the short term, use the `retry` option to retry; in the medium to long term, fix the root cause. In GitHub Actions, the `retry-on-error` action can be used.

### Q5: How do you optimize CI/CD costs?

(1) Use caching (dependencies, build artifacts), (2) differential testing (affected only), (3) test sharding (parallelism), (4) path filters for unnecessary workflows, (5) review scheduled runs, (6) consider self-hosted runners (for high-volume runs). For GitHub Actions, public repositories are free; private repositories range from 2,000 minutes/month (Free) to 50,000 minutes/month (Enterprise).

### Q6: What is the relationship between Feature Flags and CI/CD?

Feature Flags are an essential technology for enabling trunk-based development and Continuous Deployment. You can merge incomplete features into the main branch while hiding them behind a flag, then deploy to production. This avoids long-lived feature branches and greatly reduces the risk of merge conflicts. Services such as LaunchDarkly, Unleash, Flagsmith, and AWS AppConfig are available.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and confirming behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. It is recommended to thoroughly understand the fundamental concepts explained in this guide before moving to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|---|---|
| CI | Frequent integration + automated build and testing |
| CD (Delivery) | Always maintain a releasable state + deploy after manual approval |
| CD (Deployment) | Fully automated production deployment (requires high maturity) |
| Pipeline Design | Fast feedback, parallelism, caching |
| Test Strategy | Test pyramid (Unit 70 : Integration 20 : E2E 10) |
| Branch Strategy | Trunk-based (recommended), GitHub Flow, Git Flow |
| Monorepo | Affected strategy + Remote Cache |
| Security | Dependency scanning, SAST, least privilege |
| Metrics | Quantify improvements with DORA metrics |
| Target Times | CI within 10 minutes, deploy within 15 minutes |

---

## Guides to Read Next

- [GitHub Actions Basics](../01-github-actions/00-actions-basics.md) -- The concrete tool for implementing CI/CD
- [Deployment Strategies](../02-deployment/00-deployment-strategies.md) -- Strategies such as Blue-Green, Canary
- [Infrastructure as Code](./02-infrastructure-as-code.md) -- Fundamentals of infrastructure automation
- [GitOps](./03-gitops.md) -- A Git-centric deployment model

---

## References

1. Jez Humble, David Farley. *Continuous Delivery: Reliable Software Releases through Build, Test, and Deployment Automation*. Addison-Wesley, 2010.
2. Martin Fowler. "Continuous Integration." https://martinfowler.com/articles/continuousIntegration.html
3. Google. "Trunk-Based Development." https://trunkbaseddevelopment.com/
4. Charity Majors. "Test in Production." https://increment.com/testing/i-test-in-production/
5. DORA Team. "Accelerate: State of DevOps Report." https://dora.dev/
6. Nicole Forsgren, Jez Humble, Gene Kim. *Accelerate: The Science of Lean Software and DevOps*. IT Revolution Press, 2018.
7. Sam Newman. *Building Microservices*, 2nd Edition. O'Reilly Media, 2021.
8. GitHub. "GitHub Actions Documentation." https://docs.github.com/en/actions

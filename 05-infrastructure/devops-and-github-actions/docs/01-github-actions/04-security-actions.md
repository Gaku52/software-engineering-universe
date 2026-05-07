# GitHub Actions Security

> Achieve secure CI/CD through secretless authentication with OIDC, least-privilege permissions, dependency pinning, and supply chain protection

## What You Will Learn

1. Implement secretless authentication with cloud providers using OIDC (OpenID Connect)
2. Understand the principle of least privilege and risk management for third-party actions
3. Master best practices for software supply chain protection
4. Practice CI environment hardening and security auditing techniques
5. Learn the response procedures for security incidents


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [CI Recipes](./03-ci-recipes.md)

---

## 1. Secretless Authentication with OIDC

### 1.1 Traditional Method vs. OIDC

```
Traditional method (long-lived credentials):
  ┌──────────┐   AWS_ACCESS_KEY_ID    ┌──────┐
  │ GitHub   │ ──────────────────── → │ AWS  │
  │ Actions  │   AWS_SECRET_KEY       │      │
  │          │   (stored in Secrets)  │      │
  └──────────┘                        └──────┘
  Problem: Risk of long-lived key leakage, rotation overhead

OIDC method (short-lived tokens):
  ┌──────────┐  1. Issue JWT   ┌──────────┐
  │ GitHub   │ ─────────────→ │ GitHub   │
  │ Actions  │                │ OIDC     │
  │          │ ←───────────── │ Provider │
  │          │  2. Receive JWT └──────────┘
  │          │
  │          │  3. Present JWT ┌──────────┐
  │          │ ─────────────→ │ AWS STS  │
  │          │                │          │
  │          │ ←───────────── │          │
  │          │  4. Receive     └──────────┘
  └──────────┘   temporary credentials
                (expires in 15 min ~ 1 hour)
```

### 1.2 OIDC Token Structure

```json
// Example payload of a GitHub OIDC token
{
  "jti": "example-id",
  "sub": "repo:myorg/myrepo:ref:refs/heads/main",
  "aud": "sts.amazonaws.com",
  "ref": "refs/heads/main",
  "sha": "abc123def456",
  "repository": "myorg/myrepo",
  "repository_owner": "myorg",
  "actor": "username",
  "workflow": "deploy",
  "event_name": "push",
  "ref_type": "branch",
  "job_workflow_ref": "myorg/myrepo/.github/workflows/deploy.yml@refs/heads/main",
  "runner_environment": "github-hosted",
  "iss": "https://token.actions.githubusercontent.com",
  "nbf": 1700000000,
  "exp": 1700003600,
  "iat": 1700000000
}
```

The `sub` (Subject) claim in this token is critical — it controls which repositories and branches are allowed access via the trust policy of the IAM role.

### 1.3 AWS OIDC Configuration

```yaml
# AWS authentication using OIDC
name: Deploy to AWS
on:
  push:
    branches: [main]

permissions:
  id-token: write   # Required for issuing OIDC tokens
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions-role
          aws-region: ap-northeast-1
          # No secrets needed! Temporary credentials obtained via OIDC

      - run: aws s3 ls  # Use AWS API with temporary credentials
```

```hcl
# AWS IAM role configuration (Terraform)
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

resource "aws_iam_role" "github_actions" {
  name = "github-actions-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          # Restrict to specific repository and branch
          "token.actions.githubusercontent.com:sub" = "repo:myorg/myrepo:ref:refs/heads/main"
        }
      }
    }]
  })
}

# Grant only the minimum required permissions via policy
resource "aws_iam_role_policy" "github_actions_deploy" {
  name = "github-actions-deploy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:DeleteObject"
        ]
        Resource = [
          "arn:aws:s3:::my-deploy-bucket",
          "arn:aws:s3:::my-deploy-bucket/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation"
        ]
        Resource = [
          "arn:aws:cloudfront::123456789012:distribution/E1234567890"
        ]
      }
    ]
  })
}
```

### 1.4 GCP OIDC Configuration

```yaml
# GCP Workload Identity Federation
- uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: 'projects/123456/locations/global/workloadIdentityPools/github/providers/github-actions'
    service_account: 'github-actions@my-project.iam.gserviceaccount.com'
```

```hcl
# GCP configuration (Terraform)
resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github"
  display_name              = "GitHub Actions"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-actions"
  display_name                       = "GitHub Actions"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }

  attribute_condition = "assertion.repository == 'myorg/myrepo'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_binding" "github_actions" {
  service_account_id = google_service_account.github_actions.name
  role               = "roles/iam.workloadIdentityUser"

  members = [
    "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/myorg/myrepo"
  ]
}
```

### 1.5 Azure OIDC Configuration

```yaml
# Azure OIDC authentication
- uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
    # No client-secret needed! Authenticated via Federated Credential
```

```bash
# Configure federated credentials with Azure CLI
az ad app federated-credential create \
  --id <application-object-id> \
  --parameters '{
    "name": "github-actions-main",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:myorg/myrepo:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

### 1.6 OIDC Troubleshooting

```yaml
# Debugging OIDC tokens
- name: Debug OIDC token
  run: |
    # Retrieve the token
    TOKEN=$(curl -s -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
      "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=sts.amazonaws.com" | jq -r '.value')

    # Inspect the payload (do not print the token itself to logs)
    echo "$TOKEN" | cut -d '.' -f 2 | base64 -d 2>/dev/null | jq .

    # Check the sub claim
    SUB=$(echo "$TOKEN" | cut -d '.' -f 2 | base64 -d 2>/dev/null | jq -r '.sub')
    echo "Subject claim: $SUB"
```

```
Common errors and remediation:

1. "Not authorized to perform sts:AssumeRoleWithWebIdentity"
   Cause: The sub condition in the IAM role trust policy does not match
   Fix: Compare the sub claim of the OIDC token against the IAM policy condition

2. "id-token: write permission is required"
   Cause: id-token: write is missing from permissions
   Fix: Set permissions at the workflow or job level

3. "The audience is not valid"
   Cause: The client_id_list of the OIDC provider does not match
   Fix: Verify "sts.amazonaws.com" for AWS, or the configured audience for GCP

4. "Token is expired"
   Cause: The OIDC token has expired
   Fix: Perform cloud authentication immediately after obtaining the token
```

---

## 2. Least-Privilege Permissions

### 2.1 Configuring permissions

```yaml
# Disable all permissions at the workflow level, grant minimum required at the job level
permissions: {}  # All disabled by default

jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      contents: read  # Required for checkout
    steps:
      - uses: actions/checkout@v4
      - run: npm test

  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write     # OIDC
      packages: write     # Container registry
    steps:
      - uses: actions/checkout@v4
      # ...
```

### 2.2 Permission Reference and Usage

```
permissions matrix:

  Permission        read              write             Purpose
  ─────────────────────────────────────────────────────
  contents          checkout          commit/push
  pull-requests     read PR info      post comments
  issues            read issues       manage issues
  packages          read packages     publish packages
  id-token          -                 OIDC token
  actions           read run status   cache operations
  security-events   -                 post CodeQL results
  deployments       read status       update deploy status
  statuses          read status       commit status
  checks            read checks       create/update checks
  attestations      -                 create attestations
  pages             -                 Pages deployment
```

### 2.3 GITHUB_TOKEN Permission Control

```yaml
# Repository-wide default settings
# Settings → Actions → General → Workflow permissions
# → Select "Read repository contents and packages permissions"

# Per-workflow override
name: Minimal Permissions Example
on: [push]

# Disable all at workflow level
permissions: {}

jobs:
  # Grant only the required permissions per job
  lint-and-test:
    permissions:
      contents: read
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test

  comment-pr:
    if: github.event_name == 'pull_request'
    permissions:
      contents: read
      pull-requests: write
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: peter-evans/create-or-update-comment@v4
        with:
          issue-number: ${{ github.event.pull_request.number }}
          body: "CI passed!"

  publish-package:
    permissions:
      contents: read
      packages: write
      id-token: write
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # ...
```

### 2.4 Using GitHub App Tokens

```yaml
# Use a GitHub App token instead of GITHUB_TOKEN
# → Enables finer-grained permission control and cross-repository access

name: Cross-repo operations
on: [push]

jobs:
  update-other-repo:
    runs-on: ubuntu-latest
    steps:
      - name: Generate GitHub App token
        id: app-token
        uses: actions/create-github-app-token@v1
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}
          owner: ${{ github.repository_owner }}
          repositories: "other-repo"

      - uses: actions/checkout@v4
        with:
          repository: myorg/other-repo
          token: ${{ steps.app-token.outputs.token }}

      - run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          echo "Updated at $(date)" >> updates.log
          git add . && git commit -m "Auto update" && git push
```

---

## 3. Dependency Pinning

### 3.1 Pinning Actions to Commit SHAs

```yaml
# Bad: Tag reference → risk of tag being overwritten with malicious code
- uses: actions/checkout@v4          # The v4 tag can be replaced with malicious code

# Good: Fully pinned to a commit SHA
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11  # v4.1.1
  # SHA cannot be tampered with

# Dependabot can auto-update SHA references too
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    # SHA references with version comments are auto-updated
```

### 3.2 Action Allowlist

```yaml
# Restrict allowed actions at the organization level
# GitHub Organization Settings → Actions → General

# allowed-actions.txt (managed as documentation)
# Official actions:
#   actions/checkout
#   actions/setup-node
#   actions/cache
#   actions/upload-artifact
#   actions/download-artifact
#   actions/create-github-app-token
#
# Trusted third-party:
#   docker/build-push-action
#   docker/login-action
#   docker/metadata-action
#   docker/setup-buildx-action
#   aws-actions/configure-aws-credentials
#   google-github-actions/auth
#   azure/login
#   softprops/action-gh-release
#   peter-evans/create-or-update-comment
```

### 3.3 Detailed Dependabot Configuration

```yaml
# .github/dependabot.yml
version: 2
updates:
  # GitHub Actions dependencies
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
      timezone: "Asia/Tokyo"
    # Security updates applied immediately
    open-pull-requests-limit: 10
    reviewers:
      - "devops-team"
    labels:
      - "dependencies"
      - "github-actions"

  # npm dependencies
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      # Group minor/patch updates together
      minor-and-patch:
        patterns:
          - "*"
        update-types:
          - "minor"
          - "patch"
    ignore:
      # Major version upgrades handled manually
      - dependency-name: "*"
        update-types: ["version-update:semver-major"]

  # Docker image dependencies
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 3.4 Advanced Dependency Management with Renovate

```json
// renovate.json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    ":pinAllExceptPeerDependencies",
    "group:allNonMajor"
  ],
  "github-actions": {
    "enabled": true,
    "pinDigests": true
  },
  "packageRules": [
    {
      "description": "Auto-merge non-major updates",
      "matchUpdateTypes": ["minor", "patch", "pin", "digest"],
      "automerge": true,
      "automergeType": "pr",
      "platformAutomerge": true
    },
    {
      "description": "Group GitHub Actions updates",
      "matchManagers": ["github-actions"],
      "groupName": "GitHub Actions",
      "schedule": ["before 9am on Monday"]
    }
  ]
}
```

---

## 4. Supply Chain Protection

### 4.1 Threat Model

```
Software supply chain threats:

  ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ Source  │ →  │  Build   │ →  │ Package  │ →  │  Deploy  │
  │  Code   │    │  System  │    │ Registry │    │   Env    │
  └────┬────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘
       │              │               │               │
  ┌────┴────┐    ┌────┴─────┐    ┌────┴─────┐    ┌────┴─────┐
  │Threats: │    │Threats:  │    │Threats:  │    │Threats:  │
  │Dep.     │    │Build     │    │Package   │    │Misconfig │
  │poisoning│    │tampering │    │swap      │    │Excessive │
  │Code     │    │CI        │    │          │    │perms     │
  │injection│    │compromise│    │          │    │          │
  └─────────┘    └──────────┘    └──────────┘    └──────────┘

  Countermeasures:
  1. Lock and audit dependencies
  2. Reproducible builds and signing
  3. Image signing and verification
  4. Least privilege and network restrictions
```

### 4.2 SLSA Framework

```
SLSA (Supply-chain Levels for Software Artifacts) levels:

Level 0: No protection
Level 1: Documented build process, provenance generation
Level 2: Use of hosted build service, signed provenance
Level 3: Isolated build environment, tamper-resistant provenance
Level 4: Two-party review, reproducible builds (future)
```

```yaml
# Example SLSA Level 3 compliant workflow
name: Build with Provenance
on:
  push:
    tags: ['v*']

permissions:
  contents: read
  id-token: write
  packages: write
  attestations: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11

      - uses: docker/build-push-action@v5
        id: build
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.ref_name }}

      # Generate build attestation (certificate)
      - uses: actions/attest-build-provenance@v1
        with:
          subject-name: ghcr.io/${{ github.repository }}
          subject-digest: ${{ steps.build.outputs.digest }}
```

### 4.3 SBOM (Software Bill of Materials) Generation

```yaml
# Generate SBOM and attach as attestation
name: SBOM Generation
on:
  push:
    tags: ['v*']

permissions:
  contents: read
  packages: write
  id-token: write
  attestations: write

jobs:
  sbom:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: docker build -t myapp:latest .

      # Generate SBOM with Syft
      - name: Generate SBOM
        uses: anchore/sbom-action@v0
        with:
          image: myapp:latest
          format: spdx-json
          output-file: sbom.spdx.json

      - name: Upload SBOM
        uses: actions/upload-artifact@v4
        with:
          name: sbom
          path: sbom.spdx.json

      # Attach SBOM as attestation
      - uses: actions/attest-sbom@v1
        with:
          subject-name: ghcr.io/${{ github.repository }}
          subject-digest: ${{ steps.build.outputs.digest }}
          sbom-path: sbom.spdx.json
```

### 4.4 CodeQL Security Scanning

```yaml
name: CodeQL Analysis
on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 6 * * 1'  # Weekly scan

permissions:
  security-events: write
  contents: read

jobs:
  analyze:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        language: ['javascript', 'python']
    steps:
      - uses: actions/checkout@v4

      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
          # Use custom query packs
          queries: +security-and-quality

      - uses: github/codeql-action/analyze@v3
        with:
          category: "/language:${{ matrix.language }}"
```

### 4.5 Container Image Signing and Verification

```yaml
# Signing images with cosign
name: Sign Container Image
on:
  push:
    tags: ['v*']

permissions:
  contents: read
  packages: write
  id-token: write

jobs:
  sign:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/build-push-action@v5
        id: build
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.ref_name }}

      - name: Install cosign
        uses: sigstore/cosign-installer@v3

      - name: Sign image with cosign (keyless)
        run: |
          cosign sign --yes \
            ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}
        env:
          COSIGN_EXPERIMENTAL: 1

      # Verification command (run at deploy time)
      # cosign verify ghcr.io/myorg/myapp@sha256:... \
      #   --certificate-identity-regexp='https://github.com/myorg/myrepo/' \
      #   --certificate-oidc-issuer='https://token.actions.githubusercontent.com'
```

---

## 5. CI Environment Hardening

### 5.1 Network Restrictions

```yaml
# Network restrictions for self-hosted runners
jobs:
  build:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4

      # Minimize network access
      - name: Build (no network required)
        run: |
          # Offline build using cached dependencies
          npm ci --prefer-offline
          npm run build
```

### 5.2 Immutable Runners

```yaml
# Use ephemeral (disposable) runners
# Runners are cleaned up after each job
jobs:
  build:
    runs-on: ubuntu-latest  # GitHub-hosted = fresh VM every time
    # For self-hosted:
    # runs-on: [self-hosted, ephemeral]
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test
      # After the job, the VM is discarded → no risk of residual data
```

### 5.3 StepSecurity Harden Runner

```yaml
# Monitor and restrict runner activity with StepSecurity Harden Runner
name: Hardened Build
on: [push]

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: step-security/harden-runner@v2
        with:
          egress-policy: audit
          # Switch to block in production
          # egress-policy: block
          allowed-endpoints: >
            github.com:443
            api.github.com:443
            registry.npmjs.org:443
            objects.githubusercontent.com:443

      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
```

### 5.4 Security Audit Workflow

```yaml
# Periodic security audit
name: Security Audit
on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9:00 UTC
  workflow_dispatch:

permissions:
  contents: read
  security-events: write
  issues: write

jobs:
  dependency-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: npm audit
        run: |
          npm ci
          npm audit --json > audit-report.json || true

          # Create an issue if Critical/High vulnerabilities are found
          CRITICAL=$(jq '.metadata.vulnerabilities.critical' audit-report.json)
          HIGH=$(jq '.metadata.vulnerabilities.high' audit-report.json)

          if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
            echo "::warning::Critical: $CRITICAL, High: $HIGH vulnerabilities found"
          fi

      - name: Upload audit report
        uses: actions/upload-artifact@v4
        with:
          name: security-audit
          path: audit-report.json

  actions-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Audit GitHub Actions versions
        run: |
          echo "## GitHub Actions Version Audit" > actions-audit.md
          echo "" >> actions-audit.md
          echo "| File | Action | Reference | Status |" >> actions-audit.md
          echo "|---------|---------|---------|------|" >> actions-audit.md

          # Detect actions not pinned to SHA
          for file in .github/workflows/*.yml; do
            grep -n 'uses:' "$file" | while read -r line; do
              if echo "$line" | grep -qP '@[a-f0-9]{40}'; then
                echo "| $file | $(echo $line | grep -oP 'uses: \K[^@]+') | SHA | OK |" >> actions-audit.md
              elif echo "$line" | grep -qP '@v\d+'; then
                echo "| $file | $(echo $line | grep -oP 'uses: \K[^@]+') | Tag | Needs improvement |" >> actions-audit.md
              fi
            done
          done

          cat actions-audit.md

      - name: Upload audit report
        uses: actions/upload-artifact@v4
        with:
          name: actions-audit
          path: actions-audit.md
```

---

## 6. Security Incident Response

### 6.1 Response Procedures for Secret Leakage

```
Immediate response to secret leakage:

1. Immediately revoke the leaked secret
   - AWS: Disable the access key in the IAM console
   - GitHub: Settings → Secrets → Update the affected secret
   - npm: Revoke the token

2. Investigate the scope of impact
   - Check for unauthorized access in CloudTrail / audit logs
   - Identify the leak location and timeframe in Git logs
   - List resources accessible with the leaked key

3. Issue and configure new secrets
   - Consider migrating to OIDC (for long-lived keys)
   - Generate new secrets and set them in GitHub Secrets
   - Verify all workflows function correctly

4. Preventive measures
   - Introduce git-secrets / gitleaks pre-commit hooks
   - Enable Secret scanning alerts
   - Configure regular secret rotation
```

### 6.2 Detecting Compromised Actions

```yaml
# Detect tampering with third-party actions
name: Action Integrity Check
on:
  pull_request:
    paths:
      - '.github/workflows/**'

jobs:
  check-actions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check for non-pinned actions
        run: |
          ISSUES=0
          for file in .github/workflows/*.yml; do
            while IFS= read -r line; do
              if echo "$line" | grep -qP 'uses:\s+\S+@(?!([a-f0-9]{40}|[a-f0-9]{7}))'; then
                echo "::warning file=$file::Non-SHA pinned action: $line"
                ISSUES=$((ISSUES + 1))
              fi
            done < <(grep 'uses:' "$file" | grep -v '#' | grep -v './')
          done

          if [ "$ISSUES" -gt 0 ]; then
            echo "::error::Found $ISSUES non-SHA-pinned actions. Pin all actions to SHA."
            exit 1
          fi
```

### 6.3 Secret Scanning Configuration

```yaml
# Enable Secret Scanning in repository settings
# Settings → Code security and analysis → Secret scanning → Enable

# Adding custom patterns
# Settings → Code security → Secret scanning → Custom patterns

# .github/secret_scanning.yml
# Exclusion settings for secret scanning
paths-ignore:
  - "tests/fixtures/**"
  - "docs/examples/**"
```

### 6.4 Pre-commit Check with gitleaks

```yaml
# gitleaks check in CI
name: Secret Detection
on:
  pull_request:

jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

```toml
# .gitleaks.toml — gitleaks configuration
title = "Custom Gitleaks Configuration"

# Custom rules
description = "Internal API Key"
regex = '''INTERNAL_API_KEY_[A-Za-z0-9]{32}'''
tags = ["key", "internal"]

# Excluded paths
[allowlist]
paths = [
  '''tests/fixtures/''',
  '''\.github/workflows/''',
]

# Excluded patterns
regexes = [
  '''EXAMPLE_KEY_[A-Za-z0-9]+''',
]
```

---

## 7. Comparison Tables

### 7.1 Authentication Method Comparison

| Method | Security | Operational Overhead | Supported Clouds | Recommendation |
|---|---|---|---|---|
| Long-lived access keys | Low (high leakage risk) | High (rotation required) | All | Not recommended |
| OIDC | High (short-lived tokens) | Low (automatic) | AWS/GCP/Azure | Strongly recommended |
| GitHub App | High (scoped) | Medium | GitHub API | Recommended for API operations |
| GITHUB_TOKEN | Medium (auto-generated) | None | GitHub API | Default |

### 7.2 Action Reference Method Comparison

| Method | Example | Security | Operability |
|---|---|---|---|
| Branch reference | `@main` | Lowest (always changing) | High (always latest) |
| Tag reference | `@v4` | Low (can be overwritten) | High |
| Minor tag | `@v4.1.1` | Medium | Medium |
| Commit SHA | `@b4ffde...` | Highest (immutable) | Low (manual updates) |
| SHA + Dependabot | SHA + auto PR | Highest | High |

### 7.3 Security Tool Comparison

| Tool | Target | Method | CI Integration | Cost |
|---|---|---|---|---|
| CodeQL | Source code | SAST | actions/codeql | Free (public repos) |
| Trivy | Containers/IaC | SCA/SAST | aquasecurity/trivy-action | Free |
| Grype | Containers | SCA | anchore/scan-action | Free |
| gitleaks | Git history | Secret detection | gitleaks/gitleaks-action | Free |
| Snyk | Dependencies | SCA | snyk/actions | Freemium |
| Harden Runner | CI environment | Runtime protection | step-security/harden-runner | Freemium |

---

## 8. Anti-Patterns

### Anti-Pattern 1: Secrets Exposure in Fork PRs

```yaml
# Bad: secrets available in Fork PRs
on:
  pull_request_target:  # ← Dangerous! Secrets are available even in fork PRs
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}  # Executes fork code
      - run: echo "${{ secrets.DEPLOY_KEY }}"  # Leaked!

# Improved: use pull_request event where secrets are empty for fork PRs
on:
  pull_request:  # Secrets are empty for fork PRs (safe)
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test  # Only operations that don't need secrets
```

### Anti-Pattern 2: Script Injection

```yaml
# Bad: directly executing user input
steps:
  - run: echo "PR title: ${{ github.event.pull_request.title }}"
    # If the PR title contains "; rm -rf /", command injection occurs

# Improved: pass through environment variables
steps:
  - run: echo "PR title: $PR_TITLE"
    env:
      PR_TITLE: ${{ github.event.pull_request.title }}
    # Passing via environment variable prevents shell injection
```

### Anti-Pattern 3: Excessive permissions

```yaml
# Bad: grant all permissions
permissions: write-all
# → Unnecessary permissions are granted, maximizing blast radius if compromised

# Improved: grant only minimum required permissions
permissions:
  contents: read
  packages: write
```

### Anti-Pattern 4: Logging Secrets

```yaml
# Bad: printing secrets in debug output
- run: |
    echo "Debug: ${{ secrets.API_KEY }}"
    curl -v -H "Authorization: Bearer ${{ secrets.API_KEY }}" $URL
    # The -v option displays headers → secrets exposed

# Improved: use environment variables and limit debug output
- run: |
    curl -s -o response.json -w "%{http_code}" \
      -H "Authorization: Bearer $API_KEY" "$URL"
    echo "HTTP Status: $(cat response.json | jq -r '.status')"
  env:
    API_KEY: ${{ secrets.API_KEY }}
    URL: ${{ vars.API_URL }}
```

### Anti-Pattern 5: Disabling Dependabot

```
Bad practice:
  "Dependabot creates too many PRs so I disabled it"
  → Security patches are delayed, leaving vulnerabilities unaddressed

Improved approach:
  1. Reduce PR count with grouping configuration
  2. Always keep security updates enabled
  3. Configure auto-merge to apply patch/minor updates automatically
  4. Set up a weekly routine to review updates in batch
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also write test code

```python
# Exercise 1: Basic implementation template
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
        assert False, "Exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation to add the following features.

```python
# Exercise 2: Advanced patterns
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

**Key points:**
- Be mindful of algorithm time complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured config file | Verify the config file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increased data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check execution user permissions, review configuration |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace to identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Validate incrementally**: Use log output and debuggers to verify hypotheses
5. **Fix and regression test**: After fixing, run tests for related areas too

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
    """Decorator that logs function input/output"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Calling: {func.__name__}(args={args}, kwargs={kwargs})")
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
2. **Check memory usage**: Verify presence of memory leaks
3. **Check I/O wait**: Review disk and network I/O status
4. **Check concurrent connections**: Check connection pool status

| Problem type | Diagnostic tool | Countermeasure |
|-----------|-----------|------|
| High CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexing, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criteria | Prioritize when | Can compromise when |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin screens, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow            │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. Team size?                                  │
│    ├─ Small (1-5) → Monolith                    │
│    └─ Large (10+) → Go to 2                     │
│                                                 │
│  2. Deployment frequency?                       │
│    ├─ Weekly or less → Monolith + modular split │
│    └─ Daily / multiple times → Go to 3          │
│                                                 │
│  3. Team independence?                          │
│    ├─ High → Microservices                      │
│    └─ Medium → Modular monolith                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs. long-term cost**
- A faster short-term approach may become technical debt in the long term
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs. flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies enables best-fit choices but increases operational costs

**3. Level of abstraction**
- High abstraction improves reusability but can make debugging more difficult
- Low abstraction is intuitive but tends to cause code duplication

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

## 9. FAQ

### Q1: Should I use OIDC or long-lived access keys?

Use OIDC whenever possible. Long-lived access keys carry a leakage risk and impose a rotation overhead. AWS, GCP, and Azure all support GitHub Actions OIDC. Gradually migrate existing keys to OIDC and delete them from Secrets after migration.

### Q2: Should I use Dependabot or Renovate?

Dependabot is easier since it is integrated into the GitHub ecosystem. Renovate offers more flexible configuration (auto-merge, grouping, scheduling) and is better suited for large projects or monorepos. Dependabot is sufficient for keeping GitHub Actions ecosystem updates current.

### Q3: How do I decide GITHUB_TOKEN permissions?

The default is read-all. Set `permissions: {}` at the workflow level to disable everything, then explicitly grant only the required permissions per job. `contents: read` is needed for checkout, `pull-requests: write` for PR comments, and `id-token: write` for OIDC.

### Q4: When should pull_request_target be used?

Use it when you do not need to execute code from fork PRs and only need to operate on PR metadata (labeling, posting comments, etc.). Never checkout and execute code from a fork PR. If code validation is required, use the `pull_request` event and only run operations that do not need secrets.

### Q5: What is the security difference between self-hosted and GitHub-hosted runners?

GitHub-hosted runners use a clean VM every time, so there is no residual data from previous jobs. Self-hosted runners are persistent, meaning environment variables and filesystem data can linger. If using self-hosted runners, configuring ephemeral (disposable) mode is strongly recommended.

### Q6: Is container image signing mandatory?

It is strongly recommended for images published publicly or deployed to production environments. Using cosign's Keyless Signing (OIDC-based signing via Sigstore/Fulcio) requires no key management and is simple to implement. Verifying signatures in the deployment pipeline prevents tampered images from running.

### Q7: Is Secret Scanning only available on paid plans?

It is available for free on public repositories. Private repositories require a GitHub Advanced Security (GHAS) license. If GHAS is not available, integrating gitleaks into CI provides equivalent functionality.

---

## 10. Security Checklist and Compliance

### 10.1 CI/CD Security Maturity Checklist

```
Level 1: Basic Security
  [  ] permissions explicitly set in all workflows
  [  ] Third-party actions pinned to commit SHA
  [  ] Default GITHUB_TOKEN permissions set to read-only
  [  ] No steps that output secrets to logs

Level 2: Authentication and Dependency Management
  [  ] Using OIDC for cloud authentication (no long-lived keys)
  [  ] Dependencies automatically updated with Dependabot/Renovate
  [  ] npm audit / pip-audit / govulncheck integrated into CI
  [  ] gitleaks or Secret Scanning is enabled

Level 3: Supply Chain Protection
  [  ] SBOM generated and included in artifacts
  [  ] Container images signed with cosign
  [  ] Code scanning performed with CodeQL or Semgrep
  [  ] SLSA Provenance generated

Level 4: Advanced Hardening
  [  ] Network restrictions applied with Harden Runner
  [  ] Ephemeral runners in use
  [  ] Branch protection configured with required CI + required review
  [  ] Approval gates configured for deployment environments
  [  ] Security incident response procedures documented
```

### 10.2 Compliance Workflow

```yaml
# .github/workflows/compliance-check.yml
name: Compliance Check

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 0 * * 1'  # Every Monday

jobs:
  license-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check OSS Licenses
        run: |
          npx license-checker --production --onlyAllow \
            'MIT;BSD-2-Clause;BSD-3-Clause;Apache-2.0;ISC;0BSD;CC0-1.0;Unlicense' \
            --excludePackages 'some-internal-pkg@1.0.0'

      - name: Generate License Report
        run: |
          npx license-checker --production --csv > licenses.csv

      - name: Upload License Report
        uses: actions/upload-artifact@v4
        with:
          name: license-report
          path: licenses.csv

  vulnerability-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci

      - name: Full Vulnerability Audit
        run: |
          npm audit --audit-level=critical --json > audit-report.json || true
          CRITICAL=$(jq '.metadata.vulnerabilities.critical' audit-report.json)
          HIGH=$(jq '.metadata.vulnerabilities.high' audit-report.json)
          echo "Critical: $CRITICAL, High: $HIGH"
          if [ "$CRITICAL" -gt 0 ]; then
            echo "Critical vulnerabilities found!"
            exit 1
          fi

      - name: Upload Audit Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: audit-report
          path: audit-report.json
```

### 10.3 Workflow Permission Audit Script

```bash
#!/bin/bash
# scripts/audit-workflow-permissions.sh
# Audit permission settings in workflow files

echo "=== GitHub Actions Workflow Permission Audit ==="
echo ""

WORKFLOWS_DIR=".github/workflows"
ISSUES_FOUND=0

for workflow in "$WORKFLOWS_DIR"/*.yml "$WORKFLOWS_DIR"/*.yaml; do
  [ -f "$workflow" ] || continue
  echo "Checking: $workflow"

  # Check for top-level permissions
  if ! grep -q "^permissions:" "$workflow"; then
    echo "  WARNING: No top-level permissions block"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
  fi

  # Detect write-all
  if grep -q "permissions: write-all" "$workflow"; then
    echo "  CRITICAL: write-all permissions detected"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
  fi

  # Detect unpinned actions
  if grep -E "uses: [a-zA-Z].*@v[0-9]" "$workflow" | grep -v "@[0-9a-f]\{40\}" > /dev/null; then
    echo "  WARNING: Actions not pinned to commit SHA"
    grep -n -E "uses: [a-zA-Z].*@v[0-9]" "$workflow" | while read -r line; do
      echo "    $line"
    done
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
  fi

  echo ""
done

echo "=== Audit Complete ==="
echo "Issues found: $ISSUES_FOUND"
exit $ISSUES_FOUND
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Rather than theory alone, actually writing code and verifying its behavior deepens understanding.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Topic | Key Points |
|---|---|
| OIDC | Secretless authentication with short-lived tokens, strongly recommended |
| Least privilege | Disable all with permissions: {} → grant minimum per job |
| Dependency pinning | Commit SHA + Dependabot is the best approach |
| Supply chain | SLSA, CodeQL, SBOM, attestations |
| Image signing | Tamper prevention with cosign Keyless Signing |
| Script injection | Pass user input through environment variables |
| Fork PRs | Avoid pull_request_target as much as possible |
| CI hardening | Harden Runner, ephemeral runners |
| Secret management | Dual defense with Secret Scanning + gitleaks |
| Incident response | Immediate revocation → impact investigation → prevention |
| Compliance | Run license and vulnerability audits periodically |

---

## What to Read Next

- [GitHub Actions Basics](./00-actions-basics.md) -- Return to the basics
- [Deployment Strategies](../02-deployment/00-deployment-strategies.md) -- Secure deployment methods
- [Release Management](../02-deployment/03-release-management.md) -- Signed releases

---

## References

1. GitHub. "Security hardening for GitHub Actions." https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions
2. GitHub. "About security hardening with OpenID Connect." https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect
3. SLSA. "Supply-chain Levels for Software Artifacts." https://slsa.dev/
4. StepSecurity. "Harden Runner." https://github.com/step-security/harden-runner
5. Sigstore. "Cosign - Container Signing." https://docs.sigstore.dev/cosign/overview/
6. GitHub. "Secret scanning." https://docs.github.com/en/code-security/secret-scanning

# IaC Security

> A systematic approach to Infrastructure as Code security — from automated security checks of infrastructure code using tfsec and Checkov, to governance enforcement through Policy as Code

## Prerequisites

- Basic syntax and concepts of Terraform / CloudFormation
- Basic understanding of cloud infrastructure services (AWS/GCP/Azure)
- Fundamentals of CI/CD pipelines

## What You Will Learn

1. **IaC Security Risks** — Misconfigurations lurking in Terraform/CloudFormation code and their impact
2. **Static Analysis Tools** — Automated security policy validation using tfsec, Checkov, KICS, and Trivy
3. **Policy as Code** — Implementing custom policies with OPA/Rego and Sentinel
4. **Drift Detection** — Techniques for detecting and correcting discrepancies between IaC and actual infrastructure
5. **CI/CD Integration** — Practical methods for embedding security gates into pipelines
6. **Secret Management** — Eliminating sensitive information from IaC code

---

## 1. The Importance of IaC Security

### Why IaC Security Matters

IaC (Infrastructure as Code) is originally introduced to improve consistency and reproducibility of infrastructure configurations. However, when security issues exist within the IaC code itself, those issues are **reproduced at scale** every time the code is applied. A misconfiguration that would only affect one environment in a manual setup is deployed to all environments simultaneously with IaC.

#### Three Threat Models in IaC Security

```
+------------------------------------------------------------------+
|          Threat Models in IaC Security                           |
|------------------------------------------------------------------|
|                                                                  |
|  [Threat 1: Misconfiguration]                                    |
|  +-- Most frequently occurring risk                              |
|  +-- S3 bucket public exposure, overly permissive SGs, etc.     |
|  +-- Over 60% of cloud security incidents in 2023 were          |
|  |   caused by misconfiguration                                  |
|  +-- IaC causes misconfigurations to be deployed at scale       |
|                                                                  |
|  [Threat 2: Secrets Exposure]                                    |
|  +-- Hardcoded credentials                                       |
|  +-- Secrets remaining in Git history                           |
|  +-- Sensitive data inside Terraform state files                |
|  +-- Secrets exposed via output variables                       |
|                                                                  |
|  [Threat 3: Supply Chain Attacks]                                |
|  +-- Malicious Terraform modules                                 |
|  +-- Tampered provider plugins                                   |
|  +-- Fetching modules from untrusted registries                 |
|  +-- Forgetting to pin module versions                          |
|                                                                  |
+------------------------------------------------------------------+
```

### Classification of Security Issues in IaC

```
+------------------------------------------------------------------+
|         Typical Security Issues in IaC                           |
|------------------------------------------------------------------|
|                                                                  |
|  [Network]                                                       |
|  +-- Security Group allows 0.0.0.0/0:22                        |
|  +-- NACL default allow-all                                     |
|  +-- Overly permissive VPC peering                             |
|  +-- VPC Endpoint not configured (API traffic over public path) |
|  +-- Unnecessary resources placed in public subnets            |
|                                                                  |
|  [Data Protection]                                               |
|  +-- S3 bucket public access                                    |
|  +-- RDS/EBS encryption not configured                         |
|  +-- Log encryption not configured                             |
|  +-- Backup encryption and retention period not configured     |
|  +-- Cross-region replication not configured                   |
|                                                                  |
|  [Authentication & Authorization]                                |
|  +-- IAM policy with * (full permissions)                       |
|  +-- Hardcoded credentials                                      |
|  +-- MFA not configured for resources                          |
|  +-- Service roles with excessive permissions                  |
|  +-- Insufficient Principal restriction in AssumeRole          |
|                                                                  |
|  [Logging & Monitoring]                                          |
|  +-- CloudTrail disabled                                        |
|  +-- VPC Flow Logs not configured                              |
|  +-- Access logging not enabled                                |
|  +-- CloudWatch alarms not configured                          |
|  +-- GuardDuty/SecurityHub not enabled                         |
|                                                                  |
|  [Compliance]                                                    |
|  +-- Non-compliance with tagging rules                         |
|  +-- Region restrictions not applied                           |
|  +-- Data retention policies not implemented                   |
|  +-- Non-compliance with encryption standards                  |
|                                                                  |
+------------------------------------------------------------------+
```

### Timing of IaC Security Checks

Security checks should be performed as early as possible, following the "shift-left" principle. The later a problem is discovered, the more the remediation cost increases exponentially.

```
Developer PC      CI/CD           Pre-Deploy           Runtime
    |                |                  |                  |
  [pre-commit]    [Build]           [Plan/Apply]       [Drift Detection]
    |                |                  |                  |
  tfsec           Checkov           Sentinel/OPA       AWS Config
  trivy           KICS              (Policy Gate)      Prowler
  (IDE integration) tfsec                              (Periodic Scan)
  git-secrets     trivy                                driftctl
                  Snyk IaC
    |                |                  |                  |
  Cost: Low       Cost: Medium      Cost: High         Cost: Highest
  Speed: Fastest  Speed: Fast       Speed: Medium      Speed: Slow
```

#### Layer Structure of Security Checks

```
┌─────────────────────────────────────────────────────────┐
│          IaC Security Check Layers                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Layer 5: Runtime Monitoring                            │
│  ├── AWS Config Rules (Resource compliance checks)      │
│  ├── Prowler (CIS benchmark periodic scans)             │
│  └── Drift detection (terraform plan -detailed-exitcode)│
│                                                         │
│  Layer 4: Policy Gate                                   │
│  ├── OPA/Conftest (terraform plan JSON validation)      │
│  ├── Sentinel (Terraform Cloud/Enterprise)              │
│  └── AWS Service Control Policies                       │
│                                                         │
│  Layer 3: CI/CD Pipeline                                │
│  ├── Checkov (multi-framework static analysis)          │
│  ├── tfsec / trivy config (Terraform-specific analysis) │
│  ├── KICS (Checkmarx IaC scanner)                       │
│  └── SARIF → GitHub Security tab integration            │
│                                                         │
│  Layer 2: Pre-commit Hooks                              │
│  ├── tfsec / trivy (local scan)                         │
│  ├── terraform fmt / validate                           │
│  ├── git-secrets / gitleaks (secret detection)          │
│  └── tflint (Terraform linter)                          │
│                                                         │
│  Layer 1: IDE Integration                               │
│  ├── VS Code tfsec extension                            │
│  ├── VS Code Checkov extension                          │
│  └── IntelliJ Terraform plugin                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 2. tfsec (Terraform Security Scanner)

### Internal Architecture of tfsec

tfsec is a static analysis tool that parses Terraform HCL code and detects security rule violations. It is currently being integrated into Aqua Security's Trivy, but is still widely used as a standalone tool.

```
┌─────────────────── tfsec Internal Processing Flow ───────────────────┐
│                                                                        │
│  1. HCL Parser                                                         │
│     ├── Converts .tf files to AST (Abstract Syntax Tree)              │
│     ├── Resolves variables (variables.tf, terraform.tfvars)           │
│     └── Resolves module references                                     │
│                                                                        │
│  2. Resource Graph Construction                                        │
│     ├── Analyzes dependencies between resources                       │
│     ├── Tracks attribute reference chains (e.g., SG → EC2)           │
│     └── Evaluates data sources                                        │
│                                                                        │
│  3. Rule Engine                                                        │
│     ├── Built-in rules (~1000 rules)                                  │
│     ├── Custom rules (YAML/JSON/Rego)                                 │
│     └── Each rule inspects resources                                  │
│                                                                        │
│  4. Result Reporter                                                    │
│     ├── Text / JSON / SARIF / CSV / JUnit                             │
│     ├── Severity levels: CRITICAL, HIGH, MEDIUM, LOW                  │
│     └── Presents fix recommendations                                  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### How to Use tfsec

```bash
# Install
brew install tfsec

# Or via Trivy (recommended: tfsec is already integrated into Trivy)
brew install trivy
trivy config .

# Basic scan
tfsec .

# Only above a specific severity
tfsec --minimum-severity HIGH .

# JSON output (for CI/CD)
tfsec --format json --out results.json .

# SARIF output (GitHub Security tab integration)
tfsec --format sarif --out results.sarif .

# JUnit output (Jenkins integration)
tfsec --format junit --out results.xml .

# Exclude a specific directory
tfsec --exclude-path modules/legacy .

# Disable a specific rule
tfsec --exclude aws-s3-enable-versioning .

# Specify a custom rule file
tfsec --custom-check-dir ./custom-rules .

# Specify a Terraform variables file
tfsec --tfvars-file production.tfvars .

# Soft fail (output results without stopping CI)
tfsec --soft-fail .
```

### tfsec Detection Examples and Fixes

```hcl
# NG: Issues detected by tfsec (multiple security violations)
resource "aws_s3_bucket" "data" {
  bucket = "my-data-bucket"
  # aws-s3-enable-bucket-encryption: encryption not configured
  # aws-s3-enable-bucket-logging: access logging not configured
  # aws-s3-enable-versioning: versioning not configured
  # aws-s3-block-public-acls: public access block not configured
}

resource "aws_security_group_rule" "ssh" {
  type              = "ingress"
  from_port         = 22
  to_port           = 22
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]  # aws-vpc-no-public-ingress-sgr
  security_group_id = aws_security_group.main.id
}

resource "aws_db_instance" "main" {
  engine         = "postgres"
  instance_class = "db.t3.medium"
  # aws-rds-encrypt-instance-storage-data: encryption not configured
  # aws-rds-no-public-db-access: public access control not configured
  # aws-rds-enable-performance-insights: performance insights not configured
}

# OK: After fix (compliant with security best practices)
resource "aws_s3_bucket" "data" {
  bucket = "my-data-bucket"

  tags = {
    Environment = "production"
    Security    = "high"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data" {
  bucket = aws_s3_bucket.data.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.data.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "data" {
  bucket = aws_s3_bucket.data.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_logging" "data" {
  bucket        = aws_s3_bucket.data.id
  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "s3-access-logs/"
}

resource "aws_s3_bucket_public_access_block" "data" {
  bucket                  = aws_s3_bucket.data.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "data" {
  bucket = aws_s3_bucket.data.id

  rule {
    id     = "archive-old-objects"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }
}

resource "aws_db_instance" "main" {
  engine                  = "postgres"
  engine_version          = "15.4"
  instance_class          = "db.t3.medium"
  storage_encrypted       = true
  kms_key_id              = aws_kms_key.rds.arn
  publicly_accessible     = false
  multi_az                = true
  backup_retention_period = 35
  deletion_protection     = true

  performance_insights_enabled    = true
  performance_insights_kms_key_id = aws_kms_key.rds.arn

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.private.name

  tags = {
    Environment = "production"
  }
}
```

### tfsec Inline Suppression

```hcl
# Suppress a specific rule with a valid reason
resource "aws_security_group_rule" "https" {
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]  #tfsec:ignore:aws-vpc-no-public-ingress-sgr -- Public HTTPS endpoint
  security_group_id = aws_security_group.alb.id
}

# Suppress multiple rules simultaneously
resource "aws_s3_bucket" "public_assets" {
  bucket = "my-public-assets"
  #tfsec:ignore:aws-s3-block-public-acls -- CDN origin for public assets
  #tfsec:ignore:aws-s3-block-public-policy -- Intentionally public
}

# Suppression with expiry date (tfsec 1.28+)
resource "aws_instance" "legacy" {
  ami           = "ami-xxx"
  instance_type = "t3.micro"
  #tfsec:ignore:aws-ec2-enforce-http-token-imds:exp:2024-12-31 -- Migration planned
}
```

### tfsec Custom Rules

```yaml
# .tfsec/custom_checks.yaml
---
checks:
  - code: CUS001
    description: "S3 bucket must have environment tag"
    impact: "Cannot track resource ownership"
    resolution: "Add 'Environment' tag to the bucket"
    requiredTypes:
      - resource
    requiredLabels:
      - aws_s3_bucket
    severity: MEDIUM
    matchSpec:
      name: tags
      action: contains
      value: Environment

  - code: CUS002
    description: "RDS instance must have deletion protection"
    impact: "Database can be accidentally deleted"
    resolution: "Set deletion_protection to true"
    requiredTypes:
      - resource
    requiredLabels:
      - aws_db_instance
    severity: HIGH
    matchSpec:
      name: deletion_protection
      action: equals
      value: true

  - code: CUS003
    description: "EC2 instance must use IMDSv2"
    impact: "SSRF attacks can access instance metadata"
    resolution: "Set metadata_options http_tokens to required"
    requiredTypes:
      - resource
    requiredLabels:
      - aws_instance
    severity: CRITICAL
    matchSpec:
      name: metadata_options
      action: isPresent
      subMatch:
        name: http_tokens
        action: equals
        value: required
```

---

## 3. Checkov (Multi-Framework Support)

### Features of Checkov

| Item | tfsec | Checkov | KICS | Trivy |
|------|-------|---------|------|-------|
| Supported IaC | Terraform | TF, CFn, K8s, ARM, Docker, Helm | Many | TF, CFn, K8s, Docker, Helm |
| Number of rules | ~1000 | ~2500 | ~2000 | ~1500 |
| Custom policies | YAML/Rego | Python/YAML/Rego | Rego | Rego |
| Graph-based analysis | Partial | Yes (dependency analysis) | No | Partial |
| SCA capability | No | Yes (OSS vulnerabilities) | No | Yes |
| CI/CD integration | GitHub Action | GitHub Action, pre-commit | GitHub Action | GitHub Action |
| Fix suggestions | Partial | Yes (auto-fix PRs) | No | Partial |
| License management | No | Yes | No | Yes |
| Execution speed | Fast | Moderate | Moderate | Fast |

### Internal Architecture of Checkov

```
┌─────────────────── Checkov Internal Processing Flow ─────────────────┐
│                                                                        │
│  1. Framework Detection                                                │
│     ├── Determines framework from file extension/content             │
│     ├── .tf → Terraform                                               │
│     ├── template.yaml → CloudFormation                                │
│     ├── Dockerfile → Dockerfile                                       │
│     └── deployment.yaml → Kubernetes                                  │
│                                                                        │
│  2. Parser (per framework)                                             │
│     ├── TerraformParser → HCL AST                                     │
│     ├── CFNParser → YAML/JSON DOM                                      │
│     ├── KubernetesParser → YAML DOM                                    │
│     └── DockerfileParser → Instruction list                           │
│                                                                        │
│  3. Resource Graph (Checkov's unique feature)                         │
│     ├── Analyzes references and dependencies between resources        │
│     ├── e.g., tracks the relationship SG ← EC2                       │
│     ├── Enables graph-based policy evaluation                        │
│     └── Allows rules spanning multiple resources                     │
│                                                                        │
│  4. Check Runner                                                       │
│     ├── Python checks (BaseResourceCheck)                             │
│     ├── YAML checks                                                   │
│     ├── Graph checks                                                  │
│     └── External checks (fetched from GitHub URL)                    │
│                                                                        │
│  5. Result Reporter                                                    │
│     ├── CLI / JSON / SARIF / JUnit / CSV / CycloneDX                 │
│     └── Bridgecrew platform integration                               │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### How to Use Checkov

```bash
# Install
pip install checkov

# Terraform scan
checkov -d . --framework terraform

# Kubernetes manifest scan
checkov -d ./k8s/ --framework kubernetes

# Dockerfile scan
checkov --file Dockerfile --framework dockerfile

# Helm chart scan
checkov -d ./charts/ --framework helm

# CloudFormation scan
checkov --file template.yaml --framework cloudformation

# Scan multiple frameworks simultaneously
checkov -d . --framework terraform,kubernetes,dockerfile

# Run only specific checks
checkov -d . --check CKV_AWS_18,CKV_AWS_19,CKV_AWS_21

# Skip specific checks
checkov -d . --skip-check CKV_AWS_999

# Output formats
checkov -d . -o json > checkov-results.json
checkov -d . -o sarif > checkov-results.sarif
checkov -d . -o junitxml > checkov-results.xml
checkov -d . -o cyclonedx > checkov-sbom.xml

# Specify custom policy directory
checkov -d . --external-checks-dir ./custom_checks

# External checks (fetched from GitHub)
checkov -d . --external-checks-git "https://github.com/myorg/checkov-policies"

# Compact output (hide passed checks)
checkov -d . --compact

# Ignore known issues (baseline)
checkov -d . --baseline checkov-baseline.json

# Create a baseline
checkov -d . --create-baseline

# SCA scan (vulnerability check for dependencies)
checkov -d . --framework sca_package
```

### Checkov Custom Policies (Python)

```python
# custom_checks/s3_naming_convention.py
from checkov.terraform.checks.resource.base_resource_check import BaseResourceCheck
from checkov.common.models.enums import CheckResult, CheckCategories

class S3NamingConvention(BaseResourceCheck):
    """Checks whether the S3 bucket name follows naming conventions"""

    def __init__(self):
        name = "S3 bucket follows naming convention: {env}-{service}-{purpose}"
        id = "CKV_CUSTOM_1"
        supported_resources = ["aws_s3_bucket"]
        categories = [CheckCategories.CONVENTION]
        super().__init__(name=name, id=id, categories=categories,
                        supported_resources=supported_resources)

    def scan_resource_conf(self, conf):
        bucket_name = conf.get("bucket", [""])[0]
        # Naming convention: {env}-{service}-{purpose}
        valid_prefixes = ["prod-", "stg-", "dev-", "shared-"]
        if any(bucket_name.startswith(prefix) for prefix in valid_prefixes):
            return CheckResult.PASSED
        return CheckResult.FAILED

check = S3NamingConvention()
```

```python
# custom_checks/rds_backup_retention.py
from checkov.terraform.checks.resource.base_resource_check import BaseResourceCheck
from checkov.common.models.enums import CheckResult, CheckCategories

class RDSBackupRetention(BaseResourceCheck):
    """Checks that RDS backup retention period is at least 30 days"""

    def __init__(self):
        name = "RDS backup retention period is at least 30 days"
        id = "CKV_CUSTOM_2"
        supported_resources = ["aws_db_instance"]
        categories = [CheckCategories.BACKUP_AND_RECOVERY]
        super().__init__(name=name, id=id, categories=categories,
                        supported_resources=supported_resources)

    def scan_resource_conf(self, conf):
        retention = conf.get("backup_retention_period", [0])
        if isinstance(retention, list):
            retention = retention[0]
        if isinstance(retention, int) and retention >= 30:
            return CheckResult.PASSED
        return CheckResult.FAILED

check = RDSBackupRetention()
```

```python
# custom_checks/ec2_imdsv2.py
from checkov.terraform.checks.resource.base_resource_check import BaseResourceCheck
from checkov.common.models.enums import CheckResult, CheckCategories

class EC2IMDSv2Required(BaseResourceCheck):
    """Checks that IMDSv2 is required on EC2 instances"""

    def __init__(self):
        name = "EC2 instance requires IMDSv2"
        id = "CKV_CUSTOM_3"
        supported_resources = ["aws_instance", "aws_launch_template"]
        categories = [CheckCategories.GENERAL_SECURITY]
        super().__init__(name=name, id=id, categories=categories,
                        supported_resources=supported_resources)

    def scan_resource_conf(self, conf):
        metadata_options = conf.get("metadata_options", [{}])
        if isinstance(metadata_options, list):
            metadata_options = metadata_options[0] if metadata_options else {}

        http_tokens = metadata_options.get("http_tokens", ["optional"])
        if isinstance(http_tokens, list):
            http_tokens = http_tokens[0]

        if http_tokens == "required":
            return CheckResult.PASSED
        return CheckResult.FAILED

check = EC2IMDSv2Required()
```

### Checkov Graph-Based Policy (YAML)

```yaml
# custom_checks/graph/s3_has_encryption_and_logging.yaml
---
metadata:
  id: "CKV_GRAPH_1"
  name: "S3 bucket has both encryption and logging configured"
  category: "ENCRYPTION"
  severity: "HIGH"
definition:
  and:
    - resource_types:
        - aws_s3_bucket
      connected_resource_types:
        - aws_s3_bucket_server_side_encryption_configuration
      operator: exists
    - resource_types:
        - aws_s3_bucket
      connected_resource_types:
        - aws_s3_bucket_logging
      operator: exists
```

### Checkov Inline Suppression

```hcl
# Checkov inline suppression (HCL comment)
resource "aws_s3_bucket" "public_website" {
  bucket = "my-public-website"
  #checkov:skip=CKV_AWS_18: "Intentionally public - static website hosting"
  #checkov:skip=CKV_AWS_19: "Public website does not require encryption"
}

# Suppress multiple checks simultaneously
resource "aws_instance" "bastion" {
  #checkov:skip=CKV_AWS_88: "Bastion host requires public IP"
  #checkov:skip=CKV_AWS_135: "EBS optimization not needed for t3.micro"
  ami                         = "ami-xxx"
  instance_type               = "t3.micro"
  associate_public_ip_address = true
}
```

### .checkov.yaml Configuration File

```yaml
# .checkov.yaml
---
# Global settings
compact: true
directory:
  - "terraform/"
  - "k8s/"
framework:
  - terraform
  - kubernetes
  - dockerfile

# Checks to exclude
skip-check:
  - CKV_AWS_999  # Exception based on organizational policy

# Paths to exclude
skip-path:
  - "terraform/modules/legacy/"
  - "terraform/sandbox/"

# Custom checks
external-checks-dir:
  - "custom_checks/"

# Output format
output:
  - cli
  - sarif

# Soft fail (does not stop CI)
soft-fail: false

# Checks subject to soft fail
soft-fail-on:
  - CKV_AWS_18  # Temporarily allowed

# Checks subject to hard fail
hard-fail-on:
  - CKV_AWS_145  # S3 encryption is absolutely mandatory
  - CKV_AWS_19   # S3 encryption (legacy rule)
```

---

## 4. KICS and Trivy (Additional Static Analysis Tools)

### KICS (Keeping Infrastructure as Code Secure)

```bash
# Run with Docker
docker run -v $(pwd):/path checkmarx/kics:latest scan \
  --path /path \
  --output-path /path/results \
  --type Terraform,Kubernetes,Dockerfile

# Report formats
docker run -v $(pwd):/path checkmarx/kics:latest scan \
  --path /path \
  --report-formats "sarif,json,html" \
  --output-path /path/results
```

### Trivy (Unified Security Scanner)

```bash
# IaC scan (successor to tfsec)
trivy config .

# Specific framework
trivy config --tf-vars production.tfvars .

# Only specific severity levels
trivy config --severity HIGH,CRITICAL .

# JSON output
trivy config --format json --output results.json .

# Rego custom policies
trivy config --policy ./policies --namespaces custom .

# Container image scan (IaC + vulnerability integrated)
trivy image myapp:latest

# Filesystem scan (IaC + secrets + vulnerabilities)
trivy fs --scanners vuln,secret,misconfig .
```

### Tool Selection Guide

```
┌─────────────────── Tool Selection Flowchart ─────────────────┐
│                                                               │
│  Q: Which framework are you using?                           │
│                                                               │
│  Terraform only                                              │
│  └→ tfsec / trivy config (fast and simple)                   │
│                                                               │
│  Terraform + Kubernetes + Dockerfile                         │
│  └→ Checkov (multi-framework support + graph analysis)       │
│                                                               │
│  Many frameworks + emphasis on custom policies               │
│  └→ KICS (broad framework support)                           │
│                                                               │
│  Unified security (IaC + containers + SCA)                   │
│  └→ Trivy (Aqua Security unified platform)                   │
│                                                               │
│  Enterprise (using Terraform Cloud/Enterprise)               │
│  └→ Sentinel (HashiCorp native policy engine)                │
│                                                               │
│  Recommended: Use multiple tools together                    │
│  └→ tfsec(local) + Checkov(CI) + OPA(policy gate)           │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 5. CI/CD Integration

### Integrated Pipeline with GitHub Actions

```yaml
# .github/workflows/iac-security.yaml
name: IaC Security
on:
  pull_request:
    paths: ['terraform/**', 'k8s/**', 'Dockerfile*']

jobs:
  iac-scan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
      pull-requests: write

    steps:
      - uses: actions/checkout@v4

      # --- tfsec ---
      - name: tfsec
        uses: aquasecurity/tfsec-action@v1.0.0
        with:
          working_directory: terraform/
          soft_fail: false
          format: sarif
          sarif_file: tfsec.sarif

      # --- Checkov ---
      - name: Checkov
        uses: bridgecrewio/checkov-action@master
        with:
          directory: terraform/
          framework: terraform
          output_format: sarif
          output_file_path: checkov.sarif
          soft_fail: false
          skip_check: CKV_AWS_999

      # --- KICS ---
      - name: KICS Scan
        uses: Checkmarx/kics-github-action@v2.1.0
        with:
          path: 'terraform/,k8s/'
          output_path: kics-results/
          output_formats: 'sarif,json'
          fail_on: high

      # --- Trivy ---
      - name: Trivy Config Scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'config'
          scan-ref: 'terraform/'
          format: 'sarif'
          output: 'trivy.sarif'
          severity: 'HIGH,CRITICAL'

      # --- SARIF Upload ---
      - name: Upload tfsec SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: tfsec.sarif
          category: tfsec

      - name: Upload Checkov SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: checkov.sarif
          category: checkov

      # --- PR Comment ---
      - name: Post Results to PR
        if: always() && github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            // Read results from each tool and comment on PR
            const body = `## IaC Security Scan Results
            - tfsec: ✅ / ❌
            - Checkov: ✅ / ❌
            - KICS: ✅ / ❌
            - Trivy: ✅ / ❌`;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });
```

### Integration with GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - validate
  - security-scan
  - plan
  - apply

tfsec:
  stage: security-scan
  image: aquasec/tfsec:latest
  script:
    - tfsec terraform/ --minimum-severity HIGH --format json --out tfsec.json
  artifacts:
    reports:
      sast: tfsec.json
    when: always

checkov:
  stage: security-scan
  image: bridgecrew/checkov:latest
  script:
    - checkov -d terraform/ --framework terraform -o junitxml > checkov.xml
  artifacts:
    reports:
      junit: checkov.xml
    when: always

terraform-plan:
  stage: plan
  needs: ['tfsec', 'checkov']
  script:
    - terraform init
    - terraform plan -out=tfplan
    - terraform show -json tfplan > tfplan.json
    - conftest test tfplan.json --policy policy/
```

### Pre-commit Hook Configuration

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/antonbabenko/pre-commit-terraform
    rev: v1.86.0
    hooks:
      - id: terraform_fmt
      - id: terraform_validate
      - id: terraform_tflint
        args:
          - '--args=--config=__GIT_WORKING_DIR__/.tflint.hcl'
      - id: terraform_tfsec
        args:
          - '--args=--minimum-severity HIGH'
      - id: terraform_checkov
        args:
          - '--args=--compact --quiet'

  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks

  - repo: https://github.com/awslabs/git-secrets
    rev: master
    hooks:
      - id: git-secrets
```

---

## 6. Policy as Code (OPA / Sentinel)

### OPA (Open Policy Agent) + Rego

OPA is a CNCF graduated project and is widely adopted as a general-purpose policy engine. Rego is OPA's policy description language that allows you to define policies declaratively.

#### Basic Rego Syntax

```rego
# Rego basic syntax
package terraform.rules

# Imports
import input
import future.keywords.in
import future.keywords.if
import future.keywords.contains

# Helper function
is_aws_resource(type) if startswith(type, "aws_")

# Constant definition
allowed_regions := {"ap-northeast-1", "us-east-1", "eu-west-1"}

# deny rule: triggers a policy violation when condition is met
deny contains msg if {
    some resource_type, name
    resource := input.resource[resource_type][name]
    is_aws_resource(resource_type)
    not has_required_tags(resource)
    msg := sprintf(
        "%s.%s: Required tags (Environment, Team, CostCenter) are missing",
        [resource_type, name]
    )
}

# Helper: check for required tags
has_required_tags(resource) if {
    required := {"Environment", "Team", "CostCenter"}
    tags := object.keys(resource.tags)
    missing := required - {tag | some tag in tags}
    count(missing) == 0
}
```

#### S3 Security Policy

```rego
# policy/terraform/s3.rego
package terraform.s3

import future.keywords.in
import future.keywords.if
import future.keywords.contains

# Require S3 bucket encryption
deny contains msg if {
    some name
    resource := input.resource.aws_s3_bucket[name]
    not has_encryption(name)
    msg := sprintf("S3 bucket '%s' must have server-side encryption enabled", [name])
}

has_encryption(bucket_name) if {
    some config_name
    config := input.resource.aws_s3_bucket_server_side_encryption_configuration[config_name]
    config.bucket == bucket_name
}

# Require public access block
deny contains msg if {
    some name
    resource := input.resource.aws_s3_bucket[name]
    not has_public_access_block(name)
    msg := sprintf("S3 bucket '%s' must have public access block", [name])
}

has_public_access_block(bucket_name) if {
    some block_name
    block := input.resource.aws_s3_bucket_public_access_block[block_name]
    block.bucket == bucket_name
    block.block_public_acls == true
    block.block_public_policy == true
    block.ignore_public_acls == true
    block.restrict_public_buckets == true
}

# Require versioning
deny contains msg if {
    some name
    resource := input.resource.aws_s3_bucket[name]
    not has_versioning(name)
    msg := sprintf("S3 bucket '%s' must have versioning enabled", [name])
}

has_versioning(bucket_name) if {
    some ver_name
    ver := input.resource.aws_s3_bucket_versioning[ver_name]
    ver.bucket == bucket_name
    ver.versioning_configuration.status == "Enabled"
}

# Recommend KMS encryption (SSE-KMS instead of SSE-S3)
warn contains msg if {
    some config_name
    config := input.resource.aws_s3_bucket_server_side_encryption_configuration[config_name]
    rule := config.rule
    sse := rule.apply_server_side_encryption_by_default
    sse.sse_algorithm != "aws:kms"
    msg := sprintf(
        "S3 encryption config '%s': SSE-KMS is recommended over SSE-S3 for better key management",
        [config_name]
    )
}
```

#### IAM Security Policy

```rego
# policy/terraform/iam.rego
package terraform.iam

import future.keywords.in
import future.keywords.if
import future.keywords.contains

# Prohibit wildcard Actions
deny contains msg if {
    some name
    policy := input.resource.aws_iam_policy[name]
    statement := json.unmarshal(policy.policy).Statement[_]
    statement.Effect == "Allow"
    action := statement.Action
    action == "*"
    msg := sprintf("IAM policy '%s': Wildcard (*) actions are not allowed", [name])
}

# Prohibit wildcard Actions (inside arrays)
deny contains msg if {
    some name
    policy := input.resource.aws_iam_policy[name]
    statement := json.unmarshal(policy.policy).Statement[_]
    statement.Effect == "Allow"
    some action in statement.Action
    action == "*"
    msg := sprintf("IAM policy '%s': Wildcard (*) actions are not allowed", [name])
}

# Prohibit wildcard Resources
deny contains msg if {
    some name
    policy := input.resource.aws_iam_policy[name]
    statement := json.unmarshal(policy.policy).Statement[_]
    statement.Effect == "Allow"
    statement.Resource == "*"
    msg := sprintf("IAM policy '%s': Wildcard (*) resource is not allowed. Specify exact ARN.", [name])
}

# Prohibit direct attachment of administrator policy (AdministratorAccess)
deny contains msg if {
    some name
    attachment := input.resource.aws_iam_policy_attachment[name]
    contains(attachment.policy_arn, "AdministratorAccess")
    msg := sprintf("IAM policy attachment '%s': AdministratorAccess should not be directly attached", [name])
}

# Warn about use of inline policies
warn contains msg if {
    some name
    policy := input.resource.aws_iam_role_policy[name]
    msg := sprintf("IAM role policy '%s': Prefer managed policies over inline policies for better reusability", [name])
}
```

#### Network Security Policy

```rego
# policy/terraform/network.rego
package terraform.network

import future.keywords.in
import future.keywords.if
import future.keywords.contains

# Prohibit SSH open to the world
deny contains msg if {
    some name
    rule := input.resource.aws_security_group_rule[name]
    rule.type == "ingress"
    rule.from_port <= 22
    rule.to_port >= 22
    some cidr in rule.cidr_blocks
    cidr == "0.0.0.0/0"
    msg := sprintf("Security group rule '%s': SSH (port 22) must not be open to 0.0.0.0/0", [name])
}

# Prohibit RDP open to the world
deny contains msg if {
    some name
    rule := input.resource.aws_security_group_rule[name]
    rule.type == "ingress"
    rule.from_port <= 3389
    rule.to_port >= 3389
    some cidr in rule.cidr_blocks
    cidr == "0.0.0.0/0"
    msg := sprintf("Security group rule '%s': RDP (port 3389) must not be open to 0.0.0.0/0", [name])
}

# Prohibit database ports open to the world
db_ports := {3306, 5432, 1433, 27017, 6379}

deny contains msg if {
    some name
    rule := input.resource.aws_security_group_rule[name]
    rule.type == "ingress"
    some port in db_ports
    rule.from_port <= port
    rule.to_port >= port
    some cidr in rule.cidr_blocks
    cidr == "0.0.0.0/0"
    msg := sprintf("Security group rule '%s': Database port %d must not be open to the internet", [name, port])
}
```

### Testing OPA Policies with Conftest

```bash
# Convert Terraform plan to JSON
terraform plan -out=tfplan
terraform show -json tfplan > tfplan.json

# Test with OPA policies
conftest test tfplan.json --policy policy/

# Example output:
# FAIL - tfplan.json - terraform.s3 - S3 bucket 'data' must have encryption
# FAIL - tfplan.json - terraform.iam - IAM policy 'admin': Wildcard (*) actions not allowed
# WARN - tfplan.json - terraform.iam - Prefer managed policies over inline policies
# 5 tests, 2 passed, 1 warnings, 2 failures

# Test only a specific namespace
conftest test tfplan.json --policy policy/ --namespace terraform.s3

# JSON output
conftest test tfplan.json --policy policy/ --output json

# Unit test for policies
conftest verify --policy policy/
```

### Unit Tests for OPA Policies

```rego
# policy/tests/s3_test.rego
package terraform.s3

# Test data: no encryption → deny
test_deny_s3_without_encryption {
    deny with input as {
        "resource": {
            "aws_s3_bucket": {
                "test_bucket": {
                    "bucket": "test-bucket"
                }
            }
        }
    }
}

# Test data: with encryption → no deny
test_allow_s3_with_encryption {
    count(deny) == 0 with input as {
        "resource": {
            "aws_s3_bucket": {
                "test_bucket": {
                    "bucket": "test-bucket"
                }
            },
            "aws_s3_bucket_server_side_encryption_configuration": {
                "test_config": {
                    "bucket": "test_bucket",
                    "rule": {
                        "apply_server_side_encryption_by_default": {
                            "sse_algorithm": "aws:kms"
                        }
                    }
                }
            },
            "aws_s3_bucket_public_access_block": {
                "test_block": {
                    "bucket": "test_bucket",
                    "block_public_acls": true,
                    "block_public_policy": true,
                    "ignore_public_acls": true,
                    "restrict_public_buckets": true
                }
            },
            "aws_s3_bucket_versioning": {
                "test_ver": {
                    "bucket": "test_bucket",
                    "versioning_configuration": {
                        "status": "Enabled"
                    }
                }
            }
        }
    }
}
```

```bash
# Run policy tests
opa test policy/ -v
# policy/tests/s3_test.rego:
# data.terraform.s3.test_deny_s3_without_encryption: PASS
# data.terraform.s3.test_allow_s3_with_encryption: PASS
```

### HashiCorp Sentinel (Terraform Cloud/Enterprise)

```python
# sentinel/s3-encryption.sentinel
import "tfplan/v2" as tfplan

# S3 bucket encryption rule
s3_buckets = filter tfplan.resource_changes as _, rc {
    rc.type is "aws_s3_bucket" and
    rc.mode is "managed" and
    (rc.change.actions contains "create" or rc.change.actions contains "update")
}

# Validate that all S3 buckets have encryption configured
encryption_required = rule {
    all s3_buckets as _, bucket {
        bucket.change.after is not null
    }
}

# Main rule
main = rule {
    encryption_required
}
```

### Policy Repository Structure

```
policy/
  ├── terraform/
  │   ├── s3.rego           # S3 policies
  │   ├── iam.rego          # IAM policies
  │   ├── network.rego      # Network policies
  │   ├── encryption.rego   # Encryption policies
  │   ├── tagging.rego      # Tagging policies
  │   └── compliance.rego   # Compliance policies
  ├── kubernetes/
  │   ├── pod_security.rego
  │   ├── network_policy.rego
  │   └── rbac.rego
  ├── dockerfile/
  │   ├── base_image.rego
  │   └── user.rego
  ├── tests/
  │   ├── s3_test.rego      # Policy unit tests
  │   ├── iam_test.rego
  │   └── network_test.rego
  ├── lib/
  │   └── helpers.rego      # Shared helper functions
  └── README.md
```

---

## 7. Secret Management and IaC

### Preventing Secret Leakage in IaC Code

```
┌──────────── Secret Leakage Pathways ─────────────┐
│                                                   │
│  1. Hardcoding                                    │
│     ├── Written directly in .tf files             │
│     ├── Written in plaintext in terraform.tfvars  │
│     └── Written in variable default values        │
│                                                   │
│  2. State Files                                   │
│     ├── Stored in plaintext in terraform.tfstate  │
│     ├── Values included in plan files             │
│     └── sensitive not set on output variables     │
│                                                   │
│  3. Git History                                   │
│     ├── Secrets remain in past commits            │
│     ├── Insufficient .gitignore entries           │
│     └── History remains even after branch deletion│
│                                                   │
│  4. CI/CD Logs                                    │
│     ├── Values displayed in terraform plan output │
│     ├── Debug output of environment variables     │
│     └── Values included in error messages        │
│                                                   │
└───────────────────────────────────────────────────┘
```

### Secret Detection Tools

```bash
# gitleaks: Secret scan for Git repositories
gitleaks detect --source . --report-format json --report-path gitleaks-report.json

# git-secrets: Specialized for AWS credentials
git secrets --scan

# trufflehog: Entropy-based detection
trufflehog filesystem --directory . --json

# Trivy secret scan
trivy fs --scanners secret .
```

### Terraform Secret Management Best Practices

```hcl
# NG: Hardcoded secrets
resource "aws_db_instance" "main" {
  username = "admin"
  password = "SuperSecret123!"  # Never do this
}

# OK: Retrieve from Secrets Manager
data "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = "myapp/db/credentials"
}

locals {
  db_creds = jsondecode(data.aws_secretsmanager_secret_version.db_credentials.secret_string)
}

resource "aws_db_instance" "main" {
  username = local.db_creds.username
  password = local.db_creds.password
}

# OK: Variables + CI/CD environment variables
variable "db_password" {
  type      = string
  sensitive = true  # Hidden in plan output
}

resource "aws_db_instance" "main" {
  username = "admin"
  password = var.db_password  # From TF_VAR_db_password environment variable
}

# Mark output as sensitive
output "db_endpoint" {
  value     = aws_db_instance.main.endpoint
  sensitive = false  # Endpoint can be made public
}

output "db_password" {
  value     = aws_db_instance.main.password
  sensitive = true  # Secrets are hidden
}
```

---

## 8. Drift Detection

### What Is Drift?

Drift refers to the discrepancy that arises between the IaC code (desired state) and the actual infrastructure (current state). Drift occurs due to manual changes, changes made by other tools, or external factors.

```
IaC Code (Desired State)         Actual Infrastructure (Current State)
+-----------------------+         +-----------------------+
| SG: allow port 443    |         | SG: port 443 + 22     |
|                       |  !=     |  (SSH added manually) |
| Encryption: Enabled   |         | Encryption: Enabled   |
| Tag: Env=production   |         | Tag: Env=prod (changed)|
+-----------------------+         +-----------------------+
                                       ↑
                                   Drift (discrepancy)

Causes:
  1. Manual changes from the console
  2. Direct API operations by other teams
  3. Automatic AWS updates (security patches, etc.)
  4. Changes made by other IaC code
  5. Emergency changes during incident response
```

### Drift Detection Methods

```bash
# Drift detection with Terraform
terraform plan -detailed-exitcode
# Exit code 0 = no changes
# Exit code 1 = error
# Exit code 2 = drift detected

# Periodic execution script
#!/bin/bash
terraform init -backend=true
terraform plan -detailed-exitcode -out=drift-check.plan 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -eq 2 ]; then
    echo "DRIFT DETECTED!"
    terraform show -json drift-check.plan > drift-report.json
    # Slack notification, etc.
fi

# Drift detection with AWS Config (CloudFormation)
aws cloudformation detect-stack-drift --stack-name my-stack
aws cloudformation describe-stack-drift-detection-status \
    --stack-drift-detection-id <detection-id>

# driftctl (dedicated tool - deprecated, successor is snyk)
driftctl scan --from tfstate://terraform.tfstate

# Terraform Cloud/Enterprise
# Drift detection runs automatically (Health Assessment)
```

### Drift Remediation Strategies

```
┌─────────────── Drift Remediation Strategies ─────────────────┐
│                                                               │
│  Strategy 1: Align to Code (Recommended)                     │
│  ├── Use terraform apply to revert to IaC code state         │
│  ├── Completely roll back manual changes                     │
│  └── IaC serves as Single Source of Truth                   │
│                                                               │
│  Strategy 2: Align Code to Reality                           │
│  ├── Import with terraform import                            │
│  ├── Update .tf files to match current state                 │
│  └── When there is a valid reason for the change            │
│                                                               │
│  Strategy 3: Selective Remediation                           │
│  ├── Security-related drift: immediate remediation           │
│  ├── Non-security drift: address in a planned manner         │
│  └── Use -target option to apply per resource               │
│                                                               │
│  Recommended Approach:                                        │
│  ├── Production environment: policy prohibiting manual changes│
│  ├── Run drift detection periodically in CI/CD               │
│  └── Auto-remediate security drift                          │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 9. Terraform Module Security

### Supply Chain Risks

```
┌──────── Terraform Module Supply Chain ────────┐
│                                               │
│  Risk 1: Malicious Modules                   │
│  ├── Modules from unofficial registries       │
│  ├── Appear normal but contain backdoors      │
│  └── Extra IAM role creation, data exfil, etc.│
│                                               │
│  Risk 2: Forgetting to Pin Versions          │
│  ├── source = "terraform-aws-modules/vpc/aws" │
│  ├── No version specified → auto-fetch latest │
│  └── Risk of breaking changes or security    │
│      degradation                             │
│                                               │
│  Risk 3: Tampered Provider Plugins           │
│  ├── Fetched from unofficial mirrors          │
│  ├── Checksums not verified                  │
│  └── .terraform.lock.hcl not managed         │
│                                               │
│  Countermeasures:                             │
│  ├── Use only official registry modules      │
│  ├── Always specify version constraints      │
│  ├── Include .terraform.lock.hcl in VCS      │
│  ├── Code review of modules                  │
│  └── Operate a private registry             │
│                                               │
└───────────────────────────────────────────────┘
```

### Secure Module Usage

```hcl
# NG: No version pinning
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  # No version specified → dangerous
}

# OK: Pinned version + constraint
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"  # Latest within the 5.x range
}

# OK: Strict pinning
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.4.0"  # Fully fixed
}

# OK: Private registry
module "vpc" {
  source  = "app.terraform.io/myorg/vpc/aws"
  version = "2.1.0"
}

# OK: Git repository (pinned tag)
module "vpc" {
  source = "git::https://github.com/myorg/terraform-modules.git//vpc?ref=v2.1.0"
}
```

### Managing .terraform.lock.hcl

```hcl
# .terraform.lock.hcl should be included in version control
# → Pins provider versions and hashes

provider "registry.terraform.io/hashicorp/aws" {
  version     = "5.31.0"
  constraints = "~> 5.0"
  hashes = [
    "h1:XXXXXXXXXXXXXXXXXXXXXXXXXX=",
    "zh:XXXXXXXXXXXXXXXXXXXXXXXXXX",
  ]
}
```

```bash
# Update the lock file
terraform init -upgrade

# Pin platforms (specify CI/CD environments)
terraform providers lock \
  -platform=linux_amd64 \
  -platform=darwin_amd64 \
  -platform=darwin_arm64
```

---

## 10. Anti-Patterns

### Anti-Pattern 1: Insecure Terraform State File Management

```hcl
# NG: State stored locally (no encryption, not shareable)
terraform {
  backend "local" {}
}

# NG: S3 backend but no encryption or locking
terraform {
  backend "s3" {
    bucket = "my-terraform-state"
    key    = "terraform.tfstate"
    region = "ap-northeast-1"
    # encrypt not specified → not encrypted
    # dynamodb_table not specified → no locking
  }
}

# OK: Remote state + encryption + locking + access restrictions
terraform {
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "ap-northeast-1"
    encrypt        = true
    kms_key_id     = "arn:aws:kms:ap-northeast-1:123456:key/xxx"
    dynamodb_table = "terraform-state-lock"

    # Restrict access to state bucket
    # (Allow only specific IAM roles via bucket policy)
  }
}
```

**Impact**: State files may contain sensitive information (passwords, API keys, etc.). When stored in plaintext on S3, anyone with access to the bucket can view the secrets. Without locking, concurrent execution can corrupt the infrastructure.

### Anti-Pattern 2: Not Integrating IaC Scans into CI/CD

```
NG: Developer runs scans only locally
  → Easily forgotten or results ignored
  → Reviewers miss security issues
  → Code with problems is deployed to production

OK: Enforce scans in CI/CD and block merges on failure
  → Include tfsec/Checkov pass as a PR merge requirement
  → Set as required status check in Branch Protection Rules
  → Aggregate results as SARIF in the GitHub Security tab
  → Notify results via Slack/Teams
```

### Anti-Pattern 3: Unmanaged Exceptions

```
NG: Adding suppression comments in large quantities without justification
  #tfsec:ignore:aws-s3-enable-bucket-encryption
  #checkov:skip=CKV_AWS_19

  → Security checks become a formality
  → Issues that should be fixed are left unaddressed

OK: Establish an exception management process
  → Always add a justification comment with suppressions
  → Set an expiry date (:exp:2024-12-31)
  → Regularly review suppressions and remove unnecessary exceptions
  → Monitor the number of exceptions as a metric
```

### Anti-Pattern 4: Parallel Management of IaC and Console

```
NG: Some resources managed by IaC, others by console
  → Drift becomes the norm
  → It becomes unclear which is correct
  → Rollback during incidents becomes difficult

OK: Treat IaC as the Single Source of Truth
  → Manage all resources with IaC
  → Console operations are read-only (ReadOnlyAccess)
  → Emergency console changes are later reflected in IaC
  → Import existing resources with terraform import
```

---

## 11. Exercises

### Exercise 1: Vulnerability Detection and Remediation with tfsec / Checkov

Identify all security issues in the following Terraform code and fix them.

```hcl
# Exercise code (contains issues)
provider "aws" {
  region     = "ap-northeast-1"
  access_key = "AKIA..."       # Issue 1
  secret_key = "wJal..."       # Issue 2
}

resource "aws_s3_bucket" "data" {
  bucket = "company-data"
  acl    = "public-read"       # Issue 3
}

resource "aws_instance" "web" {
  ami           = "ami-xxx"
  instance_type = "t3.micro"
  # Issue 4: metadata_options not set (IMDSv1 is the default)
  # Issue 5: vpc_security_group_ids not set
  # Issue 6: monitoring not enabled
}

resource "aws_security_group" "web" {
  name = "web-sg"

  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # Issue 7
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]  # Issue 8 (OK if intentional)
  }
}

resource "aws_db_instance" "main" {
  engine            = "mysql"
  instance_class    = "db.t3.medium"
  username          = "admin"
  password          = "password123"   # Issue 9
  publicly_accessible = true          # Issue 10
  # Issue 11: storage_encrypted not set
  # Issue 12: backup_retention_period not set
}
```

**Goal**: Fix all 12 issues and achieve zero errors with tfsec / Checkov.

### Exercise 2: Creating OPA Policies

Create OPA policies in Rego that satisfy the following requirements.

1. All EC2 instances must have `Environment`, `Team`, and `CostCenter` tags
2. RDS instances must have `publicly_accessible = false`
3. S3 bucket names must start with `{env}-{team}-` (env must be one of prod/stg/dev)
4. Inbound rules in Security Groups must not expose port 22 to 0.0.0.0/0
5. Write unit tests for each rule

### Exercise 3: Building a CI/CD Pipeline

Create a GitHub Actions workflow that satisfies the following requirements.

1. Run tfsec, Checkov, and gitleaks when a PR is created
2. Upload results from all tools to the GitHub Security tab as SARIF
3. Block PR merges when CRITICAL/HIGH findings are detected
4. Post a summary of results as a PR comment
5. Run Conftest policy checks against terraform plan output

---

## 12. FAQ

### Q1. Which should I use: tfsec or Checkov?

If you are only using Terraform, tfsec (now integrated into Trivy) is fast and simple. If you manage Terraform as well as Kubernetes, Dockerfile, and CloudFormation, Checkov's multi-framework support has an advantage. Using both together reduces the chance of missed detections. In enterprise environments, Checkov's SCA capabilities and graph-based analysis provide additional value.

### Q2. How should OPA policies be managed?

Manage policies in a dedicated Git repository and automate testing with CI/CD. Apply a review process to policy changes as well. Write unit tests for policies using OPA's test framework (`opa test`) to prevent unintended allows or denials. Version your policies and follow a staged rollout approach (warn → deny).

### Q3. What security considerations apply when converting existing infrastructure to IaC?

After importing existing resources into IaC with `terraform import`, immediately scan with tfsec/Checkov. If many security issues are found, prioritize and fix them incrementally. Enable drift detection to detect manual changes made outside of IaC. Since state files may contain secrets during import, confirm that backend encryption is enabled.

### Q4. What should I do when IaC scans produce a large number of false positives?

First, analyze the pattern of false positives. If a specific rule consistently produces false positives, exclude it in `.checkov.yaml` or tfsec configuration. Suppress legitimate exceptions with inline comments explaining the reason. For organization-specific requirements, disable the built-in rule and replace it with a custom policy. Track the false positive rate as a metric and periodically review the rule set.

### Q5. Should I use Terraform Cloud/Enterprise's Sentinel or OPA?

If you are using Terraform Cloud/Enterprise, Sentinel is the natural choice (it can access the terraform plan context directly). In multi-tool environments (Terraform + Kubernetes + CI/CD pipelines), OPA functions as a versatile and unified policy engine. OPA is a CNCF graduated project with a broad ecosystem.

### Q6. How do I assess the maturity of IaC security?

Evaluate using the following levels. Level 1: Ad-hoc scans run locally. Level 2: Scans integrated into CI/CD. Level 3: Policy as Code gates. Level 4: Drift detection and auto-remediation. Level 5: All resources managed by IaC + continuous compliance monitoring. Start by aiming for Level 2 and progressively increase maturity.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying how it works.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping straight to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving to the next step.

### Q3: How is this applied in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|------------|
| IaC Risks | Misconfigurations remain in code and are deployed at scale |
| tfsec / Trivy | Fast Terraform-specific scanner. Now integrated into Trivy |
| Checkov | Comprehensive multi-framework scanner. Graph-based analysis is a strength |
| KICS | Broad framework coverage scanner provided by Checkmarx |
| OPA/Rego | Define and automatically enforce custom policies. CNCF graduated project |
| Sentinel | Policy engine dedicated to Terraform Cloud/Enterprise |
| CI/CD Integration | Make scan pass a mandatory PR merge requirement. Aggregate results with SARIF |
| Drift Detection | Continuously detect discrepancies between IaC and actual infrastructure. Periodic execution recommended |
| State Management | Manage securely with remote + encryption + locking |
| Secrets | Do not hardcode in IaC code. Use Secrets Manager |
| Modules | Pin versions, use official registry, manage lock file |

---

## Further Reading

- [AWS Security](./01-aws-security.md) — AWS security services configured with IaC
- [Cloud Security Basics](./00-cloud-security-basics.md) — IAM and encryption fundamentals
- [Container Security](../04-application-security/02-container-security.md) — Security for Kubernetes manifests

---

## References

1. **Checkov Documentation** — https://www.checkov.io/
2. **tfsec Documentation** — https://aquasecurity.github.io/tfsec/
3. **Trivy Documentation** — https://aquasecurity.github.io/trivy/
4. **Open Policy Agent (OPA) Documentation** — https://www.openpolicyagent.org/docs/latest/
5. **Rego Policy Language** — https://www.openpolicyagent.org/docs/latest/policy-language/
6. **HashiCorp Sentinel Documentation** — https://developer.hashicorp.com/sentinel/docs
7. **KICS Documentation** — https://docs.kics.io/
8. **Conftest** — https://www.conftest.dev/
9. **OWASP IaC Security** — https://owasp.org/www-project-devsecops-guideline/latest/02d-Infrastructure-as-Code
10. **CIS Benchmarks for Terraform** — https://www.cisecurity.org/benchmark/terraform

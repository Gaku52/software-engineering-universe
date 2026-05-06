# Amazon ECR (Elastic Container Registry)

> A systematic guide to Amazon ECR for storing and managing container images, covering repository creation, image push/pull, lifecycle policies, and image scanning.

---

## What You Will Learn

1. **ECR Repository Creation and Management** -- Understand the basics of creating private/public repositories and access control
2. **Building, Pushing, and Pulling Images** -- Master image operations with the Docker CLI and ECR authentication mechanisms
3. **Lifecycle Policies and Image Scanning** -- Manage security and operational costs through automatic deletion of unused images and vulnerability scanning
4. **Cross-Region/Cross-Account Replication** -- Learn image distribution strategies for multi-region and multi-account environments
5. **CI/CD Pipeline Integration** -- Master practical techniques for integrating ECR into build pipelines
6. **Security Best Practices** -- Implement image signing, non-root user execution, and automated vulnerability remediation


## Prerequisites

The following knowledge will help you understand this guide:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [Amazon ECS Basics](./00-ecs-basics.md)

---

## 1. ECR Overview

### 1.1 ECR Architecture

```
Developer / CI/CD
    |
    | docker push / pull
    v
+--------------------------------+
| Amazon ECR                     |
| +----------------------------+ |
| | Private Repository          | |
| | +--------+ +--------+     | |
| | | my-app | | my-api |     | |
| | | :v1.0  | | :v2.1  |     | |
| | | :v1.1  | | :latest|     | |
| | +--------+ +--------+     | |
| +----------------------------+ |
| +----------------------------+ |
| | Public Repository           | |
| | (ECR Public Gallery)       | |
| +----------------------------+ |
+--------------------------------+
    |               |
    v               v
+----------+  +----------+
| ECS      |  | EKS      |
| Fargate  |  | Nodes    |
+----------+  +----------+
```

### 1.2 ECR Features

| Feature | Description |
|---------|-------------|
| Fully Managed | No infrastructure management required, high availability |
| Encryption | Encryption at rest (AES-256 or KMS) |
| IAM Integration | Fine-grained access control |
| Image Scanning | Automatic vulnerability detection |
| Replication | Cross-region/cross-account |
| Image Signing | Content trust verification |
| Lifecycle Policies | Automatic deletion of unused images |
| OCI Compatible | Supports storing OCI artifacts (Helm charts, etc.) |

### 1.3 ECR Pricing

```
ECR Pricing Structure:

1. Storage:
   $0.10/GB/month (private repositories)

2. Data Transfer:
   - Within the same region: Free
   - Between regions: Standard data transfer rates
   - To the internet: Standard data transfer rates

3. Pull-Through Cache:
   - First pull from Docker Hub, etc.: Data transfer fees apply
   - Pull from cache: Free

Cost Estimate Example:
  Image size: 500 MB x 20 versions = 10 GB
  Monthly cost: 10 GB x $0.10 = $1.00/month

  Using lifecycle policies to limit the number of retained images
  can significantly reduce storage costs.
```

---

## 2. Creating Repositories

### 2.1 Creating a Repository with the AWS CLI

```bash
# Create a private repository
aws ecr create-repository \
  --repository-name my-app \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256 \
  --image-tag-mutability IMMUTABLE

# Example output:
# {
#   "repository": {
#     "repositoryArn": "arn:aws:ecr:ap-northeast-1:123456789012:repository/my-app",
#     "repositoryUri": "123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/my-app",
#     "repositoryName": "my-app"
#   }
# }

# Create a repository with KMS encryption
aws ecr create-repository \
  --repository-name my-secure-app \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration '{
    "encryptionType": "KMS",
    "kmsKey": "arn:aws:kms:ap-northeast-1:123456789012:key/12345678-1234-1234-1234-123456789012"
  }' \
  --image-tag-mutability IMMUTABLE

# Create namespaced repositories (reflecting organizational structure)
aws ecr create-repository --repository-name team-a/frontend
aws ecr create-repository --repository-name team-a/backend
aws ecr create-repository --repository-name team-b/data-pipeline
aws ecr create-repository --repository-name shared/base-images

# List repositories
aws ecr describe-repositories \
  --query 'repositories[*].{Name: repositoryName, URI: repositoryUri, Scanning: imageScanningConfiguration.scanOnPush, TagMutability: imageTagMutability}'

# Delete a repository (--force is required if images exist)
aws ecr delete-repository \
  --repository-name my-old-app \
  --force
```

### 2.2 Tag Immutability

```
Tag Immutability Settings:

MUTABLE (default):
  push my-app:v1.0  -->  Save image A with tag v1.0
  push my-app:v1.0  -->  Overwrite v1.0 with image B ← Dangerous!

IMMUTABLE (recommended):
  push my-app:v1.0  -->  Save image A with tag v1.0
  push my-app:v1.0  -->  Error! Existing tags cannot be overwritten
  push my-app:v1.1  -->  Save image B with tag v1.1 ← OK
```

| Setting | MUTABLE | IMMUTABLE |
|---------|---------|-----------|
| Overwrite same tag | Allowed | Not allowed |
| Deployment reproducibility | Low | High |
| Audit trail | Difficult | Easy |
| Recommended environment | Development | Production |

```bash
# Change tag immutability setting
aws ecr put-image-tag-mutability \
  --repository-name my-app \
  --image-tag-mutability IMMUTABLE
```

### 2.3 Repository Policies (Cross-Account Access)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPullFromProdAccount",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::987654321098:root"
      },
      "Action": [
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:BatchCheckLayerAvailability"
      ]
    },
    {
      "Sid": "AllowPullFromSpecificRole",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::987654321098:role/ECSTaskExecutionRole"
      },
      "Action": [
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:BatchCheckLayerAvailability"
      ]
    },
    {
      "Sid": "AllowPushFromCICD",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::111222333444:role/CICDPipelineRole"
      },
      "Action": [
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:BatchCheckLayerAvailability",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ]
    }
  ]
}
```

```bash
# Apply a repository policy
aws ecr set-repository-policy \
  --repository-name my-app \
  --policy-text file://ecr-policy.json

# View the repository policy
aws ecr get-repository-policy \
  --repository-name my-app

# Delete the repository policy
aws ecr delete-repository-policy \
  --repository-name my-app
```

### 2.4 Registry-Level Policies

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPullFromOrganization",
      "Effect": "Allow",
      "Principal": "*",
      "Action": [
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:BatchCheckLayerAvailability"
      ],
      "Condition": {
        "StringEquals": {
          "aws:PrincipalOrgID": "o-1234567890"
        }
      }
    }
  ]
}
```

```bash
# Set the registry policy
aws ecr put-registry-policy \
  --policy-text file://registry-policy.json

# View the registry policy
aws ecr get-registry-policy
```

---

## 3. Building and Pushing Images

### 3.1 ECR Authentication and Push Workflow

```
Image Push Flow:

1. Obtain ECR authentication token
   aws ecr get-login-password
        |
        v
2. Docker login
   docker login --username AWS --password <token>
        |
        v
3. Build image
   docker build -t my-app:v1.0 .
        |
        v
4. Tag image
   docker tag my-app:v1.0 <ECR_URI>/my-app:v1.0
        |
        v
5. Push
   docker push <ECR_URI>/my-app:v1.0
        |
        v
6. Stored in ECR (encrypted, scanned)
```

### 3.2 Actual Commands

```bash
# Define variables
AWS_ACCOUNT_ID=123456789012
REGION=ap-northeast-1
REPO_NAME=my-app
IMAGE_TAG=v1.0.0
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

# 1. Log in to ECR
aws ecr get-login-password --region ${REGION} | \
  docker login --username AWS --password-stdin ${ECR_URI}

# 2. Build the image
docker build -t ${REPO_NAME}:${IMAGE_TAG} .

# 3. Tag for ECR
docker tag ${REPO_NAME}:${IMAGE_TAG} ${ECR_URI}/${REPO_NAME}:${IMAGE_TAG}

# 4. Push
docker push ${ECR_URI}/${REPO_NAME}:${IMAGE_TAG}

# 5. List images
aws ecr list-images --repository-name ${REPO_NAME}

# 6. View image details
aws ecr describe-images \
  --repository-name ${REPO_NAME} \
  --image-ids imageTag=${IMAGE_TAG} \
  --query 'imageDetails[0].{
    Digest: imageDigest,
    Tags: imageTags,
    Size: imageSizeInBytes,
    PushedAt: imagePushedAt,
    ScanStatus: imageScanStatus.status,
    ScanFindings: imageScanFindingsSummary
  }'

# 7. Delete an image
aws ecr batch-delete-image \
  --repository-name ${REPO_NAME} \
  --image-ids imageTag=v0.9.0

# 8. Multi-architecture build (amd64 + arm64)
docker buildx create --use
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ${ECR_URI}/${REPO_NAME}:${IMAGE_TAG} \
  --push .
```

### 3.3 Example Multi-Stage Build Dockerfile

```dockerfile
# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine AS production
WORKDIR /app

# Security: run as non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup
USER appuser

COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "dist/server.js"]
```

### 3.4 Lightweight Image for Go Applications

```dockerfile
# Ultra-lightweight image for Go applications
FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s" -o /app/server ./cmd/server

# Run with distroless image (ultra-lightweight, no shell)
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /app/server /server

USER nonroot:nonroot
EXPOSE 8080

ENTRYPOINT ["/server"]
```

### 3.5 Optimized Python Application

```dockerfile
# Optimized Dockerfile for Python applications
FROM python:3.12-slim AS builder

WORKDIR /app

# Use a virtual environment to isolate dependencies
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.12-slim

# Apply security patches
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd --create-home --shell /bin/bash appuser
USER appuser

WORKDIR /app

# Copy virtual environment from build stage
COPY --from=builder --chown=appuser:appuser /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY --chown=appuser:appuser . .

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "4", "app:app"]
```

### 3.6 .dockerignore Configuration

```
# .dockerignore
.git
.gitignore
.env
.env.local
.env.*.local
*.md
!README.md
docker-compose*.yml
Dockerfile*
.dockerignore
node_modules
__pycache__
*.pyc
.pytest_cache
.coverage
coverage/
dist/
build/
.vscode
.idea
*.log
tmp/
temp/
tests/
test/
docs/
```

---

## 4. Lifecycle Policies

### 4.1 How Policies Work

```
Lifecycle Policy Behavior:

Images in repository:
  v1.0  (30 days ago)  <-- Old images are automatically deleted
  v1.1  (20 days ago)  <-- Old images are automatically deleted
  v1.2  (10 days ago)
  v1.3  (5 days ago)
  v1.4  (2 days ago)
  v1.5  (today)        <-- Latest N images are retained

After policy is applied:
  v1.2  (10 days ago)  <-- Retained (latest 4)
  v1.3  (5 days ago)   <-- Retained
  v1.4  (2 days ago)   <-- Retained
  v1.5  (today)        <-- Retained

Policy evaluation order:
  1. Evaluate in ascending order of rulePriority
  2. Select images matching each rule's filter
  3. Mark images for expiration based on conditions
  4. Images matched by lower-priority rules are not evaluated by higher-priority rules
```

### 4.2 Lifecycle Policy Configuration

```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Delete untagged images after 7 days",
      "selection": {
        "tagStatus": "untagged",
        "countType": "sinceImagePushed",
        "countUnit": "days",
        "countNumber": 7
      },
      "action": {
        "type": "expire"
      }
    },
    {
      "rulePriority": 2,
      "description": "Retain last 5 dev-tagged images",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["dev-"],
        "countType": "imageCountMoreThan",
        "countNumber": 5
      },
      "action": {
        "type": "expire"
      }
    },
    {
      "rulePriority": 3,
      "description": "Retain last 10 stg-tagged images",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["stg-"],
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": {
        "type": "expire"
      }
    },
    {
      "rulePriority": 4,
      "description": "Retain last 100 release-tagged images",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["v", "release-"],
        "countType": "imageCountMoreThan",
        "countNumber": 100
      },
      "action": {
        "type": "expire"
      }
    },
    {
      "rulePriority": 5,
      "description": "Delete other tagged images after 90 days",
      "selection": {
        "tagStatus": "any",
        "countType": "sinceImagePushed",
        "countUnit": "days",
        "countNumber": 90
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}
```

```bash
# Apply a lifecycle policy
aws ecr put-lifecycle-policy \
  --repository-name my-app \
  --lifecycle-policy-text file://lifecycle-policy.json

# View the policy
aws ecr get-lifecycle-policy \
  --repository-name my-app

# Preview the policy (dry run)
aws ecr start-lifecycle-policy-preview \
  --repository-name my-app \
  --lifecycle-policy-text file://lifecycle-policy.json

# View preview results
aws ecr get-lifecycle-policy-preview \
  --repository-name my-app

# Delete the policy
aws ecr delete-lifecycle-policy \
  --repository-name my-app

# Script to apply to all repositories at once
REPOS=$(aws ecr describe-repositories --query 'repositories[*].repositoryName' --output text)
for REPO in $REPOS; do
  echo "Applying lifecycle policy to ${REPO}..."
  aws ecr put-lifecycle-policy \
    --repository-name "${REPO}" \
    --lifecycle-policy-text file://lifecycle-policy.json
done
```

---

## 5. Image Scanning

### 5.1 Types of Scanning

```
Scan Method Comparison:

Basic Scanning (free):
  On push --> Clair engine --> Detect CVEs in OS packages
  Manual execution supported

Enhanced Scanning (Amazon Inspector integration):
  On push --> Inspector --> OS packages + programming language
  Continuous scanning            package CVE detection
  (automatically re-scans when new CVEs are discovered)
```

| Feature | Basic Scanning | Enhanced Scanning |
|---------|---------------|------------------|
| Cost | Free | Amazon Inspector pricing |
| Scan target | OS packages | OS + language packages |
| Trigger | On push / manual | On push + continuous |
| New CVE response | Manual re-scan | Automatic re-scan |
| EventBridge integration | Yes | Yes |
| Supported languages | - | Java, Python, Node.js, Go, Ruby, .NET |
| SBOM generation | No | Yes |

### 5.2 Viewing Scan Results

```bash
# Enable basic scanning (per repository)
aws ecr put-image-scanning-configuration \
  --repository-name my-app \
  --image-scanning-configuration scanOnPush=true

# Enable enhanced scanning (per registry)
aws ecr put-registry-scanning-configuration \
  --scan-type ENHANCED \
  --rules '[
    {
      "repositoryFilters": [
        {
          "filter": "*",
          "filterType": "WILDCARD"
        }
      ],
      "scanFrequency": "CONTINUOUS_SCAN"
    }
  ]'

# Start a manual scan
aws ecr start-image-scan \
  --repository-name my-app \
  --image-id imageTag=v1.0.0

# View scan results
aws ecr describe-image-scan-findings \
  --repository-name my-app \
  --image-id imageTag=v1.0.0

# Filter by severity
aws ecr describe-image-scan-findings \
  --repository-name my-app \
  --image-id imageTag=v1.0.0 \
  --query 'imageScanFindings.findingsSeverityCounts'

# Show only CRITICAL and HIGH vulnerabilities
aws ecr describe-image-scan-findings \
  --repository-name my-app \
  --image-id imageTag=v1.0.0 \
  --query 'imageScanFindings.findings[?severity==`CRITICAL` || severity==`HIGH`].{
    Name: name,
    Severity: severity,
    Description: description,
    URI: uri
  }'
```

### 5.3 Automated Notifications Based on Scan Results

```python
# Lambda that detects ECR scan completion events via EventBridge
# and sends a Slack notification if CRITICAL/HIGH vulnerabilities are found
import json
import os
import urllib3

SLACK_WEBHOOK_URL = os.environ["SLACK_WEBHOOK_URL"]

def lambda_handler(event, context):
    detail = event["detail"]
    repo = detail["repository-name"]
    tag = detail["image-tags"][0] if detail.get("image-tags") else "untagged"
    severity_counts = detail["finding-severity-counts"]

    critical = severity_counts.get("CRITICAL", 0)
    high = severity_counts.get("HIGH", 0)
    medium = severity_counts.get("MEDIUM", 0)

    if critical > 0 or high > 0:
        color = "#ff0000" if critical > 0 else "#ff9900"
        message = {
            "attachments": [
                {
                    "color": color,
                    "title": f"ECR Image Scan Alert: {repo}:{tag}",
                    "fields": [
                        {"title": "CRITICAL", "value": str(critical), "short": True},
                        {"title": "HIGH", "value": str(high), "short": True},
                        {"title": "MEDIUM", "value": str(medium), "short": True},
                        {"title": "Repository", "value": repo, "short": True}
                    ],
                    "text": "Vulnerabilities detected. Please review.",
                    "footer": "Amazon ECR Image Scan"
                }
            ]
        }
        http = urllib3.PoolManager()
        http.request("POST", SLACK_WEBHOOK_URL,
                     body=json.dumps(message),
                     headers={"Content-Type": "application/json"})

    return {"statusCode": 200, "body": "Processed"}
```

```yaml
# EventBridge rule (CloudFormation)
ECRScanEventRule:
  Type: AWS::Events::Rule
  Properties:
    Name: ecr-scan-findings
    Description: Detect ECR scan completion events
    EventPattern:
      source:
        - "aws.ecr"
      detail-type:
        - "ECR Image Scan"
      detail:
        scan-status:
          - "COMPLETE"
        finding-severity-counts:
          CRITICAL:
            - numeric: [">", 0]
    Targets:
      - Arn: !GetAtt ScanNotificationFunction.Arn
        Id: ScanNotification
```

### 5.4 Scan Gate in CI/CD Pipelines

```bash
#!/bin/bash
# Image scan gate in CI/CD pipeline
# Blocks deployment if CRITICAL/HIGH vulnerabilities are found

REPO_NAME=$1
IMAGE_TAG=$2
MAX_CRITICAL=0
MAX_HIGH=0

echo "Waiting for scan to complete..."
aws ecr wait image-scan-complete \
  --repository-name ${REPO_NAME} \
  --image-id imageTag=${IMAGE_TAG}

# Retrieve scan results
FINDINGS=$(aws ecr describe-image-scan-findings \
  --repository-name ${REPO_NAME} \
  --image-id imageTag=${IMAGE_TAG} \
  --query 'imageScanFindings.findingsSeverityCounts')

CRITICAL=$(echo ${FINDINGS} | jq -r '.CRITICAL // 0')
HIGH=$(echo ${FINDINGS} | jq -r '.HIGH // 0')

echo "Scan Results: CRITICAL=${CRITICAL}, HIGH=${HIGH}"

if [ "${CRITICAL}" -gt "${MAX_CRITICAL}" ]; then
  echo "ERROR: ${CRITICAL} CRITICAL vulnerabilities found. Maximum allowed: ${MAX_CRITICAL}"
  exit 1
fi

if [ "${HIGH}" -gt "${MAX_HIGH}" ]; then
  echo "ERROR: ${HIGH} HIGH vulnerabilities found. Maximum allowed: ${MAX_HIGH}"
  exit 1
fi

echo "Scan passed. Proceeding with deployment."
exit 0
```

---

## 6. Cross-Region/Cross-Account Replication

### 6.1 Replication Configuration

```
Replication Setup:

Source Region (ap-northeast-1)
+------------------+
| ECR: my-app      |  push
| :v1.0            | ----+
+------------------+     |
                         | Automatic Replication
                         |
    +--------------------+--------------------+
    |                                         |
    v                                         v
Destination Region (us-east-1)      Destination Account (987654321098)
+------------------+               +------------------+
| ECR: my-app      |               | ECR: my-app      |
| :v1.0 (replica)  |               | :v1.0 (replica)  |
+------------------+               +------------------+
```

```bash
# Configure cross-region replication
aws ecr put-replication-configuration \
  --replication-configuration '{
    "rules": [
      {
        "destinations": [
          {
            "region": "us-east-1",
            "registryId": "123456789012"
          },
          {
            "region": "eu-west-1",
            "registryId": "123456789012"
          }
        ],
        "repositoryFilters": [
          {
            "filter": "prod-",
            "filterType": "PREFIX_MATCH"
          }
        ]
      }
    ]
  }'

# Configure cross-account replication
aws ecr put-replication-configuration \
  --replication-configuration '{
    "rules": [
      {
        "destinations": [
          {
            "region": "ap-northeast-1",
            "registryId": "987654321098"
          }
        ],
        "repositoryFilters": [
          {
            "filter": "shared/",
            "filterType": "PREFIX_MATCH"
          }
        ]
      }
    ]
  }'

# View replication configuration
aws ecr describe-registry \
  --query 'replicationConfiguration'

# Set registry policy on the destination account
# (required to accept replication)
aws ecr put-registry-policy \
  --policy-text '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "AllowReplication",
        "Effect": "Allow",
        "Principal": {
          "AWS": "arn:aws:iam::123456789012:root"
        },
        "Action": [
          "ecr:CreateRepository",
          "ecr:ReplicateImage"
        ],
        "Resource": "arn:aws:ecr:ap-northeast-1:987654321098:repository/*"
      }
    ]
  }'
```

### 6.2 Pull-Through Cache

```
How Pull-Through Cache Works:

First pull:
  ECS/EKS --> ECR (no cache) --> Docker Hub --> Fetch image
                    |
                    v
              Save to cache

Subsequent pulls:
  ECS/EKS --> ECR (cached) --> Fetch image (fast)
  No communication with Docker Hub = avoid rate limit impact
```

```bash
# Create a pull-through cache rule
aws ecr create-pull-through-cache-rule \
  --ecr-repository-prefix docker-hub \
  --upstream-registry-url registry-1.docker.io

# Cache for GitHub Container Registry
aws ecr create-pull-through-cache-rule \
  --ecr-repository-prefix ghcr \
  --upstream-registry-url ghcr.io

# Cache for Quay.io
aws ecr create-pull-through-cache-rule \
  --ecr-repository-prefix quay \
  --upstream-registry-url quay.io

# Using the pull-through cache
# docker pull 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/docker-hub/library/nginx:latest
# --> First pull from Docker Hub, subsequent pulls from ECR cache

# List cache rules
aws ecr describe-pull-through-cache-rules

# Delete a cache rule
aws ecr delete-pull-through-cache-rule \
  --ecr-repository-prefix docker-hub
```

---

## 7. CI/CD Pipeline Integration

### 7.1 ECR Integration with GitHub Actions

```yaml
# .github/workflows/build-and-push.yml
name: Build and Push to ECR

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  AWS_REGION: ap-northeast-1
  ECR_REPOSITORY: my-app

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsRole
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:latest .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

      - name: Wait for scan and check results
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          aws ecr wait image-scan-complete \
            --repository-name $ECR_REPOSITORY \
            --image-id imageTag=$IMAGE_TAG
          CRITICAL=$(aws ecr describe-image-scan-findings \
            --repository-name $ECR_REPOSITORY \
            --image-id imageTag=$IMAGE_TAG \
            --query 'imageScanFindings.findingsSeverityCounts.CRITICAL' \
            --output text)
          if [ "$CRITICAL" != "None" ] && [ "$CRITICAL" -gt 0 ]; then
            echo "CRITICAL vulnerabilities found: $CRITICAL"
            exit 1
          fi
```

### 7.2 ECR Integration with CodeBuild

```yaml
# buildspec.yml
version: 0.2

env:
  variables:
    AWS_DEFAULT_REGION: ap-northeast-1
    ECR_REPO_NAME: my-app

phases:
  pre_build:
    commands:
      - echo Logging in to Amazon ECR...
      - ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com"
      - aws ecr get-login-password | docker login --username AWS --password-stdin ${ECR_URI}
      - IMAGE_TAG=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | head -c 8)
      - IMAGE_URI="${ECR_URI}/${ECR_REPO_NAME}"

  build:
    commands:
      - echo Build started on `date`
      - docker build -t ${IMAGE_URI}:${IMAGE_TAG} .
      - docker tag ${IMAGE_URI}:${IMAGE_TAG} ${IMAGE_URI}:latest

  post_build:
    commands:
      - echo Pushing the Docker image...
      - docker push ${IMAGE_URI}:${IMAGE_TAG}
      - docker push ${IMAGE_URI}:latest
      - echo Writing image definitions file...
      - printf '[{"name":"web","imageUri":"%s"}]' ${IMAGE_URI}:${IMAGE_TAG} > imagedefinitions.json

artifacts:
  files:
    - imagedefinitions.json
```

---

## 8. Security Best Practices

### 8.1 Image Signing (Sigstore/Cosign)

```bash
# Image signing with Cosign
# 1. Generate a key pair
cosign generate-key-pair

# 2. Sign the image
cosign sign --key cosign.key \
  ${ECR_URI}/${REPO_NAME}:${IMAGE_TAG}

# 3. Verify the signature
cosign verify --key cosign.pub \
  ${ECR_URI}/${REPO_NAME}:${IMAGE_TAG}

# 4. Keyless signing (using OIDC provider)
cosign sign --identity-token=$(gcloud auth print-identity-token) \
  ${ECR_URI}/${REPO_NAME}:${IMAGE_TAG}
```

### 8.2 SBOM (Software Bill of Materials) Generation

```bash
# Generate SBOM with Syft
syft ${ECR_URI}/${REPO_NAME}:${IMAGE_TAG} \
  -o spdx-json > sbom.spdx.json

# Attach SBOM to ECR as an OCI artifact
cosign attach sbom \
  --sbom sbom.spdx.json \
  ${ECR_URI}/${REPO_NAME}:${IMAGE_TAG}

# Vulnerability scan based on SBOM using Grype
grype sbom:sbom.spdx.json
```

### 8.3 Base Image Management

```
Base Image Strategy:

Recommended Images (lightweight and secure):
  1. distroless (Google) - No shell, minimal footprint
  2. Alpine Linux - 5MB, musl libc
  3. Debian slim - glibc compatible, lightweight
  4. Amazon Linux 2023 - AWS-optimized

Not Recommended:
  X ubuntu:latest (large, frequently updated)
  X node:latest (700MB+)
  X python:latest (900MB+)

Image Size Comparison:
  python:3.12         --> ~900 MB
  python:3.12-slim    --> ~120 MB
  python:3.12-alpine  --> ~50 MB
  distroless/python3  --> ~30 MB
```

---

## 9. Anti-Patterns

### 9.1 Using Only the latest Tag

```
[Bad Example]
docker push my-app:latest  (overwrite latest every time)

Problems:
  - Unclear which image to roll back to
  - Different versions exist as latest across multiple environments
  - Cannot configure tag immutability

[Good Example]
docker push my-app:v1.2.3           (semantic versioning)
docker push my-app:git-abc123def    (Git SHA)
docker push my-app:build-456        (build number)

Even Better (using multiple tags):
docker push my-app:v1.2.3
docker push my-app:git-abc123def
docker push my-app:latest           (for reference only, do not use for deployment)
```

### 9.2 Not Configuring Lifecycle Policies

**Problem**: Images accumulate indefinitely, increasing storage costs. Thousands of images remain, making it difficult to identify the needed ones.

**Improvement**: Configure lifecycle policies from the start of the project, setting automatic deletion of untagged images and defining limits on the number of retained tagged images.

### 9.3 Running Containers as Root

```
[Bad Example]
FROM python:3.12
COPY . /app
CMD ["python", "/app/main.py"]
--> Runs as root (UID 0)

[Good Example]
FROM python:3.12
RUN useradd --create-home appuser
USER appuser
COPY --chown=appuser:appuser . /app
CMD ["python", "/app/main.py"]
--> Runs as non-root (UID 1000)

[Even Better]
FROM gcr.io/distroless/python3-debian12:nonroot
COPY . /app
CMD ["python", "/app/main.py"]
--> Runs as nonroot (UID 65532), no shell access
```

### 9.4 Hardcoding Credentials

```
[Bad Example]
FROM python:3.12
ENV DB_PASSWORD=my-secret-password  <-- Included in the image!
COPY . /app
CMD ["python", "/app/main.py"]

[Good Example]
FROM python:3.12
# Credentials are injected at runtime via environment variables
# ECS: Reference Secrets Manager via the secrets parameter in task definitions
# EKS: Managed via Kubernetes Secrets + IRSA
COPY . /app
CMD ["python", "/app/main.py"]
```

---

## 10. CloudFormation Template

### 10.1 Complete ECR Repository Configuration Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'ECR Repository Configuration Template'

Parameters:
  EnvironmentName:
    Type: String
    Default: prod
    AllowedValues: [dev, stg, prod]

  ProjectName:
    Type: String
    Default: my-app

Resources:
  # ECR Repository
  ECRRepository:
    Type: AWS::ECR::Repository
    Properties:
      RepositoryName: !Sub '${ProjectName}'
      ImageScanningConfiguration:
        ScanOnPush: true
      ImageTagMutability: IMMUTABLE
      EncryptionConfiguration:
        EncryptionType: AES256
      LifecyclePolicy:
        LifecyclePolicyText: |
          {
            "rules": [
              {
                "rulePriority": 1,
                "description": "untagged images expire after 7 days",
                "selection": {
                  "tagStatus": "untagged",
                  "countType": "sinceImagePushed",
                  "countUnit": "days",
                  "countNumber": 7
                },
                "action": {"type": "expire"}
              },
              {
                "rulePriority": 2,
                "description": "Keep last 50 tagged images",
                "selection": {
                  "tagStatus": "tagged",
                  "tagPrefixList": ["v"],
                  "countType": "imageCountMoreThan",
                  "countNumber": 50
                },
                "action": {"type": "expire"}
              }
            ]
          }
      RepositoryPolicyText:
        Version: '2012-10-17'
        Statement:
          - Sid: AllowPullFromProdAccount
            Effect: Allow
            Principal:
              AWS: !Sub 'arn:aws:iam::${AWS::AccountId}:root'
            Action:
              - ecr:GetDownloadUrlForLayer
              - ecr:BatchGetImage
              - ecr:BatchCheckLayerAvailability
      Tags:
        - Key: Environment
          Value: !Ref EnvironmentName
        - Key: Project
          Value: !Ref ProjectName

  # EventBridge rule for scan notifications
  ECRScanRule:
    Type: AWS::Events::Rule
    Properties:
      Name: !Sub '${ProjectName}-ecr-scan-alert'
      EventPattern:
        source:
          - aws.ecr
        detail-type:
          - ECR Image Scan
        detail:
          repository-name:
            - !Ref ECRRepository
          scan-status:
            - COMPLETE
      Targets:
        - Arn: !Ref AlertTopic
          Id: ECRScanAlert
          InputTransformer:
            InputPathsMap:
              repo: $.detail.repository-name
              tag: $.detail.image-tags[0]
              critical: $.detail.finding-severity-counts.CRITICAL
              high: $.detail.finding-severity-counts.HIGH
            InputTemplate: |
              "ECR Scan Alert: <repo>:<tag> - CRITICAL: <critical>, HIGH: <high>"

  # SNS Topic
  AlertTopic:
    Type: AWS::SNS::Topic
    Properties:
      TopicName: !Sub '${ProjectName}-ecr-alerts'

Outputs:
  RepositoryUri:
    Description: ECR Repository URI
    Value: !GetAtt ECRRepository.RepositoryUri
    Export:
      Name: !Sub '${ProjectName}-ECRRepositoryUri'

  RepositoryArn:
    Description: ECR Repository ARN
    Value: !GetAtt ECRRepository.Arn
```


---

## Practice Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also create test code

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
        assert False, "Exception should be raised"
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
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|---------|
| Initialization error | Invalid configuration file | Check configuration file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access privileges | Check execution user permissions, review settings |
| Data inconsistency | Concurrent processing conflict | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check error messages**: Read the stack trace and identify where it occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Incremental verification**: Use log output or a debugger to verify hypotheses
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
    """Data processing (debugging target)"""
    if not items:
        raise ValueError("Empty data")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps for diagnosing performance issues:

1. **Identify bottlenecks**: Measure with profiling tools
2. **Check memory usage**: Verify the presence of memory leaks
3. **Check I/O wait**: Examine disk and network I/O status
4. **Check concurrent connections**: Verify the state of connection pools

| Issue Type | Diagnostic Tool | Remedy |
|------------|----------------|--------|
| CPU load | cProfile, py-spy | Improve algorithms, parallelize |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexing, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology decisions.

| Criterion | Prioritize when | Can compromise when |
|-----------|----------------|---------------------|
| Performance | Real-time processing, large-scale data | Admin UIs, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, speed to market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
+-------------------------------------------------+
|         Architecture Selection Flow             |
+-------------------------------------------------+
|                                                 |
|  1. What is the team size?                      |
|    +-- Small (1-5)    --> Monolith              |
|    +-- Large (10+)    --> Go to 2               |
|                                                 |
|  2. How often do you deploy?                    |
|    +-- Weekly or less --> Monolith + modules    |
|    +-- Daily/multiple --> Go to 3               |
|                                                 |
|  3. How independent are teams?                  |
|    +-- High       --> Microservices             |
|    +-- Moderate   --> Modular monolith          |
|                                                 |
+-------------------------------------------------+
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- A faster short-term approach may become technical debt in the long run
- Conversely, over-engineering incurs high short-term costs and causes project delays

**2. Consistency vs Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies allows best-fit choices but increases operational costs

**3. Level of Abstraction**
- High abstraction promotes reusability but can make debugging difficult
- Low abstraction is intuitive but tends to result in code duplication

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
        """Describe background and problem"""
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
            icon = "+" if c['type'] == 'positive' else "!"
            md += f"- {icon} {c['description']}\n"
        md += "\n## Rejected Alternatives\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```
---

## 11. FAQ

### Q1. How long is the ECR authentication token valid?

The ECR authentication token is valid for 12 hours. In CI/CD pipelines, run `aws ecr get-login-password` at the start of the build to obtain a token. For long-running build agents, periodic re-authentication via cron or similar is required.

### Q2. What is the difference between ECR Public and Docker Hub?

ECR Public Gallery (public.ecr.aws) is a public container registry provided by AWS that allows anonymous pulls. Compared to Docker Hub, rate limits are relaxed for pulls from AWS accounts. AWS official base images (Lambda, AL2023, etc.) are provided via ECR Public.

### Q3. How should I reduce image size?

Use multi-stage builds to exclude build tools from the final image. Use lightweight images like Alpine-based or distroless images. Exclude unnecessary files from the build context using `.dockerignore`. Write instructions that change infrequently (dependency installation) first to leverage layer caching.

### Q4. What is ECR pull-through cache?

It is a feature that caches image pulls from upstream registries such as Docker Hub, GitHub Container Registry, and Quay.io via ECR. It avoids Docker Hub rate limits and achieves faster pulls and reduced network costs. Once an image is cached, subsequent pulls are served directly from ECR.

### Q5. How should multi-architecture images be managed?

Using `docker buildx`, you can manage both amd64 and arm64 images under the same tag. ECR supports manifest lists, and the appropriate image for the client's architecture is automatically selected at pull time. Multi-architecture builds are recommended for applications running on both Graviton (arm64) and x86_64.

### Q6. Should images be managed by digest (SHA)?

For production deployments, specifying images by image digest (sha256:xxx) rather than tag is the safest approach. Tags can be overwritten (if MUTABLE), but digests are immutable. However, if IMMUTABLE tag settings are configured, managing by tag is also sufficiently safe. In CI/CD pipelines, recording both the tag and digest is a best practice.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It is especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|-----------|
| Repository creation | IMMUTABLE tags + enabling scanning is recommended |
| Image push | Authenticate with get-login-password, then tag + push |
| Lifecycle policies | Automatic deletion of untagged images, limit retained tagged images |
| Image scanning | Basic (free) / Enhanced (Inspector) |
| Replication | Automatic cross-region/cross-account replication |
| Pull-through cache | Avoid Docker Hub rate limits |
| Security | Non-root execution, multi-stage builds, image signing |
| CI/CD integration | Automated build and push with GitHub Actions / CodeBuild |
| SBOM | Visibility into software composition and vulnerability tracking |

---

## Next Guides to Read

- [ECS Basics](./00-ecs-basics.md) -- Run ECR images on ECS
- [EKS Overview](./02-eks-overview.md) -- Run ECR images on EKS
- [CodePipeline](../07-devops/02-codepipeline.md) -- Integrate ECR into CI/CD

---

## References

1. AWS Official Documentation "Amazon ECR User Guide" https://docs.aws.amazon.com/AmazonECR/latest/userguide/
2. AWS Official "Container Image Best Practices" https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/container-images.html
3. Docker Official "Dockerfile Best Practices" https://docs.docker.com/develop/develop-images/dockerfile_best-practices/
4. Sigstore/Cosign Official Documentation https://docs.sigstore.dev/
5. AWS Official "ECR Pull-Through Cache" https://docs.aws.amazon.com/AmazonECR/latest/userguide/pull-through-cache.html

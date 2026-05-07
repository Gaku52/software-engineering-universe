# Container Deployment

> Build container-based deployment pipelines leveraging ECS, Kubernetes, and ArgoCD to achieve scalable, reproducible deployments

## What You Will Learn

1. **Docker image optimization and registry management** — Multi-stage builds, image size reduction, ECR/GHCR operations
2. **Container deployment with ECS (Fargate)** — Task definitions, service configuration, CI/CD pipeline construction
3. **GitOps deployment with Kubernetes + ArgoCD** — Manifest management, automated sync, Progressive Delivery
4. **Container security and image vulnerability management** — Scan automation, policy enforcement, security best practices
5. **Multi-environment support and promotion strategies** — Image promotion design across dev/staging/production


## Prerequisites

Before reading this guide, the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of [Cloud Deployment](./01-cloud-deployment.md)

---

## 1. Container Deployment Overview

```
┌─────────────────────────────────────────────────────────┐
│            コンテナデプロイ パイプライン                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ソースコード    ビルド         レジストリ    オーケストレータ │
│  ┌──────┐    ┌──────────┐   ┌────────┐   ┌──────────┐ │
│  │ Git  │───►│ Docker   │──►│ ECR /  │──►│ ECS /    │ │
│  │ Repo │    │ Build    │   │ GHCR   │   │ K8s      │ │
│  └──────┘    └──────────┘   └────────┘   └──────────┘ │
│       │                                       │        │
│       │    GitOps の場合                       │        │
│       │    ┌──────────┐                       │        │
│       └───►│ ArgoCD   │──── 自動同期 ────────►│        │
│            └──────────┘                                │
│                                                         │
│  [CI] GitHub Actions          [CD] ArgoCD / ECS Deploy  │
│  - テスト実行                  - ローリングアップデート     │
│  - イメージビルド              - ヘルスチェック             │
│  - 脆弱性スキャン              - 自動ロールバック          │
└─────────────────────────────────────────────────────────┘
```

### Core Principles of Container Deployment

Container-based deployment involves the following principles that are more important compared to traditional VM-based deployment.

1. **Immutable infrastructure**: Container images are never modified once built. Environmental differences are injected via environment variables and secrets
2. **Declarative configuration management**: The desired deployment state is declared as code, and the orchestrator maintains that state
3. **Reproducibility guarantee**: Using the same image tag allows you to reproduce the same environment anywhere, anytime
4. **Staged rollout**: New versions are deployed incrementally, and problems can be rolled back immediately

```
Container Deployment Layer Structure:

  ┌─────────────────────────────────────────────┐
  │         アプリケーション層                      │
  │  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
  │  │ Service │  │ Service │  │ Service │    │
  │  │    A    │  │    B    │  │    C    │    │
  │  └────┬────┘  └────┬────┘  └────┬────┘    │
  ├───────┼────────────┼────────────┼──────────┤
  │       │ コンテナオーケストレーション層         │
  │  ┌────┴────────────┴────────────┴────┐     │
  │  │   ECS / Kubernetes / Nomad        │     │
  │  │   - スケジューリング               │     │
  │  │   - ヘルスチェック                 │     │
  │  │   - オートスケーリング              │     │
  │  │   - サービスディスカバリ            │     │
  │  └──────────────────────────────────┘     │
  ├────────────────────────────────────────────┤
  │         インフラストラクチャ層                 │
  │  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
  │  │ Compute  │  │ Network  │  │ Storage  │ │
  │  │ (EC2/    │  │ (VPC/    │  │ (EBS/    │ │
  │  │  Fargate)│  │  ALB)    │  │  EFS)    │ │
  │  └──────────┘  └──────────┘  └──────────┘ │
  └─────────────────────────────────────────────┘
```

---

## 2. Docker Image Optimization

### 2.1 Multi-Stage Build Basics

```dockerfile
# Dockerfile — Multi-stage build (Node.js)
# ============================================
# Stage 1: Install dependencies
# ============================================
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files first to leverage caching
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ============================================
# Stage 2: Build
# ============================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ============================================
# Stage 3: Production image (minimal)
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

# Security: run as non-root user
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser

# Copy only production dependencies and build artifacts
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

USER appuser

EXPOSE 3000
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
```

### 2.2 Multi-Stage Build for Go Applications

```dockerfile
# Dockerfile — Go multi-stage build (scratch image)
# ============================================
# Stage 1: Build
# ============================================
FROM golang:1.22-alpine AS builder
WORKDIR /app

# Pre-download dependencies (leverage caching)
COPY go.mod go.sum ./
RUN go mod download

# Copy source code and build
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s -X main.version=$(git describe --tags 2>/dev/null || echo 'dev')" \
    -o /app/server ./cmd/server

# ============================================
# Stage 2: Minimal image (scratch)
# ============================================
FROM scratch

# CA certificates (required for HTTPS communication)
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Timezone information
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

# passwd file (non-root user)
COPY --from=builder /etc/passwd /etc/passwd

# Copy binary only
COPY --from=builder /app/server /server

USER 1001

EXPOSE 8080

ENTRYPOINT ["/server"]
```

### 2.3 Multi-Stage Build for Python Applications

```dockerfile
# Dockerfile — Python (FastAPI) multi-stage build
# ============================================
# Stage 1: Build dependencies
# ============================================
FROM python:3.12-slim AS builder
WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Create virtual environment and install dependencies
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ============================================
# Stage 2: Production image
# ============================================
FROM python:3.12-slim AS runner
WORKDIR /app

# Install only runtime-required libraries
RUN apt-get update && \
    apt-get install -y --no-install-recommends libpq5 curl && \
    rm -rf /var/lib/apt/lists/*

# Non-root user
RUN groupadd --system --gid 1001 appgroup && \
    useradd --system --uid 1001 --gid appgroup appuser

# Copy virtual environment
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application code
COPY . .

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 2.4 .dockerignore Configuration

```yaml
# .dockerignore
node_modules
.git
.github
.env*
*.md
Dockerfile
docker-compose*.yml
coverage
.nyc_output
dist
.vscode
.idea
__pycache__
*.pyc
.pytest_cache
.mypy_cache
.tox
venv
.venv
```

### 2.5 Image Size Optimization Best Practices

```
Image size comparison:

  Difference based on base image selection:
  ┌────────────────────┬────────────┐
  │ Base image         │ Size       │
  ├────────────────────┼────────────┤
  │ node:20            │ ~1.1 GB    │
  │ node:20-slim       │ ~240 MB    │
  │ node:20-alpine     │ ~140 MB    │
  │ distroless/nodejs  │ ~130 MB    │
  ├────────────────────┼────────────┤
  │ python:3.12        │ ~1.0 GB    │
  │ python:3.12-slim   │ ~150 MB    │
  │ python:3.12-alpine │ ~60 MB     │
  ├────────────────────┼────────────┤
  │ golang:1.22        │ ~800 MB    │
  │ golang:1.22-alpine │ ~260 MB    │
  │ scratch (Go)       │ ~10-20 MB  │
  └────────────────────┴────────────┘

  Optimization techniques:
  1. Use Alpine / slim base images
  2. Eliminate unnecessary tools with multi-stage builds
  3. Minimize build context with .dockerignore
  4. Merge layers (chain RUN instructions with &&)
  5. After apt-get install, run rm -rf /var/lib/apt/lists/*
  6. Exclude recommended packages with --no-install-recommends
  7. Optimize COPY order to maximize cache efficiency
```

---

## 3. Container Registry Management

### 3.1 ECR (Elastic Container Registry) Configuration

```yaml
# ecr-lifecycle-policy.json — Image lifecycle management
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Retain semantic version tags",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["v"],
        "countType": "imageCountMoreThan",
        "countNumber": 50
      },
      "action": {
        "type": "expire"
      }
    },
    {
      "rulePriority": 2,
      "description": "Delete SHA tags after 30 days",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["sha-"],
        "countType": "sinceImagePushed",
        "countUnit": "days",
        "countNumber": 30
      },
      "action": {
        "type": "expire"
      }
    },
    {
      "rulePriority": 3,
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
    }
  ]
}
```

```bash
# ECR repository management commands

# Create repository
aws ecr create-repository \
  --repository-name myorg/myapp \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256 \
  --region ap-northeast-1

# Check image scan results
aws ecr describe-image-scan-findings \
  --repository-name myorg/myapp \
  --image-id imageTag=v1.2.3 \
  --region ap-northeast-1

# Apply lifecycle policy
aws ecr put-lifecycle-policy \
  --repository-name myorg/myapp \
  --lifecycle-policy-text file://ecr-lifecycle-policy.json

# Configure cross-account access
aws ecr set-repository-policy \
  --repository-name myorg/myapp \
  --policy-text '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "AllowPull",
        "Effect": "Allow",
        "Principal": {"AWS": "arn:aws:iam::987654321098:root"},
        "Action": [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
      }
    ]
  }'
```

### 3.2 GHCR (GitHub Container Registry) Management

```yaml
# .github/workflows/cleanup-ghcr.yml — Automatic deletion of old images
name: Cleanup GHCR Images

on:
  schedule:
    - cron: '0 3 * * 0'  # Every Sunday at 3:00 UTC

jobs:
  cleanup:
    runs-on: ubuntu-latest
    permissions:
      packages: write

    steps:
      - name: Delete old untagged images
        uses: actions/delete-package-versions@v5
        with:
          package-name: myapp
          package-type: container
          min-versions-to-keep: 10
          delete-only-untagged-versions: true

      - name: Delete old pre-release images
        uses: actions/delete-package-versions@v5
        with:
          package-name: myapp
          package-type: container
          min-versions-to-keep: 5
          ignore-versions: '^v\\d+\\.\\d+\\.\\d+$'
```

---

## 4. GitHub Actions — Image Build and Push

### 4.1 Basic Build and Push Workflow

```yaml
# .github/workflows/build-and-push.yml
name: Build and Push Container Image

on:
  push:
    branches: [main]
    tags: ['v*']

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    outputs:
      image-tag: ${{ steps.meta.outputs.version }}

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=
            type=ref,event=tag
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and Push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64,linux/arm64
```

### 4.2 Security Scan Integrated Build Workflow

```yaml
# .github/workflows/build-scan-push.yml
name: Build, Scan and Push

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-scan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      security-events: write

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build image for scanning
        uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          load: true
          tags: scan-target:latest
          cache-from: type=gha

      # Vulnerability scanning with Trivy
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: scan-target:latest
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'  # Fail job if CRITICAL/HIGH found

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'

      # Dockerfile linting with Hadolint
      - name: Run Hadolint
        uses: hadolint/hadolint-action@v3.1.0
        with:
          dockerfile: Dockerfile
          failure-threshold: warning

      # SBOM generation with Docker Scout
      - name: Docker Scout SBOM
        if: github.event_name != 'pull_request'
        uses: docker/scout-action@v1
        with:
          command: cves
          image: scan-target:latest
          sarif-file: scout-results.sarif

      # Push after passing scan
      - name: Login to Container Registry
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        if: github.event_name != 'pull_request'
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=
            type=ref,event=tag
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Push to registry
        if: github.event_name != 'pull_request'
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64,linux/arm64
          provenance: true
          sbom: true
```

### 4.3 Multi-Environment Promotion Workflow

```yaml
# .github/workflows/promote-image.yml
name: Promote Image to Production

on:
  workflow_dispatch:
    inputs:
      image-tag:
        description: 'Image tag to promote (e.g., sha-abc1234)'
        required: true
      target-env:
        description: 'Target environment'
        required: true
        type: choice
        options:
          - staging
          - production

jobs:
  promote:
    runs-on: ubuntu-latest
    environment: ${{ inputs.target-env }}
    permissions:
      packages: write
      contents: write

    steps:
      - uses: actions/checkout@v4

      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Promote image
        run: |
          SOURCE="ghcr.io/${{ github.repository }}:${{ inputs.image-tag }}"
          TARGET="ghcr.io/${{ github.repository }}:${{ inputs.target-env }}-latest"

          docker pull "$SOURCE"
          docker tag "$SOURCE" "$TARGET"
          docker push "$TARGET"

          echo "Promoted $SOURCE -> $TARGET"

      - name: Update deployment manifest
        if: inputs.target-env == 'production'
        run: |
          # Update image tag in K8s manifest
          sed -i "s|image: ghcr.io/${{ github.repository }}:.*|image: ghcr.io/${{ github.repository }}:${{ inputs.image-tag }}|" \
            k8s/overlays/production/deployment-patch.yaml

          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add k8s/overlays/production/deployment-patch.yaml
          git commit -m "chore(deploy): promote ${{ inputs.image-tag }} to production"
          git push
```

---

## 5. ECS (Fargate) Deployment

### 5.1 Task Definition

```json
// ecs-task-definition.json
{
  "family": "myapp",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::123456789012:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "app",
      "image": "ghcr.io/myorg/myapp:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --spider http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      },
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/myapp",
          "awslogs-region": "ap-northeast-1",
          "awslogs-stream-prefix": "app"
        }
      },
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:myapp/db-url"
        }
      ],
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "PORT", "value": "3000" }
      ]
    }
  ]
}
```

### 5.2 ECS Service Definition (Terraform)

```hcl
# ecs-service.tf — Terraform definition for ECS service

resource "aws_ecs_cluster" "main" {
  name = "myapp-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  configuration {
    execute_command_configuration {
      logging = "OVERRIDE"
      log_configuration {
        cloud_watch_log_group_name = aws_cloudwatch_log_group.ecs_exec.name
      }
    }
  }
}

resource "aws_ecs_service" "myapp" {
  name            = "myapp-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.myapp.arn
  desired_count   = 3
  launch_type     = "FARGATE"

  # Deployment configuration
  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100
  health_check_grace_period_seconds  = 60

  # Deployment circuit breaker
  deployment_circuit_breaker {
    enable   = true
    rollback = true  # Automatic rollback on failure
  }

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.myapp.arn
    container_name   = "app"
    container_port   = 3000
  }

  # Service discovery
  service_registries {
    registry_arn = aws_service_discovery_service.myapp.arn
  }

  lifecycle {
    ignore_changes = [task_definition]  # Task definition updated by CI/CD
  }
}

# Auto-scaling configuration
resource "aws_appautoscaling_target" "myapp" {
  max_capacity       = 10
  min_capacity       = 3
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.myapp.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "myapp-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.myapp.resource_id
  scalable_dimension = aws_appautoscaling_target.myapp.scalable_dimension
  service_namespace  = aws_appautoscaling_target.myapp.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

resource "aws_appautoscaling_policy" "memory" {
  name               = "myapp-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.myapp.resource_id
  scalable_dimension = aws_appautoscaling_target.myapp.scalable_dimension
  service_namespace  = aws_appautoscaling_target.myapp.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = 80.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
```

### 5.3 ECS Deployment Workflow

```yaml
# .github/workflows/deploy-ecs.yml
name: Deploy to ECS

on:
  workflow_run:
    workflows: ["Build and Push Container Image"]
    types: [completed]
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    environment: production

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions-deploy
          aws-region: ap-northeast-1

      - name: Get image tag
        id: image
        run: |
          echo "tag=sha-${GITHUB_SHA::7}" >> $GITHUB_OUTPUT

      - name: Update ECS task definition
        id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: ecs-task-definition.json
          container-name: app
          image: ghcr.io/${{ github.repository }}:${{ steps.image.outputs.tag }}

      - name: Deploy to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v1
        with:
          task-definition: ${{ steps.task-def.outputs.task-definition }}
          service: myapp-service
          cluster: myapp-cluster
          wait-for-service-stability: true
          wait-for-minutes: 10

      - name: Notify deployment result
        if: always()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "${{ job.status == 'success' && 'ECS deploy succeeded' || 'ECS deploy FAILED' }}: ${{ steps.image.outputs.tag }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

```
ECS Fargate deployment flow:

  GitHub Actions               ECR              ECS Service
      │                         │                    │
      │── docker build ───►     │                    │
      │── docker push ────►     │                    │
      │                         │                    │
      │── aws ecs               │                    │
      │   update-service ─────────────────────►      │
      │                         │                    │
      │                         │   ┌── New task start│
      │                         │   │   (v2 image)   │
      │                         │   │                │
      │                         │   │   Health check │
      │                         │   │   ┌─ OK ──►    │
      │                         │   │   │   Old task  │
      │                         │   │   │   stopped  │
      │                         │   │   │            │
      │                         │   │   └─ NG ──►    │
      │                         │   │       Roll-    │
      │                         │   │       back     │
```

---

## 6. Kubernetes + ArgoCD (GitOps)

### 6.1 Kubernetes Manifests (Kustomize-based)

```yaml
# k8s/base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  labels:
    app: myapp
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      serviceAccountName: myapp
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
      containers:
        - name: app
          image: ghcr.io/myorg/myapp:abc1234
          ports:
            - containerPort: 3000
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
          startupProbe:
            httpGet:
              path: /health
              port: 3000
            failureThreshold: 30
            periodSeconds: 2
          env:
            - name: NODE_ENV
              value: production
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: myapp-secrets
                  key: database-url
---
# k8s/base/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  selector:
    app: myapp
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP
---
# k8s/base/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myapp
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 30
      policies:
        - type: Percent
          value: 100
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
```

### 6.2 Environment Difference Management with Kustomize

```yaml
# k8s/base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml
  - service.yaml
  - hpa.yaml
  - pdb.yaml

commonLabels:
  app.kubernetes.io/name: myapp
  app.kubernetes.io/managed-by: kustomize
```

```yaml
# k8s/overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: production

resources:
  - ../../base

patches:
  - path: deployment-patch.yaml
  - path: hpa-patch.yaml

configMapGenerator:
  - name: myapp-config
    literals:
      - LOG_LEVEL=info
      - CACHE_TTL=3600

images:
  - name: ghcr.io/myorg/myapp
    newTag: v1.2.3
```

```yaml
# k8s/overlays/production/deployment-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 5
  template:
    spec:
      containers:
        - name: app
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 1000m
              memory: 1Gi
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: myapp
```

```yaml
# k8s/base/pdb.yaml — Pod Disruption Budget
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: myapp
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: myapp
```

### 6.3 ArgoCD Application Definition

```yaml
# argocd/application.yaml — ArgoCD Application definition
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp-production
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
  annotations:
    notifications.argoproj.io/subscribe.on-sync-succeeded.slack: deployments
    notifications.argoproj.io/subscribe.on-sync-failed.slack: deployments-alerts
spec:
  project: default
  source:
    repoURL: https://github.com/myorg/myapp-k8s-manifests.git
    targetRevision: main
    path: k8s/overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true        # Automatically delete unnecessary resources
      selfHeal: true      # Automatically correct manual changes
    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground
      - PruneLast=true
    retry:
      limit: 3
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas  # Ignored by ArgoCD because managed by HPA
```

### 6.4 Multi-Environment Management with ArgoCD ApplicationSet

```yaml
# argocd/applicationset.yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: myapp-environments
  namespace: argocd
spec:
  generators:
    - list:
        elements:
          - env: development
            cluster: https://dev-cluster.example.com
            revision: develop
            autoSync: true
          - env: staging
            cluster: https://staging-cluster.example.com
            revision: main
            autoSync: true
          - env: production
            cluster: https://prod-cluster.example.com
            revision: main
            autoSync: false  # Manual sync for production
  template:
    metadata:
      name: 'myapp-{{env}}'
      namespace: argocd
    spec:
      project: default
      source:
        repoURL: https://github.com/myorg/myapp-k8s-manifests.git
        targetRevision: '{{revision}}'
        path: 'k8s/overlays/{{env}}'
      destination:
        server: '{{cluster}}'
        namespace: '{{env}}'
      syncPolicy:
        automated:
          prune: '{{autoSync}}'
          selfHeal: '{{autoSync}}'
```

### 6.5 Progressive Delivery with Argo Rollouts

```yaml
# k8s/base/rollout.yaml — Canary deployment
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: myapp
spec:
  replicas: 5
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: app
          image: ghcr.io/myorg/myapp:v1.2.3
          ports:
            - containerPort: 3000
  strategy:
    canary:
      canaryService: myapp-canary
      stableService: myapp-stable
      trafficRouting:
        nginx:
          stableIngress: myapp-ingress
      steps:
        - setWeight: 5        # Route 5% of traffic to new version
        - pause: { duration: 5m }
        - analysis:            # Automatic decision based on metrics
            templates:
              - templateName: success-rate
            args:
              - name: service-name
                value: myapp-canary
        - setWeight: 25
        - pause: { duration: 5m }
        - analysis:
            templates:
              - templateName: success-rate
        - setWeight: 50
        - pause: { duration: 10m }
        - setWeight: 100
      analysis:
        successfulRunHistoryLimit: 3
        unsuccessfulRunHistoryLimit: 3
---
# k8s/base/analysis-template.yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
spec:
  args:
    - name: service-name
  metrics:
    - name: success-rate
      interval: 60s
      successCondition: result[0] >= 0.99
      failureLimit: 3
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            sum(rate(http_requests_total{service="{{args.service-name}}",status!~"5.."}[5m]))
            /
            sum(rate(http_requests_total{service="{{args.service-name}}"}[5m]))
```

---

## 7. Container Networking and Service Mesh

### 7.1 Service Mesh Configuration with Istio

```yaml
# istio/virtual-service.yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: myapp
spec:
  hosts:
    - myapp.example.com
  gateways:
    - myapp-gateway
  http:
    - match:
        - headers:
            x-canary:
              exact: "true"
      route:
        - destination:
            host: myapp
            subset: canary
    - route:
        - destination:
            host: myapp
            subset: stable
          weight: 95
        - destination:
            host: myapp
            subset: canary
          weight: 5
      timeout: 30s
      retries:
        attempts: 3
        perTryTimeout: 10s
        retryOn: 5xx,reset,connect-failure
---
# istio/destination-rule.yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: myapp
spec:
  host: myapp
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        h2UpgradePolicy: DEFAULT
        http1MaxPendingRequests: 100
        http2MaxRequests: 1000
    circuitBreaker:
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
  subsets:
    - name: stable
      labels:
        version: stable
    - name: canary
      labels:
        version: canary
```

---

## 8. Comparison Tables

| Characteristic | ECS (Fargate) | Kubernetes (EKS) | Docker Compose |
|----------------|--------------|-------------------|----------------|
| Management overhead | Low | High | Minimal |
| Scalability | High | Maximum | Low |
| Learning cost | Medium | High | Low |
| Ecosystem | AWS-contained | Large (CNCF) | Limited |
| Cost | Medium | High (control plane fee) | Low |
| GitOps support | CodePipeline | ArgoCD / Flux | Difficult |
| Scale | Medium to large | Large | Dev / small |
| Service mesh | App Mesh | Istio / Linkerd | None |
| Multi-cloud | Not possible | Possible | Not possible |

| GitOps tool comparison | ArgoCD | Flux | Jenkins X |
|------------------------|--------|------|-----------|
| UI dashboard | Rich | Basic | Available |
| Multi-cluster | Supported | Supported | Limited |
| Helm support | Supported | Supported | Supported |
| Kustomize support | Supported | Supported | Limited |
| RBAC | Fine-grained control | K8s RBAC | Proprietary |
| Community | Large | Large | Small |
| Progressive Delivery | Argo Rollouts | Flagger | Limited |
| ApplicationSet | Supported | Kustomization | Not supported |

| Container registry comparison | ECR | GHCR | Docker Hub | Harbor |
|-------------------------------|-----|------|------------|--------|
| Operation model | AWS managed | GitHub managed | SaaS | Self-hosted |
| Scan feature | Available | None (external integration) | Paid plan | Available |
| Lifecycle policy | Available | Manual/Actions | None | Available |
| Multi-architecture | Supported | Supported | Supported | Supported |
| Private repositories | Unlimited | Unlimited | 1 (free) | Unlimited |
| Cost | Storage + transfer | Free tier available | Free tier available | Infrastructure cost |

---

## 9. Container Runtime Security

### 9.1 Pod Security Standards

```yaml
# k8s/base/pod-security.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
---
# Example of secure Pod configuration
apiVersion: v1
kind: Pod
metadata:
  name: secure-app
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1001
    fsGroup: 1001
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: app
      image: ghcr.io/myorg/myapp:v1.2.3
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop:
            - ALL
      volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: cache
          mountPath: /app/.cache
  volumes:
    - name: tmp
      emptyDir: {}
    - name: cache
      emptyDir:
        sizeLimit: 100Mi
```

### 9.2 Communication Control with NetworkPolicy

```yaml
# k8s/base/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: myapp-network-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: myapp
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # Allow inbound only from ALB/Ingress Controller
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
      ports:
        - port: 3000
          protocol: TCP
  egress:
    # DNS resolution
    - to: []
      ports:
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP
    # Database
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: database
      ports:
        - port: 5432
          protocol: TCP
    # External HTTPS API
    - to: []
      ports:
        - port: 443
          protocol: TCP
```

---

## 10. Operations Command Reference

### 10.1 ECS Operations Commands

```bash
# List tasks
aws ecs list-tasks \
  --cluster myapp-cluster \
  --service-name myapp-service

# Check task details
aws ecs describe-tasks \
  --cluster myapp-cluster \
  --tasks arn:aws:ecs:ap-northeast-1:123456789012:task/myapp-cluster/abc123

# Check service event log
aws ecs describe-services \
  --cluster myapp-cluster \
  --services myapp-service \
  --query 'services[0].events[:10]' \
  --output table

# Manual scaling
aws ecs update-service \
  --cluster myapp-cluster \
  --service myapp-service \
  --desired-count 5

# Connect to container with ECS Exec (for debugging)
aws ecs execute-command \
  --cluster myapp-cluster \
  --task abc123 \
  --container app \
  --interactive \
  --command "/bin/sh"

# Force new deployment
aws ecs update-service \
  --cluster myapp-cluster \
  --service myapp-service \
  --force-new-deployment
```

### 10.2 Kubernetes Operations Commands

```bash
# Check Pod status
kubectl get pods -n production -l app=myapp -o wide

# Check Pod logs (follow logs across all Pods)
kubectl logs -n production -l app=myapp --all-containers --follow --tail=100

# Detailed Pod information
kubectl describe pod -n production <pod-name>

# Check rolling update status
kubectl rollout status deployment/myapp -n production

# Rollback
kubectl rollout undo deployment/myapp -n production

# Rollback to a specific revision
kubectl rollout undo deployment/myapp -n production --to-revision=3

# Check revision history
kubectl rollout history deployment/myapp -n production

# Port-forward to Pod (for debugging)
kubectl port-forward -n production svc/myapp 8080:80

# Check resource usage
kubectl top pods -n production -l app=myapp

# HPA status
kubectl get hpa -n production myapp -o yaml

# ArgoCD sync status
argocd app get myapp-production
argocd app sync myapp-production
argocd app diff myapp-production

# ArgoCD rollback
argocd app rollback myapp-production
```

---

## 11. Anti-Patterns

### Anti-Pattern 1: Using the latest Tag in Production

```dockerfile
# Bad: deploy to production with latest tag
# Which version is running is unknown; rollback is impossible
image: myapp:latest

# Good: use Git SHA or semantic version
image: ghcr.io/myorg/myapp:a1b2c3d
image: ghcr.io/myorg/myapp:v1.2.3

# Set up a mechanism to automatically configure image tags in CI/CD
```

### Anti-Pattern 2: Deploying Without Resource Limits

```yaml
# Bad: no resource limits
containers:
  - name: app
    image: myapp:v1.0.0
    # resources not set → memory leak can impact the entire Node

# Good: properly configure requests and limits
containers:
  - name: app
    image: myapp:v1.0.0
    resources:
      requests:        # Basis for scheduling
        cpu: 100m      # 0.1 CPU core
        memory: 128Mi
      limits:          # Restricted / OOMKilled when exceeded
        cpu: 500m
        memory: 512Mi
```

### Anti-Pattern 3: Hard-Coding Secrets

```yaml
# Bad: secrets directly written in environment variables
containers:
  - name: app
    env:
      - name: DATABASE_URL
        value: "postgresql://user:password123@db:5432/mydb"  # Dangerous!

# Good: use Kubernetes Secret or external secret management
containers:
  - name: app
    env:
      - name: DATABASE_URL
        valueFrom:
          secretKeyRef:
            name: myapp-secrets
            key: database-url

# Even better: integrate with AWS Secrets Manager using External Secrets Operator
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: myapp-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: myapp-secrets
  data:
    - secretKey: database-url
      remoteRef:
        key: myapp/production/database-url
```

### Anti-Pattern 4: No Health Checks Configured

```yaml
# Bad: no health checks
containers:
  - name: app
    image: myapp:v1.0.0
    ports:
      - containerPort: 3000
    # Traffic continues flowing even if the app hangs

# Good: properly configure 3 types of probes
containers:
  - name: app
    image: myapp:v1.0.0
    # startupProbe: determines startup completion (first time only)
    startupProbe:
      httpGet:
        path: /health
        port: 3000
      failureThreshold: 30
      periodSeconds: 2
    # readinessProbe: determines if traffic can be received
    readinessProbe:
      httpGet:
        path: /health/ready
        port: 3000
      periodSeconds: 10
      failureThreshold: 3
    # livenessProbe: determines if the app is alive
    livenessProbe:
      httpGet:
        path: /health/live
        port: 3000
      periodSeconds: 30
      failureThreshold: 3
```

### Anti-Pattern 5: Running Production with a Single Replica

```yaml
# Bad: running production with 1 replica
spec:
  replicas: 1
  # Service outage occurs when Pod restarts

# Good: minimum 3 replicas + PDB + TopologySpreadConstraints
spec:
  replicas: 3
  template:
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: myapp
# + PDB guarantees a minimum of 2 Pods
```

---

## 12. FAQ

### Q1: Should I choose ECS or Kubernetes?

The decision depends on your team's Kubernetes experience and tolerance for operational overhead. For simple container operations contained within AWS, ECS Fargate has low management overhead and is easy to get started with. Choose Kubernetes if you need multi-cloud support, advanced traffic control (such as Istio), or access to a rich OSS ecosystem. Also factor in EKS control plane costs (approximately $73/month). Specific decision criteria:

- **When to choose ECS**: AWS-only environment, team has few Kubernetes experts, small operations team (1-3 people), fewer than 10 services
- **When to choose Kubernetes**: Multi-cloud requirements, service mesh needed, team has Kubernetes experts, more than 10 services, advanced scheduling requirements

### Q2: Should ArgoCD "automated sync" always be enabled?

It is fine to enable it for development environments. For production, carefully consider `automated.prune: true` and `selfHeal: true`. In particular, `prune` automatically deletes resources removed from the Git repository, which carries risk of accidental deletion. It is recommended to introduce it gradually, starting with manual sync (the Sync button) to confirm reliability. The best practice for production is to enable `selfHeal: true` (automatically correct manual changes) while setting `prune: false` (disable automatic deletion).

### Q3: When should container image vulnerability scanning be performed?

A two-stage approach is recommended: **at build time** (within the CI pipeline) and **scheduled scanning**. At build time, run `trivy image` or `docker scout`, and fail the build if Critical/High vulnerabilities are found. Images stored in the registry also need daily scheduled scans configured because new CVEs may be published. Specifically:

1. **On PR**: Dockerfile linting with Hadolint + image scanning with Trivy
2. **On merge**: Full scan + SBOM generation + image signing (cosign)
3. **Scheduled**: ECR scan feature or daily Trivy scan
4. **Before deployment**: Deny deployment of unscanned images using admission control

### Q4: Should I use Fargate or the EC2 launch type?

**Fargate** requires no server management and has low operational costs, but GPU support is limited and custom kernel parameter changes are not possible. **EC2** offers greater flexibility and can optimize costs with spot instances, but requires managing EC2 instance patching and scaling. Fargate is recommended for typical web applications; choose EC2 when GPU is needed for ML inference workloads or there are special requirements.

### Q5: What can be done when image pull takes too long?

Consider the following countermeasures:

1. **Reduce image size**: Use multi-stage builds and Alpine base images
2. **Image caching**: Use ECR Pull Through Cache to speed up cross-region pulls
3. **Keep registry close**: Place the registry in the same region as the deployment target
4. **Lazy Loading**: Use containerd's nerdctl + stargz to start without pulling the entire image (Seekable OCI)
5. **Warm pool**: Pre-launch instances with ECS Capacity Provider warm pools

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just from theory but by actually writing code and confirming behavior.

### Q2: What mistakes do beginners often make?

Skipping the basics and jumping to advanced topics. We recommend solidly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It is especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|-----------|
| Multi-stage build | Include only build artifacts in the final image to minimize size and attack surface |
| Image tags | Use Git SHA or semantic version in production. Never use latest |
| ECS Fargate | AWS managed. Operate with task definitions + services. Low management overhead |
| Kubernetes | High flexibility. Auto-scale with HPA, manage permissions with RBAC |
| ArgoCD (GitOps) | Use Git repository as the source of truth and manage deployment state declaratively |
| Resource limits | Always configure requests/limits. Prevent OOMKill and node-wide impact |
| Kustomize | Manage environment differences with base + overlays. DRY manifest structure |
| Progressive Delivery | Safe canary deployments with Argo Rollouts + AnalysisTemplate |
| Security | Non-root execution, readOnlyRootFilesystem, NetworkPolicy, image scanning |
| Service mesh | Integrate mTLS, traffic control, and observability with Istio/Linkerd |

---

## Guides to Read Next

- [00-deployment-strategies.md](./00-deployment-strategies.md) — Deployment strategies such as Blue-Green and Canary
- [01-cloud-deployment.md](./01-cloud-deployment.md) — AWS/Vercel/Cloudflare Workers
- [03-release-management.md](./03-release-management.md) — Semantic versioning and release management

---

## References

1. **Docker Documentation - Multi-stage builds** — https://docs.docker.com/build/building/multi-stage/ — Official guide to multi-stage builds
2. **Amazon ECS Developer Guide** — https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ — Official ECS documentation
3. **ArgoCD Documentation** — https://argo-cd.readthedocs.io/ — Official documentation for the GitOps-based CD tool
4. **Kubernetes Best Practices** — Brendan Burns, Eddie Villalba, Dave Strebel, Lachlan Evenson (O'Reilly, 2019)
5. **Argo Rollouts Documentation** — https://argoproj.github.io/argo-rollouts/ — Official guide for Progressive Delivery
6. **Istio Documentation** — https://istio.io/latest/docs/ — Official documentation for the service mesh
7. **Kustomize Documentation** — https://kustomize.io/ — Kubernetes-native configuration management tool
8. **Trivy Documentation** — https://aquasecurity.github.io/trivy/ — Official documentation for the container vulnerability scanner

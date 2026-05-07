# Cloud Deployment

> Master practical deployment techniques for AWS, Vercel, and Cloudflare Workers, and select the optimal platform based on your project's characteristics

## What You Will Learn

1. **Deploying to AWS (ECS/Lambda/S3+CloudFront)** — Building production-grade cloud infrastructure and automating deployments with IaC
2. **Frontend Deployment with Vercel/Netlify** — Automated deployments via Git integration and leveraging preview environments
3. **Edge Deployment with Cloudflare Workers** — Serverless deployment taking advantage of edge computing characteristics
4. **Container Deployment with AWS ECS/Fargate** — Scalable application operations using Docker containers
5. **GCP Cloud Run / Firebase Hosting** — Efficient deployment using Google Cloud managed services
6. **Multi-Cloud Strategy** — Optimal architecture design combining multiple cloud providers


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Deployment Strategies](./00-deployment-strategies.md)

---

## 1. Cloud Deployment Overview

```
┌──────────────────────────────────────────────────────────┐
│               Cloud Deployment Options                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────┐  Full control / High flexibility   │
│  │   AWS / GCP     │  EC2, ECS, EKS, Lambda              │
│  │   Azure         │  Complex but can do anything        │
│  └────────┬────────┘                                     │
│           │                                              │
│  ┌────────▼────────┐  Frontend-focused / DX-first        │
│  │  Vercel         │  Next.js optimized, preview envs   │
│  │  Netlify        │  JAMstack, built-in forms/auth      │
│  └────────┬────────┘                                     │
│           │                                              │
│  ┌────────▼────────┐  Edge-focused / Ultra-low latency   │
│  │  Cloudflare     │  Workers, R2, KV, D1                 │
│  │  Workers        │  V8 Isolate based                    │
│  └─────────────────┘                                     │
└──────────────────────────────────────────────────────────┘
```

### 1.1 Platform Selection Decision Tree

```
Review project requirements
│
├── Frontend only (SSG/SSR)?
│   ├── Next.js → Vercel (optimized)
│   ├── Astro/Gatsby → Netlify or Cloudflare Pages
│   └── SPA (React/Vue) → S3+CloudFront or Cloudflare Pages
│
├── API backend needed?
│   ├── Request-driven (lightweight) → Lambda or Workers
│   ├── Always-on (WebSocket, etc.) → ECS/Fargate or Cloud Run
│   └── Stateful → ECS/EKS + EBS/EFS
│
├── Edge processing needed?
│   ├── A/B testing → Cloudflare Workers or Lambda@Edge
│   ├── Geographic routing → CloudFront Functions or Workers
│   └── Real-time transformation → Workers (Streams API)
│
└── Access to resources inside VPC needed?
    ├── RDS/ElastiCache → Lambda (VPC) or ECS
    └── On-premises integration → ECS + VPN/Direct Connect
```

### 1.2 Deployment Maturity Model

```
Level 0: Manual deployment
  └── Place files directly via FTP/SCP, operate by SSH into server

Level 1: Script-based
  └── Semi-automated with deployment scripts (shell scripts/Makefile)

Level 2: CI/CD pipeline
  └── Automated build & deploy with GitHub Actions/Jenkins

Level 3: IaC + GitOps
  └── Infrastructure defined with Terraform/CDK, deployments triggered by Git operations

Level 4: Progressive delivery
  └── Canary/Blue-Green + automated rollback + observability integration
```

---

## 2. AWS Deployment — S3 + CloudFront (Static Site)

### 2.1 Basic Deployment Workflow

```yaml
# GitHub Actions — S3 + CloudFront deployment
name: Deploy to AWS S3 + CloudFront

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install and Build
        run: |
          npm ci
          npm run build

      - name: Configure AWS Credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions-deploy
          aws-region: ap-northeast-1

      - name: Deploy to S3
        run: |
          aws s3 sync dist/ s3://my-app-bucket \
            --delete \
            --cache-control "public, max-age=31536000, immutable" \
            --exclude "index.html"

          # index.html should not be cached
          aws s3 cp dist/index.html s3://my-app-bucket/index.html \
            --cache-control "no-cache, no-store, must-revalidate"

      - name: Invalidate CloudFront Cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CF_DISTRIBUTION_ID }} \
            --paths "/index.html" "/sw.js"
```

### 2.2 S3 + CloudFront Infrastructure Definition with Terraform

```hcl
# terraform/modules/static-site/main.tf
# S3 bucket (for static site hosting)
resource "aws_s3_bucket" "site" {
  bucket = "${var.project_name}-${var.environment}-site"

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket_versioning" "site" {
  bucket = aws_s3_bucket.site.id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 bucket policy (allow access only from CloudFront OAC)
resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontOAC"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.site.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.site.arn
          }
        }
      }
    ]
  })
}

# CloudFront Origin Access Control
resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${var.project_name}-${var.environment}-oac"
  description                       = "OAC for ${var.project_name}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront distribution
resource "aws_cloudfront_distribution" "site" {
  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.site.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_200"  # North America + Europe + Asia

  aliases = var.domain_names

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.site.id}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    # Managed cache policy: CachingOptimized
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"

    # Response headers policy: SecurityHeadersPolicy
    response_headers_policy_id = "67f7725c-6f97-4210-82d7-5512b31e9d03"
  }

  # For SPA: fall back 404 to index.html
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# Route 53 record
resource "aws_route53_record" "site" {
  for_each = toset(var.domain_names)

  zone_id = var.hosted_zone_id
  name    = each.value
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

# Outputs
output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.site.id
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.site.domain_name
}

output "s3_bucket_name" {
  value = aws_s3_bucket.site.id
}
```

### 2.3 Advanced Cache Strategy

```yaml
# GitHub Actions — deployment with per-asset-type cache control
- name: Deploy with granular cache control
  run: |
    # JavaScript/CSS (hashed filenames): 1-year cache
    aws s3 sync dist/assets/ s3://$BUCKET/assets/ \
      --delete \
      --cache-control "public, max-age=31536000, immutable" \
      --content-encoding gzip

    # Image files: 1-month cache
    aws s3 sync dist/images/ s3://$BUCKET/images/ \
      --delete \
      --cache-control "public, max-age=2592000"

    # Font files: 1-year cache (with CORS headers)
    aws s3 sync dist/fonts/ s3://$BUCKET/fonts/ \
      --delete \
      --cache-control "public, max-age=31536000, immutable" \
      --content-type "font/woff2"

    # HTML files: no cache (always fetch latest)
    find dist/ -name "*.html" -exec \
      aws s3 cp {} s3://$BUCKET/{} \
        --cache-control "no-cache, no-store, must-revalidate" \;

    # Service Worker: no cache
    aws s3 cp dist/sw.js s3://$BUCKET/sw.js \
      --cache-control "no-cache, no-store, must-revalidate"

    # manifest.json: short-term cache
    aws s3 cp dist/manifest.json s3://$BUCKET/manifest.json \
      --cache-control "public, max-age=3600"
```

---

## 3. AWS Lambda Deployment (SAM)

### 3.1 SAM Template

```yaml
# template.yaml — AWS SAM template
AWSTemplateFormatVersion: "2010-09-09"
Transform: AWS::Serverless-2016-10-31
Description: API Backend on Lambda

Globals:
  Function:
    Timeout: 30
    Runtime: nodejs20.x
    MemorySize: 256
    Environment:
      Variables:
        NODE_ENV: production
        DB_HOST: !Ref DatabaseHost

Resources:
  ApiFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: dist/lambda.handler
      CodeUri: .
      Events:
        Api:
          Type: HttpApi
          Properties:
            Path: /{proxy+}
            Method: ANY
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref AppTable
      AutoPublishAlias: live
      DeploymentPreference:
        Type: Canary10Percent5Minutes  # Canary deployment
        Alarms:
          - !Ref ApiErrorAlarm

  AppTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: app-data
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: pk
          AttributeType: S
        - AttributeName: sk
          AttributeType: S
      KeySchema:
        - AttributeName: pk
          KeyType: HASH
        - AttributeName: sk
          KeyType: RANGE

  ApiErrorAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      MetricName: 5XXError
      Namespace: AWS/ApiGateway
      Statistic: Sum
      Period: 60
      EvaluationPeriods: 1
      Threshold: 5
      ComparisonOperator: GreaterThanThreshold
```

### 3.2 SAM Deploy GitHub Actions Workflow

```yaml
# .github/workflows/deploy-sam.yml
name: Deploy SAM Application

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - 'template.yaml'
      - '.github/workflows/deploy-sam.yml'

concurrency:
  group: deploy-sam-${{ github.ref }}
  cancel-in-progress: false  # Do not cancel deployments mid-flight

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    environment:
      name: production
      url: ${{ steps.deploy.outputs.api_url }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install and Build
        run: |
          npm ci
          npm run build

      - name: Setup SAM CLI
        uses: aws-actions/setup-sam@v2
        with:
          use-installer: true

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ap-northeast-1

      - name: SAM Build
        run: sam build --use-container

      - name: SAM Deploy
        id: deploy
        run: |
          sam deploy \
            --stack-name my-app-prod \
            --s3-bucket ${{ secrets.SAM_ARTIFACT_BUCKET }} \
            --capabilities CAPABILITY_IAM \
            --no-confirm-changeset \
            --no-fail-on-empty-changeset \
            --parameter-overrides \
              Environment=production \
              DatabaseHost=${{ secrets.DB_HOST }}

          # Get API URL after deployment
          API_URL=$(aws cloudformation describe-stacks \
            --stack-name my-app-prod \
            --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
            --output text)
          echo "api_url=${API_URL}" >> "$GITHUB_OUTPUT"

      - name: Smoke Test
        run: |
          API_URL="${{ steps.deploy.outputs.api_url }}"
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/health")
          if [ "$STATUS" != "200" ]; then
            echo "Smoke test failed with status: $STATUS"
            exit 1
          fi
          echo "Smoke test passed: ${API_URL}/health returned 200"
```

### 3.3 Using Lambda Layers

```yaml
# template.yaml — Separating dependencies with Lambda Layers
Resources:
  SharedDependenciesLayer:
    Type: AWS::Serverless::LayerVersion
    Properties:
      LayerName: shared-dependencies
      Description: Shared npm dependencies
      ContentUri: layers/shared/
      CompatibleRuntimes:
        - nodejs20.x
      RetentionPolicy: Retain
    Metadata:
      BuildMethod: nodejs20.x

  ApiFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: dist/api.handler
      Layers:
        - !Ref SharedDependenciesLayer
      # ...

  WorkerFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: dist/worker.handler
      Layers:
        - !Ref SharedDependenciesLayer
      Events:
        SQSEvent:
          Type: SQS
          Properties:
            Queue: !GetAtt TaskQueue.Arn
            BatchSize: 10
            MaximumBatchingWindowInSeconds: 5
```

---

## 4. AWS ECS/Fargate Deployment

### 4.1 ECS Task Definition and GitHub Actions Workflow

```yaml
# .github/workflows/deploy-ecs.yml
name: Deploy to ECS Fargate

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'Dockerfile'
      - '.github/workflows/deploy-ecs.yml'

env:
  AWS_REGION: ap-northeast-1
  ECR_REPOSITORY: my-app
  ECS_CLUSTER: my-app-cluster
  ECS_SERVICE: my-app-service
  TASK_DEFINITION: .aws/task-definition.json
  CONTAINER_NAME: my-app

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push Docker image
        id: build-image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build \
            --build-arg BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
            --build-arg GIT_SHA=${{ github.sha }} \
            -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG \
            -t $ECR_REGISTRY/$ECR_REPOSITORY:latest \
            .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> "$GITHUB_OUTPUT"

      - name: Download current task definition
        run: |
          aws ecs describe-task-definition \
            --task-definition ${{ env.ECS_SERVICE }} \
            --query 'taskDefinition' \
            --output json > task-definition.json

      - name: Update task definition with new image
        id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: task-definition.json
          container-name: ${{ env.CONTAINER_NAME }}
          image: ${{ steps.build-image.outputs.image }}

      - name: Deploy to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: ${{ steps.task-def.outputs.task-definition }}
          service: ${{ env.ECS_SERVICE }}
          cluster: ${{ env.ECS_CLUSTER }}
          wait-for-service-stability: true
          wait-for-minutes: 10

      - name: Verify deployment
        run: |
          RUNNING_TASKS=$(aws ecs list-tasks \
            --cluster $ECS_CLUSTER \
            --service-name $ECS_SERVICE \
            --desired-status RUNNING \
            --query 'taskArns | length(@)')
          echo "Running tasks: $RUNNING_TASKS"

          TASK_ARN=$(aws ecs list-tasks \
            --cluster $ECS_CLUSTER \
            --service-name $ECS_SERVICE \
            --desired-status RUNNING \
            --query 'taskArns[0]' \
            --output text)

          TASK_IMAGE=$(aws ecs describe-tasks \
            --cluster $ECS_CLUSTER \
            --tasks $TASK_ARN \
            --query "tasks[0].containers[?name=='$CONTAINER_NAME'].image" \
            --output text)

          echo "Deployed image: $TASK_IMAGE"
          echo "Expected image: ${{ steps.build-image.outputs.image }}"

          if [ "$TASK_IMAGE" != "${{ steps.build-image.outputs.image }}" ]; then
            echo "Image mismatch! Deployment verification failed."
            exit 1
          fi
```

### 4.2 ECS Task Definition (Terraform)

```hcl
# terraform/modules/ecs-service/main.tf
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}"

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

resource "aws_ecs_task_definition" "app" {
  family                   = "${var.project_name}-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = var.container_name
      image = "${var.ecr_repository_url}:latest"
      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "NODE_ENV", value = var.environment },
        { name = "PORT", value = tostring(var.container_port) },
      ]
      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "${var.secrets_arn}:DATABASE_URL::"
        },
        {
          name      = "API_KEY"
          valueFrom = "${var.secrets_arn}:API_KEY::"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:${var.container_port}/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])
}

resource "aws_ecs_service" "app" {
  name            = "${var.project_name}-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = 60

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = var.container_name
    container_port   = var.container_port
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true  # Automatic rollback on deployment failure
  }

  lifecycle {
    ignore_changes = [task_definition]  # Updated by CI/CD
  }
}

# Auto Scaling
resource "aws_appautoscaling_target" "ecs" {
  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.app.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "${var.project_name}-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
```

---

## 5. Vercel Deployment

### 5.1 Vercel Configuration

```json
// vercel.json — Vercel configuration
{
  "framework": "nextjs",
  "regions": ["nrt1"],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "s-maxage=0, stale-while-revalidate=60" }
      ]
    },
    {
      "source": "/(.*\\.(?:js|css|woff2|png|jpg|svg))",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" },
    { "source": "/(.*)", "destination": "/" }
  ],
  "env": {
    "DATABASE_URL": "@database-url",
    "NEXT_PUBLIC_API_URL": "https://api.example.com"
  }
}
```

```
Vercel deployment flow:

  Developer               Vercel                     CDN
    │                      │                          │
    │── git push ──────►   │                          │
    │                      │── Build starts            │
    │                      │   (Next.js auto-detected) │
    │                      │                          │
    │                      │── Preview URL generated  │
    │   ◄── PR comment ─── │   (*.vercel.app)         │
    │                      │                          │
    │── PR merge ────►      │                          │
    │                      │── Production build        │
    │                      │── Edge Network delivery ►│
    │                      │                          │
    │                      │   Serverless Functions   │
    │                      │   Edge Functions         │
    │                      │   ISR / SSG              │
    │                      │                          │
```

### 5.2 Vercel + GitHub Actions Integration (Custom Pipeline)

```yaml
# .github/workflows/deploy-vercel.yml
name: Deploy to Vercel with Custom Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm test -- --coverage

  lighthouse:
    needs: test
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci

      - name: Pull Vercel Preview
        run: |
          npx vercel pull --yes --environment=preview --token=${{ secrets.VERCEL_TOKEN }}
          npx vercel build --token=${{ secrets.VERCEL_TOKEN }}
          PREVIEW_URL=$(npx vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }})
          echo "PREVIEW_URL=${PREVIEW_URL}" >> "$GITHUB_ENV"

      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v12
        with:
          urls: |
            ${{ env.PREVIEW_URL }}
            ${{ env.PREVIEW_URL }}/about
          budgetPath: ./lighthouse-budget.json
          uploadArtifacts: true

  deploy-production:
    needs: test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    environment:
      name: production
      url: ${{ steps.deploy.outputs.url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci

      - name: Pull Vercel Environment
        run: npx vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}

      - name: Build
        run: npx vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}

      - name: Deploy to Production
        id: deploy
        run: |
          URL=$(npx vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }})
          echo "url=${URL}" >> "$GITHUB_OUTPUT"
          echo "Deployed to: ${URL}"

      - name: Verify Deployment
        run: |
          sleep 10  # Wait for Edge Network propagation
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${{ steps.deploy.outputs.url }}")
          if [ "$STATUS" != "200" ]; then
            echo "Deployment verification failed: HTTP $STATUS"
            exit 1
          fi
```

### 5.3 Vercel Edge Functions

```typescript
// app/api/geo/route.ts — Vercel Edge Function
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const preferredRegion = ['nrt1', 'iad1'];  // Tokyo + Virginia

export async function GET(request: NextRequest) {
  const geo = request.geo;
  const ip = request.ip;

  // Edge response based on geographic information
  const response = {
    country: geo?.country ?? 'unknown',
    city: geo?.city ?? 'unknown',
    region: geo?.region ?? 'unknown',
    latitude: geo?.latitude,
    longitude: geo?.longitude,
    ip: ip,
    timestamp: new Date().toISOString(),
    edge_region: process.env.VERCEL_REGION,
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
    },
  });
}
```

```typescript
// middleware.ts — Vercel Edge Middleware (applied to all requests)
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const country = request.geo?.country;

  // Region-based redirect
  if (country === 'JP' && !url.pathname.startsWith('/ja')) {
    url.pathname = `/ja${url.pathname}`;
    return NextResponse.redirect(url);
  }

  // A/B testing: cookie-based bucket assignment
  const bucket = request.cookies.get('ab-bucket')?.value;
  if (!bucket) {
    const newBucket = Math.random() < 0.5 ? 'control' : 'variant';
    const response = NextResponse.next();
    response.cookies.set('ab-bucket', newBucket, {
      maxAge: 60 * 60 * 24 * 30,  // 30 days
      httpOnly: true,
      sameSite: 'lax',
    });
    return response;
  }

  // Rate limit headers
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', '100');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

## 6. Cloudflare Workers Deployment

### 6.1 Worker Implementation

```typescript
// src/worker.ts — Cloudflare Worker
export interface Env {
  KV_STORE: KVNamespace;
  DB: D1Database;
  R2_BUCKET: R2Bucket;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // Routing
    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, ctx);
    }

    // Serve static assets from R2
    const asset = await env.R2_BUCKET.get(url.pathname.slice(1));
    if (asset) {
      const headers = new Headers();
      headers.set('Content-Type', asset.httpMetadata?.contentType ?? 'application/octet-stream');
      headers.set('Cache-Control', 'public, max-age=86400');
      return new Response(asset.body, { headers });
    }

    return new Response('Not Found', { status: 404 });
  },
};

async function handleApi(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === '/api/items' && request.method === 'GET') {
    // D1 database query
    const { results } = await env.DB
      .prepare('SELECT * FROM items ORDER BY created_at DESC LIMIT 50')
      .all();

    return Response.json(results);
  }

  if (url.pathname === '/api/items' && request.method === 'POST') {
    const body = await request.json<{ name: string; value: string }>();

    await env.DB
      .prepare('INSERT INTO items (name, value) VALUES (?, ?)')
      .bind(body.name, body.value)
      .run();

    // Invalidate KV cache
    ctx.waitUntil(env.KV_STORE.delete('items-cache'));

    return Response.json({ success: true }, { status: 201 });
  }

  return Response.json({ error: 'Not Found' }, { status: 404 });
}
```

### 6.2 Wrangler Configuration

```toml
# wrangler.toml — Cloudflare Workers configuration
name = "my-api"
main = "src/worker.ts"
compatibility_date = "2024-09-25"

[placement]
mode = "smart"  # Smart placement for latency optimization

binding = "KV_STORE"
id = "abc123"

binding = "DB"
database_name = "my-app-db"
database_id = "def456"

binding = "R2_BUCKET"
bucket_name = "my-assets"

[env.production]
routes = [
  { pattern = "api.example.com/*", zone_name = "example.com" }
]
```

### 6.3 Cloudflare Workers GitHub Actions Deployment

```yaml
# .github/workflows/deploy-workers.yml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'wrangler.toml'
      - '.github/workflows/deploy-workers.yml'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test

      # Local integration test with Miniflare
      - name: Integration Test with Miniflare
        run: |
          npx wrangler dev --local --port 8787 &
          sleep 3

          # Health check
          curl -f http://localhost:8787/api/health

          # API test
          RESPONSE=$(curl -s -X POST http://localhost:8787/api/items \
            -H 'Content-Type: application/json' \
            -d '{"name":"test","value":"data"}')
          echo "$RESPONSE" | jq -e '.success == true'

          kill %1

  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci

      - name: Deploy to Staging
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          command: deploy --env staging

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://api.example.com
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci

      - name: Deploy to Production
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          command: deploy --env production

      - name: Smoke Test
        run: |
          sleep 5
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.example.com/api/health)
          if [ "$STATUS" != "200" ]; then
            echo "Smoke test failed: HTTP $STATUS"
            exit 1
          fi
          echo "Smoke test passed"
```

### 6.4 Stateful Worker with Durable Objects

```typescript
// src/counter.ts — Durable Object (stateful edge processing)
export class Counter {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/increment': {
        let count = (await this.state.storage.get<number>('count')) ?? 0;
        count += 1;
        await this.state.storage.put('count', count);
        return Response.json({ count });
      }
      case '/get': {
        const count = (await this.state.storage.get<number>('count')) ?? 0;
        return Response.json({ count });
      }
      case '/reset': {
        await this.state.storage.put('count', 0);
        return Response.json({ count: 0 });
      }
      default:
        return new Response('Not Found', { status: 404 });
    }
  }
}

// Calling a Durable Object from a Worker
async function handleCounter(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const counterId = url.searchParams.get('id') ?? 'default';

  // Get the Durable Object stub
  const id = env.COUNTER.idFromName(counterId);
  const stub = env.COUNTER.get(id);

  // Forward the request to the Durable Object
  return stub.fetch(request);
}
```

### 6.5 Cloudflare Pages + Functions

```typescript
import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/api/posts', async (c) => {
  const { results } = await c.env.DB
    .prepare('SELECT * FROM posts ORDER BY created_at DESC LIMIT 20')
    .all();
  return c.json(results);
});

app.get('/api/posts/:id', async (c) => {
  const id = c.req.param('id');

  // Check KV cache
  const cached = await c.env.KV.get(`post:${id}`, 'json');
  if (cached) {
    return c.json(cached);
  }

  const post = await c.env.DB
    .prepare('SELECT * FROM posts WHERE id = ?')
    .bind(id)
    .first();

  if (!post) {
    return c.json({ error: 'Not Found' }, 404);
  }

  // Cache in KV (60-second TTL)
  c.executionCtx.waitUntil(
    c.env.KV.put(`post:${id}`, JSON.stringify(post), { expirationTtl: 60 })
  );

  return c.json(post);
});

app.post('/api/posts', async (c) => {
  const body = await c.req.json<{ title: string; content: string }>();

  const result = await c.env.DB
    .prepare('INSERT INTO posts (title, content) VALUES (?, ?) RETURNING *')
    .bind(body.title, body.content)
    .first();

  return c.json(result, 201);
});

export const onRequest = app.fetch;
```

---

## 7. GCP Cloud Run Deployment

### 7.1 Cloud Run GitHub Actions Workflow

```yaml
# .github/workflows/deploy-cloud-run.yml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]

env:
  PROJECT_ID: my-project-id
  REGION: asia-northeast1
  SERVICE_NAME: my-app
  IMAGE_NAME: asia-northeast1-docker.pkg.dev/my-project-id/my-repo/my-app

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud (OIDC)
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker asia-northeast1-docker.pkg.dev

      - name: Build and Push Docker image
        run: |
          docker build \
            --build-arg GIT_SHA=${{ github.sha }} \
            -t $IMAGE_NAME:${{ github.sha }} \
            -t $IMAGE_NAME:latest \
            .
          docker push $IMAGE_NAME:${{ github.sha }}
          docker push $IMAGE_NAME:latest

      - name: Deploy to Cloud Run
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: ${{ env.SERVICE_NAME }}
          region: ${{ env.REGION }}
          image: ${{ env.IMAGE_NAME }}:${{ github.sha }}
          flags: |
            --memory=512Mi
            --cpu=1
            --min-instances=0
            --max-instances=10
            --concurrency=80
            --timeout=300
            --port=8080
            --cpu-throttling
            --session-affinity
          env_vars: |
            NODE_ENV=production
            GIT_SHA=${{ github.sha }}
          secrets: |
            DATABASE_URL=database-url:latest
            API_KEY=api-key:latest

      - name: Set traffic to new revision
        run: |
          # Gradual traffic migration (Canary)
          gcloud run services update-traffic $SERVICE_NAME \
            --region=$REGION \
            --to-revisions=LATEST=10

          # Health check
          sleep 30
          SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
            --region=$REGION \
            --format='value(status.url)')
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL/health")

          if [ "$STATUS" = "200" ]; then
            echo "Health check passed. Routing 100% traffic to new revision."
            gcloud run services update-traffic $SERVICE_NAME \
              --region=$REGION \
              --to-revisions=LATEST=100
          else
            echo "Health check failed. Rolling back."
            gcloud run services update-traffic $SERVICE_NAME \
              --region=$REGION \
              --to-revisions=LATEST=0
            exit 1
          fi
```

### 7.2 Firebase Hosting + Cloud Functions

```yaml
# .github/workflows/deploy-firebase.yml
name: Deploy to Firebase

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: |
          npm ci
          cd functions && npm ci

      - name: Build
        run: |
          npm run build
          cd functions && npm run build

      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live  # Production channel
          projectId: my-project-id
```

```json
// firebase.json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/api/**",
        "function": "api"
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "/**/*.@(js|css|woff2)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "/",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache"
          }
        ]
      }
    ]
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs20",
    "predeploy": ["npm --prefix functions run build"]
  }
}
```

---

## 8. Multi-Cloud / Hybrid Deployment

### 8.1 Frontend + Backend Separation Pattern

```yaml
# .github/workflows/deploy-multi.yml
name: Multi-Cloud Deploy

on:
  push:
    branches: [main]

jobs:
  # Deploy frontend to Vercel
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci && npm run build:frontend

      - name: Deploy Frontend to Vercel
        run: |
          npx vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
          npx vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
          npx vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}

  # Deploy backend to AWS ECS
  deploy-backend:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ap-northeast-1

      - name: Login to ECR
        id: ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and Push
        run: |
          docker build -f backend/Dockerfile \
            -t ${{ steps.ecr.outputs.registry }}/api:${{ github.sha }} \
            .
          docker push ${{ steps.ecr.outputs.registry }}/api:${{ github.sha }}

      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster prod-cluster \
            --service api-service \
            --force-new-deployment

  # Deploy edge processing to Cloudflare Workers
  deploy-edge:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: cd edge && npm ci

      - name: Deploy Edge Functions
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          workingDirectory: edge
          command: deploy

  # Integration tests after all deployments complete
  integration-test:
    needs: [deploy-frontend, deploy-backend, deploy-edge]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci

      - name: Run E2E Tests
        run: |
          npx playwright test --project=production
        env:
          FRONTEND_URL: https://app.example.com
          API_URL: https://api.example.com
          EDGE_URL: https://edge.example.com
```

### 8.2 DNS-Based Failover

```hcl
# terraform/dns-failover.tf
# Route 53 health checks
resource "aws_route53_health_check" "primary" {
  fqdn              = "api-primary.example.com"
  port               = 443
  type               = "HTTPS"
  resource_path      = "/health"
  failure_threshold  = 3
  request_interval   = 10

  tags = {
    Name = "primary-api-health-check"
  }
}

resource "aws_route53_health_check" "secondary" {
  fqdn              = "api-secondary.example.com"
  port               = 443
  type               = "HTTPS"
  resource_path      = "/health"
  failure_threshold  = 3
  request_interval   = 10

  tags = {
    Name = "secondary-api-health-check"
  }
}

# Failover records
resource "aws_route53_record" "primary" {
  zone_id = var.hosted_zone_id
  name    = "api.example.com"
  type    = "A"

  alias {
    name                   = var.primary_alb_dns
    zone_id                = var.primary_alb_zone_id
    evaluate_target_health = true
  }

  failover_routing_policy {
    type = "PRIMARY"
  }

  health_check_id = aws_route53_health_check.primary.id
  set_identifier  = "primary"
}

resource "aws_route53_record" "secondary" {
  zone_id = var.hosted_zone_id
  name    = "api.example.com"
  type    = "A"

  alias {
    name                   = var.secondary_alb_dns
    zone_id                = var.secondary_alb_zone_id
    evaluate_target_health = true
  }

  failover_routing_policy {
    type = "SECONDARY"
  }

  health_check_id = aws_route53_health_check.secondary.id
  set_identifier  = "secondary"
}
```

---

## 9. Environment Management and Secrets

### 9.1 Deployment Protection with GitHub Environments

```yaml
# .github/workflows/deploy-with-environments.yml
name: Deploy with Environment Protection

on:
  push:
    branches: [main]

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.example.com
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Staging
        run: echo "Deploying to staging..."

  # Manual approval gate (configured via environment protection rules)
  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://www.example.com
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Production
        run: echo "Deploying to production..."
```

### 9.2 Secrets Management Best Practices

```yaml
# Retrieve secrets from AWS Secrets Manager
- name: Get Secrets from AWS Secrets Manager
  uses: aws-actions/aws-secretsmanager-get-secrets@v2
  with:
    secret-ids: |
      prod/database
      prod/api-keys
    parse-json-secrets: true

# Usage example
- name: Use Secrets
  run: |
    echo "Database host: $PROD_DATABASE_HOST"  # Automatically expanded as environment variables
  env:
    # Secrets Manager secrets are available as environment variables
    DB_URL: ${{ env.PROD_DATABASE_URL }}
```

```typescript
// Secrets management utility (TypeScript)
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'ap-northeast-1' });

interface AppSecrets {
  DATABASE_URL: string;
  API_KEY: string;
  JWT_SECRET: string;
}

// Cached secret retrieval
let cachedSecrets: AppSecrets | null = null;
let cacheExpiry = 0;

export async function getSecrets(): Promise<AppSecrets> {
  const now = Date.now();
  if (cachedSecrets && now < cacheExpiry) {
    return cachedSecrets;
  }

  const command = new GetSecretValueCommand({
    SecretId: 'prod/app-secrets',
    VersionStage: 'AWSCURRENT',
  });

  const response = await client.send(command);
  if (!response.SecretString) {
    throw new Error('Secret value is empty');
  }

  cachedSecrets = JSON.parse(response.SecretString) as AppSecrets;
  cacheExpiry = now + 5 * 60 * 1000; // 5-minute cache

  return cachedSecrets;
}
```

---

## 10. Monitoring and Rollback

### 10.1 Automated Post-Deploy Monitoring Workflow

```yaml
# .github/workflows/post-deploy-monitor.yml
name: Post-Deploy Monitoring

on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
      url:
        required: true
        type: string
      rollback_ref:
        required: true
        type: string

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Health Check Loop
        id: health
        run: |
          URL="${{ inputs.url }}"
          MAX_RETRIES=10
          RETRY_INTERVAL=30
          SUCCESS_COUNT=0
          REQUIRED_SUCCESSES=5

          for i in $(seq 1 $MAX_RETRIES); do
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL/health" --max-time 10)
            LATENCY=$(curl -s -o /dev/null -w "%{time_total}" "$URL/health" --max-time 10)

            echo "Check $i/$MAX_RETRIES: HTTP $STATUS, Latency: ${LATENCY}s"

            if [ "$STATUS" = "200" ] && [ "$(echo "$LATENCY < 2.0" | bc)" = "1" ]; then
              SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
              echo "Success count: $SUCCESS_COUNT/$REQUIRED_SUCCESSES"
            else
              SUCCESS_COUNT=0
              echo "Reset success count due to failure"
            fi

            if [ "$SUCCESS_COUNT" -ge "$REQUIRED_SUCCESSES" ]; then
              echo "Health check passed consistently"
              echo "healthy=true" >> "$GITHUB_OUTPUT"
              exit 0
            fi

            sleep $RETRY_INTERVAL
          done

          echo "Health check failed after $MAX_RETRIES attempts"
          echo "healthy=false" >> "$GITHUB_OUTPUT"

      - name: Check Error Rate
        if: steps.health.outputs.healthy == 'true'
        id: error-rate
        run: |
          # Retrieve error rate from CloudWatch
          ERROR_RATE=$(aws cloudwatch get-metric-statistics \
            --namespace "AWS/ApplicationELB" \
            --metric-name "HTTPCode_Target_5XX_Count" \
            --dimensions Name=LoadBalancer,Value=${{ secrets.ALB_ARN_SUFFIX }} \
            --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
            --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
            --period 300 \
            --statistics Sum \
            --query 'Datapoints[0].Sum' \
            --output text)

          echo "5xx error count in last 5 minutes: $ERROR_RATE"

          if [ "$ERROR_RATE" != "None" ] && [ "$ERROR_RATE" -gt 10 ]; then
            echo "Error rate too high: $ERROR_RATE"
            echo "acceptable=false" >> "$GITHUB_OUTPUT"
          else
            echo "Error rate acceptable"
            echo "acceptable=true" >> "$GITHUB_OUTPUT"
          fi

      - name: Trigger Rollback
        if: steps.health.outputs.healthy == 'false' || steps.error-rate.outputs.acceptable == 'false'
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.actions.createWorkflowDispatch({
              owner: context.repo.owner,
              repo: context.repo.repo,
              workflow_id: 'rollback.yml',
              ref: 'main',
              inputs: {
                environment: '${{ inputs.environment }}',
                rollback_ref: '${{ inputs.rollback_ref }}',
                reason: 'Automated rollback: health check or error rate threshold exceeded'
              }
            });

      - name: Notify on Slack
        if: always()
        uses: slackapi/slack-github-action@v2.0.0
        with:
          webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
          webhook-type: incoming-webhook
          payload: |
            {
              "text": "Deploy Monitor: ${{ inputs.environment }}",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Deploy Monitoring Result*\n• Environment: `${{ inputs.environment }}`\n• URL: ${{ inputs.url }}\n• Health: ${{ steps.health.outputs.healthy == 'true' && 'PASS' || 'FAIL' }}\n• Error Rate: ${{ steps.error-rate.outputs.acceptable == 'true' && 'OK' || 'HIGH' }}"
                  }
                }
              ]
            }
```

### 10.2 Rollback Workflow

```yaml
# .github/workflows/rollback.yml
name: Rollback Deployment

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: choice
        options:
          - staging
          - production
      rollback_ref:
        description: 'Git ref to rollback to (commit SHA or tag)'
        required: true
        type: string
      reason:
        description: 'Reason for rollback'
        required: true
        type: string

jobs:
  rollback:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.rollback_ref }}

      - name: Log Rollback Initiation
        run: |
          echo "========================================="
          echo "ROLLBACK INITIATED"
          echo "Environment: ${{ inputs.environment }}"
          echo "Rolling back to: ${{ inputs.rollback_ref }}"
          echo "Reason: ${{ inputs.reason }}"
          echo "Initiated by: ${{ github.actor }}"
          echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
          echo "========================================="

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ap-northeast-1

      - name: Rollback ECS Service
        if: inputs.environment == 'production'
        run: |
          # Get the previous stable task definition
          PREVIOUS_TD=$(aws ecs describe-services \
            --cluster prod-cluster \
            --services api-service \
            --query 'services[0].deployments[?status==`ACTIVE`].taskDefinition | [0]' \
            --output text)

          if [ "$PREVIOUS_TD" = "None" ]; then
            echo "No previous task definition found. Using image from rollback ref."
            # Rebuild and deploy Docker image from the Git ref
            # ...
          else
            echo "Rolling back to task definition: $PREVIOUS_TD"
            aws ecs update-service \
              --cluster prod-cluster \
              --service api-service \
              --task-definition "$PREVIOUS_TD" \
              --force-new-deployment

            aws ecs wait services-stable \
              --cluster prod-cluster \
              --services api-service
          fi

      - name: Verify Rollback
        run: |
          sleep 30
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://api.example.com/health")
          if [ "$STATUS" = "200" ]; then
            echo "Rollback verified successfully"
          else
            echo "WARNING: Rollback verification failed with HTTP $STATUS"
            exit 1
          fi

      - name: Create Rollback Record
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `[Rollback] ${context.payload.inputs.environment} - ${new Date().toISOString().split('T')[0]}`,
              body: [
                '## Rollback Record',
                '',
                `- **Environment**: ${context.payload.inputs.environment}`,
                `- **Rolled back to**: ${context.payload.inputs.rollback_ref}`,
                `- **Reason**: ${context.payload.inputs.reason}`,
                `- **Initiated by**: ${context.actor}`,
                `- **Timestamp**: ${new Date().toISOString()}`,
              ].join('\n'),
              labels: ['rollback', 'incident']
            });
```

---

## 11. Platform Comparison

| Feature | AWS (Lambda/ECS) | Vercel | Cloudflare Workers | GCP Cloud Run |
|---------|------------------|--------|-------------------|---------------|
| Target use case | General backend | Frontend + API | Edge API | General containers |
| Cold start | 100ms to several seconds | Tens of ms | Near 0ms (V8 Isolate) | Hundreds of ms to seconds |
| Max execution time | 15 min (Lambda) | 10 sec to 5 min | 30 sec (CPU 50ms) | 60 min |
| Memory limit | 10GB (Lambda) | 1024MB | 128MB | 32GB |
| Runtime | Node.js, Python, Go, etc. | Node.js | JavaScript/WASM | Any (Docker) |
| DB integration | RDS, DynamoDB, Aurora | Vercel Postgres, KV | D1, KV, Durable Objects | Cloud SQL, Firestore |
| Pricing model | Pay-per-use (complex) | Free tier + pay-per-use | Free tier 100k req/day | Pay-per-use (per second) |
| Learning curve | High | Low | Medium | Medium |
| VPC connectivity | Native support | Not supported | Via Tunnel | VPC connector |
| Custom domain | Route 53 | Auto SSL | Auto SSL | Cloud DNS |
| Rollback | Manual/automated | Instant Rollback | Wrangler rollback | Revision switching |

| Deployment method comparison | Git integration | CLI | IaC (CDK/Terraform) |
|-----------------------------|----------------|-----|---------------------|
| Automation level | High | Medium | Highest |
| Reproducibility | Medium | Low | Highest |
| Complexity | Low | Low | High |
| Applicable scenarios | Frontend / small-scale API | Development/testing | Production infrastructure |
| Rollback | Git revert | Manual | Automated via state management |

### Cost Comparison Simulation

```
For an API with 1 million requests/month and average response time of 50ms:

AWS Lambda:
  - Requests: $0.20 (1M × $0.0000002)
  - Compute: $0.83 (128MB, 50ms × 1M)
  - API Gateway: $3.50
  - Total: approx. $4.53/month

Cloudflare Workers:
  - Free tier: 100k req/day = 3M req/month → Free
  - Paid plan ($5/month): includes 10M req → $5.00/month
  - Total: $0–5.00/month

Vercel:
  - Hobby (free): up to 100GB bandwidth → $0
  - Pro ($20/month): 1TB bandwidth, 1000 serverless hours → $20/month
  - Total: $0–20.00/month

GCP Cloud Run:
  - CPU: $0.00002400/vCPU-sec × 50,000 sec = $1.20
  - Memory: $0.00000250/GiB-sec × 50,000 sec × 0.5GiB = $0.06
  - Requests: $0.40 (1M × $0.0000004)
  - Total: approx. $1.66/month (with minimum instances set to 0)
```

---

## 12. Anti-Patterns

### Anti-Pattern 1: Hardcoding Environment-Specific Values

```typescript
// Bad: embedding environment-specific values in code
const API_URL = "https://prod-api.example.com";
const DB_HOST = "prod-db.cluster-abc.ap-northeast-1.rds.amazonaws.com";

// Good: retrieve from environment variables
const API_URL = process.env.API_URL;
const DB_HOST = process.env.DB_HOST;

// Even better: type-safe configuration management
import { z } from "zod";

const envSchema = z.object({
  API_URL: z.string().url(),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().default(5432),
  NODE_ENV: z.enum(["development", "staging", "production"]),
});

export const config = envSchema.parse(process.env);
```

### Anti-Pattern 2: Lack of Cache Strategy

```
[Bad]
- No Cache-Control on any assets → CDN is ineffective, every request hits the origin
- Long-term cache on index.html → new versions are not delivered
- No cache on API responses → unnecessary increase in Lambda/Worker invocations

[Good]
- Static assets (JS/CSS/images): Cache-Control: public, max-age=31536000, immutable
  (include a hash in the filename: app.a1b2c3.js)
- index.html: Cache-Control: no-cache (validate every time)
- API: Cache-Control: s-maxage=60, stale-while-revalidate=300
  (CDN caches for 60 seconds, returns stale response for up to 300 seconds in the background)
```

### Anti-Pattern 3: No Post-Deploy Health Check

```yaml
# Bad: deploy and done
- name: Deploy
  run: npx vercel deploy --prod
# → No verification that the app is working correctly after deployment

# Good: run a health check after deployment
- name: Deploy
  id: deploy
  run: |
    URL=$(npx vercel deploy --prod)
    echo "url=${URL}" >> "$GITHUB_OUTPUT"

- name: Health Check
  run: |
    URL="${{ steps.deploy.outputs.url }}"
    for i in $(seq 1 5); do
      STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${URL}/api/health" --max-time 10)
      if [ "$STATUS" = "200" ]; then
        echo "Health check passed on attempt $i"
        exit 0
      fi
      echo "Attempt $i failed (HTTP $STATUS), retrying in 10s..."
      sleep 10
    done
    echo "Health check failed after 5 attempts"
    exit 1
```

### Anti-Pattern 4: Single-Region Dependency

```
[Bad]
- All resources placed only in ap-northeast-1 (Tokyo)
- Complete service outage when the Tokyo region goes down

[Good]
- Distribute static content globally via CloudFront / Cloudflare
- Deploy critical APIs to multiple regions
- Configure Route 53 health check-based failover
- Use Aurora Global Database or read replicas for the database
```

### Anti-Pattern 5: Non-Reproducible Build Artifacts

```yaml
# Bad: builds may produce different results each time
- run: |
    npm install  # ignores package-lock.json
    npm run build

# Good: reproducible builds
- run: |
    npm ci                     # strictly follows the lock file
    npm run build
  env:
    NODE_ENV: production
    NEXT_TELEMETRY_DISABLED: 1  # disable telemetry for deterministic builds
```

---

## 13. FAQ

### Q1: Should I choose Vercel or AWS?

If your project is frontend-focused (Next.js/React) with only lightweight API Routes on the backend, Vercel is far easier. Choose AWS when you need complex backend processing, access to resources inside a VPC, or long-running batch jobs. For many projects, the combination of "Vercel for the frontend, AWS for the backend" is the most practical approach.

### Q2: Isn't the Cloudflare Workers CPU limit (50ms) too restrictive?

The 50ms CPU time refers to "pure computation time excluding I/O wait time." It does not include wait time for database queries or external API calls. Typical API processing (JSON parsing, validation, response construction) completes in a few milliseconds, so it is sufficient for most use cases. If you need heavy computation, consider Workers Unbound (30 seconds of CPU time).

### Q3: What is OIDC-based AWS authentication, and why is it recommended?

Traditionally, IAM user access keys were stored as secrets when accessing AWS from GitHub Actions. With OIDC (OpenID Connect), AWS directly verifies short-lived tokens issued by GitHub, eliminating the need to manage long-lived secrets. This removes the burden of key rotation and reduces the risk of credential exposure.

### Q4: Should I choose Cloud Run or Lambda?

**When Lambda is a better fit:**
- Event-driven processing (S3 uploads, SQS messages)
- Heavy integration with existing AWS services
- Lightweight APIs where cold starts are acceptable
- Want to minimize costs with pay-per-use pricing

**When Cloud Run is a better fit:**
- Want to deploy existing Docker containers as-is
- Long request processing times (over 15 minutes)
- Need WebSocket or streaming support
- Want to maintain a portable container environment

### Q5: Tips for using Vercel Preview Deployments efficiently?

```
1. A preview URL is automatically generated for each branch
   → Enables verifying actual behavior during PR reviews

2. Set appropriate scopes for environment variables
   → Use different DB connections for Preview vs. Production

3. Deploy previews locally with the Vercel CLI
   → Check without waiting for CI: npx vercel deploy

4. Auto-post preview URL as a PR comment (GitHub Integration)
   → Reviewers can check with a single click

5. Feature flags active only in preview environments
   → Verify unfinished features in preview without affecting production
```

### Q6: What are the drawbacks of a multi-cloud architecture?

While multi-cloud offers benefits such as improved availability and avoiding vendor lock-in, it comes with the following drawbacks:

- **Increased operational complexity**: IAM, networking, and monitoring for each cloud must be managed separately
- **Learning costs**: The entire team must be proficient in multiple clouds
- **Data transfer costs**: Egress fees apply for data transfer between clouds
- **Ensuring consistency**: Managing transactions that span multiple clouds is difficult
- **Difficulty unifying tooling**: Even with Terraform abstraction, provider-specific configuration remains

Recommended approach: Unless there is a clear reason, choose one primary cloud and use a "hybrid" approach that only uses separate platforms for edge processing (Cloudflare) or frontend (Vercel).

### Q7: When should I use ECS Fargate vs. EKS (Kubernetes)?

```
ECS Fargate is appropriate when:
  - Native AWS service integration (ALB, CloudWatch, Secrets Manager)
  - Small to medium-scale microservices (up to about 10 services)
  - Want to avoid the Kubernetes learning curve
  - Portability to clouds other than AWS is not needed

EKS is appropriate when:
  - Large-scale microservices (tens to hundreds of services)
  - Want to leverage the Kubernetes ecosystem (Istio, Argo, Helm)
  - Consistent operations across multi-cloud/hybrid cloud
  - Advanced traffic control (Service Mesh) is needed
  - The team has Kubernetes expertise
```

---


## FAQ

### Q1: What is the most important point to keep in mind when learning this topic?

Gaining hands-on experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping straight to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work, particularly during code reviews and architectural design.

---

## Summary

| Topic | Key Points |
|-------|------------|
| AWS S3+CloudFront | The standard for static sites. Manage with IaC and deliver fast via CloudFront. Secure access control with OAC |
| AWS Lambda (SAM) | Serverless API. Easy canary deployment and alarm integration. Separate dependencies with Layers |
| AWS ECS/Fargate | The standard for container deployment. Automatic rollback with Circuit Breaker. Handle load with Auto Scaling |
| Vercel | Optimized for Next.js. Powerful preview environments and Git integration. Edge processing with Edge Functions |
| Cloudflare Workers | Minimum latency with edge execution. Ecosystem of D1/KV/R2/Durable Objects |
| GCP Cloud Run | Deploy Docker containers as-is. Easy gradual traffic migration |
| OIDC authentication | OIDC is recommended over secret keys for cloud authentication from CI/CD |
| Cache strategy | Immutable for static assets, no-cache for HTML, stale-while-revalidate for APIs |
| Multi-cloud | The hybrid of Frontend (Vercel) + Backend (AWS) + Edge (Cloudflare) is the practical choice |
| Monitoring and rollback | Post-deploy health checks are mandatory. Build in an automated rollback mechanism |

---

## What to Read Next

- [00-deployment-strategies.md](./00-deployment-strategies.md) — Deployment strategies such as Blue-Green and Canary
- [02-container-deployment.md](./02-container-deployment.md) — Container deployment with ECS/Kubernetes
- [03-release-management.md](./03-release-management.md) — Semantic versioning and release management

---

## References

1. **AWS Well-Architected Framework** — https://docs.aws.amazon.com/wellarchitected/ — Best practices for cloud architecture
2. **Vercel Documentation** — https://vercel.com/docs — Official Vercel documentation
3. **Cloudflare Workers Documentation** — https://developers.cloudflare.com/workers/ — Official Workers reference
4. **AWS SAM Developer Guide** — https://docs.aws.amazon.com/serverless-application-model/ — Serverless deployment with SAM
5. **AWS ECS Developer Guide** — https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ — ECS best practices
6. **Google Cloud Run Documentation** — https://cloud.google.com/run/docs — Official Cloud Run documentation
7. **Firebase Hosting Documentation** — https://firebase.google.com/docs/hosting — Firebase Hosting guide
8. **Terraform AWS Provider** — https://registry.terraform.io/providers/hashicorp/aws/ — AWS resource management with Terraform

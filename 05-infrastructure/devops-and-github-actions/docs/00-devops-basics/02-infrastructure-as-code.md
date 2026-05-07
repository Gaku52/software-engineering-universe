# Infrastructure as Code (IaC)

> A methodology for managing infrastructure configuration as code, enabling version control, review, and automated application

## What You Will Learn

1. Understand the basic concepts of IaC and the difference between declarative and imperative approaches
2. Learn the characteristics and use cases of Terraform, CloudFormation, CDK, and Pulumi
3. Understand IaC best practices and GitOps integration patterns
4. Understand IaC testing strategies and how to integrate them into CI/CD pipelines
5. Practice module design and multi-environment management in production environments


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of the content in [CI/CD Concepts](./01-ci-cd-concepts.md)

---

## 1. What is IaC?

### 1.1 Traditional Infrastructure Management vs IaC

```
Traditional Infrastructure Management:
  Administrators manually configure via GUI console
  → Documentation diverges from reality
  → No reproducibility
  → Cannot track change history
  → Configuration conflicts from multiple people working simultaneously
  → Recovery takes time during failures

IaC:
  Define infrastructure as code
  → Version control with Git
  → Review via PR
  → Automated application with CI/CD
  → Complete environment reproduction is possible
  → Instant restoration from code during failures
```

### 1.2 Benefits of IaC

```
+----------------------------------------------------------+
|                    Value of IaC                            |
+----------------------------------------------------------+
|                                                            |
|  Reproducibility    Build the same environment any        |
|  ┌──────────────────────────────────────────┐    number  |
|  │ code → dev environment / staging / prod  │  of times  |
|  └──────────────────────────────────────────┘              |
|                                                            |
|  Traceability    Git history = infrastructure change log   |
|  ┌──────────────────────────────────────────┐              |
|  │ commit log = "who changed what and when"  │              |
|  └──────────────────────────────────────────┘              |
|                                                            |
|  Reviewability   Review infrastructure changes via PR      |
|  ┌──────────────────────────────────────────┐              |
|  │ Display terraform plan diff in PR comment │              |
|  └──────────────────────────────────────────┘              |
|                                                            |
|  Consistency     All environments generated from same code |
|  ┌──────────────────────────────────────────┐              |
|  │ Differences between environments = only variables │      |
|  └──────────────────────────────────────────┘              |
|                                                            |
|  Speed           Build a new environment in minutes        |
|  ┌──────────────────────────────────────────┐              |
|  │ terraform apply → complete environment in 5 min │        |
|  └──────────────────────────────────────────┘              |
|                                                            |
+----------------------------------------------------------+
```

### 1.3 Scope of IaC

IaC is applied not only to cloud infrastructure but to a wide range of domains.

| Target | Example Tools | What Is Managed |
|---|---|---|
| Cloud Infrastructure | Terraform, CDK, Pulumi | VPC, EC2, RDS, S3, etc. |
| Container Orchestration | Kubernetes manifests, Helm | Pod, Service, Deployment, etc. |
| Configuration Management | Ansible, Chef, Puppet | OS settings, packages, users |
| Networking | Terraform, Ansible | Firewalls, DNS, CDN |
| Monitoring | Terraform (Datadog/PagerDuty provider) | Dashboards, alerts |
| CI/CD | GitHub Actions YAML, GitLab CI | Pipelines, workflows |
| Access Control | Terraform (IAM), Vault | Policies, roles, secrets |

---

## 2. Declarative vs Imperative Approaches

### 2.1 Comparison Table

| Item | Declarative | Imperative |
|---|---|---|
| Definition method | Describes "desired state" | Describes "procedure" |
| Idempotency | Built-in | Must be ensured manually |
| Representative tools | Terraform, CloudFormation | Ansible (partial), shell scripts |
| Diff detection | Automatic (plan) | Difficult |
| Learning cost | Requires learning a DSL | Can leverage programming skills |
| Use case | Infrastructure provisioning | Configuration management, provisioning |
| Drift detection | Easy | Difficult |
| Concurrent execution | Tool resolves dependencies | Order must be controlled manually |

### 2.2 Declarative Example (Terraform)

```hcl
# 「こうあるべき」を記述 → Terraform が差分を検出して適用
resource "aws_s3_bucket" "data" {
  bucket = "my-app-data-bucket"

  versioning {
    enabled = true
  }

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }

  tags = {
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

# ライフサイクルルール
resource "aws_s3_bucket_lifecycle_configuration" "data" {
  bucket = aws_s3_bucket.data.id

  rule {
    id     = "archive-old-objects"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}
```

### 2.3 Imperative Example (Shell Script)

```bash
#!/bin/bash
# 「手順」を記述 → 冪等性は自分で担保する必要がある

# バケットが存在しなければ作成
if ! aws s3api head-bucket --bucket my-app-data-bucket 2>/dev/null; then
  aws s3api create-bucket --bucket my-app-data-bucket
fi

# バージョニングを有効化
aws s3api put-bucket-versioning \
  --bucket my-app-data-bucket \
  --versioning-configuration Status=Enabled

# 暗号化を設定
aws s3api put-bucket-encryption \
  --bucket my-app-data-bucket \
  --server-side-encryption-configuration '{
    "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]
  }'

# ライフサイクルルールを設定
aws s3api put-bucket-lifecycle-configuration \
  --bucket my-app-data-bucket \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "archive-old-objects",
      "Status": "Enabled",
      "Transitions": [{"Days": 90, "StorageClass": "GLACIER"}],
      "Expiration": {"Days": 365}
    }]
  }'
```

### 2.4 Hybrid Approach

In real projects, declarative and imperative approaches are often combined.

```
Typical Combinations:

1. Terraform (declarative) + Ansible (imperative)
   Terraform: Build VPC and EC2 instances
   Ansible: OS configuration and package installation inside EC2

2. Terraform (declarative) + User Data script (imperative)
   Terraform: Build infrastructure + run initialization script via User Data

3. CDK (declarative/programmatic) + Custom Resource (imperative)
   CDK: Define standard resources
   Custom Resource: Manage resources not supported by CDK via Lambda
```

---

## 3. Major IaC Tools

### 3.1 Terraform

An IaC tool developed by HashiCorp that supports multiple clouds. Written in HCL (HashiCorp Configuration Language). The most widely used IaC tool, with over 1,000 providers available.

```hcl
# Terraform の基本構成
terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "ap-northeast-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = "ap-northeast-1"

  default_tags {
    tags = {
      ManagedBy   = "terraform"
      Project     = "my-app"
      Environment = var.environment
    }
  }
}

# VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project}-${var.environment}-vpc"
  }
}

# サブネット
resource "aws_subnet" "private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "${var.project}-${var.environment}-private-${count.index}"
    Type = "private"
  }
}

resource "aws_subnet" "public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index + 100)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project}-${var.environment}-public-${count.index}"
    Type = "public"
  }
}

# ECS Fargate サービス
resource "aws_ecs_service" "app" {
  name            = "my-app"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.app.id]
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    ignore_changes = [desired_count]  # オートスケーリングと競合防止
  }
}
```

```
Terraform Workflow:

  terraform init    → Download providers and modules
       ↓
  terraform plan    → Show diff between current state and definition
       ↓
  terraform apply   → Apply changes
       ↓
  terraform destroy → Delete resources (clean up dev environments)

State Management:
  +-----------+     +----------------+     +-----------+
  | .tf files | ←→ | terraform.tfstate | ←→ | Real infra |
  | (desired) |     | (current state)   |     | (AWS etc.) |
  +-----------+     +----------------+     +-----------+

OpenTofu (Open Source Fork of Terraform):
  - Born in 2023 in response to HashiCorp's license change (BSL)
  - Forked from Terraform 1.5.x
  - Under Linux Foundation governance
  - Nearly compatible with existing Terraform code
```

### 3.2 AWS CloudFormation

```yaml
# CloudFormation テンプレート
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Complete application stack with VPC, ECS, and RDS'

Parameters:
  Environment:
    Type: String
    AllowedValues: [dev, staging, prod]
  InstanceClass:
    Type: String
    Default: db.t3.medium
    AllowedValues: [db.t3.micro, db.t3.small, db.t3.medium, db.t3.large]

Conditions:
  IsProduction: !Equals [!Ref Environment, prod]

Resources:
  DataBucket:
    Type: AWS::S3::Bucket
    DeletionPolicy: Retain  # スタック削除時もバケットを保持
    Properties:
      BucketName: !Sub 'my-app-${Environment}-data'
      VersioningConfiguration:
        Status: Enabled
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256
      LifecycleConfiguration:
        Rules:
          - Id: ArchiveOldObjects
            Status: Enabled
            Transitions:
              - TransitionInDays: 90
                StorageClass: GLACIER

  Database:
    Type: AWS::RDS::DBInstance
    Properties:
      Engine: postgres
      EngineVersion: '16.1'
      DBInstanceClass: !If [IsProduction, db.t3.large, !Ref InstanceClass]
      AllocatedStorage: !If [IsProduction, 100, 20]
      MultiAZ: !If [IsProduction, true, false]
      StorageEncrypted: true
      DeletionProtection: !If [IsProduction, true, false]
      BackupRetentionPeriod: !If [IsProduction, 30, 7]

Outputs:
  BucketArn:
    Value: !GetAtt DataBucket.Arn
    Export:
      Name: !Sub '${Environment}-data-bucket-arn'
  DatabaseEndpoint:
    Value: !GetAtt Database.Endpoint.Address
    Export:
      Name: !Sub '${Environment}-db-endpoint'
```

### 3.3 AWS CDK

```typescript
// AWS CDK (TypeScript) - プログラミング言語でインフラを定義
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';

interface AppStackProps extends cdk.StackProps {
  environment: string;
  isProduction: boolean;
}

export class AppStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: AppStackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, 'AppVpc', {
      maxAzs: props.isProduction ? 3 : 2,
      natGateways: props.isProduction ? 2 : 1,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // RDS
    const database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_1,
      }),
      instanceType: props.isProduction
        ? ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.LARGE)
        : ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      multiAz: props.isProduction,
      deletionProtection: props.isProduction,
      backupRetention: cdk.Duration.days(props.isProduction ? 30 : 7),
    });

    // ECS クラスター
    const cluster = new ecs.Cluster(this, 'AppCluster', { vpc });

    // Fargate サービス (L3 Construct: ALB + Fargate を一括定義)
    const service = new ecs_patterns.ApplicationLoadBalancedFargateService(
      this, 'AppService', {
        cluster,
        cpu: props.isProduction ? 1024 : 256,
        memoryLimitMiB: props.isProduction ? 2048 : 512,
        desiredCount: props.isProduction ? 3 : 1,
        taskImageOptions: {
          image: ecs.ContainerImage.fromRegistry('my-app:latest'),
          containerPort: 3000,
          environment: {
            NODE_ENV: props.environment,
            DB_HOST: database.instanceEndpoint.hostname,
          },
        },
        circuitBreaker: { rollback: true },
      },
    );

    // オートスケーリング
    if (props.isProduction) {
      const scaling = service.service.autoScaleTaskCount({
        minCapacity: 3,
        maxCapacity: 10,
      });
      scaling.scaleOnCpuUtilization('CpuScaling', {
        targetUtilizationPercent: 70,
      });
      scaling.scaleOnMemoryUtilization('MemoryScaling', {
        targetUtilizationPercent: 80,
      });
    }

    // DB への接続許可
    database.connections.allowFrom(
      service.service,
      ec2.Port.tcp(5432),
      'Allow ECS to access RDS',
    );
  }
}

// アプリケーションのエントリポイント
const app = new cdk.App();

new AppStack(app, 'AppDev', {
  environment: 'dev',
  isProduction: false,
  env: { account: '123456789012', region: 'ap-northeast-1' },
});

new AppStack(app, 'AppProd', {
  environment: 'prod',
  isProduction: true,
  env: { account: '987654321098', region: 'ap-northeast-1' },
});
```

### 3.4 Pulumi

```typescript
// Pulumi (TypeScript) - 汎用プログラミング言語でマルチクラウド対応
import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';

const config = new pulumi.Config();
const env = config.require('environment');
const isProduction = env === 'prod';

// VPC (Crosswalk: 高レベル抽象化)
const vpc = new awsx.ec2.Vpc('app-vpc', {
  numberOfAvailabilityZones: isProduction ? 3 : 2,
  natGateways: isProduction ? { strategy: awsx.ec2.NatGatewayStrategy.OnePerAz } : { strategy: awsx.ec2.NatGatewayStrategy.Single },
});

// S3 バケット
const bucket = new aws.s3.Bucket('data-bucket', {
  bucket: `my-app-${env}-data`,
  versioning: { enabled: true },
  serverSideEncryptionConfiguration: {
    rule: {
      applyServerSideEncryptionByDefault: {
        sseAlgorithm: 'AES256',
      },
    },
  },
  lifecycleRules: [{
    enabled: true,
    transitions: [{
      days: 90,
      storageClass: 'GLACIER',
    }],
    expiration: { days: 365 },
  }],
});

// ECS クラスター + Fargate サービス
const cluster = new aws.ecs.Cluster('app-cluster');

const service = new awsx.ecs.FargateService('app-service', {
  cluster: cluster.arn,
  desiredCount: isProduction ? 3 : 1,
  networkConfiguration: {
    subnets: vpc.privateSubnetIds,
    securityGroups: [],
  },
  taskDefinitionArgs: {
    container: {
      name: 'app',
      image: 'my-app:latest',
      cpu: isProduction ? 1024 : 256,
      memory: isProduction ? 2048 : 512,
      portMappings: [{ containerPort: 3000 }],
      environment: [
        { name: 'NODE_ENV', value: env },
      ],
    },
  },
});

// 出力
export const bucketArn = bucket.arn;
export const bucketName = bucket.bucket;
export const vpcId = vpc.vpcId;
export const serviceUrl = pulumi.interpolate`http://${service.service.name}`;
```

### 3.5 Crossplane

An IaC tool that manages cloud resources as Kubernetes CRDs.

```yaml
# Crossplane: Kubernetes マニフェストでAWSリソースを管理
apiVersion: s3.aws.upbound.io/v1beta1
kind: Bucket
metadata:
  name: my-app-data
spec:
  forProvider:
    region: ap-northeast-1
  providerConfigRef:
    name: aws-provider

---
apiVersion: rds.aws.upbound.io/v1beta1
kind: Instance
metadata:
  name: my-app-db
spec:
  forProvider:
    region: ap-northeast-1
    engine: postgres
    engineVersion: "16.1"
    instanceClass: db.t3.medium
    allocatedStorage: 20
    storageEncrypted: true
  providerConfigRef:
    name: aws-provider
```

---

## 4. IaC Tool Comparison

| Item | Terraform | CloudFormation | CDK | Pulumi | Crossplane |
|---|---|---|---|---|---|
| Language | HCL | YAML/JSON | TypeScript, etc. | TypeScript/Python/Go, etc. | YAML (K8s CRD) |
| Multi-cloud | Yes | AWS only | AWS only | Yes | Yes |
| State management | tfstate (S3, etc.) | AWS-managed | Via CloudFormation | Pulumi Cloud / S3 | Kubernetes etcd |
| Learning cost | Medium | Medium | Low (developer-friendly) | Low (developer-friendly) | Medium (requires K8s knowledge) |
| Ecosystem | Largest | AWS-only | AWS-only | Growing | Growing |
| Drift detection | Detected via plan | drift detection | Via CloudFormation | Detected via preview | Continuous reconciliation |
| Recommended for | Multi-cloud | AWS-dedicated | AWS + TypeScript | Multi-cloud + developers | K8s-centric organizations |
| License | BSL 1.1 | AWS service | Apache 2.0 | Apache 2.0 | Apache 2.0 |
| OSS alternative | OpenTofu | - | - | - | - |

### 4.1 Tool Selection Decision Tree

```
IaC Tool Selection:

Is your organization Kubernetes-centric?
├── Yes → Consider Crossplane
│         ├── Want to manage cloud resources via K8s too → Crossplane
│         └── Managing K8s manifests only → Kustomize / Helm
└── No → Do you have multi-cloud requirements?
          ├── Yes → Terraform or Pulumi
          │         ├── Prefer DSL / large community → Terraform
          │         └── Want to write in a programming language → Pulumi
          └── No → AWS only?
                    ├── Yes → CDK or CloudFormation
                    │         ├── TypeScript/Python team → CDK
                    │         └── Simple YAML → CloudFormation
                    └── No → Other cloud → Terraform / Pulumi
```

---

## 5. IaC Best Practices

### 5.1 Modularization

```hcl
# modules/ecs-service/main.tf - 再利用可能なモジュール
variable "service_name" {
  type        = string
  description = "サービス名"
}

variable "image" {
  type        = string
  description = "コンテナイメージ"
}

variable "cpu" {
  type        = number
  default     = 256
  description = "CPU ユニット (256 = 0.25 vCPU)"
}

variable "memory" {
  type        = number
  default     = 512
  description = "メモリ (MiB)"
}

variable "desired_count" {
  type        = number
  default     = 1
  description = "希望するタスク数"
}

variable "environment_variables" {
  type        = map(string)
  default     = {}
  description = "環境変数"
}

variable "cluster_id" {
  type        = string
  description = "ECS クラスター ID"
}

variable "subnet_ids" {
  type        = list(string)
  description = "サブネット ID リスト"
}

variable "security_group_ids" {
  type        = list(string)
  description = "セキュリティグループ ID リスト"
}

# タスク定義
resource "aws_ecs_task_definition" "this" {
  family                   = var.service_name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name  = var.service_name
    image = var.image
    portMappings = [{
      containerPort = 3000
      protocol      = "tcp"
    }]
    environment = [
      for k, v in var.environment_variables : {
        name  = k
        value = v
      }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.this.name
        "awslogs-region"        = data.aws_region.current.name
        "awslogs-stream-prefix" = var.service_name
      }
    }
  }])
}

# ECS サービス
resource "aws_ecs_service" "this" {
  name            = var.service_name
  cluster         = var.cluster_id
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.subnet_ids
    security_groups = var.security_group_ids
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
}

# 出力
output "service_name" {
  value = aws_ecs_service.this.name
}

output "task_definition_arn" {
  value = aws_ecs_task_definition.this.arn
}
```

```hcl
# 利用側: environments/prod/main.tf
module "api_service" {
  source       = "../../modules/ecs-service"
  service_name = "api"
  image        = "my-api:v1.2.3"
  cpu          = 512
  memory       = 1024
  desired_count = 3
  cluster_id   = module.ecs_cluster.id
  subnet_ids   = module.vpc.private_subnet_ids
  security_group_ids = [module.security.app_sg_id]
  environment_variables = {
    NODE_ENV     = "production"
    DATABASE_URL = module.database.connection_string
  }
}

module "worker_service" {
  source       = "../../modules/ecs-service"
  service_name = "worker"
  image        = "my-worker:v1.2.3"
  cpu          = 1024
  memory       = 2048
  desired_count = 2
  cluster_id   = module.ecs_cluster.id
  subnet_ids   = module.vpc.private_subnet_ids
  security_group_ids = [module.security.worker_sg_id]
  environment_variables = {
    NODE_ENV  = "production"
    QUEUE_URL = module.sqs.queue_url
  }
}
```

### 5.2 Directory Structure

```
terraform/
├── modules/                   # Reusable modules
│   ├── networking/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── ecs-service/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── iam.tf
│   ├── rds/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── monitoring/
│       ├── main.tf
│       ├── variables.tf
│       └── dashboards.tf
├── environments/              # Per-environment configuration
│   ├── dev/
│   │   ├── main.tf           # Module calls
│   │   ├── variables.tf      # Variable definitions
│   │   ├── terraform.tfvars  # Environment-specific values
│   │   ├── backend.tf        # State file storage location
│   │   └── providers.tf      # Provider configuration
│   ├── staging/
│   │   ├── main.tf
│   │   ├── terraform.tfvars
│   │   └── backend.tf
│   └── prod/
│       ├── main.tf
│       ├── terraform.tfvars
│       └── backend.tf
├── global/                    # Shared resources across environments
│   ├── iam/
│   │   └── main.tf
│   ├── dns/
│   │   └── main.tf
│   └── ecr/
│       └── main.tf
└── scripts/                   # Helper scripts
    ├── init.sh
    └── plan.sh
```

### 5.3 Variable Management Best Practices

```hcl
# variables.tf - 型・説明・バリデーション付き変数定義
variable "environment" {
  type        = string
  description = "デプロイ環境 (dev, staging, prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment は dev, staging, prod のいずれかを指定してください"
  }
}

variable "instance_type" {
  type        = string
  default     = "t3.medium"
  description = "EC2 インスタンスタイプ"
  validation {
    condition     = can(regex("^t3\\.", var.instance_type))
    error_message = "t3 ファミリーのインスタンスタイプを指定してください"
  }
}

variable "alert_email" {
  type        = string
  description = "アラート通知先メールアドレス"
  sensitive   = false
  validation {
    condition     = can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.alert_email))
    error_message = "有効なメールアドレスを指定してください"
  }
}

variable "database_password" {
  type        = string
  description = "データベースパスワード"
  sensitive   = true  # plan/apply の出力でマスクされる
}
```

```hcl
# terraform.tfvars - 環境固有の値
# (Git にコミット可能、シークレットは含めない)
environment   = "prod"
instance_type = "t3.large"
alert_email   = "ops@example.com"

# シークレットは別ファイルまたは環境変数で管理
# export TF_VAR_database_password="xxx"
# または terraform.tfvars.secret (.gitignore に追加)
```

---

## 6. IaC Testing Strategy

### 6.1 Testing Pyramid

```
             /\
            /  \
           /E2E \         terraform apply + validation + destroy
          /------\        (terratest, kitchen-terraform)
         / Integ  \       Validation of terraform plan
        / Tests   \      (tfplan JSON analysis)
       /----------\
      / Static    \      lint, validate, security scan
     / Analysis   \      (tflint, checkov, tfsec, OPA)
    /--------------\
```

### 6.2 Static Analysis

```yaml
# CI での IaC 静的解析
name: Terraform Lint & Security
on:
  pull_request:
    paths: ['terraform/**']

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: '1.7'

      # 構文チェック
      - name: Terraform fmt
        run: terraform fmt -check -recursive
        working-directory: terraform/

      - name: Terraform validate
        run: |
          cd terraform/environments/dev
          terraform init -backend=false
          terraform validate

      # ベストプラクティスチェック
      - name: TFLint
        uses: terraform-linters/setup-tflint@v4
      - run: |
          tflint --init
          tflint --recursive
        working-directory: terraform/

      # セキュリティスキャン
      - name: Checkov
        uses: bridgecrewio/checkov-action@v12
        with:
          directory: terraform/
          framework: terraform
          output_format: sarif
          output_file_path: checkov-results.sarif

      - name: tfsec
        uses: aquasecurity/tfsec-action@v1.0.3
        with:
          working_directory: terraform/

      # OPA (Open Policy Agent) によるカスタムポリシー
      - name: OPA Policy Check
        run: |
          cd terraform/environments/dev
          terraform plan -out=tfplan.binary
          terraform show -json tfplan.binary > tfplan.json
          opa eval --data policies/ --input tfplan.json "data.terraform.deny[msg]"
```

### 6.3 Plan Testing

```yaml
# terraform plan を PR にコメント
name: Terraform Plan
on:
  pull_request:
    paths: ['terraform/**']

jobs:
  plan:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    strategy:
      matrix:
        environment: [dev, staging, prod]
    steps:
      - uses: actions/checkout@v4

      - uses: hashicorp/setup-terraform@v3

      - name: Terraform Init
        run: terraform init
        working-directory: terraform/environments/${{ matrix.environment }}

      - name: Terraform Plan
        id: plan
        run: terraform plan -no-color -out=tfplan
        working-directory: terraform/environments/${{ matrix.environment }}
        continue-on-error: true

      - name: Comment PR with Plan
        uses: actions/github-script@v7
        with:
          script: |
            const plan = `${{ steps.plan.outputs.stdout }}`;
            const truncated = plan.length > 60000
              ? plan.substring(0, 60000) + '\n... (truncated)'
              : plan;

            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: `### Terraform Plan - ${{ matrix.environment }}
              \`\`\`
              ${truncated}
              \`\`\`
              `
            });
```

### 6.4 E2E Testing (Terratest)

```go
// test/ecs_service_test.go
package test

import (
    "testing"
    "fmt"
    "time"

    "github.com/gruntwork-io/terratest/modules/terraform"
    "github.com/gruntwork-io/terratest/modules/aws"
    "github.com/gruntwork-io/terratest/modules/http-helper"
    "github.com/stretchr/testify/assert"
)

func TestEcsService(t *testing.T) {
    t.Parallel()

    terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
        TerraformDir: "../modules/ecs-service",
        Vars: map[string]interface{}{
            "service_name":  fmt.Sprintf("test-%d", time.Now().Unix()),
            "image":         "nginx:latest",
            "cpu":           256,
            "memory":        512,
            "desired_count": 1,
            "environment":   "test",
        },
    })

    // テスト終了時にリソースを確実に削除
    defer terraform.Destroy(t, terraformOptions)

    // リソースを作成
    terraform.InitAndApply(t, terraformOptions)

    // 出力を検証
    serviceName := terraform.Output(t, terraformOptions, "service_name")
    assert.Contains(t, serviceName, "test-")

    // ECS サービスが Running か確認
    serviceArn := terraform.Output(t, terraformOptions, "service_arn")
    assert.NotEmpty(t, serviceArn)

    // ALB エンドポイントのヘルスチェック
    albDns := terraform.Output(t, terraformOptions, "alb_dns_name")
    url := fmt.Sprintf("http://%s/health", albDns)
    http_helper.HttpGetWithRetry(t, url, nil, 200, "OK", 30, 10*time.Second)
}
```

---

## 7. CI/CD Integration

### 7.1 Terraform CI/CD Pipeline

```yaml
# 完全な Terraform CI/CD パイプライン
name: Terraform CI/CD
on:
  push:
    branches: [main]
    paths: ['terraform/**']
  pull_request:
    paths: ['terraform/**']

permissions:
  id-token: write    # OIDC 認証用
  contents: read
  pull-requests: write

jobs:
  # PR 時: lint + plan
  lint:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform fmt -check -recursive
      - run: |
          cd terraform/environments/prod
          terraform init -backend=false
          terraform validate

  plan:
    if: github.event_name == 'pull_request'
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3

      - name: Configure AWS Credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/terraform-plan
          aws-region: ap-northeast-1

      - name: Terraform Plan
        run: |
          cd terraform/environments/prod
          terraform init
          terraform plan -no-color -out=tfplan 2>&1 | tee plan.txt

      - name: Post Plan to PR
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const plan = fs.readFileSync('terraform/environments/prod/plan.txt', 'utf8');
            const body = `### Terraform Plan
            \`\`\`hcl
            ${plan.substring(0, 60000)}
            \`\`\``;
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body
            });

  # main マージ時: apply
  apply:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    environment: production  # 手動承認が必要
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3

      - name: Configure AWS Credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/terraform-apply
          aws-region: ap-northeast-1

      - name: Terraform Apply
        run: |
          cd terraform/environments/prod
          terraform init
          terraform apply -auto-approve
```

### 7.2 Atlantis (Terraform PR Automation)

```yaml
# atlantis.yaml - リポジトリ設定
version: 3
automerge: false
delete_source_branch_on_merge: true
parallel_plan: true
parallel_apply: false

projects:
  - name: prod
    dir: terraform/environments/prod
    workspace: default
    autoplan:
      when_modified: ["*.tf", "../modules/**/*.tf"]
      enabled: true
    apply_requirements: [approved, mergeable]
    workflow: production

  - name: dev
    dir: terraform/environments/dev
    workspace: default
    autoplan:
      when_modified: ["*.tf", "../modules/**/*.tf"]
      enabled: true
    apply_requirements: [mergeable]
    workflow: default

workflows:
  production:
    plan:
      steps:
        - init
        - run: tflint --recursive
        - run: checkov -d .
        - plan
    apply:
      steps:
        - apply
```

---

## 8. State Management

### 8.1 Configuring a Remote Backend

```hcl
# S3 + DynamoDB バックエンド (推奨)
terraform {
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "ap-northeast-1"
    dynamodb_table = "terraform-locks"  # ロック用
    encrypt        = true
    kms_key_id     = "alias/terraform-state-key"
  }
}
```

```hcl
# バックエンドインフラ自体の定義 (bootstrap)
resource "aws_s3_bucket" "terraform_state" {
  bucket = "my-terraform-state"

  lifecycle {
    prevent_destroy = true  # 誤削除防止
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.terraform_state.id
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket                  = aws_s3_bucket.terraform_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "terraform_locks" {
  name         = "terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}
```

### 8.2 Splitting State Files

```
State File Splitting Strategy:

1. Split by environment (minimum)
   terraform/environments/dev/   → dev.tfstate
   terraform/environments/prod/  → prod.tfstate

2. Split by layer (recommended)
   terraform/layers/networking/  → networking.tfstate
   terraform/layers/database/    → database.tfstate
   terraform/layers/application/ → application.tfstate

3. Split by service (microservices)
   terraform/services/user/      → user-service.tfstate
   terraform/services/order/     → order-service.tfstate

Benefits:
- Minimize blast radius
- Faster plan/apply
- Enables parallel work across teams
- Reduces lock contention

Note:
- Share data between splits using data sources / remote state
```

```hcl
# レイヤー間のデータ共有
# application レイヤーから networking の出力を参照
data "terraform_remote_state" "networking" {
  backend = "s3"
  config = {
    bucket = "my-terraform-state"
    key    = "prod/networking/terraform.tfstate"
    region = "ap-northeast-1"
  }
}

resource "aws_ecs_service" "app" {
  # networking レイヤーの出力を使用
  network_configuration {
    subnets = data.terraform_remote_state.networking.outputs.private_subnet_ids
  }
}
```

---

## 9. Anti-Patterns

### Anti-Pattern 1: Managing State Files Locally

```
Bad example:
  Saving terraform.tfstate locally
  and committing it to Git.

Problems:
  - Sensitive data (passwords, etc.) ends up in Git
  - State conflicts when multiple people work in parallel
  - Losing the state file = unable to manage infrastructure

Fix:
  terraform {
    backend "s3" {
      bucket         = "my-terraform-state"
      key            = "prod/terraform.tfstate"
      region         = "ap-northeast-1"
      dynamodb_table = "terraform-locks"  # ロック用
      encrypt        = true
    }
  }
  # Add *.tfstate to .gitignore
```

### Anti-Pattern 2: Hardcoded Values

```hcl
# 悪い例: 値をハードコード
resource "aws_instance" "web" {
  ami           = "ami-0abcdef1234567890"  # マジックナンバー
  instance_type = "t3.large"               # 環境で変わるべき
  subnet_id     = "subnet-12345"           # 環境依存
}

# 改善: 変数化 + データソース
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

resource "aws_instance" "web" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = var.instance_type
  subnet_id     = var.subnet_id
}
```

### Anti-Pattern 3: A Single Massive State File

```
Bad example:
  Managing all resources (VPC, RDS, ECS, S3, IAM, ...) in one terraform.tfstate
  → plan takes more than 5 minutes
  → A single change risks affecting all resources
  → Lock contention occurs frequently across teams

Fix:
  Split state files by layer or by service
  → Each plan completes within 30 seconds
  → Blast radius is limited
  → Teams can work in parallel
```

### Anti-Pattern 4: Ignoring Drift

```
Problem:
  Making changes manually from the AWS console,
  causing code and reality to diverge (drift).

  Code:          instance_type = "t3.medium"
  Real infra:    instance_type = "t3.large" (changed in console)

  → terraform plan keeps showing "changes detected"
  → plan results become unreliable
  → Next terraform apply introduces unintended changes

Fix:
  1. Enforce a rule that all changes go through PRs
  2. Use AWS Config / CloudTrail to detect console operations
  3. Run terraform plan periodically to detect drift
  4. Automate drift detection in CI
```

```yaml
# ドリフト検出の自動化
name: Drift Detection
on:
  schedule:
    - cron: '0 9 * * *'  # 毎日9時

jobs:
  detect-drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/terraform-plan
          aws-region: ap-northeast-1
      - name: Check for drift
        run: |
          cd terraform/environments/prod
          terraform init
          terraform plan -detailed-exitcode -out=tfplan 2>&1 | tee plan.txt
          EXIT_CODE=$?
          if [ $EXIT_CODE -eq 2 ]; then
            echo "DRIFT DETECTED!"
            # Slack 通知
            curl -X POST "$SLACK_WEBHOOK" \
              -d "{\"text\":\"Terraform drift detected in production!\"}"
          fi
        env:
          SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also create test code

```python
# 演習1: 基本実装のテンプレート
class Exercise1:
    """基本的な実装パターンの演習"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """入力値の検証"""
        if value is None:
            raise ValueError("入力値がNoneです")
        return True

    def process(self, value):
        """データ処理のメインロジック"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """処理結果の取得"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# テスト
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "例外が発生するべき"
    except ValueError:
        pass

    print("全テスト合格!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation to add the following functionality.

```python
# 演習2: 応用パターン
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """応用パターンの演習"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """アイテムの追加（サイズ制限付き）"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """キーによる検索"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """キーによる削除"""
        for i, item in enumerate(self._items):
            if item['key'] == key:
                self._items.pop(i)
                return True
        return False

    def stats(self) -> Dict:
        """統計情報"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# テスト
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # サイズ制限
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("応用テスト全合格!")

test_advanced()
```

### Exercise 3: Performance Optimization

Improve the performance of the following code.

```python
# 演習3: パフォーマンス最適化
import time
from functools import lru_cache

# 最適化前（O(n^2)）
def slow_search(data: list, target: int) -> int:
    """非効率な検索"""
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[i] + data[j] == target:
                return (i, j)
    return (-1, -1)

# 最適化後（O(n)）
def fast_search(data: list, target: int) -> tuple:
    """ハッシュマップを使った効率的な検索"""
    seen = {}
    for i, num in enumerate(data):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (-1, -1)

# ベンチマーク
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

    print(f"非効率版: {slow_time:.4f}秒")
    print(f"効率版:   {fast_time:.6f}秒")
    print(f"高速化率: {slow_time/fast_time:.0f}倍")

benchmark()
```

**Key Points:**
- Be mindful of algorithmic complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks
---

## 10. FAQ

### Q1: Should I choose Terraform or Pulumi?

It depends on the team's skill set and requirements. If there is a dedicated infrastructure team, Terraform's broad ecosystem is an advantage. If application developers also manage infrastructure, Pulumi/CDK's programming language approach reduces the learning cost. If multi-cloud is a requirement, choose Terraform or Pulumi. Due to HashiCorp's license change in 2023, OpenTofu is also an option if OSS licensing is a priority.

### Q2: How should I test IaC?

For Terraform, the basic approach is verifying diffs with `terraform plan`. Additionally, perform syntax checks with `terraform validate`, best-practice checks with `tflint`, and security scans with `checkov` / `tfsec`. For integration testing, use `terratest` (Go) to create, validate, and destroy real resources in E2E tests. You can also define custom policies with OPA (Open Policy Agent) to automatically check your organization's governance rules.

### Q3: How do I migrate existing infrastructure to IaC?

For Terraform, use the `terraform import` command to bring existing resources into the state file. Reverse-generation tools such as `terraformer` or `former2` (CloudFormation) can also be useful. Migrating incrementally and enforcing a rule that all new resources must be created with IaC is the practical approach. For AWS, AWS Application Composer and IaC Generator are also available.

### Q4: What should I do if the Terraform state file gets corrupted?

First, check the current state with `terraform state list`. If using an S3 backend with versioning enabled, you can restore a previous state file. In the worst case, you may need to re-import all resources with `terraform import`. It is essential to always manage state file backups in S3 with versioning enabled and to apply locking with DynamoDB.

### Q5: What resources should not be managed with IaC?

Temporary resources (e.g., EC2 for debugging), database contents (tables and records), and application settings (feature flags, etc.) are often excluded from IaC. Also, resources that change frequently (e.g., Auto Scaling `desired_count`) should either be excluded with `lifecycle { ignore_changes }` or managed through a separate mechanism.

### Q6: How should IaC be designed for a multi-account environment?

In a multi-account environment using AWS Organizations, a three-tier structure is common: (1) manage Organizations/OUs/SCPs in the management account, (2) manage Route53/Transit Gateway in a shared services account, and (3) manage application infrastructure in each environment account. Use Terraform `provider` aliases and `assume_role` for cross-account operations.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently used in day-to-day development work. It is especially important during code reviews and architectural design.

---

## Summary

| Item | Key Points |
|---|---|
| Essence of IaC | Define infrastructure as code and manage it with version control |
| Declarative vs Imperative | Declarative (Terraform, etc.) is mainstream; idempotency is built-in |
| Major tools | Terraform (multi-cloud), CDK (AWS + TS), Pulumi (multi + language) |
| State management | Remote backend is mandatory (S3 + DynamoDB, etc.) |
| Modularization | Achieve the DRY principle with reusable modules |
| Testing | Static analysis + plan testing + E2E testing (terratest) |
| CI/CD integration | plan on PR, apply on merge, OIDC authentication |
| Drift detection | Automatically detect divergence with periodic plan execution |
| Best practices | Variables, environment separation, testing, least privilege |
| Essential skills | Reading plan output, module design, security |

---

## What to Read Next

- [GitOps](./03-gitops.md) -- An operational method combining IaC and Git
- [Cloud Deployment](../02-deployment/01-cloud-deployment.md) -- Deploying to infrastructure built with IaC
- [GitHub Actions Basics](../01-github-actions/00-actions-basics.md) -- Automatically applying IaC in CI
- [CI/CD Concepts](./01-ci-cd-concepts.md) -- Fundamentals of pipeline design

---

## References

1. Kief Morris. *Infrastructure as Code*, 2nd Edition. O'Reilly Media, 2020.
2. HashiCorp. "Terraform Documentation." https://developer.hashicorp.com/terraform/docs
3. AWS. "AWS CDK Developer Guide." https://docs.aws.amazon.com/cdk/v2/guide/
4. Pulumi. "Pulumi Documentation." https://www.pulumi.com/docs/
5. Yevgeniy Brikman. *Terraform: Up & Running*, 3rd Edition. O'Reilly Media, 2022.
6. OpenTofu. "OpenTofu Documentation." https://opentofu.org/docs/
7. Gruntwork. "Terratest Documentation." https://terratest.gruntwork.io/
8. Bridgecrew. "Checkov Documentation." https://www.checkov.io/

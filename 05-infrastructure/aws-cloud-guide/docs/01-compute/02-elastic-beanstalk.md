# Elastic Beanstalk

> Master AWS's PaaS service that automates application deployment, scaling, and monitoring

## What You Will Learn in This Chapter

1. Understand Elastic Beanstalk's supported platforms and architecture, and choose the appropriate configuration
2. Compare the characteristics of 4 deployment strategies and achieve zero-downtime deployments
3. Configure customizations and monitoring using .ebextensions and environment variables
4. Implement safe releases and rollbacks using Blue/Green deployments
5. Achieve container-based deployments using the Docker platform


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of [EC2 Advanced](./01-ec2-advanced.md) content

---

## 1. What is Elastic Beanstalk?

### 1.1 Architecture Overview

```
Elastic Beanstalk Environment Configuration
+----------------------------------------------------------+
|  Elastic Beanstalk Environment                            |
|                                                           |
|  +--------------------------------------------------+    |
|  |  ALB (Load Balancer)                              |    |
|  +--------------------------------------------------+    |
|              |              |              |               |
|  +-----------v--+ +---------v----+ +-------v------+       |
|  | EC2 Instance | | EC2 Instance | | EC2 Instance |       |
|  | (AZ-1a)      | | (AZ-1c)      | | (AZ-1d)     |       |
|  | +----------+ | | +----------+ | | +----------+ |       |
|  | | App      | | | | App      | | | | App      | |       |
|  | | Runtime  | | | | Runtime  | | | | Runtime  | |       |
|  | | OS       | | | | OS       | | | | OS       | |       |
|  | +----------+ | | +----------+ | | +----------+ |       |
|  +--------------+ +--------------+ +--------------+       |
|                                                           |
|  +--------------------------------------------------+    |
|  | Auto Scaling Group                                |    |
|  +--------------------------------------------------+    |
|                                                           |
|  +--------------------------------------------------+    |
|  | Security Groups + CloudWatch + S3 (Logs)          |    |
|  +--------------------------------------------------+    |
+----------------------------------------------------------+
```

### 1.2 Elastic Beanstalk Responsibility Boundaries

```
+------------------------+------------------------+
|    User Responsibility  |   Beanstalk Manages    |
+------------------------+------------------------+
| Application code       | EC2 provisioning        |
| Environment variables  | Auto Scaling setup      |
| Deployment strategy    | Load balancer management|
| .ebextensions config   | OS patches (managed)    |
| Application monitoring | Health monitoring       |
| Custom domain setup    | Log collection          |
| SSL certificate prep   | Security group creation |
+------------------------+------------------------+
```

### 1.3 Environment Types

| Environment Type | Description | Components | Use Case |
|-----------|------|---------|------------|
| Web Server Environment | Handles HTTP requests | ALB + EC2 + ASG | Web apps, APIs |
| Worker Environment | Handles background jobs | SQS + EC2 + ASG | Batch processing, async tasks |

```
Web Server Environment vs Worker Environment

Web Server Environment:
  Client → ALB → EC2 (Application)
                          ↓ (Submit async tasks to SQS)
Worker Environment:
  SQS Queue → sqsd daemon → EC2 (Worker App)
                                  ↓ (Delete message from SQS upon completion)
```

---

## 2. Supported Platforms

### 2.1 Supported Platform List

| Language/Framework | Platform | Container | Default Port |
|-------------------|---------------|---------|---------------|
| Node.js | Node.js 18/20 on Amazon Linux 2023 | AL2023 | 8080 |
| Python | Python 3.11/3.12 on Amazon Linux 2023 | AL2023 | 8000 |
| Java | Corretto 17/21 on Amazon Linux 2023 | AL2023 | 5000 |
| Go | Go 1.21 on Amazon Linux 2023 | AL2023 | 5000 |
| .NET | .NET 6/8 on Amazon Linux 2023 | AL2023 | 5000 |
| Ruby | Ruby 3.2/3.3 on Amazon Linux 2023 | AL2023 | 8080 |
| PHP | PHP 8.2/8.3 on Amazon Linux 2023 | AL2023 | 80 (Apache) |
| Docker | Docker on Amazon Linux 2023 | AL2023 | 80 |
| Multi-container Docker | ECS managed Docker | ECS | Varies by container |

### 2.2 Platform Selection Guide

```
Platform Selection Flow
==========================

Is it containerized?
├─ Yes → Docker Platform
│   ├─ Single container → Docker on AL2023
│   └─ Multiple containers → Multi-container Docker (ECS)
│
└─ No → Select based on language/framework
    ├─ Python (Django/Flask) → Python on AL2023
    ├─ Node.js (Express/NestJS) → Node.js on AL2023
    ├─ Java (Spring Boot) → Corretto on AL2023
    ├─ Go (Gin/Echo) → Go on AL2023
    ├─ .NET (ASP.NET Core) → .NET on AL2023
    ├─ Ruby (Rails) → Ruby on AL2023
    └─ PHP (Laravel) → PHP on AL2023

Note: Amazon Linux 2 reaches end of support in June 2025
→ Always select Amazon Linux 2023-based platforms
```

### 2.3 Code Example: Installing and Initializing EB CLI

```bash
# EB CLI インストール
pip install awsebcli

# バージョン確認
eb --version

# プロジェクトを初期化
cd /path/to/my-app
eb init

# 対話形式で設定
# 1. リージョン選択: ap-northeast-1
# 2. アプリケーション名: my-web-app
# 3. プラットフォーム: Python 3.12
# 4. CodeCommit 連携: No
# 5. SSH キーペア: 既存のキーを選択

# 非対話形式で初期化
eb init my-web-app \
  --platform "Python 3.12 running on 64bit Amazon Linux 2023" \
  --region ap-northeast-1 \
  --keyname my-key-pair
```

### 2.4 Code Example: Creating an Environment

```bash
# 環境を作成
eb create production-env \
  --instance-type t3.small \
  --scale 2 \
  --elb-type application \
  --region ap-northeast-1 \
  --tags Environment=production,Team=backend \
  --vpc.id vpc-0123456789abcdef0 \
  --vpc.elbsubnets subnet-pub-a,subnet-pub-c \
  --vpc.ec2subnets subnet-priv-a,subnet-priv-c \
  --vpc.elbpublic \
  --vpc.publicip

# 環境の状態確認
eb status

# ログの確認
eb logs

# ヘルスチェック
eb health

# 環境一覧
eb list

# 環境の終了（注意: リソースが全て削除される）
eb terminate production-env
```

### 2.5 Application Structure Example (Python/Django)

```
my-django-app/
├── .ebextensions/
│   ├── 01-packages.config
│   ├── 02-django.config
│   ├── 03-logging.config
│   └── 04-https.config
├── .platform/
│   ├── hooks/
│   │   ├── prebuild/
│   │   │   └── 01_install_deps.sh
│   │   ├── predeploy/
│   │   │   └── 01_migrate.sh
│   │   └── postdeploy/
│   │       └── 01_health_check.sh
│   └── nginx/
│       └── conf.d/
│           └── custom.conf
├── myapp/
│   ├── settings/
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── production.py
│   │   └── development.py
│   ├── urls.py
│   └── wsgi.py
├── manage.py
├── requirements.txt
├── Procfile
└── .ebignore
```

```python
# Procfile — EB がアプリケーションの起動方法を知るためのファイル
# web: gunicorn myapp.wsgi --bind :8000 --workers 3 --threads 2
```

```bash
# .ebignore — デプロイに含めないファイル
.git
__pycache__
*.pyc
.env
.venv
node_modules
.DS_Store
*.sqlite3
```

---

## 3. Deployment Strategies

### 3.1 Comparison of 5 Deployment Strategies

```
All at Once
+---------+---------+---------+
| v1→v2   | v1→v2   | v1→v2   |  Update all instances simultaneously
+---------+---------+---------+  Downtime: Yes

Rolling
+---------+---------+---------+
| v1→v2   | v1      | v1      |  Update sequentially in batches
+---------+---------+---------+  Downtime: No (temporary capacity reduction)
    ↓
+---------+---------+---------+
| v2      | v1→v2   | v1      |
+---------+---------+---------+
    ↓
+---------+---------+---------+
| v2      | v2      | v1→v2   |
+---------+---------+---------+

Rolling with Additional Batch
+---------+---------+---------+---------+
| v1→v2   | v1      | v1      | v2(new) |  Additional instances maintain capacity
+---------+---------+---------+---------+  Downtime: No

Immutable
+---------+---------+---------+   +---------+---------+---------+
| v1      | v1      | v1      |   | v2      | v2      | v2      |
+---------+---------+---------+   +---------+---------+---------+
  Old ASG (deleted after health     New ASG (switched after health
  check)                            check)
  Downtime: No, Rollback: Fast

Traffic Splitting
+---------+---------+---------+   +---------+
| v1      | v1      | v1      |   | v2      |
+---------+---------+---------+   +---------+
  Old TG (90% of traffic)           New TG (10% of traffic)
  → Gradually shift traffic          → Canary release approach
```

### 3.2 Deployment Strategy Comparison Table

| Strategy | Downtime | Deploy Speed | Cost | Rollback | Recommended For |
|------|-----------|-----------|--------|-----------|---------|
| All at Once | Yes | Fastest | No additional cost | Requires redeploy | Development |
| Rolling | No | Medium | No additional cost | Requires redeploy | Staging |
| Rolling + Batch | No | Medium | Temporary addition | Requires redeploy | Production (low risk) |
| Immutable | No | Slow | Temporarily 2x | Fast (revert to old env) | Production (recommended) |
| Traffic Splitting | No | Slow | Temporary addition | Fast | Production (canary) |
| Blue/Green | No | Slow | Always 2x | Fastest (URL swap) | Production (highest safety) |

### 3.3 Code Example: Deployment Configuration (.ebextensions)

```yaml
# .ebextensions/01-deploy.config
option_settings:
  aws:elasticbeanstalk:command:
    DeploymentPolicy: RollingWithAdditionalBatch
    BatchSizeType: Percentage
    BatchSize: 25
    Timeout: 600
  aws:autoscaling:updatepolicy:rollingupdate:
    RollingUpdateEnabled: true
    MaxBatchSize: 1
    MinInstancesInService: 1
```

### 3.4 Code Example: Traffic Splitting Configuration

```yaml
# .ebextensions/traffic-splitting.config
option_settings:
  aws:elasticbeanstalk:command:
    DeploymentPolicy: TrafficSplitting
  aws:elasticbeanstalk:trafficsplitting:
    NewVersionPercent: 10
    EvaluationTime: 10
```

### 3.5 Executing Deployments

```bash
# 現在のディレクトリのコードをデプロイ
eb deploy

# 特定のバージョンをデプロイ
eb deploy --version v1.2.0

# ステージングにラベル付きでデプロイ
eb deploy staging-env --label "release-2026-02-16" --message "Feature X release"

# デプロイ状態の監視
eb events --follow

# ロールバック（前のバージョンに戻す）
eb deploy --version previous-version-label

# アプリケーションバージョンの一覧
aws elasticbeanstalk describe-application-versions \
  --application-name my-web-app \
  --query 'ApplicationVersions[].[VersionLabel,DateCreated,Status]' \
  --output table
```

---

## 4. Configuration Customization

### 4.1 .ebextensions Structure

```
my-app/
├── .ebextensions/
│   ├── 01-packages.config      # Package installation
│   ├── 02-files.config         # File placement
│   ├── 03-commands.config      # Command execution
│   ├── 04-options.config       # Environment settings
│   ├── 05-resources.config     # CloudFormation resources
│   └── 06-logging.config       # Logging settings
├── .platform/
│   ├── hooks/
│   │   ├── prebuild/           # Pre-build hooks
│   │   ├── predeploy/          # Pre-deploy hooks
│   │   └── postdeploy/         # Post-deploy hooks
│   ├── confighooks/
│   │   ├── prebuild/           # Pre-build hooks on config change
│   │   └── predeploy/          # Pre-deploy hooks on config change
│   └── nginx/
│       ├── nginx.conf          # NGINX main config (full override)
│       └── conf.d/
│           └── custom.conf     # NGINX custom config (additive)
├── application.py
└── requirements.txt

.ebextensions execution order:
1. packages       — OS package installation
2. groups         — Linux group creation
3. users          — Linux user creation
4. sources        — Archive extraction
5. files          — File placement
6. commands       — Commands before app deployment
7. services       — Service startup/enablement
8. container_commands — Commands after app deployment (leader_only supported)
```

### 4.2 Code Example: Package Installation and Configuration

```yaml
# .ebextensions/01-packages.config
packages:
  yum:
    git: []
    jq: []
    htop: []

files:
  "/etc/nginx/conf.d/proxy.conf":
    mode: "000644"
    owner: root
    group: root
    content: |
      client_max_body_size 50M;
      proxy_read_timeout 300;
      proxy_connect_timeout 60;
      proxy_send_timeout 300;

  "/opt/elasticbeanstalk/tasks/taillogs.d/app-logs.conf":
    mode: "000644"
    owner: root
    group: root
    content: |
      /var/log/app/*.log

commands:
  01_install_node:
    command: |
      curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
      yum install -y nodejs
    test: "! node --version 2>/dev/null"

container_commands:
  01_migrate:
    command: "python manage.py migrate"
    leader_only: true
  02_collectstatic:
    command: "python manage.py collectstatic --noinput"
  03_create_superuser:
    command: "python manage.py createsuperuser --noinput || true"
    leader_only: true
    env:
      DJANGO_SUPERUSER_USERNAME: admin
      DJANGO_SUPERUSER_EMAIL: admin@example.com
      DJANGO_SUPERUSER_PASSWORD: InitialPassword123!
```

### 4.3 Code Example: Environment Variable Configuration

```bash
# CLI で環境変数を設定
eb setenv \
  DATABASE_URL=postgresql://user:pass@rds-endpoint:5432/mydb \
  REDIS_URL=redis://elasticache-endpoint:6379 \
  SECRET_KEY=my-secret-key-123 \
  DEBUG=false \
  ALLOWED_HOSTS=.example.com \
  AWS_STORAGE_BUCKET_NAME=my-static-bucket \
  SENTRY_DSN=https://xxx@sentry.io/123

# 環境変数の確認
eb printenv

# .ebextensions で環境変数を設定
# .ebextensions/04-options.config
option_settings:
  aws:elasticbeanstalk:application:environment:
    DJANGO_SETTINGS_MODULE: myapp.settings.production
    PYTHONPATH: /var/app/current
    LOG_LEVEL: INFO

# AWS CLI で環境変数を設定
aws elasticbeanstalk update-environment \
  --environment-name production-env \
  --option-settings '[
    {"Namespace": "aws:elasticbeanstalk:application:environment", "OptionName": "DEBUG", "Value": "false"},
    {"Namespace": "aws:elasticbeanstalk:application:environment", "OptionName": "LOG_LEVEL", "Value": "WARNING"}
  ]'
```

### 4.4 Code Example: Custom NGINX Configuration

```nginx
# .platform/nginx/conf.d/custom.conf
upstream backend {
    server 127.0.0.1:8000;
    keepalive 256;
}

server {
    listen 80;

    # gzip compression
    gzip on;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Static files
    location /static/ {
        alias /var/app/current/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Media files
    location /media/ {
        alias /var/app/current/media/;
        expires 7d;
        add_header Cache-Control "public";
    }

    # Health check (no logging needed)
    location /health {
        proxy_pass http://backend;
        access_log off;
    }

    # Application
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_buffering off;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

### 4.5 Code Example: Adding CloudFormation Resources

```yaml
# .ebextensions/05-resources.config
Resources:
  sslSecurityGroupIngress:
    Type: AWS::EC2::SecurityGroupIngress
    Properties:
      GroupId: {"Fn::GetAtt": ["AWSEBSecurityGroup", "GroupId"]}
      IpProtocol: tcp
      ToPort: 443
      FromPort: 443
      CidrIp: 0.0.0.0/0

  AWSEBAutoScalingGroup:
    Type: AWS::AutoScaling::AutoScalingGroup
    Properties:
      HealthCheckType: ELB
      HealthCheckGracePeriod: 300

  # CloudWatch Alarm
  CPUAlarmHigh:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmDescription: "CPU usage > 80%"
      Namespace: AWS/EC2
      MetricName: CPUUtilization
      Dimensions:
        - Name: AutoScalingGroupName
          Value: {"Ref": "AWSEBAutoScalingGroup"}
      Statistic: Average
      Period: 300
      EvaluationPeriods: 2
      Threshold: 80
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - {"Ref": "NotificationTopic"}

  NotificationTopic:
    Type: AWS::SNS::Topic
    Properties:
      Subscription:
        - Protocol: email
          Endpoint: alerts@example.com
```

### 4.6 Code Example: Auto Scaling Configuration

```yaml
# .ebextensions/autoscaling.config
option_settings:
  # Instance type
  aws:autoscaling:launchconfiguration:
    InstanceType: t3.small
    IamInstanceProfile: aws-elasticbeanstalk-ec2-role
    SecurityGroups: sg-0123456789abcdef0
    RootVolumeType: gp3
    RootVolumeSize: 30

  # Auto Scaling settings
  aws:autoscaling:asg:
    MinSize: 2
    MaxSize: 8
    Cooldown: 300

  # Scaling triggers
  aws:autoscaling:trigger:
    MeasureName: CPUUtilization
    Statistic: Average
    Unit: Percent
    Period: 1
    BreachDuration: 5
    UpperThreshold: 70
    UpperBreachScaleIncrement: 1
    LowerThreshold: 30
    LowerBreachScaleIncrement: -1

  # Scheduled scaling
  aws:autoscaling:scheduledaction:
    # Scale out on weekday mornings
    - ResourceId: AWSEBAutoScalingGroup
      Schedule: "cron(0 0 * * MON-FRI)"
      MinSize: 4
      MaxSize: 8
      DesiredCapacity: 4

  # Load balancer settings
  aws:elasticbeanstalk:environment:
    LoadBalancerType: application

  aws:elbv2:listener:443:
    Protocol: HTTPS
    SSLCertificateArns: arn:aws:acm:ap-northeast-1:123456789012:certificate/xxx
    SSLPolicy: ELBSecurityPolicy-TLS13-1-2-2021-06

  aws:elbv2:listener:80:
    Protocol: HTTP
    DefaultProcess: default
    ListenerEnabled: true

  # Health check
  aws:elasticbeanstalk:application:
    Application Healthcheck URL: /health

  aws:elasticbeanstalk:environment:process:default:
    HealthCheckPath: /health
    HealthCheckInterval: 30
    HealthyThresholdCount: 2
    UnhealthyThresholdCount: 3
    DeregistrationDelay: 30
    StickinessEnabled: true
    StickinessLBCookieDuration: 3600
```

### 4.7 How to Use Platform Hooks

```bash
#!/bin/bash
# .platform/hooks/predeploy/01_migrate.sh
# Run database migrations before deployment

set -euo pipefail

echo "Running database migrations..."
cd /var/app/staging

# Activate virtual environment
source /var/app/venv/*/bin/activate

# Run migrations
python manage.py migrate --noinput

echo "Database migrations completed successfully"
```

```bash
#!/bin/bash
# .platform/hooks/postdeploy/01_health_check.sh
# Run health check after deployment

set -euo pipefail

echo "Running post-deploy health check..."

# Wait for the application to start
for i in $(seq 1 30); do
  if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo "Health check passed!"
    exit 0
  fi
  echo "Waiting for application to start... ($i/30)"
  sleep 2
done

echo "Health check failed after 60 seconds"
exit 1
```

---

## 5. Monitoring and Troubleshooting

### 5.1 Health Monitoring

```
EB Health Dashboard

  Overall Environment: ● OK (Green)

  Per-Instance Health:
  +-------------+--------+---------+----------+--------+
  | Instance ID | Status | CPU (%) | Req/sec  | P99(ms)|
  +-------------+--------+---------+----------+--------+
  | i-aaa       | ● OK   | 35      | 120      | 45     |
  | i-bbb       | ● OK   | 42      | 115      | 52     |
  | i-ccc       | ▲ Warn | 78      | 95       | 250    |
  +-------------+--------+---------+----------+--------+

  Health Colors:
  ● Green  = Healthy
  ● Yellow = Warning (including during deployment)
  ● Red    = Unhealthy (action required)
  ● Grey   = Insufficient data

  Enhanced Health Metrics:
  - ApplicationRequests*: Request count per HTTP status code
  - ApplicationLatencyP*: Latency percentiles (P50, P90, P99)
  - InstanceHealth: Instance-level health information
  - CPUUtilization, LoadAverage, RootFilesystemUtil
```

### 5.2 Code Example: Retrieving and Reviewing Logs

```bash
# 最新のログを取得
eb logs

# 完全なログバンドルを取得
eb logs --all

# 特定のインスタンスのログ
eb logs --instance i-0123456789abcdef0

# ログをストリーミング
eb logs --stream

# SSH で直接確認
eb ssh
# EB エンジンログ:       /var/log/eb-engine.log
# NGINX アクセスログ:     /var/log/nginx/access.log
# NGINX エラーログ:       /var/log/nginx/error.log
# アプリ stdout:          /var/log/web.stdout.log
# アプリ stderr:          /var/log/web.stderr.log
# EB フックログ:          /var/log/eb-hooks.log
# デプロイログ:           /var/log/eb-activity.log
```

### 5.3 CloudWatch Logs Streaming

```yaml
# .ebextensions/06-logging.config
option_settings:
  aws:elasticbeanstalk:cloudwatch:logs:
    StreamLogs: true
    DeleteOnTerminate: false
    RetentionInDays: 30

  aws:elasticbeanstalk:cloudwatch:logs:health:
    HealthStreamingEnabled: true
    DeleteOnTerminate: false
    RetentionInDays: 7

# Adding custom log files
files:
  "/opt/elasticbeanstalk/tasks/bundlelogs.d/app-logs.conf":
    mode: "000644"
    owner: root
    group: root
    content: |
      /var/app/current/logs/*.log

  "/opt/elasticbeanstalk/tasks/taillogs.d/app-logs.conf":
    mode: "000644"
    owner: root
    group: root
    content: |
      /var/app/current/logs/*.log
```

### 5.4 Troubleshooting Checklist

| Symptom | Where to Check | Resolution |
|------|---------|--------|
| Deployment failure | `/var/log/eb-engine.log` | Check for command execution errors |
| 502 Bad Gateway | NGINX to app connection | Check port number and app startup status |
| Health check failure | `/health` endpoint | Check SG, path, and response code |
| Environment is Red | Enhanced health details | Check per-instance status with `eb health` |
| Out of memory | CloudWatch metrics | Scale up instance type |
| Disk space full | `/var/log`, `/tmp` | Delete old deployment versions |

```bash
# Troubleshooting command collection

# Detailed environment status
eb health --refresh

# Event list (check for errors)
eb events -f

# Dump environment configuration
eb config

# Rebuild environment (last resort)
eb rebuild

# SSH in and check logs
eb ssh --command "tail -100 /var/log/eb-engine.log"

# Check instance health via AWS CLI
aws elasticbeanstalk describe-instances-health \
  --environment-name production-env \
  --attribute-names All \
  --output table
```

---

## 6. Blue/Green Deployment

```
Blue/Green Deployment Flow

  1. Current environment (Blue)
     production.example.com → Blue Environment

  2. Create new environment (Green)
     eb clone production-env --clone-name green-env

  3. Deploy and test on Green environment
     eb deploy green-env

  4. URL Swap
     eb swap production-env --destination-name green-env
     production.example.com → Green Environment

  5. If issues arise, swap again to rollback
     eb swap production-env --destination-name green-env
     production.example.com → Blue Environment (reverted)
```

```bash
# Blue/Green デプロイの実行
# 1. 現在の環境をクローン
eb clone production-env --clone-name green-env \
  --tags Environment=green,Release=v2.0

# 2. Green 環境の作成完了を待つ
eb status green-env

# 3. Green 環境にデプロイ
eb deploy green-env --label v2.0

# 4. Green 環境でテスト
GREEN_URL=$(aws elasticbeanstalk describe-environments \
  --environment-names green-env \
  --query 'Environments[0].CNAME' --output text)
curl -f "http://$GREEN_URL/health"

# 5. テスト完了後、URL スワップ
eb swap production-env --destination-name green-env

# 6. 旧環境を削除（問題なければ）
eb terminate green-env --force
```

### 6.1 Blue/Green Deployment Automation Script

```bash
#!/bin/bash
# blue-green-deploy.sh
set -euo pipefail

APP_NAME="my-web-app"
BLUE_ENV="production-env"
GREEN_ENV="green-env"
VERSION_LABEL="v$(date +%Y%m%d-%H%M%S)"
HEALTH_CHECK_URL="/health"

echo "=== Blue/Green Deploy: $VERSION_LABEL ==="

# 1. Create Green environment (skip if already exists)
if aws elasticbeanstalk describe-environments \
  --environment-names $GREEN_ENV \
  --query 'Environments[?Status!=`Terminated`]' \
  --output text | grep -q "$GREEN_ENV"; then
  echo "Green environment already exists, reusing..."
else
  echo "Creating green environment..."
  eb clone $BLUE_ENV --clone-name $GREEN_ENV
  echo "Waiting for green environment to be ready..."
  aws elasticbeanstalk wait environment-updated \
    --environment-name $GREEN_ENV
fi

# 2. Deploy to Green environment
echo "Deploying to green environment..."
eb deploy $GREEN_ENV --label $VERSION_LABEL

# 3. Health check
echo "Running health checks..."
GREEN_URL=$(aws elasticbeanstalk describe-environments \
  --environment-names $GREEN_ENV \
  --query 'Environments[0].CNAME' --output text)

for i in $(seq 1 10); do
  if curl -sf "http://$GREEN_URL$HEALTH_CHECK_URL" > /dev/null; then
    echo "Health check passed!"
    break
  fi
  echo "Health check attempt $i/10 failed, retrying..."
  sleep 10
done

# 4. URL Swap
echo "Swapping URLs..."
eb swap $BLUE_ENV --destination-name $GREEN_ENV

echo "=== Blue/Green Deploy Complete ==="
echo "New production URL: $GREEN_URL"
```

---

## 7. Docker Platform

### 7.1 Single Container Docker

```dockerfile
# Dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json .
EXPOSE 8080
CMD ["node", "dist/server.js"]
```

```json
// Dockerrun.aws.json (v1 — Single container)
{
  "AWSEBDockerrunVersion": "1",
  "Image": {
    "Name": "123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/my-app:latest",
    "Update": "true"
  },
  "Ports": [
    {
      "ContainerPort": 8080,
      "HostPort": 80
    }
  ],
  "Logging": "/var/log/app"
}
```

### 7.2 Multi-Container Docker (docker-compose)

```yaml
# docker-compose.yml
version: '3.8'
services:
  web:
    image: 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/my-app:latest
    ports:
      - "80:8080"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - redis
    restart: always
    logging:
      driver: awslogs
      options:
        awslogs-group: /eb/my-app/web
        awslogs-region: ap-northeast-1
        awslogs-stream-prefix: web

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    restart: always

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - web
    restart: always
```

---

## 8. Managed Platform Updates

### 8.1 Managed Platform Update Configuration

```yaml
# .ebextensions/managed-updates.config
option_settings:
  aws:elasticbeanstalk:managedactions:
    ManagedActionsEnabled: true
    PreferredStartTime: "Sun:02:00"
    ServiceRoleForManagedUpdates: "aws-elasticbeanstalk-service-role"

  aws:elasticbeanstalk:managedactions:platformupdate:
    UpdateLevel: minor
    InstanceRefreshEnabled: true
```

```bash
# プラットフォーム更新の状態確認
aws elasticbeanstalk describe-environment-managed-actions \
  --environment-name production-env

# 手動でプラットフォーム更新を適用
aws elasticbeanstalk apply-environment-managed-action \
  --environment-name production-env \
  --action-id managed-action-id

# 利用可能なプラットフォームバージョンの確認
aws elasticbeanstalk list-available-solution-stacks \
  --query 'SolutionStacks[?contains(@, `Python`)]'
```

---

## 9. RDS Integration

### 9.1 Directly Associating RDS with an EB Environment (For Development)

```yaml
# .ebextensions/rds.config（開発環境のみ推奨）
option_settings:
  aws:rds:dbinstance:
    DBEngine: postgres
    DBEngineVersion: 16.1
    DBInstanceClass: db.t3.micro
    DBAllocatedStorage: 20
    DBPassword: initial-password
    DBUser: ebroot
    DBDeletionPolicy: Delete
    MultiAZDatabase: false
```

### 9.2 Using an External RDS (Recommended for Production)

```bash
# 環境変数で RDS 接続情報を設定
eb setenv \
  RDS_HOSTNAME=my-db.xxxx.ap-northeast-1.rds.amazonaws.com \
  RDS_PORT=5432 \
  RDS_DB_NAME=myapp \
  RDS_USERNAME=admin \
  RDS_PASSWORD=secret-from-secrets-manager

# Secrets Manager から動的に取得する場合
# .platform/hooks/predeploy/00_fetch_secrets.sh
#!/bin/bash
SECRET=$(aws secretsmanager get-secret-value \
  --secret-id my-app/production/db \
  --query 'SecretString' --output text)
export RDS_PASSWORD=$(echo $SECRET | jq -r '.password')
```

---

## 10. Anti-Patterns

### Anti-Pattern 1: Managing All Configuration Manually via Console

Settings changed in the console are not reproducible, and omissions occur when rebuilding environments. They should be codified with `.ebextensions` and `.platform` and managed with Git.

```
# Bad example
Manually changing NGINX settings in the console
→ Settings are lost when rebuilding the environment
→ Other team members are unaware of the settings

# Good example
Describe settings in .platform/nginx/conf.d/custom.conf
→ Automatically applied with every deployment
→ Change history trackable via Git
```

### Anti-Pattern 2: Using All at Once Deployment in Production

Since all instances are updated simultaneously, downtime occurs during deployment. Use Rolling with Additional Batch or Immutable for production environments.

### Anti-Pattern 3: Directly Associating RDS with EB Environment (Production)

When the EB environment is terminated, the associated RDS is also deleted. Always use an external RDS for production environments and pass connection information via environment variables.

```
# Bad example (Production)
Associate RDS with EB environment
→ eb terminate deletes the RDS as well
→ Blue/Green deployment creates a separate DB

# Good example (Production)
Manage RDS separately with Terraform/CloudFormation
→ Not affected by EB environment termination
→ Both Blue/Green environments share the same DB
```

### Anti-Pattern 4: Setting Secrets Directly in Environment Variables

```bash
# 悪い例
eb setenv DB_PASSWORD=PlainTextPassword123!
# → EB コンソールで誰でも閲覧可能

# 良い例 — Secrets Manager を使用
eb setenv DB_SECRET_ARN=arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:my-db-creds
# → アプリ側で Secrets Manager から動的に取得
```

### Anti-Pattern 5: Not Configuring .ebignore

```bash
# 悪い例 — 全ファイルをデプロイ
# .git ディレクトリや node_modules が含まれ、デプロイが遅い

# 良い例 — .ebignore で不要ファイルを除外
# .ebignore
.git
__pycache__
*.pyc
.env
.venv
node_modules
tests/
docs/
*.sqlite3
.DS_Store
```


---

## Hands-On Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

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

Extend the basic implementation by adding the following features.

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
- Be conscious of algorithm computational complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks
---

## 11. FAQ

### Q1. Should I choose Elastic Beanstalk or ECS/Fargate?

| Aspect | Elastic Beanstalk | ECS / Fargate |
|------|------------------|--------------|
| Operational complexity | Low | Medium to High |
| Customizability | Moderate | High |
| Container support | Docker platform | Native |
| Sidecars | Difficult | Easy |
| Service mesh | Not supported | App Mesh supported |
| Target users | Small to medium teams | Large-scale / microservices |

Beanstalk's advantage is its simplicity of "just deploying an application." If you need detailed control over container orchestration (sidecar patterns, service mesh, etc.), choose ECS/Fargate.

### Q2. What does Elastic Beanstalk cost?

Beanstalk itself is free; you only pay for the underlying EC2, ALB, RDS, and other resources. However, the ALB and scaling settings that Beanstalk automatically creates can generate costs beyond expectations, so verify the resources being created. Terminate unnecessary environments promptly.

### Q3. How do I set up a custom domain and HTTPS?

Point the domain to the ALB with an ALIAS record in Route 53, obtain an SSL certificate with ACM (AWS Certificate Manager), and configure it on the ALB listener. You can automate the HTTPS listener configuration with `.ebextensions`.

```yaml
# .ebextensions/https.config
option_settings:
  aws:elbv2:listener:443:
    Protocol: HTTPS
    SSLCertificateArns: arn:aws:acm:ap-northeast-1:123456789012:certificate/xxx
    SSLPolicy: ELBSecurityPolicy-TLS13-1-2-2021-06

  # HTTP → HTTPS redirect
  aws:elbv2:listener:80:
    DefaultProcess: default
    ListenerEnabled: true
    Protocol: HTTP
    Rules: redirect-to-https

  aws:elbv2:listenerrule:redirect-to-https:
    PathPatterns: /*
    Process: default
    Priority: 1
```

### Q4. How do I migrate an EB environment configuration to another account?

```bash
# 環境設定をエクスポート
eb config save production-env --cfg saved-config

# エクスポートされたファイルを確認
cat .elasticbeanstalk/saved_configs/saved-config.cfg.yml

# 別のアカウントで設定を適用
eb create new-production-env --cfg saved-config
```

### Q5. How do I SSH into EB environment instances?

```bash
# EB CLI で SSH 接続
eb ssh

# 特定のインスタンスに接続
eb ssh --instance i-0123456789abcdef0

# Session Manager の方が推奨
aws ssm start-session --target i-0123456789abcdef0
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What are common mistakes beginners make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this knowledge applied in practice?

Knowledge of this topic is frequently used in daily development work. It becomes particularly important during code reviews and architecture design.

---

## 12. Summary

| Item | Key Points |
|------|---------|
| Positioning | PaaS that manages EC2 + ALB + ASG together |
| Platforms | Node.js, Python, Java, Go, .NET, Docker, etc. (AL2023 required) |
| Deployment strategy | Immutable or Traffic Splitting recommended for production |
| Customization | Manage declaratively with .ebextensions and .platform |
| Blue/Green | Switch URLs with eb swap for fast rollback |
| Monitoring | Enhanced health + CloudWatch Logs streaming |
| RDS | Use external RDS for production, pass connection info via env vars |
| Secrets | Manage with Secrets Manager, never store plaintext in env vars |
| Docker | Deploy flexibly with single container or docker-compose |

---

## 13. CloudFormation / CDK EB Environment Definitions

### 13.1 CloudFormation Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: Elastic Beanstalk Application with VPC-aware Environment

Parameters:
  AppName:
    Type: String
    Default: my-web-app
  VpcId:
    Type: AWS::EC2::VPC::Id
  PublicSubnets:
    Type: List<AWS::EC2::Subnet::Id>
    Description: Public subnets for ALB
  PrivateSubnets:
    Type: List<AWS::EC2::Subnet::Id>
    Description: Private subnets for EC2
  CertificateArn:
    Type: String
    Description: ACM certificate ARN
  InstanceType:
    Type: String
    Default: t3.small
    AllowedValues: [t3.micro, t3.small, t3.medium, t3.large]

Resources:
  Application:
    Type: AWS::ElasticBeanstalk::Application
    Properties:
      ApplicationName: !Ref AppName
      Description: !Sub '${AppName} Elastic Beanstalk Application'
      ResourceLifecycleConfig:
        ServiceRole: !Sub 'arn:aws:iam::${AWS::AccountId}:role/aws-elasticbeanstalk-service-role'
        VersionLifecycleConfig:
          MaxCountRule:
            DeleteSourceFromS3: true
            Enabled: true
            MaxCount: 10

  Environment:
    Type: AWS::ElasticBeanstalk::Environment
    Properties:
      ApplicationName: !Ref Application
      EnvironmentName: !Sub '${AppName}-production'
      SolutionStackName: '64bit Amazon Linux 2023 v6.1.0 running Python 3.12'
      Tier:
        Name: WebServer
        Type: Standard
      OptionSettings:
        # VPC settings
        - Namespace: aws:ec2:vpc
          OptionName: VPCId
          Value: !Ref VpcId
        - Namespace: aws:ec2:vpc
          OptionName: Subnets
          Value: !Join [',', !Ref PrivateSubnets]
        - Namespace: aws:ec2:vpc
          OptionName: ELBSubnets
          Value: !Join [',', !Ref PublicSubnets]
        - Namespace: aws:ec2:vpc
          OptionName: AssociatePublicIpAddress
          Value: 'false'

        # Instance settings
        - Namespace: aws:autoscaling:launchconfiguration
          OptionName: InstanceType
          Value: !Ref InstanceType
        - Namespace: aws:autoscaling:launchconfiguration
          OptionName: IamInstanceProfile
          Value: aws-elasticbeanstalk-ec2-role

        # Auto Scaling
        - Namespace: aws:autoscaling:asg
          OptionName: MinSize
          Value: '2'
        - Namespace: aws:autoscaling:asg
          OptionName: MaxSize
          Value: '6'

        # ALB
        - Namespace: aws:elasticbeanstalk:environment
          OptionName: LoadBalancerType
          Value: application
        - Namespace: aws:elbv2:listener:443
          OptionName: Protocol
          Value: HTTPS
        - Namespace: aws:elbv2:listener:443
          OptionName: SSLCertificateArns
          Value: !Ref CertificateArn

        # Deployment strategy
        - Namespace: aws:elasticbeanstalk:command
          OptionName: DeploymentPolicy
          Value: Immutable
        - Namespace: aws:elasticbeanstalk:command
          OptionName: Timeout
          Value: '600'

        # Health check
        - Namespace: aws:elasticbeanstalk:application
          OptionName: Application Healthcheck URL
          Value: /health

        # Enhanced health reporting
        - Namespace: aws:elasticbeanstalk:healthreporting:system
          OptionName: SystemType
          Value: enhanced

        # CloudWatch Logs
        - Namespace: aws:elasticbeanstalk:cloudwatch:logs
          OptionName: StreamLogs
          Value: 'true'
        - Namespace: aws:elasticbeanstalk:cloudwatch:logs
          OptionName: RetentionInDays
          Value: '30'

        # Managed updates
        - Namespace: aws:elasticbeanstalk:managedactions
          OptionName: ManagedActionsEnabled
          Value: 'true'
        - Namespace: aws:elasticbeanstalk:managedactions
          OptionName: PreferredStartTime
          Value: 'Sun:02:00'
        - Namespace: aws:elasticbeanstalk:managedactions:platformupdate
          OptionName: UpdateLevel
          Value: minor

Outputs:
  EnvironmentURL:
    Value: !GetAtt Environment.EndpointURL
    Description: EB environment URL
  EnvironmentName:
    Value: !Ref Environment
    Description: EB environment name
```

### 13.2 CDK (TypeScript) Definition

```typescript
import * as cdk from 'aws-cdk-lib';
import * as elasticbeanstalk from 'aws-cdk-lib/aws-elasticbeanstalk';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3assets from 'aws-cdk-lib/aws-s3-assets';
import { Construct } from 'constructs';

export class EbStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // EC2 instance profile
    const role = new iam.Role(this, 'EbInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSElasticBeanstalkWebTier'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    const instanceProfile = new iam.CfnInstanceProfile(this, 'EbInstanceProfile', {
      roles: [role.roleName],
    });

    // Application
    const app = new elasticbeanstalk.CfnApplication(this, 'App', {
      applicationName: 'my-web-app',
      resourceLifecycleConfig: {
        serviceRole: `arn:aws:iam::${this.account}:role/aws-elasticbeanstalk-service-role`,
        versionLifecycleConfig: {
          maxCountRule: {
            enabled: true,
            maxCount: 10,
            deleteSourceFromS3: true,
          },
        },
      },
    });

    // Environment
    const env = new elasticbeanstalk.CfnEnvironment(this, 'Env', {
      applicationName: app.applicationName!,
      environmentName: 'my-web-app-production',
      solutionStackName: '64bit Amazon Linux 2023 v6.1.0 running Python 3.12',
      optionSettings: [
        { namespace: 'aws:autoscaling:launchconfiguration', optionName: 'IamInstanceProfile', value: instanceProfile.ref },
        { namespace: 'aws:autoscaling:launchconfiguration', optionName: 'InstanceType', value: 't3.small' },
        { namespace: 'aws:autoscaling:asg', optionName: 'MinSize', value: '2' },
        { namespace: 'aws:autoscaling:asg', optionName: 'MaxSize', value: '6' },
        { namespace: 'aws:elasticbeanstalk:environment', optionName: 'LoadBalancerType', value: 'application' },
        { namespace: 'aws:elasticbeanstalk:command', optionName: 'DeploymentPolicy', value: 'Immutable' },
        { namespace: 'aws:elasticbeanstalk:healthreporting:system', optionName: 'SystemType', value: 'enhanced' },
        { namespace: 'aws:elasticbeanstalk:cloudwatch:logs', optionName: 'StreamLogs', value: 'true' },
        { namespace: 'aws:elasticbeanstalk:cloudwatch:logs', optionName: 'RetentionInDays', value: '30' },
      ],
    });

    env.addDependency(app);

    new cdk.CfnOutput(this, 'EndpointURL', {
      value: env.attrEndpointUrl,
    });
  }
}
```

---

## Recommended Next Guides

- [../02-storage/00-s3-basics.md](../02-storage/00-s3-basics.md) -- S3 Basics
- [../03-database/00-rds-basics.md](../03-database/00-rds-basics.md) -- RDS Basics

---

## References

1. AWS Elastic Beanstalk Developer Guide -- https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/
2. EB CLI Command Reference -- https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb-cli3.html
3. Elastic Beanstalk Deployment Policies -- https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/using-features.rolling-version-deploy.html
4. .ebextensions Configuration Guide -- https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/ebextensions.html
5. Platform Hooks -- https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/platforms-linux-extend.html
6. Docker Platform -- https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/create_deploy_docker.html

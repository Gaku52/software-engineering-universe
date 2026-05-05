# Amazon ECS Basics

> A systematic guide to the core concepts of Amazon Elastic Container Service (ECS): task definitions, services, the differences between Fargate and EC2 launch types, ALB integration, and log configuration.

---

## What You Will Learn

1. **ECS Architecture and Core Concepts** -- Understand the relationships between clusters, task definitions, services, and tasks
2. **Choosing Between Fargate and EC2 Launch Types** -- Compare the characteristics, costs, and constraints of each launch type to make the right choice
3. **ALB Integration and Log Configuration** -- Configure load balancer traffic distribution and log output to CloudWatch Logs
4. **Deployment Strategies** -- Learn rolling update, Blue/Green deployment, and circuit breaker configuration
5. **ECS Exec and Debugging** -- Interactive access to running containers and troubleshooting techniques
6. **Codifying ECS Configuration with CloudFormation / CDK** -- Create practical templates to manage infrastructure as code


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. ECS Architecture

### 1.1 Core Concept Relationships

```
ECS Hierarchical Structure:

+------------------------------------------+
|  ECS Cluster                              |
|  +--------------------------------------+ |
|  |  Service A (Desired Count: 3)        | |
|  |  +----------+ +----------+ +--------+| |
|  |  | Task 1   | | Task 2   | | Task 3 || |
|  |  | +------+ | | +------+ | | +------+| |
|  |  | |Cont- | | | |Cont- | | | |Cont- || |
|  |  | |ainer | | | |ainer | | | |ainer || |
|  |  | |  A   | | | |  A   | | | |  A   || |
|  |  | +------+ | | +------+ | | +------+| |
|  |  | |Cont- | | | |Cont- | | | |Cont- || |
|  |  | |ainer | | | |ainer | | | |ainer || |
|  |  | |  B   | | | |  B   | | | |  B   || |
|  |  | +------+ | | +------+ | | +------+| |
|  |  +----------+ +----------+ +--------+| |
|  +--------------------------------------+ |
|  +--------------------------------------+ |
|  |  Service B (Desired Count: 2)        | |
|  |  +----------+ +----------+            | |
|  |  | Task 1   | | Task 2   |            | |
|  |  +----------+ +----------+            | |
|  +--------------------------------------+ |
+------------------------------------------+
```

| Concept | Description |
|------|------|
| Cluster | Logical grouping of tasks and services |
| Task Definition | Blueprint for containers (image, CPU, memory, ports, etc.) |
| Task | Instance of a task definition (group of running containers) |
| Service | Scheduler that maintains the desired number of tasks |
| Container Definition | Individual container settings within a task definition |

### 1.2 ECS Data Plane

```
Control Plane (AWS Managed)
+----------------------------+
|  ECS API / Scheduler       |
+----------------------------+
         |           |
         v           v
   +-----------+ +-----------+
   | Fargate   | | EC2       |
   | (Server-  | | (Self-    |
   |  less)    | |  Managed  |
   |           | |  Instances)|
   +-----------+ +-----------+
   | MicroVM   | | EC2       |
   | Auto Mgmt | | ECS Agent |
   | No Patch  | | AMI Mgmt  |
   +-----------+ +-----------+
```

### 1.3 Key ECS Component Details

```
ECS Ecosystem Overview:

+-------------------------------------------------------------+
|  Amazon ECS                                                 |
|                                                             |
|  +-------------------+  +------------------+                |
|  | ECR               |  | Service Connect  |                |
|  | (Container        |  | (Service-to-     |                |
|  |  Registry)        |  |  Service Comm.)  |                |
|  +-------------------+  +------------------+                |
|                                                             |
|  +-------------------+  +------------------+                |
|  | Task Definition   |  | Capacity Provider|                |
|  | (Task Blueprint)  |  | (Capacity Mgmt)  |                |
|  +-------------------+  +------------------+                |
|                                                             |
|  +-------------------+  +------------------+                |
|  | Service           |  | Cluster          |                |
|  | (Service Mgmt)    |  | (Cluster)        |                |
|  +-------------------+  +------------------+                |
|                                                             |
|  Data Plane:                                                |
|  +-------------------+  +------------------+                |
|  | AWS Fargate       |  | EC2 Instances    |                |
|  | (Serverless)      |  | (Self-Managed)   |                |
|  +-------------------+  +------------------+                |
|                                                             |
|  Integrated Services:                                       |
|  +--------+ +--------+ +--------+ +--------+ +--------+    |
|  | ALB    | | NLB    | | CloudMap| | X-Ray  | | CW Logs|    |
|  +--------+ +--------+ +--------+ +--------+ +--------+    |
+-------------------------------------------------------------+
```

---

## 2. Task Definitions

### 2.1 Basic Task Definition

```json
{
  "family": "my-web-app",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::123456789012:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "web",
      "image": "123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/my-app:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "8080"}
      ],
      "secrets": [
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:db-password"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/my-web-app",
          "awslogs-region": "ap-northeast-1",
          "awslogs-stream-prefix": "web"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

### 2.2 Fargate CPU/Memory Combinations

| CPU (vCPU) | Memory (GB) |
|-----------|------------|
| 0.25 | 0.5, 1, 2 |
| 0.5 | 1, 2, 3, 4 |
| 1 | 2, 3, 4, 5, 6, 7, 8 |
| 2 | 4 - 16 (1GB increments) |
| 4 | 8 - 30 (1GB increments) |
| 8 | 16 - 60 (4GB increments) |
| 16 | 32 - 120 (8GB increments) |

### 2.3 Multi-Container Task Definition (Sidecar Pattern)

```json
{
  "family": "web-with-sidecar",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "web",
      "image": "123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/my-app:latest",
      "essential": true,
      "portMappings": [{"containerPort": 8080}],
      "dependsOn": [
        {"containerName": "envoy", "condition": "HEALTHY"}
      ]
    },
    {
      "name": "envoy",
      "image": "public.ecr.aws/appmesh/aws-appmesh-envoy:v1.27",
      "essential": true,
      "portMappings": [{"containerPort": 9901}],
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -s http://localhost:9901/server_info | grep state"],
        "interval": 10,
        "timeout": 5,
        "retries": 3
      },
      "memory": 256
    },
    {
      "name": "xray-daemon",
      "image": "public.ecr.aws/xray/aws-xray-daemon:latest",
      "essential": false,
      "portMappings": [{"containerPort": 2000, "protocol": "udp"}],
      "memory": 128
    }
  ]
}
```

### 2.4 Task Definition Execution Role vs Task Role

```
Role Differences:

Execution Role:
  Role used by the ECS agent
  +--------------------------------------+
  | Purpose:                              |
  |   - Pulling images from ECR           |
  |   - Writing logs to CloudWatch Logs   |
  |   - Retrieving secrets from Secrets Manager|
  |   - Retrieving values from SSM Parameter Store|
  +--------------------------------------+

Task Role:
  Role used by the application inside the container
  +--------------------------------------+
  | Purpose:                              |
  |   - Accessing DynamoDB                |
  |   - Accessing S3 buckets              |
  |   - Sending messages to SQS queues    |
  |   - Accessing other AWS services      |
  +--------------------------------------+
```

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRAccess",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:CreateLogGroup"
      ],
      "Resource": "arn:aws:logs:ap-northeast-1:123456789012:log-group:/ecs/*"
    },
    {
      "Sid": "SecretsManagerAccess",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:prod/*"
    },
    {
      "Sid": "SSMParameterAccess",
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameters",
        "ssm:GetParameter"
      ],
      "Resource": "arn:aws:ssm:ap-northeast-1:123456789012:parameter/prod/*"
    }
  ]
}
```

### 2.5 Managing Task Definitions with AWS CLI

```bash
# Register a task definition
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json

# List task definitions
aws ecs list-task-definitions --family-prefix my-web-app

# Show details of a specific task definition
aws ecs describe-task-definition \
  --task-definition my-web-app:3

# Compare task definition revisions
aws ecs describe-task-definition --task-definition my-web-app:2 \
  --query 'taskDefinition.containerDefinitions[0].image'
aws ecs describe-task-definition --task-definition my-web-app:3 \
  --query 'taskDefinition.containerDefinitions[0].image'

# Deregister an old task definition
aws ecs deregister-task-definition \
  --task-definition my-web-app:1

# Run a standalone task (for batch processing, etc.)
aws ecs run-task \
  --cluster my-cluster \
  --task-definition my-batch-job:1 \
  --launch-type FARGATE \
  --count 1 \
  --network-configuration '{
    "awsvpcConfiguration": {
      "subnets": ["subnet-11111111", "subnet-22222222"],
      "securityGroups": ["sg-12345678"],
      "assignPublicIp": "DISABLED"
    }
  }' \
  --overrides '{
    "containerOverrides": [
      {
        "name": "batch-processor",
        "environment": [
          {"name": "BATCH_ID", "value": "batch-20240115-001"}
        ]
      }
    ]
  }'
```

---

## 3. Fargate vs EC2 Launch Type

### 3.1 Comparison Table

| Characteristic | Fargate | EC2 |
|------|---------|-----|
| Infrastructure Management | Not required | EC2 instance management required |
| Patching | AWS manages automatically | User updates AMI |
| Scaling | Automatic per task | ASG + task placement |
| GPU Support | No | Yes |
| Network Mode | awsvpc only | awsvpc, bridge, host, none |
| Max CPU/Memory | 16 vCPU / 120 GB | Depends on instance type |
| Spot Usage | Fargate Spot | EC2 Spot |
| Startup Speed | 30-60 seconds | Immediate (if instance already running) |
| Pricing Model | Per vCPU + memory second | EC2 instance pricing |
| EBS Volume | 20-200 GB ephemeral storage | Depends on instance |
| Privileged Container | Not allowed | Allowed |
| Docker-in-Docker | Not allowed | Allowed |

### 3.2 Cost Comparison Estimates

```
Monthly cost estimate (Tokyo Region, 24/7 operation, 1 vCPU / 2GB memory):

Fargate:
  vCPU: $0.05056/hr x 24hr x 30 days = $36.40
  Memory: $0.00553/GB/hr x 2GB x 24hr x 30 days = $7.96
  Total: approx. $44.36/month/task

Fargate Spot:
  approx. $44.36 x 0.3 = approx. $13.31/month/task (up to 70% discount)

EC2 (t3.small On-Demand):
  $0.0272/hr x 24hr x 30 days = $19.58/month
  * For a single task. Multiple tasks can be placed on the same instance.

EC2 (t3.small Reserved 1-year):
  approx. $12.48/month

Conclusion:
  - Small number of tasks: EC2 is cheaper
  - Including operational costs: Fargate often has a lower TCO
  - Burst handling: Fargate Spot is most cost-efficient
```

### 3.3 Flexible Infrastructure Management with Capacity Providers

```
How Capacity Providers Work:

+------------------------------------------+
|  ECS Cluster                              |
|                                          |
|  Capacity Provider Strategy:             |
|  +--------------------------------------+|
|  | FARGATE       : weight=1, base=2     ||
|  | FARGATE_SPOT  : weight=3, base=0     ||
|  +--------------------------------------+|
|                                          |
|  Result:                                 |
|  With 5 tasks:                           |
|    FARGATE: 2 (base) + 0 = 2 tasks       |
|    FARGATE_SPOT: 0 (base) + 3 = 3 tasks  |
|                                          |
|  With 10 tasks:                          |
|    FARGATE: 2 (base) + 2 = 4 tasks       |
|    FARGATE_SPOT: 0 (base) + 6 = 6 tasks  |
+------------------------------------------+
```

```bash
# Configure Capacity Providers
aws ecs put-cluster-capacity-providers \
  --cluster my-cluster \
  --capacity-providers FARGATE FARGATE_SPOT \
  --default-capacity-provider-strategy \
    capacityProvider=FARGATE,weight=1,base=2 \
    capacityProvider=FARGATE_SPOT,weight=3,base=0

# Create EC2 Capacity Provider
aws ecs create-capacity-provider \
  --name my-ec2-capacity-provider \
  --auto-scaling-group-provider '{
    "autoScalingGroupArn": "arn:aws:autoscaling:ap-northeast-1:123456789012:autoScalingGroup:...",
    "managedScaling": {
      "status": "ENABLED",
      "targetCapacity": 80,
      "minimumScalingStepSize": 1,
      "maximumScalingStepSize": 10,
      "instanceWarmupPeriod": 300
    },
    "managedTerminationProtection": "ENABLED"
  }'
```

---

## 4. Creating and Managing Services

### 4.1 Creating an ECS Service

```bash
# Create a cluster
aws ecs create-cluster --cluster-name my-cluster

# Create a service
aws ecs create-service \
  --cluster my-cluster \
  --service-name my-web-service \
  --task-definition my-web-app:1 \
  --desired-count 3 \
  --launch-type FARGATE \
  --platform-version LATEST \
  --network-configuration '{
    "awsvpcConfiguration": {
      "subnets": ["subnet-11111111", "subnet-22222222"],
      "securityGroups": ["sg-12345678"],
      "assignPublicIp": "DISABLED"
    }
  }' \
  --load-balancers '[
    {
      "targetGroupArn": "arn:aws:elasticloadbalancing:...:targetgroup/my-tg/...",
      "containerName": "web",
      "containerPort": 8080
    }
  ]' \
  --deployment-configuration '{
    "maximumPercent": 200,
    "minimumHealthyPercent": 100,
    "deploymentCircuitBreaker": {
      "enable": true,
      "rollback": true
    }
  }'

# Update a service (deploy with a new task definition)
aws ecs update-service \
  --cluster my-cluster \
  --service my-web-service \
  --task-definition my-web-app:2 \
  --force-new-deployment

# Check service status
aws ecs describe-services \
  --cluster my-cluster \
  --services my-web-service \
  --query 'services[0].{
    Status: status,
    DesiredCount: desiredCount,
    RunningCount: runningCount,
    PendingCount: pendingCount,
    TaskDefinition: taskDefinition,
    Deployments: deployments[*].{
      Status: status,
      DesiredCount: desiredCount,
      RunningCount: runningCount,
      TaskDefinition: taskDefinition
    }
  }'
```

### 4.2 Configuring Auto Scaling

```bash
# Register Application Auto Scaling target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id "service/my-cluster/my-web-service" \
  --scalable-dimension "ecs:service:DesiredCount" \
  --min-capacity 2 \
  --max-capacity 20

# Target tracking scaling policy (CPU)
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id "service/my-cluster/my-web-service" \
  --scalable-dimension "ecs:service:DesiredCount" \
  --policy-name "cpu-target-tracking" \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    },
    "ScaleInCooldown": 300,
    "ScaleOutCooldown": 60
  }'

# Target tracking scaling policy (Memory)
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id "service/my-cluster/my-web-service" \
  --scalable-dimension "ecs:service:DesiredCount" \
  --policy-name "memory-target-tracking" \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 75.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageMemoryUtilization"
    },
    "ScaleInCooldown": 300,
    "ScaleOutCooldown": 60
  }'

# ALB request count-based scaling
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id "service/my-cluster/my-web-service" \
  --scalable-dimension "ecs:service:DesiredCount" \
  --policy-name "alb-request-count-tracking" \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 1000.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ALBRequestCountPerTarget",
      "ResourceLabel": "app/my-alb/1234567890/targetgroup/my-tg/1234567890"
    },
    "ScaleInCooldown": 300,
    "ScaleOutCooldown": 60
  }'

# Schedule-based scaling
aws application-autoscaling put-scheduled-action \
  --service-namespace ecs \
  --resource-id "service/my-cluster/my-web-service" \
  --scalable-dimension "ecs:service:DesiredCount" \
  --scheduled-action-name "scale-up-morning" \
  --schedule "cron(0 8 * * ? *)" \
  --scalable-target-action "MinCapacity=5,MaxCapacity=30"

aws application-autoscaling put-scheduled-action \
  --service-namespace ecs \
  --resource-id "service/my-cluster/my-web-service" \
  --scalable-dimension "ecs:service:DesiredCount" \
  --scheduled-action-name "scale-down-night" \
  --schedule "cron(0 22 * * ? *)" \
  --scalable-target-action "MinCapacity=2,MaxCapacity=10"
```

---

## 5. Deployment Strategies

### 5.1 Rolling Update

```
Rolling Update Flow (minimumHealthyPercent=100, maximumPercent=200):

Time T0: Initial state
  [v1] [v1] [v1]  (3 tasks running)

Time T1: New tasks starting
  [v1] [v1] [v1] [v2] [v2] [v2]  (up to 6 tasks allowed)

Time T2: New tasks become healthy
  [v1] [v1] [v1] [v2:healthy] [v2:healthy] [v2:healthy]

Time T3: Old tasks stopped
  [v2] [v2] [v2]  (back to 3 tasks)

Deployment time: a few minutes to ~10 minutes
Downtime: none
```

### 5.2 Blue/Green Deployment (CodeDeploy)

```
Blue/Green Deployment Flow:

Phase 1: Blue (current) is running
  ALB --> Target Group 1 (Blue)
          [v1] [v1] [v1]

Phase 2: Green (new version) starts
  ALB --> Target Group 1 (Blue)
          [v1] [v1] [v1]
          Target Group 2 (Green)  <-- validate via test listener
          [v2] [v2] [v2]

Phase 3: Switch traffic
  ALB --> Target Group 2 (Green)
          [v2] [v2] [v2]
          Target Group 1 (Blue)  <-- retained for a period (for rollback)
          [v1] [v1] [v1]

Phase 4: Delete Blue
  ALB --> Target Group 2 (Green)
          [v2] [v2] [v2]
```

```bash
# Create CodeDeploy application for Blue/Green deployment
aws deploy create-application \
  --application-name my-ecs-app \
  --compute-platform ECS

# Create deployment group
aws deploy create-deployment-group \
  --application-name my-ecs-app \
  --deployment-group-name my-ecs-dg \
  --service-role-arn arn:aws:iam::123456789012:role/CodeDeployServiceRole \
  --deployment-config-name CodeDeployDefault.ECSLinear10PercentEvery1Minutes \
  --ecs-services '{
    "clusterName": "my-cluster",
    "serviceName": "my-web-service"
  }' \
  --load-balancer-info '{
    "targetGroupPairInfoList": [
      {
        "targetGroups": [
          {"name": "my-tg-blue"},
          {"name": "my-tg-green"}
        ],
        "prodTrafficRoute": {
          "listenerArns": ["arn:aws:elasticloadbalancing:...:listener/..."]
        },
        "testTrafficRoute": {
          "listenerArns": ["arn:aws:elasticloadbalancing:...:listener/test/..."]
        }
      }
    ]
  }' \
  --blue-green-deployment-configuration '{
    "terminateBlueInstancesOnDeploymentSuccess": {
      "action": "TERMINATE",
      "terminationWaitTimeInMinutes": 60
    },
    "deploymentReadyOption": {
      "actionOnTimeout": "CONTINUE_DEPLOYMENT",
      "waitTimeInMinutes": 0
    }
  }'
```

### 5.3 Deployment Configuration Options

| Deployment Configuration | Description |
|-------------|------|
| CodeDeployDefault.ECSAllAtOnce | Switches all traffic immediately |
| CodeDeployDefault.ECSLinear10PercentEvery1Minutes | Shifts 10% every minute |
| CodeDeployDefault.ECSLinear10PercentEvery3Minutes | Shifts 10% every 3 minutes |
| CodeDeployDefault.ECSCanary10Percent5Minutes | 10% first, then all remaining after 5 minutes |
| CodeDeployDefault.ECSCanary10Percent15Minutes | 10% first, then all remaining after 15 minutes |

### 5.4 Deployment Circuit Breaker

```
Circuit Breaker Behavior:

Deployment starts
    |
    v
New task starts --> Startup fails --> Retry --> Startup fails --> Retry --> Startup fails
    |
    v
Threshold exceeded (consecutive failures)
    |
    v
+----------------------------+
| Circuit Breaker Triggered  |
| - Deployment stops         |
| - If rollback=true:        |
|   Automatic rollback to    |
|   previous version         |
+----------------------------+

Configuration:
  deploymentCircuitBreaker:
    enable: true
    rollback: true  <- Enable automatic rollback
```

---

## 6. ALB Integration

### 6.1 ALB + ECS Configuration

```
Internet
    |
    v
+--------------------+
| Application Load   |
| Balancer (ALB)     |
+--------------------+
    |
    +------ Listener (80/443)
    |         |
    |    +----+----+
    |    | Rules   |
    |    +---------+
    |    /path1 --> Target Group A
    |    /path2 --> Target Group B
    |    default -> Target Group A
    |
    v                          v
+----------+  +----------+  +----------+
| Task 1   |  | Task 2   |  | Task 3   |
| :8080    |  | :8080    |  | :8080    |
| (Dynamic)|  | (Dynamic)|  | (Dynamic)|
+----------+  +----------+  +----------+

In awsvpc mode, each task has its own ENI
-> No dynamic port mapping needed; routes directly to containerPort
```

### 6.2 ALB Health Check Configuration

```bash
# Create target group
aws elbv2 create-target-group \
  --name my-app-tg \
  --protocol HTTP \
  --port 8080 \
  --vpc-id vpc-12345678 \
  --target-type ip \
  --health-check-protocol HTTP \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --health-check-timeout-seconds 5

# Create ALB
aws elbv2 create-load-balancer \
  --name my-app-alb \
  --subnets subnet-public-1 subnet-public-2 \
  --security-groups sg-alb-12345678 \
  --scheme internet-facing \
  --type application

# Create HTTPS listener
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:...:loadbalancer/app/my-app-alb/... \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws:acm:...:certificate/... \
  --ssl-policy ELBSecurityPolicy-TLS13-1-2-2021-06 \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:...:targetgroup/my-app-tg/...

# HTTP -> HTTPS redirect listener
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:...:loadbalancer/app/my-app-alb/... \
  --protocol HTTP \
  --port 80 \
  --default-actions '[{
    "Type": "redirect",
    "RedirectConfig": {
      "Protocol": "HTTPS",
      "Port": "443",
      "StatusCode": "HTTP_301"
    }
  }]'
```

### 6.3 Path-Based Routing

```bash
# Add path-based routing rule
# /api/* --> API service
aws elbv2 create-rule \
  --listener-arn arn:aws:elasticloadbalancing:...:listener/... \
  --priority 10 \
  --conditions '[{
    "Field": "path-pattern",
    "Values": ["/api/*"]
  }]' \
  --actions '[{
    "Type": "forward",
    "TargetGroupArn": "arn:aws:elasticloadbalancing:...:targetgroup/api-tg/..."
  }]'

# Host header-based routing
# api.example.com --> API service
aws elbv2 create-rule \
  --listener-arn arn:aws:elasticloadbalancing:...:listener/... \
  --priority 20 \
  --conditions '[{
    "Field": "host-header",
    "Values": ["api.example.com"]
  }]' \
  --actions '[{
    "Type": "forward",
    "TargetGroupArn": "arn:aws:elasticloadbalancing:...:targetgroup/api-tg/..."
  }]'
```

---

## 7. Log Configuration

### 7.1 Outputting to CloudWatch Logs

```
ECS Task Log Flow:

Container stdout/stderr
    |
    v
+-------------------+
| awslogs driver    |
+-------------------+
    |
    v
+-------------------+     +-------------------+
| CloudWatch Logs   | --> | Logs Insights     |
| /ecs/my-app       |     | query analysis    |
+-------------------+     +-------------------+
    |
    v (subscription)
+-------------------+
| Lambda / Kinesis  |
| / OpenSearch      |
+-------------------+
```

```
# CloudWatch Logs Insights query examples

# Search for error logs
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 50

# Analyze response times
fields @timestamp, @message
| parse @message "response_time=* ms" as response_time
| stats avg(response_time), max(response_time), p99(response_time) by bin(5m)

# Aggregate by HTTP status code
fields @timestamp, @message
| parse @message "status=*" as status_code
| stats count(*) by status_code
| sort count desc

# Track a specific request ID
fields @timestamp, @message, @logStream
| filter @message like /req-abc123/
| sort @timestamp asc

# Track memory usage
fields @timestamp, @message
| parse @message "memory_used=* MB" as memoryUsed
| stats avg(memoryUsed), max(memoryUsed), min(memoryUsed) by bin(5m)
```

### 7.2 Log Routing with FireLens (Fluent Bit)

```json
{
  "family": "app-with-firelens",
  "containerDefinitions": [
    {
      "name": "log-router",
      "image": "public.ecr.aws/aws-observability/aws-for-fluent-bit:latest",
      "essential": true,
      "firelensConfiguration": {
        "type": "fluentbit",
        "options": {
          "config-file-type": "file",
          "config-file-value": "/fluent-bit/configs/parse-json.conf"
        }
      },
      "memory": 128
    },
    {
      "name": "web",
      "image": "my-app:latest",
      "essential": true,
      "logConfiguration": {
        "logDriver": "awsfirelens",
        "options": {
          "Name": "cloudwatch_logs",
          "region": "ap-northeast-1",
          "log_group_name": "/ecs/my-app",
          "log_stream_prefix": "web-",
          "auto_create_group": "true"
        }
      }
    }
  ]
}
```

### 7.3 Routing Logs to Multiple Destinations

```json
{
  "name": "web",
  "logConfiguration": {
    "logDriver": "awsfirelens",
    "options": {
      "Name": "kinesis_firehose",
      "region": "ap-northeast-1",
      "delivery_stream": "my-log-stream",
      "retry_limit": "2"
    }
  }
}
```

```ini
# Fluent Bit custom configuration (extra.conf)
# Send logs to both CloudWatch Logs and S3

[OUTPUT]
    Name cloudwatch_logs
    Match *
    region ap-northeast-1
    log_group_name /ecs/my-app
    log_stream_prefix firelens-
    auto_create_group true

[OUTPUT]
    Name s3
    Match *
    region ap-northeast-1
    bucket my-log-archive-bucket
    s3_key_format /logs/$TAG/%Y/%m/%d/%H/
    total_file_size 50M
    upload_timeout 60s
    use_put_object On
```

---

## 8. ECS Exec (Accessing Containers)

### 8.1 Enabling ECS Exec

```bash
# Enable ECS Exec on a service
aws ecs update-service \
  --cluster my-cluster \
  --service my-web-service \
  --enable-execute-command

# Add required permissions to the task role
# {
#   "Version": "2012-10-17",
#   "Statement": [
#     {
#       "Effect": "Allow",
#       "Action": [
#         "ssmmessages:CreateControlChannel",
#         "ssmmessages:CreateDataChannel",
#         "ssmmessages:OpenControlChannel",
#         "ssmmessages:OpenDataChannel"
#       ],
#       "Resource": "*"
#     }
#   ]
# }

# Access a container
aws ecs execute-command \
  --cluster my-cluster \
  --task arn:aws:ecs:ap-northeast-1:123456789012:task/my-cluster/abc123 \
  --container web \
  --interactive \
  --command "/bin/sh"

# Check ECS Exec status
aws ecs describe-tasks \
  --cluster my-cluster \
  --tasks arn:aws:ecs:...:task/my-cluster/abc123 \
  --query 'tasks[0].containers[*].{
    Name: name,
    ManagedAgents: managedAgents[*].{
      Name: name,
      Status: lastStatus
    }
  }'
```

### 8.2 Troubleshooting

```bash
# List tasks and check status
aws ecs list-tasks \
  --cluster my-cluster \
  --service-name my-web-service \
  --desired-status RUNNING

# Check task details
aws ecs describe-tasks \
  --cluster my-cluster \
  --tasks arn:aws:ecs:...:task/... \
  --query 'tasks[0].{
    LastStatus: lastStatus,
    StoppedReason: stoppedReason,
    StopCode: stopCode,
    Containers: containers[*].{
      Name: name,
      LastStatus: lastStatus,
      ExitCode: exitCode,
      Reason: reason,
      HealthStatus: healthStatus
    }
  }'

# Check reasons for stopped tasks
aws ecs list-tasks \
  --cluster my-cluster \
  --desired-status STOPPED \
  --started-by "ecs-svc/..." | \
  xargs -I {} aws ecs describe-tasks \
    --cluster my-cluster \
    --tasks {} \
    --query 'tasks[*].{TaskArn: taskArn, StoppedReason: stoppedReason}'

# Check service events
aws ecs describe-services \
  --cluster my-cluster \
  --services my-web-service \
  --query 'services[0].events[:10]'
```

---

## 9. ECS Service Connect

### 9.1 Service Connect Overview

```
How Service Connect Works:

Traditional approach (Cloud Map + App Mesh):
  Service A --> DNS lookup --> Cloud Map --> Service B
  + App Mesh Envoy proxy (complex configuration required)

Service Connect:
  Service A --> Service Connect proxy --> Service B
  (ECS automatically manages the proxy)

+---------------------+          +---------------------+
| Service A            |          | Service B            |
| +-------+ +-------+ |          | +-------+ +-------+ |
| | App   | | SC    | | -------> | | SC    | | App   | |
| |       | |Proxy  | |          | |Proxy  | |       | |
| +-------+ +-------+ |          | +-------+ +-------+ |
+---------------------+          +---------------------+

Benefits:
  - Automatic service discovery for inter-service communication
  - Load balancing
  - Health checks
  - Retries
  - Metrics collection
  - TLS encryption
```

```bash
# Create namespace for Service Connect
aws servicediscovery create-http-namespace \
  --name my-apps \
  --description "Service Connect namespace"

# Create service with Service Connect enabled
aws ecs create-service \
  --cluster my-cluster \
  --service-name backend-api \
  --task-definition backend-api:1 \
  --desired-count 3 \
  --launch-type FARGATE \
  --network-configuration '{...}' \
  --service-connect-configuration '{
    "enabled": true,
    "namespace": "my-apps",
    "services": [
      {
        "portName": "http",
        "discoveryName": "backend-api",
        "clientAliases": [
          {
            "port": 8080,
            "dnsName": "backend-api"
          }
        ]
      }
    ]
  }'
```

---

## 10. CloudFormation Templates

### 10.1 Full ECS Fargate Configuration Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Full ECS Fargate Configuration Template'

Parameters:
  EnvironmentName:
    Type: String
    Default: prod
    AllowedValues: [dev, stg, prod]

  ImageTag:
    Type: String
    Default: latest
    Description: Container image tag

  DesiredCount:
    Type: Number
    Default: 3
    Description: Desired task count

Resources:
  # ECS Cluster
  ECSCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: !Sub '${EnvironmentName}-cluster'
      ClusterSettings:
        - Name: containerInsights
          Value: enabled
      CapacityProviders:
        - FARGATE
        - FARGATE_SPOT
      DefaultCapacityProviderStrategy:
        - CapacityProvider: FARGATE
          Weight: 1
          Base: 2
        - CapacityProvider: FARGATE_SPOT
          Weight: 3
          Base: 0

  # Log Group
  LogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub '/ecs/${EnvironmentName}-web-app'
      RetentionInDays: 30

  # Task Definition
  TaskDefinition:
    Type: AWS::ECS::TaskDefinition
    Properties:
      Family: !Sub '${EnvironmentName}-web-app'
      NetworkMode: awsvpc
      RequiresCompatibilities: [FARGATE]
      Cpu: '512'
      Memory: '1024'
      ExecutionRoleArn: !GetAtt TaskExecutionRole.Arn
      TaskRoleArn: !GetAtt TaskRole.Arn
      ContainerDefinitions:
        - Name: web
          Image: !Sub '${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/my-app:${ImageTag}'
          Essential: true
          PortMappings:
            - ContainerPort: 8080
              Protocol: tcp
          Environment:
            - Name: NODE_ENV
              Value: production
            - Name: PORT
              Value: '8080'
          Secrets:
            - Name: DB_PASSWORD
              ValueFrom: !Sub 'arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:${EnvironmentName}/db-password'
          LogConfiguration:
            LogDriver: awslogs
            Options:
              awslogs-group: !Ref LogGroup
              awslogs-region: !Ref AWS::Region
              awslogs-stream-prefix: web
          HealthCheck:
            Command:
              - CMD-SHELL
              - curl -f http://localhost:8080/health || exit 1
            Interval: 30
            Timeout: 5
            Retries: 3
            StartPeriod: 60

  # ECS Service
  Service:
    Type: AWS::ECS::Service
    DependsOn: ALBListener
    Properties:
      ServiceName: !Sub '${EnvironmentName}-web-service'
      Cluster: !Ref ECSCluster
      TaskDefinition: !Ref TaskDefinition
      DesiredCount: !Ref DesiredCount
      LaunchType: FARGATE
      PlatformVersion: LATEST
      EnableExecuteCommand: true
      NetworkConfiguration:
        AwsvpcConfiguration:
          Subnets:
            - !ImportValue PrivateSubnet1Id
            - !ImportValue PrivateSubnet2Id
          SecurityGroups:
            - !Ref ECSSecurityGroup
          AssignPublicIp: DISABLED
      LoadBalancers:
        - TargetGroupArn: !Ref TargetGroup
          ContainerName: web
          ContainerPort: 8080
      DeploymentConfiguration:
        MaximumPercent: 200
        MinimumHealthyPercent: 100
        DeploymentCircuitBreaker:
          Enable: true
          Rollback: true

  # Auto Scaling
  ScalingTarget:
    Type: AWS::ApplicationAutoScaling::ScalableTarget
    Properties:
      ServiceNamespace: ecs
      ResourceId: !Sub 'service/${ECSCluster}/${Service.Name}'
      ScalableDimension: ecs:service:DesiredCount
      MinCapacity: 2
      MaxCapacity: 20

  CPUScalingPolicy:
    Type: AWS::ApplicationAutoScaling::ScalingPolicy
    Properties:
      PolicyName: cpu-target-tracking
      PolicyType: TargetTrackingScaling
      ScalingTargetId: !Ref ScalingTarget
      TargetTrackingScalingPolicyConfiguration:
        TargetValue: 70.0
        PredefinedMetricSpecification:
          PredefinedMetricType: ECSServiceAverageCPUUtilization
        ScaleInCooldown: 300
        ScaleOutCooldown: 60

  # CloudWatch Alarm
  HighCPUAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: !Sub '${EnvironmentName}-ecs-high-cpu'
      MetricName: CPUUtilization
      Namespace: AWS/ECS
      Statistic: Average
      Period: 300
      EvaluationPeriods: 2
      Threshold: 85
      ComparisonOperator: GreaterThanThreshold
      Dimensions:
        - Name: ClusterName
          Value: !Ref ECSCluster
        - Name: ServiceName
          Value: !GetAtt Service.Name
      AlarmActions:
        - !ImportValue AlertTopicArn

Outputs:
  ClusterName:
    Value: !Ref ECSCluster
    Export:
      Name: !Sub '${EnvironmentName}-ClusterName'

  ServiceName:
    Value: !GetAtt Service.Name
    Export:
      Name: !Sub '${EnvironmentName}-ServiceName'

  ALBDNSName:
    Value: !GetAtt ALB.DNSName
    Description: ALB DNS name
```

---

## 11. Anti-Patterns

### 11.1 Relying on the `latest` Tag

```
[Bad Example]
Using image: "my-app:latest" in a task definition

Problems:
  - Cannot track which version was deployed
  - Rollback is difficult
  - Different versions may run under the same task definition

[Good Example]
image: "my-app:v1.2.3" or
image: "my-app:abc123def" (Git SHA)

In CI/CD pipeline:
  1. Build image, push with a unique tag
  2. Update task definition with the new image tag
  3. Update the service
```

### 11.2 Granting Excessive Permissions to the Task Role

**Problem**: Granting `AdministratorAccess` or broad wildcards to a task role can cause significant damage if a container is compromised.

**Improvement**: Allow only the minimum resources and actions the task needs. Clearly separate the execution role (ECR pull, log writes) from the task role (AWS resources the application uses).

### 11.3 Not Configuring Health Checks

```
[Bad Example]
Setting the ALB health check to / (top page)
-> Application judged healthy even when partially malfunctioning

[Good Example]
Implement a dedicated health check endpoint /health:
  - Verify DB connection
  - Verify connectivity to external services
  - Verify memory usage
  - Verify status of dependent services
```

```python
# Health check implementation example for a Flask application
from flask import Flask, jsonify
import psycopg2
import redis
import os

app = Flask(__name__)

@app.route("/health")
def health_check():
    checks = {}
    overall_healthy = True

    # DB connection check
    try:
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        conn.close()
        checks["database"] = "healthy"
    except Exception as e:
        checks["database"] = f"unhealthy: {str(e)}"
        overall_healthy = False

    # Redis connection check
    try:
        r = redis.Redis.from_url(os.environ["REDIS_URL"])
        r.ping()
        checks["cache"] = "healthy"
    except Exception as e:
        checks["cache"] = f"unhealthy: {str(e)}"
        overall_healthy = False

    status_code = 200 if overall_healthy else 503
    return jsonify({
        "status": "healthy" if overall_healthy else "unhealthy",
        "checks": checks
    }), status_code
```

### 11.4 Not Implementing Graceful Shutdown

```
[Bad Example]
Process exits immediately, ignoring the SIGTERM signal
-> In-flight requests fail

[Good Example]
Upon receiving SIGTERM:
  1. Stop accepting new requests
  2. Wait for in-flight requests to complete
  3. Cleanly close DB connections
  4. Exit the process normally

ECS stopTimeout: 120 (default 30 seconds)
-> Sends SIGTERM, then waits 120 seconds before SIGKILL
```

```python
# Graceful shutdown implementation example in Python
import signal
import sys
import time
from http.server import HTTPServer

class GracefulServer:
    def __init__(self, server):
        self.server = server
        self.is_shutting_down = False

        signal.signal(signal.SIGTERM, self.handle_sigterm)
        signal.signal(signal.SIGINT, self.handle_sigterm)

    def handle_sigterm(self, signum, frame):
        print("SIGTERM received, starting graceful shutdown...")
        self.is_shutting_down = True
        # Wait for in-flight requests to complete
        self.server.shutdown()
        # Cleanup
        self.cleanup()
        sys.exit(0)

    def cleanup(self):
        # Close DB connections
        # Save cache
        # Delete temporary files
        print("Cleanup completed")

    def serve_forever(self):
        self.server.serve_forever()
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
    """Exercise for basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main data processing logic"""
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
        """Remove by key"""
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
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure the effect with benchmarks
---

## 12. FAQ

### Q1. Should I choose Fargate or EC2?

Fargate is generally the recommended starting point. It requires no infrastructure management and security patches are applied automatically. Choose the EC2 launch type when you need GPU support, require special kernel configurations, or when EC2 Reserved Instances offer significant cost savings.

### Q2. Does a rolling update on an ECS service cause downtime?

Setting `minimumHealthyPercent: 100` and `maximumPercent: 200` ensures the deployment only proceeds after new tasks start up successfully, so no downtime occurs. By integrating with ALB health checks, traffic is always routed only to healthy tasks.

### Q3. How does inter-container communication work within an ECS task?

In awsvpc network mode, containers within the same task can communicate via `localhost`. For example, a web container can access a Redis sidecar in the same task at `localhost:6379`.

### Q4. How do I debug containers in ECS?

By enabling ECS Exec, you can get shell access to a running container using the `aws ecs execute-command` command. You need to add SSM permissions to the task role and set `enableExecuteCommand` to true on the service.

### Q5. Can I expand Fargate ephemeral storage?

From Fargate Platform Version 1.4.0 onwards, you can expand ephemeral storage from 20GB up to 200GB using the `ephemeralStorage` parameter in the task definition. The default is 20GB, and additional storage incurs charges.

### Q6. Should I choose ECS or EKS?

If you have no Kubernetes experience or are building an AWS-centric architecture, ECS is the better fit. ECS integrates deeply with AWS services and has a lower learning curve. If you have Kubernetes experience and have a multi-cloud or hybrid cloud strategy, EKS is the appropriate choice.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is the most important thing. Rather than theory alone, actually writing code and verifying its behavior will deepen your understanding.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It is especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|---------|
| Cluster | Logical grouping of tasks and services |
| Task Definition | Blueprint for containers. Defines CPU/memory/image/ports |
| Service | Scheduler that maintains the desired number of tasks |
| Fargate | Serverless. No infrastructure management required |
| EC2 | Self-managed. Supports GPU, allows cost optimization |
| ALB Integration | Direct routing via awsvpc + target groups |
| Logging | Output to CloudWatch Logs via awslogs driver or FireLens |
| Deployment | Rolling update / Blue/Green / Circuit Breaker |
| ECS Exec | Interactive access to running containers |
| Service Connect | Automates inter-service communication |
| Capacity Provider | Flexibly controls Fargate/Fargate Spot ratio |

---

## Recommended Next Guides

- [ECR](./01-ecr.md) -- Managing container images
- [EKS Overview](./02-eks-overview.md) -- Kubernetes-based orchestration
- [CodePipeline](../07-devops/02-codepipeline.md) -- CI/CD pipeline for ECS

---

## References

1. AWS Official Documentation "Amazon ECS Developer Guide" https://docs.aws.amazon.com/ecs/latest/developerguide/
2. AWS Official Documentation "Amazon ECS Best Practices Guide" https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/
3. Nathan Peck "Amazon ECS Best Practices" https://ecsworkshop.com/
4. AWS Containers Blog https://aws.amazon.com/blogs/containers/
5. AWS Official "ECS Service Connect" https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-connect.html

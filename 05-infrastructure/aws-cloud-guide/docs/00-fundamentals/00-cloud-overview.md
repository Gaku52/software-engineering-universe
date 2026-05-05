# Cloud Computing Overview

> Systematically understand the mechanism for using computing resources on demand over the Internet

## What You Will Learn in This Chapter

1. Explain the definition of cloud computing and its five essential characteristics
2. Distinguish the shared responsibility models of IaaS / PaaS / SaaS / FaaS / CaaS and select the appropriate service
3. Compare major services across AWS / GCP / Azure and determine the optimal cloud for your project
4. Understand the phased approach and migration strategies for cloud adoption
5. Apply the fundamental principles of cloud-native architecture in practice


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. What Is Cloud Computing?

### 1.1 NIST Definition

The National Institute of Standards and Technology (NIST SP 800-145) defines cloud computing as follows:

> A model for enabling ubiquitous, convenient, on-demand network access to a shared pool of configurable computing resources (e.g., networks, servers, storage, applications, and services) that can be rapidly provisioned and released with minimal management effort or service provider interaction.

The key elements of this definition can be broken down as follows:

```
Components of the NIST Definition:

1. Resource Pooling
   -> Multiple tenants share physical resources
   -> Virtualization technology makes this possible

2. Configurable
   -> Resource specifications can be flexibly changed via APIs or consoles
   -> CPU, memory, storage, etc. can be dynamically adjusted

3. On-Demand
   -> No upfront capacity planning required
   -> Acquire only what you need, when you need it

4. Broad Network Access
   -> Access from anywhere via the Internet or VPN
   -> Uses standard protocols (HTTP/HTTPS, SSH, etc.)

5. Rapid Provisioning
   -> Resources available in minutes
   -> Automation through Infrastructure as Code
```

### 1.2 Five Essential Characteristics

```
+--------------------------------------------------------------+
|       Five Essential Characteristics of Cloud (NIST SP 800-145) |
+--------------------------------------------------------------+
| 1. On-Demand Self-Service                                    |
|    - Instantly provision resources without human intervention  |
|    - Operate via web console, API, or CLI                    |
|    - Developers can provision directly without approval       |
|                                                              |
| 2. Broad Network Access                                      |
|    - Access from anywhere using standard protocols            |
|    - Support for diverse devices: PCs, smartphones, tablets   |
|    - Low-latency global network                              |
|                                                              |
| 3. Resource Pooling                                          |
|    - Multi-tenant sharing of physical resources              |
|    - Users are unaware of physical location                  |
|    - Logical resource isolation through virtualization        |
|                                                              |
| 4. Rapid Elasticity                                          |
|    - Automatic scaling based on demand                       |
|    - Scale out (horizontal) and scale up (vertical)          |
|    - Appears as unlimited resources to users                 |
|                                                              |
| 5. Measured Service                                          |
|    - Pay only for what you use                               |
|    - Automatic metering, monitoring, and reporting           |
|    - Per-second or per-request billing possible              |
+--------------------------------------------------------------+
```

### 1.3 Practical Examples of Each Characteristic

```python
# Characteristic 1: On-Demand Self-Service — Instantly launch an EC2 instance with boto3
import boto3

ec2 = boto3.resource('ec2', region_name='ap-northeast-1')

# Developers provision resources on their own schedule
instances = ec2.create_instances(
    ImageId='ami-0abcdef1234567890',
    MinCount=1,
    MaxCount=1,
    InstanceType='t3.micro',
    TagSpecifications=[{
        'ResourceType': 'instance',
        'Tags': [{'Key': 'Name', 'Value': 'dev-server'}]
    }]
)
print(f"Instance {instances[0].id} launched")
```

```python
# Characteristic 4: Rapid Elasticity — Auto Scaling group configuration
import boto3

autoscaling = boto3.client('autoscaling', region_name='ap-northeast-1')

# Auto scale between 1 and 10 instances based on demand
autoscaling.create_auto_scaling_group(
    AutoScalingGroupName='web-asg',
    LaunchTemplate={
        'LaunchTemplateId': 'lt-0abcdef1234567890',
        'Version': '$Latest'
    },
    MinSize=1,
    MaxSize=10,
    DesiredCapacity=2,
    VPCZoneIdentifier='subnet-abc123,subnet-def456',
    TargetGroupARNs=['arn:aws:elasticloadbalancing:...'],
    Tags=[{
        'Key': 'Environment',
        'Value': 'production',
        'PropagateAtLaunch': True
    }]
)

# Configure scaling policy (based on 70% CPU utilization)
autoscaling.put_scaling_policy(
    AutoScalingGroupName='web-asg',
    PolicyName='cpu-target-tracking',
    PolicyType='TargetTrackingScaling',
    TargetTrackingConfiguration={
        'PredefinedMetricSpecification': {
            'PredefinedMetricType': 'ASGAverageCPUUtilization'
        },
        'TargetValue': 70.0,
        'ScaleInCooldown': 300,
        'ScaleOutCooldown': 60
    }
)
```

```python
# Characteristic 5: Measured Service — Cost monitoring and budget alerts
import boto3

budgets = boto3.client('budgets', region_name='us-east-1')

# Set a monthly budget and notify when thresholds are exceeded
budgets.create_budget(
    AccountId='123456789012',
    Budget={
        'BudgetName': 'monthly-budget',
        'BudgetLimit': {
            'Amount': '1000',
            'Unit': 'USD'
        },
        'BudgetType': 'COST',
        'TimeUnit': 'MONTHLY',
        'TimePeriod': {
            'Start': '2026-01-01T00:00:00Z',
            'End': '2027-01-01T00:00:00Z'
        }
    },
    NotificationsWithSubscribers=[{
        'Notification': {
            'NotificationType': 'ACTUAL',
            'ComparisonOperator': 'GREATER_THAN',
            'Threshold': 80.0,
            'ThresholdType': 'PERCENTAGE'
        },
        'Subscribers': [{
            'SubscriptionType': 'EMAIL',
            'Address': 'admin@example.com'
        }]
    }]
)
```

### 1.4 On-Premises vs Cloud

```
+------------------------------+      +------------------------------+
|        On-Premises            |      |          Cloud               |
+------------------------------+      +------------------------------+
| Hardware purchase required    |      | No hardware purchase needed  |
| High upfront cost (CAPEX)     |      | Low upfront cost (OPEX)      |
| Scaling: weeks to months      |      | Scaling: minutes             |
| Operations: full self-managed |      | Operations: shared model     |
| Depreciation: 3-5 years      |      | No depreciation              |
| Capacity: fixed              |      | Capacity: elastic            |
| Global expansion: difficult  |      | Global expansion: easy       |
| Incident response: self      |      | Incident response: shared    |
| Security: fully self-managed |      | Security: shared model       |
| Licensing: self-managed      |      | Licensing: pay-as-you-go/BYOL|
+------------------------------+      +------------------------------+
```

### 1.5 Practical Approach to TCO (Total Cost of Ownership) Comparison

When making investment decisions for cloud migration, evaluate based on TCO rather than simple monthly cost comparisons.

```
TCO Calculation Components:

[On-Premises TCO]
+---------------------------------------------+
| Hardware Costs                               |
|   Servers: 10 units                          |
|   Network equipment                          |
|   Storage                                    |
|                                             |
| Facility Costs                               |
|   Data center rental: monthly               |
|   Power and cooling: monthly                |
|                                             |
| Personnel Costs                              |
|   Infrastructure engineers (2): monthly      |
|   24/365 on-call allowance: monthly         |
|                                             |
| Software Licenses                            |
|   OS, DB, middleware: yearly                |
|                                             |
| 3-Year TCO: Significant                     |
+---------------------------------------------+

[Cloud (AWS) TCO]
+---------------------------------------------+
| Compute                                      |
|   EC2 (Reserved 3yr): monthly               |
|   Lambda: monthly                           |
|                                             |
| Storage & DB                                 |
|   S3 + RDS: monthly                         |
|   ElastiCache: monthly                      |
|                                             |
| Network                                      |
|   Data transfer + VPN: monthly              |
|                                             |
| Personnel Costs (reduced)                    |
|   Cloud engineer (1): monthly               |
|                                             |
| 3-Year TCO: Substantially lower             |
+---------------------------------------------+
```

```python
# TCO calculation script
def calculate_tco_comparison(years: int = 3):
    """Compare TCO between on-premises and cloud"""

    # On-premises costs
    onprem = {
        'hardware': {
            'servers': 2_000_000 * 10,
            'network': 5_000_000,
            'storage': 3_000_000,
        },
        'monthly': {
            'datacenter': 500_000,
            'power_cooling': 200_000,
            'staff': 1_200_000,
            'oncall': 300_000,
        },
        'yearly': {
            'licenses': 2_000_000,
            'maintenance': 1_500_000,  # Hardware maintenance
        }
    }

    onprem_total = (
        sum(onprem['hardware'].values()) +
        sum(onprem['monthly'].values()) * 12 * years +
        sum(onprem['yearly'].values()) * years
    )

    # Cloud costs
    cloud = {
        'monthly': {
            'compute': 300_000,
            'serverless': 50_000,
            'storage_db': 150_000,
            'cache': 80_000,
            'network': 100_000,
            'staff': 700_000,
        },
        'yearly': {
            'support_plan': 600_000,
            'training': 300_000,
        }
    }

    cloud_total = (
        sum(cloud['monthly'].values()) * 12 * years +
        sum(cloud['yearly'].values()) * years
    )

    savings = onprem_total - cloud_total
    savings_pct = (savings / onprem_total) * 100

    print(f"=== {years}-Year TCO Comparison ===")
    print(f"On-Premises: ¥{onprem_total:,.0f}")
    print(f"Cloud:       ¥{cloud_total:,.0f}")
    print(f"Savings:     ¥{savings:,.0f} ({savings_pct:.1f}%)")

    return {
        'onprem': onprem_total,
        'cloud': cloud_total,
        'savings': savings,
        'savings_pct': savings_pct
    }

result = calculate_tco_comparison(3)
# === 3-Year TCO Comparison ===
# On-Premises: ¥117,400,000
# Cloud:       ¥52,680,000
# Savings:     ¥64,720,000 (55.1%)
```

### 1.6 Historical Evolution of Cloud Computing

```
Evolution of Cloud Computing:

2002 - AWS begins internal infrastructure standardization
2004 - Amazon SQS (first AWS service)
2006 - Amazon S3, EC2 released -> Beginning of IaaS
2008 - Google App Engine (PaaS pioneer)
2009 - Heroku launched -> PaaS adoption grows
2010 - Microsoft Azure officially released
2011 - NIST SP 800-145 published (official cloud definition)
2012 - AWS re:Invent begins, DynamoDB released
2013 - Docker launched -> Container revolution
2014 - AWS Lambda -> Beginning of serverless
        Kubernetes v1.0 -> Container orchestration
2015 - AWS IoT, Machine Learning services launched
2016 - Google Cloud Platform expands significantly
2017 - Cloud-native concept gains widespread adoption (CNCF)
2018 - Multi-cloud strategy becomes mainstream
2019 - AWS Outposts -> Hybrid cloud enhancement
2020 - Remote work demand accelerates cloud adoption
2021 - AWS Graviton3, cloud spending exceeds $1T for the first time
2022 - FinOps gains traction, cost optimization becomes key topic
2023 - Explosive growth in generative AI-related services
2024 - Accelerated cloud migration for AI/ML workloads
2025 - Edge-cloud convergence, sustainable cloud
```

---

## 2. Service Models — IaaS / PaaS / SaaS / FaaS / CaaS

### 2.1 Shared Responsibility Model

```
Scope of Management Responsibility (higher = more user responsibility)

  +--------------+---------+---------+---------+---------+---------+
  |              | IaaS    | CaaS    | PaaS    | FaaS    | SaaS    |
  +--------------+---------+---------+---------+---------+---------+
  | Application  | User    | User    | User    | User    | Vendor  |
  | Data         | User    | User    | User    | User    | Shared  |
  | Runtime      | User    | User    | Vendor  | Vendor  | Vendor  |
  | Container    | User    | Vendor  | Vendor  | Vendor  | Vendor  |
  | Middleware   | User    | Vendor  | Vendor  | Vendor  | Vendor  |
  | OS           | User    | Vendor  | Vendor  | Vendor  | Vendor  |
  | Virtualization| Vendor | Vendor  | Vendor  | Vendor  | Vendor  |
  | Server       | Vendor  | Vendor  | Vendor  | Vendor  | Vendor  |
  | Storage      | Vendor  | Vendor  | Vendor  | Vendor  | Vendor  |
  | Network      | Vendor  | Vendor  | Vendor  | Vendor  | Vendor  |
  +--------------+---------+---------+---------+---------+---------+

  CaaS = Container as a Service (ECS/EKS, GKE, AKS)
  FaaS = Function as a Service (Lambda, Cloud Functions, Azure Functions)
```

### 2.2 Representative Services and Detailed Comparison for Each Model

| Model | Overview | AWS Examples | GCP Examples | Azure Examples | Primary Use Cases |
|-------|----------|-------------|-------------|---------------|-------------------|
| IaaS | Provides virtual machines and networking | EC2, VPC | Compute Engine | Virtual Machines | Workloads requiring full customization |
| CaaS | Provides container execution platform | ECS, EKS, Fargate | GKE, Cloud Run | AKS, Container Apps | Microservices, CI/CD |
| PaaS | Provides application execution platform | Elastic Beanstalk, App Runner | App Engine | App Service | Web apps, APIs |
| FaaS | Provides function execution platform | Lambda | Cloud Functions | Azure Functions | Event-driven processing |
| SaaS | Complete applications | WorkMail, Chime | Google Workspace | Microsoft 365 | End-user tools |

### 2.3 Service Model Selection Flowchart

```
Service Model Selection Decision Flow:

Q1: How much customization does the application need?
├── High (need to control OS and middleware)
│   └── -> IaaS (EC2)
│       Q2: Is it containerized?
│       ├── Yes -> CaaS (ECS/EKS/Fargate)
│       └── No  -> Stay with IaaS
│
├── Medium (want to focus on application code)
│   └── -> PaaS (Elastic Beanstalk / App Runner)
│       Q3: Does it need to run continuously?
│       ├── Yes -> PaaS
│       └── No  -> FaaS (Lambda)
│
└── Low (off-the-shelf solution is sufficient)
    └── -> SaaS
```

### 2.4 Code Example: Launching and Configuring IaaS (EC2)

```bash
# Minimal command to launch an EC2 instance
aws ec2 run-instances \
  --image-id ami-0abcdef1234567890 \
  --instance-type t3.micro \
  --key-name my-key-pair \
  --security-group-ids sg-0123456789abcdef0 \
  --subnet-id subnet-0123456789abcdef0 \
  --count 1 \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=web-server-01}]'

# Check instance status
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=web-server-01" \
  --query 'Reservations[].Instances[].[InstanceId,State.Name,PublicIpAddress]' \
  --output table
```

```python
# Defining EC2 with Terraform (IaC)
# main.tf
"""
resource "aws_instance" "web_server" {
  ami           = "ami-0abcdef1234567890"
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.public.id

  vpc_security_group_ids = [aws_security_group.web.id]

  user_data = <<-EOF
    #!/bin/bash
    yum update -y
    yum install -y httpd
    systemctl start httpd
    systemctl enable httpd
    echo "<h1>Hello from EC2</h1>" > /var/www/html/index.html
  EOF

  tags = {
    Name        = "web-server-01"
    Environment = "production"
    ManagedBy   = "terraform"
  }

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    encrypted   = true
  }
}
"""
```

### 2.5 Code Example: CaaS (ECS Fargate) Deployment

```json
// ECS Task Definition (task-definition.json)
{
  "family": "web-app",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "web",
      "image": "123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/web-app:latest",
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/web-app",
          "awslogs-region": "ap-northeast-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "8080"}
      ],
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

```bash
# Create an ECS service with Fargate
aws ecs create-service \
  --cluster production \
  --service-name web-app \
  --task-definition web-app:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[subnet-abc123,subnet-def456],
    securityGroups=[sg-web123],
    assignPublicIp=DISABLED
  }" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=web,containerPort=8080"
```

### 2.6 Code Example: PaaS (Elastic Beanstalk) Deployment

```bash
# Create an environment with the Elastic Beanstalk CLI
eb init my-app --platform python-3.11 --region ap-northeast-1
eb create my-env --instance-type t3.small --envvars DATABASE_URL=postgresql://...
eb deploy

# Update environment variables
eb setenv SECRET_KEY=my-secret-key DEBUG=false

# Check logs
eb logs --all
```

```yaml
# .ebextensions/01-packages.config
packages:
  yum:
    postgresql-devel: []

container_commands:
  01_migrate:
    command: "python manage.py migrate"
    leader_only: true
  02_collectstatic:
    command: "python manage.py collectstatic --noinput"

option_settings:
  aws:elasticbeanstalk:container:python:
    WSGIPath: myapp.wsgi:application
  aws:elasticbeanstalk:environment:proxy:staticfiles:
    /static: static
  aws:autoscaling:asg:
    MinSize: 2
    MaxSize: 8
  aws:autoscaling:trigger:
    MeasureName: CPUUtilization
    Statistic: Average
    Unit: Percent
    UpperThreshold: 70
    LowerThreshold: 30
```

### 2.7 Code Example: FaaS (Lambda) Function

```python
# Lambda function: Resize images uploaded to S3
import json
import boto3
from PIL import Image
import io
import os

s3 = boto3.client('s3')

def lambda_handler(event, context):
    """Resize images triggered by S3 events"""

    # Get bucket name and key from the event
    bucket = event['Records'][0]['s3']['bucket']['name']
    key = event['Records'][0]['s3']['object']['key']

    # Skip already resized images
    if key.startswith('thumbnails/'):
        return {'statusCode': 200, 'body': 'Already processed'}

    try:
        # Download the original image
        response = s3.get_object(Bucket=bucket, Key=key)
        image_content = response['Body'].read()

        # Resize
        image = Image.open(io.BytesIO(image_content))
        image.thumbnail((300, 300), Image.LANCZOS)

        # Save resized image to buffer
        buffer = io.BytesIO()
        image.save(buffer, format='JPEG', quality=85)
        buffer.seek(0)

        # Upload thumbnail to S3
        thumbnail_key = f"thumbnails/{os.path.basename(key)}"
        s3.put_object(
            Bucket=bucket,
            Key=thumbnail_key,
            Body=buffer,
            ContentType='image/jpeg',
            CacheControl='max-age=31536000'
        )

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Thumbnail created',
                'source': key,
                'thumbnail': thumbnail_key,
                'original_size': f"{image.size[0]}x{image.size[1]}"
            })
        }

    except Exception as e:
        print(f"Error processing {key}: {str(e)}")
        raise
```

```yaml
# AWS SAM Template (template.yaml)
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Image Resize Lambda Function

Globals:
  Function:
    Timeout: 30
    Runtime: python3.11
    MemorySize: 512
    Architectures:
      - arm64

Resources:
  ImageBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub "${AWS::StackName}-images"

  ResizeFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: resize.lambda_handler
      CodeUri: src/
      Policies:
        - S3CrudPolicy:
            BucketName: !Ref ImageBucket
      Events:
        S3Upload:
          Type: S3
          Properties:
            Bucket: !Ref ImageBucket
            Events: s3:ObjectCreated:*
            Filter:
              S3Key:
                Rules:
                  - Name: prefix
                    Value: uploads/
                  - Name: suffix
                    Value: .jpg
```

### 2.8 Code Example: SaaS Integration (AWS SES Email Sending)

```python
import boto3
from botocore.exceptions import ClientError

def send_templated_email(
    sender: str,
    recipient: str,
    template_name: str,
    template_data: dict
) -> dict:
    """Send a templated email via SES"""

    client = boto3.client('ses', region_name='ap-northeast-1')

    try:
        response = client.send_templated_email(
            Source=sender,
            Destination={
                'ToAddresses': [recipient],
            },
            Template=template_name,
            TemplateData=json.dumps(template_data),
            ConfigurationSetName='tracking-config',
            Tags=[
                {'Name': 'campaign', 'Value': 'welcome'},
                {'Name': 'environment', 'Value': 'production'},
            ]
        )
        print(f"Email sent! Message ID: {response['MessageId']}")
        return response

    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'MessageRejected':
            print(f"Email rejected: {e.response['Error']['Message']}")
        elif error_code == 'MailFromDomainNotVerifiedException':
            print("Sender domain is not verified")
        else:
            print(f"Unexpected error: {error_code}")
        raise

# Usage example
import json
send_templated_email(
    sender='noreply@example.com',
    recipient='user@example.com',
    template_name='WelcomeEmail',
    template_data={
        'name': 'Taro Tanaka',
        'company': 'Example Corp',
        'login_url': 'https://app.example.com/login'
    }
)
```

---

## 3. Deployment Models

### 3.1 Four Deployment Models

| Model | Description | Use Cases | Advantages | Disadvantages |
|-------|------------|-----------|-----------|--------------|
| Public Cloud | Shared infrastructure owned and operated by a provider | Startups, web services | No upfront cost, instant scaling | Data residency constraints |
| Private Cloud | Cloud infrastructure dedicated to a single organization | Financial institutions, government agencies | Security and compliance | High build and operation costs |
| Hybrid Cloud | Combination of public cloud and on-premises | Phased migration, regulatory compliance | Flexibility | Configuration complexity |
| Multi-Cloud | Combination of multiple providers | Vendor lock-in avoidance | Optimal service selection | Operational complexity |

### 3.2 Hybrid Cloud Architecture Patterns

```
Hybrid Cloud Configuration Example:

  +-----------------------------+
  |      On-Premises             |
  |  +---------+  +----------+  |
  |  | Core DB |  | Auth     |  |
  |  |(Oracle) |  |(AD)      |  |
  |  +----+----+  +-----+----+  |
  |       |              |       |
  +-------+--------------+------+
          |   VPN/         |
          |  Direct Connect|
  +-------+--------------+------+
  |       v              v       |
  |  +---------+  +----------+  |
  |  | Aurora  |  | Cognito  |  |
  |  |(Target) |  |(Linked)  |  |
  |  +---------+  +----------+  |
  |                              |
  |  +---------+  +----------+  |
  |  | ECS     |  | S3       |  |
  |  | (API)   |  | (Assets) |  |
  |  +---------+  +----------+  |
  |        AWS Cloud             |
  +------------------------------+
```

```bash
# AWS Direct Connect + VPN configuration example
# Create a Direct Connect Gateway
aws directconnect create-direct-connect-gateway \
  --direct-connect-gateway-name "onprem-gateway" \
  --amazon-side-asn 64512

# Create a VPN connection (as backup)
aws ec2 create-vpn-gateway \
  --type ipsec.1 \
  --amazon-side-asn 65000

aws ec2 create-customer-gateway \
  --type ipsec.1 \
  --public-ip 203.0.113.1 \
  --bgp-asn 65100

aws ec2 create-vpn-connection \
  --type ipsec.1 \
  --vpn-gateway-id vgw-abc123 \
  --customer-gateway-id cgw-def456 \
  --options '{"StaticRoutesOnly": false}'
```

### 3.3 Multi-Cloud Strategy Implementation

```python
# Multi-cloud abstraction layer example
from abc import ABC, abstractmethod
from typing import BinaryIO

class CloudStorageProvider(ABC):
    """Abstract base class for cloud storage"""

    @abstractmethod
    def upload(self, bucket: str, key: str, data: BinaryIO) -> str:
        pass

    @abstractmethod
    def download(self, bucket: str, key: str) -> bytes:
        pass

    @abstractmethod
    def delete(self, bucket: str, key: str) -> bool:
        pass

    @abstractmethod
    def list_objects(self, bucket: str, prefix: str = '') -> list:
        pass

class AWSS3Provider(CloudStorageProvider):
    def __init__(self, region: str = 'ap-northeast-1'):
        import boto3
        self.client = boto3.client('s3', region_name=region)

    def upload(self, bucket: str, key: str, data: BinaryIO) -> str:
        self.client.upload_fileobj(data, bucket, key)
        return f"s3://{bucket}/{key}"

    def download(self, bucket: str, key: str) -> bytes:
        response = self.client.get_object(Bucket=bucket, Key=key)
        return response['Body'].read()

    def delete(self, bucket: str, key: str) -> bool:
        self.client.delete_object(Bucket=bucket, Key=key)
        return True

    def list_objects(self, bucket: str, prefix: str = '') -> list:
        response = self.client.list_objects_v2(Bucket=bucket, Prefix=prefix)
        return [obj['Key'] for obj in response.get('Contents', [])]

class GCPStorageProvider(CloudStorageProvider):
    def __init__(self):
        from google.cloud import storage
        self.client = storage.Client()

    def upload(self, bucket: str, key: str, data: BinaryIO) -> str:
        bucket_obj = self.client.bucket(bucket)
        blob = bucket_obj.blob(key)
        blob.upload_from_file(data)
        return f"gs://{bucket}/{key}"

    def download(self, bucket: str, key: str) -> bytes:
        bucket_obj = self.client.bucket(bucket)
        blob = bucket_obj.blob(key)
        return blob.download_as_bytes()

    def delete(self, bucket: str, key: str) -> bool:
        bucket_obj = self.client.bucket(bucket)
        blob = bucket_obj.blob(key)
        blob.delete()
        return True

    def list_objects(self, bucket: str, prefix: str = '') -> list:
        bucket_obj = self.client.bucket(bucket)
        blobs = bucket_obj.list_blobs(prefix=prefix)
        return [blob.name for blob in blobs]

class AzureBlobProvider(CloudStorageProvider):
    def __init__(self, connection_string: str):
        from azure.storage.blob import BlobServiceClient
        self.client = BlobServiceClient.from_connection_string(connection_string)

    def upload(self, bucket: str, key: str, data: BinaryIO) -> str:
        blob_client = self.client.get_blob_client(bucket, key)
        blob_client.upload_blob(data, overwrite=True)
        return f"https://{self.client.account_name}.blob.core.windows.net/{bucket}/{key}"

    def download(self, bucket: str, key: str) -> bytes:
        blob_client = self.client.get_blob_client(bucket, key)
        return blob_client.download_blob().readall()

    def delete(self, bucket: str, key: str) -> bool:
        blob_client = self.client.get_blob_client(bucket, key)
        blob_client.delete_blob()
        return True

    def list_objects(self, bucket: str, prefix: str = '') -> list:
        container = self.client.get_container_client(bucket)
        blobs = container.list_blobs(name_starts_with=prefix)
        return [blob.name for blob in blobs]

# Factory pattern to select provider
def get_storage_provider(cloud: str, **kwargs) -> CloudStorageProvider:
    providers = {
        'aws': AWSS3Provider,
        'gcp': GCPStorageProvider,
        'azure': AzureBlobProvider,
    }
    if cloud not in providers:
        raise ValueError(f"Unsupported cloud: {cloud}")
    return providerscloud

# Usage example
provider = get_storage_provider('aws', region='ap-northeast-1')
url = provider.upload('my-bucket', 'data/report.csv', open('report.csv', 'rb'))
```

---

## 4. AWS vs GCP vs Azure — Major Service Comparison

### 4.1 Compute Comparison

| Category | AWS | GCP | Azure | Notes |
|----------|-----|-----|-------|-------|
| Virtual Machines | EC2 | Compute Engine | Virtual Machines | AWS: Most instance types |
| Containers (Managed) | ECS / EKS | GKE | AKS | GKE: Kubernetes origin |
| Serverless | Lambda | Cloud Functions | Azure Functions | AWS: Most trigger sources |
| Serverless Containers | Fargate | Cloud Run | Container Apps | Cloud Run: Simplest |
| Batch Processing | AWS Batch | Cloud Batch | Azure Batch | For massively parallel processing |
| Edge Computing | Lambda@Edge | Cloud CDN Functions | Azure Front Door | CDN-integrated |

### 4.2 Storage / Database Comparison

| Category | AWS | GCP | Azure | Notes |
|----------|-----|-----|-------|-------|
| Object Storage | S3 | Cloud Storage | Blob Storage | S3: Industry-standard API |
| Block Storage | EBS | Persistent Disk | Managed Disks | High-performance VM storage |
| File Storage | EFS, FSx | Filestore | Azure Files | NFS/SMB support |
| RDB (Managed) | RDS / Aurora | Cloud SQL / AlloyDB | Azure SQL | Aurora: High performance |
| NoSQL (Document) | DynamoDB | Firestore | Cosmos DB | DynamoDB: Single-digit ms |
| NoSQL (Wide Column) | Keyspaces | Bigtable | Table Storage | For large-scale time-series data |
| Cache | ElastiCache | Memorystore | Azure Cache for Redis | Redis/Memcached compatible |
| Data Warehouse | Redshift | BigQuery | Synapse Analytics | BigQuery: Serverless |
| Search | OpenSearch | -- | Cognitive Search | Elasticsearch compatible |

### 4.3 Networking Comparison

| Category | AWS | GCP | Azure | Notes |
|----------|-----|-----|-------|-------|
| VPC | VPC | VPC | VNet | Virtual network |
| CDN | CloudFront | Cloud CDN | Azure CDN | Global distribution |
| DNS | Route 53 | Cloud DNS | Azure DNS | Domain management |
| Load Balancer | ALB/NLB/CLB | Cloud Load Balancing | Azure LB | L4/L7 support |
| VPN | Site-to-Site VPN | Cloud VPN | VPN Gateway | Encrypted communication |
| Dedicated Line | Direct Connect | Cloud Interconnect | ExpressRoute | Low latency |
| API Gateway | API Gateway | Apigee / API Gateway | API Management | REST/WebSocket support |

### 4.4 AI/ML Service Comparison

| Category | AWS | GCP | Azure | Notes |
|----------|-----|-----|-------|-------|
| ML Platform | SageMaker | Vertex AI | Azure ML | Fully managed ML |
| Image Recognition | Rekognition | Vision AI | Computer Vision | Pre-trained models |
| Natural Language Processing | Comprehend | Natural Language AI | Text Analytics | Text analysis |
| Speech Recognition | Transcribe | Speech-to-Text | Speech Services | Transcription |
| Translation | Translate | Translation AI | Translator | Multi-language support |
| Generative AI | Bedrock | Vertex AI (Gemini) | Azure OpenAI | LLM integration platform |

### 4.5 Code Example: Creating Buckets with Each Cloud's CLI

```bash
# AWS
aws s3 mb s3://my-bucket-2026 --region ap-northeast-1
aws s3api put-bucket-versioning \
  --bucket my-bucket-2026 \
  --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption \
  --bucket my-bucket-2026 \
  --server-side-encryption-configuration '{
    "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "aws:kms"}}]
  }'

# GCP
gsutil mb -l asia-northeast1 gs://my-bucket-2026
gsutil versioning set on gs://my-bucket-2026

# Azure
az storage account create \
  --name mystorageaccount \
  --resource-group myResourceGroup \
  --location japaneast \
  --sku Standard_LRS
az storage container create \
  --name my-bucket-2026 \
  --account-name mystorageaccount
```

### 4.6 Code Example: File Upload with Each Cloud's SDK (Python)

```python
# === AWS S3 ===
import boto3

s3 = boto3.client('s3')

# Upload with metadata
s3.upload_file(
    'local.txt',
    'my-bucket',
    'remote.txt',
    ExtraArgs={
        'ContentType': 'text/plain',
        'ServerSideEncryption': 'aws:kms',
        'Metadata': {
            'uploaded-by': 'automation',
            'version': '1.0'
        }
    }
)

# Generate a pre-signed URL (for temporary sharing)
presigned_url = s3.generate_presigned_url(
    'get_object',
    Params={'Bucket': 'my-bucket', 'Key': 'remote.txt'},
    ExpiresIn=3600  # Valid for 1 hour
)
print(f"Sharing URL: {presigned_url}")

# === GCP Cloud Storage ===
from google.cloud import storage

client = storage.Client()
bucket = client.bucket('my-bucket')
blob = bucket.blob('remote.txt')
blob.metadata = {'uploaded-by': 'automation', 'version': '1.0'}
blob.upload_from_filename('local.txt', content_type='text/plain')

# Generate a signed URL
signed_url = blob.generate_signed_url(
    version='v4',
    expiration=3600,
    method='GET'
)

# === Azure Blob Storage ===
from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions
from datetime import datetime, timedelta

blob_service = BlobServiceClient.from_connection_string(conn_str)
blob_client = blob_service.get_blob_client('my-container', 'remote.txt')

with open('local.txt', 'rb') as data:
    blob_client.upload_blob(
        data,
        content_settings={'content_type': 'text/plain'},
        metadata={'uploaded-by': 'automation', 'version': '1.0'}
    )

# Generate a SAS URL
sas_token = generate_blob_sas(
    account_name='mystorageaccount',
    container_name='my-container',
    blob_name='remote.txt',
    account_key='...',
    permission=BlobSasPermissions(read=True),
    expiry=datetime.utcnow() + timedelta(hours=1)
)
```

### 4.7 Region and Availability Zone Comparison

```
Major Cloud Asia-Pacific Regions:

AWS:
├── ap-northeast-1 (Tokyo)        - 4 AZs
├── ap-northeast-2 (Seoul)        - 4 AZs
├── ap-northeast-3 (Osaka)        - 3 AZs
├── ap-southeast-1 (Singapore)    - 3 AZs
├── ap-southeast-2 (Sydney)       - 3 AZs
├── ap-south-1 (Mumbai)           - 3 AZs
└── and more...

GCP:
├── asia-northeast1 (Tokyo)       - 3 Zones
├── asia-northeast2 (Osaka)       - 3 Zones
├── asia-northeast3 (Seoul)       - 3 Zones
├── asia-southeast1 (Singapore)   - 3 Zones
└── asia-south1 (Mumbai)          - 3 Zones

Azure:
├── Japan East (Tokyo)            - 3 AZs
├── Japan West (Osaka)            - 3 AZs
├── Southeast Asia (Singapore)    - 3 AZs
├── East Asia (Hong Kong)         - 3 AZs
└── Korea Central (Seoul)         - 3 AZs
```

---

## 5. Cloud-Native Architecture

### 5.1 CNCF Definition

The Cloud Native Computing Foundation (CNCF) defines cloud native as follows:

```
Cloud-native technologies empower organizations to build and run
scalable applications in modern, dynamic environments such as
public, private, and hybrid clouds.

Representative approaches include:
- Containers
- Service meshes
- Microservices
- Immutable infrastructure
- Declarative APIs

These techniques enable loosely coupled systems that are resilient,
manageable, and observable.
```

### 5.2 12 Factor App

Fundamental design principles for cloud-native applications.

```
12 Factor App:

1.  Codebase        - One codebase tracked in version control, many deploys
2.  Dependencies    - Explicitly declare and isolate dependencies
3.  Config          - Store config in environment variables
4.  Backing Services - Treat backing services as attached resources
5.  Build, Release, Run - Strictly separate build and run stages
6.  Processes       - Execute the app as stateless processes
7.  Port Binding    - Export services via port binding
8.  Concurrency     - Scale out via the process model
9.  Disposability   - Maximize robustness with fast startup and graceful shutdown
10. Dev/Prod Parity - Keep development, staging, and production as similar as possible
11. Logs            - Treat logs as event streams
12. Admin Processes - Run admin/management tasks as one-off processes
```

```python
# Application example following the 12 Factor App

# Factor 3: Config from environment variables
import os

class Config:
    DATABASE_URL = os.environ['DATABASE_URL']        # Required
    REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379')
    SECRET_KEY = os.environ['SECRET_KEY']
    DEBUG = os.environ.get('DEBUG', 'false').lower() == 'true'
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
    PORT = int(os.environ.get('PORT', '8080'))

# Factor 4: Backing services as attached resources
# -> DB connection target is injected via env vars, switchable without code changes

# Factor 6: Stateless processes
# -> Session information is stored in Redis, not written to local files

# Factor 7: Port binding
from fastapi import FastAPI
import uvicorn

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=Config.PORT)

# Factor 9: Disposability — Graceful shutdown
import signal
import sys

def graceful_shutdown(signum, frame):
    print("Shutting down gracefully...")
    # Close DB connections, wait for in-flight requests to complete
    sys.exit(0)

signal.signal(signal.SIGTERM, graceful_shutdown)
signal.signal(signal.SIGINT, graceful_shutdown)

# Factor 11: Logs to stdout
import logging
import json

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_data = {
            'timestamp': self.formatTime(record),
            'level': record.levelname,
            'message': record.getMessage(),
            'logger': record.name,
            'module': record.module,
        }
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)
        return json.dumps(log_data, ensure_ascii=False)

handler = logging.StreamHandler(sys.stdout)  # Output to stdout
handler.setFormatter(JSONFormatter())
logger = logging.getLogger(__name__)
logger.addHandler(handler)
logger.setLevel(Config.LOG_LEVEL)
```

### 5.3 Microservices Architecture Pattern

```
Microservices Architecture on AWS:

                     +--- CloudFront (CDN)
                     |
                     v
                API Gateway
                     |
        +------------+------------+
        v            v            v
   +--------+  +--------+  +--------+
   | User   |  | Order  |  | Product|
   | Service|  | Service|  | Service|
   | (ECS)  |  | (ECS)  |  | (Lambda)|
   +---+----+  +---+----+  +---+----+
       |           |           |
       v           v           v
   +--------+  +--------+  +--------+
   | Aurora |  |DynamoDB|  | Aurora  |
   | MySQL  |  |        |  | (Reader)|
   +--------+  +--------+  +--------+
       |           |           |
       +---------+-+-----------+
                 v
            EventBridge
                 |
        +--------+--------+
        v        v        v
   +--------+ +----+ +----------+
   | SNS/SQS| | SES| |CloudWatch|
   |(Notify)| |(Mail)| |(Monitor)|
   +--------+ +----+ +----------+
```

---

## 6. Benefits and Challenges of Cloud Adoption

### 6.1 Detailed Benefits

```
  Benefits                                Specific Effects
  +----------------------------------+  +----------------------------------+
  | 1. Reduced upfront investment    |  | No server purchases, monthly pay |
  |    (CAPEX -> OPEX)               |  |                                  |
  | 2. Easy global expansion         |  | Deploy to 25+ regions in minutes |
  | 3. High availability & fault     |  | Multi-AZ config for 99.99% SLA  |
  |    tolerance                     |  |                                  |
  | 4. Auto scaling                  |  | Auto expand at peak, shrink off  |
  | 5. Managed service utilization   |  | Delegate DB ops, patching to     |
  |                                  |  | provider                         |
  | 6. Faster development speed      |  | Env setup in minutes, CI/CD easy |
  | 7. Accelerated innovation        |  | Instant access to AI/ML, IoT     |
  | 8. Enhanced security             |  | Encryption, audit, compliance    |
  +----------------------------------+  +----------------------------------+

  Challenges                              Mitigations
  +----------------------------------+  +----------------------------------+
  | 1. Vendor lock-in                |  | Containerization, IaC abstraction|
  | 2. Data sovereignty / compliance |  | Region selection, encryption     |
  | 3. Network latency               |  | Edge locations, CDN utilization  |
  | 4. Cost management complexity    |  | FinOps practices, budget alerts  |
  | 5. Understanding security        |  | Shared responsibility model      |
  |    responsibility                |  | education                        |
  | 6. Existing skills gap           |  | Certification, training          |
  | 7. Migration complexity          |  | Phased migration plan, MAP       |
  | 8. Limited incident response     |  | Multi-region, DR planning        |
  |    scope                         |  |                                  |
  +----------------------------------+  +----------------------------------+
```

### 6.2 Cost Optimization Strategies

```python
# AWS Cost Optimization Tool: Leveraging the Cost Explorer API
import boto3
from datetime import datetime, timedelta

ce = boto3.client('ce', region_name='us-east-1')

def get_monthly_cost_breakdown():
    """Get monthly cost breakdown by service"""
    end = datetime.now().strftime('%Y-%m-%d')
    start = (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')

    response = ce.get_cost_and_usage(
        TimePeriod={'Start': start, 'End': end},
        Granularity='MONTHLY',
        Metrics=['UnblendedCost'],
        GroupBy=[
            {'Type': 'DIMENSION', 'Key': 'SERVICE'}
        ]
    )

    for period in response['ResultsByTime']:
        print(f"\n=== {period['TimePeriod']['Start']} ===")
        groups = sorted(
            period['Groups'],
            key=lambda x: float(x['Metrics']['UnblendedCost']['Amount']),
            reverse=True
        )
        for group in groups[:10]:
            service = group['Keys'][0]
            cost = float(group['Metrics']['UnblendedCost']['Amount'])
            if cost > 0:
                print(f"  {service}: ${cost:.2f}")

def get_savings_recommendations():
    """Get Savings Plans / Reserved Instances recommendations"""
    response = ce.get_savings_plans_purchase_recommendation(
        SavingsPlansType='COMPUTE_SP',
        TermInYears='ONE_YEAR',
        PaymentOption='NO_UPFRONT',
        LookbackPeriodInDays='SIXTY_DAYS'
    )

    recommendation = response['SavingsPlansRecommendationDetails']
    for rec in recommendation[:5]:
        print(f"Recommended monthly: ${float(rec['HourlyCommitmentToPurchase']) * 730:.2f}")
        print(f"Estimated savings: ${float(rec['EstimatedMonthlySavingsAmount']):.2f}")
        print(f"Savings rate: {float(rec['EstimatedSavingsPercentage']):.1f}%")
        print("---")

get_monthly_cost_breakdown()
get_savings_recommendations()
```

```
Four Pillars of Cost Optimization:

1. Right Sizing
   +--------------------------------------------+
   | - Monitor CPU/memory usage with CloudWatch  |
   | - Check recommended sizes with Compute      |
   |   Optimizer                                 |
   | - Identify and fix over-provisioning        |
   | - Example: t3.xlarge -> t3.medium for 50%   |
   |   reduction                                 |
   +--------------------------------------------+

2. Reserved Discounts (Reserved / Savings Plans)
   +--------------------------------------------+
   | - Up to 72% discount with 1yr/3yr commitment|
   | - Savings Plans: Apply to all compute       |
   | - Reserved Instances: Apply to specific     |
   |   instances                                 |
   | - Best for stable workloads                 |
   +--------------------------------------------+

3. Spot Utilization (Spot Instances)
   +--------------------------------------------+
   | - Up to 90% discount off on-demand          |
   | - Best for batch processing, CI/CD, dev envs|
   | - Requires interruption tolerance            |
   | - Distribute with EC2 Fleet / Spot Fleet    |
   +--------------------------------------------+

4. Architecture Optimization
   +--------------------------------------------+
   | - Eliminate idle costs through serverless    |
   | - Tiered storage with S3 lifecycle policies |
   | - Reduce data transfer with CloudFront cache|
   | - 20% better price-performance with Graviton|
   +--------------------------------------------+
```

---

## 7. Cloud Migration Strategies

### 7.1 AWS 6R Migration Strategy

```
Six Migration Strategies (The 6 R's):

1. Rehost — "Lift and Shift"
   +----------------------------------------------+
   | Migrate to cloud as-is                        |
   | Rapid migration with minimal changes          |
   | Example: On-prem server -> AWS EC2            |
   | Applicable: Speed-focused, short-term savings |
   +----------------------------------------------+

2. Replatform — "Lift, Tinker, and Shift"
   +----------------------------------------------+
   | Replace some components with managed services |
   | Keep the application core unchanged           |
   | Example: MySQL -> Amazon RDS MySQL            |
   | Applicable: Balance of cost-effectiveness     |
   +----------------------------------------------+

3. Repurchase — "Drop and Shop"
   +----------------------------------------------+
   | Replace with SaaS products                    |
   | Example: Self-hosted mail server -> WorkMail  |
   | Applicable: Commoditized functionality        |
   +----------------------------------------------+

4. Refactor — "Re-architect"
   +----------------------------------------------+
   | Redesign as cloud-native                      |
   | Adopt microservices, go serverless            |
   | Example: Monolith -> Lambda + API Gateway +   |
   |          DynamoDB                             |
   | Applicable: Long-term optimization, new       |
   |             features needed                   |
   +----------------------------------------------+

5. Retire
   +----------------------------------------------+
   | Decommission unnecessary applications         |
   | Reduce migration costs, portfolio cleanup     |
   | Applicable: Identify and retire unused systems|
   +----------------------------------------------+

6. Retain
   +----------------------------------------------+
   | Keep as-is (do not migrate now)               |
   | Cannot migrate due to technical or regulatory |
   | constraints                                   |
   | Applicable: Low-priority systems              |
   +----------------------------------------------+
```

### 7.2 Migration Phases

```python
# Migration progress management with AWS Migration Hub
import boto3

mh = boto3.client('migration-hub', region_name='us-west-2')

# Create a migration task
def create_migration_task(app_name: str, strategy: str):
    """Create and track a migration task"""

    mh.notify_migration_task_state(
        ProgressUpdateStream='MyMigrationStream',
        MigrationTaskName=f'{app_name}-migration',
        Task={
            'Status': 'IN_PROGRESS',
            'StatusDetail': f'Strategy: {strategy}',
            'ProgressPercent': 0
        },
        UpdateDateTime=datetime.now(),
        NextUpdateSeconds=3600
    )

    return f'{app_name}-migration'

# Update migration progress
def update_migration_progress(task_name: str, percent: int, detail: str):
    mh.notify_migration_task_state(
        ProgressUpdateStream='MyMigrationStream',
        MigrationTaskName=task_name,
        Task={
            'Status': 'IN_PROGRESS' if percent < 100 else 'COMPLETED',
            'StatusDetail': detail,
            'ProgressPercent': percent
        },
        UpdateDateTime=datetime.now()
    )

# Usage example
task = create_migration_task('legacy-crm', 'Replatform')
update_migration_progress(task, 25, 'Migrating database')
update_migration_progress(task, 50, 'Deploying application')
update_migration_progress(task, 75, 'Running tests')
update_migration_progress(task, 100, 'Migration complete - production verified')
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Stopping at Lift and Shift

Simply moving on-premises configurations to the cloud as-is fails to leverage cloud benefits (auto scaling, managed services) and often results in higher costs. You should plan a "cloud-native optimization" phase after migration.

```
# Bad example: Reproducing the same on-prem configuration
EC2 (always-on x 10 instances) + self-managed MySQL on EC2 + self-managed Redis on EC2
Monthly cost: ~$5,000 (excluding management effort)
↓
# Good example: Leverage managed services (Phase 2 optimization)
Fargate (Auto Scaling) + Aurora Serverless v2 + ElastiCache
Monthly cost: ~$2,000 (significantly reduced management effort)
```

### Anti-Pattern 2: Running Everything in a Single Cloud Account

Managing production, development, and staging environments in a single account makes permission isolation and cost tracking difficult. You should use AWS Organizations to separate accounts by environment.

```
# Bad example
All environments in a single AWS account
-> Risk of developers accidentally deleting production DB
-> Unclear cost breakdown by environment
↓
# Good example: Multi-account strategy
AWS Organizations
├── Management Account (Billing & governance)
│   └── AWS SSO, CloudTrail, Config
├── Security Account (Security aggregation)
│   └── GuardDuty, Security Hub, CloudTrail aggregation
├── Shared Services Account (Common infrastructure)
│   └── ECR, CodePipeline, Transit Gateway
├── Production Account
│   └── Production workloads (least privilege)
├── Staging Account
│   └── Staging environment
└── Development Account
    └── Developer use (relatively relaxed permissions)
```

### Anti-Pattern 3: Opening Security Groups Wide Open

```
# Bad example: Allow all ports from all IPs
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxx \
  --protocol -1 \
  --cidr 0.0.0.0/0
# -> Allows all traffic from anywhere, critical security risk

# Good example: Principle of least privilege
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxx \
  --ip-permissions '[
    {"IpProtocol":"tcp","FromPort":443,"ToPort":443,"IpRanges":[{"CidrIp":"0.0.0.0/0","Description":"HTTPS"}]},
    {"IpProtocol":"tcp","FromPort":22,"ToPort":22,"IpRanges":[{"CidrIp":"10.0.0.0/8","Description":"Internal SSH"}]}
  ]'
```

### Anti-Pattern 4: Deferring Logging and Monitoring

```python
# Good example: Build observability in from the start
import boto3

# CloudWatch alarm setup
cloudwatch = boto3.client('cloudwatch', region_name='ap-northeast-1')

def setup_essential_alarms(instance_id: str):
    """Set up essential alarms for an EC2 instance"""

    alarms = [
        {
            'AlarmName': f'{instance_id}-high-cpu',
            'MetricName': 'CPUUtilization',
            'Namespace': 'AWS/EC2',
            'Statistic': 'Average',
            'Period': 300,
            'EvaluationPeriods': 3,
            'Threshold': 80.0,
            'ComparisonOperator': 'GreaterThanThreshold',
        },
        {
            'AlarmName': f'{instance_id}-status-check',
            'MetricName': 'StatusCheckFailed',
            'Namespace': 'AWS/EC2',
            'Statistic': 'Maximum',
            'Period': 60,
            'EvaluationPeriods': 2,
            'Threshold': 0,
            'ComparisonOperator': 'GreaterThanThreshold',
        },
    ]

    for alarm_config in alarms:
        cloudwatch.put_metric_alarm(
            **alarm_config,
            Dimensions=[{'Name': 'InstanceId', 'Value': instance_id}],
            AlarmActions=['arn:aws:sns:ap-northeast-1:123456789012:alerts'],
            TreatMissingData='breaching'
        )
        print(f"Alarm created: {alarm_config['AlarmName']}")

setup_essential_alarms('i-0abcdef1234567890')
```

### Anti-Pattern 5: No Tagging Strategy

```python
# Good example: Systematic tagging strategy
REQUIRED_TAGS = {
    'Environment': ['production', 'staging', 'development'],
    'Project': None,  # Free-form input
    'Owner': None,    # Email address
    'CostCenter': None,
    'ManagedBy': ['terraform', 'cloudformation', 'manual'],
}

def validate_tags(tags: dict) -> list:
    """Validate tag policy"""
    errors = []
    for required_key, allowed_values in REQUIRED_TAGS.items():
        if required_key not in tags:
            errors.append(f"Required tag '{required_key}' is missing")
        elif allowed_values and tags[required_key] not in allowed_values:
            errors.append(
                f"Tag '{required_key}' value '{tags[required_key]}' is "
                f"not in allowed values {allowed_values}"
            )
    return errors

# Enforce tag policy with AWS Config Rule
# required-tags rule configuration
config_rule = {
    'ConfigRuleName': 'required-tags',
    'Source': {
        'Owner': 'AWS',
        'SourceIdentifier': 'REQUIRED_TAGS'
    },
    'InputParameters': json.dumps({
        'tag1Key': 'Environment',
        'tag2Key': 'Project',
        'tag3Key': 'Owner',
        'tag4Key': 'CostCenter'
    }),
    'Scope': {
        'ComplianceResourceTypes': [
            'AWS::EC2::Instance',
            'AWS::S3::Bucket',
            'AWS::RDS::DBInstance'
        ]
    }
}
```

---

## 9. Shared Responsibility Model in Detail

```
AWS Shared Responsibility Model:

+------------------------------------------------------+
|                User's Responsibility                  |
|           "Security IN the Cloud"                    |
|                                                      |
|  +----------------------------------------------+    |
|  | Customer Data                                 |    |
|  +----------------------------------------------+    |
|  | Platform, Applications, IAM Management        |    |
|  +----------------------------------------------+    |
|  | OS, Network, Firewall Configuration           |    |
|  +----------------------------------------------+    |
|  | Client-Side Encryption / Server-Side Encryption|   |
|  | Network Traffic Protection                    |    |
|  +----------------------------------------------+    |
|                                                      |
+------------------------------------------------------+
|              AWS's Responsibility                     |
|           "Security OF the Cloud"                    |
|                                                      |
|  +----------------------------------------------+    |
|  | Software: Compute, Storage, DB,               |    |
|  |           Networking                          |    |
|  +----------------------------------------------+    |
|  | Hardware / AWS Global Infrastructure          |    |
|  | Regions, AZs, Edge Locations                  |    |
|  +----------------------------------------------+    |
+------------------------------------------------------+
```

```python
# Security checklist based on the shared responsibility model
security_checklist = {
    'User Responsibility': {
        'IAM': [
            'Enable MFA on root account',
            'Create individual IAM users (no root sharing)',
            'Apply the principle of least privilege',
            'Use IAM roles (minimize access keys)',
            'Strengthen password policies',
            'Regularly rotate access keys',
        ],
        'Data Protection': [
            'Block public access on S3 buckets',
            'Encrypt EBS volumes',
            'Encrypt RDS instances',
            'Enforce SSL/TLS',
            'Manage keys with KMS',
        ],
        'Network': [
            'Configure security groups with least privilege',
            'Set up NACLs appropriately',
            'Enable VPC Flow Logs',
            'Utilize private subnets',
            'Use VPC endpoints',
        ],
        'Monitoring': [
            'Enable CloudTrail (all regions)',
            'Enable GuardDuty',
            'Enable AWS Config',
            'Set up CloudWatch alarms',
            'Integrate Security Hub',
        ]
    },
    'AWS Responsibility': [
        'Physical data center security',
        'Hardware disposal procedures',
        'Network infrastructure protection',
        'Hypervisor security',
        'Power and cooling assurance',
        'Compliance certification maintenance',
    ]
}

def print_checklist(checklist: dict, indent: int = 0):
    prefix = "  " * indent
    for key, value in checklist.items():
        print(f"{prefix}[ ] {key}")
        if isinstance(value, dict):
            print_checklist(value, indent + 1)
        elif isinstance(value, list):
            for item in value:
                print(f"{prefix}  [ ] {item}")

print_checklist(security_checklist)
```

---

## 10. FAQ

### Q1. Does the cloud really reduce costs?

Not necessarily. Always-on workloads may be cheaper on-premises. The true benefits of the cloud lie in "elasticity" and "agility," and cost advantages are highest for variable workloads and new project launches. With Reserved Instances or Savings Plans, discounts of up to 72% are possible even for fixed workloads.

Specific decision criteria:
- Average CPU utilization below 20% -> Cloud tends to be more expensive
- Peak-to-off-peak ratio of 3x or more -> Cloud is advantageous
- New project with uncertain future demand -> Cloud is advantageous
- Core system with stable operation for 3+ years -> Address with RI/SP, or consider on-premises

### Q2. Should I choose AWS, GCP, or Azure?

Decide based on team skill set, existing technology stack, and the maturity of required services. Generally, AWS has the broadest range of services, GCP excels in data analytics and ML, and Azure has the best affinity with the Microsoft ecosystem (Active Directory, Office 365). A multi-cloud strategy is also effective, but consider it carefully as it increases operational complexity.

```
Selection Criteria Matrix:

                    AWS     GCP     Azure
Service Breadth     *****   ***     ****
ML/AI               ****    *****   ****
Containers/K8s      ****    *****   ****
Enterprise Integration ****  ***    *****
Cost Transparency   ***     *****   ***
Japanese Support    *****   ***     ****
Startup-Friendly    ****    *****   ***
```

### Q3. Is cloud security weaker than on-premises?

Under the "shared responsibility model," the cloud provider handles physical infrastructure security while the user handles data and access management. Major providers have obtained certifications such as SOC 2, ISO 27001, and PCI DSS, and with proper configuration, security equal to or better than on-premises can be achieved.

### Q4. How long does cloud migration take?

It depends on scale and complexity, but here are general guidelines:

```
Timeline Guidelines by Migration Scale:

Small-scale (fewer than 10 servers)
├── Assessment: 2-4 weeks
├── Planning: 2-4 weeks
├── Migration execution: 4-8 weeks
└── Total: 2-4 months

Medium-scale (10-100 servers)
├── Assessment: 4-8 weeks
├── Planning: 4-8 weeks
├── Migration execution: 3-6 months
├── Optimization: 2-3 months
└── Total: 6-12 months

Large-scale (100+ servers)
├── Assessment: 2-3 months
├── Planning: 2-4 months
├── Migration execution: 6-18 months
├── Optimization: 3-6 months
└── Total: 1-2+ years
```

### Q5. Should I get cloud certifications?

They provide significant value when combined with practical experience.

```
AWS Certification Roadmap:

[Foundational Level]
└── Cloud Practitioner (CLF-C02)
    Study period: 2-4 weeks
    Target: All roles, cloud beginners

[Associate Level]
├── Solutions Architect Associate (SAA-C03)
│   Study period: 1-2 months
│   Target: Infrastructure engineers, architects
│
├── Developer Associate (DVA-C02)
│   Study period: 1-2 months
│   Target: Application developers
│
└── SysOps Administrator Associate (SOA-C02)
    Study period: 1-2 months
    Target: Operations engineers

[Professional Level]
├── Solutions Architect Professional (SAP-C02)
│   Study period: 2-3 months
│   Target: Senior architects
│
└── DevOps Engineer Professional (DOP-C02)
    Study period: 2-3 months
    Target: Senior DevOps engineers

[Specialty]
├── Security Specialty
├── Database Specialty
├── Advanced Networking Specialty
├── Machine Learning Specialty
└── Data Analytics Specialty
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing and running code to verify behavior.

### Q2: What are common mistakes beginners make?

Skipping the fundamentals and jumping to advanced topics. We recommend solidly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in practice?

Knowledge of this topic is frequently used in daily development work. It becomes especially important during code reviews and architecture design.

---

## 11. Summary

| Item | Key Point |
|------|-----------|
| Cloud Definition | A model for provisioning and releasing resources on demand with pay-as-you-go billing |
| Service Models | Abstraction increases in order: IaaS (infra) -> CaaS (container) -> PaaS (platform) -> FaaS (function) -> SaaS (app) |
| Deployment Models | Four types: Public, Private, Hybrid, and Multi-Cloud |
| AWS Strengths | Most services, most global regions, mature ecosystem |
| Cost Optimization | Four-layer strategy: pay-as-you-go + reserved discounts + spot utilization + architecture optimization |
| Security | Understand the shared responsibility model and ensure proper user-side configuration |
| Migration Strategy | Classify using the 6Rs (Rehost/Replatform/Repurchase/Refactor/Retire/Retain) |
| Cloud Native | 12 Factor App, microservices, IaC, and containerization are fundamentals |

---

## Recommended Next Guides

- [01-aws-account-setup.md](./01-aws-account-setup.md) -- AWS account creation and initial setup
- [02-aws-cli-sdk.md](./02-aws-cli-sdk.md) -- CLI/SDK setup and credential management

---

## References

1. NIST SP 800-145 "The NIST Definition of Cloud Computing" -- https://csrc.nist.gov/publications/detail/sp/800-145/final
2. AWS Well-Architected Framework -- https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html
3. Gartner "Magic Quadrant for Cloud Infrastructure and Platform Services" -- https://www.gartner.com/en/documents/cloud-infrastructure-platform-services
4. AWS Shared Responsibility Model -- https://aws.amazon.com/compliance/shared-responsibility-model/
5. CNCF Cloud Native Definition -- https://github.com/cncf/toc/blob/main/DEFINITION.md
6. The Twelve-Factor App -- https://12factor.net/
7. AWS Migration Hub -- https://docs.aws.amazon.com/migrationhub/
8. AWS Cost Optimization -- https://aws.amazon.com/pricing/cost-optimization/
9. AWS Certification -- https://aws.amazon.com/certification/

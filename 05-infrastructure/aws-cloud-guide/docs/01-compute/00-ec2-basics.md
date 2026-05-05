# EC2 Basics

> A systematic understanding of AWS virtual server EC2 fundamentals — instance types, AMIs, security groups, key pairs, and EBS

## What You Will Learn in This Chapter

1. Understand the EC2 instance lifecycle and criteria for selecting instance types
2. Properly configure AMIs, security groups, and key pairs to securely launch instances
3. Understand EBS volume types and characteristics to select optimal storage for your workload
4. Implement automation and security hardening using User Data and the metadata service
5. Manage EC2 environments as Infrastructure as Code using CloudFormation / CDK


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts

---

## 1. What is EC2?

Amazon Elastic Compute Cloud (EC2) is a service that lets you launch and manage virtual servers (instances) on demand on AWS. It eliminates the need to procure, install, and maintain physical servers, allowing flexible use of computing resources with per-minute billing.

### 1.1 Key Components of EC2

```
EC2 Instance Components
+--------------------------------------------------+
|                  EC2 Instance                     |
|                                                   |
|  +-------------+  +---------------------------+  |
|  |    AMI      |  |   Instance Type            |  |
|  | (OS+Software)|  | (CPU, Memory, Network)     |  |
|  +-------------+  +---------------------------+  |
|                                                   |
|  +-------------+  +---------------------------+  |
|  |  Key Pair   |  |   Security Group           |  |
|  | (SSH Auth)  |  | (Firewall)                 |  |
|  +-------------+  +---------------------------+  |
|                                                   |
|  +---------------------------------------------+ |
|  |           EBS Volume (Storage)               | |
|  |  Root Volume + Additional Volumes            | |
|  +---------------------------------------------+ |
|                                                   |
|  +---------------------------------------------+ |
|  |           VPC / Subnet (Network)             | |
|  +---------------------------------------------+ |
|                                                   |
|  +---------------------------------------------+ |
|  |       IAM Instance Profile (Permissions)     | |
|  +---------------------------------------------+ |
+--------------------------------------------------+
```

### 1.2 EC2 Pricing Model

EC2 pricing consists primarily of the following elements.

| Pricing Element | Description | Billing Unit |
|---------|------|---------|
| Instance Charges | Time-based billing based on vCPU and memory | Per second (minimum 60 seconds) |
| EBS Volume | Storage capacity and IOPS | GB/month + IOPS/month |
| Data Transfer | Outbound traffic outside the region | Per GB |
| Elastic IP | Charges for unused EIPs | Per hour |
| EBS Snapshots | Backups stored in S3 | GB/month |

```bash
# Commands useful for EC2 cost estimation
# Retrieve instance type pricing information (AWS Pricing API)
aws pricing get-products \
  --service-code AmazonEC2 \
  --filters \
    "Type=TERM_MATCH,Field=instanceType,Value=t3.small" \
    "Type=TERM_MATCH,Field=location,Value=Asia Pacific (Tokyo)" \
    "Type=TERM_MATCH,Field=operatingSystem,Value=Linux" \
    "Type=TERM_MATCH,Field=tenancy,Value=Shared" \
    "Type=TERM_MATCH,Field=preInstalledSw,Value=NA" \
  --region us-east-1 \
  --query 'PriceList[0]' \
  --output json | jq '.terms.OnDemand | to_entries[0].value.priceDimensions | to_entries[0].value.pricePerUnit.USD'
```

### 1.3 Instance Lifecycle

```
              +----------+
              | pending  |  <- Starting
              +----+-----+
                   |
                   v
+--------+   +---------+   +----------+
| stopped| <-| running | ->| stopping |
+---+----+   +----+----+   +----------+
    |             |
    |             v
    |        +------------+
    +------> | terminated |  <- Deleted (cannot be restored)
             +------------+

  Start: stopped -> pending -> running
  Stop: running -> stopping -> stopped
  Terminate: running -> shutting-down -> terminated
  Hibernate: running -> stopping -> stopped (memory contents saved to EBS)
```

Billing by state:

| State | Instance Billing | EBS Billing | Elastic IP Billing |
|------|---------------|---------|---------------|
| running | Yes | Yes | No (when attached) |
| stopped | No | Yes | Yes (when unattached) |
| terminated | No | No (already deleted) | Yes (when unattached) |

### 1.4 EC2 Network Architecture

```
EC2 Network Placement
+--------------------------------------------------+
|  VPC (10.0.0.0/16)                                |
|                                                   |
|  +--------------------+  +--------------------+  |
|  | Public Subnet      |  | Private Subnet     |  |
|  | (10.0.1.0/24)      |  | (10.0.2.0/24)      |  |
|  |  +-------------+   |  |  +-------------+   |  |
|  |  | Web Server  |   |  |  | App Server  |   |  |
|  |  | (EC2)       |   |  |  | (EC2)       |   |  |
|  |  | Public IP   |   |  |  | Private IP  |   |  |
|  |  +------+------+   |  |  +------+------+   |  |
|  |         |           |  |         |           |  |
|  +----+----+-----+-----+  +----+----+-----+-----+  |
|       |          |              |          |        |
|  +----v----+ +---v----+   +----v----+ +---v----+  |
|  | IGW     | | NAT GW |   | NAT GW | |  VPC   |  |
|  |(Internet)| |        |   |(via)   | |Endpoint|  |
|  +---------+ +--------+   +--------+ +--------+  |
+--------------------------------------------------+
```

---

## 2. Instance Types

### 2.1 Naming Convention

```
  m  5  a  .  xlarge
  |  |  |     |
  |  |  |     +-- Size (nano, micro, small, medium, large, xlarge, 2xlarge...)
  |  |  +-------- Additional attributes (a: AMD, g: Graviton, n: enhanced networking, d: local storage)
  |  +----------- Generation number
  +-------------- Family (general purpose, compute optimized, memory optimized...)

  Additional attribute examples:
  m5a.xlarge   -> a: AMD processor (cost-efficient)
  m7g.xlarge   -> g: Graviton (ARM) processor (high performance, low cost)
  m5n.xlarge   -> n: Enhanced networking (up to 100Gbps)
  m5d.xlarge   -> d: Local NVMe SSD included
  m5ad.xlarge  -> a+d: AMD + Local NVMe SSD
  c7gn.xlarge  -> g+n: Graviton + Enhanced networking
  r6idn.xlarge -> i+d+n: Intel + Local NVMe + Enhanced networking
```

### 2.2 Instance Family Comparison

| Family | Prefix | Characteristics | Use Cases |
|-----------|-------------|------|-------------|
| General Purpose | t3, m5, m6i, m7g | Balanced CPU/memory | Web servers, small-medium DBs |
| Compute Optimized | c5, c6i, c7g | High CPU performance | Batch processing, ML inference |
| Memory Optimized | r5, r6i, x2idn | Large memory capacity | In-memory DBs, big data |
| Storage Optimized | i3, d3, h1 | High I/O | Data warehouses, log processing |
| Accelerated Computing | p4, g5, inf2 | GPU / inference chips | ML training, video processing |
| HPC Optimized | hpc6a, hpc7g | High-bandwidth networking | Scientific computing, simulations |

### 2.3 Graviton Processor Selection

AWS Graviton is an ARM-based custom processor that achieves up to 40% cost-performance improvement compared to equivalent Intel/AMD instances.

```
Graviton Generation Comparison
+-------------------+-------------------+-------------------+
| Graviton2         | Graviton3         | Graviton4         |
| (2020~)           | (2022~)           | (2024~)           |
+-------------------+-------------------+-------------------+
| m6g, c6g, r6g     | m7g, c7g, r7g     | m8g, c8g, r8g     |
| t4g               | c7gn (networking) | (latest generation)|
| 40% improvement   | 25% improvement   | 30% improvement   |
| over previous gen | over Graviton2    | over Graviton3    |
+-------------------+-------------------+-------------------+

Software compatibility checkpoints:
- Docker containers: linux/arm64 images required
- Node.js / Python / Java: mostly works as-is
- C/C++ native: ARM compilation required
- .NET: ARM native support from .NET 6+
```

```bash
# Graviton instance pricing comparison
# Check price difference between Intel and Graviton
echo "=== t3.medium (Intel x86_64) ==="
aws pricing get-products \
  --service-code AmazonEC2 \
  --filters \
    "Type=TERM_MATCH,Field=instanceType,Value=t3.medium" \
    "Type=TERM_MATCH,Field=location,Value=Asia Pacific (Tokyo)" \
    "Type=TERM_MATCH,Field=operatingSystem,Value=Linux" \
  --region us-east-1 --output json 2>/dev/null | jq -r '.PriceList[0]' | jq -r '.terms.OnDemand | to_entries[0].value.priceDimensions | to_entries[0].value.pricePerUnit.USD'

echo "=== t4g.medium (Graviton2 ARM64) ==="
aws pricing get-products \
  --service-code AmazonEC2 \
  --filters \
    "Type=TERM_MATCH,Field=instanceType,Value=t4g.medium" \
    "Type=TERM_MATCH,Field=location,Value=Asia Pacific (Tokyo)" \
    "Type=TERM_MATCH,Field=operatingSystem,Value=Linux" \
  --region us-east-1 --output json 2>/dev/null | jq -r '.PriceList[0]' | jq -r '.terms.OnDemand | to_entries[0].value.priceDimensions | to_entries[0].value.pricePerUnit.USD'
```

### 2.4 T-Series Instance Burst Model

| Item | t3.nano | t3.micro | t3.small | t3.medium | t3.large |
|------|---------|----------|----------|-----------|----------|
| vCPU | 2 | 2 | 2 | 2 | 2 |
| Memory | 0.5 GiB | 1 GiB | 2 GiB | 4 GiB | 8 GiB |
| Baseline CPU | 5% | 10% | 20% | 20% | 30% |
| CPU Credits/hour | 6 | 12 | 24 | 24 | 36 |
| Max Credit Balance | 144 | 288 | 576 | 576 | 864 |
| Price (Tokyo, Linux) | ~$0.0068/h | ~$0.0136/h | ~$0.0272/h | ~$0.0544/h | ~$0.1088/h |

```
T3 Burst Model
CPU Usage
100% |     *****
     |    *     *
 20% |---*-------*----------  <- Baseline
     |  *         **********
  0% +--+----+----+----------> Time
     Credit   Credit
     consumed accumulated

T3 Unlimited Mode:
- Usage beyond baseline continues with additional charges
- Additional charge of $0.05/hour per vCPU (Linux)
- Useful for temporary high loads such as batch processing
- Be cautious of unexpected high charges
```

```bash
# Check and configure T3 burst mode
# Check current credit balance
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUCreditBalance \
  --dimensions Name=InstanceId,Value=i-0123456789abcdef0 \
  --start-time "$(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 300 \
  --statistics Average

# Enable Unlimited mode
aws ec2 modify-instance-credit-specification \
  --instance-credit-specifications '[{
    "InstanceId": "i-0123456789abcdef0",
    "CpuCredits": "unlimited"
  }]'

# Disable Unlimited mode (revert to standard)
aws ec2 modify-instance-credit-specification \
  --instance-credit-specifications '[{
    "InstanceId": "i-0123456789abcdef0",
    "CpuCredits": "standard"
  }]'
```

### 2.5 Instance Type Selection Flowchart

```
Instance Type Selection Flow
============================

What is the use case?
+-- Web Server / API Server
|   +-- Intermittent load -> t3 / t4g
|   +-- Steady load -> m6i / m7g
|   +-- CPU-intensive -> c6i / c7g
|
+-- Database
|   +-- Small to medium -> r6i / r7g (memory optimized)
|   +-- In-memory DB -> x2idn (large memory)
|   +-- High IOPS -> i3 (local NVMe)
|
+-- Machine Learning
|   +-- Training -> p4d / p5 (GPU)
|   +-- Inference -> inf2 (Inferentia)
|   +-- Data preprocessing -> c6i / c7g
|
+-- Batch Processing
|   +-- CPU-intensive -> c6i / c7g
|   +-- Memory-intensive -> r6i / r7g
|   +-- I/O-intensive -> i3 / d3
|
+-- Development / Testing
    +-- Lowest cost -> t3.micro / t4g.micro
    +-- Free tier -> t2.micro (free for 12 months)
```

---

## 3. AMI (Amazon Machine Image)

### 3.1 Types of AMIs

| Type | Provider | Examples | Characteristics |
|------|--------|-----|------|
| AWS Official AMI | Amazon | Amazon Linux 2023, Ubuntu, Windows Server | Regularly patched, free |
| Marketplace AMI | Third-party | WordPress, NGINX Plus, Databricks | May include license fees |
| Community AMI | General users | Custom builds | Be aware of security risks |
| Custom AMI | Your organization | Internal standard configurations | Operated as golden images |

### 3.2 AMI Architecture

```
AMI Structure
+-------------------------------------------+
|  AMI (ami-0abcdef1234567890)              |
|                                            |
|  +--------------------------------------+ |
|  | Root EBS Snapshot                     | |
|  | - OS (Amazon Linux 2023)              | |
|  | - Pre-installed software              | |
|  | - Configuration files                 | |
|  +--------------------------------------+ |
|                                            |
|  +--------------------------------------+ |
|  | Additional EBS Snapshots (optional)   | |
|  | - Data volumes                        | |
|  +--------------------------------------+ |
|                                            |
|  +--------------------------------------+ |
|  | Metadata                              | |
|  | - Architecture (x86_64 / arm64)       | |
|  | - Virtualization type (hvm)           | |
|  | - Boot mode (uefi / legacy-bios)      | |
|  | - Block device mapping                | |
|  +--------------------------------------+ |
+-------------------------------------------+
```

### 3.3 Code Example: Searching for and Launching AMIs

```bash
# Search for the latest Amazon Linux 2023 AMI
aws ec2 describe-images \
  --owners amazon \
  --filters \
    "Name=name,Values=al2023-ami-2023*-x86_64" \
    "Name=state,Values=available" \
  --query 'Images | sort_by(@, &CreationDate) | [-1].[ImageId,Name]' \
  --output text

# Latest Amazon Linux 2023 ARM64 (Graviton) AMI
aws ec2 describe-images \
  --owners amazon \
  --filters \
    "Name=name,Values=al2023-ami-2023*-arm64" \
    "Name=state,Values=available" \
  --query 'Images | sort_by(@, &CreationDate) | [-1].[ImageId,Name]' \
  --output text

# Search for the latest Ubuntu 22.04 AMI
aws ec2 describe-images \
  --owners 099720109477 \
  --filters \
    "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
    "Name=state,Values=available" \
  --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
  --output text

# Search for the latest Ubuntu 24.04 AMI
aws ec2 describe-images \
  --owners 099720109477 \
  --filters \
    "Name=name,Values=ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*" \
    "Name=state,Values=available" \
  --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
  --output text

# Retrieve the latest AMI from SSM Parameter Store (recommended)
aws ssm get-parameter \
  --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-x86_64 \
  --query 'Parameter.Value' --output text
```

### 3.4 Code Example: Creating and Managing Custom AMIs

```bash
# Create an AMI from a running instance
aws ec2 create-image \
  --instance-id i-0123456789abcdef0 \
  --name "my-app-v1.2.0-$(date +%Y%m%d)" \
  --description "My App v1.2.0 with NGINX + Node.js" \
  --no-reboot \
  --tag-specifications '[
    {
      "ResourceType": "image",
      "Tags": [
        {"Key": "Name", "Value": "my-app-v1.2.0"},
        {"Key": "Version", "Value": "1.2.0"},
        {"Key": "CreatedBy", "Value": "automation"}
      ]
    },
    {
      "ResourceType": "snapshot",
      "Tags": [
        {"Key": "Name", "Value": "my-app-v1.2.0-snapshot"}
      ]
    }
  ]'

# List AMIs (your account)
aws ec2 describe-images --owners self \
  --query 'Images[].[ImageId,Name,CreationDate,State]' \
  --output table

# Cross-region AMI copy
aws ec2 copy-image \
  --source-region ap-northeast-1 \
  --source-image-id ami-0abcdef1234567890 \
  --name "my-app-v1.2.0-us-east-1" \
  --description "Cross-region copy of my-app-v1.2.0" \
  --region us-east-1

# Deregister old AMI and delete snapshots
AMI_ID="ami-0abcdef1234567890"
# Get snapshot IDs
SNAP_IDS=$(aws ec2 describe-images --image-ids $AMI_ID \
  --query 'Images[0].BlockDeviceMappings[*].Ebs.SnapshotId' --output text)
# Deregister AMI
aws ec2 deregister-image --image-id $AMI_ID
# Delete snapshots
for SNAP_ID in $SNAP_IDS; do
  aws ec2 delete-snapshot --snapshot-id $SNAP_ID
done
```

### 3.5 Golden AMI Pipeline

```
Golden AMI Automated Build Flow
===================================

  +-------------------+
  | EC2 Image Builder |
  | Pipeline          |
  +--------+----------+
           |
    +------v------+
    | Base AMI    |  (Amazon Linux 2023)
    +------+------+
           |
    +------v------+
    | Build        |  - Package installation
    | Components   |  - Security configuration
    |              |  - Application deployment
    +------+------+
           |
    +------v------+
    | Test         |  - CIS benchmarks
    | Components   |  - Inspector scan
    |              |  - Functional verification
    +------+------+
           |
    +------v------+
    | Golden AMI   |  -> Distribute to each region
    | Distribution |  -> Use with Auto Scaling
    +-------------+
```

```bash
# Example of creating an EC2 Image Builder pipeline
# First, define a component
aws imagebuilder create-component \
  --name "install-web-server" \
  --semantic-version "1.0.0" \
  --platform Linux \
  --data '
name: InstallWebServer
schemaVersion: 1.0
phases:
  - name: build
    steps:
      - name: InstallNginx
        action: ExecuteBash
        inputs:
          commands:
            - dnf install -y nginx
            - systemctl enable nginx
      - name: InstallNodeJS
        action: ExecuteBash
        inputs:
          commands:
            - dnf install -y nodejs npm
  - name: validate
    steps:
      - name: ValidateNginx
        action: ExecuteBash
        inputs:
          commands:
            - nginx -t
            - node --version
'
```

---

## 4. Security Groups

### 4.1 Security Group Characteristics

```
Security Group = Stateful Firewall

  Inbound Rules                  Outbound Rules
  (Outside -> Inside)            (Inside -> Outside)
  +-------------------+          +-------------------+
  | Allow rules only   |          | Allow rules only   |
  | Default: Deny all  |          | Default: Allow all  |
  | Stateful           |          | Stateful           |
  +-------------------+          +-------------------+

  Stateful = Return traffic for allowed inbound traffic is automatically permitted

  Security Group vs Network ACL
  +---------------------------+---------------------------+
  | Security Group            | Network ACL               |
  +---------------------------+---------------------------+
  | Instance level            | Subnet level              |
  | Stateful                  | Stateless                 |
  | Allow rules only          | Allow + Deny rules        |
  | Evaluates all rules       | Evaluates by number order |
  |                           | (first match)             |
  | Associated with ENI       | Associated with subnet    |
  +---------------------------+---------------------------+
```

### 4.2 Code Example: Creating Security Groups

```bash
# Create a security group for web servers
SG_ID=$(aws ec2 create-security-group \
  --group-name web-server-sg \
  --description "Security group for web servers" \
  --vpc-id vpc-0123456789abcdef0 \
  --tag-specifications 'ResourceType=security-group,Tags=[{Key=Name,Value=web-server-sg}]' \
  --query 'GroupId' --output text)

# SSH (management, specific IP only)
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp --port 22 \
  --cidr 203.0.113.0/32

# HTTP
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp --port 80 \
  --cidr 0.0.0.0/0

# HTTPS
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp --port 443 \
  --cidr 0.0.0.0/0

# IPv6 support
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --ip-permissions '[
    {"IpProtocol": "tcp", "FromPort": 80, "ToPort": 80, "Ipv6Ranges": [{"CidrIpv6": "::/0"}]},
    {"IpProtocol": "tcp", "FromPort": 443, "ToPort": 443, "Ipv6Ranges": [{"CidrIpv6": "::/0"}]}
  ]'

echo "Created Security Group: $SG_ID"

# List security group rules
aws ec2 describe-security-group-rules \
  --filter Name=group-id,Values=$SG_ID \
  --query 'SecurityGroupRules[].[IsEgress,IpProtocol,FromPort,ToPort,CidrIpv4,ReferencedGroupInfo.GroupId]' \
  --output table
```

### 4.3 Security Group Design Example (Multi-Tier Architecture)

| Tier | SG Name | Inbound | Source | Description |
|----|--------|------------|--------|------|
| ALB | alb-sg | 80, 443 | 0.0.0.0/0 | HTTP/HTTPS from the internet |
| Web | web-sg | 8080 | alb-sg | Accessible only from ALB |
| App | app-sg | 3000 | web-sg | Accessible only from Web tier |
| DB | db-sg | 3306 | app-sg | Accessible only from App tier |
| Cache | cache-sg | 6379 | app-sg | Accessible only from App tier |
| Bastion | bastion-sg | 22 | Office IP/32 | Management bastion host |

```bash
# Script to batch-create multi-tier security groups
#!/bin/bash
VPC_ID="vpc-0123456789abcdef0"
OFFICE_IP="203.0.113.0/32"

# ALB SG
ALB_SG=$(aws ec2 create-security-group \
  --group-name alb-sg --description "ALB SG" --vpc-id $VPC_ID \
  --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $ALB_SG \
  --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $ALB_SG \
  --protocol tcp --port 443 --cidr 0.0.0.0/0

# Web SG (from ALB only)
WEB_SG=$(aws ec2 create-security-group \
  --group-name web-sg --description "Web SG" --vpc-id $VPC_ID \
  --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $WEB_SG \
  --protocol tcp --port 8080 --source-group $ALB_SG

# App SG (from Web only)
APP_SG=$(aws ec2 create-security-group \
  --group-name app-sg --description "App SG" --vpc-id $VPC_ID \
  --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $APP_SG \
  --protocol tcp --port 3000 --source-group $WEB_SG

# DB SG (from App only)
DB_SG=$(aws ec2 create-security-group \
  --group-name db-sg --description "DB SG" --vpc-id $VPC_ID \
  --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $DB_SG \
  --protocol tcp --port 3306 --source-group $APP_SG

echo "ALB: $ALB_SG | Web: $WEB_SG | App: $APP_SG | DB: $DB_SG"
```

### 4.4 Security Group Best Practices

1. **Principle of Least Privilege**: Only allow necessary ports and sources
2. **Use SG IDs as Sources**: Reference SG IDs instead of CIDR blocks to handle dynamic IP changes
3. **Always Include Descriptions**: Clearly document the purpose of each rule
4. **Regular Auditing**: Remove unnecessary rules
5. **Avoid Using the Default SG**: Create dedicated SGs with explicit configurations

---

## 5. Key Pairs and Connection Methods

### 5.1 Code Example: Creating Key Pairs and SSH Connection

```bash
# Create a key pair (Ed25519 recommended)
aws ec2 create-key-pair \
  --key-name my-key-pair \
  --key-type ed25519 \
  --query 'KeyMaterial' \
  --output text > my-key-pair.pem

# Set permissions
chmod 400 my-key-pair.pem

# SSH connection
ssh -i my-key-pair.pem ec2-user@<Public IP>

# EC2 Instance Connect (connect without a key pair)
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-0123456789abcdef0 \
  --instance-os-user ec2-user \
  --ssh-public-key file://~/.ssh/id_ed25519.pub
```

### 5.2 Connection via Session Manager (Recommended)

Session Manager allows you to connect to instances without opening SSH ports.

```bash
# Connect via Session Manager (no SSH port required)
aws ssm start-session --target i-0123456789abcdef0

# Port forwarding (local 8080 -> remote 80)
aws ssm start-session \
  --target i-0123456789abcdef0 \
  --document-name AWS-StartPortForwardingSession \
  --parameters '{"portNumber":["80"],"localPortNumber":["8080"]}'

# Port forwarding to RDS (no bastion host needed)
aws ssm start-session \
  --target i-0123456789abcdef0 \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{
    "host": ["my-db.xxxx.ap-northeast-1.rds.amazonaws.com"],
    "portNumber": ["3306"],
    "localPortNumber": ["3306"]
  }'
```

IAM policy required for Session Manager:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:StartSession",
        "ssm:TerminateSession",
        "ssm:ResumeSession"
      ],
      "Resource": [
        "arn:aws:ec2:ap-northeast-1:123456789012:instance/*",
        "arn:aws:ssm:ap-northeast-1:123456789012:document/AWS-StartPortForwardingSession",
        "arn:aws:ssm:ap-northeast-1:123456789012:document/AWS-StartPortForwardingSessionToRemoteHost"
      ],
      "Condition": {
        "StringLike": {
          "ssm:resourceTag/Environment": ["production", "staging"]
        }
      }
    }
  ]
}
```

### 5.3 IAM Role Configuration for EC2 Instances

```bash
# Create an IAM role for EC2
aws iam create-role \
  --role-name EC2-WebServer-Role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {"Service": "ec2.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }
    ]
  }'

# Attach SSM policy (required for Session Manager)
aws iam attach-role-policy \
  --role-name EC2-WebServer-Role \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore

# Attach S3 read-only policy
aws iam attach-role-policy \
  --role-name EC2-WebServer-Role \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess

# Create an instance profile and associate the role
aws iam create-instance-profile \
  --instance-profile-name EC2-WebServer-Profile

aws iam add-role-to-instance-profile \
  --instance-profile-name EC2-WebServer-Profile \
  --role-name EC2-WebServer-Role

# Attach the profile to an existing instance
aws ec2 associate-iam-instance-profile \
  --instance-id i-0123456789abcdef0 \
  --iam-instance-profile Name=EC2-WebServer-Profile
```

---

## 6. EBS (Elastic Block Store)

### 6.1 EBS Volume Type Comparison

| Type | Name | IOPS | Throughput | Max Size | Use Cases |
|--------|------|------|-------------|---------|------|
| gp3 | General Purpose SSD | 3,000-16,000 | 125-1,000 MB/s | 16 TiB | General purpose (recommended) |
| gp2 | General Purpose SSD | 100-16,000 (capacity-linked) | 128-250 MB/s | 16 TiB | Legacy |
| io2 | Provisioned IOPS | Up to 64,000 | 1,000 MB/s | 16 TiB | High-performance DBs |
| io2 Block Express | Ultra-high Performance SSD | Up to 256,000 | 4,000 MB/s | 64 TiB | SAP HANA, etc. |
| st1 | Throughput Optimized HDD | 500 | 500 MB/s | 16 TiB | Big data |
| sc1 | Cold HDD | 250 | 250 MB/s | 16 TiB | Archives |

### 6.2 Migration from gp2 to gp3

gp3 can achieve up to 20% cost reduction compared to gp2 at the same performance level. It also has the advantage of independently configuring IOPS and throughput.

```bash
# Change a gp2 volume to gp3
aws ec2 modify-volume \
  --volume-id vol-0123456789abcdef0 \
  --volume-type gp3 \
  --iops 3000 \
  --throughput 125

# Check modification status
aws ec2 describe-volumes-modifications \
  --volume-ids vol-0123456789abcdef0 \
  --query 'VolumesModifications[0].[ModificationState,TargetVolumeType,TargetIops,TargetThroughput,Progress]' \
  --output table

# List all gp2 volumes (identify migration candidates)
aws ec2 describe-volumes \
  --filters "Name=volume-type,Values=gp2" \
  --query 'Volumes[].[VolumeId,Size,Iops,State,Attachments[0].InstanceId]' \
  --output table
```

### 6.3 Code Example: Creating and Attaching EBS Volumes

```bash
# Create a gp3 volume (100GB, 5000 IOPS)
VOL_ID=$(aws ec2 create-volume \
  --volume-type gp3 \
  --size 100 \
  --iops 5000 \
  --throughput 250 \
  --availability-zone ap-northeast-1a \
  --encrypted \
  --kms-key-id alias/ebs-key \
  --tag-specifications 'ResourceType=volume,Tags=[{Key=Name,Value=data-vol}]' \
  --query 'VolumeId' --output text)

# Attach to instance
aws ec2 attach-volume \
  --volume-id $VOL_ID \
  --instance-id i-0123456789abcdef0 \
  --device /dev/sdf

# Format and mount the volume on Linux
# (Execute via User Data or after SSH connection)
# Check the device
lsblk
# Create filesystem
sudo mkfs -t xfs /dev/nvme1n1
# Create mount point
sudo mkdir /data
# Mount
sudo mount /dev/nvme1n1 /data
# Configure persistent mount
UUID=$(sudo blkid -o value -s UUID /dev/nvme1n1)
echo "UUID=$UUID /data xfs defaults,nofail 0 2" | sudo tee -a /etc/fstab

# Create a snapshot
aws ec2 create-snapshot \
  --volume-id $VOL_ID \
  --description "Daily backup $(date +%Y-%m-%d)" \
  --tag-specifications 'ResourceType=snapshot,Tags=[{Key=Name,Value=daily-backup},{Key=RetainDays,Value=7}]'
```

### 6.4 EBS Snapshot Lifecycle Management

```bash
# Automate snapshot management with Data Lifecycle Manager (DLM)
aws dlm create-lifecycle-policy \
  --description "Daily EBS snapshots with 7-day retention" \
  --state ENABLED \
  --execution-role-arn arn:aws:iam::123456789012:role/AWSDataLifecycleManagerDefaultRole \
  --policy-details '{
    "PolicyType": "EBS_SNAPSHOT_MANAGEMENT",
    "ResourceTypes": ["VOLUME"],
    "TargetTags": [{"Key": "Backup", "Value": "true"}],
    "Schedules": [{
      "Name": "DailySnapshots",
      "CreateRule": {
        "Interval": 24,
        "IntervalUnit": "HOURS",
        "Times": ["03:00"]
      },
      "RetainRule": {
        "Count": 7
      },
      "CopyTags": true,
      "TagsToAdd": [{"Key": "CreatedBy", "Value": "DLM"}]
    }]
  }'
```

### 6.5 EBS vs Instance Store Comparison

| Characteristic | EBS | Instance Store |
|------|-----|------------------|
| Persistence | Retained after instance stop | Lost on instance stop |
| Snapshots | Supported | Not supported |
| Resize | Supported (online) | Not supported |
| Latency | Via network | Local disk (low latency) |
| IOPS | Up to 256,000 (io2 BE) | Up to millions (NVMe) |
| Use Cases | OS, DB, persistent data | Cache, temporary files, buffers |
| Encryption | KMS / default encryption | Hardware level |

---

## 7. Launching EC2 Instances — Complete Example

### 7.1 Launching with AWS CLI

```bash
# Launch an instance with all elements specified
aws ec2 run-instances \
  --image-id ami-0abcdef1234567890 \
  --instance-type t3.small \
  --key-name my-key-pair \
  --security-group-ids sg-0123456789abcdef0 \
  --subnet-id subnet-0123456789abcdef0 \
  --block-device-mappings '[
    {
      "DeviceName": "/dev/xvda",
      "Ebs": {
        "VolumeSize": 30,
        "VolumeType": "gp3",
        "Iops": 3000,
        "Throughput": 125,
        "DeleteOnTermination": true,
        "Encrypted": true
      }
    }
  ]' \
  --iam-instance-profile Name=EC2-WebServer-Profile \
  --user-data file://startup.sh \
  --tag-specifications \
    'ResourceType=instance,Tags=[{Key=Name,Value=web-server-01},{Key=Environment,Value=production}]' \
    'ResourceType=volume,Tags=[{Key=Name,Value=web-server-01-root}]' \
  --metadata-options "HttpTokens=required,HttpEndpoint=enabled,HttpPutResponseHopLimit=1" \
  --count 1 \
  --monitoring Enabled=true
```

### 7.2 User Data Script Example

```bash
#!/bin/bash
# startup.sh - Script automatically executed at EC2 startup
set -euxo pipefail

# Log output destination
exec > >(tee /var/log/user-data.log | logger -t user-data -s 2>/dev/console) 2>&1

# System update
dnf update -y

# Install required packages
dnf install -y nginx nodejs npm git

# NGINX configuration
cat > /etc/nginx/conf.d/app.conf << 'NGINX_EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /health {
        access_log off;
        return 200 'healthy';
        add_header Content-Type text/plain;
    }
}
NGINX_EOF

# Start NGINX
systemctl start nginx
systemctl enable nginx

# Install CloudWatch Agent
dnf install -y amazon-cloudwatch-agent
cat > /opt/aws/amazon-cloudwatch-agent/etc/config.json << 'CW_EOF'
{
  "metrics": {
    "metrics_collected": {
      "mem": {"measurement": ["mem_used_percent"]},
      "disk": {"measurement": ["disk_used_percent"], "resources": ["/"]}
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/nginx/access.log",
            "log_group_name": "/ec2/nginx/access",
            "log_stream_name": "{instance_id}"
          },
          {
            "file_path": "/var/log/nginx/error.log",
            "log_group_name": "/ec2/nginx/error",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  }
}
CW_EOF
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/config.json

echo "User data script completed successfully"
```

### 7.3 CloudFormation Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: EC2 Web Server with best practices

Parameters:
  EnvironmentName:
    Type: String
    Default: production
    AllowedValues: [production, staging, development]
  InstanceType:
    Type: String
    Default: t3.small
    AllowedValues: [t3.micro, t3.small, t3.medium, t3.large, m6i.large]
  VpcId:
    Type: AWS::EC2::VPC::Id
  SubnetId:
    Type: AWS::EC2::Subnet::Id
  LatestAmiId:
    Type: AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>
    Default: /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-x86_64

Resources:
  # Security Group
  WebServerSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for web server
      VpcId: !Ref VpcId
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-web-sg

  # IAM Role
  WebServerRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: ec2.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
        - arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy
      Tags:
        - Key: Environment
          Value: !Ref EnvironmentName

  # Instance Profile
  WebServerInstanceProfile:
    Type: AWS::IAM::InstanceProfile
    Properties:
      Roles:
        - !Ref WebServerRole

  # EC2 Instance
  WebServerInstance:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: !Ref LatestAmiId
      InstanceType: !Ref InstanceType
      IamInstanceProfile: !Ref WebServerInstanceProfile
      SubnetId: !Ref SubnetId
      SecurityGroupIds:
        - !Ref WebServerSecurityGroup
      BlockDeviceMappings:
        - DeviceName: /dev/xvda
          Ebs:
            VolumeSize: 30
            VolumeType: gp3
            Iops: 3000
            Throughput: 125
            Encrypted: true
            DeleteOnTermination: true
      MetadataOptions:
        HttpTokens: required
        HttpEndpoint: enabled
        HttpPutResponseHopLimit: 1
      Monitoring: true
      UserData:
        Fn::Base64: |
          #!/bin/bash
          dnf update -y
          dnf install -y nginx
          systemctl start nginx
          systemctl enable nginx
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-web-server
        - Key: Environment
          Value: !Ref EnvironmentName

Outputs:
  InstanceId:
    Value: !Ref WebServerInstance
  PrivateIp:
    Value: !GetAtt WebServerInstance.PrivateIp
  SecurityGroupId:
    Value: !Ref WebServerSecurityGroup
```

### 7.4 EC2 Definition with CDK (TypeScript)

```typescript
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class Ec2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC (reference an existing VPC)
    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', {
      vpcId: 'vpc-0123456789abcdef0',
    });

    // Security Group
    const webSg = new ec2.SecurityGroup(this, 'WebSG', {
      vpc,
      description: 'Security group for web servers',
      allowAllOutbound: true,
    });
    webSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP');
    webSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS');

    // IAM Role
    const role = new iam.Role(this, 'WebServerRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      ],
    });

    // EC2 Instance
    const instance = new ec2.Instance(this, 'WebServer', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.X86_64,
      }),
      securityGroup: webSg,
      role,
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(30, {
          volumeType: ec2.EbsDeviceVolumeType.GP3,
          iops: 3000,
          throughput: 125,
          encrypted: true,
          deleteOnTermination: true,
        }),
      }],
      requireImdsv2: true,
      detailedMonitoring: true,
    });

    // User Data
    instance.addUserData(
      'dnf update -y',
      'dnf install -y nginx',
      'systemctl start nginx',
      'systemctl enable nginx',
    );

    // Outputs
    new cdk.CfnOutput(this, 'InstanceId', { value: instance.instanceId });
    new cdk.CfnOutput(this, 'PrivateIp', { value: instance.instancePrivateIp });
  }
}
```

---

## 8. Metadata Service (IMDS)

### 8.1 How to Use IMDSv2

```bash
# Retrieve a token and access metadata with IMDSv2
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

# Instance ID
curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/instance-id

# Instance type
curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/instance-type

# Public IP
curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/public-ipv4

# IAM role temporary credentials
curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/iam/security-credentials/

# Availability Zone
curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/placement/availability-zone

# Instance tags (configuration required)
curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/tags/instance/Name
```

### 8.2 Enforcing IMDSv2

```bash
# Enforce IMDSv2 on new instances
aws ec2 run-instances \
  --metadata-options "HttpTokens=required,HttpEndpoint=enabled,HttpPutResponseHopLimit=1" \
  ...

# Enforce IMDSv2 on existing instances
aws ec2 modify-instance-metadata-options \
  --instance-id i-0123456789abcdef0 \
  --http-tokens required \
  --http-endpoint enabled \
  --http-put-response-hop-limit 1

# Set IMDSv2 as default at the account level
aws ec2 modify-instance-metadata-defaults \
  --http-tokens required \
  --http-put-response-hop-limit 1 \
  --http-endpoint enabled \
  --region ap-northeast-1

# Detect instances still using IMDSv1
aws ec2 describe-instances \
  --query 'Reservations[].Instances[?MetadataOptions.HttpTokens==`optional`].[InstanceId,Tags[?Key==`Name`].Value|[0]]' \
  --output table
```

---

## 9. EC2 Monitoring

### 9.1 CloudWatch Metrics

```bash
# Get CPU utilization
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=InstanceId,Value=i-0123456789abcdef0 \
  --start-time "$(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 300 \
  --statistics Average Maximum

# Create a CPU alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "ec2-high-cpu" \
  --alarm-description "CPU usage exceeds 80% for 5 minutes" \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=InstanceId,Value=i-0123456789abcdef0 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:ap-northeast-1:123456789012:alerts

# Status check alarm (auto-recovery)
aws cloudwatch put-metric-alarm \
  --alarm-name "ec2-auto-recovery" \
  --alarm-description "Auto-recover when status check fails" \
  --namespace AWS/EC2 \
  --metric-name StatusCheckFailed_System \
  --dimensions Name=InstanceId,Value=i-0123456789abcdef0 \
  --statistic Maximum \
  --period 60 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:automate:ap-northeast-1:ec2:recover
```

### 9.2 Key Metrics Overview

| Metric | Description | Normal Range | Alert Threshold |
|-----------|------|--------|------------|
| CPUUtilization | CPU usage (%) | 10-60% | > 80% |
| NetworkIn/Out | Network I/O (bytes) | Workload-dependent | Sudden increase |
| DiskReadOps/WriteOps | Disk I/O operations | Workload-dependent | Queue length increase |
| StatusCheckFailed | System/instance check | 0 | > 0 |
| CPUCreditBalance | T-series credit balance | > 100 | < 20 |
| mem_used_percent | Memory usage (CW Agent) | 30-70% | > 85% |
| disk_used_percent | Disk usage (CW Agent) | < 60% | > 80% |

---

## 10. Anti-Patterns

### Anti-Pattern 1: Exposing SSH to 0.0.0.0/0 in Security Groups

```bash
# Bad example - Expose SSH port to the entire world
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxx --protocol tcp --port 22 --cidr 0.0.0.0/0

# Good example - Allow only the management source IP + use Session Manager
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxx --protocol tcp --port 22 --cidr 203.0.113.10/32

# Even better - No SSH needed, connect via Session Manager
aws ssm start-session --target i-0123456789abcdef0
```

### Anti-Pattern 2: Using EBS Without Encryption

Volumes containing sensitive data should always be encrypted. Enabling default encryption prevents accidental omissions.

```bash
# Enable EBS default encryption at the account level
aws ec2 enable-ebs-encryption-by-default --region ap-northeast-1

# Check encryption status
aws ec2 get-ebs-encryption-by-default --region ap-northeast-1

# Change the default KMS key
aws ec2 modify-ebs-default-kms-key-id \
  --kms-key-id alias/ebs-custom-key \
  --region ap-northeast-1
```

### Anti-Pattern 3: Embedding Access Keys Instead of Using IAM Roles

```bash
# Bad example - Hardcoding access keys inside EC2
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
aws s3 ls  # Risk of key leakage

# Good example - Use IAM roles (instance profiles)
# Attach an IAM role to EC2 and automatically obtain temporary credentials
aws s3 ls  # Automatically uses instance profile credentials
```

### Anti-Pattern 4: Writing Secrets Directly in User Data

```bash
# Bad example - Hardcoding passwords in User Data
#!/bin/bash
export DB_PASSWORD="MySecretPassword123!"

# Good example - Retrieve from Secrets Manager
#!/bin/bash
DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id my-db-password \
  --query 'SecretString' --output text)
export DB_PASSWORD
```

### Anti-Pattern 5: Over-Sizing Instances

```
# Bad example - Choosing a huge instance "just in case"
-> m5.4xlarge (16 vCPU, 64 GiB) with 5% CPU usage

# Good example - Start with an appropriate size and scale based on monitoring
-> Start with t3.medium (2 vCPU, 4 GiB)
-> Upgrade to t3.large when CPU usage exceeds 60%
-> Regularly check AWS Compute Optimizer recommendations
```

```bash
# Check recommended instance types with AWS Compute Optimizer
aws compute-optimizer get-ec2-instance-recommendations \
  --instance-arns arn:aws:ec2:ap-northeast-1:123456789012:instance/i-0123456789abcdef0 \
  --query 'instanceRecommendations[].[instanceArn,currentInstanceType,recommendationOptions[0].instanceType,finding]' \
  --output table
```

---

## 11. EC2 Operational Best Practices

### 11.1 Tagging Strategy

| Tag Key | Description | Example |
|---------|------|-----|
| Name | Resource identifier | web-server-01 |
| Environment | Environment | production / staging / development |
| Team | Owning team | backend / frontend / infra |
| CostCenter | Cost allocation target | CC-12345 |
| Application | Application name | my-web-app |
| ManagedBy | Management method | terraform / cloudformation / manual |
| Backup | Backup target | true / false |

```bash
# Apply tagging policy
aws ec2 create-tags \
  --resources i-0123456789abcdef0 \
  --tags \
    Key=Name,Value=web-server-01 \
    Key=Environment,Value=production \
    Key=Team,Value=backend \
    Key=CostCenter,Value=CC-12345 \
    Key=Application,Value=my-web-app \
    Key=ManagedBy,Value=terraform \
    Key=Backup,Value=true
```

### 11.2 Patch Management

```bash
# Automate patch application with SSM Patch Manager
aws ssm create-patch-baseline \
  --name "AmazonLinux2023-Custom" \
  --operating-system AMAZON_LINUX_2023 \
  --approval-rules '{
    "PatchRules": [{
      "PatchFilterGroup": {
        "PatchFilters": [
          {"Key": "SEVERITY", "Values": ["Critical", "Important"]},
          {"Key": "CLASSIFICATION", "Values": ["Security", "Bugfix"]}
        ]
      },
      "ApproveAfterDays": 3,
      "ComplianceLevel": "CRITICAL"
    }]
  }'

# Create a maintenance window for patch application
aws ssm create-maintenance-window \
  --name "WeeklyPatching" \
  --schedule "cron(0 2 ? * SUN *)" \
  --duration 3 \
  --cutoff 1 \
  --allow-unassociated-targets
```

---

## 12. FAQ

### Q1. Should I choose t3.micro or t3.small?

t3.micro (1 GiB memory) is suitable for lightweight web servers and testing purposes. Applications requiring 2 GiB or more of memory (such as WordPress + MySQL) should use t3.small or larger. If you want to use the free tier, t2.micro (free for 12 months) is also worth considering. For cost efficiency, the Graviton-based t4g family is another strong option.

### Q2. What happens to data when an instance is stopped?

The EBS root volume (DeleteOnTermination=true) is deleted when an instance is "terminated," but is retained when "stopped." Instance store data is lost on both stop and termination. Back up important data to EBS snapshots or S3. Note that EBS charges continue even while the instance is stopped.

### Q3. What is IMDSv2? Why is it needed?

Instance Metadata Service v2 is a security enhancement that adds token-based authentication to metadata access. It prevents metadata leakage through SSRF attacks. You should enforce IMDSv2 with `HttpTokens=required`. The 2019 Capital One data breach exploited IMDSv1 vulnerabilities, and this incident was the catalyst for IMDSv2 development.

### Q4. What should the backup strategy for EC2 instances be?

A three-tier backup configuration is recommended:

1. **EBS Snapshots**: Auto-capture daily with Data Lifecycle Manager (DLM), retain for 7-30 days
2. **AMI**: Create golden AMIs weekly, automate with EC2 Image Builder
3. **AWS Backup**: Centrally manage backups across the organization, supports cross-region copy

### Q5. Is an Elastic IP necessary?

An Elastic IP is a static public IP address that remains unchanged across instance stop/start cycles. However, unused Elastic IPs incur charges. In most cases, a combination of DNS (Route 53) and ALB is more flexible and recommended. Use Elastic IPs only when direct IP access is required (such as VPN connection targets).

### Q6. What are the criteria for selecting EC2 regions and AZs?

| Consideration | Description |
|---------|------|
| Latency | Choose a region close to your users |
| Cost | Pricing varies by region (Tokyo > Virginia) |
| Compliance | Region constraints due to data sovereignty requirements |
| Service Availability | Some services are available only in specific regions |
| AZ Distribution | Use at least 2 AZs for availability |

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how things work.

### Q2: What are common mistakes beginners make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next steps.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 13. Summary

| Item | Key Points |
|------|---------|
| Instance Types | Select family and size based on workload, actively leverage Graviton |
| AMI | Amazon Linux 2023 / Ubuntu are common, retrieve latest AMIs via SSM Parameter Store |
| Security Groups | Stateful, minimize open ports, use SG IDs as sources |
| Key Pairs | Ed25519 recommended, consider migrating to Session Manager |
| EBS | gp3 recommended as default, always enable encryption, automate snapshots with DLM |
| User Data | Use for automated setup at launch, retrieve secrets from Secrets Manager |
| IMDSv2 | Always enable for SSRF protection, enforce at account level |
| Monitoring | Collect metrics and logs with CloudWatch + CloudWatch Agent |
| IaC | Manage infrastructure as code with CloudFormation / CDK |
| Cost | Verify right-sizing with Compute Optimizer, delete unused resources |

---

## Recommended Next Reads

- [01-ec2-advanced.md](./01-ec2-advanced.md) -- Auto Scaling, ALB, Spot Instances
- [../04-networking/00-vpc-basics.md](../04-networking/00-vpc-basics.md) -- VPC Basics

---

## References

1. Amazon EC2 User Guide -- https://docs.aws.amazon.com/ec2/latest/userguide/
2. EC2 Instance Types -- https://aws.amazon.com/ec2/instance-types/
3. EBS Volume Types -- https://docs.aws.amazon.com/ebs/latest/userguide/ebs-volume-types.html
4. EC2 Security Best Practices -- https://docs.aws.amazon.com/ec2/latest/userguide/ec2-security.html
5. AWS Graviton Processors -- https://aws.amazon.com/ec2/graviton/
6. EC2 Image Builder -- https://docs.aws.amazon.com/imagebuilder/latest/userguide/
7. AWS Systems Manager Session Manager -- https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html
8. AWS Compute Optimizer -- https://docs.aws.amazon.com/compute-optimizer/latest/ug/

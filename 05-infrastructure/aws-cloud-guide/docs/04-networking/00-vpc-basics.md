# Amazon VPC Fundamentals

> Understand VPC as the networking foundation of AWS, and practically master production network configurations using subnet design, route tables, and IGW/NAT GW

## What You Will Learn in This Chapter

1. **VPC Basic Architecture** — Design decisions for CIDR design, subnet segmentation, and AZ placement
2. **Routing and Gateways** — Roles and configuration of route tables, IGW, and NAT GW
3. **Security Controls** — Security groups, network ACLs, and VPC endpoints
4. **Inter-VPC Connectivity** — Choosing between VPC Peering, Transit Gateway, and PrivateLink
5. **VPC Flow Logs and Monitoring** — Network traffic visibility and troubleshooting


## Prerequisites

Before reading this guide, the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. VPC Architecture Overview

```
+----------------------------------------------------------------------+
|  AWS Region (ap-northeast-1)                                         |
|  +----------------------------------------------------------------+  |
|  |  VPC: 10.0.0.0/16 (65,536 IPs)                                |  |
|  |                                                                |  |
|  |  +-- AZ-1a ----------------+  +-- AZ-1c ----------------+     |  |
|  |  |                         |  |                         |     |  |
|  |  |  Public Subnet          |  |  Public Subnet          |     |  |
|  |  |  10.0.1.0/24            |  |  10.0.2.0/24            |     |  |
|  |  |  [ALB] [NAT GW]        |  |  [ALB] [NAT GW]        |     |  |
|  |  |                         |  |                         |     |  |
|  |  |  Private Subnet (App)   |  |  Private Subnet (App)   |     |  |
|  |  |  10.0.11.0/24           |  |  10.0.12.0/24           |     |  |
|  |  |  [ECS/EC2]              |  |  [ECS/EC2]              |     |  |
|  |  |                         |  |                         |     |  |
|  |  |  Private Subnet (DB)    |  |  Private Subnet (DB)    |     |  |
|  |  |  10.0.21.0/24           |  |  10.0.22.0/24           |     |  |
|  |  |  [RDS] [ElastiCache]    |  |  [RDS Standby]         |     |  |
|  |  +-------------------------+  +-------------------------+     |  |
|  +----------------------------------------------------------------+  |
|       |                                                              |
|  +----+----+                                                         |
|  |   IGW   | <--> Internet                                          |
|  +---------+                                                         |
+----------------------------------------------------------------------+
```

### Key VPC Components

| Component | Description | Scope |
|---|---|---|
| VPC | Logically isolated virtual network space | Region |
| Subnet | IP address range within a VPC | Availability Zone |
| Route Table | Traffic routing rules for subnets | VPC |
| Internet Gateway (IGW) | Connection point between VPC and the internet | VPC |
| NAT Gateway | Outbound internet connectivity from private subnets | AZ |
| Security Group | Stateful firewall at the instance level | VPC |
| Network ACL | Stateless firewall at the subnet level | VPC |
| VPC Endpoint | Private connection from within VPC to AWS services | VPC |
| Elastic IP | Static public IPv4 address | Region |
| ENI | Virtual network interface card | AZ |

### Code Example 1: Creating a VPC and Subnets (AWS CLI)

```bash
# VPC の作成
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=prod-vpc}]' \
  --query 'Vpc.VpcId' --output text)

# DNS 有効化
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-support
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-hostnames

# パブリックサブネット（AZ-1a, AZ-1c）
PUB_1A=$(aws ec2 create-subnet --vpc-id $VPC_ID \
  --cidr-block 10.0.1.0/24 --availability-zone ap-northeast-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=pub-1a}]' \
  --query 'Subnet.SubnetId' --output text)

PUB_1C=$(aws ec2 create-subnet --vpc-id $VPC_ID \
  --cidr-block 10.0.2.0/24 --availability-zone ap-northeast-1c \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=pub-1c}]' \
  --query 'Subnet.SubnetId' --output text)

# プライベートサブネット（App層 / DB層）
PRIV_APP_1A=$(aws ec2 create-subnet --vpc-id $VPC_ID \
  --cidr-block 10.0.11.0/24 --availability-zone ap-northeast-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=priv-app-1a}]' \
  --query 'Subnet.SubnetId' --output text)

PRIV_APP_1C=$(aws ec2 create-subnet --vpc-id $VPC_ID \
  --cidr-block 10.0.12.0/24 --availability-zone ap-northeast-1c \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=priv-app-1c}]' \
  --query 'Subnet.SubnetId' --output text)

PRIV_DB_1A=$(aws ec2 create-subnet --vpc-id $VPC_ID \
  --cidr-block 10.0.21.0/24 --availability-zone ap-northeast-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=priv-db-1a}]' \
  --query 'Subnet.SubnetId' --output text)

PRIV_DB_1C=$(aws ec2 create-subnet --vpc-id $VPC_ID \
  --cidr-block 10.0.22.0/24 --availability-zone ap-northeast-1c \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=priv-db-1c}]' \
  --query 'Subnet.SubnetId' --output text)

# パブリックサブネットの自動パブリック IP 割り当て有効化
aws ec2 modify-subnet-attribute \
  --subnet-id $PUB_1A \
  --map-public-ip-on-launch

aws ec2 modify-subnet-attribute \
  --subnet-id $PUB_1C \
  --map-public-ip-on-launch
```

---

## 2. CIDR Design

### CIDR Block Size Quick Reference

| CIDR | IP Count | Available IPs | Use Case |
|---|---|---|---|
| /16 | 65,536 | 65,531 | Entire VPC (recommended) |
| /20 | 4,096 | 4,091 | Large subnet |
| /24 | 256 | 251 | Standard subnet |
| /26 | 64 | 59 | Small subnet |
| /28 | 16 | 11 | Minimum subnet |

> AWS reserves 5 IPs per subnet (network, VPC router, DNS, future reservation, broadcast)

### Recommended CIDR Design Patterns

```
VPC: 10.0.0.0/16 Design Example
============================

Public Subnets     (each /24 = 251 IPs)
  AZ-a: 10.0.1.0/24
  AZ-c: 10.0.2.0/24
  AZ-d: 10.0.3.0/24

Private App        (each /20 = 4,091 IPs)
  AZ-a: 10.0.16.0/20
  AZ-c: 10.0.32.0/20
  AZ-d: 10.0.48.0/20

Private DB         (each /24 = 251 IPs)
  AZ-a: 10.0.64.0/24
  AZ-c: 10.0.65.0/24
  AZ-d: 10.0.66.0/24

Reserved           10.0.128.0/17 (reserved for future expansion)
```

### RFC 1918 Private IP Address Ranges

| Range | CIDR | IP Count | Recommended Use |
|---|---|---|---|
| 10.0.0.0 - 10.255.255.255 | 10.0.0.0/8 | 16,777,216 | Large-scale networks (recommended) |
| 172.16.0.0 - 172.31.255.255 | 172.16.0.0/12 | 1,048,576 | Medium-scale networks |
| 192.168.0.0 - 192.168.255.255 | 192.168.0.0/16 | 65,536 | Small-scale networks |

### CIDR Allocation Plan for Multi-VPC Environments

```
Multi-Account / Multi-VPC IP Allocation Example:
=============================================

Production Environment (Production Account)
  prod-vpc:       10.0.0.0/16
  shared-svc-vpc: 10.1.0.0/16

Staging Environment (Staging Account)
  staging-vpc:    10.2.0.0/16

Development Environment (Development Account)
  dev-vpc:        10.3.0.0/16

Security Environment (Security Account)
  security-vpc:   10.4.0.0/16

Logging Environment (Logging Account)
  logging-vpc:    10.5.0.0/16

Key Points:
  - Plan CIDRs so they do not overlap between VPCs
  - Overlapping CIDRs are not allowed when connecting via VPC Peering / Transit Gateway
  - Split the 10.0.0.0/8 range into multiple /16 blocks for allocation
  - Coordinate with on-premises networks to avoid overlap
  - Consider adding Secondary CIDRs (up to 5)
```

### Code Example 2: Adding a Secondary CIDR

```bash
# VPC に Secondary CIDR ブロックを追加
aws ec2 associate-vpc-cidr-block \
  --vpc-id $VPC_ID \
  --cidr-block 100.64.0.0/16

# 追加した CIDR でサブネットを作成
aws ec2 create-subnet --vpc-id $VPC_ID \
  --cidr-block 100.64.1.0/24 \
  --availability-zone ap-northeast-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=eks-pods-1a}]'

# 利用シーン:
# - EKS Pod のカスタムネットワーキング（Pod に VPC IP を割当）
# - IP アドレス空間が不足した場合の拡張
# - RFC 6598 (100.64.0.0/10) は CGN 用だが VPC 内では利用可能
```

### Code Example 3: VPC Definition with Terraform

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.5.0"

  name = "prod-vpc"
  cidr = "10.0.0.0/16"

  azs              = ["ap-northeast-1a", "ap-northeast-1c", "ap-northeast-1d"]
  public_subnets   = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  private_subnets  = ["10.0.16.0/20", "10.0.32.0/20", "10.0.48.0/20"]
  database_subnets = ["10.0.64.0/24", "10.0.65.0/24", "10.0.66.0/24"]

  enable_nat_gateway     = true
  single_nat_gateway     = false  # 本番: AZ ごとに NAT GW
  one_nat_gateway_per_az = true

  enable_dns_hostnames = true
  enable_dns_support   = true

  create_database_subnet_group       = true
  create_database_subnet_route_table = true

  enable_flow_log                      = true
  create_flow_log_cloudwatch_log_group = true
  create_flow_log_iam_role             = true

  # パブリックサブネットのタグ（EKS ALB Ingress Controller 用）
  public_subnet_tags = {
    "kubernetes.io/role/elb" = "1"
  }

  # プライベートサブネットのタグ（EKS 内部 LB 用）
  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = "1"
  }

  tags = {
    Environment = "production"
    Terraform   = "true"
  }
}

# VPC のアウトプット
output "vpc_id" {
  value = module.vpc.vpc_id
}

output "private_subnet_ids" {
  value = module.vpc.private_subnets
}

output "public_subnet_ids" {
  value = module.vpc.public_subnets
}

output "database_subnet_group_name" {
  value = module.vpc.database_subnet_group_name
}
```

### Code Example 4: VPC Definition with CloudFormation

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: Production VPC with 3-tier subnet architecture

Parameters:
  EnvironmentName:
    Type: String
    Default: prod
  VpcCIDR:
    Type: String
    Default: 10.0.0.0/16

Resources:
  # VPC
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: !Ref VpcCIDR
      EnableDnsSupport: true
      EnableDnsHostnames: true
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-vpc

  # Internet Gateway
  InternetGateway:
    Type: AWS::EC2::InternetGateway
    Properties:
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-igw

  InternetGatewayAttachment:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      InternetGatewayId: !Ref InternetGateway
      VpcId: !Ref VPC

  # Public Subnets
  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [0, !GetAZs '']
      CidrBlock: 10.0.1.0/24
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-pub-1a

  PublicSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [1, !GetAZs '']
      CidrBlock: 10.0.2.0/24
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-pub-1c

  # Private App Subnets
  PrivateAppSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [0, !GetAZs '']
      CidrBlock: 10.0.11.0/24
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-priv-app-1a

  PrivateAppSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [1, !GetAZs '']
      CidrBlock: 10.0.12.0/24
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-priv-app-1c

  # Private DB Subnets
  PrivateDBSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [0, !GetAZs '']
      CidrBlock: 10.0.21.0/24
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-priv-db-1a

  PrivateDBSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [1, !GetAZs '']
      CidrBlock: 10.0.22.0/24
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-priv-db-1c

  # NAT Gateway (AZ-1a)
  NatGateway1EIP:
    Type: AWS::EC2::EIP
    DependsOn: InternetGatewayAttachment
    Properties:
      Domain: vpc

  NatGateway1:
    Type: AWS::EC2::NatGateway
    Properties:
      AllocationId: !GetAtt NatGateway1EIP.AllocationId
      SubnetId: !Ref PublicSubnet1
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-nat-1a

  # NAT Gateway (AZ-1c)
  NatGateway2EIP:
    Type: AWS::EC2::EIP
    DependsOn: InternetGatewayAttachment
    Properties:
      Domain: vpc

  NatGateway2:
    Type: AWS::EC2::NatGateway
    Properties:
      AllocationId: !GetAtt NatGateway2EIP.AllocationId
      SubnetId: !Ref PublicSubnet2
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-nat-1c

  # Public Route Table
  PublicRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-pub-rt

  DefaultPublicRoute:
    Type: AWS::EC2::Route
    DependsOn: InternetGatewayAttachment
    Properties:
      RouteTableId: !Ref PublicRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      GatewayId: !Ref InternetGateway

  PublicSubnet1RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      RouteTableId: !Ref PublicRouteTable
      SubnetId: !Ref PublicSubnet1

  PublicSubnet2RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      RouteTableId: !Ref PublicRouteTable
      SubnetId: !Ref PublicSubnet2

  # Private Route Tables (per AZ)
  PrivateRouteTable1:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-priv-rt-1a

  DefaultPrivateRoute1:
    Type: AWS::EC2::Route
    Properties:
      RouteTableId: !Ref PrivateRouteTable1
      DestinationCidrBlock: 0.0.0.0/0
      NatGatewayId: !Ref NatGateway1

  PrivateAppSubnet1RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      RouteTableId: !Ref PrivateRouteTable1
      SubnetId: !Ref PrivateAppSubnet1

  PrivateRouteTable2:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-priv-rt-1c

  DefaultPrivateRoute2:
    Type: AWS::EC2::Route
    Properties:
      RouteTableId: !Ref PrivateRouteTable2
      DestinationCidrBlock: 0.0.0.0/0
      NatGatewayId: !Ref NatGateway2

  PrivateAppSubnet2RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      RouteTableId: !Ref PrivateRouteTable2
      SubnetId: !Ref PrivateAppSubnet2

Outputs:
  VpcId:
    Value: !Ref VPC
    Export:
      Name: !Sub ${EnvironmentName}-VpcId

  PublicSubnets:
    Value: !Join [',', [!Ref PublicSubnet1, !Ref PublicSubnet2]]
    Export:
      Name: !Sub ${EnvironmentName}-PublicSubnets

  PrivateAppSubnets:
    Value: !Join [',', [!Ref PrivateAppSubnet1, !Ref PrivateAppSubnet2]]
    Export:
      Name: !Sub ${EnvironmentName}-PrivateAppSubnets

  PrivateDBSubnets:
    Value: !Join [',', [!Ref PrivateDBSubnet1, !Ref PrivateDBSubnet2]]
    Export:
      Name: !Sub ${EnvironmentName}-PrivateDBSubnets
```

---

## 3. Route Tables and Gateways

```
How Routing Works
======================

[Public Subnet Route Table]
+--------------------+-----------+
| Destination        | Target    |
+--------------------+-----------+
| 10.0.0.0/16        | local     |  <-- Intra-VPC communication
| 0.0.0.0/0          | igw-xxx   |  <-- To the internet
+--------------------+-----------+

[Private App Subnet Route Table]
+--------------------+-----------+
| Destination        | Target    |
+--------------------+-----------+
| 10.0.0.0/16        | local     |  <-- Intra-VPC communication
| 0.0.0.0/0          | nat-xxx   |  <-- Via NAT GW
+--------------------+-----------+

[Private DB Subnet Route Table]
+--------------------+-----------+
| Destination        | Target    |
+--------------------+-----------+
| 10.0.0.0/16        | local     |  <-- Intra-VPC communication only
+--------------------+-----------+
```

### Route Table Evaluation Rules

In route tables, the most specific route (longest prefix) matching the destination IP takes priority. For example, if both `10.1.0.0/16` and `0.0.0.0/0` exist, traffic destined for `10.1.x.x` follows the `10.1.0.0/16` route. The `local` route always has the highest priority and cannot be deleted.

### Code Example 5: IGW and NAT GW Configuration

```bash
# Internet Gateway
IGW_ID=$(aws ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=prod-igw}]' \
  --query 'InternetGateway.InternetGatewayId' --output text)
aws ec2 attach-internet-gateway --internet-gateway-id $IGW_ID --vpc-id $VPC_ID

# Elastic IP + NAT Gateway (AZ-1a)
EIP_1A=$(aws ec2 allocate-address --domain vpc --query 'AllocationId' --output text)
NAT_1A=$(aws ec2 create-nat-gateway \
  --subnet-id $PUB_1A --allocation-id $EIP_1A \
  --tag-specifications 'ResourceType=natgateway,Tags=[{Key=Name,Value=nat-1a}]' \
  --query 'NatGateway.NatGatewayId' --output text)

# NAT Gateway の作成完了を待機
aws ec2 wait nat-gateway-available --nat-gateway-ids $NAT_1A

# Elastic IP + NAT Gateway (AZ-1c)
EIP_1C=$(aws ec2 allocate-address --domain vpc --query 'AllocationId' --output text)
NAT_1C=$(aws ec2 create-nat-gateway \
  --subnet-id $PUB_1C --allocation-id $EIP_1C \
  --tag-specifications 'ResourceType=natgateway,Tags=[{Key=Name,Value=nat-1c}]' \
  --query 'NatGateway.NatGatewayId' --output text)

aws ec2 wait nat-gateway-available --nat-gateway-ids $NAT_1C

# Public ルートテーブル
PUB_RT=$(aws ec2 create-route-table --vpc-id $VPC_ID \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=pub-rt}]' \
  --query 'RouteTable.RouteTableId' --output text)
aws ec2 create-route --route-table-id $PUB_RT \
  --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW_ID
aws ec2 associate-route-table --route-table-id $PUB_RT --subnet-id $PUB_1A
aws ec2 associate-route-table --route-table-id $PUB_RT --subnet-id $PUB_1C

# Private ルートテーブル AZ-1a（NAT GW 経由）
PRIV_RT_1A=$(aws ec2 create-route-table --vpc-id $VPC_ID \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=priv-rt-1a}]' \
  --query 'RouteTable.RouteTableId' --output text)
aws ec2 create-route --route-table-id $PRIV_RT_1A \
  --destination-cidr-block 0.0.0.0/0 --nat-gateway-id $NAT_1A
aws ec2 associate-route-table --route-table-id $PRIV_RT_1A --subnet-id $PRIV_APP_1A
aws ec2 associate-route-table --route-table-id $PRIV_RT_1A --subnet-id $PRIV_DB_1A

# Private ルートテーブル AZ-1c（NAT GW 経由）
PRIV_RT_1C=$(aws ec2 create-route-table --vpc-id $VPC_ID \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=priv-rt-1c}]' \
  --query 'RouteTable.RouteTableId' --output text)
aws ec2 create-route --route-table-id $PRIV_RT_1C \
  --destination-cidr-block 0.0.0.0/0 --nat-gateway-id $NAT_1C
aws ec2 associate-route-table --route-table-id $PRIV_RT_1C --subnet-id $PRIV_APP_1C
aws ec2 associate-route-table --route-table-id $PRIV_RT_1C --subnet-id $PRIV_DB_1C
```

### NAT Gateway vs NAT Instance Comparison

| Item | NAT Gateway | NAT Instance |
|---|---|---|
| **Availability** | Highly available within AZ (AWS managed) | Manual failover configuration required |
| **Bandwidth** | Up to 100 Gbps | Depends on instance type |
| **Maintenance** | AWS managed (no patching required) | User managed |
| **Cost** | ~$0.062/hr + $0.062/GB | Instance cost only |
| **Security Groups** | Cannot be associated | Can be associated |
| **Port Forwarding** | Not supported | Supported |
| **Double as Bastion Host** | Not possible | Possible |
| **Recommended For** | Production environments | Dev/test environments (cost-focused) |

### Code Example 6: Low-Cost Configuration with NAT Instance (For Dev Environments)

```bash
# NAT Instance の作成（Amazon Linux 2023 AMI）
NAT_INSTANCE=$(aws ec2 run-instances \
  --image-id ami-0abcdef1234567890 \
  --instance-type t4g.nano \
  --subnet-id $PUB_1A \
  --security-group-ids $NAT_SG \
  --key-name my-key \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=nat-instance}]' \
  --query 'Instances[0].InstanceId' --output text)

# Source/Destination Check を無効化（NAT に必須）
aws ec2 modify-instance-attribute \
  --instance-id $NAT_INSTANCE \
  --no-source-dest-check

# NAT Instance 用のセキュリティグループ
NAT_SG=$(aws ec2 create-security-group \
  --group-name nat-sg --description "NAT Instance SG" \
  --vpc-id $VPC_ID --query 'GroupId' --output text)

# プライベートサブネットからの全トラフィックを許可
aws ec2 authorize-security-group-ingress --group-id $NAT_SG \
  --protocol -1 --cidr 10.0.0.0/16

# プライベートルートテーブルのデフォルトルートを NAT Instance に設定
aws ec2 create-route --route-table-id $PRIV_RT_1A \
  --destination-cidr-block 0.0.0.0/0 \
  --instance-id $NAT_INSTANCE
```

---

## 4. Security Groups and Network ACLs

### SG vs NACL Comparison

| Characteristic | Security Group (SG) | Network ACL (NACL) |
|---|---|---|
| **Applied At** | ENI (per instance) | Per subnet |
| **State** | Stateful (return traffic automatically allowed) | Stateless (return traffic must be explicitly allowed) |
| **Rules** | Allow only | Allow + Deny |
| **Evaluation Order** | All rules evaluated | Evaluated in order by number, first match wins |
| **Default** | All outbound allowed | All traffic allowed |
| **Recommended Use** | Primary access control | Additional defense layer (subnet level) |

### Code Example 7: SG Design for 3-Tier Architecture

```bash
# ALB 用 SG
ALB_SG=$(aws ec2 create-security-group \
  --group-name alb-sg --description "ALB SG" \
  --vpc-id $VPC_ID --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $ALB_SG \
  --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $ALB_SG \
  --protocol tcp --port 80 --cidr 0.0.0.0/0

# App 用 SG（ALB からのみ受信）
APP_SG=$(aws ec2 create-security-group \
  --group-name app-sg --description "App SG" \
  --vpc-id $VPC_ID --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $APP_SG \
  --protocol tcp --port 8080 --source-group $ALB_SG

# DB 用 SG（App からのみ受信）
DB_SG=$(aws ec2 create-security-group \
  --group-name db-sg --description "DB SG" \
  --vpc-id $VPC_ID --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $DB_SG \
  --protocol tcp --port 3306 --source-group $APP_SG
aws ec2 authorize-security-group-ingress --group-id $DB_SG \
  --protocol tcp --port 6379 --source-group $APP_SG

# Bastion 用 SG（特定 IP からのみ SSH）
BASTION_SG=$(aws ec2 create-security-group \
  --group-name bastion-sg --description "Bastion SG" \
  --vpc-id $VPC_ID --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $BASTION_SG \
  --protocol tcp --port 22 --cidr 203.0.113.0/32

# App SG に Bastion からの SSH を追加
aws ec2 authorize-security-group-ingress --group-id $APP_SG \
  --protocol tcp --port 22 --source-group $BASTION_SG

# VPC Endpoint 用 SG
ENDPOINT_SG=$(aws ec2 create-security-group \
  --group-name endpoint-sg --description "VPC Endpoint SG" \
  --vpc-id $VPC_ID --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $ENDPOINT_SG \
  --protocol tcp --port 443 --cidr 10.0.0.0/16
```

### Code Example 8: Subnet-Level Defense with Network ACLs

```bash
# DB サブネット用 NACL
DB_NACL=$(aws ec2 create-network-acl --vpc-id $VPC_ID \
  --tag-specifications 'ResourceType=network-acl,Tags=[{Key=Name,Value=db-nacl}]' \
  --query 'NetworkAcl.NetworkAclId' --output text)

# インバウンド: App サブネットからの MySQL/Redis のみ許可
aws ec2 create-network-acl-entry --network-acl-id $DB_NACL \
  --rule-number 100 --protocol tcp --port-range From=3306,To=3306 \
  --cidr-block 10.0.11.0/24 --rule-action allow --ingress

aws ec2 create-network-acl-entry --network-acl-id $DB_NACL \
  --rule-number 110 --protocol tcp --port-range From=3306,To=3306 \
  --cidr-block 10.0.12.0/24 --rule-action allow --ingress

aws ec2 create-network-acl-entry --network-acl-id $DB_NACL \
  --rule-number 120 --protocol tcp --port-range From=6379,To=6379 \
  --cidr-block 10.0.11.0/24 --rule-action allow --ingress

aws ec2 create-network-acl-entry --network-acl-id $DB_NACL \
  --rule-number 130 --protocol tcp --port-range From=6379,To=6379 \
  --cidr-block 10.0.12.0/24 --rule-action allow --ingress

# アウトバウンド: エフェメラルポート（戻りトラフィック）のみ許可
aws ec2 create-network-acl-entry --network-acl-id $DB_NACL \
  --rule-number 100 --protocol tcp --port-range From=1024,To=65535 \
  --cidr-block 10.0.11.0/24 --rule-action allow --egress

aws ec2 create-network-acl-entry --network-acl-id $DB_NACL \
  --rule-number 110 --protocol tcp --port-range From=1024,To=65535 \
  --cidr-block 10.0.12.0/24 --rule-action allow --egress

# 全拒否ルール（デフォルトルールだが明示的に記載）
aws ec2 create-network-acl-entry --network-acl-id $DB_NACL \
  --rule-number 32767 --protocol -1 --cidr-block 0.0.0.0/0 \
  --rule-action deny --ingress

# NACL をサブネットに関連付け
aws ec2 replace-network-acl-association \
  --association-id aclassoc-xxxxx \
  --network-acl-id $DB_NACL
```

### Security Group Best Practices

```
1. Use SG IDs instead of CIDRs for sources
   Bad:  --cidr 10.0.11.0/24
   Good: --source-group sg-app-xxxxx
   Reason: Tracks automatically even when IPs change. Intent is clearer.

2. Separate SGs by purpose
   Bad:  All rules in a single SG
   Good: Separate SGs for ALB, App, DB, and management
   Reason: Principle of least privilege. Limits the blast radius of changes.

3. Always fill in the description field
   aws ec2 authorize-security-group-ingress --group-id $SG \
     --ip-permissions '[{
       "IpProtocol": "tcp",
       "FromPort": 443,
       "ToPort": 443,
       "IpRanges": [{"CidrIp": "0.0.0.0/0", "Description": "HTTPS from Internet"}]
     }]'

4. Conduct regular audits
   # Detect unused SGs
   aws ec2 describe-security-groups \
     --query 'SecurityGroups[?length(IpPermissions)==`0` && length(IpPermissionsEgress)==`1`].[GroupId,GroupName]' \
     --output table
```

---

## 5. VPC Endpoints

```
Types of VPC Endpoints
==========================

Gateway Endpoint (free)
  Supported: S3, DynamoDB
  Adds an entry to the route table
  App --> Route Table --> S3 (AWS internal network)

Interface Endpoint (paid: ~$0.014/hr + data transfer)
  Supported: Nearly all AWS services
  Creates an ENI in the subnet
  App --> ENI --> AWS Service (PrivateLink)

Gateway Load Balancer Endpoint
  Supported: Third-party appliances
  For network traffic inspection
  App --> GWLB Endpoint --> Firewall Appliance --> Destination
```

### Code Example 9: Creating VPC Endpoints

```bash
# Gateway エンドポイント（S3）- 無料
aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --service-name com.amazonaws.ap-northeast-1.s3 \
  --route-table-ids $PRIV_RT_1A $PRIV_RT_1C \
  --vpc-endpoint-type Gateway \
  --tag-specifications 'ResourceType=vpc-endpoint,Tags=[{Key=Name,Value=s3-endpoint}]'

# Gateway エンドポイント（DynamoDB）- 無料
aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --service-name com.amazonaws.ap-northeast-1.dynamodb \
  --route-table-ids $PRIV_RT_1A $PRIV_RT_1C \
  --vpc-endpoint-type Gateway \
  --tag-specifications 'ResourceType=vpc-endpoint,Tags=[{Key=Name,Value=dynamodb-endpoint}]'

# Interface エンドポイント（Secrets Manager）- 有料
aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --service-name com.amazonaws.ap-northeast-1.secretsmanager \
  --vpc-endpoint-type Interface \
  --subnet-ids $PRIV_APP_1A $PRIV_APP_1C \
  --security-group-ids $ENDPOINT_SG \
  --private-dns-enabled \
  --tag-specifications 'ResourceType=vpc-endpoint,Tags=[{Key=Name,Value=secretsmanager-endpoint}]'

# Interface エンドポイント（ECR - Docker Pull 用）
# ECR は 2 つのエンドポイントが必要
aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --service-name com.amazonaws.ap-northeast-1.ecr.dkr \
  --vpc-endpoint-type Interface \
  --subnet-ids $PRIV_APP_1A $PRIV_APP_1C \
  --security-group-ids $ENDPOINT_SG \
  --private-dns-enabled \
  --tag-specifications 'ResourceType=vpc-endpoint,Tags=[{Key=Name,Value=ecr-dkr-endpoint}]'

aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --service-name com.amazonaws.ap-northeast-1.ecr.api \
  --vpc-endpoint-type Interface \
  --subnet-ids $PRIV_APP_1A $PRIV_APP_1C \
  --security-group-ids $ENDPOINT_SG \
  --private-dns-enabled \
  --tag-specifications 'ResourceType=vpc-endpoint,Tags=[{Key=Name,Value=ecr-api-endpoint}]'

# Interface エンドポイント（CloudWatch Logs）
aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --service-name com.amazonaws.ap-northeast-1.logs \
  --vpc-endpoint-type Interface \
  --subnet-ids $PRIV_APP_1A $PRIV_APP_1C \
  --security-group-ids $ENDPOINT_SG \
  --private-dns-enabled \
  --tag-specifications 'ResourceType=vpc-endpoint,Tags=[{Key=Name,Value=logs-endpoint}]'

# Interface エンドポイント（STS - IAM ロール引き受け用）
aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --service-name com.amazonaws.ap-northeast-1.sts \
  --vpc-endpoint-type Interface \
  --subnet-ids $PRIV_APP_1A $PRIV_APP_1C \
  --security-group-ids $ENDPOINT_SG \
  --private-dns-enabled \
  --tag-specifications 'ResourceType=vpc-endpoint,Tags=[{Key=Name,Value=sts-endpoint}]'
```

### Required VPC Endpoints for ECS/EKS

| Service | Endpoint Type | Necessity | Purpose |
|---|---|---|---|
| S3 | Gateway (free) | Required | Fetching ECR image layers |
| ECR (dkr) | Interface | Required | Docker image pull |
| ECR (api) | Interface | Required | ECR API calls |
| CloudWatch Logs | Interface | Recommended | Log delivery |
| STS | Interface | Required for EKS | IAM Roles for Service Accounts |
| Secrets Manager | Interface | Recommended | Secret retrieval |
| SSM | Interface | Recommended | Parameter Store, Session Manager |

### S3 Gateway Endpoint Policy Configuration

```bash
# S3 エンドポイントへのポリシー設定（特定バケットのみ許可）
aws ec2 modify-vpc-endpoint \
  --vpc-endpoint-id vpce-xxxxx \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "AllowSpecificBuckets",
        "Effect": "Allow",
        "Principal": "*",
        "Action": [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ],
        "Resource": [
          "arn:aws:s3:::my-app-bucket",
          "arn:aws:s3:::my-app-bucket/*",
          "arn:aws:s3:::prod-*"
        ]
      },
      {
        "Sid": "AllowECRBucket",
        "Effect": "Allow",
        "Principal": "*",
        "Action": "s3:GetObject",
        "Resource": "arn:aws:s3:::prod-ap-northeast-1-starport-layer-bucket/*"
      }
    ]
  }'
```

---

## 6. VPC Peering and Transit Gateway

### VPC Peering

```
VPC Peering Configuration:

  VPC-A (10.0.0.0/16) <----> VPC-B (10.1.0.0/16)
       |                          |
       +---- Peering Connection --+
       |                          |
  Add to route table:        Add to route table:
  10.1.0.0/16 -> pcx-xxx    10.0.0.0/16 -> pcx-xxx

Constraints:
  - No transitive routing (A-B and B-C does not mean A-C can communicate)
  - CIDR overlap not allowed
  - Cross-region supported (Inter-Region Peering)
```

### Code Example 10: VPC Peering Setup

```bash
# VPC Peering 接続の作成
PEERING_ID=$(aws ec2 create-vpc-peering-connection \
  --vpc-id $VPC_ID --peer-vpc-id vpc-0abc123 \
  --tag-specifications 'ResourceType=vpc-peering-connection,Tags=[{Key=Name,Value=prod-to-shared}]' \
  --query 'VpcPeeringConnection.VpcPeeringConnectionId' --output text)

# 承認（相手側アカウントで実行、またはクロスアカウントの場合）
aws ec2 accept-vpc-peering-connection --vpc-peering-connection-id $PEERING_ID

# 双方のルートテーブルに Peering ルート追加
# VPC-A 側
aws ec2 create-route --route-table-id $PRIV_RT_1A \
  --destination-cidr-block 10.1.0.0/16 \
  --vpc-peering-connection-id $PEERING_ID

# VPC-B 側
aws ec2 create-route --route-table-id rtb-shared-xxx \
  --destination-cidr-block 10.0.0.0/16 \
  --vpc-peering-connection-id $PEERING_ID

# DNS 解決の有効化（Peering 先の プライベート DNS を解決）
aws ec2 modify-vpc-peering-connection-options \
  --vpc-peering-connection-id $PEERING_ID \
  --requester-peering-connection-options AllowDnsResolutionFromRemoteVpc=true \
  --accepter-peering-connection-options AllowDnsResolutionFromRemoteVpc=true
```

### Transit Gateway

```
Transit Gateway Configuration (Hub & Spoke):

                    +-------------------+
                    |  Transit Gateway  |
                    |  (Hub)            |
                    +---+-----+-----+--+
                        |     |     |
            +-----------+     |     +-----------+
            |                 |                 |
  +----+----+---+   +---+----+----+   +---+----+----+
  | VPC-Prod    |   | VPC-Staging |   | VPC-Shared  |
  | 10.0.0.0/16 |   | 10.2.0.0/16|   | 10.1.0.0/16 |
  +-------------+   +------------+   +-------------+
                                             |
                                      VPN / Direct Connect
                                             |
                                      +------+------+
                                      | On-Premises |
                                      +-------------+

Benefits:
  - Supports transitive routing (A-B and B-C enables A-C communication)
  - Traffic control via route tables
  - VPN / Direct Connect can also be attached
  - Multi-account support (shared via RAM)
```

### Code Example 11: Creating and Attaching a Transit Gateway

```bash
# Transit Gateway の作成
TGW_ID=$(aws ec2 create-transit-gateway \
  --description "Central hub for all VPCs" \
  --options '{
    "AmazonSideAsn": 64512,
    "AutoAcceptSharedAttachments": "enable",
    "DefaultRouteTableAssociation": "enable",
    "DefaultRouteTablePropagation": "enable",
    "DnsSupport": "enable",
    "VpnEcmpSupport": "enable"
  }' \
  --tag-specifications 'ResourceType=transit-gateway,Tags=[{Key=Name,Value=central-tgw}]' \
  --query 'TransitGateway.TransitGatewayId' --output text)

# VPC アタッチメントの作成
aws ec2 create-transit-gateway-vpc-attachment \
  --transit-gateway-id $TGW_ID \
  --vpc-id $VPC_ID \
  --subnet-ids $PRIV_APP_1A $PRIV_APP_1C \
  --tag-specifications 'ResourceType=transit-gateway-attachment,Tags=[{Key=Name,Value=prod-vpc-attach}]'

# VPC のルートテーブルに TGW 経由のルート追加
aws ec2 create-route --route-table-id $PRIV_RT_1A \
  --destination-cidr-block 10.1.0.0/16 \
  --transit-gateway-id $TGW_ID

aws ec2 create-route --route-table-id $PRIV_RT_1A \
  --destination-cidr-block 10.2.0.0/16 \
  --transit-gateway-id $TGW_ID

# TGW ルートテーブルの確認
aws ec2 search-transit-gateway-routes \
  --transit-gateway-route-table-id tgw-rtb-xxxxx \
  --filters "Name=type,Values=propagated"
```

### Peering vs Transit Gateway: When to Use Which

| Item | VPC Peering | Transit Gateway |
|---|---|---|
| **Connection Topology** | Point-to-point | Hub & spoke |
| **Transitive Routing** | Not supported | Supported |
| **Max Connections** | 125 per VPC | 5,000 attachments |
| **Cost** | Data transfer only | $0.07/hr + data transfer |
| **Bandwidth** | No limit | 50 Gbps per VPC attachment |
| **VPN/DX Integration** | Not supported | Supported |
| **Recommended For** | 2-3 VPCs with few connections | 4+ VPCs, VPN/DX integration |

---

## 7. VPC Flow Logs

### VPC Flow Logs Overview

VPC Flow Logs is a feature that records traffic information between network interfaces within a VPC. It is essential for security analysis, network monitoring, and troubleshooting.

```
Flow Log Recording Levels:

VPC level          -> Records traffic for all ENIs in the VPC
Subnet level       -> Records traffic for all ENIs in a specific subnet
ENI level          -> Records traffic for a specific ENI only

Destinations:
  CloudWatch Logs  -> Real-time analysis, metric filters
  S3               -> Long-term storage, query with Athena (recommended)
  Kinesis Firehose -> Real-time processing, SIEM integration
```

### Code Example 12: VPC Flow Logs Configuration

```bash
# CloudWatch Logs への Flow Log 設定
aws ec2 create-flow-logs \
  --resource-type VPC \
  --resource-ids $VPC_ID \
  --traffic-type ALL \
  --log-destination-type cloud-watch-logs \
  --log-group-name /vpc/flow-logs/prod \
  --deliver-logs-permission-arn arn:aws:iam::123456789012:role/flowlogs-role \
  --max-aggregation-interval 60 \
  --tag-specifications 'ResourceType=vpc-flow-log,Tags=[{Key=Name,Value=prod-flow-log}]'

# S3 への Flow Log 設定（推奨: 長期保存・Athena 分析向き）
aws ec2 create-flow-logs \
  --resource-type VPC \
  --resource-ids $VPC_ID \
  --traffic-type ALL \
  --log-destination-type s3 \
  --log-destination arn:aws:s3:::my-flowlogs-bucket/prod/ \
  --log-format '${version} ${account-id} ${interface-id} ${srcaddr} ${dstaddr} ${srcport} ${dstport} ${protocol} ${packets} ${bytes} ${start} ${end} ${action} ${log-status} ${vpc-id} ${subnet-id} ${az-id} ${sublocation-type} ${sublocation-id} ${pkt-srcaddr} ${pkt-dstaddr} ${region} ${pkt-src-aws-service} ${pkt-dst-aws-service} ${flow-direction} ${traffic-path}' \
  --max-aggregation-interval 60

# Flow Logs 用の IAM ロール
cat > flowlogs-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"Service": "vpc-flow-logs.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

aws iam create-role \
  --role-name flowlogs-role \
  --assume-role-policy-document file://flowlogs-trust-policy.json

aws iam put-role-policy \
  --role-name flowlogs-role \
  --policy-name flowlogs-policy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Action": [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ],
        "Effect": "Allow",
        "Resource": "*"
      }
    ]
  }'
```

### Code Example 13: Analyzing Flow Logs with Athena

```sql
-- Athena テーブルの作成（S3 に保存した Flow Logs 用）
CREATE EXTERNAL TABLE IF NOT EXISTS vpc_flow_logs (
  version int,
  account_id string,
  interface_id string,
  srcaddr string,
  dstaddr string,
  srcport int,
  dstport int,
  protocol bigint,
  packets bigint,
  bytes bigint,
  start bigint,
  `end` bigint,
  action string,
  log_status string,
  vpc_id string,
  subnet_id string,
  az_id string,
  sublocation_type string,
  sublocation_id string,
  pkt_srcaddr string,
  pkt_dstaddr string,
  region string,
  pkt_src_aws_service string,
  pkt_dst_aws_service string,
  flow_direction string,
  traffic_path int
)
PARTITIONED BY (dt string)
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ' '
LOCATION 's3://my-flowlogs-bucket/prod/AWSLogs/123456789012/vpcflowlogs/ap-northeast-1/'
TBLPROPERTIES ("skip.header.line.count"="1");

-- 拒否されたトラフィックの分析
SELECT srcaddr, dstaddr, dstport, protocol, action, SUM(packets) as total_packets
FROM vpc_flow_logs
WHERE action = 'REJECT'
  AND dt = '2026/02/15'
GROUP BY srcaddr, dstaddr, dstport, protocol, action
ORDER BY total_packets DESC
LIMIT 20;

-- 特定 IP からのトラフィック量分析
SELECT dstport, protocol, SUM(bytes) as total_bytes, COUNT(*) as flow_count
FROM vpc_flow_logs
WHERE srcaddr = '10.0.11.15'
  AND dt >= '2026/02/01'
GROUP BY dstport, protocol
ORDER BY total_bytes DESC;

-- NAT Gateway 経由のトラフィック量（コスト分析用）
SELECT pkt_dstaddr, dstport, SUM(bytes) as total_bytes
FROM vpc_flow_logs
WHERE interface_id IN (
  SELECT network_interface_id FROM nat_gw_enis
)
AND flow_direction = 'egress'
GROUP BY pkt_dstaddr, dstport
ORDER BY total_bytes DESC
LIMIT 50;
```

---

## 8. Building a VPC with AWS CDK

```typescript
// lib/vpc-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class VpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC の作成（3層サブネット）
    this.vpc = new ec2.Vpc(this, 'ProdVpc', {
      vpcName: 'prod-vpc',
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 3,
      natGateways: 3,  // AZ ごとに 1 つ

      subnetConfiguration: [
        {
          subnetType: ec2.SubnetType.PUBLIC,
          name: 'Public',
          cidrMask: 24,
        },
        {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          name: 'PrivateApp',
          cidrMask: 20,
        },
        {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          name: 'PrivateDB',
          cidrMask: 24,
        },
      ],

      // Flow Logs
      flowLogs: {
        's3': {
          destination: ec2.FlowLogDestination.toS3(),
          trafficType: ec2.FlowLogTrafficType.ALL,
        },
      },
    });

    // S3 Gateway Endpoint（無料）
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // DynamoDB Gateway Endpoint（無料）
    this.vpc.addGatewayEndpoint('DynamoDBEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    });

    // ECR Interface Endpoints
    this.vpc.addInterfaceEndpoint('EcrDockerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
    });

    this.vpc.addInterfaceEndpoint('EcrApiEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR,
    });

    // CloudWatch Logs Interface Endpoint
    this.vpc.addInterfaceEndpoint('CloudWatchLogsEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
    });

    // セキュリティグループ: ALB
    const albSg = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc: this.vpc,
      description: 'Security group for ALB',
      allowAllOutbound: true,
    });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP redirect');

    // セキュリティグループ: App
    const appSg = new ec2.SecurityGroup(this, 'AppSg', {
      vpc: this.vpc,
      description: 'Security group for App tier',
      allowAllOutbound: true,
    });
    appSg.addIngressRule(albSg, ec2.Port.tcp(8080), 'From ALB');

    // セキュリティグループ: DB
    const dbSg = new ec2.SecurityGroup(this, 'DbSg', {
      vpc: this.vpc,
      description: 'Security group for DB tier',
      allowAllOutbound: false,
    });
    dbSg.addIngressRule(appSg, ec2.Port.tcp(3306), 'MySQL from App');
    dbSg.addIngressRule(appSg, ec2.Port.tcp(6379), 'Redis from App');

    // アウトプット
    new cdk.CfnOutput(this, 'VpcId', { value: this.vpc.vpcId });
    new cdk.CfnOutput(this, 'PublicSubnets', {
      value: this.vpc.publicSubnets.map(s => s.subnetId).join(','),
    });
    new cdk.CfnOutput(this, 'PrivateSubnets', {
      value: this.vpc.privateSubnets.map(s => s.subnetId).join(','),
    });
    new cdk.CfnOutput(this, 'IsolatedSubnets', {
      value: this.vpc.isolatedSubnets.map(s => s.subnetId).join(','),
    });
  }
}
```

---

## 9. IPv6 Support

### Dual-Stack VPC Configuration

```
Dual-Stack VPC:

  IPv4 CIDR: 10.0.0.0/16 (private)
  IPv6 CIDR: 2600:1f18:xxxx::/56 (AWS-assigned public)

  Subnets:
    Public:  10.0.1.0/24 + 2600:1f18:xxxx:0100::/64
    Private: 10.0.11.0/24 + 2600:1f18:xxxx:0b00::/64

  Routing:
    Public:  ::/0 -> igw-xxx (direct IPv6 internet access)
    Private: ::/0 -> eigw-xxx (Egress-only Internet Gateway)

  Egress-only Internet Gateway:
    - Allows outbound IPv6 only (IPv6 equivalent of NAT GW)
    - Inbound is denied
    - Free
```

### Code Example 14: IPv6-Enabled VPC Configuration

```bash
# VPC に IPv6 CIDR を関連付け
aws ec2 associate-vpc-cidr-block \
  --vpc-id $VPC_ID \
  --amazon-provided-ipv6-cidr-block

# サブネットに IPv6 CIDR を割当
aws ec2 associate-subnet-cidr-block \
  --subnet-id $PUB_1A \
  --ipv6-cidr-block 2600:1f18:xxxx:0100::/64

# Egress-only Internet Gateway の作成
EIGW_ID=$(aws ec2 create-egress-only-internet-gateway \
  --vpc-id $VPC_ID \
  --query 'EgressOnlyInternetGateway.EgressOnlyInternetGatewayId' --output text)

# プライベートサブネットの IPv6 ルート（アウトバウンドのみ）
aws ec2 create-route --route-table-id $PRIV_RT_1A \
  --destination-ipv6-cidr-block ::/0 \
  --egress-only-internet-gateway-id $EIGW_ID

# パブリックサブネットの IPv6 ルート（双方向）
aws ec2 create-route --route-table-id $PUB_RT \
  --destination-ipv6-cidr-block ::/0 \
  --gateway-id $IGW_ID
```

---

## Anti-Patterns

### 1. Placing All Resources in Public Subnets

**Problem**: Placing EC2, RDS, and ElastiCache all in public subnets risks exposing internal resources to the internet if security group configurations are incorrect. This violates the principle of defense in depth.

**Solution**: Adopt a 3-tier subnet design. Place only ALB/NAT GW in public subnets, and place applications and databases in private subnets.

### 2. Undersized CIDR Design

**Problem**: Creating a VPC with a small CIDR like `/24` leads to IP exhaustion from services that consume IPs unexpectedly, such as EKS nodes, Lambda ENIs, and ElastiCache nodes. A VPC's CIDR cannot be changed after creation.

**Solution**: Create VPCs with `/16` and segment subnets as `/20` to `/24` depending on purpose. Reserve half of the CIDR space for future expansion.

### 3. Single AZ Configuration

**Problem**: Placing resources in only one AZ to save costs means the entire service goes down during an AZ outage. AWS AZ failures occur several times per year.

**Solution**: Use at least 2 AZs, ideally 3. Make NAT Gateways multi-AZ as well to prevent a single AZ failure from affecting internet access for private subnets.

### 4. Overly Permissive Security Groups

**Problem**: Allowing all ports from `0.0.0.0/0` for development convenience and carrying that configuration into production.

**Solution**: Use other SG IDs as sources in SG rules. Limit ports to the minimum required. Use AWS Config rules like `restricted-ssh` and `restricted-common-ports` for automatic detection.

### 5. Accessing AWS Services via NAT Gateway Without VPC Endpoints

**Problem**: Routing S3 and DynamoDB access through NAT Gateway incurs unnecessary NAT Gateway charges ($0.062/GB).

**Solution**: Use Gateway Endpoints (free) for S3 and DynamoDB. Consider Interface Endpoints for ECR and other AWS services to reduce NAT Gateway data processing volume.

---

## FAQ

### Q1: What can be done when NAT Gateway costs are too high?

**A**: NAT GW costs approximately $0.062/hr + data processing at $0.062/GB, resulting in about $45/month plus data transfer. Cost reduction strategies:
1. **Dev environments**: Replace with a NAT Instance (t4g.nano: approximately $3/month)
2. **VPC endpoints**: Use Gateway Endpoints (free) for S3 and DynamoDB to bypass NAT GW
3. **ECR image pull**: Reduce NAT GW traffic with VPC endpoints
4. **Single NAT GW**: In dev environments, share one NAT GW instead of one per AZ
5. **Flow Logs analysis**: Analyze traffic passing through NAT GW to identify what can be routed through endpoints

### Q2: How do you choose between Peering and Transit Gateway?

**A**:
- **VPC Peering**: For connecting 2-3 VPCs. Free (data transfer only). Point-to-point connections
- **Transit Gateway**: For connecting many VPCs/on-premises. Hub & spoke topology. Hourly charge (approximately $0.07/hr)
Use Peering for 3 or fewer VPCs, and Transit Gateway for 4 or more VPCs or when VPN connections are needed.

### Q3: Should VPC Flow Logs be enabled?

**A**: They are essential for production environments. They are needed for security incident investigation, network troubleshooting, and compliance. For cost optimization, choose S3 as the destination (cheaper than CloudWatch Logs) and use a custom format to record only the necessary fields.

### Q4: Is AWS Network Firewall necessary?

**A**: Basic requirements can be met with security groups and NACLs, but consider Network Firewall in the following cases:
- **IDS/IPS needed**: Intrusion detection and prevention with Suricata-based rules
- **Domain filtering**: Allow outbound traffic to specific domains only
- **TLS inspection**: Inspection of encrypted traffic is required
- **Compliance requirements**: Required by PCI DSS or HIPAA

### Q5: What should you do when security group limits are reached?

**A**: The defaults are 2,500 SGs per VPC, and 60 inbound rules + 60 outbound rules per SG. Countermeasures:
1. **Use prefix lists**: Consolidate multiple CIDRs into a single prefix list
2. **Clean up SGs**: Delete unused SGs and consolidate SGs with similar rules
3. **Raise limits via Service Quotas**: Request increases through AWS Support
4. **Leverage NACLs**: Move subnet-level rules to NACLs to reduce SG rule count

### Q6: What are common pitfalls with VPC DNS settings?

**A**: Pay attention to the following:
1. **enableDnsSupport**: DNS resolution within the VPC will not work unless set to true
2. **enableDnsHostnames**: EC2 instances will not receive public DNS hostnames unless set to true
3. **DHCP option sets**: Modify when specifying custom DNS servers
4. **Route 53 Resolver**: Required for DNS integration with on-premises (inbound/outbound endpoints)
5. **Private hosted zones**: Useful for service discovery within the VPC

---

## Summary

| Item | Key Points |
|---|---|
| VPC Design | /16 CIDR, 3-tier subnets (Public/Private App/Private DB), multi-AZ |
| Subnets | Public: ALB/NAT, Private App: ECS/EC2, Private DB: RDS/Cache |
| Routing | Public -> IGW, Private -> NAT GW, DB -> local only |
| Security | SG for access control (primary), NACL for additional defense (supplementary) |
| VPC Endpoints | S3/DynamoDB use Gateway (free), others use Interface |
| Inter-VPC Connectivity | Peering for few VPCs, Transit Gateway for many |
| Flow Logs | Cost-efficient analysis with S3 + Athena |
| Cost Considerations | NAT GW is the major cost factor. Reduce with VPC endpoints |
| IPv6 | Dual-stack support, Egress-only IGW for private access |

## Recommended Next Reads

- [RDS Fundamentals](../03-database/00-rds-basics.md) -- Database placement within a VPC
- [ElastiCache](../03-database/02-elasticache.md) -- Building caches in private subnets
- [DynamoDB](../03-database/01-dynamodb.md) -- Connection optimization with VPC endpoints
- [Route 53](./01-route53.md) -- VPC private hosted zones and DNS design

## References

1. **AWS Official Documentation**: [Amazon VPC User Guide](https://docs.aws.amazon.com/vpc/latest/userguide/) -- Complete VPC feature reference
2. **AWS Well-Architected Framework**: [Security Pillar](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/) -- Network security best practices
3. **AWS Blog**: [VPC Best Practices](https://aws.amazon.com/blogs/networking-and-content-delivery/) -- Practical VPC design patterns
4. **AWS re:Invent**: [NET305 - Advanced VPC design and new capabilities](https://www.youtube.com/results?search_query=aws+reinvent+advanced+vpc+design) -- Advanced VPC design
5. **AWS Documentation**: [VPC Flow Logs](https://docs.aws.amazon.com/vpc/latest/userguide/flow-logs.html) -- Traffic analysis and monitoring

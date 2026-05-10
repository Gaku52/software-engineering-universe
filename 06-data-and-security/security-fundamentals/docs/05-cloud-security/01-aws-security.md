# AWS Security

> A practical guide for securely operating AWS environments — covering threat detection with GuardDuty, unified management with Security Hub, and audit logging with CloudTrail

## Prerequisites

- Understanding of basic AWS services (EC2, S3, IAM, VPC)
- Knowledge of the shared responsibility model and IAM from [Cloud Security Basics](./00-cloud-security-basics.md)
- Basic understanding of JSON policy syntax

## What You Will Learn

1. **Threat Detection with GuardDuty** — Setting up machine learning-based anomaly detection and automated alerts
2. **Unified Management with Security Hub** — Aggregating security findings and running compliance checks
3. **Auditing with CloudTrail and Config** — Recording all API calls and tracking configuration changes
4. **Secret Management with Secrets Manager** — Securely storing credentials and enabling automatic rotation
5. **Perimeter Defense with WAF and Shield** — Protecting web applications and mitigating DDoS attacks
6. **Permission Analysis with IAM Access Analyzer** — Detecting excessive permissions and external access

---

## 1. Overview of AWS Security Services

### Service Map

```
+------------------------------------------------------------------+
|              AWS Security Services                                |
|------------------------------------------------------------------|
|                                                                  |
|  [Detection & Threat Response]                                   |
|  +-- GuardDuty: Threat detection (VPC Flow, DNS, CloudTrail, EKS)|
|  +-- Inspector: EC2/ECR/Lambda vulnerability scanning            |
|  +-- Macie: S3 sensitive data discovery (PII, credit card numbers)|
|  +-- Detective: Security investigation & analysis (graph-based)  |
|                                                                  |
|  [Unified Management]                                            |
|  +-- Security Hub: Findings aggregation & compliance             |
|  +-- Config: Resource configuration recording & evaluation       |
|  +-- Organizations: Multi-account governance                     |
|  +-- Control Tower: Automated landing zone setup                 |
|                                                                  |
|  [Audit & Logging]                                               |
|  +-- CloudTrail: API audit logs (management/data events)         |
|  +-- VPC Flow Logs: Network traffic logs                         |
|  +-- CloudWatch Logs: Application & infrastructure logs          |
|  +-- S3 Server Access Logging: Bucket access logs                |
|                                                                  |
|  [Access Control]                                                |
|  +-- IAM: User, role, and policy management                      |
|  +-- IAM Access Analyzer: Detection of external access           |
|  +-- IAM Identity Center (SSO): Centralized authentication       |
|  +-- STS: Issuing temporary credentials                          |
|                                                                  |
|  [Data Protection]                                               |
|  +-- KMS: Encryption key management (envelope encryption)        |
|  +-- Secrets Manager: Secret management & automatic rotation     |
|  +-- ACM: TLS certificate management                             |
|  +-- CloudHSM: Dedicated hardware security module                |
|                                                                  |
|  [Network Protection]                                            |
|  +-- WAF: Web Application Firewall                               |
|  +-- Shield: DDoS protection (Standard/Advanced)                 |
|  +-- Network Firewall: VPC-level firewall                        |
|  +-- Firewall Manager: Organization-wide firewall management     |
|                                                                  |
+------------------------------------------------------------------+
```

### Relationships Between AWS Security Services

```
┌──────────── AWS Security Services Integration ────────────┐
│                                                            │
│   CloudTrail ──┐                                           │
│   VPC Flow Logs─┤                                          │
│   DNS Logs ─────┤──→ GuardDuty ──┐                        │
│   EKS Audit ────┤                │                        │
│   S3 Events ────┘                ├──→ Security Hub         │
│                                  │     (Findings aggregation)│
│   Inspector ─────────────────────┤                        │
│   Macie ─────────────────────────┤                        │
│   IAM Access Analyzer ───────────┤                        │
│   Firewall Manager ──────────────┘                        │
│                                                            │
│   Security Hub ──→ EventBridge ──→ Lambda                  │
│                                    ├→ SNS (notifications)  │
│                                    ├→ Step Functions        │
│                                    └→ Auto-remediation      │
│                                                            │
│   Config Rules ──→ Non-compliance detected ──→ SSM Automation│
│                                               └→ Auto-remediation│
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Security Service Adoption Priority

| Priority | Service | Reason | Cost Impact |
|----------|---------|--------|------------|
| P0 (Required) | CloudTrail | Records all API operations. Foundation for incident investigation | Low (management events are free) |
| P0 (Required) | IAM | Principle of least privilege. Foundation of all access control | Free |
| P0 (Required) | S3 Encryption + Public Access Block | Prevents data leakage | Free to Low |
| P1 (Recommended) | GuardDuty | Continuous threat detection | Medium (depends on data volume) |
| P1 (Recommended) | Security Hub | Aggregates findings and evaluates against standards | Low |
| P1 (Recommended) | Config | Continuous monitoring of resource configurations | Medium |
| P2 (Important) | Secrets Manager | Secure management of secrets | Low (depends on number of secrets) |
| P2 (Important) | WAF | Web application protection | Medium |
| P2 (Important) | Inspector | Automated vulnerability detection | Medium |
| P3 (Recommended) | Macie | Sensitive data discovery | Medium to High |
| P3 (Recommended) | Detective | Efficient incident investigation | Medium |

---

## 2. GuardDuty

### How GuardDuty Works

GuardDuty is a continuous threat detection service for AWS environments. It combines machine learning, anomaly detection, and threat intelligence feeds to detect malicious activity and unauthorized behavior.

```
Data Sources               GuardDuty                  Response
+------------------+     +------------------+     +------------------+
| CloudTrail Logs  | --> |                  | --> | EventBridge      |
| VPC Flow Logs    | --> | ML Engine        | --> | → Lambda         |
| DNS Logs         | --> | Threat Intel     | --> | → SNS Alerts     |
| EKS Audit Logs   | --> | Anomaly Detection| --> | → Auto-remediation|
| S3 Data Events   | --> |                  | --> | → Slack alerts   |
| RDS Login Events | --> |                  | --> | → SIEM integration|
| Lambda Network   | --> |                  | --> | → Security Hub   |
| EBS Malware Scan | --> |                  |     |                  |
+------------------+     +------------------+     +------------------+
                           |
                           v
                    Finding
                    - Severity: Low (1-3.9) / Medium (4-6.9) / High (7-8.9) / Critical (9-10)
                    - Classification: 200+ finding types
                    - Categories: Recon / UnauthorizedAccess / Exfiltration, etc.
```

#### GuardDuty Finding Type Examples

| Category | Finding Type | Description |
|----------|-------------|-------------|
| Reconnaissance | Recon:EC2/PortProbeUnprotectedPort | Reconnaissance of unprotected ports on an EC2 instance |
| Unauthorized Access | UnauthorizedAccess:IAMUser/InstanceCredentialExfiltration.OutsideAWS | EC2 credentials used outside of AWS |
| Cryptocurrency | CryptoCurrency:EC2/BitcoinTool.B | Cryptocurrency mining traffic detected from EC2 |
| Data Exfiltration | Exfiltration:S3/MaliciousIPCaller | S3 access from a malicious IP address |
| Trojan | Trojan:EC2/BlackholeTraffic | EC2 communicating with a blackhole IP |
| Backdoor | Backdoor:EC2/DenialOfService.Tcp | EC2 being used to launch a DDoS attack |
| Privilege Escalation | PrivilegeEscalation:IAMUser/AdministrativePermissions | Unusual use of administrative permissions |

### Enabling and Configuring GuardDuty

```python
import boto3
import json

guardduty = boto3.client('guardduty', region_name='ap-northeast-1')

# GuardDuty の有効化
response = guardduty.create_detector(
    Enable=True,
    DataSources={
        'S3Logs': {'Enable': True},
        'Kubernetes': {'AuditLogs': {'Enable': True}},
        'MalwareProtection': {
            'ScanEc2InstanceWithFindings': {
                'EbsVolumes': True,
            }
        },
    },
    Features=[
        {'Name': 'EKS_RUNTIME_MONITORING', 'Status': 'ENABLED'},
        {'Name': 'LAMBDA_NETWORK_LOGS', 'Status': 'ENABLED'},
        {'Name': 'RDS_LOGIN_EVENTS', 'Status': 'ENABLED'},
        {'Name': 'EBS_MALWARE_PROTECTION', 'Status': 'ENABLED'},
    ],
    FindingPublishingFrequency='FIFTEEN_MINUTES',
)

detector_id = response['DetectorId']
print(f"GuardDuty enabled with detector ID: {detector_id}")
```

```hcl
# Terraform による GuardDuty の設定
resource "aws_guardduty_detector" "main" {
  enable                       = true
  finding_publishing_frequency = "FIFTEEN_MINUTES"

  datasources {
    s3_logs {
      enable = true
    }
    kubernetes {
      audit_logs {
        enable = true
      }
    }
    malware_protection {
      scan_ec2_instance_with_findings {
        ebs_volumes {
          enable = true
        }
      }
    }
  }

  tags = {
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

# GuardDuty メンバーアカウントの招待（Organizations 経由）
resource "aws_guardduty_organization_configuration" "main" {
  detector_id                      = aws_guardduty_detector.main.id
  auto_enable_organization_members = "ALL"

  datasources {
    s3_logs {
      auto_enable = true
    }
    kubernetes {
      audit_logs {
        enable = true
      }
    }
  }
}

# Trusted IP リスト（オフィス IP を除外）
resource "aws_guardduty_ipset" "trusted" {
  detector_id = aws_guardduty_detector.main.id
  name        = "trusted-ips"
  format      = "TXT"
  location    = "s3://${aws_s3_bucket.security.id}/guardduty/trusted-ips.txt"
  activate    = true
}

# 脅威 IP リスト（カスタム脅威インテリジェンス）
resource "aws_guardduty_threatintelset" "custom" {
  detector_id = aws_guardduty_detector.main.id
  name        = "custom-threat-intel"
  format      = "TXT"
  location    = "s3://${aws_s3_bucket.security.id}/guardduty/threat-ips.txt"
  activate    = true
}
```

### Automated Notifications for GuardDuty Findings

```python
# EventBridge → Lambda → Slack 通知
import json
import os
import urllib.request
from datetime import datetime

def lambda_handler(event, context):
    """GuardDuty の検知結果を Slack に通知"""
    detail = event['detail']
    severity = detail['severity']
    finding_type = detail['type']
    description = detail['description']
    account_id = detail['accountId']
    region = detail['region']
    finding_id = detail['id']
    created_at = detail.get('createdAt', '')
    updated_at = detail.get('updatedAt', '')

    # 重大度に応じた色分け
    if severity >= 7:
        color = '#ff0000'  # 赤: High/Critical
        emoji = ':rotating_light:'
        urgency = 'CRITICAL'
    elif severity >= 4:
        color = '#ff9900'  # オレンジ: Medium
        emoji = ':warning:'
        urgency = 'MEDIUM'
    else:
        color = '#ffcc00'  # 黄: Low
        emoji = ':information_source:'
        urgency = 'LOW'

    # 影響を受けたリソースの情報を抽出
    resource = detail.get('resource', {})
    resource_type = resource.get('resourceType', 'Unknown')
    resource_details = _extract_resource_details(resource)

    # GuardDuty コンソールへのリンク
    console_url = (
        f"https://{region}.console.aws.amazon.com/guardduty/home?"
        f"region={region}#/findings?fId={finding_id}"
    )

    slack_message = {
        'attachments': [{
            'color': color,
            'title': f'{emoji} GuardDuty Alert [{urgency}]: {finding_type}',
            'title_link': console_url,
            'fields': [
                {'title': 'Account', 'value': account_id, 'short': True},
                {'title': 'Region', 'value': region, 'short': True},
                {'title': 'Severity', 'value': f'{severity:.1f}', 'short': True},
                {'title': 'Resource Type', 'value': resource_type, 'short': True},
                {'title': 'Resource Details', 'value': resource_details},
                {'title': 'Description', 'value': description[:500]},
                {'title': 'First Seen', 'value': created_at, 'short': True},
                {'title': 'Last Seen', 'value': updated_at, 'short': True},
            ],
            'footer': 'AWS GuardDuty',
            'ts': int(datetime.now().timestamp()),
        }]
    }

    webhook_url = os.environ['SLACK_WEBHOOK_URL']
    req = urllib.request.Request(
        webhook_url,
        data=json.dumps(slack_message).encode(),
        headers={'Content-Type': 'application/json'},
    )
    urllib.request.urlopen(req)

    return {'statusCode': 200, 'body': 'Notification sent'}


def _extract_resource_details(resource):
    """リソースの詳細情報を抽出"""
    resource_type = resource.get('resourceType', '')

    if resource_type == 'Instance':
        instance = resource.get('instanceDetails', {})
        return (
            f"Instance ID: {instance.get('instanceId', 'N/A')}\n"
            f"Instance Type: {instance.get('instanceType', 'N/A')}\n"
            f"Private IP: {instance.get('networkInterfaces', [{}])[0].get('privateIpAddress', 'N/A')}"
        )
    elif resource_type == 'AccessKey':
        access_key = resource.get('accessKeyDetails', {})
        return (
            f"User: {access_key.get('userName', 'N/A')}\n"
            f"User Type: {access_key.get('userType', 'N/A')}\n"
            f"Principal ID: {access_key.get('principalId', 'N/A')}"
        )
    elif resource_type == 'S3Bucket':
        s3 = resource.get('s3BucketDetails', [{}])[0]
        return f"Bucket: {s3.get('name', 'N/A')}"
    else:
        return json.dumps(resource, indent=2, default=str)[:300]
```

### Automated Remediation for GuardDuty Findings

```python
# GuardDuty High Severity → 自動修復 Lambda
import boto3
import json

ec2 = boto3.client('ec2')
iam = boto3.client('iam')


def lambda_handler(event, context):
    """GuardDuty の High/Critical 検知結果に対する自動修復"""
    detail = event['detail']
    finding_type = detail['type']
    severity = detail['severity']

    if severity < 7:
        print(f"Severity {severity} is below threshold, skipping auto-remediation")
        return

    # 検知タイプに応じた修復アクション
    if 'UnauthorizedAccess:EC2' in finding_type:
        _isolate_ec2_instance(detail)
    elif 'CryptoCurrency:EC2' in finding_type:
        _isolate_ec2_instance(detail)
    elif 'UnauthorizedAccess:IAMUser/InstanceCredentialExfiltration' in finding_type:
        _revoke_iam_sessions(detail)
    elif 'Exfiltration:S3' in finding_type:
        _restrict_s3_bucket(detail)

    return {'statusCode': 200, 'body': 'Remediation completed'}


def _isolate_ec2_instance(detail):
    """EC2 インスタンスをネットワーク隔離"""
    instance_id = detail['resource']['instanceDetails']['instanceId']
    vpc_id = detail['resource']['instanceDetails']['networkInterfaces'][0]['vpcId']

    # 隔離用 Security Group を作成（インバウンド・アウトバウンド全拒否）
    isolation_sg = ec2.create_security_group(
        GroupName=f'isolation-{instance_id}',
        Description=f'Isolation SG for compromised instance {instance_id}',
        VpcId=vpc_id,
    )

    # デフォルトのアウトバウンドルールを削除
    ec2.revoke_security_group_egress(
        GroupId=isolation_sg['GroupId'],
        IpPermissions=[{
            'IpProtocol': '-1',
            'IpRanges': [{'CidrIp': '0.0.0.0/0'}],
        }]
    )

    # インスタンスの SG を隔離用に変更
    ec2.modify_instance_attribute(
        InstanceId=instance_id,
        Groups=[isolation_sg['GroupId']],
    )

    print(f"Instance {instance_id} isolated with SG {isolation_sg['GroupId']}")


def _revoke_iam_sessions(detail):
    """IAM ユーザの全セッションを無効化"""
    access_key = detail['resource']['accessKeyDetails']
    user_name = access_key.get('userName', '')

    if not user_name or user_name == 'N/A':
        print("Cannot determine IAM user, skipping session revocation")
        return

    # インラインポリシーで全操作を拒否
    deny_policy = {
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Deny",
            "Action": "*",
            "Resource": "*",
            "Condition": {
                "DateLessThan": {
                    "aws:TokenIssueTime": detail['updatedAt']
                }
            }
        }]
    }

    iam.put_user_policy(
        UserName=user_name,
        PolicyName='GuardDuty-DenySessions',
        PolicyDocument=json.dumps(deny_policy),
    )

    print(f"Revoked sessions for user {user_name}")


def _restrict_s3_bucket(detail):
    """S3 バケットのパブリックアクセスをブロック"""
    s3 = boto3.client('s3')
    bucket_name = detail['resource']['s3BucketDetails'][0]['name']

    s3.put_public_access_block(
        Bucket=bucket_name,
        PublicAccessBlockConfiguration={
            'BlockPublicAcls': True,
            'IgnorePublicAcls': True,
            'BlockPublicPolicy': True,
            'RestrictPublicBuckets': True,
        }
    )

    print(f"Public access blocked for bucket {bucket_name}")
```

### GuardDuty Filtering and Suppression

```hcl
# GuardDuty フィルタ（特定の検知結果をフィルタリング）
resource "aws_guardduty_filter" "high_severity" {
  detector_id = aws_guardduty_detector.main.id
  name        = "high-severity-findings"
  action      = "NOOP"
  rank        = 1

  finding_criteria {
    criterion {
      field  = "severity"
      gte    = "7"
    }
    criterion {
      field   = "type"
      not_equals = ["Recon:EC2/Portscan"]  # ポートスキャンは除外
    }
  }
}

# サプレッションルール（誤検知のアーカイブ）
resource "aws_guardduty_filter" "suppress_internal_portscans" {
  detector_id = aws_guardduty_detector.main.id
  name        = "suppress-internal-portscans"
  action      = "ARCHIVE"
  rank        = 2

  finding_criteria {
    criterion {
      field  = "type"
      equals = ["Recon:EC2/Portscan"]
    }
    criterion {
      field  = "resource.instanceDetails.networkInterfaces.privateIpAddress"
      equals = ["10.0.0.0/8"]  # 内部ネットワークからのポートスキャン
    }
  }
}
```

---

## 3. Security Hub

### Security Hub Architecture

Security Hub is a service that centrally manages findings from AWS security services. It automatically runs compliance checks against multiple security standards and visualizes results as a scorecard.

```
+------------------------------------------------------------------+
|                    Security Hub                                    |
|------------------------------------------------------------------|
|                                                                  |
|  [Data Sources (Findings)]                                       |
|  +-- GuardDuty findings                                          |
|  +-- Inspector vulnerabilities                                   |
|  +-- Macie sensitive data discoveries                            |
|  +-- IAM Access Analyzer                                        |
|  +-- Firewall Manager                                           |
|  +-- Config Rules non-compliance                                 |
|  +-- Third-party (Prowler, Checkov, Snyk)                        |
|                                                                  |
|  [Security Standards]                                            |
|  +-- AWS Foundational Security Best Practices (FSBP)            |
|  +-- CIS AWS Foundations Benchmark v1.4.0 / v3.0.0             |
|  +-- PCI DSS v3.2.1                                            |
|  +-- NIST SP 800-53 Rev. 5                                      |
|                                                                  |
|  [Output]                                                        |
|  +-- Dashboard (scorecard)                                       |
|  +-- EventBridge integration (auto-remediation)                  |
|  +-- Custom actions                                              |
|  +-- AWS Security Lake integration                               |
+------------------------------------------------------------------+
```

### Enabling Security Hub (Terraform)

```hcl
# Security Hub の有効化
resource "aws_securityhub_account" "main" {}

# AWS Foundational Security Best Practices
resource "aws_securityhub_standards_subscription" "aws_foundational" {
  standards_arn = "arn:aws:securityhub:ap-northeast-1::standards/aws-foundational-security-best-practices/v/1.0.0"
  depends_on    = [aws_securityhub_account.main]
}

# CIS AWS Foundations Benchmark v1.4.0
resource "aws_securityhub_standards_subscription" "cis_1_4" {
  standards_arn = "arn:aws:securityhub:::ruleset/cis-aws-foundations-benchmark/v/1.4.0"
  depends_on    = [aws_securityhub_account.main]
}

# CIS AWS Foundations Benchmark v3.0.0
resource "aws_securityhub_standards_subscription" "cis_3_0" {
  standards_arn = "arn:aws:securityhub:ap-northeast-1::standards/cis-aws-foundations-benchmark/v/3.0.0"
  depends_on    = [aws_securityhub_account.main]
}

# NIST SP 800-53 Rev. 5
resource "aws_securityhub_standards_subscription" "nist" {
  standards_arn = "arn:aws:securityhub:ap-northeast-1::standards/nist-800-53/v/5.0.0"
  depends_on    = [aws_securityhub_account.main]
}

# 特定のコントロールを無効化（正当な理由がある場合）
resource "aws_securityhub_standards_control" "disable_s3_logging" {
  standards_control_arn = "arn:aws:securityhub:ap-northeast-1:123456789012:control/aws-foundational-security-best-practices/v/1.0.0/S3.9"
  control_status        = "DISABLED"
  disabled_reason       = "S3 server access logging is replaced by CloudTrail S3 data events"
}

# 自動修復用 EventBridge ルール
resource "aws_cloudwatch_event_rule" "securityhub_high" {
  name = "securityhub-high-severity"
  event_pattern = jsonencode({
    source      = ["aws.securityhub"]
    detail-type = ["Security Hub Findings - Imported"]
    detail = {
      findings = {
        Severity = {
          Label = ["CRITICAL", "HIGH"]
        }
        Workflow = {
          Status = ["NEW"]
        }
        RecordState = ["ACTIVE"]
      }
    }
  })
}

resource "aws_cloudwatch_event_target" "securityhub_lambda" {
  rule      = aws_cloudwatch_event_rule.securityhub_high.name
  target_id = "securityhub-auto-remediate"
  arn       = aws_lambda_function.auto_remediate.arn
}

# Organizations 統合
resource "aws_securityhub_organization_configuration" "main" {
  auto_enable           = true
  auto_enable_standards = "DEFAULT"
}
```

### Security Hub Custom Actions

```python
# Security Hub のカスタムアクション（手動トリガーの修復）
import boto3

securityhub = boto3.client('securityhub')

# カスタムアクションの作成
securityhub.create_action_target(
    Name='IsolateInstance',
    Description='Isolate a compromised EC2 instance',
    Id='IsolateInstance',
)

# Finding の更新（ワークフローステータスの変更）
securityhub.batch_update_findings(
    FindingIdentifiers=[
        {
            'Id': 'arn:aws:securityhub:ap-northeast-1:123456:finding/xxx',
            'ProductArn': 'arn:aws:securityhub:ap-northeast-1::product/aws/guardduty',
        }
    ],
    Workflow={'Status': 'RESOLVED'},
    Note={
        'Text': 'Investigated and resolved. Instance was isolated and reimaged.',
        'UpdatedBy': 'security-team',
    },
)
```

### Strategy for Improving Security Hub Score

```
┌──────────── Security Hub Score Improvement Strategy ──────────┐
│                                                                │
│  Phase 1: Eliminate CRITICAL (Target: 0 findings)             │
│  ├── S3 public access                                          │
│  ├── RDS public access                                         │
│  ├── MFA for root account                                      │
│  └── Wildcard IAM policies                                     │
│                                                                │
│  Phase 2: Eliminate HIGH (Target: Score 90%+)                  │
│  ├── Enable encryption (S3, RDS, EBS)                          │
│  ├── Enable logging (CloudTrail, VPC Flow Logs)                │
│  ├── Configure backups                                         │
│  └── Review security groups                                    │
│                                                                │
│  Phase 3: Address MEDIUM (Target: Score 95%+)                  │
│  ├── Apply tagging policies                                    │
│  ├── Configure VPC endpoints                                   │
│  ├── Remove unnecessary resources                              │
│  └── Set log retention periods                                 │
│                                                                │
│  Phase 4: Continuous Improvement                               │
│  ├── Auto-check new resources (Config Rules)                   │
│  ├── Weekly score reviews                                      │
│  ├── Operate exception management process                      │
│  └── Expand auto-remediation coverage                          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. CloudTrail

### CloudTrail Configuration

```hcl
# CloudTrail (全リージョン、全イベント)
resource "aws_cloudtrail" "main" {
  name                          = "organization-trail"
  s3_bucket_name                = aws_s3_bucket.cloudtrail.id
  is_organization_trail         = true
  is_multi_region_trail         = true
  enable_log_file_validation    = true  # ログの改竄検知
  include_global_service_events = true
  kms_key_id                    = aws_kms_key.cloudtrail.arn

  # 管理イベント
  event_selector {
    read_write_type           = "All"
    include_management_events = true
  }

  # S3 データイベント (機密バケット)
  event_selector {
    read_write_type           = "WriteOnly"
    include_management_events = false

    data_resource {
      type   = "AWS::S3::Object"
      values = ["arn:aws:s3:::sensitive-bucket/"]
    }
  }

  # Lambda データイベント
  event_selector {
    read_write_type           = "All"
    include_management_events = false

    data_resource {
      type   = "AWS::Lambda::Function"
      values = ["arn:aws:lambda"]
    }
  }

  # CloudWatch Logs に転送
  cloud_watch_logs_group_arn = "${aws_cloudwatch_log_group.cloudtrail.arn}:*"
  cloud_watch_logs_role_arn  = aws_iam_role.cloudtrail_cloudwatch.arn

  # Insights イベント (異常検知)
  insight_selector {
    insight_type = "ApiCallRateInsight"
  }
  insight_selector {
    insight_type = "ApiErrorRateInsight"
  }

  tags = {
    Environment = "production"
    Security    = "critical"
  }
}

# CloudTrail ログ用 S3 バケット
resource "aws_s3_bucket" "cloudtrail" {
  bucket        = "org-cloudtrail-logs-${data.aws_caller_identity.current.account_id}"
  force_destroy = false
}

resource "aws_s3_bucket_versioning" "cloudtrail" {
  bucket = aws_s3_bucket.cloudtrail.id
  versioning_configuration {
    status    = "Enabled"
    mfa_delete = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "cloudtrail" {
  bucket = aws_s3_bucket.cloudtrail.id

  rule {
    id     = "archive-and-expire"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }

    expiration {
      days = 2555  # 7年保持（規制要件に応じて調整）
    }
  }
}

# CloudWatch メトリクスフィルターとアラーム
resource "aws_cloudwatch_log_metric_filter" "unauthorized_api_calls" {
  name           = "UnauthorizedAPICalls"
  pattern        = "{ ($.errorCode = \"*UnauthorizedAccess*\") || ($.errorCode = \"AccessDenied*\") }"
  log_group_name = aws_cloudwatch_log_group.cloudtrail.name

  metric_transformation {
    name          = "UnauthorizedAPICalls"
    namespace     = "CloudTrailMetrics"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "unauthorized_api_calls" {
  alarm_name          = "UnauthorizedAPICalls"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "UnauthorizedAPICalls"
  namespace           = "CloudTrailMetrics"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Multiple unauthorized API calls detected"
  alarm_actions       = [aws_sns_topic.security_alerts.arn]
}
```

### Analyzing CloudTrail Logs

```python
import boto3
from datetime import datetime, timedelta

# CloudTrail Insights / Athena での分析
athena = boto3.client('athena')

# Athena テーブルの作成 (初回のみ)
create_table_query = """
CREATE EXTERNAL TABLE IF NOT EXISTS cloudtrail_logs (
    eventVersion STRING,
    userIdentity STRUCT<
        type: STRING,
        principalId: STRING,
        arn: STRING,
        accountId: STRING,
        invokedBy: STRING,
        accessKeyId: STRING,
        userName: STRING,
        sessionContext: STRUCT<
            attributes: STRUCT<
                mfaAuthenticated: STRING,
                creationDate: STRING>,
            sessionIssuer: STRUCT<
                type: STRING,
                principalId: STRING,
                arn: STRING,
                accountId: STRING,
                userName: STRING>>>,
    eventTime STRING,
    eventSource STRING,
    eventName STRING,
    awsRegion STRING,
    sourceIPAddress STRING,
    userAgent STRING,
    errorCode STRING,
    errorMessage STRING,
    requestParameters STRING,
    responseElements STRING,
    additionalEventData STRING,
    requestId STRING,
    eventId STRING,
    resources ARRAY<STRUCT<
        arn: STRING,
        accountId: STRING,
        type: STRING>>,
    eventType STRING,
    recipientAccountId STRING
)
PARTITIONED BY (region STRING, year STRING, month STRING, day STRING)
ROW FORMAT SERDE 'org.apache.hive.hcatalog.data.JsonSerDe'
LOCATION 's3://org-cloudtrail-logs-123456789012/AWSLogs/123456789012/CloudTrail/'
"""

# 疑わしい API 呼び出しの検索
suspicious_activity_query = """
SELECT
    eventTime,
    eventName,
    userIdentity.arn as userArn,
    userIdentity.type as identityType,
    sourceIPAddress,
    errorCode,
    awsRegion,
    requestParameters
FROM cloudtrail_logs
WHERE year = '2024' AND month = '01'
  AND (
    -- セキュリティサービスの無効化
    eventName IN ('DeleteTrail', 'StopLogging', 'DeleteFlowLogs',
                  'DeleteDetector', 'DisableSecurityHub')
    -- 疑わしい IAM 操作
    OR eventName IN ('CreateUser', 'CreateAccessKey', 'AttachUserPolicy',
                     'PutUserPolicy', 'CreateLoginProfile')
    -- ログイン失敗
    OR (eventName = 'ConsoleLogin' AND errorCode = 'Failed')
    -- データ流出の兆候
    OR eventName IN ('GetObject', 'CopyObject') AND sourceIPAddress NOT LIKE '10.%'
  )
ORDER BY eventTime DESC
LIMIT 100;
"""

# 特定ユーザの全活動を追跡
user_activity_query = """
SELECT
    eventTime,
    eventName,
    eventSource,
    sourceIPAddress,
    userAgent,
    errorCode
FROM cloudtrail_logs
WHERE year = '2024' AND month = '01'
  AND userIdentity.arn LIKE '%suspicious-user%'
ORDER BY eventTime ASC
LIMIT 1000;
"""

# 未使用のアクセスキーの特定
unused_access_keys_query = """
SELECT
    userIdentity.accessKeyId as accessKeyId,
    userIdentity.userName as userName,
    MAX(eventTime) as lastUsed,
    COUNT(*) as apiCallCount
FROM cloudtrail_logs
WHERE year = '2024'
  AND userIdentity.type = 'IAMUser'
  AND userIdentity.accessKeyId IS NOT NULL
GROUP BY userIdentity.accessKeyId, userIdentity.userName
HAVING MAX(eventTime) < date_format(date_add('day', -90, now()), '%Y-%m-%dT%H:%i:%sZ')
ORDER BY lastUsed ASC;
"""
```

### AWS Config Rules

```hcl
# AWS Config の有効化
resource "aws_config_configuration_recorder" "main" {
  name     = "default"
  role_arn = aws_iam_role.config.arn

  recording_group {
    all_supported                 = true
    include_global_resource_types = true
  }
}

resource "aws_config_delivery_channel" "main" {
  name           = "default"
  s3_bucket_name = aws_s3_bucket.config.id
  sns_topic_arn  = aws_sns_topic.config.arn

  snapshot_delivery_properties {
    delivery_frequency = "TwentyFour_Hours"
  }
}

# マネージドルール: S3 パブリックアクセス禁止
resource "aws_config_config_rule" "s3_public_read" {
  name = "s3-bucket-public-read-prohibited"
  source {
    owner             = "AWS"
    source_identifier = "S3_BUCKET_PUBLIC_READ_PROHIBITED"
  }
  depends_on = [aws_config_configuration_recorder.main]
}

# マネージドルール: RDS 暗号化
resource "aws_config_config_rule" "rds_encrypted" {
  name = "rds-storage-encrypted"
  source {
    owner             = "AWS"
    source_identifier = "RDS_STORAGE_ENCRYPTED"
  }
}

# マネージドルール: CloudTrail 有効化
resource "aws_config_config_rule" "cloudtrail_enabled" {
  name = "cloudtrail-enabled"
  source {
    owner             = "AWS"
    source_identifier = "CLOUD_TRAIL_ENABLED"
  }
}

# マネージドルール: MFA 有効化
resource "aws_config_config_rule" "iam_root_mfa" {
  name = "root-account-mfa-enabled"
  source {
    owner             = "AWS"
    source_identifier = "ROOT_ACCOUNT_MFA_ENABLED"
  }
}

# カスタムルール: EC2 に必須タグがあるか
resource "aws_config_config_rule" "required_tags" {
  name = "required-tags"
  source {
    owner             = "AWS"
    source_identifier = "REQUIRED_TAGS"
  }
  input_parameters = jsonencode({
    tag1Key   = "Environment"
    tag2Key   = "Team"
    tag3Key   = "CostCenter"
  })
  scope {
    compliance_resource_types = [
      "AWS::EC2::Instance",
      "AWS::RDS::DBInstance",
      "AWS::S3::Bucket",
    ]
  }
}

# SSM Automation による自動修復
resource "aws_config_remediation_configuration" "s3_public_access" {
  config_rule_name = aws_config_config_rule.s3_public_read.name
  target_type      = "SSM_DOCUMENT"
  target_id        = "AWS-DisableS3BucketPublicReadWrite"

  parameter {
    name           = "S3BucketName"
    resource_value = "RESOURCE_ID"
  }

  parameter {
    name         = "AutomationAssumeRole"
    static_value = aws_iam_role.config_remediation.arn
  }

  automatic                  = true
  maximum_automatic_attempts = 3
  retry_attempt_seconds      = 60
}
```

---

## 5. Secrets Manager

### Secret Management and Automatic Rotation

```python
import boto3
import json

sm = boto3.client('secretsmanager')

# シークレットの作成
sm.create_secret(
    Name='myapp/database/credentials',
    Description='Production database credentials for myapp',
    SecretString=json.dumps({
        'username': 'app_user',
        'password': 'initial-password',
        'engine': 'postgres',
        'host': 'mydb.xxx.ap-northeast-1.rds.amazonaws.com',
        'port': 5432,
        'dbname': 'myapp',
    }),
    KmsKeyId='alias/myapp-secrets-key',
    Tags=[
        {'Key': 'Environment', 'Value': 'production'},
        {'Key': 'Application', 'Value': 'myapp'},
    ],
)

# シークレットの取得（キャッシュ推奨）
from aws_secretsmanager_caching import SecretCache, SecretCacheConfig

cache_config = SecretCacheConfig(
    max_cache_size=100,
    exception_retry_delay_base=1,
    exception_retry_growth_factor=2,
    exception_retry_delay_max=3600,
    default_secret_version_stage='AWSCURRENT',
    secret_refresh_interval=3600,  # 1時間キャッシュ
    secret_version_stage_refresh_interval=3600,
)

cache = SecretCache(config=cache_config)

def get_db_credentials():
    """キャッシュ経由でDB認証情報を取得"""
    secret_string = cache.get_secret_string('myapp/database/credentials')
    return json.loads(secret_string)


# 自動ローテーションの設定
sm.rotate_secret(
    SecretId='myapp/database/credentials',
    RotationLambdaARN='arn:aws:lambda:ap-northeast-1:123456:function:rotate-db-secret',
    RotationRules={
        'AutomaticallyAfterDays': 30,
        'Duration': '2h',
        'ScheduleExpression': 'rate(30 days)',
    },
)
```

### Rotation Lambda

```python
# Lambda: RDS シークレットのローテーション
import boto3
import json
import logging
import os
import psycopg2

logger = logging.getLogger()
logger.setLevel(logging.INFO)

sm = boto3.client('secretsmanager')


def lambda_handler(event, context):
    """Secrets Manager のローテーションハンドラ"""
    secret_arn = event['SecretId']
    token = event['ClientRequestToken']
    step = event['Step']

    if step == 'createSecret':
        create_secret(secret_arn, token)
    elif step == 'setSecret':
        set_secret(secret_arn, token)
    elif step == 'testSecret':
        test_secret(secret_arn, token)
    elif step == 'finishSecret':
        finish_secret(secret_arn, token)


def create_secret(secret_arn, token):
    """新しいパスワードを生成"""
    current = sm.get_secret_value(SecretId=secret_arn, VersionStage='AWSCURRENT')
    current_dict = json.loads(current['SecretString'])

    # 新しいパスワードを生成
    new_password = sm.get_random_password(
        PasswordLength=32,
        ExcludeCharacters='/@"\'\\',
        RequireEachIncludedType=True,
    )['RandomPassword']

    current_dict['password'] = new_password
    sm.put_secret_value(
        SecretId=secret_arn,
        ClientRequestToken=token,
        SecretString=json.dumps(current_dict),
        VersionStages=['AWSPENDING'],
    )


def set_secret(secret_arn, token):
    """データベースのパスワードを変更"""
    pending = sm.get_secret_value(SecretId=secret_arn, VersionStage='AWSPENDING')
    pending_dict = json.loads(pending['SecretString'])

    current = sm.get_secret_value(SecretId=secret_arn, VersionStage='AWSCURRENT')
    current_dict = json.loads(current['SecretString'])

    conn = psycopg2.connect(
        host=current_dict['host'],
        port=current_dict['port'],
        dbname=current_dict['dbname'],
        user=current_dict['username'],
        password=current_dict['password'],
    )
    conn.autocommit = True
    cursor = conn.cursor()
    cursor.execute(
        f"ALTER USER {current_dict['username']} WITH PASSWORD %s",
        (pending_dict['password'],)
    )
    conn.close()


def test_secret(secret_arn, token):
    """新しい認証情報でDB接続をテスト"""
    pending = sm.get_secret_value(SecretId=secret_arn, VersionStage='AWSPENDING')
    pending_dict = json.loads(pending['SecretString'])

    conn = psycopg2.connect(
        host=pending_dict['host'],
        port=pending_dict['port'],
        dbname=pending_dict['dbname'],
        user=pending_dict['username'],
        password=pending_dict['password'],
    )
    conn.close()
    logger.info("Successfully tested new credentials")


def finish_secret(secret_arn, token):
    """バージョンラベルを切り替え"""
    metadata = sm.describe_secret(SecretId=secret_arn)
    current_version = None

    for version_id, stages in metadata['VersionIdsToStages'].items():
        if 'AWSCURRENT' in stages:
            current_version = version_id
            break

    sm.update_secret_version_stage(
        SecretId=secret_arn,
        VersionStage='AWSCURRENT',
        MoveToVersionId=token,
        RemoveFromVersionId=current_version,
    )
```

---

## 6. WAF and Shield

### AWS WAF Configuration

```hcl
# WAF Web ACL
resource "aws_wafv2_web_acl" "main" {
  name        = "main-web-acl"
  description = "Main WAF Web ACL for production"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # AWS マネージドルール: 一般的な攻撃パターン
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1
    override_action { none {} }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSet"
      sampled_requests_enabled   = true
    }
  }

  # AWS マネージドルール: SQLi 対策
  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 2
    override_action { none {} }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesSQLiRuleSet"
      sampled_requests_enabled   = true
    }
  }

  # レートベースルール: DDoS 対策
  rule {
    name     = "RateLimit"
    priority = 3

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimit"
      sampled_requests_enabled   = true
    }
  }

  # 地理的制限
  rule {
    name     = "GeoRestriction"
    priority = 4

    action {
      block {}
    }

    statement {
      not_statement {
        statement {
          geo_match_statement {
            country_codes = ["JP", "US"]
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "GeoRestriction"
      sampled_requests_enabled   = true
    }
  }

  # IP ブラックリスト
  rule {
    name     = "IPBlacklist"
    priority = 0

    action {
      block {}
    }

    statement {
      ip_set_reference_statement {
        arn = aws_wafv2_ip_set.blacklist.arn
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "IPBlacklist"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "MainWebACL"
    sampled_requests_enabled   = true
  }
}

# ALB との関連付け
resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = aws_lb.main.arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}

# WAF ログの有効化
resource "aws_wafv2_web_acl_logging_configuration" "main" {
  log_destination_configs = [aws_kinesis_firehose_delivery_stream.waf_logs.arn]
  resource_arn            = aws_wafv2_web_acl.main.arn

  logging_filter {
    default_behavior = "DROP"

    filter {
      behavior    = "KEEP"
      condition {
        action_condition {
          action = "BLOCK"
        }
      }
      requirement = "MEETS_ANY"
    }
  }
}
```

---

## 7. IAM Access Analyzer

```hcl
# IAM Access Analyzer の有効化
resource "aws_accessanalyzer_analyzer" "main" {
  analyzer_name = "account-analyzer"
  type          = "ACCOUNT"

  tags = {
    Environment = "production"
  }
}

# Organizations レベルのアナライザー
resource "aws_accessanalyzer_analyzer" "org" {
  analyzer_name = "organization-analyzer"
  type          = "ORGANIZATION"
}
```

```python
# IAM Access Analyzer の Finding を取得・分析
import boto3

analyzer = boto3.client('accessanalyzer')

# 外部アクセスの Finding を取得
findings = analyzer.list_findings(
    analyzerArn='arn:aws:access-analyzer:ap-northeast-1:123456:analyzer/account-analyzer',
    filter={
        'status': {'eq': ['ACTIVE']},
        'resourceType': {'eq': ['AWS::S3::Bucket']},
    },
)

for finding in findings['findings']:
    print(f"Resource: {finding['resource']}")
    print(f"  Principal: {finding['principal']}")
    print(f"  Action: {finding['action']}")
    print(f"  Condition: {finding['condition']}")
    print(f"  Status: {finding['status']}")
    print()

# 未使用アクセスの分析
unused_access = analyzer.list_findings(
    analyzerArn='arn:aws:access-analyzer:ap-northeast-1:123456:analyzer/account-analyzer',
    filter={
        'findingType': {'eq': ['UnusedIAMRole', 'UnusedIAMUserAccessKey', 'UnusedIAMUserPassword']},
    },
)
```

---

## 8. Edge Cases

### Edge Case 1: Overlooking Cross-Account Access

When a resource-based policy (such as an S3 bucket policy or KMS key policy) grants access to another account, IAM Access Analyzer detects it as external access. However, if you do not correctly distinguish between access from accounts within your Organization and access from external accounts, legitimate cross-account access may generate excessive alerts.

### Edge Case 2: GuardDuty Detection Delay

GuardDuty is not real-time — it depends on how frequently data sources are updated. VPC Flow Logs have an approximately 10-minute delay, and CloudTrail events are typically delivered within 15 minutes. As a result, there can be a lag of up to around 30 minutes from the time of an attack to when a notification is received.

### Edge Case 3: Secrets Manager Rotation Failure

If the rotation Lambda times out, the secret remains in AWSPENDING status. If the application then references AWSCURRENT, it continues using the old credentials. The rotation Lambda requires an appropriate timeout (at least 5 minutes), and if running inside a VPC, it needs access to the Secrets Manager endpoint via a NAT Gateway.

---

## 9. Anti-Patterns

### Anti-Pattern 1: Disabling CloudTrail

```
NG:
  → Disabling CloudTrail to reduce costs
  → Enabling it in only a single region
  → Disabling log file integrity validation
  → Storing logs in the application account

OK:
  → Record all regions and all events
  → Enable log file validation
  → Encrypt the S3 bucket with KMS and enable MFA Delete
  → Store logs in a separate archive account
  → Forward to CloudWatch Logs for real-time analysis
```

### Anti-Pattern 2: Long-Term Use of Access Keys

```bash
# NG: アクセスキーを作成して永久に使い続ける
aws iam create-access-key --user-name deploy-user
# → 1年以上ローテーションされないアクセスキー
# → .env ファイルやスクリプトにハードコード
# → 複数人で同じアクセスキーを共有

# OK: IAM ロールと一時認証情報を使用
# EC2: インスタンスプロファイル
# Lambda: 実行ロール
# ECS: タスクロール
# CI/CD: OIDC プロバイダ + AssumeRoleWithWebIdentity

# GitHub Actions の例:
# - uses: aws-actions/configure-aws-credentials@v4
#   with:
#     role-to-assume: arn:aws:iam::123456:role/github-actions-role
#     aws-region: ap-northeast-1
```

### Anti-Pattern 3: Partial Enablement of Security Services

```
NG:
  → Enabling GuardDuty only in some regions
  → Enabling Security Hub without activating Standards
  → Enabling Config without configuring Config Rules
  → Enabling only for the management account, leaving member accounts uncovered

OK:
  → Enable across all regions and all accounts
  → Use Organizations delegated administrator for centralized management
  → Enable all Standards; manage exceptions with documented justification
  → Configure auto-remediation to respond to findings
```

---

## 10. Exercises

### Exercise 1: Automated Notifications with GuardDuty + EventBridge + Lambda

Implement the following:
1. Enable GuardDuty (all data sources)
2. Create an EventBridge rule to filter findings with severity High or above
3. Use Lambda to send Slack notifications with color-coding by severity level
4. Build the infrastructure with Terraform

### Exercise 2: Athena Analysis of CloudTrail Logs

Write the following queries:
1. All IAM user login attempts (successful and failed) in the past 24 hours
2. All operations performed by the root account
3. History of Security Group changes
4. All API calls from a specific IP address

### Exercise 3: Security Hub Score Improvement Plan

Perform the following steps in your AWS account:
1. Enable Security Hub and activate AWS FSBP
2. Check your current score
3. Resolve all CRITICAL findings
4. Create a remediation plan for HIGH findings

---

## 11. FAQ

### Q1. What should I do if there are too many GuardDuty findings?

You can use GuardDuty Suppression Rules to automatically archive low-risk findings. First, review all findings to identify false positive patterns, then configure filters to archive them automatically. However, never suppress findings with severity High or above — always investigate those. Registering your office IP addresses in the Trusted IP List can reduce false positives from normal traffic.

### Q2. How high should I aim to raise the Security Hub score?

Reaching 100% may not always be realistic. The goal should be to address all CRITICAL and HIGH findings and to target an overall score of 90% or higher. When exceptions are necessary, apply Suppression rules and document the reasons. Monitor score trends weekly and investigate if there is a downward trend.

### Q3. How can I optimize CloudTrail costs?

Management events should generally be recorded in full (the cost impact is small). Limit data events (S3/Lambda) to sensitive buckets only. Using Athena + S3 for analysis instead of CloudTrail Lake can reduce costs. Set log retention periods to match regulatory requirements — avoid unnecessarily long retention. Use GLACIER/DEEP_ARCHIVE lifecycle rules to reduce storage costs.

### Q4. When should I use Secrets Manager versus Parameter Store?

Use Secrets Manager for credentials that require automatic rotation (database passwords, API keys). For non-sensitive parameters such as configuration values and flags, Parameter Store (Standard) is free and appropriate. Parameter Store's SecureString is also encrypted, but does not support automatic rotation. In terms of cost, Parameter Store has the advantage (with a free tier); in terms of functionality, Secrets Manager is superior.

### Q5. How do I optimize WAF rule configuration?

Start by enabling the AWS managed rule sets (CommonRuleSet, SQLiRuleSet, XSSRuleSet). Initially run in Count mode to check for false positives, then switch to Block mode once confirmed safe. Use rate-based rules to mitigate DDoS attacks, and use geographic restrictions to block access from unwanted countries. Regularly analyze WAF logs to review the patterns of blocked requests.

### Q6. How do I manage security services in a multi-account environment?

Use the Organizations delegated administrator feature to centrally manage security services across all member accounts from a dedicated security account. GuardDuty, Security Hub, Config, and IAM Access Analyzer all support delegated administrator. Using Control Tower ensures that security services are automatically enabled when new accounts are created.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying how things work.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend solidly understanding the core concepts explained in this guide before moving on to the next steps.

### Q3: How is this applied in practice?

Knowledge of this topic is frequently applied in day-to-day development work — particularly during code reviews and architecture design.

---

## Summary

| Topic | Key Points |
|-------|-----------|
| GuardDuty | Enable across all accounts and regions; use EventBridge for automated alerts and remediation |
| Security Hub | Aggregate findings, evaluate against CIS/AWS best practices, target a score of 90%+ |
| CloudTrail | Record all API calls, require log validation, store in a separate account, analyze with Athena |
| Config | Continuously monitor resource configurations, automatically detect and remediate rule violations |
| IAM | Role-based access, temporary credentials, mandatory MFA, analyze with Access Analyzer |
| Secrets Manager | Centralized secret management with automatic rotation; caching is recommended |
| KMS | Key management for data encryption, envelope encryption, least-privilege key policies |
| WAF | Managed rules + custom rules, rate-based limits, phased rollout from Count to Block mode |

---

## Further Reading

- [Cloud Security Basics](./00-cloud-security-basics.md) — Shared responsibility model and IAM fundamentals
- [IaC Security](./02-infrastructure-as-code-security.md) — Security checks for Terraform/CloudFormation
- [Monitoring/Logging](../06-operations/01-monitoring-logging.md) — SIEM integration

---

## References

1. **AWS Security Best Practices** — https://docs.aws.amazon.com/prescriptive-guidance/latest/security-best-practices/
2. **AWS GuardDuty User Guide** — https://docs.aws.amazon.com/guardduty/latest/ug/
3. **CIS Amazon Web Services Foundations Benchmark** — https://www.cisecurity.org/benchmark/amazon_web_services
4. **AWS Security Hub User Guide** — https://docs.aws.amazon.com/securityhub/latest/userguide/
5. **AWS CloudTrail User Guide** — https://docs.aws.amazon.com/awscloudtrail/latest/userguide/
6. **AWS WAF Developer Guide** — https://docs.aws.amazon.com/waf/latest/developerguide/
7. **AWS Config Developer Guide** — https://docs.aws.amazon.com/config/latest/developerguide/
8. **AWS Secrets Manager User Guide** — https://docs.aws.amazon.com/secretsmanager/latest/userguide/
9. **AWS Well-Architected Framework — Security Pillar** — https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/

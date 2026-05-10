# Cloud Security Fundamentals

> A systematic guide to cloud security foundations: understanding the shared responsibility model, IAM-based least-privilege access control, and encryption at rest and in transit.

## What You Will Learn in This Chapter

1. **Shared Responsibility Model** — Understanding the division of responsibility between cloud providers and users
2. **IAM (Identity and Access Management)** — Access control based on the principle of least privilege
3. **Data Encryption** — Encryption strategies for data at rest and in transit
4. **Network Security** — VPC design and segmentation in practice
5. **Security Services** — Comparison of security services across major cloud providers
6. **Logging, Auditing, and Compliance** — Maintaining audit trails and continuous auditing
7. **Incident Response** — Incident response specific to cloud environments


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Shared Responsibility Model

### Responsibility Breakdown by Service Model

The most important concept in cloud security is the "Shared Responsibility Model." The cloud provider is responsible for "Security **of** the Cloud," while the user is responsible for "Security **in** the Cloud."

```
+----------------------------------------------------------+
|              Shared Responsibility Model                  |
|----------------------------------------------------------|
|                  IaaS    PaaS    SaaS                     |
|                  (EC2)   (Lambda) (Office365)             |
|----------------------------------------------------------|
| Data            | User | User  | User                    |
| Application     | User | User  | Provider                |
| Runtime         | User | Provider| Provider               |
| Middleware      | User | Provider| Provider               |
| OS              | User | Provider| Provider               |
| Virtualization  | Provider| Provider| Provider             |
| Network         | Provider| Provider| Provider              |
| Physical        | Provider| Provider| Provider              |
|----------------------------------------------------------|
| User = User Responsibility  |  Provider = Cloud Provider  |
+----------------------------------------------------------+
```

### User Responsibility Details for Each Service Model

#### IaaS (Infrastructure as a Service)

In IaaS, the user has the broadest scope of responsibility. OS patching, middleware configuration, firewall rules, and all application security are the user's responsibility.

```
IaaS User Responsibility Checklist:
+----------------------------------------------------------+
| [ ] OS patches are applied regularly                      |
| [ ] Unnecessary ports are closed, security groups minimized|
| [ ] Host-based IDS/IPS is deployed                       |
| [ ] Log collection and monitoring is configured           |
| [ ] Data encryption (EBS, S3) is enabled                 |
| [ ] IAM roles are used; access keys are not hardcoded    |
| [ ] Security scans are performed on AMI/VM images        |
| [ ] Backup and disaster recovery plans are in place       |
+----------------------------------------------------------+
```

#### PaaS (Platform as a Service)

In PaaS, everything below the runtime layer is the provider's responsibility, but application code and data security remain the user's responsibility.

```
PaaS User Responsibility Checklist:
+----------------------------------------------------------+
| [ ] Vulnerability scans are performed on application code |
| [ ] Environment variables / secrets are managed properly  |
| [ ] API access control (authentication/authorization) is implemented |
| [ ] Execution privileges for functions/containers are minimized |
| [ ] Deployment pipeline security is ensured               |
| [ ] Dependency library vulnerabilities are checked regularly |
+----------------------------------------------------------+
```

#### SaaS (Software as a Service)

In SaaS, user responsibility is limited to data and access management, but significant risks still exist.

```
SaaS User Responsibility Checklist:
+----------------------------------------------------------+
| [ ] User account audits are performed regularly           |
| [ ] MFA (multi-factor authentication) is enabled for all users |
| [ ] Data classification and sharing settings are properly managed |
| [ ] A process exists to immediately disable departed employees |
| [ ] SaaS API access token management is in place         |
| [ ] Data export/backup methods are secured               |
+----------------------------------------------------------+
```

### Common Misconceptions About the Shared Responsibility Model

```
+----------------------------------------------------------+
|  Misconception               | Correct Understanding      |
|----------------------------------------------------------+
|  "Cloud means secure"        | Infra is secure; config is your responsibility |
|  "Cloud auto-encrypts"       | Encryption must be explicitly enabled by user |
|  "Access control not needed" | IAM configuration is the user's responsibility |
|  "Backups are automatic"     | Configuration and testing are the user's responsibility |
|  "Compliance is automatic"   | Certification and maintenance are the user's responsibility |
|  "Logs are stored forever"   | Retention period configuration is the user's responsibility |
|  "Multi-tenancy is dangerous"| Logical isolation is equivalent to physical isolation |
|  "Provider guarantees DR"    | Availability design is the user's responsibility |
+----------------------------------------------------------+
```

### Shared Responsibility Model in Practice: S3 Data Breach

Understanding the shared responsibility model through a real-world incident.

```
[Incident Example: Misconfigured S3 Bucket Public Access]

Situation:
  A company stored customer data in S3
  The bucket policy was accidentally set to Public
  All data was accessible externally for several months

Where Responsibility Lies:
  +----------------------------------------------------------+
  | AWS Responsibility               | User Responsibility    |
  |----------------------------------------------------------+
  | S3 service availability          | Bucket policy config   |
  | Physical security of S3 infra    | Public access block    |
  | Providing S3 encryption features | Enabling encryption    |
  | Providing S3 access log features | Enabling logs & monitoring |
  +----------------------------------------------------------+

  → AWS determined that "S3 was operating correctly"
  → The misconfiguration was the user's responsibility
  → AWS added the S3 Block Public Access feature to help prevent this
```

### Differences in Shared Responsibility Models by Major Provider

```
+----------------------------------------------------------+
| Provider     | Model Name             | Characteristics    |
|----------------------------------------------------------+
| AWS          | Shared Responsibility  | Standard two-way   |
|              | Model                  | split              |
| Azure        | Shared Responsibility  | Nearly identical   |
|              | in the Cloud           | to AWS             |
| GCP          | Shared Fate            | Emphasizes more    |
|              |                        | proactive support  |
+----------------------------------------------------------+

GCP's "Shared Fate" Approach:
  - Not just dividing responsibility but "achieving security together"
  - Assured Workloads: automatic compliance support
  - Security Command Center: auto-detection and remediation suggestions for misconfigs
  - Organization Policy: organizational policy as guardrails
```

---

## 2. IAM (Identity and Access Management)

### IAM Components

```
+----------------------------------------------------------+
|                    IAM Components                         |
|----------------------------------------------------------|
|                                                          |
|  [Identities]                                             |
|  +-- Users (human operators)                             |
|  +-- Service Accounts (applications)                     |
|  +-- Roles (temporary permission sets)                   |
|  +-- Groups (collections of users)                       |
|                                                          |
|  [Policies]                                              |
|  +-- Identity-based policies (who can do what)           |
|  +-- Resource-based policies (who can access what)       |
|  +-- Permission boundaries (maximum permission limits)   |
|  +-- SCP (organization-wide restrictions)                |
|                                                          |
|  [Authentication Methods]                                |
|  +-- Password + MFA                                      |
|  +-- Access keys (programmatic access)                   |
|  +-- Temporary security credentials (STS)                |
|  +-- SSO / SAML / OIDC federation                        |
+----------------------------------------------------------+
```

### IAM Policy Evaluation Logic

It is important to understand precisely how policies are evaluated.

```
IAM Policy Evaluation Flow:

Request received
    |
    v
[1] Is there an explicit Deny? ──── Yes ──→ Access Denied
    |
    No
    |
    v
[2] Is it allowed by SCP? ──────── No ───→ Access Denied
    |
    Yes
    |
    v
[3] Is it allowed by a
    resource-based policy? ──────── Yes ──→ Access Allowed
    |
    No (or none)
    |
    v
[4] Is it allowed by an
    identity-based policy? ──────── No ───→ Access Denied
    |
    Yes
    |
    v
[5] Is it allowed by the
    permission boundary? ──────── No ───→ Access Denied
    |
    Yes
    |
    v
[6] Is it allowed by the
    session policy? ──────────── No ───→ Access Denied
    |
    Yes
    |
    v
  Access Allowed

Key Points:
  - Explicit Deny always takes highest priority
  - No explicit Allow defaults to deny (implicit Deny)
  - Multiple policies are evaluated with AND logic
```

### Designing Least-Privilege Policies

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowS3ReadSpecificBucket",
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::my-app-data",
                "arn:aws:s3:::my-app-data/*"
            ],
            "Condition": {
                "StringEquals": {
                    "aws:RequestedRegion": "ap-northeast-1"
                },
                "IpAddress": {
                    "aws:SourceIp": "10.0.0.0/8"
                }
            }
        },
        {
            "Sid": "DenyUnencryptedUploads",
            "Effect": "Deny",
            "Action": "s3:PutObject",
            "Resource": "arn:aws:s3:::my-app-data/*",
            "Condition": {
                "StringNotEquals": {
                    "s3:x-amz-server-side-encryption": "aws:kms"
                }
            }
        }
    ]
}
```

### IAM Policy Design Best Practices

```
+----------------------------------------------------------+
|  5 Principles of IAM Policy Design                       |
|----------------------------------------------------------|
|                                                          |
|  1. Principle of Least Privilege                         |
|     - Grant only the permissions required                |
|     - Avoid using wildcards (*)                          |
|     - Restrict both Action and Resource                  |
|                                                          |
|  2. Active Use of Conditions                             |
|     - IP address restrictions                            |
|     - Region restrictions                                |
|     - Require MFA                                        |
|     - Attribute-based access control (ABAC) with tags    |
|                                                          |
|  3. Role-Based Access Control (RBAC)                     |
|     - Assign permissions to groups/roles, not individuals|
|     - Implement Separation of Duties                     |
|                                                          |
|  4. Prefer Temporary Credentials                         |
|     - Use STS instead of long-lived access keys          |
|     - IAM role assumption                                |
|     - Set appropriate session expiration                 |
|                                                          |
|  5. Regular Audits and Permission Reduction              |
|     - Detect unused permissions with IAM Access Analyzer |
|     - Disable access keys unused for 90+ days            |
|     - Perform regular audits with Credential Report      |
+----------------------------------------------------------+
```

### Advanced Policy Example: ABAC (Attribute-Based Access Control)

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "ABACTagBasedAccess",
            "Effect": "Allow",
            "Action": [
                "ec2:StartInstances",
                "ec2:StopInstances",
                "ec2:RebootInstances"
            ],
            "Resource": "arn:aws:ec2:*:*:instance/*",
            "Condition": {
                "StringEquals": {
                    "ec2:ResourceTag/Department": "${aws:PrincipalTag/Department}",
                    "ec2:ResourceTag/Environment": "${aws:PrincipalTag/Environment}"
                }
            }
        },
        {
            "Sid": "ABACDenyTagModification",
            "Effect": "Deny",
            "Action": [
                "ec2:CreateTags",
                "ec2:DeleteTags"
            ],
            "Resource": "*",
            "Condition": {
                "ForAnyValue:StringEquals": {
                    "aws:TagKeys": ["Department", "Environment"]
                }
            }
        }
    ]
}
```

```
Benefits of ABAC:
  - Dynamically control permissions based on tags
  - No policy update needed when new resources are added
  - Scalable permission management
  - Example: Users with Department=Engineering can only operate
             instances with Department=Engineering
```

### Using IAM Roles (EC2/Lambda)

```python
import boto3

# Access via EC2 instance profile
# (No need to hardcode access keys)
s3 = boto3.client('s3')  # Automatically retrieves IAM role credentials

# Least-privilege policy for Lambda role (Terraform)
"""
resource "aws_iam_role" "lambda_role" {
  name = "my-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "lambda_policy" {
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem"]
        Resource = "arn:aws:dynamodb:*:*:table/my-table"
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}
"""
```

### Configuring Cross-Account Access

```json
// Trust policy for the role in Account A (resource owner)
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::111122223333:role/CrossAccountRole"
            },
            "Action": "sts:AssumeRole",
            "Condition": {
                "StringEquals": {
                    "sts:ExternalId": "unique-external-id-12345"
                }
            }
        }
    ]
}
```

```python
# Cross-account access from Account B (requestor)
import boto3

# Assume the cross-account role via STS
sts = boto3.client('sts')
assumed_role = sts.assume_role(
    RoleArn='arn:aws:iam::999888777666:role/CrossAccountS3Access',
    RoleSessionName='cross-account-session',
    ExternalId='unique-external-id-12345',
    DurationSeconds=3600  # 1 hour
)

# Access S3 using temporary credentials
credentials = assumed_role['Credentials']
s3 = boto3.client(
    's3',
    aws_access_key_id=credentials['AccessKeyId'],
    aws_secret_access_key=credentials['SecretAccessKey'],
    aws_session_token=credentials['SessionToken']
)

# Now able to access Account A's S3 bucket
response = s3.list_objects_v2(Bucket='account-a-bucket')
```

### Multi-Account Strategy

```
+----------------------------------------------------------+
|  AWS Organizations                                       |
|                                                          |
|  +-- Management Account (billing and org management only)|
|  |                                                       |
|  +-- Security OU                                         |
|  |   +-- Security Account (GuardDuty, Security Hub)      |
|  |   +-- Log Archive Account (CloudTrail, Config)        |
|  |                                                       |
|  +-- Workloads OU                                        |
|  |   +-- Production Account                              |
|  |   +-- Staging Account                                 |
|  |   +-- Development Account                             |
|  |                                                       |
|  +-- Sandbox OU                                          |
|      +-- Developer Sandbox Accounts                      |
|                                                          |
|  Apply restrictions to all accounts via SCP              |
+----------------------------------------------------------+
```

### Practical SCP (Service Control Policy) Examples

```json
// Example SCP applied to all accounts
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "DenyRegionOutsideAPNE1",
            "Effect": "Deny",
            "Action": "*",
            "Resource": "*",
            "Condition": {
                "StringNotEquals": {
                    "aws:RequestedRegion": [
                        "ap-northeast-1",
                        "us-east-1"
                    ]
                },
                "ArnNotLike": {
                    "aws:PrincipalARN": "arn:aws:iam::*:role/OrganizationAdmin"
                }
            }
        },
        {
            "Sid": "DenyLeaveOrganization",
            "Effect": "Deny",
            "Action": "organizations:LeaveOrganization",
            "Resource": "*"
        },
        {
            "Sid": "DenyDisableSecurityServices",
            "Effect": "Deny",
            "Action": [
                "guardduty:DeleteDetector",
                "guardduty:DisassociateFromMasterAccount",
                "config:StopConfigurationRecorder",
                "config:DeleteConfigurationRecorder",
                "cloudtrail:StopLogging",
                "cloudtrail:DeleteTrail"
            ],
            "Resource": "*"
        },
        {
            "Sid": "DenyRootAccount",
            "Effect": "Deny",
            "Action": "*",
            "Resource": "*",
            "Condition": {
                "StringLike": {
                    "aws:PrincipalArn": "arn:aws:iam::*:root"
                }
            }
        }
    ]
}
```

### AWS IAM Identity Center (formerly SSO) Configuration

```
+----------------------------------------------------------+
|  IAM Identity Center Architecture                        |
|                                                          |
|  [IdP: External Identity Provider]                       |
|  (Okta / Azure AD / Google Workspace)                    |
|       |                                                  |
|       | SAML 2.0 / SCIM                                  |
|       v                                                  |
|  [IAM Identity Center]                                   |
|       |                                                  |
|       +-- Permission Set A (Administrators)              |
|       |   +-- AWS Account: Production                    |
|       |   +-- Policy: AdministratorAccess                |
|       |                                                  |
|       +-- Permission Set B (Developers)                  |
|       |   +-- AWS Account: Development                   |
|       |   +-- Policy: PowerUserAccess                    |
|       |                                                  |
|       +-- Permission Set C (Read-only)                   |
|           +-- AWS Account: Production, Staging           |
|           +-- Policy: ReadOnlyAccess                     |
|                                                          |
|  Benefits:                                               |
|  - Centralized access management in one place            |
|  - Automatic issuance of temporary credentials           |
|  - No long-lived access keys required                    |
|  - Immediate access revocation upon employee departure   |
+----------------------------------------------------------+
```

---

## 3. Data Encryption

### Encryption Classification

```
+----------------------------------------------------------+
|                Layers of Encryption                       |
|----------------------------------------------------------|
|                                                          |
|  In Transit:                                             |
|  +-- TLS 1.2/1.3 (HTTPS, gRPC over TLS)                 |
|  +-- VPN (IPsec, WireGuard)                              |
|  +-- SSH tunneling                                       |
|                                                          |
|  At Rest:                                                |
|  +-- Server-side encryption (SSE)                        |
|  |   +-- SSE-S3 (S3-managed keys)                        |
|  |   +-- SSE-KMS (KMS-managed keys)                      |
|  |   +-- SSE-C (customer-provided keys)                  |
|  +-- Client-side encryption (CSE)                        |
|  +-- Disk encryption (EBS, RDS)                          |
|                                                          |
|  In Use:                                                 |
|  +-- AWS Nitro Enclaves                                  |
|  +-- Confidential Computing                              |
+----------------------------------------------------------+
```

### Detailed Comparison of Encryption Methods

```
+----------------------------------------------------------+
|  Encryption Method Comparison                            |
|----------------------------------------------------------|
|  Method       | Key Mgmt | Audit | Cost | Use Case       |
|----------------------------------------------------------|
|  SSE-S3       | AWS      | Low   | Free | Basic encryption|
|  SSE-KMS      | User     | High  | Paid | Compliance     |
|  SSE-C        | User     | High  | Free | Full key control|
|  CSE          | User     | High  | -    | Top-secret data |
|----------------------------------------------------------|
|                                                          |
|  SSE-S3:                                                 |
|  - AWS manages keys; easiest to use                      |
|  - Key rotation is automatic                             |
|  - Key usage cannot be tracked in audit logs             |
|                                                          |
|  SSE-KMS:                                                |
|  - User controls key creation, rotation, and deletion    |
|  - Key usage can be tracked via CloudTrail               |
|  - Fine-grained access control with key policies         |
|  - Be aware of rate limits on API calls                  |
|                                                          |
|  SSE-C:                                                  |
|  - User provides the encryption key; AWS performs encryption |
|  - AWS does not store the key (HTTPS required)           |
|  - Data is irrecoverable if the key is lost              |
|                                                          |
|  CSE:                                                    |
|  - Data is encrypted client-side before sending to AWS   |
|  - AWS only holds encrypted data                         |
|  - Highest security but also highest implementation cost |
+----------------------------------------------------------+
```

### KMS (Key Management Service) Details

```
+----------------------------------------------------------+
|  KMS Key Hierarchy                                       |
|                                                          |
|  [Customer Master Key (CMK)]                             |
|       |                                                  |
|       | Encrypts                                         |
|       v                                                  |
|  [Data Encryption Key (DEK)]                             |
|       |                                                  |
|       | Encrypts                                         |
|       v                                                  |
|  [Actual Data]                                           |
|                                                          |
|  How Envelope Encryption Works:                          |
|  1. Request DEK generation from KMS                      |
|  2. Receive plaintext DEK and encrypted DEK              |
|  3. Encrypt data with the plaintext DEK                  |
|  4. Delete the plaintext DEK from memory                 |
|  5. Store the encrypted DEK alongside the data           |
|  6. Decryption: decrypt the encrypted DEK via KMS → decrypt data |
+----------------------------------------------------------+
```

```python
# Example implementation of envelope encryption using KMS
import boto3
import base64
from cryptography.fernet import Fernet

kms = boto3.client('kms', region_name='ap-northeast-1')

# 1. Generate a data key
response = kms.generate_data_key(
    KeyId='alias/my-app-key',
    KeySpec='AES_256'
)

plaintext_key = response['Plaintext']       # Plaintext DEK
encrypted_key = response['CiphertextBlob']  # Encrypted DEK

# 2. Encrypt data with the plaintext key
fernet_key = base64.urlsafe_b64encode(plaintext_key)
f = Fernet(fernet_key)
encrypted_data = f.encrypt(b"Secret data to protect")

# 3. Delete the plaintext key from memory
del plaintext_key
del fernet_key

# 4. Store the encrypted key and encrypted data
# (save encrypted_key and encrypted_data)

# ========================================
# Decryption Process
# ========================================

# 5. Decrypt the encrypted key via KMS
decrypt_response = kms.decrypt(
    CiphertextBlob=encrypted_key,
    KeyId='alias/my-app-key'
)
decrypted_key = decrypt_response['Plaintext']

# 6. Decrypt data with the decrypted key
fernet_key = base64.urlsafe_b64encode(decrypted_key)
f = Fernet(fernet_key)
original_data = f.decrypt(encrypted_data)

# 7. Delete the key from memory
del decrypted_key
del fernet_key
```

### Designing KMS Key Policies

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "Enable IAM policies for key management",
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::123456789012:root"
            },
            "Action": "kms:*",
            "Resource": "*"
        },
        {
            "Sid": "Allow key administrators",
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::123456789012:role/KeyAdminRole"
            },
            "Action": [
                "kms:Create*",
                "kms:Describe*",
                "kms:Enable*",
                "kms:List*",
                "kms:Put*",
                "kms:Update*",
                "kms:Revoke*",
                "kms:Disable*",
                "kms:Get*",
                "kms:Delete*",
                "kms:ScheduleKeyDeletion",
                "kms:CancelKeyDeletion"
            ],
            "Resource": "*"
        },
        {
            "Sid": "Allow key usage for encryption",
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::123456789012:role/AppServiceRole"
            },
            "Action": [
                "kms:Encrypt",
                "kms:Decrypt",
                "kms:ReEncrypt*",
                "kms:GenerateDataKey*",
                "kms:DescribeKey"
            ],
            "Resource": "*",
            "Condition": {
                "StringEquals": {
                    "kms:ViaService": "s3.ap-northeast-1.amazonaws.com"
                }
            }
        }
    ]
}
```

### S3 Bucket Security Configuration

```python
import boto3
import json

s3 = boto3.client('s3')

# Configure default encryption
s3.put_bucket_encryption(
    Bucket='my-secure-bucket',
    ServerSideEncryptionConfiguration={
        'Rules': [{
            'ApplyServerSideEncryptionByDefault': {
                'SSEAlgorithm': 'aws:kms',
                'KMSMasterKeyID': 'arn:aws:kms:ap-northeast-1:123456:key/xxx',
            },
            'BucketKeyEnabled': True,  # Cost reduction
        }]
    },
)

# Block public access
s3.put_public_access_block(
    Bucket='my-secure-bucket',
    PublicAccessBlockConfiguration={
        'BlockPublicAcls': True,
        'IgnorePublicAcls': True,
        'BlockPublicPolicy': True,
        'RestrictPublicBuckets': True,
    },
)

# Bucket policy: allow HTTPS only
bucket_policy = {
    "Version": "2012-10-17",
    "Statement": [{
        "Sid": "DenyHTTP",
        "Effect": "Deny",
        "Principal": "*",
        "Action": "s3:*",
        "Resource": [
            "arn:aws:s3:::my-secure-bucket",
            "arn:aws:s3:::my-secure-bucket/*",
        ],
        "Condition": {
            "Bool": {"aws:SecureTransport": "false"}
        }
    }]
}

s3.put_bucket_policy(
    Bucket='my-secure-bucket',
    Policy=json.dumps(bucket_policy)
)

# Enable versioning (protection against accidental deletion and tampering)
s3.put_bucket_versioning(
    Bucket='my-secure-bucket',
    VersioningConfiguration={
        'Status': 'Enabled'
    }
)

# Object lock configuration (ransomware protection)
# * Can only be enabled at bucket creation time
s3.put_object_lock_configuration(
    Bucket='my-secure-bucket',
    ObjectLockConfiguration={
        'ObjectLockEnabled': 'Enabled',
        'Rule': {
            'DefaultRetention': {
                'Mode': 'GOVERNANCE',  # or 'COMPLIANCE'
                'Days': 365
            }
        }
    }
)
```

### RDS / Database Encryption

```python
# RDS encryption configuration with Terraform
"""
resource "aws_db_instance" "main" {
  identifier     = "my-secure-db"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.r6g.large"

  # Encryption settings
  storage_encrypted = true
  kms_key_id       = aws_kms_key.rds_key.arn

  # Network security
  db_subnet_group_name   = aws_db_subnet_group.private.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]
  publicly_accessible    = false

  # Enforce SSL
  parameter_group_name = aws_db_parameter_group.ssl_required.name

  # Automated backups
  backup_retention_period = 35
  backup_window          = "03:00-04:00"

  # Deletion protection
  deletion_protection = true

  # Enhanced monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn

  # Log exports
  enabled_cloudwatch_logs_exports = [
    "postgresql",
    "upgrade"
  ]
}

# Parameter group to enforce SSL connections
resource "aws_db_parameter_group" "ssl_required" {
  family = "postgres15"
  name   = "ssl-required"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
}
"""
```

### Secret Management

```
+----------------------------------------------------------+
|  Secret Management Best Practices                        |
|----------------------------------------------------------|
|                                                          |
|  Anti-patterns:                                          |
|  - Hardcoding in source code                             |
|  - Setting as plaintext environment variables            |
|  - Writing in config files and committing to Git         |
|  - Sharing passwords via chat or email                   |
|                                                          |
|  Best practices:                                         |
|  - AWS Secrets Manager / Parameter Store                 |
|  - GCP Secret Manager                                    |
|  - Azure Key Vault                                       |
|  - HashiCorp Vault                                       |
|  - Retrieve secrets only at runtime                      |
|  - Automatic rotation                                    |
+----------------------------------------------------------+
```

```python
# Example of securely retrieving a secret from AWS Secrets Manager
import boto3
import json

def get_secret(secret_name: str) -> dict:
    """Safely retrieve a secret from Secrets Manager"""
    client = boto3.client('secretsmanager', region_name='ap-northeast-1')

    try:
        response = client.get_secret_value(SecretId=secret_name)
        secret = json.loads(response['SecretString'])
        return secret
    except client.exceptions.ResourceNotFoundException:
        raise ValueError(f"Secret {secret_name} not found")
    except client.exceptions.DecryptionFailure:
        raise ValueError(f"Cannot decrypt secret {secret_name}")

# Usage example: database connection
db_secret = get_secret('prod/myapp/database')
connection_string = (
    f"postgresql://{db_secret['username']}:{db_secret['password']}"
    f"@{db_secret['host']}:{db_secret['port']}/{db_secret['dbname']}"
)

# Automatic secret rotation configuration with Terraform
"""
resource "aws_secretsmanager_secret" "db_password" {
  name = "prod/myapp/database"

  # Automatic rotation
  rotation_rules {
    automatically_after_days = 30
  }
}

resource "aws_secretsmanager_secret_rotation" "db_rotation" {
  secret_id           = aws_secretsmanager_secret.db_password.id
  rotation_lambda_arn = aws_lambda_function.secret_rotation.arn

  rotation_rules {
    automatically_after_days = 30
  }
}
"""
```

---

## 4. Network Security (Cloud)

### VPC Design

```
+----------------------------------------------------------+
|  VPC (10.0.0.0/16)                                       |
|                                                          |
|  +-- Public Subnet (10.0.1.0/24)                         |
|  |   +-- NAT Gateway                                    |
|  |   +-- ALB                                            |
|  |   Route: 0.0.0.0/0 → IGW                             |
|  |                                                       |
|  +-- Private Subnet (10.0.2.0/24)                        |
|  |   +-- EC2 / ECS                                      |
|  |   Route: 0.0.0.0/0 → NAT GW                          |
|  |                                                       |
|  +-- Data Subnet (10.0.3.0/24)                           |
|  |   +-- RDS / ElastiCache                               |
|  |   Route: local only                                   |
|  |                                                       |
|  +-- VPC Endpoints (S3, DynamoDB, KMS)                   |
|      → Access AWS services without going through the internet |
+----------------------------------------------------------+
```

### Security Design for Multi-AZ Configuration

```
+----------------------------------------------------------+
|  VPC (10.0.0.0/16) - Multi-AZ Design                    |
|                                                          |
|  AZ-a                          AZ-c                      |
|  +------------------------+  +------------------------+  |
|  | Public (10.0.1.0/24)   |  | Public (10.0.4.0/24)   |  |
|  | +-- ALB Node           |  | +-- ALB Node           |  |
|  | +-- NAT GW             |  | +-- NAT GW             |  |
|  +------------------------+  +------------------------+  |
|  | Private (10.0.2.0/24)  |  | Private (10.0.5.0/24)  |  |
|  | +-- App Server 1       |  | +-- App Server 2       |  |
|  +------------------------+  +------------------------+  |
|  | Data (10.0.3.0/24)     |  | Data (10.0.6.0/24)     |  |
|  | +-- RDS Primary        |  | +-- RDS Standby        |  |
|  +------------------------+  +------------------------+  |
|                                                          |
|  Security Design Points:                                 |
|  - Place subnets at each tier (public/private/data)      |
|  - Redundant identical configuration in each AZ          |
|  - Data subnet has no external connectivity (no route table) |
|  - Enable VPC Flow Logs on all subnets                   |
+----------------------------------------------------------+
```

### Security Groups vs Network ACLs

```
+----------------------------------------------------------+
|  Security Groups vs Network ACLs                         |
|----------------------------------------------------------|
|  Item             | Security Groups      | Network ACLs  |
|----------------------------------------------------------|
|  Level            | Instance             | Subnet        |
|  State            | Stateful             | Stateless     |
|  Rules            | Allow only           | Allow + Deny  |
|  Evaluation       | All rules evaluated  | Numbered order|
|  Default          | Deny all inbound     | Allow all     |
|  Use case         | Per-app control      | Subnet defense|
+----------------------------------------------------------+

Recommended Configuration:
  - Security Groups: primary access control (main usage)
  - Network ACLs: additional defense layer (explicit deny of specific IPs)
```

```hcl
# Terraform security group design example
resource "aws_security_group" "alb_sg" {
  name        = "alb-security-group"
  description = "ALB security group"
  vpc_id      = aws_vpc.main.id

  # Allow HTTPS only
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS from internet"
  }

  # For HTTP → HTTPS redirect
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP redirect"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "app_sg" {
  name        = "app-security-group"
  description = "Application server security group"
  vpc_id      = aws_vpc.main.id

  # Accept traffic from ALB only
  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
    description     = "Traffic from ALB only"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "db_sg" {
  name        = "db-security-group"
  description = "Database security group"
  vpc_id      = aws_vpc.main.id

  # Accept traffic from app servers only
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app_sg.id]
    description     = "PostgreSQL from app servers only"
  }

  # No outbound traffic needed
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

### Leveraging VPC Endpoints

```
+----------------------------------------------------------+
|  VPC Endpoint Types and Use Cases                        |
|----------------------------------------------------------|
|                                                          |
|  Gateway Endpoints (Free):                               |
|  +-- S3                                                  |
|  +-- DynamoDB                                            |
|  → Adds an entry to the route table                      |
|                                                          |
|  Interface Endpoints (Paid):                             |
|  +-- KMS, Secrets Manager, STS, CloudWatch Logs          |
|  +-- ECR, ECS, Lambda, SNS, SQS                         |
|  → An ENI is created; communication uses a private IP    |
|  → Also known as PrivateLink                             |
|                                                          |
|  Benefits:                                               |
|  - Data does not traverse the internet                   |
|  - Reduced NAT Gateway bandwidth and cost                |
|  - Additional control with VPC endpoint policies         |
+----------------------------------------------------------+
```

```json
// VPC endpoint policy example: allow access to a specific bucket only
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowSpecificBucketOnly",
            "Effect": "Allow",
            "Principal": "*",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::my-app-bucket",
                "arn:aws:s3:::my-app-bucket/*"
            ]
        }
    ]
}
```

### Leveraging VPC Flow Logs

```python
# VPC Flow Logs configuration with Terraform
"""
resource "aws_flow_log" "vpc_flow_log" {
  iam_role_arn    = aws_iam_role.flow_log_role.arn
  log_destination = aws_cloudwatch_log_group.flow_log.arn
  traffic_type    = "ALL"  # ACCEPT, REJECT, ALL
  vpc_id          = aws_vpc.main.id

  # Custom log format
  log_format = "$${version} $${account-id} $${interface-id} $${srcaddr} $${dstaddr} $${srcport} $${dstport} $${protocol} $${packets} $${bytes} $${start} $${end} $${action} $${log-status} $${vpc-id} $${subnet-id} $${az-id} $${sublocation-type} $${sublocation-id}"

  max_aggregation_interval = 60  # 1-minute intervals
}

resource "aws_cloudwatch_log_group" "flow_log" {
  name              = "/vpc/flow-logs"
  retention_in_days = 90
  kms_key_id        = aws_kms_key.log_key.arn
}
"""

# Example Athena queries for analyzing VPC Flow Logs
"""
-- Analyze rejected traffic
SELECT srcaddr, dstaddr, dstport, protocol,
       SUM(packets) as total_packets,
       SUM(bytes) as total_bytes
FROM vpc_flow_logs
WHERE action = 'REJECT'
  AND date = '2024/01/15'
GROUP BY srcaddr, dstaddr, dstport, protocol
ORDER BY total_bytes DESC
LIMIT 20;

-- Detect suspicious outbound connections
SELECT srcaddr, dstaddr, dstport,
       SUM(bytes) as total_bytes
FROM vpc_flow_logs
WHERE srcaddr LIKE '10.%'
  AND NOT dstaddr LIKE '10.%'
  AND dstport NOT IN (443, 80, 53)
  AND action = 'ACCEPT'
GROUP BY srcaddr, dstaddr, dstport
ORDER BY total_bytes DESC
LIMIT 50;
"""
```

---

## 5. Overview of Security Services

### Cloud Security Service Comparison

| Category | AWS | GCP | Azure |
|---------|-----|-----|-------|
| Threat Detection | GuardDuty | Security Command Center | Defender for Cloud |
| Unified Management | Security Hub | SCC Premium | Defender CSPM |
| Audit Logs | CloudTrail | Cloud Audit Logs | Activity Log |
| Config Audit | Config | Cloud Asset Inventory | Policy |
| WAF | AWS WAF | Cloud Armor | Azure WAF |
| KMS | AWS KMS | Cloud KMS | Key Vault |
| Secrets | Secrets Manager | Secret Manager | Key Vault Secrets |
| DDoS Protection | Shield / Shield Advanced | Cloud Armor | DDoS Protection |
| Network FW | Network Firewall | Cloud Firewall | Azure Firewall |
| Vulnerability Mgmt | Inspector | Security Scanner | Defender for VMs |
| Containers | Inspector / ECR Scan | Container Analysis | Defender for Containers |
| SIEM | Security Lake + OpenSearch | Chronicle | Sentinel |

### AWS Security Service Integration Architecture

```
+----------------------------------------------------------+
|  AWS Security Services Integration Diagram               |
|                                                          |
|  [Data Collection Layer]                                 |
|  CloudTrail ──┐                                          |
|  Config ──────┤                                          |
|  GuardDuty ───┤                                          |
|  Inspector ───┤──→ [Security Hub] ──→ [Notifications/Response] |
|  Macie ───────┤         |                                |
|  IAM Analyzer ┘         |                                |
|                         v                                |
|                   [Security Lake]                         |
|                         |                                |
|                         v                                |
|                   [Athena / OpenSearch]                   |
|                   (Analysis / Visualization)             |
|                                                          |
|  [Automated Remediation]                                 |
|  Security Hub                                            |
|       |                                                  |
|       v                                                  |
|  EventBridge ──→ Lambda ──→ Auto-remediation actions     |
|  (rule match)    (remediate) (SG changes, make S3 private, etc.) |
+----------------------------------------------------------+
```

### GuardDuty Threat Detection Patterns

```
+----------------------------------------------------------+
|  Main Threat Categories Detected by GuardDuty            |
|----------------------------------------------------------|
|                                                          |
|  [Recon]                                                 |
|  - Port scanning                                         |
|  - Anomalous API call patterns                           |
|  - DNS query anomalies                                   |
|                                                          |
|  [UnauthorizedAccess]                                    |
|  - API calls from unusual regions                        |
|  - Access from known malicious IPs                       |
|  - Brute force attacks (SSH, RDP)                        |
|                                                          |
|  [CryptoCurrency]                                        |
|  - Mining activity detected on EC2 instances             |
|  - Cryptocurrency-related DNS queries                    |
|                                                          |
|  [Exfiltration]                                          |
|  - Unusual volume of S3 data downloads                   |
|  - Data transfer to suspicious external endpoints        |
|                                                          |
|  [PrivilegeEscalation]                                   |
|  - Calls to high-privilege APIs not normally used        |
|  - Unauthorized attachment of administrator policies     |
|                                                          |
|  Severity: classified as High / Medium / Low             |
|  → High requires immediate investigation and response    |
+----------------------------------------------------------+
```

### Continuous Compliance with AWS Config Rules

```python
# Example AWS Config custom rule (evaluated via Lambda)
import boto3
import json

def lambda_handler(event, context):
    """
    Custom Config rule: verify S3 buckets have encryption enabled
    """
    config = boto3.client('config')

    # Retrieve evaluation target resource information
    invoking_event = json.loads(event['invokingEvent'])
    configuration_item = invoking_event['configurationItem']

    bucket_name = configuration_item['resourceName']

    # Check S3 encryption
    s3 = boto3.client('s3')
    try:
        encryption = s3.get_bucket_encryption(Bucket=bucket_name)
        compliance = 'COMPLIANT'
        annotation = 'Bucket encryption is enabled'
    except s3.exceptions.ClientError as e:
        if 'ServerSideEncryptionConfigurationNotFoundError' in str(e):
            compliance = 'NON_COMPLIANT'
            annotation = 'Bucket encryption is NOT enabled'
        else:
            compliance = 'NOT_APPLICABLE'
            annotation = f'Error checking encryption: {str(e)}'

    # Report evaluation result
    config.put_evaluations(
        Evaluations=[{
            'ComplianceResourceType': configuration_item['resourceType'],
            'ComplianceResourceId': configuration_item['resourceId'],
            'ComplianceType': compliance,
            'Annotation': annotation,
            'OrderingTimestamp': configuration_item['configurationItemCaptureTime']
        }],
        ResultToken=event['resultToken']
    )

    return {'compliance': compliance}
```

---

## 6. Logging, Auditing, and Compliance

### CloudTrail Configuration and Usage

```
+----------------------------------------------------------+
|  CloudTrail Best Practices                               |
|----------------------------------------------------------|
|                                                          |
|  [Required Settings]                                     |
|  - Enable in all regions                                 |
|  - Aggregate logs in an S3 bucket                        |
|  - Enable log file validation (integrity check)          |
|  - Encrypt the log bucket (SSE-KMS)                      |
|  - Enable access logging on the log bucket               |
|  - Set MFA Delete on the log bucket                      |
|                                                          |
|  [Recommended Settings]                                  |
|  - Deliver to CloudWatch Logs                            |
|  - Configure metric filters and alarms                   |
|  - Configure as an organization trail in AWS Organizations |
|  - Record S3 data events and Lambda data events          |
|  - Create Athena tables for analysis                     |
+----------------------------------------------------------+
```

```python
# Example Athena analysis queries for CloudTrail logs

# 1. Track IAM policy changes
"""
SELECT eventtime, useridentity.arn, eventname,
       requestparameters, responseelements
FROM cloudtrail_logs
WHERE eventsource = 'iam.amazonaws.com'
  AND eventname IN ('CreatePolicy', 'AttachRolePolicy',
                     'AttachUserPolicy', 'PutRolePolicy',
                     'PutUserPolicy')
  AND eventtime > '2024-01-01'
ORDER BY eventtime DESC;
"""

# 2. Detect unauthorized API calls
"""
SELECT eventtime, useridentity.arn, eventsource,
       eventname, errorcode, errormessage,
       sourceipaddress
FROM cloudtrail_logs
WHERE errorcode IN ('AccessDenied', 'UnauthorizedAccess',
                     'Client.UnauthorizedAccess')
  AND eventtime > '2024-01-01'
ORDER BY eventtime DESC
LIMIT 100;
"""

# 3. Detect root account usage
"""
SELECT eventtime, eventname, sourceipaddress,
       useragent, requestparameters
FROM cloudtrail_logs
WHERE useridentity.type = 'Root'
  AND eventtype != 'AwsServiceEvent'
ORDER BY eventtime DESC;
"""

# 4. Detect console login failures
"""
SELECT eventtime, useridentity.arn, sourceipaddress,
       errorcode, errormessage
FROM cloudtrail_logs
WHERE eventname = 'ConsoleLogin'
  AND responseelements LIKE '%Failure%'
ORDER BY eventtime DESC
LIMIT 50;
"""
```

### Security Monitoring with CloudWatch

```python
# CloudWatch metric filters and alarm configuration (Terraform)
"""
# Detect root account usage
resource "aws_cloudwatch_log_metric_filter" "root_usage" {
  name           = "root-account-usage"
  log_group_name = aws_cloudwatch_log_group.cloudtrail.name
  pattern        = "{ $.userIdentity.type = \"Root\" && $.userIdentity.invokedBy NOT EXISTS && $.eventType != \"AwsServiceEvent\" }"

  metric_transformation {
    name      = "RootAccountUsageCount"
    namespace = "SecurityMetrics"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "root_usage_alarm" {
  alarm_name          = "root-account-usage-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "RootAccountUsageCount"
  namespace           = "SecurityMetrics"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Root account was used"
  alarm_actions       = [aws_sns_topic.security_alerts.arn]
}

# Detect console login without MFA
resource "aws_cloudwatch_log_metric_filter" "no_mfa_login" {
  name           = "no-mfa-console-login"
  log_group_name = aws_cloudwatch_log_group.cloudtrail.name
  pattern        = "{ $.eventName = \"ConsoleLogin\" && $.additionalEventData.MFAUsed != \"Yes\" }"

  metric_transformation {
    name      = "NoMFALoginCount"
    namespace = "SecurityMetrics"
    value     = "1"
  }
}

# Detect security group changes
resource "aws_cloudwatch_log_metric_filter" "sg_changes" {
  name           = "security-group-changes"
  log_group_name = aws_cloudwatch_log_group.cloudtrail.name
  pattern        = "{ $.eventName = \"AuthorizeSecurityGroupIngress\" || $.eventName = \"AuthorizeSecurityGroupEgress\" || $.eventName = \"RevokeSecurityGroupIngress\" || $.eventName = \"RevokeSecurityGroupEgress\" || $.eventName = \"CreateSecurityGroup\" || $.eventName = \"DeleteSecurityGroup\" }"

  metric_transformation {
    name      = "SecurityGroupChangeCount"
    namespace = "SecurityMetrics"
    value     = "1"
  }
}

# Detect IAM policy changes
resource "aws_cloudwatch_log_metric_filter" "iam_changes" {
  name           = "iam-policy-changes"
  log_group_name = aws_cloudwatch_log_group.cloudtrail.name
  pattern        = "{ $.eventName = \"CreatePolicy\" || $.eventName = \"DeletePolicy\" || $.eventName = \"AttachRolePolicy\" || $.eventName = \"DetachRolePolicy\" || $.eventName = \"AttachUserPolicy\" || $.eventName = \"DetachUserPolicy\" || $.eventName = \"AttachGroupPolicy\" || $.eventName = \"DetachGroupPolicy\" }"

  metric_transformation {
    name      = "IAMPolicyChangeCount"
    namespace = "SecurityMetrics"
    value     = "1"
  }
}
"""
```

### Compliance Framework Mapping

```
+----------------------------------------------------------+
|  Major Compliance Frameworks                             |
|----------------------------------------------------------|
|                                                          |
|  [CIS Benchmark]                                         |
|  - AWS CIS Benchmark v3.0                                |
|  - Approximately 70 check items across 9 categories      |
|  - Automated checks available via Security Hub           |
|  - Two levels: Level 1 (basic) / Level 2 (advanced)      |
|                                                          |
|  [SOC 2]                                                 |
|  - Security, availability, processing integrity,         |
|    confidentiality, and privacy                          |
|  - Automate evidence collection with AWS Audit Manager   |
|                                                          |
|  [PCI DSS]                                               |
|  - Mandatory for systems handling credit card information |
|  - Focus on network segmentation, encryption, access logs|
|  - Continuous compliance checks with AWS Config Rules    |
|                                                          |
|  [HIPAA]                                                 |
|  - Regulations for protecting medical information (PHI)  |
|  - Requires signing AWS BAA (Business Associate Agreement)|
|  - Encryption and access logs are particularly important |
|                                                          |
|  [GDPR]                                                  |
|  - Protection of EU personal data                        |
|  - Data region restrictions are critical                 |
|  - Support for data deletion (right to be forgotten)     |
+----------------------------------------------------------+
```

---

## 7. Incident Response

### Cloud Incident Response Process

```
+----------------------------------------------------------+
|  Cloud Incident Response Flow                            |
|                                                          |
|  [1. Detection]                                          |
|  +-- GuardDuty alerts                                    |
|  +-- CloudWatch alarms                                   |
|  +-- Security Hub Findings                               |
|  +-- Third-party SIEM alerts                             |
|       |                                                  |
|       v                                                  |
|  [2. Triage]                                             |
|  +-- Severity assessment (High/Medium/Low)               |
|  +-- Identify scope of impact                            |
|  +-- Escalation decision                                 |
|       |                                                  |
|       v                                                  |
|  [3. Containment]                                        |
|  +-- Modify security groups (block traffic)              |
|  +-- Disable IAM credentials                             |
|  +-- Isolate instances (attach to isolation SG)          |
|  +-- ★ Cloud-specific: take snapshots (preserve evidence)|
|       |                                                  |
|       v                                                  |
|  [4. Eradication]                                        |
|  +-- Remove malware                                      |
|  +-- Apply vulnerability patches                         |
|  +-- Rebuild compromised resources                       |
|       |                                                  |
|       v                                                  |
|  [5. Recovery]                                           |
|  +-- Redeploy from clean images                          |
|  +-- Gradually restore traffic                           |
|  +-- Enhance monitoring                                  |
|       |                                                  |
|       v                                                  |
|  [6. Lessons Learned]                                    |
|  +-- Create incident report                              |
|  +-- Root cause analysis (RCA)                           |
|  +-- Implement improvements                              |
|  +-- Update runbooks/playbooks                           |
+----------------------------------------------------------+
```

### Automated Containment Script Example

```python
import boto3
import json
from datetime import datetime

def auto_contain_compromised_instance(instance_id: str, region: str = 'ap-northeast-1'):
    """
    Automated containment of a suspected compromised EC2 instance

    Steps:
    1. Take a snapshot for evidence preservation
    2. Attach to an isolation security group
    3. Record instance metadata
    4. Remove from Auto Scaling Group
    """
    ec2 = boto3.client('ec2', region_name=region)
    timestamp = datetime.utcnow().strftime('%Y%m%d-%H%M%S')

    # 1. Retrieve and record instance information
    instance = ec2.describe_instances(InstanceIds=[instance_id])
    reservation = instance['Reservations'][0]
    instance_detail = reservation['Instances'][0]

    print(f"[{timestamp}] Containing instance: {instance_id}")
    print(f"  Private IP: {instance_detail.get('PrivateIpAddress')}")
    print(f"  Public IP: {instance_detail.get('PublicIpAddress', 'None')}")
    print(f"  VPC: {instance_detail.get('VpcId')}")

    # 2. Take EBS volume snapshots (preserve evidence)
    for volume in instance_detail.get('BlockDeviceMappings', []):
        vol_id = volume['Ebs']['VolumeId']
        snapshot = ec2.create_snapshot(
            VolumeId=vol_id,
            Description=f'Forensic snapshot - {instance_id} - {timestamp}',
            TagSpecifications=[{
                'ResourceType': 'snapshot',
                'Tags': [
                    {'Key': 'Purpose', 'Value': 'forensic-evidence'},
                    {'Key': 'IncidentDate', 'Value': timestamp},
                    {'Key': 'SourceInstance', 'Value': instance_id}
                ]
            }]
        )
        print(f"  Snapshot created: {snapshot['SnapshotId']} for {vol_id}")

    # 3. Create isolation security group (block all traffic)
    vpc_id = instance_detail['VpcId']
    isolation_sg = ec2.create_security_group(
        GroupName=f'isolation-{instance_id}-{timestamp}',
        Description=f'Isolation SG for {instance_id}',
        VpcId=vpc_id
    )
    isolation_sg_id = isolation_sg['GroupId']

    # Remove default egress rule (complete isolation)
    ec2.revoke_security_group_egress(
        GroupId=isolation_sg_id,
        IpPermissions=[{
            'IpProtocol': '-1',
            'IpRanges': [{'CidrIp': '0.0.0.0/0'}]
        }]
    )

    # 4. Switch the security group to the isolation group
    ec2.modify_instance_attribute(
        InstanceId=instance_id,
        Groups=[isolation_sg_id]
    )
    print(f"  Instance isolated with SG: {isolation_sg_id}")

    # 5. Add tags (for investigation)
    ec2.create_tags(
        Resources=[instance_id],
        Tags=[
            {'Key': 'SecurityStatus', 'Value': 'ISOLATED'},
            {'Key': 'IsolationDate', 'Value': timestamp},
            {'Key': 'OriginalSGs', 'Value': json.dumps(
                [sg['GroupId'] for sg in instance_detail.get('SecurityGroups', [])]
            )}
        ]
    )

    print(f"[{timestamp}] Containment complete for {instance_id}")
    return {
        'instance_id': instance_id,
        'isolation_sg': isolation_sg_id,
        'timestamp': timestamp,
        'status': 'CONTAINED'
    }
```

### Emergency IAM Credential Disablement

```python
def emergency_disable_iam_user(username: str):
    """
    Emergency disablement of a suspected compromised IAM user
    """
    iam = boto3.client('iam')
    timestamp = datetime.utcnow().strftime('%Y%m%d-%H%M%S')

    # 1. Disable all access keys
    keys = iam.list_access_keys(UserName=username)
    for key in keys['AccessKeyMetadata']:
        iam.update_access_key(
            UserName=username,
            AccessKeyId=key['AccessKeyId'],
            Status='Inactive'
        )
        print(f"  Disabled access key: {key['AccessKeyId']}")

    # 2. Delete console password
    try:
        iam.delete_login_profile(UserName=username)
        print(f"  Console password deleted")
    except iam.exceptions.NoSuchEntityException:
        print(f"  No console password to delete")

    # 3. Detach all policies
    attached = iam.list_attached_user_policies(UserName=username)
    for policy in attached['AttachedPolicies']:
        iam.detach_user_policy(
            UserName=username,
            PolicyArn=policy['PolicyArn']
        )
        print(f"  Detached policy: {policy['PolicyName']}")

    # 4. Attach explicit Deny policy (double defense)
    deny_policy = {
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Deny",
            "Action": "*",
            "Resource": "*"
        }]
    }

    iam.put_user_policy(
        UserName=username,
        PolicyName=f'EmergencyDeny-{timestamp}',
        PolicyDocument=json.dumps(deny_policy)
    )
    print(f"  Applied explicit deny policy")

    print(f"[{timestamp}] User {username} fully disabled")
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Using the Root Account for Daily Operations

```
Anti-pattern:
  → Logging in with the root user on a daily basis
  → Creating root access keys and using them in scripts

Best practice:
  → Configure MFA for root and use only in emergencies
  → Daily operations via IAM users/roles
  → Do not create root access keys
  → Administrative operations through the Organizations management account
```

### Anti-Pattern 2: Allowing 0.0.0.0/0 in Security Groups

```hcl
# Anti-pattern: expose all ports to the world
resource "aws_security_group_rule" "allow_all" {
  type        = "ingress"
  from_port   = 0
  to_port     = 65535
  protocol    = "tcp"
  cidr_blocks = ["0.0.0.0/0"]
}

# Best practice: restrict to necessary ports and sources only
resource "aws_security_group_rule" "allow_https" {
  type        = "ingress"
  from_port   = 443
  to_port     = 443
  protocol    = "tcp"
  cidr_blocks = ["0.0.0.0/0"]  # HTTPS can be public
}

resource "aws_security_group_rule" "allow_ssh" {
  type        = "ingress"
  from_port   = 22
  to_port     = 22
  protocol    = "tcp"
  cidr_blocks = ["10.0.0.0/8"]  # Internal only
}
```

### Anti-Pattern 3: Using Long-Lived Access Keys

```
Anti-pattern:
  → Hardcoding IAM user access keys in applications
  → Writing access keys in .env files and committing to Git
  → All developers sharing the same access key

Best practice:
  → Attach IAM roles to EC2/Lambda
  → Use aws-vault or SSO for local development
  → Use OIDC federation for CI/CD (e.g., GitHub Actions)

# GitHub Actions OIDC federation example:
"""
# .github/workflows/deploy.yml
jobs:
  deploy:
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsRole
          aws-region: ap-northeast-1
          # No access keys needed; authenticated via OIDC token
"""
```

### Anti-Pattern 4: Unconfigured or Unmonitored Logs

```
Anti-pattern:
  → CloudTrail not enabled
  → Logs enabled but no one reviews them
  → Retention period too short (default 90 days only)
  → Log bucket has no encryption or access restrictions

Best practice:
  → Enable CloudTrail + Config + GuardDuty in all regions
  → Aggregate in Security Hub for unified monitoring
  → Use metric filters and alarms to notify on critical events
  → Long-term storage of logs in S3 (minimum 1 year; extend per legal requirements)
  → Log bucket with KMS encryption + MFA Delete
  → Establish a regular log review process
```

### Anti-Pattern 5: Incomplete Encryption Coverage

```
Anti-pattern:
  → S3 is encrypted but EBS is not
  → At-rest encryption is in place but in-transit (HTTP) is not
  → KMS key rotation is disabled
  → Encryption key access control is too permissive

Best practice:
  → Encrypt all storage (S3, EBS, RDS, EFS)
  → Encrypt all communication with TLS 1.2 or higher
  → Enable automatic KMS key rotation
  → Restrict key usage via key policies
  → Encrypt cross-region data transfer via VPN/PrivateLink
```

---

## 9. Zero Trust Architecture and the Cloud

### Zero Trust Principles

```
+----------------------------------------------------------+
|  5 Zero Trust Principles                                 |
|----------------------------------------------------------|
|                                                          |
|  1. All resource access requires authentication and authorization |
|     - Do not implicitly trust anything inside the network|
|     - Require identity verification for every request    |
|                                                          |
|  2. Access is granted with least privilege               |
|     - Just-In-Time (JIT) access                          |
|     - Grant permissions only for the required duration   |
|                                                          |
|  3. Access is evaluated per session                      |
|     - Device state                                       |
|     - User context (location, time)                      |
|     - Dynamic decisions based on risk score              |
|                                                          |
|  4. Network segmentation (micro-segmentation)            |
|     - Require authentication for service-to-service communication |
|     - Use service mesh (Istio, App Mesh)                 |
|                                                          |
|  5. Record and monitor all activity                      |
|     - Automate anomaly detection                         |
|     - Continuous risk assessment                         |
+----------------------------------------------------------+
```

### Zero Trust Implementation Example in the Cloud

```
+----------------------------------------------------------+
|  Zero Trust Implementation on AWS                        |
|                                                          |
|  [Identity Layer]                                        |
|  IAM Identity Center + MFA                               |
|       |                                                  |
|  [Network Layer]                                         |
|  VPC + PrivateLink + VPC Endpoints                       |
|  (communication that does not traverse the internet)     |
|       |                                                  |
|  [Application Layer]                                     |
|  AWS Verified Access                                     |
|  (Zero trust access without VPN)                         |
|       |                                                  |
|  [Data Layer]                                            |
|  KMS encryption + S3 Access Points                       |
|  + Macie (data classification)                           |
|       |                                                  |
|  [Monitoring Layer]                                      |
|  GuardDuty + Security Hub + CloudTrail                   |
|  (continuous monitoring and threat detection)            |
+----------------------------------------------------------+
```

---

## 10. Exercises

### Exercise 1: IAM Policy Design

Create an IAM policy in JSON that satisfies the following requirements.

```
Requirements:
  - Policy for the development team
  - Operations restricted to ap-northeast-1 region only
  - Ability to start, stop, and reboot EC2 instances
  - However, instances with the tag "Environment=Production" cannot be operated
  - Read and write access to a specific S3 bucket (dev-artifacts)
  - No IAM-related operations allowed
```

<details>
<summary>Answer Example</summary>

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowEC2Operations",
            "Effect": "Allow",
            "Action": [
                "ec2:StartInstances",
                "ec2:StopInstances",
                "ec2:RebootInstances",
                "ec2:DescribeInstances",
                "ec2:DescribeTags"
            ],
            "Resource": "*",
            "Condition": {
                "StringEquals": {
                    "aws:RequestedRegion": "ap-northeast-1"
                }
            }
        },
        {
            "Sid": "DenyProductionEC2",
            "Effect": "Deny",
            "Action": [
                "ec2:StartInstances",
                "ec2:StopInstances",
                "ec2:RebootInstances"
            ],
            "Resource": "*",
            "Condition": {
                "StringEquals": {
                    "ec2:ResourceTag/Environment": "Production"
                }
            }
        },
        {
            "Sid": "AllowS3DevBucket",
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::dev-artifacts",
                "arn:aws:s3:::dev-artifacts/*"
            ]
        },
        {
            "Sid": "DenyIAM",
            "Effect": "Deny",
            "Action": "iam:*",
            "Resource": "*"
        }
    ]
}
```

</details>

### Exercise 2: Security Incident Response

Describe the response steps in chronological order for the following scenario.

```
Scenario:
  GuardDuty detects the following alert
  - Finding Type: UnauthorizedAccess:IAMUser/InstanceCredentialExfiltration.OutsideAWS
  - Severity: High
  - Details: Credentials from the IAM role assigned to EC2 instance (i-0abc123)
             are being used from an IP address outside AWS
```

<details>
<summary>Answer Example</summary>

```
Response Steps:

[Immediate (0-15 minutes)]
1. Review GuardDuty Finding details
   - Identify the external IP address
   - Review the API calls made
   - Identify the affected IAM role

2. Isolate the EC2 instance
   - Change to isolation security group (block all traffic)
   - Do not stop the instance (preserve evidence)
   - Take EBS snapshots

3. Invalidate IAM role credentials
   - Add an explicit Deny to the role's session policy
   - Use aws:TokenIssueTime condition to reject tokens issued before the current time

[Initial Response (15 minutes - 2 hours)]
4. Investigate CloudTrail logs
   - Extract all API calls from the external IP
   - Identify unauthorized operations (data access, permission changes, etc.)
   - Determine scope of impact

5. Check for secondary damage
   - Verify no lateral movement to other resources
   - Review S3 bucket access logs
   - Check for cross-account access to other accounts

[Eradication and Recovery (2 hours - 24 hours)]
6. Identify and remediate the attack vector
   - Enforce IMDS v2 (HttpTokens = required)
   - Fix SSRF vulnerability
   - Apply application vulnerability patches

7. Rebuild in a clean environment
   - Recreate instance from a new AMI
   - Re-review IAM role permissions
   - Verify security group configuration

[Post-Incident (24 hours - 1 week)]
8. Create report and implement improvements
   - Incident report
   - Root cause analysis (RCA)
   - Apply IMDS v2 enforcement to all instances
   - Prepare GuardDuty automated remediation runbooks
```

</details>

### Exercise 3: VPC Network Design

Create a VPC design diagram that meets the following requirements.

```
Requirements:
  - Web application (ALB + ECS Fargate)
  - Database (Aurora PostgreSQL)
  - Multi-AZ (2 AZs)
  - Accept only HTTPS from the internet
  - Database in private subnet only
  - Access AWS services via VPC Endpoint
  - Enable VPC Flow Logs
```

<details>
<summary>Answer Example</summary>

```
VPC: 10.0.0.0/16

AZ-a (ap-northeast-1a)          AZ-c (ap-northeast-1c)
+----------------------------+  +----------------------------+
| Public Subnet              |  | Public Subnet              |
| 10.0.1.0/24               |  | 10.0.4.0/24               |
| +-- ALB Node               |  | +-- ALB Node               |
| +-- NAT Gateway            |  | +-- NAT Gateway            |
| Route: 0.0.0.0/0 → IGW    |  | Route: 0.0.0.0/0 → IGW    |
+----------------------------+  +----------------------------+
| Private Subnet (App)       |  | Private Subnet (App)       |
| 10.0.2.0/24               |  | 10.0.5.0/24               |
| +-- ECS Fargate Tasks      |  | +-- ECS Fargate Tasks      |
| Route: 0.0.0.0/0 → NAT-a  |  | Route: 0.0.0.0/0 → NAT-c  |
+----------------------------+  +----------------------------+
| Private Subnet (Data)      |  | Private Subnet (Data)      |
| 10.0.3.0/24               |  | 10.0.6.0/24               |
| +-- Aurora Primary         |  | +-- Aurora Replica          |
| Route: local only          |  | Route: local only          |
+----------------------------+  +----------------------------+

Security Groups:
  ALB SG: Inbound 443 from 0.0.0.0/0
  App SG: Inbound 8080 from ALB SG
  DB SG:  Inbound 5432 from App SG

VPC Endpoints:
  - Gateway: S3, DynamoDB
  - Interface: ECR (dkr, api), CloudWatch Logs,
               Secrets Manager, KMS

VPC Flow Logs:
  - All traffic (ACCEPT + REJECT)
  - Delivered to CloudWatch Logs
  - Retention period: 90 days
```

</details>

---

## 11. FAQ

### Q1. Is cloud security more secure than an on-premises data center?

Large cloud providers are superior in terms of physical infrastructure security, DDoS protection, and patch application. However, data breaches due to misconfiguration remain the user's responsibility. Data leaks caused by misconfigured S3 bucket public settings continue to occur frequently. Ultimately, the correct understanding is: "Cloud infrastructure is secure, but the configuration within the cloud is your own responsibility."

### Q2. How do you manage security in a multi-cloud environment?

Use a CSPM (Cloud Security Posture Management) tool (such as Prisma Cloud or Wiz) to centrally monitor configuration across multiple clouds. Design a unified IAM policy that accounts for each cloud's characteristics. Manage all environments with common IaC (Terraform) and unify security policies as code. However, multi-cloud increases operational complexity, so a single cloud is recommended unless there is a clear business requirement.

### Q3. What should you do if IAM policies become too complex?

Use AWS IAM Access Analyzer to analyze policies and identify unused permissions. Remove permissions that are granted but not used, and reduce them to the minimum necessary. Design policies on a role basis and avoid inline policies on individual users. Using Permission Boundaries to cap maximum permissions is also effective.

### Q4. What is the difference between IMDS (Instance Metadata Service) v1 and v2?

IMDS v1 accesses instance metadata with a simple HTTP GET, which carries the risk of credential theft via SSRF attacks (as in the Capital One incident). IMDS v2 requires a session token obtained via a PUT method before access, providing a more secure mechanism. It is recommended to configure all instances to allow only IMDS v2.

```python
# Enforce IMDS v2 (Terraform)
"""
resource "aws_instance" "example" {
  # ...
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"  # Allow v2 only
    http_put_response_hop_limit = 1           # Use 2 for containers
  }
}
"""
```

### Q5. How should DDoS protection be handled in the cloud?

Basic DDoS protection is automatically provided by AWS Shield Standard (free). For large-scale attacks, Shield Advanced (paid) provides a DDoS Response Team (DRT) and 24/7 support. The combination of CloudFront + AWS WAF also handles application-layer (L7) attacks. Rate-based rules to automatically block abnormally high request frequencies are also important.

### Q6. What are the container-specific security considerations for ECS/EKS?

```
Key Container Security Checkpoints:
+----------------------------------------------------------+
| Layer          | Countermeasures                         |
|----------------------------------------------------------+
| Image          | ECR image scanning, minimal base image  |
|                | (distroless/alpine), run as non-root     |
| Runtime        | Read-only file system, no privileges     |
|                | (--no-new-privileges)                    |
| Network        | Per-task security groups,                |
|                | service mesh (mTLS)                      |
| Secrets        | Secrets Manager / Parameter Store integration |
| IAM            | Least-privilege task roles               |
| Logging        | CloudWatch output via awslogs driver     |
+----------------------------------------------------------+
```

### Q7. What are the unique security challenges for serverless (Lambda)?

With serverless, OS and middleware management is not required, but security of application code, secret management in environment variables, and execution role permission management are critical. Set Lambda concurrency limits as a DoS countermeasure and run within a VPC for network isolation. Also remember to scan Lambda Layers dependencies for vulnerabilities.

### Q8. How far should cloud security automation be pushed?

Promote automation wherever possible. Specifically, automate the following.

```
Items to Automate:
+----------------------------------------------------------+
| Priority | Item                       | Tool              |
|----------------------------------------------------------+
| Required | IaC (infrastructure as code) | Terraform / CDK |
| Required | Continuous config auditing  | Config Rules / Hub|
| Required | Log collection and aggregation | CloudTrail / Config |
| High     | Vulnerability scanning      | Inspector / ECR Scan |
| High     | Secret rotation             | Secrets Manager   |
| High     | Patch application           | Systems Manager   |
| Medium   | Incident response           | EventBridge + Lambda |
| Medium   | Compliance reporting        | Audit Manager     |
+----------------------------------------------------------+
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next steps.

### Q3: How is this used in practice?

Knowledge of this topic is frequently used in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|------|
| Shared Responsibility Model | Infrastructure is the provider's responsibility; configuration and data are the user's responsibility |
| IAM | Principle of least privilege, role-based, MFA required, leverage ABAC |
| Encryption | Always enable at-rest (KMS) + in-transit (TLS) encryption; use envelope encryption |
| Network | VPC segmentation + VPC Endpoints + Flow Logs |
| Multi-Account | Separate accounts by environment and enforce governance with SCP |
| Monitoring | Always enable CloudTrail + Config + GuardDuty + Security Hub |
| Secret Management | Centralized management with Secrets Manager; automatic rotation |
| Incident Response | Automate the detect → contain → eradicate → recover → learn flow |
| Zero Trust | Trust is based on identity, not network location |
| Compliance | Continuously monitor compliance state with CIS Benchmark + Config Rules |

---

## Next Guides to Read

- [AWS Security](./01-aws-security.md) — Details on AWS-specific security services
- [IaC Security](./02-infrastructure-as-code-security.md) — Automated security checks for infrastructure configuration
- [Key Management](../02-cryptography/02-key-management.md) — Key management techniques including KMS

---

## References

1. **AWS Well-Architected Framework — Security Pillar** — https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/
2. **CIS Benchmarks for Cloud Providers** — https://www.cisecurity.org/cis-benchmarks
3. **NIST SP 800-144 — Guidelines on Security and Privacy in Public Cloud Computing** — https://csrc.nist.gov/publications/detail/sp/800-144/final
4. **CSA Cloud Controls Matrix** — https://cloudsecurityalliance.org/research/cloud-controls-matrix/
5. **AWS Security Best Practices** — https://aws.amazon.com/architecture/security-identity-compliance/
6. **NIST SP 800-207 — Zero Trust Architecture** — https://csrc.nist.gov/publications/detail/sp/800-207/final
7. **AWS IAM Best Practices** — https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html
8. **AWS Incident Response Guide** — https://docs.aws.amazon.com/whitepapers/latest/aws-security-incident-response-guide/
9. **OWASP Cloud Security** — https://owasp.org/www-project-cloud-security/
10. **Google Cloud Security Best Practices** — https://cloud.google.com/security/best-practices

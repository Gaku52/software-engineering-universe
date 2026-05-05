# AWS Account Setup

> Initial setup for using AWS securely and efficiently — from account creation to IAM, MFA, Organizations, billing alerts, and AWS Control Tower

## What You Will Learn in This Chapter

1. Create an AWS account and secure the root user
2. Properly design IAM users, groups, and policies, applying the principle of least privilege
3. Set up AWS Organizations and billing alerts to achieve multi-account operations and cost management
4. Build IAM Identity Center (formerly SSO) and introduce centralized access management
5. Leverage AWS Control Tower to build a well-governed landing zone


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of the content in [Cloud Computing Overview](./00-cloud-overview.md)

---

## 1. Creating an AWS Account

### 1.1 Account Creation Flow

```
+------------------+     +------------------+     +------------------+
| 1. Sign Up       | --> | 2. Contact Info   | --> | 3. Payment Info   |
| Email address    |     | Name/Address/Phone|     | Credit card       |
| Password setup   |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
         |                                                   |
         v                                                   v
+------------------+     +------------------+     +------------------+
| 6. Complete      | <-- | 5. Support Plan   | <-- | 4. Identity      |
| Console login    |     | Basic(free) rec.  |     | verification     |
+------------------+     +------------------+     | SMS/voice auth   |
                                                  +------------------+
```

### 1.2 Best Practices for Account Creation

```bash
# Use a dedicated email address for the root user
# Example: aws-root@example.com (avoid personal emails)

# First things to do after account creation
# 1. Set up MFA for the root user
# 2. Create an IAM administrator user
# 3. Never create access keys for the root user (absolutely never)
# 4. Check the default region and switch to the Tokyo region
# 5. Set up billing alerts
```

### 1.3 Email Address Management Strategy for Account Creation

For large organizations operating multiple AWS accounts, managing email addresses becomes important.

```
Email Address Management Strategy
+----------------------------------------------------------+
|  Pattern 1: Mailing List Approach (Recommended)           |
|  aws-root-prod@example.com -> Delivered to all team       |
|  aws-root-staging@example.com -> Delivered to all team    |
|  aws-root-dev@example.com -> Delivered to all team        |
|                                                           |
|  Pattern 2: Gmail Alias Approach (For Small Scale)        |
|  aws+prod@example.com                                     |
|  aws+staging@example.com                                  |
|  aws+dev@example.com                                      |
|                                                           |
|  Pattern 3: Dedicated Domain Approach (Enterprise)        |
|  root@prod.aws.example.com                                |
|  root@staging.aws.example.com                             |
|  root@dev.aws.example.com                                 |
+----------------------------------------------------------+
```

### 1.4 Post-Account-Creation Security Setup Script

```bash
#!/bin/bash
# AWS Account Initial Security Setup Script
# Prerequisite: Run with IAM administrator user credentials

set -euo pipefail

ACCOUNT_ALIAS="my-company-prod"
ADMIN_USER="admin-user"
ADMIN_GROUP="Administrators"
REGION="ap-northeast-1"

echo "=== Step 1: Set Account Alias ==="
aws iam create-account-alias --account-alias "$ACCOUNT_ALIAS"
echo "Account alias '$ACCOUNT_ALIAS' has been set"

echo "=== Step 2: Set Password Policy ==="
aws iam update-account-password-policy \
  --minimum-password-length 14 \
  --require-symbols \
  --require-numbers \
  --require-uppercase-characters \
  --require-lowercase-characters \
  --allow-users-to-change-password \
  --max-password-age 90 \
  --password-reuse-prevention 12 \
  --hard-expiry
echo "Password policy has been set"

echo "=== Step 3: Create Administrator Group ==="
aws iam create-group --group-name "$ADMIN_GROUP"
aws iam attach-group-policy \
  --group-name "$ADMIN_GROUP" \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
echo "Administrator group '$ADMIN_GROUP' has been created"

echo "=== Step 4: Enable CloudTrail ==="
TRAIL_BUCKET="cloudtrail-logs-$(aws sts get-caller-identity --query Account --output text)"
aws s3 mb "s3://$TRAIL_BUCKET" --region "$REGION" 2>/dev/null || true

# Set bucket policy
cat > /tmp/trail-bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AWSCloudTrailAclCheck",
      "Effect": "Allow",
      "Principal": {"Service": "cloudtrail.amazonaws.com"},
      "Action": "s3:GetBucketAcl",
      "Resource": "arn:aws:s3:::$TRAIL_BUCKET"
    },
    {
      "Sid": "AWSCloudTrailWrite",
      "Effect": "Allow",
      "Principal": {"Service": "cloudtrail.amazonaws.com"},
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::$TRAIL_BUCKET/AWSLogs/*",
      "Condition": {
        "StringEquals": {"s3:x-amz-acl": "bucket-owner-full-control"}
      }
    }
  ]
}
EOF

aws s3api put-bucket-policy \
  --bucket "$TRAIL_BUCKET" \
  --policy file:///tmp/trail-bucket-policy.json

aws cloudtrail create-trail \
  --name management-trail \
  --s3-bucket-name "$TRAIL_BUCKET" \
  --is-multi-region-trail \
  --enable-log-file-validation \
  --include-global-service-events

aws cloudtrail start-logging --name management-trail
echo "CloudTrail has been enabled"

echo "=== Step 5: Enable GuardDuty ==="
aws guardduty create-detector \
  --enable \
  --finding-publishing-frequency FIFTEEN_MINUTES \
  --region "$REGION"
echo "GuardDuty has been enabled"

echo "=== Step 6: Enable EBS Default Encryption ==="
aws ec2 enable-ebs-encryption-by-default --region "$REGION"
echo "EBS default encryption has been enabled"

echo "=== Step 7: S3 Public Access Block (Account Level) ==="
aws s3control put-public-access-block \
  --account-id "$(aws sts get-caller-identity --query Account --output text)" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
echo "S3 public access block has been configured"

echo "=== Initial security setup is complete ==="
```

---

## 2. Protecting the Root User

### 2.1 Root User vs IAM User

| Item | Root User | IAM User |
|------|-----------|----------|
| Creation Timing | Auto-generated at account creation | Manually created by administrator |
| Permissions | Full permissions (cannot be restricted) | Controllable via policies |
| Use Case | Account settings only | Daily operations |
| MFA | Required | Strongly recommended |
| Access Keys | Must not create | Create as needed |
| SCP Restriction | Not possible | Possible |
| Audit Logs | Recorded in CloudTrail | Recorded in CloudTrail |

### 2.2 Operations Only the Root User Can Perform

The following operations can only be performed by the root user and cannot be delegated to IAM users.

```
Root User Exclusive Task List
+-------------------------------------------------------------+
| 1. Account Settings Changes                                  |
|    - Change account name, email address, password            |
|    - Change contact information                              |
|                                                              |
| 2. Billing Related                                           |
|    - Change payment methods                                  |
|    - Enable/disable IAM access to billing information        |
|                                                              |
| 3. Support Plan                                              |
|    - Change support plan                                     |
|                                                              |
| 4. IAM Related                                               |
|    - Create the first IAM administrator user                 |
|    - Account STS region settings                             |
|                                                              |
| 5. Service Specific                                          |
|    - Route 53 domain transfers                               |
|    - Create CloudFront key pairs                             |
|    - Enable S3 bucket MFA Delete                             |
|                                                              |
| 6. Account Closure                                           |
|    - Close the AWS account (irreversible)                    |
+-------------------------------------------------------------+
```

### 2.3 Setting Up MFA (Multi-Factor Authentication)

```bash
# Create a virtual MFA device with AWS CLI
aws iam create-virtual-mfa-device \
  --virtual-mfa-device-name root-mfa \
  --outfile /tmp/QRCode.png \
  --bootstrap-method QRCodePNG

# Enable the MFA device (two TOTP codes required)
aws iam enable-mfa-device \
  --user-name root \
  --serial-number arn:aws:iam::123456789012:mfa/root-mfa \
  --authentication-code1 123456 \
  --authentication-code2 789012
```

### 2.4 MFA Type Comparison

| MFA Type | Security | Convenience | Cost | Recommended Use |
|----------|----------|-------------|------|-----------------|
| Virtual MFA (TOTP) | Medium | High | Free | IAM users |
| FIDO2 Security Key | High | Medium | Paid | Root user |
| Hardware MFA | Highest | Low | Paid | Root/high privilege |
| Passkey | High | High | Free | IAM users (2024 onwards) |

### 2.5 MFA Enforcement Policy

The following is an example policy to enforce MFA usage for all IAM users.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowViewAccountInfo",
      "Effect": "Allow",
      "Action": [
        "iam:GetAccountPasswordPolicy",
        "iam:ListVirtualMFADevices"
      ],
      "Resource": "*"
    },
    {
      "Sid": "AllowManageOwnPasswords",
      "Effect": "Allow",
      "Action": [
        "iam:ChangePassword",
        "iam:GetUser"
      ],
      "Resource": "arn:aws:iam::*:user/${aws:username}"
    },
    {
      "Sid": "AllowManageOwnMFA",
      "Effect": "Allow",
      "Action": [
        "iam:CreateVirtualMFADevice",
        "iam:DeleteVirtualMFADevice",
        "iam:EnableMFADevice",
        "iam:ListMFADevices",
        "iam:ResyncMFADevice"
      ],
      "Resource": [
        "arn:aws:iam::*:mfa/${aws:username}",
        "arn:aws:iam::*:user/${aws:username}"
      ]
    },
    {
      "Sid": "DenyAllExceptListedIfNoMFA",
      "Effect": "Deny",
      "NotAction": [
        "iam:CreateVirtualMFADevice",
        "iam:EnableMFADevice",
        "iam:GetUser",
        "iam:ChangePassword",
        "iam:ListMFADevices",
        "iam:ListVirtualMFADevices",
        "iam:ResyncMFADevice",
        "sts:GetSessionToken"
      ],
      "Resource": "*",
      "Condition": {
        "BoolIfExists": {
          "aws:MultiFactorAuthPresent": "false"
        }
      }
    }
  ]
}
```

### 2.6 Emergency Access Procedure for Root User

The root user credentials should be "stored in a safe" as a rule, but the emergency access procedure should be documented in advance.

```
Root User Emergency Access Procedure (Template)
+-------------------------------------------------------------+
| 1. Preparation                                               |
|    - Root user email: aws-root@example.com                   |
|    - MFA device location: Safe A (Accounting dept floor)     |
|    - Backup MFA location: Safe B (IT dept floor)             |
|                                                              |
| 2. Access Procedure                                          |
|    a. Obtain approval from 2+ approvers (keep email trail)   |
|    b. Retrieve MFA device from safe                          |
|    c. Log in to AWS Console as root user                     |
|    d. Perform required operations (recorded by CloudTrail)   |
|    e. Log out immediately after completion                   |
|    f. Return MFA device to safe                              |
|    g. Document the work and share with team                  |
|                                                              |
| 3. Prohibited Actions                                        |
|    - Do not create root user access keys                     |
|    - Do not change the password (except in emergencies)      |
|    - Do not perform unnecessary operations                   |
+-------------------------------------------------------------+
```

---

## 3. IAM Design

### 3.1 IAM Components

```
AWS IAM Architecture
+------------------------------------------------------+
|  AWS Account                                          |
|                                                       |
|  +----------+  belongs to +----------+                |
|  | IAM User | ---------> | IAM Group|                 |
|  +----------+            +----------+                 |
|       |                      |                        |
|       | (direct or via group) |                       |
|       v                      v                        |
|  +-------------------------------------------+        |
|  |          IAM Policy (JSON)                |        |
|  | {                                         |        |
|  |   "Effect": "Allow",                     |        |
|  |   "Action": "s3:GetObject",              |        |
|  |   "Resource": "arn:aws:s3:::bucket/*"    |        |
|  | }                                         |        |
|  +-------------------------------------------+        |
|                                                       |
|  +----------+                                         |
|  | IAM Role | <-- Assumed by EC2, Lambda, etc.        |
|  +----------+                                         |
+------------------------------------------------------+
```

### 3.2 Types of IAM Policies

| Policy Type | Description | Managed By | Use Case |
|-------------|-------------|------------|----------|
| AWS Managed Policy | Predefined policies provided by AWS | AWS | Common permission patterns |
| Customer Managed Policy | Policies created by users | User | Organization-specific requirements |
| Inline Policy | Embedded directly in an entity | User | 1:1 permissions (not recommended) |
| Service Control Policy (SCP) | Used with Organizations | Administrator | Account-wide guardrails |
| Permissions Boundary | Upper limit of IAM entity permissions | Administrator | Safe permission delegation |
| Session Policy | Specified during AssumeRole | Caller | Temporary permission restriction |
| Resource-Based Policy | Attached directly to a resource | Resource Owner | Cross-account access |

### 3.3 Code Example: Creating IAM Users and Groups

```bash
# Create a developer group
aws iam create-group --group-name Developers

# Attach IAM policy
aws iam attach-group-policy \
  --group-name Developers \
  --policy-arn arn:aws:iam::aws:policy/PowerUserAccess

# Create an IAM user
aws iam create-user --user-name tanaka

# Add user to group
aws iam add-user-to-group \
  --user-name tanaka \
  --group-name Developers

# Create login profile (password)
aws iam create-login-profile \
  --user-name tanaka \
  --password 'TempP@ssw0rd!' \
  --password-reset-required

# Add tags (department, team information)
aws iam tag-user \
  --user-name tanaka \
  --tags \
    Key=Department,Value=Engineering \
    Key=Team,Value=Backend \
    Key=CostCenter,Value=CC-001
```

### 3.4 Code Example: Custom IAM Policy (JSON)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowS3ReadOnly",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-app-bucket",
        "arn:aws:s3:::my-app-bucket/*"
      ]
    },
    {
      "Sid": "DenyDeleteBucket",
      "Effect": "Deny",
      "Action": "s3:DeleteBucket",
      "Resource": "*"
    }
  ]
}
```

### 3.5 Code Example: Conditional Policy (Advanced Control)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowEC2InTokyoRegionOnly",
      "Effect": "Allow",
      "Action": "ec2:*",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "ap-northeast-1"
        }
      }
    },
    {
      "Sid": "DenyEC2TerminateWithoutMFA",
      "Effect": "Deny",
      "Action": "ec2:TerminateInstances",
      "Resource": "*",
      "Condition": {
        "BoolIfExists": {
          "aws:MultiFactorAuthPresent": "false"
        }
      }
    },
    {
      "Sid": "AllowActionsOnlyDuringBusinessHours",
      "Effect": "Deny",
      "Action": [
        "rds:DeleteDBInstance",
        "rds:DeleteDBCluster"
      ],
      "Resource": "*",
      "Condition": {
        "DateGreaterThan": {
          "aws:CurrentTime": "2025-01-01T18:00:00Z"
        },
        "DateLessThan": {
          "aws:CurrentTime": "2025-01-02T09:00:00Z"
        }
      }
    },
    {
      "Sid": "RestrictBySourceIP",
      "Effect": "Deny",
      "Action": "*",
      "Resource": "*",
      "Condition": {
        "NotIpAddress": {
          "aws:SourceIp": [
            "203.0.113.0/24",
            "198.51.100.0/24"
          ]
        },
        "Bool": {
          "aws:ViaAWSService": "false"
        }
      }
    }
  ]
}
```

### 3.6 Code Example: Creating an IAM Role (For EC2)

```bash
# Create a trust policy
cat > trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"Service": "ec2.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create the role
aws iam create-role \
  --role-name EC2-S3-ReadOnly \
  --assume-role-policy-document file://trust-policy.json

# Attach a policy
aws iam attach-role-policy \
  --role-name EC2-S3-ReadOnly \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess

# Create an instance profile and associate the role
aws iam create-instance-profile \
  --instance-profile-name EC2-S3-ReadOnly-Profile
aws iam add-role-to-instance-profile \
  --instance-profile-name EC2-S3-ReadOnly-Profile \
  --role-name EC2-S3-ReadOnly
```

### 3.7 Code Example: Creating a Cross-Account Role

```bash
# Create a role in Account B (target)
# Trust policy allowing access from Account A (caller)
cat > cross-account-trust.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::111111111111:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "my-external-id-12345"
        }
      }
    }
  ]
}
EOF

aws iam create-role \
  --role-name CrossAccountReadOnly \
  --assume-role-policy-document file://cross-account-trust.json

aws iam attach-role-policy \
  --role-name CrossAccountReadOnly \
  --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess

# Assume the role from Account A (caller)
aws sts assume-role \
  --role-arn arn:aws:iam::222222222222:role/CrossAccountReadOnly \
  --role-session-name cross-account-session \
  --external-id my-external-id-12345
```

### 3.8 Permissions Boundary

A permissions boundary is a mechanism that limits the maximum permissions an IAM entity can have. It is important for safely delegating permissions.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowedServices",
      "Effect": "Allow",
      "Action": [
        "s3:*",
        "dynamodb:*",
        "lambda:*",
        "logs:*",
        "cloudwatch:*",
        "sqs:*",
        "sns:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "DenyDangerousActions",
      "Effect": "Deny",
      "Action": [
        "iam:CreateUser",
        "iam:DeleteUser",
        "iam:CreateRole",
        "iam:DeleteRole",
        "organizations:*",
        "account:*"
      ],
      "Resource": "*"
    }
  ]
}
```

```bash
# Set permissions boundary on a user
aws iam put-user-permissions-boundary \
  --user-name developer-tanaka \
  --permissions-boundary arn:aws:iam::123456789012:policy/DeveloperBoundary

# Set permissions boundary on a role
aws iam put-role-permissions-boundary \
  --role-name LambdaExecutionRole \
  --permissions-boundary arn:aws:iam::123456789012:policy/LambdaBoundary
```

### 3.9 Principle of Least Privilege

```
Permission Design Approach
+------------------------------------------+
|                                          |
|  1. Start with minimum required perms    |
|     |                                    |
|  2. Detect gaps with IAM Access Analyzer |
|     |                                    |
|  3. Add only the necessary permissions   |
|     |                                    |
|  4. Periodically audit unused perms      |
|     |                                    |
|  5. Remove unnecessary permissions       |
|                                          |
|  * Do not casually grant                 |
|    "AdministratorAccess"                 |
+------------------------------------------+
```

### 3.10 Leveraging IAM Access Analyzer

```bash
# Create an Access Analyzer (account level)
aws accessanalyzer create-analyzer \
  --analyzer-name account-analyzer \
  --type ACCOUNT

# Check findings (externally accessible resources)
aws accessanalyzer list-findings \
  --analyzer-arn arn:aws:access-analyzer:ap-northeast-1:123456789012:analyzer/account-analyzer \
  --query 'findings[].{Resource:resource,ResourceType:resourceType,Status:status}' \
  --output table

# Policy generation (generate least-privilege policy from CloudTrail logs)
aws accessanalyzer start-policy-generation \
  --policy-generation-details '{
    "principalArn": "arn:aws:iam::123456789012:role/MyAppRole",
    "cloudTrailDetails": {
      "trails": [
        {
          "cloudTrailArn": "arn:aws:cloudtrail:ap-northeast-1:123456789012:trail/management-trail",
          "regions": ["ap-northeast-1"],
          "allRegions": false
        }
      ],
      "accessRole": "arn:aws:iam::123456789012:role/AccessAnalyzerRole",
      "startTime": "2025-01-01T00:00:00Z",
      "endTime": "2025-02-01T00:00:00Z"
    }
  }'

# Detect unused access keys and passwords
aws accessanalyzer create-analyzer \
  --analyzer-name unused-access-analyzer \
  --type ACCOUNT_UNUSED_ACCESS \
  --configuration '{
    "unusedAccess": {
      "unusedAccessAge": 90
    }
  }'
```

---

## 4. IAM Identity Center (Formerly AWS SSO)

### 4.1 IAM Identity Center Overview

```
IAM Identity Center Architecture
+----------------------------------------------------------+
|  AWS Organizations (Management Account)                    |
|                                                           |
|  +----------------------------------------------------+  |
|  |  IAM Identity Center                                |  |
|  |                                                     |  |
|  |  +----------------+    +------------------------+   |  |
|  |  | ID Source       |    | Permission Sets        |  |  |
|  |  | - Identity Center|   | - AdministratorAccess  |  |  |
|  |  | - Active Dir.   |    | - PowerUserAccess      |  |  |
|  |  | - External IdP  |    | - ViewOnlyAccess       |  |  |
|  |  +----------------+    | - Custom Perm. Sets    |  |  |
|  |                        +------------------------+   |  |
|  |  Users/Groups <- Permission Sets -> AWS Accounts     |  |
|  +----------------------------------------------------+  |
|                                                           |
|  +-------------------+  +-------------------+             |
|  | Production Account|  | Development Account|            |
|  +-------------------+  +-------------------+             |
+----------------------------------------------------------+
```

### 4.2 Setting Up IAM Identity Center

```bash
# Create an IAM Identity Center instance
aws sso-admin create-instance --name "my-org-sso"

# Create a permission set
aws sso-admin create-permission-set \
  --instance-arn arn:aws:sso:::instance/ssoins-xxxx \
  --name "DeveloperAccess" \
  --description "Developer team access" \
  --session-duration "PT8H" \
  --relay-state ""

# Attach a managed policy
aws sso-admin attach-managed-policy-to-permission-set \
  --instance-arn arn:aws:sso:::instance/ssoins-xxxx \
  --permission-set-arn arn:aws:sso:::permissionSet/ssoins-xxxx/ps-xxxx \
  --managed-policy-arn arn:aws:iam::aws:policy/PowerUserAccess

# Attach a custom inline policy
aws sso-admin put-inline-policy-to-permission-set \
  --instance-arn arn:aws:sso:::instance/ssoins-xxxx \
  --permission-set-arn arn:aws:sso:::permissionSet/ssoins-xxxx/ps-xxxx \
  --inline-policy '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Deny",
        "Action": [
          "iam:CreateUser",
          "iam:DeleteUser",
          "organizations:*"
        ],
        "Resource": "*"
      }
    ]
  }'

# Assign permission set to an account
aws sso-admin create-account-assignment \
  --instance-arn arn:aws:sso:::instance/ssoins-xxxx \
  --target-id 123456789012 \
  --target-type AWS_ACCOUNT \
  --permission-set-arn arn:aws:sso:::permissionSet/ssoins-xxxx/ps-xxxx \
  --principal-type GROUP \
  --principal-id "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 4.3 Integration with External IdP (SAML 2.0)

```
External IdP Integration Flow
+----------------------------------------------------------+
|                                                           |
|  1. User accesses AWS access portal                      |
|     |                                                     |
|  2. IAM Identity Center -> Redirects to external IdP     |
|     |                                                     |
|  3. Authenticates at external IdP (including MFA)        |
|     |                                                     |
|  4. Returns SAML assertion to IAM Identity Center        |
|     |                                                     |
|  5. IAM Identity Center issues temporary credentials     |
|     |                                                     |
|  6. User selects AWS account/role                        |
|                                                           |
|  Supported IdPs:                                          |
|  - Azure AD (Entra ID)                                    |
|  - Okta                                                   |
|  - Google Workspace                                       |
|  - OneLogin                                               |
|  - Ping Identity                                          |
+----------------------------------------------------------+
```

---

## 5. AWS Organizations

### 5.1 Multi-Account Strategy

```
AWS Organizations Configuration Example
+----------------------------------------------------+
| Management Account (Consolidated billing/governance) |
|                                                     |
| +-- OU: Security                                    |
| |   +-- Log Archive Account (CloudTrail, Config)    |
| |   +-- Security Tooling Account (GuardDuty, etc.)  |
| |                                                   |
| +-- OU: Infrastructure                              |
| |   +-- Network Account (Transit Gateway, VPN)      |
| |   +-- Shared Services Account (CI/CD, ECR)        |
| |                                                   |
| +-- OU: Workloads                                   |
| |   +-- Production Account                          |
| |   +-- Staging Account                             |
| |   +-- Development Account                         |
| |                                                   |
| +-- OU: Sandbox                                     |
|     +-- Developer Sandbox Account                   |
+----------------------------------------------------+
```

### 5.2 Code Example: Organizations Operations

```bash
# Create an organization
aws organizations create-organization --feature-set ALL

# Create OUs (Organizational Units)
ROOT_ID=$(aws organizations list-roots --query 'Roots[0].Id' --output text)

aws organizations create-organizational-unit \
  --parent-id "$ROOT_ID" \
  --name "Security"

aws organizations create-organizational-unit \
  --parent-id "$ROOT_ID" \
  --name "Infrastructure"

aws organizations create-organizational-unit \
  --parent-id "$ROOT_ID" \
  --name "Workloads"

aws organizations create-organizational-unit \
  --parent-id "$ROOT_ID" \
  --name "Sandbox"

# Create a new member account
aws organizations create-account \
  --email prod@example.com \
  --account-name "Production"

# Attach an SCP (Service Control Policy)
aws organizations attach-policy \
  --policy-id p-xxxx \
  --target-id ou-xxxx

# List OUs
aws organizations list-organizational-units-for-parent \
  --parent-id "$ROOT_ID" \
  --query 'OrganizationalUnits[].[Id,Name]' \
  --output table

# List accounts
aws organizations list-accounts \
  --query 'Accounts[].[Id,Name,Email,Status]' \
  --output table
```

### 5.3 Service Control Policy (SCP) Example

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyLeaveOrganization",
      "Effect": "Deny",
      "Action": "organizations:LeaveOrganization",
      "Resource": "*"
    },
    {
      "Sid": "RestrictRegions",
      "Effect": "Deny",
      "NotAction": [
        "iam:*",
        "sts:*",
        "organizations:*",
        "support:*",
        "budgets:*",
        "health:*",
        "ce:*"
      ],
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "aws:RequestedRegion": [
            "ap-northeast-1",
            "us-east-1"
          ]
        }
      }
    }
  ]
}
```

### 5.4 SCP Best Practices Collection

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyRootUserActions",
      "Effect": "Deny",
      "Action": "*",
      "Resource": "*",
      "Condition": {
        "StringLike": {
          "aws:PrincipalArn": "arn:aws:iam::*:root"
        }
      }
    },
    {
      "Sid": "ProtectCloudTrail",
      "Effect": "Deny",
      "Action": [
        "cloudtrail:StopLogging",
        "cloudtrail:DeleteTrail",
        "cloudtrail:UpdateTrail"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ProtectGuardDuty",
      "Effect": "Deny",
      "Action": [
        "guardduty:DeleteDetector",
        "guardduty:DisassociateFromMasterAccount",
        "guardduty:UpdateDetector"
      ],
      "Resource": "*"
    },
    {
      "Sid": "DenyPublicS3",
      "Effect": "Deny",
      "Action": "s3:PutBucketPublicAccessBlock",
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "s3:publicAccessBlockConfiguration/BlockPublicAcls": "true"
        }
      }
    },
    {
      "Sid": "RequireEncryptedVolumes",
      "Effect": "Deny",
      "Action": "ec2:CreateVolume",
      "Resource": "*",
      "Condition": {
        "Bool": {
          "ec2:Encrypted": "false"
        }
      }
    },
    {
      "Sid": "DenyLargeInstances",
      "Effect": "Deny",
      "Action": "ec2:RunInstances",
      "Resource": "arn:aws:ec2:*:*:instance/*",
      "Condition": {
        "ForAnyValue:StringLike": {
          "ec2:InstanceType": [
            "*.8xlarge",
            "*.12xlarge",
            "*.16xlarge",
            "*.24xlarge",
            "*.metal",
            "p4*",
            "p5*"
          ]
        }
      }
    }
  ]
}
```

---

## 6. AWS Control Tower

### 6.1 Control Tower Overview

AWS Control Tower is a service that automatically builds a multi-account environment (landing zone) based on AWS best practices.

```
Control Tower Landing Zone
+----------------------------------------------------------+
|  Management Account                                       |
|  +-- AWS Control Tower                                    |
|  +-- AWS Organizations                                    |
|  +-- AWS Service Catalog                                  |
|  +-- AWS CloudFormation StackSets                         |
|                                                           |
|  OU: Security                                             |
|  +-- Log Archive Account                                  |
|  |   +-- CloudTrail logs (all accounts)                   |
|  |   +-- AWS Config logs (all accounts)                   |
|  |   +-- VPC Flow Logs                                    |
|  +-- Audit Account                                        |
|      +-- SNS notifications                                |
|      +-- AWS Config Aggregator                            |
|      +-- Security Hub                                     |
|                                                           |
|  OU: Sandbox (Custom OU)                                  |
|  +-- Developer Sandbox Accounts                           |
|                                                           |
|  OU: Workloads (Custom OU)                                |
|  +-- Production Accounts                                  |
|  +-- Development Accounts                                 |
+----------------------------------------------------------+
```

### 6.2 Guardrails (Controls)

```
Guardrail Classification
+----------------------------------------------------------+
|  Preventive - Block prohibited actions via SCPs            |
|  +-- Prevent disabling CloudTrail                         |
|  +-- Prevent public access to S3 buckets                  |
|  +-- Prevent root user access key creation                |
|  +-- Region restrictions                                  |
|                                                           |
|  Detective - Detect violations via AWS Config Rules        |
|  +-- Detect users without MFA                             |
|  +-- Detect unencrypted EBS volumes                       |
|  +-- Detect EC2 instances with public IPs                 |
|  +-- Detect unused access keys                            |
|                                                           |
|  Proactive - Pre-check via CloudFormation Hooks            |
|  +-- Verify IMDSv2 is required for EC2                    |
|  +-- Verify RDS is encrypted                              |
|  +-- Verify Lambda is in a VPC                            |
+----------------------------------------------------------+
```

---

## 7. Billing Alerts and Cost Management

### 7.1 Code Example: Setting Up Billing Alerts (CloudWatch)

```bash
# Enable billing metrics (must be enabled in console first)
# Billing > Billing Preferences > Receive Billing Alerts

# Create an SNS topic
aws sns create-topic --name billing-alerts
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789012:billing-alerts \
  --protocol email \
  --notification-endpoint admin@example.com

# Create a CloudWatch billing alarm (notify when monthly exceeds $50)
aws cloudwatch put-metric-alarm \
  --alarm-name "MonthlyBillingAlarm-50USD" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 21600 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:billing-alerts \
  --dimensions Name=Currency,Value=USD \
  --region us-east-1

# Tiered alarms ($100, $200, $500)
for threshold in 100 200 500; do
  aws cloudwatch put-metric-alarm \
    --alarm-name "MonthlyBillingAlarm-${threshold}USD" \
    --metric-name EstimatedCharges \
    --namespace AWS/Billing \
    --statistic Maximum \
    --period 21600 \
    --threshold "$threshold" \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 1 \
    --alarm-actions arn:aws:sns:us-east-1:123456789012:billing-alerts \
    --dimensions Name=Currency,Value=USD \
    --region us-east-1
done
```

### 7.2 Setting Up AWS Budgets

```bash
# Create a monthly budget ($100 budget, notify at 80%)
aws budgets create-budget \
  --account-id 123456789012 \
  --budget '{
    "BudgetName": "MonthlyBudget",
    "BudgetLimit": {"Amount": "100", "Unit": "USD"},
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }' \
  --notifications-with-subscribers '[
    {
      "Notification": {
        "NotificationType": "ACTUAL",
        "ComparisonOperator": "GREATER_THAN",
        "Threshold": 80,
        "ThresholdType": "PERCENTAGE"
      },
      "Subscribers": [
        {
          "SubscriptionType": "EMAIL",
          "Address": "admin@example.com"
        }
      ]
    },
    {
      "Notification": {
        "NotificationType": "FORECASTED",
        "ComparisonOperator": "GREATER_THAN",
        "Threshold": 100,
        "ThresholdType": "PERCENTAGE"
      },
      "Subscribers": [
        {
          "SubscriptionType": "EMAIL",
          "Address": "admin@example.com"
        }
      ]
    }
  ]'

# Create a per-service budget
aws budgets create-budget \
  --account-id 123456789012 \
  --budget '{
    "BudgetName": "EC2-MonthlyBudget",
    "BudgetLimit": {"Amount": "50", "Unit": "USD"},
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST",
    "CostFilters": {
      "Service": ["Amazon Elastic Compute Cloud - Compute"]
    }
  }' \
  --notifications-with-subscribers '[
    {
      "Notification": {
        "NotificationType": "ACTUAL",
        "ComparisonOperator": "GREATER_THAN",
        "Threshold": 80,
        "ThresholdType": "PERCENTAGE"
      },
      "Subscribers": [
        {
          "SubscriptionType": "EMAIL",
          "Address": "admin@example.com"
        }
      ]
    }
  ]'
```

### 7.3 Leveraging AWS Cost Explorer

```bash
# Service-wise cost for the past 30 days
aws ce get-cost-and-usage \
  --time-period Start=$(date -v-30d +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --query 'ResultsByTime[].Groups[?Metrics.BlendedCost.Amount > `1.0`].{Service:Keys[0],Cost:Metrics.BlendedCost.Amount}' \
  --output table

# Daily cost trend
aws ce get-cost-and-usage \
  --time-period Start=$(date -v-7d +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --query 'ResultsByTime[].{Date:TimePeriod.Start,Cost:Total.BlendedCost.Amount}' \
  --output table

# Cost forecast (projected value at end of month)
aws ce get-cost-forecast \
  --time-period Start=$(date +%Y-%m-%d),End=$(date -v+1m -v1d -v-1d +%Y-%m-%d) \
  --metric BLENDED_COST \
  --granularity MONTHLY
```

### 7.4 Cost Anomaly Detection

```bash
# Create a cost anomaly detection monitor
aws ce create-anomaly-monitor \
  --anomaly-monitor '{
    "MonitorName": "ServiceMonitor",
    "MonitorType": "DIMENSIONAL",
    "MonitorDimension": "SERVICE"
  }'

# Create a subscription (notification destination)
aws ce create-anomaly-subscription \
  --anomaly-subscription '{
    "SubscriptionName": "CostAnomalyAlerts",
    "MonitorArnList": ["arn:aws:ce::123456789012:anomalymonitor/xxxx"],
    "Subscribers": [
      {
        "Address": "admin@example.com",
        "Type": "EMAIL"
      }
    ],
    "Threshold": 10.0,
    "Frequency": "DAILY"
  }'
```

---

## 8. Managing IAM Resources as IaC with CloudFormation

### 8.1 CloudFormation Template for IAM Users, Groups, and Policies

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'IAM Initial Setup - Create Users, Groups, and Policies'

Parameters:
  EnvironmentName:
    Type: String
    Default: production
    AllowedValues: [production, staging, development]

Resources:
  # Password Policy
  # Cannot be set directly with CloudFormation; requires a custom resource

  # Administrator Group
  AdminGroup:
    Type: AWS::IAM::Group
    Properties:
      GroupName: !Sub '${EnvironmentName}-administrators'
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/AdministratorAccess

  # Developer Group
  DeveloperGroup:
    Type: AWS::IAM::Group
    Properties:
      GroupName: !Sub '${EnvironmentName}-developers'
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/PowerUserAccess
      Policies:
        - PolicyName: DenyIAMAndOrganizations
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Deny
                Action:
                  - 'iam:CreateUser'
                  - 'iam:DeleteUser'
                  - 'iam:CreateRole'
                  - 'iam:DeleteRole'
                  - 'organizations:*'
                Resource: '*'

  # Read-Only Group
  ReadOnlyGroup:
    Type: AWS::IAM::Group
    Properties:
      GroupName: !Sub '${EnvironmentName}-readonly'
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/ReadOnlyAccess

  # MFA Enforcement Policy
  MFAEnforcementPolicy:
    Type: AWS::IAM::ManagedPolicy
    Properties:
      ManagedPolicyName: !Sub '${EnvironmentName}-mfa-enforcement'
      Groups:
        - !Ref DeveloperGroup
        - !Ref ReadOnlyGroup
      PolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Sid: AllowManageOwnMFA
            Effect: Allow
            Action:
              - 'iam:CreateVirtualMFADevice'
              - 'iam:EnableMFADevice'
              - 'iam:ListMFADevices'
              - 'iam:ResyncMFADevice'
            Resource:
              - !Sub 'arn:aws:iam::${AWS::AccountId}:mfa/${!aws:username}'
              - !Sub 'arn:aws:iam::${AWS::AccountId}:user/${!aws:username}'
          - Sid: DenyWithoutMFA
            Effect: Deny
            NotAction:
              - 'iam:CreateVirtualMFADevice'
              - 'iam:EnableMFADevice'
              - 'iam:ListMFADevices'
              - 'iam:GetUser'
              - 'iam:ChangePassword'
              - 'sts:GetSessionToken'
            Resource: '*'
            Condition:
              BoolIfExists:
                'aws:MultiFactorAuthPresent': 'false'

  # EC2 Role
  EC2WebServerRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Sub '${EnvironmentName}-ec2-webserver'
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: ec2.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess
        - arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy

  EC2WebServerInstanceProfile:
    Type: AWS::IAM::InstanceProfile
    Properties:
      InstanceProfileName: !Sub '${EnvironmentName}-ec2-webserver-profile'
      Roles:
        - !Ref EC2WebServerRole

Outputs:
  AdminGroupArn:
    Value: !GetAtt AdminGroup.Arn
    Export:
      Name: !Sub '${EnvironmentName}-admin-group-arn'
  DeveloperGroupArn:
    Value: !GetAtt DeveloperGroup.Arn
    Export:
      Name: !Sub '${EnvironmentName}-developer-group-arn'
  EC2WebServerRoleArn:
    Value: !GetAtt EC2WebServerRole.Arn
    Export:
      Name: !Sub '${EnvironmentName}-ec2-webserver-role-arn'
```

### 8.2 IAM Configuration with AWS CDK

```typescript
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class IamSetupStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Developer group
    const developerGroup = new iam.Group(this, 'DeveloperGroup', {
      groupName: 'developers',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('PowerUserAccess'),
      ],
    });

    // Custom policy
    const restrictedPolicy = new iam.ManagedPolicy(this, 'RestrictedPolicy', {
      managedPolicyName: 'developer-restrictions',
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.DENY,
          actions: [
            'iam:CreateUser',
            'iam:DeleteUser',
            'organizations:*',
          ],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.DENY,
          actions: ['ec2:*'],
          resources: ['*'],
          conditions: {
            StringNotEquals: {
              'aws:RequestedRegion': ['ap-northeast-1', 'us-east-1'],
            },
          },
        }),
      ],
    });
    developerGroup.addManagedPolicy(restrictedPolicy);

    // EC2 role
    const ec2Role = new iam.Role(this, 'EC2WebServerRole', {
      roleName: 'ec2-webserver-role',
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      ],
      maxSessionDuration: cdk.Duration.hours(4),
    });

    // Lambda execution role
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      roleName: 'lambda-execution-role',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        ),
      ],
      inlinePolicies: {
        dynamoAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:Query',
              ],
              resources: [
                `arn:aws:dynamodb:${this.region}:${this.account}:table/MyTable`,
              ],
            }),
          ],
        }),
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'EC2RoleArn', {
      value: ec2Role.roleArn,
      exportName: 'ec2-webserver-role-arn',
    });
  }
}
```

---

## 9. Initial Setup Checklist

| # | Task | Priority | Category | Done |
|---|------|----------|----------|------|
| 1 | Set up MFA for root user | Required | Security | [ ] |
| 2 | Delete/verify no root user access keys exist | Required | Security | [ ] |
| 3 | Create IAM administrator user | Required | Security | [ ] |
| 4 | Set password policy | Required | Security | [ ] |
| 5 | Create IAM groups and attach policies | High | IAM | [ ] |
| 6 | Set account alias | High | Account | [ ] |
| 7 | Enable CloudTrail | High | Audit | [ ] |
| 8 | Set up billing alerts | High | Cost | [ ] |
| 9 | Set up AWS Budgets | High | Cost | [ ] |
| 10 | Enable AWS Config | Medium | Compliance | [ ] |
| 11 | Enable GuardDuty | Medium | Security | [ ] |
| 12 | Enable Security Hub | Medium | Security | [ ] |
| 13 | Enable EBS default encryption | Medium | Security | [ ] |
| 14 | S3 public access block (account level) | Medium | Security | [ ] |
| 15 | Environment isolation with Organizations | Medium | Governance | [ ] |
| 16 | Set up IAM Identity Center | Medium | IAM | [ ] |
| 17 | Set up cost anomaly detection | Low | Cost | [ ] |
| 18 | Enable VPC Flow Logs | Low | Audit | [ ] |

---

## 10. IAM Management with Terraform

### 10.1 IAM Module

```hcl
# main.tf
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "ap-northeast-1"
}

# IAM Groups
resource "aws_iam_group" "developers" {
  name = "developers"
  path = "/teams/"
}

resource "aws_iam_group" "readonly" {
  name = "readonly"
  path = "/teams/"
}

# Group policy attachments
resource "aws_iam_group_policy_attachment" "developers_power_user" {
  group      = aws_iam_group.developers.name
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
}

resource "aws_iam_group_policy_attachment" "readonly_access" {
  group      = aws_iam_group.readonly.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

# Custom policy
resource "aws_iam_policy" "developer_restrictions" {
  name        = "developer-restrictions"
  description = "Developer permission restrictions"
  policy      = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyDangerousActions"
        Effect = "Deny"
        Action = [
          "iam:CreateUser",
          "iam:DeleteUser",
          "iam:CreateRole",
          "iam:DeleteRole",
          "organizations:*",
        ]
        Resource = "*"
      },
      {
        Sid    = "RestrictRegions"
        Effect = "Deny"
        NotAction = [
          "iam:*",
          "sts:*",
          "support:*",
        ]
        Resource = "*"
        Condition = {
          StringNotEquals = {
            "aws:RequestedRegion" = ["ap-northeast-1", "us-east-1"]
          }
        }
      }
    ]
  })
}

resource "aws_iam_group_policy_attachment" "developers_restrictions" {
  group      = aws_iam_group.developers.name
  policy_arn = aws_iam_policy.developer_restrictions.arn
}

# EC2 Role
resource "aws_iam_role" "ec2_webserver" {
  name = "ec2-webserver-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "ec2.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })
  max_session_duration = 14400  # 4 hours
}

resource "aws_iam_role_policy_attachment" "ec2_s3_readonly" {
  role       = aws_iam_role.ec2_webserver.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"
}

resource "aws_iam_instance_profile" "ec2_webserver" {
  name = "ec2-webserver-profile"
  role = aws_iam_role.ec2_webserver.name
}

# Password policy
resource "aws_iam_account_password_policy" "strict" {
  minimum_password_length        = 14
  require_lowercase_characters   = true
  require_numbers                = true
  require_uppercase_characters   = true
  require_symbols                = true
  allow_users_to_change_password = true
  max_password_age               = 90
  password_reuse_prevention      = 12
  hard_expiry                    = true
}

# Outputs
output "ec2_webserver_role_arn" {
  value       = aws_iam_role.ec2_webserver.arn
  description = "ARN of the EC2 Web Server role"
}
```

---

## 11. Anti-Patterns

### Anti-Pattern 1: Using the Root User for Daily Operations

The root user's permissions cannot be restricted, so the risk from misoperations or credential leaks is enormous. Except for account settings changes (payment information, account closure), you should operate with IAM users or IAM Identity Center (SSO).

```
# Bad example
Operating EC2 daily with the root user
->
# Good example
Operating with IAM user (MFA enabled)
Root user stored in a safe (physical MFA recommended)
```

### Anti-Pattern 2: Leaving IAM User Access Keys for Extended Periods

Access keys carry a risk of leakage, so they should be rotated every 90 days and unnecessary keys should be deleted immediately. Where possible, use IAM roles (temporary credentials) instead.

```bash
# Check when an access key was last used
aws iam get-access-key-last-used \
  --access-key-id AKIAIOSFODNN7EXAMPLE

# List keys unused for 90+ days
aws iam list-access-keys --user-name tanaka
# -> Check CreateDate and disable -> delete old keys

# Access key rotation script
#!/bin/bash
USER_NAME="tanaka"
OLD_KEY_ID=$(aws iam list-access-keys --user-name "$USER_NAME" \
  --query 'AccessKeyMetadata[0].AccessKeyId' --output text)

# Create a new key
NEW_KEY=$(aws iam create-access-key --user-name "$USER_NAME")
echo "New access key: $(echo $NEW_KEY | jq -r '.AccessKey.AccessKeyId')"

# Delete the old key after configuring the new key in your application
# aws iam delete-access-key --user-name "$USER_NAME" --access-key-id "$OLD_KEY_ID"
```

### Anti-Pattern 3: Granting AdministratorAccess to Everyone

Granting administrator permissions to everyone in favor of development speed is dangerous. Design permissions based on roles following the principle of least privilege.

```
# Bad example
All developers -> AdministratorAccess
-> Risk of accidentally deleting the production DB

# Good example
Developers -> PowerUserAccess + custom restrictions
SRE        -> AdministratorAccess (limited members only)
QA         -> ReadOnlyAccess + test environment operation permissions
```

### Anti-Pattern 4: Running All Environments in a Single Account

Running production, staging, and development environments in a single account makes permission isolation difficult and creates the risk that mistakes in the development environment affect production.

```
# Bad example
One account with prod, staging, dev resources mixed together
-> Distinguished by tags (risk of forgotten tags)

# Good example
Separate accounts per environment with Organizations
prod: 123456789012
staging: 234567890123
dev: 345678901234
-> Guardrails with SCPs, centralized management with IAM Identity Center
```

---

## 12. FAQ

### Q1. What is covered by the free tier?

There are three types of AWS free tiers: (1) 12-month free tier (e.g., EC2 t2.micro 750 hours/month), (2) Always free (e.g., Lambda 1 million requests/month, DynamoDB 25GB), (3) Trials (time-limited free usage of certain services). Check https://aws.amazon.com/free/ for details.

### Q2. What should I do if my account is compromised?

(1) Immediately change the root user password, (2) Deactivate all access keys, (3) Stop and delete unauthorized resources, (4) Contact AWS Support. As preventive measures, CloudTrail log monitoring and GuardDuty activation are important.

```bash
# Emergency response script
#!/bin/bash
echo "=== Unauthorized Access Emergency Response ==="

# 1. Deactivate all IAM user access keys
for user in $(aws iam list-users --query 'Users[].UserName' --output text); do
  for key in $(aws iam list-access-keys --user-name "$user" \
    --query 'AccessKeyMetadata[].AccessKeyId' --output text); do
    aws iam update-access-key --user-name "$user" --access-key-id "$key" --status Inactive
    echo "Deactivated: $user / $key"
  done
done

# 2. Stop suspicious EC2 instances
aws ec2 describe-instances \
  --filters "Name=instance-state-name,Values=running" \
  --query 'Reservations[].Instances[].[InstanceId,LaunchTime,InstanceType]' \
  --output table

# 3. Check CloudTrail for suspicious activity
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=RunInstances \
  --start-time "$(date -v-24H -u +%Y-%m-%dT%H:%M:%SZ)" \
  --query 'Events[].[EventTime,Username,EventName]' \
  --output table
```

### Q3. When should I use IAM Identity Center (formerly SSO) vs IAM users?

IAM Identity Center is recommended when using AWS Organizations. Its advantages include single sign-on, centralized access management, and automatic issuance of temporary credentials. For small-scale or single-account setups, IAM users with MFA are sufficient.

### Q4. What is the procedure for closing an AWS account?

Account closure is irreversible (recovery within 90 days is possible but not guaranteed). Before closing: (1) Migrate necessary data to other accounts, (2) Transfer Route 53 domains, (3) Close support cases, (4) Execute closure from the console as the root user.

### Q5. What should I be aware of when using multiple regions?

IAM is a global service, but most other services are regional. It is recommended to enable multi-region support for CloudTrail and apply region restrictions via SCPs. Notable exceptions: IAM, Route 53, CloudFront, WAF (Global), Organizations.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What are common mistakes beginners make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently utilized in daily development work. It becomes especially important during code reviews and architecture design.

---

## 13. Summary

| Item | Key Points |
|------|-----------|
| Root User | MFA required, daily use prohibited, access key creation prohibited |
| IAM Design | Group-based permission management, principle of least privilege |
| IAM Roles | Used for AWS service access from EC2/Lambda |
| Permissions Boundary | Sets upper limit during permission delegation for safety |
| MFA | Set for all IAM users, FIDO2 recommended for root |
| IAM Identity Center | Centralized access management for multi-account operations |
| Organizations | Separate accounts per environment, guardrails with SCPs |
| Control Tower | Landing zone based on best practices |
| Cost Management | Early detection of overages with Budgets + CloudWatch alarms + anomaly detection |
| IaC | Manage IAM as code with CloudFormation / CDK / Terraform |

---

## Recommended Next Reads

- [02-aws-cli-sdk.md](./02-aws-cli-sdk.md) -- CLI/SDK setup and credential management
- [../01-compute/00-ec2-basics.md](../01-compute/00-ec2-basics.md) -- EC2 instance fundamentals

---

## References

1. AWS IAM Best Practices -- https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html
2. AWS Organizations User Guide -- https://docs.aws.amazon.com/organizations/latest/userguide/
3. AWS Security Best Practices (Whitepaper) -- https://docs.aws.amazon.com/whitepapers/latest/aws-security-best-practices/
4. AWS Well-Architected Framework -- Security Pillar -- https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/
5. IAM Identity Center User Guide -- https://docs.aws.amazon.com/singlesignon/latest/userguide/
6. AWS Control Tower User Guide -- https://docs.aws.amazon.com/controltower/latest/userguide/
7. AWS Cost Management User Guide -- https://docs.aws.amazon.com/cost-management/latest/userguide/
8. AWS CDK IAM Module -- https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_iam-readme.html

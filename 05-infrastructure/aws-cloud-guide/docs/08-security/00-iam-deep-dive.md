# AWS IAM Deep Dive

> Deeply understand IAM policy syntax, STS, cross-account access, and the principle of least privilege to build a secure AWS environment

## What You Will Learn

1. **IAM Policy Syntax and Evaluation Logic** — Details and evaluation order of Effect, Action, Resource, and Condition
2. **STS and Role Usage** — AssumeRole, federation, and temporary credentials
3. **Cross-Account Access and Least Privilege Design** — Multi-account strategy and permission boundaries
4. **IAM Identity Center and Organization Management** — SSO, SCIM provisioning, and SCP practices
5. **IAM Monitoring, Auditing, and Automation** — Access Analyzer, CloudTrail, and automated remediation


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. IAM Basic Concepts

IAM (Identity and Access Management) is AWS's access control service that defines "who" can do "what" to "which resources." All AWS API calls go through IAM authentication and authorization.

### Diagram 1: IAM Components

```
┌─────────────────────────────────────────────────────────┐
│                    IAM                                  │
│                                                         │
│  Identity (Authentication: Who)                         │
│  ┌──────────────────────────────────────┐               │
│  │  User        → Human operators       │               │
│  │  Group       → Collection of users   │               │
│  │  Role        → Services/external     │               │
│  │                accounts              │               │
│  │  Federation  → External IdP          │               │
│  │                (SAML/OIDC)           │               │
│  └──────────────────────────────────────┘               │
│                                                         │
│  Policy (Authorization: What can be done)               │
│  ┌──────────────────────────────────────┐               │
│  │  Identity-based  → Attached to       │               │
│  │                    User/Group/Role   │               │
│  │  Resource-based  → Directly on       │               │
│  │                    resources         │               │
│  │                    (S3, SQS, etc.)   │               │
│  │  Permission      → Limits the        │               │
│  │    Boundary        ceiling of        │               │
│  │                    permissions       │               │
│  │  SCP             → Account-level     │               │
│  │                    restrictions in   │               │
│  │                    Organizations     │               │
│  │  Session Policy  → Additional        │               │
│  │                    restrictions on   │               │
│  │                    temporary sessions│               │
│  └──────────────────────────────────────┘               │
│                                                         │
│  Evaluation Order:                                      │
│  SCP → Permission Boundary → Identity Policy            │
│    → Resource Policy → Session Policy                   │
└─────────────────────────────────────────────────────────┘
```

### 1.1 IAM Global Nature and Regions

IAM is a global service and does not depend on regions. However, some features require region-specific considerations.

```
┌──────────────────────────────────────────────────────────┐
│              IAM Global/Region Characteristics           │
│                                                          │
│  Global:                                                 │
│  ├── IAM User / Group / Role / Policy                    │
│  ├── IAM Identity Center (organization level)            │
│  └── STS (sts.amazonaws.com)                             │
│                                                          │
│  Region-specific:                                        │
│  ├── STS regional endpoints (recommended)                │
│  │   → sts.ap-northeast-1.amazonaws.com                  │
│  ├── IAM Access Analyzer (created per region)            │
│  └── VPC endpoints (created per region)                  │
│                                                          │
│  Best Practice:                                          │
│  Use STS regional endpoints                              │
│  → Reduced latency + avoids global endpoint failures     │
└──────────────────────────────────────────────────────────┘
```

### 1.2 When to Use IAM User / Group / Role

```bash
# Creating an IAM User (not recommended, for legacy support)
aws iam create-user --user-name legacy-service-user
aws iam create-access-key --user-name legacy-service-user

# Creating an IAM Group and adding a user
aws iam create-group --group-name Developers
aws iam add-user-to-group --group-name Developers --user-name dev-user-01
aws iam attach-group-policy \
  --group-name Developers \
  --policy-arn arn:aws:iam::123456789012:policy/DeveloperAccess

# Creating an IAM Role (recommended)
aws iam create-role \
  --role-name MyAppRole \
  --assume-role-policy-document file://trust-policy.json \
  --tags Key=Environment,Value=Production Key=Team,Value=Backend

# Attaching a policy to an IAM Role
aws iam attach-role-policy \
  --role-name MyAppRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess

# Adding an inline policy (permissions specific to a particular role)
aws iam put-role-policy \
  --role-name MyAppRole \
  --policy-name CustomDynamoDBAccess \
  --policy-document file://dynamodb-policy.json
```

### 1.3 IAM User Inventory and Removing Unused Resources

```bash
#!/bin/bash
# IAM user inventory script
# Detect users who have not used their access keys for 90+ days

echo "=== IAM User Access Key Audit ==="
echo "Date: $(date)"
echo ""

aws iam generate-credential-report > /dev/null 2>&1
sleep 5

aws iam get-credential-report \
  --query 'Content' \
  --output text | base64 -d | \
  awk -F',' 'NR>1 {
    user=$1;
    key1_active=$9;
    key1_last_used=$11;
    key2_active=$14;
    key2_last_used=$16;
    mfa=$8;
    printf "User: %-30s MFA: %-5s Key1Active: %-5s Key1LastUsed: %-20s Key2Active: %-5s Key2LastUsed: %-20s\n",
      user, mfa, key1_active, key1_last_used, key2_active, key2_last_used
  }'

echo ""
echo "=== Access keys unused for 90+ days ==="
THRESHOLD=$(date -d "90 days ago" +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -v-90d +%Y-%m-%dT%H:%M:%S)

for user in $(aws iam list-users --query 'Users[*].UserName' --output text); do
  for key_id in $(aws iam list-access-keys --user-name "$user" \
    --query 'AccessKeyMetadata[?Status==`Active`].AccessKeyId' --output text); do

    last_used=$(aws iam get-access-key-last-used --access-key-id "$key_id" \
      --query 'AccessKeyLastUsed.LastUsedDate' --output text)

    if [[ "$last_used" < "$THRESHOLD" ]] || [[ "$last_used" == "None" ]]; then
      echo "STALE: User=$user KeyId=$key_id LastUsed=$last_used"
    fi
  done
done
```

---

## 2. Policy Syntax in Detail

### Code Example 1: Basic IAM Policy Syntax

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
        "arn:aws:s3:::my-bucket",
        "arn:aws:s3:::my-bucket/*"
      ],
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "ap-northeast-1"
        },
        "IpAddress": {
          "aws:SourceIp": "203.0.113.0/24"
        },
        "Bool": {
          "aws:SecureTransport": "true"
        }
      }
    },
    {
      "Sid": "DenyDeleteActions",
      "Effect": "Deny",
      "Action": [
        "s3:DeleteBucket",
        "s3:DeleteObject"
      ],
      "Resource": "*"
    }
  ]
}
```

### 2.1 Detailed Explanation of Policy Elements

| Element | Required | Description | Example |
|---------|----------|-------------|---------|
| **Version** | Recommended | Policy language version | `"2012-10-17"` (latest, recommended) |
| **Statement** | Required | One or more access control rules | Array format |
| **Sid** | Optional | Statement identifier | `"AllowS3Read"` |
| **Effect** | Required | Allow or Deny | `"Allow"` or `"Deny"` |
| **Principal** | Conditional | Target entity (used in Resource Policy) | `{"AWS": "arn:aws:iam::..."}` |
| **Action** | Required | API operations to allow/deny | `"s3:GetObject"` |
| **NotAction** | Optional | Operations other than specified (inverse of Action) | Allow everything except `"iam:*"` |
| **Resource** | Required | ARN of target resources | `"arn:aws:s3:::bucket/*"` |
| **NotResource** | Optional | Resources other than specified | Apply to all resources except specified |
| **Condition** | Optional | Conditional access control | IP restrictions, MFA requirements, etc. |

### Policy Evaluation Flow

```
Request arrives
    │
    ▼
┌─────────────────┐
│ Check for       │──→ Deny found ──→ Denied (final)
│ explicit Deny   │
└────────┬────────┘
         │ No Deny
         ▼
┌─────────────────┐
│ SCP check       │──→ No Allow ──→ Implicit deny
│ (Organizations) │
└────────┬────────┘
         │ Allow found
         ▼
┌─────────────────┐
│ Permission      │──→ Out of scope ──→ Implicit deny
│ Boundary check  │
└────────┬────────┘
         │ In scope
         ▼
┌─────────────────┐
│ Identity Policy │──→ No Allow ──→ Implicit deny
│ check           │
└────────┬────────┘
         │ Allow found
         ▼
      Allowed (final)
```

### 2.2 Evaluation Differences: Same Account vs Cross-Account

```
┌──────────────────────────────────────────────────────────┐
│  Same account:                                           │
│  Allow in EITHER Identity Policy OR Resource Policy      │
│  → Access granted (union)                                │
│                                                          │
│  Example: If allowed by S3 bucket policy,               │
│      access is possible even without Allow in            │
│      Identity Policy                                     │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Cross-account:                                          │
│  Allow required in BOTH Identity Policy AND              │
│  Resource Policy                                         │
│  → Access denied without both (intersection)            │
│                                                          │
│  Example: Account B's S3 bucket policy allows Account A  │
│      + Account A's Identity Policy allows S3             │
│      → Both required                                     │
└──────────────────────────────────────────────────────────┘
```

### Code Example 2: Advanced Use of Conditions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowTagBasedAccess",
      "Effect": "Allow",
      "Action": ["ec2:StartInstances", "ec2:StopInstances"],
      "Resource": "arn:aws:ec2:*:*:instance/*",
      "Condition": {
        "StringEquals": {
          "ec2:ResourceTag/Environment": "${aws:PrincipalTag/Environment}"
        }
      }
    },
    {
      "Sid": "RestrictToWorkingHours",
      "Effect": "Deny",
      "Action": ["rds:DeleteDBInstance", "rds:DeleteDBCluster"],
      "Resource": "*",
      "Condition": {
        "DateGreaterThan": {
          "aws:CurrentTime": "2026-01-01T00:00:00Z"
        },
        "NumericGreaterThan": {
          "aws:MultiFactorAuthAge": "3600"
        }
      }
    },
    {
      "Sid": "RequireMFA",
      "Effect": "Deny",
      "NotAction": [
        "iam:CreateVirtualMFADevice",
        "iam:EnableMFADevice",
        "iam:GetUser",
        "iam:ListMFADevices",
        "iam:ListVirtualMFADevices",
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

### 2.3 Condition Operator Reference and Practical Examples

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ConditionOperatorExamples",
      "Effect": "Allow",
      "Action": "s3:*",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "s3:prefix": "home/${aws:username}/"
        },
        "StringLike": {
          "s3:prefix": ["home/*", "shared/*"]
        },
        "StringNotEquals": {
          "aws:RequestedRegion": "us-east-1"
        },
        "ArnLike": {
          "aws:SourceArn": "arn:aws:sns:*:123456789012:*"
        },
        "IpAddress": {
          "aws:SourceIp": ["203.0.113.0/24", "198.51.100.0/24"]
        },
        "NotIpAddress": {
          "aws:SourceIp": "0.0.0.0/0"
        },
        "DateLessThan": {
          "aws:CurrentTime": "2026-12-31T23:59:59Z"
        },
        "NumericLessThanEquals": {
          "s3:max-keys": "100"
        },
        "Bool": {
          "aws:SecureTransport": "true"
        },
        "Null": {
          "aws:TokenIssueTime": "false"
        },
        "ForAllValues:StringEquals": {
          "aws:TagKeys": ["Environment", "Project"]
        },
        "ForAnyValue:StringLike": {
          "aws:PrincipalOrgPaths": ["o-xxx/r-xxx/ou-xxx/*"]
        }
      }
    }
  ]
}
```

### 2.4 Policy Variables and Tag-Based Access Control (ABAC)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ABACFullExample",
      "Effect": "Allow",
      "Action": [
        "ec2:StartInstances",
        "ec2:StopInstances",
        "ec2:RebootInstances",
        "ec2:TerminateInstances"
      ],
      "Resource": "arn:aws:ec2:*:*:instance/*",
      "Condition": {
        "StringEquals": {
          "ec2:ResourceTag/Project": "${aws:PrincipalTag/Project}",
          "ec2:ResourceTag/Environment": "${aws:PrincipalTag/Environment}"
        }
      }
    },
    {
      "Sid": "AllowCreateTaggedResources",
      "Effect": "Allow",
      "Action": "ec2:RunInstances",
      "Resource": "arn:aws:ec2:*:*:instance/*",
      "Condition": {
        "StringEquals": {
          "aws:RequestTag/Project": "${aws:PrincipalTag/Project}",
          "aws:RequestTag/Environment": "${aws:PrincipalTag/Environment}"
        },
        "ForAllValues:StringEquals": {
          "aws:TagKeys": ["Project", "Environment", "Name"]
        }
      }
    },
    {
      "Sid": "DenyUntaggedResources",
      "Effect": "Deny",
      "Action": "ec2:RunInstances",
      "Resource": "arn:aws:ec2:*:*:instance/*",
      "Condition": {
        "Null": {
          "aws:RequestTag/Project": "true",
          "aws:RequestTag/Environment": "true"
        }
      }
    },
    {
      "Sid": "AllowS3HomeDirectory",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::company-data/home/${aws:PrincipalTag/Department}/${aws:userid}/*"
    }
  ]
}
```

### 2.5 ABAC vs RBAC Comparison

```
┌──────────────────────────────────────────────────────────┐
│  RBAC (Role-Based Access Control)                         │
│                                                          │
│  ┌──────────────┐     ┌──────────────┐                   │
│  │ Project-A    │     │ Project-B    │                   │
│  │ Developer    │     │ Developer    │                   │
│  │ Role         │     │ Role         │                   │
│  └──────┬───────┘     └──────┬───────┘                   │
│         │                    │                           │
│         ▼                    ▼                           │
│  Create a role per      Create a role per                │
│  project                project                          │
│  → Role count grows     → Management becomes             │
│                           complex                        │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  ABAC (Attribute-Based Access Control)                    │
│                                                          │
│  ┌──────────────┐                                        │
│  │ Developer    │  Tag: Project=A                        │
│  │ Role         │  Tag: Environment=prod                 │
│  │ (shared)     │                                        │
│  └──────┬───────┘                                        │
│         │                                                │
│         ▼                                                │
│  One policy covers all    Access scope controlled        │
│  projects                 dynamically by tag values      │
│  → Minimize policy count  → Scalable                     │
└──────────────────────────────────────────────────────────┘
```

---

## 3. STS (Security Token Service)

### Diagram 2: AssumeRole Flow

```
1. AssumeRole within the same account:
   ┌─────────┐  AssumeRole   ┌──────────┐
   │ EC2     │ ──────────→   │ IAM Role │
   │ (Role A)│               │ (Role B) │
   │         │ ←──────────── │          │
   │         │  Temp creds   │          │
   └─────────┘               └──────────┘

2. Cross-account AssumeRole:
   Account A (111111111111)      Account B (222222222222)
   ┌─────────────┐              ┌────────────────┐
   │ IAM User/   │  AssumeRole  │ IAM Role       │
   │ Role        │ ────────→    │ (Trust Policy  │
   │             │              │  allows A)     │
   │             │ ←────────    │                │
   │             │ Temp creds   │                │
   └─────────────┘              └────────────────┘

3. Federation (OIDC/SAML):
   ┌──────────┐  Auth  ┌──────┐  AssumeRoleWith  ┌──────────┐
   │ User     │ ────→  │ IdP  │  WebIdentity      │ IAM Role │
   │          │        │(Google│ ────────────→    │          │
   │          │        │/Okta) │                  │ AWS      │
   │          │        └──────┘                   │ Resources│
   └──────────┘                                   └──────────┘
```

### Code Example 3: AssumeRole Implementation

```python
import boto3
from datetime import datetime

# Cross-account AssumeRole
def assume_cross_account_role(
    role_arn: str,
    session_name: str,
    external_id: str = None,
    duration_seconds: int = 3600,
) -> boto3.Session:
    """Assume a role in another account and return a session"""
    sts = boto3.client("sts")

    params = {
        "RoleArn": role_arn,
        "RoleSessionName": session_name,
        "DurationSeconds": duration_seconds,
    }
    if external_id:
        params["ExternalId"] = external_id

    response = sts.assume_role(**params)
    credentials = response["Credentials"]

    return boto3.Session(
        aws_access_key_id=credentials["AccessKeyId"],
        aws_secret_access_key=credentials["SecretAccessKey"],
        aws_session_token=credentials["SessionToken"],
    )

# Example usage: Access S3 in Account B
session_b = assume_cross_account_role(
    role_arn="arn:aws:iam::222222222222:role/CrossAccountS3Access",
    session_name="my-app-session",
    external_id="UniqueExternalId123",
)

s3 = session_b.client("s3")
objects = s3.list_objects_v2(Bucket="account-b-bucket")
```

### 3.1 AssumeRole Chaining (Role Chains)

```python
def assume_role_chain(role_chain: list[dict]) -> boto3.Session:
    """Assume multiple roles in a chain

    Args:
        role_chain: [{"role_arn": "...", "session_name": "...", "external_id": "..."}]

    Returns:
        Session for the final role
    """
    session = boto3.Session()  # Initial session (original credentials)

    for i, role_config in enumerate(role_chain):
        sts = session.client("sts")
        params = {
            "RoleArn": role_config["role_arn"],
            "RoleSessionName": role_config.get("session_name", f"chain-step-{i}"),
            "DurationSeconds": role_config.get("duration", 3600),
        }
        if "external_id" in role_config:
            params["ExternalId"] = role_config["external_id"]

        response = sts.assume_role(**params)
        creds = response["Credentials"]

        session = boto3.Session(
            aws_access_key_id=creds["AccessKeyId"],
            aws_secret_access_key=creds["SecretAccessKey"],
            aws_session_token=creds["SessionToken"],
        )
        print(f"Step {i+1}: Assumed {role_config['role_arn']}")
        print(f"  Expiration: {creds['Expiration']}")

    return session

# Example: Management Account → Security Account → Target Account
final_session = assume_role_chain([
    {
        "role_arn": "arn:aws:iam::111111111111:role/SecurityHubRole",
        "session_name": "security-audit",
    },
    {
        "role_arn": "arn:aws:iam::222222222222:role/AuditTargetRole",
        "session_name": "target-audit",
        "external_id": "audit-2026",
    },
])
```

### 3.2 STS Session Tags and Transitive Tags

```python
def assume_role_with_tags(
    role_arn: str,
    session_name: str,
    tags: dict[str, str],
    transitive_keys: list[str] = None,
) -> boto3.Session:
    """AssumeRole with session tags"""
    sts = boto3.client("sts")

    session_tags = [
        {"Key": k, "Value": v} for k, v in tags.items()
    ]

    params = {
        "RoleArn": role_arn,
        "RoleSessionName": session_name,
        "Tags": session_tags,
    }

    if transitive_keys:
        params["TransitiveTagKeys"] = transitive_keys

    response = sts.assume_role(**params)
    creds = response["Credentials"]

    return boto3.Session(
        aws_access_key_id=creds["AccessKeyId"],
        aws_secret_access_key=creds["SecretAccessKey"],
        aws_session_token=creds["SessionToken"],
    )

# Dynamically configure cost allocation and access control with session tags
session = assume_role_with_tags(
    role_arn="arn:aws:iam::123456789012:role/DeveloperRole",
    session_name="dev-session",
    tags={
        "Project": "payment-service",
        "CostCenter": "engineering-tokyo",
        "Environment": "staging",
    },
    transitive_keys=["Project", "CostCenter"],  # Tags to carry through role chains
)
```

### Code Example 4: Trust Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCrossAccountAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::111111111111:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "UniqueExternalId123"
        }
      }
    },
    {
      "Sid": "AllowGitHubOIDC",
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:my-org/my-repo:*"
        }
      }
    },
    {
      "Sid": "AllowEC2",
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

### 3.3 Complete GitHub Actions OIDC Configuration

```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS
on:
  push:
    branches: [main]

permissions:
  id-token: write   # Required to issue OIDC token
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsDeployRole
          aws-region: ap-northeast-1
          role-session-name: github-actions-${{ github.run_id }}

      - name: Deploy
        run: |
          aws sts get-caller-identity
          aws s3 sync ./dist s3://my-app-bucket/
```

```bash
# Create OIDC provider
aws iam create-open-id-connect-provider \
  --url "https://token.actions.githubusercontent.com" \
  --client-id-list "sts.amazonaws.com" \
  --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1"

# Create role for GitHub Actions
aws iam create-role \
  --role-name GitHubActionsDeployRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
        },
        "Action": "sts:AssumeRoleWithWebIdentity",
        "Condition": {
          "StringEquals": {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
          },
          "StringLike": {
            "token.actions.githubusercontent.com:sub": "repo:my-org/my-repo:ref:refs/heads/main"
          }
        }
      }
    ]
  }'
```

---

## 4. Implementing Least Privilege

### Code Example 5: Incrementally Building a Least Privilege Policy

```bash
# 1. Analyze required permissions with IAM Access Analyzer
aws accessanalyzer create-analyzer \
  --analyzer-name my-analyzer \
  --type ACCOUNT

# 2. Extract actions actually used from CloudTrail
aws accessanalyzer generate-findings-report \
  --analyzer-arn arn:aws:access-analyzer:ap-northeast-1:123456789012:analyzer/my-analyzer

# 3. Generate policy with IAM Access Analyzer
aws accessanalyzer generate-policy \
  --policy-generation-details '{
    "trailProperties": {
      "cloudTrailArn": "arn:aws:cloudtrail:ap-northeast-1:123456789012:trail/my-trail",
      "regions": ["ap-northeast-1"],
      "allRegions": false
    },
    "principalArn": "arn:aws:iam::123456789012:role/MyAppRole"
  }'

# 4. Check for unused permissions
aws iam generate-service-last-accessed-details \
  --arn arn:aws:iam::123456789012:role/MyAppRole

aws iam get-service-last-accessed-details \
  --job-id "job-id-from-above"

# 5. Retrieve the policy generated by Access Analyzer
aws accessanalyzer get-generated-policy \
  --job-id "policy-generation-job-id" \
  --include-resource-placeholders
```

### 4.1 Automated Detection of Unused Permissions with Access Analyzer

```python
import boto3
import json
from datetime import datetime, timedelta

def audit_unused_permissions(days_threshold: int = 90) -> list[dict]:
    """Detect unused IAM permissions"""
    iam = boto3.client("iam")
    results = []

    # List all roles
    paginator = iam.get_paginator("list_roles")
    for page in paginator.paginate():
        for role in page["Roles"]:
            role_name = role["RoleName"]

            # Skip AWS service roles
            if role_name.startswith("aws-service-role/"):
                continue

            # Get service last accessed information
            job_id = iam.generate_service_last_accessed_details(
                Arn=role["Arn"]
            )["JobId"]

            # Wait for job completion
            import time
            while True:
                result = iam.get_service_last_accessed_details(JobId=job_id)
                if result["JobStatus"] == "COMPLETED":
                    break
                time.sleep(1)

            threshold_date = datetime.now() - timedelta(days=days_threshold)

            for service in result["ServicesLastAccessed"]:
                last_accessed = service.get("LastAuthenticated")
                if last_accessed and last_accessed.replace(tzinfo=None) < threshold_date:
                    results.append({
                        "Role": role_name,
                        "Service": service["ServiceNamespace"],
                        "LastAccessed": str(last_accessed),
                        "DaysUnused": (datetime.now() - last_accessed.replace(tzinfo=None)).days,
                    })
                elif last_accessed is None and service.get("TotalAuthenticatedEntities", 0) == 0:
                    results.append({
                        "Role": role_name,
                        "Service": service["ServiceNamespace"],
                        "LastAccessed": "Never",
                        "DaysUnused": "N/A",
                    })

    return results

# Execute
unused = audit_unused_permissions(90)
for item in unused:
    print(f"Role: {item['Role']}, Service: {item['Service']}, "
          f"Last: {item['LastAccessed']}, Unused: {item['DaysUnused']} days")
```

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDBMinimalAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:ap-northeast-1:123456789012:table/Users",
        "arn:aws:dynamodb:ap-northeast-1:123456789012:table/Users/index/*"
      ]
    },
    {
      "Sid": "S3SpecificBucketAccess",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::my-app-uploads/*",
      "Condition": {
        "StringEquals": {
          "s3:x-amz-server-side-encryption": "aws:kms"
        }
      }
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:ap-northeast-1:123456789012:log-group:/aws/lambda/my-function:*"
    }
  ]
}
```

---

## 5. Permission Boundary

### Diagram 3: How Permission Boundary Works

```
Permission Boundary Effect:

  Identity Policy (permissions granted to the role):
  ┌──────────────────────────────────────┐
  │  S3:*                                │
  │  DynamoDB:*                          │
  │  Lambda:*                            │
  │  EC2:*          ← broad permissions  │
  │  IAM:*                               │
  └──────────────────────────────────────┘

  Permission Boundary (ceiling of permissions):
  ┌──────────────────────────────────────┐
  │  S3:*                                │
  │  DynamoDB:*                          │
  │  Lambda:*       ← ceiling of scope   │
  │  CloudWatch:*                        │
  └──────────────────────────────────────┘

  Effective permissions (intersection):
  ┌──────────────────────────────────────┐
  │  S3:*                                │
  │  DynamoDB:*     ← Only permissions   │
  │  Lambda:*         allowed in both    │
  └──────────────────────────────────────┘

  EC2:* → Denied because not in Boundary
  IAM:* → Denied because not in Boundary
```

### Code Example 6: Configuring Permission Boundary

```bash
# Create Permission Boundary policy
aws iam create-policy \
  --policy-name DeveloperBoundary \
  --policy-document '{
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
          "sns:*",
          "apigateway:*",
          "xray:*"
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
  }'

# Set Permission Boundary on a role
aws iam put-role-permissions-boundary \
  --role-name DeveloperRole \
  --permissions-boundary "arn:aws:iam::123456789012:policy/DeveloperBoundary"
```

### 5.1 Permission Delegation Pattern Using Permission Boundary

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCreateRolesWithBoundary",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:AttachRolePolicy",
        "iam:PutRolePolicy"
      ],
      "Resource": "arn:aws:iam::123456789012:role/app-*",
      "Condition": {
        "StringEquals": {
          "iam:PermissionsBoundary": "arn:aws:iam::123456789012:policy/DeveloperBoundary"
        }
      }
    },
    {
      "Sid": "DenyBoundaryModification",
      "Effect": "Deny",
      "Action": [
        "iam:DeleteRolePermissionsBoundary",
        "iam:PutRolePermissionsBoundary"
      ],
      "Resource": "*"
    },
    {
      "Sid": "DenyBoundaryPolicyModification",
      "Effect": "Deny",
      "Action": [
        "iam:CreatePolicyVersion",
        "iam:DeletePolicy",
        "iam:DeletePolicyVersion",
        "iam:SetDefaultPolicyVersion"
      ],
      "Resource": "arn:aws:iam::123456789012:policy/DeveloperBoundary"
    }
  ]
}
```

---

## 6. IAM Identity Center (formerly AWS SSO)

### 6.1 Overview of Identity Center

```
┌──────────────────────────────────────────────────────────┐
│              IAM Identity Center                          │
│                                                          │
│  ┌──────────┐    SAML/SCIM    ┌──────────────────┐      │
│  │ External │ ←──────────── → │ Identity Center  │      │
│  │ IdP      │                 │ (AWS Organizations│      │
│  │ (Okta,   │                 │  management       │      │
│  │  Azure AD,│                │  account)         │      │
│  │  Google)  │                └────────┬─────────┘      │
│  └──────────┘                         │                  │
│                                       │                  │
│                    ┌──────────────────┼──────────────┐   │
│                    │                  │              │   │
│              ┌─────▼─────┐   ┌───────▼────┐  ┌─────▼──┐│
│              │ Account A │   │ Account B  │  │Account C││
│              │ (Dev)     │   │ (Staging)  │  │(Prod)   ││
│              │           │   │            │  │         ││
│              │ Permission│   │ Permission │  │Permission│
│              │ Set:      │   │ Set:       │  │Set:     ││
│              │ FullAccess│   │ ReadOnly   │  │Admin    ││
│              └───────────┘   └────────────┘  └─────────┘│
└──────────────────────────────────────────────────────────┘
```

### 6.2 Creating Permission Sets

```bash
# Create a Permission Set
aws sso-admin create-permission-set \
  --instance-arn "arn:aws:sso:::instance/ssoins-xxxxxxxxxxxx" \
  --name "DeveloperAccess" \
  --description "Developer permissions for dev/staging accounts" \
  --session-duration "PT8H" \
  --relay-state "https://ap-northeast-1.console.aws.amazon.com/"

# Attach an AWS managed policy
aws sso-admin attach-managed-policy-to-permission-set \
  --instance-arn "arn:aws:sso:::instance/ssoins-xxxxxxxxxxxx" \
  --permission-set-arn "arn:aws:sso:::permissionSet/ssoins-xxxxxxxxxxxx/ps-xxxxxxxxxxxx" \
  --managed-policy-arn "arn:aws:iam::aws:policy/PowerUserAccess"

# Attach a custom inline policy
aws sso-admin put-inline-policy-to-permission-set \
  --instance-arn "arn:aws:sso:::instance/ssoins-xxxxxxxxxxxx" \
  --permission-set-arn "arn:aws:sso:::permissionSet/ssoins-xxxxxxxxxxxx/ps-xxxxxxxxxxxx" \
  --inline-policy '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "DenyProductionResourceDeletion",
        "Effect": "Deny",
        "Action": [
          "rds:DeleteDBInstance",
          "rds:DeleteDBCluster",
          "ec2:TerminateInstances",
          "s3:DeleteBucket"
        ],
        "Resource": "*",
        "Condition": {
          "StringEquals": {
            "aws:ResourceTag/Environment": "production"
          }
        }
      }
    ]
  }'

# Assign Permission Set to an account
aws sso-admin create-account-assignment \
  --instance-arn "arn:aws:sso:::instance/ssoins-xxxxxxxxxxxx" \
  --target-id "111111111111" \
  --target-type AWS_ACCOUNT \
  --permission-set-arn "arn:aws:sso:::permissionSet/ssoins-xxxxxxxxxxxx/ps-xxxxxxxxxxxx" \
  --principal-type GROUP \
  --principal-id "group-id-from-identity-store"
```

---

## 7. Organizations and SCP (Service Control Policies)

### 7.1 SCP Design Patterns

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyRegionsOutsideAllowed",
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
          "aws:PrincipalArn": [
            "arn:aws:iam::*:role/OrganizationAccountAccessRole"
          ]
        }
      }
    },
    {
      "Sid": "DenyRootAccountUsage",
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
      "Sid": "DenyCloudTrailModification",
      "Effect": "Deny",
      "Action": [
        "cloudtrail:StopLogging",
        "cloudtrail:DeleteTrail",
        "cloudtrail:UpdateTrail"
      ],
      "Resource": "*"
    },
    {
      "Sid": "DenyGuardDutyDisable",
      "Effect": "Deny",
      "Action": [
        "guardduty:DisableOrganizationAdminAccount",
        "guardduty:DeleteDetector",
        "guardduty:DeleteMembers"
      ],
      "Resource": "*"
    },
    {
      "Sid": "DenyLeavingOrganization",
      "Effect": "Deny",
      "Action": "organizations:LeaveOrganization",
      "Resource": "*"
    },
    {
      "Sid": "RequireS3Encryption",
      "Effect": "Deny",
      "Action": "s3:PutObject",
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "s3:x-amz-server-side-encryption": ["aws:kms", "AES256"]
        },
        "Null": {
          "s3:x-amz-server-side-encryption": "false"
        }
      }
    }
  ]
}
```

### 7.2 Organizations OU Structure and SCP Application Examples

```
Organizations Root
├── SCP: DenyRegionRestriction (applied to all accounts)
│
├── OU: Security
│   ├── SCP: DenyAllExceptSecurityServices
│   ├── Security Tooling Account (SecurityHub, GuardDuty)
│   └── Log Archive Account (CloudTrail, Config)
│
├── OU: Infrastructure
│   ├── SCP: AllowNetworkServices
│   ├── Network Account (Transit Gateway, VPN)
│   └── Shared Services Account (Directory, DNS)
│
├── OU: Workloads
│   ├── OU: Production
│   │   ├── SCP: DenyDestructiveActions
│   │   ├── App-A Prod Account
│   │   └── App-B Prod Account
│   │
│   ├── OU: Staging
│   │   ├── App-A Staging Account
│   │   └── App-B Staging Account
│   │
│   └── OU: Development
│       ├── SCP: AllowBroadAccess (relaxed for development)
│       ├── App-A Dev Account
│       └── App-B Dev Account
│
└── OU: Sandbox
    ├── SCP: DenyExpensiveServices + BudgetLimit
    └── Sandbox Account (for personal experimentation)
```

---

## 8. IAM Monitoring and Auditing

### 8.1 IAM Event Monitoring with CloudTrail

```python
import boto3
import json
from datetime import datetime, timedelta

def monitor_iam_events(hours: int = 24) -> list[dict]:
    """Monitor IAM-related events from the past N hours"""
    ct = boto3.client("cloudtrail", region_name="ap-northeast-1")

    start_time = datetime.utcnow() - timedelta(hours=hours)
    end_time = datetime.utcnow()

    critical_events = [
        "CreateUser", "DeleteUser",
        "CreateRole", "DeleteRole",
        "AttachUserPolicy", "AttachRolePolicy",
        "PutUserPolicy", "PutRolePolicy",
        "CreateAccessKey",
        "UpdateAssumeRolePolicy",
        "CreateLoginProfile",
        "DeactivateMFADevice",
    ]

    results = []
    for event_name in critical_events:
        response = ct.lookup_events(
            LookupAttributes=[
                {"AttributeKey": "EventName", "AttributeValue": event_name}
            ],
            StartTime=start_time,
            EndTime=end_time,
            MaxResults=50,
        )

        for event in response.get("Events", []):
            detail = json.loads(event["CloudTrailEvent"])
            results.append({
                "EventTime": str(event["EventTime"]),
                "EventName": event["EventName"],
                "Username": event.get("Username", "N/A"),
                "SourceIP": detail.get("sourceIPAddress", "N/A"),
                "UserAgent": detail.get("userAgent", "N/A"),
                "ErrorCode": detail.get("errorCode", "None"),
                "Resources": [r.get("ARN", "") for r in event.get("Resources", [])],
            })

    return sorted(results, key=lambda x: x["EventTime"], reverse=True)
```

### 8.2 Automated Alerts with EventBridge + Lambda

```yaml
# CloudFormation: Automated detection of IAM changes
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  IAMChangeEventRule:
    Type: AWS::Events::Rule
    Properties:
      Name: iam-critical-change-alert
      Description: "Detect critical IAM changes"
      EventPattern:
        source:
          - "aws.iam"
        detail-type:
          - "AWS API Call via CloudTrail"
        detail:
          eventSource:
            - "iam.amazonaws.com"
          eventName:
            - "CreateUser"
            - "CreateAccessKey"
            - "AttachUserPolicy"
            - "AttachRolePolicy"
            - "PutUserPolicy"
            - "PutRolePolicy"
            - "DeleteRolePermissionsBoundary"
            - "UpdateAssumeRolePolicy"
            - "DeactivateMFADevice"
      State: ENABLED
      Targets:
        - Arn: !GetAtt AlertFunction.Arn
          Id: iam-alert-lambda
        - Arn: !Ref AlertTopic
          Id: iam-alert-sns

  AlertTopic:
    Type: AWS::SNS::Topic
    Properties:
      TopicName: iam-security-alerts
      Subscription:
        - Protocol: email
          Endpoint: security-team@example.com

  AlertFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: iam-change-alerter
      Runtime: python3.12
      Handler: index.handler
      Role: !GetAtt AlertFunctionRole.Arn
      Code:
        ZipFile: |
          import json
          import boto3
          import os

          def handler(event, context):
              sns = boto3.client("sns")
              detail = event["detail"]

              message = {
                  "Event": detail["eventName"],
                  "User": detail.get("userIdentity", {}).get("arn", "Unknown"),
                  "SourceIP": detail.get("sourceIPAddress", "Unknown"),
                  "Time": detail.get("eventTime", "Unknown"),
                  "Region": detail.get("awsRegion", "Unknown"),
                  "RequestParameters": detail.get("requestParameters", {}),
              }

              sns.publish(
                  TopicArn=os.environ["TOPIC_ARN"],
                  Subject=f"IAM Alert: {detail['eventName']}",
                  Message=json.dumps(message, indent=2, default=str)
              )
      Environment:
        Variables:
          TOPIC_ARN: !Ref AlertTopic
```

### 8.3 External Access Detection with IAM Access Analyzer

```bash
# Create Access Analyzer (account level)
aws accessanalyzer create-analyzer \
  --analyzer-name account-analyzer \
  --type ACCOUNT \
  --tags Environment=Production

# Create Access Analyzer (organization level)
aws accessanalyzer create-analyzer \
  --analyzer-name org-analyzer \
  --type ORGANIZATION \
  --tags Environment=Production

# List findings
aws accessanalyzer list-findings \
  --analyzer-arn "arn:aws:access-analyzer:ap-northeast-1:123456789012:analyzer/account-analyzer" \
  --filter '{
    "status": {"eq": ["ACTIVE"]},
    "resourceType": {"eq": ["AWS::S3::Bucket", "AWS::IAM::Role"]}
  }'

# Get finding details
aws accessanalyzer get-finding \
  --analyzer-arn "arn:aws:access-analyzer:ap-northeast-1:123456789012:analyzer/account-analyzer" \
  --id "finding-id-xxxx"

# Detect unused access (IAM Access Analyzer v2)
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

## 9. IAM Configuration Management with CDK

### 9.1 Defining Roles and Policies with CDK

```typescript
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class IamStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Define Permission Boundary
    const boundary = new iam.ManagedPolicy(this, 'DeveloperBoundary', {
      managedPolicyName: 'DeveloperBoundary',
      statements: [
        new iam.PolicyStatement({
          sid: 'AllowedServices',
          effect: iam.Effect.ALLOW,
          actions: [
            's3:*', 'dynamodb:*', 'lambda:*',
            'logs:*', 'cloudwatch:*', 'sqs:*',
            'sns:*', 'apigateway:*', 'xray:*',
          ],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'DenyDangerousActions',
          effect: iam.Effect.DENY,
          actions: [
            'iam:CreateUser', 'iam:DeleteUser',
            'organizations:*', 'account:*',
          ],
          resources: ['*'],
        }),
      ],
    });

    // Define application role
    const appRole = new iam.Role(this, 'AppRole', {
      roleName: 'MyAppRole',
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        new iam.ServicePrincipal('lambda.amazonaws.com'),
      ),
      permissionsBoundary: boundary,
      maxSessionDuration: cdk.Duration.hours(4),
    });

    // Define least privilege policy
    appRole.addToPolicy(new iam.PolicyStatement({
      sid: 'DynamoDBAccess',
      actions: [
        'dynamodb:GetItem', 'dynamodb:PutItem',
        'dynamodb:UpdateItem', 'dynamodb:Query',
      ],
      resources: [
        `arn:aws:dynamodb:${this.region}:${this.account}:table/Users`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/Users/index/*`,
      ],
    }));

    appRole.addToPolicy(new iam.PolicyStatement({
      sid: 'S3Access',
      actions: ['s3:GetObject', 's3:PutObject'],
      resources: ['arn:aws:s3:::my-app-uploads/*'],
      conditions: {
        'StringEquals': {
          's3:x-amz-server-side-encryption': 'aws:kms',
        },
      },
    }));

    // OIDC provider and GitHub Actions role
    const githubOidc = new iam.OpenIdConnectProvider(this, 'GitHubOidc', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    const githubRole = new iam.Role(this, 'GitHubDeployRole', {
      roleName: 'GitHubActionsDeployRole',
      assumedBy: new iam.OpenIdConnectPrincipal(githubOidc, {
        'StringEquals': {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        },
        'StringLike': {
          'token.actions.githubusercontent.com:sub': 'repo:my-org/my-repo:*',
        },
      }),
      maxSessionDuration: cdk.Duration.hours(1),
    });

    // Attach tags
    cdk.Tags.of(appRole).add('Environment', 'Production');
    cdk.Tags.of(appRole).add('ManagedBy', 'CDK');
  }
}
```

---

## 10. Comparison Tables

### Comparison Table 1: Policy Types

| Policy Type | Applies To | Administrator | Use Case | JSON Principal |
|-------------|-----------|---------------|----------|----------------|
| **Identity-based** | User/Group/Role | Account admin | Standard access control | Not required |
| **Resource-based** | S3/SQS/Lambda, etc. | Resource owner | Cross-account access | Required |
| **Permission Boundary** | User/Role | Admin | Set ceiling for delegation | Not required |
| **SCP** | OU/Account | Org admin | Organization-level restrictions | Not required |
| **Session Policy** | During AssumeRole | Caller | Temporary restrictions | Not required |
| **ACL** | S3/VPC | Resource owner | Legacy (not recommended) | Not required |

### Comparison Table 2: Authentication Methods

| Method | Security | Recommendation | Use Case | Key Management |
|--------|----------|----------------|----------|----------------|
| **IAM Role (EC2/Lambda)** | High | Highly recommended | Service-to-service within AWS | Auto-rotation |
| **OIDC Federation** | High | Recommended | GitHub Actions, Google, etc. | Token-based |
| **SAML Federation** | High | Recommended | Enterprise SSO (Okta, Azure AD) | Managed by IdP |
| **IAM Identity Center** | High | Recommended | Multi-account management | Auto-managed |
| **IAM User + MFA** | Medium | Conditional | Admin console access | Manual rotation |
| **Access Keys** | Low | Not recommended | Legacy/external systems | Manual management |
| **Root Account** | Lowest | Prohibited | Never use for daily operations | Hardware MFA required |

### Comparison Table 3: RBAC vs ABAC

| Item | RBAC | ABAC |
|------|------|------|
| **Access control unit** | Role | Tags (attributes) |
| **Number of policies** | Increases per project/team | Handled with fewer policies |
| **Handling new resources** | Policy update required | Automatically applied by tagging |
| **Scalability** | Complexity grows with role count | Dynamically controlled by tags |
| **Auditability** | Check role assignments | Check tag and policy combinations |
| **Recommended for** | Small to medium scale, clear role separation | Large scale, dynamic team structure |
| **AWS support** | Traditional, all services | Requires ABAC-compatible services |

---

## 11. Anti-Patterns

### Anti-Pattern 1: Granting Wildcard Permissions

```
[Bad example]
  {
    "Effect": "Allow",
    "Action": "*",
    "Resource": "*"
  }
  → All operations on all resources are possible
  → Risk of data leakage, resource deletion, and cost explosion

[Good example]
  {
    "Effect": "Allow",
    "Action": [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Query"
    ],
    "Resource": "arn:aws:dynamodb:ap-northeast-1:123456789012:table/Users"
  }
  → Allow only the required actions on the required resources
  → Periodically remove unused permissions with IAM Access Analyzer
```

### Anti-Pattern 2: Using Long-Term Access Keys

```
[Bad example]
  # Storing access keys in .env files
  AWS_ACCESS_KEY_ID=AKIA...
  AWS_SECRET_ACCESS_KEY=xxx...
  → Risk of key leakage
  → Overhead of managing key rotation
  → Missed invalidation of keys for departed employees

[Good example]
  # EC2/ECS/Lambda → IAM Role
  # Local development → AWS SSO (Identity Center)
  aws sso login --profile dev

  # CI/CD → OIDC Federation
  # GitHub Actions example:
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::123456789012:role/GitHubRole
      aws-region: ap-northeast-1

  Principle: Use only temporary credentials
```

### Anti-Pattern 3: Attaching Policies Directly to IAM Users

```
[Bad example]
  Attaching policies directly to IAM Users
  → Individual management required as user count grows
  → Missed policy removal for departed employees
  → Difficult to audit all permissions

[Good example]
  Attach policies to IAM Groups → Add users to groups
  Or manage Permission Sets in IAM Identity Center

  # Group-based management
  aws iam create-group --group-name Backend-Developers
  aws iam attach-group-policy \
    --group-name Backend-Developers \
    --policy-arn arn:aws:iam::123456789012:policy/BackendDevAccess
  aws iam add-user-to-group \
    --group-name Backend-Developers \
    --user-name new-developer
```

### Anti-Pattern 4: Privileged Access Without MFA

```
[Bad example]
  Granting AdministratorAccess policy to users without MFA
  → Full privileges can be taken over with just a compromised password

[Good example]
  Apply an MFA enforcement policy to all users:
  {
    "Sid": "DenyAllExceptMFASetup",
    "Effect": "Deny",
    "NotAction": [
      "iam:CreateVirtualMFADevice",
      "iam:EnableMFADevice",
      "iam:GetUser",
      "iam:ListMFADevices",
      "sts:GetSessionToken"
    ],
    "Resource": "*",
    "Condition": {
      "BoolIfExists": {
        "aws:MultiFactorAuthPresent": "false"
      }
    }
  }
```

### Anti-Pattern 5: Not Using Allow Lists in SCPs

```
[Bad example]
  Creating only Deny lists in SCPs
  → Need to add Deny entries every time a new service is released
  → Easy to miss entries

[Good example]
  Use Allow list approach (guardrail-style) in SCPs:
  - Start with FullAWSAccess SCP as baseline permission
  - Add Deny statements on top to restrict
  - Explicitly define region restrictions and prohibitions on dangerous operations
```

---

## 12. Practical Scenario: Multi-Account IAM Design

### 12.1 IAM Design Scaled to Startup Growth

```
Phase 1: Single Account (initial)
┌─────────────────────────────────────┐
│ Single Account                       │
│ ├── IAM User (MFA required)         │
│ ├── IAM Group: Admins               │
│ ├── IAM Group: Developers           │
│ └── IAM Role: Lambda/ECS            │
└─────────────────────────────────────┘

Phase 2: 2-3 Accounts (growth phase)
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Prod     │  │ Dev      │  │ Shared   │
│ Account  │  │ Account  │  │ Services │
│          │  │          │  │          │
└──────────┘  └──────────┘  └──────────┘
  ↑ Isolated via AssumeRole

Phase 3: Organizations (expansion phase)
┌─── Management Account ───────────────┐
│ Organizations, Billing, SSO           │
├─── Security OU ──────────────────────┤
│ SecurityHub, GuardDuty, Log Archive   │
├─── Workloads OU ─────────────────────┤
│ ├── Prod OU: App-A, App-B            │
│ ├── Staging OU: App-A, App-B         │
│ └── Dev OU: App-A, App-B             │
├─── Infrastructure OU ────────────────┤
│ Transit Gateway, Shared VPC          │
└───────────────────────────────────────┘
```

---

## 13. FAQ

### Q1: Should I use IAM Roles or IAM Users?

**A:** As a rule, use IAM Roles. Always attach roles to AWS services (EC2, Lambda, ECS). Human operators should authenticate via IAM Identity Center (formerly SSO) with federated authentication. Create IAM Users only when there is no alternative for external system integration, and make MFA and access key rotation mandatory.

### Q2: Why is ExternalId needed for cross-account access?

**A:** ExternalId prevents the "Confused Deputy" attack. When a third-party service accesses a customer's AWS account, without ExternalId an attacker could use the same third-party service to assume another customer's role. ExternalId should be a unique value per customer, configured in the Condition of the role's trust policy.

### Q3: How do I protect the root account in production?

**A:** (1) Set a strong password on the root account, (2) Enable a hardware MFA device, (3) Delete root account access keys, (4) Restrict root account usage to only operations that cannot be performed by IAM (such as creating AWS Organizations or changing account payment settings), (5) Monitor root account usage with CloudTrail and set up alerts.

### Q4: What is the difference between Permission Boundary and SCP?

**A:** Permission Boundary is a permission ceiling configured per IAM entity (User/Role), used by account admins to delegate permissions to developers. SCP is a guardrail configured per Organizations OU/Account, used for organization-wide governance. SCPs apply to the root user, but Permission Boundaries do not apply to the root user.

### Q5: What should I watch out for when introducing ABAC?

**A:** (1) Consistent tagging across all resources is mandatory (enforce tagging policies via SCP), (2) Verify in advance which services support ABAC, (3) Since tag changes directly affect access permissions, strictly control who can modify tags, (4) Migration from existing RBAC should be done incrementally with a parallel operation period.

### Q6: How do I deal with IAM policy size limits?

**A:** Managed policies have a maximum of 6,144 characters (excluding whitespace). Solutions: (1) Use wildcards (`s3:Get*`, etc.), (2) Use wildcards in resource ARNs for bulk specification, (3) Split into multiple managed policies (up to 10 per role), (4) Combine with inline policies (up to 10,240 characters separately), (5) Use Conditions for dynamic control to reduce Action/Resource entries.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how things work.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this knowledge applied in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|-----------|
| Least Privilege | Allow only required actions and resources. Validate with IAM Access Analyzer |
| Authentication | IAM Role + OIDC Federation. Prohibit use of long-term keys |
| Policy Evaluation | Evaluated in order: explicit Deny > SCP > Boundary > Allow |
| Cross-Account | AssumeRole + ExternalId + conditional trust policy |
| Permission Boundary | Safety guard for permission delegation. Grants autonomy to developers while enforcing limits |
| ABAC | Tag-based dynamic access control. Scalable in large-scale environments |
| Identity Center | SSO for multi-account environments. Manage permissions with Permission Sets |
| SCP | Organization-level guardrails. Region restrictions and prohibition of dangerous operations |
| Monitoring | Anomaly detection with CloudTrail + IAM Access Analyzer + EventBridge |
| Root Account | Hardware MFA + prohibit daily use + monitoring |
| IaC | Manage IAM as code with CDK/CloudFormation. Enables review |

---

## Further Reading

- [01-secrets-management.md](./01-secrets-management.md) — Secret management integrated with IAM
- [02-waf-shield.md](./02-waf-shield.md) — Application-layer security
- [01-well-architected.md](../09-cost/01-well-architected.md) — The Security pillar

---

## References

1. **AWS Official Documentation** — IAM User Guide
   https://docs.aws.amazon.com/IAM/latest/UserGuide/
2. **AWS IAM Best Practices** — Security best practices
   https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html
3. **AWS re:Invent — Become an IAM Policy Master** — Advanced IAM policy design
   https://www.youtube.com/watch?v=YQsK4MtsELU
4. **AWS Organizations User Guide** — SCP design patterns
   https://docs.aws.amazon.com/organizations/latest/userguide/
5. **AWS IAM Identity Center User Guide** — SSO configuration and operations
   https://docs.aws.amazon.com/singlesignon/latest/userguide/
6. **AWS IAM Access Analyzer** — External access and unused permission detection
   https://docs.aws.amazon.com/IAM/latest/UserGuide/what-is-access-analyzer.html

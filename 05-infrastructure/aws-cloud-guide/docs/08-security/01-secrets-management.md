# Secrets Management — Secrets Manager / Parameter Store / KMS

> A practical guide for safely managing the lifecycle of secrets (sensitive information) in AWS, and eliminating hardcoded credentials from applications.

---

## What You Will Learn

1. Automatic rotation and retrieval patterns for secrets using **AWS Secrets Manager**
2. How to choose between **Systems Manager Parameter Store** and Secrets Manager, and hierarchical parameter design
3. Envelope encryption and key policy design with **AWS KMS (Key Management Service)**
4. Secrets management strategies for **multi-account and multi-region** environments
5. Best practices for **auditing, monitoring, and auto-remediation** of secrets


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [AWS IAM Deep Dive](./00-iam-deep-dive.md)

---

## 1. Overview of Secrets Management

### 1.1 Why Secrets Management Is Necessary

```
┌──────────────────────────────────────────────────────┐
│              Anti-Pattern: Hardcoding                 │
│                                                      │
│   app.py                                             │
│   ┌──────────────────────────────────────┐           │
│   │ DB_PASSWORD = "P@ssw0rd123"          │ ← Danger! │
│   │ API_KEY     = "sk-abc123..."         │           │
│   └──────────────────────────────────────┘           │
│        │                                             │
│        ▼                                             │
│   Push to Git repository → Risk of exposure          │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│              Best Practice: External Management       │
│                                                      │
│   app.py                                             │
│   ┌──────────────────────────────────────┐           │
│   │ secret = get_secret("prod/db/pass")  │ ← Safe    │
│   └──────────────────┬───────────────────┘           │
│                      │ API Call                      │
│                      ▼                               │
│   ┌──────────────────────────────────────┐           │
│   │  AWS Secrets Manager / SSM           │           │
│   │  (Encryption, Auditing, Rotation)    │           │
│   └──────────────────────────────────────┘           │
└──────────────────────────────────────────────────────┘
```

### 1.2 Service Selection Flow

```
I want to manage a secret
        │
        ├─ Is automatic rotation required?
        │       │
        │       ├─ Yes → Secrets Manager
        │       │
        │       └─ No ─┐
        │               │
        ├─ Configuration value or sensitive value?
        │       │
        │       ├─ Configuration value (Feature Flag, etc.) → Parameter Store (String)
        │       │
        │       └─ Sensitive value (password, etc.)        → Parameter Store (SecureString)
        │                                                     or Secrets Manager
        │
        └─ Is encryption key management needed? → KMS
```

### 1.3 Secret Lifecycle

```
┌──────────────────────────────────────────────────────────┐
│              Secret Lifecycle                            │
│                                                          │
│  1. Generation                                           │
│     ├── Secrets Manager GenerateSecretString             │
│     ├── KMS GenerateRandom                               │
│     └── Applying strong password policies                │
│                                                          │
│  2. Storage                                              │
│     ├── Secrets Manager (KMS encrypted)                  │
│     ├── Parameter Store SecureString (KMS encrypted)     │
│     └── History management through versioning            │
│                                                          │
│  3. Distribution                                         │
│     ├── Dynamic retrieval via SDK/CLI                    │
│     ├── Environment variable injection for ECS/Lambda    │
│     └── Access via VPC Endpoint                          │
│                                                          │
│  4. Rotation                                             │
│     ├── Automatic rotation in Secrets Manager            │
│     ├── Custom rotation via Lambda functions             │
│     └── Multi-user rotation strategy                     │
│                                                          │
│  5. Auditing                                             │
│     ├── Access logs via CloudTrail                       │
│     ├── Compliance monitoring via Config Rules           │
│     └── Anomaly detection alerts via EventBridge         │
│                                                          │
│  6. Revocation                                           │
│     ├── Scheduled deletion (7-30 day recovery window)    │
│     ├── Immediate access revocation (resource policy change) │
│     └── KMS key deactivation                             │
└──────────────────────────────────────────────────────────┘
```

---

## 2. AWS Secrets Manager

### 2.1 Creating a Secret (CLI)

```bash
# Create a secret
aws secretsmanager create-secret \
  --name "prod/myapp/database" \
  --description "Production DB credentials" \
  --secret-string '{"username":"admin","password":"S3cur3P@ss!","host":"db.example.com","port":5432}' \
  --kms-key-id "alias/prod-database-key" \
  --tags Key=Environment,Value=Production Key=Application,Value=myapp

# Retrieve a secret
aws secretsmanager get-secret-value \
  --secret-id "prod/myapp/database" \
  --query 'SecretString' \
  --output text

# Retrieve a specific version
aws secretsmanager get-secret-value \
  --secret-id "prod/myapp/database" \
  --version-stage "AWSPREVIOUS"

# Update a secret
aws secretsmanager update-secret \
  --secret-id "prod/myapp/database" \
  --secret-string '{"username":"admin","password":"N3wS3cur3P@ss!","host":"db.example.com","port":5432}'

# List secrets (with filter)
aws secretsmanager list-secrets \
  --filters Key=name,Values=prod/ \
  --query 'SecretList[*].{Name:Name,Description:Description,LastRotated:LastRotatedDate}'

# Delete a secret (with recovery window)
aws secretsmanager delete-secret \
  --secret-id "prod/myapp/database" \
  --recovery-window-in-days 7

# Restore a deleted secret
aws secretsmanager restore-secret \
  --secret-id "prod/myapp/database"
```

### 2.2 Retrieving Secrets from Python

```python
import json
import boto3
from botocore.exceptions import ClientError

def get_secret(secret_name: str, region: str = "ap-northeast-1") -> dict:
    """Retrieve a secret from Secrets Manager"""
    client = boto3.client("secretsmanager", region_name=region)

    try:
        response = client.get_secret_value(SecretId=secret_name)
        secret = json.loads(response["SecretString"])
        return secret
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        if error_code == "ResourceNotFoundException":
            raise ValueError(f"Secret '{secret_name}' not found")
        elif error_code == "DecryptionFailureException":
            raise PermissionError("KMS decryption failed")
        raise

# Usage example
creds = get_secret("prod/myapp/database")
connection_string = (
    f"postgresql://{creds['username']}:{creds['password']}"
    f"@{creds['host']}:{creds['port']}/mydb"
)
```

### 2.3 Implementing Client-Side Caching

```python
from aws_secretsmanager_caching import SecretCache, SecretCacheConfig
import boto3

# Cache configuration
cache_config = SecretCacheConfig(
    max_cache_size=1000,           # Maximum number of secrets to cache
    exception_retry_delay_base=1,   # Retry interval (seconds)
    exception_retry_growth_factor=2,
    exception_retry_delay_max=3600,
    default_secret_version_stage="AWSCURRENT",
    secret_refresh_interval=3600,   # Cache TTL (seconds)
    secret_version_stage_refresh_interval=3600,
)

# Initialize cache
client = boto3.client("secretsmanager", region_name="ap-northeast-1")
cache = SecretCache(config=cache_config, client=client)

# Retrieve secret via cache (no API call within TTL)
secret_string = cache.get_secret_string("prod/myapp/database")
secret_dict = json.loads(secret_string)

# For binary secrets
binary_secret = cache.get_secret_binary("prod/myapp/certificate")
```

### 2.4 Retrieving Secrets via Lambda Extensions

```python
# Retrieving secrets via Lambda Extension (cold start optimization)
import urllib3
import json
import os

# AWS Parameters and Secrets Lambda Extension endpoint
SECRETS_EXTENSION_HTTP_PORT = 2773
SECRETS_EXTENSION_ENDPOINT = f"http://localhost:{SECRETS_EXTENSION_HTTP_PORT}"

http = urllib3.PoolManager()

def get_secret_from_extension(secret_id: str) -> dict:
    """Retrieve a secret via Lambda Extension (with caching)"""
    headers = {
        "X-Aws-Parameters-Secrets-Token": os.environ.get("AWS_SESSION_TOKEN", ""),
    }
    url = (
        f"{SECRETS_EXTENSION_ENDPOINT}/secretsmanager/get"
        f"?secretId={secret_id}"
    )

    response = http.request("GET", url, headers=headers)
    body = json.loads(response.data.decode("utf-8"))
    return json.loads(body["SecretString"])

def handler(event, context):
    """Lambda handler"""
    # Extension automatically caches, so API is not called every time
    db_creds = get_secret_from_extension("prod/myapp/database")
    api_key = get_secret_from_extension("prod/myapp/api-key")

    return {
        "statusCode": 200,
        "body": json.dumps({"message": "Success"})
    }
```

```yaml
# Adding Lambda Extension in a SAM template
AWSTemplateFormatVersion: "2010-09-09"
Transform: AWS::Serverless-2016-10-31
Resources:
  MyFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: index.handler
      Runtime: python3.12
      Layers:
        # AWS Parameters and Secrets Lambda Extension
        - arn:aws:lambda:ap-northeast-1:133490724326:layer:AWS-Parameters-and-Secrets-Lambda-Extension:11
      Environment:
        Variables:
          PARAMETERS_SECRETS_EXTENSION_CACHE_ENABLED: "true"
          PARAMETERS_SECRETS_EXTENSION_CACHE_SIZE: "1000"
          PARAMETERS_SECRETS_EXTENSION_HTTP_PORT: "2773"
          SECRETS_MANAGER_TTL: "300"  # 5-minute cache
      Policies:
        - Version: "2012-10-17"
          Statement:
            - Effect: Allow
              Action: secretsmanager:GetSecretValue
              Resource: "arn:aws:secretsmanager:ap-northeast-1:*:secret:prod/myapp/*"
            - Effect: Allow
              Action: kms:Decrypt
              Resource: "arn:aws:kms:ap-northeast-1:*:key/*"
```

### 2.5 Automatic Rotation (CloudFormation)

```yaml
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  DBSecret:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: prod/myapp/database
      GenerateSecretString:
        SecretStringTemplate: '{"username": "admin"}'
        GenerateStringKey: password
        PasswordLength: 32
        ExcludeCharacters: '"@/\'

  DBSecretRotation:
    Type: AWS::SecretsManager::RotationSchedule
    Properties:
      SecretId: !Ref DBSecret
      RotationLambdaARN: !GetAtt RotationFunction.Arn
      RotationRules:
        AutomaticallyAfterDays: 30    # Automatic rotation every 30 days

  RotationFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: secret-rotation-handler
      Runtime: python3.12
      Handler: index.handler
      Role: !GetAtt RotationRole.Arn
      Timeout: 60
      VpcConfig:
        SubnetIds:
          - !Ref PrivateSubnet1
          - !Ref PrivateSubnet2
        SecurityGroupIds:
          - !Ref RotationSecurityGroup
      Code:
        ZipFile: |
          import boto3
          import json
          import logging

          logger = logging.getLogger()
          logger.setLevel(logging.INFO)

          def handler(event, context):
              """Secrets Manager rotation Lambda"""
              step = event["Step"]
              secret_id = event["SecretId"]
              token = event["ClientRequestToken"]

              client = boto3.client("secretsmanager")

              if step == "createSecret":
                  create_secret(client, secret_id, token)
              elif step == "setSecret":
                  set_secret(client, secret_id, token)
              elif step == "testSecret":
                  test_secret(client, secret_id, token)
              elif step == "finishSecret":
                  finish_secret(client, secret_id, token)

          def create_secret(client, secret_id, token):
              """Generate a new password and save it as PENDING version"""
              current = client.get_secret_value(
                  SecretId=secret_id, VersionStage="AWSCURRENT"
              )
              current_secret = json.loads(current["SecretString"])

              # Generate a new password
              new_password = client.get_random_password(
                  PasswordLength=32,
                  ExcludeCharacters='"@/\\'
              )["RandomPassword"]

              current_secret["password"] = new_password
              client.put_secret_value(
                  SecretId=secret_id,
                  ClientRequestToken=token,
                  SecretString=json.dumps(current_secret),
                  VersionStages=["AWSPENDING"]
              )
              logger.info(f"createSecret: New secret version created for {secret_id}")

          def set_secret(client, secret_id, token):
              """Update the database password to the new value"""
              pending = client.get_secret_value(
                  SecretId=secret_id, VersionId=token, VersionStage="AWSPENDING"
              )
              secret = json.loads(pending["SecretString"])

              # Change the PostgreSQL password
              import psycopg2
              conn = psycopg2.connect(
                  host=secret["host"],
                  port=secret["port"],
                  user="admin_master",  # Connect with the master user
                  password=get_master_password(client),
                  database="mydb"
              )
              conn.autocommit = True
              with conn.cursor() as cur:
                  cur.execute(
                      f"ALTER USER {secret['username']} WITH PASSWORD %s",
                      (secret["password"],)
                  )
              conn.close()
              logger.info(f"setSecret: DB password updated for {secret_id}")

          def test_secret(client, secret_id, token):
              """Test connection with the new password"""
              pending = client.get_secret_value(
                  SecretId=secret_id, VersionId=token, VersionStage="AWSPENDING"
              )
              secret = json.loads(pending["SecretString"])

              import psycopg2
              conn = psycopg2.connect(
                  host=secret["host"],
                  port=secret["port"],
                  user=secret["username"],
                  password=secret["password"],
                  database="mydb"
              )
              conn.close()
              logger.info(f"testSecret: Connection test passed for {secret_id}")

          def finish_secret(client, secret_id, token):
              """Move the AWSCURRENT label to the new version"""
              metadata = client.describe_secret(SecretId=secret_id)
              current_version = None
              for version_id, stages in metadata["VersionIdsToStages"].items():
                  if "AWSCURRENT" in stages:
                      current_version = version_id
                      break

              client.update_secret_version_stage(
                  SecretId=secret_id,
                  VersionStage="AWSCURRENT",
                  MoveToVersionId=token,
                  RemoveFromVersionId=current_version
              )
              logger.info(f"finishSecret: AWSCURRENT moved to {token}")

  RotationRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: Allow
            Principal:
              Service: lambda.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole
      Policies:
        - PolicyName: RotationPolicy
          PolicyDocument:
            Version: "2012-10-17"
            Statement:
              - Effect: Allow
                Action:
                  - secretsmanager:GetSecretValue
                  - secretsmanager:PutSecretValue
                  - secretsmanager:UpdateSecretVersionStage
                  - secretsmanager:DescribeSecret
                  - secretsmanager:GetRandomPassword
                Resource: !Ref DBSecret
              - Effect: Allow
                Action: kms:Decrypt
                Resource: "*"
```

### 2.6 Rotation Flow

```
┌─────────────────────────────────────────────────────────┐
│            Secrets Manager Rotation 4 Steps             │
│                                                         │
│  Step 1: createSecret                                   │
│  ┌───────────┐    Generate new password  ┌──────────────┐  │
│  │ Secrets   │ ──────────────────────── → │ AWSPENDING   │  │
│  │ Manager   │                            │ (new version)│  │
│  └───────────┘                            └──────────────┘  │
│       │                                                 │
│  Step 2: setSecret                                      │
│       │    Update the DB password to the new value      │
│       ▼                                                 │
│  ┌───────────┐                        ┌──────────────┐  │
│  │ RDS / DB  │ ← ALTER USER ... ──── │ Lambda       │  │
│  └───────────┘                        └──────────────┘  │
│       │                                                 │
│  Step 3: testSecret                                     │
│       │    Test connection with the new password        │
│       ▼                                                 │
│  Step 4: finishSecret                                   │
│       │    Move the AWSCURRENT label to the new version │
│       ▼                                                 │
│  ┌──────────────┐                                       │
│  │ AWSCURRENT   │  ← Label move complete                │
│  │ (new version)│                                       │
│  └──────────────┘                                       │
└─────────────────────────────────────────────────────────┘
```

### 2.7 Multi-User Rotation Strategy

```
┌──────────────────────────────────────────────────────────┐
│      Multi-User Rotation (Alternating Users)             │
│                                                          │
│  Initial state:                                          │
│  ┌──────────────────────┐                                │
│  │ app_user_1 (CURRENT) │  ← App connects with this user │
│  │ app_user_2 (STANDBY) │  ← Waiting on standby          │
│  └──────────────────────┘                                │
│                                                          │
│  After rotation:                                         │
│  ┌──────────────────────┐                                │
│  │ app_user_1 (STANDBY) │  ← Password changed, standby   │
│  │ app_user_2 (CURRENT) │  ← App switches to this user   │
│  └──────────────────────┘                                │
│                                                          │
│  Benefits:                                               │
│  - No downtime during rotation                           │
│  - Easy rollback                                         │
│  - Old connections remain valid while new ones start     │
└──────────────────────────────────────────────────────────┘
```

### 2.8 Secrets Manager Resource Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCrossAccountRead",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::222222222222:role/AppRole"
      },
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "secretsmanager:VersionStage": "AWSCURRENT"
        }
      }
    },
    {
      "Sid": "DenyNonVPCEndpoint",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "secretsmanager:*",
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "aws:sourceVpce": "vpce-xxxxxxxxxxxx"
        }
      }
    }
  ]
}
```

```bash
# Set a resource policy
aws secretsmanager put-resource-policy \
  --secret-id "prod/myapp/database" \
  --resource-policy file://secret-policy.json

# Validate a resource policy
aws secretsmanager validate-resource-policy \
  --resource-policy file://secret-policy.json
```

### 2.9 Secret Replication

```bash
# Multi-region replication
aws secretsmanager replicate-secret-to-regions \
  --secret-id "prod/myapp/database" \
  --add-replica-regions '[
    {"Region": "us-west-2", "KmsKeyId": "alias/prod-key-usw2"},
    {"Region": "eu-west-1", "KmsKeyId": "alias/prod-key-euw1"}
  ]'

# Check replica status
aws secretsmanager describe-secret \
  --secret-id "prod/myapp/database" \
  --query 'ReplicationStatus'

# Remove a replica
aws secretsmanager remove-regions-from-replication \
  --secret-id "prod/myapp/database" \
  --remove-replica-regions "eu-west-1"
```

---

## 3. Systems Manager Parameter Store

### 3.1 Hierarchical Parameter Design

```bash
# Create hierarchical parameters
aws ssm put-parameter \
  --name "/myapp/prod/database/host" \
  --value "db.example.com" \
  --type String

aws ssm put-parameter \
  --name "/myapp/prod/database/password" \
  --value "S3cur3P@ss!" \
  --type SecureString \
  --key-id "alias/myapp-key"    # Specify a KMS key

aws ssm put-parameter \
  --name "/myapp/prod/database/port" \
  --value "5432" \
  --type String \
  --tags Key=Environment,Value=Production

# Bulk retrieval by hierarchy
aws ssm get-parameters-by-path \
  --path "/myapp/prod/database" \
  --with-decryption \
  --recursive

# Retrieve multiple parameters at once
aws ssm get-parameters \
  --names "/myapp/prod/database/host" "/myapp/prod/database/port" \
  --with-decryption

# Get parameter history
aws ssm get-parameter-history \
  --name "/myapp/prod/database/password" \
  --with-decryption \
  --query 'Parameters[*].{Version:Version,Value:Value,LastModifiedDate:LastModifiedDate}'
```

### 3.2 Best Practices for Hierarchical Design

```
Recommended hierarchy structure:

/
├── myapp/                          # Application name
│   ├── shared/                     # Common across all environments
│   │   ├── log-level               # String: "INFO"
│   │   └── feature-flags/          # Feature Flags
│   │       ├── dark-mode           # String: "true"
│   │       └── new-ui              # String: "false"
│   │
│   ├── prod/                       # Production environment
│   │   ├── database/
│   │   │   ├── host                # String: "prod-db.xxx.rds.amazonaws.com"
│   │   │   ├── port                # String: "5432"
│   │   │   └── password            # SecureString: "xxx"
│   │   ├── redis/
│   │   │   ├── endpoint            # String: "prod-redis.xxx.cache.amazonaws.com"
│   │   │   └── auth-token          # SecureString: "xxx"
│   │   └── api-keys/
│   │       ├── stripe              # SecureString: "sk_live_xxx"
│   │       └── sendgrid            # SecureString: "SG.xxx"
│   │
│   └── staging/                    # Staging environment
│       ├── database/
│       │   ├── host                # String: "staging-db.xxx.rds.amazonaws.com"
│       │   └── password            # SecureString: "xxx"
│       └── api-keys/
│           └── stripe              # SecureString: "sk_test_xxx"

IAM policy-based hierarchy control:
- /myapp/prod/*    → Production team only
- /myapp/staging/* → Development team also allowed
- /myapp/shared/*  → All teams can read
```

### 3.3 Hierarchical Parameter Retrieval in Python

```python
import boto3
from typing import Any

class ParameterStoreClient:
    """Client that retrieves hierarchical parameters from Parameter Store as a dict"""

    def __init__(self, region: str = "ap-northeast-1"):
        self.client = boto3.client("ssm", region_name=region)

    def get_parameters_by_path(
        self, path: str, decrypt: bool = True
    ) -> dict[str, Any]:
        """Return parameters under the specified path as a dictionary"""
        parameters = {}
        paginator = self.client.get_paginator("get_parameters_by_path")

        for page in paginator.paginate(
            Path=path,
            Recursive=True,
            WithDecryption=decrypt,
        ):
            for param in page["Parameters"]:
                # Use the tail of the path as the key
                key = param["Name"].replace(path, "").lstrip("/")
                parameters[key] = param["Value"]

        return parameters

    def get_config(self, app: str, env: str) -> dict:
        """Retrieve application configuration per environment"""
        # Shared settings
        shared = self.get_parameters_by_path(f"/{app}/shared")
        # Environment-specific settings
        env_specific = self.get_parameters_by_path(f"/{app}/{env}")

        # Environment-specific overrides shared
        config = {**shared, **env_specific}
        return config

# Usage example
ssm = ParameterStoreClient()
config = ssm.get_config("myapp", "prod")
# → {"log-level": "INFO", "database/host": "prod-db.xxx", ...}
```

### 3.4 Referencing in ECS Task Definitions

```json
{
  "containerDefinitions": [
    {
      "name": "myapp",
      "image": "123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/myapp:latest",
      "secrets": [
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:ssm:ap-northeast-1:123456789012:parameter/myapp/prod/database/password"
        },
        {
          "name": "API_KEY",
          "valueFrom": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:prod/myapp/api-key-AbCdEf"
        }
      ],
      "environment": [
        {
          "name": "DB_HOST",
          "value": "db.example.com"
        }
      ]
    }
  ]
}
```

### 3.5 Dynamic References in CloudFormation

```yaml
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  # Reference a Parameter Store value
  MyRDSInstance:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: myapp-db
      Engine: postgres
      MasterUsername: "{{resolve:ssm:/myapp/prod/database/username}}"
      MasterUserPassword: "{{resolve:ssm-secure:/myapp/prod/database/password}}"
      DBInstanceClass: db.r6g.large

  # Reference a Secrets Manager value
  MyRDSInstanceV2:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: myapp-db-v2
      Engine: postgres
      MasterUsername: "{{resolve:secretsmanager:prod/myapp/database:SecretString:username}}"
      MasterUserPassword: "{{resolve:secretsmanager:prod/myapp/database:SecretString:password}}"
      DBInstanceClass: db.r6g.large

  # Secrets Manager with version specification
  MySecret:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: prod/myapp/database

  # Direct integration between RDS and Secrets Manager
  SecretRDSAttachment:
    Type: AWS::SecretsManager::SecretTargetAttachment
    Properties:
      SecretId: !Ref MySecret
      TargetId: !Ref MyRDSInstanceV2
      TargetType: AWS::RDS::DBInstance
```

---

## 4. AWS KMS (Key Management Service)

### 4.1 How Envelope Encryption Works

```
┌──────────────────────────────────────────────────────────┐
│              Envelope Encryption                         │
│                                                          │
│  ┌─────────────┐                                         │
│  │ CMK (Master)│  Stored inside KMS (cannot be exported) │
│  │  Key        │                                         │
│  └──────┬──────┘                                         │
│         │ GenerateDataKey API                            │
│         ▼                                                │
│  ┌─────────────────────────────────┐                     │
│  │ Data Key (plaintext) │ Data Key │                     │
│  │                      │(encrypted│                     │
│  └────────┬─────────────┴──────┬───┘                     │
│           │                   │                          │
│    Encrypt data with          │ Store encrypted Data Key  │
│    plaintext Data Key         │ alongside the data        │
│           │                   │                          │
│           ▼                   ▼                          │
│  ┌──────────────────────────────┐                        │
│  │ Encrypted data + Encrypted Data Key │ ← Save to S3, etc. │
│  └──────────────────────────────┘                        │
│                                                          │
│  * Plaintext Data Key is immediately deleted from memory │
└──────────────────────────────────────────────────────────┘
```

### 4.2 Creating a KMS Key and Its Policy

```bash
# Create a customer-managed key
aws kms create-key \
  --description "MyApp encryption key" \
  --key-usage ENCRYPT_DECRYPT \
  --key-spec SYMMETRIC_DEFAULT \
  --tags TagKey=Environment,TagValue=Production TagKey=Application,TagValue=myapp

# Set an alias
aws kms create-alias \
  --alias-name alias/myapp-key \
  --target-key-id "arn:aws:kms:ap-northeast-1:123456789012:key/xxxx-xxxx"

# Enable automatic key rotation (annually)
aws kms enable-key-rotation \
  --key-id alias/myapp-key

# Check rotation status
aws kms get-key-rotation-status \
  --key-id alias/myapp-key

# Set key policy
aws kms put-key-policy \
  --key-id alias/myapp-key \
  --policy-name default \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "EnableRootAccountFullAccess",
        "Effect": "Allow",
        "Principal": {"AWS": "arn:aws:iam::123456789012:root"},
        "Action": "kms:*",
        "Resource": "*"
      },
      {
        "Sid": "AllowKeyAdministration",
        "Effect": "Allow",
        "Principal": {"AWS": "arn:aws:iam::123456789012:role/KeyAdminRole"},
        "Action": [
          "kms:Create*", "kms:Describe*", "kms:Enable*", "kms:List*",
          "kms:Put*", "kms:Update*", "kms:Revoke*", "kms:Disable*",
          "kms:Get*", "kms:Delete*", "kms:TagResource", "kms:UntagResource",
          "kms:ScheduleKeyDeletion", "kms:CancelKeyDeletion"
        ],
        "Resource": "*"
      },
      {
        "Sid": "AllowKeyUsage",
        "Effect": "Allow",
        "Principal": {"AWS": "arn:aws:iam::123456789012:role/MyAppRole"},
        "Action": [
          "kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*",
          "kms:GenerateDataKey*", "kms:DescribeKey"
        ],
        "Resource": "*"
      },
      {
        "Sid": "AllowServiceIntegration",
        "Effect": "Allow",
        "Principal": {"AWS": "arn:aws:iam::123456789012:role/MyAppRole"},
        "Action": [
          "kms:CreateGrant", "kms:ListGrants", "kms:RevokeGrant"
        ],
        "Resource": "*",
        "Condition": {
          "Bool": {"kms:GrantIsForAWSResource": "true"}
        }
      }
    ]
  }'
```

### 4.3 Envelope Encryption in Python

```python
import boto3
from cryptography.fernet import Fernet
import base64

kms = boto3.client("kms", region_name="ap-northeast-1")

def encrypt_data(plaintext: str, key_id: str) -> dict:
    """Encrypt data using envelope encryption"""
    # 1. Generate a data key
    response = kms.generate_data_key(
        KeyId=key_id,
        KeySpec="AES_256"
    )
    plaintext_key = response["Plaintext"]        # Plaintext data key
    encrypted_key = response["CiphertextBlob"]    # Encrypted data key

    # 2. Encrypt the data with the plaintext data key
    fernet_key = base64.urlsafe_b64encode(plaintext_key)
    f = Fernet(fernet_key)
    encrypted_data = f.encrypt(plaintext.encode())

    # 3. Delete the plaintext data key from memory
    del plaintext_key, fernet_key

    return {
        "encrypted_data": base64.b64encode(encrypted_data).decode(),
        "encrypted_key": base64.b64encode(encrypted_key).decode()
    }

def decrypt_data(encrypted_payload: dict) -> str:
    """Decrypt data that was encrypted with envelope encryption"""
    encrypted_key = base64.b64decode(encrypted_payload["encrypted_key"])
    encrypted_data = base64.b64decode(encrypted_payload["encrypted_data"])

    # 1. Decrypt the data key with KMS
    response = kms.decrypt(CiphertextBlob=encrypted_key)
    plaintext_key = response["Plaintext"]

    # 2. Decrypt the data with the decrypted data key
    fernet_key = base64.urlsafe_b64encode(plaintext_key)
    f = Fernet(fernet_key)
    decrypted = f.decrypt(encrypted_data)

    del plaintext_key, fernet_key
    return decrypted.decode()
```

### 4.4 Using the AWS Encryption SDK

```python
# More robust encryption using the AWS Encryption SDK
import aws_encryption_sdk
from aws_encryption_sdk import CommitmentPolicy

# Initialize client
client = aws_encryption_sdk.EncryptionSDKClient(
    commitment_policy=CommitmentPolicy.REQUIRE_ENCRYPT_REQUIRE_DECRYPT
)

# KMS Key Provider
kms_key_provider = aws_encryption_sdk.StrictAwsKmsMasterKeyProvider(
    key_ids=[
        "arn:aws:kms:ap-northeast-1:123456789012:key/xxxx-xxxx",
        "arn:aws:kms:us-west-2:123456789012:key/yyyy-yyyy",  # Multi-region key
    ]
)

def encrypt_with_sdk(plaintext: str, context: dict) -> bytes:
    """Encrypt data with the Encryption SDK (with encryption context)"""
    ciphertext, encryptor_header = client.encrypt(
        source=plaintext.encode(),
        key_provider=kms_key_provider,
        encryption_context=context,  # Context for tamper detection
    )
    return ciphertext

def decrypt_with_sdk(ciphertext: bytes, expected_context: dict) -> str:
    """Decrypt data with the Encryption SDK"""
    plaintext, decryptor_header = client.decrypt(
        source=ciphertext,
        key_provider=kms_key_provider,
    )
    # Validate the encryption context
    for key, value in expected_context.items():
        assert decryptor_header.encryption_context.get(key) == value, \
            f"Encryption context mismatch for key: {key}"

    return plaintext.decode()

# Usage example
context = {
    "purpose": "user-data-encryption",
    "tenant": "company-a",
    "data-type": "pii",
}
encrypted = encrypt_with_sdk("Personal information data", context)
decrypted = decrypt_with_sdk(encrypted, context)
```

### 4.5 Key Separation Design by Purpose

```
┌──────────────────────────────────────────────────────────┐
│              KMS Key Separation Design                   │
│                                                          │
│  Keys by purpose:                                        │
│  ┌──────────────────┐                                    │
│  │ alias/prod-db    │ → RDS, Secrets Manager (DB credentials) │
│  │ alias/prod-s3    │ → S3 bucket encryption              │
│  │ alias/prod-ebs   │ → EBS volume encryption             │
│  │ alias/prod-logs  │ → CloudWatch Logs encryption        │
│  │ alias/prod-sqs   │ → SQS message encryption            │
│  │ alias/prod-sign  │ → Signing (RSA/ECC)                 │
│  └──────────────────┘                                    │
│                                                          │
│  Benefits:                                               │
│  - Achieve least privilege through key policies          │
│  - Disabling one key does not affect all services        │
│  - Easier to identify access purpose in audit logs       │
│  - Easier to meet compliance requirements (PCI DSS, etc.)│
└──────────────────────────────────────────────────────────┘
```

---

## 5. Secrets Management with CDK

### 5.1 Defining Secrets in CDK

```typescript
import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export class SecretsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a KMS key
    const dbEncryptionKey = new kms.Key(this, 'DBEncryptionKey', {
      alias: 'prod-database-key',
      description: 'Encryption key for database secrets',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Create a secret in Secrets Manager
    const dbSecret = new secretsmanager.Secret(this, 'DBSecret', {
      secretName: 'prod/myapp/database',
      description: 'Production database credentials',
      encryptionKey: dbEncryptionKey,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'admin' }),
        generateStringKey: 'password',
        passwordLength: 32,
        excludeCharacters: '"@/\\',
      },
    });

    // Integrate with an RDS instance
    const dbInstance = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_4,
      }),
      instanceType: cdk.aws_ec2.InstanceType.of(
        cdk.aws_ec2.InstanceClass.R6G,
        cdk.aws_ec2.InstanceSize.LARGE,
      ),
      credentials: rds.Credentials.fromSecret(dbSecret),
      storageEncryptionKey: dbEncryptionKey,
    });

    // Configure automatic rotation
    dbSecret.addRotationSchedule('RotationSchedule', {
      automaticallyAfter: cdk.Duration.days(30),
      hostedRotation: secretsmanager.HostedRotation.postgreSqlSingleUser({
        functionName: 'db-secret-rotation',
      }),
    });

    // Parameter Store parameter
    new ssm.StringParameter(this, 'DBHost', {
      parameterName: '/myapp/prod/database/host',
      stringValue: dbInstance.instanceEndpoint.hostname,
      tier: ssm.ParameterTier.STANDARD,
    });

    // Output the secret ARN
    new cdk.CfnOutput(this, 'SecretArn', {
      value: dbSecret.secretArn,
      description: 'Database secret ARN',
    });
  }
}
```

---

## 6. Accessing Secrets via VPC Endpoint

### 6.1 Access Design from Private Subnets

```
┌──────────────────────────────────────────────────────────┐
│              Access via VPC Endpoint                     │
│                                                          │
│  VPC (10.0.0.0/16)                                       │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Private Subnet                                     │  │
│  │  ┌───────────────┐    VPC Endpoint     ┌─────────┐ │  │
│  │  │ ECS / Lambda  │ ─── (Interface) ──→ │ Secrets │ │  │
│  │  │ (No IGW)      │    vpce-xxxx        │ Manager │ │  │
│  │  └───────────────┘                     └─────────┘ │  │
│  │                                                     │  │
│  │  ┌───────────────┐    VPC Endpoint     ┌─────────┐ │  │
│  │  │ ECS / Lambda  │ ─── (Interface) ──→ │ SSM     │ │  │
│  │  │               │    vpce-yyyy        │ (Param) │ │  │
│  │  └───────────────┘                     └─────────┘ │  │
│  │                                                     │  │
│  │  ┌───────────────┐    VPC Endpoint     ┌─────────┐ │  │
│  │  │ ECS / Lambda  │ ─── (Interface) ──→ │ KMS     │ │  │
│  │  │               │    vpce-zzzz        │         │ │  │
│  │  └───────────────┘                     └─────────┘ │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Traffic does not go through the internet                │
└──────────────────────────────────────────────────────────┘
```

```bash
# Create VPC endpoints
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-xxxx \
  --service-name com.amazonaws.ap-northeast-1.secretsmanager \
  --vpc-endpoint-type Interface \
  --subnet-ids subnet-aaaa subnet-bbbb \
  --security-group-ids sg-xxxx \
  --private-dns-enabled

aws ec2 create-vpc-endpoint \
  --vpc-id vpc-xxxx \
  --service-name com.amazonaws.ap-northeast-1.ssm \
  --vpc-endpoint-type Interface \
  --subnet-ids subnet-aaaa subnet-bbbb \
  --security-group-ids sg-xxxx \
  --private-dns-enabled

aws ec2 create-vpc-endpoint \
  --vpc-id vpc-xxxx \
  --service-name com.amazonaws.ap-northeast-1.kms \
  --vpc-endpoint-type Interface \
  --subnet-ids subnet-aaaa subnet-bbbb \
  --security-group-ids sg-xxxx \
  --private-dns-enabled
```

---

## 7. Auditing and Monitoring Secrets

### 7.1 Access Monitoring with CloudTrail

```python
import boto3
import json
from datetime import datetime, timedelta

def audit_secret_access(secret_name: str, hours: int = 24) -> list[dict]:
    """Retrieve access history for a specific secret"""
    ct = boto3.client("cloudtrail", region_name="ap-northeast-1")

    events = ct.lookup_events(
        LookupAttributes=[
            {"AttributeKey": "ResourceName", "AttributeValue": secret_name}
        ],
        StartTime=datetime.utcnow() - timedelta(hours=hours),
        EndTime=datetime.utcnow(),
    )

    results = []
    for event in events.get("Events", []):
        detail = json.loads(event["CloudTrailEvent"])
        results.append({
            "Time": str(event["EventTime"]),
            "Event": event["EventName"],
            "User": detail.get("userIdentity", {}).get("arn", "Unknown"),
            "SourceIP": detail.get("sourceIPAddress", "Unknown"),
            "Success": "errorCode" not in detail,
        })

    return results
```

### 7.2 Compliance Monitoring with Config Rules

```yaml
# AWS Config Rules for Secrets Manager
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  # Check whether secret rotation is enabled
  SecretRotationEnabled:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: secretsmanager-rotation-enabled
      Source:
        Owner: AWS
        SourceIdentifier: SECRETSMANAGER_ROTATION_ENABLED_CHECK
      InputParameters:
        maximumAllowedRotationFrequency: 90  # Maximum 90-day interval

  # Check that secrets are not unused
  SecretUnused:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: secretsmanager-secret-unused
      Source:
        Owner: AWS
        SourceIdentifier: SECRETSMANAGER_SECRET_UNUSED
      InputParameters:
        unusedForDays: 90

  # Check that secrets are subject to automatic rotation
  SecretScheduledRotation:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: secretsmanager-scheduled-rotation
      Source:
        Owner: AWS
        SourceIdentifier: SECRETSMANAGER_SCHEDULED_ROTATION_SUCCESS_CHECK

  # Check that KMS key rotation is enabled
  KMSKeyRotation:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: kms-key-rotation-enabled
      Source:
        Owner: AWS
        SourceIdentifier: CMK_BACKING_KEY_ROTATION_ENABLED
```

### 7.3 Anomaly Detection for Secrets via EventBridge

```yaml
# Detect anomalous access to secrets
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  SecretAccessAlert:
    Type: AWS::Events::Rule
    Properties:
      Name: secret-access-anomaly-alert
      EventPattern:
        source:
          - "aws.secretsmanager"
        detail-type:
          - "AWS API Call via CloudTrail"
        detail:
          eventName:
            - "GetSecretValue"
            - "PutSecretValue"
            - "DeleteSecret"
            - "UpdateSecret"
          errorCode:
            - "AccessDeniedException"
            - "DecryptionFailureException"
      Targets:
        - Arn: !Ref AlertTopic
          Id: secret-alert

  SecretRotationFailure:
    Type: AWS::Events::Rule
    Properties:
      Name: secret-rotation-failure-alert
      EventPattern:
        source:
          - "aws.secretsmanager"
        detail-type:
          - "AWS API Call via CloudTrail"
        detail:
          eventName:
            - "RotationFailed"
      Targets:
        - Arn: !Ref AlertTopic
          Id: rotation-failure

  AlertTopic:
    Type: AWS::SNS::Topic
    Properties:
      TopicName: secrets-security-alerts
```

---

## 8. Service Comparison

### 8.1 Secrets Manager vs Parameter Store

| Feature | Secrets Manager | Parameter Store (Standard) | Parameter Store (Advanced) |
|---------|----------------|---------------------------|---------------------------|
| **Pricing** | $0.40/secret/month + API fees | Free | $0.05/parameter/month |
| **Max size** | 64 KB | 4 KB | 8 KB |
| **Automatic rotation** | Built-in support | Custom implementation via Lambda | Custom implementation via Lambda |
| **Cross-account sharing** | Possible via IAM policy | Not supported | Not supported |
| **Versioning** | Yes (stage labels) | Yes (number only) | Yes (number only) |
| **Encryption** | KMS required | KMS via SecureString | KMS via SecureString |
| **CloudFormation dynamic reference** | `{{resolve:secretsmanager:...}}` | `{{resolve:ssm:...}}` | `{{resolve:ssm:...}}` |
| **Replication** | Multi-region supported | Not supported | Not supported |
| **Resource policy** | Yes | No | No |
| **Recommended use** | DB credentials, API keys | Config values, Feature Flags | Larger config values |
| **Lambda Extension** | Yes | Yes | Yes |
| **Parameter limit** | No limit (API limits apply) | 10,000 | 100,000 |

### 8.2 KMS Key Type Comparison

| Key type | Manager | Cost | Rotation | Use case |
|----------|---------|------|----------|----------|
| **AWS managed key** (`aws/xxx`) | AWS | Free | Automatic (3 years) | Default service encryption |
| **Customer managed key** | User | $1/month + API fees | Manual or automatic | When fine-grained access control is needed |
| **Customer-provided key** (BYOK) | User | API fees only | User-managed | Compliance requirements |
| **External key store** | User | $1/month + API fees | User-managed | HSM integration, regulatory compliance |
| **Multi-region key** | User | $1/month/region | Automatic (when configured) | DR, multi-region encryption |

### 8.3 Encryption Context Usage Comparison

| Purpose | Context key | Example value | Effect |
|---------|-------------|---------------|--------|
| **Tenant isolation** | `tenant-id` | `company-abc` | Prevents data mixing between tenants |
| **Data classification** | `data-classification` | `pii`, `confidential` | Tracks data type |
| **Access control** | `purpose` | `backup`, `analytics` | Control via IAM Condition |
| **Auditing** | `request-id` | `req-12345` | Tracking in CloudTrail |

---

## 9. Anti-Patterns

### 9.1 Setting Secrets as Plaintext Environment Variables

```yaml
# Bad: Hardcoding passwords in docker-compose.yml
services:
  app:
    environment:
      - DB_PASSWORD=P@ssw0rd123    # Gets committed to Git
      - API_KEY=sk-live-abc123     # Visible via docker inspect

# Good: Dynamically retrieve from Secrets Manager
services:
  app:
    environment:
      - SECRET_ARN=arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:prod/db
    # Retrieve via SDK at application startup
```

**Problem**: Environment variables can easily be exposed via `docker inspect`, `/proc/<pid>/environ`, or log output.

### 9.2 Using the Same KMS Key for All Secrets

```
Bad:
  All secrets → aws/secretsmanager (default key)
    → Revoking the key disables all secrets

Good:
  Production DB → alias/prod-database-key
  API integrations → alias/prod-api-key
  Audit logs → alias/prod-audit-key
    → Limits the blast radius
```

**Problem**: Changes to key policies affect all secrets, widening the impact area during incidents.

### 9.3 Long-Term Use Without Rotation

```
Bad:
  DB password used for 2 years without a single change since creation
  → Former employees may still know the old password
  → A compromise cannot be detected

Good:
  Set automatic rotation in Secrets Manager at 30-day intervals
  → Password is automatically changed regularly
  → Even if leaked, the window of validity is limited
```

### 9.4 Logging Secrets

```python
# Bad: Logging secrets
import logging
logger = logging.getLogger()

secret = get_secret("prod/myapp/database")
logger.info(f"DB connection: {secret}")  # Password remains in logs

# Good: Mask before logging
def mask_secret(secret_dict: dict, mask_keys: list[str]) -> dict:
    """Return a copy with sensitive fields masked"""
    masked = secret_dict.copy()
    for key in mask_keys:
        if key in masked:
            masked[key] = "***MASKED***"
    return masked

logger.info(f"DB connection: {mask_secret(secret, ['password', 'api_key'])}")
```

### 9.5 Accessing from Private Subnets Without a VPC Endpoint

```
Bad:
  Private Subnet → NAT Gateway → Internet → Secrets Manager
  → Long communication path through the internet
  → NAT Gateway costs incurred
  → Increased security risk

Good:
  Private Subnet → VPC Endpoint → Secrets Manager
  → Stays within the AWS network
  → Reduced costs by avoiding the internet
  → Additional control via VPC endpoint policies
```

---

## 10. FAQ

### Q1. Which should I use — Secrets Manager or Parameter Store SecureString?

**A.** Use Secrets Manager if automatic rotation is required. Use Parameter Store SecureString if cost is a priority and manual management is acceptable. Secrets Manager has built-in rotation templates for RDS/Redshift/DocumentDB, making setup easy. Choose Secrets Manager if cross-account sharing is also needed.

### Q2. I'm worried about KMS API call costs. Is caching possible?

**A.** The Secrets Manager SDK includes a client-side caching library. Using `aws-secretsmanager-caching` (Python) or `aws-secretsmanager-caching-java` enables TTL-based caching, significantly reducing the number of API calls. Lambda Extensions also provide equivalent caching functionality.

```python
from aws_secretsmanager_caching import SecretCache

cache = SecretCache()
secret = cache.get_secret_string("prod/myapp/database")  # Cached within TTL
```

### Q3. What is the most secure way to access secrets from Lambda?

**A.** Attach a least-privilege IAM policy to the Lambda execution role and access secrets via a VPC endpoint. Using Lambda Extensions allows you to retrieve and cache secrets outside the runtime.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:prod/myapp/*"
    },
    {
      "Effect": "Allow",
      "Action": "kms:Decrypt",
      "Resource": "arn:aws:kms:ap-northeast-1:123456789012:key/specific-key-id"
    }
  ]
}
```

### Q4. How can I prevent applications from being affected during secret rotation?

**A.** (1) Use a multi-user rotation strategy to alternate between two users. (2) Implement retry logic on the application side when retrieving secrets. (3) Use Secrets Manager version stages (AWSCURRENT/AWSPREVIOUS) to allow temporary access with old credentials. (4) Implement reconnection logic in the connection pool.

### Q5. How can I prevent secret leakage with tools like git-secrets?

**A.** (1) Set up `git-secrets` as a pre-commit hook to block AWS access key patterns. (2) Enable GitHub's Secret Scanning. (3) Periodically scan repositories with `trufflehog` or `gitleaks`. (4) Use AWS IAM Access Analyzer to detect publicly exposed secrets. Integrating these into a CI/CD pipeline achieves defense in depth.

```bash
# Set up git-secrets
git secrets --install
git secrets --register-aws

# Scan with the pre-commit hook
git secrets --scan
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What are common mistakes beginners make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It is especially important during code reviews and architecture design.

---

## 11. Summary

| Item | Key Point |
|------|-----------|
| **Secrets Manager** | Supports automatic rotation, RDS integration, $0.40/month/secret |
| **Parameter Store** | Free tier available, hierarchical structure, handles both config values and sensitive values |
| **KMS** | Foundation for envelope encryption, fine-grained access control via key policies |
| **Design Principles** | Do not include secrets in code, least privilege, separate keys by purpose |
| **Caching** | Reduce API costs with client-side caching or Lambda Extensions |
| **Rotation** | Automatic rotation within 30 days, multi-user strategy to avoid downtime |
| **Networking** | Access via VPC endpoint without going through the internet |
| **Auditing** | Monitor and ensure compliance with CloudTrail + Config Rules + EventBridge |
| **IaC** | Codify secrets management with CDK/CloudFormation |

---

## What to Read Next

- [02-waf-shield.md](./02-waf-shield.md) — Application protection with WAF/Shield
- [00-iam-deep-dive.md](./00-iam-deep-dive.md) — IAM policy design and role management
- VPC Endpoint Design — Service access from private networks

---

## References

1. **AWS Official Documentation** — "AWS Secrets Manager User Guide" — https://docs.aws.amazon.com/secretsmanager/latest/userguide/
2. **AWS Official Documentation** — "AWS Systems Manager Parameter Store User Guide" — https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html
3. **AWS Official Documentation** — "AWS Key Management Service Developer Guide" — https://docs.aws.amazon.com/kms/latest/developerguide/
4. **AWS Well-Architected Framework** — Security Pillar — "Protect data at rest" — https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/
5. **AWS Encryption SDK** — "AWS Encryption SDK Developer Guide" — https://docs.aws.amazon.com/encryption-sdk/latest/developer-guide/
6. **AWS Lambda Extensions** — "Using AWS Parameters and Secrets Lambda Extension" — https://docs.aws.amazon.com/secretsmanager/latest/userguide/retrieving-secrets_lambda.html

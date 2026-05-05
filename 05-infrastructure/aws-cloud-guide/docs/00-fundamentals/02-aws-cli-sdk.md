# AWS CLI / SDK

> Master the foundational tools for operating AWS from the command line and various programming languages

## What You Will Learn in This Chapter

1. Install and configure AWS CLI v2, and manage multiple accounts using profiles
2. Write code to operate AWS services with JavaScript (AWS SDK v3) and Python (boto3)
3. Manage credentials securely and properly use environment variables, IAM roles, and SSO
4. Leverage advanced AWS CLI techniques (JMESPath, pagination, waiters)
5. Implement credential management in CI/CD environments (OIDC, Secrets Manager)


## Prerequisites

Before reading this guide, having the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [AWS Account Setup](./01-aws-account-setup.md)

---

## 1. Installing and Configuring AWS CLI v2

### 1.1 Installation

```bash
# macOS
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /

# macOS (Homebrew)
brew install awscli

# Linux (x86_64)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" \
  -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Linux (ARM64 / Graviton)
curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" \
  -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Docker
docker run --rm -it amazon/aws-cli --version
# Set up alias
alias aws='docker run --rm -it -v ~/.aws:/root/.aws -v $(pwd):/aws amazon/aws-cli'

# Verify version
aws --version
# aws-cli/2.x.x Python/3.x.x ...

# Update
sudo ./aws/install --bin-dir /usr/local/bin --install-dir /usr/local/aws-cli --update
```

### 1.2 Initial Configuration

```bash
# Interactive configuration
aws configure
# AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
# AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
# Default region name [None]: ap-northeast-1
# Default output format [None]: json

# Check configuration files
cat ~/.aws/credentials
cat ~/.aws/config

# Check individual configuration values
aws configure get region
aws configure get profile.dev.region
aws configure get default.output
```

### 1.3 Configuration File Structure

```
~/.aws/
├── credentials    # Credentials (access keys)
│   [default]
│   aws_access_key_id = AKIA...
│   aws_secret_access_key = wJal...
│
│   [dev]
│   aws_access_key_id = AKIA...
│   aws_secret_access_key = xxxx...
│
└── config         # Region, output format, role settings
    [default]
    region = ap-northeast-1
    output = json

    [profile dev]
    region = ap-northeast-1
    output = yaml

    [profile prod]
    role_arn = arn:aws:iam::111111111111:role/Admin
    source_profile = default
    region = ap-northeast-1
```

### 1.4 Configuration via Environment Variables

```bash
# Credential environment variables
export AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
export AWS_SESSION_TOKEN="FwoGZXIvYXdzEBYaD..."  # For temporary credentials

# Switch profiles
export AWS_PROFILE=dev

# Override region
export AWS_DEFAULT_REGION=us-east-1

# Default output format
export AWS_DEFAULT_OUTPUT=json

# Endpoint URL (used with LocalStack, etc.)
export AWS_ENDPOINT_URL=http://localhost:4566

# Verify configuration
aws configure list
# Example output:
#       Name                    Value             Type    Location
#       ----                    -----             ----    --------
#    profile                <not set>             None    None
# access_key     ****************MPLE shared-credentials-file
# secret_key     ****************EKEY shared-credentials-file
#     region           ap-northeast-1      config-file    ~/.aws/config
```

---

## 2. Profile Management

### 2.1 Named Profiles

```bash
# Create named profiles
aws configure --profile dev
aws configure --profile staging
aws configure --profile prod

# Execute commands with a specific profile
aws s3 ls --profile dev
aws ec2 describe-instances --profile prod

# Switch default profile via environment variable
export AWS_PROFILE=dev
aws s3 ls  # Executed with the dev profile

# List all profiles
aws configure list-profiles
```

### 2.2 Credential Resolution Order

```
AWS CLI / SDK Credential Resolution Order (by priority)

  +-----------------------------------+
  | 1. Command-line options            |  --profile, --region
  +-----------------------------------+
              ↓ (if not set)
  +-----------------------------------+
  | 2. Environment variables           |  AWS_ACCESS_KEY_ID
  |                                   |  AWS_SECRET_ACCESS_KEY
  |                                   |  AWS_SESSION_TOKEN
  +-----------------------------------+
              ↓ (if not set)
  +-----------------------------------+
  | 3. Web Identity Token              |  AWS_WEB_IDENTITY_TOKEN_FILE
  |                                   |  (EKS, GitHub Actions)
  +-----------------------------------+
              ↓ (if not set)
  +-----------------------------------+
  | 4. Shared credentials file         |  ~/.aws/credentials
  +-----------------------------------+
              ↓ (if not set)
  +-----------------------------------+
  | 5. Shared config file              |  ~/.aws/config
  +-----------------------------------+
              ↓ (if not set)
  +-----------------------------------+
  | 6. ECS container credentials       |  Task role
  +-----------------------------------+
              ↓ (if not set)
  +-----------------------------------+
  | 7. EC2 instance metadata           |  Instance profile
  +-----------------------------------+
```

### 2.3 Cross-Account Access with AssumeRole

```bash
# Configure role in ~/.aws/config
# [profile prod]
# role_arn = arn:aws:iam::111111111111:role/AdminRole
# source_profile = default
# mfa_serial = arn:aws:iam::999999999999:mfa/my-user

# Assume role with MFA
aws sts assume-role \
  --role-arn arn:aws:iam::111111111111:role/AdminRole \
  --role-session-name my-session \
  --serial-number arn:aws:iam::999999999999:mfa/my-user \
  --token-code 123456

# Set the results as environment variables
export AWS_ACCESS_KEY_ID=ASIAXXXXXXXX
export AWS_SECRET_ACCESS_KEY=XXXXXXXX
export AWS_SESSION_TOKEN=XXXXXXXX
```

### 2.4 Profile Switching Script

```bash
#!/bin/bash
# aws-switch-profile.sh
# Usage: source aws-switch-profile.sh

echo "Available profiles:"
aws configure list-profiles | nl

read -p "Select profile number: " num
PROFILE=$(aws configure list-profiles | sed -n "${num}p")

if [ -z "$PROFILE" ]; then
  echo "Invalid number"
  return 1
fi

export AWS_PROFILE="$PROFILE"
echo "Switched profile to '$PROFILE'"

# Verify current identity
aws sts get-caller-identity --output table
```

### 2.5 MFA Temporary Credential Retrieval Script

```bash
#!/bin/bash
# aws-mfa.sh - Authenticate with MFA and retrieve temporary credentials
# Usage: eval $(./aws-mfa.sh 123456)

MFA_CODE=$1
MFA_SERIAL="arn:aws:iam::123456789012:mfa/my-user"
DURATION=43200  # 12 hours

if [ -z "$MFA_CODE" ]; then
  echo "Usage: eval \$(./aws-mfa.sh <MFA_CODE>)" >&2
  exit 1
fi

# Retrieve temporary credentials
CREDS=$(aws sts get-session-token \
  --serial-number "$MFA_SERIAL" \
  --token-code "$MFA_CODE" \
  --duration-seconds "$DURATION" \
  --output json)

# Output as environment variables
echo "export AWS_ACCESS_KEY_ID=$(echo $CREDS | jq -r '.Credentials.AccessKeyId')"
echo "export AWS_SECRET_ACCESS_KEY=$(echo $CREDS | jq -r '.Credentials.SecretAccessKey')"
echo "export AWS_SESSION_TOKEN=$(echo $CREDS | jq -r '.Credentials.SessionToken')"

EXPIRY=$(echo $CREDS | jq -r '.Credentials.Expiration')
echo "# Expiration: $EXPIRY" >&2
```

---

## 3. Practical AWS CLI Techniques

### 3.1 Output Formats and --query

```bash
# JSON output (default)
aws ec2 describe-instances --output json

# Table format (human-readable)
aws ec2 describe-instances --output table

# YAML format
aws ec2 describe-instances --output yaml

# Text format (script-friendly)
aws ec2 describe-instances --output text

# JMESPath filter with --query
aws ec2 describe-instances \
  --query 'Reservations[].Instances[].[InstanceId,State.Name,InstanceType]' \
  --output table

# Extract only instances with a specific tag
aws ec2 describe-instances \
  --filters "Name=tag:Environment,Values=production" \
  --query 'Reservations[].Instances[].{
    ID: InstanceId,
    Type: InstanceType,
    State: State.Name,
    IP: PublicIpAddress
  }' \
  --output table
```

### 3.2 JMESPath Detailed Guide

```bash
# Basic filtering
# Extract specific fields from an array
aws ec2 describe-instances \
  --query 'Reservations[].Instances[].InstanceId'

# Object construction
aws ec2 describe-instances \
  --query 'Reservations[].Instances[].{
    ID: InstanceId,
    Type: InstanceType,
    AZ: Placement.AvailabilityZone,
    State: State.Name,
    LaunchTime: LaunchTime
  }' --output table

# Conditional filtering (only running instances)
aws ec2 describe-instances \
  --query 'Reservations[].Instances[?State.Name==`running`].{
    ID: InstanceId,
    Type: InstanceType
  }' --output table

# Sorting
aws ec2 describe-instances \
  --query 'sort_by(Reservations[].Instances[], &LaunchTime)[].{
    ID: InstanceId,
    LaunchTime: LaunchTime
  }' --output table

# Get first N items
aws ec2 describe-instances \
  --query 'Reservations[].Instances[][:5].InstanceId'

# Pipe operator
aws ec2 describe-instances \
  --query 'Reservations[].Instances[] | length(@)'

# Flatten nested arrays
aws ec2 describe-security-groups \
  --query 'SecurityGroups[].{
    GroupName: GroupName,
    InboundRules: IpPermissions[].{
      Protocol: IpProtocol,
      Port: ToPort,
      Source: IpRanges[].CidrIp | join(`, `, @)
    }
  }' --output yaml

# Get values from tags
aws ec2 describe-instances \
  --query 'Reservations[].Instances[].{
    ID: InstanceId,
    Name: Tags[?Key==`Name`].Value | [0]
  }' --output table
```

### 3.3 Useful One-Liners

```bash
# List EC2 instances across all regions
for region in $(aws ec2 describe-regions --query 'Regions[].RegionName' --output text); do
  echo "=== $region ==="
  aws ec2 describe-instances --region $region \
    --query 'Reservations[].Instances[].[InstanceId,State.Name]' \
    --output table
done

# Check S3 bucket size
aws cloudwatch get-metric-statistics \
  --namespace AWS/S3 \
  --metric-name BucketSizeBytes \
  --dimensions Name=BucketName,Value=my-bucket Name=StorageType,Value=StandardStorage \
  --start-time $(date -u -v-1d +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 \
  --statistics Average

# Bulk start stopped instances
aws ec2 describe-instances \
  --filters "Name=instance-state-name,Values=stopped" "Name=tag:Environment,Values=dev" \
  --query 'Reservations[].Instances[].InstanceId' \
  --output text | xargs -n 1 aws ec2 start-instances --instance-ids

# Detect unattached EBS volumes
aws ec2 describe-volumes \
  --filters "Name=status,Values=available" \
  --query 'Volumes[].{
    ID: VolumeId,
    Size: Size,
    AZ: AvailabilityZone,
    Created: CreateTime
  }' --output table

# Detect security groups exposing SSH to 0.0.0.0/0
aws ec2 describe-security-groups \
  --filters "Name=ip-permission.from-port,Values=22" \
    "Name=ip-permission.cidr,Values=0.0.0.0/0" \
  --query 'SecurityGroups[].{
    GroupId: GroupId,
    GroupName: GroupName,
    VpcId: VpcId
  }' --output table

# List Lambda functions with memory and timeout
aws lambda list-functions \
  --query 'Functions[].{
    Name: FunctionName,
    Runtime: Runtime,
    Memory: MemorySize,
    Timeout: Timeout,
    LastModified: LastModified
  }' --output table

# Check last used date of IAM user access keys
for user in $(aws iam list-users --query 'Users[].UserName' --output text); do
  echo "--- $user ---"
  aws iam list-access-keys --user-name "$user" --query 'AccessKeyMetadata[].{
    KeyId: AccessKeyId,
    Status: Status,
    Created: CreateDate
  }' --output table
done
```

### 3.4 Pagination and Auto-Paging

```bash
# AWS CLI v2 uses auto-pagination by default
aws s3api list-objects-v2 --bucket my-bucket
# → Automatically retrieves all items even beyond 1000

# Manual pagination control
aws s3api list-objects-v2 --bucket my-bucket --max-items 100
# → If NextToken is returned, retrieve the next page
aws s3api list-objects-v2 --bucket my-bucket --starting-token "TOKEN..."

# Disable pagination (for performance improvement)
aws s3api list-objects-v2 --bucket my-bucket --no-paginate --max-items 100

# Specify server-side page size
aws s3api list-objects-v2 --bucket my-bucket --page-size 500
```

### 3.5 Waiters (Waiting for Async Resource Completion)

```bash
# Wait for EC2 instance launch to complete
aws ec2 run-instances --image-id ami-xxx --instance-type t3.micro \
  --query 'Instances[0].InstanceId' --output text
# → i-0123456789abcdef0

aws ec2 wait instance-running --instance-ids i-0123456789abcdef0
echo "Instance is now running"

# Wait for EBS volume to become available
aws ec2 wait volume-available --volume-ids vol-xxx

# Wait for RDS instance launch to complete
aws rds wait db-instance-available --db-instance-identifier my-db

# Wait for snapshot completion
aws ec2 wait snapshot-completed --snapshot-ids snap-xxx

# Wait for CloudFormation stack creation to complete
aws cloudformation wait stack-create-complete --stack-name my-stack

# Custom timeout configuration
aws ec2 wait instance-running \
  --instance-ids i-xxx \
  --cli-read-timeout 600
```

### 3.6 Advanced S3 Operations

```bash
# High-speed sync (multipart upload configuration)
aws configure set default.s3.max_concurrent_requests 20
aws configure set default.s3.multipart_threshold 64MB
aws configure set default.s3.multipart_chunksize 16MB

# Directory sync
aws s3 sync ./build s3://my-bucket/static \
  --delete \
  --exclude "*.tmp" \
  --include "*.html" \
  --cache-control "max-age=86400" \
  --acl private

# Generate presigned URL
aws s3 presign s3://my-bucket/report.pdf --expires-in 3600

# Cross-region bucket-to-bucket copy
aws s3 sync s3://source-bucket s3://dest-bucket \
  --source-region ap-northeast-1 \
  --region us-east-1

# Multipart upload for large files
aws s3 cp large-file.tar.gz s3://my-bucket/ \
  --expected-size 10737418240 \
  --storage-class INTELLIGENT_TIERING

# Query data with S3 Select
aws s3api select-object-content \
  --bucket my-bucket \
  --key data.csv \
  --expression "SELECT s.name, s.age FROM S3Object s WHERE s.age > '30'" \
  --expression-type SQL \
  --input-serialization '{"CSV": {"FileHeaderInfo": "USE"}}' \
  --output-serialization '{"CSV": {}}' \
  output.csv
```

### 3.7 Customizing AWS CLI

```bash
# Customization in ~/.aws/config
# [default]
# region = ap-northeast-1
# output = json
# cli_pager = less      # Pager setting
# cli_auto_prompt = on  # Enable auto-completion
# retry_mode = adaptive # Retry mode

# Disable pager (for scripts)
export AWS_PAGER=""
# or
aws ec2 describe-instances --no-cli-pager

# Alias configuration (~/.aws/cli/alias)
# [toplevel]
# whoami = sts get-caller-identity
# running-instances = ec2 describe-instances \
#   --filters "Name=instance-state-name,Values=running" \
#   --query 'Reservations[].Instances[].[InstanceId,InstanceType,Tags[?Key==`Name`].Value|[0]]' \
#   --output table
# sg-open-ssh = ec2 describe-security-groups \
#   --filters "Name=ip-permission.from-port,Values=22" "Name=ip-permission.cidr,Values=0.0.0.0/0" \
#   --query 'SecurityGroups[].{ID:GroupId,Name:GroupName}' \
#   --output table

# Using aliases
aws whoami
aws running-instances
aws sg-open-ssh
```

---

## 4. AWS SDK for JavaScript (v3)

### 4.1 Setup

```bash
# Install packages (only the services you need)
npm install @aws-sdk/client-s3
npm install @aws-sdk/client-dynamodb
npm install @aws-sdk/lib-dynamodb  # DocumentClient
npm install @aws-sdk/client-lambda
npm install @aws-sdk/client-sqs
npm install @aws-sdk/client-ses

# Common utilities
npm install @aws-sdk/credential-providers
npm install @aws-sdk/middleware-retry
npm install @aws-sdk/s3-request-presigner
```

### 4.2 S3 Operations

```javascript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({ region: 'ap-northeast-1' });

// File upload
async function uploadFile(bucket, key, body) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: 'application/json',
    ServerSideEncryption: 'AES256',
    Metadata: {
      'uploaded-by': 'my-app',
      'upload-time': new Date().toISOString(),
    },
  });
  const response = await s3.send(command);
  console.log('Upload success:', response.$metadata.httpStatusCode);
}

// File download
async function downloadFile(bucket, key) {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3.send(command);
  const body = await response.Body.transformToString();
  return JSON.parse(body);
}

// List objects (with pagination support)
async function listAllObjects(bucket, prefix) {
  const allObjects = [];
  let continuationToken = undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    });
    const response = await s3.send(command);

    if (response.Contents) {
      allObjects.push(...response.Contents.map(obj => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
      })));
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return allObjects;
}

// Generate presigned URL
async function generatePresignedUrl(bucket, key, expiresIn = 3600) {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const url = await getSignedUrl(s3, command, { expiresIn });
  return url;
}

// Streaming upload
import { Upload } from '@aws-sdk/lib-storage';
import { createReadStream } from 'fs';

async function uploadLargeFile(bucket, key, filePath) {
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: bucket,
      Key: key,
      Body: createReadStream(filePath),
    },
    queueSize: 4,         // Number of parallel uploads
    partSize: 5 * 1024 * 1024,  // Part size: 5MB
  });

  upload.on('httpUploadProgress', (progress) => {
    console.log(`Progress: ${progress.loaded}/${progress.total}`);
  });

  await upload.done();
}
```

### 4.3 DynamoDB Operations

```javascript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  BatchWriteCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'ap-northeast-1' });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});

// Write item
async function putItem(tableName, item) {
  const command = new PutCommand({
    TableName: tableName,
    Item: item,
    ConditionExpression: 'attribute_not_exists(PK)',  // Prevent duplicates
  });
  await docClient.send(command);
}

// Get item
async function getItem(tableName, key) {
  const command = new GetCommand({
    TableName: tableName,
    Key: key,
    ConsistentRead: true,  // Strong consistency
  });
  const response = await docClient.send(command);
  return response.Item;
}

// Query (with pagination support)
async function queryAllItems(tableName, pk, skPrefix) {
  const allItems = [];
  let lastKey = undefined;

  do {
    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': pk,
        ':skPrefix': skPrefix,
      },
      ExclusiveStartKey: lastKey,
      Limit: 100,
    });
    const response = await docClient.send(command);
    allItems.push(...response.Items);
    lastKey = response.LastEvaluatedKey;
  } while (lastKey);

  return allItems;
}

// Conditional update
async function updateItem(tableName, key, updates) {
  const command = new UpdateCommand({
    TableName: tableName,
    Key: key,
    UpdateExpression: 'SET #name = :name, #age = :age, updatedAt = :now',
    ExpressionAttributeNames: {
      '#name': 'name',
      '#age': 'age',
    },
    ExpressionAttributeValues: {
      ':name': updates.name,
      ':age': updates.age,
      ':now': new Date().toISOString(),
    },
    ReturnValues: 'ALL_NEW',
  });
  const response = await docClient.send(command);
  return response.Attributes;
}

// Batch write (25 items at a time)
async function batchWriteItems(tableName, items) {
  const BATCH_SIZE = 25;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const command = new BatchWriteCommand({
      RequestItems: {
        [tableName]: batch.map(item => ({
          PutRequest: { Item: item },
        })),
      },
    });
    await docClient.send(command);
  }
}

// Transaction
async function transferPoints(fromUser, toUser, points) {
  const command = new TransactWriteCommand({
    TransactItems: [
      {
        Update: {
          TableName: 'Users',
          Key: { PK: fromUser, SK: 'PROFILE' },
          UpdateExpression: 'SET points = points - :points',
          ConditionExpression: 'points >= :points',
          ExpressionAttributeValues: { ':points': points },
        },
      },
      {
        Update: {
          TableName: 'Users',
          Key: { PK: toUser, SK: 'PROFILE' },
          UpdateExpression: 'SET points = points + :points',
          ExpressionAttributeValues: { ':points': points },
        },
      },
    ],
  });
  await docClient.send(command);
}

// Usage example
await putItem('Users', {
  PK: 'USER#001', SK: 'PROFILE',
  name: '田中太郎', age: 30, points: 1000,
});
const user = await getItem('Users', { PK: 'USER#001', SK: 'PROFILE' });
```

### 4.4 Lambda Invocation

```javascript
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambda = new LambdaClient({ region: 'ap-northeast-1' });

// Synchronous invocation
async function invokeLambdaSync(functionName, payload) {
  const command = new InvokeCommand({
    FunctionName: functionName,
    InvocationType: 'RequestResponse',
    Payload: JSON.stringify(payload),
  });
  const response = await lambda.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.Payload));
  return result;
}

// Asynchronous invocation
async function invokeLambdaAsync(functionName, payload) {
  const command = new InvokeCommand({
    FunctionName: functionName,
    InvocationType: 'Event',
    Payload: JSON.stringify(payload),
  });
  await lambda.send(command);
}
```

### 4.5 SQS Operations

```javascript
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';

const sqs = new SQSClient({ region: 'ap-northeast-1' });
const QUEUE_URL = 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/my-queue';

// Send message
async function sendMessage(body, groupId) {
  const command = new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify(body),
    MessageGroupId: groupId,
    MessageDeduplicationId: `${Date.now()}-${Math.random()}`,
  });
  await sqs.send(command);
}

// Receive and process messages
async function processMessages() {
  const command = new ReceiveMessageCommand({
    QueueUrl: QUEUE_URL,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 20,  // Long polling
    VisibilityTimeout: 60,
  });
  const response = await sqs.send(command);

  for (const message of response.Messages || []) {
    try {
      const body = JSON.parse(message.Body);
      await handleMessage(body);

      // Delete message after successful processing
      await sqs.send(new DeleteMessageCommand({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle,
      }));
    } catch (error) {
      console.error('Message processing failed:', error);
      // Message is not deleted and will be reprocessed after VisibilityTimeout
    }
  }
}
```

### 4.6 Error Handling and Retries

```javascript
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';

// Client with retry configuration
const s3 = new S3Client({
  region: 'ap-northeast-1',
  maxAttempts: 5,
  retryMode: 'adaptive',
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 5000,
    socketTimeout: 30000,
  }),
});

// Error handling
async function getObjectSafely(bucket, key) {
  try {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3.send(command);
    return await response.Body.transformToString();
  } catch (error) {
    switch (error.name) {
      case 'NoSuchKey':
        console.log(`Object not found: ${key}`);
        return null;
      case 'NoSuchBucket':
        throw new Error(`Bucket does not exist: ${bucket}`);
      case 'AccessDenied':
        throw new Error(`Access denied to ${bucket}/${key}`);
      case 'ThrottlingException':
      case 'TooManyRequestsException':
        console.log('Rate limited, retrying...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        return getObjectSafely(bucket, key);
      default:
        throw error;
    }
  }
}
```

---

## 5. AWS SDK for Python (boto3)

### 5.1 Setup

```bash
pip install boto3
pip install boto3-stubs[essential]  # Type hints (for development)
```

### 5.2 S3 Operations

```python
import boto3
import json
from botocore.config import Config

# Client with retry configuration
config = Config(
    region_name='ap-northeast-1',
    retries={'max_attempts': 5, 'mode': 'adaptive'},
    max_pool_connections=50,
)

s3 = boto3.client('s3', config=config)

# File upload
def upload_file(bucket, key, file_path):
    s3.upload_file(
        file_path, bucket, key,
        ExtraArgs={
            'ServerSideEncryption': 'AES256',
            'Metadata': {'uploaded-by': 'my-app'},
        },
        Callback=lambda bytes_transferred: print(f'Transferred: {bytes_transferred} bytes'),
    )
    print(f"Uploaded: s3://{bucket}/{key}")

# Upload JSON data
def upload_json(bucket, key, data):
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(data, ensure_ascii=False),
        ContentType='application/json'
    )

# File download
def download_json(bucket, key):
    response = s3.get_object(Bucket=bucket, Key=key)
    body = response['Body'].read().decode('utf-8')
    return json.loads(body)

# Generate presigned URL (time-limited public URL)
def generate_presigned_url(bucket, key, expiration=3600):
    url = s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': bucket, 'Key': key},
        ExpiresIn=expiration
    )
    return url

# List objects with pagination support
def list_all_objects(bucket, prefix=''):
    paginator = s3.get_paginator('list_objects_v2')
    objects = []
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get('Contents', []):
            objects.append({
                'key': obj['Key'],
                'size': obj['Size'],
                'last_modified': obj['LastModified'],
            })
    return objects

# Cross-bucket copy
def copy_between_buckets(src_bucket, src_key, dest_bucket, dest_key):
    s3.copy_object(
        CopySource={'Bucket': src_bucket, 'Key': src_key},
        Bucket=dest_bucket,
        Key=dest_key,
        ServerSideEncryption='AES256',
    )
```

### 5.3 EC2 Operations

```python
import boto3
from datetime import datetime, timedelta

ec2 = boto3.resource('ec2', region_name='ap-northeast-1')
ec2_client = boto3.client('ec2', region_name='ap-northeast-1')

# List instances
def list_instances(state='running'):
    instances = ec2.instances.filter(
        Filters=[{'Name': 'instance-state-name', 'Values': [state]}]
    )
    for instance in instances:
        name = next(
            (tag['Value'] for tag in (instance.tags or []) if tag['Key'] == 'Name'),
            'N/A'
        )
        print(f"{instance.id} | {instance.instance_type} | "
              f"{name} | {instance.public_ip_address}")

# Stop instances
def stop_instances(instance_ids):
    ec2.instances.filter(InstanceIds=instance_ids).stop()
    print(f"Stopping: {instance_ids}")

# Operate instances by tag
def stop_dev_instances():
    """Stop development environment instances at night"""
    instances = ec2.instances.filter(
        Filters=[
            {'Name': 'instance-state-name', 'Values': ['running']},
            {'Name': 'tag:Environment', 'Values': ['development']},
        ]
    )
    ids = [i.id for i in instances]
    if ids:
        ec2.instances.filter(InstanceIds=ids).stop()
        print(f"Stopped {len(ids)} dev instances: {ids}")

# Delete old snapshots
def cleanup_old_snapshots(days=30):
    cutoff = datetime.now(tz=datetime.now().astimezone().tzinfo) - timedelta(days=days)
    snapshots = ec2_client.describe_snapshots(OwnerIds=['self'])['Snapshots']
    for snap in snapshots:
        if snap['StartTime'] < cutoff:
            ec2_client.delete_snapshot(SnapshotId=snap['SnapshotId'])
            print(f"Deleted: {snap['SnapshotId']} ({snap['StartTime']})")

# Using waiters
def launch_and_wait(ami_id, instance_type, key_name, sg_ids, subnet_id):
    instances = ec2.create_instances(
        ImageId=ami_id,
        InstanceType=instance_type,
        KeyName=key_name,
        SecurityGroupIds=sg_ids,
        SubnetId=subnet_id,
        MinCount=1, MaxCount=1,
        TagSpecifications=[{
            'ResourceType': 'instance',
            'Tags': [{'Key': 'Name', 'Value': 'my-server'}],
        }],
    )
    instance = instances[0]
    print(f"Launching: {instance.id}")

    # Wait until running state
    instance.wait_until_running()
    instance.reload()
    print(f"Running: {instance.public_ip_address}")
    return instance
```

### 5.4 DynamoDB Operations

```python
import boto3
from boto3.dynamodb.conditions import Key, Attr
from decimal import Decimal

dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')
table = dynamodb.Table('Users')

# Write item
def put_item(pk, sk, data):
    item = {'PK': pk, 'SK': sk, **data}
    table.put_item(Item=item)

# Get item
def get_item(pk, sk):
    response = table.get_item(Key={'PK': pk, 'SK': sk})
    return response.get('Item')

# Query
def query_items(pk, sk_prefix=None):
    if sk_prefix:
        response = table.query(
            KeyConditionExpression=Key('PK').eq(pk) & Key('SK').begins_with(sk_prefix)
        )
    else:
        response = table.query(
            KeyConditionExpression=Key('PK').eq(pk)
        )
    return response['Items']

# Batch write
def batch_write(items):
    with table.batch_writer() as batch:
        for item in items:
            batch.put_item(Item=item)

# Transaction
def transfer_points(from_user, to_user, points):
    client = boto3.client('dynamodb', region_name='ap-northeast-1')
    client.transact_write_items(
        TransactItems=[
            {
                'Update': {
                    'TableName': 'Users',
                    'Key': {'PK': {'S': from_user}, 'SK': {'S': 'PROFILE'}},
                    'UpdateExpression': 'SET points = points - :pts',
                    'ConditionExpression': 'points >= :pts',
                    'ExpressionAttributeValues': {':pts': {'N': str(points)}},
                }
            },
            {
                'Update': {
                    'TableName': 'Users',
                    'Key': {'PK': {'S': to_user}, 'SK': {'S': 'PROFILE'}},
                    'UpdateExpression': 'SET points = points + :pts',
                    'ExpressionAttributeValues': {':pts': {'N': str(points)}},
                }
            },
        ]
    )
```

### 5.5 Session Management and Multi-Account

```python
import boto3

# Default session
default_session = boto3.Session(region_name='ap-northeast-1')

# Profile-specific sessions
dev_session = boto3.Session(profile_name='dev')
prod_session = boto3.Session(profile_name='prod')

# Cross-account access with AssumeRole
def get_cross_account_session(role_arn, session_name='cross-account'):
    sts = boto3.client('sts')
    response = sts.assume_role(
        RoleArn=role_arn,
        RoleSessionName=session_name,
        DurationSeconds=3600,
    )
    credentials = response['Credentials']
    return boto3.Session(
        aws_access_key_id=credentials['AccessKeyId'],
        aws_secret_access_key=credentials['SecretAccessKey'],
        aws_session_token=credentials['SessionToken'],
    )

# Usage example
prod_session = get_cross_account_session(
    'arn:aws:iam::111111111111:role/AdminRole'
)
prod_s3 = prod_session.client('s3')
prod_s3.list_buckets()
```

---

## 6. SSO (IAM Identity Center) Integration

### 6.1 SSO Profile Configuration

```bash
# SSO configuration
aws configure sso
# SSO session name: my-sso
# SSO start URL: https://my-org.awsapps.com/start
# SSO region: ap-northeast-1
# SSO registration scopes: sso:account:access

# SSO login
aws sso login --profile my-sso-profile

# Configuration added to ~/.aws/config
# [profile my-sso-profile]
# sso_session = my-sso
# sso_account_id = 123456789012
# sso_role_name = AdministratorAccess
# region = ap-northeast-1
#
# [sso-session my-sso]
# sso_start_url = https://my-org.awsapps.com/start
# sso_region = ap-northeast-1
# sso_registration_scopes = sso:account:access
```

### 6.2 Multi-Account SSO Configuration

```
# ~/.aws/config
[sso-session my-org]
sso_start_url = https://my-org.awsapps.com/start
sso_region = ap-northeast-1
sso_registration_scopes = sso:account:access

[profile dev]
sso_session = my-org
sso_account_id = 111111111111
sso_role_name = PowerUserAccess
region = ap-northeast-1

[profile staging]
sso_session = my-org
sso_account_id = 222222222222
sso_role_name = PowerUserAccess
region = ap-northeast-1

[profile prod]
sso_session = my-org
sso_account_id = 333333333333
sso_role_name = ReadOnlyAccess
region = ap-northeast-1

[profile prod-admin]
sso_session = my-org
sso_account_id = 333333333333
sso_role_name = AdministratorAccess
region = ap-northeast-1
```

---

## 7. Credential Management in CI/CD

### 7.1 GitHub Actions + OIDC (Recommended)

```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS
on:
  push:
    branches: [main]

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsRole
          aws-region: ap-northeast-1
          role-session-name: github-actions-${{ github.run_id }}

      - name: Deploy
        run: |
          aws s3 sync ./build s3://my-app-bucket --delete
          aws cloudfront create-invalidation \
            --distribution-id EDFDVBD6EXAMPLE \
            --paths "/*"
```

### 7.2 IAM Role for GitHub Actions

```json
{
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
}
```

### 7.3 OIDC Provider Configuration with Terraform

```hcl
# GitHub Actions OIDC Provider
resource "aws_iam_openid_connect_provider" "github_actions" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["ffffffffffffffffffffffffffffffffffffffff"]
}

# Role for GitHub Actions
resource "aws_iam_role" "github_actions" {
  name = "github-actions-deploy-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github_actions.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:my-org/my-repo:*"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "github_actions_s3" {
  role       = aws_iam_role.github_actions.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}
```

---

## 8. Credential Management Best Practices

### 8.1 Recommended Methods by Environment

| Environment | Recommended Method | Reason |
|------|---------|------|
| Local development | IAM Identity Center (SSO) | Temporary credentials, MFA integration |
| CI/CD | OIDC (GitHub Actions, etc.) | No access keys needed |
| On EC2 | Instance profile | Automatic rotation |
| On ECS | Task role | Per-container permission isolation |
| Lambda | Execution role | Automatically assigned |
| On EKS | IRSA (IAM Roles for Service Accounts) | Per-pod permission isolation |
| Local (SSO unavailable) | aws-vault + temporary credentials | Encrypted storage |

### 8.2 Credential Management Anti-Patterns

```
+---------------------------------------------+
|  Things you must NEVER do                    |
+---------------------------------------------+
| x Hard-code access keys in source code       |
| x Commit .env files to Git                   |
| x Share access keys via Slack/email           |
| x Share the same access key among everyone    |
| x Never rotate access keys                   |
| x Create access keys for the root user       |
+---------------------------------------------+
|  What you should do instead                  |
+---------------------------------------------+
| o Use IAM roles / temporary credentials       |
| o Manage secrets with AWS Secrets Manager     |
| o Add .env and credentials to .gitignore      |
| o Detect leaks with git-secrets               |
| o Rotate keys every 90 days                   |
| o Use OIDC integration for CI/CD              |
+---------------------------------------------+
```

### 8.3 Setting Up git-secrets

```bash
# Install
brew install git-secrets  # macOS
# or
git clone https://github.com/awslabs/git-secrets.git
cd git-secrets && make install

# Configure for a repository
cd /path/to/repo
git secrets --install
git secrets --register-aws

# Global configuration (applies to all repositories)
git secrets --install ~/.git-templates/git-secrets
git config --global init.templateDir ~/.git-templates/git-secrets
git secrets --register-aws --global

# Test
echo "AKIAIOSFODNN7EXAMPLE" > test.txt
git add test.txt
git commit -m "test"
# → ERROR: Matched one or more prohibited patterns
```

### 8.4 Integration with AWS Secrets Manager

```python
import boto3
import json

def get_secret(secret_name, region='ap-northeast-1'):
    """Retrieve a secret from Secrets Manager"""
    client = boto3.client('secretsmanager', region_name=region)
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response['SecretString'])

# Usage example
db_creds = get_secret('prod/database')
connection = psycopg2.connect(
    host=db_creds['host'],
    port=db_creds['port'],
    dbname=db_creds['dbname'],
    user=db_creds['username'],
    password=db_creds['password'],
)
```

```javascript
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'ap-northeast-1' });

async function getSecret(secretName) {
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);
  return JSON.parse(response.SecretString);
}

// Usage example
const dbCreds = await getSecret('prod/database');
```

---

## 9. AWS CloudShell

### 9.1 CloudShell Overview

AWS CloudShell is a service that provides browser-based shell access from the AWS Management Console.

```
CloudShell Features
+----------------------------------------------------------+
|  ✓ AWS CLI v2 comes pre-installed                         |
|  ✓ Credentials are automatically obtained from the        |
|    console login session                                  |
|  ✓ 1GB of persistent storage ($HOME)                      |
|  ✓ Python, Node.js, Java, PowerShell, etc. pre-installed  |
|  ✓ Packages can be added via pip, npm, etc.               |
|  ✓ Free (available with console access permissions)       |
|                                                           |
|  Limitations:                                             |
|  × Times out after 20 minutes of inactivity               |
|  × Concurrent session limit applies                       |
|  × Not available in some regions                          |
|  × Outbound traffic only (no inbound)                     |
+----------------------------------------------------------+
```

---

## 10. Anti-Patterns

### Anti-Pattern 1: Embedding Access Keys Directly in Source Code

```python
# Bad example — never do this
s3 = boto3.client('s3',
    aws_access_key_id='AKIAIOSFODNN7EXAMPLE',
    aws_secret_access_key='wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
)

# Good example — use environment variables or IAM roles
s3 = boto3.client('s3', region_name='ap-northeast-1')
# Credentials are automatically resolved from environment variables,
# ~/.aws/credentials, or IAM roles
```

### Anti-Pattern 2: Using AdministratorAccess for All Operations

Granting `AdministratorAccess` to all developers increases the risk of accidental resource deletion and security incidents. Custom policies with minimum required permissions should be created instead.

```bash
# Bad example
aws iam attach-user-policy \
  --user-name developer \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# Good example — custom policy with only necessary permissions
aws iam attach-user-policy \
  --user-name developer \
  --policy-arn arn:aws:iam::123456789012:policy/DeveloperLimitedAccess
```

### Anti-Pattern 3: Using SDK Without Error Handling

```python
# Bad example — no error handling
s3.get_object(Bucket='my-bucket', Key='data.json')

# Good example — proper error handling
from botocore.exceptions import ClientError

try:
    response = s3.get_object(Bucket='my-bucket', Key='data.json')
except ClientError as e:
    error_code = e.response['Error']['Code']
    if error_code == 'NoSuchKey':
        print("Object not found")
    elif error_code == 'NoSuchBucket':
        print("Bucket not found")
    elif error_code == 'AccessDenied':
        print("Access denied - check IAM permissions")
    else:
        raise
```

### Anti-Pattern 4: Not Considering Pagination

```python
# Bad example — only retrieves the first 1000 items
response = s3.list_objects_v2(Bucket='my-bucket')
objects = response['Contents']

# Good example — retrieve all items with paginator
paginator = s3.get_paginator('list_objects_v2')
objects = []
for page in paginator.paginate(Bucket='my-bucket'):
    objects.extend(page.get('Contents', []))
```

---

## 11. Local Development with LocalStack

### 11.1 Setting Up LocalStack

```bash
# Start with Docker
docker run -d \
  --name localstack \
  -p 4566:4566 \
  -e SERVICES=s3,dynamodb,sqs,lambda \
  -e DEFAULT_REGION=ap-northeast-1 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  localstack/localstack

# Point AWS CLI endpoint to LocalStack
alias awslocal='aws --endpoint-url=http://localhost:4566'

# Create an S3 bucket
awslocal s3 mb s3://my-test-bucket

# Create a DynamoDB table
awslocal dynamodb create-table \
  --table-name Users \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST
```

### 11.2 Using LocalStack with Python

```python
import boto3

# Client for LocalStack
def get_localstack_client(service):
    return boto3.client(
        service,
        endpoint_url='http://localhost:4566',
        region_name='ap-northeast-1',
        aws_access_key_id='test',
        aws_secret_access_key='test',
    )

s3 = get_localstack_client('s3')
dynamodb = get_localstack_client('dynamodb')

# Use in test code
def test_upload_and_download():
    s3.put_object(
        Bucket='my-test-bucket',
        Key='test.json',
        Body='{"message": "hello"}',
    )
    response = s3.get_object(Bucket='my-test-bucket', Key='test.json')
    body = response['Body'].read().decode('utf-8')
    assert '"hello"' in body
```

---

## 12. FAQ

### Q1. What is the difference between AWS CLI v1 and v2?

v2 is the successor to v1, with additions including SSO integration, auto-pagination, AWS CloudShell support, and auto-prompt (`--cli-auto-prompt`). New projects should use v2. v1 transitioned to maintenance mode after 2024.

### Q2. What is the difference between SDK v2 and v3 (JavaScript)?

v3 adopts a modular architecture, allowing you to import only the services you need. Benefits include reduced bundle size, tree-shaking support, and customizable middleware stacks. Use v3 for new projects.

### Q3. What should I do if credentials are leaked?

(1) Immediately deactivate and delete the affected access key, (2) check CloudTrail for unauthorized activity, (3) identify and remediate affected resources, (4) generate new keys (migrate to IAM roles if possible), (5) implement git-secrets and GuardDuty to prevent recurrence.

### Q4. What is the difference between boto3's client and resource?

client is a thin wrapper that directly calls low-level AWS APIs. resource is a high-level object-oriented interface. resource only supports some services. Newer services often only support client. Use client when performance is critical.

### Q5. How should I configure the AWS SDK retry strategy?

By default, standard mode retries 3 times. Adaptive mode adjusts retry intervals based on API response headers. If throttling occurs frequently, consider adaptive mode and increasing maxAttempts.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how it works.

### Q2: What are common mistakes beginners make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 13. Summary

| Topic | Key Points |
|------|---------|
| CLI Installation | Use v2, initial setup with `aws configure` |
| Profiles | Separate named profiles for each environment |
| Credential Resolution | Command line -> Environment variables -> Files -> Roles (in order) |
| JMESPath | Extract only the data you need with --query |
| Waiters | Safely wait for async resource completion |
| SDK (JavaScript) | v3 modular imports, error handling is essential |
| SDK (Python) | boto3 resolves credentials automatically, leverage paginators |
| Security | IAM roles recommended, hard-coding access keys is strictly prohibited |
| SSO | IAM Identity Center recommended for multi-account operations |
| CI/CD | Access-key-free deployment with OIDC integration |
| Local Development | Emulate AWS services with LocalStack |

---

## Recommended Next Reads

- [../01-compute/00-ec2-basics.md](../01-compute/00-ec2-basics.md) — EC2 Instance Basics
- [../02-storage/00-s3-basics.md](../02-storage/00-s3-basics.md) — S3 Basics

---

## References

1. AWS CLI v2 User Guide — https://docs.aws.amazon.com/cli/latest/userguide/
2. AWS SDK for JavaScript v3 Developer Guide — https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/
3. Boto3 Documentation — https://boto3.amazonaws.com/v1/documentation/api/latest/index.html
4. AWS Security Credentials Best Practices — https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html
5. JMESPath Specification — https://jmespath.org/specification.html
6. LocalStack Documentation — https://docs.localstack.cloud/
7. GitHub Actions OIDC with AWS — https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services

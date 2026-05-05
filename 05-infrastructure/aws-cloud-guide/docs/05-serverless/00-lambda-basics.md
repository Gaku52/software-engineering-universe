# AWS Lambda Basics

> A systematic guide to AWS Lambda — running code without managing any servers — covering core concepts, function creation, trigger configuration, IAM roles, environment variables, and layers.

---

## What You Will Learn

1. **Creating and deploying Lambda functions** -- understand the end-to-end flow from selecting a runtime to uploading code and running tests
2. **Designing triggers and IAM roles** -- correctly configure event sources such as API Gateway, S3, and SQS, along with least-privilege execution roles
3. **Using environment variables and layers** -- learn how to externalize configuration and reuse shared libraries to improve maintainability


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. What Is Lambda?

### 1.1 Where Serverless Computing Fits In

```
Traditional (EC2)         Containers (ECS/EKS)        Serverless (Lambda)
+-----------------+      +-----------------+      +-----------------+
| Application     |      | Application     |      | Application     |
+-----------------+      +-----------------+      +-----------------+
| Middleware      |      | Container RT    |      |                 |
+-----------------+      +-----------------+      |  Managed by AWS |
| OS              |      |  OS (shared)    |      |                 |
+-----------------+      +-----------------+      +-----------------+
| Hardware        |      | Hardware        |      | Hardware        |
+-----------------+      +-----------------+      +-----------------+
  User manages: broad     User manages: medium     User manages: narrow
```

Lambda is an event-driven computing service with the following characteristics.

- **No provisioning required** -- AWS automatically manages server start/stop and scaling
- **Pay-per-execution** -- billed by number of requests and execution duration (1 ms increments)
- **Automatic scaling** -- concurrent executions increase and decrease automatically with demand
- **Broad language support** -- Python, Node.js, Java, Go, .NET, Ruby, and custom runtimes

### 1.2 Lambda Execution Model

```
Event Sources            Lambda Service               Execution Environment
+------------+        +------------------+        +------------------+
|            | invoke |                  | place  |  Exec Env (MicroVM)|
| API Gateway| -----> |  Lambda Control  | -----> |  +-------------+ |
| S3         |        |  Plane           |        |  | Runtime     | |
| SQS        |        |                  |        |  | + User      | |
| EventBridge|        +------------------+        |  |   Code      | |
+------------+               |                    |  +-------------+ |
                             |  send logs         +------------------+
                             v                           |
                    +------------------+                  | metrics
                    |  CloudWatch Logs |                  v
                    +------------------+          +------------------+
                                                  | CloudWatch       |
                                                  | Metrics          |
                                                  +------------------+
```

### 1.3 Lambda Pricing Model

Lambda pricing is determined by two axes: "number of requests" and "execution duration (GB-seconds)".

| Pricing Factor | Unit Price (Tokyo Region) | Free Tier (Monthly) |
|----------------|--------------------------|---------------------|
| Number of requests | $0.20 / 1 million requests | 1 million requests |
| Execution duration (GB-seconds) | $0.0000166667 / GB-second | 400,000 GB-seconds |
| Provisioned Concurrency | $0.0000041667 / GB-second | None |
| Lambda@Edge requests | $0.60 / 1 million requests | None |

```
Cost calculation example:

Function configuration:
  Memory: 512 MB (= 0.5 GB)
  Average execution time: 200 ms (= 0.2 seconds)
  Monthly requests: 5 million

Calculation:
  GB-seconds = 0.5 GB × 0.2 s × 5,000,000 = 500,000 GB-seconds
  After free tier = 500,000 - 400,000 = 100,000 GB-seconds
  Duration cost = 100,000 × $0.0000166667 = $1.67
  Request cost = (5,000,000 - 1,000,000) × $0.20/1,000,000 = $0.80

  Monthly total = $1.67 + $0.80 = $2.47
```

### 1.4 Lambda Lifecycle

```
┌──────────────────────────────────────────────────────────────┐
│  Lambda Execution Environment Lifecycle                       │
│                                                              │
│  INIT Phase (cold start only)                                │
│  ┌──────────────────────────────────────────────────┐        │
│  │ 1. Extension Init   (Lambda Extensions init)     │        │
│  │ 2. Runtime Init     (Runtime initialization)     │        │
│  │ 3. Function Init    (Execute code outside handler)│        │
│  │    - Initialize global variables                 │        │
│  │    - Create SDK clients                          │        │
│  │    - Establish DB connections                    │        │
│  └──────────────────────────────────────────────────┘        │
│                        │                                     │
│                        ▼                                     │
│  INVOKE Phase (runs every time)                              │
│  ┌──────────────────────────────────────────────────┐        │
│  │ 4. Execute lambda_handler(event, context)        │        │
│  │    - Process event data                          │        │
│  │    - Business logic                              │        │
│  │    - Return response                             │        │
│  └──────────────────────────────────────────────────┘        │
│                        │                                     │
│                        ▼                                     │
│  SHUTDOWN Phase (when environment is destroyed)              │
│  ┌──────────────────────────────────────────────────┐        │
│  │ 5. Runtime Shutdown  (Runtime teardown)          │        │
│  │ 6. Extension Shutdown (Extensions teardown)      │        │
│  └──────────────────────────────────────────────────┘        │
│                                                              │
│  * Execution environments are reused for a period (Warm Start)│
│  * On reuse, only the INVOKE phase runs                      │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Creating Lambda Functions

### 2.1 Supported Runtimes

| Runtime | Identifier | Support Status | Primary Use Cases |
|---------|-----------|---------------|-------------------|
| Python 3.12 | `python3.12` | GA | Data processing, API backend |
| Node.js 20.x | `nodejs20.x` | GA | API backend, real-time processing |
| Java 21 | `java21` | GA | Enterprise, batch processing |
| Go (provided.al2023) | `provided.al2023` | GA | High-performance processing |
| .NET 8 | `dotnet8` | GA | Windows integration, enterprise |
| Ruby 3.3 | `ruby3.3` | GA | Scripts, webhooks |
| Custom runtime | `provided.al2023` | GA | Rust, PHP, and any other language |

### 2.2 Hello World in Python

```python
# lambda_function.py
import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    """
    Lambda のエントリポイント。

    Parameters:
        event (dict): トリガーから渡されるイベントデータ
        context (LambdaContext): 実行コンテキスト情報

    Returns:
        dict: API Gateway 互換のレスポンス
    """
    logger.info(f"Received event: {json.dumps(event)}")

    name = event.get("queryStringParameters", {}).get("name", "World")

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps({
            "message": f"Hello, {name}!",
            "requestId": context.aws_request_id,
            "remainingTime": context.get_remaining_time_in_millis()
        })
    }
```

### 2.3 Node.js Implementation Example

```javascript
// index.mjs (ES Modules)
export const handler = async (event, context) => {
  console.log("Event:", JSON.stringify(event, null, 2));

  const name = event.queryStringParameters?.name || "World";

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({
      message: `Hello, ${name}!`,
      requestId: context.awsRequestId,
    }),
  };
};
```

### 2.4 Creating a Function with AWS CLI

```bash
# 1. Create deployment package
zip function.zip lambda_function.py

# 2. Create the Lambda function
aws lambda create-function \
  --function-name my-hello-function \
  --runtime python3.12 \
  --role arn:aws:iam::123456789012:role/lambda-execution-role \
  --handler lambda_function.lambda_handler \
  --zip-file fileb://function.zip \
  --timeout 30 \
  --memory-size 256 \
  --description "Hello World Lambda function"

# 3. Test invocation
aws lambda invoke \
  --function-name my-hello-function \
  --payload '{"queryStringParameters": {"name": "AWS"}}' \
  --cli-binary-format raw-in-base64-out \
  output.json

cat output.json
```

### 2.5 Memory and Timeout Settings

| Setting | Minimum | Maximum | Default | Notes |
|---------|---------|---------|---------|-------|
| Memory | 128 MB | 10,240 MB | 128 MB | CPU allocated proportionally |
| Timeout | 1 second | 900 seconds (15 min) | 3 seconds | 29-second limit when via API Gateway |
| Ephemeral storage | 512 MB | 10,240 MB | 512 MB | /tmp area |
| Deployment package | - | 50 MB (zip) / 250 MB (unzipped) | - | Including layers |
| Container image | - | 10 GB | - | When using ECR image |

```
Memory and CPU relationship:

Memory        Approx vCPU   Use Case
128 MB   -->  ~0.08 vCPU    Lightweight API responses
512 MB   -->  ~0.33 vCPU    General API processing
1,024 MB -->  ~0.58 vCPU    Data transformation
1,769 MB -->  1 vCPU        Compute-intensive tasks
3,008 MB -->  2 vCPU        Image processing
10,240 MB --> 6 vCPU        ML inference, large-scale batch
```

### 2.6 Deploying with a Container Image

Use a container image when the 250 MB ZIP package limit is exceeded or when an existing Docker workflow is in place.

```dockerfile
# Dockerfile
FROM public.ecr.aws/lambda/python:3.12

# Install dependencies
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt --target "${LAMBDA_TASK_ROOT}"

# Copy function code
COPY app.py ${LAMBDA_TASK_ROOT}

# Specify handler
CMD [ "app.lambda_handler" ]
```

```bash
# 1. Create ECR repository
aws ecr create-repository \
  --repository-name my-lambda-function \
  --image-scanning-configuration scanOnPush=true

# 2. Build and push Docker image
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.ap-northeast-1.amazonaws.com

docker build -t my-lambda-function .
docker tag my-lambda-function:latest \
  123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/my-lambda-function:latest
docker push \
  123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/my-lambda-function:latest

# 3. Create Lambda function from container image
aws lambda create-function \
  --function-name my-container-function \
  --package-type Image \
  --code ImageUri=123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/my-lambda-function:latest \
  --role arn:aws:iam::123456789012:role/lambda-execution-role \
  --timeout 60 \
  --memory-size 512
```

---

## 3. Triggers and Event Sources

### 3.1 Major Event Sources

```
+------------------+   Synchronous invoke  +--------+
| API Gateway      | --------------------> |        |
| ALB              |                       |        |
| Lambda URL       |                       |        |
+------------------+                       |        |
                                           | Lambda |
+------------------+  Asynchronous invoke  |  Func  |
| S3               | --------------------> |        |
| SNS              |                       |        |
| EventBridge      |                       |        |
| IoT              |                       |        |
+------------------+                       |        |
                                           |        |
+------------------+   Polling-based       |        |
| SQS              | --------------------> |        |
| DynamoDB Streams | (Event Source         |        |
| Kinesis          |  Mapping)             |        |
+------------------+                       +--------+
```

### 3.2 Invocation Model Comparison

| Invocation Model | Example Event Sources | Retry Behavior | Error Handling |
|------------------|-----------------------|----------------|----------------|
| Synchronous (RequestResponse) | API Gateway, ALB | Controlled by caller | Error response returned immediately |
| Asynchronous (Event) | S3, SNS, EventBridge | Up to 2 retries | DLQ / Destinations |
| Polling (Event Source Mapping) | SQS, Kinesis, DynamoDB | Varies by source | Batch failure control |

### 3.3 Configuring an API Gateway Trigger

```bash
# Create REST API and Lambda integration
aws apigateway create-rest-api \
  --name "HelloAPI" \
  --description "Hello World API"

# Add Lambda permission
aws lambda add-permission \
  --function-name my-hello-function \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:ap-northeast-1:123456789012:abc123/*"
```

### 3.4 Configuring an S3 Trigger

```bash
# Allow Lambda invocation from S3 bucket
aws lambda add-permission \
  --function-name image-processor \
  --statement-id s3-invoke \
  --action lambda:InvokeFunction \
  --principal s3.amazonaws.com \
  --source-arn "arn:aws:s3:::my-upload-bucket" \
  --source-account 123456789012

# Configure S3 bucket notification
aws s3api put-bucket-notification-configuration \
  --bucket my-upload-bucket \
  --notification-configuration '{
    "LambdaFunctionConfigurations": [
      {
        "LambdaFunctionArn": "arn:aws:lambda:ap-northeast-1:123456789012:function:image-processor",
        "Events": ["s3:ObjectCreated:*"],
        "Filter": {
          "Key": {
            "FilterRules": [
              {"Name": "prefix", "Value": "uploads/"},
              {"Name": "suffix", "Value": ".jpg"}
            ]
          }
        }
      }
    ]
  }'
```

```python
# Lambda function for S3 trigger
import json
import boto3
import urllib.parse

s3 = boto3.client("s3")

def lambda_handler(event, context):
    """S3 にアップロードされた画像を処理する"""
    for record in event["Records"]:
        bucket = record["s3"]["bucket"]["name"]
        key = urllib.parse.unquote_plus(record["s3"]["object"]["key"])
        size = record["s3"]["object"]["size"]

        print(f"Processing: s3://{bucket}/{key} ({size} bytes)")

        # オブジェクトのメタデータ取得
        response = s3.head_object(Bucket=bucket, Key=key)
        content_type = response["ContentType"]

        # サムネイル生成 (Pillow が必要 → レイヤーで追加)
        if content_type.startswith("image/"):
            obj = s3.get_object(Bucket=bucket, Key=key)
            # ... 画像処理ロジック
            s3.put_object(
                Bucket=bucket,
                Key=f"thumbnails/{key}",
                Body=thumbnail_bytes,
                ContentType=content_type
            )

    return {"statusCode": 200, "body": "Processed"}
```

### 3.5 Configuring an SQS Trigger

```bash
# Create SQS event source mapping
aws lambda create-event-source-mapping \
  --function-name order-processor \
  --event-source-arn arn:aws:sqs:ap-northeast-1:123456789012:orders-queue \
  --batch-size 10 \
  --maximum-batching-window-in-seconds 5 \
  --function-response-types ReportBatchItemFailures
```

```python
# Lambda function for SQS trigger (with partial batch failure reporting)
import json

def lambda_handler(event, context):
    """SQS メッセージをバッチ処理し、失敗したメッセージのみを報告する"""
    batch_item_failures = []

    for record in event["Records"]:
        try:
            body = json.loads(record["body"])
            order_id = body["orderId"]
            print(f"Processing order: {order_id}")

            # 注文処理ロジック
            process_order(body)

        except Exception as e:
            print(f"Error processing {record['messageId']}: {e}")
            # 失敗したメッセージ ID を記録
            batch_item_failures.append({
                "itemIdentifier": record["messageId"]
            })

    # 部分バッチ失敗レポート
    # 成功したメッセージはキューから削除され、失敗したメッセージのみリトライされる
    return {
        "batchItemFailures": batch_item_failures
    }


def process_order(order):
    """注文処理のビジネスロジック"""
    import boto3
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table("Orders")

    table.put_item(Item={
        "PK": f"ORDER#{order['orderId']}",
        "SK": "DETAIL",
        "status": "PROCESSING",
        "items": order["items"],
        "total": order["total"]
    })
```

### 3.6 Configuring an EventBridge Trigger

```bash
# Create EventBridge rule (scheduled execution)
aws events put-rule \
  --name "daily-cleanup" \
  --schedule-expression "cron(0 3 * * ? *)" \
  --description "Runs daily at 3:00 AM (UTC)"

# Add Lambda as target
aws events put-targets \
  --rule "daily-cleanup" \
  --targets "Id"="1","Arn"="arn:aws:lambda:ap-northeast-1:123456789012:function:cleanup-function"

# Add Lambda permission
aws lambda add-permission \
  --function-name cleanup-function \
  --statement-id eventbridge-invoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:ap-northeast-1:123456789012:rule/daily-cleanup"
```

```bash
# EventBridge rule (custom event pattern)
aws events put-rule \
  --name "order-created" \
  --event-pattern '{
    "source": ["myapp.orders"],
    "detail-type": ["OrderCreated"],
    "detail": {
      "total": [{"numeric": [">=", 10000]}]
    }
  }' \
  --description "Notify when an order of 10,000 yen or more is created"
```

### 3.7 Configuring a DynamoDB Streams Trigger

```bash
# Enable DynamoDB Streams
aws dynamodb update-table \
  --table-name Users \
  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES

# Create event source mapping
STREAM_ARN=$(aws dynamodb describe-table \
  --table-name Users \
  --query 'Table.LatestStreamArn' \
  --output text)

aws lambda create-event-source-mapping \
  --function-name user-change-handler \
  --event-source-arn $STREAM_ARN \
  --starting-position LATEST \
  --batch-size 100 \
  --maximum-batching-window-in-seconds 10 \
  --bisect-batch-on-function-error \
  --maximum-retry-attempts 3 \
  --destination-config '{
    "OnFailure": {
      "Destination": "arn:aws:sqs:ap-northeast-1:123456789012:dlq-stream-failures"
    }
  }'
```

### 3.8 Lambda Function URL

A feature that assigns a direct HTTPS endpoint to a Lambda function without using API Gateway.

```bash
# Create Function URL
aws lambda create-function-url-config \
  --function-name my-hello-function \
  --auth-type NONE \
  --cors '{
    "AllowOrigins": ["https://example.com"],
    "AllowMethods": ["GET", "POST"],
    "AllowHeaders": ["Content-Type", "Authorization"],
    "MaxAge": 86400
  }'

# Add resource-based policy (required when AuthType=NONE)
aws lambda add-permission \
  --function-name my-hello-function \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE

# Check Function URL
aws lambda get-function-url-config \
  --function-name my-hello-function
# → https://abc123def456.lambda-url.ap-northeast-1.on.aws/
```

| Feature | Lambda Function URL | API Gateway HTTP API |
|---------|--------------------|--------------------|
| Cost | Lambda charges only | Lambda + API Gateway charges |
| Authentication | IAM_AUTH or NONE | JWT, IAM, Lambda Auth |
| Throttling | None (Lambda concurrency limit only) | Configurable per route |
| Custom domain | Possible via CloudFront | Native support |
| WAF | Not supported | REST API only |
| Recommended for | Internal APIs, webhooks, simple endpoints | Production APIs |

---

## 4. IAM Role Design

### 4.1 Components of an Execution Role

An IAM role required for a Lambda function consists of two parts.

1. **Trust Policy** -- permission for the Lambda service to assume this role
2. **Permission Policy** -- permission for the function to access AWS resources

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

### 4.2 Least-Privilege Policy Example

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:ap-northeast-1:123456789012:log-group:/aws/lambda/my-hello-function:*"
    },
    {
      "Sid": "DynamoDBAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:ap-northeast-1:123456789012:table/MyTable"
    }
  ]
}
```

### 4.3 Creating an IAM Role with AWS CLI

```bash
# 1. Create trust policy file
cat > trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# 2. Create IAM role
aws iam create-role \
  --role-name order-processor-role \
  --assume-role-policy-document file://trust-policy.json

# 3. Attach AWS managed policy (basic CloudWatch Logs permissions)
aws iam attach-role-policy \
  --role-name order-processor-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# 4. Add additional policy for VPC execution
aws iam attach-role-policy \
  --role-name order-processor-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole

# 5. Add custom inline policy
aws iam put-role-policy \
  --role-name order-processor-role \
  --policy-name dynamodb-access \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query"
        ],
        "Resource": [
          "arn:aws:dynamodb:ap-northeast-1:123456789012:table/Orders",
          "arn:aws:dynamodb:ap-northeast-1:123456789012:table/Orders/index/*"
        ]
      },
      {
        "Effect": "Allow",
        "Action": ["sqs:SendMessage"],
        "Resource": "arn:aws:sqs:ap-northeast-1:123456789012:notification-queue"
      }
    ]
  }'
```

---

## 5. Environment Variables

### 5.1 Setting and Using Environment Variables

```bash
# Set environment variables
aws lambda update-function-configuration \
  --function-name my-hello-function \
  --environment "Variables={
    DB_TABLE=users-table,
    LOG_LEVEL=INFO,
    REGION=ap-northeast-1,
    FEATURE_FLAG_NEW_UI=true
  }"
```

```python
# lambda_function.py -- reading environment variables
import os

TABLE_NAME = os.environ.get("DB_TABLE", "default-table")
LOG_LEVEL = os.environ.get("LOG_LEVEL", "WARNING")
REGION = os.environ.get("REGION", "ap-northeast-1")
FEATURE_FLAG = os.environ.get("FEATURE_FLAG_NEW_UI", "false") == "true"

def lambda_handler(event, context):
    # Access DynamoDB using TABLE_NAME
    import boto3
    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    table = dynamodb.Table(TABLE_NAME)
    # ...
```

### 5.2 Encrypting Environment Variables

```
Environment variable encryption flow:

At configuration time:
  Plaintext --> Encrypted with AWS KMS --> Encrypted env var stored

At execution time:
  Encrypted env var --> Lambda runtime decrypts automatically --> Available as plaintext

When using a custom KMS key:
  Lambda execution role requires kms:Decrypt permission
```

| Encryption Method | Description | Additional Configuration |
|-------------------|-------------|--------------------------|
| Default encryption | Automatically encrypted with AWS managed key | None required |
| Custom KMS key | Encrypted with a customer-managed key | Specify KMS key ARN |
| Helper encryption | Adds encryption in transit | Configure in Lambda console |

### 5.3 Integration with Secrets Manager / Parameter Store

Sensitive information (API keys, DB passwords, etc.) should be stored in Secrets Manager or Parameter Store rather than environment variables, and retrieved at Lambda execution time — this is the best practice.

```python
# Retrieve a secret from Secrets Manager
import json
import boto3
from functools import lru_cache

secrets_client = boto3.client("secretsmanager")

@lru_cache(maxsize=1)
def get_db_credentials():
    """
    シークレットを取得し、キャッシュする。
    lru_cache により、同一実行環境内では1回のみ取得。
    """
    response = secrets_client.get_secret_value(
        SecretId="prod/myapp/db-credentials"
    )
    return json.loads(response["SecretString"])

def lambda_handler(event, context):
    creds = get_db_credentials()
    host = creds["host"]
    username = creds["username"]
    password = creds["password"]
    # DB 接続...
```

```python
# Parameter Store + Lambda Extensions (performance optimization)
# Uses AWS Parameters and Secrets Lambda Extension
import urllib.request
import json
import os

AWS_SESSION_TOKEN = os.environ["AWS_SESSION_TOKEN"]
PARAMETERS_EXTENSION_PORT = 2773

def get_parameter(name):
    """
    Lambda Extensions 経由で Parameter Store からパラメータを取得。
    Extensions のキャッシュにより、API 呼び出し回数を削減。
    """
    url = f"http://localhost:{PARAMETERS_EXTENSION_PORT}/systemsmanager/parameters/get?name={name}&withDecryption=true"
    headers = {"X-Aws-Parameters-Secrets-Token": AWS_SESSION_TOKEN}
    req = urllib.request.Request(url, headers=headers)
    response = urllib.request.urlopen(req)
    return json.loads(response.read())["Parameter"]["Value"]

def lambda_handler(event, context):
    api_key = get_parameter("/myapp/prod/api-key")
    # ...
```

---

## 6. Lambda Layers

### 6.1 How Layers Work

```
Lambda function filesystem:

/opt/                      <-- Layer extraction destination
  ├── python/              <-- Python libraries
  │   └── lib/
  │       └── python3.12/
  │           └── site-packages/
  │               ├── requests/
  │               └── boto3/
  ├── nodejs/              <-- Node.js libraries
  │   └── node_modules/
  └── bin/                 <-- Custom binaries

/var/task/                 <-- Function code
  └── lambda_function.py

/tmp/                      <-- Ephemeral storage (512MB-10GB)
```

### 6.2 Creating and Attaching a Layer

```bash
# 1. Create directory structure for the layer
mkdir -p layer/python
pip install requests -t layer/python/

# 2. Create ZIP package
cd layer && zip -r ../my-layer.zip python/

# 3. Publish the layer
aws lambda publish-layer-version \
  --layer-name my-common-libs \
  --description "Common libraries (requests, etc.)" \
  --zip-file fileb://my-layer.zip \
  --compatible-runtimes python3.12 python3.11

# 4. Attach layer to a function
aws lambda update-function-configuration \
  --function-name my-hello-function \
  --layers arn:aws:lambda:ap-northeast-1:123456789012:layer:my-common-libs:1
```

### 6.3 Layer Limits

| Item | Limit |
|------|-------|
| Maximum layers per function | 5 |
| Total unzipped size including layers | 250 MB |
| Number of layer versions | Unlimited |
| Layer sharing | Within the same region; cross-account sharing possible |

### 6.4 Powertools for AWS Lambda (Python) Layer

AWS Lambda Powertools is a library provided by AWS that makes it easy to implement cross-cutting concerns such as logging, tracing, and metrics. It is available as a public layer.

```bash
# Add Powertools layer
aws lambda update-function-configuration \
  --function-name my-function \
  --layers arn:aws:lambda:ap-northeast-1:017000801446:layer:AWSLambdaPowertoolsPythonV2:67
```

```python
# Logging, tracing, and metrics with Powertools
from aws_lambda_powertools import Logger, Tracer, Metrics
from aws_lambda_powertools.metrics import MetricUnit
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger(service="order-service")
tracer = Tracer(service="order-service")
metrics = Metrics(namespace="MyApp", service="order-service")

@logger.inject_lambda_context(log_event=True)
@tracer.capture_lambda_handler
@metrics.log_metrics(capture_cold_start_metric=True)
def lambda_handler(event: dict, context: LambdaContext):
    order_id = event.get("orderId")

    # 構造化ログ
    logger.info("Processing order", extra={"order_id": order_id})

    # カスタムメトリクス
    metrics.add_metric(name="OrderProcessed", unit=MetricUnit.Count, value=1)

    # X-Ray サブセグメント
    with tracer.provider.in_subsegment("validate_order") as subsegment:
        subsegment.put_annotation("order_id", order_id)
        result = validate_order(order_id)

    return {"statusCode": 200, "body": "OK"}
```

---

## 7. VPC Configuration and RDS Proxy

### 7.1 Running Lambda Inside a VPC

Placing a Lambda function inside a VPC allows it to access private resources such as RDS and ElastiCache.

```
┌────────────────────────────────────────────────────────┐
│  VPC (10.0.0.0/16)                                     │
│                                                        │
│  ┌──────────────────┐    ┌──────────────────┐          │
│  │ Private Subnet A │    │ Private Subnet B │          │
│  │ (10.0.1.0/24)    │    │ (10.0.2.0/24)    │          │
│  │                  │    │                  │          │
│  │  ┌────────────┐  │    │  ┌────────────┐  │          │
│  │  │ Lambda ENI │  │    │  │ Lambda ENI │  │          │
│  │  └──────┬─────┘  │    │  └──────┬─────┘  │          │
│  │         │        │    │         │        │          │
│  │         ▼        │    │         ▼        │          │
│  │  ┌────────────┐  │    │  ┌────────────┐  │          │
│  │  │ RDS Proxy  │  │    │  │ RDS (Read  │  │          │
│  │  │ (Writer)   │  │    │  │  Replica)  │  │          │
│  │  └────────────┘  │    │  └────────────┘  │          │
│  └──────────────────┘    └──────────────────┘          │
│                                                        │
│  ┌──────────────────┐                                  │
│  │ NAT Gateway      │ ← Required when Lambda calls     │
│  │ (Public Subnet)  │   external APIs                  │
│  └──────────────────┘                                  │
└────────────────────────────────────────────────────────┘
```

```bash
# Place Lambda function inside a VPC
aws lambda update-function-configuration \
  --function-name my-vpc-function \
  --vpc-config SubnetIds=subnet-aaa,subnet-bbb,SecurityGroupIds=sg-xxx

# To access the internet from a VPC Lambda,
# a NAT Gateway in a public subnet is required.
# (VPC Endpoints allow access to AWS services without NAT)
```

### 7.2 Connection Management with RDS Proxy

```bash
# Create RDS Proxy
aws rds create-db-proxy \
  --db-proxy-name my-lambda-proxy \
  --engine-family MYSQL \
  --auth '[{
    "AuthScheme": "SECRETS",
    "SecretArn": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:rds-credentials",
    "IAMAuth": "REQUIRED"
  }]' \
  --role-arn arn:aws:iam::123456789012:role/rds-proxy-role \
  --vpc-subnet-ids subnet-aaa subnet-bbb \
  --vpc-security-group-ids sg-xxx

# Register target group
aws rds register-db-proxy-targets \
  --db-proxy-name my-lambda-proxy \
  --db-instance-identifiers my-rds-instance
```

```python
# Connection via RDS Proxy (IAM authentication)
import boto3
import pymysql
import os

rds_client = boto3.client("rds")

# Initialize connection outside the handler (global scope)
# → Reuse the connection when the execution environment is reused
connection = None

def get_connection():
    global connection
    if connection is None or not connection.open:
        token = rds_client.generate_db_auth_token(
            DBHostname=os.environ["PROXY_ENDPOINT"],
            Port=3306,
            DBUsername=os.environ["DB_USER"],
            Region="ap-northeast-1"
        )
        connection = pymysql.connect(
            host=os.environ["PROXY_ENDPOINT"],
            user=os.environ["DB_USER"],
            password=token,
            database=os.environ["DB_NAME"],
            connect_timeout=5,
            ssl={"ssl": True}
        )
    return connection

def lambda_handler(event, context):
    conn = get_connection()
    with conn.cursor() as cursor:
        cursor.execute("SELECT * FROM users WHERE id = %s", (event["userId"],))
        result = cursor.fetchone()
    return {"statusCode": 200, "body": str(result)}
```

---

## 8. Deploying with SAM / CloudFormation

### 8.1 SAM Template

```yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Lambda function with SAM

Globals:
  Function:
    Runtime: python3.12
    Timeout: 30
    MemorySize: 256
    Tracing: Active
    Environment:
      Variables:
        LOG_LEVEL: INFO
        TABLE_NAME: !Ref OrdersTable

Parameters:
  Stage:
    Type: String
    Default: prod
    AllowedValues: [dev, staging, prod]

Resources:
  # API
  HttpApi:
    Type: AWS::Serverless::HttpApi
    Properties:
      StageName: !Ref Stage
      CorsConfiguration:
        AllowOrigins:
          - "https://example.com"
        AllowMethods:
          - GET
          - POST
        AllowHeaders:
          - Authorization
          - Content-Type

  # Lambda function (GET /orders)
  ListOrdersFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handlers/list_orders.lambda_handler
      CodeUri: src/
      Description: "Retrieve order list"
      Events:
        GetOrders:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /orders
            Method: GET
      Policies:
        - DynamoDBReadPolicy:
            TableName: !Ref OrdersTable

  # Lambda function (POST /orders)
  CreateOrderFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handlers/create_order.lambda_handler
      CodeUri: src/
      Description: "Create an order"
      Events:
        PostOrder:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /orders
            Method: POST
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref OrdersTable
        - SQSSendMessagePolicy:
            QueueName: !GetAtt NotificationQueue.QueueName

  # SQS queue
  NotificationQueue:
    Type: AWS::SQS::Queue
    Properties:
      QueueName: !Sub "${Stage}-notification-queue"
      VisibilityTimeout: 60
      RedrivePolicy:
        deadLetterTargetArn: !GetAtt DLQ.Arn
        maxReceiveCount: 3

  DLQ:
    Type: AWS::SQS::Queue
    Properties:
      QueueName: !Sub "${Stage}-notification-dlq"
      MessageRetentionPeriod: 1209600  # 14 days

  # Lambda triggered by SQS
  NotificationFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handlers/send_notification.lambda_handler
      CodeUri: src/
      Events:
        SQSEvent:
          Type: SQS
          Properties:
            Queue: !GetAtt NotificationQueue.Arn
            BatchSize: 10
            FunctionResponseTypes:
              - ReportBatchItemFailures
      Policies:
        - SESCrudPolicy:
            IdentityName: "example.com"

  # DynamoDB table
  OrdersTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub "${Stage}-Orders"
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: PK
          AttributeType: S
        - AttributeName: SK
          AttributeType: S
      KeySchema:
        - AttributeName: PK
          KeyType: HASH
        - AttributeName: SK
          KeyType: RANGE

Outputs:
  ApiUrl:
    Value: !Sub "https://${HttpApi}.execute-api.${AWS::Region}.amazonaws.com/${Stage}"
  ListOrdersFunctionArn:
    Value: !GetAtt ListOrdersFunction.Arn
```

```bash
# Deployment steps with SAM CLI
# 1. Build
sam build

# 2. Local test
sam local invoke ListOrdersFunction \
  --event events/get-orders.json

# 3. Start local API
sam local start-api --port 3000

# 4. Deploy
sam deploy \
  --stack-name my-order-api \
  --parameter-overrides Stage=prod \
  --capabilities CAPABILITY_IAM \
  --resolve-s3

# 5. Check logs
sam logs --name ListOrdersFunction --stack-name my-order-api --tail
```

### 8.2 Lambda Deployment with Terraform

```hcl
# main.tf

# Lambda function
resource "aws_lambda_function" "order_processor" {
  function_name = "${var.stage}-order-processor"
  role          = aws_iam_role.lambda_role.arn
  handler       = "handlers.order_processor.lambda_handler"
  runtime       = "python3.12"
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.orders.name
      LOG_LEVEL  = "INFO"
      STAGE      = var.stage
    }
  }

  tracing_config {
    mode = "Active"
  }

  # VPC configuration (when accessing RDS)
  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_logs,
    aws_iam_role_policy_attachment.lambda_vpc,
    aws_cloudwatch_log_group.lambda,
  ]

  tags = {
    Environment = var.stage
    Service     = "order-service"
  }
}

# ZIP the deployment package
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/src"
  output_path = "${path.module}/dist/lambda.zip"
}

# CloudWatch Logs group (with retention period)
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.stage}-order-processor"
  retention_in_days = 30
}

# IAM role
resource "aws_iam_role" "lambda_role" {
  name = "${var.stage}-order-processor-role"

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

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "dynamodb_access" {
  name = "dynamodb-access"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query"
      ]
      Resource = [
        aws_dynamodb_table.orders.arn,
        "${aws_dynamodb_table.orders.arn}/index/*"
      ]
    }]
  })
}

# SQS event source mapping
resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn                   = aws_sqs_queue.orders.arn
  function_name                      = aws_lambda_function.order_processor.arn
  batch_size                         = 10
  maximum_batching_window_in_seconds = 5

  function_response_types = ["ReportBatchItemFailures"]
}

# Lambda alias (for Blue/Green deployments)
resource "aws_lambda_alias" "live" {
  name             = "live"
  function_name    = aws_lambda_function.order_processor.function_name
  function_version = aws_lambda_function.order_processor.version

  routing_config {
    additional_version_weights = {
      # Canary deploy: send 10% of traffic to the new version
      (aws_lambda_function.order_processor.version) = 0.1
    }
  }
}
```

---

## 9. Concurrency and Scaling

### 9.1 Understanding Concurrency

```
Concurrency calculation:
  Concurrency = Requests per second × Average execution time (seconds)

Examples:
  100 req/s × 0.2 s = 20 concurrent executions
  1,000 req/s × 0.5 s = 500 concurrent executions
```

### 9.2 Reserved Concurrency and Provisioned Concurrency

```
┌──────────────────────────────────────────────────────────┐
│  Region limit: 1,000 concurrent executions (default)     │
│                                                          │
│  ┌─────────────────────┐ Reserved Concurrency: 200       │
│  │ Function A (API)    │ → Guarantees up to 200 concurrent│
│  │ Provisioned: 50     │ → 50 always warm                │
│  └─────────────────────┘                                 │
│                                                          │
│  ┌─────────────────────┐ Reserved Concurrency: 100       │
│  │ Function B (Batch)  │ → Guarantees up to 100 concurrent│
│  └─────────────────────┘                                 │
│                                                          │
│  ┌─────────────────────┐ Reserved Concurrency: None      │
│  │ Function C (Other)  │ → Shares remaining 700 with others│
│  └─────────────────────┘                                 │
│                                                          │
│  Unreserved = 1,000 - 200 - 100 = 700                   │
│  * AWS reserves 100 (minimum guaranteed for unreserved)  │
└──────────────────────────────────────────────────────────┘
```

```bash
# Set Reserved Concurrency
aws lambda put-function-concurrency \
  --function-name my-api-function \
  --reserved-concurrent-executions 200

# Set Provisioned Concurrency (specify alias or version)
aws lambda put-provisioned-concurrency-config \
  --function-name my-api-function \
  --qualifier prod \
  --provisioned-concurrent-executions 50

# Check Provisioned Concurrency status
aws lambda get-provisioned-concurrency-config \
  --function-name my-api-function \
  --qualifier prod

# Auto-adjust Provisioned Concurrency with Application Auto Scaling
aws application-autoscaling register-scalable-target \
  --service-namespace lambda \
  --resource-id "function:my-api-function:prod" \
  --scalable-dimension "lambda:function:ProvisionedConcurrency" \
  --min-capacity 10 \
  --max-capacity 100

aws application-autoscaling put-scaling-policy \
  --service-namespace lambda \
  --resource-id "function:my-api-function:prod" \
  --scalable-dimension "lambda:function:ProvisionedConcurrency" \
  --policy-name "target-tracking" \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 0.7,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "LambdaProvisionedConcurrencyUtilization"
    }
  }'
```

---

## 10. Monitoring and Logging

### 10.1 CloudWatch Metrics

| Metric | Description | Unit |
|--------|-------------|------|
| Invocations | Number of function invocations | Count |
| Duration | Execution time | Milliseconds |
| Errors | Number of errors (handler exceptions) | Count |
| Throttles | Number of throttled invocations | Count |
| ConcurrentExecutions | Number of concurrent executions | Count |
| IteratorAge | Lag for stream-based sources | Milliseconds |
| DeadLetterErrors | Number of DLQ send failures | Count |

### 10.2 Configuring CloudWatch Alarms

```bash
# Error rate alarm (error rate > 5%)
aws cloudwatch put-metric-alarm \
  --alarm-name "lambda-error-rate-high" \
  --alarm-description "Lambda error rate exceeds 5%" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=FunctionName,Value=my-api-function \
  --alarm-actions arn:aws:sns:ap-northeast-1:123456789012:alerts

# Throttle alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "lambda-throttle-alarm" \
  --metric-name Throttles \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 60 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --evaluation-periods 1 \
  --dimensions Name=FunctionName,Value=my-api-function \
  --alarm-actions arn:aws:sns:ap-northeast-1:123456789012:alerts

# Duration P99 alarm (P99 latency > 5 seconds)
aws cloudwatch put-metric-alarm \
  --alarm-name "lambda-duration-p99-high" \
  --metric-name Duration \
  --namespace AWS/Lambda \
  --extended-statistic p99 \
  --period 300 \
  --threshold 5000 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 3 \
  --dimensions Name=FunctionName,Value=my-api-function \
  --alarm-actions arn:aws:sns:ap-northeast-1:123456789012:alerts
```

### 10.3 Structured Logging

```python
# Structured logging (JSON) implementation
import json
import logging
import os
import time

class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "function_name": os.environ.get("AWS_LAMBDA_FUNCTION_NAME"),
            "function_version": os.environ.get("AWS_LAMBDA_FUNCTION_VERSION"),
            "request_id": getattr(record, "request_id", None),
        }
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry, ensure_ascii=False)

# Configure logger
logger = logging.getLogger()
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))
handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logger.handlers = [handler]

def lambda_handler(event, context):
    # Automatically attach request_id to logs
    extra = {"request_id": context.aws_request_id}

    logger.info("Processing request", extra=extra)
    start = time.time()

    try:
        result = process(event)
        duration = (time.time() - start) * 1000
        logger.info(
            f"Request completed in {duration:.1f}ms",
            extra={**extra, "duration_ms": duration}
        )
        return result
    except Exception as e:
        logger.error(f"Request failed: {e}", extra=extra, exc_info=True)
        raise
```

### 10.4 X-Ray Tracing

```bash
# Enable X-Ray tracing
aws lambda update-function-configuration \
  --function-name my-api-function \
  --tracing-config Mode=Active
```

```python
# Manual tracing with X-Ray SDK
from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.core import patch_all
import boto3

# Auto-instrument AWS SDK
patch_all()

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("Orders")

def lambda_handler(event, context):
    # Custom subsegment
    with xray_recorder.in_subsegment("validate_input") as subsegment:
        subsegment.put_annotation("order_id", event.get("orderId"))
        subsegment.put_metadata("event", event)
        validated = validate(event)

    with xray_recorder.in_subsegment("save_order"):
        table.put_item(Item=validated)

    return {"statusCode": 200}
```

---

## 11. Anti-Patterns

### 11.1 Monolithic Lambda

```
[Bad example] Packing all functionality into one Lambda function

def lambda_handler(event, context):
    path = event["path"]
    if path == "/users":
        return handle_users(event)
    elif path == "/orders":
        return handle_orders(event)
    elif path == "/products":
        return handle_products(event)
    elif path == "/payments":
        return handle_payments(event)
    # ... dozens of routes
```

**Problems**: The deployment package grows huge, making cold starts slower. A single change affects all functionality, and testing becomes difficult.

**Fix**: Create individual Lambda functions per feature and use API Gateway routing to dispatch requests.

### 11.2 Synchronous Waiting Inside Lambda

```python
# [Bad example] Long synchronous wait inside Lambda
import time

def lambda_handler(event, context):
    # Start an external job and poll until complete
    job_id = start_external_job()
    while True:
        status = check_job_status(job_id)
        if status == "COMPLETE":
            break
        time.sleep(10)  # Poll every 10 seconds -- wastes execution time
    return get_job_result(job_id)
```

**Problems**: Longer execution time increases costs. The risk of timeout also rises.

**Fix**: Use Step Functions to define a state machine, or use a callback pattern.

### 11.3 Not Initializing SDK Clients in Global Scope

```python
# [Bad example] Create SDK client on every handler invocation
def lambda_handler(event, context):
    import boto3
    dynamodb = boto3.resource("dynamodb")  # Re-initialized every time → slow
    table = dynamodb.Table("MyTable")
    return table.get_item(Key={"PK": event["id"]})
```

```python
# [Good example] Initialize SDK client in global scope
import boto3

dynamodb = boto3.resource("dynamodb")  # Skipped on warm starts
table = dynamodb.Table("MyTable")

def lambda_handler(event, context):
    return table.get_item(Key={"PK": event["id"]})
```

### 11.4 Not Cleaning Up /tmp Storage

```python
# [Bad example] Continuously accumulating files in /tmp
def lambda_handler(event, context):
    file_path = f"/tmp/{event['fileId']}.json"
    with open(file_path, "w") as f:
        json.dump(event["data"], f)
    # No cleanup → disk fills up when execution environment is reused
```

```python
# [Good example] Clean up /tmp after processing
import os
import tempfile

def lambda_handler(event, context):
    # Use tempfile for automatic cleanup
    with tempfile.NamedTemporaryFile(dir="/tmp", suffix=".json", delete=True) as f:
        f.write(json.dumps(event["data"]).encode())
        f.flush()
        # ... process using f.name
    # Automatically deleted when exiting the with block
```

### 11.5 Direct Lambda-to-Lambda Invocation

```
[Bad example] Lambda synchronously calls another Lambda
  Lambda A → Lambda B → Lambda C

  Problems:
  - Lambda A is billed for the execution time of B and C as well
  - All three functions consume concurrent execution capacity
  - Retries on error become complex

[Good example] Use asynchronous coupling
  Option 1: Loose coupling via SQS / SNS
    Lambda A → SQS → Lambda B → SNS → Lambda C

  Option 2: Orchestration with Step Functions
    Step Functions → Lambda A → Lambda B → Lambda C
    (Manages success/failure of each step; retries and branching are easy)

  Option 3: Event-driven with EventBridge
    Lambda A → EventBridge → Lambda B, Lambda C (in parallel)
```

---

## 12. FAQ

### Q1. What is a Lambda cold start?

When a Lambda function is invoked for the first time, or after an execution environment has been recycled, a new execution environment must be initialized. This initialization time is called a "cold start." It can take a few hundred milliseconds for Python/Node.js and a few seconds for Java/.NET. Mitigation strategies include using Provisioned Concurrency and reducing the deployment package size.

```
Cold start time reference:

Runtime          Without VPC     With VPC
Python 3.12      200-500 ms      200-500 ms (Hyperplane ENI)
Node.js 20.x     200-400 ms      200-400 ms
Java 21          2-8 s           2-8 s
Java 21+Snap     200-500 ms      N/A (VPC not supported)
.NET 8           1-3 s           1-3 s
Go               < 100 ms        < 100 ms

* ENI creation for VPC Lambda has been accelerated by Hyperplane since 2019
```

### Q2. Is there a limit on Lambda function concurrency?

By default, a soft limit of 1,000 concurrent executions per region is set. You can request an increase via Service Quotas. You can also set `ReservedConcurrentExecutions` per function to prevent a specific function from consuming capacity needed by other functions.

```bash
# Check current concurrency limit
aws lambda get-account-settings \
  --query '{ConcurrentExecutions: AccountLimit.ConcurrentExecutions, UnreservedConcurrentExecutions: AccountLimit.UnreservedConcurrentExecutions}'

# Request a limit increase via Service Quotas
aws service-quotas request-service-quota-increase \
  --service-code lambda \
  --quota-code L-B99A9384 \
  --desired-value 5000
```

### Q3. How should database connections be managed in Lambda?

When using RDS, it is recommended to use RDS Proxy for connection pooling. The basic pattern is to initialize the connection outside the handler (in global scope) and reuse it across execution environment reuses. HTTP-based services like DynamoDB do not have connection management issues.

### Q4. How do I debug Lambda functions?

The following approaches are available for local debugging.

```bash
# 1. Local execution with SAM CLI
sam local invoke MyFunction --event event.json --debug-port 5678

# 2. Local execution with Docker container
docker run --rm -v $(pwd)/src:/var/task \
  -e AWS_REGION=ap-northeast-1 \
  public.ecr.aws/lambda/python:3.12 \
  lambda_function.lambda_handler

# 3. Unit tests with pytest
# tests/test_handler.py
def test_lambda_handler():
    event = {"queryStringParameters": {"name": "Test"}}
    context = MockContext()  # Mock object with aws_request_id, etc.
    response = lambda_handler(event, context)
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["message"] == "Hello, Test!"
```

### Q5. How can I optimize Lambda costs?

(1) Use the **AWS Lambda Power Tuning** tool to find the optimal balance between memory and cost. Increasing memory also increases CPU, which can reduce execution time and lower the total cost. (2) Choosing the **Graviton2 (arm64)** architecture can be up to 34% cheaper and up to 20% faster than x86. (3) Reduce unnecessary Provisioned Concurrency. (4) Set the log level to WARN or higher in production to reduce CloudWatch Logs costs.

```bash
# Create function with arm64 (Graviton2)
aws lambda create-function \
  --function-name my-arm-function \
  --runtime python3.12 \
  --architectures arm64 \
  --handler app.lambda_handler \
  --role arn:aws:iam::123456789012:role/lambda-role \
  --zip-file fileb://function.zip
```

---


## FAQ

### Q1: What is the most important point to keep in mind when learning this topic?

Gaining hands-on experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how it behaves.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping straight to advanced topics. We recommend solidly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world work?

Knowledge of this topic is frequently applied in day-to-day development tasks, and becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|-----------|
| What is Lambda | Event-driven computing with no server management |
| Runtimes | Python, Node.js, Java, Go, .NET, Ruby, custom |
| Triggers | Synchronous (API Gateway), asynchronous (S3, SNS), polling (SQS, Kinesis) |
| IAM roles | Trust policy + least-privilege permission policy |
| Environment variables | Externalize configuration; KMS encryption supported |
| Layers | Reuse shared libraries; up to 5 layers can be attached |
| VPC | Required for accessing private resources like RDS; RDS Proxy recommended |
| Concurrency | Controlled via Reserved / Provisioned; auto-adjusted with Auto Scaling |
| Monitoring | CloudWatch Logs + Metrics + Alarms + X-Ray |
| Billing | Requests + duration (GB-seconds); up to 34% reduction with arm64 |

---

## What to Read Next

- [Lambda Advanced](./01-lambda-advanced.md) -- Cold start optimization, Provisioned Concurrency, Step Functions
- [Serverless Patterns](./02-serverless-patterns.md) -- API + Lambda + DynamoDB, event-driven architecture
- [IAM Deep Dive](../08-security/00-iam-deep-dive.md) -- Advanced design of Lambda execution roles

---

## References

1. AWS Official Documentation "AWS Lambda Developer Guide" https://docs.aws.amazon.com/lambda/latest/dg/
2. AWS Well-Architected Framework "Serverless Applications Lens" https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/
3. Jeremy Daly "Serverless Architectures on AWS, 2nd Edition" Manning Publications, 2024
4. AWS Blog "Operating Lambda: Performance optimization" https://aws.amazon.com/blogs/compute/operating-lambda-performance-optimization-part-1/
5. AWS Lambda Powertools for Python https://docs.powertools.aws.dev/lambda/python/latest/
6. AWS SAM CLI Documentation https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli.html

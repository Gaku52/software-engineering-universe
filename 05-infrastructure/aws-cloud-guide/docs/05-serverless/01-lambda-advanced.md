# AWS Lambda Advanced

> Understand cold start optimization, Provisioned Concurrency, Lambda Destinations, and Step Functions integration to build production-quality serverless applications.

---

## What You Will Learn

1. **Root causes and optimization techniques for cold starts** -- Understand the mechanism behind cold starts and address them practically through runtime selection and package size reduction
2. **Provisioned Concurrency and concurrency control** -- Learn how to pre-initialize execution environments for workloads with strict latency requirements
3. **Lambda Destinations and Step Functions** -- Design error handling through result routing and orchestration for asynchronous processing
4. **Lambda Layers and custom runtimes** -- Learn how to efficiently manage shared libraries and build custom runtimes
5. **Lambda monitoring and debugging** -- Use X-Ray, CloudWatch Logs Insights, and Lambda Insights to quickly identify issues in production
6. **Lambda security best practices** -- Apply the principle of least privilege, VPC design, and secrets management in practice


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [AWS Lambda Basics](./00-lambda-basics.md)

---

## 1. Cold Starts in Depth

### 1.1 Cold Start Lifecycle

```
Request arrives
    |
    v
+-----------------------------+
| Is an execution env available? |
+-----------------------------+
    |             |
  Yes (Warm)   No (Cold)
    |             |
    |             v
    |    +------------------------+
    |    | 1. Acquire MicroVM    |  <-- AWS managed (hundreds of ms)
    |    | 2. Initialize runtime |  <-- Runtime-dependent
    |    | 3. Download/extract   |  <-- Size-dependent
    |    |    deployment package |
    |    | 4. Run Init code      |  <-- User code
    |    |    (outside handler)  |
    |    +------------------------+
    |             |
    v             v
+-----------------------------+
| 5. Execute handler function |  <-- Normal execution
+-----------------------------+
    |
    v
+-----------------------------+
| 6. Keep execution env in    |
|    Warm state for a period  |
|    (~5-15 minutes)          |
+-----------------------------+
```

### 1.2 Estimated Cold Start Times by Runtime

| Runtime | Cold Start (128MB) | Cold Start (1024MB) | Notes |
|-----------|------------------------|--------------------------|------|
| Python 3.12 | 200-400 ms | 150-300 ms | Lightweight, fast startup |
| Node.js 20.x | 200-400 ms | 150-250 ms | Lightweight, fast startup |
| Go (AL2023) | 50-150 ms | 30-100 ms | Compiled binary |
| Java 21 | 2,000-5,000 ms | 800-2,000 ms | Heavy JVM startup |
| .NET 8 | 800-2,000 ms | 400-1,000 ms | Greatly improved with AOT |
| Ruby 3.3 | 300-600 ms | 200-400 ms | Interpreter startup |
| Rust (AL2023) | 30-100 ms | 20-80 ms | Native binary like Go |

### 1.3 Cold Start Optimization Techniques

```python
# [Optimization] Initialize outside the handler to reuse on Warm starts
import boto3
import os

# --- Init Phase (runs only on cold start) ---
TABLE_NAME = os.environ["TABLE_NAME"]
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)
# ------------------------------------------------

def lambda_handler(event, context):
    """Handler runs on every invocation, including Warm starts"""
    user_id = event["pathParameters"]["userId"]

    response = table.get_item(Key={"userId": user_id})
    return {
        "statusCode": 200,
        "body": json.dumps(response.get("Item", {}))
    }
```

```python
# [Optimization] Use lazy imports to avoid initializing unnecessary modules
import json
import os

def lambda_handler(event, context):
    action = event.get("action")

    if action == "generate_pdf":
        # Import heavy library only when PDF generation is needed
        from reportlab.pdfgen import canvas
        return generate_pdf(event)
    elif action == "send_email":
        import boto3
        ses = boto3.client("ses")
        return send_email(ses, event)
    else:
        return {"statusCode": 400, "body": "Unknown action"}
```

```python
# [Optimization] Connection pool reuse pattern
import boto3
import os
from botocore.config import Config

# Init Phase: Optimize SDK client configuration
config = Config(
    retries={"max_attempts": 3, "mode": "adaptive"},
    max_pool_connections=10,
    connect_timeout=5,
    read_timeout=10,
)

# Create each AWS service client in the Init Phase
dynamodb_client = boto3.client("dynamodb", config=config)
s3_client = boto3.client("s3", config=config)
sqs_client = boto3.client("sqs", config=config)

BUCKET_NAME = os.environ["BUCKET_NAME"]
QUEUE_URL = os.environ["QUEUE_URL"]

def lambda_handler(event, context):
    """All clients are reused on Warm starts"""
    # Fetch data from DynamoDB
    item = dynamodb_client.get_item(
        TableName="my-table",
        Key={"pk": {"S": event["id"]}}
    )

    # Save report to S3
    s3_client.put_object(
        Bucket=BUCKET_NAME,
        Key=f"reports/{event['id']}.json",
        Body=json.dumps(item.get("Item", {})),
        ContentType="application/json"
    )

    # Send notification to SQS
    sqs_client.send_message(
        QueueUrl=QUEUE_URL,
        MessageBody=json.dumps({"status": "completed", "id": event["id"]})
    )

    return {"statusCode": 200, "body": "Processing complete"}
```

### 1.4 Reducing Deployment Package Size

```
Package size vs. cold start impact:

Size          Cold start impact
  1 MB  -----  Minimal (+~50ms)
  5 MB  -----  Minor (+~100ms)
 10 MB  -----  Noticeable (+~200ms)
 50 MB  -----  Severe (+500ms or more)
250 MB  -----  Very severe (+1 second or more)

Countermeasures:
  - Exclude unnecessary dependencies (dev dependencies)
  - Exclude __pycache__, test files
  - Use lightweight alternative libraries
  - Separate shared parts into Lambda Layers
  - Use multi-stage builds for container images
```

```bash
# Example of creating a lightweight Python package
# 1. Install production dependencies only
pip install -r requirements.txt -t ./package --no-cache-dir

# 2. Remove unnecessary files
cd package
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
find . -type d -name "*.dist-info" -exec rm -rf {} + 2>/dev/null
find . -type f -name "*.pyc" -delete 2>/dev/null
find . -type d -name "tests" -exec rm -rf {} + 2>/dev/null

# 3. Create ZIP package
zip -r9 ../function.zip .
cd ..
zip -g function.zip lambda_function.py

# 4. Check size
ls -lh function.zip

# 5. Deploy
aws lambda update-function-code \
  --function-name my-function \
  --zip-file fileb://function.zip
```

```bash
# Example of creating a lightweight Node.js package
# 1. Install production dependencies only
npm ci --only=production

# 2. Bundle with esbuild (with tree-shaking)
npx esbuild src/handler.ts \
  --bundle \
  --minify \
  --sourcemap \
  --platform=node \
  --target=node20 \
  --outfile=dist/handler.js \
  --external:@aws-sdk/*

# 3. Create ZIP package
cd dist
zip -r9 ../function.zip .

# AWS SDK v3 is bundled with the Lambda runtime, so
# use --external:@aws-sdk/* to exclude it and reduce size
```

### 1.5 Memory and CPU Relationship

```
Proportional relationship between Lambda memory and CPU:

Memory    CPU Power        Network Bandwidth
 128 MB   Minimum (partial)  Low
 256 MB   Low                Low
 512 MB   Medium             Medium
1024 MB   Medium-High        Medium
1769 MB   ~1 vCPU            High
3538 MB   ~2 vCPUs           High
 10 GB    ~6 vCPUs           Maximum

Key points:
  - 1,769 MB allocates exactly 1 full vCPU
  - CPU-bound tasks can be sped up by increasing memory
  - Increasing memory also shortens cold start times
  - Cost = execution time x memory, so
    doubling memory and halving execution time yields same cost at higher speed
```

```python
# Script to auto-benchmark memory sizes
import boto3
import json
import time
import statistics

lambda_client = boto3.client("lambda")

def benchmark_memory_sizes(function_name, payload, memory_sizes, iterations=10):
    """Compare execution times across different memory sizes"""
    results = {}

    for memory_size in memory_sizes:
        # Update memory size
        lambda_client.update_function_configuration(
            FunctionName=function_name,
            MemorySize=memory_size
        )
        time.sleep(5)  # Wait for configuration to take effect

        durations = []
        for i in range(iterations):
            response = lambda_client.invoke(
                FunctionName=function_name,
                Payload=json.dumps(payload)
            )
            # Get execution time from response headers
            log_result = response.get("LogResult", "")
            # Parse Duration
            duration = float(response["ResponseMetadata"]["HTTPHeaders"]
                           .get("x-amz-log-result", "0"))
            durations.append(duration)

        results[memory_size] = {
            "avg_duration_ms": statistics.mean(durations),
            "p99_duration_ms": sorted(durations)[int(len(durations) * 0.99)],
            "cost_per_invocation": (memory_size / 1024) * (statistics.mean(durations) / 1000) * 0.0000166667,
        }

    return results
```

---

## 2. Provisioned Concurrency

### 2.1 How It Works and Configuration

Provisioned Concurrency pre-initializes a specified number of execution environments. It completely eliminates cold starts and delivers consistent latency.

```
Standard Lambda:
Request --> [Cold start?] --> Handler execution
                ↑
          Occurs if no env is available

Provisioned Concurrency:
                    +----- Pre-initialized env 1
                    |
Request ---------> +----- Pre-initialized env 2  --> Handler execution
                    |                               (no cold start)
                    +----- Pre-initialized env 3
                    |
                    +----- Pre-initialized env N

* Requests beyond the provisioned count are handled on-demand
```

```bash
# Configure Provisioned Concurrency
# First specify an alias or version
aws lambda publish-version \
  --function-name my-api-function

aws lambda put-provisioned-concurrency-config \
  --function-name my-api-function \
  --qualifier 1 \
  --provisioned-concurrent-executions 50

# Check status
aws lambda get-provisioned-concurrency-config \
  --function-name my-api-function \
  --qualifier 1

# List configurations
aws lambda list-provisioned-concurrency-configs \
  --function-name my-api-function

# Delete Provisioned Concurrency
aws lambda delete-provisioned-concurrency-config \
  --function-name my-api-function \
  --qualifier 1
```

### 2.2 Integration with Application Auto Scaling

```bash
# Register Auto Scaling target
aws application-autoscaling register-scalable-target \
  --service-namespace lambda \
  --resource-id "function:my-api-function:prod" \
  --scalable-dimension "lambda:function:ProvisionedConcurrency" \
  --min-capacity 10 \
  --max-capacity 200

# Target tracking scaling policy
aws application-autoscaling put-scaling-policy \
  --service-namespace lambda \
  --resource-id "function:my-api-function:prod" \
  --scalable-dimension "lambda:function:ProvisionedConcurrency" \
  --policy-name "provisioned-concurrency-target-tracking" \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 0.7,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "LambdaProvisionedConcurrencyUtilization"
    },
    "ScaleInCooldown": 300,
    "ScaleOutCooldown": 60
  }'

# Schedule-based scaling (morning scale-up)
aws application-autoscaling put-scheduled-action \
  --service-namespace lambda \
  --resource-id "function:my-api-function:prod" \
  --scalable-dimension "lambda:function:ProvisionedConcurrency" \
  --scheduled-action-name "morning-scale-up" \
  --schedule "cron(0 8 * * ? *)" \
  --scalable-target-action "MinCapacity=100,MaxCapacity=500"

# Nightly scale-down
aws application-autoscaling put-scheduled-action \
  --service-namespace lambda \
  --resource-id "function:my-api-function:prod" \
  --scalable-dimension "lambda:function:ProvisionedConcurrency" \
  --scheduled-action-name "night-scale-down" \
  --schedule "cron(0 22 * * ? *)" \
  --scalable-target-action "MinCapacity=10,MaxCapacity=50"
```

### 2.3 Cost Comparison

| Item | On-demand | Provisioned Concurrency |
|------|------------|------------------------|
| Cold starts | Yes | No |
| Billing starts | At request time | Continuously from configuration |
| Request charge | $0.20/1M requests | $0.20/1M requests |
| Duration charge (x86) | $0.0000166667/GB-sec | $0.0000097222/GB-sec (active) + $0.0000041667/GB-sec (idle) |
| Best for | Irregular/burst traffic | Steady traffic/low latency |

```
Provisioned Concurrency cost estimate example:

Scenario: API backend
  - Memory: 1 GB
  - Average execution time: 200 ms
  - Requests: 1M/month
  - Provisioned count: 50

On-demand cost:
  Request charge: 1M x $0.20/1M = $0.20
  Duration charge: 1M x 0.2s x 1GB x $0.0000166667 = $3.33
  Total: $3.53/month

Provisioned Concurrency cost:
  Request charge: $0.20
  Duration charge: 1M x 0.2s x 1GB x $0.0000097222 = $1.94
  Idle charge: 50 x 30 days x 24h x 3600s x 1GB x $0.0000041667 = $540.00
  Total: $542.14/month

→ Provisioned is more expensive but delivers consistent latency with no cold starts
→ Cost can be optimized by using Auto Scaling to match traffic patterns
→ Rather than keeping 50 provisioned 24/7, setting a high value only during peak hours is more practical
```

### 2.4 Combining with Reserved Concurrency

```
Concurrency control hierarchy:

Account-wide concurrency limit: 1,000 (default)
    |
    +-- Function A: Reserved Concurrency = 200
    |       |
    |       +-- Provisioned: 50 (50 of 200 pre-initialized)
    |       +-- On-demand: up to remaining 150 available
    |
    +-- Function B: Reserved Concurrency = 100
    |       |
    |       +-- All on-demand
    |
    +-- Other functions: share remaining 700 (Unreserved)

Reserved Concurrency configuration:
  - Sets the "maximum" concurrent executions for a function
  - No additional cost
  - Protects specific functions from throttling by other functions
  - Can be used together with Provisioned
```

```bash
# Configure Reserved Concurrency
aws lambda put-function-concurrency \
  --function-name my-api-function \
  --reserved-concurrent-executions 200

# Check Reserved Concurrency
aws lambda get-function-concurrency \
  --function-name my-api-function

# Delete Reserved Concurrency (returns to account pool)
aws lambda delete-function-concurrency \
  --function-name my-api-function
```

---

## 3. Lambda Destinations

### 3.1 Result Routing for Asynchronous Invocations

```
Asynchronous invocation
    |
    v
+------------------+
| Lambda execution |
+------------------+
    |           |
  Success     Failure
    |           |
    v           v
+---------+ +---------+
| OnSuccess| | OnFailure|
| Dest.    | | Dest.    |
+---------+ +---------+
    |           |
    v           v
  SQS         SQS
  SNS         SNS
  Lambda      Lambda
  EventBridge EventBridge
```

```bash
# Configure Destinations
aws lambda put-function-event-invoke-config \
  --function-name my-async-function \
  --maximum-retry-attempts 1 \
  --maximum-event-age-in-seconds 3600 \
  --destination-config '{
    "OnSuccess": {
      "Destination": "arn:aws:sqs:ap-northeast-1:123456789012:success-queue"
    },
    "OnFailure": {
      "Destination": "arn:aws:sqs:ap-northeast-1:123456789012:failure-queue"
    }
  }'

# Check configuration
aws lambda get-function-event-invoke-config \
  --function-name my-async-function

# Delete configuration
aws lambda delete-function-event-invoke-config \
  --function-name my-async-function
```

### 3.2 Destinations vs DLQ

| Feature | Lambda Destinations | Dead Letter Queue (DLQ) |
|------|-------------------|------------------------|
| Target events | Both success and failure | Failure only |
| Destinations | SQS, SNS, Lambda, EventBridge | SQS, SNS only |
| Payload | Includes full execution context | Original event only |
| Recommendation | Recommended for new development | Legacy compatibility |

### 3.3 Destinations Payload Structure

```json
{
  "version": "1.0",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestContext": {
    "requestId": "abc123-def456-ghi789",
    "functionArn": "arn:aws:lambda:ap-northeast-1:123456789012:function:my-function",
    "condition": "Success",
    "approximateInvokeCount": 1
  },
  "requestPayload": {
    "orderId": "ORD-001",
    "amount": 5000
  },
  "responseContext": {
    "statusCode": 200,
    "executedVersion": "$LATEST",
    "functionError": null
  },
  "responsePayload": {
    "statusCode": 200,
    "body": "{\"message\": \"Order processed successfully\"}"
  }
}
```

### 3.4 Event-Driven Pattern Using EventBridge

```python
# Pattern: Set Lambda Destination to EventBridge and
# branch subsequent processing using event rules

import json
import boto3

eventbridge = boto3.client("events")

def order_processor(event, context):
    """Order processing Lambda - sends to EventBridge on success"""
    order_id = event["orderId"]
    amount = event["amount"]

    # Order processing logic
    result = process_order(order_id, amount)

    return {
        "statusCode": 200,
        "orderId": order_id,
        "processedAmount": amount,
        "status": "COMPLETED"
    }

# Branching subsequent processing via EventBridge rules:
# Rule 1: amount > 10000 → High-value order notification Lambda
# Rule 2: All orders → Order history DynamoDB write Lambda
# Rule 3: status=COMPLETED → Shipping arrangement Step Functions
```

```yaml
# EventBridge rule (CloudFormation)
HighValueOrderRule:
  Type: AWS::Events::Rule
  Properties:
    Name: high-value-order-notification
    EventPattern:
      source:
        - "lambda"
      detail-type:
        - "Lambda Function Invocation Result - Success"
      detail:
        requestContext:
          functionArn:
            - !GetAtt OrderProcessorFunction.Arn
        responsePayload:
          processedAmount:
            - numeric: [">=", 10000]
    Targets:
      - Arn: !GetAtt HighValueNotificationFunction.Arn
        Id: HighValueNotification
```

---

## 4. AWS Step Functions Integration

### 4.1 Basic State Machine Structure

```
Step Functions State Machine:

[Start]
    |
    v
+-------------------+
| ValidateInput     |  (Lambda)
+-------------------+
    |
    v
+-------------------+
| ProcessOrder      |  (Lambda)
+-------------------+
    |        |
  Success  Failure
    |        |
    v        v
+--------+ +-------------------+
| Notify | | HandleError       |  (Lambda)
| Success| +-------------------+
+--------+      |
    |           v
    |    +-------------------+
    |    | Notify Failure    |
    |    +-------------------+
    |           |
    v           v
  [End]       [End]
```

### 4.2 State Machine Definition (ASL)

```json
{
  "Comment": "Order processing workflow",
  "StartAt": "ValidateInput",
  "States": {
    "ValidateInput": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:ap-northeast-1:123456789012:function:validate-input",
      "Next": "ProcessOrder",
      "Catch": [
        {
          "ErrorEquals": ["ValidationError"],
          "Next": "HandleError"
        }
      ]
    },
    "ProcessOrder": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:ap-northeast-1:123456789012:function:process-order",
      "TimeoutSeconds": 300,
      "Retry": [
        {
          "ErrorEquals": ["States.TaskFailed"],
          "IntervalSeconds": 5,
          "MaxAttempts": 3,
          "BackoffRate": 2.0
        }
      ],
      "Next": "NotifySuccess",
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "Next": "HandleError"
        }
      ]
    },
    "NotifySuccess": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:ap-northeast-1:123456789012:function:notify-success",
      "End": true
    },
    "HandleError": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:ap-northeast-1:123456789012:function:handle-error",
      "Next": "NotifyFailure"
    },
    "NotifyFailure": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:ap-northeast-1:123456789012:function:notify-failure",
      "End": true
    }
  }
}
```

### 4.3 Standard vs Express Workflows

| Property | Standard | Express |
|------|----------|---------|
| Maximum execution time | 1 year | 5 minutes |
| Execution start rate | 2,000/sec | 100,000/sec |
| State transition rate | 4,000/sec | Unlimited |
| Execution guarantee | Exactly once | At least once (Async) / Exactly once (Sync) |
| Billing | Per state transition | Per execution count + duration |
| Best for | Long-running workflows | High-volume short-lived tasks, IoT |

### 4.4 Parallel Execution in Step Functions

```json
{
  "Type": "Parallel",
  "Branches": [
    {
      "StartAt": "SendEmail",
      "States": {
        "SendEmail": {
          "Type": "Task",
          "Resource": "arn:aws:lambda:...:send-email",
          "End": true
        }
      }
    },
    {
      "StartAt": "SendSMS",
      "States": {
        "SendSMS": {
          "Type": "Task",
          "Resource": "arn:aws:lambda:...:send-sms",
          "End": true
        }
      }
    },
    {
      "StartAt": "UpdateDB",
      "States": {
        "UpdateDB": {
          "Type": "Task",
          "Resource": "arn:aws:lambda:...:update-db",
          "End": true
        }
      }
    }
  ],
  "Next": "AggregateResults"
}
```

### 4.5 Dynamic Parallel Processing with Map State

```json
{
  "Comment": "Parallel processing workflow for large datasets",
  "StartAt": "FetchItems",
  "States": {
    "FetchItems": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:fetch-items",
      "Next": "ProcessItems"
    },
    "ProcessItems": {
      "Type": "Map",
      "ItemsPath": "$.items",
      "MaxConcurrency": 10,
      "Iterator": {
        "StartAt": "ProcessSingleItem",
        "States": {
          "ProcessSingleItem": {
            "Type": "Task",
            "Resource": "arn:aws:lambda:...:process-item",
            "Retry": [
              {
                "ErrorEquals": ["States.TaskFailed"],
                "IntervalSeconds": 2,
                "MaxAttempts": 3,
                "BackoffRate": 2.0
              }
            ],
            "End": true
          }
        }
      },
      "Next": "AggregateResults"
    },
    "AggregateResults": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:aggregate-results",
      "End": true
    }
  }
}
```

### 4.6 Distributed Map (Large-Scale Parallel Processing)

```json
{
  "Comment": "Distributed parallel processing of large numbers of S3 files",
  "StartAt": "DistributedProcess",
  "States": {
    "DistributedProcess": {
      "Type": "Map",
      "ItemReader": {
        "Resource": "arn:aws:states:::s3:listObjectsV2",
        "Parameters": {
          "Bucket": "my-input-bucket",
          "Prefix": "data/"
        }
      },
      "ItemProcessor": {
        "ProcessorConfig": {
          "Mode": "DISTRIBUTED",
          "ExecutionType": "EXPRESS"
        },
        "StartAt": "ProcessFile",
        "States": {
          "ProcessFile": {
            "Type": "Task",
            "Resource": "arn:aws:lambda:...:process-file",
            "End": true
          }
        }
      },
      "MaxConcurrency": 1000,
      "Label": "DistributedProcess",
      "ResultWriter": {
        "Resource": "arn:aws:states:::s3:putObject",
        "Parameters": {
          "Bucket": "my-output-bucket",
          "Prefix": "results/"
        }
      },
      "End": true
    }
  }
}
```

### 4.7 Step Functions SDK Integration (Optimized Integration)

```json
{
  "Comment": "Direct service calls via AWS SDK integration",
  "StartAt": "PutItemToDynamoDB",
  "States": {
    "PutItemToDynamoDB": {
      "Type": "Task",
      "Resource": "arn:aws:states:::dynamodb:putItem",
      "Parameters": {
        "TableName": "Orders",
        "Item": {
          "orderId": {"S.$": "$.orderId"},
          "status": {"S": "PENDING"},
          "createdAt": {"S.$": "$$.State.EnteredTime"}
        }
      },
      "Next": "PublishToSNS"
    },
    "PublishToSNS": {
      "Type": "Task",
      "Resource": "arn:aws:states:::sns:publish",
      "Parameters": {
        "TopicArn": "arn:aws:sns:ap-northeast-1:123456789012:order-notifications",
        "Message.$": "States.Format('New order: {}', $.orderId)",
        "Subject": "New Order Received"
      },
      "Next": "StartECSTask"
    },
    "StartECSTask": {
      "Type": "Task",
      "Resource": "arn:aws:states:::ecs:runTask.sync",
      "Parameters": {
        "LaunchType": "FARGATE",
        "Cluster": "arn:aws:ecs:...:cluster/my-cluster",
        "TaskDefinition": "arn:aws:ecs:...:task-definition/process-order:1",
        "Overrides": {
          "ContainerOverrides": [
            {
              "Name": "processor",
              "Environment": [
                {"Name": "ORDER_ID", "Value.$": "$.orderId"}
              ]
            }
          ]
        },
        "NetworkConfiguration": {
          "AwsvpcConfiguration": {
            "Subnets": ["subnet-111", "subnet-222"],
            "SecurityGroups": ["sg-12345678"]
          }
        }
      },
      "End": true
    }
  }
}
```

---

## 5. Lambda SnapStart (Java)

### 5.1 How SnapStart Works

```
Traditional Java Lambda:
  Request --> JVM startup --> Class loading --> DI init --> Handler execution
                |<---- Cold start (2-5 seconds) ---->|

SnapStart:
  [Ahead-of-time] Create snapshot on version publish
         JVM startup --> Class loading --> DI init --> Save snapshot

  [At runtime] Request --> Restore from snapshot (< 200ms) --> Handler execution
```

```bash
# Enable SnapStart
aws lambda update-function-configuration \
  --function-name my-java-function \
  --snap-start '{"ApplyOn": "PublishedVersions"}'

# Publish version (creates snapshot)
aws lambda publish-version \
  --function-name my-java-function

# Check SnapStart status
aws lambda get-function-configuration \
  --function-name my-java-function \
  --query 'SnapStart'
```

### 5.2 SnapStart Considerations

```
Important notes when using SnapStart:

1. Uniqueness issue:
   Multiple execution environments are restored from the same snapshot,
   so random numbers and UUIDs generated in the Init Phase may be duplicated.

   [Mitigation]
   - Initialize java.util.Random inside the handler
   - Use the afterRestore hook to reset state

2. Network connection issue:
   DB connections established in the Init Phase become invalid after snapshot restore.

   [Mitigation]
   - Re-establish connections in the afterRestore hook
   - Re-initialize connection pooling libraries

3. Supported runtimes:
   - Java 11 and later (Corretto)
   - Both arm64 and x86_64 supported
```

```java
// Example of SnapStart afterRestore hook
import org.crac.Context;
import org.crac.Core;
import org.crac.Resource;

public class MyHandler implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent>,
                                   Resource {

    private Connection dbConnection;

    public MyHandler() {
        // Init Phase: Register as CRaC resource
        Core.getGlobalContext().register(this);
        // Establish DB connection
        this.dbConnection = DriverManager.getConnection(DB_URL);
    }

    @Override
    public void afterRestore(Context<? extends Resource> context) {
        // Called after snapshot restore
        // Re-establish DB connection
        this.dbConnection = DriverManager.getConnection(DB_URL);
        // Re-seed random number generator
        SecureRandom.getInstanceStrong();
    }

    @Override
    public APIGatewayProxyResponseEvent handleRequest(
            APIGatewayProxyRequestEvent event, com.amazonaws.services.lambda.runtime.Context context) {
        // Handler logic
        return new APIGatewayProxyResponseEvent().withStatusCode(200);
    }
}
```

---

## 6. Lambda Layers

### 6.1 Layer Concepts

```
How Lambda Layers work:

+------------------------------------------+
| Lambda function                           |
| +--------------------------------------+ |
| | /var/task (function code)            | |
| | +----------------------------------+ | |
| | | lambda_function.py               | | |
| | +----------------------------------+ | |
| +--------------------------------------+ |
| +--------------------------------------+ |
| | /opt (Layer 1 + 2 + ... + N)        | |
| | +----------------------------------+ | |
| | | /opt/python/shared libraries     | | |
| | | /opt/bin/custom binaries         | | |
| | | /opt/lib/shared libraries        | | |
| | +----------------------------------+ | |
| +--------------------------------------+ |
+------------------------------------------+

Benefits of layers:
  - Centralized management of shared libraries
  - Reduced deployment package size
  - Up to 5 layers can be stacked
  - Version-controlled per layer
```

### 6.2 Creating and Managing Layers

```bash
# Create a layer for Python libraries
mkdir -p python/lib/python3.12/site-packages
pip install requests boto3-stubs[s3,dynamodb] \
  -t python/lib/python3.12/site-packages

# Create ZIP package
zip -r9 my-layer.zip python/

# Publish the layer
aws lambda publish-layer-version \
  --layer-name my-common-libs \
  --description "Common libraries (requests, boto3-stubs)" \
  --compatible-runtimes python3.11 python3.12 \
  --compatible-architectures x86_64 arm64 \
  --zip-file fileb://my-layer.zip

# Attach layer to a function
aws lambda update-function-configuration \
  --function-name my-function \
  --layers \
    arn:aws:lambda:ap-northeast-1:123456789012:layer:my-common-libs:1 \
    arn:aws:lambda:ap-northeast-1:123456789012:layer:my-utilities:3

# List layer versions
aws lambda list-layer-versions \
  --layer-name my-common-libs

# Delete a layer version
aws lambda delete-layer-version \
  --layer-name my-common-libs \
  --version-number 1
```

### 6.3 Example: Shared Utility Layer Implementation

```python
# Utility module to include in a layer
# python/lib/python3.12/site-packages/common/response.py

import json
from typing import Any, Optional

def api_response(
    status_code: int,
    body: Any,
    headers: Optional[dict] = None
) -> dict:
    """Generate a standard response for API Gateway"""
    default_headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    }
    if headers:
        default_headers.update(headers)

    return {
        "statusCode": status_code,
        "headers": default_headers,
        "body": json.dumps(body, ensure_ascii=False, default=str),
    }

def error_response(
    status_code: int,
    message: str,
    error_code: Optional[str] = None
) -> dict:
    """Generate an error response"""
    body = {"error": {"message": message}}
    if error_code:
        body["error"]["code"] = error_code
    return api_response(status_code, body)
```

```python
# Logging module to include in a layer
# python/lib/python3.12/site-packages/common/logger.py

import json
import logging
import os
import sys
from datetime import datetime, timezone

class StructuredLogger:
    """Logger that outputs structured logs"""

    def __init__(self, service_name: str = None):
        self.service_name = service_name or os.environ.get("SERVICE_NAME", "unknown")
        self.logger = logging.getLogger(self.service_name)
        self.logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

        # Configure JSON formatter
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter("%(message)s"))
        self.logger.handlers = [handler]

    def _format(self, level: str, message: str, **kwargs) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": level,
            "service": self.service_name,
            "message": message,
            **kwargs
        }
        return json.dumps(log_entry, ensure_ascii=False, default=str)

    def info(self, message: str, **kwargs):
        self.logger.info(self._format("INFO", message, **kwargs))

    def error(self, message: str, **kwargs):
        self.logger.error(self._format("ERROR", message, **kwargs))

    def warning(self, message: str, **kwargs):
        self.logger.warning(self._format("WARNING", message, **kwargs))

    def debug(self, message: str, **kwargs):
        self.logger.debug(self._format("DEBUG", message, **kwargs))
```

---

## 7. Lambda Monitoring and Debugging

### 7.1 Log Analysis with CloudWatch Logs Insights

```
# Search for error logs
fields @timestamp, @message, @requestId
| filter @message like /ERROR/
| sort @timestamp desc
| limit 50

# Detect cold starts
filter @message like /Init Duration/
| parse @message "Init Duration: * ms" as initDuration
| stats count() as coldStarts,
        avg(initDuration) as avgInitMs,
        max(initDuration) as maxInitMs,
        pct(initDuration, 99) as p99InitMs
  by bin(1h)

# Analyze execution duration
filter @type = "REPORT"
| parse @message "Duration: * ms" as duration
| parse @message "Billed Duration: * ms" as billedDuration
| parse @message "Memory Size: * MB" as memorySize
| parse @message "Max Memory Used: * MB" as memoryUsed
| stats avg(duration) as avgDuration,
        max(duration) as maxDuration,
        pct(duration, 95) as p95Duration,
        pct(duration, 99) as p99Duration,
        avg(memoryUsed/memorySize * 100) as avgMemoryUtilization
  by bin(5m)

# Detect timeouts
filter @message like /Task timed out/
| parse @message "Task timed out after * seconds" as timeout
| stats count() by bin(1h)
```

### 7.2 Tracing with X-Ray

```bash
# Enable X-Ray tracing for a Lambda function
aws lambda update-function-configuration \
  --function-name my-function \
  --tracing-config Mode=Active

# Retrieve X-Ray traces
aws xray get-trace-summaries \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --filter-expression 'service("my-function")'
```

```python
# Detailed tracing with the X-Ray SDK
from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.core import patch_all

# Automatically trace all AWS SDK calls
patch_all()

@xray_recorder.capture("process_order")
def process_order(order_data):
    """Trace business logic with a custom subsegment"""

    # Add annotations (for filtering)
    subsegment = xray_recorder.current_subsegment()
    subsegment.put_annotation("order_id", order_data["orderId"])
    subsegment.put_annotation("customer_tier", order_data.get("tier", "standard"))

    # Add metadata (for debugging)
    subsegment.put_metadata("order_details", order_data, "order")

    # Business logic
    result = validate_order(order_data)
    return result

def lambda_handler(event, context):
    return process_order(event)
```

### 7.3 Lambda Insights

```bash
# Enable Lambda Insights (enhanced monitoring)
aws lambda update-function-configuration \
  --function-name my-function \
  --layers \
    "arn:aws:lambda:ap-northeast-1:580247275435:layer:LambdaInsightsExtension:38"

# Metrics collected by Lambda Insights:
#   - cpu_total_time: CPU time used
#   - memory_utilization: Memory usage rate
#   - rx_bytes / tx_bytes: Network I/O
#   - init_duration: Init Phase duration
#   - tmp_max: /tmp usage
```

### 7.4 Custom Metrics with EMF (Embedded Metric Format)

```python
# Output high-resolution custom metrics from Lambda
# using Embedded Metric Format (EMF)

import json
import time

def put_metric(namespace, metric_name, value, unit="None", dimensions=None):
    """Output CloudWatch custom metrics in EMF format"""
    emf_log = {
        "_aws": {
            "Timestamp": int(time.time() * 1000),
            "CloudWatchMetrics": [
                {
                    "Namespace": namespace,
                    "Dimensions": [list(dimensions.keys())] if dimensions else [[]],
                    "Metrics": [
                        {"Name": metric_name, "Unit": unit}
                    ]
                }
            ]
        },
        metric_name: value
    }
    if dimensions:
        emf_log.update(dimensions)

    # Simply printing to stdout records it as a CloudWatch metric
    print(json.dumps(emf_log))

def lambda_handler(event, context):
    start = time.time()

    # Business logic
    result = process_request(event)

    # Output custom metrics
    elapsed = (time.time() - start) * 1000
    put_metric(
        "MyApplication",
        "ProcessingTime",
        elapsed,
        "Milliseconds",
        {"Environment": "production", "Service": "order-api"}
    )
    put_metric(
        "MyApplication",
        "OrdersProcessed",
        1,
        "Count",
        {"Environment": "production", "Service": "order-api"}
    )

    return result
```

---

## 8. Lambda Security

### 8.1 Least-Privilege IAM Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDBAccess",
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
      "Sid": "S3ReadAccess",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::my-config-bucket/config/*"
    },
    {
      "Sid": "SecretsManagerAccess",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:my-api-key-*"
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

### 8.2 Secrets Manager / Parameter Store Integration

```python
# Retrieve secrets from Secrets Manager
# using the Lambda Extension cache approach

import json
import os
import urllib3

# Lambda Extensions cache port
SECRETS_EXTENSION_PORT = 2773
http = urllib3.PoolManager()

def get_secret(secret_name):
    """Retrieve a secret via the Secrets Manager Lambda Extension"""
    url = (
        f"http://localhost:{SECRETS_EXTENSION_PORT}"
        f"/secretsmanager/get?secretId={secret_name}"
    )
    headers = {
        "X-Aws-Parameters-Secrets-Token": os.environ["AWS_SESSION_TOKEN"]
    }
    response = http.request("GET", url, headers=headers)
    return json.loads(response.data)["SecretString"]

# Retrieve secrets in the Init Phase (they will be cached)
DB_CREDENTIALS = json.loads(get_secret("prod/db-credentials"))
API_KEY = get_secret("prod/external-api-key")

def lambda_handler(event, context):
    # Use secrets
    db_host = DB_CREDENTIALS["host"]
    db_password = DB_CREDENTIALS["password"]
    # ...
```

### 8.3 VPC Lambda Security Design

```
VPC Lambda network design:

+----------------------------------------------------------+
|  VPC (10.0.0.0/16)                                       |
|                                                          |
|  Private Subnet A              Private Subnet B           |
|  +------------------------+   +------------------------+ |
|  | Lambda ENI             |   | Lambda ENI             | |
|  | (auto-created)         |   | (auto-created)         | |
|  +------------------------+   +------------------------+ |
|       |                            |                      |
|       v                            v                      |
|  +---------------------------------------------------+   |
|  | Security Group (Lambda-SG)                        |   |
|  | Outbound: Only required ports                     |   |
|  +---------------------------------------------------+   |
|       |                                                   |
|       +---> RDS (DB-SG: allow port 3306 from Lambda-SG)  |
|       |                                                   |
|       +---> ElastiCache (Cache-SG: allow port 6379        |
|       |     from Lambda-SG)                               |
|       |                                                   |
|       +---> VPC Endpoint (DynamoDB, S3, SQS)             |
|       |     (No NAT Gateway needed)                       |
|       |                                                   |
|       +---> NAT Gateway --> IGW --> Internet              |
|             (Only when external API calls are needed)     |
+----------------------------------------------------------+
```

```bash
# Create security group for VPC Lambda
aws ec2 create-security-group \
  --group-name lambda-sg \
  --description "Security group for Lambda functions" \
  --vpc-id vpc-12345678

# Allow access to RDS (add to RDS security group)
aws ec2 authorize-security-group-ingress \
  --group-id sg-rds-12345678 \
  --protocol tcp \
  --port 3306 \
  --source-group sg-lambda-12345678

# Create VPC Endpoint (DynamoDB)
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-12345678 \
  --service-name com.amazonaws.ap-northeast-1.dynamodb \
  --route-table-ids rtb-12345678

# Create VPC Endpoint (S3)
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-12345678 \
  --service-name com.amazonaws.ap-northeast-1.s3 \
  --route-table-ids rtb-12345678

# Create VPC Endpoint (SQS - Interface type)
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-12345678 \
  --service-name com.amazonaws.ap-northeast-1.sqs \
  --vpc-endpoint-type Interface \
  --subnet-ids subnet-111 subnet-222 \
  --security-group-ids sg-vpce-12345678
```

---

## 9. Lambda Container Image Support

### 9.1 Deploying with Container Images

```dockerfile
# Example Dockerfile for a Lambda container image (Python)
FROM public.ecr.aws/lambda/python:3.12

# Install dependencies
COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install -r ${LAMBDA_TASK_ROOT}/requirements.txt --no-cache-dir

# Copy function code
COPY app/ ${LAMBDA_TASK_ROOT}/app/
COPY lambda_function.py ${LAMBDA_TASK_ROOT}/

# Specify handler
CMD ["lambda_function.lambda_handler"]
```

```bash
# Build and deploy container image
# 1. Create ECR repository
aws ecr create-repository \
  --repository-name my-lambda-function \
  --image-scanning-configuration scanOnPush=true

# 2. Build the image
docker build -t my-lambda-function:latest \
  --platform linux/amd64 .

# 3. Push to ECR
ECR_URI=123456789012.dkr.ecr.ap-northeast-1.amazonaws.com
aws ecr get-login-password | docker login --username AWS --password-stdin ${ECR_URI}
docker tag my-lambda-function:latest ${ECR_URI}/my-lambda-function:latest
docker push ${ECR_URI}/my-lambda-function:latest

# 4. Create Lambda function
aws lambda create-function \
  --function-name my-container-function \
  --package-type Image \
  --code ImageUri=${ECR_URI}/my-lambda-function:latest \
  --role arn:aws:iam::123456789012:role/lambda-execution-role \
  --memory-size 1024 \
  --timeout 30
```

### 9.2 Optimization with Multi-Stage Builds

```dockerfile
# Create a lightweight Lambda container with multi-stage build
FROM python:3.12-slim AS builder

WORKDIR /build
COPY requirements.txt .
RUN pip install --user -r requirements.txt --no-cache-dir

# Production stage
FROM public.ecr.aws/lambda/python:3.12

# Copy dependencies from build stage
COPY --from=builder /root/.local/lib/python3.12/site-packages ${LAMBDA_TASK_ROOT}/
COPY app/ ${LAMBDA_TASK_ROOT}/app/
COPY lambda_function.py ${LAMBDA_TASK_ROOT}/

CMD ["lambda_function.lambda_handler"]
```

---

## 10. Lambda Function URLs

### 10.1 Configuring Function URLs

```bash
# Create a function URL (no IAM auth)
aws lambda create-function-url-config \
  --function-name my-api-function \
  --auth-type NONE \
  --cors '{
    "AllowCredentials": false,
    "AllowHeaders": ["content-type", "authorization"],
    "AllowMethods": ["GET", "POST", "PUT", "DELETE"],
    "AllowOrigins": ["https://example.com"],
    "ExposeHeaders": ["x-request-id"],
    "MaxAge": 86400
  }'

# Add resource-based policy (public access)
aws lambda add-permission \
  --function-name my-api-function \
  --statement-id AllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE

# Retrieve the function URL
aws lambda get-function-url-config \
  --function-name my-api-function

# Function URL with IAM authentication
aws lambda create-function-url-config \
  --function-name my-internal-api \
  --auth-type AWS_IAM
```

### 10.2 API Gateway vs Function URLs

| Feature | API Gateway | Lambda Function URL |
|------|------------|----------------|
| Cost | Request + data transfer | Free (Lambda charges only) |
| Custom domain | Yes | Possible via CloudFront |
| Authentication | Cognito, API Key, Lambda authorizer | IAM or none |
| Rate limiting | Yes | No (Lambda concurrency limits only) |
| WAF integration | Yes | Possible via CloudFront |
| Caching | Yes | No |
| Request transformation | Yes | No |
| Best for | Full-featured APIs | Simple APIs, webhooks |

---

## 11. Anti-Patterns

### 11.1 Placing Lambda in a VPC Unnecessarily

```
[Bad]
Lambda --in VPC--> NAT Gateway --> Internet --> DynamoDB

[Good]
Lambda --outside VPC--> DynamoDB (no VPC Endpoint needed)

Lambda --in VPC--> RDS (only when VPC-internal resource access is needed)
         +-----> VPC Endpoint --> DynamoDB
```

**Problem**: Placing Lambda in a VPC adds ENI attachment time, increasing cold starts (improved but still some overhead). Internet access via NAT Gateway also incurs additional cost.

**Solution**: Only place Lambda in a VPC when access to VPC-internal resources like RDS or ElastiCache is truly required. Access DynamoDB and S3 via VPC Endpoints.

### 11.2 Over-provisioning Provisioned Concurrency

**Problem**: Setting Provisioned Concurrency to the maximum without analyzing traffic patterns wastes cost.

**Solution**: Analyze actual concurrency with CloudWatch metrics and use Application Auto Scaling to dynamically adjust based on traffic patterns.

### 11.3 Monolithic Lambda Functions

```
[Bad]
Cramming all API endpoint logic into a single Lambda function:
  /users GET, POST, PUT, DELETE
  /orders GET, POST, PUT, DELETE
  /products GET, POST, PUT, DELETE
  → Package grows large, deployments affect all APIs

[Good]
Separate functions by feature:
  user-get-function
  user-create-function
  order-process-function
  → Each function is lightweight, can be deployed and scaled independently

[Balanced approach]
Separate functions by resource:
  user-api-function (groups User CRUD together)
  order-api-function (groups Order CRUD together)
  → Prevents function count explosion while maintaining appropriate separation
```

### 11.4 Chaining Synchronous Invocations

```
[Bad]
API GW -> Lambda A -> Lambda B -> Lambda C
  Each call waits for timeout
  → Latency accumulates, error handling becomes complex

[Good]
API GW -> Lambda A -> SQS -> Lambda B -> SQS -> Lambda C
  Decoupled with asynchronous processing
  → Each function is independent, retries are individually controlled

[Using Step Functions]
API GW -> Step Functions
            -> Lambda A (Validate)
            -> Lambda B (Process)
            -> Lambda C (Notify)
  → Orchestration, error handling, and retries are managed uniformly
```

---

## 12. CloudFormation / CDK Templates

### 12.1 CloudFormation Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: 'Lambda advanced configuration template'

Parameters:
  EnvironmentName:
    Type: String
    Default: dev
    AllowedValues: [dev, stg, prod]

  ProvisionedConcurrency:
    Type: Number
    Default: 0
    Description: 'Number of Provisioned Concurrency instances (0=disabled)'

Conditions:
  EnableProvisionedConcurrency: !Not [!Equals [!Ref ProvisionedConcurrency, 0]]
  IsProduction: !Equals [!Ref EnvironmentName, prod]

Globals:
  Function:
    Runtime: python3.12
    MemorySize: 1024
    Timeout: 30
    Tracing: Active
    Environment:
      Variables:
        ENVIRONMENT: !Ref EnvironmentName
        TABLE_NAME: !Ref OrdersTable
        LOG_LEVEL: !If [IsProduction, INFO, DEBUG]

Resources:
  # Lambda function
  OrderApiFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub '${EnvironmentName}-order-api'
      Handler: app.lambda_handler
      CodeUri: src/order-api/
      AutoPublishAlias: live
      ProvisionedConcurrencyConfig:
        !If
        - EnableProvisionedConcurrency
        - ProvisionedConcurrentExecutions: !Ref ProvisionedConcurrency
        - !Ref AWS::NoValue
      DeploymentPreference:
        Type: !If [IsProduction, Linear10PercentEvery1Minute, AllAtOnce]
        Alarms:
          - !Ref OrderApiErrorAlarm
      Events:
        GetOrder:
          Type: Api
          Properties:
            Path: /orders/{orderId}
            Method: get
            RestApiId: !Ref ApiGateway
        CreateOrder:
          Type: Api
          Properties:
            Path: /orders
            Method: post
            RestApiId: !Ref ApiGateway
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref OrdersTable
        - SQSSendMessagePolicy:
            QueueName: !GetAtt OrderQueue.QueueName

  # Step Functions state machine
  OrderProcessingStateMachine:
    Type: AWS::StepFunctions::StateMachine
    Properties:
      StateMachineName: !Sub '${EnvironmentName}-order-processing'
      DefinitionString: !Sub |
        {
          "Comment": "Order processing workflow",
          "StartAt": "ValidateOrder",
          "States": {
            "ValidateOrder": {
              "Type": "Task",
              "Resource": "${ValidateOrderFunction.Arn}",
              "Next": "ProcessPayment",
              "Catch": [{"ErrorEquals": ["ValidationError"], "Next": "FailOrder"}]
            },
            "ProcessPayment": {
              "Type": "Task",
              "Resource": "${ProcessPaymentFunction.Arn}",
              "Retry": [{"ErrorEquals": ["States.TaskFailed"], "IntervalSeconds": 5, "MaxAttempts": 3, "BackoffRate": 2.0}],
              "Next": "NotifySuccess",
              "Catch": [{"ErrorEquals": ["States.ALL"], "Next": "FailOrder"}]
            },
            "NotifySuccess": {
              "Type": "Task",
              "Resource": "arn:aws:states:::sns:publish",
              "Parameters": {
                "TopicArn": "${OrderNotificationTopic}",
                "Message.$": "States.Format('Order {} processed successfully', $.orderId)"
              },
              "End": true
            },
            "FailOrder": {
              "Type": "Task",
              "Resource": "${FailOrderFunction.Arn}",
              "End": true
            }
          }
        }
      RoleArn: !GetAtt StepFunctionsRole.Arn

  # DynamoDB table
  OrdersTable:
    Type: AWS::DynamoDB::Table
    DeletionPolicy: Retain
    Properties:
      TableName: !Sub '${EnvironmentName}-orders'
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: orderId
          AttributeType: S
        - AttributeName: customerId
          AttributeType: S
      KeySchema:
        - AttributeName: orderId
          KeyType: HASH
      GlobalSecondaryIndexes:
        - IndexName: customer-index
          KeySchema:
            - AttributeName: customerId
              KeyType: HASH
          Projection:
            ProjectionType: ALL

  # CloudWatch alarm
  OrderApiErrorAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: !Sub '${EnvironmentName}-order-api-errors'
      MetricName: Errors
      Namespace: AWS/Lambda
      Statistic: Sum
      Period: 60
      EvaluationPeriods: 3
      Threshold: 5
      ComparisonOperator: GreaterThanOrEqualToThreshold
      Dimensions:
        - Name: FunctionName
          Value: !Ref OrderApiFunction
      AlarmActions:
        - !Ref AlertTopic

Outputs:
  ApiEndpoint:
    Description: API Gateway endpoint
    Value: !Sub 'https://${ApiGateway}.execute-api.${AWS::Region}.amazonaws.com/Prod'

  StateMachineArn:
    Description: Step Functions state machine ARN
    Value: !Ref OrderProcessingStateMachine
```

---

## 13. FAQ

### Q1. What is the difference between Provisioned Concurrency and Reserved Concurrency?

Reserved Concurrency sets the "maximum" concurrent executions for a function at no additional cost. It protects specific functions from being throttled by other functions. Provisioned Concurrency, on the other hand, "pre-initializes" a specified number of execution environments, eliminating cold starts at the cost of an additional charge.

### Q2. How much does Step Functions cost?

Standard workflows are billed per state transition at $0.025/1,000 transitions. With 5 transitions per execution and 1 million executions per month, the cost would be $125/month. Express workflows are billed by execution count plus memory and duration, making them more cost-effective for high-volume, short-lived processing.

### Q3. What happens when Lambda exceeds the maximum concurrent execution limit?

Throttling occurs. Synchronous invocations return an HTTP 429 error, while asynchronous invocations are placed in the event queue and retried for up to 6 hours. You can address this by requesting a quota increase via Service Quotas or by using Reserved Concurrency to guarantee capacity for critical functions.

### Q4. Should I use Lambda Layers or container images?

ZIP packages with layers are suitable for lightweight functions and offer the fastest startup times. Container images support sizes up to 10 GB and can leverage existing Docker workflows. Container images are better suited for ML models or large dependencies. For typical Web APIs and event processing, ZIP packages are recommended.

### Q5. What are Lambda Extensions?

Lambda Extensions are external processes integrated into the Lambda execution environment that can add monitoring, security, and governance capabilities. There are two types: internal extensions (same process) and external extensions (separate process). Notable examples include the Datadog Agent, New Relic Agent, and AWS Parameters and Secrets Lambda Extension.

### Q6. Should I choose Graviton (ARM) or x86?

Graviton (arm64) can achieve up to 34% cost savings compared to x86_64 (20% price difference plus performance gains). For runtimes like Python, Node.js, and Java, migrating to arm64 is typically possible without code changes. If your layers or dependencies include native binaries, verify arm64 compatibility first. For new functions, arm64 should be the first consideration.

---


## FAQ

### Q1: What is the most important point to keep in mind when learning this topic?

Gaining hands-on experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how it behaves.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping straight to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next steps.

### Q3: How is this knowledge used in real-world work?

Knowledge of this topic is frequently applied in day-to-day development tasks, especially during code reviews and architectural design.

---

## Summary

| Item | Key Points |
|------|---------|
| Cold starts | Mitigate with Init code optimization, package size reduction, and memory increases |
| Provisioned Concurrency | Pre-initialize execution environments to eliminate cold starts |
| Lambda Destinations | Flexibly route async execution results for both success and failure |
| Step Functions | Orchestrate multiple Lambdas with unified error handling and retry logic |
| SnapStart | Dramatically reduce Java cold starts via snapshot restore |
| Lambda Layers | Centralize shared library management and reduce deployment package size |
| Monitoring | Ensure observability with CloudWatch Logs Insights, X-Ray, and Lambda Insights |
| Security | Least-privilege IAM, Secrets Manager integration, and VPC design |
| Container images | Ideal for large dependencies or existing Docker workflows |
| Function URLs | Simple HTTP endpoints without API Gateway |
| VPC placement | Only when necessary; actively use VPC Endpoints |

---

## What to Read Next

- [Serverless Patterns](./02-serverless-patterns.md) -- Practical architecture patterns
- [CloudFormation](../07-devops/00-cloudformation.md) -- Codify Lambda infrastructure
- [Cost Optimization](../09-cost/00-cost-optimization.md) -- Managing Lambda costs

---

## References

1. AWS Official Documentation "Optimizing Lambda performance" https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html
2. AWS Official Documentation "AWS Step Functions Developer Guide" https://docs.aws.amazon.com/step-functions/latest/dg/
3. Yan Cui "Production-Ready Serverless" Manning Publications, 2019
4. AWS re:Invent 2023 "SVS404: Optimizing Lambda performance for your serverless applications"
5. AWS Official Documentation "Lambda Layers" https://docs.aws.amazon.com/lambda/latest/dg/chapter-layers.html
6. AWS Official Documentation "Lambda SnapStart" https://docs.aws.amazon.com/lambda/latest/dg/snapstart.html
7. AWS Official Documentation "Lambda Function URLs" https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html

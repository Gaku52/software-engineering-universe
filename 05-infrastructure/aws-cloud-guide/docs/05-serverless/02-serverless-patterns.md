# Serverless Patterns

> Understand representative serverless architecture patterns such as API+Lambda+DynamoDB, event-driven, fan-out, and CQRS, and be able to make practical design decisions.

---

## What You Will Learn

1. **API Backend Pattern** -- How to build RESTful/GraphQL APIs using API Gateway + Lambda + DynamoDB
2. **Event-Driven Pattern** -- How to design loosely coupled architectures using SNS/SQS/EventBridge
3. **Advanced Patterns** -- Handling complex use cases such as fan-out, CQRS, and Saga patterns
4. **Stream Processing Pattern** -- Real-time data processing with Kinesis Data Streams + Lambda
5. **Schedule-Driven Pattern** -- Designing periodic execution jobs with EventBridge Scheduler + Lambda
6. **Web Application Pattern** -- Full-stack serverless with CloudFront + S3 + API Gateway + Lambda


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of the content in [AWS Lambda Advanced](./01-lambda-advanced.md)

---

## 1. API Backend Pattern

### 1.1 Basic Configuration

```
Client
    |
    v
+-------------------+
| Amazon CloudFront |  (CDN, caching)
+-------------------+
    |
    v
+-------------------+
| API Gateway       |  (auth, throttling, request validation)
| (REST / HTTP API) |
+-------------------+
    |
    v
+-------------------+
| Lambda Functions  |
| +---------+       |
| | GET     |       |
| | POST    |       |
| | PUT     |       |
| | DELETE  |       |
| +---------+       |
+-------------------+
    |
    v
+-------------------+
| DynamoDB          |  (NoSQL data store)
+-------------------+
```

### 1.2 REST API + Lambda + DynamoDB Implementation

```python
# handler.py -- Entry point for CRUD API
import json
import boto3
import os
from decimal import Decimal

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["TABLE_NAME"])

class DecimalEncoder(json.JSONEncoder):
    """Helper to JSON-serialize DynamoDB Decimal types"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)

def lambda_handler(event, context):
    http_method = event["httpMethod"]
    path = event.get("pathParameters") or {}

    try:
        if http_method == "GET" and "id" in path:
            return get_item(path["id"])
        elif http_method == "GET":
            return list_items(event)
        elif http_method == "POST":
            return create_item(json.loads(event["body"]))
        elif http_method == "PUT" and "id" in path:
            return update_item(path["id"], json.loads(event["body"]))
        elif http_method == "DELETE" and "id" in path:
            return delete_item(path["id"])
        else:
            return response(404, {"error": "Not found"})
    except Exception as e:
        return response(500, {"error": str(e)})

def get_item(item_id):
    result = table.get_item(Key={"id": item_id})
    if "Item" in result:
        return response(200, result["Item"])
    return response(404, {"error": "Item not found"})

def list_items(event):
    params = event.get("queryStringParameters") or {}
    limit = int(params.get("limit", "20"))
    result = table.scan(Limit=limit)
    return response(200, {"items": result["Items"], "count": result["Count"]})

def create_item(body):
    import uuid
    body["id"] = str(uuid.uuid4())
    table.put_item(Item=body)
    return response(201, body)

def update_item(item_id, body):
    body["id"] = item_id
    table.put_item(Item=body)
    return response(200, body)

def delete_item(item_id):
    table.delete_item(Key={"id": item_id})
    return response(204, None)

def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps(body, cls=DecimalEncoder) if body else ""
    }
```

### 1.3 API Gateway Type Comparison

| Feature | REST API | HTTP API | WebSocket API |
|------|----------|----------|--------------|
| Price (per 1M requests) | $3.50 | $1.00 | $1.00 + connection fee |
| Latency | Higher | Lower | Lower |
| Caching | Yes | No | N/A |
| Request validation | Yes | No | Partial |
| WAF integration | Yes | No | No |
| Resource policy | Yes | No | No |
| Custom domain | Yes | Yes | Yes |
| JWT authorizer | Via Lambda | Native support | Via Lambda |
| Usage plans | Yes | No | No |
| API keys | Yes | No | No |
| Private API | Yes | No | No |
| Use case | Full-featured API | Lightweight API, proxy | Real-time communication |

### 1.4 REST API vs HTTP API Selection Criteria

```
When to choose REST API:
  - Rate limiting with API keys and usage plans is required
  - Request/response transformation is needed
  - WAF integration is required
  - API caching is needed to reduce latency
  - Private API from within a VPC is required
  - Canary release deployment is needed

When to choose HTTP API:
  - Cost optimization is the top priority (approx. 30% of REST API cost)
  - Native JWT authentication is desired
  - Only simple proxy integration is needed
  - OIDC/OAuth 2.0 authorization is required
  - Low latency is required
```

### 1.5 Definition with SAM Template

```yaml
# template.yaml (AWS SAM)
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Serverless CRUD API

Globals:
  Function:
    Runtime: python3.12
    Timeout: 30
    MemorySize: 256
    Environment:
      Variables:
        TABLE_NAME: !Ref ItemsTable
    Tracing: Active
    Layers:
      - !Ref SharedLayer

Resources:
  # Lambda Layer (shared libraries)
  SharedLayer:
    Type: AWS::Serverless::LayerVersion
    Properties:
      LayerName: shared-utils
      ContentUri: layers/shared/
      CompatibleRuntimes:
        - python3.12

  # API function
  ApiFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handler.lambda_handler
      CodeUri: src/
      Events:
        GetItem:
          Type: Api
          Properties:
            Path: /items/{id}
            Method: get
        ListItems:
          Type: Api
          Properties:
            Path: /items
            Method: get
        CreateItem:
          Type: Api
          Properties:
            Path: /items
            Method: post
        UpdateItem:
          Type: Api
          Properties:
            Path: /items/{id}
            Method: put
        DeleteItem:
          Type: Api
          Properties:
            Path: /items/{id}
            Method: delete
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref ItemsTable

  ItemsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: items
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: id
          AttributeType: S
      KeySchema:
        - AttributeName: id
          KeyType: HASH
      PointInTimeRecoverySpecification:
        PointInTimeRecoveryEnabled: true
      SSESpecification:
        SSEEnabled: true
```

### 1.6 Structured Logging and Metrics with Powertools for AWS Lambda

```python
# handler_with_powertools.py -- Implementation using Lambda Powertools
from aws_lambda_powertools import Logger, Tracer, Metrics
from aws_lambda_powertools.event_handler import APIGatewayRestResolver
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.metrics import MetricUnit
from aws_lambda_powertools.utilities.typing import LambdaContext
import boto3
import os

logger = Logger(service="items-api")
tracer = Tracer(service="items-api")
metrics = Metrics(namespace="ItemsAPI", service="items-api")
app = APIGatewayRestResolver()

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["TABLE_NAME"])

@app.get("/items/<item_id>")
@tracer.capture_method
def get_item(item_id: str):
    logger.info("Getting item", extra={"item_id": item_id})
    result = table.get_item(Key={"id": item_id})
    if "Item" not in result:
        raise app.not_found()
    metrics.add_metric(name="ItemRetrieved", unit=MetricUnit.Count, value=1)
    return result["Item"]

@app.get("/items")
@tracer.capture_method
def list_items():
    params = app.current_event.query_string_parameters or {}
    limit = int(params.get("limit", "20"))
    logger.info("Listing items", extra={"limit": limit})
    result = table.scan(Limit=limit)
    metrics.add_metric(name="ItemsListed", unit=MetricUnit.Count, value=result["Count"])
    return {"items": result["Items"], "count": result["Count"]}

@app.post("/items")
@tracer.capture_method
def create_item():
    import uuid
    body = app.current_event.json_body
    body["id"] = str(uuid.uuid4())
    table.put_item(Item=body)
    logger.info("Item created", extra={"item_id": body["id"]})
    metrics.add_metric(name="ItemCreated", unit=MetricUnit.Count, value=1)
    return body, 201

@app.put("/items/<item_id>")
@tracer.capture_method
def update_item(item_id: str):
    body = app.current_event.json_body
    body["id"] = item_id
    table.put_item(Item=body)
    logger.info("Item updated", extra={"item_id": item_id})
    metrics.add_metric(name="ItemUpdated", unit=MetricUnit.Count, value=1)
    return body

@app.delete("/items/<item_id>")
@tracer.capture_method
def delete_item(item_id: str):
    table.delete_item(Key={"id": item_id})
    logger.info("Item deleted", extra={"item_id": item_id})
    metrics.add_metric(name="ItemDeleted", unit=MetricUnit.Count, value=1)
    return "", 204

@logger.inject_lambda_context(correlation_id_path=correlation_paths.API_GATEWAY_REST)
@tracer.capture_lambda_handler
@metrics.log_metrics(capture_cold_start_metric=True)
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    return app.resolve(event, context)
```

### 1.7 GraphQL API (AppSync + Lambda)

```yaml
# SAM template for AppSync GraphQL API
Resources:
  GraphQLApi:
    Type: AWS::AppSync::GraphQLApi
    Properties:
      Name: items-graphql-api
      AuthenticationType: AMAZON_COGNITO_USER_POOLS
      UserPoolConfig:
        UserPoolId: !Ref UserPool
        DefaultAction: ALLOW
        AwsRegion: !Ref AWS::Region
      LogConfig:
        CloudWatchLogsRoleArn: !GetAtt AppSyncLogsRole.Arn
        FieldLogLevel: ERROR
      XrayEnabled: true

  GraphQLSchema:
    Type: AWS::AppSync::GraphQLSchema
    Properties:
      ApiId: !GetAtt GraphQLApi.ApiId
      Definition: |
        type Item {
          id: ID!
          name: String!
          description: String
          price: Float
          category: String
          createdAt: AWSDateTime
          updatedAt: AWSDateTime
        }

        input CreateItemInput {
          name: String!
          description: String
          price: Float
          category: String
        }

        input UpdateItemInput {
          name: String
          description: String
          price: Float
          category: String
        }

        type ItemConnection {
          items: [Item]
          nextToken: String
        }

        type Query {
          getItem(id: ID!): Item
          listItems(limit: Int, nextToken: String): ItemConnection
          searchItems(keyword: String!, limit: Int): ItemConnection
        }

        type Mutation {
          createItem(input: CreateItemInput!): Item
          updateItem(id: ID!, input: UpdateItemInput!): Item
          deleteItem(id: ID!): Item
        }

        type Subscription {
          onCreateItem: Item
            @aws_subscribe(mutations: ["createItem"])
          onUpdateItem(id: ID): Item
            @aws_subscribe(mutations: ["updateItem"])
        }

        schema {
          query: Query
          mutation: Mutation
          subscription: Subscription
        }
```

---

## 2. Event-Driven Pattern

### 2.1 Overview of Event-Driven Architecture

```
Event-Driven Architecture:

Producer           Event Router           Consumer
+-----------+        +---------------+      +------------+
| Order API  | -----> |               | ---> | Inventory  |
+-----------+        |               |      +------------+
                     |  EventBridge  |
+-----------+        |  / SNS       | ---> +------------+
| Payment   | -----> |               |      | Send Email |
+-----------+        |               |      +------------+
                     |               |
+-----------+        |               | ---> +------------+
| Inventory | -----> |               |      | Analytics  |
+-----------+        +---------------+      +------------+

Characteristics:
  - Loose coupling: producers don't know about consumers
  - Easy to extend: just add new consumers
  - Asynchronous: can return responses immediately
```

### 2.2 S3 Event-Driven Image Processing

```python
# image_processor.py -- Image resizing triggered by S3
import boto3
import os
from PIL import Image
import io

s3 = boto3.client("s3")
DEST_BUCKET = os.environ["DEST_BUCKET"]
SIZES = [(128, 128), (256, 256), (512, 512)]

def lambda_handler(event, context):
    for record in event["Records"]:
        bucket = record["s3"]["bucket"]["name"]
        key = record["s3"]["object"]["key"]

        # Download the original image
        response = s3.get_object(Bucket=bucket, Key=key)
        image = Image.open(io.BytesIO(response["Body"].read()))

        # Resize to each size and upload
        for width, height in SIZES:
            resized = image.copy()
            resized.thumbnail((width, height))

            buffer = io.BytesIO()
            resized.save(buffer, format="JPEG", quality=85)
            buffer.seek(0)

            dest_key = f"thumbnails/{width}x{height}/{key}"
            s3.put_object(
                Bucket=DEST_BUCKET,
                Key=dest_key,
                Body=buffer,
                ContentType="image/jpeg"
            )

    return {"processed": len(event["Records"])}
```

### 2.3 Event Routing with EventBridge

```json
{
  "Source": "com.myapp.orders",
  "DetailType": "OrderCreated",
  "Detail": {
    "orderId": "ORD-12345",
    "customerId": "CUST-67890",
    "amount": 15000,
    "items": [
      {"productId": "PROD-001", "quantity": 2}
    ]
  }
}
```

```bash
# Create an EventBridge rule
aws events put-rule \
  --name "high-value-orders" \
  --event-pattern '{
    "source": ["com.myapp.orders"],
    "detail-type": ["OrderCreated"],
    "detail": {
      "amount": [{"numeric": [">=", 10000]}]
    }
  }'

# Set targets (Lambda functions)
aws events put-targets \
  --rule "high-value-orders" \
  --targets '[
    {
      "Id": "notify-vip-team",
      "Arn": "arn:aws:lambda:...:notify-vip-team"
    },
    {
      "Id": "fraud-check",
      "Arn": "arn:aws:lambda:...:fraud-check"
    }
  ]'
```

### 2.4 Transformation Pipeline with EventBridge Pipes

```
EventBridge Pipes configuration:

Source         Filtering          Enrichment            Target
+--------+     +----------+       +------------+        +---------+
| SQS    | --> | Event    | --->  | Lambda     | -----> | Step    |
| DynamoDB|    | Pattern  |       | (transform)|        | Functions|
| Kinesis |    | Matching |       | API GW     |        | Lambda  |
+--------+     +----------+       +------------+        +---------+
```

```yaml
# SAM template for EventBridge Pipes
Resources:
  OrderProcessingPipe:
    Type: AWS::Pipes::Pipe
    Properties:
      Name: order-processing-pipe
      RoleArn: !GetAtt PipeRole.Arn
      Source: !GetAtt OrderQueue.Arn
      SourceParameters:
        SqsQueueParameters:
          BatchSize: 10
          MaximumBatchingWindowInSeconds: 30
        FilterCriteria:
          Filters:
            - Pattern: '{"body": {"orderType": ["premium"]}}'
      Enrichment: !GetAtt EnrichmentFunction.Arn
      Target: !Ref OrderProcessingStateMachine
      TargetParameters:
        StepFunctionStateMachineParameters:
          InvocationType: FIRE_AND_FORGET
```

### 2.5 Change Data Capture with DynamoDB Streams

```python
# dynamodb_stream_handler.py -- DynamoDB Streams CDC pattern
import json
import boto3
import os
from datetime import datetime

sqs = boto3.client("sqs")
AUDIT_QUEUE_URL = os.environ["AUDIT_QUEUE_URL"]

def lambda_handler(event, context):
    """Process events from DynamoDB Streams and send to audit queue"""
    for record in event["Records"]:
        event_name = record["eventName"]  # INSERT, MODIFY, REMOVE
        event_id = record["eventID"]
        timestamp = record["dynamodb"]["ApproximateCreationDateTime"]

        audit_event = {
            "eventId": event_id,
            "eventType": event_name,
            "timestamp": str(timestamp),
            "tableName": record["eventSourceARN"].split("/")[1],
            "processedAt": datetime.utcnow().isoformat()
        }

        if event_name in ("INSERT", "MODIFY"):
            new_image = deserialize(record["dynamodb"]["NewImage"])
            audit_event["newImage"] = new_image

        if event_name in ("MODIFY", "REMOVE"):
            old_image = deserialize(record["dynamodb"]["OldImage"])
            audit_event["oldImage"] = old_image

        if event_name == "MODIFY":
            # Detect changed fields
            changes = detect_changes(
                deserialize(record["dynamodb"]["OldImage"]),
                deserialize(record["dynamodb"]["NewImage"])
            )
            audit_event["changedFields"] = changes

        sqs.send_message(
            QueueUrl=AUDIT_QUEUE_URL,
            MessageBody=json.dumps(audit_event),
            MessageGroupId=audit_event.get("newImage", {}).get("id", "default")
        )

    return {"batchItemFailures": []}

def deserialize(image):
    """Convert DynamoDB typed format to a normal dict"""
    from boto3.dynamodb.types import TypeDeserializer
    deserializer = TypeDeserializer()
    return {k: deserializer.deserialize(v) for k, v in image.items()}

def detect_changes(old_image, new_image):
    """Detect differences between old and new images"""
    changes = []
    all_keys = set(list(old_image.keys()) + list(new_image.keys()))
    for key in all_keys:
        old_val = old_image.get(key)
        new_val = new_image.get(key)
        if old_val != new_val:
            changes.append({
                "field": key,
                "oldValue": str(old_val),
                "newValue": str(new_val)
            })
    return changes
```

---

## 3. Fan-Out Pattern

### 3.1 SNS + SQS Fan-Out

```
                          +-------+     +-------+     +---------+
                     +--> | SQS 1 | --> | Lambda| --> | Inventory|
                     |    +-------+     +-------+     +---------+
                     |
+-----------+   +----+    +-------+     +-------+     +---------+
| Order     | --> | SNS | --> | SQS 2 | --> | Lambda| --> | Billing  |
| Event     |   +----+    +-------+     +-------+     +---------+
+-----------+        |
                     |    +-------+     +-------+     +---------+
                     +--> | SQS 3 | --> | Lambda| --> | Notify   |
                          +-------+     +-------+     +---------+

Benefits:
  - Each SQS queue acts as an independent buffer
  - If one consumer is slow, it does not affect others
  - SQS retry/DLQ features improve fault tolerance
```

```python
# order_publisher.py -- Publishing events to SNS
import boto3
import json
import os

sns = boto3.client("sns")
TOPIC_ARN = os.environ["ORDER_TOPIC_ARN"]

def lambda_handler(event, context):
    order = json.loads(event["body"])

    # Publish to SNS topic
    sns.publish(
        TopicArn=TOPIC_ARN,
        Message=json.dumps(order),
        MessageAttributes={
            "orderType": {
                "DataType": "String",
                "StringValue": order.get("type", "standard")
            },
            "amount": {
                "DataType": "Number",
                "StringValue": str(order["amount"])
            }
        }
    )

    return {
        "statusCode": 202,
        "body": json.dumps({"message": "Order accepted", "orderId": order["id"]})
    }
```

### 3.2 SQS Batch Processing

```python
# batch_processor.py -- SQS batch processing with partial failure reporting
import json

def lambda_handler(event, context):
    batch_item_failures = []

    for record in event["Records"]:
        try:
            body = json.loads(record["body"])
            # When wrapped by SNS
            if "Message" in body:
                message = json.loads(body["Message"])
            else:
                message = body

            process_order(message)
        except Exception as e:
            print(f"Error processing {record['messageId']}: {e}")
            batch_item_failures.append({
                "itemIdentifier": record["messageId"]
            })

    return {"batchItemFailures": batch_item_failures}

def process_order(order):
    # Order processing logic
    print(f"Processing order: {order['id']}")
```

### 3.3 SNS Filtering Policy

```json
{
  "orderType": ["premium", "vip"],
  "amount": [{"numeric": [">=", 10000]}],
  "region": [{"prefix": "asia-"}]
}
```

```yaml
# SNS + SQS fan-out definition in SAM template
Resources:
  OrderTopic:
    Type: AWS::SNS::Topic
    Properties:
      TopicName: order-events

  # Inventory update queue - receives all orders
  InventoryQueue:
    Type: AWS::SQS::Queue
    Properties:
      QueueName: inventory-updates
      VisibilityTimeout: 60
      RedrivePolicy:
        deadLetterTargetArn: !GetAtt InventoryDLQ.Arn
        maxReceiveCount: 3

  InventoryDLQ:
    Type: AWS::SQS::Queue
    Properties:
      QueueName: inventory-updates-dlq
      MessageRetentionPeriod: 1209600  # 14 days

  InventorySubscription:
    Type: AWS::SNS::Subscription
    Properties:
      TopicArn: !Ref OrderTopic
      Protocol: sqs
      Endpoint: !GetAtt InventoryQueue.Arn
      RawMessageDelivery: true

  # VIP notification queue - receives only high-value orders
  VipNotificationQueue:
    Type: AWS::SQS::Queue
    Properties:
      QueueName: vip-notifications
      VisibilityTimeout: 30

  VipSubscription:
    Type: AWS::SNS::Subscription
    Properties:
      TopicArn: !Ref OrderTopic
      Protocol: sqs
      Endpoint: !GetAtt VipNotificationQueue.Arn
      RawMessageDelivery: true
      FilterPolicy:
        orderType:
          - premium
          - vip
        amount:
          - numeric:
              - ">="
              - 10000

  # SQS policy (allow sending from SNS)
  InventoryQueuePolicy:
    Type: AWS::SQS::QueuePolicy
    Properties:
      Queues:
        - !Ref InventoryQueue
      PolicyDocument:
        Statement:
          - Effect: Allow
            Principal:
              Service: sns.amazonaws.com
            Action: sqs:SendMessage
            Resource: !GetAtt InventoryQueue.Arn
            Condition:
              ArnEquals:
                aws:SourceArn: !Ref OrderTopic
```

---

## 4. CQRS Pattern

### 4.1 CQRS (Command Query Responsibility Segregation)

```
CQRS Architecture:

Write side (Command)                  Read side (Query)
+------------+                        +------------+
| API GW     |                        | API GW     |
| POST/PUT   |                        | GET        |
+------------+                        +------------+
     |                                     |
     v                                     v
+------------+                        +------------+
| Lambda     |                        | Lambda     |
| (Writer)   |                        | (Reader)   |
+------------+                        +------------+
     |                                     |
     v                                     v
+------------+    DynamoDB Streams    +------------------+
| DynamoDB   | ---------------------> | DynamoDB (GSI)   |
| (write-opt)|    +------------+    | / ElastiCache    |
+------------+    | Lambda     |    | / OpenSearch     |
                  | (sync)     |    | (read-optimized) |
                  +------------+    +------------------+
                       |
                       v
                  +------------------+
                  | Update read model|
                  +------------------+

Benefits:
  - Scale reads and writes independently
  - Optimize the read model per use case
  - Improve efficiency of complex queries
```

### 4.2 Synchronization via DynamoDB Streams

```python
# stream_processor.py -- Update read model from DynamoDB Streams
import boto3
import os
import json

opensearch_endpoint = os.environ["OPENSEARCH_ENDPOINT"]

def lambda_handler(event, context):
    for record in event["Records"]:
        event_name = record["eventName"]  # INSERT, MODIFY, REMOVE

        if event_name in ("INSERT", "MODIFY"):
            new_image = record["dynamodb"]["NewImage"]
            item = deserialize_dynamodb(new_image)
            index_to_opensearch(item)
        elif event_name == "REMOVE":
            old_image = record["dynamodb"]["OldImage"]
            item = deserialize_dynamodb(old_image)
            remove_from_opensearch(item["id"])

def deserialize_dynamodb(image):
    """Convert DynamoDB typed format to a normal dict"""
    from boto3.dynamodb.types import TypeDeserializer
    deserializer = TypeDeserializer()
    return {k: deserializer.deserialize(v) for k, v in image.items()}

def index_to_opensearch(item):
    """Index document to OpenSearch"""
    import requests
    from requests_aws4auth import AWS4Auth

    credentials = boto3.Session().get_credentials()
    auth = AWS4Auth(
        credentials.access_key, credentials.secret_key,
        os.environ["AWS_REGION"], "es",
        session_token=credentials.token
    )

    url = f"{opensearch_endpoint}/items/_doc/{item['id']}"
    requests.put(url, auth=auth, json=item)
```

### 4.3 Read Model with ElastiCache

```python
# cache_updater.py -- Update ElastiCache (Redis) from DynamoDB Streams
import boto3
import json
import os
import redis

redis_client = redis.Redis(
    host=os.environ["REDIS_ENDPOINT"],
    port=6379,
    decode_responses=True,
    ssl=True
)

def lambda_handler(event, context):
    for record in event["Records"]:
        event_name = record["eventName"]

        if event_name in ("INSERT", "MODIFY"):
            new_image = deserialize(record["dynamodb"]["NewImage"])
            item_id = new_image["id"]

            # Update cache for individual item
            redis_client.set(
                f"item:{item_id}",
                json.dumps(new_image),
                ex=3600  # 1 hour TTL
            )

            # Update category-based sorted set
            if "category" in new_image and "updatedAt" in new_image:
                redis_client.zadd(
                    f"category:{new_image['category']}",
                    {item_id: float(new_image["updatedAt"])}
                )

            # Update reverse index for search
            if "tags" in new_image:
                for tag in new_image["tags"]:
                    redis_client.sadd(f"tag:{tag}", item_id)

        elif event_name == "REMOVE":
            old_image = deserialize(record["dynamodb"]["OldImage"])
            item_id = old_image["id"]

            redis_client.delete(f"item:{item_id}")

            if "category" in old_image:
                redis_client.zrem(f"category:{old_image['category']}", item_id)

            if "tags" in old_image:
                for tag in old_image["tags"]:
                    redis_client.srem(f"tag:{tag}", item_id)

    return {"batchItemFailures": []}

def deserialize(image):
    from boto3.dynamodb.types import TypeDeserializer
    d = TypeDeserializer()
    return {k: d.deserialize(v) for k, v in image.items()}
```

---

## 5. Saga Pattern

### 5.1 Managing Distributed Transactions

```
Saga Pattern (Step Functions):

[Start]
   |
   v
+------------------+     Failure
| 1. Reserve Stock  | ----------+
+------------------+           |
   |  Success                  v
   v                    +------------------+
+------------------+    | 1'. Cancel       |
| 2. Process       |    |     Reservation  |
|    Payment       |    +------------------+
+------------------+           ^
   |  Success   | Failure      |
   v            +------------>-+
+------------------+
| 3. Arrange        |
|    Shipping       |
+------------------+           +------------------+
   |  Success   | Failure +--> | 2'. Refund       |
   v            +------+      |     Payment      |
+------------------+           +------------------+
| 4. Confirm Order  |                   |
+------------------+                   v
   |                           +------------------+
   v                           | 1'. Cancel       |
 [End]                         |     Reservation  |
                               +------------------+
                                       |
                                       v
                                     [Fail]
```

```json
{
  "Comment": "Order Saga",
  "StartAt": "ReserveInventory",
  "States": {
    "ReserveInventory": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:reserve-inventory",
      "Next": "ProcessPayment",
      "Catch": [{"ErrorEquals": ["States.ALL"], "Next": "Fail"}]
    },
    "ProcessPayment": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:process-payment",
      "Next": "ArrangeShipping",
      "Catch": [{
        "ErrorEquals": ["States.ALL"],
        "Next": "CancelReservation"
      }]
    },
    "ArrangeShipping": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:arrange-shipping",
      "Next": "ConfirmOrder",
      "Catch": [{
        "ErrorEquals": ["States.ALL"],
        "Next": "RefundPayment"
      }]
    },
    "ConfirmOrder": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:confirm-order",
      "End": true
    },
    "RefundPayment": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:refund-payment",
      "Next": "CancelReservation"
    },
    "CancelReservation": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:cancel-reservation",
      "Next": "Fail"
    },
    "Fail": {
      "Type": "Fail",
      "Error": "OrderFailed",
      "Cause": "Saga compensation completed"
    }
  }
}
```

### 5.2 Step Functions Express Workflow

```
Step Functions workflow types:

Standard Workflow:
  - Maximum execution time: 1 year
  - Execution guarantee: Exactly-once
  - Pricing: Charged per state transition ($0.025/1000 transitions)
  - Use case: Long-running workflows, waiting for human approval

Express Workflow:
  - Maximum execution time: 5 minutes
  - Execution guarantee: At-least-once
  - Pricing: Charged by number of executions + execution duration
  - Use case: High-volume short-duration processing, IoT data processing
  - Two types: synchronous and asynchronous

Synchronous Express:
  API Gateway --> Step Functions (sync) --> Response
  -> Best for request/response patterns

Asynchronous Express:
  Event --> Step Functions (async) --> Completion notification
  -> Best for background processing
```

```yaml
# SAM template for Step Functions Express Workflow
Resources:
  OrderProcessingStateMachine:
    Type: AWS::Serverless::StateMachine
    Properties:
      DefinitionUri: statemachine/order-processing.asl.json
      Type: EXPRESS
      Tracing:
        Enabled: true
      Logging:
        Destinations:
          - CloudWatchLogsLogGroup:
              LogGroupArn: !GetAtt StateMachineLogGroup.Arn
        IncludeExecutionData: true
        Level: ALL
      Policies:
        - LambdaInvokePolicy:
            FunctionName: !Ref ReserveInventoryFunction
        - LambdaInvokePolicy:
            FunctionName: !Ref ProcessPaymentFunction
        - LambdaInvokePolicy:
            FunctionName: !Ref ArrangeShippingFunction

  StateMachineLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: /aws/stepfunctions/order-processing
      RetentionInDays: 30
```

### 5.3 Parallel Processing and Error Handling in Step Functions

```json
{
  "Comment": "Parallel processing with error handling",
  "StartAt": "ValidateInput",
  "States": {
    "ValidateInput": {
      "Type": "Pass",
      "Next": "ParallelProcessing"
    },
    "ParallelProcessing": {
      "Type": "Parallel",
      "Branches": [
        {
          "StartAt": "ProcessImages",
          "States": {
            "ProcessImages": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:...:process-images",
              "Retry": [
                {
                  "ErrorEquals": ["ServiceException", "TooManyRequestsException"],
                  "IntervalSeconds": 2,
                  "MaxAttempts": 3,
                  "BackoffRate": 2.0
                }
              ],
              "End": true
            }
          }
        },
        {
          "StartAt": "ProcessMetadata",
          "States": {
            "ProcessMetadata": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:...:process-metadata",
              "Retry": [
                {
                  "ErrorEquals": ["States.TaskFailed"],
                  "IntervalSeconds": 1,
                  "MaxAttempts": 2,
                  "BackoffRate": 2.0
                }
              ],
              "End": true
            }
          }
        },
        {
          "StartAt": "SendNotification",
          "States": {
            "SendNotification": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:...:send-notification",
              "End": true
            }
          }
        }
      ],
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "Next": "HandleError",
          "ResultPath": "$.error"
        }
      ],
      "Next": "AggregateResults"
    },
    "AggregateResults": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:aggregate-results",
      "End": true
    },
    "HandleError": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:handle-error",
      "End": true
    }
  }
}
```

---

## 6. Stream Processing Pattern

### 6.1 Kinesis Data Streams + Lambda

```
Real-time stream processing:

Data Source        Stream             Processing         Storage
+----------+       +----------+       +----------+       +----------+
| IoT      | ----> |          | ----> | Lambda   | ----> | DynamoDB |
| Devices  |       |          |       | (real-   |       | (latest) |
+----------+       | Kinesis  |       |  time    |       +----------+
                   | Data     |       |  agg.)   |
+----------+       | Streams  |       +----------+
| Web      | ----> |          | ----> +----------+ ----> +----------+
| Clicks   |       |          |       | Firehose |       | S3       |
+----------+       +----------+       +----------+       | (history)|
                                                         +----------+
                                                         +----------+
                                                  -----> | OpenSearch|
                                                         | (search) |
                                                         +----------+
```

```python
# kinesis_processor.py -- Processing records from Kinesis Data Streams
import json
import base64
import boto3
import os
from datetime import datetime
from collections import defaultdict

dynamodb = boto3.resource("dynamodb")
metrics_table = dynamodb.Table(os.environ["METRICS_TABLE"])

def lambda_handler(event, context):
    """Aggregate events from Kinesis stream"""
    batch_item_failures = []
    aggregated = defaultdict(lambda: {"count": 0, "total_value": 0})

    for record in event["Records"]:
        try:
            # Decode Kinesis record
            payload = base64.b64decode(record["kinesis"]["data"]).decode("utf-8")
            data = json.loads(payload)

            # Aggregation by time window
            timestamp = datetime.fromisoformat(data["timestamp"])
            window_key = timestamp.strftime("%Y-%m-%dT%H:%M")  # Per minute
            metric_key = f"{data['metric_name']}#{window_key}"

            aggregated[metric_key]["count"] += 1
            aggregated[metric_key]["total_value"] += data.get("value", 0)
            aggregated[metric_key]["metric_name"] = data["metric_name"]
            aggregated[metric_key]["window"] = window_key

        except Exception as e:
            print(f"Error processing record {record['kinesis']['sequenceNumber']}: {e}")
            batch_item_failures.append({
                "itemIdentifier": record["kinesis"]["sequenceNumber"]
            })

    # Write aggregated results to DynamoDB
    with metrics_table.batch_writer() as batch:
        for key, agg in aggregated.items():
            batch.put_item(Item={
                "pk": key,
                "metric_name": agg["metric_name"],
                "window": agg["window"],
                "count": agg["count"],
                "total_value": int(agg["total_value"]),
                "avg_value": int(agg["total_value"] / agg["count"]),
                "ttl": int(datetime.utcnow().timestamp()) + 86400 * 7  # Keep 7 days
            })

    return {"batchItemFailures": batch_item_failures}
```

### 6.2 Kinesis Shard Management and Scaling

```yaml
# SAM template for Kinesis Data Streams + Lambda
Resources:
  ClickStream:
    Type: AWS::Kinesis::Stream
    Properties:
      Name: click-stream
      ShardCount: 4
      StreamModeDetails:
        StreamMode: ON_DEMAND  # Auto-scaling
      RetentionPeriodHours: 168  # Keep 7 days
      StreamEncryption:
        EncryptionType: KMS
        KeyId: alias/aws/kinesis

  StreamProcessor:
    Type: AWS::Serverless::Function
    Properties:
      Handler: kinesis_processor.lambda_handler
      Runtime: python3.12
      MemorySize: 512
      Timeout: 300
      Events:
        KinesisEvent:
          Type: Kinesis
          Properties:
            Stream: !GetAtt ClickStream.Arn
            StartingPosition: LATEST
            BatchSize: 100
            MaximumBatchingWindowInSeconds: 30
            ParallelizationFactor: 10
            MaximumRetryAttempts: 3
            BisectBatchOnFunctionError: true
            DestinationConfig:
              OnFailure:
                Destination: !GetAtt FailedRecordsDLQ.Arn
            FunctionResponseTypes:
              - ReportBatchItemFailures
```

---

## 7. Schedule-Driven Pattern

### 7.1 Periodic Execution Jobs

```
Schedule-driven pattern:

+-------------------+       +----------+       +----------+
| EventBridge       | ----> | Lambda   | ----> | Results  |
| Scheduler         |       |          |       |          |
+-------------------+       +----------+       +----------+

Use cases:
  - Daily report generation
  - Periodic deletion of old data (TTL supplement)
  - Health checks / external API monitoring
  - Data sync / ETL batch
  - Temporary file cleanup
```

```python
# scheduled_report.py -- Daily report generation
import boto3
import json
import os
from datetime import datetime, timedelta

dynamodb = boto3.resource("dynamodb")
s3 = boto3.client("s3")
ses = boto3.client("ses")

orders_table = dynamodb.Table(os.environ["ORDERS_TABLE"])
REPORT_BUCKET = os.environ["REPORT_BUCKET"]
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]

def lambda_handler(event, context):
    """Generate a report for the previous day's orders every day at 9:00 AM (JST)"""
    yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")

    # Retrieve previous day's order data
    response = orders_table.query(
        IndexName="date-index",
        KeyConditionExpression="orderDate = :date",
        ExpressionAttributeValues={":date": yesterday}
    )
    orders = response["Items"]

    # Generate report
    report = generate_report(yesterday, orders)

    # Save report to S3
    report_key = f"reports/daily/{yesterday}.json"
    s3.put_object(
        Bucket=REPORT_BUCKET,
        Key=report_key,
        Body=json.dumps(report, ensure_ascii=False, indent=2),
        ContentType="application/json"
    )

    # Email notification
    send_report_email(yesterday, report)

    return {"date": yesterday, "orderCount": len(orders)}

def generate_report(date, orders):
    total_revenue = sum(float(o.get("amount", 0)) for o in orders)
    categories = {}
    for order in orders:
        cat = order.get("category", "other")
        categories[cat] = categories.get(cat, 0) + 1

    return {
        "date": date,
        "totalOrders": len(orders),
        "totalRevenue": total_revenue,
        "averageOrderValue": total_revenue / len(orders) if orders else 0,
        "ordersByCategory": categories,
        "generatedAt": datetime.utcnow().isoformat()
    }

def send_report_email(date, report):
    ses.send_email(
        Source=ADMIN_EMAIL,
        Destination={"ToAddresses": [ADMIN_EMAIL]},
        Message={
            "Subject": {"Data": f"Daily Order Report: {date}"},
            "Body": {
                "Text": {
                    "Data": f"Order count: {report['totalOrders']}\n"
                            f"Total revenue: ${report['totalRevenue']:,.0f}\n"
                            f"Average order value: ${report['averageOrderValue']:,.0f}"
                }
            }
        }
    )
```

```yaml
# SAM template for schedule-driven pattern
Resources:
  DailyReportFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: scheduled_report.lambda_handler
      Runtime: python3.12
      MemorySize: 256
      Timeout: 300
      Events:
        DailySchedule:
          Type: ScheduleV2
          Properties:
            ScheduleExpression: cron(0 0 * * ? *)  # Every day at 9:00 AM JST (UTC 0:00)
            ScheduleExpressionTimezone: Asia/Tokyo
            RetryPolicy:
              MaximumRetryAttempts: 2
              MaximumEventAgeInSeconds: 3600
```

---

## 8. Web Application Pattern

### 8.1 Full-Stack Serverless Configuration

```
Full-stack serverless architecture:

User
    |
    v
+-------------------+
| CloudFront        |  (CDN + custom domain + SSL)
+-------------------+
    |             |
    v             v
+--------+  +-----------+
| S3     |  | API GW    |  (/api/* path pattern)
| (SPA)  |  | (HTTP API)|
+--------+  +-----------+
                  |
                  v
            +----------+
            | Lambda   |
            +----------+
                  |
    +-------------+-------------+
    v             v             v
+--------+  +----------+  +---------+
|DynamoDB|  | Cognito  |  | S3      |
|(data)  |  | (auth)   |  |(files)  |
+--------+  +----------+  +---------+
```

```yaml
# SAM template for full-stack serverless
Resources:
  # S3 bucket (frontend)
  WebBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub '${AWS::StackName}-web'
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true

  # CloudFront OAC
  CloudFrontOAC:
    Type: AWS::CloudFront::OriginAccessControl
    Properties:
      OriginAccessControlConfig:
        Name: !Sub '${AWS::StackName}-oac'
        OriginAccessControlOriginType: s3
        SigningBehavior: always
        SigningProtocol: sigv4

  # CloudFront distribution
  Distribution:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Origins:
          - Id: S3Origin
            DomainName: !GetAtt WebBucket.RegionalDomainName
            OriginAccessControlId: !GetAtt CloudFrontOAC.Id
            S3OriginConfig:
              OriginAccessIdentity: ''
          - Id: ApiOrigin
            DomainName: !Sub '${HttpApi}.execute-api.${AWS::Region}.amazonaws.com'
            CustomOriginConfig:
              HTTPSPort: 443
              OriginProtocolPolicy: https-only
        DefaultCacheBehavior:
          TargetOriginId: S3Origin
          ViewerProtocolPolicy: redirect-to-https
          CachePolicyId: 658327ea-f89d-4fab-a63d-7e88639e58f6  # CachingOptimized
        CacheBehaviors:
          - PathPattern: /api/*
            TargetOriginId: ApiOrigin
            ViewerProtocolPolicy: https-only
            CachePolicyId: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad  # CachingDisabled
            OriginRequestPolicyId: b689b0a8-53d0-40ab-baf2-68738e2966ac  # AllViewerExceptHostHeader
        DefaultRootObject: index.html
        CustomErrorResponses:
          - ErrorCode: 404
            ResponseCode: 200
            ResponsePagePath: /index.html  # SPA routing support
        Enabled: true
        HttpVersion: http2and3
```

---

## 9. Pattern Comparison Table

| Pattern | Use Case | Complexity | Latency | Cost Efficiency |
|---------|------------|--------|----------|-----------|
| API + Lambda + DynamoDB | CRUD API | Low | Low | High |
| Event-driven | Async processing | Medium | Medium | High |
| Fan-out (SNS+SQS) | One-to-many notification | Medium | Medium | High |
| CQRS | Read/write separation | High | Read: Low | Medium |
| Saga | Distributed transactions | High | High | Medium |
| Stream processing | Real-time aggregation | Medium | Low-Medium | Medium |
| Schedule-driven | Periodic batch | Low | N/A | High |
| Full-stack | Web app | Medium | Low | High |

| Pattern | Scalability | Coupling | Operational Complexity |
|---------|----------------|--------|-----------|
| API + Lambda + DynamoDB | High | Medium | Low |
| Event-driven | High | Low | Medium |
| Fan-out (SNS+SQS) | High | Low | Medium |
| CQRS | Very High | Low | High |
| Saga | High | Low | High |
| Stream processing | Very High | Low | Medium |
| Schedule-driven | High | Low | Low |
| Full-stack | High | Medium | Medium |

---

## 10. Cold Start Mitigation

### 10.1 How Cold Starts Work

```
Lambda cold start flow:

First request (cold start):
  [Request] --> [Env setup: ~200ms] --> [Code load: ~100ms] --> [Init: ~500ms] --> [Process]
                 MicroVM creation        Deploy package expand    Runtime init

Subsequent requests (warm start):
  [Request] --> [Process]
                Reuses existing execution environment

Cold start factors:
  - No available execution environment for new request
  - Execution environment was reclaimed after idle period
  - After Lambda deployment/configuration change
  - ENI creation for Lambda in VPC (significantly improved now)
```

### 10.2 Provisioned Concurrency

```bash
# Configure Provisioned Concurrency
aws lambda put-provisioned-concurrency-config \
  --function-name my-api-function \
  --qualifier prod \
  --provisioned-concurrent-executions 10

# Integration with Application Auto Scaling
aws application-autoscaling register-scalable-target \
  --service-namespace lambda \
  --resource-id "function:my-api-function:prod" \
  --scalable-dimension "lambda:function:ProvisionedConcurrency" \
  --min-capacity 5 \
  --max-capacity 50

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

### 10.3 SnapStart (Java)

```yaml
# SnapStart-enabled Lambda (Java)
Resources:
  JavaFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: com.example.Handler::handleRequest
      Runtime: java21
      MemorySize: 1024
      SnapStart:
        ApplyOn: PublishedVersions
      AutoPublishAlias: live
```

### 10.4 Best Practices for Reducing Cold Starts

```
Cold start mitigation checklist:

1. Minimize deployment package size
   - Exclude unnecessary dependencies
   - Separate common libraries with Lambda Layers
   - Remove unused code via tree-shaking (Node.js)

2. Runtime selection
   - Fast: Python, Node.js (~100ms)
   - Medium: Go, .NET (~200ms)
   - Slow: Java (~500ms, improvable with SnapStart)

3. SDK client initialization
   - Initialize SDK clients outside the handler (global scope)
   - Enable connection reuse

4. Memory configuration
   - Increasing memory also increases CPU proportionally
   - Initialization time may be reduced
   - Use AWS Lambda Power Tuning to find the optimal value

5. VPC configuration
   - Avoid VPC configuration unless necessary
   - If VPC is required, use hyperplane ENI (significantly improved)
```

---

## 11. Anti-Patterns

### 11.1 Lambda Chain (Synchronous Chained Invocations)

```
[Bad example] Direct synchronous invocation from Lambda to Lambda

Lambda A --> Lambda B --> Lambda C --> Lambda D
  3s          2s          1s          2s
  Total: 8s (billed for all Lambda execution time)

[Good example] Orchestration with Step Functions

Step Functions --> Lambda A (3s)
              --> Lambda B (2s)
              --> Lambda C (1s)
              --> Lambda D (2s)
  Each Lambda is only billed for its own execution time
```

**Problem**: The upstream Lambda is billed while waiting for the downstream to complete. Error handling becomes complex and timeout risks cascade.

**Improvement**: Use Step Functions, SQS, or EventBridge to connect asynchronously.

### 11.2 API Relying on DynamoDB Scans

```python
# [Bad example] Full-table scan for searching
def search_items(keyword):
    result = table.scan(
        FilterExpression=Attr("name").contains(keyword)
    )
    return result["Items"]  # Reads the entire table

# [Good example] Efficient query using GSI
def search_items(category, date_from):
    result = table.query(
        IndexName="category-date-index",
        KeyConditionExpression=Key("category").eq(category) & Key("created_at").gte(date_from)
    )
    return result["Items"]  # Reads only the required range
```

### 11.3 Hard-Coding Inside Lambda Functions

```python
# [Bad example] Hard-coding connection targets and secrets
import boto3

def lambda_handler(event, context):
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table("my-production-table")  # Table name hard-coded
    api_key = "sk-abc123def456"  # Secret in code

# [Good example] Using environment variables and Secrets Manager
import boto3
import os
import json

# Initialize outside handler (executed only on cold start)
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["TABLE_NAME"])
secrets_client = boto3.client("secretsmanager")

_cached_secret = None

def get_api_key():
    global _cached_secret
    if _cached_secret is None:
        response = secrets_client.get_secret_value(
            SecretId=os.environ["API_KEY_SECRET_ARN"]
        )
        _cached_secret = json.loads(response["SecretString"])["api_key"]
    return _cached_secret

def lambda_handler(event, context):
    api_key = get_api_key()
    # Processing...
```

### 11.4 Mismatch Between Lambda Timeout and SQS Visibility Timeout

```
[Bad example]
Lambda timeout: 300 seconds
SQS visibility timeout: 30 seconds

-> If Lambda takes more than 30 seconds, SQS re-delivers the message
-> The same message is processed simultaneously by multiple Lambdas

[Good example]
Lambda timeout: 300 seconds
SQS visibility timeout: 360 seconds (Lambda timeout + margin)

-> While Lambda is processing, other consumers will not receive the message
```

### 11.5 Monolithic Lambda Functions

```
[Bad example] A single giant Lambda function
Lambda Function (one):
  - User management
  - Order processing
  - Inventory management
  - Report generation
  -> Slow deployments, wasted memory, excessive permissions

[Good example] Split by functionality
Lambda: user-management    -> IAM: DynamoDB Users table only
Lambda: order-processing   -> IAM: DynamoDB Orders table + SQS
Lambda: inventory-manager  -> IAM: DynamoDB Inventory table
Lambda: report-generator   -> IAM: S3 + DynamoDB ReadOnly
  -> Least privilege, independent deployments, appropriate resource allocation
```

---

## 12. Monitoring and Observability

### 12.1 Serverless Monitoring Strategy

```
Four pillars of serverless monitoring:

1. Metrics (CloudWatch Metrics)
   - Lambda: Invocations, Duration, Errors, Throttles, ConcurrentExecutions
   - API GW: Count, Latency, 4XXError, 5XXError
   - DynamoDB: ConsumedReadCapacityUnits, ThrottledRequests
   - SQS: ApproximateNumberOfMessagesVisible, ApproximateAgeOfOldestMessage

2. Logs (CloudWatch Logs + Logs Insights)
   - Output as structured logs (JSON)
   - Track requests with correlation IDs
   - Query analysis with Logs Insights

3. Traces (AWS X-Ray)
   - Visualize inter-service calls
   - Identify bottlenecks
   - Identify error locations

4. Alarms (CloudWatch Alarms + SNS)
   - Error rate threshold exceeded
   - Abnormal latency increase
   - Messages accumulating in DLQ
```

```yaml
# CloudFormation template for monitoring alarms
Resources:
  LambdaErrorAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: !Sub '${AWS::StackName}-lambda-errors'
      AlarmDescription: Lambda error rate exceeds 5%
      Namespace: AWS/Lambda
      MetricName: Errors
      Dimensions:
        - Name: FunctionName
          Value: !Ref ApiFunction
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 2
      Threshold: 5
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - !Ref AlertTopic

  ApiLatencyAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: !Sub '${AWS::StackName}-api-latency'
      AlarmDescription: API latency P99 exceeds 3 seconds
      Namespace: AWS/ApiGateway
      MetricName: Latency
      Dimensions:
        - Name: ApiName
          Value: !Ref HttpApi
      ExtendedStatistic: p99
      Period: 300
      EvaluationPeriods: 3
      Threshold: 3000
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - !Ref AlertTopic

  DLQAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: !Sub '${AWS::StackName}-dlq-messages'
      AlarmDescription: Messages accumulating in DLQ
      Namespace: AWS/SQS
      MetricName: ApproximateNumberOfMessagesVisible
      Dimensions:
        - Name: QueueName
          Value: !GetAtt DeadLetterQueue.QueueName
      Statistic: Sum
      Period: 60
      EvaluationPeriods: 1
      Threshold: 1
      ComparisonOperator: GreaterThanOrEqualToThreshold
      AlarmActions:
        - !Ref AlertTopic

  AlertTopic:
    Type: AWS::SNS::Topic
    Properties:
      TopicName: !Sub '${AWS::StackName}-alerts'
      Subscription:
        - Endpoint: ops-team@example.com
          Protocol: email
```

---

## 13. FAQ

### Q1. What are cases where serverless architecture is not a good fit?

Long-running tasks (over 15 minutes), high-frequency steady traffic (EC2/ECS is more cost-effective), ML inference requiring GPUs, long-lived WebSocket connections (possible within API Gateway WebSocket limits), and real-time processing extremely sensitive to latency (when cold starts cannot be tolerated) all fall into this category.

### Q2. How do I choose between event-driven and request-response?

Operations where the user needs an immediate result (authentication, data retrieval) suit request-response. Operations where delayed results are acceptable (email sending, report generation, data sync) suit event-driven. In most cases, both patterns are combined within a single system.

### Q3. Should I choose DynamoDB or RDS?

DynamoDB excels at key-value/document access patterns and has high affinity with serverless. RDS is appropriate when a relational data model is required, or when complex JOINs and transactions are frequent. When using Lambda + RDS, connection management via RDS Proxy is essential.

### Q4. How should I decide the Lambda memory size?

It is recommended to use the AWS Lambda Power Tuning tool (https://github.com/alexcasalboni/aws-lambda-power-tuning) to find the optimal balance between cost and performance. Generally, for CPU-bound processing, increasing memory reduces processing time and may lower total cost. For I/O-bound processing, the benefit of increasing memory is limited.

### Q5. What should the testing strategy be for serverless?

For unit tests, separate business logic from the Lambda handler and test independently. For integration tests, test locally using LocalStack or SAM CLI's `sam local invoke`. For E2E tests, deploy to a staging environment. Use contract tests to verify event schema compatibility.

### Q6. What is the Lambda function deployment package size limit?

Direct upload: 50MB (after zip compression), via S3: 250MB (uncompressed), container image: 10GB. If the deployment package is large, separate common libraries with Lambda Layers or deploy as a container image.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. It is recommended to thoroughly understand the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Pattern | Components | Primary Use |
|---------|---------|---------|
| API Backend | API GW + Lambda + DynamoDB | RESTful API |
| GraphQL | AppSync + Lambda + DynamoDB | GraphQL API |
| Event-driven | EventBridge + Lambda | Async processing, microservice integration |
| Fan-out | SNS + SQS + Lambda | One-to-many parallel processing |
| CQRS | DynamoDB Streams + Lambda | Read/write separation, search optimization |
| Saga | Step Functions + Lambda | Distributed transactions |
| Stream processing | Kinesis + Lambda | Real-time data aggregation |
| Schedule-driven | EventBridge Scheduler + Lambda | Periodic batch processing |
| Full-stack | CloudFront + S3 + API GW + Lambda | Web applications |

---

## Further Reading

- [ECS Basics](../06-containers/00-ecs-basics.md) -- Container-based alternative architecture
- [CloudFormation](../07-devops/00-cloudformation.md) -- Infrastructure as code for serverless
- [IAM Deep Dive](../08-security/00-iam-deep-dive.md) -- Security design for serverless

---

## References

1. AWS Official "Serverless Application Lens - AWS Well-Architected Framework" https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/
2. Alex DeBrie "The DynamoDB Book" DynamoDB Book, 2020
3. AWS Samples "Serverless Patterns Collection" https://serverlessland.com/patterns
4. Gregor Hohpe, Bobby Woolf "Enterprise Integration Patterns" Addison-Wesley, 2003
5. AWS Official "Lambda Powertools for Python" https://docs.powertools.aws.dev/lambda/python/latest/
6. AWS Official "Step Functions Developer Guide" https://docs.aws.amazon.com/step-functions/latest/dg/

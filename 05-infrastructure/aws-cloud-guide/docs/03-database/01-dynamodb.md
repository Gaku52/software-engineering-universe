# Amazon DynamoDB

> Understand AWS's fully managed NoSQL database and practically master table design, GSI/LSI, capacity modes, DynamoDB Streams, backups, and global tables

## What You Will Learn in This Chapter

1. **DynamoDB Data Model** — Design principles for partition keys, sort keys, and item structure
2. **Secondary Indexes** — Choosing between GSI (Global) and LSI (Local), and query patterns
3. **Capacity Modes and Operations** — On-demand vs provisioned, DAX cache, TTL management
4. **DynamoDB Streams and Event-Driven Architecture** — CDC (Change Data Capture) and Lambda integration
5. **Backup and Restore** — PITR (Point-in-Time Recovery) and on-demand backups
6. **Global Tables** — Design and operation of multi-region replication


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Amazon RDS Basics](./00-rds-basics.md)

---

## 1. DynamoDB Basic Architecture

```
+----------------------------------------------------------------+
|                    DynamoDB Table                                |
|  +----------------------------------------------------------+  |
|  | Partition A (Hash: user#001)                              |  |
|  |  +------+----------+--------+--------+--------+          |  |
|  |  | PK   | SK       | name   | email  | amount |          |  |
|  |  +------+----------+--------+--------+--------+          |  |
|  |  |user  |PROFILE   | Taro   | t@e.co | -      |          |  |
|  |  |#001  |ORDER#001 | -      | -      | 1200   |          |  |
|  |  |      |ORDER#002 | -      | -      | 3400   |          |  |
|  |  +------+----------+--------+--------+--------+          |  |
|  +----------------------------------------------------------+  |
|  | Partition B (Hash: user#002)                              |  |
|  |  +------+----------+--------+--------+--------+          |  |
|  |  |user  |PROFILE   | Hanako | h@e.co | -      |          |  |
|  |  |#002  |ORDER#001 | -      | -      | 5600   |          |  |
|  |  +------+----------+--------+--------+--------+          |  |
|  +----------------------------------------------------------+  |
+----------------------------------------------------------------+
```

### How Partitioning Works

DynamoDB internally splits and stores data in 10GB partition units. Each partition is replicated across 3 AZs (Availability Zones), achieving high availability.

```
Internal Partitioning Structure:

                    DynamoDB Table
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
    Partition 0     Partition 1     Partition 2
    (Hash 0-33%)   (Hash 34-66%)  (Hash 67-100%)
      │  │  │        │  │  │        │  │  │
      ▼  ▼  ▼        ▼  ▼  ▼        ▼  ▼  ▼
     AZ-a AZ-c AZ-d  AZ-a AZ-c AZ-d  AZ-a AZ-c AZ-d
     (Redundancy with 3 replicas)

Per-partition limits:
  - Maximum 10GB of data
  - Maximum 3,000 RCU / 1,000 WCU (in provisioned mode)
  - Partition splits occur automatically (transparently)
```

### Code Example 1: Table Creation (AWS CLI)

```bash
# Create a table with single-table design
aws dynamodb create-table \
  --table-name MyApp \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=GSI1PK,AttributeType=S \
    AttributeName=GSI1SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes \
    '[{
      "IndexName": "GSI1",
      "KeySchema": [
        {"AttributeName":"GSI1PK","KeyType":"HASH"},
        {"AttributeName":"GSI1SK","KeyType":"RANGE"}
      ],
      "Projection": {"ProjectionType":"ALL"}
    }]' \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Environment,Value=production

# Check table status
aws dynamodb describe-table \
  --table-name MyApp \
  --query 'Table.{Status:TableStatus,ItemCount:ItemCount,Size:TableSizeBytes}'

# List tables
aws dynamodb list-tables --output table
```

### Code Example 2: Terraform Definition

```hcl
resource "aws_dynamodb_table" "main" {
  name         = "MyApp"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
  attribute {
    name = "GSI1PK"
    type = "S"
  }
  attribute {
    name = "GSI1SK"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  ttl {
    attribute_name = "ExpiresAt"
    enabled        = true
  }

  tags = {
    Environment = "production"
  }
}
```

### Code Example 2b: CloudFormation Definition

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: DynamoDB Single Table Design

Parameters:
  Environment:
    Type: String
    Default: production
    AllowedValues: [production, staging, development]

Resources:
  MyAppTable:
    Type: AWS::DynamoDB::Table
    DeletionPolicy: Retain
    UpdateReplacePolicy: Retain
    Properties:
      TableName: !Sub '${Environment}-MyApp'
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: PK
          AttributeType: S
        - AttributeName: SK
          AttributeType: S
        - AttributeName: GSI1PK
          AttributeType: S
        - AttributeName: GSI1SK
          AttributeType: S
        - AttributeName: GSI2PK
          AttributeType: S
        - AttributeName: GSI2SK
          AttributeType: S
      KeySchema:
        - AttributeName: PK
          KeyType: HASH
        - AttributeName: SK
          KeyType: RANGE
      GlobalSecondaryIndexes:
        - IndexName: GSI1
          KeySchema:
            - AttributeName: GSI1PK
              KeyType: HASH
            - AttributeName: GSI1SK
              KeyType: RANGE
          Projection:
            ProjectionType: ALL
        - IndexName: GSI2
          KeySchema:
            - AttributeName: GSI2PK
              KeyType: HASH
            - AttributeName: GSI2SK
              KeyType: RANGE
          Projection:
            ProjectionType: KEYS_ONLY
      PointInTimeRecoverySpecification:
        PointInTimeRecoveryEnabled: true
      SSESpecification:
        SSEEnabled: true
        SSEType: KMS
      TimeToLiveSpecification:
        AttributeName: ExpiresAt
        Enabled: true
      StreamSpecification:
        StreamViewType: NEW_AND_OLD_IMAGES
      Tags:
        - Key: Environment
          Value: !Ref Environment

Outputs:
  TableName:
    Value: !Ref MyAppTable
  TableArn:
    Value: !GetAtt MyAppTable.Arn
  StreamArn:
    Value: !GetAtt MyAppTable.StreamArn
```

### Code Example 2c: AWS CDK (TypeScript) Definition

```typescript
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class DynamoDBStack extends cdk.Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.table = new dynamodb.Table(this, 'MyAppTable', {
      tableName: 'MyApp',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'ExpiresAt',
    });

    // GSI1: Email search, status search
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI2: Date-based search
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY,
    });

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'TableName', { value: this.table.tableName });
    new cdk.CfnOutput(this, 'TableArn', { value: this.table.tableArn });
  }
}
```

---

## 2. Single-Table Design

### Table Design from Access Patterns

```
Access Pattern              PK           SK            GSI1PK        GSI1SK
---------------------------------------------------------------------------
Get user                 USER#<id>    PROFILE       EMAIL#<e>     USER#<id>
List orders (by user)    USER#<id>    ORDER#<id>    ORDER#<id>    <date>
Search orders (by status)USER#<id>    ORDER#<id>    STATUS#<s>    <date>
Get product              PROD#<id>    METADATA      CAT#<cat>     PRICE#<p>
```

### Detailed Design Process

Single-table design follows these steps.

```
Step 1: Identify entities
  - User
  - Order
  - Product
  - Category

Step 2: List access patterns
  AP-1: Get profile by user ID
  AP-2: Get all orders by user ID
  AP-3: Search user by email address
  AP-4: Search orders by status + date range
  AP-5: Search products by category + price range
  AP-6: Get order details by order ID
  AP-7: Batch retrieve user profile and latest N orders

Step 3: Design PK/SK
  - PK uses a prefix pattern of entity type + ID
  - SK is the item type or a value for sorting

Step 4: Design GSI
  - One GSI handles multiple access patterns (overloading)
  - Keep the number of GSIs to the minimum necessary

Step 5: Leverage sparse indexes
  - Items without GSI key attributes are not included in the index
  - Use this to create pre-filtered indexes
```

### Code Example 3: CRUD Operations (Python / boto3)

```python
import boto3
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')
table = dynamodb.Table('MyApp')

# === Create: Create user ===
def create_user(user_id: str, name: str, email: str):
    table.put_item(
        Item={
            'PK': f'USER#{user_id}',
            'SK': 'PROFILE',
            'GSI1PK': f'EMAIL#{email}',
            'GSI1SK': f'USER#{user_id}',
            'name': name,
            'email': email,
            'created_at': datetime.now(timezone.utc).isoformat(),
        },
        ConditionExpression='attribute_not_exists(PK)',  # Prevent duplicates
    )

# === Read: Batch retrieve user and all orders ===
def get_user_with_orders(user_id: str):
    response = table.query(
        KeyConditionExpression=Key('PK').eq(f'USER#{user_id}')
    )
    items = response['Items']
    profile = next((i for i in items if i['SK'] == 'PROFILE'), None)
    orders = [i for i in items if i['SK'].startswith('ORDER#')]
    return {'profile': profile, 'orders': orders}

# === Read: Query with pagination ===
def get_user_orders_paginated(user_id: str, page_size: int = 20, last_key: dict = None):
    params = {
        'KeyConditionExpression': (
            Key('PK').eq(f'USER#{user_id}') &
            Key('SK').begins_with('ORDER#')
        ),
        'Limit': page_size,
        'ScanIndexForward': False,  # Newest first
    }
    if last_key:
        params['ExclusiveStartKey'] = last_key

    response = table.query(**params)
    return {
        'orders': response['Items'],
        'last_key': response.get('LastEvaluatedKey'),
        'has_more': 'LastEvaluatedKey' in response,
    }

# === Update: Update user name ===
def update_user_name(user_id: str, new_name: str):
    table.update_item(
        Key={'PK': f'USER#{user_id}', 'SK': 'PROFILE'},
        UpdateExpression='SET #n = :name, updated_at = :now',
        ExpressionAttributeNames={'#n': 'name'},
        ExpressionAttributeValues={
            ':name': new_name,
            ':now': datetime.now(timezone.utc).isoformat(),
        },
        ConditionExpression='attribute_exists(PK)',
    )

# === Update: Atomic counter ===
def increment_view_count(product_id: str):
    response = table.update_item(
        Key={'PK': f'PROD#{product_id}', 'SK': 'METADATA'},
        UpdateExpression='SET view_count = if_not_exists(view_count, :zero) + :inc',
        ExpressionAttributeValues={
            ':zero': 0,
            ':inc': 1,
        },
        ReturnValues='UPDATED_NEW',
    )
    return response['Attributes']['view_count']

# === Delete: Delete order ===
def delete_order(user_id: str, order_id: str):
    table.delete_item(
        Key={'PK': f'USER#{user_id}', 'SK': f'ORDER#{order_id}'},
    )

# === Query: Search by email using GSI ===
def find_user_by_email(email: str):
    response = table.query(
        IndexName='GSI1',
        KeyConditionExpression=Key('GSI1PK').eq(f'EMAIL#{email}'),
    )
    return response['Items']

# === BatchWrite: Bulk write ===
def batch_create_products(products: list):
    with table.batch_writer() as batch:
        for product in products:
            batch.put_item(Item={
                'PK': f'PROD#{product["id"]}',
                'SK': 'METADATA',
                'GSI1PK': f'CAT#{product["category"]}',
                'GSI1SK': f'PRICE#{str(product["price"]).zfill(10)}',
                'name': product['name'],
                'price': product['price'],
                'category': product['category'],
                'created_at': datetime.now(timezone.utc).isoformat(),
            })

# === BatchGet: Bulk read ===
def batch_get_users(user_ids: list):
    response = dynamodb.batch_get_item(
        RequestItems={
            'MyApp': {
                'Keys': [
                    {'PK': {'S': f'USER#{uid}'}, 'SK': {'S': 'PROFILE'}}
                    for uid in user_ids
                ],
            }
        }
    )
    return response['Responses']['MyApp']
```

### Code Example 4: Transaction Operations

```python
def create_order_with_stock_update(user_id, order_id, product_id, qty, total):
    """Atomically create order + decrease stock"""
    client = boto3.client('dynamodb', region_name='ap-northeast-1')

    try:
        client.transact_write_items(
            TransactItems=[
                {
                    'Put': {
                        'TableName': 'MyApp',
                        'Item': {
                            'PK': {'S': f'USER#{user_id}'},
                            'SK': {'S': f'ORDER#{order_id}'},
                            'GSI1PK': {'S': f'STATUS#PENDING'},
                            'GSI1SK': {'S': datetime.now(timezone.utc).isoformat()},
                            'product_id': {'S': product_id},
                            'quantity': {'N': str(qty)},
                            'total': {'N': str(total)},
                        },
                        'ConditionExpression': 'attribute_not_exists(PK)',
                    }
                },
                {
                    'Update': {
                        'TableName': 'MyApp',
                        'Key': {
                            'PK': {'S': f'PROD#{product_id}'},
                            'SK': {'S': 'METADATA'},
                        },
                        'UpdateExpression': 'SET stock = stock - :qty',
                        'ConditionExpression': 'stock >= :qty',
                        'ExpressionAttributeValues': {
                            ':qty': {'N': str(qty)},
                        },
                    }
                },
            ]
        )
    except ClientError as e:
        if e.response['Error']['Code'] == 'TransactionCanceledException':
            reasons = e.response.get('CancellationReasons', [])
            for i, reason in enumerate(reasons):
                if reason['Code'] != 'None':
                    print(f"Transaction item {i} failed: {reason['Code']} - {reason.get('Message', '')}")
            raise
        raise


def transfer_between_accounts(from_id, to_id, amount):
    """Execute inter-account transfer with a transaction"""
    client = boto3.client('dynamodb', region_name='ap-northeast-1')

    client.transact_write_items(
        TransactItems=[
            {
                'Update': {
                    'TableName': 'MyApp',
                    'Key': {
                        'PK': {'S': f'ACCOUNT#{from_id}'},
                        'SK': {'S': 'BALANCE'},
                    },
                    'UpdateExpression': 'SET balance = balance - :amount',
                    'ConditionExpression': 'balance >= :amount',
                    'ExpressionAttributeValues': {
                        ':amount': {'N': str(amount)},
                    },
                }
            },
            {
                'Update': {
                    'TableName': 'MyApp',
                    'Key': {
                        'PK': {'S': f'ACCOUNT#{to_id}'},
                        'SK': {'S': 'BALANCE'},
                    },
                    'UpdateExpression': 'SET balance = balance + :amount',
                    'ExpressionAttributeValues': {
                        ':amount': {'N': str(amount)},
                    },
                }
            },
            {
                'Put': {
                    'TableName': 'MyApp',
                    'Item': {
                        'PK': {'S': f'TX#{datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")}'},
                        'SK': {'S': f'FROM#{from_id}#TO#{to_id}'},
                        'amount': {'N': str(amount)},
                        'timestamp': {'S': datetime.now(timezone.utc).isoformat()},
                        'status': {'S': 'COMPLETED'},
                    },
                }
            },
        ]
    )
```

---

## 3. Differences Between GSI and LSI

```
Table (PK=UserID, SK=OrderDate)
|
+--- LSI (PK=UserID, SK=OrderAmount)
|      -> Different sort within the same partition
|      -> Can only be defined at table creation time
|      -> Shares the 10GB/partition limit
|
+--- GSI (PK=ProductID, SK=OrderDate)
       -> Completely separate partition structure
       -> Can be added/removed at any time
       -> Independent capacity settings
```

### GSI vs LSI Comparison Table

| Property | GSI (Global) | LSI (Local) |
|---|---|---|
| **Partition key** | Can differ from table key | Same PK as table |
| **Sort key** | Any attribute | Different SK from table |
| **Creation timing** | Can be added/removed anytime | Only at table creation |
| **Maximum count** | 20 | 5 |
| **Consistency** | Eventually consistent only | Strong consistency available |
| **Capacity** | Independent RCU/WCU | Shared with table |
| **Size limit** | None | 10GB per partition |
| **Projection** | ALL / KEYS_ONLY / INCLUDE | ALL / KEYS_ONLY / INCLUDE |
| **Empty key values** | Sparse index supported | Sparse index supported |

### Code Example 5: GSI Overloading Pattern

```python
# Overloading a single GSI to support multiple queries
items = [
    # Search by email
    {'PK': 'USER#001', 'SK': 'PROFILE',
     'GSI1PK': 'EMAIL#taro@example.com', 'GSI1SK': 'USER#001'},
    # Search by status + date
    {'PK': 'USER#001', 'SK': 'ORDER#001',
     'GSI1PK': 'STATUS#SHIPPED', 'GSI1SK': '2026-02-11T10:00:00Z'},
    # Search by category + price
    {'PK': 'PROD#001', 'SK': 'METADATA',
     'GSI1PK': 'CAT#electronics', 'GSI1SK': 'PRICE#000029900'},
]

# Get shipped orders in descending date order
response = table.query(
    IndexName='GSI1',
    KeyConditionExpression=(
        Key('GSI1PK').eq('STATUS#SHIPPED') &
        Key('GSI1SK').between('2026-01-01', '2026-02-28')
    ),
    ScanIndexForward=False,
)
```

### Code Example 5b: Leveraging Sparse Indexes

```python
# Sparse index: Only items with GSI key attributes are included in the index
# Example: Register only "featured products" in a GSI

# Featured product (included in GSI2 because GSI2 key exists)
table.put_item(Item={
    'PK': 'PROD#001',
    'SK': 'METADATA',
    'name': 'Premium Headphones',
    'price': 29900,
    'GSI2PK': 'FEATURED',           # Included in GSI2 because this attribute exists
    'GSI2SK': 'PRICE#000029900',
})

# Regular product (not included in index because GSI2 key doesn't exist)
table.put_item(Item={
    'PK': 'PROD#002',
    'SK': 'METADATA',
    'name': 'Standard Earbuds',
    'price': 3000,
    # No GSI2PK/GSI2SK → Not included in GSI2 due to sparse index
})

# Get only featured products sorted by price (efficient index scan)
response = table.query(
    IndexName='GSI2',
    KeyConditionExpression=Key('GSI2PK').eq('FEATURED'),
    ScanIndexForward=True,  # Ascending by price
)
```

---

## 4. Capacity Modes

### On-Demand vs Provisioned Comparison Table

| Aspect | On-Demand | Provisioned |
|---|---|---|
| **Billing model** | Per request | Reserved capacity |
| **Cost (low traffic)** | Cheap | Expensive (minimum WCU/RCU) |
| **Cost (high traffic)** | Expensive (approx. 5-7x) | Cheap |
| **Spike handling** | Automatic | Auto Scaling has latency |
| **Predictability** | Low | High |
| **Recommended for** | New services, irregular access | Stable traffic |
| **Mode switching** | Can switch once per 24 hours | Can switch once per 24 hours |

```
Cost Trend Visualization
===========================

Cost
  ^
  |     On-Demand
  |    /
  |   /
  |  /  . . . . . . . . Provisioned + AutoScaling
  | / .
  |/.     Break-even point: Provisioned is advantageous when stable usage exceeds 25%
  +-------------------------> Request Volume
```

### Code Example 6: Auto Scaling Configuration

```bash
# Switch to provisioned mode
aws dynamodb update-table \
  --table-name MyApp \
  --billing-mode PROVISIONED \
  --provisioned-throughput ReadCapacityUnits=100,WriteCapacityUnits=50

# Register Auto Scaling target (read)
aws application-autoscaling register-scalable-target \
  --service-namespace dynamodb \
  --resource-id "table/MyApp" \
  --scalable-dimension "dynamodb:table:ReadCapacityUnits" \
  --min-capacity 5 \
  --max-capacity 500

# Configure Auto Scaling policy (read)
aws application-autoscaling put-scaling-policy \
  --service-namespace dynamodb \
  --resource-id "table/MyApp" \
  --scalable-dimension "dynamodb:table:ReadCapacityUnits" \
  --policy-name "MyApp-ReadAutoScaling" \
  --policy-type "TargetTrackingScaling" \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "DynamoDBReadCapacityUtilization"
    },
    "ScaleInCooldown": 60,
    "ScaleOutCooldown": 60
  }'

# Register Auto Scaling target (write)
aws application-autoscaling register-scalable-target \
  --service-namespace dynamodb \
  --resource-id "table/MyApp" \
  --scalable-dimension "dynamodb:table:WriteCapacityUnits" \
  --min-capacity 5 \
  --max-capacity 200

# Configure Auto Scaling policy (write)
aws application-autoscaling put-scaling-policy \
  --service-namespace dynamodb \
  --resource-id "table/MyApp" \
  --scalable-dimension "dynamodb:table:WriteCapacityUnits" \
  --policy-name "MyApp-WriteAutoScaling" \
  --policy-type "TargetTrackingScaling" \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "DynamoDBWriteCapacityUtilization"
    },
    "ScaleInCooldown": 60,
    "ScaleOutCooldown": 60
  }'
```

### Code Example 6b: RCU/WCU Calculation

```
RCU (Read Capacity Unit) Calculation:
===========================================

1 RCU = 1 strongly consistent read (up to 4KB)
      = 2 eventually consistent reads (up to 4KB)
      = 0.5 transactional reads (up to 4KB)

Example: Reading an 8KB item 100 times per second with eventual consistency
  Item size: 8KB → ceil(8/4) = 2 RCU/read
  Eventually consistent: 2 RCU / 2 = 1 RCU/read
  Total: 1 × 100 = 100 RCU

WCU (Write Capacity Unit) Calculation:
===========================================

1 WCU = 1 write (up to 1KB)
      = 0.5 transactional writes (up to 1KB)

Example: Writing a 3KB item 50 times per second
  Item size: 3KB → ceil(3/1) = 3 WCU/write
  Total: 3 × 50 = 150 WCU
```

---

## 5. DynamoDB Streams

### Code Example 7: DynamoDB Streams + Lambda

```python
# Lambda handler: Process change events from DynamoDB Streams
import json
import boto3
from datetime import datetime, timezone

sns_client = boto3.client('sns')
sqs_client = boto3.client('sqs')

def handler(event, context):
    for record in event['Records']:
        event_name = record['eventName']  # INSERT, MODIFY, REMOVE

        if event_name == 'INSERT':
            new_image = record['dynamodb']['NewImage']
            pk = new_image['PK']['S']
            if pk.startswith('ORDER#'):
                send_order_notification(new_image)

        elif event_name == 'MODIFY':
            old_image = record['dynamodb']['OldImage']
            new_image = record['dynamodb']['NewImage']
            old_status = old_image.get('status', {}).get('S')
            new_status = new_image.get('status', {}).get('S')
            if old_status != new_status:
                handle_status_change(old_status, new_status, new_image)

        elif event_name == 'REMOVE':
            old_image = record['dynamodb']['OldImage']
            if record.get('userIdentity', {}).get('type') == 'Service':
                # Automatic deletion by TTL
                handle_ttl_expiry(old_image)

    return {'statusCode': 200}


def send_order_notification(new_image):
    """Send new order notification to SNS"""
    order_id = new_image.get('SK', {}).get('S', '')
    user_id = new_image.get('PK', {}).get('S', '')
    total = new_image.get('total', {}).get('N', '0')

    sns_client.publish(
        TopicArn='arn:aws:sns:ap-northeast-1:123456789012:order-notifications',
        Subject=f'New Order: {order_id}',
        Message=json.dumps({
            'order_id': order_id,
            'user_id': user_id,
            'total': total,
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }),
    )


def handle_status_change(old_status, new_status, new_image):
    """Process order status changes"""
    if new_status == 'SHIPPED':
        # Send shipping notification
        send_shipping_notification(new_image)
    elif new_status == 'DELIVERED':
        # Process delivery confirmation
        process_delivery_confirmation(new_image)
    elif new_status == 'CANCELLED':
        # Process cancellation (restore stock, etc.)
        process_cancellation(new_image)
```

### Stream Configuration Options

| StreamViewType | Included Data | Use Case |
|---|---|---|
| `KEYS_ONLY` | Key attributes only | Change detection only |
| `NEW_IMAGE` | Full item after change | Aggregation, index updates |
| `OLD_IMAGE` | Full item before change | Audit logs |
| `NEW_AND_OLD_IMAGES` | Full item before and after change | Diff detection, audit logs |

```bash
# Enable DynamoDB Streams
aws dynamodb update-table \
  --table-name MyApp \
  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES

# Get Stream ARN
aws dynamodb describe-table \
  --table-name MyApp \
  --query 'Table.LatestStreamArn' \
  --output text

# Create Lambda Event Source Mapping
aws lambda create-event-source-mapping \
  --function-name process-dynamodb-stream \
  --event-source-arn arn:aws:dynamodb:ap-northeast-1:123456789012:table/MyApp/stream/2026-01-01T00:00:00.000 \
  --batch-size 100 \
  --maximum-batching-window-in-seconds 5 \
  --starting-position LATEST \
  --maximum-retry-attempts 3 \
  --bisect-batch-on-function-error \
  --destination-config '{
    "OnFailure": {
      "Destination": "arn:aws:sqs:ap-northeast-1:123456789012:dynamodb-stream-dlq"
    }
  }'
```

---

## 6. DAX (DynamoDB Accelerator)

DAX is an in-memory cache dedicated to DynamoDB that achieves microsecond-level latency.

```
DAX Architecture:

  App --> DAX Cluster --> DynamoDB
          (< 0.1ms)      (< 10ms)

  DAX Cluster:
  +------------------+
  | Primary Node     |  ← Write processing
  +------------------+
  | Read Replica 1   |  ← Read distribution
  +------------------+
  | Read Replica 2   |  ← Read distribution
  +------------------+

  Cache:
  - Item Cache: Caches GetItem/PutItem results (default 5 min)
  - Query Cache: Caches Query/Scan results (default 5 min)
  - Write-Through: Cache is also updated on writes
```

### Code Example 8: DAX Client (Python)

```python
import amazondax
import boto3

# Create DAX client (compatible with DynamoDB SDK)
dax_client = amazondax.AmazonDaxClient(
    endpoints=['dax-cluster.abcdef.dax-clusters.ap-northeast-1.amazonaws.com:8111'],
    region_name='ap-northeast-1',
)
dax_resource = boto3.resource('dynamodb', region_name='ap-northeast-1')
# Table operations via DAX
dax_table = dax_resource.Table('MyApp')

# Same interface as regular DynamoDB SDK
response = dax_table.get_item(
    Key={'PK': 'USER#001', 'SK': 'PROFILE'}
)
user = response.get('Item')

# Design that allows switching between DAX and direct DynamoDB
import os

def get_table():
    if os.environ.get('USE_DAX', 'false') == 'true':
        return dax_table
    else:
        return boto3.resource('dynamodb').Table('MyApp')
```

### DAX Limitations

| Item | Limitation |
|---|---|
| Supported operations | GetItem, Query, Scan, PutItem, UpdateItem, DeleteItem, BatchGetItem, BatchWriteItem |
| Unsupported operations | TransactWriteItems, TransactGetItems, CreateTable, UpdateTable |
| Network | Accessible only from within VPC |
| Encryption | In-transit encryption supported, at-rest not supported (encrypted on DynamoDB side) |
| Consistency | Eventually consistent only (strongly consistent reads bypass DAX) |

---

## 7. Backup and Restore

### On-Demand Backup

```bash
# Create on-demand backup
aws dynamodb create-backup \
  --table-name MyApp \
  --backup-name "MyApp-backup-$(date +%Y%m%d)"

# List backups
aws dynamodb list-backups \
  --table-name MyApp \
  --time-range-lower-bound 2026-01-01T00:00:00Z

# Restore from backup (restore to a different table name)
aws dynamodb restore-table-from-backup \
  --target-table-name MyApp-restored \
  --backup-arn arn:aws:dynamodb:ap-northeast-1:123456789012:table/MyApp/backup/01234567890123-abcdefgh
```

### PITR (Point-in-Time Recovery)

```bash
# Enable PITR
aws dynamodb update-continuous-backups \
  --table-name MyApp \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

# Check PITR status
aws dynamodb describe-continuous-backups \
  --table-name MyApp

# Restore to a specific point in time (any point within the past 35 days)
aws dynamodb restore-table-to-point-in-time \
  --source-table-name MyApp \
  --target-table-name MyApp-pitr-restore \
  --restore-date-time "2026-02-15T10:30:00Z"
```

---

## 8. Global Tables

Provides Active-Active replication across multiple regions.

```
Global Tables Architecture:

  ap-northeast-1 (Tokyo)            us-east-1 (Virginia)
  +------------------+              +------------------+
  | DynamoDB Table   | <--------->  | DynamoDB Table   |
  | (Replica)        |  Bi-direct-  | (Replica)        |
  +------------------+  ional       +------------------+
         ↑             Replication          ↑
         |                                  |
  App (Tokyo Region)               App (US Region)

  Features:
  - Replication latency under 1 second (typical)
  - Read/write available in each region (Active-Active)
  - Conflict resolution: Last Writer Wins (timestamp-based)
  - All regions require the same table configuration
```

### Code Example 9: Global Table Configuration

```bash
# Prerequisite: Source table exists in ap-northeast-1

# Add replica (replicate to us-east-1)
aws dynamodb update-table \
  --table-name MyApp \
  --replica-updates '[{
    "Create": {
      "RegionName": "us-east-1"
    }
  }]' \
  --region ap-northeast-1

# Add replica (also replicate to eu-west-1)
aws dynamodb update-table \
  --table-name MyApp \
  --replica-updates '[{
    "Create": {
      "RegionName": "eu-west-1"
    }
  }]' \
  --region ap-northeast-1

# Check replication status
aws dynamodb describe-table \
  --table-name MyApp \
  --query 'Table.Replicas' \
  --output table

# Delete replica
aws dynamodb update-table \
  --table-name MyApp \
  --replica-updates '[{
    "Delete": {
      "RegionName": "eu-west-1"
    }
  }]' \
  --region ap-northeast-1
```

---

## 9. TTL (Time to Live)

### How TTL Works and Its Applications

```
TTL Operation Flow:
=================

1. Set the ExpiresAt attribute (Unix epoch seconds) on an item
2. DynamoDB periodically scans (deletes usually within 48 hours)
3. Deleted items are recorded as REMOVE events in Streams
4. If Streams userIdentity.type is "Service", it's a TTL deletion

Usage Patterns:
- Automatic cleanup of session data
- Management of temporary tokens/OTPs
- Automatic archival of log/audit data
- Automatic expiration of cache data
```

### Code Example 10: TTL Implementation

```python
import time
from datetime import datetime, timezone, timedelta

# Session data (auto-delete after 30 minutes)
def create_session(session_id: str, user_id: str):
    expires_at = int(time.time()) + 1800  # 30 minutes later
    table.put_item(Item={
        'PK': f'SESSION#{session_id}',
        'SK': 'DATA',
        'user_id': user_id,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'ExpiresAt': expires_at,
    })

# OTP (auto-delete after 5 minutes)
def create_otp(user_id: str, otp_code: str):
    expires_at = int(time.time()) + 300  # 5 minutes later
    table.put_item(Item={
        'PK': f'OTP#{user_id}',
        'SK': f'CODE#{otp_code}',
        'ExpiresAt': expires_at,
    })

# Audit log (auto-delete after 90 days)
def write_audit_log(action: str, user_id: str, details: dict):
    expires_at = int(time.time()) + (90 * 24 * 3600)  # 90 days later
    table.put_item(Item={
        'PK': f'AUDIT#{datetime.now(timezone.utc).strftime("%Y-%m-%d")}',
        'SK': f'{datetime.now(timezone.utc).isoformat()}#{user_id}',
        'action': action,
        'user_id': user_id,
        'details': details,
        'ExpiresAt': expires_at,
    })
```

---

## 10. DynamoDB Export to S3

For analyzing large volumes of data, use DynamoDB Export to S3 and analyze with Athena.

```bash
# Export to S3 (full export)
aws dynamodb export-table-to-point-in-time \
  --table-arn arn:aws:dynamodb:ap-northeast-1:123456789012:table/MyApp \
  --s3-bucket my-dynamodb-exports \
  --s3-prefix exports/myapp/ \
  --export-format DYNAMODB_JSON \
  --export-time "2026-02-15T00:00:00Z"

# Incremental export
aws dynamodb export-table-to-point-in-time \
  --table-arn arn:aws:dynamodb:ap-northeast-1:123456789012:table/MyApp \
  --s3-bucket my-dynamodb-exports \
  --s3-prefix exports/incremental/ \
  --export-format DYNAMODB_JSON \
  --export-type INCREMENTAL_EXPORT \
  --incremental-export-specification '{
    "ExportFromTime": "2026-02-14T00:00:00Z",
    "ExportToTime": "2026-02-15T00:00:00Z",
    "ExportViewType": "NEW_AND_OLD_IMAGES"
  }'

# Check export status
aws dynamodb describe-export \
  --export-arn arn:aws:dynamodb:ap-northeast-1:123456789012:table/MyApp/export/01234567890123-abcdefgh
```

---

## 11. CloudWatch Monitoring

### Key Metrics

| Metric | Description | Recommended Alarm Threshold |
|---|---|---|
| ConsumedReadCapacityUnits | Consumed RCU | 80% of provisioned |
| ConsumedWriteCapacityUnits | Consumed WCU | 80% of provisioned |
| ThrottledRequests | Number of throttled requests | Greater than 0 |
| SystemErrors | Number of server-side errors | Greater than 0 |
| UserErrors | Number of client-side errors | On sudden increase |
| SuccessfulRequestLatency | Request latency | p99 exceeds 20ms |
| ReplicationLatency | Global table replication delay | Exceeds 1000ms |

### Code Example 11: CloudWatch Alarm Configuration

```bash
# Throttling alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "DynamoDB-MyApp-Throttle" \
  --alarm-description "DynamoDB throttling detected" \
  --metric-name ThrottledRequests \
  --namespace AWS/DynamoDB \
  --statistic Sum \
  --period 60 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --evaluation-periods 1 \
  --dimensions Name=TableName,Value=MyApp \
  --alarm-actions arn:aws:sns:ap-northeast-1:123456789012:alerts \
  --treat-missing-data notBreaching

# Latency alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "DynamoDB-MyApp-Latency" \
  --alarm-description "DynamoDB high latency detected" \
  --metric-name SuccessfulRequestLatency \
  --namespace AWS/DynamoDB \
  --statistic p99 \
  --period 300 \
  --threshold 20 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 3 \
  --dimensions Name=TableName,Value=MyApp Name=Operation,Value=Query \
  --alarm-actions arn:aws:sns:ap-northeast-1:123456789012:alerts
```

---

## Anti-Patterns

### 1. Hot Partitions

**Problem**: When access concentrates on a specific partition key (e.g., `STATUS#ACTIVE`), throttling occurs. DynamoDB distributes throughput on a per-partition basis, so skew is critical.

```
[NG] Hot Partition
PK = "STATUS#ACTIVE" --> All active users concentrate here
  --> Throttling occurs

[OK] Write Sharding
PK = "STATUS#ACTIVE#3"  (Randomly append suffix 0-9)
  --> Distributed across 10 partitions
  --> On reads, execute 10 queries in parallel and merge results
```

```python
import random

# Write Sharding implementation
SHARD_COUNT = 10

def write_with_sharding(status: str, item: dict):
    shard = random.randint(0, SHARD_COUNT - 1)
    item['GSI1PK'] = f'STATUS#{status}#{shard}'
    table.put_item(Item=item)

def query_with_sharding(status: str) -> list:
    """Query all shards in parallel and merge results"""
    import concurrent.futures

    def query_shard(shard: int):
        response = table.query(
            IndexName='GSI1',
            KeyConditionExpression=Key('GSI1PK').eq(f'STATUS#{status}#{shard}'),
        )
        return response['Items']

    with concurrent.futures.ThreadPoolExecutor(max_workers=SHARD_COUNT) as executor:
        futures = [executor.submit(query_shard, i) for i in range(SHARD_COUNT)]
        results = []
        for future in concurrent.futures.as_completed(futures):
            results.extend(future.result())

    return results
```

### 2. Overuse of Scan Operations

**Problem**: `Scan` reads the entire table, making it costly and slow. Filter expressions are applied after reading, so RCU is not saved.

**Solution**: Identify access patterns in advance and design GSIs so that all queries can be executed using `Query`. If `Scan` is unavoidable, combine parallel scans (`TotalSegments`) with the `Limit` parameter.

```python
# [NG] Scan with filter (wastes RCU)
response = table.scan(
    FilterExpression=Attr('status').eq('ACTIVE'),
)

# [OK] Parallel Scan (when unavoidable)
import concurrent.futures

def parallel_scan(total_segments: int = 4):
    def scan_segment(segment: int):
        items = []
        params = {
            'Segment': segment,
            'TotalSegments': total_segments,
            'FilterExpression': Attr('status').eq('ACTIVE'),
        }
        while True:
            response = table.scan(**params)
            items.extend(response['Items'])
            if 'LastEvaluatedKey' not in response:
                break
            params['ExclusiveStartKey'] = response['LastEvaluatedKey']
        return items

    with concurrent.futures.ThreadPoolExecutor(max_workers=total_segments) as executor:
        futures = [executor.submit(scan_segment, i) for i in range(total_segments)]
        all_items = []
        for future in concurrent.futures.as_completed(futures):
            all_items.extend(future.result())

    return all_items
```

### 3. Items That Are Too Large

**Problem**: DynamoDB has a 400KB item size limit. Attempting to force large JSON or binary data into an item will result in errors.

**Solution**: Store large data in S3 and save only metadata and the S3 key in DynamoDB.

```python
# [OK] Pattern for saving large data in S3
import boto3
import json

s3 = boto3.client('s3')

def save_large_document(doc_id: str, content: str, metadata: dict):
    # Save large content to S3
    s3.put_object(
        Bucket='my-documents-bucket',
        Key=f'documents/{doc_id}.json',
        Body=json.dumps({'content': content}),
        ContentType='application/json',
    )

    # Save metadata to DynamoDB
    table.put_item(Item={
        'PK': f'DOC#{doc_id}',
        'SK': 'METADATA',
        'title': metadata['title'],
        'author': metadata['author'],
        's3_key': f'documents/{doc_id}.json',
        's3_bucket': 'my-documents-bucket',
        'size_bytes': len(content),
        'created_at': datetime.now(timezone.utc).isoformat(),
    })
```

---

## FAQ

### Q1: Is single-table design always the right choice?

**A**: Not necessarily. Single-table design maximizes query efficiency, but multiple tables are appropriate in the following cases:
- Access patterns between entities are completely independent
- Different table permissions are needed per team
- Different capacity/backup settings are needed per table
In microservices, having separate tables per service is natural.

### Q2: How do you run aggregate queries (COUNT, SUM) in DynamoDB?

**A**: DynamoDB has no native aggregation capabilities. Use the following approaches:
1. **Maintain aggregation items**: Atomically update counter items on writes (`ADD` operation)
2. **DynamoDB Streams + Lambda**: Receive changes via streams and reflect them in an aggregation table
3. **DynamoDB Export + S3 + Athena**: Periodically export and analyze with Athena

### Q3: When should you migrate from RDS to DynamoDB?

**A**: Consider migration when the following conditions are met:
- Access patterns are clear and complex JOINs are not needed
- Millisecond-level latency is required
- Scale will expand to tens of thousands of RPS or more
- Schema changes frequently
Conversely, if complex queries, transactions, and reporting are the primary use cases, RDS is more appropriate.

### Q4: How do you optimize DynamoDB costs?

**A**: Combine the following approaches:
1. **Choose the right capacity mode**: For stable traffic, provisioned + Auto Scaling + reserved capacity can reduce costs by up to 75%
2. **Leverage TTL**: Automatically delete unnecessary data to reduce storage costs
3. **Optimize GSIs**: Remove unnecessary GSIs and limit projection types to `KEYS_ONLY` or `INCLUDE`
4. **Optimize item size**: Shorten attribute names (e.g., `created_at` -> `ca`) to save storage and RCU/WCU
5. **Use eventual consistency**: If strong consistency is not needed, use eventual consistency to halve RCU

### Q5: What are the security best practices for DynamoDB?

**A**:
1. **Encryption**: Always enable SSE (Server-Side Encryption). CMK (Customer Managed Key) via KMS is recommended
2. **IAM policies**: Implement row-level access control using Leading Key Conditions, not just table-level policies
3. **VPC endpoints**: Access via VPC endpoints without going through public IPs
4. **CloudTrail**: Log data plane operations as well
5. **Backups**: Enable PITR and take on-demand backups regularly

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowAccessToOwnItems",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:ap-northeast-1:123456789012:table/MyApp",
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:LeadingKeys": ["USER#${aws:PrincipalTag/userId}"]
        }
      }
    }
  ]
}
```

### Q6: How do you test DynamoDB?

**A**: Use DynamoDB Local for local development.

```bash
# Start DynamoDB Local (Docker)
docker run -d -p 8000:8000 amazon/dynamodb-local

# Create table locally
aws dynamodb create-table \
  --table-name MyApp \
  --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000
```

```python
# Test example with pytest
import pytest
import boto3

@pytest.fixture
def dynamodb_table():
    dynamodb = boto3.resource('dynamodb', endpoint_url='http://localhost:8000', region_name='ap-northeast-1')
    table = dynamodb.create_table(
        TableName='TestTable',
        KeySchema=[
            {'AttributeName': 'PK', 'KeyType': 'HASH'},
            {'AttributeName': 'SK', 'KeyType': 'RANGE'},
        ],
        AttributeDefinitions=[
            {'AttributeName': 'PK', 'AttributeType': 'S'},
            {'AttributeName': 'SK', 'AttributeType': 'S'},
        ],
        BillingMode='PAY_PER_REQUEST',
    )
    table.meta.client.get_waiter('table_exists').wait(TableName='TestTable')
    yield table
    table.delete()

def test_create_user(dynamodb_table):
    dynamodb_table.put_item(Item={
        'PK': 'USER#001',
        'SK': 'PROFILE',
        'name': 'Test User',
        'email': 'test@example.com',
    })
    response = dynamodb_table.get_item(Key={'PK': 'USER#001', 'SK': 'PROFILE'})
    assert response['Item']['name'] == 'Test User'
```

---

## Summary

| Item | Key Points |
|---|---|
| Data Model | Express entities with PK + SK composite keys. Single-table design is the standard |
| GSI | Supports different access patterns. Leverage overloading for multi-purpose use of a single GSI |
| LSI | Different sort within the same PK. Can only be defined at table creation |
| Capacity | On-demand for new/irregular workloads, provisioned + Auto Scaling for stable usage |
| Transactions | ACID transactions for up to 100 items with TransactWriteItems |
| Streams | Change data capture. Event-driven processing integrated with Lambda |
| TTL | Cost optimization through automatic deletion. Combine with Streams for archival |
| DAX | Microsecond-latency in-memory cache. VPC-only |
| Global Tables | Multi-region Active-Active. Conflict resolution with Last Writer Wins |
| Backup | PITR (35 days) + on-demand backups |
| Security | SSE + VPC endpoints + IAM row-level access control + CloudTrail |

## Recommended Next Guides

- [ElastiCache](./02-elasticache.md) — Compare with DAX as a front-end cache for DynamoDB
- [RDS Basics](./00-rds-basics.md) — Choosing between relational databases
- [VPC Basics](../04-networking/00-vpc-basics.md) — Configuring DynamoDB VPC endpoints

## References

1. **AWS Official Documentation**: [Amazon DynamoDB Developer Guide](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/) — API reference and best practices
2. **Alex DeBrie**: [The DynamoDB Book](https://www.dynamodbbook.com/) — The definitive guide to single-table design
3. **AWS re:Invent**: [Advanced Design Patterns for DynamoDB (DAT403)](https://www.youtube.com/watch?v=6yqfmXiZTlM) — Advanced design patterns by Rick Houlihan
4. **AWS Blog**: [Best Practices for Designing and Architecting with DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html) — Design best practices
5. **AWS Pricing**: [DynamoDB Pricing](https://aws.amazon.com/dynamodb/pricing/) — On-demand/provisioned pricing comparison

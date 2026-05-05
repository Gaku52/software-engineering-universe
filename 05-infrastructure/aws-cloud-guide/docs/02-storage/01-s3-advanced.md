# S3 Advanced

> Achieve production-level S3 operations with versioning, replication, S3 Select, and Transfer Acceleration

## What You Will Learn in This Chapter

1. Leverage versioning for data generation management and recovery from accidental deletions
2. Implement disaster recovery and low-latency access with Cross-Region Replication (CRR)
3. Implement S3 Select, Transfer Acceleration, and cost optimization strategies
4. Build event-driven architectures using S3 event notifications integrated with EventBridge
5. Handle S3 Object Lock and compliance requirements, and perform large-scale operations with Batch Operations


## Prerequisites

Before reading this guide, having the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of [S3 Basics](./00-s3-basics.md) content

---

## 1. Versioning

### 1.1 How Versioning Works

```
Object management with versioning enabled

  PUT report.pdf (v1)
  +-------------------+
  | Key: report.pdf   |
  | Version: aaa111   | <- Current version
  +-------------------+

  PUT report.pdf (v2) -> Creates a new version instead of overwriting
  +-------------------+
  | Key: report.pdf   |
  | Version: bbb222   | <- Current version
  +-------------------+
  +-------------------+
  | Key: report.pdf   |
  | Version: aaa111   | <- Previous version (retained)
  +-------------------+

  DELETE report.pdf -> Adds a delete marker (data is preserved)
  +-------------------+
  | Key: report.pdf   |
  | Delete Marker      | <- Current version
  +-------------------+
  +-------------------+
  | Key: report.pdf   |
  | Version: bbb222   | <- Recoverable
  +-------------------+
  +-------------------+
  | Key: report.pdf   |
  | Version: aaa111   | <- Recoverable
  +-------------------+
```

### 1.2 Versioning State Transitions

```
Three states of versioning
===========================

  Unversioned
      |
      | PUT Bucket Versioning: Enabled
      v
  Enabled
      |
      | PUT Bucket Versioning: Suspended
      v
  Suspended
      |
      | PUT Bucket Versioning: Enabled
      v
  Enabled (re-enabled)

* Once enabled, it cannot be reverted to Unversioned
* During Suspended, PUT saves with VersionId = "null"
* Existing versions are retained during Suspended state
```

### 1.3 Code Example: Configuring and Operating Versioning

```bash
# Enable versioning
aws s3api put-bucket-versioning \
  --bucket my-app-bucket \
  --versioning-configuration Status=Enabled

# Check versioning status
aws s3api get-bucket-versioning \
  --bucket my-app-bucket

# List versions
aws s3api list-object-versions \
  --bucket my-app-bucket \
  --prefix report.pdf \
  --query '{Versions: Versions[].[Key,VersionId,LastModified,IsLatest], DeleteMarkers: DeleteMarkers[].[Key,VersionId]}'

# Retrieve a specific version
aws s3api get-object \
  --bucket my-app-bucket \
  --key report.pdf \
  --version-id aaa111 \
  ./report-v1.pdf

# Restore by deleting the delete marker
aws s3api delete-object \
  --bucket my-app-bucket \
  --key report.pdf \
  --version-id "DELETE_MARKER_VERSION_ID"

# Permanently delete a specific version
aws s3api delete-object \
  --bucket my-app-bucket \
  --key report.pdf \
  --version-id aaa111

# Suspend versioning
aws s3api put-bucket-versioning \
  --bucket my-app-bucket \
  --versioning-configuration Status=Suspended
```

### 1.4 Code Example: Version Management in Python

```python
import boto3
from datetime import datetime, timezone

s3 = boto3.client('s3')

def list_versions(bucket, key):
    """List all versions of an object"""
    response = s3.list_object_versions(Bucket=bucket, Prefix=key)
    for version in response.get('Versions', []):
        print(f"Version: {version['VersionId']} | "
              f"Size: {version['Size']} | "
              f"Date: {version['LastModified']} | "
              f"Latest: {version['IsLatest']}")
    for marker in response.get('DeleteMarkers', []):
        print(f"Delete Marker: {marker['VersionId']} | "
              f"Date: {marker['LastModified']}")

def restore_version(bucket, key, version_id):
    """Restore a specific version (copy to make it the latest)"""
    s3.copy_object(
        Bucket=bucket,
        Key=key,
        CopySource={'Bucket': bucket, 'Key': key, 'VersionId': version_id}
    )
    print(f"Restored {key} to version {version_id}")

def delete_all_versions(bucket, key):
    """Permanently delete all versions and delete markers of an object"""
    response = s3.list_object_versions(Bucket=bucket, Prefix=key)

    # Delete versions
    for version in response.get('Versions', []):
        s3.delete_object(
            Bucket=bucket,
            Key=key,
            VersionId=version['VersionId']
        )
        print(f"Deleted version: {version['VersionId']}")

    # Delete markers
    for marker in response.get('DeleteMarkers', []):
        s3.delete_object(
            Bucket=bucket,
            Key=key,
            VersionId=marker['VersionId']
        )
        print(f"Deleted marker: {marker['VersionId']}")

def get_version_at_time(bucket, key, target_time):
    """Get the version at a specified point in time"""
    response = s3.list_object_versions(Bucket=bucket, Prefix=key)
    versions = sorted(
        response.get('Versions', []),
        key=lambda x: x['LastModified'],
        reverse=True
    )
    for v in versions:
        if v['LastModified'] <= target_time:
            return v
    return None
```

### 1.5 Code Example: Lifecycle Rules with Versioning Integration

```bash
# Transition old versions to Glacier after 90 days, delete after 365 days
aws s3api put-bucket-lifecycle-configuration \
  --bucket my-app-bucket \
  --lifecycle-configuration '{
    "Rules": [
      {
        "ID": "ManageOldVersions",
        "Status": "Enabled",
        "Filter": {"Prefix": ""},
        "NoncurrentVersionTransitions": [
          {
            "NoncurrentDays": 90,
            "StorageClass": "GLACIER"
          },
          {
            "NoncurrentDays": 180,
            "StorageClass": "DEEP_ARCHIVE"
          }
        ],
        "NoncurrentVersionExpiration": {
          "NoncurrentDays": 365,
          "NewerNoncurrentVersions": 5
        }
      },
      {
        "ID": "CleanupDeleteMarkers",
        "Status": "Enabled",
        "Filter": {"Prefix": ""},
        "Expiration": {
          "ExpiredObjectDeleteMarker": true
        }
      },
      {
        "ID": "AbortIncompleteMultipart",
        "Status": "Enabled",
        "Filter": {"Prefix": ""},
        "AbortIncompleteMultipartUpload": {
          "DaysAfterInitiation": 7
        }
      }
    ]
  }'
```

### 1.6 Code Example: Defining a Versioning-Enabled Bucket with CloudFormation

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: S3 Bucket with Versioning and Lifecycle

Resources:
  AppBucket:
    Type: AWS::S3::Bucket
    DeletionPolicy: Retain
    Properties:
      BucketName: !Sub '${AWS::StackName}-app-data'
      VersioningConfiguration:
        Status: Enabled
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: aws:kms
              KMSMasterKeyID: !Ref BucketKmsKey
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true
      LifecycleConfiguration:
        Rules:
          - Id: ManageVersions
            Status: Enabled
            NoncurrentVersionTransitions:
              - StorageClass: GLACIER
                TransitionInDays: 90
            NoncurrentVersionExpiration:
              NoncurrentDays: 365
              NewerNoncurrentVersions: 3
          - Id: CleanupIncomplete
            Status: Enabled
            AbortIncompleteMultipartUpload:
              DaysAfterInitiation: 7

  BucketKmsKey:
    Type: AWS::KMS::Key
    Properties:
      Description: KMS key for S3 bucket encryption
      EnableKeyRotation: true
      KeyPolicy:
        Version: '2012-10-17'
        Statement:
          - Sid: AllowRootAccount
            Effect: Allow
            Principal:
              AWS: !Sub 'arn:aws:iam::${AWS::AccountId}:root'
            Action: 'kms:*'
            Resource: '*'
```

---

## 2. Replication

### 2.1 Types of Replication

```
+--------------------------------------------+
| CRR (Cross-Region Replication)              |
| Source and destination in different regions  |
| -> Disaster recovery, low-latency access    |
+--------------------------------------------+

+--------------------------------------------+
| SRR (Same-Region Replication)               |
| Source and destination in the same region    |
| -> Log aggregation, data copy to test env   |
+--------------------------------------------+

  Tokyo Region                Osaka Region
  +----------------+         +------------------+
  | Source Bucket  | ------> | Destination      |
  | (ap-northeast-1)|  CRR   | Bucket           |
  | versioning: ON |         | (ap-northeast-3) |
  +----------------+         | versioning: ON   |
                             +------------------+
```

### 2.2 Detailed Replication Architecture

```
Replication operation flow
================================

  1. Object PUT -> Source bucket
  2. S3 asynchronously adds to replication queue
  3. Authenticates with IAM role and PUTs to destination
  4. Monitor status with replication metrics (CloudWatch)

  Replication targets:
  * New objects (PUT)
  * Metadata changes
  * ACL changes
  * Tag changes (when Replica modification sync is enabled)
  * Delete markers (configurable)

  Not replicated:
  x Existing objects (use S3 Batch Replication)
  x Objects encrypted with SSE-C
  x Bucket settings (lifecycle, notifications, etc.)
  x Re-replication from replicas (by default)

  Bidirectional replication:
  Source A <---> Source B
  * Enable replica modification sync and configure bidirectionally
  * Replicas are excluded from re-replication to prevent loops
```

### 2.3 Code Example: Configuring CRR

```bash
# Prerequisite: Versioning must be enabled on both buckets

# Create IAM role for replication
cat > replication-trust.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "s3.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
EOF

aws iam create-role \
  --role-name S3ReplicationRole \
  --assume-role-policy-document file://replication-trust.json

# Create IAM policy for replication
cat > replication-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetReplicationConfiguration",
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::source-bucket"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObjectVersionForReplication",
        "s3:GetObjectVersionAcl",
        "s3:GetObjectVersionTagging"
      ],
      "Resource": "arn:aws:s3:::source-bucket/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ReplicateObject",
        "s3:ReplicateDelete",
        "s3:ReplicateTags"
      ],
      "Resource": "arn:aws:s3:::destination-bucket/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt"
      ],
      "Resource": "arn:aws:kms:ap-northeast-1:123456789012:key/source-key-id",
      "Condition": {
        "StringLike": {
          "kms:ViaService": "s3.ap-northeast-1.amazonaws.com"
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": [
        "kms:Encrypt"
      ],
      "Resource": "arn:aws:kms:ap-northeast-3:123456789012:key/dest-key-id",
      "Condition": {
        "StringLike": {
          "kms:ViaService": "s3.ap-northeast-3.amazonaws.com"
        }
      }
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name S3ReplicationRole \
  --policy-name S3ReplicationPolicy \
  --policy-document file://replication-policy.json

# Configure replication rules
aws s3api put-bucket-replication \
  --bucket source-bucket \
  --replication-configuration '{
  "Role": "arn:aws:iam::123456789012:role/S3ReplicationRole",
  "Rules": [
    {
      "ID": "ReplicateAll",
      "Status": "Enabled",
      "Priority": 1,
      "Filter": {"Prefix": ""},
      "Destination": {
        "Bucket": "arn:aws:s3:::destination-bucket",
        "StorageClass": "STANDARD_IA",
        "ReplicationTime": {
          "Status": "Enabled",
          "Time": {"Minutes": 15}
        },
        "Metrics": {
          "Status": "Enabled",
          "EventThreshold": {"Minutes": 15}
        },
        "EncryptionConfiguration": {
          "ReplicaKmsKeyID": "arn:aws:kms:ap-northeast-3:123456789012:key/dest-key-id"
        }
      },
      "SourceSelectionCriteria": {
        "SseKmsEncryptedObjects": {
          "Status": "Enabled"
        }
      },
      "DeleteMarkerReplication": {"Status": "Enabled"}
    }
  ]
}'

# Check replication status
aws s3api get-bucket-replication --bucket source-bucket

# Check replication metrics (S3 Replication Time Control)
aws cloudwatch get-metric-statistics \
  --namespace AWS/S3 \
  --metric-name ReplicationLatency \
  --dimensions Name=SourceBucket,Value=source-bucket \
              Name=DestinationBucket,Value=destination-bucket \
              Name=RuleId,Value=ReplicateAll \
  --start-time 2026-02-14T00:00:00Z \
  --end-time 2026-02-15T00:00:00Z \
  --period 3600 \
  --statistics Average
```

### 2.4 Code Example: S3 Batch Replication (Replicating Existing Objects)

```bash
# Configure S3 Inventory report (input for batch replication)
aws s3api put-bucket-inventory-configuration \
  --bucket source-bucket \
  --id weekly-inventory \
  --inventory-configuration '{
    "Destination": {
      "S3BucketDestination": {
        "AccountId": "123456789012",
        "Bucket": "arn:aws:s3:::inventory-reports-bucket",
        "Format": "CSV",
        "Prefix": "inventory"
      }
    },
    "IsEnabled": true,
    "Id": "weekly-inventory",
    "IncludedObjectVersions": "All",
    "Schedule": {"Frequency": "Weekly"},
    "OptionalFields": [
      "Size", "LastModifiedDate", "StorageClass",
      "ReplicationStatus", "EncryptionStatus"
    ]
  }'

# Create batch replication job
aws s3control create-job \
  --account-id 123456789012 \
  --operation '{"S3ReplicateObject":{}}' \
  --manifest '{
    "Spec": {
      "Format": "S3InventoryReport_CSV_20211130",
      "Fields": ["Bucket","Key","VersionId"]
    },
    "Location": {
      "ObjectArn": "arn:aws:s3:::inventory-reports-bucket/inventory/source-bucket/weekly-inventory/data/manifest.json",
      "ETag": "abc123"
    }
  }' \
  --report '{
    "Bucket": "arn:aws:s3:::batch-reports-bucket",
    "Format": "Report_CSV_20180820",
    "Enabled": true,
    "Prefix": "batch-replication",
    "ReportScope": "AllTasks"
  }' \
  --priority 42 \
  --role-arn arn:aws:iam::123456789012:role/S3BatchRole \
  --confirmation-required
```

### 2.5 Replication Comparison Table

| Feature | CRR | SRR |
|------|-----|-----|
| Region | Different regions | Same region |
| Use cases | DR, low latency | Log aggregation, environment copy |
| Versioning | Required | Required |
| Existing objects | S3 Batch Replication | S3 Batch Replication |
| Delete markers | Configurable | Configurable |
| Pricing | Requests + data transfer | Requests only |
| RTC (S3 Replication Time Control) | Supported (99.99% within 15 minutes) | Supported |
| SSE-KMS encryption | Supported (different KMS keys can be specified) | Supported |
| Bidirectional replication | Supported | Supported |

---

## 3. S3 Select and Glacier Select

### 3.1 How S3 Select Works

```
Traditional approach:
  S3 ---retrieve all data---> App ---filter---> Result
  (100MB transfer)

S3 Select:
  S3 ---filter with SQL---> Transfer only results---> App
  (1MB transfer)

  -> Reduce data transfer by up to 99%
  -> Supported formats: CSV, JSON, Parquet

S3 Select SQL limitations:
  - SELECT / FROM / WHERE only (no JOIN)
  - Aggregate functions: COUNT, SUM, AVG, MIN, MAX
  - LIKE operator, BETWEEN, IN supported
  - LIMIT clause supported
  - Subqueries not supported
```

### 3.2 Code Example: S3 Select (Python)

```python
import boto3
import json

s3 = boto3.client('s3')

# Extract data matching specific conditions from a CSV file
def query_csv(bucket, key, sql):
    response = s3.select_object_content(
        Bucket=bucket,
        Key=key,
        ExpressionType='SQL',
        Expression=sql,
        InputSerialization={
            'CSV': {
                'FileHeaderInfo': 'USE',
                'RecordDelimiter': '\n',
                'FieldDelimiter': ','
            },
            'CompressionType': 'GZIP'
        },
        OutputSerialization={'JSON': {'RecordDelimiter': '\n'}}
    )

    records = []
    for event in response['Payload']:
        if 'Records' in event:
            records.append(event['Records']['Payload'].decode('utf-8'))
        elif 'Stats' in event:
            stats = event['Stats']['Details']
            print(f"Scanned: {stats['BytesScanned']} bytes, "
                  f"Processed: {stats['BytesProcessed']} bytes, "
                  f"Returned: {stats['BytesReturned']} bytes")
    return records

# Usage: Get only Tokyo data from 2024
results = query_csv(
    'analytics-bucket',
    'data/sales-2024.csv.gz',
    "SELECT s.date, s.product, s.amount FROM s3object s WHERE s.region = 'Tokyo' AND CAST(s.amount AS INT) > 10000"
)

# Query from a JSON file
response = s3.select_object_content(
    Bucket='data-bucket',
    Key='logs/events.json',
    ExpressionType='SQL',
    Expression="SELECT s.timestamp, s.level, s.message FROM s3object s WHERE s.level = 'ERROR'",
    InputSerialization={'JSON': {'Type': 'LINES'}},
    OutputSerialization={'JSON': {'RecordDelimiter': '\n'}}
)

# Query from a Parquet file (column-oriented format yields maximum benefit with column selection)
response = s3.select_object_content(
    Bucket='analytics-bucket',
    Key='data/events.parquet',
    ExpressionType='SQL',
    Expression="SELECT event_type, COUNT(*) as cnt FROM s3object s GROUP BY event_type",
    InputSerialization={'Parquet': {}},
    OutputSerialization={'JSON': {'RecordDelimiter': '\n'}}
)
```

### 3.3 Code Example: Practical S3 Select Wrapper Class

```python
import boto3
import json
from typing import List, Dict, Any, Optional

class S3SelectQuery:
    """Wrapper class for S3 Select"""

    def __init__(self, region_name='ap-northeast-1'):
        self.s3 = boto3.client('s3', region_name=region_name)

    def query_csv(
        self,
        bucket: str,
        key: str,
        sql: str,
        compression: str = 'NONE',
        delimiter: str = ',',
        header: str = 'USE'
    ) -> List[Dict[str, Any]]:
        """Execute S3 Select query against a CSV file"""
        response = self.s3.select_object_content(
            Bucket=bucket,
            Key=key,
            ExpressionType='SQL',
            Expression=sql,
            InputSerialization={
                'CSV': {
                    'FileHeaderInfo': header,
                    'RecordDelimiter': '\n',
                    'FieldDelimiter': delimiter
                },
                'CompressionType': compression
            },
            OutputSerialization={'JSON': {'RecordDelimiter': '\n'}}
        )
        return self._parse_response(response)

    def query_json(
        self,
        bucket: str,
        key: str,
        sql: str,
        json_type: str = 'LINES',
        compression: str = 'NONE'
    ) -> List[Dict[str, Any]]:
        """Execute S3 Select query against a JSON file"""
        response = self.s3.select_object_content(
            Bucket=bucket,
            Key=key,
            ExpressionType='SQL',
            Expression=sql,
            InputSerialization={
                'JSON': {'Type': json_type},
                'CompressionType': compression
            },
            OutputSerialization={'JSON': {'RecordDelimiter': '\n'}}
        )
        return self._parse_response(response)

    def query_parquet(
        self,
        bucket: str,
        key: str,
        sql: str
    ) -> List[Dict[str, Any]]:
        """Execute S3 Select query against a Parquet file"""
        response = self.s3.select_object_content(
            Bucket=bucket,
            Key=key,
            ExpressionType='SQL',
            Expression=sql,
            InputSerialization={'Parquet': {}},
            OutputSerialization={'JSON': {'RecordDelimiter': '\n'}}
        )
        return self._parse_response(response)

    def _parse_response(self, response) -> List[Dict[str, Any]]:
        """Parse response and return as a list of dictionaries"""
        records = []
        stats = {}
        for event in response['Payload']:
            if 'Records' in event:
                payload = event['Records']['Payload'].decode('utf-8')
                for line in payload.strip().split('\n'):
                    if line:
                        records.append(json.loads(line))
            elif 'Stats' in event:
                details = event['Stats']['Details']
                stats = {
                    'bytes_scanned': details['BytesScanned'],
                    'bytes_processed': details['BytesProcessed'],
                    'bytes_returned': details['BytesReturned'],
                    'compression_ratio': (
                        1 - details['BytesReturned'] / details['BytesScanned']
                    ) if details['BytesScanned'] > 0 else 0
                }
                print(f"S3 Select Stats: scanned={stats['bytes_scanned']}, "
                      f"returned={stats['bytes_returned']}, "
                      f"compression={stats['compression_ratio']:.1%}")
        return records

# Usage examples
sq = S3SelectQuery()

# Fast filtering from large CSV
errors = sq.query_csv(
    'log-bucket',
    'access-logs/2026/02/access.csv.gz',
    "SELECT s.timestamp, s.status, s.path FROM s3object s WHERE CAST(s.status AS INT) >= 500",
    compression='GZIP'
)

# Extraction from JSON Lines logs
slow_queries = sq.query_json(
    'app-logs',
    'db-logs/slow-queries.json',
    "SELECT s.query, s.duration, s.timestamp FROM s3object s WHERE s.duration > 1000"
)
```

---

## 4. Transfer Acceleration

### 4.1 How It Works

```
Standard upload:
  Client (Brazil) --Internet--> S3 (Tokyo)
  Latency: High (many hops)

Transfer Acceleration:
  Client (Brazil) --> CloudFront Edge (Sao Paulo)
                                    |
                              AWS Backbone (optimized)
                                    |
                                    v
                               S3 (Tokyo)
  Latency: Low (AWS internal network)

Effective cases:
  - Uploads from geographically distant locations
  - Large file transfers
  - Unstable internet routing

Less effective cases:
  - Access from the same region as S3
  - Small file transfers
  - Sufficient network bandwidth
```

### 4.2 Code Example: Configuring Transfer Acceleration

```bash
# Enable Transfer Acceleration
aws s3api put-bucket-accelerate-configuration \
  --bucket my-global-bucket \
  --accelerate-configuration Status=Enabled

# Verify enablement
aws s3api get-bucket-accelerate-configuration \
  --bucket my-global-bucket

# Upload using the Acceleration endpoint
aws s3 cp large-file.zip \
  s3://my-global-bucket/uploads/ \
  --endpoint-url https://my-global-bucket.s3-accelerate.amazonaws.com

# Combined with multipart upload (large files)
aws s3 cp large-dataset.tar.gz \
  s3://my-global-bucket/datasets/ \
  --endpoint-url https://my-global-bucket.s3-accelerate.amazonaws.com \
  --expected-size 10737418240

# Speed comparison tool
# https://s3-accelerate-speedtest.s3-accelerate.amazonaws.com/en/accelerate-speed-comparsion.html
```

### 4.3 Code Example: Using Transfer Acceleration in Python

```python
import boto3
from boto3.s3.transfer import TransferConfig
import time

# Use the Acceleration endpoint
s3 = boto3.client(
    's3',
    config=boto3.session.Config(s3={'use_accelerate_endpoint': True})
)

# Multipart configuration (for large files)
config = TransferConfig(
    multipart_threshold=100 * 1024 * 1024,   # 100MB
    max_concurrency=10,
    multipart_chunksize=100 * 1024 * 1024,
    use_threads=True
)

# Upload with progress callback
class ProgressTracker:
    def __init__(self, filename, filesize):
        self.filename = filename
        self.filesize = filesize
        self.uploaded = 0
        self.start_time = time.time()

    def __call__(self, bytes_amount):
        self.uploaded += bytes_amount
        percentage = (self.uploaded / self.filesize) * 100
        elapsed = time.time() - self.start_time
        speed = self.uploaded / elapsed / 1024 / 1024 if elapsed > 0 else 0
        print(f"\r{self.filename}: {percentage:.1f}% ({speed:.1f} MB/s)", end='')

import os
filepath = 'large-dataset.tar.gz'
filesize = os.path.getsize(filepath)
progress = ProgressTracker(filepath, filesize)

s3.upload_file(
    filepath,
    'my-global-bucket',
    'datasets/large-dataset.tar.gz',
    Config=config,
    Callback=progress
)
print(f"\nUpload complete in {time.time() - progress.start_time:.1f}s")
```

### 4.4 Code Example: Transfer Acceleration Speed Test

```python
import boto3
import time
import os

def benchmark_transfer(bucket, key, filepath, use_acceleration=False):
    """Compare speed between standard transfer and Acceleration transfer"""
    config_kwargs = {}
    if use_acceleration:
        config_kwargs['config'] = boto3.session.Config(
            s3={'use_accelerate_endpoint': True}
        )

    s3 = boto3.client('s3', **config_kwargs)
    filesize = os.path.getsize(filepath)

    start = time.time()
    s3.upload_file(filepath, bucket, key)
    elapsed = time.time() - start

    speed_mbps = (filesize / 1024 / 1024) / elapsed
    print(f"{'Accelerated' if use_acceleration else 'Standard'}: "
          f"{elapsed:.2f}s ({speed_mbps:.2f} MB/s)")
    return elapsed

# Run benchmark
test_file = 'test-100mb.bin'
print("Transfer speed comparison:")
standard_time = benchmark_transfer('my-bucket', 'test/std', test_file, False)
accel_time = benchmark_transfer('my-bucket', 'test/accel', test_file, True)
improvement = ((standard_time - accel_time) / standard_time) * 100
print(f"Improvement: {improvement:.1f}%")
```

---

## 5. Cost Optimization

### 5.1 Cost Optimization Checklist

```
S3 Cost Optimization Pyramid

           /\
          /  \  Delete unnecessary data
         /    \  (Lifecycle Expiration)
        /------\
       /        \  Storage class optimization
      /          \  (Intelligent-Tiering / Glacier)
     /------------\
    /              \  Request optimization
   /                \  (S3 Select, prefix design)
  /------------------\
   Transfer cost reduction
   (CloudFront, VPC Endpoints)
```

### 5.2 Detailed Storage Class Comparison Table

| Storage Class | Storage Cost (GB/month) | Retrieval Cost (GB) | Minimum Storage Duration | Retrieval Time | Availability | Use Case |
|---|---|---|---|---|---|---|
| STANDARD | $0.025 | Free | None | Immediate | 99.99% | Active data |
| INTELLIGENT_TIERING | $0.025 | Free | None | Immediate | 99.9% | Unknown access patterns |
| STANDARD_IA | $0.0138 | $0.01 | 30 days | Immediate | 99.9% | Infrequent access |
| ONE_ZONE_IA | $0.011 | $0.01 | 30 days | Immediate | 99.5% | Reproducible data |
| GLACIER_IR | $0.005 | $0.03 | 90 days | Immediate | 99.9% | Archive with instant access |
| GLACIER_FLEXIBLE | $0.0045 | $0.01-0.03 | 90 days | 1 min - 12 hours | 99.99% | Archive |
| DEEP_ARCHIVE | $0.002 | $0.02 | 180 days | 12 - 48 hours | 99.99% | Long-term storage |

* Prices are approximate estimates based on the Tokyo region

### 5.3 Code Example: Configuring Intelligent-Tiering

```bash
# Enable Intelligent-Tiering archive access tier
aws s3api put-bucket-intelligent-tiering-configuration \
  --bucket my-data-bucket \
  --id archive-config \
  --intelligent-tiering-configuration '{
    "Id": "archive-config",
    "Status": "Enabled",
    "Tierings": [
      {
        "AccessTier": "ARCHIVE_ACCESS",
        "Days": 90
      },
      {
        "AccessTier": "DEEP_ARCHIVE_ACCESS",
        "Days": 180
      }
    ],
    "Filter": {
      "Prefix": "data/"
    }
  }'

# Automatically transition to Intelligent-Tiering with lifecycle rules
aws s3api put-bucket-lifecycle-configuration \
  --bucket my-data-bucket \
  --lifecycle-configuration '{
    "Rules": [
      {
        "ID": "MoveToIT",
        "Status": "Enabled",
        "Filter": {"Prefix": "data/"},
        "Transitions": [
          {
            "Days": 0,
            "StorageClass": "INTELLIGENT_TIERING"
          }
        ]
      }
    ]
  }'
```

### 5.4 Code Example: Analyzing with S3 Storage Lens

```bash
# Create Storage Lens configuration
aws s3control put-storage-lens-configuration \
  --account-id 123456789012 \
  --config-id my-storage-lens \
  --storage-lens-configuration '{
    "Id": "my-storage-lens",
    "AccountLevel": {
      "BucketLevel": {
        "ActivityMetrics": {"IsEnabled": true},
        "AdvancedCostOptimizationMetrics": {"IsEnabled": true},
        "AdvancedDataProtectionMetrics": {"IsEnabled": true},
        "DetailedStatusCodesMetrics": {"IsEnabled": true},
        "PrefixLevel": {
          "StorageMetrics": {
            "IsEnabled": true,
            "SelectionCriteria": {
              "MaxDepth": 3,
              "MinStorageBytesPercentage": 1.0
            }
          }
        }
      }
    },
    "DataExport": {
      "S3BucketDestination": {
        "AccountId": "123456789012",
        "Arn": "arn:aws:s3:::storage-lens-reports",
        "Format": "CSV",
        "OutputSchemaVersion": "V_1",
        "Encryption": {
          "SSES3": {}
        }
      },
      "CloudWatchMetrics": {
        "IsEnabled": true
      }
    },
    "IsEnabled": true
  }'
```

### 5.5 Code Example: Reducing Data Transfer Costs with VPC Endpoints

```bash
# Gateway endpoint for S3 (free)
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-xxx \
  --service-name com.amazonaws.ap-northeast-1.s3 \
  --route-table-ids rtb-xxx \
  --vpc-endpoint-type Gateway

# Restrict access with endpoint policy
aws ec2 modify-vpc-endpoint \
  --vpc-endpoint-id vpce-xxx \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "AllowSpecificBuckets",
        "Effect": "Allow",
        "Principal": "*",
        "Action": [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ],
        "Resource": [
          "arn:aws:s3:::my-app-bucket",
          "arn:aws:s3:::my-app-bucket/*",
          "arn:aws:s3:::my-logs-bucket",
          "arn:aws:s3:::my-logs-bucket/*"
        ]
      }
    ]
  }'

# Access through the endpoint eliminates NAT Gateway charges
# -> Significantly reduces data transfer costs
```

### 5.6 Code Example: Cost Analysis Script

```python
import boto3
from datetime import datetime, timedelta

def analyze_s3_costs(bucket_name):
    """Generate a cost optimization report for an S3 bucket"""
    s3 = boto3.client('s3')
    cloudwatch = boto3.client('cloudwatch')

    # Get bucket size
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(days=1)

    size_response = cloudwatch.get_metric_statistics(
        Namespace='AWS/S3',
        MetricName='BucketSizeBytes',
        Dimensions=[
            {'Name': 'BucketName', 'Value': bucket_name},
            {'Name': 'StorageType', 'Value': 'StandardStorage'}
        ],
        StartTime=start_time,
        EndTime=end_time,
        Period=86400,
        Statistics=['Average']
    )

    # Get object count
    count_response = cloudwatch.get_metric_statistics(
        Namespace='AWS/S3',
        MetricName='NumberOfObjects',
        Dimensions=[
            {'Name': 'BucketName', 'Value': bucket_name},
            {'Name': 'StorageType', 'Value': 'AllStorageTypes'}
        ],
        StartTime=start_time,
        EndTime=end_time,
        Period=86400,
        Statistics=['Average']
    )

    # Analysis by storage class
    paginator = s3.get_paginator('list_objects_v2')
    storage_classes = {}
    total_size = 0
    for page in paginator.paginate(Bucket=bucket_name, MaxKeys=1000):
        for obj in page.get('Contents', []):
            sc = obj.get('StorageClass', 'STANDARD')
            if sc not in storage_classes:
                storage_classes[sc] = {'count': 0, 'size': 0}
            storage_classes[sc]['count'] += 1
            storage_classes[sc]['size'] += obj['Size']
            total_size += obj['Size']

    # Output report
    print(f"=== S3 Cost Analysis: {bucket_name} ===")
    print(f"Total Size: {total_size / 1024 / 1024 / 1024:.2f} GB")
    print(f"\nStorage Class Distribution:")
    for sc, info in storage_classes.items():
        pct = (info['size'] / total_size * 100) if total_size > 0 else 0
        print(f"  {sc}: {info['count']} objects, "
              f"{info['size'] / 1024 / 1024:.1f} MB ({pct:.1f}%)")

    # Recommendations
    print(f"\n=== Recommendations ===")
    std_size = storage_classes.get('STANDARD', {}).get('size', 0)
    if std_size > 100 * 1024 * 1024 * 1024:  # Over 100GB
        print("- Consider Intelligent-Tiering for large STANDARD storage")
    if 'STANDARD' in storage_classes and storage_classes['STANDARD']['count'] > 10000:
        print("- Enable S3 Inventory for detailed analysis")
    print("- Check for incomplete multipart uploads")
    print("- Review lifecycle rules for old objects")

# Execute
analyze_s3_costs('my-app-bucket')
```

---

## 6. Event Notifications

### 6.1 Event Notification Architecture

```
S3 Event Notification Destinations
====================================

                    +---> Lambda (image resize, video conversion)
                    |
S3 Event -----+--> +---> SQS (message queue)
  (ObjectCreated,  |
   ObjectRemoved,  +---> SNS (notifications -> email, SMS)
   Restore,        |
   Replication)    +---> EventBridge (advanced routing)
                           |
                           +---> Step Functions
                           +---> Lambda
                           +---> ECS Tasks
                           +---> Other AWS services

EventBridge advantages:
  - Multiple rules/targets
  - Content-based filtering
  - Archive & replay
  - Cross-account delivery
```

### 6.2 Code Example: Configuring S3 Event Notifications

```bash
# Event notification to Lambda
aws s3api put-bucket-notification-configuration \
  --bucket my-app-bucket \
  --notification-configuration '{
  "LambdaFunctionConfigurations": [
    {
      "Id": "ProcessUploadedImages",
      "LambdaFunctionArn": "arn:aws:lambda:ap-northeast-1:123456789012:function:image-processor",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {"Name": "prefix", "Value": "uploads/images/"},
            {"Name": "suffix", "Value": ".jpg"}
          ]
        }
      }
    },
    {
      "Id": "ProcessUploadedPNG",
      "LambdaFunctionArn": "arn:aws:lambda:ap-northeast-1:123456789012:function:image-processor",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {"Name": "prefix", "Value": "uploads/images/"},
            {"Name": "suffix", "Value": ".png"}
          ]
        }
      }
    }
  ],
  "QueueConfigurations": [
    {
      "Id": "LogDeletion",
      "QueueArn": "arn:aws:sqs:ap-northeast-1:123456789012:s3-deletion-queue",
      "Events": ["s3:ObjectRemoved:*"]
    }
  ],
  "EventBridgeConfiguration": {}
}'
```

### 6.3 Code Example: Event-Driven Processing with EventBridge

```python
# Lambda: Function to process S3 events
import boto3
import json
import urllib.parse

s3 = boto3.client('s3')

def handler(event, context):
    """Lambda handler for processing S3 event notifications"""

    # For S3 event notifications
    if 'Records' in event:
        for record in event['Records']:
            bucket = record['s3']['bucket']['name']
            key = urllib.parse.unquote_plus(
                record['s3']['object']['key'], encoding='utf-8'
            )
            size = record['s3']['object'].get('size', 0)
            event_name = record['eventName']

            print(f"Event: {event_name}, Bucket: {bucket}, "
                  f"Key: {key}, Size: {size}")

            if event_name.startswith('ObjectCreated:'):
                process_new_object(bucket, key, size)
            elif event_name.startswith('ObjectRemoved:'):
                handle_deletion(bucket, key)

    # Via EventBridge
    elif event.get('source') == 'aws.s3':
        detail = event['detail']
        bucket = detail['bucket']['name']
        key = detail['object']['key']
        process_new_object(bucket, key, detail['object']['size'])

    return {'statusCode': 200}

def process_new_object(bucket, key, size):
    """Process new objects"""
    if key.endswith(('.jpg', '.jpeg', '.png', '.webp')):
        # Launch image processing pipeline
        generate_thumbnails(bucket, key)
    elif key.endswith('.csv'):
        # CSV data ETL processing
        trigger_etl_job(bucket, key)
    elif key.endswith('.mp4'):
        # Video transcoding
        start_transcode_job(bucket, key)

def handle_deletion(bucket, key):
    """Handle object deletion"""
    print(f"Object deleted: s3://{bucket}/{key}")
    # CDN cache invalidation
    # Remove from search index
    # Clean up related resources
```

### 6.4 Code Example: Configuring Event Notifications with CloudFormation

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  UploadBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub '${AWS::StackName}-uploads'
      NotificationConfiguration:
        LambdaConfigurations:
          - Event: 's3:ObjectCreated:*'
            Function: !GetAtt ImageProcessorFunction.Arn
            Filter:
              S3Key:
                Rules:
                  - Name: prefix
                    Value: images/
        EventBridgeConfiguration:
          EventBridgeEnabled: true

  ImageProcessorFunction:
    Type: AWS::Serverless::Function
    Properties:
      Runtime: python3.12
      Handler: index.handler
      MemorySize: 1024
      Timeout: 300
      Policies:
        - S3ReadPolicy:
            BucketName: !Sub '${AWS::StackName}-uploads'
        - S3CrudPolicy:
            BucketName: !Sub '${AWS::StackName}-processed'

  ImageProcessorPermission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !Ref ImageProcessorFunction
      Action: lambda:InvokeFunction
      Principal: s3.amazonaws.com
      SourceArn: !GetAtt UploadBucket.Arn

  # EventBridge rule (advanced filtering)
  LargeFileRule:
    Type: AWS::Events::Rule
    Properties:
      EventPattern:
        source:
          - aws.s3
        detail-type:
          - 'Object Created'
        detail:
          bucket:
            name:
              - !Ref UploadBucket
          object:
            size:
              - numeric:
                  - '>='
                  - 104857600  # 100MB or larger
      Targets:
        - Arn: !GetAtt LargeFileProcessorFunction.Arn
          Id: LargeFileTarget
```

---

## 7. S3 Object Lock and Compliance

### 7.1 Object Lock Overview

```
S3 Object Lock Modes
=====================

Governance mode:
  - Users with special permissions (s3:BypassGovernanceRetention) can override
  - Used for test environments or when flexible retention periods are needed
  - Override permissions managed through IAM policies

Compliance mode:
  - No one can override, including the Root user
  - Used to meet regulatory requirements (FINRA, SEC, etc.)
  - Data absolutely cannot be deleted during the retention period

Legal Hold:
  - Can be set independently of the retention period
  - Toggled ON/OFF with s3:PutObjectLegalHold permission
  - Addresses legal requirements such as litigation holds
```

### 7.2 Code Example: Configuring Object Lock

```bash
# Create a bucket with Object Lock enabled (can only be set at creation time)
aws s3api create-bucket \
  --bucket compliance-bucket \
  --region ap-northeast-1 \
  --create-bucket-configuration LocationConstraint=ap-northeast-1 \
  --object-lock-enabled-for-bucket

# Default Object Lock configuration
aws s3api put-object-lock-configuration \
  --bucket compliance-bucket \
  --object-lock-configuration '{
    "ObjectLockEnabled": "Enabled",
    "Rule": {
      "DefaultRetention": {
        "Mode": "COMPLIANCE",
        "Days": 365
      }
    }
  }'

# Set Object Lock on an individual object
aws s3api put-object-retention \
  --bucket compliance-bucket \
  --key financial-reports/2025-annual.pdf \
  --retention '{
    "Mode": "COMPLIANCE",
    "RetainUntilDate": "2030-12-31T00:00:00Z"
  }'

# Set Legal Hold
aws s3api put-object-legal-hold \
  --bucket compliance-bucket \
  --key contracts/nda-2025.pdf \
  --legal-hold '{"Status": "ON"}'

# Remove Legal Hold
aws s3api put-object-legal-hold \
  --bucket compliance-bucket \
  --key contracts/nda-2025.pdf \
  --legal-hold '{"Status": "OFF"}'
```

---

## 8. S3 Batch Operations

### 8.1 Batch Operations Overview

```
S3 Batch Operations Flow
================================

  1. Create manifest
     +-- S3 Inventory report (auto-generated)
     +-- CSV file (manually created)

  2. Create job -> Specify operation
     +-- Copy objects
     +-- Change storage class
     +-- Add/remove tags
     +-- Update ACLs
     +-- Set Object Lock
     +-- S3 Batch Replication
     +-- Execute Lambda functions

  3. Execute job -> Completion report
```

### 8.2 Code Example: Batch Operations

```bash
# Bulk storage class change job
aws s3control create-job \
  --account-id 123456789012 \
  --operation '{
    "S3PutObjectCopy": {
      "TargetResource": "arn:aws:s3:::my-app-bucket",
      "StorageClass": "INTELLIGENT_TIERING",
      "MetadataDirective": "COPY"
    }
  }' \
  --manifest '{
    "Spec": {
      "Format": "S3InventoryReport_CSV_20211130",
      "Fields": ["Bucket", "Key", "VersionId"]
    },
    "Location": {
      "ObjectArn": "arn:aws:s3:::inventory-bucket/manifest.json",
      "ETag": "abc123def456"
    }
  }' \
  --report '{
    "Bucket": "arn:aws:s3:::reports-bucket",
    "Format": "Report_CSV_20180820",
    "Enabled": true,
    "Prefix": "batch-reports/storage-class-change",
    "ReportScope": "FailedTasksOnly"
  }' \
  --priority 10 \
  --role-arn arn:aws:iam::123456789012:role/S3BatchRole \
  --confirmation-required

# Bulk tag addition job
aws s3control create-job \
  --account-id 123456789012 \
  --operation '{
    "S3PutObjectTagging": {
      "TagSet": [
        {"Key": "Department", "Value": "Finance"},
        {"Key": "Classification", "Value": "Internal"}
      ]
    }
  }' \
  --manifest '{
    "Spec": {
      "Format": "S3BatchOperations_CSV_20180820",
      "Fields": ["Bucket", "Key"]
    },
    "Location": {
      "ObjectArn": "arn:aws:s3:::manifests/tag-objects.csv",
      "ETag": "xyz789"
    }
  }' \
  --report '{
    "Bucket": "arn:aws:s3:::reports-bucket",
    "Format": "Report_CSV_20180820",
    "Enabled": true,
    "ReportScope": "AllTasks"
  }' \
  --priority 20 \
  --role-arn arn:aws:iam::123456789012:role/S3BatchRole \
  --no-confirmation-required

# Check job status
aws s3control describe-job \
  --account-id 123456789012 \
  --job-id "job-id-here"

# List jobs
aws s3control list-jobs \
  --account-id 123456789012 \
  --job-statuses Active Complete
```

---

## 9. S3 Security Configuration

### 9.1 Choosing Encryption

```
S3 Encryption Method Comparison
================================

SSE-S3 (default):
  - AES-256 keys managed by Amazon
  - No additional cost
  - No key management required
  -> Recommended for general workloads

SSE-KMS:
  - Customer managed keys in AWS KMS
  - Key rotation management
  - Audit key usage with CloudTrail
  - KMS API call costs
  -> Recommended when compliance requirements exist

SSE-C:
  - Customer-provided encryption keys
  - AWS does not store the key
  - Key must be sent with each request
  -> When custom key management is required

Client-side encryption:
  - Encrypt on the application side before PUTting to S3
  - AWS is not involved in encryption at all
  -> Highest level security requirements
```

### 9.2 Code Example: Strengthening Bucket Policy Security

```bash
# Enforce HTTPS + VPC endpoint restriction + encryption enforcement
aws s3api put-bucket-policy --bucket secure-bucket --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ForceHTTPS",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::secure-bucket",
        "arn:aws:s3:::secure-bucket/*"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    },
    {
      "Sid": "RestrictToVPC",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::secure-bucket",
        "arn:aws:s3:::secure-bucket/*"
      ],
      "Condition": {
        "StringNotEquals": {
          "aws:SourceVpce": "vpce-xxxxxxxx"
        }
      }
    },
    {
      "Sid": "ForceSSEKMS",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::secure-bucket/*",
      "Condition": {
        "StringNotEquals": {
          "s3:x-amz-server-side-encryption": "aws:kms"
        }
      }
    },
    {
      "Sid": "DenyUnencryptedTransport",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::secure-bucket/*",
      "Condition": {
        "Null": {
          "s3:x-amz-server-side-encryption": "true"
        }
      }
    }
  ]
}'

# Create S3 Access Point (simplify access control)
aws s3control create-access-point \
  --account-id 123456789012 \
  --name app-readonly-ap \
  --bucket secure-bucket \
  --vpc-configuration VpcId=vpc-xxx \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

### 9.3 Code Example: S3 Access Analyzer

```bash
# Detect external access with IAM Access Analyzer
aws accessanalyzer create-analyzer \
  --analyzer-name s3-analyzer \
  --type ACCOUNT

# Review findings
aws accessanalyzer list-findings \
  --analyzer-arn arn:aws:access-analyzer:ap-northeast-1:123456789012:analyzer/s3-analyzer \
  --filter '{
    "resourceType": {
      "eq": ["AWS::S3::Bucket"]
    },
    "status": {
      "eq": ["ACTIVE"]
    }
  }'
```

---

## 10. Prefix Design and Performance

### 10.1 S3 Performance Characteristics

```
S3 Performance Limits (per prefix)
=============================================

  Read: 5,500 GET/HEAD requests/second
  Write: 3,500 PUT/POST/DELETE requests/second

  Prefix examples:
    s3://bucket/images/   -> One prefix
    s3://bucket/videos/   -> Another prefix

  Increase throughput with parallel prefixes:
    s3://bucket/images/2026/02/15/aa/
    s3://bucket/images/2026/02/15/ab/
    ...
    -> Number of prefixes x 5,500 GET/sec

  * Previously, random prefixes were recommended, but
    since the 2018 improvement, date-based prefixes
    are also automatically partitioned
```

### 10.2 Code Example: High-Throughput S3 Access

```python
import boto3
from concurrent.futures import ThreadPoolExecutor, as_completed
import os

s3 = boto3.client('s3')

def parallel_upload(bucket, prefix, file_list, max_workers=20):
    """Achieve high throughput with parallel uploads"""
    results = []

    def upload_one(filepath):
        key = f"{prefix}/{os.path.basename(filepath)}"
        s3.upload_file(filepath, bucket, key)
        return {'file': filepath, 'key': key, 'status': 'success'}

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(upload_one, f): f for f in file_list
        }
        for future in as_completed(futures):
            try:
                result = future.result()
                results.append(result)
            except Exception as e:
                results.append({
                    'file': futures[future],
                    'status': 'error',
                    'error': str(e)
                })

    success = sum(1 for r in results if r['status'] == 'success')
    print(f"Uploaded {success}/{len(file_list)} files")
    return results

def parallel_download(bucket, prefix, dest_dir, max_workers=20):
    """Achieve high throughput with parallel downloads"""
    paginator = s3.get_paginator('list_objects_v2')
    keys = []
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get('Contents', []):
            keys.append(obj['Key'])

    os.makedirs(dest_dir, exist_ok=True)

    def download_one(key):
        local_path = os.path.join(dest_dir, os.path.basename(key))
        s3.download_file(bucket, key, local_path)
        return {'key': key, 'local': local_path, 'status': 'success'}

    results = []
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(download_one, k): k for k in keys
        }
        for future in as_completed(futures):
            try:
                results.append(future.result())
            except Exception as e:
                results.append({
                    'key': futures[future],
                    'status': 'error',
                    'error': str(e)
                })

    success = sum(1 for r in results if r['status'] == 'success')
    print(f"Downloaded {success}/{len(keys)} files")
    return results
```

---

## 11. Integration with Other Services

### 11.1 Integration with Athena

```bash
# Query data on S3 with Athena
aws athena start-query-execution \
  --query-string "
    CREATE EXTERNAL TABLE IF NOT EXISTS access_logs (
      request_time string,
      remote_ip string,
      request_method string,
      request_path string,
      status_code int,
      bytes_sent bigint,
      user_agent string
    )
    ROW FORMAT SERDE 'org.apache.hadoop.hive.serde2.RegexSerDe'
    WITH SERDEPROPERTIES (
      'input.regex' = '([^ ]*) ([^ ]*) ([^ ]*) ([^ ]*) ([0-9]*) ([0-9]*) (.*)$'
    )
    LOCATION 's3://my-logs-bucket/access-logs/'
  " \
  --result-configuration OutputLocation=s3://athena-results/
```

### 11.2 S3 Bucket Definition with AWS CDK

```typescript
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class S3AdvancedStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Main bucket (versioning + lifecycle)
    const mainBucket = new s3.Bucket(this, 'MainBucket', {
      bucketName: `${this.stackName}-main-data`,
      versioned: true,
      encryption: s3.BucketEncryption.KMS_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'TransitionToIA',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(60),
            },
          ],
          noncurrentVersionTransitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
          noncurrentVersionExpiration: cdk.Duration.days(365),
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
      intelligentTieringConfigurations: [
        {
          name: 'archive-config',
          archiveAccessTierTime: cdk.Duration.days(90),
          deepArchiveAccessTierTime: cdk.Duration.days(180),
        },
      ],
    });

    // DR replica bucket
    const replicaBucket = new s3.Bucket(this, 'ReplicaBucket', {
      bucketName: `${this.stackName}-replica`,
      versioned: true,
      encryption: s3.BucketEncryption.KMS_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });

    // Event notification: Execute Lambda on image upload
    const imageProcessor = new lambda.Function(this, 'ImageProcessor', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/image-processor'),
      memorySize: 1024,
      timeout: cdk.Duration.minutes(5),
    });

    mainBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(imageProcessor),
      { prefix: 'uploads/images/', suffix: '.jpg' }
    );

    mainBucket.grantRead(imageProcessor);

    // S3 Access Point
    new s3.CfnAccessPoint(this, 'ReadOnlyAccessPoint', {
      bucket: mainBucket.bucketName,
      name: 'readonly-ap',
      vpcConfiguration: {
        vpcId: 'vpc-xxx',
      },
      publicAccessBlockConfiguration: {
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true,
      },
    });
  }
}
```

---

## 12. Anti-Patterns

### Anti-Pattern 1: Not Setting Lifecycle Rules After Enabling Versioning

When versioning is enabled, all versions are retained, causing storage costs to grow without limit. You should always configure NoncurrentVersionExpiration.

```json
{
  "Rules": [{
    "ID": "ExpireOldVersions",
    "Status": "Enabled",
    "Filter": {"Prefix": ""},
    "NoncurrentVersionTransitions": [
      {"NoncurrentDays": 30, "StorageClass": "STANDARD_IA"},
      {"NoncurrentDays": 90, "StorageClass": "GLACIER"}
    ],
    "NoncurrentVersionExpiration": {
      "NoncurrentDays": 365,
      "NewerNoncurrentVersions": 3
    }
  }]
}
```

### Anti-Pattern 2: Using S3 Like a Database

S3 is an object storage service and is not suitable for random access or transaction processing. Use DynamoDB or RDS for data that requires frequent updates.

```
# Bad example
Store JSON files in S3 and update every second
-> Eventual consistency issues, high PUT request costs

# Good example
Real-time data -> DynamoDB
Aggregated results/reports -> S3
Log data -> S3 (append-only)
```

### Anti-Pattern 3: Leaving Public Buckets Unmanaged

Leaving public access enabled on S3 buckets creates a risk of data leakage. Always enable Block Public Access.

```bash
# Block public access at the account level
aws s3control put-public-access-block \
  --account-id 123456789012 \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

### Anti-Pattern 4: Uploading Large Numbers of Small Objects Individually

When millions of small files (under 1KB) are PUT individually, request costs can significantly exceed storage costs.

```
# Bad example
1 million files x 1KB = 1GB (storage: ~$0.025)
1 million PUT requests = $5.00 (request costs are 200x higher)

# Good example
Bundle small files into a tarball before PUTting to S3
Use S3 Select or Athena on the application side for individual access
```

---

## 13. FAQ

### Q1. What are S3 Batch Operations?

A service that performs bulk operations on large numbers of objects (up to billions). Capabilities include bulk storage class changes, tag additions, ACL updates, and Lambda function execution. S3 Inventory reports are used as input.

### Q2. What is the difference between S3 Object Lock and Glacier Vault Lock?

S3 Object Lock prevents deletion and overwriting of objects using the WORM (Write Once Read Many) model. There are Governance mode (privileged users can override) and Compliance mode (no one can override). Glacier Vault Lock provides similar functionality specifically for Glacier. Choose based on compliance requirements.

### Q3. What is a Requester Pays bucket?

Normally the bucket owner pays data transfer costs, but with Requester Pays enabled, the requester bears the costs. This is used for large public datasets (such as genome data).

### Q4. What are the best practices for S3 multipart uploads?

Use multipart uploads for files over 100MB. Part size ranges from 5MB to 5GB, with a maximum of 10,000 parts. Failed parts can be retried, and parallel uploads achieve high throughput. Use the AbortIncompleteMultipartUpload lifecycle rule to automatically clean up incomplete uploads.

### Q5. What happened to S3's consistency model?

Since December 2020, S3 provides strong read-after-write consistency for all operations (including PUT, DELETE, and LIST). In all cases -- GET immediately after a new PUT, LIST immediately after a DELETE -- the latest data is returned. This is provided at no additional cost and with no performance impact.

### Q6. What is S3 Express One Zone?

A high-performance storage class announced in 2023. It is placed in a single AZ and provides single-digit millisecond latency. It uses a new bucket type called directory buckets and is compatible with standard S3 APIs. It is suitable for ML training data, real-time analytics, and HPC workloads.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how things work.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next steps.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 14. Summary

| Item | Key Points |
|------|---------|
| Versioning | Prevents accidental deletion; manage old versions with lifecycle expiration |
| CRR / SRR | Disaster recovery & low latency / Log aggregation & environment copy |
| S3 Select | Filter with SQL to reduce transfer volume by up to 99% |
| Transfer Acceleration | Speed up global uploads via CloudFront Edge locations |
| Cost Optimization | Intelligent-Tiering + Lifecycle + VPC Endpoints |
| Event Notifications | Integrate with Lambda/SQS/SNS/EventBridge |
| Object Lock | WORM model for compliance requirements |
| Batch Operations | Bulk processing of billions of objects |
| Security | Block Public Access + SSE-KMS + VPC Endpoints + Bucket Policies |
| Performance | Prefix design + parallel access + multipart uploads |

---

## Recommended Next Reads

- [02-cloudfront.md](./02-cloudfront.md) -- CloudFront CDN configuration
- [../03-database/00-rds-basics.md](../03-database/00-rds-basics.md) -- RDS basics

---

## References

1. S3 Versioning -- https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html
2. S3 Replication -- https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication.html
3. S3 Select User Guide -- https://docs.aws.amazon.com/AmazonS3/latest/userguide/selecting-content-from-objects.html
4. S3 Transfer Acceleration -- https://docs.aws.amazon.com/AmazonS3/latest/userguide/transfer-acceleration.html
5. S3 Object Lock -- https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html
6. S3 Batch Operations -- https://docs.aws.amazon.com/AmazonS3/latest/userguide/batch-ops.html
7. S3 Security Best Practices -- https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html
8. S3 Storage Lens -- https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage_lens.html

# S3 Basics

> Fundamental concepts of AWS object storage S3 — Buckets, objects, access control, lifecycle, and static hosting

## What You Will Learn in This Chapter

1. Understand S3 bucket and object concepts and perform basic CRUD operations
2. Design appropriate access control using bucket policies, ACLs, and public access block
3. Configure cost optimization with lifecycle rules and static website hosting
4. Understand storage class characteristics and choose appropriately based on use cases
5. Master server-side encryption and data protection implementation methods
6. Leverage S3 event notifications and metrics for operational monitoring


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts

---

## 1. What is S3?

Amazon Simple Storage Service (S3) is an object storage service with 99.999999999% (eleven nines) durability. Since its launch in 2006, it has been a core AWS service, storing trillions of objects and processing millions of requests per second.

### 1.1 S3 Basic Structure

```
S3 Data Model

  +------------------------------------------+
  |  AWS Account                              |
  |                                           |
  |  +------------------------------------+   |
  |  |  Bucket: my-app-images             |   |
  |  |  (Globally unique name)              |   |
  |  |                                    |   |
  |  |  +------------------------------+  |   |
  |  |  | Object                       |  |   |
  |  |  | Key: photos/2024/cat.jpg     |  |   |
  |  |  | Value: (binary data)          |  |   |
  |  |  | Metadata: Content-Type, etc.  |  |   |
  |  |  | Size: up to 5TB              |  |   |
  |  |  +------------------------------+  |   |
  |  |                                    |   |
  |  |  +------------------------------+  |   |
  |  |  | Object                       |  |   |
  |  |  | Key: docs/report.pdf         |  |   |
  |  |  +------------------------------+  |   |
  |  +------------------------------------+   |
  +------------------------------------------+

  * S3 has no concept of directories
    "photos/2024/cat.jpg" is a flat key name
    The console displays prefixes as folders
```

### 1.2 Key Characteristics of S3

```
+--------------------------------------------------+
|          Key Characteristics of S3                 |
+--------------------------------------------------+
| Durability:  99.999999999% (11 nines)             |
| Availability:  99.99% (Standard)                  |
| Capacity:    Unlimited (up to 5TB per object)     |
| Consistency:  Strong read consistency (Dec 2020~) |
| Encryption:  Server-side/Client-side supported    |
| Versioning: All versions retained per object      |
| Region: Buckets are created in a specific region  |
| Scaling: Auto-scaling, no provisioning required   |
+--------------------------------------------------+
```

### 1.3 S3 Consistency Model

Since December 2020, S3 provides Strong Read-After-Write Consistency. This means that GET requests immediately after PUT/DELETE return the latest data.

```
S3 Consistency Model (Since December 2020)

  PUT Object (new creation)
    -> Subsequent GET returns the new object ✓

  PUT Object (overwrite)
    -> Subsequent GET returns the updated data ✓

  DELETE Object
    -> Subsequent GET returns 404 ✓

  LIST Objects
    -> LIST reflects changes immediately after PUT/DELETE ✓

  * The previous "eventual consistency" issue has been resolved
  * No impact on performance
```

### 1.4 S3 Request Processing and Performance

S3 can process 3,500 PUT/COPY/POST/DELETE requests and 5,500 GET/HEAD requests per second per prefix.

```
Performance Considerations

  ■ Prefix Distribution (Performance Optimization)

  Bad example: All keys share the same prefix
    logs/2024-01-01.json
    logs/2024-01-02.json
    logs/2024-01-03.json
    -> Load concentrated on the logs/ prefix

  Good example: Distribute with hash prefixes
    a1b2/logs/2024-01-01.json
    c3d4/logs/2024-01-02.json
    e5f6/logs/2024-01-03.json
    -> Distributed across different partitions

  * Current S3 internally auto-optimizes partitions based on
    key names, so this countermeasure is often unnecessary
    (due to performance improvements since 2018)
```

---

## 2. Bucket and Object Operations

### 2.1 Bucket Naming Rules

```
Bucket Name Rules
├── Length: 3-63 characters
├── Allowed characters: lowercase letters, numbers, hyphens
├── Start: lowercase letter or number
├── Period: allowed but causes SSL issues (not recommended)
├── Uniqueness: globally unique (shared across all AWS accounts)
└── Reserved names: "xn--" prefix not allowed

Naming Best Practices
├── {company}-{environment}-{purpose}-{region}
│   Example: acme-prod-assets-ap-northeast-1
├── {project}-{environment}-{service}
│   Example: myapp-staging-uploads
└── Names to avoid
    ├── Generic names (data, backup, files)
    ├── Names containing personal information
    └── Names containing AWS account IDs
```

### 2.2 Basic Operations with AWS CLI

```bash
# Create a bucket
aws s3 mb s3://my-app-bucket-2024 --region ap-northeast-1

# List buckets
aws s3 ls

# Upload a file
aws s3 cp ./index.html s3://my-app-bucket-2024/
aws s3 cp ./images/ s3://my-app-bucket-2024/images/ --recursive

# Upload with Content-Type specified
aws s3 cp ./data.json s3://my-app-bucket-2024/data/ \
  --content-type "application/json" \
  --content-encoding "utf-8"

# Upload with metadata
aws s3 cp ./report.pdf s3://my-app-bucket-2024/reports/ \
  --metadata '{"author":"tanaka","version":"2.0"}'

# Sync files (transfer only differences)
aws s3 sync ./dist/ s3://my-app-bucket-2024/ --delete

# Sync excluding specific files
aws s3 sync ./dist/ s3://my-app-bucket-2024/ \
  --exclude "*.log" \
  --exclude ".git/*" \
  --exclude "node_modules/*" \
  --delete

# Dry run (does not actually copy)
aws s3 sync ./dist/ s3://my-app-bucket-2024/ --dryrun

# Download a file
aws s3 cp s3://my-app-bucket-2024/report.pdf ./
aws s3 cp s3://my-app-bucket-2024/images/ ./local-images/ --recursive

# List objects
aws s3 ls s3://my-app-bucket-2024/
aws s3 ls s3://my-app-bucket-2024/ --recursive --summarize
aws s3 ls s3://my-app-bucket-2024/ --recursive --human-readable --summarize

# List objects under a specific prefix
aws s3 ls s3://my-app-bucket-2024/logs/2024/01/

# Delete an object
aws s3 rm s3://my-app-bucket-2024/old-file.txt
aws s3 rm s3://my-app-bucket-2024/temp/ --recursive

# Delete a bucket (only if empty)
aws s3 rb s3://my-app-bucket-2024

# Force delete a bucket (including contents)
aws s3 rb s3://my-app-bucket-2024 --force

# Check object metadata
aws s3api head-object --bucket my-app-bucket-2024 --key report.pdf

# Generate a presigned URL (valid for 1 hour)
aws s3 presign s3://my-app-bucket-2024/private/report.pdf --expires-in 3600
```

### 2.3 Detailed Operations with s3api Commands

```bash
# Create a bucket (s3api is a low-level API)
aws s3api create-bucket \
  --bucket my-app-bucket-2024 \
  --region ap-northeast-1 \
  --create-bucket-configuration LocationConstraint=ap-northeast-1

# Upload an object (with detailed parameters)
aws s3api put-object \
  --bucket my-app-bucket-2024 \
  --key config/settings.json \
  --body ./settings.json \
  --content-type "application/json" \
  --server-side-encryption AES256 \
  --metadata '{"environment":"production"}' \
  --tagging "project=myapp&env=prod"

# Get an object
aws s3api get-object \
  --bucket my-app-bucket-2024 \
  --key config/settings.json \
  ./downloaded-settings.json

# Conditional get (skip download if not modified)
aws s3api get-object \
  --bucket my-app-bucket-2024 \
  --key config/settings.json \
  --if-modified-since "2024-01-01T00:00:00Z" \
  ./downloaded-settings.json

# Set object tags
aws s3api put-object-tagging \
  --bucket my-app-bucket-2024 \
  --key reports/monthly.pdf \
  --tagging '{
    "TagSet": [
      {"Key": "department", "Value": "finance"},
      {"Key": "classification", "Value": "confidential"}
    ]
  }'

# Get tags
aws s3api get-object-tagging \
  --bucket my-app-bucket-2024 \
  --key reports/monthly.pdf

# List objects (with pagination, up to 1000 at a time)
aws s3api list-objects-v2 \
  --bucket my-app-bucket-2024 \
  --prefix logs/ \
  --max-keys 100

# Get the next page (using ContinuationToken)
aws s3api list-objects-v2 \
  --bucket my-app-bucket-2024 \
  --prefix logs/ \
  --continuation-token "TOKEN_FROM_PREVIOUS_RESPONSE"

# Check bucket region
aws s3api get-bucket-location --bucket my-app-bucket-2024
```

### 2.4 Operations with Python (boto3)

```python
import boto3
import json
import os
from botocore.exceptions import ClientError
from datetime import datetime

# Create S3 client
s3_client = boto3.client('s3', region_name='ap-northeast-1')
s3_resource = boto3.resource('s3', region_name='ap-northeast-1')

# ===========================================
# Bucket Operations
# ===========================================

# Create a bucket
def create_bucket(bucket_name: str, region: str = 'ap-northeast-1') -> bool:
    """Create an S3 bucket"""
    try:
        s3_client.create_bucket(
            Bucket=bucket_name,
            CreateBucketConfiguration={'LocationConstraint': region}
        )
        print(f"Bucket '{bucket_name}' created")
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == 'BucketAlreadyOwnedByYou':
            print(f"Bucket '{bucket_name}' already exists")
            return True
        print(f"Error: {e}")
        return False

# List buckets
def list_buckets() -> list:
    """Get a list of all buckets"""
    response = s3_client.list_buckets()
    buckets = []
    for bucket in response['Buckets']:
        buckets.append({
            'name': bucket['Name'],
            'created': bucket['CreationDate'].isoformat()
        })
    return buckets

# ===========================================
# File Upload
# ===========================================

# Basic file upload
def upload_file(file_path: str, bucket: str, key: str,
                content_type: str = None, metadata: dict = None) -> bool:
    """Upload a file to S3"""
    extra_args = {
        'ServerSideEncryption': 'AES256',
    }
    if content_type:
        extra_args['ContentType'] = content_type
    if metadata:
        extra_args['Metadata'] = metadata

    try:
        s3_client.upload_file(
            Filename=file_path,
            Bucket=bucket,
            Key=key,
            ExtraArgs=extra_args
        )
        print(f"Upload complete: {key}")
        return True
    except ClientError as e:
        print(f"Upload error: {e}")
        return False

# Write JSON data directly
def put_json(bucket: str, key: str, data: dict) -> bool:
    """Write JSON data directly to S3"""
    try:
        s3_client.put_object(
            Bucket=bucket,
            Key=key,
            Body=json.dumps(data, ensure_ascii=False, indent=2),
            ContentType='application/json; charset=utf-8',
            ServerSideEncryption='AES256'
        )
        return True
    except ClientError as e:
        print(f"Write error: {e}")
        return False

# Upload binary data
def upload_with_progress(file_path: str, bucket: str, key: str) -> bool:
    """Upload with a progress bar"""
    file_size = os.path.getsize(file_path)
    uploaded = 0

    def progress_callback(bytes_transferred):
        nonlocal uploaded
        uploaded += bytes_transferred
        percentage = (uploaded / file_size) * 100
        print(f"\rProgress: {percentage:.1f}% ({uploaded}/{file_size} bytes)", end='')

    try:
        s3_client.upload_file(
            file_path, bucket, key,
            Callback=progress_callback,
            ExtraArgs={'ServerSideEncryption': 'AES256'}
        )
        print(f"\nComplete: {key}")
        return True
    except ClientError as e:
        print(f"\nError: {e}")
        return False

# ===========================================
# File Download
# ===========================================

def download_file(bucket: str, key: str, local_path: str) -> bool:
    """Download a file from S3"""
    try:
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        s3_client.download_file(bucket, key, local_path)
        print(f"Download complete: {local_path}")
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == '404':
            print(f"Object not found: {key}")
        else:
            print(f"Error: {e}")
        return False

def get_json(bucket: str, key: str) -> dict:
    """Read JSON from S3"""
    try:
        response = s3_client.get_object(Bucket=bucket, Key=key)
        content = response['Body'].read().decode('utf-8')
        return json.loads(content)
    except ClientError as e:
        print(f"Read error: {e}")
        return None

# ===========================================
# Object Listing (with Pagination)
# ===========================================

def list_objects(bucket: str, prefix: str = '',
                max_keys: int = None) -> list:
    """Get object list (automatic pagination handling)"""
    paginator = s3_client.get_paginator('list_objects_v2')
    params = {'Bucket': bucket, 'Prefix': prefix}

    objects = []
    for page in paginator.paginate(**params):
        for obj in page.get('Contents', []):
            objects.append({
                'key': obj['Key'],
                'size': obj['Size'],
                'last_modified': obj['LastModified'].isoformat(),
                'storage_class': obj.get('StorageClass', 'STANDARD')
            })
            if max_keys and len(objects) >= max_keys:
                return objects
    return objects

def get_total_size(bucket: str, prefix: str = '') -> dict:
    """Calculate total size and object count under a specific prefix"""
    paginator = s3_client.get_paginator('list_objects_v2')
    total_size = 0
    total_count = 0

    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get('Contents', []):
            total_size += obj['Size']
            total_count += 1

    return {
        'total_size_bytes': total_size,
        'total_size_mb': round(total_size / (1024 * 1024), 2),
        'total_size_gb': round(total_size / (1024 * 1024 * 1024), 4),
        'total_count': total_count
    }

# ===========================================
# Object Existence Check and Info Retrieval
# ===========================================

def object_exists(bucket: str, key: str) -> bool:
    """Check if an object exists"""
    try:
        s3_client.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == '404':
            return False
        raise

def get_object_info(bucket: str, key: str) -> dict:
    """Get object metadata"""
    try:
        response = s3_client.head_object(Bucket=bucket, Key=key)
        return {
            'content_type': response['ContentType'],
            'content_length': response['ContentLength'],
            'last_modified': response['LastModified'].isoformat(),
            'etag': response['ETag'],
            'metadata': response.get('Metadata', {}),
            'server_side_encryption': response.get('ServerSideEncryption'),
            'storage_class': response.get('StorageClass', 'STANDARD')
        }
    except ClientError as e:
        print(f"Info retrieval error: {e}")
        return None

# ===========================================
# Usage Example
# ===========================================

if __name__ == '__main__':
    BUCKET = 'my-app-bucket-2024'

    # Create bucket
    create_bucket(BUCKET)

    # Save JSON data
    config = {
        'app_name': 'MyApp',
        'version': '2.0',
        'features': {'dark_mode': True, 'notifications': True}
    }
    put_json(BUCKET, 'config/app-settings.json', config)

    # Read
    loaded = get_json(BUCKET, 'config/app-settings.json')
    print(f"Loaded settings: {loaded}")

    # Object list
    objects = list_objects(BUCKET, prefix='config/')
    for obj in objects:
        print(f"  {obj['key']} ({obj['size']} bytes)")

    # Total size
    stats = get_total_size(BUCKET)
    print(f"Total: {stats['total_count']} files, {stats['total_size_mb']} MB")
```

### 2.5 Operations with JavaScript (SDK v3)

```javascript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';

const s3 = new S3Client({ region: 'ap-northeast-1' });

// ====================================
// File Upload
// ====================================

/** Upload a small file */
async function uploadFile(bucket, key, filePath, contentType) {
  const body = await readFile(filePath);
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType || 'application/octet-stream',
    ServerSideEncryption: 'AES256',
  }));
  console.log(`Upload complete: ${key}`);
}

/** Write JSON data directly */
async function putJson(bucket, key, data) {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json; charset=utf-8',
    ServerSideEncryption: 'AES256',
  }));
}

/** Multipart upload for large files (with progress) */
async function uploadLargeFile(bucket, key, filePath) {
  const stream = createReadStream(filePath);

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: bucket,
      Key: key,
      Body: stream,
      ServerSideEncryption: 'AES256',
    },
    // 5MB part size (minimum)
    partSize: 5 * 1024 * 1024,
    // Number of concurrent uploads
    queueSize: 4,
  });

  upload.on('httpUploadProgress', (progress) => {
    const percentage = ((progress.loaded / progress.total) * 100).toFixed(1);
    process.stdout.write(`\rProgress: ${percentage}%`);
  });

  await upload.done();
  console.log(`\nComplete: ${key}`);
}

// ====================================
// File Download
// ====================================

/** Download a file */
async function downloadFile(bucket, key, localPath) {
  const response = await s3.send(new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  }));

  // Create directory
  await mkdir(path.dirname(localPath), { recursive: true });

  // Save via stream
  const writeStream = createWriteStream(localPath);
  await pipeline(response.Body, writeStream);
  console.log(`Download complete: ${localPath}`);
}

/** Read JSON */
async function getJson(bucket, key) {
  const response = await s3.send(new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  }));
  const body = await response.Body.transformToString();
  return JSON.parse(body);
}

// ====================================
// Presigned URL Generation
// ====================================

/** Presigned URL for download */
async function getDownloadUrl(bucket, key, expiresIn = 3600) {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return await getSignedUrl(s3, command, { expiresIn });
}

/** Presigned URL for upload */
async function getUploadUrl(bucket, key, contentType, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ServerSideEncryption: 'AES256',
  });
  return await getSignedUrl(s3, command, { expiresIn });
}

// ====================================
// Object Listing
// ====================================

/** List all objects (automatic pagination handling) */
async function listAllObjects(bucket, prefix = '') {
  const objects = [];
  let continuationToken;

  do {
    const response = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));

    if (response.Contents) {
      objects.push(...response.Contents);
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

// ====================================
// Object Copy and Move
// ====================================

/** Copy an object */
async function copyObject(bucket, sourceKey, destKey) {
  await s3.send(new CopyObjectCommand({
    Bucket: bucket,
    CopySource: `${bucket}/${sourceKey}`,
    Key: destKey,
    ServerSideEncryption: 'AES256',
  }));
  console.log(`Copy complete: ${sourceKey} -> ${destKey}`);
}

/** Move an object (copy + delete) */
async function moveObject(bucket, sourceKey, destKey) {
  await copyObject(bucket, sourceKey, destKey);
  await s3.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: sourceKey,
  }));
  console.log(`Move complete: ${sourceKey} -> ${destKey}`);
}

// ====================================
// Usage Example
// ====================================

async function main() {
  const bucket = 'my-app-bucket-2024';

  // Save and load JSON
  await putJson(bucket, 'config/settings.json', {
    theme: 'dark',
    language: 'ja',
  });

  const settings = await getJson(bucket, 'config/settings.json');
  console.log('Settings:', settings);

  // Generate Presigned URL
  const url = await getDownloadUrl(bucket, 'private/report.pdf');
  console.log('Download URL:', url);
}

main().catch(console.error);
```

---

## 3. Storage Classes

### 3.1 Storage Class Comparison

| Class | Availability | Minimum Storage Duration | Retrieval Fee | Use Case |
|--------|--------|------------|------------|------------|
| Standard | 99.99% | None | None | Frequent access |
| Intelligent-Tiering | 99.9% | None | None | Unknown access pattern |
| Standard-IA | 99.9% | 30 days | Yes | Infrequent access |
| One Zone-IA | 99.5% | 30 days | Yes | Recreatable data |
| Glacier Instant Retrieval | 99.9% | 90 days | Yes | Quarterly access |
| Glacier Flexible Retrieval | 99.99% | 90 days | Yes | 1-2 times per year access |
| Glacier Deep Archive | 99.99% | 180 days | Yes | Compliance storage |
| Express One Zone | 99.95% | None | None | Ultra-low latency |

### 3.2 Pricing Comparison (Tokyo Region Estimates)

| Class | Storage (GB/month) | Retrieval (GB) | Minimum Billable Size |
|--------|-----------------|-------------|-------------|
| Standard | $0.025 | Free | None |
| Intelligent-Tiering | $0.025 (frequent) | Free | None |
| Standard-IA | $0.019 | $0.01 | 128KB |
| One Zone-IA | $0.015 | $0.01 | 128KB |
| Glacier Instant | $0.005 | $0.03 | 128KB |
| Glacier Flexible | $0.0045 | $0.01-$0.03 | 40KB |
| Deep Archive | $0.002 | $0.02-$0.05 | 40KB |

```
Storage Class Selection Flow

  How frequent is access?
  ├── Millisecond latency required -> Express One Zone
  ├── Daily/weekly -> Standard
  ├── Unknown -> Intelligent-Tiering
  ├── A few times per month -> Standard-IA
  ├── Once per quarter -> Glacier Instant Retrieval
  ├── 1-2 times per year -> Glacier Flexible Retrieval
  └── Almost never accessed -> Glacier Deep Archive

  Can it be recreated?
  ├── Yes -> One Zone-IA (cheaper than IA)
  └── No  -> Standard-IA (multi-AZ)
```

### 3.3 Intelligent-Tiering Details

S3 Intelligent-Tiering is a storage class that automatically moves objects to the optimal access tier based on access patterns.

```
Intelligent-Tiering Access Tiers

  +--------------------------------------+
  | Frequent Access Tier                   |
  | -> Same pricing as Standard            |
  | -> Moved here immediately on access    |
  +--------------------------------------+
         |
         | 30 days without access
         v
  +--------------------------------------+
  | Infrequent Access Tier                 |
  | -> Same pricing as Standard-IA         |
  +--------------------------------------+
         |
         | 90 days without access (opt-in)
         v
  +--------------------------------------+
  | Archive Access Tier                    |
  | -> Same pricing as Glacier Flexible    |
  +--------------------------------------+
         |
         | 180 days without access (opt-in)
         v
  +--------------------------------------+
  | Deep Archive Access Tier               |
  | -> Same pricing as Deep Archive        |
  +--------------------------------------+

  * Monitoring/auto-tiering fee: $0.0025/month per object
  * Objects smaller than 128KB always stay in the Frequent Access tier
  * No retrieval fee (except for retrievals from archive tiers)
```

```bash
# Intelligent-Tiering configuration
# Enable Archive Access tier
aws s3api put-bucket-intelligent-tiering-configuration \
  --bucket my-app-bucket-2024 \
  --id "ArchiveConfig" \
  --intelligent-tiering-configuration '{
    "Id": "ArchiveConfig",
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

# Upload with storage class specified
aws s3 cp ./file.txt s3://my-app-bucket-2024/ \
  --storage-class INTELLIGENT_TIERING
```

### 3.4 Restoring Data from Glacier

```bash
# Restore from Glacier Flexible Retrieval
# Standard (3-5 hours)
aws s3api restore-object \
  --bucket my-app-bucket-2024 \
  --key archives/old-data.tar.gz \
  --restore-request '{
    "Days": 7,
    "GlacierJobParameters": {
      "Tier": "Standard"
    }
  }'

# Expedited (1-5 minutes, additional charges)
aws s3api restore-object \
  --bucket my-app-bucket-2024 \
  --key archives/urgent-data.tar.gz \
  --restore-request '{
    "Days": 1,
    "GlacierJobParameters": {
      "Tier": "Expedited"
    }
  }'

# Bulk (5-12 hours, cheapest)
aws s3api restore-object \
  --bucket my-app-bucket-2024 \
  --key archives/bulk-data.tar.gz \
  --restore-request '{
    "Days": 30,
    "GlacierJobParameters": {
      "Tier": "Bulk"
    }
  }'

# Check restore status
aws s3api head-object \
  --bucket my-app-bucket-2024 \
  --key archives/old-data.tar.gz \
  --query 'Restore'
# Output example: "ongoing-request=\"false\", expiry-date=\"Sun, 01 Jan 2025 00:00:00 GMT\""
```

```python
# Glacier restore and status monitoring with Python
import boto3
import time
from datetime import datetime

s3 = boto3.client('s3', region_name='ap-northeast-1')

def restore_from_glacier(bucket: str, key: str, days: int = 7,
                         tier: str = 'Standard') -> dict:
    """Restore an object from Glacier"""
    try:
        s3.restore_object(
            Bucket=bucket,
            Key=key,
            RestoreRequest={
                'Days': days,
                'GlacierJobParameters': {'Tier': tier}
            }
        )
        return {'status': 'initiated', 'key': key, 'tier': tier}
    except s3.exceptions.ClientError as e:
        if 'RestoreAlreadyInProgress' in str(e):
            return {'status': 'already_in_progress', 'key': key}
        raise

def check_restore_status(bucket: str, key: str) -> dict:
    """Check restore progress"""
    response = s3.head_object(Bucket=bucket, Key=key)
    restore = response.get('Restore', '')

    if not restore:
        return {'status': 'not_restored', 'storage_class': response.get('StorageClass')}
    elif 'ongoing-request="true"' in restore:
        return {'status': 'in_progress'}
    elif 'ongoing-request="false"' in restore:
        return {'status': 'completed', 'restore_info': restore}
    return {'status': 'unknown', 'raw': restore}

def wait_for_restore(bucket: str, key: str,
                     check_interval: int = 300, max_wait: int = 43200):
    """Wait for restore completion (default max 12 hours)"""
    start_time = time.time()
    while time.time() - start_time < max_wait:
        status = check_restore_status(bucket, key)
        print(f"[{datetime.now().isoformat()}] Status: {status['status']}")

        if status['status'] == 'completed':
            return status
        elif status['status'] == 'not_restored':
            raise Exception(f"Restore has not been initiated: {key}")

        time.sleep(check_interval)

    raise TimeoutError(f"Restore timed out: {key}")
```

---

## 4. Access Control

### 4.1 Access Control Layers

```
4 Layers of S3 Access Control

  +------------------------------------------+
  | 1. Public Access Block (highest priority)  |
  |    Prevent public access at account/bucket |
  +------------------------------------------+
              ↓
  +------------------------------------------+
  | 2. Bucket Policy (resource-based)          |
  |    Define allow/deny rules in JSON         |
  +------------------------------------------+
              ↓
  +------------------------------------------+
  | 3. IAM Policy (identity-based)             |
  |    Grant S3 permissions to users/roles     |
  +------------------------------------------+
              ↓
  +------------------------------------------+
  | 4. ACL (legacy, not recommended)           |
  |    Per-object read/write permissions       |
  +------------------------------------------+

  Access Evaluation Flow:
  1. Is it blocked by Public Access Block?
     -> Yes: Access denied
  2. Is there an explicit Deny?
     -> Yes: Access denied
  3. Is there an explicit Allow?
     -> Yes: Access allowed
  4. Default: Access denied (implicit Deny)
```

### 4.2 Public Access Block

```bash
# Block public access at account level (recommended)
aws s3control put-public-access-block \
  --account-id 123456789012 \
  --public-access-block-configuration '{
    "BlockPublicAcls": true,
    "IgnorePublicAcls": true,
    "BlockPublicPolicy": true,
    "RestrictPublicBuckets": true
  }'

# Block public access at bucket level
aws s3api put-public-access-block \
  --bucket my-app-bucket-2024 \
  --public-access-block-configuration '{
    "BlockPublicAcls": true,
    "IgnorePublicAcls": true,
    "BlockPublicPolicy": true,
    "RestrictPublicBuckets": true
  }'

# Check the configuration
aws s3api get-public-access-block --bucket my-app-bucket-2024
```

```
4 Settings of Public Access Block

  BlockPublicAcls:
    -> Blocks setting new public ACLs
    -> Returns error when specifying public-read ACL in PUT Object

  IgnorePublicAcls:
    -> Ignores existing public ACLs
    -> Already configured public-read ACLs become ineffective

  BlockPublicPolicy:
    -> Blocks setting bucket policies that allow public access
    -> Returns error when PUT-ing a policy with Principal: "*"

  RestrictPublicBuckets:
    -> Restricts cross-account access to buckets
      with public policies configured
```

### 4.3 Practical Bucket Policy Patterns

```bash
# Pattern 1: Allow access only from a specific IAM role
aws s3api put-bucket-policy --bucket my-app-bucket-2024 --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowAppRoleAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:role/AppServerRole"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-app-bucket-2024",
        "arn:aws:s3:::my-app-bucket-2024/*"
      ]
    }
  ]
}'

# Pattern 2: Deny unencrypted uploads
aws s3api put-bucket-policy --bucket my-app-bucket-2024 --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyUnencryptedUploads",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::my-app-bucket-2024/*",
      "Condition": {
        "StringNotEquals": {
          "s3:x-amz-server-side-encryption": "AES256"
        }
      }
    }
  ]
}'

# Pattern 3: Allow HTTPS only
aws s3api put-bucket-policy --bucket my-app-bucket-2024 --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyInsecureTransport",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::my-app-bucket-2024",
        "arn:aws:s3:::my-app-bucket-2024/*"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    }
  ]
}'

# Pattern 4: Allow access only from a specific VPC endpoint
aws s3api put-bucket-policy --bucket my-app-bucket-2024 --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowVPCEndpointOnly",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::my-app-bucket-2024",
        "arn:aws:s3:::my-app-bucket-2024/*"
      ],
      "Condition": {
        "StringNotEquals": {
          "aws:SourceVpce": "vpce-1234567890abcdef0"
        }
      }
    }
  ]
}'

# Pattern 5: IP address restriction
aws s3api put-bucket-policy --bucket my-app-bucket-2024 --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowFromSpecificIP",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::my-app-bucket-2024",
        "arn:aws:s3:::my-app-bucket-2024/*"
      ],
      "Condition": {
        "NotIpAddress": {
          "aws:SourceIp": [
            "203.0.113.0/24",
            "198.51.100.0/24"
          ]
        }
      }
    }
  ]
}'

# Pattern 6: Cross-account access
aws s3api put-bucket-policy --bucket my-app-bucket-2024 --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCrossAccountAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::987654321098:root"
      },
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-app-bucket-2024",
        "arn:aws:s3:::my-app-bucket-2024/shared/*"
      ]
    }
  ]
}'
```

### 4.4 CORS Configuration

```bash
# CORS configuration (for direct access from web apps)
aws s3api put-bucket-cors --bucket my-app-bucket-2024 --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedOrigins": ["https://myapp.example.com", "https://admin.example.com"],
      "ExposeHeaders": ["ETag", "x-amz-request-id"],
      "MaxAgeSeconds": 3600
    }
  ]
}'

# Check CORS
aws s3api get-bucket-cors --bucket my-app-bucket-2024
```

### 4.5 Disabling ACL (Recommended Setting)

```bash
# Set object ownership to BucketOwnerEnforced
# -> ACLs are disabled, bucket owner owns all objects
aws s3api put-bucket-ownership-controls \
  --bucket my-app-bucket-2024 \
  --ownership-controls '{
    "Rules": [{"ObjectOwnership": "BucketOwnerEnforced"}]
  }'
```

---

## 5. Lifecycle Rules

### 5.1 Lifecycle Transition Paths

```
Object Lifecycle Transitions

  Standard
     |
     | After 30 days
     v
  Standard-IA / Intelligent-Tiering
     |
     | After 60 days
     v
  Glacier Instant Retrieval
     |
     | After 90 days
     v
  Glacier Flexible Retrieval
     |
     | After 180 days
     v
  Glacier Deep Archive
     |
     | After 365 days
     v
  Deletion (Expiration)

  * Transition constraints:
    - Standard-IA: minimum 30 days elapsed
    - Glacier: minimum 90 days elapsed
    - Minimum object size: 128KB (IA types) / 40KB (Glacier types)
    - After transitioning to One Zone-IA, cannot transition to other IA classes
```

### 5.2 Lifecycle Rule Configuration Examples

```bash
# Practical lifecycle configuration
aws s3api put-bucket-lifecycle-configuration \
  --bucket my-app-bucket-2024 \
  --lifecycle-configuration '{
  "Rules": [
    {
      "ID": "ArchiveLogs",
      "Status": "Enabled",
      "Filter": {"Prefix": "logs/"},
      "Transitions": [
        {"Days": 30, "StorageClass": "STANDARD_IA"},
        {"Days": 90, "StorageClass": "GLACIER"},
        {"Days": 365, "StorageClass": "DEEP_ARCHIVE"}
      ],
      "Expiration": {"Days": 2555}
    },
    {
      "ID": "CleanupTempFiles",
      "Status": "Enabled",
      "Filter": {"Prefix": "tmp/"},
      "Expiration": {"Days": 7}
    },
    {
      "ID": "ArchiveReports",
      "Status": "Enabled",
      "Filter": {
        "And": {
          "Prefix": "reports/",
          "Tags": [
            {"Key": "archive", "Value": "true"}
          ]
        }
      },
      "Transitions": [
        {"Days": 90, "StorageClass": "GLACIER_IR"}
      ]
    },
    {
      "ID": "CleanupIncompleteUploads",
      "Status": "Enabled",
      "Filter": {"Prefix": ""},
      "AbortIncompleteMultipartUpload": {
        "DaysAfterInitiation": 7
      }
    },
    {
      "ID": "ExpireOldVersions",
      "Status": "Enabled",
      "Filter": {"Prefix": ""},
      "NoncurrentVersionTransitions": [
        {"NoncurrentDays": 30, "StorageClass": "STANDARD_IA"},
        {"NoncurrentDays": 90, "StorageClass": "GLACIER"}
      ],
      "NoncurrentVersionExpiration": {"NoncurrentDays": 365}
    },
    {
      "ID": "ExpireDeleteMarkers",
      "Status": "Enabled",
      "Filter": {"Prefix": ""},
      "Expiration": {
        "ExpiredObjectDeleteMarker": true
      }
    },
    {
      "ID": "SmallObjectFilter",
      "Status": "Enabled",
      "Filter": {
        "And": {
          "Prefix": "data/",
          "ObjectSizeGreaterThan": 131072
        }
      },
      "Transitions": [
        {"Days": 60, "StorageClass": "STANDARD_IA"}
      ]
    }
  ]
}'

# Check lifecycle configuration
aws s3api get-bucket-lifecycle-configuration --bucket my-app-bucket-2024
```

### 5.3 Cost Optimization Simulation

```python
# Cost reduction simulation with lifecycle rules
def calculate_storage_cost(
    total_gb: float,
    access_pattern: str = 'standard',
    months: int = 12
) -> dict:
    """Estimate storage costs (Tokyo region)"""
    prices = {
        'STANDARD':     0.025,
        'STANDARD_IA':  0.019,
        'ONE_ZONE_IA':  0.015,
        'GLACIER_IR':   0.005,
        'GLACIER':      0.0045,
        'DEEP_ARCHIVE': 0.002,
    }

    # Without lifecycle (Standard for the entire period)
    cost_no_lifecycle = total_gb * prices['STANDARD'] * months

    # With lifecycle
    cost_with_lifecycle = 0
    for month in range(1, months + 1):
        if month <= 1:
            cost_with_lifecycle += total_gb * prices['STANDARD']
        elif month <= 3:
            cost_with_lifecycle += total_gb * prices['STANDARD_IA']
        elif month <= 6:
            cost_with_lifecycle += total_gb * prices['GLACIER_IR']
        elif month <= 12:
            cost_with_lifecycle += total_gb * prices['GLACIER']
        else:
            cost_with_lifecycle += total_gb * prices['DEEP_ARCHIVE']

    savings = cost_no_lifecycle - cost_with_lifecycle
    savings_pct = (savings / cost_no_lifecycle) * 100

    return {
        'without_lifecycle': round(cost_no_lifecycle, 2),
        'with_lifecycle': round(cost_with_lifecycle, 2),
        'savings': round(savings, 2),
        'savings_percentage': round(savings_pct, 1),
    }

# Usage example
result = calculate_storage_cost(total_gb=1000, months=12)
print(f"Without lifecycle: ${result['without_lifecycle']}")
print(f"With lifecycle: ${result['with_lifecycle']}")
print(f"Savings: ${result['savings']} ({result['savings_percentage']}%)")
# Without lifecycle: $300.00
# With lifecycle: $83.50
# Savings: $216.50 (72.2%)
```

---

## 6. Static Website Hosting

### 6.1 Architecture

```
S3 Static Hosting Configuration (Recommended)

  User
    |
    v
  Route 53 (DNS)
    |  example.com -> CloudFront
    v
  CloudFront (CDN, HTTPS)
    |  Cache, compression, WAF integration
    v
  S3 Bucket (via OAC, private)
  ├── index.html
  ├── error.html
  ├── css/
  │   ├── main.abc123.css
  │   └── vendor.def456.css
  ├── js/
  │   ├── app.ghi789.js
  │   └── vendor.jkl012.js
  └── images/
      ├── logo.png
      └── hero.webp

  * The S3 bucket remains private
  * Accessible only via CloudFront OAC
  * S3 static hosting feature is not needed
    (CloudFront uses the S3 API directly as origin)
```

### 6.2 Static Hosting Configuration

```bash
# === Method 1: S3 standalone static hosting (for development environments) ===

# Enable static hosting on the bucket
aws s3 website s3://my-website-bucket \
  --index-document index.html \
  --error-document error.html

# Redirect rules for SPA (Single Page Application)
aws s3api put-bucket-website \
  --bucket my-website-bucket \
  --website-configuration '{
    "IndexDocument": {"Suffix": "index.html"},
    "ErrorDocument": {"Key": "index.html"},
    "RoutingRules": [
      {
        "Condition": {
          "HttpErrorCodeReturnedEquals": "404"
        },
        "Redirect": {
          "ReplaceKeyWith": "index.html",
          "HttpRedirectCode": "200"
        }
      }
    ]
  }'

# Upload files (with cache strategy)
# Hashed assets (long-term cache)
aws s3 sync ./build/static/ s3://my-website-bucket/static/ \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "*.map"

# index.html (no cache)
aws s3 cp ./build/index.html s3://my-website-bucket/ \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html; charset=utf-8"

# Other HTML files
aws s3 sync ./build/ s3://my-website-bucket/ \
  --exclude "static/*" \
  --exclude "*.map" \
  --cache-control "public, max-age=0, must-revalidate"

# Check endpoint
echo "http://my-website-bucket.s3-website-ap-northeast-1.amazonaws.com"
```

### 6.3 CloudFront + OAC Configuration (Recommended for Production)

```bash
# Step 1: Create OAC (Origin Access Control)
OAC_ID=$(aws cloudfront create-origin-access-control \
  --origin-access-control-config '{
    "Name": "S3-Website-OAC",
    "Description": "OAC for S3 static website",
    "OriginAccessControlOriginType": "s3",
    "SigningBehavior": "always",
    "SigningProtocol": "sigv4"
  }' --query 'OriginAccessControl.Id' --output text)

echo "OAC ID: ${OAC_ID}"

# Step 2: Create CloudFront distribution
DIST_ID=$(aws cloudfront create-distribution \
  --distribution-config '{
    "CallerReference": "my-website-2024",
    "Comment": "Static website distribution",
    "Enabled": true,
    "DefaultRootObject": "index.html",
    "Origins": {
      "Quantity": 1,
      "Items": [{
        "Id": "S3Origin",
        "DomainName": "my-website-bucket.s3.ap-northeast-1.amazonaws.com",
        "OriginAccessControlId": "'${OAC_ID}'",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      }]
    },
    "DefaultCacheBehavior": {
      "TargetOriginId": "S3Origin",
      "ViewerProtocolPolicy": "redirect-to-https",
      "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
      "Compress": true,
      "AllowedMethods": {
        "Quantity": 2,
        "Items": ["GET", "HEAD"]
      }
    },
    "CustomErrorResponses": {
      "Quantity": 1,
      "Items": [{
        "ErrorCode": 404,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 0
      }]
    },
    "PriceClass": "PriceClass_200"
  }' --query 'Distribution.Id' --output text)

echo "Distribution ID: ${DIST_ID}"

# Step 3: Bucket policy to allow access only from CloudFront
aws s3api put-bucket-policy --bucket my-website-bucket --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontOAC",
    "Effect": "Allow",
    "Principal": {"Service": "cloudfront.amazonaws.com"},
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::my-website-bucket/*",
    "Condition": {
      "StringEquals": {
        "AWS:SourceArn": "arn:aws:cloudfront::123456789012:distribution/'${DIST_ID}'"
      }
    }
  }]
}'

# Step 4: Cache invalidation (after deployment)
aws cloudfront create-invalidation \
  --distribution-id ${DIST_ID} \
  --paths "/*"

# Invalidate specific paths only (cost reduction)
aws cloudfront create-invalidation \
  --distribution-id ${DIST_ID} \
  --paths "/index.html" "/manifest.json"
```

### 6.4 Deployment Script (Practical Example)

```bash
#!/bin/bash
# deploy-static-site.sh - Deploy static site to S3 + CloudFront

set -euo pipefail

BUCKET="my-website-bucket"
DIST_ID="E1234567890ABC"
BUILD_DIR="./build"

echo "=== Build ==="
npm run build

echo "=== Upload hashed assets (long-term cache) ==="
aws s3 sync "${BUILD_DIR}/static/" "s3://${BUCKET}/static/" \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "*.map" \
  --size-only

echo "=== Upload HTML files (no cache) ==="
aws s3 cp "${BUILD_DIR}/index.html" "s3://${BUCKET}/index.html" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html; charset=utf-8"

echo "=== Upload other files ==="
aws s3 sync "${BUILD_DIR}/" "s3://${BUCKET}/" \
  --exclude "static/*" \
  --exclude "*.map" \
  --exclude "index.html" \
  --cache-control "public, max-age=3600"

echo "=== CloudFront cache invalidation ==="
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "${DIST_ID}" \
  --paths "/index.html" "/manifest.json" "/service-worker.js" \
  --query 'Invalidation.Id' --output text)

echo "Invalidation ID: ${INVALIDATION_ID}"

echo "=== Waiting for invalidation to complete ==="
aws cloudfront wait invalidation-completed \
  --distribution-id "${DIST_ID}" \
  --id "${INVALIDATION_ID}"

echo "=== Deployment complete ==="
```

---

## 7. Server-Side Encryption

### 7.1 Encryption Method Comparison

| Method | Key Management | Cost | Use Case | API Call Limits |
|------|---------|--------|------------|----------------|
| SSE-S3 (AES256) | AWS managed | Free | Default recommended | None |
| SSE-KMS (aws/s3) | AWS managed KMS key | KMS charges | When audit logs needed | KMS quotas |
| SSE-KMS (CMK) | User-managed key | KMS charges | Cross-account | KMS quotas |
| SSE-C | User-provided key | Free | Custom key management | HTTPS required |
| CSE | Client-side | None | Full control | None |

```
Encryption Method Selection Flow

  Need encryption?
  ├── Want default encryption -> SSE-S3 (AES256)
  ├── Need to audit key usage -> SSE-KMS (aws/s3)
  ├── Want to control key rotation -> SSE-KMS (CMK)
  ├── Want to share keys cross-account -> SSE-KMS (CMK)
  ├── Don't want to entrust keys to AWS -> SSE-C
  └── Want to encrypt data before upload -> CSE
```

### 7.2 Encryption Configuration

```bash
# Set default encryption to SSE-S3 (AES256)
aws s3api put-bucket-encryption --bucket my-app-bucket-2024 \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      },
      "BucketKeyEnabled": true
    }]
  }'

# Set default encryption to SSE-KMS
aws s3api put-bucket-encryption --bucket my-app-bucket-2024 \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "aws:kms",
        "KMSMasterKeyID": "arn:aws:kms:ap-northeast-1:123456789012:key/12345678-1234-1234-1234-123456789012"
      },
      "BucketKeyEnabled": true
    }]
  }'

# Check encryption configuration
aws s3api get-bucket-encryption --bucket my-app-bucket-2024

# Upload with KMS key
aws s3 cp ./sensitive-data.csv s3://my-app-bucket-2024/data/ \
  --sse aws:kms \
  --sse-kms-key-id "arn:aws:kms:ap-northeast-1:123456789012:key/12345678-1234-1234-1234-123456789012"
```

```python
# SSE-C (Customer-Provided Key) upload/download with Python
import boto3
import hashlib
import base64
import os

s3 = boto3.client('s3', region_name='ap-northeast-1')

# Generate a 256-bit encryption key
encryption_key = os.urandom(32)
key_b64 = base64.b64encode(encryption_key).decode('utf-8')
key_md5 = base64.b64encode(
    hashlib.md5(encryption_key).digest()
).decode('utf-8')

# Upload with SSE-C
s3.put_object(
    Bucket='my-app-bucket-2024',
    Key='encrypted/secret-data.bin',
    Body=b'This is secret data',
    SSECustomerAlgorithm='AES256',
    SSECustomerKey=key_b64,
    SSECustomerKeyMD5=key_md5
)

# Download with SSE-C (same key required)
response = s3.get_object(
    Bucket='my-app-bucket-2024',
    Key='encrypted/secret-data.bin',
    SSECustomerAlgorithm='AES256',
    SSECustomerKey=key_b64,
    SSECustomerKeyMD5=key_md5
)
data = response['Body'].read()
print(f"Decrypted data: {data}")
```

---

## 8. S3 Event Notifications

### 8.1 Event Notification Architecture

```
S3 Event Notification Destinations

  S3 Bucket
    |
    | Event occurs (PUT, DELETE, etc.)
    |
    ├── -> SNS Topic -> Email, SMS, HTTP
    ├── -> SQS Queue -> Batch processing
    ├── -> Lambda Function -> Real-time processing
    └── -> EventBridge -> Complex routing

  Major Event Types:
  ├── s3:ObjectCreated:* (Put, Post, Copy, CompleteMultipartUpload)
  ├── s3:ObjectRemoved:* (Delete, DeleteMarkerCreated)
  ├── s3:ObjectRestore:* (Post, Completed)
  ├── s3:ReducedRedundancyLostObject
  ├── s3:Replication:*
  └── s3:LifecycleTransition
```

### 8.2 Event Notification Configuration

```bash
# Event notification configuration for Lambda function
aws s3api put-bucket-notification-configuration \
  --bucket my-app-bucket-2024 \
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
      }
    ],
    "QueueConfigurations": [
      {
        "Id": "LogProcessingQueue",
        "QueueArn": "arn:aws:sqs:ap-northeast-1:123456789012:log-processing",
        "Events": ["s3:ObjectCreated:*"],
        "Filter": {
          "Key": {
            "FilterRules": [
              {"Name": "prefix", "Value": "logs/"},
              {"Name": "suffix", "Value": ".gz"}
            ]
          }
        }
      }
    ],
    "EventBridgeConfiguration": {}
  }'
```

```python
# Lambda function event processing example
import boto3
import json
import urllib.parse

s3 = boto3.client('s3')

def lambda_handler(event, context):
    """Lambda function to process S3 events"""
    for record in event['Records']:
        # Get event information
        bucket = record['s3']['bucket']['name']
        key = urllib.parse.unquote_plus(record['s3']['object']['key'])
        size = record['s3']['object']['size']
        event_name = record['eventName']
        event_time = record['eventTime']

        print(f"Event: {event_name}")
        print(f"Bucket: {bucket}")
        print(f"Key: {key}")
        print(f"Size: {size} bytes")
        print(f"Time: {event_time}")

        # Process the object
        if event_name.startswith('ObjectCreated'):
            process_new_object(bucket, key)
        elif event_name.startswith('ObjectRemoved'):
            handle_deletion(bucket, key)

def process_new_object(bucket: str, key: str):
    """Process a new object"""
    # Get metadata
    response = s3.head_object(Bucket=bucket, Key=key)
    content_type = response['ContentType']

    # Generate thumbnail for images
    if content_type.startswith('image/'):
        generate_thumbnail(bucket, key)

    # Analyze log files
    elif key.endswith('.log') or key.endswith('.gz'):
        analyze_log(bucket, key)

def generate_thumbnail(bucket: str, key: str):
    """Generate a thumbnail (simplified)"""
    print(f"Generating thumbnail: {key}")
    # Thumbnail generation using Pillow, etc.
    # ...

def handle_deletion(bucket: str, key: str):
    """Handle deletion event"""
    print(f"Object deletion detected: {key}")
    # Cleanup of related data, etc.
```

---

## 9. S3 Monitoring and Metrics

### 9.1 CloudWatch Metrics

```
S3 Standard Metrics (Free)

  ├── BucketSizeBytes: Total bucket size
  ├── NumberOfObjects: Object count
  └── * Updated daily (not real-time)

S3 Request Metrics (Paid, filter configuration required)

  ├── AllRequests: Total request count
  ├── GetRequests: GET request count
  ├── PutRequests: PUT request count
  ├── DeleteRequests: DELETE request count
  ├── HeadRequests: HEAD request count
  ├── ListRequests: LIST request count
  ├── 4xxErrors: Client error count
  ├── 5xxErrors: Server error count
  ├── FirstByteLatency: Latency to first byte
  ├── TotalRequestLatency: Total request latency
  ├── BytesDownloaded: Downloaded bytes
  └── BytesUploaded: Uploaded bytes
```

```bash
# Enable request metrics
aws s3api put-bucket-metrics-configuration \
  --bucket my-app-bucket-2024 \
  --id AllRequests \
  --metrics-configuration '{
    "Id": "AllRequests",
    "Filter": {}
  }'

# Metrics for a specific prefix
aws s3api put-bucket-metrics-configuration \
  --bucket my-app-bucket-2024 \
  --id ApiRequests \
  --metrics-configuration '{
    "Id": "ApiRequests",
    "Filter": {
      "Prefix": "api/"
    }
  }'

# Get metrics from CloudWatch
aws cloudwatch get-metric-statistics \
  --namespace AWS/S3 \
  --metric-name BucketSizeBytes \
  --dimensions Name=BucketName,Value=my-app-bucket-2024 \
               Name=StorageType,Value=StandardStorage \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-31T23:59:59Z \
  --period 86400 \
  --statistics Average
```

### 9.2 S3 Access Logs

```bash
# Enable access logs
# First, set up the policy for the log destination bucket
aws s3api put-bucket-policy --bucket my-s3-access-logs --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "S3ServerAccessLogsPolicy",
    "Effect": "Allow",
    "Principal": {"Service": "logging.s3.amazonaws.com"},
    "Action": "s3:PutObject",
    "Resource": "arn:aws:s3:::my-s3-access-logs/*",
    "Condition": {
      "StringEquals": {
        "aws:SourceAccount": "123456789012"
      }
    }
  }]
}'

# Enable access logs
aws s3api put-bucket-logging --bucket my-app-bucket-2024 --bucket-logging-status '{
  "LoggingEnabled": {
    "TargetBucket": "my-s3-access-logs",
    "TargetPrefix": "my-app-bucket-2024/"
  }
}'
```

### 9.3 S3 Storage Lens

```bash
# Create a Storage Lens dashboard
aws s3control put-storage-lens-configuration \
  --account-id 123456789012 \
  --config-id my-storage-lens \
  --storage-lens-configuration '{
    "Id": "my-storage-lens",
    "AccountLevel": {
      "BucketLevel": {
        "ActivityMetrics": {
          "IsEnabled": true
        },
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
    "IsEnabled": true
  }'
```

---

## 10. Multipart Upload

### 10.1 How Multipart Upload Works

```
Multipart Upload Flow

  File (100MB)
    |
    | Split
    v
  +--------+--------+--------+--------+
  | Part 1 | Part 2 | Part 3 | ... N  |
  | 10MB   | 10MB   | 10MB   |        |
  +--------+--------+--------+--------+
    |         |         |         |
    | Parallel | Parallel | Parallel | Parallel
    v         v         v         v
  S3 (temporary part storage)
    |
    | Complete Multipart Upload
    v
  Completed object (100MB)

  Constraints:
  ├── Minimum part size: 5MB (except the last part)
  ├── Maximum part size: 5GB
  ├── Maximum number of parts: 10,000
  ├── Maximum object size: 5TB
  └── Recommendation: Use multipart for files over 100MB
```

### 10.2 Multipart Upload with Python

```python
import boto3
import os
import math
from concurrent.futures import ThreadPoolExecutor, as_completed

s3 = boto3.client('s3', region_name='ap-northeast-1')

def multipart_upload(file_path: str, bucket: str, key: str,
                     part_size: int = 50 * 1024 * 1024):
    """Execute a multipart upload"""
    file_size = os.path.getsize(file_path)
    total_parts = math.ceil(file_size / part_size)

    print(f"File size: {file_size / (1024*1024):.1f} MB")
    print(f"Number of parts: {total_parts}")

    # Step 1: Initiate multipart upload
    response = s3.create_multipart_upload(
        Bucket=bucket,
        Key=key,
        ServerSideEncryption='AES256'
    )
    upload_id = response['UploadId']
    print(f"Upload ID: {upload_id}")

    parts = []
    try:
        # Step 2: Upload parts in parallel
        def upload_part(part_number, start, end):
            with open(file_path, 'rb') as f:
                f.seek(start)
                data = f.read(end - start)

                response = s3.upload_part(
                    Bucket=bucket,
                    Key=key,
                    UploadId=upload_id,
                    PartNumber=part_number,
                    Body=data
                )
                return {
                    'PartNumber': part_number,
                    'ETag': response['ETag']
                }

        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = {}
            for i in range(total_parts):
                part_num = i + 1
                start = i * part_size
                end = min(start + part_size, file_size)
                future = executor.submit(upload_part, part_num, start, end)
                futures[future] = part_num

            for future in as_completed(futures):
                part = future.result()
                parts.append(part)
                print(f"  Part {part['PartNumber']}/{total_parts} complete")

        # Sort by part number
        parts.sort(key=lambda x: x['PartNumber'])

        # Step 3: Complete multipart upload
        s3.complete_multipart_upload(
            Bucket=bucket,
            Key=key,
            UploadId=upload_id,
            MultipartUpload={'Parts': parts}
        )
        print(f"Upload complete: {key}")

    except Exception as e:
        # Abort upload on error
        s3.abort_multipart_upload(
            Bucket=bucket,
            Key=key,
            UploadId=upload_id
        )
        print(f"Upload aborted: {e}")
        raise

# List and cleanup incomplete multipart uploads
def cleanup_incomplete_uploads(bucket: str):
    """Delete incomplete multipart uploads"""
    response = s3.list_multipart_uploads(Bucket=bucket)
    uploads = response.get('Uploads', [])

    for upload in uploads:
        key = upload['Key']
        upload_id = upload['UploadId']
        initiated = upload['Initiated']

        print(f"Incomplete: {key} (started: {initiated})")

        s3.abort_multipart_upload(
            Bucket=bucket,
            Key=key,
            UploadId=upload_id
        )
        print(f"  -> Aborted")

    print(f"Cleaned up {len(uploads)} incomplete uploads in total")
```

---

## 11. S3 Versioning

### 11.1 Versioning Basics

```bash
# Enable versioning
aws s3api put-bucket-versioning \
  --bucket my-app-bucket-2024 \
  --versioning-configuration Status=Enabled

# Check versioning status
aws s3api get-bucket-versioning --bucket my-app-bucket-2024

# List all versions
aws s3api list-object-versions \
  --bucket my-app-bucket-2024 \
  --prefix config/settings.json

# Get a specific version
aws s3api get-object \
  --bucket my-app-bucket-2024 \
  --key config/settings.json \
  --version-id "abc123def456" \
  ./settings-old.json

# Delete a specific version
aws s3api delete-object \
  --bucket my-app-bucket-2024 \
  --key config/settings.json \
  --version-id "abc123def456"

# Delete a delete marker (restore the object)
aws s3api delete-object \
  --bucket my-app-bucket-2024 \
  --key config/settings.json \
  --version-id "DELETE_MARKER_VERSION_ID"
```

```
How Versioning Works

  PUT with versioning enabled:
  settings.json v1 (first upload)
  settings.json v2 (overwrite upload -> v1 is retained)
  settings.json v3 (overwrite upload -> v1, v2 are retained)

  DELETE with versioning enabled:
  A delete marker is added to settings.json
  -> GET returns 404
  -> Deleting the delete marker restores v3 as the latest
  -> All versions are retained

  Notes:
  ├── Once enabled, versioning cannot be disabled
  │   (It can be suspended, but existing versions remain)
  ├── All versions are subject to storage charges
  └── Use lifecycle rules to automatically delete old versions (recommended)
```

---

## 12. Presigned URL

### 12.1 Purpose and Mechanism of Presigned URLs

```
Presigned URL Flow

  ■ For Download
  Client -> API Server -> S3 (Generate Presigned URL)
       ↑                              |
       +--- Return Presigned URL -----+
       |
       +--- Download directly from S3 via URL ---------> S3

  ■ For Upload
  Client -> API Server -> S3 (Generate Presigned URL)
       ↑                              |
       +--- Return Presigned URL -----+
       |
       +--- Upload directly to S3 via URL -----------> S3

  Benefits:
  ├── No need to pass AWS credentials to the client
  ├── Direct S3 access without going through the server
  ├── Configurable expiration time (up to 7 days)
  └── Can restrict access to specific objects only
```

### 12.2 Presigned URL Implementation

```python
import boto3
from botocore.config import Config

# Client for Presigned URLs (with signature version specified)
s3 = boto3.client(
    's3',
    region_name='ap-northeast-1',
    config=Config(signature_version='s3v4')
)

def generate_download_url(bucket: str, key: str,
                          expires_in: int = 3600,
                          filename: str = None) -> str:
    """Generate a Presigned URL for download"""
    params = {
        'Bucket': bucket,
        'Key': key,
    }
    # Specify filename for download
    if filename:
        params['ResponseContentDisposition'] = f'attachment; filename="{filename}"'

    url = s3.generate_presigned_url(
        'get_object',
        Params=params,
        ExpiresIn=expires_in
    )
    return url

def generate_upload_url(bucket: str, key: str,
                        content_type: str = 'application/octet-stream',
                        max_size: int = None,
                        expires_in: int = 3600) -> dict:
    """Generate a Presigned URL for upload"""
    params = {
        'Bucket': bucket,
        'Key': key,
        'ContentType': content_type,
        'ServerSideEncryption': 'AES256',
    }

    url = s3.generate_presigned_url(
        'put_object',
        Params=params,
        ExpiresIn=expires_in
    )

    return {
        'url': url,
        'fields': {
            'Content-Type': content_type,
            'x-amz-server-side-encryption': 'AES256',
        }
    }

def generate_presigned_post(bucket: str, key_prefix: str,
                            content_type: str = 'image/jpeg',
                            max_size_mb: int = 10,
                            expires_in: int = 3600) -> dict:
    """Presigned URL for POST (for form uploads)"""
    conditions = [
        {'bucket': bucket},
        ['starts-with', '$key', key_prefix],
        {'Content-Type': content_type},
        ['content-length-range', 1, max_size_mb * 1024 * 1024],
        {'x-amz-server-side-encryption': 'AES256'},
    ]

    fields = {
        'Content-Type': content_type,
        'x-amz-server-side-encryption': 'AES256',
    }

    response = s3.generate_presigned_post(
        Bucket=bucket,
        Key=f'{key_prefix}/${{filename}}',
        Fields=fields,
        Conditions=conditions,
        ExpiresIn=expires_in
    )

    return response

# Usage example
if __name__ == '__main__':
    BUCKET = 'my-app-bucket-2024'

    # Download URL
    download_url = generate_download_url(
        BUCKET, 'reports/monthly.pdf',
        filename='monthly-report.pdf'
    )
    print(f"Download URL: {download_url}")

    # Upload URL
    upload_info = generate_upload_url(
        BUCKET, 'uploads/images/photo.jpg',
        content_type='image/jpeg'
    )
    print(f"Upload URL: {upload_info['url']}")

    # POST URL
    post_info = generate_presigned_post(
        BUCKET, 'uploads/avatars',
        max_size_mb=5
    )
    print(f"POST URL: {post_info['url']}")
    print(f"POST Fields: {post_info['fields']}")
```

```javascript
// Frontend usage example with Presigned URLs

// Download
async function downloadFile(presignedUrl, filename) {
  const response = await fetch(presignedUrl);
  const blob = await response.blob();

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Upload via PUT
async function uploadFile(presignedUrl, file, contentType) {
  const response = await fetch(presignedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'x-amz-server-side-encryption': 'AES256',
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }
  console.log('Upload complete');
}

// Upload via POST (form data)
async function uploadWithPost(presignedPost, file) {
  const formData = new FormData();

  // Add Presigned POST fields
  Object.entries(presignedPost.fields).forEach(([key, value]) => {
    formData.append(key, value);
  });

  // File must be added last (important)
  formData.append('file', file);

  const response = await fetch(presignedPost.url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }
  console.log('Upload complete');
}
```

---

## 13. Anti-Patterns

### Anti-Pattern 1: Leaving Buckets with Public Access Settings

Public S3 bucket configurations have caused large-scale data breaches in the past. Always enable Public Access Block, and when public access is needed, use CloudFront + OAC.

```bash
# Bad example - Allow public read
aws s3api put-bucket-acl --bucket my-bucket --acl public-read

# Good example - Block public access and serve via CloudFront
aws s3api put-public-access-block --bucket my-bucket \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

### Anti-Pattern 2: Leaving Incomplete Multipart Uploads

Fragments from failed multipart uploads continue to accumulate and incur unnecessary storage costs. Use lifecycle rules for automatic cleanup.

```bash
# Check incomplete multipart uploads
aws s3api list-multipart-uploads --bucket my-app-bucket-2024

# Auto-delete after 7 days with lifecycle rule
aws s3api put-bucket-lifecycle-configuration \
  --bucket my-app-bucket-2024 \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "AbortIncompleteMultipartUploads",
      "Status": "Enabled",
      "Filter": {"Prefix": ""},
      "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 7}
    }]
  }'
```

### Anti-Pattern 3: Storing Production Data Without Versioning

Without versioning, accidental overwrites or deletions become irrecoverable. Always enable versioning on production environment buckets.

### Anti-Pattern 4: Storing Large Amounts of Data Without Lifecycle Rules

Keeping all data in the Standard storage class incurs unnecessary costs. Configure lifecycle rules according to access patterns.

### Anti-Pattern 5: Dual Management of Bucket Policies and IAM Policies

Managing access control with both bucket policies and IAM policies makes unintended access grants or denials more likely. As a rule, manage with IAM policies and use bucket policies only for cases that IAM alone cannot handle, such as cross-account access.

### Anti-Pattern 6: Missing Encryption Settings

Operating without default encryption and specifying encryption on individual uploads carries a high risk of human error. Enable default encryption at the bucket level and also use a bucket policy to deny unencrypted uploads.

---

## 14. FAQ

### Q1. Are there constraints on S3 bucket names?

They must be globally unique, 3-63 characters, and only lowercase letters, numbers, and hyphens are allowed. Periods should be avoided as they cause SSL certificate issues. A naming convention like `my-company-app-prod` is recommended.

### Q2. How do I upload files larger than 5GB?

Use multipart upload. The AWS CLI's `aws s3 cp` automatically performs multipart uploads (default threshold is 8MB). SDKs also auto-split with the `upload` method. Supports up to 5TB.

### Q3. How can I reduce S3 costs?

(1) Use Intelligent-Tiering for automatic tiering based on access patterns, (2) Use lifecycle rules to transition old data to Glacier, (3) Delete incomplete multipart uploads, (4) Perform cost analysis with S3 Storage Lens.

### Q4. What is the difference between S3 Select and Athena?

S3 Select filters and retrieves specific columns and rows from CSV/JSON/Parquet data within a single object. Athena is a serverless analytics service that executes SQL queries across multiple objects. S3 Select is suitable for searching small single files, while Athena is suited for large-scale data analytics.

### Q5. How does S3 data transfer pricing work?

Inbound (upload to S3) is free. Outbound (download from S3) is free for the first 100GB/month, then $0.114/GB (Tokyo region). Access from EC2 in the same region is free. Access via CloudFront has no S3 transfer charges (CloudFront transfer charges apply instead).

### Q6. How much are S3 request charges?

For Standard, PUT/COPY/POST/LIST requests cost $0.0047/1,000 requests, and GET/SELECT/HEAD requests cost $0.00037/1,000 requests. For applications with high request volumes, caching with CloudFront can reduce both request count and costs.

### Q7. Can I move a bucket to another region?

A bucket's region cannot be changed. To move data to another region, create a new bucket and set up S3 Cross-Region Replication (CRR), or copy with `aws s3 sync`.

### Q8. What is S3 Object Lock?

A feature that prevents object deletion or overwriting using the WORM (Write Once Read Many) model. It is often required for compliance requirements (SEC Rule 17a-4, FINRA, etc.). There are two modes: Governance mode (privileged users can override) and Compliance mode (no one can override).

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What are common mistakes beginners make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in daily development work. It becomes particularly important during code reviews and architecture design.

---

## 15. Summary

| Item | Key Point |
|------|---------|
| Data Model | Bucket (namespace) + Object (key + value) |
| Durability | 99.999999999% (eleven nines) |
| Consistency | Strong Read-After-Write consistency |
| Storage Classes | Standard -> IA -> Glacier based on access frequency |
| Access Control | Public Access Block + Bucket Policy + IAM |
| Encryption | Enable SSE-S3 by default |
| Lifecycle | Auto-transition + auto-deletion for cost optimization |
| Versioning | Always enable in production environments |
| Static Hosting | CloudFront + OAC is the recommended configuration |
| Event Notifications | Integration with Lambda/SQS/SNS/EventBridge |
| Multipart Upload | Recommended for files over 100MB |
| Presigned URL | Granting temporary access to clients |
| Monitoring | CloudWatch Metrics + S3 Storage Lens |

---

## Recommended Next Reads

- [01-s3-advanced.md](./01-s3-advanced.md) — Versioning, replication, S3 Select
- [02-cloudfront.md](./02-cloudfront.md) — CloudFront CDN configuration

---

## References

1. Amazon S3 User Guide — https://docs.aws.amazon.com/AmazonS3/latest/userguide/
2. S3 Security Best Practices — https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html
3. S3 Pricing — https://aws.amazon.com/s3/pricing/
4. S3 Storage Classes — https://aws.amazon.com/s3/storage-classes/
5. S3 Performance Optimization — https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance.html
6. S3 Encryption Guide — https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingEncryption.html
7. S3 Lifecycle Rules — https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html

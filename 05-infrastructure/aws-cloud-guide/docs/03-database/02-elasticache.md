# Amazon ElastiCache

> Understand AWS's fully managed in-memory cache service and practically master Redis/Memcached selection, caching strategies, cluster design, operational patterns, and failure response

## What You Will Learn in This Chapter

1. **ElastiCache Fundamentals** --- Characteristics comparison and selection criteria for Redis and Memcached
2. **Caching Strategies** --- Pattern selection for Cache-Aside, Write-Through, and Write-Behind
3. **Operations and Optimization** --- Cluster design, failover, memory management, and monitoring
4. **High Availability Design** --- Multi-AZ, replication, backup/restore
5. **Security** --- Best practices for encryption, authentication, and network design


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts
- Understanding of the content in [Amazon DynamoDB](./01-dynamodb.md)

---

## 1. ElastiCache Architecture

```
+------------------------------------------------------------------+
|  Typical Cache Architecture                                      |
|                                                                  |
|  Client --> ALB --> App Server --+--> ElastiCache (Redis)        |
|                                  |   (< 1ms response)           |
|                                  |      | On Cache Miss          |
|                                  +----> RDS / DynamoDB           |
|                                      (5-20ms response)           |
|                                                                  |
|  Latency Comparison:                                             |
|    ElastiCache : < 1ms                                           |
|    RDS         : 5-20ms                                          |
|    DynamoDB    : 5-10ms                                          |
+------------------------------------------------------------------+
```

### Measuring Cache Effectiveness

```
Relationship Between Cache Hit Rate and Latency:
=================================================

Hit Rate    Avg Latency           DB Load
0%          20ms (all DB)         100%
50%         ~10ms                 50%
80%         ~4ms                  20%
90%         ~2ms                  10%
95%         ~1.5ms                5%
99%         ~1.2ms                1%

Break-even Point:
  ElastiCache cache.r7g.large (3 nodes) ≈ $700/month
  RDS db.r6g.xlarge ≈ $500/month
  → If caching allows you to downsize the RDS instance by one tier, it pays for itself
  → Especially effective for read-heavy (80%+) workloads
```

### Code Example 1: Creating a Redis Cluster (AWS CLI)

```bash
# Redis クラスター（レプリケーショングループ）の作成
aws elasticache create-replication-group \
  --replication-group-id my-redis-cluster \
  --replication-group-description "Production Redis Cache" \
  --engine redis \
  --engine-version 7.1 \
  --node-type cache.r7g.large \
  --num-node-groups 3 \
  --replicas-per-node-group 2 \
  --cache-subnet-group-name my-cache-subnet \
  --security-group-ids sg-0abc123 \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled \
  --automatic-failover-enabled \
  --multi-az-enabled \
  --snapshot-retention-limit 7 \
  --snapshot-window "03:00-05:00" \
  --tags Key=Environment,Value=production

# Memcached クラスターの作成
aws elasticache create-cache-cluster \
  --cache-cluster-id my-memcached-cluster \
  --engine memcached \
  --engine-version 1.6.22 \
  --cache-node-type cache.r7g.large \
  --num-cache-nodes 3 \
  --cache-subnet-group-name my-cache-subnet \
  --security-group-ids sg-0abc123 \
  --az-mode cross-az \
  --tags Key=Environment,Value=production

# クラスターの状態確認
aws elasticache describe-replication-groups \
  --replication-group-id my-redis-cluster \
  --query 'ReplicationGroups[0].{Status:Status,Nodes:NodeGroups[*].NodeGroupMembers[*].{Id:CacheClusterId,AZ:PreferredAvailabilityZone,Role:CurrentRole}}'

# エンドポイントの取得
aws elasticache describe-replication-groups \
  --replication-group-id my-redis-cluster \
  --query 'ReplicationGroups[0].{Primary:NodeGroups[0].PrimaryEndpoint,Reader:NodeGroups[0].ReaderEndpoint}'
```

---

## 2. Redis vs Memcached

### Feature Comparison Table

| Feature | Redis | Memcached |
|---|---|---|
| **Data Structures** | String, List, Set, Hash, Sorted Set, Stream, etc. | String only |
| **Persistence** | RDB + AOF | None (volatile) |
| **Replication** | Supported (automatic failover) | None |
| **Clustering** | Redis Cluster (sharding) | Distributed hashing (client-side) |
| **Pub/Sub** | Supported | None |
| **Lua Scripting** | Supported | None |
| **Multi-threading** | I/O multi-threading (7.0+) | Multi-threaded |
| **Max Memory** | Cluster total ~500GB | Several hundred GB per node |
| **TLS** | Supported | Supported (1.6.12+) |
| **Streams** | Supported (log-structured data) | None |
| **Geospatial** | Supported (location queries) | None |
| **JSON Support** | RedisJSON module supported | None |

### Selection Flowchart

```
Redis vs Memcached Selection Flow
==================================

Need data structures? (List, Set, Hash, etc.)
   |         |
  Yes        No
   |         |
   v         v
 Redis    Need persistence?
            |         |
           Yes        No
            |         |
            v         v
          Redis    Need replicas/failover?
                     |         |
                    Yes        No
                     |         |
                     v         v
                   Redis    Memcached
                            (Simple KV cache)
```

### Node Type Selection Guide

| Use Case | Recommended Node Type | Memory | Network | Monthly Estimate (Tokyo) |
|---|---|---|---|---|
| Dev/Test | cache.t4g.micro | 0.5 GB | Up to 5 Gbps | ~$15 |
| Small Production | cache.r7g.large | 13.07 GB | Up to 12.5 Gbps | ~$230 |
| Medium Production | cache.r7g.xlarge | 26.32 GB | Up to 12.5 Gbps | ~$460 |
| Large Production | cache.r7g.2xlarge | 52.82 GB | Up to 12.5 Gbps | ~$920 |
| Extra Large | cache.r7g.4xlarge | 105.81 GB | Up to 12.5 Gbps | ~$1,840 |

---

## 3. Caching Strategy Patterns

### Pattern Comparison Table

| Pattern | Read | Write | Consistency | Use Case |
|---|---|---|---|---|
| **Cache-Aside** | App checks cache -> On miss, reads from DB -> Writes to cache | Writes directly to DB | Eventual | General purpose, most common |
| **Read-Through** | Cache automatically reads from DB | Writes directly to DB | Eventual | When library supports it |
| **Write-Through** | Reads from cache | Synchronous write to cache -> DB | Strong | High read frequency |
| **Write-Behind** | Reads from cache | Asynchronous write to cache -> DB | Eventual | High write frequency |

```
Detailed Caching Strategy Flows:

1. Cache-Aside (Lazy Loading):
   Read:
     App --> Redis.GET(key)
       |-- HIT  --> return data
       |-- MISS --> DB.SELECT --> Redis.SET(key, data, TTL) --> return data

   Write:
     App --> DB.UPDATE --> Redis.DEL(key)  ← Cache invalidation

2. Write-Through:
   Write:
     App --> Redis.SET(key, data) --> DB.UPDATE  ← Synchronous
   Read:
     App --> Redis.GET(key)
       |-- HIT  --> return data
       |-- MISS --> DB.SELECT --> Redis.SET(key, data) --> return data

3. Write-Behind (Write-Back):
   Write:
     App --> Redis.SET(key, data) --> return success
                |
                +---> [Async] DB.UPDATE  ← Batch processing / delayed write
```

### Code Example 2: Cache-Aside Pattern (Python)

```python
import redis
import json
import hashlib
import logging
from functools import wraps
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

r = redis.Redis(
    host='my-redis-cluster.xxxx.apne1.cache.amazonaws.com',
    port=6379, ssl=True, decode_responses=True,
)

class CacheAside:
    """Cache-Aside pattern implementation"""

    def __init__(self, redis_client, default_ttl=300):
        self.redis = redis_client
        self.default_ttl = default_ttl

    def get_or_set(self, key: str, fetch_fn, ttl: int = None):
        """Return from cache if available, otherwise fetch with fetch_fn and cache"""
        cached = self.redis.get(key)
        if cached is not None:
            logger.debug(f"Cache HIT: {key}")
            return json.loads(cached)

        logger.debug(f"Cache MISS: {key}")
        data = fetch_fn()
        if data is not None:
            self.redis.setex(
                key,
                ttl or self.default_ttl,
                json.dumps(data, default=str),
            )
        return data

    def invalidate(self, key: str):
        """Invalidate cache"""
        self.redis.delete(key)
        logger.debug(f"Cache INVALIDATED: {key}")

    def invalidate_pattern(self, pattern: str):
        """Bulk invalidation of cache entries matching a pattern"""
        cursor = 0
        deleted = 0
        while True:
            cursor, keys = self.redis.scan(cursor, match=pattern, count=100)
            if keys:
                self.redis.delete(*keys)
                deleted += len(keys)
            if cursor == 0:
                break
        logger.info(f"Cache INVALIDATED {deleted} keys matching: {pattern}")

    def cached(self, prefix: str, ttl: int = None):
        """Cache as a decorator"""
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            def wrapper(*args, **kwargs):
                # Generate cache key from arguments
                key_data = f"{prefix}:{args}:{sorted(kwargs.items())}"
                cache_key = f"{prefix}:{hashlib.md5(key_data.encode()).hexdigest()}"
                return self.get_or_set(cache_key, lambda: func(*args, **kwargs), ttl)
            return wrapper
        return decorator

# Usage example
cache = CacheAside(r, default_ttl=600)

def get_user(user_id):
    return cache.get_or_set(
        f"user:{user_id}",
        lambda: db.query("SELECT * FROM users WHERE id = %s", user_id),
        ttl=3600,
    )

def update_user(user_id, data):
    db.execute("UPDATE users SET name = %s WHERE id = %s", data['name'], user_id)
    cache.invalidate(f"user:{user_id}")

# Decorator pattern
@cache.cached("product", ttl=1800)
def get_product(product_id: str):
    return db.query("SELECT * FROM products WHERE id = %s", product_id)
```

### Code Example 3: Write-Through Pattern

```python
class WriteThrough:
    """Write-Through pattern: Synchronous write to both cache and DB"""

    def __init__(self, redis_client, db_client, default_ttl=3600):
        self.redis = redis_client
        self.db = db_client
        self.default_ttl = default_ttl

    def read(self, key: str, query: str, params: tuple):
        cached = self.redis.get(key)
        if cached:
            return json.loads(cached)
        data = self.db.query(query, params)
        if data:
            self.redis.setex(key, self.default_ttl, json.dumps(data, default=str))
        return data

    def write(self, key: str, db_query: str, params: tuple, data: dict):
        # Write to DB first (prevents updating only the cache on failure)
        self.db.execute(db_query, params)
        self.redis.setex(key, self.default_ttl, json.dumps(data, default=str))


class WriteBehind:
    """Write-Behind pattern: Immediate write to cache, asynchronous write to DB"""

    def __init__(self, redis_client, default_ttl=3600):
        self.redis = redis_client
        self.default_ttl = default_ttl
        self.write_queue_key = "write_behind:queue"

    def write(self, key: str, data: dict):
        """Immediate write to cache + add to queue"""
        pipe = self.redis.pipeline()
        pipe.setex(key, self.default_ttl, json.dumps(data, default=str))
        pipe.rpush(self.write_queue_key, json.dumps({
            'key': key,
            'data': data,
            'timestamp': time.time(),
        }))
        pipe.execute()

    def process_queue(self, batch_size: int = 100):
        """Dequeue items in batches and write to DB"""
        items = []
        for _ in range(batch_size):
            item = self.redis.lpop(self.write_queue_key)
            if item is None:
                break
            items.append(json.loads(item))

        if items:
            # Batch write to DB
            db.batch_upsert(items)
            logger.info(f"Write-Behind: processed {len(items)} items")
```

---

## 4. Leveraging Redis Data Structures

### Code Example 4: Practical Use Cases

```python
import redis
import time
import json
from datetime import datetime, timezone

r = redis.Redis(host='my-redis.cache.amazonaws.com', port=6379, ssl=True)

# === Session Management ===
def create_session(session_id: str, user_data: dict, ttl: int = 1800):
    r.hset(f"session:{session_id}", mapping=user_data)
    r.expire(f"session:{session_id}", ttl)

def get_session(session_id: str):
    data = r.hgetall(f"session:{session_id}")
    if data:
        r.expire(f"session:{session_id}", 1800)  # Sliding expiration
    return data

def destroy_session(session_id: str):
    r.delete(f"session:{session_id}")

# === Real-time Leaderboard ===
def add_score(leaderboard: str, user_id: str, score: float):
    r.zadd(f"lb:{leaderboard}", {user_id: score})

def get_top_n(leaderboard: str, n: int = 10):
    return r.zrevrange(f"lb:{leaderboard}", 0, n - 1, withscores=True)

def get_user_rank(leaderboard: str, user_id: str):
    rank = r.zrevrank(f"lb:{leaderboard}", user_id)
    return rank + 1 if rank is not None else None

def get_around_user(leaderboard: str, user_id: str, n: int = 5):
    """Get rankings around a specific user"""
    rank = r.zrevrank(f"lb:{leaderboard}", user_id)
    if rank is None:
        return None
    start = max(0, rank - n)
    end = rank + n
    return r.zrevrange(f"lb:{leaderboard}", start, end, withscores=True)

# === Rate Limiter (Sliding Window) ===
def is_rate_limited(user_id: str, max_requests: int = 100, window: int = 60):
    key = f"rate:{user_id}:{int(time.time()) // window}"
    current = r.incr(key)
    if current == 1:
        r.expire(key, window)
    return current > max_requests

# === High-Precision Rate Limiter (Sliding Log) ===
def is_rate_limited_precise(user_id: str, max_requests: int = 100, window: int = 60):
    """Timestamp-based high-precision rate limiter"""
    key = f"rate:log:{user_id}"
    now = time.time()
    window_start = now - window

    pipe = r.pipeline()
    pipe.zremrangebyscore(key, 0, window_start)  # Remove old entries
    pipe.zadd(key, {f"{now}": now})  # Add current request
    pipe.zcard(key)  # Get request count within window
    pipe.expire(key, window)
    results = pipe.execute()

    return results[2] > max_requests

# === Distributed Lock ===
def acquire_lock(lock_name: str, ttl: int = 10):
    token = str(time.time())
    acquired = r.set(f"lock:{lock_name}", token, nx=True, ex=ttl)
    return token if acquired else None

def release_lock(lock_name: str, token: str):
    script = """
    if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
    else
        return 0
    end
    """
    r.eval(script, 1, f"lock:{lock_name}", token)

# === Pub/Sub Messaging ===
def publish_event(channel: str, event_type: str, data: dict):
    message = json.dumps({
        'type': event_type,
        'data': data,
        'timestamp': datetime.now(timezone.utc).isoformat(),
    })
    r.publish(channel, message)

def subscribe_events(channel: str, callback):
    """Subscribe to events (blocking)"""
    pubsub = r.pubsub()
    pubsub.subscribe(channel)
    for message in pubsub.listen():
        if message['type'] == 'message':
            event = json.loads(message['data'])
            callback(event)

# === Redis Streams (Event Log) ===
def add_to_stream(stream: str, data: dict, maxlen: int = 10000):
    """Add an event to Redis Streams"""
    r.xadd(
        f"stream:{stream}",
        data,
        maxlen=maxlen,
        approximate=True,
    )

def read_stream(stream: str, last_id: str = '0', count: int = 100):
    """Read events from Redis Streams"""
    return r.xread(
        {f"stream:{stream}": last_id},
        count=count,
        block=5000,  # Block for 5 seconds
    )

# === Counter (HyperLogLog) ===
def add_unique_visitor(page: str, visitor_id: str):
    """Count unique visitors (memory efficient)"""
    r.pfadd(f"uv:{page}:{datetime.now().strftime('%Y-%m-%d')}", visitor_id)

def get_unique_visitors(page: str, date: str = None):
    """Get unique visitor count (0.81% error margin)"""
    if date is None:
        date = datetime.now().strftime('%Y-%m-%d')
    return r.pfcount(f"uv:{page}:{date}")

# === Geospatial (Location Data) ===
def add_location(key: str, name: str, longitude: float, latitude: float):
    """Add location data"""
    r.geoadd(f"geo:{key}", (longitude, latitude, name))

def find_nearby(key: str, longitude: float, latitude: float, radius_km: float):
    """Search for nearby locations"""
    return r.geosearch(
        f"geo:{key}",
        longitude=longitude,
        latitude=latitude,
        radius=radius_km,
        unit='km',
        sort='ASC',
        withcoord=True,
        withdist=True,
    )
```

### Code Example 5: ElastiCache Definition with Terraform

```hcl
# サブネットグループ
resource "aws_elasticache_subnet_group" "redis" {
  name       = "app-redis-subnet"
  subnet_ids = var.private_subnet_ids

  tags = { Environment = var.environment }
}

# セキュリティグループ
resource "aws_security_group" "redis" {
  name        = "app-redis-sg"
  description = "Security group for Redis cluster"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.app_security_group_id]
    description     = "Allow Redis access from app servers"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "app-redis-sg" }
}

# Redis クラスター
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "app-redis-${var.environment}"
  description          = "${var.environment} Redis Cluster"

  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type

  num_node_groups         = var.num_shards
  replicas_per_node_group = var.replicas_per_shard

  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  automatic_failover_enabled = true
  multi_az_enabled           = true

  snapshot_retention_limit = 7
  snapshot_window          = "03:00-05:00"
  maintenance_window       = "Mon:05:00-Mon:06:00"

  parameter_group_name = aws_elasticache_parameter_group.redis71.name

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow_log.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_engine_log.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "engine-log"
  }

  tags = {
    Environment = var.environment
    Service     = "cache"
  }
}

resource "aws_elasticache_parameter_group" "redis71" {
  family = "redis7"
  name   = "app-redis71-params-${var.environment}"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"  # 期限切れイベントを通知
  }

  parameter {
    name  = "timeout"
    value = "300"  # アイドル接続のタイムアウト（秒）
  }

  parameter {
    name  = "tcp-keepalive"
    value = "60"
  }
}

# CloudWatch ロググループ
resource "aws_cloudwatch_log_group" "redis_slow_log" {
  name              = "/elasticache/${var.environment}/redis/slow-log"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "redis_engine_log" {
  name              = "/elasticache/${var.environment}/redis/engine-log"
  retention_in_days = 30
}

# 出力
output "redis_primary_endpoint" {
  value = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "redis_reader_endpoint" {
  value = aws_elasticache_replication_group.redis.reader_endpoint_address
}

output "redis_configuration_endpoint" {
  value = aws_elasticache_replication_group.redis.configuration_endpoint_address
}
```

### Code Example 5b: CloudFormation Definition

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: ElastiCache Redis Cluster

Parameters:
  Environment:
    Type: String
    Default: production
  NodeType:
    Type: String
    Default: cache.r7g.large
  NumShards:
    Type: Number
    Default: 3
  ReplicasPerShard:
    Type: Number
    Default: 2

Resources:
  RedisSubnetGroup:
    Type: AWS::ElastiCache::SubnetGroup
    Properties:
      Description: Subnet group for Redis
      SubnetIds:
        - !Ref PrivateSubnet1
        - !Ref PrivateSubnet2
        - !Ref PrivateSubnet3

  RedisParameterGroup:
    Type: AWS::ElastiCache::ParameterGroup
    Properties:
      CacheParameterGroupFamily: redis7
      Description: Custom Redis 7 parameters
      Properties:
        maxmemory-policy: allkeys-lru
        notify-keyspace-events: Ex
        timeout: '300'

  RedisCluster:
    Type: AWS::ElastiCache::ReplicationGroup
    Properties:
      ReplicationGroupDescription: !Sub '${Environment} Redis Cluster'
      Engine: redis
      EngineVersion: '7.1'
      CacheNodeType: !Ref NodeType
      NumNodeGroups: !Ref NumShards
      ReplicasPerNodeGroup: !Ref ReplicasPerShard
      CacheSubnetGroupName: !Ref RedisSubnetGroup
      CacheParameterGroupName: !Ref RedisParameterGroup
      SecurityGroupIds:
        - !Ref RedisSecurityGroup
      AtRestEncryptionEnabled: true
      TransitEncryptionEnabled: true
      AutomaticFailoverEnabled: true
      MultiAZEnabled: true
      SnapshotRetentionLimit: 7
      SnapshotWindow: '03:00-05:00'
      PreferredMaintenanceWindow: 'Mon:05:00-Mon:06:00'
      Tags:
        - Key: Environment
          Value: !Ref Environment

Outputs:
  PrimaryEndpoint:
    Value: !GetAtt RedisCluster.PrimaryEndPoint.Address
  ReaderEndpoint:
    Value: !GetAtt RedisCluster.ReaderEndPoint.Address
```

---

## 5. Memory Management and Eviction Policies

```
Eviction Policy Selection Guide
================================

allkeys-lru    --> Evict using LRU from all keys (most common)
volatile-lru   --> Evict using LRU from keys with TTL
allkeys-lfu    --> Evict using LFU from all keys (frequency-based)
volatile-lfu   --> Evict using LFU from keys with TTL
volatile-ttl   --> Evict keys with nearest TTL
allkeys-random --> Evict random keys from all keys
noeviction     --> Return error without eviction (when data loss is unacceptable)

Recommendations:
  Cache use case        --> allkeys-lru or allkeys-lfu
  Session use case      --> volatile-lru
  Mixed persistent data --> volatile-lru
  No data loss allowed  --> noeviction (memory monitoring required)
```

### Analyzing Memory Usage

```bash
# Redis のメモリ情報を取得
redis-cli -h my-redis-cluster.xxxx.apne1.cache.amazonaws.com \
  --tls -p 6379 INFO memory

# メモリ使用量の詳細（Redis 4.0+）
redis-cli -h my-redis-cluster.xxxx.apne1.cache.amazonaws.com \
  --tls -p 6379 MEMORY DOCTOR

# 特定キーのメモリ使用量
redis-cli -h my-redis-cluster.xxxx.apne1.cache.amazonaws.com \
  --tls -p 6379 MEMORY USAGE "user:12345"

# 大きなキーの検出
redis-cli -h my-redis-cluster.xxxx.apne1.cache.amazonaws.com \
  --tls -p 6379 --bigkeys

# スロークエリログの確認
redis-cli -h my-redis-cluster.xxxx.apne1.cache.amazonaws.com \
  --tls -p 6379 SLOWLOG GET 10
```

### Memory Optimization Best Practices

```
Memory Optimization Checklist:
===============================

1. Data Structure Selection
   - Small hashes (<128 fields) are stored compressed using ziplist
   - Small lists (<128 elements) are stored compressed using ziplist
   - Small sets (<128 elements) are stored compressed using intset/ziplist

2. Key Naming
   - Use short key names (user:123 vs user_profile_data:123)
   - Consistent prefixes (useful for pattern searching with SCAN)

3. TTL Configuration
   - Set TTL on all cache keys
   - Appropriate TTL based on business logic
   - Random TTL offset to prevent stampede

4. Data Compression
   - Compress large JSON with gzip/lz4 before storing
   - Use binary formats like MessagePack

5. Removing Unnecessary Data
   - Use UNLINK (asynchronous deletion)
   - Batch deletion with SCAN + DEL
```

```python
import gzip
import json

class CompressedCache:
    """Compressed cache: stores large data with compression"""

    def __init__(self, redis_client, compression_threshold=1024):
        self.redis = redis_client
        self.threshold = compression_threshold

    def set(self, key: str, data: Any, ttl: int = 3600):
        serialized = json.dumps(data, default=str).encode('utf-8')
        if len(serialized) > self.threshold:
            compressed = gzip.compress(serialized)
            self.redis.setex(f"gz:{key}", ttl, compressed)
        else:
            self.redis.setex(key, ttl, serialized)

    def get(self, key: str) -> Optional[Any]:
        # Check compressed version first
        data = self.redis.get(f"gz:{key}")
        if data is not None:
            return json.loads(gzip.decompress(data))

        data = self.redis.get(key)
        if data is not None:
            return json.loads(data)

        return None
```

---

## 6. High Availability Design

### Cluster Mode Comparison

```
Cluster Mode Disabled:
=======================
  +------------------+
  | Primary          |
  | (Read/Write)     |
  +------------------+
         |
    +----+----+
    |         |
  +-----+  +-----+
  | R1  |  | R2  |  ← Read Replica
  +-----+  +-----+

  Characteristics:
  - Single shard
  - Up to 5 replicas
  - Max memory: node's memory
  - Multi-AZ failover supported


Cluster Mode Enabled:
======================
  Shard 1              Shard 2              Shard 3
  +--------+          +--------+          +--------+
  |Primary |          |Primary |          |Primary |
  |(0-5460)|          |(5461-  |          |(10923- |
  +--------+          |10922)  |          |16383)  |
     |  |             +--------+          +--------+
  +--+ +--+              |  |                |  |
  |R1|  |R2|          +--+ +--+           +--+ +--+
  +--+  +--+          |R1|  |R2|          |R1|  |R2|
                      +--+  +--+          +--+  +--+

  Characteristics:
  - Up to 500 shards
  - Up to 5 replicas per shard
  - Hash slot-based distribution (16384 slots)
  - Online resharding supported
  - Max memory: number of nodes x node memory
```

### Failover Behavior

```
Failover Flow:
===============

1. Primary node failure detection
   ElastiCache → Health check failure (seconds)
                ↓
2. Failover initiation
   ElastiCache → Promote Read Replica to Primary
                ↓
3. DNS update
   Primary Endpoint → Updated to new Primary's IP
                ↓
4. New Primary starts accepting writes
   Downtime: typically 30 seconds to a few minutes

Countermeasures:
  - Implement retry logic on the application side
  - Connection pool refresh mechanism
  - CloudWatch alarm notifications
```

### Code Example 6: Connection Pool Management

```python
import redis
from redis.sentinel import Sentinel
from redis.retry import Retry
from redis.backoff import ExponentialBackoff
import logging

logger = logging.getLogger(__name__)

def create_redis_client(
    host: str,
    port: int = 6379,
    ssl: bool = True,
    max_connections: int = 50,
    socket_timeout: float = 5.0,
    retry_on_timeout: bool = True,
) -> redis.Redis:
    """Create a production-ready Redis client"""

    # Retry configuration
    retry = Retry(ExponentialBackoff(), retries=3)

    pool = redis.ConnectionPool(
        host=host,
        port=port,
        ssl=ssl,
        max_connections=max_connections,
        socket_timeout=socket_timeout,
        socket_connect_timeout=5.0,
        socket_keepalive=True,
        health_check_interval=30,
        retry_on_timeout=retry_on_timeout,
        retry=retry,
        decode_responses=True,
    )

    client = redis.Redis(connection_pool=pool)

    # Connection test
    try:
        client.ping()
        logger.info(f"Redis connection established: {host}:{port}")
    except redis.ConnectionError as e:
        logger.error(f"Redis connection failed: {e}")
        raise

    return client


def create_cluster_client(
    host: str,
    port: int = 6379,
    ssl: bool = True,
) -> redis.RedisCluster:
    """Client for cluster mode enabled"""

    return redis.RedisCluster(
        host=host,
        port=port,
        ssl=ssl,
        decode_responses=True,
        skip_full_coverage_check=True,
        socket_timeout=5.0,
        retry_on_timeout=True,
    )
```

---

## 7. CloudWatch Monitoring

### Key Metrics List

| Metric | Description | Alarm Threshold |
|---|---|---|
| CacheHitRate | Cache hit rate | < 80% |
| CPUUtilization | CPU usage | > 70% |
| EngineCPUUtilization | Redis engine CPU | > 90% |
| DatabaseMemoryUsagePercentage | Memory usage | > 75% |
| CurrConnections | Current connections | > 80% of max |
| Evictions | Eviction count | > 0 (monitor) |
| ReplicationLag | Replication lag | > 1 second |
| SwapUsage | Swap usage | > 0 (investigate) |
| NetworkBandwidthInAllowanceExceeded | Network bandwidth exceeded | > 0 |

### Code Example 7: CloudWatch Alarm Configuration

```bash
# メモリ使用率アラーム
aws cloudwatch put-metric-alarm \
  --alarm-name "Redis-MemoryUsage-High" \
  --alarm-description "Redis memory usage exceeds 75%" \
  --metric-name DatabaseMemoryUsagePercentage \
  --namespace AWS/ElastiCache \
  --statistic Average \
  --period 300 \
  --threshold 75 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 3 \
  --dimensions \
    Name=CacheClusterId,Value=my-redis-cluster-001 \
  --alarm-actions arn:aws:sns:ap-northeast-1:123456789012:alerts

# キャッシュヒット率アラーム
aws cloudwatch put-metric-alarm \
  --alarm-name "Redis-CacheHitRate-Low" \
  --alarm-description "Cache hit rate below 80%" \
  --metric-name CacheHitRate \
  --namespace AWS/ElastiCache \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator LessThanThreshold \
  --evaluation-periods 3 \
  --dimensions \
    Name=CacheClusterId,Value=my-redis-cluster-001 \
  --alarm-actions arn:aws:sns:ap-northeast-1:123456789012:alerts

# CPU 使用率アラーム
aws cloudwatch put-metric-alarm \
  --alarm-name "Redis-CPU-High" \
  --alarm-description "Redis engine CPU exceeds 90%" \
  --metric-name EngineCPUUtilization \
  --namespace AWS/ElastiCache \
  --statistic Average \
  --period 60 \
  --threshold 90 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 5 \
  --dimensions \
    Name=CacheClusterId,Value=my-redis-cluster-001 \
  --alarm-actions arn:aws:sns:ap-northeast-1:123456789012:alerts

# エビクションアラーム
aws cloudwatch put-metric-alarm \
  --alarm-name "Redis-Evictions" \
  --alarm-description "Redis evictions detected" \
  --metric-name Evictions \
  --namespace AWS/ElastiCache \
  --statistic Sum \
  --period 300 \
  --threshold 100 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions \
    Name=CacheClusterId,Value=my-redis-cluster-001 \
  --alarm-actions arn:aws:sns:ap-northeast-1:123456789012:alerts

# レプリケーション遅延アラーム
aws cloudwatch put-metric-alarm \
  --alarm-name "Redis-ReplicationLag" \
  --alarm-description "Redis replication lag exceeds 1 second" \
  --metric-name ReplicationLag \
  --namespace AWS/ElastiCache \
  --statistic Maximum \
  --period 60 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 3 \
  --dimensions \
    Name=CacheClusterId,Value=my-redis-cluster-002 \
  --alarm-actions arn:aws:sns:ap-northeast-1:123456789012:alerts
```

---

## 8. Backup and Restore

```bash
# 手動スナップショットの作成
aws elasticache create-snapshot \
  --replication-group-id my-redis-cluster \
  --snapshot-name "manual-backup-$(date +%Y%m%d)"

# スナップショットの一覧
aws elasticache describe-snapshots \
  --replication-group-id my-redis-cluster \
  --query 'Snapshots[*].{Name:SnapshotName,Status:SnapshotStatus,Time:NodeSnapshots[0].SnapshotCreateTime}'

# スナップショットからのリストア（新しいクラスターとして）
aws elasticache create-replication-group \
  --replication-group-id my-redis-restored \
  --replication-group-description "Restored from snapshot" \
  --snapshot-name "manual-backup-20260215" \
  --engine redis \
  --engine-version 7.1 \
  --node-type cache.r7g.large \
  --num-node-groups 3 \
  --replicas-per-node-group 2 \
  --cache-subnet-group-name my-cache-subnet \
  --security-group-ids sg-0abc123

# S3 へのスナップショットエクスポート
aws elasticache copy-snapshot \
  --source-snapshot-name "manual-backup-20260215" \
  --target-snapshot-name "s3-export-20260215" \
  --target-bucket my-redis-backups

# スナップショットの削除
aws elasticache delete-snapshot \
  --snapshot-name "manual-backup-20260215"
```

---

## 9. Security Design

### Authentication and Encryption

```
ElastiCache Security Layers:
==============================

1. Network Isolation
   - Placed within VPC (no public access)
   - Placed in private subnets
   - Security groups restrict access sources

2. Encryption
   - Encryption in transit (TLS)
   - Encryption at rest (KMS)

3. Authentication
   - Redis AUTH (password authentication)
   - RBAC (Role-Based Access Control, Redis 7.0+)
   - IAM authentication (ElastiCache Serverless)

4. Auditing
   - CloudTrail (API operation logging)
   - Slow Log (slow query logging)
   - Engine Log (engine event logging)
```

### Code Example 8: Connection with AUTH Authentication

```python
import redis

# AUTH パスワード認証
r = redis.Redis(
    host='my-redis-cluster.xxxx.apne1.cache.amazonaws.com',
    port=6379,
    password='MySecurePassword123!',
    ssl=True,
    ssl_cert_reqs='required',
    ssl_ca_certs='/etc/ssl/certs/ca-certificates.crt',
    decode_responses=True,
)

# RBAC 認証（Redis 7.0+）
r_rbac = redis.Redis(
    host='my-redis-cluster.xxxx.apne1.cache.amazonaws.com',
    port=6379,
    username='app-user',
    password='AppUserPassword123!',
    ssl=True,
    decode_responses=True,
)
```

```bash
# RBAC ユーザーの作成
aws elasticache create-user \
  --user-id app-readonly \
  --user-name app-readonly \
  --engine redis \
  --passwords "ReadOnlyPassword123!" \
  --access-string "on ~app:* +get +mget +hget +hgetall -@write"

# ユーザーグループの作成
aws elasticache create-user-group \
  --user-group-id app-users \
  --engine redis \
  --user-ids default app-readonly

# ユーザーグループをクラスターに割り当て
aws elasticache modify-replication-group \
  --replication-group-id my-redis-cluster \
  --user-group-ids-to-add app-users
```

---

## Anti-patterns

### 1. Cache Stampede (Thundering Herd)

**Problem**: When a popular key's TTL expires, a flood of requests simultaneously experience a cache miss, all rushing to the database at once.

```python
# [NG] 単純な Cache-Aside
def get_popular_item(item_id):
    cached = redis.get(f"item:{item_id}")
    if cached is None:
        # 100リクエストが同時にここに到達 --> DB 過負荷
        data = db.query("SELECT * FROM items WHERE id = %s", item_id)
        redis.setex(f"item:{item_id}", 300, json.dumps(data))
        return data
    return json.loads(cached)

# [OK] ロック + 確率的早期再計算
import random

def get_popular_item_safe(item_id):
    key = f"item:{item_id}"
    cached = redis.get(key)
    if cached is not None:
        ttl = redis.ttl(key)
        if ttl < 30 and random.random() < 0.1:
            _refresh_cache(key, item_id)  # 確率的早期更新
        return json.loads(cached)

    lock_key = f"lock:{key}"
    if redis.set(lock_key, "1", nx=True, ex=5):
        try:
            data = db.query("SELECT * FROM items WHERE id = %s", item_id)
            redis.setex(key, 300, json.dumps(data))
            return data
        finally:
            redis.delete(lock_key)
    else:
        time.sleep(0.1)
        return get_popular_item_safe(item_id)

# [OK] TTL にジッターを追加
import random

def set_with_jitter(key: str, data: Any, base_ttl: int = 300):
    """TTL にランダムなジッターを追加してスタンピードを防止"""
    jitter = random.randint(0, int(base_ttl * 0.1))  # 10% のジッター
    redis.setex(key, base_ttl + jitter, json.dumps(data, default=str))
```

### 2. Storing Huge Keys

**Problem**: Storing several MB of data in a single key causes blocking during reads and writes, degrading performance across the entire cluster. The impact is significant because Redis processes commands in a single thread.

**Solution**: Split large data into multiple keys. Use `LRANGE` for list pagination and `HSCAN` for partial hash retrieval. Aim to keep each key under 100KB.

### 3. Using the KEYS Command

**Problem**: `KEYS *` is a blocking operation that makes Redis unresponsive.

```python
# [NG] KEYS コマンド（本番環境で絶対に使用禁止）
keys = redis.keys("user:*")  # テーブルスキャンと同じ

# [OK] SCAN コマンド（ノンブロッキング）
cursor = 0
keys = []
while True:
    cursor, batch = redis.scan(cursor, match="user:*", count=100)
    keys.extend(batch)
    if cursor == 0:
        break
```

### 4. Poor Connection Management

**Problem**: Creating a new connection on every invocation in short-lived processes like Lambda causes connection count explosion.

```python
# [NG] 関数呼び出しごとに接続作成
def handler(event, context):
    r = redis.Redis(host='...', port=6379)  # 毎回新しい接続
    data = r.get("key")
    r.close()  # 明示的にクローズしても、同時実行時に接続数が膨れる

# [OK] グローバルスコープで接続を再利用
r = redis.Redis(
    host='...',
    port=6379,
    socket_timeout=5,
    socket_connect_timeout=5,
    retry_on_timeout=True,
)

def handler(event, context):
    data = r.get("key")  # 既存の接続を再利用
```


---

## Hands-on Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Create test code as well

```python
# 演習1: 基本実装のテンプレート
class Exercise1:
    """基本的な実装パターンの演習"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """入力値の検証"""
        if value is None:
            raise ValueError("入力値がNoneです")
        return True

    def process(self, value):
        """データ処理のメインロジック"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """処理結果の取得"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# テスト
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "例外が発生するべき"
    except ValueError:
        pass

    print("全テスト合格!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation by adding the following features.

```python
# 演習2: 応用パターン
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """応用パターンの演習"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """アイテムの追加（サイズ制限付き）"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """キーによる検索"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """キーによる削除"""
        for i, item in enumerate(self._items):
            if item['key'] == key:
                self._items.pop(i)
                return True
        return False

    def stats(self) -> Dict:
        """統計情報"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# テスト
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # サイズ制限
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("応用テスト全合格!")

test_advanced()
```

### Exercise 3: Performance Optimization

Improve the performance of the following code.

```python
# 演習3: パフォーマンス最適化
import time
from functools import lru_cache

# 最適化前（O(n^2)）
def slow_search(data: list, target: int) -> int:
    """非効率な検索"""
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[i] + data[j] == target:
                return (i, j)
    return (-1, -1)

# 最適化後（O(n)）
def fast_search(data: list, target: int) -> tuple:
    """ハッシュマップを使った効率的な検索"""
    seen = {}
    for i, num in enumerate(data):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (-1, -1)

# ベンチマーク
def benchmark():
    import random
    data = list(range(5000))
    random.shuffle(data)
    target = data[100] + data[4000]

    start = time.time()
    result1 = slow_search(data, target)
    slow_time = time.time() - start

    start = time.time()
    result2 = fast_search(data, target)
    fast_time = time.time() - start

    print(f"非効率版: {slow_time:.4f}秒")
    print(f"効率版:   {fast_time:.6f}秒")
    print(f"高速化率: {slow_time/fast_time:.0f}倍")

benchmark()
```

**Key Points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks
---

## FAQ

### Q1: How should I choose between ElastiCache and DynamoDB DAX?

**A**:
- **ElastiCache**: General-purpose cache. Can cache anything including RDS, DynamoDB, and API responses. Also supports custom data structures for session management, leaderboards, etc.
- **DAX**: DynamoDB-dedicated cache. Accelerates DynamoDB reads with minimal application code changes.

Choose DAX for caching DynamoDB only, and ElastiCache when you need multiple data sources or advanced data structures.

### Q2: What happens when Redis runs out of memory?

**A**: It depends on the eviction policy. With `allkeys-lru`, old keys are automatically evicted. With `noeviction`, write errors are returned. Monitor `DatabaseMemoryUsagePercentage` in CloudWatch and set alerts when it exceeds 75%.

### Q3: How do I decide whether to enable or disable Redis cluster mode?

**A**: If data fits in a single node's memory, disable it (simpler). Enable it (sharding) when data is large or you need to scale write throughput. Note that with cluster mode enabled, multi-key operations are restricted (same slot only), so verify alignment with your access patterns.

### Q4: How do I scale ElastiCache?

**A**: The following methods are available:
1. **Scale Up**: Change the node type (with downtime)
2. **Scale Out (reads)**: Add replica nodes (up to 5)
3. **Add Shards (cluster mode)**: Add shards via online resharding
4. **ElastiCache Serverless**: Serverless option with automatic scaling

```bash
# レプリカの追加
aws elasticache increase-replica-count \
  --replication-group-id my-redis-cluster \
  --new-replica-count 3 \
  --apply-immediately

# ノードタイプの変更（スケールアップ）
aws elasticache modify-replication-group \
  --replication-group-id my-redis-cluster \
  --cache-node-type cache.r7g.xlarge \
  --apply-immediately

# シャードの追加（クラスターモード有効時）
aws elasticache modify-replication-group-shard-configuration \
  --replication-group-id my-redis-cluster \
  --node-group-count 5 \
  --apply-immediately
```

### Q5: What is ElastiCache Serverless?

**A**: Announced in 2023, this is a new option that automatically manages capacity auto-scaling and patching. It uses pay-per-use pricing based on ECPU (ElastiCache Processing Unit) and data storage volume, flexibly accommodating everything from small to large scale. However, compared to traditional node-based pricing, the per-unit cost is higher, so traditional node-based instances are more cost-effective for stable, high-load workloads.

---

## Summary

| Item | Key Points |
|---|---|
| Service Overview | Fully managed in-memory cache. Choose between Redis / Memcached |
| Engine Selection | When in doubt, choose Redis. Supports data structures, persistence, and replication |
| Caching Strategy | Cache-Aside is the default. Use Write-Behind for high write frequency |
| High Availability | Ensure availability with Multi-AZ + automatic failover |
| Memory Management | allkeys-lru is standard. Consider scaling at 75%+ usage |
| Monitoring | CacheHitRate, CPUUtilization, and DatabaseMemoryUsage are key metrics |
| Security | VPC placement + TLS + AUTH/RBAC + encryption at rest |
| Backup | Automatic snapshots (up to 35 days) + manual snapshots |
| Scaling | Add replicas (reads), resharding (writes), change node type |

## Recommended Next Guides

- [RDS Basics](./00-rds-basics.md) --- Relational databases as cache targets
- [DynamoDB](./01-dynamodb.md) --- Combination patterns with NoSQL
- [VPC Basics](../04-networking/00-vpc-basics.md) --- Network placement for ElastiCache

## References

1. **AWS Official Documentation**: [Amazon ElastiCache for Redis User Guide](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/) --- Detailed reference for configuration and operations
2. **Redis Official**: [Redis Documentation](https://redis.io/docs/) --- Data structures and command reference
3. **AWS Architecture Blog**: [Caching Best Practices](https://aws.amazon.com/caching/best-practices/) --- Caching strategy guide for AWS
4. **AWS Well-Architected**: [Performance Efficiency Pillar](https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/) --- Best practices for cache design
5. **Redis University**: [Redis University](https://university.redis.com/) --- Free online learning courses

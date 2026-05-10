# NoSQL Comparison

> Compare the characteristics of MongoDB, Redis, and DynamoDB, and practically master how to use them alongside RDBs and design strategies for polyglot persistence. This chapter dives deep from the theoretical background of NoSQL through the internal architecture of each database, data modeling patterns, and performance characteristics, providing the knowledge needed to design hybrid architectures in production environments.

## Prerequisites

- [01-schema-design.md](../02-design/01-schema-design.md) — Understanding RDB schema design
- [02-joins.md](../00-basics/02-joins.md) — Understanding JOIN concepts
- Foundational concepts of distributed systems (replication, partitioning)

## What You Will Learn

1. **NoSQL Classification and Characteristics** — Differences between document, KVS, wide-column, and graph types
2. **Comparison of Major NoSQL Databases** — Design philosophies and use cases for MongoDB, Redis, and DynamoDB
3. **CAP Theorem and Consistency Models** — Understanding tradeoffs in distributed systems
4. **Polyglot Persistence** — Hybrid architectures combining RDB and NoSQL
5. **Data Modeling Differences** — Design decisions between normalization and denormalization
6. **Migration Decision Framework** — Criteria for deciding when to migrate from RDB to NoSQL

---

## 1. NoSQL Classification

### Historical Background of NoSQL

NoSQL (Not Only SQL) is a concept that gained traction around 2009, born to overcome the limitations of RDBs. The main motivations were as follows.

```
Background of NoSQL's Birth
==================

Challenges in the late 2000s:
  1. Scale requirements of Web 2.0
     - Data of billions of users
     - Petabyte-scale storage
     - Sub-millisecond latency

  2. Scaling limits of RDBs
     - Vertical scaling (scale-up) has hardware limits
     - Horizontal scaling (sharding) is complex and restricts JOINs

  3. Demand for schema flexibility
     - Increased frequency of schema changes in agile development
     - Diverse data formats (JSON, images, time series, etc.)

  4. Rising availability requirements
     - Demand for 24/7 operation
     - Geo-distributed replication

Major innovations:
  2006: Google Bigtable paper
  2007: Amazon Dynamo paper
  2009: MongoDB released
  2010: Redis 1.0 released
  2012: DynamoDB service launched
```

### Classification of NoSQL Databases

```
Classification of NoSQL Databases
==========================

+-------------------+  +-------------------+
| Document          |  | Key-Value         |
| MongoDB, CouchDB  |  | Redis, Memcached  |
| Firestore         |  | Valkey, KeyDB     |
| --> JSON/BSON docs|  | --> Fast KV       |
| --> Flexible schema|  | --> Caching      |
| --> Rich queries  |  | --> Data structures|
+-------------------+  +-------------------+

+-------------------+  +-------------------+
| Wide-Column       |  | Graph             |
| DynamoDB,Cassandra|  | Neo4j, Neptune    |
| HBase, ScyllaDB   |  | ArangoDB, JanusGraph|
| --> Large-scale   |  | --> Relationship  |
| --> High writes   |  |     traversal     |
| --> Design is key |  | --> SNS/recommendations|
|                   |  | --> Path search   |
+-------------------+  +-------------------+

+-------------------+  +-------------------+
| Time Series       |  | Search Engine     |
| TimescaleDB,      |  | Elasticsearch     |
| InfluxDB, QuestDB |  | OpenSearch        |
| --> IoT/metrics   |  | --> Full-text     |
| --> Time-based    |  |     search        |
|     aggregation   |  | --> Log analysis  |
+-------------------+  +-------------------+
```

### Code Example 1: Data Models of Each NoSQL

```javascript
// === MongoDB (Document) ===
// Naturally express nested structures with a flexible schema
db.users.insertOne({
  _id: ObjectId("..."),
  name: "Taro",
  email: "taro@example.com",
  address: {
    city: "Tokyo",
    zip: "100-0001",
    prefecture: "東京都"
  },
  orders: [
    { product: "Widget", amount: 1200, date: ISODate("2026-02-01") },
    { product: "Gadget", amount: 3400, date: ISODate("2026-02-10") }
  ],
  tags: ["premium", "early-adopter"],
  metadata: {
    loginCount: 42,
    lastLoginAt: ISODate("2026-02-13"),
    preferences: {
      theme: "dark",
      language: "ja",
      notifications: { email: true, push: false }
    }
  }
});

// Document search (rich query language)
db.users.find({
  "address.city": "Tokyo",
  "orders.amount": { $gt: 2000 },
  tags: { $in: ["premium"] }
}).sort({ "metadata.lastLoginAt": -1 });
```

```python
# === Redis (Key-Value) ===
import redis
r = redis.Redis()

# Simple KV
r.set("user:1:name", "Taro")
r.get("user:1:name")  # → b"Taro"

# Hash (object-like)
r.hset("user:1", mapping={
    "name": "Taro",
    "email": "taro@example.com",
    "login_count": 42
})
r.hgetall("user:1")  # → {b"name": b"Taro", ...}

# Sorted Set for rankings
r.zadd("leaderboard", {"user:1": 1500, "user:2": 2300, "user:3": 800})
r.zrevrange("leaderboard", 0, 9, withscores=True)  # Top 10

# List as message queue
r.lpush("queue:emails", '{"to": "taro@example.com", "subject": "Welcome"}')
r.brpop("queue:emails", timeout=30)  # Blocking retrieval

# Set for set operations
r.sadd("user:1:interests", "python", "sql", "redis")
r.sadd("user:2:interests", "python", "mongodb", "go")
r.sinter("user:1:interests", "user:2:interests")  # → {b"python"}

# Stream for event streaming (Redis 5.0+)
r.xadd("events:orders", {"action": "created", "order_id": "123"})
r.xread({"events:orders": "0"}, count=10)

# HyperLogLog for cardinality estimation
r.pfadd("daily_visitors:2026-02-13", "user:1", "user:2", "user:3")
r.pfcount("daily_visitors:2026-02-13")  # → 3 (estimated value)
```

```python
# === DynamoDB (Wide-Column) ===
import boto3
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('MyApp')

# Single Table Design: store multiple entities in one table
# Composite key of PK (partition key) + SK (sort key)

# User profile
table.put_item(Item={
    'PK': 'USER#001',
    'SK': 'PROFILE',
    'name': 'Taro',
    'email': 'taro@example.com',
    'created_at': '2026-01-01T00:00:00Z',
    'GSI1PK': 'USER',  # For GSI
    'GSI1SK': 'taro@example.com'
})

# User orders
table.put_item(Item={
    'PK': 'USER#001',
    'SK': 'ORDER#2026-02-01#001',
    'product': 'Widget',
    'amount': Decimal('1200'),
    'status': 'shipped'
})

# Query: all data for user 001 (profile + orders)
response = table.query(
    KeyConditionExpression='PK = :pk',
    ExpressionAttributeValues={':pk': 'USER#001'}
)

# Query: only user 001's orders from February 2026
response = table.query(
    KeyConditionExpression='PK = :pk AND begins_with(SK, :sk_prefix)',
    ExpressionAttributeValues={
        ':pk': 'USER#001',
        ':sk_prefix': 'ORDER#2026-02'
    }
)
```

```cypher
// === Neo4j (Graph) ===
// Cypher query language

// Creating nodes and relationships
CREATE (taro:User {name: "Taro", email: "taro@example.com"})
CREATE (hanako:User {name: "Hanako", email: "hanako@example.com"})
CREATE (python:Skill {name: "Python"})
CREATE (sql:Skill {name: "SQL"})
CREATE (taro)-[:KNOWS]->(hanako)
CREATE (taro)-[:HAS_SKILL {level: "expert"}]->(python)
CREATE (taro)-[:HAS_SKILL {level: "intermediate"}]->(sql)
CREATE (hanako)-[:HAS_SKILL {level: "expert"}]->(sql)

// Friends of friends (2-hop traversal)
MATCH (u:User {name: "Taro"})-[:KNOWS*2]->(fof:User)
WHERE fof <> u
RETURN DISTINCT fof.name

// Recommend users with shared skills
MATCH (u:User {name: "Taro"})-[:HAS_SKILL]->(s:Skill)<-[:HAS_SKILL]-(other:User)
WHERE other <> u
RETURN other.name, collect(s.name) AS shared_skills, count(s) AS skill_count
ORDER BY skill_count DESC
```

---

## 2. Comparison of Major NoSQL Databases

### Overall Comparison Table

| Characteristic | MongoDB | Redis | DynamoDB | Cassandra | Neo4j |
|---|---|---|---|---|---|
| **Category** | Document | KVS + Data Structures | Wide-Column | Wide-Column | Graph |
| **Data Model** | JSON (BSON) | Strings + advanced data structures | Items (collection of attributes) | Rows (column families) | Nodes + Edges |
| **Schema** | Flexible (schemaless) | None | Flexible (only keys are fixed) | Flexible (variable columns) | Flexible |
| **Query** | MQL (rich) | Command-based | Query/Scan (limited) | CQL (SQL-like) | Cypher (graph) |
| **Transactions** | Multi-document (4.0+) | MULTI/EXEC | TransactWriteItems | LWT (limited) | ACID |
| **Consistency** | Configurable | Eventual (Cluster) | Configurable | Configurable | Strong consistency |
| **Scaling** | Sharding | Cluster | Automatic (fully managed) | Ring topology | Federation |
| **Latency** | 1-10ms | < 1ms | 1-10ms | 1-10ms | 1-20ms |
| **Persistence** | Disk (WiredTiger) | Memory + optional persistence | Disk (SSD) | Disk (SSTable) | Disk |
| **Operations** | Self-hosted or Atlas | Self-hosted or ElastiCache | Fully managed | Self-hosted or Astra | Self-hosted or AuraDB |
| **Cost Profile** | Storage-based | Memory-based (expensive) | Request-based | Storage-based | License-based |
| **Max Data Size** | Virtually unlimited | Memory-constrained | 400KB/item | Virtually unlimited | Virtually unlimited |

### Recommended Database by Use Case

| Use Case | Recommended | Reason |
|---|---|---|
| **Primary DB for web apps** | PostgreSQL or MongoDB | Flexible queries needed |
| **Session management** | Redis | Low latency, TTL support |
| **Caching** | Redis | Sub-millisecond response |
| **Real-time rankings** | Redis (Sorted Set) | O(log N) score operations |
| **IoT/time-series data** | DynamoDB or TimescaleDB | High write throughput |
| **Full-text search** | Elasticsearch | Inverted index |
| **Social graph** | Neo4j / Neptune | Fast graph traversal |
| **E-commerce catalog** | MongoDB | Different attributes per product |
| **Serverless API** | DynamoDB | Fully managed, auto-scaling |
| **Message broker** | Redis Streams / Kafka | High throughput, low latency |
| **Configuration management** | Redis / etcd | Fast reads, Pub/Sub |
| **Content management** | MongoDB | Flexible schema, rich queries |
| **Geospatial search** | MongoDB / PostgreSQL+PostGIS | GeoJSON support, spatial index |
| **Recommendation engine** | Neo4j + Redis | Graph traversal + caching |
| **Logs/audit trails** | Elasticsearch / DynamoDB | High writes, search support |

### Internal Architecture Comparison

```
MongoDB Architecture
=========================

  Client → mongos (Router)
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
    Shard 1      Shard 2      Shard 3
    ┌─────┐     ┌─────┐     ┌─────┐
    │ P   │     │ P   │     │ P   │
    │ S S │     │ S S │     │ S S │
    └─────┘     └─────┘     └─────┘
    (Replica Set)

  P = Primary (writes)
  S = Secondary (reads/failover)

  Storage Engine: WiredTiger
  - B-Tree indexes
  - Document-level locking (high concurrency)
  - Snapshot isolation (MVCC)
  - Compression (snappy, zlib, zstd)


Redis Architecture
=======================

  Client → Redis Cluster
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
    Slot 0-5460  Slot 5461-10922 Slot 10923-16383
    ┌─────┐     ┌─────┐        ┌─────┐
    │ M   │     │ M   │        │ M   │
    │  R  │     │  R  │        │  R  │
    └─────┘     └─────┘        └─────┘

  M = Master
  R = Replica
  Keys are distributed across 16384 hash slots

  Memory management:
  - All data held in memory
  - Persistence: RDB (snapshots) / AOF (append-only log)
  - Memory limit: maxmemory setting
  - Eviction policies: allkeys-lru, volatile-ttl, etc.


DynamoDB Architecture
=========================

  Client → DynamoDB Endpoint
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   Partition 1  Partition 2  Partition 3
   (10GB max)   (10GB max)   (10GB max)
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │ Leader  │  │ Leader  │  │ Leader  │
   │ Replica │  │ Replica │  │ Replica │
   │ Replica │  │ Replica │  │ Replica │
   └─────────┘  └─────────┘  └─────────┘

  Distributed by hash of partition key
  Automatic replication across 3 AZs
  Automatically split based on capacity and throughput
```

---

## 3. CAP Theorem and Consistency Models

### Accurate Understanding of the CAP Theorem

```
CAP Theorem
==========

        Consistency
           /\
          /  \
         /    \
   CA   / CP   \
  ------+------+------
  RDBMS | MongoDB*  |
  (single) | HBase  |
        |          |
   AP   +----------+   CP
  Cassandra        |
  DynamoDB*     Redis Cluster
  CouchDB

* MongoDB and DynamoDB can be configured to select CA/CP/AP

Correcting a common misconception:
  The CAP theorem is not simply "choose two of three"
  More accurately:
  "When a network partition (P) occurs,
   which do you sacrifice: Consistency (C) or Availability (A)?"

  During normal operation (no partition):
  → All three can largely be achieved
  → Tradeoff between latency and consistency (PACELC theorem)

PACELC Theorem (extension of CAP):
  P (during partition) → Choose A or C
  E (during normal operation) → Choose L (latency) or C (consistency)

  Examples:
  DynamoDB:  PA/EL (availability during partition, low latency during normal)
  MongoDB:   PC/EC (consistency-first, but eventual also possible)
  Cassandra: PA/EL (availability and low latency first)
```

### Consistency Level Comparison

| Consistency Level | Description | Example | Tradeoff |
|---|---|---|---|
| Strong | Latest value readable immediately after write | RDB, DynamoDB (ConsistentRead) | High latency, low throughput |
| Linearizable | All operations visible in real-time order | Spanner, CockroachDB | Most strict, slowest |
| Causal | Guarantees order of causally related operations | MongoDB (causal sessions) | Between strong and eventual |
| Eventual | All replicas eventually converge | Cassandra (ONE), S3 | Fastest but may return stale data |
| Session | Guarantees consistency within the same session | DynamoDB (default), MongoDB | Minimal impact on user experience |

### Code Example 2: Configuring Consistency Levels

```javascript
// MongoDB: configuring read consistency
// Strong consistency (read from primary)
db.orders.find({ userId: "001" }).readConcern("majority");

// Eventual consistency (read from secondary, fast)
db.orders.find({ userId: "001" }).readPref("secondaryPreferred");

// Causal consistency (within session)
const session = db.getMongo().startSession({ causalConsistency: true });
const orders = session.getDatabase("mydb").orders;
orders.insertOne({ userId: "001", product: "Widget" });
// Within the same session, the above insertion result is always visible
orders.find({ userId: "001" });
session.endSession();

// Write acknowledgment level
db.orders.insertOne(
  { userId: "001", product: "Widget" },
  { writeConcern: { w: "majority", j: true, wtimeout: 5000 } }
);
// w: "majority" → confirm write completion on majority of replicas
// j: true → confirm write to journal
// wtimeout: 5000 → error if not completed within 5 seconds
```

```python
# DynamoDB: configuring read consistency
import boto3
table = boto3.resource('dynamodb').Table('MyApp')

# Strong consistency (consumes 2x RCU)
response = table.get_item(
    Key={'PK': 'USER#001', 'SK': 'PROFILE'},
    ConsistentRead=True
)

# Eventual consistency (default, half the RCU)
response = table.get_item(
    Key={'PK': 'USER#001', 'SK': 'PROFILE'},
    ConsistentRead=False
)

# DynamoDB transaction (ACID guaranteed)
client = boto3.client('dynamodb')
client.transact_write_items(
    TransactItems=[
        {
            'Put': {
                'TableName': 'MyApp',
                'Item': {
                    'PK': {'S': 'ORDER#123'},
                    'SK': {'S': 'DETAIL'},
                    'status': {'S': 'confirmed'},
                    'amount': {'N': '5000'}
                },
                'ConditionExpression': 'attribute_not_exists(PK)'
            }
        },
        {
            'Update': {
                'TableName': 'MyApp',
                'Key': {
                    'PK': {'S': 'USER#001'},
                    'SK': {'S': 'PROFILE'}
                },
                'UpdateExpression': 'SET order_count = order_count + :inc',
                'ExpressionAttributeValues': {':inc': {'N': '1'}}
            }
        }
    ]
)
```

```python
# Cassandra: configuring consistency levels
from cassandra.cluster import Cluster
from cassandra import ConsistencyLevel
from cassandra.query import SimpleStatement

cluster = Cluster(['node1', 'node2', 'node3'])
session = cluster.connect('mykeyspace')

# Strong consistency (QUORUM: response from majority of nodes)
statement = SimpleStatement(
    "SELECT * FROM orders WHERE user_id = %s",
    consistency_level=ConsistencyLevel.QUORUM
)
rows = session.execute(statement, ['user001'])

# Eventual consistency (ONE: response from 1 node, fastest)
statement = SimpleStatement(
    "SELECT * FROM orders WHERE user_id = %s",
    consistency_level=ConsistencyLevel.ONE
)

# ALL: response from all nodes (slowest but most consistent)
statement = SimpleStatement(
    "SELECT * FROM orders WHERE user_id = %s",
    consistency_level=ConsistencyLevel.ALL
)
```

---

## 4. Polyglot Persistence

### Code Example 3: Hybrid Architecture

```
Polyglot Persistence Design Example
============================

                   +------------------+
                   | Web Application  |
                   +--------+---------+
                            |
                   +--------+---------+
                   | API Gateway /    |
                   | Service Mesh     |
                   +--------+---------+
                            |
    +-------+-------+-------+-------+-------+
    |       |       |       |       |       |
    v       v       v       v       v       v
+------+ +------+ +-----+ +------+ +------+ +------+
|Postgre| |Mongo | |Redis| |Elastic| |DynamoDB| |Neo4j|
|SQL    | |DB    | |     | |Search | |       | |     |
+------+ +------+ +-----+ +------+ +------+ +------+
 Users   Products  Cache   Search   IoT     Recommendations
 Orders  Catalog   Session Full-text Log     Graph
 Payment Reviews   Ranking Log     Metrics  Relationships
 Stock   CMS      Pub/Sub  analysis         SNS

Data flow:
  PostgreSQL ──(CDC)──> Elasticsearch (search index)
  PostgreSQL ──(CDC)──> Redis (cache warming)
  DynamoDB ──(Streams)──> Lambda ──> OpenSearch
  MongoDB ──(Change Streams)──> Kafka ──> Each service
```

```python
# Polyglot persistence service example
class OrderService:
    def __init__(self):
        self.pg = PostgresClient()       # Transaction processing
        self.redis = RedisClient()       # Cache
        self.mongo = MongoClient()       # Order history (denormalized)
        self.es = ElasticsearchClient()  # Search

    async def create_order(self, order_data):
        # 1. Transaction processing in PostgreSQL (Source of Truth)
        async with self.pg.transaction() as tx:
            order = await tx.execute("""
                INSERT INTO orders (user_id, total, status)
                VALUES ($1, $2, 'pending')
                RETURNING id, created_at
            """, order_data['user_id'], order_data['total'])

            # Decrement stock (same transaction)
            for item in order_data['items']:
                await tx.execute("""
                    UPDATE products SET stock = stock - $1
                    WHERE id = $2 AND stock >= $1
                """, item['quantity'], item['product_id'])

        # 2. Save denormalized data to MongoDB (for fast reads)
        await self.mongo.orders.insert_one({
            'order_id': order['id'],
            'user': order_data['user'],  # Embed user info
            'items': order_data['items'],  # Embed product info
            'total': order_data['total'],
            'status': 'pending',
            'created_at': order['created_at'],
        })

        # 3. Invalidate Redis cache
        await self.redis.delete(f"user:{order_data['user_id']}:orders")
        await self.redis.delete(f"user:{order_data['user_id']}:order_count")

        # 4. Index in Elasticsearch (can be async)
        await self.es.index('orders', {
            'order_id': order['id'],
            'user_name': order_data['user']['name'],
            'items': [i['name'] for i in order_data['items']],
            'total': order_data['total'],
            'status': 'pending',
            'created_at': order['created_at'],
        })

        return order

    async def get_order_history(self, user_id, page=1, per_page=20):
        # Check cache
        cache_key = f"user:{user_id}:orders:page:{page}"
        cached = await self.redis.get(cache_key)
        if cached:
            return json.loads(cached)

        # Read from MongoDB (denormalized data, fast without JOIN)
        orders = await self.mongo.orders.find(
            {'user.id': user_id}
        ).sort('created_at', -1).skip((page - 1) * per_page).limit(per_page).to_list()

        # Store in cache (valid for 5 minutes)
        await self.redis.setex(cache_key, 300, json.dumps(orders))

        return orders

    async def search_orders(self, query, filters=None):
        # Full-text search with Elasticsearch
        body = {
            'query': {
                'bool': {
                    'must': [
                        {'multi_match': {
                            'query': query,
                            'fields': ['items', 'user_name']
                        }}
                    ]
                }
            }
        }
        if filters:
            body['query']['bool']['filter'] = filters

        return await self.es.search(index='orders', body=body)
```

### Data Synchronization Patterns

```
Comparison of Data Synchronization Patterns
==========================

1. Dual Write
   App → Write to DB1
        → Write to DB2
   [Problem] Inconsistency if write to DB2 fails
   [Mitigation] Accept eventual consistency + retry + reconciliation job

2. CDC (Change Data Capture)
   App → Write to DB1
   DB1 → CDC → Sync to DB2
   [Benefit] DB1 is Source of Truth, DB2 is derived
   [Implementation] Debezium, DynamoDB Streams, MongoDB Change Streams

3. Event Sourcing
   App → Event store → Propagate to each DB
   [Benefit] Complete audit trail, restorable to any point in time
   [Drawback] Complex implementation, eventual consistency

4. CQRS (Command Query Responsibility Segregation)
   Write → PostgreSQL (normalized)
   Read  → MongoDB/Redis (denormalized, optimized)
   [Benefit] Scale reads and writes independently
   [Drawback] Sync lag, complexity

Recommended patterns:
  Small scale: Dual Write + reconciliation job
  Medium scale: CDC (Debezium)
  Large scale: Event Sourcing + CQRS
```

---

## 5. Migration Decision from RDB to NoSQL

### Migration Decision Framework

```
RDB → NoSQL Migration Decision Checklist
======================================

Signals to consider NoSQL:
  [?] JOIN across 5+ tables is causing performance issues
  [?] Column count and structure vary significantly between tables
  [?] Write throughput has reached the vertical scaling limit
  [?] Geo-distribution (multi-region) is required
  [?] Schema changes are frequent and operational overhead is high
  [?] Read patterns are limited (mostly PK access)

Signals to stay with RDB:
  [?] Complex ad-hoc queries are needed (analytics/BI)
  [?] Strong consistency is mandatory (finance, inventory management)
  [?] Multi-table ACID transactions are essential
  [?] Complex data relationships (many many-to-many relations)
  [?] Schema-enforced data quality assurance is important
  [?] Want to leverage existing SQL knowledge

Decision flow:
  1. First consider whether PostgreSQL can handle it
  2. Add JSONB columns for flexibility
  3. If read optimization is needed → add Redis cache
  4. Carve out only specific workloads to NoSQL
  5. Full replacement is a last resort
```

### Code Example 4: MongoDB Aggregation

```javascript
// MongoDB pipeline aggregation (equivalent to RDB GROUP BY + JOIN)
db.orders.aggregate([
  // Stage 1: Filter (equivalent to WHERE)
  { $match: {
    status: "shipped",
    createdAt: { $gte: ISODate("2026-01-01") }
  }},

  // Stage 2: Unwind array (equivalent to UNNEST)
  { $unwind: "$items" },

  // Stage 3: Group aggregation (equivalent to GROUP BY)
  { $group: {
      _id: "$items.category",
      totalRevenue: { $sum: "$items.price" },
      orderCount: { $sum: 1 },
      avgPrice: { $avg: "$items.price" },
      maxPrice: { $max: "$items.price" },
      uniqueProducts: { $addToSet: "$items.productId" }
  }},

  // Stage 4: Add computed fields
  { $addFields: {
    uniqueProductCount: { $size: "$uniqueProducts" },
    avgOrderValue: { $divide: ["$totalRevenue", "$orderCount"] }
  }},

  // Stage 5: Sort (equivalent to ORDER BY)
  { $sort: { totalRevenue: -1 } },

  // Stage 6: Limit
  { $limit: 10 },

  // Stage 7: Shape the result
  { $project: {
    category: "$_id",
    totalRevenue: { $round: ["$totalRevenue", 2] },
    orderCount: 1,
    avgPrice: { $round: ["$avgPrice", 2] },
    uniqueProductCount: 1,
    _id: 0
  }}
]);

// $lookup: equivalent to JOIN (but an anti-pattern in NoSQL)
db.orders.aggregate([
  { $lookup: {
    from: "users",
    localField: "userId",
    foreignField: "_id",
    as: "user"
  }},
  { $unwind: "$user" },
  { $project: {
    orderId: "$_id",
    userName: "$user.name",
    total: 1,
    status: 1
  }}
]);
// Note: $lookup degrades performance in sharded environments
// → Should be avoided via denormalization (embedding)
```

### Code Example 5: Data Modeling Comparison — RDB vs NoSQL

```sql
-- RDB: Normalized model (4 tables + JOIN)
-- Third normal form: no data duplication, no update anomalies
SELECT
    u.name,
    o.id AS order_id,
    o.order_date,
    p.name AS product_name,
    p.category,
    oi.quantity,
    oi.unit_price
FROM users u
JOIN orders o ON u.id = o.user_id
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id
WHERE u.id = 12345;
-- 4-table join → complex but data integrity is guaranteed
```

```javascript
// MongoDB: Denormalized model (self-contained in one document)
// Data duplication exists but reads are fast
db.orders.findOne({
  userId: 12345
}, {
  "user.name": 1,
  "items.productName": 1,
  "items.category": 1,
  "items.quantity": 1,
  "items.unitPrice": 1,
  "orderDate": 1
});

// Example document structure:
{
  _id: ObjectId("..."),
  userId: 12345,
  user: {               // Embed user info
    name: "田中太郎",
    email: "tanaka@example.com"
  },
  orderDate: ISODate("2026-02-01"),
  status: "shipped",
  items: [              // Embed product info
    {
      productId: 100,
      productName: "ノートPC",
      category: "家電",
      quantity: 1,
      unitPrice: 120000
    },
    {
      productId: 201,
      productName: "マウス",
      category: "周辺機器",
      quantity: 2,
      unitPrice: 3000
    }
  ],
  total: 126000,
  shippingAddress: {
    zip: "100-0001",
    city: "東京都千代田区"
  }
}
// All data retrieved in one query (no JOIN needed)
// However, changing a user's name requires updating all order documents
```

### Data Modeling Tradeoffs

```
RDB vs NoSQL Tradeoffs
==============================

RDB (normalized):
  [+] High data integrity (single source of truth)
  [+] Good at complex queries/aggregations
  [+] Schema ensures data quality
  [+] ACID transactions
  [+] Easy ad-hoc queries
  [-] Performance degrades with many JOINs
  [-] Difficult to scale out
  [-] Schema changes require effort

NoSQL (denormalized):
  [+] Fast reads (no JOIN needed)
  [+] Easy to scale out
  [+] Schema flexibility
  [+] Geo-distributed replication
  [-] Data duplication (complex updates)
  [-] Poor at complex queries
  [-] Transaction limitations
  [-] Weaker data integrity guarantees

Hybrid approach:
  PostgreSQL + JSONB:
  [+] Best of both relational and document worlds
  [+] Use both patterns in the same DB
  [+] JSONB can be operated within ACID transactions
  [-] Large-scale scale-out is inferior to NoSQL
```

### Code Example 6: PostgreSQL JSONB vs MongoDB

```sql
-- PostgreSQL JSONB: achieve document-like flexibility within RDB

-- Table definition (fixed columns + JSONB)
CREATE TABLE products (
    id       SERIAL PRIMARY KEY,
    name     VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    price    DECIMAL(10, 2) NOT NULL,
    attrs    JSONB DEFAULT '{}'  -- Variable attributes
);

-- Store different attributes per category
INSERT INTO products (name, category, price, attrs) VALUES
('ノートPC', '家電', 120000, '{
    "brand": "Dell",
    "cpu": "Core i7",
    "ram_gb": 16,
    "storage": {"type": "SSD", "size_gb": 512},
    "ports": ["USB-C", "HDMI", "USB-A"]
}'),
('Tシャツ', 'アパレル', 3000, '{
    "brand": "Uniqlo",
    "size": "M",
    "color": "black",
    "material": "cotton"
}');

-- JSONB queries (fast with GIN index)
CREATE INDEX idx_products_attrs ON products USING GIN (attrs);

-- Search by specific attribute value
SELECT name, price, attrs->>'brand' AS brand
FROM products
WHERE attrs->>'cpu' = 'Core i7';

-- Search nested attributes
SELECT name, attrs->'storage'->>'type' AS storage_type
FROM products
WHERE (attrs->'storage'->>'size_gb')::int >= 256;

-- Search within array
SELECT name FROM products
WHERE attrs->'ports' ? 'USB-C';

-- JSONB aggregation
SELECT
    attrs->>'brand' AS brand,
    COUNT(*) AS product_count,
    AVG(price) AS avg_price
FROM products
GROUP BY attrs->>'brand';
```

---

## 6. DynamoDB Single Table Design

### Code Example 7: DynamoDB Single Table Design

```
DynamoDB Single Table Design
==================================

Access patterns:
  1. Retrieve user profile
  2. List of user's orders
  3. Order details
  4. Search user by email

Table design:
  PK             | SK                    | Attributes
  ===============|=======================|============
  USER#001       | PROFILE               | name, email
  USER#001       | ORDER#2026-02-01#001  | total, status
  USER#001       | ORDER#2026-02-10#002  | total, status
  ORDER#001      | ITEM#001              | product, qty
  ORDER#001      | ITEM#002              | product, qty
  -----------------------------------------------
  GSI1PK         | GSI1SK                |
  USER           | taro@example.com      | (for user search)
  ORDER          | 2026-02-01            | (for date-ordered search)
```

```python
# DynamoDB single table design implementation
import boto3
from datetime import datetime
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('MyApp')

class UserRepository:
    def create_user(self, user_id, name, email):
        """Create a user"""
        table.put_item(Item={
            'PK': f'USER#{user_id}',
            'SK': 'PROFILE',
            'name': name,
            'email': email,
            'created_at': datetime.utcnow().isoformat(),
            'GSI1PK': 'USER',
            'GSI1SK': email  # Searchable by email
        })

    def get_user(self, user_id):
        """Retrieve user profile"""
        response = table.get_item(
            Key={'PK': f'USER#{user_id}', 'SK': 'PROFILE'}
        )
        return response.get('Item')

    def get_user_with_orders(self, user_id):
        """User profile + order list (1 query)"""
        response = table.query(
            KeyConditionExpression='PK = :pk',
            ExpressionAttributeValues={':pk': f'USER#{user_id}'}
        )
        items = response['Items']
        user = next((i for i in items if i['SK'] == 'PROFILE'), None)
        orders = [i for i in items if i['SK'].startswith('ORDER#')]
        return {'user': user, 'orders': orders}

    def find_by_email(self, email):
        """Search user by email address (using GSI)"""
        response = table.query(
            IndexName='GSI1',
            KeyConditionExpression='GSI1PK = :pk AND GSI1SK = :email',
            ExpressionAttributeValues={
                ':pk': 'USER',
                ':email': email
            }
        )
        return response['Items']

class OrderRepository:
    def create_order(self, user_id, order_id, items, total):
        """Create an order (using transaction)"""
        client = boto3.client('dynamodb')
        transact_items = [
            # Create the order under the user's PK
            {
                'Put': {
                    'TableName': 'MyApp',
                    'Item': {
                        'PK': {'S': f'USER#{user_id}'},
                        'SK': {'S': f'ORDER#{datetime.utcnow().strftime("%Y-%m-%d")}#{order_id}'},
                        'order_id': {'S': order_id},
                        'total': {'N': str(total)},
                        'status': {'S': 'pending'},
                        'GSI1PK': {'S': 'ORDER'},
                        'GSI1SK': {'S': datetime.utcnow().strftime("%Y-%m-%d")}
                    }
                }
            }
        ]
        # Add each product item
        for i, item in enumerate(items):
            transact_items.append({
                'Put': {
                    'TableName': 'MyApp',
                    'Item': {
                        'PK': {'S': f'ORDER#{order_id}'},
                        'SK': {'S': f'ITEM#{i:03d}'},
                        'product': {'S': item['name']},
                        'quantity': {'N': str(item['quantity'])},
                        'price': {'N': str(item['price'])}
                    }
                }
            })

        client.transact_write_items(TransactItems=transact_items)
```

---

## 7. Advanced Redis Data Structures

### Code Example 8: Redis Data Structure Usage Patterns

```python
import redis
import json
import time

r = redis.Redis()

# === Session Management ===
class SessionStore:
    def create_session(self, session_id, user_data, ttl=3600):
        """Create a session (valid for 1 hour)"""
        r.setex(
            f"session:{session_id}",
            ttl,
            json.dumps(user_data)
        )

    def get_session(self, session_id):
        """Retrieve a session"""
        data = r.get(f"session:{session_id}")
        if data:
            r.expire(f"session:{session_id}", 3600)  # Refresh TTL
            return json.loads(data)
        return None

    def delete_session(self, session_id):
        """Delete a session"""
        r.delete(f"session:{session_id}")


# === Rate Limiting ===
class RateLimiter:
    def is_allowed(self, user_id, max_requests=100, window_seconds=60):
        """Fixed window rate limiting"""
        key = f"rate:{user_id}:{int(time.time()) // window_seconds}"
        current = r.incr(key)
        if current == 1:
            r.expire(key, window_seconds)
        return current <= max_requests

    def is_allowed_sliding(self, user_id, max_requests=100, window_seconds=60):
        """Sliding window rate limiting"""
        key = f"rate_sliding:{user_id}"
        now = time.time()
        pipe = r.pipeline()
        pipe.zremrangebyscore(key, 0, now - window_seconds)
        pipe.zadd(key, {str(now): now})
        pipe.zcard(key)
        pipe.expire(key, window_seconds)
        results = pipe.execute()
        return results[2] <= max_requests


# === Distributed Lock ===
class DistributedLock:
    def acquire(self, lock_name, ttl=10):
        """Acquire lock (simplified Redlock)"""
        lock_key = f"lock:{lock_name}"
        token = str(time.time())
        acquired = r.set(lock_key, token, nx=True, ex=ttl)
        return token if acquired else None

    def release(self, lock_name, token):
        """Release lock (atomically via Lua script)"""
        script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        r.eval(script, 1, f"lock:{lock_name}", token)


# === Real-Time Ranking ===
class Leaderboard:
    def update_score(self, board_name, user_id, score):
        """Update score"""
        r.zadd(f"leaderboard:{board_name}", {user_id: score})

    def get_rank(self, board_name, user_id):
        """Get rank (0-indexed)"""
        rank = r.zrevrank(f"leaderboard:{board_name}", user_id)
        return rank + 1 if rank is not None else None

    def get_top_n(self, board_name, n=10):
        """Get top N"""
        return r.zrevrange(
            f"leaderboard:{board_name}", 0, n - 1,
            withscores=True
        )

    def get_around_me(self, board_name, user_id, range_size=5):
        """Get N ranks above and below current user"""
        rank = r.zrevrank(f"leaderboard:{board_name}", user_id)
        if rank is None:
            return []
        start = max(0, rank - range_size)
        end = rank + range_size
        return r.zrevrange(
            f"leaderboard:{board_name}", start, end,
            withscores=True
        )
```

---

## Edge Cases

### Edge Case 1: Hot Partition Problem

```
DynamoDB Hot Partition
==============================

Problem:
  A large volume of requests concentrate on PK = "USER#popular_user"
  → The throughput limit of 1 partition (3000 RCU / 1000 WCU) is reached
  → Throttling occurs

Mitigation 1: Write Sharding
  PK = "USER#popular_user#" + (hash % 10)
  → Distribute across 10 partitions
  → Query 10 times and merge on reads

Mitigation 2: DAX (DynamoDB Accelerator) cache
  → Absorb reads into in-memory cache

Mitigation 3: Revisit access patterns
  → Migrate counters to Redis
  → Separate high-frequency update data into a different table
```

### Edge Case 2: MongoDB Document Size Limit

```javascript
// MongoDB document size limit: 16MB
// Unbounded array growth is an anti-pattern

// [NG] Embed all comments → document bloat
db.posts.updateOne(
  { _id: postId },
  { $push: { comments: newComment } }
);
// → Popular posts reach the document size limit with tens of thousands of comments

// [OK] Bucket pattern (split into sub-documents)
db.post_comments.insertOne({
  postId: postId,
  bucket: Math.floor(commentCount / 100),  // Bucket per 100 entries
  comments: [newComment],
  count: 1
});

// [OK] Reference pattern (separate collection)
db.comments.insertOne({
  postId: postId,
  userId: userId,
  text: "Great post!",
  createdAt: new Date()
});
// → Can grow without limit
```

### Edge Case 3: Redis Memory Exhaustion

```python
# Redis memory management best practices

# 1. Set TTL (recommended for all keys)
r.setex("cache:user:1", 300, user_json)  # Expires in 5 minutes

# 2. Configure memory policy
# redis.conf: maxmemory 4gb
# redis.conf: maxmemory-policy allkeys-lru

# 3. Monitor memory usage
info = r.info('memory')
print(f"Used memory: {info['used_memory_human']}")
print(f"Peak memory: {info['used_memory_peak_human']}")
print(f"Fragmentation ratio: {info['mem_fragmentation_ratio']}")

# 4. Detect large keys
# redis-cli --bigkeys
# redis-cli MEMORY USAGE key_name
```

---

## Security Considerations

### NoSQL Injection

```javascript
// MongoDB NoSQL injection
// [NG] Use user input directly in queries
const user = await db.users.findOne({
  username: req.body.username,
  password: req.body.password  // Passing {"$gt": ""} matches all users
});

// [OK] Type checking + sanitization of input
const username = String(req.body.username);
const password = String(req.body.password);
const user = await db.users.findOne({
  username: username,
  password: password  // String type is guaranteed
});

// [Recommended] Hash passwords
const user = await db.users.findOne({ username: username });
if (user && await bcrypt.compare(password, user.passwordHash)) {
  // Authentication successful
}
```

### Redis Security

```
Redis Security Checklist
==================================

1. Configure authentication
   requirepass strong_password_here
   # Redis 6.0+: ACL (Access Control Lists)
   user app_user on >password ~cache:* +get +set +del

2. Network restrictions
   bind 127.0.0.1  # Local only
   protected-mode yes

3. Disable dangerous commands
   rename-command FLUSHALL ""
   rename-command FLUSHDB ""
   rename-command CONFIG ""
   rename-command DEBUG ""

4. Enable TLS
   tls-port 6380
   tls-cert-file /path/to/cert.pem
   tls-key-file /path/to/key.pem

5. Never expose directly to the internet
   → Place inside a VPC or private network
```

---

## Anti-Patterns

### 1. Using NoSQL Relationally

**Problem**: Designing a normalized schema in MongoDB and heavily using `$lookup` (JOIN equivalent) across multiple collections. This negates the benefits of NoSQL and results in slower performance than an RDB.

**Mitigation**: In NoSQL, design a denormalized model optimized for access patterns. Structure documents so that all needed data can be retrieved in a single query.

### 2. Trying to Solve Everything with One Database

**Problem**: Making PostgreSQL handle full-text search, caching, and real-time processing results in each function being half-baked and increases operational complexity.

**Mitigation**: Consider polyglot persistence, selecting the optimal database for each workload. However, as the number of databases grows, so does operational cost, so partition them appropriately along microservice boundaries.

### 3. Ignoring Transactions in NoSQL

**Problem**: Assuming NoSQL has no transactions and designing without considering data integrity. As a result, inconsistent data accumulates.

**Mitigation**: Understand and properly use transaction features available in each NoSQL database, such as MongoDB 4.0+ multi-document transactions and DynamoDB's TransactWriteItems. When transactions are insufficient, maintain consistency through idempotency + retry + reconciliation jobs.

### 4. Overusing Scan in DynamoDB

**Problem**: DynamoDB Scan reads all data, so as the table grows, performance and cost degrade.

**Mitigation**: Define access patterns upfront and design the table so that all queries can be executed efficiently using partition key + sort key + GSI Query operations.

---

## Exercises

### Exercise 1 (Basic): Database Selection

For each of the following requirements, state the optimal database and the reason.

1. E-commerce product catalog (different attributes per category, flexible search)
2. Message storage for a real-time chat app (high writes, time-series)
3. Friend recommendation feature for social media (six degrees of separation traversal)

<details>
<summary>Sample Answer</summary>

1. **MongoDB** or **PostgreSQL + JSONB**: Can flexibly represent different attributes per product category (CPU/RAM for laptops, size/color for clothing) and search with rich queries. Add Elasticsearch if advanced search requirements exist.

2. **DynamoDB** or **Cassandra**: Efficiently manage time-series data with partition key = chat room ID and sort key = timestamp. High write throughput and scalability are strengths. Combine with a Redis cache for fast retrieval of recent messages.

3. **Neo4j**: Graph DBs specialize in relationship traversal between nodes. Multi-hop path searches like "friend of friend of friend" are orders of magnitude faster than chaining RDB JOINs.

</details>

### Exercise 2 (Applied): Polyglot Persistence Design

Design an architecture for a news site. Requirements:
- Article creation and editing (100,000 articles per year)
- Full-text search (title + body)
- User browsing history (100 million PVs per day)
- Real-time popularity ranking
- Comment feature

<details>
<summary>Sample Answer</summary>

```
Database design:
  PostgreSQL: Articles, users, comments (Source of Truth)
  Elasticsearch: Full-text search index (article title + body)
  Redis: Popularity ranking (Sorted Set), sessions, article cache
  DynamoDB: Browsing history (high write throughput)

Data flow:
  Article creation → PostgreSQL → CDC → Elasticsearch (for search)
                                      → Redis (cache)
  Browsing → DynamoDB (history record) → Redis ZINCRBY (ranking update)
  Search → Elasticsearch
  Ranking → Redis ZREVRANGE
  Comments → PostgreSQL (ACID transactions)
```

</details>

### Exercise 3 (Advanced): Migration Plan

Create a migration plan to move the product catalog portion of a PostgreSQL-powered e-commerce site (10 million users, 100 million orders) to MongoDB. Include the following:
- Data migration procedure
- Data synchronization method during migration period
- Rollback plan
- Risks and mitigation

<details>
<summary>Sample Answer</summary>

```
Migration plan:
1. Phase 1 (Preparation): 2 weeks
   - Build MongoDB cluster
   - Design data model (denormalized)
   - Develop and test migration scripts

2. Phase 2 (Parallel operation): 4 weeks
   - Initial data migration (pg_dump → transform → mongoimport)
   - Dual Write: app writes to both PostgreSQL + MongoDB
   - Reads remain from PostgreSQL
   - Run data consistency check jobs

3. Phase 3 (Cutover): 1 week
   - Switch reads to MongoDB (feature flag)
   - Gradually migrate traffic (10% → 50% → 100%)
   - Monitor performance

4. Phase 4 (Completion): 2 weeks
   - Drop product catalog tables from PostgreSQL
   - Stop Dual Write

Rollback plan:
   - Phase 2-3: Instantly revert to PostgreSQL via feature flag
   - After Phase 4: Reverse migration from MongoDB to PostgreSQL (worst case)

Risks:
   - Data inconsistency: Detect with periodic consistency checks
   - Performance degradation: Validate incrementally with canary deployment
   - Skill gap: MongoDB training for the team
```

</details>


---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology selections.

| Criterion | Prioritize when | Can be compromised when |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVPs, time-to-market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│         Architecture Selection Flow             │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① What is the team size?                       │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → Go to ②              │
│                                                 │
│  ② How often do you deploy?                     │
│    ├─ Once a week or less → Monolith + modules  │
│    └─ Daily/multiple times → Go to ③            │
│                                                 │
│  ③ How independent are teams?                   │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Tradeoff Analysis

Technical decisions always involve tradeoffs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- A fast short-term approach can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies allows the right tool for the job, but increases operational costs

**3. Level of Abstraction**
- High abstraction offers greater reusability but can make debugging difficult
- Low abstraction is intuitive but tends to lead to code duplication

```python
# Design decision documentation template
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe the background and challenges"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision"""
        self.decision = decision
        return self

    def add_consequence(self, consequence: str, positive: bool = True):
        """Add a consequence"""
        self.consequences.append({
            'description': consequence,
            'type': 'positive' if positive else 'negative'
        })
        return self

    def add_alternative(self, name: str, reason_rejected: str):
        """Add a rejected alternative"""
        self.alternatives.append({
            'name': name,
            'reason_rejected': reason_rejected
        })
        return self

    def to_markdown(self) -> str:
        """Output in Markdown format"""
        md = f"# ADR: {self.title}\n\n"
        md += f"## Background\n{self.context}\n\n"
        md += f"## Decision\n{self.decision}\n\n"
        md += "## Consequences\n"
        for c in self.consequences:
            icon = "✅" if c['type'] == 'positive' else "⚠️"
            md += f"- {icon} {c['description']}\n"
        md += "\n## Rejected Alternatives\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```
---

## FAQ

### Q1: How do I choose between MongoDB and PostgreSQL JSONB?

**A**:
- **PostgreSQL JSONB**: Relational data is the primary concern, with some attributes being flexible. Transactions and JOINs are needed. Already using PostgreSQL. More than 80% of table data is relational.
- **MongoDB**: Documents are the primary concern. Schema changes frequently. Horizontal scaling is required. Deep nesting is common. Access patterns are concentrated at the document level.

### Q2: Can Redis be used as a primary database?

**A**: Technically possible, but not recommended. Since Redis is an in-memory database, data volume is constrained by memory and costs can be high. Persistence is possible with AOF/RDB, but loading data on restart takes time. While features have matured with Redis 7.0+ Redis Functions and Redis Stack, the common pattern is to use Redis as a supplement for caching, sessions, and real-time processing, while storing primary data in an RDB or DynamoDB.

### Q3: What do you do when complex search becomes necessary with DynamoDB?

**A**: Sync changes to Elasticsearch/OpenSearch via DynamoDB Streams, and run full-text search and complex aggregations there. Alternatively, use DynamoDB Export to S3 + Athena for ad-hoc analysis. Trying to execute complex queries directly in DynamoDB is an anti-pattern.

### Q4: In what cases do people regret choosing NoSQL?

**A**: Regret has been reported in the following cases:
- **Requirements became complex**: Initially simple KV access, but complex aggregations and JOINs became necessary → migrated to RDB
- **Transactions became necessary**: ACID became necessary for payments and inventory management → partially migrated to RDB
- **Increased operational costs**: The cost of operating, monitoring, and backing up multiple databases exceeded expectations

### Q5: Does "schemaless" in NoSQL really mean there is no schema?

**A**: "Schemaless" is not entirely accurate; "schema-on-read" is the more precise term. The database does not enforce a schema, but an implicit schema exists on the application side. Server-side schema validation is also possible with tools like MongoDB's Schema Validation. Since schema management becomes the application's responsibility, sufficient design is necessary.

---

## Troubleshooting

### Problem 1: MongoDB Slow Queries

```javascript
// Investigating slow queries
db.setProfilingLevel(1, { slowms: 100 });  // Log queries over 100ms
db.system.profile.find().sort({ ts: -1 }).limit(5);

// Check execution plan
db.orders.find({ userId: "001" }).explain("executionStats");
// COLLSCAN → index is not being used

// Create an index
db.orders.createIndex({ userId: 1, createdAt: -1 });
```

### Problem 2: Redis Connection Exhaustion

```python
# Connection pooling configuration
pool = redis.ConnectionPool(
    host='localhost',
    port=6379,
    max_connections=50,  # Connection pool size
    socket_timeout=5,
    socket_connect_timeout=5,
    retry_on_timeout=True
)
r = redis.Redis(connection_pool=pool)
```

### Problem 3: DynamoDB Throttling

```python
# Retry with exponential backoff
import time
from botocore.exceptions import ClientError

def put_with_retry(item, max_retries=5):
    for attempt in range(max_retries):
        try:
            table.put_item(Item=item)
            return
        except ClientError as e:
            if e.response['Error']['Code'] == 'ProvisionedThroughputExceededException':
                wait_time = (2 ** attempt) * 0.1  # 0.1, 0.2, 0.4, 0.8, 1.6 seconds
                time.sleep(wait_time)
            else:
                raise
    raise Exception("Max retries exceeded")
```

---

## Summary

| Item | Key Point |
|---|---|
| NoSQL Classification | 4 types: document, KVS, wide-column, graph + time series and search |
| MongoDB | Flexible-schema document DB. Supports rich queries |
| Redis | Sub-millisecond KVS. Caching, sessions, real-time processing |
| DynamoDB | Fully managed wide-column DB. Works well with serverless |
| CAP Theorem | Tradeoff between consistency and availability during partition. PACELC theorem should also be understood |
| Polyglot | Combine the optimal DB for each workload |
| Migration Decision | Consider NoSQL when no JOIN needed + scaling required + flexible schema |
| PostgreSQL JSONB | An intermediate solution achieving document-like flexibility within RDB |
| Security | NoSQL injection countermeasures, authentication and encryption configuration |

## What to Read Next

- [Indexing](../01-advanced/03-indexing.md) — RDB index optimization
- [Migration](../02-design/02-migration.md) — Safe methods for schema changes
- [Schema Design](../02-design/01-schema-design.md) — Fundamentals of RDB schema design

## References

1. **Martin Kleppmann**: [Designing Data-Intensive Applications](https://dataintensive.net/) — A classic on data systems design
2. **MongoDB Official**: [MongoDB Manual](https://www.mongodb.com/docs/manual/) — Comprehensive MongoDB documentation
3. **AWS Official**: [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html) — DynamoDB design guide
4. **Redis Official**: [Redis Documentation](https://redis.io/docs/) — Redis data structures and command reference
5. **Brewer, Eric**: "CAP Twelve Years Later" (2012) — Accurate interpretation of the CAP theorem
6. **Rick Houlihan**: [DynamoDB Single Table Design](https://www.alexdebrie.com/posts/dynamodb-single-table/) — Explanation of single table design

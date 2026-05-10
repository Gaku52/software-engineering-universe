# Performance Tuning — Connection Pools / Caching / Query Optimization

> Practical techniques for dramatically improving database response times. Systematically learn connection pooling, caching strategies, and slow query analysis.

## Prerequisites

- SQL basics (SELECT, JOIN, WHERE, GROUP BY)
- Basic concepts of indexes
- Network communication fundamentals (TCP, TLS)
- [00-postgresql-features.md](./00-postgresql-features.md) — PostgreSQL-specific features

---

## What You Will Learn in This Chapter

1. **Connection pool** design and proper size calculation
2. **Caching strategies** — from application cache to query cache
3. **Query optimization** — how to read EXPLAIN ANALYZE and design indexes
4. **Query optimizer** internals and statistics
5. **Partitioning** for scan optimization
6. **Bulk processing** optimization patterns

---

## 1. Connection Pool Design

### 1.1 Why Connection Pools Are Necessary

```
┌──────────────────────────────────────────────────────┐
│  Without Connection Pool (Bad)                        │
│                                                      │
│  Request 1 ─┐                                        │
│  Request 2 ─┼─→ TCP + TLS + Auth on every call → DB │
│  Request 3 ─┘   (50-200ms overhead)                  │
│                                                      │
│  Problems:                                           │
│  - Connection setup takes 50-200ms                   │
│  - Exceeding DB max_connections causes rejection      │
│  - Memory usage grows proportionally with connections │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  With Connection Pool (Good)                          │
│                                                      │
│  Request 1 ─┐     ┌──────────┐                       │
│  Request 2 ─┼─→   │ Pool     │ ── conn1 ──→ DB      │
│  Request 3 ─┘     │ (reuse)  │ ── conn2 ──→ DB      │
│                   └──────────┘ ── conn3 ──→ DB      │
│                                                      │
│  Benefits:                                           │
│  - Connection setup only on first use (reuse < 1ms)  │
│  - Limits connection count to control DB load        │
│  - Automatic reclamation of idle connections         │
└──────────────────────────────────────────────────────┘
```

### 1.2 Connection Lifecycle and Cost

Understanding the internal process of establishing a connection makes the value of pooling clear.

```
┌─────────── Internal Process of DB Connection Setup ────────────┐
│                                                                 │
│  Client                          Server                         │
│    │                               │                            │
│    │── TCP SYN ──────────────────→ │  (1) TCP                   │
│    │←──── SYN-ACK ────────────── │      ~1ms                   │
│    │── ACK ──────────────────────→ │                            │
│    │                               │                            │
│    │── ClientHello ──────────────→ │  (2) TLS                   │
│    │←── ServerHello + Cert ────── │      ~5-50ms               │
│    │── Key Exchange ─────────────→ │  (1-2 RTT)                │
│    │←── Finished ────────────── │                            │
│    │                               │                            │
│    │── StartupMessage ───────────→ │  (3) PG Auth               │
│    │←── AuthenticationOk ──────── │      ~5-20ms               │
│    │←── ParameterStatus × N ──── │                            │
│    │←── BackendKeyData ────────── │                            │
│    │←── ReadyForQuery ─────────── │                            │
│    │                               │                            │
│    │                  Total: 50-200ms (first time)              │
│    │                  Pool reuse: < 0.1ms                       │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Connection Pool Size Calculation

```
Rule of thumb for optimal pool size:

  pool_size = (CPU cores * 2) + effective_spindle_count

  Example: 4-core CPU + SSD (equivalent to 1 spindle)
      pool_size = (4 * 2) + 1 = 9

  However, adjustment based on actual measurements is required:
  ┌─────────────────────────────────────────────┐
  │  Connections │  Latency   │  Throughput      │
  │      5       │    15ms    │    333 req/s     │
  │     10       │    12ms    │    833 req/s ← optimal│
  │     20       │    14ms    │    714 req/s     │
  │     50       │    25ms    │    400 req/s     │
  └─────────────────────────────────────────────┘
  * Too many connections degrades performance due to context switching
```

### 1.4 Detailed Model for Connection Pool Size Calculation

```
┌──────── Factors Determining Connection Pool Size ──────────┐
│                                                            │
│  1. DB server processing capacity                          │
│     max_connections = (CPU * 2) + spindle                  │
│                                                            │
│  2. Application layer configuration                        │
│     Total connections = pool_size × number of app instances│
│     → Total connections < max_connections                  │
│                                                            │
│  3. Query characteristics                                  │
│     Short queries (< 10ms): a smaller pool is sufficient   │
│     Long queries (> 100ms): a larger pool is needed        │
│                                                            │
│  4. Little's Law                                           │
│     Required connections = arrival rate × avg processing time│
│     Example: 1000 req/s × 10ms = 10 connections           │
│                                                            │
│  Calculation example:                                      │
│  - DB: 8-core CPU + SSD → max = 17                        │
│  - App: 3 instances                                        │
│  - pool_size/instance = 17 / 3 ≈ 5                        │
│  - max_overflow = 2 (for burst traffic)                    │
└────────────────────────────────────────────────────────────┘
```

### 1.5 Connection Pool Configuration in Each Language

```python
# Python — SQLAlchemy
from sqlalchemy import create_engine

engine = create_engine(
    "postgresql://user:pass@localhost:5432/mydb",
    pool_size=10,           # Number of connections to maintain at all times
    max_overflow=5,         # Additional connections beyond pool_size
    pool_timeout=30,        # Timeout for acquiring a connection (seconds)
    pool_recycle=1800,      # Interval for recreating connections (seconds) ← prevents connection leaks
    pool_pre_ping=True,     # Check connection liveness before use
)
```

```typescript
// Node.js — pg (node-postgres)
import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  user: 'user',
  password: 'pass',
  max: 10,                    // Maximum number of connections
  idleTimeoutMillis: 30000,   // Timeout for idle connections
  connectionTimeoutMillis: 5000, // Timeout for acquiring a connection
});

// Usage example
const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
```

```go
// Go — database/sql
import (
    "database/sql"
    _ "github.com/lib/pq"
    "time"
)

db, err := sql.Open("postgres", "postgres://user:pass@localhost:5432/mydb?sslmode=disable")
if err != nil {
    log.Fatal(err)
}

db.SetMaxOpenConns(10)                  // Maximum number of connections
db.SetMaxIdleConns(5)                   // Maximum number of idle connections
db.SetConnMaxLifetime(30 * time.Minute) // Maximum connection lifetime
db.SetConnMaxIdleTime(5 * time.Minute)  // Maximum idle connection lifetime
```

```java
// Java — HikariCP (Spring Boot default)
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

HikariConfig config = new HikariConfig();
config.setJdbcUrl("jdbc:postgresql://localhost:5432/mydb");
config.setUsername("user");
config.setPassword("pass");
config.setMaximumPoolSize(10);          // Maximum pool size
config.setMinimumIdle(5);               // Minimum idle connections
config.setIdleTimeout(300000);          // Idle timeout (ms)
config.setConnectionTimeout(30000);     // Connection acquisition timeout (ms)
config.setMaxLifetime(1800000);         // Maximum connection lifetime (ms)
config.setLeakDetectionThreshold(60000); // Leak detection threshold (ms)

HikariDataSource ds = new HikariDataSource(config);
```

### 1.6 External Connection Pool — pgBouncer

In large-scale environments, pgBouncer is placed on the DB side in addition to the application-side pool.

```
┌──────── pgBouncer Architecture ───────────┐
│                                            │
│  App1 (pool=5) ──┐                         │
│  App2 (pool=5) ──┼─→ pgBouncer ──→ DB     │
│  App3 (pool=5) ──┘   (aggregates 100→20)  │
│                                            │
│  Modes:                                    │
│  - session:     Per session (safest)       │
│  - transaction: Per transaction (recommended)│
│  - statement:   Per statement (many limits)│
└────────────────────────────────────────────┘
```

```ini
; pgbouncer.ini configuration example
[databases]
mydb = host=localhost port=5432 dbname=mydb

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

; Pool mode (transaction is common)
pool_mode = transaction

; Pool size
default_pool_size = 20
min_pool_size = 5
max_client_conn = 200        ; Maximum client connections
max_db_connections = 20      ; Maximum connections to the DB

; Timeouts
server_idle_timeout = 600
client_idle_timeout = 0      ; 0 = unlimited
query_timeout = 0
```

```sql
-- Check pgBouncer statistics
-- Connect to the pgBouncer admin console
-- psql -p 6432 -U admin pgbouncer

SHOW POOLS;
-- database | user | cl_active | cl_waiting | sv_active | sv_idle | ...

SHOW STATS;
-- database | total_xact_count | total_query_count | avg_xact_time | ...

SHOW CLIENTS;
-- type | user | database | state | addr | port | ...
```

### 1.7 Connection Pool Monitoring

```sql
-- PostgreSQL: Check current connection status
SELECT
    state,
    COUNT(*) AS connections,
    ROUND(100.0 * COUNT(*) / (SELECT setting::INT FROM pg_settings
        WHERE name = 'max_connections'), 1) AS pct_of_max
FROM pg_stat_activity
GROUP BY state
ORDER BY connections DESC;

-- Idle connection details (long idle is a sign of problems)
SELECT
    pid,
    usename,
    application_name,
    client_addr,
    state,
    NOW() - state_change AS idle_duration,
    query
FROM pg_stat_activity
WHERE state = 'idle'
  AND NOW() - state_change > INTERVAL '5 minutes'
ORDER BY idle_duration DESC;

-- Detecting connection waits
SELECT
    COUNT(*) FILTER (WHERE state = 'active') AS active,
    COUNT(*) FILTER (WHERE state = 'idle') AS idle,
    COUNT(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_tx,
    COUNT(*) FILTER (WHERE wait_event IS NOT NULL) AS waiting,
    (SELECT setting::INT FROM pg_settings WHERE name = 'max_connections') AS max_conn
FROM pg_stat_activity
WHERE backend_type = 'client backend';
```

---

## 2. Caching Strategies

### 2.1 Overview of Cache Layers

```
┌───────────────────────────────────────────────────────┐
│                  Cache Layers                          │
│                                                       │
│  Layer 1: In-Application Cache (L1)                   │
│  ┌───────────────────────────────────────┐            │
│  │ In-memory (HashMap, LRU Cache)        │            │
│  │ TTL: seconds to minutes | Latency: < 1ms│          │
│  │ Capacity: small (limited by process memory)│       │
│  │ Consistency: possible inconsistency between processes│
│  └──────────────────┬────────────────────┘            │
│                     │ Miss                            │
│                     ▼                                 │
│  Layer 2: Distributed Cache (L2)                      │
│  ┌───────────────────────────────────────┐            │
│  │ Redis / Memcached                     │            │
│  │ TTL: minutes to hours | Latency: 1-5ms│            │
│  │ Capacity: large (dedicated server)    │            │
│  │ Consistency: shared across all processes│          │
│  └──────────────────┬────────────────────┘            │
│                     │ Miss                            │
│                     ▼                                 │
│  Layer 3: Database Cache                              │
│  ┌───────────────────────────────────────┐            │
│  │ shared_buffers / Buffer Pool          │            │
│  │ Latency: < 1ms (in-memory)            │            │
│  │ Automatically managed (LRU/Clock Sweep)│           │
│  └──────────────────┬────────────────────┘            │
│                     │ Miss                            │
│                     ▼                                 │
│  Layer 4: Disk                                        │
│  ┌───────────────────────────────────────┐            │
│  │ OS Page Cache → SSD/HDD               │            │
│  │ Latency: 0.1-10ms                     │            │
│  └───────────────────────────────────────┘            │
└───────────────────────────────────────────────────────┘
```

### 2.2 Cache-Aside Pattern (Most Common)

```python
import redis
import json
from sqlalchemy.orm import Session

r = redis.Redis(host='localhost', port=6379, decode_responses=True)

def get_user(db: Session, user_id: str) -> dict:
    """Retrieve user using Cache-Aside pattern"""
    cache_key = f"user:{user_id}"

    # 1. Check the cache
    cached = r.get(cache_key)
    if cached:
        return json.loads(cached)  # Cache Hit

    # 2. Cache miss → retrieve from DB
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        return None

    user_dict = {"id": str(user.id), "name": user.name, "email": user.email}

    # 3. Save to cache (TTL: 5 minutes)
    r.setex(cache_key, 300, json.dumps(user_dict))

    return user_dict

def update_user(db: Session, user_id: str, name: str) -> dict:
    """On update, delete cache (Write-Invalidate)"""
    user = db.query(User).filter(User.id == user_id).first()
    user.name = name
    db.commit()

    # Delete cache (re-cached on next read)
    r.delete(f"user:{user_id}")

    return {"id": str(user.id), "name": user.name}
```

### 2.3 Write-Through Pattern

```python
def update_user_write_through(db: Session, user_id: str, name: str) -> dict:
    """Write-Through: update DB and cache simultaneously"""
    user = db.query(User).filter(User.id == user_id).first()
    user.name = name
    db.commit()

    # Also update cache simultaneously (overwrite, not delete)
    user_dict = {"id": str(user.id), "name": user.name, "email": user.email}
    r.setex(f"user:{user_id}", 300, json.dumps(user_dict))

    return user_dict
```

### 2.4 Write-Behind (Write-Back) Pattern

```python
import asyncio
from collections import defaultdict

class WriteBehindCache:
    """Write-Behind: write to cache, asynchronously sync to DB"""

    def __init__(self, redis_client, db_session_factory, flush_interval=5):
        self.redis = redis_client
        self.db_factory = db_session_factory
        self.flush_interval = flush_interval
        self.pending_writes = defaultdict(dict)

    async def set(self, key: str, value: dict):
        """Write to cache immediately"""
        self.redis.setex(key, 600, json.dumps(value))
        self.pending_writes[key] = value

    async def flush_to_db(self):
        """Periodically write to DB (batch processing)"""
        while True:
            await asyncio.sleep(self.flush_interval)
            if not self.pending_writes:
                continue

            writes = dict(self.pending_writes)
            self.pending_writes.clear()

            db = self.db_factory()
            try:
                for key, value in writes.items():
                    # Bulk UPSERT to reduce DB load
                    db.execute(
                        """INSERT INTO users (id, name, email)
                           VALUES (:id, :name, :email)
                           ON CONFLICT (id) DO UPDATE
                           SET name = EXCLUDED.name, email = EXCLUDED.email""",
                        value
                    )
                db.commit()
            except Exception as e:
                db.rollback()
                # Restore failed writes
                self.pending_writes.update(writes)
                raise
            finally:
                db.close()
```

### 2.5 Cache Invalidation Patterns

```
┌────────────────────────────────────────────────────────┐
│          3 Cache Invalidation Patterns                   │
│                                                        │
│  1. TTL-based (Time-To-Live)                           │
│     SET key value EX 300                               │
│     → Automatically deleted after 5 minutes            │
│     → Simplest; tolerates slightly stale data          │
│                                                        │
│  2. Write-Invalidate (delete on write)                  │
│     UPDATE → DEL cache_key                             │
│     → Delete cache on update, rebuild on next read     │
│     → High consistency                                  │
│                                                        │
│  3. Write-Through (update on write)                     │
│     UPDATE → SET cache_key new_value                   │
│     → Update cache simultaneously on write             │
│     → Effective when read frequency is high            │
│                                                        │
│  4. Event-Driven                                        │
│     UPDATE → publish event → subscriber DEL cache      │
│     → Notified via DB CDC (Change Data Capture)/Pub-Sub│
│     → Suitable for microservices environments          │
└────────────────────────────────────────────────────────┘
```

### 2.6 Advanced Redis Caching Patterns

```python
# ===========================
# Atomic operations with Lua scripts
# ===========================
RATE_LIMIT_SCRIPT = """
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])

local current = redis.call('INCR', key)
if current == 1 then
    redis.call('EXPIRE', key, window)
end

if current > limit then
    return 0  -- Deny
else
    return 1  -- Allow
end
"""

def check_rate_limit(user_id: str, limit: int = 100, window: int = 60) -> bool:
    """Rate limiting with sliding window"""
    key = f"rate:{user_id}:{int(time.time()) // window}"
    result = r.eval(RATE_LIMIT_SCRIPT, 1, key, limit, window)
    return bool(result)


# ===========================
# Batch retrieval with Redis Pipeline
# ===========================
def get_users_batch(user_ids: list[str]) -> list[dict]:
    """Batch retrieval of multiple keys using pipeline (avoids N+1 problem)"""
    cache_keys = [f"user:{uid}" for uid in user_ids]

    # 1. Batch retrieval with pipeline
    pipe = r.pipeline(transaction=False)
    for key in cache_keys:
        pipe.get(key)
    results = pipe.execute()

    users = []
    missing_ids = []

    for uid, cached in zip(user_ids, results):
        if cached:
            users.append(json.loads(cached))
        else:
            missing_ids.append(uid)

    # 2. Retrieve cache misses from DB
    if missing_ids:
        db_users = db.query(User).filter(User.id.in_(missing_ids)).all()
        pipe = r.pipeline(transaction=False)
        for user in db_users:
            user_dict = {"id": str(user.id), "name": user.name, "email": user.email}
            users.append(user_dict)
            pipe.setex(f"user:{user.id}", 300, json.dumps(user_dict))
        pipe.execute()

    return users


# ===========================
# Cache warming
# ===========================
def warm_cache_on_deploy():
    """Preload hot data at deploy time"""
    # Load frequently accessed data
    hot_users = db.query(User).order_by(User.last_login_at.desc()).limit(1000).all()
    pipe = r.pipeline(transaction=False)
    for user in hot_users:
        user_dict = {"id": str(user.id), "name": user.name, "email": user.email}
        pipe.setex(f"user:{user.id}", 600, json.dumps(user_dict))
    pipe.execute()
    print(f"Warmed cache with {len(hot_users)} users")
```

---

## 3. Query Optimization

### 3.1 How to Read EXPLAIN ANALYZE

```sql
-- Slow query example
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT u.name, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.created_at > '2025-01-01'
GROUP BY u.name
ORDER BY order_count DESC
LIMIT 10;

-- Sample output:
-- Limit  (cost=1234.56..1234.58 rows=10 width=40)
--        (actual time=45.123..45.130 rows=10 loops=1)
--   -> Sort  (cost=1234.56..1237.89 rows=1000 width=40)
--            (actual time=45.120..45.125 rows=10 loops=1)
--     Sort Key: (count(o.id)) DESC
--     Sort Method: top-N heapsort  Memory: 26kB
--       -> HashAggregate  (cost=1200.00..1210.00 rows=1000 width=40)
--                         (actual time=44.000..44.500 rows=1000 loops=1)
--           -> Hash Left Join  (cost=100.00..900.00 rows=50000 width=36)
--                              (actual time=5.000..35.000 rows=50000 loops=1)
--               Hash Cond: (o.user_id = u.id)
--               -> Seq Scan on orders o  ← Full table scan! Improvement point
--                  (actual time=0.010..15.000 rows=100000 loops=1)
--               -> Hash  (cost=80.00..80.00 rows=1000 width=20)
--                  -> Index Scan using idx_users_created_at on users u
--                     Filter: (created_at > '2025-01-01')
--                     (actual time=0.020..2.000 rows=1000 loops=1)
-- Buffers: shared hit=5000 read=200
-- Planning Time: 0.500 ms
-- Execution Time: 45.200 ms
```

```
How to read EXPLAIN ANALYZE:

  cost=startup_cost..total_cost
  actual time=startup_time..total_time (ms)
  rows=estimated row count vs actual rows=actual row count

  Key points to focus on:
  1. Can Seq Scan be changed to Index Scan?
  2. Large deviation between estimated rows and actual rows → update table stats with ANALYZE
  3. Many Buffers: read → insufficient indexes
  4. Many loops → Nested Loop Join is inefficient
```

### 3.2 Detailed Explanation of Execution Plan Nodes

```
┌───────── EXPLAIN Node Hierarchy ──────────────────────┐
│                                                        │
│  Scan nodes (leaf nodes):                              │
│  ┌──────────────────────────────────────────┐         │
│  │ Seq Scan        : full row scan           │         │
│  │ Index Scan      : index → table           │         │
│  │ Index Only Scan : index only (fastest)    │         │
│  │ Bitmap Index Scan + Bitmap Heap Scan      │         │
│  │                  : bitmap combined scan   │         │
│  │ TID Scan        : direct row ID access    │         │
│  └──────────────────────────────────────────┘         │
│                                                        │
│  Join nodes:                                           │
│  ┌──────────────────────────────────────────┐         │
│  │ Nested Loop   : outer×inner (small tables)│        │
│  │ Hash Join     : join after building hash table│     │
│  │ Merge Join    : join sorted data          │         │
│  └──────────────────────────────────────────┘         │
│                                                        │
│  Aggregate nodes:                                      │
│  ┌──────────────────────────────────────────┐         │
│  │ HashAggregate : GROUP BY with hash        │         │
│  │ GroupAggregate: GROUP BY on sorted data   │         │
│  │ Sort          : memory or disk sort       │         │
│  │ Limit         : row count limit           │         │
│  │ Materialize   : hold results in memory    │         │
│  └──────────────────────────────────────────┘         │
└────────────────────────────────────────────────────────┘
```

### 3.3 Selection Criteria for JOIN Algorithms

```
┌──────── JOIN Algorithm Selection ─────────────┐
│                                               │
│  Nested Loop Join                             │
│  ┌────────────────────────────────────┐      │
│  │ Outer: small table (few to hundreds of rows)│
│  │ Inner: has an index                 │      │
│  │ Cost: O(N × M/index)               │      │
│  │ Best for: one side small + index   │      │
│  └────────────────────────────────────┘      │
│                                               │
│  Hash Join                                    │
│  ┌────────────────────────────────────┐      │
│  │ Build: build hash of small table   │      │
│  │ Probe: scan large table            │      │
│  │ Cost: O(N + M)                     │      │
│  │ Memory: depends on work_mem        │      │
│  │ Best for: equi-join + enough memory│      │
│  └────────────────────────────────────┘      │
│                                               │
│  Merge Join                                   │
│  ┌────────────────────────────────────┐      │
│  │ Sort both tables then merge        │      │
│  │ Cost: O(N log N + M log M)         │      │
│  │ Best for: already sorted (index)   │      │
│  │ Also: usable for range joins       │      │
│  └────────────────────────────────────┘      │
│                                               │
│  Selection flow:                              │
│  Q: Is it an equi-join?                       │
│  ├─ No → Nested Loop or Merge Join            │
│  └─ Yes                                       │
│     Q: Is one side very small?                │
│     ├─ Yes → Nested Loop                      │
│     └─ No                                     │
│        Q: Are both sides already sorted?      │
│        ├─ Yes → Merge Join                    │
│        └─ No → Hash Join                      │
└───────────────────────────────────────────────┘
```

### 3.4 Index Design

```sql
-- 1. Single-column index
CREATE INDEX idx_users_email ON users (email);

-- 2. Composite index (put higher-cardinality columns first)
CREATE INDEX idx_orders_user_status ON orders (user_id, status);

-- 3. Partial index (narrow conditions to reduce size)
CREATE INDEX idx_orders_active ON orders (user_id)
WHERE status = 'active';

-- 4. Covering index (Index Only Scan with INCLUDE)
CREATE INDEX idx_users_email_covering ON users (email)
INCLUDE (name, created_at);

-- 5. Expression index
CREATE INDEX idx_users_lower_email ON users (LOWER(email));

-- 6. GIN index (full-text search, JSONB, arrays)
CREATE INDEX idx_products_tags ON products USING GIN (tags);

-- 7. GiST index (geospatial, range types)
CREATE INDEX idx_events_period ON events USING GIST (
    tstzrange(start_at, end_at)
);

-- 8. BRIN index (timestamps on large tables)
CREATE INDEX idx_logs_created ON logs USING BRIN (created_at)
WITH (pages_per_range = 32);
-- → Less than 1/100 the size of B-Tree; effective for time-series data
```

### 3.5 Index Selection Flow

```
┌──────── Index Type Selection Flow ─────────────┐
│                                                │
│  Q: What is the search pattern?                │
│  │                                             │
│  ├─ Equality search (=) → B-Tree               │
│  │                                             │
│  ├─ Range search (<, >, BETWEEN)               │
│  │  Q: What is the table size?                 │
│  │  ├─ Small to medium → B-Tree                │
│  │  └─ Large (hundreds of millions) + time-series → BRIN│
│  │                                             │
│  ├─ LIKE 'prefix%' → B-Tree (prefix match only)│
│  │                                             │
│  ├─ Full-text search / array / JSONB → GIN     │
│  │                                             │
│  ├─ Geospatial / range type → GiST             │
│  │                                             │
│  └─ Nearest neighbor search → SP-GiST or pgvector│
│                                                │
│  Additional optimizations:                     │
│  - Specific conditions only → Partial index (WHERE)│
│  - Include columns in SELECT → INCLUDE (covering)│
│  - Function applied → Expression index         │
└────────────────────────────────────────────────┘
```

### 3.6 Detecting and Addressing Slow Queries

```sql
-- PostgreSQL: Enable slow query logging
ALTER SYSTEM SET log_min_duration_statement = 100;  -- Log queries over 100ms
ALTER SYSTEM SET log_statement = 'none';             -- Don't log normal queries
SELECT pg_reload_conf();

-- Check currently running slow queries
SELECT pid, now() - pg_stat_activity.query_start AS duration,
       query, state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
  AND state != 'idle'
ORDER BY duration DESC;

-- Statistical analysis with pg_stat_statements (requires extension installation)
-- CREATE EXTENSION pg_stat_statements;
SELECT
    queryid,
    LEFT(query, 80) AS query_preview,
    calls,
    ROUND(total_exec_time::NUMERIC, 2) AS total_time_ms,
    ROUND(mean_exec_time::NUMERIC, 2) AS avg_time_ms,
    ROUND(stddev_exec_time::NUMERIC, 2) AS stddev_ms,
    rows,
    shared_blks_hit + shared_blks_read AS total_blocks,
    CASE WHEN shared_blks_hit + shared_blks_read > 0
         THEN ROUND(100.0 * shared_blks_hit /
              (shared_blks_hit + shared_blks_read), 1)
         ELSE 100
    END AS cache_hit_pct
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;

-- Check index usage rate
SELECT schemaname, tablename, indexname,
       idx_scan as times_used,
       pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
-- Indexes with idx_scan = 0 may be unnecessary

-- Update table statistics
ANALYZE users;
ANALYZE orders;
```

### 3.7 Statistics and the Query Planner

```sql
-- Check table statistics
SELECT
    attname,
    n_distinct,          -- Estimated number of unique values (negative = fraction of row count)
    most_common_vals,    -- Most common values
    most_common_freqs,   -- Frequency of most common values
    histogram_bounds     -- Histogram boundary values
FROM pg_stats
WHERE tablename = 'orders' AND attname = 'status';

-- Extended statistics (for correlated column groups)
-- PostgreSQL 10+
CREATE STATISTICS stat_orders_user_status (dependencies, ndistinct, mcv)
ON user_id, status FROM orders;
ANALYZE orders;

-- Increase statistics precision (default=100, max=10000)
ALTER TABLE orders ALTER COLUMN status SET STATISTICS 500;
ANALYZE orders;
```

### 3.8 Practical Query Rewrite Patterns

```sql
-- =============================================
-- Pattern 1: Solving the N+1 Problem
-- =============================================
-- Bad: Loop on the application side (N+1 queries)
-- for user in users:
--     orders = SELECT * FROM orders WHERE user_id = user.id

-- Good: Batch retrieval with JOIN
SELECT u.*, o.id AS order_id, o.total_amount
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.created_at > '2025-01-01';

-- Good: LATERAL JOIN for "latest 3 orders per user"
SELECT u.name, recent_orders.*
FROM users u
CROSS JOIN LATERAL (
    SELECT o.id, o.total_amount, o.created_at
    FROM orders o
    WHERE o.user_id = u.id
    ORDER BY o.created_at DESC
    LIMIT 3
) recent_orders
WHERE u.created_at > '2025-01-01';

-- =============================================
-- Pattern 2: Cursor-Based Pagination
-- =============================================
-- Bad: Gets slower as OFFSET grows larger
SELECT * FROM orders ORDER BY created_at DESC LIMIT 20 OFFSET 100000;
-- → Reads 100,020 rows and discards 100,000

-- Good: Cursor-based pagination
SELECT * FROM orders
WHERE created_at < '2026-01-15T10:30:00Z'  -- Timestamp of the last item on the previous page
ORDER BY created_at DESC
LIMIT 20;
-- → Reads only 20 rows using the index

-- Good: Cursor + ID (handles identical timestamps)
SELECT * FROM orders
WHERE (created_at, id) < ('2026-01-15T10:30:00Z', 12345)
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- =============================================
-- Pattern 3: EXISTS vs IN vs JOIN
-- =============================================
-- When outer is small and inner is large: EXISTS is advantageous
SELECT * FROM users u
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.status = 'active'
);

-- When inner is small: IN is advantageous
SELECT * FROM orders
WHERE user_id IN (SELECT id FROM users WHERE role = 'admin');

-- =============================================
-- Pattern 4: Optimizing DISTINCT
-- =============================================
-- Bad: Sort all rows then remove duplicates
SELECT DISTINCT category FROM products;

-- Good: Loose Index Scan (automatically applied in PostgreSQL 14+ in some cases)
-- To reproduce manually:
WITH RECURSIVE categories AS (
    (SELECT category FROM products ORDER BY category LIMIT 1)
    UNION ALL
    SELECT (SELECT p.category FROM products p
            WHERE p.category > c.category
            ORDER BY p.category LIMIT 1)
    FROM categories c
    WHERE c.category IS NOT NULL
)
SELECT category FROM categories WHERE category IS NOT NULL;

-- =============================================
-- Pattern 5: Batch UPDATE
-- =============================================
-- Bad: Large bulk update (long lock time)
UPDATE orders SET status = 'archived'
WHERE created_at < '2024-01-01';
-- → Locks 1 million rows, blocking other transactions

-- Good: Split into batches
DO $$
DECLARE
    batch_size INT := 10000;
    updated INT;
BEGIN
    LOOP
        UPDATE orders SET status = 'archived'
        WHERE id IN (
            SELECT id FROM orders
            WHERE created_at < '2024-01-01'
              AND status != 'archived'
            LIMIT batch_size
            FOR UPDATE SKIP LOCKED  -- Avoid lock contention
        );
        GET DIAGNOSTICS updated = ROW_COUNT;
        EXIT WHEN updated = 0;
        COMMIT;
        PERFORM pg_sleep(0.1);  -- Give other transactions a chance to run
    END LOOP;
END $$;
```

---

## 4. Internal Workings of Database Caching

### 4.1 PostgreSQL shared_buffers

```
┌──────── PostgreSQL Memory Architecture ────────┐
│                                                  │
│  shared_buffers                                   │
│  ┌────────────────────────────────────────┐     │
│  │ Default: 128MB                          │     │
│  │ Recommended: 25% of physical memory    │     │
│  │ Diminishing returns beyond 8-16GB      │     │
│  │                                        │     │
│  │ Managed by Clock Sweep algorithm       │     │
│  │ → Similar to LRU, but decided by usage counter│
│  └────────────────────────────────────────┘     │
│                                                  │
│  work_mem (worker memory)                         │
│  ┌────────────────────────────────────────┐     │
│  │ Default: 4MB                            │     │
│  │ Used for: sorting, hash joins, aggregates│    │
│  │ Note: allocated per connection × query  │     │
│  │       work_mem=64MB × 100 connections = 6.4GB│
│  └────────────────────────────────────────┘     │
│                                                  │
│  maintenance_work_mem                             │
│  ┌────────────────────────────────────────┐     │
│  │ Default: 64MB                           │     │
│  │ Used for: VACUUM, CREATE INDEX, ALTER TABLE│  │
│  │ Recommended: 512MB - 1GB               │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  effective_cache_size                             │
│  ┌────────────────────────────────────────┐     │
│  │ Hint to planner (no actual memory allocation)│ │
│  │ Recommended: 50-75% of physical memory │     │
│  │ → Affects Index Scan selection         │     │
│  └────────────────────────────────────────┘     │
└──────────────────────────────────────────────────┘
```

### 4.2 Monitoring Buffer Cache

```sql
-- Buffer cache hit ratio
SELECT
    datname,
    blks_hit,
    blks_read,
    CASE WHEN blks_hit + blks_read > 0
         THEN ROUND(100.0 * blks_hit / (blks_hit + blks_read), 2)
         ELSE 100
    END AS cache_hit_ratio
FROM pg_stat_database
WHERE datname = current_database();
-- Target: 99% or higher

-- Cache hit ratio per table
SELECT
    schemaname, relname,
    heap_blks_hit,
    heap_blks_read,
    CASE WHEN heap_blks_hit + heap_blks_read > 0
         THEN ROUND(100.0 * heap_blks_hit / (heap_blks_hit + heap_blks_read), 2)
         ELSE 100
    END AS cache_hit_ratio
FROM pg_statio_user_tables
ORDER BY heap_blks_read DESC
LIMIT 20;

-- Detailed inspection with pg_buffercache extension
-- CREATE EXTENSION pg_buffercache;
SELECT
    c.relname,
    COUNT(*) AS buffers,
    pg_size_pretty(COUNT(*) * 8192) AS cached_size,
    ROUND(100.0 * COUNT(*) /
        (SELECT setting::INT FROM pg_settings WHERE name = 'shared_buffers'), 1)
        AS pct_of_shared_buffers
FROM pg_buffercache b
    JOIN pg_class c ON b.relfilenode = pg_relation_filenode(c.oid)
WHERE b.reldatabase = (SELECT oid FROM pg_database WHERE datname = current_database())
GROUP BY c.relname
ORDER BY buffers DESC
LIMIT 20;
```

---

## 5. Optimization with Partitioning

### 5.1 Partition Strategies

```sql
-- =============================================
-- RANGE Partition (most common: date-based)
-- =============================================
CREATE TABLE events (
    id          BIGSERIAL,
    event_type  VARCHAR(50),
    payload     JSONB,
    created_at  TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE events_2024_01 PARTITION OF events
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE events_2024_02 PARTITION OF events
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Automatic partition creation (pg_partman extension)
-- CREATE EXTENSION pg_partman;
-- SELECT partman.create_parent(
--     p_parent_table := 'public.events',
--     p_control := 'created_at',
--     p_type := 'range',
--     p_interval := '1 month',
--     p_premake := 3  -- Pre-create 3 months ahead
-- );

-- =============================================
-- LIST Partition (category-based)
-- =============================================
CREATE TABLE orders (
    id          BIGSERIAL,
    region      VARCHAR(20) NOT NULL,
    total       DECIMAL(12,2),
    created_at  TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id, region)
) PARTITION BY LIST (region);

CREATE TABLE orders_japan PARTITION OF orders
    FOR VALUES IN ('tokyo', 'osaka', 'nagoya');
CREATE TABLE orders_us PARTITION OF orders
    FOR VALUES IN ('new_york', 'san_francisco', 'chicago');
CREATE TABLE orders_eu PARTITION OF orders
    FOR VALUES IN ('london', 'paris', 'berlin');

-- =============================================
-- HASH Partition (uniform distribution)
-- =============================================
CREATE TABLE sessions (
    id          UUID NOT NULL,
    user_id     BIGINT NOT NULL,
    data        JSONB,
    expires_at  TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
) PARTITION BY HASH (id);

CREATE TABLE sessions_0 PARTITION OF sessions
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE sessions_1 PARTITION OF sessions
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE sessions_2 PARTITION OF sessions
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE sessions_3 PARTITION OF sessions
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

### 5.2 Verifying Partition Pruning

```sql
-- Verify Partition Pruning behavior
EXPLAIN (ANALYZE)
SELECT * FROM events
WHERE created_at BETWEEN '2024-03-01' AND '2024-03-31';

-- Sample output:
-- Append (actual rows=50000)
--   Subplans Removed: 11        ← 11 of 12 partitions excluded
--   -> Seq Scan on events_2024_03 (actual rows=50000)
--        Filter: (created_at >= '2024-03-01' AND created_at <= '2024-03-31')
```

---

## 6. Bulk Processing Optimization

```sql
-- =============================================
-- Fast bulk load with COPY (10-100x faster than INSERT)
-- =============================================
COPY users (name, email, created_at)
FROM '/tmp/users.csv'
WITH (FORMAT csv, HEADER true, DELIMITER ',');

-- COPY from a program
-- Python (psycopg2)
-- with cursor.copy("COPY users (name, email) FROM STDIN") as copy:
--     for row in data:
--         copy.write_row(row)

-- =============================================
-- Optimizing Bulk INSERT
-- =============================================
-- Bad: INSERT one row at a time
INSERT INTO users (name, email) VALUES ('A', 'a@x.com');
INSERT INTO users (name, email) VALUES ('B', 'b@x.com');
-- ...10000 times

-- Good: Bulk INSERT (multiple rows in one statement)
INSERT INTO users (name, email) VALUES
    ('A', 'a@x.com'),
    ('B', 'b@x.com'),
    ('C', 'c@x.com');
-- → Reduces network round trips

-- =============================================
-- Optimization techniques for large-scale loads
-- =============================================
-- 1. Temporarily drop indexes
DROP INDEX idx_users_email;

-- 2. Delay constraint checks
SET session_replication_role = replica;  -- Disable triggers

-- 3. Execute bulk load
COPY users FROM '/tmp/bulk_users.csv' WITH (FORMAT csv);

-- 4. Recreate indexes (CONCURRENTLY for zero downtime)
CREATE INDEX CONCURRENTLY idx_users_email ON users (email);

-- 5. Restore constraint checks
SET session_replication_role = DEFAULT;

-- 6. Update statistics
ANALYZE users;

-- =============================================
-- UPSERT (INSERT ON CONFLICT)
-- =============================================
INSERT INTO products (sku, name, price, updated_at)
VALUES ('SKU001', 'Widget', 19.99, NOW()),
       ('SKU002', 'Gadget', 29.99, NOW()),
       ('SKU003', 'Doohickey', 39.99, NOW())
ON CONFLICT (sku)
DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    updated_at = EXCLUDED.updated_at
WHERE products.price != EXCLUDED.price;  -- Update only when there is an actual change
```

---

## 7. Comparison Tables

### 7.1 Caching Strategy Comparison

| Strategy | Consistency | Write Load | Read Performance | Implementation Complexity | Use Case |
|----------|-------------|------------|-----------------|--------------------------|----------|
| **Cache-Aside** | Medium (TTL-dependent) | Low | High (on Hit) | Low | General read caching |
| **Write-Through** | High | High (double write) | High | Medium | Read frequency >> write frequency |
| **Write-Behind** | Medium (async) | Low (batched) | High | High | High write frequency |
| **Read-Through** | Medium | Low | High | Medium | ORM integrated caching |

### 7.2 Connection Pool Library Comparison

| Library | Language | Pooling | Connection Aggregation | Recommended Setting |
|---------|----------|---------|----------------------|---------------------|
| **HikariCP** | Java | App side | None | max=10, min=5 |
| **pgBouncer** | External | DB side | Yes | transaction mode |
| **PgCat** | External | DB side | Yes | Written in Rust, supports sharding |
| **SQLAlchemy Pool** | Python | App side | None | pool_size=10, max_overflow=5 |
| **node-pg Pool** | Node.js | App side | None | max=10 |
| **sqlx::Pool** | Rust | App side | None | max_connections=10 |
| **database/sql** | Go | App side | None | MaxOpenConns=10 |

### 7.3 Index Type Comparison

| Index | Use Case | Size | Search Speed | Update Cost |
|-------|----------|------|-------------|-------------|
| **B-Tree** | Equality / range | Medium | O(log n) | O(log n) |
| **Hash** | Equality only | Small | O(1) | O(1) |
| **GIN** | Full-text / JSONB / arrays | Large | O(1)~ | High (deferred updates) |
| **GiST** | Geospatial / range types | Medium | O(log n) | O(log n) |
| **SP-GiST** | Hierarchical data | Small to medium | O(log n) | O(log n) |
| **BRIN** | Physically sorted large tables | Very small | O(1) | O(1) |

### 7.4 Partition Strategy Comparison

| Method | Use Case | Pruning | Maintenance | Notes |
|--------|----------|---------|-------------|-------|
| **RANGE** | Time-series data | WHERE clause with period | DROP old partitions | Most common |
| **LIST** | Category classification | WHERE clause with value | Create partition when adding new category | All values must be covered |
| **HASH** | Uniform distribution | WHERE clause with equality | Changing partition count is difficult | Range queries scan all partitions |

---

## 8. Anti-Patterns

### 8.1 OFFSET-Based Pagination

```sql
-- Bad: Gets slower as OFFSET grows larger
SELECT * FROM orders ORDER BY created_at DESC LIMIT 20 OFFSET 100000;
-- → Reads 100,020 rows and discards 100,000

-- Good: Cursor-based pagination
SELECT * FROM orders
WHERE created_at < '2026-01-15T10:30:00Z'  -- Timestamp of the last item on the previous page
ORDER BY created_at DESC
LIMIT 20;
-- → Reads only 20 rows using the index
```

### 8.2 Cache Stampede

```python
# Bad: All caches expire simultaneously → mass requests to DB
def bad_cache_set(key, value):
    r.setex(key, 3600, value)  # All with TTL=1 hour

# Good: Add jitter (random variation) to TTL
import random

def good_cache_set(key, value, base_ttl=3600):
    jitter = random.randint(0, 600)  # Random 0-10 minutes
    r.setex(key, base_ttl + jitter, value)

# Good: Prevent simultaneous rebuilds with a lock (Mutex pattern)
def get_with_lock(key, rebuild_fn, ttl=3600):
    value = r.get(key)
    if value:
        return json.loads(value)

    lock_key = f"lock:{key}"
    if r.set(lock_key, "1", nx=True, ex=10):  # 10-second lock
        try:
            value = rebuild_fn()
            r.setex(key, ttl + random.randint(0, 600), json.dumps(value))
            return value
        finally:
            r.delete(lock_key)
    else:
        # Another process is rebuilding → wait briefly and retry
        import time
        time.sleep(0.1)
        return get_with_lock(key, rebuild_fn, ttl)

# Good: Logical expiry (Probabilistic Early Expiration)
import math

def get_with_early_expiry(key, rebuild_fn, ttl=3600, beta=1.0):
    """Probabilistically rebuild even when value is still valid as expiry approaches"""
    data = r.get(key)
    if data:
        cached = json.loads(data)
        remaining_ttl = r.ttl(key)
        # The shorter the remaining TTL, the higher the probability of rebuilding
        if remaining_ttl > 0:
            delta = ttl - remaining_ttl
            threshold = delta * beta * math.log(random.random())
            if threshold < remaining_ttl:
                return cached["value"]

    # Rebuild
    value = rebuild_fn()
    r.setex(key, ttl, json.dumps({"value": value}))
    return value
```

### 8.3 Overuse of SELECT *

```sql
-- Bad: Fetch all columns including unnecessary ones
SELECT * FROM users WHERE id = 1;
-- → Also reads LOB columns and large JSONB
-- → Cannot use Index Only Scan

-- Good: Only the columns needed
SELECT id, name, email FROM users WHERE id = 1;
-- → Index Only Scan possible if a covering index exists
```

### 8.4 Excessive Index Creation

```sql
-- Bad: Index on every column
CREATE INDEX idx_users_name ON users (name);
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_age ON users (age);
CREATE INDEX idx_users_city ON users (city);
CREATE INDEX idx_users_name_email ON users (name, email);
CREATE INDEX idx_users_email_name ON users (email, name);
-- → Slows down INSERT/UPDATE, wastes storage

-- Good: Create only the minimum necessary indexes based on actual query patterns
-- 1. Columns most frequently in WHERE clauses
-- 2. Columns in JOIN conditions (FK)
-- 3. Columns in ORDER BY
-- 4. Periodically drop indexes with idx_scan=0 in pg_stat_user_indexes
```

---

## 9. Edge Cases

### Edge Case 1: Connection Pool Exhaustion

```python
# Problem: Long-running transactions occupy the pool
async def process_batch_bad(items):
    """Bad: Process everything with a single long-held connection"""
    async with pool.acquire() as conn:
        for item in items:  # Sequential processing of 10,000 items on 1 connection
            await conn.execute("INSERT INTO results VALUES ($1)", item)
            await external_api_call(item)  # 100ms/call = 1000 seconds total

# Solution: Split batches and return connections early
async def process_batch_good(items):
    """Good: Reuse connection with small batches"""
    for batch in chunks(items, 100):
        async with pool.acquire() as conn:
            async with conn.transaction():
                for item in batch:
                    await conn.execute("INSERT INTO results VALUES ($1)", item)
        # Connection is returned to pool here
        await asyncio.gather(*[external_api_call(item) for item in batch])
```

### Edge Case 2: Inconsistency Between Cache and Transaction

```python
# Problem: Crash between DB update and cache deletion
def update_user_bad(db, user_id, name):
    user = db.query(User).filter(User.id == user_id).first()
    user.name = name
    db.commit()          # ← DB is updated
    # ↓ If a crash occurs here, the cache remains stale
    r.delete(f"user:{user_id}")

# Solution: Outbox pattern (include in DB transaction)
def update_user_good(db, user_id, name):
    user = db.query(User).filter(User.id == user_id).first()
    user.name = name
    # Also record the cache invalidation event in DB
    db.execute(
        "INSERT INTO outbox (event_type, payload) VALUES (:type, :payload)",
        {"type": "cache_invalidate", "payload": json.dumps({"key": f"user:{user_id}"})}
    )
    db.commit()
    # A background worker processes the outbox and deletes the cache
```

### Edge Case 3: Leveraging HOT UPDATE

```sql
-- PostgreSQL HOT (Heap-Only Tuple) UPDATE
-- Condition: the updated column is not included in any index
-- Effect: skips index updates and completes within the table block

-- Case where HOT UPDATE is effective
CREATE TABLE counters (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(50),
    count INTEGER DEFAULT 0
);
CREATE INDEX idx_counters_name ON counters (name);

-- name is not changed → HOT UPDATE is triggered
UPDATE counters SET count = count + 1 WHERE id = 1;

-- Check HOT UPDATE status
SELECT
    relname,
    n_tup_upd,
    n_tup_hot_upd,
    CASE WHEN n_tup_upd > 0
         THEN ROUND(100.0 * n_tup_hot_upd / n_tup_upd, 1)
         ELSE 0
    END AS hot_update_pct
FROM pg_stat_user_tables
WHERE relname = 'counters';
-- The higher the hot_update_pct, the more efficient
```

---

## 10. Exercises

### Exercise 1: Basic — Analyzing EXPLAIN ANALYZE

Identify the problems in the following EXPLAIN ANALYZE output and propose improvements.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.id, o.total_amount, u.name
FROM orders o
JOIN users u ON u.id = o.user_id
WHERE o.status = 'pending'
  AND o.created_at > '2025-06-01'
ORDER BY o.created_at DESC
LIMIT 50;

-- Sort  (cost=15000.00..15000.13 rows=50 width=52)
--       (actual time=450.123..450.130 rows=50 loops=1)
--   Sort Key: o.created_at DESC
--   Sort Method: top-N heapsort  Memory: 32kB
--   ->  Hash Join  (cost=200.00..14500.00 rows=5000 width=52)
--                  (actual time=3.000..448.000 rows=5000 loops=1)
--         Hash Cond: (o.user_id = u.id)
--         ->  Seq Scan on orders o  (actual time=0.030..440.000 rows=5000 loops=1)
--               Filter: (status = 'pending' AND created_at > '2025-06-01')
--               Rows Removed by Filter: 995000
--               Buffers: shared read=25000
--         ->  Hash  (cost=150.00..150.00 rows=10000 width=20)
--               ->  Seq Scan on users u  (actual time=0.010..2.000 rows=10000 loops=1)
--               Buffers: shared hit=100
-- Buffers: shared hit=100 read=25000
-- Execution Time: 450.200 ms
```

**Sample Answer**:

Problems:
1. Seq Scan occurs on the orders table (995,000 out of 1 million rows are filtered out)
2. Buffers: shared read=25000 (no cache hits, all disk reads)
3. Estimated rows=5000 matches actual rows=5000, so statistics are accurate

Improvements:
```sql
-- Composite index (partial index)
CREATE INDEX idx_orders_pending_created
ON orders (created_at DESC)
WHERE status = 'pending';
-- → Seq Scan → Index Scan improvement
-- → Rows Removed approaches 0
-- → Expected improvement: 450ms → under 5ms

-- Further optimization: covering index
CREATE INDEX idx_orders_pending_covering
ON orders (created_at DESC)
INCLUDE (total_amount, user_id)
WHERE status = 'pending';
-- → Enables Index Only Scan
```

### Exercise 2: Applied — Caching Strategy Design

Design an appropriate caching strategy for the following requirements.

**Requirements**: Product detail page for an e-commerce site
- Product information is updated a few times per day
- Views: 1,000 per product per day
- Inventory count requires real-time accuracy
- Product image URLs never change

**Sample Answer**:

```python
# Product info: Cache-Aside + TTL 30 minutes + Write-Invalidate
def get_product(product_id: str) -> dict:
    key = f"product:{product_id}"
    cached = r.get(key)
    if cached:
        return json.loads(cached)

    product = db.query(Product).filter(Product.id == product_id).first()
    data = product.to_dict()
    r.setex(key, 1800, json.dumps(data))  # TTL 30 minutes
    return data

# Inventory count: Short TTL (10 seconds) + Immediate update on change
def get_stock(product_id: str) -> int:
    key = f"stock:{product_id}"
    cached = r.get(key)
    if cached:
        return int(cached)

    stock = db.query(Inventory.quantity).filter(
        Inventory.product_id == product_id
    ).scalar()
    r.setex(key, 10, str(stock))  # TTL 10 seconds (near real-time)
    return stock

def purchase_product(product_id: str, quantity: int):
    # Update DB
    db.execute(
        "UPDATE inventory SET quantity = quantity - :qty WHERE product_id = :pid",
        {"qty": quantity, "pid": product_id}
    )
    db.commit()
    # Delete inventory cache immediately (real-time accuracy)
    r.delete(f"stock:{product_id}")

# Image URLs: Long-term cache (since they never change)
# → Use CDN + Cache-Control: max-age=31536000
```

### Exercise 3: Advanced — Connection Pool Design

Design the optimal connection pool configuration for the following environment.

**Environment**:
- DB: PostgreSQL, 16-core CPU, 64GB RAM, max_connections=200
- App: 10 Pods on Kubernetes (autoscale 5-20)
- Average query time: 15ms
- Peak requests: 5,000 req/s
- Long queries (reports): a few times per month, up to 30 seconds

**Sample Answer**:

```
1. DB-side connection limit
   max_connections = 200
   superuser_reserved = 5 (for administration)
   Available = 195

2. Introduce pgBouncer (connection aggregation)
   max_db_connections = 50  (actual connections to DB)
   max_client_conn = 300    (connections accepted from app)
   pool_mode = transaction  (share connections per transaction)

3. App-side pool (per Pod)
   pool_size = 10
   max_overflow = 5
   Total: 10 Pods × 15 connections = 150 (within pgBouncer max_client_conn)

4. Verify with Little's Law
   Required connections = 5000 req/s × 0.015s = 75 connections
   pgBouncer max_db_connections = 50
   → In transaction mode, 50 connections can handle 75 concurrent requests
   (DB utilization time per request < 50% of query time)

5. Handling long report queries
   - Dedicated connection pool (separate pgBouncer section)
   - session mode to exclusively hold connections
   - max_db_connections = 3 (few connections for reports)
   - Connect to read replica
```

---

## 11. FAQ

### Q1. How do I determine the connection pool size?

**A.** "CPU core count * 2 + number of disk spindles" is the initial guideline (recommended by HikariCP). However, actual measurements are most important. Run load tests while varying the connection count to measure throughput and latency, and find the point where throughput is maximized and latency is stable. In most cases, 10-20 is sufficient.

### Q2. How do I set the TTL for Redis cache?

**A.** Decide based on the update frequency and tolerable staleness.
- Frequent updates (per second): TTL 10-30 seconds
- Daily updates: TTL 1-6 hours
- Nearly immutable (master data): TTL 24 hours + Write-Invalidate

The key is not to rely solely on TTL, but to also use cache invalidation when data is updated.

### Q3. What should I do when the "estimated row count" and "actual row count" in EXPLAIN ANALYZE diverge significantly?

**A.** Table statistics are likely stale. Update them with `ANALYZE tablename`. If the autovacuum/autoanalyze settings are insufficient, adjust `autovacuum_analyze_threshold` and `autovacuum_analyze_scale_factor`. For correlated multiple columns, creating extended statistics with `CREATE STATISTICS` can improve the situation.

### Q4. How much should shared_buffers be set to?

**A.** Generally, 25% of the server's physical memory is recommended. However, much of the remaining 75% functions as the OS page cache, so approximately 75% of the data is cached in memory in total. Increasing shared_buffers beyond 8-16GB has limited benefit and may actually reduce the OS page cache, which can be a disadvantage.

### Q5. Which pool_mode should I choose for pgBouncer?

**A.** `transaction` mode is optimal in most cases. `session` mode is only needed when Prepared Statements or LISTEN/NOTIFY are required. `statement` mode does not allow transactions and is limited to special use cases (maximizing connection aggregation). Note that `transaction` mode has restrictions: session variables (SET statements) and Prepared Statements cannot be used.

---

## 12. Troubleshooting

| Symptom | Cause | Solution |
|---------|-------|----------|
| Frequent connection timeouts | Pool exhaustion or exceeding max_connections | Review pool size, introduce pgBouncer |
| Many idle in transaction | Forgotten transaction close | Set idle_in_transaction_session_timeout |
| Low cache hit ratio | Insufficient shared_buffers or working set overflow | Increase shared_buffers, archive unnecessary data |
| Queries suddenly became slow | Stale statistics or table bloat | ANALYZE + VACUUM FULL |
| EXPLAIN estimated row count greatly diverges | Old statistics or correlated columns | ANALYZE + CREATE STATISTICS |
| Index not being used | Small data volume or type mismatch | Check query type casting, verify with SET enable_seqscan=off |
| Seq Scan won't stop | random_page_cost too high (SSD environment) | Set random_page_cost = 1.1 (for SSD) |
| VACUUM can't keep up | Large volume of UPDATEs + insufficient autovacuum settings | Shorten autovacuum_vacuum_cost_delay to 2ms |
| OOM crash | work_mem × connection count exceeds memory | Lower work_mem or limit connection count |
| Replica lag | Heavy writes + insufficient replica specs | wal_level = logical, increase replica specs |

---

## 13. Performance Optimization Checklist

```python
# Performance improvement priorities (in order of impact)

optimization_checklist = [
    {
        "priority": 1,
        "category": "Indexes",
        "actions": [
            "Verify indexes exist on WHERE clause columns",
            "Verify indexes exist on JOIN condition columns",
            "Verify indexes exist on ORDER BY columns",
            "Check composite index column order",
            "Remove unused indexes (idx_scan=0)",
        ],
    },
    {
        "priority": 2,
        "category": "Query Rewrites",
        "actions": [
            "Change SELECT * to only necessary columns",
            "Rewrite subqueries as JOINs",
            "Rewrite DISTINCT as GROUP BY",
            "Change OFFSET pagination to cursor-based",
            "Change N+1 queries to JOIN or batch retrieval",
        ],
    },
    {
        "priority": 3,
        "category": "Table Design",
        "actions": [
            "Review normalization (denormalize for read-heavy workloads)",
            "Consider partitioning (large tables)",
            "Use materialized views (aggregate queries)",
            "Consider BRIN indexes (time-series data)",
        ],
    },
    {
        "priority": 4,
        "category": "Caching",
        "actions": [
            "Introduce Cache-Aside + TTL + Write-Invalidate",
            "Monitor cache hit ratio",
            "Address Cache Stampede (TTL jitter + lock)",
            "Pre-warm hot data",
        ],
    },
    {
        "priority": 5,
        "category": "Infrastructure",
        "actions": [
            "Optimize connection pool (measurement-based)",
            "Introduce pgBouncer (many app instances)",
            "Introduce read replicas (distribute reads)",
            "Migrate to SSD and adjust random_page_cost",
        ],
    },
]
```

---

## 14. Security Considerations

1. **Connection Pool Credential Management**: Do not write passwords directly in the connection string; use environment variables or a secret manager (AWS Secrets Manager, HashiCorp Vault, etc.).

2. **Redis Cache Security**: Redis has no authentication by default. In production, set `requirepass` and enable TLS. If personal information is stored in the cache, consider encrypting the data.

3. **SQL Injection Prevention**: Even when building dynamic SQL for performance optimization, always use parameter binding.

```python
# Bad: String concatenation
query = f"SELECT * FROM users WHERE email = '{email}'"

# Good: Parameter binding
query = "SELECT * FROM users WHERE email = :email"
db.execute(query, {"email": email})
```

4. **pg_stat_statements Access Control**: Query statistics may contain business logic. Restrict access by general users.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world work?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|-----------|
| **Connection Pool** | CPU cores * 2 as starting value, tune based on measurements, stabilize with pool_pre_ping |
| **External Pool** | pgBouncer (transaction mode) for connection aggregation; essential for large-scale environments |
| **Caching** | Combination of Cache-Aside + TTL + Write-Invalidate |
| **Cache Stampede Prevention** | TTL jitter + lock to prevent simultaneous rebuilds |
| **Query Optimization** | EXPLAIN ANALYZE → add indexes → rewrite queries |
| **Statistics** | Regular ANALYZE + CREATE STATISTICS (for correlated columns) |
| **Pagination** | Significant improvement by changing OFFSET to cursor-based |
| **Bulk Processing** | COPY > multi-row INSERT > single INSERT |
| **Partitioning** | Use RANGE partitioning for large tables to leverage Pruning |
| **Monitoring** | Continuously monitor pg_stat_statements + cache hit ratio + connection count |

---

## Guides to Read Next

- [03-orm-comparison.md](./03-orm-comparison.md) — ORM comparison and selection criteria
- [00-postgresql-features.md](./00-postgresql-features.md) — Advanced PostgreSQL-specific features
- [03-data-modeling.md](../02-design/03-data-modeling.md) — Data modeling for analytical queries
- [01-schema-design.md](../02-design/01-schema-design.md) — Table design and index strategies

---

## References

1. **PostgreSQL Official Documentation** — "Performance Tips" — https://www.postgresql.org/docs/current/performance-tips.html
2. **HikariCP Wiki** — "About Pool Sizing" — https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing
3. **Redis Official Documentation** — "Caching Patterns" — https://redis.io/docs/manual/patterns/
4. **Use The Index, Luke** — Comprehensive guide to SQL index design — https://use-the-index-luke.com/
5. **pgBouncer Official Documentation** — https://www.pgbouncer.org/
6. **Citus Data** — "Connection Management in PostgreSQL" — https://www.citusdata.com/blog/
7. **Percona** — "PostgreSQL Performance Tuning" — https://www.percona.com/blog/

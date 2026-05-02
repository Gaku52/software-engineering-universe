# DB Scaling

> This chapter explains scaling strategies for handling increased database load, covering the design principles and implementation techniques for replication, sharding, and partitioning, with concrete code examples and trade-off analysis.

## What You Will Learn

1. **Vertical Scaling vs Horizontal Scaling** --- The limits of scaling up and design decisions for horizontal distribution
2. **Replication Strategies** --- Primary/replica configuration, read/write splitting, and handling replication lag
3. **Sharding and Partitioning** --- Shard key selection, data distribution algorithms, and hotspot avoidance
4. **Incremental Scaling** --- Choosing the optimal scaling approach based on load level
5. **Operations and Monitoring** --- Replication lag monitoring, resharding, and backup strategies

## Prerequisites

| Topic | Required Level | Reference |
|---------|-----------|--------|
| SQL Basics | Intermediate | Programming Fundamentals |
| Transactions (ACID) | Basic | [CAP Theorem](../00-fundamentals/03-cap-theorem.md) |
| Indexes | Basic | Database Fundamentals |
| Caching | Basic | [Caching](./01-caching.md) |

---

## 0. WHY --- Why Is DB Scaling Necessary?

### 0.1 Limits of a Single DB

```
Practical limits of a single PostgreSQL server:

  ┌───────────────────────────────────────────┐
  │  Hardware Limits                          │
  │  ├─ CPU: up to 128 cores                  │
  │  ├─ RAM: up to 2TB                        │
  │  ├─ Storage IOPS: ~100,000                │
  │  └─ Network: 25 Gbps                      │
  │                                           │
  │  Performance Limits (tuned):              │
  │  ├─ Writes: ~50,000 TPS                   │
  │  ├─ Reads: ~200,000 QPS                   │
  │  ├─ Table size: degradation beyond ~1B rows│
  │  └─ Concurrent connections: ~5,000        │
  │                                           │
  │  Single Point of Failure (SPOF):          │
  │  ├─ Server failure → all services down    │
  │  └─ RTO: minutes to hours (backup restore)│
  └───────────────────────────────────────────┘

  Performance issues typically become apparent beyond 100M requests/month
```

### 0.2 Quantitative Impact of Scaling

| Metric | Single DB | Read Replica x3 | Sharding x4 |
|------|--------|-----------------|----------------|
| Read QPS | 200K | 800K | 800K |
| Write TPS | 50K | 50K (unchanged) | 200K |
| Data Capacity | ~10TB | ~10TB (same) | ~40TB |
| Availability | 99.9% | 99.99% | 99.99% |
| Failover Time | Minutes | Seconds (automatic) | Seconds (per shard) |
| Operational Complexity | Low | Medium | High |

---

## 1. Overview of Scaling Strategies

### 1.1 Scale Up vs Scale Out

```
[Scale Up (Vertical)]
  +--------+          +============+
  | DB     |   --->   || DB        ||
  | 4CPU   |          || 64CPU     ||
  | 16GB   |          || 512GB     ||
  +--------+          +============+
  Limits: hardware ceiling, single point of failure, non-linear cost increase
  Advantage: no application changes required

[Scale Out (Horizontal)]
  +--------+          +------+ +------+ +------+ +------+
  | DB     |   --->   | DB 1 | | DB 2 | | DB 3 | | DB 4 |
  | All    |          | A-F  | | G-L  | | M-R  | | S-Z  |
  | Data   |          +------+ +------+ +------+ +------+
  Advantages: theoretically unlimited scale, fault tolerance
  Disadvantages: requires changes to the application layer
```

### 1.2 Incremental Scaling Roadmap

```
Phase 0: Optimization (free)
  App --> [Primary DB + index optimization + query tuning]
  ~1M requests/month
  ↓ "Can we still manage with a single DB?"

Phase 1: Connection Pooling
  App --> [PgBouncer] --> [Primary DB]
  ~5M requests/month
  ↓ "Are reads more than 10x writes?"

Phase 2: Read/Write Splitting (Read Replica)
  App --> [Primary] (Write)
      --> [Replica 1] (Read)
      --> [Replica 2] (Read)
  ~30M requests/month
  ↓ "Can caching absorb read load?"

Phase 3: Add Cache Layer
  App --> [Redis Cache] --> [Primary / Replicas]
  ~100M requests/month
  ↓ "Are tables too large?"

Phase 4: Partitioning
  App --> [Primary (partitioned tables)]
  ~300M requests/month
  ↓ "Has write load exceeded single Primary's limit?"

Phase 5: Sharding
  App --> [Router] --> [Shard 0] [Shard 1] [Shard 2] ...
  ~1B+ requests/month
```

### 1.3 Scaling Decision Flowchart

```
DB performance issue occurs
  │
  ├─ Slow queries?
  │   └─ EXPLAIN ANALYZE → add indexes / rewrite queries
  │
  ├─ Connection count at limit?
  │   └─ Introduce PgBouncer / ProxySQL
  │
  ├─ High read load?
  │   ├─ Can caching handle it? → Introduce Redis
  │   └─ Caching not suitable → Add Read Replica
  │
  ├─ Huge tables (hundreds of millions of rows)?
  │   └─ Partitioning (split within single DB)
  │
  ├─ High write load?
  │   ├─ Can batching/bulk operations help? → Optimize app
  │   └─ Not possible → Sharding
  │
  └─ Insufficient storage?
      └─ Partitioning + archive old data
```

---

## 2. Replication

### 2.1 Primary/Replica Configuration

```
                      +------------------+
                      |   Primary (RW)   |
                      |   (writes only)  |
                      +--------+---------+
                               |
                   WAL / Binlog stream
                     +---------|--------+
                     |         |        |
               +-----v--+ +---v----+ +-v-------+
               |Replica 1| |Replica2| |Replica 3|
               | (Read)  | | (Read) | |  (Read) |
               +---------+ +--------+ +---------+
               | Choose between synchronous/asynchronous replication
               |
               | Synchronous: zero data loss, increased latency
               | Asynchronous: high throughput, lag occurs
               | Semi-synchronous: 1 node sync, others async (recommended)
```

### 2.2 Comparison of Replication Modes

| Mode | Data Loss | Write Latency | Throughput | Use Case |
|------|----------|------------------|------------|------------|
| Synchronous Replication | None | High (+2-10ms) | Low | Finance, payments |
| Asynchronous Replication | Possible (lag-based) | None | High | General web apps |
| Semi-synchronous Replication | Minimal | Medium (+1-5ms) | Medium-High | Recommended default |
| Multi-master | Conflict risk | Variable | High | Global distribution |

### 2.3 Implementing Read/Write Splitting

```python
# Read/write splitting with SQLAlchemy (Python)
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager
import random
import time

class ReadWriteSplitter:
    """Class that manages read/write splitting"""

    def __init__(
        self,
        write_dsn: str,
        read_dsns: list[str],
        replication_lag_threshold: float = 5.0,
    ):
        # Primary for writes
        self.write_engine = create_engine(
            write_dsn,
            pool_size=20,
            max_overflow=10,
            pool_pre_ping=True,  # connection health check
            pool_recycle=1800,   # reconnect every 30 minutes
        )

        # Replicas for reads
        self.read_engines = [
            create_engine(
                dsn,
                pool_size=30,
                max_overflow=15,
                pool_pre_ping=True,
            )
            for dsn in read_dsns
        ]

        self.replication_lag_threshold = replication_lag_threshold
        self._recent_writes: dict[str, float] = {}  # {entity_key: timestamp}

    @contextmanager
    def write_session(self) -> Session:
        """Write session (always Primary)"""
        session = sessionmaker(bind=self.write_engine)()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    @contextmanager
    def read_session(self, entity_key: str = None) -> Session:
        """
        Read session
        - If there was a recent write, read from Primary (Read-your-writes)
        - Otherwise, randomly select from a Replica
        """
        use_primary = False

        if entity_key:
            last_write = self._recent_writes.get(entity_key, 0)
            use_primary = (time.time() - last_write) < self.replication_lag_threshold

        if use_primary:
            engine = self.write_engine
        else:
            engine = random.choice(self.read_engines)

        session = sessionmaker(bind=engine)()
        try:
            yield session
        finally:
            session.close()

    def record_write(self, entity_key: str):
        """Record a write (for Read-your-writes)"""
        self._recent_writes[entity_key] = time.time()

        # Periodically clean up old records
        cutoff = time.time() - self.replication_lag_threshold * 2
        self._recent_writes = {
            k: v for k, v in self._recent_writes.items() if v > cutoff
        }

# Usage example
db = ReadWriteSplitter(
    write_dsn='postgresql://user:pass@primary:5432/myapp',
    read_dsns=[
        'postgresql://user:pass@replica-1:5432/myapp',
        'postgresql://user:pass@replica-2:5432/myapp',
        'postgresql://user:pass@replica-3:5432/myapp',
    ],
    replication_lag_threshold=5.0,
)

# Write
def create_order(user_id: str, items: list) -> dict:
    with db.write_session() as session:
        order = Order(user_id=user_id, items=items, status="pending")
        session.add(order)
        session.flush()  # get ID
        db.record_write(f"user:{user_id}")
        return {"order_id": order.id}

# Read (reads from Primary immediately after a write)
def get_user_orders(user_id: str) -> list:
    with db.read_session(entity_key=f"user:{user_id}") as session:
        return session.query(Order).filter_by(user_id=user_id).all()
```

### 2.4 Monitoring Replication Lag

```python
"""Monitoring and mitigating replication lag"""
from dataclasses import dataclass
from datetime import datetime
import psycopg2

@dataclass
class ReplicationStatus:
    replica_host: str
    lag_bytes: int
    lag_seconds: float
    state: str  # streaming, catchup, startup
    is_healthy: bool

class ReplicationMonitor:
    """PostgreSQL replication lag monitor"""

    LAG_WARNING_SECONDS = 5.0
    LAG_CRITICAL_SECONDS = 30.0

    def __init__(self, primary_dsn: str, replica_dsns: list[str]):
        self.primary_dsn = primary_dsn
        self.replica_dsns = replica_dsns

    def check_primary_status(self) -> list[dict]:
        """Check replica status from the Primary"""
        conn = psycopg2.connect(self.primary_dsn)
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT
                        client_addr,
                        state,
                        sent_lsn,
                        write_lsn,
                        flush_lsn,
                        replay_lsn,
                        pg_wal_lsn_diff(sent_lsn, replay_lsn) AS lag_bytes,
                        reply_time
                    FROM pg_stat_replication
                    ORDER BY client_addr;
                """)
                return [
                    {
                        'host': row[0],
                        'state': row[1],
                        'lag_bytes': row[6],
                        'reply_time': row[7],
                    }
                    for row in cur.fetchall()
                ]
        finally:
            conn.close()

    def check_replica_lag(self, replica_dsn: str) -> ReplicationStatus:
        """Check lag from the Replica side"""
        conn = psycopg2.connect(replica_dsn)
        try:
            with conn.cursor() as cur:
                # Get replication lag in seconds
                cur.execute("""
                    SELECT
                        CASE
                            WHEN pg_last_wal_receive_lsn() = pg_last_wal_replay_lsn()
                            THEN 0
                            ELSE EXTRACT(EPOCH FROM now() - pg_last_xact_replay_timestamp())
                        END AS lag_seconds;
                """)
                lag_seconds = cur.fetchone()[0] or 0

                # Replication state
                cur.execute("SELECT pg_is_in_recovery();")
                is_replica = cur.fetchone()[0]

                return ReplicationStatus(
                    replica_host=replica_dsn.split('@')[1].split(':')[0],
                    lag_bytes=0,
                    lag_seconds=lag_seconds,
                    state='streaming' if is_replica else 'primary',
                    is_healthy=lag_seconds < self.LAG_WARNING_SECONDS,
                )
        finally:
            conn.close()

    def get_all_replica_status(self) -> list[ReplicationStatus]:
        """Get status of all replicas"""
        statuses = []
        for dsn in self.replica_dsns:
            try:
                status = self.check_replica_lag(dsn)
                statuses.append(status)
            except Exception as e:
                statuses.append(ReplicationStatus(
                    replica_host=dsn.split('@')[1].split(':')[0],
                    lag_bytes=0,
                    lag_seconds=-1,
                    state='unreachable',
                    is_healthy=False,
                ))
        return statuses

    def should_use_primary_for_reads(
        self, statuses: list[ReplicationStatus]
    ) -> bool:
        """Switch to reading from Primary when all replicas have critical lag"""
        healthy = [s for s in statuses if s.is_healthy]
        return len(healthy) == 0

# For Prometheus metrics exposure:
# pg_replication_lag_seconds{replica="replica-1"} 0.5
# pg_replication_lag_seconds{replica="replica-2"} 1.2
# pg_replication_lag_seconds{replica="replica-3"} 0.8
```

### 2.5 Connection Pooling

```python
"""PgBouncer / Connection pooling design"""
from dataclasses import dataclass

@dataclass
class ConnectionPoolConfig:
    """Guidelines for connection pool design"""

    # PgBouncer configuration example
    pgbouncer_config = """
    [databases]
    myapp_write = host=primary port=5432 dbname=myapp
    myapp_read = host=replica-1 port=5432 dbname=myapp
                 host=replica-2 port=5432 dbname=myapp

    [pgbouncer]
    listen_addr = 0.0.0.0
    listen_port = 6432

    # Pooling modes:
    # session: per-session (supports PREPARE)
    # transaction: per-transaction (recommended, most efficient)
    # statement: per-statement (not recommended)
    pool_mode = transaction

    # Connection count design:
    # App side: pool_size * app_instances = max client connections
    # DB side: max_connections = PgBouncer's server_pool_size
    max_client_conn = 1000        # max connections from app
    default_pool_size = 50        # concurrent connections to DB
    reserve_pool_size = 10        # reserve for bursts
    reserve_pool_timeout = 3      # seconds to wait before using reserve pool

    # Health check
    server_check_query = select 1
    server_check_delay = 10
    server_connect_timeout = 5
    server_login_retry = 3

    # Timeouts
    query_timeout = 30            # query timeout
    client_idle_timeout = 600     # disconnect idle clients
    """

    # Formula for calculating connection count
    @staticmethod
    def calculate_pool_size(
        app_instances: int,
        connections_per_instance: int,
        db_max_connections: int = 200,
    ) -> dict:
        """Calculate optimal pool size"""
        total_app_connections = app_instances * connections_per_instance

        # PgBouncer's server_pool_size should be 50-70% of DB's max_connections
        server_pool = int(db_max_connections * 0.6)

        # Multiplexing ratio: app connections / DB connections
        multiplexing_ratio = total_app_connections / server_pool

        return {
            'app_instances': app_instances,
            'connections_per_instance': connections_per_instance,
            'total_app_connections': total_app_connections,
            'pgbouncer_server_pool': server_pool,
            'db_max_connections': db_max_connections,
            'multiplexing_ratio': f"{multiplexing_ratio:.1f}x",
            'recommendation': (
                'OK' if multiplexing_ratio < 20
                else 'WARNING: Multiplexing ratio too high. Consider increasing DB connections.'
            ),
        }

# Example: 10 app instances x 20 connections/instance
result = ConnectionPoolConfig.calculate_pool_size(
    app_instances=10,
    connections_per_instance=20,
    db_max_connections=200,
)
# Result:
# total_app_connections: 200
# pgbouncer_server_pool: 120
# multiplexing_ratio: 1.7x (good)
```

---

## 3. Sharding

### 3.1 Comparison of Sharding Strategies

| Strategy | Description | Advantages | Disadvantages | Use Case |
|------|------|---------|-----------|------------|
| Range-based | Split by key range (A-F, G-L...) | Simple, easy range queries | Data skew, hotspots | Time-series data (monthly partitions) |
| Hash-based | Split by hash(key) % N | Even distribution | No range queries, resharding is difficult | User data |
| Consistent hashing | Split on a hash ring | Minimal data movement on node add | Complex implementation, possible load skew | Large-scale distributed systems |
| Directory-based | Managed via lookup table | Flexible mapping | Table is SPOF, added latency | Multi-tenant |
| Geo-based | Split geographically | Low latency | Data skew | Global services |

### 3.2 How Consistent Hashing Works

```
          Consistent Hash Ring

              0 (= 2^32)
              |
       Shard C ●-------- ● Shard A
             /              \
           /     Key X →      \
          |     (placed in Shard A) |
          |                      |
           \                  /
            \   ● Shard B   /
              +----●------+
                 Key Y →
              (placed in Shard B)

  Virtual nodes: each shard is split into 100-200 virtual nodes
  → Even with few physical nodes, they are evenly distributed across the hash space

  Adding a node: add Shard D
  → Only some keys from Shard A move to Shard D
  → Other shards are not affected
  → Data moved: 1/N of total (N = number of shards)
```

### 3.3 Implementing Sharding

```python
# Hash-based sharding (Python)
import hashlib
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from sqlalchemy import create_engine, text
from contextlib import contextmanager

@dataclass
class ShardConfig:
    shard_id: int
    dsn: str
    is_primary: bool = True
    replicas: list[str] = field(default_factory=list)

class ShardRouter:
    """Shard router implementation"""

    def __init__(self, shard_configs: list[ShardConfig]):
        self.shards: dict[int, ShardConfig] = {}
        self.engines: dict[int, any] = {}
        self.replica_engines: dict[int, list] = {}

        for config in shard_configs:
            self.shards[config.shard_id] = config
            self.engines[config.shard_id] = create_engine(
                config.dsn,
                pool_size=20,
                pool_pre_ping=True,
            )
            self.replica_engines[config.shard_id] = [
                create_engine(dsn, pool_size=30, pool_pre_ping=True)
                for dsn in config.replicas
            ]

        self.shard_count = len(shard_configs)

    def get_shard_id(self, shard_key: str) -> int:
        """Determine shard ID from shard key"""
        hash_value = int(hashlib.sha256(
            str(shard_key).encode()
        ).hexdigest(), 16)
        return hash_value % self.shard_count

    @contextmanager
    def write_connection(self, shard_key: str):
        """Write connection (Primary)"""
        shard_id = self.get_shard_id(shard_key)
        engine = self.engines[shard_id]
        conn = engine.connect()
        try:
            yield conn
        finally:
            conn.close()

    @contextmanager
    def read_connection(self, shard_key: str):
        """Read connection (Replica preferred)"""
        shard_id = self.get_shard_id(shard_key)
        replicas = self.replica_engines[shard_id]

        if replicas:
            engine = random.choice(replicas)
        else:
            engine = self.engines[shard_id]

        conn = engine.connect()
        try:
            yield conn
        finally:
            conn.close()

    def execute_on_shard(
        self, shard_key: str, query: str, params: dict = None
    ) -> list:
        """Execute query on a specific shard"""
        with self.write_connection(shard_key) as conn:
            result = conn.execute(text(query), params or {})
            return result.fetchall()

    def scatter_gather(
        self, query: str, params: dict = None,
        sort_key: str = None, limit: int = None,
    ) -> list:
        """
        Execute query on all shards and aggregate results (Scatter-Gather)
        Note: Parallel queries to N shards → latency depends on slowest shard
        """
        from concurrent.futures import ThreadPoolExecutor, as_completed

        results = []

        def query_shard(shard_id: int):
            engine = self.engines[shard_id]
            with engine.connect() as conn:
                result = conn.execute(text(query), params or {})
                return result.fetchall()

        # Parallel execution
        with ThreadPoolExecutor(max_workers=self.shard_count) as executor:
            futures = {
                executor.submit(query_shard, sid): sid
                for sid in self.engines.keys()
            }
            for future in as_completed(futures):
                shard_id = futures[future]
                try:
                    rows = future.result()
                    results.extend(rows)
                except Exception as e:
                    print(f"Shard {shard_id} query failed: {e}")

        # Sort and limit
        if sort_key:
            results.sort(key=lambda r: r[sort_key])
        if limit:
            results = results[:limit]

        return results

# Usage example
router = ShardRouter([
    ShardConfig(
        shard_id=0,
        dsn='postgresql://user:pass@shard0-primary:5432/myapp',
        replicas=['postgresql://user:pass@shard0-replica:5432/myapp'],
    ),
    ShardConfig(
        shard_id=1,
        dsn='postgresql://user:pass@shard1-primary:5432/myapp',
        replicas=['postgresql://user:pass@shard1-replica:5432/myapp'],
    ),
    ShardConfig(
        shard_id=2,
        dsn='postgresql://user:pass@shard2-primary:5432/myapp',
        replicas=['postgresql://user:pass@shard2-replica:5432/myapp'],
    ),
])

# Use user ID as shard key
user_id = 'user-12345'
shard_id = router.get_shard_id(user_id)  # → e.g.: 1
print(f"User {user_id} → Shard {shard_id}")
```

### 3.4 Principles of Shard Key Design

```python
"""Evaluation framework for shard key design"""
from dataclasses import dataclass

@dataclass
class ShardKeyEvaluation:
    """Evaluation criteria for shard keys"""

    key_name: str
    cardinality: str       # "High" / "Medium" / "Low"
    distribution: str      # "Even" / "Skewed" / "Hotspot"
    query_isolation: str   # "High" / "Medium" / "Low"
    join_locality: str     # "High" / "Medium" / "Low"
    verdict: str           # "Recommended" / "Conditional" / "Not Recommended"

SHARD_KEY_EVALUATIONS = [
    ShardKeyEvaluation(
        key_name="user_id",
        cardinality="High",
        distribution="Even (when using UUID)",
        query_isolation="High (when most queries are per-user)",
        join_locality="High (user's data in same shard)",
        verdict="Recommended: most common and safest shard key",
    ),
    ShardKeyEvaluation(
        key_name="tenant_id",
        cardinality="Medium",
        distribution="Prone to skew (large tenants exist)",
        query_isolation="High (complete isolation per tenant)",
        join_locality="High",
        verdict="Recommended: standard for multi-tenant SaaS",
    ),
    ShardKeyEvaluation(
        key_name="created_at (datetime)",
        cardinality="High",
        distribution="Hotspot (concentrated on latest data)",
        query_isolation="High (time range queries)",
        join_locality="Low",
        verdict="Not Recommended: writes concentrate on latest shard",
    ),
    ShardKeyEvaluation(
        key_name="auto_increment_id",
        cardinality="High",
        distribution="Hotspot (concentrated on latest IDs)",
        query_isolation="Low",
        join_locality="Low",
        verdict="Not Recommended: writes concentrate on latest shard",
    ),
    ShardKeyEvaluation(
        key_name="country_code",
        cardinality="Low (~200)",
        distribution="Skewed (concentrated in US/JP/CN)",
        query_isolation="High",
        join_locality="High",
        verdict="Conditional: effective if geographic distribution is the goal",
    ),
    ShardKeyEvaluation(
        key_name="compound (user_id + order_date)",
        cardinality="High",
        distribution="Even",
        query_isolation="High (user + time range queries)",
        join_locality="Medium",
        verdict="Recommended: compound key balances even distribution and range queries",
    ),
]

# Principles for shard key selection:
# 1. High cardinality (many unique values)
# 2. Matches access patterns (included in WHERE clause of most frequent queries)
# 3. Distributes evenly (avoids hotspots)
# 4. Related data is placed in the same shard (JOIN locality)
# 5. No skew even as data grows in the future
```

### 3.5 PostgreSQL Table Partitioning

```sql
-- PostgreSQL: range partitioning
CREATE TABLE orders (
    id          BIGSERIAL,
    user_id     BIGINT NOT NULL,
    amount      DECIMAL(10, 2) NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Monthly partitions (managed by an auto-creation script)
CREATE TABLE orders_2026_01 PARTITION OF orders
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE orders_2026_02 PARTITION OF orders
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE orders_2026_03 PARTITION OF orders
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- Indexes per partition (automatically created for each partition)
CREATE INDEX idx_orders_user_id ON orders (user_id);
CREATE INDEX idx_orders_status ON orders (status);

-- Query: PostgreSQL automatically scans only the relevant partition
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE created_at >= '2026-02-01' AND created_at < '2026-03-01'
  AND user_id = 12345;
-- → scans only orders_2026_02 (partition pruning)

-- Hash partitioning (even distribution)
CREATE TABLE user_events (
    id         BIGSERIAL,
    user_id    BIGINT NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    payload    JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (id, user_id)
) PARTITION BY HASH (user_id);

CREATE TABLE user_events_0 PARTITION OF user_events
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE user_events_1 PARTITION OF user_events
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE user_events_2 PARTITION OF user_events
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE user_events_3 PARTITION OF user_events
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- Automate partition management
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
    start_date TEXT;
    end_date TEXT;
BEGIN
    -- Pre-create up to 3 months ahead
    FOR i IN 0..3 LOOP
        partition_date := date_trunc('month', NOW()) + (i || ' months')::interval;
        partition_name := 'orders_' || to_char(partition_date, 'YYYY_MM');
        start_date := to_char(partition_date, 'YYYY-MM-DD');
        end_date := to_char(partition_date + '1 month'::interval, 'YYYY-MM-DD');

        -- Create partition if it does not exist
        IF NOT EXISTS (
            SELECT 1 FROM pg_class WHERE relname = partition_name
        ) THEN
            EXECUTE format(
                'CREATE TABLE %I PARTITION OF orders FOR VALUES FROM (%L) TO (%L)',
                partition_name, start_date, end_date
            );
            RAISE NOTICE 'Created partition: %', partition_name;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Archive old partitions
CREATE OR REPLACE FUNCTION archive_old_partitions(retention_months INT)
RETURNS void AS $$
DECLARE
    partition_name TEXT;
    cutoff_date DATE;
BEGIN
    cutoff_date := date_trunc('month', NOW()) - (retention_months || ' months')::interval;

    FOR partition_name IN
        SELECT tablename FROM pg_tables
        WHERE tablename LIKE 'orders_____'
        AND tablename < 'orders_' || to_char(cutoff_date, 'YYYY_MM')
    LOOP
        -- 1. Export to S3 (pg_dump)
        -- 2. Detach the partition
        EXECUTE format('ALTER TABLE orders DETACH PARTITION %I', partition_name);
        -- 3. Drop the table
        EXECUTE format('DROP TABLE %I', partition_name);
        RAISE NOTICE 'Archived and dropped: %', partition_name;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. Resharding

### 4.1 Resharding Challenges and Strategies

```
Resharding: changing the number of shards (e.g., 4 → 8 shards)

  Method 1: With downtime (simplest)
  ┌─────────────────────────────────────────────┐
  │ 1. Stop the application                     │
  │ 2. Copy all data to the new shard layout    │
  │ 3. Update routing                           │
  │ 4. Restart the application                  │
  │                                             │
  │ Duration: depends on data volume (hours to days) │
  │ Risk: Low (safe execution offline)          │
  └─────────────────────────────────────────────┘

  Method 2: Online resharding (zero downtime)
  ┌─────────────────────────────────────────────┐
  │ 1. Add new shards                           │
  │ 2. Dual write: write to both old and new    │
  │ 3. Migrate data from old to new in background│
  │ 4. Verify consistency                       │
  │ 5. Switch reads to new shards               │
  │ 6. Stop writes to old shards                │
  │                                             │
  │ Duration: days to weeks                     │
  │ Risk: High (difficult to maintain data consistency) │
  └─────────────────────────────────────────────┘

  Method 3: Resharding management via Vitess / ProxySQL
  → DB middleware automates resharding
```

### 4.2 Implementing Online Resharding

```python
"""Online resharding: dual-write approach"""
import hashlib
from enum import Enum

class MigrationPhase(Enum):
    DUAL_WRITE = "dual_write"      # write to both old and new
    BACKFILL = "backfill"          # migrate data from old to new
    VERIFY = "verify"              # verify consistency
    CUTOVER = "cutover"            # switch reads to new
    CLEANUP = "cleanup"            # delete old data

class OnlineResharder:
    """Zero-downtime resharding"""

    def __init__(
        self,
        old_router: 'ShardRouter',
        new_router: 'ShardRouter',
    ):
        self.old_router = old_router
        self.new_router = new_router
        self.phase = MigrationPhase.DUAL_WRITE
        self._migrated_keys: set = set()

    def write(self, shard_key: str, query: str, params: dict):
        """Write routing based on current phase"""
        if self.phase == MigrationPhase.DUAL_WRITE:
            # Write to both old and new
            self.old_router.execute_on_shard(shard_key, query, params)
            self.new_router.execute_on_shard(shard_key, query, params)
        elif self.phase in (MigrationPhase.CUTOVER, MigrationPhase.CLEANUP):
            # Write to new shards only
            self.new_router.execute_on_shard(shard_key, query, params)
        else:
            self.old_router.execute_on_shard(shard_key, query, params)

    def read(self, shard_key: str, query: str, params: dict):
        """Read routing based on current phase"""
        if self.phase in (MigrationPhase.CUTOVER, MigrationPhase.CLEANUP):
            return self.new_router.execute_on_shard(shard_key, query, params)
        else:
            return self.old_router.execute_on_shard(shard_key, query, params)

    def backfill_batch(self, batch_keys: list[str]):
        """Migrate data in batches"""
        for key in batch_keys:
            if key not in self._migrated_keys:
                # Read data from old shard
                data = self.old_router.execute_on_shard(
                    key, "SELECT * FROM users WHERE id = :id", {"id": key}
                )
                # Write to new shard
                for row in data:
                    self.new_router.execute_on_shard(
                        key,
                        "INSERT INTO users (...) VALUES (...) ON CONFLICT DO NOTHING",
                        dict(row)
                    )
                self._migrated_keys.add(key)

    def verify_consistency(self, sample_keys: list[str]) -> dict:
        """Verify data consistency between old and new"""
        mismatches = []
        for key in sample_keys:
            old_data = self.old_router.execute_on_shard(
                key, "SELECT * FROM users WHERE id = :id", {"id": key}
            )
            new_data = self.new_router.execute_on_shard(
                key, "SELECT * FROM users WHERE id = :id", {"id": key}
            )
            if old_data != new_data:
                mismatches.append(key)

        return {
            'total_verified': len(sample_keys),
            'mismatches': len(mismatches),
            'consistency_rate': (len(sample_keys) - len(mismatches)) / len(sample_keys),
            'mismatch_keys': mismatches[:10],  # first 10 entries
        }
```

---

## 5. Comparison of Scaling Approaches

### Comparison Table 1: Characteristics

| Characteristic | Replication | Partitioning | Sharding |
|------|:-------------:|:---------------:|:------------:|
| Purpose | Read scaling + availability | Data management within single DB | Write scaling |
| Data Distribution | All data replicated | Table split within single DB | Distributed across different DB servers |
| Write Scaling | No (single Primary) | Limited | Yes |
| Read Scaling | Yes (add Replicas) | Yes (pruning) | Yes |
| Implementation Complexity | Low | Low-Medium | High |
| Cross-data Joins | Easy | Easy | Difficult |
| When to Apply | Read load > write load | Managing large tables | Write load exceeds single DB limit |

### Comparison Table 2: Decision Points

| Decision Point | Recommended Approach | Reason |
|-------------|---------|------|
| High read load | Read Replica | Single node sufficient for writes |
| Huge tables (hundreds of millions of rows) | Partitioning | Manageable within single DB |
| Writes exceed tens of thousands per second | Sharding | Primary distribution is required |
| Global distribution | Multi-region replication | Geographic latency optimization |
| Multi-tenant | Per-tenant sharding | Complete isolation between tenants |
| Accumulating time-series data | Partitioning + archiving | Efficient management of old data |

### Comparison Table 3: Managed Services

| Characteristic | Amazon RDS | Amazon Aurora | Cloud Spanner | CockroachDB | Vitess |
|------|-----------|-------------|--------------|-------------|--------|
| Type | Managed RDBMS | Cloud-native RDBMS | NewSQL | NewSQL | Sharding middleware |
| Auto Scale | Manual (instance change) | Storage auto-scales | Automatic (add nodes) | Automatic | Semi-automatic |
| Replication | Async/semi-sync | Synchronous (6-way) | Synchronous (Paxos) | Synchronous (Raft) | Asynchronous |
| Sharding | Manual implementation | Not needed (Limitless) | Automatic | Automatic | Automatic |
| Read Scaling | Add Replicas | 15 Replicas | Add nodes | Add nodes | Add Replicas |
| Write Scaling | None (single Primary) | Limited | Linear | Linear | Add shards |
| Global Distribution | Multi-region Read | Global Database | Multi-region | Multi-region | Manual |
| Compatibility | MySQL / PostgreSQL | MySQL / PostgreSQL compatible | Proprietary (SQL-compliant) | PostgreSQL compatible | MySQL |
| Cost | $$ | $$$ | $$$$ | $$$ | $ (OSS) |

---

## 6. Anti-Patterns

### Anti-Pattern 1: Premature Sharding

```python
# BAD: Introducing sharding with only 10,000 users
class PrematureSharding:
    """Example of premature sharding"""
    def __init__(self):
        # 4 shards for 10,000 users
        self.shards = [
            create_engine(f'postgresql://shard{i}:5432/myapp')
            for i in range(4)
        ]

    def get_user(self, user_id: str):
        shard_id = hash(user_id) % 4
        # Problem: queries requiring JOINs become cross-shard
        # SELECT u.*, o.* FROM users u JOIN orders o ON u.id = o.user_id
        # → requires accessing 2 different shards
        pass

# Problems:
# - 4x operational cost (backup, monitoring, upgrades)
# - Complexity of cross-shard queries
# - Scale of 10,000 users is sufficient for a single DB
# - Resharding is difficult

# GOOD: Gradual scaling
class GradualScaling:
    """Correct approach: scale incrementally"""
    def __init__(self, current_load: str):
        if current_load == "low":
            # Step 1: index optimization, query tuning
            self.optimize_queries()
        elif current_load == "medium_read":
            # Step 2: distribute reads with Read Replicas
            self.add_read_replicas()
        elif current_load == "medium_write":
            # Step 3: add cache layer (Redis)
            self.add_cache_layer()
        elif current_load == "high":
            # Step 4: table partitioning
            self.add_partitioning()
        elif current_load == "extreme":
            # Step 5: sharding (only when truly necessary)
            self.implement_sharding()
```

### Anti-Pattern 2: Poor Shard Key Selection

```python
# BAD: Using creation timestamp as shard key
class BadShardKey:
    """Shard key that causes hotspots"""
    def get_shard(self, created_at: datetime) -> int:
        # Monthly sharding
        month = created_at.month
        return month % self.shard_count

    # Problems:
    # - All writes concentrate on the current month's shard
    # - Old shards receive almost no access
    # - Wasted resources

# BAD: Using auto-increment ID as shard key
class BadAutoIncrementShardKey:
    def get_shard(self, auto_id: int) -> int:
        return auto_id % self.shard_count
    # Problem: new writes always concentrate on the same shard

# GOOD: Using user ID / tenant ID as shard key
class GoodShardKey:
    """Shard key with even distribution"""
    def get_shard(self, user_id: str) -> int:
        # Even distribution with SHA-256 hash
        hash_val = int(hashlib.sha256(user_id.encode()).hexdigest(), 16)
        return hash_val % self.shard_count

    # Advantages:
    # - Access is evenly distributed
    # - Same user's data stays in the same shard (JOIN possible)
    # - UUID provides high cardinality
```

### Anti-Pattern 3: Ignoring Replication Lag

```python
# BAD: Reading from Replica immediately after writing
class BadReadAfterWrite:
    """Reading from Replica immediately after a write"""
    def update_and_read(self, user_id: str, new_name: str):
        # Write to Primary
        with self.write_session() as session:
            user = session.query(User).get(user_id)
            user.name = new_name
            session.commit()

        # Immediately read from Replica → may return old name!
        with self.read_session() as session:
            user = session.query(User).get(user_id)
            return user.name  # may return "old name"

# GOOD: Implement Read-your-writes consistency
class GoodReadAfterWrite:
    """Read from Primary immediately after writing"""
    def __init__(self):
        self._recent_writes: dict[str, float] = {}

    def update_and_read(self, user_id: str, new_name: str):
        # Write to Primary
        with self.write_session() as session:
            user = session.query(User).get(user_id)
            user.name = new_name
            session.commit()

        # Record the write
        self._recent_writes[f"user:{user_id}"] = time.time()

        # Check for recent writes when reading
        last_write = self._recent_writes.get(f"user:{user_id}", 0)
        use_primary = (time.time() - last_write) < 5.0  # within 5 seconds

        if use_primary:
            with self.write_session() as session:
                user = session.query(User).get(user_id)
                return user.name  # guaranteed to be the latest value
        else:
            with self.read_session() as session:
                user = session.query(User).get(user_id)
                return user.name
```

---

## 7. Exercises

### Exercise 1 (Basic): Designing Read/Write Splitting

Design a read/write splitting setup that meets the following requirements.

```
Requirements:
- 1 Primary, 3 Replicas
- Writes: Primary only
- Reads: normally from Replica, immediately after write from Primary
- Replica health check (exclude if replication lag >= 5 seconds)
- Connection pooling (app 20 connections → DB 50 connections)

Tasks:
1. Design the ReadWriteSplitter class (get_write_session, get_read_session)
2. Implement a mechanism to automatically exclude Replicas with lag > 5 seconds
3. Design a fallback strategy when all Replicas are unhealthy
```

**Expected Output:**

```python
# ReadWriteSplitter class implementation:
# - write_session(): returns connection to Primary
# - read_session(entity_key):
#     if there was a write for entity_key within the last 5 seconds → Primary
#     otherwise → randomly select from a healthy Replica
# - health_check(): monitor lag for each Replica, exclude unhealthy ones
# - fallback: when all Replicas are unhealthy, read from Primary (with rate limiting)
```

### Exercise 2 (Applied): Shard Key Selection

From the table structure and query patterns below, select the optimal shard key.

```sql
-- Table structure
CREATE TABLE orders (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL,
    merchant_id UUID NOT NULL,
    amount      DECIMAL(10, 2),
    status      VARCHAR(20),
    country     VARCHAR(2),
    created_at  TIMESTAMP
);

-- Primary query patterns (ordered by frequency)
-- 1. SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20;  -- 60%
-- 2. SELECT * FROM orders WHERE merchant_id = ? AND created_at >= ?;              -- 25%
-- 3. SELECT SUM(amount) FROM orders WHERE country = ? AND created_at >= ?;        -- 10%
-- 4. SELECT * FROM orders WHERE id = ?;                                           -- 5%
```

**Tasks:**
1. Evaluate each candidate key (user_id, merchant_id, country, id)
2. State the optimal shard key and reasoning
3. Design a strategy for queries that the selected key cannot handle efficiently

### Exercise 3 (Advanced): Resharding Plan

Plan an online resharding from 4 shards to 8 shards.

```
Preconditions:
- Currently 4 shards (500GB each, 2TB total)
- Shard key: user_id (SHA-256 hash % N)
- Daily writes: 100M records
- Downtime: 0 (zero downtime required)
- Data consistency: 100% guaranteed

Design items:
1. Resharding procedure (broken into phases)
2. Migration parallelism and estimated duration
3. Consistency verification method
4. Rollback plan
5. Monitoring items
```

**Expected Output:** Detailed procedure for each phase, risks and mitigations, estimated duration

---

## 8. FAQ

### Q1. What happens to transactions in sharding?

**A.** Transactions within a single shard can guarantee ACID as usual. Cross-shard transactions require 2PC (Two-Phase Commit) or the Saga pattern, but the cost in performance and complexity is high. The most important principle is to design so that "data within the same transaction is placed in the same shard." For example, shard a user's order data by user ID so that users and orders are placed in the same shard. Cross-shard aggregations are more practical when computed asynchronously using the CQRS pattern.

### Q2. How much replication lag typically occurs?

**A.** It depends on the environment and configuration. With PostgreSQL streaming replication (asynchronous), the typical lag is < 1 second; with MySQL semi-synchronous replication, < 100ms. However, during large write bursts or network delays, it can expand to several seconds or tens of seconds. Monitor using `pg_stat_replication` (PostgreSQL) or `SHOW SLAVE STATUS` (MySQL) and fire alerts when thresholds are exceeded. When Read-your-writes consistency is required immediately after a write, implement a strategy to temporarily read from Primary.

### Q3. What is the difference between partitioning and sharding?

**A.** Partitioning is a technique for logically splitting a table **within a single database server**. It is implemented using PostgreSQL's `PARTITION BY RANGE/HASH/LIST` and requires no application changes. Partition pruning accelerates queries for specific ranges. Sharding, on the other hand, is a technique for distributing data **across multiple independent database servers**. It requires routing at the application layer. Partitioning is easier to operate but is constrained by the single server (CPU/memory/storage), while sharding has no scaling limit but increases operational complexity.

### Q4. Do NewSQL databases (Spanner, CockroachDB) make traditional sharding unnecessary?

**A.** Partially yes. NewSQL automates sharding, replication, and distributed transactions, eliminating the need for shard routing at the application layer. However: (1) costs are high (Cloud Spanner is 3-5x more expensive than RDS), (2) latency is higher (overhead of distributed consensus protocols), and (3) the ecosystem is limited (ORM/tool compatibility). For fewer than 100K TPS in a single region, PostgreSQL + Read Replica is sufficient. Consider NewSQL when all three of the following are required: "global distribution + strong consistency + write scaling."

### Q5. Is connection pooling mandatory?

**A.** Yes, in production environments. PostgreSQL forks a process per connection, so with 500+ connections, memory consumption and context switching become problematic. By introducing PgBouncer (transaction mode), 1000 application connections can be multiplexed into 50 DB connections. This (1) reduces DB server load by 90%, (2) reduces connection establishment latency from 10ms to < 1ms, and (3) mitigates connection leak risks. In MySQL, ProxySQL serves an equivalent role.

### Q6. What is the backup strategy for databases?

**A.** Use the 3-2-1 rule as a baseline: 3 copies, 2 types of media, 1 offsite. Specifically: (1) **Continuous backup (PITR)** --- archive WAL logs to S3 continuously, enabling recovery to any point in time; automated in RDS. (2) **Daily full backup** --- logical backup using pg_dump / mysqldump; easy consistency verification. (3) **Backup from Replica** --- take backups from a Replica to avoid load on Primary. Conduct regular (monthly) restore tests to verify RTO (Recovery Time Objective) and RPO (Recovery Point Objective). In a sharding environment, also pay attention to the consistency of backup timing across shards.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just through theory but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work, particularly during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|---------|
| Scaling stages | Index optimization → pooling → Replica → cache → partitioning → sharding |
| Replication | Read scaling and high availability. Handling replication lag (Read-your-writes) is essential |
| Connection pooling | Multiplex connections 10-20x with PgBouncer (transaction mode) |
| Partitioning | Split large tables within a single DB. Query acceleration via pruning. Monthly auto-creation |
| Sharding | Last resort for write scaling. Shard key design determines success or failure |
| Shard key | Even access distribution + co-location of related data + high cardinality are the principles |
| Resharding | Zero downtime requires dual-write + backfill approach. Use tools like Vitess |
| Transactions | Design to avoid cross-shard operations. Use Saga pattern or CQRS if necessary |
| Monitoring | Continuously monitor replication lag, connection count, and query latency p99 |

---

## Guides to Read Next

- [Caching](./01-caching.md) --- Cache strategies to reduce DB load
- [Message Queue](./02-message-queue.md) --- Reduce DB load through asynchronous processing
- [CDN](./03-cdn.md) --- Offload read load to the edge
- [CAP Theorem](../00-fundamentals/03-cap-theorem.md) --- Theoretical foundation of distributed databases
- [Event-Driven Architecture](../02-architecture/03-event-driven.md) --- CQRS and event sourcing

---

## References

1. **Designing Data-Intensive Applications** --- Martin Kleppmann (O'Reilly, 2017) --- Theoretical foundation of replication and partitioning
2. **Database Internals** --- Alex Petrov (O'Reilly, 2019) --- Internal structure and implementation of distributed databases
3. **High Performance MySQL, 4th Edition** --- Silvia Botros & Jeremy Tinley (O'Reilly, 2021) --- Practical MySQL scaling
4. **PostgreSQL Documentation: Table Partitioning** --- https://www.postgresql.org/docs/current/ddl-partitioning.html
5. **Vitess Documentation** --- https://vitess.io/docs/ --- Official documentation for MySQL sharding middleware

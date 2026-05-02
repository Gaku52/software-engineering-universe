# Caching

> Master caching strategies that keep frequently accessed data in fast storage, reducing latency and improving throughput.

## What You Will Learn

1. Cache hierarchy (browser, CDN, application, database) and the role of each layer
2. Cache patterns (Cache-Aside, Write-Through, Write-Behind, Read-Through) — how they work and when to use each
3. Cache invalidation strategies (TTL, event-driven, versioning, tag-based) and how to maintain consistency
4. How to implement protection against cache stampedes (Thundering Herd)
5. Practical use of Redis data structures and cluster operations

---

## Prerequisites

| Topic | Description | Reference Guide |
|---------|------|-----------|
| Hash tables | How O(1) lookup works | Data Structures Basics |
| HTTP headers | Cache-Control, ETag, Last-Modified | Web Basics |
| Load balancers | Basics of traffic distribution | [Load Balancer](./00-load-balancer.md) |
| Database basics | Read/write performance characteristics of RDB/NoSQL | DB Basics |
| Distributed systems basics | Consistency models, network latency | [CAP Theorem](../00-fundamentals/03-cap-theorem.md) |

---

## Why Learn Caching?

Caching is **the most cost-effective way to dramatically improve system performance**. A well-designed caching strategy can reduce database load by over 90% and cut response times by an order of magnitude.

**Caching impact by the numbers:**
- Memory access: ~100ns vs disk I/O: ~10ms → **100,000x speed difference**
- Redis read: ~0.1ms vs MySQL read: ~5-50ms → **50-500x improvement**
- With a 95% cache hit rate, DB load is reduced to 1/20 of the original

**Real-world examples:**
- Facebook: Memcached cluster caches billions of requests per second (NSDI '13 paper)
- Twitter: Timeline cached in Redis, reducing latency from hundreds of milliseconds to a few milliseconds
- Amazon: A 100ms delay in page load causes a 1% drop in revenue (the economic value of caching-driven speed)

---

## 1. Cache Hierarchy

### Diagram 1: Multi-Layer Cache Structure

```
  Client
    │
    ▼
  ┌─────────────────┐  Hit rate: 30-50%
  │ Browser Cache   │  ← Cache-Control, ETag
  └────────┬────────┘
           │ miss
  ┌────────▼────────┐  Hit rate: 70-90%
  │ CDN (Edge)      │  ← Static files, API responses
  └────────┬────────┘
           │ miss
  ┌────────▼────────┐
  │ Load Balancer   │
  └────────┬────────┘
           │
  ┌────────▼────────┐  Hit rate: 80-99%
  │ App Cache       │  ← Redis / Memcached
  │ (in-memory)     │
  └────────┬────────┘
           │ miss
  ┌────────▼────────┐  Hit rate: 95-99%
  │ DB Query Cache  │  ← MySQL Query Cache, etc.
  └────────┬────────┘
           │ miss
  ┌────────▼────────┐
  │ Database        │  ← Disk I/O
  └─────────────────┘

  A cache hit at any layer avoids
  access to all layers below it
```

### Cumulative Effect of Multi-Layer Caching

```
For 1000 incoming requests, the number passing through each layer:

  Browser Cache (Hit 40%)  → 600 pass through
  CDN (Hit 60%)            → 240 pass through
  App Cache (Hit 90%)      → 24 pass through
  DB Query Cache (Hit 80%) → ~5 pass through

  Result: 995 out of 1000 are cache hits
  Only 0.5% (5 requests) reach the DB

  Cumulative cache hit rate calculation:
  1 - (1-0.4) × (1-0.6) × (1-0.9) × (1-0.8) = 1 - 0.0048 = 99.52%
```

---

## 2. Cache Patterns

### Diagram 2: The Four Major Patterns

```
■ Cache-Aside (Lazy Loading)
  App ──read──→ Cache ──hit──→ return
                  │miss
                  ▼
               Database ──→ write to Cache ──→ return

■ Read-Through
  App ──read──→ Cache ──hit──→ return
                  │miss
                  │ (Cache itself fetches from DB)
                  ▼
               Database ──→ auto-save to Cache ──→ return

■ Write-Through
  App ──write──→ Cache ──synchronous write──→ Database
                  │
                  └──→ return (after both complete)

■ Write-Behind (Write-Back)
  App ──write──→ Cache ──→ return (immediate response)
                  │
                  └──async──→ Database (written later in batch)
```

### Code Example 1: Cache-Aside Pattern

```python
import redis
import json
import time
import logging
from typing import Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class CacheStats:
    """Cache statistics"""
    hits: int = 0
    misses: int = 0
    errors: int = 0

    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0

    def __repr__(self):
        return (f"CacheStats(hits={self.hits}, misses={self.misses}, "
                f"hit_rate={self.hit_rate:.1%})")


class CacheAsideRepository:
    """Cache-Aside (Lazy Loading) pattern

    How it works:
    1. On read: check cache first; on miss, fetch from DB and store in cache
    2. On write: update DB, then invalidate the cache

    Pros:
    - Most versatile. The application controls cache behavior
    - Optimal for read-heavy workloads
    - Falls back to DB directly if cache fails

    Cons:
    - First access always results in a cache miss (Cold Start problem)
    - Consistency between cache and DB is not guaranteed (eventual consistency via TTL)
    """

    def __init__(self, redis_client: redis.Redis, db_client,
                 ttl: int = 300, prefix: str = ""):
        self.cache = redis_client
        self.db = db_client
        self.ttl = ttl
        self.prefix = prefix
        self.stats = CacheStats()

    def _cache_key(self, entity: str, id: str) -> str:
        """Consistent cache key naming convention"""
        return f"{self.prefix}{entity}:{id}"

    def get_user(self, user_id: str) -> Optional[dict]:
        cache_key = self._cache_key("user", user_id)

        # Step 1: Check cache
        try:
            cached = self.cache.get(cache_key)
            if cached:
                self.stats.hits += 1
                logger.debug(f"[CACHE HIT] {cache_key}")
                return json.loads(cached)
        except redis.RedisError as e:
            self.stats.errors += 1
            logger.warning(f"[CACHE ERROR] {cache_key}: {e}")
            # Fall back to DB on cache failure

        # Step 2: Cache miss → fetch from DB
        self.stats.misses += 1
        logger.debug(f"[CACHE MISS] {cache_key}")
        user = self.db.find_user(user_id)
        if user is None:
            # Negative caching: cache non-existent data with a short TTL
            # → Prevents Cache Penetration attacks
            try:
                self.cache.setex(cache_key, 60, json.dumps(None))
            except redis.RedisError:
                pass
            return None

        # Step 3: Write to cache (with TTL)
        try:
            self.cache.setex(cache_key, self.ttl, json.dumps(user))
        except redis.RedisError as e:
            logger.warning(f"[CACHE WRITE ERROR] {cache_key}: {e}")
        return user

    def update_user(self, user_id: str, data: dict):
        """On update: update DB first, then invalidate cache"""
        cache_key = self._cache_key("user", user_id)

        # Step 1: Update DB
        self.db.update_user(user_id, data)

        # Step 2: Invalidate (delete) cache
        try:
            self.cache.delete(cache_key)
            logger.info(f"[CACHE INVALIDATE] {cache_key}")
        except redis.RedisError as e:
            logger.error(f"[CACHE DELETE ERROR] {cache_key}: {e}")
            # If deletion fails, wait for TTL to naturally expire it

    def bulk_warmup(self, user_ids: list[str]):
        """Cache warmup: pre-load frequently accessed data"""
        pipe = self.cache.pipeline()
        users = self.db.find_users_batch(user_ids)
        for user in users:
            cache_key = self._cache_key("user", user["id"])
            pipe.setex(cache_key, self.ttl, json.dumps(user))
        pipe.execute()
        logger.info(f"[WARMUP] {len(users)} users pre-cached")
```

### Code Example 2: Write-Through Pattern

```python
class WriteThroughRepository:
    """Write-Through pattern: synchronously updates both cache and DB on write

    Pros:
    - High consistency between cache and DB
    - Reads always hit the cache (latest data is already cached after each write)

    Cons:
    - Increased write latency (writes to both DB and cache)
    - Data that is never read still gets written to cache (potential memory waste)
    """

    def __init__(self, redis_client: redis.Redis, db_client,
                 ttl: int = 3600):
        self.cache = redis_client
        self.db = db_client
        self.ttl = ttl

    def get_user(self, user_id: str) -> Optional[dict]:
        cache_key = f"user:{user_id}"
        cached = self.cache.get(cache_key)
        if cached:
            return json.loads(cached)

        user = self.db.find_user(user_id)
        if user:
            self.cache.setex(cache_key, self.ttl, json.dumps(user))
        return user

    def update_user(self, user_id: str, data: dict):
        """Update both DB and cache simultaneously (synchronous)"""
        cache_key = f"user:{user_id}"

        # Step 1: Update DB
        self.db.update_user(user_id, data)

        # Step 2: Update cache (overwrite, not delete)
        updated_user = self.db.find_user(user_id)
        self.cache.setex(cache_key, self.ttl, json.dumps(updated_user))
        logger.info(f"[WRITE-THROUGH] {cache_key} updated in both DB and cache")

    def create_user(self, user_data: dict) -> str:
        """Write to cache synchronously on creation as well"""
        user_id = self.db.create_user(user_data)
        cache_key = f"user:{user_id}"
        user_data["id"] = user_id
        self.cache.setex(cache_key, self.ttl, json.dumps(user_data))
        logger.info(f"[WRITE-THROUGH] {cache_key} created in both DB and cache")
        return user_id
```

### Code Example 3: Write-Behind Pattern

```python
import queue
import threading
import time

class WriteBehindRepository:
    """Write-Behind (Write-Back) pattern: writes to DB asynchronously

    Pros:
    - Minimum write latency (responds after writing to cache only)
    - Efficient DB writes through batching

    Cons:
    - Risk of data loss on cache failure (data not yet persisted to DB)
    - Complex implementation (background writer, retry, dead-letter queue)

    Use cases:
    - Access counters, page view counts
    - Frequent location updates
    - Telemetry data from IoT devices
    """

    def __init__(self, redis_client: redis.Redis, db_client,
                 flush_interval: float = 5.0, batch_size: int = 100):
        self.cache = redis_client
        self.db = db_client
        self.write_queue = queue.Queue()
        self.flush_interval = flush_interval
        self.batch_size = batch_size
        self._failed_count = 0
        self._total_flushed = 0
        self._start_background_writer()

    def update_user(self, user_id: str, data: dict):
        """Write to cache immediately, propagate to DB asynchronously"""
        cache_key = f"user:{user_id}"

        # Step 1: Write to cache immediately
        self.cache.set(cache_key, json.dumps(data))

        # Step 2: Enqueue for later batch processing
        self.write_queue.put(("update_user", user_id, data))
        logger.debug(f"[WRITE-BEHIND] {cache_key} cached, queued for DB write "
                     f"(queue size: {self.write_queue.qsize()})")

    def _start_background_writer(self):
        """Process queue in batch using a background thread"""
        def writer():
            while True:
                batch = []
                deadline = time.time() + self.flush_interval
                while len(batch) < self.batch_size and time.time() < deadline:
                    try:
                        item = self.write_queue.get(timeout=0.5)
                        batch.append(item)
                    except queue.Empty:
                        continue

                if batch:
                    self._flush_batch(batch)

        thread = threading.Thread(target=writer, daemon=True)
        thread.start()
        logger.info(f"[WRITE-BEHIND] Background writer started "
                    f"(interval={self.flush_interval}s, batch={self.batch_size})")

    def _flush_batch(self, batch: list):
        """Write batch to DB"""
        logger.info(f"[FLUSH] Writing {len(batch)} items to DB")
        success = 0
        for op, user_id, data in batch:
            try:
                self.db.update_user(user_id, data)
                success += 1
            except Exception as e:
                self._failed_count += 1
                logger.error(f"[FLUSH ERROR] Failed to write {user_id}: {e}")
                # On failure, re-enqueue for retry
                self.write_queue.put((op, user_id, data))

        self._total_flushed += success
        logger.info(f"[FLUSH] Completed: {success}/{len(batch)} "
                    f"(total: {self._total_flushed}, failed: {self._failed_count})")

    def get_stats(self) -> dict:
        return {
            "queue_size": self.write_queue.qsize(),
            "total_flushed": self._total_flushed,
            "failed_count": self._failed_count,
        }
```

---

## 3. Cache Invalidation

### Diagram 3: Cache Invalidation Strategy Flow

```
  Data update event
       │
       ├─── TTL ────────→ Expires naturally (passive)
       │                   Use when: strict consistency not required
       │
       ├─── Event-driven ─→ DB change → delete cache (active)
       │                   Use when: real-time consistency needed
       │
       ├─── Versioning ──→ Validate by version number
       │                   Use when: avoiding race conditions
       │
       └─── Tag-based ───→ Bulk-delete all keys tied to a tag
                           Use when: group invalidation of related data

  Recommendation: combine TTL (baseline) + event-driven (immediate)
```

### Code Example 4: Cache Invalidation Strategies

```python
import time
import hashlib
from typing import Optional

class CacheInvalidation:
    """Various cache invalidation strategies"""

    def __init__(self, redis_client: redis.Redis):
        self.cache = redis_client

    # 1. TTL (Time To Live)
    def set_with_ttl(self, key: str, value: str, ttl: int = 300):
        """Automatically expires after a fixed duration

        Recommended TTL by use case:
        - Session:        1800s (30 minutes)
        - User info:      300-900s (5-15 minutes)
        - Config data:    3600-86400s (1-24 hours)
        - Static data:    3600-604800s (1 hour - 7 days)
        - Search results: 60-300s (1-5 minutes)
        """
        self.cache.setex(key, ttl, value)

    # 2. Event-driven invalidation
    def on_data_changed(self, entity_type: str, entity_id: str):
        """Invalidate related caches on a data change event"""
        patterns = [
            f"{entity_type}:{entity_id}",
            f"{entity_type}:list:*",
            f"{entity_type}:count",
        ]
        pipe = self.cache.pipeline()
        for pattern in patterns:
            for key in self.cache.scan_iter(match=pattern):
                pipe.delete(key)
        deleted = pipe.execute()
        count = sum(1 for d in deleted if d)
        logger.info(f"[INVALIDATE] {entity_type}:{entity_id} "
                    f"→ {count} related caches cleared")

    # 3. Versioning
    def get_with_version(self, key: str, current_version: int) -> Optional[str]:
        """Validate cache freshness using a version number"""
        cached = self.cache.hgetall(f"v:{key}")
        if cached and int(cached.get(b"version", 0)) >= current_version:
            return cached[b"data"]
        return None  # Stale version → treat as cache miss

    def set_with_version(self, key: str, value: str, version: int):
        self.cache.hset(f"v:{key}", mapping={
            "data": value,
            "version": version
        })

    # 4. Cache tags (group invalidation)
    def set_with_tags(self, key: str, value: str, tags: list[str],
                     ttl: int = 300):
        """Attach tags to a key for bulk invalidation by tag"""
        pipe = self.cache.pipeline()
        pipe.setex(key, ttl, value)
        for tag in tags:
            pipe.sadd(f"tag:{tag}", key)
            pipe.expire(f"tag:{tag}", ttl + 3600)  # Keep tag a bit longer
        pipe.execute()

    def invalidate_tag(self, tag: str):
        """Invalidate all caches associated with a tag

        Example: tag "user:123" bulk-invalidates
        that user's profile, order list, and recommendations
        """
        keys = self.cache.smembers(f"tag:{tag}")
        if keys:
            pipe = self.cache.pipeline()
            for key in keys:
                pipe.delete(key)
            pipe.delete(f"tag:{tag}")
            pipe.execute()
            logger.info(f"[TAG INVALIDATE] {tag}: {len(keys)} keys cleared")

    # 5. CDC (Change Data Capture) integration
    def setup_cdc_invalidation(self, debezium_event: dict):
        """Automatically invalidate cache from DB change log (CDC)

        Integrates with CDC tools like Debezium to
        detect DB changes and immediately invalidate cache
        """
        table = debezium_event["source"]["table"]
        op = debezium_event["op"]  # c=create, u=update, d=delete
        entity_id = debezium_event["after"]["id"] if op != "d" \
                    else debezium_event["before"]["id"]

        if op in ("u", "d"):
            self.on_data_changed(table, str(entity_id))
            logger.info(f"[CDC] {table}:{entity_id} op={op} → cache invalidated")
```

### Code Example 5: Cache Stampede Protection

```python
import threading
import random

class ThunderingHerdProtection:
    """Cache stampede (Thundering Herd) protection

    Problem: A popular key's TTL expires → thousands of requests hit DB simultaneously
    → DB overload → cascading failure

    Three mitigation strategies:
    1. Lock: Only one request accesses DB; others wait for the lock
    2. Soft TTL: Proactively refresh in the background before hard expiry
    3. Probabilistic early recomputation: Randomly recompute before TTL expires
    """

    def __init__(self, redis_client: redis.Redis):
        self.cache = redis_client

    def get_with_lock(self, key: str, ttl: int, fetch_func,
                     lock_timeout: int = 10):
        """Strategy 1: Use a lock so only one request accesses DB"""
        # Step 1: Check cache
        cached = self.cache.get(key)
        if cached:
            return json.loads(cached)

        # Step 2: Try to acquire lock
        lock_key = f"lock:{key}"
        acquired = self.cache.set(lock_key, "1", nx=True, ex=lock_timeout)

        if acquired:
            try:
                # Step 3: Lock acquired → fetch from DB and update cache
                value = fetch_func()
                self.cache.setex(key, ttl, json.dumps(value))
                return value
            finally:
                self.cache.delete(lock_key)
        else:
            # Step 4: Lock not acquired → wait briefly and retry
            for _ in range(5):
                time.sleep(0.1)
                cached = self.cache.get(key)
                if cached:
                    return json.loads(cached)
            # Still nothing → fetch directly as fallback
            return fetch_func()

    def get_with_early_expiry(self, key: str, ttl: int,
                              soft_ttl: int, fetch_func):
        """Strategy 2: Soft TTL (proactively refresh in background before expiry)

        Example: TTL=300s, soft_ttl=240s
        → Soft expiry at 240s → return stale data while refreshing in background
        → Hard TTL at 300s causes full expiry
        """
        data = self.cache.hgetall(f"soft:{key}")
        if data:
            expires_at = float(data.get(b"expires_at", 0))
            if time.time() < expires_at:
                return json.loads(data[b"value"])
            # Soft expiry → refresh in background
            threading.Thread(
                target=self._refresh,
                args=(key, ttl, soft_ttl, fetch_func),
                daemon=True
            ).start()
            return json.loads(data[b"value"])  # Return stale data

        # Fully expired → fetch synchronously
        return self._refresh(key, ttl, soft_ttl, fetch_func)

    def _refresh(self, key, ttl, soft_ttl, fetch_func):
        value = fetch_func()
        self.cache.hset(f"soft:{key}", mapping={
            "value": json.dumps(value),
            "expires_at": str(time.time() + soft_ttl)
        })
        self.cache.expire(f"soft:{key}", ttl)
        return value

    def get_with_probabilistic_expiry(self, key: str, ttl: int,
                                       fetch_func, beta: float = 1.0):
        """Strategy 3: Probabilistic Early Recomputation

        XFetch algorithm (Vattani et al. 2015):
        Recomputation probability increases as remaining TTL decreases
        → One request naturally accesses DB without a stampede

        Decision rule: -beta * compute_time * ln(random()) > remaining_ttl
        → The shorter the remaining TTL, the more likely recomputation occurs

        beta: aggressiveness of recomputation (higher = recomputes earlier)
        """
        import math

        cached = self.cache.get(f"pxf:{key}")
        if cached:
            data = json.loads(cached)
            expiry = data["expiry"]
            remaining = expiry - time.time()
            compute_time = data.get("compute_time", 1.0)

            if remaining > 0:
                # XFetch probabilistic check (per the original paper):
                # Recompute if -beta * compute_time * ln(random()) exceeds remaining TTL
                xfetch_value = -beta * compute_time * math.log(random.random())
                if xfetch_value <= remaining:
                    return data["value"]
                # Probabilistically trigger recomputation
                logger.debug(f"[XFETCH] Probabilistic recompute for {key}")

        # Recompute
        start = time.time()
        value = fetch_func()
        compute_time = time.time() - start

        self.cache.setex(f"pxf:{key}", ttl, json.dumps({
            "value": value,
            "expiry": time.time() + ttl,
            "compute_time": compute_time,
        }))
        return value
```

---

## 4. Practical Redis Usage

### Diagram 4: Redis Data Structures and Use Cases

```
  ┌──────────────────────────────────────────────────┐
  │               Redis Data Structures               │
  ├──────────┬───────────────────────────────────────┤
  │ String   │ Sessions, simple cache, counters       │
  │ Hash     │ User profiles, configuration           │
  │ List     │ Timelines, queues                      │
  │ Set      │ Tags, unique visitors                  │
  │ SortedSet│ Rankings, rate limiting                │
  │ Stream   │ Event logs, messaging                  │
  │ HyperLogLog│ Unique counts (approximate)         │
  │ Bitmap   │ Daily active users                     │
  └──────────┴───────────────────────────────────────┘
```

### Code Example 6: Redis Data Structure Usage Patterns

```python
import redis
import json
import time
from datetime import datetime

class RedisPatterns:
    """Practical usage patterns for Redis data structures"""

    def __init__(self, client: redis.Redis):
        self.r = client

    # --- 1. Sorted Set: Real-time leaderboard ---
    def update_leaderboard(self, game_id: str, user_id: str, score: int):
        """Update leaderboard ranking (O(log N))"""
        key = f"leaderboard:{game_id}"
        self.r.zadd(key, {user_id: score})

    def get_top_players(self, game_id: str, count: int = 10) -> list:
        """Retrieve top N players (O(log N + M))"""
        key = f"leaderboard:{game_id}"
        return self.r.zrevrange(key, 0, count - 1, withscores=True)

    def get_rank(self, game_id: str, user_id: str) -> Optional[int]:
        """Get a specific user's rank (O(log N))"""
        key = f"leaderboard:{game_id}"
        rank = self.r.zrevrank(key, user_id)
        return rank + 1 if rank is not None else None

    # --- 2. Sorted Set: Sliding window rate limiting ---
    def check_rate_limit(self, user_id: str, max_requests: int = 100,
                         window_sec: int = 60) -> bool:
        """Rate limiting using a sliding window"""
        key = f"ratelimit:{user_id}"
        now = time.time()
        pipe = self.r.pipeline()

        # Remove old entries
        pipe.zremrangebyscore(key, 0, now - window_sec)
        # Add current request
        pipe.zadd(key, {f"{now}:{id(now)}": now})
        # Get request count within the window
        pipe.zcard(key)
        # Set TTL
        pipe.expire(key, window_sec)

        results = pipe.execute()
        request_count = results[2]

        if request_count > max_requests:
            return False  # Rate limit exceeded
        return True

    # --- 3. HyperLogLog: Unique visitor count ---
    def track_unique_visitor(self, page: str, visitor_id: str):
        """Approximate unique visitor count (memory efficient: ~12KB/key)"""
        today = datetime.now().strftime("%Y-%m-%d")
        key = f"uv:{page}:{today}"
        self.r.pfadd(key, visitor_id)
        self.r.expire(key, 86400 * 7)  # Retain for 7 days

    def get_unique_visitors(self, page: str, date: str) -> int:
        """Get unique visitor count (error rate ~0.81%)"""
        key = f"uv:{page}:{date}"
        return self.r.pfcount(key)

    # --- 4. Bitmap: Daily active users ---
    def mark_active(self, user_id: int):
        """Mark a user as active (1 bit/user)"""
        today = datetime.now().strftime("%Y-%m-%d")
        key = f"dau:{today}"
        self.r.setbit(key, user_id, 1)
        self.r.expire(key, 86400 * 30)  # Retain for 30 days

    def get_dau(self, date: str) -> int:
        """Get daily active user count"""
        key = f"dau:{date}"
        return self.r.bitcount(key)

    def get_retention(self, date1: str, date2: str) -> int:
        """Count users active on both days (retention analysis)"""
        result_key = f"retention:{date1}:{date2}"
        self.r.bitop("AND", result_key, f"dau:{date1}", f"dau:{date2}")
        count = self.r.bitcount(result_key)
        self.r.delete(result_key)
        return count

    # --- 5. Pub/Sub: Distributed cache invalidation notifications ---
    def publish_invalidation(self, entity_type: str, entity_id: str):
        """Broadcast cache invalidation event to all instances"""
        channel = f"cache:invalidate:{entity_type}"
        message = json.dumps({"entity_id": entity_id, "timestamp": time.time()})
        self.r.publish(channel, message)

    def subscribe_invalidation(self, entity_type: str, callback):
        """Subscribe to cache invalidation events"""
        pubsub = self.r.pubsub()
        pubsub.subscribe(f"cache:invalidate:{entity_type}")
        for message in pubsub.listen():
            if message["type"] == "message":
                data = json.loads(message["data"])
                callback(data)


# === Demo ===
r = redis.Redis(host='localhost', port=6379, db=0)
patterns = RedisPatterns(r)

# Leaderboard
patterns.update_leaderboard("game1", "alice", 1500)
patterns.update_leaderboard("game1", "bob", 2100)
patterns.update_leaderboard("game1", "charlie", 1800)
top = patterns.get_top_players("game1", 3)
print(f"Top 3: {top}")
# [(b'bob', 2100.0), (b'charlie', 1800.0), (b'alice', 1500.0)]

# Rate limiting
allowed = patterns.check_rate_limit("user:42", max_requests=5, window_sec=10)
print(f"Rate limit allowed: {allowed}")

# Unique visitors
patterns.track_unique_visitor("/home", "visitor-1")
patterns.track_unique_visitor("/home", "visitor-2")
patterns.track_unique_visitor("/home", "visitor-1")  # Duplicate
count = patterns.get_unique_visitors("/home", datetime.now().strftime("%Y-%m-%d"))
print(f"Unique visitors: {count}")  # 2
```

---

## 5. Comparison Tables

### Table 1: Cache Pattern Comparison

| Pattern | Read Performance | Write Performance | Consistency | Data Loss Risk | Implementation Complexity | Best For |
|---------|------------|------------|--------|---------------|-----------|-------------|
| Cache-Aside | High (on hit) | Medium (direct DB write) | Medium (TTL-based) | Low | Low | Read-heavy, general purpose |
| Read-Through | High | Medium | Medium | Low | Medium | Abstracted cache layer |
| Write-Through | High | Low (2 sync writes) | High | Low | Medium | Consistency-critical |
| Write-Behind | High | Highest (async) | Low | High (on failure) | High | Write-heavy |

### Table 2: Redis vs Memcached

| Feature | Redis | Memcached |
|------|-------|-----------|
| Data structures | Rich (String, Hash, List, Set, SortedSet, etc.) | String only |
| Persistence | RDB / AOF | None |
| Clustering | Redis Cluster (automatic sharding) | Client-side implementation |
| Pub/Sub | Yes | No |
| Scripting | Lua scripts | No |
| Memory efficiency | Moderate (struct overhead) | High (simple) |
| Multithreading | I/O threads in Redis 7.0+ | Multithreaded |
| Transactions | MULTI/EXEC, Lua | CAS (Check And Set) |
| Latency | ~0.1ms (single node) | ~0.1ms |
| Max value size | 512MB | 1MB (default) |
| Best for | Feature-rich cache, sessions, rankings | Simple high-speed cache |

### Table 3: Cache Invalidation Strategy Comparison

| Strategy | Immediacy | Implementation Cost | Consistency Guarantee | Scalability | Best For |
|------|--------|-----------|-----------|----------------|-------------|
| TTL | Low (wait for expiry) | Lowest | Eventual consistency | High | Most use cases |
| Event-driven | High (immediate) | Medium | Near real-time | Medium | Real-time consistency required |
| Versioning | High | Medium | Strong | High | High-contention environments |
| Tag-based | High | Medium | Group-level | Medium | Bulk invalidation of related data |
| CDC | High (detects DB change) | High | DB-driven consistency | High | Microservices, large-scale systems |

---

## 6. Anti-Patterns

### Anti-Pattern 1: Using Cache as the Only Data Source

```python
# BAD: Storing data only in cache

class CacheOnlyStore:
    """Using cache as the sole data store"""

    def __init__(self, redis_client: redis.Redis):
        self.cache = redis_client

    def save_order(self, order_id: str, data: dict):
        # Not saving to DB!
        self.cache.set(f"order:{order_id}", json.dumps(data))
        # Problems:
        # - Data lost on Redis restart
        # - LRU eviction on maxmemory → data loss
        # - Complex queries impossible (JOIN, aggregation, etc.)
        # - Backup and recovery are difficult

    def get_order(self, order_id: str) -> Optional[dict]:
        cached = self.cache.get(f"order:{order_id}")
        if not cached:
            return None  # Data may have been lost
        return json.loads(cached)


# GOOD: Cache as a fast layer; DB is the source of truth

class CacheWithDbStore:
    """Correct configuration with cache + DB"""

    def __init__(self, redis_client: redis.Redis, db_client):
        self.cache = redis_client
        self.db = db_client

    def save_order(self, order_id: str, data: dict):
        # DB is the source of truth
        self.db.save_order(order_id, data)
        # Cache is a volatile fast-access layer
        self.cache.setex(f"order:{order_id}", 3600, json.dumps(data))

    def get_order(self, order_id: str) -> Optional[dict]:
        # Cache → DB fallback
        cached = self.cache.get(f"order:{order_id}")
        if cached:
            return json.loads(cached)
        # Cache miss → fetch from DB and re-cache
        order = self.db.find_order(order_id)
        if order:
            self.cache.setex(f"order:{order_id}", 3600, json.dumps(order))
        return order
```

### Anti-Pattern 2: Indefinite Cache with No TTL

```python
# BAD: Caching without TTL

class NoTTLCache:
    def save(self, key: str, data: dict):
        self.cache.set(key, json.dumps(data))
        # Problems:
        # - Memory leak (unused data accumulates)
        # - No guarantee of data freshness
        # - Stale data persists unless manually invalidated


# GOOD: Set appropriate TTL based on use case

class ProperTTLCache:
    # TTL constants by use case
    TTL_SESSION = 1800       # 30 min: sessions
    TTL_USER_PROFILE = 300   # 5 min: user info
    TTL_CONFIG = 3600        # 1 hour: config data
    TTL_STATIC = 86400       # 1 day: static data
    TTL_SEARCH = 60          # 1 min: search results
    TTL_NEGATIVE = 60        # 1 min: negative cache

    def save(self, key: str, data: dict, ttl_category: str = "default"):
        ttl_map = {
            "session": self.TTL_SESSION,
            "user": self.TTL_USER_PROFILE,
            "config": self.TTL_CONFIG,
            "static": self.TTL_STATIC,
            "search": self.TTL_SEARCH,
            "negative": self.TTL_NEGATIVE,
            "default": 300,
        }
        ttl = ttl_map.get(ttl_category, 300)
        self.cache.setex(key, ttl, json.dumps(data))

    def save_negative(self, key: str):
        """Negative cache: short-term cache for non-existent data
        → Prevents Cache Penetration attacks"""
        self.cache.setex(key, self.TTL_NEGATIVE, json.dumps(None))
```

### Anti-Pattern 3: Poor Cache Key Design

```python
# BAD: Ambiguous cache keys

class BadCacheKeys:
    def get_data(self, user_id: str, page: int):
        # Problem 1: Key based on user_id alone → pagination doesn't work
        key = f"user:{user_id}"  # page info missing!

        # Problem 2: Including all query parameters in the key
        key = f"search:{query}&page={page}&utm_source={utm}"
        # utm_source is irrelevant to caching → unnecessary cache misses

        # Problem 3: Including entire objects in the key
        key = f"result:{json.dumps(complex_filter)}"
        # Key too long → wastes Redis memory


# GOOD: Structured cache key design

class GoodCacheKeys:
    """Cache key design rules:
    1. Prefix: entity type
    2. Identifier: entity ID
    3. Suffix: variation (page, locale, etc.)
    4. Exclude irrelevant parameters
    """

    def user_profile_key(self, user_id: str) -> str:
        return f"user:profile:{user_id}"

    def user_orders_key(self, user_id: str, page: int) -> str:
        return f"user:orders:{user_id}:p{page}"

    def search_key(self, query: str, page: int, filters: dict) -> str:
        # Normalize and hash the filters
        filter_hash = hashlib.md5(
            json.dumps(filters, sort_keys=True).encode()
        ).hexdigest()[:8]
        return f"search:{query}:p{page}:f{filter_hash}"

    def product_key(self, product_id: str, locale: str = "en") -> str:
        return f"product:{product_id}:{locale}"
```

---

## 7. Exercises

### Exercise 1 (Basic): Implement Cache-Aside Pattern with Statistics

**Task**: Use `CacheAsideRepository` to perform 100 random accesses across 10 users and measure the cache hit rate.

```python
import random

# Simple in-memory DB (for testing)
class MockDB:
    def __init__(self):
        self.users = {f"user-{i}": {"id": f"user-{i}", "name": f"User {i}"}
                     for i in range(10)}

    def find_user(self, user_id):
        return self.users.get(user_id)

# Run test
db = MockDB()
r = redis.Redis()
repo = CacheAsideRepository(r, db, ttl=60)

for _ in range(100):
    user_id = f"user-{random.randint(0, 9)}"
    repo.get_user(user_id)

print(f"Stats: {repo.stats}")
```

**Expected output**:
```
Stats: CacheStats(hits=90, misses=10, hit_rate=90.0%)
```

<details>
<summary>Reference Answer (click to expand)</summary>

```python
import random
import redis
import json

class MockDB:
    def __init__(self):
        self.users = {f"user-{i}": {"id": f"user-{i}", "name": f"User {i}"}
                     for i in range(10)}
        self.call_count = 0

    def find_user(self, user_id):
        self.call_count += 1
        return self.users.get(user_id)

db = MockDB()
r = redis.Redis()
r.flushdb()

repo = CacheAsideRepository(r, db, ttl=60, prefix="test:")

# 100 random accesses
for _ in range(100):
    user_id = f"user-{random.randint(0, 9)}"
    user = repo.get_user(user_id)
    assert user is not None

print(f"Stats: {repo.stats}")
print(f"DB call count: {db.call_count}")
# The first access for each of the 10 users is a miss; the remaining 90 are hits
# Hit rate is approximately 90%
```

**Key points:**
- With 100 accesses across 10 users, the first 10 are misses and the remaining 90 are hits
- Hit rate = 90/100 = 90%
- DB call count equals the number of cache misses (10)

</details>

### Exercise 2 (Intermediate): Compare Cache Stampede Mitigation Strategies

**Task**: Using both the lock strategy and the soft TTL strategy, compare the number of DB calls when 10 threads simultaneously encounter a cache miss.

```python
import threading
from unittest.mock import MagicMock

db_call_count = 0
lock = threading.Lock()

def slow_db_fetch():
    global db_call_count
    with lock:
        db_call_count += 1
    time.sleep(0.1)  # Simulate DB latency
    return {"data": "value"}

# Lock strategy test
r = redis.Redis()
r.flushdb()
protection = ThunderingHerdProtection(r)
db_call_count = 0

threads = []
for _ in range(10):
    t = threading.Thread(target=protection.get_with_lock,
                        args=("test-key", 60, slow_db_fetch))
    threads.append(t)
    t.start()
for t in threads:
    t.join()

print(f"Lock strategy: DB call count = {db_call_count}")
# Expected: 1-2 calls (most threads wait for the lock)
```

<details>
<summary>Reference Answer (click to expand)</summary>

```python
import threading
import time
import redis
import json

db_call_count_lock = 0
db_call_count_soft = 0
count_lock = threading.Lock()

def make_slow_fetch(counter_name):
    def slow_db_fetch():
        nonlocal db_call_count_lock, db_call_count_soft
        with count_lock:
            if counter_name == "lock":
                db_call_count_lock += 1
            else:
                db_call_count_soft += 1
        time.sleep(0.1)  # Simulate DB latency
        return {"data": "value"}
    return slow_db_fetch

r = redis.Redis()
protection = ThunderingHerdProtection(r)

# --- Test 1: Lock strategy ---
r.flushdb()
db_call_count_lock = 0
threads = []
for _ in range(10):
    t = threading.Thread(
        target=protection.get_with_lock,
        args=("test-lock", 60, make_slow_fetch("lock"))
    )
    threads.append(t)
    t.start()
for t in threads:
    t.join()
print(f"Lock strategy: DB call count = {db_call_count_lock}")
# Expected: 1-2 calls

# --- Test 2: Soft TTL strategy ---
r.flushdb()
db_call_count_soft = 0
threads = []
for _ in range(10):
    t = threading.Thread(
        target=protection.get_with_early_expiry,
        args=("test-soft", 60, 50, make_slow_fetch("soft"))
    )
    threads.append(t)
    t.start()
for t in threads:
    t.join()
print(f"Soft TTL strategy: DB call count = {db_call_count_soft}")
# Expected: All threads may storm DB on a cold start
# Soft TTL is effective for pre-expiry refresh, but weak against a full cold start
```

**Key points:**
- Lock strategy: The first thread acquires the lock and accesses DB; others wait for the lock and then read from cache. DB is called 1-2 times.
- Soft TTL strategy: On a full cold start, all threads may access DB synchronously. Soft TTL is effective for refreshing before expiry; the lock strategy is better for initial cold misses.

</details>

### Exercise 3 (Advanced): Design a Multi-Layer Cache System

**Task**: Implement a 3-layer cache (local/in-process → distributed/Redis → DB) and measure the hit rate and average latency for each layer.

```python
import time
from collections import OrderedDict

class LRUCache:
    """In-process LRU cache (local cache layer)"""

    def __init__(self, max_size: int = 100):
        self.cache = OrderedDict()
        self.max_size = max_size

    def get(self, key: str):
        if key in self.cache:
            self.cache.move_to_end(key)
            return self.cache[key]
        return None

    def set(self, key: str, value):
        self.cache[key] = value
        self.cache.move_to_end(key)
        if len(self.cache) > self.max_size:
            self.cache.popitem(last=False)


class MultiLayerCache:
    """3-layer cache: Local → Redis → DB"""

    def __init__(self, local_cache: LRUCache,
                 redis_client: redis.Redis, db_client):
        self.local = local_cache
        self.redis = redis_client
        self.db = db_client
        self.stats = {"l1_hits": 0, "l2_hits": 0, "db_hits": 0}

    def get(self, key: str):
        # Layer 1: Local cache (~0.001ms)
        value = self.local.get(key)
        if value is not None:
            self.stats["l1_hits"] += 1
            return value

        # Layer 2: Redis (~0.5ms)
        cached = self.redis.get(key)
        if cached:
            value = json.loads(cached)
            self.local.set(key, value)  # Also store in L1
            self.stats["l2_hits"] += 1
            return value

        # Layer 3: DB (~10ms)
        value = self.db.find(key)
        if value:
            self.redis.setex(key, 300, json.dumps(value))
            self.local.set(key, value)
            self.stats["db_hits"] += 1
        return value
```

<details>
<summary>Reference Answer (click to expand)</summary>

```python
import time
import json
import random
import redis
from collections import OrderedDict
from dataclasses import dataclass, field

class LRUCache:
    """In-process LRU cache (L1 layer)"""

    def __init__(self, max_size: int = 100, ttl: int = 30):
        self.cache: OrderedDict = OrderedDict()
        self.max_size = max_size
        self.ttl = ttl
        self.expiry: dict[str, float] = {}

    def get(self, key: str):
        if key in self.cache:
            # TTL check
            if time.time() > self.expiry.get(key, 0):
                del self.cache[key]
                del self.expiry[key]
                return None
            self.cache.move_to_end(key)
            return self.cache[key]
        return None

    def set(self, key: str, value):
        self.cache[key] = value
        self.expiry[key] = time.time() + self.ttl
        self.cache.move_to_end(key)
        if len(self.cache) > self.max_size:
            oldest_key, _ = self.cache.popitem(last=False)
            self.expiry.pop(oldest_key, None)


class MockDB:
    """In-memory DB for testing"""

    def __init__(self, latency: float = 0.01):
        self.data = {f"item-{i}": {"id": f"item-{i}", "value": i * 100}
                     for i in range(50)}
        self.latency = latency

    def find(self, key: str):
        time.sleep(self.latency)  # Simulate DB latency
        return self.data.get(key)


class MultiLayerCache:
    """3-layer cache: L1(Local) → L2(Redis) → L3(DB)"""

    def __init__(self, local_cache: LRUCache,
                 redis_client: redis.Redis, db_client,
                 redis_ttl: int = 300):
        self.local = local_cache
        self.redis = redis_client
        self.db = db_client
        self.redis_ttl = redis_ttl
        self.stats = {"l1_hits": 0, "l2_hits": 0, "db_hits": 0}
        self.latencies: list[float] = []

    def get(self, key: str):
        start = time.time()

        # Layer 1: Local cache
        value = self.local.get(key)
        if value is not None:
            self.stats["l1_hits"] += 1
            self.latencies.append(time.time() - start)
            return value

        # Layer 2: Redis
        try:
            cached = self.redis.get(f"ml:{key}")
            if cached:
                value = json.loads(cached)
                self.local.set(key, value)
                self.stats["l2_hits"] += 1
                self.latencies.append(time.time() - start)
                return value
        except redis.RedisError:
            pass

        # Layer 3: DB
        value = self.db.find(key)
        if value:
            try:
                self.redis.setex(f"ml:{key}", self.redis_ttl, json.dumps(value))
            except redis.RedisError:
                pass
            self.local.set(key, value)
            self.stats["db_hits"] += 1
        self.latencies.append(time.time() - start)
        return value

    def report(self) -> str:
        total = sum(self.stats.values())
        avg_latency = sum(self.latencies) / len(self.latencies) if self.latencies else 0
        lines = [
            f"Total requests: {total}",
            f"L1 hits: {self.stats['l1_hits']} "
            f"({self.stats['l1_hits']/total*100:.1f}%)" if total else "",
            f"L2 hits: {self.stats['l2_hits']} "
            f"({self.stats['l2_hits']/total*100:.1f}%)" if total else "",
            f"DB hits: {self.stats['db_hits']} "
            f"({self.stats['db_hits']/total*100:.1f}%)" if total else "",
            f"Avg latency: {avg_latency*1000:.3f}ms",
        ]
        return "\n".join(lines)


# === Run test ===
r = redis.Redis()
r.flushdb()
db = MockDB(latency=0.01)
local = LRUCache(max_size=20, ttl=30)
cache = MultiLayerCache(local, r, db, redis_ttl=300)

# 500 accesses with Zipf-like skew across 10 keys
keys = [f"item-{i}" for i in range(10)]
for _ in range(500):
    # Popular keys are accessed more frequently
    idx = min(int(random.paretovariate(1.5)), len(keys) - 1)
    cache.get(keys[idx])

print(cache.report())
```

**Key points:**
- L1 (local) typically achieves the highest hit rate (hot data within the same process)
- L2 (Redis) catches L1 misses and also serves data warmed up by other processes
- Ideally, fewer than a few percent of requests should reach the DB
- Using a Zipf-like distribution simulates realistic access patterns

</details>

---

## 8. FAQ

### Q1: What cache hit rate should I aim for?

A rate above 80% is the general target; above 90% is good; above 95% is excellent. If the hit rate is low, consider whether (1) the TTL is too short, (2) cache keys are too granular, or (3) access patterns are highly distributed (long-tail). The Pareto principle (80/20 rule) often applies — 20% of data accounts for 80% of accesses — so caching just the top-access data can yield significant improvement. Monitor hit rates with `keyspace_hits` / `keyspace_misses` from `redis-cli INFO stats`.

### Q2: What should I do when cache and DB data become inconsistent?

Common causes of inconsistency: (1) a missed cache invalidation on update, (2) race conditions (concurrent updates), (3) failed cache updates due to network failures. The recommended approach combines TTL-based "eventual self-healing" as a last resort with "active" CDC (Change Data Capture)-driven cache updates. For data where inconsistency is critical (e.g., account balances), either do not cache it or use Write-Through for synchronous updates. The simplest and most reliable solution to the dual-write problem (DB succeeds → cache update fails) is to **delete** the cache on update, so it is naturally re-cached on the next read.

### Q3: What happens when Redis runs out of memory?

Behavior is determined by the `maxmemory-policy` setting. Common options: `volatile-lru` (evict TTL-keyed entries by LRU), `allkeys-lru` (evict any key by LRU), `noeviction` (return write errors). For caching use cases, `allkeys-lru` is recommended. Monitoring memory usage and periodically cleaning up stale keys is also important. Redis Cluster allows adding nodes to expand memory. Monitor usage with `used_memory_human` from `INFO memory`.

### Q4: What is the difference between Cache Penetration and Cache Breakdown?

**Cache Penetration**: Large volumes of requests for data that does not exist. Both cache and DB miss every time, resulting in constant DB access. Mitigations: negative caching (cache null values with a short TTL) and Bloom filters (pre-filter non-existent keys). **Cache Breakdown**: A large number of requests flood in the instant a popular key's TTL expires. This is the cache stampede (Thundering Herd) problem. Mitigations: locks, soft TTL, and probabilistic early recomputation.

### Q5: When should I use local cache vs. distributed cache?

**Local cache** (Guava Cache, Caffeine, etc.): In-process memory, extremely fast (~ns). Not shared across servers, so consistency is hard to guarantee. Suitable for low-change-frequency data such as config and master data. **Distributed cache** (Redis, Memcached): Access over the network (~0.1-1ms). All servers share the same data, offering higher consistency. Suitable for sessions, user data, etc. Combining both as a multi-layer cache is the most effective approach.

### Q6: What is the difference between Redis Cluster and Redis Sentinel?

**Redis Sentinel**: A high-availability solution for master/replica configurations. Automatically promotes a replica when the master fails. Data is not distributed, so a single master's memory is the ceiling. **Redis Cluster**: Horizontal scaling through automatic sharding. Data is distributed across 16,384 slots handled by multiple master nodes, allowing data volumes beyond a single node's memory limit. A rough guideline: use Sentinel for under 10GB; use Cluster for larger amounts.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Rather than theory alone, writing actual code and observing behavior will deepen your understanding.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping straight to advanced topics. We recommend thoroughly understanding the foundational concepts covered in this guide before moving on to the next steps.

### Q3: How is this topic applied in real-world practice?

Knowledge of this topic is frequently used in day-to-day development work, particularly during code reviews and architectural design.

---

## Summary

| Item | Key Point |
|------|---------|
| Purpose of caching | Reduce latency, increase throughput, reduce DB load |
| Multi-layer caching | Browser → CDN → App Cache → DB Cache |
| Cache-Aside | Most common. Cache on read; fall back to DB on miss |
| Write-Through | Consistency-first. Synchronously update both DB and cache |
| Write-Behind | Write-performance-first. Async DB propagation (risk of data loss) |
| Invalidation strategy | Combine TTL (baseline) + event-driven (immediate) |
| Stampede protection | Three strategies: lock, soft TTL, probabilistic early recomputation |
| Redis usage | SortedSet (rankings), HyperLogLog (UV), Bitmap (DAU) |
| Key design | Structured naming: entity-type:ID:variation |

---

## Guides to Read Next

- [CDN](./03-cdn.md) -- Global delivery via edge caching
- [Message Queue](./02-message-queue.md) -- Cache updates combined with async processing
- [DB Scaling](./04-database-scaling.md) -- DB optimization used alongside caching
- [Load Balancer](./00-load-balancer.md) -- Cache placement behind a load balancer
- [Reliability](../00-fundamentals/02-reliability.md) -- Fallback strategies when cache fails

---

## References

1. Fitzpatrick, B. (2004). "Distributed Caching with Memcached." *Linux Journal*.
2. Redis Documentation -- https://redis.io/documentation
3. Nishtala, R. et al. (2013). "Scaling Memcache at Facebook." *NSDI '13*.
4. Vattani, A. et al. (2015). "Optimal and Efficient Approximate Algorithms for Probabilistic Early Expiration." *Proceedings of the VLDB Endowment*.
5. Carlson, J. (2013). *Redis in Action*. Manning Publications.

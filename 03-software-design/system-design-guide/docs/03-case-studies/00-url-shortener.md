# URL Shortener Service Design

> Design a URL shortening service like TinyURL or bit.ly from scratch. Build the skills to handle system design interviews covering hash generation, redirect optimization, and scalability.

---

## What You Will Learn

1. **Requirements and Scale Estimation** — Organizing functional and non-functional requirements, estimating traffic and storage
2. **Core Design** — Short URL generation algorithms, data models, redirect flow
3. **Scalability** — Caching strategies, database partitioning, high availability design
4. **Operations Design** — Monitoring, alerting, incident response, capacity planning
5. **Security** — Detecting malicious URLs, rate limiting, abuse prevention

---

## Prerequisites

| Topic | Required Level | Reference Guide |
|---------|-----------|-----------|
| Database Basics | RDB index design, NoSQL fundamentals | Database |
| Cache Design | Basic Redis operations, caching strategies | Cache |
| Load Balancer | L4/L7 differences, distribution algorithms | Load Balancer |
| Hash and Encoding | Base62, MD5, SHA-256 concepts | Algorithm Basics |
| Python / FastAPI | Web API development basics | Python Guide |

---

## Background

### What Is a URL Shortener?

```
Long URL:
  https://www.example.com/products/electronics/smartphones/iphone-15-pro?color=blue&storage=256gb&ref=campaign-2026-winter

Short URL:
  https://short.ly/abc123

Use cases:
  1. Sharing URLs on social media (character limits on Twitter/X)
  2. QR code optimization (shorter URLs produce smaller QR codes)
  3. Access analytics (tracking clicks, regions, devices, etc.)
  4. Branding (custom domains: yourbrand.link/event)
  5. URLs in print materials (shorter is easier to read)
```

### Why Is It a Common System Design Interview Topic?

```
A URL shortener comprehensively tests the following:

  1. Scale estimation: approximating traffic and storage
  2. Hash/encoding: selecting and designing algorithms
  3. Database design: schema, indexes, sharding
  4. Caching strategy: multi-layer cache, cache invalidation
  5. Availability design: replicas, failover
  6. Trade-off decisions: 301 vs 302, consistency vs availability

  → Simple requirements that pack in many design decisions
```

---

## 1. Requirements

### 1.1 Functional Requirements

```
=== Must Have ===
- Convert a long URL to a short URL
  Example: https://example.com/very/long/path → https://short.ly/abc123
- Redirect from the short URL to the original URL
- Allow programmatic short URL creation via API

=== Should Have ===
- Support custom aliases (e.g., short.ly/my-event)
- Set expiration dates for URLs
- View access statistics (click count, region, device)

=== Nice to Have ===
- User authentication and URL management dashboard
- Custom domain support
- Automatic QR code generation
- URL preview page (show destination before redirecting)
```

### 1.2 Non-Functional Requirements

```
=== Performance ===
- Redirect latency: P99 < 100ms
- URL creation latency: P99 < 500ms

=== Availability ===
- Redirect: 99.99% (annual downtime < 53 minutes)
- URL creation: 99.9% (annual downtime < 8.8 hours)

=== Scalability ===
- Read-heavy workload: read:write = 100:1
- Design that supports horizontal scaling

=== Security ===
- Detect and block malicious redirect targets (phishing, etc.)
- Rate limiting: 100 URLs/hour per IP
- Unpredictable short keys
```

### 1.3 Scale Estimation

```python
# === Scale Estimation Calculation ===

# Assumptions
daily_url_creation = 100_000_000    # 100 million URL creations per day
read_write_ratio = 100              # read:write = 100:1
daily_redirects = daily_url_creation * read_write_ratio  # 10 billion redirects/day
retention_years = 5                 # retain for 5 years

# QPS (Queries Per Second)
write_qps = daily_url_creation / 86400           # ≈ 1,160 QPS
write_qps_peak = write_qps * 2                   # ≈ 2,320 QPS (peak)
read_qps = daily_redirects / 86400               # ≈ 115,740 QPS
read_qps_peak = read_qps * 2                     # ≈ 231,480 QPS (peak)

# Storage
total_urls = daily_url_creation * 365 * retention_years  # 182.5B (182.5 billion)
bytes_per_record = 500                                    # URL + metadata
total_storage_tb = total_urls * bytes_per_record / (1024**4)  # ≈ 91.25 TB

# Bandwidth
avg_redirect_size_bytes = 500           # redirect response size
bandwidth_mbps = (read_qps * avg_redirect_size_bytes * 8) / (1024**2)  # ≈ 442 Mbps

# Cache (80-20 rule)
daily_unique_urls = daily_redirects * 0.2         # 20% are unique
cache_memory_gb = (daily_unique_urls * bytes_per_record) / (1024**3)  # ≈ 931 GB

print(f"""
=== Scale Estimation Results ===
Write QPS:        {write_qps:,.0f} (peak: {write_qps_peak:,.0f})
Read QPS:         {read_qps:,.0f} (peak: {read_qps_peak:,.0f})
Total URLs (5yr): {total_urls / 1e9:.1f}B ({total_urls / 1e9:.1f} billion)
Storage:          {total_storage_tb:.1f} TB
Bandwidth:        {bandwidth_mbps:.0f} Mbps
Cache Required:   {cache_memory_gb:.0f} GB
""")
```

### 1.4 Back-of-the-Envelope Calculation Framework

```
=== Estimation Template for System Design Interviews ===

Step 1: Write QPS
  {daily writes} ÷ 86,400 = average QPS
  average QPS × 2 = peak QPS

Step 2: Read QPS
  write QPS × R/W ratio

Step 3: Storage
  {daily writes} × {retention days} × {bytes per record}

Step 4: Bandwidth
  QPS × {response size}

Step 5: Cache
  Apply the 80-20 rule
  → {daily reads} × 20% × {bytes per record}

Important: Order of magnitude matters more than exact numbers
  1,160 QPS and 1,200 QPS are essentially the same.
  1,160 QPS and 11,600 QPS are completely different.
```

---

## 2. Core Design

### 2.1 High-Level Architecture

```
                    URL Shortener Overall Architecture

  ┌──────────┐
  │ Client   │
  │ (Browser/│
  │  Mobile) │
  └────┬─────┘
       │
       v
  ┌──────────┐     ┌──────────────────────────────────────────┐
  │ CDN /    │     │            Application Layer               │
  │ Edge     │     │  ┌────────────┐    ┌────────────────┐     │
  │ Cache    │ ──> │  │ Load       │ -> │ API Servers    │     │
  └──────────┘     │  │ Balancer   │    │ (Write: shorten│     │
                   │  │ (Nginx/ALB)│    │ (Read: redirect│     │
                   │  └────────────┘    └───────┬────────┘     │
                   └────────────────────────────┼──────────────┘
                                                │
                              ┌─────────────────┼─────────────────┐
                              │                 │                  │
                              v                 v                  v
                     ┌──────────┐      ┌──────────┐      ┌──────────┐
                     │ Redis    │      │ DB Master│      │ Key Gen  │
                     │ Cluster  │      │ (Write)  │      │ Service  │
                     │ (Cache)  │      └────┬─────┘      │ (KGS)   │
                     └──────────┘           │            └──────────┘
                                     ┌──────┴──────┐
                                     v             v
                               ┌──────────┐  ┌──────────┐
                               │ DB       │  │ DB       │
                               │ Replica1 │  │ Replica2 │
                               │ (Read)   │  │ (Read)   │
                               └──────────┘  └──────────┘
```

### 2.2 Short Key Generation Algorithms

```python
# === Method 1: Base62 Encoding ===
import string

CHARSET = string.digits + string.ascii_lowercase + string.ascii_uppercase
BASE = len(CHARSET)  # 62


def encode_base62(num: int) -> str:
    """Convert an integer to a Base62 string

    Encode in base 62:
    0-9 → '0'-'9'
    10-35 → 'a'-'z'
    36-61 → 'A'-'Z'
    """
    if num == 0:
        return CHARSET[0]
    result = []
    while num > 0:
        result.append(CHARSET[num % BASE])
        num //= BASE
    return ''.join(reversed(result))


def decode_base62(s: str) -> int:
    """Convert a Base62 string back to an integer"""
    num = 0
    for char in s:
        num = num * BASE + CHARSET.index(char)
    return num


# Range expressible with 7 Base62 characters
# 62^7 = 3,521,614,606,208 (approx. 3.5 trillion)
assert encode_base62(123456789) == "8M0kX"
assert decode_base62("8M0kX") == 123456789


# === Method 2: First 7 Characters of MD5 Hash ===
import hashlib


def generate_hash_key(url: str, attempt: int = 0) -> str:
    """Generate a short key from the MD5 hash of a URL

    Increment attempt on collision and retry
    """
    input_str = url if attempt == 0 else f"{url}:{attempt}"
    hash_hex = hashlib.md5(input_str.encode()).hexdigest()

    # Convert hex to integer, then Base62 encode
    hash_int = int(hash_hex[:12], 16)  # use the first 12 characters
    key = encode_base62(hash_int)
    return key[:7]  # trim to 7 characters


# Example
print(generate_hash_key("https://example.com/very/long/path"))  # => "aBcD123"


# === Method 3: Snowflake ID + Base62 ===
import time
import threading


class SnowflakeIDGenerator:
    """Distributed ID generation using Twitter Snowflake method

    64-bit ID:
    - 1 bit: sign bit (always 0)
    - 41 bits: timestamp (milliseconds) → ~69 years
    - 10 bits: machine ID (1024 machines)
    - 12 bits: sequence number (4096/ms/machine)

    Features:
    - Chronologically ordered ID generation
    - No collisions in distributed environments
    - High throughput (4.09 million IDs/sec per machine)
    """

    def __init__(self, machine_id: int):
        self._machine_id = machine_id & 0x3FF  # 10 bits
        self._sequence = 0
        self._last_timestamp = 0
        self._lock = threading.Lock()
        self._epoch = 1704067200000  # 2024-01-01 00:00:00 UTC

    def next_id(self) -> int:
        with self._lock:
            timestamp = int(time.time() * 1000) - self._epoch

            if timestamp == self._last_timestamp:
                self._sequence = (self._sequence + 1) & 0xFFF
                if self._sequence == 0:
                    # Sequence overflow within the same millisecond → wait for next ms
                    while timestamp <= self._last_timestamp:
                        timestamp = int(time.time() * 1000) - self._epoch
            else:
                self._sequence = 0

            self._last_timestamp = timestamp

            return (
                (timestamp << 22) |
                (self._machine_id << 12) |
                self._sequence
            )


# Snowflake ID → Base62 short key
generator = SnowflakeIDGenerator(machine_id=1)
snowflake_id = generator.next_id()
short_key = encode_base62(snowflake_id)[:7]
```

### 2.3 Hash vs Counter vs KGS

| Method | Mechanism | Pros | Cons | Use Case |
|------|--------|------|------|---------|
| MD5/SHA256 Hash | Hash the URL and use the first 7 characters | Same URL can map to same key | Collision handling required | When deduplication matters |
| Counter + Base62 | Convert auto-incremented integer to Base62 | No collisions, predictable length | Requires distributed counter | Simple implementations |
| Snowflake + Base62 | Convert distributed ID to Base62 | No collisions, distributed-ready | Keys tend to be 8-10 characters | Large-scale distributed systems |
| Pre-generated (KGS) | Pre-generate keys and pull from a pool | No collisions, fastest | Requires key management service | Ultra-high throughput |

### 2.4 Key Generation Service (KGS)

```python
# infrastructure/key_generation_service.py
import redis
import random
import string
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class KeyGenerationService:
    """Pre-generate short URL keys and store them in a Redis queue.

    Design:
    1. Pre-generate a large number of keys in the background
    2. Store in a Redis Set (unused key pool)
    3. API servers atomically retrieve keys with spop
    4. Automatically refill when the pool falls below a threshold

    ┌────────────┐     ┌─────────────────┐     ┌──────────┐
    │ Key        │ --> │ Redis           │ --> │ API      │
    │ Generator  │     │ unused_keys Set │     │ Server   │
    │ (Background│     │ (1M keys)       │     │ (spop)   │
    └────────────┘     └─────────────────┘     └──────────┘
    """

    UNUSED_KEY = "kgs:unused_keys"
    USED_KEY = "kgs:used_keys"
    MIN_POOL_SIZE = 100_000
    BATCH_GENERATE_SIZE = 500_000

    def __init__(
        self,
        redis_client: redis.Redis,
        key_length: int = 7,
    ):
        self._redis = redis_client
        self._key_length = key_length

    def generate_keys(self, count: int = BATCH_GENERATE_SIZE) -> int:
        """Bulk-generate keys and add them to the pool

        Returns:
            Number of keys actually added
        """
        charset = string.ascii_letters + string.digits
        generated = 0
        pipe = self._redis.pipeline()

        for _ in range(count):
            key = ''.join(random.choices(charset, k=self._key_length))
            pipe.sadd(self.UNUSED_KEY, key)
            generated += 1

            # Flush periodically to avoid large pipeline buffers
            if generated % 10_000 == 0:
                pipe.execute()
                pipe = self._redis.pipeline()

        pipe.execute()
        pool_size = self.pool_size()
        logger.info(
            f"Key generation complete: {generated} added, "
            f"pool size: {pool_size}"
        )
        return generated

    def get_key(self) -> str:
        """Atomically retrieve an unused key from the pool

        Raises:
            RuntimeError: When the key pool is exhausted
        """
        key = self._redis.spop(self.UNUSED_KEY)
        if key is None:
            raise RuntimeError(
                "Key pool exhausted! Please run generate_keys()"
            )
        # Add to the used set (for deduplication checks)
        self._redis.sadd(self.USED_KEY, key)
        return key.decode()

    def return_key(self, key: str) -> None:
        """Return a key to the pool (when URL creation fails)"""
        self._redis.srem(self.USED_KEY, key)
        self._redis.sadd(self.UNUSED_KEY, key)

    def pool_size(self) -> int:
        """Get the number of remaining unused keys"""
        return self._redis.scard(self.UNUSED_KEY)

    def ensure_pool_size(self) -> None:
        """Automatically refill the pool when it falls below the threshold"""
        current = self.pool_size()
        if current < self.MIN_POOL_SIZE:
            logger.warning(
                f"Key pool running low: {current}, starting refill"
            )
            self.generate_keys(self.BATCH_GENERATE_SIZE)

    def is_key_used(self, key: str) -> bool:
        """Check whether a key has been used (for custom alias deduplication)"""
        return self._redis.sismember(self.USED_KEY, key)
```

---

## 3. Data Model and Redirect

### 3.1 Database Schema

```sql
-- URL mapping table (main table)
CREATE TABLE url_mappings (
    id            BIGINT PRIMARY KEY AUTO_INCREMENT,
    short_key     VARCHAR(7) NOT NULL UNIQUE,
    original_url  TEXT NOT NULL,
    user_id       BIGINT NULL,
    custom_alias  BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at    TIMESTAMP NULL,
    click_count   BIGINT DEFAULT 0,
    is_active     BOOLEAN DEFAULT TRUE,

    -- Indexes
    INDEX idx_short_key (short_key),             -- lookup during redirect
    INDEX idx_user_id (user_id),                 -- list URLs by user
    INDEX idx_expires_at (expires_at),           -- expired URL cleanup
    INDEX idx_created_at (created_at)            -- newest-first listing
) ENGINE=InnoDB;

-- Access logs (for analytics, separate table/DB)
CREATE TABLE click_events (
    id            BIGINT PRIMARY KEY AUTO_INCREMENT,
    short_key     VARCHAR(7) NOT NULL,
    clicked_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address    VARCHAR(45),                    -- IPv6 compatible
    user_agent    VARCHAR(500),
    referer       VARCHAR(2048),
    country_code  CHAR(2),
    device_type   VARCHAR(20),                    -- mobile / desktop / tablet
    os            VARCHAR(50),
    browser       VARCHAR(50),

    -- Partitioned by month (for managing large volumes of data)
    INDEX idx_short_key_time (short_key, clicked_at)
) ENGINE=InnoDB
PARTITION BY RANGE (UNIX_TIMESTAMP(clicked_at)) (
    PARTITION p2026_01 VALUES LESS THAN (UNIX_TIMESTAMP('2026-02-01')),
    PARTITION p2026_02 VALUES LESS THAN (UNIX_TIMESTAMP('2026-03-01')),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- Users table (when authentication is enabled)
CREATE TABLE users (
    id            BIGINT PRIMARY KEY AUTO_INCREMENT,
    email         VARCHAR(255) NOT NULL UNIQUE,
    api_key       VARCHAR(64) NOT NULL UNIQUE,
    plan          ENUM('free', 'pro', 'enterprise') DEFAULT 'free',
    rate_limit    INT DEFAULT 100,                -- max URL creations per hour
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_api_key (api_key)
) ENGINE=InnoDB;
```

### 3.2 NoSQL Alternative (DynamoDB)

```python
# DynamoDB schema design

"""
DynamoDB Table Design (NoSQL Alternative)

Table: url_mappings
  Partition key: short_key (String)
  Attributes:
    - original_url (String)
    - user_id (String, optional)
    - created_at (Number, Unix timestamp)
    - expires_at (Number, Unix timestamp, optional)
    - click_count (Number)
    - is_active (Boolean)

  GSI: user_id-index
    Partition key: user_id
    Sort key: created_at

Advantages:
  - O(1) lookup by short_key → ultra-low latency
  - Automatic horizontal scaling (no sharding required)
  - TTL feature auto-deletes expired URLs

Disadvantages:
  - Complex queries are difficult (no SQL flexibility)
  - Cost depends on read/write capacity
"""

import boto3
from datetime import datetime, timezone, timedelta

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('url_mappings')


def create_short_url(short_key: str, original_url: str, ttl_days: int = 0):
    """Create a URL mapping"""
    item = {
        'short_key': short_key,
        'original_url': original_url,
        'created_at': int(datetime.now(timezone.utc).timestamp()),
        'click_count': 0,
        'is_active': True,
    }
    if ttl_days > 0:
        expires_at = datetime.now(timezone.utc) + timedelta(days=ttl_days)
        item['expires_at'] = int(expires_at.timestamp())
        item['ttl'] = int(expires_at.timestamp())  # DynamoDB TTL

    table.put_item(
        Item=item,
        ConditionExpression='attribute_not_exists(short_key)',  # prevent duplicates
    )


def get_original_url(short_key: str) -> str | None:
    """Retrieve the original URL from a short key"""
    response = table.get_item(
        Key={'short_key': short_key},
        ProjectionExpression='original_url, is_active, expires_at',
    )
    item = response.get('Item')
    if not item or not item.get('is_active', True):
        return None

    # Check expiration
    expires_at = item.get('expires_at')
    if expires_at and expires_at < int(datetime.now(timezone.utc).timestamp()):
        return None

    return item['original_url']


def increment_click_count(short_key: str):
    """Atomically increment the click count"""
    table.update_item(
        Key={'short_key': short_key},
        UpdateExpression='ADD click_count :inc',
        ExpressionAttributeValues={':inc': 1},
    )
```

### 3.3 Redirect Flow

```
Client                 API Server              Redis            DB
    |                          |                      |               |
    |  GET /abc123             |                      |               |
    |------------------------->|                      |               |
    |                          |                      |               |
    |                          |  GET url:abc123      |               |
    |                          |--------------------->|               |
    |                          |                      |               |
    |                    [Cache Hit]                   |               |
    |  301/302 Redirect        |                      |               |
    |<-------------------------|                      |               |
    |                          |                      |               |
    |                    [Cache Miss]                  |               |
    |                          |  SELECT original_url |               |
    |                          |  WHERE short_key=    |               |
    |                          |  'abc123'            |               |
    |                          |------------------------------------->|
    |                          |                      |               |
    |                          |  original_url        |               |
    |                          |<-------------------------------------|
    |                          |                      |               |
    |                          |  SET url:abc123      |               |
    |                          |  EX 86400            |               |
    |                          |--------------------->|               |
    |                          |                      |               |
    |  301/302 Redirect        |                      |               |
    |<-------------------------|                      |               |
    |                          |                      |               |
    |          [Async: record click event]             |               |
    |                          |---> [Message Queue]  |               |
    |                          |     → Click Logger   |               |
```

### 3.4 API Implementation

```python
# application/api/url_shortener_api.py
from fastapi import FastAPI, HTTPException, Request, Depends, Header
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, HttpUrl, Field
from typing import Optional
import redis
import databases
import logging
import asyncio
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

app = FastAPI(title="URL Shortener API")
cache = redis.Redis(host="redis-host", port=6379, db=0, decode_responses=True)
db = databases.Database("mysql://user:pass@db-host/url_shortener")

CACHE_TTL = 86400  # 24 hours
BASE_URL = "https://short.ly"


class ShortenRequest(BaseModel):
    """URL shortening request"""
    url: HttpUrl
    custom_alias: Optional[str] = Field(
        None, min_length=4, max_length=30, pattern=r'^[a-zA-Z0-9_-]+$'
    )
    expires_in_days: Optional[int] = Field(None, ge=1, le=3650)


class ShortenResponse(BaseModel):
    """URL shortening response"""
    short_url: str
    short_key: str
    original_url: str
    expires_at: Optional[str] = None


class UrlStatsResponse(BaseModel):
    """URL statistics response"""
    short_key: str
    original_url: str
    click_count: int
    created_at: str
    expires_at: Optional[str] = None


# === URL Shortening API ===

@app.post("/api/v1/shorten", response_model=ShortenResponse)
async def shorten_url(
    request: ShortenRequest,
    api_key: str = Header(..., alias="X-API-Key"),
):
    """Shorten a long URL"""
    # 1. API key authentication (simplified: handled by auth middleware in production)
    user = await authenticate_api_key(api_key)

    # 2. Rate limit check
    await check_rate_limit(user.id)

    # 3. URL safety check (phishing, etc.)
    if not await is_safe_url(str(request.url)):
        raise HTTPException(
            status_code=400,
            detail="The URL may not be safe"
        )

    # 4. Get the short key
    if request.custom_alias:
        short_key = request.custom_alias
        # Check for duplicate custom alias
        existing = await db.fetch_one(
            "SELECT id FROM url_mappings WHERE short_key = :key",
            {"key": short_key}
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Alias '{short_key}' is already in use"
            )
    else:
        kgs = KeyGenerationService(redis_client=cache)
        short_key = kgs.get_key()

    # 5. Calculate expiration
    expires_at = None
    if request.expires_in_days:
        expires_at = datetime.now(timezone.utc) + timedelta(
            days=request.expires_in_days
        )

    # 6. Save to DB
    try:
        await db.execute(
            """
            INSERT INTO url_mappings
                (short_key, original_url, user_id, custom_alias, expires_at)
            VALUES (:key, :url, :user_id, :custom, :expires)
            """,
            {
                "key": short_key,
                "url": str(request.url),
                "user_id": user.id,
                "custom": request.custom_alias is not None,
                "expires": expires_at,
            }
        )
    except Exception as e:
        # Return key to pool if DB save fails
        if not request.custom_alias:
            kgs.return_key(short_key)
        raise HTTPException(status_code=500, detail="Failed to create URL")

    # 7. Also save to cache
    cache.setex(f"url:{short_key}", CACHE_TTL, str(request.url))

    return ShortenResponse(
        short_url=f"{BASE_URL}/{short_key}",
        short_key=short_key,
        original_url=str(request.url),
        expires_at=expires_at.isoformat() if expires_at else None,
    )


# === Redirect API ===

@app.get("/{short_key}")
async def redirect(short_key: str, request: Request):
    """Redirect from a short URL to the original URL"""
    # 1. Check cache
    cached_url = cache.get(f"url:{short_key}")
    if cached_url:
        # Record click event asynchronously (does not block the redirect)
        asyncio.create_task(
            record_click_event(short_key, request)
        )
        return RedirectResponse(
            url=cached_url,
            status_code=301,  # permanent redirect
        )

    # 2. Check DB
    row = await db.fetch_one(
        """
        SELECT original_url, expires_at, is_active
        FROM url_mappings
        WHERE short_key = :key
        """,
        {"key": short_key}
    )

    if not row:
        raise HTTPException(status_code=404, detail="URL not found")

    if not row["is_active"]:
        raise HTTPException(status_code=410, detail="URL has been deactivated")

    # 3. Expiration check
    if row["expires_at"] and row["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="URL has expired")

    original_url = row["original_url"]

    # 4. Save to cache
    cache.setex(f"url:{short_key}", CACHE_TTL, original_url)

    # 5. Record click event asynchronously
    asyncio.create_task(record_click_event(short_key, request))

    return RedirectResponse(url=original_url, status_code=301)


# === Stats API ===

@app.get("/api/v1/stats/{short_key}", response_model=UrlStatsResponse)
async def get_stats(
    short_key: str,
    api_key: str = Header(..., alias="X-API-Key"),
):
    """Retrieve access statistics for a URL"""
    user = await authenticate_api_key(api_key)

    row = await db.fetch_one(
        """
        SELECT short_key, original_url, click_count, created_at, expires_at
        FROM url_mappings
        WHERE short_key = :key AND user_id = :user_id
        """,
        {"key": short_key, "user_id": user.id}
    )
    if not row:
        raise HTTPException(status_code=404, detail="URL not found")

    return UrlStatsResponse(
        short_key=row["short_key"],
        original_url=row["original_url"],
        click_count=row["click_count"],
        created_at=row["created_at"].isoformat(),
        expires_at=row["expires_at"].isoformat() if row["expires_at"] else None,
    )


# === Helper Functions ===

async def record_click_event(short_key: str, request: Request) -> None:
    """Record a click event asynchronously

    Note: In production, it is recommended to publish to a message queue
    (e.g., Kafka) and process in a separate service
    """
    try:
        await db.execute(
            """
            INSERT INTO click_events
                (short_key, ip_address, user_agent, referer)
            VALUES (:key, :ip, :ua, :referer)
            """,
            {
                "key": short_key,
                "ip": request.client.host,
                "ua": request.headers.get("User-Agent", "")[:500],
                "referer": request.headers.get("Referer", "")[:2048],
            }
        )
        # Increment the click count
        await db.execute(
            "UPDATE url_mappings SET click_count = click_count + 1 WHERE short_key = :key",
            {"key": short_key}
        )
    except Exception as e:
        # Click recording failure must not affect redirects
        logger.error(f"Failed to record click event: {short_key}, {e}")


async def is_safe_url(url: str) -> bool:
    """URL safety check (e.g., Google Safe Browsing API)"""
    # Implementation omitted: check with an external API in production
    dangerous_patterns = [
        "phishing.example.com",
        "malware.example.com",
    ]
    return not any(pattern in url for pattern in dangerous_patterns)


async def check_rate_limit(user_id: int) -> None:
    """Rate limit check"""
    key = f"rate_limit:{user_id}"
    current = cache.incr(key)
    if current == 1:
        cache.expire(key, 3600)  # 1-hour window
    if current > 100:  # 100 per hour
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Please try again in one hour."
        )


async def authenticate_api_key(api_key: str):
    """API key authentication"""
    row = await db.fetch_one(
        "SELECT id, email, plan, rate_limit FROM users WHERE api_key = :key",
        {"key": api_key}
    )
    if not row:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return row
```

---

## 4. Scalability Design

### 4.1 Caching Strategy

```
                  Read requests: 115K QPS
                         |
                         v
                  +--------------+
                  | CDN / Edge   |  ← Edge-cache the hottest URLs
                  | Cache        |    (handles 80% of requests here)
                  | (CloudFront/ |    TTL: 5 minutes (frequently accessed URLs)
                  |  Fastly)     |
                  +--------------+
                         |  Cache miss (20%)
                         v
                  +--------------+
                  | Redis        |  ← Application-level cache
                  | Cluster      |    (handles remaining 19% here)
                  | (6 nodes)    |    TTL: 24 hours
                  +--------------+
                         |  Cache miss (1%)
                         v
                  +--------------+
                  | DB Replica   |  ← Read replica
                  | (Read)       |    (final fallback)
                  +--------------+

  Effective DB access: 115,000 × 0.01 = 1,150 QPS
  → 99% reduction in DB load
```

### 4.2 Redis Cluster Design

```python
# infrastructure/cache/redis_cache.py
import redis
from redis.sentinel import Sentinel
import json
import logging

logger = logging.getLogger(__name__)


class UrlCache:
    """URL cache (Redis Cluster / Sentinel compatible)

    Design decisions:
    - Redis Cluster: horizontal distribution (16384 slots)
    - Sentinel: high availability (automatic failover on master failure)
    - TTL: 24 hours (hot URLs naturally remain in cache)
    """

    DEFAULT_TTL = 86400  # 24 hours

    def __init__(self, redis_client: redis.Redis):
        self._redis = redis_client

    def get_url(self, short_key: str) -> str | None:
        """Retrieve a URL from cache"""
        result = self._redis.get(f"url:{short_key}")
        if result:
            logger.debug(f"Cache hit: {short_key}")
            return result
        logger.debug(f"Cache miss: {short_key}")
        return None

    def set_url(
        self, short_key: str, original_url: str, ttl: int = DEFAULT_TTL
    ) -> None:
        """Store a URL in cache"""
        self._redis.setex(f"url:{short_key}", ttl, original_url)

    def delete_url(self, short_key: str) -> None:
        """Delete a URL from cache (when deactivating a URL)"""
        self._redis.delete(f"url:{short_key}")

    def get_cache_stats(self) -> dict:
        """Cache statistics"""
        info = self._redis.info("stats")
        hits = info.get("keyspace_hits", 0)
        misses = info.get("keyspace_misses", 0)
        total = hits + misses
        return {
            "hits": hits,
            "misses": misses,
            "hit_rate": f"{(hits / total * 100):.1f}%" if total > 0 else "N/A",
            "total_keys": self._redis.dbsize(),
        }
```

### 4.3 Database Sharding

```python
# infrastructure/database/shard_router.py
import hashlib


class ConsistentHashShardRouter:
    """Shard routing based on consistent hashing

    Design decisions:
    - Determine shard from the hash of short_key
    - Consistent hash ring minimizes impact when adding/removing shards
    - Virtual nodes achieve even load distribution

    ┌────────────────────────────────────────────┐
    │  Consistent Hash Ring                        │
    │                                              │
    │       Shard0-v0                              │
    │      /          \                            │
    │   Shard2-v2   Shard1-v0                      │
    │     |              |                         │
    │   Shard1-v1   Shard0-v1                      │
    │      \          /                            │
    │       Shard2-v0                              │
    │                                              │
    │  The first clockwise node from the           │
    │  short_key's hash position is the shard      │
    └────────────────────────────────────────────┘
    """

    def __init__(
        self,
        shard_configs: dict[int, str],
        virtual_nodes: int = 150,
    ):
        self._shard_configs = shard_configs
        self._virtual_nodes = virtual_nodes
        self._ring: dict[int, int] = {}
        self._sorted_keys: list[int] = []
        self._build_ring()

    def _build_ring(self) -> None:
        """Build the hash ring"""
        for shard_id in self._shard_configs:
            for i in range(self._virtual_nodes):
                key = f"shard-{shard_id}-vnode-{i}"
                hash_val = self._hash(key)
                self._ring[hash_val] = shard_id
        self._sorted_keys = sorted(self._ring.keys())

    def get_shard(self, short_key: str) -> int:
        """Determine the shard number from a short key"""
        hash_val = self._hash(short_key)
        # Binary search for the first virtual node
        for ring_key in self._sorted_keys:
            if hash_val <= ring_key:
                return self._ring[ring_key]
        # Wrap around to the start if past the end of the ring
        return self._ring[self._sorted_keys[0]]

    def get_connection_string(self, short_key: str) -> str:
        """Get the connection string for a shard"""
        shard_id = self.get_shard(short_key)
        return self._shard_configs[shard_id]

    @staticmethod
    def _hash(key: str) -> int:
        """Compute the hash value of a key"""
        return int(hashlib.md5(key.encode()).hexdigest(), 16)


# Usage example
router = ConsistentHashShardRouter(
    shard_configs={
        0: "mysql://user:pass@shard-0.db/urls",
        1: "mysql://user:pass@shard-1.db/urls",
        2: "mysql://user:pass@shard-2.db/urls",
        3: "mysql://user:pass@shard-3.db/urls",
    },
    virtual_nodes=150,
)

# Determine shard from short key
shard_id = router.get_shard("abc123")
conn_str = router.get_connection_string("abc123")
```

### 4.4 High Availability Design

```
=== Multi-AZ Deployment ===

  Region: ap-northeast-1 (Tokyo)

  AZ-a                    AZ-c                    AZ-d
  ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
  │ API Server   │        │ API Server   │        │ API Server   │
  │ × 3 instances│        │ × 3 instances│        │ × 3 instances│
  │              │        │              │        │              │
  │ Redis Master │        │ Redis Replica│        │ Redis Replica│
  │              │        │              │        │              │
  │ DB Master    │        │ DB Replica   │        │ DB Replica   │
  │              │        │              │        │              │
  │ KGS Primary  │        │              │        │ KGS Standby  │
  └──────────────┘        └──────────────┘        └──────────────┘
         ↑                       ↑                       ↑
         └───────────────────────┼───────────────────────┘
                                 │
                          [ALB / NLB]
                                 │
                          [Route 53]
                          (Health check + failover)

  Failure patterns and responses:
  1. API Server failure → ALB detects via health check, reroutes traffic
  2. Redis Master failure → Sentinel failover, promotes Replica
  3. DB Master failure → manual or automatic failover, promotes Replica
  4. Entire AZ failure → Route 53 routes to another AZ
```

---

## 5. 301 vs 302 Redirect

### 5.1 Detailed Comparison

| Aspect | 301 (Moved Permanently) | 302 (Found / Temporary) |
|------|------------------------|------------------------|
| Browser cache | Cached | Not cached |
| Server load | Low (subsequent requests skip the server) | High (every request hits the server) |
| Access statistics | Not accurate (browser caches the redirect) | Can be recorded every time |
| SEO | Link juice passes to the destination | Link juice stays on the original URL |
| Changing redirect target | Delayed due to browser cache | Takes effect immediately |
| Recommended use | When statistics are not needed and speed is the priority | When access analytics are required |

### 5.2 Decision Criteria

```python
def determine_redirect_status(url_mapping: dict) -> int:
    """Determine the redirect status code

    Decision criteria:
    1. Analytics enabled → 302 (route through server every time)
    2. Custom alias → 302 (redirect target may change)
    3. Otherwise → 301 (performance first)
    """
    if url_mapping.get('analytics_enabled'):
        return 302  # route through server every time → can collect statistics
    if url_mapping.get('custom_alias'):
        return 302  # redirect target may change
    if url_mapping.get('expires_at'):
        return 302  # has expiration → need to detect when expired
    return 301      # permanent redirect → best performance
```

---

## 6. Testing

### 6.1 API Tests

```python
# tests/test_url_shortener_api.py
import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch


class TestShortenURL:
    """Tests for the URL shortening API"""

    @pytest.fixture
    def mock_kgs(self):
        kgs = AsyncMock()
        kgs.get_key.return_value = "abc1234"
        return kgs

    @pytest.mark.asyncio
    async def test_shorten_url_success(self, client: AsyncClient, mock_kgs):
        """Can shorten a valid URL"""
        response = await client.post(
            "/api/v1/shorten",
            json={"url": "https://example.com/very/long/path"},
            headers={"X-API-Key": "valid-api-key"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "short_url" in data
        assert data["short_url"].startswith("https://short.ly/")
        assert len(data["short_key"]) == 7

    @pytest.mark.asyncio
    async def test_custom_alias(self, client: AsyncClient):
        """Can create a short URL with a custom alias"""
        response = await client.post(
            "/api/v1/shorten",
            json={
                "url": "https://example.com/event",
                "custom_alias": "my-event",
            },
            headers={"X-API-Key": "valid-api-key"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["short_key"] == "my-event"

    @pytest.mark.asyncio
    async def test_duplicate_custom_alias(self, client: AsyncClient):
        """Returns 409 error when alias already exists"""
        # First request: success
        await client.post(
            "/api/v1/shorten",
            json={
                "url": "https://example.com/1",
                "custom_alias": "duplicate",
            },
            headers={"X-API-Key": "valid-api-key"},
        )

        # Second request: 409 Conflict
        response = await client.post(
            "/api/v1/shorten",
            json={
                "url": "https://example.com/2",
                "custom_alias": "duplicate",
            },
            headers={"X-API-Key": "valid-api-key"},
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_invalid_url(self, client: AsyncClient):
        """Invalid URL returns 422 error"""
        response = await client.post(
            "/api/v1/shorten",
            json={"url": "not-a-valid-url"},
            headers={"X-API-Key": "valid-api-key"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_rate_limit(self, client: AsyncClient):
        """Exceeding the rate limit returns 429 error"""
        for _ in range(101):  # 100 + 1 times
            response = await client.post(
                "/api/v1/shorten",
                json={"url": "https://example.com/test"},
                headers={"X-API-Key": "valid-api-key"},
            )

        assert response.status_code == 429


class TestRedirect:
    """Tests for the redirect API"""

    @pytest.mark.asyncio
    async def test_redirect_success(self, client: AsyncClient):
        """Valid short URL redirects correctly"""
        # Create URL
        create_resp = await client.post(
            "/api/v1/shorten",
            json={"url": "https://example.com/target"},
            headers={"X-API-Key": "valid-api-key"},
        )
        short_key = create_resp.json()["short_key"]

        # Redirect
        response = await client.get(
            f"/{short_key}",
            follow_redirects=False,
        )
        assert response.status_code in (301, 302)
        assert response.headers["location"] == "https://example.com/target"

    @pytest.mark.asyncio
    async def test_nonexistent_key(self, client: AsyncClient):
        """Non-existent short key returns 404 error"""
        response = await client.get("/nonexistent", follow_redirects=False)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_expired_url(self, client: AsyncClient):
        """Expired URL returns 410 error"""
        # Create an expired URL directly in the DB (for testing)
        # ... omitted
        response = await client.get("/expired-key", follow_redirects=False)
        assert response.status_code == 410


class TestKeyGenerationService:
    """Tests for KGS"""

    def test_key_generation(self):
        """The specified number of keys are generated"""
        kgs = KeyGenerationService(redis_client=fake_redis)
        generated = kgs.generate_keys(count=1000)
        assert generated == 1000
        assert kgs.pool_size() >= 1000

    def test_key_retrieval_is_atomic(self):
        """The same key is never retrieved twice"""
        kgs = KeyGenerationService(redis_client=fake_redis)
        kgs.generate_keys(count=100)

        keys = set()
        for _ in range(100):
            key = kgs.get_key()
            assert key not in keys, f"Duplicate key: {key}"
            keys.add(key)

    def test_error_on_pool_exhaustion(self):
        """RuntimeError is raised when pool is empty"""
        kgs = KeyGenerationService(redis_client=fake_redis)
        # Pool is empty
        with pytest.raises(RuntimeError, match="Key pool exhausted"):
            kgs.get_key()

    def test_key_return(self):
        """Can return a key to the pool on failure"""
        kgs = KeyGenerationService(redis_client=fake_redis)
        kgs.generate_keys(count=10)
        initial_size = kgs.pool_size()

        key = kgs.get_key()
        assert kgs.pool_size() == initial_size - 1

        kgs.return_key(key)
        assert kgs.pool_size() == initial_size
```

### 6.2 Base62 Encoding Tests

```python
# tests/test_base62.py
import pytest


class TestBase62:
    """Tests for Base62 encoding"""

    def test_encode_decode_roundtrip(self):
        """encode → decode returns the original value"""
        for num in [0, 1, 61, 62, 100, 123456789, 2**40]:
            encoded = encode_base62(num)
            decoded = decode_base62(encoded)
            assert decoded == num, f"num={num}, encoded={encoded}"

    def test_key_length_validation(self):
        """7 characters cover a sufficient range"""
        # 62^7 = 3,521,614,606,208
        max_7char = 62**7 - 1
        encoded = encode_base62(max_7char)
        assert len(encoded) == 7

    def test_zero(self):
        """Encoding of 0"""
        assert encode_base62(0) == "0"

    def test_all_characters_used(self):
        """All Base62 characters (0-9, a-z, A-Z) are used"""
        chars_used = set()
        for i in range(62):
            chars_used.add(encode_base62(i))
        assert len(chars_used) == 62
```

---

## 7. Comparison Tables

### 7.1 Database Selection

| Characteristic | MySQL (RDB) | DynamoDB (NoSQL) | Cassandra |
|-----|:-----------:|:----------------:|:---------:|
| Lookup speed | Fast (index) | Very fast (hash key) | Fast |
| Horizontal scaling | Requires sharding | Automatic | Automatic |
| Schema flexibility | Fixed (ALTER required) | Flexible | Flexible |
| Transactions | Full support | Limited | Limited |
| Operational cost | Medium (self-managed) | Low (managed) | High (complex ops) |
| Best fit | Small/medium scale, SQL needed | Large scale, simple queries | Ultra-large scale, write-heavy |

### 7.2 Key Generation Methods

| Method | Speed | Collisions | Distributed | Predictability | Recommended For |
|-----|:----:|:----:|:-------:|:---------:|---------|
| Base62 counter | High | None | Difficult | High (sequential) | Small scale, single server |
| MD5 hash | Medium | Yes | Easy | Low | Same URL requires same key |
| Snowflake + Base62 | High | None | Easy | Medium | Large-scale distributed |
| KGS | Highest | None | Easy | Low | Ultra-high throughput |

### 7.3 Caching Strategy

| Layer | Technology | Hit Rate | TTL | Purpose |
|---|------|:-------:|:---:|------|
| L1: CDN Edge | CloudFront / Fastly | 80% | 5 min | Fast delivery of hot URLs |
| L2: App Cache | Redis Cluster | 19% | 24 hr | General-purpose app-level cache |
| L3: DB Replica | MySQL Replica | 1% | N/A | Fallback on cache miss |

---

## 8. Anti-Patterns

### Anti-Pattern 1: Direct DB Access for Every Request

```
WHY: URL shorteners are heavily read-biased at 100:1.
     Without caching, the DB cannot handle 115,000 QPS.

NG:
  115,000 QPS → direct DB access → DB crashes immediately

OK: Adopt a multi-layer caching strategy
  80-20 rule: 20% of URLs receive 80% of traffic
  CDN + Redis handles 99% of requests before reaching the DB
  Effective DB access: 115,000 × 0.01 = 1,150 QPS
```

### Anti-Pattern 2: Generating Short Keys Sequentially

```
WHY: Sequential keys are predictable and pose a security risk.
     All URLs can be enumerated as /1, /2, /3 ...

NG:
  Use auto_increment values directly as short keys
  → Private URLs can be guessed
  → Competitors can scrape all URLs

OK: Use random or pre-generated keys (KGS)
  → Unpredictable random 7-character keys
  → Collision checks are completed in advance by KGS
```

### Anti-Pattern 3: Synchronously Recording Access Statistics During Redirect

```
WHY: Adding DB writes to the critical path of the redirect API
     increases latency and lets DB write failures block redirects.

NG:
  @app.get("/{short_key}")
  async def redirect(short_key):
      url = await get_url(short_key)
      await db.execute("INSERT INTO click_events ...")  # synchronous write
      await db.execute("UPDATE url_mappings SET click_count += 1")  # synchronous update
      return RedirectResponse(url)
  # → redirect latency depends on DB write performance

OK: Record click events asynchronously
  @app.get("/{short_key}")
  async def redirect(short_key):
      url = await get_url(short_key)
      asyncio.create_task(record_click(short_key))  # async
      return RedirectResponse(url)
  # → redirect completes immediately; statistics are recorded in the background
```

### Anti-Pattern 4: Leaving Single Points of Failure

```
WHY: If KGS or Redis runs as a single instance,
     its failure brings down the entire service.

NG:
  [API Server] → [KGS (1 instance)] → failure! → all URL creation fails
  [API Server] → [Redis (1 instance)] → failure! → all redirects slow down

OK: Redundify each component
  KGS: Primary + Standby (automatic failover)
  Redis: Cluster (6 nodes) + Sentinel
  DB: Master + 2 Replicas (different AZs)
  API: Multiple instances + health checks
```

### Anti-Pattern 5: No URL Safety Check

```
WHY: Short URLs can be abused for phishing and malware distribution.
     Without safety checks, your service becomes a platform for attacks.

NG:
  def shorten(url):
      return create_short_url(url)  # accepts anything

OK: Multi-layer safety checks
  1. On URL creation: scan with Google Safe Browsing API
  2. Periodic scan: periodically re-check existing URLs
  3. User reporting: allow users to report malicious URLs
  4. Before redirect: offer a preview page (optional)
```

---

## 9. Exercises

### Exercise 1: Basic — Implement Base62 Encoding (30 minutes)

**Task**: Complete implementation of Base62 encoding

Requirements:
1. Implement `encode_base62(num: int) -> str` and `decode_base62(s: str) -> int`
2. Correctly handle the range from 0 to 62^7-1
3. Raise ValueError for negative numbers
4. Verify round-trip correctness using property-based testing

**Expected Output**:
```python
assert encode_base62(0) == "0"
assert encode_base62(61) == "Z"
assert encode_base62(62) == "10"
assert encode_base62(123456789) == "8M0kX"
assert decode_base62("8M0kX") == 123456789

# Round-trip test
for i in range(10000):
    assert decode_base62(encode_base62(i)) == i
```

### Exercise 2: Intermediate — Thread-Safe KGS Implementation (60 minutes)

**Task**: Implement a Key Generation Service that operates safely in a multi-threaded environment

Requirements:
1. Use Redis spop for atomic key retrieval
2. Pool size monitoring and automatic refill
3. Key return mechanism (when URL creation fails)
4. Functional test with 100 concurrent threads

**Expected Output**:
```python
# Concurrency test
import concurrent.futures

kgs = KeyGenerationService(redis_client)
kgs.generate_keys(count=1000)

all_keys = []
with concurrent.futures.ThreadPoolExecutor(max_workers=100) as executor:
    futures = [executor.submit(kgs.get_key) for _ in range(1000)]
    for future in concurrent.futures.as_completed(futures):
        all_keys.append(future.result())

# All keys are unique
assert len(set(all_keys)) == 1000
```

### Exercise 3: Advanced — Full System Design Document (90 minutes)

**Task**: Create a design document for a URL shortener including the following additional requirements

Additional requirements:
1. Multi-region support (Tokyo + Virginia)
2. Custom domain support (`yourbrand.link/event`)
3. A/B testing feature (randomly distribute redirects across multiple targets from the same short URL)
4. Abuse detection (alert when a large number of redirects occur in a short time)

Deliverables:
- High-level architecture diagram
- Data model (table design)
- API design (list of endpoints)
- Failure scenarios and responses
- Cost estimate (AWS-based)

**Expected Deliverable Structure**:
```
1. Requirements definition (functional/non-functional)
2. Architecture diagram (multi-region configuration)
3. Data model (custom domain, A/B test support)
4. API design (RESTful + Rate Limiting)
5. Failure response matrix
6. Cost estimate
```

---

## 10. FAQ

### Q1: What is the optimal length for a short key?

**A:** 6-7 characters is common. With Base62 (uppercase + lowercase letters + digits):

```
Characters and expressible range:
  5 chars: 62^5 =     916,132,832 (~916 million)
  6 chars: 62^6 =  56,800,235,584 (~56.8 billion)
  7 chars: 62^7 = 3,521,614,606,208 (~3.5 trillion)

Recommendations:
  - Assuming 182.5B URLs over 5 years → 7 characters is sufficient
  - Custom aliases allow 4-30 characters
  - Too short risks brute-force enumeration

In an interview: Answer with "7-character Base62 gives 3.5 trillion combinations.
  That's about 20x the capacity for 182.5 billion URLs over 5 years."
```

### Q2: If the same URL is shortened multiple times, should the same key be returned?

**A:** Depends on design decisions, but generally different keys are returned.

```
Option 1: Return a different key each time (recommended)
  Pros:
  - Independent access statistics per user
  - Simpler implementation (no deduplication check needed)
  - Per-user expiration settings
  Cons:
  - Multiple keys for the same URL (reduced storage efficiency)

Option 2: Return the same key (deduplication)
  Pros:
  - Better storage efficiency
  - Improved CDN cache efficiency
  Cons:
  - Requires a reverse index: original_url → short_key
  - Cannot track per-user statistics
  - Complex expiration management

In an interview:
  "bit.ly returns the same key when the same user shortens the same URL.
   Different users get different keys."
```

### Q3: How are expired URLs deleted?

**A:** Combine three strategies.

```python
# Strategy 1: Lazy Deletion (check at redirect time)
@app.get("/{short_key}")
async def redirect(short_key):
    url_data = await get_url_data(short_key)
    if url_data['expires_at'] < datetime.now():
        raise HTTPException(status_code=410, detail="URL has expired")
    return RedirectResponse(url_data['original_url'])

# Strategy 2: Background Cleanup (periodic batch)
# Cron: run daily at 3:00 AM
async def cleanup_expired_urls():
    deleted = await db.execute(
        "DELETE FROM url_mappings WHERE expires_at < NOW() LIMIT 10000"
    )
    # Also delete from Redis cache
    # ...

# Strategy 3: TTL in Cache
# Automatic expiration via Redis TTL
cache.setex(f"url:{short_key}", ttl_seconds, original_url)

# DynamoDB TTL (for NoSQL)
# Set expires_at column as TTL → auto-deleted
```

### Q4: How should I approach a URL shortener in an interview?

**A:** Use the following framework to answer in 35-40 minutes.

```
Step 1: Clarify requirements (3-5 minutes)
  - Functional: "URL shortening and redirect are must-haves. Is analytics a Must Have?"
  - Non-functional: "What scale do you expect? What is the read:write ratio?"
  - Scale estimation: approximate QPS, storage, bandwidth

Step 2: High-level design (10-15 minutes)
  - API design: POST /api/shorten, GET /:short_key
  - Architecture diagram: Client → LB → API → Cache → DB
  - Data model: url_mappings table

Step 3: Deep dive (15-20 minutes)
  Go deeper based on interviewer interest:
  - Key generation: Base62 vs Hash vs KGS
  - Caching strategy: multi-layer cache, TTL
  - DB partitioning: sharding strategy
  - Availability: replicas, failover

Step 4: Summary (3-5 minutes)
  - Explain trade-offs
  - Suggest further improvements
```

### Q5: What if the read:write ratio is reversed (write-heavy)?

**A:** Database and key generation design change.

```
Changes for write-heavy workloads:

1. DB: Write-optimized DB (Cassandra, ScyllaDB)
   - LSM-tree based, optimized for writes
   - Faster writes than MySQL's B-tree

2. Key generation: Strengthen KGS
   - Expand pool size (10 million keys or more)
   - Multiple KGS instances for parallel retrieval
   - Continuously generate keys in the background

3. Asynchronous writes:
   - URL creation request → message queue → async DB write
   - Return response immediately after queuing

4. Batch writes:
   - Buffer writes and batch INSERT
   - Trade-off between latency and throughput
```

### Q6: How do you ensure consistency across multiple regions?

**A:** Accept eventual consistency and use asynchronous replication between regions.

```
Design:
  Tokyo Region  ←── async replication ──→  Virginia Region

  1. Writes: accepted by the nearest region
  2. Replication: asynchronously propagated to other regions (delay of hundreds of ms to seconds)
  3. Reads: served from the nearest region's replica

  Potential conflicts:
  - The same custom alias is created simultaneously in different regions
  - Solution: custom aliases use a synchronous "global uniqueness check"
              random keys have an extremely low collision probability, so async is fine

  DNS routing:
  Route 53 latency-based routing directs traffic to the nearest region
```

### Q7: What does the cost estimate look like?

**A:** Rough monthly estimate based on AWS.

```
=== Monthly Cost Estimate (for 100M URLs/day) ===

API Servers:
  EC2 c6g.2xlarge × 12 instances (4 AZ × 3)
  → $12 × 0.268/hr × 730hr = $2,348/month

Load Balancer:
  ALB × 2 (internal + external)
  → $16.43 × 2 + traffic ≈ $500/month

Redis (ElastiCache):
  r6g.2xlarge × 6 nodes (Cluster)
  → $0.452/hr × 6 × 730hr = $1,980/month

RDB (Aurora MySQL):
  db.r6g.4xlarge × 3 (Master + 2 Replicas)
  → $1.12/hr × 3 × 730hr = $2,453/month
  Storage: 91TB × $0.10 = $9,100/month

CDN (CloudFront):
  10B req/day × 30 days × $0.009/10K req ≈ $2,700/month

Total: approx. $19,000/month

Cost optimization tips:
  - Reserved instances reduce costs by 30-40%
  - Use Spot instances for batch processing
  - Store click logs cost-efficiently with S3 + Athena
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the core concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world work?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Design Element | Choice | Reason |
|----------|------|------|
| Key generation | KGS (pre-generated) | No collisions, fast, distributed-ready |
| Key length | 7 characters (Base62) | 3.5 trillion combinations, sufficient for 5 years |
| Redirect | 301 (no analytics) / 302 (analytics needed) | Choose based on requirements |
| Cache | CDN + Redis Cluster | Handles read QPS, 99% reduction in DB load |
| Database | MySQL (Aurora) + sharding | Balance of reliability and scalability |
| Availability | Multi-AZ + replicas + failover | 99.99% SLA |
| Security | URL scanning + rate limiting | Abuse prevention |
| Statistics collection | Async (via message queue) | Does not affect redirect latency |

---

## Next Guides to Read

- [Chat System Design](./01-chat-system.md) — System design for real-time communication
- [Notification System Design](./02-notification-system.md) — Design for large-scale notification delivery
- [Rate Limiter Design](./03-rate-limiter.md) — Detailed design of API rate limiting
- [Search Engine Design](./04-search-engine.md) — Design of full-text search systems
- Database — Details on sharding and replication
- Cache — Systematic explanation of caching strategies
- [Event-Driven Architecture](../02-architecture/03-event-driven.md) — Design patterns for asynchronous processing

---

## References

1. **System Design Interview: An Insider's Guide** — Alex Xu (2020) — Chapter 8: Design a URL Shortener
2. **Designing Data-Intensive Applications** — Martin Kleppmann (O'Reilly, 2017) — Chapter 5-6: Replication and Partitioning
3. **Scaling Memcache at Facebook** — Nishtala, R. et al. (NSDI '13, 2013) — Design of large-scale cache systems
4. **Consistent Hashing and Random Trees** — Karger, D. et al. (STOC '97, 1997) — Theoretical foundation of consistent hashing
5. **Twitter Snowflake** — https://blog.twitter.com/engineering/en_us/a/2010/announcing-snowflake — Distributed ID generation in practice
6. **bit.ly Architecture** — https://highscalability.com/bitly-lessons-learned-building-a-distributed-system-that-han/ — Insights from production operation

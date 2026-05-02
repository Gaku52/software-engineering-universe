# Rate Limiter Design

> This guide explains the design principles, algorithms, and distributed implementation techniques for rate limiters that control request frequency to APIs and services, protecting systems from overload, abuse, and DDoS attacks. It covers implementing major algorithms such as Token Bucket and Sliding Window using Redis + Lua scripts, and building a multi-layered defense architecture.

---

## What You Will Learn

1. **Fundamentals of Rate Limiting** — Why it is needed, where to place it, HTTP 429 design, and response header standards
2. **How Major Algorithms Work and How to Compare Them** — Internal mechanics and use cases for Token Bucket, Leaky Bucket, Fixed Window, Sliding Window Log, and Sliding Window Counter
3. **Rate Limiter Implementation in Distributed Environments** — Atomic operations with Redis + Lua scripts, race condition mitigation, and failover strategies
4. **Multi-Layered Defense and Production Operations** — Responsibilities of Edge / Gateway / Application layers, monitoring, dynamic rule changes, and graceful degradation

---

## Prerequisites

Having the following knowledge before reading this guide will help you understand it more smoothly.

| Topic | Reference |
|---------|--------|
| Basic System Design Concepts | [System Design Overview](../00-fundamentals/00-system-design-overview.md) |
| Scalability Principles | [Scalability](../00-fundamentals/01-scalability.md) |
| Availability and Reliability | [Reliability](../00-fundamentals/02-reliability.md) |
| Caching Strategies | [Caching](../01-components/01-caching.md) |
| How Load Balancers Work | [Load Balancer](../01-components/00-load-balancer.md) |
| CDN Basics | [CDN](../01-components/03-cdn.md) |
| API Design Best Practices | API Design |
| Proxy Pattern | Proxy Pattern |

---

## 1. Overall Rate Limiter Design

### 1.1 Why Rate Limiters Are Needed

```
Problems solved by rate limiters:

1. Service Protection (Availability)
   - Protect backends from sudden legitimate traffic spikes (viral content, etc.)
   - Prevent cascade failures: stop overload in one service from spreading to others
   - Fair allocation of resources

2. Security
   - DDoS attack mitigation
   - Brute-force attack prevention (limit login attempts)
   - Web scraping suppression
   - Detection of API key abuse

3. Cost Management
   - Prevent excessive cloud resource consumption
   - Control costs for third-party APIs
   - Budget management for pay-as-you-go services

4. Business Rules (Business Logic)
   - Differentiate free/paid plans (API call count limits)
   - SLA implementation (guarantee request counts per contract)
   - Enforcement of fair use policies

WHY: What happens without a rate limiter?
  +-----------------+------------------------------------+
  | Scenario        | Result                             |
  +-----------------+------------------------------------+
  | Traffic spike   | Server down → affects all users    |
  | DDoS attack     | Service outage → SLA violation     |
  | Buggy client    | Infinite loop API calls → high bill|
  | Scraping        | DB load spike → degraded response  |
  | Plan overage    | Free users use paid-tier → losses  |
  +-----------------+------------------------------------+
```

### 1.2 Placement Patterns

```
Multi-layer placement of rate limiters

  Client
    |
    v
  +---------------------------------------------+
  |  Layer 1: CDN / Edge (Cloudflare, AWS WAF)   |
  |  - Coarse IP-level limits (DDoS defense)     |
  |  - Region-based restrictions                 |
  |  - Bot detection                             |
  +---------------------------------------------+
    |
    v
  +---------------------------------------------+
  |  Layer 2: API Gateway (Kong, Envoy, Nginx)   |
  |  - Limits per API Key / Client ID            |
  |  - Per-endpoint limits                       |
  |  - Per-plan limits (Free: 60/min, Pro: 1000/min)|
  +---------------------------------------------+
    |
    v
  +---------------------------------------------+
  |  Layer 3: Application (Middleware)           |
  |  - Per-user ID limits                        |
  |  - Feature-specific limits (search: 30/min, post: 10/min)|
  |  - Business rule-based limits                |
  +---------------------------------------------+
    |
    v
  +---------------------------------------------+
  |  Layer 4: Database / External Service        |
  |  - Connection pool limits                    |
  |  - Respecting external API rate limits       |
  |  - Write rate control                        |
  +---------------------------------------------+

  ★ Multi-layered defense principle: coarse limits on the outside, fine limits on the inside
  ★ Each layer operates independently; a failure in one layer does not affect the whole
```

### 1.3 Response Design

```
Standard HTTP 429 response design:

HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 30
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1707638400

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Request limit exceeded. Please retry after 30 seconds.",
    "retry_after": 30,
    "limit": 100,
    "window": "1m"
  }
}

Response header standards:
+------------------------+------------------------------------------+
| Header                 | Meaning                                  |
+------------------------+------------------------------------------+
| X-RateLimit-Limit      | Maximum number of requests in the window |
| X-RateLimit-Remaining  | Remaining requests                       |
| X-RateLimit-Reset      | Unix timestamp when the limit resets     |
| Retry-After            | Wait time before retrying (seconds)      |
+------------------------+------------------------------------------+

★ Include X-RateLimit-* headers in normal responses too
  → Clients can check their limit status proactively
  → Clients can self-throttle before hitting 429
```

### 1.4 System Architecture Diagram

```
                 Rate Limiter Architecture

  Client
    |
    v
  [Load Balancer]
    |
    v
  [Rate Limiter Middleware]
    |
    +---> [Redis Cluster] (counter/token management)
    |         |
    |    [Key: "rate:user:123:api:/orders"]
    |    [Value: {count: 45, window_start: 1707638400}]
    |
    |         +--> [Redis Sentinel] (high availability)
    |         +--> [Local Cache] (fallback)
    |
    v
  [Application Server]
    |
    v
  [Backend Services]

  +---> [Rules DB] (dynamic rule management)
  |         |
  |    [API Key: "sk_abc" → Plan: "pro" → Limit: 1000/min]
  |    [Endpoint: "/api/search" → Limit: 30/min]
  |
  +---> [Metrics Collector] (Prometheus)
  |         |
  |    [rate_limit_total{status="allowed|rejected"}]
  |    [rate_limit_remaining{key="user:123"}]
  |
  +---> [Alerting] (PagerDuty)
            |
       [Alert: "User X exceeded 10x normal usage"]
```

---

## 2. Algorithm Deep Dive

### 2.1 Token Bucket

```
Token Bucket Algorithm

  Concept:
  +--------------------------+
  |  Token Bucket            |
  |                          |   ← Tokens are refilled at a constant rate
  |  [T] [T] [T] [T] [T]   |      (e.g., refill_rate = 10 tokens/sec)
  |  [T] [T] [T]            |
  |  max_tokens = 10        |   ← Bucket capacity = burst allowance
  +-----------+--------------+
              |
        Request arrives
        → Token available: consume 1 token and process
        → No token: reject with 429

  Characteristics:
  - Burst allowance: permits sudden bursts of requests up to max_tokens
  - Steady rate control: controls long-term rate via refill_rate
  - Memory efficient: O(1) (only stores token count and last refill time)

  Parameter meanings:
  +------------------+----------------------------------------+
  | max_tokens = 100 | Allow up to 100 requests instantaneously|
  | refill_rate = 10 | Allow up to 10 requests/sec steady state|
  +------------------+----------------------------------------+

  Example timeline behavior:
  t=0.0s: tokens=100 (initial value)
  t=0.0s: 50 requests → tokens=50 (burst consumed)
  t=0.1s: refill +1 → tokens=51
  t=0.5s: refill +4 → tokens=55 (4 tokens refilled from 0.1~0.5s)
  t=1.0s: refill +5 → tokens=60
  ...
  t=10.0s: tokens=100 (reaches max, no further refill beyond cap)

  WHY Token Bucket is the most widely used:
  1. Controls both burst and steady rate
  2. Parameters are intuitive (max=burst, rate=steady)
  3. Memory efficient (O(1))
  4. Relatively simple to implement
  → Used by AWS API Gateway, Stripe, GitHub API
```

```python
# Code Example 1: Token Bucket Implementation (Redis + Lua Script)
import redis
import time
from typing import NamedTuple

class RateLimitResult(NamedTuple):
    """Result of a rate limit decision"""
    allowed: bool
    remaining: int
    reset_at: float
    limit: int

class TokenBucketLimiter:
    """
    Token Bucket rate limiter.

    WHY use Lua Script:
    1. Atomic operation: executes multiple Redis commands in a single round trip
    2. Prevents race conditions: accurate even with concurrent access from multiple servers
    3. Performance: minimizes network round trips

    WHY use Redis Hash:
    1. Manages tokens and last_refill under a single key → can be updated atomically
    2. TTL enables automatic cleanup → prevents memory leaks
    """

    LUA_SCRIPT = """
    local key = KEYS[1]
    local max_tokens = tonumber(ARGV[1])
    local refill_rate = tonumber(ARGV[2])   -- tokens per second
    local now = tonumber(ARGV[3])

    -- Get current state
    local data = redis.call('HMGET', key, 'tokens', 'last_refill')
    local tokens = tonumber(data[1]) or max_tokens
    local last_refill = tonumber(data[2]) or now

    -- Refill tokens (proportional to elapsed time)
    local elapsed = math.max(0, now - last_refill)
    local new_tokens = math.min(max_tokens, tokens + elapsed * refill_rate)

    if new_tokens >= 1 then
        -- Consume token: allow
        new_tokens = new_tokens - 1
        redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
        redis.call('EXPIRE', key, math.ceil(max_tokens / refill_rate) * 2)
        return {1, math.floor(new_tokens), 0}   -- {allowed, remaining tokens, wait time}
    else
        -- Insufficient tokens: reject
        local wait_time = (1 - new_tokens) / refill_rate
        return {0, 0, math.ceil(wait_time)}      -- {rejected, remaining 0, wait time (sec)}
    end
    """

    def __init__(self, redis_client: redis.Redis,
                 max_tokens: int = 100,
                 refill_rate: float = 10.0):
        """
        Args:
            redis_client: Redis client
            max_tokens: Bucket capacity (burst allowance)
            refill_rate: Refill rate (tokens/sec)
        """
        self._redis = redis_client
        self._max_tokens = max_tokens
        self._refill_rate = refill_rate
        self._script = self._redis.register_script(self.LUA_SCRIPT)

    def allow_request(self, key: str) -> RateLimitResult:
        """
        Determine whether to allow a request.

        Args:
            key: Rate limit key (e.g., "user:123:/api/orders")

        Returns:
            RateLimitResult: Decision result
        """
        now = time.time()
        result = self._script(
            keys=[f"ratelimit:tb:{key}"],
            args=[self._max_tokens, self._refill_rate, now]
        )
        allowed = bool(result[0])
        remaining = int(result[1])
        retry_after = float(result[2])

        return RateLimitResult(
            allowed=allowed,
            remaining=remaining,
            reset_at=now + retry_after if not allowed else 0,
            limit=self._max_tokens,
        )

# Usage example
limiter = TokenBucketLimiter(
    redis.Redis(host='localhost'),
    max_tokens=100,    # Burst: up to 100 requests
    refill_rate=10,    # Steady: 10 req/sec
)

result = limiter.allow_request("user:123:/api/orders")
if not result.allowed:
    return Response(
        content='{"error":"Rate limit exceeded"}',
        status_code=429,
        headers={
            "Retry-After": str(int(result.reset_at - time.time())),
            "X-RateLimit-Limit": str(result.limit),
            "X-RateLimit-Remaining": "0",
        },
    )
```

### 2.2 Sliding Window Log

```
Sliding Window Log Algorithm

  Concept:
  Records the timestamp of each request in a log (Sorted Set)
  and counts the number of requests within the window.

  Timeline:
  |----window (60s)----|
  |                    |
  t-60s              t (now)
  [req1][req2]...[reqN]
  ← Count requests in this range

  Old requests outside the window are removed:
  [old1][old2]|[req1][req2]...[reqN]|
  ← Removed    ← Within count range  ← now

  Characteristics:
  - Accuracy: Highest (stores exact timestamp of each request)
  - Memory: O(N) (proportional to number of requests in window)
  - Use case: Situations requiring accurate counting, such as billing APIs

  WHY use Sorted Set:
  - ZREMRANGEBYSCORE: Efficiently removes out-of-window entries in O(log N + M)
  - ZCARD: Gets count in O(1)
  - Redis atomic operations prevent race conditions
```

```python
# Code Example 2: Sliding Window Log Implementation
class SlidingWindowLogLimiter:
    """
    Sliding Window Log rate limiter.

    Provides rate limiting with an accurate time window.
    Records the timestamp of each request in a Redis Sorted Set
    and counts the number of requests within the window.

    Trade-offs:
    - Pros: Most accurate count, no boundary problem of Fixed Window
    - Cons: O(N) memory usage, high cost under heavy traffic
    """

    LUA_SCRIPT = """
    local key = KEYS[1]
    local max_requests = tonumber(ARGV[1])
    local window_size = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local request_id = ARGV[4]

    -- Remove old entries outside the window
    redis.call('ZREMRANGEBYSCORE', key, 0, now - window_size)

    -- Current count
    local count = redis.call('ZCARD', key)

    if count < max_requests then
        -- Record request (member must be unique)
        redis.call('ZADD', key, now, request_id)
        redis.call('EXPIRE', key, window_size + 1)
        return {1, max_requests - count - 1}   -- allowed, remaining
    else
        -- Limit exceeded: get oldest request time to calculate wait time
        local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
        local retry_after = 0
        if #oldest > 0 then
            retry_after = math.ceil(tonumber(oldest[2]) + window_size - now)
        end
        return {0, 0, retry_after}             -- rejected, remaining 0, wait time
    end
    """

    def __init__(self, redis_client, max_requests: int = 100,
                 window_seconds: int = 60):
        self._redis = redis_client
        self._max = max_requests
        self._window = window_seconds
        self._script = self._redis.register_script(self.LUA_SCRIPT)

    def allow_request(self, key: str) -> RateLimitResult:
        now = time.time()
        request_id = f"{now}:{id(self)}:{hash(key)}"

        result = self._script(
            keys=[f"ratelimit:sw:{key}"],
            args=[self._max, self._window, now, request_id]
        )

        allowed = bool(result[0])
        remaining = int(result[1])
        retry_after = float(result[2]) if len(result) > 2 else 0

        return RateLimitResult(
            allowed=allowed,
            remaining=remaining,
            reset_at=now + retry_after if not allowed else 0,
            limit=self._max,
        )
```

### 2.3 Fixed Window Counter

```
Fixed Window Counter Algorithm

  Concept:
  Divides time into fixed windows and manages the count within each window.

  |--- Window 1 (10:00-10:01) ---|--- Window 2 (10:01-10:02) ---|
  |  [req][req][req]...[req]     |  [req][req]...               |
  |  count = 95                  |  count = 12                  |
  |  limit = 100                 |  limit = 100                 |

  Boundary problem (WHY Fixed Window has low accuracy):
  |--- Window 1 ---|--- Window 2 ---|
  |         [90req]|[90req]         |
  |    last 30s    | first 30s     |
  → The 60-second window has a 100-request limit, but
    180 requests pass through in 30 seconds (crossing the boundary)

  Characteristics:
  - Accuracy: Low (has boundary problem)
  - Memory: O(1) (counter only)
  - Speed: Fastest (INCR only)
  - Use case: Situations where speed matters more than accuracy, such as DDoS defense
```

```python
# Code Example 3: Fixed Window Counter (Simplest)
class FixedWindowLimiter:
    """
    Fixed Window Counter rate limiter.

    The simplest implementation. Achieved with Redis INCR + EXPIRE.
    Has a boundary problem, so not suitable for situations requiring accuracy.

    WHY it is still used:
    1. Simplest implementation (no Lua Script needed)
    2. Best memory efficiency (O(1))
    3. Fastest processing speed
    4. Ideal for cases where "rough limiting is sufficient" such as DDoS defense
    """

    def __init__(self, redis_client, max_requests: int = 100,
                 window_seconds: int = 60):
        self._redis = redis_client
        self._max = max_requests
        self._window = window_seconds

    def allow_request(self, key: str) -> RateLimitResult:
        """
        Determine request with Fixed Window.

        Key design: ratelimit:fw:{key}:{window_id}
        window_id = int(now / window_seconds)
        → A new key is used when the window changes
        → Old keys are automatically deleted by EXPIRE
        """
        now = time.time()
        window_id = int(now) // self._window
        window_key = f"ratelimit:fw:{key}:{window_id}"

        pipe = self._redis.pipeline()
        pipe.incr(window_key)
        pipe.expire(window_key, self._window + 1)  # +1 second margin
        count, _ = pipe.execute()

        allowed = count <= self._max
        remaining = max(0, self._max - count)
        reset_at = (window_id + 1) * self._window

        return RateLimitResult(
            allowed=allowed,
            remaining=remaining,
            reset_at=reset_at,
            limit=self._max,
        )
```

### 2.4 Sliding Window Counter (Hybrid)

```
Sliding Window Counter Algorithm

  Concept:
  A hybrid algorithm that combines the simplicity of Fixed Window
  with the accuracy of Sliding Window.

  Uses a weighted average of the previous window and current window counts.

  |--- Previous Window ---|--- Current Window ---|
  |  count_prev = 80      |  count_curr = 30     |
  |                       |      ^(now, 40% elapsed)|
  |                       |                       |

  Estimated count = count_prev * (1 - elapsed_ratio) + count_curr
                  = 80 * 0.6 + 30
                  = 48 + 30 = 78

  Accuracy: Significantly better than Fixed Window, close to Sliding Window Log
  Memory: O(1) (only two counters: previous window and current window)
  → Best balance of accuracy and memory efficiency
```

```python
# Code Example 4: Sliding Window Counter Implementation
class SlidingWindowCounterLimiter:
    """
    Sliding Window Counter (hybrid method).

    Combines O(1) memory efficiency of Fixed Window
    with the accuracy of Sliding Window.

    Formula:
    estimated_count = prev_window_count * overlap_ratio + current_window_count
    overlap_ratio = 1 - (current_time - current_window_start) / window_size
    """

    LUA_SCRIPT = """
    local curr_key = KEYS[1]
    local prev_key = KEYS[2]
    local max_requests = tonumber(ARGV[1])
    local window_size = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])

    -- Get counts for current and previous windows
    local curr_count = tonumber(redis.call('GET', curr_key) or '0')
    local prev_count = tonumber(redis.call('GET', prev_key) or '0')

    -- Elapsed ratio within the current window
    local window_start = math.floor(now / window_size) * window_size
    local elapsed_ratio = (now - window_start) / window_size

    -- Sliding window estimated count
    local estimated = prev_count * (1 - elapsed_ratio) + curr_count

    if estimated < max_requests then
        -- Allow: increment the current window count
        redis.call('INCR', curr_key)
        redis.call('EXPIRE', curr_key, window_size * 2)
        return {1, math.floor(max_requests - estimated - 1)}
    else
        return {0, 0}
    end
    """

    def __init__(self, redis_client, max_requests: int = 100,
                 window_seconds: int = 60):
        self._redis = redis_client
        self._max = max_requests
        self._window = window_seconds
        self._script = self._redis.register_script(self.LUA_SCRIPT)

    def allow_request(self, key: str) -> RateLimitResult:
        now = time.time()
        curr_window = int(now) // self._window
        prev_window = curr_window - 1

        curr_key = f"ratelimit:swc:{key}:{curr_window}"
        prev_key = f"ratelimit:swc:{key}:{prev_window}"

        result = self._script(
            keys=[curr_key, prev_key],
            args=[self._max, self._window, now]
        )

        allowed = bool(result[0])
        remaining = int(result[1])

        return RateLimitResult(
            allowed=allowed,
            remaining=remaining,
            reset_at=(curr_window + 1) * self._window if not allowed else 0,
            limit=self._max,
        )
```

### 2.5 Leaky Bucket

```
Leaky Bucket Algorithm

  Concept:
  A bucket that leaks water at a constant rate.
  Requests enter the bucket and are processed at a constant rate.

  +------------------+
  |  Input (requests)|   ← Requests enter the bucket
  +------------------+
  |                  |
  |  [req3]          |   ← Bucket (queue)
  |  [req2]          |      capacity = burst_size
  |  [req1]          |
  +-------+----------+
          |
          v (constant rate)  ← Processed at leak_rate (e.g., 10 req/sec)
       [Process]

  Bucket full → New requests are dropped (429)

  Difference from Token Bucket:
  +-------------------+--------------------+---------------------+
  | Characteristic    | Token Bucket       | Leaky Bucket        |
  +-------------------+--------------------+---------------------+
  | Burst             | Allowed (max_tokens)| Not allowed (smoothed)|
  | Output rate       | Variable (burst)   | Constant (leak_rate) |
  | Memory            | O(1)               | O(N) (queue)        |
  | Use case          | API Gateway        | Streaming            |
  +-------------------+--------------------+---------------------+

  Cases where to choose Leaky Bucket:
  - Streaming processing: requires uniform rate
  - Network traffic: want to smooth out bursts
  - Batch processing: want uniform load on downstream services
```

```python
# Code Example 5: Leaky Bucket Implementation
class LeakyBucketLimiter:
    """
    Leaky Bucket rate limiter.

    Processes requests at a uniform rate.
    Smooths out bursts and provides uniform load on downstream services.
    """

    LUA_SCRIPT = """
    local key = KEYS[1]
    local burst_size = tonumber(ARGV[1])   -- bucket capacity
    local leak_rate = tonumber(ARGV[2])     -- processing rate (req/sec)
    local now = tonumber(ARGV[3])

    local data = redis.call('HMGET', key, 'water_level', 'last_leak')
    local water_level = tonumber(data[1]) or 0
    local last_leak = tonumber(data[2]) or now

    -- Calculate leaked water (decrease by elapsed time)
    local elapsed = math.max(0, now - last_leak)
    local leaked = elapsed * leak_rate
    water_level = math.max(0, water_level - leaked)

    if water_level < burst_size then
        -- Bucket has space: accept request
        water_level = water_level + 1
        redis.call('HMSET', key, 'water_level', water_level, 'last_leak', now)
        redis.call('EXPIRE', key, math.ceil(burst_size / leak_rate) * 2)
        return {1, math.floor(burst_size - water_level)}
    else
        -- Bucket full: reject
        local wait_time = (water_level - burst_size + 1) / leak_rate
        return {0, 0, math.ceil(wait_time)}
    end
    """

    def __init__(self, redis_client, burst_size: int = 10,
                 leak_rate: float = 1.0):
        self._redis = redis_client
        self._burst_size = burst_size
        self._leak_rate = leak_rate
        self._script = self._redis.register_script(self.LUA_SCRIPT)

    def allow_request(self, key: str) -> RateLimitResult:
        now = time.time()
        result = self._script(
            keys=[f"ratelimit:lb:{key}"],
            args=[self._burst_size, self._leak_rate, now]
        )

        allowed = bool(result[0])
        remaining = int(result[1])
        retry_after = float(result[2]) if len(result) > 2 else 0

        return RateLimitResult(
            allowed=allowed,
            remaining=remaining,
            reset_at=now + retry_after if not allowed else 0,
            limit=self._burst_size,
        )
```

---

## 3. FastAPI / Flask Middleware Integration

### 3.1 FastAPI Middleware

```python
# Code Example 6: Integration as FastAPI Middleware
from fastapi import FastAPI, Request, Response, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
import json
import time

app = FastAPI()

class RateLimitConfig:
    """Rate limit configuration per endpoint"""

    # Default configuration
    DEFAULT = {"max_requests": 100, "window_seconds": 60}

    # Per-endpoint configuration
    ENDPOINT_RULES = {
        "/api/v1/search": {"max_requests": 30, "window_seconds": 60},
        "/api/v1/login": {"max_requests": 5, "window_seconds": 300},
        "/api/v1/signup": {"max_requests": 3, "window_seconds": 3600},
        "/api/v1/health": None,  # None = no limit
    }

    # Per-plan configuration
    PLAN_RULES = {
        "free": {"multiplier": 1.0},
        "starter": {"multiplier": 5.0},
        "pro": {"multiplier": 20.0},
        "enterprise": {"multiplier": 100.0},
    }

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    FastAPI rate limiting middleware.

    Key construction:
    1. If API Key is present: API Key + endpoint
    2. Authenticated user: User ID + endpoint
    3. Unauthenticated: IP address + endpoint

    Response headers:
    - Always attach X-RateLimit-* headers
    - Also attach Retry-After for 429 responses
    """

    def __init__(self, app, limiter: TokenBucketLimiter,
                 config: RateLimitConfig = None):
        super().__init__(app)
        self.limiter = limiter
        self.config = config or RateLimitConfig()

    async def dispatch(self, request: Request, call_next):
        # Excluded paths such as health checks
        endpoint = request.url.path
        endpoint_rule = self.config.ENDPOINT_RULES.get(endpoint)
        if endpoint_rule is None and endpoint in self.config.ENDPOINT_RULES:
            # Explicitly set to None = no limit
            return await call_next(request)

        # Build rate limit key
        client_id = self._extract_client_id(request)
        key = f"{client_id}:{endpoint}"

        # Evaluate
        result = self.limiter.allow_request(key)

        if not result.allowed:
            retry_after = max(1, int(result.reset_at - time.time()))
            return Response(
                content=json.dumps({
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": f"Request limit exceeded. Please retry after {retry_after} seconds.",
                        "retry_after": retry_after,
                    }
                }),
                status_code=429,
                headers={
                    "Content-Type": "application/json",
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(result.limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(result.reset_at)),
                },
            )

        # Attach headers to normal responses as well
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(result.limit)
        response.headers["X-RateLimit-Remaining"] = str(result.remaining)
        return response

    def _extract_client_id(self, request: Request) -> str:
        """Extract client identifier from request"""
        # Priority: API Key > User ID > IP
        api_key = request.headers.get("X-API-Key")
        if api_key:
            return f"apikey:{api_key}"

        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            # Extract user_id from JWT (simplified)
            user_id = extract_user_id_from_jwt(auth[7:])
            if user_id:
                return f"user:{user_id}"

        # Fallback: IP address
        client_ip = request.headers.get(
            "X-Forwarded-For", request.client.host
        )
        return f"ip:{client_ip}"

app.add_middleware(RateLimitMiddleware, limiter=limiter)
```

### 3.2 Decorator-Based Limiting

```python
# Code Example 7: Decorator-based per-endpoint rate limiting
import functools
from fastapi import APIRouter, Request, HTTPException

router = APIRouter()

def rate_limit(max_requests: int, window_seconds: int,
               key_func=None):
    """
    Endpoint-specific rate limit decorator.

    Usage:
    @rate_limit(max_requests=10, window_seconds=60)
    async def search(query: str):
        ...

    Customize the limit key with key_func:
    @rate_limit(max_requests=5, window_seconds=300,
                key_func=lambda req: req.client.host)
    async def login(credentials):
        ...
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, request: Request = None, **kwargs):
            if request is None:
                return await func(*args, **kwargs)

            # Build key
            if key_func:
                key = key_func(request)
            else:
                user_id = getattr(request.state, 'user_id', request.client.host)
                key = f"{user_id}:{request.url.path}"

            # Evaluate with dedicated limiter
            limiter = SlidingWindowCounterLimiter(
                redis_client=get_redis(),
                max_requests=max_requests,
                window_seconds=window_seconds,
            )

            result = limiter.allow_request(key)
            if not result.allowed:
                raise HTTPException(
                    status_code=429,
                    detail={
                        "error": "Rate limit exceeded",
                        "retry_after": int(result.reset_at - time.time()),
                    },
                    headers={
                        "Retry-After": str(int(result.reset_at - time.time())),
                    },
                )

            return await func(*args, request=request, **kwargs)
        return wrapper
    return decorator

# Usage examples
@router.get("/api/v1/search")
@rate_limit(max_requests=30, window_seconds=60)
async def search_products(query: str, request: Request):
    """Search API: limited to 30 requests per minute"""
    return await perform_search(query)

@router.post("/api/v1/auth/login")
@rate_limit(
    max_requests=5,
    window_seconds=300,
    key_func=lambda req: f"login:{req.client.host}",  # per IP
)
async def login(credentials: dict, request: Request):
    """Login API: limited to 5 times per 5 minutes per IP (brute-force prevention)"""
    return await authenticate(credentials)

@router.post("/api/v1/emails/send")
@rate_limit(max_requests=10, window_seconds=3600)
async def send_email(email_data: dict, request: Request):
    """Email send API: limited to 10 emails per hour"""
    return await send_email_service(email_data)
```

---

## 4. Considerations for Distributed Environments

### 4.1 Race Conditions

```
Race condition problem:

  Server A                    Server B
     |                           |
  GET counter → 99              GET counter → 99
     |                           |
  99 < 100 → allow              99 < 100 → allow
     |                           |
  SET counter = 100             SET counter = 100
     |                           |
  → The 101st request actually passes through!

Solution 1: Lua Script (recommended)
  → All operations execute atomically
  → Used in all implementations in this guide

Solution 2: Redis WATCH + MULTI/EXEC
  → Optimistic locking
  → Requires retry on conflict, which is complex

Solution 3: Redis SET NX + GET (CAS operation)
  → Compare-and-Swap
  → Slower than Lua but simpler

  ★ Conclusion: Lua Script is the most efficient and recommended approach
```

### 4.2 Fallback on Redis Failure

```python
# Code Example 8: Fallback strategy on Redis failure
import time
from threading import Lock
from collections import defaultdict

class ResilientRateLimiter:
    """
    Rate limiter resilient to Redis failures.

    Fallback strategy:
    1. Primary: Redis Cluster (high accuracy)
    2. Secondary: Local memory (approximate)
    3. Tertiary: Fail-open (no limit)

    WHY choose fail-open:
    - It defeats the purpose if the rate limiter's failure stops the whole service
    - Temporarily relaxing limits until Redis recovers is acceptable
    - Instead, trigger an alert and aim for quick recovery
    """

    def __init__(self, redis_limiter: TokenBucketLimiter,
                 fail_open: bool = True):
        self.redis_limiter = redis_limiter
        self.fail_open = fail_open
        self._local_counters = defaultdict(lambda: {"count": 0, "reset": 0})
        self._lock = Lock()
        self._redis_healthy = True
        self._last_health_check = 0

    def allow_request(self, key: str) -> RateLimitResult:
        # Check Redis health (every 10 seconds)
        if not self._redis_healthy:
            if time.time() - self._last_health_check > 10:
                self._check_redis_health()

        # Primary: Redis
        if self._redis_healthy:
            try:
                result = self.redis_limiter.allow_request(key)
                return result
            except Exception as e:
                self._redis_healthy = False
                self._last_health_check = time.time()
                metrics.increment("rate_limiter.redis_error")
                logger.error(f"Redis rate limiter failed: {e}")

        # Secondary: Local memory (approximate)
        try:
            return self._local_rate_limit(key)
        except Exception:
            pass

        # Tertiary: Fail-open / fail-closed
        if self.fail_open:
            metrics.increment("rate_limiter.fail_open")
            return RateLimitResult(
                allowed=True, remaining=-1, reset_at=0, limit=0
            )
        else:
            metrics.increment("rate_limiter.fail_closed")
            return RateLimitResult(
                allowed=False, remaining=0, reset_at=time.time() + 60, limit=0
            )

    def _local_rate_limit(self, key: str) -> RateLimitResult:
        """Approximate rate limiting using local memory"""
        now = time.time()
        with self._lock:
            counter = self._local_counters[key]

            # Reset window
            if now > counter["reset"]:
                counter["count"] = 0
                counter["reset"] = now + 60  # 1-minute window

            counter["count"] += 1

            # ★ There is error proportional to number of servers due to local storage
            # Example: 100/min limit across 4 servers
            #     → Set to 25/min per server
            local_limit = 25  # max_requests / num_servers
            allowed = counter["count"] <= local_limit

            return RateLimitResult(
                allowed=allowed,
                remaining=max(0, local_limit - counter["count"]),
                reset_at=counter["reset"],
                limit=local_limit,
            )

    def _check_redis_health(self):
        """Check Redis health"""
        try:
            self.redis_limiter._redis.ping()
            self._redis_healthy = True
            logger.info("Redis rate limiter recovered")
        except Exception:
            self._redis_healthy = False
            self._last_health_check = time.time()
```

### 4.3 Dynamic Rule Management

```python
# Code Example 9: Dynamic rule management service
import json

class RateLimitRuleService:
    """
    Service for dynamically managing rate limit rules.

    Rule priority:
    1. Per-user rules (user:123 → 500/min)
    2. Per-plan rules (plan:pro → 1000/min)
    3. Per-endpoint rules (/api/search → 30/min)
    4. Default rules (100/min)

    WHY dynamic rules are needed:
    - Temporarily relax limits for specific users (bulk imports, etc.)
    - Immediate reflection of plan changes
    - Emergency restrictions during incident response
    - Experimenting with limit values in A/B tests
    """

    def __init__(self, redis_client, db):
        self.redis = redis_client
        self.db = db
        self._cache_ttl = 300  # 5-minute cache

    async def get_limit(self, client_id: str,
                         endpoint: str) -> dict:
        """Get the applicable rate limit rule"""

        # 1. Check cache
        cache_key = f"rate_rule:{client_id}:{endpoint}"
        cached = await self.redis.get(cache_key)
        if cached:
            return json.loads(cached)

        # 2. Per-user rule
        user_rule = await self.db.fetch_one(
            "SELECT * FROM rate_limit_rules "
            "WHERE client_id = :cid AND endpoint = :ep AND is_active = TRUE",
            {"cid": client_id, "ep": endpoint},
        )
        if user_rule:
            rule = self._format_rule(user_rule)
            await self.redis.set(cache_key, json.dumps(rule), ex=self._cache_ttl)
            return rule

        # 3. Per-plan rule
        plan = await self._get_user_plan(client_id)
        plan_rule = await self.db.fetch_one(
            "SELECT * FROM rate_limit_rules "
            "WHERE client_id = :plan AND endpoint = :ep AND is_active = TRUE",
            {"plan": f"plan:{plan}", "ep": endpoint},
        )
        if plan_rule:
            rule = self._format_rule(plan_rule)
            await self.redis.set(cache_key, json.dumps(rule), ex=self._cache_ttl)
            return rule

        # 4. Default rule
        default = {"max_requests": 100, "window_seconds": 60,
                    "algorithm": "token_bucket"}
        await self.redis.set(cache_key, json.dumps(default), ex=self._cache_ttl)
        return default

    async def set_temporary_override(self, client_id: str,
                                       endpoint: str,
                                       new_limit: dict,
                                       duration_hours: int = 24):
        """Temporary rule override (for incident response, etc.)"""
        await self.db.execute(
            "INSERT INTO rate_limit_overrides "
            "(client_id, endpoint, max_requests, window_seconds, expires_at) "
            "VALUES (:cid, :ep, :max, :win, NOW() + INTERVAL ':dur hours')",
            {
                "cid": client_id, "ep": endpoint,
                "max": new_limit["max_requests"],
                "win": new_limit["window_seconds"],
                "dur": duration_hours,
            },
        )

        # Immediately invalidate cache
        cache_key = f"rate_rule:{client_id}:{endpoint}"
        await self.redis.delete(cache_key)

    def _format_rule(self, rule) -> dict:
        return {
            "max_requests": rule["max_requests"],
            "window_seconds": rule["window_seconds"],
            "algorithm": rule.get("algorithm", "token_bucket"),
        }
```

---

## 5. Algorithm Comparison Table

### 5.1 Technical Comparison

| Algorithm | Memory Usage | Accuracy | Burst Tolerance | Implementation Complexity | Race Condition |
|------------|:----------:|:----:|:----------:|:----------:|:-----------------:|
| Token Bucket | O(1) | High | Controllable | Medium | Solved with Lua |
| Leaky Bucket | O(1) | High | None (smoothed) | Medium | Solved with Lua |
| Fixed Window | O(1) | Low (boundary problem) | Yes (2x at boundary) | Low | Pipeline sufficient |
| Sliding Window Log | O(N) | Highest | None | High | Solved with Lua |
| Sliding Window Counter | O(1) | Medium-High | Minor | Medium | Solved with Lua |

### 5.2 Recommended by Use Case

| Use Case | Recommended Algorithm | Reason |
|------------|---------------|------|
| API Gateway | Token Bucket | Supports both burst tolerance and steady rate control |
| DDoS Defense | Fixed Window | Simple and fast; accuracy is secondary |
| Billing API | Sliding Window Log | Accurate counting required |
| Streaming | Leaky Bucket | Maintains uniform processing rate |
| General API | Sliding Window Counter | Balance of accuracy and memory efficiency |
| Login (brute-force prevention) | Sliding Window Log | Accurate counting for security |

### 5.3 Performance Comparison

| Algorithm | Redis Operations (Lua) | Latency (p99) | Memory/Key |
|------------|:-----------------:|:---------------:|:----------:|
| Token Bucket | 3 (HMGET + HMSET + EXPIRE) | < 1ms | ~100 bytes |
| Fixed Window | 2 (INCR + EXPIRE) | < 0.5ms | ~50 bytes |
| Sliding Window Log | 3 (ZREMRANGE + ZCARD + ZADD) | < 2ms | ~100KB (1000 req) |
| Sliding Window Counter | 3 (GET + GET + INCR) | < 1ms | ~100 bytes |
| Leaky Bucket | 3 (HMGET + HMSET + EXPIRE) | < 1ms | ~100 bytes |

---

## 6. Anti-Patterns

### Anti-Pattern 1: Managing Rate Limits in Application Memory

```python
# BAD: Managing counts in each server's memory
class BadInMemoryLimiter:
    def __init__(self):
        self.counters = {}  # Local memory

    def allow(self, key):
        count = self.counters.get(key, 0)
        if count >= 100:
            return False
        self.counters[key] = count + 1
        return True

# Problems:
#   Server A: user-123 = 50 requests
#   Server B: user-123 = 50 requests
#   → Total is 100 but each server thinks it's 50
#   → The limit has no effect (N times the limit with N servers)

# Also:
#   - Counters reset when server restarts
#   - Memory leak risk (no automatic key deletion)


# GOOD: Centralized management with Redis
class GoodRedisLimiter:
    def __init__(self, redis_client):
        self.redis = redis_client

    def allow(self, key):
        # Centralized in Redis → shared across all servers
        result = self.redis.eval(LUA_SCRIPT, 1, key, ...)
        return bool(result[0])

# With Redis Cluster:
#   Server A --count--> [Redis Cluster] <--count-- Server B
#   → user-123 = 100 (accurate total)
```

### Anti-Pattern 2: Using a Single Rate Limit Rule Only

```python
# BAD: Same limit for all users and all endpoints
class BadSingleRuleLimiter:
    GLOBAL_LIMIT = 100  # req/min for everyone

    def allow(self, key):
        count = self.redis.incr(f"rate:{key}")
        return count <= self.GLOBAL_LIMIT

# Problems:
# 1. Free and paid users share the same limit → no value in paid plan
# 2. /api/health (lightweight) and /api/search (heavyweight) share the same limit
# 3. DDoS defense and normal limits cannot be distinguished


# GOOD: Multi-layered, multi-dimensional rules
class GoodMultiLayerLimiter:
    RULES = {
        # Per plan
        "plan:free":       {"default": 60, "search": 10},
        "plan:pro":        {"default": 1000, "search": 100},
        "plan:enterprise": {"default": 10000, "search": 1000},

        # Per endpoint
        "endpoint:/api/search":  {"limit": 30, "window": 60},
        "endpoint:/api/health":  None,  # no limit
        "endpoint:/api/login":   {"limit": 5, "window": 300},

        # Global (DDoS defense)
        "global:ip": {"limit": 1000, "window": 60},
    }

    def allow(self, client_id, endpoint, plan):
        # 1. Global IP limit
        if not self._check_ip_limit(client_id):
            return False
        # 2. Endpoint-specific limit
        if not self._check_endpoint_limit(client_id, endpoint):
            return False
        # 3. Per-plan limit
        if not self._check_plan_limit(client_id, plan, endpoint):
            return False
        return True
```

### Anti-Pattern 3: Not Returning Retry-After

```python
# BAD: Returns 429 without telling the client when to retry
@app.get("/api/data")
async def bad_endpoint(request: Request):
    if not rate_limiter.allow(get_client_id(request)):
        return Response(
            content="Too Many Requests",
            status_code=429,
        )
        # Client does not know when to retry
        # → Retries immediately and receives more 429s
        # → Thundering Herd problem


# GOOD: Notify limit status with standard headers
@app.get("/api/data")
async def good_endpoint(request: Request):
    result = rate_limiter.allow_request(get_client_id(request))

    if not result.allowed:
        retry_after = max(1, int(result.reset_at - time.time()))
        return Response(
            content=json.dumps({
                "error": {
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": f"Please retry after {retry_after} seconds",
                    "retry_after": retry_after,
                }
            }),
            status_code=429,
            headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Limit": str(result.limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(int(result.reset_at)),
            },
        )

    response = await process_request(request)
    response.headers["X-RateLimit-Remaining"] = str(result.remaining)
    return response
```

### Anti-Pattern 4: Ignoring Rate Limits on the Client Side

```python
# BAD: No retry control on the client side
class BadClient:
    async def call_api(self, url):
        for _ in range(100):  # Retry 100 times
            response = await http.get(url)
            if response.status == 200:
                return response
            # Retries immediately on 429 → adds load to server

# GOOD: Exponential Backoff + Jitter + Respect Retry-After
class GoodClient:
    async def call_api(self, url, max_retries=5):
        for attempt in range(max_retries):
            response = await http.get(url)

            if response.status == 200:
                return response

            if response.status == 429:
                # Respect the Retry-After header
                retry_after = int(response.headers.get("Retry-After", 60))

                # Exponential Backoff + Jitter
                base_delay = min(retry_after, 2 ** attempt)
                jitter = random.uniform(0, base_delay * 0.5)
                wait_time = base_delay + jitter

                logger.warning(
                    f"Rate limited. Waiting {wait_time:.1f}s "
                    f"(attempt {attempt + 1}/{max_retries})"
                )
                await asyncio.sleep(wait_time)

            elif response.status >= 500:
                await asyncio.sleep(2 ** attempt)
            else:
                raise APIError(response.status, await response.text())

        raise MaxRetriesExceeded(f"Failed after {max_retries} attempts")
```

---

## 7. Practical Exercises

### Exercise 1 (Basic): Design a Multi-Layered Rate Limiter

**Task**: Implement a two-stage rate limiter with an IP layer and a user layer.

```python
# Requirements:
# 1. Per IP: 1000 req/min (DDoS defense)
# 2. Per user: 100 req/min (normal usage)
# 3. For unauthenticated users, apply only the IP limit
# 4. Allow requests only when they pass both limits
# 5. Show the remaining count for the stricter limit in response headers

# Skeleton code:
class TwoLayerRateLimiter:
    def __init__(self, redis_client):
        self.ip_limiter = FixedWindowLimiter(
            redis_client, max_requests=1000, window_seconds=60
        )
        self.user_limiter = TokenBucketLimiter(
            redis_client, max_tokens=100, refill_rate=1.67
        )

    def check(self, ip: str, user_id: str = None) -> RateLimitResult:
        # TODO: Check IP limit
        # TODO: Check user limit if user_id is provided
        # TODO: Return the result for the stricter limit
        pass
```

**Expected output**:
```
# Authenticated user (IP: 192.168.1.1, User: user-123)
IP layer:   allowed=True, remaining=955/1000
User layer: allowed=True, remaining=85/100
→ Result:   allowed=True, remaining=85 (the smaller value)

# Unauthenticated user (IP: 10.0.0.1)
IP layer:   allowed=True, remaining=990/1000
User layer: (skip)
→ Result:   allowed=True, remaining=990

# IP limit exceeded (DDoS)
IP layer:   allowed=False, remaining=0/1000
→ Result:   allowed=False (skip user layer check)
```

---

### Exercise 2 (Intermediate): Plan-Based Rate Limiter

**Task**: Implement a system that dynamically applies rate limits based on the pricing plan.

```python
# Requirements:
# 1. Free plan: 60 req/min, no burst
# 2. Starter plan: 300 req/min, burst 50
# 3. Pro plan: 1000 req/min, burst 200
# 4. Enterprise plan: custom limits
# 5. Plan changes reflected immediately
# 6. Automatically determine plan from API Key

# Skeleton code:
class PlanBasedRateLimiter:
    PLAN_CONFIGS = {
        "free":       {"algorithm": "fixed_window", "max": 60, "window": 60},
        "starter":    {"algorithm": "token_bucket", "max": 300, "refill": 5.0},
        "pro":        {"algorithm": "token_bucket", "max": 1000, "refill": 16.7},
        "enterprise": None,  # Retrieved from DB
    }

    async def check(self, api_key: str) -> RateLimitResult:
        # TODO: Get plan from API Key
        # TODO: Select the algorithm corresponding to the plan
        # TODO: Apply rate limit
        pass
```

**Expected output**:
```
API Key: sk_free_abc123
Plan: free
Algorithm: Fixed Window
→ Result: allowed=True, remaining=42/60, reset=2024-01-15T10:01:00Z

API Key: sk_pro_xyz789
Plan: pro
Algorithm: Token Bucket
→ Result: allowed=True, remaining=850/1000, refill_rate=16.7/sec
```

---

### Exercise 3 (Advanced): Fault Tolerance Test for Distributed Rate Limiter

**Task**: Design and implement a complete rate limiter system including fallback behavior on Redis failure.

```python
# Requirements:
# 1. Normal operation: rate limiting with Redis Cluster
# 2. On Redis failure: fallback to local memory
# 3. Metrics collection during fallback
# 4. Automatic detection of Redis recovery and switchback
# 5. Alert triggered during failure
# 6. Test scenarios for fault tolerance

# Test scenarios:
class RateLimiterResiliencyTest:
    """
    Test 1: Redis normal operation
      → 100 req/min limit works accurately

    Test 2: Redis failure occurs
      → Automatically switches to fallback
      → Approximate limiting works with local memory
      → Alert is triggered

    Test 3: Redis recovery
      → Switches back to Redis within 10 seconds
      → Local counters are cleared

    Test 4: Network partition (Split Brain)
      → Each server maintains rate limits independently
      → Overall accuracy decreases, but service continues
    """

    async def test_redis_failure_and_recovery(self):
        # TODO: Stop Redis
        # TODO: Confirm requests pass through (fail-open)
        # TODO: Confirm local fallback behavior
        # TODO: Recover Redis
        # TODO: Confirm switchback to Redis
        pass
```

**Expected output**:
```
[Test 1: Normal Operation]
  Request 1-100: allowed=True (via Redis)
  Request 101:   allowed=False (rate limited)
  → PASS

[Test 2: Redis Failure]
  [10:00:00] Redis connection lost
  [10:00:00] Alert: "Rate limiter Redis failure - falling back to local"
  [10:00:00] Fallback: local memory limiter activated
  Request 1-25: allowed=True (via local, limit=25 per server)
  Request 26:   allowed=False (local rate limited)
  → PASS

[Test 3: Redis Recovery]
  [10:00:15] Redis connection restored
  [10:00:15] Log: "Rate limiter Redis recovered"
  Request next: allowed=True (via Redis, counter reset)
  → PASS
```

---

## 8. FAQ

### Q1. Where is the best place to put the rate limiter?

**A.** Multi-layered defense is ideal.

1. **CDN/Edge layer** (Cloudflare, AWS WAF): Coarse IP-level limits. Primary purpose is DDoS defense. Leverages cloud vendor processing capacity to block abnormal traffic before it reaches your own infrastructure.
2. **API Gateway layer** (Kong, Envoy, Nginx): Limits per API Key / plan. Manages usage of authenticated clients. Business rule-based limits are implemented here.
3. **Application layer** (middleware): Feature-specific limits. Fine-grained control such as 30 req/min for search APIs and 10 req/min for posting. Implements limits closely tied to business logic.

Consolidating everything in one place creates a single point of failure, so critical limits should be redundant across multiple layers.

### Q2. What happens when Redis goes down?

**A.** Decide in advance whether to fail-open (pass without limit) or fail-closed (reject all).

- **Fail-open** (recommended): Adopt this for general cases. It defeats the purpose if the entire service stops due to rate limiter failure. Temporarily relax limits until Redis recovers, and use local memory cache (Guava / Caffeine) as fallback.
- **Fail-closed**: Use this for security-critical scenarios (login attempt limits, payment APIs). When the risk of unauthorized access outweighs the risk of service disruption.
- **Hybrid**: Switch strategy per endpoint. `/api/login` uses fail-closed, `/api/products` uses fail-open.
- Use **Redis Cluster + Sentinel** to ensure availability and minimize failures from occurring.

### Q3. How do I implement rate limit handling on the client side?

**A.** Combine the following three approaches.

1. **Proactive throttling**: Monitor the `X-RateLimit-Remaining` response header and widen request intervals when remaining quota is low. It is common to start throttling when reaching 80% of the limit.
2. **Reactive retry**: On receiving a 429 response, wait the number of seconds specified in the `Retry-After` header before retrying. Use Exponential Backoff if the header is absent.
3. **Thundering Herd mitigation**: Implement Exponential Backoff + Jitter to prevent many clients from retrying simultaneously. Simply adding `jitter = random.uniform(0, base_delay)` dramatically improves the situation.

### Q4. How should I design rate limiting between microservices?

**A.** Leverage a service mesh (Istio, Envoy) to apply rate limits to inter-service communication as well.

- **Service-to-service tokens**: Assign a "call quota" to each microservice. Service A can call Service B up to 1000 req/min.
- **Integration with Circuit Breaker**: Combine rate limiting with circuit breakers. If rate limit excess continues, open the circuit to halt calls entirely.
- **Backpressure**: When a downstream service is overloaded, return 429 to upstream to propagate the load. Using a queue like Kafka for buffering is another option.

### Q5. How do I test a rate limiter?

**A.** Test from the following perspectives.

1. **Unit tests**: Accuracy of each algorithm. Requests within the limit should pass, and those exceeding the limit should be rejected.
2. **Timing tests**: Window resets and token refills operate accurately.
3. **Concurrency tests**: Concurrent access from multiple threads/processes does not cause race conditions.
4. **Failure tests**: Fallback behavior on Redis failure. Switchback on recovery.
5. **Load tests**: Performance at 100,000 req/sec. Check CPU/memory usage of Redis.

---

## 9. Advanced Topics

### 9.1 Consistency in Distributed Rate Limiters

```
Challenges of rate limiting in a distributed environment:

Problem: Consistency when distributed across multiple Redis nodes

  [App Server 1] --> [Redis Node A] : user-123 = 50
  [App Server 2] --> [Redis Node B] : user-123 = 50
  → Total is 100 but each node thinks it's 50

Solutions:

1. Single Redis node (recommended)
   - Hash slots ensure user-123 keys always go to the same node
   - Leverage Redis Cluster key-based routing
   - Note: Use hash tags like {user:123} to place
     related keys on the same node

2. Gossip Protocol (approximate)
   - Each node holds a local count and syncs periodically
   - Does not guarantee full accuracy but excels in scalability
   - Used in Envoy's global rate limiter

3. Central Coordinator
   - A single coordinator handles all requests
   - Highest accuracy but becomes a single point of failure
```

### 9.2 Adaptive Rate Limiting

```python
# Code Example 10: Dynamic rate limiting based on server load
class AdaptiveRateLimiter:
    """
    Dynamically adjusts rate limits based on server load.

    WHY adaptive rate limiting is needed:
    - Fixed limits unnecessarily reject requests when the server has capacity
    - Fixed limits may be insufficient when load is high
    - Traffic patterns vary greatly by time of day

    Strategy:
    - CPU usage > 80% → Tighten limits (reduce to 50%)
    - CPU usage > 90% → Allow only minimum (reduce to 20%)
    - CPU usage < 50% → Relax limits (expand to 150%)
    """

    def __init__(self, base_limiter, health_checker):
        self.base_limiter = base_limiter
        self.health_checker = health_checker
        self._adjustment_factor = 1.0

    async def update_factor(self):
        """Update adjustment factor periodically (every 10 seconds)"""
        health = await self.health_checker.get_metrics()

        cpu_usage = health["cpu_percent"]
        if cpu_usage > 90:
            self._adjustment_factor = 0.2
        elif cpu_usage > 80:
            self._adjustment_factor = 0.5
        elif cpu_usage > 60:
            self._adjustment_factor = 0.8
        elif cpu_usage < 30:
            self._adjustment_factor = 1.5
        else:
            self._adjustment_factor = 1.0

        metrics.gauge("rate_limit.adjustment_factor", self._adjustment_factor)

    def get_effective_limit(self, base_limit: int) -> int:
        """Return the adjusted limit value"""
        return max(1, int(base_limit * self._adjustment_factor))
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in real-world work?

Knowledge of this topic is frequently used in daily development work. It becomes especially important during code reviews and architecture design.

---

## 10. Summary

| Item | Key Point |
|------|---------|
| Purpose | Prevent overload, mitigate abuse, fair resource allocation, enforce business rules |
| Placement | Multi-layered defense (Edge → Gateway → Application) |
| Token Bucket | Burst tolerance + steady rate control. Most versatile. Used by AWS, Stripe |
| Sliding Window Counter | Balance of accuracy and efficiency. Optimal for general APIs |
| Sliding Window Log | Highest accuracy. For billing APIs and security-critical use |
| Fixed Window | Simplest and fastest. For DDoS defense |
| Leaky Bucket | Uniform rate output. For streaming |
| Distributed env | Atomic operations with Redis + Lua scripts |
| HTTP headers | Notify limit status with X-RateLimit-*, Retry-After |
| Fallback | Fail-open/closed on Redis failure + local cache |
| Dynamic rules | Per-plan / per-endpoint rule management with DB + Redis cache |
| Adaptive | Dynamically adjust limit values based on server load |

---

## 11. Design Interview Answer Framework

```
Key points asked in rate limiter design interviews:

1. Clarifying requirements (5 min)
   - Client-side or server-side? → Server-side
   - Granularity of limits? → IP / API Key / User ID
   - Distributed environment? → Yes, multiple servers
   - Accuracy requirements? → Approximate is OK or exact

2. High-level design (10 min)
   - Multi-layer placement (Edge → Gateway → App)
   - Counter management with Redis
   - HTTP 429 + Retry-After

3. Algorithm selection (10 min)
   - Token Bucket (general-purpose) vs Sliding Window (high accuracy)
   - Explaining trade-offs

4. Detailed design (10 min)
   - Atomic operations with Lua scripts
   - Race condition mitigation
   - Fallback on Redis failure

5. Operations (5 min)
   - Dynamic rule changes
   - Monitoring and alerting
   - Adaptive rate limiting
```

---

## What to Read Next

- [Search Engine Design](./04-search-engine.md) — Rate limit design for search APIs
- [Notification System Design](./02-notification-system.md) — Rate limiting for notifications
- [CDN](../01-components/03-cdn.md) — Rate limiting at the edge layer
- [Load Balancer](../01-components/00-load-balancer.md) — Rate limiting at L4/L7
- API Design — Response header design for APIs
- Proxy Pattern — Implementing a rate limiter as a Proxy
- Strategy Pattern — Design for switching algorithms
- [Reliability](../00-fundamentals/02-reliability.md) — Fundamentals of fallback strategies

---

## References

1. Xu, A. (2020). *System Design Interview: An Insider's Guide*. Chapter 4: Design a Rate Limiter. Byte Code LLC. https://www.systemdesigninterview.com/
2. Kleppmann, M. (2017). *Designing Data-Intensive Applications*. O'Reilly Media. Chapter 8: The Trouble with Distributed Systems.
3. Stripe Engineering. (2017). "Scaling your API with rate limiters." *Stripe Blog*. https://stripe.com/blog/rate-limiters
4. IETF. (2012). *RFC 6585: Additional HTTP Status Codes*. Section 4: 429 Too Many Requests. https://www.rfc-editor.org/rfc/rfc6585
5. Google Cloud. (2024). "Rate limiting strategies and techniques." *Cloud Architecture Center*. https://cloud.google.com/architecture/rate-limiting-strategies-techniques
6. Redis. (2024). "Rate Limiting with Redis." *Redis Documentation*. https://redis.io/docs/latest/develop/use/patterns/rate-limiting/
7. Envoy Proxy. (2024). "Global rate limiting." *Envoy Documentation*. https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/other_features/global_rate_limiting

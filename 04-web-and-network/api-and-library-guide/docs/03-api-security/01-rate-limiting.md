# Rate Limiting

> Rate limiting is the defensive line that protects API stability and fairness. Design production-quality rate limiting by understanding algorithms such as Token Bucket, Sliding Window, and distributed rate limiting, as well as implementation patterns and client-side handling.

## What You Will Learn

- [ ] Understand the types and characteristics of rate limiting algorithms
- [ ] Understand how to implement distributed rate limiting using Redis
- [ ] Learn rate limit response design and client-side handling
- [ ] Understand multi-layer rate limiting design patterns
- [ ] Learn the challenges and solutions for rate limiting in distributed environments
- [ ] Understand rate limiting testing techniques and monitoring

---

## Prerequisites

- Understanding of API authentication patterns → See: [Authentication Patterns](./00-authentication-patterns.md)
- HTTP status codes (429 Too Many Requests, etc.) → See: HTTP Basics
- Basic concepts of distributed systems (rate limiting in multi-server environments)

---

## 1. Purpose and Basic Concepts of Rate Limiting

### 1.1 Why Rate Limiting Is Necessary

```
Four Reasons Rate Limiting Is Necessary:

  ① Service stability:
     → Prevents one client's high request volume from affecting others
     → Protects server resources (CPU, memory, DB connections)
     → Prevents cascading failures
     → Prevents overload on backend services

  ② Fairness:
     → Fair resource allocation for all clients
     → Differentiation between free/paid plans
     → Resource guarantees based on SLA
     → Isolation of impact between tenants (noisy neighbor problem)

  ③ Security:
     → Prevents brute-force attacks
     → Mitigates DDoS
     → Suppresses scraping
     → Defends against attacks on authentication endpoints
     → Detects unauthorized use of API keys

  ④ Cost control:
     → Controls costs of external API calls
     → Predictability of infrastructure costs
     → Controls database load
     → Protects network bandwidth
```

### 1.2 Rate Limiting Granularity

```
Units (Granularity) for Applying Rate Limits:

  ┌─────────────────────────────────────────────────────┐
  │           Rate Limiting Granularity Pyramid          │
  │                                                     │
  │                    ┌───────┐                        │
  │                    │Global │  ← Entire service       │
  │                   ┌┴───────┴┐                       │
  │                   │ Tenant  │  ← Per tenant          │
  │                  ┌┴─────────┴┐                      │
  │                  │   User    │  ← Per user           │
  │                 ┌┴───────────┴┐                     │
  │                 │  API Key    │  ← Per API key       │
  │                ┌┴─────────────┴┐                    │
  │                │   IP Address  │  ← Per IP address  │
  │               ┌┴───────────────┴┐                   │
  │               │    Endpoint     │  ← Per endpoint   │
  │              ┌┴─────────────────┴┐                  │
  │              │  Resource + Action│  ← Resource op.  │
  │              └───────────────────┘                  │
  └─────────────────────────────────────────────────────┘

  When to Use Each Granularity:

  ① Per user (user_id):
     → Authenticated requests
     → Fairness guarantee per user
     → Example: 100 req/min per user

  ② Per API Key (api_key):
     → Service-to-service communication
     → Plan-based restrictions
     → Example: Free=100 req/min, Pro=1000 req/min

  ③ Per IP (ip_address):
     → Unauthenticated requests
     → Brute-force prevention
     → Example: 60 req/min per IP

  ④ Per endpoint:
     → Different limits for /users vs /orders
     → Stricter limits for heavy processing endpoints
     → Example: /search=10 req/min, /users=100 req/min

  ⑤ Per plan:
     → SaaS tier control
     → Example: Free=100 req/min, Pro=1000 req/min, Enterprise=10000 req/min

  ⑥ Composite key:
     → Combination of user_id + endpoint
     → tenant_id + resource_type
     → Example: User A can make 10 req/hour against /upload
```

### 1.3 Rate Limiting Design Principles

```
Design Principles Important in Practice:

  ① Transparency:
     → Notify remaining request count via response headers
     → Document limit values explicitly
     → Clear error messages when limit is exceeded

  ② Gradual limiting:
     → Apply limits gradually rather than blocking immediately
     → Three stages: Warning → Throttle → Block
     → Dynamic limiting based on anomaly detection

  ③ Graceful degradation:
     → Fallback for when the rate limiting system itself goes down
     → Allow-by-default vs Deny-by-default
     → Local cache-based fallback

  ④ Flexibility:
     → Immediately relax limits on plan upgrade
     → Temporary limit relaxation (burst allowance)
     → Whitelist support

  ⑤ Monitoring:
     → Monitor how often rate limits are triggered
     → Detect and respond to false positives
     → Feed into capacity planning
```

---

## 2. Rate Limiting Algorithms

### 2.1 Fixed Window

```
① Fixed Window:

  Fix the time window (e.g., every minute from :00 to :59)
  Count requests within the window

  |--- window 1 ---|--- window 2 ---|--- window 3 ---|
  |  ■■■■■■■■■     |  ■■            |  ■■■■■         |
  |  9 requests     |  2 requests    |  5 requests    |
  limit = 10/min

  Advantages:
  → Simple to implement
  → Memory efficient (one counter per window)
  → Low computational cost

  Disadvantages:
  → Burst at window boundaries
  → 10 requests at :59 + 10 requests at 1:00
  → 20 requests in 2 seconds (double the limit)

  ┌────────────────┬────────────────┐
  │   Window 1     │   Window 2     │
  │          ■■■■  │  ■■■■          │
  │   10 req       │  10 req        │
  └────────────────┴────────────────┘
       ↑ 20 req/2s near boundary ↑
```

```javascript
// Fixed Window implementation
class FixedWindowRateLimiter {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.windows = new Map(); // key -> { count, windowStart }
  }

  isAllowed(key) {
    const now = Date.now();
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;

    const entry = this.windows.get(key);

    if (!entry || entry.windowStart !== windowStart) {
      // New window
      this.windows.set(key, { count: 1, windowStart });
      return {
        allowed: true,
        remaining: this.limit - 1,
        resetAt: windowStart + this.windowMs,
      };
    }

    if (entry.count < this.limit) {
      entry.count++;
      return {
        allowed: true,
        remaining: this.limit - entry.count,
        resetAt: windowStart + this.windowMs,
      };
    }

    return {
      allowed: false,
      remaining: 0,
      resetAt: windowStart + this.windowMs,
      retryAfter: Math.ceil((windowStart + this.windowMs - now) / 1000),
    };
  }

  // Clean up old windows
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.windows.entries()) {
      if (now - entry.windowStart > this.windowMs * 2) {
        this.windows.delete(key);
      }
    }
  }
}

// Usage example
const limiter = new FixedWindowRateLimiter(100, 60000); // 100 req/min

function handleRequest(req) {
  const key = `rate:${req.ip}`;
  const result = limiter.isAllowed(key);

  if (!result.allowed) {
    return { status: 429, retryAfter: result.retryAfter };
  }

  return { status: 200, remaining: result.remaining };
}
```

### 2.2 Sliding Window Log

```
② Sliding Window Log:

  Records a timestamp for each request
  Counts requests within a window looking back from the current time

  Time flows →
  ─────────────────────────────────────────────
  t1  t2    t3  t4 t5   t6  t7    t8  t9  t10
  ■   ■     ■   ■  ■    ■   ■     ■   ■   ■
  |←──────── 60-second window ──────────→|
                                         ↑ current time

  Old timestamps (t1, t2) are outside the window and excluded

  Advantages:
  → Accurate rate limiting (no boundary burst problem)
  → Count of requests within window is always accurate

  Disadvantages:
  → High memory consumption (stores timestamps for each request)
  → Memory usage proportional to number of requests in window
  → Cleanup processing required
```

```javascript
// Sliding Window Log implementation
class SlidingWindowLogLimiter {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.logs = new Map(); // key -> timestamp[]
  }

  isAllowed(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing log, or initialize
    let timestamps = this.logs.get(key) || [];

    // Remove timestamps outside the window
    timestamps = timestamps.filter(ts => ts > windowStart);

    if (timestamps.length < this.limit) {
      timestamps.push(now);
      this.logs.set(key, timestamps);

      return {
        allowed: true,
        remaining: this.limit - timestamps.length,
        resetAt: Math.ceil((timestamps[0] + this.windowMs) / 1000),
      };
    }

    // Calculate when the next slot opens from the oldest timestamp
    const oldestInWindow = timestamps[0];
    const retryAfter = Math.ceil((oldestInWindow + this.windowMs - now) / 1000);

    this.logs.set(key, timestamps);

    return {
      allowed: false,
      remaining: 0,
      retryAfter,
      resetAt: Math.ceil((oldestInWindow + this.windowMs) / 1000),
    };
  }
}

// Sliding Window Log with Redis
async function slidingWindowLogRedis(redis, key, limit, windowMs) {
  const now = Date.now();
  const windowStart = now - windowMs;

  const pipeline = redis.pipeline();

  // Remove old entries
  pipeline.zremrangebyscore(key, '-inf', windowStart);
  // Get current count
  pipeline.zcard(key);

  const results = await pipeline.exec();
  const count = results[1][1];

  if (count < limit) {
    // Add new entry (unique member name required)
    const member = `${now}:${Math.random().toString(36).substr(2, 9)}`;
    await redis.zadd(key, now, member);
    await redis.pexpire(key, windowMs);

    return { allowed: true, remaining: limit - count - 1 };
  }

  // Get time of the oldest entry
  const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
  const retryAfter = oldest.length >= 2
    ? Math.ceil((parseFloat(oldest[1]) + windowMs - now) / 1000)
    : 1;

  return { allowed: false, remaining: 0, retryAfter };
}
```

### 2.3 Sliding Window Counter

```
③ Sliding Window Counter:

  Combines the memory efficiency of Fixed Window with the accuracy of Sliding Window
  Estimates count using a weighted combination of the previous and current window

  |--- Previous Window ---|--- Current Window ---|
  |  8 requests           |  3 requests          |
  |                       |←── 40% elapsed ──→|  |

  Previous window: 8 requests
  Current window: 3 requests
  Elapsed percentage of current window: 40%
  Remaining weight of previous window: 100% - 40% = 60%

  Estimated request count = previous window × remaining weight + current window
                          = 8 × 0.6 + 3
                          = 4.8 + 3
                          = 7.8 → Within limit (10) → Allowed

  Advantages:
  → Good balance between accuracy and memory
  → Only 2 counters per window (memory efficient)
  → Significantly reduces boundary burst problem

  Disadvantages:
  → Is an estimate and not perfectly accurate
  → Errors arise when actual request distribution is not uniform
```

```javascript
// Sliding Window Counter implementation
class SlidingWindowCounter {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.counters = new Map();
  }

  isAllowed(key) {
    const now = Date.now();
    const currentWindow = Math.floor(now / this.windowMs) * this.windowMs;
    const previousWindow = currentWindow - this.windowMs;

    let data = this.counters.get(key);
    if (!data) {
      data = { windows: {} };
      this.counters.set(key, data);
    }

    const currentCount = data.windows[currentWindow] || 0;
    const previousCount = data.windows[previousWindow] || 0;

    // Elapsed fraction of current window
    const elapsed = (now - currentWindow) / this.windowMs;
    // Weight of previous window
    const previousWeight = 1 - elapsed;

    // Estimated request count
    const estimatedCount = previousCount * previousWeight + currentCount;

    if (estimatedCount < this.limit) {
      data.windows[currentWindow] = currentCount + 1;

      // Remove old windows
      for (const w of Object.keys(data.windows)) {
        if (parseInt(w) < previousWindow) {
          delete data.windows[w];
        }
      }

      return {
        allowed: true,
        remaining: Math.floor(this.limit - estimatedCount - 1),
        resetAt: Math.ceil((currentWindow + this.windowMs) / 1000),
      };
    }

    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((this.windowMs - (now - currentWindow)) / 1000),
    };
  }
}
```

### 2.4 Token Bucket

```
④ Token Bucket:

  Add tokens to a bucket at a constant rate
  1 request = consume 1 token
  No tokens = request denied

  Parameters:
  → capacity: Maximum number of tokens in the bucket (burst tolerance)
  → refill_rate: Token refill rate (tokens/second)

  ┌──────────────────────────────────┐
  │         Token Bucket             │
  │                                  │
  │  capacity = 10                   │
  │  refill_rate = 2/sec             │
  │                                  │
  │  ┌────────────────────┐          │
  │  │ ● ● ● ● ● ○ ○ ○ ○ ○│ ←tokens  │
  │  │ 5/10 tokens         │          │
  │  └────────────────────┘          │
  │       ↑ Refill at 2 tokens/sec   │
  │       ↓ Tokens consumed by req.  │
  │                                  │
  │  Max 10 request burst            │
  │  Steady state: 2 requests/sec    │
  └──────────────────────────────────┘

  Time simulation:
  t=0   : tokens=10 (full)
  t=0   : 5 requests → tokens=5
  t=1   : +2 tokens → tokens=7
  t=1   : 3 requests → tokens=4
  t=2   : +2 tokens → tokens=6
  t=5   : +6 tokens → tokens=10 (capped at max)

  Advantages:
  → Allows bursts while maintaining long-term limits
  → Intuitive parameters
  → Used by AWS API Gateway, Nginx, and GitHub API

  Disadvantages:
  → Requires tuning two parameters
  → Short-term bursts may put load on backend
```

```javascript
// Token Bucket implementation (in-memory)
class TokenBucket {
  constructor(capacity, refillRate) {
    this.capacity = capacity;       // Maximum token count
    this.refillRate = refillRate;   // Tokens/second
    this.buckets = new Map();
  }

  isAllowed(key, tokensRequired = 1) {
    const now = Date.now();

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    // Refill tokens
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(
      this.capacity,
      bucket.tokens + elapsed * this.refillRate
    );
    bucket.lastRefill = now;

    if (bucket.tokens >= tokensRequired) {
      bucket.tokens -= tokensRequired;
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        retryAfter: 0,
      };
    }

    // If insufficient tokens, calculate when next token will be available
    const deficit = tokensRequired - bucket.tokens;
    const retryAfter = Math.ceil(deficit / this.refillRate);

    return {
      allowed: false,
      remaining: 0,
      retryAfter,
    };
  }
}

// Token consumption based on request size
class WeightedTokenBucket extends TokenBucket {
  constructor(capacity, refillRate, weightFn) {
    super(capacity, refillRate);
    this.weightFn = weightFn;
  }

  isAllowedForRequest(key, request) {
    const weight = this.weightFn(request);
    return this.isAllowed(key, weight);
  }
}

// Usage example: consumption based on endpoint weight
const weightedLimiter = new WeightedTokenBucket(
  100, // capacity
  10,  // refill_rate: 10 tokens/sec
  (req) => {
    // GET costs 1 token, POST costs 5, file upload costs 20
    const weights = {
      'GET': 1,
      'POST': 5,
      'PUT': 5,
      'DELETE': 3,
    };
    if (req.path.includes('/upload')) return 20;
    return weights[req.method] || 1;
  }
);
```

### 2.5 Leaky Bucket

```
⑤ Leaky Bucket:

  Enqueue requests and process at a constant rate
  Full queue = request denied

  ┌──────────────────────────────────┐
  │         Leaky Bucket             │
  │                                  │
  │  ┌─────────┐                     │
  │  │ req req  │ ← requests flowing in │
  │  │ req req  │   (irregular)       │
  │  │ req req  │                     │
  │  │ req req  │  queue_size = 10    │
  │  └────┬─────┘                     │
  │       │                           │
  │       ▼  drain at constant rate   │
  │    ● ● ● ● ●                     │
  │    leak_rate = 2/sec              │
  │                                  │
  │  → Output rate is constant (smooth) │
  │  → Smooths out bursts             │
  └──────────────────────────────────┘

  Differences from Token Bucket:
  ┌─────────────────┬─────────────────┐
  │   Token Bucket  │  Leaky Bucket   │
  ├─────────────────┼─────────────────┤
  │ Allows burst    │ Smooths burst   │
  │ Controls input  │ Controls output │
  │ Token consumption│ Queue mgmt.    │
  │ Immediate resp. │ Queue wait      │
  └─────────────────┴─────────────────┘
```

```javascript
// Leaky Bucket implementation
class LeakyBucket {
  constructor(capacity, leakRate) {
    this.capacity = capacity;     // Maximum queue size
    this.leakRate = leakRate;     // Processing rate (requests/second)
    this.buckets = new Map();
  }

  isAllowed(key) {
    const now = Date.now();

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { water: 0, lastLeak: now };
      this.buckets.set(key, bucket);
    }

    // Drain the queue based on elapsed time
    const elapsed = (now - bucket.lastLeak) / 1000;
    bucket.water = Math.max(0, bucket.water - elapsed * this.leakRate);
    bucket.lastLeak = now;

    if (bucket.water < this.capacity) {
      bucket.water += 1;
      return {
        allowed: true,
        queuePosition: Math.ceil(bucket.water),
        estimatedWait: Math.ceil(bucket.water / this.leakRate),
      };
    }

    return {
      allowed: false,
      retryAfter: Math.ceil(1 / this.leakRate),
    };
  }
}

// Using Leaky Bucket as a queue
class LeakyBucketQueue {
  constructor(capacity, processRate) {
    this.capacity = capacity;
    this.processRate = processRate; // Number of items to process per second
    this.queue = [];
    this.processing = false;
  }

  async enqueue(task) {
    if (this.queue.length >= this.capacity) {
      throw new Error('Queue is full. Try again later.');
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.startProcessing();
    });
  }

  startProcessing() {
    if (this.processing) return;
    this.processing = true;

    const interval = 1000 / this.processRate;
    const timer = setInterval(async () => {
      if (this.queue.length === 0) {
        clearInterval(timer);
        this.processing = false;
        return;
      }

      const { task, resolve, reject } = this.queue.shift();
      try {
        const result = await task();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }, interval);
  }
}
```

### 2.6 Algorithm Comparison

```
Comprehensive Comparison of Algorithms:

┌──────────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│                  │ Accuracy │ Memory   │ Impl.    │ Burst    │ Use Case │
├──────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Fixed Window     │ Low      │ Minimum  │ Easiest  │ Boundary │ Simple   │
│                  │          │          │          │ problem  │ limits   │
│ Sliding Log      │ Highest  │ Large    │ Medium   │ None     │ Strict   │
│ Sliding Counter  │ High     │ Small    │ Medium   │ Minimal  │ General  │
│ Token Bucket     │ High     │ Small    │ Medium   │ Allowed  │ API GW   │
│ Leaky Bucket     │ High     │ Medium   │ Moderate │ Smoothed │ Queue    │
└──────────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘

Algorithms used by major services:
  → AWS API Gateway: Token Bucket
  → Nginx: Leaky Bucket (limit_req)
  → GitHub API: Sliding Window
  → Stripe: Token Bucket + Sliding Window
  → Cloudflare: Sliding Window Counter
  → Google Cloud: Token Bucket
```

---

## 3. Distributed Rate Limiting with Redis

### 3.1 Redis Implementation of Sliding Window Counter

```javascript
// Redis implementation of Sliding Window Counter

const Redis = require('ioredis');
const redis = new Redis();

async function slidingWindowRateLimit(key, limit, windowSizeMs) {
  const now = Date.now();
  const windowStart = now - windowSizeMs;

  // Lua script (atomic operation)
  const script = `
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local window_start = tonumber(ARGV[2])
    local limit = tonumber(ARGV[3])
    local window_ms = tonumber(ARGV[4])

    -- Remove expired entries
    redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

    -- Current count
    local count = redis.call('ZCARD', key)

    if count < limit then
      -- Record the request
      redis.call('ZADD', key, now, now .. ':' .. math.random(100000))
      redis.call('PEXPIRE', key, window_ms)
      return {1, limit - count - 1, 0}  -- allowed, remaining, retryAfter
    else
      -- Time of the oldest entry
      local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
      local retry_after = oldest[2] + window_ms - now
      return {0, 0, retry_after}  -- denied, remaining, retryAfter
    end
  `;

  const [allowed, remaining, retryAfter] = await redis.eval(
    script, 1, key, now, windowStart, limit, windowSizeMs
  );

  return {
    allowed: allowed === 1,
    remaining,
    retryAfter: Math.ceil(retryAfter / 1000),
    limit,
    reset: Math.ceil((now + windowSizeMs) / 1000),
  };
}
```

### 3.2 Redis Implementation of Token Bucket

```javascript
// Redis implementation of Token Bucket
async function tokenBucketRateLimit(key, capacity, refillRate) {
  const script = `
    local key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local refill_rate = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])

    local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
    local tokens = tonumber(bucket[1]) or capacity
    local last_refill = tonumber(bucket[2]) or now

    -- Refill tokens
    local elapsed = (now - last_refill) / 1000
    tokens = math.min(capacity, tokens + elapsed * refill_rate)

    if tokens >= 1 then
      tokens = tokens - 1
      redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
      redis.call('PEXPIRE', key, 60000)
      return {1, math.floor(tokens)}
    else
      redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
      redis.call('PEXPIRE', key, 60000)
      local retry_after = (1 - tokens) / refill_rate
      return {0, 0, math.ceil(retry_after)}
    end
  `;

  const result = await redis.eval(script, 1, key, capacity, refillRate, Date.now());
  return { allowed: result[0] === 1, remaining: result[1], retryAfter: result[2] };
}
```

### 3.3 Challenges and Solutions for Distributed Rate Limiting

```
Rate Limiting Challenges in Distributed Environments:

  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ Server 1 │  │ Server 2 │  │ Server 3 │
  │          │  │          │  │          │
  │ count=3  │  │ count=4  │  │ count=2  │
  └────┬─────┘  └────┬─────┘  └────┬─────┘
       │             │             │
       └─────────────┼─────────────┘
                     │
              ┌──────┴──────┐
              │    Redis    │
              │ count = 9   │  ← Centralized management
              └─────────────┘

  Challenge 1: Redis as single point of failure (SPOF)
  → Solution: Redis Cluster / Redis Sentinel
  → Fallback: Local memory-based limiting

  Challenge 2: Network latency
  → Solution: Local buffer + periodic sync
  → Trade-off: Accuracy vs latency

  Challenge 3: Redis consistency
  → Solution: Atomic operations via Lua scripts
  → Do not use WATCH/MULTI/EXEC (not compatible with Cluster)
```

```javascript
// Rate limiter with Redis Cluster support
class DistributedRateLimiter {
  constructor(redisCluster, options) {
    this.redis = redisCluster;
    this.options = options;
    this.localCache = new Map(); // Local fallback
    this.localLimiter = new SlidingWindowCounter(
      options.limit * 1.2, // Local limit is slightly looser
      options.windowMs
    );
  }

  async isAllowed(key) {
    try {
      return await this.checkRedis(key);
    } catch (error) {
      console.warn(`Redis rate limit failed, using local fallback: ${error.message}`);
      return this.checkLocal(key);
    }
  }

  async checkRedis(key) {
    const { limit, windowMs } = this.options;
    return await slidingWindowRateLimit(
      `rate_limit:${key}`,
      limit,
      windowMs
    );
  }

  checkLocal(key) {
    return this.localLimiter.isAllowed(key);
  }
}

// High-availability rate limiting using Redis Sentinel
const redis = new Redis({
  sentinels: [
    { host: 'sentinel-1', port: 26379 },
    { host: 'sentinel-2', port: 26379 },
    { host: 'sentinel-3', port: 26379 },
  ],
  name: 'rate-limit-master',
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
});
```

### 3.4 Distributed Rate Limiting with Local Buffer

```javascript
// Minimize Redis access with local buffer
class BufferedRateLimiter {
  constructor(redis, options) {
    this.redis = redis;
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.batchSize = options.batchSize || 10;   // Buffer 10 requests locally
    this.syncInterval = options.syncInterval || 1000; // Sync every 1 second

    this.localCounters = new Map();
    this.startSync();
  }

  async isAllowed(key) {
    let local = this.localCounters.get(key);
    if (!local) {
      local = { count: 0, quota: this.batchSize, synced: 0 };
      this.localCounters.set(key, local);
      // First time: fetch quota from Redis
      await this.fetchQuota(key, local);
    }

    if (local.count < local.quota) {
      local.count++;
      return { allowed: true, remaining: local.quota - local.count };
    }

    // Local quota exhausted → sync to Redis and fetch more
    await this.syncToRedis(key, local);
    await this.fetchQuota(key, local);

    if (local.count < local.quota) {
      local.count++;
      return { allowed: true, remaining: local.quota - local.count };
    }

    return { allowed: false, remaining: 0 };
  }

  async fetchQuota(key, local) {
    const script = `
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local batch = tonumber(ARGV[2])
      local window_ms = tonumber(ARGV[3])
      local now = tonumber(ARGV[4])

      local current = tonumber(redis.call('GET', key) or '0')
      local available = limit - current

      if available <= 0 then
        return 0
      end

      local grant = math.min(batch, available)
      redis.call('INCRBY', key, grant)

      if redis.call('PTTL', key) == -1 then
        redis.call('PEXPIRE', key, window_ms)
      end

      return grant
    `;

    const granted = await this.redis.eval(
      script, 1, `rate:${key}`,
      this.limit, this.batchSize, this.windowMs, Date.now()
    );

    local.quota = granted;
    local.count = 0;
  }

  async syncToRedis(key, local) {
    // Return unused quota
    const unused = local.quota - local.count;
    if (unused > 0) {
      await this.redis.decrby(`rate:${key}`, unused);
    }
    local.count = 0;
    local.quota = 0;
  }

  startSync() {
    setInterval(async () => {
      for (const [key, local] of this.localCounters.entries()) {
        await this.syncToRedis(key, local);
        await this.fetchQuota(key, local);
      }
    }, this.syncInterval);
  }
}
```

---

## 4. Middleware Implementation

### 4.1 Express Middleware

```javascript
// Express middleware - production quality
function rateLimitMiddleware(options) {
  const {
    limit = 100,
    windowMs = 60000,
    keyGenerator,
    handler,
    skip,
    onLimitReached,
    headers = true,
    draft7Headers = false,
  } = options;

  return async (req, res, next) => {
    // Skip conditions
    if (skip && await skip(req)) {
      return next();
    }

    const key = keyGenerator
      ? keyGenerator(req)
      : `rate_limit:${req.ip}`;

    try {
      const result = await slidingWindowRateLimit(key, limit, windowMs);

      // Set limit information in response headers
      if (headers) {
        res.set({
          'X-RateLimit-Limit': result.limit,
          'X-RateLimit-Remaining': Math.max(0, result.remaining),
          'X-RateLimit-Reset': result.reset,
        });
      }

      // IETF draft-7 headers
      if (draft7Headers) {
        res.set({
          'RateLimit-Limit': result.limit,
          'RateLimit-Remaining': Math.max(0, result.remaining),
          'RateLimit-Reset': Math.ceil((result.reset * 1000 - Date.now()) / 1000),
        });
      }

      if (!result.allowed) {
        res.set('Retry-After', result.retryAfter);

        // Custom handler
        if (onLimitReached) {
          onLimitReached(req, res, result);
        }

        if (handler) {
          return handler(req, res, next, result);
        }

        return res.status(429).json({
          type: 'https://api.example.com/errors/rate-limit',
          title: 'Rate Limit Exceeded',
          status: 429,
          detail: `Rate limit of ${limit} requests per ${windowMs / 1000}s exceeded.`,
          retryAfter: result.retryAfter,
        });
      }

      next();
    } catch (error) {
      // Allow request when rate limiting system errors
      console.error('Rate limit error:', error);
      next();
    }
  };
}

// Usage example: different limits per endpoint
const app = require('express')();

// Global limit
app.use('/api/v1/',
  rateLimitMiddleware({
    limit: 100,
    windowMs: 60000,
    keyGenerator: (req) => `rate:${req.apiKey?.id || req.ip}`,
  })
);

// Login endpoint: strict limit
app.use('/api/v1/auth/login',
  rateLimitMiddleware({
    limit: 5,
    windowMs: 300000,  // 5 minutes
    keyGenerator: (req) => `rate:login:${req.ip}`,
    onLimitReached: (req, res, result) => {
      // Notify security team
      securityAlert('login_rate_limit', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    },
  })
);

// Password reset: even stricter
app.use('/api/v1/auth/reset-password',
  rateLimitMiddleware({
    limit: 3,
    windowMs: 3600000,  // 1 hour
    keyGenerator: (req) => `rate:reset:${req.body?.email || req.ip}`,
  })
);

// File upload: limited due to high resource consumption
app.use('/api/v1/upload',
  rateLimitMiddleware({
    limit: 10,
    windowMs: 3600000,  // 10 files per hour
    keyGenerator: (req) => `rate:upload:${req.userId}`,
  })
);

// Search endpoint: moderate limit
app.use('/api/v1/search',
  rateLimitMiddleware({
    limit: 30,
    windowMs: 60000,
    keyGenerator: (req) => `rate:search:${req.userId || req.ip}`,
    skip: (req) => req.user?.plan === 'enterprise', // Skip for Enterprise
  })
);
```

### 4.2 Plan-Based Rate Limiting

```javascript
// Dynamic rate limiting based on plan
class PlanBasedRateLimiter {
  constructor(redis) {
    this.redis = redis;
    this.plans = {
      free: {
        global: { limit: 100, windowMs: 60000 },
        search: { limit: 10, windowMs: 60000 },
        upload: { limit: 5, windowMs: 3600000 },
        ai: { limit: 20, windowMs: 3600000 },
      },
      pro: {
        global: { limit: 1000, windowMs: 60000 },
        search: { limit: 100, windowMs: 60000 },
        upload: { limit: 50, windowMs: 3600000 },
        ai: { limit: 200, windowMs: 3600000 },
      },
      enterprise: {
        global: { limit: 10000, windowMs: 60000 },
        search: { limit: 1000, windowMs: 60000 },
        upload: { limit: 500, windowMs: 3600000 },
        ai: { limit: 2000, windowMs: 3600000 },
      },
    };
  }

  middleware(endpoint = 'global') {
    return async (req, res, next) => {
      const plan = req.user?.plan || 'free';
      const limits = this.plans[plan]?.[endpoint] || this.plans.free.global;

      const key = `rate:${plan}:${endpoint}:${req.user?.id || req.ip}`;
      const result = await slidingWindowRateLimit(
        key, limits.limit, limits.windowMs
      );

      res.set({
        'X-RateLimit-Limit': limits.limit,
        'X-RateLimit-Remaining': Math.max(0, result.remaining),
        'X-RateLimit-Reset': result.reset,
        'X-RateLimit-Plan': plan,
      });

      if (!result.allowed) {
        res.set('Retry-After', result.retryAfter);
        return res.status(429).json({
          type: 'rate_limit_exceeded',
          message: `${plan} plan limit of ${limits.limit} requests exceeded.`,
          upgrade: plan !== 'enterprise'
            ? 'Upgrade your plan for higher limits: https://example.com/pricing'
            : undefined,
          retryAfter: result.retryAfter,
        });
      }

      next();
    };
  }

  // Dynamic plan updates (reflected immediately on upgrade)
  async updatePlan(userId, newPlan) {
    // Reset cached rate limit information
    const keys = await this.redis.keys(`rate:*:*:${userId}`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

// Usage example
const planLimiter = new PlanBasedRateLimiter(redis);
app.use('/api/v1/', planLimiter.middleware('global'));
app.use('/api/v1/search', planLimiter.middleware('search'));
app.use('/api/v1/upload', planLimiter.middleware('upload'));
app.use('/api/v1/ai', planLimiter.middleware('ai'));
```

### 4.3 Rate Limiting in NestJS

```typescript
// NestJS decorator-based rate limiting
import { SetMetadata, UseGuards, Injectable, CanActivate } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// Custom decorator
export const RATE_LIMIT_KEY = 'rateLimit';

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  keyPrefix?: string;
}

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

// Rate limit guard
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rateLimiter: RateLimiterService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );

    if (!options) return true;

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const key = `${options.keyPrefix || 'rate'}:${request.user?.id || request.ip}`;
    const result = await this.rateLimiter.check(key, options.limit, options.windowMs);

    response.set({
      'X-RateLimit-Limit': options.limit.toString(),
      'X-RateLimit-Remaining': Math.max(0, result.remaining).toString(),
      'X-RateLimit-Reset': result.reset.toString(),
    });

    if (!result.allowed) {
      response.set('Retry-After', result.retryAfter.toString());
      throw new HttpException(
        {
          statusCode: 429,
          message: 'Rate limit exceeded',
          retryAfter: result.retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}

// Usage in controller
@Controller('users')
@UseGuards(RateLimitGuard)
export class UsersController {
  @Get()
  @RateLimit({ limit: 100, windowMs: 60000 })
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @RateLimit({ limit: 20, windowMs: 60000, keyPrefix: 'rate:create' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Post('bulk-import')
  @RateLimit({ limit: 5, windowMs: 3600000, keyPrefix: 'rate:bulk' })
  bulkImport(@Body() dto: BulkImportDto) {
    return this.usersService.bulkImport(dto);
  }
}
```

### 4.4 Rate Limiting Middleware in Go

```go
package ratelimit

import (
    "context"
    "fmt"
    "net/http"
    "strconv"
    "time"

    "github.com/go-redis/redis/v8"
)

// RateLimiter holds rate limiting configuration
type RateLimiter struct {
    redis    *redis.Client
    limit    int
    windowMs int64
}

// Result holds the result of a rate limit check
type Result struct {
    Allowed    bool
    Remaining  int
    RetryAfter int
    Reset      int64
}

// NewRateLimiter creates a new rate limiter instance
func NewRateLimiter(rdb *redis.Client, limit int, windowMs int64) *RateLimiter {
    return &RateLimiter{
        redis:    rdb,
        limit:    limit,
        windowMs: windowMs,
    }
}

// Check performs the rate limit check
func (rl *RateLimiter) Check(ctx context.Context, key string) (*Result, error) {
    now := time.Now().UnixMilli()
    windowStart := now - rl.windowMs

    script := redis.NewScript(`
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local window_start = tonumber(ARGV[2])
        local limit = tonumber(ARGV[3])
        local window_ms = tonumber(ARGV[4])

        redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)
        local count = redis.call('ZCARD', key)

        if count < limit then
            redis.call('ZADD', key, now, now .. ':' .. math.random(100000))
            redis.call('PEXPIRE', key, window_ms)
            return {1, limit - count - 1, 0}
        else
            local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
            local retry_after = 0
            if oldest[2] then
                retry_after = oldest[2] + window_ms - now
            end
            return {0, 0, retry_after}
        end
    `)

    result, err := script.Run(ctx, rl.redis, []string{key},
        now, windowStart, rl.limit, rl.windowMs).Int64Slice()
    if err != nil {
        return nil, fmt.Errorf("rate limit check failed: %w", err)
    }

    return &Result{
        Allowed:    result[0] == 1,
        Remaining:  int(result[1]),
        RetryAfter: int(result[2] / 1000),
        Reset:      (now + rl.windowMs) / 1000,
    }, nil
}

// Middleware applies rate limiting as HTTP middleware
func (rl *RateLimiter) Middleware(keyFn func(*http.Request) string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            key := keyFn(r)
            result, err := rl.Check(r.Context(), key)
            if err != nil {
                // Allow request when rate limiting system errors
                next.ServeHTTP(w, r)
                return
            }

            w.Header().Set("X-RateLimit-Limit", strconv.Itoa(rl.limit))
            w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(result.Remaining))
            w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(result.Reset, 10))

            if !result.Allowed {
                w.Header().Set("Retry-After", strconv.Itoa(result.RetryAfter))
                w.Header().Set("Content-Type", "application/json")
                w.WriteHeader(http.StatusTooManyRequests)
                fmt.Fprintf(w, `{"error":"rate_limit_exceeded","retry_after":%d}`,
                    result.RetryAfter)
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}

// Usage example
func setupRoutes() {
    rdb := redis.NewClient(&redis.Options{Addr: "localhost:6379"})
    limiter := NewRateLimiter(rdb, 100, 60000) // 100 req/min

    mux := http.NewServeMux()
    mux.Handle("/api/",
        limiter.Middleware(func(r *http.Request) string {
            return "rate:" + r.RemoteAddr
        })(apiHandler),
    )
}
```

---

## 5. Response Headers and Error Design

### 5.1 Standard Response Headers

```
Standard Rate Limit Headers (de facto standard):

  X-RateLimit-Limit: 100        ← Limit within window
  X-RateLimit-Remaining: 42     ← Remaining requests
  X-RateLimit-Reset: 1640000000 ← Reset time (Unix seconds)
  Retry-After: 30               ← Seconds until retry (on 429)

IETF Standard (RFC 9110 / draft-ietf-httpapi-ratelimit-headers):
  RateLimit-Limit: 100
  RateLimit-Remaining: 42
  RateLimit-Reset: 30           ← Seconds until reset (not Unix epoch)

  Note: IETF standard RateLimit-Reset is "seconds remaining until reset"
  De facto standard X-RateLimit-Reset is "reset time (Unix epoch seconds)"

Expressing multiple policies:
  RateLimit-Limit: 100, 100;w=60, 1000;w=3600
  → 100 requests per 60 seconds AND 1000 requests per 3600 seconds
```

### 5.2 429 Too Many Requests Response

```
429 Too Many Requests Response Example:

  HTTP/1.1 429 Too Many Requests
  Content-Type: application/problem+json
  Retry-After: 30
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 0
  X-RateLimit-Reset: 1640000030

  {
    "type": "https://api.example.com/errors/rate-limit",
    "title": "Rate Limit Exceeded",
    "status": 429,
    "detail": "You have exceeded the rate limit of 100 requests per minute.",
    "instance": "/api/v1/users",
    "retryAfter": 30,
    "limit": {
      "requests": 100,
      "window": "60s",
      "remaining": 0,
      "reset": "2024-12-21T00:00:30Z"
    },
    "upgrade": {
      "message": "Upgrade to Pro plan for 1000 requests/minute",
      "url": "https://example.com/pricing"
    }
  }

Response example with per-plan limit information:

  {
    "type": "rate_limit_exceeded",
    "status": 429,
    "message": "Free plan rate limit exceeded",
    "limits": {
      "current_plan": "free",
      "limits": {
        "global": "100/min",
        "search": "10/min",
        "upload": "5/hour"
      },
      "usage": {
        "global": { "used": 100, "limit": 100, "reset_in": 30 },
        "search": { "used": 4, "limit": 10, "reset_in": 45 }
      }
    },
    "upgrade_options": [
      { "plan": "pro", "global": "1000/min", "price": "$29/mo" },
      { "plan": "enterprise", "global": "10000/min", "price": "contact us" }
    ]
  }
```

### 5.3 Response Header Helper

```javascript
// Response header helper
class RateLimitHeaders {
  static set(res, result, options = {}) {
    const {
      prefix = 'X-RateLimit',
      includeIetf = false,
      includePlan = false,
      plan = null,
    } = options;

    // De facto standard headers
    res.set({
      [`${prefix}-Limit`]: result.limit.toString(),
      [`${prefix}-Remaining`]: Math.max(0, result.remaining).toString(),
      [`${prefix}-Reset`]: result.reset.toString(),
    });

    // IETF draft headers
    if (includeIetf) {
      const resetInSeconds = Math.max(0, result.reset - Math.floor(Date.now() / 1000));
      res.set({
        'RateLimit-Limit': result.limit.toString(),
        'RateLimit-Remaining': Math.max(0, result.remaining).toString(),
        'RateLimit-Reset': resetInSeconds.toString(),
      });
    }

    // Plan information
    if (includePlan && plan) {
      res.set(`${prefix}-Plan`, plan);
    }

    // For 429
    if (!result.allowed && result.retryAfter > 0) {
      res.set('Retry-After', result.retryAfter.toString());
    }
  }

  static error429(result, options = {}) {
    const { detail, upgrade } = options;

    return {
      type: 'https://api.example.com/errors/rate-limit',
      title: 'Rate Limit Exceeded',
      status: 429,
      detail: detail || `Rate limit of ${result.limit} requests exceeded.`,
      retryAfter: result.retryAfter,
      ...(upgrade ? { upgrade } : {}),
    };
  }
}
```

---

## 6. Client-Side Handling

### 6.1 Retry Strategy

```javascript
// Rate limit handling inside an SDK

async function requestWithRateLimit(fn, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && attempt < maxRetries) {
        const retryAfter = error.headers?.['retry-after']
          ? parseInt(error.headers['retry-after']) * 1000
          : Math.min(1000 * 2 ** attempt, 30000);

        // Add jitter so all clients don't retry at the same time
        const jitter = Math.random() * 1000;
        const delay = retryAfter + jitter;

        console.warn(
          `Rate limited (attempt ${attempt + 1}/${maxRetries}). ` +
          `Retrying in ${Math.round(delay)}ms...`
        );
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
}

// Exponential Backoff with Jitter
class RetryWithBackoff {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 5;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 60000;
    this.jitterFactor = options.jitterFactor || 0.5;
  }

  async execute(fn) {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (!this.isRetryable(error) || attempt === this.maxRetries) {
          throw error;
        }

        const delay = this.calculateDelay(attempt, error);
        console.warn(`Retry attempt ${attempt + 1}/${this.maxRetries} in ${delay}ms`);
        await this.sleep(delay);
      }
    }
  }

  isRetryable(error) {
    return error.status === 429 || error.status >= 500;
  }

  calculateDelay(attempt, error) {
    // Prefer Retry-After header if present
    if (error.headers?.['retry-after']) {
      const retryAfter = parseInt(error.headers['retry-after']);
      if (!isNaN(retryAfter)) {
        return retryAfter * 1000;
      }
    }

    // Exponential backoff with full jitter
    const exponential = this.baseDelay * Math.pow(2, attempt);
    const capped = Math.min(exponential, this.maxDelay);
    const jitter = capped * this.jitterFactor * Math.random();
    return capped + jitter;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage example
const retrier = new RetryWithBackoff({ maxRetries: 5, baseDelay: 1000 });
const result = await retrier.execute(() => fetch('/api/data'));
```

### 6.2 Proactive Rate Limit Handling

```javascript
// Proactive rate limiting
// → Monitor response headers and throttle when remaining count is low
class RateLimitAwareClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || '';
    this.remaining = Infinity;
    this.resetAt = 0;
    this.limit = 0;

    // Proactive throttle settings
    this.throttleThreshold = options.throttleThreshold || 0.1; // Throttle when 10% remaining
    this.requestQueue = [];
    this.processing = false;
  }

  async request(url, options = {}) {
    // Proactively wait if remaining count is low
    if (this.shouldThrottle()) {
      await this.waitForReset();
    }

    const response = await fetch(this.baseUrl + url, options);

    // Update rate limit information from headers
    this.updateLimits(response);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '1');
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      return this.request(url, options); // Retry
    }

    return response;
  }

  shouldThrottle() {
    if (this.limit === 0) return false;
    return this.remaining / this.limit <= this.throttleThreshold;
  }

  async waitForReset() {
    if (this.remaining <= 0 && Date.now() < this.resetAt) {
      const waitMs = this.resetAt - Date.now() + 100; // 100ms buffer
      console.warn(`Proactive throttle: waiting ${waitMs}ms for rate limit reset`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  updateLimits(response) {
    const limit = response.headers.get('X-RateLimit-Limit');
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');

    if (limit) this.limit = parseInt(limit);
    if (remaining) this.remaining = parseInt(remaining);
    if (reset) this.resetAt = parseInt(reset) * 1000;
  }
}

// Optimize batch requests for rate limits
class BatchRequestClient extends RateLimitAwareClient {
  constructor(options = {}) {
    super(options);
    this.batchSize = options.batchSize || 10;
    this.batchDelay = options.batchDelay || 100; // ms between batches
  }

  async batchRequest(urls, options = {}) {
    const results = [];

    for (let i = 0; i < urls.length; i += this.batchSize) {
      const batch = urls.slice(i, i + this.batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(url => this.request(url, options))
      );

      results.push(...batchResults);

      // Add delay between batches
      if (i + this.batchSize < urls.length) {
        // Dynamically adjust delay based on remaining requests
        const delay = this.calculateBatchDelay();
        await new Promise(r => setTimeout(r, delay));
      }
    }

    return results;
  }

  calculateBatchDelay() {
    if (this.remaining <= this.batchSize * 2) {
      // Long delay when remaining is low
      return this.batchDelay * 5;
    }
    if (this.remaining <= this.batchSize * 5) {
      return this.batchDelay * 2;
    }
    return this.batchDelay;
  }
}
```

### 6.3 Python Client Handling

```python
import time
import random
import requests
from functools import wraps
from dataclasses import dataclass
from typing import Optional, Callable


@dataclass
class RateLimitInfo:
    """Rate limit information"""
    limit: int = 0
    remaining: int = float('inf')
    reset_at: float = 0
    retry_after: Optional[int] = None


class RateLimitedClient:
    """HTTP client with rate limit handling"""

    def __init__(self, base_url: str, max_retries: int = 3):
        self.base_url = base_url
        self.max_retries = max_retries
        self.session = requests.Session()
        self.rate_info = RateLimitInfo()

    def get(self, path: str, **kwargs) -> requests.Response:
        return self._request('GET', path, **kwargs)

    def post(self, path: str, **kwargs) -> requests.Response:
        return self._request('POST', path, **kwargs)

    def _request(self, method: str, path: str, **kwargs) -> requests.Response:
        url = f"{self.base_url}{path}"

        for attempt in range(self.max_retries + 1):
            # Proactive wait
            self._proactive_wait()

            try:
                response = self.session.request(method, url, **kwargs)
                self._update_rate_info(response)

                if response.status_code == 429:
                    if attempt < self.max_retries:
                        delay = self._calculate_delay(attempt, response)
                        print(f"Rate limited. Retrying in {delay:.1f}s "
                              f"(attempt {attempt + 1}/{self.max_retries})")
                        time.sleep(delay)
                        continue
                    raise RateLimitError(response)

                return response

            except requests.ConnectionError:
                if attempt < self.max_retries:
                    time.sleep(2 ** attempt)
                    continue
                raise

        raise RateLimitError("Max retries exceeded")

    def _proactive_wait(self):
        """Proactively wait when remaining requests are low"""
        if self.rate_info.remaining <= 1:
            wait_time = self.rate_info.reset_at - time.time()
            if wait_time > 0:
                print(f"Proactive wait: {wait_time:.1f}s")
                time.sleep(wait_time + 0.1)

    def _update_rate_info(self, response: requests.Response):
        """Update rate limit information from response headers"""
        headers = response.headers
        self.rate_info = RateLimitInfo(
            limit=int(headers.get('X-RateLimit-Limit', 0)),
            remaining=int(headers.get('X-RateLimit-Remaining', float('inf'))),
            reset_at=float(headers.get('X-RateLimit-Reset', 0)),
            retry_after=int(headers['Retry-After']) if 'Retry-After' in headers else None,
        )

    def _calculate_delay(self, attempt: int, response: requests.Response) -> float:
        """Calculate delay before retry"""
        retry_after = response.headers.get('Retry-After')
        if retry_after:
            return float(retry_after) + random.uniform(0, 1)

        # Exponential backoff with jitter
        base = min(2 ** attempt, 60)
        jitter = random.uniform(0, base * 0.5)
        return base + jitter


class RateLimitError(Exception):
    """Rate limit error"""
    def __init__(self, response_or_message):
        if isinstance(response_or_message, requests.Response):
            self.response = response_or_message
            self.retry_after = int(
                response_or_message.headers.get('Retry-After', 0)
            )
            super().__init__(
                f"Rate limit exceeded. Retry after {self.retry_after}s"
            )
        else:
            super().__init__(str(response_or_message))


# Usage as a decorator
def rate_limited(max_retries=3, base_delay=1.0):
    """Rate limit handling decorator"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except RateLimitError as e:
                    if attempt < max_retries:
                        delay = e.retry_after or (base_delay * 2 ** attempt)
                        jitter = random.uniform(0, delay * 0.25)
                        time.sleep(delay + jitter)
                        continue
                    raise
        return wrapper
    return decorator


# Usage example
client = RateLimitedClient("https://api.example.com", max_retries=3)

@rate_limited(max_retries=5)
def fetch_users():
    return client.get("/v1/users")

users = fetch_users()
```

---

## 7. Multi-Layer Rate Limiting

### 7.1 Multi-Layer Rate Limiting Design

```
Multi-Layer Rate Limiting Architecture:

  Request
  ↓
  ┌──────────────────────────────────────┐
  │  Layer 1: CDN / Edge Rate Limiting   │ ← Cloudflare, AWS WAF
  │  → IP-based: 1000 req/min            │
  │  → DDoS protection                   │
  └────────────────┬─────────────────────┘
                   ↓
  ┌──────────────────────────────────────┐
  │  Layer 2: API Gateway Rate Limiting  │ ← Kong, AWS API GW
  │  → API Key-based: 500 req/min        │
  │  → Plan-based limits                 │
  └────────────────┬─────────────────────┘
                   ↓
  ┌──────────────────────────────────────┐
  │  Layer 3: Application Rate Limiting  │ ← In-app middleware
  │  → Per user: 100 req/min             │
  │  → Per endpoint: 10 req/min          │
  │  → Per resource operation: 5 req/hr  │
  └────────────────┬─────────────────────┘
                   ↓
  ┌──────────────────────────────────────┐
  │  Layer 4: Service Rate Limiting      │ ← Service-to-service
  │  → Circuit Breaker                   │
  │  → Bulkhead pattern                  │
  └──────────────────────────────────────┘

  Role of each layer:
  Layer 1: Defense against large-scale attacks (coarse filtering)
  Layer 2: API key/plan-based limits (business logic)
  Layer 3: Fine-grained resource protection (application level)
  Layer 4: Internal service protection (service mesh)
```

### 7.2 Composite Rate Limiting Implementation

```javascript
// Combine multiple rate limiters
class CompositeRateLimiter {
  constructor(limiters) {
    this.limiters = limiters; // { name, limiter, key, limit, windowMs }[]
  }

  async isAllowed(request) {
    const results = [];
    let mostRestrictive = null;

    for (const config of this.limiters) {
      const key = typeof config.key === 'function'
        ? config.key(request)
        : config.key;

      const result = await config.limiter.isAllowed(key);
      results.push({ name: config.name, ...result });

      if (!result.allowed) {
        if (!mostRestrictive || result.retryAfter > mostRestrictive.retryAfter) {
          mostRestrictive = { name: config.name, ...result };
        }
      }
    }

    return {
      allowed: results.every(r => r.allowed),
      results,
      mostRestrictive,
    };
  }
}

// Usage example: 3-layer rate limiting
const compositeLimiter = new CompositeRateLimiter([
  {
    name: 'global',
    limiter: new SlidingWindowCounter(1000, 60000),
    key: (req) => `global:${req.ip}`,
  },
  {
    name: 'user',
    limiter: new SlidingWindowCounter(100, 60000),
    key: (req) => `user:${req.userId}`,
  },
  {
    name: 'endpoint',
    limiter: new SlidingWindowCounter(20, 60000),
    key: (req) => `endpoint:${req.userId}:${req.path}`,
  },
]);

// Use as middleware
app.use(async (req, res, next) => {
  const result = await compositeLimiter.isAllowed(req);

  // Set headers with the most restrictive limit info
  const globalResult = result.results.find(r => r.name === 'global');
  res.set({
    'X-RateLimit-Limit': globalResult.limit || 1000,
    'X-RateLimit-Remaining': Math.max(0, globalResult.remaining || 0),
  });

  if (!result.allowed) {
    const { mostRestrictive } = result;
    res.set('Retry-After', mostRestrictive.retryAfter);
    return res.status(429).json({
      error: 'rate_limit_exceeded',
      limitType: mostRestrictive.name,
      retryAfter: mostRestrictive.retryAfter,
    });
  }

  next();
});
```

### 7.3 Dynamic Rate Limiting

```javascript
// Dynamic rate limiting based on server load
class AdaptiveRateLimiter {
  constructor(redis, options) {
    this.redis = redis;
    this.baseLimit = options.limit;
    this.windowMs = options.windowMs;
    this.currentMultiplier = 1.0;

    // Periodically check server load
    this.startHealthCheck(options.healthCheckInterval || 10000);
  }

  async isAllowed(key) {
    const effectiveLimit = Math.floor(this.baseLimit * this.currentMultiplier);
    return await slidingWindowRateLimit(key, effectiveLimit, this.windowMs);
  }

  startHealthCheck(interval) {
    setInterval(async () => {
      const health = await this.checkServerHealth();
      this.adjustMultiplier(health);
    }, interval);
  }

  async checkServerHealth() {
    // Collect server metrics
    const os = require('os');
    const cpuUsage = os.loadavg()[0] / os.cpus().length;
    const memUsage = 1 - os.freemem() / os.totalmem();

    // External metrics (e.g., DB connection pool usage)
    const dbPoolUsage = await this.getDbPoolUsage();

    return { cpuUsage, memUsage, dbPoolUsage };
  }

  adjustMultiplier(health) {
    const { cpuUsage, memUsage, dbPoolUsage } = health;
    const maxUsage = Math.max(cpuUsage, memUsage, dbPoolUsage);

    if (maxUsage > 0.9) {
      // Critical level: significantly reduce limit
      this.currentMultiplier = 0.3;
      console.warn('CRITICAL: Rate limit reduced to 30%');
    } else if (maxUsage > 0.8) {
      // High load: reduce limit
      this.currentMultiplier = 0.5;
      console.warn('HIGH LOAD: Rate limit reduced to 50%');
    } else if (maxUsage > 0.6) {
      // Slightly high: reduce slightly
      this.currentMultiplier = 0.8;
    } else {
      // Normal: full limit
      this.currentMultiplier = 1.0;
    }
  }

  async getDbPoolUsage() {
    // Get DB connection pool usage (example)
    try {
      const result = await this.redis.get('metrics:db_pool_usage');
      return parseFloat(result) || 0;
    } catch {
      return 0;
    }
  }
}
```

---

## 8. Rate Limiting in Nginx / API Gateway

### 8.1 Nginx Rate Limiting Configuration

```nginx
# Nginx rate limiting configuration

# Define rate limiting zones
http {
    # IP-based rate limiting
    # binary_remote_addr: binary representation of client IP
    # zone=api_limit:10m: shared memory zone (10MB ≈ 160,000 IP addresses)
    # rate=10r/s: 10 requests per second
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

    # API Key-based rate limiting
    map $http_x_api_key $api_key {
        default $http_x_api_key;
        "" $binary_remote_addr;
    }
    limit_req_zone $api_key zone=api_key_limit:10m rate=100r/s;

    # Composite limit by endpoint × IP
    limit_req_zone $binary_remote_addr zone=login_limit:5m rate=1r/s;
    limit_req_zone $binary_remote_addr zone=search_limit:5m rate=5r/s;

    # Status code when rate limit is exceeded
    limit_req_status 429;

    # Rate limit log level
    limit_req_log_level warn;

    server {
        listen 80;

        # Global rate limit
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            # burst=20: allow burst of up to 20 requests
            # nodelay: process burst requests immediately (no queuing)

            proxy_pass http://backend;
        }

        # Login endpoint: strict limit
        location /api/auth/login {
            limit_req zone=login_limit burst=5;
            # burst=5: queue up to 5 requests
            # no nodelay: queue and process in order

            proxy_pass http://backend;
        }

        # Search endpoint
        location /api/search {
            limit_req zone=search_limit burst=10 nodelay;
            proxy_pass http://backend;
        }

        # Customize 429 response
        error_page 429 = @rate_limited;
        location @rate_limited {
            default_type application/json;
            return 429 '{"error":"rate_limit_exceeded","message":"Too many requests"}';
        }
    }
}
```

### 8.2 AWS API Gateway Rate Limiting

```
AWS API Gateway Rate Limiting:

  Controlled via Usage Plans:
  ┌────────────────────────────────────────┐
  │           Usage Plan: Free             │
  │                                        │
  │  Throttle:                             │
  │    Rate Limit: 10 req/sec              │
  │    Burst Limit: 20 requests            │
  │                                        │
  │  Quota:                                │
  │    Limit: 10,000 requests              │
  │    Period: MONTH                        │
  │    Offset: 0 (reset at month start)    │
  │                                        │
  │  API Keys: [key-001, key-002, ...]     │
  └────────────────────────────────────────┘

  ┌────────────────────────────────────────┐
  │           Usage Plan: Pro              │
  │                                        │
  │  Throttle:                             │
  │    Rate Limit: 100 req/sec             │
  │    Burst Limit: 200 requests           │
  │                                        │
  │  Quota:                                │
  │    Limit: 1,000,000 requests           │
  │    Period: MONTH                        │
  │                                        │
  │  API Keys: [key-101, key-102, ...]     │
  └────────────────────────────────────────┘
```

```yaml
# Rate limiting configuration in AWS SAM template
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  ApiGateway:
    Type: AWS::Serverless::Api
    Properties:
      StageName: prod
      # Method-level throttling
      MethodSettings:
        - HttpMethod: '*'
          ResourcePath: '/*'
          ThrottlingBurstLimit: 100
          ThrottlingRateLimit: 50
        - HttpMethod: POST
          ResourcePath: '/auth/login'
          ThrottlingBurstLimit: 10
          ThrottlingRateLimit: 5

  # Usage Plan
  FreePlan:
    Type: AWS::ApiGateway::UsagePlan
    Properties:
      UsagePlanName: free
      Throttle:
        BurstLimit: 20
        RateLimit: 10
      Quota:
        Limit: 10000
        Period: MONTH
      ApiStages:
        - ApiId: !Ref ApiGateway
          Stage: prod

  ProPlan:
    Type: AWS::ApiGateway::UsagePlan
    Properties:
      UsagePlanName: pro
      Throttle:
        BurstLimit: 200
        RateLimit: 100
      Quota:
        Limit: 1000000
        Period: MONTH
      ApiStages:
        - ApiId: !Ref ApiGateway
          Stage: prod
```

### 8.3 Kong Rate Limiting Plugin

```yaml
# Kong rate limiting plugin configuration
plugins:
  - name: rate-limiting
    config:
      # Policy: local, cluster, redis
      policy: redis
      redis_host: redis-host
      redis_port: 6379
      redis_database: 0
      redis_timeout: 2000

      # Limit values (multiple time windows can be configured simultaneously)
      second: 10        # 10 req/sec
      minute: 100       # 100 req/min
      hour: 5000        # 5000 req/hour
      day: 100000       # 100000 req/day

      # Header settings
      hide_client_headers: false  # Return X-RateLimit-* headers

      # Response when limit is exceeded
      error_code: 429
      error_message: "Rate limit exceeded"

  # Endpoint-specific limits
  - name: rate-limiting
    route: login-route
    config:
      policy: redis
      redis_host: redis-host
      minute: 5
      hour: 50
      error_message: "Too many login attempts"

  # Per-consumer limits
  - name: rate-limiting
    consumer: free-tier
    config:
      policy: redis
      redis_host: redis-host
      minute: 60
      hour: 1000

  - name: rate-limiting
    consumer: pro-tier
    config:
      policy: redis
      redis_host: redis-host
      minute: 600
      hour: 10000
```

---

## 9. Testing and Monitoring

### 9.1 Testing Rate Limits

```javascript
// Rate limit testing with Jest
const { describe, it, expect, beforeEach } = require('@jest/globals');

describe('SlidingWindowCounter', () => {
  let limiter;

  beforeEach(() => {
    limiter = new SlidingWindowCounter(10, 60000); // 10 req/min
  });

  it('should allow requests within the limit', () => {
    const key = 'test-user';
    for (let i = 0; i < 10; i++) {
      const result = limiter.isAllowed(key);
      expect(result.allowed).toBe(true);
    }
  });

  it('should deny requests exceeding the limit', () => {
    const key = 'test-user';
    // Exhaust the limit
    for (let i = 0; i < 10; i++) {
      limiter.isAllowed(key);
    }
    // 11th should be denied
    const result = limiter.isAllowed(key);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('should track remaining count correctly', () => {
    const key = 'test-user';
    for (let i = 0; i < 5; i++) {
      const result = limiter.isAllowed(key);
      expect(result.remaining).toBe(10 - i - 1);
    }
  });

  it('should isolate different keys', () => {
    for (let i = 0; i < 10; i++) {
      limiter.isAllowed('user-a');
    }
    // user-b should not be affected
    const result = limiter.isAllowed('user-b');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });
});

// Integration test: rate limiting with Redis
describe('Redis Rate Limiting Integration', () => {
  let redis;

  beforeAll(async () => {
    redis = new Redis({ host: 'localhost', port: 6379, db: 15 });
    await redis.flushdb();
  });

  afterAll(async () => {
    await redis.flushdb();
    await redis.quit();
  });

  it('should rate limit across multiple calls', async () => {
    const key = 'test:integration:user1';
    const limit = 5;
    const windowMs = 10000;

    // 5 requests are allowed
    for (let i = 0; i < limit; i++) {
      const result = await slidingWindowRateLimit(key, limit, windowMs);
      expect(result.allowed).toBe(true);
    }

    // 6th is denied
    const result = await slidingWindowRateLimit(key, limit, windowMs);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('should reset after window expires', async () => {
    const key = 'test:integration:user2';
    const limit = 3;
    const windowMs = 2000; // 2-second window

    // Exhaust the limit
    for (let i = 0; i < limit; i++) {
      await slidingWindowRateLimit(key, limit, windowMs);
    }

    // Wait for the window to expire
    await new Promise(r => setTimeout(r, 2100));

    // Allowed after reset
    const result = await slidingWindowRateLimit(key, limit, windowMs);
    expect(result.allowed).toBe(true);
  });
});

// Load test: verify rate limiting behavior
describe('Rate Limit Load Test', () => {
  it('should handle concurrent requests correctly', async () => {
    const key = 'test:concurrent';
    const limit = 50;
    const windowMs = 60000;
    const concurrency = 100;

    const results = await Promise.all(
      Array(concurrency).fill(null).map(() =>
        slidingWindowRateLimit(key, limit, windowMs)
      )
    );

    const allowed = results.filter(r => r.allowed).length;
    const denied = results.filter(r => !r.allowed).length;

    expect(allowed).toBe(limit);
    expect(denied).toBe(concurrency - limit);
  });
});
```

### 9.2 Load Test Script

```bash
#!/bin/bash
# Rate limiting load test

API_URL="http://localhost:3000/api/v1/users"
API_KEY="test-api-key"
REQUESTS=200
CONCURRENT=20

echo "=== Rate Limit Load Test ==="
echo "URL: $API_URL"
echo "Total Requests: $REQUESTS"
echo "Concurrency: $CONCURRENT"
echo ""

# Using Apache Bench
ab -n $REQUESTS -c $CONCURRENT \
   -H "X-API-Key: $API_KEY" \
   -H "Accept: application/json" \
   "$API_URL" 2>/dev/null | grep -E "(Requests per|Time per|Failed|Non-2xx)"

echo ""
echo "=== Checking Rate Limit Headers ==="
for i in $(seq 1 5); do
  echo "--- Request $i ---"
  curl -s -o /dev/null -w "Status: %{http_code}\n" \
       -H "X-API-Key: $API_KEY" \
       -D - "$API_URL" 2>/dev/null | grep -iE "(X-RateLimit|Retry-After|HTTP)"
  echo ""
done
```

```python
# Python load test (asyncio-based)
import asyncio
import aiohttp
import time
from collections import Counter


async def rate_limit_load_test(
    url: str,
    total_requests: int = 200,
    concurrency: int = 20,
    api_key: str = None,
):
    """Rate limiting load test"""
    results = Counter()
    headers = {}
    if api_key:
        headers['X-API-Key'] = api_key

    semaphore = asyncio.Semaphore(concurrency)
    rate_limit_info = {'last_remaining': None, 'last_reset': None}

    async def make_request(session, i):
        async with semaphore:
            try:
                async with session.get(url, headers=headers) as resp:
                    results[resp.status] += 1

                    # Record rate limit headers
                    remaining = resp.headers.get('X-RateLimit-Remaining')
                    if remaining:
                        rate_limit_info['last_remaining'] = remaining
                    reset_at = resp.headers.get('X-RateLimit-Reset')
                    if reset_at:
                        rate_limit_info['last_reset'] = reset_at

                    if resp.status == 429:
                        retry_after = resp.headers.get('Retry-After', 'N/A')
                        results['retry_after'] = retry_after

            except Exception as e:
                results['error'] += 1

    start_time = time.time()

    async with aiohttp.ClientSession() as session:
        tasks = [make_request(session, i) for i in range(total_requests)]
        await asyncio.gather(*tasks)

    elapsed = time.time() - start_time

    print(f"\n{'='*50}")
    print(f"Rate Limit Load Test Results")
    print(f"{'='*50}")
    print(f"Total Requests: {total_requests}")
    print(f"Concurrency: {concurrency}")
    print(f"Duration: {elapsed:.2f}s")
    print(f"Throughput: {total_requests/elapsed:.1f} req/s")
    print(f"\nStatus Code Distribution:")
    for status, count in sorted(results.items()):
        if isinstance(status, int):
            print(f"  {status}: {count} ({count/total_requests*100:.1f}%)")
    print(f"\nLast Rate Limit Info:")
    print(f"  Remaining: {rate_limit_info['last_remaining']}")
    print(f"  Reset At: {rate_limit_info['last_reset']}")

    if 'retry_after' in results:
        print(f"  Retry-After: {results['retry_after']}s")


# Run
asyncio.run(rate_limit_load_test(
    url="http://localhost:3000/api/v1/users",
    total_requests=200,
    concurrency=20,
    api_key="test-key",
))
```

### 9.3 Monitoring and Alerts

```javascript
// Rate limit monitoring
class RateLimitMonitor {
  constructor(redis, metricsClient) {
    this.redis = redis;
    this.metrics = metricsClient; // Prometheus, DataDog, etc.
  }

  async recordResult(key, result, metadata = {}) {
    const { endpoint, userId, plan, ip } = metadata;

    // Record metrics
    if (result.allowed) {
      this.metrics.increment('rate_limit.allowed', {
        endpoint,
        plan,
      });
    } else {
      this.metrics.increment('rate_limit.denied', {
        endpoint,
        plan,
      });

      // Record denial count in Redis (for alerts)
      const denyKey = `rate_limit:denied:${key}`;
      const denyCount = await this.redis.incr(denyKey);
      await this.redis.expire(denyKey, 300); // 5 minutes

      // High denial rate in short time → alert
      if (denyCount >= 50) {
        this.alert({
          level: 'warning',
          message: `High rate limit denial rate for ${key}`,
          details: {
            denyCount,
            endpoint,
            userId,
            ip,
            plan,
          },
        });
      }
    }

    // Gauge for remaining requests
    this.metrics.gauge('rate_limit.remaining', result.remaining, {
      endpoint,
      plan,
    });
  }

  alert(alertData) {
    console.warn('RATE LIMIT ALERT:', JSON.stringify(alertData));

    // Notify Slack, PagerDuty, etc.
    // this.notifier.send(alertData);
  }
}

// Prometheus metrics
const promClient = require('prom-client');

const rateLimitAllowed = new promClient.Counter({
  name: 'api_rate_limit_allowed_total',
  help: 'Number of requests allowed by rate limiter',
  labelNames: ['endpoint', 'plan'],
});

const rateLimitDenied = new promClient.Counter({
  name: 'api_rate_limit_denied_total',
  help: 'Number of requests denied by rate limiter',
  labelNames: ['endpoint', 'plan'],
});

const rateLimitRemaining = new promClient.Gauge({
  name: 'api_rate_limit_remaining',
  help: 'Remaining requests in current rate limit window',
  labelNames: ['endpoint', 'plan', 'user_id'],
});

// Queries for Grafana dashboard (PromQL)
/*
  # Rate limit denial rate
  rate(api_rate_limit_denied_total[5m])
  / (rate(api_rate_limit_allowed_total[5m]) + rate(api_rate_limit_denied_total[5m]))

  # Denial rate per endpoint
  rate(api_rate_limit_denied_total{endpoint=~".*"}[5m])

  # Limit-reached rate per plan
  api_rate_limit_remaining{plan="free"} == 0
*/
```

---

## 10. Practical Patterns and Best Practices

### 10.1 Whitelist/Blacklist

```javascript
// Whitelist/Blacklist support
class RateLimiterWithACL {
  constructor(redis, options) {
    this.redis = redis;
    this.limiter = new SlidingWindowCounter(options.limit, options.windowMs);
    this.whitelist = new Set(options.whitelist || []);
    this.blacklist = new Set(options.blacklist || []);
  }

  async isAllowed(key, metadata = {}) {
    // Blacklist: immediately denied
    if (this.blacklist.has(key) || this.blacklist.has(metadata.ip)) {
      return { allowed: false, reason: 'blacklisted', retryAfter: -1 };
    }

    // Whitelist: skip rate limiting
    if (this.whitelist.has(key) || this.whitelist.has(metadata.ip)) {
      return { allowed: true, reason: 'whitelisted', remaining: Infinity };
    }

    // Normal rate limit check
    return this.limiter.isAllowed(key);
  }

  // Dynamically update whitelist/blacklist
  async refreshACL() {
    const whitelistKeys = await this.redis.smembers('rate_limit:whitelist');
    const blacklistKeys = await this.redis.smembers('rate_limit:blacklist');

    this.whitelist = new Set(whitelistKeys);
    this.blacklist = new Set(blacklistKeys);
  }

  async addToBlacklist(key, ttlSeconds = 3600) {
    await this.redis.sadd('rate_limit:blacklist', key);
    if (ttlSeconds > 0) {
      // Auto-remove after a set duration
      setTimeout(() => {
        this.redis.srem('rate_limit:blacklist', key);
        this.blacklist.delete(key);
      }, ttlSeconds * 1000);
    }
    this.blacklist.add(key);
  }
}
```

### 10.2 Graceful Degradation

```javascript
// Fallback strategy when Redis is down
class ResilientRateLimiter {
  constructor(options) {
    this.redis = options.redis;
    this.localLimiter = new SlidingWindowCounter(
      options.limit * 1.5, // Local limit is slightly looser
      options.windowMs
    );
    this.redisLimiter = null;
    this.redisAvailable = true;
    this.healthCheckInterval = options.healthCheckInterval || 5000;

    this.startHealthCheck();
  }

  async isAllowed(key) {
    if (this.redisAvailable) {
      try {
        const result = await Promise.race([
          slidingWindowRateLimit(key, this.limit, this.windowMs),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Redis timeout')), 100)
          ),
        ]);
        return result;
      } catch (error) {
        console.warn('Redis rate limit failed, falling back to local:', error.message);
        this.redisAvailable = false;
        return this.localLimiter.isAllowed(key);
      }
    }

    return this.localLimiter.isAllowed(key);
  }

  startHealthCheck() {
    setInterval(async () => {
      try {
        await this.redis.ping();
        if (!this.redisAvailable) {
          console.info('Redis rate limit recovered');
          this.redisAvailable = true;
        }
      } catch {
        this.redisAvailable = false;
      }
    }, this.healthCheckInterval);
  }
}
```

### 10.3 Preventing Rate Limit Bypass

```
Attack Methods and Countermeasures for Bypassing Rate Limits:

  ① IP rotation:
     Attack: Requests from a large number of IP addresses
     Countermeasures:
     → Limit not only per IP but also per user/API key
     → Detect abnormal behavior patterns
     → Introduce CAPTCHA

  ② Header spoofing:
     Attack: Spoofing the X-Forwarded-For header
     Countermeasures:
     → Only use X-Forwarded-For from trusted proxies
     → Prioritize the direct connection IP

  ③ Account creation bots:
     Attack: Create many accounts to distribute rate limits
     Countermeasures:
     → CAPTCHA for account creation
     → Strict limits on new accounts
     → Device fingerprinting

  ④ Slow Rate Attack:
     Attack: Continue requests at just below the limit
     Countermeasures:
     → Limit across multiple time windows (second/minute/hour/day)
     → Detect abnormal patterns

  ⑤ API Key sharing:
     Attack: Multiple clients reuse the same API key
     Countermeasures:
     → Limit concurrent connections per API key
     → Detect anomalies in usage patterns
```

```javascript
// IP spoofing countermeasure: get the real client IP
function getClientIp(req) {
  // List of trusted proxy IPs
  const trustedProxies = new Set([
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
  ]);

  // Use X-Forwarded-For only if it comes from a trusted proxy
  if (req.headers['x-forwarded-for'] && isTrustedProxy(req.socket.remoteAddress, trustedProxies)) {
    const forwardedFor = req.headers['x-forwarded-for'].split(',');
    // The leftmost IP is the original client IP
    return forwardedFor[0].trim();
  }

  // Otherwise use the direct connection IP
  return req.socket.remoteAddress;
}

// Rate limit key with device fingerprint
function generateRateLimitKey(req) {
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';
  const acceptLanguage = req.headers['accept-language'] || '';

  // Generate fingerprint
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${ip}:${userAgent}:${acceptLanguage}`)
    .digest('hex')
    .substring(0, 16);

  return `rate:fp:${fingerprint}`;
}
```

### 10.4 Rate Limiting for Cost Control

```javascript
// Cost control for external API calls
class CostAwareRateLimiter {
  constructor(redis, options) {
    this.redis = redis;
    this.costLimits = options.costLimits;
    // Example: { daily: 100.00, monthly: 2000.00 } (USD)
  }

  async isAllowed(key, estimatedCost) {
    const now = new Date();
    const dayKey = `cost:daily:${key}:${now.toISOString().split('T')[0]}`;
    const monthKey = `cost:monthly:${key}:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Check daily cost
    const dailyCost = parseFloat(await this.redis.get(dayKey) || '0');
    if (dailyCost + estimatedCost > this.costLimits.daily) {
      return {
        allowed: false,
        reason: 'daily_cost_limit',
        currentCost: dailyCost,
        limit: this.costLimits.daily,
      };
    }

    // Check monthly cost
    const monthlyCost = parseFloat(await this.redis.get(monthKey) || '0');
    if (monthlyCost + estimatedCost > this.costLimits.monthly) {
      return {
        allowed: false,
        reason: 'monthly_cost_limit',
        currentCost: monthlyCost,
        limit: this.costLimits.monthly,
      };
    }

    // Record cost
    await this.redis.incrbyfloat(dayKey, estimatedCost);
    await this.redis.expire(dayKey, 86400 * 2); // Expire after 2 days
    await this.redis.incrbyfloat(monthKey, estimatedCost);
    await this.redis.expire(monthKey, 86400 * 35); // Expire after 35 days

    return {
      allowed: true,
      dailyCost: dailyCost + estimatedCost,
      monthlyCost: monthlyCost + estimatedCost,
      dailyRemaining: this.costLimits.daily - dailyCost - estimatedCost,
      monthlyRemaining: this.costLimits.monthly - monthlyCost - estimatedCost,
    };
  }
}

// Usage example: cost control for OpenAI API
const costLimiter = new CostAwareRateLimiter(redis, {
  costLimits: { daily: 50.00, monthly: 1000.00 },
});

app.post('/api/ai/generate', async (req, res) => {
  const estimatedTokens = estimateTokenCount(req.body.prompt);
  const estimatedCost = estimatedTokens * 0.00002; // $0.02/1K tokens

  const result = await costLimiter.isAllowed(req.userId, estimatedCost);

  if (!result.allowed) {
    return res.status(429).json({
      error: 'cost_limit_exceeded',
      reason: result.reason,
      currentCost: result.currentCost,
      limit: result.limit,
    });
  }

  // Call AI API
  const aiResult = await callOpenAI(req.body.prompt);

  // Update with actual cost (if different from estimate)
  const actualCost = aiResult.usage.total_tokens * 0.00002;
  if (actualCost !== estimatedCost) {
    const diff = actualCost - estimatedCost;
    await redis.incrbyfloat(`cost:daily:${req.userId}:${today}`, diff);
    await redis.incrbyfloat(`cost:monthly:${req.userId}:${month}`, diff);
  }

  res.json(aiResult);
});
```

---

## FAQ

### Q1: How do I determine appropriate rate limit thresholds?

**A:** Thresholds are determined by comprehensively considering the following factors.

```
Approaches to Determining Thresholds:

  ① Data analysis-based:
     → Calculate 95th percentile usage from past access logs
     → Add 20–30% buffer to the maximum value of normal usage patterns
     → Account for variation by time of day and day of week

  ② Resource-based:
     → Back-calculate from server capacity (CPU, memory, DB connections)
     → Measure actual limits through load testing
     → Consider backend service limits

  ③ Business requirement-based:
     → Free plan: 1000 req/hour (basic usage)
     → Standard plan: 10000 req/hour (normal usage)
     → Premium plan: 100000 req/hour (large-scale usage)
     → Enterprise: custom limits

  ④ Gradual adjustment:
     → Start with lenient thresholds (warnings only)
     → Gradually optimize while monitoring metrics
     → Measure impact with A/B testing
```

Practical example:
```javascript
// Plan-based rate limit configuration example
const rateLimits = {
  free: {
    perSecond: 1,    // Suppress bursts
    perMinute: 20,   // Short-term limit
    perHour: 1000,   // Total per hour
    perDay: 10000    // Total per day
  },
  standard: {
    perSecond: 10,
    perMinute: 300,
    perHour: 10000,
    perDay: 200000
  },
  premium: {
    perSecond: 100,
    perMinute: 3000,
    perHour: 100000,
    perDay: 2000000
  }
};
```

### Q2: How do I implement rate limiting in a distributed environment (Redis, etc.)?

**A:** A shared state store must be used in distributed environments.

```
Implementation Patterns for Distributed Rate Limiting:

  ① Redis-based (most common):
     → Counter management with INCR + EXPIRE
     → Atomic operations with Lua scripts
     → High availability with cluster configuration

  ② Local cache + Redis (hybrid):
     → Fast processing of short-term limits in local memory
     → Aggregation of long-term limits in Redis
     → Fallback functionality when Redis fails

  ③ API Gateway (managed service):
     → AWS API Gateway usage plans
     → Google Cloud Endpoints quotas
     → OSS API Gateways like Kong, Tyk
```

Redis implementation example:
```javascript
// Redis + Sliding Window Counter
const rateLimiter = {
  async checkLimit(userId, limit, windowSeconds) {
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);
    const key = `ratelimit:${userId}:${windowSeconds}`;

    // Execute atomically with Lua script
    const script = `
      local current = redis.call('ZCOUNT', KEYS[1], ARGV[1], ARGV[2])
      if current < tonumber(ARGV[3]) then
        redis.call('ZADD', KEYS[1], ARGV[2], ARGV[2])
        redis.call('EXPIRE', KEYS[1], ARGV[4])
        return 1
      else
        return 0
      end
    `;

    const allowed = await redis.eval(
      script,
      1,
      key,
      windowStart,
      now,
      limit,
      windowSeconds
    );

    return allowed === 1;
  }
};

// Redis Cluster-compatible version
const Redis = require('ioredis');
const cluster = new Redis.Cluster([
  { host: 'redis-node-1', port: 6379 },
  { host: 'redis-node-2', port: 6379 },
  { host: 'redis-node-3', port: 6379 }
], {
  redisOptions: {
    password: process.env.REDIS_PASSWORD
  }
});
```

Combining with local cache:
```javascript
class HybridRateLimiter {
  constructor() {
    this.localCache = new Map(); // Short-term limits (per second)
    this.redis = new Redis(redisConfig); // Long-term limits (per minute/hour)
  }

  async checkLimit(userId, limits) {
    // Check per-second limit locally (fast)
    const localKey = `${userId}:second`;
    const localCount = this.localCache.get(localKey) || 0;
    if (localCount >= limits.perSecond) {
      return { allowed: false, reason: 'second_limit' };
    }

    // Check per-minute/hour limits in Redis
    const redisAllowed = await this.checkRedisLimits(userId, limits);
    if (!redisAllowed.allowed) {
      return redisAllowed;
    }

    // If both pass, increment count
    this.localCache.set(localKey, localCount + 1);
    setTimeout(() => this.localCache.delete(localKey), 1000);

    return { allowed: true };
  }
}
```

### Q3: What is the appropriate response to a rate-limited client?

**A:** It is important to return information that allows the client to respond appropriately.

```
Appropriate Response Design:

  ① HTTP status code:
     → 429 Too Many Requests (required)
     → 503 Service Unavailable (when server is overloaded)

  ② Response headers (becoming standardized):
     → X-RateLimit-Limit: 1000
     → X-RateLimit-Remaining: 0
     → X-RateLimit-Reset: 1677649200 (Unix timestamp)
     → Retry-After: 60 (seconds or HTTP date)

  ③ Error message:
     → Clear explanation of the reason
     → Information on when to retry
     → Support contact (if necessary)
```

Implementation example:
```javascript
// Express middleware
app.use(async (req, res, next) => {
  const userId = req.user?.id || req.ip;
  const limit = getUserLimit(req.user);

  const result = await rateLimiter.check(userId, limit);

  // Always add headers
  res.set({
    'X-RateLimit-Limit': limit.perHour,
    'X-RateLimit-Remaining': result.remaining,
    'X-RateLimit-Reset': result.resetTime
  });

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);

    return res.status(429)
      .set('Retry-After', retryAfter)
      .json({
        error: 'rate_limit_exceeded',
        message: `Rate limit exceeded. Please retry after ${retryAfter} seconds.`,
        limit: limit.perHour,
        remaining: 0,
        resetTime: new Date(result.resetTime).toISOString(),
        retryAfter: retryAfter,
        documentation: 'https://api.example.com/docs/rate-limits'
      });
  }

  next();
});
```

Client-side handling example:
```javascript
// Client-side retry logic
async function apiCallWithRetry(url, options = {}) {
  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const response = await fetch(url, options);

      // Log rate limit headers
      console.log('Rate limit remaining:',
        response.headers.get('X-RateLimit-Remaining'));

      if (response.status === 429) {
        const retryAfter = parseInt(
          response.headers.get('Retry-After') || '60'
        );

        console.log(`Rate limited. Retrying after ${retryAfter}s`);
        await sleep(retryAfter * 1000);
        retries++;
        continue;
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  throw new Error('Max retries exceeded');
}

// Exponential Backoff version
async function apiCallWithBackoff(url, options = {}) {
  let delay = 1000; // Initial wait time
  const maxDelay = 32000; // Maximum wait time

  while (true) {
    const response = await fetch(url, options);

    if (response.status !== 429) {
      return await response.json();
    }

    // Prefer Retry-After header if present
    const retryAfter = response.headers.get('Retry-After');
    if (retryAfter) {
      delay = parseInt(retryAfter) * 1000;
    } else {
      delay = Math.min(delay * 2, maxDelay); // Increase exponentially
    }

    await sleep(delay + Math.random() * 1000); // Add jitter
  }
}
```

---

## Summary

| Algorithm | Characteristics | Memory | Accuracy | Use Case |
|-----------|----------------|--------|----------|----------|
| Fixed Window | Simple, boundary burst problem | Minimum | Low | Simple limits |
| Sliding Window Log | Accurate but high memory use | Large | Highest | Strict limits |
| Sliding Window Counter | Balance of accuracy and memory | Small | High | General API |
| Token Bucket | Allows burst, flexible | Small | High | API GW, Nginx |
| Leaky Bucket | Constant output, smoothing | Medium | High | Queue processing |

```
Recommended Configuration in Practice:

  ① Small-scale API (< 1000 req/min):
     → In-memory Fixed Window is sufficient
     → Redis not needed for a single server

  ② Mid-scale API (1000–10000 req/min):
     → Redis + Sliding Window Counter
     → Plan-based rate limiting

  ③ Large-scale API (> 10000 req/min):
     → Multi-layer rate limiting (CDN + API GW + App)
     → Distributed rate limiting with local buffer
     → Dynamic rate limiting (load-adaptive)

  ④ Microservices:
     → Service mesh rate limiting (Istio, Envoy)
     → Integration with Circuit Breaker
     → Local limit per service + global limit
```

---

## Next Guide to Read
→ [Input Validation](./02-input-validation.md)

---

## References
1. Stripe. "Rate Limiting." stripe.com/docs, 2024.
2. Cloudflare. "Rate Limiting Best Practices." blog.cloudflare.com, 2024.
3. draft-ietf-httpapi-ratelimit-headers. IETF, 2024.
4. Kong. "Rate Limiting Plugin." docs.konghq.com, 2024.
5. AWS. "API Gateway Throttling." docs.aws.amazon.com, 2024.
6. Google Cloud. "Rate Limiting Strategies." cloud.google.com/architecture, 2024.
7. Redis. "Rate Limiting with Redis." redis.io/glossary, 2024.

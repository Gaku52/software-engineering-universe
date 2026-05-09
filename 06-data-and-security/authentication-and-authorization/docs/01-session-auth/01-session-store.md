# Session Store

> The choice of session data storage is directly tied to application scalability and performance. This guide comprehensively covers the characteristics and selection criteria for memory, Redis, and database session stores; scalable session management using Redis; session ID generation, validation, and rotation; and session sharing strategies in distributed environments.

## What You Will Learn

- [ ] Understand the types of session stores and their selection criteria
- [ ] Fully grasp the design and implementation of a Redis session store
- [ ] Learn schema design and optimization for database session stores
- [ ] Understand scaling strategies and session persistence/replication
- [ ] Practice session ID generation requirements and security hardening techniques

### Prerequisites

- Asynchronous processing in Node.js / TypeScript
- Basic Redis operations (GET / SET / DEL / EXPIRE)

---

## 1. Overview of Session Stores

### 1.1 Why Does the Choice of Session Store Matter?

```
Role of a session store:

  ┌────────────────┐      ┌────────────────┐      ┌────────────────┐
  │    Browser     │      │   Web Server   │      │ Session Store  │
  │                │      │               │      │               │
  │  Cookie:       │─────→│  Session ID   │─────→│  Fetch/Save    │
  │  sess_id       │      │  validation   │      │  Session Data  │
  │                │      │               │      │               │
  └────────────────┘      └────────────────┘      └────────────────┘

  Requirements for a session store:
  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │  ① Fast Read/Write (executed on every request)     │
  │  ② Scalability (shared across multiple servers)    │
  │  ③ Persistence (survives server restarts)          │
  │  ④ TTL (automatic expiry management)               │
  │  ⑤ Concurrent access consistency (prevent races)  │
  │  ⑥ Security (data encryption and access control)  │
  │                                                    │
  └────────────────────────────────────────────────────┘

  What happens if you choose wrong:
    → In-memory store in production → all users logged out on server restart
    → DB store under high traffic → increased latency and DB overload
    → Store failure → all users unable to access
```

### 1.2 Comparison of Session Stores

```
Session store types and detailed comparison:

  ┌───────────┬────────┬──────────┬────────┬──────────┬────────────────┐
  │ Store     │ Speed  │ Scale    │ Persist│ TTL Mgmt │ Use Case       │
  ├───────────┼────────┼──────────┼────────┼──────────┼────────────────┤
  │ Memory    │ ◎ Best │ ✗ No     │ ✗      │ Manual   │ Dev/Single srv │
  │ Redis     │ ○ Fast │ ✓ Yes    │ △      │ ✓ Auto   │ Production rec │
  │ PostgreSQL│ △ Med  │ ✓ Yes    │ ✓      │ Manual   │ No extra infra │
  │ MySQL     │ △ Med  │ ✓ Yes    │ ✓      │ Manual   │ MySQL envs     │
  │ MongoDB   │ △ Med  │ ✓ Yes    │ ✓      │ ✓ TTL idx│ Using MongoDB  │
  │ DynamoDB  │ ○ Fast │ ✓ Auto   │ ✓      │ ✓ TTL   │ AWS envs       │
  │ Memcached │ ◎ Fast │ ✓ Yes    │ ✗      │ ✓ Auto   │ Pure cache     │
  │ Cookie    │ ◎ Best │ ✓ Auto   │ ✓      │ ✓ Cookie │ JWT/small data │
  └───────────┴────────┴──────────┴────────┴──────────┴────────────────┘

  Latency comparison (reference values):
  ┌───────────┬──────────────────┬───────────────────┐
  │ Store     │ Read (p50)       │ Read (p99)         │
  ├───────────┼──────────────────┼───────────────────┤
  │ Memory    │ < 0.01 ms        │ < 0.1 ms          │
  │ Redis     │ 0.1 - 0.5 ms     │ 1 - 5 ms          │
  │ Memcached │ 0.1 - 0.5 ms     │ 1 - 3 ms          │
  │ DynamoDB  │ 1 - 5 ms         │ 10 - 25 ms        │
  │ PostgreSQL│ 1 - 10 ms        │ 20 - 50 ms        │
  │ MongoDB   │ 1 - 10 ms        │ 20 - 50 ms        │
  │ Cookie    │ 0 ms (no network)│ 0 ms              │
  └───────────┴──────────────────┴───────────────────┘

  ※ Varies by network latency, data size, and concurrent connections
```

### 1.3 Selection Flowchart

```
Decision process for selecting a session store:

  Start
  │
  ├─ Development environment? ──Yes──→ In-memory store
  │
  ├─ Serverless (Vercel/Lambda)?
  │   ├─ Yes → Cookie-based (JWT) or DynamoDB / Upstash Redis
  │   └─ No ↓
  │
  ├─ Already using Redis?
  │   ├─ Yes → Redis session store (first choice)
  │   └─ No ↓
  │
  ├─ Want to avoid additional infrastructure?
  │   ├─ Yes → Database session store
  │   └─ No ↓
  │
  ├─ High traffic (1000+ req/sec)?
  │   ├─ Yes → Redis (Sentinel/Cluster)
  │   └─ No → Database session store is also viable
  │
  └─ AWS environment? → DynamoDB + DAX (cache)

  Recommendation:
  → Redis is the optimal choice in most cases
  → If Redis cannot be added, use DB sessions
  → For serverless, use Upstash Redis or Cookie-based
```

---

## 2. In-Memory Session Store

### 2.1 Implementation and Caveats

```typescript
// In-memory session store implementation
// For development environments and prototypes. Do NOT use in production.

interface SessionData {
  userId: string;
  role: string;
  createdAt: number;
  lastAccessedAt: number;
  metadata: Record<string, unknown>;
}

class InMemorySessionStore {
  private sessions: Map<string, { data: SessionData; expiresAt: number }> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(private cleanupIntervalMs: number = 60_000) {
    // Periodic cleanup (prevent memory leaks)
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);
  }

  async set(sessionId: string, data: SessionData, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.sessions.set(sessionId, { data, expiresAt });

    // User → session mapping
    if (!this.userSessions.has(data.userId)) {
      this.userSessions.set(data.userId, new Set());
    }
    this.userSessions.get(data.userId)!.add(sessionId);
  }

  async get(sessionId: string): Promise<SessionData | null> {
    const entry = this.sessions.get(sessionId);
    if (!entry) return null;

    // Check expiry
    if (entry.expiresAt < Date.now()) {
      this.sessions.delete(sessionId);
      return null;
    }

    return entry.data;
  }

  async delete(sessionId: string): Promise<void> {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      const userSet = this.userSessions.get(entry.data.userId);
      userSet?.delete(sessionId);
      if (userSet?.size === 0) {
        this.userSessions.delete(entry.data.userId);
      }
    }
    this.sessions.delete(sessionId);
  }

  async deleteAllForUser(userId: string): Promise<void> {
    const sessionIds = this.userSessions.get(userId);
    if (sessionIds) {
      for (const id of sessionIds) {
        this.sessions.delete(id);
      }
      this.userSessions.delete(userId);
    }
  }

  async count(): Promise<number> {
    return this.sessions.size;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, entry] of this.sessions) {
      if (entry.expiresAt < now) {
        this.delete(id);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.sessions.clear();
    this.userSessions.clear();
  }
}
```

```
Limitations of the in-memory store:

  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │  ✗ All sessions lost on server restart             │
  │  ✗ Cannot be shared across multiple servers        │
  │  ✗ Memory usage can grow indefinitely              │
  │  ✗ Limited by the Node.js process heap size        │
  │                                                    │
  │  Assuming 1 session ≈ 1KB:                         │
  │  → 10,000 sessions ≈ 10 MB                         │
  │  → 100,000 sessions ≈ 100 MB                       │
  │  → 1,000,000 sessions ≈ 1 GB                       │
  │                                                    │
  │  Node.js default heap: ~1.5 GB                     │
  │  → Risk of out-of-memory at 1 million sessions     │
  │                                                    │
  └────────────────────────────────────────────────────┘
```

---

## 3. Redis Session Store

### 3.1 Why Redis Is the Optimal Choice

```
Why Redis is ideal for a session store:

  ① In-memory + persistence:
     → Data is processed in memory (fast)
     → Can be persisted with RDB / AOF (survives restarts)

  ② Automatic TTL management:
     → Auto-deletion via SETEX / EXPIRE commands
     → No cleanup batch jobs needed

  ③ Rich data structures:
     → String: session data (JSON)
     → Set: all session IDs for a user
     → Hash: field-level operations within a session
     → Sorted Set: session list (ordered by last access)

  ④ Atomic operations:
     → MULTI/EXEC: transactions
     → Lua scripts: atomic execution of compound operations
     → Prevents race conditions

  ⑤ Scaling:
     → Sentinel: high availability (automatic failover)
     → Cluster: horizontal scaling (sharding)
     → Pub/Sub: notifications for session invalidation

  Redis commands related to sessions:
  ┌──────────────┬─────────────────────────────────────┐
  │ Command      │ Purpose                             │
  ├──────────────┼─────────────────────────────────────┤
  │ SETEX        │ Save session + set TTL              │
  │ GET          │ Retrieve session                    │
  │ DEL          │ Delete session                      │
  │ EXPIRE       │ Update TTL (Sliding Expiration)     │
  │ TTL          │ Check remaining expiry time         │
  │ SADD/SMEMBERS│ Set operations for user sessions    │
  │ SREM         │ Remove session ID from Set          │
  │ PIPELINE     │ Batch execution of multiple commands│
  │ SCAN         │ Safe key enumeration (alt to KEYS)  │
  └──────────────┴─────────────────────────────────────┘
```

### 3.2 Complete Redis Session Store Implementation

```typescript
// Complete Redis session store implementation
import Redis from 'ioredis';
import { randomBytes, createHash } from 'crypto';

interface SessionData {
  userId: string;
  role: string;
  createdAt: number;
  lastAccessedAt: number;
  ip: string;
  userAgent: string;
  metadata: Record<string, unknown>;
}

interface SessionEntry {
  id: string;
  data: SessionData;
  ttl: number;  // remaining seconds
}

class RedisSessionStore {
  private redis: Redis;
  private readonly prefix: string;
  private readonly userPrefix: string;
  private readonly defaultTtl: number;

  constructor(options: {
    redisUrl: string;
    prefix?: string;
    defaultTtl?: number;
  }) {
    this.redis = new Redis(options.redisUrl, {
      // Connection robustness
      retryStrategy: (times) => {
        if (times > 10) return null; // give up after 10 attempts
        return Math.min(times * 100, 3000); // wait up to 3 seconds
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      // Performance
      lazyConnect: true,
      keepAlive: 10000,
      connectTimeout: 5000,
    });

    this.prefix = options.prefix ?? 'sess:';
    this.userPrefix = `${this.prefix}user:`;
    this.defaultTtl = options.defaultTtl ?? 86400; // 24 hours

    // Error handling
    this.redis.on('error', (err) => {
      console.error('[SessionStore] Redis error:', err);
    });

    this.redis.on('connect', () => {
      console.log('[SessionStore] Redis connected');
    });
  }

  // Save session
  async set(
    sessionId: string,
    data: SessionData,
    ttl: number = this.defaultTtl
  ): Promise<void> {
    const key = this.prefix + sessionId;
    const userKey = this.userPrefix + data.userId;
    const serialized = JSON.stringify(data);

    // Execute multiple operations atomically via Pipeline
    const pipeline = this.redis.pipeline();

    // Save session data (with TTL)
    pipeline.setex(key, ttl, serialized);

    // User → session ID mapping (Set)
    pipeline.sadd(userKey, sessionId);
    pipeline.expire(userKey, ttl);

    const results = await pipeline.exec();

    // Error check
    if (results) {
      for (const [err] of results) {
        if (err) throw err;
      }
    }
  }

  // Retrieve session
  async get(sessionId: string): Promise<SessionData | null> {
    const key = this.prefix + sessionId;
    const data = await this.redis.get(key);

    if (!data) return null;

    try {
      return JSON.parse(data) as SessionData;
    } catch {
      // Delete if data is malformed
      await this.redis.del(key);
      return null;
    }
  }

  // Retrieve session + extend TTL (Sliding Expiration)
  async getAndRefresh(
    sessionId: string,
    ttl: number = this.defaultTtl
  ): Promise<SessionData | null> {
    const key = this.prefix + sessionId;

    // Atomically retrieve + update TTL using a Lua script
    const luaScript = `
      local data = redis.call('GET', KEYS[1])
      if data then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
        return data
      end
      return nil
    `;

    const data = await this.redis.eval(
      luaScript,
      1,
      key,
      ttl
    ) as string | null;

    if (!data) return null;

    try {
      const session = JSON.parse(data) as SessionData;
      // Update lastAccessedAt
      session.lastAccessedAt = Date.now();
      await this.redis.setex(key, ttl, JSON.stringify(session));
      return session;
    } catch {
      return null;
    }
  }

  // Delete session (logout)
  async delete(sessionId: string): Promise<void> {
    const key = this.prefix + sessionId;
    const data = await this.get(sessionId);

    const pipeline = this.redis.pipeline();
    pipeline.del(key);

    if (data) {
      // Also remove from user's session Set
      pipeline.srem(this.userPrefix + data.userId, sessionId);
    }

    await pipeline.exec();
  }

  // Get all sessions for a user (active session list)
  async findByUserId(userId: string): Promise<SessionEntry[]> {
    const userKey = this.userPrefix + userId;
    const sessionIds = await this.redis.smembers(userKey);

    if (sessionIds.length === 0) return [];

    // Batch fetch via Pipeline (avoid N+1 problem)
    const pipeline = this.redis.pipeline();
    for (const id of sessionIds) {
      pipeline.get(this.prefix + id);
      pipeline.ttl(this.prefix + id);
    }

    const results = await pipeline.exec();
    if (!results) return [];

    const sessions: SessionEntry[] = [];
    const expiredIds: string[] = [];

    for (let i = 0; i < sessionIds.length; i++) {
      const [getErr, data] = results[i * 2];
      const [ttlErr, ttl] = results[i * 2 + 1];

      if (getErr || ttlErr || !data || (ttl as number) <= 0) {
        // Expired or error
        expiredIds.push(sessionIds[i]);
        continue;
      }

      try {
        sessions.push({
          id: sessionIds[i],
          data: JSON.parse(data as string),
          ttl: ttl as number,
        });
      } catch {
        expiredIds.push(sessionIds[i]);
      }
    }

    // Remove expired session IDs from Set
    if (expiredIds.length > 0) {
      const cleanPipeline = this.redis.pipeline();
      for (const id of expiredIds) {
        cleanPipeline.srem(userKey, id);
      }
      await cleanPipeline.exec();
    }

    return sessions;
  }

  // Delete all sessions for a user (on password change, logout all devices)
  async deleteAllForUser(userId: string): Promise<number> {
    const userKey = this.userPrefix + userId;
    const sessionIds = await this.redis.smembers(userKey);

    if (sessionIds.length === 0) return 0;

    const pipeline = this.redis.pipeline();
    for (const id of sessionIds) {
      pipeline.del(this.prefix + id);
    }
    pipeline.del(userKey);

    await pipeline.exec();
    return sessionIds.length;
  }

  // Delete all sessions except the current one (logout other devices)
  async deleteOthersForUser(
    userId: string,
    currentSessionId: string
  ): Promise<number> {
    const userKey = this.userPrefix + userId;
    const sessionIds = await this.redis.smembers(userKey);

    const toDelete = sessionIds.filter((id) => id !== currentSessionId);
    if (toDelete.length === 0) return 0;

    const pipeline = this.redis.pipeline();
    for (const id of toDelete) {
      pipeline.del(this.prefix + id);
      pipeline.srem(userKey, id);
    }

    await pipeline.exec();
    return toDelete.length;
  }

  // Get session count (SCAN-based, safe for production)
  async count(): Promise<number> {
    let count = 0;
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        `${this.prefix}*`,
        'COUNT',
        100
      );
      cursor = nextCursor;
      // Exclude user: prefix
      count += keys.filter((k) => !k.startsWith(this.userPrefix)).length;
    } while (cursor !== '0');

    return count;
  }

  // Check connection health
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  // Clean shutdown
  async close(): Promise<void> {
    await this.redis.quit();
  }
}
```

### 3.3 Redis Connection Options in Detail

```typescript
// Detailed explanation of ioredis connection settings
import Redis, { RedisOptions } from 'ioredis';

// Development environment
const devOptions: RedisOptions = {
  host: 'localhost',
  port: 6379,
  db: 0, // DB for sessions
};

// Production environment (single node)
const prodOptions: RedisOptions = {
  host: process.env.REDIS_HOST!,
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,

  // TLS settings (Redis 6+)
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,

  // Connection pool
  lazyConnect: true,     // wait until explicit connect() call
  keepAlive: 10000,      // TCP KeepAlive (milliseconds)
  connectTimeout: 5000,  // connection timeout

  // Command retry
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 20) return null; // give up
    return Math.min(times * 200, 5000);
  },

  // Reconnect
  reconnectOnError: (err) => {
    const targetErrors = ['READONLY', 'ECONNREFUSED'];
    return targetErrors.some((e) => err.message.includes(e));
  },
};

// Upstash Redis (for serverless)
import { Redis as UpstashRedis } from '@upstash/redis';

const upstashRedis = new UpstashRedis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
// Note: Upstash is HTTP-based, so ioredis Pipeline/Lua cannot be used
// → Use the @upstash/redis-specific API instead

// Elasticache (AWS)
const elasticacheOptions: RedisOptions = {
  host: process.env.ELASTICACHE_ENDPOINT!,
  port: 6379,
  tls: {},
  // Elasticache may not require a password (VPC internal access)
};
```

### 3.4 Sliding Expiration vs. Absolute Expiration

```
Two approaches to session expiry:

  ① Sliding Expiration:
  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │  Expiry resets on every access                     │
  │                                                    │
  │  Time ──────────────────────────────────────→      │
  │  ├──────┤ access                                   │
  │         ├──────┤ access                            │
  │                ├──────┤ access                     │
  │                       ├──────┤ expired             │
  │                                                    │
  │  Advantage: Active users are not logged out        │
  │  Disadvantage: Session may extend indefinitely     │
  │                                                    │
  └────────────────────────────────────────────────────┘

  ② Absolute Expiration:
  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │  Expires at a fixed time from creation             │
  │                                                    │
  │  Time ──────────────────────────────────────→      │
  │  ├─────────────────────────────┤ expired (fixed)  │
  │  ├──┤ access                                       │
  │      ├──┤ access (not extended)                    │
  │          ├──┤ access                               │
  │                                                    │
  │  Advantage: Limits the time window of hijacking    │
  │  Disadvantage: Forced logout even when active      │
  │                                                    │
  └────────────────────────────────────────────────────┘

  ③ Recommended: Hybrid approach
  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │  Sliding: 30 minutes (logout on inactivity)        │
  │  Absolute: 24 hours (maximum session lifetime)     │
  │  → Expire at whichever limit comes first           │
  │                                                    │
  └────────────────────────────────────────────────────┘
```

```typescript
// Hybrid expiration implementation
class HybridExpirationSessionStore extends RedisSessionStore {
  private readonly slidingTtl: number;   // inactivity timeout (seconds)
  private readonly absoluteTtl: number;  // maximum session lifetime (seconds)

  constructor(options: {
    redisUrl: string;
    slidingTtl?: number;
    absoluteTtl?: number;
  }) {
    super({ redisUrl: options.redisUrl });
    this.slidingTtl = options.slidingTtl ?? 1800;    // 30 minutes
    this.absoluteTtl = options.absoluteTtl ?? 86400;  // 24 hours
  }

  async getWithHybridExpiration(sessionId: string): Promise<SessionData | null> {
    const data = await this.get(sessionId);
    if (!data) return null;

    // Absolute Expiration check
    const sessionAge = Date.now() - data.createdAt;
    if (sessionAge > this.absoluteTtl * 1000) {
      await this.delete(sessionId);
      return null;
    }

    // Sliding Expiration: calculate remaining time
    const remainingAbsolute = Math.ceil(
      (this.absoluteTtl * 1000 - sessionAge) / 1000
    );
    const ttl = Math.min(this.slidingTtl, remainingAbsolute);

    // Update TTL
    await this.set(sessionId, {
      ...data,
      lastAccessedAt: Date.now(),
    }, ttl);

    return data;
  }
}
```

---

## 4. Database Session Store

### 4.1 Prisma Schema Design

```prisma
// schema.prisma - Optimal session table design

model Session {
  id            String   @id @default(cuid())
  sessionToken  String   @unique @map("session_token")
  userId        String   @map("user_id")
  data          Json?    // Additional session data
  expiresAt     DateTime @map("expires_at")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  // Session metadata
  ipAddress     String?  @map("ip_address")
  userAgent     String?  @map("user_agent")
  deviceName    String?  @map("device_name")
  lastAccessedAt DateTime? @map("last_accessed_at")

  // Relations
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Indexes
  @@index([userId])                    // search sessions by user
  @@index([expiresAt])                 // speed up expiry cleanup
  @@index([userId, expiresAt])         // find active sessions for a user
  @@map("sessions")
}

// Importance of indexes:
// ① userId: fetch all sessions for a user (prevent O(n) scan)
// ② expiresAt: speed up WHERE clause in cleanup batch
// ③ composite index: search valid sessions for a specific user
```

### 4.2 Complete Database Session Store Implementation

```typescript
// Complete database session store implementation using Prisma

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'warn', 'error']
    : ['error'],
});

class DatabaseSessionStore {
  // Save session (Upsert: update if exists, create if not)
  async set(
    sessionId: string,
    data: SessionData,
    ttl: number
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + ttl * 1000);

    await prisma.session.upsert({
      where: { sessionToken: sessionId },
      create: {
        sessionToken: sessionId,
        userId: data.userId,
        data: data as unknown as Prisma.JsonObject,
        expiresAt,
        ipAddress: data.ip,
        userAgent: data.userAgent,
        lastAccessedAt: new Date(),
      },
      update: {
        data: data as unknown as Prisma.JsonObject,
        expiresAt,
        lastAccessedAt: new Date(),
      },
    });
  }

  // Retrieve session (with expiry check)
  async get(sessionId: string): Promise<SessionData | null> {
    const session = await prisma.session.findFirst({
      where: {
        sessionToken: sessionId,
        expiresAt: { gt: new Date() },  // only within expiry
      },
    });

    if (!session) return null;

    return session.data as unknown as SessionData;
  }

  // Retrieve session + Sliding Expiration
  async getAndRefresh(
    sessionId: string,
    ttl: number
  ): Promise<SessionData | null> {
    // Atomically fetch and update in a transaction
    const session = await prisma.$transaction(async (tx) => {
      const found = await tx.session.findFirst({
        where: {
          sessionToken: sessionId,
          expiresAt: { gt: new Date() },
        },
      });

      if (!found) return null;

      // Extend expiry
      await tx.session.update({
        where: { id: found.id },
        data: {
          expiresAt: new Date(Date.now() + ttl * 1000),
          lastAccessedAt: new Date(),
        },
      });

      return found;
    });

    if (!session) return null;
    return session.data as unknown as SessionData;
  }

  // Delete session
  async delete(sessionId: string): Promise<void> {
    await prisma.session.deleteMany({
      where: { sessionToken: sessionId },
    });
  }

  // Get all sessions for a user
  async findByUserId(userId: string): Promise<Array<{
    id: string;
    sessionToken: string;
    data: SessionData;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    lastAccessedAt: Date | null;
  }>> {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastAccessedAt: 'desc' },
    });

    return sessions.map((s) => ({
      id: s.id,
      sessionToken: s.sessionToken,
      data: s.data as unknown as SessionData,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      lastAccessedAt: s.lastAccessedAt,
    }));
  }

  // Delete all sessions for a user
  async deleteAllForUser(userId: string): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: { userId },
    });
    return result.count;
  }

  // Cleanup expired sessions (batch delete)
  async cleanup(batchSize: number = 1000): Promise<number> {
    let totalDeleted = 0;

    // Delete in batches to prevent table locks
    while (true) {
      const result = await prisma.$executeRaw`
        DELETE FROM sessions
        WHERE expires_at < NOW()
        LIMIT ${batchSize}
      `;

      totalDeleted += result;

      // Done when fewer than batchSize rows are deleted
      if (result < batchSize) break;

      // Yield CPU to other queries with a brief pause
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return totalDeleted;
  }

  // Count active sessions
  async count(): Promise<number> {
    return prisma.session.count({
      where: { expiresAt: { gt: new Date() } },
    });
  }

  // Count active sessions for a user
  async countByUser(userId: string): Promise<number> {
    return prisma.session.count({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
    });
  }
}
```

### 4.3 Periodic Cleanup Implementation

```typescript
// Cleanup of expired sessions via cron job

// ① Using a Node.js cron library
import { CronJob } from 'cron';

const store = new DatabaseSessionStore();

// Run at minute 0 of every hour
const cleanupJob = new CronJob('0 * * * *', async () => {
  const startTime = Date.now();

  try {
    const deletedCount = await store.cleanup();
    const elapsed = Date.now() - startTime;

    console.log(
      `[Session Cleanup] Deleted ${deletedCount} expired sessions in ${elapsed}ms`
    );

    // Record metrics (Prometheus, etc.)
    sessionCleanupCounter.inc(deletedCount);
    sessionCleanupDuration.observe(elapsed / 1000);
  } catch (error) {
    console.error('[Session Cleanup] Failed:', error);
  }
});

cleanupJob.start();

// ② Using native PostgreSQL features
// Use the pg_cron extension (available on Supabase, RDS, etc.)
// SELECT cron.schedule(
//   'cleanup_expired_sessions',
//   '0 * * * *',
//   $$DELETE FROM sessions WHERE expires_at < NOW()$$
// );

// ③ Using Vercel Cron Jobs
// vercel.json:
// {
//   "crons": [{
//     "path": "/api/cron/cleanup-sessions",
//     "schedule": "0 * * * *"
//   }]
// }

// app/api/cron/cleanup-sessions/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Verify Vercel Cron authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const store = new DatabaseSessionStore();
  const count = await store.cleanup();

  return NextResponse.json({ deletedCount: count });
}
```

---

## 5. Scaling Strategies

### 5.1 Scaling with Redis

```
Overview of sessions and scaling:

  ┌─────────────────────────────────────────────────────┐
  │                Load Balancer                        │
  │          (Round Robin / Least Connections)          │
  └───────────┬───────────┬───────────┬────────────────┘
              │           │           │
  ┌───────────┴┐ ┌────────┴──┐ ┌─────┴──────┐
  │ Server A   │ │ Server B  │ │ Server C   │
  │ (stateless)│ │ (stateless)│ │ (stateless)│
  └──────┬─────┘ └─────┬─────┘ └─────┬──────┘
         │             │             │
         └──────────┬──┴─────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
    ┌────┴────┐          ┌────┴────┐
    │ Redis   │          │ Redis   │
    │ Primary │──────────│ Replica │
    │ (Write) │  replicate│ (Read) │
    └────┬────┘          └─────────┘
         │
    ┌────┴────┐
    │ Redis   │
    │ Sentinel│  monitor + automatic failover
    └─────────┘

  Comparison of scaling strategies:

  ┌──────────────────┬──────────────┬──────────────┬──────────────┐
  │ Approach         │ Availability │ Complexity   │ Scale        │
  ├──────────────────┼──────────────┼──────────────┼──────────────┤
  │ Single Redis     │ Low          │ Low          │ Small        │
  │ Redis Sentinel   │ High         │ Medium       │ Medium-Large │
  │ Redis Cluster    │ High         │ High         │ Large        │
  │ Upstash Redis    │ High         │ Low          │ Serverless   │
  │ Elasticache      │ High         │ Low (AWS)    │ AWS envs     │
  └──────────────────┴──────────────┴──────────────┴──────────────┘
```

### 5.2 Redis Sentinel Configuration (High Availability)

```typescript
// Redis Sentinel configuration
import Redis from 'ioredis';

const redis = new Redis({
  sentinels: [
    { host: 'sentinel-1.internal', port: 26379 },
    { host: 'sentinel-2.internal', port: 26379 },
    { host: 'sentinel-3.internal', port: 26379 },
  ],
  name: 'mymaster',  // master name
  sentinelPassword: process.env.REDIS_SENTINEL_PASSWORD,
  password: process.env.REDIS_PASSWORD,

  // Behavior during failover
  sentinelRetryStrategy: (times) => {
    return Math.min(times * 100, 3000);
  },

  // Reading from Read Replica
  role: 'master',  // writes go to master only
  // configure preferredSlaves to distribute reads to replicas
});

// Monitor failover events
redis.on('reconnecting', () => {
  console.log('[Redis] Reconnecting...');
});

redis.on('+failover-end', () => {
  console.log('[Redis] Failover completed');
});
```

### 5.3 Redis Cluster Configuration (Horizontal Scaling)

```typescript
// Redis Cluster configuration
import Redis from 'ioredis';

const cluster = new Redis.Cluster(
  [
    { host: 'cluster-1.internal', port: 6379 },
    { host: 'cluster-2.internal', port: 6379 },
    { host: 'cluster-3.internal', port: 6379 },
  ],
  {
    // Cluster-specific options
    clusterRetryStrategy: (times) => {
      return Math.min(times * 100, 3000);
    },
    redisOptions: {
      password: process.env.REDIS_PASSWORD,
      tls: {},
    },
    // Distribute reads
    scaleReads: 'slave', // read from replicas
    // scaleReads: 'all'   // read from all nodes
  }
);

// Notes when using Cluster:
// ① KEYS command is unavailable → use SCAN
// ② Pipeline keys must belong to the same slot
//    → use hash tags like {user:123}:session
// ③ Lua script keys are also subject to the same-slot constraint
// ④ MULTI/EXEC also has same-slot constraint

// Key design using hash tags (place in the same slot)
class ClusterAwareSessionStore {
  private prefix(userId: string): string {
    // Use hash tag {userId} to keep all keys for the same user in one slot
    return `{sess:${userId}}:`;
  }

  async set(sessionId: string, data: SessionData, ttl: number): Promise<void> {
    const key = `${this.prefix(data.userId)}${sessionId}`;
    const userKey = `${this.prefix(data.userId)}sessions`;

    // Pipeline is allowed because of the same hash tag
    const pipeline = cluster.pipeline();
    pipeline.setex(key, ttl, JSON.stringify(data));
    pipeline.sadd(userKey, sessionId);
    pipeline.expire(userKey, ttl);
    await pipeline.exec();
  }
}
```

### 5.4 Upstash Redis (For Serverless)

```typescript
// Session store using Upstash Redis
// Ideal for serverless environments (Vercel, Cloudflare Workers)

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

class UpstashSessionStore {
  private prefix = 'sess:';

  async set(sessionId: string, data: SessionData, ttl: number): Promise<void> {
    const key = this.prefix + sessionId;

    // Upstash is HTTP-based, so Pipeline syntax differs slightly
    const pipeline = redis.pipeline();
    pipeline.setex(key, ttl, JSON.stringify(data));
    pipeline.sadd(`user:${data.userId}:sessions`, sessionId);
    pipeline.expire(`user:${data.userId}:sessions`, ttl);

    await pipeline.exec();
  }

  async get(sessionId: string): Promise<SessionData | null> {
    const key = this.prefix + sessionId;
    const data = await redis.get<string>(key);
    if (!data) return null;

    return typeof data === 'string' ? JSON.parse(data) : data;
  }

  async delete(sessionId: string): Promise<void> {
    const data = await this.get(sessionId);
    const key = this.prefix + sessionId;

    const pipeline = redis.pipeline();
    pipeline.del(key);
    if (data) {
      pipeline.srem(`user:${data.userId}:sessions`, sessionId);
    }
    await pipeline.exec();
  }
}

// Notes: Upstash limitations
// → Each command is an HTTP request
// → Multiple commands can be batched with Pipeline
// → Lua scripts are also available (with limitations)
// → Free tier: 10,000 commands/day
// → Pro: pay-as-you-go ($0.2 / 100,000 commands)
```

---

## 6. Session ID Generation and Security

### 6.1 Session ID Requirements

```
Session ID security requirements (OWASP-compliant):

  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │  ① Sufficient length:                              │
  │     → Minimum 128 bits (256 bits recommended)      │
  │     → 32–43 characters in Base64 encoding          │
  │                                                    │
  │  ② Cryptographically random:                       │
  │     → Use crypto.randomBytes()                     │
  │     → Math.random() is not acceptable (predictable)│
  │     → UUID v4 is sufficient (122 bits of randomness)│
  │                                                    │
  │  ③ Unpredictable:                                  │
  │     → Sequential IDs are not acceptable            │
  │     → Timestamp-based IDs are not acceptable       │
  │     → Cannot infer the next ID from previous ones  │
  │                                                    │
  │  ④ Collision resistance:                           │
  │     → At 256 bits, collision probability is        │
  │        astronomically low                          │
  │     → 50% collision probability at 2^128 sessions  │
  │                                                    │
  └────────────────────────────────────────────────────┘

  Time required for brute-force attempts (reference):
  ┌──────────┬──────────────────┬────────────────────────┐
  │ Bits     │ Possible values  │ At 1M attempts/sec      │
  ├──────────┼──────────────────┼────────────────────────┤
  │ 64-bit   │ 1.8 × 10^19      │ ≈ 585,000 years        │
  │ 128-bit  │ 3.4 × 10^38      │ ≈ 10^25 years          │
  │ 256-bit  │ 1.2 × 10^77      │ ≈ 10^64 years          │
  └──────────┴──────────────────┴────────────────────────┘
```

### 6.2 Session ID Generation Implementation

```typescript
// Secure session ID generation
import { randomBytes, createHash, createHmac } from 'crypto';

// Method 1: Random bytes (simplest)
function generateSessionId(): string {
  return randomBytes(32).toString('base64url');
  // Example result: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2"
  // 256 bits of randomness
}

// Method 2: With HMAC (tamper detection)
function generateSignedSessionId(secret: string): string {
  const id = randomBytes(32).toString('hex');
  const signature = createHmac('sha256', secret)
    .update(id)
    .digest('base64url');

  return `${id}.${signature}`;
}

function verifySignedSessionId(
  signedId: string,
  secret: string
): string | null {
  const [id, signature] = signedId.split('.');
  if (!id || !signature) return null;

  const expectedSignature = createHmac('sha256', secret)
    .update(id)
    .digest('base64url');

  // Use constant-time comparison to prevent timing attacks
  const expected = Buffer.from(expectedSignature);
  const actual = Buffer.from(signature);

  if (expected.length !== actual.length) return null;

  // crypto.timingSafeEqual requires Buffers of the same length
  if (!require('crypto').timingSafeEqual(expected, actual)) {
    return null;
  }

  return id;
}

// Method 3: cuid2 (collision-resistant + sortable)
import { createId } from '@paralleldrive/cuid2';

function generateCuid2SessionId(): string {
  // cuid2 is cryptographically random but also sortable
  return createId();
  // Example result: "clh3am8w000003b5y0h8xk8q9"
}
```

### 6.3 Preventing Session Fixation Attacks

```
Session Fixation Attack:

  Attack steps:
  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │  ① Attacker obtains a valid session ID from server │
  │  ② Attacker sets this ID in the victim's browser   │
  │     (via URL parameter, Cookie manipulation, etc.) │
  │  ③ Victim logs in with this ID                     │
  │  ④ Attacker accesses with same ID → authenticated  │
  │                                                    │
  └────────────────────────────────────────────────────┘

  Prevention: regenerate the session ID on successful login

  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │  Before login: sessionId = "abc123"                │
  │  ↓ Authentication succeeds                         │
  │  After login:  sessionId = "xyz789" (new ID)       │
  │                                                    │
  │  → The "abc123" known to the attacker is now invalid│
  │                                                    │
  └────────────────────────────────────────────────────┘
```

```typescript
// Session ID rotation implementation
async function rotateSession(
  store: RedisSessionStore,
  oldSessionId: string,
  response: Response
): Promise<string> {
  // Retrieve old session data
  const data = await store.get(oldSessionId);
  if (!data) throw new Error('Session not found');

  // Generate a new session ID
  const newSessionId = generateSessionId();

  // Save session under the new ID
  await store.set(newSessionId, data, 86400);

  // Delete the old session
  await store.delete(oldSessionId);

  // Update the Cookie
  response.headers.set('Set-Cookie', [
    `session_id=${newSessionId}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=86400`,
  ].join('; '));

  return newSessionId;
}

// Used within the login handler
async function handleLogin(
  credentials: { email: string; password: string },
  request: Request,
  response: Response
) {
  const user = await authenticateUser(credentials);
  if (!user) throw new Error('Invalid credentials');

  // If an existing session is present, delete it
  const existingSessionId = getSessionIdFromCookie(request);
  if (existingSessionId) {
    await store.delete(existingSessionId);
  }

  // Create a new session
  const newSessionId = generateSessionId();
  await store.set(newSessionId, {
    userId: user.id,
    role: user.role,
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    ip: getClientIp(request),
    userAgent: request.headers.get('user-agent') || '',
    metadata: {},
  }, 86400);

  // Set the Cookie
  response.headers.set('Set-Cookie', [
    `session_id=${newSessionId}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=86400',
  ].join('; '));
}
```

---

## 7. Session Monitoring and Operations

### 7.1 Active Session Management UI

```typescript
// app/settings/sessions/page.tsx - Session management screen
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function SessionsPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const store = new RedisSessionStore({
    redisUrl: process.env.REDIS_URL!,
  });

  const sessions = await store.findByUserId(session.user.id);
  const currentSessionId = getCurrentSessionId();

  return (
    <div>
      <h1>Active Sessions</h1>
      <p className="text-gray-500">
        A list of devices currently logged into your account.
      </p>

      <div className="space-y-4 mt-6">
        {sessions.map((s) => {
          const isCurrent = s.id === currentSessionId;
          const ua = parseUserAgent(s.data.userAgent);

          return (
            <div key={s.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">
                    {ua.browser} on {ua.os}
                    {isCurrent && (
                      <span className="ml-2 text-green-600 text-sm">
                        (This device)
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">
                    IP: {s.data.ip} ·
                    Last accessed: {formatRelativeTime(s.data.lastAccessedAt)}
                  </p>
                  <p className="text-xs text-gray-400">
                    Session started: {formatDate(s.data.createdAt)}
                  </p>
                </div>
                {!isCurrent && (
                  <RevokeSessionButton sessionId={s.id} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {sessions.length > 1 && (
        <div className="mt-6">
          <RevokeOtherSessionsButton />
        </div>
      )}
    </div>
  );
}
```

### 7.2 Collecting Session Metrics

```typescript
// Prometheus-compatible metrics collection
import { Registry, Counter, Gauge, Histogram } from 'prom-client';

const registry = new Registry();

// Active session count (gauge)
const activeSessionsGauge = new Gauge({
  name: 'session_active_total',
  help: 'Total number of active sessions',
  registers: [registry],
});

// Session operation counter
const sessionOperationCounter = new Counter({
  name: 'session_operations_total',
  help: 'Total number of session operations',
  labelNames: ['operation', 'status'],
  registers: [registry],
});

// Session operation latency
const sessionOperationDuration = new Histogram({
  name: 'session_operation_duration_seconds',
  help: 'Session operation duration in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [registry],
});

// Instrumented store wrapper
class InstrumentedSessionStore {
  constructor(private inner: RedisSessionStore) {}

  async get(sessionId: string): Promise<SessionData | null> {
    const timer = sessionOperationDuration.startTimer({ operation: 'get' });

    try {
      const result = await this.inner.get(sessionId);
      sessionOperationCounter.inc({
        operation: 'get',
        status: result ? 'hit' : 'miss',
      });
      return result;
    } catch (error) {
      sessionOperationCounter.inc({ operation: 'get', status: 'error' });
      throw error;
    } finally {
      timer();
    }
  }

  async set(sessionId: string, data: SessionData, ttl: number): Promise<void> {
    const timer = sessionOperationDuration.startTimer({ operation: 'set' });

    try {
      await this.inner.set(sessionId, data, ttl);
      sessionOperationCounter.inc({ operation: 'set', status: 'success' });
    } catch (error) {
      sessionOperationCounter.inc({ operation: 'set', status: 'error' });
      throw error;
    } finally {
      timer();
    }
  }

  // Periodically update the active session count
  async updateMetrics(): Promise<void> {
    const count = await this.inner.count();
    activeSessionsGauge.set(count);
  }
}
```

---

## 8. Session Security Hardening

### 8.1 Additional Validation Layers

```typescript
// Session validation middleware
async function validateSession(
  sessionId: string,
  request: Request,
  store: RedisSessionStore
): Promise<{
  valid: boolean;
  data?: SessionData;
  warning?: string;
}> {
  const data = await store.get(sessionId);
  if (!data) return { valid: false };

  const warnings: string[] = [];

  // ① Detect IP address changes
  const currentIp = getClientIp(request);
  if (data.ip !== currentIp) {
    warnings.push(`IP changed: ${data.ip} → ${currentIp}`);
    // Mobile networks change IPs frequently,
    // so warn but do not block
  }

  // ② Detect User-Agent changes
  const currentUa = request.headers.get('user-agent') || '';
  if (data.userAgent !== currentUa) {
    warnings.push('User-Agent changed');
    // A UA change may indicate session hijacking
    // However, UA is easy to spoof, so treat as a secondary signal
  }

  // ③ Absolute Expiration check
  const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours
  if (Date.now() - data.createdAt > maxSessionAge) {
    await store.delete(sessionId);
    return { valid: false };
  }

  // ④ Limit concurrent sessions per user
  const maxSessionsPerUser = 5;
  const userSessions = await store.findByUserId(data.userId);
  if (userSessions.length > maxSessionsPerUser) {
    // Delete the oldest sessions
    const sorted = userSessions.sort(
      (a, b) => a.data.lastAccessedAt - b.data.lastAccessedAt
    );
    const toDelete = sorted.slice(0, sorted.length - maxSessionsPerUser);
    for (const s of toDelete) {
      await store.delete(s.id);
    }
  }

  return {
    valid: true,
    data,
    warning: warnings.length > 0 ? warnings.join('; ') : undefined,
  };
}
```

### 8.2 Encrypting Session Data

```typescript
// Encrypt session data (encrypt data before storing in Redis)
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ENCRYPTION_KEY = scryptSync(
  process.env.SESSION_ENCRYPTION_SECRET!,
  'session-store-salt',
  32
);

function encryptSessionData(data: SessionData): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);

  const json = JSON.stringify(data);
  let encrypted = cipher.update(json, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptSessionData(encrypted: string): SessionData {
  const [ivHex, authTagHex, data] = encrypted.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

// Encryption-aware session store
class EncryptedSessionStore {
  constructor(private inner: RedisSessionStore) {}

  async set(sessionId: string, data: SessionData, ttl: number): Promise<void> {
    const encrypted = encryptSessionData(data);
    // Store encrypted string in Redis
    await this.inner.setRaw(sessionId, encrypted, ttl);
  }

  async get(sessionId: string): Promise<SessionData | null> {
    const encrypted = await this.inner.getRaw(sessionId);
    if (!encrypted) return null;

    try {
      return decryptSessionData(encrypted);
    } catch {
      // Decryption failure (e.g., key rotation) → invalidate session
      await this.inner.delete(sessionId);
      return null;
    }
  }
}
```

---

## 9. Anti-Patterns

### 9.1 Using an In-Memory Store in Production

```typescript
// ✗ Dangerous: using in-memory store in production
// All users will be logged out on server restart
const sessions = new Map<string, SessionData>();

// ✓ Correct: use Redis or DB store
const store = new RedisSessionStore({
  redisUrl: process.env.REDIS_URL!,
});
```

### 9.2 Using the KEYS Command

```typescript
// ✗ Dangerous: KEYS * must not be used in production
// → O(N) blocking operation that scans all keys
const allKeys = await redis.keys('sess:*');

// ✓ Correct: use SCAN (non-blocking, iterative)
let cursor = '0';
const keys: string[] = [];
do {
  const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', 'sess:*', 'COUNT', 100);
  cursor = nextCursor;
  keys.push(...batch);
} while (cursor !== '0');
```

### 9.3 Storing Too Much Data in a Session

```typescript
// ✗ Problem: storing large objects in a session
await store.set(sessionId, {
  userId: user.id,
  role: user.role,
  cart: hugeCartData,           // NG: full cart data
  searchHistory: allHistory,     // NG: full search history
  preferences: allPreferences,   // NG: full preferences data
}, ttl);

// ✓ Correct: keep session minimal; store detailed data in DB
await store.set(sessionId, {
  userId: user.id,
  role: user.role,
  // Cart and history are stored in DB and referenced by userId
}, ttl);
```

---

## 10. Exercises

### Exercise 1: Basic — Build a Redis Session Store (Difficulty: Basic)

```
Task:
  Implement a session store using Redis and integrate it as
  middleware for Express/Next.js.

Requirements:
  ① Session CRUD operations (set, get, delete)
  ② Automatic expiry via TTL
  ③ Sliding Expiration (extend on access)
  ④ Retrieve all sessions for a user

Hints:
  → Make use of ioredis Pipeline
  → Generate session IDs with crypto.randomBytes(32)

Verification checklist:
  □ Can you connect to Redis?
  □ Can sessions be saved and retrieved?
  □ Are sessions automatically deleted after TTL expires?
  □ Is the expiry extended on each access?
```

### Exercise 2: Applied — Implement a Session Management UI (Difficulty: Applied)

```
Task:
  On top of Exercise 1, implement a settings screen where users
  can manage their active sessions.

Requirements:
  ① Display a list of active sessions
  ② Show session details (IP, UA, last access time)
  ③ Revoke individual sessions (logout)
  ④ "Log out of all other devices" feature
  ⑤ Highlight the current session

Hints:
  → Use a User-Agent parser to extract OS / browser name
  → Get the current session ID from the Cookie
  → Implement revocation using Server Actions

Verification checklist:
  □ Are all sessions shown when logged in from multiple browsers?
  □ Does individual logout work correctly?
  □ Is the current session preserved after bulk logout?
```

### Exercise 3: Advanced — Design a High-Availability Session Store (Difficulty: Advanced)

```
Task:
  Design a high-availability session store using Redis Sentinel
  and test the failover behavior.

Requirements:
  ① Redis Sentinel configuration (1 Master + 2 Replicas + 3 Sentinels)
  ② Session preservation during failover
  ③ Metrics collection (Prometheus-compatible)
  ④ Session data encryption
  ⑤ Health check endpoint
  ⑥ Graceful shutdown

Hints:
  → Build the Sentinel environment with Docker Compose
  → Stop the master with docker stop to trigger failover
  → Expose metrics with prom-client

Verification checklist:
  □ Does automatic failover occur after the master is stopped?
  □ How are requests handled during failover?
  □ Are metrics collected correctly?
  □ Do encryption/decryption work correctly?
```

---

## 11. FAQ

### Q1: Which is better for a session store — Redis or Memcached?

```
A: Redis is recommended in most cases.

Comparison:
  ┌──────────────┬──────────────────┬──────────────────┐
  │ Item         │ Redis            │ Memcached        │
  ├──────────────┼──────────────────┼──────────────────┤
  │ Data structs │ Rich (Set, etc.) │ Key-Value only   │
  │ Persistence  │ RDB / AOF        │ None             │
  │ TTL mgmt     │ Per-key          │ Per-key          │
  │ Clustering   │ Redis Cluster    │ Consistent hash  │
  │ Pub/Sub      │ ✓                │ ✗               │
  │ Lua          │ ✓                │ ✗               │
  │ Memory eff.  │ Slightly lower   │ Superior         │
  └──────────────┴──────────────────┴──────────────────┘

When Memcached is a good fit:
  → Used purely as a cache
  → Memory efficiency is the top priority
  → High-frequency reads
```

### Q2: What is the difference between Cookie-based sessions and server-side sessions?

```
A: They differ in where session data is stored.

Cookie-based (JWT, etc.):
  → Session data is embedded in a Cookie / JWT
  → No server-side store required
  → Stateless (easy to scale)
  → Data size limited (4KB)
  → Immediate invalidation is difficult

Server-side:
  → Cookie contains only the session ID
  → Data is stored in a server-side store
  → No size limit
  → Immediate invalidation is possible
  → Store can become a single point of failure

Recommendation: use server-side when handling sensitive data;
                use Cookie-based when statelessness is a priority.
```

### Q3: How do I configure the session store in Auth.js (NextAuth)?

```
A: In Auth.js, the session store is changed by configuring an adapter.

// JWT session (default, no store required)
export const { handlers, auth } = NextAuth({
  session: { strategy: 'jwt' },
});

// DB session (Prisma)
export const { handlers, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'database' },
});

// Upstash Redis (@auth/upstash-redis-adapter)
import { UpstashRedisAdapter } from '@auth/upstash-redis-adapter';
export const { handlers, auth } = NextAuth({
  adapter: UpstashRedisAdapter(redis),
  session: { strategy: 'database' },
});

Note: With the JWT strategy, no session store is needed (included in Cookie)
      With the Database strategy, an adapter is required
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. Be sure to thoroughly understand the basic concepts explained in this guide before moving to the next step.

### Q3: How is this applied in real-world work?

Knowledge of this topic is frequently applied in day-to-day development. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Recommendation |
|------|----------------|
| Store | Redis (production), in-memory (development), DB (when Redis cannot be added) |
| Scaling | Redis Sentinel (high availability) / Cluster (horizontal scaling) |
| TTL | Hybrid of Sliding + Absolute |
| Session ID | crypto.randomBytes(32), 256 bits or more |
| Security | Fixation prevention (rotation), data encryption, concurrent session limits |
| Operations | Metrics collection, active session management UI, periodic cleanup |

---

## Next Guides to Read


---

## References

1. Redis. "Redis as a Session Store." redis.io, 2024.
2. OWASP. "Session Management Cheat Sheet." cheatsheetseries.owasp.org, 2024.
3. ioredis. "ioredis Documentation." github.com/redis/ioredis, 2024.
4. Upstash. "Serverless Redis." upstash.com/docs, 2024.
5. IETF. "RFC 6265 — HTTP State Management Mechanism." tools.ietf.org, 2011.
6. Express. "express-session." github.com/expressjs/session, 2024.
7. Auth.js. "Database Adapters." authjs.dev/getting-started/adapters, 2024.

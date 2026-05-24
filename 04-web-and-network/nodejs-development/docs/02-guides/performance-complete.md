# Node.js Performance Optimization — Complete Guide

## Supported Versions
- **Node.js**: 20.0.0+
- **Express**: 4.18.0+
- **TypeScript**: 5.0.0+

---

## Profiling and Measurement

### Node.js Built-in Profiler

```typescript
import { Session } from 'inspector'
import * as fs from 'fs'

function startProfiling(): Session {
  const session = new Session()
  session.connect()
  session.post('Profiler.enable', () => {
    session.post('Profiler.start')
  })
  return session
}

function stopProfiling(session: Session, outputPath: string) {
  session.post('Profiler.stop', (err, { profile }) => {
    if (err) {
      console.error('Profiling error:', err)
      return
    }
    fs.writeFileSync(outputPath, JSON.stringify(profile))
    console.log(`Profile saved to ${outputPath}`)
    session.disconnect()
  })
}

const session = startProfiling()
await performHeavyOperation()
stopProfiling(session, 'profile.cpuprofile')
// Open in Chrome DevTools for analysis
```

### performance_hooks API

```typescript
import { performance, PerformanceObserver } from 'perf_hooks'

const obs = new PerformanceObserver((items) => {
  items.getEntries().forEach((entry) => {
    console.log(`${entry.name}: ${entry.duration.toFixed(2)}ms`)
  })
})
obs.observe({ entryTypes: ['measure', 'function'] })

// Measure execution time
performance.mark('start-db-query')
await database.query('SELECT * FROM users')
performance.mark('end-db-query')
performance.measure('db-query', 'start-db-query', 'end-db-query')

// Utility wrapper
async function measurePerformance<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now()
  try {
    const result = await fn()
    console.log(`${name}: ${(performance.now() - start).toFixed(2)}ms`)
    return result
  } catch (error) {
    console.error(`${name} failed after ${(performance.now() - start).toFixed(2)}ms:`, error)
    throw error
  }
}

const users = await measurePerformance('fetchUsers', () => fetchAllUsers())
```

### APM Integration

```typescript
// Sentry Performance Monitoring
import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,  // Trace 10% of requests
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({ app }),
  ],
})

app.use(Sentry.Handlers.requestHandler())
app.use(Sentry.Handlers.tracingHandler())

app.get('/api/users', async (req, res) => {
  const transaction = Sentry.getCurrentHub().getScope()?.getTransaction()
  const span = transaction?.startChild({
    op: 'database.query',
    description: 'Fetch users from database',
  })

  const users = await db.user.findMany()
  span?.finish()
  res.json(users)
})

app.use(Sentry.Handlers.errorHandler())
```

---

## Memory Management

### Monitoring Memory Usage

```typescript
function logMemoryUsage() {
  const used = process.memoryUsage()
  console.log('Memory Usage:')
  console.log(`  RSS: ${(used.rss / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  Heap Total: ${(used.heapTotal / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  Heap Used: ${(used.heapUsed / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  External: ${(used.external / 1024 / 1024).toFixed(2)} MB`)
}

setInterval(logMemoryUsage, 60000)

// Heap snapshot on large growth
let lastHeapUsed = 0
setInterval(() => {
  const { heapUsed } = process.memoryUsage()
  if (heapUsed > lastHeapUsed * 1.5) {
    const v8 = require('v8')
    v8.writeHeapSnapshot(`heap-${Date.now()}.heapsnapshot`)
  }
  lastHeapUsed = heapUsed
}, 30000)
```

### Common Memory Leak Patterns

```typescript
// ❌ Unbounded cache growth
const cache: Record<string, any> = {}
app.get('/data/:id', async (req, res) => {
  const data = await fetchData(req.params.id)
  cache[req.params.id] = data  // Grows forever
  res.json(data)
})

// ✅ LRU cache with limits
import LRU from 'lru-cache'

const cache = new LRU<string, any>({
  max: 500,
  ttl: 1000 * 60 * 5,  // 5 minutes TTL
})

app.get('/data/:id', async (req, res) => {
  let data = cache.get(req.params.id)
  if (!data) {
    data = await fetchData(req.params.id)
    cache.set(req.params.id, data)
  }
  res.json(data)
})

// ❌ Event listeners not removed
class DataService {
  private emitter = new EventEmitter()
  subscribe(handler: (data: any) => void) {
    this.emitter.on('data', handler)  // Never removed
  }
}

// ✅ Return cleanup function
class DataService {
  private emitter = new EventEmitter()
  subscribe(handler: (data: any) => void): () => void {
    this.emitter.on('data', handler)
    return () => this.emitter.off('data', handler)
  }
}

const unsubscribe = dataService.subscribe(handleData)
// ... later ...
unsubscribe()

// ❌ Loading entire dataset into memory
async function processAllUsers() {
  const users = await db.user.findMany()  // 1M rows in memory
  for (const user of users) {
    await processUser(user)
  }
}

// ✅ Stream processing
async function* fetchUsersStream(batchSize: number = 1000) {
  let offset = 0
  while (true) {
    const users = await db.user.findMany({ skip: offset, take: batchSize })
    if (users.length === 0) break
    yield* users
    offset += batchSize
  }
}

async function processAllUsers() {
  for await (const user of fetchUsersStream()) {
    await processUser(user)
  }
}
```

### V8 Heap Configuration

```json
// package.json
{
  "scripts": {
    "start": "node --max-old-space-size=4096 dist/server.js"
  }
}
```

---

## Database Query Optimization

### Solving the N+1 Problem

```typescript
// ❌ N+1 — one query per user
async function getUsersWithOrders() {
  const users = await prisma.user.findMany()
  for (const user of users) {
    user.orders = await prisma.order.findMany({ where: { userId: user.id } })
  }
  return users
}

// ✅ Single query with include
async function getUsersWithOrders() {
  return prisma.user.findMany({
    include: { orders: true },
  })
}

// ✅ Select only needed fields
async function getUsersOptimized() {
  return prisma.user.findMany({
    select: { id: true, name: true, email: true },
    // passwordHash excluded
  })
}

// ✅ Paginate for memory efficiency
async function getUsersPaginated(page: number, pageSize: number) {
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count(),
  ])
  return { users, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}
```

### Database Indexes

```prisma
// schema.prisma
model Product {
  id        String   @id @default(uuid())
  name      String
  category  String
  price     Float
  createdAt DateTime @default(now())

  @@index([category])
  @@index([price])
  @@index([createdAt])
  @@index([category, price])  // Composite index
}
```

### Connection Pooling

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool settings via DATABASE_URL:
  // ?connection_limit=10&pool_timeout=20
})

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
```

---

## Caching Strategies

### Redis Cache

```typescript
import { createClient } from 'redis'

const redis = createClient({ url: process.env.REDIS_URL })
await redis.connect()

class CacheService {
  async get<T>(key: string): Promise<T | null> {
    const value = await redis.get(key)
    if (!value) return null
    return JSON.parse(value) as T
  }

  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    await redis.setEx(key, ttlSeconds, JSON.stringify(value))
  }

  async del(key: string): Promise<void> {
    await redis.del(key)
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) await redis.del(keys)
  }
}

// Cache-aside pattern
async function getProduct(id: string) {
  const cacheKey = `product:${id}`

  const cached = await cacheService.get<Product>(cacheKey)
  if (cached) return cached

  const product = await db.findProduct(id)
  await cacheService.set(cacheKey, product, 3600)  // 1 hour TTL

  return product
}

// Invalidate on update
async function updateProduct(id: string, data: Partial<Product>) {
  const product = await db.updateProduct(id, data)
  await cacheService.del(`product:${id}`)
  await cacheService.invalidatePattern('products:*')
  return product
}
```

### HTTP Response Caching

```typescript
import { Request, Response, NextFunction } from 'express'

function cacheControl(maxAge: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.set('Cache-Control', `public, max-age=${maxAge}`)
    next()
  }
}

// Static assets — cache 1 year
app.use('/static', express.static('public', { maxAge: '1y' }))

// API responses — cache 5 minutes
app.get('/api/categories', cacheControl(300), async (req, res) => {
  const categories = await db.category.findMany()
  res.json(categories)
})
```

---

## Response Optimization

### Compression

```typescript
import compression from 'compression'

app.use(compression({
  level: 6,
  threshold: 1024,  // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false
    return compression.filter(req, res)
  },
}))
```

### Streaming Responses

```typescript
import { pipeline } from 'stream/promises'

// Stream large file downloads
app.get('/download/:filename', async (req, res) => {
  const filePath = path.join(__dirname, 'files', req.params.filename)

  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${req.params.filename}"`,
  })

  const readStream = fs.createReadStream(filePath)
  await pipeline(readStream, res)
})

// Stream JSON array response
app.get('/api/export/users', async (req, res) => {
  res.set('Content-Type', 'application/json')
  res.write('[')

  let first = true
  for await (const user of fetchUsersStream()) {
    if (!first) res.write(',')
    res.write(JSON.stringify(user))
    first = false
  }

  res.write(']')
  res.end()
})
```

---

## Common Performance Issues

| Issue | Symptom | Fix |
|-------|---------|-----|
| N+1 queries | Slow DB responses | Use `include` / `join` |
| No caching | High DB load | Add Redis cache |
| No pagination | High memory usage | Paginate all list endpoints |
| Missing indexes | Slow queries | Add indexes on filter/sort fields |
| Synchronous operations | CPU blocking | Use async/Worker Threads |
| Uncompressed responses | High bandwidth | Enable gzip compression |
| Unbounded cache | Memory leak | Use LRU with TTL |
| No connection pool | DB connection errors | Configure pool size |

---

## Checklist

### Measurement
- [ ] Profiling in place for CPU bottlenecks
- [ ] Memory usage monitored
- [ ] Slow query logging enabled
- [ ] APM integrated (Sentry, Datadog, New Relic)

### Memory
- [ ] LRU cache with max size and TTL
- [ ] Event listeners removed when done
- [ ] Large datasets processed with streams
- [ ] Heap size configured appropriately

### Database
- [ ] N+1 queries eliminated
- [ ] Indexes on filtered/sorted columns
- [ ] Select only needed columns
- [ ] Connection pooling configured
- [ ] Pagination on all list endpoints

### Caching
- [ ] Frequently read data cached in Redis
- [ ] Cache invalidated on write
- [ ] HTTP Cache-Control headers set
- [ ] Static assets cached long-term

### Response
- [ ] Gzip compression enabled
- [ ] Large files streamed
- [ ] Response size minimized

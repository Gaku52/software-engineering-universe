# Node.js パフォーマンス最適化 — 完全ガイド

## 対応バージョン
- **Node.js**: 20.0.0+
- **Express**: 4.18.0+
- **TypeScript**: 5.0.0+

---

## プロファイリングと計測

### Node.js 組み込みプロファイラー

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
// Chrome DevTools で開いて分析する
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

// 実行時間を計測する
performance.mark('start-db-query')
await database.query('SELECT * FROM users')
performance.mark('end-db-query')
performance.measure('db-query', 'start-db-query', 'end-db-query')

// ユーティリティラッパー
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

### APM 連携

```typescript
// Sentry パフォーマンスモニタリング
import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,  // リクエストの 10% をトレース
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

## メモリ管理

### メモリ使用量の監視

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

// ヒープが大幅に増加したときにスナップショットを取る
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

### よくあるメモリリークのパターン

```typescript
// ❌ キャッシュが無制限に増え続ける
const cache: Record<string, any> = {}
app.get('/data/:id', async (req, res) => {
  const data = await fetchData(req.params.id)
  cache[req.params.id] = data  // 際限なく増加する
  res.json(data)
})

// ✅ サイズ制限付きの LRU キャッシュを使う
import LRU from 'lru-cache'

const cache = new LRU<string, any>({
  max: 500,
  ttl: 1000 * 60 * 5,  // TTL 5分
})

app.get('/data/:id', async (req, res) => {
  let data = cache.get(req.params.id)
  if (!data) {
    data = await fetchData(req.params.id)
    cache.set(req.params.id, data)
  }
  res.json(data)
})

// ❌ イベントリスナーが削除されない
class DataService {
  private emitter = new EventEmitter()
  subscribe(handler: (data: any) => void) {
    this.emitter.on('data', handler)  // 削除されない
  }
}

// ✅ クリーンアップ関数を返す
class DataService {
  private emitter = new EventEmitter()
  subscribe(handler: (data: any) => void): () => void {
    this.emitter.on('data', handler)
    return () => this.emitter.off('data', handler)
  }
}

const unsubscribe = dataService.subscribe(handleData)
// ... 後で ...
unsubscribe()

// ❌ データセット全体をメモリに読み込む
async function processAllUsers() {
  const users = await db.user.findMany()  // 100 万件がメモリに
  for (const user of users) {
    await processUser(user)
  }
}

// ✅ ストリーム処理を使う
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

### V8 ヒープの設定

```json
// package.json
{
  "scripts": {
    "start": "node --max-old-space-size=4096 dist/server.js"
  }
}
```

---

## データベースクエリの最適化

### N+1 問題の解消

```typescript
// ❌ N+1 — ユーザーごとに 1 クエリ発行される
async function getUsersWithOrders() {
  const users = await prisma.user.findMany()
  for (const user of users) {
    user.orders = await prisma.order.findMany({ where: { userId: user.id } })
  }
  return users
}

// ✅ include で 1 クエリにまとめる
async function getUsersWithOrders() {
  return prisma.user.findMany({
    include: { orders: true },
  })
}

// ✅ 必要なフィールドのみ取得する
async function getUsersOptimized() {
  return prisma.user.findMany({
    select: { id: true, name: true, email: true },
    // passwordHash は除外
  })
}

// ✅ メモリ効率のためにページネーションを使う
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

### データベースインデックス

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
  @@index([category, price])  // 複合インデックス
}
```

### コネクションプーリング

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // DATABASE_URL でコネクションプールを設定:
  // ?connection_limit=10&pool_timeout=20
})

// グレースフルシャットダウン
process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
```

---

## キャッシュ戦略

### Redis キャッシュ

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

// キャッシュアサイドパターン
async function getProduct(id: string) {
  const cacheKey = `product:${id}`

  const cached = await cacheService.get<Product>(cacheKey)
  if (cached) return cached

  const product = await db.findProduct(id)
  await cacheService.set(cacheKey, product, 3600)  // TTL 1時間

  return product
}

// 更新時にキャッシュを無効化する
async function updateProduct(id: string, data: Partial<Product>) {
  const product = await db.updateProduct(id, data)
  await cacheService.del(`product:${id}`)
  await cacheService.invalidatePattern('products:*')
  return product
}
```

### HTTP レスポンスキャッシュ

```typescript
import { Request, Response, NextFunction } from 'express'

function cacheControl(maxAge: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.set('Cache-Control', `public, max-age=${maxAge}`)
    next()
  }
}

// 静的アセット — 1年間キャッシュ
app.use('/static', express.static('public', { maxAge: '1y' }))

// API レスポンス — 5分間キャッシュ
app.get('/api/categories', cacheControl(300), async (req, res) => {
  const categories = await db.category.findMany()
  res.json(categories)
})
```

---

## レスポンス最適化

### 圧縮

```typescript
import compression from 'compression'

app.use(compression({
  level: 6,
  threshold: 1024,  // 1KB 超のレスポンスのみ圧縮
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false
    return compression.filter(req, res)
  },
}))
```

### ストリーミングレスポンス

```typescript
import { pipeline } from 'stream/promises'

// 大きなファイルのダウンロードをストリームで返す
app.get('/download/:filename', async (req, res) => {
  const filePath = path.join(__dirname, 'files', req.params.filename)

  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${req.params.filename}"`,
  })

  const readStream = fs.createReadStream(filePath)
  await pipeline(readStream, res)
})

// JSON 配列レスポンスをストリームで返す
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

## よくあるパフォーマンス問題

| 問題 | 症状 | 対処法 |
|-------|---------|-----|
| N+1 クエリ | DB レスポンスが遅い | `include` / `join` を使う |
| キャッシュなし | DB 負荷が高い | Redis キャッシュを追加する |
| ページネーションなし | メモリ使用量が高い | 全リストエンドポイントにページネーションを追加 |
| インデックスなし | クエリが遅い | フィルター・ソート対象カラムにインデックスを追加 |
| 同期処理 | CPU ブロッキング | async / Worker Threads を使う |
| レスポンス非圧縮 | 帯域幅が大きい | gzip 圧縮を有効にする |
| 無制限キャッシュ | メモリリーク | TTL 付き LRU を使う |
| コネクションプールなし | DB 接続エラー | プールサイズを設定する |

---

## チェックリスト

### 計測
- [ ] CPU ボトルネックのプロファイリングを導入している
- [ ] メモリ使用量を監視している
- [ ] スロークエリログを有効にしている
- [ ] APM を連携している（Sentry、Datadog、New Relic）

### メモリ
- [ ] 最大サイズと TTL 付きの LRU キャッシュを使っている
- [ ] 不要になったイベントリスナーを削除している
- [ ] 大きなデータセットをストリームで処理している
- [ ] ヒープサイズを適切に設定している

### データベース
- [ ] N+1 クエリを解消している
- [ ] フィルター・ソート対象カラムにインデックスを追加している
- [ ] 必要なカラムのみ取得している
- [ ] コネクションプーリングを設定している
- [ ] 全リストエンドポイントにページネーションを実装している

### キャッシュ
- [ ] 読み取り頻度の高いデータを Redis にキャッシュしている
- [ ] 書き込み時にキャッシュを無効化している
- [ ] HTTP Cache-Control ヘッダーを設定している
- [ ] 静的アセットを長期間キャッシュしている

### レスポンス
- [ ] gzip 圧縮を有効にしている
- [ ] 大きなファイルをストリームで返している
- [ ] レスポンスサイズを最小化している

---

[親ガイド](../../README.md)

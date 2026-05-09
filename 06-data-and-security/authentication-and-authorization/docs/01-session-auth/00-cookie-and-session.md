# Cookie and Session Management

> Cookies are the foundation of state management between browsers and servers. This guide covers everything you need for secure session management: cookie attribute design, session management mechanics, secure session ID generation, and session lifecycle. HTTP is a stateless protocol, and the combination of cookies and sessions is the only standard mechanism for building stateful web applications.

## What You Will Learn

- [ ] Understand cookie attributes and security settings
- [ ] Grasp the lifecycle of session creation, management, and destruction
- [ ] Be able to implement secure session management
- [ ] Understand the principles and countermeasures for session fixation attacks and session hijacking
- [ ] Learn cookie scope design and subdomain strategies
- [ ] Learn session store selection criteria and implementation patterns

## Prerequisites

- HTTP protocol basics (request/response model)
- TypeScript / Node.js fundamentals
- Basic web security concepts (XSS, CSRF)

## Related Guides


---

## 1. HTTP Statelessness and the Role of Cookies

```
Why cookies are necessary:

  HTTP is a stateless protocol:
    → Each request is independent and does not retain information from previous requests
    → The server cannot identify "consecutive requests from the same user"

  ┌──────────────┐                    ┌──────────┐
  │   Browser    │  GET /dashboard    │  Server  │
  │              │ ─────────────────> │          │
  │              │                    │  "Who?"  │
  │              │  GET /profile      │          │
  │              │ ─────────────────> │          │
  │              │                    │  "Who?"  │
  └──────────────┘                    └──────────┘

  Cookies solve this problem:
    → Server attaches Set-Cookie header to the response
    → Browser automatically includes the cookie in requests
    → Server identifies the user from the cookie

  ┌──────────────┐                           ┌────────────────┐
  │   Browser    │  POST /login              │    Server      │
  │              │ ─────────────────────────> │                │
  │              │  Set-Cookie: sid=abc123    │ Create         │
  │              │ <───────────────────────── │ Session        │
  │              │                           │                │
  │              │  GET /dashboard            │                │
  │              │  Cookie: sid=abc123        │                │
  │              │ ─────────────────────────> │                │
  │              │                           │ "It's          │
  │              │  200 OK (authenticated)    │  User A"       │
  │              │ <───────────────────────── │                │
  └──────────────┘                           └────────────────┘

  Historical background:
    1994: Netscape invented cookies (Lou Montulli)
    1997: RFC 2109 (initial cookie standardization)
    2000: RFC 2965 (Cookie2, never widely adopted)
    2011: RFC 6265 (current standard, unified Set-Cookie/Cookie spec)
    2025: RFC 6265bis (SameSite defaults, etc., latest spec)
```

---

## 2. Cookie Basics

```
How cookies work:

  Server → set via response header:
    Set-Cookie: session_id=abc123; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600

  Browser → automatically sent via request header:
    Cookie: session_id=abc123

  Setting multiple cookies:
    Set-Cookie: session_id=abc123; HttpOnly; Secure
    Set-Cookie: theme=dark; Path=/
    Set-Cookie: lang=en; Path=/

  Sent from browser (all cookies sent on a single line):
    Cookie: session_id=abc123; theme=dark; lang=en
```

### 2.1 Cookie Attribute Reference

```
Cookie attributes:

  Attribute     │ Value           │ Description
  ──────────────┼─────────────────┼────────────────────────
  HttpOnly      │ true            │ Not accessible from JavaScript
                │                 │ → Prevents token theft via XSS
  Secure        │ true            │ Sent over HTTPS only
                │                 │ → Prevents man-in-the-middle attacks
  SameSite      │ Strict/Lax/None │ Controls sending on cross-site requests
                │                 │ → CSRF protection
  Path          │ /               │ Path for which the cookie is sent
  Domain        │ .example.com    │ Domain for which the cookie is valid
  Max-Age       │ 3600            │ Validity period (seconds)
  Expires       │ Date            │ Expiration date/time
  Partitioned   │ true            │ CHIPS (Cookie Having
                │                 │ Independent Partitioned State)
                │                 │ → Handles third-party cookie restrictions
  __Prefix      │ (name prefix)   │ Additional security via cookie name prefix
```

### 2.2 SameSite Attribute in Detail

```
SameSite values and their behavior:

  ┌─────────────────────────────────────────────────────────────┐
  │                    SameSite=Strict                          │
  │                                                             │
  │  Sends cookies only for same-site requests                  │
  │                                                             │
  │  ✓ same-origin POST → cookie sent                           │
  │  ✓ same-origin GET → cookie sent                            │
  │  ✗ cross-site link → cookie NOT sent                        │
  │  ✗ cross-site POST → cookie NOT sent                        │
  │  ✗ cross-site iframe → cookie NOT sent                      │
  │                                                             │
  │  Issue: navigating from an external link loses login state  │
  │  Example: Google search result → your site → shows logged out│
  │           Email link → your site → shows logged out         │
  └─────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │                    SameSite=Lax (recommended)               │
  │                                                             │
  │  Allows GET for top-level navigation (link traversal)       │
  │                                                             │
  │  ✓ same-origin POST → cookie sent                           │
  │  ✓ same-origin GET → cookie sent                            │
  │  ✓ cross-site link (GET) → cookie sent                      │
  │  ✗ cross-site POST → cookie NOT sent → CSRF protection      │
  │  ✗ cross-site iframe → cookie NOT sent                      │
  │  ✗ cross-site img/script → cookie NOT sent                  │
  │                                                             │
  │  Well-balanced: protects against CSRF without hurting UX    │
  └─────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │                    SameSite=None                            │
  │                                                             │
  │  Sends on all cross-site requests                           │
  │  Requires Secure attribute (HTTPS only)                     │
  │                                                             │
  │  ✓ cookie sent on all requests                              │
  │                                                             │
  │  Use cases:                                                 │
  │    → Third-party cookies (ads, embedded widgets)            │
  │    → Cross-domain authentication (login inside iframe)      │
  │    → Payment gateway 3D Secure                              │
  │                                                             │
  │  Note: affected by browser third-party cookie deprecation   │
  │  → Chrome: migrating to Privacy Sandbox / CHIPS             │
  └─────────────────────────────────────────────────────────────┘
```

### 2.3 Cookie Prefix (Additional Security via Naming)

```
Cookie Prefix:

  __Secure- prefix:
    → Requires Secure attribute
    → Can only be set over HTTPS
    → Example: __Secure-session_id=abc123

  __Host- prefix (most strict):
    → Requires Secure attribute
    → Domain attribute must not be specified (current host only)
    → Path=/ is required
    → Example: __Host-session_id=abc123

  Why it matters:
    → Prevents attackers from overwriting cookies via http://
    → Prevents cookie overwrite attacks from subdomains
    → Defends against "Cookie Tossing" attacks

  Browser behavior:
    Set-Cookie: __Host-sid=abc123; Secure; Path=/
    → ✓ Browser accepts

    Set-Cookie: __Host-sid=abc123; Secure; Path=/; Domain=example.com
    → ✗ Browser rejects (Domain attribute is present)

    Set-Cookie: __Host-sid=abc123; Path=/
    → ✗ Browser rejects (Secure is missing)
```

```typescript
// Cookie 設定のベストプラクティス
import { cookies } from 'next/headers';

async function setSessionCookie(sessionId: string) {
  const cookieStore = await cookies();

  // 本番環境では __Host- prefix を使用
  const cookieName = process.env.NODE_ENV === 'production'
    ? '__Host-session_id'
    : 'session_id';

  cookieStore.set(cookieName, sessionId, {
    httpOnly: true,        // JavaScript からアクセス不可（XSS 対策）
    secure: process.env.NODE_ENV === 'production',  // 本番は HTTPS のみ
    sameSite: 'lax',       // CSRF 防御（クロスサイト POST を拒否）
    path: '/',             // 全パスで有効
    maxAge: 24 * 60 * 60,  // 24時間
    // domain は省略（現在のドメインのみ = __Host- と同等）
  });
}

// Cookie の削除
async function clearSessionCookie() {
  const cookieStore = await cookies();
  const cookieName = process.env.NODE_ENV === 'production'
    ? '__Host-session_id'
    : 'session_id';

  cookieStore.set(cookieName, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,  // 即座に失効
  });
}
```

```typescript
// Express での Cookie 設定
import express from 'express';
import session from 'express-session';

const app = express();

app.use(session({
  name: '__Host-sid',     // Cookie 名（デフォルトの 'connect.sid' から変更）
  secret: process.env.SESSION_SECRET!,
  resave: false,          // セッションが変更されていなければ再保存しない
  saveUninitialized: false, // 未初期化セッションは保存しない（GDPR 対応）
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24時間（ミリ秒）
    // domain を省略して __Host- prefix の要件を満たす
  },
}));

// セッション変数の設定（ログイン時）
app.post('/login', async (req, res) => {
  const user = await authenticateUser(req.body.email, req.body.password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // セッション再生成（セッション固定攻撃対策）
  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).json({ error: 'Session error' });
    }
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.loginAt = Date.now();

    req.session.save((err) => {
      if (err) {
        return res.status(500).json({ error: 'Session save error' });
      }
      res.json({ user: { id: user.id, email: user.email } });
    });
  });
});
```

---

## 3. Cookie Scope Design

```
Domain attribute and scope:

  When Domain is omitted:
    → Valid for the originating host only (not sent to subdomains)
    → Example: set on app.example.com → valid for app.example.com only
    → Most secure

  When Domain=.example.com is specified:
    → Valid for example.com and all subdomains
    → Example: app.example.com, api.example.com, admin.example.com
    → Convenient but carries risk

  ┌──────────────────────────────────────────────────────────┐
  │             Domain Scope Design Patterns                  │
  │                                                          │
  │  Pattern 1: Single domain (recommended)                  │
  │    app.example.com → Cookie: Domain omitted              │
  │    api.example.com → No cookie (token-based auth)        │
  │    → Follows principle of least privilege                │
  │                                                          │
  │  Pattern 2: Shared subdomain                             │
  │    *.example.com → Cookie: Domain=.example.com           │
  │    → For SSO-like scenarios                              │
  │    → XSS on a subdomain affects the whole domain (risk)  │
  │                                                          │
  │  Pattern 3: BFF pattern (recommended)                    │
  │    app.example.com → Cookie: Domain omitted              │
  │    app.example.com/api/* → Reverse proxy to API          │
  │    → Cookie managed under the same origin                │
  │    → API server and cookie are separated                 │
  └──────────────────────────────────────────────────────────┘

  Notes on the Path attribute:
    Path=/ → cookie sent for all paths
    Path=/admin → only for /admin and below
    ⚠️ Path is NOT a security feature
      → Same-origin JavaScript can read cookies at any path
      → Opening /admin in an iframe allows cookie access
```

```typescript
// マルチサービス構成での Cookie スコープ設計
// BFF (Backend for Frontend) パターン

// next.config.js - リバースプロキシ設定
const nextConfig = {
  async rewrites() {
    return [
      {
        // /api/* へのリクエストを API サーバーに転送
        // Cookie は同一ドメインなので自動送信される
        source: '/api/:path*',
        destination: 'http://internal-api:3001/api/:path*',
      },
    ];
  },
};

// API サーバー側 - Cookie の検証
// Cookie は BFF 経由で同一ドメインから送信される
app.use('/api', (req, res, next) => {
  const sessionId = req.cookies['__Host-session_id'];
  if (!sessionId) {
    return res.status(401).json({ error: 'No session' });
  }
  next();
});
```

---

## 4. Session Management

### 4.1 Session Lifecycle

```
Session lifecycle:

  ① Creation (on login):
     → Generate session ID (cryptographically secure random value)
     → Store session data in the store
     → Set session ID in cookie

  ② Usage (per request):
     → Retrieve session ID from cookie
     → Retrieve session data from store
     → Process request based on user information

  ③ Update (on security events):
     → Rotate session ID
     → On permission change, password change
     → Defense against session fixation attacks

  ④ Destruction (on logout):
     → Delete session data from store
     → Invalidate cookie
     → Optionally invalidate all related sessions

  Timeline:

  Login       Request     Permission   Logout
    │            │           Change      │
    ▼            ▼             │         ▼
  ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐
  │Create│───>│ Use │───>│Update│───>│Destroy│
  │      │    │     │    │(ID  │    │      │
  │ ID   │    │ ID  │    │regen│    │ ID   │
  │ =A   │    │ =A  │    │ =B) │    │ =B   │
  └─────┘    └─────┘    └─────┘    └─────┘
                │                     │
             Fetch                 Delete
             from                  from
             store                 store
```

### 4.2 Secure Session ID Generation

```
Session ID requirements (OWASP compliant):

  ① Entropy: minimum 128 bits (recommended: 256 bits)
     → 2^128 combinations → brute force is infeasible
     → crypto.randomBytes(32) = 256 bits

  ② Unpredictability: use a CSPRNG (Cryptographically Secure Pseudo-Random Number Generator)
     → Math.random() is prohibited (predictable)
     → Date.now() is prohibited (guessable)
     → UUID v4 is acceptable but has only 122 bits of entropy

  ③ Uniqueness: collisions are practically impossible
     → Collision probability for a 256-bit random value ≈ 0
     → Even considering birthday attacks, 2^128 attempts are needed

  Session ID generation in various languages:

  Node.js:  crypto.randomBytes(32).toString('hex')     // 64-char hex string
  Python:   secrets.token_hex(32)                      // 64-char hex string
  Go:       rand.Read(make([]byte, 32))                // crypto/rand
  Ruby:     SecureRandom.hex(32)                       // 64-char hex string
  Java:     new SecureRandom().generateSeed(32)        // 32 bytes

  ⚠️ Examples of dangerous session ID generation:
    × Math.random().toString(36).substr(2)  // predictable
    × Date.now().toString(36)               // guessable
    × `user_${userId}_${timestamp}`         // information leak + guessable
    × md5(username + password)              // fixed value + rainbow table
```

```typescript
// セッション管理の完全実装
import crypto from 'crypto';

interface SessionData {
  userId: string;
  role: string;
  createdAt: number;          // セッション作成時刻
  lastAccessedAt: number;     // 最終アクセス時刻
  ipAddress: string;          // クライアント IP
  userAgent: string;          // ブラウザ情報
  absoluteExpiry: number;     // 絶対有効期限
  csrfToken: string;          // CSRF トークン
  metadata?: Record<string, unknown>; // 追加メタデータ
}

interface SessionStore {
  get(id: string): Promise<SessionData | null>;
  set(id: string, data: SessionData, options?: { ttl?: number }): Promise<void>;
  delete(id: string): Promise<void>;
  findByUserId(userId: string): Promise<Array<{ id: string; data: SessionData }>>;
  deleteByUserId(userId: string): Promise<number>;
}

interface SessionInfo {
  id: string;              // 短縮表示用
  createdAt: Date;
  lastAccessedAt: Date;
  ipAddress: string;
  userAgent: string;
  isCurrent: boolean;
}

class SessionManager {
  private readonly SESSION_ID_BYTES = 32;      // 256ビット
  private readonly IDLE_TIMEOUT = 30 * 60;     // 30分（スライディング）
  private readonly ABSOLUTE_TIMEOUT = 24 * 60 * 60; // 24時間（絶対）
  private readonly MAX_SESSIONS_PER_USER = 5;  // ユーザーあたりの最大セッション数

  constructor(private store: SessionStore) {}

  // セッション ID 生成
  private generateSessionId(): string {
    return crypto.randomBytes(this.SESSION_ID_BYTES).toString('hex');
  }

  // CSRF トークン生成
  private generateCsrfToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // セッション作成
  async create(
    userData: { userId: string; role: string },
    req: Request
  ): Promise<{ sessionId: string; csrfToken: string }> {
    // セッション数の制限チェック
    await this.enforceSessionLimit(userData.userId);

    const sessionId = this.generateSessionId();
    const csrfToken = this.generateCsrfToken();
    const now = Date.now();

    const sessionData: SessionData = {
      userId: userData.userId,
      role: userData.role,
      createdAt: now,
      lastAccessedAt: now,
      ipAddress: this.getClientIP(req),
      userAgent: req.headers.get('user-agent') || '',
      absoluteExpiry: now + this.ABSOLUTE_TIMEOUT * 1000,
      csrfToken,
    };

    await this.store.set(sessionId, sessionData, { ttl: this.IDLE_TIMEOUT });

    return { sessionId, csrfToken };
  }

  // セッション取得と検証
  async get(sessionId: string): Promise<SessionData | null> {
    if (!sessionId || typeof sessionId !== 'string') {
      return null;
    }

    // セッション ID のフォーマット検証（64文字の16進数）
    if (!/^[0-9a-f]{64}$/.test(sessionId)) {
      return null;
    }

    const data = await this.store.get(sessionId);
    if (!data) return null;

    // 絶対有効期限チェック
    if (Date.now() > data.absoluteExpiry) {
      await this.store.delete(sessionId);
      return null;
    }

    // アクセス時間を更新（スライディング有効期限）
    data.lastAccessedAt = Date.now();
    await this.store.set(sessionId, data, { ttl: this.IDLE_TIMEOUT });

    return data;
  }

  // セッション ID ローテーション（セッション固定攻撃対策）
  async rotate(oldSessionId: string): Promise<string> {
    const data = await this.store.get(oldSessionId);
    if (!data) throw new Error('Session not found');

    const newSessionId = this.generateSessionId();

    // 旧セッションを削除、新セッションを作成
    await this.store.delete(oldSessionId);

    // CSRF トークンも再生成
    data.csrfToken = this.generateCsrfToken();
    await this.store.set(newSessionId, data, { ttl: this.IDLE_TIMEOUT });

    return newSessionId;
  }

  // ログアウト（単一セッション）
  async destroy(sessionId: string): Promise<void> {
    await this.store.delete(sessionId);
  }

  // 全セッション無効化（パスワード変更時等）
  async destroyAllForUser(userId: string): Promise<number> {
    return this.store.deleteByUserId(userId);
  }

  // 特定セッション以外を全て無効化（「他の全デバイスからログアウト」）
  async destroyOtherSessions(userId: string, currentSessionId: string): Promise<number> {
    const sessions = await this.store.findByUserId(userId);
    let count = 0;
    for (const session of sessions) {
      if (session.id !== currentSessionId) {
        await this.store.delete(session.id);
        count++;
      }
    }
    return count;
  }

  // セッション数制限の強制
  private async enforceSessionLimit(userId: string): Promise<void> {
    const sessions = await this.store.findByUserId(userId);
    if (sessions.length >= this.MAX_SESSIONS_PER_USER) {
      // 最も古いセッションを削除
      const sorted = sessions.sort(
        (a, b) => a.data.lastAccessedAt - b.data.lastAccessedAt
      );
      const toRemove = sorted.slice(0, sessions.length - this.MAX_SESSIONS_PER_USER + 1);
      for (const session of toRemove) {
        await this.store.delete(session.id);
      }
    }
  }

  // アクティブセッション一覧（ユーザーに表示）
  async getActiveSessions(
    userId: string,
    currentSessionId: string
  ): Promise<SessionInfo[]> {
    const sessions = await this.store.findByUserId(userId);
    return sessions.map((s) => ({
      id: s.id.substring(0, 8) + '...',  // 完全な ID は非公開
      createdAt: new Date(s.data.createdAt),
      lastAccessedAt: new Date(s.data.lastAccessedAt),
      ipAddress: this.maskIP(s.data.ipAddress),
      userAgent: s.data.userAgent,
      isCurrent: s.id === currentSessionId,
    }));
  }

  // IP アドレスのマスキング
  private maskIP(ip: string): string {
    if (ip.includes(':')) {
      // IPv6: 最初の4セグメントのみ
      return ip.split(':').slice(0, 4).join(':') + ':...';
    }
    // IPv4: 最後のオクテットをマスク
    return ip.replace(/\.\d+$/, '.***');
  }

  // クライアント IP の取得
  private getClientIP(req: Request): string {
    // プロキシ環境ではヘッダーから取得
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) {
      // 最初の IP（クライアント IP）を取得
      return forwarded.split(',')[0].trim();
    }
    const realIP = req.headers.get('x-real-ip');
    if (realIP) return realIP;

    // 直接接続の場合
    return '0.0.0.0'; // フレームワーク依存
  }
}
```

### 4.3 Redis-Based Session Store Implementation

```typescript
// Redis を使ったセッションストアの実装
import Redis from 'ioredis';

class RedisSessionStore implements SessionStore {
  private redis: Redis;
  private readonly PREFIX = 'sess:';
  private readonly USER_INDEX_PREFIX = 'user_sess:';

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      // 接続プール設定
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) return null; // 3回リトライ後に停止
        return Math.min(times * 200, 2000); // 200ms, 400ms, 600ms
      },
      // TLS 設定（本番環境）
      tls: process.env.NODE_ENV === 'production' ? {} : undefined,
    });
  }

  async get(id: string): Promise<SessionData | null> {
    const data = await this.redis.get(this.PREFIX + id);
    if (!data) return null;

    try {
      return JSON.parse(data);
    } catch {
      // 破損したデータは削除
      await this.delete(id);
      return null;
    }
  }

  async set(id: string, data: SessionData, options?: { ttl?: number }): Promise<void> {
    const key = this.PREFIX + id;
    const serialized = JSON.stringify(data);

    if (options?.ttl) {
      // TTL 付きで保存（スライディング有効期限）
      await this.redis.setex(key, options.ttl, serialized);
    } else {
      await this.redis.set(key, serialized);
    }

    // ユーザー → セッション ID のインデックスを更新
    await this.redis.sadd(this.USER_INDEX_PREFIX + data.userId, id);
    // インデックス自体にも TTL を設定（孤立防止）
    await this.redis.expire(
      this.USER_INDEX_PREFIX + data.userId,
      (options?.ttl || 86400) + 3600 // セッション TTL + 余裕1時間
    );
  }

  async delete(id: string): Promise<void> {
    // セッションデータを取得してからユーザーインデックスを更新
    const data = await this.get(id);
    if (data) {
      await this.redis.srem(this.USER_INDEX_PREFIX + data.userId, id);
    }
    await this.redis.del(this.PREFIX + id);
  }

  async findByUserId(userId: string): Promise<Array<{ id: string; data: SessionData }>> {
    const sessionIds = await this.redis.smembers(this.USER_INDEX_PREFIX + userId);
    const results: Array<{ id: string; data: SessionData }> = [];

    for (const id of sessionIds) {
      const data = await this.get(id);
      if (data) {
        results.push({ id, data });
      } else {
        // 期限切れのセッション ID をインデックスから削除
        await this.redis.srem(this.USER_INDEX_PREFIX + userId, id);
      }
    }

    return results;
  }

  async deleteByUserId(userId: string): Promise<number> {
    const sessionIds = await this.redis.smembers(this.USER_INDEX_PREFIX + userId);
    if (sessionIds.length === 0) return 0;

    // パイプラインで一括削除（パフォーマンス最適化）
    const pipeline = this.redis.pipeline();
    for (const id of sessionIds) {
      pipeline.del(this.PREFIX + id);
    }
    pipeline.del(this.USER_INDEX_PREFIX + userId);
    await pipeline.exec();

    return sessionIds.length;
  }

  // ヘルスチェック
  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  // クリーンアップ（定期実行）
  async cleanup(): Promise<number> {
    // Redis の TTL により自動的にクリーンアップされるが、
    // ユーザーインデックスの孤立エントリを掃除
    let cleaned = 0;
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        this.USER_INDEX_PREFIX + '*',
        'COUNT',
        100
      );
      cursor = nextCursor;

      for (const key of keys) {
        const sessionIds = await this.redis.smembers(key);
        for (const id of sessionIds) {
          const exists = await this.redis.exists(this.PREFIX + id);
          if (!exists) {
            await this.redis.srem(key, id);
            cleaned++;
          }
        }
      }
    } while (cursor !== '0');

    return cleaned;
  }
}
```

---

## 5. Session Fixation Attacks and Countermeasures

```
Session Fixation Attack:

  Attack flow:

  Attacker                       Victim                       Server
    │                             │                           │
    │ ① Access the site           │                           │
    │ ─────────────────────────────────────────────────────>  │
    │                             │                           │
    │ ② Obtain session ID         │                           │
    │ (session_id = "known_id")   │                           │
    │ <─────────────────────────────────────────────────────  │
    │                             │                           │
    │ ③ Send link to victim       │                           │
    │ (https://site.com/?sid=     │                           │
    │  known_id)                  │                           │
    │ ──────────────────────────> │                           │
    │                             │                           │
    │                             │ ④ Click the link          │
    │                             │ ──────────────────────>   │
    │                             │                           │
    │                             │ ⑤ Log in                  │
    │                             │ (session_id=known_id)     │
    │                             │ ──────────────────────>   │
    │                             │                           │
    │ ⑥ Access with same          │                           │
    │    session_id               │                           │
    │ ─────────────────────────────────────────────────────>  │
    │                             │                           │
    │ ⑦ Access as logged-in user  │                           │
    │ <─────────────────────────────────────────────────────  │

  Countermeasures (required):
    1. Regenerate session ID on successful login (rotation)
    2. Reject session IDs received via URL parameters
    3. Manage session IDs via cookies only
    4. Do not copy pre-login session data to the new session
```

```typescript
// ログイン処理でのセッション ID ローテーション
async function handleLogin(
  email: string,
  password: string,
  req: Request,
  res: Response
) {
  // 1. ユーザー認証
  const user = await authenticateUser(email, password);
  if (!user) {
    // ユーザー列挙攻撃を防ぐため、具体的なエラーメッセージは返さない
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // 2. 既存セッションがあれば破棄（セッション固定攻撃対策の核心）
  const oldSessionId = req.cookies['__Host-session_id'];
  if (oldSessionId) {
    await sessionManager.destroy(oldSessionId);
  }

  // 3. 新しいセッション ID で作成
  const { sessionId, csrfToken } = await sessionManager.create(
    { userId: user.id, role: user.role },
    req
  );

  // 4. Cookie に新しいセッション ID を設定
  res.cookie('__Host-session_id', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  });

  // 5. CSRF トークンを返す（JavaScript で取得させる）
  return res.json({
    user: { id: user.id, email: user.email },
    csrfToken,
  });
}

// 権限変更時のセッション ID ローテーション
async function handleRoleChange(
  userId: string,
  newRole: string,
  req: Request,
  res: Response
) {
  const sessionId = req.cookies['__Host-session_id'];
  if (!sessionId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // セッション ID を再生成（権限昇格攻撃の防止）
  const newSessionId = await sessionManager.rotate(sessionId);

  // 新しい Cookie を設定
  res.cookie('__Host-session_id', newSessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.json({ success: true });
}
```

---

## 6. Session Hijacking Attacks and Countermeasures

```
Session hijacking methods:

  ① Network eavesdropping (Sniffing):
     → Intercept session ID over unencrypted communication
     → Countermeasure: Require HTTPS + Secure cookie attribute

  ② XSS (Cross-Site Scripting):
     → Read document.cookie via JavaScript
     → Countermeasure: HttpOnly cookie attribute + CSP header

  ③ CSRF (Cross-Site Request Forgery):
     → Send unintended requests from the user's browser
     → Countermeasure: SameSite=Lax + CSRF token

  ④ Session ID guessing:
     → Guess session IDs generated with weak randomness
     → Countermeasure: Use CSPRNG with 256+ bits of randomness

  ⑤ Side-channel attacks:
     → Session ID leaks via Referer header
     → Countermeasure: Do not include session ID in URL + Referrer-Policy header

  Overview of defense-in-depth:

  ┌────────────────────────────────────────────┐
  │              Defense Layers                │
  │                                            │
  │  Layer 1: Transport          HTTPS required│
  │  Layer 2: Cookie attributes  HttpOnly, Secure│
  │  Layer 3: CSRF protection    SameSite, Token│
  │  Layer 4: Session ID         CSPRNG 256bit │
  │  Layer 5: Rotation           On login/role change│
  │  Layer 6: Expiration         Sliding + absolute│
  │  Layer 7: Anomaly detection  IP/UA change detection│
  │  Layer 8: Concurrency control Max sessions │
  └────────────────────────────────────────────┘
```

```typescript
// セッションの異常検知ミドルウェア
async function sessionAnomalyDetection(
  req: Request,
  session: SessionData
): Promise<{ valid: boolean; reason?: string }> {
  const currentIP = getClientIP(req);
  const currentUA = req.headers.get('user-agent') || '';

  // 1. IP アドレスの急激な変更を検知
  if (session.ipAddress !== currentIP) {
    // 同一 ISP/国からの変更は許容（モバイル回線等）
    const isSameRegion = await checkSameGeoRegion(session.ipAddress, currentIP);

    if (!isSameRegion) {
      // 異なる地域からのアクセス → 要注意
      await logSecurityEvent({
        type: 'session_ip_change',
        userId: session.userId,
        oldIP: session.ipAddress,
        newIP: currentIP,
        severity: 'warning',
      });

      // 高セキュリティモードでは再認証を要求
      if (await isHighSecurityMode(session.userId)) {
        return { valid: false, reason: 'ip_change_detected' };
      }
    }
  }

  // 2. User-Agent の変更を検知
  if (session.userAgent && session.userAgent !== currentUA) {
    // User-Agent が完全に変わった場合（ブラウザの変更は通常ありえない）
    await logSecurityEvent({
      type: 'session_ua_change',
      userId: session.userId,
      oldUA: session.userAgent,
      newUA: currentUA,
      severity: 'high',
    });

    return { valid: false, reason: 'useragent_change_detected' };
  }

  // 3. 不可能な移動速度の検知（Impossible Travel）
  if (session.ipAddress !== currentIP) {
    const timeDiff = Date.now() - session.lastAccessedAt;
    const distance = await calculateGeoDistance(session.ipAddress, currentIP);
    const speedKmH = distance / (timeDiff / 3600000);

    if (speedKmH > 1000) { // 時速1000km以上は物理的に不可能
      await logSecurityEvent({
        type: 'impossible_travel',
        userId: session.userId,
        speed: speedKmH,
        severity: 'critical',
      });

      return { valid: false, reason: 'impossible_travel' };
    }
  }

  return { valid: true };
}
```

---

## 7. Session Expiration Strategies

```
Types of expiration:

  ① Absolute Timeout:
     → Expires N hours after session creation
     → Example: automatic logout after 24 hours
     → For systems with strict security requirements
     → Forces logout even for active users

  ② Sliding / Idle Timeout:
     → Expires N minutes after last activity
     → Active users keep their session alive
     → Example: expires after 30 minutes of inactivity
     → Implemented by updating Redis TTL

  ③ Hybrid (recommended):
     → Combination of sliding + absolute timeout
     → Example: extends on activity but expires after 72 hours at most
     → Combines the advantages of both

  Timeline:

  Login         Access    Access   30min idle  Expire
    │              │         │         │           │
    ▼              ▼         ▼         ▼           ▼
    ├──────────────┼─────────┼─────────┼───────────┤
    │← 30min TTL →│← reset →│← reset →│← 30min → │
    │                                              │
    │← ─── Absolute timeout (24 hours) ─── ──→    │
    │                                              │
    │  TTL keeps resetting while user is active    │
    │  But session expires when absolute limit hits│

  Recommended combinations:

  ┌──────────────────┬───────────┬──────────┬──────────────────┐
  │ Application      │ Sliding   │ Absolute │ Remember Me      │
  ├──────────────────┼───────────┼──────────┼──────────────────┤
  │ General web app  │ 30 min    │ 24 hours │ 30 days          │
  │ E-commerce       │ 60 min    │ 72 hours │ 90 days          │
  │ Finance/Healthcare│ 15 min   │ 8 hours  │ None             │
  │ Social media     │ 24 hours  │ 30 days  │ 365 days         │
  │ Admin panel      │ 15 min    │ 4 hours  │ None             │
  │ B2B SaaS         │ 60 min    │ 12 hours │ 30 days          │
  └──────────────────┴───────────┴──────────┴──────────────────┘
```

```typescript
// Remember Me 機能の安全な実装
import crypto from 'crypto';

interface RememberMeToken {
  id: string;
  userId: string;
  tokenHash: string;    // ハッシュ化して保存（DB 漏洩対策）
  series: string;       // トークンシリーズ（盗難検知用）
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt: Date;
  userAgent: string;
  ipAddress: string;
}

class RememberMeManager {
  // Remember Me トークンの作成
  async create(
    userId: string,
    req: Request
  ): Promise<{ token: string; series: string }> {
    const token = crypto.randomBytes(32).toString('hex');
    const series = crypto.randomBytes(16).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await db.rememberToken.create({
      data: {
        userId,
        tokenHash,
        series,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30日
        createdAt: new Date(),
        lastUsedAt: new Date(),
        userAgent: req.headers.get('user-agent') || '',
        ipAddress: getClientIP(req),
      },
    });

    return { token: `${series}:${token}`, series };
  }

  // Remember Me トークンの検証と更新
  async verify(
    cookieValue: string,
    req: Request
  ): Promise<{ userId: string; newToken: string } | null> {
    const [series, token] = cookieValue.split(':');
    if (!series || !token) return null;

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // シリーズでトークンを検索
    const record = await db.rememberToken.findFirst({
      where: {
        series,
        expiresAt: { gt: new Date() },
      },
    });

    if (!record) return null;

    // トークンハッシュの検証
    if (record.tokenHash !== tokenHash) {
      // シリーズは一致するがトークンが不一致 → トークン盗難の可能性
      // このシリーズの全トークンを無効化
      await db.rememberToken.deleteMany({ where: { series } });

      // ユーザーに警告通知
      await sendSecurityAlert(record.userId, {
        type: 'remember_me_theft_detected',
        ip: getClientIP(req),
        userAgent: req.headers.get('user-agent') || '',
      });

      // 全セッションを無効化（被害を最小化）
      await sessionManager.destroyAllForUser(record.userId);

      return null;
    }

    // トークンローテーション（使用したら新しいトークンを発行）
    const newToken = crypto.randomBytes(32).toString('hex');
    const newTokenHash = crypto.createHash('sha256').update(newToken).digest('hex');

    await db.rememberToken.update({
      where: { id: record.id },
      data: {
        tokenHash: newTokenHash,
        lastUsedAt: new Date(),
        userAgent: req.headers.get('user-agent') || '',
        ipAddress: getClientIP(req),
      },
    });

    return {
      userId: record.userId,
      newToken: `${series}:${newToken}`,
    };
  }

  // Remember Me トークンの無効化
  async revoke(series: string): Promise<void> {
    await db.rememberToken.deleteMany({ where: { series } });
  }

  // ユーザーの全 Remember Me トークンを無効化
  async revokeAllForUser(userId: string): Promise<void> {
    await db.rememberToken.deleteMany({ where: { userId } });
  }
}

// セッション切れ時の Remember Me による自動復元
async function restoreSession(req: Request, res: Response): Promise<SessionData | null> {
  // まずセッションを確認
  const sessionId = getCookie(req, '__Host-session_id');
  if (sessionId) {
    const session = await sessionManager.get(sessionId);
    if (session) return session;
  }

  // セッション切れなら Remember Me トークンを確認
  const rememberCookie = getCookie(req, '__Secure-remember_me');
  if (!rememberCookie) return null;

  const rememberMeManager = new RememberMeManager();
  const result = await rememberMeManager.verify(rememberCookie, req);
  if (!result) {
    // 無効なトークン → Cookie を削除
    clearCookie(res, '__Secure-remember_me');
    return null;
  }

  // 新しいセッションを作成
  const user = await db.user.findUnique({ where: { id: result.userId } });
  if (!user || !user.active) return null;

  const { sessionId: newSessionId } = await sessionManager.create(
    { userId: user.id, role: user.role },
    req
  );

  // 新しいセッション Cookie を設定
  setCookie(res, '__Host-session_id', newSessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60,
  });

  // 新しい Remember Me Cookie を設定（ローテーション）
  setCookie(res, '__Secure-remember_me', result.newToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });

  // 監査ログ
  await logAuthEvent({
    type: 'session_restored_via_remember_me',
    userId: user.id,
    ip: getClientIP(req),
  });

  return sessionManager.get(newSessionId);
}
```

---

## 8. CSRF Protection and Sessions

```
CSRF (Cross-Site Request Forgery) attack:

  Attack flow:
    ① User is logged in to bank.com (has cookie)
    ② User visits attacker's site evil.com
    ③ evil.com has a hidden form: <form action="https://bank.com/transfer" method="POST">
    ④ JavaScript auto-submits it
    ⑤ Browser automatically attaches bank.com cookie
    ⑥ bank.com cannot distinguish it from a legitimate request

  Comparison of countermeasures:

  ┌──────────────────┬──────────────┬────────────────┬──────────────┐
  │ Countermeasure   │ Impl. Effort │ Protection     │ Side Effects │
  ├──────────────────┼──────────────┼────────────────┼──────────────┤
  │ SameSite=Lax     │ Low          │ High           │ Few          │
  │ SameSite=Strict  │ Low          │ Highest        │ UX impact    │
  │ CSRF token       │ Medium       │ High           │ None         │
  │ Double Submit    │ Medium       │ Medium         │ None         │
  │ Origin header    │ Low          │ Medium         │ Old browsers │
  │ Referer check    │ Low          │ Low            │ Privacy      │
  └──────────────────┴──────────────┴────────────────┴──────────────┘

  Recommendation: SameSite=Lax + CSRF token (defense-in-depth)
```

```typescript
// CSRF 対策の実装（Synchronizer Token Pattern）

// セッション作成時に CSRF トークンを生成
function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// CSRF トークン検証ミドルウェア
function csrfProtection() {
  return async (req: Request, res: Response, next: Function) => {
    // GET, HEAD, OPTIONS はスキップ（安全なメソッド）
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const sessionId = req.cookies['__Host-session_id'];
    if (!sessionId) {
      return res.status(403).json({ error: 'No session' });
    }

    const session = await sessionManager.get(sessionId);
    if (!session) {
      return res.status(403).json({ error: 'Invalid session' });
    }

    // CSRF トークンの検証
    const csrfToken = req.headers['x-csrf-token']
      || req.body?._csrf
      || req.query?._csrf;

    if (!csrfToken || !timingSafeEqual(csrfToken, session.csrfToken)) {
      await logSecurityEvent({
        type: 'csrf_token_mismatch',
        userId: session.userId,
        ip: getClientIP(req),
        severity: 'warning',
      });
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }

    next();
  };
}

// タイミングセーフな文字列比較（タイミング攻撃防止）
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return crypto.timingSafeEqual(bufA, bufB);
}

// Double Submit Cookie パターン（代替手法）
// Cookie と リクエストヘッダーの両方に同じトークンを設定
function doubleSubmitCsrf() {
  return async (req: Request, res: Response, next: Function) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      // GET リクエスト時に CSRF トークン Cookie を設定
      if (!req.cookies['csrf_token']) {
        const token = crypto.randomBytes(32).toString('hex');
        res.cookie('csrf_token', token, {
          httpOnly: false,  // JavaScript からの読み取りを許可
          secure: true,
          sameSite: 'lax',
          path: '/',
        });
      }
      return next();
    }

    // POST リクエスト時に Cookie とヘッダーの一致を検証
    const cookieToken = req.cookies['csrf_token'];
    const headerToken = req.headers['x-csrf-token'];

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return res.status(403).json({ error: 'CSRF validation failed' });
    }

    next();
  };
}

// フロントエンド（React）での CSRF トークン送信
// fetch のラッパー
async function secureFetch(url: string, options: RequestInit = {}) {
  const csrfToken = document.querySelector<HTMLMetaElement>(
    'meta[name="csrf-token"]'
  )?.content;

  return fetch(url, {
    ...options,
    credentials: 'same-origin', // Cookie を送信
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken || '',
    },
  });
}
```

---

## 9. Concurrent Session Management

```
Controlling concurrent sessions:

  ① Unlimited (default):
     → Simultaneous login from multiple devices
     → Common for general web apps
     → Easy to manage but hard to detect misuse

  ② Maximum count limit:
     → e.g., up to 5 devices
     → Automatically logs out oldest session
     → Well-balanced (recommended)

  ③ Single session:
     → One device only
     → Common in financial systems
     → New login invalidates old session
     → Significant UX impact (forced logout on another device)

  ④ By device type:
     → PC: 1 session, Mobile: 1 session
     → One session per device type
     → Device fingerprint reliability is a challenge

  Session management UI pattern:

  ┌─────────────────────────────────────────────────────┐
  │  Active Sessions                                    │
  │                                                     │
  │  🖥️ Chrome on macOS          ★ Current session      │
  │     Last access: 2 minutes ago                      │
  │     IP: 203.0.113.***                               │
  │                                                     │
  │  📱 Safari on iOS                                    │
  │     Last access: 3 hours ago        [Log out]       │
  │     IP: 198.51.100.***                              │
  │                                                     │
  │  🖥️ Firefox on Windows                              │
  │     Last access: 2 days ago         [Log out]       │
  │     IP: 192.0.2.***                                 │
  │                                                     │
  │  [Log out from all other devices]                   │
  └─────────────────────────────────────────────────────┘
```

```typescript
// アクティブセッション管理 API
import { parseUserAgent } from './utils/ua-parser';

// セッション一覧の取得
app.get('/api/sessions', async (req, res) => {
  const sessionId = req.cookies['__Host-session_id'];
  const session = await sessionManager.get(sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const activeSessions = await sessionManager.getActiveSessions(
    session.userId,
    sessionId
  );

  // User-Agent を人間が読める形式に変換
  const formatted = activeSessions.map((s) => ({
    ...s,
    device: parseUserAgent(s.userAgent),
  }));

  res.json({ sessions: formatted });
});

// 特定セッションの無効化
app.delete('/api/sessions/:sessionDisplayId', async (req, res) => {
  const currentSessionId = req.cookies['__Host-session_id'];
  const session = await sessionManager.get(currentSessionId);
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // 表示用 ID から実際のセッションを特定
  const allSessions = await sessionManager.getActiveSessions(
    session.userId,
    currentSessionId
  );

  const target = allSessions.find(
    (s) => s.id === req.params.sessionDisplayId
  );

  if (!target) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (target.isCurrent) {
    return res.status(400).json({ error: 'Cannot revoke current session' });
  }

  // 実際のセッション ID で削除（表示用 ID ではない）
  // セキュリティ上、内部のマッピングが必要
  await revokeSessionByDisplayId(session.userId, req.params.sessionDisplayId);

  res.json({ success: true });
});

// 他の全デバイスからログアウト
app.post('/api/sessions/revoke-others', async (req, res) => {
  const sessionId = req.cookies['__Host-session_id'];
  const session = await sessionManager.get(sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const count = await sessionManager.destroyOtherSessions(
    session.userId,
    sessionId
  );

  // 監査ログ
  await logAuthEvent({
    type: 'revoke_other_sessions',
    userId: session.userId,
    revokedCount: count,
    ip: getClientIP(req),
  });

  res.json({ success: true, revokedCount: count });
});
```

---

## 10. Implementing Logout

```
Types of logout:

  ① Single logout:
     → Destroy the current session only
     → Sessions on other devices remain active

  ② Global logout:
     → Destroy all sessions for the user
     → On password change, security incident

  ③ Federated logout:
     → Notify the IdP in SSO environments
     → SAML SLO (Single Logout)
     → OIDC RP-Initiated Logout

  Logout checklist:
    ✓ Delete session data on the server side
    ✓ Invalidate session cookie (Max-Age=0)
    ✓ Invalidate Remember Me token
    ✓ Invalidate CSRF token
    ✓ Clear client-side cache (Cache-Control header)
    ✓ Disconnect WebSocket connections
    ✓ Record audit log
```

```typescript
// 完全なログアウト実装
app.post('/api/auth/logout', async (req, res) => {
  const sessionId = req.cookies['__Host-session_id'];

  if (sessionId) {
    const session = await sessionManager.get(sessionId);

    if (session) {
      // 監査ログ
      await logAuthEvent({
        type: 'logout',
        userId: session.userId,
        ip: getClientIP(req),
        userAgent: req.headers['user-agent'] || '',
      });

      // セッション破棄
      await sessionManager.destroy(sessionId);
    }
  }

  // Remember Me トークンの無効化
  const rememberCookie = req.cookies['__Secure-remember_me'];
  if (rememberCookie) {
    const [series] = rememberCookie.split(':');
    if (series) {
      await rememberMeManager.revoke(series);
    }
  }

  // 全 Cookie の無効化
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,  // 即座に失効
  };

  res.cookie('__Host-session_id', '', cookieOptions);
  res.cookie('__Secure-remember_me', '', cookieOptions);
  res.cookie('csrf_token', '', { ...cookieOptions, httpOnly: false });

  // キャッシュ制御（ログアウト後にブラウザバックで認証済みページが表示されることを防止）
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Clear-Site-Data': '"cache", "cookies", "storage"', // モダンブラウザ向け
  });

  res.json({ success: true, redirectTo: '/login' });
});

// グローバルログアウト（全デバイス）
app.post('/api/auth/logout-all', async (req, res) => {
  const sessionId = req.cookies['__Host-session_id'];
  const session = await sessionManager.get(sessionId);

  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // パスワード確認（セキュリティ強化）
  const { password } = req.body;
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user || !await verifyPassword(password, user.passwordHash)) {
    return res.status(403).json({ error: 'Password verification failed' });
  }

  // 全セッション破棄
  const count = await sessionManager.destroyAllForUser(session.userId);

  // 全 Remember Me トークン無効化
  await rememberMeManager.revokeAllForUser(session.userId);

  // 監査ログ
  await logAuthEvent({
    type: 'global_logout',
    userId: session.userId,
    revokedCount: count,
    ip: getClientIP(req),
  });

  // Cookie 無効化
  res.cookie('__Host-session_id', '', { maxAge: 0, path: '/' });
  res.cookie('__Secure-remember_me', '', { maxAge: 0, path: '/' });
  res.set('Clear-Site-Data', '"cache", "cookies", "storage"');

  res.json({ success: true, revokedCount: count, redirectTo: '/login' });
});
```

---

## 11. Sessions vs. JWT Comparison

```
Session-based authentication vs. JWT-based authentication:

  ┌──────────────────┬──────────────────────┬──────────────────────┐
  │ Item             │ Session              │ JWT                  │
  ├──────────────────┼──────────────────────┼──────────────────────┤
  │ State management │ Server-side (Stateful)│ Client (Stateless)  │
  │ Storage          │ Requires Redis/DB    │ Not required         │
  │ Immediate revoke │ ✓ Delete from store  │ ✗ Valid until expiry │
  │ Scalability      │ Requires shared store│ High (no store needed)│
  │ Security         │ Cookie (HttpOnly)    │ localStorage or Cookie│
  │ Payload          │ Managed server-side  │ Included in token    │
  │ CSRF risk        │ Yes (auto cookie)    │ No (if sent manually)│
  │ XSS risk         │ Low (HttpOnly Cookie)│ High (localStorage)  │
  │ Microservices    │ Needs shared store   │ Verifiable per service│
  │ Mobile support   │ Depends on cookies   │ Bearer token         │
  │ Impl. complexity │ Simple               │ Refresh etc. complex │
  └──────────────────┴──────────────────────┴──────────────────────┘

  Recommendation:
    Web app (SPA + server) → Session + Cookie
    API (mobile, microservices) → JWT
    Hybrid → Session (Web) + JWT (API)

  Why Session + Cookie is recommended for web apps:
    1. HttpOnly Cookie protects tokens from XSS
    2. Immediate revocation is possible (logout, account suspension)
    3. Full server-side control over session data
    4. No need for refresh token management like JWT
    5. OWASP also recommends this pattern
```

---

## 12. Performance Optimization

```
Performance considerations for session management:

  ① Redis latency:
     → Typically <1ms (same region)
     → GET + SET (TTL update) per request = 2 round trips
     → Can be optimized with pipelining

  ② Session data size:
     → Keep small (<1KB recommended)
     → Fetch user info from DB; store only IDs in session
     → Store large data outside the session

  ③ Cookie size:
     → Cookie header limit: ~4KB (browser-dependent)
     → Store only session ID (64 chars ≈ 64 bytes)
     → Large cookies affect every request

  ④ Session store selection:
     → Redis: fastest, automatic TTL management, supports clustering
     → PostgreSQL: no extra infrastructure, ACID guarantees
     → DynamoDB: serverless, auto-scaling
     → In-memory: development only (lost on restart)

  Redis performance tuning:
    → Connection Pooling: reuse connections
    → Pipeline: batch multiple commands
    → Cluster: horizontal scaling for large environments
    → Sentinel: high availability (automatic failover)
```

```typescript
// パフォーマンス最適化されたセッションミドルウェア
class OptimizedSessionMiddleware {
  private cache: Map<string, { data: SessionData; cachedAt: number }> = new Map();
  private readonly CACHE_TTL = 5000; // 5秒のインメモリキャッシュ

  async getSession(req: Request): Promise<SessionData | null> {
    const sessionId = req.cookies['__Host-session_id'];
    if (!sessionId) return null;

    // インメモリキャッシュをチェック（同一リクエスト内の重複取得を防止）
    const cached = this.cache.get(sessionId);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL) {
      return cached.data;
    }

    // Redis から取得
    const data = await sessionManager.get(sessionId);
    if (!data) return null;

    // キャッシュに保存
    this.cache.set(sessionId, { data, cachedAt: Date.now() });

    // キャッシュのクリーンアップ（メモリリーク防止）
    if (this.cache.size > 10000) {
      const now = Date.now();
      for (const [key, value] of this.cache) {
        if (now - value.cachedAt > this.CACHE_TTL) {
          this.cache.delete(key);
        }
      }
    }

    return data;
  }

  // TTL 更新の最適化（毎リクエストではなく間隔を空ける）
  async touchSession(sessionId: string, data: SessionData): Promise<void> {
    const lastAccess = data.lastAccessedAt;
    const now = Date.now();

    // 最後の更新から60秒以内は TTL 更新をスキップ
    if (now - lastAccess < 60 * 1000) {
      return;
    }

    data.lastAccessedAt = now;
    await sessionManager.store.set(sessionId, data, { ttl: 30 * 60 });
  }
}
```

---

## 13. Combined with Security Headers

```typescript
// セッション管理に関連するセキュリティヘッダー
import helmet from 'helmet';

app.use(helmet({
  // Content Security Policy（XSS 防御）
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],  // iframe 埋め込み禁止
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },

  // HSTS（HTTPS 強制）
  strictTransportSecurity: {
    maxAge: 31536000,        // 1年
    includeSubDomains: true,
    preload: true,
  },

  // X-Frame-Options（クリックジャッキング防御）
  frameguard: { action: 'deny' },

  // Referrer Policy（セッション ID の漏洩防止）
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

  // X-Content-Type-Options
  noSniff: true,
}));

// Cache-Control（認証済みページのキャッシュ防止）
app.use((req, res, next) => {
  if (req.cookies['__Host-session_id']) {
    // 認証済みリクエストのレスポンスをキャッシュしない
    res.set({
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
  }
  next();
});
```

---

## 14. Anti-Patterns

```
Session management anti-patterns:

  Anti-pattern 1: Including session ID in the URL
     × https://example.com/dashboard?sid=abc123
     → Leaked via Referer header
     → Remains in browser history
     → Shared via bookmarks
     → Recorded in access logs

  Anti-pattern 2: Generating session ID with Math.random()
     × const sid = Math.random().toString(36)
     → Predictable (V8's xorshift128+ can be reversed)
     → Insufficient entropy (~52 bits)
     → Guessable via brute force

  Anti-pattern 3: Storing session data directly in a cookie
     × Set-Cookie: user={"id":"123","role":"admin","email":"..."}
     → Client can tamper with it (e.g., change role to admin)
     → Cookie size limit (4KB)
     → Risk of personal data leakage
     ✓ Correct approach: store only the session ID in the cookie; keep data server-side

  Anti-pattern 4: Only deleting the cookie on logout
     × res.clearCookie('session_id')  // server-side session remains
     → Attacker can continue to access if they know the session ID
     ✓ Correct approach: always delete server-side session data as well

  Anti-pattern 5: Not rotating the session ID
     × Using the same session ID before and after login
     → Vulnerable to session fixation attacks
     ✓ Correct approach: always generate a new session ID on successful login
```

---

## 15. Edge Cases

```
Session management edge cases:

  ① When Redis goes down:
     → Session retrieval fails → all users appear logged out
     → Countermeasure: Redis Sentinel/Cluster for redundancy
     → Fallback: retrieve sessions directly from DB (slow)
     → Graceful degradation: temporarily issue JWTs

  ② Clock skew:
     → Time differences between servers make session expiry inaccurate
     → Countermeasure: synchronize with NTP; use Redis TTL (independent of server clock)

  ③ Cookie update race conditions:
     → Simultaneous requests from multiple tabs → session ID rotation conflict
     → Subsequent requests with old session ID fail
     → Countermeasure: keep old ID valid for a short period (30 seconds) after rotation

  ④ Browser cookie deletion:
     → User manually deletes cookies
     → Auto-restored if Remember Me is set
     → Otherwise, re-login is required

  ⑤ Cookie size limit exceeded:
     → Browser truncates if total cookies exceed 4KB
     → Session cookie may be lost
     → Countermeasure: reduce unnecessary cookies; ensure session cookie priority

  ⑥ Third-party cookie blocking:
     → Safari ITP, Chrome cookie restrictions
     → First-party cookies on your own domain are unaffected
     → Auth inside iframes requires SameSite=None + CHIPS
```

```typescript
// Redis ダウン時のフォールバック
class ResilientSessionManager {
  constructor(
    private primaryStore: RedisSessionStore,
    private fallbackStore: DatabaseSessionStore
  ) {}

  async get(sessionId: string): Promise<SessionData | null> {
    try {
      // まず Redis を試行
      const data = await this.primaryStore.get(sessionId);
      if (data) return data;
    } catch (error) {
      // Redis 接続エラー → フォールバック
      console.error('Redis unavailable, falling back to DB:', error);

      try {
        return await this.fallbackStore.get(sessionId);
      } catch (dbError) {
        console.error('Fallback DB also failed:', dbError);
        return null;
      }
    }

    return null;
  }

  // セッション ID ローテーション時の競合対策
  async rotateWithGracePeriod(
    oldSessionId: string,
    gracePeriodMs: number = 30000 // 30秒
  ): Promise<string> {
    const data = await this.primaryStore.get(oldSessionId);
    if (!data) throw new Error('Session not found');

    const newSessionId = crypto.randomBytes(32).toString('hex');

    // 新セッションを作成
    await this.primaryStore.set(newSessionId, data, { ttl: 30 * 60 });

    // 旧セッションを短い TTL で維持（猶予期間）
    // 新セッション ID へのポインターを設定
    await this.primaryStore.set(
      oldSessionId,
      { ...data, redirectTo: newSessionId } as any,
      { ttl: Math.ceil(gracePeriodMs / 1000) }
    );

    return newSessionId;
  }
}
```

---

## 16. Exercises

### Exercise 1 (Basic): Basic Session Management Implementation

```
Task:
  Implement the following in an Express.js application:
  1. Session creation on login (with session ID rotation)
  2. Authentication middleware (session validation)
  3. Logout (server-side session deletion + cookie invalidation)
  4. Proper cookie attribute configuration

Verification points:
  - Is the session ID generated with crypto.randomBytes()?
  - Are HttpOnly, Secure, and SameSite set?
  - Is the session ID regenerated on login?
  - Is the server-side session also deleted on logout?
```

### Exercise 2 (Intermediate): Remember Me and Session Management UI

```
Task:
  Add the following features:
  1. Remember Me functionality (30-day token + rotation)
  2. Active sessions list API
  3. Specific session invalidation API
  4. Log out from all other devices API

Verification points:
  - Is the Remember Me token stored hashed in the DB?
  - Is rotation performed when the token is used?
  - Is theft detection implemented (series matches, token mismatches)?
  - Is the full session ID hidden from the sessions list?
```

### Exercise 3 (Advanced): Anomaly Detection and Security Hardening

```
Task:
  Add the following security enhancements to session management:
  1. IP address change detection (Impossible Travel Detection)
  2. User-Agent change detection
  3. Concurrent session limit (max 5 sessions, oldest invalidated first)
  4. CSRF protection (Synchronizer Token Pattern)
  5. Audit log for security events

Verification points:
  - Is the speed calculation for Impossible Travel correct?
  - Is the session invalidated when the User-Agent changes?
  - Does the session limit work correctly?
  - Is the CSRF token comparison timing-safe?
  - Are all security events recorded in the log?
```

---

## 17. FAQ / Troubleshooting

```
Q: Cookie is not being set / sent
A: Check the following:
   1. Secure=true but accessing via HTTP → use HTTPS
   2. SameSite=None but Secure is missing → add Secure
   3. Domain attribute does not match the request's domain
   4. Path attribute does not match the request path
   5. Max-Age=0 causes immediate expiration
   6. Browser's third-party cookie blocking is enabled
   7. Check via DevTools > Application > Cookies

Q: Session expires frequently
A: Check the following:
   1. Redis maxmemory-policy is allkeys-lru → session is evicted
      → Change to volatile-lru (evicts only keys with TTL)
   2. Redis is out of memory → add memory or reduce session data size
   3. Sliding TTL update is not working
   4. Absolute timeout is too short
   5. Load balancer routing to different servers
      → Use Redis as shared store (Sticky Session is not recommended)

Q: Still worried about CSRF even with SameSite=Lax
A: SameSite=Lax cannot prevent CSRF for GET requests:
   → Do not change state via GET (follow REST principles)
   → Add CSRF tokens for important operations
   → Always use POST/PUT/DELETE for state changes

Q: Ajax requests fail after session ID rotation
A: Multiple tabs problem:
   → Tab A rotates → new cookie is set
   → Tab B still holds old cookie → request fails
   → Countermeasure: keep old ID valid for 30 seconds after rotation
   → Or: prompt frontend to reload on 401 response

Q: Setting HttpOnly on cookie prevents reading the CSRF token
A: Ways to obtain the CSRF token:
   → Embed in HTML via <meta name="csrf-token">
   → Provide a dedicated GET endpoint (/api/csrf-token)
   → Double Submit Cookie pattern (separate cookie with HttpOnly=false)
   → Keep the session cookie itself as HttpOnly

Q: Should I use JWT or sessions?
A: Decision criteria:
   → Web app only → Session + Cookie (recommended)
   → Mobile app → JWT
   → Between microservices → JWT
   → Immediate revocation needed → Session
   → Serverless → JWT (no store needed)
   → Hybrid → Session for Web, JWT for API
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend fully understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world development?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Best Practice |
|------|---------------|
| Cookie attributes | HttpOnly + Secure + SameSite=Lax + __Host- prefix |
| Session ID | crypto.randomBytes(32) = 256 bits |
| Rotation | Regenerate ID on login and permission change |
| Expiration | Sliding (30 min) + Absolute (24 hours) |
| Remember Me | Separate token, stored hashed, with rotation |
| Logout | Delete from store + invalidate cookie + Clear-Site-Data |
| CSRF protection | SameSite=Lax + CSRF token (defense-in-depth) |
| Anomaly detection | IP/UA change detection, Impossible Travel |
| Session management | List view, individual/global invalidation |
| Performance | Redis + Connection Pool + optimized TTL updates |

---

## What to Read Next


---

## References

1. OWASP. "Session Management Cheat Sheet." cheatsheetseries.owasp.org, 2024.
2. RFC 6265. "HTTP State Management Mechanism." IETF, 2011.
3. RFC 6265bis. "Cookies: HTTP State Management Mechanism." IETF, 2024. (Draft)
4. MDN. "Set-Cookie." developer.mozilla.org, 2024.
5. MDN. "Using HTTP cookies." developer.mozilla.org, 2024.
6. OWASP. "Cross-Site Request Forgery Prevention Cheat Sheet." cheatsheetseries.owasp.org, 2024.
7. OWASP. "Session Management Testing." owasp.org/www-project-web-security-testing-guide, 2024.
8. NIST SP 800-63B. "Digital Identity Guidelines: Authentication and Lifecycle Management." NIST, 2017.
9. Chrome Developers. "SameSite cookies explained." web.dev, 2024.
10. Chrome Developers. "Cookies Having Independent Partitioned State (CHIPS)." developer.chrome.com, 2024.

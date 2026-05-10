# API Security

> A comprehensive guide to securely exposing APIs — covering OAuth 2.0/JWT authentication and authorization, rate limiting to prevent overload, input validation to defend against attacks, and GraphQL security.

## What You Will Learn

1. **API Threat Model** -- Each vulnerability category in the OWASP API Security Top 10 and implementation-level defenses
2. **OAuth 2.0 / OpenID Connect** -- Authorization flow selection, PKCE, token management, and revocation
3. **Secure JWT Implementation** -- Signature verification, claim validation, token storage, and refresh strategies
4. **Rate Limiting and API Protection** -- Algorithm comparison, distributed rate limiting, and DDoS defense
5. **Input Validation and Schema Validation** -- Server-side validation using OpenAPI, express-validator, and Zod
6. **GraphQL Security** -- Query depth limiting, cost analysis, and introspection control

### Prerequisites

- Basics of HTTP/HTTPS protocol (methods, status codes, headers)
- REST API design principles
- JSON structure and manipulation
- Basic server-side development experience with Node.js or Python

---

## 1. API Threat Model

### API Architecture and Attack Surface

```
                    Overview of the Attack Surface

Client           API Gateway          Backend
  |                    |                  |
  |  [Auth Attacks]    |                  |
  |  - Credential      |                  |
  |    Stuffing        |                  |
  |  - Brute Force     |                  |
  |  - Token Theft     |                  |
  |                    |                  |
  +------- HTTPS ----->|                  |
  |                    |  [Authz Attacks] |
  |                    |  - BOLA          |
  |                    |  - BFLA          |
  |                    |  - Mass Assign.  |
  |                    |                  |
  |                    +------ gRPC ----->|
  |                    |                  |
  |                    |                  |  [Backend Attacks]
  |                    |                  |  - Injection
  |                    |                  |  - SSRF
  |                    |                  |  - Business Logic
  |                    |                  |
  |<----- Response ----|<---- Response ---|
  |                    |                  |
  |  [Response Attacks]|                  |
  |  - Excessive Data  |                  |
  |  - Error Leakage   |                  |
```

### OWASP API Security Top 10 (2023) Details

```
+------+------------------------------------------------+-----------+
| Rank | Vulnerability                                   | Severity  |
+------+------------------------------------------------+-----------+
| API1 | Broken Object Level Authorization (BOLA)       | Critical  |
|      | → Unauthorized access to other users' resources|           |
+------+------------------------------------------------+-----------+
| API2 | Broken Authentication                          | Critical  |
|      | → Flaws in authentication mechanisms           |           |
+------+------------------------------------------------+-----------+
| API3 | Broken Object Property Level Authorization     | High      |
|      | → Missing authorization at property level      |           |
+------+------------------------------------------------+-----------+
| API4 | Unrestricted Resource Consumption              | High      |
|      | → No limits on resource consumption (DoS)      |           |
+------+------------------------------------------------+-----------+
| API5 | Broken Function Level Authorization            | High      |
|      | → Unauthorized access to admin functions       |           |
+------+------------------------------------------------+-----------+
| API6 | Unrestricted Access to Sensitive Business Flow | Medium    |
|      | → Abuse of business logic                      |           |
+------+------------------------------------------------+-----------+
| API7 | Server Side Request Forgery (SSRF)             | High      |
|      | → Unauthorized requests originating from server|           |
+------+------------------------------------------------+-----------+
| API8 | Security Misconfiguration                      | Medium    |
|      | → Inadequate security configuration            |           |
+------+------------------------------------------------+-----------+
| API9 | Improper Inventory Management                  | Medium    |
|      | → Poor API version/endpoint management         |           |
+------+------------------------------------------------+-----------+
| API10| Unsafe Consumption of APIs                     | Medium    |
|      | → Insecure use of external APIs                |           |
+------+------------------------------------------------+-----------+
```

### API1: BOLA (Broken Object Level Authorization) Details

```
Attack Scenario:

Legitimate user (user_id=123):
  GET /api/orders/1001 → 200 OK (their own order)

Attacker (user_id=456):
  GET /api/orders/1001 → 200 OK (another user's order is visible!)
  GET /api/orders/1002 → 200 OK (enumerating all orders sequentially)

Types of BOLA:
  1. IDOR (Insecure Direct Object Reference)
     → /api/users/123/profile → /api/users/124/profile

  2. Parameter Tampering
     → POST /api/transfer {"from": "my-account", "to": "attacker"}
     → POST /api/transfer {"from": "victim-account", "to": "attacker"}

  3. UUIDs are not inherently safe
     → Even if UUIDs cannot be guessed, if other resource UUIDs
        are included in a response, the attack becomes possible
```

```javascript
// BOLA defense implementation pattern (Express.js)

// NG: No authorization check on object ID alone
app.get('/api/orders/:orderId', async (req, res) => {
  const order = await Order.findById(req.params.orderId);
  res.json(order);  // Other users' orders can be retrieved
});

// OK: Middleware pattern to verify resource ownership
function authorizeResource(model, ownerField = 'userId') {
  return async (req, res, next) => {
    const resource = await model.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    if (resource[ownerField].toString() !== req.user.id) {
      // Note: Return 404 instead of 403 to hide resource existence
      return res.status(404).json({ error: 'Resource not found' });
    }
    req.resource = resource;
    next();
  };
}

app.get('/api/orders/:id', authenticate, authorizeResource(Order), (req, res) => {
  res.json(req.resource);
});

// OK: Owner filtering at query level (more secure)
app.get('/api/orders/:orderId', authenticate, async (req, res) => {
  const order = await Order.findOne({
    _id: req.params.orderId,
    userId: req.user.id,  // Filter by authenticated user's ID
  });
  if (!order) return res.status(404).json({ error: 'Not found' });
  res.json(order);
});

// OK: Combining RBAC + ABAC
app.get('/api/orders/:orderId', authenticate, async (req, res) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Not found' });

  // Admins can access all orders
  if (req.user.role === 'admin') return res.json(order);

  // Support staff can only access orders from their department
  if (req.user.role === 'support') {
    if (order.department !== req.user.department) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.json(order);
  }

  // Regular users can only access their own orders
  if (order.userId.toString() !== req.user.id) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json(order);
});
```

### API3: Mass Assignment Defense

```javascript
// NG: Using the request body as-is
app.put('/api/users/:id', authenticate, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body);
  // Attacker can send {"role": "admin", "verified": true}!
  res.json(user);
});

// OK: Whitelist of allowed fields
const ALLOWED_USER_FIELDS = ['name', 'email', 'bio', 'avatar'];

app.put('/api/users/:id', authenticate, async (req, res) => {
  // Filter using whitelist
  const updates = {};
  for (const field of ALLOWED_USER_FIELDS) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  const user = await User.findOneAndUpdate(
    { _id: req.params.id, _id: req.user.id },  // Ownership check
    { $set: updates },
    { new: true, select: '-password -__v' }     // Exclude password
  );

  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});
```

---

## 2. OAuth 2.0 / OpenID Connect

### Authorization Flow Selection Guide

```
What type of application is it?
  |
  +-- Server-side Web App
  |   → Authorization Code Flow (+ PKCE recommended)
  |   Reason: client_secret can be stored safely on server
  |
  +-- SPA (Single Page Application)
  |   → Authorization Code Flow + PKCE (required)
  |   Reason: client_secret cannot be stored in the browser
  |   Note: Implicit Flow is deprecated (RFC 9700)
  |
  +-- Mobile App / Desktop
  |   → Authorization Code Flow + PKCE
  |   Reason: client_secret cannot be stored on client
  |   Note: Redirect via custom URL scheme
  |
  +-- Machine-to-Machine (M2M)
  |   → Client Credentials Flow
  |   Reason: No user involvement, direct server-to-server auth
  |
  +-- IoT / Limited-input Devices
      → Device Authorization Flow (RFC 8628)
      Reason: Devices without browser or keyboard
```

### Authorization Code Flow + PKCE Details

```
Browser/App              Auth Server              Resource Server
    |                         |                         |
    | (1) Generate code_verifier (cryptographically random, 43-128 chars)
    | code_challenge = BASE64URL(SHA256(code_verifier))
    |                         |                         |
    |-- (2) /authorize -----> |                         |
    |   + response_type=code  |                         |
    |   + client_id           |                         |
    |   + redirect_uri        |                         |
    |   + scope=openid email  |                         |
    |   + state=random123     | (CSRF prevention)       |
    |   + code_challenge      |                         |
    |   + code_challenge_method=S256                    |
    |                         |                         |
    |  <-- (3) Login page --  |                         |
    |  -- User auth --------> |                         |
    |                         |                         |
    |  <-- (4) redirect ------|                         |
    |   + code=authcode123    |                         |
    |   + state=random123     | (Verify state)          |
    |                         |                         |
    |-- (5) POST /token ----->|                         |
    |   + grant_type=         |                         |
    |     authorization_code  |                         |
    |   + code=authcode123    |                         |
    |   + code_verifier       | (PKCE verification)    |
    |   + redirect_uri        |                         |
    |   + client_id           |                         |
    |                         |                         |
    |  <-- (6) tokens --------|                         |
    |   + access_token (JWT)  |                         |
    |   + refresh_token       |                         |
    |   + id_token (OIDC)     |                         |
    |   + expires_in=900      |                         |
    |                         |                         |
    |-- (7) API call ---------+-----------------------> |
    |   + Authorization:      |                         |
    |     Bearer <token>      |                         |
    |                         |                         |
    |  <-- (8) Response ------+-----------------------  |
```

### PKCE Implementation (Node.js)

```javascript
const crypto = require('crypto');

// Generate PKCE code_verifier and code_challenge
function generatePKCE() {
  // code_verifier: cryptographically random, 43-128 characters
  const verifier = crypto.randomBytes(32).toString('base64url');

  // code_challenge: Base64URL encoding of SHA-256 hash
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');

  return { verifier, challenge };
}

// Build authorization request
function buildAuthorizationUrl(config) {
  const { verifier, challenge } = generatePKCE();
  const state = crypto.randomBytes(16).toString('hex');

  // Save state and verifier to session
  // (For SPA, save to sessionStorage)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: 'openid email profile',
    state: state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    // nonce: For OIDC, prevents replay attacks
    nonce: crypto.randomBytes(16).toString('hex'),
  });

  return {
    url: `${config.authorizationEndpoint}?${params}`,
    state,
    verifier,
  };
}

// Token exchange
async function exchangeCodeForTokens(code, verifier, config) {
  const response = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      code_verifier: verifier,  // PKCE: send code_verifier
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Token exchange failed: ${error.error_description}`);
  }

  return response.json();
}
```

### Token Refresh and Rotation

```javascript
// Refresh token rotation implementation
async function refreshAccessToken(refreshToken, config) {
  const response = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.clientId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    // Refresh token is invalid → re-login required
    if (error.error === 'invalid_grant') {
      throw new AuthenticationError('Session expired, please login again');
    }
    throw new Error(`Token refresh failed: ${error.error_description}`);
  }

  const tokens = await response.json();
  // Rotation: a new refresh_token is returned
  // The old refresh_token is invalidated (single use)
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,  // New refresh token
    expiresIn: tokens.expires_in,
  };
}

// Auto-refresh with Axios interceptor
const api = axios.create({ baseURL: 'https://api.example.com' });
let isRefreshing = false;
let failedQueue = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Already refreshing — wait for completion
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { accessToken, refreshToken } = await refreshAccessToken(
          getStoredRefreshToken(),
          config
        );
        storeTokens(accessToken, refreshToken);

        // Retry queued requests
        failedQueue.forEach(({ resolve }) => resolve(accessToken));
        failedQueue = [];

        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        failedQueue.forEach(({ reject }) => reject(refreshError));
        failedQueue = [];
        // Invalidate session → redirect to login
        logout();
        throw refreshError;
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
```

---

## 3. Secure JWT Implementation

### JWT Structure and Verification

```
JWT Structure:

Header.Payload.Signature
  |       |        |
  v       v        v

eyJhbGci.eyJzdWIi.SflKxwRJ
  |       |        |
  +-------+--------+-- Base64URL encoded (NOT encrypted!)
          |
          v
  {
    "sub": "user123",      ← User identifier
    "iss": "auth.example.com", ← Issuer
    "aud": "api.example.com",  ← Target API
    "exp": 1700000000,     ← Expiry time (UNIX timestamp)
    "iat": 1699999100,     ← Issued-at time
    "jti": "unique-id-123", ← Unique token identifier
    "scope": "read write",  ← Authorization scope
    "email": "user@example.com"
  }

Signature Algorithms:
  HS256: HMAC-SHA256 (symmetric key) → M2M, single server
  RS256: RSA-SHA256 (asymmetric key) → General recommendation
  ES256: ECDSA-SHA256 (elliptic curve) → Fast + short key length
  EdDSA: Ed25519 (latest) → Fastest + shortest key length
```

### JWT Verification Middleware (Node.js)

```javascript
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// JWKS client (auto-fetches and caches public keys)
const client = jwksClient({
  jwksUri: 'https://auth.example.com/.well-known/jwks.json',
  cache: true,            // Cache keys
  cacheMaxAge: 600000,    // Cache for 10 minutes
  rateLimit: true,        // Rate limiting
  jwksRequestsPerMinute: 10,
});

// Retrieve signing key by kid
function getSigningKey(kid) {
  return new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err) return reject(err);
      resolve(key.getPublicKey());
    });
  });
}

// JWT verification middleware
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Bearer token required',
    });
  }

  const token = authHeader.slice(7);

  try {
    // Step 1: Decode header (before verification) to get kid
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header.kid) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    // Step 2: Confirm algorithm is on the whitelist
    if (!['RS256', 'ES256'].includes(decoded.header.alg)) {
      return res.status(401).json({ error: 'Unsupported algorithm' });
    }

    // Step 3: Fetch public key from JWKS
    const publicKey = await getSigningKey(decoded.header.kid);

    // Step 4: Verify signature + validate claims
    const payload = jwt.verify(token, publicKey, {
      algorithms: ['RS256', 'ES256'],  // Explicitly specify allowed algorithms
      issuer: 'https://auth.example.com',
      audience: 'https://api.example.com',
      clockTolerance: 30,  // Clock skew tolerance (seconds)
      maxAge: '1h',        // Maximum age since issuance
    });

    // Step 5: Additional custom validation
    if (!payload.scope) {
      return res.status(403).json({ error: 'No scope in token' });
    }

    req.user = payload;
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'token_expired',
        message: 'Access token has expired',
      });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'invalid_token',
        message: 'Token signature verification failed',
      });
    }
    // Do not return details of unexpected errors
    console.error('Token verification error:', err);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

// Scope-based authorization middleware
function requireScope(...requiredScopes) {
  return (req, res, next) => {
    const tokenScopes = (req.user.scope || '').split(' ');
    const hasAll = requiredScopes.every(s => tokenScopes.includes(s));

    if (!hasAll) {
      return res.status(403).json({
        error: 'insufficient_scope',
        message: `Required scopes: ${requiredScopes.join(', ')}`,
      });
    }
    next();
  };
}

// Usage examples
app.get('/api/users', verifyToken, requireScope('users:read'), getUsers);
app.post('/api/users', verifyToken, requireScope('users:write'), createUser);
app.delete('/api/users/:id', verifyToken, requireScope('users:delete'), deleteUser);
```

### JWT Claims Best Practices

| Claim | Required | Description | Validation |
|-------|----------|-------------|------------|
| `iss` | Yes | Token issuer | Exact match with expected issuer |
| `sub` | Yes | User/client identifier | Match against DB user ID |
| `aud` | Yes | Target API (recipient) | Match against this API's identifier |
| `exp` | Yes | Expiry time (short: 15min–1hr) | Current time < exp |
| `iat` | Yes | Issued-at time | Reject future iat values |
| `nbf` | Recommended | Not-before time | Current time >= nbf |
| `jti` | Recommended | Unique token identifier | Record for replay attack prevention |
| `scope` | Recommended | Authorization scope | Verify required scope for operation |
| `azp` | Conditional | Authorized client | Match against client ID |

### JWT Storage Strategy

```
Risk Comparison by Storage Type:

+------------------+-----------+-------+--------+----------+
| Storage          | XSS Safe  | CSRF  | Scope  | Recommend|
+------------------+-----------+-------+--------+----------+
| localStorage     | Vulnerable| Safe  | Cross-tab | Not recommended |
| sessionStorage   | Vulnerable| Safe  | Same-tab  | Conditional     |
| Cookie (HttpOnly)| Safe      | Vuln. | Auto-send | Recommended     |
| Cookie + SameSite| Safe      | Safe  | Auto-send | Best            |
| Memory (variable)| Safe      | Safe  | Same-tab  | Recommended     |
+------------------+-----------+-------+--------+----------+

Recommended Pattern (BFF: Backend For Frontend):
  1. Access Token → Hold in memory variable (safe from both XSS and CSRF)
  2. Refresh Token → HttpOnly + Secure + SameSite=Strict Cookie
  3. BFF handles token management → SPA uses only session cookie
```

---

## 4. Rate Limiting

### Rate Limiting Algorithms

```
1. Token Bucket:
   +-------------------+
   |  ○ ○ ○ ○ ○ ○ ○   |  Bucket capacity = 10
   |  (tokens)         |  Refill rate = 1/sec
   +-------------------+
   Request → consume 1 token
   No token → 429 Too Many Requests
   Characteristic: allows bursts (up to bucket capacity)

2. Leaky Bucket:
   +---+
   | ● | ← Requests enter
   | ● |
   | ● |    Processed at
   +---+    fixed rate
     |        ↓
     ● → → → API

   Characteristic: smooths requests, no bursting

3. Fixed Window Counter:
   |--- Window 1 ---|--- Window 2 ---|
   |  count = 8     |  count = 3     |
   |  limit = 10    |  limit = 10    |
   +----------------+----------------+
   Problem: Burst possible at window boundary
   (Window 1 trailing 8 + Window 2 leading 10 = 18 requests)

4. Sliding Window Log:
   |------ 60-second window ------| → slides →
   |  *  *   *  * *  *  *  *   |  count = 8
   |                             |  limit = 10 → OK
   +-----------------------------+
   Characteristic: Accurate but high memory usage

5. Sliding Window Counter (recommended):
   |--- Previous window ---|--- Current window ---|
   |  count=6              |  count=3             |
   |  weight=30%           |  weight=100%         |
   Estimate: 6*0.3 + 3*1.0 = 4.8 → within limit 10
   Characteristic: Good balance of accuracy and efficiency
```

### Redis-Based Distributed Rate Limiter (Python)

```python
import redis
import time
from functools import wraps
from flask import request, jsonify, g
import hashlib

r = redis.Redis(host='localhost', port=6379, decode_responses=True)

def rate_limit(
    max_requests: int,
    window_seconds: int,
    key_func=None,
    scope: str = 'default'
):
    """Distributed rate limiter using sliding window approach"""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            # Client identification
            if key_func:
                client_id = key_func()
            else:
                # Priority: API key > authenticated user > IP address
                client_id = (
                    request.headers.get('X-API-Key') or
                    getattr(g, 'user_id', None) or
                    request.headers.get('X-Forwarded-For', '').split(',')[0].strip() or
                    request.remote_addr
                )

            # Rate limit key (scope + endpoint + client)
            key = f"ratelimit:{scope}:{f.__name__}:{hashlib.sha256(client_id.encode()).hexdigest()[:16]}"
            now = time.time()

            # Atomic processing via Lua script (prevents Redis race conditions)
            lua_script = """
            local key = KEYS[1]
            local now = tonumber(ARGV[1])
            local window = tonumber(ARGV[2])
            local max_requests = tonumber(ARGV[3])

            -- Remove old entries
            redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

            -- Get current request count
            local current = redis.call('ZCARD', key)

            if current < max_requests then
                -- Within limit: record request
                redis.call('ZADD', key, now, now .. '-' .. math.random(1000000))
                redis.call('EXPIRE', key, window)
                return {current + 1, 0}
            else
                -- Limit exceeded: calculate reset time from oldest entry
                local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
                local reset_at = oldest[2] + window
                return {current, reset_at}
            end
            """

            result = r.eval(lua_script, 1, key, now, window_seconds, max_requests)
            current_count = int(result[0])
            reset_at = float(result[1])

            # Response headers (RFC 7231 + draft-ietf-httpapi-ratelimit-headers)
            headers = {
                'X-RateLimit-Limit': str(max_requests),
                'X-RateLimit-Remaining': str(max(0, max_requests - current_count)),
                'X-RateLimit-Reset': str(int(now + window_seconds)),
                'RateLimit-Policy': f'{max_requests};w={window_seconds}',
            }

            if reset_at > 0:
                headers['Retry-After'] = str(int(reset_at - now))
                return jsonify({
                    'error': 'rate_limit_exceeded',
                    'message': f'Rate limit of {max_requests} requests per {window_seconds}s exceeded',
                    'retry_after': int(reset_at - now),
                }), 429, headers

            response = f(*args, **kwargs)
            # Add headers to Flask response
            if isinstance(response, tuple):
                body, status = response[0], response[1]
                return body, status, headers
            return response, 200, headers

        return wrapper
    return decorator

# Usage: Different rate limits per endpoint
@app.route('/api/data')
@rate_limit(max_requests=100, window_seconds=60, scope='general')
def get_data():
    return jsonify({'data': 'ok'})

@app.route('/api/auth/login', methods=['POST'])
@rate_limit(max_requests=5, window_seconds=300, scope='auth')
def login():
    return jsonify({'token': '...'})

@app.route('/api/export', methods=['POST'])
@rate_limit(max_requests=3, window_seconds=3600, scope='expensive')
def export_data():
    return jsonify({'job_id': '...'})
```

### Rate Limiting Strategy Comparison

| Strategy | Memory | Accuracy | Implementation | Burst Support | Distributed |
|----------|--------|----------|----------------|---------------|-------------|
| Fixed Window | Low | Low (boundary issue) | Low | No | Easy |
| Sliding Window Log | High | High | Medium | Yes | Medium |
| Sliding Window Counter | Medium | Medium | Medium | Yes | Easy |
| Token Bucket | Low | High | Low | Yes (burst allowed) | Medium |
| Leaky Bucket | Low | High | Low | No (smoothed) | Medium |

### Multi-Layer Rate Limiting Design

```
Client → CDN/WAF → API Gateway → Application

Layer 1: CDN/WAF (Cloudflare, AWS WAF)
  - IP-based rate limiting: 1000 req/min/IP
  - Geographic blocking
  - Bot detection

Layer 2: API Gateway (Kong, AWS API Gateway)
  - API key-based rate limiting: 100 req/min/key
  - Plan-based limits (Free: 100, Pro: 1000, Enterprise: 10000)
  - Burst limiting

Layer 3: Application
  - Fine-grained user-based rate limiting
  - Per-endpoint limits
  - Business logic-specific limits (e.g., password attempt count)
```

---

## 5. Input Validation and Schema Validation

### OpenAPI Schema Definition

```yaml
# Secure schema definition in OpenAPI 3.0
openapi: '3.0.3'
info:
  title: Secure API
  version: '1.0.0'

paths:
  /api/users:
    post:
      operationId: createUser
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
      responses:
        '201':
          description: User created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
        '400':
          $ref: '#/components/responses/ValidationError'
        '401':
          $ref: '#/components/responses/Unauthorized'

components:
  schemas:
    CreateUserRequest:
      type: object
      required: [name, email]
      additionalProperties: false  # Reject undefined fields
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 100
          pattern: '^[a-zA-Z\s\-]+$'
          description: Name (letters, spaces, and hyphens only)
        email:
          type: string
          format: email
          maxLength: 254
          description: Email address (RFC 5321 compliant)
        age:
          type: integer
          minimum: 0
          maximum: 150
          description: Age (0-150)
        bio:
          type: string
          maxLength: 500
          description: Bio (HTML tags are stripped)

    UserResponse:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        email:
          type: string
        createdAt:
          type: string
          format: date-time

  responses:
    ValidationError:
      description: Validation Error
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: string
                example: 'validation_failed'
              details:
                type: array
                items:
                  type: object
                  properties:
                    field:
                      type: string
                    message:
                      type: string

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

### Validation with Zod (TypeScript)

```typescript
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';

// Schema definition
const CreateUserSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .regex(/^[a-zA-Z\s\-]+$/, 'Name must contain only letters, spaces, and hyphens')
    .transform(s => s.trim()),

  email: z
    .string()
    .email('Invalid email address')
    .max(254, 'Email must be 254 characters or less')
    .transform(s => s.toLowerCase().trim()),

  age: z
    .number()
    .int('Age must be an integer')
    .min(0, 'Age must be non-negative')
    .max(150, 'Age must be 150 or less')
    .optional(),

  bio: z
    .string()
    .max(500, 'Bio must be 500 characters or less')
    .transform(s => DOMPurify.sanitize(s, { ALLOWED_TAGS: [] }))  // Strip HTML
    .optional(),
}).strict();  // Reject undefined fields

// Path parameters
const UserIdSchema = z.object({
  id: z.string().uuid('Invalid user ID format'),
});

// Query parameters
const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['createdAt', 'name', 'email']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// Validation middleware
function validate<T extends z.ZodType>(schema: T, source: 'body' | 'params' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return res.status(400).json({
        error: 'validation_failed',
        details: result.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      });
    }

    // Overwrite with validated data (after transform)
    req[source] = result.data;
    next();
  };
}

// Usage examples
app.post('/api/users',
  verifyToken,
  validate(CreateUserSchema, 'body'),
  createUser
);

app.get('/api/users/:id',
  verifyToken,
  validate(UserIdSchema, 'params'),
  getUser
);

app.get('/api/users',
  verifyToken,
  validate(PaginationSchema, 'query'),
  listUsers
);
```

### Input Validation in Express.js (express-validator)

```javascript
const { body, param, query, validationResult } = require('express-validator');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const DOMPurify = createDOMPurify(new JSDOM('').window);

// Validation rules
const createUserValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z\s\-]+$/)
    .withMessage('Name must contain only letters, spaces, and hyphens'),

  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),

  body('age')
    .optional()
    .isInt({ min: 0, max: 150 })
    .withMessage('Age must be between 0 and 150'),

  body('bio')
    .optional()
    .isLength({ max: 500 })
    .customSanitizer(value => DOMPurify.sanitize(value, { ALLOWED_TAGS: [] })),
];

// Handle validation result
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'validation_failed',
      details: errors.array().map(e => ({
        field: e.path,
        message: e.msg,
        value: undefined,  // Do not return input value (prevents secret leakage)
      })),
    });
  }
  next();
}

app.post('/api/users', createUserValidation, validate, createUser);
```

---

## 6. API Security Headers and CORS

### Security Header Configuration

```javascript
const helmet = require('helmet');

// Configure basic security headers with Helmet
app.use(helmet());

// Proper CORS configuration
const cors = require('cors');
const allowedOrigins = [
  'https://app.example.com',
  'https://admin.example.com',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server communication (no origin)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  credentials: true,
  maxAge: 86400,       // Preflight cache (24 hours)
  optionsSuccessStatus: 204,
}));

// Additional security headers
app.use((req, res, next) => {
  // Enforce MIME type of response
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Do not cache API responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  // API version and deprecation information
  res.setHeader('API-Version', 'v1');
  // Request tracing
  res.setHeader('X-Request-ID', req.headers['x-request-id'] || crypto.randomUUID());
  next();
});
```

### CORS Flow

```
Simple Request (GET/POST with simple headers):
  Browser → Origin: https://app.example.com → Server
  Server → Access-Control-Allow-Origin: https://app.example.com → Browser

Preflight Request (PUT/DELETE/Custom headers):
  Step 1: OPTIONS (preflight)
  Browser → OPTIONS /api/users
           Origin: https://app.example.com
           Access-Control-Request-Method: PUT
           Access-Control-Request-Headers: Authorization, Content-Type

  Server → 204 No Content
           Access-Control-Allow-Origin: https://app.example.com
           Access-Control-Allow-Methods: GET, POST, PUT, DELETE
           Access-Control-Allow-Headers: Authorization, Content-Type
           Access-Control-Max-Age: 86400

  Step 2: Actual Request
  Browser → PUT /api/users/123
           Origin: https://app.example.com
           Authorization: Bearer ...

  Server → 200 OK
           Access-Control-Allow-Origin: https://app.example.com

Bad Patterns:
  Access-Control-Allow-Origin: *
  → Cannot be combined with credentials: true
  → Allows access from any origin (security risk)
```

---

## 7. GraphQL Security

### GraphQL-Specific Risks and Countermeasures

```
GraphQL Threat Model:

1. Depth Attack:
   query {
     user {
       posts {
         comments {
           author {
             posts {
               comments { ... }  # Infinitely nested
             }
           }
         }
       }
     }
   }
   → Mitigation: depth-limit plugin (max depth = 7-10)

2. Breadth Attack:
   query {
     user1: user(id: "1") { name }
     user2: user(id: "2") { name }
     user3: user(id: "3") { name }
     ... # thousands of aliases
   }
   → Mitigation: query cost analysis + limits

3. Introspection Information Disclosure:
   query {
     __schema {
       types { name fields { name type { name } } }
     }
   }
   → Mitigation: Disable introspection in production

4. Batch Attacks:
   [
     {"query": "mutation { login(email: \"a\", pass: \"1\") { token } }"},
     {"query": "mutation { login(email: \"a\", pass: \"2\") { token } }"},
     ... # many login attempts
   ]
   → Mitigation: Limit number of batch requests
```

```javascript
// Apollo Server security configuration
const { ApolloServer } = require('@apollo/server');
const depthLimit = require('graphql-depth-limit');
const { createComplexityLimitRule } = require('graphql-validation-complexity');

const server = new ApolloServer({
  typeDefs,
  resolvers,
  // Disable introspection in production
  introspection: process.env.NODE_ENV !== 'production',
  // Validation rules
  validationRules: [
    // Query depth limit (max 10)
    depthLimit(10),
    // Query complexity limit
    createComplexityLimitRule(1000, {
      scalarCost: 1,
      objectCost: 2,
      listFactor: 10,
      onCost: (cost) => {
        console.log(`Query cost: ${cost}`);
      },
    }),
  ],
  // Error formatting (hide internal errors)
  formatError: (error) => {
    // Remove stack trace
    if (process.env.NODE_ENV === 'production') {
      return {
        message: error.message,
        extensions: {
          code: error.extensions?.code || 'INTERNAL_ERROR',
        },
      };
    }
    return error;
  },
  plugins: [
    // Query size limit
    {
      async requestDidStart() {
        return {
          async didResolveOperation(ctx) {
            const queryLength = ctx.request.query?.length || 0;
            if (queryLength > 10000) {
              throw new Error('Query too large');
            }
          },
        };
      },
    },
  ],
});
```

---

## 8. API Versioning and Lifecycle

### Versioning Strategy Comparison

| Approach | Example | Pros | Cons |
|----------|---------|------|------|
| URL path | `/v1/users` | Clear, easy to cache | URL changes |
| Header | `Accept: application/vnd.api.v1+json` | URL stays same | Hard to discover |
| Query parameter | `/users?version=1` | Simple | Affects caching |
| Content Negotiation | `Accept: application/json; version=1` | RESTful | Complex implementation |

### API Deprecation Process

```javascript
// Deprecation notification via headers
function deprecateEndpoint(sunsetDate, link) {
  return (req, res, next) => {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', sunsetDate);  // RFC 8594
    res.setHeader('Link', `<${link}>; rel="successor-version"`);

    // Also add Warning header when approaching sunset
    const sunset = new Date(sunsetDate);
    const daysUntilSunset = Math.ceil((sunset - new Date()) / (1000 * 60 * 60 * 24));
    if (daysUntilSunset <= 30) {
      res.setHeader('Warning',
        `299 - "This API version will be removed on ${sunsetDate}. Migrate to ${link}"`
      );
    }

    next();
  };
}

// v1 is deprecated on 2025-06-01
app.use('/api/v1',
  deprecateEndpoint('2025-06-01', 'https://api.example.com/v2'),
  v1Router
);
app.use('/api/v2', v2Router);
```

---

## 9. Anti-Patterns

### Anti-Pattern 1: Allowing `alg: none` in JWT

```javascript
// NG: Not validating the algorithm
const payload = jwt.verify(token, secret);
// Attacker can forge a token with alg: "none" → signature verification is skipped

// NG: Confusing HS256 and RS256
const payload = jwt.verify(token, publicKey);
// Attacker changes alg to "HS256" and uses the public key as the symmetric key

// OK: Explicitly specify allowed algorithms
const payload = jwt.verify(token, publicKey, {
  algorithms: ['RS256'],  // Reject none, HS256, etc.
  issuer: 'https://auth.example.com',
  audience: 'https://api.example.com',
});
```

**Impact**: An attacker can forge a token with `alg: none` and impersonate any user. In an `alg` confusion attack, the public key can be used as an HMAC secret key to generate a valid signature.

### Anti-Pattern 2: Information Leakage in Error Responses

```javascript
// NG: Error response that exposes internal information
app.use((err, req, res, next) => {
  res.status(500).json({
    error: err.message,        // "ECONNREFUSED 10.0.1.5:5432" → DB IP exposed
    stack: err.stack,          // File paths exposed
    query: err.sql,            // SQL query exposed
    config: app.get('config'), // Config information exposed
  });
});

// OK: Safe error response
app.use((err, req, res, next) => {
  // Log full details internally
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  console.error({
    requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
  });

  // Return minimal information to client
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal Server Error' : err.message,
    requestId,  // For support inquiries
  });
});
```

**Impact**: Internal IPs, DB schemas, file paths, and library versions are exposed to attackers, enabling more targeted attacks.

### Anti-Pattern 3: Excessive Data Exposure in Responses

```javascript
// NG: Returning DB records as-is
app.get('/api/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  res.json(user);  // Includes password_hash, internal_notes, ssn, etc.
});

// OK: Explicitly select fields using a response DTO
function toUserDTO(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    createdAt: user.createdAt,
    // Excludes password_hash, ssn, internal_notes
  };
}

app.get('/api/users/:id', authenticate, async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('id name email avatar createdAt');  // Also restrict at DB query level
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(toUserDTO(user));
});
```

---

## 10. Edge Cases

### Edge Case 1: JWT Clock Synchronization Issues

If clocks are out of sync between servers, validation of JWT `exp` and `nbf` can be inaccurate. When NTP sync is delayed, valid tokens may be rejected or expired tokens may be accepted.

```javascript
// Mitigation: Set tolerance using clockTolerance
jwt.verify(token, key, {
  algorithms: ['RS256'],
  clockTolerance: 30,  // Allow 30-second clock skew
});

// Additional: Confirm iat is not in the future
if (payload.iat > Math.floor(Date.now() / 1000) + 60) {
  throw new Error('Token issued in the future');
}
```

### Edge Case 2: Rate Limit Inconsistency in Distributed Environments

When multiple API servers exist, in-memory rate limiters count per-server, causing the actual limit to be looser than intended.

```
Server A: count = 50 (limit = 100)
Server B: count = 50 (limit = 100)
→ Actually 100 requests pass through (matches intended limit of 100)

Problem: When load balancer's round-robin is uneven
Server A: count = 90 (limit = 100)
Server B: count = 10 (limit = 100)
→ 90 more requests can still pass through Server B

Mitigation: Centralize management using a shared store like Redis
```

### Edge Case 3: Input Validation Bypass via Unicode Normalization

Differences in Unicode normalization forms (NFC, NFD, NFKC, NFKD) can be exploited to bypass input validation.

```javascript
// Example: Visually identical Unicode characters for "admin"
const normalAdmin = 'admin';        // U+0061, U+0064, U+006D, U+0069, U+006E
const trickAdmin = '\u0430dmin';    // U+0430 (Cyrillic 'a'), rest is Latin

normalAdmin === trickAdmin;  // false
normalAdmin.normalize('NFKC') === trickAdmin.normalize('NFKC');  // false

// Mitigation: Normalize input to NFKC before validation
function sanitizeUsername(input) {
  const normalized = input.normalize('NFKC');
  // Reject if input contains non-ASCII characters
  if (!/^[a-zA-Z0-9_\-]+$/.test(normalized)) {
    throw new Error('Username contains invalid characters');
  }
  return normalized;
}
```

---

## 11. Performance Considerations

### Authentication and Authorization Performance

| Method | Latency | Scalability | Stateless |
|--------|---------|-------------|-----------|
| Session (DB) | ~5-10ms | Low (DB bottleneck) | Stateful |
| Session (Redis) | ~1-3ms | Medium | Stateful |
| JWT (HS256) | ~0.1ms | High | Stateless |
| JWT (RS256) | ~0.5-1ms | High | Stateless |
| JWT + JWKS | ~1-3ms (first time) | High | Stateless |
| API Key (DB lookup) | ~3-5ms | Medium | Stateful |
| API Key (cache) | ~0.5ms | High | Quasi-stateless |
| mTLS | ~2-5ms (handshake) | High | Stateless |

### API Response Optimization

```
+----------------------------------+-------------------+
| Technique                        | Effect            |
+----------------------------------+-------------------+
| Pagination (cursor-based)        | Response size     |
| Field selection (?fields=id,name)| Response size     |
| Compression (gzip/br)            | Transfer size 60-80% |
| ETag + 304 Not Modified          | Reduce unnecessary transfers |
| Connection: keep-alive           | TCP handshake     |
| HTTP/2 multiplexing              | Parallel requests |
| CDN cache (public API)           | Origin load       |
+----------------------------------+-------------------+
```

---

## 12. Exercises

### Exercise 1: Implementing BOLA Defense (Beginner)

Implement BOLA (Broken Object Level Authorization) defense for the following endpoints.

```javascript
// Target for fix
app.get('/api/documents/:docId', async (req, res) => {
  const doc = await Document.findById(req.params.docId);
  res.json(doc);
});

app.put('/api/documents/:docId', async (req, res) => {
  const doc = await Document.findByIdAndUpdate(req.params.docId, req.body);
  res.json(doc);
});
```

**Requirements**:
1. Add authentication middleware
2. Allow only the document owner to perform GET/PUT
3. Administrators can access all documents
4. Do not distinguish between non-existent and unauthorized documents (to prevent information leakage)
5. Also implement Mass Assignment defense

### Exercise 2: JWT + Rate Limit Integration (Intermediate)

Implement an API server that meets the following requirements.

**Requirements**:
1. JWT verification middleware using JWKS
2. Scope-based authorization (users:read, users:write, admin)
3. Redis-based rate limiting (authenticated users: 100req/min, anonymous: 10req/min)
4. Input validation conforming to OpenAPI 3.0 schema
5. Security header configuration (CORS, CSP, etc.)

### Exercise 3: GraphQL Security Audit (Advanced)

Add the following security measures to an existing GraphQL API.

**Requirements**:
1. Query depth limit (max 7)
2. Query cost analysis (max cost 500)
3. Disable introspection (in production)
4. Limit number of batch requests (max 5)
5. Persisted Queries (whitelist approach)
6. Field-level authorization (sensitive fields for admin only)

---

## 13. Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| CORS preflight returns 403 | OPTIONS method not handled | Place CORS middleware first |
| JWT expired errors occur frequently | Token expiry is too short | Implement refresh strategy + set clockTolerance |
| Rate limiting not working | In-memory counter + multiple servers | Centralize with Redis |
| API key leaked | Committed to Git / printed in logs | Rotate key + use secret management tool |
| 429 not returned, 502 returned instead | Backend overloaded and crashed | Apply rate limiting at API Gateway |
| GraphQL N+1 problem | DataLoader not used | Batch with DataLoader |
| SSRF via redirect | Redirect after URL validation | Disable redirects + validate IP |
| Cookie not sent | SameSite setting mismatch | SameSite=None + Secure (cross-origin) |

---

## 14. FAQ

### Q1. How should API keys and OAuth tokens be used differently?

API keys are used for client identification and rate limiting, not for authorization decisions. Use OAuth 2.0 access tokens for operations tied to a user. For M2M communication where fine-grained authorization is not needed, use a token obtained via the Client Credentials flow. Send API keys in request headers (`X-API-Key`) and do not include them in URL query parameters (they end up in logs).

### Q2. What is an appropriate expiry time for access tokens?

Access tokens are commonly 15 minutes to 1 hour. Shorter durations improve security but increase user experience overhead and refresh token load. Set refresh tokens to 7–30 days and require rotation (single use). For high-security environments (finance, healthcare), access tokens of 5–15 minutes and refresh tokens of 1–7 days are recommended.

### Q3. What is the relationship between API versioning and security?

Older API versions are less likely to receive security patches, so minimize the number of supported versions. Set sunset dates for deprecated APIs and notify clients via `Sunset` and `Deprecation` headers. Deprecated APIs should return 410 Gone and include the migration URL.

### Q4. What are the security differences between REST and GraphQL?

REST is easier to authorize based on URLs but has over-fetching/under-fetching issues. GraphQL is flexible but has inherent risks such as depth attacks, batch attacks, and cost attacks. In production, enabling Persisted Queries (query whitelist) in GraphQL prevents execution of arbitrary queries.

### Q5. What security functions should the API Gateway handle?

The API Gateway should handle authentication (JWT verification), rate limiting, IP blocking, TLS termination, and request size limits. Authorization (BOLA, BFLA) depends on business logic and should be implemented at the application layer. Centralizing authorization in the API Gateway makes policies complex and difficult to maintain.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping straight to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in real-world work?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|------------|
| BOLA Defense | Implement object-level authorization checks on all endpoints |
| OAuth 2.0 | Adopt Authorization Code + PKCE as standard. Implicit Flow is deprecated |
| JWT | Fix alg, always verify iss/aud/exp, short expiry, manage keys with JWKS |
| Refresh | Token rotation required, replay detection, auto-refresh |
| Rate Limiting | Distribute management with Redis, multi-layer defense (CDN/Gateway/App), per-endpoint limits |
| Input Validation | Zod/express-validator + OpenAPI schema, whitelist approach |
| CORS | Explicitly specify allowed origins, no wildcards, be careful with credentials |
| GraphQL | Depth limiting + cost analysis + disable introspection |
| Error Handling | Do not expose internal information, use requestId for tracing |
| Versioning | Gradual deprecation with Sunset/Deprecation headers |

---

## What to Read Next

- [Secure Coding](../04-application-security/00-secure-coding.md) -- Defending against attacks at the code level
- [Network Security Basics](./00-network-security-basics.md) -- Defenses at the network layer
- [TLS/Certificates](../02-cryptography/01-tls-certificates.md) -- Foundations of communication encryption
- [OWASP Top 10](../01-web-security/00-owasp-top10.md) -- Web application vulnerabilities

---

## References

1. **OWASP API Security Top 10 (2023)** -- https://owasp.org/API-Security/
2. **RFC 6749 -- The OAuth 2.0 Authorization Framework** -- https://datatracker.ietf.org/doc/html/rfc6749
3. **RFC 7519 -- JSON Web Token (JWT)** -- https://datatracker.ietf.org/doc/html/rfc7519
4. **RFC 7636 -- PKCE (Proof Key for Code Exchange)** -- https://datatracker.ietf.org/doc/html/rfc7636
5. **RFC 8594 -- The Sunset HTTP Header Field** -- https://datatracker.ietf.org/doc/html/rfc8594
6. **RFC 8628 -- OAuth 2.0 Device Authorization Grant** -- https://datatracker.ietf.org/doc/html/rfc8628
7. **draft-ietf-httpapi-ratelimit-headers** -- https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/
8. **GraphQL Security Cheat Sheet (OWASP)** -- https://cheatsheetseries.owasp.org/cheatsheets/GraphQL_Cheat_Sheet.html

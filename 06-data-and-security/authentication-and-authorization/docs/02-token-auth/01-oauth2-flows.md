# OAuth 2.0 Flows

> OAuth 2.0 is a standard protocol for "delegated authorization." This guide provides a comprehensive explanation of the Authorization Code + PKCE, Client Credentials, Device Code, and Implicit (deprecated) flows — including how each works, when to use it, and security considerations.

## What You Will Learn

- [ ] Understand the role of OAuth 2.0 and its actors
- [ ] Understand the mechanics and appropriate use cases for each flow
- [ ] Implement PKCE-based security hardening for SPAs and mobile apps
- [ ] Implement token lifecycle management (issuance, refresh, revocation)
- [ ] Understand OAuth 2.0 security threats and countermeasures
- [ ] Understand the internal implementation of an authorization server


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of the content in [JWT Deep Dive](./00-jwt-deep-dive.md)

---

## 1. OAuth 2.0 Fundamentals

```
Role of OAuth 2.0:
  "A mechanism for granting third-party applications
   limited access to a user's resources"

  Example: "Allow MyApp to access the list of GitHub repositories"
  → The user does not give their GitHub password to MyApp
  → MyApp only obtains the required permissions (scopes)

Four Actors:

  ┌─────────────────────────────────────────┐
  │                                         │
  │  Resource Owner                         │
  │  → The user themselves                  │
  │                                         │
  │  Client                                 │
  │  → The application requesting access    │
  │  → MyApp                                │
  │                                         │
  │  Authorization Server                   │
  │  → The server that issues access grants │
  │  → GitHub's OAuth server                │
  │                                         │
  │  Resource Server                        │
  │  → The server holding protected resources│
  │  → GitHub API                           │
  │                                         │
  └─────────────────────────────────────────┘

Flow Selection:

  App Type                        │ Recommended Flow
  ────────────────────────────────┼──────────────────────
  Web app (with server)           │ Authorization Code
  SPA (no server)                 │ Authorization Code + PKCE
  Mobile app                      │ Authorization Code + PKCE
  Server-to-server communication  │ Client Credentials
  IoT / TV                        │ Device Code
  SPA (legacy)                    │ Implicit (deprecated)
```

### 1.1 History and Design Philosophy of OAuth 2.0

```
Evolution of OAuth:

  OAuth 1.0 (2007):
    → Signature-based (HMAC-SHA1)
    → Each request required a signature
    → Complex implementation (canonicalization, signature generation)
    → TLS was not mandatory

  OAuth 2.0 (2012, RFC 6749):
    → Bearer token-based
    → TLS mandatory (simplifies signatures)
    → Multiple grant types (flows)
    → Permission control via scopes
    → Introduction of refresh tokens

  OAuth 2.1 (in development):
    → PKCE mandatory (for all flows)
    → Deprecation of the Implicit flow
    → Deprecation of Resource Owner Password
    → Refresh token rotation recommended
    → Bearer token sender-constraint recommended

  Key design decisions:
    ① OAuth 2.0 is an "authorization" protocol (not authentication)
       → "Allow this app to access GitHub repositories"
       → Identity verification of the user is handled by OpenID Connect

    ② Access tokens are "opaque" to the client
       → Clients must not parse the contents of a token
       → Only the resource server validates the token
       → Whether to use JWT is an implementation detail of the authorization server

    ③ Front channel vs. back channel
       → Front channel: browser redirects (risk of interception)
       → Back channel: direct server-to-server communication (secure)
       → Authorization codes are received via the front channel
       → Token exchange is performed via the back channel
```

### 1.2 Client Classification

```
Client classification in OAuth 2.0:

  Confidential Client:
    → Can securely hold a client_secret
    → Server-side applications
    → Backend web apps
    → Uses client_secret during token exchange

  Public Client:
    → Cannot securely hold a client_secret
    → SPA (JavaScript running in the browser)
    → Mobile apps (can be decompiled)
    → Desktop apps
    → Protected using PKCE

  ┌───────────────────────────────────────────────────┐
  │                                                   │
  │  Confidential Client:                              │
  │  ┌─────────────┐    client_secret    ┌──────────┐ │
  │  │ Web Server  │───────────────────>│ Auth     │ │
  │  │ (backend)   │  Can send securely  │ Server   │ │
  │  └─────────────┘                    └──────────┘ │
  │                                                   │
  │  Public Client:                                    │
  │  ┌─────────────┐    client_secret    ┌──────────┐ │
  │  │ SPA / Mobile│───────────× ───────│ Auth     │ │
  │  │ (frontend)  │  Leaks from source  │ Server   │ │
  │  └─────────────┘                    └──────────┘ │
  │                    Use PKCE instead               │
  │                                                   │
  └───────────────────────────────────────────────────┘

  Settings configured at client registration:
    → client_id: Public identifier
    → client_secret: Secret key (Confidential clients only)
    → redirect_uris: Allowed redirect destinations
    → grant_types: Permitted flows
    → scopes: Requestable scopes
    → token_endpoint_auth_method: Authentication method
      → client_secret_basic: Basic authentication
      → client_secret_post: POST parameters
      → private_key_jwt: JWT-based authentication
      → none: Public Client
```

---

## 2. Authorization Code Flow

```
Authorization Code Flow (most secure, most common):

  User      Client       Authorization Server    Resource Server
    │           │            │               │
    │ Login     │            │               │
    │──────────>│            │               │
    │           │ ① Authorization request    │
    │           │───────────>│               │
    │           │            │               │
    │ ② Login screen         │               │
    │<──────────────────────│               │
    │           │            │               │
    │ ③ Authenticate + grant permissions     │
    │──────────────────────>│               │
    │           │            │               │
    │ ④ redirect_uri +      │               │
    │   authorization_code  │               │
    │──────────>│            │               │
    │           │            │               │
    │           │ ⑤ code → token exchange    │
    │           │───────────>│               │
    │           │            │               │
    │           │ ⑥ access_token +           │
    │           │   refresh_token             │
    │           │<───────────│               │
    │           │            │               │
    │           │ ⑦ API request              │
    │           │ + Bearer access_token       │
    │           │───────────────────────────>│
    │           │            │               │
    │           │ ⑧ Resource                 │
    │           │<───────────────────────────│
    │ Response  │            │               │
    │<──────────│            │               │
```

### 2.1 Details of Each Step

```
① Inside the authorization request:

  GET /authorize?
    response_type=code          ← Request authorization code
    &client_id=my-app-id        ← Client identifier
    &redirect_uri=https://myapp.com/callback  ← Callback destination
    &scope=read:user repo       ← Requested permissions
    &state=xyzabc123            ← Random value for CSRF protection
    &code_challenge=E9Melhoa... ← PKCE challenge (recommended)
    &code_challenge_method=S256 ← PKCE method

  Meaning and importance of each parameter:

    response_type:
      → "code" = Authorization Code flow
      → "token" = Implicit flow (deprecated)

    state:
      → Key to CSRF protection
      → Cryptographically random value (32 bytes or more)
      → Saved and tied to the session
      → Must be verified to match on callback
      → If it doesn't match → possible attack

    redirect_uri:
      → Must exactly match the pre-registered URI
      → Prevents open redirector attacks
      → Wildcards prohibited (security risk)
      → localhost allowed only for development

④ Authorization response:

  HTTP/1.1 302 Found
  Location: https://myapp.com/callback
    ?code=SplxlOBeZQQYbYS6WxSbIA    ← Authorization code (short-lived)
    &state=xyzabc123                 ← The sent state is returned as-is

  Characteristics of the authorization code:
    → Expiry: within 10 minutes (recommended: 30 seconds to 1 minute)
    → Single-use (invalidated after use)
    → Bound to client_id
    → Bound to redirect_uri
    → Useless if leaked without client_secret
      (in the case of a Confidential Client)

⑤ Token exchange request:

  POST /token
  Content-Type: application/x-www-form-urlencoded
  Authorization: Basic <base64(client_id:client_secret)>

  grant_type=authorization_code
  &code=SplxlOBeZQQYbYS6WxSbIA
  &redirect_uri=https://myapp.com/callback
  &code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk

  Authorization server validation:
    ✓ client_id and client_secret match
    ✓ code is valid (unused, not expired)
    ✓ code is bound to client_id
    ✓ redirect_uri matches the one in the authorization request
    ✓ Hash of code_verifier matches code_challenge (PKCE)
    ✓ All OK → Issue tokens

⑥ Token response:

  HTTP/1.1 200 OK
  Content-Type: application/json
  Cache-Control: no-store
  Pragma: no-cache

  {
    "access_token": "eyJhbGciOiJSUzI1NiIs...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "refresh_token": "8xLOxBtZp8",
    "scope": "read:user repo"
  }

  Important response headers:
    → Cache-Control: no-store (do not cache tokens)
    → Pragma: no-cache (HTTP/1.0 compatibility)
```

```typescript
// Authorization Code Flow — complete implementation

// ① Authorization request (client → authorization server)
function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: 'https://myapp.com/callback',
    scope: 'read:user repo',
    state, // Random value for CSRF protection
  });
```

```typescript
  return `https://github.com/login/oauth/authorize?${params}`;
}

// ④⑤ Callback handling (authorization code → token exchange)
async function handleCallback(code: string, state: string) {
  // Validate state (CSRF protection)
  if (state !== storedState) {
    throw new Error('Invalid state parameter');
  }

  // ⑤ Token exchange (executed server-side → uses client_secret securely)
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET, // Server only
      code,
      redirect_uri: 'https://myapp.com/callback',
    }),
  });

  const { access_token, refresh_token, scope, token_type } = await tokenResponse.json();

  // ⑦ Fetch resource
  const userResponse = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  return userResponse.json();
}
```

### 2.2 Internal Implementation of the Authorization Server

```typescript
// Internal implementation of the authorization server (Express)
import express from 'express';
import crypto from 'crypto';

interface AuthorizationCode {
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  createdAt: Date;
  used: boolean;
}

interface TokenRecord {
  accessToken: string;
  refreshToken: string;
  clientId: string;
  userId: string;
  scope: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  revoked: boolean;
}

class AuthorizationServer {
  private codes: Map<string, AuthorizationCode> = new Map();
  private tokens: Map<string, TokenRecord> = new Map();
  private refreshTokenIndex: Map<string, string> = new Map(); // refreshToken → accessToken

  // ① Authorization endpoint
  async handleAuthorize(req: express.Request, res: express.Response) {
    const {
      response_type,
      client_id,
      redirect_uri,
      scope,
      state,
      code_challenge,
      code_challenge_method,
    } = req.query as Record<string, string>;

    // Validation
    if (response_type !== 'code') {
      return res.status(400).json({ error: 'unsupported_response_type' });
    }

    // Client verification
    const client = await this.getClient(client_id);
    if (!client) {
      return res.status(400).json({ error: 'invalid_client' });
    }

    // Exact match check on redirect_uri
    if (!client.redirectUris.includes(redirect_uri)) {
      // Must not redirect if redirect_uri is invalid
      // (prevents open redirector attacks)
      return res.status(400).json({ error: 'invalid_redirect_uri' });
    }

    // Scope validation
    const requestedScopes = scope.split(' ');
    const allowedScopes = requestedScopes.filter(s => client.allowedScopes.includes(s));

    // Check if user is authenticated (redirect to login if not)
    const user = req.session?.user;
    if (!user) {
      // Redirect to login screen (preserving authorization parameters)
      return res.redirect(`/login?return_to=${encodeURIComponent(req.originalUrl)}`);
    }

    // Show consent screen (or check prior consent)
    const existingConsent = await this.getConsent(user.id, client_id, allowedScopes);
    if (!existingConsent) {
      return res.render('consent', {
        client,
        scopes: allowedScopes,
        state,
        // Consent form submission destination
      });
    }

    // Generate authorization code
    const code = crypto.randomBytes(32).toString('hex');
    this.codes.set(code, {
      code,
      clientId: client_id,
      userId: user.id,
      redirectUri: redirect_uri,
      scope: allowedScopes.join(' '),
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method,
      createdAt: new Date(),
      used: false,
    });

    // Authorization code is short-lived (auto-deleted after 30 seconds)
    setTimeout(() => this.codes.delete(code), 30 * 1000);

    // Redirect
    const callbackUrl = new URL(redirect_uri);
    callbackUrl.searchParams.set('code', code);
    if (state) callbackUrl.searchParams.set('state', state);

    res.redirect(302, callbackUrl.toString());
  }

  // ⑤ Token endpoint
  async handleToken(req: express.Request, res: express.Response) {
    const { grant_type } = req.body;

    // Cache-Control header (RFC 6749 Section 5.1)
    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');

    switch (grant_type) {
      case 'authorization_code':
        return this.handleAuthorizationCodeGrant(req, res);
      case 'refresh_token':
        return this.handleRefreshTokenGrant(req, res);
      case 'client_credentials':
        return this.handleClientCredentialsGrant(req, res);
      default:
        return res.status(400).json({ error: 'unsupported_grant_type' });
    }
  }

  private async handleAuthorizationCodeGrant(
    req: express.Request,
    res: express.Response,
  ) {
    const { code, redirect_uri, code_verifier } = req.body;
    const { clientId, clientSecret } = this.extractClientCredentials(req);

    // Client authentication
    const client = await this.authenticateClient(clientId, clientSecret);
    if (!client) {
      return res.status(401).json({ error: 'invalid_client' });
    }

    // Authorization code validation
    const authCode = this.codes.get(code);
    if (!authCode) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Code not found or expired' });
    }

    // Check if already used
    if (authCode.used) {
      // Authorization code reuse = possible attack
      // → Invalidate all tokens issued with this code
      await this.revokeTokensByCode(code);
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Code already used' });
    }

    // Verify client_id match
    if (authCode.clientId !== clientId) {
      return res.status(400).json({ error: 'invalid_grant' });
    }

    // Verify redirect_uri match
    if (authCode.redirectUri !== redirect_uri) {
      return res.status(400).json({ error: 'invalid_grant' });
    }

    // PKCE verification
    if (authCode.codeChallenge) {
      if (!code_verifier) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'code_verifier required' });
      }

      const valid = this.verifyPKCE(
        code_verifier,
        authCode.codeChallenge,
        authCode.codeChallengeMethod || 'plain',
      );

      if (!valid) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
      }
    }

    // Mark code as used
    authCode.used = true;

    // Issue tokens
    const tokens = await this.issueTokens(clientId, authCode.userId, authCode.scope);

    res.json({
      access_token: tokens.accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: tokens.refreshToken,
      scope: authCode.scope,
    });
  }

  // PKCE verification
  private verifyPKCE(
    verifier: string,
    challenge: string,
    method: string,
  ): boolean {
    if (method === 'S256') {
      const hash = crypto.createHash('sha256').update(verifier).digest();
      const computed = hash
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      return computed === challenge;
    }
    if (method === 'plain') {
      return verifier === challenge;
    }
    return false;
  }

  // Extract client credentials
  private extractClientCredentials(req: express.Request): {
    clientId: string;
    clientSecret: string | null;
  } {
    // Get from Basic authentication header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Basic ')) {
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
      const [clientId, clientSecret] = decoded.split(':');
      return { clientId, clientSecret };
    }

    // Get from POST body
    return {
      clientId: req.body.client_id,
      clientSecret: req.body.client_secret || null,
    };
  }

  // Issue tokens
  private async issueTokens(
    clientId: string,
    userId: string,
    scope: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = crypto.randomBytes(32).toString('hex');
    const refreshToken = crypto.randomBytes(48).toString('hex');

    const record: TokenRecord = {
      accessToken,
      refreshToken,
      clientId,
      userId,
      scope,
      accessTokenExpiresAt: new Date(Date.now() + 3600 * 1000),    // 1 hour
      refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000), // 30 days
      revoked: false,
    };

    this.tokens.set(accessToken, record);
    this.refreshTokenIndex.set(refreshToken, accessToken);

    return { accessToken, refreshToken };
  }
}
```

---

## 3. PKCE (Proof Key for Code Exchange)

```
Why PKCE is needed:

  Problem with SPA / mobile apps:
  → Cannot securely hold a client_secret
  → Authorization Code Interception Attack
  → A malicious app intercepts the redirect_uri and obtains the code

  How PKCE works:
  → code_verifier: A random string generated by the client
  → code_challenge: Hash of code_verifier (SHA-256)
  → Send the challenge with the authorization request
  → Send the verifier with the token exchange
  → Server hashes the verifier and compares it to the challenge

  PKCE Flow:
  ① code_verifier = random string (43–128 characters)
  ② code_challenge = BASE64URL(SHA256(code_verifier))
  ③ Authorization request: code_challenge + code_challenge_method=S256
  ④ Callback: receive authorization_code
  ⑤ Token exchange: send code + code_verifier
  ⑥ Server: verify SHA256(code_verifier) == code_challenge
```

### 3.1 Attacks That PKCE Prevents

```
Authorization Code Interception Attack (without PKCE):

  Legitimate App    Malicious App     Authorization Server
    │                  │                │
    │ Authorization     │                │
    │ request          │                │
    │──────────────────────────────────>│
    │                  │                │
    │ 302 Redirect     │                │
    │ ?code=abc123     │                │
    │<──────────────────────────────────│
    │                  │                │
    │ ★ Malicious app  │                │
    │   intercepts     │                │
    │   the code!      │                │
    │─────────────────>│                │
    │                  │                │
    │                  │ code → token   │
    │                  │──────────────>│
    │                  │                │
    │                  │ access_token   │
    │                  │<──────────────│
    │                  │                │
    │                  │ ★ Unauthorized resource access!

  Methods of interception:
  → Hijacking custom URL schemes (mobile)
  → Abusing browser extensions
  → OS-level redirect interception

Authorization Code Interception Attack (with PKCE):

  Legitimate App    Malicious App     Authorization Server
    │                  │                │
    │ Generate verifier │                │
    │ challenge = SHA256(verifier)       │
    │                  │                │
    │ Authorization     │                │
    │ request          │                │
    │ + challenge      │                │
    │──────────────────────────────────>│
    │                  │                │
    │ 302 Redirect     │                │
    │ ?code=abc123     │                │
    │<──────────────────────────────────│
    │                  │                │
    │ ★ Malicious app  │                │
    │   intercepts     │                │
    │   the code       │                │
    │─────────────────>│                │
    │                  │                │
    │                  │ code → token   │
    │                  │ verifier = ??? │
    │                  │──────────────>│
    │                  │                │
    │                  │ ✗ PKCE failed! │
    │                  │ verifier unknown│
    │                  │<──────────────│
    │                  │                │
    │ Legitimate app:   │                │
    │ code + verifier   │                │
    │──────────────────────────────────>│
    │                  │ ✓ PKCE passed  │
    │ access_token     │                │
    │<──────────────────────────────────│
```

```typescript
// PKCE implementation

// Generate code_verifier and code_challenge
async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  // code_verifier: cryptographically random string of 43–128 characters
  const verifier = base64URLEncode(crypto.getRandomValues(new Uint8Array(32)));

  // code_challenge: Base64URL-encoded SHA-256 hash
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const challenge = base64URLEncode(new Uint8Array(hashBuffer));

  return { verifier, challenge };
}

function base64URLEncode(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ① Authorization request (with PKCE)
async function startAuthFlow() {
  const { verifier, challenge } = await generatePKCE();
  const state = crypto.randomUUID();

  // Save verifier and state to session
  sessionStorage.setItem('pkce_verifier', verifier);
  sessionStorage.setItem('oauth_state', state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: 'my-spa-client-id',
    redirect_uri: 'https://myapp.com/callback',
    scope: 'openid profile email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `https://auth.example.com/authorize?${params}`;
}

// ⑤ Callback (PKCE + token exchange)
async function handlePKCECallback(code: string, state: string) {
  // Validate state
  const storedState = sessionStorage.getItem('oauth_state');
  if (state !== storedState) throw new Error('Invalid state');

  const verifier = sessionStorage.getItem('pkce_verifier');

  // Token exchange (no client_secret needed)
  const response = await fetch('https://auth.example.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'https://myapp.com/callback',
      client_id: 'my-spa-client-id',
      code_verifier: verifier!,  // In place of client_secret
    }),
  });

  const tokens = await response.json();
  // { access_token, refresh_token, id_token, token_type, expires_in }

  // Cleanup
  sessionStorage.removeItem('pkce_verifier');
  sessionStorage.removeItem('oauth_state');

  return tokens;
}
```

### 3.2 Inside PKCE: SHA-256 Verification

```
Cryptographic security of PKCE:

  code_verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"

  code_challenge = BASE64URL(SHA256(code_verifier))
                 = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

  Why it is secure:
  ① SHA-256 is a one-way function
     → It is computationally infeasible to reverse-engineer the verifier from the challenge
     → Search space of 2^256 ≈ 1.16 × 10^77

  ② Verifier is 43–128 characters (RFC 7636)
     → Sufficient entropy
     → Brute force is infeasible

  ③ Verifier never travels over the network (back channel only)
     → Only the challenge is sent over the front channel
     → Even if the challenge is intercepted, the verifier remains unknown

  plain method (deprecated):
    → code_challenge = code_verifier itself
    → Meaningless if intercepted
    → For clients that do not support SHA-256
    → OAuth 2.1 requires S256 only
```

---

## 4. Client Credentials Flow

```
Client Credentials Flow:

  Use case: Server-to-server communication (no user involvement)
  Examples: Batch processing, inter-microservice calls, backend APIs

  Client             Authorization Server    Resource Server
    │                   │                   │
    │ client_id +       │                   │
    │ client_secret     │                   │
    │──────────────────>│                   │
    │                   │                   │
    │ access_token      │                   │
    │<──────────────────│                   │
    │                   │                   │
    │ Bearer token      │                   │
    │──────────────────────────────────────>│
    │                   │                   │
    │ Resource          │                   │
    │<──────────────────────────────────────│

  Characteristics:
  → No user consent screen
  → Authenticated with client_id + client_secret
  → No refresh_token issued
  → Managed by token expiry
```

### 4.1 Client Credentials Implementation Patterns

```typescript
// Client Credentials Flow (basic)
async function getServiceToken(): Promise<string> {
  const response = await fetch('https://auth.example.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // Send client_id:client_secret via Basic authentication
      'Authorization': `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'read:data write:data',
    }),
  });

  const { access_token } = await response.json();
  return access_token;
}

// Implementation with token cache (for production)
class ServiceTokenManager {
  private token: string | null = null;
  private expiresAt: number = 0;
  private refreshPromise: Promise<string> | null = null;
  private readonly bufferSeconds = 60; // Refresh 60 seconds before expiry

  constructor(
    private clientId: string,
    private clientSecret: string,
    private tokenUrl: string,
    private scope: string,
  ) {}

  async getToken(): Promise<string> {
    // Return cached token if still valid
    if (this.token && Date.now() < this.expiresAt - this.bufferSeconds * 1000) {
      return this.token;
    }

    // Prevent duplicate refresh on concurrent requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.fetchNewToken();
    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async fetchNewToken(): Promise<string> {
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${this.clientId}:${this.clientSecret}`,
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: this.scope,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token request failed: ${response.status}`);
    }

    const data = await response.json();
    this.token = data.access_token;
    this.expiresAt = Date.now() + data.expires_in * 1000;

    return this.token;
  }
}

// Example usage in inter-microservice communication
class OrderService {
  private tokenManager: ServiceTokenManager;

  constructor() {
    this.tokenManager = new ServiceTokenManager(
      process.env.ORDER_SERVICE_CLIENT_ID!,
      process.env.ORDER_SERVICE_CLIENT_SECRET!,
      'https://auth.example.com/token',
      'inventory:read inventory:reserve payments:create',
    );
  }

  async createOrder(orderData: OrderRequest): Promise<Order> {
    const token = await this.tokenManager.getToken();

    // Query inventory service
    const inventory = await fetch('https://inventory.internal/api/check', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items: orderData.items }),
    });

    // Send to payment service
    const payment = await fetch('https://payments.internal/api/charge', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: orderData.total,
        currency: 'JPY',
      }),
    });

    // ...
  }
}
```

### 4.2 private_key_jwt Authentication

```
Advanced authentication methods for Client Credentials:

  client_secret_basic (basic):
    → Authorization: Basic base64(client_id:client_secret)
    → Simple, but requires secure management of the secret

  client_secret_post:
    → Include client_id and client_secret in the POST body
    → TLS required

  private_key_jwt (recommended, high security):
    → Send a JWT signed with an RSA/EC private key instead of client_secret
    → Private key is never transmitted externally
    → Easy key rotation

  private_key_jwt flow:
    ┌──────────────┐                    ┌──────────────┐
    │ Client        │                    │ Auth Server   │
    │              │                    │              │
    │ Generate JWT:│                    │              │
    │ {            │                    │              │
    │  iss: client │                    │              │
    │  sub: client │                    │              │
    │  aud: auth   │                    │              │
    │  exp: +5min  │                    │              │
    │  jti: random │                    │              │
    │ }            │                    │              │
    │ → Sign with  │                    │              │
    │   private key│                    │              │
    │              │                    │              │
    │ POST /token  │                    │              │
    │ grant_type=  │                    │              │
    │ client_creds │                    │              │
    │ client_      │                    │              │
    │ assertion=JWT│                    │              │
    │─────────────────────────────────>│              │
    │              │                    │ Verify with  │
    │              │                    │ public key   │
    │              │                    │ (JWKS)       │
    │              │                    │              │
    │ access_token │                    │              │
    │<─────────────────────────────────│              │
    └──────────────┘                    └──────────────┘
```

```typescript
// Implementation of private_key_jwt authentication
import * as jose from 'jose';

async function getTokenWithPrivateKeyJWT(
  privateKey: jose.KeyLike,
  clientId: string,
  tokenUrl: string,
  scope: string,
): Promise<string> {
  // Generate client assertion JWT
  const assertion = await new jose.SignJWT({})
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(clientId)
    .setSubject(clientId)
    .setAudience(tokenUrl)
    .setIssuedAt()
    .setExpirationTime('5m')
    .setJti(crypto.randomUUID())
    .sign(privateKey);

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope,
      client_id: clientId,
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: assertion,
    }),
  });

  const data = await response.json();
  return data.access_token;
}
```

---

## 5. Device Code Flow

```
Device Code Flow:

  Use case: Devices where keyboard input is difficult (TVs, IoT, CLI)
  Example: "Go to https://example.com/activate on your TV
            and enter the code ABC-123"

  Device          Authorization Server    User's Phone/PC
    │               │                 │
    │ device auth    │                 │
    │──────────────>│                 │
    │               │                 │
    │ device_code + │                 │
    │ user_code +   │                 │
    │ verification  │                 │
    │ _uri          │                 │
    │<──────────────│                 │
    │               │                 │
    │ Display on     │                 │
    │ screen:        │                 │
    │ "Code:         │                 │
    │  ABC-123"      │                 │
    │               │ User accesses   │
    │               │ verification_uri│
    │               │<────────────────│
    │               │ Enter code +    │
    │               │ approve         │
    │               │<────────────────│
    │               │                 │
    │ Polling        │                 │
    │ (device_code)  │                 │
    │──────────────>│                 │
    │               │                 │
    │ access_token  │                 │
    │<──────────────│                 │
```

### 5.1 Security of the Device Code Flow

```
Attacks and countermeasures for the Device Code Flow:

  Attack 1: Remote phishing
    → Attacker sends their own device code via a phishing email
    → "Please log in and enter ABC-123"
    → User unknowingly grants access to the attacker's device
    Countermeasures:
      → Display device information to the user
      → Explicitly state "Do you want to allow access from this device?"
      → Do not use verification_uri_complete (prevents auto-approval)

  Attack 2: Excessive polling (DoS)
    → Malicious client polls at a high frequency
    Countermeasures:
      → Specify minimum interval with the interval parameter
      → Request interval extension with the slow_down error
      → Rate limiting

  Attack 3: Brute force of device codes
    → Brute-force attempts against user_code
    Countermeasures:
      → Limit the number of user_code attempts
      → Sufficient entropy (8-character alphanumeric ≈ ~40 bits)
      → Short expiry (about 15 minutes)
```

```typescript
// Device Code Flow (for CLI tools, etc.)
async function deviceCodeFlow() {
  // Device authorization request
  const deviceRes = await fetch('https://auth.example.com/device/code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'my-cli-app',
      scope: 'openid profile',
    }),
  });

  const {
    device_code,
    user_code,
    verification_uri,
    verification_uri_complete,
    expires_in,
    interval,
  } = await deviceRes.json();

  // Display to user
  console.log(`Open ${verification_uri} in a browser and`);
  console.log(`enter the code ${user_code}.`);

  // Poll to obtain token
  let pollInterval = interval;
  const deadline = Date.now() + expires_in * 1000;

  while (Date.now() < deadline) {
    await sleep(pollInterval * 1000);

    const tokenRes = await fetch('https://auth.example.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code,
        client_id: 'my-cli-app',
      }),
    });

    const data = await tokenRes.json();

    if (data.error === 'authorization_pending') continue;
    if (data.error === 'slow_down') {
      pollInterval += 5; // Extend polling interval
      continue;
    }
    if (data.error) throw new Error(data.error_description);

    return data; // { access_token, refresh_token, ... }
  }

  throw new Error('Device code expired');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## 6. Implicit Flow (Deprecated)

```
Implicit Flow (historical background and reasons for deprecation):

  An early SPA flow in OAuth 2.0:
    → Obtain access_token directly from the browser
    → No token exchange step required (simpler)
    → A compromise from before CORS was widely supported

  Flow:
    Client             Authorization Server
      │                   │
      │ response_type=    │
      │ token             │
      │──────────────────>│
      │                   │
      │ #access_token=... │  ← Included in URL fragment
      │<──────────────────│

  Reasons for deprecation:

    ① Access token is exposed in the front channel:
       → Included in the URL fragment
       → Remains in browser history
       → May leak via the Referer header
       → May be recorded in log files

    ② Refresh tokens cannot be used:
       → Token expiry requires re-authorization
       → Poor user experience

    ③ Token substitution attack:
       → Attacker can inject their own token
       → Difficult to validate the aud claim

    ④ PKCE cannot be used:
       → Because there is no token exchange step

  Alternatives:
    → Use Authorization Code + PKCE
    → BFF (Backend for Frontend) pattern
    → Implicit flow is planned for removal in OAuth 2.1

  Migration guide:
    Before (Implicit):
      response_type=token
      → #access_token=xxx is returned directly

    After (Auth Code + PKCE):
      response_type=code
      code_challenge=xxx
      code_challenge_method=S256
      → ?code=yyy is returned
      → code → token exchange via back channel
```

---

## 7. Token Lifecycle Management

### 7.1 Refresh Token Flow

```
How the refresh token works:

  When the access_token has expired:

  Client             Authorization Server
    │                   │
    │ API request        │
    │ + expired token    │
    │──────────────────>│
    │                   │
    │ 401 Unauthorized  │
    │<──────────────────│
    │                   │
    │ POST /token       │
    │ grant_type=       │
    │ refresh_token     │
    │ + refresh_token   │
    │──────────────────>│
    │                   │
    │ New access_token + │
    │ New refresh_token  │
    │ (rotation)         │
    │<──────────────────│
    │                   │
    │ API request        │
    │ + new token        │
    │──────────────────>│
    │                   │
    │ 200 OK + data      │
    │<──────────────────│

  Token expiry design:

    access_token:
      → Short-lived: 5 minutes to 1 hour
      → Minimizes impact if leaked
      → Speeds up reflection of permission changes
      → Recommended: 15 minutes (financial: 5 minutes)

    refresh_token:
      → Long-lived: 7 to 90 days
      → User experience (prevents frequent re-login)
      → Rotated on use (exchanged for a new one)
      → Recommended: 30 days (can extend based on activity)

    id_token (OIDC):
      → Proves only the authentication time
      → Not refreshable
      → Recommended: 1 hour
```

```typescript
// Refresh token rotation implementation
class TokenRefreshManager {
  private refreshing: Promise<TokenPair> | null = null;

  constructor(
    private tokenUrl: string,
    private clientId: string,
    private onTokenRefresh: (tokens: TokenPair) => void,
  ) {}

  // Token refresh (with deduplication)
  async refreshTokens(currentRefreshToken: string): Promise<TokenPair> {
    // Return the same Promise if a refresh is already in progress
    if (this.refreshing) {
      return this.refreshing;
    }

    this.refreshing = this.doRefresh(currentRefreshToken);

    try {
      const tokens = await this.refreshing;
      this.onTokenRefresh(tokens);
      return tokens;
    } finally {
      this.refreshing = null;
    }
  }

  private async doRefresh(refreshToken: string): Promise<TokenPair> {
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();

      if (error.error === 'invalid_grant') {
        // Refresh token is invalid → re-authentication required
        throw new TokenRefreshError('refresh_token_invalid', 'Re-authentication required');
      }

      throw new TokenRefreshError(error.error, error.error_description);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,  // Rotation: new refresh_token
      expiresIn: data.expires_in,
    };
  }
}

// Integration with HTTP client (auto-refresh)
class AuthenticatedHttpClient {
  private accessToken: string;
  private refreshToken: string;
  private expiresAt: number;
  private refreshManager: TokenRefreshManager;

  constructor(
    initialTokens: TokenPair,
    refreshManager: TokenRefreshManager,
  ) {
    this.accessToken = initialTokens.accessToken;
    this.refreshToken = initialTokens.refreshToken;
    this.expiresAt = Date.now() + initialTokens.expiresIn * 1000;
    this.refreshManager = refreshManager;
  }

  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Check access token expiry
    await this.ensureValidToken();

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });

    // Attempt refresh if 401 is returned
    if (response.status === 401) {
      try {
        await this.doTokenRefresh();

        // Retry
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${this.accessToken}`,
          },
        });
      } catch (error) {
        if (error instanceof TokenRefreshError) {
          // Refresh failed → re-login required
          this.redirectToLogin();
        }
        throw error;
      }
    }

    return response;
  }

  private async ensureValidToken(): Promise<void> {
    // Proactively refresh 30 seconds before expiry
    if (Date.now() > this.expiresAt - 30 * 1000) {
      await this.doTokenRefresh();
    }
  }

  private async doTokenRefresh(): Promise<void> {
    const tokens = await this.refreshManager.refreshTokens(this.refreshToken);
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    this.expiresAt = Date.now() + tokens.expiresIn * 1000;
  }

  private redirectToLogin(): void {
    window.location.href = '/login?reason=session_expired';
  }
}
```

### 7.2 Refresh Token Security

```
Importance of refresh token rotation:

  Without rotation (dangerous):
    → Leaked refresh token → indefinite access
    → Attacker and legitimate user share the same token
    → Difficult to detect

  With rotation (recommended):
    → Issue a new token on every refresh
    → Invalidate the old token

  Replay detection:

    Normal flow:
      RT1 → new AT + RT2 → new AT + RT3 → ...

    Attack flow:
      Attacker steals RT1
      Legitimate user: RT1 → RT2 (normal)
      Attacker:        RT1 → ✗ Already used!
        → Invalidate all refresh tokens
        → Require user to re-login

  How replay detection works:
  ┌──────────────────────────────────────────┐
  │ Token Family                              │
  │                                           │
  │ RT1 → RT2 → RT3 → RT4 (currently valid)  │
  │                                           │
  │ If RT1 is reused:                         │
  │ → Invalidate RT1, RT2, RT3, RT4 entirely  │
  │ → Invalidate the entire "token family"    │
  │ → Require user to re-authenticate         │
  └──────────────────────────────────────────┘
```

```typescript
// Refresh token rotation + replay detection
class RefreshTokenStore {
  private redis: Redis;

  async storeToken(
    tokenFamily: string,
    refreshToken: string,
    userId: string,
    clientId: string,
    expiresIn: number,
  ): Promise<void> {
    const data = JSON.stringify({
      userId,
      clientId,
      tokenFamily,
      createdAt: Date.now(),
    });

    // Map refresh token → data
    await this.redis.setex(`rt:${refreshToken}`, expiresIn, data);

    // Add to token family (for replay detection)
    await this.redis.sadd(`tf:${tokenFamily}`, refreshToken);
    await this.redis.expire(`tf:${tokenFamily}`, expiresIn);
  }

  async useToken(refreshToken: string): Promise<{
    userId: string;
    clientId: string;
    tokenFamily: string;
  } | null> {
    const raw = await this.redis.get(`rt:${refreshToken}`);

    if (!raw) {
      // Token does not exist
      // → Expired or already used (possible replay attack)
      return null;
    }

    const data = JSON.parse(raw);

    // Mark token as used (single-use)
    await this.redis.del(`rt:${refreshToken}`);

    return data;
  }

  // Invalidate entire token family (on replay detection)
  async revokeFamily(tokenFamily: string): Promise<void> {
    const tokens = await this.redis.smembers(`tf:${tokenFamily}`);

    if (tokens.length > 0) {
      const keys = tokens.map(t => `rt:${t}`);
      await this.redis.del(...keys);
    }

    await this.redis.del(`tf:${tokenFamily}`);
  }

  // Invalidate all tokens for a specific user
  async revokeAllForUser(userId: string): Promise<void> {
    // Retrieve all token families for the user and invalidate all
    const families = await this.redis.smembers(`user_families:${userId}`);
    for (const family of families) {
      await this.revokeFamily(family);
    }
    await this.redis.del(`user_families:${userId}`);
  }
}
```

---

## 8. Scope Design

```
Scope design patterns:

  resource:action format:
    → read:user, write:user, delete:user
    → read:repo, write:repo, admin:repo

  GitHub scope examples:
    → repo: general repository access
    → read:user: read user profile
    → user:email: read email address
    → admin:org: organization management

  Design principles:
    → Least privilege: only request the minimum required scopes
    → Granularity: not too fine, not too coarse
    → Naming: consistent resource:action pattern
    → Documentation: clearly define the meaning of each scope
```

### 8.1 Detailed Scope Design Patterns

```
Hierarchical scope design:

  Coarse-grained (GitHub style):
    repo                → general repository (read, write, delete)
    repo:status         → commit status only
    read:user           → read user information
    user:email          → email address only

    Advantages: Simple and easy for users to understand
    Disadvantages: Fine-grained control is difficult

  Medium-grained (Google style):
    https://www.googleapis.com/auth/calendar
    https://www.googleapis.com/auth/calendar.readonly
    https://www.googleapis.com/auth/gmail.send
    https://www.googleapis.com/auth/gmail.readonly

    Advantages: Namespace is clear with URI
    Disadvantages: URLs are long

  Fine-grained (resource:action style):
    users:read           → View user list
    users:write          → Update user information
    users:delete         → Delete users
    posts:read           → View articles
    posts:write          → Create and edit articles
    posts:publish        → Publish articles
    admin:settings:read  → View admin settings
    admin:settings:write → Change admin settings

    Advantages: Thorough principle of least privilege
    Disadvantages: Number of scopes grows large

  Consent screen display:
  ┌─────────────────────────────────────────────┐
  │  MyApp is requesting access                  │
  │                                              │
  │  □ View profile information (users:read)     │
  │  □ Read email address (users:email)          │
  │  □ Read repositories (repos:read)            │
  │                                              │
  │  [Allow]  [Deny]                             │
  └─────────────────────────────────────────────┘
```

```typescript
// Scope-based authorization check implementation
class ScopeValidator {
  // Convert scope string to array
  static parse(scopeString: string): string[] {
    return scopeString.split(' ').filter(Boolean);
  }

  // Check if the requested scope is included in the granted scopes
  static hasScope(grantedScopes: string[], requiredScope: string): boolean {
    // Exact match check
    if (grantedScopes.includes(requiredScope)) return true;

    // Hierarchy check ("repo" includes "repo:status")
    for (const granted of grantedScopes) {
      if (requiredScope.startsWith(granted + ':')) return true;
    }

    // Wildcard check
    for (const granted of grantedScopes) {
      if (granted.endsWith(':*')) {
        const prefix = granted.slice(0, -1);
        if (requiredScope.startsWith(prefix)) return true;
      }
    }

    return false;
  }

  // Check multiple scopes (all required)
  static hasAllScopes(
    grantedScopes: string[],
    requiredScopes: string[],
  ): boolean {
    return requiredScopes.every(scope => this.hasScope(grantedScopes, scope));
  }

  // Check multiple scopes (any one required)
  static hasAnyScope(
    grantedScopes: string[],
    requiredScopes: string[],
  ): boolean {
    return requiredScopes.some(scope => this.hasScope(grantedScopes, scope));
  }
}

// Use as Express middleware
function requireScope(...scopes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const tokenScopes = req.tokenPayload?.scope?.split(' ') || [];

    if (!ScopeValidator.hasAllScopes(tokenScopes, scopes)) {
      return res.status(403).json({
        error: 'insufficient_scope',
        required_scope: scopes.join(' '),
        granted_scope: tokenScopes.join(' '),
      });
    }

    next();
  };
}

// Usage examples
app.get('/api/repos',
  authenticateBearer,
  requireScope('repos:read'),
  listReposHandler,
);

app.post('/api/repos/:id/deploy',
  authenticateBearer,
  requireScope('repos:write', 'deploy:execute'),
  deployHandler,
);
```

---

## 9. Token Revocation

```
Token revocation mechanism (RFC 7009):

  POST /revoke
  Content-Type: application/x-www-form-urlencoded
  Authorization: Basic <client_credentials>

  token=<access_token or refresh_token>
  &token_type_hint=refresh_token

  Cases requiring revocation:
    → User logs out
    → User disconnects an app integration
    → Admin revokes a user's access
    → All tokens invalidated on password change
    → On a security incident

  Revocation scope:
    → Revoke refresh_token → also revoke related access_tokens (recommended)
    → Revoke access_token only → re-obtainable with refresh_token (insufficient)
```

```typescript
// Token revocation endpoint implementation
async function handleRevocation(req: express.Request, res: express.Response) {
  const { token, token_type_hint } = req.body;
  const { clientId } = extractClientCredentials(req);

  // RFC 7009: always return 200 OK on success
  // (also return 200 if token does not exist)
  res.status(200);

  try {
    if (token_type_hint === 'refresh_token' || !token_type_hint) {
      // Attempt to revoke refresh token
      const revoked = await tokenStore.revokeRefreshToken(token, clientId);
      if (revoked) {
        // Also revoke related access tokens
        await tokenStore.revokeAccessTokensByRefreshToken(token);
        return res.json({ revoked: true });
      }
    }

    if (token_type_hint === 'access_token' || !token_type_hint) {
      // Attempt to revoke access token
      await tokenStore.revokeAccessToken(token, clientId);
      return res.json({ revoked: true });
    }

    res.json({ revoked: false });
  } catch (error) {
    // Return 200 OK even on error (RFC 7009 compliant)
    res.json({ revoked: false });
  }
}

// Token introspection (RFC 7662)
async function handleIntrospection(req: express.Request, res: express.Response) {
  const { token } = req.body;

  const tokenData = await tokenStore.getToken(token);

  if (!tokenData || tokenData.revoked || tokenData.expiresAt < new Date()) {
    // Invalid token
    return res.json({ active: false });
  }

  // Valid token
  res.json({
    active: true,
    scope: tokenData.scope,
    client_id: tokenData.clientId,
    username: tokenData.username,
    token_type: 'Bearer',
    exp: Math.floor(tokenData.expiresAt.getTime() / 1000),
    iat: Math.floor(tokenData.createdAt.getTime() / 1000),
    sub: tokenData.userId,
    aud: tokenData.audience,
    iss: 'https://auth.example.com',
  });
}
```

---

## 10. Security Threats and Countermeasures

```
Major attacks against OAuth 2.0:

  ┌──────────────────────────────┬──────────────────────────────┐
  │ Attack                        │ Countermeasure               │
  ├──────────────────────────────┼──────────────────────────────┤
  │ CSRF (forged auth requests)   │ state parameter              │
  │ Authorization code interception│ PKCE                        │
  │ Open redirector               │ Exact match on redirect_uri  │
  │ Token leakage                 │ Short-lived + TLS + HttpOnly │
  │ Code reuse attack             │ Single-use + family revocation│
  │ Clickjacking                  │ X-Frame-Options: DENY        │
  │ Mix-Up attack                 │ Validate iss parameter       │
  │ Token substitution            │ Validate aud / azp claims    │
  └──────────────────────────────┴──────────────────────────────┘
```

### 10.1 Open Redirector Attack

```
How the open redirector attack works:

  ① Attacker manipulates redirect_uri:
     /authorize?
       client_id=legit-app
       &redirect_uri=https://evil.com/steal  ← Invalid URI

  ② If the authorization server does not validate redirect_uri:
     → Authorization code is sent to evil.com
     → Attacker obtains the code

  Countermeasures:
    → Exact match validation on redirect_uri (partial match forbidden)
    → Wildcards forbidden
    → Only allow pre-registered URIs
    → Reject path additions or query parameter changes as well

  Safe implementation:
    ✗ redirect_uri.startsWith('https://myapp.com')
      → Would match https://myapp.com.evil.com

    ✗ redirect_uri "starts with" one of the registered URIs
      → Could match https://myapp.com/callback/../../../evil

    ✓ redirect_uri === registered URI (exact match only)
```

### 10.2 CSRF Attack and the state Parameter

```
CSRF attack in OAuth 2.0:

  Attack scenario (without state parameter):

    Attacker           Victim              Authorization Server
      │                    │                   │
      │ ① Obtain auth code │                   │
      │   with attacker's  │                   │
      │   account          │                   │
      │───────────────────────────────────────>│
      │                    │                   │
      │ code=ATTACKER_CODE │                   │
      │<───────────────────────────────────────│
      │                    │                   │
      │ ② Make victim click│                   │
      │   fake callback URL│                   │
      │ myapp.com/callback │                   │
      │ ?code=ATTACKER_CODE│                   │
      │───────────────────>│                   │
      │                    │                   │
      │                    │ ③ Obtain token    │
      │                    │   with            │
      │                    │   ATTACKER_CODE   │
      │                    │──────────────────>│
      │                    │                   │
      │                    │ ④ Uses attacker's │
      │                    │   account token!  │
      │                    │<──────────────────│

    Result:
      → Victim's app is linked to attacker's account
      → Victim uploads data to attacker's account
      → Attacker retrieves that data

  Countermeasure: state parameter
    → Generate a cryptographically random value
    → Save it tied to the session
    → Verify it matches on callback
    → Reject the request if it does not match
```

---

## 11. BFF (Backend for Frontend) Pattern

```
BFF Pattern Overview:

  OAuth security challenges with SPAs:
    → Storing access_token in the browser → XSS risk
    → Storing refresh_token in the browser → leakage risk
    → Even with PKCE, token protection itself is insufficient

  BFF pattern solution:
    → Place a thin BFF server between the frontend and backend
    → BFF handles the OAuth flow on behalf of the frontend
    → Tokens are stored only on the server side (BFF)
    → Communication with the browser uses HttpOnly Cookies

  Architecture:
  ┌─────────┐  Cookie    ┌──────┐  Bearer   ┌──────────┐
  │ SPA     │──────────>│ BFF  │─────────>│ API      │
  │ (React) │<──────────│      │<─────────│ Server   │
  └─────────┘           └──┬───┘          └──────────┘
                           │
                           │ OAuth 2.0
                           │
                        ┌──┴───┐
                        │ Auth │
                        │Server│
                        └──────┘

  BFF responsibilities:
    → /bff/login → Start authorization request
    → /bff/callback → Handle callback + create session
    → /bff/api/* → API proxy (attach Bearer token)
    → /bff/logout → Destroy session + revoke token
```

```typescript
// BFF pattern implementation
import express from 'express';
import session from 'express-session';

const bff = express();

bff.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

// Start login
bff.get('/bff/login', async (req, res) => {
  const { verifier, challenge } = await generatePKCE();
  const state = crypto.randomUUID();

  // Save to session
  req.session.pkceVerifier = verifier;
  req.session.oauthState = state;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.OAUTH_CLIENT_ID!,
    redirect_uri: `${process.env.BFF_URL}/bff/callback`,
    scope: 'openid profile email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  res.redirect(`${process.env.AUTH_URL}/authorize?${params}`);
});

// Callback
bff.get('/bff/callback', async (req, res) => {
  const { code, state } = req.query as Record<string, string>;

  // Validate state
  if (state !== req.session.oauthState) {
    return res.status(403).json({ error: 'Invalid state' });
  }

  // Token exchange
  const tokenResponse = await fetch(`${process.env.AUTH_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${process.env.BFF_URL}/bff/callback`,
      client_id: process.env.OAUTH_CLIENT_ID!,
      client_secret: process.env.OAUTH_CLIENT_SECRET!, // BFF is a Confidential Client
      code_verifier: req.session.pkceVerifier,
    }),
  });

  const tokens = await tokenResponse.json();

  // Store tokens in session (never pass to browser!)
  req.session.accessToken = tokens.access_token;
  req.session.refreshToken = tokens.refresh_token;
  req.session.tokenExpiresAt = Date.now() + tokens.expires_in * 1000;

  // Cleanup
  delete req.session.pkceVerifier;
  delete req.session.oauthState;

  // Redirect to SPA
  res.redirect(process.env.SPA_URL!);
});

// API proxy
bff.all('/bff/api/*', async (req, res) => {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Check token expiry + refresh
  if (Date.now() > req.session.tokenExpiresAt - 30000) {
    try {
      const refreshed = await refreshTokens(req.session.refreshToken);
      req.session.accessToken = refreshed.access_token;
      req.session.refreshToken = refreshed.refresh_token;
      req.session.tokenExpiresAt = Date.now() + refreshed.expires_in * 1000;
    } catch {
      return res.status(401).json({ error: 'Session expired' });
    }
  }

  // Proxy to API
  const apiPath = req.path.replace('/bff/api', '');
  const apiResponse = await fetch(`${process.env.API_URL}${apiPath}`, {
    method: req.method,
    headers: {
      'Authorization': `Bearer ${req.session.accessToken}`,
      'Content-Type': req.headers['content-type'] || 'application/json',
    },
    body: ['POST', 'PUT', 'PATCH'].includes(req.method)
      ? JSON.stringify(req.body)
      : undefined,
  });

  const data = await apiResponse.json();
  res.status(apiResponse.status).json(data);
});

// Logout
bff.post('/bff/logout', async (req, res) => {
  // Revoke token
  if (req.session.refreshToken) {
    await fetch(`${process.env.AUTH_URL}/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${process.env.OAUTH_CLIENT_ID}:${process.env.OAUTH_CLIENT_SECRET}`,
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        token: req.session.refreshToken,
        token_type_hint: 'refresh_token',
      }),
    });
  }

  // Destroy session
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});
```

---

## 12. Anti-patterns

```
OAuth 2.0 anti-patterns:

  ① Including client_secret in the frontend:
     ✗ Hard-coding client_secret in SPA JavaScript
     → Viewable via browser developer tools
     → Discoverable from source maps
     Countermeasure: Use Public Client + PKCE

  ② Partial match validation on redirect_uri:
     ✗ Validating with startsWith or contains
     → Open redirector attacks are possible
     Countermeasure: Allow exact match only

  ③ Omitting the state parameter:
     ✗ Running OAuth flow without CSRF protection
     → Attackers can link their account to victims
     Countermeasure: Always use a cryptographically random state

  ④ Long-lived access tokens:
     ✗ Setting access_token expiry to 24+ hours
     → Extends the impact window if leaked
     Countermeasure: Short-lived (15 minutes) + refresh token

  ⑤ No refresh token rotation:
     ✗ Permanently using the same refresh token
     → Allows persistent access if leaked
     Countermeasure: Rotation + replay detection

  ⑥ Using the Implicit flow:
     ✗ Using response_type=token in SPAs
     → Token is exposed in the URL fragment
     Countermeasure: Migrate to Authorization Code + PKCE

  ⑦ Excessive scope requests:
     ✗ Requesting more scopes than necessary
     → Damages user trust
     → Expands the blast radius if leaked
     Countermeasure: Principle of least privilege (request only required scopes)

  ⑧ Improper token storage:
     ✗ Storing access tokens in localStorage
     → Vulnerable to theft via XSS
     Countermeasure: BFF pattern or in-memory storage + HttpOnly Cookie
```

---

## 13. Edge Cases

```
OAuth 2.0 edge cases:

  ① Scope downgrade:
     → User approves only a subset of the requested scopes
     → Client should verify the actually granted scopes
     → Check via the scope parameter in the response

  ② Authorization server downtime:
     → Token refresh fails
     → Countermeasure: Continue operating with cached tokens temporarily
     → Resource access remains possible until access_token expires

  ③ Clock skew:
     → Time difference between servers when validating JWT exp/iat
     → Countermeasure: Allow ±30-second tolerance (clock skew tolerance)

  ④ Multiple redirect_uris:
     → Different callback URLs for development and production environments
     → redirect_uri in the authorization request must exactly match one of the registered URIs
     → Separating client IDs per environment is safer

  ⑤ Maximum token size:
     → When using JWT as the access token
     → HTTP header size limit (typically 8KB)
     → Can be exceeded if there are many scopes or claims
     → Countermeasure: Token introspection, reference tokens
```

---

## 14. Exercises

```
Exercise 1 (Basic): Implement the Authorization Code + PKCE flow

  Implement an OAuth 2.0 client with the following requirements.

  Requirements:
  1. Generate PKCE-enabled authorization requests
  2. CSRF protection via state parameter
  3. Callback handling (validation + token exchange)
  4. Secure token storage

  Test cases:
  → code_verifier length must be 43–128 characters
  → code_challenge must be correctly computed with SHA-256
  → An exception must be thrown on state mismatch
  → verifier must be cleaned up after token exchange

Exercise 2 (Applied): Refresh token rotation

  Implement a refresh token management system with the following features.

  Requirements:
  1. Refresh token rotation (new token on every refresh)
  2. Replay detection (detect reuse of used tokens)
  3. Token family invalidation
  4. Invalidate all tokens per user

  Test cases:
  → Normal refresh flow
  → Reuse of a used token → entire family is invalidated
  → Password change → all tokens invalidated

Exercise 3 (Advanced): Build an authorization server

  Implement an OAuth 2.0 authorization server.

  Requirements:
  1. Support Authorization Code + PKCE flow
  2. Support Client Credentials flow
  3. Refresh token flow
  4. Token revocation endpoint (RFC 7009)
  5. Token introspection (RFC 7662)
  6. Client registration management

  Security requirements:
  → Single-use authorization codes
  → Exact match validation on redirect_uri
  → PKCE S256 verification
  → Refresh token rotation
```

---

## 15. FAQ and Troubleshooting

```
Q1: What is the difference between OAuth 2.0 and OpenID Connect?
A1: OAuth 2.0 is "authorization," OIDC is "authentication":
    → OAuth 2.0: "Allow MyApp to access GitHub repositories"
    → OIDC: "This user is alice@example.com"
    → OIDC is an authentication layer built on top of OAuth 2.0
    → OIDC additions: id_token, userinfo endpoint, standard claims

Q2: Is PKCE required for Confidential Clients too?
A2: In OAuth 2.1, PKCE will be mandatory for all clients:
    → Also effective as an additional security layer for Confidential Clients
    → Further reduces the risk of authorization code leakage
    → Low implementation cost (a few dozen lines of code) — always recommended

Q3: What is the appropriate access token expiry?
A3: It depends on the use case:
    → General web apps: 15–60 minutes
    → Financial systems: 5–15 minutes
    → Between microservices: 30–60 minutes
    → Rule: shorter is more secure, longer is better for UX
    → Adjust in combination with refresh tokens

Q4: Where should tokens be stored in a SPA?
A4: Recommended methods (in order of security):
    ① BFF pattern (server-side session) ← most secure
    ② Memory (JavaScript variable) + HttpOnly Cookie for refresh
    ③ sessionStorage (isolated per tab)
    ✗ localStorage is not recommended due to high XSS risk

Q5: What is the difference between the state parameter and PKCE?
A5: They defend against different attacks:
    → state: Defends against CSRF attacks (injecting attacker's code)
    → PKCE: Defends against authorization code interception attacks (stealing legitimate code)
    → Using both is recommended (they address different threats)

Q6: Are there constraints on the format of user_code in the Device Code flow?
A6: RFC 8628 recommendations:
    → 8 or more alphanumeric characters (uppercase recommended)
    → Hyphen separation recommended (e.g., ABCD-EFGH)
    → Exclude easily confused characters (0/O, 1/I/l)
    → Sufficient entropy (to prevent brute force)

Q7: What should be done if an old refresh token is used after rotation?
A7: It is likely a replay attack:
    → Invalidate the entire token family
    → Require the user to re-authenticate
    → Issue a security alert
    → Record in the audit log
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is the most important thing. Not just theory — actually writing code and verifying behavior will deepen your understanding.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in professional work?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Flow | Use Case | Security |
|--------|------|------------|
| Authorization Code | Web app (with server) | Highest |
| Auth Code + PKCE | SPA, mobile | High |
| Client Credentials | Server-to-server | High |
| Device Code | IoT, CLI | Moderate |
| Implicit | Deprecated | Low |

| Topic | Key Points |
|---------|---------|
| PKCE | Prevents authorization code interception via SHA-256. Mandatory in OAuth 2.1 |
| state | CSRF protection. Tie a cryptographically random value to the session |
| Refresh token | Rotation + replay detection recommended |
| Scope | Principle of least privilege. Use resource:action format |
| BFF pattern | Most secure token management method for SPAs |
| Token revocation | RFC 7009. Always execute on logout |

---

## Next Guides to Read

---

## References
1. RFC 6749. "The OAuth 2.0 Authorization Framework." IETF, 2012.
2. RFC 7636. "Proof Key for Code Exchange by OAuth Public Clients." IETF, 2015.
3. RFC 8628. "OAuth 2.0 Device Authorization Grant." IETF, 2019.
4. RFC 7009. "OAuth 2.0 Token Revocation." IETF, 2013.
5. RFC 7662. "OAuth 2.0 Token Introspection." IETF, 2015.
6. OAuth 2.0 Security Best Current Practice. IETF draft, 2024.
7. OAuth 2.1 Authorization Framework. IETF draft, 2024.
8. OAuth.net. "OAuth 2.0." oauth.net, 2024.

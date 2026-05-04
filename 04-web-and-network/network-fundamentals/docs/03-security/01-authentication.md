# Authentication Methods

> Systematically understand Web API authentication methods. Learn how Basic authentication, Bearer Token, OAuth 2.0, and JWT work and when to use each, and design secure authentication systems.

## Prerequisites

The following knowledge is required to understand this guide:
- Hash function basics — the role of one-way functions such as SHA-256

---

## What You Will Learn in This Chapter

- [ ] Understand how major authentication methods work and their differences
- [ ] Grasp the OAuth 2.0 flow
- [ ] Learn the structure of JWT and security considerations
- [ ] Master implementation patterns for authentication with OpenID Connect
- [ ] Understand modern authentication technologies such as passkeys and multi-factor authentication

---

## 1. Authentication and Authorization

```
Authentication:
  → "Who are you?"
  → Verifying the user's identity
  → Login process

Authorization:
  → "What can you do?"
  → Checking access permissions
  → Role-Based Access Control (RBAC)

  Example:
  Authentication: Log in and confirm the identity is "Taro"
  Authorization:  "Taro" is an admin, so full data access is permitted

Relationship between Authentication and Authorization:
  ┌─────────────────────────────────────────┐
  │  Request                                 │
  │    │                                     │
  │    ▼                                     │
  │  Authentication                          │
  │    → Identify the user                   │
  │    → Failure → 401 Unauthorized         │
  │    │                                     │
  │    ▼                                     │
  │  Authorization                           │
  │    → Check permissions                   │
  │    → Failure → 403 Forbidden            │
  │    │                                     │
  │    ▼                                     │
  │  Resource Access                         │
  └─────────────────────────────────────────┘

Authentication Factors:
  ① Knowledge factor (Something you know): password, PIN
  ② Possession factor (Something you have): smartphone, security key
  ③ Inherence factor (Something you are): fingerprint, face recognition

  Multi-Factor Authentication (MFA) = combination of 2 or more factors
  Two-Factor Authentication (2FA)   = combination of exactly 2 factors
```

### 1.1 Authorization Models

```
Major authorization models:

① RBAC (Role-Based Access Control):
  → Assign permissions to roles
  → Assign roles to users

  Role definitions:
  admin:  read, write, delete, manage_users
  editor: read, write
  viewer: read

  User → Role → Permission:
  Taro   → admin  → all operations allowed
  Hanako → editor → read and write allowed
  Jiro   → viewer → read only

② ABAC (Attribute-Based Access Control):
  → Decisions based on attributes (user, resource, environment)
  → More flexible but more complex

  Example: "Allow reading customer data only when the user belongs to the
            sales department, is within working hours, and is on the
            internal network"

③ ReBAC (Relationship-Based Access Control):
  → Permissions based on relationships between entities
  → Google Zanzibar / OpenFGA

  Example: "Viewable only by the document owner or users it has been shared with"
  → user:taro   → owner  → document:123
  → user:hanako → viewer → document:123

④ ACL (Access Control List):
  → Per-resource access permission lists
  → Simple but does not scale well

Practical selection guide:
  Small-scale app   → RBAC (simple and sufficient)
  Complex permission requirements → ABAC
  Social/collaboration → ReBAC
  File system       → ACL
```

---

## 2. Basic Authentication

```
Basic Authentication:
  → Encodes username:password in Base64
  → Sent with every request

  Authorization: Basic dGFybzpwYXNzd29yZA==
                       ↑ Base64 of "taro:password"

  Request/Response flow:
  1. Client → Server: Request without authentication
  2. Server → Client: 401 + WWW-Authenticate: Basic realm="API"
  3. Client → Server: Authorization: Basic <credentials>
  4. Server → Client: 200 OK

  Advantages:
  ✓ Extremely simple to implement
  ✓ No server-side state management required
  ✓ HTTP standard spec (RFC 7617)

  Disadvantages:
  ✗ Password is sent every request (Base64 is not encryption)
  ✗ HTTPS required (transmitted in plaintext)
  ✗ No logout functionality
  ✗ Vulnerable to brute-force attacks
  ✗ Difficult to handle password changes

  Use cases:
  → Internal tools, CI/CD API authentication
  → Not recommended for production APIs
  → Docker Registry authentication (internal use)
  → Development environment access restriction
```

```python
# Basic authentication implementation example (Python/FastAPI)
from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBasic, HTTPBasicCredentials
import secrets

app = FastAPI()
security = HTTPBasic()

# Secure comparison (timing attack countermeasure)
def verify_credentials(credentials: HTTPBasicCredentials = Depends(security)):
    correct_username = secrets.compare_digest(
        credentials.username.encode("utf8"),
        b"admin"
    )
    correct_password = secrets.compare_digest(
        credentials.password.encode("utf8"),
        b"secret"
    )
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

@app.get("/api/data")
def read_data(username: str = Depends(verify_credentials)):
    return {"message": f"Hello, {username}"}
```

---

## 3. Bearer Token / API Key

```
Bearer Token:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

  → Include a server-issued token in the header
  → Token format is flexible (JWT, random string, etc.)
  → Specified in RFC 6750

API Key:
  X-API-Key: sk_live_abcdef123456
  or
  ?api_key=sk_live_abcdef123456

  → Commonly used for service-to-service integration
  → Authentication for applications, not individual users
  → Prefix distinguishes the key type:
     sk_live_  → Production secret key
     sk_test_  → Test secret key
     pk_live_  → Production public key

  API Key best practices:
  ✓ Send via header (not in URL)
  ✓ Manage via environment variables (do not hardcode in code)
  ✓ Design for key rotation
  ✓ Restrict scopes/permissions
  ✓ Apply rate limiting
  ✓ Record audit logs
```

### 3.1 Session-Based vs Token-Based

```
Session-Based vs Token-Based:
  ┌──────────────┬──────────────────┬──────────────────┐
  │              │ Session          │ Token            │
  ├──────────────┼──────────────────┼──────────────────┤
  │ State        │ Server-side      │ Client-side      │
  │ Scalability  │ Low (sharing req)│ High (stateless) │
  │ Revocation   │ Easy             │ Difficult        │
  │ Storage      │ Server memory/DB │ Client           │
  │ CSRF         │ Vulnerable       │ Safe             │
  │ XSS          │ HttpOnly Cookie  │ Requires care    │
  │ Mobile       │ Complex Cookie   │ Easy             │
  │ Microservices│ Session sharing  │ Verifiable per   │
  │              │ issues           │ service          │
  └──────────────┴──────────────────┴──────────────────┘

Session-based authentication flow:
  1. POST /login { username, password }
  2. Server: Create session → Store in Redis/DB, etc.
  3. Set-Cookie: session_id=abc123; HttpOnly; Secure; SameSite=Lax
  4. Client: Cookie is automatically sent with subsequent requests
  5. Server: Restore session from Cookie, identify user

Token-based authentication flow:
  1. POST /login { username, password }
  2. Server: Generate JWT → Return in response body
  3. Client: Store token in memory/local storage
  4. Client: Add Authorization: Bearer <token>
  5. Server: Verify token signature, identify user

Hybrid approach (recommended):
  → Store JWT in HttpOnly Cookie
  → CSRF countermeasure: SameSite=Strict + CSRF token
  → XSS countermeasure: HttpOnly (not accessible from JS)
  → Session management: Manage Refresh Token in DB (revocable)
```

---

## 4. JWT (JSON Web Token)

```
JWT structure:
  eyJhbGciOiJIUzI1NiIs.eyJzdWIiOiIxMjM0NTY3.SflKxwRJSMeKKF2QT4
  ↑ Header                ↑ Payload              ↑ Signature

  Header (Base64URL):
  {
    "alg": "RS256",     // Signing algorithm
    "typ": "JWT",
    "kid": "key-2024-01" // Key ID (for key rotation)
  }

  Payload (Base64URL):
  {
    "sub": "user_123",        // Subject (user ID)
    "name": "Taro",
    "role": "admin",
    "iat": 1704067200,        // Issued At
    "exp": 1704070800,        // Expiration
    "nbf": 1704067200,        // Not Before
    "iss": "api.example.com", // Issuer
    "aud": "web.example.com", // Audience
    "jti": "unique-id-123"   // JWT ID (unique identifier)
  }

  Signature:
  HMACSHA256(
    base64UrlEncode(header) + "." + base64UrlEncode(payload),
    secret
  )

  Important: The payload is NOT encrypted (readable by Base64 decoding)
  → Do not include sensitive information (passwords, etc.)
  → The signature is for tamper detection (not encryption)
```

### 4.1 JWT Signing Algorithms

```
Signing algorithm selection:

① HS256 (HMAC-SHA256):
  → Sign and verify with shared key (symmetric key)
  → Signer and verifier share the same secret
  → Simple but key distribution is a challenge
  → Suited for single-service use

② RS256 (RSA-SHA256):
  → Sign with private key, verify with public key
  → Signer and verifier use different keys
  → Suited for microservices (auth server signs, each service verifies)
  → Large key size required (2048 bits or more)

③ ES256 (ECDSA-SHA256):
  → Elliptic curve cryptography (P-256)
  → Equivalent security to RSA with smaller key size
  → Smaller signature size
  → Recommended

④ EdDSA (Ed25519):
  → Latest elliptic curve signature
  → Fast and secure
  → Library support still limited in some environments

Comparison:
  ┌──────────┬────────────┬────────────┬──────────┐
  │ Algorithm│ Key type   │ Sig size   │Recommended│
  ├──────────┼────────────┼────────────┼──────────┤
  │ HS256    │ Shared     │ 32 bytes   │ Single service│
  │ RS256    │ Public/Private│ 256 bytes│ Wide support│
  │ ES256    │ Public/Private│ 64 bytes │ Recommended│
  │ EdDSA    │ Public/Private│ 64 bytes │ Latest rec.│
  └──────────┴────────────┴────────────┴──────────┘
```

### 4.2 Access Token and Refresh Token

```
Token types:
  Access Token:
    → Short expiry (15 minutes to 1 hour)
    → Used for API access
    → Stateless verification (signature verification only)
    → Minimize impact in case of leakage

  Refresh Token:
    → Long expiry (7 to 30 days)
    → Used to reissue Access Tokens
    → Managed server-side (revocable)
    → Rotation recommended

Flow:
  1. Login → Obtain Access Token + Refresh Token
  2. API call → Include Access Token in header
  3. Access Token expires → 401 Unauthorized
  4. Use Refresh Token to obtain new Access Token
  5. Refresh Token expires → Re-login required

Refresh Token Rotation:
  → Issue a new Refresh Token each time one is used
  → Invalidate the old Refresh Token
  → Leak detection: If an invalidated token is used → invalidate all tokens

  1. POST /token/refresh { refresh_token: "rt_old" }
  2. Response: { access_token: "at_new", refresh_token: "rt_new" }
  3. rt_old is invalidated (deleted from DB/Redis)
  4. If rt_old is used again → detect fraud → invalidate all tokens
```

```typescript
// JWT implementation example (TypeScript / jose library)
import { SignJWT, jwtVerify, generateKeyPair } from 'jose';

// Generate key pair (ES256)
const { publicKey, privateKey } = await generateKeyPair('ES256');

// Generate Access Token
async function createAccessToken(userId: string, role: string): Promise<string> {
  return new SignJWT({
    sub: userId,
    role: role,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .setIssuer('api.example.com')
    .setAudience('web.example.com')
    .setJti(crypto.randomUUID())
    .sign(privateKey);
}

// Generate Refresh Token
async function createRefreshToken(userId: string): Promise<string> {
  const token = new SignJWT({
    sub: userId,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .setIssuer('api.example.com')
    .setJti(crypto.randomUUID())
    .sign(privateKey);

  // Store Refresh Token in DB (for revocation)
  // await db.refreshTokens.create({ token, userId, expiresAt: ... });
  return token;
}

// Verify token
async function verifyToken(token: string): Promise<any> {
  try {
    const { payload } = await jwtVerify(token, publicKey, {
      issuer: 'api.example.com',
      audience: 'web.example.com',
    });
    return payload;
  } catch (error) {
    if (error.code === 'ERR_JWT_EXPIRED') {
      throw new Error('Token expired');
    }
    throw new Error('Invalid token');
  }
}

// Token refresh
async function refreshTokens(refreshToken: string) {
  const payload = await verifyToken(refreshToken);

  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type');
  }

  // Verify Refresh Token validity in DB
  // const stored = await db.refreshTokens.findByToken(refreshToken);
  // if (!stored) throw new Error('Token revoked');

  // Invalidate old Refresh Token
  // await db.refreshTokens.delete(refreshToken);

  // Issue new token pair
  const accessToken = await createAccessToken(payload.sub, payload.role);
  const newRefreshToken = await createRefreshToken(payload.sub);

  return { accessToken, refreshToken: newRefreshToken };
}
```

### 4.3 JWT Security Considerations

```
JWT security notes:

① alg: "none" attack:
  → Change the algorithm to "none" and send an unsigned JWT
  → Countermeasure: Explicitly specify the allowed algorithms server-side

② Algorithm confusion attack:
  → Use the RS256 public key as the HS256 secret
  → Countermeasure: Do not trust the alg header in the token

③ Storing sensitive information in payload:
  → Anyone can read it via Base64 decoding
  → Countermeasure: Do not include passwords or personal information

④ Expiry configuration:
  → Excessively long expiry is a risk
  → Access Token: 15 minutes to 1 hour
  → Refresh Token: 7 to 30 days

⑤ Token storage location:
  ┌─────────────────┬────────────┬────────────┬────────────┐
  │ Storage         │ XSS resist │ CSRF resist│ Recommended│
  ├─────────────────┼────────────┼────────────┼────────────┤
  │ LocalStorage    │ ✗ Weak     │ ✓ Safe     │ △ Not rec. │
  │ SessionStorage  │ ✗ Weak     │ ✓ Safe     │ △ Not rec. │
  │ HttpOnly Cookie │ ✓ Safe     │ ✗ Required │ ○ Rec.    │
  │ Memory          │ ✓ Safe     │ ✓ Safe     │ ○ Rec.    │
  └─────────────────┴────────────┴────────────┴────────────┘

  Recommended pattern:
  → Access Token: Hold in memory (variable)
  → Refresh Token: HttpOnly Cookie
  → CSRF countermeasure: SameSite=Strict + CSRF token

⑥ Token revocation (blacklist):
  → JWT is stateless so it cannot inherently be revoked
  → Countermeasure: Short expiry + Refresh Token management
  → Or: Maintain a blacklist in Redis, etc.

⑦ JWE (JSON Web Encryption):
  → When you need to encrypt the payload
  → JWS (signature) + JWE (encryption) = full protection
  → However, adds complexity — consider whether it is truly necessary
```

---

## 5. OAuth 2.0

```
OAuth 2.0 = Authorization framework (not authentication)
  → Delegate resource access permissions to third-party apps

Parties involved:
  Resource Owner:       User
  Client:               App (the party requesting access)
  Authorization Server: Authorization server (Google, GitHub, etc.)
  Resource Server:      Resource server (API)
```

### 5.1 Authorization Code Flow (Recommended)

```
Authorization Code Flow:

  User       App          Auth Server     Resource Server
    │           │              │                │
    │──Login───►│              │                │
    │           │──Auth req───►│                │
    │◄────── Login screen ─────│                │
    │── Consent ──►│           │                │
    │           │◄── Auth code─│                │
    │           │── Code + Secret ─────────────►│
    │           │◄── Access Token ──────────────│
    │           │── API call + Token ───────────►│
    │           │◄── Resource data ─────────────│

Detailed request/response:

Step 1: Authorization request (browser redirect)
  GET https://auth.example.com/authorize
    ?response_type=code
    &client_id=my-app-id
    &redirect_uri=https://myapp.com/callback
    &scope=openid profile email
    &state=random-csrf-token   ← CSRF countermeasure
    &nonce=random-nonce         ← Replay attack countermeasure

Step 2: Receive authorization code (callback)
  GET https://myapp.com/callback
    ?code=AUTH_CODE_HERE
    &state=random-csrf-token

  → Verify that the state parameter matches (CSRF countermeasure)

Step 3: Obtain token (server-to-server communication)
  POST https://auth.example.com/token
  Content-Type: application/x-www-form-urlencoded

  grant_type=authorization_code
  &code=AUTH_CODE_HERE
  &redirect_uri=https://myapp.com/callback
  &client_id=my-app-id
  &client_secret=my-app-secret

  Response:
  {
    "access_token": "eyJ...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2g...",
    "scope": "openid profile email",
    "id_token": "eyJ..."  ← When OIDC is used
  }
```

### 5.2 Authorization Code + PKCE

```
PKCE (Proof Key for Code Exchange):
  → Extension for SPAs and mobile apps
  → No client secret required
  → Prevents authorization code interception attacks

  Flow:
  1. Client generates code_verifier (random string)
  2. code_challenge = Base64URL(SHA256(code_verifier))
  3. Include code_challenge in authorization request
  4. Include code_verifier in token request
  5. Server computes SHA256(code_verifier) and compares with code_challenge

  Step 1: Authorization request
  GET https://auth.example.com/authorize
    ?response_type=code
    &client_id=my-spa-id
    &redirect_uri=https://myapp.com/callback
    &scope=openid profile
    &state=random-state
    &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
    &code_challenge_method=S256

  Step 3: Token request (no client_secret needed)
  POST https://auth.example.com/token

  grant_type=authorization_code
  &code=AUTH_CODE
  &redirect_uri=https://myapp.com/callback
  &client_id=my-spa-id
  &code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

```typescript
// PKCE implementation example (TypeScript)
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Usage example
async function startOAuthFlow() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Store code_verifier in session
  sessionStorage.setItem('code_verifier', codeVerifier);

  // Authorization request
  const authUrl = new URL('https://auth.example.com/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', 'my-spa-id');
  authUrl.searchParams.set('redirect_uri', 'https://myapp.com/callback');
  authUrl.searchParams.set('scope', 'openid profile email');
  authUrl.searchParams.set('state', crypto.randomUUID());
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  window.location.href = authUrl.toString();
}

// Callback handling
async function handleCallback(code: string) {
  const codeVerifier = sessionStorage.getItem('code_verifier');

  const response = await fetch('https://auth.example.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'https://myapp.com/callback',
      client_id: 'my-spa-id',
      code_verifier: codeVerifier!,
    }),
  });

  const tokens = await response.json();
  return tokens;
}
```

### 5.3 Other Grant Types

```
Major grant types:
  ┌─────────────────────┬──────────────────────────────┐
  │ Grant type          │ Use case                      │
  ├─────────────────────┼──────────────────────────────┤
  │ Authorization Code  │ Server-side apps (recommended)│
  │ Auth Code + PKCE    │ SPA/Mobile (recommended)      │
  │ Client Credentials  │ Machine-to-machine (server)   │
  │ Device Code         │ TV/IoT with limited input      │
  └─────────────────────┴──────────────────────────────┘

  Deprecated grants:
  ✗ Implicit: Deprecated due to security issues
    → Access Token exposed in fragment
    → Cannot use Refresh Token
  ✗ Resource Owner Password: Deprecated
    → Passes user password directly to the app

Client Credentials Flow:
  → Machine-to-machine communication (batch processing, microservices)
  → No user involvement

  POST https://auth.example.com/token
  Content-Type: application/x-www-form-urlencoded
  Authorization: Basic <Base64 of client_id:client_secret>

  grant_type=client_credentials
  &scope=api:read api:write

  Response:
  {
    "access_token": "eyJ...",
    "token_type": "Bearer",
    "expires_in": 3600
  }
  → No Refresh Token is issued

Device Authorization Flow:
  → TVs, game consoles, CLI tools, etc.
  → User authenticates on a separate device

  1. Device → Auth server: POST /device/code
  2. Response:
     {
       "device_code": "...",
       "user_code": "ABCD-EFGH",
       "verification_uri": "https://auth.example.com/device",
       "expires_in": 900,
       "interval": 5
     }
  3. Device screen: "Go to https://auth.example.com/device and enter ABCD-EFGH"
  4. User: Access URL on smartphone → Enter code → Login → Approve
  5. Device: Poll for token every 5 seconds
     POST /token { grant_type: "urn:ietf:params:oauth:grant-type:device_code", device_code: "..." }
  6. After approval: Receive Access Token
```

---

## 6. OpenID Connect (OIDC)

```
OIDC = OAuth 2.0 + Authentication layer
  → OAuth 2.0 provides only authorization; OIDC also provides authentication

  OAuth 2.0: "Allow this app to access Google Drive"
  OIDC:      "Log in to this app with your Google account"

  Access Token: Permission to access resources
  ID Token:     User authentication information (JWT format)
```

### 6.1 ID Token

```
ID Token contents:
  {
    "iss": "https://accounts.google.com",       // Issuer
    "sub": "110169484474386276334",              // User's unique ID
    "aud": "my-app-client-id",                   // Target app
    "email": "user@gmail.com",
    "email_verified": true,
    "name": "Taro Yamada",
    "picture": "https://lh3.googleusercontent.com/...",
    "given_name": "Taro",
    "family_name": "Yamada",
    "locale": "ja",
    "iat": 1704067200,                           // Issued at
    "exp": 1704070800,                           // Expiry
    "nonce": "random-nonce",                     // Replay attack countermeasure
    "at_hash": "HK6E_P6Dh8Y93mRNtsDB1Q"         // Hash of Access Token
  }

ID Token validation:
  1. Verify signature (validate with public key/JWKS)
  2. Verify iss (issuer)
  3. Verify aud (target app)
  4. Verify exp (expiry)
  5. Verify nonce matches
  6. Verify at_hash (optional)

UserInfo endpoint:
  → Retrieve additional information when ID Token is insufficient
  GET https://accounts.google.com/userinfo
  Authorization: Bearer <access_token>

  Response:
  {
    "sub": "110169484474386276334",
    "name": "Taro Yamada",
    "email": "user@gmail.com",
    "picture": "https://..."
  }
```

### 6.2 OIDC Discovery

```
OpenID Connect Discovery:
  → Automatically retrieve configuration information from the authorization server
  → /.well-known/openid-configuration

  GET https://accounts.google.com/.well-known/openid-configuration

  Response:
  {
    "issuer": "https://accounts.google.com",
    "authorization_endpoint": "https://accounts.google.com/o/oauth2/v2/auth",
    "token_endpoint": "https://oauth2.googleapis.com/token",
    "userinfo_endpoint": "https://openidconnect.googleapis.com/v1/userinfo",
    "revocation_endpoint": "https://oauth2.googleapis.com/revoke",
    "jwks_uri": "https://www.googleapis.com/oauth2/v3/certs",
    "supported_scopes": ["openid", "email", "profile"],
    "response_types_supported": ["code", "token", "id_token"],
    "subject_types_supported": ["public"],
    "id_token_signing_alg_values_supported": ["RS256"],
    "token_endpoint_auth_methods_supported": ["client_secret_post", "client_secret_basic"]
  }

JWKS (JSON Web Key Set):
  → Endpoint for distributing public keys
  GET https://www.googleapis.com/oauth2/v3/certs

  {
    "keys": [
      {
        "kty": "RSA",
        "kid": "key-id-1",
        "use": "sig",
        "alg": "RS256",
        "n": "...",  // modulus
        "e": "AQAB"  // exponent
      }
    ]
  }

  → Match against the kid header in the ID Token to select the correct public key
  → Cache public keys and refresh periodically

Major OIDC providers:
  Google, Microsoft, Apple, Auth0, Okta, Keycloak, AWS Cognito
```

---

## 7. Passkeys / WebAuthn / FIDO2

```
Passkeys = Passwordless authentication
  → Based on public-key cryptography
  → Phishing resistant
  → FIDO2 / WebAuthn standard

How it works:
  Registration:
  1. Server → Send challenge
  2. Device → Generate key pair (public key + private key)
  3. Private key is securely stored on the device (Secure Enclave / TPM)
  4. Send public key to server
  5. User approves with biometrics (fingerprint/face) or PIN

  Authentication:
  1. Server → Send challenge
  2. Device → Sign challenge with private key
  3. User approves with biometrics
  4. Send signature to server
  5. Server → Verify signature with public key

  Security advantages:
  ✓ No password required (no leakage risk)
  ✓ Phishing resistant (bound to origin)
  ✓ Replay attack resistant (challenge-based)
  ✓ Private key is never stored on the server

Passkey sync:
  → Synced via iCloud Keychain / Google Password Manager
  → Share passkeys across devices
  → Backup and restore possible

  Traditional FIDO2:
  → Device-bound (device loss = no access)
  Passkeys:
  → Cloud-synced (improved convenience, slightly lower security)
```

```javascript
// WebAuthn Registration frontend implementation
async function registerPasskey() {
  // Get challenge from server
  const options = await fetch('/api/webauthn/register/options', {
    method: 'POST',
  }).then(r => r.json());

  // Call browser's WebAuthn API
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: base64ToBuffer(options.challenge),
      rp: {
        name: 'My App',
        id: 'myapp.com',
      },
      user: {
        id: base64ToBuffer(options.userId),
        name: options.userName,
        displayName: options.userDisplayName,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256
        { alg: -257, type: 'public-key' },  // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Platform authenticator
        residentKey: 'required',             // Passkey required
        userVerification: 'required',        // Biometrics required
      },
      timeout: 60000,
    },
  });

  // Send public key to server
  await fetch('/api/webauthn/register/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: credential.id,
      rawId: bufferToBase64(credential.rawId),
      response: {
        attestationObject: bufferToBase64(
          credential.response.attestationObject
        ),
        clientDataJSON: bufferToBase64(
          credential.response.clientDataJSON
        ),
      },
      type: credential.type,
    }),
  });
}

// WebAuthn Authentication frontend implementation
async function authenticatePasskey() {
  const options = await fetch('/api/webauthn/authenticate/options', {
    method: 'POST',
  }).then(r => r.json());

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: base64ToBuffer(options.challenge),
      rpId: 'myapp.com',
      allowCredentials: [], // Empty array = select from passkey list
      userVerification: 'required',
      timeout: 60000,
    },
  });

  const result = await fetch('/api/webauthn/authenticate/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: assertion.id,
      rawId: bufferToBase64(assertion.rawId),
      response: {
        authenticatorData: bufferToBase64(
          assertion.response.authenticatorData
        ),
        clientDataJSON: bufferToBase64(
          assertion.response.clientDataJSON
        ),
        signature: bufferToBase64(assertion.response.signature),
      },
      type: assertion.type,
    }),
  }).then(r => r.json());

  return result; // { token: "...", user: { ... } }
}
```

---

## 8. Multi-Factor Authentication (MFA)

```
MFA implementation patterns:

① TOTP (Time-based One-Time Password):
  → Google Authenticator, Authy, etc.
  → RFC 6238
  → 6-digit code that changes every 30 seconds
  → Generated via HMAC from a secret key and timestamp

  Setup:
  1. Server generates a secret key
  2. Register to user's app via QR code
  3. User enters the 6-digit code from the app to confirm

  Verification:
  → Accept current 30-second window ± 1 window
  → Prevent reuse of the same code (replay attack countermeasure)

② SMS OTP:
  → Send a 6-digit code via SMS
  → Easy to implement but lower security
  → Risk of SIM swapping attacks
  → SS7 protocol vulnerabilities
  → Classified as "restricted" in NIST SP 800-63B

③ Security Key (FIDO U2F / FIDO2):
  → Hardware tokens such as YubiKey
  → Most secure 2FA
  → Phishing resistant
  → Increasing adoption in enterprises

④ Push notification:
  → Send approval request to smartphone app
  → "Approve this login?"
  → Beware of MFA fatigue attacks
    → Countermeasure: Number matching (select the number shown on screen)

Recovery codes:
  → Fallback when MFA device is lost
  → 8–10 one-time codes
  → Store in a safe place (password manager, etc.)
  → Store as hashed values in DB
```

```python
# TOTP implementation example (Python / pyotp)
import pyotp
import qrcode
import io

class TOTPManager:
    def generate_secret(self) -> str:
        """Generate a new TOTP secret"""
        return pyotp.random_base32()

    def get_provisioning_uri(
        self, secret: str, email: str, issuer: str = "MyApp"
    ) -> str:
        """Generate URI for QR code"""
        totp = pyotp.TOTP(secret)
        return totp.provisioning_uri(name=email, issuer_name=issuer)

    def generate_qr_code(self, uri: str) -> bytes:
        """Generate QR code image"""
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(uri)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        return buffer.getvalue()

    def verify_code(self, secret: str, code: str, window: int = 1) -> bool:
        """Verify TOTP code (allow 1 window before and after)"""
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=window)

    def generate_recovery_codes(self, count: int = 10) -> list[str]:
        """Generate recovery codes"""
        import secrets
        codes = []
        for _ in range(count):
            code = secrets.token_hex(4)  # 8-character hexadecimal
            codes.append(f"{code[:4]}-{code[4:]}")
        return codes

# Usage example
totp = TOTPManager()

# Setup
secret = totp.generate_secret()  # "JBSWY3DPEHPK3PXP"
uri = totp.get_provisioning_uri(secret, "user@example.com")
qr_image = totp.generate_qr_code(uri)
recovery_codes = totp.generate_recovery_codes()

# Verification
is_valid = totp.verify_code(secret, "123456")
```

---

## 9. Session Management Best Practices

```
Session management security:

① Session ID generation:
  → Use a cryptographically secure random number generator
  → Sufficient length (128 bits or more)
  → Unpredictable

② Cookie attributes:
  Set-Cookie: session_id=abc123;
    HttpOnly;         ← Not accessible from JavaScript
    Secure;           ← Sent only over HTTPS
    SameSite=Lax;     ← Restrict cross-site requests
    Path=/;           ← Appropriate path restriction
    Max-Age=86400;    ← Expiry (1 day)
    Domain=.example.com;

③ Countermeasure for session fixation attacks:
  → Regenerate session ID upon successful login
  → Invalidate old session ID

④ Session invalidation:
  → Delete session server-side on logout
  → Invalidate all sessions on password change
  → Forced logout by administrator

⑤ Session timeout:
  → Idle timeout: 30 minutes to 1 hour
  → Absolute timeout: 8 to 24 hours
  → Re-authentication for critical operations

⑥ Concurrent session control:
  → Limit the number of simultaneous logins
  → Invalidate old sessions on new login
  → Display active session list

⑦ Session storage:
  → Redis: Fast, TTL support, clustering
  → PostgreSQL: Persistence, leverage existing infrastructure
  → Memory: Development only (not scalable)
```

---

## 10. Authentication Architecture Patterns

```
① BFF (Backend For Frontend) pattern:
  → Place a backend dedicated to the frontend
  → Token management is done in the BFF

  Browser → BFF → API Server
            ↕
        Auth Server

  Browser-BFF: HttpOnly Cookie (session)
  BFF-API: Access Token (Bearer)

  Advantages:
  → Token is not exposed to the browser
  → Token cannot be stolen via XSS attack
  → Secure management of Refresh Token

② API Gateway pattern:
  → Centralize authentication in the Gateway

  Client → API Gateway → Microservices
               ↕
          Auth Server

  Gateway: Token verification, rate limiting
  Microservices: Receive only authenticated requests

③ Token Exchange (RFC 8693):
  → Convert tokens between microservices
  → Exchange Service A's token for a token scoped for Service B
  → Apply principle of least privilege

④ Sidecar / Service Mesh pattern:
  → mTLS + JWT verification with Istio/Envoy, etc.
  → Separate authentication logic from application code

  Inside Pod:
  ┌──────────────────────┐
  │ Envoy Sidecar        │ ← mTLS termination, JWT verification
  │   ↕                  │
  │ Application          │ ← No authentication logic needed
  └──────────────────────┘
```

---

## 11. Password Security

```
Password hashing:

Recommended algorithms (as of 2024):
  1. Argon2id (recommended): Memory-hard and most secure
  2. bcrypt: Widely used and secure
  3. scrypt: Memory-hard
  ✗ MD5, SHA-1, SHA-256 alone are not acceptable
  ✗ Without salt is not acceptable

Argon2id parameters:
  memory: 64MB (minimum 19MiB recommended)
  iterations: 3
  parallelism: 4
  hash_length: 32 bytes

bcrypt:
  cost factor: 12 or higher (as of 2024)
  → cost 12 ≈ 250ms (slows down attacker's brute force)

Salt:
  → Add a random salt per user
  → Prevents rainbow table attacks
  → bcrypt/Argon2 include salt automatically

Pepper:
  → Server-side secret value added on top of salt
  → Even if the DB leaks, it is hard to crack without the pepper
  → Managed via environment variables or HSM

Password policy:
  Recommended:
  ✓ Minimum 8 characters (NIST recommends 8–64 characters)
  ✓ Check against leaked password lists (Have I Been Pwned API)
  ✓ Encourage passphrases

  Not recommended (NIST SP 800-63B):
  ✗ Forcing complexity (mandatory uppercase/numbers/symbols)
  ✗ Forcing periodic password changes
  ✗ Using password hints
```

```python
# Password hash implementation example (Python / argon2-cffi)
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

ph = PasswordHasher(
    time_cost=3,          # iterations
    memory_cost=65536,    # 64MB
    parallelism=4,
    hash_len=32,
    salt_len=16,
)

# Generate password hash
def hash_password(password: str) -> str:
    return ph.hash(password)

# Verify password
def verify_password(hash: str, password: str) -> bool:
    try:
        return ph.verify(hash, password)
    except VerifyMismatchError:
        return False

# Check if rehash is needed (parameter update)
def needs_rehash(hash: str) -> bool:
    return ph.check_needs_rehash(hash)

# Usage example
hashed = hash_password("my-secure-password")
# $argon2id$v=19$m=65536,t=3,p=4$...

is_valid = verify_password(hashed, "my-secure-password")  # True
is_valid = verify_password(hashed, "wrong-password")       # False

# Rehash if parameters are outdated
if needs_rehash(hashed):
    new_hash = hash_password("my-secure-password")
    # Update DB
```

---

## 12. Token Security in Practice

### 12.1 Deep Dive into JWT Security

```
Attacks and defenses related to JWT:

① Algorithm Confusion attack:
  → Tamper with the alg header to bypass verification

  Attack example:
  Original JWT:
    Header: {"alg": "RS256", "typ": "JWT"}
    → Verified with RSA public key

  Tampered JWT:
    Header: {"alg": "HS256", "typ": "JWT"}
    → Signed using RSA public key as HMAC secret
    → Server verifies using public key with HMAC → succeeds unexpectedly

  Defense:
  // Explicitly specify the algorithm for verification (required)
  const jwt = require('jsonwebtoken');
  const decoded = jwt.verify(token, publicKey, {
    algorithms: ['RS256'],    // ← Explicitly specify allowed algorithms
    issuer: 'https://auth.example.com',
    audience: 'my-api'
  });

  // BAD: Verification without specifying algorithm
  const decoded = jwt.verify(token, key); // ← Dangerous

② JWT revocation (logout problem):
  → JWT is stateless, so it cannot be invalidated after issuance
  → Token remains valid even after logout

  Solutions:
  ┌────────────────────────────────────────────┐
  │ Method         │ Characteristics             │
  ├───────────────┼──────────────────────────────┤
  │ Short expiry   │ 5-15 min, refresh with RT   │
  │ Blacklist      │ Store invalidated tokens in Redis, etc. │
  │ Token Version  │ Store version per user, invalidate all  │
  │                │ tokens when version changes             │
  │ Token Binding  │ Bind to device               │
  └────────────────────────────────────────────┘
```

```javascript
// Token Blacklist implementation example (using Redis)
const Redis = require('ioredis');
const redis = new Redis();

// On logout: add token to blacklist
async function logout(req, res) {
  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.decode(token);

  // Set TTL as the remaining validity period of the token
  const ttl = decoded.exp - Math.floor(Date.now() / 1000);
  if (ttl > 0) {
    await redis.setex(`blacklist:${token}`, ttl, '1');
  }

  res.json({ message: 'Logged out successfully' });
}

// Authentication middleware: blacklist check
async function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }

  // Blacklist check
  const isBlacklisted = await redis.get(`blacklist:${token}`);
  if (isBlacklisted) {
    return res.status(401).json({ error: 'Token has been revoked' });
  }

  try {
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: 'https://auth.example.com'
    });
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

### 12.2 Refresh Token Rotation

```
Refresh Token Rotation:
  → Issue a new Refresh Token each time one is used
  → Immediately invalidate the old Refresh Token
  → Detect use of a stolen Refresh Token

  Flow:
  1. Client → Access Token (5 min) + Refresh Token A
  2. Access Token expires
  3. Client → Refresh with Refresh Token A
  4. Server → New Access Token + New Refresh Token B
     → Refresh Token A is invalidated
  5. If attacker uses Refresh Token A:
     → Server detects reuse of invalidated token
     → Invalidate entire Token Family
     → Legitimate user must also re-login (fail-safe)
```

```javascript
// Refresh Token Rotation implementation
async function refreshToken(req, res) {
  const { refresh_token } = req.body;

  // Verify Refresh Token
  const tokenRecord = await db.refreshTokens.findOne({
    token: hashToken(refresh_token),
    revoked: false
  });

  if (!tokenRecord) {
    // Token not found → possible theft
    // Invalidate entire Token Family
    const familyId = await findTokenFamily(refresh_token);
    if (familyId) {
      await db.refreshTokens.updateMany(
        { family: familyId },
        { revoked: true, revokedReason: 'reuse_detected' }
      );
      logger.security('Refresh token reuse detected', {
        family: familyId,
        ip: req.ip
      });
    }
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  // Check expiry
  if (tokenRecord.expiresAt < new Date()) {
    return res.status(401).json({ error: 'Refresh token expired' });
  }

  // Invalidate old token
  await db.refreshTokens.updateOne(
    { _id: tokenRecord._id },
    { revoked: true, revokedReason: 'rotation' }
  );

  // Generate new token pair
  const newAccessToken = generateAccessToken(tokenRecord.userId);
  const newRefreshToken = generateRefreshToken();

  // Store new Refresh Token (same Family)
  await db.refreshTokens.insertOne({
    token: hashToken(newRefreshToken),
    userId: tokenRecord.userId,
    family: tokenRecord.family,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revoked: false
  });

  res.json({
    access_token: newAccessToken,
    refresh_token: newRefreshToken,
    expires_in: 300
  });
}
```

---

## 13. Authentication Monitoring and Anomaly Detection

```
Authentication event monitoring:

① Events to monitor:
  → Login success/failure (by user, IP, region)
  → Password reset requests
  → MFA enrollment/change/disablement
  → Token refresh/revocation
  → Permission changes
  → Access from new devices

② Anomaly detection patterns:
  ┌──────────────────────────────────────────────┐
  │ Pattern              │ Detection condition     │
  ├───────────────────────┼───────────────────────┤
  │ Brute force          │ 5+ login failures/min   │
  │                      │ from the same IP        │
  ├───────────────────────┼───────────────────────┤
  │ Credential           │ Bulk login attempts     │
  │ stuffing             │ with different user IDs │
  ├───────────────────────┼───────────────────────┤
  │ Account takeover     │ Email change immediately│
  │                      │ after password change   │
  ├───────────────────────┼───────────────────────┤
  │ Impossible Travel    │ Access from different   │
  │                      │ regions in short time   │
  ├───────────────────────┼───────────────────────┤
  │ Session fixation     │ Same session ID before  │
  │                      │ and after authentication│
  └──────────────────────────────────────────────┘

③ Response actions:
  → Auto-block: IP-based rate limiting
  → CAPTCHA: Display challenge when threshold exceeded
  → Account lockout: Temporary lock on repeated failures
  → Notification: Alert admin/user of anomalies
  → Forced re-authentication: Require MFA for suspicious access
```

```javascript
// Authentication event logging and anomaly detection
class AuthMonitor {
  constructor(redis, logger) {
    this.redis = redis;
    this.logger = logger;
  }

  async recordLoginAttempt(userId, ip, success, metadata = {}) {
    const event = {
      userId,
      ip,
      success,
      timestamp: new Date().toISOString(),
      userAgent: metadata.userAgent,
      geoLocation: metadata.geoLocation,
      deviceId: metadata.deviceId
    };

    // Log the event
    this.logger.info('auth_event', event);

    if (!success) {
      // Update failure counts
      const ipKey = `auth:fail:ip:${ip}`;
      const userKey = `auth:fail:user:${userId}`;

      const [ipCount, userCount] = await Promise.all([
        this.redis.incr(ipKey),
        this.redis.incr(userKey)
      ]);

      // Set TTL (first time only)
      if (ipCount === 1) await this.redis.expire(ipKey, 300);
      if (userCount === 1) await this.redis.expire(userKey, 300);

      // Brute force detection
      if (ipCount >= 10) {
        this.logger.warn('brute_force_detected', { ip, count: ipCount });
        await this.blockIP(ip, 3600); // Block for 1 hour
      }

      // Account lockout
      if (userCount >= 5) {
        this.logger.warn('account_locked', { userId, count: userCount });
        await this.lockAccount(userId, 900); // Lock for 15 minutes
      }
    } else {
      // On success: Impossible Travel detection
      await this.checkImpossibleTravel(userId, metadata.geoLocation);
    }
  }

  async checkImpossibleTravel(userId, currentLocation) {
    const lastLoginKey = `auth:lastlogin:${userId}`;
    const lastLogin = await this.redis.get(lastLoginKey);

    if (lastLogin) {
      const last = JSON.parse(lastLogin);
      const timeDiffHours = (Date.now() - new Date(last.timestamp)) / 3600000;
      const distanceKm = this.calculateDistance(
        last.lat, last.lon,
        currentLocation.lat, currentLocation.lon
      );

      // Travel speed over 1000 km/h is physically impossible
      if (distanceKm / timeDiffHours > 1000) {
        this.logger.alert('impossible_travel_detected', {
          userId,
          from: last,
          to: currentLocation,
          timeDiffHours,
          distanceKm
        });
      }
    }

    await this.redis.setex(lastLoginKey, 86400, JSON.stringify({
      ...currentLocation,
      timestamp: new Date().toISOString()
    }));
  }
}
```

---

## 14. Comparing and Selecting Authentication Services

```
Comparison of authentication services/libraries (as of 2024):

┌──────────────────┬──────────────┬──────────────┬──────────────┐
│ Service          │ Type         │ Features     │ Use case     │
├──────────────────┼──────────────┼──────────────┼──────────────┤
│ Auth0            │ IDaaS        │ Feature-rich,│ Enterprise   │
│                  │ (SaaS)       │ highly       │              │
│                  │              │ customizable │              │
├──────────────────┼──────────────┼──────────────┼──────────────┤
│ Firebase Auth    │ BaaS         │ Google       │ Mobile apps  │
│                  │              │ integration, │              │
│                  │              │ easy setup   │              │
├──────────────────┼──────────────┼──────────────┼──────────────┤
│ Supabase Auth    │ OSS/BaaS     │ PostgreSQL   │ Full-stack   │
│                  │              │ integration, │ apps         │
│                  │              │ Row Level    │              │
│                  │              │ Security     │              │
├──────────────────┼──────────────┼──────────────┼──────────────┤
│ Clerk            │ IDaaS        │ Excellent    │ SPA/SSR apps │
│                  │              │ React/Next   │              │
│                  │              │ integration  │              │
├──────────────────┼──────────────┼──────────────┼──────────────┤
│ Keycloak         │ OSS          │ Self-hosted, │ On-premises  │
│                  │              │ OIDC/SAML    │ enterprise   │
│                  │              │ support      │              │
├──────────────────┼──────────────┼──────────────┼──────────────┤
│ NextAuth.js      │ OSS          │ Next.js-     │ Next.js      │
│ (Auth.js)        │ Library      │ specific,    │ projects     │
│                  │              │ multi-provid.│              │
├──────────────────┼──────────────┼──────────────┼──────────────┤
│ Lucia Auth       │ OSS          │ Lightweight, │ Learning,    │
│                  │ Library      │ direct DB    │ small PJs    │
├──────────────────┼──────────────┼──────────────┼──────────────┤
│ AWS Cognito      │ Managed      │ AWS          │ AWS-based    │
│                  │ Service      │ integration, │ systems      │
│                  │              │ Federation   │              │
└──────────────────┴──────────────┴──────────────┴──────────────┘

Selection flow:
  1. Is self-hosting required?
     → Yes: Keycloak, Lucia
     → No: Next

  2. What is the target platform?
     → Next.js: Clerk, Auth.js, Supabase
     → React SPA: Auth0, Firebase
     → Mobile: Firebase, Auth0
     → Multi-platform: Auth0, Keycloak

  3. Budget constraints?
     → Free/low cost: Firebase, Supabase, OSS
     → Paid acceptable: Auth0, Clerk
     → Within AWS billing: Cognito

  4. Enterprise requirements?
     → SAML/LDAP: Keycloak, Auth0, Cognito
     → SOC2: Auth0, Clerk
     → Custom domain: Auth0, Clerk
```

---

## FAQ

### Q1: What expiry should be set for Access Tokens and Refresh Tokens?

A short expiry of around 5–15 minutes is recommended for Access Tokens. This minimizes the impact window if a token is leaked. Refresh Tokens should be set to around 7–30 days, but always implement Refresh Token Rotation and issue a new Refresh Token each time one is used. For high-security applications such as financial services, set the Access Token to 5 minutes and the Refresh Token to 24 hours, and also use session timeouts during inactivity. Most importantly, store the Refresh Token in secure storage (HttpOnly Cookie or Secure Enclave) so it cannot be accessed by frontend JavaScript.

### Q2: Can passkeys completely replace passwords?

Technically, passkeys can completely replace passwords, but as of 2024, coexistence during the transition period is realistic. The advantages of passkeys are phishing resistance (bound to the origin), no memorization required, and replay attack resistance. However, challenges include: (1) passkey sync across all devices (Apple/Google/Microsoft have different mechanisms), (2) use on shared devices, (3) ensuring account recovery options, and (4) unsupported legacy browsers. The recommended strategy is to offer passkeys as the primary authentication method while keeping password + MFA as a fallback, and gradually transition to passkeys only.

### Q3: Why was the OAuth 2.0 Implicit Flow deprecated?

The Implicit Flow returns tokens to the browser via the fragment (#), creating the following security risks: (1) Access token remains in browser history. (2) Token may leak via the HTTP Referer header. (3) Vulnerable to token substitution attacks. (4) Refresh Tokens cannot be used, requiring user interaction for every token renewal. The recommended alternative is Authorization Code Flow + PKCE (Proof Key for Code Exchange). PKCE prevents authorization code interception attacks while allowing public clients (SPAs, mobile apps) to obtain tokens securely.

### Q4: Which authentication method is best for inter-microservice communication?

Authentication between microservices depends on the communication pattern. (1) Synchronous communication (HTTP/gRPC): mTLS (mutual TLS authentication) is most recommended. Using a service mesh such as Istio/Linkerd applies mTLS automatically without changing application code. (2) Event-driven (message queues): Sign messages and verify on the consumer side. (3) Internal API calls: Use JWT Token Exchange (RFC 8693) to convert Service A's token to a scope suitable for Service B. It is important to follow the principle of least privilege, where each service uses a token with only the permissions it needs.

### Q5: Should session storage use Redis or a database (PostgreSQL, etc.)?

Redis is recommended when: large numbers of concurrent sessions (hundreds of thousands or more), fast session lookup (sub-millisecond), and automatic expiry (TTL) are required. PostgreSQL is suitable when: session data persistence is important, you want to leverage existing DB infrastructure, or complex queries on session data (for audit purposes, etc.) are needed. In practice, using Redis as primary storage while also recording events to PostgreSQL as an audit log is the most common hybrid configuration. Designing DB as a fallback for Redis failures is also important.

---

## Summary

| Concept | Key Points |
|---------|-----------|
| Basic Auth | Simple but not recommended for production |
| Bearer Token | Stateless API authentication |
| JWT | Header.Payload.Signature, not encrypted |
| OAuth 2.0 | Authorization framework, Auth Code + PKCE recommended |
| OIDC | OAuth 2.0 + Authentication (ID Token) |
| Passkeys | Passwordless, phishing resistant, WebAuthn |
| MFA | TOTP/Security key recommended, SMS not recommended |
| Passwords | Argon2id/bcrypt, compliant with NIST SP 800-63B |
| BFF | Token management for frontends |
| Session | HttpOnly + Secure + SameSite Cookie |

---

## Further Reading

---

## References
1. RFC 7519. "JSON Web Token (JWT)." IETF, 2015.
2. RFC 6749. "The OAuth 2.0 Authorization Framework." IETF, 2012.
3. RFC 7636. "Proof Key for Code Exchange (PKCE)." IETF, 2015.
4. RFC 8693. "OAuth 2.0 Token Exchange." IETF, 2020.
5. OpenID Connect Core 1.0. OpenID Foundation, 2014.
6. W3C. "Web Authentication: An API for accessing Public Key Credentials Level 2." 2021.
7. FIDO Alliance. "FIDO2: Web Authentication (WebAuthn)." 2019.
8. NIST. "SP 800-63B: Digital Identity Guidelines - Authentication and Lifecycle Management." 2017.
9. OWASP. "Authentication Cheat Sheet." 2024.
10. OWASP. "Session Management Cheat Sheet." 2024.

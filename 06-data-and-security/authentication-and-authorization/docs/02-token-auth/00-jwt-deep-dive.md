# JWT Deep Dive

> JWT (JSON Web Token) is a core technology in modern authentication. This guide covers everything about JWT — its three-part structure of header, payload, and signature; algorithm selection; claims design; verification flow; and security pitfalls. Based on RFC 7519, it spans from internal-implementation-level understanding to best practices for production use.

## Prerequisites

- Basic concepts of Base64URL encoding
- Fundamentals of public-key cryptography (RSA, elliptic curve cryptography)
- Basics of HTTP headers and cookies

## What You Will Learn

- [ ] Understand the structure of JWT and how signatures work
- [ ] Know the selection criteria for signing algorithms (HS256/RS256/ES256/EdDSA)
- [ ] Learn JWT security risks and correct implementations
- [ ] Understand key rotation and JWKS operations
- [ ] Master access token and refresh token design patterns
- [ ] Understand the difference between JWE (encryption) and JWS (signature) and when to use each

---

## 1. JWT Structure

```
JWT three-part composition:

  eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.     ← Header
  eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6Ikp...  ← Payload
  SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQ...   ← Signature

  [Header].[Payload].[Signature]
  Each part is Base64URL-encoded and joined with dots

① Header:
  {
    "alg": "RS256",    ← Signing algorithm
    "typ": "JWT",      ← Token type
    "kid": "key-id-1"  ← Key ID (for managing multiple keys)
  }

② Payload (Claims):
  {
    "sub": "user_123",           ← Subject (user ID)
    "iss": "https://auth.example.com", ← Issuer
    "aud": "https://api.example.com",  ← Audience
    "exp": 1700000000,           ← Expiration time
    "iat": 1699999100,           ← Issued At
    "nbf": 1699999100,           ← Not Before
    "jti": "unique-token-id",    ← JWT ID (unique identifier)
    "role": "admin",             ← Custom claim
    "permissions": ["read", "write"]
  }

③ Signature:
  RSASHA256(
    base64UrlEncode(header) + "." + base64UrlEncode(payload),
    privateKey
  )

Important:
  ✗ JWT is NOT encryption (contents are readable by Base64URL decoding)
  ✓ JWT is a signature (detects tampering only)
  → Never include sensitive information in the payload
```

### 1.1 Base64URL Encoding in Detail

```
Difference between Base64 and Base64URL:

  Standard Base64:
    → Character set: A-Z, a-z, 0-9, +, /
    → Padding: =
    → Problems in URLs: + → %2B, / → %2F, = → %3D

  Base64URL (RFC 4648 §5):
    → Character set: A-Z, a-z, 0-9, -, _
    → Padding: omitted
    → URL-safe: can be used as-is

  Conversion steps:
    ① Convert JSON object to UTF-8 byte array
    ② Encode with standard Base64
    ③ Replace + with -, / with _
    ④ Remove trailing = characters
```

```typescript
// Base64URL encode/decode implementation

function base64UrlEncode(input: string | Uint8Array): string {
  let bytes: Uint8Array;
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input);
  } else {
    bytes = input;
  }

  // Encode to standard Base64
  const base64 = btoa(String.fromCharCode(...bytes));

  // Convert to Base64URL: + → -, / → _, remove =
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(input: string): Uint8Array {
  // Restore Base64URL → standard Base64
  let base64 = input
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  // Add padding
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Manually decode JWT payload (no signature verification, for debugging)
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format: expected 3 parts separated by dots');
  }

  const payloadBytes = base64UrlDecode(parts[1]);
  const payloadJson = new TextDecoder().decode(payloadBytes);
  return JSON.parse(payloadJson);
}
```

### 1.2 JWT Internal Generation Process

```
JWT generation internal flow:

  Step 1: Build header
  ┌─────────────────────────┐
  │ { "alg": "ES256",       │
  │   "typ": "JWT",         │
  │   "kid": "key-2024-01"} │
  └──────────┬──────────────┘
             ↓
  Step 2: Base64URL encode
  ┌─────────────────────────┐
  │ eyJhbGciOiJFUzI1NiIs...│
  └──────────┬──────────────┘
             ↓
  Step 3: Build payload
  ┌─────────────────────────┐
  │ { "sub": "user_123",    │
  │   "exp": 1700000000,    │
  │   "iat": 1699999100 }   │
  └──────────┬──────────────┘
             ↓
  Step 4: Base64URL encode
  ┌─────────────────────────┐
  │ eyJzdWIiOiJ1c2VyXzEy... │
  └──────────┬──────────────┘
             ↓
  Step 5: Build signing input
  ┌───────────────────────────────────┐
  │ base64Header + "." + base64Payload│
  │ "eyJhbGci...IkpXVCJ9.eyJzdWIi..." │
  └──────────┬────────────────────────┘
             ↓
  Step 6: Sign with private key
  ┌───────────────────────────────────┐
  │ ECDSA-P256-SHA256(               │
  │   signingInput,                  │
  │   privateKey                     │
  │ )                                │
  └──────────┬────────────────────────┘
             ↓
  Step 7: Base64URL-encode the signature
  ┌───────────────────────────────────┐
  │ SflKxwRJSMeKKF2QT4fwpMeJf36PO... │
  └──────────┬────────────────────────┘
             ↓
  Step 8: Concatenate to complete JWT
  ┌───────────────────────────────────┐
  │ header.payload.signature          │
  └───────────────────────────────────┘
```

---

## 2. Signing Algorithms

```
Comparison of major algorithms:

  Algorithm │ Type       │ Key          │ Recommended │ Use case
  ──────────┼────────────┼──────────────┼─────────────┼──────────────────
  HS256     │ Symmetric  │ Shared secret│ △           │ Single service
  HS384     │ Symmetric  │ Shared secret│ △           │ Single service
  HS512     │ Symmetric  │ Shared secret│ △           │ Single service
  RS256     │ Asymmetric │ RSA key pair │ ○           │ Microservices
  RS384     │ Asymmetric │ RSA key pair │ ○           │ Microservices
  RS512     │ Asymmetric │ RSA key pair │ ○           │ Microservices
  ES256     │ Asymmetric │ ECDSA key    │ ◎           │ Most recommended
  ES384     │ Asymmetric │ ECDSA key    │ ◎           │ High security
  ES512     │ Asymmetric │ ECDSA key    │ ◎           │ Highest security
  PS256     │ Asymmetric │ RSA-PSS      │ ○           │ Improved RSA
  PS384     │ Asymmetric │ RSA-PSS      │ ○           │ Improved RSA
  PS512     │ Asymmetric │ RSA-PSS      │ ○           │ Improved RSA
  EdDSA     │ Asymmetric │ Ed25519      │ ◎           │ Latest, fast

HS256 (HMAC-SHA256):
  → Symmetric: the same secret key is used for signing and verification
  → Simple but key sharing is a problem
  → Recommended only for use within a single service
  → If the secret key leaks from even one location, everything is compromised
  → Key length: minimum 256 bits (32 bytes) recommended

RS256 (RSA-SHA256):
  → Asymmetric: sign with private key, verify with public key
  → No need to share the private key with the verification side
  → Ideal for microservices
  → Large key size (2048 bits or more)
  → Signature size: 256 bytes (with a 2048-bit key)

ES256 (ECDSA-P256-SHA256):
  → Elliptic curve cryptography: equivalent strength to RSA with smaller keys
  → Key size: 256 bits (equivalent to RSA 2048 bits)
  → Smaller signature size → smaller JWT size
  → Recommended by OWASP
  → Signature size: 64 bytes (1/4 of RSA)

EdDSA (Ed25519):
  → Based on Twisted Edwards curve
  → Faster than ECDSA (both signing and verification)
  → Deterministic signatures (same input → same signature)
  → High resistance to side-channel attacks
  → Key size: 256 bits, signature size: 64 bytes
```

### 2.1 Internal Algorithm Operations

```
HMAC-SHA256 (HS256) internals:

  ┌──────────────────────────────────────────┐
  │                                          │
  │  secret_key = "super-secret-key-256bit"  │
  │                                          │
  │  Signing steps:                          │
  │  ① ipad = secret_key XOR 0x36 (64 bytes) │
  │  ② opad = secret_key XOR 0x5C (64 bytes) │
  │  ③ inner = SHA256(ipad || message)        │
  │  ④ signature = SHA256(opad || inner)      │
  │                                          │
  │  Result: 256-bit (32-byte) MAC value     │
  │                                          │
  └──────────────────────────────────────────┘

RSA-SHA256 (RS256) internals:

  ┌──────────────────────────────────────────┐
  │                                          │
  │  Signing (with private key):             │
  │  ① hash = SHA256(header.payload)         │
  │  ② padded = PKCS#1 v1.5 padding(hash)   │
  │  ③ signature = padded^d mod n            │
  │    (d: private exponent, n: modulus)     │
  │                                          │
  │  Verification (with public key):         │
  │  ① decrypted = signature^e mod n         │
  │    (e: public exponent, n: modulus)      │
  │  ② unpadded = remove PKCS#1 padding      │
  │  ③ hash = SHA256(header.payload)         │
  │  ④ compare(unpadded, hash)               │
  │                                          │
  └──────────────────────────────────────────┘

ECDSA-P256-SHA256 (ES256) internals:

  ┌──────────────────────────────────────────┐
  │                                          │
  │  Elliptic curve parameters (P-256 / secp256r1): │
  │  → Prime order: p ≈ 2^256               │
  │  → Generator point: G (fixed point on curve) │
  │  → Private key: d (random integer)      │
  │  → Public key: Q = d × G (scalar multiplication) │
  │                                          │
  │  Signing steps:                          │
  │  ① hash = SHA256(header.payload)         │
  │  ② k = random nonce (unique per signature) │
  │  ③ (x, y) = k × G                       │
  │  ④ r = x mod n                           │
  │  ⑤ s = k^(-1) × (hash + r × d) mod n    │
  │  ⑥ signature = (r, s)                    │
  │                                          │
  │  Verification steps:                     │
  │  ① hash = SHA256(header.payload)         │
  │  ② w = s^(-1) mod n                      │
  │  ③ u1 = hash × w mod n                   │
  │  ④ u2 = r × w mod n                      │
  │  ⑤ (x', y') = u1 × G + u2 × Q           │
  │  ⑥ valid = (x' mod n == r)               │
  │                                          │
  └──────────────────────────────────────────┘
```

### 2.2 Signature Size and Performance Comparison

```
Signature size comparison:

  Algorithm │ Key size    │ Signature size │ Security strength
  ──────────┼─────────────┼────────────────┼──────────────────
  HS256     │ 256 bit   │ 32 bytes │ 128 bit
  RS256     │ 2048 bit  │ 256 bytes│ 112 bit
  RS256     │ 4096 bit  │ 512 bytes│ 140 bit
  ES256     │ 256 bit   │ 64 bytes │ 128 bit
  ES384     │ 384 bit   │ 96 bytes │ 192 bit
  EdDSA     │ 256 bit   │ 64 bytes │ 128 bit

Performance comparison (relative values, Node.js 20 / x86_64):

  Algorithm │ Signing speed │ Verification speed │ JWT size
  ──────────┼───────────────┼────────────────────┼──────────
  HS256     │ ◎ Fastest    │ ◎ Fastest          │ Small
  RS256     │ △ Slow       │ ○ Fast             │ Large
  ES256     │ ○ Moderate   │ ○ Moderate         │ Small
  EdDSA     │ ◎ Fast       │ ◎ Fast             │ Small

  Conclusion:
  → HS256 for performance alone, but has key-sharing issues
  → Best balance: ES256 (small key + signature, sufficiently fast)
  → Latest choice: EdDSA (fastest + smallest, but verify compatibility)
```

```typescript
// JWT implementation with ES256 (jose library)
import { SignJWT, jwtVerify, generateKeyPair, exportJWK } from 'jose';

// Generate key pair
const { publicKey, privateKey } = await generateKeyPair('ES256');

// Sign (issue) JWT
async function issueToken(userId: string, role: string): Promise<string> {
  return new SignJWT({
    sub: userId,
    role,
    permissions: getRolePermissions(role),
  })
    .setProtectedHeader({ alg: 'ES256', kid: 'key-2024-01' })
    .setIssuer('https://auth.example.com')
    .setAudience('https://api.example.com')
    .setIssuedAt()
    .setExpirationTime('15m')  // 15 minutes
    .setJti(crypto.randomUUID())
    .sign(privateKey);
}

// Verify JWT
async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, publicKey, {
    issuer: 'https://auth.example.com',
    audience: 'https://api.example.com',
    algorithms: ['ES256'],  // Explicitly specify allowed algorithms
  });

  return payload;
}
```

```typescript
// JWT implementation with EdDSA (Ed25519)
import { SignJWT, jwtVerify, generateKeyPair } from 'jose';

// Generate Ed25519 key pair
const { publicKey, privateKey } = await generateKeyPair('EdDSA', {
  crv: 'Ed25519',
});

async function issueEdDSAToken(userId: string): Promise<string> {
  return new SignJWT({
    sub: userId,
    scope: 'read write',
  })
    .setProtectedHeader({ alg: 'EdDSA', crv: 'Ed25519', kid: 'ed-key-01' })
    .setIssuer('https://auth.example.com')
    .setAudience('https://api.example.com')
    .setIssuedAt()
    .setExpirationTime('15m')
    .setJti(crypto.randomUUID())
    .sign(privateKey);
}

async function verifyEdDSAToken(token: string) {
  const { payload, protectedHeader } = await jwtVerify(token, publicKey, {
    algorithms: ['EdDSA'],
    issuer: 'https://auth.example.com',
    audience: 'https://api.example.com',
  });

  console.log('Algorithm:', protectedHeader.alg);  // EdDSA
  console.log('User:', payload.sub);

  return payload;
}
```

```typescript
// Key generation commands for each algorithm (OpenSSL)
// HS256: openssl rand -base64 32
// RS256: openssl genrsa -out private.pem 2048
//        openssl rsa -in private.pem -pubout -out public.pem
// ES256: openssl ecparam -genkey -name prime256v1 -noout -out private-ec.pem
//        openssl ec -in private-ec.pem -pubout -out public-ec.pem
// EdDSA: openssl genpkey -algorithm ED25519 -out private-ed.pem
//        openssl pkey -in private-ed.pem -pubout -out public-ed.pem

// Key generation in Node.js
import { generateKeyPair, exportJWK, exportPKCS8, exportSPKI } from 'jose';

async function generateKeys(algorithm: string) {
  const { publicKey, privateKey } = await generateKeyPair(algorithm);

  // Export in JWK format
  const publicJWK = await exportJWK(publicKey);
  const privateJWK = await exportJWK(privateKey);

  // Export in PEM format
  const publicPEM = await exportSPKI(publicKey);
  const privatePEM = await exportPKCS8(privateKey);

  return { publicJWK, privateJWK, publicPEM, privatePEM };
}

// Usage examples
const es256Keys = await generateKeys('ES256');
const eddsaKeys = await generateKeys('EdDSA');
const rs256Keys = await generateKeys('RS256');
```

---

## 3. Claims Design

```
Registered claims (RFC 7519):

  Claim │ Full name     │ Description                  │ Required
  ──────┼───────────────┼──────────────────────────────┼─────────
  iss   │ Issuer        │ Token issuer                 │ Recommended
  sub   │ Subject       │ User identifier              │ Recommended
  aud   │ Audience      │ Token recipient              │ Recommended
  exp   │ Expiration    │ Expiration time (Unix time)  │ Required
  nbf   │ Not Before    │ Valid-from time              │ Optional
  iat   │ Issued At     │ Issue time                   │ Recommended
  jti   │ JWT ID        │ Unique identifier            │ Optional

Custom claims design:

  ✓ Recommended:
    → role: user's role
    → permissions: array of permissions
    → org_id: organization ID (multi-tenant)
    → email: email address (public information only)
    → tenant: tenant identifier
    → token_version: token version (for forced revocation)

  ✗ Must NOT include:
    → Passwords or secrets
    → Credit card information
    → Sensitive personal information (address, phone number, etc.)
    → Large amounts of data (causes token size bloat)
    → Session state (JWT should be stateless)

  Size guidelines:
    → Keep total JWT size under 4 KB
    → Especially important when storing in a Cookie (Cookie limit: ~4 KB)
    → Keep payload to the minimum necessary
    → Common upper limit for Authorization header: 8 KB
    → nginx default: large_client_header_buffers 8 KB
```

### 3.1 Claims Design Patterns

```typescript
// Claims design examples

// Access token payload (minimal)
interface AccessTokenPayload {
  sub: string;         // User ID
  role: 'user' | 'admin' | 'super_admin';
  org_id?: string;     // For multi-tenancy
  scope?: string;      // OAuth 2.0 scope
  token_version?: number; // For forced revocation
  // exp, iat, iss, aud are set automatically by jose
}

// ID token payload (includes user info)
interface IDTokenPayload {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  email_verified: boolean;
  locale?: string;
  updated_at?: number;
}

// Refresh token payload
interface RefreshTokenPayload {
  sub: string;
  jti: string;         // Unique ID (for revocation management)
  family: string;      // Token family (for replay detection)
  token_version: number;
}

// Access token for multi-tenancy
interface MultiTenantAccessToken {
  sub: string;
  org_id: string;
  org_role: 'owner' | 'admin' | 'member' | 'viewer';
  permissions: string[];  // Fine-grained permissions
  features: string[];     // Enabled features for the tenant
}

// Include only minimal information in access tokens;
// use the /userinfo endpoint when detailed user info is needed
```

### 3.2 Detailed aud Claim Design

```
Importance of the aud (Audience) claim:

  Purpose:
  → Ensure the token is only accepted by the intended recipient
  → Prevent token reuse across different services

  Common problem:
  ┌────────────────────────────────────────────────────┐
  │  When aud is not validated:                        │
  │                                                    │
  │  User → AuthServer → access_token(aud: "api-a")   │
  │  User → API-A: access_token → OK                  │
  │  User → API-B: access_token → aud not checked → OK ✗ │
  │                                                    │
  │  → A token intended for API-A can also be used at API-B │
  │  → Privilege escalation vulnerability              │
  └────────────────────────────────────────────────────┘

  Correct design:
  ┌────────────────────────────────────────────────────┐
  │  API-A: only accepts aud: "https://api-a.example.com" │
  │  API-B: only accepts aud: "https://api-b.example.com" │
  │                                                    │
  │  → Set a different aud for each service            │
  │  → Each service validates only tokens with its own aud │
  └────────────────────────────────────────────────────┘
```

```typescript
// Strict validation of the aud claim
import { jwtVerify } from 'jose';

// Validation configuration per microservice
const serviceConfig = {
  'user-service': {
    audience: 'https://user-api.example.com',
    requiredScopes: ['read:user', 'write:user'],
  },
  'order-service': {
    audience: 'https://order-api.example.com',
    requiredScopes: ['read:order', 'write:order'],
  },
  'payment-service': {
    audience: 'https://payment-api.example.com',
    requiredScopes: ['process:payment'],
  },
};

async function verifyServiceToken(
  token: string,
  serviceName: keyof typeof serviceConfig
) {
  const config = serviceConfig[serviceName];

  const { payload } = await jwtVerify(token, publicKey, {
    algorithms: ['ES256'],
    issuer: 'https://auth.example.com',
    audience: config.audience,  // aud specific to this service
  });

  // Scope validation
  const tokenScopes = (payload.scope as string || '').split(' ');
  const hasRequiredScopes = config.requiredScopes.every(
    (scope) => tokenScopes.includes(scope)
  );

  if (!hasRequiredScopes) {
    throw new Error(`Insufficient scopes. Required: ${config.requiredScopes.join(', ')}`);
  }

  return payload;
}
```

---

## 4. Key Rotation

```
How key rotation works:

  Why rotation is needed:
  → Long-term key use carries risk (accumulated chance of leakage)
  → Regular updates are a security best practice
  → Limits the blast radius in case of a leak
  → May be mandated by compliance requirements (PCI DSS, etc.)

  Management via JWKS (JSON Web Key Set):

  ┌────────────────────────────────────────┐
  │  /.well-known/jwks.json                │
  │                                        │
  │  {                                     │
  │    "keys": [                           │
  │      {                                 │
  │        "kid": "key-2024-02",           │
  │        "kty": "EC",                    │
  │        "crv": "P-256",                 │
  │        "x": "...",                     │
  │        "y": "...",     ← Current key  │
  │        "use": "sig"                    │
  │      },                                │
  │      {                                 │
  │        "kid": "key-2024-01",           │
  │        "kty": "EC",                    │
  │        "crv": "P-256",                 │
  │        "x": "...",                     │
  │        "y": "...",     ← Old key (for verification) │
  │        "use": "sig"                    │
  │      }                                 │
  │    ]                                   │
  │  }                                     │
  └────────────────────────────────────────┘

  Rotation procedure:
  ① Generate a new key pair
  ② Add the new public key to JWKS (keep the old key as well)
  ③ Start signing with the new private key (distinguished by kid)
  ④ Wait until all tokens signed with the old key have expired
  ⑤ Remove the old key from JWKS

  Example timeline:

  ──────────────────────────────────────────────>
  │           │              │              │
  key-1 gen   key-2 gen      key-1 expires   key-1 removed
  start sign  switch to key-2 verify only   remove from JWKS
              │              │              │
  ←─signed with key-1─→←─signed with key-2───────────────→
  ←─verified with key-1──────────────→
              ←─verified with key-2────────────────────────→
```

### 4.1 Key Management Implementation

```typescript
// JWKS endpoint implementation
import { exportJWK, generateKeyPair, importJWK } from 'jose';

// Key management
class KeyManager {
  private keys: Map<string, {
    publicKey: CryptoKey;
    privateKey: CryptoKey;
    createdAt: Date;
    expiresAt: Date;
  }> = new Map();
  private currentKeyId: string = '';
  private rotationIntervalMs: number = 30 * 24 * 60 * 60 * 1000; // 30 days
  private gracePeriodMs: number = 24 * 60 * 60 * 1000; // 24-hour grace period

  async initialize() {
    await this.rotateKey();
    // Schedule periodic rotation
    setInterval(() => this.rotateKey(), this.rotationIntervalMs);
  }

  async rotateKey() {
    const keyId = `key-${Date.now()}`;
    const { publicKey, privateKey } = await generateKeyPair('ES256');
    const now = new Date();

    this.keys.set(keyId, {
      publicKey,
      privateKey,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.rotationIntervalMs + this.gracePeriodMs),
    });
    this.currentKeyId = keyId;

    // Remove expired keys
    this.cleanupExpiredKeys();

    console.log(`Key rotated. Current key: ${keyId}. Total keys: ${this.keys.size}`);
  }

  private cleanupExpiredKeys() {
    const now = new Date();
    for (const [kid, keyInfo] of this.keys) {
      if (kid !== this.currentKeyId && keyInfo.expiresAt < now) {
        this.keys.delete(kid);
        console.log(`Expired key removed: ${kid}`);
      }
    }
  }

  // Current private key (for signing)
  getCurrentSigningKey() {
    return {
      kid: this.currentKeyId,
      privateKey: this.keys.get(this.currentKeyId)!.privateKey,
    };
  }

  // JWKS (public key set)
  async getJWKS() {
    const keys = [];
    for (const [kid, { publicKey }] of this.keys) {
      const jwk = await exportJWK(publicKey);
      keys.push({ ...jwk, kid, use: 'sig', alg: 'ES256' });
    }
    return { keys };
  }

  // Retrieve public key by kid (for verification)
  getPublicKey(kid: string) {
    return this.keys.get(kid)?.publicKey;
  }
}

// JWKS endpoint
// GET /.well-known/jwks.json
app.get('/.well-known/jwks.json', async (req, res) => {
  const jwks = await keyManager.getJWKS();

  // JWKS is cacheable (but keep TTL short)
  res.set('Cache-Control', 'public, max-age=900'); // 15 minutes
  res.json(jwks);
});
```

### 4.2 Remote JWKS Verification

```typescript
// JWT verification using remote JWKS (microservice side)
import { createRemoteJWKSet, jwtVerify } from 'jose';

// Fetch public keys from JWKS URI (with caching)
const JWKS = createRemoteJWKSet(
  new URL('https://auth.example.com/.well-known/jwks.json'),
  {
    cooldownDuration: 30_000,  // Minimum re-fetch interval: 30 seconds
    cacheMaxAge: 600_000,      // Cache TTL: 10 minutes
  }
);

async function verifyTokenWithRemoteJWKS(token: string) {
  try {
    const { payload, protectedHeader } = await jwtVerify(token, JWKS, {
      algorithms: ['ES256'],
      issuer: 'https://auth.example.com',
      audience: 'https://api.example.com',
      clockTolerance: 30,  // Allow 30 seconds of clock skew
    });

    console.log(`Token verified with key: ${protectedHeader.kid}`);
    return payload;
  } catch (error) {
    // Fallback when JWKS fetch fails
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('JWKS endpoint unreachable. Using cached keys.');
      // Retry with cached keys (jose does this automatically)
      throw new Error('Authentication service unavailable');
    }
    throw error;
  }
}
```

---

## 5. JWT Security Risks and Countermeasures

```
Major JWT security risks:

  ① alg: "none" attack:
     → Rewrite the alg in the header to "none"
     → Bypass signature verification
     → Countermeasure: explicitly specify allowed algorithms

     Attack flow:
     ┌──────────────────────────────────────┐
     │  Attacker actions:                   │
     │  1. Obtain a legitimate JWT          │
     │  2. Change alg in header to "none"   │
     │  3. Change role in payload to "admin"│
     │  4. Remove the signature part        │
     │  5. Send the tampered JWT            │
     │                                      │
     │  Vulnerable server:                  │
     │  → Accepts alg: "none"              │
     │  → Skips signature verification      │
     │  → Attacker gains admin access       │
     └──────────────────────────────────────┘

  ② Algorithm Confusion attack:
     → Use RS256 public key as HS256 secret key
     → Public key is public information → attacker can sign
     → Countermeasure: restrict algorithms with the algorithms parameter

     Attack flow:
     ┌──────────────────────────────────────┐
     │  Premise: server uses RS256          │
     │  Public key is published via JWKS    │
     │                                      │
     │  Attacker actions:                   │
     │  1. Obtain the public key from JWKS  │
     │  2. Change alg to HS256              │
     │  3. Use the public key as HS256 secret│
     │  4. HMAC(public key, header.payload) │
     │                                      │
     │  Vulnerable server:                  │
     │  → Verifies according to alg: HS256 │
     │  → Uses public key as HMAC secret    │
     │  → Attacker's signature matches → auth succeeds │
     └──────────────────────────────────────┘

  ③ Difficulty of immediate revocation:
     → JWT remains valid until expiry (no server state)
     → Token remains valid even after user logs out
     → Countermeasure: short expiry + blacklist or Token Version

  ④ Token size:
     → Adding more claims bloats size
     → Included in every request
     → Countermeasure: keep claims to minimum necessary

  ⑤ Plaintext payload:
     → Base64URL is not encryption
     → Anyone can decode it
     → Countermeasure: do not include sensitive info; use JWE if necessary

  ⑥ kid injection:
     → Path traversal or SQL injection in the kid field
     → kid: "../../dev/null" → verify with empty key
     → kid: "' OR '1'='1" → SQL injection
     → Countermeasure: validate kid; accept only whitelisted key IDs

  ⑦ jwk header injection:
     → Embed a jwk (public key) in the header
     → Server verifies with the embedded key
     → Countermeasure: ignore jwk in the header; use only server-side keys
```

### 5.1 Secure JWT Verification Implementation

```typescript
// Secure JWT verification implementation
import { jwtVerify, errors } from 'jose';

async function verifyAccessToken(token: string) {
  try {
    const { payload, protectedHeader } = await jwtVerify(token, publicKey, {
      // Options that should always be specified
      algorithms: ['ES256'],                    // Restrict allowed algorithms
      issuer: 'https://auth.example.com',       // Verify issuer
      audience: 'https://api.example.com',      // Verify audience
      clockTolerance: 30,                       // Allowed time skew (seconds)
      maxTokenAge: '15m',                       // Maximum token age
    });

    // Additional validation
    if (!payload.sub) throw new Error('Missing subject');
    if (!payload.role) throw new Error('Missing role');

    // kid validation (only allow known key IDs)
    if (protectedHeader.kid && !isValidKeyId(protectedHeader.kid)) {
      throw new Error('Invalid key ID');
    }

    // jti uniqueness check (prevent replay attacks)
    if (payload.jti) {
      const isUsed = await checkJtiUsed(payload.jti as string);
      if (isUsed) throw new Error('Token already used');
      await markJtiUsed(payload.jti as string, payload.exp as number);
    }

    return {
      userId: payload.sub,
      role: payload.role as string,
      permissions: payload.permissions as string[],
    };
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      throw new AuthError('Token expired', 'TOKEN_EXPIRED');
    }
    if (error instanceof errors.JWTClaimValidationFailed) {
      throw new AuthError('Invalid token claims', 'INVALID_CLAIMS');
    }
    if (error instanceof errors.JWSSignatureVerificationFailed) {
      throw new AuthError('Invalid signature', 'INVALID_SIGNATURE');
    }
    throw new AuthError('Invalid token', 'INVALID_TOKEN');
  }
}

// kid validation
function isValidKeyId(kid: string): boolean {
  // Allow only alphanumeric characters and hyphens (prevent injection)
  return /^[a-zA-Z0-9_-]{1,64}$/.test(kid);
}

// jti used-check (Redis)
async function checkJtiUsed(jti: string): Promise<boolean> {
  const exists = await redis.exists(`jti:${jti}`);
  return exists === 1;
}

async function markJtiUsed(jti: string, exp: number): Promise<void> {
  const ttl = exp - Math.floor(Date.now() / 1000);
  if (ttl > 0) {
    await redis.setex(`jti:${jti}`, ttl, '1');
  }
}
```

### 5.2 Express / Koa Middleware Implementation

```typescript
// JWT authentication middleware for Express
import { Request, Response, NextFunction } from 'express';
import { jwtVerify, createRemoteJWKSet, errors } from 'jose';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
    permissions: string[];
    orgId?: string;
  };
}

const JWKS = createRemoteJWKSet(
  new URL('https://auth.example.com/.well-known/jwks.json')
);

// Authentication middleware
function requireAuth() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'Bearer token is required',
      });
    }

    const token = authHeader.substring(7);

    try {
      const { payload } = await jwtVerify(token, JWKS, {
        algorithms: ['ES256'],
        issuer: 'https://auth.example.com',
        audience: 'https://api.example.com',
        clockTolerance: 30,
      });

      req.user = {
        userId: payload.sub as string,
        role: payload.role as string,
        permissions: (payload.permissions as string[]) || [],
        orgId: payload.org_id as string | undefined,
      };

      next();
    } catch (error) {
      if (error instanceof errors.JWTExpired) {
        return res.status(401).json({
          error: 'token_expired',
          message: 'Access token has expired',
        });
      }
      return res.status(401).json({
        error: 'invalid_token',
        message: 'Invalid access token',
      });
    }
  };
}

// Authorization middleware
function requirePermission(...requiredPermissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const hasPermission = requiredPermissions.every(
      (perm) => req.user!.permissions.includes(perm)
    );

    if (!hasPermission) {
      return res.status(403).json({
        error: 'insufficient_permissions',
        message: `Required permissions: ${requiredPermissions.join(', ')}`,
      });
    }

    next();
  };
}

// Usage examples
app.get('/api/users',
  requireAuth(),
  requirePermission('read:user'),
  async (req: AuthenticatedRequest, res) => {
    const users = await userService.listUsers(req.user!.orgId);
    res.json(users);
  }
);

app.delete('/api/users/:id',
  requireAuth(),
  requirePermission('delete:user'),
  async (req: AuthenticatedRequest, res) => {
    await userService.deleteUser(req.params.id, req.user!.userId);
    res.status(204).send();
  }
);
```

---

## 6. Access Tokens and Refresh Tokens

```
Token pair design:

  Access token:
    → Short-lived (15 minutes to 1 hour)
    → Used to authenticate API requests
    → JWT (self-contained, no server state needed)
    → Sent with every request → keep size small

  Refresh token:
    → Long-lived (7 to 30 days)
    → Used to obtain new access tokens
    → Opaque token or JWT
    → Managed with server-side state (can be revoked)

  Flow:

  Client              Auth Server            Resource Server
    │                    │                     │
    │ Login               │                     │
    │───────────────────>│                     │
    │                    │                     │
    │ access_token (15m) │                     │
    │ refresh_token (7d) │                     │
    │<───────────────────│                     │
    │                    │                     │
    │ API request + access_token               │
    │──────────────────────────────────────────>│
    │                    │                     │
    │ 200 OK + data                            │
    │<──────────────────────────────────────────│
    │                    │                     │
    │ (After 15 min) access_token expired       │
    │──────────────────────────────────────────>│
    │ 401 Token Expired                        │
    │<──────────────────────────────────────────│
    │                    │                     │
    │ Request new access_token                 │
    │ using refresh_token                      │
    │───────────────────>│                     │
    │                    │                     │
    │ New access_token   │                     │
    │ New refresh_token  │ ← Refresh token     │
    │<───────────────────│   rotation          │
    │                    │                     │
```

### 6.1 Refresh Token Rotation

```
Refresh token rotation:

  Why it is needed:
  → Limits damage if a refresh token is compromised
  → Enables detection of token replay attacks

  How it works:
  → Issue a new refresh token on each refresh
  → Invalidate the old refresh token
  → If a used token is reused, revoke all tokens

  Replay detection via token families:

  Normal flow:
    RT-1 → (used) → AT-2 + RT-2
    RT-2 → (used) → AT-3 + RT-3

  Attack scenario:
    Attacker steals RT-1; after the legitimate user uses RT-2,
    the attacker tries to use RT-1
    → RT-1 is already used
    → Revoke all tokens in the same family
    → User must re-login (fail secure)
```

```typescript
// Refresh token rotation implementation
import crypto from 'crypto';

class RefreshTokenService {
  constructor(private db: Database, private redis: Redis) {}

  // Issue refresh token
  async issueRefreshToken(userId: string, family?: string): Promise<string> {
    const token = crypto.randomBytes(64).toString('base64url');
    const hashedToken = this.hashToken(token);
    const tokenFamily = family || crypto.randomUUID();

    await this.db.refreshToken.create({
      data: {
        hashedToken,
        userId,
        family: tokenFamily,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        used: false,
      },
    });

    return token;
  }

  // Use refresh token (rotation)
  async rotateToken(token: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const hashedToken = this.hashToken(token);

    const stored = await this.db.refreshToken.findFirst({
      where: { hashedToken },
    });

    if (!stored) {
      throw new AuthError('Invalid refresh token', 'INVALID_TOKEN');
    }

    // Expiry check
    if (stored.expiresAt < new Date()) {
      throw new AuthError('Refresh token expired', 'TOKEN_EXPIRED');
    }

    // Replay detection: used token reused
    if (stored.used) {
      // Revoke the entire token family (possible security breach)
      await this.revokeTokenFamily(stored.family);
      console.warn(
        `Refresh token reuse detected! Family: ${stored.family}, User: ${stored.userId}`
      );
      throw new AuthError('Token reuse detected. All sessions revoked.', 'TOKEN_REUSE');
    }

    // Mark old token as used
    await this.db.refreshToken.update({
      where: { id: stored.id },
      data: { used: true, usedAt: new Date() },
    });

    // Issue new refresh token in the same family
    const newRefreshToken = await this.issueRefreshToken(stored.userId, stored.family);

    // Issue new access token
    const accessToken = await issueAccessToken(stored.userId);

    return { accessToken, refreshToken: newRefreshToken };
  }

  // Revoke entire token family
  async revokeTokenFamily(family: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { family },
      data: { revokedAt: new Date() },
    });
  }

  // Revoke all tokens for a user (on password change or account compromise)
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
```

---

## 7. JWT Blacklist (Revocation Strategy)

```
Comparison of JWT revocation strategies:

  Strategy          │ Advantages          │ Disadvantages
  ──────────────────┼─────────────────────┼──────────────────────
  Short-lived token │ Simple              │ UX (frequent re-fetch)
  Blacklist         │ Immediate revocation│ Requires state management
  Token Version     │ Per-user revocation │ Requires DB lookup
  Event-driven      │ Real-time           │ Complex infrastructure

  Recommendation: short-lived access tokens + refresh tokens + blacklist (jti)
```

```typescript
// JWT blacklist using Redis
class TokenBlacklist {
  constructor(private redis: Redis) {}

  // Add token to blacklist
  async revoke(jti: string, exp: number): Promise<void> {
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      // Keep for the remaining valid lifetime of the token (save memory)
      await this.redis.setex(`blacklist:${jti}`, ttl, '1');
    }
  }

  // Check if token is blacklisted
  async isRevoked(jti: string): Promise<boolean> {
    const result = await this.redis.get(`blacklist:${jti}`);
    return result !== null;
  }

  // Batch revocation of multiple tokens
  async revokeMany(tokens: Array<{ jti: string; exp: number }>): Promise<void> {
    const pipeline = this.redis.pipeline();
    const now = Math.floor(Date.now() / 1000);

    for (const { jti, exp } of tokens) {
      const ttl = exp - now;
      if (ttl > 0) {
        pipeline.setex(`blacklist:${jti}`, ttl, '1');
      }
    }

    await pipeline.exec();
  }
}

// Token Version-based revocation (per user)
class TokenVersionService {
  constructor(private redis: Redis, private db: Database) {}

  // Get token version for a user
  async getVersion(userId: string): Promise<number> {
    const cached = await this.redis.get(`token_version:${userId}`);
    if (cached) return parseInt(cached, 10);

    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { tokenVersion: true },
    });

    const version = user?.tokenVersion || 0;
    await this.redis.setex(`token_version:${userId}`, 3600, version.toString());
    return version;
  }

  // Increment token version (invalidate all tokens)
  async incrementVersion(userId: string): Promise<number> {
    const newVersion = await this.db.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    });

    await this.redis.setex(
      `token_version:${userId}`,
      3600,
      newVersion.tokenVersion.toString()
    );

    return newVersion.tokenVersion;
  }

  // Validate token version
  async isValidVersion(userId: string, tokenVersion: number): Promise<boolean> {
    const currentVersion = await this.getVersion(userId);
    return tokenVersion >= currentVersion;
  }
}

// Integrate into the verification flow
async function verifyTokenWithBlacklist(token: string) {
  const payload = await verifyAccessToken(token);

  // Blacklist check
  if (payload.jti && await blacklist.isRevoked(payload.jti)) {
    throw new AuthError('Token has been revoked', 'TOKEN_REVOKED');
  }

  // Token Version check
  if (payload.token_version !== undefined) {
    const isValid = await tokenVersionService.isValidVersion(
      payload.userId,
      payload.token_version as number
    );
    if (!isValid) {
      throw new AuthError('Token version outdated', 'TOKEN_VERSION_OUTDATED');
    }
  }

  return payload;
}

// On logout
async function logout(token: string) {
  const payload = await verifyAccessToken(token);
  if (payload.jti && payload.exp) {
    await blacklist.revoke(payload.jti, payload.exp);
  }
}

// On password change (invalidate all sessions)
async function onPasswordChange(userId: string) {
  await tokenVersionService.incrementVersion(userId);
  await refreshTokenService.revokeAllUserTokens(userId);
}
```

---

## 8. JWE (JSON Web Encryption)

```
JWS vs JWE:

  JWS (JSON Web Signature):
    → Signature only (tamper detection)
    → Payload is Base64URL (readable by anyone)
    → The vast majority of JWTs are JWS
    → Format: header.payload.signature

  JWE (JSON Web Encryption):
    → Encryption (hides contents) + integrity assurance
    → Payload is ciphertext (unreadable without the key)
    → Used when sensitive information must be included
    → Format: header.encryptedKey.iv.ciphertext.authTag

  JWE five-part structure:

  ┌─────────────────────────────────────────────────┐
  │                                                 │
  │  Part 1: Protected Header (Base64URL)            │
  │    { "alg": "RSA-OAEP-256",                    │
  │      "enc": "A256GCM" }                         │
  │                                                 │
  │  Part 2: Encrypted Key (encrypted CEK)          │
  │    → CEK (Content Encryption Key)               │
  │      encrypted with the recipient's public key  │
  │                                                 │
  │  Part 3: Initialization Vector (IV)             │
  │    → Initialization vector for AES-GCM          │
  │                                                 │
  │  Part 4: Ciphertext                             │
  │    → Payload encrypted with CEK + IV            │
  │                                                 │
  │  Part 5: Authentication Tag                     │
  │    → Integrity verification tag                 │
  │                                                 │
  └─────────────────────────────────────────────────┘

  When to use:
    JWS: Regular authentication tokens (most cases)
    JWE: When containing sensitive data or hiding token contents is required
    Nested JWT: Wrap JWS inside JWE (signature + encryption)
```

```typescript
// JWE implementation (jose library)
import { CompactEncrypt, compactDecrypt, generateKeyPair } from 'jose';

// Recipient's RSA key pair
const { publicKey, privateKey } = await generateKeyPair('RSA-OAEP-256');

// JWE encryption
async function encryptPayload(payload: Record<string, unknown>): Promise<string> {
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(payload));

  return new CompactEncrypt(plaintext)
    .setProtectedHeader({
      alg: 'RSA-OAEP-256',  // Key encryption algorithm
      enc: 'A256GCM',       // Content encryption algorithm
      typ: 'JWT',
    })
    .encrypt(publicKey);
}

// JWE decryption
async function decryptPayload(jwe: string): Promise<Record<string, unknown>> {
  const { plaintext } = await compactDecrypt(jwe, privateKey);
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(plaintext));
}

// Nested JWT (wrap JWS inside JWE)
async function createNestedJwt(
  userId: string,
  sensitiveData: Record<string, unknown>
): Promise<string> {
  // Step 1: Create JWS (signed JWT)
  const jws = await new SignJWT({
    sub: userId,
    ...sensitiveData,
  })
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(signingPrivateKey);

  // Step 2: Encrypt JWS with JWE
  const encoder = new TextEncoder();
  return new CompactEncrypt(encoder.encode(jws))
    .setProtectedHeader({
      alg: 'RSA-OAEP-256',
      enc: 'A256GCM',
      cty: 'JWT',  // Content Type: indicates the contents are a JWT
    })
    .encrypt(encryptionPublicKey);
}
```

---

## 9. JWT Storage Location

```
Comparison of JWT storage locations:

  Storage location  │ XSS resistance │ CSRF resistance │ Recommended │ Notes
  ──────────────────┼────────────────┼─────────────────┼─────────────┼──────────────
  HttpOnly Cookie   │ ✓              │ △               │ ◎           │ Improved with SameSite=Lax
  localStorage      │ ✗              │ ✓               │ △           │ Can be stolen via XSS
  sessionStorage    │ ✗              │ ✓               │ △           │ Can be stolen via XSS
  Memory (variable) │ ✓              │ ✓               │ ○           │ Lost on reload
  IndexedDB         │ ✗              │ ✓               │ △           │ Can be stolen via XSS

  Recommended pattern:
  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │  Access token: store in memory variable            │
  │  → Difficult to steal even via XSS                │
  │  → Re-obtain via refresh token on reload           │
  │                                                    │
  │  Refresh token: HttpOnly + Secure + SameSite       │
  │  → Stored safely in Cookie                         │
  │  → Not accessible from JavaScript                  │
  │  → Used only at the /api/refresh endpoint          │
  │                                                    │
  └────────────────────────────────────────────────────┘
```

```typescript
// Setting refresh token in Cookie
function setRefreshTokenCookie(res: Response, refreshToken: string) {
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,          // Not accessible from JavaScript
    secure: true,            // HTTPS only
    sameSite: 'strict',      // Send only from the same site
    path: '/api/auth',       // Send only to auth endpoints
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    domain: '.example.com',  // Shared across subdomains
  });
}

// Refresh endpoint
app.post('/api/auth/refresh', async (req, res) => {
  const refreshToken = req.cookies.refresh_token;

  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  try {
    const { accessToken, refreshToken: newRefreshToken } =
      await refreshTokenService.rotateToken(refreshToken);

    // Set new refresh token in Cookie
    setRefreshTokenCookie(res, newRefreshToken);

    // Return access token in response body (kept in memory)
    res.json({ access_token: accessToken, token_type: 'Bearer', expires_in: 900 });
  } catch (error) {
    // Clear Cookie on refresh failure
    res.clearCookie('refresh_token', { path: '/api/auth' });
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Frontend: access token memory management
class TokenManager {
  private accessToken: string | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  setAccessToken(token: string, expiresIn: number) {
    this.accessToken = token;

    // Auto-refresh at 80% of the expiry time
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(
      () => this.refresh(),
      expiresIn * 0.8 * 1000
    );
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  async refresh(): Promise<void> {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include', // Send Cookie
      });

      if (!res.ok) {
        this.accessToken = null;
        window.location.href = '/login';
        return;
      }

      const { access_token, expires_in } = await res.json();
      this.setAccessToken(access_token, expires_in);
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
  }

  // Usage with Axios interceptor
  setupAxiosInterceptor(axios: AxiosInstance) {
    axios.interceptors.request.use((config) => {
      const token = this.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && !error.config._retry) {
          error.config._retry = true;
          await this.refresh();
          error.config.headers.Authorization = `Bearer ${this.getAccessToken()}`;
          return axios(error.config);
        }
        return Promise.reject(error);
      }
    );
  }
}
```

---

## 10. Anti-Patterns

```
JWT implementation anti-patterns:

  ✗ Anti-pattern 1: Using JWT as a session replacement
    → JWT is stateless. If server-side state management is needed,
      use sessions instead
    → JWT blacklist = ultimately requires server-side state anyway
    → Correct choice: API auth → JWT, web session → Cookie session

  ✗ Anti-pattern 2: Including sensitive information in the payload
    → JWT is signature only. Anyone can read it by Base64URL decoding
    → Do not include passwords, SSNs, or credit card numbers
    → Use JWE encryption if necessary

  ✗ Anti-pattern 3: Long-lived access tokens
    → A 24-hour expiry is too long
    → Increases risk in case of leakage
    → Recommended: 15 minutes to 1 hour

  ✗ Anti-pattern 4: Verification without specifying algorithms
    → Vulnerable to alg: "none" attacks and Algorithm Confusion attacks
    → Always specify explicitly, e.g. algorithms: ['ES256']

  ✗ Anti-pattern 5: Access control based solely on JWT payload
    → Allowing critical operations based only on JWT claims
    → All permissions are usable if the token is stolen
    → Require additional authentication (step-up auth) for sensitive operations

  ✗ Anti-pattern 6: Unlimited token size bloat
    → Adding many claims causes size to exceed 8 KB
    → Exceeds HTTP header limits
    → Performance degradation (sent with every request)
```

---

## 11. Performance Optimization

```
JWT performance considerations:

  CPU cost of signing/verification:
  ┌──────────────────────────────────────────────┐
  │                                              │
  │  HS256: ~0.01ms (symmetric key, fastest)     │
  │  ES256: ~0.1ms (elliptic curve, fast)        │
  │  RS256: ~1ms signing / ~0.05ms verification  │
  │  EdDSA: ~0.05ms (fast for both sign/verify)  │
  │                                              │
  │  Considerations for high-traffic (100k req/s): │
  │  → ES256 at 10,000 CPU-ms/s = 10 CPU cores  │
  │  → RS256 signing is a CPU-bound bottleneck   │
  │  → RS256 verification is fast enough        │
  │                                              │
  └──────────────────────────────────────────────┘

  Network cost:
  ┌──────────────────────────────────────────────┐
  │                                              │
  │  Impact of JWT size:                         │
  │  → Typical JWT: 500-800 bytes                │
  │  → Can grow to 2-4 KB with added claims      │
  │  → Sent with every HTTP request → bandwidth impact │
  │                                              │
  │  Countermeasures:                            │
  │  → Keep claims to minimum                    │
  │  → Use ES256/EdDSA (smaller signature size)  │
  │  → Fetch non-essential info separately via /userinfo │
  │                                              │
  └──────────────────────────────────────────────┘
```

```typescript
// Performance measurement utility
async function benchmarkAlgorithms() {
  const algorithms = ['HS256', 'RS256', 'ES256', 'EdDSA'] as const;
  const iterations = 10000;

  for (const alg of algorithms) {
    // Key generation
    let signingKey: any;
    let verifyKey: any;

    if (alg === 'HS256') {
      const secret = new TextEncoder().encode('super-secret-key-at-least-256-bits!!!');
      signingKey = verifyKey = secret;
    } else {
      const options = alg === 'EdDSA' ? { crv: 'Ed25519' as const } : undefined;
      const keys = await generateKeyPair(alg, options);
      signingKey = keys.privateKey;
      verifyKey = keys.publicKey;
    }

    // Signing benchmark
    const signStart = performance.now();
    let token = '';
    for (let i = 0; i < iterations; i++) {
      token = await new SignJWT({ sub: 'user_123', role: 'admin' })
        .setProtectedHeader({ alg })
        .setExpirationTime('15m')
        .sign(signingKey);
    }
    const signTime = (performance.now() - signStart) / iterations;

    // Verification benchmark
    const verifyStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      await jwtVerify(token, verifyKey, { algorithms: [alg] });
    }
    const verifyTime = (performance.now() - verifyStart) / iterations;

    console.log(`${alg}: sign=${signTime.toFixed(3)}ms, verify=${verifyTime.toFixed(3)}ms, size=${token.length}bytes`);
  }
}
```

---

## 12. Exercises

### Exercise 1: Manual JWT Decoding (Basic)

```
Task:
  Decode the following JWT and examine the contents of the header and payload.
  Do not verify the signature; focus on understanding the structure.

  eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.
  eyJzdWIiOiJ1c2VyXzQ1NiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxNzAwMDAwOTAwfQ.
  MEUCIBvFRjy0GhtOm3cqBrRNbMGxmLNXDG3sFrSHVBdZ0sIHAiEA6XnzM0TSXwPNqSf1fXQz0rN3wGpMC2q0aHjB_7nYTqI

  Steps:
  1. Split into three parts on the dot separator
  2. Base64URL-decode each part
  3. Check the alg and typ in the header
  4. Explain the meaning of each claim in the payload
  5. Convert exp to a human-readable datetime
```

```typescript
// Exercise 1 answer template
function exercise1(jwt: string) {
  const parts = jwt.split('.');
  console.log(`Number of parts: ${parts.length}`);

  // Decode header
  const header = JSON.parse(
    Buffer.from(parts[0], 'base64url').toString()
  );
  console.log('Header:', header);

  // Decode payload
  const payload = JSON.parse(
    Buffer.from(parts[1], 'base64url').toString()
  );
  console.log('Payload:', payload);

  // Convert expiry time
  const expDate = new Date(payload.exp * 1000);
  console.log('Expiry:', expDate.toISOString());

  // Signature part (binary data; decoding does not yield a meaningful string)
  console.log('Signature (Base64URL):', parts[2]);
  console.log('Signature size:', Buffer.from(parts[2], 'base64url').length, 'bytes');
}
```

### Exercise 2: Building a Secure JWT Auth API (Applied)

```
Task:
  Using Express + jose, build an authentication API that satisfies the following requirements.

  Requirements:
  1. POST /auth/login: email + password → access_token + refresh_token
  2. POST /auth/refresh: refresh_token → new access_token + new refresh_token
  3. POST /auth/logout: revoke tokens
  4. GET /api/profile: auth required, return user profile

  Security requirements:
  → ES256 algorithm
  → Access token expiry: 15 minutes
  → Refresh token: HttpOnly Cookie, valid for 7 days
  → Blacklist (Redis)
  → Refresh token rotation
  → Appropriate error handling (proper use of 401/403)

  Hints:
  → Use jose library's SignJWT, jwtVerify
  → Cookie settings: httpOnly, secure, sameSite
  → Do not leak specific information on errors
```

### Exercise 3: Inter-Microservice JWT Authentication (Advanced)

```
Task:
  Implement JWKS-based JWT authentication among three microservices
  (Auth, User, Order).

  Architecture:
  ┌──────────┐   ┌──────────┐   ┌──────────┐
  │  Auth    │   │  User    │   │  Order   │
  │  Service │   │  Service │   │  Service │
  │          │   │          │   │          │
  │ Key gen  │   │ JWKS verify│  │ JWKS verify│
  │ JWT issue│   │ aud verify │  │ aud verify │
  │ JWKS pub │   │          │   │          │
  └──────────┘   └──────────┘   └──────────┘
       ↑              │              │
       │ Fetch JWKS    │              │
       └──────────────┴──────────────┘

  Requirements:
  1. Auth Service: JWKS endpoint + JWT issuance
  2. User Service: fetch public key from JWKS, verify aud: "user-api"
  3. Order Service: fetch public key from JWKS, verify aud: "order-api"
  4. Key rotation: generate new key every 30 days
  5. Grace period: old key can verify for 24 hours

  Advanced:
  → Integration with service mesh (Istio)
  → Combining mutual TLS + JWT
  → Scope-based access control
```

### Exercise 4: JWT Security Audit (Advanced)

```
Task:
  Identify all security issues in the code below and fix them.

  // Vulnerable code (identify the problems)
  const jwt = require('jsonwebtoken');

  app.post('/login', (req, res) => {
    const user = db.findUser(req.body.email);
    if (user && req.body.password === user.password) {
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          password: user.password,
          role: user.role,
          creditCard: user.creditCard,
        },
        'secret123',
        { expiresIn: '30d' }
      );
      res.json({ token });
    }
  });

  app.get('/api/data', (req, res) => {
    const token = req.headers.authorization;
    const decoded = jwt.decode(token);
    if (decoded) {
      res.json(getData(decoded.userId));
    }
  });

  Hint: there are at least 10 problems
```

---

## 13. FAQ and Troubleshooting

```
Q1: JWT size is too large to fit in a Cookie
A1: → Send the access token in the Authorization header instead of a Cookie
    → Minimize claims (fetch details via /userinfo)
    → Switch from RS256 to ES256 (1/4 the signature size)
    → Compression is not recommended (risk of BREACH attack)

Q2: Token expiry causes poor user experience
A2: → Silent refresh (auto-update at 80% of expiry)
    → Refresh token + Cookie
    → Background refresh via Service Worker

Q3: Token synchronization across multiple tabs
A3: → Inter-tab communication via BroadcastChannel API
    → Monitor localStorage storage events
    → Sync across all tabs on logout

Q4: JWT verification fails due to clock skew
A4: → Set the clockTolerance parameter (30-60 seconds recommended)
    → Verify NTP synchronization between servers
    → Avoid excessive tolerance (more than 5 minutes is dangerous)

Q5: Suffered an alg: "none" attack in production
A5: → Always specify the algorithms parameter
    → Do not use jwt.decode() for authentication (no verification)
    → Keep library versions up to date
    → Conduct regular security header reviews

Q6: JWKS fetch fails in microservices
A6: → Cache the JWKS response (10-15 minutes)
    → Keep a local copy of the public key as a fallback
    → Apply the circuit breaker pattern
    → Ensure high availability of the JWKS endpoint

Q7: Refresh token is frequently invalidated
A7: → Review your refresh token rotation implementation
    → Suspect concurrent use of the same token (race condition)
    → Implement mutual exclusion (locking) for refresh requests
    → Review token family management
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory but by actually writing code and confirming behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend solidifying your understanding of the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Recommendation |
|------|----------------|
| Algorithm | ES256 (ECDSA) or EdDSA (Ed25519) |
| Expiry | Access: 15 min, Refresh: 7 days |
| Claims | Minimum necessary (sub, role, exp) |
| Verification | Always specify algorithms, issuer, and audience |
| Revocation | Short-lived tokens + blacklist + Token Version |
| Key management | JWKS + regular rotation (30 days) |
| Storage | Access: memory, Refresh: HttpOnly Cookie |
| Encryption | JWE for sensitive data; JWS is sufficient otherwise |
| Size | Keep under 4 KB |
| Library | jose (recommended), jsonwebtoken (legacy) |

---

## Further Reading

---

## References
1. RFC 7519. "JSON Web Token (JWT)." IETF, 2015.
2. RFC 7517. "JSON Web Key (JWK)." IETF, 2015.
3. RFC 7516. "JSON Web Encryption (JWE)." IETF, 2015.
4. RFC 7515. "JSON Web Signature (JWS)." IETF, 2015.
5. RFC 7518. "JSON Web Algorithms (JWA)." IETF, 2015.
6. Auth0. "JWT Handbook." auth0.com, 2024.
7. OWASP. "JSON Web Token Cheat Sheet." cheatsheetseries.owasp.org, 2024.
8. IETF. "JSON Web Token Best Current Practices." RFC 8725, 2020.
9. Neil Madden. "API Security in Action." Manning, 2020.
10. Daniel Vassallo. "JWT Security Best Practices." blog, 2024.

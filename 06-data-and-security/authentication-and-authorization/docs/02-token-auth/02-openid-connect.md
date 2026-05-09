# OpenID Connect

> OpenID Connect (OIDC) is an authentication layer built on top of OAuth 2.0. While OAuth 2.0 is a protocol for "authorization," OIDC standardizes "authentication." This guide covers ID Tokens, the UserInfo endpoint, Discovery, and the foundation of social login.

## Prerequisites

- Basic concepts of OAuth 2.0 (authorization code flow, access tokens)
- HTTP fundamentals (redirects, headers)

## What You Will Learn

- [ ] Understand the relationship between OAuth 2.0 and OIDC, and their fundamental differences
- [ ] Fully grasp the structure, claims, and validation flow of ID Tokens
- [ ] Learn how OIDC Discovery works and how to use it
- [ ] Understand the mapping between standard scopes and claims
- [ ] Master a complete implementation of the OIDC authentication flow
- [ ] Understand the differences and caveats of major providers
- [ ] Be able to avoid common OIDC security pitfalls

---

## 1. The Relationship Between OIDC and OAuth 2.0

### 1.1 Why OIDC Is Needed

OAuth 2.0 was originally designed for "Authorization," not "Authentication." An access token obtained via OAuth 2.0 means "grant the holder of this token access to the resource," but it does not guarantee "who the holder of this token is."

Many developers repurposed OAuth 2.0 for authentication (the so-called "OAuth Dance"), which introduced security vulnerabilities. OIDC resolves this problem by adding a standardized authentication layer on top of OAuth 2.0.

```
OAuth 2.0 vs OpenID Connect:

  OAuth 2.0:
  → Purpose: Authorization
  → Question: "What do you permit this app to do?"
  → Result: Access token (for resource access)
  → Does not guarantee who the user is
  → RFC 6749, 6750

  OpenID Connect:
  → Purpose: Authentication
  → Question: "Who are you?"
  → Result: ID Token (user information) + Access token
  → Guarantees the user's identity
  → OpenID Connect Core 1.0

  Relationship:
  ┌──────────────────────────────────┐
  │         OpenID Connect           │
  │  ┌──────────────────────────┐    │
  │  │       OAuth 2.0          │    │
  │  │  （認可フレームワーク）     │    │
  │  └──────────────────────────┘    │
  │  + ID Token（認証）              │
  │  + UserInfo エンドポイント        │
  │  + Discovery                    │
  │  + Dynamic Registration         │
  │  + Session Management           │
  │  + Front-Channel Logout         │
  │  + Back-Channel Logout          │
  └──────────────────────────────────┘

  OIDC = OAuth 2.0 + Standardized Authentication
```

### 1.2 Problems When Using OAuth 2.0 for Authentication

```
Vulnerabilities when attempting authentication with OAuth 2.0:

  Problem 1: Token Substitution Attack
  ┌────────────────────────────────────────────┐
  │                                            │
  │  Legitimate flow:                          │
  │    User → App A → IdP → Access Token       │
  │    App A calls /userinfo with Access Token  │
  │    → User info retrieved (OK)              │
  │                                            │
  │  Attack flow:                              │
  │    Attacker → Malicious App B → IdP → Access Token │
  │    Attacker steals App B's Access Token    │
  │    Sends that token to App A               │
  │    App A calls /userinfo → gets attacker's info │
  │    → Attacker logs into App A (NG!)        │
  │                                            │
  │  OIDC solution:                            │
  │    The aud claim in the ID Token validates │
  │    "which client is this intended for"     │
  │    → Tokens for other clients are rejected │
  │                                            │
  └────────────────────────────────────────────┘

  Problem 2: Opacity of Access Token
  → The format of Access Tokens is not specified
  → May be JWT or opaque
  → No guarantee that user information is included

  Problem 3: No Guarantee of Authentication Time
  → Access Tokens do not include authentication time
  → Old Access Tokens may be reused
  → Resolved by the auth_time claim in OIDC

  Problem 4: Replay Attacks
  → Access Tokens have no replay prevention mechanism
  → Resolved by the nonce claim in OIDC
```

---

## 2. ID Token

### 2.1 Structure of an ID Token

An ID Token is in JWT (JSON Web Token) format and contains user authentication information. Unlike access tokens, it is intended to be consumed within the client application.

```
ID Token Structure (JWT):

  ┌─────────────────────────────────────────────────┐
  │  Header                                          │
  │  {                                               │
  │    "alg": "RS256",       ← Signing algorithm     │
  │    "typ": "JWT",                                 │
  │    "kid": "key-id-123"   ← Signing key ID        │
  │  }                                               │
  ├─────────────────────────────────────────────────┤
  │  Payload                                         │
  │  {                                               │
  │    // Required claims                            │
  │    "iss": "https://accounts.google.com",         │
  │    "sub": "110169484474386276334",               │
  │    "aud": "my-client-id",                        │
  │    "exp": 1700000000,                            │
  │    "iat": 1699999100,                            │
  │                                                  │
  │    // Authentication info claims                 │
  │    "auth_time": 1699999000,                      │
  │    "nonce": "random-nonce-value",                │
  │    "acr": "urn:mace:incommon:iap:silver",        │
  │    "amr": ["pwd", "mfa"],                        │
  │    "azp": "my-client-id",                        │
  │                                                  │
  │    // User info claims                           │
  │    "email": "alice@example.com",                 │
  │    "email_verified": true,                       │
  │    "name": "Alice Example",                      │
  │    "picture": "https://example.com/alice.jpg",   │
  │    "locale": "ja"                                │
  │  }                                               │
  ├─────────────────────────────────────────────────┤
  │  Signature                                       │
  │  RS256(base64(header).base64(payload), secret)   │
  └─────────────────────────────────────────────────┘

  Required claim descriptions:
    iss (Issuer):     URL of the token issuer
    sub (Subject):    Unique user identifier (unique within the IdP)
    aud (Audience):   Target client ID for this token
    exp (Expiration): Expiration time (UNIX timestamp)
    iat (Issued At):  Issuance time (UNIX timestamp)

  Important optional claims:
    auth_time:  Time at which authentication actually occurred
    nonce:      Random value for replay attack prevention
    acr:        Authentication Context Class (authentication level)
    amr:        List of authentication methods used
    azp:        Authorized party (client_id)

  Access Token vs ID Token:
    Access Token: Used for API access (sent to resource server)
    ID Token:     Used to verify user info (consumed within the client)

    ✗ Do not use ID Token for API access
    ✗ Do not retrieve user info from Access Token
    ✗ Do not send ID Token to the resource server
```

### 2.2 Validating an ID Token

Validating an ID Token is the cornerstone of OIDC security; all of the following steps must be performed without omission.

```
Complete procedure for ID Token validation:

  Step 1: Validate the JWT format
    → Can it be split into 3 Base64URL-encoded parts?
    → Is the alg in the header the expected algorithm (e.g., RS256)?
    → Never accept the "none" algorithm

  Step 2: Verify the signature
    → Verify using the IdP's public key (JWKS endpoint)
    → Select the correct key using the kid header
    → Handle key rotation (cache + fallback)

  Step 3: Validate iss (issuer)
    → Does it exactly match the expected IdP URL?
    → Example: "https://accounts.google.com"

  Step 4: Validate aud (audience)
    → Is your client_id included?
    → If multiple aud values exist, also validate azp

  Step 5: Validate exp (expiration)
    → Is the current time before exp?
    → Allow for clock skew (typically 5-minute tolerance)

  Step 6: Validate iat (issued at) — recommended
    → Is it not in the future?
    → Is it not an extremely old timestamp?

  Step 7: Validate nonce (if sent in the authentication request)
    → Does it match the nonce stored in the session?
    → Prevents replay attacks

  Step 8: Validate auth_time (if max_age was specified)
    → Is the authentication time within max_age?
    → Example: Require authentication within the last hour
```

```typescript
// ID Token の完全な検証実装
import { jwtVerify, createRemoteJWKSet, JWTVerifyResult } from 'jose';

// Google の JWKS URL
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs')
);

// JWKS のキャッシュ設定（jose ライブラリ内蔵）
// デフォルトで鍵はキャッシュされ、kid が見つからない場合に再取得される

interface VerifiedIdToken {
  sub: string;
  email: string;
  name: string;
  picture: string;
  emailVerified: boolean;
  authTime?: number;
  amr?: string[];
}

async function verifyIdToken(
  idToken: string,
  expectedNonce: string,
  options?: {
    maxAge?: number; // 秒
    requiredAmr?: string[]; // 必要な認証方式
  }
): Promise<VerifiedIdToken> {
  // Step 1-5: jose ライブラリが自動で検証
  // - JWT 形式チェック
  // - 署名検証（JWKS から公開鍵を取得）
  // - issuer の検証
  // - audience の検証
  // - exp の検証
  let result: JWTVerifyResult;
  try {
    result = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: 'https://accounts.google.com',
      audience: process.env.GOOGLE_CLIENT_ID!,
      algorithms: ['RS256'],
      clockTolerance: 5, // 5秒のクロックスキュー許容
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`ID Token verification failed: ${error.message}`);
    }
    throw error;
  }

  const { payload } = result;

  // Step 6: iat の追加検証
  if (payload.iat && payload.iat > Date.now() / 1000 + 5) {
    throw new Error('ID Token was issued in the future');
  }

  // Step 7: nonce の検証（リプレイ攻撃防止）
  if (payload.nonce !== expectedNonce) {
    throw new Error('Invalid nonce - possible replay attack');
  }

  // Step 8: auth_time の検証（max_age が指定された場合）
  if (options?.maxAge) {
    const authTime = payload.auth_time as number | undefined;
    if (!authTime) {
      throw new Error('auth_time claim is required when maxAge is specified');
    }
    if (Date.now() / 1000 - authTime > options.maxAge) {
      throw new Error(
        `Authentication is too old (${Math.floor(Date.now() / 1000 - authTime)}s > ${options.maxAge}s)`
      );
    }
  }

  // 追加: amr（認証方式）の検証
  if (options?.requiredAmr) {
    const amr = payload.amr as string[] | undefined;
    if (!amr) {
      throw new Error('amr claim is required');
    }
    for (const required of options.requiredAmr) {
      if (!amr.includes(required)) {
        throw new Error(`Required authentication method not used: ${required}`);
      }
    }
  }

  return {
    sub: payload.sub!,
    email: payload.email as string,
    name: payload.name as string,
    picture: payload.picture as string,
    emailVerified: payload.email_verified as boolean,
    authTime: payload.auth_time as number | undefined,
    amr: payload.amr as string[] | undefined,
  };
}
```

### 2.3 How JWKS (JSON Web Key Set) Works

```
How JWKS works:

  The IdP publishes public keys at the JWKS endpoint:
  GET https://www.googleapis.com/oauth2/v3/certs

  Response:
  {
    "keys": [
      {
        "kty": "RSA",           ← Key type
        "alg": "RS256",         ← Algorithm
        "kid": "key-id-1",      ← Key ID (matches the kid header in JWT)
        "use": "sig",           ← Usage (signature)
        "n": "0vx7a...",        ← RSA public key modulus
        "e": "AQAB"             ← RSA public key exponent
      },
      {
        "kty": "RSA",
        "alg": "RS256",
        "kid": "key-id-2",      ← Next key (for rotation)
        "use": "sig",
        "n": "1wy8b...",
        "e": "AQAB"
      }
    ]
  }

  Key rotation:
  ┌──────────────────────────────────────────────┐
  │                                              │
  │  Time 0: key-1 is active                     │
  │    → New ID Tokens are signed with key-1     │
  │                                              │
  │  Time 1: key-2 is added (2 keys in JWKS)     │
  │    → New ID Tokens are signed with key-2     │
  │    → Older tokens signed with key-1 still valid │
  │                                              │
  │  Time 2: key-1 is removed                   │
  │    → Tokens signed with key-1 cannot be verified │
  │    → Those tokens are expired, so no problem │
  │                                              │
  └──────────────────────────────────────────────┘

  Client-side handling:
  → Cache JWKS (typically 24 hours)
  → Re-fetch JWKS if kid is not found
  → Respect Cache-Control headers
```

```typescript
// JWKS キャッシュの手動実装（jose ライブラリ内蔵のキャッシュを使わない場合）
class JWKSCache {
  private keys: Map<string, CryptoKey> = new Map();
  private lastFetch: number = 0;
  private readonly cacheDuration = 24 * 60 * 60 * 1000; // 24時間

  constructor(private jwksUrl: string) {}

  async getKey(kid: string): Promise<CryptoKey> {
    // キャッシュにある場合はそれを返す
    if (this.keys.has(kid) && Date.now() - this.lastFetch < this.cacheDuration) {
      return this.keys.get(kid)!;
    }

    // JWKS を再取得
    await this.refresh();

    const key = this.keys.get(kid);
    if (!key) {
      throw new Error(`Key with kid "${kid}" not found in JWKS`);
    }

    return key;
  }

  private async refresh(): Promise<void> {
    const res = await fetch(this.jwksUrl);
    const jwks = await res.json();

    this.keys.clear();
    for (const jwk of jwks.keys) {
      const key = await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
      );
      this.keys.set(jwk.kid, key);
    }

    this.lastFetch = Date.now();
  }
}
```

---

## 3. OIDC Discovery

### 3.1 How Discovery Works

OpenID Connect Discovery is a mechanism for automatically retrieving an IdP's configuration in a standardized format. This eliminates the need to hardcode endpoint URLs and allows automatic adaptation to IdP changes.

```
OpenID Connect Discovery:

  Automatically retrieve provider configuration:
  GET https://accounts.google.com/.well-known/openid-configuration

  Response:
  {
    // Basic information
    "issuer": "https://accounts.google.com",

    // Endpoints
    "authorization_endpoint": "https://accounts.google.com/o/oauth2/v2/auth",
    "token_endpoint": "https://oauth2.googleapis.com/token",
    "userinfo_endpoint": "https://openidconnect.googleapis.com/v1/userinfo",
    "jwks_uri": "https://www.googleapis.com/oauth2/v3/certs",
    "revocation_endpoint": "https://oauth2.googleapis.com/revoke",

    // Supported features
    "scopes_supported": ["openid", "email", "profile"],
    "response_types_supported": ["code", "token", "id_token", "code token",
                                  "code id_token", "token id_token",
                                  "code token id_token"],
    "response_modes_supported": ["query", "fragment", "form_post"],
    "grant_types_supported": ["authorization_code", "implicit",
                               "refresh_token"],
    "subject_types_supported": ["public"],

    // Signing and encryption
    "id_token_signing_alg_values_supported": ["RS256"],
    "token_endpoint_auth_methods_supported": ["client_secret_post",
                                              "client_secret_basic"],

    // Claims
    "claims_supported": ["sub", "email", "email_verified",
                          "name", "given_name", "family_name",
                          "picture", "locale"]
  }

  Benefits of Discovery:
  → No hardcoded endpoint URLs
  → Automatically adapts to provider changes
  → Centralized management of multiple providers
  → Dynamic confirmation of supported features
  → Automatically adapts to IdP version upgrades
```

### 3.2 Implementing a Generic OIDC Provider

```typescript
// OIDC Discovery を活用した汎用プロバイダー
interface OIDCConfig {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  scopes_supported: string[];
  response_types_supported: string[];
  id_token_signing_alg_values_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  claims_supported: string[];
  revocation_endpoint?: string;
  end_session_endpoint?: string;
}

class OIDCProvider {
  private config: OIDCConfig | null = null;
  private configFetchedAt: number = 0;
  private readonly configCacheDuration = 24 * 60 * 60 * 1000; // 24時間

  constructor(
    private issuerUrl: string,
    private clientId: string,
    private clientSecret: string
  ) {}

  // Discovery で設定を取得（キャッシュ付き）
  async discover(): Promise<OIDCConfig> {
    if (
      this.config &&
      Date.now() - this.configFetchedAt < this.configCacheDuration
    ) {
      return this.config;
    }

    const url = `${this.issuerUrl}/.well-known/openid-configuration`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`OIDC Discovery failed: ${res.status} ${res.statusText}`);
    }

    this.config = await res.json();
    this.configFetchedAt = Date.now();

    // issuer の一致を検証
    if (this.config!.issuer !== this.issuerUrl) {
      throw new Error(
        `Issuer mismatch: expected ${this.issuerUrl}, got ${this.config!.issuer}`
      );
    }

    return this.config!;
  }

  // 認可 URL を生成
  async getAuthorizationUrl(
    redirectUri: string,
    state: string,
    nonce: string,
    options?: {
      scope?: string;
      prompt?: 'none' | 'login' | 'consent' | 'select_account';
      loginHint?: string;
      maxAge?: number;
      acrValues?: string;
    }
  ): Promise<string> {
    const config = await this.discover();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: options?.scope || 'openid email profile',
      state,
      nonce,
    });

    // オプションパラメータ
    if (options?.prompt) params.set('prompt', options.prompt);
    if (options?.loginHint) params.set('login_hint', options.loginHint);
    if (options?.maxAge !== undefined) params.set('max_age', String(options.maxAge));
    if (options?.acrValues) params.set('acr_values', options.acrValues);

    return `${config.authorization_endpoint}?${params}`;
  }

  // トークン交換
  async exchangeCode(
    code: string,
    redirectUri: string
  ): Promise<{
    accessToken: string;
    idToken: string;
    refreshToken?: string;
    expiresIn: number;
    tokenType: string;
  }> {
    const config = await this.discover();
    const res = await fetch(config.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(
        `Token exchange failed: ${error.error} - ${error.error_description}`
      );
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
    };
  }

  // UserInfo エンドポイント
  async getUserInfo(accessToken: string): Promise<Record<string, any>> {
    const config = await this.discover();
    const res = await fetch(config.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`UserInfo request failed: ${res.status}`);
    }

    return res.json();
  }

  // トークンの無効化
  async revokeToken(token: string, tokenTypeHint?: 'access_token' | 'refresh_token') {
    const config = await this.discover();
    if (!config.revocation_endpoint) {
      throw new Error('Revocation endpoint not supported');
    }

    const body = new URLSearchParams({
      token,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    if (tokenTypeHint) body.set('token_type_hint', tokenTypeHint);

    await fetch(config.revocation_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  }

  // OIDC ログアウト
  async getLogoutUrl(idTokenHint: string, postLogoutRedirectUri: string): Promise<string | null> {
    const config = await this.discover();
    if (!config.end_session_endpoint) return null;

    const params = new URLSearchParams({
      id_token_hint: idTokenHint,
      post_logout_redirect_uri: postLogoutRedirectUri,
      client_id: this.clientId,
    });

    return `${config.end_session_endpoint}?${params}`;
  }
}

// 使用例: 複数プロバイダーの一元管理
const providers = {
  google: new OIDCProvider(
    'https://accounts.google.com',
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!
  ),
  microsoft: new OIDCProvider(
    'https://login.microsoftonline.com/common/v2.0',
    process.env.MICROSOFT_CLIENT_ID!,
    process.env.MICROSOFT_CLIENT_SECRET!
  ),
  auth0: new OIDCProvider(
    `https://${process.env.AUTH0_DOMAIN}`,
    process.env.AUTH0_CLIENT_ID!,
    process.env.AUTH0_CLIENT_SECRET!
  ),
};
```

---

## 4. OIDC Scopes and Claims

### 4.1 Mapping of Standard Scopes to Claims

```
Standard scopes:

  Scope    │ Claims returned
  ─────────┼──────────────────────────────
  openid   │ sub (required scope)
  profile  │ name, family_name, given_name,
           │ middle_name, nickname, picture,
           │ preferred_username, website,
           │ gender, birthdate, zoneinfo,
           │ locale, updated_at
  email    │ email, email_verified
  address  │ address (structured address)
  phone    │ phone_number, phone_number_verified

  Recommended minimum:
  scope: "openid email profile"
  → User ID + email + name and avatar

  Structure of the address claim:
  {
    "formatted": "東京都千代田区...",
    "street_address": "千代田区...",
    "locality": "東京都",
    "region": "関東",
    "postal_code": "100-0001",
    "country": "JP"
  }

UserInfo endpoint vs ID Token:
  ID Token:   Contains minimal information at authentication time
  UserInfo:   Retrieves detailed profile information
  Usage:      Authenticate with ID Token, retrieve additional info with UserInfo

  Claims included in ID Token:
  → Minimum information required for authentication
  → iss, sub, aud, exp, iat, nonce
  → Additional information at the provider's discretion

  Claims retrieved from UserInfo:
  → Detailed information requested via scope
  → Profile photo, address, phone number, etc.
  → Retrieved by authenticating with Access Token

  Note:
  → Information in the ID Token is a snapshot at authentication time
  → UserInfo returns the latest information
  → Use UserInfo for updated user information
```

### 4.2 Custom Claims

```typescript
// Auth0 でカスタムクレームを追加する例
// Auth0 の Action / Rule で設定

// Action: Login / Post Login
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://myapp.com/claims';

  // カスタムクレームを ID Token に追加
  api.idToken.setCustomClaim(`${namespace}/roles`, event.authorization?.roles || []);
  api.idToken.setCustomClaim(`${namespace}/org_id`, event.user.app_metadata?.org_id);
  api.idToken.setCustomClaim(`${namespace}/permissions`, event.authorization?.permissions || []);

  // Access Token にもカスタムクレームを追加
  api.accessToken.setCustomClaim(`${namespace}/roles`, event.authorization?.roles || []);
};

// クライアント側でカスタムクレームを使用
interface CustomIdTokenClaims {
  sub: string;
  email: string;
  name: string;
  'https://myapp.com/claims/roles': string[];
  'https://myapp.com/claims/org_id': string;
  'https://myapp.com/claims/permissions': string[];
}

function extractCustomClaims(payload: any): {
  roles: string[];
  orgId: string;
  permissions: string[];
} {
  const namespace = 'https://myapp.com/claims';
  return {
    roles: payload[`${namespace}/roles`] || [],
    orgId: payload[`${namespace}/org_id`] || '',
    permissions: payload[`${namespace}/permissions`] || [],
  };
}
```

---

## 5. Complete Authentication Flow Implementation

### 5.1 Authorization Code Flow + PKCE

The recommended authentication flow for OIDC is the Authorization Code Flow with PKCE (Proof Key for Code Exchange).

```
OIDC Authorization Code Flow + PKCE:

  Browser           Server            IdP
    │                │                │
    │  Click login   │                │
    │───────────────>│                │
    │                │                │
    │                │ Generate code_verifier │
    │                │ code_challenge         │
    │                │ = SHA256(              │
    │                │   code_verifier)       │
    │                │                │
    │                │ Generate state, nonce  │
    │                │ Save to session        │
    │                │                │
    │  302 Redirect  │                │
    │<───────────────│                │
    │                                 │
    │  GET /authorize?                │
    │   response_type=code            │
    │   client_id=xxx                 │
    │   redirect_uri=xxx              │
    │   scope=openid email profile    │
    │   state=xxx                     │
    │   nonce=xxx                     │
    │   code_challenge=xxx            │
    │   code_challenge_method=S256    │
    │────────────────────────────────>│
    │                                 │
    │         Login screen            │
    │<────────────────────────────────│
    │  Enter credentials              │
    │────────────────────────────────>│
    │                                 │
    │  302 Redirect                   │
    │  ?code=AUTH_CODE&state=xxx      │
    │<────────────────────────────────│
    │                                 │
    │  GET /callback                  │
    │   ?code=AUTH_CODE               │
    │   &state=xxx                    │
    │───────────────>│                │
    │                │                │
    │                │  Validate state │
    │                │                │
    │                │  POST /token    │
    │                │   code=AUTH_CODE│
    │                │   code_verifier │
    │                │────────────────>│
    │                │                │
    │                │  ID Token +     │
    │                │  Access Token   │
    │                │<────────────────│
    │                │                │
    │                │  Validate ID Token │
    │                │  Validate nonce    │
    │                │  Create session    │
    │                │                │
    │  Set-Cookie    │                │
    │<───────────────│                │
```

### 5.2 Complete Implementation with Next.js

```typescript
// OIDC 認証フロー（Next.js App Router）
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify, createRemoteJWKSet } from 'jose';

// PKCE: code_verifier と code_challenge の生成
function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  // code_verifier: 43-128文字のランダム文字列
  const codeVerifier = crypto.randomBytes(32).toString('base64url');

  // code_challenge: SHA256(code_verifier) の Base64URL エンコード
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return { codeVerifier, codeChallenge };
}

// GET /api/auth/login — 認証開始
export async function GET(request: Request) {
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const { codeVerifier, codeChallenge } = generatePKCE();

  // セッションに state, nonce, code_verifier を保存
  const cookieStore = await cookies();
  cookieStore.set('oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10分
    path: '/',
  });
  cookieStore.set('oauth_nonce', nonce, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  cookieStore.set('oauth_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  // 認可リクエスト URL の構築
  const provider = providers.google;
  const authUrl = await provider.getAuthorizationUrl(
    `${process.env.APP_URL}/api/auth/callback`,
    state,
    nonce,
    {
      prompt: 'select_account', // アカウント選択画面を表示
    }
  );

  // PKCE パラメータを追加
  const url = new URL(authUrl);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');

  return Response.redirect(url.toString());
}

// GET /api/auth/callback — コールバック処理
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // エラーチェック（ユーザーがキャンセルした場合等）
  if (error) {
    const errorDescription = url.searchParams.get('error_description') || 'Unknown error';
    console.error(`OIDC error: ${error} - ${errorDescription}`);
    return Response.redirect(`${process.env.APP_URL}/login?error=${error}`);
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get('oauth_state')?.value;
  const storedNonce = cookieStore.get('oauth_nonce')?.value;
  const codeVerifier = cookieStore.get('oauth_code_verifier')?.value;

  // state 検証（CSRF 防止）
  if (!code || !state || state !== storedState) {
    return Response.redirect(`${process.env.APP_URL}/login?error=invalid_state`);
  }

  if (!storedNonce || !codeVerifier) {
    return Response.redirect(`${process.env.APP_URL}/login?error=missing_session`);
  }

  try {
    // トークン交換（code_verifier を含む）
    const tokens = await providers.google.exchangeCode(
      code,
      `${process.env.APP_URL}/api/auth/callback`
    );

    // ID Token 検証
    const userInfo = await verifyIdToken(tokens.idToken, storedNonce, {
      maxAge: 3600, // 1時間以内の認証を要求
    });

    // ユーザーの作成 or 更新（Upsert）
    const dbUser = await prisma.user.upsert({
      where: {
        provider_providerId: {
          provider: 'google',
          providerId: userInfo.sub,
        },
      },
      create: {
        email: userInfo.email,
        name: userInfo.name,
        avatar: userInfo.picture,
        provider: 'google',
        providerId: userInfo.sub,
        emailVerified: userInfo.emailVerified ? new Date() : null,
      },
      update: {
        name: userInfo.name,
        avatar: userInfo.picture,
        emailVerified: userInfo.emailVerified ? new Date() : null,
        lastLoginAt: new Date(),
      },
    });

    // セッション作成
    const sessionToken = await createSession(dbUser.id);

    // Cookie クリーンアップ
    cookieStore.delete('oauth_state');
    cookieStore.delete('oauth_nonce');
    cookieStore.delete('oauth_code_verifier');

    // セッション Cookie 設定
    cookieStore.set('session', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30日
      path: '/',
    });

    return Response.redirect(`${process.env.APP_URL}/dashboard`);
  } catch (error) {
    console.error('OIDC callback error:', error);
    return Response.redirect(`${process.env.APP_URL}/login?error=auth_failed`);
  }
}

// GET /api/auth/logout — ログアウト
export async function GET(request: Request) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;

  if (sessionToken) {
    // セッション削除
    await deleteSession(sessionToken);

    // IdP のログアウト URL を取得（オプション）
    const logoutUrl = await providers.google.getLogoutUrl(
      sessionToken, // ID Token Hint（保存している場合）
      `${process.env.APP_URL}/`
    );

    cookieStore.delete('session');

    if (logoutUrl) {
      return Response.redirect(logoutUrl);
    }
  }

  return Response.redirect(`${process.env.APP_URL}/`);
}
```

### 5.3 Account Linking (Multi-Provider Support)

```typescript
// 同一ユーザーが複数のプロバイダーでログインする場合
// schema.prisma のモデル設計

// model User {
//   id            String    @id @default(cuid())
//   email         String    @unique
//   name          String?
//   avatar        String?
//   accounts      Account[]
//   sessions      Session[]
// }
//
// model Account {
//   id                String  @id @default(cuid())
//   userId            String
//   provider          String  // "google", "github", "microsoft"
//   providerAccountId String  // IdP 側のユーザー ID
//   accessToken       String?
//   refreshToken      String?
//   expiresAt         Int?
//   tokenType         String?
//   scope             String?
//   idToken           String?
//
//   user User @relation(fields: [userId], references: [id])
//
//   @@unique([provider, providerAccountId])
// }

// アカウントリンクの実装
async function handleOIDCCallback(
  provider: string,
  userInfo: VerifiedIdToken,
  tokens: TokenResponse
) {
  // 1. 既存のアカウントリンクを確認
  const existingAccount = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId: userInfo.sub,
      },
    },
    include: { user: true },
  });

  if (existingAccount) {
    // 既存アカウントでログイン
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresIn ? Math.floor(Date.now() / 1000) + tokens.expiresIn : null,
        idToken: tokens.idToken,
      },
    });
    return existingAccount.user;
  }

  // 2. メールアドレスで既存ユーザーを検索
  if (userInfo.email && userInfo.emailVerified) {
    const existingUser = await prisma.user.findUnique({
      where: { email: userInfo.email },
    });

    if (existingUser) {
      // 既存ユーザーに新しいプロバイダーをリンク
      await prisma.account.create({
        data: {
          userId: existingUser.id,
          provider,
          providerAccountId: userInfo.sub,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          idToken: tokens.idToken,
        },
      });
      return existingUser;
    }
  }

  // 3. 新規ユーザー作成
  const newUser = await prisma.user.create({
    data: {
      email: userInfo.email,
      name: userInfo.name,
      avatar: userInfo.picture,
      accounts: {
        create: {
          provider,
          providerAccountId: userInfo.sub,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          idToken: tokens.idToken,
        },
      },
    },
  });

  return newUser;
}
```

---

## 6. Characteristics and Caveats of Major Providers

### 6.1 Provider Comparison

```
OIDC provider comparison:

  Provider   │ Discovery │ PKCE │ Refresh │ Notes
  ────────────┼──────────┼─────┼────────┼──────────────
  Google      │ ✓        │ ✓   │ ✓      │ Most standards-compliant
  Microsoft   │ ✓        │ ✓   │ ✓      │ Tenant-specific issuer
  Apple       │ ✓        │ ✓   │ ✓      │ name returned on first login only
  GitHub      │ △        │ ✓   │ ✓      │ Non-compliant with standard OIDC
  LINE        │ ✓        │ ✗   │ ✓      │ Important in the Japanese market
  Auth0       │ ✓        │ ✓   │ ✓      │ Highly customizable
  Keycloak    │ ✓        │ ✓   │ ✓      │ Self-hostable
  Okta        │ ✓        │ ✓   │ ✓      │ Geared toward enterprises
```

### 6.2 Caveats for Each Provider

```
Apple Sign In caveats:
  → name / email are only returned on the first authorization
  → On subsequent logins, only sub is returned (including after app reinstall)
  → The first-login response must be saved reliably
  → On the web, only the redirect method is available (popup may not work)
  → Apps published on the App Store must support Apple Sign In
  → Users can hide their email (relay email)
  → The client_secret must be self-generated in JWT format

  How Apple's email hiding works:
  ┌──────────────────────────────────────────┐
  │                                          │
  │  When the user selects "Hide My Email"   │
  │                                          │
  │  Email provided:                         │
  │  abc123@privaterelay.appleid.com         │
  │                                          │
  │  Emails sent to this address are         │
  │  forwarded to the user's real email      │
  │                                          │
  │  Notes:                                  │
  │  → Your domain must be registered with Apple │
  │  → SPF/DKIM configuration is required   │
  │  → Relay emails may not be permanent     │
  │                                          │
  └──────────────────────────────────────────┘

GitHub caveats:
  → Uses its own OAuth implementation, not standard OIDC
  → Does not return an ID Token (retrieve via /user API)
  → email may be null (if set to private)
  → Must call GET /user/emails API separately
  → No Discovery endpoint (or limited)
  → Scopes use GitHub-specific format like "user:email"

Microsoft / Azure AD caveats:
  → Tenant-specific issuer URL
  → common: https://login.microsoftonline.com/common/v2.0
  → Specific tenant: https://login.microsoftonline.com/{tenant-id}/v2.0
  → The iss in the ID Token includes the tenant ID
  → Behavior differs between personal accounts (MSA) and org accounts (AAD)
  → There are v1.0 and v2.0 endpoints (use v2.0)
```

### 6.3 Handling GitHub's Non-Compliance with OIDC

```typescript
// GitHub は標準 OIDC ではないため、独自実装が必要
class GitHubOAuthProvider {
  private readonly authUrl = 'https://github.com/login/oauth/authorize';
  private readonly tokenUrl = 'https://github.com/login/oauth/access_token';
  private readonly apiUrl = 'https://api.github.com';

  constructor(
    private clientId: string,
    private clientSecret: string
  ) {}

  getAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: 'user:email read:user',
      state,
    });
    return `${this.authUrl}?${params}`;
  }

  async exchangeCode(code: string): Promise<string> {
    const res = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
      }),
    });

    const data = await res.json();
    if (data.error) {
      throw new Error(`GitHub token exchange failed: ${data.error_description}`);
    }
    return data.access_token;
  }

  // GitHub の /user API でユーザー情報取得（ID Token の代替）
  async getUser(accessToken: string) {
    const [userRes, emailsRes] = await Promise.all([
      fetch(`${this.apiUrl}/user`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      fetch(`${this.apiUrl}/user/emails`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);

    const user = await userRes.json();
    const emails: Array<{ email: string; primary: boolean; verified: boolean }> =
      await emailsRes.json();

    // プライマリかつ認証済みメールを取得
    const primaryEmail = emails.find((e) => e.primary && e.verified);

    return {
      sub: String(user.id),
      email: primaryEmail?.email || user.email,
      emailVerified: primaryEmail?.verified ?? false,
      name: user.name || user.login,
      picture: user.avatar_url,
      login: user.login, // GitHub 固有: ユーザー名
    };
  }
}
```

---

## 7. Edge Cases and Security

### 7.1 Edge Cases

```
OIDC edge cases:

  (1) Email address changes
     → When the user changes their email on the IdP side
     → sub remains the same, but the email changes
     → Use sub as the primary key
     → Either don't use email as a unique constraint, or track updates

  (2) Account deletion and recreation
     → User deletes their IdP account and recreates it
     → Google: sub may change even with the same email
     → Apple: sub is persistent (even after device reset)
     → Identify by the combination of sub + provider

  (3) Token expiration and refresh
     → Access Token expires
     → Silent refresh using Refresh Token
     → If Refresh Token also expires, require re-authentication

  (4) Concurrent authentication in multiple tabs
     → Login flow started simultaneously in multiple tabs
     → Different state/nonce values cause one to fail
     → State stored in Cookie (last value wins)
     → Mitigation: block other tabs during login, or share state

  (5) IdP downtime
     → Discovery endpoint is not responding
     → JWKS endpoint is not responding
     → Temporarily handle with cached config and keys
     → Provide a fallback authentication method
```

### 7.2 Security Best Practices

```
OIDC security best practices:

  ✓ Must always do:
    → Use the state parameter to prevent CSRF
    → Use the nonce parameter to prevent replay attacks
    → Use PKCE (especially for public clients)
    → Validate all claims in the ID Token
    → Require HTTPS
    → Validate redirect_uri strictly (exact match)
    → Manage client_secret securely

  ✗ Must avoid:
    → Using ID Token for API access
    → Authenticating users with Access Token
    → Using Implicit Flow (deprecated)
    → Wildcards in redirect_uri
    → Including client_secret in the frontend
    → Using ID Token payload without validation
    → Accepting the "none" algorithm

  redirect_uri attacks:
  ┌────────────────────────────────────────┐
  │                                        │
  │  Open Redirect attack:                 │
  │    Attacker rewrites redirect_uri to   │
  │    point to their own server           │
  │    → Authorization code is sent to attacker │
  │                                        │
  │  Mitigation:                           │
  │    → Only allow registered redirect_uri │
  │    → Validate with exact match (no prefix match) │
  │    → Wildcards are prohibited          │
  │    → Allow localhost only during debugging │
  │                                        │
  └────────────────────────────────────────┘
```

### 7.3 Preventing Token Leakage

```typescript
// トークン漏洩の防止策

// 1. Authorization Code は1回のみ使用可能
// → IdP 側で実装されているが、クライアント側でも確認

// 2. Token をログに出力しない
function safeLog(message: string, data: any) {
  const sanitized = { ...data };
  const sensitiveFields = ['access_token', 'id_token', 'refresh_token', 'code', 'client_secret'];
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = `[REDACTED:${sanitized[field].length}chars]`;
    }
  }
  console.log(message, sanitized);
}

// 3. Referrer-Policy で Token の漏洩を防止
// HTTP ヘッダー:
// Referrer-Policy: no-referrer
// → リダイレクト時に URL パラメータ（code, state）が漏洩しない

// 4. Token の安全な保存
// → Access Token: メモリ内（変数）
// → Refresh Token: HttpOnly Cookie or サーバーサイド
// → ID Token: 検証後に破棄（必要な情報はセッションに保存）
```

---

## 8. Anti-Patterns

```
OIDC anti-patterns:

  (1) Using ID Token for API authentication
     ✗ Bad example:
       fetch('/api/data', {
         headers: { Authorization: `Bearer ${idToken}` }
       });
     → ID Token is meant for the client
     → Use Access Token for APIs

  (2) Skipping JWT validation
     ✗ Bad example:
       const payload = JSON.parse(atob(token.split('.')[1]));
       // Using payload without signature verification
     → Tampered tokens would be accepted
     → Always verify the signature

  (3) Identifying users by something other than sub
     ✗ Bad example:
       // Identifying users by email address
       const user = await db.user.findUnique({ where: { email: payload.email } });
     → Email addresses can change
     → Identify by the combination of sub + provider

  (4) Using Implicit Flow
     ✗ Bad example:
       response_type: 'id_token token'
     → Access Token is exposed in the fragment
     → Use Authorization Code Flow + PKCE instead
```

---

## 9. Performance Considerations

```
OIDC performance optimization:

  (1) Cache Discovery
     → .well-known/openid-configuration rarely changes
     → 24-hour cache is common
     → Pre-fetch at app startup (warm-up)

  (2) Cache JWKS
     → Public keys only change during key rotation
     → Re-fetch only when kid is not found
     → Respect Cache-Control headers

  (3) Token exchange latency
     → HTTP request to the IdP token endpoint
     → Typically 100-500ms latency
     → Overall login flow takes 1-3 seconds

  (4) Optimize UserInfo requests
     → If the required information is in the ID Token, UserInfo is not needed
     → UserInfo results can be cached
     → Cache only for the duration of the Access Token's validity

  (5) Leverage sessions
     → Switch to session-based after authentication
     → Avoid contacting the IdP on every request
     → Session expiration design is important
```

---

## 10. Exercises

### Exercise 1: Basic OIDC Implementation (Beginner)

Implement a login feature using Google OIDC.

```
Requirements:
- Automatically retrieve configuration via Discovery
- Authorization Code Flow + PKCE
- Complete ID Token validation (issuer, audience, nonce, exp)
- Save user information to DB
- Set session Cookie

Environment:
- Node.js + Express or Next.js
- jose library (JWT validation)
- Google Cloud Console client ID already obtained

Tests:
- Happy path: Login succeeds → Session created
- Unhappy path: state mismatch, nonce mismatch, expired ID Token
```

### Exercise 2: Multi-Provider Support (Intermediate)

Implement multi-provider login with Google + GitHub + Apple.

```
Requirements:
- Extend the generic OIDCProvider class
- Support GitHub's non-standard OAuth
- Handle Apple Sign In first-login data saving
- Email-based account linking
- Merge logins from different providers with the same email

Tests:
- Login success with each provider
- Automatic linking with the same email
- Add provider (link a new provider to an existing user)
```

### Exercise 3: Security Hardening (Advanced)

Add security hardening features to OIDC authentication.

```
Requirements:
- Step-up authentication (require re-authentication for sensitive operations)
  → Force re-authentication with max_age=0
  → Specify authentication level with acr_values
- Implement RP-Initiated Logout
- Receive Back-Channel Logout
- Understand the concept of Token Binding (DPoP)
- Detect unauthorized access (detect abnormal authentication patterns)

Implementation:
- Step-up authentication middleware
- Logout API + IdP integration
- Audit log for security events
```

---

## 11. FAQ / Troubleshooting

### Q1: Getting an "invalid_grant" error

**Cause**: Common causes are double use of authorization code, code expiration, or redirect_uri mismatch.

```
Resolution:
1. Authorization code can only be used once → Check if the browser's back button is re-submitting
2. Authorization code typically expires in 10 minutes → Check if the user has been idle for too long
3. Verify redirect_uri exactly matches between token exchange and authorization request
4. Verify client_id / client_secret are correct
```

### Q2: ID Token signature verification fails

**Cause**: JWKS key rotation, kid mismatch, or algorithm mismatch.

```
Resolution:
1. Force clear the JWKS cache and re-fetch
2. Verify that the kid in the ID Token header is in the JWKS
3. Verify alg is the expected algorithm (RS256)
4. The IdP may have performed key rotation
```

### Q3: Getting less information from UserInfo

**Cause**: Insufficient scope, provider limitations, or user settings.

```
Resolution:
1. Verify the authorization request scope includes the required scopes
2. Some providers require scope approval
3. Apple: name is first-login only; GitHub: email may be private
4. Google: Additional scopes must be enabled in Google Cloud Console
```

### Q4: Silent Refresh is not working

**Cause**: Third-party cookie restrictions, or Refresh Token expiration.

```
Resolution:
1. Third-party cookies may be blocked by ITP/ETP
2. Silent Auth with prompt=none is affected by cookie restrictions
3. Server-side use of Refresh Token is recommended
4. Check Refresh Token expiration (Google: 7 days to indefinite)
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners often make?

Skipping the basics and jumping to advanced topics. We recommend solidly understanding the fundamental concepts explained in this guide before moving to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Concept | Key Points |
|---------|-----------|
| OIDC | Authentication layer on top of OAuth 2.0. Clear separation of authentication and authorization |
| ID Token | JWT containing user information. Consumed within the client |
| Access Token | Used for API access. Sent to the resource server |
| Discovery | Automatic retrieval of provider configuration. Caching recommended |
| PKCE | Prevents authorization code interception attacks. Recommended for all clients |
| nonce | Prevents replay attacks. Include in ID Token and validate |
| UserInfo | Retrieve detailed profile information. Authenticated with Access Token |
| JWKS | Distributes public keys. Key rotation support is required |
| Account Linking | Identify by sub + provider. Email-based merging |

---

## Next Guides to Read

---

## References
1. OpenID Foundation. "OpenID Connect Core 1.0." openid.net/specs/openid-connect-core-1_0.html, 2014.
2. OpenID Foundation. "OpenID Connect Discovery 1.0." openid.net/specs/openid-connect-discovery-1_0.html, 2014.
3. RFC 7636. "Proof Key for Code Exchange by OAuth Public Clients." IETF, 2015.
4. RFC 7517. "JSON Web Key (JWK)." IETF, 2015.
5. Google. "OpenID Connect." developers.google.com/identity/openid-connect, 2024.
6. Apple. "Sign in with Apple." developer.apple.com/sign-in-with-apple, 2024.
7. Microsoft. "Microsoft identity platform and OpenID Connect protocol." learn.microsoft.com, 2024.
8. OWASP. "Authentication Cheat Sheet." cheatsheetseries.owasp.org, 2024.

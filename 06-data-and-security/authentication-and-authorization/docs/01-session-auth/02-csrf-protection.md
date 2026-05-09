# CSRF Protection

> CSRF (Cross-Site Request Forgery) is an attack that forges operations on behalf of an authenticated user. This guide covers how CSRF attacks work and multi-layered defenses including the Synchronizer Token pattern, Double Submit Cookie, SameSite Cookie, and Origin header validation.

## Prerequisites

- How HTTP Cookies work (Set-Cookie header, Cookie attributes)
- Basics of Same-Origin Policy

## What You Will Learn

- [ ] Understand how CSRF attacks work and their risks
- [ ] Be able to implement the major CSRF defense patterns
- [ ] Know the effectiveness and limitations of SameSite Cookie protection
- [ ] Implement practical CSRF countermeasures in Next.js / Express
- [ ] Understand the design principles of defense in depth

---

## 1. How CSRF Attacks Work

### 1.1 Basic Attack Flow

```
CSRF Attack Flow:

  ① User is logged in to bank.com (Cookie is valid)
  ② Attacker embeds the following HTML on evil.com:
     <form action="https://bank.com/transfer" method="POST">
       <input type="hidden" name="to" value="attacker" />
       <input type="hidden" name="amount" value="1000000" />
     </form>
     <script>document.forms[0].submit();</script>
  ③ User visits evil.com
  ④ Form is automatically submitted
  ⑤ Browser automatically attaches bank.com's Cookie
  ⑥ bank.com judges it as a legitimate request from the user
  ⑦ The transfer is executed

  Why it succeeds:
  → The browser sends Cookies even for cross-site requests
  → The server authenticates users only via Cookies
  → The server cannot distinguish whether the request came from a legitimate user
```

### 1.2 Detailed Classification of Attacks

```
Types of CSRF Attacks:

  ┌─────────────────────────────────────────────────────────┐
  │                    CSRF Attack Classification            │
  ├──────────────┬──────────────────────────────────────────┤
  │ Type         │ Description                              │
  ├──────────────┼──────────────────────────────────────────┤
  │ POST CSRF    │ Auto-submission of hidden forms           │
  │              │ → Most common attack vector               │
  │              │ → Targets state-changing operations       │
  ├──────────────┼──────────────────────────────────────────┤
  │ GET CSRF     │ Issuing GET requests via img/script tags  │
  │              │ → Targets APIs that change state via GET  │
  │              │ → <img src="bank.com/transfer?to=evil">   │
  ├──────────────┼──────────────────────────────────────────┤
  │ Login CSRF   │ Forces login with attacker's account      │
  │              │ → User operates under attacker's account  │
  │              │ → Input data leaks to attacker            │
  ├──────────────┼──────────────────────────────────────────┤
  │ JSON CSRF    │ Spoofed JSON submission via Content-Type  │
  │              │ → Exploiting enctype="text/plain"         │
  │              │ → Bypassing CORS restrictions             │
  ├──────────────┼──────────────────────────────────────────┤
  │ XHR CSRF     │ Asynchronous requests via JavaScript      │
  │              │ → Sends Cookie with withCredentials: true │
  │              │ → Succeeds when CORS is permitted         │
  └──────────────┴──────────────────────────────────────────┘
```

### 1.3 Conditions for a Successful Attack

```
3 Conditions for a CSRF Attack to Succeed:

  ┌──────────────────────────────────────────────────┐
  │ Condition ①: Uses Cookie-based authentication    │
  │   → Session Cookie is automatically sent         │
  │   → Authorization header is not auto-sent        │
  └──────────────────┬───────────────────────────────┘
                     ↓
  ┌──────────────────────────────────────────────────┐
  │ Condition ②: Predictable request structure       │
  │   → Parameter names and values are guessable     │
  │   → No secret value such as a random token needed│
  └──────────────────┬───────────────────────────────┘
                     ↓
  ┌──────────────────────────────────────────────────┐
  │ Condition ③: There is a state-changing operation │
  │   → Transfer, purchase, password change          │
  │   → Email change → Account takeover              │
  │   → Admin operations (user deletion, role change)│
  └──────────────────────────────────────────────────┘

  A CSRF attack succeeds only when all three conditions are met
```

### 1.4 Real Attack Scenarios

```typescript
// Attack scenario 1: Fund transfer (POST CSRF)
// HTML placed on evil.com
`
<html>
<body onload="document.forms[0].submit()">
  <form action="https://bank.com/api/transfer" method="POST">
    <input type="hidden" name="recipient" value="attacker-account" />
    <input type="hidden" name="amount" value="50000" />
    <input type="hidden" name="currency" value="JPY" />
  </form>
</body>
</html>
`;

// Attack scenario 2: Password change (POST CSRF)
`
<iframe style="display:none" name="csrf-frame"></iframe>
<form action="https://target.com/api/change-password" method="POST" target="csrf-frame">
  <input type="hidden" name="new_password" value="hacked123" />
  <input type="hidden" name="confirm_password" value="hacked123" />
</form>
<script>document.forms[0].submit();</script>
`;

// Attack scenario 3: Email change → Account takeover
`
<img src="https://target.com/api/update-email?email=attacker@evil.com"
     style="display:none" />
`;
// ↑ Designs that change state via GET are dangerous

// Attack scenario 4: Spoofed JSON request
`
<form action="https://target.com/api/update-profile" method="POST"
      enctype="text/plain">
  <input name='{"name":"attacker","ignore":"' value='"}' />
</form>
`;
// When the server parses it as JSON even with Content-Type: text/plain
```

### 1.5 Login CSRF in Detail

```
Login CSRF Attack:

  A different pattern from regular CSRF

  ① Attacker forges a login request using their own credentials
  ② The user ends up logged in as the attacker's account
  ③ User uses the service (enters personal info, uploads files, etc.)
  ④ Attacker logs in with their account and views the information

  Attack Flow:
  ┌─────────┐     ┌─────────┐     ┌─────────┐
  │  User   │────→│ evil.com │────→│ target  │
  │ Browser │     │  (CSRF)  │     │  .com   │
  └─────────┘     └──────────┘     └─────────┘
       │          Login request with              │
       │          attacker's credentials          │
       │                                          │
       │←── Attacker's session Cookie ────────────│
       │                                          │
       │ User enters personal info                │
       │ under attacker's account...              │

  Countermeasures:
  → Set CSRF tokens on login forms as well
  → Regenerate session ID after login
  → Send login notifications to users
```

---

## 2. Defense Patterns

### 2.1 Overview of 4 Defense Patterns

```
4 CSRF Defense Patterns:

  ① Synchronizer Token Pattern:
     → Server generates a random token
     → Embed as a hidden field in the form
     → Server validates the token
     → Most reliable defense

  ② Double Submit Cookie:
     → Set token in both Cookie and request
     → Verify that both match
     → No server-side state required

  ③ SameSite Cookie:
     → Controlled via the SameSite attribute of Cookies
     → Browser-level defense
     → No additional implementation needed

  ④ Origin / Referer Header Validation:
     → Validate the origin of the request
     → Supplementary defense
     → Headers may be omitted in some cases

  Recommended: ③ SameSite=Lax + ① or ② combined
```

### 2.2 Defense Pattern Comparison

```
┌────────────────────┬──────────────┬──────────────┬──────────┬──────────────┐
│ Pattern            │ Security     │ Impl. Cost   │ State    │ SPA Fit      │
├────────────────────┼──────────────┼──────────────┼──────────┼──────────────┤
│ Synchronizer Token │ ★★★★★      │ ★★★         │ Required │ △ Needs work │
│ Double Submit      │ ★★★★       │ ★★           │ None     │ ○ Compatible │
│ SameSite Cookie    │ ★★★★       │ ★ (minimal)  │ None     │ ○ Automatic  │
│ Origin Validation  │ ★★★         │ ★★           │ None     │ ○ Compatible │
│ Custom Header      │ ★★★★       │ ★★           │ None     │ ◎ Ideal     │
│ Encrypted Token    │ ★★★★★      │ ★★★★        │ None     │ △ Needs work │
└────────────────────┴──────────────┴──────────────┴──────────┴──────────────┘
```

### 2.3 Synchronizer Token Pattern

```
Synchronizer Token Pattern - Internal Operation:

  ┌──────────┐          ┌──────────────┐          ┌──────────┐
  │ Browser  │          │    Server    │          │ Session  │
  │          │          │              │          │  Store   │
  └────┬─────┘          └──────┬───────┘          └────┬─────┘
       │                       │                       │
       │  GET /form            │                       │
       │──────────────────────→│                       │
       │                       │ generateToken()       │
       │                       │──────────────────────→│
       │                       │  store(sid, token)    │
       │                       │                       │
       │  HTML with hidden     │                       │
       │  <input name="_csrf"  │                       │
       │   value="abc123">     │                       │
       │←──────────────────────│                       │
       │                       │                       │
       │  POST /action         │                       │
       │  _csrf=abc123         │                       │
       │──────────────────────→│                       │
       │                       │  getToken(sid)        │
       │                       │──────────────────────→│
       │                       │  "abc123"             │
       │                       │←──────────────────────│
       │                       │                       │
       │                       │ compare(req, stored)  │
       │                       │ → match → execute     │
       │  200 OK               │                       │
       │←──────────────────────│                       │
       │                       │                       │
```

```typescript
// ① Synchronizer Token Pattern - Full Implementation
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

interface CSRFStore {
  setToken(sessionId: string, token: string): Promise<void>;
  getToken(sessionId: string): Promise<string | null>;
  deleteToken(sessionId: string): Promise<void>;
}

// Redis-based token store
class RedisCSRFStore implements CSRFStore {
  private redis: Redis;
  private prefix = 'csrf:';
  private ttl = 3600; // 1 hour

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async setToken(sessionId: string, token: string): Promise<void> {
    await this.redis.setex(`${this.prefix}${sessionId}`, this.ttl, token);
  }

  async getToken(sessionId: string): Promise<string | null> {
    return this.redis.get(`${this.prefix}${sessionId}`);
  }

  async deleteToken(sessionId: string): Promise<void> {
    await this.redis.del(`${this.prefix}${sessionId}`);
  }
}

// Token generation (cryptographically secure random value)
function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
  // 32 bytes = 256 bits → 64-character hex string
  // 2^256 possibilities → practically impossible to guess
}

// Token comparison (timing attack countermeasure)
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  // Note: Regular === comparison returns at the first mismatch character,
  //    which allows guessing the token from response timing.
  //    timingSafeEqual always takes the same amount of time to compare.
}

// CSRF protection middleware
function csrfProtection(store: CSRFStore) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip GET, HEAD, OPTIONS (safe methods = RFC 7231 §4.2.1)
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      // Generate a token and include it in the response
      const sessionId = req.session?.id;
      if (sessionId) {
        let token = await store.getToken(sessionId);
        if (!token) {
          token = generateCSRFToken();
          await store.setToken(sessionId, token);
        }
        // Set as a local variable so templates can use it
        res.locals.csrfToken = token;
      }
      return next();
    }

    // State-changing methods: POST/PUT/DELETE etc.
    const sessionId = req.session?.id;
    if (!sessionId) {
      return res.status(403).json({ error: 'No session' });
    }

    // Token retrieval sources (priority order)
    const token =
      req.headers['x-csrf-token'] as string ||   // Custom header
      req.body?._csrf ||                           // Form hidden field
      req.query?._csrf as string;                  // Query parameter (not recommended)

    const storedToken = await store.getToken(sessionId);

    if (!token || !storedToken || !safeCompare(token, storedToken)) {
      return res.status(403).json({
        error: 'Invalid CSRF token',
        message: 'CSRF token validation failed. Please reload the page and try again.',
      });
    }

    // Regenerate token (one-time use - Per-Request Token)
    // Note: Delete this section for Per-Session Token
    const newToken = generateCSRFToken();
    await store.setToken(sessionId, newToken);
    res.setHeader('X-CSRF-Token', newToken);

    next();
  };
}

// Applying to Express application
import express from 'express';

const app = express();
const redis = new Redis(process.env.REDIS_URL!);
const csrfStore = new RedisCSRFStore(redis);

app.use(csrfProtection(csrfStore));

// Embed in form (server-side rendering)
// <input type="hidden" name="_csrf" value="${res.locals.csrfToken}" />

// For SPA: retrieve via meta tag or API
// <meta name="csrf-token" content="${res.locals.csrfToken}" />
```

### 2.4 Per-Session Token vs Per-Request Token

```
Token Update Strategy:

  Per-Session Token:
  ┌────────────────────────────────────────────┐
  │ Generate one token at session start         │
  │ Continue using the same token throughout    │
  │                                             │
  │ Advantages:                                 │
  │ → Simple implementation                     │
  │ → No issues with browser "Back" button      │
  │ → Can be shared across tabs                 │
  │                                             │
  │ Disadvantages:                              │
  │ → Greater impact if token is leaked         │
  │ → Dangerous when combined with XSS          │
  └────────────────────────────────────────────┘

  Per-Request Token:
  ┌────────────────────────────────────────────┐
  │ Generate a new token for each request       │
  │ Invalidate after use                        │
  │                                             │
  │ Advantages:                                 │
  │ → Higher security                           │
  │ → Limited impact if token is leaked         │
  │                                             │
  │ Disadvantages:                              │
  │ → Form re-submission fails with "Back"      │
  │ → Issues with simultaneous multi-tab ops    │
  │ → Complex in AJAX-heavy applications        │
  └────────────────────────────────────────────┘

  Recommendation:
  → General web apps: Per-Session Token
  → Financial / high-security: Per-Request Token
  → SPA: Per-Session Token + Custom Header
```

### 2.5 Double Submit Cookie

```
Double Submit Cookie - Internal Operation:

  Key point: An attacker cannot "set" a Cookie,
             but the browser will "auto-send" Cookies

  ┌──────────┐          ┌──────────────┐
  │ Browser  │          │    Server    │
  └────┬─────┘          └──────┬───────┘
       │                       │
       │  GET /page            │
       │──────────────────────→│
       │                       │ token = random()
       │  Set-Cookie:          │
       │  csrf=token123        │
       │  (httpOnly=false)     │
       │←──────────────────────│
       │                       │
       │  JavaScript reads     │
       │  the Cookie           │
       │  ↓                    │
       │  POST /action         │
       │  Cookie: csrf=token123│ ← Browser auto-sends
       │  X-CSRF-Token: token123│ ← JS explicitly sets
       │──────────────────────→│
       │                       │
       │                       │ Cookie value === Header value?
       │                       │ → Match → Legitimate request
       │                       │
       │  Attacker's case:     │
       │  Cookie: csrf=token123│ ← Browser auto-sends
       │  X-CSRF-Token: ???    │ ← Attacker cannot read Cookie
       │                       │   → Mismatch → Rejected
```

```typescript
// ② Double Submit Cookie - Full Implementation
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

interface DoubleSubmitOptions {
  cookieName?: string;
  headerName?: string;
  cookieOptions?: {
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    path?: string;
    domain?: string;
  };
  // Whether to use HMAC signing (recommended)
  signedCookie?: boolean;
  secret?: string;
}

function doubleSubmitCSRF(options: DoubleSubmitOptions = {}) {
  const {
    cookieName = 'csrf-token',
    headerName = 'x-csrf-token',
    cookieOptions = {},
    signedCookie = true,
    secret = process.env.CSRF_SECRET || 'default-change-me',
  } = options;

  // Generate HMAC-signed token
  function createSignedToken(): string {
    const value = crypto.randomBytes(32).toString('hex');
    if (!signedCookie) return value;

    const signature = crypto
      .createHmac('sha256', secret)
      .update(value)
      .digest('hex');
    return `${value}.${signature}`;
  }

  // Verify signature
  function verifySignature(token: string): boolean {
    if (!signedCookie) return true;

    const [value, signature] = token.split('.');
    if (!value || !signature) return false;

    const expected = crypto
      .createHmac('sha256', secret)
      .update(value)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  return (req: Request, res: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      // Set token in Cookie on GET
      if (!req.cookies[cookieName]) {
        const token = createSignedToken();
        res.cookie(cookieName, token, {
          httpOnly: false,   // Must be readable by JavaScript
          secure: cookieOptions.secure ?? process.env.NODE_ENV === 'production',
          sameSite: cookieOptions.sameSite ?? 'lax',
          path: cookieOptions.path ?? '/',
          domain: cookieOptions.domain,
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
        });
      }
      return next();
    }

    // On POST/PUT/DELETE: compare Cookie and header tokens
    const cookieToken = req.cookies[cookieName];
    const headerToken = req.headers[headerName] as string
      || req.body?._csrf;

    if (!cookieToken || !headerToken) {
      return res.status(403).json({
        error: 'CSRF validation failed',
        message: 'Missing CSRF token',
      });
    }

    // Verify signature
    if (!verifySignature(cookieToken)) {
      return res.status(403).json({
        error: 'CSRF validation failed',
        message: 'Invalid CSRF token signature',
      });
    }

    // Compare Cookie and header values
    if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
      return res.status(403).json({
        error: 'CSRF validation failed',
        message: 'CSRF token mismatch',
      });
    }

    next();
  };
}

// Client-side implementation
// const csrfToken = document.cookie.match(/csrf-token=([^;]+)/)?.[1];
// fetch('/api/data', {
//   method: 'POST',
//   headers: {
//     'Content-Type': 'application/json',
//     'X-CSRF-Token': csrfToken,
//   },
//   credentials: 'same-origin',
//   body: JSON.stringify(data),
// });
```

### 2.6 Signed Double Submit Cookie

```
Why Signing Is Necessary:

  Weakness of regular Double Submit Cookie:
  ┌──────────────────────────────────────────────────┐
  │ If the attacker controls a subdomain:             │
  │                                                   │
  │ From evil.sub.example.com:                        │
  │ Set-Cookie: csrf=attacker-value; domain=.example.com │
  │ can be set                                        │
  │                                                   │
  │ → Overwrite the Cookie and set the same value in  │
  │   the header                                      │
  │ → Passes validation (Cookie Injection attack)     │
  └──────────────────────────────────────────────────┘

  With HMAC signing:
  ┌──────────────────────────────────────────────────┐
  │ Token = value.HMAC(secret, value)                 │
  │                                                   │
  │ Since the attacker does not know the secret,      │
  │ they cannot generate a valid signature            │
  │ → Even if the Cookie is overwritten, signature    │
  │   verification fails                              │
  └──────────────────────────────────────────────────┘
```

### 2.7 Custom Request Header Pattern

```typescript
// ③ Custom Request Header Pattern
// The fetch API cannot send custom headers cross-origin without a CORS preflight
// → CORS preflight is required → Cannot be sent from an attacker's site

// Server side
function customHeaderCSRF(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Check for the presence of a custom header (value doesn't matter)
  const csrfHeader = req.headers['x-requested-with'];

  if (csrfHeader !== 'XMLHttpRequest') {
    return res.status(403).json({
      error: 'CSRF validation failed',
      message: 'Missing X-Requested-With header',
    });
  }

  next();
}

// Client side
// fetch('/api/data', {
//   method: 'POST',
//   headers: {
//     'Content-Type': 'application/json',
//     'X-Requested-With': 'XMLHttpRequest', // Custom header
//   },
//   credentials: 'same-origin',
//   body: JSON.stringify(data),
// });

// Note: When Content-Type is application/json,
//    a CORS preflight (OPTIONS) is issued,
//    blocking requests from cross-origin.
//    However, Content-Type: text/plain does not require a preflight
//    → Content-Type validation should also be used together
```

### 2.8 Origin / Referer Header Validation

```typescript
// ④ Origin / Referer Header Validation - Full Implementation
function originVerification(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const origin = req.headers.origin;
    const referer = req.headers.referer;

    // When Origin header is present (preferred)
    if (origin) {
      if (!allowedOrigins.includes(origin)) {
        console.warn(`CSRF: Rejected request from origin: ${origin}`);
        return res.status(403).json({
          error: 'Origin validation failed',
          message: `Origin ${origin} is not allowed`,
        });
      }
      return next();
    }

    // Fall back to Referer if Origin is absent
    // Note: Origin header may be omitted by some browsers/conditions
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const refererOrigin = refererUrl.origin;
        if (!allowedOrigins.includes(refererOrigin)) {
          console.warn(`CSRF: Rejected request from referer: ${referer}`);
          return res.status(403).json({ error: 'Referer validation failed' });
        }
        return next();
      } catch {
        return res.status(403).json({ error: 'Invalid Referer header' });
      }
    }

    // Decision when neither Origin nor Referer is present
    // → May be omitted by privacy settings or proxies
    // → Strict: reject (security-first)
    // → Permissive: allow (compatibility-first)
    console.warn('CSRF: Request without Origin or Referer header');
    return res.status(403).json({
      error: 'Missing Origin or Referer header',
    });
  };
}

// Usage example
app.use(originVerification([
  'https://myapp.com',
  'https://www.myapp.com',
  ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : []),
]));
```

```
Cases Where Origin / Referer Headers Are Omitted:

  ┌──────────────────────────────────────────────────┐
  │ Cases where Origin header is omitted:             │
  │                                                   │
  │ → Same-origin GET/HEAD requests                   │
  │ → When Referrer-Policy: no-referrer is set        │
  │ → Some older browsers                             │
  │ → Direct access from bookmarks                    │
  │ → Direct input from the address bar               │
  │                                                   │
  │ Cases where Referer header is omitted:            │
  │                                                   │
  │ → HTTPS → HTTP downgrade                          │
  │ → When Referrer-Policy: no-referrer is set        │
  │ → Use of privacy extensions                       │
  │ → Links from email clients                        │
  │                                                   │
  │ → Position Origin validation as a supplementary   │
  │   defense                                         │
  └──────────────────────────────────────────────────┘
```

---

## 3. Defense with SameSite Cookie

### 3.1 SameSite Attribute in Detail

```
Effects of SameSite Attribute:

  SameSite=Strict:
    → No Cookie is sent with any cross-site request
    → Completely prevents CSRF
    → However: user appears logged out when arriving via an external link
    → Example: clicking bank.com from Google Search → login screen

  SameSite=Lax (recommended default):
    → Sends Cookie only for top-level GET navigations
    → Blocks cross-site requests from POST, iframe, img, fetch, etc.
    → Defends against the main CSRF attack vectors
    → Minimal impact on UX

  SameSite=None:
    → Sends Cookie with all cross-site requests
    → Requires the Secure attribute
    → Only for cases where third-party Cookies are necessary
```

### 3.2 SameSite Determination Logic

```
Definition of "Site" (SameSite Determination Criteria):

  SameSite is determined by eTLD+1 (effective TLD + 1)

  Examples of eTLD+1:
    example.com          → eTLD+1 = example.com
    app.example.com      → eTLD+1 = example.com
    sub.app.example.com  → eTLD+1 = example.com
    example.co.jp        → eTLD+1 = example.co.jp (co.jp is eTLD)
    myapp.github.io      → eTLD+1 = myapp.github.io (github.io is eTLD)

  Same-Site Determination:
  ┌──────────────────────┬──────────────────────┬──────────┐
  │ Request Source       │ Request Destination  │ Result   │
  ├──────────────────────┼──────────────────────┼──────────┤
  │ app.example.com      │ api.example.com      │ Same-Site│
  │ example.com          │ sub.example.com      │ Same-Site│
  │ example.com          │ other.com            │ Cross-Site│
  │ myapp.github.io      │ other.github.io      │ Cross-Site│
  │ http://example.com   │ https://example.com  │ Cross-Site│
  └──────────────────────┴──────────────────────┴──────────┘

  Note: Scheme (http/https) is also considered (Schemeful Same-Site)
  Note: Port number does not need to match for Same-Site
```

### 3.3 Cookie Sending by Request Type

```
Cookie Sending by Request Type Based on SameSite:

  ┌──────────────────────────────┬────────┬──────┬──────┐
  │ Request Type                 │ Strict │ Lax  │ None │
  ├──────────────────────────────┼────────┼──────┼──────┤
  │ <a href="..."> link          │ ✗      │ ✓    │ ✓    │
  │ <form method="GET">          │ ✗      │ ✓    │ ✓    │
  │ <form method="POST">         │ ✗      │ ✗    │ ✓    │
  │ <img src="...">              │ ✗      │ ✗    │ ✓    │
  │ <iframe src="...">           │ ✗      │ ✗    │ ✓    │
  │ <script src="...">           │ ✗      │ ✗    │ ✓    │
  │ fetch(url, {credentials})    │ ✗      │ ✗    │ ✓    │
  │ XMLHttpRequest               │ ✗      │ ✗    │ ✓    │
  │ window.location = url        │ ✗      │ ✓    │ ✓    │
  │ <link rel="prerender">       │ ✗      │ ✓    │ ✓    │
  └──────────────────────────────┴────────┴──────┴──────┘

  Conditions for Cookie to be sent with Lax:
  ① Top-level navigation (URL bar changes)
  ② HTTP GET method
  ③ Only when both ① and ② are satisfied
```

### 3.4 Limitations of SameSite

```
Limitations of SameSite:

  ① State changes via GET requests:
     → APIs like GET /delete-account can still be attacked even with SameSite=Lax
     → Countermeasure: Always use POST/PUT/DELETE for state changes

  ② Between subdomains:
     → SameSite is determined by eTLD+1
     → app.example.com and evil.example.com are the same site
     → Depends on the trustworthiness of subdomains
     → Countermeasure: Strictly manage subdomains

  ③ Older browsers:
     → Some browsers do not support SameSite
     → Safari on iOS 12 and older treats SameSite=None as Unknown
     → Combining with additional defenses is recommended

  ④ Lax+POST 2-minute window (Chrome):
     → Chrome sends Lax Cookies in POST requests during the first 2 minutes
        for new Cookies
     → Targets top-level cross-site POST navigations
     → Introduced in 2020 as a compatibility measure

  ⑤ Same-Site ≠ Same-Origin:
     → Same-Site determination is looser than Same-Origin
     → Cannot prevent attacks from subdomains
     → Dangerous if XSS exists on a subdomain
```

```typescript
// Correct SameSite Cookie configuration
import { CookieOptions } from 'express';

// Recommended settings for session Cookies
const sessionCookieOptions: CookieOptions = {
  httpOnly: true,        // Not accessible via JavaScript
  secure: true,          // HTTPS only
  sameSite: 'lax',       // Blocks cross-site POST
  path: '/',             // Valid for all paths
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  // Do not set domain (restrict to issuing domain only)
};

// High-security Cookie (admin panels, etc.)
const strictCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',    // Never sent with any cross-site request
  path: '/admin',        // Admin path only
  maxAge: 4 * 60 * 60 * 1000, // 4 hours
};

// When third-party Cookies are required (embedded widgets, etc.)
const thirdPartyCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,          // Secure is required for SameSite=None
  sameSite: 'none',      // Allow cross-site requests
  path: '/',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
};
```

---

## 4. CSRF Protection in Next.js

### 4.1 Automatic Protection with Server Actions

```typescript
// CSRF protection in Next.js App Router

// Server Actions are automatically CSRF-protected
// Next.js internally validates the Origin header
// → No additional CSRF countermeasures needed

// How Server Actions work internally:
// 1. Client sends a POST request
// 2. Next.js validates the Origin header
// 3. If Origin doesn't match, returns 403
// 4. Sends with Content-Type: multipart/form-data
// 5. Specifies action ID via Next-Action header
// 6. These validations prevent CSRF attacks

// app/actions/article.ts
'use server';

import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

export async function createArticle(formData: FormData) {
  // Server Actions are automatically CSRF-protected
  const session = await auth();
  if (!session) throw new Error('Unauthorized');

  const title = formData.get('title') as string;
  const content = formData.get('content') as string;

  // Input validation
  if (!title || title.length > 200) {
    throw new Error('Invalid title');
  }

  await prisma.article.create({
    data: {
      title,
      content,
      authorId: session.user.id,
    },
  });

  revalidatePath('/articles');
}

// app/articles/new/page.tsx
export default function NewArticlePage() {
  return (
    <form action={createArticle}>
      <input name="title" type="text" required />
      <textarea name="content" required />
      <button type="submit">Create</button>
    </form>
  );
}
```

### 4.2 CSRF Protection for API Routes

```typescript
// API Routes require manual protection

// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Protect POST/PUT/DELETE on API routes
  if (
    request.nextUrl.pathname.startsWith('/api/') &&
    !['GET', 'HEAD', 'OPTIONS'].includes(request.method)
  ) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');

    // Validate Origin header
    if (origin) {
      try {
        const originUrl = new URL(origin);
        const expectedHost = host?.split(':')[0]; // Remove port number
        const originHost = originUrl.hostname;

        if (originHost !== expectedHost) {
          console.warn(
            `CSRF blocked: Origin ${origin} does not match host ${host}`
          );
          return NextResponse.json(
            { error: 'CSRF validation failed' },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: 'Invalid Origin header' },
          { status: 403 }
        );
      }
    } else {
      // When Origin header is absent
      // → API Routes are usually called via fetch, so Origin should be present
      // → If absent, it may be an invalid request
      const referer = request.headers.get('referer');
      if (!referer) {
        return NextResponse.json(
          { error: 'Missing Origin header' },
          { status: 403 }
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
```

### 4.3 Using Double Submit Cookie in Next.js

```typescript
// lib/csrf.ts
import { cookies } from 'next/headers';
import crypto from 'crypto';

const CSRF_COOKIE = '__csrf';
const CSRF_HEADER = 'x-csrf-token';

// Token generation (called from Server Component / Server Action)
export async function getCSRFToken(): Promise<string> {
  const cookieStore = await cookies();
  let token = cookieStore.get(CSRF_COOKIE)?.value;

  if (!token) {
    token = crypto.randomBytes(32).toString('hex');
    cookieStore.set(CSRF_COOKIE, token, {
      httpOnly: false, // Must be readable by JS
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60, // 1 hour
    });
  }

  return token;
}

// Token validation (called from API Route / Server Action)
export async function validateCSRFToken(request: Request): Promise<boolean> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE)?.value;
  const headerToken = request.headers.get(CSRF_HEADER);

  if (!cookieToken || !headerToken) return false;

  return crypto.timingSafeEqual(
    Buffer.from(cookieToken),
    Buffer.from(headerToken)
  );
}

// Hook for Client Components
// hooks/useCSRF.ts
'use client';

export function useCSRFToken(): string | null {
  const match = document.cookie.match(/__csrf=([^;]+)/);
  return match ? match[1] : null;
}

// API call wrapper
export function csrfFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const csrfToken = document.cookie.match(/__csrf=([^;]+)/)?.[1];

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'X-CSRF-Token': csrfToken || '',
    },
    credentials: 'same-origin',
  });
}
```

### 4.4 Comprehensive CSRF Protection via Next.js Middleware

```typescript
// middleware.ts - Comprehensive CSRF protection
import { NextRequest, NextResponse } from 'next/server';

// Paths to protect
const PROTECTED_API_PATHS = ['/api/'];
// Paths to skip CSRF validation (Webhooks, etc.)
const SKIP_CSRF_PATHS = ['/api/webhooks/stripe', '/api/webhooks/github'];

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_API_PATHS.some(p => pathname.startsWith(p))
    && !SKIP_CSRF_PATHS.some(p => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  // Skip safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return NextResponse.next();
  }

  // Skip unprotected paths
  if (!isProtectedRoute(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  // 1. Origin header validation
  const origin = request.headers.get('origin');
  if (origin) {
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    ];

    if (!allowedOrigins.some(allowed => {
      try {
        return new URL(allowed).origin === new URL(origin).origin;
      } catch {
        return false;
      }
    })) {
      return NextResponse.json({ error: 'CSRF: Invalid origin' }, { status: 403 });
    }
  }

  // 2. Double Submit Cookie validation
  const cookieToken = request.cookies.get('__csrf')?.value;
  const headerToken = request.headers.get('x-csrf-token');

  if (cookieToken && headerToken) {
    // Validate if Double Submit is configured
    if (cookieToken !== headerToken) {
      return NextResponse.json({ error: 'CSRF: Token mismatch' }, { status: 403 });
    }
  }

  return NextResponse.next();
}
```

---

## 5. CSRF Protection in SPAs (React / Vue)

### 5.1 SPA-Specific Considerations

```
SPAs and CSRF:

  Why SPAs are relatively resistant to CSRF:
  ┌──────────────────────────────────────────────────┐
  │ ① API requests are usually JSON                  │
  │   → Content-Type: application/json               │
  │   → CORS preflight (OPTIONS) is issued           │
  │   → Cross-origin requests are blocked (depends   │
  │      on CORS config)                             │
  │                                                  │
  │ ② Custom headers are used                        │
  │   → Authorization: Bearer token                  │
  │   → X-Requested-With: XMLHttpRequest             │
  │   → CORS preflight is required                   │
  │                                                  │
  │ ③ Token-based authentication                     │
  │   → Stored in localStorage/memory, not Cookie    │
  │   → Not auto-sent                                │
  └──────────────────────────────────────────────────┘

  When CSRF protection is still needed in SPAs:
  ┌──────────────────────────────────────────────────┐
  │ ① Cookie-based authentication is used            │
  │   → Session management via httpOnly Cookie        │
  │   → Browser auto-sends                           │
  │                                                  │
  │ ② API accepts application/x-www-form-urlencoded  │
  │   → Can be sent without CORS preflight           │
  │                                                  │
  │ ③ CORS configuration is permissive               │
  │   → Access-Control-Allow-Origin: *               │
  │   → Dangerous when combined with credentials: true│
  └──────────────────────────────────────────────────┘
```

### 5.2 CSRF Protection Implementation in React

```typescript
// CSRF protection in a React application

// CSRFProvider.tsx
import { createContext, useContext, useEffect, useState } from 'react';

interface CSRFContextType {
  token: string | null;
  refresh: () => Promise<void>;
}

const CSRFContext = createContext<CSRFContextType>({
  token: null,
  refresh: async () => {},
});

export function CSRFProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  const fetchToken = async () => {
    try {
      const res = await fetch('/api/csrf-token', {
        credentials: 'same-origin',
      });
      const data = await res.json();
      setToken(data.token);
    } catch (err) {
      console.error('Failed to fetch CSRF token:', err);
    }
  };

  useEffect(() => {
    fetchToken();
  }, []);

  return (
    <CSRFContext.Provider value={{ token, refresh: fetchToken }}>
      {children}
    </CSRFContext.Provider>
  );
}

export function useCSRF() {
  return useContext(CSRFContext);
}

// CSRF-aware fetch wrapper
export function useCSRFFetch() {
  const { token, refresh } = useCSRF();

  return async (url: string, options: RequestInit = {}): Promise<Response> => {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'X-CSRF-Token': token || '',
      },
      credentials: 'same-origin',
    });

    // On 403, refresh token and retry
    if (res.status === 403) {
      await refresh();
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'X-CSRF-Token': token || '',
        },
        credentials: 'same-origin',
      });
    }

    return res;
  };
}
```

### 5.3 Automatic Injection via Axios Interceptors

```typescript
// Automatic CSRF token injection with Axios
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // Send Cookie
});

// Request interceptor: automatically attach CSRF token
api.interceptors.request.use((config) => {
  // Get CSRF token from Cookie
  const token = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrf-token='))
    ?.split('=')[1];

  if (token && config.method !== 'get') {
    config.headers['X-CSRF-Token'] = token;
  }

  return config;
});

// Response interceptor: save new token to Cookie
api.interceptors.response.use(
  (response) => {
    // When server returns a new token in the header
    const newToken = response.headers['x-csrf-token'];
    if (newToken) {
      document.cookie = `csrf-token=${newToken}; path=/; SameSite=Lax`;
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 403) {
      // Reload page on CSRF error
      console.warn('CSRF token expired. Refreshing...');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

## 6. Cases Where CSRF Protection Is Not Needed

```
When CSRF protection is not needed:

  ① Bearer token authentication:
     → Authorization header is not auto-sent
     → Must be explicitly set by JavaScript
     → Attacker cannot set the token

  ② SameSite=Strict Cookie:
     → Cookie is not sent with cross-site requests
     → However, impacts UX

  ③ API Key authentication:
     → Sent via custom header
     → Not auto-sent

  ④ API with correctly configured CORS:
     → Restrict Access-Control-Allow-Origin
     → Access-Control-Allow-Credentials: true
     → Preflight check blocks unauthorized requests

  When CSRF protection is needed:
     → Cookie-based session authentication
     → SameSite=None Cookie
     → SameSite=Lax with state changes on GET
     → Permissive CORS configuration
```

---

## 7. Defense in Depth Design

### 7.1 Defense Layer Configuration

```
Recommended Defense in Depth Configuration for CSRF:

  ┌─────────────────────────────────────────────────┐
  │ Layer 1: SameSite=Lax Cookie (browser level)    │
  │ → No additional implementation, blocks most attacks │
  ├─────────────────────────────────────────────────┤
  │ Layer 2: Origin header validation (network level)│
  │ → Validate the source of the request            │
  ├─────────────────────────────────────────────────┤
  │ Layer 3: CSRF token (application level)         │
  │ → Synchronizer Token or Double Submit Cookie    │
  ├─────────────────────────────────────────────────┤
  │ Layer 4: Content-Type validation                │
  │ → Accept only application/json                  │
  ├─────────────────────────────────────────────────┤
  │ Layer 5: Custom header requirement              │
  │ → Check for presence of X-Requested-With etc.   │
  └─────────────────────────────────────────────────┘

  General web app: Layer 1 + Layer 2 is sufficient
  Financial/medical: Layer 1 + Layer 2 + Layer 3 recommended
  Public API: Layer 1 + Layer 4 + Layer 5
```

### 7.2 Comprehensive CSRF Protection Middleware

```typescript
// Integrated defense-in-depth middleware
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

interface CSRFProtectionOptions {
  allowedOrigins: string[];
  cookieName?: string;
  headerName?: string;
  ignorePaths?: string[];
  requireContentType?: boolean;
  enableDoubleSubmit?: boolean;
}

function comprehensiveCSRF(options: CSRFProtectionOptions) {
  const {
    allowedOrigins,
    cookieName = 'csrf-token',
    headerName = 'x-csrf-token',
    ignorePaths = [],
    requireContentType = true,
    enableDoubleSubmit = true,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      // Set Double Submit Cookie
      if (enableDoubleSubmit && !req.cookies[cookieName]) {
        const token = crypto.randomBytes(32).toString('hex');
        res.cookie(cookieName, token, {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
        });
      }
      return next();
    }

    // Check excluded paths (Webhooks, etc.)
    if (ignorePaths.some(p => req.path.startsWith(p))) {
      return next();
    }

    // Layer 2: Origin header validation
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) {
      return res.status(403).json({
        error: 'csrf_origin_mismatch',
        message: 'Request origin is not allowed',
      });
    }

    // Layer 4: Content-Type validation
    if (requireContentType) {
      const contentType = req.headers['content-type'] || '';
      const allowedTypes = [
        'application/json',
        'multipart/form-data',
        'application/x-www-form-urlencoded',
      ];
      const isAllowed = allowedTypes.some(t => contentType.includes(t));
      if (!isAllowed) {
        return res.status(415).json({
          error: 'unsupported_content_type',
          message: `Content-Type ${contentType} is not supported`,
        });
      }
    }

    // Layer 3: Double Submit Cookie validation
    if (enableDoubleSubmit) {
      const cookieToken = req.cookies[cookieName];
      const headerToken = req.headers[headerName] as string;

      if (!cookieToken || !headerToken) {
        return res.status(403).json({
          error: 'csrf_token_missing',
          message: 'CSRF token is required',
        });
      }

      if (!crypto.timingSafeEqual(
        Buffer.from(cookieToken),
        Buffer.from(headerToken)
      )) {
        return res.status(403).json({
          error: 'csrf_token_mismatch',
          message: 'CSRF token validation failed',
        });
      }
    }

    next();
  };
}

// Usage example
app.use(comprehensiveCSRF({
  allowedOrigins: [
    'https://myapp.com',
    ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : []),
  ],
  ignorePaths: ['/api/webhooks/'],
  requireContentType: true,
  enableDoubleSubmit: true,
}));
```

---

## 8. Edge Cases and Caveats

### 8.1 Relationship Between CORS and CSRF

```
Relationship Between CORS and CSRF:

  Common misconception: "Configuring CORS prevents CSRF"
  → Partially true, but insufficient

  ┌──────────────────────────────────────────────────┐
  │ What CORS prevents:                               │
  │ → Cross-origin requests via fetch()/XMLHttpRequest│
  │ → Sending custom headers                          │
  │ → Reading responses                               │
  │                                                   │
  │ What CORS does NOT prevent:                       │
  │ → <form> submissions (outside CORS jurisdiction)  │
  │ → GET requests via <img> tags                     │
  │ → Side effects of simple requests other than      │
  │   response reading                                │
  └──────────────────────────────────────────────────┘

  ★ Important: CORS controls reading of responses, not
              whether requests are sent.
              → The request itself may reach the server
```

### 8.2 Subdomain Attacks

```
CSRF Attacks from Subdomains:

  Scenario:
  → evil.example.com is controlled by the attacker
  → Want to attack app.example.com

  ① SameSite Cookie:
     → evil.example.com and app.example.com are Same-Site
     → Cookie may still be sent even with SameSite=Lax

  ② Cookie Injection:
     → From evil.example.com:
        Set-Cookie: session=...; domain=.example.com
     → Can overwrite app.example.com's Cookie

  Countermeasures:
  → Use the __Host- prefix
     Set-Cookie: __Host-session=abc123; Secure; Path=/
     → Cannot set Domain attribute
     → Secure attribute is required
     → Path=/ is required
     → Prevents Cookie overwriting from subdomains
```

```typescript
// Using the __Host- prefix
res.cookie('__Host-session', sessionId, {
  httpOnly: true,
  secure: true,         // Required
  sameSite: 'lax',
  path: '/',            // Required (Path=/ only)
  // domain: cannot be set  // domain cannot be configured with __Host-
});

// Using the __Secure- prefix (fewer restrictions)
res.cookie('__Secure-session', sessionId, {
  httpOnly: true,
  secure: true,         // Required
  sameSite: 'lax',
  path: '/',
  domain: '.example.com', // Can be set
});
```

### 8.3 JSON CSRF in Detail

```
Details of JSON CSRF Attacks:

  JSON requests are normally resistant to CSRF:
  → Content-Type: application/json is a "non-simple request"
  → CORS preflight (OPTIONS) is issued
  → Request is blocked unless the server permits it

  However, attacks are possible in the following cases:
  ┌──────────────────────────────────────────────────┐
  │ ① Server ignores Content-Type and parses as JSON │
  │                                                   │
  │ <form enctype="text/plain" method="POST"          │
  │       action="https://target.com/api/transfer">   │
  │   <input name='{"amount":1000,"to":"evil","x":"'  │
  │          value='"}' />                            │
  │ </form>                                           │
  │                                                   │
  │ Submitted body:                                   │
  │ {"amount":1000,"to":"evil","x":"="}               │
  │ → text/plain but parsed as JSON                   │
  │                                                   │
  │ Countermeasure:                                   │
  │ → Strictly check Content-Type: application/json   │
  │ → Reject text/plain                               │
  └──────────────────────────────────────────────────┘
```

### 8.4 File Upload CSRF

```
File Uploads and CSRF:

  <form enctype="multipart/form-data"> can be sent
  without a CORS preflight (simple request)

  From attacker's site:
  <form action="https://target.com/api/upload" method="POST"
        enctype="multipart/form-data">
    <input type="hidden" name="filename" value="malware.exe" />
    <input type="hidden" name="content" value="..." />
  </form>

  Countermeasures:
  → Include CSRF token in multipart/form-data
  → Origin header validation
  → Apply CSRF protection to file upload APIs as well
```

---

## 9. Anti-Patterns

### 9.1 Common Mistakes

```
CSRF Protection Anti-Patterns:

  ✗ Anti-pattern ①: Relying solely on Referer header
  ┌──────────────────────────────────────────────────┐
  │ // Dangerous: Referer may be omitted or spoofed   │
  │ if (req.headers.referer?.includes('mysite.com')) { │
  │   // OK                                           │
  │ }                                                  │
  │ → Omitted with Referrer-Policy: no-referrer        │
  │ → Removed by some proxies                          │
  │ → Should be used only as a supplementary defense   │
  └──────────────────────────────────────────────────┘

  ✗ Anti-pattern ②: State changes via GET
  ┌──────────────────────────────────────────────────┐
  │ // Dangerous: GET sends Cookie even with Lax      │
  │ app.get('/api/delete-user/:id', deleteUser);      │
  │ app.get('/api/transfer', handleTransfer);         │
  │                                                    │
  │ → Attackable via <img src="/api/delete-user/123"> │
  │ → Always use POST/PUT/DELETE for state changes    │
  │ → RFC 7231: GET is a safe method (no side effects)│
  └──────────────────────────────────────────────────┘

  ✗ Anti-pattern ③: Predictable CSRF token generation
  ┌──────────────────────────────────────────────────┐
  │ // Dangerous: Math.random() is not cryptographically safe │
  │ const token = Math.random().toString(36);          │
  │                                                    │
  │ // Dangerous: Timestamp-based tokens are guessable │
  │ const token = Date.now().toString(16);             │
  │                                                    │
  │ // Correct: Use crypto.randomBytes()               │
  │ const token = crypto.randomBytes(32).toString('hex');│
  └──────────────────────────────────────────────────┘

  ✗ Anti-pattern ④: Including CSRF token in URLs
  ┌──────────────────────────────────────────────────┐
  │ // Dangerous: URLs are recorded in logs/Referer   │
  │ <a href="/api/action?csrf=token123">              │
  │                                                    │
  │ → Recorded in access logs                          │
  │ → Leaked via Referer header on external links      │
  │ → Remains in browser history                       │
  │ → Token should be sent in header or POST body      │
  └──────────────────────────────────────────────────┘
```

---

## 10. Exercises

### Exercise 1: Basic - CSRF Attack Simulation

```
[Exercise 1] CSRF Attack Simulation

Objective: Experience how CSRF attacks work firsthand and understand their risks

Steps:
1. Create a simple banking app with Express
   - POST /transfer (fund transfer API, Cookie auth)
   - GET /balance (balance check)
   - Use Cookies without setting the SameSite attribute

2. Create an attacker's site on a different port
   - Set up an auto-submitting form
   - Send a POST request to the banking app

3. Verify the following:
   - That visiting the attacker's site executes the transfer
   - Confirm Cookie auto-sending in DevTools
   - That setting SameSite=Lax blocks the attack

4. Advanced:
   - Try GET CSRF using an img tag
   - Try JSON CSRF (enctype="text/plain")

Evaluation Criteria:
  □ Confirm that the CSRF attack succeeds
  □ Confirm that SameSite Cookie provides protection
  □ Can explain why the attack succeeds
```

### Exercise 2: Applied - Implementing CSRF Defenses

```
[Exercise 2] Implementing CSRF Defenses

Objective: Implement and compare the major CSRF defense patterns

Steps:
1. Implement the Synchronizer Token Pattern
   - Store token in Redis
   - Embed as a hidden field in the form
   - Validate token on POST
   - Timing attack countermeasure (timingSafeEqual)

2. Implement Double Submit Cookie
   - Use HMAC-signed tokens
   - Set token in both Cookie and header
   - Validate by comparing on the server side

3. Test both implementations:
   - Legitimate requests pass
   - Requests without token are rejected
   - Requests with invalid token are rejected
   - Behavior with browser "Back" button

4. Write a comparison report:
   - Implementation complexity
   - Scalability
   - Impact on UX

Evaluation Criteria:
  □ Both patterns work correctly
  □ Edge cases are tested
  □ Comparison report is appropriate
```

### Exercise 3: Advanced - Comprehensive CSRF Protection in Next.js

```
[Exercise 3] Comprehensive CSRF Protection in Next.js

Objective: Implement defense in depth with Next.js App Router

Steps:
1. Set up a Next.js project
   - Use App Router
   - Database setup with Prisma + SQLite
   - Session authentication with Auth.js

2. Implement the following CSRF protections:
   a. Origin header validation in Middleware
   b. Double Submit Cookie (for API Routes)
   c. Verify CSRF protection of Server Actions
   d. Use __Host- prefix for Cookies

3. Create a test suite:
   - Cross-origin requests are rejected
   - Same-origin requests succeed
   - Token validation works
   - Server Actions are secure

4. Security audit:
   - Validate against OWASP CSRF Testing Guide
   - Verify the effect of each defense layer
   - Document areas for improvement

Evaluation Criteria:
  □ Defense in depth works correctly
  □ Tests are comprehensive
  □ Performance impact is measured
  □ Security audit report is created
```

---

## 11. FAQ / Troubleshooting

### Q1: Is CSRF protection really necessary in SPAs?

```
A: Yes, if you are using Cookie-based authentication.

  When storing JWT in localStorage and sending via Authorization header:
  → Not needed (because it is not auto-sent)

  When managing sessions with httpOnly Cookie:
  → Needed (because the browser auto-sends it)

  However, even in SPAs, if SameSite=Lax is set,
  most attacks can be prevented without additional token validation.
  For high-security requirements, add Double Submit Cookie.
```

### Q2: How to debug when CSRF token returns a 403 error

```
A: Check in the following order:

  1. Confirm token is being sent:
     → Check request headers in the DevTools Network tab
     → Verify presence of X-CSRF-Token header or _csrf field

  2. Check Cookie:
     → Check CSRF Cookie in DevTools Application > Cookies
     → Verify SameSite attribute is correct
     → Consistency between Secure attribute and HTTPS

  3. Check server logs:
     → Compare received token with stored token
     → Verify session ID is correct

  4. Common causes:
     → Page cache causing an old token to be used
     → Token overwritten by multiple tabs
     → Session expiration invalidating the token
     → httpOnly Cookie not readable by the client
```

### Q3: Is it safe to skip CSRF protection for Webhook endpoints?

```
A: Yes, but a separate authentication mechanism is required.

  For Webhooks:
  → CSRF tokens cannot be used because requests come from external services
  → Alternatives:
     ① HMAC signature validation (Stripe, GitHub, etc.)
     ② IP whitelist
     ③ Webhook Secret validation
     ④ mTLS (mutual TLS authentication)

  Implementation example (Stripe Webhook):
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(
    req.body, sig, process.env.STRIPE_WEBHOOK_SECRET
  );
```

### Q4: Is CSRF protection needed for a mobile app backend?

```
A: Usually not.

  Reasons:
  → Mobile apps are not browsers
  → No automatic Cookie sending occurs
  → API token authentication is common practice
  → CSRF exploits the automatic Cookie sending of browsers

  However:
  → If using WebView, Cookies may be involved
  → If the browser and API share the same backend, CSRF protection is needed
  → For mobile-only APIs, Authorization header authentication is sufficient
```

---

## 12. Performance Considerations

```
Performance Impact of CSRF Protection:

  ┌──────────────────────┬───────────────┬──────────────┐
  │ Defense Pattern      │ Latency Impact│ Memory Impact│
  ├──────────────────────┼───────────────┼──────────────┤
  │ SameSite Cookie      │ None (0ms)    │ None         │
  │ Origin validation    │ Minimal (<1ms)│ None         │
  │ Double Submit Cookie │ Minimal (<1ms)│ None         │
  │ Synchronizer Token   │ Small (1-5ms) │ Redis dep.   │
  │ Encrypted Token      │ Small (1-3ms) │ None         │
  └──────────────────────┴───────────────┴──────────────┘

  Redis access for Synchronizer Token:
  → Can share connection with the same Redis as the session store
  → Redis latency is typically 0.5-1ms
  → Can be executed concurrently with session reads via pipelining

  Optimizations:
  → Per-Session Token eliminates per-request writes
  → Double Submit Cookie requires no server state and is fastest
  → SameSite Cookie has zero CPU/memory impact
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. It is recommended to solidly understand the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in real-world work?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architectural design.

---

## Summary

| Defense Method | Effectiveness | State Mgmt | SPA Fit | Recommended Use |
|---------|------|---------|-----------|---------|
| SameSite=Lax | High | None | Automatic | Required for all apps |
| Synchronizer Token | Highest | Required (Redis etc.) | Needs work | High security |
| Double Submit Cookie | High | None | Compatible | SPA + Cookie auth |
| Signed Double Submit | Highest | None | Compatible | When subdomain risk exists |
| Origin validation | Medium | None | Compatible | Supplementary defense |
| Custom Header | High | None | Ideal | API only |
| Content-Type validation | Medium | None | Compatible | JSON API |

---

## Further Reading

---

## References
1. OWASP. "Cross-Site Request Forgery Prevention Cheat Sheet." cheatsheetseries.owasp.org, 2024.
2. MDN. "SameSite cookies." developer.mozilla.org, 2024.
3. Next.js. "Server Actions and Mutations." nextjs.org/docs, 2024.
4. RFC 7231 §4.2.1. "Safe Methods." IETF, 2014.
5. Barth, A. "Robust Defenses for Cross-Site Request Forgery." ACM CCS, 2008.
6. RFC 6265bis. "Cookies: HTTP State Management Mechanism." IETF, 2024.
7. Chromium. "SameSite Cookies Explained." web.dev, 2024.
8. OWASP. "Testing for CSRF (WSTG-SESS-05)." owasp.org, 2024.

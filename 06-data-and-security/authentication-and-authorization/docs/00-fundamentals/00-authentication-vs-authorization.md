# Fundamentals of Authentication and Authorization

> Authentication (AuthN) asks "Who are you?" and Authorization (AuthZ) asks "What are you allowed to do?" Understanding this fundamental distinction — along with threat models, security principles, and the overall authentication flow — is the first step toward building secure systems.

## What You Will Learn

- [ ] Understand the precise difference between authentication and authorization
- [ ] Grasp the major threat models and security principles
- [ ] Design the overall architecture for authentication and authorization
- [ ] Compare and choose between RBAC, ABAC, and ReBAC authorization models
- [ ] Understand the internal workings of session-based and token-based approaches
- [ ] Implement the security headers and middleware required in production

## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. The Difference Between Authentication and Authorization

```
Authentication (AuthN):
  Question: "Who are you?"
  Purpose:  Verify the identity of the user
  Examples: Password entry, fingerprint scan, Google login

  ┌─────────────────────────────────────────┐
  │  User:   "I am alice@example.com"       │
  │  System: "Please prove it with a        │
  │           password"                     │
  │  User:   "********"                     │
  │  System: "Confirmed. You are alice."    │
  └─────────────────────────────────────────┘

Authorization (AuthZ):
  Question: "What are you permitted to do?"
  Purpose:  Determine the user's access rights
  Examples: Accessing the admin panel, file edit permissions

  ┌─────────────────────────────────────────┐
  │  alice:  "I want to access the admin    │
  │           panel"                        │
  │  System: "Checking alice's permissions  │
  │           ..."                          │
  │  System: "Admin role confirmed.         │
  │           Access granted."             │
  └─────────────────────────────────────────┘

Important relationship:
  Authentication → Authorization (authentication always comes first)
  Authorization cannot occur without authentication
  Being authenticated does not guarantee being authorized
```

```
Comparison table:

  Item          │ Authentication (AuthN) │ Authorization (AuthZ)
  ──────────────┼────────────────────────┼──────────────────────
  Question      │ Who are you?           │ What can you do?
  Timing        │ Executed first         │ Executed after AuthN
  Input         │ Credentials            │ User attributes / roles
  Output        │ User ID                │ Allow / Deny
  On failure    │ 401 Unauthorized       │ 403 Forbidden
  Tech examples │ Password, JWT          │ RBAC, ABAC
  Change freq.  │ User-driven            │ Admin-driven
  Storage       │ DB / IdP               │ Policy engine
  Cache         │ Session / Token        │ Permission table / Policy
  Scale         │ Can be centralized     │ Can be distributed per
                │ in an IdP             │ service
```

### 1.1 Cases Where the Boundary Between Authentication and Authorization Becomes Blurry

```
Cases that tend to cause confusion in practice:

  Case 1: API Keys
    → Authentication? Authorization? → In practice, often "both"
    → The API key itself proves the client's identity (authentication)
    → Scopes tied to the key control permissions (authorization)
    → Problem: A leaked key compromises both authentication and authorization

  Case 2: OAuth 2.0 Scopes
    → OAuth is an "authorization delegation" protocol
    → However, adding OpenID Connect also provides "authentication"
    → scope=openid is authentication; scope=read:user is authorization

  Case 3: JWT Claims
    → sub claim: authentication information (who)
    → role / permissions claims: authorization information (what they can do)
    → A single token contains both authentication and authorization

  Case 4: IP Address Restrictions
    → "Accessible only from the internal network"
    → Is this authentication or authorization?
    → Strictly speaking, it is authorization (access control based on network location)
    → However, it implicitly implies authentication: "being on the internal network = being an employee"
```

### 1.2 Internal Workings of the Authentication/Authorization Pipeline

```
Request processing pipeline (detailed):

  HTTP Request
    │
    ▼
  ┌──────────────────────┐
  │ ① TLS Termination    │  Verify encrypted communication
  │    Certificate check │  Prevent MITM
  └──────────┬───────────┘
             │
             ▼
  ┌──────────────────────┐
  │ ② Rate Limiting      │  Per IP / user
  │    DDoS protection   │  Brute force prevention
  └──────────┬───────────┘
             │
             ▼
  ┌──────────────────────┐
  │ ③ CORS Check         │  Validate Origin header
  │    Preflight         │  Browser security
  └──────────┬───────────┘
             │
             ▼
  ┌──────────────────────┐
  │ ④ Authentication     │  Cookie / Bearer Token
  │    Identity check    │  → Identify User ID
  │    Session verify    │  → 401 or continue
  └──────────┬───────────┘
             │
             ▼
  ┌──────────────────────┐
  │ ⑤ Authorization      │  RBAC / ABAC check
  │    Permission check  │  → 403 or continue
  │    Resource access   │  → Policy evaluation
  └──────────┬───────────┘
             │
             ▼
  ┌──────────────────────┐
  │ ⑥ Input Validation   │  Validation
  │    Sanitization      │  XSS / SQLi prevention
  └──────────┬───────────┘
             │
             ▼
  ┌──────────────────────┐
  │ ⑦ Business Logic     │  Actual processing
  │    Data Access       │  DB queries
  └──────────┬───────────┘
  └──────────┬───────────┘
             │
             ▼
  ┌──────────────────────┐
  │ ⑧ Audit Log          │  Record who did what
  │    Response          │  Attach security headers
  └──────────────────────┘
```

```typescript
// Complete authentication/authorization pipeline implementation (Express)
import express, { Request, Response, NextFunction } from 'express';

// User type definition
interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
  authenticatedAt: Date;
  mfaVerified: boolean;
}

// Request extension
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      requestId?: string;
    }
  }
}

// ① Assign request ID (traceability)
function requestIdMiddleware(req: Request, _res: Response, next: NextFunction) {
  req.requestId = req.headers['x-request-id'] as string
    || crypto.randomUUID();
  next();
}

// ② Rate limiting
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function rateLimitMiddleware(maxAttempts: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const record = loginAttempts.get(key);

    if (record && record.resetAt > now) {
      if (record.count >= maxAttempts) {
        res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil((record.resetAt - now) / 1000),
        });
        return;
      }
      record.count++;
    } else {
      loginAttempts.set(key, { count: 1, resetAt: now + windowMs });
    }

    next();
  };
}

// ④ Authentication middleware (supports multiple methods)
async function authenticationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Method 1: Cookie session
  const sessionId = req.cookies?.session_id;
  if (sessionId) {
    const session = await sessionStore.get(sessionId);
    if (session && session.expiresAt > new Date()) {
      req.user = {
        id: session.userId,
        email: session.email,
        roles: session.roles,
        permissions: await resolvePermissions(session.roles),
        sessionId,
        authenticatedAt: session.authenticatedAt,
        mfaVerified: session.mfaVerified,
      };
      return next();
    }
  }

  // Method 2: Bearer token
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = await verifyJWT(token);
      req.user = {
        id: payload.sub,
        email: payload.email,
        roles: payload.roles || [],
        permissions: payload.permissions || [],
        sessionId: payload.jti,
        authenticatedAt: new Date(payload.iat * 1000),
        mfaVerified: payload.mfa_verified ?? false,
      };
      return next();
    } catch (err) {
      // Token verification failed → 401
    }
  }

  // Method 3: API key
  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey) {
    const client = await apiKeyStore.verify(apiKey);
    if (client) {
      req.user = {
        id: client.id,
        email: client.contactEmail,
        roles: ['api_client'],
        permissions: client.scopes,
        sessionId: 'api-key',
        authenticatedAt: new Date(),
        mfaVerified: false,
      };
      return next();
    }
  }

  // Authentication failed
  res.status(401).json({
    error: 'Authentication required',
    message: 'Valid session, token, or API key is required',
  });
  res.setHeader('WWW-Authenticate', 'Bearer realm="api"');
}

// ⑤ Authorization middleware (permission check)
function requirePermission(...requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const hasAll = requiredPermissions.every(
      perm => req.user!.permissions.includes(perm),
    );

    if (!hasAll) {
      // Record in audit log (authorization failure is an important security event)
      auditLog.warn('authorization_denied', {
        userId: req.user.id,
        required: requiredPermissions,
        actual: req.user.permissions,
        resource: req.originalUrl,
        method: req.method,
        ip: req.ip,
        requestId: req.requestId,
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
    }

    next();
  };
}

// Usage example
const app = express();

app.use(requestIdMiddleware);

// Public endpoint (no authentication required)
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Login (rate limited, no authentication required)
app.post('/api/auth/login',
  rateLimitMiddleware(5, 15 * 60 * 1000), // up to 5 times per 15 minutes
  loginHandler,
);

// Protected endpoint (authentication + authorization)
app.get('/api/users',
  authenticationMiddleware,
  requirePermission('users:read'),
  listUsersHandler,
);

app.delete('/api/users/:id',
  authenticationMiddleware,
  requirePermission('users:delete'),
  deleteUserHandler,
);

// Admin endpoint (authentication + admin authorization + MFA required)
app.post('/api/admin/settings',
  authenticationMiddleware,
  requireMFA,                              // Verify MFA has been completed
  requirePermission('admin:settings:write'),
  updateSettingsHandler,
);
```

---

## 2. Authentication Factors

```
The three authentication factors:

  ┌──────────────────────────────────────────────┐
  │                                              │
  │  ① Something You Know (knowledge factor)     │
  │     → Password, PIN, security question       │
  │     → Most common but most vulnerable        │
  │                                              │
  │  ② Something You Have (possession factor)    │
  │     → Smartphone, hardware key, IC card      │
  │     → TOTP, SMS code, FIDO2 security key     │
  │                                              │
  │  ③ Something You Are (inherence factor)      │
  │     → Fingerprint, face recognition,         │
  │       iris, voiceprint                       │
  │     → Cannot be changed (high risk if        │
  │       compromised)                           │
  │                                              │
  └──────────────────────────────────────────────┘

Multi-Factor Authentication (MFA):
  Combine two or more different factors
  Example: Password (knowledge) + TOTP (possession) = 2FA

  ✗ Password + security question = single factor (both "knowledge")
  ✓ Password + TOTP = multi-factor ("knowledge" + "possession")
  ✓ Password + fingerprint = multi-factor ("knowledge" + "inherence")

Order of strength:
  Password only < Password + SMS < Password + TOTP < Password + FIDO2
```

### 2.1 Detailed Comparison of Authentication Factors

```
Authentication factor strength and usability comparison:

  Method             │ Strength │ UX    │ Phishing │ Remote attack │ Cost
  ───────────────────┼──────────┼───────┼──────────┼───────────────┼──────
  Password only      │ ★☆☆     │ ★★★  │ Weak     │ Weak          │ Low
  Password + SMS     │ ★★☆     │ ★★☆  │ Somewhat │ SIM swap      │ Med
  Password + TOTP    │ ★★★     │ ★★☆  │ Somewhat │ Resistant     │ Low
  Password + Push    │ ★★★     │ ★★★  │ Somewhat │ MFA fatigue   │ Med
  Passkeys           │ ★★★     │ ★★★  │ Resistant│ Resistant     │ Low
  FIDO2 HW Key       │ ★★★     │ ★★☆  │ Resistant│ Resistant     │ High

  Resistance to each attack:
  ─────────────────────────────────────────────────────────────────
  Attack             │ Password │ SMS  │ TOTP │ Push │ FIDO2
  ───────────────────┼──────────┼──────┼──────┼──────┼──────
  Brute force        │ ✗        │ △    │ △    │ ○    │ ○
  Credential         │ ✗        │ △    │ △    │ ○    │ ○
    stuffing         │          │      │      │      │
  Phishing           │ ✗        │ ✗    │ ✗    │ △    │ ○
  SIM swap           │ -        │ ✗    │ ○    │ ○    │ ○
  MITM proxy         │ ✗        │ ✗    │ ✗    │ △    │ ○
  MFA fatigue attack │ -        │ -    │ -    │ ✗    │ ○
  Device theft       │ -        │ ✗    │ ✗    │ ✗    │ △

  ○ = Resistant  △ = Conditional  ✗ = Vulnerable  - = Not applicable
```

### 2.2 NIST SP 800-63B Authentication Assurance Levels (AAL)

```
Three authentication assurance levels defined by NIST:

  AAL1 (Low assurance):
    → Single-factor authentication is sufficient
    → Password only, or biometric only
    → Use case: General web services, social media

  AAL2 (Medium assurance):
    → Multi-factor authentication (MFA) is required
    → Combination of two different factors
    → Use case: Online banking, enterprise systems
    → Requirement: Phishing resistance not required but recommended

  AAL3 (High assurance):
    → Hardware-based cryptographic authentication is required
    → FIDO2 security key, etc.
    → Phishing resistance is required
    → Use case: Government systems, healthcare, high-risk financial transactions
    → Requirement: Verifier impersonation resistance

  Guidelines for level selection:

    Risk                        │ Recommended AAL
    ────────────────────────────┼──────────────
    Personal inconvenience      │ AAL1
    Minor financial damage      │ AAL2
    Major financial damage      │ AAL2 or AAL3
    Personal data breach        │ AAL2
    Confidential data breach    │ AAL3
    Risk to human life          │ AAL3
```

---

## 3. Threat Model

```
Major threats to authentication:

  ┌─────────────────────────┬───────────────────────────────────┐
  │ Threat                  │ Description                       │
  ├─────────────────────────┼───────────────────────────────────┤
  │ Brute force             │ Exhaustive password guessing      │
  │ Credential stuffing     │ Using leaked password lists to    │
  │                         │ attempt logins on other services  │
  │ Phishing                │ Stealing credentials via fake     │
  │                         │ sites                             │
  │ Session hijacking       │ Stealing session IDs              │
  │ CSRF                    │ Forging actions of authenticated  │
  │                         │ users                             │
  │ XSS → token theft       │ Reading tokens via script         │
  │                         │ injection                         │
  │ Man-in-the-middle(MITM) │ Intercepting/tampering with       │
  │                         │ communications                    │
  │ Replay attack           │ Re-sending legitimate requests    │
  │ Privilege escalation    │ Regular user gaining admin access │
  └─────────────────────────┴───────────────────────────────────┘
```

### 3.1 Detailed Analysis of Attack Flows

```
Attack 1: Credential Stuffing

  ① Attacker obtains leaked data from Service A
  ② Retrieves alice@example.com / password123
  ③ Attempts login on Service B, C, D... with the same credentials
  ④ Users who reuse passwords have their accounts compromised

  Countermeasures:
  → Password breach check (Have I Been Pwned API)
  → Rate limiting (limit login attempt count)
  → Enforce MFA
  → Account lockout

Attack 2: Session Fixation

  Attacker         Victim            Server
    │                │               │
    │ Obtain SID     │               │
    │───────────────────────────────>│
    │ SID=abc123     │               │
    │<───────────────────────────────│
    │                │               │
    │ Inject         │               │
    │ SID=abc123     │               │
    │ into victim    │               │
    │───────────────>│               │
    │                │ Login         │
    │                │ (SID=abc123)  │
    │                │──────────────>│
    │                │ Auth success  │
    │                │<──────────────│
    │                │               │
    │ Access with    │               │
    │ SID=abc123     │               │
    │ (authenticated)│               │
    │───────────────────────────────>│
    │ Victim's data  │               │
    │<───────────────────────────────│

  Countermeasures:
  → Regenerate session ID on successful login
  → Do not include session ID in URL parameters
  → Cookie Secure, HttpOnly, SameSite attributes
```

```
Attack 3: CSRF (Cross-Site Request Forgery)

  Victim (authenticated)  Malicious site   Legitimate server
    │                        │               │
    │ Visit malicious site   │               │
    │───────────────────────>│               │
    │                        │               │
    │ Fraudulent request     │               │
    │ (victim's Cookie       │               │
    │  is sent automatically)│               │
    │───────────────────────────────────────>│
    │                        │               │
    │                        │ Transfer done │
    │<───────────────────────────────────────│

  Malicious site HTML:
  <form action="https://bank.com/transfer" method="POST">
    <input type="hidden" name="to" value="attacker">
    <input type="hidden" name="amount" value="1000000">
  </form>
  <script>document.forms[0].submit();</script>

  Countermeasures:
  → SameSite Cookie attribute (Lax or Strict)
  → CSRF token (Synchronizer Token Pattern)
  → Custom header validation (X-Requested-With)
  → Origin / Referer header validation

Attack 4: Privilege Escalation

  Horizontal privilege escalation:
    → Access another user's resource at the same privilege level
    → Example: /api/users/123/profile → /api/users/456/profile
    → Countermeasure: Object-level authorization (check resource ownership)

  Vertical privilege escalation:
    → Access functionality at a higher privilege level
    → Example: Regular user accesses /api/admin/users
    → Countermeasure: Role-based authorization check

  Context-dependent privilege escalation:
    → Bypass the order of a business flow
    → Example: Access download link before payment
    → Countermeasure: State management + flow validation
```

```typescript
// CSRF protection implementation
import crypto from 'crypto';

class CSRFProtection {
  private secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  // Generate token
  generateToken(sessionId: string): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(16).toString('hex');
    const data = `${sessionId}:${timestamp}:${random}`;
    const hmac = crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('hex');
    return `${data}:${hmac}`;
  }

  // Verify token
  verifyToken(token: string, sessionId: string): boolean {
    const parts = token.split(':');
    if (parts.length !== 4) return false;

    const [storedSessionId, timestamp, random, providedHmac] = parts;

    // Verify session ID match
    if (storedSessionId !== sessionId) return false;

    // Check expiration (1 hour)
    const tokenTime = parseInt(timestamp, 36);
    if (Date.now() - tokenTime > 3600 * 1000) return false;

    // HMAC verification (timing-safe comparison)
    const data = `${storedSessionId}:${timestamp}:${random}`;
    const expectedHmac = crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(providedHmac, 'hex'),
      Buffer.from(expectedHmac, 'hex'),
    );
  }
}

// Use as middleware
function csrfMiddleware(csrf: CSRFProtection) {
  return (req: Request, res: Response, next: NextFunction) => {
    // GET, HEAD, OPTIONS do not require CSRF check
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      // Set token in response
      const token = csrf.generateToken(req.cookies.session_id);
      res.cookie('csrf_token', token, {
        httpOnly: false,  // Must be readable by JavaScript
        secure: true,
        sameSite: 'strict',
      });
      return next();
    }

    // Mutating requests require token verification
    const token = req.headers['x-csrf-token'] as string
      || req.body?._csrf;

    if (!token || !csrf.verifyToken(token, req.cookies.session_id)) {
      return res.status(403).json({
        error: 'Invalid CSRF token',
        message: 'Request rejected due to missing or invalid CSRF token',
      });
    }

    next();
  };
}
```

### 3.2 STRIDE Threat Modeling

```
STRIDE framework (Microsoft):

  Threat category                  │ Countermeasure
  ─────────────────────────────────┼──────────────────────
  S: Spoofing                      │ Authentication
    → Impersonate another user     │ MFA, Passkeys
                                   │
  T: Tampering                     │ Integrity verification
    → Alter data or communication  │ HMAC, digital signature
                                   │
  R: Repudiation                   │ Audit log
    → Claim "I didn't do it"       │ Timestamp, signature
                                   │
  I: Information Disclosure        │ Encryption
    → Leak of confidential info    │ Access control, TLS
                                   │
  D: Denial of Service             │ Rate limiting
    → Render service unavailable   │ Capacity management,
                                   │ CDN, WAF
                                   │
  E: Elevation of Privilege        │ Authorization
    → Gain higher privileges       │ Principle of least
                                   │ privilege, RBAC/ABAC

  Especially important for authentication/authorization systems:
  → S (Spoofing): Authentication strength is the direct defense
  → E (Elevation of Privilege): Authorization design is the direct defense
  → T (Tampering): Token signature verification is the defense
```

---

## 4. Security Principles

```
Security principles for authentication and authorization:

  ① Principle of Least Privilege:
     → Grant only the minimum permissions necessary
     → Default is "deny"
     → Admin privileges only for those who need them
     → Time-limited privilege escalation (Just-In-Time Access)

  ② Defense in Depth:
     → Do not rely on a single defense
     → Defend at each layer: network + application + DB
     → If one layer is breached, the next layer stops the attack
     → Example: WAF → API Gateway → Middleware → DB RLS

  ③ Fail Secure:
     → On error, fail to the safe side
     → Authentication error → deny access (not permit)
     → Exception occurs → revert to logged-out state
     → DB connection lost → deny by default (do not use cached permission)

  ④ Secure by Default:
     → Make the secure configuration the default
     → Cookie: HttpOnly=true, Secure=true, SameSite=Lax
     → Enforce HTTPS
     → New users get the least-privilege role

  ⑤ Zero Trust:
     → "Never trust, always verify"
     → Do not trust even the internal network
     → Authenticate and authorize every request
     → Micro-segmentation
```

### 4.1 Defense-in-Depth Implementation Example

```
Defense-in-depth architecture:

  Internet
    │
    ▼
  ┌──────────────────────────────────┐
  │ Layer 1: Network Layer           │
  │ → WAF (Web Application Firewall) │
  │ → DDoS protection (Cloudflare    │
  │   etc.)                          │
  │ → IP restrictions, Geo-blocking  │
  └──────────────┬───────────────────┘
                 │
                 ▼
  ┌──────────────────────────────────┐
  │ Layer 2: API Gateway             │
  │ → Rate limiting                  │
  │ → API key validation             │
  │ → Request size limits            │
  │ → TLS termination                │
  └──────────────┬───────────────────┘
                 │
                 ▼
  ┌──────────────────────────────────┐
  │ Layer 3: Application Layer       │
  │ → Authentication middleware      │
  │ → Authorization middleware       │
  │ → CSRF protection                │
  │ → Input validation/sanitization  │
  └──────────────┬───────────────────┘
                 │
                 ▼
  ┌──────────────────────────────────┐
  │ Layer 4: Data Layer              │
  │ → Row Level Security (RLS)       │
  │ → Encryption (at rest/in transit)│
  │ → DB user privilege separation   │
  │ → Parameterized queries          │
  └──────────────────────────────────┘
```

```typescript
// Fail-secure implementation pattern
class FailSecureAuthService {
  private tokenVerifier: TokenVerifier;
  private permissionCache: PermissionCache;
  private circuitBreaker: CircuitBreaker;

  async authenticate(token: string): Promise<AuthResult> {
    try {
      // Token verification
      const payload = await this.tokenVerifier.verify(token);
      return { authenticated: true, user: payload };
    } catch (error) {
      // Fail to "deny" on any error
      if (error instanceof TokenExpiredError) {
        return { authenticated: false, reason: 'token_expired' };
      }
      if (error instanceof InvalidSignatureError) {
        return { authenticated: false, reason: 'invalid_signature' };
      }
      // Also fail safe on unknown errors
      console.error('Unexpected auth error:', error);
      return { authenticated: false, reason: 'internal_error' };
    }
  }

  async authorize(userId: string, resource: string, action: string): Promise<boolean> {
    try {
      // Query the permission service
      if (this.circuitBreaker.isOpen()) {
        // Circuit breaker triggered → deny by default
        console.warn('Permission service circuit breaker open, denying access');
        return false;  // Fail-secure: do not permit
      }

      const permissions = await this.permissionCache.getOrFetch(userId);
      return permissions.includes(`${resource}:${action}`);
    } catch (error) {
      // Error during permission check → deny
      console.error('Authorization check failed:', error);
      return false;  // Fail-secure: do not permit
    }
  }
}

// Anti-pattern: Fail-open (never do this)
// async authorize(userId, resource, action) {
//   try {
//     const permissions = await getPermissions(userId);
//     return permissions.includes(`${resource}:${action}`);
//   } catch (error) {
//     return true;  // ✗ Permit on error = fail-open
//   }
// }
```

---

## 5. Overall Architecture for Authentication and Authorization

```
Typical authentication flow:

  User          Frontend          Backend           DB / IdP
    │               │                │               │
    │ Login screen  │                │               │
    │──────────────>│                │               │
    │               │ POST /auth/login│               │
    │               │───────────────>│               │
    │               │                │ Verify passwd │
    │               │                │──────────────>│
    │               │                │ User info     │
    │               │                │<──────────────│
    │               │                │               │
    │               │  Issue session │               │
    │               │  or token      │               │
    │               │<───────────────│               │
    │ Login success │                │               │
    │<──────────────│                │               │
    │               │                │               │
    │ Request       │                │               │
    │ protected     │                │               │
    │ resource      │                │               │
    │──────────────>│                │               │
    │               │ + Cookie/Bearer│               │
    │               │───────────────>│               │
    │               │                │ Auth check    │
    │               │                │ Authz check   │
    │               │                │──────────────>│
    │               │  200 OK + data │               │
    │               │<───────────────│               │
    │ Display data  │                │               │
    │<──────────────│                │               │
```

### 5.1 Internal Workings: Session vs Token

```
Internal workings of session-based approach:

  Client                  Server                  Session Store
    │                       │                       │
    │ POST /login           │                       │
    │ {email, password}     │                       │
    │──────────────────────>│                       │
    │                       │                       │
    │                       │ Verify password       │
    │                       │ Create session        │
    │                       │ sid = crypto.randomUUID()
    │                       │                       │
    │                       │ SET sid → {           │
    │                       │   userId, roles,      │
    │                       │   expiresAt, ip,      │
    │                       │   userAgent           │
    │                       │ }                     │
    │                       │──────────────────────>│
    │                       │                       │
    │ Set-Cookie:           │                       │
    │ session_id=<sid>;     │                       │
    │ HttpOnly; Secure;     │                       │
    │ SameSite=Lax;         │                       │
    │ Max-Age=86400         │                       │
    │<──────────────────────│                       │
    │                       │                       │
    │ GET /api/data         │                       │
    │ Cookie: session_id=sid│                       │
    │──────────────────────>│                       │
    │                       │ GET sid               │
    │                       │──────────────────────>│
    │                       │ {userId, roles, ...}  │
    │                       │<──────────────────────│
    │                       │                       │
    │                       │ Check expiry          │
    │                       │ Verify IP / UA        │
    │                       │ Authz check by role   │
    │                       │                       │
    │ 200 OK + data         │                       │
    │<──────────────────────│                       │

  Characteristics of session-based approach:
    Advantages:
      → Server can invalidate session instantly
      → Session data is easy to update
      → HttpOnly Cookie protects against XSS
      → No size limit on session data

    Disadvantages:
      → Server requires state (session store)
      → Session sharing required when scaling
        → Distributed store such as Redis / Memcached
      → Difficult to share across microservices
      → Slightly cumbersome integration with mobile apps
```

```
Internal workings of token-based (JWT) approach:

  Client                  Server                  DB
    │                       │                       │
    │ POST /login           │                       │
    │ {email, password}     │                       │
    │──────────────────────>│                       │
    │                       │                       │
    │                       │ Verify password       │
    │                       │──────────────────────>│
    │                       │<──────────────────────│
    │                       │                       │
    │                       │ Generate JWT:         │
    │                       │ Header = {            │
    │                       │   alg: "RS256",       │
    │                       │   typ: "JWT"          │
    │                       │ }                     │
    │                       │ Payload = {           │
    │                       │   sub: "user123",     │
    │                       │   roles: ["admin"],   │
    │                       │   exp: 1700000000,    │
    │                       │   iat: 1699996400     │
    │                       │ }                     │
    │                       │ Signature = RS256(    │
    │                       │   header + payload,   │
    │                       │   privateKey          │
    │                       │ )                     │
    │                       │                       │
    │ {                     │                       │
    │   access_token: "ey.."│                       │
    │   refresh_token:"ey.."│                       │
    │   expires_in: 3600    │                       │
    │ }                     │                       │
    │<──────────────────────│                       │
    │                       │                       │
    │ GET /api/data         │                       │
    │ Authorization:        │                       │
    │ Bearer ey..           │                       │
    │──────────────────────>│                       │
    │                       │                       │
    │                       │ Verify JWT:           │
    │                       │ ① Verify signature    │
    │                       │   (public key)        │
    │                       │ ② Check exp           │
    │                       │ ③ Check iss, aud      │
    │                       │ ④ Authz by roles      │
    │                       │   (no DB access!)     │
    │                       │                       │
    │ 200 OK + data         │                       │
    │<──────────────────────│                       │

  Characteristics of token-based approach:
    Advantages:
      → Stateless (no session store needed on server)
      → Easy to scale (any server can verify)
      → Ideal for microservices
      → Easy integration with mobile / SPA
      → No DB access needed for verification

    Disadvantages:
      → Difficult to invalidate tokens (requires blacklist)
      → Practical payload size limit (HTTP header constraint ~8KB)
      → Higher risk when token is leaked
      → Permission changes are not reflected until token expires
```

```typescript
// Session-based implementation
import { Redis } from 'ioredis';
import crypto from 'crypto';

class SessionManager {
  private redis: Redis;
  private defaultTTL: number = 24 * 60 * 60; // 24 hours

  constructor(redis: Redis) {
    this.redis = redis;
  }

  // Create session
  async createSession(
    userId: string,
    metadata: { ip: string; userAgent: string; roles: string[] },
  ): Promise<string> {
    const sessionId = crypto.randomBytes(32).toString('hex');

    const sessionData = {
      userId,
      roles: metadata.roles,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      ip: metadata.ip,
      userAgent: metadata.userAgent,
    };

    await this.redis.setex(
      `session:${sessionId}`,
      this.defaultTTL,
      JSON.stringify(sessionData),
    );

    // Also record in the user's active session list
    await this.redis.sadd(`user_sessions:${userId}`, sessionId);

    return sessionId;
  }

  // Validate session
  async getSession(sessionId: string): Promise<SessionData | null> {
    const raw = await this.redis.get(`session:${sessionId}`);
    if (!raw) return null;

    const session = JSON.parse(raw) as SessionData;

    // Sliding window: extend expiry on every access
    session.lastAccessedAt = Date.now();
    await this.redis.setex(
      `session:${sessionId}`,
      this.defaultTTL,
      JSON.stringify(session),
    );

    return session;
  }

  // Destroy session
  async destroySession(sessionId: string): Promise<void> {
    const raw = await this.redis.get(`session:${sessionId}`);
    if (raw) {
      const session = JSON.parse(raw);
      await this.redis.srem(`user_sessions:${session.userId}`, sessionId);
    }
    await this.redis.del(`session:${sessionId}`);
  }

  // Destroy all sessions for a specific user (e.g., on password change)
  async destroyAllSessions(userId: string): Promise<void> {
    const sessionIds = await this.redis.smembers(`user_sessions:${userId}`);
    if (sessionIds.length > 0) {
      const keys = sessionIds.map(id => `session:${id}`);
      await this.redis.del(...keys);
    }
    await this.redis.del(`user_sessions:${userId}`);
  }
}

// Session fixation countermeasure
async function loginHandler(req: Request, res: Response) {
  const { email, password } = req.body;

  const user = await authenticateUser(email, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Important: destroy existing session on successful login and create a new one
  // → Prevents session fixation attacks
  if (req.cookies.session_id) {
    await sessionManager.destroySession(req.cookies.session_id);
  }

  const newSessionId = await sessionManager.createSession(user.id, {
    ip: req.ip,
    userAgent: req.headers['user-agent'] || '',
    roles: user.roles,
  });

  res.cookie('session_id', newSessionId, {
    httpOnly: true,    // Not accessible by JavaScript
    secure: true,      // HTTPS only
    sameSite: 'lax',   // CSRF protection
    maxAge: 24 * 60 * 60 * 1000,  // 24 hours
    path: '/',
  });

  res.json({ success: true, user: { id: user.id, email: user.email } });
}
```

### 5.2 Criteria for Choosing Between Session and Token

```
Decision criteria for selecting an approach:

  Item                │ Session          │ JWT Token
  ────────────────────┼──────────────────┼────────────────────
  State management    │ Server-side       │ Client-side
  Storage             │ Requires Redis    │ Not required
  Scalability         │ △ Store sharing  │ ○ Stateless
  Instant invalidation│ ○ Immediate       │ △ Requires blacklist
  Payload size        │ Unlimited         │ ~8KB (header limit)
  DB access           │ Every request     │ Not needed (verify only)
  Microservices       │ △ Shared store   │ ○ Public key only
  Mobile support      │ △ Cookie mgmt    │ ○ Header-based
  XSS resistance      │ ○ HttpOnly       │ △ Depends on storage
  CSRF resistance     │ △ Needs measures │ ○ Header-based

  Recommended patterns:

    Web app (SSR)            → Session + Cookie
    SPA + BFF                → Session (BFF manages Cookie)
    SPA + direct API         → JWT (short-lived access + refresh)
    Mobile app               → JWT
    Between microservices    → JWT (Client Credentials)
    Hybrid                   → Session (Web) + JWT (API)
```

---

## 6. Authorization Models in Detail

### 6.1 RBAC (Role-Based Access Control)

```
How RBAC works:

  User ──has──> Role ──has──> Permission

  Example:
  alice ──has──> admin ──has──> users:read
                               users:write
                               users:delete
                               settings:read
                               settings:write

  bob   ──has──> editor ──has──> users:read
                                posts:read
                                posts:write

  carol ──has──> viewer ──has──> users:read
                                posts:read

  RBAC hierarchy (Hierarchical RBAC):
  ┌────────┐
  │ admin  │ → Encompasses all permissions
  ├────────┤
  │ editor │ → viewer permissions + edit permissions
  ├────────┤
  │ viewer │ → Read-only permissions
  └────────┘
```

```typescript
// RBAC implementation
interface Role {
  name: string;
  permissions: string[];
  inherits?: string[];  // Roles to inherit from
}

class RBACEngine {
  private roles: Map<string, Role> = new Map();

  registerRole(role: Role): void {
    this.roles.set(role.name, role);
  }

  // Get all permissions for a role (including inherited)
  getPermissions(roleName: string, visited = new Set<string>()): string[] {
    if (visited.has(roleName)) return []; // Prevent circular reference
    visited.add(roleName);

    const role = this.roles.get(roleName);
    if (!role) return [];

    const permissions = new Set(role.permissions);

    // Inherit permissions from parent roles
    for (const parent of role.inherits || []) {
      for (const perm of this.getPermissions(parent, visited)) {
        permissions.add(perm);
      }
    }

    return Array.from(permissions);
  }

  // Permission check
  hasPermission(userRoles: string[], permission: string): boolean {
    for (const roleName of userRoles) {
      const permissions = this.getPermissions(roleName);
      if (permissions.includes(permission)) return true;

      // Wildcard support: "admin:*" matches "admin:read"
      for (const perm of permissions) {
        if (perm.endsWith(':*')) {
          const prefix = perm.slice(0, -1);
          if (permission.startsWith(prefix)) return true;
        }
      }
    }
    return false;
  }
}

// Usage example
const rbac = new RBACEngine();

rbac.registerRole({
  name: 'viewer',
  permissions: ['posts:read', 'users:read'],
});

rbac.registerRole({
  name: 'editor',
  permissions: ['posts:write', 'posts:delete'],
  inherits: ['viewer'],  // Inherit viewer permissions
});

rbac.registerRole({
  name: 'admin',
  permissions: ['users:write', 'users:delete', 'settings:*'],
  inherits: ['editor'],  // Inherit editor (+ viewer) permissions
});

// Checks
rbac.hasPermission(['editor'], 'posts:read');    // true (inherited from viewer)
rbac.hasPermission(['editor'], 'users:delete');  // false
rbac.hasPermission(['admin'], 'settings:write'); // true (wildcard)
```

### 6.2 ABAC (Attribute-Based Access Control)

```
How ABAC works:

  Policy = Subject attributes + Resource attributes + Environment attributes + Action

  Example: "Full-time employees at the Tokyo office can view confidential
            documents of their department during business hours on weekdays"

  Subject attributes:
    → role: employee
    → department: engineering
    → office: tokyo
    → employment_type: full_time

  Resource attributes:
    → type: document
    → classification: confidential
    → department: engineering

  Environment attributes:
    → time: 10:30 JST (within business hours)
    → day: Monday (weekday)
    → ip: 10.0.1.xxx (internal network)

  Action:
    → read

  Policy evaluation:
    subject.role == "employee"
    AND subject.department == resource.department
    AND environment.time BETWEEN "09:00" AND "18:00"
    AND environment.day IN ["Monday".."Friday"]
    → PERMIT
```

```typescript
// ABAC implementation
interface ABACContext {
  subject: Record<string, any>;     // User attributes
  resource: Record<string, any>;    // Resource attributes
  action: string;                   // Action
  environment: Record<string, any>; // Environment attributes
}

interface ABACPolicy {
  name: string;
  description: string;
  effect: 'permit' | 'deny';
  condition: (ctx: ABACContext) => boolean;
  priority: number;  // Higher number = higher priority
}

class ABACEngine {
  private policies: ABACPolicy[] = [];

  addPolicy(policy: ABACPolicy): void {
    this.policies.push(policy);
    // Sort by priority
    this.policies.sort((a, b) => b.priority - a.priority);
  }

  evaluate(context: ABACContext): { allowed: boolean; matchedPolicy?: string } {
    for (const policy of this.policies) {
      try {
        if (policy.condition(context)) {
          return {
            allowed: policy.effect === 'permit',
            matchedPolicy: policy.name,
          };
        }
      } catch {
        // Policy evaluation error → skip (fail-secure)
        continue;
      }
    }

    // No policy matched → default deny
    return { allowed: false, matchedPolicy: 'default_deny' };
  }
}

// Usage example
const abac = new ABACEngine();

// Policy: Only full-time employees can view confidential docs of their dept (business hours)
abac.addPolicy({
  name: 'confidential_doc_access',
  description: 'Full-time employees can view confidential documents of their department during business hours',
  effect: 'permit',
  priority: 10,
  condition: (ctx) => {
    const { subject, resource, action, environment } = ctx;
    return (
      action === 'read' &&
      resource.classification === 'confidential' &&
      subject.employment_type === 'full_time' &&
      subject.department === resource.department &&
      environment.hour >= 9 && environment.hour < 18 &&
      environment.dayOfWeek >= 1 && environment.dayOfWeek <= 5
    );
  },
});

// Policy: Admins can access all resources
abac.addPolicy({
  name: 'admin_full_access',
  description: 'Admins can access all resources',
  effect: 'permit',
  priority: 100,  // Highest priority
  condition: (ctx) => ctx.subject.role === 'admin',
});

// Evaluation
const result = abac.evaluate({
  subject: { role: 'employee', department: 'engineering', employment_type: 'full_time' },
  resource: { type: 'document', classification: 'confidential', department: 'engineering' },
  action: 'read',
  environment: { hour: 14, dayOfWeek: 3 },
});
// → { allowed: true, matchedPolicy: 'confidential_doc_access' }
```

### 6.3 Comparison of Authorization Models

```
Authorization model comparison:

  Item            │ RBAC           │ ABAC              │ ReBAC
  ────────────────┼────────────────┼───────────────────┼──────────────
  Basic unit      │ Role           │ Attribute         │ Relationship
  Flexibility     │ Medium         │ High              │ High
  Complexity      │ Low            │ High              │ Medium~High
  Performance     │ High           │ Medium            │ Medium
  Ease of mgmt    │ ○ Intuitive   │ △ Complex policy  │ ○ Graph-based
  Ease of audit   │ ○ Role trace  │ △ Many conditions │ ○ Relation trace
  Use case        │ Enterprise app │ Healthcare, finance│ SNS, file sharing
  Representative  │ Casbin         │ OPA/Rego          │ SpiceDB/Zanzibar
  tools           │                │                   │

  Concrete examples:
    RBAC:  "Admins can view the user list"
    ABAC:  "Full-time employees at the Tokyo office can view confidential
            documents during business hours"
    ReBAC: "The owner of this folder can delete files in it"
           "The viewer of this file can read it"
           "An editor of the parent folder is also an editor of child files"

  Selection guidelines:
    → Simple permission management → RBAC
    → Fine-grained conditional control → ABAC
    → Resource ownership-based → ReBAC
    → Combined → RBAC + ABAC hybrid (most common in practice)
```

---

## 7. Overview of Authentication Methods

```
Classification of authentication methods:

  ┌─────────────────────────────────────────────────┐
  │                                                 │
  │  Server-side (Stateful)                         │
  │  ├── Session + Cookie                           │
  │  │   → Keep session state on server             │
  │  │   → Send session ID via Cookie               │
  │  │   → Ideal for traditional web apps           │
  │  │                                              │
  │  Client-side (Stateless)                        │
  │  ├── JWT (JSON Web Token)                       │
  │  │   → Token contains information (self-        │
  │  │     contained)                               │
  │  │   → Ideal for API authentication             │
  │  │                                              │
  │  Delegated (Third-party authentication)         │
  │  ├── OAuth 2.0                                  │
  │  │   → Delegation of authorization (grant       │
  │  │     access to third-party apps)              │
  │  ├── OpenID Connect                             │
  │  │   → Authentication layer on top of OAuth 2.0 │
  │  ├── SAML                                       │
  │  │   → Enterprise SSO                           │
  │  │                                              │
  │  Passwordless                                   │
  │  ├── Magic Link                                 │
  │  │   → Send one-time link via email             │
  │  ├── WebAuthn / Passkeys                        │
  │  │   → Authentication via public key            │
  │  │     cryptography                             │
  │  │   → Strongest phishing resistance            │
  │  └── OTP                                        │
  │      → One-time password (SMS / email)          │
  │                                                 │
  └─────────────────────────────────────────────────┘
```

### 7.1 Detailed Comparison of Authentication Methods

```
Detailed comparison of authentication methods:

  Method             │ Security │ UX   │ Impl cost │ Op cost │ Use case
  ───────────────────┼──────────┼──────┼───────────┼─────────┼──────────
  Password           │ ★★☆     │ ★★★ │ ★☆☆       │ ★★★    │ General
  Session + Cookie   │ ★★★     │ ★★★ │ ★★☆       │ ★★☆    │ Web
  JWT                │ ★★☆     │ ★★☆ │ ★★☆       │ ★☆☆    │ API
  OAuth 2.0/OIDC    │ ★★★     │ ★★★ │ ★★★       │ ★★☆    │ SSO
  SAML               │ ★★★     │ ★★☆ │ ★★★       │ ★★★    │ Enterprise
  Magic Link         │ ★★☆     │ ★★★ │ ★☆☆       │ ★★☆    │ B2C
  Passkeys           │ ★★★     │ ★★★ │ ★★★       │ ★☆☆    │ Next-gen
  API Key            │ ★★☆     │ ★★★ │ ★☆☆       │ ★☆☆    │ M2M
  mTLS               │ ★★★     │ ★☆☆ │ ★★★       │ ★★★    │ Internal
```

```typescript
// Unified interface for multiple authentication providers
interface AuthProvider {
  name: string;
  authenticate(credentials: unknown): Promise<AuthResult>;
  supports(req: Request): boolean;
}

class AuthProviderChain {
  private providers: AuthProvider[] = [];

  register(provider: AuthProvider): void {
    this.providers.push(provider);
  }

  async authenticate(req: Request): Promise<AuthResult> {
    for (const provider of this.providers) {
      if (provider.supports(req)) {
        try {
          const result = await provider.authenticate(req);
          if (result.authenticated) {
            return result;
          }
        } catch (error) {
          // Provider error → try next provider
          console.warn(`Auth provider ${provider.name} failed:`, error);
        }
      }
    }
    return { authenticated: false, reason: 'no_valid_credentials' };
  }
}

// Session provider
class SessionAuthProvider implements AuthProvider {
  name = 'session';

  supports(req: Request): boolean {
    return !!req.cookies?.session_id;
  }

  async authenticate(req: Request): Promise<AuthResult> {
    const session = await sessionStore.get(req.cookies.session_id);
    if (!session || session.expiresAt < new Date()) {
      return { authenticated: false, reason: 'session_expired' };
    }
    return { authenticated: true, user: session.user };
  }
}

// JWT provider
class JWTAuthProvider implements AuthProvider {
  name = 'jwt';

  supports(req: Request): boolean {
    return !!req.headers.authorization?.startsWith('Bearer ');
  }

  async authenticate(req: Request): Promise<AuthResult> {
    const token = req.headers.authorization!.slice(7);
    const payload = await verifyJWT(token);
    return { authenticated: true, user: payload };
  }
}

// API key provider
class APIKeyAuthProvider implements AuthProvider {
  name = 'api_key';

  supports(req: Request): boolean {
    return !!req.headers['x-api-key'];
  }

  async authenticate(req: Request): Promise<AuthResult> {
    const key = req.headers['x-api-key'] as string;
    const client = await apiKeyStore.verify(key);
    if (!client) {
      return { authenticated: false, reason: 'invalid_api_key' };
    }
    return { authenticated: true, user: { id: client.id, roles: client.roles } };
  }
}

// Combine providers
const authChain = new AuthProviderChain();
authChain.register(new SessionAuthProvider());
authChain.register(new JWTAuthProvider());
authChain.register(new APIKeyAuthProvider());
```

---

## 8. HTTP Status Codes and Authentication/Authorization

```
HTTP status codes related to authentication and authorization:

  401 Unauthorized (authentication error):
    → Authentication is required, or authentication failed
    → Should return a WWW-Authenticate header
    → Example: Token not sent, token expired

  403 Forbidden (authorization error):
    → Authenticated but lacks permission
    → Re-authentication will not change the result
    → Example: Regular user accessing the admin panel

  407 Proxy Authentication Required:
    → Proxy authentication is required
    → Proxy-Authenticate header

Common mistakes:
  ✗ Returning 403 for unauthenticated requests → 401 is correct
  ✗ Returning 401 for insufficient permissions → 403 is correct
  ✗ When hiding the existence of a resource → return 404 (prevent information disclosure)
```

### 8.1 Precise Usage of Status Codes

```
Status code decision flowchart:

  Request received
    │
    ├── No authentication information?
    │     └── YES → 401 Unauthorized
    │              + WWW-Authenticate header
    │
    ├── Authentication information is invalid? (expired, bad signature, etc.)
    │     └── YES → 401 Unauthorized
    │
    ├── Authentication succeeded, but insufficient permissions?
    │     └── YES → 403 Forbidden
    │
    ├── Resource does not exist?
    │     ├── User should know the resource exists
    │     │     └── YES → 404 Not Found
    │     └── The existence of the resource should be hidden
    │           └── YES → 404 Not Found (not 403)
    │                     * Prevent information disclosure
    │
    ├── Method is not allowed?
    │     └── YES → 405 Method Not Allowed
    │
    └── Everything OK
          └── 200 OK / 201 Created / 204 No Content

  Complex real-world cases:

    Case: Regular user accesses admin API
      → 403 is correct (authenticated, no permission)
      → However, 404 if you want to hide the API's existence

    Case: User accesses another user's resource
      → 403 is the baseline (no access permission)
      → However, 404 is more secure (hides resource existence)

    Case: Login attempt where user does not exist
      → "User does not exist" is wrong (user enumeration attack)
      → "Invalid email address or password" is correct
      → Status code is 401 (same regardless of whether user exists)
```

```typescript
// Correct response handling (complete version)
import { Request, Response } from 'express';

class AuthResponseHandler {
  // Authentication error (401)
  static unauthorized(res: Response, scheme: string = 'Bearer'): Response {
    return res
      .status(401)
      .set('WWW-Authenticate', `${scheme} realm="api"`)
      .json({
        error: 'unauthorized',
        message: 'Authentication is required to access this resource',
        // Keep error details vague for security reasons
      });
  }

  // Authorization error (403)
  static forbidden(res: Response): Response {
    return res
      .status(403)
      .json({
        error: 'forbidden',
        message: 'You do not have permission to access this resource',
      });
  }

  // Resource not found (404) - also used to hide resource existence
  static notFound(res: Response): Response {
    return res
      .status(404)
      .json({
        error: 'not_found',
        message: 'The requested resource was not found',
      });
  }

  // Rate limit (429)
  static tooManyRequests(res: Response, retryAfter: number): Response {
    return res
      .status(429)
      .set('Retry-After', String(retryAfter))
      .json({
        error: 'too_many_requests',
        message: 'Rate limit exceeded',
        retryAfter,
      });
  }

  // Integrated check
  static handleAccessCheck(
    res: Response,
    user: User | null,
    resource: Resource | null,
    requiredPermission: string,
  ): Response | null {
    // Not authenticated
    if (!user) {
      return this.unauthorized(res);
    }

    // Resource does not exist
    if (!resource) {
      return this.notFound(res);
    }

    // Permission check
    if (!hasPermission(user, resource, requiredPermission)) {
      // Should the resource existence be hidden?
      if (shouldHideResourceExistence(resource)) {
        return this.notFound(res); // 404 instead of 403
      }
      return this.forbidden(res);
    }

    // Access permitted → return null (caller continues)
    return null;
  }
}

// Preventing user enumeration attacks
async function loginHandler(req: Request, res: Response) {
  const { email, password } = req.body;

  // Spend the same amount of time as password verification even if user does not exist
  const user = await findUserByEmail(email);

  if (!user) {
    // Dummy hash comparison (prevent timing attacks)
    await bcrypt.compare(password, '$2b$12$dummy.hash.to.prevent.timing.attacks');
    return res.status(401).json({
      error: 'invalid_credentials',
      message: 'Invalid email or password',  // Ambiguous message
    });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({
      error: 'invalid_credentials',
      message: 'Invalid email or password',  // Same message
    });
  }

  // Successful login processing...
}
```

---

## 9. Implementing Security Headers

```
Important security headers related to authentication and authorization:

  ┌────────────────────────────────────────────────────────┐
  │ Header                            │ Purpose            │
  ├────────────────────────────────────────────────────────┤
  │ Strict-Transport-Security         │ Enforce HTTPS      │
  │ X-Content-Type-Options            │ MIME sniffing      │
  │ X-Frame-Options                   │ Clickjacking       │
  │ Content-Security-Policy           │ XSS / Injection    │
  │ X-XSS-Protection                  │ XSS filter         │
  │ Referrer-Policy                   │ Referrer control   │
  │ Permissions-Policy                │ Browser feature    │
  │                                   │ restrictions       │
  │ Cache-Control                     │ Prevent caching    │
  │                                   │ of auth data       │
  └────────────────────────────────────────────────────────┘
```

```typescript
// Security headers middleware
function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Enforce HTTPS (1 year, including subdomains)
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload',
  );

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // XSS protection (CSP is the main defense; this is an additional layer)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Content Security Policy
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'nonce-${nonce}'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.example.com",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
  ].join('; '));

  // Referrer control
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Prevent caching of authenticated responses
  if (req.user) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }

  next();
}
```

---

## 10. Audit Logging

```
Importance of audit logging:

  Record "who did what and when"
  → Investigate security incidents
  → Satisfy compliance requirements
  → Detect unauthorized access early

  Events to record:
  ┌──────────────────────────────┬────────────┐
  │ Event                        │ Severity   │
  ├──────────────────────────────┼────────────┤
  │ Successful login             │ INFO       │
  │ Failed login                 │ WARN       │
  │ Consecutive login failures   │ ALERT      │
  │ Password change              │ INFO       │
  │ MFA enabled / disabled       │ INFO       │
  │ Permission change            │ WARN       │
  │ Admin operation              │ INFO       │
  │ Authorization denied         │ WARN       │
  │ Token invalidated            │ INFO       │
  │ Abnormal access pattern      │ ALERT      │
  │ Login from new device        │ WARN       │
  └──────────────────────────────┴────────────┘
```

```typescript
// Audit log service
interface AuditLogEntry {
  timestamp: Date;
  eventType: string;
  severity: 'info' | 'warn' | 'alert' | 'critical';
  userId?: string;
  ip: string;
  userAgent: string;
  resource?: string;
  action?: string;
  result: 'success' | 'failure' | 'denied';
  metadata?: Record<string, unknown>;
  requestId: string;
}

class AuditLogger {
  private transport: AuditTransport;

  constructor(transport: AuditTransport) {
    this.transport = transport;
  }

  // Record authentication event
  async logAuthEvent(
    eventType: 'login' | 'logout' | 'login_failed' | 'mfa_verify' | 'password_change',
    req: Request,
    details: { userId?: string; reason?: string },
  ): Promise<void> {
    const entry: AuditLogEntry = {
      timestamp: new Date(),
      eventType: `auth.${eventType}`,
      severity: eventType.includes('failed') ? 'warn' : 'info',
      userId: details.userId || req.user?.id,
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      result: eventType.includes('failed') ? 'failure' : 'success',
      metadata: {
        reason: details.reason,
        sessionId: req.cookies?.session_id,
      },
      requestId: req.requestId || 'unknown',
    };

    // Detect consecutive failures
    if (eventType === 'login_failed') {
      await this.checkBruteForce(req.ip!, details.userId);
    }

    await this.transport.write(entry);
  }

  // Record authorization event
  async logAuthzEvent(
    req: Request,
    resource: string,
    action: string,
    result: 'success' | 'denied',
  ): Promise<void> {
    const entry: AuditLogEntry = {
      timestamp: new Date(),
      eventType: 'authz.check',
      severity: result === 'denied' ? 'warn' : 'info',
      userId: req.user?.id,
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      resource,
      action,
      result,
      requestId: req.requestId || 'unknown',
    };

    await this.transport.write(entry);
  }

  // Brute force detection
  private async checkBruteForce(ip: string, userId?: string): Promise<void> {
    const key = userId ? `bf:user:${userId}` : `bf:ip:${ip}`;
    const count = await redis.incr(key);
    await redis.expire(key, 900); // 15-minute window

    if (count >= 10) {
      // Fire alert
      await this.transport.write({
        timestamp: new Date(),
        eventType: 'security.brute_force_detected',
        severity: 'alert',
        userId,
        ip,
        userAgent: '',
        result: 'failure',
        metadata: { failureCount: count, windowMinutes: 15 },
        requestId: 'system',
      });

      // Automatic countermeasure: temporarily lock IP / account
      if (userId) {
        await redis.setex(`locked:user:${userId}`, 900, '1');
      }
      await redis.setex(`locked:ip:${ip}`, 900, '1');
    }
  }
}
```

---

## 11. Anti-Patterns

```
Authentication and authorization anti-patterns:

  ① Fail-open:
     ✗ Permit access on error
     → "Allow all" when authorization service is down
     → "Skip authentication" on DB connection error
     Countermeasure: Always deny access on error

  ② Security through Obscurity:
     ✗ "This URL is safe because nobody knows it"
     → /admin-secret-panel-xyz can be guessed
     → Hidden API endpoints can also be discovered
     Countermeasure: Apply authentication and authorization to all endpoints

  ③ Client-side authorization:
     ✗ Checking permissions only on the frontend
     → Hiding a button is not authorization
     → JavaScript conditions can be bypassed
     Countermeasure: Always check authorization on the server (UI is for UX only)

  ④ Over-granting permissions:
     ✗ "It's a hassle, so let's make everyone admin"
     → One compromise = entire system compromised
     Countermeasure: Strictly enforce the principle of least privilege

  ⑤ Hardcoded credentials:
     ✗ Writing API keys or passwords directly in source code
     → Remains in Git history
     → Cannot be changed per deployment environment
     Countermeasure: Environment variables / Secrets Manager

  ⑥ Missing ambiguous error messages:
     ✗ "This email address is not registered"
     → Used in user enumeration attacks
     Countermeasure: "Invalid email address or password"

  ⑦ Improper session management:
     ✗ Not destroying server-side session on logout
     ✗ Not invalidating existing sessions after password change
     ✗ Including session ID in URL parameters
     Countermeasure: Explicit session destruction + proper Cookie attribute settings

  ⑧ Confusing authentication with authorization:
     ✗ Designing under the assumption that authenticated = can do anything
     → All users can access all APIs
     Countermeasure: Clearly separate authentication and authorization
```

---

## 12. Edge Cases

```
Edge cases in authentication and authorization:

  ① Immediate permission reflection vs performance:
     → Admin changes a user's permissions
     → With JWT, old permissions are valid until token expiry
     → With sessions, caching can delay reflection
     Countermeasure: Provide a mechanism for immediate reflection of critical
                     permission changes
                     (blacklist, session invalidation, short-lived tokens)

  ② Concurrent sessions:
     → User is logged in on multiple devices simultaneously
     → Password changed on one device → what happens to other sessions?
     → Finance: concurrent sessions forbidden (only latest is valid)
     → General: invalidate all sessions + require re-login

  ③ Timezone and expiry:
     → JWT exp is recorded in UTC
     → Clock skew between server and client
     → Countermeasure: Validate only on server side + NTP sync
     → Acceptable range: ±30 seconds clock skew

  ④ Role deletion:
     → Want to retire the "editor" role
     → What happens to existing "editor" users' permissions?
     → A migration strategy is needed
     → Soft delete + gradual migration to new role

  ⑤ Admin deleting their own permissions:
     → The last admin deletes their own admin role
     → No admin remains in the system
     → Countermeasure: Enforce "at least one admin required" constraint
```

---

## 13. Exercises

```
Exercise 1 (Basics): Determining authentication and authorization

  For each scenario below, provide the appropriate HTTP status code
  and response message.

  Scenarios:
  a) No Authorization header in API request
  b) JWT token has an invalid signature
  c) Valid token but regular user accesses /admin
  d) Login form submitted with a non-existent email address
  e) Authenticated user accesses another person's profile
     (when you want to hide the resource's existence)

  Expected answers:
  → Status code
  → Response body message
  → Required headers
```

```
Exercise 2 (Applied): Designing an RBAC engine

  Implement an RBAC engine satisfying the following requirements.

  Requirements:
  1. Hierarchical role structure (admin > editor > viewer)
  2. Wildcard permissions ("posts:*" matches "posts:read")
  3. Deny permissions ("!users:delete" explicitly denies a specific operation)
  4. Dynamic role addition and deletion
  5. Permission cache (Redis)

  Test cases:
  → Verify that admin has "users:delete"
  → Verify that editor has "posts:read" (inherited)
  → Verify that "!users:delete" on editor results in denial
```

```
Exercise 3 (Advanced): Implementing a Zero Trust API Gateway

  Implement an API Gateway with the following capabilities.

  Requirements:
  1. Support multiple authentication methods (Session, JWT, API Key)
  2. Execute authentication and authorization for each request
  3. Rate limiting (per IP + per user)
  4. Audit log recording
  5. Circuit Breaker pattern (control when authorization service is down)
  6. Request normalization (prevent path traversal, etc.)

  Test scenarios:
  → Normal authentication flow (each method)
  → Correct status code on authentication failure
  → 429 response when rate limit is reached
  → Fallback (deny) when authorization service is down
```

---

## 14. FAQ & Troubleshooting

```
Q1: I can't figure out when to use 401 vs 403.
A1: Use the following rule:
    → No / invalid authentication information → 401
    → Authenticated but insufficient permission → 403
    → When in doubt: "Would re-authentication change the result?"
      YES → 401 (authentication problem)
      NO  → 403 (authorization problem)

Q2: Which should I use, JWT or sessions?
A2: It depends on your architecture:
    → Monolithic web app → Session (simple, can invalidate immediately)
    → SPA + API → JWT (stateless, easier CORS handling)
    → Microservices → JWT (share only public key between services)
    → Hybrid → BFF pattern (session + JWT for internal use)

Q3: How do I choose between RBAC and ABAC?
A3: Judge by complexity:
    → Permission determined by "who" → RBAC (simple)
    → Permission determined by "conditions" → ABAC (flexible)
    → In practice, RBAC + conditional checks (hybrid) is most common

Q4: Are API keys secure?
A4: Conditionally secure:
    → Server-to-server communication → OK (managed in a secure environment)
    → Frontend → NO (high leak risk)
    → API keys cover authentication (identity verification) only; authorization is separate
    → A rotation mechanism (regular updates) is required

Q5: How should I implement a password reset feature?
A5: Key points for a secure implementation:
    → Return the same response regardless of whether the user exists
    → Reset token must be a cryptographically secure random value
    → Short expiry (15-30 minutes)
    → Invalidate immediately after use
    → Invalidate all sessions on successful reset

Q6: What happens if CORS is misconfigured?
A6: Impact of misconfiguration:
    → Access-Control-Allow-Origin: * + credentials: true
      → Browser blocks it (prohibited by spec)
    → Not restricting to specific Origins
      → API calls possible from any site (including Cookie submission)
    → Preflight cache too long
      → CORS configuration changes are not reflected

Q7: Where should I store authentication information?
A7: Risk by storage location:
    → Cookie (HttpOnly, Secure): XSS-resistant, CSRF countermeasures needed
    → localStorage: Can be stolen via XSS, CSRF-resistant
    → sessionStorage: Cleared when tab is closed, can be stolen via XSS
    → Memory (variable): Most secure but lost on reload
    Recommended: Session → HttpOnly Cookie
                 JWT → Memory + refresh in HttpOnly Cookie (BFF pattern)
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Rather than theory alone, writing actual code and verifying its behavior deepens your understanding.

### Q2: What mistakes do beginners commonly make?

Skipping fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving to the next step.

### Q3: How is this used in real-world work?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Concept | Key Points |
|---------|-----------|
| Authentication | Verify "who". Returns 401 on failure |
| Authorization | Determine "what they can do". Returns 403 on failure |
| Authentication factors | Three factors: knowledge, possession, inherence. MFA combines different factors |
| Threats | Brute force, phishing, session hijacking, CSRF, privilege escalation, etc. |
| Principles | Least privilege, defense in depth, fail-secure, zero trust |
| Methods | Session, JWT, OAuth 2.0, Passkeys, etc. |
| RBAC | Role-based. Simple and easy to manage |
| ABAC | Attribute-based. Flexible but complex |
| Audit log | Record of who did what. Foundation for incident response |
| Headers | Multi-layer defense with HSTS, CSP, X-Frame-Options, etc. |

---

## Further Reading

---

## References
1. OWASP. "Authentication Cheat Sheet." cheatsheetseries.owasp.org, 2024.
2. NIST. "SP 800-63B: Digital Identity Guidelines." nist.gov, 2020.
3. RFC 7235. "Hypertext Transfer Protocol (HTTP/1.1): Authentication." IETF, 2014.
4. OWASP. "Authorization Cheat Sheet." cheatsheetseries.owasp.org, 2024.
5. NIST. "SP 800-162: Guide to Attribute Based Access Control." nist.gov, 2014.
6. Zanzibar. "Google's Consistent, Global Authorization System." USENIX ATC, 2019.
7. STRIDE. "The STRIDE Threat Model." Microsoft, 2024.

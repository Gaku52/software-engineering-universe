# API Authorization

> Access control for APIs is the cornerstone of service security. This chapter covers scope design, API key management, resource-based authorization, rate limiting, and multi-tenant APIs — everything needed to design and implement secure API authorization.

## Prerequisites

- Basic understanding of HTTP status codes (401, 403, 404)
- Middleware patterns in Express / Next.js

## What You Will Learn

- [ ] Understand OAuth scope design and implementation
- [ ] Learn secure API key management patterns
- [ ] Implement resource-based authorization using middleware
- [ ] Design data isolation for multi-tenant APIs
- [ ] Combine rate limiting with API authorization
- [ ] Learn proper error response design for authorization failures

---

## 1. Scope Design

### 1.1 Basic Concepts of Scopes

```
What is a Scope:

  In OAuth 2.0, a scope is a string that defines the
  "range of permissions" granted to an access token

  ┌──────────────────────────────────────────────────────┐
  │              Access Control Hierarchy                 │
  │                                                       │
  │  ┌─────────────────────────────────────────────────┐  │
  │  │ Authentication                                   │  │
  │  │ → Verifies "who you are"                         │  │
  │  │ → JWT / Session / API Key                       │  │
  │  └────────────────────────┬────────────────────────┘  │
  │                           │                           │
  │  ┌────────────────────────┴────────────────────────┐  │
  │  │ Authorization                                    │  │
  │  │                                                 │  │
  │  │  ┌───────────┐  ┌───────────┐  ┌────────────┐  │  │
  │  │  │ Scope     │  │ Role      │  │ Resource   │  │  │
  │  │  │ Based     │  │ Based     │  │ Based      │  │  │
  │  │  │           │  │           │  │            │  │  │
  │  │  │ Per-API   │  │ Per-user  │  │ Resource   │  │  │
  │  │  │ permissions│  │ permissions│  │ owner     │  │  │
  │  │  │           │  │           │  │ check      │  │  │
  │  │  └───────────┘  └───────────┘  └────────────┘  │  │
  │  └─────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

### 1.2 Scope Naming Patterns

```
OAuth Scope Design:

  Naming pattern: resource:action

  Examples (GitHub-style):
    read:user         — Read user information
    user:email        — Read email address
    repo              — General repository access
    repo:status       — Commit status
    admin:org         — Organization administration

  Examples (Google-style):
    https://www.googleapis.com/auth/userinfo.email
    https://www.googleapis.com/auth/drive.readonly
    https://www.googleapis.com/auth/calendar.events

  Examples (Stripe-style):
    charges:read      — Read billing information
    charges:write     — Create and update charges
    customers:read    — Read customer information

  Recommended pattern:
    → resource:action format is the clearest
    → Granularity should match the API's purpose
    → read means read-only (no side effects)
```

### 1.3 Scope Granularity Design

```
Scope Granularity:

  ┌──────────────┬──────────────────────┬────────────────┬──────────┐
  │ Granularity  │ Example              │ Pros           │ Cons     │
  ├──────────────┼──────────────────────┼────────────────┼──────────┤
  │ Too coarse   │ "all"               │ Simple         │ Dangerous│
  │              │ "admin"             │ Easy to manage │ Excessive│
  │              │                     │                │ privilege│
  ├──────────────┼──────────────────────┼────────────────┼──────────┤
  │ Appropriate  │ "articles:read"     │ Least privilege│ Requires │
  │              │ "articles:write"    │ Clear scope    │ design   │
  │              │ "users:read"        │                │          │
  ├──────────────┼──────────────────────┼────────────────┼──────────┤
  │ Too fine     │ "articles:read:title"│ Precise control│ Complex  │
  │              │ "users:read:email"  │                │ Hard to  │
  │              │                     │                │ manage   │
  └──────────────┴──────────────────────┴────────────────┴──────────┘

  Criteria for appropriate granularity:
  → Can users understand it? (shown on the OAuth consent screen)
  → Does it align with the API endpoint design?
  → Does it satisfy the principle of least privilege?
  → Is it extensible for the future?

  Scope hierarchy:
  ┌──────────────────────────────────────┐
  │ admin (full access)                  │
  │  ├── articles:write (write articles) │
  │  │    └── articles:read (read articles)│
  │  ├── users:write (write users)       │
  │  │    └── users:read (read users)    │
  │  └── org:settings (org settings)    │
  └──────────────────────────────────────┘
  → write typically implies read in most designs
```

### 1.4 Scope-Based Authorization Implementation

```typescript
// Scope-based API authorization

// Scope definitions
const SCOPES = {
  'articles:read': 'Read articles',
  'articles:write': 'Create and update articles',
  'articles:delete': 'Delete articles',
  'users:read': 'Read user profiles',
  'users:write': 'Update user profiles',
  'org:settings': 'Manage organization settings',
  'org:billing': 'Manage billing',
  'admin': 'Full administrative access',
} as const;

type Scope = keyof typeof SCOPES;

// Define scope hierarchy
const SCOPE_HIERARCHY: Record<string, Scope[]> = {
  'admin': Object.keys(SCOPES) as Scope[],
  'articles:write': ['articles:read'],
  'articles:delete': ['articles:read', 'articles:write'],
  'users:write': ['users:read'],
  'org:settings': [],
  'org:billing': [],
};

// Expand scopes (considering hierarchy)
function expandScopes(scopes: Scope[]): Set<Scope> {
  const expanded = new Set<Scope>(scopes);

  for (const scope of scopes) {
    const implied = SCOPE_HIERARCHY[scope];
    if (implied) {
      implied.forEach(s => expanded.add(s));
    }
  }

  return expanded;
}

// Scope validation middleware
function requireScope(...requiredScopes: Scope[]) {
  return (req: Request, res: Response, next: Function) => {
    const tokenScopes = req.auth?.scopes as Scope[] || [];
    const expandedScopes = expandScopes(tokenScopes);

    const hasAll = requiredScopes.every(s => expandedScopes.has(s));
    if (!hasAll) {
      return res.status(403).json({
        error: 'insufficient_scope',
        message: 'You do not have the required permissions',
        required_scopes: requiredScopes,
        granted_scopes: tokenScopes,
        // WWW-Authenticate header (RFC 6750 §3.1)
      });
    }

    next();
  };
}

// Usage examples
app.get('/api/articles', requireScope('articles:read'), listArticles);
app.post('/api/articles', requireScope('articles:write'), createArticle);
app.delete('/api/articles/:id', requireScope('articles:delete'), deleteArticle);
app.get('/api/users', requireScope('users:read'), listUsers);
app.put('/api/users/:id', requireScope('users:write'), updateUser);
app.get('/api/org/settings', requireScope('org:settings'), getOrgSettings);
```

### 1.5 Scope Display on OAuth Consent Screen

```typescript
// Make scope descriptions human-readable
const SCOPE_DESCRIPTIONS: Record<Scope, { title: string; description: string; risk: 'low' | 'medium' | 'high' }> = {
  'articles:read': {
    title: 'View articles',
    description: 'Read articles in your account',
    risk: 'low',
  },
  'articles:write': {
    title: 'Create and edit articles',
    description: 'Create and edit articles in your account',
    risk: 'medium',
  },
  'articles:delete': {
    title: 'Delete articles',
    description: 'Delete articles in your account',
    risk: 'high',
  },
  'users:read': {
    title: 'View user information',
    description: 'Read your profile information',
    risk: 'low',
  },
  'users:write': {
    title: 'Update user information',
    description: 'Update your profile information',
    risk: 'medium',
  },
  'org:settings': {
    title: 'Manage organization settings',
    description: 'Change organization settings',
    risk: 'high',
  },
  'org:billing': {
    title: 'Manage billing information',
    description: 'Change payment information and plans',
    risk: 'high',
  },
  'admin': {
    title: 'Administrator access',
    description: 'Can perform all operations',
    risk: 'high',
  },
};

// Consent screen API
app.get('/api/oauth/consent', async (req, res) => {
  const requestedScopes = (req.query.scope as string).split(' ') as Scope[];

  const scopeDetails = requestedScopes.map(scope => ({
    scope,
    ...SCOPE_DESCRIPTIONS[scope],
  }));

  res.json({
    client: {
      name: 'Third Party App',
      logo: 'https://example.com/logo.png',
    },
    scopes: scopeDetails,
    hasHighRisk: scopeDetails.some(s => s.risk === 'high'),
  });
});
```

---

## 2. API Key Management

### 2.1 API Key Design Principles

```
API Key Design:

  Structure:
    prefix_randomstring
    Example: sk_live_EXAMPLE_DO_NOT_USE_1234567890

  Prefixes:
    sk_live_  — Production Secret Key
    sk_test_  — Test Secret Key
    pk_live_  — Production Public Key (for clients)
    pk_test_  — Test Public Key

  ┌──────────────────────────────────────────────────────────┐
  │                  API Key Lifecycle                        │
  │                                                          │
  │  Generate → Display (once only) → Use → Rotate → Expire  │
  │                                                          │
  │  ┌────────┐  ┌────────────┐  ┌────────┐  ┌───────────┐  │
  │  │Generate│→│   Hash     │→│ Save   │→│ Compare   │  │
  │  │ random │  │  SHA-256   │  │ hash   │  │ on verify │  │
  │  │ bytes  │  │            │  │ prefix │  │           │  │
  │  └────────┘  └────────────┘  └────────┘  └───────────┘  │
  │                                                          │
  │  Security requirements:                                  │
  │  → Store API keys as hashes (never store in plain text)  │
  │  → Display plain text only at creation (cannot be        │
  │    retrieved later)                                      │
  │  → Store prefix in plain text (for search and display)   │
  │  → Recommend regular rotation                            │
  │  → Provide mechanisms for expiration and revocation      │
  └──────────────────────────────────────────────────────────┘
```

### 2.2 API Key Generation and Management

```typescript
// API key generation and management
import crypto from 'crypto';

// API key generation
function generateApiKey(type: 'secret' | 'public', env: 'live' | 'test'): {
  key: string;
  prefix: string;
  hash: string;
  lastFour: string;
} {
  const prefixMap = {
    'secret-live': 'sk_live_',
    'secret-test': 'sk_test_',
    'public-live': 'pk_live_',
    'public-test': 'pk_test_',
  };

  const prefix = prefixMap[`${type}-${env}`];
  const randomPart = crypto.randomBytes(24).toString('base64url');
  // 24 bytes = 32 base64url characters = 192 bits of entropy
  const key = `${prefix}${randomPart}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const lastFour = randomPart.slice(-4);

  return { key, prefix, hash, lastFour };
}

// Save API key
async function createApiKey(
  userId: string,
  name: string,
  scopes: string[],
  options: {
    expiresInDays?: number;
    rateLimit?: number;
    ipWhitelist?: string[];
  } = {}
) {
  const { key, prefix, hash, lastFour } = generateApiKey('secret', 'live');

  const expiresAt = options.expiresInDays
    ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  await db.apiKey.create({
    data: {
      userId,
      name,
      prefix,            // For search and display (plain text)
      keyHash: hash,     // For verification (hash)
      lastFour,          // For display (last 4 characters)
      scopes,
      rateLimit: options.rateLimit ?? 1000, // requests/hour
      ipWhitelist: options.ipWhitelist ?? [],
      lastUsedAt: null,
      expiresAt,
      revokedAt: null,
    },
  });

  // Return the full key only at this point
  return {
    key,
    prefix,
    lastFour,
    message: 'This key will only be shown once. Please save it securely.',
  };
}

// List API keys (do not return hashes)
async function listApiKeys(userId: string) {
  const keys = await db.apiKey.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastFour: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return keys.map(k => ({
    ...k,
    // Display format: sk_live_****abcd
    maskedKey: `${k.prefix}****${k.lastFour}`,
    isExpired: k.expiresAt ? k.expiresAt < new Date() : false,
    isRevoked: !!k.revokedAt,
  }));
}
```

### 2.3 API Key Validation

```typescript
// API key validation
async function validateApiKey(key: string): Promise<ApiKeyData | null> {
  // Check prefix
  const validPrefixes = ['sk_live_', 'sk_test_', 'pk_live_', 'pk_test_'];
  const hasValidPrefix = validPrefixes.some(p => key.startsWith(p));
  if (!hasValidPrefix) return null;

  // Hash and look up
  const hash = crypto.createHash('sha256').update(key).digest('hex');

  const apiKey = await db.apiKey.findUnique({
    where: { keyHash: hash },
    include: { user: true },
  });

  // Existence check
  if (!apiKey) return null;

  // Revocation check
  if (apiKey.revokedAt) {
    console.warn(`Revoked API key used: ${apiKey.id}`);
    return null;
  }

  // Expiration check
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    console.warn(`Expired API key used: ${apiKey.id}`);
    return null;
  }

  // Update last used timestamp (async, does not block request)
  db.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  return {
    userId: apiKey.userId,
    scopes: apiKey.scopes,
    keyId: apiKey.id,
    rateLimit: apiKey.rateLimit,
    ipWhitelist: apiKey.ipWhitelist,
    isTestKey: key.includes('_test_'),
  };
}

// API key rotation
async function rotateApiKey(userId: string, oldKeyId: string) {
  // Get information about the old key
  const oldKey = await db.apiKey.findFirst({
    where: { id: oldKeyId, userId },
  });

  if (!oldKey) throw new Error('API key not found');

  // Generate a new key
  const newKeyData = await createApiKey(userId, oldKey.name, oldKey.scopes, {
    rateLimit: oldKey.rateLimit,
    ipWhitelist: oldKey.ipWhitelist,
  });

  // Set a grace period for the old key (do not invalidate immediately)
  const gracePeriod = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await db.apiKey.update({
    where: { id: oldKeyId },
    data: { expiresAt: gracePeriod },
  });

  return {
    newKey: newKeyData,
    oldKeyExpiresAt: gracePeriod,
    message: 'Old key will remain valid for 24 hours. Please update your integration.',
  };
}

// API key revocation
async function revokeApiKey(userId: string, keyId: string) {
  await db.apiKey.update({
    where: { id: keyId, userId },
    data: { revokedAt: new Date() },
  });
}
```

### 2.4 API Key Authentication Middleware

```typescript
// API key authentication middleware
async function apiKeyAuth(req: Request, res: Response, next: Function) {
  // Sources for the API key (in order of priority)
  const key =
    req.headers['x-api-key'] as string ||                    // Custom header
    req.headers.authorization?.replace('Bearer ', '') ||     // Authorization header
    req.query.api_key as string;                             // Query parameter (deprecated)

  if (!key) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'API key is required. Provide it via X-API-Key header or Authorization: Bearer header.',
    });
  }

  // Warn if API key is passed via query parameter
  if (req.query.api_key) {
    res.setHeader('X-Warning', 'Passing API key via query parameter is deprecated. Use X-API-Key header instead.');
  }

  const apiKeyData = await validateApiKey(key);
  if (!apiKeyData) {
    return res.status(401).json({
      error: 'invalid_api_key',
      message: 'The provided API key is invalid, expired, or revoked.',
    });
  }

  // IP whitelist check
  if (apiKeyData.ipWhitelist.length > 0) {
    const clientIp = req.ip || req.headers['x-forwarded-for'];
    if (!apiKeyData.ipWhitelist.includes(clientIp as string)) {
      return res.status(403).json({
        error: 'ip_not_allowed',
        message: 'Request from this IP address is not allowed.',
      });
    }
  }

  // Separate test keys
  if (apiKeyData.isTestKey && process.env.NODE_ENV === 'production') {
    // Test keys can only access test data in production
    req.isTestMode = true;
  }

  req.auth = apiKeyData;
  next();
}
```

---

## 3. Resource-Based Authorization

### 3.1 Resource-Based Authorization Design

```
Resource-Based Authorization:

  When scope or role alone is insufficient:
  → Not just "has permission to edit articles"
  → But "has permission to edit THIS article"

  Decision logic:
  ┌──────────────────────────────────────────────────┐
  │ Resource Access Decision Flow:                    │
  │                                                   │
  │ ① Check resource existence                        │
  │    → Not found: 404                               │
  │                                                   │
  │ ② Check if resource is public                     │
  │    → Public + read action: allow                  │
  │                                                   │
  │ ③ Ownership check                                 │
  │    → resource.authorId === userId: allow           │
  │                                                   │
  │ ④ Organization permission check                   │
  │    → Same org + appropriate role: allow           │
  │                                                   │
  │ ⑤ Sharing settings check                          │
  │    → Explicitly shared: allow                     │
  │                                                   │
  │ ⑥ All of the above fail: 403 (or 404)             │
  └──────────────────────────────────────────────────┘
```

### 3.2 Resource-Based Authorization Implementation

```typescript
// Resource ownership check
interface ResourcePolicy {
  resourceType: string;
  actions: string[];
  check: (userId: string, resourceId: string, action: string) => Promise<boolean>;
}

// Policy definitions
const articlePolicy: ResourcePolicy = {
  resourceType: 'article',
  actions: ['read', 'update', 'delete', 'publish'],

  async check(userId: string, resourceId: string, action: string): Promise<boolean> {
    const article = await db.article.findUnique({
      where: { id: resourceId },
      include: { author: true },
    });

    if (!article) return false;

    // Anyone can read published articles
    if (action === 'read' && article.status === 'published') return true;

    // Users can operate on their own articles
    if (article.authorId === userId) return true;

    // Org admin can operate on articles in the same org
    const user = await db.user.findUnique({ where: { id: userId } });
    if (user?.role === 'admin' && user?.orgId === article.orgId) return true;

    // Editor can publish non-draft articles in the same org
    if (action === 'publish' && user?.role === 'editor' && user?.orgId === article.orgId) {
      return true;
    }

    return false;
  },
};

const commentPolicy: ResourcePolicy = {
  resourceType: 'comment',
  actions: ['read', 'update', 'delete'],

  async check(userId: string, resourceId: string, action: string): Promise<boolean> {
    const comment = await db.comment.findUnique({
      where: { id: resourceId },
      include: { article: true },
    });

    if (!comment) return false;

    // Anyone can read comments (if the parent article is published)
    if (action === 'read' && comment.article.status === 'published') return true;

    // Users can update or delete their own comments
    if (comment.authorId === userId) return true;

    // Article author can delete comments
    if (action === 'delete' && comment.article.authorId === userId) return true;

    // Admin can operate on all comments
    const user = await db.user.findUnique({ where: { id: userId } });
    if (user?.role === 'admin') return true;

    return false;
  },
};

// Policy registry
const policyRegistry = new Map<string, ResourcePolicy>([
  ['article', articlePolicy],
  ['comment', commentPolicy],
]);

// Generic resource authorization function
async function authorizeResourceAccess(
  userId: string,
  resourceType: string,
  resourceId: string,
  action: string
): Promise<boolean> {
  const policy = policyRegistry.get(resourceType);
  if (!policy) {
    console.warn(`No policy defined for resource type: ${resourceType}`);
    return false;
  }

  if (!policy.actions.includes(action)) {
    console.warn(`Unknown action '${action}' for resource type: ${resourceType}`);
    return false;
  }

  return policy.check(userId, resourceId, action);
}

// Use as middleware
function authorizeResource(resourceType: string, action: string) {
  return async (req: Request, res: Response, next: Function) => {
    const resourceId = req.params.id;
    const userId = req.auth.userId;

    const allowed = await authorizeResourceAccess(userId, resourceType, resourceId, action);

    if (!allowed) {
      // Return 404 for security reasons
      // → When you want to hide the existence of a resource
      const hideExistence = resourceType === 'article';
      const statusCode = hideExistence ? 404 : 403;

      return res.status(statusCode).json({
        error: statusCode === 404 ? 'not_found' : 'forbidden',
        message: statusCode === 404
          ? 'Resource not found'
          : 'You do not have permission to perform this action',
      });
    }

    next();
  };
}

// Route definitions
app.get('/api/articles/:id', apiKeyAuth, authorizeResource('article', 'read'), getArticle);
app.put('/api/articles/:id', apiKeyAuth, requireScope('articles:write'), authorizeResource('article', 'update'), updateArticle);
app.delete('/api/articles/:id', apiKeyAuth, requireScope('articles:delete'), authorizeResource('article', 'delete'), deleteArticle);
app.post('/api/articles/:id/publish', apiKeyAuth, requireScope('articles:write'), authorizeResource('article', 'publish'), publishArticle);
```

### 3.3 Field-Level Authorization

```typescript
// Field-level authorization
// → Allow access to the resource, but hide certain fields

interface FieldFilter {
  [field: string]: boolean | ((user: AuthData) => boolean);
}

const articleFieldFilters: Record<string, FieldFilter> = {
  // Public article: all fields
  viewer: {
    id: true,
    title: true,
    content: true,
    author: true,
    createdAt: true,
    // Internal fields hidden
    internalNotes: false,
    moderationStatus: false,
    revenue: false,
  },
  // Author: internal notes also visible
  author: {
    id: true,
    title: true,
    content: true,
    author: true,
    createdAt: true,
    internalNotes: true,
    moderationStatus: true,
    revenue: false,
  },
  // Admin: all fields
  admin: {
    id: true,
    title: true,
    content: true,
    author: true,
    createdAt: true,
    internalNotes: true,
    moderationStatus: true,
    revenue: true,
  },
};

function filterFields(data: Record<string, any>, role: string): Record<string, any> {
  const filter = articleFieldFilters[role] || articleFieldFilters.viewer;
  const filtered: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    const allowed = filter[key];
    if (allowed === true || (typeof allowed === 'function' && allowed(data))) {
      filtered[key] = value;
    }
  }

  return filtered;
}
```

---

## 4. Rate Limiting and API Authorization

### 4.1 Rate Limiting Design

```
Rate Limiting Design:

  ┌──────────────────────────────────────────────────────────┐
  │                  Rate Limit Hierarchy                     │
  │                                                          │
  │  ┌────────────────────────────────────────────────────┐  │
  │  │ Global Rate Limit: 10,000 req/min (overall)        │  │
  │  │                                                    │  │
  │  │  ┌──────────────────────────────────────────────┐  │  │
  │  │  │ Per-API-Key: 1,000 req/hour                  │  │  │
  │  │  │                                              │  │  │
  │  │  │  ┌────────────────────────────────────────┐  │  │  │
  │  │  │  │ Per-Endpoint: 100 req/min              │  │  │  │
  │  │  │  │                                        │  │  │  │
  │  │  │  │  ┌──────────────────────────────────┐  │  │  │  │
  │  │  │  │  │ Per-Resource: 10 req/min         │  │  │  │  │
  │  │  │  │  │ (destructive operations like DELETE)│ │  │  │  │
  │  │  │  │  └──────────────────────────────────┘  │  │  │  │
  │  │  │  └────────────────────────────────────────┘  │  │  │
  │  │  └──────────────────────────────────────────────┘  │  │
  │  └────────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────────┘
```

### 4.2 Redis-Based Rate Limiting

```typescript
// Redis-based rate limiting
import Redis from 'ioredis';

interface RateLimitConfig {
  windowMs: number;     // Window size (milliseconds)
  max: number;          // Maximum number of requests
  keyPrefix?: string;   // Redis key prefix
}

class RateLimiter {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async check(identifier: string, config: RateLimitConfig): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    limit: number;
  }> {
    const key = `${config.keyPrefix || 'rl'}:${identifier}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Sliding window approach
    const pipeline = this.redis.pipeline();
    // Remove old entries
    pipeline.zremrangebyscore(key, '-inf', windowStart);
    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    // Get number of requests in the window
    pipeline.zcard(key);
    // Set TTL
    pipeline.expire(key, Math.ceil(config.windowMs / 1000));

    const results = await pipeline.exec();
    const count = results![2][1] as number;

    const allowed = count <= config.max;
    const remaining = Math.max(0, config.max - count);
    const resetAt = new Date(now + config.windowMs);

    return { allowed, remaining, resetAt, limit: config.max };
  }
}

// Rate limiting middleware
function rateLimitMiddleware(redis: Redis, config: RateLimitConfig) {
  const limiter = new RateLimiter(redis);

  return async (req: Request, res: Response, next: Function) => {
    // API key-based identifier
    const identifier = req.auth?.keyId || req.ip || 'anonymous';

    const result = await limiter.check(identifier, config);

    // Set response headers (RFC 6585 compliant)
    res.setHeader('X-RateLimit-Limit', result.limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt.getTime() / 1000));

    if (!result.allowed) {
      res.setHeader('Retry-After', Math.ceil(config.windowMs / 1000));
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message: `Too many requests. Limit: ${result.limit} per ${config.windowMs / 1000}s`,
        retry_after: Math.ceil(config.windowMs / 1000),
      });
    }

    next();
  };
}

// Plan-based rate limiting
const PLAN_RATE_LIMITS: Record<string, RateLimitConfig> = {
  free: { windowMs: 60 * 60 * 1000, max: 100, keyPrefix: 'rl:free' },
  pro: { windowMs: 60 * 60 * 1000, max: 1000, keyPrefix: 'rl:pro' },
  enterprise: { windowMs: 60 * 60 * 1000, max: 10000, keyPrefix: 'rl:ent' },
};

function planBasedRateLimit(redis: Redis) {
  return async (req: Request, res: Response, next: Function) => {
    const plan = req.auth?.plan || 'free';
    const config = PLAN_RATE_LIMITS[plan] || PLAN_RATE_LIMITS.free;

    return rateLimitMiddleware(redis, config)(req, res, next);
  };
}

// Usage example
app.use('/api/', apiKeyAuth, planBasedRateLimit(redis));
```

### 4.3 Per-Endpoint Rate Limiting

```typescript
// Per-endpoint rate limiting
const ENDPOINT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Read operations: relaxed limits
  'GET:/api/articles': { windowMs: 60 * 1000, max: 100 },
  'GET:/api/users': { windowMs: 60 * 1000, max: 50 },

  // Write operations: stricter limits
  'POST:/api/articles': { windowMs: 60 * 1000, max: 10 },
  'PUT:/api/articles/:id': { windowMs: 60 * 1000, max: 20 },

  // Delete operations: very strict limits
  'DELETE:/api/articles/:id': { windowMs: 60 * 1000, max: 5 },

  // Auth operations: strictest limits
  'POST:/api/auth/login': { windowMs: 15 * 60 * 1000, max: 5 },
  'POST:/api/auth/register': { windowMs: 60 * 60 * 1000, max: 3 },
};

function endpointRateLimit(redis: Redis) {
  const limiter = new RateLimiter(redis);

  return async (req: Request, res: Response, next: Function) => {
    const routeKey = `${req.method}:${req.route?.path || req.path}`;
    const config = ENDPOINT_RATE_LIMITS[routeKey];

    if (!config) return next(); // No limit

    const identifier = `${req.auth?.keyId || req.ip}:${routeKey}`;
    const result = await limiter.check(identifier, config);

    res.setHeader('X-RateLimit-Limit', result.limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);

    if (!result.allowed) {
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message: `Rate limit exceeded for ${routeKey}`,
      });
    }

    next();
  };
}
```

---

## 5. Multi-Tenant API Authorization

### 5.1 Tenant Isolation Design

```
Data Isolation in Multi-Tenant APIs:

  ┌──────────────────────────────────────────────────────────┐
  │              Tenant Isolation Patterns                    │
  │                                                          │
  │  Pattern 1: Row-level isolation (recommended)            │
  │  ┌────────────────────────────────────────────────┐      │
  │  │ articles table                                  │      │
  │  │ ┌────┬──────────┬─────────┬──────────┐         │      │
  │  │ │ id │ title    │ content │ org_id   │         │      │
  │  │ ├────┼──────────┼─────────┼──────────┤         │      │
  │  │ │ 1  │ Article1 │ ...     │ org_001  │ ← Org A│      │
  │  │ │ 2  │ Article2 │ ...     │ org_001  │ ← Org A│      │
  │  │ │ 3  │ Article3 │ ...     │ org_002  │ ← Org B│      │
  │  │ └────┴──────────┴─────────┴──────────┘         │      │
  │  │ → All tenants share the same table              │      │
  │  │ → Isolated by WHERE org_id = ?                  │      │
  │  │ → Simplest and most scalable                    │      │
  │  └────────────────────────────────────────────────┘      │
  │                                                          │
  │  Pattern 2: Schema isolation                             │
  │  → Create a DB schema per tenant                         │
  │  → Uses PostgreSQL schema feature                        │
  │  → Stronger isolation, more complex migrations           │
  │                                                          │
  │  Pattern 3: Database isolation                           │
  │  → Separate DB instance per tenant                       │
  │  → Strongest isolation, higher cost                      │
  │  → For compliance requirements (finance, healthcare)     │
  └──────────────────────────────────────────────────────────┘
```

### 5.2 Tenant Isolation Middleware

```typescript
// Tenant isolation middleware
function tenantIsolation() {
  return async (req: Request, res: Response, next: Function) => {
    const userId = req.auth.userId;
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!user?.orgId) {
      return res.status(403).json({
        error: 'no_organization',
        message: 'You must belong to an organization to access this resource.',
      });
    }

    // Set tenant context on the request
    req.tenantId = user.orgId;
    req.tenantSlug = user.organization!.slug;

    // Automatically add tenant filter to Prisma queries
    req.prisma = prisma.$extends({
      query: {
        $allModels: {
          async findMany({ args, query }) {
            args.where = { ...args.where, orgId: req.tenantId };
            return query(args);
          },
          async findFirst({ args, query }) {
            args.where = { ...args.where, orgId: req.tenantId };
            return query(args);
          },
          async findUnique({ args, query }) {
            // Cannot add orgId to findUnique where clause,
            // so check after fetching the result
            const result = await query(args);
            if (result && 'orgId' in result && result.orgId !== req.tenantId) {
              return null; // Resource belongs to another tenant
            }
            return result;
          },
          async create({ args, query }) {
            args.data = { ...args.data, orgId: req.tenantId };
            return query(args);
          },
          async update({ args, query }) {
            // Check tenant before update
            const existing = await db[args.model as any].findFirst({
              where: { ...args.where, orgId: req.tenantId },
            });
            if (!existing) {
              throw new Error('Resource not found or access denied');
            }
            return query(args);
          },
          async delete({ args, query }) {
            // Check tenant before delete
            const existing = await db[args.model as any].findFirst({
              where: { ...args.where, orgId: req.tenantId },
            });
            if (!existing) {
              throw new Error('Resource not found or access denied');
            }
            return query(args);
          },
        },
      },
    });

    next();
  };
}

// Usage example
app.use('/api/', apiKeyAuth, tenantIsolation());

// Tenant-isolated endpoint
app.get('/api/articles', async (req, res) => {
  // Using req.prisma automatically applies the tenant filter
  const articles = await req.prisma.article.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  // → WHERE org_id = 'tenant_123' is automatically added

  res.json(articles);
});
```

### 5.3 Cross-Tenant Data Sharing

```typescript
// Pattern for sharing data across tenants
// Example: Tenant B views an article owned by Tenant A in a marketplace

interface SharedResource {
  resourceType: string;
  resourceId: string;
  ownerOrgId: string;
  sharedWithOrgId: string;
  permissions: string[]; // ['read'] or ['read', 'write']
  expiresAt?: Date;
}

async function checkSharedAccess(
  orgId: string,
  resourceType: string,
  resourceId: string,
  action: string
): Promise<boolean> {
  const share = await db.sharedResource.findFirst({
    where: {
      sharedWithOrgId: orgId,
      resourceType,
      resourceId,
      permissions: { has: action },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });

  return !!share;
}
```

---

## 6. Best Practices for Authorization Responses

### 6.1 Choosing the Right HTTP Status Code

```
API Authorization Error Design:

  ┌──────────────┬──────────────────────────────────────────────┐
  │ Code         │ Usage                                         │
  ├──────────────┼──────────────────────────────────────────────┤
  │ 401          │ Authentication error (unauthenticated)        │
  │              │ → API key / token not provided               │
  │              │ → API key / token is invalid                 │
  │              │ → Session expired                            │
  ├──────────────┼──────────────────────────────────────────────┤
  │ 403          │ Authorization error (insufficient permission) │
  │              │ → Insufficient scope                         │
  │              │ → Insufficient role                          │
  │              │ → Resource access denied                     │
  │              │ → IP address not in whitelist                │
  ├──────────────┼──────────────────────────────────────────────┤
  │ 404          │ Resource not found (security alternative to  │
  │              │   403)                                       │
  │              │ → When you want to hide resource existence   │
  │              │ → Prevents information leakage               │
  ├──────────────┼──────────────────────────────────────────────┤
  │ 429          │ Rate limit exceeded                          │
  │              │ → Include Retry-After header                 │
  └──────────────┴──────────────────────────────────────────────┘

  Deciding between 404 and 403:
  ┌──────────────────────────────────────────────────┐
  │ When resource existence should be hidden → 404   │
  │ → Example: Another user's private resource       │
  │ → Do not reveal resource existence to attackers  │
  │                                                   │
  │ When insufficient permission should be clear → 403│
  │ → Example: When users can request access         │
  │ → When easier debugging is desired               │
  │                                                   │
  │ Generally, 404 is recommended for security       │
  │ 403 is appropriate for internal APIs / dashboards │
  └──────────────────────────────────────────────────┘
```

### 6.2 Error Response Structure

```typescript
// Unified error responses

// 401 Unauthorized
{
  "error": "unauthorized",
  "message": "Authentication required",
  "docs_url": "https://docs.myapi.com/auth"
}

// 403 Forbidden (insufficient scope)
{
  "error": "insufficient_scope",
  "message": "You do not have the required permissions",
  "required_scopes": ["articles:write"],
  "granted_scopes": ["articles:read"],
  "docs_url": "https://docs.myapi.com/scopes"
}

// 403 Forbidden (resource authorization)
{
  "error": "forbidden",
  "message": "You do not have permission to perform this action on this resource",
  "resource_type": "article",
  "action": "delete"
}

// 429 Too Many Requests
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests",
  "limit": 1000,
  "remaining": 0,
  "reset_at": "2024-01-01T12:00:00Z",
  "retry_after": 3600
}
```

### 6.3 WWW-Authenticate Header

```typescript
// WWW-Authenticate header compliant with RFC 6750
function setWWWAuthenticate(res: Response, options: {
  realm?: string;
  error?: string;
  errorDescription?: string;
  scope?: string;
}) {
  const parts = [`Bearer realm="${options.realm || 'api'}"`];

  if (options.error) {
    parts.push(`error="${options.error}"`);
  }
  if (options.errorDescription) {
    parts.push(`error_description="${options.errorDescription}"`);
  }
  if (options.scope) {
    parts.push(`scope="${options.scope}"`);
  }

  res.setHeader('WWW-Authenticate', parts.join(', '));
}

// Usage examples
// 401: Not authenticated
setWWWAuthenticate(res, {
  realm: 'api',
  error: 'invalid_token',
  errorDescription: 'The access token is invalid',
});

// 403: Insufficient scope
setWWWAuthenticate(res, {
  realm: 'api',
  error: 'insufficient_scope',
  scope: 'articles:write',
});
```

---

## 7. Edge Cases and Security

### 7.1 Protecting Against Timing Attacks

```typescript
// Timing attack mitigation in API key validation
import crypto from 'crypto';

// Bad example: early return leaks timing information
function unsafeValidate(providedKey: string, storedHash: string): boolean {
  const hash = crypto.createHash('sha256').update(providedKey).digest('hex');
  return hash === storedHash; // ← Vulnerable to timing attacks
}

// Good example: constant-time comparison
function safeValidate(providedKey: string, storedHash: string): boolean {
  const hash = crypto.createHash('sha256').update(providedKey).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(hash, 'hex'),
    Buffer.from(storedHash, 'hex')
  );
}
```

### 7.2 Preventing Horizontal Privilege Escalation (IDOR)

```
IDOR (Insecure Direct Object Reference):

  Attack example:
  → GET /api/users/123/profile (own profile)
  → GET /api/users/456/profile (another user's) ← just change the ID

  Countermeasures:
  ① Always perform resource authorization checks
  ② Avoid sequential IDs (use UUID/CUID)
  ③ Design to return only the user's own resources
     → GET /api/me/profile (no ID needed)
     → GET /api/articles?mine=true (filter)
```

```typescript
// IDOR mitigation: return only own resources
app.get('/api/me/profile', auth, async (req, res) => {
  const profile = await db.user.findUnique({
    where: { id: req.auth.userId }, // Use userId from session
    select: { id: true, name: true, email: true, image: true },
  });
  res.json(profile);
});

// IDOR mitigation: check resource ownership
app.get('/api/articles/:id', auth, async (req, res) => {
  const article = await db.article.findFirst({
    where: {
      id: req.params.id,
      // Tenant filter
      orgId: req.auth.orgId,
    },
  });

  if (!article) {
    return res.status(404).json({ error: 'not_found' });
  }

  res.json(article);
});
```

### 7.3 Preventing Mass Assignment

```typescript
// Mass Assignment attack:
// Client-submitted body contains unexpected fields

// Bad example
app.put('/api/articles/:id', async (req, res) => {
  await db.article.update({
    where: { id: req.params.id },
    data: req.body, // ← req.body could contain { role: 'admin' }
  });
});

// Good example: explicitly specify allowed fields
app.put('/api/articles/:id', async (req, res) => {
  const allowedFields = ['title', 'content', 'tags', 'status'];
  const data: Record<string, any> = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      data[field] = req.body[field];
    }
  }

  await db.article.update({
    where: { id: req.params.id },
    data,
  });
});

// Even better: validate with Zod
import { z } from 'zod';

const updateArticleSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

app.put('/api/articles/:id', async (req, res) => {
  const parsed = updateArticleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'validation_error', details: parsed.error.issues });
  }

  await db.article.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
});
```

---

## 8. Anti-Patterns

```
API Authorization Anti-Patterns:

  Anti-pattern 1: Authorization checks on the frontend only
  ┌──────────────────────────────────────────────────┐
  │ // Dangerous: can be bypassed by calling the API │
  │ // directly                                       │
  │ // Even if the "Delete" button is hidden in the   │
  │ // frontend, curl -X DELETE /api/articles/123    │
  │ // still works                                    │
  │                                                   │
  │ → Server-side authorization is required on all   │
  │   API endpoints                                   │
  └──────────────────────────────────────────────────┘

  Anti-pattern 2: Embedding API keys on the client side
  ┌──────────────────────────────────────────────────┐
  │ // Dangerous: Secret Key is exposed              │
  │ const API_KEY = 'sk_live_xxxxx'; // in JS bundle │
  │                                                   │
  │ → Secret Keys should only be used server-side    │
  │ → Only expose Public Keys to clients             │
  └──────────────────────────────────────────────────┘

  Anti-pattern 3: Wildcard scopes
  ┌──────────────────────────────────────────────────┐
  │ // Dangerous: all permissions in one scope       │
  │ scopes: ['*'] // all permissions                 │
  │                                                   │
  │ → Violates the principle of least privilege      │
  │ → Grant only the required scopes                 │
  └──────────────────────────────────────────────────┘
```

---

## 9. Exercises

### Exercise 1: Basic - Scope-Based API Authorization

```
[Exercise 1] Scope-Based API Authorization

Goal: Experience designing and implementing OAuth scopes

Steps:
1. Build a REST API with Express
   - articles (CRUD)
   - users (Read, Update)

2. Design scopes
   - articles:read, articles:write, articles:delete
   - users:read, users:write
   - admin

3. Implement scope validation middleware
   - Consider the scope hierarchy
   - Include missing scopes in error responses

4. Testing:
   - Verify access is allowed or denied for each scope
   - Verify that admin scope allows all operations

Evaluation criteria:
  □ Scope design satisfies the principle of least privilege
  □ Error responses are informative
  □ Hierarchy is functioning correctly
```

### Exercise 2: Applied - API Key Management System

```
[Exercise 2] API Key Management System

Goal: Implement API key generation, validation, and rotation

Steps:
1. Build an API key management API
   - POST /api/keys (generate key)
   - GET /api/keys (list keys)
   - POST /api/keys/:id/rotate (rotate)
   - DELETE /api/keys/:id (revoke)

2. Security requirements:
   - SHA-256 hash storage
   - Prefix included (sk_live_, etc.)
   - Expiration date setting
   - Grace period on rotation

3. API key authentication middleware:
   - Support multiple transmission methods
   - Integrate rate limiting

Evaluation criteria:
  □ Key plain text is not stored in the DB
  □ Rotation works safely
  □ Revoked keys are immediately invalidated
```

### Exercise 3: Advanced - Multi-Tenant API

```
[Exercise 3] Multi-Tenant API

Goal: Implement API authorization in a multi-tenant environment

Steps:
1. Design the Tenant (Organization) model
2. Implement tenant isolation middleware
3. Automatically apply tenant filters using Prisma Extension
4. Implement cross-tenant data sharing
5. Tenant management API (invitations, role management)

Evaluation criteria:
  □ Data is completely isolated between tenants
  □ Cross-tenant access is impossible
  □ Sharing feature works correctly
  □ Tenant management is secure
```

---

## 10. FAQ and Troubleshooting

### Q1: Should I use an API key or an OAuth token?

```
A: Decide based on the use case:

  API keys:
  → Server-to-server communication (M2M)
  → Third-party integrations
  → When simple authentication is sufficient
  → Long-term access

  OAuth tokens:
  → Delegated user access
  → When scope-based permission control is needed
  → Short-term access (with token refresh)
  → When a consent screen is required
```

### Q2: Should I return 404 or 403?

```
A: Decide based on security requirements:

  General rules:
  → External-facing API: 404 (hide resource existence)
  → Internal API / admin dashboard: 403 (easier to debug)
  → When resource existence is not secret: 403

  Examples:
  → GET /api/users/uuid-abc → 404 (another user's profile)
  → GET /api/admin/settings → 403 (admin permission required)
```

### Q3: How should I design rate limit reset times?

```
A: Design based on these criteria:

  Read APIs: 1-minute window
  → Allows momentary bursts
  → Does not degrade user experience

  Write APIs: 1-hour window
  → Prevents excessive writes
  → Allows normal usage patterns

  Auth APIs: 15-minute window
  → Prevents brute-force attacks
  → Allows legitimate users to retry

  Always include the following headers:
  → X-RateLimit-Limit (limit)
  → X-RateLimit-Remaining (remaining count)
  → X-RateLimit-Reset (reset time)
  → Retry-After (for 429 responses)
```

---


## 11. Performance Considerations

```
API Authorization Performance:

  ┌───────────────────────┬───────────────┬──────────────────┐
  │ Operation             │ Latency       │ Optimization     │
  ├───────────────────────┼───────────────┼──────────────────┤
  │ JWT validation        │ <1ms          │ Signature only   │
  │ API key validation (DB)│ 1-5ms        │ Cache (Redis)    │
  │ Scope check           │ <1ms          │ Set operations   │
  │ Resource authorization│ 5-20ms        │ DB query tuning  │
  │ Tenant isolation      │ 1-5ms         │ Indexing         │
  │ Rate limiting (Redis) │ 1-3ms         │ Pipeline         │
  └───────────────────────┴───────────────┴──────────────────┘

  Optimization tips:
  → Cache API key validation results for a short period (30s-5min)
  → Add indexes to resource authorization query columns
  → Use Redis pipeline to batch multiple rate limit operations
  → Index on tenant filter columns is mandatory
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced material. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving to the next step.

### Q3: How is this used in real-world development?

Knowledge of this topic is frequently applied in day-to-day development work, especially during code reviews and architectural design.

---

## Summary

| Topic | Key Points |
|-------|-----------|
| Scopes | resource:action format, least privilege, hierarchy |
| API Keys | SHA-256 hash storage, prefixed, rotation |
| Resource Authorization | Policy pattern, ownership check + role check |
| Multi-Tenant | Data isolation by tenant ID, Prisma Extension |
| Rate Limiting | Hierarchical limits, plan-based, Redis sliding window |
| Error Design | 401 vs 403 vs 404 usage, RFC 6750 compliance |
| Security | Timing attack mitigation, IDOR prevention, Mass Assignment prevention |

---

## Further Reading

---

## References
1. OWASP. "Authorization Cheat Sheet." cheatsheetseries.owasp.org, 2024.
2. Stripe. "API Keys." stripe.com/docs, 2024.
3. RFC 6750 §3.1. "Insufficient Scope." IETF, 2012.
4. RFC 6585. "Additional HTTP Status Codes (429)." IETF, 2012.
5. OWASP. "IDOR Prevention Cheat Sheet." cheatsheetseries.owasp.org, 2024.
6. GitHub. "OAuth Scopes." docs.github.com, 2024.
7. Google. "OAuth 2.0 Scopes." developers.google.com, 2024.

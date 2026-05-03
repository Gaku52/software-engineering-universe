# REST Best Practices

> Practical best practices beyond the 6 REST constraints. Master production-level REST API design covering resource design, HTTP methods, status codes, error responses, HATEOAS, idempotency design, content negotiation, bulk operations, and partial updates (PATCH).

## What You Will Learn

- [ ] Understand the principles of resource-oriented URI design
- [ ] Know how to use HTTP methods correctly
- [ ] Learn the criteria for selecting status codes
- [ ] Learn RFC 9457-compliant error response design
- [ ] Understand how to use HATEOAS and hypermedia
- [ ] Understand idempotency design and implementation of idempotency keys
- [ ] Learn PATCH (partial update) and bulk operation design
- [ ] Develop the ability to identify and avoid anti-patterns

## Prerequisites

- HTTP methods and status codes → See: HTTP Fundamentals
- Basic principles of API design → See: [API First Design](../00-api-design-principles/00-api-first-design.md)
- API naming conventions → See: [Naming Conventions and Standards](../00-api-design-principles/01-naming-and-conventions.md)

---

## 1. The 6 REST Constraints (Review and Deep Dive)

The REST architectural style proposed by Roy Fielding in his 2000 doctoral dissertation consists of six constraints. These constraints formalize the factors behind the success of the Web and are defined not merely as "design guidelines" but as architectural **constraints**.

```
Roy Fielding's REST Architectural Style (2000):

  ┌─────────────────────────────────────────────────────────────────┐
  │                    The 6 REST Constraints                        │
  ├─────────────────┬───────────────────────────────────────────────┤
  │ ① Client-Server │ Separate UI and data concerns                 │
  │                 │ → Each component can evolve independently     │
  │                 │ → Independent deployment of frontend/backend  │
  ├─────────────────┼───────────────────────────────────────────────┤
  │ ② Stateless     │ Each request contains all required info       │
  │                 │ → Server holds no session state               │
  │                 │ → Foundation for scalability (any server      │
  │                 │   can handle any request)                     │
  ├─────────────────┼───────────────────────────────────────────────┤
  │ ③ Cacheable     │ Responses explicitly indicate cacheability    │
  │                 │ → Cache-Control, ETag, Last-Modified          │
  │                 │ → Improves network efficiency and UX speed    │
  ├─────────────────┼───────────────────────────────────────────────┤
  │ ④ Uniform       │ Resource identification (URI)                 │
  │   Interface     │ Resource manipulation through representations  │
  │                 │ (JSON/XML)                                     │
  │                 │ Self-descriptive messages                     │
  │                 │ HATEOAS                                       │
  ├─────────────────┼───────────────────────────────────────────────┤
  │ ⑤ Layered       │ Client does not distinguish between direct    │
  │   System        │ server or intermediary layers                 │
  │                 │ → Load balancers, CDN, API gateways           │
  │                 │ → Security, monitoring, transformation added  │
  │                 │   transparently                               │
  ├─────────────────┼───────────────────────────────────────────────┤
  │ ⑥ Code on       │ Server can send code to client               │
  │   Demand        │ → JavaScript, WebAssembly, etc.              │
  │   (optional)    │ → The only optional constraint               │
  └─────────────────┴───────────────────────────────────────────────┘
```

### 1.1 Relationships Between Constraints

The six constraints are not independent — they influence each other. The Stateless constraint is a prerequisite for Cacheable, and Uniform Interface enables Layered System.

```
  ┌──────────┐   depends on  ┌───────────┐
  │Stateless │ ─────────────→│ Cacheable │
  │          │ no sessions    │           │ caching compensates for performance
  └──────────┘ so necessary  └───────────┘
       │                          │
       │ prerequisite             │ utilized
       ▼                          ▼
  ┌──────────────┐          ┌────────────┐
  │   Uniform    │ ───────→ │  Layered   │
  │  Interface   │ unified   │  System    │
  │              │ IF enables│            │
  └──────────────┘ layers   └────────────┘
       │
       │ component
       ▼
  ┌──────────┐
  │ HATEOAS  │
  │          │ ← Most important component of Uniform Interface
  └──────────┘
```

---

## 2. Principles of Resource Design

The most important aspect of REST API design is **resource identification and naming**. Resources represent entities or concepts within the system and are uniquely identified by URIs.

### 2.1 URI Design Rules

```
┌────────────────────────────────────────────────────────────────┐
│                     Basic URI Design Principles                 │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1. Use nouns (not verbs)                                      │
│     Good: GET /users                                           │
│     Bad:  GET /getUsers, POST /createUser                      │
│                                                                │
│  2. Use plural forms                                           │
│     Good: /users, /orders, /products                          │
│     Bad:  /user, /order, /product                             │
│                                                                │
│  3. Use kebab-case                                             │
│     Good: /order-items, /shipping-addresses                   │
│     Bad:  /orderItems, /order_items                           │
│                                                                │
│  4. Express hierarchical relationships via path               │
│     Good: /users/123/orders                                   │
│     Note: Recommend max 2 levels deep (3+ reduces readability)│
│                                                                │
│  5. Include versioning in path                                 │
│     Good: /api/v1/users                                       │
│     Alt:  Accept: application/vnd.myapi.v1+json               │
│                                                                │
│  6. Filtering, sorting, paging via query parameters           │
│     Good: /users?status=active&sort=-created_at&page=2        │
│                                                                │
│  7. No trailing slashes                                        │
│     Good: /users/123                                          │
│     Bad:  /users/123/                                         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 Resource Modeling Example

Using an e-commerce site as an example, the overall picture of resource design is shown below.

```javascript
// Resource design example for an e-commerce site

// ── Collection resources (list) ──
// GET /api/v1/products              Product list
// GET /api/v1/categories            Category list
// GET /api/v1/users                 User list (admin only)
// GET /api/v1/orders                Order list

// ── Individual resources (single) ──
// GET /api/v1/products/prod_abc123  Product detail
// GET /api/v1/users/usr_def456      User detail
// GET /api/v1/orders/ord_ghi789     Order detail

// ── Sub-resources (parent-child relationship) ──
// GET /api/v1/users/usr_def456/orders          User's order list
// GET /api/v1/orders/ord_ghi789/items          Order's product list
// GET /api/v1/products/prod_abc123/reviews     Product's review list

// ── Action resources (verb-like operations, REST exceptions) ──
// POST /api/v1/orders/ord_ghi789/cancel        Cancel order
// POST /api/v1/orders/ord_ghi789/refund        Process refund
// POST /api/v1/users/usr_def456/verify-email   Email verification

// ── Singleton resources ──
// GET  /api/v1/users/me                        Current user
// GET  /api/v1/settings                        App settings
// GET  /api/v1/users/usr_def456/cart            User's cart (single)

// ── Search resources ──
// GET  /api/v1/search?q=laptop&category=electronics  Full-text search
// POST /api/v1/products/search                        Complex search (using body)
```

### 2.3 Resource ID Design

The choice of resource identifier is important from both security and operational perspectives.

| ID type | Example | Pros | Cons |
|---------|---------|------|------|
| Sequential (auto-increment) | `123` | Simple, sortable | Guessable, leaks total count |
| UUID v4 | `550e8400-e29b-41d4-a716-446655440000` | Unpredictable, distributed generation | Long, lower index efficiency |
| UUID v7 | `018e4a8c-1234-7abc-8def-0123456789ab` | Time-sortable, unpredictable | Relatively new standard |
| Prefixed ID | `usr_abc123`, `ord_def456` | Type visible at a glance, unpredictable | Requires custom implementation |
| Snowflake ID | `1234567890123456789` | Time-ordered, distributed generation, high performance | 64-bit integer range |

```javascript
// Implementation example for prefixed ID generation
const crypto = require('crypto');

const ID_PREFIXES = {
  user: 'usr',
  order: 'ord',
  product: 'prod',
  payment: 'pay',
  review: 'rev',
};

function generateId(resourceType) {
  const prefix = ID_PREFIXES[resourceType];
  if (!prefix) {
    throw new Error(`Unknown resource type: ${resourceType}`);
  }
  // Generate a 16-byte random string
  const random = crypto.randomBytes(16).toString('base64url');
  return `${prefix}_${random}`;
}

// Usage example
console.log(generateId('user'));    // usr_Ab3dEfGhIjKlMnOpQrSt0w
console.log(generateId('order'));   // ord_Xy9ZaBcDeFgHiJkLmNoPq2
console.log(generateId('product'));// prod_Rs4TuVwXyZaBcDeFgHiJk1
```

---

## 3. Correct Usage of HTTP Methods

### 3.1 Method Overview and Characteristics

```
┌─────────┬──────────────────────────────────────────────────────────┐
│ Method  │ Meaning and Usage                                        │
├─────────┼──────────────────────────────────────────────────────────┤
│ GET     │ Retrieve a resource                                      │
│         │ · No side effects (Safe)                                 │
│         │ · Idempotent                                             │
│         │ · Cacheable                                              │
│         │ · No request body                                        │
├─────────┼──────────────────────────────────────────────────────────┤
│ POST    │ Create a resource / execute an action                    │
│         │ · Non-idempotent (2 calls = 2 resources created)        │
│         │ · Not cacheable                                          │
│         │ · Success: 201 Created + Location header                │
├─────────┼──────────────────────────────────────────────────────────┤
│ PUT     │ Full replacement of a resource                           │
│         │ · Idempotent (same result regardless of how many times) │
│         │ · Creates if resource does not exist (upsert-like)      │
│         │ · Send all fields                                        │
├─────────┼──────────────────────────────────────────────────────────┤
│ PATCH   │ Partial update of a resource                             │
│         │ · Send only changed fields                              │
│         │ · Idempotency is implementation-dependent               │
│         │   (relative changes are non-idempotent)                 │
├─────────┼──────────────────────────────────────────────────────────┤
│ DELETE  │ Delete a resource                                        │
│         │ · Idempotent (no-op or 404 if already deleted)          │
│         │ · Success: 204 No Content (no body)                     │
├─────────┼──────────────────────────────────────────────────────────┤
│ HEAD    │ Same as GET but no body (for checking metadata)          │
│         │ · Check resource existence                              │
│         │ · Check Content-Length                                   │
├─────────┼──────────────────────────────────────────────────────────┤
│ OPTIONS │ Check supported methods                                  │
│         │ · CORS preflight requests                               │
│         │ · Returns supported methods via Allow header            │
└─────────┴──────────────────────────────────────────────────────────┘
```

### 3.2 Method Characteristics Comparison

| Property | GET | POST | PUT | PATCH | DELETE | HEAD | OPTIONS |
|----------|-----|------|-----|-------|--------|------|---------|
| Safe | Yes | No | No | No | No | Yes | Yes |
| Idempotent | Yes | No | Yes | Impl. | Yes | Yes | Yes |
| Cacheable | Yes | No | No | No | No | Yes | No |
| Request Body | No | Yes | Yes | Yes | Optional | No | No |
| Typical success code | 200 | 201 | 200 | 200 | 204 | 200 | 200 |

### 3.3 Complete CRUD Implementation Example

```javascript
const express = require('express');
const router = express.Router();

// ── GET: Retrieve collection (list) ──
router.get('/api/v1/products', async (req, res) => {
  const {
    page = 1,
    limit = 20,
    sort = '-created_at',
    category,
    min_price,
    max_price,
    q, // search query
  } = req.query;

  const filters = {};
  if (category) filters.category = category;
  if (min_price) filters.price = { $gte: Number(min_price) };
  if (max_price) filters.price = { ...filters.price, $lte: Number(max_price) };

  const [products, total] = await Promise.all([
    Product.find(filters)
      .sort(parseSortParam(sort))
      .skip((page - 1) * limit)
      .limit(Number(limit)),
    Product.countDocuments(filters),
  ]);

  res.status(200).json({
    data: products.map(serializeProduct),
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      total_pages: Math.ceil(total / limit),
    },
    links: {
      self: `/api/v1/products?page=${page}&limit=${limit}`,
      first: `/api/v1/products?page=1&limit=${limit}`,
      last: `/api/v1/products?page=${Math.ceil(total / limit)}&limit=${limit}`,
      ...(page > 1 && {
        prev: `/api/v1/products?page=${page - 1}&limit=${limit}`,
      }),
      ...(page < Math.ceil(total / limit) && {
        next: `/api/v1/products?page=${Number(page) + 1}&limit=${limit}`,
      }),
    },
  });
});

// ── GET: Retrieve individual resource ──
router.get('/api/v1/products/:id', async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json({
      type: 'https://api.example.com/errors/not-found',
      title: 'Product Not Found',
      status: 404,
      detail: `Product with id '${req.params.id}' does not exist.`,
      instance: `/api/v1/products/${req.params.id}`,
    });
  }

  res.status(200)
    .set('ETag', `"${product.version}"`)
    .set('Last-Modified', product.updated_at.toUTCString())
    .set('Cache-Control', 'private, max-age=60')
    .json({
      data: serializeProduct(product),
      links: {
        self: { href: `/api/v1/products/${product.id}` },
        reviews: { href: `/api/v1/products/${product.id}/reviews` },
        category: { href: `/api/v1/categories/${product.category_id}` },
      },
    });
});

// ── POST: Create resource ──
router.post('/api/v1/products', authenticate, authorize('admin'), async (req, res) => {
  // Validation
  const { error, value } = productSchema.validate(req.body);
  if (error) {
    return res.status(422).json({
      type: 'https://api.example.com/errors/validation',
      title: 'Validation Error',
      status: 422,
      detail: 'One or more fields failed validation.',
      errors: error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message,
        code: 'INVALID_VALUE',
      })),
    });
  }

  const product = await Product.create({
    ...value,
    id: generateId('product'),
    created_by: req.user.id,
  });

  res.status(201)
    .set('Location', `/api/v1/products/${product.id}`)
    .json({
      data: serializeProduct(product),
      links: {
        self: { href: `/api/v1/products/${product.id}` },
      },
    });
});

// ── PUT: Full resource replacement ──
router.put('/api/v1/products/:id', authenticate, authorize('admin'), async (req, res) => {
  const { error, value } = productSchema.validate(req.body);
  if (error) {
    return res.status(422).json({
      type: 'https://api.example.com/errors/validation',
      title: 'Validation Error',
      status: 422,
      errors: error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message,
      })),
    });
  }

  // Optimistic locking
  const ifMatch = req.headers['if-match'];
  const existing = await Product.findById(req.params.id);

  if (!existing) {
    return res.status(404).json({
      type: 'https://api.example.com/errors/not-found',
      title: 'Product Not Found',
      status: 404,
    });
  }

  if (ifMatch && ifMatch !== `"${existing.version}"`) {
    return res.status(412).json({
      type: 'https://api.example.com/errors/precondition-failed',
      title: 'Precondition Failed',
      status: 412,
      detail: 'The resource has been modified since your last request.',
      currentETag: `"${existing.version}"`,
    });
  }

  const updated = await Product.findByIdAndUpdate(
    req.params.id,
    { ...value, version: existing.version + 1 },
    { new: true }
  );

  res.status(200)
    .set('ETag', `"${updated.version}"`)
    .json({ data: serializeProduct(updated) });
});

// ── DELETE: Delete resource ──
router.delete('/api/v1/products/:id', authenticate, authorize('admin'), async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json({
      type: 'https://api.example.com/errors/not-found',
      title: 'Product Not Found',
      status: 404,
    });
  }

  // Soft delete (recommended)
  await Product.findByIdAndUpdate(req.params.id, {
    deleted_at: new Date(),
    deleted_by: req.user.id,
  });

  // Hard delete: await Product.findByIdAndDelete(req.params.id);

  res.status(204).end();
});
```

---

## 4. Complete Status Code Guide

HTTP status codes are the "vocabulary" of an API. By returning appropriate codes, clients can understand the meaning of a response without additional information.

### 4.1 Status Code List and Use Cases

```
┌─────┬──────────────────────────┬────────────────────────────────────┐
│Code │ Name                     │ Use Case                           │
├─────┼──────────────────────────┼────────────────────────────────────┤
│     │ === 2xx Success ===      │                                    │
│ 200 │ OK                       │ Success for GET/PUT/PATCH          │
│ 201 │ Created                  │ Resource created via POST          │
│ 202 │ Accepted                 │ Async processing accepted          │
│ 204 │ No Content               │ DELETE success (no body)          │
├─────┼──────────────────────────┼────────────────────────────────────┤
│     │ === 3xx Redirect ===     │                                    │
│ 301 │ Moved Permanently        │ Resource permanently moved         │
│ 302 │ Found                    │ Temporary redirect                 │
│ 304 │ Not Modified             │ Cache valid (conditional GET)      │
│ 307 │ Temporary Redirect       │ Redirect preserving method         │
│ 308 │ Permanent Redirect       │ Permanent redirect preserving method│
├─────┼──────────────────────────┼────────────────────────────────────┤
│     │ === 4xx Client Error === │                                    │
│ 400 │ Bad Request              │ Request syntax error               │
│ 401 │ Unauthorized             │ Authentication required (unauthenticated) │
│ 403 │ Forbidden                │ Authorization error (insufficient permissions) │
│ 404 │ Not Found                │ Resource does not exist            │
│ 405 │ Method Not Allowed       │ HTTP method not permitted          │
│ 406 │ Not Acceptable           │ Requested format not supported     │
│ 409 │ Conflict                 │ Resource conflict (optimistic lock, etc.) │
│ 410 │ Gone                     │ Resource permanently deleted       │
│ 412 │ Precondition Failed      │ If-Match or other precondition mismatch │
│ 415 │ Unsupported Media Type   │ Content-Type not supported         │
│ 422 │ Unprocessable Entity     │ Validation error                   │
│ 429 │ Too Many Requests        │ Rate limit exceeded                │
├─────┼──────────────────────────┼────────────────────────────────────┤
│     │ === 5xx Server Error === │                                    │
│ 500 │ Internal Server Error    │ Internal server error (generic)    │
│ 502 │ Bad Gateway              │ Invalid response from upstream     │
│ 503 │ Service Unavailable      │ Service temporarily unavailable (maintenance, etc.) │
│ 504 │ Gateway Timeout          │ Upstream server timeout            │
└─────┴──────────────────────────┴────────────────────────────────────┘
```

### 4.2 Common Misuses and Correct Choices

| Situation | Common Misuse | Correct Code | Reason |
|-----------|--------------|--------------|--------|
| Login failure | 403 | **401** | Login failure is an authentication (Authentication) failure → 401. 403 is for authorization (Authorization) failure |
| Validation error | 400 | **422** | Syntax is valid but semantically invalid. 400 is for syntax errors |
| Resource already exists | 400 | **409** | 409 represents a state conflict |
| Rate limiting | 503 | **429** | This is a client-side issue, hence 4xx. 503 is server-side |
| Async processing accepted | 200 | **202** | Processing is not yet complete, so 200 is inappropriate |
| DELETE on already deleted resource | 404 | **204 or 404** | Both are valid. 204 emphasizes idempotency; 404 is more strict |

### 4.3 Status Code Selection Flowchart

```
  Request received
       │
       ▼
  Valid syntax? ─── No ──→ 400 Bad Request
       │
      Yes
       │
       ▼
  Authenticated? ─── No ──→ 401 Unauthorized
       │
      Yes
       │
       ▼
  Authorized? ─── No ──→ 403 Forbidden
       │
      Yes
       │
       ▼
  Resource exists? ─── No ──→ 404 Not Found
       │                       (skip for POST)
      Yes
       │
       ▼
  Validation passed? ─── No ──→ 422 Unprocessable Entity
       │
      Yes
       │
       ▼
  No conflict? ─── No ──→ 409 Conflict
       │
      Yes
       │
       ▼
  Processing succeeded? ─── No ──→ 500 Internal Server Error
       │
      Yes
       │
       ▼
  Response based on method:
    GET/PUT/PATCH → 200 OK
    POST          → 201 Created
    DELETE        → 204 No Content
    Async         → 202 Accepted
```

---

## 5. Error Response Design (RFC 9457)

### 5.1 Problem Details for HTTP APIs

RFC 9457 (formerly RFC 7807) is a specification that standardizes error responses for HTTP APIs. This allows error handling code to be shared across different APIs.

```javascript
// RFC 9457-compliant error response structure

// Basic structure
{
  "type": "https://api.example.com/errors/validation",     // URI identifying the error type
  "title": "Validation Error",                              // Human-readable title
  "status": 422,                                            // HTTP status code
  "detail": "The 'email' field is not a valid email address.", // Specific description
  "instance": "/api/v1/users"                               // URI of the request where the error occurred
}

// With extended fields (validation error)
{
  "type": "https://api.example.com/errors/validation",
  "title": "Validation Error",
  "status": 422,
  "detail": "One or more fields failed validation.",
  "instance": "/api/v1/users",
  "errors": [
    {
      "field": "email",
      "message": "Must be a valid email address.",
      "code": "INVALID_FORMAT",
      "rejected_value": "not-an-email"
    },
    {
      "field": "age",
      "message": "Must be between 0 and 150.",
      "code": "OUT_OF_RANGE",
      "rejected_value": -5
    }
  ]
}

// Rate limit error
{
  "type": "https://api.example.com/errors/rate-limit",
  "title": "Rate Limit Exceeded",
  "status": 429,
  "detail": "You have exceeded the rate limit of 100 requests per minute.",
  "instance": "/api/v1/products",
  "retry_after": 30,
  "limit": 100,
  "remaining": 0,
  "reset": "2025-01-15T10:30:00Z"
}
```

### 5.2 Implementing Error Responses

```javascript
// Middleware implementation for error handling

class ApiError extends Error {
  constructor(type, title, status, detail, extensions = {}) {
    super(detail);
    this.type = type;
    this.title = title;
    this.status = status;
    this.detail = detail;
    this.extensions = extensions;
  }

  toJSON() {
    return {
      type: this.type,
      title: this.title,
      status: this.status,
      detail: this.detail,
      ...this.extensions,
    };
  }
}

// Predefined error factories
const Errors = {
  notFound: (resource, id) =>
    new ApiError(
      'https://api.example.com/errors/not-found',
      `${resource} Not Found`,
      404,
      `${resource} with id '${id}' does not exist.`
    ),

  validation: (errors) =>
    new ApiError(
      'https://api.example.com/errors/validation',
      'Validation Error',
      422,
      'One or more fields failed validation.',
      { errors }
    ),

  unauthorized: () =>
    new ApiError(
      'https://api.example.com/errors/unauthorized',
      'Unauthorized',
      401,
      'Authentication is required to access this resource.'
    ),

  forbidden: () =>
    new ApiError(
      'https://api.example.com/errors/forbidden',
      'Forbidden',
      403,
      'You do not have permission to access this resource.'
    ),

  conflict: (detail) =>
    new ApiError(
      'https://api.example.com/errors/conflict',
      'Resource Conflict',
      409,
      detail
    ),

  rateLimited: (retryAfter, limit) =>
    new ApiError(
      'https://api.example.com/errors/rate-limit',
      'Rate Limit Exceeded',
      429,
      `Rate limit of ${limit} requests exceeded.`,
      { retry_after: retryAfter, limit }
    ),
};

// Express global error handler
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res
      .status(err.status)
      .set('Content-Type', 'application/problem+json')
      .json({
        ...err.toJSON(),
        instance: req.originalUrl,
      });
  }

  // Unexpected error
  console.error('Unhandled error:', err);
  res
    .status(500)
    .set('Content-Type', 'application/problem+json')
    .json({
      type: 'https://api.example.com/errors/internal',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred. Please try again later.',
      instance: req.originalUrl,
    });
}

// Usage example
router.get('/api/v1/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw Errors.notFound('User', req.params.id);
  res.json({ data: user });
});
```

---

## 6. HATEOAS (Deep Dive)

### 6.1 The Essence of HATEOAS

HATEOAS (Hypermedia As The Engine Of Application State) is the most important component of REST's Uniform Interface. Clients do not need to know the URL structure of the API in advance — they can operate the API solely through links included in responses.

```
HATEOAS = Hypermedia As The Engine Of Application State

  ┌───────────────────────────────────────────────────────┐
  │            HATEOAS Operation Model                     │
  │                                                       │
  │  Client              Server                           │
  │      │                   │                            │
  │      │  GET /api/v1/     │                            │
  │      │ ───────────────→  │                            │
  │      │                   │  Root resource:            │
  │      │  ←─────────────── │  { links: {                │
  │      │                   │      users: "/api/v1/users"│
  │      │                   │      products: "..."       │
  │      │                   │    }                       │
  │      │                   │  }                         │
  │      │                   │                            │
  │      │  Follow link       │                            │
  │      │  GET /api/v1/users│                            │
  │      │ ───────────────→  │                            │
  │      │                   │  User list:                │
  │      │  ←─────────────── │  { data: [...],            │
  │      │                   │    links: {                │
  │      │                   │      self, next, prev,     │
  │      │                   │      create: { method:POST}│
  │      │                   │    }                       │
  │      │                   │  }                         │
  │      │                   │                            │
  │      │  Follow next link  │                            │
  │      │  ...              │                            │
  └───────────────────────────────────────────────────────┘

  Key concepts:
  → Client only needs to know the initial URL (entry point)
  → All subsequent operations are discovered through response links
  → API structural changes (URL changes) do not affect clients
```

### 6.2 State Transitions and Dynamic Link Changes

The core of HATEOAS is that the available actions (links) change depending on the state of the resource.

```javascript
// HATEOAS links based on order resource state transitions

function buildOrderLinks(order) {
  const base = `/api/v1/orders/${order.id}`;
  const links = {
    self: { href: base, method: 'GET' },
    items: { href: `${base}/items`, method: 'GET' },
  };

  switch (order.status) {
    case 'draft':
      links.submit = { href: `${base}/submit`, method: 'POST' };
      links.update = { href: base, method: 'PUT' };
      links.delete = { href: base, method: 'DELETE' };
      break;

    case 'pending':
      links.pay = { href: `${base}/pay`, method: 'POST' };
      links.cancel = { href: `${base}/cancel`, method: 'POST' };
      break;

    case 'paid':
      links.ship = { href: `${base}/ship`, method: 'POST' };
      links.refund = { href: `${base}/refund`, method: 'POST' };
      links.invoice = { href: `${base}/invoice`, method: 'GET' };
      break;

    case 'shipped':
      links.track = { href: `${base}/tracking`, method: 'GET' };
      links.return_request = { href: `${base}/return`, method: 'POST' };
      break;

    case 'delivered':
      links.review = { href: `${base}/review`, method: 'POST' };
      links.return_request = { href: `${base}/return`, method: 'POST' };
      break;

    case 'cancelled':
    case 'refunded':
      // Terminal state: no additional actions
      break;
  }

  return links;
}

// Response example: status = 'pending'
// {
//   "data": {
//     "id": "ord_abc123",
//     "status": "pending",
//     "total": 5000,
//     "items": [...]
//   },
//   "links": {
//     "self":   { "href": "/api/v1/orders/ord_abc123", "method": "GET" },
//     "items":  { "href": "/api/v1/orders/ord_abc123/items", "method": "GET" },
//     "pay":    { "href": "/api/v1/orders/ord_abc123/pay", "method": "POST" },
//     "cancel": { "href": "/api/v1/orders/ord_abc123/cancel", "method": "POST" }
//   }
// }
```

### 6.3 Practical HATEOAS Adoption Levels

```
  Level 0: Completely ignored
    → URLs are distributed via documentation, clients hardcode them
    → Most common but requires updating all clients when API changes

  Level 1: Links to related resources
    → Include self links to related resources in responses
    → GitHub API, Stripe API are at this level
    → Recommended: aim for at least this standard

  Level 2: With action links
    → Include available actions (with method) as links
    → PayPal API is at this level
    → Recommended: adopt for resources with state transitions

  Level 3: Full HATEOAS
    → Client only needs to know the entry point URL to operate
    → Uses hypermedia formats like HAL, JSON-LD, Siren
    → High implementation cost; limited real-world adoption
```

---

## 7. Idempotency Design

### 7.1 What Is Idempotency?

Idempotency refers to the property whereby performing the same operation multiple times always yields the same result. It is an essential concept for maintaining data consistency in production environments where network failures and retries occur.

```
Idempotency:
  → The same request produces the same result no matter how many times it is executed

  Idempotent methods:
    GET     — Always idempotent (no side effects)
    PUT     — Idempotent (overwrites the same resource to the same state)
    DELETE  — Idempotent (no-op or 404 if already deleted)
    HEAD    — Always idempotent
    OPTIONS — Always idempotent

  Non-idempotent methods:
    POST    — Running twice creates two resources
    PATCH   — When using relative changes (e.g., { "op": "increment", "value": 1 })
```

### 7.2 Idempotency Key

An Idempotency Key is a mechanism for making POST requests idempotent. Adopted by the Stripe API, it has become an industry standard.

```javascript
// Server-side implementation of idempotency keys (using Redis)
const Redis = require('ioredis');
const redis = new Redis();
const crypto = require('crypto');

// Idempotency middleware
async function idempotencyMiddleware(req, res, next) {
  const idempotencyKey = req.headers['idempotency-key'];

  // No key: proceed without idempotency
  if (!idempotencyKey) return next();

  // Validate key format (UUID v4 recommended)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    return res.status(400).json({
      type: 'https://api.example.com/errors/invalid-idempotency-key',
      title: 'Invalid Idempotency Key',
      status: 400,
      detail: 'Idempotency-Key must be a valid UUID v4.',
    });
  }

  const cacheKey = `idempotency:${req.method}:${req.path}:${idempotencyKey}`;

  // Acquire lock (prevent concurrent processing of the same key)
  const lockKey = `${cacheKey}:lock`;
  const lockAcquired = await redis.set(lockKey, '1', 'EX', 60, 'NX');

  if (!lockAcquired) {
    return res.status(409).json({
      type: 'https://api.example.com/errors/concurrent-request',
      title: 'Concurrent Request',
      status: 409,
      detail: 'A request with this idempotency key is currently being processed.',
    });
  }

  try {
    // Check cache
    const cached = await redis.get(cacheKey);

    if (cached) {
      // Already processed → return the cached result as-is
      const { statusCode, headers, body } = JSON.parse(cached);
      Object.entries(headers).forEach(([key, value]) => res.set(key, value));
      return res.status(statusCode).json(body);
    }

    // Save hash of request body (detect same key with different body)
    const bodyHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(req.body))
      .digest('hex');

    // Intercept and save response
    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      const responseHeaders = {
        'content-type': res.get('content-type'),
        'location': res.get('location'),
      };

      await redis.setex(cacheKey, 86400, JSON.stringify({
        statusCode: res.statusCode,
        headers: responseHeaders,
        body,
        bodyHash,
      }));

      return originalJson(body);
    };

    next();
  } finally {
    // Release lock
    await redis.del(lockKey);
  }
}

// Usage
app.post('/api/v1/payments', idempotencyMiddleware, paymentHandler);
app.post('/api/v1/orders', idempotencyMiddleware, orderHandler);
```

---

## 8. Content Negotiation

### 8.1 Basic Concepts

Content negotiation is the process by which a client and server agree on the optimal representation format.

```
Content Negotiation:
  → Client specifies the desired representation format

  Request:
    Accept: application/json          ← Wants JSON
    Accept: application/xml           ← Wants XML
    Accept: text/csv                  ← Wants CSV
    Accept: application/pdf           ← Wants PDF
    Accept-Language: ja               ← Wants Japanese
    Accept-Encoding: gzip, br         ← Compression format

  Response:
    Content-Type: application/json; charset=utf-8
    Content-Language: ja
    Content-Encoding: br

  406 Not Acceptable:
    → Returned when the server does not support the client's requested format

Implementation patterns:
  (1) Accept header-based (standard, recommended)
  (2) Extension-based: /users.json, /users.xml
  (3) Query parameter: /users?format=csv

Recommended:
  → Default is JSON
  → Support CSV export for admin interfaces
  → Switch format via Accept header
```

### 8.2 Implementing Content Negotiation

```javascript
// Content negotiation implementation in Express

function contentNegotiation(formatters) {
  return (req, res, next) => {
    // req.accepts() is Express's built-in Accept header parser
    const format = req.accepts(Object.keys(formatters));

    if (!format) {
      return res.status(406).json({
        type: 'https://api.example.com/errors/not-acceptable',
        title: 'Not Acceptable',
        status: 406,
        detail: `Supported formats: ${Object.keys(formatters).join(', ')}`,
      });
    }

    // Set the selected formatter on res
    res.formatResponse = (data) => {
      const formatter = formatters[format];
      const { contentType, body } = formatter(data);
      res.set('Content-Type', contentType).send(body);
    };

    next();
  };
}

// Formatter definitions
const userFormatters = {
  'application/json': (data) => ({
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(data),
  }),
  'text/csv': (data) => ({
    contentType: 'text/csv; charset=utf-8',
    body: convertToCsv(data),
  }),
  'application/xml': (data) => ({
    contentType: 'application/xml; charset=utf-8',
    body: convertToXml(data),
  }),
};

// Usage
router.get(
  '/api/v1/users',
  contentNegotiation(userFormatters),
  async (req, res) => {
    const users = await User.find();
    res.formatResponse({ data: users });
  }
);
```

---

## 9. Partial Updates (PATCH) — Deep Dive

PATCH is the HTTP method for partial updates to a resource. While PUT means complete replacement of a resource, PATCH only sends the fields that need to be changed.

### 9.1 PUT vs PATCH Comparison

| Property | PUT | PATCH |
|----------|-----|-------|
| Meaning | Complete resource replacement | Partial resource update |
| Fields sent | All fields | Only changed fields |
| Idempotency | Always idempotent | Implementation-dependent |
| Missing fields | Default value or null | Unchanged |
| Bandwidth | Large | Small |
| Use case | Complete overwrite of settings | Profile update, etc. |

### 9.2 Merge Patch (RFC 7396)

Merge Patch is the simplest form of partial update. Send the JSON object as-is and only the included fields are updated.

```javascript
// Merge Patch implementation

// Request:
// PATCH /api/v1/users/usr_abc123
// Content-Type: application/merge-patch+json
// {
//   "name": "Updated Name",    ← Update value
//   "address": null,            ← Delete field
//   // email not included       ← No change
// }

function applyMergePatch(original, patch) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
    return patch;
  }

  const result = { ...original };

  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      // null → delete the field
      delete result[key];
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Nested object → recursively merge
      result[key] = applyMergePatch(result[key] || {}, value);
    } else {
      // Otherwise → set the value
      result[key] = value;
    }
  }

  return result;
}

// Express route
router.patch('/api/v1/users/:id', authenticate, async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw Errors.notFound('User', req.params.id);

  // Validation (validate with partial schema)
  const { error, value } = userPatchSchema.validate(req.body, {
    allowUnknown: false,
    stripUnknown: true,
  });
  if (error) throw Errors.validation(error.details);

  const updated = applyMergePatch(user.toObject(), value);
  const savedUser = await User.findByIdAndUpdate(req.params.id, updated, { new: true });

  res.status(200).json({ data: serializeUser(savedUser) });
});
```

#### Merge Patch Limitations

```
Merge Patch limitations:

  1. Cannot partially update arrays
     → Arrays are always fully replaced
     → Example: to add "c" to tags: ["a", "b"],
           you must send tags: ["a", "b", "c"] in full

  2. Cannot distinguish between setting null and deleting a field
     → null is interpreted as "delete this field"
     → Problematic when you want to set null as a value

  3. Handling of empty objects
     → {} means "no changes"
     → Problematic when you want to set an empty object as a value

  If these limitations are a problem → consider JSON Patch
```

### 9.3 JSON Patch (RFC 6902)

JSON Patch is a partial update format allowing finer-grained operations, expressed as a list of operations.

```javascript
// JSON Patch request example:
// PATCH /api/v1/users/usr_abc123
// Content-Type: application/json-patch+json
// [
//   { "op": "replace", "path": "/name", "value": "Updated Name" },
//   { "op": "add", "path": "/tags/-", "value": "vip" },
//   { "op": "remove", "path": "/address" },
//   { "op": "move", "from": "/old_field", "path": "/new_field" },
//   { "op": "copy", "from": "/name", "path": "/display_name" },
//   { "op": "test", "path": "/version", "value": 5 }
// ]

// JSON Patch operations:
//   add     — Add a field / insert an array element
//   remove  — Remove a field / delete an array element
//   replace — Replace a field value
//   move    — Move a field (remove + add)
//   copy    — Copy a field
//   test    — Validate a value (abort all operations if mismatch)

// Implementation using the fast-json-patch library
const jsonPatch = require('fast-json-patch');

router.patch('/api/v1/users/:id', authenticate, async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw Errors.notFound('User', req.params.id);

  const contentType = req.headers['content-type'];

  let updatedData;

  if (contentType === 'application/json-patch+json') {
    // JSON Patch
    const patchOps = req.body;

    // Validation
    const validationResult = jsonPatch.validate(patchOps, user.toObject());
    if (validationResult) {
      return res.status(422).json({
        type: 'https://api.example.com/errors/invalid-patch',
        title: 'Invalid JSON Patch',
        status: 422,
        detail: validationResult.message,
      });
    }

    // Apply patch
    updatedData = jsonPatch.applyPatch(
      jsonPatch.deepClone(user.toObject()),
      patchOps
    ).newDocument;

  } else if (contentType === 'application/merge-patch+json') {
    // Merge Patch
    updatedData = applyMergePatch(user.toObject(), req.body);

  } else {
    return res.status(415).json({
      type: 'https://api.example.com/errors/unsupported-media-type',
      title: 'Unsupported Media Type',
      status: 415,
      detail: 'Use application/json-patch+json or application/merge-patch+json.',
    });
  }

  const savedUser = await User.findByIdAndUpdate(req.params.id, updatedData, { new: true });
  res.status(200).json({ data: serializeUser(savedUser) });
});
```

---

## 10. Bulk Operations

### 10.1 Bulk Operation Design Patterns

Design patterns for operating on multiple resources at once.

```javascript
// Complete implementation example for batch requests

// ── Batch create ──
// POST /api/v1/users/batch
router.post('/api/v1/users/batch', authenticate, authorize('admin'), async (req, res) => {
  const { operations } = req.body;

  // Batch size limit
  if (!operations || operations.length === 0) {
    throw Errors.validation([{
      field: 'operations',
      message: 'At least one operation is required.',
      code: 'REQUIRED',
    }]);
  }

  if (operations.length > 100) {
    throw Errors.validation([{
      field: 'operations',
      message: 'Maximum 100 operations per batch.',
      code: 'MAX_EXCEEDED',
    }]);
  }

  const results = [];
  let succeeded = 0;
  let failed = 0;

  for (const op of operations) {
    try {
      // Individual validation
      const { error, value } = userSchema.validate(op.body);
      if (error) {
        results.push({
          status: 422,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            detail: error.details[0].message,
          },
        });
        failed++;
        continue;
      }

      // Create resource
      const user = await User.create({
        ...value,
        id: generateId('user'),
        created_by: req.user.id,
      });

      results.push({
        status: 201,
        data: serializeUser(user),
      });
      succeeded++;

    } catch (err) {
      results.push({
        status: 500,
        error: {
          type: 'https://api.example.com/errors/internal',
          title: 'Internal Error',
          detail: 'Failed to process this operation.',
        },
      });
      failed++;
    }
  }

  // Overall HTTP status:
  //   All succeeded → 200
  //   Partial failure → 207 Multi-Status
  //   All failed → 422
  const overallStatus = failed === 0 ? 200 : succeeded === 0 ? 422 : 207;

  res.status(overallStatus).json({
    results,
    meta: {
      total: operations.length,
      succeeded,
      failed,
    },
  });
});

// ── Bulk delete ──
// POST /api/v1/users/batch-delete
router.post('/api/v1/users/batch-delete', authenticate, authorize('admin'), async (req, res) => {
  const { ids } = req.body;

  if (!ids || ids.length === 0) {
    throw Errors.validation([{
      field: 'ids',
      message: 'At least one ID is required.',
    }]);
  }

  if (ids.length > 100) {
    throw Errors.validation([{
      field: 'ids',
      message: 'Maximum 100 IDs per batch delete.',
    }]);
  }

  const result = await User.updateMany(
    { id: { $in: ids } },
    { deleted_at: new Date(), deleted_by: req.user.id }
  );

  res.status(200).json({
    meta: {
      requested: ids.length,
      deleted: result.modifiedCount,
      not_found: ids.length - result.modifiedCount,
    },
  });
});

// ── Bulk update ──
// PATCH /api/v1/users/batch
router.patch('/api/v1/users/batch', authenticate, authorize('admin'), async (req, res) => {
  const { ids, update } = req.body;

  if (!ids || ids.length === 0 || !update) {
    throw Errors.validation([{
      field: 'ids',
      message: 'IDs and update fields are required.',
    }]);
  }

  const result = await User.updateMany(
    { id: { $in: ids } },
    { $set: update }
  );

  res.status(200).json({
    meta: {
      requested: ids.length,
      updated: result.modifiedCount,
    },
  });
});
```

### 10.2 Bulk Operation Design Considerations

```
Bulk operation design points:

  1. Transaction control
     ┌─────────────────────────────────────────────────┐
     │  All-or-Nothing (transaction)                    │
     │  → Roll back everything if any one fails        │
     │  → When data consistency is critical (payments) │
     │  → Lower performance but safe                   │
     ├─────────────────────────────────────────────────┤
     │  Partial Success                                 │
     │  → Process each operation independently,        │
     │    return individual success/failure            │
     │  → Suitable for bulk imports                    │
     │  → Return individual results with 207 Multi-Status│
     └─────────────────────────────────────────────────┘

  2. Size limits
     → Set upper limit on batch size (e.g., 100 items)
     → Limit request body size
     → Consider timeouts

  3. Progress notification (for large datasets)
     → Async processing + polling
     → POST /api/v1/imports → 202 Accepted + Job ID
     → GET /api/v1/jobs/{job_id} → Check progress

  4. Error reporting
     → Return index and error content for each operation
     → Enable client to identify which operations to retry
```

---

## 11. Optimistic Locking

### 11.1 Optimistic Locking with ETag / If-Match

Optimistic locking is a mechanism for detecting concurrent update conflicts using HTTP headers.

```
Optimistic locking flow:

  Client A                Server               Client B
     │                       │                      │
     │  GET /users/123       │                      │
     │ ─────────────────────→│                      │
     │  200 OK               │                      │
     │  ETag: "v5"           │                      │
     │ ←─────────────────────│                      │
     │                       │  GET /users/123      │
     │                       │←─────────────────────│
     │                       │  200 OK              │
     │                       │  ETag: "v5"          │
     │                       │─────────────────────→│
     │                       │                      │
     │  PUT /users/123       │                      │
     │  If-Match: "v5"       │                      │
     │  { name: "Alice" }    │                      │
     │ ─────────────────────→│                      │
     │  200 OK               │                      │
     │  ETag: "v6"           │                      │
     │ ←─────────────────────│                      │
     │                       │                      │
     │                       │  PUT /users/123      │
     │                       │  If-Match: "v5"      │
     │                       │  { name: "Bob" }     │
     │                       │←─────────────────────│
     │                       │  412 Precondition    │
     │                       │  Failed              │
     │                       │  (v5 != v6)          │
     │                       │─────────────────────→│
     │                       │                      │
     │                       │  Client B re-fetches │
     │                       │  and retries         │
```

```javascript
// Complete implementation of optimistic locking

router.put('/api/v1/users/:id', authenticate, async (req, res) => {
  const ifMatch = req.headers['if-match'];
  const user = await User.findById(req.params.id);

  if (!user) throw Errors.notFound('User', req.params.id);

  // If If-Match header is provided, validate ETag
  if (ifMatch) {
    const currentETag = `"${user.version}"`;
    if (ifMatch !== currentETag) {
      return res.status(412).json({
        type: 'https://api.example.com/errors/precondition-failed',
        title: 'Precondition Failed',
        status: 412,
        detail: 'The resource has been modified since your last request. '
          + 'Please retrieve the latest version and retry.',
        current_etag: currentETag,
        your_etag: ifMatch,
      });
    }
  }

  // Validation
  const { error, value } = userSchema.validate(req.body);
  if (error) throw Errors.validation(error.details);

  // Update (increment version)
  const updated = await User.findOneAndUpdate(
    { _id: req.params.id, version: user.version }, // include version in condition
    { ...value, version: user.version + 1 },
    { new: true }
  );

  // Detect conflict at DB level too (when findOneAndUpdate returns null)
  if (!updated) {
    return res.status(409).json({
      type: 'https://api.example.com/errors/conflict',
      title: 'Resource Conflict',
      status: 409,
      detail: 'The resource was modified by another request during processing.',
    });
  }

  res.status(200)
    .set('ETag', `"${updated.version}"`)
    .json({ data: serializeUser(updated) });
});
```

---

## 12. Response Compression and Caching Strategy

### 12.1 Compression

```
Compression format comparison:

  ┌──────────────────────────────────────────────────────┐
  │  Format   │  Ratio    │  Speed    │  Browser Support  │
  ├───────────┼──────────┼──────────┼──────────────────┤
  │  gzip     │  Good     │  Fast     │  Almost all      │
  │  Brotli   │  Best     │  Medium   │  Major browsers  │
  │           │ (+20-30%  │ (compress │  (except IE)     │
  │           │  vs gzip) │  is slow) │                  │
  │  zstd     │  Best     │  Fastest  │  Limited (new)   │
  └──────────────────────────────────────────────────────┘

  Recommended settings:
  → JSON API responses: Brotli (supporting browsers) or gzip (fallback)
  → Responses under 1KB: no compression needed (overhead outweighs benefit)
  → Static assets: pre-compress (generate .br / .gz at build time)
```

### 12.2 Caching Strategy

```javascript
// Cache header configuration in Express

// Immutable resources (build assets, images, etc.)
app.use('/static', express.static('public', {
  maxAge: '365d',
  immutable: true,
  setHeaders: (res) => {
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));

// Cache control middleware for API responses
function cacheControl(options = {}) {
  return (req, res, next) => {
    const {
      visibility = 'private',   // 'public' or 'private'
      maxAge = 0,               // seconds
      sMaxAge,                  // CDN cache seconds
      mustRevalidate = false,
      noCache = false,
      noStore = false,
    } = options;

    const directives = [];

    if (noStore) {
      directives.push('no-store');
    } else if (noCache) {
      directives.push(`${visibility}`, 'no-cache');
    } else {
      directives.push(visibility);
      directives.push(`max-age=${maxAge}`);
      if (sMaxAge !== undefined) directives.push(`s-maxage=${sMaxAge}`);
      if (mustRevalidate) directives.push('must-revalidate');
    }

    res.set('Cache-Control', directives.join(', '));
    next();
  };
}

// Usage examples
// Product list: 60-second cache, CDN 300 seconds
router.get('/api/v1/products',
  cacheControl({ visibility: 'public', maxAge: 60, sMaxAge: 300 }),
  productListHandler
);

// User info: no cache, verify with server each time (use 304 with ETag)
router.get('/api/v1/users/me',
  cacheControl({ visibility: 'private', noCache: true }),
  currentUserHandler
);

// Payment info: caching prohibited
router.get('/api/v1/payments/:id',
  cacheControl({ noStore: true }),
  paymentHandler
);

// Master settings: 1-hour cache
router.get('/api/v1/settings',
  cacheControl({ visibility: 'public', maxAge: 3600 }),
  settingsHandler
);
```

---

## 13. Pagination Design

Pagination is essential for APIs that return large lists of resources. Three major approaches are compared below.

### 13.1 Pagination Method Comparison

| Method | Parameter example | Pros | Cons |
|--------|------------------|------|------|
| Offset-based | `?page=3&limit=20` | Easy to implement, can jump to any page | SQL OFFSET is slow for large datasets; shifts on insert/delete |
| Cursor-based | `?cursor=abc123&limit=20` | High performance, handles large data well, consistent | Cannot jump to arbitrary pages; sorting constraints |
| Keyset-based | `?after_id=123&limit=20` | Same performance as cursor, transparent | Sorting constraints |

### 13.2 Implementation of Each Method

```javascript
// ── Offset-based pagination ──
router.get('/api/v1/products', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const [products, total] = await Promise.all([
    db.query('SELECT * FROM products ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]),
    db.query('SELECT COUNT(*) FROM products'),
  ]);

  const totalPages = Math.ceil(total.rows[0].count / limit);

  res.json({
    data: products.rows,
    meta: { page, limit, total: parseInt(total.rows[0].count), total_pages: totalPages },
    links: {
      self: `/api/v1/products?page=${page}&limit=${limit}`,
      first: `/api/v1/products?page=1&limit=${limit}`,
      last: `/api/v1/products?page=${totalPages}&limit=${limit}`,
      ...(page > 1 && { prev: `/api/v1/products?page=${page - 1}&limit=${limit}` }),
      ...(page < totalPages && { next: `/api/v1/products?page=${page + 1}&limit=${limit}` }),
    },
  });
});

// ── Cursor-based pagination ──
router.get('/api/v1/products', async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const cursor = req.query.cursor; // Base64-encoded cursor

  let query = 'SELECT * FROM products';
  const params = [limit + 1]; // fetch one extra (to determine if there is a next page)

  if (cursor) {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    query += ' WHERE (created_at, id) < ($2, $3)';
    params.push(decoded.created_at, decoded.id);
  }

  query += ' ORDER BY created_at DESC, id DESC LIMIT $1';

  const result = await db.query(query, params);
  const hasNext = result.rows.length > limit;
  const items = hasNext ? result.rows.slice(0, limit) : result.rows;

  const nextCursor = hasNext
    ? Buffer.from(JSON.stringify({
        created_at: items[items.length - 1].created_at,
        id: items[items.length - 1].id,
      })).toString('base64url')
    : null;

  res.json({
    data: items,
    meta: {
      limit,
      has_next: hasNext,
    },
    links: {
      self: `/api/v1/products?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`,
      ...(nextCursor && {
        next: `/api/v1/products?limit=${limit}&cursor=${nextCursor}`,
      }),
    },
  });
});
```

---

## 14. Anti-Patterns

### 14.1 Anti-Pattern 1: Verb-Based URL Design

```
Anti-pattern: Verb-based URLs

  Bad examples (RPC style):
    POST /api/getUsers
    POST /api/createUser
    POST /api/deleteUser
    POST /api/updateUserEmail
    POST /api/searchProducts

  Problems:
  → New endpoints proliferate for each operation
  → HTTP method semantics are lost (everything is POST)
  → Caching does not work
  → Uniform interface breaks down

  Correct design (resource-oriented):
    GET    /api/v1/users                    User list
    POST   /api/v1/users                    Create user
    DELETE /api/v1/users/123                Delete user
    PATCH  /api/v1/users/123                Update user
    GET    /api/v1/products?q=laptop        Search products

  Exception: when verbs are acceptable
  → When expressing an "action" on a resource
  → POST /api/v1/orders/123/cancel
  → POST /api/v1/users/123/verify-email
  → These are state transitions and are difficult to model as independent resources
```

### 14.2 Anti-Pattern 2: Inconsistent Responses

```
Anti-pattern: Response structure varies across APIs

  Bad examples:
    GET /api/v1/users     → { "users": [...] }
    GET /api/v1/products  → { "data": [...], "count": 10 }
    GET /api/v1/orders    → [...] (raw array)
    GET /api/v1/users/123 → { "id": "123", "name": "..." } (no wrapper)

  Problems:
  → Clients must understand each endpoint's structure individually
  → Cannot write a shared HTTP client wrapper
  → Inconsistent placement of metadata (pagination info, etc.)

  Correct design: Unified response envelope

    // Collection
    {
      "data": [...],
      "meta": { "page": 1, "limit": 20, "total": 150 },
      "links": { "self": "...", "next": "...", "prev": "..." }
    }

    // Individual resource
    {
      "data": { "id": "123", "name": "..." },
      "links": { "self": "...", "related": "..." }
    }

    // Error
    {
      "type": "https://api.example.com/errors/...",
      "title": "...",
      "status": 422,
      "detail": "..."
    }
```

### 14.3 Anti-Pattern 3: Excessive Nesting

```
Anti-pattern: Resource hierarchy too deep

  Bad example:
    GET /api/v1/companies/1/departments/2/teams/3/members/4/tasks/5

  Problems:
  → URL becomes long and hard to read
  → Requires all parent resource IDs (unnecessarily high coupling)
  → Cache granularity becomes coarse
  → Routing complexity increases

  Correct design: Max 2 levels of nesting + query parameters

    GET /api/v1/tasks/5                          Direct access to task
    GET /api/v1/tasks?team_id=3                  Task list for a team
    GET /api/v1/tasks?member_id=4&status=active  Active tasks for a member

    // Only 1 level of nesting when parent-child relationship is strong
    GET /api/v1/orders/123/items                 Product list for an order
    GET /api/v1/users/456/notifications          Notification list for a user
```

---

## 15. Edge Case Analysis

### 15.1 Edge Case 1: Coexistence of Soft Delete and Hard Delete

Resource deletion can be either "soft delete" (logical delete) or "hard delete" (physical delete). Soft delete is recommended in most production environments, but hard delete may be required for compliance with regulations like GDPR.

```javascript
// Design for coexistence of soft delete and hard delete

// ── Standard DELETE: soft delete ──
// DELETE /api/v1/users/usr_abc123
// → Sets deleted_at; data remains
router.delete('/api/v1/users/:id', authenticate, async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw Errors.notFound('User', req.params.id);

  // If already soft-deleted
  if (user.deleted_at) {
    return res.status(410).json({
      type: 'https://api.example.com/errors/gone',
      title: 'Resource Gone',
      status: 410,
      detail: 'This resource has already been deleted.',
      deleted_at: user.deleted_at,
    });
  }

  await User.findByIdAndUpdate(req.params.id, {
    deleted_at: new Date(),
    deleted_by: req.user.id,
  });

  res.status(204).end();
});

// ── Hard delete (GDPR compliance): separate endpoint ──
// DELETE /api/v1/users/usr_abc123/permanent
// → Completely erases the data
router.delete('/api/v1/users/:id/permanent',
  authenticate,
  authorize('admin'),
  requireMfa,  // MFA required
  async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw Errors.notFound('User', req.params.id);

    // Record in audit log
    await AuditLog.create({
      action: 'PERMANENT_DELETE',
      resource_type: 'User',
      resource_id: req.params.id,
      performed_by: req.user.id,
      reason: req.body.reason, // deletion reason (required)
      timestamp: new Date(),
    });

    // Delete related data
    await Promise.all([
      Order.updateMany(
        { user_id: req.params.id },
        { $set: { user_id: null, user_name: '[deleted]' } }
      ),
      Review.deleteMany({ user_id: req.params.id }),
      User.findByIdAndDelete(req.params.id),
    ]);

    res.status(204).end();
  }
);

// ── Retrieve soft-deleted resources ──
// GET /api/v1/users?include_deleted=true (admin only)
router.get('/api/v1/users', authenticate, async (req, res) => {
  const filters = {};

  // Regular users cannot see deleted resources
  if (req.query.include_deleted === 'true' && req.user.role === 'admin') {
    // No filter (includes deleted)
  } else {
    filters.deleted_at = null;
  }

  const users = await User.find(filters);
  res.json({ data: users.map(serializeUser) });
});

// ── Restore a soft-deleted resource ──
// POST /api/v1/users/usr_abc123/restore
router.post('/api/v1/users/:id/restore',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw Errors.notFound('User', req.params.id);

    if (!user.deleted_at) {
      return res.status(409).json({
        type: 'https://api.example.com/errors/conflict',
        title: 'Resource Not Deleted',
        status: 409,
        detail: 'This resource is not in a deleted state.',
      });
    }

    await User.findByIdAndUpdate(req.params.id, {
      $unset: { deleted_at: 1, deleted_by: 1 },
    });

    const restored = await User.findById(req.params.id);
    res.status(200).json({ data: serializeUser(restored) });
  }
);
```

### 15.2 Edge Case 2: Async Operations and Polling

Long-running operations (bulk data imports, report generation, image processing, etc.) will time out if handled synchronously. Resolve this with the async pattern.

```javascript
// Async operation pattern

// ── Step 1: Start a job ──
// POST /api/v1/reports
// → Return 202 Accepted immediately and process in background
router.post('/api/v1/reports', authenticate, async (req, res) => {
  const { type, date_range, format } = req.body;

  // Validation
  const { error } = reportRequestSchema.validate(req.body);
  if (error) throw Errors.validation(error.details);

  // Create job
  const job = await Job.create({
    id: generateId('job'),
    type: 'report_generation',
    status: 'queued',
    params: { type, date_range, format },
    created_by: req.user.id,
    created_at: new Date(),
    progress: 0,
  });

  // Add to queue (actual processing is done by a worker)
  await queue.add('generate-report', {
    jobId: job.id,
    ...req.body,
  });

  res.status(202)
    .set('Location', `/api/v1/jobs/${job.id}`)
    .json({
      data: {
        job_id: job.id,
        status: 'queued',
        message: 'Report generation has been queued.',
      },
      links: {
        status: { href: `/api/v1/jobs/${job.id}`, method: 'GET' },
        cancel: { href: `/api/v1/jobs/${job.id}/cancel`, method: 'POST' },
      },
    });
});

// ── Step 2: Check job progress ──
// GET /api/v1/jobs/job_abc123
router.get('/api/v1/jobs/:id', authenticate, async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) throw Errors.notFound('Job', req.params.id);

  const response = {
    data: {
      id: job.id,
      type: job.type,
      status: job.status,   // queued | processing | completed | failed | cancelled
      progress: job.progress, // 0-100
      created_at: job.created_at,
      updated_at: job.updated_at,
    },
    links: {
      self: { href: `/api/v1/jobs/${job.id}` },
    },
  };

  switch (job.status) {
    case 'queued':
    case 'processing':
      // Instruct polling interval via Retry-After
      res.set('Retry-After', '5'); // check again in 5 seconds
      response.links.cancel = { href: `/api/v1/jobs/${job.id}/cancel`, method: 'POST' };
      break;

    case 'completed':
      response.data.result_url = job.result_url;
      response.links.result = { href: job.result_url, method: 'GET' };
      break;

    case 'failed':
      response.data.error = job.error_message;
      response.links.retry = { href: `/api/v1/reports`, method: 'POST' };
      break;
  }

  res.status(200).json(response);
});

// ── Step 3: Cancel a job ──
// POST /api/v1/jobs/job_abc123/cancel
router.post('/api/v1/jobs/:id/cancel', authenticate, async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) throw Errors.notFound('Job', req.params.id);

  if (['completed', 'failed', 'cancelled'].includes(job.status)) {
    return res.status(409).json({
      type: 'https://api.example.com/errors/conflict',
      title: 'Job Cannot Be Cancelled',
      status: 409,
      detail: `Job is already in '${job.status}' state.`,
    });
  }

  await Job.findByIdAndUpdate(req.params.id, {
    status: 'cancelled',
    cancelled_at: new Date(),
    cancelled_by: req.user.id,
  });

  res.status(200).json({
    data: { id: job.id, status: 'cancelled' },
  });
});
```

```
Async operation sequence diagram:

  Client                    API Server              Worker (Queue)
    │                          │                         │
    │  POST /api/v1/reports    │                         │
    │ ────────────────────────→│                         │
    │                          │  Create job & add to queue│
    │                          │────────────────────────→│
    │  202 Accepted            │                         │
    │  Location: /jobs/abc     │                         │
    │ ←────────────────────────│                         │
    │                          │                         │
    │  (5 seconds later)       │                         │
    │  GET /api/v1/jobs/abc    │      processing...      │
    │ ────────────────────────→│                         │
    │  200 { status:processing │                         │
    │       progress: 45 }     │                         │
    │  Retry-After: 5          │                         │
    │ ←────────────────────────│                         │
    │                          │                         │
    │  (5 seconds later)       │                         │
    │  GET /api/v1/jobs/abc    │    processing complete  │
    │ ────────────────────────→│←────────────────────────│
    │  200 { status:completed  │                         │
    │       result_url: "..." }│                         │
    │ ←────────────────────────│                         │
    │                          │                         │
    │  GET /results/abc.csv    │                         │
    │ ────────────────────────→│                         │
    │  200 (report file)        │                         │
    │ ←────────────────────────│                         │
```

---

## 16. Rate Limiting

### 16.1 Implementing Rate Limiting

```javascript
// Rate limiting using token bucket algorithm

const Redis = require('ioredis');
const redis = new Redis();

async function rateLimitMiddleware(req, res, next) {
  const identifier = req.user?.id || req.ip; // user ID if authenticated, otherwise IP
  const key = `ratelimit:${identifier}`;

  // Configuration
  const limit = req.user ? 1000 : 100;  // authenticated: 1000/min, unauthenticated: 100/min
  const window = 60; // 60 seconds

  // Count with Redis
  const multi = redis.multi();
  multi.incr(key);
  multi.ttl(key);
  const [[, count], [, ttl]] = await multi.exec();

  // Set TTL on first access
  if (ttl === -1) {
    await redis.expire(key, window);
  }

  const remaining = Math.max(0, limit - count);
  const resetTime = new Date(Date.now() + (ttl > 0 ? ttl : window) * 1000);

  // Set rate limit headers (RFC 6585 / Draft RateLimit Header)
  res.set({
    'RateLimit-Limit': limit.toString(),
    'RateLimit-Remaining': remaining.toString(),
    'RateLimit-Reset': Math.ceil(resetTime.getTime() / 1000).toString(),
    'RateLimit-Policy': `${limit};w=${window}`,
  });

  if (count > limit) {
    const retryAfter = ttl > 0 ? ttl : window;
    res.set('Retry-After', retryAfter.toString());

    return res.status(429).json({
      type: 'https://api.example.com/errors/rate-limit',
      title: 'Rate Limit Exceeded',
      status: 429,
      detail: `You have exceeded the limit of ${limit} requests per ${window} seconds.`,
      retry_after: retryAfter,
      limit,
      remaining: 0,
      reset: resetTime.toISOString(),
    });
  }

  next();
}

app.use('/api/', rateLimitMiddleware);
```

---

## 17. API Versioning

API versioning is the mechanism for evolving an API while maintaining compatibility with existing clients.

```
Versioning strategy comparison:

  ┌──────────────────┬──────────────────────────────────────────┐
  │  Method          │  Characteristics                          │
  ├──────────────────┼──────────────────────────────────────────┤
  │  URI path        │  /api/v1/users, /api/v2/users            │
  │                  │  Most common and clear                    │
  │                  │  Routing is explicit                      │
  │                  │  Cache-friendly                           │
  │                  │  (adopted by GitHub, Stripe, Google, etc.)│
  ├──────────────────┼──────────────────────────────────────────┤
  │  Query parameter │  /api/users?version=2                    │
  │                  │  Minimal impact on existing URLs          │
  │                  │  Requires default when parameter omitted  │
  │                  │  (used by some Google APIs)               │
  ├──────────────────┼──────────────────────────────────────────┤
  │  Custom header   │  X-API-Version: 2                        │
  │                  │  Clean URIs                               │
  │                  │  Harder to test directly from browser     │
  │                  │  (Azure API Management, etc.)             │
  ├──────────────────┼──────────────────────────────────────────┤
  │  Accept header   │  Accept: application/vnd.myapi.v2+json   │
  │                  │  Most faithful to REST principles         │
  │                  │  Complex to implement and use             │
  │                  │  (adopted by GitHub API v3)               │
  └──────────────────┴──────────────────────────────────────────┘

  Recommended:
  → URI path is most practical (/api/v1/...)
  → Create a new version only when there are breaking changes
  → Add minor changes in a backward-compatible way within the same version
```

```javascript
// Version routing implementation example

const express = require('express');
const app = express();

// Separate routers per version
const v1Router = require('./routes/v1');
const v2Router = require('./routes/v2');

app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);

// Redirect when version is not specified
app.use('/api/users', (req, res) => {
  // Redirect to latest stable version
  res.redirect(307, `/api/v2${req.url}`);
});

// Deprecation warning header
function deprecationWarning(sunsetDate) {
  return (req, res, next) => {
    res.set({
      'Deprecation': 'true',
      'Sunset': sunsetDate,
      'Link': '</api/v2>; rel="successor-version"',
    });
    next();
  };
}

// Add deprecation warning to all of v1
v1Router.use(deprecationWarning('2025-12-31T23:59:59Z'));
```

---

## 18. Exercises

### 18.1 Exercise 1: Basic (Resource Design)

**Task**: Design a REST API for a library management system.

Design a combination of URIs and HTTP methods that satisfies the following requirements.

```
Requirements:
  - Book management (CRUD)
  - Author management (CRUD)
  - Book checkout and return
  - Checkout history lookup
  - Book search (by title, author name, ISBN)
  - Member management (CRUD)
  - Currently checked-out list per member
  - Reservation feature

Model answer:

  # Books
  GET    /api/v1/books                        Book list
  GET    /api/v1/books?q=REST&author=fielding  Book search
  GET    /api/v1/books/:id                    Book detail
  POST   /api/v1/books                        Register book
  PUT    /api/v1/books/:id                    Update book (full)
  PATCH  /api/v1/books/:id                    Update book (partial)
  DELETE /api/v1/books/:id                    Delete book

  # Authors
  GET    /api/v1/authors                      Author list
  GET    /api/v1/authors/:id                  Author detail
  GET    /api/v1/authors/:id/books            Author's book list
  POST   /api/v1/authors                      Register author
  PUT    /api/v1/authors/:id                  Update author
  DELETE /api/v1/authors/:id                  Delete author

  # Checkouts
  POST   /api/v1/books/:id/checkout           Checkout a book
  POST   /api/v1/books/:id/return             Return a book

  # Members
  GET    /api/v1/members                      Member list
  GET    /api/v1/members/:id                  Member detail
  GET    /api/v1/members/:id/checkouts        Member's currently checked-out list
  GET    /api/v1/members/:id/history          Member's checkout history
  POST   /api/v1/members                      Register member

  # Reservations
  POST   /api/v1/books/:id/reservations       Create reservation
  DELETE /api/v1/books/:id/reservations/:rid   Cancel reservation
  GET    /api/v1/members/:id/reservations      Member's reservation list
```

### 18.2 Exercise 2: Intermediate (Error Handling and Status Codes)

**Task**: For each scenario below, write the appropriate HTTP status code and an RFC 9457-compliant error response body.

```
Scenarios:

  A) User sent invalid JSON in the request body
  B) Authentication token has expired
  C) Regular user accessed an admin-only endpoint
  D) GET request specifying a non-existent user ID
  E) Attempted to create a user whose email is already registered
  F) Concurrent update of an order occurred (optimistic lock conflict)
  G) Rate limit exceeded
  H) External payment API timed out

Model answers:

  A) 400 Bad Request
  {
    "type": "https://api.example.com/errors/malformed-request",
    "title": "Malformed Request Body",
    "status": 400,
    "detail": "The request body contains invalid JSON. Unexpected token at position 42."
  }

  B) 401 Unauthorized
  {
    "type": "https://api.example.com/errors/token-expired",
    "title": "Authentication Token Expired",
    "status": 401,
    "detail": "Your authentication token has expired. Please re-authenticate."
  }

  C) 403 Forbidden
  {
    "type": "https://api.example.com/errors/insufficient-permissions",
    "title": "Insufficient Permissions",
    "status": 403,
    "detail": "You need 'admin' role to access this resource."
  }

  D) 404 Not Found
  {
    "type": "https://api.example.com/errors/not-found",
    "title": "User Not Found",
    "status": 404,
    "detail": "User with id 'usr_xyz789' does not exist."
  }

  E) 409 Conflict
  {
    "type": "https://api.example.com/errors/duplicate",
    "title": "Resource Already Exists",
    "status": 409,
    "detail": "A user with email 'test@example.com' already exists.",
    "conflicting_field": "email"
  }

  F) 412 Precondition Failed
  {
    "type": "https://api.example.com/errors/precondition-failed",
    "title": "Precondition Failed",
    "status": 412,
    "detail": "The order has been modified by another client.",
    "current_etag": "\"v8\"",
    "your_etag": "\"v7\""
  }

  G) 429 Too Many Requests
  {
    "type": "https://api.example.com/errors/rate-limit",
    "title": "Rate Limit Exceeded",
    "status": 429,
    "detail": "Rate limit of 100 requests per minute exceeded.",
    "retry_after": 23
  }

  H) 502 Bad Gateway
  {
    "type": "https://api.example.com/errors/upstream-timeout",
    "title": "Payment Service Timeout",
    "status": 502,
    "detail": "The payment service did not respond in time. Please retry."
  }
```

### 18.3 Exercise 3: Advanced (Complete API Design)

**Task**: Design a REST API for a task management application. Satisfy all of the following requirements.

```
Requirements:
  - Task CRUD
  - Task state transitions (todo → in_progress → review → done)
  - Task assignment (setting an assignee)
  - Task management per project
  - Comment feature for tasks
  - Bulk status change for tasks
  - HATEOAS support (links based on state)
  - Optimistic locking support
  - Pagination support
  - Appropriate error responses

Items to design:
  1. Full list of endpoints (URI + Method)
  2. JSON for representative responses (with HATEOAS)
  3. State transition diagram
  4. Enumeration of error cases

Model answer (excerpt):

  # Endpoint list
  GET    /api/v1/projects                          Project list
  POST   /api/v1/projects                          Create project
  GET    /api/v1/projects/:pid                     Project detail
  GET    /api/v1/projects/:pid/tasks               Project's task list
  POST   /api/v1/projects/:pid/tasks               Create task
  GET    /api/v1/tasks/:id                         Task detail
  PUT    /api/v1/tasks/:id                         Update task
  PATCH  /api/v1/tasks/:id                         Partial update task
  DELETE /api/v1/tasks/:id                         Delete task
  POST   /api/v1/tasks/:id/transition              State transition
  PATCH  /api/v1/tasks/:id/assignee                Change assignee
  GET    /api/v1/tasks/:id/comments                Comment list
  POST   /api/v1/tasks/:id/comments                Post comment
  PATCH  /api/v1/tasks/batch                       Bulk status change

  # State transition diagram
       ┌──────┐     start      ┌─────────────┐
       │ todo │ ──────────────→│ in_progress │
       └──────┘                └─────────────┘
                                 │        │
                          submit │        │ return
                                 ▼        │
                              ┌────────┐  │
                              │ review │──┘
                              └────────┘
                                 │
                          approve│
                                 ▼
                              ┌──────┐
                              │ done │
                              └──────┘

  # Task detail response (status = "in_progress")
  {
    "data": {
      "id": "task_abc123",
      "title": "Write REST API Guide",
      "description": "...",
      "status": "in_progress",
      "assignee": {
        "id": "usr_def456",
        "name": "Taro Tanaka"
      },
      "project_id": "proj_ghi789",
      "version": 3,
      "created_at": "2025-01-10T09:00:00Z",
      "updated_at": "2025-01-12T14:30:00Z"
    },
    "links": {
      "self":       { "href": "/api/v1/tasks/task_abc123", "method": "GET" },
      "update":     { "href": "/api/v1/tasks/task_abc123", "method": "PUT" },
      "submit":     { "href": "/api/v1/tasks/task_abc123/transition",
                      "method": "POST", "body": { "to": "review" } },
      "comments":   { "href": "/api/v1/tasks/task_abc123/comments", "method": "GET" },
      "project":    { "href": "/api/v1/projects/proj_ghi789", "method": "GET" },
      "assignee":   { "href": "/api/v1/users/usr_def456", "method": "GET" }
    }
  }
```

---

## 19. FAQ

### Q1: How do I choose the appropriate HTTP status code for a RESTful API?

**A**: Choose status codes to clearly communicate "what happened." Use the following criteria to decide.

```
Success:
  200 OK           → GET/PATCH succeeded (response body present)
  201 Created      → POST succeeded (new resource created)
  204 No Content   → DELETE/PUT succeeded (no response body)

Client error:
  400 Bad Request      → Request syntax error (invalid JSON, etc.)
  401 Unauthorized     → Authentication required
  403 Forbidden        → Authenticated but insufficient permissions
  404 Not Found        → Resource does not exist
  422 Unprocessable Entity → Validation error

Server error:
  500 Internal Server Error → Server internal error
  503 Service Unavailable   → Temporarily overloaded
```

In particular, use 422 for validation errors and reserve 400 strictly for problems with the request format itself (JSON parse errors, etc.), which makes client-side error handling clearer.

### Q2: Should HATEOAS be adopted in real projects?

**A**: Full HATEOAS (Level 3) has a high implementation cost, so the following incremental approach is recommended.

```
Level 0 (minimum):
  → Avoid hardcoding URIs; make related resource paths explicit in API documentation

Level 1 (recommended):
  → Include URIs to related resources in responses
  {
    "id": "usr_123",
    "name": "Alice",
    "orders_url": "/api/v1/users/usr_123/orders"
  }

Level 2 (when state transitions matter):
  → Return only executable actions as links
  {
    "id": "ord_456",
    "status": "pending",
    "links": {
      "cancel": { "href": "/api/v1/orders/ord_456/cancel", "method": "POST" },
      "pay": { "href": "/api/v1/orders/ord_456/payment", "method": "POST" }
    }
  }

Level 3 (full HATEOAS):
  → All state transitions expressed through hypermedia
  → Adopt only for large-scale public APIs or complex workflows
```

Level 1 provides sufficient value for most projects. Level 3 should be limited to cases requiring complex state management, such as the Stripe API.

### Q3: What are the best practices for error responses in REST APIs?

**A**: Using a structure compliant with RFC 9457 (Problem Details for HTTP APIs) is the modern standard.

```javascript
// RFC 9457-compliant error response
{
  "type": "https://api.example.com/errors/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "The email field must be a valid email address.",
  "instance": "/api/v1/users",
  "errors": [
    {
      "field": "email",
      "code": "invalid_format",
      "message": "Must be a valid email address"
    }
  ],
  "trace_id": "abc123def456"  // trace ID for debugging
}
```

Required fields:
- `type`: URI indicating the error type (link to documentation)
- `title`: Short, human-readable error title
- `status`: HTTP status code
- `detail`: Specific error details
- `instance`: Request path where the error occurred

Extended fields:
- `errors`: Validation error details (array)
- `trace_id`: ID for correlating with server logs

This format enables consistent error handling on the client side.

### Q4: Should I use PUT or PATCH?

**A**: In practice, using PATCH (Merge Patch) as the default and reserving PUT only for configuration-style resources is the most practical approach.

Reasons:
- PUT requires sending all fields, which increases implementation burden on clients
- When fields are added, all clients need to be updated for PUT
- PATCH (Merge Patch) only sends changed fields, saving bandwidth
- However, PUT is appropriate for resources like configuration files that are "managed entirely as a whole"

```
Decision criteria:
  "Is this resource updated partially?"
    → Yes → PATCH (Merge Patch)
    → No (always replaced in full) → PUT
```

### Q5: How should I design deeply nested resources?

**A**: Keep nesting to a maximum of 2 levels, and use query parameters for filtering when 3 or more levels are needed.

```
Bad:  GET /companies/1/departments/2/teams/3/members
Good: GET /members?team_id=3
      GET /teams/3/members  (1 level of nesting is acceptable)
```

If a resource is accessed independently, a top-level endpoint should be provided. For example, "members" belonging to a team should also be directly accessible via `/members/:id`.

### Q6: Which authentication method should I adopt?

**A**: For machine-to-machine (M2M) communication, API keys or OAuth2 Client Credentials are recommended. For user-facing interactions, OAuth2 Authorization Code + PKCE is recommended.

```
Recommended auth methods by use case:

  ┌──────────────────┬────────────────────────────────┐
  │  Use case        │  Recommended method             │
  ├──────────────────┼────────────────────────────────┤
  │  SPA             │  OAuth2 Authorization Code     │
  │                  │  + PKCE + Secure Cookie        │
  ├──────────────────┼────────────────────────────────┤
  │  Mobile app      │  OAuth2 Authorization Code     │
  │                  │  + PKCE                        │
  ├──────────────────┼────────────────────────────────┤
  │  Server-to-server│  OAuth2 Client Credentials     │
  │                  │  or API Key + Secret           │
  ├──────────────────┼────────────────────────────────┤
  │  Admin interface │  OAuth2 + MFA                  │
  ├──────────────────┼────────────────────────────────┤
  │  Webhook         │  HMAC signature verification   │
  └──────────────────┴────────────────────────────────┘

  Not recommended:
  → Basic auth (password is sent with every request)
  → Storing JWT in localStorage (XSS vulnerability)
  → API key alone (when used for user-facing operations)
```

### Q7: Should response field names use camelCase or snake_case?

**A**: For JSON APIs, snake_case (`snake_case`) is recommended. Although camelCase is the JavaScript property naming convention, snake_case prevails at the API level for the following reasons:

- Google JSON Style Guide recommends snake_case
- Consistent with conventions in many backend languages: Ruby, Python, Go, etc.
- Major APIs like GitHub, Stripe, and Twilio use snake_case
- That said, consistency within the organization is most important

### Q8: How should empty responses be returned?

**A**: Return an empty collection as 200 OK with an empty array. Return 404 if a resource is not found. Return 204 No Content with no body on successful DELETE.

```javascript
// Empty collection: 200 + empty array (not 404)
// GET /api/v1/users?status=vip (when no VIP users exist)
{
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 0, "total_pages": 0 }
}

// Resource not found: 404
// GET /api/v1/users/nonexistent
{
  "type": "https://api.example.com/errors/not-found",
  "title": "User Not Found",
  "status": 404,
  "detail": "User with id 'nonexistent' does not exist."
}

// DELETE success: 204 No Content (no body)
// DELETE /api/v1/users/usr_abc123
// → 204 (empty response)
```

---

## 20. Summary

| Concept | Key Points |
|---------|-----------|
| Resource design | Nouns, plural, kebab-case; max 2 levels of nesting |
| HTTP methods | GET=retrieve, POST=create, PUT=full replace, PATCH=partial update, DELETE=delete |
| Status codes | 201=created, 204=success no body, 422=validation, 429=rate limit |
| Error responses | RFC 9457-compliant: type, title, status, detail, instance |
| HATEOAS | Dynamic link changes based on state; aim for at least Level 1 |
| Idempotency | Make POST idempotent with Idempotency-Key; Stripe approach is industry standard |
| PATCH | Merge Patch (simple) vs JSON Patch (feature-rich) |
| Bulk operations | Allow partial failures; return individual results with 207 Multi-Status |
| Optimistic locking | Detect concurrent updates with ETag / If-Match; notify conflicts with 412 |
| Pagination | Cursor-based for large data; offset-based for UI-facing |
| Versioning | URI path approach (/api/v1/...) is most practical |
| Rate limiting | Notify remaining count with RateLimit-* headers; 429 for limit exceeded |

**Key Points**:

1. **Resource-oriented design**: Express URIs with "nouns," not "verbs," and indicate operations via HTTP methods. `POST /users` is OK; `POST /createUser` is not.
2. **Standardized error responses**: Adopting RFC 9457-compliant Problem Details format makes client-side error handling consistent and improves debugging efficiency.
3. **Guaranteeing idempotency**: Introduce Idempotency-Key for critical operations (payments, resource creation) to prevent duplicate execution caused by network retries.

---

## FAQ

### Q1: Should I use JSON Merge Patch or JSON Patch for PATCH requests?
JSON Merge Patch (RFC 7396) is simple and intuitive, and is suitable for general field updates. You only need to send the partial JSON object directly, with a low learning curve. On the other hand, JSON Patch (RFC 6902) supports more complex operations such as array manipulation (adding, removing, moving elements) and renaming fields. JSON Merge Patch is sufficient in most cases; consider JSON Patch only when partial array updates are frequently needed.

### Q2: Is transaction guarantee necessary for bulk operation APIs?
The design that allows partial failures (207 Multi-Status) is generally recommended. An all-or-nothing transaction guarantee becomes a performance bottleneck with large data volumes and is complex to implement in distributed systems. However, in domains where consistency is mandatory — such as financial transactions — transaction guarantees may be necessary. In those cases, it is important to set an upper limit on batch size (e.g., 100 items) to ensure predictable processing times.

### Q3: How should null and undefined (omitted fields) be distinguished in API responses?
The most important thing is to define a clear rule and document it. The recommended approach: define null as meaning "the value is explicitly empty," and a missing field as meaning "this resource does not have this attribute" or "it was not specified in the request." This distinction is especially important in PATCH operations: sending null means "clear the value," while omitting the field means "do not change it" — this is the common pattern.

## Summary

In this guide you learned:

- Resource-oriented design based on the 6 REST constraints, and URI naming with nouns, plural forms, and kebab-case
- Correct usage of HTTP methods and status codes, and RFC 9457-compliant error response design
- Expressing state transitions with HATEOAS, and guaranteeing idempotency using Idempotency-Key
- Implementation patterns for partial updates (PATCH), bulk operations, and optimistic locking (ETag/If-Match)
- Pagination design, rate limiting, versioning, and other API design elements essential for production operations

---

## Next Guides to Read

- [GraphQL Fundamentals](01-graphql-fundamentals.md) -- query language, schemas, resolvers
- API Versioning Strategies -- details on versioning strategies
- API Authentication and Authorization -- implementation patterns for auth

---

## References

1. Fielding, R. "Architectural Styles and the Design of Network-based Software Architectures." Ph.D. Dissertation, University of California, Irvine, 2000. https://www.ics.uci.edu/~fielding/pubs/dissertation/top.htm
2. RFC 9457. "Problem Details for HTTP APIs." IETF, 2023. https://datatracker.ietf.org/doc/html/rfc9457
3. RFC 7396. "JSON Merge Patch." IETF, 2014. https://datatracker.ietf.org/doc/html/rfc7396
4. RFC 6902. "JavaScript Object Notation (JSON) Patch." IETF, 2013. https://datatracker.ietf.org/doc/html/rfc6902
5. RFC 9110. "HTTP Semantics." IETF, 2022. https://datatracker.ietf.org/doc/html/rfc9110
6. Google. "Google JSON Style Guide." https://google.github.io/styleguide/jsoncstyleguide.xml
7. Stripe. "Stripe API Reference - Idempotent Requests." https://docs.stripe.com/api/idempotent_requests

# REST API Design

> REST is an architectural principle for Web APIs. By designing resource-oriented URIs, using appropriate HTTP methods, and leveraging status codes, you can create intuitive, maintainable APIs. It is the architectural style proposed by Roy Fielding in his 2000 doctoral dissertation — a systematic formulation of the fundamental techniques that made the Web successful.

## Prerequisites

- Understanding of the JSON format — the most commonly used data format in REST APIs

REST is a design principle that takes full advantage of the characteristics of the HTTP protocol. Understanding the semantics of HTTP methods, the appropriate use of status codes, and header-based metadata management allows you to accurately grasp the design intent of RESTful APIs.

---

## What You Will Learn

- [ ] Understand the 6 REST constraints and the Richardson Maturity Model
- [ ] Grasp resource-oriented URI design and choose appropriate HTTP methods
- [ ] Learn practical API design patterns (pagination, filtering, versioning)
- [ ] Understand the concept of HATEOAS and when to apply it
- [ ] Learn how to document APIs with the OpenAPI specification
- [ ] Understand REST API implementation patterns with Express/FastAPI

---

## 1. REST Principles

### 1.1 What is REST?

REST (Representational State Transfer) is an architectural style proposed by Roy Fielding in his 2000 doctoral dissertation. Fielding, one of the principal designers of the HTTP protocol, analyzed why the Web was successful and systematized its design principles into what became REST.

REST is not a protocol or a framework — it is defined as a "set of constraints." Systems that satisfy these constraints are called "RESTful."

```
REST (Representational State Transfer):
  → Proposed in Roy Fielding's 2000 doctoral dissertation
  → An architectural style that leverages existing Web technologies (HTTP, URI)
  → Not a protocol but a "set of constraints"

6 Constraints:
  +-------------------------------------------------------+
  |              REST Architectural Constraints            |
  +-------------------------------------------------------+
  |                                                       |
  |  ① Client-Server Separation                          |
  |     → Separate UI from data processing               |
  |     → Each can evolve independently                  |
  |     → Separation of Concerns                         |
  |                                                       |
  |  ② Stateless                                         |
  |     → Each request is self-contained                 |
  |     → Server holds no session state                  |
  |     → Improved scalability                           |
  |     → Load balancing per request is possible         |
  |                                                       |
  |  ③ Cacheable                                         |
  |     → Responses explicitly declare cacheability      |
  |     → Cache-Control, ETag, Last-Modified             |
  |     → Improved network efficiency and latency        |
  |                                                       |
  |  ④ Uniform Interface                                 |
  |     → Resource identification (URI)                  |
  |     → Resource manipulation through representations  |
  |       (JSON/XML)                                     |
  |     → Self-descriptive messages (Content-Type, etc.) |
  |     → HATEOAS (hypermedia-driven)                    |
  |                                                       |
  |  ⑤ Layered System                                    |
  |     → Load balancers, proxies, gateways can be added |
  |     → Client is unaware of intermediate layers       |
  |     → Centralized management of security policies    |
  |                                                       |
  |  ⑥ Code on Demand (optional)                         |
  |     → Server can send executable code to client      |
  |     → JavaScript, etc.                               |
  |     → The only optional constraint                   |
  +-------------------------------------------------------+
```

### 1.2 Richardson Maturity Model

The maturity model proposed by Leonard Richardson evaluates how RESTful an API is across four levels.

```
Richardson Maturity Model:

  Level 3 ──── HATEOAS (Hypermedia controls)          ← True REST
     ▲         Responses include links for next actions
     │
  Level 2 ──── HTTP Methods + Status Codes             ← Most APIs are here
     ▲         GET/POST/PUT/DELETE + 200/201/404, etc.
     │
  Level 1 ──── Introduction of Resources
     ▲         Resources identified by individual URIs
     │          /users/123, /orders/456
     │
  Level 0 ──── Single Endpoint (POX: Plain Old XML)
               All operations POSTed to one URI
               SOAP-style approach

  ┌─────────┬──────────────────────────┬───────────────────┐
  │ Level   │ Characteristics          │ Example           │
  ├─────────┼──────────────────────────┼───────────────────┤
  │ Level 0 │ Single endpoint          │ POST /api         │
  │         │ Everything is POST       │ body: {action:    │
  │         │                          │  "getUser"}       │
  ├─────────┼──────────────────────────┼───────────────────┤
  │ Level 1 │ Separate URI per resource│ POST /api/users   │
  │         │ Still POST only          │ POST /api/orders  │
  ├─────────┼──────────────────────────┼───────────────────┤
  │ Level 2 │ HTTP methods used        │ GET /api/users    │
  │         │ Status codes appropriate │ POST /api/users   │
  │         │                          │ → 201 Created     │
  ├─────────┼──────────────────────────┼───────────────────┤
  │ Level 3 │ HATEOAS introduced       │ Response includes │
  │         │ Self-discoverable API    │ links             │
  └─────────┴──────────────────────────┴───────────────────┘

  In practice, reaching Level 2 is sufficient for most use cases.
  Level 3 is ideal, but the client-side implementation cost is high.
```

### 1.3 REST vs. Other API Styles

```
┌──────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ Aspect   │ REST         │ GraphQL      │ gRPC         │ SOAP         │
├──────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Protocol │ HTTP         │ HTTP         │ HTTP/2       │ HTTP/SMTP/etc│
│ Format   │ JSON (main)  │ JSON         │ Protocol     │ XML          │
│          │              │              │ Buffers      │              │
│ Schema   │ OpenAPI      │ Schema       │ .proto       │ WSDL         │
│ Over-    │ Can occur    │ No           │ No           │ Can occur    │
│ fetching │              │              │              │              │
│ Under-   │ Can occur    │ No           │ No           │ Can occur    │
│ fetching │              │              │              │              │
│ Realtime │ WebSocket    │ Subscription │ Streaming    │ None         │
│ Learning │ Low          │ Medium       │ High         │ High         │
│ cost     │              │              │              │              │
│ Tooling  │ Abundant     │ Growing      │ Limited      │ Mature       │
│ Caching  │ HTTP native  │ Custom impl  │ Custom impl  │ Difficult    │
│ Use case │ Public APIs  │ Mobile       │ Microservice │ Enterprise   │
│          │ Web general  │ Complex UI   │ internal     │              │
└──────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

REST's greatest strength is "leveraging standard Web technologies as-is." Existing Web infrastructure — HTTP caching, CDNs, proxies, and load balancers — all work natively. For public APIs and APIs intended for external developers, REST is the most widely adopted choice.

---

## 2. URI Design

### 2.1 Resource-Oriented URIs

The core of a REST API is the concept of "resources." All data is treated as a resource and uniquely identified by a URI.

```
Resource-Oriented URI Design:

  ┌─────────────────────────────────────────────┐
  │       Example Resource Hierarchy Design      │
  ├─────────────────────────────────────────────┤
  │                                             │
  │  /api/v1                                    │
  │    ├── /users                   Collection  │
  │    │   ├── /users/{id}          Document    │
  │    │   ├── /users/{id}/profile  Sub-resource│
  │    │   ├── /users/{id}/orders   Related     │
  │    │   │                        collection  │
  │    │   └── /users/{id}/orders/{oid}         │
  │    ├── /products                            │
  │    │   ├── /products/{id}                   │
  │    │   ├── /products/{id}/reviews           │
  │    │   └── /products/{id}/variants          │
  │    ├── /orders                              │
  │    │   ├── /orders/{id}                     │
  │    │   ├── /orders/{id}/items               │
  │    │   └── /orders/{id}/payments            │
  │    └── /categories                          │
  │        ├── /categories/{id}                 │
  │        └── /categories/{id}/products        │
  │                                             │
  └─────────────────────────────────────────────┘

  Resource types:
  ┌─────────────┬─────────────────────┬──────────────────┐
  │ Type        │ Description         │ Example          │
  ├─────────────┼─────────────────────┼──────────────────┤
  │ Collection  │ Set of resources    │ /users           │
  │ Document    │ Individual resource │ /users/123       │
  │ Sub-        │ Collection owned by │ /users/123/orders│
  │ collection  │ a parent            │                  │
  │ Controller  │ Procedural ops      │ /users/123/ban   │
  │             │ (exception)         │                  │
  └─────────────┴─────────────────────┴──────────────────┘
```

### 2.2 Mapping HTTP Methods to CRUD Operations

```
HTTP Methods and Resource Operation Mapping:

  ✓ Good design:
  GET    /api/v1/users              — Retrieve user list
  GET    /api/v1/users/123          — Retrieve user detail
  POST   /api/v1/users              — Create user
  PUT    /api/v1/users/123          — Replace entire user
  PATCH  /api/v1/users/123          — Partial update of user
  DELETE /api/v1/users/123          — Delete user
  GET    /api/v1/users/123/orders   — List orders for a user
  GET    /api/v1/users/123/orders/456 — Order detail

  ✗ Bad design:
  GET    /api/getUsers              — Do not use verbs
  POST   /api/createUser            — Let the method carry the role
  GET    /api/user/delete/123       — Do not cause side effects with GET
  GET    /api/Users                 — Do not use uppercase
  POST   /api/users/123/update      — Do not put verbs in the URI

  Method safety and idempotency:
  ┌─────────┬────────┬─────────────┬───────────────────────┐
  │ Method  │ Safe   │ Idempotent  │ Purpose               │
  ├─────────┼────────┼─────────────┼───────────────────────┤
  │ GET     │ Yes    │ Yes         │ Retrieve resource     │
  │ HEAD    │ Yes    │ Yes         │ Retrieve headers only │
  │ OPTIONS │ Yes    │ Yes         │ Discover methods      │
  │ POST    │ No     │ No          │ Create resource       │
  │ PUT     │ No     │ Yes         │ Replace entire resource│
  │ PATCH   │ No     │ Conditional │ Partial update        │
  │ DELETE  │ No     │ Yes         │ Delete resource       │
  └─────────┴────────┴─────────────┴───────────────────────┘

  Safe: The request does not change server state
  Idempotent: The same request can be executed any number of times with the same result
  Conditional: Implementation-dependent (should be implemented idempotently)
```

### 2.3 Naming Conventions

```
URI Naming Conventions:

  → Nouns, plural: /users, /orders, /products
  → Kebab-case: /user-profiles (snake_case is also acceptable)
  → Lowercase only: /users (not /Users)
  → No trailing slash: /users (not /users/)
  → No file extensions: /users (not /users.json)

  Nested vs. Flat:
    Nested:  GET /users/123/orders/456
    Flat:    GET /orders/456

    → Limit nesting to 2 levels (/resource/{id}/sub-resource)
    → Flatten anything deeper than 3 levels
    → If a sub-resource has a unique ID, flat is preferred

  Special operations (actions):
    → Operations that don't fit standard CRUD: design as controller resources
    → POST /api/v1/users/123/activate      (activate account)
    → POST /api/v1/orders/456/cancel       (cancel order)
    → POST /api/v1/reports/generate        (generate report)
    → These may exceptionally use POST + verb
```

---

## 3. Query Parameters

### 3.1 Pagination

```
Pagination for list endpoints:

  ① Offset-based:
  GET /api/users?page=2&per_page=20
  GET /api/users?offset=20&limit=20

  ② Cursor-based (recommended):
  GET /api/users?cursor=eyJpZCI6MTIzfQ==&limit=20
  → Response includes the next cursor

  ③ Keyset-based:
  GET /api/users?after_id=123&limit=20
  → Based on the value of a specific column

Detailed comparison of pagination methods:
  ┌────────────┬─────────────────┬─────────────────────────┬───────────┐
  │ Method     │ Pros            │ Cons                    │ Best for  │
  ├────────────┼─────────────────┼─────────────────────────┼───────────┤
  │ offset     │ Easy to         │ Performance degrades    │ Admin     │
  │            │ implement       │ with large data         │ panels    │
  │            │ Page number     │ Duplicates/gaps when    │ Small data│
  │            │ navigation      │ data is added           │           │
  ├────────────┼─────────────────┼─────────────────────────┼───────────┤
  │ cursor     │ Consistent      │ Cannot jump to arbitrary│ Infinite  │
  │            │ results         │ page                    │ scroll    │
  │            │ Fast and stable │ Cursor value is opaque  │           │
  ├────────────┼─────────────────┼─────────────────────────┼───────────┤
  │ keyset     │ Fastest         │ Slightly complex to     │ Large     │
  │            │ Index-friendly  │ implement               │ datasets  │
  │            │                 │ Requires sort key       │           │
  └────────────┴─────────────────┴─────────────────────────┴───────────┘
```

### 3.2 Sorting, Filtering, and Search

```
  Sorting:
  GET /api/users?sort=created_at&order=desc
  GET /api/users?sort=-created_at               (- prefix = descending)
  GET /api/users?sort=last_name,-created_at      (multiple keys)

  Filtering:
  GET /api/users?status=active&role=admin
  GET /api/users?created_after=2024-01-01
  GET /api/users?age[gte]=18&age[lte]=65         (range)
  GET /api/users?status[in]=active,pending        (multiple values)

  Field selection (Sparse Fieldsets):
  GET /api/users?fields=id,name,email
  GET /api/users?fields[users]=id,name&fields[company]=name
  → Reduces response size for improved performance

  Search:
  GET /api/users?q=taro
  GET /api/users/search?q=taro&fields=name,email

  Combined example:
  GET /api/users?status=active&sort=-created_at&page=1&per_page=20&fields=id,name
```

---

## 4. Response Design

### 4.1 Success Responses

```
List (GET /api/users → 200 OK):
{
  "data": [
    {
      "id": "1",
      "type": "user",
      "attributes": {
        "name": "Taro Yamada",
        "email": "taro@example.com",
        "created_at": "2024-01-15T10:30:00Z"
      }
    },
    {
      "id": "2",
      "type": "user",
      "attributes": {
        "name": "Hanako Suzuki",
        "email": "hanako@example.com",
        "created_at": "2024-02-20T14:00:00Z"
      }
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "per_page": 20,
    "total_pages": 8
  },
  "links": {
    "self": "/api/v1/users?page=1",
    "next": "/api/v1/users?page=2",
    "last": "/api/v1/users?page=8"
  }
}

Detail (GET /api/users/1 → 200 OK):
{
  "data": {
    "id": "1",
    "type": "user",
    "attributes": {
      "name": "Taro Yamada",
      "email": "taro@example.com",
      "role": "admin",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-06-01T09:15:00Z"
    },
    "relationships": {
      "orders": {
        "links": {
          "related": "/api/v1/users/1/orders"
        }
      },
      "profile": {
        "links": {
          "related": "/api/v1/users/1/profile"
        }
      }
    }
  }
}

Create success (POST /api/users → 201 Created):
HTTP/1.1 201 Created
Location: /api/v1/users/3
Content-Type: application/json

{
  "data": {
    "id": "3",
    "type": "user",
    "attributes": {
      "name": "Jiro Tanaka",
      "email": "jiro@example.com",
      "created_at": "2024-07-01T12:00:00Z"
    }
  }
}

Delete success (DELETE /api/users/3 → 204 No Content):
HTTP/1.1 204 No Content
(No body)
```

### 4.2 Error Responses

```
RFC 7807 Problem Details format:

Validation error (422 Unprocessable Entity):
{
  "type": "https://api.example.com/errors/validation",
  "title": "Validation Error",
  "status": 422,
  "detail": "The request body contains invalid fields.",
  "instance": "/api/v1/users",
  "errors": [
    {
      "field": "email",
      "code": "invalid_format",
      "message": "Invalid email format"
    },
    {
      "field": "age",
      "code": "out_of_range",
      "message": "Must be 18 or older"
    }
  ]
}

Authentication error (401 Unauthorized):
{
  "type": "https://api.example.com/errors/unauthorized",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The access token is expired or invalid."
}

Authorization error (403 Forbidden):
{
  "type": "https://api.example.com/errors/forbidden",
  "title": "Forbidden",
  "status": 403,
  "detail": "You do not have permission to access this resource."
}

Resource not found (404 Not Found):
{
  "type": "https://api.example.com/errors/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "User with ID '999' was not found."
}

Conflict error (409 Conflict):
{
  "type": "https://api.example.com/errors/conflict",
  "title": "Conflict",
  "status": 409,
  "detail": "A user with this email already exists."
}

Key status code usage guide:
  ┌──────┬─────────────────────────┬──────────────────────────┐
  │ Code │ Name                    │ When to use              │
  ├──────┼─────────────────────────┼──────────────────────────┤
  │ 200  │ OK                      │ Fetch/update success     │
  │ 201  │ Created                 │ Create success           │
  │ 204  │ No Content              │ Delete success (no body) │
  │ 301  │ Moved Permanently       │ Resource permanently moved│
  │ 304  │ Not Modified            │ Cache is valid           │
  │ 400  │ Bad Request             │ Request syntax error     │
  │ 401  │ Unauthorized            │ Authentication required  │
  │ 403  │ Forbidden               │ Insufficient permissions │
  │ 404  │ Not Found               │ Resource does not exist  │
  │ 405  │ Method Not Allowed      │ Method not permitted     │
  │ 409  │ Conflict                │ Resource conflict        │
  │ 422  │ Unprocessable Entity    │ Validation error         │
  │ 429  │ Too Many Requests       │ Rate limit exceeded      │
  │ 500  │ Internal Server Error   │ Server-side error        │
  │ 503  │ Service Unavailable     │ Service temporarily down │
  └──────┴─────────────────────────┴──────────────────────────┘
```

---

## 5. Versioning

### 5.1 Versioning Strategies

```
API Versioning Strategies:

  ① URI versioning (most common):
     GET /api/v1/users
     GET /api/v2/users
     → Pros: Clear, easy to cache, simple routing
     → Cons: URI changes break existing links
     → Adopted by: GitHub, Twitter, Stripe

  ② Header versioning:
     GET /api/users
     Accept: application/vnd.example.v2+json
     → Pros: Clean URI, content negotiation
     → Cons: Hard to test, cannot verify in browser directly
     → Adopted by: GitHub (in combination)

  ③ Query parameter versioning:
     GET /api/users?version=2
     → Pros: Easy to implement, easy to switch
     → Cons: Increases cache key space, looks optional
     → Adopted by: Google, Amazon (some services)

  ④ Custom header:
     GET /api/users
     X-API-Version: 2
     → Pros: More explicit than Accept header
     → Cons: Non-standard

  Recommendation: URI versioning (/api/v1/) is most widely understood
```

### 5.2 Criteria for Version Upgrades

```
Breaking changes (major version bump required):
  → Removing a field
  → Changing a field's type (string → number, etc.)
  → Adding a required parameter
  → Changing response structure
  → Removing or changing the path of an endpoint
  → Changing the meaning of a status code

Non-breaking changes (no version bump needed):
  → Adding optional fields
  → Adding new endpoints
  → Adding optional query parameters
  → Changing error message wording
  → Performance improvements

Version management best practices:
  → Support old versions for at least 12 months
  → Notify deprecation via headers:
     Deprecation: true
     Sunset: Sat, 01 Jan 2026 00:00:00 GMT
     Link: </api/v2/users>; rel="successor-version"
  → Provide a migration guide when releasing a new version
  → Publish a public API changelog
```

---

## 6. HATEOAS

### 6.1 What is HATEOAS?

HATEOAS (Hypermedia As The Engine Of Application State) is a concept within the "Uniform Interface" REST constraint. By including links to the next possible actions in API responses, the API becomes "self-discoverable."

```
HATEOAS concept diagram:

  Traditional API (no links):
  ┌─────────────┐                    ┌─────────────┐
  │   Client    │───GET /users/1──→  │   Server    │
  │             │←── { id: 1,    ───│             │
  │  Must know  │     name: "Taro"} │             │
  │  URIs in    │                    │             │
  │  advance    │───GET /users/1/ ─→ │             │
  │             │   orders           │             │
  └─────────────┘                    └─────────────┘

  HATEOAS-enabled API (with links):
  ┌─────────────┐                    ┌─────────────┐
  │   Client    │───GET /users/1──→  │   Server    │
  │             │←── { id: 1,    ───│             │
  │  Just       │     name: "Taro", │             │
  │  follow     │     _links: {     │             │
  │  the links  │       orders:     │             │
  │             │       "/users/1/  │             │
  │             │        orders"}}  │             │
  └─────────────┘                    └─────────────┘
```

### 6.2 HATEOAS Response Examples

```json
{
  "data": {
    "id": "order-456",
    "status": "pending",
    "total": 5800,
    "currency": "JPY",
    "created_at": "2024-07-01T12:00:00Z"
  },
  "_links": {
    "self": {
      "href": "/api/v1/orders/456",
      "method": "GET"
    },
    "cancel": {
      "href": "/api/v1/orders/456/cancel",
      "method": "POST",
      "title": "Cancel this order"
    },
    "payment": {
      "href": "/api/v1/orders/456/payments",
      "method": "POST",
      "title": "Submit payment"
    },
    "items": {
      "href": "/api/v1/orders/456/items",
      "method": "GET",
      "title": "View order items"
    },
    "customer": {
      "href": "/api/v1/users/123",
      "method": "GET",
      "title": "View customer details"
    }
  }
}
```

When the order transitions to "shipped," the `cancel` link disappears and a `track` link appears instead. This allows the client to dynamically discover the operations available based on the current state.

```json
{
  "data": {
    "id": "order-456",
    "status": "shipped",
    "total": 5800,
    "tracking_number": "JP123456789"
  },
  "_links": {
    "self": {
      "href": "/api/v1/orders/456"
    },
    "track": {
      "href": "/api/v1/orders/456/tracking",
      "method": "GET",
      "title": "Track shipment"
    },
    "return": {
      "href": "/api/v1/orders/456/returns",
      "method": "POST",
      "title": "Request return"
    }
  }
}
```

---

## 7. Authentication and Rate Limiting

### 7.1 Authentication Methods

```
Common authentication methods:

  ① Bearer Token (JWT):
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
  → Stateless, scalable
  → Token revocation management is a challenge

  ② API Key:
  X-API-Key: your-api-key-here
  (or as query parameter: ?api_key=xxx)
  → Simple, suitable for server-to-server communication
  → Risk of key leakage

  ③ OAuth 2.0:
  → Delegating authorization to third-party apps
  → Authorization Code Flow is recommended
  → Granular permissions via scopes

  ④ Basic Authentication:
  Authorization: Basic base64(username:password)
  → For development/testing only
  → HTTPS is mandatory in production

  → Public APIs commonly use OAuth 2.0 + API Key
  → Internal APIs benefit from JWT Bearer Token for efficiency
```

### 7.2 Rate Limiting

```
Notify limits via response headers:

  X-RateLimit-Limit: 100       — Limit (per minute, etc.)
  X-RateLimit-Remaining: 42    — Remaining count
  X-RateLimit-Reset: 1640000000 — Reset timestamp (Unix seconds)

  When limit is exceeded:
  HTTP/1.1 429 Too Many Requests
  Retry-After: 60
  Content-Type: application/json

  {
    "type": "https://api.example.com/errors/rate-limit",
    "title": "Rate Limit Exceeded",
    "status": 429,
    "detail": "You have exceeded 100 requests per minute.",
    "retry_after": 60
  }

  Typical rate limit tiers:
  ┌────────────────────┬──────────────────┐
  │ Tier               │ Rate Limit       │
  ├────────────────────┼──────────────────┤
  │ Unauthenticated    │ 20 req/min       │
  │ Authenticated (free)│ 100 req/min     │
  │ Authenticated (paid)│ 1,000 req/min   │
  │ Enterprise         │ 10,000 req/min   │
  │ Write operations   │ 1/5 of reads     │
  └────────────────────┴──────────────────┘

  Rate limiting algorithms:
  → Token Bucket: burst-friendly, most common
  → Sliding Window: higher precision, slightly more compute
  → Fixed Window: simplest to implement, 2x spike at window boundaries
```

---

## 8. Implementation Examples

### 8.1 REST API with Express.js (Node.js)

```javascript
// app.js - Express REST API basic setup
const express = require('express');
const app = express();

app.use(express.json());

// ─── In-memory data store (for demo) ───
let users = [
  { id: '1', name: 'Taro Yamada', email: 'taro@example.com', role: 'admin',
    created_at: '2024-01-15T10:30:00Z' },
  { id: '2', name: 'Hanako Suzuki', email: 'hanako@example.com', role: 'user',
    created_at: '2024-02-20T14:00:00Z' },
];
let nextId = 3;

// ─── Middleware: rate limit headers ───
const rateLimitMiddleware = (req, res, next) => {
  res.set({
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Remaining': '99',
    'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 60),
  });
  next();
};
app.use('/api', rateLimitMiddleware);

// ─── List users ───
// GET /api/v1/users?page=1&per_page=20&sort=-created_at&status=active
app.get('/api/v1/users', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const perPage = Math.min(parseInt(req.query.per_page) || 20, 100);
  const offset = (page - 1) * perPage;

  // Filtering
  let filtered = [...users];
  if (req.query.role) {
    filtered = filtered.filter(u => u.role === req.query.role);
  }

  // Sorting
  if (req.query.sort) {
    const desc = req.query.sort.startsWith('-');
    const field = desc ? req.query.sort.slice(1) : req.query.sort;
    filtered.sort((a, b) => {
      if (a[field] < b[field]) return desc ? 1 : -1;
      if (a[field] > b[field]) return desc ? -1 : 1;
      return 0;
    });
  }

  const total = filtered.length;
  const paged = filtered.slice(offset, offset + perPage);

  res.json({
    data: paged,
    meta: {
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
    },
    links: {
      self: `/api/v1/users?page=${page}&per_page=${perPage}`,
      ...(page > 1 && {
        prev: `/api/v1/users?page=${page - 1}&per_page=${perPage}`,
      }),
      ...(offset + perPage < total && {
        next: `/api/v1/users?page=${page + 1}&per_page=${perPage}`,
      }),
    },
  });
});

// ─── Get user detail ───
// GET /api/v1/users/:id
app.get('/api/v1/users/:id', (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({
      type: 'https://api.example.com/errors/not-found',
      title: 'Not Found',
      status: 404,
      detail: `User with ID '${req.params.id}' was not found.`,
    });
  }

  res.json({
    data: user,
    _links: {
      self: { href: `/api/v1/users/${user.id}` },
      orders: { href: `/api/v1/users/${user.id}/orders` },
      update: { href: `/api/v1/users/${user.id}`, method: 'PUT' },
      delete: { href: `/api/v1/users/${user.id}`, method: 'DELETE' },
    },
  });
});

// ─── Create user ───
// POST /api/v1/users
app.post('/api/v1/users', (req, res) => {
  const { name, email, role } = req.body;

  // Validation
  const errors = [];
  if (!name) errors.push({ field: 'name', message: 'Name is required' });
  if (!email) errors.push({ field: 'email', message: 'Email is required' });
  if (email && users.some(u => u.email === email)) {
    errors.push({ field: 'email', message: 'Email already exists' });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      type: 'https://api.example.com/errors/validation',
      title: 'Validation Error',
      status: 422,
      detail: 'The request body contains invalid fields.',
      errors,
    });
  }

  const newUser = {
    id: String(nextId++),
    name,
    email,
    role: role || 'user',
    created_at: new Date().toISOString(),
  };
  users.push(newUser);

  res.status(201)
    .location(`/api/v1/users/${newUser.id}`)
    .json({ data: newUser });
});

// ─── Update user (full replacement) ───
// PUT /api/v1/users/:id
app.put('/api/v1/users/:id', (req, res) => {
  const index = users.findIndex(u => u.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({
      type: 'https://api.example.com/errors/not-found',
      title: 'Not Found',
      status: 404,
      detail: `User with ID '${req.params.id}' was not found.`,
    });
  }

  const { name, email, role } = req.body;
  users[index] = {
    ...users[index],
    name,
    email,
    role,
    updated_at: new Date().toISOString(),
  };

  res.json({ data: users[index] });
});

// ─── Partial update of user ───
// PATCH /api/v1/users/:id
app.patch('/api/v1/users/:id', (req, res) => {
  const index = users.findIndex(u => u.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({
      type: 'https://api.example.com/errors/not-found',
      title: 'Not Found',
      status: 404,
      detail: `User with ID '${req.params.id}' was not found.`,
    });
  }

  users[index] = {
    ...users[index],
    ...req.body,
    id: users[index].id, // ID is immutable
    updated_at: new Date().toISOString(),
  };

  res.json({ data: users[index] });
});

// ─── Delete user ───
// DELETE /api/v1/users/:id
app.delete('/api/v1/users/:id', (req, res) => {
  const index = users.findIndex(u => u.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({
      type: 'https://api.example.com/errors/not-found',
      title: 'Not Found',
      status: 404,
      detail: `User with ID '${req.params.id}' was not found.`,
    });
  }

  users.splice(index, 1);
  res.status(204).send();
});

app.listen(3000, () => {
  console.log('REST API server running on port 3000');
});
```

### 8.2 REST API with FastAPI (Python)

```python
# main.py - FastAPI REST API basic setup
from fastapi import FastAPI, HTTPException, Query, Response
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from uuid import uuid4

app = FastAPI(
    title="User Management API",
    version="1.0.0",
    description="RESTful API for user management",
)

# ─── Model definitions ───
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    role: str = "user"

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    created_at: str
    updated_at: Optional[str] = None

class PaginationMeta(BaseModel):
    total: int
    page: int
    per_page: int
    total_pages: int

class UserListResponse(BaseModel):
    data: list[UserResponse]
    meta: PaginationMeta

class ErrorDetail(BaseModel):
    field: str
    message: str

class ErrorResponse(BaseModel):
    type: str
    title: str
    status: int
    detail: str
    errors: Optional[list[ErrorDetail]] = None

# ─── In-memory store ───
users_db: dict[str, dict] = {}

# ─── Endpoints ───
@app.get("/api/v1/users", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    role: Optional[str] = None,
    sort: Optional[str] = None,
):
    """List users: supports pagination, filtering, and sorting"""
    all_users = list(users_db.values())

    # Filtering
    if role:
        all_users = [u for u in all_users if u["role"] == role]

    # Sorting
    if sort:
        desc = sort.startswith("-")
        key = sort.lstrip("-")
        all_users.sort(key=lambda u: u.get(key, ""), reverse=desc)

    total = len(all_users)
    offset = (page - 1) * per_page
    paged = all_users[offset:offset + per_page]

    return UserListResponse(
        data=[UserResponse(**u) for u in paged],
        meta=PaginationMeta(
            total=total,
            page=page,
            per_page=per_page,
            total_pages=(total + per_page - 1) // per_page or 1,
        ),
    )

@app.get("/api/v1/users/{user_id}", response_model=dict)
async def get_user(user_id: str):
    """Get user detail"""
    if user_id not in users_db:
        raise HTTPException(
            status_code=404,
            detail={
                "type": "https://api.example.com/errors/not-found",
                "title": "Not Found",
                "status": 404,
                "detail": f"User with ID '{user_id}' was not found.",
            },
        )
    return {
        "data": users_db[user_id],
        "_links": {
            "self": {"href": f"/api/v1/users/{user_id}"},
            "orders": {"href": f"/api/v1/users/{user_id}/orders"},
        },
    }

@app.post("/api/v1/users", status_code=201)
async def create_user(user: UserCreate, response: Response):
    """Create user"""
    # Check for duplicate email
    for existing in users_db.values():
        if existing["email"] == user.email:
            raise HTTPException(
                status_code=409,
                detail={
                    "type": "https://api.example.com/errors/conflict",
                    "title": "Conflict",
                    "status": 409,
                    "detail": "A user with this email already exists.",
                },
            )

    user_id = str(uuid4())[:8]
    new_user = {
        "id": user_id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
    users_db[user_id] = new_user
    response.headers["Location"] = f"/api/v1/users/{user_id}"
    return {"data": new_user}

@app.patch("/api/v1/users/{user_id}")
async def update_user(user_id: str, updates: UserUpdate):
    """Partial update of user"""
    if user_id not in users_db:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = updates.model_dump(exclude_unset=True)
    users_db[user_id].update(update_data)
    users_db[user_id]["updated_at"] = datetime.utcnow().isoformat() + "Z"
    return {"data": users_db[user_id]}

@app.delete("/api/v1/users/{user_id}", status_code=204)
async def delete_user(user_id: str):
    """Delete user"""
    if user_id not in users_db:
        raise HTTPException(status_code=404, detail="User not found")
    del users_db[user_id]
```

### 8.3 API Operations with curl

```bash
# ─── List users ───
curl -s -X GET "http://localhost:3000/api/v1/users?page=1&per_page=10" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." | jq .

# ─── Get user detail ───
curl -s -X GET "http://localhost:3000/api/v1/users/1" \
  -H "Accept: application/json" | jq .

# ─── Create user ───
curl -s -X POST "http://localhost:3000/api/v1/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -d '{
    "name": "Saburo Kato",
    "email": "saburo@example.com",
    "role": "user"
  }' | jq .
# → HTTP 201 Created
# → Location: /api/v1/users/3

# ─── Partial update of user ───
curl -s -X PATCH "http://localhost:3000/api/v1/users/1" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -d '{
    "role": "moderator"
  }' | jq .
# → HTTP 200 OK

# ─── Delete user ───
curl -s -X DELETE "http://localhost:3000/api/v1/users/3" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -v
# → HTTP 204 No Content

# ─── Filtering + sorting + pagination ───
curl -s -X GET \
  "http://localhost:3000/api/v1/users?role=admin&sort=-created_at&page=1&per_page=5" \
  -H "Accept: application/json" | jq .

# ─── Check rate limit headers ───
curl -s -D - "http://localhost:3000/api/v1/users" \
  -H "Accept: application/json" -o /dev/null 2>&1 | grep -i "x-ratelimit"
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 99
# X-RateLimit-Reset: 1720000060
```

### 8.4 OpenAPI (Swagger) Specification Example

```yaml
# openapi.yaml - OpenAPI 3.0 specification
openapi: "3.0.3"
info:
  title: User Management API
  description: RESTful API for user CRUD operations
  version: "1.0.0"
  contact:
    name: API Support
    email: support@example.com
  license:
    name: MIT

servers:
  - url: https://api.example.com/api/v1
    description: Production
  - url: http://localhost:3000/api/v1
    description: Development

paths:
  /users:
    get:
      summary: List users
      operationId: listUsers
      tags:
        - Users
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
            minimum: 1
        - name: per_page
          in: query
          schema:
            type: integer
            default: 20
            minimum: 1
            maximum: 100
        - name: role
          in: query
          schema:
            type: string
            enum: [admin, user, moderator]
        - name: sort
          in: query
          description: "Sort key (- prefix for descending)"
          schema:
            type: string
            example: "-created_at"
      responses:
        "200":
          description: User list
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/UserListResponse"
        "401":
          $ref: "#/components/responses/Unauthorized"

    post:
      summary: Create user
      operationId: createUser
      tags:
        - Users
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/UserCreate"
      responses:
        "201":
          description: Create success
          headers:
            Location:
              schema:
                type: string
              description: URI of the created resource
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/UserSingleResponse"
        "409":
          $ref: "#/components/responses/Conflict"
        "422":
          $ref: "#/components/responses/ValidationError"

  /users/{userId}:
    get:
      summary: Get user detail
      operationId: getUser
      tags:
        - Users
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: User detail
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/UserSingleResponse"
        "404":
          $ref: "#/components/responses/NotFound"

    patch:
      summary: Partial update of user
      operationId: updateUser
      tags:
        - Users
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/UserUpdate"
      responses:
        "200":
          description: Update success
        "404":
          $ref: "#/components/responses/NotFound"

    delete:
      summary: Delete user
      operationId: deleteUser
      tags:
        - Users
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
      responses:
        "204":
          description: Delete success
        "404":
          $ref: "#/components/responses/NotFound"

components:
  schemas:
    UserCreate:
      type: object
      required: [name, email]
      properties:
        name:
          type: string
          example: "Taro Yamada"
        email:
          type: string
          format: email
          example: "taro@example.com"
        role:
          type: string
          enum: [admin, user, moderator]
          default: user

    UserUpdate:
      type: object
      properties:
        name:
          type: string
        email:
          type: string
          format: email
        role:
          type: string
          enum: [admin, user, moderator]

    User:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        email:
          type: string
        role:
          type: string
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    UserListResponse:
      type: object
      properties:
        data:
          type: array
          items:
            $ref: "#/components/schemas/User"
        meta:
          type: object
          properties:
            total:
              type: integer
            page:
              type: integer
            per_page:
              type: integer
            total_pages:
              type: integer

    UserSingleResponse:
      type: object
      properties:
        data:
          $ref: "#/components/schemas/User"

    ProblemDetail:
      type: object
      properties:
        type:
          type: string
        title:
          type: string
        status:
          type: integer
        detail:
          type: string

  responses:
    Unauthorized:
      description: Authentication error
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ProblemDetail"

    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ProblemDetail"

    Conflict:
      description: Conflict error
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ProblemDetail"

    ValidationError:
      description: Validation error
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ProblemDetail"

  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

security:
  - BearerAuth: []
```

---

## 9. Anti-Patterns

### 9.1 Anti-Pattern 1: Verb-Based Endpoint Design

The most common anti-pattern in REST APIs is including verbs in URIs. This is a holdover from RPC-style design and ignores the semantics of HTTP methods.

```
Anti-pattern: Verb-based URIs

  ✗ Bad design (RPC style):
  POST   /api/getUsers               ← Should use GET
  POST   /api/createUser              ← Consolidate to POST /users
  POST   /api/updateUser              ← PUT/PATCH /users/:id
  POST   /api/deleteUser              ← DELETE /users/:id
  GET    /api/getUserOrders?userId=1  ← GET /users/1/orders
  POST   /api/searchUsers             ← GET /users?q=xxx

  Problems:
  → Endpoint count explodes (resources × operations)
  → HTTP method semantics are lost (everything is POST)
  → Caching is ineffective (POST is not cached by default)
  → Uniform interface is broken
  → New developers struggle to understand the API structure

  ✓ Correct design (resource-oriented):
  GET    /api/v1/users                ← Retrieve collection
  POST   /api/v1/users                ← Create resource
  GET    /api/v1/users/1              ← Retrieve individual resource
  PUT    /api/v1/users/1              ← Full replacement
  PATCH  /api/v1/users/1              ← Partial update
  DELETE /api/v1/users/1              ← Delete
  GET    /api/v1/users/1/orders       ← Retrieve related resource
  GET    /api/v1/users?q=taro         ← Search

  Exception (controller resources):
  → Business operations that don't fit CRUD may include verbs
  POST   /api/v1/users/1/activate     ← Activate account
  POST   /api/v1/orders/5/cancel      ← Cancel order
  POST   /api/v1/carts/checkout       ← Checkout cart
  → These are exceptionally allowed as "controller resources"
```

### 9.2 Anti-Pattern 2: Inconsistent Response Structure

```
Anti-pattern: Different response formats per endpoint

  ✗ List: returns a raw array
  GET /api/users →
  [
    { "id": 1, "name": "Taro" },
    { "id": 2, "name": "Hanako" }
  ]
  → Cannot include metadata (pagination info, etc.)
  → Cannot accommodate future extensions

  ✗ Detail: returns a raw object
  GET /api/users/1 →
  { "id": 1, "name": "Taro" }
  → Without an envelope, the format differs from the list response

  ✗ Errors: different format per endpoint
  POST /api/users →
  { "error": "validation failed" }          ← string
  DELETE /api/users/1 →
  { "errors": [{ "code": 404 }] }          ← array of objects
  PATCH /api/users/1 →
  { "message": "not found", "code": 404 }  ← different format again

  ✓ Correct design: consistent envelope

  Success responses (always use the data key):
  List:   { "data": [...], "meta": {...}, "links": {...} }
  Detail: { "data": {...}, "_links": {...} }
  Create: { "data": {...} } + Location header
  Delete: 204 No Content (no body)

  Error responses (always RFC 7807 format):
  {
    "type": "https://...",
    "title": "Error Title",
    "status": 4xx,
    "detail": "Human-readable description",
    "errors": [...]  // only for validation errors
  }
```

### 9.3 Anti-Pattern 3: Excessive Nesting

```
Anti-pattern: Deeply nested URIs

  ✗ Bad design:
  GET /api/v1/companies/1/departments/5/teams/3/members/42/tasks/99

  Problems:
  → URI is long and hard to read
  → All ancestor IDs are required (redundant)
  → Routing implementation becomes complex
  → If task has a unique ID, direct access is possible

  ✓ Improvements:
  GET /api/v1/tasks/99                  ← Direct access by unique ID
  GET /api/v1/teams/3/members           ← Nest only necessary relationships
  GET /api/v1/members/42/tasks          ← Keep to 2 levels

  Guidelines:
  → Limit nesting to 2 levels: /resource/{id}/sub-resource
  → Split anything deeper into flat endpoints
  → Provide flat access when sub-resources have unique IDs
  → Providing both access paths is a best practice
```

---

## 10. Edge Case Analysis

### 10.1 Edge Case 1: Concurrent Update Conflicts (Optimistic Locking)

When multiple clients attempt to update the same resource simultaneously, a "lost update problem" occurs where the later client overwrites the earlier client's changes.

```
Problem scenario:

  Time T1: Client A does GET /users/1 → { name: "Taro", role: "user" }
  Time T2: Client B does GET /users/1 → { name: "Taro", role: "user" }
  Time T3: Client A does PATCH /users/1 → { name: "TARO" }
  Time T4: Client B does PATCH /users/1 → { role: "admin" }

  → Client B assumed name="Taro" when updating, but
    it was changed to name="TARO" at T3 without B's knowledge
  → With PUT (full replacement), B's update would erase A's change entirely

Solution: Optimistic locking with ETag

  ┌──────────────┐                         ┌──────────────┐
  │   Client     │                         │   Server     │
  └──────┬───────┘                         └──────┬───────┘
         │  GET /users/1                          │
         │ ──────────────────────────────────────→ │
         │  200 OK                                │
         │  ETag: "abc123"                        │
         │  { name: "Taro" }                      │
         │ ←────────────────────────────────────── │
         │                                        │
         │  PUT /users/1                          │
         │  If-Match: "abc123"                    │
         │  { name: "TARO" }                      │
         │ ──────────────────────────────────────→ │
         │                                        │
         │  ── ETag matches → update succeeds ──  │
         │  200 OK                                │
         │  ETag: "def456"                        │
         │ ←────────────────────────────────────── │
         │                                        │
         │  PUT /users/1                          │
         │  If-Match: "abc123"  ← stale ETag      │
         │  { role: "admin" }                     │
         │ ──────────────────────────────────────→ │
         │                                        │
         │  ── ETag mismatch → update rejected ── │
         │  412 Precondition Failed               │
         │ ←────────────────────────────────────── │
         │                                        │

  Implementation notes:
  → Include ETag header in GET responses
  → Require If-Match header on update requests
  → Return 412 Precondition Failed when ETag does not match
  → Client re-fetches the latest data and retries
```

### 10.2 Edge Case 2: Bulk Operations on Large Data Sets

Standard REST APIs assume operations on individual resources, but sometimes you need to create, update, or delete hundreds of resources at once.

```
Problem: creating 100 users at once

  ✗ Individual requests:
  POST /api/v1/users  → { name: "User 1" }
  POST /api/v1/users  → { name: "User 2" }
  ...repeated 100 times
  → High network overhead
  → Difficult to control as a transaction

Solution 1: Bulk endpoint
  POST /api/v1/users/bulk
  Content-Type: application/json

  {
    "operations": [
      { "method": "create", "body": { "name": "User 1", "email": "u1@example.com" } },
      { "method": "create", "body": { "name": "User 2", "email": "u2@example.com" } },
      { "method": "create", "body": { "name": "User 3", "email": "u3@example.com" } }
    ]
  }

  Response (207 Multi-Status):
  {
    "results": [
      { "status": 201, "data": { "id": "10", "name": "User 1" } },
      { "status": 201, "data": { "id": "11", "name": "User 2" } },
      { "status": 409, "error": { "detail": "Email already exists" } }
    ],
    "summary": {
      "total": 3,
      "succeeded": 2,
      "failed": 1
    }
  }

Solution 2: Asynchronous job
  POST /api/v1/import-jobs
  Content-Type: application/json

  {
    "type": "user_import",
    "data": [...]
  }

  Response:
  HTTP/1.1 202 Accepted
  Location: /api/v1/import-jobs/job-789

  {
    "data": {
      "id": "job-789",
      "status": "processing",
      "progress": 0,
      "_links": {
        "self": { "href": "/api/v1/import-jobs/job-789" },
        "cancel": { "href": "/api/v1/import-jobs/job-789/cancel", "method": "POST" }
      }
    }
  }

  → Asynchronous processing is appropriate for large data sets
  → Notify completion via polling or webhook
  → Allow progress to be checked via GET
```

### 10.3 Edge Case 3: Soft Delete and Resource Restoration

```
Problem: DELETE /users/1 permanently deletes the resource with no way to restore it

Solution: Soft delete pattern

  DELETE /api/v1/users/1
  → Internally sets a deleted_at timestamp
  → Resource no longer appears in regular GET requests

  Restore:
  POST /api/v1/users/1/restore
  → Sets deleted_at back to null

  Fetch deleted resources:
  GET /api/v1/users?include_deleted=true
  GET /api/v1/users/1?include_deleted=true

  Hard delete (purge):
  DELETE /api/v1/users/1/permanently
  → Physically deletes (admin only)

  Response example:
  GET /api/v1/users/1 → 404 Not Found (soft-deleted)
  GET /api/v1/users/1?include_deleted=true → 200 OK
  {
    "data": {
      "id": "1",
      "name": "Taro",
      "deleted_at": "2024-07-15T10:00:00Z",
      "_links": {
        "restore": { "href": "/api/v1/users/1/restore", "method": "POST" }
      }
    }
  }
```

---

## 11. Full Request/Response Flow

```
REST API Request/Response Flow:

  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
  │  Client  │     │API Gateway│    │   App    │     │  Data    │
  │(Browser/ │     │/LB       │     │  Server  │     │  Store   │
  │ Mobile)  │     │          │     │          │     │(DB/Cache)│
  └────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
       │                │                │                │
       │ 1. HTTP request│                │                │
       │───────────────→│                │                │
       │                │                │                │
       │                │ 2. Auth check  │                │
       │                │  (JWT verify)  │                │
       │                │                │                │
       │                │ 3. Rate limit  │                │
       │                │  check         │                │
       │                │                │                │
       │                │ 4. Routing     │                │
       │                │───────────────→│                │
       │                │                │                │
       │                │                │ 5. Validation  │
       │                │                │                │
       │                │                │ 6. Business    │
       │                │                │    logic       │
       │                │                │                │
       │                │                │ 7. DB query    │
       │                │                │───────────────→│
       │                │                │                │
       │                │                │ 8. Fetch data  │
       │                │                │←───────────────│
       │                │                │                │
       │                │                │ 9. Serialize   │
       │                │                │    response    │
       │                │                │                │
       │                │ 10. Response   │                │
       │                │←───────────────│                │
       │                │                │                │
       │                │ 11. Add headers│                │
       │                │  (RateLimit,   │                │
       │                │   etc.)        │                │
       │                │                │                │
       │ 12. HTTP response               │                │
       │←───────────────│                │                │
       │                │                │                │
```

---

## 12. Exercises

### Exercise 1 (Basic): Design a Bookstore API

Design a list of REST API endpoints that satisfy the following requirements.

```
Requirements:
  - CRUD operations for Books
  - CRUD operations for Authors
  - Books belong to Categories
  - Book reviews can be posted and retrieved
  - Books can be searched (by title, author name, ISBN)
  - Supports pagination, sorting, and filtering

Example answer:
  # Books
  GET    /api/v1/books                       List books (?page=1&per_page=20)
  GET    /api/v1/books/:id                   Book detail
  POST   /api/v1/books                       Create book
  PUT    /api/v1/books/:id                   Replace entire book
  PATCH  /api/v1/books/:id                   Partial update of book
  DELETE /api/v1/books/:id                   Delete book
  GET    /api/v1/books?q=REST&sort=-rating   Search books

  # Authors
  GET    /api/v1/authors                     List authors
  GET    /api/v1/authors/:id                 Author detail
  POST   /api/v1/authors                     Create author
  PATCH  /api/v1/authors/:id                 Update author
  DELETE /api/v1/authors/:id                 Delete author
  GET    /api/v1/authors/:id/books           Books by author

  # Categories
  GET    /api/v1/categories                  List categories
  GET    /api/v1/categories/:id              Category detail
  GET    /api/v1/categories/:id/books        Books in category

  # Reviews
  GET    /api/v1/books/:id/reviews           List reviews for a book
  POST   /api/v1/books/:id/reviews           Post a review
  PATCH  /api/v1/reviews/:id                 Edit review
  DELETE /api/v1/reviews/:id                 Delete review

  Design notes:
  → Book reviews are nested as a sub-resource (POST, GET)
  → Editing/deleting reviews uses flat access (unique ID exists)
  → Author's book list is a sub-resource (max 2 levels)
```

### Exercise 2 (Intermediate): Unified Error Handling Implementation

Design RFC 7807-compliant error responses for the following scenarios.

```
Scenarios:
  1. Accessing a non-existent user ID
  2. Invalid email format + missing name field
  3. Registering a user with an already-existing email address
  4. Expired authentication token
  5. A regular user accessing an admin-only endpoint

Example answers:

  1. 404 Not Found:
  {
    "type": "https://api.example.com/errors/not-found",
    "title": "Resource Not Found",
    "status": 404,
    "detail": "User with ID '999' does not exist.",
    "instance": "/api/v1/users/999"
  }

  2. 422 Unprocessable Entity (multiple field validation):
  {
    "type": "https://api.example.com/errors/validation",
    "title": "Validation Error",
    "status": 422,
    "detail": "Request body contains 2 validation errors.",
    "instance": "/api/v1/users",
    "errors": [
      {
        "field": "email",
        "code": "invalid_format",
        "message": "Email must be a valid email address.",
        "rejected_value": "not-an-email"
      },
      {
        "field": "name",
        "code": "required",
        "message": "Name is required and cannot be empty."
      }
    ]
  }

  3. 409 Conflict:
  {
    "type": "https://api.example.com/errors/conflict",
    "title": "Resource Conflict",
    "status": 409,
    "detail": "A user with email 'taro@example.com' already exists.",
    "instance": "/api/v1/users"
  }

  4. 401 Unauthorized:
  {
    "type": "https://api.example.com/errors/token-expired",
    "title": "Token Expired",
    "status": 401,
    "detail": "The provided access token has expired. Please refresh your token."
  }

  5. 403 Forbidden:
  {
    "type": "https://api.example.com/errors/insufficient-permissions",
    "title": "Forbidden",
    "status": 403,
    "detail": "This action requires 'admin' role. Your current role is 'user'.",
    "instance": "/api/v1/admin/users"
  }
```

### Exercise 3 (Advanced): Design an Order Management API with HATEOAS

Design an order management API for an e-commerce site. The order has the following state transitions. Design the API so that the HATEOAS links in the response change dynamically based on the current order state.

```
Order state transitions:

  ┌────────┐  confirm  ┌──────────┐  ship   ┌─────────┐  deliver ┌──────────┐
  │ pending │ ────────→ │ confirmed │ ──────→ │ shipped │ ───────→ │ delivered│
  └────┬───┘           └─────┬────┘          └────┬────┘          └──────────┘
       │                     │                    │
       │ cancel              │ cancel             │ return
       ▼                     ▼                    ▼
  ┌──────────┐         ┌──────────┐         ┌──────────┐
  │ cancelled│         │ cancelled│         │ returned │
  └──────────┘         └──────────┘         └──────────┘

Example answers:

  GET /api/v1/orders/123 → status: "pending"
  {
    "data": {
      "id": "123",
      "status": "pending",
      "total": 9800,
      "items": [...]
    },
    "_links": {
      "self":    { "href": "/api/v1/orders/123" },
      "confirm": { "href": "/api/v1/orders/123/confirm", "method": "POST" },
      "cancel":  { "href": "/api/v1/orders/123/cancel",  "method": "POST" },
      "items":   { "href": "/api/v1/orders/123/items" }
    }
  }

  GET /api/v1/orders/123 → status: "shipped"
  {
    "data": {
      "id": "123",
      "status": "shipped",
      "tracking_number": "JP987654321",
      "shipped_at": "2024-07-10T09:00:00Z"
    },
    "_links": {
      "self":   { "href": "/api/v1/orders/123" },
      "track":  { "href": "/api/v1/orders/123/tracking" },
      "return": { "href": "/api/v1/orders/123/returns", "method": "POST" }
    }
  }
  → "confirm" and "cancel" are gone; "track" and "return" appear
  → Client determines available actions from the presence of _links

  GET /api/v1/orders/123 → status: "delivered"
  {
    "data": {
      "id": "123",
      "status": "delivered",
      "delivered_at": "2024-07-12T14:30:00Z"
    },
    "_links": {
      "self":   { "href": "/api/v1/orders/123" },
      "return": { "href": "/api/v1/orders/123/returns", "method": "POST" },
      "review": { "href": "/api/v1/orders/123/reviews", "method": "POST" }
    }
  }
  → After delivery, "return" and "review" are available

  GET /api/v1/orders/123 → status: "cancelled"
  {
    "data": {
      "id": "123",
      "status": "cancelled",
      "cancelled_at": "2024-07-05T16:00:00Z",
      "cancellation_reason": "Customer requested"
    },
    "_links": {
      "self": { "href": "/api/v1/orders/123" }
    }
  }
  → Cancelled orders have no action links beyond self
```

---

## 13. API Design Checklist

```
REST API Design Checklist:

  URI Design:
  [ ] Are resources named as nouns in plural form?
  [ ] Are URIs lowercase and kebab-case?
  [ ] Is nesting limited to 2 levels?
  [ ] Is there a version prefix? (/api/v1/)
  [ ] Are trailing slashes consistent?

  HTTP Methods:
  [ ] Is GET safe (no side effects)?
  [ ] Are PUT/DELETE idempotent?
  [ ] Is POST used only where appropriate?
  [ ] Is PATCH supported for partial updates?

  Responses:
  [ ] Are success/error response structures consistent?
  [ ] Are appropriate HTTP status codes used?
  [ ] Do list responses include metadata (total, page, etc.)?
  [ ] Is the Location header returned on successful creation?
  [ ] Are error responses RFC 7807-compliant?

  Pagination & Filtering:
  [ ] Is the pagination method decided?
  [ ] Is there a maximum value for per_page?
  [ ] Is the sort parameter format consistent?

  Security:
  [ ] Is the authentication method decided?
  [ ] Is rate limiting configured?
  [ ] Are CORS settings appropriate?
  [ ] Is input validation performed?

  Operations:
  [ ] Is an OpenAPI/Swagger specification created?
  [ ] Is the API versioning strategy decided?
  [ ] Is there a deprecation policy?
  [ ] Are logging and monitoring designed?
```

---

## Summary

```
Key Points in REST API Design:

  ┌─────────────────┬─────────────────────────────────────┐
  │ Concept         │ Key Points                          │
  ├─────────────────┼─────────────────────────────────────┤
  │ REST Principles │ 6 constraints: Stateless, Uniform   │
  │                 │ IF, Cacheable, Layered, C/S,        │
  │                 │ Code on Demand                      │
  ├─────────────────┼─────────────────────────────────────┤
  │ Maturity Model  │ Level 2 (HTTP usage) is the         │
  │                 │ practical target                    │
  │                 │ Level 3 (HATEOAS) is the ideal      │
  ├─────────────────┼─────────────────────────────────────┤
  │ URI Design      │ Nouns, plural, max 2 levels,        │
  │                 │ kebab-case                          │
  ├─────────────────┼─────────────────────────────────────┤
  │ Pagination      │ Cursor-based is fast and stable     │
  │                 │ Offset-based suits small datasets   │
  ├─────────────────┼─────────────────────────────────────┤
  │ Versioning      │ URI-based (/api/v1/) is most common │
  │                 │ Version bump only for breaking      │
  │                 │ changes                             │
  ├─────────────────┼─────────────────────────────────────┤
  │ Errors          │ RFC 7807 Problem Details format     │
  │                 │ Consistent structure is critical    │
  ├─────────────────┼─────────────────────────────────────┤
  │ HATEOAS         │ Include links in responses for      │
  │                 │ self-discoverability                │
  │                 │ Links change dynamically with state │
  ├─────────────────┼─────────────────────────────────────┤
  │ Authentication  │ Public API: OAuth 2.0 + API Key     │
  │                 │ Internal API: JWT Bearer Token      │
  ├─────────────────┼─────────────────────────────────────┤
  │ Rate Limiting   │ Notify via headers, reject with 429 │
  │                 │ Token Bucket is common              │
  └─────────────────┴─────────────────────────────────────┘
```

---

## FAQ

### Q1: Should I use PUT or PATCH?

Use PUT for "full replacement" of a resource, and PATCH for "partial update." With PUT, the request body must include all fields of the resource — any fields not included will be reset to their default values. With PATCH, only the fields you want to change need to be included.

In typical web applications, updating only a subset of form fields is common, making PATCH more practical. When offering PUT, it is recommended to also provide PATCH.

```
PUT /api/v1/users/1
→ All fields required in body:
  { "name": "Taro", "email": "taro@example.com", "role": "admin" }
→ If email is omitted, email may be reset to null/default

PATCH /api/v1/users/1
→ Only the changed portion is needed:
  { "role": "admin" }
→ name and email remain unchanged
```

### Q2: Should IDs be UUIDs or auto-incremented integers?

```
┌────────────┬─────────────────┬─────────────────────┐
│ Method     │ Pros            │ Cons                │
├────────────┼─────────────────┼─────────────────────┤
│ Auto-      │ Short and       │ Easily guessable    │
│ increment  │ readable        │ Record count        │
│            │ Sort order clear│ is inferrable       │
│            │ Index efficient │ Collisions in       │
│            │                 │ distributed systems │
├────────────┼─────────────────┼─────────────────────┤
│ UUID v4    │ Unpredictable   │ 36 characters long  │
│            │ Safe for        │ Index efficiency    │
│            │ distributed     │ lower               │
│            │ systems         │ Sort order undefined│
├────────────┼─────────────────┼─────────────────────┤
│ ULID       │ Sortable        │ 26 characters       │
│            │ Unpredictable   │ Less common than    │
│            │ Safe for        │ UUID                │
│            │ distributed     │                     │
│            │ systems         │                     │
├────────────┼─────────────────┼─────────────────────┤
│ nanoid     │ Short,          │ Collision probability│
│            │ customizable    │ must be calculated  │
│            │ URL-safe        │ Not standardized    │
└────────────┴─────────────────┴─────────────────────┘

Recommendation:
→ Public API: UUID v4 or ULID (safe from a security standpoint)
→ Internal API: Auto-increment is acceptable (watch for ID enumeration)
→ When short URLs are needed: nanoid (21 characters by default)
```

### Q3: How should I check for parent resource existence when creating nested resources?

When creating nested resources (e.g., POST /users/123/orders), there are several patterns to handle the case where the parent resource (user 123) does not exist.

```
Pattern 1: Return 404 Not Found (recommended)
  POST /api/v1/users/999/orders
  → 404 Not Found: "User with ID '999' was not found."
  → Refuse to create the child if the parent does not exist

Pattern 2: Return 422 Unprocessable Entity
  POST /api/v1/orders
  { "user_id": "999", ... }
  → 422: "Referenced user '999' does not exist."
  → Handle as a validation error on a flat endpoint

Recommendation:
→ For nested URLs: return 404 (part of the path does not exist)
→ For flat URLs with ID in body: return 422 (validation error)
→ In either case, provide a clear error message
```

### Q4: What format should dates and times use?

```
Recommended: ISO 8601 (RFC 3339) format

  UTC:      "2024-07-15T10:30:00Z"
  Offset:   "2024-07-15T19:30:00+09:00"

  → Server stores and returns in UTC (Z notation)
  → Client converts to local timezone
  → Unix Timestamp is not recommended as it is not human-readable
     (though it is conventionally used in rate limit headers, etc.)
```

---

## Further Reading


---

## References

1. Fielding, R. "Architectural Styles and the Design of Network-based Software Architectures." University of California, Irvine, 2000. -- The original REST dissertation, written by one of the principal designers of the HTTP protocol.
2. RFC 7807. "Problem Details for HTTP APIs." Nottingham, M., Wilde, E., IETF, 2016. -- The standard format for API error responses. See also its successor RFC 9457 (2023).
3. Richardson, L., Amundsen, M., Ruby, S. "RESTful Web APIs." O'Reilly Media, 2013. -- A practical guide by the originator of the Richardson Maturity Model, including detailed coverage of HATEOAS.
4. OpenAPI Specification 3.1.0. OpenAPI Initiative, 2021. https://spec.openapis.org/oas/v3.1.0 -- The standard for describing REST API specifications. Can generate interactive documentation via Swagger UI.
5. Masse, M. "REST API Design Rulebook." O'Reilly Media, 2011. -- A rule compendium covering URI design, HTTP method usage, and error handling.

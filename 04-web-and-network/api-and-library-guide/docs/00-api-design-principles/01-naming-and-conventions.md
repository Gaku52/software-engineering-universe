# Naming Conventions and Standards

> API naming directly impacts developer experience (DX). Establish consistent endpoint naming, response structure, error design, and conventions for dates, IDs, and enumerations to design APIs that are easy to use. Unified naming increases API predictability and forms the foundation of an API that can be used intuitively without reading the documentation.

## What You Will Learn

- [ ] Understand naming conventions for endpoints and fields
- [ ] Grasp the response envelope design
- [ ] Learn consistent error responses
- [ ] Master header conventions and metadata standardization
- [ ] Establish unified conventions for dates, IDs, and enumerations
- [ ] Define naming guidelines for real-world projects
- [ ] Understand naming patterns for internationalization
- [ ] Learn how to implement naming conventions in OpenAPI specifications

## Prerequisites

- Basic concepts of API First design → See: [API First Design](./00-api-first-design.md)
- Understanding of HTTP methods (GET/POST/PUT/DELETE) → See: HTTP Basics
- Basic principles of REST API → See: REST API

---

## 1. Endpoint Naming

### 1.1 Basic Rules

```
Basic rules:
  ✓ Nouns, plural form:    /users, /orders, /products
  ✓ kebab-case:            /user-profiles, /order-items
  ✓ Lowercase only
  ✓ No trailing slash:     /users (✗ /users/)
  ✗ No verbs:              /getUsers, /createOrder
  ✗ No uppercase:          /Users, /OrderItems
  ✗ No underscores:        /user_profiles
  ✗ No file extensions:    /users.json

  Resource hierarchy:
  /users/{userId}
  /users/{userId}/orders
  /users/{userId}/orders/{orderId}
  → Up to 2 levels (3+ levels should be flattened)

  Collection operations:
  GET    /users           — List
  POST   /users           — Create
  GET    /users/{id}      — Get detail
  PUT    /users/{id}      — Full update
  PATCH  /users/{id}      — Partial update
  DELETE /users/{id}      — Delete

  Actions (operations that don't fit REST):
  POST   /users/{id}/activate       — Activate user
  POST   /users/{id}/reset-password — Reset password
  POST   /orders/{id}/cancel        — Cancel order
  → Express as sub-resources when a verb is required
```

### 1.2 Resource Name Selection Guidelines

```
Criteria for selecting resource names:

  1. Use business domain terminology
  ─────────────────────────────
  ✓ /invoices
  ✗ /payment-documents
  ✓ /shipments
  ✗ /delivery-records
  ✓ /subscriptions
  ✗ /recurring-payments

  2. Avoid abbreviations
  ─────────────────────────────
  ✓ /organizations
  ✗ /orgs
  ✓ /configurations
  ✗ /configs
  ✓ /applications
  ✗ /apps
  Exception: industry-standard abbreviations are acceptable
  ✓ /urls, /ids, /apis

  3. Business terms over technical terms
  ─────────────────────────────
  ✓ /users/{id}/preferences
  ✗ /users/{id}/settings-records
  ✓ /notifications
  ✗ /push-message-queue-items

  4. Avoid ambiguous names
  ─────────────────────────────
  ✗ /data, /items, /things, /resources, /objects
  ✓ Use specific resource names

  5. Singular vs plural rules
  ─────────────────────────────
  Collections: always plural
  ✓ /users, /orders, /products

  Singleton resources: singular
  ✓ /users/{id}/profile    (one per user)
  ✓ /settings              (one system configuration)
  ✓ /users/{id}/cart       (one cart per user)
```

### 1.3 Practical Hierarchy Design Patterns

```
Pattern 1: Simple CRUD
─────────────────────────
  GET    /products
  POST   /products
  GET    /products/{productId}
  PUT    /products/{productId}
  PATCH  /products/{productId}
  DELETE /products/{productId}

Pattern 2: Parent-child relationship
─────────────────────────
  GET    /users/{userId}/orders              — User's order list
  POST   /users/{userId}/orders              — Create user's order
  GET    /users/{userId}/orders/{orderId}    — Specific order detail

  ※ Also provide an alias for direct order access:
  GET    /orders/{orderId}                   — Order detail (direct access)

Pattern 3: Avoiding deep nesting
─────────────────────────
  ✗ Avoid (3+ levels):
  GET /users/{userId}/orders/{orderId}/items/{itemId}/reviews

  ✓ Flatten:
  GET /order-items/{itemId}/reviews
  GET /reviews?orderId={orderId}

Pattern 4: Many-to-many relationships
─────────────────────────
  ✓ Express as related resource:
  GET    /users/{userId}/roles               — User's role list
  PUT    /users/{userId}/roles/{roleId}      — Assign role
  DELETE /users/{userId}/roles/{roleId}      — Remove role

  ✓ Alternative approach (junction resource):
  GET    /role-assignments?userId={userId}
  POST   /role-assignments
  DELETE /role-assignments/{assignmentId}

Pattern 5: Search and filtering
─────────────────────────
  ✓ Express as query parameters:
  GET /products?category=electronics&minPrice=1000&sort=-price

  ✓ Complex search with dedicated endpoint:
  POST /products/search
  {
    "query": "laptop",
    "filters": {
      "category": ["electronics"],
      "priceRange": { "min": 50000, "max": 200000 }
    },
    "sort": [{ "field": "price", "order": "asc" }]
  }

Pattern 6: Bulk operations
─────────────────────────
  ✓ Batch operations on collections:
  POST   /users/bulk-create
  PATCH  /users/bulk-update
  DELETE /users/bulk-delete

  ✓ Or batch requests:
  POST /batch
  {
    "requests": [
      { "method": "POST", "url": "/users", "body": { ... } },
      { "method": "POST", "url": "/users", "body": { ... } }
    ]
  }

Pattern 7: Asynchronous operations
─────────────────────────
  ✓ Long-running operations:
  POST /reports/generate
  → 202 Accepted
  {
    "data": {
      "jobId": "job_abc123",
      "status": "processing",
      "statusUrl": "/jobs/job_abc123"
    }
  }

  GET /jobs/job_abc123
  {
    "data": {
      "jobId": "job_abc123",
      "status": "completed",
      "resultUrl": "/reports/rpt_xyz789",
      "completedAt": "2024-06-01T12:30:00Z"
    }
  }
```

### 1.4 operationId Naming Conventions

```
operationId naming patterns:

  Base form: {verb}{ResourceName} (camelCase)

  CRUD operations:
  ─────────────────────────────
  GET    /users          → listUsers
  POST   /users          → createUser
  GET    /users/{id}     → getUser
  PUT    /users/{id}     → updateUser (full update)
  PATCH  /users/{id}     → patchUser (partial update)
  DELETE /users/{id}     → deleteUser

  Sub-resources:
  ─────────────────────────────
  GET    /users/{id}/orders     → listUserOrders
  POST   /users/{id}/orders     → createUserOrder
  GET    /users/{id}/profile    → getUserProfile
  PUT    /users/{id}/profile    → updateUserProfile

  Actions:
  ─────────────────────────────
  POST   /users/{id}/activate       → activateUser
  POST   /users/{id}/deactivate     → deactivateUser
  POST   /orders/{id}/cancel        → cancelOrder
  POST   /users/{id}/reset-password → resetUserPassword

  Search:
  ─────────────────────────────
  GET    /users?search=...     → searchUsers
  POST   /products/search      → searchProducts

  Naming rules:
  ✓ Use camelCase consistently
  ✓ Combination of verb + noun
  ✓ Becomes the method name when generating API clients
  ✓ Must be unique (no duplicates across the entire API)
  ✗ Avoid get_user, GetUser, get-user
```

---

## 2. Field Naming

### 2.1 Casing Conventions

```
JSON field names:

  Recommended: camelCase (JavaScript / frontend friendly)
  {
    "userId": "123",
    "firstName": "Taro",
    "lastName": "Yamada",
    "emailAddress": "taro@example.com",
    "createdAt": "2024-01-15T10:30:00Z",
    "isActive": true,
    "phoneNumber": "+81-90-1234-5678",
    "postalCode": "100-0001"
  }

  Acceptable: snake_case (Ruby/Python ecosystems)
  {
    "user_id": "123",
    "first_name": "Taro",
    "last_name": "Yamada",
    "email_address": "taro@example.com",
    "created_at": "2024-01-15T10:30:00Z",
    "is_active": true,
    "phone_number": "+81-90-1234-5678",
    "postal_code": "100-0001"
  }

  → Consistency within the project is most important
  → camelCase recommended if frontend is JavaScript/TypeScript
  → snake_case acceptable if backend is Python/Ruby

Automating casing conversion:
  → Convert at API gateway or middleware level
  → Convert in client libraries
  → Use one casing in specifications
```

### 2.2 Field Name Patterns

```
1. Date/time fields
─────────────────────────────
  Naming pattern: {past participle}At

  createdAt       — Creation timestamp
  updatedAt       — Update timestamp
  deletedAt       — Deletion timestamp (soft delete)
  publishedAt     — Publication timestamp
  expiredAt       — Expiration timestamp
  lastLoginAt     — Last login timestamp
  scheduledAt     — Scheduled timestamp
  completedAt     — Completion timestamp
  startedAt       — Start timestamp
  cancelledAt     — Cancellation timestamp

  Format:
  → ISO 8601 format: "2024-01-15T10:30:00Z"
  → Use UTC consistently
  → Timezone in a separate field (if needed)

  {
    "createdAt": "2024-01-15T10:30:00Z",
    "timezone": "Asia/Tokyo"
  }

  Date only (no time):
  → ISO 8601 date format: "2024-01-15"
  → Field names: birthDate, hireDate, dueDate
  → "On" suffix also acceptable: expiresOn

2. ID fields
─────────────────────────────
  Recommended formats:

  UUID v4: "550e8400-e29b-41d4-a716-446655440000"
  → Randomly generated, extremely low collision probability
  → Optimal for distributed systems

  UUID v7: "01908816-2e7d-7c0e-8a1c-3b4d5e6f7a8b"
  → Timestamp embedded, sortable
  → Recommended as successor to UUID v4

  ULID: "01ARZ3NDEKTSV4RRFFQ69G5FAV"
  → Sortable, URL-friendly
  → Represented in 26 characters

  Prefixed ID: "user_2c9p8K3nMv", "ord_7x4mR9yLpq"
  → Resource type is immediately identifiable
  → Used by Stripe, Twilio, etc.
  → Convenient for logging and debugging

  ✗ Avoid:
  → Auto-incrementing integers (predictable, security risk)
  → Sequential numbers (data volume can be estimated)

  Naming multiple ID fields:
  {
    "id": "user_2c9p8K3nMv",           ← Own ID
    "organizationId": "org_5x8mN3pLq", ← Foreign key
    "createdBy": "user_7y2kR9wMn"      ← Creator ID
  }

3. Boolean fields
─────────────────────────────
  Naming pattern: is/has/can/should + adjective/verb

  is + state:
  isActive        — Whether active
  isVerified      — Whether verified
  isPublished     — Whether published
  isDeleted       — Whether deleted (soft delete)
  isDefault       — Whether default
  isLocked        — Whether locked

  has + possession:
  hasPassword     — Whether password is set
  hasAvatar       — Whether avatar image exists
  hasPremium      — Whether on premium plan
  hasChildren     — Whether child elements exist

  can + capability:
  canEdit         — Whether editable
  canDelete       — Whether deletable
  canShare        — Whether shareable
  canExport       — Whether exportable

  should + recommendation:
  shouldNotify    — Whether to notify
  shouldSync      — Whether to sync

  ✗ Avoid:
  → active (use isActive)
  → flag, status (use specific names)
  → enabled/disabled (use isEnabled)

4. Enumeration fields
─────────────────────────────
  Recommended: lowercase snake_case

  Status:
  "status": "active"
  "status": "in_progress"
  "status": "completed"
  "status": "cancelled"

  Type:
  "type": "credit_card"
  "type": "bank_transfer"
  "type": "digital_wallet"

  Role:
  "role": "admin"
  "role": "moderator"
  "role": "member"
  "role": "guest"

  Priority:
  "priority": "critical"
  "priority": "high"
  "priority": "medium"
  "priority": "low"

  Enumeration value naming rules:
  ✓ Use lowercase snake_case consistently
  ✓ Adding new values remains backward compatible
  ✓ Clear meaning, no abbreviations
  ✗ Avoid numeric codes (1, 2, 3)
  ✗ Uppercase (ACTIVE, IN_PROGRESS) is debated

5. Amount fields
─────────────────────────────
  Recommended: smallest unit integer + currency code

  {
    "amount": 1500,          ← 1500 JPY (expressed as integer)
    "currency": "JPY",       ← ISO 4217 currency code
    "displayAmount": "¥1,500" ← For display (reference value)
  }

  {
    "amount": 2999,          ← $29.99 (in cents)
    "currency": "USD"
  }

  Multiple amounts:
  {
    "subtotal": 10000,
    "tax": 1000,
    "shippingFee": 500,
    "discount": -200,
    "total": 11300,
    "currency": "JPY"
  }

6. Array fields
─────────────────────────────
  Naming pattern: plural nouns

  "users": [...]
  "tags": [...]
  "permissions": [...]
  "attachments": [...]
  "lineItems": [...]

  Count fields:
  "userCount": 150
  "commentCount": 42
  "totalItems": 500

  ✗ Avoid:
  → "userList" (List suffix is unnecessary)
  → "userData" (Data suffix is unnecessary)

7. Nested object naming
─────────────────────────────
  {
    "user": {                        ← singular
      "id": "user_abc",
      "name": "Taro Tanaka",
      "profile": {                   ← related object
        "bio": "Engineer",
        "avatarUrl": "https://..."
      },
      "address": {                   ← address object
        "postalCode": "100-0001",
        "prefecture": "Tokyo",
        "city": "Chiyoda",
        "street": "Marunouchi 1-1-1",
        "building": "Tokyo Building 3F"
      },
      "metadata": {                  ← metadata
        "lastLoginIp": "192.168.1.1",
        "userAgent": "Mozilla/5.0..."
      }
    }
  }
```

### 2.3 Field Naming Anti-patterns

```
Anti-patterns:

  1. Including type name in field name
  ✗ "nameString", "ageNumber", "isActiveBool"
  ✓ "name", "age", "isActive"

  2. Redundant prefixes
  ✗ "userName", "userEmail" (inside a User object)
  ✓ "name", "email"
  ※ However, IDs should be explicit like "userId"

  3. Overusing abbreviations
  ✗ "desc", "qty", "amt", "addr", "msg"
  ✓ "description", "quantity", "amount", "address", "message"
  Exception: "id", "url", "api" are acceptable

  4. Inconsistent casing
  ✗ "createdAt" and "updated_at" mixed in the same API
  ✓ Standardize to one

  5. Redundant meaning
  ✗ "priceAmount" (price alone implies amount)
  ✗ "nameString" (name alone implies string)
  ✓ "price", "name"

  6. Negated boolean values
  ✗ "isNotActive", "isDisabled", "isInvalid"
  ✓ "isActive" (false means inactive)
  ✓ "isEnabled" (false means disabled)
  ✓ "isValid" (false means invalid)
```

---

## 3. Response Design

### 3.1 Envelope Pattern

```
Envelope pattern:

  Single resource:
  {
    "data": {
      "id": "user_abc123",
      "name": "Taro Tanaka",
      "email": "tanaka@example.com",
      "role": "admin",
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-06-01T12:00:00Z"
    }
  }

  Collection:
  {
    "data": [
      { "id": "user_abc", "name": "Taro Tanaka" },
      { "id": "user_def", "name": "Hanako Yamada" }
    ],
    "meta": {
      "total": 150,
      "page": 1,
      "perPage": 20,
      "totalPages": 8,
      "hasNextPage": true,
      "hasPrevPage": false
    },
    "links": {
      "self": "/users?page=1&per_page=20",
      "first": "/users?page=1&per_page=20",
      "last": "/users?page=8&per_page=20",
      "next": "/users?page=2&per_page=20",
      "prev": null
    }
  }

  Empty response:
  204 No Content (no body)
  → On successful DELETE, etc.

  Creation success:
  201 Created
  Location: /api/v1/users/user_xyz789
  {
    "data": {
      "id": "user_xyz789",
      "name": "Jiro Sato",
      "email": "sato@example.com",
      "createdAt": "2024-06-15T09:00:00Z"
    }
  }
```

### 3.2 null vs Omission Design Policy

```
Distinguishing null from omission:

  Basic policy:
  → null: field exists but has no value
  → Omit: field is not applicable, or was not requested

  Example 1: User profile
  {
    "name": "Taro Tanaka",
    "phone": null,           ← phone number not set
    "bio": null,             ← bio not set
    // "deletedAt" omitted   ← not deleted
    "avatarUrl": null         ← avatar not set
  }

  Example 2: Soft-deleted user
  {
    "name": "Taro Tanaka",
    "deletedAt": "2024-06-01T12:00:00Z",  ← deletion timestamp present
    "phone": null
  }

  Example 3: Field selection (sparse fieldsets)
  GET /users/123?fields=name,email
  {
    "data": {
      "id": "user_abc",
      "name": "Taro Tanaka",
      "email": "tanaka@example.com"
      // phone, bio, etc. omitted (not requested)
    }
  }

  OpenAPI definition:
  nullable fields:
    phone:
      type: string
      nullable: true          ← can be null
    deletedAt:
      type: string
      format: date-time
      nullable: true          ← can be null (when not deleted)

  Optional fields:
  → Do not include in required list
  → Document the omission conditions explicitly
```

### 3.3 Response Extension Patterns

```typescript
// Pattern 1: Resource expansion (Expand / Include)
// GET /orders/ord_abc?expand=customer,items.product

// Response:
{
  "data": {
    "id": "ord_abc",
    "status": "confirmed",
    "customer": {                    // ← expanded resource
      "id": "user_123",
      "name": "Taro Tanaka",
      "email": "tanaka@example.com"
    },
    "items": [
      {
        "id": "item_1",
        "quantity": 2,
        "product": {                 // ← nested expansion
          "id": "prod_xyz",
          "name": "Wireless Earphones",
          "price": 15000
        }
      }
    ],
    "totalAmount": 30000,
    "currency": "JPY"
  }
}

// Without expansion (default):
// GET /orders/ord_abc
{
  "data": {
    "id": "ord_abc",
    "status": "confirmed",
    "customerId": "user_123",        // ← ID only
    "items": [
      {
        "id": "item_1",
        "quantity": 2,
        "productId": "prod_xyz"      // ← ID only
      }
    ],
    "totalAmount": 30000,
    "currency": "JPY"
  }
}
```

```typescript
// Pattern 2: Field selection (Sparse Fieldsets)
// GET /users?fields[users]=name,email&fields[profile]=bio

{
  "data": [
    {
      "id": "user_abc",
      "name": "Taro Tanaka",
      "email": "tanaka@example.com",
      "profile": {
        "bio": "Engineer"
      }
    }
  ]
}
```

```typescript
// Pattern 3: Side-loading
// Include related resources in a separate section (JSON:API style)
{
  "data": [
    {
      "id": "ord_1",
      "customerId": "user_abc",
      "productIds": ["prod_1", "prod_2"]
    }
  ],
  "included": {
    "users": [
      { "id": "user_abc", "name": "Taro Tanaka" }
    ],
    "products": [
      { "id": "prod_1", "name": "Product A", "price": 1000 },
      { "id": "prod_2", "name": "Product B", "price": 2000 }
    ]
  },
  "meta": {
    "total": 50,
    "page": 1
  }
}
```

### 3.4 Status Code Usage Guide

```
HTTP status code usage guide:

━━━ 2xx Success ━━━
  200 OK
  → GET: resource retrieved successfully
  → PUT/PATCH: resource updated successfully
  → POST: operation succeeded (other than resource creation)

  201 Created
  → POST: resource created successfully
  → Return URL of created resource in Location header
  → Return created resource in response body

  202 Accepted
  → Asynchronous processing accepted
  → Processing is not yet complete
  → Include status check URL in response

  204 No Content
  → DELETE: deletion successful
  → PUT/PATCH: update successful (when response body is not needed)
  → No response body

━━━ 3xx Redirect ━━━
  301 Moved Permanently
  → Resource URL has permanently changed
  → Notify new URL via Location header

  304 Not Modified
  → Conditional request (If-None-Match/If-Modified-Since)
  → Cache is valid, no body

━━━ 4xx Client Errors ━━━
  400 Bad Request
  → Request format is invalid (JSON parse error, etc.)
  → Query parameter type is invalid

  401 Unauthorized
  → Missing or invalid authentication token
  → Login required

  403 Forbidden
  → Authenticated but insufficient permissions
  → Access denied

  404 Not Found
  → Resource does not exist
  → URL is invalid

  405 Method Not Allowed
  → HTTP method not allowed for the target resource
  → Notify allowed methods via Allow header

  409 Conflict
  → Resource conflict (duplicate email, etc.)
  → Optimistic lock conflict

  410 Gone
  → Resource has been permanently deleted
  → Previously existed but no longer available

  413 Content Too Large
  → Request body is too large
  → File upload size exceeded

  415 Unsupported Media Type
  → Unsupported Content-Type

  422 Unprocessable Entity
  → Request format is correct but validation error
  → Business logic constraint violation

  429 Too Many Requests
  → Rate limit exceeded
  → Notify retry time via Retry-After header

━━━ 5xx Server Errors ━━━
  500 Internal Server Error
  → Internal server error
  → Do not return details to the client
  → Associate with server logs via requestId

  502 Bad Gateway
  → Invalid response from upstream server

  503 Service Unavailable
  → Service temporarily unavailable
  → Notify expected recovery time via Retry-After header

  504 Gateway Timeout
  → Response timeout from upstream server
```

---

## 4. Error Design

### 4.1 RFC 7807 Problem Details

```json
// RFC 7807 Problem Details complete implementation examples

// Validation error (422)
{
  "type": "https://api.example.com/errors/validation",
  "title": "Validation Error",
  "status": 422,
  "detail": "The request body contains invalid fields.",
  "instance": "/api/v1/users",
  "errors": [
    {
      "field": "email",
      "code": "INVALID_FORMAT",
      "message": "Please enter a valid email address",
      "rejectedValue": "not-an-email"
    },
    {
      "field": "age",
      "code": "OUT_OF_RANGE",
      "message": "Age must be between 18 and 150",
      "rejectedValue": 5
    },
    {
      "field": "name",
      "code": "REQUIRED",
      "message": "Name is required"
    }
  ],
  "requestId": "req_550e8400-e29b-41d4"
}

// Authentication error (401)
{
  "type": "https://api.example.com/errors/unauthorized",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The authentication token is invalid or has expired. Please log in again.",
  "instance": "/api/v1/users/me"
}

// Authorization error (403)
{
  "type": "https://api.example.com/errors/forbidden",
  "title": "Forbidden",
  "status": 403,
  "detail": "You do not have permission to perform this operation. Please contact an administrator.",
  "instance": "/api/v1/admin/users",
  "requiredPermission": "admin:users:write"
}

// Resource not found (404)
{
  "type": "https://api.example.com/errors/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "User 'user_abc123' does not exist.",
  "instance": "/api/v1/users/user_abc123"
}

// Conflict (409)
{
  "type": "https://api.example.com/errors/conflict",
  "title": "Conflict",
  "status": 409,
  "detail": "This email address is already in use.",
  "instance": "/api/v1/users",
  "conflictingField": "email",
  "conflictingValue": "tanaka@example.com"
}

// Rate limit (429)
{
  "type": "https://api.example.com/errors/rate-limit",
  "title": "Too Many Requests",
  "status": 429,
  "detail": "Rate limit exceeded. Please retry after 60 seconds.",
  "retryAfter": 60,
  "limit": 100,
  "remaining": 0,
  "resetAt": "2024-06-01T12:01:00Z"
}

// Server error (500)
{
  "type": "https://api.example.com/errors/internal",
  "title": "Internal Server Error",
  "status": 500,
  "detail": "An unexpected error occurred. If the problem persists, please contact support.",
  "requestId": "req_7890abcd-ef12-3456"
}
```

### 4.2 Error Code System

```
Error code system design:

  Naming convention: DOMAIN_ENTITY_ACTION format (UPPER_SNAKE_CASE)

  Authentication/Authorization:
  ─────────────────────────
  AUTH_TOKEN_MISSING         — Missing token
  AUTH_TOKEN_EXPIRED         — Token expired
  AUTH_TOKEN_INVALID         — Invalid token
  AUTH_REFRESH_TOKEN_EXPIRED — Refresh token expired
  AUTH_INSUFFICIENT_SCOPE    — Insufficient scope
  AUTH_ACCOUNT_LOCKED        — Account locked
  AUTH_ACCOUNT_SUSPENDED     — Account suspended
  AUTH_MFA_REQUIRED          — Multi-factor authentication required
  AUTH_PASSWORD_INCORRECT    — Incorrect password

  User:
  ─────────────────────────
  USER_NOT_FOUND             — User not found
  USER_EMAIL_ALREADY_EXISTS  — Email address already exists
  USER_EMAIL_INVALID         — Invalid email address format
  USER_NAME_TOO_LONG         — Name too long
  USER_NAME_REQUIRED         — Name is required
  USER_ROLE_INVALID          — Invalid role
  USER_CANNOT_DELETE_SELF    — Cannot delete yourself

  Order:
  ─────────────────────────
  ORDER_NOT_FOUND            — Order not found
  ORDER_ALREADY_CANCELLED    — Already cancelled
  ORDER_CANNOT_CANCEL        — Cannot cancel (already shipped, etc.)
  ORDER_PAYMENT_FAILED       — Payment failed
  ORDER_INSUFFICIENT_STOCK   — Insufficient stock
  ORDER_AMOUNT_EXCEEDS_LIMIT — Order amount exceeds limit

  General:
  ─────────────────────────
  VALIDATION_ERROR           — Validation error (generic)
  REQUIRED_FIELD             — Required field missing
  INVALID_FORMAT             — Invalid format
  OUT_OF_RANGE               — Out of range
  TOO_LONG                   — Too many characters
  TOO_SHORT                  — Too few characters
  RATE_LIMIT_EXCEEDED        — Rate limit exceeded
  INTERNAL_ERROR             — Internal error
  SERVICE_UNAVAILABLE        — Service temporarily unavailable
  RESOURCE_NOT_FOUND         — Resource not found (generic)
  DUPLICATE_RESOURCE         — Duplicate resource
  CONFLICT                   — Conflict
```

### 4.3 Error Response Implementation Examples

```typescript
// TypeScript - Error handling implementation
interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  requestId?: string;
  errors?: FieldError[];
  [key: string]: unknown; // Extension properties
}

interface FieldError {
  field: string;
  code: string;
  message: string;
  rejectedValue?: unknown;
}

// Error class definition
class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorType: string,
    public readonly title: string,
    public readonly detail: string,
    public readonly errors?: FieldError[],
    public readonly extensions?: Record<string, unknown>,
  ) {
    super(detail);
  }

  toProblemDetails(requestId: string, instance: string): ProblemDetails {
    return {
      type: `https://api.example.com/errors/${this.errorType}`,
      title: this.title,
      status: this.statusCode,
      detail: this.detail,
      instance,
      requestId,
      ...(this.errors && { errors: this.errors }),
      ...(this.extensions || {}),
    };
  }
}

// Concrete error classes
class ValidationError extends ApiError {
  constructor(errors: FieldError[]) {
    super(
      422,
      'validation',
      'Validation Error',
      'There are errors in the input data.',
      errors,
    );
  }
}

class NotFoundError extends ApiError {
  constructor(resource: string, id: string) {
    super(
      404,
      'not-found',
      'Not Found',
      `${resource} '${id}' does not exist.`,
    );
  }
}

class ConflictError extends ApiError {
  constructor(detail: string, field?: string, value?: unknown) {
    super(
      409,
      'conflict',
      'Conflict',
      detail,
      undefined,
      field ? { conflictingField: field, conflictingValue: value } : undefined,
    );
  }
}

class UnauthorizedError extends ApiError {
  constructor(detail: string = 'Authentication is required.') {
    super(401, 'unauthorized', 'Unauthorized', detail);
  }
}

class ForbiddenError extends ApiError {
  constructor(detail: string = 'You do not have permission to perform this operation.') {
    super(403, 'forbidden', 'Forbidden', detail);
  }
}

class RateLimitError extends ApiError {
  constructor(retryAfter: number) {
    super(
      429,
      'rate-limit',
      'Too Many Requests',
      `Rate limit exceeded. Please retry after ${retryAfter} seconds.`,
      undefined,
      { retryAfter },
    );
  }
}
```

```typescript
// Express.js error handling middleware
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const requestId = req.headers['x-request-id'] as string || `req_${randomUUID()}`;

  if (err instanceof ApiError) {
    const problem = err.toProblemDetails(requestId, req.originalUrl);
    res
      .status(err.statusCode)
      .header('Content-Type', 'application/problem+json')
      .header('X-Request-Id', requestId)
      .json(problem);
    return;
  }

  // Unexpected error
  console.error(`[${requestId}] Unhandled error:`, err);

  res
    .status(500)
    .header('Content-Type', 'application/problem+json')
    .header('X-Request-Id', requestId)
    .json({
      type: 'https://api.example.com/errors/internal',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred.',
      requestId,
      instance: req.originalUrl,
    });
}

// Usage example
app.post('/api/v1/users', async (req, res, next) => {
  try {
    const errors: FieldError[] = [];

    if (!req.body.name) {
      errors.push({
        field: 'name',
        code: 'REQUIRED_FIELD',
        message: 'Name is required.',
      });
    }

    if (!req.body.email) {
      errors.push({
        field: 'email',
        code: 'REQUIRED_FIELD',
        message: 'Email address is required.',
      });
    } else if (!isValidEmail(req.body.email)) {
      errors.push({
        field: 'email',
        code: 'INVALID_FORMAT',
        message: 'Please enter a valid email address.',
        rejectedValue: req.body.email,
      });
    }

    if (errors.length > 0) {
      throw new ValidationError(errors);
    }

    const existingUser = await userService.findByEmail(req.body.email);
    if (existingUser) {
      throw new ConflictError(
        'This email address is already in use.',
        'email',
        req.body.email,
      );
    }

    const user = await userService.create(req.body);
    res
      .status(201)
      .header('Location', `/api/v1/users/${user.id}`)
      .json({ data: user });
  } catch (err) {
    next(err);
  }
});
```

```go
// Go - Error handling implementation
package api

import (
    "encoding/json"
    "fmt"
    "net/http"
)

// ProblemDetails is the RFC 7807 error response
type ProblemDetails struct {
    Type      string       `json:"type"`
    Title     string       `json:"title"`
    Status    int          `json:"status"`
    Detail    string       `json:"detail"`
    Instance  string       `json:"instance,omitempty"`
    RequestID string       `json:"requestId,omitempty"`
    Errors    []FieldError `json:"errors,omitempty"`
}

type FieldError struct {
    Field         string      `json:"field"`
    Code          string      `json:"code"`
    Message       string      `json:"message"`
    RejectedValue interface{} `json:"rejectedValue,omitempty"`
}

// APIError is the application-specific error type
type APIError struct {
    StatusCode int
    ErrorType  string
    Title      string
    Detail     string
    Errors     []FieldError
}

func (e *APIError) Error() string {
    return fmt.Sprintf("[%d] %s: %s", e.StatusCode, e.Title, e.Detail)
}

func (e *APIError) ToProblemDetails(requestID, instance string) ProblemDetails {
    return ProblemDetails{
        Type:      fmt.Sprintf("https://api.example.com/errors/%s", e.ErrorType),
        Title:     e.Title,
        Status:    e.StatusCode,
        Detail:    e.Detail,
        Instance:  instance,
        RequestID: requestID,
        Errors:    e.Errors,
    }
}

// Error factory functions
func NewValidationError(errors []FieldError) *APIError {
    return &APIError{
        StatusCode: http.StatusUnprocessableEntity,
        ErrorType:  "validation",
        Title:      "Validation Error",
        Detail:     "There are errors in the input data.",
        Errors:     errors,
    }
}

func NewNotFoundError(resource, id string) *APIError {
    return &APIError{
        StatusCode: http.StatusNotFound,
        ErrorType:  "not-found",
        Title:      "Not Found",
        Detail:     fmt.Sprintf("%s '%s' does not exist.", resource, id),
    }
}

func NewConflictError(detail string) *APIError {
    return &APIError{
        StatusCode: http.StatusConflict,
        ErrorType:  "conflict",
        Title:      "Conflict",
        Detail:     detail,
    }
}

// Error handling middleware
func ErrorMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if rec := recover(); rec != nil {
                requestID := r.Header.Get("X-Request-Id")
                w.Header().Set("Content-Type", "application/problem+json")
                w.Header().Set("X-Request-Id", requestID)
                w.WriteHeader(http.StatusInternalServerError)

                problem := ProblemDetails{
                    Type:      "https://api.example.com/errors/internal",
                    Title:     "Internal Server Error",
                    Status:    500,
                    Detail:    "An unexpected error occurred.",
                    RequestID: requestID,
                    Instance:  r.URL.Path,
                }
                json.NewEncoder(w).Encode(problem)
            }
        }()
        next.ServeHTTP(w, r)
    })
}
```

---

## 5. Header Conventions

### 5.1 Standard Headers

```
Standard request headers:
  Content-Type: application/json
  Accept: application/json
  Authorization: Bearer <token>
  Accept-Language: ja, en;q=0.8
  Accept-Encoding: gzip, deflate
  If-None-Match: "etag-value"
  If-Modified-Since: Wed, 21 Oct 2015 07:28:00 GMT
  Idempotency-Key: key_abc123

Standard response headers:
  Content-Type: application/json; charset=utf-8
  Content-Language: ja
  Cache-Control: private, max-age=0, no-cache
  ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"
  Last-Modified: Wed, 21 Oct 2015 07:28:00 GMT
  Location: /api/v1/users/user_abc123     (on 201 Created)
  Retry-After: 60                          (on 429 / 503)
  Vary: Accept, Authorization, Accept-Language
```

### 5.2 Custom Headers

```
Custom headers:

  Request tracking:
  X-Request-Id: req_550e8400-e29b     — Request tracking ID
  X-Correlation-Id: corr_abc123       — Distributed tracing ID
  X-Client-Version: 2.1.0             — Client version
  X-Client-Platform: ios              — Client platform

  Rate limiting:
  X-RateLimit-Limit: 100              — Limit value
  X-RateLimit-Remaining: 42           — Remaining count
  X-RateLimit-Reset: 1640000000       — Reset time (Unix timestamp)

  Pagination:
  X-Total-Count: 150                  — Total count
  X-Page-Count: 8                     — Total page count

  API deprecation:
  Deprecation: true                   — Scheduled for deprecation
  Sunset: Sat, 01 Jun 2025 00:00:00 GMT  — Deprecation date
  Link: </v2/users>; rel="successor-version"

  ※ Handling the X- prefix:
  → Deprecated by RFC 6648
  → However, still widely used in practice
  → For new APIs, consider custom headers without X-
  → e.g., RateLimit-Limit, RateLimit-Remaining
```

### 5.3 Idempotency Key Implementation

```typescript
// Idempotency key implementation example
import { Redis } from 'ioredis';

interface IdempotencyRecord {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  createdAt: string;
}

class IdempotencyMiddleware {
  private redis: Redis;
  private ttlSeconds: number;

  constructor(redis: Redis, ttlSeconds: number = 86400) { // 24 hours
    this.redis = redis;
    this.ttlSeconds = ttlSeconds;
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      // GET/DELETE are idempotent, so skip
      if (['GET', 'DELETE', 'PUT'].includes(req.method)) {
        return next();
      }

      const idempotencyKey = req.headers['idempotency-key'] as string;

      // Idempotency key is recommended for POST requests
      if (!idempotencyKey && req.method === 'POST') {
        console.warn('POST request without Idempotency-Key');
        return next(); // Continue processing without a key
      }

      if (!idempotencyKey) {
        return next();
      }

      const cacheKey = `idempotency:${idempotencyKey}`;

      // Check for existing response
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const record: IdempotencyRecord = JSON.parse(cached);

        // Return cached response
        Object.entries(record.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        res.setHeader('X-Idempotency-Replayed', 'true');
        res.status(record.statusCode).json(record.body);
        return;
      }

      // Capture response
      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        const record: IdempotencyRecord = {
          statusCode: res.statusCode,
          headers: {
            'Content-Type': 'application/json',
          },
          body,
          createdAt: new Date().toISOString(),
        };

        // Cache only successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          this.redis.setex(cacheKey, this.ttlSeconds, JSON.stringify(record));
        }

        return originalJson(body);
      };

      next();
    };
  }
}

// Usage example
const idempotency = new IdempotencyMiddleware(redis);
app.use('/api/v1', idempotency.middleware());
```

---

## 6. Internationalization

### 6.1 Multi-language Response Design

```
API design for internationalization (i18n):

  Request:
  Accept-Language: ja, en;q=0.8, zh;q=0.5

  Response:
  Content-Language: ja

  Multi-language error messages:
  {
    "type": "https://api.example.com/errors/validation",
    "title": "Validation Error",
    "status": 422,
    "detail": "There are errors in the input data.",
    "errors": [
      {
        "field": "email",
        "code": "INVALID_FORMAT",
        "message": "Please enter a valid email address"
      }
    ]
  }

  Patterns for returning multi-language content:

  Pattern 1: Return single language based on Accept-Language
  GET /products/123
  Accept-Language: ja
  →
  {
    "data": {
      "id": "prod_123",
      "name": "Wireless Earphones",
      "description": "High-quality Bluetooth earphones"
    }
  }

  Pattern 2: Response including all languages
  GET /products/123?include_translations=true
  →
  {
    "data": {
      "id": "prod_123",
      "name": "Wireless Earphones",
      "description": "High-quality Bluetooth earphones",
      "translations": {
        "en": {
          "name": "Wireless Earphones",
          "description": "High-quality Bluetooth earphones"
        },
        "zh": {
          "name": "无线耳机",
          "description": "高品质蓝牙耳机"
        }
      }
    }
  }

  Pattern 3: Locale-specific fields
  {
    "data": {
      "id": "prod_123",
      "name_ja": "ワイヤレスイヤホン",
      "name_en": "Wireless Earphones",
      "name_zh": "无线耳机"
    }
  }
  → Pattern 3 has low extensibility; Pattern 1 or 2 is recommended
```

### 6.2 Timezone Handling

```
Timezone handling conventions:

  Basic policy:
  1. Server always stores and returns in UTC
  2. Client converts to local time
  3. Include timezone information in a separate field if needed

  Request:
  {
    "scheduledAt": "2024-06-15T10:00:00Z",    ← UTC
    "timezone": "Asia/Tokyo"                    ← Display timezone
  }

  Response:
  {
    "scheduledAt": "2024-06-15T01:00:00Z",     ← UTC (= JST 10:00)
    "timezone": "Asia/Tokyo",
    "localTime": "2024-06-15T10:00:00+09:00"   ← Reference value (local time)
  }

  Date-only (no time) fields:
  {
    "birthDate": "1990-05-15",   ← ISO 8601 date format
    "dueDate": "2024-12-31"
  }

  Duration representation:
  {
    "duration": "PT1H30M",       ← ISO 8601 duration format (1 hour 30 minutes)
    "trialPeriod": "P30D"        ← 30 days
  }
```

---

## 7. Implementing Naming Conventions in OpenAPI

### 7.1 Schema Definition Best Practices

```yaml
# OpenAPI 3.1 naming convention application example
openapi: '3.1.0'
info:
  title: Naming Convention Example API
  version: '1.0.0'

components:
  schemas:
    # Schema name: PascalCase
    User:
      type: object
      required: [id, name, email, role, isActive, createdAt]
      properties:
        # Property name: camelCase
        id:
          type: string
          format: uuid
          readOnly: true
          description: Unique identifier for the user
          example: "550e8400-e29b-41d4-a716-446655440000"
        name:
          type: string
          minLength: 1
          maxLength: 100
          description: User's display name
          example: "Taro Tanaka"
        email:
          type: string
          format: email
          description: Email address (unique within the system)
          example: "tanaka@example.com"
        role:
          type: string
          # Enumeration values: lowercase snake_case
          enum: [user, admin, moderator]
          default: user
          description: User's role
        isActive:
          type: boolean
          default: true
          description: Whether the account is active
        # Date/time: ISO 8601 + At suffix
        createdAt:
          type: string
          format: date-time
          readOnly: true
          description: Creation timestamp (UTC)
        updatedAt:
          type: string
          format: date-time
          readOnly: true
          nullable: true
          description: Last update timestamp (UTC)
        deletedAt:
          type: string
          format: date-time
          readOnly: true
          nullable: true
          description: Deletion timestamp (soft delete, null = not deleted)
        profile:
          $ref: '#/components/schemas/UserProfile'

    UserProfile:
      type: object
      properties:
        bio:
          type: string
          maxLength: 500
          nullable: true
          description: Self-introduction text
        avatarUrl:
          type: string
          format: uri
          nullable: true
          description: URL of avatar image
        location:
          type: string
          maxLength: 100
          nullable: true
        birthDate:
          type: string
          format: date
          nullable: true
          description: Date of birth (YYYY-MM-DD)
        socialLinks:
          type: object
          nullable: true
          properties:
            twitter:
              type: string
              nullable: true
            github:
              type: string
              nullable: true

    # Request/response wrappers
    # Naming convention: {Action}{Resource}Request / {Resource}Response
    CreateUserRequest:
      type: object
      required: [name, email]
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 100
        email:
          type: string
          format: email
        role:
          type: string
          enum: [user, admin, moderator]
          default: user

    UpdateUserRequest:
      type: object
      required: [name, email]
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 100
        email:
          type: string
          format: email
        role:
          type: string
          enum: [user, admin, moderator]

    PatchUserRequest:
      type: object
      minProperties: 1
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 100
        email:
          type: string
          format: email
        isActive:
          type: boolean

    UserResponse:
      type: object
      properties:
        data:
          $ref: '#/components/schemas/User'

    UserListResponse:
      type: object
      properties:
        data:
          type: array
          items:
            $ref: '#/components/schemas/User'
        meta:
          $ref: '#/components/schemas/PaginationMeta'
        links:
          $ref: '#/components/schemas/PaginationLinks'

    # Common schema naming
    PaginationMeta:
      type: object
      properties:
        total:
          type: integer
          description: Total count
        page:
          type: integer
          description: Current page number
        perPage:
          type: integer
          description: Items per page
        totalPages:
          type: integer
          description: Total page count
        hasNextPage:
          type: boolean
        hasPrevPage:
          type: boolean

    PaginationLinks:
      type: object
      properties:
        self:
          type: string
          format: uri
        first:
          type: string
          format: uri
        last:
          type: string
          format: uri
        prev:
          type: string
          format: uri
          nullable: true
        next:
          type: string
          format: uri
          nullable: true

    # RFC 7807 Error
    ProblemDetails:
      type: object
      required: [type, title, status]
      properties:
        type:
          type: string
          format: uri
        title:
          type: string
        status:
          type: integer
        detail:
          type: string
        instance:
          type: string
          format: uri
        requestId:
          type: string
        errors:
          type: array
          items:
            $ref: '#/components/schemas/FieldError'

    FieldError:
      type: object
      required: [field, code, message]
      properties:
        field:
          type: string
        code:
          type: string
        message:
          type: string
        rejectedValue: {}
```

### 7.2 Naming Convention Checks with Spectral

```yaml
# .spectral.yaml - Naming convention lint rules
extends:
  - spectral:oas

rules:
  # Path names: kebab-case
  paths-kebab-case:
    given: "$.paths[*]~"
    then:
      function: pattern
      functionOptions:
        match: "^(/[a-z][a-z0-9-]*(/\\{[a-zA-Z]+\\})?)+$"
    severity: error
    message: "Path names must be in kebab-case (e.g., /user-profiles)"

  # operationId: camelCase
  operation-id-camel-case:
    given: "$.paths[*][*].operationId"
    then:
      function: casing
      functionOptions:
        type: camel
    severity: error
    message: "operationId must be in camelCase"

  # Schema names: PascalCase
  schema-names-pascal-case:
    given: "$.components.schemas[*]~"
    then:
      function: casing
      functionOptions:
        type: pascal
    severity: error
    message: "Schema names must be in PascalCase"

  # Property names: camelCase
  property-names-camel-case:
    given: "$..properties[*]~"
    then:
      function: casing
      functionOptions:
        type: camel
    severity: error
    message: "Property names must be in camelCase"

  # Enum values: snake_case
  enum-values-snake-case:
    given: "$..enum[*]"
    then:
      function: pattern
      functionOptions:
        match: "^[a-z][a-z0-9_]*$"
    severity: warn
    message: "Enum values must be in snake_case"

  # Date/time fields: At suffix
  datetime-field-suffix:
    given: "$..properties[*][?(@.format=='date-time')]~"
    then:
      function: pattern
      functionOptions:
        match: "At$"
    severity: warn
    message: "Date/time fields should use the 'At' suffix (e.g., createdAt)"

  # Boolean fields: is/has/can prefix
  boolean-field-prefix:
    given: "$..properties[?(@.type=='boolean')]~"
    then:
      function: pattern
      functionOptions:
        match: "^(is|has|can|should)"
    severity: warn
    message: "Boolean fields should use is/has/can/should prefix"
```

---

## 8. Naming Analysis of Industry-Standard APIs

### 8.1 Comparing Naming Patterns Across Major APIs

```
Naming patterns of major APIs:

  Stripe API:
  ─────────────────────────
  Endpoints: /v1/customers, /v1/payment_intents
  ID format: cus_xxxxx, pi_xxxxx (prefixed)
  Fields: snake_case
  Enumerations: snake_case ("requires_payment_method")
  Timestamps: Unix timestamp
  Notable: Prefixed IDs improve readability

  GitHub API:
  ─────────────────────────
  Endpoints: /repos/{owner}/{repo}/issues
  ID format: Numeric ID
  Fields: snake_case
  Enumerations: snake_case ("pull_request")
  Timestamps: ISO 8601
  Notable: Hypermedia (HATEOAS) links

  Google Cloud API:
  ─────────────────────────
  Endpoints: /v1/projects/{projectId}/datasets
  ID format: String ID
  Fields: camelCase
  Enumerations: UPPER_SNAKE_CASE ("RUNNING", "FAILED")
  Timestamps: ISO 8601 / protobuf Timestamp
  Notable: Resource name pattern

  Twilio API:
  ─────────────────────────
  Endpoints: /2010-04-01/Accounts/{sid}/Messages
  ID format: SID (AC, SM prefix + 32 characters)
  Fields: snake_case
  Enumerations: snake_case
  Timestamps: RFC 2822
  Notable: Date-based versioning

  Shopify API:
  ─────────────────────────
  Endpoints: /admin/api/2024-01/products.json
  ID format: Numeric ID
  Fields: snake_case
  Enumerations: snake_case
  Timestamps: ISO 8601
  Notable: Date-based versioning + .json extension

  Common patterns:
  ─────────────────────────
  → Most APIs adopt snake_case
  → ISO 8601 is mainstream for timestamps (except Stripe)
  → IDs are UUIDs or prefixed strings
  → Endpoints use nouns in plural form
  → Error responses converging on RFC 7807
```

### 8.2 Establishing Your Own API Style Guide

```
Internal API Style Guide Template:

1. Basic policy
   - Field names: camelCase
   - URLs: kebab-case, plural nouns
   - operationId: camelCase
   - Schema names: PascalCase
   - Enum values: snake_case (lowercase)

2. ID conventions
   - Format: UUIDv7 (sortable)
   - Representation: with hyphens (550e8400-e29b-41d4-...)
   - Consider prefixed IDs for public-facing APIs (user_xxx)

3. Date/time conventions
   - Format: ISO 8601 ("2024-01-15T10:30:00Z")
   - Timezone: UTC
   - Field names: createdAt, updatedAt, deletedAt
   - Date only: ISO 8601 date ("2024-01-15")

4. Response conventions
   - Envelope: { "data": ... }
   - Collections: { "data": [...], "meta": {...}, "links": {...} }
   - Empty response: 204 No Content
   - Creation: 201 Created + Location header

5. Error conventions
   - Format: RFC 7807 Problem Details
   - Content-Type: application/problem+json
   - Error codes: UPPER_SNAKE_CASE
   - requestId: include in all responses

6. Header conventions
   - Authentication: Authorization: Bearer <token>
   - Request tracking: X-Request-Id
   - Rate limiting: X-RateLimit-Limit, X-RateLimit-Remaining
   - Idempotency: Idempotency-Key (POST)

7. Versioning
   - URL: /v1/users
   - Major version only
```

---

## 9. Practice Exercises

### Exercise 1: Fix Naming Conventions

```
Identify and fix the naming issues in the following API specification:

Before:
  POST /api/createUser
  GET /api/GetUserList
  PUT /api/user_profile/{user_id}
  DELETE /api/Users/{UserID}

  Response:
  {
    "user_Name": "Taro",
    "Email": "taro@example.com",
    "created_date": "2024/01/15",
    "active": true,
    "type": 1,
    "user_id": 42
  }

After:
  POST /api/v1/users
  GET /api/v1/users
  PUT /api/v1/users/{userId}/profile
  DELETE /api/v1/users/{userId}

  Response:
  {
    "data": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Taro",
      "email": "taro@example.com",
      "createdAt": "2024-01-15T00:00:00Z",
      "isActive": true,
      "type": "standard",
    }
  }
```

### Exercise 2: Design Error Responses

```
Design error responses for the following scenarios:

1. Unauthenticated user access
2. Invalid email format + empty name
3. Creating a user with an already-existing email address
4. Accessing a non-existent user ID
5. Rate limit exceeded
6. Internal server error

See Section 4 above for answer examples.
For each error, define:
- Appropriate status code
- RFC 7807 format response body
- Error code
- User-facing message
```

### Exercise 3: Create a Style Guide

```
Task: Create an API style guide for a new project.

Decide and document the following items:
1. Field casing rules (camelCase / snake_case)
2. ID format (UUID / ULID / prefixed)
3. Date/time format and representation
4. Enumeration naming conventions
5. Error response format
6. Pagination design
7. Versioning policy

Reach team consensus and implement as Spectral rules.
```

---

## FAQ

### Q1: Between camelCase and snake_case, which is recommended for API design?

**A**: Both are widely used and there is no absolute answer, but the following tendencies exist.

- **camelCase recommended**: Mainstream for JSON APIs. High affinity with JavaScript/TypeScript environments (e.g., GitHub API, Stripe API)
- **snake_case recommended**: Python/Ruby environments, when consistency with database column names is important (e.g., Slack API, Twitter API v1)

**Consistency is what matters most**: Standardize within the project and document it.
By defining schemas in OpenAPI specifications and auto-checking with Spectral rules, you can ensure naming consistency.

```yaml
# Spectral rule example
rules:
  field-names-camel-case:
    description: Field names must be in camelCase
    given: $.paths..*.responses..content..schema..properties[*]~
    then:
      function: pattern
      functionOptions:
        match: "^[a-z][a-zA-Z0-9]*$"
```

### Q2: Should singular or plural form be used for URL path naming?

**A**: **Plural form is recommended**.

Reasons:
- Natural when representing a collection (`GET /users` retrieves a list of users)
- Single resources can also be expressed with the same path (`GET /users/{id}` retrieves a specific user)
- Industry standard (Google API Design Guide, Microsoft REST API Guidelines)

```
Recommended:
  GET    /users          ← plural
  GET    /users/{id}
  POST   /users
  DELETE /users/{id}

Not recommended:
  GET    /user           ← singular
  GET    /user/{id}
```

**Exception**: Use singular when the resource is a singleton
```
GET /auth/session       ← current session (only one exists)
GET /user/profile       ← current user's profile
```

### Q3: What is the best way to standardize API naming conventions within a team?

**A**: The following three-step approach is effective.

**1. Create a style guide**
- Document naming conventions for API design (e.g., based on the content of this chapter)
- Specify fields, endpoints, error codes, date/time formats, etc.
- Formally adopt after team review

**2. Implementation in OpenAPI specification**
```yaml
# Define schemas in openapi.yaml
components:
  schemas:
    User:
      type: object
      properties:
        userId:          # camelCase standardized
          type: string
          format: uuid
        createdAt:       # date/time is ISO 8601
          type: string
          format: date-time
        isActive:        # boolean uses is prefix
          type: boolean
```

**3. Automated checks with Spectral**
```yaml
# .spectral.yaml
extends: spectral:oas
rules:
  path-params-kebab-case:
    description: Paths must be in kebab-case
    given: $.paths[*]~
    then:
      function: pattern
      functionOptions:
        match: "^/[a-z0-9-/{}]*$"

  response-property-camelcase:
    description: Response fields must be in camelCase
    given: $.paths..responses..content..schema..properties[*]~
    then:
      function: casing
      functionOptions:
        type: camel
```

By integrating into your CI/CD pipeline, automatic checks run on PRs, preventing naming convention violations.

---

## Summary

| Concept | Key Points |
|------|---------|
| Endpoints | Nouns, plural form, kebab-case, up to 2 levels |
| Fields | Unified camelCase/snake_case, ISO 8601 timestamps |
| IDs | UUID/ULID recommended, prefixed IDs also effective |
| Booleans | is/has/can prefix |
| Enumerations | Unified lowercase snake_case |
| Responses | data + meta envelope |
| Errors | RFC 7807 Problem Details, error code system |
| Headers | Standard headers + custom header conventions |
| Internationalization | Accept-Language, UTC standardization |
| Consistency | Automated checks with Spectral |

---

## Next Guides to Read
- [Versioning Strategy](./02-versioning-strategy.md)
- [Pagination and Filtering](./03-pagination-and-filtering.md)

---

## References
1. RFC 7807. "Problem Details for HTTP APIs." IETF, 2016.
2. RFC 9457. "Problem Details for HTTP APIs (updated)." IETF, 2023.
3. RFC 6648. "Deprecating the X- Prefix." IETF, 2012.
4. Google. "API Design Guide." cloud.google.com, 2024.
5. Microsoft. "REST API Guidelines." github.com/microsoft/api-guidelines, 2024.
6. Stripe. "API Reference." stripe.com/docs/api, 2024.
7. GitHub. "REST API Documentation." docs.github.com, 2024.
8. Zalando. "RESTful API Guidelines." opensource.zalando.com/restful-api-guidelines, 2024.
9. JSON:API. "JSON:API Specification." jsonapi.org, 2024.
10. Stoplight. "API Style Guide." stoplight.io, 2024.

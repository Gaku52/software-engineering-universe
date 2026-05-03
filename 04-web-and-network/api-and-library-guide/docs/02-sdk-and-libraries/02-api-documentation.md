# API Documentation

> API documentation is the "face" of an API and the first interface developers encounter. This chapter provides a systematic understanding of all techniques for creating developer-loved documentation — from OpenAPI/Swagger, Redoc, Scalar, auto-generation tools, and interactive documentation, to code example design and documentation-driven development (Design-First).

## Prerequisites

- Concept of API First design → See: [API First Design](../00-api-design-principles/00-api-first-design.md)
- Basics of OpenAPI specification → See: [API First Design](../00-api-design-principles/00-api-first-design.md)
- Markdown syntax
- Fundamentals of RESTful APIs
- Understanding of HTTP status codes
- Basics of JSON format

## What You Will Learn

- [ ] Understand the detailed structure of OpenAPI 3.0/3.1 specifications and how automatic documentation generation works
- [ ] Grasp the characteristics and appropriate use cases for major rendering tools such as Swagger UI, Redoc, and Scalar
- [ ] Be able to practice the documentation-driven development (Design-First) workflow
- [ ] Learn how to build and customize interactive documentation
- [ ] Master the components, design principles, and quality metrics of good documentation
- [ ] Be able to implement the design principles of code examples and multi-language best practices

---

## 1. Overview of API Documentation

### 1.1 Why API Documentation Matters

API documentation serves as both a "contract" and a "user manual" between the API provider and consumers. According to Postman's 2023 survey, 52% of developers — more than the 48% who cited "API features" — ranked "documentation quality" as the most important factor when selecting an API. In other words, no matter how capable an API is, the reality is that it won't be adopted if its documentation is poor.

```
API Documentation Value Chain:

  +------------------+     +-------------------+     +------------------+
  |  Documentation   | --> |  Developer        | --> |  API Adoption    |
  |  Quality         |     |  Experience (DX)  |     |  Rate Increase   |
  +------------------+     +-------------------+     +------------------+
          |                         |                         |
          v                         v                         v
  +------------------+     +-------------------+     +------------------+
  | Support Ticket   | --> |  Onboarding       | --> |  Business        |
  | Cost Reduction   |     |  Time Reduction   |     |  Growth &        |
  +------------------+     +-------------------+     |  Partner Growth  |
                                                      +------------------+

  APIs with high documentation quality:
    - Time to First Call (TTFC): under 5 minutes on average
    - Support tickets: 40% reduction
    - Developer churn rate: 60% improvement
    - SDK adoption rate: 3x increase
```

### 1.2 The 4-Layer Documentation Model

API documentation is not a single document, but is composed of multiple layers suited to the user's level of expertise and use case.

```
4-Layer Structure of API Documentation:

  ┌─────────────────────────────────────────────────┐
  │  Layer 4: Concept                               │
  │  · Architecture design philosophy               │
  │  · How Webhooks work, rate limiting concepts    │
  │  · Security model, data model                  │
  │  Audience: architects and system designers      │
  ├─────────────────────────────────────────────────┤
  │  Layer 3: Tutorial                              │
  │  · Implementation guides like "Build a payment  │
  │    system"                                      │
  │  · Step-by-step procedures                      │
  │  · Complete source code of the finished product │
  │  Audience: beginner to intermediate developers  │
  ├─────────────────────────────────────────────────┤
  │  Layer 2: Guide                                 │
  │  · Quick Start, authentication, pagination      │
  │  · How-to documents for "how to do X"           │
  │  · Best practices collection                    │
  │  Audience: intermediate developers              │
  ├─────────────────────────────────────────────────┤
  │  Layer 1: Reference                             │
  │  · Complete list of all endpoints               │
  │  · Parameters, responses, error codes           │
  │  · Can be auto-generated from OpenAPI           │
  │  Audience: all developers (most frequent users) │
  └─────────────────────────────────────────────────┘

  Good documentation = all 4 layers are present
  Great documentation = all 4 layers are cross-linked
```

Comparing the representative examples and characteristics of each layer:

| Layer | Purpose | Representative Example | Update Frequency | Auto-generation |
|---|---|---|---|---|
| Reference | Understanding endpoint specifications | Stripe API Reference | On API change | Possible from OpenAPI |
| Guide | How to accomplish a specific task | Stripe Docs "Accept a payment" | On feature addition | Partially templateable |
| Tutorial | Step-by-step implementation for learning | Twilio Quest, Plaid Quickstart | Periodically | Auto-testing of sample code possible |
| Concept | Design philosophy and architecture understanding | Stripe architecture overview | On major changes | Manual writing is primary |

### 1.3 Documentation-Driven Development (Design-First / Documentation-Driven Development)

The traditional "Code-First" approach creates documentation after implementation, which easily leads to divergence between the specification and the documentation. The "Design-First" approach first designs the OpenAPI specification, then simultaneously generates both code and documentation from it.

```
Code-First vs Design-First Comparison:

  === Code-First ===

  Implement --> Test --> Generate OpenAPI --> Generate Docs
       ↑                                            |
       |       Spec and doc divergence grows        |
       +--------------------------------------------+

  Problems:
  - Documentation gets pushed back and becomes stale
  - API design review happens after implementation
  - Breaking changes are hard to notice

  === Design-First (Recommended) ===

                  ┌─→ Generate server stub
  Design OpenAPI ─┼─→ Generate client SDK
                  ├─→ Auto-generate documentation
                  ├─→ Start mock server
                  └─→ Auto-generate tests

  Benefits:
  - Specification is Single Source of Truth
  - Frontend and backend can develop in parallel
  - Early detection of breaking changes
  - Documentation is always up to date
```

An example implementation of the Design-First workflow:

```yaml
# .github/workflows/api-design-first.yml
# CI/CD pipeline for the Design-First workflow
name: API Design-First Pipeline
on:
  push:
    paths:
      - 'api/openapi.yaml'
      - 'api/components/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Syntax check for OpenAPI specification
      - name: Validate OpenAPI spec
        run: npx @redocly/cli lint api/openapi.yaml

      # Detect breaking changes
      - name: Check breaking changes
        run: npx oasdiff breaking api/openapi.yaml --base origin/main

  generate:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Generate server stub
      - name: Generate server stub
        run: |
          npx @openapitools/openapi-generator-cli generate \
            -i api/openapi.yaml \
            -g typescript-express-server \
            -o generated/server

      # Generate TypeScript client SDK
      - name: Generate TypeScript SDK
        run: |
          npx @openapitools/openapi-generator-cli generate \
            -i api/openapi.yaml \
            -g typescript-axios \
            -o generated/sdk-typescript

      # Generate Python SDK
      - name: Generate Python SDK
        run: |
          npx @openapitools/openapi-generator-cli generate \
            -i api/openapi.yaml \
            -g python \
            -o generated/sdk-python

  docs:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Generate documentation with Redoc
      - name: Build API docs
        run: npx @redocly/cli build-docs api/openapi.yaml -o docs/index.html

      # Deploy to GitHub Pages
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs
```

---

## 2. OpenAPI Specification in Depth

### 2.1 Differences Between OpenAPI 3.0 and 3.1

OpenAPI is the standard format for describing REST API specifications. Version 3.1 is a significant update that achieves full compatibility with JSON Schema Draft 2020-12.

| Feature | OpenAPI 3.0 | OpenAPI 3.1 |
|---|---|---|
| JSON Schema compatibility | Partial (with proprietary extensions) | Full compatibility (Draft 2020-12) |
| Handling of nullable | `nullable: true` | `type: ["string", "null"]` |
| Exclusive keywords | `exclusiveMinimum: true` + `minimum` | `exclusiveMinimum: value` |
| Webhook definition | Substitute via paths | `webhooks` keyword added |
| Using $ref with other keywords | Not possible | Possible |
| if/then/else | Not supported | Supported |
| License identifier | Not supported | `identifier` field added |
| Tool support | Broad | Growing (major tools supported as of 2024) |

### 2.2 Structured Design of OpenAPI Specifications

For large-scale APIs, maintaining all specifications in a single YAML file becomes difficult. A multi-file structure using $ref is recommended.

```yaml
# Example directory structure
# api/
# ├── openapi.yaml           # Root file
# ├── info.yaml              # API basic information
# ├── paths/
# │   ├── users.yaml         # /users endpoint
# │   ├── orders.yaml        # /orders endpoint
# │   └── products.yaml      # /products endpoint
# ├── components/
# │   ├── schemas/
# │   │   ├── User.yaml
# │   │   ├── Order.yaml
# │   │   └── Error.yaml
# │   ├── parameters/
# │   │   ├── pagination.yaml
# │   │   └── filtering.yaml
# │   ├── responses/
# │   │   ├── NotFound.yaml
# │   │   └── ValidationError.yaml
# │   └── securitySchemes/
# │       └── bearerAuth.yaml
# └── examples/
#     ├── user-create.yaml
#     └── user-list.yaml

# --- openapi.yaml (Root file) ---
openapi: '3.1.0'
info:
  title: Example Commerce API
  version: '2.0.0'
  description: |
    The Example Commerce API provides the core functionality of an e-commerce platform.

    ## Authentication
    All requests require a Bearer token.
    Tokens can be obtained from the [Dashboard](https://dashboard.example.com).

    ## Rate Limiting
    | Plan       | Requests/min | Burst limit |
    |------------|-------------|-------------|
    | Free       | 60          | 10          |
    | Pro        | 600         | 50          |
    | Enterprise | 6000        | 200         |

    ## Error Handling
    All errors are returned in a unified format.
    See [Error Reference](#tag/Errors) for details.
  contact:
    name: API Support
    email: api-support@example.com
    url: https://support.example.com
  license:
    name: MIT
    identifier: MIT
  x-logo:
    url: https://example.com/logo.png
    altText: Example Commerce API

servers:
  - url: https://api.example.com/v2
    description: Production environment
  - url: https://sandbox.api.example.com/v2
    description: Sandbox environment (for testing)
  - url: http://localhost:3000/v2
    description: Local development environment

tags:
  - name: Users
    description: |
      Create, retrieve, update, and delete users.
      Users are the basic entity that owns all resources.
    externalDocs:
      description: User Management Guide
      url: https://docs.example.com/guides/users
  - name: Orders
    description: |
      Create, retrieve, and manage orders.
      See the concept guide for details on the order lifecycle.
  - name: Products
    description: Create, retrieve, and manage products.

security:
  - bearerAuth: []

paths:
  /users:
    $ref: './paths/users.yaml'
  /orders:
    $ref: './paths/orders.yaml'
  /products:
    $ref: './paths/products.yaml'

webhooks:
  orderCompleted:
    post:
      summary: Order completion notification
      description: Webhook event sent when an order is completed
      operationId: onOrderCompleted
      tags: [Webhooks]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: './components/schemas/OrderCompletedEvent.yaml'
      responses:
        '200':
          description: Acknowledgement of Webhook receipt

components:
  securitySchemes:
    bearerAuth:
      $ref: './components/securitySchemes/bearerAuth.yaml'
```

### 2.3 Best Practices for Schema Design

OpenAPI schema definitions directly affect documentation quality. The following is an example of a comprehensive schema definition.

```yaml
# components/schemas/User.yaml
# Detailed definition of the User schema
type: object
title: User
description: |
  A user is the fundamental entity in the system.
  All resources (orders, reviews, etc.) are associated with a user.
required:
  - id
  - email
  - name
  - status
  - createdAt
properties:
  id:
    type: string
    format: uuid
    description: Unique identifier for the user (UUID v4)
    example: "550e8400-e29b-41d4-a716-446655440000"
    readOnly: true
  email:
    type: string
    format: email
    description: |
      The user's email address.
      Must be unique across the system.
      A confirmation email will be sent after a change.
    example: "taro.yamada@example.com"
    maxLength: 254
  name:
    type: string
    description: The user's display name (2-100 characters)
    example: "Taro Yamada"
    minLength: 2
    maxLength: 100
  status:
    type: string
    description: The user's account status
    enum:
      - active
      - inactive
      - suspended
      - pending_verification
    example: "active"
    x-enum-descriptions:
      active: Active account
      inactive: Deactivated account
      suspended: Account suspended due to terms of service violation
      pending_verification: Awaiting email address verification
  role:
    type: string
    description: The user's permission level
    enum:
      - admin
      - manager
      - user
    default: user
    example: "user"
  avatar:
    type:
      - string
      - "null"
    format: uri
    description: Profile image URL (null if not set)
    example: "https://cdn.example.com/avatars/550e8400.jpg"
  metadata:
    type: object
    description: |
      Metadata that can store arbitrary key-value pairs.
      Up to 50 keys can be set. Each key is up to 40 characters; each value is up to 500 characters.
    additionalProperties:
      type: string
      maxLength: 500
    maxProperties: 50
    example:
      department: "Engineering"
      employee_id: "EMP-12345"
  createdAt:
    type: string
    format: date-time
    description: Account creation timestamp (ISO 8601 format, UTC)
    example: "2024-01-15T09:30:00Z"
    readOnly: true
  updatedAt:
    type: string
    format: date-time
    description: Last update timestamp (ISO 8601 format, UTC)
    example: "2024-06-20T14:22:00Z"
    readOnly: true
```

### 2.4 Enriching Endpoint Definitions

The detail of endpoint definitions determines documentation quality.

```yaml
# paths/users.yaml - Complete definition example for user endpoints
get:
  summary: List users
  description: |
    Retrieves a list of registered users.
    Supports cursor-based pagination.

    ### Permissions
    - Requires `users:read` scope

    ### Rate Limiting
    - 100 requests/minute

    ### Sorting
    Use the `sort` parameter to specify order.
    A `-` prefix for descending order (e.g., `-createdAt`).

    ### Filtering
    Use the `status` parameter to retrieve only users in a specific state.
    Comma-separate multiple values (e.g., `status=active,inactive`).
  operationId: listUsers
  tags: [Users]
  parameters:
    - name: cursor
      in: query
      description: |
        Pagination cursor.
        Provide the value of `meta.nextCursor` from the previous response.
        Omit on the first request.
      schema:
        type: string
      example: "eyJpZCI6MTAwfQ"
    - name: limit
      in: query
      description: Number of items per page
      schema:
        type: integer
        minimum: 1
        maximum: 100
        default: 20
      example: 20
    - name: sort
      in: query
      description: |
        Specifies sort order.
        Available fields: `name`, `email`, `createdAt`, `updatedAt`
        Prefix with `-` for descending order.
      schema:
        type: string
        enum:
          - name
          - -name
          - email
          - -email
          - createdAt
          - -createdAt
          - updatedAt
          - -updatedAt
        default: -createdAt
    - name: status
      in: query
      description: Filter by user status (comma-separated for multiple values)
      schema:
        type: string
      example: "active,inactive"
    - name: search
      in: query
      description: Partial match search by name or email address
      schema:
        type: string
        minLength: 2
      example: "yamada"
  responses:
    '200':
      description: Successfully retrieved user list
      headers:
        X-RateLimit-Limit:
          description: Rate limit ceiling
          schema:
            type: integer
          example: 100
        X-RateLimit-Remaining:
          description: Remaining requests
          schema:
            type: integer
          example: 95
        X-RateLimit-Reset:
          description: Rate limit reset time (Unix timestamp)
          schema:
            type: integer
          example: 1719900000
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/UserListResponse'
          examples:
            default:
              summary: Basic response
              value:
                data:
                  - id: "550e8400-e29b-41d4-a716-446655440000"
                    name: "Taro Yamada"
                    email: "taro@example.com"
                    status: "active"
                    role: "user"
                    createdAt: "2024-01-15T09:30:00Z"
                  - id: "660f9500-f30c-52e5-b827-557766551111"
                    name: "Hanako Sato"
                    email: "hanako@example.com"
                    status: "active"
                    role: "manager"
                    createdAt: "2024-02-20T11:00:00Z"
                meta:
                  total: 150
                  hasNextPage: true
                  nextCursor: "eyJpZCI6MTIwfQ"
            empty:
              summary: Empty search results
              value:
                data: []
                meta:
                  total: 0
                  hasNextPage: false
                  nextCursor: null
    '400':
      description: Invalid request parameters
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: "INVALID_PARAMETER"
              message: "limit must be between 1 and 100"
              details:
                - field: "limit"
                  value: 200
                  constraint: "maximum: 100"
    '401':
      $ref: '#/components/responses/Unauthorized'
    '429':
      $ref: '#/components/responses/RateLimited'

post:
  summary: Create a user
  description: |
    Creates a new user.
    A confirmation email will be sent after creation.

    ### Permissions
    - Requires `users:write` scope

    ### Idempotency
    Specifying the `Idempotency-Key` header prevents
    duplicate creation on network errors.
  operationId: createUser
  tags: [Users]
  parameters:
    - name: Idempotency-Key
      in: header
      description: |
        Idempotency key (UUID v4 recommended).
        If re-requested with the same key within 24 hours,
        the result of the first request is returned.
      schema:
        type: string
        format: uuid
      example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  requestBody:
    required: true
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/CreateUserRequest'
        examples:
          basic:
            summary: Basic user creation
            value:
              name: "Taro Yamada"
              email: "taro@example.com"
          with_metadata:
            summary: User creation with metadata
            value:
              name: "Taro Yamada"
              email: "taro@example.com"
              role: "manager"
              metadata:
                department: "Engineering"
                employee_id: "EMP-12345"
  responses:
    '201':
      description: User created successfully
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/User'
    '409':
      description: Email address is already in use
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: "DUPLICATE_EMAIL"
              message: "The specified email address is already registered"
    '422':
      description: Validation error
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ValidationErrorResponse'
          example:
            error:
              code: "VALIDATION_ERROR"
              message: "There are errors in the input values"
              details:
                - field: "email"
                  code: "INVALID_FORMAT"
                  message: "Please enter a valid email address"
                - field: "name"
                  code: "TOO_SHORT"
                  message: "Name must be at least 2 characters"
```

---

## 3. Comparing Documentation Generation Tools

### 3.1 Detailed Comparison of Major Tools

Multiple tools exist for generating documentation from OpenAPI specifications. Choosing the right one based on project requirements is important.

| Feature | Swagger UI | Redoc | Scalar | Stoplight Elements |
|---|---|---|---|---|
| Layout | 1-column | 3-column | 3-column | 3-column |
| Try it out | Standard | Paid plan | Standard | Standard |
| Dark mode | Plugin required | Supported | Standard | Supported |
| SEO support | Weak (SPA) | Strong (SSR capable) | Strong | Moderate |
| Bundle size | ~1.5MB | ~500KB | ~300KB | ~700KB |
| Customizability | CSS/plugins | Limited | Theme system | React components |
| Auto code example generation | None | None | Multi-language | None |
| React integration | @swagger-api/swagger-ui-react | Redoc React wrapper | @scalar/api-reference-react | @stoplight/elements |
| Pricing | Free (OSS) | Freemium/Pro paid | Free (OSS) | Freemium/Pro paid |
| GitHub Stars (2024) | 25k+ | 22k+ | 8k+ | 4k+ |

### 3.2 Configuring and Extending Swagger UI

```html
<!-- Basic Swagger UI setup -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>API Documentation - Swagger UI</title>
  <link rel="stylesheet"
    href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    /* Custom styles */
    .swagger-ui .topbar { display: none; } /* Hide the header bar */
    .swagger-ui .info .title {
      font-size: 2rem;
      color: #1a1a2e;
    }
    .swagger-ui .opblock.opblock-get {
      border-color: #61affe;
      background: rgba(97, 175, 254, 0.05);
    }
    .swagger-ui .opblock.opblock-post {
      border-color: #49cc90;
      background: rgba(73, 204, 144, 0.05);
    }
    .swagger-ui .opblock.opblock-delete {
      border-color: #f93e3e;
      background: rgba(249, 62, 62, 0.05);
    }
    /* Responsive support */
    @media (max-width: 768px) {
      .swagger-ui .wrapper { padding: 0 10px; }
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api/openapi.yaml',
      dom_id: '#swagger-ui',
      deepLinking: true,
      // Pre-set auth credentials (for development environment)
      onComplete: function() {
        // Automatically set test token
        if (window.location.hostname === 'localhost') {
          ui.preauthorizeApiKey('bearerAuth', 'sk_test_abc123');
        }
      },
      // Layout settings
      layout: 'BaseLayout',
      // Enable filter feature
      filter: true,
      // Enable Try it out by default
      tryItOutEnabled: true,
      // Request/response display format
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
      // Validation
      validatorUrl: null, // Disable external validator
      // Operation sorting
      operationsSorter: 'alpha',
      tagsSorter: 'alpha',
    });
  </script>
</body>
</html>
```

### 3.3 Configuring and Customizing Redoc

```html
<!-- Advanced Redoc setup -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>API Documentation - Redoc</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div id="redoc-container"></div>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  <script>
    Redoc.init('/api/openapi.yaml', {
      // Theme customization
      theme: {
        colors: {
          primary: { main: '#5B21B6' },        // Main color
          success: { main: '#059669' },         // Success color
          warning: { main: '#D97706' },         // Warning color
          error: { main: '#DC2626' },           // Error color
          text: { primary: '#1F2937' },         // Text color
        },
        typography: {
          fontSize: '15px',
          fontFamily: '"Noto Sans JP", "Helvetica Neue", sans-serif',
          headings: {
            fontFamily: '"Noto Sans JP", "Helvetica Neue", sans-serif',
            fontWeight: '700',
          },
          code: {
            fontSize: '13px',
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          },
        },
        sidebar: {
          width: '280px',
          backgroundColor: '#F9FAFB',
          textColor: '#374151',
          activeTextColor: '#5B21B6',
        },
        rightPanel: {
          backgroundColor: '#1F2937',
          textColor: '#F3F4F6',
        },
      },
      // Feature settings
      scrollYOffset: 0,
      hideDownloadButton: false,
      hideHostname: false,
      hideLoading: false,
      nativeScrollbars: true,
      pathInMiddlePanel: true,
      requiredPropsFirst: true,
      sortPropsAlphabetically: false,
      expandResponses: '200',
      jsonSampleExpandLevel: 3,
      // SEO settings
      generateTagDescriptions: true,
    }, document.getElementById('redoc-container'));
  </script>
</body>
</html>
```

### 3.4 Configuring Scalar (Modern Alternative)

```typescript
// Example: Scalar integration with Express.js
import express from 'express';
import { apiReference } from '@scalar/express-api-reference';

const app = express();

// Serve OpenAPI specification
app.get('/api/openapi.json', (req, res) => {
  res.sendFile('./api/openapi.json', { root: __dirname });
});

// Configure Scalar API Reference
app.use(
  '/docs',
  apiReference({
    spec: {
      url: '/api/openapi.json',
    },
    theme: 'purple',          // Themes: default, alternate, moon, purple, solarized
    layout: 'modern',         // Layouts: modern, classic
    darkMode: true,            // Initial dark mode state
    hideModels: false,         // Show schema models
    hideDownloadButton: false, // Download button
    hideTestRequestButton: false,
    // Authentication settings
    authentication: {
      preferredSecurityScheme: 'bearerAuth',
      // Test token (development only)
      apiKey: {
        token: process.env.NODE_ENV === 'development'
          ? 'sk_test_abc123'
          : '',
      },
    },
    // Metadata
    metaData: {
      title: 'Example Commerce API',
      description: 'E-commerce Platform API Reference',
      ogDescription: 'Developer documentation for the Example Commerce API',
    },
    // Custom CSS
    customCss: `
      .scalar-app {
        --scalar-font: 'Noto Sans JP', sans-serif;
      }
    `,
  })
);

app.listen(3000, () => {
  console.log('API docs available at http://localhost:3000/docs');
});
```

---

## 4. Design Principles for Code Examples

### 4.1 Requirements for Good Code Examples

Code examples in API documentation are the sections developers reference most. The following principles must be strictly followed.

```
6 Principles for Code Examples:

  ┌─────────────────────────────────────────────────────┐
  │ 1. Immediately runnable                             │
  │    Must work as-is with copy & paste                │
  │    Never omit required import / require             │
  ├─────────────────────────────────────────────────────┤
  │ 2. Use realistic values                             │
  │    Use specific values, not foo, bar, test          │
  │    e.g., "Taro Yamada", "taro@example.com"          │
  ├─────────────────────────────────────────────────────┤
  │ 3. Include error handling                           │
  │    Show both success and failure paths              │
  │    Include try-catch / error callbacks              │
  ├─────────────────────────────────────────────────────┤
  │ 4. Multi-language support                           │
  │    Minimum: curl + JavaScript + Python              │
  │    Ideal: + Go + Ruby + Java + PHP                  │
  ├─────────────────────────────────────────────────────┤
  │ 5. Progressive Disclosure                           │
  │    Step-by-step: basic → detailed → advanced        │
  │    Be mindful not to overwhelm beginners            │
  ├─────────────────────────────────────────────────────┤
  │ 6. Include output results                           │
  │    Provide a response example of execution results  │
  │    Show status codes and headers too                │
  └─────────────────────────────────────────────────────┘
```

### 4.2 Implementing Multi-Language Code Examples

```bash
# === curl ===
# Create a user
curl -X POST https://api.example.com/v2/users \
  -H "Authorization: Bearer sk_test_abc123" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "name": "Taro Yamada",
    "email": "taro@example.com",
    "role": "user",
    "metadata": {
      "department": "Engineering"
    }
  }'

# Example response (HTTP 201 Created)
# {
#   "id": "550e8400-e29b-41d4-a716-446655440000",
#   "name": "Taro Yamada",
#   "email": "taro@example.com",
#   "status": "pending_verification",
#   "role": "user",
#   "avatar": null,
#   "metadata": { "department": "Engineering" },
#   "createdAt": "2024-07-01T10:00:00Z",
#   "updatedAt": "2024-07-01T10:00:00Z"
# }
```

```javascript
// === JavaScript / TypeScript (SDK) ===
import { ExampleClient, ValidationError, RateLimitError } from '@example/sdk';

const client = new ExampleClient({
  apiKey: process.env.EXAMPLE_API_KEY,
  // Optional: custom settings
  timeout: 30000,          // Timeout: 30 seconds
  maxRetries: 3,           // Maximum retry count
  baseURL: 'https://api.example.com/v2',
});

// Create a user
async function createUser() {
  try {
    const user = await client.users.create({
      name: 'Taro Yamada',
      email: 'taro@example.com',
      role: 'user',
      metadata: {
        department: 'Engineering',
      },
    }, {
      idempotencyKey: crypto.randomUUID(),
    });

    console.log('Created user:', user.id);
    // => "550e8400-e29b-41d4-a716-446655440000"
    return user;

  } catch (error) {
    if (error instanceof ValidationError) {
      // Validation error (422)
      console.error('Validation failed:', error.errors);
      // => [{ field: "email", code: "INVALID_FORMAT", message: "..." }]
    } else if (error instanceof RateLimitError) {
      // Rate limit (429)
      console.error(`Rate limited. Retry after ${error.retryAfter}s`);
    } else {
      // Other errors
      console.error('Unexpected error:', error.message);
    }
    throw error;
  }
}
```

```python
# === Python (SDK) ===
import os
import uuid
from example_sdk import ExampleClient
from example_sdk.errors import ValidationError, RateLimitError

client = ExampleClient(
    api_key=os.environ["EXAMPLE_API_KEY"],
    timeout=30.0,        # Timeout: 30 seconds
    max_retries=3,       # Maximum retry count
)

# Create a user
def create_user():
    try:
        user = client.users.create(
            name="Taro Yamada",
            email="taro@example.com",
            role="user",
            metadata={
                "department": "Engineering",
            },
            idempotency_key=str(uuid.uuid4()),
        )
        print(f"Created user: {user.id}")
        # => "550e8400-e29b-41d4-a716-446655440000"
        return user

    except ValidationError as e:
        # Validation error (422)
        print(f"Validation failed: {e.errors}")
        raise
    except RateLimitError as e:
        # Rate limit (429)
        print(f"Rate limited. Retry after {e.retry_after}s")
        raise
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise

if __name__ == "__main__":
    create_user()
```

```go
// === Go ===
package main

import (
    "context"
    "fmt"
    "log"
    "os"
    "time"

    "github.com/example/sdk-go"
    "github.com/google/uuid"
)

func main() {
    client := example.NewClient(
        os.Getenv("EXAMPLE_API_KEY"),
        example.WithTimeout(30*time.Second),
        example.WithMaxRetries(3),
    )

    ctx := context.Background()

    // Create a user
    user, err := client.Users.Create(ctx, &example.CreateUserParams{
        Name:  "Taro Yamada",
        Email: "taro@example.com",
        Role:  example.RoleUser,
        Metadata: map[string]string{
            "department": "Engineering",
        },
    }, example.WithIdempotencyKey(uuid.New().String()))

    if err != nil {
        var validationErr *example.ValidationError
        var rateLimitErr *example.RateLimitError

        switch {
        case errors.As(err, &validationErr):
            log.Printf("Validation failed: %v", validationErr.Errors)
        case errors.As(err, &rateLimitErr):
            log.Printf("Rate limited. Retry after %ds", rateLimitErr.RetryAfter)
        default:
            log.Fatalf("Unexpected error: %v", err)
        }
        return
    }

    fmt.Printf("Created user: %s\n", user.ID)
    // => "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## 5. Designing Quick Start Guides

### 5.1 Structure of an Effective Quick Start

A Quick Start guide aims to get developers to "successfully make their first API call within 5 minutes." The following is a complete Quick Start example.

```markdown
# Quick Start

## Prerequisites
- Node.js 18 or later
- An Example account ([Free sign-up](https://dashboard.example.com/signup))

## Step 1: Get Your API Key (1 minute)

Log in to the [Dashboard](https://dashboard.example.com/api-keys)
and obtain a test API key.

Test keys start with `sk_test_`.
Production keys start with `sk_live_`.

> **Note**: Data created with test keys does not affect the production environment.

## Step 2: Install the SDK (30 seconds)

npm install @example/sdk
# or
yarn add @example/sdk
# or
pnpm add @example/sdk

## Step 3: Your First API Call (2 minutes)

import { ExampleClient } from '@example/sdk';

const client = new ExampleClient({
  apiKey: process.env.EXAMPLE_API_KEY, // sk_test_abc123
});

// Create a user
const user = await client.users.create({
  name: 'Taro Yamada',
  email: 'taro@example.com',
});
console.log('Created:', user.id);

// Get a user
const fetched = await client.users.get(user.id);
console.log('Name:', fetched.name); // => "Taro Yamada"

// List users
const { data: users } = await client.users.list({ limit: 10 });
console.log('Total users:', users.length);

## Step 4: Error Handling (1 minute)

import { ExampleClient, ExampleError, ValidationError } from '@example/sdk';

try {
  await client.users.create({ name: '', email: 'invalid' });
} catch (error) {
  if (error instanceof ValidationError) {
    // Check the error for each field
    for (const detail of error.errors) {
      console.error(`${detail.field}: ${detail.message}`);
    }
  } else if (error instanceof ExampleError) {
    console.error(`API Error [${error.code}]: ${error.message}`);
  }
}

## Next Steps
- Authentication Guide - Setting up OAuth 2.0
- Pagination - Fetching large datasets
- Webhooks - Setting up real-time notifications
- API Reference - Details on all endpoints
```

---

## 6. Changelog and Migration Guide

### 6.1 Structure of an Effective Changelog

A Changelog is not just a record of changes — it is an important document that helps developers assess the scope of impact and how to handle version upgrades. Use the Keep a Changelog format as a base and add API-specific elements.

```markdown
# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [2.0.0] - 2024-07-01 — Major Update

### Breaking Changes (BREAKING CHANGES)

#### Method name changes
Unified to resource-based naming convention.

| v1.x (old) | v2.x (new) |
|---|---|
| `client.getUser(id)` | `client.users.get(id)` |
| `client.listUsers(params)` | `client.users.list(params)` |
| `client.createUser(data)` | `client.users.create(data)` |
| `client.updateUser(id, data)` | `client.users.update(id, data)` |
| `client.deleteUser(id)` | `client.users.delete(id)` |

#### Error type renames
- `ApiError` → `ExampleError`
- `HttpError` → `ExampleHttpError`
- `TimeoutError` → `ExampleTimeoutError`

#### Runtime requirements
- Dropped support for Node.js 16 (Node.js 18+ required)
- Dropped support for Python 3.8 (Python 3.9+ required)

### Added
- `client.users.listAll()` for automatic pagination (AsyncIterator)
- Customizable retry settings (`maxRetries`, `retryDelay`)
- Webhook signature verification helper `client.webhooks.verify(payload, signature)`
- TypeScript: export all response types

### Changed
- Default timeout changed from 10s → 30s
- Default pagination count changed from 10 → 20

### Fixed
- Memory leak on timeout (#234)
- Connection pool exhaustion on heavy concurrent requests (#256)
- Multi-byte character string encoding issue (#271)

### Deprecated
- `client.users.find(query)` is scheduled for removal in v3.0
  → Use `client.users.list({ search: query })` instead

## [1.5.0] - 2024-04-15

### Added
- `client.orders.refund(orderId, params)` method
- Custom handler configuration for request logging
```

### 6.2 Designing a Migration Guide

A migration guide between versions should include not just mechanical diffs, but also migration strategies and verification procedures.

```markdown
# Migration Guide: v1.x to v2.x

## Migration Overview

| Item | Details |
|---|---|
| Estimated effort | Small project: 30 min, Large: 2 hours |
| Number of breaking changes | 8 |
| Automated migration tool | Available (`npx @example/migrate v1-to-v2`) |
| v1.x support end date | 2025-01-01 (security patches only) |

## Automated Migration Tool

npx @example/migrate v1-to-v2 --dry-run  # Preview
npx @example/migrate v1-to-v2            # Execute

## Manual Migration Steps

### Step 1: Update the SDK

npm install @example/sdk@2

### Step 2: Update method calls

// Before (v1.x)
const user = await client.getUser('user_123');
const users = await client.listUsers({ page: 1 });

// After (v2.x)
const user = await client.users.get('user_123');
const users = await client.users.list({ cursor: null });

### Step 3: Update error handling

// Before (v1.x)
import { ApiError } from '@example/sdk';
try { ... } catch (e) {
  if (e instanceof ApiError) { ... }
}

// After (v2.x)
import { ExampleError } from '@example/sdk';
try { ... } catch (e) {
  if (e instanceof ExampleError) { ... }
}

### Step 4: Update pagination

// Before (v1.x) - offset-based
const page1 = await client.listUsers({ page: 1, perPage: 20 });
const page2 = await client.listUsers({ page: 2, perPage: 20 });

// After (v2.x) - cursor-based
const page1 = await client.users.list({ limit: 20 });
const page2 = await client.users.list({
  limit: 20,
  cursor: page1.meta.nextCursor,
});

// v2.x recommended: automatic pagination
for await (const user of client.users.listAll()) {
  console.log(user.name);
}

## Verification Checklist
- [ ] All API calls work correctly
- [ ] Error handling works as expected
- [ ] Pagination behaves as expected
- [ ] Webhook reception is handled correctly
- [ ] No TypeScript type errors
```

---

## 7. Documentation Quality Metrics and Evaluation

### 7.1 Quantitative Quality Indicators

Introduce a framework for measuring documentation quality quantitatively, rather than relying on subjective assessments.

```
Documentation Quality Scorecard:

  ┌─────────────────────────────────────────────────┐
  │  Category A: Completeness          Score: 30    │
  ├─────────────────────────────────────────────────┤
  │  □ All endpoints are documented           (5)   │
  │  □ All parameters have descriptions       (5)   │
  │  □ All response codes are described       (5)   │
  │  □ Authentication method is described     (5)   │
  │  □ Error code list is present             (5)   │
  │  □ Quick Start guide is present           (5)   │
  ├─────────────────────────────────────────────────┤
  │  Category B: Accuracy              Score: 25    │
  ├─────────────────────────────────────────────────┤
  │  □ Code examples actually work           (10)   │
  │  □ Response examples match real output    (5)   │
  │  □ Parameter constraints are accurate     (5)   │
  │  □ Last updated within 6 months           (5)   │
  ├─────────────────────────────────────────────────┤
  │  Category C: Usability             Score: 25    │
  ├─────────────────────────────────────────────────┤
  │  □ Search functionality is available      (5)   │
  │  □ Try it out is available                (5)   │
  │  □ Multi-language code examples exist     (5)   │
  │  □ Mobile-responsive                      (5)   │
  │  □ Dark mode support                      (5)   │
  ├─────────────────────────────────────────────────┤
  │  Category D: Developer Experience  Score: 20    │
  ├─────────────────────────────────────────────────┤
  │  □ TTFC under 5 minutes                   (5)   │
  │  □ SDK installation instructions exist    (5)   │
  │  □ Changelog is maintained                (5)   │
  │  □ Migration guide is available           (5)   │
  └─────────────────────────────────────────────────┘

  Rating criteria:
    90-100: Excellent (Stripe, Twilio level)
    70-89:  Good (level of most commercial APIs)
    50-69:  Needs improvement
    0-49:   Critical issues
```

### 7.2 Documentation Quality Checklist

```
API Documentation Pre-release Checklist:

  === Required Elements ===
  □ Quick Start (first API call successful within 5 minutes)
  □ Authentication method description (including how to obtain API keys)
  □ Reference for all endpoints
  □ Request/response examples for each endpoint
  □ Error code list with remediation steps
  □ Rate limiting explanation (limits per plan)
  □ SDK installation and initialization instructions
  □ How to use pagination
  □ Webhook setup guide (if applicable)
  □ Changelog (Keep a Changelog format)

  === Quality Standards ===
  □ Code examples work with copy & paste
  □ All parameters have descriptions, types, and constraints
  □ Response examples for both success and error cases
  □ Multi-language code examples (minimum curl + 1 SDK)
  □ Search functionality is available
  □ Responsive design (mobile-friendly)
  □ Dark mode support
  □ Regularly updated (last updated date is stated)

  === Advanced Elements (Recommended) ===
  □ Interactive Try it out feature
  □ Sandbox environment provided
  □ OpenAPI spec file available for download
  □ SDK auto-generation configuration
  □ Postman Collection provided
  □ GraphQL Playground (for GraphQL APIs)
  □ Change notification mechanism (RSS, email, etc.)
```

---

## 8. Implementing Interactive Documentation

### 8.1 Designing the Try it Out Feature

The core of interactive documentation is the "Try it out" feature. This feature, which allows developers to call the API directly from a browser and verify its behavior, dramatically improves documentation comprehension.

```
Try it out Feature Architecture:

  ┌──────────────────────────────────────────────────┐
  │                   Browser                        │
  │                                                   │
  │  ┌─────────────┐  ┌──────────────────────────┐   │
  │  │ Parameter   │  │  Response Display         │   │
  │  │ Input Form  │  │  - Status code            │   │
  │  │             │  │  - Headers                │   │
  │  │  name: [...] │  │  - Body (JSON)            │   │
  │  │  email:[...] │  │  - Response time          │   │
  │  │             │  │                           │   │
  │  │ [Execute]   │  │  200 OK  (142ms)          │   │
  │  └──────┬──────┘  │  { "id": "user_123", ...  │   │
  │         │         │  }                        │   │
  │         v         └──────────────────────────┘   │
  │  ┌──────────────┐                                 │
  │  │ CORS Proxy   │  ← Needed when direct access    │
  │  │ (if needed)  │    to production API is         │
  │  └──────┬───────┘    not possible                 │
  └─────────┼─────────────────────────────────────────┘
            │
            v
  ┌──────────────────┐
  │  API Server      │
  │  (sandbox env)   │
  │                  │
  │  Important:      │
  │  Try it out must │
  │  connect to      │
  │  sandbox         │
  └──────────────────┘
```

### 8.2 Designing the Sandbox Environment

To safely provide the Try it out feature, a sandbox environment separated from production is essential.

```typescript
// Example: sandbox environment middleware implementation
import express from 'express';
import rateLimit from 'express-rate-limit';

const sandboxApp = express();

// Sandbox-specific middleware
sandboxApp.use((req, res, next) => {
  // Header to indicate this is a sandbox environment
  res.setHeader('X-Environment', 'sandbox');
  res.setHeader('X-Sandbox-Warning',
    'This is a test environment. Data is reset daily.');
  next();
});

// Strict rate limiting for the sandbox
const sandboxLimiter = rateLimit({
  windowMs: 60 * 1000,    // 1 minute
  max: 30,                  // 30 requests/minute
  message: {
    error: {
      code: 'SANDBOX_RATE_LIMIT',
      message: 'Sandbox environment rate limit reached (30 requests/minute)',
      retryAfter: 60,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

sandboxApp.use(sandboxLimiter);

// Automatic sandbox data reset (daily at UTC 0:00)
import cron from 'node-cron';

cron.schedule('0 0 * * *', async () => {
  console.log('Resetting sandbox data...');
  await resetSandboxDatabase();
  console.log('Sandbox data reset complete');
});

// Automatic issuance of test API keys
sandboxApp.post('/sandbox/api-keys', async (req, res) => {
  const key = generateSandboxApiKey();
  res.json({
    apiKey: key,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    limits: {
      requestsPerMinute: 30,
      dataRetention: '24 hours',
    },
    note: 'This key is for the sandbox environment only. It cannot be used in production.',
  });
});
```

### 8.3 Auto-Generating Postman Collections

Many developers use Postman daily, so providing a Postman Collection is effective.

```javascript
// Script to generate a Postman Collection from OpenAPI
// scripts/generate-postman-collection.js
import { readFileSync, writeFileSync } from 'fs';
import Converter from 'openapi-to-postmanv2';

const openapiSpec = readFileSync('./api/openapi.yaml', 'utf-8');

const options = {
  schemaFaker: true,
  requestNameSource: 'Fallback',
  indentCharacter: '  ',
  folderStrategy: 'Tags',
  includeAuthInfoInExample: true,
  parametersResolution: 'Example',
};

Converter.convert(
  { type: 'string', data: openapiSpec },
  options,
  (err, result) => {
    if (err) {
      console.error('Conversion failed:', err);
      process.exit(1);
    }

    if (!result.result) {
      console.error('Conversion failed:', result.reason);
      process.exit(1);
    }

    const collection = result.output[0].data;

    // Add environment variables
    collection.variable = [
      { key: 'baseUrl', value: 'https://sandbox.api.example.com/v2' },
      { key: 'apiKey', value: 'sk_test_your_key_here' },
    ];

    writeFileSync(
      './docs/example-api.postman_collection.json',
      JSON.stringify(collection, null, 2)
    );

    console.log('Postman collection generated successfully');
  }
);
```

---

## 9. Error Documentation

### 9.1 Designing and Documenting Error Responses

Error documentation is the most critical resource developers use when troubleshooting. Clearly document the cause and remediation for every error code.

```yaml
# components/schemas/ErrorResponse.yaml
type: object
title: ErrorResponse
description: |
  All API errors are returned in a unified format.
  Use `error.code` to identify the type of error.
required:
  - error
properties:
  error:
    type: object
    required:
      - code
      - message
    properties:
      code:
        type: string
        description: |
          Machine-readable error code.
          Use this for branching logic in your application.
        enum:
          - INVALID_PARAMETER
          - VALIDATION_ERROR
          - AUTHENTICATION_REQUIRED
          - INSUFFICIENT_PERMISSIONS
          - RESOURCE_NOT_FOUND
          - DUPLICATE_RESOURCE
          - RATE_LIMIT_EXCEEDED
          - INTERNAL_ERROR
          - SERVICE_UNAVAILABLE
      message:
        type: string
        description: Human-readable error message (English)
      details:
        type: array
        description: Detailed error information (used for validation errors)
        items:
          type: object
          properties:
            field:
              type: string
              description: The field name where the error occurred
            code:
              type: string
              description: Field-specific error code
            message:
              type: string
              description: Field-specific error message
      requestId:
        type: string
        description: |
          Unique identifier for request tracking.
          Share this ID when contacting support.
        example: "req_a1b2c3d4e5f6"
```

### 9.2 Error Code Reference and Remediation

```
Error Code Reference:

  ┌────────────────────────────┬──────┬──────────────────────────────────────┐
  │ Code                       │ HTTP │ Remediation                          │
  ├────────────────────────────┼──────┼──────────────────────────────────────┤
  │ INVALID_PARAMETER          │ 400  │ Check parameter value and type       │
  │ VALIDATION_ERROR           │ 422  │ Check each field via details[]       │
  │ AUTHENTICATION_REQUIRED    │ 401  │ Check Authorization header           │
  │ INSUFFICIENT_PERMISSIONS   │ 403  │ Check API key scope                  │
  │ RESOURCE_NOT_FOUND         │ 404  │ Verify the resource ID exists        │
  │ DUPLICATE_RESOURCE         │ 409  │ Check the field violating uniqueness │
  │ RATE_LIMIT_EXCEEDED        │ 429  │ Follow the Retry-After header        │
  │ INTERNAL_ERROR             │ 500  │ Retry, contact support               │
  │ SERVICE_UNAVAILABLE        │ 503  │ Check the status page                │
  └────────────────────────────┴──────┴──────────────────────────────────────┘
```

### 9.3 Error Handling Best Practices

```typescript
// Comprehensive error handling implementation example
import {
  ExampleClient,
  ExampleError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  InternalError,
} from '@example/sdk';

const client = new ExampleClient({
  apiKey: process.env.EXAMPLE_API_KEY,
  maxRetries: 3,
  // Auto-retry configuration for retryable errors
  retryOn: [429, 500, 503],
  retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
});

async function robustApiCall<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ValidationError) {
      // 422: Input correction required
      console.error(`[${context}] Validation errors:`);
      for (const detail of error.errors) {
        console.error(`  - ${detail.field}: ${detail.message}`);
      }
      throw error; // No retry needed

    } else if (error instanceof AuthenticationError) {
      // 401: API key needs to be checked
      console.error(`[${context}] Authentication failed. Check your API key.`);
      throw error; // No retry needed

    } else if (error instanceof RateLimitError) {
      // 429: Leave to SDK's automatic retry (only reached after maxRetries exceeded)
      console.error(
        `[${context}] Rate limit exceeded after ${client.maxRetries} retries. ` +
        `Retry after ${error.retryAfter}s`
      );
      throw error;

    } else if (error instanceof NotFoundError) {
      // 404: Resource does not exist
      console.warn(`[${context}] Resource not found: ${error.message}`);
      return null as T; // Return null depending on application requirements

    } else if (error instanceof InternalError) {
      // 500: Server-side issue (after SDK auto-retry exceeded)
      console.error(
        `[${context}] Internal server error (requestId: ${error.requestId}). ` +
        `Please contact support with this request ID.`
      );
      throw error;

    } else if (error instanceof ExampleError) {
      // Other API errors
      console.error(
        `[${context}] API Error [${error.code}]: ${error.message} ` +
        `(requestId: ${error.requestId})`
      );
      throw error;

    } else {
      // Non-API errors such as network errors
      console.error(`[${context}] Unexpected error:`, error);
      throw error;
    }
  }
}

// Usage example
const user = await robustApiCall(
  () => client.users.create({
    name: 'Taro Yamada',
    email: 'taro@example.com',
  }),
  'createUser'
);
```

---

## 10. Automating Documentation Testing

### 10.1 Automated Testing of Code Examples

Introduce automated tests to guarantee that the code examples in documentation actually work.

```typescript
// tests/docs-examples.test.ts
// Operational verification tests for code examples in documentation
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ExampleClient, ValidationError } from '@example/sdk';

const client = new ExampleClient({
  apiKey: process.env.EXAMPLE_TEST_API_KEY,
  baseURL: 'https://sandbox.api.example.com/v2',
});

describe('Quick Start guide code examples', () => {
  let createdUserId: string;

  it('Step 3: Create a user', async () => {
    // Same as documentation code example
    const user = await client.users.create({
      name: 'Taro Yamada',
      email: `test-${Date.now()}@example.com`,
    });

    expect(user.id).toBeDefined();
    expect(user.name).toBe('Taro Yamada');
    createdUserId = user.id;
  });

  it('Step 3: Get a user', async () => {
    const fetched = await client.users.get(createdUserId);
    expect(fetched.name).toBe('Taro Yamada');
  });

  it('Step 3: List users', async () => {
    const { data: users } = await client.users.list({ limit: 10 });
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeLessThanOrEqual(10);
  });

  it('Step 4: Validation error', async () => {
    try {
      await client.users.create({ name: '', email: 'invalid' });
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).errors.length).toBeGreaterThan(0);
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (createdUserId) {
      await client.users.delete(createdUserId);
    }
  });
});

describe('Error handling guide code examples', () => {
  it('Authentication error', async () => {
    const badClient = new ExampleClient({ apiKey: 'invalid_key' });
    try {
      await badClient.users.list();
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it('404 error', async () => {
    try {
      await client.users.get('nonexistent_id');
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toHaveProperty('code', 'RESOURCE_NOT_FOUND');
    }
  });
});
```

### 10.2 Automated Validation of OpenAPI Specifications

```yaml
# .github/workflows/api-docs-ci.yml
# CI checks for documentation quality
name: API Documentation CI
on:
  pull_request:
    paths:
      - 'api/**'
      - 'docs/**'

jobs:
  lint-openapi:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Lint OpenAPI spec
        run: |
          npx @redocly/cli lint api/openapi.yaml \
            --config api/.redocly.yaml

      - name: Check for breaking changes
        if: github.event_name == 'pull_request'
        run: |
          npx oasdiff breaking \
            --base <(git show origin/main:api/openapi.yaml) \
            --revision api/openapi.yaml \
            --fail-on ERR

  test-examples:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Run documentation example tests
        env:
          EXAMPLE_TEST_API_KEY: ${{ secrets.SANDBOX_API_KEY }}
        run: npx vitest run tests/docs-examples.test.ts

  validate-links:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check documentation links
        run: |
          npx markdown-link-check docs/**/*.md \
            --config .markdown-link-check.json

  spell-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Spell check documentation
        run: |
          npx cspell "docs/**/*.md" --config .cspell.json
```

### 10.3 Measuring Documentation Coverage

```typescript
// scripts/check-doc-coverage.ts
// Measure documentation coverage of the OpenAPI specification
import { readFileSync } from 'fs';
import yaml from 'js-yaml';

interface CoverageReport {
  total: number;
  documented: number;
  missing: string[];
  coverage: number;
}

function checkCoverage(spec: any): Record<string, CoverageReport> {
  const reports: Record<string, CoverageReport> = {};

  // Coverage of endpoint descriptions
  const endpoints: CoverageReport = {
    total: 0, documented: 0, missing: [], coverage: 0
  };

  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(methods as any)) {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
        endpoints.total++;
        const op = operation as any;
        if (op.description && op.description.length > 20) {
          endpoints.documented++;
        } else {
          endpoints.missing.push(`${method.toUpperCase()} ${path}`);
        }
      }
    }
  }
  endpoints.coverage = Math.round(
    (endpoints.documented / endpoints.total) * 100
  );
  reports['endpoints'] = endpoints;

  // Coverage of parameter descriptions
  const params: CoverageReport = {
    total: 0, documented: 0, missing: [], coverage: 0
  };

  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(methods as any)) {
      const op = operation as any;
      for (const param of op.parameters || []) {
        params.total++;
        if (param.description) {
          params.documented++;
        } else {
          params.missing.push(
            `${method.toUpperCase()} ${path} -> ${param.name}`
          );
        }
      }
    }
  }
  params.coverage = Math.round(
    (params.documented / params.total) * 100
  );
  reports['parameters'] = params;

  // Coverage of response examples
  const examples: CoverageReport = {
    total: 0, documented: 0, missing: [], coverage: 0
  };

  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(methods as any)) {
      const op = operation as any;
      for (const [code, response] of Object.entries(op.responses || {})) {
        examples.total++;
        const resp = response as any;
        const hasExample = resp.content?.['application/json']?.example
          || resp.content?.['application/json']?.examples;
        if (hasExample) {
          examples.documented++;
        } else {
          examples.missing.push(
            `${method.toUpperCase()} ${path} -> ${code}`
          );
        }
      }
    }
  }
  examples.coverage = Math.round(
    (examples.documented / examples.total) * 100
  );
  reports['examples'] = examples;

  return reports;
}

// Execute
const spec = yaml.load(readFileSync('./api/openapi.yaml', 'utf-8'));
const reports = checkCoverage(spec);

console.log('=== Documentation Coverage Report ===\n');
for (const [category, report] of Object.entries(reports)) {
  const status = report.coverage >= 90 ? 'PASS' : 'WARN';
  console.log(`[${status}] ${category}: ${report.coverage}% ` +
    `(${report.documented}/${report.total})`);
  if (report.missing.length > 0) {
    console.log(`  Missing:`);
    report.missing.forEach(m => console.log(`    - ${m}`));
  }
}
```

---

## FAQ

### Q1: How should I decide between automatically generated and manually written API documentation?

**A:** The following criteria are effective for deciding.

**Areas suitable for auto-generation:**
- **API Reference (Layer 1)**: Endpoint lists, parameter definitions, and response schemas should be auto-generated from the OpenAPI specification to maintain a Single Source of Truth
- **Basic code examples**: SDK method signatures and basic call patterns can be auto-generated
- **Type definitions and schemas**: TypeScript type definitions, JSON Schema, etc. can be mechanically generated from OpenAPI

**Areas requiring manual writing:**
- **Concept explanation (Layer 4)**: Architecture design philosophy, security model, and the background of data models are areas where human authorship is indispensable
- **Tutorials (Layer 3)**: Designing a step-by-step learning experience that prevents beginners from giving up requires human judgment
- **Best practices**: Practical usage patterns, performance optimization tips, and anti-pattern explanations require manual writing based on experience
- **Context-specific guides**: Specific use cases like "building a payment system" require understanding business logic and are not suitable for auto-generation

**Recommended approach:**
1. Design OpenAPI specification Design-First (with detailed descriptions and examples)
2. Auto-generate references with Redoc/Scalar, etc.
3. Manually write concept guides, tutorials, and Quick Start
4. Use CI/CD to detect divergence between spec and documentation (breaking change checks)

### Q2: How do I keep API documentation always up to date?

**A:** Preventing documentation staleness requires both organizational mechanisms and technical automation.

**Technical measures:**

1. **Adopt the Design-First approach**
   - Make the OpenAPI specification the Single Source of Truth and simultaneously generate implementation and documentation
   - Automatically regenerate and deploy documentation in CI/CD when the spec changes

   ```yaml
   # .github/workflows/docs-deploy.yml
   on:
     push:
       paths: ['api/openapi.yaml']
   jobs:
     deploy:
       - run: npx @redocly/cli build-docs api/openapi.yaml
       - uses: peaceiris/actions-gh-pages@v3
   ```

2. **Automatic breaking change detection**
   - Detect breaking changes with `oasdiff` on Pull Requests and prompt updating the Migration Guide

3. **Automated testing of code examples in documentation**
   - Guarantee behavior by actually running code examples in documentation in CI (see Section 10.1)

4. **Coverage measurement**
   - Measure the documentation coverage rate for endpoints, parameters, and response examples, and maintain above 90% (see Section 10.3)

**Organizational measures:**

1. **Include documentation updates in the Definition of Done**
   - Pull Requests containing API changes are not merged until the OpenAPI specification update and Migration Guide entry are complete

2. **Assign documentation owners**
   - Set a "Doc Champion" role in the team to clearly define the reviewer responsible for documentation quality

3. **Regular documentation reviews**
   - Review all documentation quarterly and fix outdated information and broken links

4. **Build feedback loops**
   - Place feedback buttons on documentation pages to collect improvement suggestions from developers
   - Extract frequently asked questions from support inquiries and reflect them in the FAQ

### Q3: What are the benefits of introducing interactive API documentation (Swagger UI, etc.)?

**A:** Interactive documentation dramatically improves the developer experience (DX).

**Specific benefits:**

1. **Shortening Time to First Call (TTFC)**
   - Conventional: SDK install → environment setup → write code → execute (average 15-30 minutes)
   - Try it out: enter parameters in browser → click Execute (average 2-5 minutes)
   - According to Postman research, data shows that the Try it out feature reduced TTFC by 80%

2. **Easing the learning curve**
   - Beginners don't need to write code immediately; they can try out the meaning and effects of parameters through trial and error in the UI
   - Being able to confirm responses instantly allows quick judgment of "whether this API really suits my use case"

3. **Reducing support costs**
   - The number of issues developers can self-resolve increases (e.g., "what should I specify for this parameter?")
   - Stripe reported a 40% reduction in inquiries about basic usage after introducing the Try it out feature

4. **Faster API design feedback**
   - Problems with the design can be identified early by having people try the API during internal reviews and beta testing
   - Since it can be tried without writing code, non-engineer stakeholders (PMs, sales, etc.) can also participate in reviews

**Important notes for implementation:**

1. **Mandatory sandbox environment**
   - Try it out must connect to a sandbox environment separated from production
   - Allowing direct access to the production environment risks data corruption and billing due to accidental operations

2. **Stricter rate limiting**
   - To prevent excessive requests from anonymous users, set stricter rate limits in the sandbox environment than in production (e.g., 30 requests/minute)

3. **Appropriate CORS configuration**
   - Configure CORS to allow API calls from the documentation page's domain, but carefully restrict the production environment

4. **Tool selection**
   - **Swagger UI**: Most widely adopted, with a rich plugin ecosystem
   - **Redoc**: Polished UI, but Try it out is a paid plan feature
   - **Scalar**: Modern and fast, standard Try it out, multi-language code generation also available (recommended)

**ROI (Return on Investment):**
- Initial setup: 1-2 days (if OpenAPI specification is already in place)
- Maintenance cost: Nearly zero (since it's auto-generated from OpenAPI)
- Benefits: TTFC reduction, support cost reduction, improved developer satisfaction
- Conclusion: **Extremely cost-effective and recommended for all organizations providing APIs**

---

## Summary

### Overview of API Documentation

| Category | Key Points | Implementation Priority |
|---|---|---|
| **Documentation structure** | Prepare all 4 layers (Reference, Guide, Tutorial, Concept) | High |
| **Design-First** | Design OpenAPI specification first, auto-generate code, documentation, and tests | High |
| **Tool selection** | Choose from Swagger UI (adoption), Redoc (UI), Scalar (modern) based on requirements | High |
| **Code examples** | Immediately runnable, realistic values, includes error handling, multi-language | High |
| **Quick Start** | Aim for the first API call to succeed within 5 minutes | High |
| **Changelog** | Use Keep a Changelog format with clear breaking changes; provide Migration Guide | Medium |
| **Quality metrics** | Coverage above 90%, automated code example testing, breaking change detection | Medium |
| **Try it out** | Safely provide in a sandbox environment, dramatically reduce TTFC | Medium |
| **Error documentation** | Document cause and remediation for all error codes, link requestId to support | Medium |

### Key Points

1. **Documentation determines the value of an API**
   - Postman survey: 52% of developers prioritize "documentation quality" above features
   - Excellent documentation increases adoption rates 3x and reduces support costs by 40%

2. **Maintain a Single Source of Truth**
   - By designing the OpenAPI specification Design-First and simultaneously generating implementation and documentation, you fundamentally prevent divergence between spec and documentation

3. **Structure documentation for the developer's learning stage**
   - Beginner: Quick Start (success in 5 minutes)
   - Intermediate: Guides (how to achieve a specific task)
   - Advanced: Reference (detailed specification), Concept (design philosophy)

4. **Continuously improve documentation**
   - Systematize automated testing of code examples, coverage measurement, and feedback collection to maintain and improve quality

5. **Interactivity transforms the developer experience**
   - The Try it out feature reduces Time to First Call by 80% and dramatically improves developer retention

---

## References

### Official Documentation and Specifications

1. **OpenAPI Initiative**
   [OpenAPI Specification v3.1.0](https://spec.openapis.org/oas/v3.1.0)
   Official OpenAPI 3.1 specification. Details full JSON Schema compatibility, Webhook definitions, and new extensions.

2. **Redocly Documentation**
   [Redoc - OpenAPI/Swagger-generated API Documentation](https://redocly.com/docs/redoc/)
   Official Redoc documentation. Detailed explanations of theme customization, React integration, and SSR support.

3. **Swagger Official Documentation**
   [Swagger UI Documentation](https://swagger.io/docs/open-source-tools/swagger-ui/)
   Official Swagger UI guide. Covers plugin development, OAuth 2.0 integration, and custom validator configuration.

### Tools and Libraries

4. **Scalar API Reference**
   [Scalar - Beautiful API References](https://github.com/scalar/scalar)
   Modern, fast OpenAPI documentation generation tool. Features automatic multi-language code generation and built-in Try it out.

5. **Stoplight Elements**
   [Stoplight Elements](https://stoplight.io/open-source/elements)
   React-based OpenAPI UI component. Embeddable in existing web apps with advanced customization.

6. **OpenAPI Generator**
   [OpenAPI Generator](https://openapi-generator.tech/)
   Tool that auto-generates server stubs and client SDKs in 50+ languages from OpenAPI specs. The core of Design-First development.

### Best Practices and Guides

7. **Stripe API Documentation Best Practices**
   [Stripe API Documentation](https://stripe.com/docs/api)
   Stripe's API documentation, considered the pinnacle of developer experience. The 4-layer structure, interactivity, and high quality of code examples are a great reference.

8. **Keep a Changelog**
   [Keep a Changelog v1.1.0](https://keepachangelog.com/)
   Standard Changelog format. Covers change management methodology combined with semantic versioning.

9. **Documentation System by Divio**
   [The Documentation System](https://documentation.divio.com/)
   A systematic framework classifying documentation into Tutorial, How-to Guide, Reference, and Explanation. The theoretical foundation for this chapter's 4-layer model.

### Research and Reports

10. **Postman State of the API Report 2023**
    [State of the API Report](https://www.postman.com/state-of-api/)
    Large-scale survey on APIs targeting 15,000+ developers. Contains data on the importance of documentation quality and the effectiveness of the Try it out feature.

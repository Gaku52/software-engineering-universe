# API First Design

> API First design is an approach that defines the API contract before implementation. By designing the API in OpenAPI specification first, it enables parallel development between frontend and backend teams. Schema-driven development integrates type safety, test automation, and documentation generation into a unified workflow, dramatically boosting team-wide productivity.

## What You Will Learn

- [ ] Understand the philosophy and benefits of API First design
- [ ] Learn how to write OpenAPI (Swagger) specifications
- [ ] Learn parallel development using mock servers
- [ ] Master how to build a code generation toolchain
- [ ] Understand the API design review process and quality standards
- [ ] Learn the steps for introducing API First into real-world projects
- [ ] Learn how to practice Contract Testing
- [ ] Understand the organizational rollout of a Design-First workflow

## Prerequisites

- Basic knowledge of HTTP methods and status codes → See: HTTP Basics
- Concept of REST APIs → See: REST API
- Basic reading and writing of JSON format

---

## 1. What Is API First

### 1.1 Core Concept

```
API First = "Finalize the API design before writing implementation code"

  Traditional approach (Code First):
  Backend implementation → API spec is finalized → Frontend development
  → Frontend has to wait

  API First:
  Define API spec → Spin up mock server
  → Backend: implement according to spec
  → Frontend: develop in parallel against mock server
  → Both sides converge for integration testing

  Benefits:
  ✓ Parallel development of frontend and backend
  ✓ Spec = Single Source of Truth
  ✓ Easy to review API design
  ✓ Type-safe client via code generation
  ✓ Automatic test generation
  ✓ Automatic documentation generation, always up to date
  ✓ Clear contracts between microservices
  ✓ Unified API standards across the organization

  Toolchain:
  Design:       Stoplight Studio, Swagger Editor, Redocly
  Spec:         OpenAPI 3.1 (YAML/JSON)
  Mock:         Prism, MSW, WireMock, Microcks
  Code gen:     openapi-generator, orval, openapi-typescript
  Docs:         Redoc, Swagger UI, Scalar, Elements
  Testing:      Dredd, Schemathesis, Pact, Specmatic
  Linting:      Spectral, Redocly CLI, vacuum
  Governance:   Optic, Bump.sh
```

### 1.2 Detailed Comparison: Code First vs API First

```
┌─────────────────────┬──────────────────────┬──────────────────────┐
│ Aspect              │ Code First           │ API First            │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ Development start   │ From backend impl    │ From API spec def    │
│ Frontend start      │ After backend done   │ Immediately via mock │
│ Spec management     │ Auto-gen from code   │ Spec is the master   │
│ Design review       │ Mixed in code review │ Independent review   │
│ Type safety         │ Manual definition    │ Guaranteed by gen    │
│ Change tracking     │ From code diff       │ Clear via spec diff  │
│ Learning cost       │ Low                  │ Medium (OpenAPI)     │
│ Initial cost        │ Low                  │ Medium               │
│ Long-term maint.    │ High                 │ Low                  │
│ Team agreement      │ Tends to be vague    │ Clear contract       │
│ Test automation     │ Manual setup         │ Auto-gen from spec   │
│ Doc freshness       │ Tends to drift       │ Always current       │
│ Applicable scale    │ Small projects       │ Medium to large      │
│ Microservices       │ Hard to coordinate   │ Optimal with CDC     │
└─────────────────────┴──────────────────────┴──────────────────────┘
```

### 1.3 Problems API First Solves

```
Problem 1: Frontend/backend waiting on each other
─────────────────────────────────────────
  Code First:
  Week 1-3: Backend implementation
  Week 4-6: Frontend development (waits until backend is done)
  Week 7:   Integration testing
  Total: 7 weeks

  API First:
  Week 1:   Collaboratively design API spec
  Week 2-4: Backend implementation ←→ Frontend development (parallel)
  Week 5:   Integration testing
  Total: 5 weeks (~30% reduction)

Problem 2: Spec and code diverge
─────────────────────────────────────────
  Code First:
  Code changes → forget to update docs → spec goes stale → source of bugs

  API First:
  Spec changes → validated in CI/CD → reflected via code gen → always in sync

Problem 3: Contract mismatches between microservices
─────────────────────────────────────────
  Code First:
  Service A changes → Service B breaks → production incident

  API First:
  Spec change via PR → Contract Test → notify dependent services → safe migration

Problem 4: Inconsistent API design quality
─────────────────────────────────────────
  Code First:
  Each developer designs APIs differently → no consistency

  API First:
  Style guide + Linter → design review → unified API quality
```

### 1.4 API First Maturity Model

```
Level 0: Ad Hoc
  - No API spec
  - Spec communicated verbally or via Slack
  - Documentation created manually after the fact

Level 1: Design First
  - Write spec in OpenAPI ahead of implementation
  - Generate documentation from the spec
  - Manual code implementation

Level 2: Contract Driven
  - Parallel development using mock servers
  - Use of code generation
  - Introduction of Contract Testing

Level 3: Automated
  - Spec validation in CI/CD
  - Automatic detection of breaking changes
  - Automated documentation and SDK publishing

Level 4: Governed
  - Organization-wide API style guide
  - Design System for APIs
  - API Catalog management
  - Quality improvements driven by metrics

Goal: Start new projects at Level 2 or above,
      and aim to reach Level 3 within 6 months
```

---

## 2. OpenAPI Specification

### 2.1 Basic Structure

```yaml
# openapi.yaml - Complete example of an OpenAPI 3.1 specification
openapi: '3.1.0'
info:
  title: User Management API
  version: '1.0.0'
  description: |
    A RESTful API for user management.

    ## Overview
    This API provides user registration, authentication, and profile management.

    ## Authentication
    Authentication via Bearer Token (JWT) is required.
    Obtain a token from the `/auth/login` endpoint.

    ## Rate Limiting
    - Authenticated users: 1000 req/min
    - Unauthenticated: 100 req/min

    ## Error Handling
    All error responses follow the RFC 7807 Problem Details format.
  contact:
    name: API Support
    email: api-support@example.com
    url: https://developer.example.com/support
  license:
    name: Apache 2.0
    url: https://www.apache.org/licenses/LICENSE-2.0.html
  termsOfService: https://example.com/terms

externalDocs:
  description: Detailed API developer guide
  url: https://developer.example.com/guide

servers:
  - url: https://api.example.com/v1
    description: Production
  - url: https://staging-api.example.com/v1
    description: Staging
  - url: http://localhost:3000/v1
    description: Local Development

tags:
  - name: Users
    description: User management operations
  - name: Auth
    description: Authentication and authorization operations
  - name: Admin
    description: Admin-only operations

paths:
  /users:
    get:
      summary: Get list of users
      description: |
        Returns a paginated list of users.
        Supports filtering and sorting.
      operationId: listUsers
      tags: [Users]
      parameters:
        - name: page
          in: query
          description: Page number (1-indexed)
          schema:
            type: integer
            default: 1
            minimum: 1
        - name: per_page
          in: query
          description: Number of items per page
          schema:
            type: integer
            default: 20
            minimum: 1
            maximum: 100
        - name: sort
          in: query
          description: Sort field
          schema:
            type: string
            enum: [name, email, created_at, updated_at]
            default: created_at
        - name: order
          in: query
          description: Sort order
          schema:
            type: string
            enum: [asc, desc]
            default: desc
        - name: search
          in: query
          description: Search by name or email (partial match)
          schema:
            type: string
            maxLength: 100
        - name: role
          in: query
          description: Filter by role
          schema:
            type: string
            enum: [user, admin, moderator]
        - name: status
          in: query
          description: Filter by status
          schema:
            type: string
            enum: [active, inactive, suspended]
      responses:
        '200':
          description: List of users
          headers:
            X-Total-Count:
              description: Total item count
              schema:
                type: integer
            X-RateLimit-Remaining:
              description: Remaining request count
              schema:
                type: integer
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserListResponse'
              examples:
                default:
                  summary: Standard response example
                  value:
                    data:
                      - id: "550e8400-e29b-41d4-a716-446655440000"
                        name: "Taro Tanaka"
                        email: "tanaka@example.com"
                        role: "admin"
                        status: "active"
                        createdAt: "2024-01-15T09:00:00Z"
                    meta:
                      total: 150
                      page: 1
                      per_page: 20
                      total_pages: 8
        '401':
          $ref: '#/components/responses/Unauthorized'
        '429':
          $ref: '#/components/responses/TooManyRequests'

    post:
      summary: Create a user
      description: |
        Creates a new user.
        The email address must be unique across the system.
      operationId: createUser
      tags: [Users]
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
                  name: "Hanako Yamada"
                  email: "yamada@example.com"
              withRole:
                summary: Create user with a role
                value:
                  name: "Jiro Sato"
                  email: "sato@example.com"
                  role: "moderator"
                  profile:
                    bio: "Engineering Manager"
                    avatarUrl: "https://example.com/avatars/sato.png"
      responses:
        '201':
          description: User created successfully
          headers:
            Location:
              description: URL of the created resource
              schema:
                type: string
                format: uri
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
        '409':
          description: Email address is already in use
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '422':
          $ref: '#/components/responses/ValidationError'

  /users/{userId}:
    get:
      summary: Get user details
      operationId: getUser
      tags: [Users]
      parameters:
        - $ref: '#/components/parameters/UserId'
      responses:
        '200':
          description: User details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
        '404':
          $ref: '#/components/responses/NotFound'

    put:
      summary: Update user information
      description: Fully replaces user information.
      operationId: updateUser
      tags: [Users]
      parameters:
        - $ref: '#/components/parameters/UserId'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateUserRequest'
      responses:
        '200':
          description: Update successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          description: Email address is already in use
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '422':
          $ref: '#/components/responses/ValidationError'

    patch:
      summary: Partially update user information
      description: Updates only the specified fields.
      operationId: patchUser
      tags: [Users]
      parameters:
        - $ref: '#/components/parameters/UserId'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PatchUserRequest'
      responses:
        '200':
          description: Partial update successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
        '404':
          $ref: '#/components/responses/NotFound'

    delete:
      summary: Delete a user
      description: |
        Soft-deletes a user.
        The user can be restored within 30 days of deletion.
      operationId: deleteUser
      tags: [Users]
      parameters:
        - $ref: '#/components/parameters/UserId'
      responses:
        '204':
          description: Deletion successful
        '404':
          $ref: '#/components/responses/NotFound'

  /auth/login:
    post:
      summary: Login
      operationId: login
      tags: [Auth]
      security: []  # No authentication required
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
                  minLength: 8
      responses:
        '200':
          description: Login successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  access_token:
                    type: string
                  refresh_token:
                    type: string
                  expires_in:
                    type: integer
                    description: Access token expiry in seconds
                  token_type:
                    type: string
                    enum: [Bearer]
        '401':
          description: Authentication failed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /auth/refresh:
    post:
      summary: Refresh token
      operationId: refreshToken
      tags: [Auth]
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [refresh_token]
              properties:
                refresh_token:
                  type: string
      responses:
        '200':
          description: Token refresh successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  access_token:
                    type: string
                  expires_in:
                    type: integer

  /users/{userId}/avatar:
    put:
      summary: Upload avatar image
      operationId: uploadAvatar
      tags: [Users]
      parameters:
        - $ref: '#/components/parameters/UserId'
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file:
                  type: string
                  format: binary
                  description: "Image file (JPEG, PNG, WebP) max 5MB"
            encoding:
              file:
                contentType: image/jpeg, image/png, image/webp
      responses:
        '200':
          description: Upload successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  url:
                    type: string
                    format: uri
        '413':
          description: File size exceeded
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

components:
  parameters:
    UserId:
      name: userId
      in: path
      required: true
      description: User UUID
      schema:
        type: string
        format: uuid
      example: "550e8400-e29b-41d4-a716-446655440000"

  schemas:
    User:
      type: object
      required: [id, name, email, role, status, createdAt]
      properties:
        id:
          type: string
          format: uuid
          readOnly: true
        name:
          type: string
          minLength: 1
          maxLength: 100
          description: User display name
        email:
          type: string
          format: email
          description: Email address (unique)
        role:
          type: string
          enum: [user, admin, moderator]
          default: user
          description: User role
        status:
          type: string
          enum: [active, inactive, suspended]
          default: active
          description: Account status
        profile:
          $ref: '#/components/schemas/UserProfile'
        createdAt:
          type: string
          format: date-time
          readOnly: true
        updatedAt:
          type: string
          format: date-time
          readOnly: true

    UserProfile:
      type: object
      properties:
        bio:
          type: string
          maxLength: 500
          description: User biography
        avatarUrl:
          type: string
          format: uri
          description: Avatar image URL
        location:
          type: string
          maxLength: 100
        website:
          type: string
          format: uri
        socialLinks:
          type: object
          properties:
            twitter:
              type: string
            github:
              type: string
            linkedin:
              type: string

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
        profile:
          $ref: '#/components/schemas/UserProfile'

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
        profile:
          $ref: '#/components/schemas/UserProfile'

    PatchUserRequest:
      type: object
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
        status:
          type: string
          enum: [active, inactive, suspended]
        profile:
          $ref: '#/components/schemas/UserProfile'
      minProperties: 1

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

    PaginationMeta:
      type: object
      properties:
        total:
          type: integer
          description: Total item count
        page:
          type: integer
          description: Current page number
        per_page:
          type: integer
          description: Number of items per page
        total_pages:
          type: integer
          description: Total number of pages

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

    Error:
      type: object
      required: [type, title, status]
      properties:
        type:
          type: string
          format: uri
          description: URI identifying the error type
        title:
          type: string
          description: Short summary of the error
        status:
          type: integer
          description: HTTP status code
        detail:
          type: string
          description: Detailed description of the error
        instance:
          type: string
          format: uri
          description: The specific resource where the error occurred
        errors:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
              message:
                type: string
              code:
                type: string
          description: Per-field validation errors

  responses:
    Unauthorized:
      description: Authentication error
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            type: "https://api.example.com/errors/unauthorized"
            title: "Unauthorized"
            status: 401
            detail: "The authentication token is invalid or expired"

    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            type: "https://api.example.com/errors/not-found"
            title: "Not Found"
            status: 404
            detail: "The specified resource does not exist"

    ValidationError:
      description: Validation error
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            type: "https://api.example.com/errors/validation"
            title: "Validation Error"
            status: 422
            detail: "There are errors in the input data"
            errors:
              - field: "email"
                message: "Please enter a valid email address"
                code: "invalid_format"

    TooManyRequests:
      description: Rate limit exceeded
      headers:
        Retry-After:
          description: Seconds until retry is allowed
          schema:
            type: integer
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            type: "https://api.example.com/errors/rate-limit"
            title: "Too Many Requests"
            status: 429
            detail: "Rate limit exceeded. Please retry after 60 seconds"

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: |
        JWT-based authentication. Obtain a token from `/auth/login`.
        Tokens expire after 1 hour.
    apiKey:
      type: apiKey
      in: header
      name: X-API-Key
      description: API key for service-to-service communication

security:
  - bearerAuth: []
```

### 2.2 Key Features of OpenAPI 3.1

```yaml
# 1. Full compatibility with JSON Schema
# OpenAPI 3.1 is fully compatible with JSON Schema Draft 2020-12
components:
  schemas:
    # if/then/else is supported
    Payment:
      type: object
      properties:
        method:
          type: string
          enum: [credit_card, bank_transfer, crypto]
        cardNumber:
          type: string
        bankAccount:
          type: string
      if:
        properties:
          method:
            const: credit_card
      then:
        required: [cardNumber]
      else:
        if:
          properties:
            method:
              const: bank_transfer
        then:
          required: [bankAccount]

    # prefixItems (formerly tuple validation)
    Coordinate:
      type: array
      prefixItems:
        - type: number
          description: Latitude
        - type: number
          description: Longitude
      minItems: 2
      maxItems: 2

    # contentEncoding, contentMediaType
    FileUpload:
      type: object
      properties:
        content:
          type: string
          contentEncoding: base64
          contentMediaType: image/png

# 2. Webhooks
webhooks:
  userCreated:
    post:
      summary: Webhook on user creation
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                event:
                  type: string
                  const: user.created
                data:
                  $ref: '#/components/schemas/User'
                timestamp:
                  type: string
                  format: date-time
      responses:
        '200':
          description: Webhook received confirmation

  userDeleted:
    post:
      summary: Webhook on user deletion
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                event:
                  type: string
                  const: user.deleted
                data:
                  type: object
                  properties:
                    userId:
                      type: string
                      format: uuid
                timestamp:
                  type: string
                  format: date-time
      responses:
        '200':
          description: Webhook received confirmation

# 3. $ref for path items
paths:
  /users:
    $ref: './paths/users.yaml'
  /users/{userId}:
    $ref: './paths/users-by-id.yaml'
```

### 2.3 Managing Split Specification Files

```
When a project grows large, managing everything in a single file becomes difficult.
Best practices for splitting files:

api/
├── openapi.yaml          # Root file (references each file via $ref)
├── info.yaml             # API info (title, description, version)
├── paths/
│   ├── users.yaml        # /users path definitions
│   ├── users-by-id.yaml  # /users/{userId} path definitions
│   ├── auth.yaml         # /auth/* path definitions
│   └── admin.yaml        # /admin/* path definitions
├── schemas/
│   ├── user.yaml         # User-related schemas
│   ├── auth.yaml         # Auth-related schemas
│   ├── common.yaml       # Common schemas (Error, Pagination)
│   └── admin.yaml        # Admin-related schemas
├── parameters/
│   ├── path.yaml         # Path parameters
│   └── query.yaml        # Query parameters
├── responses/
│   └── errors.yaml       # Common error responses
└── examples/
    ├── users.yaml        # User-related examples
    └── errors.yaml       # Error response examples
```

```yaml
# api/openapi.yaml (root file)
openapi: '3.1.0'
info:
  $ref: './info.yaml'
servers:
  - url: https://api.example.com/v1
    description: Production
paths:
  /users:
    $ref: './paths/users.yaml'
  /users/{userId}:
    $ref: './paths/users-by-id.yaml'
  /auth/login:
    $ref: './paths/auth.yaml#/login'
components:
  schemas:
    User:
      $ref: './schemas/user.yaml#/User'
    Error:
      $ref: './schemas/common.yaml#/Error'
```

```yaml
# api/schemas/user.yaml (split schema file)
User:
  type: object
  required: [id, name, email, createdAt]
  properties:
    id:
      type: string
      format: uuid
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
    createdAt:
      type: string
      format: date-time

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

UserResponse:
  type: object
  properties:
    data:
      $ref: '#/User'
```

```bash
# Bundle split files into one
# Using Redocly CLI
npx @redocly/cli bundle api/openapi.yaml -o dist/openapi.yaml

# Using Swagger CLI
npx swagger-cli bundle api/openapi.yaml -o dist/openapi.yaml -t yaml

# Validation
npx @redocly/cli lint api/openapi.yaml
npx swagger-cli validate api/openapi.yaml
```

---

## 3. Code Generation

### 3.1 TypeScript Type Generation

```bash
# openapi-typescript: Generate TypeScript types from OpenAPI
npm install -D openapi-typescript

# Run type generation
npx openapi-typescript openapi.yaml -o src/api/types.ts

# Watch mode (auto-detect spec changes)
npx openapi-typescript openapi.yaml -o src/api/types.ts --watch
```

```typescript
// Example usage of generated types (from src/api/types.ts)
import type { paths, components } from './types';

// Extract request type
type CreateUserBody = paths['/users']['post']['requestBody']['content']['application/json'];
// => { name: string; email: string; role?: 'user' | 'admin' | 'moderator'; }

// Extract response type
type UserListResponse = paths['/users']['get']['responses']['200']['content']['application/json'];

// Direct schema type reference
type User = components['schemas']['User'];
type Error = components['schemas']['Error'];

// Query parameter types
type ListUsersParams = paths['/users']['get']['parameters']['query'];
```

```typescript
// openapi-fetch: Type-safe fetch client
import createClient from 'openapi-fetch';
import type { paths } from './types';

const client = createClient<paths>({
  baseUrl: 'https://api.example.com/v1',
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

// Fully type-safe API call
// Path, method, parameters, and response are all type-checked
const { data, error } = await client.GET('/users', {
  params: {
    query: {
      page: 1,
      per_page: 20,
      sort: 'created_at',  // selected from enum
      role: 'admin',       // selected from enum
    },
  },
});

if (data) {
  // data is inferred as UserListResponse type
  data.data.forEach(user => {
    console.log(user.name);   // string
    console.log(user.email);  // string
    console.log(user.role);   // 'user' | 'admin' | 'moderator'
  });
}

// Create user (request body is also type-checked)
const { data: newUser, error: createError } = await client.POST('/users', {
  body: {
    name: 'Taro Tanaka',
    email: 'tanaka@example.com',
    // role: 'invalid' // ← compile error!
  },
});

// Path parameters are also type-safe
const { data: user } = await client.GET('/users/{userId}', {
  params: {
    path: { userId: '550e8400-e29b-41d4-a716-446655440000' },
  },
});
```

### 3.2 Client Generation with orval

```typescript
// orval.config.ts
import { defineConfig } from 'orval';

export default defineConfig({
  userApi: {
    input: {
      target: './openapi.yaml',
      validation: true,
    },
    output: {
      target: './src/api/generated.ts',
      client: 'react-query',  // Generate TanStack Query hooks
      mode: 'tags-split',     // Split files by tag
      schemas: './src/api/models',
      mock: true,             // Also generate MSW mocks
      override: {
        mutator: {
          path: './src/api/custom-fetch.ts',
          name: 'customFetch',
        },
        query: {
          useQuery: true,
          useMutation: true,
          signal: true,
        },
        // Also generate Zod validation schemas
        zod: {
          strict: {
            response: true,
            body: true,
          },
        },
      },
    },
    hooks: {
      afterAllFilesWrite: 'prettier --write',
    },
  },
});
```

```bash
# Run orval
npx orval

# Watch mode
npx orval --watch
```

```typescript
// Example usage of generated React Query hooks
import { useListUsers, useCreateUser, useGetUser } from './api/generated';

function UserList() {
  // Auto-generated hooks (cache keys and types all automatic)
  const { data, isLoading, error } = useListUsers({
    page: 1,
    per_page: 20,
    role: 'admin',
  });

  const createUser = useCreateUser();

  const handleCreate = async () => {
    await createUser.mutateAsync({
      data: {
        name: 'New User',
        email: 'new@example.com',
      },
    });
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data?.data?.map(user => (
        <UserCard key={user.id} user={user} />
      ))}
      <button onClick={handleCreate}>Add</button>
    </div>
  );
}

function UserDetail({ userId }: { userId: string }) {
  // Path parameters are also type-safe
  const { data } = useGetUser(userId);

  return <div>{data?.data?.name}</div>;
}
```

### 3.3 Server-Side Code Generation

```bash
# Generate Go server stubs (oapi-codegen)
go install github.com/deepmap/oapi-codegen/cmd/oapi-codegen@latest

oapi-codegen \
  -generate types,server,spec \
  -package api \
  -o server/api/api.gen.go \
  openapi.yaml
```

```go
// Implementing the generated interface (Go)
package api

import (
    "net/http"
    "github.com/labstack/echo/v4"
)

// Generated interface
type ServerInterface interface {
    ListUsers(ctx echo.Context, params ListUsersParams) error
    CreateUser(ctx echo.Context) error
    GetUser(ctx echo.Context, userId string) error
    UpdateUser(ctx echo.Context, userId string) error
    DeleteUser(ctx echo.Context, userId string) error
}

// Implementation
type UserHandler struct {
    userService UserService
}

func (h *UserHandler) ListUsers(ctx echo.Context, params ListUsersParams) error {
    users, total, err := h.userService.List(ctx.Request().Context(), ListOptions{
        Page:    params.Page,
        PerPage: params.PerPage,
        Sort:    params.Sort,
        Order:   params.Order,
        Search:  params.Search,
        Role:    params.Role,
    })
    if err != nil {
        return ctx.JSON(http.StatusInternalServerError, Error{
            Type:   "https://api.example.com/errors/internal",
            Title:  "Internal Server Error",
            Status: 500,
        })
    }

    totalPages := (total + *params.PerPage - 1) / *params.PerPage
    return ctx.JSON(http.StatusOK, UserListResponse{
        Data: users,
        Meta: PaginationMeta{
            Total:      total,
            Page:       *params.Page,
            PerPage:    *params.PerPage,
            TotalPages: totalPages,
        },
    })
}

func (h *UserHandler) CreateUser(ctx echo.Context) error {
    var req CreateUserRequest
    if err := ctx.Bind(&req); err != nil {
        return ctx.JSON(http.StatusUnprocessableEntity, Error{
            Type:   "https://api.example.com/errors/validation",
            Title:  "Validation Error",
            Status: 422,
            Detail: err.Error(),
        })
    }

    user, err := h.userService.Create(ctx.Request().Context(), req)
    if err != nil {
        return handleServiceError(ctx, err)
    }

    return ctx.JSON(http.StatusCreated, UserResponse{Data: user})
}
```

```bash
# Generate Python server stubs (FastAPI)
pip install openapi-generator-cli

openapi-generator-cli generate \
  -i openapi.yaml \
  -g python-fastapi \
  -o server/ \
  --additional-properties=packageName=user_api
```

```python
# Example extending the generated FastAPI server
from fastapi import FastAPI, HTTPException, Depends, Query
from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID

# Generated models
class User(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    role: str = "user"
    status: str = "active"
    created_at: str
    updated_at: Optional[str] = None

class CreateUserRequest(BaseModel):
    name: str
    email: EmailStr
    role: Optional[str] = "user"

class UserResponse(BaseModel):
    data: User

class PaginationMeta(BaseModel):
    total: int
    page: int
    per_page: int
    total_pages: int

class UserListResponse(BaseModel):
    data: list[User]
    meta: PaginationMeta

# Endpoint implementation
app = FastAPI(title="User Management API", version="1.0.0")

@app.get("/v1/users", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    sort: Optional[str] = Query("created_at", enum=["name", "email", "created_at"]),
    order: Optional[str] = Query("desc", enum=["asc", "desc"]),
    search: Optional[str] = Query(None, max_length=100),
    role: Optional[str] = Query(None, enum=["user", "admin", "moderator"]),
    user_service: UserService = Depends(get_user_service),
):
    users, total = await user_service.list_users(
        page=page, per_page=per_page, sort=sort,
        order=order, search=search, role=role,
    )
    return UserListResponse(
        data=users,
        meta=PaginationMeta(
            total=total,
            page=page,
            per_page=per_page,
            total_pages=(total + per_page - 1) // per_page,
        ),
    )

@app.post("/v1/users", response_model=UserResponse, status_code=201)
async def create_user(
    body: CreateUserRequest,
    user_service: UserService = Depends(get_user_service),
):
    user = await user_service.create_user(body)
    return UserResponse(data=user)
```

### 3.4 CI/CD Pipeline for Code Generation

```yaml
# .github/workflows/api-codegen.yml
name: API Code Generation

on:
  push:
    paths:
      - 'api/openapi.yaml'
      - 'api/**/*.yaml'
  pull_request:
    paths:
      - 'api/openapi.yaml'
      - 'api/**/*.yaml'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Validate OpenAPI Spec
        run: |
          npx @redocly/cli lint api/openapi.yaml

      - name: Check for breaking changes
        run: |
          npx @opticdev/optic diff api/openapi.yaml \
            --base origin/main \
            --check
        if: github.event_name == 'pull_request'

  generate:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Generate TypeScript types
        run: |
          npx openapi-typescript api/openapi.yaml \
            -o frontend/src/api/types.ts

      - name: Generate API client
        run: |
          cd frontend && npx orval

      - name: Generate Go server stubs
        run: |
          go install github.com/deepmap/oapi-codegen/cmd/oapi-codegen@latest
          oapi-codegen -generate types,server \
            -package api \
            -o backend/api/api.gen.go \
            api/openapi.yaml

      - name: Commit generated code
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add -A
          git diff --staged --quiet || \
            git commit -m "chore: regenerate API code from OpenAPI spec"
          git push
```

---

## 4. Mock Server

### 4.1 Mock Server with Prism

```bash
# Install and start Prism
npm install -D @stoplight/prism-cli

# Start mock server (auto-generates responses from OpenAPI spec)
npx prism mock openapi.yaml
# → Mock API starts at http://localhost:4010

# Dynamic mock (vary responses based on request)
npx prism mock openapi.yaml --dynamic

# Validation proxy mode
# Verifies that requests/responses to the real API conform to the spec
npx prism proxy openapi.yaml https://api.example.com/v1
```

```bash
# Example requests to the Prism mock server
# Get user list
curl http://localhost:4010/users?page=1&per_page=10

# Create user
curl -X POST http://localhost:4010/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "email": "test@example.com"}'

# Check validation error
curl -X POST http://localhost:4010/users \
  -H "Content-Type: application/json" \
  -d '{"name": ""}'
# → Returns 422 Validation Error

# Specify a particular response example
curl http://localhost:4010/users \
  -H "Prefer: example=empty_list"
```

### 4.2 MSW (Mock Service Worker)

```typescript
// msw/handlers.ts - Mock handlers for frontend development
import { http, HttpResponse, delay } from 'msw';

// Mock data based on OpenAPI spec
const mockUsers = [
  {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Taro Tanaka',
    email: 'tanaka@example.com',
    role: 'admin',
    status: 'active',
    createdAt: '2024-01-15T09:00:00Z',
    updatedAt: '2024-06-01T12:00:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Hanako Yamada',
    email: 'yamada@example.com',
    role: 'user',
    status: 'active',
    createdAt: '2024-02-20T10:30:00Z',
    updatedAt: '2024-05-15T08:00:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Jiro Sato',
    email: 'sato@example.com',
    role: 'moderator',
    status: 'inactive',
    createdAt: '2024-03-10T14:00:00Z',
    updatedAt: null,
  },
];

export const handlers = [
  // User list
  http.get('https://api.example.com/v1/users', async ({ request }) => {
    await delay(200); // Simulate realistic latency

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const perPage = parseInt(url.searchParams.get('per_page') || '20');
    const search = url.searchParams.get('search');
    const role = url.searchParams.get('role');

    let filtered = [...mockUsers];

    // Filtering
    if (search) {
      filtered = filtered.filter(u =>
        u.name.includes(search) || u.email.includes(search)
      );
    }
    if (role) {
      filtered = filtered.filter(u => u.role === role);
    }

    // Pagination
    const total = filtered.length;
    const start = (page - 1) * perPage;
    const paged = filtered.slice(start, start + perPage);

    return HttpResponse.json({
      data: paged,
      meta: {
        total,
        page,
        per_page: perPage,
        total_pages: Math.ceil(total / perPage),
      },
      links: {
        self: `/users?page=${page}&per_page=${perPage}`,
        first: `/users?page=1&per_page=${perPage}`,
        last: `/users?page=${Math.ceil(total / perPage)}&per_page=${perPage}`,
        prev: page > 1 ? `/users?page=${page - 1}&per_page=${perPage}` : null,
        next: page < Math.ceil(total / perPage)
          ? `/users?page=${page + 1}&per_page=${perPage}`
          : null,
      },
    });
  }),

  // Create user
  http.post('https://api.example.com/v1/users', async ({ request }) => {
    await delay(300);

    const body = await request.json() as { name: string; email: string; role?: string };

    // Validation
    if (!body.name || body.name.length === 0) {
      return HttpResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 422,
          detail: 'There are errors in the input data',
          errors: [
            { field: 'name', message: 'Name is required', code: 'required' },
          ],
        },
        { status: 422 }
      );
    }

    // Duplicate check
    if (mockUsers.some(u => u.email === body.email)) {
      return HttpResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: 'This email address is already in use',
        },
        { status: 409 }
      );
    }

    const newUser = {
      id: crypto.randomUUID(),
      name: body.name,
      email: body.email,
      role: body.role || 'user',
      status: 'active' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockUsers.push(newUser);

    return HttpResponse.json(
      { data: newUser },
      {
        status: 201,
        headers: {
          Location: `/users/${newUser.id}`,
        },
      }
    );
  }),

  // User detail
  http.get('https://api.example.com/v1/users/:userId', async ({ params }) => {
    await delay(150);

    const user = mockUsers.find(u => u.id === params.userId);
    if (!user) {
      return HttpResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'The specified user does not exist',
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({ data: user });
  }),

  // Delete user
  http.delete('https://api.example.com/v1/users/:userId', async ({ params }) => {
    await delay(200);

    const index = mockUsers.findIndex(u => u.id === params.userId);
    if (index === -1) {
      return HttpResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'The specified user does not exist',
        },
        { status: 404 }
      );
    }

    mockUsers.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // Authentication
  http.post('https://api.example.com/v1/auth/login', async ({ request }) => {
    await delay(500);

    const body = await request.json() as { email: string; password: string };

    if (body.email === 'admin@example.com' && body.password === 'password123') {
      return HttpResponse.json({
        access_token: 'mock-jwt-token-xxxxx',
        refresh_token: 'mock-refresh-token-xxxxx',
        expires_in: 3600,
        token_type: 'Bearer',
      });
    }

    return HttpResponse.json(
      {
        type: 'https://api.example.com/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Incorrect email address or password',
      },
      { status: 401 }
    );
  }),
];
```

```typescript
// msw/browser.ts - Setup for browser environment
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

// Setup in main.tsx
async function enableMocking() {
  if (import.meta.env.DEV) {
    const { worker } = await import('./msw/browser');
    return worker.start({
      onUnhandledRequest: 'warn',
    });
  }
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
```

```typescript
// msw/server.ts - Setup for test environment
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// vitest.setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### 4.3 Advanced Mocking with WireMock

```json
// wiremock/mappings/get-users.json
{
  "request": {
    "method": "GET",
    "urlPathPattern": "/v1/users",
    "queryParameters": {
      "page": {
        "matches": "[0-9]+"
      }
    }
  },
  "response": {
    "status": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "jsonBody": {
      "data": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "name": "Taro Tanaka",
          "email": "tanaka@example.com",
          "role": "admin"
        }
      ],
      "meta": {
        "total": 1,
        "page": 1,
        "per_page": 20,
        "total_pages": 1
      }
    }
  }
}
```

```json
// wiremock/mappings/create-user-validation-error.json
{
  "request": {
    "method": "POST",
    "urlPath": "/v1/users",
    "bodyPatterns": [
      {
        "matchesJsonPath": {
          "expression": "$.name",
          "absent": true
        }
      }
    ]
  },
  "response": {
    "status": 422,
    "headers": {
      "Content-Type": "application/json"
    },
    "jsonBody": {
      "type": "https://api.example.com/errors/validation",
      "title": "Validation Error",
      "status": 422,
      "errors": [
        {
          "field": "name",
          "message": "Name is required",
          "code": "required"
        }
      ]
    }
  },
  "priority": 1
}
```

```bash
# Start WireMock
docker run -d \
  --name wiremock \
  -p 8080:8080 \
  -v $(pwd)/wiremock:/home/wiremock \
  wiremock/wiremock:latest

# Verify operation
curl http://localhost:8080/v1/users?page=1
```

---

## 5. API Linting and Style Guide

### 5.1 Linting with Spectral

```yaml
# .spectral.yaml - API linting rules
extends:
  - spectral:oas

rules:
  # Custom rule: operationId naming convention
  operation-id-casing:
    given: "$.paths[*][*].operationId"
    then:
      function: casing
      functionOptions:
        type: camel
    severity: error
    message: "operationId must be written in camelCase"

  # Custom rule: responses should use a data wrapper
  response-data-wrapper:
    given: "$.paths[*][get,post,put,patch].responses[200,201].content.application/json.schema"
    then:
      field: properties.data
      function: truthy
    severity: warn
    message: "Responses should be wrapped in a data property"

  # Custom rule: error responses must follow RFC 7807 format
  error-response-format:
    given: "$.paths[*][*].responses[4XX,5XX].content.application/json.schema"
    then:
      - field: properties.type
        function: truthy
      - field: properties.title
        function: truthy
      - field: properties.status
        function: truthy
    severity: error
    message: "Error responses must follow RFC 7807 Problem Details format"

  # Custom rule: paths should use plural nouns
  path-plural-resource:
    given: "$.paths"
    then:
      function: pattern
      functionOptions:
        match: "^/[a-z]+s(/\\{[^}]+\\}(/[a-z]+s)?)*$"
    severity: warn
    message: "Resource paths should use plural nouns"

  # All endpoints must have tags
  operation-tag-defined:
    given: "$.paths[*][get,post,put,patch,delete]"
    then:
      field: tags
      function: length
      functionOptions:
        min: 1
    severity: error
    message: "All operations must have at least one tag"

  # Descriptions are required
  operation-description:
    given: "$.paths[*][get,post,put,patch,delete]"
    then:
      field: description
      function: truthy
    severity: warn
    message: "Operations should have a description"

  # Security definition check
  security-defined:
    given: "$"
    then:
      field: security
      function: truthy
    severity: error
    message: "Please define global security"

  # Property name casing
  property-casing:
    given: "$.components.schemas[*].properties[*]~"
    then:
      function: casing
      functionOptions:
        type: camel
    severity: error
    message: "Property names must be written in camelCase"
```

```bash
# Run Spectral
npx @stoplight/spectral-cli lint openapi.yaml

# Example output:
# openapi.yaml
#  45:17  warning  operation-description   Operations should have a description  paths./users.get
#  78:21  error    operation-id-casing     operationId must be written in camelCase  paths./users.post
#
# ✖ 2 problems (1 error, 1 warning, 0 infos, 0 hints)
```

### 5.2 Defining the Organization's API Style Guide

```yaml
# api-style-guide.yaml - Organization-wide API style guide
extends:
  - spectral:oas
  - .spectral.yaml  # Project-specific rules

rules:
  # === Naming Conventions ===
  # URLs should use kebab-case
  paths-kebab-case:
    given: "$.paths[*]~"
    then:
      function: pattern
      functionOptions:
        match: "^(/[a-z][a-z0-9-]*(/\\{[a-zA-Z]+\\})?)+$"
    severity: error

  # === Versioning ===
  # URLs must include a version
  path-version:
    given: "$.servers[*].url"
    then:
      function: pattern
      functionOptions:
        match: "/v[0-9]+"
    severity: error
    message: "Server URLs must include a version (e.g. /v1)"

  # === Pagination ===
  # Pagination is required for GET list endpoints
  pagination-required:
    given: "$.paths[*].get.parameters"
    then:
      function: schema
      functionOptions:
        schema:
          type: array
          contains:
            type: object
            properties:
              name:
                const: page
    severity: warn
    message: "List endpoints should include a page parameter"

  # === Security ===
  # HTTPS only
  https-only:
    given: "$.servers[*].url"
    then:
      function: pattern
      functionOptions:
        match: "^https://|^http://localhost"
    severity: error
    message: "Use HTTPS in production environments"

  # === Responses ===
  # Schema definition required for successful responses
  response-schema-required:
    given: "$.paths[*][*].responses[2XX].content.application/json"
    then:
      field: schema
      function: truthy
    severity: error
```

---

## 6. Contract Testing

### 6.1 Consumer-Driven Contract Testing with Pact

```typescript
// consumer/tests/user-api.pact.spec.ts
import { PactV4, MatchersV3 } from '@pact-foundation/pact';
import { UserApiClient } from '../src/api/user-client';

const { like, eachLike, uuid, iso8601DateTimeWithMillis } = MatchersV3;

const provider = new PactV4({
  consumer: 'FrontendApp',
  provider: 'UserService',
  dir: './pacts',
});

describe('User API Contract', () => {
  describe('GET /users', () => {
    it('can retrieve a list of users', async () => {
      await provider
        .addInteraction()
        .given('3 users exist')
        .uponReceiving('request to get user list')
        .withRequest('GET', '/v1/users', (builder) => {
          builder.query({ page: '1', per_page: '20' });
          builder.headers({ Authorization: 'Bearer valid-token' });
        })
        .willRespondWith(200, (builder) => {
          builder.headers({ 'Content-Type': 'application/json' });
          builder.jsonBody({
            data: eachLike({
              id: uuid(),
              name: like('Taro Tanaka'),
              email: like('tanaka@example.com'),
              role: like('user'),
              status: like('active'),
              createdAt: iso8601DateTimeWithMillis(),
            }),
            meta: {
              total: like(3),
              page: like(1),
              per_page: like(20),
              total_pages: like(1),
            },
          });
        })
        .executeTest(async (mockServer) => {
          const client = new UserApiClient(mockServer.url);
          const result = await client.listUsers({ page: 1, perPage: 20 });

          expect(result.data).toHaveLength(1);
          expect(result.meta.total).toBe(3);
        });
    });

    it('can create a user', async () => {
      await provider
        .addInteraction()
        .uponReceiving('request to create user')
        .withRequest('POST', '/v1/users', (builder) => {
          builder.headers({
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-token',
          });
          builder.jsonBody({
            name: 'Hanako Yamada',
            email: 'yamada@example.com',
          });
        })
        .willRespondWith(201, (builder) => {
          builder.headers({
            'Content-Type': 'application/json',
            Location: like('/users/550e8400-e29b-41d4-a716-446655440000'),
          });
          builder.jsonBody({
            data: {
              id: uuid(),
              name: 'Hanako Yamada',
              email: 'yamada@example.com',
              role: 'user',
              status: 'active',
              createdAt: iso8601DateTimeWithMillis(),
            },
          });
        })
        .executeTest(async (mockServer) => {
          const client = new UserApiClient(mockServer.url);
          const result = await client.createUser({
            name: 'Hanako Yamada',
            email: 'yamada@example.com',
          });

          expect(result.data.name).toBe('Hanako Yamada');
          expect(result.data.email).toBe('yamada@example.com');
        });
    });
  });
});
```

```typescript
// provider/tests/user-api.pact-provider.spec.ts
import { Verifier } from '@pact-foundation/pact';
import { app } from '../src/app';

describe('Provider Verification', () => {
  let server: any;

  beforeAll(async () => {
    server = app.listen(3001);
  });

  afterAll(() => server.close());

  it('satisfies the Pact contract', async () => {
    const verifier = new Verifier({
      providerBaseUrl: 'http://localhost:3001',
      pactUrls: ['./pacts/FrontendApp-UserService.json'],
      // Or fetch from Pact Broker
      // pactBrokerUrl: 'https://pact-broker.example.com',
      // providerVersion: process.env.GIT_SHA,
      stateHandlers: {
        '3 users exist': async () => {
          // Set up test data
          await seedTestUsers(3);
        },
      },
      requestFilter: (req, res, next) => {
        // Add Auth header for testing
        req.headers['authorization'] = 'Bearer test-token';
        next();
      },
    });

    await verifier.verifyProvider();
  });
});
```

### 6.2 Property-Based Testing with Schemathesis

```bash
# Schemathesis: Auto-generate tests from OpenAPI spec
pip install schemathesis

# Run basic tests
schemathesis run http://localhost:3000/v1/openapi.yaml

# Detailed options
schemathesis run http://localhost:3000/v1/openapi.yaml \
  --checks all \
  --hypothesis-max-examples 100 \
  --auth "Bearer test-token" \
  --base-url http://localhost:3000/v1 \
  --workers 4

# Test specific endpoints only
schemathesis run http://localhost:3000/v1/openapi.yaml \
  --endpoint "/users" \
  --method GET

# Stateful testing (test API state transitions)
schemathesis run http://localhost:3000/v1/openapi.yaml \
  --stateful=links
```

```python
# Using Schemathesis as Python tests
import schemathesis

schema = schemathesis.from_url("http://localhost:3000/v1/openapi.yaml")

@schema.parametrize()
def test_api(case):
    """Auto tests based on OpenAPI spec"""
    response = case.call()
    case.validate_response(response)

# Test a specific endpoint
@schema.parametrize(endpoint="/users", method="POST")
def test_create_user(case):
    response = case.call()
    case.validate_response(response)

    if response.status_code == 201:
        data = response.json()
        assert "data" in data
        assert "id" in data["data"]

# Custom checks
@schema.parametrize()
def test_response_time(case):
    """Response time must be within 500ms"""
    import time
    start = time.time()
    response = case.call()
    elapsed = time.time() - start

    assert elapsed < 0.5, f"Response took {elapsed:.2f}s (max: 0.5s)"
    case.validate_response(response)
```

### 6.3 API Spec Testing with Dredd

```bash
# Install Dredd
npm install -D dredd

# Basic run
npx dredd openapi.yaml http://localhost:3000/v1

# Run with config file
npx dredd
```

```yaml
# dredd.yml
dry-run: false
hookfiles:
  - "./test/dredd-hooks.ts"
language: typescript
server: npm start
server-wait: 5
reporter:
  - apiary
  - html
output:
  - ./test-results/dredd-report.html
header:
  - "Authorization: Bearer test-token"
  - "Content-Type: application/json"
names: false
only: []
sorted: false
```

```typescript
// test/dredd-hooks.ts
import { Hooks } from 'dredd-hooks';
const hooks = new Hooks();

// Setup before tests
hooks.beforeAll((transactions, done) => {
  // Initialize test database
  console.log('Initializing test database...');
  done();
});

// Hooks for specific endpoints
hooks.before('Users > User Collection > List Users', (transaction, done) => {
  // Create test user in advance
  transaction.request.headers['Authorization'] = 'Bearer test-admin-token';
  done();
});

hooks.before('Users > User Resource > Create User', (transaction, done) => {
  // Adjust request body
  const body = JSON.parse(transaction.request.body);
  body.email = `test-${Date.now()}@example.com`;
  transaction.request.body = JSON.stringify(body);
  done();
});

// Post-response verification
hooks.after('Users > User Resource > Get User', (transaction, done) => {
  const body = JSON.parse(transaction.real.body);
  if (!body.data.id) {
    transaction.fail = 'Response missing user ID';
  }
  done();
});

// Skip certain endpoints
hooks.before('Admin > Admin Operations > Delete All Users', (transaction, done) => {
  transaction.skip = true;
  done();
});

export default hooks;
```

---

## 7. Documentation Generation

### 7.1 Redoc

```html
<!-- index.html - Display documentation with Redoc -->
<!DOCTYPE html>
<html>
<head>
  <title>User Management API - Documentation</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; }
  </style>
</head>
<body>
  <redoc spec-url='./openapi.yaml'
    hide-hostname
    expand-responses="200,201"
    required-props-first
    sort-props-alphabetically
    path-in-middle-panel
    theme='{
      "colors": {
        "primary": { "main": "#4f46e5" }
      },
      "typography": {
        "fontSize": "15px",
        "fontFamily": "Inter, sans-serif"
      },
      "sidebar": {
        "width": "280px"
      }
    }'
  ></redoc>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>
```

```bash
# Generate static HTML with Redoc
npx @redocly/cli build-docs openapi.yaml -o docs/index.html

# With custom theme
npx @redocly/cli build-docs openapi.yaml \
  -o docs/index.html \
  --theme.openapi.colors.primary.main="#4f46e5" \
  --theme.openapi.typography.fontSize="15px"
```

### 7.2 Swagger UI

```typescript
// Swagger UI setup with Express.js
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

const app = express();
const swaggerDocument = YAML.load('./openapi.yaml');

const options = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "User Management API",
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
  },
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, options));

// Swagger JSON endpoint
app.get('/api-docs.json', (req, res) => {
  res.json(swaggerDocument);
});
```

### 7.3 Scalar

```typescript
// Scalar - Modern API documentation UI
import { apiReference } from '@scalar/express-api-reference';

app.use('/docs', apiReference({
  spec: {
    url: '/api-docs.json',
  },
  theme: 'default',
  layout: 'modern',
  darkMode: true,
  customCss: `
    .darklight { display: none; }
  `,
}));
```

---

## 8. Design Review Checklist

### 8.1 Comprehensive Review Items

```
API Design Review Comprehensive Checklist:

━━━ Naming Conventions ━━━
□ Are resource names nouns in plural form? (/users, /orders, /products)
□ Are URLs in kebab-case? (/user-profiles)
□ Are property names consistently cased? (camelCase recommended)
□ Is operationId in camelCase?
□ Are enum values consistent? (snake_case recommended)
□ Are datetime field names unified? (createdAt/created_at)

━━━ HTTP Methods ━━━
□ GET: Data retrieval only, no side effects
□ POST: Resource creation, or non-idempotent operations
□ PUT: Full resource replacement (idempotent)
□ PATCH: Partial resource update
□ DELETE: Resource deletion (idempotent)
□ Is idempotency correct? (PUT/DELETE are idempotent)
□ Is safety correct? (GET/HEAD/OPTIONS are safe)

━━━ Status Codes ━━━
□ 200: Success (GET, PUT, PATCH)
□ 201: Created successfully (POST) + Location header
□ 204: Success, no response body (DELETE)
□ 400: Bad request
□ 401: Authentication error
□ 403: Authorization error (insufficient permissions)
□ 404: Resource not found
□ 409: Conflict (duplicate, etc.)
□ 422: Validation error
□ 429: Rate limit exceeded + Retry-After header
□ 500: Internal server error

━━━ Response Design ━━━
□ Are error responses unified? (RFC 7807 recommended)
□ Do list responses include pagination info?
□ Is the data wrapper in responses consistent?
□ Are nullable fields explicitly marked?
□ Are datetimes in ISO 8601 format?
□ Are IDs in UUID format?

━━━ Security ━━━
□ Is the authentication method defined?
□ Is input validation defined? (minLength, maxLength, pattern)
□ Is rate limiting considered?
□ Is CORS configured appropriately?
□ Are sensitive data excluded from URLs?
□ Are proper permission checks in place?

━━━ Compatibility ━━━
□ Are there no breaking changes?
□ Are optional field additions backward-compatible?
□ Is the versioning strategy decided?
□ Are deprecated endpoints marked as Deprecated?
□ Is the Sunset header set?

━━━ Performance ━━━
□ Are high-volume endpoints paginated?
□ Are include/expand parameters available to avoid N+1 problems?
□ Is a caching strategy considered? (ETag, Cache-Control)
□ Is there a fields parameter to filter unnecessary data?

━━━ Documentation ━━━
□ Do all endpoints have a summary?
□ Are there examples for requests/responses?
□ Are error cases documented?
□ Is the authentication method explained?
□ Is the rate limit explained?
```

### 8.2 Design Review Process

```
API Design Review Workflow:

Step 1: Design Proposal
───────────────────
  - Developer creates a PR with the OpenAPI spec
  - PR description includes the API's purpose and use cases
  - Reasons for spec changes are clearly stated

Step 2: Automated Checks (CI)
───────────────────
  - Linting with Spectral
  - Breaking change detection
  - Type definition generation test
  - Mock server startup test

Step 3: Human Review
───────────────────
  - API architect or tech lead
  - Security engineer (for auth/authorization)
  - Frontend developer (to check usability)
  - Checklist-based review

Step 4: Incorporate Feedback
───────────────────
  - Revisions based on review comments
  - Re-run automated checks

Step 5: Approval and Merge
───────────────────
  - Minimum 2 approvals required
  - All CI checks pass
  - Auto-registration in API catalog
```

---

## 9. Introduction Steps for Real-World Projects

### 9.1 Phased Adoption Plan

```
Phase 1: Foundation (1-2 weeks)
─────────────────────────────
  □ Create OpenAPI spec template
  □ Initial Spectral rule setup
  □ Add linting to CI/CD pipeline
  □ OpenAPI training for the team
  □ Select and introduce toolchain

  Deliverables:
  - .spectral.yaml
  - openapi-template.yaml
  - CI config files
  - Training materials

Phase 2: Pilot Project (2-4 weeks)
─────────────────────────────────────
  □ Design one new API with API First
  □ Utilize mock servers
  □ Introduce code generation
  □ Practice parallel development
  □ Retrospective and process improvement

  Deliverables:
  - Pilot API spec
  - Code generation config
  - MSW handlers
  - Retrospective report

Phase 3: Rollout (4-8 weeks)
─────────────────────────────
  □ Document existing APIs in OpenAPI
  □ Apply API First to all new APIs
  □ Introduce Contract Testing
  □ Build API catalog
  □ Establish style guide

  Deliverables:
  - Existing API specs
  - API catalog
  - API style guide
  - Contract test suite

Phase 4: Maturation (ongoing)
─────────────────────────────
  □ Automatic breaking change detection
  □ Auto-generate and publish SDKs
  □ Collect API metrics
  □ Regular style guide updates
  □ Share API design knowledge

  Deliverables:
  - Automated CI/CD pipeline
  - Metrics dashboard
  - Knowledge base
```

### 9.2 Project Structure Template

```
project/
├── api/
│   ├── openapi.yaml          # API spec (root)
│   ├── paths/                 # Path definitions
│   ├── schemas/               # Schema definitions
│   ├── parameters/            # Parameter definitions
│   ├── responses/             # Response definitions
│   └── examples/              # Response examples
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── types.ts       # ← Auto-generated
│   │   │   ├── client.ts      # ← Auto-generated
│   │   │   └── custom-fetch.ts
│   │   └── msw/
│   │       ├── handlers.ts    # Mock handlers
│   │       ├── browser.ts
│   │       └── server.ts
│   └── orval.config.ts
├── backend/
│   ├── api/
│   │   └── api.gen.go         # ← Auto-generated
│   └── internal/
│       └── handler/
│           └── user.go        # Handler implementation
├── tests/
│   ├── contract/
│   │   ├── consumer.spec.ts   # Consumer contract tests
│   │   └── provider.spec.ts   # Provider verification tests
│   └── pacts/                 # Generated Pact files
├── docs/
│   └── index.html             # ← Auto-generated by Redoc
├── .spectral.yaml             # Linting rules
├── .github/
│   └── workflows/
│       ├── api-lint.yml       # API spec linting
│       ├── api-codegen.yml    # Code generation
│       └── api-docs.yml       # Documentation generation
└── Makefile
```

```makefile
# Makefile - API development tasks
.PHONY: api-lint api-bundle api-mock api-codegen api-docs api-test

# Lint the API spec
api-lint:
	npx @stoplight/spectral-cli lint api/openapi.yaml
	npx @redocly/cli lint api/openapi.yaml

# Bundle API spec (merge split files)
api-bundle:
	npx @redocly/cli bundle api/openapi.yaml -o dist/openapi.yaml

# Start mock server
api-mock:
	npx @stoplight/prism-cli mock api/openapi.yaml --port 4010

# Code generation
api-codegen: api-bundle
	npx openapi-typescript dist/openapi.yaml -o frontend/src/api/types.ts
	cd frontend && npx orval

# Generate documentation
api-docs: api-bundle
	npx @redocly/cli build-docs dist/openapi.yaml -o docs/index.html

# Contract Test
api-test:
	cd tests/contract && npm test

# Detect breaking changes
api-breaking:
	npx @opticdev/optic diff api/openapi.yaml --base origin/main --check

# Run all tasks
api-all: api-lint api-bundle api-codegen api-docs api-test
```

### 9.3 package.json Script Configuration

```json
{
  "name": "user-management-api",
  "scripts": {
    "api:lint": "spectral lint api/openapi.yaml",
    "api:bundle": "redocly bundle api/openapi.yaml -o dist/openapi.yaml",
    "api:mock": "prism mock api/openapi.yaml --port 4010",
    "api:mock:dynamic": "prism mock api/openapi.yaml --port 4010 --dynamic",
    "api:codegen": "openapi-typescript api/openapi.yaml -o src/api/types.ts && orval",
    "api:codegen:watch": "openapi-typescript api/openapi.yaml -o src/api/types.ts --watch",
    "api:docs": "redocly build-docs api/openapi.yaml -o docs/index.html",
    "api:docs:preview": "redocly preview-docs api/openapi.yaml",
    "api:breaking": "optic diff api/openapi.yaml --base origin/main --check",
    "api:test": "schemathesis run http://localhost:3000/v1/openapi.yaml --checks all",
    "api:validate": "redocly lint api/openapi.yaml && spectral lint api/openapi.yaml",
    "precommit:api": "npm run api:lint && npm run api:codegen",
    "dev": "concurrently \"npm run api:mock\" \"npm run dev:frontend\" \"npm run dev:backend\"",
    "dev:frontend": "vite",
    "dev:backend": "go run ./cmd/server"
  },
  "devDependencies": {
    "@stoplight/prism-cli": "^5.8.0",
    "@stoplight/spectral-cli": "^6.11.0",
    "@redocly/cli": "^1.25.0",
    "@opticdev/optic": "^0.54.0",
    "openapi-typescript": "^7.4.0",
    "orval": "^7.1.0",
    "swagger-ui-express": "^5.0.0",
    "concurrently": "^9.0.0"
  }
}
```

---

## 10. Advanced Patterns

### 10.1 Integration with API Gateway

```yaml
# Kong Gateway declarative configuration (generated from OpenAPI)
_format_version: "3.0"

services:
  - name: user-service
    url: http://user-service:3000
    routes:
      - name: users-list
        paths:
          - /v1/users
        methods:
          - GET
          - POST
        plugins:
          - name: rate-limiting
            config:
              minute: 100
              policy: redis
          - name: jwt
            config:
              claims_to_verify:
                - exp
          - name: request-validator
            config:
              body_schema: '{"type":"object","required":["name","email"]}'

  - name: auth-service
    url: http://auth-service:3001
    routes:
      - name: auth-login
        paths:
          - /v1/auth/login
        methods:
          - POST
        plugins:
          - name: rate-limiting
            config:
              minute: 10
              policy: redis
```

```typescript
// Script to generate API Gateway config from OpenAPI
import { parse } from 'yaml';
import { readFileSync, writeFileSync } from 'fs';

interface OpenAPISpec {
  paths: Record<string, Record<string, any>>;
  components: {
    securitySchemes: Record<string, any>;
  };
}

function generateGatewayConfig(spec: OpenAPISpec) {
  const services: any[] = [];

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
        const tag = operation.tags?.[0] || 'default';

        let service = services.find(s => s.name === `${tag}-service`);
        if (!service) {
          service = {
            name: `${tag}-service`,
            url: `http://${tag}-service:3000`,
            routes: [],
          };
          services.push(service);
        }

        const route = {
          name: operation.operationId,
          paths: [path.replace(/{(\w+)}/g, ':$1')],
          methods: [method.toUpperCase()],
          plugins: [],
        };

        // Security configuration
        if (operation.security !== undefined) {
          if (operation.security.length > 0) {
            route.plugins.push({
              name: 'jwt',
              config: { claims_to_verify: ['exp'] },
            });
          }
        }

        // Rate limiting
        route.plugins.push({
          name: 'rate-limiting',
          config: { minute: 100, policy: 'redis' },
        });

        service.routes.push(route);
      }
    }
  }

  return { _format_version: '3.0', services };
}

const spec = parse(readFileSync('openapi.yaml', 'utf-8'));
const config = generateGatewayConfig(spec);
writeFileSync('kong.yaml', JSON.stringify(config, null, 2));
```

### 10.2 API First in Microservices

```
API First operations in microservice architecture:

┌──────────────────────────────────────────────┐
│                API Registry                   │
│  (Centrally manages OpenAPI specs for all     │
│   services)                                   │
│                                               │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ User API│ │Order API│ │Payment  │  ...    │
│  │  v1.2.0 │ │  v2.0.0 │ │ API v1  │        │
│  └─────────┘ └─────────┘ └─────────┘        │
└──────────────────────────────────────────────┘
         ↓              ↓             ↓
┌────────────┐  ┌────────────┐  ┌────────────┐
│ User       │  │ Order      │  │ Payment    │
│ Service    │←→│ Service    │←→│ Service    │
│            │  │            │  │            │
│ ・Define   │  │ ・Reference│  │ ・Practice │
│   spec     │  │   dependent│  │   Contract │
│   first    │  │   spec     │  │   Testing  │
│ ・Publish  │  │ ・Generate │  │ ・Detect   │
│   Contract │  │   type-safe│  │   Breaking │
│   Tests    │  │   client   │  │   Changes  │
│ ・Provide  │  │            │  │            │
│   Mock     │  │            │  │            │
└────────────┘  └────────────┘  └────────────┘
```

```yaml
# Spec definition for inter-service communication
# order-service/api/internal/user-client.yaml
# (Reference the necessary parts of the User Service spec)
openapi: '3.1.0'
info:
  title: User Service Client (subset used by Order Service)
  version: '1.0.0'

paths:
  /users/{userId}:
    get:
      operationId: getUser
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      id:
                        type: string
                        format: uuid
                      name:
                        type: string
                      email:
                        type: string
                        format: email
```

### 10.3 Event-Driven API Design

```yaml
# AsyncAPI specification (event-driven API)
asyncapi: '2.6.0'
info:
  title: User Events API
  version: '1.0.0'
  description: Async API spec for user-related events

channels:
  user.created:
    publish:
      operationId: onUserCreated
      summary: User created event
      message:
        name: UserCreatedEvent
        contentType: application/json
        payload:
          type: object
          required: [eventId, eventType, timestamp, data]
          properties:
            eventId:
              type: string
              format: uuid
            eventType:
              type: string
              const: user.created
            timestamp:
              type: string
              format: date-time
            data:
              type: object
              properties:
                userId:
                  type: string
                  format: uuid
                name:
                  type: string
                email:
                  type: string
                  format: email
        examples:
          - payload:
              eventId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
              eventType: "user.created"
              timestamp: "2024-06-01T12:00:00Z"
              data:
                userId: "550e8400-e29b-41d4-a716-446655440000"
                name: "Taro Tanaka"
                email: "tanaka@example.com"

  user.updated:
    publish:
      operationId: onUserUpdated
      summary: User updated event
      message:
        name: UserUpdatedEvent
        contentType: application/json
        payload:
          type: object
          required: [eventId, eventType, timestamp, data]
          properties:
            eventId:
              type: string
              format: uuid
            eventType:
              type: string
              const: user.updated
            timestamp:
              type: string
              format: date-time
            data:
              type: object
              properties:
                userId:
                  type: string
                  format: uuid
                changes:
                  type: object
                  additionalProperties: true

  user.deleted:
    publish:
      operationId: onUserDeleted
      summary: User deleted event
      message:
        name: UserDeletedEvent
        contentType: application/json
        payload:
          type: object
          properties:
            eventId:
              type: string
              format: uuid
            eventType:
              type: string
              const: user.deleted
            timestamp:
              type: string
              format: date-time
            data:
              type: object
              properties:
                userId:
                  type: string
                  format: uuid
                deletedAt:
                  type: string
                  format: date-time
```

### 10.4 API Lifecycle Management

```
API Lifecycle Phases:

┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│ Design  │ → │  Build  │ → │  Test   │ → │ Deploy  │ → │ Retire  │
└─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘
     │              │              │              │              │
     ▼              ▼              ▼              ▼              ▼
  OpenAPI       Code gen       Contract      Monitoring    Deprecation
  Spectral      Mock gen       Schemathesis  Metrics       Sunset Header
  Review        Type-safe      Pact          Alerts        Migration guide
                impl

Phase Details:

1. Design
   - Use case analysis
   - Create OpenAPI spec
   - Linting with Spectral
   - Design review (minimum 2 approvals)
   - Breaking change detection

2. Build
   - Code generation (types, client, server stubs)
   - Build mock server
   - Implement handlers
   - Conduct parallel development

3. Test
   - Contract Testing
   - Property-based Testing (Schemathesis)
   - Integration Testing
   - Performance Testing
   - Security Testing

4. Deploy
   - Publish documentation
   - Distribute SDKs
   - Collect metrics
   - Monitor error rates
   - SLA management

5. Retire
   - Mark as Deprecated
   - Add Sunset Header
   - Provide migration guide
   - Notify consumers
   - Gradual retirement
```

```typescript
// Implementation example for API deprecation
import express from 'express';

// Deprecation middleware
function deprecationMiddleware(
  sunsetDate: string,
  alternativeUrl: string,
) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(sunsetDate).toUTCString());
    res.setHeader('Link', `<${alternativeUrl}>; rel="successor-version"`);

    // Record in metrics
    metrics.counter('api.deprecated.usage', 1, {
      path: req.path,
      method: req.method,
      consumer: req.headers['x-consumer-id'] as string,
    });

    next();
  };
}

// Configure deprecated endpoint
app.get('/v1/users/search',
  deprecationMiddleware('2025-06-01', '/v2/users?search='),
  async (req, res) => {
    // Old implementation
    const results = await userService.search(req.query.q as string);
    res.json({ data: results });
  }
);
```

---

## 11. Troubleshooting

### 11.1 Common Problems and Solutions

```
Problem 1: Spec and code diverge
──────────────────────────
  Symptom: Implementation does not match the OpenAPI spec
  Cause: Manual implementation doesn't reflect spec changes
  Solution:
  - Automated validation with Dredd/Schemathesis in CI/CD
  - Use code generation to prevent divergence
  - Validate real API with Prism proxy mode

Problem 2: OpenAPI spec becomes bloated
──────────────────────────
  Symptom: A single file grows to thousands of lines and becomes unmanageable
  Cause: All definitions written in one file
  Solution:
  - Split files (paths/, schemas/, responses/)
  - Use $ref references
  - Merge with redocly bundle
  - Logical grouping by tags

Problem 3: Inaccurate types from code generation
──────────────────────────
  Symptom: Generated types handle nullable/optional incorrectly
  Cause: Incomplete nullable/required specifications in OpenAPI spec
  Solution:
  - Explicitly specify nullable fields
  - Accurate list of required fields
  - Snapshot tests for generated types

Problem 4: Mock and implementation mismatch
──────────────────────────
  Symptom: Works against mock but not against real API
  Cause: Mock is a custom implementation not based on the spec
  Solution:
  - Use Prism for spec-based mocks
  - Introduce Contract Testing
  - Add E2E tests

Problem 5: Missed breaking change detection
──────────────────────────
  Symptom: API changes break clients
  Cause: No automatic detection of breaking changes
  Solution:
  - Introduce Optic
  - Automated checks in CI
  - Semantic versioning
  - Auto-generate changelogs
```

### 11.2 Performance Considerations

```typescript
// Cache control for API responses
import express from 'express';

function cacheControl(maxAge: number, isPublic: boolean = false) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const directive = isPublic ? 'public' : 'private';
    res.setHeader('Cache-Control', `${directive}, max-age=${maxAge}`);
    next();
  };
}

// ETag-based conditional requests
function conditionalRequest() {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = (body: any) => {
      const etag = generateETag(JSON.stringify(body));
      res.setHeader('ETag', etag);

      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }

      return originalJson(body);
    };

    next();
  };
}

// User list with caching
app.get('/v1/users',
  cacheControl(60, false),  // 60-second private cache
  conditionalRequest(),
  async (req, res) => {
    const users = await userService.list(req.query);
    res.json({ data: users });
  }
);

// Static resources (long cache)
app.get('/v1/users/:id/avatar',
  cacheControl(86400, true),  // 24-hour public cache
  async (req, res) => {
    const avatar = await userService.getAvatar(req.params.id);
    res.type('image/png').send(avatar);
  }
);
```

---

## 12. Practical Exercises

### Exercise 1: Design an E-Commerce API

```
Requirements:
- CRUD for product catalog
- Cart management
- Order creation and retrieval
- User reviews

Tasks:
1. Design the OpenAPI spec
2. Configure Spectral rules
3. Start a mock server with Prism
4. Generate types with openapi-typescript
5. Create frontend mocks with MSW
```

```yaml
# Sample answer for Exercise 1 (product catalog section)
openapi: '3.1.0'
info:
  title: E-Commerce API
  version: '1.0.0'

paths:
  /products:
    get:
      operationId: listProducts
      tags: [Products]
      parameters:
        - name: page
          in: query
          schema: { type: integer, default: 1 }
        - name: per_page
          in: query
          schema: { type: integer, default: 20, maximum: 100 }
        - name: category
          in: query
          schema: { type: string }
        - name: min_price
          in: query
          schema: { type: number, minimum: 0 }
        - name: max_price
          in: query
          schema: { type: number, minimum: 0 }
        - name: sort
          in: query
          schema:
            type: string
            enum: [price_asc, price_desc, newest, popular]
      responses:
        '200':
          description: Product list
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Product'
                  meta:
                    $ref: '#/components/schemas/PaginationMeta'

  /products/{productId}:
    get:
      operationId: getProduct
      tags: [Products]
      parameters:
        - name: productId
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200':
          description: Product details
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/ProductDetail'

  /cart:
    get:
      operationId: getCart
      tags: [Cart]
      responses:
        '200':
          description: Cart contents
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/Cart'

    post:
      operationId: addToCart
      tags: [Cart]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [productId, quantity]
              properties:
                productId:
                  type: string
                  format: uuid
                quantity:
                  type: integer
                  minimum: 1
                  maximum: 99
      responses:
        '200':
          description: Added to cart successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/Cart'

  /orders:
    post:
      operationId: createOrder
      tags: [Orders]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [shippingAddressId, paymentMethodId]
              properties:
                shippingAddressId:
                  type: string
                  format: uuid
                paymentMethodId:
                  type: string
                  format: uuid
                note:
                  type: string
                  maxLength: 500
      responses:
        '201':
          description: Order created successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/Order'

components:
  schemas:
    Product:
      type: object
      properties:
        id: { type: string, format: uuid }
        name: { type: string }
        price: { type: number }
        currency: { type: string, default: "USD" }
        thumbnailUrl: { type: string, format: uri }
        category: { type: string }
        inStock: { type: boolean }

    ProductDetail:
      allOf:
        - $ref: '#/components/schemas/Product'
        - type: object
          properties:
            description: { type: string }
            images:
              type: array
              items: { type: string, format: uri }
            specifications:
              type: object
              additionalProperties: { type: string }
            averageRating: { type: number, minimum: 0, maximum: 5 }
            reviewCount: { type: integer }

    Cart:
      type: object
      properties:
        items:
          type: array
          items:
            type: object
            properties:
              product: { $ref: '#/components/schemas/Product' }
              quantity: { type: integer }
              subtotal: { type: number }
        totalItems: { type: integer }
        totalPrice: { type: number }

    Order:
      type: object
      properties:
        id: { type: string, format: uuid }
        status:
          type: string
          enum: [pending, confirmed, shipped, delivered, cancelled]
        items:
          type: array
          items:
            type: object
            properties:
              productId: { type: string, format: uuid }
              productName: { type: string }
              quantity: { type: integer }
              unitPrice: { type: number }
        totalPrice: { type: number }
        createdAt: { type: string, format: date-time }

    PaginationMeta:
      type: object
      properties:
        total: { type: integer }
        page: { type: integer }
        per_page: { type: integer }
        total_pages: { type: integer }
```

### Exercise 2: Refactoring an API Spec

```
Task: Improve the following existing API spec that has these problems

Problems in the spec:
- Error responses are not unified
- No pagination
- Authentication is not defined
- No operationId
- No examples
- Missing nullable specifications

Improvement points:
1. Define unified error responses in RFC 7807 format
2. Add pagination parameters and meta information
3. Add Bearer Token authentication
4. Assign operationId to all endpoints
5. Add examples for requests/responses
6. Add nullable: true to fields that require it
```

---

## FAQ

### Q1: When should I choose API First vs Code First?

The choice depends on the project's scale and characteristics. API First is effective when frontend and backend are developed in parallel by different teams, when there are multiple service integrations, or when long-term maintenance is expected. On the other hand, Code First is fine for small prototypes or speed-focused development by a single team. However, while API First requires upfront investment, it significantly reduces future refactoring costs, making it more efficient in the medium to long term.

### Q2: What are the differences between OpenAPI versions (2.0 vs 3.0 vs 3.1)?

OpenAPI 2.0 (formerly Swagger) is a 2014 legacy spec and is now deprecated. OpenAPI 3.0 (2017) added improved component reusability, multi-server support, and enhanced request body handling. OpenAPI 3.1 (2021) achieves full compatibility with JSON Schema 2020-12, adds webhook support, and enables more flexible schema definitions. For new projects, choose 3.1, and it is recommended to gradually migrate existing projects as well.

### Q3: Is API First design effective for small-scale projects?

It is fully effective even for small projects. The initial cost of writing an OpenAPI spec is a matter of a few hours, but development speed improves through type-safe code generation, automated testing, and automatic documentation generation. In particular, preventing misunderstandings between frontend and backend, and reducing rework, are major benefits even at small scale. Using tools like Stoplight Studio or Swagger Editor, you can create specs with a GUI, keeping the learning cost low.

---

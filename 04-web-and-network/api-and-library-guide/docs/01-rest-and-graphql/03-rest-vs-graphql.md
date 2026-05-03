# REST vs GraphQL

> A systematic comparison of the fundamental differences between REST and GraphQL, their respective strengths and weaknesses, and selection criteria. This guide provides practical decision-making guidelines covering everything from choosing the right approach based on project requirements through hybrid architectures — from the foundational design philosophies of each architecture, to performance characteristics, operational considerations, and use-case-specific selection guidance.

## What You Will Learn

- [ ] Understand the fundamental architectural differences between REST and GraphQL
- [ ] Grasp the differences in data-fetching patterns and their trade-offs
- [ ] Learn about performance characteristics and benchmarking perspectives
- [ ] Systematize selection criteria based on project requirements
- [ ] Master hybrid-approach design patterns
- [ ] Understand migration strategies and incremental adoption techniques
- [ ] Learn how to handle anti-patterns and edge cases

## Prerequisites

- REST API design principles and best practices → See: [REST Best Practices](./00-rest-best-practices.md)
- GraphQL fundamentals (Schema, Query, Mutation) → See: [GraphQL Fundamentals](./01-graphql-fundamentals.md)
- Advanced GraphQL features (Subscription, Federation) → See: [GraphQL Advanced](./02-graphql-advanced.md)

---

## 1. Fundamental Differences in Architectural Philosophy

REST (Representational State Transfer) and GraphQL take fundamentally different approaches to API design. To accurately understand their differences, it is necessary to understand the background and design philosophy from which each emerged.

### 1.1 REST Design Philosophy

REST is an architectural style proposed by Roy Fielding in his doctoral dissertation in 2000. It systematizes the principles that support the success of the Web, and is based on the following constraints.

```
The 6 Constraints of REST:

  ┌─────────────────────────────────────────────────────────────────┐
  │  1. Client-Server (Client-Server Separation)                    │
  │     → Separation of concerns allows independent evolution       │
  │                                                                 │
  │  2. Stateless                                                   │
  │     → Each request is self-contained; server holds no session   │
  │                                                                 │
  │  3. Cacheable                                                   │
  │     → Responses explicitly indicate whether they are cacheable  │
  │                                                                 │
  │  4. Uniform Interface                                           │
  │     → Resource identification, manipulation through             │
  │       representations, self-descriptive messages,               │
  │       HATEOAS (Hypermedia as the Engine of Application State)   │
  │                                                                 │
  │  5. Layered System                                              │
  │     → Transparent insertion of intermediary layers              │
  │       (proxies, gateways)                                       │
  │                                                                 │
  │  6. Code on Demand (optional)                                   │
  │     → Transfer of code from server to client                   │
  └─────────────────────────────────────────────────────────────────┘
```

The core of REST is "resource orientation." It views the world as resources (nouns) and manipulates them with HTTP methods (verbs). URIs are the identity of resources, and representations convey the state of resources.

### 1.2 GraphQL Design Philosophy

GraphQL was developed at Facebook (now Meta) in 2012 and open-sourced in 2015. It was created to solve the following challenges in mobile application development.

```
Problems GraphQL Solved:

  ┌─────────────────────────────────────────────────────────────────┐
  │  Problem 1: Over-fetching                                       │
  │  → Unwanted data on mobile consuming bandwidth                 │
  │                                                                 │
  │  Problem 2: Under-fetching                                      │
  │  → Multiple requests needed for data in a single screen        │
  │                                                                 │
  │  Problem 3: Endpoint explosion                                  │
  │  → Dedicated endpoints proliferating per client                │
  │                                                                 │
  │  Problem 4: Versioning hell                                     │
  │  → Management cost of v1, v2, v3, ...                          │
  │                                                                 │
  │  Problem 5: Tight coupling between frontend and backend        │
  │  → API changes required with every screen change               │
  └─────────────────────────────────────────────────────────────────┘
```

The core of GraphQL is "client-driven data fetching." The server exposes a data graph, and the client declaratively specifies the shape of the data it needs.

### 1.3 Architectural Model Comparison Diagram

```
REST Architecture Model:

  Client                     Server
  ┌──────┐                   ┌──────────────────────────┐
  │      │  GET /users/1     │  /users/:id      → UserController.show     │
  │      │ ──────────────→   │  /users/:id/posts → PostController.index   │
  │      │  GET /users/1/    │  /posts/:id       → PostController.show    │
  │      │      posts        │  /comments/:id    → CommentController.show │
  │      │ ──────────────→   │                                            │
  │      │  GET /posts/1/    │  Each endpoint represents an independent   │
  │      │      comments     │  resource and returns a fixed response     │
  │      │ ──────────────→   │  structure                                 │
  └──────┘                   └──────────────────────────────────────────┘
  3 requests                 3 endpoints


GraphQL Architecture Model:

  Client                     Server
  ┌──────┐                   ┌──────────────────────────┐
  │      │  POST /graphql    │  Schema (type definitions)│
  │      │  query {          │    ├── User              │
  │      │    user(id:1) {   │    │   ├── name          │
  │      │      name         │    │   └── posts         │
  │      │      posts {      │    ├── Post              │
  │      │        title      │    │   ├── title         │
  │      │        comments { │    │   └── comments      │
  │      │          body     │    └── Comment           │
  │      │        }          │        └── body          │
  │      │      }            │                          │
  │      │    }              │  Resolvers fetch and      │
  │      │  }                │  combine only the needed  │
  │      │ ──────────────→   │  data                     │
  └──────┘                   └──────────────────────────┘
  1 request                  1 endpoint
```

---

## 2. Basic Comparison Tables

The following tables provide a comprehensive comparison of the major characteristics of both approaches.

### Comparison Table 1: Technical Characteristics

| Aspect | REST | GraphQL |
|--------|------|---------|
| Endpoints | Multiple (one per resource) | Single (`/graphql`) |
| Data fetching | Server-determined (fixed structure) | Client-declared declaratively |
| Type system | None (supplemented by OpenAPI/JSON Schema) | Built-in (SDL: Schema Definition Language) |
| HTTP caching | Full use of standard HTTP caching mechanisms | Difficult (due to POST requests) |
| Learning cost | Low (HTTP knowledge sufficient) | Moderate (SDL, resolvers, client libraries) |
| Ecosystem | Very mature (20+ years of history) | Growing (since 2015) |
| File upload | Easy (multipart/form-data) | Complex (requires separate handling) |
| Real-time communication | WebSocket/SSE implemented separately | Subscription built in |
| Error handling | HTTP status codes (4xx, 5xx) | Always HTTP 200 + errors array |
| Testability | Instant testing with curl, etc. | Dedicated client (GraphiQL, etc.) recommended |
| Versioning | URL-based (/v1/, /v2/) or headers | Not needed (evolutionary schema additions) |
| Overhead | Low (HTTP methods only) | Query parsing and validation cost |
| Documentation | Generated via OpenAPI/Swagger UI | Schema itself serves as documentation |
| Code generation | Possible with OpenAPI Generator | Auto-generates type-safe clients via codegen |
| Authentication/Authorization | HTTP headers (standard) | HTTP headers + field-level authorization |

### Comparison Table 2: Operations and Organizational Aspects

| Aspect | REST | GraphQL |
|--------|------|---------|
| Team structure | Backend-centric | Frontend-backend collaboration |
| API design process | Endpoint design (URL design) | Schema design (types and relations) |
| Monitoring | Clear per-endpoint | Complex per-query |
| Rate limiting | Easy per-request | Requires query complexity-based approach |
| Security | Per-endpoint access control | Per-field authorization needed |
| CDN integration | Standard support | Persisted Queries + APQ |
| Log analysis | Easy classification by URL path | Requires query analysis |
| SLA definition | Clear per-endpoint | Needs definition by query pattern |
| Gradual rollout | Per-endpoint | Per-field @deprecated directive |
| Third-party integration | Widely accepted | Limited compatible services |

---

## 3. Detailed Comparison of Data Fetching Patterns

### 3.1 Over-fetching and Under-fetching

The most notable difference between REST and GraphQL lies in data-fetching patterns.

```typescript
// ====================================================================
// Code Example 1: Data fetching for a user dashboard screen
// ====================================================================

// --- Implementation with REST ---
// Information to display: user name, last 5 orders, product name per order

// Request 1: Fetch user information
// GET /api/v1/users/123
const userResponse = await fetch('/api/v1/users/123');
const user = await userResponse.json();
// Response (includes unnecessary fields = Over-fetching):
// {
//   "id": "123",
//   "name": "Tanaka Taro",
//   "email": "tanaka@example.com",
//   "avatar": "https://cdn.example.com/avatars/123.jpg",  ← not needed
//   "address": "Tokyo, Japan",                             ← not needed
//   "phone": "+81-90-1234-5678",                           ← not needed
//   "preferences": { ... },                                ← not needed
//   "createdAt": "2024-01-15T10:30:00Z"                    ← not needed
// }

// Request 2: Fetch order list (Under-fetching: separate request required)
// GET /api/v1/users/123/orders?limit=5&sort=-createdAt
const ordersResponse = await fetch(
  '/api/v1/users/123/orders?limit=5&sort=-createdAt'
);
const orders = await ordersResponse.json();
// Response:
// [
//   { "id": "ord-001", "total": 15000, "status": "delivered", ... },
//   { "id": "ord-002", "total": 8500, "status": "shipped", ... },
//   ...
// ]

// Requests 3–7: Product details for each order (N+1 problem)
const orderDetails = await Promise.all(
  orders.map(order =>
    fetch(`/api/v1/orders/${order.id}/items`).then(r => r.json())
  )
);
// Total requests: 2 + N (number of orders) = up to 7 requests


// --- Implementation with GraphQL ---
// Fetch only the needed data in a single request
const DASHBOARD_QUERY = `
  query UserDashboard($userId: ID!) {
    user(id: $userId) {
      name
      email
      orders(first: 5, orderBy: CREATED_AT_DESC) {
        edges {
          node {
            id
            total
            status
            items {
              productName
              price
              quantity
            }
          }
        }
      }
    }
  }
`;

const result = await graphqlClient.query({
  query: DASHBOARD_QUERY,
  variables: { userId: '123' }
});
// Total requests: 1
// Response contains only the specified fields
```

### 3.2 Strategies for Mitigating Over-fetching in REST

There are techniques to reduce over-fetching and under-fetching in REST as well. However, these approaches partially reinvent features that GraphQL provides natively.

```typescript
// ====================================================================
// Code Example 2: Data-fetching optimization patterns in REST
// ====================================================================

// Pattern A: Field selection (Sparse Fieldsets)
// GET /api/v1/users/123?fields=name,email
// → Standardized approach in the JSON:API specification
const user = await fetch('/api/v1/users/123?fields=name,email');
// Benefit: Reduces over-fetching
// Drawback: Requires server-side field filtering implementation
//           Nested resource field selection becomes complex

// Pattern B: Resource embedding (Embedding / Include)
// GET /api/v1/users/123?include=orders,orders.items
// → The include parameter from JSON:API
const userWithOrders = await fetch(
  '/api/v1/users/123?include=orders,orders.items'
);
// Benefit: Reduces under-fetching (related resources in one request)
// Drawback: Complex server-side implementation
//           Managing depth limits for includes

// Pattern C: Dedicated endpoint (View / Projection)
// GET /api/v1/users/123/dashboard-summary
const summary = await fetch('/api/v1/users/123/dashboard-summary');
// Benefit: Response optimized for the client
// Drawback: Endpoints proliferate per screen
//           → Rise of the BFF (Backend for Frontend) pattern

// Pattern D: OData query options
// GET /api/v1/users?$select=name,email&$expand=orders($top=5)
const odataResult = await fetch(
  '/api/v1/users?$select=name,email&$expand=orders($top=5)'
);
// Benefit: Standardized query language
// Drawback: Complexity of OData spec, learning cost

// Pattern E: Custom query parameters
// GET /api/v1/users/123?view=detailed&depth=2
const detailedUser = await fetch(
  '/api/v1/users/123?view=detailed&depth=2'
);
// Benefit: Simple to implement
// Drawback: Non-standard, different rules per API
```

### 3.3 Comparison of Mutation (Data Update)

```typescript
// ====================================================================
// Code Example 3: Comparison of data update operations
// ====================================================================

// --- Updates with REST ---

// Full update (PUT)
// PUT /api/v1/users/123
await fetch('/api/v1/users/123', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Tanaka Jiro',
    email: 'jiro@example.com',
    address: 'Osaka, Japan',
    phone: '+81-90-9876-5432'
    // All fields must be sent
  })
});

// Partial update (PATCH)
// PATCH /api/v1/users/123
await fetch('/api/v1/users/123', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/merge-patch+json' },
  body: JSON.stringify({
    name: 'Tanaka Jiro'
    // Only the fields to change
  })
});

// Simultaneous updates to multiple resources are non-standard
// → Requires a custom batch endpoint
// POST /api/v1/batch
await fetch('/api/v1/batch', {
  method: 'POST',
  body: JSON.stringify({
    operations: [
      { method: 'PATCH', path: '/users/123', body: { name: 'New Name' } },
      { method: 'POST', path: '/notifications', body: { ... } }
    ]
  })
});


// --- Updates with GraphQL ---

// Single Mutation
const UPDATE_USER = `
  mutation UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      user {
        id
        name
        email
        updatedAt
      }
      errors {
        field
        message
      }
    }
  }
`;

await graphqlClient.mutate({
  mutation: UPDATE_USER,
  variables: {
    input: {
      id: '123',
      name: 'Tanaka Jiro'
    }
  }
});
// Benefit: Updated data can be retrieved in the same request
// Benefit: Validation errors are structured in the errors field

// Multiple operations executed simultaneously (natively supported)
const BATCH_MUTATION = `
  mutation BatchUpdate($userInput: UpdateUserInput!, $notif: CreateNotificationInput!) {
    updateUser(input: $userInput) {
      user { id name }
    }
    createNotification(input: $notif) {
      notification { id }
    }
  }
`;
// → Multiple Mutations executed in a single request
// → However, each Mutation executes sequentially (not in parallel)
```

---

## 4. Performance Comparison

From a performance perspective, REST and GraphQL each have different characteristics. It cannot simply be said that one is "faster" than the other — the advantages and disadvantages vary depending on the use case.

### 4.1 Latency Characteristics

```
Latency Comparison (Typical Scenarios):

Scenario 1: Retrieving a single resource (user info only)
──────────────────────────────────────────────────
  REST:   Client ──GET /users/1──→ Server ──→ DB
          Total: 1 network round trip + 1 DB query
          On CDN cache hit: a few ms (fastest)

  GraphQL: Client ──POST /graphql──→ Parse → Validate → Execute → DB
           Total: 1 network round trip + parsing cost + 1 DB query
           CDN caching: difficult (due to POST)

  Conclusion: Single resource → REST has the advantage (especially with CDN caching)


Scenario 2: Fetching related resources (user + orders + products)
──────────────────────────────────────────────────
  REST:   Client ──GET /users/1──→ Server
          Client ──GET /users/1/orders──→ Server
          Client ──GET /orders/1/items──→ Server
          Client ──GET /orders/2/items──→ Server
          Total: 4 network round trips (sequential)

  GraphQL: Client ──POST /graphql──→ Parse → Validate → Execute
           → DB(user) + DB(orders) + DB(items) ← batched by DataLoader
           Total: 1 network round trip + several DB queries (parallelizable)

  Conclusion: Related data → GraphQL has the advantage (fewer round trips)


Scenario 3: High-traffic environment (1,000 req/sec)
──────────────────────────────────────────────────
  REST:   Offload most traffic with CDN caching
          Fine-grained control with Cache-Control headers
          Cache hit rate of 80%+ achievable

  GraphQL: Cache efficiency drops due to query variety
           Can be improved with Persisted Queries
           APQ (Automatic Persisted Queries) reduces operational burden

  Conclusion: High traffic + simple data → REST has the advantage
```

### 4.2 Payload Size Comparison

```
Payload Size Comparison:

Data needed on a user dashboard screen:
  → Username, email address, title and amount for 5 orders

REST response (with over-fetching):
  ┌──────────────────────────────────┐
  │ User response:           ~800B   │  ← Contains avatar, address, phone,
  │   id, name, email, avatar,      │     preferences, etc. beyond name
  │   address, phone, preferences,  │     and email
  │   createdAt, updatedAt, ...     │
  ├──────────────────────────────────┤
  │ Orders response:        ~2000B   │  ← All fields for each order
  │   [{id, total, status,          │
  │     shippingAddress, items,     │
  │     createdAt, ...}, ...]       │
  ├──────────────────────────────────┤
  │ Total: ~2800B + HTTP headers ×2 │
  └──────────────────────────────────┘

GraphQL response (only the required data):
  ┌──────────────────────────────────┐
  │ { "data": {                      │
  │     "user": {                    │
  │       "name": "Tanaka",          │
  │       "email": "t@example.com",  │
  │       "orders": [                │
  │         {"title":"..","total":..}│
  │       ]                          │
  │     }                            │
  │   }                              │
  │ }                                │
  ├──────────────────────────────────┤
  │ Total: ~600B + HTTP headers ×1  │
  └──────────────────────────────────┘

  Difference: REST transfers approximately 4.7× more data
  → Especially impactful in low-bandwidth environments (mobile networks)
```

### 4.3 Server-Side Performance Considerations

```typescript
// ====================================================================
// Code Example 4: The N+1 problem in GraphQL and solving it with DataLoader
// ====================================================================

// Resolver that causes the N+1 problem (anti-pattern)
const resolvers = {
  Query: {
    users: () => db.query('SELECT * FROM users LIMIT 10')
    // → 1 query
  },
  User: {
    orders: (user) => db.query('SELECT * FROM orders WHERE user_id = ?', [user.id])
    // → 1 query per user = 10 queries
    // Total: 1 + 10 = 11 queries (N+1 problem)
  }
};

// Solution using DataLoader
import DataLoader from 'dataloader';

const ordersByUserLoader = new DataLoader(async (userIds: string[]) => {
  // Batch query: fetch all users' orders in a single SQL call
  const orders = await db.query(
    'SELECT * FROM orders WHERE user_id IN (?)',
    [userIds]
  );
  // Group by userId and return in the same order as userIds
  const ordersByUserId = new Map<string, Order[]>();
  for (const order of orders) {
    const existing = ordersByUserId.get(order.userId) || [];
    existing.push(order);
    ordersByUserId.set(order.userId, existing);
  }
  return userIds.map(id => ordersByUserId.get(id) || []);
});

const optimizedResolvers = {
  Query: {
    users: () => db.query('SELECT * FROM users LIMIT 10')
    // → 1 query
  },
  User: {
    orders: (user) => ordersByUserLoader.load(user.id)
    // → DataLoader batches into: 1 query
    // Total: 1 + 1 = 2 queries (N+1 problem solved)
  }
};

// How DataLoader works:
// 1. Collects all .load() calls within the same event loop tick
// 2. Executes the batch function on process.nextTick()
// 3. Distributes results back to each caller
// 4. Caches within request scope (deduplication)
```

---

## 5. Systematizing Selection Criteria

### 5.1 Use-Case Selection Matrix

```
When to choose REST:
  [1] Application centered on simple CRUD operations
  [2] Want to maximize HTTP caching (including CDN)
  [3] File upload/download is a major feature
  [4] Public API for third parties
  [5] Team has no GraphQL experience (account for learning cost)
  [6] Synchronous communication between microservices (gRPC also worth considering)
  [7] Low latency is the top priority (assuming CDN caching)
  [8] Compliance requires strict management of API specifications
  [9] Heavy integration with webhooks

When to choose GraphQL:
  [1] Complex data relationships (social graphs, e-commerce product catalogs, etc.)
  [2] Multiple client types (Web, iOS, Android, smart TV, etc.)
  [3] Frontend flexibility and development speed are important
  [4] Displaying many related data points on a single screen (dashboards, etc.)
  [5] Real-time updates needed (Subscription)
  [6] Building a BFF (Backend for Frontend) layer
  [7] Schema-driven development for parallel frontend-backend work
  [8] Want to avoid API versioning
  [9] Want to leverage auto-generated type-safe client code

When to choose gRPC:
  [1] High-speed internal communication between microservices
  [2] Streaming communication (including bidirectional)
  [3] Service-to-service communication in a polyglot environment
  [4] Efficient transfer of binary data
  [5] Performance is top priority (efficiency of Protocol Buffers)
```

### 5.2 Decision Flowchart

```
API Technology Selection Flowchart:

  START
    │
    ├── Q1: Is this a public API (for third parties)?
    │     ├── YES → REST (standard, abundant docs, low adoption barrier)
    │     └── NO ↓
    │
    ├── Q2: Is this internal communication between microservices?
    │     ├── YES → Q2a: Is latency the top priority?
    │     │           ├── YES → gRPC (binary, HTTP/2)
    │     │           └── NO → REST (favor simplicity)
    │     └── NO ↓
    │
    ├── Q3: Are there 3 or more types of clients?
    │     ├── YES → GraphQL (optimization for each client)
    │     └── NO ↓
    │
    ├── Q4: Does the screen display complex data relationships?
    │     ├── YES → GraphQL (flexible traversal of the data graph)
    │     └── NO ↓
    │
    ├── Q5: Is HTTP caching/CDN a priority?
    │     ├── YES → REST (standard HTTP caching)
    │     └── NO ↓
    │
    ├── Q6: Does the team have GraphQL experience?
    │     ├── YES → GraphQL
    │     └── NO → REST (account for learning cost)
    │
    └── When in doubt → REST (simplicity is virtuous)
                        + GraphQL can be added partially later
```

---

## 6. Developer Experience Comparison

### 6.1 API Design Process

```
REST API Design Process:

  1. Identify resources
     → List out nouns (User, Order, Product, ...)

  2. URI design
     → /api/v1/users
     → /api/v1/users/:id
     → /api/v1/users/:id/orders
     → Consistency in nesting depth and naming conventions

  3. Mapping HTTP methods
     → GET (read), POST (create), PUT/PATCH (update), DELETE (delete)

  4. Designing response structures
     → Define JSON structure for each endpoint
     → Decide on pagination strategy (offset, cursor)

  5. Creating OpenAPI specification
     → Describe API specification in YAML/JSON
     → Generate documentation with Swagger UI

  6. Versioning strategy
     → URL (/v1/, /v2/), headers, media types


GraphQL API Design Process:

  1. Define domain model
     → Define entities as types

  2. Schema definition (SDL)
     → type User { id: ID!, name: String!, orders: [Order!]! }
     → Schema = specification = documentation

  3. Design Query / Mutation / Subscription
     → Which data to fetch, update, or observe and how

  4. Implement resolvers
     → Data-fetching logic for each field

  5. Schema evolution
     → Adding new fields is non-breaking
     → Gradual deprecation with @deprecated directive
```

### 6.2 Type Safety and Code Generation

```typescript
// ====================================================================
// Code Example 5: Frontend type generation with GraphQL Code Generator
// ====================================================================

// --- Schema definition (server side: schema.graphql) ---
// type User {
//   id: ID!
//   name: String!
//   email: String!
//   role: UserRole!
//   orders(first: Int, after: String): OrderConnection!
// }
//
// enum UserRole {
//   ADMIN
//   MEMBER
//   GUEST
// }
//
// type OrderConnection {
//   edges: [OrderEdge!]!
//   pageInfo: PageInfo!
// }
//
// type OrderEdge {
//   node: Order!
//   cursor: String!
// }
//
// type Order {
//   id: ID!
//   total: Int!
//   status: OrderStatus!
//   items: [OrderItem!]!
//   createdAt: DateTime!
// }

// --- Query definition (frontend side: queries/user.graphql) ---
// query GetUserDashboard($userId: ID!) {
//   user(id: $userId) {
//     name
//     email
//     role
//     orders(first: 5) {
//       edges {
//         node {
//           id
//           total
//           status
//         }
//       }
//     }
//   }
// }

// --- Types auto-generated by codegen (generated/graphql.ts) ---
// The following is an example of codegen output

export type UserRole = 'ADMIN' | 'MEMBER' | 'GUEST';
export type OrderStatus = 'PENDING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface GetUserDashboardQuery {
  user: {
    __typename: 'User';
    name: string;
    email: string;
    role: UserRole;
    orders: {
      edges: Array<{
        node: {
          __typename: 'Order';
          id: string;
          total: number;
          status: OrderStatus;
        };
      }>;
    };
  } | null;
}

export interface GetUserDashboardQueryVariables {
  userId: string;
}

// --- Type-safe component (React + Apollo Client) ---
import { useQuery } from '@apollo/client';
import { GetUserDashboardQuery, GetUserDashboardQueryVariables } from './generated/graphql';
import { GET_USER_DASHBOARD } from './queries/user';

function UserDashboard({ userId }: { userId: string }) {
  const { data, loading, error } = useQuery<
    GetUserDashboardQuery,
    GetUserDashboardQueryVariables
  >(GET_USER_DASHBOARD, {
    variables: { userId }
  });

  if (loading) return <Loading />;
  if (error) return <Error message={error.message} />;
  if (!data?.user) return <NotFound />;

  // data.user.name → string (type-safe)
  // data.user.role → 'ADMIN' | 'MEMBER' | 'GUEST' (type-safe)
  // data.user.orders.edges[0].node.total → number (type-safe)
  // data.user.nonExistent → compile error (field does not exist)

  return (
    <div>
      <h1>{data.user.name}</h1>
      <p>{data.user.email}</p>
      <OrderList orders={data.user.orders.edges.map(e => e.node)} />
    </div>
  );
}
```

### 6.3 Testing and Debugging Experience Comparison

```
REST Testing and Debugging:

  ┌─────────────────────────────────────────────────────────┐
  │ Toolchain:                                              │
  │   - curl / HTTPie: instant testing from the command line│
  │   - Postman / Insomnia: GUI-based testing               │
  │   - Swagger UI: auto-generated test UI from OpenAPI     │
  │   - REST Client (VS Code): test within the editor       │
  │                                                         │
  │ Advantages:                                             │
  │   - Test GET requests directly in the browser address   │
  │     bar                                                 │
  │   - Testing complete with a single curl command         │
  │   - Instantly identify error cause from HTTP status code│
  │   - Intuitive debugging in the Network tab              │
  │                                                         │
  │ Example:                                                │
  │   $ curl -s http://api.example.com/users/1 | jq .       │
  │   $ curl -X POST http://api.example.com/users \         │
  │       -H "Content-Type: application/json" \             │
  │       -d '{"name":"test"}'                              │
  └─────────────────────────────────────────────────────────┘

GraphQL Testing and Debugging:

  ┌─────────────────────────────────────────────────────────┐
  │ Toolchain:                                              │
  │   - GraphiQL: interactive IDE (with autocomplete)       │
  │   - Apollo Studio / Explorer: feature-rich test         │
  │     environment                                         │
  │   - Altair GraphQL Client: desktop client               │
  │   - Apollo DevTools: browser extension (cache           │
  │     visualization)                                      │
  │                                                         │
  │ Advantages:                                             │
  │   - Schema autocomplete assists with query building     │
  │   - Document explorer for API discovery                 │
  │   - Query performance analysis                          │
  │   - Visualize cache state (Apollo DevTools)             │
  │                                                         │
  │ Caveats:                                                │
  │   - Testing with curl is verbose (POST + JSON body)     │
  │   - Errors are always HTTP 200 → cannot judge by status │
  │   - In the Network tab everything appears as            │
  │     POST /graphql                                       │
  └─────────────────────────────────────────────────────────┘
```

---

## 7. Security Comparison

### 7.1 REST Security Model

In REST, access control at the endpoint level is the foundation. This works well with standard middleware/filters in web application frameworks.

```typescript
// REST security implementation pattern
// Example: Express.js + middleware

// Per-endpoint authorization
app.get('/api/v1/users', authenticate, authorize('admin'), usersController.list);
app.get('/api/v1/users/:id', authenticate, usersController.show);
app.post('/api/v1/users', authenticate, authorize('admin'), usersController.create);
app.delete('/api/v1/users/:id', authenticate, authorize('admin'), usersController.delete);

// Rate limiting (easy per endpoint)
app.use('/api/v1/', rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests
  standardHeaders: true
}));

// Input validation (defined per route)
app.post('/api/v1/users',
  body('name').isString().isLength({ min: 1, max: 100 }),
  body('email').isEmail(),
  validateRequest,
  usersController.create
);
```

### 7.2 GraphQL Security Model

In GraphQL, because clients can freely compose queries, more granular security measures are required.

```typescript
// ====================================================================
// Code Example 6: Security measures for GraphQL
// ====================================================================

// --- 1. Query depth limiting ---
import depthLimit from 'graphql-depth-limit';

const server = new ApolloServer({
  schema,
  validationRules: [
    depthLimit(7)  // Limit nesting depth to 7 levels
  ]
});

// Attack example (DoS via deep nesting):
// query {
//   user(id: "1") {
//     friends {
//       friends {
//         friends {
//           friends {
//             friends { ... }  ← Deep nesting consumes server resources
//           }
//         }
//       }
//     }
//   }
// }

// --- 2. Query complexity limiting ---
import { createComplexityLimitRule } from 'graphql-validation-complexity';

const complexityRule = createComplexityLimitRule(1000, {
  scalarCost: 1,
  objectCost: 2,
  listFactor: 10
});
// → Calculates the total "cost" of a query and rejects it if it exceeds the threshold

// --- 3. Field-level authorization ---
const resolvers = {
  User: {
    email: (user, args, context) => {
      // Only the user themselves or an Admin can view the email address
      if (context.currentUser.id === user.id ||
          context.currentUser.role === 'ADMIN') {
        return user.email;
      }
      return null;  // Return null if no permission
    },
    salary: (user, args, context) => {
      // Only the HR department can view salary information
      if (!context.currentUser.departments.includes('HR')) {
        throw new ForbiddenError('Insufficient permissions');
      }
      return user.salary;
    }
  }
};

// --- 4. Persisted Queries (pre-registration of queries) ---
// In production, do not accept arbitrary queries; execute only pre-registered ones
const server = new ApolloServer({
  schema,
  persistedQueries: {
    cache: new InMemoryLRUCache()
  }
});
// Client sends a hash of the query
// POST /graphql
// { "extensions": { "persistedQuery": { "sha256Hash": "abc123..." } } }

// --- 5. Injection countermeasures ---
// GraphQL variables are validated by the type system,
// so SQLi, etc. depend on the resolver implementation
const resolvers = {
  Query: {
    user: async (_, { id }, context) => {
      // NG: String concatenation (SQL injection vulnerability)
      // return db.query(`SELECT * FROM users WHERE id = '${id}'`);

      // OK: Parameterized query
      return db.query('SELECT * FROM users WHERE id = $1', [id]);
    }
  }
};
```

### 7.3 Security Comparison Summary

```
Security Perspective Comparison:

  ┌──────────────────────┬───────────────────┬────────────────────┐
  │ Aspect               │ REST              │ GraphQL            │
  ├──────────────────────┼───────────────────┼────────────────────┤
  │ Access control       │ Per endpoint      │ Per field          │
  │   granularity        │                   │                    │
  │ Rate limiting        │ Easy              │ Complexity-based   │
  │                      │                   │   required         │
  │ DoS countermeasures  │ Standard          │ Depth/complexity   │
  │                      │                   │   limits           │
  │ Input validation     │ Manually defined  │ Partially by type  │
  │                      │                   │   system           │
  │ Introspection        │ N/A               │ Recommended to     │
  │                      │                   │   disable in prod  │
  │ Query control        │ Server-determined │ Persisted Queries  │
  │ Authentication       │ Standard HTTP     │ Same               │
  │                      │   headers         │                    │
  │ CORS                 │ Standard support  │ Same               │
  └──────────────────────┴───────────────────┴────────────────────┘
```

---

## 8. Hybrid Approach Design Patterns

In practice, patterns that coexist REST and GraphQL are widely adopted. It is important to choose the optimal combination based on the characteristics of the project.

### 8.1 Pattern List

```
Pattern 1: REST + GraphQL BFF (Backend for Frontend)

  ┌─────────┐     GraphQL      ┌──────────┐     REST      ┌──────────────┐
  │  Web    │ ──────────────→  │  GraphQL │ ──────────→  │ User Service │
  │  App    │                   │  BFF     │              │              │
  └─────────┘                   │          │              └──────────────┘
                                │          │     REST      ┌──────────────┐
  ┌─────────┐     GraphQL      │          │ ──────────→  │ Order Service│
  │  Mobile │ ──────────────→  │          │              │              │
  │  App    │                   │          │              └──────────────┘
  └─────────┘                   └──────────┘     REST      ┌──────────────┐
                                              ──────────→  │ Product Svc  │
                                                           └──────────────┘

  Advantages:
  → Frontend benefits from GraphQL's flexibility
  → Backend maintains REST's stability
  → BFF handles data aggregation and transformation
  → Existing REST microservices require no changes


Pattern 2: Using each where appropriate by feature

  ┌─────────────────────────────────────────────┐
  │ Application                                 │
  │                                              │
  │  CRUD operations   → REST API               │
  │  Dashboard         → GraphQL (complex data) │
  │  File operations   → REST API               │
  │  Real-time         → GraphQL Subscription   │
  │  Webhook receiving → REST API               │
  │  Search            → REST (Elasticsearch)   │
  └─────────────────────────────────────────────┘


Pattern 3: Separating public API / internal API

  ┌──────────────┐    REST       ┌──────────────┐
  │ Third Party  │ ──────────→  │              │
  │ Developers   │              │              │
  └──────────────┘              │   API        │
                                │   Gateway    │
  ┌──────────────┐   GraphQL    │              │
  │ In-house     │ ──────────→  │              │
  │ Frontend     │              │              │
  └──────────────┘              └──────────────┘

  → Third party: REST (standard, cacheable, easy to document)
  → In-house frontend: GraphQL (flexible, type-safe, development efficiency)


Pattern 4: GraphQL Federation (Supergraph)

  ┌─────────┐      ┌──────────────────────┐
  │ Client  │ ──→  │  GraphQL Gateway     │
  └─────────┘      │  (Apollo Router /    │
                    │   GraphQL Mesh)      │
                    └──────┬───────────────┘
                           │
               ┌───────────┼───────────────┐
               │           │               │
        ┌──────▼──┐  ┌─────▼───┐  ┌───────▼────┐
        │  User   │  │  Order  │  │  Product   │
        │  SubG   │  │  SubG   │  │  SubG      │
        │ (REST)  │  │ (gRPC)  │  │ (GraphQL)  │
        └─────────┘  └─────────┘  └────────────┘

  → Unified interface with Apollo Federation / GraphQL Mesh
  → Each service selects the best technology
  → Gateway automatically decomposes and integrates queries
```

### 8.2 Apollo Federation Implementation Example

```typescript
// ====================================================================
// Code Example 7: Microservice integration with Apollo Federation
// ====================================================================

// --- User Service (subgraph) ---
import { buildSubgraphSchema } from '@apollo/subgraph';
import { gql } from 'graphql-tag';

const userTypeDefs = gql`
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.0",
                      import: ["@key"])

  type User @key(fields: "id") {
    id: ID!
    name: String!
    email: String!
    role: UserRole!
  }

  enum UserRole {
    ADMIN
    MEMBER
    GUEST
  }

  type Query {
    user(id: ID!): User
    users(first: Int, after: String): UserConnection!
  }
`;

const userResolvers = {
  Query: {
    user: (_, { id }) => userRepository.findById(id),
    users: (_, { first, after }) => userRepository.paginate({ first, after })
  },
  User: {
    __resolveReference: (ref) => userRepository.findById(ref.id)
  }
};

const userSchema = buildSubgraphSchema([
  { typeDefs: userTypeDefs, resolvers: userResolvers }
]);


// --- Order Service (subgraph) ---
const orderTypeDefs = gql`
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.0",
                      import: ["@key", "@external"])

  type Order @key(fields: "id") {
    id: ID!
    total: Int!
    status: OrderStatus!
    items: [OrderItem!]!
    createdAt: DateTime!
  }

  enum OrderStatus {
    PENDING
    PROCESSING
    SHIPPED
    DELIVERED
    CANCELLED
  }

  type OrderItem {
    productId: ID!
    productName: String!
    price: Int!
    quantity: Int!
  }

  # Extend the User type to add an orders field
  extend type User @key(fields: "id") {
    id: ID! @external
    orders(first: Int, after: String): OrderConnection!
  }

  type OrderConnection {
    edges: [OrderEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type OrderEdge {
    node: Order!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }
`;

const orderResolvers = {
  User: {
    orders: (user, { first, after }) =>
      orderRepository.findByUserId(user.id, { first, after })
  },
  Order: {
    __resolveReference: (ref) => orderRepository.findById(ref.id)
  }
};


// --- Gateway (router) configuration ---
// supergraph.yaml
// subgraphs:
//   users:
//     routing_url: http://users-service:4001/graphql
//     schema:
//       subgraph_url: http://users-service:4001/graphql
//   orders:
//     routing_url: http://orders-service:4002/graphql
//     schema:
//       subgraph_url: http://orders-service:4002/graphql

// After the Gateway integrates the schemas,
// clients can execute queries like the following:
//
// query {
//   user(id: "1") {
//     name          ← fetched from User Service
//     email         ← fetched from User Service
//     orders(first: 5) {  ← fetched from Order Service
//       edges {
//         node {
//           id
//           total
//           status
//           items {
//             productName
//             price
//           }
//         }
//       }
//     }
//   }
// }
```

---

## 9. Migration Strategies

### 9.1 Incremental Migration from REST to GraphQL

```
Phase 1: Adding a GraphQL Layer (2–4 weeks)
──────────────────────────────────────────

  ┌─────────┐    GraphQL     ┌──────────────┐    REST     ┌───────────┐
  │ Client  │ ──────────→   │  GraphQL     │ ─────────→ │ Existing  │
  │ (new)   │                │  Layer       │            │ REST API  │
  └─────────┘                │              │            │           │
                              │ Resolvers    │            └───────────┘
  ┌─────────┐    REST        │ internally   │
  │ Client  │ ──────────→   │ call REST    │
  │(existing│                └──────────────┘
  └─────────┘
  * Existing clients continue using REST

  Activities:
  → Build a GraphQL layer on top of existing REST APIs
  → GraphQL resolvers internally call the REST API
  → New clients start using GraphQL
  → Existing clients are unaffected


Phase 2: New features built with GraphQL (1–3 months)
──────────────────────────────────────────

  Activities:
  → Use GraphQL for new screens/features
  → Existing screens continue using REST
  → Period for the team to become proficient in GraphQL
  → Some GraphQL resolvers switched to direct DB access


Phase 3: Incremental migration of existing features (3–6 months)
──────────────────────────────────────────

  Activities:
  → Start migrating REST endpoints with lower usage
  → Switch the client-side data-fetching layer to GraphQL
  → Monitor usage of REST endpoints
  → Gradually deprecate unused REST endpoints


Phase 4: Optimization and stabilization (1–2 months)
──────────────────────────────────────────

  Activities:
  → Switch all GraphQL resolvers to direct DB access
  → Optimize DataLoaders
  → Introduce Persisted Queries
  → Set up performance monitoring
```

### 9.2 Migration Caveats

```
Migration Risks and Countermeasures:

  Risk 1: Performance degradation
  → Countermeasure: A configuration where GraphQL Layer resolvers call REST
           adds network hops
           → Monitor latency of internal communication
           → Switch to direct DB access early

  Risk 2: Team learning cost
  → Countermeasure: Start with small features
           → Share knowledge via pair programming
           → Hold in-house GraphQL study sessions

  Risk 3: Caching strategy change
  → Countermeasure: From HTTP caching in the REST era
           to GraphQL client-side caching
           → Leverage Apollo Client's normalized cache
           → Address CDN caching with Persisted Queries

  Risk 4: Monitoring change
  → Countermeasure: Switch from per-endpoint to per-query monitoring
           → Introduce Apollo Studio / GraphQL tracing
           → Visualize query performance

  Risk 5: Difficulty of rollback
  → Countermeasure: Maintain REST API for a period of time
           → Enable switching between GraphQL/REST via Feature Flag
           → Migrate traffic incrementally
```

---

## 10. Anti-Patterns

### 10.1 Anti-Pattern 1: Reinventing REST with GraphQL

```typescript
// ====================================================================
// Anti-Pattern: Query design in GraphQL that mirrors REST
// ====================================================================

// --- NG: Defining separate queries per resource ---
const BAD_SCHEMA = `
  type Query {
    # Directly porting REST endpoints to GraphQL
    getUser(id: ID!): User
    getUserOrders(userId: ID!, page: Int): [Order]
    getUserOrderItems(orderId: ID!): [OrderItem]
    getUserAddress(userId: ID!): Address
    getUserPaymentMethods(userId: ID!): [PaymentMethod]
  }
`;

// Client-side code (no different from REST)
const user = await query({ query: GET_USER, variables: { id: '1' } });
const orders = await query({ query: GET_USER_ORDERS, variables: { userId: '1' } });
const items = await query({ query: GET_USER_ORDER_ITEMS, variables: { orderId: orders[0].id } });
// → There is no point in using GraphQL. REST would be more appropriate.

// --- OK: Design that leverages graph structure ---
const GOOD_SCHEMA = `
  type Query {
    user(id: ID!): User
  }

  type User {
    id: ID!
    name: String!
    email: String!
    address: Address
    orders(first: Int, after: String): OrderConnection!
    paymentMethods: [PaymentMethod!]!
  }

  type Order {
    id: ID!
    total: Int!
    items: [OrderItem!]!
    shippingAddress: Address!
  }
`;

// Client declaratively specifies the needed data structure
const GOOD_QUERY = `
  query UserDashboard($id: ID!) {
    user(id: $id) {
      name
      orders(first: 5) {
        edges {
          node {
            total
            items { productName, price }
          }
        }
      }
    }
  }
`;
// → Fetch all needed data in a single request
```

**Explanation**: The value of GraphQL lies in "flexible traversal of the data graph." Directly porting a REST endpoint structure to GraphQL only adds the overhead of query parsing without gaining any advantages. Schema design should express relationships between resources (graph structure) as fields on types, allowing clients to traverse to the required depth.

### 10.2 Anti-Pattern 2: Scattering Authorization Logic Across GraphQL Resolvers

```typescript
// ====================================================================
// Anti-Pattern: Writing authorization logic in each resolver
// ====================================================================

// --- NG: Authorization code scattered across each resolver ---
const BAD_RESOLVERS = {
  Query: {
    users: (_, args, ctx) => {
      if (!ctx.user) throw new AuthenticationError('Not authenticated');
      if (ctx.user.role !== 'ADMIN') throw new ForbiddenError('Admin only');
      return db.users.findAll();
    },
    orders: (_, args, ctx) => {
      if (!ctx.user) throw new AuthenticationError('Not authenticated');
      // Role check easily forgotten → security hole
      return db.orders.findAll();
    },
    // Copy-pasting authorization code every time a new resolver is added
    // → Increased maintenance cost, risk of omissions
  },
  User: {
    email: (user, _, ctx) => {
      if (!ctx.user) throw new AuthenticationError('Not authenticated');
      if (ctx.user.id !== user.id && ctx.user.role !== 'ADMIN') {
        return null;
      }
      return user.email;
    }
  }
};

// --- OK: Separate the authorization layer (e.g., graphql-shield) ---
import { shield, rule, and, or } from 'graphql-shield';

const isAuthenticated = rule()((_, args, ctx) => {
  return ctx.user !== null;
});

const isAdmin = rule()((_, args, ctx) => {
  return ctx.user?.role === 'ADMIN';
});

const isOwner = rule()((parent, args, ctx) => {
  return parent.id === ctx.user?.id;
});

const permissions = shield({
  Query: {
    users: and(isAuthenticated, isAdmin),
    orders: isAuthenticated,
    user: isAuthenticated
  },
  User: {
    email: and(isAuthenticated, or(isAdmin, isOwner)),
    salary: and(isAuthenticated, isAdmin)
  },
  Mutation: {
    updateUser: and(isAuthenticated, or(isAdmin, isOwner)),
    deleteUser: and(isAuthenticated, isAdmin)
  }
});

// Resolvers focus on business logic only
const GOOD_RESOLVERS = {
  Query: {
    users: () => db.users.findAll(),
    orders: () => db.orders.findAll(),
    user: (_, { id }) => db.users.findById(id)
  },
  User: {
    email: (user) => user.email,
    salary: (user) => user.salary
  }
};
// → Authorization rules consolidated in one place, omissions less likely
// → Resolvers are easier to test (no need to worry about authorization)
```

**Explanation**: Embedding authorization logic directly in resolvers raises the risk of forgetting to add authorization checks when new fields or queries are added. Using an authorization layer like graphql-shield allows authorization rules to be managed declaratively in one place. This is analogous to the authorization middleware approach in REST.

### 10.3 Anti-Pattern 3: Forcing File Uploads into GraphQL

```
NG Pattern:
  → Sending Base64-encoded files via GraphQL Mutation
  → Using the GraphQL multipart/form-data extension (graphql-upload)
  → Memory issues occur with large files

OK Pattern:
  → Handle file uploads via a REST endpoint (or directly to S3)
  → After upload completes, register metadata via GraphQL Mutation

  Steps:
  1. REST: POST /api/upload → { "fileUrl": "https://cdn.example.com/file.jpg" }
  2. GraphQL: mutation { attachFile(url: "https://cdn.example.com/file.jpg") { ... } }

  → Using REST and GraphQL where each excels
```

---

## 11. Edge Case Analysis

### 11.1 Edge Case 1: Queries with Deeply Nested Data

GraphQL's flexibility can place excessive load on the server if not properly controlled.

```
Problem Scenario:
  Fetching "friends of friends of friends of friends' posts" in a social network

  query DangerousQuery {
    user(id: "1") {
      friends(first: 50) {           # 50 people
        edges {
          node {
            friends(first: 50) {     # 50 x 50 = 2,500 people
              edges {
                node {
                  friends(first: 50) { # 50 x 50 x 50 = 125,000 people
                    edges {
                      node {
                        posts(first: 10) { # 125,000 x 10 = 1,250,000 items
                          edges {
                            node {
                              title
                              body
                              comments(first: 5) { # 6,250,000 items
                                edges { node { body } }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  Theoretical database access:
  → Fetch user: 1 time
  → Friends (L1): 1 time (50 records)
  → Friends (L2): 50 times (2,500 records)
  → Friends (L3): 2,500 times (125,000 records)
  → Posts: 125,000 times (1,250,000 records)
  → Comments: 1,250,000 times (6,250,000 records)
  → Even with DataLoader, the volume of returned data is enormous

Combination of countermeasures:

  1. Depth Limit
     → Limit maximum depth to 5–7
     → Set with depthLimit(7)

  2. Query Complexity Analysis
     → Assign a cost to each field
     → Apply a multiplication factor to list fields
     → Reject if total cost exceeds the threshold

  3. Enforcing pagination
     → Limit the maximum value of the first/last parameters
     → Reject requests where first: exceeds 100

  4. Timeout
     → Resolver-level timeout
     → Request-wide timeout (e.g., 30 seconds)

  5. Persisted Queries
     → In production, only allow pre-registered queries
     → Do not accept arbitrary queries
```

```typescript
// Example implementation of complexity analysis
import { getComplexity, simpleEstimator, fieldExtensionsEstimator } from 'graphql-query-complexity';

const server = new ApolloServer({
  schema,
  plugins: [{
    requestDidStart: () => ({
      didResolveOperation({ request, document }) {
        const complexity = getComplexity({
          schema,
          operationName: request.operationName,
          query: document,
          variables: request.variables,
          estimators: [
            fieldExtensionsEstimator(),
            simpleEstimator({ defaultComplexity: 1 })
          ]
        });

        const MAX_COMPLEXITY = 1000;
        if (complexity > MAX_COMPLEXITY) {
          throw new Error(
            `Query too complex: ${complexity}. Maximum allowed: ${MAX_COMPLEXITY}`
          );
        }
        console.log(`Query complexity: ${complexity}`);
      }
    })
  }]
});
```

### 11.2 Edge Case 2: Cache Strategy Conflicts Between REST and GraphQL

In a hybrid architecture, REST and GraphQL caches can become inconsistent.

```
Problem Scenario:
  In a GraphQL BFF → REST microservice configuration,
  the REST-side cache and the GraphQL-side cache fall out of sync

  Timeline:
  T=0  REST: GET /users/1 → { name: "Tanaka" }  (Cache-Control: max-age=60)
  T=5  GraphQL: query { user(id:"1") { name } }
       → BFF calls REST → returns "Tanaka" from cache
  T=10 REST: PATCH /users/1 { name: "Suzuki" }
       → DB update succeeds
       → REST cache invalidated
  T=15 GraphQL: query { user(id:"1") { name } }
       → Returns "Tanaka" from Apollo Client cache (inconsistency!)
       → BFF side may also return "Tanaka" using the REST cache

  ┌─────────────┐   ┌──────────────────┐   ┌────────────────┐
  │ Apollo      │   │ BFF internal     │   │ REST Service   │
  │ Client      │   │ HTTP cache       │   │ CDN cache      │
  │ Cache       │   │                  │   │                │
  │ "Tanaka" X  │   │ "Tanaka" X       │   │ "Suzuki" OK    │
  └─────────────┘   └──────────────────┘   └────────────────┘
  3 layers of cache are inconsistent

Countermeasures:

  1. Unified cache TTL
     → Unify the cache period for REST and GraphQL
     → Prioritize consistency with a short TTL (e.g., 5 seconds)

  2. Cache invalidation after Mutation
     → Invalidate related caches on GraphQL Mutation success
     → Apollo Client's refetchQueries / cache.evict()

  3. Event-driven cache invalidation
     → Notify GraphQL BFF of update events from the REST side
     → Leverage Redis Pub/Sub or message queues

  4. Optimistic Update
     → Update the client cache before the Mutation is sent
     → Finalized when the server responds
     → Apollo Client's optimisticResponse feature

  5. Centralized cache strategy
     → Manage cache only on the BFF side
     → No caching on the REST side (no-store)
     → Maintain a single source of truth
```

### 11.3 Edge Case 3: Confusion from Error Handling Differences

```
REST Error Response:
  → Error type instantly identifiable from HTTP status code

  HTTP 400 Bad Request
  { "error": "validation_error", "details": [...] }

  HTTP 401 Unauthorized
  { "error": "authentication_required" }

  HTTP 404 Not Found
  { "error": "user_not_found" }

  HTTP 500 Internal Server Error
  { "error": "internal_error" }


GraphQL Error Response:
  → Always HTTP 200 OK (network layer succeeds)
  → Application errors conveyed via the errors array
  → Partial data return is possible (a characteristic absent in REST)

  HTTP 200 OK
  {
    "data": {
      "user": {
        "name": "Tanaka",
        "orders": null           ← Order service is down
      }
    },
    "errors": [
      {
        "message": "Order service unavailable",
        "path": ["user", "orders"],
        "extensions": {
          "code": "SERVICE_UNAVAILABLE",
          "serviceName": "orders"
        }
      }
    ]
  }

  Note:
  → data and errors can coexist (partial success)
  → REST cannot express "partial success"
  → Client-side error handling becomes more complex

  Recommended pattern:
  → Express business errors as Union types inside data
  → Use the errors array only for system errors

  union UpdateUserResult = UpdateUserSuccess | ValidationError | NotFoundError

  type UpdateUserSuccess {
    user: User!
  }

  type ValidationError {
    field: String!
    message: String!
  }

  type NotFoundError {
    message: String!
  }
```

---

## 12. Exercises

### Exercise 1 (Beginner): Experience the basic differences between REST and GraphQL

Convert the following REST API to a GraphQL schema and query.

```
Assignment:
  Design a product catalog API for an e-commerce site.

  REST API (existing):
    GET /api/v1/products              → Product list
    GET /api/v1/products/:id          → Product details
    GET /api/v1/products/:id/reviews  → Product review list
    GET /api/v1/categories            → Category list
    GET /api/v1/categories/:id/products → Products by category

  Data model:
    Product: { id, name, price, description, categoryId, imageUrl, stock }
    Category: { id, name, parentId }
    Review: { id, productId, userId, rating, comment, createdAt }

  Requirements:
  (a) Define the above data model as a GraphQL schema (SDL)
  (b) Write a query to "fetch the category list and the top 3 products for each category"
  (c) Compare how many requests REST requires vs. GraphQL

Sample Answer:

  (a) GraphQL Schema:
  type Query {
    products(first: Int, after: String, categoryId: ID): ProductConnection!
    product(id: ID!): Product
    categories: [Category!]!
    category(id: ID!): Category
  }

  type Product {
    id: ID!
    name: String!
    price: Int!
    description: String!
    category: Category!
    imageUrl: String!
    stock: Int!
    reviews(first: Int, after: String): ReviewConnection!
    averageRating: Float
  }

  type Category {
    id: ID!
    name: String!
    parent: Category
    children: [Category!]!
    products(first: Int, after: String): ProductConnection!
  }

  type Review {
    id: ID!
    user: User!
    rating: Int!
    comment: String!
    createdAt: DateTime!
  }

  (b) Query:
  query CategoriesWithTopProducts {
    categories {
      id
      name
      products(first: 3) {
        edges {
          node {
            id
            name
            price
            averageRating
          }
        }
      }
    }
  }

  (c) Request count comparison:
  REST: 1 (category list) + N (categories × product fetch) = 1 + N requests
  GraphQL: 1 request
  With 10 categories: REST = 11, GraphQL = 1
```

### Exercise 2 (Intermediate): Performance optimization

Identify the N+1 problem in the following GraphQL schema and resolve it with DataLoader.

```
Assignment:
  Optimize performance in a blog system with the following schema.

  type Query {
    posts(first: Int): [Post!]!
  }

  type Post {
    id: ID!
    title: String!
    body: String!
    author: User!          # Location of the N+1 problem
    comments: [Comment!]!  # Location of the N+1 problem
    tags: [Tag!]!          # Location of the N+1 problem
  }

  type Comment {
    id: ID!
    body: String!
    author: User!          # Location of the N+1 problem (nested)
  }

  What to implement:
  (a) Show the naive resolver where the N+1 problem occurs
  (b) Show the optimized resolver using DataLoader
  (c) Compare the number of SQL queries issued during query execution

Sample Answer:

  (a) Naive resolver:
  const resolvers = {
    Query: {
      posts: () => db.query('SELECT * FROM posts LIMIT 10')
      // → 1 query
    },
    Post: {
      author: (post) => db.query(
        'SELECT * FROM users WHERE id = ?', [post.authorId]
      ),
      // → 10 queries (1 per post)
      comments: (post) => db.query(
        'SELECT * FROM comments WHERE post_id = ?', [post.id]
      ),
      // → 10 queries
      tags: (post) => db.query(
        'SELECT t.* FROM tags t JOIN post_tags pt ON t.id = pt.tag_id
         WHERE pt.post_id = ?', [post.id]
      )
      // → 10 queries
    },
    Comment: {
      author: (comment) => db.query(
        'SELECT * FROM users WHERE id = ?', [comment.authorId]
      )
      // → comment count × 1 query (e.g., 50 queries)
    }
  };
  // Total: 1 + 10 + 10 + 10 + 50 = 81 queries

  (b) DataLoader optimized version:
  const createLoaders = () => ({
    userLoader: new DataLoader(async (ids) => {
      const users = await db.query(
        'SELECT * FROM users WHERE id IN (?)', [ids]
      );
      const map = new Map(users.map(u => [u.id, u]));
      return ids.map(id => map.get(id));
    }),
    commentsByPostLoader: new DataLoader(async (postIds) => {
      const comments = await db.query(
        'SELECT * FROM comments WHERE post_id IN (?)', [postIds]
      );
      const grouped = new Map();
      for (const c of comments) {
        const existing = grouped.get(c.postId) || [];
        existing.push(c);
        grouped.set(c.postId, existing);
      }
      return postIds.map(id => grouped.get(id) || []);
    }),
    tagsByPostLoader: new DataLoader(async (postIds) => {
      const rows = await db.query(
        'SELECT t.*, pt.post_id FROM tags t
         JOIN post_tags pt ON t.id = pt.tag_id
         WHERE pt.post_id IN (?)', [postIds]
      );
      const grouped = new Map();
      for (const r of rows) {
        const existing = grouped.get(r.postId) || [];
        existing.push(r);
        grouped.set(r.postId, existing);
      }
      return postIds.map(id => grouped.get(id) || []);
    })
  });

  // Total: 1(posts) + 1(users) + 1(comments) + 1(tags)
  //       + 1(comment authors) = 5 queries
  // Reduced from 81 queries to 5 queries (approx. 94% reduction)
```

### Exercise 3 (Advanced): Hybrid architecture design

Design an API for a system that meets the following requirements.

```
Assignment:
  Design an online learning platform

  Requirements:
  - Public API: third-party educational institutions fetch course information
  - Student UI: course search, enrollment management, progress tracking (Web + iOS + Android)
  - Instructor UI: course creation, student management, analytics dashboard
  - Admin: user management, sales reports
  - Video upload: handling large files
  - Real-time: live class chat, notifications

  What to design:
  (a) API technology selection (how to use REST / GraphQL / gRPC)
  (b) System architecture diagram
  (c) Reasoning for the technology selection of each component

Sample Answer:

  (a) Technology selection:
  ┌────────────────────────┬──────────────┬─────────────────────────┐
  │ Component              │ Technology   │ Reason                  │
  ├────────────────────────┼──────────────┼─────────────────────────┤
  │ Public API             │ REST         │ Standard, CDN caching   │
  │ Student BFF            │ GraphQL      │ Multi-client, flexible  │
  │ Instructor dashboard   │ GraphQL      │ Complex data aggregation │
  │ Admin                  │ GraphQL      │ Flexible analytics data │
  │ Video upload           │ REST         │ multipart/form-data     │
  │ Real-time notifications│ GraphQL Sub  │ Use Subscription        │
  │ Live chat              │ WebSocket    │ Low-latency bidirectional│
  │ Between microservices  │ gRPC         │ Fast, type-safe         │
  │ Video transcode link   │ Message Q    │ Async processing        │
  └────────────────────────┴──────────────┴─────────────────────────┘

  (b) Architecture diagram:

  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
  │ Student  │ │ Teacher  │ │ Admin    │ │ Third Party  │
  │ Web/App  │ │ Web      │ │ Web      │ │ Developers   │
  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘
       │            │            │               │
       │ GraphQL    │ GraphQL    │ GraphQL       │ REST
       v            v            v               v
  ┌────────────────────────────────────┐  ┌──────────────┐
  │         API Gateway                │  │ Public REST  │
  │    (GraphQL Federation)            │  │ API          │
  └──────┬────────┬────────┬───────────┘  └──────────────┘
         │        │        │
    gRPC │   gRPC │   gRPC │
         v        v        v
  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐
  │ User   │ │ Course │ │ Video  │ │ Analytics  │
  │ Svc    │ │ Svc    │ │ Svc    │ │ Svc        │
  └────────┘ └────────┘ └────────┘ └────────────┘
       │        │          │             │
       v        v          v             v
     [DB]     [DB]    [ObjectStore]  [DWH/OLAP]

  (c) Technology selection rationale:
  - Public API uses REST: lowers the adoption barrier for third parties
    and ensures scalability with CDN caching
  - BFF uses GraphQL Federation: addresses the different data requirements
    of students, instructors, and admins with a single schema
  - Inter-microservice communication uses gRPC: achieves type safety
    with Protocol Buffers and high-speed communication with HTTP/2
  - Video upload uses REST: optimal for large binary multipart uploads
  - Real-time uses GraphQL Subscription + WebSocket:
    use Subscription for notifications and WebSocket for chat
```

---

## 13. Practical Decision Checklist

The following checklist can be used when you are uncertain which to choose — REST or GraphQL — for a project.

```
REST vs GraphQL Decision Checklist:

  ┌──────────────────────────────────────────┬──────┬─────────┬──────┐
  │ Check Item                               │ REST │ GraphQL │ Pts  │
  ├──────────────────────────────────────────┼──────┼─────────┼──────┤
  │ Team has GraphQL experience              │      │   +2    │  /2  │
  │ 3 or more types of clients               │      │   +3    │  /3  │
  │ 3 or more data sources on a single screen│      │   +2    │  /2  │
  │ CDN caching is important                 │  +3  │         │  /3  │
  │ File upload is a major feature           │  +2  │         │  /2  │
  │ Public API for third parties             │  +3  │         │  /3  │
  │ Real-time features needed                │      │   +2    │  /2  │
  │ Want schema-driven development           │      │   +2    │  /2  │
  │ Want to avoid API versioning             │      │   +2    │  /2  │
  │ Frontend development speed is priority   │      │   +2    │  /2  │
  │ Operational simplicity is priority       │  +2  │         │  /2  │
  │ Type-safe code generation is important   │      │   +2    │  /2  │
  ├──────────────────────────────────────────┼──────┼─────────┼──────┤
  │ Total                                    │ /10  │  /17    │      │
  └──────────────────────────────────────────┴──────┴─────────┴──────┘

  Judgment:
  REST total > GraphQL total → Recommend REST
  GraphQL total > REST total → Recommend GraphQL
  Difference within 2 points → Consider a hybrid approach
```

---

## 14. FAQ (Frequently Asked Questions)

### FAQ 1: Is GraphQL a superset of REST?

**Answer**: No. GraphQL and REST are technologies with different trade-offs and are not in a superset relationship.

Where GraphQL excels over REST: flexible data fetching, built-in type system, and client-driven data retrieval. Where REST excels over GraphQL: full use of HTTP caching, operational simplicity, ecosystem maturity, and ease of file operations.

"Now that GraphQL exists, REST is no longer needed" is incorrect. It is important to choose the appropriate technology based on project characteristics. In practice, a hybrid approach combining both is often most effective.

### FAQ 2: Does GraphQL have poor performance?

**Answer**: Not necessarily. The performance characteristics differ, but both can achieve high performance when properly designed and optimized.

Cases where GraphQL is at a performance disadvantage:
- Simple GET requests that could leverage CDN caching
- Overhead of query parsing and validation (microseconds to milliseconds)
- Database access when the N+1 problem is left unaddressed

Cases where GraphQL is at a performance advantage:
- Fetching multiple related resources (fewer round trips)
- Avoiding over-fetching on mobile networks
- Payloads optimized for each client

The key is to properly apply optimizations such as introducing DataLoader, limiting query complexity, and leveraging Persisted Queries.

### FAQ 3: Should GraphQL be used even for small-scale projects?

**Answer**: For small-scale projects, REST is often more appropriate.

Introducing GraphQL incurs upfront setup costs: schema definition, resolver implementation, client library configuration, and DataLoader implementation. For small projects, these initial costs can outweigh the benefits.

However, even at small scale, GraphQL is worth considering if the following conditions apply:
- There is a prospect of more client types in the future
- Frontend development speed is the top priority
- The team has GraphQL experience
- Type safety from TypeScript and codegen is valued

When in doubt, starting with REST and adding GraphQL as needed is the low-risk approach.

### FAQ 4: How should GraphQL Subscription and WebSocket be used?

**Answer**: GraphQL Subscription is an abstraction layer built on top of WebSocket — they operate at different technical levels.

When to choose GraphQL Subscription:
- Adding real-time features to an existing GraphQL schema
- When type-safe real-time data delivery is needed
- When clients want to flexibly specify the shape of data they receive

When to use WebSocket directly:
- High-frequency message exchange (chat, games, etc.)
- Streaming binary data
- Low-latency requirements where GraphQL overhead should be avoided
- When the server needs to enforce a specific data format

The main difference is that Subscription allows data to be declared declaratively as a query, while WebSocket enables communication in any message format.

### FAQ 5: How long does migration from a REST API to GraphQL take?

**Answer**: It varies widely depending on project size and team experience, but the following are general guidelines.

- Small scale (10–20 endpoints, team of 3–5): 1–2 months
- Medium scale (50–100 endpoints, team of 5–10): 3–6 months
- Large scale (100+ endpoints, team of 10+): 6–12 months or more

Key points for shortening the migration period:
- Migrate incrementally — do not migrate everything at once
- Build a GraphQL layer on top of the existing REST, then gradually switch to direct DB access
- Adopt GraphQL for new features and defer existing features
- Allocate time for the team to learn — focus the first 1–2 weeks on learning

---

## 15. Industry Adoption Cases and Trends

```
Representative companies using GraphQL and their reasons:

  Meta (Facebook):
  → Creators of GraphQL
  → Motivated by optimizing data fetching for mobile apps
  → Applied to the complex data graph of the News Feed

  GitHub:
  → Migrated from REST API v3 to GraphQL API v4
  → Complex related data for repositories, Issues, PRs
  → Enabled users (developers) to fetch only the data they need

  Shopify:
  → Adopted GraphQL as the public API for their e-commerce platform
  → Storefront API: GraphQL
  → Admin API: GraphQL + REST (for backward compatibility)

  Netflix:
  → Adopted GraphQL Federation as the integration layer for microservices
  → Hundreds of microservices exposed through a unified GraphQL interface

  Twitter (X):
  → Uses GraphQL internally
  → Applied to complex data retrieval for timelines


Representative companies that continue to use REST:

  Stripe:
  → Payment API uses REST (prioritizes standardization of public API)
  → Prioritizes compatibility with a broad ecosystem

  Twilio:
  → Communications API uses REST (prioritizes simplicity)
  → Values the ability to instantly test with curl

  AWS:
  → Most service APIs are REST-based
  → However, also provides GraphQL services through AppSync
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just from theory, but from actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next steps.

### Q3: How is this used in professional practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

### Final Comparison Table

| Aspect | REST | GraphQL | gRPC |
|--------|------|---------|------|
| Use cases | CRUD, public API | Complex data, multiple clients | Inter-service communication |
| Caching | HTTP standard | Custom implementation (Apollo Cache, etc.) | None (implement at application layer) |
| Type safety | Supplemented by OpenAPI | Built-in (SDL) | Protocol Buffers |
| Learning cost | Low | Moderate | Moderate to high |
| Ecosystem | Most mature | Growing | Backend-centric |
| File operations | Easy | Complex | Streaming capable |
| Real-time | WebSocket/SSE | Subscription | Bidirectional streaming |
| Operational ease | High | Moderate | Moderate |
| Mobile suitability | Moderate | High (payload optimization) | High (binary) |
| Security control | Per endpoint | Per field | Per service |

### Selection Principles

1. **When simplicity is the priority**: Choose REST. HTTP's standard features can be leveraged to the fullest, with a low team learning cost.
2. **When flexibility is the priority**: Choose GraphQL. Client-driven data fetching maximizes frontend development efficiency.
3. **When performance is the priority**: Choose REST for simple cases (CDN caching), GraphQL for complex cases (fewer requests), and gRPC for internal communication.
4. **When in doubt**: Start with REST and adopt a hybrid approach by partially adding GraphQL as needed — this is the low-risk path.

Most importantly, technology selection should be based on "project requirements" rather than "trends." Both REST and GraphQL are mature technologies that deliver great value when used in the right context. Use the decision criteria and checklists shown in this guide to make the best choice for your project.

---

## What to Read Next

- SDK Design Fundamentals
- [RESTful API Design in Depth](./00-rest-best-practices.md)
- [Practical GraphQL Schema Design](./01-graphql-fundamentals.md)

---

## References

1. Fielding, R.T. "Architectural Styles and the Design of Network-based Software Architectures." Doctoral dissertation, University of California, Irvine, 2000. -- The original REST paper. Provides the definitions and theoretical basis for architectural constraints.
2. Buna, S. "GraphQL in Action." Manning Publications, 2021. -- A practical introduction to GraphQL. Covers schema design, resolver implementation, and performance optimization.
3. Sturgeon, P. "Build APIs You Won't Hate." Leanpub, 2023 (2nd edition). -- A collection of best practices for RESTful API design. Provides practical guidance on versioning, pagination, and error handling.
4. Netflix Technology Blog. "Beyond REST: Rapid Development with GraphQL Microservices." 2023. -- A large-scale GraphQL Federation adoption case at Netflix. Shares knowledge of GraphQL integration in microservice environments.
5. GitHub Engineering Blog. "The GitHub GraphQL API." 2016. -- Explains the background and design decisions behind GitHub's migration from REST API v3 to GraphQL API v4.
6. Apollo GraphQL. "Principled GraphQL." 2019. -- Guidelines defining 10 principles for GraphQL schema design, operations, and governance.
7. Richardson, L. and Ruby, S. "RESTful Web APIs." O'Reilly Media, 2013. -- A seminal work systematically covering REST theory and practice. Also covers advanced topics like HATEOAS implementation.

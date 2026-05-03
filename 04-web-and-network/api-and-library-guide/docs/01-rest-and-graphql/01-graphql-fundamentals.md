# GraphQL Fundamentals

> GraphQL is a query language developed by Facebook. Learn schema-driven development, the type system, Query/Mutation/Subscription, and resolver mechanics to master an API design approach that differs from REST.

## What You Will Learn

- [ ] Understand GraphQL's type system and schema definitions
- [ ] Know when to use Query, Mutation, and Subscription
- [ ] Learn resolver implementation patterns
- [ ] Build and operate an Apollo Server
- [ ] Understand the N+1 problem and optimization with DataLoader
- [ ] Master error handling and authentication/authorization patterns

## Prerequisites

- Basic concepts of REST API → See: [REST Best Practices](./00-rest-best-practices.md)
- How HTTP requests/responses work → See: HTTP Basics
- Understanding of JSON data structures
- Basic knowledge of type systems (familiarity with TypeScript or Java types is helpful)

---

## 1. What Is GraphQL

### 1.1 Overview and History

GraphQL was developed inside Facebook in 2012 as a data-fetching foundation for mobile apps. It was open-sourced in 2015 and transferred to the GraphQL Foundation under the Linux Foundation in 2019.

```
GraphQL = Graph Query Language
  → A query language for APIs + type system + runtime
  → Developed internally at Facebook in 2012, released publicly in 2015, GraphQL Foundation established in 2019

Timeline:
  2012  Development began inside Facebook (for the mobile news feed)
  2015  Announced at the React.js Conference; spec open-sourced
  2016  GitHub API v4 adopts GraphQL (first major large-scale adoption)
  2017  Ecosystem expands: Apollo, Relay Modern, Prisma, and others
  2018  Subscription formally added to the GraphQL spec
  2019  GraphQL Foundation established (under the Linux Foundation)
  2021  Specification work on @defer and @stream directives begins
  2023  Stable release of the GraphQL Specification October 2021 Edition
  2024  Composite Schema (unified Federation spec) RFC in progress
```

### 1.2 The Three Pillars of GraphQL

```
+-------------------------------------------------------------------+
|                    The Three Pillars of GraphQL                    |
+-------------------------------------------------------------------+
|                                                                   |
|  [1] Query Language       [2] Type System        [3] Runtime      |
|  (Query Language)         (Type System)          (Execution Engine)|
|                                                                   |
|  Clients describe         The schema strictly    Parses, validates,|
|  the data they want       defines the shape      and returns       |
|  declaratively            of the API             the result        |
|                                                                   |
|  · Query                 · Scalar types          · Parse           |
|  · Mutation              · Object types          · Validate        |
|  · Subscription          · Enum types            · Execute         |
|  · Fragment              · Interface/Union       · Serialize        |
|  · Variable              · Input types           · Error handling  |
|                                                                   |
+-------------------------------------------------------------------+
```

### 1.3 Comparison with REST

```
REST vs GraphQL (conceptual):

  REST:
    GET /users/123            → { id, name, email, address, ... }
    GET /users/123/orders     → [{ id, total, items, ... }]
    GET /orders/456/items     → [{ id, product, price, ... }]
    → 3 requests, includes unnecessary data

  GraphQL:
    POST /graphql
    query {
      user(id: "123") {
        name
        orders(first: 5) {
          total
          items { productName, price }
        }
      }
    }
    → 1 request, only the data you need
```

**Comparison Table 1: REST vs GraphQL Feature Comparison**

| Aspect | REST | GraphQL |
|--------|------|---------|
| Endpoints | Multiple per resource (`/users`, `/orders`) | Single (`/graphql`) |
| Data fetching | Server decides (over-fetching occurs) | Client specifies required fields |
| Type system | Defined separately via OpenAPI/Swagger | Built into the schema (SDL) |
| Versioning | URL path (`/v1/`, `/v2/`) is common | Schema evolution (deprecated + add new fields) |
| Caching | Easy with HTTP cache headers | Requires dedicated cache strategy (Apollo Cache, etc.) |
| Real-time | WebSocket / SSE implemented separately | Natively supported via Subscription |
| Learning curve | Widely known, low | Requires learning SDL, resolvers, and other concepts |
| File upload | Standard with multipart/form-data | Outside the spec (extended via Apollo Upload, etc.) |
| Error handling | HTTP status codes | Always 200; errors expressed in `errors` field |
| Documentation | Generated with Swagger UI, etc. | Auto-generated and interactive via GraphiQL/Playground |
| Nested data | Multiple requests or include params | Any depth in a single request |

**Comparison Table 2: Suitability by Use Case**

| Use Case | REST Recommendation | GraphQL Recommendation | Reason |
|----------|--------------------|-----------------------|--------|
| Simple CRUD-centric API | ★★★★★ | ★★★☆☆ | REST is simpler and sufficient |
| BFF for mobile apps | ★★☆☆☆ | ★★★★★ | Bandwidth savings; fewer round trips |
| Microservice aggregation | ★★★☆☆ | ★★★★★ | Easy integration via Federation/Stitching |
| Publicly exposed API | ★★★★★ | ★★★☆☆ | REST + OpenAPI is more universal |
| Dashboards / admin panels | ★★★☆☆ | ★★★★★ | Flexible for complex data requirements |
| IoT / embedded systems | ★★★★★ | ★★☆☆☆ | HTTP GET is lighter |
| Real-time notifications | ★★★☆☆ | ★★★★☆ | Natively supported via Subscription |
| File delivery / streaming | ★★★★★ | ★☆☆☆☆ | GraphQL is intended for JSON data |

### 1.4 GraphQL Request/Response Flow

```
┌──────────────┐     POST /graphql      ┌──────────────────────────┐
│              │ ─────────────────────→ │  GraphQL Server          │
│   Client     │     {                  │                          │
│  (Browser/   │       query: "...",    │  1. Parse                │
│   Mobile)    │       variables: {}    │         ↓                │
│              │     }                  │  2. Validate             │
│              │                        │     - Type check         │
│              │                        │     - Field existence    │
│              │                        │         ↓                │
│              │     {                  │  3. Execute              │
│              │       data: {...},     │     - Invoke resolvers   │
│              │ ←───────────────────── │     - Access data sources│
│              │       errors: [...]    │         ↓                │
│              │     }                  │  4. Serialize            │
└──────────────┘                        └──────────────────────────┘
                                               ↕
                                        ┌──────────────┐
                                        │  DataSources │
                                        │  - Database  │
                                        │  - REST API  │
                                        │  - gRPC      │
                                        │  - Cache     │
                                        └──────────────┘
```

---

## 2. Schema Definition (SDL)

### 2.1 Scalar Types

GraphQL has five built-in scalar types.

```graphql
# Built-in scalar types
# Int     : Signed 32-bit integer
# Float   : Double-precision floating point
# String  : UTF-8 string
# Boolean : true / false
# ID      : Unique identifier (internally a String)

# Custom scalar type definitions
scalar DateTime    # Date/time string in ISO 8601 format
scalar Email       # String in email address format
scalar URL         # String in URL format
scalar JSON        # Arbitrary JSON object
scalar BigInt      # 64-bit integer (when Int range is exceeded)
scalar Void        # No return value (used for side-effect-only Mutations)
```

### 2.2 Object Types and Type Modifiers

```graphql
# Type modifier combinations and their meaning
#
# String    → Nullable string (value is null or String)
# String!   → Non-null string (value must be String)
# [String]  → Nullable array (array itself may be null; elements may also be null)
# [String]! → Non-null array (array itself is non-null; elements may be null)
# [String!] → Nullable array (array itself may be null; elements are non-null)
# [String!]!→ Non-null array (both array and elements are non-null)

# ┌──────────────────────────────────────────────────────┐
# │  Allowed values for each type modifier               │
# ├───────────────┬──────────────────────────────────────┤
# │  Declaration  │  Allowed values                      │
# ├───────────────┼──────────────────────────────────────┤
# │  String       │  null, "hello"                       │
# │  String!      │  "hello"                             │
# │  [String]     │  null, [], [null], ["a", null]       │
# │  [String]!    │  [], [null], ["a", null]             │
# │  [String!]    │  null, [], ["a", "b"]                │
# │  [String!]!   │  [], ["a", "b"]                      │
# └───────────────┴──────────────────────────────────────┘
```

### 2.3 Enum Types

```graphql
# Enum types
enum UserRole {
  USER
  ADMIN
  EDITOR
  MODERATOR
}

enum OrderStatus {
  PENDING
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
  REFUNDED
}

# Enum types are useful for filtering, validation, and documentation
# If a value not present in the schema is passed at runtime, a validation error is raised
```

### 2.4 Object Type Definitions

```graphql
# Object types
type User {
  id: ID!                     # ! means non-null
  name: String!
  email: Email!
  role: UserRole!
  avatar: String              # nullable
  bio: String
  createdAt: DateTime!
  updatedAt: DateTime!
  orders: [Order!]!           # non-null array (both array and elements are non-null)
  orderCount: Int!
  posts: [Post!]!
  followers: [User!]!
  following: [User!]!
}

type Order {
  id: ID!
  user: User!
  status: OrderStatus!
  total: Int!                 # Amount (in cents or smallest currency unit)
  items: [OrderItem!]!
  shippingAddress: Address
  note: String
  createdAt: DateTime!
  updatedAt: DateTime!
}

type OrderItem {
  id: ID!
  order: Order!
  product: Product!
  quantity: Int!
  unitPrice: Int!
  subtotal: Int!              # quantity * unitPrice (computed field)
}

type Product {
  id: ID!
  name: String!
  price: Int!
  description: String
  category: Category!
  tags: [String!]!
  imageUrl: URL
  stock: Int!
  isAvailable: Boolean!
}

type Category {
  id: ID!
  name: String!
  slug: String!
  parent: Category            # Recursive type reference (parent category)
  children: [Category!]!
  products: [Product!]!
}

type Address {
  postalCode: String!
  prefecture: String!
  city: String!
  street: String!
  building: String
}

type Post {
  id: ID!
  author: User!
  title: String!
  body: String!
  tags: [String!]!
  publishedAt: DateTime
  createdAt: DateTime!
}
```

### 2.5 Input Types

```graphql
# Input types (used as Mutation arguments)
# Difference between input and type:
#   - input types can only be used as Mutation/Query arguments
#   - input type fields cannot include object types (only other input types)
#   - input types cannot have resolvers

input CreateUserInput {
  name: String!
  email: Email!
  role: UserRole = USER       # Default value
  bio: String
  avatar: String
}

input UpdateUserInput {
  name: String
  email: Email
  role: UserRole
  bio: String
  avatar: String
}

input CreateOrderInput {
  items: [OrderItemInput!]!
  shippingAddress: AddressInput!
  note: String
}

input OrderItemInput {
  productId: ID!
  quantity: Int!
}

input AddressInput {
  postalCode: String!
  prefecture: String!
  city: String!
  street: String!
  building: String
}
```

### 2.6 Interface and Union

```graphql
# Interface: abstraction for types sharing common fields
interface Node {
  id: ID!
}

interface Timestamped {
  createdAt: DateTime!
  updatedAt: DateTime!
}

type User implements Node & Timestamped {
  id: ID!
  name: String!
  email: Email!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Post implements Node & Timestamped {
  id: ID!
  title: String!
  body: String!
  createdAt: DateTime!
  updatedAt: DateTime!
}

# Union: a set of types that do not share common fields
union SearchResult = User | Post | Product

type Query {
  search(query: String!): [SearchResult!]!
  node(id: ID!): Node         # Relay Global Object Identification pattern
}

# Example query for Union:
# query {
#   search(query: "GraphQL") {
#     ... on User { name, email }
#     ... on Post { title, body }
#     ... on Product { name, price }
#   }
# }
```

### 2.7 Directives

```graphql
# Built-in directives
# @skip(if: Boolean!)    - Exclude the field if true
# @include(if: Boolean!) - Include the field if true
# @deprecated(reason: String) - Mark a field as deprecated

type User {
  id: ID!
  name: String!
  email: Email!
  username: String @deprecated(reason: "Use 'name' instead.")
}

# Using directives in a query
# query GetUser($id: ID!, $includeOrders: Boolean!) {
#   user(id: $id) {
#     name
#     email
#     orders @include(if: $includeOrders) {
#       id
#       total
#     }
#   }
# }

# Custom directive definitions (require server-side implementation)
directive @auth(requires: UserRole!) on FIELD_DEFINITION
directive @cacheControl(maxAge: Int!) on FIELD_DEFINITION
directive @rateLimit(max: Int!, window: String!) on FIELD_DEFINITION

type Query {
  users: [User!]! @auth(requires: ADMIN) @rateLimit(max: 100, window: "1m")
  publicPosts: [Post!]! @cacheControl(maxAge: 300)
}
```

### 2.8 Pagination Types (Relay Connection Spec)

```graphql
# Pagination based on the Relay Connection specification

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

type UserEdge {
  node: User!
  cursor: String!
}

type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type OrderEdge {
  node: Order!
  cursor: String!
}

type OrderConnection {
  edges: [OrderEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

# Cursor vs Offset pagination comparison:
#
# Offset:  users(offset: 20, limit: 10)
#   Pros: Easy to implement, can jump to any page
#   Cons: Shifts occur on insert/delete; large offsets cause high DB load
#
# Cursor:  users(first: 10, after: "abc123")
#   Pros: Stable under data changes, consistent results, fast via index
#   Cons: Cannot jump to arbitrary pages; slightly more complex to implement
```

---

## 3. Query (Data Fetching)

### 3.1 Query Type Definition

```graphql
# Schema definition
type Query {
  # Single resource
  user(id: ID!): User
  order(id: ID!): Order
  product(id: ID!): Product

  # Collections (cursor pagination)
  users(
    first: Int
    after: String
    last: Int
    before: String
    filter: UserFilter
    sort: UserSort
  ): UserConnection!

  orders(
    first: Int
    after: String
    filter: OrderFilter
  ): OrderConnection!

  # Search
  searchUsers(query: String!, limit: Int = 10): [User!]!
  search(query: String!, types: [SearchType!]): [SearchResult!]!

  # Aggregation
  userStats: UserStats!
  orderStats(period: StatPeriod!): OrderStats!

  # Health check
  health: HealthStatus!

  # Currently authenticated user
  me: User
}

input UserFilter {
  role: UserRole
  createdAfter: DateTime
  createdBefore: DateTime
  nameContains: String
}

input OrderFilter {
  status: OrderStatus
  minTotal: Int
  maxTotal: Int
  userId: ID
}

enum UserSort {
  CREATED_AT_ASC
  CREATED_AT_DESC
  NAME_ASC
  NAME_DESC
}

enum SearchType {
  USER
  POST
  PRODUCT
}

enum StatPeriod {
  TODAY
  THIS_WEEK
  THIS_MONTH
  THIS_YEAR
}

type UserStats {
  totalUsers: Int!
  activeUsers: Int!
  newUsersToday: Int!
  roleDistribution: [RoleCount!]!
}

type RoleCount {
  role: UserRole!
  count: Int!
}

type OrderStats {
  totalOrders: Int!
  totalRevenue: Int!
  averageOrderValue: Float!
  statusDistribution: [StatusCount!]!
}

type StatusCount {
  status: OrderStatus!
  count: Int!
}

type HealthStatus {
  status: String!
  uptime: Float!
  version: String!
}
```

### 3.2 Writing Queries

```graphql
# Example queries from a client

# Basic query
query GetUser {
  user(id: "123") {
    id
    name
    email
    role
  }
}

# Nested query
query GetUserWithOrders {
  user(id: "123") {
    name
    orders(first: 5) {
      edges {
        node {
          id
          status
          total
          items {
            product {
              name
              price
            }
            quantity
            subtotal
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
}

# Query with variables
query GetUsers($first: Int!, $after: String, $role: UserRole) {
  users(first: $first, after: $after, filter: { role: $role }) {
    edges {
      node {
        id
        name
        email
        role
        createdAt
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
# Variables: { "first": 20, "after": null, "role": "ADMIN" }

# Aliases (fetching the same field with different arguments)
query CompareUsers {
  admin: user(id: "1") { name, role, orderCount }
  editor: user(id: "2") { name, role, orderCount }
}

# Fragments (reusing common fields)
fragment UserBasic on User {
  id
  name
  email
  role
}

fragment OrderSummary on Order {
  id
  status
  total
  createdAt
}

query GetMultipleUsers {
  user1: user(id: "1") {
    ...UserBasic
    orderCount
    orders(first: 3) {
      edges {
        node { ...OrderSummary }
      }
    }
  }
  user2: user(id: "2") {
    ...UserBasic
    orderCount
    orders(first: 3) {
      edges {
        node { ...OrderSummary }
      }
    }
  }
}
```

### 3.3 Inline Fragments and Union Type Queries

```graphql
# Inline fragments for Union types
query SearchAll($q: String!) {
  search(query: $q) {
    ... on User {
      __typename
      id
      name
      email
    }
    ... on Post {
      __typename
      id
      title
      body
    }
    ... on Product {
      __typename
      id
      name
      price
    }
  }
}

# __typename is a special field that returns the type name of the object
# Example response:
# {
#   "data": {
#     "search": [
#       { "__typename": "User", "id": "1", "name": "Taro", "email": "..." },
#       { "__typename": "Post", "id": "10", "title": "Intro to GraphQL", "body": "..." },
#       { "__typename": "Product", "id": "100", "name": "GraphQL Book", "price": 3000 }
#     ]
#   }
# }
```

---

## 4. Mutation (Data Modification)

### 4.1 Mutation Type Definition

```graphql
# Schema definition
type Mutation {
  # User
  createUser(input: CreateUserInput!): CreateUserPayload!
  updateUser(id: ID!, input: UpdateUserInput!): UpdateUserPayload!
  deleteUser(id: ID!): DeleteUserPayload!

  # User authentication
  signUp(input: SignUpInput!): AuthPayload!
  signIn(email: Email!, password: String!): AuthPayload!
  refreshToken(token: String!): AuthPayload!

  # Orders
  createOrder(input: CreateOrderInput!): CreateOrderPayload!
  updateOrderStatus(id: ID!, status: OrderStatus!): UpdateOrderPayload!
  cancelOrder(id: ID!): CancelOrderPayload!

  # Products
  createProduct(input: CreateProductInput!): CreateProductPayload!
  updateProduct(id: ID!, input: UpdateProductInput!): UpdateProductPayload!
  deleteProduct(id: ID!): DeleteProductPayload!
}

# Payload pattern (representing success/error)
type CreateUserPayload {
  user: User
  errors: [UserError!]!
}

type UpdateUserPayload {
  user: User
  errors: [UserError!]!
}

type DeleteUserPayload {
  deletedId: ID
  errors: [UserError!]!
}

type AuthPayload {
  token: String
  user: User
  errors: [UserError!]!
}

type CreateOrderPayload {
  order: Order
  errors: [UserError!]!
}

type UpdateOrderPayload {
  order: Order
  errors: [UserError!]!
}

type CancelOrderPayload {
  order: Order
  errors: [UserError!]!
}

# Error type
type UserError {
  field: String               # Name of the field where the error occurred
  message: String!            # Human-readable message
  code: ErrorCode!            # Machine-readable error code
}

enum ErrorCode {
  NOT_FOUND
  VALIDATION_ERROR
  ALREADY_EXISTS
  UNAUTHORIZED
  FORBIDDEN
  INTERNAL_ERROR
  RATE_LIMITED
  INVALID_INPUT
}

input SignUpInput {
  name: String!
  email: Email!
  password: String!
}

input CreateProductInput {
  name: String!
  price: Int!
  description: String
  categoryId: ID!
  tags: [String!]
  imageUrl: URL
  stock: Int!
}

input UpdateProductInput {
  name: String
  price: Int
  description: String
  categoryId: ID
  tags: [String!]
  imageUrl: URL
  stock: Int
}
```

### 4.2 Executing Mutations

```graphql
# Create user
mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) {
    user {
      id
      name
      email
      role
      createdAt
    }
    errors {
      field
      message
      code
    }
  }
}
# Variables: { "input": { "name": "Taro", "email": "taro@example.com" } }

# Success response:
# {
#   "data": {
#     "createUser": {
#       "user": {
#         "id": "456",
#         "name": "Taro",
#         "email": "taro@example.com",
#         "role": "USER",
#         "createdAt": "2024-01-15T10:30:00Z"
#       },
#       "errors": []
#     }
#   }
# }

# Error response:
# {
#   "data": {
#     "createUser": {
#       "user": null,
#       "errors": [
#         {
#           "field": "email",
#           "message": "Email already exists",
#           "code": "ALREADY_EXISTS"
#         }
#       ]
#     }
#   }
# }
```

```graphql
# Authentication (sign in)
mutation SignIn($email: Email!, $password: String!) {
  signIn(email: $email, password: $password) {
    token
    user {
      id
      name
      role
    }
    errors {
      message
      code
    }
  }
}

# Create order
mutation CreateOrder($input: CreateOrderInput!) {
  createOrder(input: $input) {
    order {
      id
      status
      total
      items {
        product { name }
        quantity
        unitPrice
        subtotal
      }
    }
    errors {
      field
      message
      code
    }
  }
}
# Variables:
# {
#   "input": {
#     "items": [
#       { "productId": "prod-1", "quantity": 2 },
#       { "productId": "prod-2", "quantity": 1 }
#     ],
#     "shippingAddress": {
#       "postalCode": "100-0001",
#       "prefecture": "Tokyo",
#       "city": "Chiyoda",
#       "street": "Marunouchi 1-1-1"
#     }
#   }
# }
```

### 4.3 Mutation Design Principles

```
5 Principles for Mutation Design:

  1. Wrap inputs in an Input type
     ✗ createUser(name: String!, email: String!, role: UserRole!)
     ○ createUser(input: CreateUserInput!)
     → When adding arguments, you only need to extend the Input type without changing the query

  2. Use Payload types consistently for return values
     ✗ createUser(input: ...): User!      ← No error information
     ○ createUser(input: ...): CreateUserPayload!
     → Returns both success data and error information in the same response

  3. Design for idempotency
     → Running the same Mutation multiple times produces the same result
     → Deduplicate with a client ID or request ID

  4. Name with verb + noun
     ○ createUser, updateOrder, cancelSubscription
     ✗ userCreate, orderUpdate

  5. One operation per Mutation
     ✗ updateUserAndCreateOrder(...)
     ○ updateUser(...) + createOrder(...) as separate operations
```

---

## 5. Subscription (Real-Time Notifications)

### 5.1 How Subscription Works

```
┌──────────────────────────────────────────────────────────────┐
│                 Subscription Flow                             │
│                                                              │
│  Client                    Server                PubSub      │
│    │                         │                      │        │
│    │  subscription {         │                      │        │
│    │    orderUpdated(userId)  │                      │        │
│    │  }                      │                      │        │
│    │ ───WebSocket connect──→  │                      │        │
│    │                         │  subscribe(topic) →  │        │
│    │                         │                      │        │
│    │         ... waiting ...  │                      │        │
│    │                         │                      │        │
│    │                         │  ← publish(topic,    │        │
│    │                         │      payload)        │        │
│    │  ← { data: {           │                      │        │
│    │       orderUpdated: {   │                      │        │
│    │         id, status      │                      │        │
│    │       }                 │                      │        │
│    │     }                   │                      │        │
│    │    }                    │                      │        │
│    │                         │  ← publish(...)      │        │
│    │  ← { data: {...} }     │                      │        │
│    │                         │                      │        │
│    │  unsubscribe           │                      │        │
│    │ ───WebSocket close───→  │                      │        │
│    │                         │                      │        │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 Subscription Type Definition

```graphql
type Subscription {
  # Subscribe to order status changes
  orderStatusChanged(userId: ID!): OrderStatusEvent!

  # Subscribe to new messages (chat feature)
  messageSent(channelId: ID!): Message!

  # Subscribe to product stock changes
  stockUpdated(productId: ID!): StockEvent!

  # Global notifications
  notificationReceived(userId: ID!): Notification!
}

type OrderStatusEvent {
  order: Order!
  previousStatus: OrderStatus!
  newStatus: OrderStatus!
  changedAt: DateTime!
}

type Message {
  id: ID!
  sender: User!
  content: String!
  sentAt: DateTime!
}

type StockEvent {
  product: Product!
  previousStock: Int!
  newStock: Int!
  changedAt: DateTime!
}

type Notification {
  id: ID!
  type: NotificationType!
  title: String!
  message: String!
  createdAt: DateTime!
}

enum NotificationType {
  ORDER_UPDATE
  PROMOTION
  SYSTEM
  MENTION
}
```

### 5.3 Subscription Resolver Implementation

```javascript
// Subscription resolver using PubSub
import { PubSub } from 'graphql-subscriptions';

const pubsub = new PubSub();

// Event name constants
const EVENTS = {
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
  MESSAGE_SENT: 'MESSAGE_SENT',
  STOCK_UPDATED: 'STOCK_UPDATED',
  NOTIFICATION: 'NOTIFICATION',
};

const resolvers = {
  Subscription: {
    orderStatusChanged: {
      // subscribe function returns an AsyncIterator
      subscribe: (_, { userId }) => {
        return pubsub.asyncIterator(
          `${EVENTS.ORDER_STATUS_CHANGED}.${userId}`
        );
      },
      // resolve function to transform the payload (optional)
      resolve: (payload) => payload,
    },

    messageSent: {
      subscribe: (_, { channelId }, context) => {
        // Authentication check
        if (!context.user) {
          throw new Error('Authentication required');
        }
        return pubsub.asyncIterator(
          `${EVENTS.MESSAGE_SENT}.${channelId}`
        );
      },
    },

    notificationReceived: {
      subscribe: (_, { userId }, context) => {
        if (context.user?.id !== userId) {
          throw new Error('Cannot subscribe to other user notifications');
        }
        return pubsub.asyncIterator(
          `${EVENTS.NOTIFICATION}.${userId}`
        );
      },
    },
  },

  Mutation: {
    updateOrderStatus: async (_, { id, status }, context) => {
      const order = await context.dataSources.orderAPI.updateStatus(id, status);

      // Publish event to Subscription
      pubsub.publish(`${EVENTS.ORDER_STATUS_CHANGED}.${order.userId}`, {
        orderStatusChanged: {
          order,
          previousStatus: order.previousStatus,
          newStatus: status,
          changedAt: new Date().toISOString(),
        },
      });

      return { order, errors: [] };
    },
  },
};
```

### 5.4 Using Subscriptions on the Client

```javascript
// Using Subscription with Apollo Client
import {
  ApolloClient,
  InMemoryCache,
  split,
  HttpLink,
} from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';

// HTTP connection (for Query/Mutation)
const httpLink = new HttpLink({
  uri: 'http://localhost:4000/graphql',
});

// WebSocket connection (for Subscription)
const wsLink = new GraphQLWsLink(
  createClient({
    url: 'ws://localhost:4000/graphql',
    connectionParams: {
      authToken: localStorage.getItem('token'),
    },
  })
);

// Switch links based on operation type
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,   // For Subscriptions
  httpLink  // For Query/Mutation
);

const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});

// Usage in a React component
import { useSubscription, gql } from '@apollo/client';

const ORDER_STATUS_SUBSCRIPTION = gql`
  subscription OnOrderStatusChanged($userId: ID!) {
    orderStatusChanged(userId: $userId) {
      order {
        id
        status
        total
      }
      previousStatus
      newStatus
      changedAt
    }
  }
`;

function OrderTracker({ userId }) {
  const { data, loading, error } = useSubscription(
    ORDER_STATUS_SUBSCRIPTION,
    { variables: { userId } }
  );

  if (loading) return <p>Watching order status...</p>;
  if (error) return <p>Connection error: {error.message}</p>;

  if (data) {
    const { order, previousStatus, newStatus } = data.orderStatusChanged;
    return (
      <div>
        <p>Order #{order.id} status has changed</p>
        <p>{previousStatus} → {newStatus}</p>
      </div>
    );
  }

  return <p>Waiting for updates...</p>;
}
```

---

## 6. Resolver Implementation

### 6.1 Basic Resolver Structure

```
The four arguments of a resolver:

  resolver(parent, args, context, info)

  parent  : The value returned by the parent field's resolver
            (undefined for root resolvers)
  args    : Arguments passed in the query
  context : An object shared across the entire request
            (auth info, DataSource, DataLoader, etc.)
  info    : AST information about the query
            (field name, path, selection set, etc.)

  ┌──────────────────────────────────────────────────────┐
  │  Resolver Chain (execution order)                    │
  │                                                      │
  │  query {                                             │
  │    user(id: "1") {        ← Query.user resolver      │
  │      name                 ← Default resolver         │
  │      orders {             ← User.orders resolver     │
  │        items {            ← Order.items resolver     │
  │          product {        ← OrderItem.product resolver│
  │            name           ← Default resolver         │
  │          }                                           │
  │        }                                             │
  │      }                                               │
  │    }                                                 │
  │  }                                                   │
  │                                                      │
  │  Default resolver:                                   │
  │    Returns parent[fieldName]                         │
  │    → Automatically resolved if the parent object     │
  │      has a property with the same name               │
  └──────────────────────────────────────────────────────┘
```

### 6.2 Resolver Implementation

```javascript
// Resolver implementation with Apollo Server
import { GraphQLScalarType, Kind } from 'graphql';

const resolvers = {
  // === Root resolvers ===
  Query: {
    // Fetch a single user
    user: async (parent, { id }, context) => {
      // Authentication check
      if (!context.user) {
        throw new AuthenticationError('Login required');
      }
      const user = await context.dataSources.userAPI.getUser(id);
      if (!user) return null;
      return user;
    },

    // List users (cursor pagination)
    users: async (parent, { first = 20, after, filter, sort }, context) => {
      const { nodes, totalCount, hasNextPage, hasPreviousPage } =
        await context.dataSources.userAPI.listUsers({
          first,
          after,
          filter,
          sort,
        });

      const edges = nodes.map((node) => ({
        node,
        cursor: Buffer.from(`cursor:${node.id}`).toString('base64'),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage,
          startCursor: edges[0]?.cursor ?? null,
          endCursor: edges[edges.length - 1]?.cursor ?? null,
        },
        totalCount,
      };
    },

    // Search
    search: async (parent, { query, types }, context) => {
      const results = [];

      if (!types || types.includes('USER')) {
        const users = await context.dataSources.userAPI.search(query);
        results.push(...users);
      }
      if (!types || types.includes('POST')) {
        const posts = await context.dataSources.postAPI.search(query);
        results.push(...posts);
      }
      if (!types || types.includes('PRODUCT')) {
        const products = await context.dataSources.productAPI.search(query);
        results.push(...products);
      }

      return results;
    },

    // Current user
    me: (parent, args, context) => {
      return context.user || null;
    },
  },

  // === Mutation resolvers ===
  Mutation: {
    createUser: async (parent, { input }, context) => {
      try {
        // Validation
        if (!input.name || input.name.trim().length === 0) {
          return {
            user: null,
            errors: [{
              field: 'name',
              message: 'Name is required',
              code: 'VALIDATION_ERROR',
            }],
          };
        }

        const user = await context.dataSources.userAPI.createUser(input);
        return { user, errors: [] };
      } catch (error) {
        if (error.code === 'DUPLICATE_EMAIL') {
          return {
            user: null,
            errors: [{
              field: 'email',
              message: 'Email address is already registered',
              code: 'ALREADY_EXISTS',
            }],
          };
        }
        return {
          user: null,
          errors: [{
            field: null,
            message: 'An unexpected error occurred',
            code: 'INTERNAL_ERROR',
          }],
        };
      }
    },

    updateUser: async (parent, { id, input }, context) => {
      // Authorization check (only the user themselves or ADMIN)
      if (context.user.id !== id && context.user.role !== 'ADMIN') {
        return {
          user: null,
          errors: [{
            field: null,
            message: 'You do not have permission to modify another user\'s information',
            code: 'FORBIDDEN',
          }],
        };
      }

      try {
        const user = await context.dataSources.userAPI.updateUser(id, input);
        return { user, errors: [] };
      } catch (error) {
        return {
          user: null,
          errors: [{
            field: error.field || null,
            message: error.message,
            code: error.code || 'INTERNAL_ERROR',
          }],
        };
      }
    },

    deleteUser: async (parent, { id }, context) => {
      if (context.user.role !== 'ADMIN') {
        return {
          deletedId: null,
          errors: [{
            field: null,
            message: 'Admin privileges required',
            code: 'FORBIDDEN',
          }],
        };
      }
      await context.dataSources.userAPI.deleteUser(id);
      return { deletedId: id, errors: [] };
    },
  },

  // === Field-level resolvers ===
  User: {
    // user.orders is fetched from a separate table
    orders: async (user, { first = 10, after }, context) => {
      return context.dataSources.orderAPI.getOrdersByUserId(
        user.id, first, after
      );
    },

    // Computed field
    orderCount: async (user, args, context) => {
      return context.dataSources.orderAPI.countByUserId(user.id);
    },

    // Followers
    followers: async (user, args, context) => {
      return context.dataSources.userAPI.getFollowers(user.id);
    },
  },

  Order: {
    // User associated with the order
    user: async (order, args, context) => {
      return context.dataSources.userAPI.getUser(order.userId);
    },

    items: async (order, args, context) => {
      return context.dataSources.orderAPI.getOrderItems(order.id);
    },
  },

  OrderItem: {
    product: async (item, args, context) => {
      return context.dataSources.productAPI.getProduct(item.productId);
    },

    // Computed field
    subtotal: (item) => item.quantity * item.unitPrice,
  },

  // === Union type resolver ===
  SearchResult: {
    __resolveType(obj) {
      // Determine the type of the object
      if (obj.email) return 'User';
      if (obj.body) return 'Post';
      if (obj.price !== undefined) return 'Product';
      return null;
    },
  },

  // === Custom scalars ===
  DateTime: new GraphQLScalarType({
    name: 'DateTime',
    description: 'Date/time string in ISO 8601 format',
    serialize(value) {
      return value instanceof Date ? value.toISOString() : value;
    },
    parseValue(value) {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid DateTime format');
      }
      return date;
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.STRING) {
        const date = new Date(ast.value);
        if (isNaN(date.getTime())) {
          throw new Error('Invalid DateTime format');
        }
        return date;
      }
      return null;
    },
  }),

  Email: new GraphQLScalarType({
    name: 'Email',
    description: 'String in email address format',
    serialize(value) {
      return value;
    },
    parseValue(value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        throw new Error('Invalid email format');
      }
      return value.toLowerCase();
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.STRING) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(ast.value)) {
          throw new Error('Invalid email format');
        }
        return ast.value.toLowerCase();
      }
      return null;
    },
  }),
};
```

---

## 7. Apollo Server Setup

### 7.1 Basic Setup

```javascript
// server.js - Apollo Server v4
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { expressMiddleware } from '@apollo/server/express4';
import { readFileSync } from 'fs';
import express from 'express';
import cors from 'cors';
import http from 'http';

// Load the schema file
const typeDefs = readFileSync('./schema.graphql', 'utf-8');

// Create the server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  // Introspection (recommended to disable in production)
  introspection: process.env.NODE_ENV !== 'production',
  // Plugins
  plugins: [
    // Landing page (shows GraphQL Playground in development)
    process.env.NODE_ENV === 'production'
      ? ApolloServerPluginLandingPageDisabled()
      : ApolloServerPluginLandingPageLocalDefault(),
    // Response cache
    responseCachePlugin(),
    // Logging plugin
    {
      async requestDidStart(requestContext) {
        const start = Date.now();
        return {
          async willSendResponse(ctx) {
            const duration = Date.now() - start;
            console.log(
              `[GraphQL] ${ctx.operation?.operation} ` +
              `${ctx.operation?.name?.value || 'anonymous'} ` +
              `${duration}ms`
            );
          },
          async didEncounterErrors(ctx) {
            for (const err of ctx.errors) {
              console.error('[GraphQL Error]', err.message, err.extensions);
            }
          },
        };
      },
    },
  ],
  // Format errors (hide stack traces in production)
  formatError: (formattedError, error) => {
    if (process.env.NODE_ENV === 'production') {
      // Hide details of internal errors
      if (formattedError.extensions?.code === 'INTERNAL_SERVER_ERROR') {
        return {
          message: 'Internal server error',
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        };
      }
    }
    return formattedError;
  },
});

// Standalone mode (simplest option)
const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
  context: async ({ req }) => ({
    // Authentication
    user: await authenticateUser(req.headers.authorization),
    // Data sources
    dataSources: {
      userAPI: new UserAPI(),
      orderAPI: new OrderAPI(),
      productAPI: new ProductAPI(),
    },
  }),
});

console.log(`GraphQL server ready at ${url}`);
```

### 7.2 Express Integration Setup

```javascript
// express-server.js - Express + Apollo Server + WebSocket (Subscription support)
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import express from 'express';
import http from 'http';
import cors from 'cors';
import bodyParser from 'body-parser';

// Create the schema
const schema = makeExecutableSchema({ typeDefs, resolvers });

// Express + HTTP server
const app = express();
const httpServer = http.createServer(app);

// WebSocket server (for Subscriptions)
const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/graphql',
});

// Configure WebSocket cleanup
const serverCleanup = useServer(
  {
    schema,
    context: async (ctx) => {
      // Authentication on WebSocket connect
      const token = ctx.connectionParams?.authToken;
      const user = await authenticateToken(token);
      return {
        user,
        dataSources: {
          userAPI: new UserAPI(),
          orderAPI: new OrderAPI(),
        },
      };
    },
    onConnect: async (ctx) => {
      console.log('WebSocket client connected');
    },
    onDisconnect: (ctx) => {
      console.log('WebSocket client disconnected');
    },
  },
  wsServer
);

// Apollo Server
const server = new ApolloServer({
  schema,
  plugins: [
    // Graceful HTTP server shutdown
    ApolloServerPluginDrainHttpServer({ httpServer }),
    // Graceful WebSocket server shutdown
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
  ],
});

await server.start();

// Register as Express middleware
app.use(
  '/graphql',
  cors(),
  bodyParser.json(),
  expressMiddleware(server, {
    context: async ({ req }) => ({
      user: await authenticateUser(req.headers.authorization),
      dataSources: {
        userAPI: new UserAPI(),
        orderAPI: new OrderAPI(),
      },
    }),
  })
);

// Health check endpoint (REST)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server ready at http://localhost:${PORT}/graphql`);
  console.log(`Subscriptions ready at ws://localhost:${PORT}/graphql`);
});
```

### 7.3 Authentication and Authorization Patterns

```javascript
// auth.js - Authentication and authorization utilities

import jwt from 'jsonwebtoken';

// Retrieve user from JWT token
async function authenticateUser(authHeader) {
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findById(decoded.userId);
    return user;
  } catch (error) {
    return null; // Return null for invalid tokens (do not throw)
  }
}

// Directive-based authorization
import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';
import { defaultFieldResolver } from 'graphql';

function authDirectiveTransformer(schema) {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const authDirective = getDirective(schema, fieldConfig, 'auth')?.[0];
      if (authDirective) {
        const { requires } = authDirective;
        const originalResolver = fieldConfig.resolve || defaultFieldResolver;

        fieldConfig.resolve = async (parent, args, context, info) => {
          // Authentication check
          if (!context.user) {
            throw new Error('Authentication required');
          }

          // Authorization check
          if (requires && context.user.role !== requires) {
            throw new Error(
              `This operation requires ${requires} privileges`
            );
          }

          return originalResolver(parent, args, context, info);
        };
      }
      return fieldConfig;
    },
  });
}

// Usage (schema transformation)
let schema = makeExecutableSchema({ typeDefs, resolvers });
schema = authDirectiveTransformer(schema);
```

### 7.4 DataSource Pattern

```javascript
// data-sources/user-api.js
// DataSource implementation using RESTDataSource
import { RESTDataSource } from '@apollo/datasource-rest';

class UserAPI extends RESTDataSource {
  constructor() {
    super();
    this.baseURL = 'http://internal-api:3000/';
  }

  // Configure cache TTL
  override cacheOptionsFor() {
    return { ttl: 60 }; // Cache for 60 seconds
  }

  async getUser(id) {
    return this.get(`users/${id}`);
  }

  async listUsers({ first, after, filter, sort }) {
    const params = { limit: first };
    if (after) params.cursor = after;
    if (filter?.role) params.role = filter.role;
    if (sort) params.sort = sort;

    return this.get('users', { params });
  }

  async createUser(input) {
    return this.post('users', { body: input });
  }

  async updateUser(id, input) {
    return this.patch(`users/${id}`, { body: input });
  }

  async deleteUser(id) {
    return this.delete(`users/${id}`);
  }

  async search(query) {
    const results = await this.get('users/search', {
      params: { q: query },
    });
    return results.map((user) => ({ ...user, __typename: 'User' }));
  }
}

// data-sources/database-source.js
// DataSource using a SQL database directly

class DatabaseSource {
  constructor(pool) {
    this.pool = pool; // Database connection pool
  }

  async getUser(id) {
    const { rows } = await this.pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  }

  async listUsers({ first, after, filter, sort }) {
    let query = 'SELECT * FROM users WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (after) {
      const decodedCursor = Buffer.from(after, 'base64')
        .toString('utf-8')
        .replace('cursor:', '');
      query += ` AND id > $${paramIndex++}`;
      params.push(decodedCursor);
    }

    if (filter?.role) {
      query += ` AND role = $${paramIndex++}`;
      params.push(filter.role);
    }

    if (filter?.nameContains) {
      query += ` AND name ILIKE $${paramIndex++}`;
      params.push(`%${filter.nameContains}%`);
    }

    // Sorting
    const sortMap = {
      CREATED_AT_ASC: 'created_at ASC',
      CREATED_AT_DESC: 'created_at DESC',
      NAME_ASC: 'name ASC',
      NAME_DESC: 'name DESC',
    };
    query += ` ORDER BY ${sortMap[sort] || 'created_at DESC'}`;

    // Pagination (fetch +1 to determine if a next page exists)
    query += ` LIMIT $${paramIndex++}`;
    params.push(first + 1);

    const { rows } = await this.pool.query(query, params);
    const hasNextPage = rows.length > first;
    const nodes = hasNextPage ? rows.slice(0, first) : rows;

    return {
      nodes,
      totalCount: await this.countUsers(filter),
      hasNextPage,
      hasPreviousPage: !!after,
    };
  }

  async countUsers(filter) {
    let query = 'SELECT COUNT(*) FROM users WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (filter?.role) {
      query += ` AND role = $${paramIndex++}`;
      params.push(filter.role);
    }

    const { rows } = await this.pool.query(query, params);
    return parseInt(rows[0].count, 10);
  }
}
```

---

## 8. The N+1 Problem and DataLoader

### 8.1 What Is the N+1 Problem

```
The N+1 problem illustrated:

  query {
    users(first: 10) {        ← 1 SQL query (fetch 10 users)
      edges {
        node {
          name
          orders {             ← 1 SQL query per user (×10 times)
            id
            total
          }
        }
      }
    }
  }

  SQL executed:
    1. SELECT * FROM users LIMIT 10              -- 1 time
    2. SELECT * FROM orders WHERE user_id = 1    -- Orders for User 1
    3. SELECT * FROM orders WHERE user_id = 2    -- Orders for User 2
    4. SELECT * FROM orders WHERE user_id = 3    -- Orders for User 3
    ...
   11. SELECT * FROM orders WHERE user_id = 10   -- Orders for User 10

  → 11 total DB queries (1 + N = 1 + 10 = 11)

  Resolved with DataLoader:
    1. SELECT * FROM users LIMIT 10              -- 1 time
    2. SELECT * FROM orders WHERE user_id IN (1,2,3,...,10) -- 1 time

  → 2 total DB queries
```

### 8.2 DataLoader Implementation

```javascript
// data-loaders.js
import DataLoader from 'dataloader';

// DataLoader factory (create a new instance per request)
function createLoaders(db) {
  return {
    // User loader
    userLoader: new DataLoader(async (userIds) => {
      // Batch function: receives an array of IDs and returns results in the same order
      const users = await db.query(
        'SELECT * FROM users WHERE id = ANY($1)',
        [userIds]
      );

      // Map preserving ID order
      const userMap = new Map(users.rows.map((u) => [u.id, u]));
      return userIds.map((id) => userMap.get(id) || null);
    }),

    // Orders by user ID loader (1:N relationship)
    ordersByUserIdLoader: new DataLoader(async (userIds) => {
      const orders = await db.query(
        'SELECT * FROM orders WHERE user_id = ANY($1) ORDER BY created_at DESC',
        [userIds]
      );

      // Group by user ID
      const orderMap = new Map();
      for (const order of orders.rows) {
        if (!orderMap.has(order.user_id)) {
          orderMap.set(order.user_id, []);
        }
        orderMap.get(order.user_id).push(order);
      }

      return userIds.map((id) => orderMap.get(id) || []);
    }),

    // Product loader
    productLoader: new DataLoader(async (productIds) => {
      const products = await db.query(
        'SELECT * FROM products WHERE id = ANY($1)',
        [productIds]
      );

      const productMap = new Map(products.rows.map((p) => [p.id, p]));
      return productIds.map((id) => productMap.get(id) || null);
    }),

    // Order items by order ID loader (1:N relationship)
    orderItemsByOrderIdLoader: new DataLoader(async (orderIds) => {
      const items = await db.query(
        'SELECT * FROM order_items WHERE order_id = ANY($1)',
        [orderIds]
      );

      const itemMap = new Map();
      for (const item of items.rows) {
        if (!itemMap.has(item.order_id)) {
          itemMap.set(item.order_id, []);
        }
        itemMap.get(item.order_id).push(item);
      }

      return orderIds.map((id) => itemMap.get(id) || []);
    }),
  };
}

// Set up DataLoader in context
const server = new ApolloServer({ typeDefs, resolvers });

const { url } = await startStandaloneServer(server, {
  context: async ({ req }) => ({
    user: await authenticateUser(req.headers.authorization),
    // Create new loaders per request (cache is request-scoped)
    loaders: createLoaders(db),
    db,
  }),
});

// Using DataLoader in resolvers
const resolversWithLoader = {
  Query: {
    user: (_, { id }, { loaders }) => loaders.userLoader.load(id),
  },
  User: {
    orders: (user, _, { loaders }) =>
      loaders.ordersByUserIdLoader.load(user.id),
  },
  Order: {
    user: (order, _, { loaders }) => loaders.userLoader.load(order.userId),
    items: (order, _, { loaders }) =>
      loaders.orderItemsByOrderIdLoader.load(order.id),
  },
  OrderItem: {
    product: (item, _, { loaders }) =>
      loaders.productLoader.load(item.productId),
  },
};
```

### 8.3 DataLoader Considerations

```
Notes when using DataLoader:

  1. Create per request scope
     ✗ Create a single global DataLoader instance
       → Cache leaks across other requests (security risk)
     ○ Create a new instance per request during context generation

  2. Batch function must return results in the same order as the input
     ✗ [id=3, id=1, id=2] → [user1, user2, user3]  (by ID order)
     ○ [id=3, id=1, id=2] → [user3, user1, user2]  (by input order)

  3. Return null for missing keys (not an error)
     ✗ throw new Error('User not found')
     ○ return null

  4. Cache invalidation
     → After a Mutation, call loader.clear(id) or loader.clearAll()
     → Required to reload updated data

  5. Batch size limits
     → Configurable with the maxBatchSize option
     → Align with DB IN clause limits (PostgreSQL supports ~65,000 parameters)
```

---

## 9. Client Implementation

### 9.1 Apollo Client Setup

```javascript
// apollo-client.js
import {
  ApolloClient,
  InMemoryCache,
  ApolloLink,
  from,
} from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';

// Error handling link
const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `[GraphQL Error] Message: ${message}, ` +
        `Location: ${JSON.stringify(locations)}, ` +
        `Path: ${path}, Code: ${extensions?.code}`
      );

      // Log out on authentication error
      if (extensions?.code === 'UNAUTHENTICATED') {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    });
  }

  if (networkError) {
    console.error(`[Network Error] ${networkError}`);
  }
});

// Retry link
const retryLink = new RetryLink({
  delay: {
    initial: 300,
    max: 3000,
    jitter: true,
  },
  attempts: {
    max: 3,
    retryIf: (error) => !!error,
  },
});

// Auth link (attach token to request headers)
const authLink = new ApolloLink((operation, forward) => {
  const token = localStorage.getItem('token');
  operation.setContext({
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  });
  return forward(operation);
});

// Cache configuration
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        // Pagination merge policy
        users: {
          keyArgs: ['filter', 'sort'],
          merge(existing, incoming, { args }) {
            if (!args?.after) return incoming;
            return {
              ...incoming,
              edges: [...(existing?.edges || []), ...incoming.edges],
            };
          },
        },
      },
    },
    User: {
      // Cache key for users
      keyFields: ['id'],
    },
    Order: {
      keyFields: ['id'],
    },
  },
});

// Create client
const client = new ApolloClient({
  link: from([errorLink, retryLink, authLink, httpLink]),
  cache,
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network', // Serve from cache first, then fetch fresh data
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});
```

### 9.2 Usage in React Components

```javascript
// components/UserList.jsx
import { useQuery, useMutation, gql } from '@apollo/client';

// Query definition
const GET_USERS = gql`
  query GetUsers($first: Int!, $after: String, $filter: UserFilter) {
    users(first: $first, after: $after, filter: $filter) {
      edges {
        node {
          id
          name
          email
          role
          createdAt
          orderCount
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

const DELETE_USER = gql`
  mutation DeleteUser($id: ID!) {
    deleteUser(id: $id) {
      deletedId
      errors {
        message
        code
      }
    }
  }
`;

function UserList() {
  const { loading, error, data, fetchMore } = useQuery(GET_USERS, {
    variables: { first: 20 },
  });

  const [deleteUser] = useMutation(DELETE_USER, {
    // Update cache after Mutation
    update(cache, { data: { deleteUser: result } }) {
      if (result.deletedId) {
        cache.modify({
          fields: {
            users(existingConnection, { readField }) {
              return {
                ...existingConnection,
                edges: existingConnection.edges.filter(
                  (edge) => readField('id', edge.node) !== result.deletedId
                ),
                totalCount: existingConnection.totalCount - 1,
              };
            },
          },
        });
      }
    },
  });

  if (loading && !data) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  const { edges, pageInfo, totalCount } = data.users;

  return (
    <div>
      <h1>User List ({totalCount} users)</h1>
      <ul>
        {edges.map(({ node }) => (
          <li key={node.id}>
            {node.name} ({node.email}) - {node.role}
            <span>Orders: {node.orderCount}</span>
            <button onClick={() => deleteUser({ variables: { id: node.id } })}>
              Delete
            </button>
          </li>
        ))}
      </ul>
      {pageInfo.hasNextPage && (
        <button
          onClick={() =>
            fetchMore({
              variables: { after: pageInfo.endCursor },
            })
          }
        >
          Load more
        </button>
      )}
    </div>
  );
}

// components/UserProfile.jsx
const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
      role
      bio
      createdAt
      orders(first: 5) {
        edges {
          node {
            id
            status
            total
            createdAt
            items {
              product { name, price }
              quantity
              subtotal
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

function UserProfile({ userId }) {
  const { loading, error, data } = useQuery(GET_USER, {
    variables: { id: userId },
    // Polling (auto-refresh every 10 seconds)
    // pollInterval: 10000,
  });

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  if (!data.user) return <p>User not found</p>;

  const { user } = data;
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <p>Role: {user.role}</p>
      {user.bio && <p>{user.bio}</p>}
      <h2>Order History</h2>
      {user.orders.edges.map(({ node }) => (
        <div key={node.id}>
          <h3>Order #{node.id}</h3>
          <p>Status: {node.status}</p>
          <p>Total: {node.total.toLocaleString()}</p>
          <ul>
            {node.items.map((item, i) => (
              <li key={i}>
                {item.product.name} x {item.quantity} = {item.subtotal.toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

---

## 10. Error Handling

### 10.1 GraphQL Error Model

```
GraphQL error classification:

  ┌──────────────────────────────────────────────────────────────┐
  │               Three-layer GraphQL Error Model                │
  │                                                              │
  │  Layer 1: Network errors                                     │
  │    → HTTP-level errors (connection timeout, DNS failure, etc.)│
  │    → HTTP response status is 4xx/5xx                         │
  │    → The GraphQL server was not reached                      │
  │                                                              │
  │  Layer 2: GraphQL execution errors (errors field)            │
  │    → Parse failure, validation failure, resolver exceptions  │
  │    → HTTP status is 200 but errors field contains error info │
  │    → data may be partial (some fields null)                  │
  │                                                              │
  │  Layer 3: Business logic errors (Payload errors field)       │
  │    → Application-specific errors (validation, authorization) │
  │    → Successful as GraphQL (no errors field)                 │
  │    → Expressed via errors inside the Payload object          │
  │                                                              │
  └──────────────────────────────────────────────────────────────┘
```

### 10.2 Error Response Format

```javascript
// Layer 2: GraphQL execution error example
// Error thrown inside a resolver
{
  "data": {
    "user": null
  },
  "errors": [
    {
      "message": "Authentication required",
      "locations": [{ "line": 2, "column": 3 }],
      "path": ["user"],
      "extensions": {
        "code": "UNAUTHENTICATED",
        "http": { "status": 401 }
      }
    }
  ]
}

// Layer 3: Business logic error example
// Error via Payload pattern
{
  "data": {
    "createUser": {
      "user": null,
      "errors": [
        {
          "field": "email",
          "message": "Email address is already registered",
          "code": "ALREADY_EXISTS"
        },
        {
          "field": "name",
          "message": "Name must be at least 2 characters",
          "code": "VALIDATION_ERROR"
        }
      ]
    }
  }
}

// Partial Data example
// Return other fields even if some fail
{
  "data": {
    "user": {
      "name": "Taro",
      "email": "taro@example.com",
      "orders": null  // ← Only this field errored
    }
  },
  "errors": [
    {
      "message": "Cannot connect to order service",
      "path": ["user", "orders"],
      "extensions": { "code": "SERVICE_UNAVAILABLE" }
    }
  ]
}
```

### 10.3 Error Design Best Practices

```
Error design guidelines:

  1. Expected errors → Payload pattern (Layer 3)
     - Validation errors
     - Duplicate registration
     - Insufficient permissions
     → Client can handle in a type-safe manner

  2. Unexpected errors → GraphQL errors (Layer 2)
     - Expired authentication
     - Internal server errors
     - Resource limit exceeded
     → Classify with extensions.code

  3. Always define error codes
     → Human-readable messages may change; codes are stable
     → Also useful for client-side i18n

  4. Include a field path in errors
     → Identifies which form field caused the error
     → Directly improves UX
```

---

## 11. Testing Strategy

### 11.1 Unit Testing Resolvers

```javascript
// __tests__/resolvers/user.test.js
import { resolvers } from '../../resolvers';

describe('Query.user', () => {
  const mockContext = {
    user: { id: '1', role: 'ADMIN' },
    dataSources: {
      userAPI: {
        getUser: jest.fn(),
      },
    },
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch a user by ID', async () => {
    const mockUser = {
      id: '123',
      name: 'Taro',
      email: 'taro@example.com',
      role: 'USER',
    };
    mockContext.dataSources.userAPI.getUser.mockResolvedValue(mockUser);

    const result = await resolvers.Query.user(
      null,
      { id: '123' },
      mockContext
    );

    expect(result).toEqual(mockUser);
    expect(mockContext.dataSources.userAPI.getUser).toHaveBeenCalledWith('123');
  });

  it('should return null for a non-existent ID', async () => {
    mockContext.dataSources.userAPI.getUser.mockResolvedValue(null);

    const result = await resolvers.Query.user(
      null,
      { id: 'nonexistent' },
      mockContext
    );

    expect(result).toBeNull();
  });
});

describe('Mutation.createUser', () => {
  const mockContext = {
    user: { id: '1', role: 'ADMIN' },
    dataSources: {
      userAPI: {
        createUser: jest.fn(),
      },
    },
  };

  it('should create a user successfully', async () => {
    const input = { name: 'Taro', email: 'taro@example.com' };
    const createdUser = { id: '456', ...input, role: 'USER' };
    mockContext.dataSources.userAPI.createUser.mockResolvedValue(createdUser);

    const result = await resolvers.Mutation.createUser(
      null,
      { input },
      mockContext
    );

    expect(result.user).toEqual(createdUser);
    expect(result.errors).toEqual([]);
  });

  it('should return an error for a duplicate email', async () => {
    const input = { name: 'Taro', email: 'existing@example.com' };
    mockContext.dataSources.userAPI.createUser.mockRejectedValue({
      code: 'DUPLICATE_EMAIL',
      field: 'email',
      message: 'Email address is already registered',
    });

    const result = await resolvers.Mutation.createUser(
      null,
      { input },
      mockContext
    );

    expect(result.user).toBeNull();
    expect(result.errors[0].code).toBe('ALREADY_EXISTS');
  });
});
```

### 11.2 Integration Tests

```javascript
// __tests__/integration/server.test.js
import { ApolloServer } from '@apollo/server';
import { readFileSync } from 'fs';
import assert from 'assert';

const typeDefs = readFileSync('./schema.graphql', 'utf-8');

describe('GraphQL Server Integration Tests', () => {
  let server;

  beforeAll(() => {
    server = new ApolloServer({ typeDefs, resolvers });
  });

  it('should correctly execute a user fetch query', async () => {
    const response = await server.executeOperation(
      {
        query: `
          query GetUser($id: ID!) {
            user(id: $id) {
              id
              name
              email
            }
          }
        `,
        variables: { id: '123' },
      },
      {
        contextValue: {
          user: { id: '1', role: 'ADMIN' },
          dataSources: {
            userAPI: {
              getUser: async (id) => ({
                id,
                name: 'Test User',
                email: 'test@example.com',
              }),
            },
          },
        },
      }
    );

    assert.strictEqual(response.body.kind, 'single');
    const { data, errors } = response.body.singleResult;
    assert.strictEqual(errors, undefined);
    assert.strictEqual(data.user.name, 'Test User');
  });

  it('should error on unauthenticated requests', async () => {
    const response = await server.executeOperation(
      {
        query: `query { users(first: 10) { edges { node { id } } } }`,
      },
      {
        contextValue: {
          user: null, // Unauthenticated
          dataSources: {
            userAPI: { listUsers: jest.fn() },
          },
        },
      }
    );

    assert.strictEqual(response.body.kind, 'single');
    const { errors } = response.body.singleResult;
    assert(errors && errors.length > 0);
  });
});
```

---

## 12. Security

### 12.1 Query Depth Limiting

```javascript
// Security: limit query depth
import depthLimit from 'graphql-depth-limit';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [
    depthLimit(10), // Maximum depth of 10
  ],
});

// Queries exceeding depth 10 are rejected at validation
// Example of a malicious query:
// query {
//   user(id: "1") {       // depth 1
//     orders {             // depth 2
//       items {            // depth 3
//         product {        // depth 4
//           category {     // depth 5
//             parent {     // depth 6 (recursive)
//               parent {   // depth 7
//                 ...      // potentially infinite recursion
//               }
//             }
//           }
//         }
//       }
//     }
//   }
// }
```

### 12.2 Query Complexity Limiting

```javascript
// Query complexity (cost) limiting
import { createComplexityRule, simpleEstimator } from 'graphql-query-complexity';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [
    createComplexityRule({
      maximumComplexity: 1000,
      estimators: [
        simpleEstimator({ defaultComplexity: 1 }),
      ],
      onComplete: (complexity) => {
        console.log(`Query complexity: ${complexity}`);
      },
    }),
  ],
});

// Specify per-field cost at the schema level
// type Query {
//   users(first: Int): UserConnection! @complexity(value: 10, multipliers: ["first"])
//   user(id: ID!): User @complexity(value: 1)
// }
//
// Cost of users(first: 100) = 10 * 100 = 1000 → hits the limit
```

### 12.3 Rate Limiting and APQ

```javascript
// Automatic Persisted Queries (APQ)
// Send a hash of the query string; the server executes the cached query
// → Reduces query string transfer size and prevents arbitrary query execution

import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
} from '@apollo/client';
import { createPersistedQueryLink } from '@apollo/client/link/persisted-queries';
import { sha256 } from 'crypto-hash';

const httpLink = createHttpLink({ uri: '/graphql' });

const persistedQueriesLink = createPersistedQueryLink({
  sha256,
  useGETForHashedQueries: true, // Use GET requests to leverage CDN caching
});

const client = new ApolloClient({
  link: persistedQueriesLink.concat(httpLink),
  cache: new InMemoryCache(),
});

// Server side: allowedOperations whitelist (for production)
// → Allow execution only of registered queries
// → Prevents arbitrary query execution from GraphiQL, etc.
```

---

## 13. Anti-Patterns

### 13.1 Anti-Pattern 1: Monolithic Single Resolver

```javascript
// ===== Anti-pattern: Monolithic single resolver =====
// Cramming all logic into one resolver

const badResolvers = {
  Query: {
    user: async (_, { id }, context) => {
      // DB query
      const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);

      // Fetch orders (causes N+1 problem)
      const orders = await db.query(
        'SELECT * FROM orders WHERE user_id = $1', [id]
      );

      // Fetch items for each order (another N+1)
      for (const order of orders.rows) {
        order.items = await db.query(
          'SELECT * FROM order_items WHERE order_id = $1', [order.id]
        );
        // Fetch product for each item (yet another N+1)
        for (const item of order.items.rows) {
          item.product = await db.query(
            'SELECT * FROM products WHERE id = $1', [item.product_id]
          );
        }
      }

      // Validation, transformation, caching all here...
      user.rows[0].orders = orders.rows;
      return user.rows[0];
    },
  },
};

// Problems:
// 1. N+1 problem (individual queries per order and per item)
// 2. Fetches all data even if the client did not request orders
// 3. Hard to test (many mock targets)
// 4. No separation of concerns

// ===== Improvement: Field resolvers + DataLoader =====
const goodResolvers = {
  Query: {
    user: (_, { id }, { loaders }) => loaders.userLoader.load(id),
  },
  User: {
    orders: (user, _, { loaders }) =>
      loaders.ordersByUserIdLoader.load(user.id),
  },
  Order: {
    items: (order, _, { loaders }) =>
      loaders.orderItemsByOrderIdLoader.load(order.id),
  },
  OrderItem: {
    product: (item, _, { loaders }) =>
      loaders.productLoader.load(item.productId),
  },
};
// → Each field is independent; DataLoader batches queries; only required fields resolved
```

### 13.2 Anti-Pattern 2: Tight Coupling of Schema and Business Logic

```javascript
// ===== Anti-pattern: Business logic written directly in resolvers =====

const badMutationResolver = {
  Mutation: {
    createOrder: async (_, { input }, context) => {
      // Stock check (business logic)
      for (const item of input.items) {
        const product = await db.query(
          'SELECT stock FROM products WHERE id = $1', [item.productId]
        );
        if (product.rows[0].stock < item.quantity) {
          return {
            order: null,
            errors: [{
              field: 'items',
              message: `Insufficient stock for ${product.rows[0].name}`,
              code: 'VALIDATION_ERROR',
            }],
          };
        }
      }

      // Total calculation (business logic)
      let total = 0;
      for (const item of input.items) {
        const product = await db.query(
          'SELECT price FROM products WHERE id = $1', [item.productId]
        );
        total += product.rows[0].price * item.quantity;
      }

      // Apply discount (business logic)
      if (total > 10000) {
        total = Math.floor(total * 0.9);
      }

      // DB writes, email sends, etc. all here...
      // → Hard to test, not reusable, high change risk
    },
  },
};

// ===== Improvement: Extract to a service layer =====

// services/order-service.js
class OrderService {
  constructor(db, productService, notificationService) {
    this.db = db;
    this.productService = productService;
    this.notificationService = notificationService;
  }

  async createOrder(input, userId) {
    // Validation
    const validationErrors = await this.validateOrderInput(input);
    if (validationErrors.length > 0) {
      return { order: null, errors: validationErrors };
    }

    // Total calculation
    const total = await this.calculateTotal(input.items);

    // Create order
    const order = await this.db.createOrder({
      userId,
      items: input.items,
      total,
      status: 'PENDING',
    });

    // Notification
    await this.notificationService.sendOrderConfirmation(order);

    return { order, errors: [] };
  }

  async validateOrderInput(input) { /* ... */ }
  async calculateTotal(items) { /* ... */ }
}

// Resolver acts as a thin layer
const goodMutationResolver = {
  Mutation: {
    createOrder: async (_, { input }, context) => {
      return context.services.orderService.createOrder(input, context.user.id);
    },
  },
};
// → Easy to test, logic is reusable, separation of concerns
```

### 13.3 Anti-Pattern 3: Allowing Excessive Nesting

```
Anti-pattern: Ignoring circular references

  type User {
    orders: [Order!]!
  }
  type Order {
    user: User!       ← User → Order → User → Order → ... infinite loop possible
    items: [OrderItem!]!
  }
  type OrderItem {
    order: Order!     ← OrderItem → Order → OrderItem → ... circular
  }

  Malicious query:
  query DeepNested {
    user(id: "1") {
      orders {
        user {
          orders {
            user {
              orders {
                # ... can continue indefinitely
              }
            }
          }
        }
      }
    }
  }

  Countermeasures:
  1. Depth limiting via depthLimit (see Section 12.1)
  2. Complexity cost limiting (see Section 12.2)
  3. Set query timeouts
  4. Design reverse references carefully (only add when truly needed)
```

---

## 14. Edge Case Analysis

### 14.1 Edge Case 1: Chained Nullable Fields

```graphql
# Problem: accessing nested nullable fields

type User {
  id: ID!
  name: String!
  profile: UserProfile        # nullable
}

type UserProfile {
  avatar: String              # nullable
  address: Address            # nullable
}

type Address {
  prefecture: String!
  city: String!
}

# Query
query GetUserAddress {
  user(id: "1") {
    name
    profile {          # may be null
      address {        # may be null
        prefecture
        city
      }
    }
  }
}

# Response pattern 1: profile is null
# {
#   "data": {
#     "user": {
#       "name": "Taro",
#       "profile": null
#     }
#   }
# }

# Response pattern 2: profile exists but address is null
# {
#   "data": {
#     "user": {
#       "name": "Taro",
#       "profile": {
#         "address": null
#       }
#     }
#   }
# }

# Safe access on the client side:
# const city = data?.user?.profile?.address?.city ?? 'N/A';
```

```
Edge case illustrated:

  Non-null propagation rules:
  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  type Query {                                        │
  │    user(id: ID!): User       # nullable              │
  │  }                                                   │
  │                                                      │
  │  type User {                                         │
  │    name: String!             # non-null              │
  │    orders: [Order!]!         # non-null (array+elems)│
  │  }                                                   │
  │                                                      │
  │  If the resolver for User.name returns null:         │
  │    → name is non-null, so the entire User becomes null│
  │    → If user is nullable (User), then user: null     │
  │    → If user is non-null (User!), the null propagates│
  │      upward until data itself becomes null           │
  │                                                      │
  │  Lesson:                                             │
  │    Non-null (!) guarantees "this field always has a  │
  │    value," but if the resolver returns null, the     │
  │    error propagates. Make fields that depend on      │
  │    external services nullable to enable partial data.│
  └──────────────────────────────────────────────────────┘
```

### 14.2 Edge Case 2: Bulk Data Requests

```graphql
# Problem: client requests a large amount of data at once

# Dangerous query example
query GetAllUsers {
  users(first: 10000) {           # Requesting 10,000 records
    edges {
      node {
        id
        name
        orders(first: 100) {       # 100 orders per user
          edges {
            node {
              items {               # All items per order
                product {
                  name
                  category {
                    products {      # All products in the category
                      name
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
# → 10000 * 100 * N * M = potentially millions of DB records loaded
```

```
Multi-layer defense strategy:

  Layer 1: Argument upper bounds
    → Limit the maximum value of first/last (e.g., max 100)
    → Apply Math.min(args.first, MAX_PAGE_SIZE) in the resolver

  Layer 2: Query depth limiting
    → depthLimit(7) to prevent excessive nesting

  Layer 3: Query complexity limiting
    → Set a cost limit per request

  Layer 4: Timeouts
    → Set timeouts on resolvers/DB queries
    → Forcefully cut off after a given duration

  Layer 5: Rate limiting
    → Limit requests per IP / per user
    → Manage maximum request count within a time window
```

```javascript
// Implementation example: argument upper bound check
const MAX_PAGE_SIZE = 100;

const resolvers = {
  Query: {
    users: async (_, args, context) => {
      const first = Math.min(args.first || 20, MAX_PAGE_SIZE);

      if (args.first > MAX_PAGE_SIZE) {
        console.warn(
          `Requested page size ${args.first} exceeds max ${MAX_PAGE_SIZE}`
        );
      }

      return context.dataSources.userAPI.listUsers({
        ...args,
        first,
      });
    },
  },
};
```

### 14.3 Edge Case 3: Concurrent Mutation Conflicts

```
Data conflicts from concurrent Mutations:

  Client A                          Client B
    |                                 |
    | updateUser(id:"1",             | updateUser(id:"1",
    |   input: {name:"Taro"})        |   input: {email:"new@x.com"})
    |                                 |
    | --- (1) READ user --->         |
    | <-- name:"Taro", email:"old"   |
    |                                 | --- (2) READ user --->
    |                                 | <-- name:"Taro", email:"old"
    | --- (3) WRITE name:"Taro" -->  |
    |                                 | --- (4) WRITE email:"new" -->
    |                                 |
    |  Result: name="Taro", email="new@x.com"
    |  → No problem here (different fields)
    |
    |  Problematic case: updating the same field
    |  Client A: updateUser(input: {name:"Taro"})
    |  Client B: updateUser(input: {name:"Hanako"})
    |  → Last Write Wins

  Countermeasures:
    1. Optimistic locking: check updatedAt
       input UpdateUserInput {
         name: String
         expectedVersion: Int!  # Version number before the update
       }

    2. Field-level locking:
       → UPDATE only the fields being changed
       → Partial update (PATCH-style)

    3. Event sourcing:
       → Record changes as events
       → Conflict detection and resolution become straightforward
```

---

## 15. Performance Optimization

### 15.1 Query Planning

```
Performance optimization perspectives:

  ┌────────────────────────────────────────────────────────────┐
  │  GraphQL Performance Optimization Pyramid                  │
  │                                                            │
  │                    ┌───┐                                   │
  │                   / CDN \                                  │
  │                  /  Cache \                                │
  │                 ┌─────────┐                                │
  │                / Response  \                               │
  │               /   Cache     \                              │
  │              ┌───────────────┐                             │
  │             / DataLoader      \                            │
  │            /  (Request Cache)   \                          │
  │           ┌─────────────────────┐                         │
  │          / DB Query              \                         │
  │         /  Optimization           \                        │
  │        ┌───────────────────────────┐                      │
  │       / Schema Design               \                     │
  │      /  (Foundation)                  \                    │
  │     └─────────────────────────────────┘                   │
  │                                                            │
  │  Optimize from the bottom layer up for best results        │
  └────────────────────────────────────────────────────────────┘
```

### 15.2 Response Caching

```javascript
// Apollo Server response cache
import responseCachePlugin from '@apollo/server-plugin-response-cache';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [
    responseCachePlugin({
      // Separate cache per user
      sessionId: (requestContext) =>
        requestContext.contextValue.user?.id || 'anonymous',
    }),
  ],
});

// Set cache hints in the schema
// type Query {
//   publicPosts: [Post!]! @cacheControl(maxAge: 300)  # Cache for 5 minutes
//   me: User @cacheControl(maxAge: 0, scope: PRIVATE) # No cache
// }
//
// type Post @cacheControl(maxAge: 60) {
//   id: ID!
//   title: String!
//   author: User! @cacheControl(maxAge: 30)
// }
```

---

## 16. Exercises

### Exercise 1: Basics (Schema Definition)

Define a GraphQL schema in SDL that satisfies the following requirements.

```
Requirements: Schema for a blog system

Entities:
  - Author: id, name, email, bio, createdAt
  - Article: id, title, body, author, tags, status(DRAFT/PUBLISHED/ARCHIVED),
             publishedAt, createdAt, updatedAt
  - Comment: id, article, author, body, createdAt
  - Tag: id, name, slug

Features:
  - Article list (pagination, status filter, tag filter)
  - Article detail (with comments)
  - Author's article list
  - Create/update/delete articles (Mutation)
  - Add/delete comments (Mutation)

Conditions:
  - Relay Connection spec pagination
  - Payload pattern error handling
  - Appropriate null/non-null settings
```

```graphql
# Sample answer (partial)

scalar DateTime

enum ArticleStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

type Author {
  id: ID!
  name: String!
  email: String!
  bio: String
  createdAt: DateTime!
  articles(
    first: Int
    after: String
    status: ArticleStatus
  ): ArticleConnection!
  articleCount: Int!
}

type Article {
  id: ID!
  title: String!
  body: String!
  author: Author!
  tags: [Tag!]!
  status: ArticleStatus!
  publishedAt: DateTime       # null when DRAFT
  createdAt: DateTime!
  updatedAt: DateTime!
  comments(first: Int, after: String): CommentConnection!
  commentCount: Int!
}

type Comment {
  id: ID!
  article: Article!
  author: Author!
  body: String!
  createdAt: DateTime!
}

type Tag {
  id: ID!
  name: String!
  slug: String!
  articles(first: Int, after: String): ArticleConnection!
}

# Connection types...
type ArticleEdge { node: Article!, cursor: String! }
type ArticleConnection {
  edges: [ArticleEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type CommentEdge { node: Comment!, cursor: String! }
type CommentConnection {
  edges: [CommentEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

# Query
type Query {
  article(id: ID!): Article
  articles(
    first: Int
    after: String
    status: ArticleStatus
    tagSlug: String
    authorId: ID
  ): ArticleConnection!
  author(id: ID!): Author
  tag(slug: String!): Tag
  tags: [Tag!]!
  me: Author
}

# Mutation
input CreateArticleInput {
  title: String!
  body: String!
  tagIds: [ID!]
  status: ArticleStatus = DRAFT
}

input UpdateArticleInput {
  title: String
  body: String
  tagIds: [ID!]
  status: ArticleStatus
}

input AddCommentInput {
  articleId: ID!
  body: String!
}

type ArticlePayload {
  article: Article
  errors: [UserError!]!
}

type CommentPayload {
  comment: Comment
  errors: [UserError!]!
}

type DeletePayload {
  deletedId: ID
  errors: [UserError!]!
}

type UserError {
  field: String
  message: String!
  code: String!
}

type Mutation {
  createArticle(input: CreateArticleInput!): ArticlePayload!
  updateArticle(id: ID!, input: UpdateArticleInput!): ArticlePayload!
  deleteArticle(id: ID!): DeletePayload!
  addComment(input: AddCommentInput!): CommentPayload!
  deleteComment(id: ID!): DeletePayload!
}
```

### Exercise 2: Intermediate (Resolvers and DataLoader)

Implement the following resolvers for the blog schema above.

```
Requirements:
  1. Query.articles resolver (with cursor pagination)
  2. Article.commentCount field resolver (using DataLoader)
  3. Mutation.createArticle resolver (with validation)
  4. All resolvers must include authentication checks
```

```javascript
// Sample answer

import DataLoader from 'dataloader';

// Create DataLoaders
function createBlogLoaders(db) {
  return {
    commentCountLoader: new DataLoader(async (articleIds) => {
      const result = await db.query(
        `SELECT article_id, COUNT(*) as count
         FROM comments
         WHERE article_id = ANY($1)
         GROUP BY article_id`,
        [articleIds]
      );

      const countMap = new Map(
        result.rows.map((r) => [r.article_id, parseInt(r.count, 10)])
      );
      return articleIds.map((id) => countMap.get(id) || 0);
    }),

    authorLoader: new DataLoader(async (authorIds) => {
      const result = await db.query(
        'SELECT * FROM authors WHERE id = ANY($1)',
        [authorIds]
      );
      const map = new Map(result.rows.map((a) => [a.id, a]));
      return authorIds.map((id) => map.get(id) || null);
    }),
  };
}

const blogResolvers = {
  Query: {
    articles: async (_, args, context) => {
      if (!context.user) throw new Error('Authentication required');

      const { first = 20, after, status, tagSlug, authorId } = args;
      const safeFirst = Math.min(first, 100);

      let query = 'SELECT * FROM articles WHERE 1=1';
      const params = [];
      let idx = 1;

      if (status) {
        query += ` AND status = $${idx++}`;
        params.push(status);
      }
      if (authorId) {
        query += ` AND author_id = $${idx++}`;
        params.push(authorId);
      }
      if (after) {
        const cursor = Buffer.from(after, 'base64').toString().replace('cursor:', '');
        query += ` AND id > $${idx++}`;
        params.push(cursor);
      }

      query += ` ORDER BY created_at DESC LIMIT $${idx++}`;
      params.push(safeFirst + 1);

      const { rows } = await context.db.query(query, params);
      const hasNextPage = rows.length > safeFirst;
      const nodes = hasNextPage ? rows.slice(0, safeFirst) : rows;

      const edges = nodes.map((node) => ({
        node,
        cursor: Buffer.from(`cursor:${node.id}`).toString('base64'),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: !!after,
          startCursor: edges[0]?.cursor ?? null,
          endCursor: edges[edges.length - 1]?.cursor ?? null,
        },
        totalCount: await countArticles(context.db, { status, authorId }),
      };
    },
  },

  Article: {
    commentCount: (article, _, { loaders }) =>
      loaders.commentCountLoader.load(article.id),

    author: (article, _, { loaders }) =>
      loaders.authorLoader.load(article.author_id),
  },

  Mutation: {
    createArticle: async (_, { input }, context) => {
      if (!context.user) {
        return {
          article: null,
          errors: [{ field: null, message: 'Authentication required', code: 'UNAUTHENTICATED' }],
        };
      }

      // Validation
      const errors = [];
      if (!input.title || input.title.trim().length < 3) {
        errors.push({
          field: 'title',
          message: 'Title must be at least 3 characters',
          code: 'VALIDATION_ERROR',
        });
      }
      if (!input.body || input.body.trim().length < 10) {
        errors.push({
          field: 'body',
          message: 'Body must be at least 10 characters',
          code: 'VALIDATION_ERROR',
        });
      }
      if (errors.length > 0) {
        return { article: null, errors };
      }

      const article = await context.db.query(
        `INSERT INTO articles (title, body, author_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *`,
        [input.title, input.body, context.user.id, input.status || 'DRAFT']
      );

      return { article: article.rows[0], errors: [] };
    },
  },
};
```

### Exercise 3: Advanced (Subscription + Integration Test)

Implement a real-time comment notification feature with the following requirements.

```
Requirements:
  1. Notify via Subscription when a comment is added to an article
  2. Notification includes article ID, comment content, and author name
  3. Only the article author can subscribe (authorization check)
  4. Also create an integration test
```

```javascript
// Sample answer

// Schema addition
// type Subscription {
//   commentAdded(articleId: ID!): CommentAddedEvent!
// }
//
// type CommentAddedEvent {
//   articleId: ID!
//   comment: Comment!
// }

import { PubSub, withFilter } from 'graphql-subscriptions';

const pubsub = new PubSub();
const COMMENT_ADDED = 'COMMENT_ADDED';

const subscriptionResolvers = {
  Subscription: {
    commentAdded: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(COMMENT_ADDED),
        async (payload, variables, context) => {
          // Filter by article ID
          if (payload.commentAdded.articleId !== variables.articleId) {
            return false;
          }

          // Authorization check: only the article author can subscribe
          const article = await context.dataSources.articleAPI
            .getArticle(variables.articleId);
          return article?.authorId === context.user?.id;
        }
      ),
    },
  },

  Mutation: {
    addComment: async (_, { input }, context) => {
      // ... comment creation logic ...
      const comment = await context.db.query(
        `INSERT INTO comments (article_id, author_id, body, created_at)
         VALUES ($1, $2, $3, NOW()) RETURNING *`,
        [input.articleId, context.user.id, input.body]
      );

      // Publish event to Subscription
      pubsub.publish(COMMENT_ADDED, {
        commentAdded: {
          articleId: input.articleId,
          comment: comment.rows[0],
        },
      });

      return { comment: comment.rows[0], errors: [] };
    },
  },
};

// Integration test
// __tests__/subscription.test.js
describe('Subscription: commentAdded', () => {
  it('should deliver a comment notification to the article author', async () => {
    // 1. Start Subscription
    const subscription = client.subscribe({
      query: gql`
        subscription OnCommentAdded($articleId: ID!) {
          commentAdded(articleId: $articleId) {
            articleId
            comment {
              body
              author { name }
            }
          }
        }
      `,
      variables: { articleId: 'article-1' },
    });

    // 2. Promise to collect results
    const resultPromise = new Promise((resolve) => {
      subscription.subscribe({ next: resolve });
    });

    // 3. Add a comment
    await client.mutate({
      mutation: gql`
        mutation AddComment($input: AddCommentInput!) {
          addComment(input: $input) {
            comment { id }
            errors { message }
          }
        }
      `,
      variables: {
        input: { articleId: 'article-1', body: 'Great article!' },
      },
    });

    // 4. Verify Subscription result
    const result = await resultPromise;
    expect(result.data.commentAdded.articleId).toBe('article-1');
    expect(result.data.commentAdded.comment.body).toBe('Great article!');
  });
});
```

---

## FAQ

### Q1: When should I use GraphQL vs REST API?

GraphQL and REST have different design philosophies and trade-offs, so choosing based on project characteristics is important.

**When GraphQL is a good fit:**
- **Complex UI data requirements**: Mobile apps and dashboards that require different data sets per screen
- **Microservice aggregation**: When you want to unify multiple backend services as a single API (BFF: Backend for Frontend pattern)
- **Frontend-driven development**: When the frontend team wants to reduce backend dependency and define data requirements autonomously
- **Real-time features**: Chat, notifications, and real-time dashboards using Subscription

**When REST is a good fit:**
- **Simple CRUD operations**: Standard operations like user registration, login, and basic resource management
- **File handling**: Large file upload/download and streaming delivery
- **CDN cache utilization**: When URL-based caching strategy is clear and HTTP caching should be maximized
- **Publicly exposed API**: When broad compatibility is required and OpenAPI (Swagger) documentation and standard HTTP status codes matter

**Combined pattern (recommended):**
In practice, a common approach is to use REST API externally (prioritizing stability and compatibility) and GraphQL internally as a BFF (prioritizing development efficiency). For example, mobile apps use the internal GraphQL API while third-party integrations are served via the public REST API.

### Q2: What is the N+1 problem in GraphQL, and how do you solve it?

The N+1 problem is the most frequently encountered performance issue in GraphQL, caused by the hierarchical nature of resolver execution.

**How the problem occurs:**
```graphql
query {
  articles {           # 1 query fetches 10 records
    id
    title
    author {           # 1 query per article = 10 queries total
      name
    }
  }
}
```

The query above executes 1 query for `articles` and N queries (one per article) for each `author`, totaling N+1 database queries. With 1,000 articles, 1,001 queries are fired, causing serious performance degradation.

**Solutions:**

1. **DataLoader (most recommended)**: A batching library developed by Facebook. It batches IDs within a request scope and performs bulk retrieval + caching (see Section 8 of this guide).
   - Benefit: Can be introduced without modifying resolver logic; officially recommended pattern
   - Implementation: Define a batch function with `new DataLoader(ids => batchGetAuthors(ids))` and store in context

2. **JOIN-based resolvers**: Parse required fields from the `info` parameter and build JOIN queries ahead of time.
   - Benefit: Can execute optimal SQL in a single query
   - Drawback: Increases resolver complexity; requires knowledge of `graphql-fields` or `graphql-parse-resolve-info`

3. **Lookahead/Projection**: Pre-fetch data by reading ahead to the next fields to be resolved.
   - Benefit: Optimal for data source-specific optimizations
   - Drawback: Complex implementation; framework-dependent

**Recommended approach:** Introduce DataLoader first, then consider JOIN-based resolvers for special cases (aggregate functions, complex JOINs) where DataLoader is insufficient.

### Q3: What are the learning costs and organizational preparations for adopting GraphQL?

Adopting GraphQL requires not only technical learning but also organizational preparation.

**Technical learning costs:**
- **Fundamentals**: Understanding the type system, schema definition (SDL), and Query/Mutation/Subscription: 1-2 weeks
- **Implementation skills**: Resolver implementation, DataLoader, error handling, authentication/authorization patterns: 2-4 weeks
- **Operational knowledge**: Apollo Server setup, performance optimization, security measures, monitoring and logging: 1-2 months
- **Advanced topics**: Federation, Schema Stitching, Relay spec, cache strategies: 2-3 months

**Organizational preparation:**

1. **Schema governance**: Change management for schemas, review processes, and rules for managing breaking changes
2. **Toolchain setup**: GraphiQL/Playground, Apollo Studio, schema validation (CI integration), code generation tools
3. **Documentation culture**: The SDL itself serves as documentation, but supplementary docs for business logic and use cases are necessary
4. **Phased adoption plan**:
   - **Phase 1**: Trial with a small internal tool (2-4 weeks)
   - **Phase 2**: Build a BFF for a single microservice (1-2 months)
   - **Phase 3**: Multi-service integration; evaluate Federation (2-3 months)
   - **Phase 4**: Deploy as a publicly exposed API (after establishing security and scalability)

5. **Team structure**: GraphQL's benefit is reducing communication costs between frontend and backend teams, but during the initial phase it is recommended to appoint a "GraphQL Champion" to lead schema design.

**Tips for avoiding failure:**
- Don't aim to replace all existing REST APIs at once (migrate incrementally)
- Don't defer the N+1 problem; introduce DataLoader from the start
- Establish a schema versioning strategy (Schema Evolution) early on
- Set up monitoring and logging infrastructure (Apollo Studio, Sentry, etc.) early

---

## Summary

| Concept | Key Points |
|---------|-----------|
| SDL | Define schema with the type system; acts as the API specification |
| Query | Client specifies exactly the data needed; reuse fields with fragments |
| Mutation | Handle errors with Payload pattern; structure arguments with Input types |
| Subscription | Real-time notifications over WebSocket; implement with PubSub pattern |
| Resolvers | Hierarchical data fetching parent→child; 4 arguments (parent, args, context, info) |
| DataLoader | Solves N+1 problem; batch processing + request-scoped cache |
| Apollo Server | Express integration, plugin system, directive-based authorization |
| Security | Multi-layer defense: depth limit, complexity limit, rate limit, APQ |
| Error design | Three-layer model: network / GraphQL / business |
| Testing | Unit (resolvers) + integration (executeOperation) + E2E |

---

## What to Read Next
→ [GraphQL Advanced](./02-graphql-advanced.md) -- Federation, Schema Stitching, Caching strategies, CI/CD integration

---

## References
1. GraphQL Foundation. "GraphQL Specification (October 2021 Edition)." graphql.org, 2023.
2. Apollo GraphQL. "Apollo Server v4 Documentation." apollographql.com/docs/apollo-server, 2024.
3. Lee, B. "GraphQL in Action." Manning Publications, 2021.
4. Banks, A. and Porcello, E. "Learning GraphQL: Declarative Data Fetching for Modern Web Apps." O'Reilly Media, 2018.
5. Facebook Open Source. "DataLoader - Batching and Caching for GraphQL." github.com/graphql/dataloader, 2024.
6. Relay Team. "Relay Connection Specification." relay.dev/graphql/connections.htm, 2024.

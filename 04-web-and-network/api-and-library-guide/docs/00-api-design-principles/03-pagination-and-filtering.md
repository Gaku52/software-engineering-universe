# Pagination and Filtering

> Design patterns for pagination, filtering, sorting, and searching to efficiently return large datasets. Covers a full range of data-fetching API techniques: comparison of Offset / Cursor / Keyset approaches, the GraphQL Relay Connection spec, filter syntax, and full-text search.

## What You Will Learn

- [ ] Understand the differences between Offset, Cursor, and Keyset pagination and how to choose among them
- [ ] Implement pagination using the GraphQL Relay Connection spec
- [ ] Grasp API design for filtering and sorting
- [ ] Learn the design of full-text search and faceted search
- [ ] Master performance optimizations related to pagination
- [ ] Understand edge cases and anti-patterns for each approach

## Prerequisites

- Fundamentals of REST API design → See: [REST Best Practices](../01-rest-and-graphql/00-rest-best-practices.md)
- How HTTP query parameters work → See: HTTP Basics
- API design naming conventions → See: [Naming Conventions](./01-naming-and-conventions.md)

---

## 1. Overview of Pagination Approaches

As the dataset returned by an API grows larger, returning all records in a single response
becomes impractical from the perspectives of network bandwidth, memory, and response time.
Pagination divides a dataset into small chunks (pages) so that
clients can retrieve only the portion they need.

### 1.1 Comparison of the Three Main Pagination Approaches

```
┌─────────────────────────────────────────────────────────────────┐
│              Pagination Approach Classification                   │
├──────────────┬──────────────────┬───────────────────────────────┤
│  Offset      │   Cursor         │       Keyset                  │
│  (Page Number)│  (Opaque Token)  │  (Sort Key Direct Exposure)  │
├──────────────┼──────────────────┼───────────────────────────────┤
│  page=3      │  cursor=abc123   │  created_at_gt=2024-01-15     │
│  per_page=20 │  limit=20        │  id_gt=100&limit=20           │
├──────────────┼──────────────────┼───────────────────────────────┤
│  SQL:        │  SQL:            │  SQL:                         │
│  OFFSET 40   │  WHERE (col,id)  │  WHERE created_at > ?         │
│  LIMIT 20    │    < (?,?)       │    AND id > ?                 │
│              │  LIMIT 20        │  LIMIT 20                     │
├──────────────┼──────────────────┼───────────────────────────────┤
│  O(n) skip   │  O(log n) seek   │  O(log n) seek               │
│  Page jump ○ │  Page jump ×    │  Page jump ×                 │
│  Drift: yes  │  Drift: no       │  Drift: no                   │
└──────────────┴──────────────────┴───────────────────────────────┘
```

> **Difference between Cursor and Keyset**: The Cursor approach uses an "opaque token"
> that encodes sort key values with Base64, so the client does not need to know its contents.
> The Keyset approach exposes sort key values directly as query parameters.
> The underlying SQL execution plan is the same, but the level of API abstraction differs.

---

### 1.2 Offset Approach (Page-Number Based)

The most intuitive pagination approach. Maps directly to SQL `OFFSET` / `LIMIT`.

```
GET /api/v1/users?page=3&per_page=20

Response:
{
  "data": [...],
  "meta": {
    "total": 1500,
    "page": 3,
    "perPage": 20,
    "totalPages": 75,
    "hasNextPage": true,
    "hasPrevPage": true
  },
  "links": {
    "self":  "/api/v1/users?page=3&per_page=20",
    "first": "/api/v1/users?page=1&per_page=20",
    "prev":  "/api/v1/users?page=2&per_page=20",
    "next":  "/api/v1/users?page=4&per_page=20",
    "last":  "/api/v1/users?page=75&per_page=20"
  }
}

Internal SQL:
SELECT * FROM users
ORDER BY created_at DESC
LIMIT 20 OFFSET 40;  -- (page - 1) * per_page

Advantages:
  Intuitive ("page 3" is clear)
  Can jump to any page
  Easy to display page numbers in the UI
  High compatibility with existing SQL

Disadvantages:
  Performance degrades as OFFSET grows
    → OFFSET 100000 skips 100,000 rows (O(n))
  Position drift when data is added or deleted
    → If data is inserted while viewing page 2, duplicates appear
  COUNT query for total is expensive (large tables)
```

#### Visualizing the Internal Behavior of Offset

```
Database scan behavior (page=5001, per_page=20):

  Row 1      ─┐
  Row 2       │
  Row 3       │
  ...         │  ← OFFSET 100000: all these rows are scanned
  Row 99999   │     and then skipped (O(n) cost)
  Row 100000 ─┘
  Row 100001 ─┐
  Row 100002  │
  ...         │  ← LIMIT 20: only these 20 rows are returned
  Row 100020 ─┘
  Row 100021
  ...

  As page increases, the amount scanned grows,
  and response time degrades linearly:

  page=1    →  ~2ms
  page=100  →  ~15ms
  page=1000 →  ~120ms
  page=5000 →  ~600ms
  page=10000→  ~1200ms (depends on table size)
```

#### Position Drift in the Offset Approach

```
Timeline:
  T1: Client fetches page=2 (id=21~40)
  T2: Another user deletes id=25
  T3: Client fetches page=3
      → Should be id=41~60, but due to deletion it becomes id=42~61
      → id=41 is missing from both the end of page=2 and the start of page=3
         (a "hole" in the data appears)

  Conversely, on insertion:
  T1: Client fetches page=1 (id=1~20)
  T2: New data is inserted at the top (equivalent to id=0)
  T3: Client fetches page=2
      → id=20 appears in both page=1 and page=2 (duplicate)

  This problem is called "page drift".
```

---

### 1.3 Cursor Approach (Opaque Token Based)

Uses an opaque token (cursor) that encodes the sort key value to
fetch "N records starting from after this position".

```
GET /api/v1/users?cursor=eyJpZCI6MTAwfQ&limit=20

Response:
{
  "data": [...],
  "meta": {
    "hasNextPage": true,
    "nextCursor": "eyJpZCI6MTIwfQ",
    "hasPrevPage": true,
    "prevCursor": "eyJpZCI6MTAxfQ"
  }
}

Cursor contents (Base64-encoded):
  {"id": 100, "createdAt": "2024-01-15T10:00:00Z"}

Internal SQL:
SELECT * FROM users
WHERE (created_at, id) < ('2024-01-15T10:00:00Z', 100)
ORDER BY created_at DESC, id DESC
LIMIT 20;

Advantages:
  Consistent performance (uses index with WHERE clause, O(log n))
  No position drift on insert/delete
  Ideal for real-time feeds

Disadvantages:
  Cannot jump to arbitrary pages
  Difficult to display page numbers
  Cursor generation and parsing is complex
  Existing cursors become invalid when sort order changes
```

---

### 1.4 Keyset Approach (Sort Key Direct Exposure)

A variant of Cursor that exposes sort key values directly as query parameters.

```
GET /api/v1/users?created_at_lt=2024-01-15T10:00:00Z&id_lt=100&limit=20

Response:
{
  "data": [...],
  "meta": {
    "hasNextPage": true,
    "nextCreatedAt": "2024-01-14T08:30:00Z",
    "nextId": 80
  }
}

Internal SQL (identical to Cursor approach):
SELECT * FROM users
WHERE (created_at, id) < ('2024-01-15T10:00:00Z', 100)
ORDER BY created_at DESC, id DESC
LIMIT 20;

Advantages:
  No cursor encode/decode required
  Easy to debug (parameters are human-readable)
  Client can freely specify sort keys

Disadvantages:
  Internal sort keys are exposed externally (fragile API contract)
  Composite sort key parameters become verbose
  Client needs to know the type and format of sort keys
```

---

### 1.5 Decision Tree for Choosing a Pagination Approach

```
                    Choosing a Pagination Approach
                           │
                    Is page jumping required?
                    ┌──────┴──────┐
                   Yes           No
                    │             │
             Data count < 100K?   Is real-time access needed?
             ┌──────┴──────┐   ┌──────┴──────┐
            Yes           No  Yes           No
             │             │   │             │
        ┌────┘        ┌───┘   │        Data count > 1M?
        │             │       │        ┌──────┴──────┐
   Offset         Offset +   Cursor   Yes           No
   (recommended)  estimated   (rec.)   │             │
                  total               Cursor      Either works
                               │     (recommended) (Cursor recommended)
                               │
                         Cursor
                         (recommended)

  Specific use cases:
  ┌───────────────────────┬──────────────┐
  │ Use Case              │ Recommended  │
  ├───────────────────────┼──────────────┤
  │ Admin panel table     │ Offset       │
  │ Search results list   │ Offset       │
  │ SNS timeline          │ Cursor       │
  │ Chat history          │ Cursor       │
  │ Notification list     │ Cursor       │
  │ Infinite scroll       │ Cursor       │
  │ Data export           │ Keyset       │
  │ Batch processing      │ Keyset       │
  │ GraphQL API           │ Cursor       │
  │ Public API (3rd party)│ Cursor       │
  └───────────────────────┴──────────────┘
```

---

## 2. Cursor Implementation Details

### 2.1 Basic Implementation (Node.js + Prisma)

```javascript
// --- Cursor encode/decode ---

/**
 * Encodes cursor data with Base64url encoding.
 * Reasons for using Base64url:
 *   - URL safe (does not use +, /, =)
 *   - Can be passed directly as a query parameter
 *   - Opaque to the client
 */
function encodeCursor(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

/**
 * Decodes a Base64url-encoded cursor.
 * Throws an error for invalid cursors.
 */
function decodeCursor(cursor) {
  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64url').toString()
    );
    // Validation: check that required fields exist
    if (!decoded.id) {
      throw new Error('Invalid cursor: missing id');
    }
    return decoded;
  } catch (err) {
    throw new ApiError(400, 'Invalid cursor format');
  }
}

// --- Cursor pagination ---
async function listUsers(params) {
  const {
    cursor,
    limit = 20,
    sort = 'createdAt',
    order = 'desc',
  } = params;

  // Set an upper bound on limit (DoS prevention)
  const take = Math.min(Math.max(limit, 1), 100);

  // Whitelist validation of sort fields
  const allowedSortFields = ['createdAt', 'updatedAt', 'name', 'email'];
  if (!allowedSortFields.includes(sort)) {
    throw new ApiError(400, `Invalid sort field: ${sort}`);
  }

  let where = {};
  if (cursor) {
    const decoded = decodeCursor(cursor);
    // Composite cursor: sort key + ID as tiebreaker
    // Composite comparison on (created_at, id) ensures uniqueness
    where = {
      OR: [
        {
          [sort]: order === 'desc'
            ? { lt: decoded[sort] }
            : { gt: decoded[sort] },
        },
        {
          [sort]: decoded[sort],
          id: order === 'desc'
            ? { lt: decoded.id }
            : { gt: decoded.id },
        },
      ],
    };
  }

  // Fetch take + 1 records to determine hasNextPage
  // If the extra record is retrieved, "the next page exists"
  const items = await prisma.user.findMany({
    where,
    orderBy: [{ [sort]: order }, { id: order }],
    take: take + 1,
  });

  const hasNextPage = items.length > take;
  const data = hasNextPage ? items.slice(0, take) : items;

  return {
    data,
    meta: {
      hasNextPage,
      nextCursor: hasNextPage
        ? encodeCursor({
            [sort]: data[data.length - 1][sort],
            id: data[data.length - 1].id,
          })
        : null,
      hasPrevPage: !!cursor,
      prevCursor: data.length > 0
        ? encodeCursor({
            [sort]: data[0][sort],
            id: data[0].id,
          })
        : null,
      limit: take,
    },
  };
}
```

### 2.2 Cursor Implementation with Composite Sort Keys

When a cursor uses a composite key (e.g., `(priority, created_at, id)`) rather than a single key,
the SQL `WHERE` clause becomes complex. This can be resolved with "Row Value Comparison".

```sql
-- Composite sort: priority DESC, created_at DESC, id DESC
-- Cursor position: priority=3, created_at='2024-06-01', id=500

-- Method 1: Expanded OR conditions (works with all DBs)
SELECT * FROM tasks
WHERE
  (priority < 3)
  OR (priority = 3 AND created_at < '2024-06-01')
  OR (priority = 3 AND created_at = '2024-06-01' AND id < 500)
ORDER BY priority DESC, created_at DESC, id DESC
LIMIT 20;

-- Method 2: Row value comparison (works with PostgreSQL, MySQL 8.0+)
SELECT * FROM tasks
WHERE (priority, created_at, id) < (3, '2024-06-01', 500)
ORDER BY priority DESC, created_at DESC, id DESC
LIMIT 20;

-- Method 2 is concise, but cannot be used with mixed sort orders (ASC/DESC mixed).
-- For mixed sort orders, the OR expansion in Method 1 is required.
```

```javascript
// Composite sort key cursor implementation (Node.js)
function buildCursorWhere(sortKeys, cursorData, orders) {
  // sortKeys: ['priority', 'createdAt', 'id']
  // cursorData: { priority: 3, createdAt: '2024-06-01', id: 500 }
  // orders: ['desc', 'desc', 'desc']

  const conditions = [];

  for (let i = 0; i < sortKeys.length; i++) {
    const condition = {};

    // All preceding keys are equal
    for (let j = 0; j < i; j++) {
      condition[sortKeys[j]] = cursorData[sortKeys[j]];
    }

    // The current key satisfies the comparison condition
    const op = orders[i] === 'desc' ? 'lt' : 'gt';
    condition[sortKeys[i]] = { [op]: cursorData[sortKeys[i]] };

    conditions.push(condition);
  }

  return { OR: conditions };
}

// Usage example
const where = buildCursorWhere(
  ['priority', 'createdAt', 'id'],
  { priority: 3, createdAt: '2024-06-01T00:00:00Z', id: 500 },
  ['desc', 'desc', 'desc']
);
// → { OR: [
//      { priority: { lt: 3 } },
//      { priority: 3, createdAt: { lt: '2024-06-01T00:00:00Z' } },
//      { priority: 3, createdAt: '2024-06-01T00:00:00Z', id: { lt: 500 } },
//   ]}
```

### 2.3 Encrypted Cursors and Security

When cursor contents are only Base64-encoded,
the client can decode and tamper with them. To prevent this,
apply HMAC signing or encryption.

```javascript
const crypto = require('crypto');

const CURSOR_SECRET = process.env.CURSOR_SECRET; // A sufficiently long random string

/**
 * Generates a signed cursor.
 * Format: base64url(JSON) + "." + hmac_signature
 */
function encodeSecureCursor(data) {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const hmac = crypto
    .createHmac('sha256', CURSOR_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${hmac}`;
}

/**
 * Validates and decodes a signed cursor.
 * Throws an exception if the signature is invalid.
 */
function decodeSecureCursor(cursor) {
  const [payload, signature] = cursor.split('.');
  if (!payload || !signature) {
    throw new ApiError(400, 'Invalid cursor format');
  }

  // HMAC validation (use timingSafeEqual to prevent timing attacks)
  const expected = crypto
    .createHmac('sha256', CURSOR_SECRET)
    .update(payload)
    .digest('base64url');

  if (!crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )) {
    throw new ApiError(400, 'Invalid cursor signature');
  }

  return JSON.parse(Buffer.from(payload, 'base64url').toString());
}
```

---

## 3. GraphQL Relay Connection Spec

The Relay "Connection" pattern is the standard pagination spec for GraphQL.
Established by Facebook, it is adopted by major GraphQL APIs including GitHub, Shopify, and Stripe.

### 3.1 Structure of the Connection Spec

```
Conceptual model of the Connection spec:

  Query
    │
    ├── users(first: 10, after: "cursor_abc")
    │     │
    │     └── UsersConnection
    │           │
    │           ├── edges: [UserEdge]
    │           │     ├── edge[0]
    │           │     │     ├── cursor: "cursor_abc1"
    │           │     │     └── node: User { id, name, ... }
    │           │     ├── edge[1]
    │           │     │     ├── cursor: "cursor_abc2"
    │           │     │     └── node: User { id, name, ... }
    │           │     └── ...
    │           │
    │           ├── pageInfo: PageInfo
    │           │     ├── hasNextPage: true
    │           │     ├── hasPreviousPage: false
    │           │     ├── startCursor: "cursor_abc1"
    │           │     └── endCursor: "cursor_abc10"
    │           │
    │           └── totalCount: 1500 (extension field)
    │
    └── ...

  Term definitions:
  - Connection: A collection type with pagination support
  - Edge: A pair of a node and a cursor
  - Node: The actual data object
  - PageInfo: Pagination metadata
  - Cursor: An opaque string indicating the position of each edge
```

### 3.2 GraphQL Schema Definition

```graphql
# GraphQL schema conforming to the Connection spec

type Query {
  # Forward pagination: first + after
  # Backward pagination: last + before
  users(
    first: Int
    after: String
    last: Int
    before: String
    filter: UserFilter
    orderBy: UserOrderBy
  ): UserConnection!
}

type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int        # Extension: total count
}

type UserEdge {
  cursor: String!
  node: User!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

type User {
  id: ID!
  name: String!
  email: String!
  role: UserRole!
  createdAt: DateTime!
}

input UserFilter {
  role: UserRole
  status: UserStatus
  createdAfter: DateTime
  createdBefore: DateTime
  search: String
}

input UserOrderBy {
  field: UserSortField!
  direction: SortDirection!
}

enum UserSortField {
  CREATED_AT
  NAME
  EMAIL
}

enum SortDirection {
  ASC
  DESC
}

enum UserRole {
  ADMIN
  EDITOR
  VIEWER
}

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}
```

### 3.3 Connection Resolver Implementation

```javascript
// GraphQL Relay Connection resolver implementation (Node.js + Prisma)

const resolvers = {
  Query: {
    users: async (_, args, context) => {
      const {
        first, after,
        last, before,
        filter, orderBy,
      } = args;

      // Specifying both first and last is not allowed
      if (first != null && last != null) {
        throw new UserInputError(
          'Cannot specify both "first" and "last"'
        );
      }

      // Default when neither is specified
      const limit = first ?? last ?? 20;
      const clampedLimit = Math.min(Math.max(limit, 1), 100);

      // Build filter conditions
      const where = buildFilterWhere(filter);

      // Build sort conditions
      const sort = orderBy
        ? { field: orderBy.field, dir: orderBy.direction }
        : { field: 'CREATED_AT', dir: 'DESC' };

      const sortField = sortFieldMap[sort.field]; // CREATED_AT → createdAt
      const sortDir = sort.dir.toLowerCase();

      // Decode cursor and add WHERE conditions
      if (after) {
        const cursorData = decodeCursor(after);
        const cursorWhere = buildCursorWhere(
          [sortField, 'id'],
          cursorData,
          [sortDir, sortDir]
        );
        Object.assign(where, cursorWhere);
      }

      if (before) {
        const cursorData = decodeCursor(before);
        // For before, use reverse direction
        const reverseDir = sortDir === 'desc' ? 'asc' : 'desc';
        const cursorWhere = buildCursorWhere(
          [sortField, 'id'],
          cursorData,
          [reverseDir, reverseDir]
        );
        Object.assign(where, cursorWhere);
      }

      // Execute query (take + 1 to determine hasMore)
      let items = await context.prisma.user.findMany({
        where,
        orderBy: [
          { [sortField]: last ? reverseSortDir(sortDir) : sortDir },
          { id: last ? reverseSortDir(sortDir) : sortDir },
        ],
        take: clampedLimit + 1,
      });

      // Reverse results for last
      if (last) {
        items = items.reverse();
      }

      const hasMore = items.length > clampedLimit;
      const nodes = hasMore ? items.slice(0, clampedLimit) : items;

      // Fetch totalCount (optional)
      const totalCount = await context.prisma.user.count({ where });

      // Build Connection object
      const edges = nodes.map(node => ({
        cursor: encodeCursor({
          [sortField]: node[sortField],
          id: node.id,
        }),
        node,
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: first != null ? hasMore : !!before,
          hasPreviousPage: last != null ? hasMore : !!after,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          endCursor: edges.length > 0
            ? edges[edges.length - 1].cursor
            : null,
        },
        totalCount,
      };
    },
  },
};

function reverseSortDir(dir) {
  return dir === 'desc' ? 'asc' : 'desc';
}

const sortFieldMap = {
  CREATED_AT: 'createdAt',
  NAME: 'name',
  EMAIL: 'email',
};
```

### 3.4 Connection Spec Query Examples

```graphql
# Forward pagination (first 10 records, then continue)
query GetUsers {
  users(first: 10, filter: { role: ADMIN }) {
    edges {
      cursor
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
      hasPreviousPage
      startCursor
      endCursor
    }
    totalCount
  }
}

# Fetch next page (pass endCursor to after)
query GetNextPage {
  users(first: 10, after: "eyJjcmVhdGVkQXQiOiIyMDI0LTAxLTE1IiwiaWQiOjEwMH0") {
    edges {
      cursor
      node {
        id
        name
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}

# Backward pagination (fetch last 5 records)
query GetLastUsers {
  users(last: 5) {
    edges {
      cursor
      node {
        id
        name
      }
    }
    pageInfo {
      hasPreviousPage
      startCursor
    }
  }
}
```

---

## 4. Performance Comparison by Approach

### 4.1 Comparison of Basic Characteristics

| Characteristic | Offset | Cursor | Keyset | GraphQL Connection |
|----------------|--------|--------|--------|--------------------|
| Page jumping | Possible | Not possible | Not possible | Not possible |
| Display total count | Easy | Requires separate COUNT | Requires separate COUNT | totalCount extension |
| Performance | O(n) offset | O(log n) | O(log n) | O(log n) |
| Position stability | Drifts | No drift | No drift | No drift |
| Sort change | Easy | Invalidates cursor | Parameter change | Invalidates cursor |
| Bidirectional nav | Possible | Possible | Possible | first/last support |
| Implementation complexity | Low | Medium | Low–Medium | High |
| API abstraction | Low (SQL leaks) | High (opaque) | Low (key exposed) | High (spec-compliant) |
| Mobile suitability | Medium | High | Medium | High |
| Cacheability | Easy | Difficult | Difficult | Difficult |

### 4.2 Performance Benchmarks by Data Scale

| Record count | Offset (last page) | Cursor | Notes |
|--------------|-------------------|--------|-------|
| 1,000 | ~1ms | ~1ms | Difference negligible |
| 10,000 | ~5ms | ~1ms | Offset still acceptable |
| 100,000 | ~50ms | ~2ms | Offset degradation becomes apparent |
| 1,000,000 | ~500ms | ~3ms | Offset causes problems in production |
| 10,000,000 | ~5000ms | ~5ms | Offset effectively unusable |
| 100,000,000 | timeout | ~8ms | Only Cursor is realistic |

> The values above are reference figures for a PostgreSQL environment with proper indexes,
> and may vary significantly depending on hardware, data distribution, and concurrent connections.

---

## 5. Filtering Design

### 5.1 Overview of Filtering Patterns

```
API design patterns for filtering:

  (1) Simple query parameters (recommended for small-scale APIs):
    GET /api/v1/users?status=active&role=admin&age_min=18&age_max=65

    → Best for simple filters
    → Field names map directly to parameter names

  (2) Filter operator pattern (for medium-scale APIs):
    GET /api/v1/users?filter[status]=active
    GET /api/v1/users?filter[age][gte]=18&filter[age][lte]=65
    GET /api/v1/users?filter[name][contains]=taro

    Operator list:
    ┌──────────┬────────────────┬────────────────────────────────┐
    │ Operator │ Meaning        │ Example                        │
    ├──────────┼────────────────┼────────────────────────────────┤
    │ eq       │ Equal          │ filter[status][eq]=active      │
    │ ne       │ Not equal      │ filter[status][ne]=deleted     │
    │ gt       │ Greater than   │ filter[age][gt]=18             │
    │ gte      │ Greater or eq  │ filter[age][gte]=18            │
    │ lt       │ Less than      │ filter[age][lt]=65             │
    │ lte      │ Less or eq     │ filter[age][lte]=65            │
    │ in       │ Included in    │ filter[role][in]=admin,editor  │
    │ nin      │ Not included   │ filter[role][nin]=guest        │
    │ contains │ Partial match  │ filter[name][contains]=taro    │
    │ starts   │ Prefix match   │ filter[name][starts]=ta        │
    │ exists   │ Exists         │ filter[avatar][exists]=true    │
    │ between  │ Range          │ filter[age][between]=18,65     │
    └──────────┴────────────────┴────────────────────────────────┘

  (3) JSON API spec:
    GET /api/v1/users?filter[status]=active&filter[role]=admin

  (4) RHS Colon:
    GET /api/v1/users?status=eq:active&age=gte:18&age=lte:65

  (5) LHS Brackets:
    GET /api/v1/users?status[eq]=active&age[gte]=18

  Recommended:
    → Small-scale API: (1) Simple pattern
    → Medium-scale API: (2) Filter operators
    → Complex search: Dedicated search endpoint (POST /search)
```

### 5.2 Filter Parser Implementation

```javascript
// Filter parser implementation (security-conscious)

/**
 * Extracts filter conditions from query parameters.
 * Parses the filter[field][operator] format.
 *
 * Key security points:
 * - Only accept allowed fields (whitelist)
 * - Only accept allowed operators
 * - Sanitize values
 */
function parseFilters(query, schema) {
  const filters = {};

  // Schema definition (allowed fields and type information)
  const allowedFields = schema || {
    status:    { type: 'enum',    values: ['active', 'inactive', 'suspended'] },
    role:      { type: 'enum',    values: ['admin', 'editor', 'viewer'] },
    age:       { type: 'integer', min: 0, max: 200 },
    name:      { type: 'string',  maxLength: 100 },
    email:     { type: 'string',  maxLength: 254 },
    createdAt: { type: 'datetime' },
  };

  const allowedOperators = [
    'eq', 'ne', 'gt', 'gte', 'lt', 'lte',
    'in', 'nin', 'contains', 'starts', 'exists', 'between',
  ];

  for (const [key, value] of Object.entries(query)) {
    // Parse filter[field][operator] pattern
    const match = key.match(/^filter\(\w+)\\])?$/);
    if (!match) continue;

    const field = match[1];
    const operator = match[2] || 'eq';

    // Field validation
    if (!allowedFields[field]) {
      continue; // Ignore unknown fields (could also throw an error)
    }

    // Operator validation
    if (!allowedOperators.includes(operator)) {
      continue;
    }

    // Value validation
    const validated = validateFilterValue(
      value, allowedFields[field], operator
    );
    if (validated === null) continue;

    if (!filters[field]) filters[field] = {};

    if (operator === 'in' || operator === 'nin') {
      filters[field][operator] = value.split(',').map(v => v.trim());
    } else if (operator === 'between') {
      const [min, max] = value.split(',').map(v => v.trim());
      filters[field]['gte'] = min;
      filters[field]['lte'] = max;
    } else {
      filters[field][operator] = validated;
    }
  }

  return filters;
}

/**
 * Validates a filter value
 */
function validateFilterValue(value, fieldSchema, operator) {
  switch (fieldSchema.type) {
    case 'enum':
      if (operator === 'in' || operator === 'nin') {
        const values = value.split(',');
        return values.every(v => fieldSchema.values.includes(v.trim()))
          ? value : null;
      }
      return fieldSchema.values.includes(value) ? value : null;

    case 'integer': {
      const num = parseInt(value, 10);
      if (isNaN(num)) return null;
      if (fieldSchema.min != null && num < fieldSchema.min) return null;
      if (fieldSchema.max != null && num > fieldSchema.max) return null;
      return num;
    }

    case 'string':
      if (value.length > (fieldSchema.maxLength || 1000)) return null;
      // SQL injection mitigation: handled by parameter binding,
      // so escaping here is unnecessary, but length should be restricted
      return value;

    case 'datetime': {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : value;
    }

    default:
      return value;
  }
}

// Convert to Prisma WHERE clause
function filtersToPrismaWhere(filters) {
  const where = {};
  const operatorMap = {
    eq: 'equals', ne: 'not', gt: 'gt', gte: 'gte',
    lt: 'lt', lte: 'lte', in: 'in', nin: 'notIn',
    contains: 'contains', starts: 'startsWith',
    exists: (v) => v === 'true' ? { not: null } : null,
  };

  for (const [field, ops] of Object.entries(filters)) {
    where[field] = {};
    for (const [op, value] of Object.entries(ops)) {
      const prismaOp = operatorMap[op];
      if (typeof prismaOp === 'function') {
        where[field] = prismaOp(value);
      } else {
        where[field][prismaOp] = value;
      }
    }
  }

  return where;
}
```

---

## 6. Sort Design

### 6.1 Sort Parameter Design Patterns

```
API design for sorting:

  (1) Simple parameters:
    GET /api/v1/users?sort=created_at&order=desc
    GET /api/v1/users?sort=-created_at        ← - prefix for descending

  (2) Multi-field sort:
    GET /api/v1/users?sort=-created_at,name
    → created_at descending → name ascending

  (3) JSON API spec:
    GET /api/v1/users?sort=-created_at,name

Sort best practices:
  [Recommended] Restrict sortable fields with a whitelist
  [Recommended] Always define a default sort (e.g., -created_at)
  [Recommended] Create indexes on sort fields
  [Recommended] For Cursor approach, include sort key in cursor
  [Recommended] Always append a unique key (id) at the end of sort (stable sort)
  [Prohibited]  Do not pass user input directly to ORDER BY
```

### 6.2 Sort Parser Implementation

```javascript
// Sort parser (with stable sort guarantee)
function parseSort(sortParam, allowedFields) {
  const DEFAULT_SORT = [{ createdAt: 'desc' }, { id: 'desc' }];

  if (!sortParam) return DEFAULT_SORT;

  const orderBy = sortParam.split(',').map(field => {
    const desc = field.startsWith('-');
    const name = desc ? field.slice(1) : field;

    // Whitelist validation
    if (!allowedFields.includes(name)) {
      throw new ApiError(400, `Invalid sort field: ${name}`);
    }

    // snake_case → camelCase conversion
    const camelName = name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

    return { [camelName]: desc ? 'desc' : 'asc' };
  });

  // Append id for stable sort (if not already present)
  const hasId = orderBy.some(o => 'id' in o);
  if (!hasId) {
    // Match the direction of the first sort field
    const firstDir = Object.values(orderBy[0])[0];
    orderBy.push({ id: firstDir });
  }

  return orderBy;
}

// Usage example
const orderBy = parseSort(
  req.query.sort,    // "-created_at,name"
  ['created_at', 'name', 'email', 'updated_at']
);
// → [{ createdAt: 'desc' }, { name: 'asc' }, { id: 'desc' }]
```

---

## 7. Field Selection (Sparse Fieldsets)

```
Reduce response size by excluding unnecessary fields:

  GET /api/v1/users?fields=id,name,email
  GET /api/v1/users?fields[users]=id,name&fields[orders]=id,total

Response (specified fields only):
  {
    "data": [
      { "id": "1", "name": "Taro", "email": "taro@example.com" },
      { "id": "2", "name": "Hanako", "email": "hanako@example.com" }
    ]
  }

Advantages:
  Reduced response size
  Network bandwidth savings
  Especially effective for mobile apps
  Optimizes SELECT in DB queries

Notes:
  → Always include id (for client referential integrity)
  → Check for fields that must not be returned for security reasons
  → GraphQL inherently provides this feature at the schema level
  → Field selection must be included in cache keys
```

```javascript
// Field selection implementation
function parseFields(fieldsParam, allowedFields) {
  if (!fieldsParam) return undefined; // Return all fields

  const requested = fieldsParam.split(',').map(f => f.trim());

  // Whitelist validation
  const valid = requested.filter(f => allowedFields.includes(f));

  // Always include id
  if (!valid.includes('id')) {
    valid.unshift('id');
  }

  // Convert to Prisma select
  const select = {};
  for (const field of valid) {
    select[field] = true;
  }

  return select;
}

// Usage example
const select = parseFields(
  req.query.fields,
  ['id', 'name', 'email', 'role', 'createdAt', 'updatedAt']
);
// fields=name,email → { id: true, name: true, email: true }
```

---

## 8. Search Design

### 8.1 API Design Patterns for Search

```
API design for search:

  (1) Simple search (full-text search):
    GET /api/v1/users?q=taro
    → Cross-field search across name, email, etc.

  (2) Advanced search (combining filters + search):
    GET /api/v1/users?q=taro&filter[role]=admin&sort=-relevance

  (3) Dedicated search endpoint:
    POST /api/v1/search
    {
      "query": "taro",
      "filters": {
        "role": ["admin", "editor"],
        "createdAt": { "gte": "2024-01-01" }
      },
      "sort": ["-_score", "name"],
      "page": { "limit": 20, "offset": 0 },
      "facets": ["role", "department"],
      "highlight": {
        "fields": ["name", "bio"],
        "preTag": "<mark>",
        "postTag": "</mark>"
      }
    }

    Response:
    {
      "data": [
        {
          "id": "42",
          "name": "Yamada Taro",
          "_score": 15.3,
          "_highlight": {
            "name": "Yamada <mark>Taro</mark>"
          }
        }
      ],
      "meta": {
        "total": 42,
        "maxScore": 15.3,
        "took": 12
      },
      "facets": {
        "role": [
          { "value": "admin", "count": 15 },
          { "value": "editor", "count": 27 }
        ],
        "department": [
          { "value": "engineering", "count": 30 },
          { "value": "design", "count": 12 }
        ]
      }
    }
```

### 8.2 Choosing a Search Backend

```
Search backend comparison:

┌──────────────┬────────────┬───────────┬──────────┬───────────────┐
│ Backend      │ Full-text  │ Facets    │ Ops cost │ Best for       │
├──────────────┼────────────┼───────────┼──────────┼───────────────┤
│ PostgreSQL   │ tsvector   │ GROUP BY  │ Low      │ Up to ~1M rows │
│ (pg_trgm)    │ tsquery    │           │          │ Already on PG  │
├──────────────┼────────────┼───────────┼──────────┼───────────────┤
│ Elasticsearch│ BM25       │ Aggs      │ High     │ 1M+ rows       │
│              │ Analyzers  │ Bucket    │          │ Advanced search│
├──────────────┼────────────┼───────────┼──────────┼───────────────┤
│ OpenSearch   │ BM25       │ Aggs      │ Med–High │ AWS env        │
│              │ Analyzers  │ Bucket    │          │ ES compatibility│
├──────────────┼────────────┼───────────┼──────────┼───────────────┤
│ Meilisearch  │ Built-in   │ Built-in  │ Low      │ Up to ~10M     │
│              │ Typo-tol.  │           │          │ Easy setup     │
├──────────────┼────────────┼───────────┼──────────┼───────────────┤
│ Typesense    │ Built-in   │ Built-in  │ Low      │ Up to ~10M     │
│              │ Typed      │           │          │ Type safety    │
├──────────────┼────────────┼───────────┼──────────┼───────────────┤
│ Algolia      │ Hosted     │ Built-in  │ High     │ Any scale      │
│              │ SaaS       │           │          │ Instant deploy │
└──────────────┴────────────┴───────────┴──────────┴───────────────┘
```

### 8.3 PostgreSQL Full-Text Search Implementation

```sql
-- PostgreSQL full-text search setup

-- 1. Add tsvector column
ALTER TABLE users ADD COLUMN search_vector tsvector;

-- 2. Auto-update with trigger
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.email, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.bio, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_search_vector_trigger
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- 3. Create GIN index
CREATE INDEX idx_users_search_vector ON users USING GIN (search_vector);

-- 4. Search query
SELECT
  id, name, email,
  ts_rank(search_vector, query) AS relevance
FROM users,
  to_tsquery('simple', 'taro') AS query
WHERE search_vector @@ query
ORDER BY relevance DESC
LIMIT 20;

-- 5. Prefix match (for autocomplete)
SELECT id, name
FROM users
WHERE name ILIKE 'tar%'
ORDER BY name
LIMIT 10;

-- 6. Similarity search with pg_trgm (typo tolerance)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_users_name_trgm ON users USING GIN (name gin_trgm_ops);

SELECT id, name, similarity(name, 'trao') AS sim
FROM users
WHERE name % 'trao'  -- similarity threshold (default 0.3)
ORDER BY sim DESC
LIMIT 10;
```

---

## 9. Integrated Implementation of Pagination + Filtering + Sorting

Here we show a production-quality API endpoint implementation that integrates
all the features explained individually above.

### 9.1 Integrated Controller (Express.js + Prisma)

```javascript
// routes/users.js - Integrated list retrieval endpoint

const express = require('express');
const router = express.Router();

/**
 * GET /api/v1/users
 *
 * Query parameters:
 *   - page / per_page     : Offset-based pagination
 *   - cursor / limit      : Cursor-based pagination
 *   - filter[field][op]   : Filtering
 *   - sort                : Sorting (- prefix for descending)
 *   - fields              : Field selection
 *   - q                   : Full-text search
 *   - include_total       : Whether to include total count
 */
router.get('/users', async (req, res, next) => {
  try {
    const {
      page, per_page, cursor, limit,
      sort, fields, q, include_total,
    } = req.query;

    // --- Determine pagination approach ---
    const useCursor = cursor != null || (page == null && cursor == null);
    // Use Cursor approach if cursor parameter is present, or if nothing is specified

    // --- Parse filters ---
    const filters = parseFilters(req.query, USERS_FILTER_SCHEMA);
    const where = filtersToPrismaWhere(filters);

    // --- Integrate full-text search ---
    if (q) {
      // Integrate PostgreSQL full-text search into WHERE
      where.searchVector = {
        search: q.split(/\s+/).join(' & '),
      };
    }

    // --- Parse sort ---
    const orderBy = parseSort(sort, USERS_SORT_FIELDS);

    // --- Field selection ---
    const select = parseFields(fields, USERS_ALLOWED_FIELDS);

    let result;

    if (useCursor) {
      // --- Cursor approach ---
      result = await cursorPaginate({
        model: prisma.user,
        where,
        orderBy,
        select,
        cursor,
        limit: limit ? parseInt(limit, 10) : 20,
      });
    } else {
      // --- Offset approach ---
      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const perPage = Math.min(
        Math.max(parseInt(per_page, 10) || 20, 1),
        100
      );

      result = await offsetPaginate({
        model: prisma.user,
        where,
        orderBy,
        select,
        page: pageNum,
        perPage,
        includeTotal: include_total === 'true',
      });
    }

    // --- Set response headers ---
    if (result.meta.total != null) {
      res.set('X-Total-Count', result.meta.total.toString());
    }

    // Link header (RFC 8288)
    if (result.links) {
      const linkParts = Object.entries(result.links)
        .filter(([, url]) => url != null)
        .map(([rel, url]) => `<${url}>; rel="${rel}"`);
      if (linkParts.length > 0) {
        res.set('Link', linkParts.join(', '));
      }
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// --- Cursor pagination function ---
async function cursorPaginate({ model, where, orderBy, select, cursor, limit }) {
  const take = Math.min(Math.max(limit, 1), 100);

  if (cursor) {
    const decoded = decodeCursor(cursor);
    const sortField = Object.keys(orderBy[0])[0];
    const sortDir = Object.values(orderBy[0])[0];
    const cursorWhere = buildCursorWhere(
      [sortField, 'id'],
      decoded,
      [sortDir, sortDir]
    );
    // AND-combine with existing where
    if (cursorWhere.OR) {
      where.AND = where.AND || [];
      where.AND.push(cursorWhere);
    }
  }

  const items = await model.findMany({
    where,
    orderBy,
    select,
    take: take + 1,
  });

  const hasNextPage = items.length > take;
  const data = hasNextPage ? items.slice(0, take) : items;

  const sortField = Object.keys(orderBy[0])[0];

  return {
    data,
    meta: {
      hasNextPage,
      nextCursor: hasNextPage
        ? encodeCursor({
            [sortField]: data[data.length - 1][sortField],
            id: data[data.length - 1].id,
          })
        : null,
      hasPrevPage: !!cursor,
      prevCursor: data.length > 0
        ? encodeCursor({
            [sortField]: data[0][sortField],
            id: data[0].id,
          })
        : null,
      limit: take,
    },
  };
}

// --- Offset pagination function ---
async function offsetPaginate({
  model, where, orderBy, select, page, perPage, includeTotal,
}) {
  const skip = (page - 1) * perPage;

  const [data, total] = await Promise.all([
    model.findMany({
      where,
      orderBy,
      select,
      skip,
      take: perPage,
    }),
    includeTotal ? model.count({ where }) : Promise.resolve(null),
  ]);

  const totalPages = total != null ? Math.ceil(total / perPage) : null;
  const baseUrl = '/api/v1/users'; // In practice, construct from request

  return {
    data,
    meta: {
      total,
      page,
      perPage,
      totalPages,
      hasNextPage: totalPages != null ? page < totalPages : data.length === perPage,
      hasPrevPage: page > 1,
    },
    links: {
      self:  `${baseUrl}?page=${page}&per_page=${perPage}`,
      first: `${baseUrl}?page=1&per_page=${perPage}`,
      prev:  page > 1 ? `${baseUrl}?page=${page - 1}&per_page=${perPage}` : null,
      next:  (totalPages == null || page < totalPages)
               ? `${baseUrl}?page=${page + 1}&per_page=${perPage}`
               : null,
      last:  totalPages != null
               ? `${baseUrl}?page=${totalPages}&per_page=${perPage}`
               : null,
    },
  };
}

module.exports = router;
```

---

## 10. Anti-Patterns and Mitigations

### 10.1 Anti-Pattern 1: Unlimited limit API

```
[Problem]
  GET /api/v1/users?limit=999999999

  When a client can specify a huge limit, the following problems arise:

  (a) Memory exhaustion:
      Expanding 1 million user objects in memory
      → JSON serialization further doubles memory usage
      → Process crash due to OOM Kill

  (b) Response time exceeded:
      Generating and transferring a huge JSON response takes time
      → Timeout → Retry → Even higher load

  (c) DoS attack vector:
      A malicious client repeatedly sends huge requests
      → Server resource exhaustion

[Mitigation]
  // Clamp limit (required)
  const MAX_LIMIT = 100;
  const DEFAULT_LIMIT = 20;

  function clampLimit(requestedLimit) {
    if (requestedLimit == null) return DEFAULT_LIMIT;
    const parsed = parseInt(requestedLimit, 10);
    if (isNaN(parsed) || parsed < 1) return DEFAULT_LIMIT;
    return Math.min(parsed, MAX_LIMIT);
  }

  // Document the upper limit clearly:
  // "limit: integer from 1 to 100 (default: 20, max: 100)"

  // Notify the client of the upper limit via response header:
  // X-Max-Limit: 100
```

### 10.2 Anti-Pattern 2: Unconditional COUNT(*) Execution

```
[Problem]
  Running COUNT(*) on every list API request:

  SELECT COUNT(*) FROM users WHERE status = 'active';
  -- For a 10M row table, ~200ms

  Additionally, for complex filter conditions:
  SELECT COUNT(*) FROM users
  WHERE status = 'active'
    AND role IN ('admin', 'editor')
    AND created_at > '2023-01-01';
  -- In cases where indexes do not help: ~2000ms

  If this query runs on every request,
  DB CPU usage stays constantly high.

[Mitigation]

  (1) Make total count opt-in:
      GET /api/v1/users?include_total=true
      → Do not return total by default

  (2) Return an estimated value (PostgreSQL):
      -- Use estimated row count instead of exact COUNT
      SELECT reltuples::bigint AS estimate
      FROM pg_class
      WHERE relname = 'users';
      -- Updated periodically by ANALYZE

  (3) Use a count cache:
      -- Cache count in Redis (TTL 60 seconds)
      const cacheKey = `count:users:${filterHash}`;
      let total = await redis.get(cacheKey);
      if (total == null) {
        total = await prisma.user.count({ where });
        await redis.set(cacheKey, total, 'EX', 60);
      }

  (4) "Load more" pattern:
      → Do not return total, return only hasNextPage
      → Avoid "All N results" display; show only "Load more" button
      → Common pattern in mobile apps
```

### 10.3 Anti-Pattern 3: Blacklist Approach for Filter Fields

```
[Problem]
  // Design that allows everything except "blocked fields"
  const blockedFields = ['password', 'secret'];

  function isAllowedFilter(field) {
    return !blockedFields.includes(field);
  }

  // When a new field (e.g., internal_notes) is added,
  // forgetting to update the blocklist allows filtering of sensitive information.

[Mitigation]
  // Use whitelist approach (explicitly list allowed fields)
  const ALLOWED_FILTER_FIELDS = [
    'status', 'role', 'name', 'email', 'createdAt'
  ];

  function isAllowedFilter(field) {
    return ALLOWED_FILTER_FIELDS.includes(field);
  }

  // New fields are not filterable until intentionally added
  // → Deny by default principle
```

---

## 11. Edge Case Analysis

### 11.1 Edge Case 1: Duplicate Sort Key Values

```
[Situation]
  100 users share the same created_at:

  id=1,  created_at='2024-01-15'
  id=2,  created_at='2024-01-15'
  id=3,  created_at='2024-01-15'
  ...
  id=100, created_at='2024-01-15'

  Using only created_at as the cursor in Cursor approach:

  Page 1: WHERE created_at <= '2024-01-15' LIMIT 20
  → Fetches id=1~20 (order within same created_at is undefined)

  Page 2: WHERE created_at < '2024-01-15' LIMIT 20
  → 0 records (no rows match since all have the same created_at)

  Result: Page 2 and beyond cannot be fetched.

[Solution]
  Always include a unique key (id) as a tiebreaker in the composite key:

  -- Correct SQL
  WHERE (created_at, id) < ('2024-01-15', 20)
  ORDER BY created_at DESC, id DESC
  LIMIT 20;

  This ensures unique ordering by id even when created_at is the same.

  Cursor data:
  { "createdAt": "2024-01-15", "id": 20 }

  [Lesson]
  Always include a unique key (id) in the cursor.
  This is the fundamental principle of a "Stable Cursor".
```

### 11.2 Edge Case 2: NULL Values in Sort Keys

```
[Situation]
  Some users have a NULL deleted_at:

  id=1, deleted_at=NULL        (not deleted)
  id=2, deleted_at='2024-03-01' (deleted)
  id=3, deleted_at=NULL        (not deleted)
  id=4, deleted_at='2024-01-15' (deleted)

  Sorting by deleted_at DESC:
  → NULL position differs by DBMS
    PostgreSQL: NULL first (NULLS FIRST is default for DESC)
    MySQL: NULL last (for DESC)

  Comparison does not work correctly when NULL is included in the cursor:
  WHERE deleted_at < NULL → Always FALSE (comparison with NULL is UNKNOWN)

[Solution]

  (1) Avoid sorting on fields that contain NULL
      → Restrict sortable fields to NOT NULL ones

  (2) Replace NULL with COALESCE when NULLs are present:
      ORDER BY COALESCE(deleted_at, '9999-12-31') DESC, id DESC

  (3) Treat NULL specially within the cursor:
      function buildCursorWhereWithNull(sortField, cursorValue, id) {
        if (cursorValue === null) {
          // Adjust condition based on NULL position (NULLS FIRST / LAST)
          return {
            OR: [
              { [sortField]: { not: null } }, // All non-NULL rows come "after"
              { [sortField]: null, id: { lt: id } }, // Same NULL, compare by id
            ],
          };
        }
        return {
          OR: [
            { [sortField]: { lt: cursorValue } },
            { [sortField]: cursorValue, id: { lt: id } },
          ],
        };
      }

  [Lesson]
  When sort keys allow NULL, you must explicitly control NULL ordering
  and treat NULL specially in cursor comparisons.
  Where possible, restrict sortable fields to those with a NOT NULL constraint.
```

### 11.3 Edge Case 3: Concurrent Writes and Cursor Consistency

```
[Situation]
  Time T1: Client fetches page 1
           cursor = { createdAt: '2024-06-10', id: 20 }

  Time T2: Admin updates id=15 user's createdAt
           from '2024-06-10' to '2024-06-11'

  Time T3: Client fetches page 2 (using cursor)
           WHERE (created_at, id) < ('2024-06-10', 20)

  Result:
  - id=15 is excluded from both page 1 and page 2
    because its createdAt changed to '2024-06-11' (disappears)
  - When sort keys are mutable fields,
    data disappearance or duplication can occur even with Cursor approach

[Mitigation]
  (1) Use immutable fields as sort keys:
      → created_at (creation date is not changed)
      → id (primary key is not changed)
      → sequence_number (sequence is not changed)

  (2) Prohibit changes to sort keys:
      → When sorting by updated_at, decide at the business level
        whether updates during paging are acceptable

  (3) Snapshot approach:
      → Issue a snapshot ID at the start of paging,
        and reference the same snapshot until all pages are fetched
      → Implementation is complex, but consistency is highest
```

---

## 12. Index Strategy

The performance of pagination, filtering, and sorting depends heavily
on appropriate index design.

### 12.1 Index Design Principles

```
Index strategy for pagination:

  (1) Offset approach:
      -- Create index on sort key
      CREATE INDEX idx_users_created_at ON users (created_at DESC);

      -- Composite index for filter + sort
      CREATE INDEX idx_users_status_created
        ON users (status, created_at DESC);

  (2) Cursor / Keyset approach:
      -- Composite index on sort key + ID (required)
      CREATE INDEX idx_users_created_id
        ON users (created_at DESC, id DESC);

      -- Composite index for filter + sort key + ID
      CREATE INDEX idx_users_status_created_id
        ON users (status, created_at DESC, id DESC);

  (3) Covering index:
      -- Include SELECT columns to avoid table scan
      CREATE INDEX idx_users_list_covering
        ON users (status, created_at DESC, id DESC)
        INCLUDE (name, email, role);
      -- INCLUDE available in PostgreSQL 11+

  Index design flowchart:

  Filter conditions → Put equality columns first
       ↓
  Sort conditions → Put sort keys next
       ↓
  Pagination → Put id last
       ↓
  SELECT targets → Add with INCLUDE (covering)

  Example: status = 'active' AND role = 'admin' ORDER BY created_at DESC

  CREATE INDEX idx_users_optimal
    ON users (status, role, created_at DESC, id DESC)
    INCLUDE (name, email);

  → WHERE status = 'active' AND role = 'admin'
    narrows down using the first 2 index columns,
    ORDER BY created_at DESC, id DESC
    is covered by subsequent index columns,
    name, email do not require table access via INCLUDE.
```

### 12.2 Verification with EXPLAIN ANALYZE

```sql
-- Execution plan for Offset approach (problematic case)
EXPLAIN ANALYZE
SELECT * FROM users
ORDER BY created_at DESC
LIMIT 20 OFFSET 100000;

-- Result (example):
-- Limit  (cost=12345.67..12346.00 rows=20)
--   -> Sort  (cost=12345.67..15000.00 rows=1000000)
--         Sort Key: created_at DESC
--         Sort Method: top-N heapsort  Memory: 30kB
--         -> Seq Scan on users  (cost=0.00..10000.00 rows=1000000)
-- Planning Time: 0.5ms
-- Execution Time: 580ms  ← slow

-- Execution plan for Cursor approach (after improvement)
EXPLAIN ANALYZE
SELECT * FROM users
WHERE (created_at, id) < ('2024-01-15', 100)
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- Result (example):
-- Limit  (cost=0.56..1.80 rows=20)
--   -> Index Scan using idx_users_created_id on users
--         (cost=0.56..5000.00 rows=100000)
--         Index Cond: (created_at, id) < ('2024-01-15', 100)
-- Planning Time: 0.3ms
-- Execution Time: 1.2ms  ← fast
```

---

## 13. Rate Limits and Pagination

Pagination APIs are closely related to rate limits.
Fetching many pages is considered batch-like processing, and it may be appropriate to apply
a different rate limit policy than for normal API calls.

### 13.1 Rate Limit Design for Pagination APIs

```
Rate limit design considerations:

  (1) Standard rate limits:
      X-RateLimit-Limit: 1000        (limit per hour)
      X-RateLimit-Remaining: 998     (remaining requests)
      X-RateLimit-Reset: 1719849600  (reset time, Unix epoch)

  (2) Pagination-specific considerations:
      - 1 page fetch = counts as 1 request
      - Apply cost weighting for requests with large limit
        e.g., limit=100 → counts as 5 requests
      - Throttle if automated batch fetching (traversing all pages) is detected
      - Notify wait time via Retry-After header

  (3) Example of cost weighting for pagination:
      ┌────────────┬───────────────┐
      │ limit value │ Cost (in requests) │
      ├────────────┼───────────────┤
      │ 1–20       │ 1              │
      │ 21–50      │ 2              │
      │ 51–100     │ 5              │
      └────────────┴───────────────┘

  (4) When bulk export is required:
      → Provide a dedicated export endpoint
      → Process as an async job
      → Return CSV/JSON file URL via webhook or polling

      POST /api/v1/exports
      {
        "resource": "users",
        "format": "csv",
        "filters": { "status": "active" }
      }

      202 Accepted
      {
        "exportId": "exp_abc123",
        "status": "processing",
        "statusUrl": "/api/v1/exports/exp_abc123"
      }
```

---

## 14. Cache Strategy

### 14.1 Caching Pagination APIs

```
Cache strategy for pagination results:

  ┌────────────────────────────────────────────────────────────┐
  │                   Cache Decision Criteria                   │
  ├──────────┬──────────────┬──────────────┬──────────────────┤
  │ Approach │ Cache suit.  │ Cache key    │ TTL guideline    │
  ├──────────┼──────────────┼──────────────┼──────────────────┤
  │ Offset   │ High         │ page+filter  │ 30s–5min         │
  │ Cursor   │ Low          │ cursor+limit │ Single-use       │
  │ Keyset   │ Low          │ keys+limit   │ Single-use       │
  └──────────┴──────────────┴──────────────┴──────────────────┘

  Offset approach is cache-friendly:
  → The same page=3&per_page=20 is expected to return the same result
  → Caching at CDN or reverse proxy is effective
  → Adjust TTL based on data update frequency

  Cursor approach is not cache-friendly:
  → Cursor contains user-specific context
  → Data for the same cursor may differ depending on retrieval timing
  → If caching, use cursor value as key with short TTL

  Example HTTP cache header settings:

  // Offset approach (cacheable)
  Cache-Control: public, max-age=30, s-maxage=60
  ETag: "users-page3-v1234"
  Vary: Accept, Authorization

  // Cursor approach (caching not recommended)
  Cache-Control: private, no-store
  // or
  Cache-Control: private, max-age=10
```

### 14.2 Using Conditional Requests

```javascript
// Conditional requests with ETag

// Server side
router.get('/users', async (req, res) => {
  const result = await listUsers(req.query);

  // Generate ETag from data hash
  const etag = generateETag(result.data);

  // Check If-None-Match header
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end(); // Not Modified
  }

  res.set('ETag', etag);
  res.set('Cache-Control', 'private, max-age=30');
  res.json(result);
});

function generateETag(data) {
  const crypto = require('crypto');
  const hash = crypto
    .createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex');
  return `"${hash}"`;
}
```

---

## 15. Best Practices Summary

### 15.1 Design Principles

```
Pagination design principles:

  [Required]
  (1) Always set default values
      → Default limit: 20
      → Default sort: -created_at
      → Default page: 1

  (2) Set upper bounds
      → Max limit: 100
      → Max page: reasonable range
      → Max number of sort fields: 3

  (3) Return 200 + empty array for empty collections
      → Not 404 (collection exists but is empty)
      {
        "data": [],
        "meta": { "total": 0, "page": 1, "totalPages": 0 }
      }

  (4) Document filterable and sortable fields clearly
      → Define as enum in OpenAPI / Swagger
      → List in API documentation parameter descriptions

  [Recommended]
  (5) Include HATEOAS links
      → self, first, prev, next, last
      → Also use Link header (RFC 8288)

  (6) Structure metadata
      → 3-tier structure: data / meta / links
      → meta contains total, page, perPage, hasNextPage, etc.

  (7) Use consistent naming conventions
      → snake_case vs camelCase should be unified across the project
      → page / per_page / limit / offset naming unified across the API

  (8) Relationship with versioning
      → Changes to pagination parameters are breaking changes
      → Increment API version or maintain backward compatibility
```

### 15.2 Performance Checklist

```
Performance optimization checklist:

  [Indexes]
  [ ] Is there an index on sort fields?
  [ ] Is there a composite index for filter + sort?
  [ ] For Cursor approach, is there a composite index on (sort_key, id)?
  [ ] Has a covering index been considered?

  [Queries]
  [ ] Are only necessary columns fetched instead of SELECT *?
  [ ] Is COUNT(*) only executed when needed?
  [ ] Has the execution plan been verified with EXPLAIN ANALYZE?
  [ ] Are there any N+1 issues?

  [Application]
  [ ] Is there an upper bound check on limit?
  [ ] Is there a whitelist for filter/sort fields?
  [ ] Is there cursor validation?
  [ ] Is response JSON serialization efficient?

  [Infrastructure]
  [ ] Is there an appropriate caching strategy?
  [ ] Is rate limiting configured?
  [ ] Is the database connection pool appropriate?
  [ ] Are timeouts configured?
```

### 15.3 Security Checklist

```
Security checklist:

  [Input Validation]
  [ ] Whitelist validation for filter fields
  [ ] Whitelist validation for sort fields
  [ ] Range check for limit (1–100)
  [ ] Range check for page (1–reasonable upper bound)
  [ ] Cursor format validation
  [ ] Search query sanitization
  [ ] Type check for filter values

  [Output Control]
  [ ] Exclusion of sensitive fields (password, secret, etc.)
  [ ] Field restriction based on permissions
  [ ] Filter restrictions to prevent leaking other users' data

  [DoS Mitigation]
  [ ] Upper bound check on limit
  [ ] Limit on concurrent requests
  [ ] Restriction on complex filters (number of operators, nesting depth)
  [ ] Length limit on full-text search queries

  [Cursor Security]
  [ ] Cursor signing or encryption
  [ ] Cursor expiration
  [ ] Prevention of reusing another user's cursor
```

---

## 16. Exercises

### 16.1 Exercise Level 1: Basic Offset Pagination

```
[Task]
  Design an Offset pagination API that satisfies the following spec.

  Endpoint: GET /api/v1/products
  Parameters:
    - page (default: 1)
    - per_page (default: 20, max: 100)
    - sort (default: -created_at)

  Response format:
    - data: array of products
    - meta: total, page, perPage, totalPages, hasNextPage, hasPrevPage
    - links: self, first, prev, next, last

  Table definition:
    products (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(200) NOT NULL,
      price       DECIMAL(10,2) NOT NULL,
      category    VARCHAR(50) NOT NULL,
      status      VARCHAR(20) DEFAULT 'active',
      created_at  TIMESTAMP DEFAULT NOW(),
      updated_at  TIMESTAMP DEFAULT NOW()
    )

[Expected implementation elements]
  1. Parameter validation
  2. Sort field whitelist
  3. Limit clamping
  4. Dynamic link generation
  5. Appropriate SQL (or ORM) query
```

```javascript
// Sample solution
router.get('/products', async (req, res) => {
  // 1. Parse and validate parameters
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const perPage = Math.min(
    Math.max(parseInt(req.query.per_page, 10) || 20, 1),
    100
  );

  // 2. Parse sort
  const SORT_FIELDS = ['created_at', 'name', 'price', 'updated_at'];
  const orderBy = parseSort(req.query.sort || '-created_at', SORT_FIELDS);

  // 3. Fetch data (parallel execution with Promise.all)
  const skip = (page - 1) * perPage;
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: { status: 'active' },
      orderBy,
      skip,
      take: perPage,
    }),
    prisma.product.count({ where: { status: 'active' } }),
  ]);

  // 4. Build metadata and links
  const totalPages = Math.ceil(total / perPage);
  const baseUrl = `${req.protocol}://${req.get('host')}/api/v1/products`;

  res.json({
    data: products,
    meta: {
      total,
      page,
      perPage,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    links: {
      self:  `${baseUrl}?page=${page}&per_page=${perPage}`,
      first: `${baseUrl}?page=1&per_page=${perPage}`,
      prev:  page > 1 ? `${baseUrl}?page=${page - 1}&per_page=${perPage}` : null,
      next:  page < totalPages ? `${baseUrl}?page=${page + 1}&per_page=${perPage}` : null,
      last:  `${baseUrl}?page=${totalPages}&per_page=${perPage}`,
    },
  });
});
```

### 16.2 Exercise Level 2: Cursor Pagination + Filtering

```
[Task]
  Implement a Cursor pagination + filtering API that satisfies the following spec.

  Endpoint: GET /api/v1/orders
  Parameters:
    - cursor (Base64url encoded)
    - limit (default: 20, max: 50)
    - filter[status] (in: pending, processing, shipped, delivered, cancelled)
    - filter[total][gte] (minimum amount)
    - filter[total][lte] (maximum amount)
    - filter[created_at][gte] (start date)
    - filter[created_at][lte] (end date)
    - sort (default: -created_at)

  Table definition:
    orders (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      status      VARCHAR(20) NOT NULL,
      total       DECIMAL(10,2) NOT NULL,
      item_count  INTEGER NOT NULL,
      created_at  TIMESTAMP DEFAULT NOW(),
      updated_at  TIMESTAMP DEFAULT NOW()
    )

  Requirements:
    - Cursor must be signed (tamper-proof)
    - Filter fields must use whitelist approach
    - Sort must support composite sort (e.g., -total,created_at)
    - Return 200 + empty array even for empty results
```

```javascript
// Sample solution (core logic)
const ORDER_FILTER_SCHEMA = {
  status: {
    type: 'enum',
    values: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
  },
  total: { type: 'decimal', min: 0, max: 99999999.99 },
  createdAt: { type: 'datetime' },
};

const ORDER_SORT_FIELDS = ['created_at', 'total', 'item_count', 'updated_at'];

router.get('/orders', authenticate, async (req, res) => {
  const { cursor, limit: limitParam, sort: sortParam } = req.query;
  const limit = Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 50);

  // Parse filters
  const filters = parseFilters(req.query, ORDER_FILTER_SCHEMA);
  const where = filtersToPrismaWhere(filters);

  // Restrict to authenticated user's data only
  where.userId = req.user.id;

  // Parse sort (with stable sort guarantee)
  const orderBy = parseSort(sortParam || '-created_at', ORDER_SORT_FIELDS);

  // Process cursor
  if (cursor) {
    const decoded = decodeSecureCursor(cursor);
    const sortField = Object.keys(orderBy[0])[0];
    const sortDir = Object.values(orderBy[0])[0];
    const cursorWhere = buildCursorWhere(
      [sortField, 'id'], decoded, [sortDir, sortDir]
    );
    where.AND = where.AND || [];
    where.AND.push(cursorWhere);
  }

  // Fetch data
  const items = await prisma.order.findMany({
    where,
    orderBy,
    take: limit + 1,
    select: {
      id: true, status: true, total: true,
      itemCount: true, createdAt: true, updatedAt: true,
    },
  });

  const hasNextPage = items.length > limit;
  const data = hasNextPage ? items.slice(0, limit) : items;

  const sortField = Object.keys(orderBy[0])[0];
  res.json({
    data,
    meta: {
      hasNextPage,
      nextCursor: hasNextPage
        ? encodeSecureCursor({
            [sortField]: data[data.length - 1][sortField],
            id: data[data.length - 1].id,
          })
        : null,
      hasPrevPage: !!cursor,
      limit,
    },
  });
});
```

### 16.3 Exercise Level 3: GraphQL Connection + Faceted Search

```
[Task]
  Implement a product search API conforming to the GraphQL Relay Connection spec.

  Schema:
    type Query {
      searchProducts(
        query: String
        first: Int
        after: String
        last: Int
        before: String
        filter: ProductFilter
        orderBy: ProductOrderBy
      ): ProductSearchConnection!
    }

    type ProductSearchConnection {
      edges: [ProductEdge!]!
      pageInfo: PageInfo!
      totalCount: Int!
      facets: ProductFacets!
    }

    type ProductFacets {
      categories: [FacetBucket!]!
      priceRanges: [FacetBucket!]!
      ratings: [FacetBucket!]!
    }

    type FacetBucket {
      value: String!
      count: Int!
    }

  Requirements:
    1. Bidirectional pagination with first/after and last/before
    2. Full-text search (query parameter)
    3. Filtering (category, priceRange, rating)
    4. Facet aggregation (aggregated values after filter is applied)
    5. Sorting (relevance, price, rating, newest)
    6. totalCount is the count after filter is applied
```

```javascript
// Sample solution (GraphQL resolver)
const resolvers = {
  Query: {
    searchProducts: async (_, args, ctx) => {
      const {
        query, first, after, last, before,
        filter, orderBy,
      } = args;

      // Parameter validation
      if (first != null && last != null) {
        throw new UserInputError('first and last cannot be specified at the same time');
      }
      const limit = Math.min(first ?? last ?? 20, 100);

      // Build search conditions
      const where = {};
      if (query) {
        where.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { brand: { contains: query, mode: 'insensitive' } },
        ];
      }
      if (filter?.category) where.category = { in: filter.category };
      if (filter?.minPrice) where.price = { ...where.price, gte: filter.minPrice };
      if (filter?.maxPrice) where.price = { ...where.price, lte: filter.maxPrice };
      if (filter?.minRating) where.rating = { gte: filter.minRating };

      // Sort
      const sortMap = {
        RELEVANCE: query ? undefined : [{ createdAt: 'desc' }],
        PRICE_ASC: [{ price: 'asc' }, { id: 'asc' }],
        PRICE_DESC: [{ price: 'desc' }, { id: 'desc' }],
        RATING: [{ rating: 'desc' }, { id: 'desc' }],
        NEWEST: [{ createdAt: 'desc' }, { id: 'desc' }],
      };
      const sort = sortMap[orderBy?.field || 'NEWEST'];

      // Cursor processing
      if (after) {
        const cursor = decodeCursor(after);
        const sortField = Object.keys(sort[0])[0];
        const sortDir = Object.values(sort[0])[0];
        where.AND = where.AND || [];
        where.AND.push(
          buildCursorWhere([sortField, 'id'], cursor, [sortDir, sortDir])
        );
      }
      if (before) {
        const cursor = decodeCursor(before);
        const sortField = Object.keys(sort[0])[0];
        const sortDir = Object.values(sort[0])[0] === 'desc' ? 'asc' : 'desc';
        where.AND = where.AND || [];
        where.AND.push(
          buildCursorWhere([sortField, 'id'], cursor, [sortDir, sortDir])
        );
      }

      // Parallel execution of data fetch + facet aggregation
      const [items, totalCount, categoryFacets, ratingFacets] = await Promise.all([
        ctx.prisma.product.findMany({
          where,
          orderBy: last ? sort.map(s => {
            const [k, v] = Object.entries(s)[0];
            return { [k]: v === 'desc' ? 'asc' : 'desc' };
          }) : sort,
          take: limit + 1,
        }),
        ctx.prisma.product.count({ where }),
        ctx.prisma.product.groupBy({
          by: ['category'],
          where,
          _count: { category: true },
          orderBy: { _count: { category: 'desc' } },
        }),
        ctx.prisma.product.groupBy({
          by: ['rating'],
          where,
          _count: { rating: true },
          orderBy: { rating: 'desc' },
        }),
      ]);

      // Reverse results for last
      let nodes = last ? [...items].reverse() : items;
      const hasMore = nodes.length > limit;
      nodes = hasMore ? nodes.slice(0, limit) : nodes;

      const sortField = Object.keys(sort[0])[0];
      const edges = nodes.map(node => ({
        cursor: encodeCursor({ [sortField]: node[sortField], id: node.id }),
        node,
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: first != null ? hasMore : !!before,
          hasPreviousPage: last != null ? hasMore : !!after,
          startCursor: edges[0]?.cursor ?? null,
          endCursor: edges[edges.length - 1]?.cursor ?? null,
        },
        totalCount,
        facets: {
          categories: categoryFacets.map(f => ({
            value: f.category,
            count: f._count.category,
          })),
          priceRanges: buildPriceRangeFacets(nodes),
          ratings: ratingFacets.map(f => ({
            value: f.rating.toString(),
            count: f._count.rating,
          })),
        },
      };
    },
  },
};

function buildPriceRangeFacets(products) {
  const ranges = [
    { label: '0-1000', min: 0, max: 1000 },
    { label: '1001-5000', min: 1001, max: 5000 },
    { label: '5001-10000', min: 5001, max: 10000 },
    { label: '10001+', min: 10001, max: Infinity },
  ];
  return ranges.map(range => ({
    value: range.label,
    count: products.filter(
      p => p.price >= range.min && p.price <= range.max
    ).length,
  }));
}
```

---

## 17. Pagination Implementation Patterns by Framework

### 17.1 Comparison by Framework

```
Pagination support status by major framework:

┌───────────────┬──────────┬──────────┬─────────────────────────┐
│ Framework     │ Offset   │ Cursor   │ Notes                   │
├───────────────┼──────────┼──────────┼─────────────────────────┤
│ Django REST   │ Built-in │ Built-in │ PageNumberPagination     │
│ Framework     │          │          │ CursorPagination         │
├───────────────┼──────────┼──────────┼─────────────────────────┤
│ Rails (Kaminari)│ Built-in│ Add gem │ kaminari + order_query   │
├───────────────┼──────────┼──────────┼─────────────────────────┤
│ Spring Data   │ Built-in │ Manual   │ Pageable + Slice         │
├───────────────┼──────────┼──────────┼─────────────────────────┤
│ FastAPI       │ Manual   │ Manual   │ fastapi-pagination       │
├───────────────┼──────────┼──────────┼─────────────────────────┤
│ Express.js    │ Manual   │ Manual   │ Prisma / TypeORM         │
├───────────────┼──────────┼──────────┼─────────────────────────┤
│ NestJS        │ Manual   │ Manual   │ nestjs-paginate          │
├───────────────┼──────────┼──────────┼─────────────────────────┤
│ Apollo Server │ Manual   │ Manual   │ Relay Connection spec    │
│ (GraphQL)     │          │          │ graphql-relay            │
├───────────────┼──────────┼──────────┼─────────────────────────┤
│ Hasura        │ Built-in │ Built-in │ offset/limit + cursor    │
│ (GraphQL)     │          │          │ auto-generated           │
└───────────────┴──────────┴──────────┴─────────────────────────┘
```

### 17.2 Python (FastAPI + SQLAlchemy) Implementation Example

```python
# Cursor pagination with FastAPI + SQLAlchemy

from fastapi import FastAPI, Query, HTTPException
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional, List
from base64 import urlsafe_b64encode, urlsafe_b64decode
import json

app = FastAPI()


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    created_at: str


class CursorMeta(BaseModel):
    has_next_page: bool
    next_cursor: Optional[str]
    has_prev_page: bool
    prev_cursor: Optional[str]
    limit: int


class PaginatedResponse(BaseModel):
    data: List[UserResponse]
    meta: CursorMeta


def encode_cursor(data: dict) -> str:
    return urlsafe_b64encode(
        json.dumps(data).encode()
    ).decode().rstrip("=")


def decode_cursor(cursor: str) -> dict:
    # Pad as necessary
    padding = 4 - len(cursor) % 4
    if padding != 4:
        cursor += "=" * padding
    try:
        return json.loads(urlsafe_b64decode(cursor))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid cursor")


@app.get("/api/v1/users", response_model=PaginatedResponse)
async def list_users(
    cursor: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    sort: str = Query("-created_at"),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    # Parse sort
    desc = sort.startswith("-")
    sort_field = sort.lstrip("-")
    allowed = {"created_at", "name", "email"}
    if sort_field not in allowed:
        raise HTTPException(400, f"Invalid sort: {sort_field}")

    column = getattr(User, sort_field)
    order = column.desc() if desc else column.asc()
    id_order = User.id.desc() if desc else User.id.asc()

    # WHERE conditions
    conditions = []
    if status:
        conditions.append(User.status == status)

    if cursor:
        cur = decode_cursor(cursor)
        cur_val = cur.get(sort_field)
        cur_id = cur.get("id")
        if desc:
            conditions.append(
                or_(
                    column < cur_val,
                    and_(column == cur_val, User.id < cur_id),
                )
            )
        else:
            conditions.append(
                or_(
                    column > cur_val,
                    and_(column == cur_val, User.id > cur_id),
                )
            )

    # Execute query
    query = (
        select(User)
        .where(and_(*conditions) if conditions else True)
        .order_by(order, id_order)
        .limit(limit + 1)
    )
    result = await db.execute(query)
    items = result.scalars().all()

    has_next = len(items) > limit
    data = items[:limit] if has_next else items

    return PaginatedResponse(
        data=[UserResponse.from_orm(u) for u in data],
        meta=CursorMeta(
            has_next_page=has_next,
            next_cursor=(
                encode_cursor({
                    sort_field: str(getattr(data[-1], sort_field)),
                    "id": data[-1].id,
                })
                if has_next else None
            ),
            has_prev_page=cursor is not None,
            prev_cursor=(
                encode_cursor({
                    sort_field: str(getattr(data[0], sort_field)),
                    "id": data[0].id,
                })
                if data else None
            ),
            limit=limit,
        ),
    )
```

---

## 18. FAQ

### Q1: Should I default to Offset or Cursor pagination?

```
A: For new APIs, Cursor is recommended.
   Reasons:
   - Performance does not depend on data volume
   - High data integrity (no position drift)
   - Works well with mobile apps
   - Can handle future scaling

   However, Offset is appropriate in the following cases:
   - Admin panels where page jumping is required
   - Search results requiring "X–Y of N total" display
   - Small data volume (<100K records), no foreseeable performance issues

   Supporting both is also possible:
   - Default to Cursor approach
   - Fall back to Offset when the page parameter is specified
```

### Q2: Should cursors have an expiration time?

```
A: Generally, cursors do not need an expiration time.
   A cursor holds only the value of the sort key
   and does not maintain server-side state (e.g., session),
   so there is no need to manage expiration.

   However, expiration is useful in the following cases:
   - When security requirements restrict cursor reuse
     → Include issued-at time in cursor, reject after a certain period
   - When you want to guarantee data consistency
     → Fetching latest data with an old cursor may cause confusion

   Implementation:
   {
     "createdAt": "2024-01-15",
     "id": 100,
     "issuedAt": 1705305600  // Cursor issue time
   }

   // Check expiration on decode
   const MAX_CURSOR_AGE = 24 * 60 * 60; // 24 hours
   if (Date.now() / 1000 - decoded.issuedAt > MAX_CURSOR_AGE) {
     throw new ApiError(400, 'Cursor has expired');
   }
```

### Q3: Should totalCount be returned in the GraphQL Connection spec?

```
A: totalCount is not part of the official Relay spec,
   but many APIs provide it as an extension field.

   Notes when returning totalCount:
   - Be aware of the cost of COUNT queries (expensive on large tables)
   - Resolve lazily at the field level
     → Only execute query when totalCount is not selected

   // Lazy resolution in resolver
   UserConnection: {
     totalCount: async (parent, _, ctx) => {
       // Only execute COUNT when this field is requested
       return ctx.prisma.user.count({ where: parent._where });
     },
   },

   Alternatives:
   - estimatedTotalCount: return an estimate (faster)
   - Deprecate totalCount and recommend hasNextPage only
   - Cache totalCount (TTL of 30 seconds–5 minutes)
```

### Q4: How do you implement the back navigation when using cursors for infinite scroll?

```
A: In infinite scroll UI, "back" navigation is usually not needed,
   but when the user returns to the list via the browser's back button,
   the scroll position needs to be restored.

   Implementation patterns:
   (1) Cache data on the client side
       → Retain data in React Query / SWR cache
       → Restore from cache even after page navigation

   (2) Include cursor in URL
       → /items?cursor=abc123
       → Cursor remains in browser history, enabling re-fetch on back

   (3) Save scroll position and data to sessionStorage
       → Save on page leave, restore on return
```

### Q5: When combining filters and sort with cursor, should the cursor be reset when the filter changes?

```
A: When filter or sort conditions change,
   the cursor must be reset (set back to null).

   Reasons:
   - Cursor contains sort key values, so it becomes invalid when sort order changes
   - When filter changes, the result set changes,
     making the previous cursor position meaningless

   Client-side implementation:
   // React example
   function useProductList() {
     const [filters, setFilters] = useState({});
     const [sort, setSort] = useState('-created_at');
     const [cursor, setCursor] = useState(null);

     // Reset cursor when filter or sort changes
     useEffect(() => {
       setCursor(null);
     }, [filters, sort]);

     // ...
   }

   Server-side defense:
   - Including a hash of filter/sort in the cursor
     and returning 400 on mismatch is also effective
   {
     "createdAt": "2024-01-15",
     "id": 100,
     "contextHash": "a1b2c3"  // hash of filter+sort
   }
```

---

## 19. Related RFCs and Specifications

The following summarizes standard specs and industry practices related to pagination.

```
Related specifications:

  RFC 8288 - Web Linking
    → Standard for pagination links via Link header
    → Link: <https://api.example.com/users?page=3>; rel="next"

  RFC 7807 - Problem Details for HTTP APIs
    → Response format for pagination errors

  JSON:API v1.1 - Pagination
    → https://jsonapi.org/format/#fetching-pagination
    → Standard for page[number] / page[size] parameters

  GraphQL Relay Cursor Connections Specification
    → https://relay.dev/graphql/connections.htm
    → Standard for first/after/last/before + edges/pageInfo

  OData v4.0 - Query Options
    → $top / $skip / $count / $filter / $orderby
    → Standard query options for enterprise APIs
```

---

## FAQ

### Q1: Which should I choose between Offset and Cursor pagination?

```
A: Choose based on the data characteristics and use case.

When to choose Offset:
  - Admin panels or dashboards where page jumping is essential
  - Relatively small datasets (on the order of thousands)
  - Low data update frequency (low impact of position drift)
  - Users want direct access to "page 3" or "last page"
  - Environments where caching is easy

  Examples: Internal employee lists, product catalog admin screens

When to choose Cursor:
  - Infinite scroll UI such as SNS feeds and timelines
  - Large datasets (tens of thousands or more)
  - High data update frequency (real-time data is important)
  - Mobile apps where performance is critical
  - Page jumping is not needed

  Examples: Twitter/Instagram-style feeds, chat message history

Hybrid approach:
  - Use Cursor for initial load to improve speed
  - Provide Offset for some screens such as search results
  - Document the use case for each approach in the API documentation
```

### Q2: What to do when filter parameters become too many?

```
A: Move complex filters to a POST /search endpoint.

Limitations of GET:
  - URL max length is generally 2048 characters
  - More than 10 filter parameters reduces readability
  - Nested conditions (combinations of AND/OR) are hard to express

  Bad example:
  GET /api/products?
    category=electronics&
    price_min=100&price_max=500&
    brand[]=Sony&brand[]=Panasonic&
    rating_gte=4&
    in_stock=true&
    tags[]=wifi&tags[]=bluetooth&
    created_after=2024-01-01&
    created_before=2024-12-31

Migrating to POST /search:
  POST /api/products/search
  {
    "filters": {
      "category": "electronics",
      "price": { "min": 100, "max": 500 },
      "brand": { "in": ["Sony", "Panasonic"] },
      "rating": { "gte": 4 },
      "in_stock": true,
      "tags": { "all": ["wifi", "bluetooth"] },
      "created_at": {
        "after": "2024-01-01",
        "before": "2024-12-31"
      }
    },
    "sort": ["-rating", "price"],
    "limit": 20,
    "cursor": "abc123"
  }

Advantages:
  - Complex conditions can be expressed in JSON format
  - Nested AND/OR conditions can be written
  - Avoids URL length limits
  - Schema validation is easy (JSON Schema, etc.)
  - Search conditions can be easily saved and shared (save request body)

Notes:
  - Clarify that POST is idempotent (no side effects)
  - Cache strategy for search results is needed since HTTP caching is difficult
  - Use GET for simple search, POST for advanced search
```

### Q3: What are the performance measures for pagination with large datasets?

```
A: A combination of index optimization, query tuning, and caching strategies.

1. Index strategy:
   - Utilize covering indexes
   CREATE INDEX idx_products_pagination
     ON products (category, created_at DESC, id)
     INCLUDE (name, price);

   -- Index-only scan by fetching only necessary columns, not SELECT *
   SELECT id, name, price, category, created_at
   FROM products
   WHERE category = 'electronics'
     AND (created_at, id) < ('2024-01-15', 100)
   ORDER BY created_at DESC, id DESC
   LIMIT 20;

2. Partitioning:
   - Partition time-series data by month/year
   CREATE TABLE products_2024_01 PARTITION OF products
     FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

   -- Scan only the latest data partition
   -- Access to old data retrieved from archive

3. Materialized views:
   - Pre-calculate frequently used filter conditions
   CREATE MATERIALIZED VIEW products_electronics AS
   SELECT * FROM products WHERE category = 'electronics'
   ORDER BY created_at DESC;

   REFRESH MATERIALIZED VIEW CONCURRENTLY products_electronics;

4. Application-level caching:
   - Cache first page (cursor=null) at CDN/Redis
   - Use short TTL (1-5 minutes) to maintain freshness
   // Redis implementation example
   const cacheKey = `products:${category}:first_page`;
   let result = await redis.get(cacheKey);
   if (!result) {
     result = await db.query(...);
     await redis.setex(cacheKey, 300, JSON.stringify(result));
   }

5. Async count:
   - Fetching totalCount is expensive, so use separate request or approximate value
   // Approximate count (PostgreSQL)
   SELECT reltuples::bigint AS estimate
   FROM pg_class
   WHERE relname = 'products';

   // Or separate totalCount to its own endpoint
   GET /api/products/count?category=electronics

6. Progressive data loading:
   - Load only 20 records initially, load more on scroll
   - Avoid "show all" and set an upper limit (e.g., max 1000 records)
   {
     "data": [...],
     "pageInfo": {
       "hasNextPage": true,
       "endCursor": "abc123",
       "remainingEstimate": 500  // Approximate remaining count
     }
   }

Performance targets:
  - P95 response time < 200ms goal
  - Monitor database slow query logs
  - Periodically check execution plans with EXPLAIN ANALYZE
```

---

## Summary

| Concept | Key Point |
|---------|-----------|
| Offset approach | Intuitive but performance degrades at scale. For admin panels and search results |
| Cursor approach | Consistent performance without drift. For SNS, mobile, and large datasets |
| Keyset approach | Variant of Cursor. Exposes keys but easy to debug. For batch processing |
| GraphQL Connection | Relay standard. Structured spec with edges/pageInfo/totalCount |
| Filtering | Whitelist + operator pattern. Security first |
| Sorting | - prefix for descending. Always append id last for stable sort |
| Search | Simple: GET ?q=, complex: POST /search. Faceted search needs dedicated backend |
| Index | Composite index of (filter_key, sort_key, id) is the foundation |
| Security | limit upper bound, whitelist, cursor signing |
| Caching | Offset is cache-friendly. Cursor uses ETag / conditional requests |

---

## What to Read Next

- [REST Best Practices](../01-rest-and-graphql/00-rest-best-practices.md) -- Fundamental principles and implementation patterns for REST API design
- Error Handling Design -- Standardization of API error responses and client handling
- API Versioning Strategy -- Managing breaking changes and maintaining compatibility

---

## References

1. Relay Team. "GraphQL Cursor Connections Specification." relay.dev/graphql/connections.htm, 2024. -- Official documentation for the Connection spec. Defines the structure of edges, pageInfo, and cursor.
2. Stripe. "Pagination - API Reference." stripe.com/docs/api/pagination, 2024. -- Industry-standard implementation example of cursor-based pagination. Also provides an auto-pagination helper.
3. JSON:API. "Fetching Data - Pagination." jsonapi.org/format/#fetching-pagination, 2024. -- Standard pagination design in the JSON:API spec. Defines page[number] / page[size] parameters.
4. Slack. "Pagination - Web API." api.slack.com/docs/pagination, 2024. -- Migration case study for cursor-based pagination. Explains the step-by-step migration from Offset to Cursor.
5. GitHub. "Using pagination in the REST API." docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api, 2024. -- Implementation example using Link header (RFC 8288). Includes per_page upper limit settings.
6. Markus Winand. "No Offset: Keyset Pagination for SQL." use-the-index-luke.com/no-offset, 2024. -- Detailed SQL-level explanation of the drawbacks of OFFSET and the advantages of Keyset pagination.

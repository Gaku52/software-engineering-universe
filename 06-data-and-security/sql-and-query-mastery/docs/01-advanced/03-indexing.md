# Indexes — B-Tree, GiST, GIN, Partial Indexes, and Covering Indexes

> Understand the internal structure and design strategies for database indexes — including B-Tree, GiST, GIN, BRIN, partial indexes, and covering indexes — to optimize query performance. This chapter builds a systematic understanding of why indexes are fast at the implementation level, and develops the judgment needed to select and design the right index for any situation.

---

## What You Will Learn

1. **Internal structure of indexes** — How B-Tree works, page splits, search algorithms, and the theoretical basis for computational complexity
2. **Specialized indexes** — GiST (spatial search), GIN (full-text search, JSONB), BRIN (large-scale time-series data), Hash, and SP-GiST
3. **Index design strategies** — Partial indexes, covering indexes, and column order optimization for composite indexes
4. **Index maintenance and monitoring** — Detecting bloat, REINDEX, and identifying and removing unused indexes

---

## Prerequisites

| Topic | Content | Reference |
|---------|------|--------|
| SQL basics | Basic syntax for SELECT/WHERE/JOIN | [00-basics/](../00-basics/) |
| EXPLAIN | How to read a basic execution plan | [04-query-optimization.md](./04-query-optimization.md) |
| Table design | PRIMARY KEY, FOREIGN KEY, constraints | [01-schema-design.md](../02-design/01-schema-design.md) |
| Transactions | Basic concepts of locking | [02-transactions.md](./02-transactions.md) |

---

## 1. Internal Structure of B-Tree Indexes

### Why Are Indexes Fast?

When scanning all rows in a table sequentially (Sequential Scan), finding one row in a million-row table requires reading an average of 500,000 rows — O(N). With a B-Tree index, you can reach the target row with just 3–4 page reads — O(log N).

```
B-Tree structure (example with degree=3)
==============================

           [30 | 60]              <-- Root node (1 page = 8KB)
          /    |    \
   [10|20]  [40|50]  [70|80]     <-- Internal nodes
   / | \    / | \    / | \
  L  L  L  L  L  L  L  L  L     <-- Leaf nodes (pointers to actual data)

Search: WHERE id = 45
  1. Root: 30 < 45 < 60 --> go to middle child     (1st I/O)
  2. Internal: 40 < 45 < 50  --> go to middle child (2nd I/O)
  3. Leaf: get TID (page, offset) for id=45          (3rd I/O)
  4. Table: fetch heap tuple directly via TID         (4th I/O)

Complexity: O(log N)
  N = 1,000,000 rows → log_500(1,000,000) ≈ 2.2 → ~3 page reads
  N = 100,000,000 rows → log_500(100,000,000) ≈ 2.9 → ~3-4 page reads

  ※ The higher the degree (keys per page), the shallower the tree
  ※ An 8KB page can hold ~500 INTEGER (4 bytes) keys
  ※ Root and upper internal nodes stay in buffer cache, so actual I/O is minimal
```

### B-Tree Properties

```
┌─────────── Key Properties of B-Tree ───────────────────┐
│                                                          │
│  1. Balanced tree                                        │
│     All leaf nodes are at the same depth                 │
│     → O(log N) is guaranteed even in the worst case      │
│                                                          │
│  2. Sorted                                               │
│     Leaf nodes are connected in a doubly linked list     │
│     → Range searches (BETWEEN, <, >) are efficient       │
│     → ORDER BY can also be resolved via the index        │
│                                                          │
│  3. Page splits                                          │
│     When a node is full, a page split occurs             │
│     → Overhead on INSERT                                 │
│     → Monotonically increasing keys (SERIAL) only        │
│       split at the rightmost node                        │
│       → Lower split cost                                 │
│                                                          │
│  4. Supported operators                                  │
│     =, <, >, <=, >=, BETWEEN                             │
│     IN (value list)                                      │
│     LIKE 'abc%' (prefix match only)                      │
│     IS NULL / IS NOT NULL                                │
│     ORDER BY, GROUP BY                                   │
│     MIN(), MAX() (read directly from the ends of index)  │
└──────────────────────────────────────────────────────────┘
```

### Code Example 1: Creating Basic Indexes

```sql
-- Test tables
CREATE TABLE users (
    id         SERIAL PRIMARY KEY,
    email      VARCHAR(255) NOT NULL,
    username   VARCHAR(50) NOT NULL,
    status     VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    total       DECIMAL(10, 2) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- B-Tree index (default)
CREATE INDEX idx_users_email ON users (email);

-- Unique index (serves as both uniqueness constraint and index)
CREATE UNIQUE INDEX idx_users_email_unique ON users (email);

-- Composite index (column order matters — discussed later)
CREATE INDEX idx_orders_user_date ON orders (user_id, created_at DESC);

-- Descending index
CREATE INDEX idx_orders_recent ON orders (created_at DESC);

-- Expression index (index on the result of a function)
CREATE INDEX idx_users_email_lower ON users (LOWER(email));
-- → Used with: WHERE LOWER(email) = 'test@example.com'

-- Inspect indexes
SELECT
    indexname,
    indexdef,
    pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
FROM pg_indexes
WHERE tablename = 'orders';
```

### Code Example 2: Measuring Impact with EXPLAIN ANALYZE

```sql
-- Without index (Sequential Scan)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM orders WHERE user_id = 12345;
-- Seq Scan on orders  (cost=0.00..25000.00 rows=50 width=120)
--   actual time=45.2..180.5 rows=50 loops=1
--   Filter: (user_id = 12345)
--   Rows Removed by Filter: 999950
--   Buffers: shared hit=15000 read=10000
-- Planning Time: 0.1 ms
-- Execution Time: 180.6 ms

-- Create index
CREATE INDEX idx_orders_user_id ON orders (user_id);

-- With index (Index Scan)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM orders WHERE user_id = 12345;
-- Index Scan using idx_orders_user_id on orders
--   (cost=0.43..8.50 rows=50 width=120)
--   actual time=0.03..0.15 rows=50 loops=1
--   Index Cond: (user_id = 12345)
--   Buffers: shared hit=5
-- Planning Time: 0.2 ms
-- Execution Time: 0.2 ms

-- Comparison:
-- Sequential Scan: 180.6 ms, 25000 buffers
-- Index Scan:      0.2 ms,   5 buffers
-- → ~900x speedup, I/O reduced by ~5000x
```

---

## 2. Column Order in Composite Indexes

### Why Does Column Order Matter?

A composite index is like a phone book. If a phone book is sorted by "last name → first name," you can easily find everyone named "Tanaka," but to find everyone with the first name "Taro" regardless of last name, you'd need to scan every page.

```
How composite indexes work (Leftmost Prefix Rule)
========================================================

CREATE INDEX idx ON orders (user_id, status, created_at);

Internal sort order of the index (lexicographic):
  user_id=1, status='active',   created_at='2024-01-01'
  user_id=1, status='active',   created_at='2024-01-15'
  user_id=1, status='shipped',  created_at='2024-01-10'
  user_id=2, status='active',   created_at='2024-01-05'
  user_id=2, status='pending',  created_at='2024-01-20'

Usable query patterns:
  [OK] WHERE user_id = 1                         (leftmost 1 column)
  [OK] WHERE user_id = 1 AND status = 'active'   (leftmost 2 columns)
  [OK] WHERE user_id = 1 AND status = 'active'
       AND created_at > '2024-01-01'              (all 3 columns)
  [OK] WHERE user_id = 1 ORDER BY status          (prefix + sort)

  [NG] WHERE status = 'active'                    (skips leftmost)
  [NG] WHERE created_at > '2024-01-01'            (skips leftmost)
  [NG] WHERE user_id = 1 AND created_at > '...'   (skips status)
       → index is used up to user_id=1, created_at is applied as a Filter

Column order design principles:
  1. Equality conditions (=) first
  2. Range conditions (<, >, BETWEEN) last
  3. High-cardinality columns (many distinct values) first
  4. ORDER BY columns at the end

Example: WHERE user_id = ? AND status = ? AND created_at > ?
    → (user_id, status, created_at) is optimal
```

### Code Example 3: Measuring the Impact of Composite Index Column Order

```sql
-- Bad column order
CREATE INDEX idx_orders_bad ON orders (created_at, user_id, status);

-- Good column order (equality conditions first, range conditions last)
CREATE INDEX idx_orders_good ON orders (user_id, status, created_at);

-- Test query
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE user_id = 42
  AND status = 'shipped'
  AND created_at > '2024-01-01';

-- With idx_orders_bad:
-- Index Scan using idx_orders_bad on orders
--   Index Cond: (created_at > '2024-01-01')
--   Filter: (user_id = 42 AND status = 'shipped')
--   Rows Removed by Filter: 4500  ← many rows excluded by filter
--   → only created_at is used for narrowing

-- With idx_orders_good:
-- Index Scan using idx_orders_good on orders
--   Index Cond: (user_id = 42 AND status = 'shipped'
--                AND created_at > '2024-01-01')
--   Rows Removed by Filter: 0     ← all conditions handled by index
--   → all 3 columns used as Index Cond
```

---

## 3. Specialized Indexes

### Index Type Comparison

| Index Type | Supported Operators | Use Cases | Size | Build Speed |
|---|---|---|---|---|
| **B-Tree** | =, <, >, BETWEEN, LIKE 'abc%' | General purpose, range search, sorting | Medium | Fast |
| **Hash** | = only | Equality-only search (B-Tree is usually sufficient) | Small | Fast |
| **GiST** | Contains (&&), overlap, nearest neighbor (<->) | Geospatial, range types, exclusion constraints | Large | Slow |
| **GIN** | Contains (@>), array elements, full-text search (@@) | Full-text search, JSONB, arrays | Large | Slow |
| **BRIN** | =, <, >, BETWEEN | Time-series, large tables with physical ordering | Very small | Very fast |
| **SP-GiST** | Partitioned search | Phone numbers, IP addresses, quadtrees | Medium | Medium |

### Code Example 4: GIN Index (JSONB, Full-Text Search, Arrays)

```sql
-- ===== GIN index for JSONB search =====
CREATE TABLE products (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    price       DECIMAL(10, 2) NOT NULL,
    attributes  JSONB DEFAULT '{}'
);

-- Create GIN index
-- jsonb_ops: supports @>, ?, ?&, ?| (default)
CREATE INDEX idx_products_attrs ON products USING GIN (attributes);

-- jsonb_path_ops: only @>, but smaller and faster
CREATE INDEX idx_products_attrs_path ON products
    USING GIN (attributes jsonb_path_ops);

-- JSONB search (uses GIN index)
SELECT * FROM products
WHERE attributes @> '{"color": "red", "size": "L"}';

-- Check for key existence
SELECT * FROM products
WHERE attributes ? 'wireless';  -- does 'wireless' key exist?

-- Check for multiple keys
SELECT * FROM products
WHERE attributes ?& ARRAY['color', 'size'];  -- both keys must exist


-- ===== GIN index for full-text search =====
CREATE TABLE articles (
    id            SERIAL PRIMARY KEY,
    title         VARCHAR(500) NOT NULL,
    body          TEXT NOT NULL,
    search_vector tsvector  -- pre-computed column for full-text search
);

-- Trigger to update search_vector
CREATE OR REPLACE FUNCTION update_search_vector() RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.body, '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_articles_search
BEFORE INSERT OR UPDATE ON articles
FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- Create GIN index
CREATE INDEX idx_articles_search ON articles USING GIN (search_vector);

-- Full-text search query
SELECT title, ts_rank(search_vector, query) AS rank
FROM articles, to_tsquery('english', 'PostgreSQL & index') AS query
WHERE search_vector @@ query
ORDER BY rank DESC
LIMIT 10;


-- ===== GIN index for array search =====
CREATE TABLE posts (
    id    SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    tags  TEXT[] DEFAULT '{}'
);

CREATE INDEX idx_posts_tags ON posts USING GIN (tags);

-- Array containment search
SELECT * FROM posts WHERE tags @> ARRAY['rust', 'wasm'];
-- → posts where tags contains both 'rust' and 'wasm'

-- Array overlap search
SELECT * FROM posts WHERE tags && ARRAY['python', 'javascript'];
-- → posts where tags contains either 'python' or 'javascript'
```

### Code Example 5: GiST Index (Spatial Search, Range Types)

```sql
-- ===== PostGIS: spatial index =====
-- Install PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE stores (
    id        SERIAL PRIMARY KEY,
    name      VARCHAR(200) NOT NULL,
    location  GEOGRAPHY(POINT, 4326) NOT NULL  -- WGS84 coordinate system
);

-- Create GiST index
CREATE INDEX idx_stores_location ON stores USING GiST (location);

-- Search for stores within 5km radius
SELECT
    name,
    ST_Distance(
        location,
        ST_SetSRID(ST_MakePoint(139.7671, 35.6812), 4326)::geography
    ) AS distance_m
FROM stores
WHERE ST_DWithin(
    location,
    ST_SetSRID(ST_MakePoint(139.7671, 35.6812), 4326)::geography,
    5000  -- 5000m = 5km
)
ORDER BY distance_m;

-- k-nearest neighbor search (10 closest stores)
SELECT name, location <-> ST_SetSRID(ST_MakePoint(139.7671, 35.6812), 4326)::geography AS dist
FROM stores
ORDER BY location <-> ST_SetSRID(ST_MakePoint(139.7671, 35.6812), 4326)::geography
LIMIT 10;


-- ===== Range type overlap search (reservation management) =====
CREATE TABLE reservations (
    id        SERIAL PRIMARY KEY,
    room_id   INTEGER NOT NULL,
    guest     VARCHAR(100) NOT NULL,
    check_in  DATE NOT NULL,
    check_out DATE NOT NULL
);

-- GiST index for range types
CREATE INDEX idx_reservations_period ON reservations
    USING GiST (room_id, daterange(check_in, check_out));

-- Search for reservations that overlap with a given period
SELECT * FROM reservations
WHERE room_id = 101
  AND daterange(check_in, check_out) && daterange('2024-03-01', '2024-03-10');
-- → efficiently finds reservations overlapping March 1–10 using the index


-- ===== Exclusion constraint (prevent double-booking same room) =====
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- needed to use B-Tree operators in exclusion constraints

ALTER TABLE reservations ADD CONSTRAINT excl_room_period
    EXCLUDE USING GiST (
        room_id WITH =,
        daterange(check_in, check_out) WITH &&
    );
-- → automatically rejects INSERT/UPDATE with same room_id and overlapping period
```

### Code Example 6: BRIN Index (Large-Scale Time-Series Data)

```sql
-- BRIN indexes are optimal for data that is physically ordered
-- Example: log table where created_at increases in insertion order
CREATE TABLE access_logs (
    id         BIGSERIAL PRIMARY KEY,
    user_id    INTEGER,
    action     VARCHAR(50),
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create BRIN index
-- pages_per_range: how many pages per summary entry (default 128)
CREATE INDEX idx_logs_created_brin ON access_logs
    USING BRIN (created_at)
    WITH (pages_per_range = 32);

-- Size comparison (rough estimate for a 100 million row table):
-- B-Tree: ~2GB
-- BRIN:   ~200KB (about 1/10000 of B-Tree)

-- Query where BRIN is effective
SELECT COUNT(*) FROM access_logs
WHERE created_at BETWEEN '2024-01-01' AND '2024-01-31';
-- → BRIN scans only the relevant page blocks

-- Query where BRIN is NOT effective
SELECT * FROM access_logs WHERE user_id = 42;
-- → user_id has no correlation with physical order, so BRIN is useless here

-- How BRIN works internally
-- Stores min_val, max_val for every 128 pages
-- For WHERE created_at > '2024-06-01':
--   Block 0-127:   min=2024-01, max=2024-02 → skip
--   Block 128-255: min=2024-03, max=2024-04 → skip
--   Block 256-383: min=2024-05, max=2024-06 → scan (may contain matches)
--   Block 384-511: min=2024-07, max=2024-08 → scan
```

---

## 4. Partial Indexes and Covering Indexes

### Code Example 7: Partial Index

```sql
-- Partial index: an index with a WHERE clause
-- Creates an index only on a subset of rows in the table

-- Index only active users (10% of the table)
CREATE INDEX idx_users_active_email ON users (email)
WHERE status = 'active';
-- → about 1/10 the size of a full index
-- → about 1/10 the overhead on INSERT/UPDATE

-- Index only pending orders (5% of the table)
CREATE INDEX idx_orders_pending ON orders (created_at)
WHERE status = 'pending';
-- Used by this query:
SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at;

-- Index only non-NULL values (when 90% are NULL)
CREATE INDEX idx_users_phone ON users (phone)
WHERE phone IS NOT NULL;

-- Conditional uniqueness constraint (partial unique index)
-- Enforces email uniqueness only among active (non-deleted) users
CREATE UNIQUE INDEX idx_users_active_email_unique ON users (email)
WHERE deleted_at IS NULL;
-- → soft-deleted users can share the same email address

-- Verify the effect of partial indexing
SELECT
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
FROM pg_indexes
WHERE tablename = 'users';
-- idx_users_email:        120 MB  ← full index
-- idx_users_active_email:  12 MB  ← partial index (1/10)
```

### Code Example 8: Covering Index (INCLUDE)

```sql
-- Covering index: completely avoids table access
-- INCLUDE clause stores additional columns in the index (not used as search keys)

CREATE INDEX idx_orders_covering ON orders (user_id, status)
INCLUDE (total, created_at);

-- This query is answered by Index Only Scan (no table read required)
EXPLAIN ANALYZE
SELECT user_id, status, total, created_at
FROM orders
WHERE user_id = 12345 AND status = 'shipped';

-- Output:
-- Index Only Scan using idx_orders_covering on orders
--   (cost=0.43..5.50 rows=10 width=40)
--   actual time=0.02..0.05 rows=10 loops=1
--   Index Cond: (user_id = 12345 AND status = 'shipped')
--   Heap Fetches: 0  <-- no table access!

-- Difference between INCLUDE and key columns:
-- Key columns: usable in search conditions, sorted, stored in B-Tree nodes
-- INCLUDE columns: not usable as search conditions, stored only in leaf nodes
-- → INCLUDE results in a smaller index (no effect on internal nodes)

-- Equivalent approach without INCLUDE (not recommended)
CREATE INDEX idx_orders_covering_old ON orders (user_id, status, total, created_at);
-- → all columns are keys, making the index larger with higher update cost
```

### Code Example 9: Expression Index

```sql
-- Create an index on the result of a function
-- Case-insensitive email search
CREATE INDEX idx_users_email_lower ON users (LOWER(email));

-- The query must use the same expression
SELECT * FROM users WHERE LOWER(email) = 'test@example.com';
-- → Index Scan using idx_users_email_lower

-- NG: index is not used if the expression doesn't match
SELECT * FROM users WHERE email = 'test@example.com';
-- → Seq Scan (no LOWER())

-- Index on a specific JSONB key
CREATE INDEX idx_products_color ON products ((attributes->>'color'));
SELECT * FROM products WHERE attributes->>'color' = 'red';

-- Index on year-month portion of a date
CREATE INDEX idx_orders_yearmonth ON orders (DATE_TRUNC('month', created_at));
SELECT * FROM orders WHERE DATE_TRUNC('month', created_at) = '2024-06-01';

-- Index on first N characters of text (speeds up prefix searches)
CREATE INDEX idx_users_name_prefix ON users (LEFT(username, 3));
```

---

## 5. Index Maintenance and Monitoring

### How Index Bloat Occurs

```
How index bloat occurs
============================

After repeated DELETE/UPDATE:

Initial:   [1][2][3][4][5][6][7][8]  (page utilization 100%)
           ↓ DELETE 3,5,7
Mid:       [1][2][ ][4][ ][6][ ][8]  (page utilization 62.5%)
           ↓ new INSERTs don't fit in the gaps
Bloat:     many empty pages remain --> index size grows

            Page fill factor (fillfactor):
            Default is 90%. For tables with frequent UPDATEs,
            lowering to 70-80% increases the chance of
            HOT Updates (in-page updates), avoiding index updates.

Remedies:
  1. REINDEX: rebuild the index from scratch
  2. pg_repack: reorganize table/index online
  3. Adjust fillfactor: tune based on update frequency
```

### Code Example 10: Monitoring and Maintaining Indexes

```sql
-- ===== Check index sizes =====
SELECT
    schemaname || '.' || tablename AS table_name,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS total_scans,           -- how many times this index was used
    idx_tup_read AS tuples_read,       -- tuples read from the index
    idx_tup_fetch AS tuples_fetched    -- tuples fetched from the table
FROM pg_stat_user_indexes
JOIN pg_indexes USING (indexname)
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;


-- ===== Detect unused indexes =====
SELECT
    indexrelname AS index_name,
    relname AS table_name,
    idx_scan AS scans,
    pg_size_pretty(pg_relation_size(indexrelid)) AS size,
    pg_size_pretty(pg_total_relation_size(relid)) AS table_size
FROM pg_stat_user_indexes
JOIN pg_statio_user_indexes USING (indexrelid)
WHERE idx_scan = 0
  AND indexrelid NOT IN (
      SELECT indexrelid FROM pg_constraint
      WHERE contype IN ('p', 'u')  -- exclude PRIMARY KEY and UNIQUE constraints
  )
ORDER BY pg_relation_size(indexrelid) DESC;

-- Note: statistics are reset by pg_stat_reset()
-- On replicas, indexes are not used — check on the primary


-- ===== Detect duplicate indexes =====
-- Identify indexes built on the same set of columns
SELECT
    a.indexrelid::regclass AS index1,
    b.indexrelid::regclass AS index2,
    a.indrelid::regclass AS table_name
FROM pg_index a
JOIN pg_index b ON a.indrelid = b.indrelid
    AND a.indexrelid < b.indexrelid
    AND a.indkey::text = b.indkey::text;


-- ===== REINDEX (online rebuild, PostgreSQL 12+) =====
-- Standard REINDEX: locks table writes
REINDEX INDEX idx_orders_user_date;

-- CONCURRENTLY: rebuild without locking (recommended)
REINDEX INDEX CONCURRENTLY idx_orders_user_date;

-- Rebuild all indexes on a table
REINDEX TABLE CONCURRENTLY orders;


-- ===== Estimate index bloat =====
-- Uses the pgstattuple extension
CREATE EXTENSION IF NOT EXISTS pgstattuple;

SELECT
    indexrelid::regclass AS index_name,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    leaf_fragmentation
FROM pgstatindex('idx_orders_user_date');
-- Consider REINDEX if leaf_fragmentation > 30%
```

---

## 6. Index Pitfalls

### Code Example 11: Cases Where Indexes Are Not Used

```sql
-- ===== Case 1: applying a function to an indexed column =====
-- NG: an index exists on email, but it's wrapped in a function
SELECT * FROM users WHERE UPPER(email) = 'TEST@EXAMPLE.COM';
-- → Seq Scan (requires an expression index)

-- OK: create an expression index, or normalize values in the application
CREATE INDEX idx_users_email_upper ON users (UPPER(email));


-- ===== Case 2: implicit type casting =====
-- NG: user_id is INTEGER but searched with TEXT
SELECT * FROM orders WHERE user_id = '12345';
-- PostgreSQL handles implicit casting, but other DBs may not

-- NG: searching a VARCHAR column with an INTEGER
SELECT * FROM products WHERE sku = 12345;
-- → type mismatch may cause the index to be skipped


-- ===== Case 3: low selectivity (most rows match) =====
-- NG: if status='active' represents 90% of rows
SELECT * FROM users WHERE status = 'active';
-- → optimizer chooses Seq Scan (full scan is faster than going through the index)

-- OK: use a partial index targeting the minority case
CREATE INDEX idx_users_inactive ON users (email) WHERE status = 'inactive';


-- ===== Case 4: LIKE '%middle%' (infix or suffix match) =====
-- NG: B-Tree cannot handle non-prefix LIKE patterns
SELECT * FROM users WHERE username LIKE '%Tanaka%';
-- → Seq Scan

-- OK: trigram index via pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_users_name_trgm ON users USING GIN (username gin_trgm_ops);
SELECT * FROM users WHERE username LIKE '%Tanaka%';
-- → fast GIN Scan

-- OK: full-text search (tsvector + GIN)
-- → see Code Example 4 above


-- ===== Case 5: OR conditions =====
-- NG: OR conditions are less index-friendly
SELECT * FROM orders WHERE user_id = 42 OR status = 'pending';
-- → Bitmap OR (logical OR of bitmaps from each index)
-- → or Seq Scan

-- OK: rewrite as UNION ALL
SELECT * FROM orders WHERE user_id = 42
UNION ALL
SELECT * FROM orders WHERE status = 'pending' AND user_id != 42;


-- ===== Case 6: handling NULLs =====
-- B-Tree indexes support IS NULL and IS NOT NULL
SELECT * FROM users WHERE deleted_at IS NULL;
-- → Index Scan can be used (PostgreSQL 8.3+)

-- However, if most values are NULL, a partial index is more efficient
CREATE INDEX idx_users_deleted ON users (deleted_at)
WHERE deleted_at IS NOT NULL;
```

---

## Index Selection Flow Comparison

| Condition | Recommended Index | Reason |
|---|---|---|
| Equality/range search (general) | B-Tree | Most versatile, the default |
| JSONB search (@>) | GIN (jsonb_ops / jsonb_path_ops) | Supports @>, ?, ?& operators |
| Full-text search (@@) | GIN (tsvector) | Inverted index for tokens |
| Geospatial search | GiST (PostGIS) | Supports spatial containment and nearest-neighbor queries |
| Time-series data (physically sorted) | BRIN | Tiny size, efficient for ordered data |
| Equality-only, high frequency | Hash | Slightly faster than B-Tree (marginal difference) |
| Searching a few records in a large table | Partial index | Reduces size and maintenance cost |
| Read-only queries requiring no table access | Covering index (INCLUDE) | Enables Index Only Scan |
| Infix match (LIKE '%xxx%') | GIN (pg_trgm) | Substring search via trigrams |
| Detecting period overlaps | GiST (range type) | Supports && operator, also usable for exclusion constraints |

## B-Tree vs. Specialized Indexes — Performance Comparison

| Item | B-Tree | GIN | GiST | BRIN |
|------|--------|-----|------|------|
| Build speed | Fast | Slow (2–5x) | Slow (2–3x) | Very fast |
| Update cost | Medium | High (Pending List) | Medium | Very low |
| Disk size (100M rows) | ~2GB | ~3–5GB | ~2–4GB | ~200KB |
| Equality search | O(log N) | O(1)* | O(log N) | O(N/R)** |
| Range search | O(log N + M) | Not supported | O(log N + M) | O(N/R + M) |
| VACUUM impact | Medium | Large | Medium | Small |

*GIN uses hash-like lookup. **R = pages_per_range

---

## Anti-Patterns

### Anti-Pattern 1: Creating Indexes on Every Column

```sql
-- NG: creating indexes on all columns without thinking
CREATE INDEX idx_users_id ON users (id);           -- already exists as PK
CREATE INDEX idx_users_email ON users (email);      -- necessary
CREATE INDEX idx_users_username ON users (username); -- unnecessary if not searched
CREATE INDEX idx_users_status ON users (status);     -- low cardinality
CREATE INDEX idx_users_created ON users (created_at); -- unnecessary if not searched
CREATE INDEX idx_users_updated ON users (updated_at); -- unnecessary if not searched

-- Problems:
-- 1. Each INSERT updates 6 indexes → 30–50% write performance degradation
-- 2. Storage consumption grows to 2–3x the table size
-- 3. Increased VACUUM load
-- 4. In many cases, 50%+ of indexes are unused

-- OK: create indexes based on actual query patterns
-- Analyze frequently used queries via pg_stat_statements
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
-- → create only the indexes needed for WHERE clauses and JOIN conditions in top queries
```

### Anti-Pattern 2: Wrong Column Order in Composite Indexes

```sql
-- NG: range condition column first, equality condition column last
CREATE INDEX idx_orders_bad ON orders (created_at, user_id);

-- The user_id condition is not handled by the index for this query
SELECT * FROM orders
WHERE user_id = 42 AND created_at > '2024-01-01';
-- → Index Cond: (created_at > '2024-01-01')
-- → Filter: (user_id = 42)  ← applied outside the index

-- OK: equality condition first, range condition last
CREATE INDEX idx_orders_good ON orders (user_id, created_at);
-- → Index Cond: (user_id = 42 AND created_at > '2024-01-01')  ← all conditions within index
```

### Anti-Pattern 3: Creating Indexes Without CONCURRENTLY

```sql
-- NG: standard CREATE INDEX in production
CREATE INDEX idx_orders_email ON orders (email);
-- → writes to the table are locked (may take minutes or hours on large tables)

-- OK: use CONCURRENTLY
CREATE INDEX CONCURRENTLY idx_orders_email ON orders (email);
-- → builds without locking (~2x longer, but writes remain possible)
-- Note: cannot be used inside a transaction
-- Note: if build fails, an INVALID index remains
--       → remove with DROP INDEX CONCURRENTLY
```

---

## Practice Exercises

### Exercise 1 (Beginner): Choosing the Right Index

Design the optimal indexes for the following table and queries.

```sql
CREATE TABLE events (
    id          BIGSERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL,
    event_type  VARCHAR(50) NOT NULL,
    payload     JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Query 1: recent events for a specific user
SELECT * FROM events
WHERE user_id = 42
ORDER BY created_at DESC
LIMIT 20;

-- Query 2: events of a specific type with a JSONB filter
SELECT * FROM events
WHERE event_type = 'purchase'
  AND payload @> '{"amount_gte": 10000}';

-- Query 3: aggregation over a date range
SELECT event_type, COUNT(*)
FROM events
WHERE created_at BETWEEN '2024-01-01' AND '2024-01-31'
GROUP BY event_type;
```

<details>
<summary>Model Answer</summary>

```sql
-- For Query 1: composite index (equality → sort order)
CREATE INDEX idx_events_user_recent ON events (user_id, created_at DESC);
-- → Index Scan (Backward) efficiently handles LIMIT 20
-- → ORDER BY + LIMIT resolved entirely within the index

-- For Query 2: composite B-Tree + GIN index
-- Option A: separate B-Tree for event_type + GIN for payload
CREATE INDEX idx_events_type ON events (event_type);
CREATE INDEX idx_events_payload ON events USING GIN (payload);
-- → Bitmap AND combines both indexes

-- Option B: partial index (best when event_type has limited values)
CREATE INDEX idx_events_purchase_payload ON events USING GIN (payload)
WHERE event_type = 'purchase';
-- → GIN index only on 'purchase' events (minimal size)

-- For Query 3: BRIN index (optimal for time-series data)
CREATE INDEX idx_events_created_brin ON events USING BRIN (created_at)
WITH (pages_per_range = 32);
-- → handles date range filtering with a tiny index
-- → GROUP BY event_type is handled by Seq Scan + Hash Aggregate
-- Note: for large result sets, BRIN is often more efficient than B-Tree
--       (avoids random I/O)
```

**Explanation**: The key is choosing the right index type for each query pattern. Query 1 benefits from a composite B-Tree, Query 2 from a GIN (partial index is best), and Query 3 from a BRIN. Trying to serve all queries with a single index leads to mediocre results for each.

</details>

### Exercise 2 (Intermediate): Measuring and Improving Index Performance

Analyze the following slow query, design appropriate indexes, and verify the effect with EXPLAIN ANALYZE.

```sql
-- Slow query (table with 1 million rows)
EXPLAIN ANALYZE
SELECT o.id, o.total, u.email, u.username
FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.status = 'shipped'
  AND o.created_at > '2024-06-01'
  AND u.status = 'active'
ORDER BY o.created_at DESC
LIMIT 50;

-- Current execution plan:
-- Limit  (cost=50000.00..50000.12 rows=50 width=100)
--   ->  Sort  (cost=50000.00..50100.00 rows=10000 width=100)
--         Sort Key: o.created_at DESC
--         ->  Hash Join  (cost=1000.00..49000.00 rows=10000 width=100)
--               ->  Seq Scan on orders o  (Filter: status='shipped' AND created_at > ...)
--               ->  Hash
--                     ->  Seq Scan on users u  (Filter: status='active')
```

<details>
<summary>Model Answer</summary>

```sql
-- Step 1: optimize the orders table
-- Partial index + covering + sort order
CREATE INDEX idx_orders_shipped_recent ON orders (created_at DESC)
INCLUDE (user_id, total)
WHERE status = 'shipped';
-- → only indexes rows where status='shipped'
-- → pre-sorted by created_at DESC → ORDER BY + LIMIT is fast
-- → INCLUDE (user_id, total) keeps needed columns in the index

-- Step 2: optimize the users table
-- Partial index for active users
CREATE INDEX idx_users_active ON users (id)
INCLUDE (email, username)
WHERE status = 'active';
-- → Index Only Scan on JOIN condition (id)
-- → email, username also fetched from the index

-- Improved execution plan:
-- Limit  (cost=0.86..100.00 rows=50 width=100)
--   ->  Nested Loop  (cost=0.86..2000.00 rows=50 width=100)
--         ->  Index Only Scan using idx_orders_shipped_recent on orders o
--               (actual time=0.02..0.30 rows=50)
--               Heap Fetches: 0
--         ->  Index Only Scan using idx_users_active on users u
--               Index Cond: (id = o.user_id)
--               Heap Fetches: 0

-- Result: Seq Scan × 2 → Index Only Scan × 2
--         50000ms → 0.5ms (~100,000x speedup)
```

**Explanation**: The three most impactful improvements are:
1. **Partial index**: shipped orders are ~20% of the total, so the index is 1/5 the size
2. **Covering index (INCLUDE)**: completely avoids table access (Heap Fetches: 0)
3. **Matching sort order**: creating the index with created_at DESC means ORDER BY + LIMIT is processed in index scan order

</details>

### Exercise 3 (Advanced): Automating Index Maintenance

Create a set of monitoring queries that satisfy the following requirements.

**Requirements**:
1. List unused indexes (excluding PRIMARY KEY/UNIQUE)
2. Detect duplicate indexes
3. Estimate index bloat ratio
4. Ratio of index size to table size
5. Output a report with improvement recommendations

<details>
<summary>Model Answer</summary>

```sql
-- ===== Index maintenance report =====

-- 1. Detect unused indexes
WITH unused_indexes AS (
    SELECT
        s.indexrelname AS index_name,
        s.relname AS table_name,
        s.idx_scan AS scans,
        pg_size_pretty(pg_relation_size(s.indexrelid)) AS index_size,
        pg_relation_size(s.indexrelid) AS index_size_bytes
    FROM pg_stat_user_indexes s
    WHERE s.idx_scan = 0
      AND s.indexrelid NOT IN (
          SELECT indexrelid FROM pg_constraint
          WHERE contype IN ('p', 'u')
      )
)
SELECT 'Unused index' AS category, index_name, table_name,
       index_size, scans
FROM unused_indexes
ORDER BY index_size_bytes DESC;

-- 2. Detect duplicate indexes
WITH index_cols AS (
    SELECT
        i.indexrelid,
        i.indrelid,
        i.indexrelid::regclass AS index_name,
        i.indrelid::regclass AS table_name,
        array_agg(a.attname ORDER BY k.ord) AS columns
    FROM pg_index i
    CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
    GROUP BY i.indexrelid, i.indrelid
)
SELECT
    'Duplicate index' AS category,
    a.index_name AS index1,
    b.index_name AS index2,
    a.table_name,
    a.columns
FROM index_cols a
JOIN index_cols b ON a.indrelid = b.indrelid
    AND a.indexrelid < b.indexrelid
    AND a.columns = b.columns;

-- 3. Index size ratio relative to table size
SELECT
    'Size ratio' AS category,
    relname AS table_name,
    pg_size_pretty(pg_relation_size(relid)) AS table_size,
    pg_size_pretty(pg_indexes_size(relid)) AS total_index_size,
    CASE
        WHEN pg_relation_size(relid) > 0 THEN
            ROUND(100.0 * pg_indexes_size(relid) / pg_relation_size(relid), 1)
        ELSE 0
    END AS index_ratio_pct,
    (SELECT COUNT(*) FROM pg_index WHERE indrelid = relid) AS num_indexes
FROM pg_stat_user_tables
WHERE pg_relation_size(relid) > 1024 * 1024  -- tables larger than 1MB
ORDER BY pg_indexes_size(relid) DESC
LIMIT 20;

-- 4. Improvement recommendation summary
SELECT
    CASE
        WHEN idx_scan = 0 AND indexrelid NOT IN
            (SELECT indexrelid FROM pg_constraint WHERE contype IN ('p','u'))
        THEN 'DROP INDEX (unused)'
        WHEN pg_relation_size(indexrelid) > pg_relation_size(relid) * 0.5
        THEN 'REINDEX (oversized)'
        ELSE 'OK'
    END AS recommendation,
    indexrelname AS index_name,
    relname AS table_name,
    idx_scan AS total_scans,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE pg_relation_size(indexrelid) > 1024 * 1024
ORDER BY
    CASE WHEN idx_scan = 0 THEN 0 ELSE 1 END,
    pg_relation_size(indexrelid) DESC;
```

**Explanation**: Index maintenance should be performed regularly. The most important tasks are:
1. **Removing unused indexes**: improves write performance and saves storage
2. **Consolidating duplicate indexes**: if both (a, b) and (a, b, c) exist, the former is redundant
3. **Monitoring bloat**: consider REINDEX CONCURRENTLY when bloat exceeds 30%
4. **Index-to-table size ratio**: revisit index structure if it exceeds 200%

</details>


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured settings file | Check the path and format of the settings file |
| Timeout | Network latency / resource shortage | Adjust timeout values, add retry logic |
| Out of memory | Increase in data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access privileges | Check execution user permissions and configuration |
| Data inconsistency | Concurrent processing conflicts | Introduce locking, manage transactions |

### Debugging Steps

1. **Read the error message**: Read the stack trace and identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Verify step by step**: Use logging and debuggers to validate hypotheses
5. **Fix and regression test**: After fixing, run tests for related areas as well

```python
# Debugging utility
import logging
import traceback
from functools import wraps

# Configure logger
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

def debug_decorator(func):
    """Decorator that logs function inputs and outputs"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"呼び出し: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"戻り値: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"例外発生: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """Data processing (debug target)"""
    if not items:
        raise ValueError("空のデータ")
    return [item * 2 for item in items]
```

### Diagnosing Performance Problems

Steps for diagnosing performance issues:

1. **Identify the bottleneck**: measure with profiling tools
2. **Check memory usage**: look for memory leaks
3. **Check for I/O wait**: examine disk and network I/O status
4. **Check concurrent connections**: review connection pool status

| Problem Type | Diagnostic Tool | Remedy |
|-----------|-----------|------|
| High CPU | cProfile, py-spy | Algorithm improvements, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes judgment criteria for technology selection.

| Criterion | Prioritize when | Can compromise when |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin screens, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, speed to market | Quality-critical, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow            │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① Team size?                                   │
│    ├─ Small (1-5) → Monolith                    │
│    └─ Large (10+) → go to ②                     │
│                                                 │
│  ② Deployment frequency?                        │
│    ├─ Weekly or less → Monolith + modules        │
│    └─ Daily / multiple times → go to ③          │
│                                                 │
│  ③ Team independence?                           │
│    ├─ High → Microservices                       │
│    └─ Medium → Modular monolith                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Every technical decision involves trade-offs. Analyze from the following perspectives:

**1. Short-term vs. long-term costs**
- A fast short-term approach can become technical debt in the long run
- Conversely, over-engineering raises short-term costs and can delay the project

**2. Consistency vs. flexibility**
- A unified tech stack has lower learning costs
- Using diverse technologies enables the right tool for each job, but increases operational costs

**3. Level of abstraction**
- High abstraction improves reusability but can make debugging harder
- Low abstraction is intuitive but prone to code duplication

```python
# Design decision record template
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe background and problem"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision"""
        self.decision = decision
        return self

    def add_consequence(self, consequence: str, positive: bool = True):
        """Add a consequence"""
        self.consequences.append({
            'description': consequence,
            'type': 'positive' if positive else 'negative'
        })
        return self

    def add_alternative(self, name: str, reason_rejected: str):
        """Add a rejected alternative"""
        self.alternatives.append({
            'name': name,
            'reason_rejected': reason_rejected
        })
        return self

    def to_markdown(self) -> str:
        """Output in Markdown format"""
        md = f"# ADR: {self.title}\n\n"
        md += f"## 背景\n{self.context}\n\n"
        md += f"## 決定\n{self.decision}\n\n"
        md += "## 結果\n"
        for c in self.consequences:
            icon = "✅" if c['type'] == 'positive' else "⚠️"
            md += f"- {icon} {c['description']}\n"
        md += "\n## 却下した代替案\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```

---

## Real-World Application Scenarios

### Scenario 1: MVP Development at a Startup

**Situation:** You need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on the minimum viable feature set
- Automated tests only for the critical path
- Introduce monitoring early

**Lessons learned:**
- Don't over-engineer (YAGNI principle)
- Gather user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Incrementally renewing a system that has been in operation for more than 10 years

**Approach:**
- Use the Strangler Fig pattern for incremental migration
- If existing tests are absent, write Characterization Tests first
- Use an API gateway to run old and new systems in parallel
- Migrate data incrementally

| Phase | Work | Estimated Duration | Risk |
|---------|---------|---------|--------|
| 1. Assessment | Current state analysis, dependency mapping | 2–4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4–6 weeks | Low |
| 3. Start migration | Migrate peripheral features first | 3–6 months | Medium |
| 4. Core migration | Migrate core functionality | 6–12 months | High |
| 5. Completion | Decommission legacy system | 2–4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** More than 50 engineers working on the same product

**Approach:**
- Use Domain-Driven Design to clearly define boundaries
- Assign ownership per team
- Manage shared libraries via Inner Source
- Design API-first to minimize inter-team dependencies

```python
# API contract definition between teams
from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

class Priority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class APIContract:
    """API contract between teams"""
    endpoint: str
    method: str
    owner_team: str
    consumers: List[str]
    sla_ms: int  # response time SLA
    priority: Priority

    def validate_sla(self, actual_ms: int) -> bool:
        """Check SLA compliance"""
        return actual_ms <= self.sla_ms

    def to_openapi(self) -> dict:
        """Output in OpenAPI format"""
        return {
            'path': self.endpoint,
            'method': self.method,
            'x-owner': self.owner_team,
            'x-consumers': self.consumers,
            'x-sla-ms': self.sla_ms
        }

# Usage example
contracts = [
    APIContract(
        endpoint="/api/v1/users",
        method="GET",
        owner_team="user-team",
        consumers=["order-team", "notification-team"],
        sla_ms=200,
        priority=Priority.HIGH
    ),
    APIContract(
        endpoint="/api/v1/orders",
        method="POST",
        owner_team="order-team",
        consumers=["payment-team", "inventory-team"],
        sla_ms=500,
        priority=Priority.CRITICAL
    )
]
```

### Scenario 4: Performance-Critical Systems

**Situation:** A system requiring millisecond-level response times

**Optimization points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging async processing
3. Connection pooling
4. Query optimization and index design

| Optimization Technique | Effect | Implementation Cost | Applicable Situation |
|-----------|------|-----------|---------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy operations |
| DB optimization | High | High | Slow queries |
| Code optimization | Low–Medium | High | CPU-bound cases |

---

## Team Development

### Code Review Checklist

Key points to check in code reviews related to this topic:

- [ ] Are naming conventions consistent?
- [ ] Is error handling appropriate?
- [ ] Is test coverage sufficient?
- [ ] Are there any performance impacts?
- [ ] Are there any security concerns?
- [ ] Has documentation been updated?

### Best Practices for Knowledge Sharing

| Method | Frequency | Target | Effect |
|------|------|------|------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talks | Weekly | Entire team | Horizontal knowledge transfer |
| ADR (design records) | As needed | Future members | Transparency of decisions |
| Retrospectives | Every 2 weeks | Entire team | Continuous improvement |
| Mob programming | Monthly | Key design decisions | Building consensus |

### Managing Technical Debt

```
Priority Matrix:

        High impact
          │
    ┌─────┼─────┐
    │Plan │Act  │
    │ed   │imme-│
    │resp-│diat-│
    │onse │ely  │
    ├─────┼─────┤
    │Log  │Next │
    │only │Spri-│
    │     │nt   │
    └─────┼─────┘
          │
        Low impact
    Low frequency  High frequency
```
---

## FAQ

### Q1: How much does adding an index slow down writes?

Each B-Tree index slows down INSERT by approximately 10–20%. However, the impact depends on the index and table size. GIN indexes use a Pending List for deferred updates, so the impact on INSERT is smaller than B-Tree — but regular cleanup (`gin_pending_list_limit`) is required. The decision should be based on whether the read speedup outweighs the write degradation.

### Q2: When should I use a BRIN index?

BRIN is optimal when there is a correlation between the physical row order of the table and the values of the indexed column. The classic example is time-series data where the `created_at` column increases in insertion order. You can achieve equivalent range search performance at less than 1/10000 the size of a B-Tree. However, it is not suitable for equality searches (`WHERE id = 42`). BRIN is effective when the `correlation` coefficient is 0.9 or higher.

```sql
-- Check the correlation coefficient
SELECT attname, correlation
FROM pg_stats
WHERE tablename = 'access_logs' AND attname = 'created_at';
-- BRIN is effective if correlation > 0.9
```

### Q3: Should I always use CREATE INDEX CONCURRENTLY?

It is recommended in production environments. Standard `CREATE INDEX` locks writes to the table, but `CONCURRENTLY` builds the index without locking. However, be aware of the following caveats:
- Build time is approximately 2x longer
- Cannot be used inside a transaction
- If the build fails midway, an `INVALID` index remains (requires manual removal)
- Requires two table scans, so build time can be long under heavy concurrent writes

### Q4: What is HOT Update (Heap-Only Tuple Update)?

HOT Update is an optimization that completely skips index updates when the updated row does not affect any index. The conditions are:
1. The updated column is not included in any index
2. The new tuple fits in the same page as the original tuple

Lowering `fillfactor` (default 100 → 70–80) creates free space in pages, increasing the chance of HOT Updates. This is effective for tables with high UPDATE frequency.

```sql
-- Check the HOT Update rate
SELECT relname, n_tup_upd, n_tup_hot_upd,
       ROUND(100.0 * n_tup_hot_upd / NULLIF(n_tup_upd, 0), 1) AS hot_pct
FROM pg_stat_user_tables
WHERE n_tup_upd > 0
ORDER BY n_tup_upd DESC;
-- If hot_pct is low, consider adjusting fillfactor
```

### Q5: Which is better — a multi-column index or multiple single-column indexes?

**Multi-column index** is advantageous when:
- You always search on the same combination of columns (`WHERE a = ? AND b = ?`)
- The sort order matches the search condition (`WHERE a = ? ORDER BY b`)
- You want to achieve Index Only Scan

**Multiple single-column indexes** are advantageous when:
- The combination of columns varies (`WHERE a = ?` sometimes, `WHERE b = ?` other times)
- PostgreSQL can combine them via Bitmap AND/OR

---

## Summary

| Item | Key Points |
|---|---|
| B-Tree | General-purpose index. Equality, range search, sorting. O(log N) |
| GIN | Full-text search, JSONB, array search. Inverted index |
| GiST | Spatial search, range type overlap detection, exclusion constraints |
| BRIN | Range search on physically sorted data. Tiny size (1/10000 of B-Tree) |
| Partial index | With WHERE clause. Indexes only part of the table — reduces size and maintenance cost |
| Covering | INCLUDE enables Index Only Scan. No table access required |
| Composite index | Column order matters. Equality conditions first, range conditions last, sort keys at the end |
| Expression index | Index on function results. The same expression must be used in queries |
| Maintenance | Regularly detect and remove unused indexes. REINDEX CONCURRENTLY |

---

## Recommended Next Reading

- [04-query-optimization.md](./04-query-optimization.md) — Reading EXPLAIN output and rewriting queries
- [02-transactions.md](./02-transactions.md) — Relationship between FOR UPDATE and index locks
- [02-migration.md](../02-design/02-migration.md) — Zero-downtime index addition techniques (CONCURRENTLY)
- [02-performance-tuning.md](../03-practical/02-performance-tuning.md) — Comprehensive performance tuning
- [04-nosql-comparison.md](../03-practical/04-nosql-comparison.md) — Data models that don't require indexes

---

## References

1. **PostgreSQL Official Documentation**: [Indexes](https://www.postgresql.org/docs/current/indexes.html) — Index types and detailed specifications
2. **Markus Winand**: [Use The Index, Luke](https://use-the-index-luke.com/) — Comprehensive guide to SQL indexes (highly recommended)
3. **Cybertec**: [PostgreSQL Index Types](https://www.cybertec-postgresql.com/en/postgresql-indexes-overview/) — PostgreSQL-specific index explanations
4. **PostgreSQL Wiki**: [Index Maintenance](https://wiki.postgresql.org/wiki/Index_Maintenance) — Best practices for index maintenance
5. **Citus Data Blog**: [PostgreSQL Index Tips](https://www.citusdata.com/blog/) — Practical index optimization case studies

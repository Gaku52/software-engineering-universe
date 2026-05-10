# PostgreSQL-Specific Features — JSONB, Array Types, Range Types, Full-Text Search, and Extensions

> PostgreSQL positions itself as "the world's most advanced open-source RDBMS," offering rich features not found in other databases: JSONB, array types, range types, full-text search, and extensions. Mastering these features enables you to build robust data foundations that combine NoSQL flexibility with RDBMS transactional consistency. This chapter covers these PostgreSQL-specific features comprehensively, from the internals of their implementation to a deep understanding of the "why" behind each.

---

## What You Will Learn

1. **JSONB Internal Structure and Operations** — Understand the binary storage format, operator system, GIN index internals, and jsonpath queries; learn when to use JSONB versus relational columns
2. **Practical Use of Array, Range, and Composite Types** — Use PostgreSQL-specific collection types to manage tags without join tables and detect date range overlaps
3. **Full-Text Search and Trigram Search** — Implement built-in full-text search using tsvector/tsquery with Japanese language support, and fuzzy search via pg_trgm
4. **Feature Extension via Extensions** — Evaluate and adopt major extensions such as uuid-ossp, pgcrypto, PostGIS, and pg_stat_statements
5. **GENERATED COLUMNS, LISTEN/NOTIFY, and Table Inheritance** — Apply computed columns, real-time notifications, and inheritance-based classification in the right situations

---

## Prerequisites

Understanding this chapter requires the following knowledge.

- [SQL Basics](../00-basics/00-sql-overview.md) — Fundamental SELECT/INSERT/UPDATE/DELETE operations
- [Understanding JOINs](../00-basics/02-joins.md) — Table join concepts
- [Index Fundamentals](../01-advanced/03-indexing.md) — How B-Tree indexes work
- [Normalization Basics](../02-design/00-normalization.md) — Core principles of the relational model

---

## 1. JSONB — An Overview of Binary JSON

### 1.1 Why JSONB Is Needed

Relational databases excel at enforcing strict schemas (table definitions), but real-world applications often need to store data whose schema is not known in advance. Examples include:

- Product attributes for an e-commerce site (clothing has size and color; PCs have CPU, RAM, and SSD)
- User preference values (settings vary per user)
- Responses from external APIs (schemas change frequently)
- Event metadata (the information included differs by event type)

Traditionally, developers handled this with EAV (Entity-Attribute-Value) patterns or serialized text, both of which offer poor search performance and no type safety. PostgreSQL's JSONB type provides a solution that combines relational robustness with document flexibility.

### 1.2 JSONB Internal Structure

```
┌──────────────── JSONB Internal Structure ──────────────────────┐
│                                                                 │
│  Input: {"name": "Tanaka", "age": 30, "tags": ["A","B"]}       │
│                                                                 │
│  ┌──── JSON type (text storage) ─────┐                         │
│  │ Saved as-is as a string           │                         │
│  │ Parsed on every read              │                         │
│  │ Duplicate keys kept, order kept   │                         │
│  └───────────────────────────────────┘                         │
│                                                                 │
│  ┌──── JSONB type (binary storage) ──┐                         │
│  │ Saved as parsed binary            │                         │
│  │ Header + entry array              │                         │
│  │  ┌─ JEntry ─────────────┐         │                         │
│  │  │ type: object          │         │                         │
│  │  │ num_pairs: 3          │         │                         │
│  │  │ pairs[0]:             │         │                         │
│  │  │   key_offset → "age"  │         │                         │
│  │  │   val_offset → 30     │         │                         │
│  │  │ pairs[1]:             │         │                         │
│  │  │   key_offset → "name" │         │                         │
│  │  │   val_offset → "Tanaka"│        │                         │
│  │  │ pairs[2]:             │         │                         │
│  │  │   key_offset → "tags" │         │                         │
│  │  │   val_offset → [...]  │         │                         │
│  │  └───────────────────────┘         │                         │
│  │ * Keys are sorted                  │                         │
│  │ * Duplicate keys: only last value  │                         │
│  │ * Binary search for fast access    │                         │
│  └───────────────────────────────────┘                         │
│                                                                 │
│  WHY binary?                                                    │
│  → No parsing needed on read (O(1) key access)                 │
│  → GIN indexes can be built                                     │
│  → Fast containment search and key existence checks            │
└─────────────────────────────────────────────────────────────────┘
```

### Code Example 1: JSONB Basic Operations — CRUD

```sql
-- Create table: product table with metadata stored as JSONB
CREATE TABLE products (
    id       SERIAL PRIMARY KEY,
    name     VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price    DECIMAL(10, 2) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- Insert data: store different attributes per product in JSONB
INSERT INTO products (name, category, price, metadata) VALUES
('ThinkPad X1 Carbon', 'laptop', 198000, '{
    "brand": "Lenovo",
    "specs": {"cpu": "i7-1365U", "ram_gb": 16, "ssd_gb": 512},
    "tags": ["business", "lightweight", "14inch"],
    "weight_kg": 1.12,
    "ports": {"usb_c": 2, "usb_a": 2, "hdmi": 1}
}'),
('iPhone 15 Pro', 'smartphone', 159800, '{
    "brand": "Apple",
    "specs": {"chip": "A17 Pro", "ram_gb": 8, "storage_gb": 256},
    "tags": ["premium", "camera", "titanium"],
    "weight_g": 187,
    "colors": ["natural", "blue", "white", "black"]
}'),
('Pixel 8', 'smartphone', 82500, '{
    "brand": "Google",
    "specs": {"chip": "Tensor G3", "ram_gb": 8, "storage_gb": 128},
    "tags": ["ai", "camera", "affordable"],
    "weight_g": 187
}');

-- ===== Field Access Operators =====

-- -> : Returns a JSONB object (used for nested references)
-- ->> : Returns TEXT (used for retrieving final values)
SELECT
    name,
    metadata->>'brand' AS brand,                    -- Retrieve as TEXT
    metadata->'specs'->>'cpu' AS cpu,                -- Reference nested keys
    (metadata->'specs'->>'ram_gb')::INTEGER AS ram,  -- Type cast
    metadata->'tags'->0 AS first_tag,               -- First element of array (JSONB type)
    metadata->'tags'->>0 AS first_tag_text,         -- First element of array (TEXT type)
    metadata#>>'{specs,ram_gb}' AS ram_by_path       -- Retrieve using path syntax
FROM products;

-- ===== JSONB Search Operators =====

-- @> : Containment (does the left side contain the right side?)
SELECT * FROM products
WHERE metadata @> '{"brand": "Apple"}';

-- ? : Check key existence
SELECT * FROM products
WHERE metadata ? 'colors';

-- ?& : Check if all keys exist
SELECT * FROM products
WHERE metadata ?& ARRAY['brand', 'specs', 'weight_g'];

-- ?| : Check if any key exists
SELECT * FROM products
WHERE metadata ?| ARRAY['weight_kg', 'weight_g'];

-- ===== Updating JSONB =====

-- || : Merge (existing keys are overwritten, new keys are added)
UPDATE products
SET metadata = metadata || '{"warranty_years": 2, "in_stock": true}'
WHERE id = 1;

-- jsonb_set : Update value at a specific path
UPDATE products
SET metadata = jsonb_set(metadata, '{specs,ram_gb}', '32')
WHERE id = 1;

-- jsonb_set 4th argument create_if_missing (default true)
UPDATE products
SET metadata = jsonb_set(metadata, '{specs,gpu}', '"RTX 4060"', true)
WHERE id = 1;

-- - : Delete a key
UPDATE products
SET metadata = metadata - 'warranty_years'
WHERE id = 1;

-- #- : Delete a nested key (by path)
UPDATE products
SET metadata = metadata #- '{specs,gpu}'
WHERE id = 1;

-- ===== JSONB Aggregation =====

-- Product count and average price by brand
SELECT
    metadata->>'brand' AS brand,
    COUNT(*) AS product_count,
    AVG(price) AS avg_price
FROM products
GROUP BY metadata->>'brand'
ORDER BY avg_price DESC;
```

### Code Example 2: JSONB Indexes and Advanced Search

```sql
-- ===== Two Options for GIN Indexes =====

-- 1. Default GIN: supports all operators — @>, ?, ?|, ?&
CREATE INDEX idx_products_metadata
ON products USING GIN (metadata);

-- 2. jsonb_path_ops GIN: specialized for @> operator (faster, less memory)
-- Stores hash values per path, making containment searches faster
CREATE INDEX idx_products_metadata_path
ON products USING GIN (metadata jsonb_path_ops);

-- WHY two options?
-- Default GIN: key existence checks (? operator) also use the index
-- jsonb_path_ops: specialized for @> containment, index size 20-30% smaller
-- → Choose based on the operators used in your application

-- 3. Expression index: B-Tree for a specific field (optimal for equality/range searches)
CREATE INDEX idx_products_brand
ON products ((metadata->>'brand'));

-- Composite index: speed up searches by brand + price range
CREATE INDEX idx_products_brand_price
ON products ((metadata->>'brand'), price);

-- ===== jsonpath Queries (SQL:2016 standard, PostgreSQL 12+) =====

-- @@ : Search using a jsonpath condition expression
SELECT * FROM products
WHERE metadata @@ '$.specs.ram_gb > 8';

-- jsonb_path_query: return all values matching a path
SELECT name, jsonb_path_query(metadata, '$.tags[*]') AS tag
FROM products;

-- jsonb_path_query_array: return results as an array
SELECT name, jsonb_path_query_array(metadata, '$.tags[*]') AS all_tags
FROM products;

-- jsonb_path_exists: check whether a path exists
SELECT name FROM products
WHERE jsonb_path_exists(metadata, '$.specs.cpu');

-- jsonpath with filter
SELECT name,
       jsonb_path_query(metadata, '$.tags[*] ? (@ like_regex "^cam")')
       AS camera_tag
FROM products;

-- ===== JSONB Functions =====

-- jsonb_each: expand into key-value pairs
SELECT p.name, kv.key, kv.value
FROM products p,
     jsonb_each(p.metadata->'specs') AS kv(key, value)
WHERE p.id = 1;

-- jsonb_object_keys: retrieve list of keys
SELECT DISTINCT jsonb_object_keys(metadata) AS top_level_key
FROM products
ORDER BY top_level_key;

-- jsonb_array_elements: expand each element of an array
SELECT p.name, tag.value AS tag
FROM products p,
     jsonb_array_elements_text(p.metadata->'tags') AS tag(value);

-- jsonb_strip_nulls: remove keys with null values
SELECT jsonb_strip_nulls('{"a": 1, "b": null, "c": 3}'::JSONB);
-- → {"a": 1, "c": 3}

-- jsonb_typeof: determine the type of a value
SELECT jsonb_typeof(metadata->'specs') AS specs_type,
       jsonb_typeof(metadata->'tags') AS tags_type,
       jsonb_typeof(metadata->'weight_kg') AS weight_type
FROM products WHERE id = 1;
-- → object, array, number

-- jsonb_build_object / jsonb_build_array: dynamically construct JSONB
SELECT jsonb_build_object(
    'product_name', name,
    'brand', metadata->>'brand',
    'price', price
) AS summary
FROM products;
```

### Code Example 3: JSONB Validation and CHECK Constraints

```sql
-- JSON Schema validation in PostgreSQL 17+ (future support)
-- Currently, use CHECK constraints and the IS JSON predicate as a substitute

-- IS JSON predicate (PostgreSQL 16+)
ALTER TABLE products
ADD CONSTRAINT check_metadata_is_object
CHECK (metadata IS JSON OBJECT);

-- CHECK constraint to validate JSONB structure
ALTER TABLE products
ADD CONSTRAINT check_metadata_has_brand
CHECK (metadata ? 'brand');

-- CHECK constraint to validate JSONB values
ALTER TABLE products
ADD CONSTRAINT check_metadata_brand_not_empty
CHECK (length(metadata->>'brand') > 0);

-- Advanced validation via trigger
CREATE OR REPLACE FUNCTION validate_product_metadata()
RETURNS TRIGGER AS $$
BEGIN
    -- brand field is required
    IF NOT (NEW.metadata ? 'brand') THEN
        RAISE EXCEPTION 'metadata must contain "brand" key';
    END IF;

    -- specs field, if present, must be an object
    IF NEW.metadata ? 'specs'
       AND jsonb_typeof(NEW.metadata->'specs') != 'object' THEN
        RAISE EXCEPTION 'metadata.specs must be an object';
    END IF;

    -- tags field, if present, must be an array
    IF NEW.metadata ? 'tags'
       AND jsonb_typeof(NEW.metadata->'tags') != 'array' THEN
        RAISE EXCEPTION 'metadata.tags must be an array';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_product_metadata
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION validate_product_metadata();
```

---

## 2. Array Types — PostgreSQL Collection Types

### 2.1 When to Use Array Types

Array types are useful when storing a short list of values in a single row. However, because you cannot apply foreign key constraints to array elements, you need to understand the decision criteria for choosing between arrays and join tables.

```
┌───── Array Type vs. Join Table Decision Flow ──────────┐
│                                                         │
│  Q1: Do elements require a foreign key constraint?      │
│  ├── Yes → Join table                                   │
│  └── No → Go to Q2                                      │
│                                                         │
│  Q2: How frequently do elements change?                 │
│  ├── Frequently → Join table                            │
│  └── Infrequently → Go to Q3                            │
│                                                         │
│  Q3: What is the upper bound on element count?          │
│  ├── Hundreds or more → Join table                      │
│  └── Tens or fewer → Array type is appropriate          │
│                                                         │
│  Good use cases for array types:                        │
│  - Tags (list of strings)                               │
│  - Phone numbers (multiple per record)                  │
│  - Configuration values (list of options)               │
│  - Score history (list of numbers)                      │
│                                                         │
│  Good use cases for join tables:                        │
│  - User-to-role relationships (M:N)                     │
│  - Order-to-product relationships (with extra info)     │
│  - Follow relationships (bidirectional references)      │
└─────────────────────────────────────────────────────────┘
```

### Code Example 4: Complete Array Type Operations Guide

```sql
-- ===== Table Creation =====
CREATE TABLE blog_posts (
    id         SERIAL PRIMARY KEY,
    title      VARCHAR(200) NOT NULL,
    body       TEXT,
    tags       TEXT[] NOT NULL DEFAULT '{}',
    scores     INTEGER[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== Data Insertion (two syntax options) =====
INSERT INTO blog_posts (title, body, tags, scores) VALUES
('PostgreSQL Introduction', 'An introduction to PostgreSQL basics',
 ARRAY['database', 'postgresql', 'sql'],              -- ARRAY syntax
 ARRAY[85, 92, 78]),
('React Introduction', 'An introduction to React basics',
 '{"frontend", "react", "javascript"}',                -- Literal syntax
 '{90, 88, 95}'),
('TypeScript in Practice', 'About the TypeScript type system',
 ARRAY['frontend', 'typescript', 'javascript'],
 ARRAY[95, 91, 89]);

-- ===== Array Operators =====

-- @> : Does left side contain right side? (containment)
SELECT * FROM blog_posts WHERE tags @> ARRAY['postgresql'];

-- <@ : Is left side contained in right side?
SELECT * FROM blog_posts WHERE tags <@ ARRAY['database', 'postgresql', 'sql', 'mysql'];

-- && : Do they share any elements? (overlap check)
SELECT * FROM blog_posts WHERE tags && ARRAY['react', 'sql'];

-- = ANY() : Match any element in the array
SELECT * FROM blog_posts WHERE 'javascript' = ANY(tags);

-- Index access (1-based! PostgreSQL arrays are 1-indexed)
SELECT title, tags[1] AS first_tag, tags[2] AS second_tag
FROM blog_posts;

-- Slicing
SELECT title, tags[1:2] AS first_two_tags FROM blog_posts;

-- ===== Array Functions =====

-- array_length: length of array (2nd argument is dimension, typically 1)
SELECT title, array_length(tags, 1) AS tag_count FROM blog_posts;

-- array_to_string: join array elements into a string
SELECT title, array_to_string(tags, ', ') AS tag_list FROM blog_posts;

-- array_position: return the position of an element (NULL if not found)
SELECT title, array_position(tags, 'javascript') AS js_pos FROM blog_posts;

-- array_remove: return a new array with the specified element removed
SELECT title, array_remove(tags, 'javascript') AS tags_no_js FROM blog_posts;

-- array_cat: concatenate two arrays
SELECT array_cat(ARRAY[1,2,3], ARRAY[4,5,6]);  -- → {1,2,3,4,5,6}

-- array_append / array_prepend: add elements
UPDATE blog_posts
SET tags = array_append(tags, 'tutorial')
WHERE id = 1;

UPDATE blog_posts
SET tags = array_prepend('featured', tags)
WHERE id = 1;

-- ===== UNNEST: Expand an Array (most important function) =====

-- Expand tags of all posts into rows
SELECT p.title, t.tag
FROM blog_posts p, UNNEST(p.tags) AS t(tag);

-- Count tag occurrences
SELECT tag, COUNT(*) AS usage_count
FROM blog_posts, UNNEST(tags) AS tag
GROUP BY tag
ORDER BY usage_count DESC;

-- Deduplicated list of all tags (sorted)
SELECT ARRAY_AGG(DISTINCT tag ORDER BY tag) AS all_tags
FROM blog_posts, UNNEST(tags) AS tag;

-- Score statistics
SELECT
    title,
    array_length(scores, 1) AS num_scores,
    (SELECT AVG(s) FROM UNNEST(scores) AS s) AS avg_score,
    (SELECT MAX(s) FROM UNNEST(scores) AS s) AS max_score,
    (SELECT MIN(s) FROM UNNEST(scores) AS s) AS min_score
FROM blog_posts;

-- ===== GIN Index for Arrays =====
CREATE INDEX idx_posts_tags ON blog_posts USING GIN (tags);

-- Verify index usage
EXPLAIN ANALYZE
SELECT * FROM blog_posts WHERE tags @> ARRAY['postgresql'];
-- → Bitmap Index Scan on idx_posts_tags (GIN index is used)
```

---

## 3. Range Types, Full-Text Search, and Network Types

### 3.1 Range Types

Range types are PostgreSQL-specific data types that represent an interval of values, allowing direct handling of date ranges, numeric ranges, and timestamp ranges. Combined with EXCLUDE constraints, they prevent overlapping reservations and schedules at the database level.

### Code Example 5: Practical Use of Range Types

```sql
-- ===== Range Type Variants =====
-- INT4RANGE  : Integer range
-- INT8RANGE  : Bigint range
-- NUMRANGE   : Numeric range
-- DATERANGE  : Date range
-- TSRANGE    : Timestamp range (without time zone)
-- TSTZRANGE  : Timestamp range (with time zone)

-- ===== Reservation System: Room Overlap Check =====
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- Required for EXCLUDE constraints

CREATE TABLE room_reservations (
    id       SERIAL PRIMARY KEY,
    room_id  INTEGER NOT NULL,
    period   DATERANGE NOT NULL,
    guest    VARCHAR(100) NOT NULL,
    -- EXCLUDE constraint: disallow overlapping reservations for the same room
    EXCLUDE USING GIST (room_id WITH =, period WITH &&)
);

-- Valid reservations
INSERT INTO room_reservations (room_id, period, guest) VALUES
(101, '[2024-03-01, 2024-03-05)', 'Tanaka Taro'),   -- 3/1 to 3/4
(101, '[2024-03-05, 2024-03-08)', 'Suzuki Ichiro'), -- 3/5 to 3/7 (adjacent is OK)
(102, '[2024-03-01, 2024-03-05)', 'Sato Hanako');   -- Different room is OK

-- This reservation would cause an error (overlap)
-- INSERT INTO room_reservations (room_id, period, guest) VALUES
-- (101, '[2024-03-04, 2024-03-06)', 'Yamada Jiro');
-- → ERROR: conflicting key value violates exclusion constraint

-- ===== Range Operators =====

-- @> : Does the range contain a value?
SELECT * FROM room_reservations
WHERE period @> '2024-03-03'::DATE;

-- && : Do two ranges overlap?
SELECT * FROM room_reservations
WHERE period && '[2024-03-03, 2024-03-06)'::DATERANGE;

-- << : Is the left side entirely before the right side?
-- >> : Is the left side entirely after the right side?
-- -|- : Are the ranges adjacent?

-- Range arithmetic
SELECT
    '[2024-03-01, 2024-03-05)'::DATERANGE
    * '[2024-03-03, 2024-03-08)'::DATERANGE AS intersection,  -- Common part
    '[2024-03-01, 2024-03-05)'::DATERANGE
    + '[2024-03-03, 2024-03-08)'::DATERANGE AS union_range;    -- Union

-- lower/upper: retrieve lower and upper bounds of a range
SELECT
    guest,
    lower(period) AS check_in,
    upper(period) AS check_out,
    upper(period) - lower(period) AS stay_days
FROM room_reservations;

-- ===== Work Shift Management =====
CREATE TABLE work_shifts (
    id          SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL,
    shift_time  TSTZRANGE NOT NULL,
    EXCLUDE USING GIST (employee_id WITH =, shift_time WITH &&)
);

INSERT INTO work_shifts (employee_id, shift_time) VALUES
(1, '[2024-03-01 09:00, 2024-03-01 17:00)'::TSTZRANGE),
(1, '[2024-03-01 18:00, 2024-03-01 22:00)'::TSTZRANGE);  -- Non-adjacent is OK

-- ===== Price Tier Table =====
CREATE TABLE price_tiers (
    id          SERIAL PRIMARY KEY,
    tier_name   VARCHAR(50) NOT NULL,
    quantity    INT4RANGE NOT NULL,
    unit_price  DECIMAL(10, 2) NOT NULL,
    EXCLUDE USING GIST (quantity WITH &&)  -- Disallow overlapping quantity ranges
);

INSERT INTO price_tiers (tier_name, quantity, unit_price) VALUES
('Individual', '[1, 10)', 1000),
('Small', '[10, 100)', 800),
('Bulk', '[100, 1000)', 600),
('Wholesale', '[1000,)', 400);  -- No upper bound

-- Look up unit price for a given quantity
SELECT tier_name, unit_price
FROM price_tiers
WHERE quantity @> 50;  -- → 'Small', 800
```

### 3.2 Full-Text Search

### Code Example 6: Full-Text Search and Trigram Search

```sql
-- ===== tsvector / tsquery-Based Full-Text Search =====

CREATE TABLE articles (
    id            SERIAL PRIMARY KEY,
    title         VARCHAR(300) NOT NULL,
    body          TEXT NOT NULL,
    search_vector TSVECTOR,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update search_vector via trigger
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.body, '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_search_vector
    BEFORE INSERT OR UPDATE OF title, body ON articles
    FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- GIN index
CREATE INDEX idx_articles_search ON articles USING GIN (search_vector);

-- Insert data (search_vector is set automatically by the trigger)
INSERT INTO articles (title, body) VALUES
('PostgreSQL Full-Text Search Guide',
 'PostgreSQL provides built-in full-text search using tsvector and tsquery. It supports stemming, ranking, and highlighting.'),
('Index Optimization Techniques',
 'Understanding B-Tree, GIN, and GiST indexes is essential for PostgreSQL performance tuning.'),
('Database Security Best Practices',
 'Implementing row-level security, encryption, and audit logging protects your PostgreSQL database.');

-- ===== Search Queries =====

-- Basic search
SELECT title, ts_rank(search_vector, query) AS rank
FROM articles,
     to_tsquery('english', 'postgresql & index') AS query
WHERE search_vector @@ query
ORDER BY rank DESC;

-- Phrase search (PostgreSQL 13+)
SELECT title
FROM articles
WHERE search_vector @@ phraseto_tsquery('english', 'full text search');

-- OR search
SELECT title FROM articles
WHERE search_vector @@ to_tsquery('english', 'security | encryption');

-- NOT search (contains "security" but not "encryption")
SELECT title FROM articles
WHERE search_vector @@ to_tsquery('english', 'security & !encryption');

-- Highlighted display
SELECT
    title,
    ts_headline('english', body,
        to_tsquery('english', 'postgresql'),
        'StartSel=<b>, StopSel=</b>, MaxWords=35, MinWords=15'
    ) AS highlighted
FROM articles
WHERE search_vector @@ to_tsquery('english', 'postgresql');

-- ===== pg_trgm: Trigram (Fuzzy Search) =====

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Inspect trigrams
SELECT show_trgm('PostgreSQL');
-- → {"  p"," po","gre","osq","pos","ostg","pgr","que","res","sql","stg","tgr"}

-- Trigram GIN index
CREATE INDEX idx_articles_title_trgm
ON articles USING GIN (title gin_trgm_ops);

-- Similarity search (tolerates typos)
SELECT title, similarity(title, 'Postgre') AS sim
FROM articles
WHERE title % 'Postgre'  -- Default threshold: 0.3 or higher
ORDER BY sim DESC;

-- Change the similarity threshold
SET pg_trgm.similarity_threshold = 0.1;

-- LIKE/ILIKE can also use the trigram index
EXPLAIN ANALYZE
SELECT * FROM articles WHERE title ILIKE '%security%';
-- → Bitmap Index Scan on idx_articles_title_trgm

-- ===== Japanese Full-Text Search: Challenges and Solutions =====
-- The default parser for to_tsvector splits on whitespace,
-- so languages like Japanese that use no word boundaries require a different approach

-- Option 1: pg_bigm extension (bigram-based)
-- CREATE EXTENSION IF NOT EXISTS pg_bigm;
-- CREATE INDEX idx_title_bigm ON articles USING GIN (title gin_bigm_ops);
-- SELECT * FROM articles WHERE title LIKE '%database%';

-- Option 2: pgroonga extension (MeCab morphological analysis-based)
-- CREATE EXTENSION IF NOT EXISTS pgroonga;
-- CREATE INDEX idx_articles_pgroonga ON articles USING pgroonga (title, body);
-- SELECT * FROM articles WHERE title &@~ 'database';

-- Option 3: simple parser + LIKE (suitable for small datasets)
SELECT * FROM articles
WHERE to_tsvector('simple', title) @@ to_tsquery('simple', 'postgresql');
```

### 3.3 Network Types

```sql
-- ===== INET / CIDR / MACADDR Types =====

CREATE TABLE access_logs (
    id          BIGSERIAL PRIMARY KEY,
    client_ip   INET NOT NULL,
    subnet      CIDR,
    mac_address MACADDR,
    accessed_at TIMESTAMPTZ DEFAULT NOW(),
    path        VARCHAR(500)
);

INSERT INTO access_logs (client_ip, subnet, path) VALUES
('192.168.1.100', '192.168.1.0/24', '/api/users'),
('10.0.0.50', '10.0.0.0/8', '/api/orders'),
('192.168.1.200', '192.168.1.0/24', '/api/products');

-- Check if IP is within a subnet
SELECT * FROM access_logs
WHERE client_ip << '192.168.1.0/24';

-- Check if IP is within a subnet (including equal)
SELECT * FROM access_logs
WHERE client_ip <<= '192.168.0.0/16';

-- Retrieve the host portion of an IP address
SELECT client_ip, host(client_ip), masklen(subnet)
FROM access_logs;

-- Speed up IP range searches with a GiST index
CREATE INDEX idx_access_logs_ip ON access_logs USING GIST (client_ip inet_ops);
```

---

## 4. Extensions

### 4.1 Extension Architecture

```
┌──────── PostgreSQL Extension Architecture ──────────────┐
│                                                          │
│  contrib extensions (bundled with PostgreSQL)            │
│  ├── pg_stat_statements   Query statistics (essential)   │
│  ├── uuid-ossp / pgcrypto UUID generation / encryption   │
│  ├── pg_trgm              Trigram search                 │
│  ├── hstore               Simple KVS                     │
│  ├── btree_gist           B-Tree operators via GiST      │
│  ├── btree_gin            B-Tree operators via GIN       │
│  ├── tablefunc            crosstab (pivot)               │
│  ├── postgres_fdw         Connect to external PostgreSQL │
│  └── file_fdw             Reference external files       │
│                                                          │
│  Third-party extensions (require separate installation)  │
│  ├── PostGIS              Geospatial data                │
│  ├── TimescaleDB          Time-series data               │
│  ├── pg_partman           Automatic partition management │
│  ├── pgvector             Vector similarity search       │
│  ├── pg_bigm              Japanese full-text search      │
│  ├── pgroonga             Fast Japanese full-text search │
│  ├── pgAudit              Audit logging                  │
│  └── Citus                Distributed database           │
│                                                          │
│  WHY are extensions important?                           │
│  → Keeps the PostgreSQL core lean                        │
│  → Modular design: add only the features you need        │
│  → contrib extensions share the same quality standards   │
│    as PostgreSQL core                                    │
└──────────────────────────────────────────────────────────┘
```

### Code Example 7: Using Key Extensions

```sql
-- ===== Check available extensions =====
SELECT name, default_version, comment
FROM pg_available_extensions
WHERE comment IS NOT NULL
ORDER BY name
LIMIT 20;

-- Check installed extensions
SELECT extname, extversion FROM pg_extension ORDER BY extname;

-- ===== uuid-ossp: UUID Generation =====
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

SELECT uuid_generate_v4();                    -- Random UUID
SELECT uuid_generate_v1();                    -- Timestamp-based UUID
SELECT gen_random_uuid();                     -- PostgreSQL 13+ built-in function

-- Use UUID as a primary key
CREATE TABLE users_v2 (
    id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name  VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE
);

-- ===== pgcrypto: Encryption =====
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Password hashing (bcrypt)
SELECT crypt('my_password', gen_salt('bf', 12));
-- → $2a$12$xxxx... (60-character bcrypt hash)

-- Password verification
SELECT (crypt('my_password', stored_hash) = stored_hash) AS is_valid;

-- Symmetric encryption (AES-256)
SELECT pgp_sym_encrypt('sensitive data', 'encryption_key');
SELECT pgp_sym_decrypt(
    pgp_sym_encrypt('sensitive data', 'encryption_key'),
    'encryption_key'
);

-- Random byte sequence
SELECT encode(gen_random_bytes(32), 'hex') AS random_token;

-- ===== pg_trgm: Fuzzy Search =====
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE customers (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL
);

INSERT INTO customers (name) VALUES
('Tanaka Taro'), ('Tanaka Taro (alt)'), ('Tanaka Taro (variant)'), ('Suzuki Ichiro');

CREATE INDEX idx_customers_name_trgm ON customers USING GIN (name gin_trgm_ops);

-- Similarity search
SELECT name, similarity(name, 'Tanaka Taro') AS sim
FROM customers
ORDER BY sim DESC;

-- ===== hstore: Simple Key-Value Store =====
CREATE EXTENSION IF NOT EXISTS hstore;

CREATE TABLE app_settings (
    user_id  INTEGER PRIMARY KEY,
    prefs    HSTORE
);

INSERT INTO app_settings VALUES
(1, 'theme => dark, lang => ja, font_size => 14'),
(2, 'theme => light, lang => en');

SELECT user_id, prefs->'theme' AS theme, prefs->'lang' AS lang
FROM app_settings;

-- Note: JSONB is now preferred over hstore. hstore does not support nesting.

-- ===== PostGIS: Geospatial (requires separate installation) =====
-- CREATE EXTENSION IF NOT EXISTS postgis;
--
-- CREATE TABLE shops (
--     id       SERIAL PRIMARY KEY,
--     name     VARCHAR(200),
--     location GEOMETRY(Point, 4326)
-- );
--
-- INSERT INTO shops (name, location) VALUES
-- ('Tokyo Main Store', ST_SetSRID(ST_MakePoint(139.7671, 35.6812), 4326)),
-- ('Osaka Branch', ST_SetSRID(ST_MakePoint(135.5023, 34.6937), 4326));
--
-- -- Shops within 5km of Tokyo Station
-- SELECT name, ST_Distance(
--     location::geography,
--     ST_SetSRID(ST_MakePoint(139.7671, 35.6812), 4326)::geography
-- ) AS distance_m
-- FROM shops
-- WHERE ST_DWithin(
--     location::geography,
--     ST_SetSRID(ST_MakePoint(139.7671, 35.6812), 4326)::geography,
--     5000
-- );

-- ===== pg_stat_statements: Query Statistics (essential for production) =====
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top 10 slowest queries
SELECT
    query,
    calls,
    round(total_exec_time::NUMERIC, 2) AS total_ms,
    round(mean_exec_time::NUMERIC, 2) AS avg_ms,
    rows,
    round((100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0))::NUMERIC, 2)
        AS cache_hit_pct
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- ===== pgvector: Vector Similarity Search (for AI/ML) =====
-- CREATE EXTENSION IF NOT EXISTS vector;
--
-- CREATE TABLE document_embeddings (
--     id        SERIAL PRIMARY KEY,
--     content   TEXT NOT NULL,
--     embedding vector(1536)  -- Dimensions for OpenAI text-embedding-3-small
-- );
--
-- CREATE INDEX ON document_embeddings
--     USING ivfflat (embedding vector_cosine_ops)
--     WITH (lists = 100);
--
-- -- Nearest-neighbor search by cosine similarity
-- SELECT content, 1 - (embedding <=> '[0.1, 0.2, ...]'::vector) AS similarity
-- FROM document_embeddings
-- ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
-- LIMIT 5;
```

---

## 5. Advanced PostgreSQL Features

### Code Example 8: GENERATED COLUMNS, LISTEN/NOTIFY, and Table Inheritance

```sql
-- ===== GENERATED COLUMNS (Computed columns, PostgreSQL 12+) =====

CREATE TABLE order_items (
    id          SERIAL PRIMARY KEY,
    product_name VARCHAR(200) NOT NULL,
    quantity    INTEGER NOT NULL CHECK (quantity > 0),
    unit_price  DECIMAL(10, 2) NOT NULL CHECK (unit_price > 0),
    tax_rate    DECIMAL(5, 4) NOT NULL DEFAULT 0.10,
    -- STORED: computed columns saved to disk
    subtotal    DECIMAL(12, 2) GENERATED ALWAYS AS
                (quantity * unit_price) STORED,
    tax_amount  DECIMAL(12, 2) GENERATED ALWAYS AS
                (quantity * unit_price * tax_rate) STORED,
    total       DECIMAL(12, 2) GENERATED ALWAYS AS
                (quantity * unit_price * (1 + tax_rate)) STORED
);

INSERT INTO order_items (product_name, quantity, unit_price) VALUES
('Laptop', 2, 150000),
('Mouse', 5, 3000);

SELECT product_name, quantity, unit_price, subtotal, tax_amount, total
FROM order_items;
-- Laptop | 2 | 150000 | 300000 | 30000 | 330000
-- Mouse  | 5 | 3000   | 15000  | 1500  | 16500

-- WHY GENERATED COLUMNS?
-- → No need for the application to compute values (prevents bugs)
-- → Computed values can be indexed
-- → STORED columns are physically saved, so SELECT has zero computation cost
-- → VIRTUAL columns (supported by MySQL, not PostgreSQL) are computed on SELECT

-- ===== LISTEN / NOTIFY (Real-Time Notifications) =====

-- Session 1 (listener):
LISTEN order_created;
LISTEN order_status_changed;

-- Session 2 (notifier):
NOTIFY order_created, '{"order_id": 42, "amount": 5000}';

-- Practical example: auto-notify via trigger
CREATE TABLE orders (
    id          SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    total       DECIMAL(12, 2) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION notify_order_event()
RETURNS TRIGGER AS $$
DECLARE
    payload JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        payload := jsonb_build_object(
            'event', 'order_created',
            'order_id', NEW.id,
            'customer_id', NEW.customer_id,
            'total', NEW.total
        );
        PERFORM pg_notify('order_events', payload::TEXT);
    ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        payload := jsonb_build_object(
            'event', 'order_status_changed',
            'order_id', NEW.id,
            'old_status', OLD.status,
            'new_status', NEW.status
        );
        PERFORM pg_notify('order_events', payload::TEXT);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_order
    AFTER INSERT OR UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION notify_order_event();

-- WHY LISTEN/NOTIFY?
-- → Real-time notification without polling
-- → Lightweight event notification without an external message queue
-- → Tied to transactions (notifications are only sent for committed changes)
-- Limitations:
-- → Payload must be within 8KB
-- → Not persistent (notifications are lost if no listener is connected)
-- → For large-scale event processing, use Kafka/RabbitMQ

-- ===== Table Inheritance =====

-- Base table
CREATE TABLE events (
    id         BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    user_id    INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Child tables (inherit columns from the base table)
CREATE TABLE click_events (
    element_id  VARCHAR(100),
    page_url    VARCHAR(500)
) INHERITS (events);

CREATE TABLE purchase_events (
    product_id  INTEGER NOT NULL,
    amount      DECIMAL(10, 2) NOT NULL,
    currency    VARCHAR(3) DEFAULT 'JPY'
) INHERITS (events);

-- Insert into child tables
INSERT INTO click_events (event_type, user_id, element_id, page_url)
VALUES ('click', 1, 'btn-submit', '/checkout');

INSERT INTO purchase_events (event_type, user_id, product_id, amount)
VALUES ('purchase', 1, 42, 5000);

-- Querying the parent table also returns data from all child tables
SELECT * FROM events;

-- Query only the parent table (exclude child tables)
SELECT * FROM ONLY events;

-- WHY table inheritance?
-- → Consolidate common column definitions in one place
-- → A query on the parent table searches all child tables
-- Notes:
-- → Partitioning is now preferred (PostgreSQL 10+)
-- → UNIQUE constraints and FKs on the parent do not apply to child tables
-- → Use DECLARATIVE PARTITIONING for new projects
```

---

## PostgreSQL Data Type Reference (Overview)

```
┌──────────────── PostgreSQL Special Data Types ──────────────────────┐
│                                                                      │
│  Structured Data                                                     │
│  ├── JSONB       → Binary JSON. GIN index support. Recommended      │
│  ├── JSON        → Text JSON. Not pre-parsed. Not recommended        │
│  ├── HSTORE      → Simple KVS. No nesting. Replace with JSONB       │
│  └── XML         → XML documents. Use only when XML support needed   │
│                                                                      │
│  Collections                                                         │
│  ├── ARRAY       → Array type (available for all types). GIN support │
│  └── COMPOSITE   → Composite type (row type). Used to define UDTs    │
│                                                                      │
│  Range Types                                                         │
│  ├── INT4RANGE   → Integer range     Overlap prevention via EXCLUDE  │
│  ├── INT8RANGE   → Bigint range                                      │
│  ├── NUMRANGE    → Numeric range                                     │
│  ├── DATERANGE   → Date range        Overlap check for reservations  │
│  ├── TSRANGE     → Timestamp range (without TZ)                      │
│  └── TSTZRANGE   → Timestamp range (with TZ) Ideal for shift mgmt   │
│                                                                      │
│  Network Types                                                       │
│  ├── INET        → IP address (v4/v6) Subnet search support         │
│  ├── CIDR        → Network address                                   │
│  └── MACADDR     → MAC address                                       │
│                                                                      │
│  Spatial and Search Types                                            │
│  ├── POINT       → 2D coordinate                                     │
│  ├── GEOMETRY    → PostGIS geospatial (extension)                    │
│  ├── TSVECTOR    → Full-text search vector (GIN index)               │
│  └── TSQUERY     → Full-text search query                            │
│                                                                      │
│  Identifier and Special Types                                        │
│  ├── UUID        → 128-bit unique identifier. gen_random_uuid()      │
│  ├── BIT/VARBIT  → Bit string                                        │
│  ├── BYTEA       → Binary data                                       │
│  └── ENUM        → Enumerated type. Values added via ALTER TYPE      │
│                                                                      │
│  Vector Types (extension)                                            │
│  └── VECTOR      → pgvector. Vector similarity search for AI/ML     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Comparison Tables

### JSON vs JSONB Comparison

| Feature | JSON | JSONB |
|---------|------|-------|
| Storage format | Text (stored as-is) | Binary (pre-parsed) |
| Storage size | Slightly smaller | Slightly larger (metadata overhead) |
| Insert speed | Fast (no conversion) | Slightly slower (parsing required) |
| Read speed | Slow (parsed every time) | Fast (already parsed) |
| Key access | O(n) linear scan | O(log n) binary search |
| Indexing | Not supported | GIN support (@>, ?, @@) |
| Duplicate keys | Retained | Only last key retained |
| Key order | Preserved (input order) | Sorted |
| Whitespace | Preserved | Removed |
| Operators | Few (-> and ->> only) | Rich (@>, ?, ?&, ?|, @@) |
| jsonpath | Not supported | Supported (PostgreSQL 12+) |
| Recommendation | Only when full text preservation is required | Recommended for almost all use cases |

### Key Extensions Comparison

| Extension | Category | Purpose | Size Impact | Production Use | Recommendation |
|-----------|----------|---------|-------------|---------------|----------------|
| pg_stat_statements | Monitoring | Query statistics / slow query analysis | Minimal | Essential | Must-have |
| uuid-ossp | Identifier | UUID generation (v1, v4) | None | Safe | High (gen_random_uuid() available in 13+) |
| pgcrypto | Encryption | Password hashing / encryption | None | Safe | High |
| pg_trgm | Search | Trigram fuzzy search | Index-dependent | Safe | High |
| btree_gist | Index | B-Tree operators via GiST | Small | Safe | Required when using EXCLUDE constraints |
| PostGIS | Geospatial | Coordinate / distance / area calculations | Large | Safe | Essential if geospatial data is involved |
| pgvector | AI/ML | Vector similarity search | Medium | Safe | Essential for RAG / semantic search |
| pg_partman | Management | Automatic partition management | Small | Safe | Recommended for large tables |
| TimescaleDB | Time-series | High-performance time-series processing | Medium | Safe | Recommended if time-series is primary workload |
| pg_bigm | Search | Japanese full-text search (bigram) | Index-dependent | Safe | Recommended if Japanese search is needed |
| hstore | KVS | Simple key-value storage | Small | Safe | Low (replaceable with JSONB) |
| pgAudit | Audit | Detailed audit log recording | Medium (log-dependent) | Safe | Essential if compliance requirements exist |

### Index Types vs Supported Data Types and Operators

| Index Type | Supported Data Types | Supported Operators | Use Cases |
|-----------|---------------------|---------------------|-----------|
| B-Tree | All scalar types | =, <, >, <=, >= | Equality / range search (default) |
| GIN | JSONB, ARRAY, TSVECTOR | @>, ?, &&, @@ | Full-text search, JSON search, array containment |
| GIN (jsonb_path_ops) | JSONB | @> only | Specialized for JSONB containment search |
| GIN (gin_trgm_ops) | TEXT | %, LIKE, ILIKE | Fuzzy search |
| GiST | Range types, INET, geometric types | @>, &&, <<, >> | Range search, spatial search |
| SP-GiST | INET, TEXT | <<, >> | Radix tree structure searches |
| BRIN | Timestamps, integers | <, >, =, <= | Range search on large tables (compact size) |
| IVFFlat (pgvector) | vector | <=> (cosine distance) | Vector nearest-neighbor search |
| HNSW (pgvector) | vector | <=> | High-accuracy vector search |

---

## Anti-Patterns

### Anti-Pattern 1: Storing All Relational Data in JSONB

```sql
-- BAD: storing everything that should be in tables inside JSONB
CREATE TABLE bad_orders (
    id   SERIAL PRIMARY KEY,
    data JSONB  -- customer info, product info, shipping — all in JSON
);

INSERT INTO bad_orders (data) VALUES ('{
    "customer": {"name": "Tanaka", "email": "tanaka@example.com"},
    "items": [{"product": "PC", "price": 150000}],
    "shipping": {"address": "Tokyo...", "method": "express"}
}');

-- Problems:
-- 1. Foreign key constraints do not apply → cannot guarantee data integrity
-- 2. Cannot JOIN → difficult to aggregate and analyze
-- 3. No type safety → numbers may be stored as strings
-- 4. Self-documenting schema functionality is lost
-- 5. NOT NULL and CHECK constraints cannot be used

-- GOOD: relational data in tables, only variable parts in JSONB
CREATE TABLE good_orders (
    id          SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    total       DECIMAL(12,2) NOT NULL,
    metadata    JSONB DEFAULT '{}'  -- Only variable info: notes, tags, external API responses
);

-- Decision criteria:
-- · Frequently searched in WHERE clauses → table column
-- · Requires foreign key constraint → table column
-- · Fixed schema → table column
-- · Variable / optional schema → JSONB
-- · Display only, not searched → JSONB
```

### Anti-Pattern 2: Representing M:N Relationships with Array Types

```sql
-- BAD: representing M:N relationships with arrays
CREATE TABLE bad_articles (
    id       SERIAL PRIMARY KEY,
    title    VARCHAR(200),
    tag_ids  INTEGER[]  -- FK constraints do not apply!
);

-- Problems:
-- 1. Cannot verify that values in tag_ids correspond to existing tags records
-- 2. If a tags.id is deleted, the reference remains in the array (orphaned reference)
-- 3. Cannot store metadata about the tag (e.g., date added)
-- 4. Updating a tag requires complex array manipulation
-- 5. Performance: JOIN optimization does not apply

-- GOOD: represent M:N relationships with a join table
CREATE TABLE tags (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE good_articles (
    id    SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL
);

CREATE TABLE article_tags (
    article_id INTEGER REFERENCES good_articles(id) ON DELETE CASCADE,
    tag_id     INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    added_at   TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (article_id, tag_id)
);

-- Foreign key constraints, cascading deletes, and JOIN optimization all work

-- However, when tags are simple string labels with no foreign key requirement,
-- array types are simpler and more appropriate
CREATE TABLE simple_articles (
    id    SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    tags  TEXT[] NOT NULL DEFAULT '{}'  -- List of string tags
);
-- Adding a GIN index on tags enables fast search
CREATE INDEX idx_simple_articles_tags
ON simple_articles USING GIN (tags);
```

### Anti-Pattern 3: Full Table Scans on JSONB

```sql
-- BAD: searching JSONB without a GIN index
SELECT * FROM products
WHERE metadata @> '{"brand": "Apple"}';
-- → Seq Scan: scans the entire table and compares JSONB contents

-- GOOD: create a GIN index before searching
CREATE INDEX idx_products_metadata ON products USING GIN (metadata);
-- Or, if you frequently search by a specific brand, use an expression index
CREATE INDEX idx_products_brand ON products ((metadata->>'brand'));
-- → Changes to an Index Scan, significantly faster

-- Make it a habit to verify index usage with EXPLAIN ANALYZE
EXPLAIN ANALYZE
SELECT * FROM products WHERE metadata @> '{"brand": "Apple"}';
```

---

## Practice Exercises

### Exercise 1 (Basic): JSONB Schema Design for an E-Commerce Site

**Task**: Design a product table for an e-commerce site that satisfies the following requirements, and write the corresponding queries.

- Product name, category, and price are regular columns
- Product attributes (color, size, weight, etc.) are stored in JSONB
- Tags are stored as an array type
- Write the following queries:
  1. Search for products from a specific brand ("Apple")
  2. Search for products with a price of 100,000 or more and RAM of 8GB or more
  3. List products that have the "camera" tag
  4. Aggregate product count and average price by brand

<details>
<summary>Sample Solution</summary>

```sql
-- Table definition
CREATE TABLE ec_products (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(200) NOT NULL,
    category   VARCHAR(100) NOT NULL,
    price      DECIMAL(12, 2) NOT NULL,
    tags       TEXT[] NOT NULL DEFAULT '{}',
    attributes JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ec_products_category ON ec_products (category);
CREATE INDEX idx_ec_products_price ON ec_products (price);
CREATE INDEX idx_ec_products_tags ON ec_products USING GIN (tags);
CREATE INDEX idx_ec_products_attrs ON ec_products USING GIN (attributes);
CREATE INDEX idx_ec_products_brand ON ec_products ((attributes->>'brand'));

-- Test data
INSERT INTO ec_products (name, category, price, tags, attributes) VALUES
('MacBook Pro 14', 'laptop', 298000,
 ARRAY['apple', 'professional', 'creative'],
 '{"brand": "Apple", "specs": {"cpu": "M3 Pro", "ram_gb": 18, "ssd_gb": 512}, "color": "space_black"}'),
('iPhone 15 Pro', 'smartphone', 159800,
 ARRAY['apple', 'camera', 'premium'],
 '{"brand": "Apple", "specs": {"chip": "A17 Pro", "ram_gb": 8, "storage_gb": 256}, "color": "natural"}'),
('Galaxy S24 Ultra', 'smartphone', 189800,
 ARRAY['samsung', 'camera', 'ai', 'premium'],
 '{"brand": "Samsung", "specs": {"chip": "Snapdragon 8 Gen 3", "ram_gb": 12, "storage_gb": 256}, "color": "titanium_gray"}'),
('ThinkPad X1 Carbon', 'laptop', 198000,
 ARRAY['lenovo', 'business', 'lightweight'],
 '{"brand": "Lenovo", "specs": {"cpu": "i7-1365U", "ram_gb": 16, "ssd_gb": 512}, "weight_kg": 1.12}');

-- 1. Search for products from a specific brand
SELECT name, price, attributes->>'brand' AS brand
FROM ec_products
WHERE attributes @> '{"brand": "Apple"}';

-- 2. Price >= 100,000 and RAM >= 8GB
SELECT name, price,
       (attributes->'specs'->>'ram_gb')::INTEGER AS ram_gb
FROM ec_products
WHERE price >= 100000
  AND (attributes->'specs'->>'ram_gb')::INTEGER >= 8;

-- 3. Products with the "camera" tag
SELECT name, price, tags
FROM ec_products
WHERE tags @> ARRAY['camera'];

-- 4. Aggregation by brand
SELECT
    attributes->>'brand' AS brand,
    COUNT(*) AS product_count,
    ROUND(AVG(price), 0) AS avg_price,
    MIN(price) AS min_price,
    MAX(price) AS max_price
FROM ec_products
GROUP BY attributes->>'brand'
ORDER BY avg_price DESC;
```

</details>

### Exercise 2 (Intermediate): Meeting Room Reservation System Using Range Types

**Task**: Design a meeting room reservation system that satisfies the following requirements.

- The same meeting room cannot have overlapping reservations in the same time slot (EXCLUDE constraint)
- Available meeting rooms at a specific time can be searched
- Overlap checks on reservations are fast
- Implement create, search, and cancel functions for reservations

<details>
<summary>Sample Solution</summary>

```sql
-- Enable the extension
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Meeting room master table
CREATE TABLE meeting_rooms (
    id       SERIAL PRIMARY KEY,
    name     VARCHAR(100) NOT NULL UNIQUE,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    floor    INTEGER NOT NULL,
    features JSONB DEFAULT '{}' -- {"projector": true, "whiteboard": true}
);

-- Reservation table
CREATE TABLE meeting_reservations (
    id          SERIAL PRIMARY KEY,
    room_id     INTEGER NOT NULL REFERENCES meeting_rooms(id),
    time_range  TSTZRANGE NOT NULL,
    organizer   VARCHAR(100) NOT NULL,
    title       VARCHAR(200) NOT NULL,
    attendees   INTEGER NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    -- Prevent overlapping reservations
    EXCLUDE USING GIST (room_id WITH =, time_range WITH &&),
    -- Past reservations not allowed
    CHECK (lower(time_range) >= NOW() - interval '1 hour')
);

-- Test data
INSERT INTO meeting_rooms (name, capacity, floor, features) VALUES
('Meeting Room A', 10, 3, '{"projector": true, "whiteboard": true}'),
('Meeting Room B', 6, 3, '{"whiteboard": true}'),
('Large Conference Room', 30, 5, '{"projector": true, "whiteboard": true, "video_conf": true}');

-- Create reservations
INSERT INTO meeting_reservations (room_id, time_range, organizer, title, attendees) VALUES
(1, '[2024-12-01 10:00, 2024-12-01 11:00)'::TSTZRANGE, 'Tanaka', 'Team Meeting', 5),
(1, '[2024-12-01 13:00, 2024-12-01 14:30)'::TSTZRANGE, 'Suzuki', 'Design Review', 8),
(2, '[2024-12-01 10:00, 2024-12-01 12:00)'::TSTZRANGE, 'Sato', '1-on-1', 2);

-- Search for available rooms at a specific time
-- Available rooms from 12/1 11:00 to 12:00
SELECT r.name, r.capacity, r.floor
FROM meeting_rooms r
WHERE r.id NOT IN (
    SELECT room_id FROM meeting_reservations
    WHERE time_range && '[2024-12-01 11:00, 2024-12-01 12:00)'::TSTZRANGE
)
ORDER BY r.capacity;

-- List reservations for a specific room
SELECT
    mr.title,
    mr.organizer,
    lower(mr.time_range) AS start_time,
    upper(mr.time_range) AS end_time,
    mr.attendees
FROM meeting_reservations mr
JOIN meeting_rooms rm ON mr.room_id = rm.id
WHERE rm.name = 'Meeting Room A'
  AND mr.time_range && '[2024-12-01, 2024-12-02)'::TSTZRANGE
ORDER BY lower(mr.time_range);

-- Cancel a reservation
DELETE FROM meeting_reservations WHERE id = 1;
```

</details>

### Exercise 3 (Advanced): Inventory Management System with Real-Time Notifications

**Task**: Design an inventory management system that satisfies the following requirements.

- Automatically send a LISTEN/NOTIFY notification when product stock falls to or below a threshold (10 units)
- Record inventory movement history in JSONB
- Create a real-time view of inventory status
- Use GENERATED COLUMNS to auto-calculate inventory status

<details>
<summary>Sample Solution</summary>

```sql
-- Product table
CREATE TABLE inventory_products (
    id            SERIAL PRIMARY KEY,
    sku           VARCHAR(50) NOT NULL UNIQUE,
    name          VARCHAR(200) NOT NULL,
    current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    reorder_point INTEGER NOT NULL DEFAULT 10,
    max_stock     INTEGER NOT NULL DEFAULT 100,
    -- GENERATED COLUMN: auto-calculate inventory status
    stock_status  VARCHAR(20) GENERATED ALWAYS AS (
        CASE
            WHEN current_stock = 0 THEN 'out_of_stock'
            WHEN current_stock <= reorder_point THEN 'low_stock'
            WHEN current_stock >= max_stock THEN 'overstocked'
            ELSE 'in_stock'
        END
    ) STORED,
    metadata      JSONB DEFAULT '{}',
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory movement history table
CREATE TABLE inventory_movements (
    id           BIGSERIAL PRIMARY KEY,
    product_id   INTEGER NOT NULL REFERENCES inventory_products(id),
    movement_type VARCHAR(20) NOT NULL CHECK (
        movement_type IN ('receipt', 'sale', 'adjustment', 'return')
    ),
    quantity     INTEGER NOT NULL,  -- Positive = stock in, negative = stock out
    previous_stock INTEGER NOT NULL,
    new_stock    INTEGER NOT NULL,
    details      JSONB DEFAULT '{}',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Notification trigger for stock movements
CREATE OR REPLACE FUNCTION notify_low_stock()
RETURNS TRIGGER AS $$
DECLARE
    product RECORD;
    payload JSONB;
BEGIN
    SELECT * INTO product FROM inventory_products WHERE id = NEW.product_id;

    -- Notify when stock drops to or below the threshold
    IF NEW.new_stock <= product.reorder_point AND NEW.previous_stock > product.reorder_point THEN
        payload := jsonb_build_object(
            'event', 'low_stock_alert',
            'product_id', product.id,
            'sku', product.sku,
            'name', product.name,
            'current_stock', NEW.new_stock,
            'reorder_point', product.reorder_point,
            'timestamp', NOW()
        );
        PERFORM pg_notify('inventory_alerts', payload::TEXT);
    END IF;

    -- Send urgent notification for out-of-stock
    IF NEW.new_stock = 0 AND NEW.previous_stock > 0 THEN
        payload := jsonb_build_object(
            'event', 'out_of_stock_alert',
            'product_id', product.id,
            'sku', product.sku,
            'name', product.name,
            'timestamp', NOW()
        );
        PERFORM pg_notify('inventory_alerts', payload::TEXT);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_low_stock
    AFTER INSERT ON inventory_movements
    FOR EACH ROW EXECUTE FUNCTION notify_low_stock();

-- Function to safely record stock movements
CREATE OR REPLACE FUNCTION update_stock(
    p_product_id INTEGER,
    p_movement_type VARCHAR,
    p_quantity INTEGER,
    p_details JSONB DEFAULT '{}'
) RETURNS INTEGER AS $$
DECLARE
    v_current_stock INTEGER;
    v_new_stock INTEGER;
BEGIN
    -- Row lock for exclusive control
    SELECT current_stock INTO v_current_stock
    FROM inventory_products
    WHERE id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found: %', p_product_id;
    END IF;

    v_new_stock := v_current_stock + p_quantity;

    IF v_new_stock < 0 THEN
        RAISE EXCEPTION 'Insufficient stock. Current: %, Requested: %',
            v_current_stock, p_quantity;
    END IF;

    -- Update stock count
    UPDATE inventory_products
    SET current_stock = v_new_stock, updated_at = NOW()
    WHERE id = p_product_id;

    -- Record movement history
    INSERT INTO inventory_movements
        (product_id, movement_type, quantity, previous_stock, new_stock, details)
    VALUES
        (p_product_id, p_movement_type, p_quantity, v_current_stock, v_new_stock, p_details);

    RETURN v_new_stock;
END;
$$ LANGUAGE plpgsql;

-- Test data
INSERT INTO inventory_products (sku, name, current_stock, reorder_point) VALUES
('SKU-001', 'Laptop A', 50, 10),
('SKU-002', 'Mouse B', 8, 10),
('SKU-003', 'Keyboard C', 0, 5);

-- Stock operations
SELECT update_stock(1, 'sale', -5, '{"order_id": 1001}');    -- Down to 45
SELECT update_stock(1, 'sale', -37, '{"order_id": 1002}');   -- Down to 8 → notification fires
SELECT update_stock(1, 'receipt', 20, '{"po_number": "PO-001"}'); -- Back up to 28

-- Inventory status view
CREATE VIEW v_inventory_dashboard AS
SELECT
    p.sku,
    p.name,
    p.current_stock,
    p.reorder_point,
    p.stock_status,
    (SELECT COUNT(*) FROM inventory_movements m
     WHERE m.product_id = p.id
       AND m.created_at >= NOW() - INTERVAL '24 hours') AS movements_24h,
    (SELECT SUM(quantity) FROM inventory_movements m
     WHERE m.product_id = p.id
       AND m.movement_type = 'sale'
       AND m.created_at >= NOW() - INTERVAL '7 days') AS sold_7d
FROM inventory_products p
ORDER BY
    CASE p.stock_status
        WHEN 'out_of_stock' THEN 1
        WHEN 'low_stock' THEN 2
        WHEN 'in_stock' THEN 3
        WHEN 'overstocked' THEN 4
    END;

SELECT * FROM v_inventory_dashboard;
```

</details>

---

## FAQ

### Q1: Which should I use — JSONB or MongoDB?

If relational data is central and schema-less sections are limited, PostgreSQL's JSONB is the right choice. If all data is document-oriented, the schema changes frequently, and horizontal scaling (sharding) is required, consider MongoDB.

Advantages of PostgreSQL JSONB:
- Full ACID transaction support
- JOIN with relational data
- SQL standard query language
- Single database for everything (lower operational cost)

Advantages of MongoDB:
- Native document store (more natural API and aggregation pipeline)
- Built-in horizontal sharding
- Real-time processing via Change Streams
- Atlas Search (built-in Elasticsearch equivalent)

If 80% or more of your data is relational, use PostgreSQL + JSONB. If 80% or more is document-oriented, MongoDB is appropriate. See [NoSQL Comparison](./04-nosql-comparison.md) for details.

### Q2: What is the difference between pg_trgm and to_tsvector?

| Comparison | pg_trgm (Trigram) | to_tsvector (Full-Text Search) |
|-----------|------------------|-------------------------------|
| Mechanism | Similarity calculation using 3-character substrings | Tokenizes words via morphological analysis |
| Purpose | Typo-tolerant / fuzzy search | Semantic word search |
| Japanese support | Works as-is (partial match) | Requires a separate parser (pg_bigm, pgroonga) |
| Operators | %, LIKE, ILIKE | @@ |
| Ranking | Similarity score via similarity() | Relevance score via ts_rank() |
| Index | GIN (gin_trgm_ops) | GIN (tsvector) |
| Recommended for | Username / address search | Document / article search |

### Q3: Is it safe to use PostgreSQL extensions in production?

contrib extensions (pg_stat_statements, uuid-ossp, pgcrypto, etc.) are developed under the same release cycle and quality standards as the PostgreSQL core, and are completely safe for production use. In particular, pg_stat_statements is practically essential for query statistics and should be installed in every production environment.

Criteria for evaluating third-party extensions:
- **PostGIS**: Over 20 years of maturity; the de facto standard for geospatial data. Safe to use with confidence.
- **TimescaleDB**: The standard for time-series data processing. Extensive enterprise adoption.
- **pgvector**: Vector search for AI/ML. Rapidly adopted since 2023; numerous production use cases.
- **Citus**: Distributed PostgreSQL. Maintenance has been stable since the Microsoft acquisition.

Note: Available extensions are restricted on managed services like AWS RDS and Cloud SQL. Always check the supported extension list for your managed service before planning.

### Q4: Should I use the default GIN index or jsonb_path_ops?

| Comparison | Default GIN | jsonb_path_ops |
|-----------|-------------|---------------|
| Supported operators | @>, ?, ?&, ?| | @> only |
| Index size | Larger | 20-30% smaller |
| Build speed | Slower | Faster |
| Search speed | Fast | Fastest for @> |
| Recommended when | Key existence checks are also needed | Only containment searches are used |

If your application uses the `?` (key existence) operator, choose the default GIN. If you only use `@>` (containment), jsonb_path_ops is more efficient. When in doubt, the default GIN is a safe choice.

### Q5: Is there a size limit for array types? What is the performance impact?

PostgreSQL array types have no explicit size limit, but the general limit of 1GB per field applies. For practical use, the recommendations are:

- Up to tens of elements: array type is fine
- Hundreds of elements: GIN index supports search, but watch for increased update costs
- Thousands of elements or more: migrate to a join table (GIN index update costs become high)

Updating an array (e.g., with array_append) copies the entire array, so cost increases with element count. Arrays are appropriate for read-heavy access patterns; join tables are better for frequent writes.

---

## Summary

| Topic | Key Points |
|-------|-----------|
| JSONB | Binary JSON. Fast search with GIN index. Ideal for relational + variable-part designs |
| Array types | Collection storage. GIN index support. Suitable for short lists of elements |
| Range types | Directly represent intervals. Prevent overlaps with EXCLUDE constraints. Essential for reservations and shift management |
| Full-text search | Built-in full-text search with TSVECTOR + GIN. Fuzzy search also possible with pg_trgm |
| Network types | Handle IP addresses directly with INET/CIDR. GiST support for subnet searches |
| Extensions | pg_stat_statements is essential in production. pgvector enables AI/ML capabilities |
| GENERATED COLUMNS | Auto-manage computed columns. Can be indexed |
| LISTEN/NOTIFY | Lightweight real-time notification. Tied to transactions |
| Table inheritance | Use DECLARATIVE PARTITIONING for new projects |
| Usage guidelines | Relational foundation + JSONB for variable parts. Choose type based on access patterns |

---

## Further Reading

- [01-security.md](./01-security.md) — PostgreSQL security settings (RLS, encryption, auditing)
- [02-performance-tuning.md](./02-performance-tuning.md) — Performance tuning (EXPLAIN ANALYZE, index design)
- [03-orm-comparison.md](./03-orm-comparison.md) — Using PostgreSQL-specific features from ORMs
- [04-nosql-comparison.md](./04-nosql-comparison.md) — NoSQL comparison and polyglot persistence
- [Index Design](../01-advanced/03-indexing.md) — B-Tree, GIN, and GiST indexes in detail
- [Query Optimization](../01-advanced/04-query-optimization.md) — Reading EXPLAIN ANALYZE and optimization techniques

---

## References

1. PostgreSQL Documentation — "JSON Types" https://www.postgresql.org/docs/current/datatype-json.html
2. PostgreSQL Documentation — "Additional Supplied Modules" https://www.postgresql.org/docs/current/contrib.html
3. PostgreSQL Documentation — "Range Types" https://www.postgresql.org/docs/current/rangetypes.html
4. PostgreSQL Documentation — "Full Text Search" https://www.postgresql.org/docs/current/textsearch.html
5. PostgreSQL Documentation — "GIN Indexes" https://www.postgresql.org/docs/current/gin.html
6. Schonig, H.-J. (2023). *Mastering PostgreSQL 16*. Packt Publishing.
7. Riggs, S. & Ciolli, G. (2022). *PostgreSQL 14 Administration Cookbook*. Packt Publishing.

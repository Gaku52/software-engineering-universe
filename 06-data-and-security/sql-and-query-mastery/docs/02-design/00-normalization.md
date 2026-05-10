# Normalization — 1NF through BCNF and Denormalization

> Normalization is a relational database design technique that eliminates data redundancy and prevents update anomalies, while denormalization is a technique that intentionally introduces redundancy as a trade-off for performance.

## What You Will Learn

1. The step-by-step normalization process from First Normal Form (1NF) through Third Normal Form (3NF) and BCNF
2. The types of update anomalies that normalization resolves and their underlying mechanisms
3. The theoretical background and practical examples of Fourth Normal Form (4NF) and Fifth Normal Form (5NF)
4. Criteria for deciding when to denormalize and practical patterns for doing so
5. Differences in normalization-related features across RDBMS platforms

## Prerequisites

- Basic SQL syntax (CREATE TABLE, INSERT, SELECT)
- Foundational concepts of the relational model (tables, rows, columns)
- A general understanding of [01-schema-design.md](./01-schema-design.md) is helpful

---

## 1. Purpose and Theoretical Background of Normalization

### 1.1 Functional Dependency

The foundation of normalization theory is functional dependency. When knowing the value of attribute X uniquely determines the value of attribute Y, we say "Y is functionally dependent on X," written as `X → Y`.

```
┌──────────── Types of Functional Dependency ────────────────────┐
│                                                                  │
│  Full Functional Dependency                                      │
│  ────────────────────────────────────                           │
│  {A, B} → C, and neither A → C nor B → C holds                 │
│  Example: {student_id, course_id} → grade                       │
│  (Neither student_id alone nor course_id alone determines grade) │
│                                                                  │
│  Partial Functional Dependency                                   │
│  ────────────────────────────────────                           │
│  {A, B} → C, and either A → C or B → C holds                   │
│  Example: {order_id, product_id} → product_name                 │
│  (product_id alone determines product_name)                      │
│                                                                  │
│  Transitive Functional Dependency                                │
│  ────────────────────────────────────                           │
│  If A → B and B → C, then A → C holds                          │
│  Example: emp_id → dept_id → dept_name                          │
│  (emp_id determines dept_id, and dept_id determines dept_name)  │
│                                                                  │
│  Multi-Valued Dependency                                         │
│  ────────────────────────────────────                           │
│  A →→ B: For each value of A, a unique set of B values exists   │
│  Example: employee →→ skill, employee →→ language               │
│  (Skills and languages are independent but both tied to employee)│
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Detailed Analysis of Update Anomalies

```
┌─────────── Three Update Anomalies Resolved by Normalization ────┐
│                                                                  │
│  Insertion Anomaly                                               │
│  ─────────────────────────────                                   │
│  Cannot register a department that has no employees yet          │
│  (when employee table contains department information)           │
│                                                                  │
│  Update Anomaly                                                  │
│  ─────────────────────────────                                   │
│  Changing a department name requires updating every row          │
│  for every employee in that department (inconsistency if any     │
│  row is missed)                                                  │
│                                                                  │
│  Deletion Anomaly                                                │
│  ─────────────────────────────                                   │
│  Deleting the last employee also destroys the department data    │
│                                                                  │
│  → By splitting tables appropriately through normalization,      │
│    all of these anomalies can be prevented                       │
└──────────────────────────────────────────────────────────────────┘
```

#### Concrete Examples and Cost Analysis of Update Anomalies

```sql
-- Denormalized table: structure that causes update anomalies
CREATE TABLE emp_dept_denormalized (
    emp_id    INTEGER PRIMARY KEY,
    emp_name  VARCHAR(100),
    dept_id   INTEGER,
    dept_name VARCHAR(100),
    dept_loc  VARCHAR(100)
);

INSERT INTO emp_dept_denormalized VALUES
(1, 'Tanaka',   10, 'Engineering', 'Tokyo'),
(2, 'Suzuki',   10, 'Engineering', 'Tokyo'),
(3, 'Sato',     20, 'Sales',       'Osaka'),
(4, 'Takahashi',10, 'Engineering', 'Tokyo');

-- Insertion anomaly demo: how to register a new department with no employees?
-- emp_id is PRIMARY KEY so it cannot be NULL → impossible to insert
-- INSERT INTO emp_dept_denormalized VALUES (NULL, NULL, 30, 'Accounting', 'Nagoya');
-- → ERROR: null value in column "emp_id"

-- Update anomaly demo: relocating Engineering from Tokyo to Yokohama
UPDATE emp_dept_denormalized SET dept_loc = 'Yokohama' WHERE dept_id = 10;
-- → Must update 3 rows (inconsistency if any is missed)
-- For a department of 100,000 employees, 100,000 rows must be updated

-- Deletion anomaly demo: deleting Sato also erases Sales department data
DELETE FROM emp_dept_denormalized WHERE emp_id = 3;
-- → All information about dept_id=20 is permanently lost
```

### 1.3 Candidate Keys and Superkeys

A precise understanding of normalization requires a solid grasp of key concepts.

```
┌──────────── Key Hierarchy ──────────────────────┐
│                                                   │
│  Superkey                                         │
│  ┌──────────────────────────────────────────┐    │
│  │ A set of attributes that uniquely         │    │
│  │ identifies each row                       │    │
│  │ Example: {emp_id}, {emp_id, name},        │    │
│  │     {emp_id, name, dept_id}, ...          │    │
│  │                                            │    │
│  │  Candidate Key                             │    │
│  │  ┌──────────────────────────────────┐    │    │
│  │  │ Minimal superkey (no extra        │    │    │
│  │  │ attributes)                       │    │    │
│  │  │ Example: {emp_id}, {email}        │    │    │
│  │  │                                    │    │    │
│  │  │  Primary Key                      │    │    │
│  │  │  ┌──────────────────────────┐    │    │    │
│  │  │  │ One candidate key chosen  │    │    │    │
│  │  │  │ Example: emp_id           │    │    │    │
│  │  │  └──────────────────────────┘    │    │    │
│  │  └──────────────────────────────────┘    │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  Alternate Key                                    │
│  = Candidate key not selected as primary key      │
│  Example: email (enforced with UNIQUE constraint) │
└───────────────────────────────────────────────────┘
```

---

## 2. Stages of Normalization

### Code Example 1: Unnormalized Form to First Normal Form (1NF)

```sql
-- Unnormalized form: contains repeating groups
-- ┌────┬──────┬─────────────────────┐
-- │ id │ name │ phones              │
-- ├────┼──────┼─────────────────────┤
-- │ 1  │ Tanaka│ 090-1111, 03-2222  │ ← multiple values in one cell
-- └────┴──────┴─────────────────────┘

-- First Normal Form (1NF): each cell contains only atomic values
CREATE TABLE contacts (
    id    INTEGER,
    name  VARCHAR(100),
    phone VARCHAR(20),
    PRIMARY KEY (id, phone)  -- composite primary key
);

INSERT INTO contacts VALUES (1, 'Tanaka', '090-1111-2222');
INSERT INTO contacts VALUES (1, 'Tanaka', '03-2222-3333');

-- Requirements for 1NF:
-- 1. Each column value is atomic (indivisible)
-- 2. No repeating groups
-- 3. Row order has no significance
-- 4. Each row is uniquely identifiable (primary key exists)
```

#### Impact of 1NF on Internal Implementation

```
┌──────── Effect of 1NF Violations on Storage ────────┐
│                                                        │
│  Unnormalized form (comma-separated storage):          │
│  ┌─────────────────────────────────┐                  │
│  │ In Page: "090-1111,03-2222"     │                  │
│  │ stored as variable-length TEXT  │                  │
│  │ in a single tuple               │                  │
│  │ → Parsing required at query time│                  │
│  │ → Indexes cannot be used        │                  │
│  │ → Cannot filter by individual   │                  │
│  │   phone number in WHERE clause  │                  │
│  └─────────────────────────────────┘                  │
│                                                        │
│  1NF (each value in its own row):                      │
│  ┌─────────────────────────────────┐                  │
│  │ In Page: each tuple is independent│                 │
│  │ → Fast lookup via B-Tree index  │                  │
│  │ → WHERE phone = '090-1111-2222' │                  │
│  │   can be executed as index scan │                  │
│  └─────────────────────────────────┘                  │
└────────────────────────────────────────────────────────┘
```

### Code Example 2: Second Normal Form (2NF) — Eliminating Partial Functional Dependencies

```sql
-- Example in 1NF but not 2NF:
-- Order line items table
-- PK = (order_id, product_id)
-- ┌──────────┬────────────┬──────────────┬──────────┬───────┐
-- │ order_id │ product_id │ product_name │ quantity │ price │
-- └──────────┴────────────┴──────────────┴──────────┴───────┘
--   product_name depends only on product_id (partial functional dependency)
--
-- Functional dependency analysis:
--   {order_id, product_id} → quantity  (full functional dependency ✓)
--   {order_id, product_id} → price     (full functional dependency ✓)
--   product_id → product_name          (partial functional dependency ✗)

-- Second Normal Form (2NF): eliminate partial functional dependencies
CREATE TABLE products (
    product_id   INTEGER PRIMARY KEY,
    product_name VARCHAR(100)           -- depends only on product_id
);

CREATE TABLE order_items (
    order_id   INTEGER REFERENCES orders(id),
    product_id INTEGER REFERENCES products(product_id),
    quantity   INTEGER,
    price      DECIMAL(10,2),          -- price at time of order (snapshot)
    PRIMARY KEY (order_id, product_id)  -- depends on entire key
);

-- Requirements for 2NF:
-- 1. Satisfies 1NF
-- 2. No non-key attribute depends on only part of the primary key
--    (automatically satisfied if primary key is a single column)

-- Important note: price is correctly kept in order_items as an
-- order-time snapshot (distinct from the product's current price)
```

### Code Example 3: Third Normal Form (3NF) — Eliminating Transitive Functional Dependencies

```sql
-- Example in 2NF but not 3NF:
-- ┌────┬──────┬─────────────┬────────────────┐
-- │ id │ name │ dept_id     │ dept_name      │
-- └────┴──────┴─────────────┴────────────────┘
-- dept_name depends on dept_id, which depends on id
-- → dept_name transitively depends on id
--
-- Functional dependency analysis:
--   id → name     (direct dependency ✓)
--   id → dept_id  (direct dependency ✓)
--   dept_id → dept_name  (transitive dependency ✗)
--   ∴ id → dept_id → dept_name

-- Third Normal Form (3NF): eliminate transitive functional dependencies
CREATE TABLE departments (
    dept_id   INTEGER PRIMARY KEY,
    dept_name VARCHAR(100)
);

CREATE TABLE employees (
    id      INTEGER PRIMARY KEY,
    name    VARCHAR(100),
    dept_id INTEGER REFERENCES departments(dept_id)
);

-- Requirements for 3NF:
-- 1. Satisfies 2NF
-- 2. No non-key attribute depends on another non-key attribute
--    (no non-key → non-key functional dependencies)

-- Formal definition of 3NF (Codd's definition):
-- Table R is in 3NF if, for every non-trivial functional dependency X → A,
-- at least one of the following holds:
-- (a) X is a superkey
-- (b) A is a prime attribute (part of some candidate key)
```

### Diagram: Stages of Normalization

```
┌─────────────── Stages of Normalization ───────────────────┐
│                                                             │
│  Unnormalized Form                                          │
│    │  Eliminate repeating groups                            │
│    ▼                                                        │
│  First Normal Form (1NF)                                    │
│    │  Eliminate partial functional dependencies             │
│    ▼                                                        │
│  Second Normal Form (2NF)                                   │
│    │  Eliminate transitive functional dependencies          │
│    ▼                                                        │
│  Third Normal Form (3NF)  ← Typical target in practice     │
│    │  All non-trivial FDs depend on a candidate key         │
│    ▼                                                        │
│  Boyce-Codd Normal Form (BCNF)                              │
│    │  Eliminate multi-valued dependencies                   │
│    ▼                                                        │
│  Fourth Normal Form (4NF)                                   │
│    │  Eliminate join dependencies                           │
│    ▼                                                        │
│  Fifth Normal Form (5NF)                                    │
│    │  Eliminate domain-key constraints                      │
│    ▼                                                        │
│  Sixth Normal Form (6NF)  ← For temporal data              │
│                                                             │
│  Note: 3NF or BCNF is the practical upper limit in real use│
└─────────────────────────────────────────────────────────────┘
```

### Code Example 4: BCNF (Boyce-Codd Normal Form)

```sql
-- Example in 3NF but not BCNF:
-- Student course enrollment (a course can have multiple teachers,
--                            but each teacher teaches only one course)
-- PK = (student_id, course_id)
-- Functional dependency: teacher_id → course_id
--          (which course a teacher handles is uniquely determined)

-- In 3NF, teacher_id is non-key but determines course_id (part of the key)
-- → Violates BCNF

-- BCNF decomposition:
CREATE TABLE teacher_courses (
    teacher_id INTEGER PRIMARY KEY,
    course_id  INTEGER REFERENCES courses(id)
);

CREATE TABLE enrollments (
    student_id INTEGER REFERENCES students(id),
    teacher_id INTEGER REFERENCES teacher_courses(teacher_id),
    PRIMARY KEY (student_id, teacher_id)
);

-- Definition of BCNF:
-- For every non-trivial functional dependency X → Y, X must be a superkey.
--
-- Difference between 3NF and BCNF:
-- 3NF allows the exception "Y is a prime attribute"
-- BCNF requires "the determinant is always a superkey" with no exceptions

-- Note on BCNF:
-- Decomposing to BCNF may not preserve all original functional dependencies
-- (there are cases where dependency-preserving decomposition is impossible)
```

### Code Example 5: Practical Comparison of 3NF and BCNF

```sql
-- A more concrete example of BCNF violation: delivery scheduling
--
-- Assumptions:
-- 1. Multiple carriers can service each delivery area
-- 2. Each carrier services only one delivery area
-- 3. One carrier is assigned per order
--
-- Table: deliveries
-- PK = (order_id, area_id)
-- Functional dependencies:
--   {order_id, area_id} → carrier_id  (full functional dependency)
--   carrier_id → area_id              (carrier determines its area)
--
-- carrier_id is non-key but determines area_id (part of the key) → BCNF violation

-- 3NF (containing a BCNF violation)
CREATE TABLE deliveries_3nf (
    order_id   INTEGER,
    area_id    INTEGER,
    carrier_id INTEGER,
    PRIMARY KEY (order_id, area_id)
    -- carrier_id → area_id dependency is problematic
);

-- BCNF (after decomposition)
CREATE TABLE carrier_areas (
    carrier_id INTEGER PRIMARY KEY,
    area_id    INTEGER NOT NULL
);

CREATE TABLE order_carriers (
    order_id   INTEGER,
    carrier_id INTEGER REFERENCES carrier_areas(carrier_id),
    PRIMARY KEY (order_id, carrier_id)
);

-- Result of decomposition:
-- carrier_areas: carrier_id → area_id (carrier_id is the key ✓ BCNF)
-- order_carriers: candidate key = {order_id, carrier_id} (BCNF ✓)
```

---

## 3. Higher Normal Forms

### 3.1 Fourth Normal Form (4NF) — Eliminating Multi-Valued Dependencies

```sql
-- Example of 4NF violation:
-- An employee has multiple skills and multiple languages
-- Skills and languages are independent of each other

-- Table violating 4NF
CREATE TABLE emp_skills_languages_bad (
    emp_id   INTEGER,
    skill    VARCHAR(50),
    language VARCHAR(50),
    PRIMARY KEY (emp_id, skill, language)
);

-- Example data:
-- emp_id=1 has skills={Java, Python} and languages={Japanese, English}
INSERT INTO emp_skills_languages_bad VALUES
(1, 'Java',   'Japanese'),
(1, 'Java',   'English'),
(1, 'Python', 'Japanese'),
(1, 'Python', 'English');
-- → 2 × 2 = 4 rows (Cartesian product) required → redundant

-- Multi-valued dependency: emp_id →→ skill, emp_id →→ language
-- Even though skill and language are independent, a Cartesian product must be stored

-- 4NF (multi-valued dependencies eliminated)
CREATE TABLE emp_skills (
    emp_id INTEGER,
    skill  VARCHAR(50),
    PRIMARY KEY (emp_id, skill)
);

CREATE TABLE emp_languages (
    emp_id   INTEGER,
    language VARCHAR(50),
    PRIMARY KEY (emp_id, language)
);

INSERT INTO emp_skills VALUES (1, 'Java'), (1, 'Python');
INSERT INTO emp_languages VALUES (1, 'Japanese'), (1, 'English');
-- → Only 2 + 2 = 4 rows needed (vs. 4 rows for the Cartesian product in this case,
--   but savings grow with more skills/languages)

-- Definition of 4NF:
-- For every non-trivial multi-valued dependency X →→ Y, X must be a superkey.
```

### 3.2 Fifth Normal Form (5NF) — Eliminating Join Dependencies

```sql
-- Example of 5NF violation:
-- An agent purchases products from a supplier
-- But the three-way relationship cannot always be reconstructed from pairwise relationships

-- The following three pairwise relationships may hold:
-- Agent A buys from Supplier X
-- Supplier X provides Product P
-- Agent A handles Product P
-- → Even if all three hold, it does NOT necessarily follow that
--   "Agent A buys Product P from Supplier X" (join dependency)

CREATE TABLE supply_3way (
    agent_id    INTEGER,
    supplier_id INTEGER,
    product_id  INTEGER,
    PRIMARY KEY (agent_id, supplier_id, product_id)
);

-- In 5NF, a three-way relationship may not be decomposable
-- However, it can be decomposed if a business rule states:
-- "If an agent deals with a supplier, and that supplier carries a product
--   that the agent also handles, then the agent necessarily sources
--   that product through that supplier"
-- In that case, decomposition into three binary tables is possible

-- Definition of 5NF:
-- Every non-trivial join dependency is implied by the candidate keys
```

```
┌──────── Decision Flow for 4NF/5NF in Practice ──────────┐
│                                                            │
│  Q: Does the table have combinations of 3+ attributes?     │
│  │                                                        │
│  ├── No → 3NF/BCNF is sufficient                         │
│  │                                                        │
│  └── Yes                                                  │
│      │                                                    │
│      Q: Are there independent multi-valued relationships   │
│         between attributes?                               │
│      │                                                    │
│      ├── Yes → 4NF violation → split the table           │
│      │                                                    │
│      └── No                                               │
│          │                                                │
│          Q: Can the multi-way relationship be             │
│             reconstructed from pairwise relationships?    │
│          │                                                │
│          ├── Yes → 5NF decomposition is possible         │
│          │                                                │
│          └── No → Keep the multi-way table               │
└────────────────────────────────────────────────────────────┘
```

---

## 4. Denormalization

### 4.1 Criteria for Deciding to Denormalize

```
┌────────── Conditions That Warrant Considering Denormalization ──┐
│                                                                   │
│  1. Read/write ratio                                              │
│     Reads >>> Writes (100:1 or more)                             │
│     → Denormalization has a large impact                         │
│                                                                   │
│  2. Fixed query patterns                                          │
│     A specific JOIN pattern accounts for 80%+ of all queries     │
│     → Eliminate that JOIN through denormalization                 │
│                                                                   │
│  3. Latency requirements                                          │
│     JOIN-induced latency is unacceptable                         │
│     → First consider whether caching or MVs can address this     │
│                                                                   │
│  4. Data size                                                     │
│     Tables being JOINed have tens of millions of rows or more    │
│     → Consider partitioning first                                 │
│                                                                   │
│  Decision flow:                                                   │
│  Normalize → Add indexes → MV/Cache                              │
│  → Partition → Read replica                                       │
│  → Denormalize as a last resort                                   │
└───────────────────────────────────────────────────────────────────┘
```

### Code Example 6: Intentional Denormalization Patterns

```sql
-- Pattern 1: Computed columns (cached aggregate results)
ALTER TABLE orders ADD COLUMN item_count INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN total_amount DECIMAL(12,2) DEFAULT 0;

-- Automatically updated via trigger
CREATE OR REPLACE FUNCTION update_order_totals()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE orders SET
        item_count = (SELECT COUNT(*) FROM order_items WHERE order_id = NEW.order_id),
        total_amount = (SELECT SUM(price * quantity) FROM order_items WHERE order_id = NEW.order_id)
    WHERE id = NEW.order_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_order_totals
    AFTER INSERT OR UPDATE OR DELETE ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_order_totals();

-- Pattern 2: Materialized view
CREATE MATERIALIZED VIEW monthly_sales_summary AS
SELECT
    DATE_TRUNC('month', order_date) AS month,
    category,
    COUNT(*) AS order_count,
    SUM(total_amount) AS revenue
FROM orders o
    JOIN products p ON o.product_id = p.id
GROUP BY 1, 2;

-- Refresh periodically
REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_sales_summary;

-- Pattern 3: Adding denormalized columns
-- Redundantly store columns that are frequently JOINed
ALTER TABLE orders ADD COLUMN customer_name VARCHAR(200);
ALTER TABLE orders ADD COLUMN customer_email VARCHAR(255);

-- Maintain sync with customers table via trigger
CREATE OR REPLACE FUNCTION sync_customer_denorm()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'customers' THEN
        UPDATE orders SET
            customer_name = NEW.name,
            customer_email = NEW.email
        WHERE customer_id = NEW.id;
    ELSIF TG_TABLE_NAME = 'orders' THEN
        SELECT name, email INTO NEW.customer_name, NEW.customer_email
        FROM customers WHERE id = NEW.customer_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Pattern 4: Semi-structured data stored in JSONB
-- Embed related data that is frequently JOINed as JSONB
ALTER TABLE orders ADD COLUMN items_snapshot JSONB;

-- Create a snapshot when an order is finalized
UPDATE orders SET items_snapshot = (
    SELECT jsonb_agg(jsonb_build_object(
        'product_name', p.name,
        'quantity', oi.quantity,
        'price', oi.price
    ))
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = orders.id
)
WHERE id = 42;
```

### Code Example 7: Practical Comparison of Normalized vs. Denormalized

```sql
-- Normalized schema (3NF)
-- Retrieve order details by JOINing 6 tables
EXPLAIN ANALYZE
SELECT
    o.id, o.order_date,
    c.name AS customer, c.email,
    p.name AS product, p.sku,
    cat.name AS category,
    oi.quantity, oi.unit_price,
    a.city, a.postal_code
FROM orders o
    JOIN customers c ON o.customer_id = c.id
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    JOIN categories cat ON p.category_id = cat.id
    JOIN addresses a ON o.shipping_address_id = a.id
WHERE o.id = 42;
-- → Execution plan: 5 Nested Loop Joins, estimated 50ms

-- Denormalized schema (read-optimized)
-- Completed with a single table scan
EXPLAIN ANALYZE
SELECT
    order_id, order_date,
    customer_name, customer_email,
    product_name, product_sku,
    category_name,
    quantity, unit_price,
    shipping_city, shipping_postal_code
FROM order_details_denormalized
WHERE order_id = 42;
-- → Execution plan: Index Scan only, estimated 2ms

-- Middle-ground approach: materialized view
CREATE MATERIALIZED VIEW mv_order_details AS
SELECT
    o.id AS order_id, o.order_date,
    c.name AS customer_name, c.email AS customer_email,
    p.name AS product_name, p.sku AS product_sku,
    cat.name AS category_name,
    oi.quantity, oi.unit_price,
    a.city AS shipping_city, a.postal_code AS shipping_postal_code
FROM orders o
    JOIN customers c ON o.customer_id = c.id
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    JOIN categories cat ON p.category_id = cat.id
    JOIN addresses a ON o.shipping_address_id = a.id;

CREATE UNIQUE INDEX idx_mv_order_details_order_id ON mv_order_details(order_id);
-- → Fast reads, data updates controlled via REFRESH
```

### 4.2 Denormalization Feature Comparison Across RDBMS

```
┌──────── Denormalization Support Comparison Across RDBMS ────────┐
│                                                                    │
│  Feature               │ PG │ MySQL │ Oracle │ SS                 │
│  ──────────────────────┼────┼───────┼────────┼────                │
│  Materialized Views    │ ✓  │ ✗*    │ ✓      │ ✓                  │
│  GENERATED columns     │ ✓  │ ✓     │ ✓      │ ✓                  │
│  JSONB type            │ ✓  │ JSON  │ JSON   │ JSON               │
│  Array type            │ ✓  │ ✗     │ ✗      │ ✗                  │
│  Triggers              │ ✓  │ ✓     │ ✓      │ ✓                  │
│  Computed columns      │ ✓  │ ✓     │ ✓      │ ✓                  │
│  (STORED)              │    │       │        │                    │
│                                                                    │
│  PG = PostgreSQL, SS = SQL Server                                  │
│  * MySQL uses summary tables + events instead of MVs              │
└────────────────────────────────────────────────────────────────────┘
```

---

## 5. Impact of Normalization on the Query Optimizer

### 5.1 JOIN Execution Cost Model

```
┌──────── JOIN Algorithms and Their Relationship to Normalization ──┐
│                                                                     │
│  More normalization means more JOINs → impact on execution cost    │
│                                                                     │
│  Nested Loop Join:                                                  │
│  N rows in outer table × cost of lookup in inner table             │
│  → With an index: O(N * log M)                                     │
│  → Best for JOINs between small tables                             │
│                                                                     │
│  Hash Join:                                                         │
│  Build phase: O(N)  Probe phase: O(M)                              │
│  → Best for JOINs between large tables                             │
│  → Fast if work_mem is sufficient                                  │
│                                                                     │
│  Merge Join:                                                        │
│  Pre-sorted data: O(N + M)                                         │
│  → No sort needed if data is already ordered via an index          │
│                                                                     │
│  Conclusion:                                                        │
│  With appropriate indexes, the cost increase from additional JOINs  │
│  due to 3NF decomposition is usually within acceptable bounds      │
└─────────────────────────────────────────────────────────────────────┘
```

### Code Example 8: Optimizing JOINs on Normalized Tables

```sql
-- Even 3NF tables can be made fast with appropriate indexes
CREATE INDEX idx_employees_dept ON employees(department_id);
CREATE INDEX idx_departments_pk ON departments(dept_id);

-- The optimizer chooses Nested Loop + Index Scan
EXPLAIN ANALYZE
SELECT e.name, d.dept_name
FROM employees e
    JOIN departments d ON e.department_id = d.dept_id
WHERE e.salary > 500000;

-- Sample output:
-- Nested Loop  (actual time=0.030..0.150 rows=100 loops=1)
--   -> Index Scan using idx_emp_salary on employees e
--      Filter: (salary > 500000)
--      Rows Removed by Filter: 400
--   -> Index Scan using departments_pkey on departments d
--      Index Cond: (dept_id = e.department_id)
-- Execution Time: 0.200 ms
-- → Normalized tables can also be fast enough (with appropriate indexes)
```

---

## Normal Form Comparison Table

| Normal Form | Problem Eliminated | Condition | Practicality | Reversibility of Decomposition |
|-------------|-------------------|-----------|--------------|-------------------------------|
| 1NF | Repeating groups, non-atomic values | Each cell holds an atomic value | Required | — |
| 2NF | Partial functional dependencies | Non-key attributes depend on the full key | Required | Reversible (lossless) |
| 3NF | Transitive functional dependencies | No dependencies between non-key attributes | Recommended | Reversible (dependency-preserving) |
| BCNF | All non-trivial functional dependencies | Every determinant is a candidate key | Recommended | Reversible (may not preserve dependencies) |
| 4NF | Multi-valued dependencies | Separation of independent multi-valued relationships | Rare | Reversible (lossless) |
| 5NF | Join dependencies | Lossless-join decomposition | Very rare | Reversible |
| 6NF | No non-trivial join dependencies remain | Complete decomposition | Temporal DBs | Reversible |

## Normalization vs. Denormalization Comparison

| Aspect | Normalized | Denormalized |
|--------|------------|--------------|
| Data redundancy | None | Present |
| Update anomalies | None | Risk exists |
| Write performance | High | Low (multiple locations to update) |
| Read performance | Requires JOINs (somewhat lower) | High (single table) |
| Storage | Efficient | Redundant (larger) |
| Schema changes | Easy | Difficult |
| Data integrity | High | Must be maintained manually |
| Suitable workload | OLTP | OLAP / Reporting |
| Index design | Simple | Complex |
| Backup size | Small | Large |
| Transactions | Simple | Complex (multi-table updates) |

## RDBMS-Specific Normalization Feature Comparison

| Feature | PostgreSQL | MySQL (InnoDB) | Oracle | SQL Server |
|---------|-----------|----------------|--------|------------|
| CHECK constraints | Full support | 8.0.16+ | Full support | Full support |
| Foreign keys | Full support | Full support | Full support | Full support |
| Exclusion constraints | ✓ (EXCLUDE) | ✗ | ✗ | ✗ |
| GENERATED columns | ✓ (STORED) | ✓ (STORED/VIRTUAL) | ✓ (VIRTUAL) | ✓ (PERSISTED) |
| Array type | ✓ | ✗ | ✓ (VARRAY) | ✗ |
| JSON type | JSONB (binary) | JSON (text) | JSON (21c+) | JSON (2016+) |
| Partial indexes | ✓ | ✗ | ✗ (function-based) | ✓ (filtered) |
| Materialized views | ✓ | ✗ | ✓ (auto-refresh) | ✓ (indexed views) |

---

## Anti-Patterns

### Anti-Pattern 1: EAV (Entity-Attribute-Value) Pattern

```sql
-- NG: Generic but provides none of the benefits of normalization
CREATE TABLE entity_attributes (
    entity_id  INTEGER,
    attr_name  VARCHAR(100),
    attr_value TEXT,
    PRIMARY KEY (entity_id, attr_name)
);

-- Problems:
-- 1. No type safety (everything is TEXT)
-- 2. Cannot use constraints (NOT NULL, CHECK, etc.)
-- 3. Complex JOINs (self-JOINs per attribute)
-- 4. Inefficient queries
-- 5. Cannot use foreign key constraints
-- 6. Cannot use aggregate functions (SUM impossible on strings)

-- Difficulty of writing pivot queries with EAV:
SELECT
    e.entity_id,
    MAX(CASE WHEN ea.attr_name = 'name' THEN ea.attr_value END) AS name,
    MAX(CASE WHEN ea.attr_name = 'email' THEN ea.attr_value END) AS email,
    MAX(CASE WHEN ea.attr_name = 'age' THEN ea.attr_value END)::INTEGER AS age
FROM entities e
    LEFT JOIN entity_attributes ea ON e.id = ea.entity_id
GROUP BY e.entity_id;
-- → Query must be modified every time a new attribute is added

-- OK: Isolate schemaless portions using JSONB
CREATE TABLE products (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    attrs JSONB  -- variable attributes stored in JSONB
);

-- JSONB allows efficient search via GIN index
CREATE INDEX idx_products_attrs ON products USING GIN (attrs);

-- Search by specific attribute
SELECT * FROM products WHERE attrs @> '{"color": "red"}';

-- Check for attribute existence
SELECT * FROM products WHERE attrs ? 'weight';
```

### Anti-Pattern 2: Over-Normalization

```sql
-- NG: Splitting even prefectures and genders into separate tables
CREATE TABLE genders (id INT PRIMARY KEY, name VARCHAR(10));
CREATE TABLE prefectures (id INT PRIMARY KEY, name VARCHAR(10));
-- → More JOINs, more complex queries, degraded performance
-- → An extra JOIN just for a 47-row master table

-- OK: Small, rarely-changing master data is fine with ENUM or CHECK constraints
CREATE TABLE users (
    id       SERIAL PRIMARY KEY,
    gender   VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    prefecture VARCHAR(10) NOT NULL
);

-- Decision criteria:
-- Normalization is unnecessary if master data satisfies ALL of the following:
-- ✓ Small number of values (50 or fewer)
-- ✓ Extremely low rate of change
-- ✓ Has no additional attributes
-- ✓ Not referenced from other tables
```

### Anti-Pattern 3: Log Tables Without Intentional Design

```sql
-- NG: Storing redundant data chaotically in a log table
CREATE TABLE activity_logs (
    id         BIGSERIAL PRIMARY KEY,
    user_id    INTEGER,
    user_name  VARCHAR(100),   -- redundant with users table
    user_email VARCHAR(255),   -- redundant with users table
    action     VARCHAR(50),
    target_id  INTEGER,
    target_type VARCHAR(50),
    target_name VARCHAR(200),  -- redundant with target table
    ip_address INET,
    created_at TIMESTAMPTZ
);
-- → Inconsistency between past logs and users table when a username changes
-- → Storage grows rapidly

-- OK: Design log tables as point-in-time event snapshots
CREATE TABLE activity_logs (
    id         BIGSERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    action     VARCHAR(50) NOT NULL,
    target_id  INTEGER,
    target_type VARCHAR(50),
    -- Snapshot (intentional denormalization)
    snapshot   JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- snapshot records "the state at that point in time"
-- → A different design intent from normalized tables
-- → Satisfies audit and compliance requirements
```

---

## Edge Cases

### Edge Case 1: 1NF and PostgreSQL Array Types

```sql
-- PostgreSQL array types are technically a 1NF violation, but useful in practice
CREATE TABLE articles (
    id   SERIAL PRIMARY KEY,
    title VARCHAR(200),
    tags  TEXT[] NOT NULL DEFAULT '{}'
);

-- Efficient search via GIN index
CREATE INDEX idx_articles_tags ON articles USING GIN (tags);

-- Search by value within the array
SELECT * FROM articles WHERE tags @> ARRAY['SQL', 'Database'];

-- When to use array types:
-- ✓ Associating a set of values with a single entity
-- ✓ When values have no additional attributes (e.g., just tag names)
-- ✓ When the number of values is small (a few dozen or fewer)
-- ✗ Use normalization (join table) if values have their own attributes
-- ✗ Use normalization if values are references to other entities
```

### Edge Case 2: Time-Series Data and Normalization

```sql
-- Time-series data is challenging to normalize
-- Sensor data example: 1 row per second, 1 million rows/day

-- Pure normalization approach
CREATE TABLE sensors (
    sensor_id   SERIAL PRIMARY KEY,
    sensor_name VARCHAR(100),
    location    VARCHAR(200)
);

CREATE TABLE sensor_readings (
    sensor_id INTEGER REFERENCES sensors(sensor_id),
    ts        TIMESTAMPTZ NOT NULL,
    value     DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (sensor_id, ts)
);

-- Time-series DB approach (TimescaleDB: PostgreSQL extension)
-- Automatic partitioning via hypertable
-- SELECT create_hypertable('sensor_readings', 'ts');

-- Key points for normalizing time-series data:
-- 1. Metadata (sensor information) should be normalized
-- 2. Measurement values are stored in a time-series-optimized structure
-- 3. Aggregated results are stored in denormalized form (CAGG: continuous aggregates)
```

### Edge Case 3: Junction Tables with Additional Attributes

```sql
-- Normalization when a junction table has extra attributes
CREATE TABLE students (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(100)
);

CREATE TABLE courses (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(100)
);

-- Junction table with attributes
CREATE TABLE enrollments (
    student_id INTEGER REFERENCES students(id),
    course_id  INTEGER REFERENCES courses(id),
    grade      CHAR(2),         -- grade
    enrolled_at DATE,           -- enrollment date
    instructor VARCHAR(100),    -- assigned instructor
    PRIMARY KEY (student_id, course_id)
);

-- Problem: if instructor is functionally dependent on courses
-- course_id → instructor violates 3NF
-- → instructor should be moved to the courses table

-- However, if the same course has different instructors by semester,
-- {student_id, course_id} → instructor is a full functional dependency
-- → 3NF is satisfied (it is correct to keep instructor in the junction table)
```

---

## Exercises

### Exercise 1 (Basic): Applying 1NF through 3NF

Normalize the following unnormalized table up to 3NF.

```sql
-- Unnormalized table
CREATE TABLE orders_raw (
    order_id     INTEGER,
    order_date   DATE,
    customer_name VARCHAR(100),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(20),
    items        TEXT,  -- "Product A:3 units:1000 yen, Product B:1 unit:2000 yen"
    total_amount DECIMAL(10,2)
);
```

**Hint**: Identify all functional dependencies and decompose step by step.

<details>
<summary>Sample Solution</summary>

```sql
-- 1NF: Eliminate repeating groups
CREATE TABLE customers_1nf (
    customer_id   SERIAL PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    customer_email VARCHAR(255) UNIQUE NOT NULL,
    customer_phone VARCHAR(20)
);

CREATE TABLE orders_1nf (
    order_id     SERIAL PRIMARY KEY,
    order_date   DATE NOT NULL,
    customer_id  INTEGER NOT NULL,
    total_amount DECIMAL(10,2)
);

CREATE TABLE order_items_1nf (
    order_id      INTEGER,
    product_name  VARCHAR(200),
    quantity      INTEGER,
    unit_price    DECIMAL(10,2),
    PRIMARY KEY (order_id, product_name)
);

-- 2NF: Separate product_name from order_items_1nf into a products table
-- (when product_name depends only on product_id)
CREATE TABLE products_2nf (
    product_id   SERIAL PRIMARY KEY,
    product_name VARCHAR(200) NOT NULL
);

CREATE TABLE order_items_2nf (
    order_id   INTEGER,
    product_id INTEGER REFERENCES products_2nf(product_id),
    quantity   INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (order_id, product_id)
);

-- 3NF: phone/email in customers already directly depend on customer_id
-- total_amount can be computed from order_items, so it can be removed
-- (however, keeping it as intentional denormalization for performance is valid)
CREATE TABLE orders_3nf (
    order_id    SERIAL PRIMARY KEY,
    order_date  DATE NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customers_1nf(customer_id)
    -- total_amount either computed on the fly or kept as intentional denormalization
);
```
</details>

### Exercise 2 (Intermediate): BCNF Decomposition

Analyze the functional dependencies of the following table and decompose it into BCNF.

```sql
-- Classroom booking table
-- Assumptions:
-- 1. Each teacher teaches only one subject
-- 2. Each subject can be taught by multiple teachers
-- 3. Each room has only one class per time slot
CREATE TABLE classroom_bookings (
    room_id    INTEGER,
    time_slot  INTEGER,
    teacher_id INTEGER,
    subject    VARCHAR(100),
    PRIMARY KEY (room_id, time_slot)
);
```

**Hint**: The functional dependency `teacher_id → subject` causes the BCNF violation.

<details>
<summary>Sample Solution</summary>

```sql
-- Functional dependency analysis:
-- {room_id, time_slot} → teacher_id  (uniquely determined by the primary key)
-- {room_id, time_slot} → subject     (uniquely determined by the primary key)
-- teacher_id → subject               (each teacher handles only one subject)
--
-- teacher_id is not a subset of the primary key, but it determines subject
-- teacher_id is not a superkey → BCNF violation

-- BCNF decomposition:
CREATE TABLE teacher_subjects (
    teacher_id INTEGER PRIMARY KEY,
    subject    VARCHAR(100) NOT NULL
);

CREATE TABLE room_bookings (
    room_id    INTEGER,
    time_slot  INTEGER,
    teacher_id INTEGER REFERENCES teacher_subjects(teacher_id),
    PRIMARY KEY (room_id, time_slot)
);

-- Verification: every determinant of every functional dependency is a superkey
-- teacher_subjects: teacher_id → subject (teacher_id is PK = superkey ✓)
-- room_bookings: {room_id, time_slot} → teacher_id (PK is superkey ✓)
```
</details>

### Exercise 3 (Advanced): Design Decision for Denormalization

Based on the following requirements, design both a normalized and a denormalized schema, then analyze the trade-offs.

**Requirements**:
- A product review system for an e-commerce site
- Average rating and review count must be displayed on the product page (response within 1 second required)
- Review submissions, edits, and deletions occur approximately 10,000 times per day
- Product pages receive 1,000,000 page views per day
- Reviews have a "helpful" button (vote count must also be displayed)

<details>
<summary>Sample Solution</summary>

```sql
-- Normalized schema (3NF)
CREATE TABLE products (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL
);

CREATE TABLE reviews (
    id         SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    user_id    INTEGER NOT NULL REFERENCES users(id),
    rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title      VARCHAR(200),
    body       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, user_id)  -- one review per user per product
);

CREATE TABLE review_votes (
    review_id INTEGER REFERENCES reviews(id),
    user_id   INTEGER REFERENCES users(id),
    helpful   BOOLEAN NOT NULL,
    PRIMARY KEY (review_id, user_id)
);

-- Product page query (normalized version: heavy)
SELECT
    p.name,
    AVG(r.rating) AS avg_rating,
    COUNT(r.id) AS review_count,
    (SELECT COUNT(*) FROM review_votes rv WHERE rv.review_id = r.id AND rv.helpful)
        AS helpful_count
FROM products p
    LEFT JOIN reviews r ON r.product_id = p.id
WHERE p.id = 42
GROUP BY p.id, p.name;
-- → Aggregation becomes expensive as review count grows

-- Denormalized schema: cache aggregate results
ALTER TABLE products ADD COLUMN avg_rating DECIMAL(3,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN review_count INTEGER DEFAULT 0;
ALTER TABLE reviews ADD COLUMN helpful_count INTEGER DEFAULT 0;

-- Auto-update via trigger
CREATE OR REPLACE FUNCTION update_product_review_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products SET
        avg_rating = (SELECT AVG(rating) FROM reviews WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)),
        review_count = (SELECT COUNT(*) FROM reviews WHERE product_id = COALESCE(NEW.product_id, OLD.product_id))
    WHERE id = COALESCE(NEW.product_id, OLD.product_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_review_stats
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_product_review_stats();

-- Product page query (denormalized version: fast)
SELECT name, avg_rating, review_count
FROM products WHERE id = 42;
-- → Index Scan only, under 1ms

-- Trade-off analysis:
-- Reads: 1,000,000 PV/day → denormalization provides major speedup
-- Writes: 10,000/day → trigger overhead is acceptable
-- Verdict: Read/write ratio = 100:1 → denormalization is appropriate
```
</details>


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also write test code

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise on basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main data processing logic"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Retrieve processing results"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# Tests
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "Exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Pattern

Extend the basic implementation to add the following features.

```python
# Exercise 2: Advanced pattern
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise on advanced patterns"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """Add an item (with size limit)"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """Search by key"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """Delete by key"""
        for i, item in enumerate(self._items):
            if item['key'] == key:
                self._items.pop(i)
                return True
        return False

    def stats(self) -> Dict:
        """Statistics"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# Tests
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # size limit
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("All advanced tests passed!")

test_advanced()
```

### Exercise 3: Performance Optimization

Improve the performance of the following code.

```python
# Exercise 3: Performance optimization
import time
from functools import lru_cache

# Before optimization (O(n^2))
def slow_search(data: list, target: int) -> int:
    """Inefficient search"""
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[i] + data[j] == target:
                return (i, j)
    return (-1, -1)

# After optimization (O(n))
def fast_search(data: list, target: int) -> tuple:
    """Efficient search using a hash map"""
    seen = {}
    for i, num in enumerate(data):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (-1, -1)

# Benchmark
def benchmark():
    import random
    data = list(range(5000))
    random.shuffle(data)
    target = data[100] + data[4000]

    start = time.time()
    result1 = slow_search(data, target)
    slow_time = time.time() - start

    start = time.time()
    result2 = fast_search(data, target)
    fast_time = time.time() - start

    print(f"Slow version: {slow_time:.4f}s")
    print(f"Fast version: {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key points:**
- Be mindful of algorithmic complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | When to prioritize | When acceptable to compromise |
|------------|-------------------|-------------------------------|
| Performance | Real-time processing, large-scale data | Admin screens, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVPs, time-to-market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow             │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① What is the team size?                        │
│    ├─ Small (1-5 people) → Monolith              │
│    └─ Large (10+ people) → go to ②              │
│                                                 │
│  ② What is the deployment frequency?             │
│    ├─ Weekly or less → Monolith + modular split  │
│    └─ Daily / multiple times a day → go to ③    │
│                                                 │
│  ③ How independent are teams from each other?   │
│    ├─ High → Microservices                       │
│    └─ Moderate → Modular monolith                │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Every technical decision involves trade-offs. Analyze from the following perspectives:

**1. Short-term vs. long-term cost**
- A fast short-term solution can become technical debt in the long run
- Conversely, over-engineering increases short-term costs and can delay projects

**2. Consistency vs. flexibility**
- A unified tech stack has a lower learning curve
- Adopting diverse technologies enables the right tool for each job, but increases operational costs

**3. Level of abstraction**
- High abstraction improves reusability, but can make debugging harder
- Low abstraction is intuitive, but tends to lead to code duplication

```python
# Template for recording design decisions
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe the background and the problem"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision made"""
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
        md += f"## Background\n{self.context}\n\n"
        md += f"## Decision\n{self.decision}\n\n"
        md += "## Consequences\n"
        for c in self.consequences:
            icon = "✅" if c['type'] == 'positive' else "⚠️"
            md += f"- {icon} {c['description']}\n"
        md += "\n## Rejected Alternatives\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```
---

## FAQ

### Q1: Is normalizing up to 3NF sufficient?

For most production applications, 3NF is sufficient. Advancing to BCNF is limited to special situations where multiple candidate keys exist and a non-key attribute determines part of a key. Excessive normalization leads to more JOINs and degraded performance.

### Q2: When should you denormalize?

(1) When reads far outnumber writes, (2) when the cost of JOINs is unacceptably high, (3) for reporting/analytics use cases. However, always first consider whether a materialized view or a caching layer can address the issue. Denormalization is a last resort.

### Q3: Do array types or JSONB violate 1NF?

Strictly speaking under relational theory, yes — but PostgreSQL's array and JSONB types support indexing and are often useful in practice. Use them appropriately when the cost of splitting into a separate table is high, such as for tags or metadata.

### Q4: Is normalization unnecessary in NoSQL?

In NoSQL databases (MongoDB, DynamoDB, etc.), denormalization is the default design philosophy. Since there are no JOINs, data is redundantly embedded to match read patterns. This is not "normalization is unnecessary" — it is "a design that assumes denormalization," meaning that update consistency must be maintained at the application layer.

### Q5: Can the degree of normalization be changed via migration?

Yes, but a data migration is required. Increasing normalization (table splitting) is relatively safe, but denormalization (table merging) requires careful data integrity verification. For large-scale changes to normalization level, refer to the online migration techniques in [02-migration.md](./02-migration.md).

### Q6: How should the relationship between normalization and performance be measured?

Use `EXPLAIN ANALYZE` to inspect the execution plan and analyze JOIN execution costs (especially the choice between Hash Join and Nested Loop). Run load tests with production-scale data volumes and compare throughput and latency between normalized and denormalized versions. If the difference is not statistically significant, maintain normalization.

---

## Troubleshooting

### Common Normalization Problems and Solutions

| Problem | Cause | Solution |
|---------|-------|---------|
| Too many JOINs causing slowness | Over-normalization or missing indexes | Add indexes first; if still slow, consider materialized views |
| Slow writes | Trigger cascades from denormalization | Inspect trigger execution plans; consider async updates |
| Storage bloat | Data redundancy from denormalization | Archive old data with partitioning |
| Data inconsistency | Missed sync in denormalized tables | Verify trigger completeness; add constraints |
| Statistics mismatch | ANALYZE not run | Update statistics with `ANALYZE table_name` |
| Deadlocks | Circular updates from triggers | Unify trigger update order; review locking strategy |

---

## Security Considerations

### Normalization and Data Access Control

```sql
-- Row Level Security (RLS) is easier to apply with a normalized schema
-- When department and employee tables are separate,
-- access control per department becomes straightforward

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY emp_dept_policy ON employees
    USING (department_id IN (
        SELECT dept_id FROM user_dept_access
        WHERE user_id = current_setting('app.current_user_id')::INTEGER
    ));

-- With a denormalized table, RLS conditions can become more complex
-- → Security requirements should also be factored into normalization decisions
```

---

## Summary

| Item | Key Point |
|------|-----------|
| Purpose of normalization | Eliminate data redundancy and prevent update anomalies |
| Functional dependency | Foundation of normalization theory; distinguish full / partial / transitive dependencies |
| 1NF | Atomic values in each cell, no repeating groups |
| 2NF | Non-key attributes depend on the full key (eliminate partial functional dependencies) |
| 3NF | No dependencies between non-key attributes; the practical target |
| BCNF | Every determinant is a candidate key; may sacrifice dependency preservation |
| 4NF / 5NF | Eliminate multi-valued / join dependencies; rare in practice |
| Denormalization | Intentionally introduce redundancy for read performance; last resort |
| Decision criteria | OLTP → normalize; OLAP → consider denormalization |
| Implementation | Control denormalization with MVs, triggers, JSONB, etc. |

---

## Further Reading

- [01-schema-design.md](./01-schema-design.md) — Schema design including constraints and partitioning
- [03-data-modeling.md](./03-data-modeling.md) — Star and snowflake schemas
- [02-migration.md](./02-migration.md) — Migrations for normalization changes

---

## References

1. Codd, E.F. (1972). "Further Normalization of the Data Base Relational Model". *IBM Research Report*.
2. Date, C.J. (2019). *Database Design and Relational Theory*. O'Reilly Media.
3. Karwin, B. (2010). *SQL Antipatterns*. Chapter 15: Entity-Attribute-Value. Pragmatic Bookshelf.
4. Kent, W. (1983). "A Simple Guide to Five Normal Forms in Relational Database Theory". *Communications of the ACM*, 26(2), 120-125.
5. Bernstein, P.A. (1976). "Synthesizing Third Normal Form Relations from Functional Dependencies". *ACM TODS*, 1(4), 277-298.
6. PostgreSQL Documentation — "Data Definition" — https://www.postgresql.org/docs/current/ddl.html
7. Fagin, R. (1977). "Multivalued Dependencies and a New Normal Form for Relational Databases". *ACM TODS*, 2(3), 262-278.

# CTE / Recursive Queries — WITH Clause and Hierarchical Data

> A CTE (Common Table Expression) is a named temporary result set that breaks a query into logical blocks; recursive CTEs are a powerful SQL feature that enables traversal of tree structures and hierarchical data.

## Prerequisites

- Basic SQL syntax (SELECT, JOIN, WHERE, GROUP BY)
- Fundamental concepts of subqueries
- Understanding of table joins (INNER JOIN, LEFT JOIN)
- → It is recommended to read the SQL Basics guide first

## What You Will Learn in This Chapter

1. Basic CTE syntax and query structuring with non-recursive CTEs
2. How recursive CTEs work and how to design termination conditions
3. Practical patterns such as hierarchical data, graph traversal, and sequence generation
4. Internal execution mechanisms of CTEs and performance optimization
5. CTE implementation differences across DBMSs and portability considerations
6. Real-world use cases and step-by-step exercises

---

## 1. Non-Recursive CTE (WITH Clause)

### 1.1 What Is a CTE — Background and Motivation

CTEs were introduced in the SQL:1999 standard and allow complex queries to be split into logically named blocks. They dramatically improve readability and maintainability in situations where subquery nesting tends to grow deep.

Let's take a concrete look at the problem CTEs solve.

```
┌───────────────── Subquery Nesting Problem ─────────────────┐
│                                                             │
│  SELECT *                                                   │
│  FROM (                                                     │
│    SELECT *                                                 │
│    FROM (                                                   │
│      SELECT *                                               │
│      FROM (                                                 │
│        SELECT ... FROM table1                               │
│        WHERE ...                                            │
│      ) AS sub1                                              │
│      JOIN table2 ON ...                                     │
│    ) AS sub2                                                │
│    WHERE ...                                                │
│  ) AS sub3                                                  │
│  ORDER BY ...;                                              │
│                                                             │
│  Problems:                                                  │
│  · Deep nesting is hard to read                             │
│  · Cannot reuse the same subquery in two places (copy-paste)│
│  · Hard to partially execute during debugging               │
│                                                             │
│  Solution with CTE:                                         │
│  WITH sub1 AS (SELECT ... FROM table1 WHERE ...)            │
│     , sub2 AS (SELECT ... FROM sub1 JOIN table2 ON ...)     │
│     , sub3 AS (SELECT ... FROM sub2 WHERE ...)              │
│  SELECT * FROM sub3 ORDER BY ...;                           │
│                                                             │
│  Benefits:                                                  │
│  · Flat structure that reads top to bottom                  │
│  · The same CTE can be referenced multiple times            │
│  · Each CTE can be tested and debugged individually         │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Code Example 1: Basic CTE

```sql
-- Basic CTE syntax
WITH department_stats AS (
    SELECT
        department_id,
        COUNT(*) AS emp_count,
        AVG(salary) AS avg_salary,
        MAX(salary) AS max_salary
    FROM employees
    GROUP BY department_id
)
SELECT
    d.name AS department,
    ds.emp_count,
    ds.avg_salary,
    ds.max_salary
FROM department_stats ds
    INNER JOIN departments d ON d.id = ds.department_id
WHERE ds.avg_salary > 500000
ORDER BY ds.avg_salary DESC;

-- Chaining multiple CTEs
WITH
active_employees AS (
    SELECT * FROM employees WHERE status = 'active'
),
dept_summary AS (
    SELECT
        department_id,
        COUNT(*) AS cnt,
        AVG(salary) AS avg_sal
    FROM active_employees
    GROUP BY department_id
),
company_avg AS (
    SELECT AVG(avg_sal) AS overall_avg FROM dept_summary
)
SELECT
    d.name,
    ds.cnt,
    ds.avg_sal,
    ca.overall_avg,
    ds.avg_sal - ca.overall_avg AS diff
FROM dept_summary ds
    CROSS JOIN company_avg ca
    INNER JOIN departments d ON d.id = ds.department_id
ORDER BY diff DESC;
```

### 1.3 CTE Execution Flow

```
┌─────────────── CTE Execution Flow ─────────────────┐
│                                                     │
│  WITH                                               │
│    cte_1 AS (SELECT ...)   ← (1) Evaluated first    │
│    cte_2 AS (SELECT ... FROM cte_1)  ← (2) Next    │
│    cte_3 AS (SELECT ... FROM cte_2)  ← (3) Next    │
│  SELECT ... FROM cte_3     ← (4) Main query runs    │
│                                                     │
│  Notes:                                             │
│  - Each CTE is defined once; can be referenced      │
│    multiple times                                   │
│  - Can only reference earlier CTEs (no forward refs)│
│  - PostgreSQL 12+: may be inlined by the optimizer  │
│  - Controllable with MATERIALIZED / NOT MATERIALIZED│
└─────────────────────────────────────────────────────┘
```

### 1.4 Internal CTE Execution Mechanisms

There are two main ways a DBMS processes a CTE. Understanding this difference is the key to performance optimization.

```
┌──────────── CTE Internal Implementation Methods ──────────────┐
│                                                               │
│  Method 1: Materialization                                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Stores CTE result in a temporary work table             │  │
│  │ → Main query reads from the work table                  │  │
│  │                                                         │  │
│  │ Pros: Avoids re-computation on multiple references      │  │
│  │ Cons: Outer WHERE conditions are not propagated into     │  │
│  │       the CTE (no predicate pushdown)                   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  Method 2: Inlining                                           │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Expands the CTE as a subquery and optimizes the whole   │  │
│  │ → Optimizer generates the best plan holistically        │  │
│  │                                                         │  │
│  │ Pros: Predicate pushdown is possible                    │  │
│  │       Index usage can be optimized                      │  │
│  │ Cons: Re-computation cost on multiple references        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  Default behavior by DBMS:                                    │
│  · PostgreSQL 11 and earlier: always Materialization          │
│  · PostgreSQL 12+: optimizer decides automatically            │
│  · MySQL 8.0: optimizer decides automatically                 │
│  · SQL Server: always Inlining                                │
│  · Oracle: automatic (INLINE/MATERIALIZE hints available)     │
└───────────────────────────────────────────────────────────────┘
```

### 1.5 Code Example 2: When to Use MATERIALIZED / NOT MATERIALIZED

```sql
-- PostgreSQL 12+: explicit materialization control

-- (1) Explicitly materialize (useful for CTEs referenced multiple times)
WITH MATERIALIZED heavy_computation AS (
    SELECT
        customer_id,
        SUM(amount) AS total_spent,
        COUNT(DISTINCT product_id) AS unique_products,
        AVG(amount) AS avg_order
    FROM orders
    WHERE order_date >= CURRENT_DATE - INTERVAL '1 year'
    GROUP BY customer_id
)
SELECT hc.*, c.name, c.email
FROM heavy_computation hc
    JOIN customers c ON c.id = hc.customer_id
WHERE hc.total_spent > 100000
UNION ALL
SELECT hc.*, c.name, c.email
FROM heavy_computation hc  -- No re-computation on second reference
    JOIN customers c ON c.id = hc.customer_id
WHERE hc.unique_products > 50;

-- (2) Force inlining (expecting predicate pushdown for WHERE conditions)
WITH NOT MATERIALIZED filtered_orders AS (
    SELECT * FROM orders WHERE status = 'completed'
)
SELECT * FROM filtered_orders
WHERE customer_id = 42;
-- → Optimized as WHERE status = 'completed' AND customer_id = 42,
--   allowing the index on customer_id to be used

-- (3) How to check the execution plan
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
WITH department_stats AS (
    SELECT department_id, AVG(salary) AS avg_sal
    FROM employees
    GROUP BY department_id
)
SELECT * FROM department_stats WHERE avg_sal > 500000;
```

### 1.6 DML Operations Inside CTEs (PostgreSQL Extension)

In PostgreSQL, you can execute INSERT/UPDATE/DELETE inside a CTE and pass the results to subsequent queries via RETURNING. This is known as a "writable CTE" or "Data-Modifying CTE."

```sql
-- Example: Archive and delete old orders, then log the count of deleted rows
WITH deleted_orders AS (
    DELETE FROM orders
    WHERE order_date < CURRENT_DATE - INTERVAL '5 years'
    RETURNING *
),
archived AS (
    INSERT INTO orders_archive
    SELECT * FROM deleted_orders
    RETURNING order_id
)
SELECT COUNT(*) AS archived_count FROM archived;

-- Example: Use UPSERT results in a CTE
WITH upserted AS (
    INSERT INTO product_inventory (product_id, quantity)
    VALUES (101, 50)
    ON CONFLICT (product_id)
    DO UPDATE SET quantity = product_inventory.quantity + EXCLUDED.quantity
    RETURNING product_id, quantity
)
SELECT p.name, u.quantity
FROM upserted u JOIN products p ON p.id = u.product_id;
```

**Note**: Data-Modifying CTEs are a PostgreSQL-specific extension and are not part of the SQL standard. They are not available in MySQL, SQL Server, or Oracle.

---

## 2. Recursive CTE

### 2.1 Basic Structure of a Recursive CTE

```sql
-- Structure of a recursive CTE
WITH RECURSIVE cte_name AS (
    -- Base case (non-recursive term): generates the initial rows
    SELECT initial_columns
    FROM initial_table
    WHERE initial_condition

    UNION ALL  -- or UNION (to remove duplicates)

    -- Recursive case (recursive term): generates next rows using the previous result
    SELECT next_columns
    FROM cte_name  -- self-reference
        JOIN other_table ON ...
    WHERE termination_condition  -- termination condition
)
SELECT * FROM cte_name;
```

### 2.2 Recursive CTE Execution Model — Detailed Internal Behavior

Execution of a recursive CTE is an iterative process. Internally, two temporary tables are used: a "working table" and an "intermediate table."

```
┌──────────── Detailed Execution Steps of a Recursive CTE ──────────────┐
│                                                                        │
│  Initialization:                                                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 1. Execute the base case                                         │  │
│  │ 2. Store result in the "Working Table (WT)"                      │  │
│  │ 3. Also add the same result to the "Result Table (RT)"           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│       │                                                                │
│  Iteration loop (repeat until WT is empty):                            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 1. Execute the recursive term (using WT rows as input)           │  │
│  │ 2. Store result in the "Intermediate Table (IT)"                 │  │
│  │ 3. If IT is empty → end loop                                     │  │
│  │ 4. If IT is non-empty:                                           │  │
│  │    a. Add IT rows to RT                                          │  │
│  │    b. Replace WT contents with IT                                │  │
│  │    c. Clear IT                                                   │  │
│  │    d. Return to step 1                                           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│       │                                                                │
│  Completion:                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ All rows in RT are returned as the final result                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  Memory management:                                                    │
│  · WT holds only the previous iteration's result (full history         │
│    is not needed)                                                      │
│  · RT accumulates results from all iterations (all final rows)         │
│  · UNION ALL: rows are always added to RT unconditionally              │
│  · UNION: rows that already exist in RT are not added again            │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Step-by-Step Execution with a Concrete Example

```sql
-- Track internal behavior with sequence generation from 1 to 5
WITH RECURSIVE nums AS (
    SELECT 1 AS n        -- base case
    UNION ALL
    SELECT n + 1         -- recursive case
    FROM nums
    WHERE n < 5          -- termination condition
)
SELECT n FROM nums;
```

```
┌─── Step-by-Step Execution Trace ──────────────────┐
│                                                    │
│  Iteration 0 (base case):                          │
│    WT = {1}     RT = {1}                           │
│                                                    │
│  Iteration 1:                                      │
│    Input: WT = {1}                                 │
│    Recursive term: 1 + 1 = 2  (n=1 < 5 → OK)      │
│    IT = {2}                                        │
│    WT ← {2}    RT = {1, 2}                         │
│                                                    │
│  Iteration 2:                                      │
│    Input: WT = {2}                                 │
│    Recursive term: 2 + 1 = 3  (n=2 < 5 → OK)      │
│    IT = {3}                                        │
│    WT ← {3}    RT = {1, 2, 3}                      │
│                                                    │
│  Iteration 3:                                      │
│    Input: WT = {3}                                 │
│    Recursive term: 3 + 1 = 4  (n=3 < 5 → OK)      │
│    IT = {4}                                        │
│    WT ← {4}    RT = {1, 2, 3, 4}                   │
│                                                    │
│  Iteration 4:                                      │
│    Input: WT = {4}                                 │
│    Recursive term: 4 + 1 = 5  (n=4 < 5 → OK)      │
│    IT = {5}                                        │
│    WT ← {5}    RT = {1, 2, 3, 4, 5}                │
│                                                    │
│  Iteration 5:                                      │
│    Input: WT = {5}                                 │
│    Recursive term: 5 + 1 = 6  (n=5 < 5 → NG!)     │
│    IT = {} (empty)                                 │
│    → Loop ends                                     │
│                                                    │
│  Final result: RT = {1, 2, 3, 4, 5}               │
└────────────────────────────────────────────────────┘
```

### 2.4 UNION ALL vs UNION: Differences and When to Use Each

```sql
-- UNION ALL: allows duplicates (fast, the common choice)
WITH RECURSIVE tree AS (
    SELECT id, parent_id, name FROM nodes WHERE id = 1
    UNION ALL
    SELECT n.id, n.parent_id, n.name
    FROM nodes n JOIN tree t ON n.parent_id = t.id
)
SELECT * FROM tree;

-- UNION: removes duplicates (naturally terminates in cyclic graphs)
-- However, the cost of comparing entire rows is high
WITH RECURSIVE reachable AS (
    SELECT node_id FROM edges WHERE source = 'A'
    UNION  -- Already-reached nodes are not added → terminates naturally
    SELECT e.node_id
    FROM edges e JOIN reachable r ON e.source = r.node_id
)
SELECT * FROM reachable;
```

```
┌──── UNION ALL vs UNION Comparison ──────────────────┐
│                                                     │
│  UNION ALL:                                         │
│  · No duplicate check → fast                        │
│  · Risk of infinite loop in cyclic graphs           │
│  · Explicit termination condition required          │
│  · Use cases: tree structures (acyclic), sequences  │
│                                                     │
│  UNION:                                             │
│  · Duplicate check → slower (requires hash/sort)   │
│  · Skips already-seen rows → natural cycle guard    │
│  · Use cases: reachability analysis on directed     │
│    graphs                                           │
│                                                     │
│  Performance estimate (100k-row result set):        │
│  · UNION ALL: ~50ms                                 │
│  · UNION:     ~500ms (~10x slower)                  │
└─────────────────────────────────────────────────────┘
```

---

## 3. Practical Patterns for Recursive CTEs

### 3.1 Code Example 3: Organizational Hierarchy (Manager-Subordinate Relationships)

```sql
-- Traversing an organizational tree
CREATE TABLE org_chart (
    id         INTEGER PRIMARY KEY,
    name       VARCHAR(100),
    manager_id INTEGER REFERENCES org_chart(id),
    title      VARCHAR(100)
);

-- Sample data
INSERT INTO org_chart VALUES
    (1, 'Tanaka Taro', NULL, 'CEO'),
    (2, 'Suzuki Hanako', 1, 'CTO'),
    (3, 'Sato Jiro', 1, 'CFO'),
    (4, 'Takahashi Misaki', 2, 'VP Engineering'),
    (5, 'Ito Kenichi', 2, 'VP Product'),
    (6, 'Watanabe Mari', 4, 'Sr. Engineer'),
    (7, 'Yamamoto Daisuke', 4, 'Sr. Engineer'),
    (8, 'Nakamura Yuko', 6, 'Engineer');

-- Retrieve all managers above a specific employee (bottom-up)
WITH RECURSIVE management_chain AS (
    -- Base case: the starting employee
    SELECT id, name, manager_id, title, 0 AS depth
    FROM org_chart
    WHERE id = 42

    UNION ALL

    -- Recursive case: traverse up to the manager
    SELECT o.id, o.name, o.manager_id, o.title, mc.depth + 1
    FROM org_chart o
        INNER JOIN management_chain mc ON o.id = mc.manager_id
)
SELECT
    REPEAT('  ', depth) || name AS hierarchy,
    title,
    depth
FROM management_chain
ORDER BY depth;

-- Retrieve all employees under a department head (top-down)
WITH RECURSIVE subordinates AS (
    SELECT id, name, manager_id, title, 0 AS depth,
           ARRAY[name] AS path
    FROM org_chart
    WHERE id = 1  -- CEO

    UNION ALL

    SELECT o.id, o.name, o.manager_id, o.title, s.depth + 1,
           s.path || o.name
    FROM org_chart o
        INNER JOIN subordinates s ON o.manager_id = s.id
    WHERE s.depth < 10  -- prevent infinite recursion
)
SELECT
    REPEAT('  ', depth) || name AS tree,
    title,
    array_to_string(path, ' > ') AS full_path
FROM subordinates
ORDER BY path;
```

Sample output:

```
tree                    | title          | full_path
------------------------+----------------+----------------------------------
Tanaka Taro            | CEO            | Tanaka Taro
  Suzuki Hanako        | CTO            | Tanaka Taro > Suzuki Hanako
    Takahashi Misaki   | VP Engineering | Tanaka Taro > Suzuki Hanako > Takahashi Misaki
      Watanabe Mari    | Sr. Engineer   | Tanaka Taro > ... > Watanabe Mari
        Nakamura Yuko  | Engineer       | Tanaka Taro > ... > Nakamura Yuko
      Yamamoto Daisuke | Sr. Engineer   | Tanaka Taro > ... > Yamamoto Daisuke
    Ito Kenichi        | VP Product     | Tanaka Taro > Suzuki Hanako > Ito Kenichi
  Sato Jiro            | CFO            | Tanaka Taro > Sato Jiro
```

### 3.2 Code Example 4: Category Tree and Breadcrumb List

```sql
-- Hierarchical category structure
CREATE TABLE categories (
    id        INTEGER PRIMARY KEY,
    name      VARCHAR(100),
    parent_id INTEGER REFERENCES categories(id)
);

INSERT INTO categories VALUES
    (1, 'Electronics', NULL),
    (2, 'Computers', 1),
    (3, 'Laptops', 2),
    (4, '13-inch', 3),
    (5, '15-inch', 3),
    (6, 'Desktops', 2),
    (7, 'Smartphones', 1),
    (8, 'iPhone', 7),
    (9, 'Android', 7);

-- Generate a breadcrumb list (bottom-up)
WITH RECURSIVE breadcrumb AS (
    SELECT id, name, parent_id, name AS path, 0 AS depth
    FROM categories
    WHERE id = 4  -- current category: 13-inch

    UNION ALL

    SELECT c.id, c.name, c.parent_id,
           c.name || ' > ' || b.path,
           b.depth + 1
    FROM categories c
        INNER JOIN breadcrumb b ON c.id = b.parent_id
)
SELECT path
FROM breadcrumb
WHERE parent_id IS NULL;  -- result after traversing up to the root
-- → "Electronics > Computers > Laptops > 13-inch"

-- Generate breadcrumb lists for all categories at once (top-down)
WITH RECURSIVE category_tree AS (
    -- Root categories
    SELECT id, name, parent_id,
           name::TEXT AS breadcrumb,
           0 AS depth,
           ARRAY[id] AS id_path
    FROM categories
    WHERE parent_id IS NULL

    UNION ALL

    -- Child categories
    SELECT c.id, c.name, c.parent_id,
           ct.breadcrumb || ' > ' || c.name,
           ct.depth + 1,
           ct.id_path || c.id
    FROM categories c
        JOIN category_tree ct ON c.parent_id = ct.id
)
SELECT
    REPEAT('  ', depth) || name AS tree_view,
    breadcrumb,
    depth
FROM category_tree
ORDER BY id_path;

-- Count products in each category including all descendants
WITH RECURSIVE category_descendants AS (
    SELECT id, id AS root_id FROM categories
    UNION ALL
    SELECT c.id, cd.root_id
    FROM categories c
        JOIN category_descendants cd ON c.parent_id = cd.id
)
SELECT
    cat.name,
    COUNT(DISTINCT p.id) AS product_count
FROM category_descendants cd
    JOIN categories cat ON cat.id = cd.root_id
    LEFT JOIN products p ON p.category_id = cd.id
GROUP BY cat.id, cat.name
ORDER BY product_count DESC;
```

### 3.3 Code Example 5: Sequence Generation and Calendar

```sql
-- Generate numbers from 1 to 100
WITH RECURSIVE numbers AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM numbers WHERE n < 100
)
SELECT n FROM numbers;

-- Generate a date sequence (calendar)
WITH RECURSIVE calendar AS (
    SELECT DATE '2024-01-01' AS dt
    UNION ALL
    SELECT dt + INTERVAL '1 day'
    FROM calendar
    WHERE dt < '2024-12-31'
)
SELECT
    dt,
    EXTRACT(DOW FROM dt) AS day_of_week,
    TO_CHAR(dt, 'YYYY-MM') AS month
FROM calendar;

-- Note: In PostgreSQL, generate_series() is more efficient
SELECT generate_series('2024-01-01'::DATE, '2024-12-31'::DATE, '1 day') AS dt;

-- Practical example: Display daily revenue with zero-filling (including days with no data)
WITH RECURSIVE date_range AS (
    SELECT DATE '2024-01-01' AS dt
    UNION ALL
    SELECT dt + INTERVAL '1 day' FROM date_range WHERE dt < '2024-01-31'
)
SELECT
    dr.dt,
    COALESCE(SUM(o.amount), 0) AS daily_revenue,
    COUNT(o.id) AS order_count
FROM date_range dr
    LEFT JOIN orders o ON o.order_date = dr.dt
GROUP BY dr.dt
ORDER BY dr.dt;

-- Application: Generate time slots (booking system)
WITH RECURSIVE time_slots AS (
    SELECT TIME '09:00' AS slot_start, TIME '09:30' AS slot_end
    UNION ALL
    SELECT
        slot_start + INTERVAL '30 minutes',
        slot_end + INTERVAL '30 minutes'
    FROM time_slots
    WHERE slot_start < TIME '17:00'
)
SELECT
    ts.slot_start,
    ts.slot_end,
    CASE WHEN r.id IS NOT NULL THEN 'Booked' ELSE 'Available' END AS status
FROM time_slots ts
    LEFT JOIN reservations r
        ON r.start_time <= ts.slot_start AND r.end_time > ts.slot_start
ORDER BY ts.slot_start;
```

### 3.4 Code Example 6: Shortest Path in a Graph

```sql
-- Graph structure (train route map)
CREATE TABLE routes (
    from_station VARCHAR(50),
    to_station   VARCHAR(50),
    distance     INTEGER,
    line_name    VARCHAR(50)
);

INSERT INTO routes VALUES
    ('Tokyo', 'Shinagawa', 6, 'Tokaido Line'),
    ('Shinagawa', 'Yokohama', 22, 'Tokaido Line'),
    ('Tokyo', 'Ueno', 3, 'Yamanote Line'),
    ('Ueno', 'Omiya', 26, 'Keihin-Tohoku Line'),
    ('Tokyo', 'Shinjuku', 10, 'Chuo Line'),
    ('Shinjuku', 'Ikebukuro', 5, 'Yamanote Line'),
    ('Ikebukuro', 'Omiya', 30, 'Saikyo Line');

-- Shortest path from Tokyo to each station
WITH RECURSIVE shortest_path AS (
    SELECT
        from_station,
        to_station,
        distance,
        ARRAY[from_station, to_station] AS path,
        ARRAY[line_name] AS lines,
        1 AS hops
    FROM routes
    WHERE from_station = 'Tokyo'

    UNION ALL

    SELECT
        sp.from_station,
        r.to_station,
        sp.distance + r.distance,
        sp.path || r.to_station,
        sp.lines || r.line_name,
        sp.hops + 1
    FROM shortest_path sp
        INNER JOIN routes r ON sp.to_station = r.from_station
    WHERE NOT r.to_station = ANY(sp.path)  -- prevent cycles
      AND sp.hops < 10                     -- depth limit
)
SELECT DISTINCT ON (to_station)
    to_station,
    distance,
    array_to_string(path, ' → ') AS route,
    array_to_string(lines, ', ') AS via_lines,
    hops
FROM shortest_path
ORDER BY to_station, distance;
```

### 3.5 Code Example 7: BOM (Bill of Materials) Explosion

BOM (Bill of Materials) explosion, which is common in manufacturing, is a representative use case for recursive CTEs.

```sql
-- Bill of Materials table
CREATE TABLE bom (
    parent_part_id  INTEGER,
    child_part_id   INTEGER,
    quantity        DECIMAL(10,2),
    PRIMARY KEY (parent_part_id, child_part_id)
);

CREATE TABLE parts (
    id    INTEGER PRIMARY KEY,
    name  VARCHAR(100),
    unit_cost DECIMAL(10,2)
);

INSERT INTO parts VALUES
    (1, 'Bicycle', 0),
    (2, 'Frame', 15000),
    (3, 'Front Wheel', 5000),
    (4, 'Rear Wheel', 5000),
    (5, 'Tire', 2000),
    (6, 'Rim', 1500),
    (7, 'Spoke', 50),
    (8, 'Hub', 800);

INSERT INTO bom VALUES
    (1, 2, 1),    -- Bicycle = Frame x1
    (1, 3, 1),    -- Bicycle = Front Wheel x1
    (1, 4, 1),    -- Bicycle = Rear Wheel x1
    (3, 5, 1),    -- Front Wheel = Tire x1
    (3, 6, 1),    -- Front Wheel = Rim x1
    (3, 7, 36),   -- Front Wheel = Spoke x36
    (3, 8, 1),    -- Front Wheel = Hub x1
    (4, 5, 1),    -- Rear Wheel = Tire x1
    (4, 6, 1),    -- Rear Wheel = Rim x1
    (4, 7, 36),   -- Rear Wheel = Spoke x36
    (4, 8, 1);    -- Rear Wheel = Hub x1

-- BOM explosion: all parts, quantities, and costs for a bicycle
WITH RECURSIVE bom_explosion AS (
    -- Base case: top-level product
    SELECT
        b.parent_part_id,
        b.child_part_id,
        b.quantity,
        b.quantity AS total_quantity,
        1 AS level,
        ARRAY[b.parent_part_id, b.child_part_id] AS path
    FROM bom b
    WHERE b.parent_part_id = 1

    UNION ALL

    -- Recursive case: further expand child parts
    SELECT
        b.parent_part_id,
        b.child_part_id,
        b.quantity,
        be.total_quantity * b.quantity,  -- cumulative quantity
        be.level + 1,
        be.path || b.child_part_id
    FROM bom b
        JOIN bom_explosion be ON b.parent_part_id = be.child_part_id
    WHERE be.level < 10
)
SELECT
    REPEAT('  ', be.level - 1) || p.name AS part_tree,
    be.total_quantity,
    p.unit_cost,
    be.total_quantity * p.unit_cost AS total_cost,
    be.level
FROM bom_explosion be
    JOIN parts p ON p.id = be.child_part_id
ORDER BY be.path;
```

### 3.6 Code Example 8: Recursive String Splitting (Parser)

```sql
-- Split a comma-delimited string into rows (implemented with a recursive CTE)
WITH RECURSIVE split_string AS (
    SELECT
        1 AS idx,
        CASE
            WHEN POSITION(',' IN 'apple,banana,cherry,date') > 0
            THEN LEFT('apple,banana,cherry,date', POSITION(',' IN 'apple,banana,cherry,date') - 1)
            ELSE 'apple,banana,cherry,date'
        END AS token,
        CASE
            WHEN POSITION(',' IN 'apple,banana,cherry,date') > 0
            THEN SUBSTRING('apple,banana,cherry,date' FROM POSITION(',' IN 'apple,banana,cherry,date') + 1)
            ELSE ''
        END AS remainder

    UNION ALL

    SELECT
        idx + 1,
        CASE
            WHEN POSITION(',' IN remainder) > 0
            THEN LEFT(remainder, POSITION(',' IN remainder) - 1)
            ELSE remainder
        END,
        CASE
            WHEN POSITION(',' IN remainder) > 0
            THEN SUBSTRING(remainder FROM POSITION(',' IN remainder) + 1)
            ELSE ''
        END
    FROM split_string
    WHERE remainder <> ''
)
SELECT idx, token FROM split_string;
-- Result:
-- idx | token
-- ----+--------
--   1 | apple
--   2 | banana
--   3 | cherry
--   4 | date

-- Note: In PostgreSQL/MySQL 8.0+, string_to_table() or regexp_split_to_table() is more efficient
SELECT unnest(string_to_array('apple,banana,cherry,date', ',')) AS token;
```

### 3.7 Code Example 9: Fibonacci Sequence and Mathematical Recurrences

```sql
-- Generate the Fibonacci sequence
WITH RECURSIVE fibonacci AS (
    SELECT 1 AS n, 1::BIGINT AS fib, 0::BIGINT AS prev_fib

    UNION ALL

    SELECT
        n + 1,
        fib + prev_fib,  -- F(n) = F(n-1) + F(n-2)
        fib
    FROM fibonacci
    WHERE n < 50
)
SELECT n, fib FROM fibonacci;

-- Calculate factorials
WITH RECURSIVE factorial AS (
    SELECT 1 AS n, 1::BIGINT AS fact
    UNION ALL
    SELECT n + 1, (n + 1) * fact
    FROM factorial
    WHERE n < 20
)
SELECT n, fact FROM factorial;

-- Compound interest calculation (5% annual rate, 30 years)
WITH RECURSIVE compound_interest AS (
    SELECT
        0 AS year,
        1000000.00::DECIMAL(15,2) AS principal,
        0.00::DECIMAL(15,2) AS interest_earned
    UNION ALL
    SELECT
        year + 1,
        (principal * 1.05)::DECIMAL(15,2),
        (principal * 1.05 - 1000000)::DECIMAL(15,2)
    FROM compound_interest
    WHERE year < 30
)
SELECT year, principal, interest_earned
FROM compound_interest;
```

---

## 4. CTE Support and Syntax Differences Across DBMSs

### 4.1 Compatibility Comparison Table

| Feature | PostgreSQL | MySQL 8.0+ | SQL Server | Oracle | SQLite |
|---------|-----------|------------|------------|--------|--------|
| Non-recursive CTE | 8.4+ | 8.0+ | 2005+ | 9i R2+ | 3.8.3+ |
| Recursive CTE | 8.4+ | 8.0+ | 2005+ | 11g R2+ | 3.8.3+ |
| RECURSIVE keyword | Required | Required | Not needed | Not needed | Required |
| MATERIALIZED hint | 12+ | 8.0+ | N/A | INLINE hint | N/A |
| Data-Modifying CTE | Supported | Not supported | Supported | Not supported | Not supported |
| Default max recursion depth | Unlimited | 1000 | 100 | Unlimited | 1000 |
| Depth control method | statement_timeout | cte_max_recursion_depth | MAXRECURSION | Manual | Manual |
| CYCLE detection (SQL:2011) | 14+ | Not supported | Not supported | Not supported | Not supported |
| SEARCH clause (SQL:2011) | 14+ | Not supported | Not supported | Not supported | Not supported |

### 4.2 Syntax Examples by DBMS

```sql
-- PostgreSQL: WITH RECURSIVE is required
WITH RECURSIVE tree AS (
    SELECT id, parent_id, name, 0 AS depth FROM nodes WHERE parent_id IS NULL
    UNION ALL
    SELECT n.id, n.parent_id, n.name, t.depth + 1
    FROM nodes n JOIN tree t ON n.parent_id = t.id
)
SELECT * FROM tree;

-- SQL Server: RECURSIVE keyword is not needed; control with MAXRECURSION
WITH tree AS (
    SELECT id, parent_id, name, 0 AS depth FROM nodes WHERE parent_id IS NULL
    UNION ALL
    SELECT n.id, n.parent_id, n.name, t.depth + 1
    FROM nodes n JOIN tree t ON n.parent_id = t.id
)
SELECT * FROM tree
OPTION (MAXRECURSION 200);  -- Raise the default of 100

-- MySQL 8.0: WITH RECURSIVE is required; max depth is a system variable
SET SESSION cte_max_recursion_depth = 5000;
WITH RECURSIVE tree AS (
    SELECT id, parent_id, name, 0 AS depth FROM nodes WHERE parent_id IS NULL
    UNION ALL
    SELECT n.id, n.parent_id, n.name, t.depth + 1
    FROM nodes n JOIN tree t ON n.parent_id = t.id
)
SELECT * FROM tree;

-- Oracle: RECURSIVE not needed; CONNECT BY is also available (legacy)
-- CTE style (recommended)
WITH tree (id, parent_id, name, depth) AS (
    SELECT id, parent_id, name, 0 FROM nodes WHERE parent_id IS NULL
    UNION ALL
    SELECT n.id, n.parent_id, n.name, t.depth + 1
    FROM nodes n JOIN tree t ON n.parent_id = t.id
)
SELECT * FROM tree;

-- CONNECT BY style (Oracle-specific, legacy)
SELECT
    id, parent_id, name,
    LEVEL - 1 AS depth,
    SYS_CONNECT_BY_PATH(name, '/') AS path
FROM nodes
START WITH parent_id IS NULL
CONNECT BY PRIOR id = parent_id
ORDER SIBLINGS BY name;
```

### 4.3 PostgreSQL 14+ CYCLE / SEARCH Clauses

In PostgreSQL 14, the SQL:2011 standard CYCLE clause and SEARCH clause were implemented. These allow cycle detection and traversal order control to be expressed declaratively.

```sql
-- CYCLE clause: declare cycle detection declaratively
WITH RECURSIVE graph_search AS (
    SELECT id, linked_id, name FROM graph WHERE id = 1
    UNION ALL
    SELECT g.id, g.linked_id, g.name
    FROM graph g JOIN graph_search gs ON g.id = gs.linked_id
)
CYCLE id SET is_cycle USING path  -- cycle detection
SELECT * FROM graph_search WHERE NOT is_cycle;

-- SEARCH clause: control traversal order
-- Depth-first search (DFS)
WITH RECURSIVE tree AS (
    SELECT id, parent_id, name FROM nodes WHERE parent_id IS NULL
    UNION ALL
    SELECT n.id, n.parent_id, n.name
    FROM nodes n JOIN tree t ON n.parent_id = t.id
)
SEARCH DEPTH FIRST BY id SET ordercol
SELECT * FROM tree ORDER BY ordercol;

-- Breadth-first search (BFS)
WITH RECURSIVE tree AS (
    SELECT id, parent_id, name FROM nodes WHERE parent_id IS NULL
    UNION ALL
    SELECT n.id, n.parent_id, n.name
    FROM nodes n JOIN tree t ON n.parent_id = t.id
)
SEARCH BREADTH FIRST BY id SET ordercol
SELECT * FROM tree ORDER BY ordercol;
```

---

## 5. CTE vs Subquery vs View vs Temporary Table Comparison

| Feature | CTE (WITH) | Subquery | View | Temporary Table |
|---------|-----------|----------|------|----------------|
| Reusability | Multiple times within a query | Once only | Available across all queries | During the session |
| Recursion | Possible | Not possible | Not possible | Replaced with manual loop |
| Persistence | Only during query execution | Only during query execution | Persistent | During the session |
| Readability | High | Low (deep nesting) | High | High |
| Performance | Can be inlined | Inlined | Expanded each time | Can create indexes |
| Updatable | No (except PG extension) | No | Conditionally yes | Yes |
| No CREATE needed | Yes | Yes | No | No |
| Indexes | Not possible | Not possible | Depends on base table | Can be created |
| Statistics | None | None | Depends on base table | ANALYZE possible |

### Selection Guidelines

```
┌──── CTE / Subquery / View / Temporary Table Selection Flowchart ────┐
│                                                                     │
│  Q1: Is recursive traversal required?                               │
│  → Yes: Recursive CTE                                               │
│  → No: Go to Q2                                                     │
│                                                                     │
│  Q2: Will the same result set be used across multiple queries?      │
│  → Yes:                                                             │
│    Q3: Is performance critical and do you need indexes?             │
│    → Yes: Temporary table                                           │
│    → No: View (consider materialized view if used frequently)       │
│  → No: Go to Q4                                                     │
│                                                                     │
│  Q4: Is it referenced two or more times within the same query?      │
│  → Yes: CTE (consider MATERIALIZED hint)                            │
│  → No: Go to Q5                                                     │
│                                                                     │
│  Q5: Is the query deeply nested and hard to read?                   │
│  → Yes: CTE                                                         │
│  → No: Subquery (gives the optimizer maximum freedom)               │
└─────────────────────────────────────────────────────────────────────┘
```

## Recursive CTE Comparison Table: Recommended vs Not Recommended

| Item | Recommended | Not Recommended |
|------|-------------|-----------------|
| Termination condition | WHERE depth < 100 | None (infinite loop) |
| Cycle detection | ARRAY + ANY to track path | No detection |
| Join method | UNION ALL (fast) | UNION (deduplication, slow) |
| Depth limit | Set explicitly | Rely on implicit DB default |
| Data types | Explicit CAST in base case | Implicit type inference |
| Path tracking | Record path in an ARRAY column | No path recording |
| Aggregate functions | Execute outside the CTE | Aggregation in recursive term (prohibited) |
| Subqueries | Execute outside the CTE | Subqueries in recursive term (not recommended) |

---

## 6. Performance Optimization

### 6.1 Performance Characteristics of Recursive CTEs

```
┌──── Cost Structure of Recursive CTEs ──────────────────────┐
│                                                            │
│  Total cost = base case cost                               │
│             + Σ(cost of each iteration)                    │
│             + cost of processing the final result          │
│                                                            │
│  Cost factors per iteration:                               │
│  · Scan of the working table                               │
│  · JOIN execution (whether indexes apply is key)           │
│  · UNION ALL / UNION processing                            │
│  · ARRAY operations (when tracking paths)                  │
│                                                            │
│  Optimization points:                                      │
│  · Create indexes on JOIN columns                          │
│  · Minimize the base case result set                       │
│  · Do not carry unnecessary columns through the recursion  │
│  · Use depth limits to cut off unnecessary traversal early │
└────────────────────────────────────────────────────────────┘
```

### 6.2 Index Strategy

```sql
-- For hierarchical data: index on parent_id and id pair
CREATE INDEX idx_org_chart_manager ON org_chart (manager_id);
CREATE INDEX idx_categories_parent ON categories (parent_id);
CREATE INDEX idx_bom_parent ON bom (parent_part_id);

-- For graph data: both start and end nodes
CREATE INDEX idx_routes_from ON routes (from_station);
CREATE INDEX idx_routes_to ON routes (to_station);

-- Check the execution plan
EXPLAIN (ANALYZE, BUFFERS)
WITH RECURSIVE subordinates AS (
    SELECT id, manager_id FROM org_chart WHERE id = 1
    UNION ALL
    SELECT o.id, o.manager_id
    FROM org_chart o JOIN subordinates s ON o.manager_id = s.id
)
SELECT * FROM subordinates;
-- Verify that an Index Scan appears below the CTE Scan
```

### 6.3 Optimization Techniques for Large Datasets

```sql
-- Technique 1: Dynamic depth control for recursion
-- Terminate early by exploring only the required depth
WITH RECURSIVE tree AS (
    SELECT id, parent_id, name, 0 AS depth FROM nodes WHERE id = 1
    UNION ALL
    SELECT n.id, n.parent_id, n.name, t.depth + 1
    FROM nodes n JOIN tree t ON n.parent_id = t.id
    WHERE t.depth < 3  -- limit to 3 levels
)
SELECT * FROM tree;

-- Technique 2: Carry only the necessary columns
-- Bad: carry all columns through the recursion (high memory usage)
WITH RECURSIVE tree AS (
    SELECT * FROM large_table WHERE id = 1  -- all columns
    UNION ALL
    SELECT lt.* FROM large_table lt JOIN tree t ON lt.parent_id = t.id
)
SELECT * FROM tree;

-- Good: recurse only on IDs, then JOIN to get all columns at the end
WITH RECURSIVE tree_ids AS (
    SELECT id FROM large_table WHERE id = 1  -- IDs only
    UNION ALL
    SELECT lt.id FROM large_table lt JOIN tree_ids t ON lt.parent_id = t.id
)
SELECT lt.* FROM large_table lt JOIN tree_ids ti ON lt.id = ti.id;

-- Technique 3: Closure Table pattern (alternative to recursive CTE)
-- For cases where hierarchical queries are executed frequently,
-- build a Closure Table in advance
CREATE TABLE category_closure (
    ancestor_id   INTEGER,
    descendant_id INTEGER,
    depth         INTEGER,
    PRIMARY KEY (ancestor_id, descendant_id)
);

-- Build the Closure Table (run once only)
WITH RECURSIVE tree AS (
    SELECT id AS ancestor_id, id AS descendant_id, 0 AS depth
    FROM categories
    UNION ALL
    SELECT t.ancestor_id, c.id, t.depth + 1
    FROM tree t JOIN categories c ON c.parent_id = t.descendant_id
)
INSERT INTO category_closure
SELECT * FROM tree;

-- With the Closure Table, descendants can be retrieved without recursion
SELECT c.* FROM categories c
    JOIN category_closure cc ON c.id = cc.descendant_id
WHERE cc.ancestor_id = 1 AND cc.depth <= 3;
```

### 6.4 Comparison of Hierarchical Data Management Approaches

| Method | Query Speed | INSERT Speed | DELETE Speed | Storage | Implementation Complexity |
|--------|------------|-------------|-------------|---------|--------------------------|
| Adjacency List + Recursive CTE | Medium | Fast | Fast | Minimum | Low |
| Closure Table | Fast | Medium (requires table update) | Slow (requires table update) | Large | Medium |
| Nested Set Model | Fast | Slow (requires renumbering) | Slow (requires renumbering) | Small | High |
| Materialized Path | Fast | Fast | Fast | Medium | Medium |
| ltree (PostgreSQL) | Fast | Fast | Fast | Medium | Low |

---

## 7. Edge Cases and Pitfalls

### 7.1 Edge Case 1: Base Case Returns Zero Rows

```sql
-- Base case returns no match → recursion is not executed; empty result
WITH RECURSIVE tree AS (
    SELECT id, parent_id FROM nodes WHERE id = 99999  -- non-existent ID
    UNION ALL
    SELECT n.id, n.parent_id FROM nodes n JOIN tree t ON n.parent_id = t.id
)
SELECT * FROM tree;
-- → 0 rows (no error)

-- Countermeasure: use COALESCE or default values to handle empty results
SELECT COALESCE(
    (SELECT COUNT(*) FROM tree WHERE depth <= 5),
    0
) AS descendant_count;
```

### 7.2 Edge Case 2: Data Type Mismatch

```sql
-- Bad: data types differ between the base case and recursive case
WITH RECURSIVE path AS (
    SELECT id, name FROM nodes WHERE id = 1  -- name: VARCHAR(100)
    UNION ALL
    SELECT n.id, p.name || ' > ' || n.name   -- concatenation makes length indeterminate
    FROM nodes n JOIN path p ON n.parent_id = p.id
)
SELECT * FROM path;
-- → String may exceed VARCHAR(100) at deep levels

-- Good: explicit CAST
WITH RECURSIVE path AS (
    SELECT id, name::TEXT AS path_string FROM nodes WHERE id = 1
    UNION ALL
    SELECT n.id, (p.path_string || ' > ' || n.name)::TEXT
    FROM nodes n JOIN path p ON n.parent_id = p.id
)
SELECT * FROM path;
```

### 7.3 Edge Case 3: Hierarchy Containing NULL Values

```sql
-- Nodes with parent_id = NULL are root nodes
-- However, NULL comparisons require IS NULL
-- Bad: NULL = NULL is FALSE, so joins fail
SELECT * FROM nodes n1 JOIN nodes n2 ON n1.parent_id = n2.id;
-- Rows with parent_id = NULL are not joined (correct behavior, but be aware)

-- Detecting root nodes
WITH RECURSIVE tree AS (
    SELECT id, parent_id, name, 0 AS depth
    FROM nodes
    WHERE parent_id IS NULL  -- root condition

    UNION ALL

    SELECT n.id, n.parent_id, n.name, t.depth + 1
    FROM nodes n JOIN tree t ON n.parent_id = t.id
    WHERE t.depth < 100
)
SELECT * FROM tree;

-- Detecting orphan nodes (parent_id is not NULL but the parent does not exist)
SELECT n.*
FROM nodes n
    LEFT JOIN nodes parent ON n.parent_id = parent.id
WHERE n.parent_id IS NOT NULL AND parent.id IS NULL;
```

### 7.4 Edge Case 4: Multiple Root Nodes

```sql
-- When an organization has multiple roots (e.g., each CEO of a group company)
WITH RECURSIVE full_tree AS (
    -- Start from all roots
    SELECT id, name, manager_id, 0 AS depth, id AS root_id
    FROM org_chart
    WHERE manager_id IS NULL

    UNION ALL

    SELECT o.id, o.name, o.manager_id, ft.depth + 1, ft.root_id
    FROM org_chart o JOIN full_tree ft ON o.manager_id = ft.id
)
SELECT
    root_id,
    REPEAT('  ', depth) || name AS tree,
    depth
FROM full_tree
ORDER BY root_id, depth, name;
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Recursive CTE Without a Termination Condition

```sql
-- Bad: infinite recursion (DB hangs)
WITH RECURSIVE infinite AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM infinite  -- no termination condition!
)
SELECT * FROM infinite;

-- Good: make the termination condition explicit
WITH RECURSIVE safe AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM safe WHERE n < 1000  -- explicit upper limit
)
SELECT * FROM safe;

-- Safety measure: set statement_timeout in PostgreSQL
SET statement_timeout = '5s';

-- MySQL: set the maximum recursion depth
SET SESSION cte_max_recursion_depth = 5000;

-- SQL Server: specify OPTION (MAXRECURSION N)
-- OPTION (MAXRECURSION 0) means unlimited (dangerous, avoid in production)
```

### Anti-Pattern 2: Unnecessary CTE Materialization

```sql
-- Bad (default behavior in PostgreSQL 11 and earlier): CTEs are always materialized
WITH expensive_cte AS (
    SELECT * FROM huge_table WHERE category = 'A'
)
SELECT * FROM expensive_cte WHERE id = 42;
-- → Materializes all rows with category='A' from huge_table, then filters by id=42

-- Good (PostgreSQL 12+): force inlining with NOT MATERIALIZED
WITH expensive_cte AS NOT MATERIALIZED (
    SELECT * FROM huge_table WHERE category = 'A'
)
SELECT * FROM expensive_cte WHERE id = 42;
-- → Optimized as WHERE category = 'A' AND id = 42
```

### Anti-Pattern 3: Using Aggregate Functions in the Recursive Term

```sql
-- Bad: SUM/COUNT/AVG etc. cannot be used in the recursive term (SQL error)
WITH RECURSIVE running_total AS (
    SELECT id, amount, amount AS total FROM orders WHERE id = 1
    UNION ALL
    SELECT o.id, o.amount, SUM(o.amount) OVER ()  -- Error!
    FROM orders o JOIN running_total rt ON o.id = rt.id + 1
)
SELECT * FROM running_total;

-- Good: perform aggregation outside the CTE
WITH RECURSIVE order_chain AS (
    SELECT id, amount FROM orders WHERE id = 1
    UNION ALL
    SELECT o.id, o.amount
    FROM orders o JOIN order_chain oc ON o.id = oc.id + 1
    WHERE o.id <= 100
)
SELECT id, amount, SUM(amount) OVER (ORDER BY id) AS running_total
FROM order_chain;
```

### Anti-Pattern 4: Overusing Recursive CTEs

```sql
-- Bad: using a recursive CTE for simple sequence generation (PostgreSQL)
WITH RECURSIVE nums AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM nums WHERE n < 10000
)
SELECT n FROM nums;

-- Good: use generate_series() instead (far faster)
SELECT generate_series(1, 10000) AS n;

-- Bad: using a recursive CTE for calendar generation (PostgreSQL)
WITH RECURSIVE dates AS (
    SELECT CURRENT_DATE AS dt
    UNION ALL
    SELECT dt + 1 FROM dates WHERE dt < CURRENT_DATE + 365
)
SELECT dt FROM dates;

-- Good: use generate_series() instead
SELECT generate_series(
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '365 days',
    INTERVAL '1 day'
)::DATE AS dt;
```

---

## 9. Exercises

### Exercise 1: Employee Management Hierarchy (Basic)

The following table is given.

```sql
CREATE TABLE employees_ex (
    id         INTEGER PRIMARY KEY,
    name       VARCHAR(100),
    manager_id INTEGER,
    salary     INTEGER
);

INSERT INTO employees_ex VALUES
    (1, 'Alice', NULL, 1000000),
    (2, 'Bob', 1, 800000),
    (3, 'Charlie', 1, 750000),
    (4, 'David', 2, 600000),
    (5, 'Eve', 2, 650000),
    (6, 'Frank', 3, 500000),
    (7, 'Grace', 4, 450000),
    (8, 'Heidi', 4, 480000);
```

**Problems**:
1. Starting from Alice, display all employees in a tree structure. The output should include indentation and depth.
2. For each manager, calculate the total number of direct and indirect subordinates and the average salary of all subordinates.
3. For any given employee ID (e.g., 7), display the path to the top (Alice) in the format "Alice > Bob > David > Grace."

<details>
<summary>Sample Answer (click to expand)</summary>

```sql
-- Problem 1: Tree structure display
WITH RECURSIVE org_tree AS (
    SELECT id, name, manager_id, salary, 0 AS depth, ARRAY[name] AS path
    FROM employees_ex WHERE id = 1
    UNION ALL
    SELECT e.id, e.name, e.manager_id, e.salary, ot.depth + 1, ot.path || e.name
    FROM employees_ex e JOIN org_tree ot ON e.manager_id = ot.id
)
SELECT REPEAT('  ', depth) || name AS tree, salary, depth
FROM org_tree ORDER BY path;

-- Problem 2: Subordinate count and average salary
WITH RECURSIVE all_subordinates AS (
    SELECT id AS manager_id, id AS subordinate_id FROM employees_ex
    UNION ALL
    SELECT als.manager_id, e.id
    FROM employees_ex e JOIN all_subordinates als ON e.manager_id = als.subordinate_id
)
SELECT
    m.name AS manager,
    COUNT(DISTINCT als.subordinate_id) - 1 AS subordinate_count,  -- exclude self
    ROUND(AVG(e.salary) FILTER (WHERE als.subordinate_id <> als.manager_id), 0) AS avg_sub_salary
FROM all_subordinates als
    JOIN employees_ex m ON m.id = als.manager_id
    JOIN employees_ex e ON e.id = als.subordinate_id
GROUP BY m.id, m.name
HAVING COUNT(DISTINCT als.subordinate_id) > 1
ORDER BY subordinate_count DESC;

-- Problem 3: Bottom-up path
WITH RECURSIVE path_up AS (
    SELECT id, name, manager_id, name::TEXT AS chain
    FROM employees_ex WHERE id = 7
    UNION ALL
    SELECT e.id, e.name, e.manager_id, e.name || ' > ' || pu.chain
    FROM employees_ex e JOIN path_up pu ON e.id = pu.manager_id
)
SELECT chain FROM path_up WHERE manager_id IS NULL;
-- → "Alice > Bob > David > Grace"
```
</details>

### Exercise 2: File System Size Aggregation (Intermediate)

```sql
CREATE TABLE filesystem (
    id        INTEGER PRIMARY KEY,
    name      VARCHAR(255),
    parent_id INTEGER,
    is_dir    BOOLEAN,
    size_bytes BIGINT  -- directories are 0, files are actual size
);

INSERT INTO filesystem VALUES
    (1, '/', NULL, true, 0),
    (2, 'home', 1, true, 0),
    (3, 'usr', 1, true, 0),
    (4, 'alice', 2, true, 0),
    (5, 'bob', 2, true, 0),
    (6, 'readme.txt', 4, false, 1024),
    (7, 'photo.jpg', 4, false, 5242880),
    (8, 'notes.md', 5, false, 2048),
    (9, 'bin', 3, true, 0),
    (10, 'python3', 9, false, 15728640);
```

**Problem**: For each directory, calculate the total size including all files and subdirectories recursively, and display it along with the full path.

<details>
<summary>Sample Answer (click to expand)</summary>

```sql
-- Build full paths and aggregate sizes
WITH RECURSIVE dir_tree AS (
    SELECT id, name, parent_id, is_dir, size_bytes,
           '/' AS full_path, ARRAY[id] AS id_path
    FROM filesystem WHERE parent_id IS NULL

    UNION ALL

    SELECT f.id, f.name, f.parent_id, f.is_dir, f.size_bytes,
           CASE WHEN dt.full_path = '/' THEN '/' || f.name
                ELSE dt.full_path || '/' || f.name END,
           dt.id_path || f.id
    FROM filesystem f JOIN dir_tree dt ON f.parent_id = dt.id
),
dir_sizes AS (
    SELECT
        d.id AS dir_id,
        d.full_path,
        SUM(f.size_bytes) AS total_size,
        COUNT(*) FILTER (WHERE NOT f.is_dir) AS file_count
    FROM dir_tree d
        JOIN dir_tree f ON f.id_path @> ARRAY[d.id]  -- d.id is an ancestor of f
    WHERE d.is_dir
    GROUP BY d.id, d.full_path
)
SELECT
    full_path,
    pg_size_pretty(total_size) AS total_size_pretty,
    file_count
FROM dir_sizes
ORDER BY full_path;
```
</details>

### Exercise 3: Enumerate All Paths in a Graph (Advanced)

```sql
CREATE TABLE city_connections (
    city_from VARCHAR(50),
    city_to   VARCHAR(50),
    cost      INTEGER
);

INSERT INTO city_connections VALUES
    ('Tokyo', 'Osaka', 13000),
    ('Tokyo', 'Nagoya', 10000),
    ('Nagoya', 'Osaka', 5000),
    ('Osaka', 'Fukuoka', 15000),
    ('Tokyo', 'Sendai', 10000),
    ('Sendai', 'Sapporo', 16000),
    ('Nagoya', 'Fukuoka', 18000);
```

**Problems**:
1. Display all routes from Tokyo to Fukuoka (no cycles), sorted by cost.
2. Display the minimum-cost route from Tokyo to every other city (Dijkstra-like approach).

<details>
<summary>Sample Answer (click to expand)</summary>

```sql
-- Problem 1: All routes from Tokyo to Fukuoka
WITH RECURSIVE all_routes AS (
    SELECT
        city_to,
        cost,
        ARRAY['Tokyo', city_to] AS path,
        1 AS hops
    FROM city_connections
    WHERE city_from = 'Tokyo'

    UNION ALL

    SELECT
        cc.city_to,
        ar.cost + cc.cost,
        ar.path || cc.city_to,
        ar.hops + 1
    FROM city_connections cc
        JOIN all_routes ar ON cc.city_from = ar.city_to
    WHERE NOT cc.city_to = ANY(ar.path)
      AND ar.hops < 10
)
SELECT
    array_to_string(path, ' → ') AS route,
    cost,
    hops
FROM all_routes
WHERE city_to = 'Fukuoka'
ORDER BY cost;

-- Problem 2: Minimum-cost routes
WITH RECURSIVE shortest AS (
    SELECT city_to, cost, ARRAY['Tokyo', city_to] AS path
    FROM city_connections WHERE city_from = 'Tokyo'
    UNION ALL
    SELECT cc.city_to, s.cost + cc.cost, s.path || cc.city_to
    FROM city_connections cc JOIN shortest s ON cc.city_from = s.city_to
    WHERE NOT cc.city_to = ANY(s.path)
)
SELECT DISTINCT ON (city_to)
    city_to,
    cost,
    array_to_string(path, ' → ') AS route
FROM shortest
ORDER BY city_to, cost;
```
</details>

---

## 10. FAQ

### Q1: Is a CTE the same as a temporary table?

No. A CTE is a logically named result set that exists only during query execution, while a temporary table is a physical table that persists for the duration of the session. CTEs do not require a separate CREATE/DROP and are ideal for improving query readability. Temporary tables allow index creation and statistics collection, making them advantageous when intermediate results of large datasets need to be referenced multiple times.

### Q2: What is the maximum recursion depth for a recursive CTE?

In PostgreSQL, it is unlimited by default (until working memory is exhausted). It can be controlled with `SET max_recursive_iterations` or `statement_timeout`. In SQL Server, it is specified with `OPTION (MAXRECURSION n)` (default 100). In MySQL 8.0, it is controlled by the `cte_max_recursion_depth` system variable (default 1000).

### Q3: Is a recursive CTE or an application-side loop better?

A recursive CTE that completes within the database is generally faster because it avoids network round trips. However, if complex business logic is required at each step, an application-side loop is appropriate. As a rule of thumb, use a recursive CTE for simple hierarchical traversal, and an application-side loop when an external API call is needed at each node.

### Q4: How do you diagnose poor CTE performance?

Use `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` to examine the execution plan. Key things to look for:
- **CTE Scan** node present → the CTE is being materialized. Consider NOT MATERIALIZED
- **WorkMem exceeded** → adjust the `work_mem` parameter
- **High number of recursive iterations** → review depth limits and search scope
- **Seq Scan on large table** → add an index on the JOIN column

### Q5: How can you safely use a recursive CTE with a graph that contains cycles?

There are three approaches:
1. **ARRAY + ANY**: track the path as an array and exclude already-visited nodes with `NOT node = ANY(path)` (recommended for PostgreSQL)
2. **UNION (not UNION ALL)**: automatically deduplicates rows (slower but concise)
3. **CYCLE clause (PostgreSQL 14+)**: declare cycle detection with `CYCLE id SET is_cycle USING path`

### Q6: What queries should NOT use WITH RECURSIVE?

Recursive CTEs are inappropriate in the following cases:
- **Simple sequence generation**: `generate_series()` (PostgreSQL) or a numbers table is faster
- **Fixed-depth hierarchy**: chaining self-joins for each depth level gives the optimizer more room for optimization
- **Very large graphs (1 million+ nodes)**: consider a dedicated graph database (Neo4j, Amazon Neptune)
- **Cases requiring real-time performance**: consider pre-computing with a Closure Table or Materialized Path

### Q7: Can CTEs be used from an ORM (Django, Rails, SQLAlchemy, etc.)?

Major ORMs support CTEs:
- **Django 4.2+**: `With` class and `.with_cte()` method (django-cte library)
- **SQLAlchemy**: native support with `select().cte(recursive=True)`
- **Rails (ActiveRecord)**: `.with` method added in Rails 7.1+
- **Prisma**: supported via raw queries (native support is limited)

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory but by actually writing code and verifying how it behaves.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping straight to advanced material. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work, particularly during code reviews and architecture design.

---

## 11. Summary

| Item | Key Points |
|------|-----------|
| Non-recursive CTE | Splits a query into logical blocks. Improves readability. Can be referenced multiple times |
| Recursive CTE | Use WITH RECURSIVE to traverse hierarchical and graph data |
| Base case | The starting point of recursion. Defined as the non-recursive term |
| Recursive case | Self-references to generate the next rows. A termination condition is required |
| Cycle prevention | Track visited nodes with ARRAY + ANY. PostgreSQL 14+ supports the CYCLE clause |
| MATERIALIZED | Explicitly controls CTE materialization (PostgreSQL 12+) |
| Performance | Key factors: indexes on JOIN columns, depth limits, minimizing carried columns |
| Alternative approaches | Closure Table, Nested Set, Materialized Path, ltree |
| DBMS differences | Whether the RECURSIVE keyword is required and max depth configuration differ |

---

## What to Read Next

- [02-transactions.md](./02-transactions.md) — Transaction management including CTEs
- [04-query-optimization.md](./04-query-optimization.md) — CTE execution plans and optimization
- [01-schema-design.md](../02-design/01-schema-design.md) — Schema design for hierarchical data (Adjacency List, Closure Table, Nested Set)

---

## References

1. PostgreSQL Documentation — "WITH Queries (Common Table Expressions)" https://www.postgresql.org/docs/current/queries-with.html
2. Winand, M. — "Modern SQL: WITH Clause" https://modern-sql.com/feature/with
3. Karwin, B. (2010). *SQL Antipatterns*. Chapter 3: Naive Trees. Pragmatic Bookshelf.
4. ISO/IEC 9075-2:2023 — SQL Standard Part 2: Foundation (WITH clause definition)
5. Celko, J. (2012). *Joe Celko's Trees and Hierarchies in SQL for Smarties*. Morgan Kaufmann.
6. PostgreSQL Documentation — "SEARCH and CYCLE clauses" https://www.postgresql.org/docs/current/queries-with.html#QUERIES-WITH-SEARCH
7. MySQL 8.0 Reference Manual — "WITH (Common Table Expressions)" https://dev.mysql.com/doc/refman/8.0/en/with.html
8. Microsoft SQL Server Documentation — "WITH common_table_expression" https://learn.microsoft.com/en-us/sql/t-sql/queries/with-common-table-expression-transact-sql

# JOIN — INNER / LEFT / RIGHT / FULL / CROSS

> JOIN is a core feature of relational databases that combines data scattered across multiple tables into a single result set based on join conditions. In the relational algebra proposed by E.F. Codd in 1970, JOIN is defined as a composite operation of "Cartesian Product" and "Selection."

## Prerequisites

- 01-select.md — Basic SELECT statement syntax
- [00-sql-overview.md](./00-sql-overview.md) — Understanding the SQL big picture
- Basics of table design (PRIMARY KEY, FOREIGN KEY)

## What You Will Learn

1. How each JOIN type works (INNER, LEFT, RIGHT, FULL, CROSS) and when to use each
2. Designing join conditions and their impact on performance
3. Practical JOIN patterns such as self-joins and multi-table joins
4. Internal JOIN algorithms (Nested Loop, Hash Join, Merge Join)
5. Differences in JOIN syntax and behavior across RDBMS platforms
6. Advanced JOIN patterns such as LATERAL JOIN, SEMI JOIN, and ANTI JOIN

---

## 1. Overview of JOINs

```
┌──────────────────── JOIN Type Classification ─────────────────────┐
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                         JOIN                                │   │
│  ├──────────────────┬──────────────────────────────────────────┤   │
│  │  Inner Join      │  Outer Join                              │   │
│  │  INNER JOIN      │  LEFT / RIGHT / FULL OUTER JOIN          │   │
│  ├──────────────────┼──────────────────────────────────────────┤   │
│  │  Cross Join      │  Others                                  │   │
│  │  CROSS JOIN      │  NATURAL JOIN / LATERAL JOIN             │   │
│  └──────────────────┴──────────────────────────────────────────┘   │
│                                                                     │
│  INNER JOIN  : Only rows that exist in both tables                  │
│  LEFT JOIN   : All rows from the left table + matching right rows   │
│  RIGHT JOIN  : Matching left rows + all rows from the right table   │
│  FULL JOIN   : All rows from both tables                            │
│  CROSS JOIN  : All combinations (Cartesian product)                 │
│  LATERAL JOIN: Subquery join that references each row of left table │
│  SEMI JOIN   : Existence check only (equivalent to EXISTS)          │
│  ANTI JOIN   : Non-existence check (equivalent to NOT EXISTS)       │
└─────────────────────────────────────────────────────────────────────┘
```

### Mathematical Foundations of Relational Algebra and JOIN

JOIN operations are formally defined in Relational Algebra.

```
JOIN Operations in Relational Algebra
==========================

1. Cartesian Product: R × S
   Result = |R| × |S| rows
   → Corresponds to CROSS JOIN

2. Theta Join: R ⋈θ S
   Only rows from R × S that satisfy condition θ
   → Corresponds to JOIN with an ON clause

3. Equi Join: R ⋈(R.a = S.b) S
   Special case of Theta Join (equality condition only)
   → Most common type of JOIN

4. Natural Join: R ⋈ S
   Automatic equi-join on same-named columns + removal of duplicate columns
   → Corresponds to NATURAL JOIN (not recommended)

5. Semi Join: R ⋉ S
   Only rows in R that match S (columns from S are not returned)
   → Corresponds to EXISTS/IN subqueries

6. Anti Join: R ▷ S
   Only rows in R that do not match S
   → Corresponds to NOT EXISTS/NOT IN subqueries
```

### Sample Data

```sql
-- Tables used in subsequent examples
CREATE TABLE departments (
    id   INTEGER PRIMARY KEY,
    name VARCHAR(50)
);

CREATE TABLE employees (
    id            INTEGER PRIMARY KEY,
    name          VARCHAR(100),
    department_id INTEGER REFERENCES departments(id),
    salary        DECIMAL(10, 2),
    hire_date     DATE
);

INSERT INTO departments VALUES (1, 'Sales'), (2, 'Engineering'), (3, 'HR');
INSERT INTO employees VALUES
    (101, 'Tanaka', 1, 450000, '2020-04-01'),
    (102, 'Suzuki', 2, 520000, '2019-07-15'),
    (103, 'Sato',   1, 380000, '2021-01-10'),
    (104, 'Takahashi', NULL, 400000, '2022-03-01');  -- No department assigned
```

---

## 2. INNER JOIN

INNER JOIN is the most fundamental join operation and returns only the rows that match the join condition in both tables. Rows with NULL in the join key are always excluded (because NULL is not equal to anything).

### Code Example 1: INNER JOIN

```sql
-- Returns only rows that match in both tables
SELECT e.name AS employee, d.name AS department
FROM employees e
    INNER JOIN departments d ON e.department_id = d.id;

-- Result:
-- employee  | department
-- ----------+-----------
-- Tanaka    | Sales
-- Suzuki    | Engineering
-- Sato      | Sales
--
-- Note: Takahashi (department_id=NULL) is excluded
-- Note: HR (no employees) is also excluded
```

### How INNER JOIN Works Internally

```
INNER JOIN Processing Flow
========================

employees table              departments table
+-----+----------+--------+    +----+-------------+
| id  | name     | dep_id |    | id | name        |
+-----+----------+--------+    +----+-------------+
| 101 | Tanaka   |   1    |    |  1 | Sales       |
| 102 | Suzuki   |   2    |    |  2 | Engineering |
| 103 | Sato     |   1    |    |  3 | HR          |
| 104 | Takahashi|  NULL  |    +----+-------------+
+-----+----------+--------+

Join processing:
  101: dep_id=1 → departments(1)=Sales        ✓ match
  102: dep_id=2 → departments(2)=Engineering  ✓ match
  103: dep_id=1 → departments(1)=Sales        ✓ match
  104: dep_id=NULL → NULL≠1, NULL≠2, NULL≠3  ✗ no match

Result: 3 rows (only matched combinations)
```

### Code Example 2: INNER JOIN with Compound Conditions

```sql
-- Using multiple join conditions
CREATE TABLE project_assignments (
    employee_id   INTEGER,
    department_id INTEGER,
    project_id    INTEGER,
    role          VARCHAR(50),
    start_date    DATE,
    PRIMARY KEY (employee_id, project_id)
);

-- Employees who belong to the same department and are assigned to a project
SELECT
    e.name AS employee,
    d.name AS department,
    pa.role
FROM employees e
    INNER JOIN departments d
        ON e.department_id = d.id
    INNER JOIN project_assignments pa
        ON e.id = pa.employee_id
        AND e.department_id = pa.department_id  -- compound join condition
ORDER BY d.name, e.name;

-- Non-Equi Join example
-- Get employees whose salary is above their department average
SELECT e.name, e.salary, dept_avg.avg_salary
FROM employees e
    INNER JOIN (
        SELECT department_id, AVG(salary) AS avg_salary
        FROM employees
        GROUP BY department_id
    ) dept_avg
        ON e.department_id = dept_avg.department_id
        AND e.salary >= dept_avg.avg_salary;
```

---

## 3. LEFT JOIN

LEFT JOIN (LEFT OUTER JOIN) retains all rows from the left table and fills with NULL when there is no matching row in the right table. It is the most frequently used JOIN type for expressing "optional relationships."

### Code Example 3: LEFT JOIN (LEFT OUTER JOIN)

```sql
-- Retains all rows from the left table (employees)
SELECT e.name AS employee, d.name AS department
FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id;

-- Result:
-- employee   | department
-- -----------+-----------
-- Tanaka     | Sales
-- Suzuki     | Engineering
-- Sato       | Sales
-- Takahashi  | NULL        ← Displayed as NULL even with no match

-- Using LEFT JOIN to get only "unmatched rows" (ANTI JOIN pattern)
SELECT e.name
FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
WHERE d.id IS NULL;
-- → Takahashi (employee with no department)
```

### How LEFT JOIN Works

```
LEFT JOIN Processing Flow
========================

LEFT table (employees)       RIGHT table (departments)
+----------+--------+            +----+-------------+
| name     | dep_id |            | id | name        |
+----------+--------+            +----+-------------+
| Tanaka   |   1    | ──────┐    |  1 | Sales       | ← match
| Suzuki   |   2    | ──────┤    |  2 | Engineering | ← match
| Sato     |   1    | ──────┤    |  3 | HR          | ← no match (not in result)
| Takahashi|  NULL  | ─── ✗     +----+-------------+
+----------+--------+

Result:
+-----------+-------------+----------+
| Tanaka    | Sales       |  match   |
| Suzuki    | Engineering |  match   |
| Sato      | Sales       |  match   |
| Takahashi | NULL        | no match | ← Left table row is always preserved
+-----------+-------------+----------+

Key points:
  - All rows from the left table are guaranteed to be included in the result
  - If there is no match in the right table, all columns on the right side become NULL
  - Using WHERE d.id IS NULL, you can extract only the "unmatched rows"
```

### Code Example 4: Practical LEFT JOIN Patterns

```sql
-- Practical pattern 1: Fetching optional profile information
SELECT
    u.id,
    u.name,
    u.email,
    p.avatar_url,
    p.bio,
    COALESCE(p.display_name, u.name) AS display_name
FROM users u
    LEFT JOIN user_profiles p ON u.id = p.user_id;

-- Practical pattern 2: Employee count per department combined with aggregation
SELECT
    d.name AS department,
    COUNT(e.id) AS employee_count,
    COALESCE(SUM(e.salary), 0) AS total_salary
FROM departments d
    LEFT JOIN employees e ON d.id = e.department_id
GROUP BY d.id, d.name
ORDER BY employee_count DESC;
-- Result: HR department is also shown with 0 employees

-- Practical pattern 3: Joining the most recent order information
SELECT
    c.name AS customer,
    c.email,
    lo.last_order_date,
    lo.last_order_total
FROM customers c
    LEFT JOIN LATERAL (
        SELECT
            order_date AS last_order_date,
            total AS last_order_total
        FROM orders
        WHERE customer_id = c.id
        ORDER BY order_date DESC
        LIMIT 1
    ) lo ON TRUE;
```

---

## 4. RIGHT JOIN / FULL JOIN

### Code Example 5: RIGHT JOIN and FULL JOIN

```sql
-- RIGHT JOIN: Retains all rows from the right table (departments)
SELECT e.name AS employee, d.name AS department
FROM employees e
    RIGHT JOIN departments d ON e.department_id = d.id;

-- Result:
-- employee   | department
-- -----------+-----------
-- Tanaka     | Sales
-- Sato       | Sales
-- Suzuki     | Engineering
-- NULL       | HR          ← Departments with no employees shown as NULL

-- FULL OUTER JOIN: Retains all rows from both tables
SELECT e.name AS employee, d.name AS department
FROM employees e
    FULL OUTER JOIN departments d ON e.department_id = d.id;

-- Result:
-- employee   | department
-- -----------+-----------
-- Tanaka     | Sales
-- Sato       | Sales
-- Suzuki     | Engineering
-- Takahashi  | NULL        ← Left only
-- NULL       | HR          ← Right only
```

### Practical Use of FULL OUTER JOIN

```sql
-- Diff detection: Comparing two data sources
-- Detect rows that exist in A but not B, and rows in B but not A

SELECT
    COALESCE(a.product_id, b.product_id) AS product_id,
    a.stock AS warehouse_a_stock,
    b.stock AS warehouse_b_stock,
    CASE
        WHEN a.product_id IS NULL THEN 'Only in B'
        WHEN b.product_id IS NULL THEN 'Only in A'
        WHEN a.stock <> b.stock  THEN 'Quantity mismatch'
        ELSE 'Match'
    END AS status
FROM warehouse_a a
    FULL OUTER JOIN warehouse_b b ON a.product_id = b.product_id
WHERE a.product_id IS NULL
   OR b.product_id IS NULL
   OR a.stock <> b.stock;

-- Diff check for data synchronization
SELECT
    COALESCE(src.id, dst.id) AS id,
    src.updated_at AS source_updated,
    dst.updated_at AS dest_updated,
    CASE
        WHEN dst.id IS NULL THEN 'INSERT'
        WHEN src.id IS NULL THEN 'DELETE'
        WHEN src.updated_at > dst.updated_at THEN 'UPDATE'
        ELSE 'SYNC'
    END AS action_needed
FROM source_table src
    FULL OUTER JOIN destination_table dst ON src.id = dst.id
WHERE dst.id IS NULL
   OR src.id IS NULL
   OR src.updated_at > dst.updated_at;
```

### Emulating FULL OUTER JOIN in MySQL

MySQL does not natively support FULL OUTER JOIN. Use a UNION of LEFT JOIN and RIGHT JOIN as a substitute.

```sql
-- MySQL: Emulating FULL OUTER JOIN
SELECT e.name AS employee, d.name AS department
FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id

UNION

SELECT e.name AS employee, d.name AS department
FROM employees e
    RIGHT JOIN departments d ON e.department_id = d.id;

-- Optimized version using UNION ALL + deduplication
SELECT e.name AS employee, d.name AS department
FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id

UNION ALL

SELECT e.name AS employee, d.name AS department
FROM employees e
    RIGHT JOIN departments d ON e.department_id = d.id
WHERE e.id IS NULL;  -- Only rows not already covered by LEFT JOIN
```

---

## 5. CROSS JOIN

CROSS JOIN (cross join) generates all combinations (Cartesian product) of two tables. Since no join condition is specified, if the left table has M rows and the right table has N rows, the result has M×N rows.

### Code Example 6: CROSS JOIN and Practical Examples

```sql
-- CROSS JOIN: All combinations (Cartesian product)
-- 4 employees × 3 departments = 12 rows
SELECT e.name, d.name
FROM employees e
    CROSS JOIN departments d;

-- Practical example 1: Generating a calendar table
SELECT
    y.year,
    m.month
FROM generate_series(2020, 2025) AS y(year)
    CROSS JOIN generate_series(1, 12) AS m(month)
ORDER BY y.year, m.month;

-- Practical example 2: Inventory matrix for all products × all stores
SELECT
    p.name AS product,
    s.name AS store,
    COALESCE(i.quantity, 0) AS stock
FROM products p
    CROSS JOIN stores s
    LEFT JOIN inventory i ON i.product_id = p.id AND i.store_id = s.id;

-- Practical example 3: Sales matrix by time slot
WITH hours AS (
    SELECT generate_series(0, 23) AS hour
),
days AS (
    SELECT generate_series(0, 6) AS dow,
           CASE generate_series(0, 6)
               WHEN 0 THEN 'Sun' WHEN 1 THEN 'Mon'
               WHEN 2 THEN 'Tue' WHEN 3 THEN 'Wed'
               WHEN 4 THEN 'Thu' WHEN 5 THEN 'Fri'
               WHEN 6 THEN 'Sat'
           END AS day_name
)
SELECT
    d.day_name,
    h.hour,
    COALESCE(s.sale_count, 0) AS sales
FROM days d
    CROSS JOIN hours h
    LEFT JOIN (
        SELECT
            EXTRACT(DOW FROM sale_time) AS dow,
            EXTRACT(HOUR FROM sale_time) AS hour,
            COUNT(*) AS sale_count
        FROM sales
        GROUP BY 1, 2
    ) s ON d.dow = s.dow AND h.hour = s.hour
ORDER BY d.dow, h.hour;
```

### Venn Diagram of JOIN Types

```
  INNER JOIN          LEFT JOIN           RIGHT JOIN          FULL JOIN
  (intersection)      (left + intersection) (intersection + right) (all)

  ┌───┐ ┌───┐       ┌───┐ ┌───┐       ┌───┐ ┌───┐       ┌───┐ ┌───┐
  │   │█│   │       │███│█│   │       │   │█│███│       │███│█│███│
  │ A │█│ B │       │█A█│█│ B │       │ A │█│█B█│       │█A█│█│█B█│
  │   │█│   │       │███│█│   │       │   │█│███│       │███│█│███│
  └───┘ └───┘       └───┘ └───┘       └───┘ └───┘       └───┘ └───┘
  █ = included       █ = included       █ = included       █ = included


  LEFT ANTI JOIN      RIGHT ANTI JOIN     CROSS JOIN
  (left only)         (right only)        (Cartesian product)

  ┌───┐ ┌───┐       ┌───┐ ┌───┐       ┌───────────────┐
  │███│ │   │       │   │ │███│       │ A × B         │
  │█A█│ │ B │       │ A │ │█B█│       │ All combos    │
  │███│ │   │       │   │ │███│       │ M rows × N rows│
  └───┘ └───┘       └───┘ └───┘       └───────────────┘
  WHERE b.id        WHERE a.id
  IS NULL           IS NULL
```

---

## 6. LATERAL JOIN

LATERAL JOIN is an advanced JOIN pattern that executes a subquery while referencing each row of the left table. Available in PostgreSQL 9.3+ and MySQL 8.0.14+.

### Code Example 7: LATERAL JOIN

```sql
-- Get the top 3 earners per department
SELECT
    d.name AS department,
    top3.name AS employee,
    top3.salary
FROM departments d
    CROSS JOIN LATERAL (
        SELECT name, salary
        FROM employees
        WHERE department_id = d.id  -- References column from the outer table
        ORDER BY salary DESC
        LIMIT 3
    ) top3;

-- LATERAL vs correlated subquery: LATERAL can return multiple columns in SELECT
-- A correlated subquery can only return 1 value in the SELECT clause
SELECT
    d.name AS department,
    latest.order_date,
    latest.total_amount,
    latest.item_count
FROM departments d
    LEFT JOIN LATERAL (
        SELECT
            o.order_date,
            o.total_amount,
            COUNT(oi.id) AS item_count
        FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.department_id = d.id
        ORDER BY o.order_date DESC
        LIMIT 1
    ) latest ON TRUE;

-- Fetching the most recent N readings from time-series data
SELECT
    s.sensor_id,
    s.location,
    readings.reading_time,
    readings.value
FROM sensors s
    CROSS JOIN LATERAL (
        SELECT reading_time, value
        FROM sensor_readings
        WHERE sensor_id = s.sensor_id
        ORDER BY reading_time DESC
        LIMIT 5
    ) readings
ORDER BY s.sensor_id, readings.reading_time DESC;
```

---

## 7. SEMI JOIN / ANTI JOIN

SEMI JOIN and ANTI JOIN are not written as distinct JOIN types in SQL syntax, but are expressed using EXISTS/NOT EXISTS or IN/NOT IN, and are optimized internally by the query optimizer as SEMI JOIN/ANTI JOIN.

### Code Example 8: SEMI JOIN and ANTI JOIN

```sql
-- SEMI JOIN: Get only customers with orders (using EXISTS)
SELECT c.id, c.name
FROM customers c
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);

-- Equivalent SEMI JOIN (using IN)
SELECT c.id, c.name
FROM customers c
WHERE c.id IN (SELECT customer_id FROM orders);

-- ANTI JOIN: Get only customers without orders (using NOT EXISTS)
SELECT c.id, c.name
FROM customers c
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);

-- ANTI JOIN: LEFT JOIN + IS NULL pattern
SELECT c.id, c.name
FROM customers c
    LEFT JOIN orders o ON c.id = o.customer_id
WHERE o.id IS NULL;

-- Note: Performance comparison:
-- NOT EXISTS vs LEFT JOIN + IS NULL vs NOT IN
-- In general, NOT EXISTS delivers the most stable performance
-- NOT IN can produce unexpected results when NULLs are present
```

### Differences Between SEMI JOIN, ANTI JOIN, and Regular JOIN

```
SEMI JOIN / ANTI JOIN Behavior
==============================

Table: customers        Table: orders
+----+--------+              +----+----------+
| id | name   |              | id | cust_id  |
+----+--------+              +----+----------+
|  1 | Tanaka |              | 10 |    1     |
|  2 | Suzuki |              | 11 |    1     |
|  3 | Sato   |              | 12 |    3     |
+----+--------+              +----+----------+

INNER JOIN (customers JOIN orders ON id = cust_id):
→ Tanaka(10), Tanaka(11), Sato(12) = 3 rows (Tanaka appears twice!)

SEMI JOIN (EXISTS):
→ Tanaka, Sato = 2 rows (1 row per customer who has at least 1 order)

ANTI JOIN (NOT EXISTS):
→ Suzuki = 1 row (only customers with no orders)

Key points:
  SEMI JOIN = "Rows with at least one match"
  ANTI JOIN = "Rows with no match at all"
  → Unlike INNER JOIN, no duplicates are produced
```

---

## 8. Practical JOIN Patterns

### Code Example 9: Self Join

```sql
-- Representing manager-subordinate relationships in the employee table
CREATE TABLE staff (
    id         INTEGER PRIMARY KEY,
    name       VARCHAR(100),
    manager_id INTEGER REFERENCES staff(id)
);

-- Self-join to get manager names
SELECT
    s.name AS employee,
    m.name AS manager
FROM staff s
    LEFT JOIN staff m ON s.manager_id = m.id;

-- List all employee pairs in the same department (self-join)
SELECT
    e1.name AS employee_1,
    e2.name AS employee_2
FROM employees e1
    INNER JOIN employees e2
        ON e1.department_id = e2.department_id
        AND e1.id < e2.id;  -- Prevent duplicate pairs

-- Employee pairs who joined in the same year
SELECT
    e1.name AS emp1,
    e2.name AS emp2,
    EXTRACT(YEAR FROM e1.hire_date) AS hire_year
FROM employees e1
    INNER JOIN employees e2
        ON EXTRACT(YEAR FROM e1.hire_date) = EXTRACT(YEAR FROM e2.hire_date)
        AND e1.id < e2.id
ORDER BY hire_year;
```

### Code Example 10: Joining Multiple Tables

```sql
-- 3-table join: orders → order_items → products
SELECT
    o.id AS order_id,
    o.order_date,
    c.name AS customer_name,
    p.name AS product_name,
    oi.quantity,
    oi.unit_price,
    oi.quantity * oi.unit_price AS subtotal
FROM orders o
    INNER JOIN customers c ON o.customer_id = c.id
    INNER JOIN order_items oi ON o.id = oi.order_id
    INNER JOIN products p ON oi.product_id = p.id
WHERE o.customer_id = 42
ORDER BY o.order_date DESC, p.name;

-- 5-table join: Fetching complete order information
SELECT
    o.id AS order_id,
    c.name AS customer,
    c.email,
    p.name AS product,
    cat.name AS category,
    oi.quantity,
    oi.unit_price,
    (oi.quantity * oi.unit_price) AS line_total,
    s.company AS shipping_company,
    s.tracking_number,
    o.status
FROM orders o
    INNER JOIN customers c ON o.customer_id = c.id
    INNER JOIN order_items oi ON o.id = oi.order_id
    INNER JOIN products p ON oi.product_id = p.id
    LEFT JOIN categories cat ON p.category_id = cat.id
    LEFT JOIN shipments s ON o.id = s.order_id
WHERE o.order_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY o.order_date DESC;
```

### Code Example 11: Conditional JOIN

```sql
-- Placing a filter condition in the ON clause vs the WHERE clause
-- Be aware of the behavioral difference

-- Pattern 1: Filter in the ON clause → All departments appear with LEFT JOIN
SELECT d.name, e.name, e.salary
FROM departments d
    LEFT JOIN employees e
        ON d.id = e.department_id
        AND e.salary > 400000;  -- As a JOIN condition
-- → HR appears as NULL, and Sato (380000) in Sales also appears as NULL

-- Pattern 2: Filter in the WHERE clause → Only matching departments
SELECT d.name, e.name, e.salary
FROM departments d
    LEFT JOIN employees e ON d.id = e.department_id
WHERE e.salary > 400000;  -- Filter applied after the join
-- → HR does not appear (NULL > 400000 is FALSE in the WHERE clause)

-- This difference is especially important with OUTER JOINs
-- With INNER JOIN, the result is the same either way
```

```
Filter condition in ON clause vs WHERE clause (LEFT JOIN)
================================================

With ON clause:
  departments     LEFT JOIN employees
  +-------------+        ON dep_id = d.id AND salary > 400000
  | Sales       | ←───── Tanaka(450000) ✓ match
  | Engineering | ←───── Suzuki(520000) ✓ match
  | HR          | ←───── (no match → NULL)  ← still displayed
  +-------------+

  Sato(380000): Does not satisfy ON condition salary > 400000
                → Not joined, but Sales itself is displayed as NULL

With WHERE clause:
  departments     LEFT JOIN employees
  +-------------+        ON dep_id = d.id
  | Sales       | ←───── Tanaka(450000), Sato(380000)
  | Engineering | ←───── Suzuki(520000)
  | HR          | ←───── (NULL)
  +-------------+

  WHERE salary > 400000 filters all results:
    Tanaka(450000) ✓  → shown
    Sato(380000)   ✗  → hidden
    Suzuki(520000) ✓  → shown
    HR(NULL)       ✗  → hidden (NULL > 400000 = UNKNOWN)
```

---

## 9. Internal JOIN Algorithms

The query optimizer selects the most appropriate algorithm from the following three when executing a join.

### Comparison of Join Algorithms

```
┌────────────── JOIN Algorithms ──────────────┐
│                                              │
│  1. Nested Loop Join                         │
│     Scans the inner table for each row       │
│     in the outer table                       │
│                                              │
│     for each row r in outer_table:           │
│         for each row s in inner_table:       │
│             if r.key == s.key:               │
│                 emit(r, s)                   │
│                                              │
│     Complexity: O(M × N)                     │
│     ※ O(M × log N) if inner has an index    │
│     Best for: small table × large table      │
│              (with index)                    │
│                                              │
│  2. Hash Join                                │
│     Builds a hash table from the smaller     │
│     table, then probes it while scanning     │
│     the larger table                         │
│                                              │
│     build hash_table from smaller_table      │
│     for each row r in larger_table:          │
│         probe hash_table with r.key          │
│         if found: emit(r, match)             │
│                                              │
│     Complexity: O(M + N)                     │
│     Memory: O(min(M, N))                     │
│     Best for: large tables, equi-joins       │
│                                              │
│  3. Merge Join (Sort Merge)                  │
│     Sorts both tables by the join key and    │
│     detects matches while merging            │
│                                              │
│     sort outer_table by key                  │
│     sort inner_table by key                  │
│     merge both sorted streams                │
│                                              │
│     Complexity: O(M log M + N log N + M + N) │
│     ※ O(M + N) if already sorted            │
│     Best for: large tables, pre-sorted data, │
│              range joins                     │
└──────────────────────────────────────────────┘
```

### Selection Criteria for JOIN Algorithms

| Condition | Algorithm Selected | Reason |
|-----------|-------------------|--------|
| Small table × large table (with index) | Nested Loop + Index Scan | Fast lookup via index |
| Large table × large table (equi-join) | Hash Join | Building hash + probing is efficient |
| Both tables pre-sorted | Merge Join | No sorting needed, merge only |
| Low memory + large tables | Merge Join | Can sort on disk |
| Non-equi join (<, >, BETWEEN) | Nested Loop or Merge Join | Hash Join only works for equi-joins |
| CROSS JOIN | Nested Loop | No other option for all combinations |

### Code Example 12: Inspecting the JOIN Algorithm via Execution Plan

```sql
-- PostgreSQL: Check the execution plan with EXPLAIN ANALYZE
EXPLAIN ANALYZE
SELECT e.name, d.name
FROM employees e
    INNER JOIN departments d ON e.department_id = d.id;

-- Sample output (Nested Loop):
-- Nested Loop  (cost=0.28..16.34 rows=3 width=64)
--   -> Seq Scan on employees e  (cost=0.00..1.04 rows=4 width=36)
--   -> Index Scan using departments_pkey on departments d
--        (cost=0.14..0.16 rows=1 width=36)
--        Index Cond: (id = e.department_id)

-- Forcing Hash Join (for testing only; not recommended in production)
SET enable_nestloop = off;
SET enable_mergejoin = off;

EXPLAIN ANALYZE
SELECT e.name, d.name
FROM employees e
    INNER JOIN departments d ON e.department_id = d.id;

-- Sample output (Hash Join):
-- Hash Join  (cost=1.07..2.15 rows=3 width=64)
--   Hash Cond: (e.department_id = d.id)
--   -> Seq Scan on employees e  (cost=0.00..1.04 rows=4 width=36)
--   -> Hash  (cost=1.03..1.03 rows=3 width=36)
--         -> Seq Scan on departments d  (cost=0.00..1.03 rows=3 width=36)

-- Restore settings
RESET enable_nestloop;
RESET enable_mergejoin;
```

---

## 10. JOIN Syntax Differences Across RDBMS

### JOIN Support Matrix by RDBMS

| Feature | PostgreSQL | MySQL | SQL Server | Oracle | SQLite |
|---------|-----------|-------|------------|--------|--------|
| INNER JOIN | Yes | Yes | Yes | Yes | Yes |
| LEFT JOIN | Yes | Yes | Yes | Yes | Yes |
| RIGHT JOIN | Yes | Yes | Yes | Yes | Yes |
| FULL OUTER JOIN | Yes | No (emulation required) | Yes | Yes | No (emulation required) |
| CROSS JOIN | Yes | Yes | Yes | Yes | Yes |
| LATERAL JOIN | Yes (9.3+) | Yes (8.0.14+) | CROSS/OUTER APPLY | Yes (12c+) | No |
| NATURAL JOIN | Yes | Yes | No | Yes | Yes |
| USING clause | Yes | Yes | No | Yes | Yes |

### RDBMS-Specific Syntax

```sql
-- Oracle: Legacy OUTER JOIN syntax ((+) notation)
-- Deprecated but common in legacy code
SELECT e.name, d.name
FROM employees e, departments d
WHERE e.department_id = d.id(+);  -- Equivalent to LEFT JOIN
-- → Use the standard LEFT JOIN syntax instead

-- SQL Server: CROSS APPLY / OUTER APPLY
-- Equivalent to LATERAL
SELECT d.name, top3.name, top3.salary
FROM departments d
CROSS APPLY (
    SELECT TOP 3 name, salary
    FROM employees
    WHERE department_id = d.id
    ORDER BY salary DESC
) top3;

-- MySQL: STRAIGHT_JOIN (forcing join order)
SELECT STRAIGHT_JOIN e.name, d.name
FROM employees e
    INNER JOIN departments d ON e.department_id = d.id;
-- → Disables the optimizer's join order selection
```

---

## JOIN Type Comparison Table

| JOIN Type | Result Rows | NULL Rows | Primary Use Case | Computational Cost |
|-----------|------------|-----------|-----------------|-------------------|
| INNER JOIN | Only rows matching in both | None | Joining related data | Low–Medium |
| LEFT JOIN | All rows from left table | NULL on right side | Optional relationships | Medium |
| RIGHT JOIN | All rows from right table | NULL on left side | Reverse of LEFT JOIN (rare) | Medium |
| FULL OUTER JOIN | All rows from both tables | NULL on both sides | Diff detection | High |
| CROSS JOIN | All combinations of left × right | None | Matrix generation | Very High |
| LATERAL JOIN | All left rows × subquery | Depends on config | Top-N per group | Medium–High |
| NATURAL JOIN | Auto-join on same-named columns | None | Not recommended (implicit join) | Same as INNER JOIN |

## ON Clause vs USING Clause vs WHERE Clause Comparison

| Method | Syntax Example | Flexibility | Readability | Notes |
|--------|---------------|-------------|-------------|-------|
| ON clause | `ON a.id = b.a_id` | High (compound conditions possible) | Explicit | Most recommended |
| USING clause | `USING (id)` | Low (same-named columns only) | Concise | Not supported in SQL Server |
| WHERE clause | `WHERE a.id = b.a_id` | High | Join and filter conditions mixed | Cannot be used with OUTER JOIN |
| NATURAL | Implicit | Lowest (no control) | Dangerous | Behavior changes when columns are added |

---

## Performance Optimization

### Factors That Affect JOIN Performance

```
JOIN Performance Optimization Checklist
========================================

1. Indexes
   [✓] Is there an index on the join key column?
   [✓] Are indexes automatically created for foreign key constraints?
       (PostgreSQL does NOT create them automatically — create explicitly!)
   [✓] Is the column order of composite indexes appropriate?

2. Join Order
   [✓] Is the join going from smaller table to larger table?
   [✓] Are optimizer statistics up to date? (Run ANALYZE)
   [✓] Control join order with hint clauses if necessary

3. Reducing Data Volume
   [✓] Can the row count be reduced with WHERE before the JOIN?
   [✓] Are unnecessary columns being SELECTed?
   [✓] Can the data be pre-aggregated in a subquery?

4. JOIN Type Selection
   [✓] Are unnecessary OUTER JOINs being used?
   [✓] Can any JOINs be replaced with EXISTS/IN? (SEMI JOIN optimization)
   [✓] Is the CROSS JOIN result set explosively large?
```

### Code Example 13: Improving JOIN Performance

```sql
-- [NG] Join all data first, then filter
SELECT e.name, d.name, o.total
FROM employees e
    INNER JOIN departments d ON e.department_id = d.id
    INNER JOIN orders o ON e.id = o.employee_id
WHERE o.order_date >= '2024-01-01'
  AND d.name = 'Sales';

-- [OK] Filter in subqueries first
SELECT e.name, d.name, o.total
FROM (
    SELECT * FROM employees WHERE department_id = 1
) e
    INNER JOIN departments d ON e.department_id = d.id
    INNER JOIN (
        SELECT * FROM orders WHERE order_date >= '2024-01-01'
    ) o ON e.id = o.employee_id;
-- Note: In practice, the optimizer often performs equivalent optimizations automatically
-- Note: Always verify with EXPLAIN ANALYZE before deciding

-- Creating indexes
CREATE INDEX idx_employees_department_id ON employees(department_id);
CREATE INDEX idx_orders_employee_id ON orders(employee_id);
CREATE INDEX idx_orders_date ON orders(order_date);

-- Updating statistics
ANALYZE employees;
ANALYZE orders;
ANALYZE departments;
```

---

## Edge Cases

### Edge Case 1: NULL and JOIN

```sql
-- NULL is not equal to NULL (NULL = NULL → UNKNOWN → treated as FALSE)
SELECT * FROM table_a a
    INNER JOIN table_b b ON a.nullable_col = b.nullable_col;
-- → Rows where both are NULL will not be joined

-- To include NULL-to-NULL matches in the join
SELECT * FROM table_a a
    INNER JOIN table_b b
        ON a.nullable_col = b.nullable_col
        OR (a.nullable_col IS NULL AND b.nullable_col IS NULL);

-- Or use COALESCE
SELECT * FROM table_a a
    INNER JOIN table_b b
        ON COALESCE(a.nullable_col, -1) = COALESCE(b.nullable_col, -1);
-- Note: Verify that the sentinel value (-1) does not exist in actual data
```

### Edge Case 2: Row Multiplication Caused by JOIN

```sql
-- A 1:N relationship causes row multiplication
-- Joining orders(1) : order_items(N) increases rows in the orders table

-- [NG] Double-counting due to the combination of aggregation and JOIN
SELECT
    d.name,
    SUM(o.total) AS dept_total  -- Added multiple times due to duplicates!
FROM departments d
    INNER JOIN employees e ON d.id = e.department_id
    INNER JOIN orders o ON e.id = o.employee_id
    INNER JOIN order_items oi ON o.id = oi.order_id
GROUP BY d.name;

-- [OK] Aggregate in a subquery first, then JOIN
SELECT
    d.name,
    order_totals.dept_total
FROM departments d
    INNER JOIN (
        SELECT e.department_id, SUM(o.total) AS dept_total
        FROM employees e
            INNER JOIN orders o ON e.id = o.employee_id
        GROUP BY e.department_id
    ) order_totals ON d.id = order_totals.department_id;
```

### Edge Case 3: JOIN with Many-to-Many Relationships

```sql
-- Many-to-many relationship: students ←→ junction table ←→ courses
CREATE TABLE students (id INTEGER PRIMARY KEY, name VARCHAR(100));
CREATE TABLE courses (id INTEGER PRIMARY KEY, title VARCHAR(100));
CREATE TABLE enrollments (
    student_id INTEGER REFERENCES students(id),
    course_id  INTEGER REFERENCES courses(id),
    enrolled_at DATE,
    PRIMARY KEY (student_id, course_id)
);

-- List of courses taken by each student
SELECT
    s.name AS student,
    STRING_AGG(c.title, ', ' ORDER BY c.title) AS courses,
    COUNT(c.id) AS course_count
FROM students s
    LEFT JOIN enrollments e ON s.id = e.student_id
    LEFT JOIN courses c ON e.course_id = c.id
GROUP BY s.id, s.name
ORDER BY s.name;

-- Student pairs taking the same course
SELECT DISTINCT
    s1.name AS student1,
    s2.name AS student2,
    c.title AS shared_course
FROM enrollments e1
    INNER JOIN enrollments e2
        ON e1.course_id = e2.course_id
        AND e1.student_id < e2.student_id
    INNER JOIN students s1 ON e1.student_id = s1.id
    INNER JOIN students s2 ON e2.student_id = s2.id
    INNER JOIN courses c ON e1.course_id = c.id;
```

### Edge Case 4: Join by Date Range

```sql
-- Non-equi join: joining by a date range
-- Exchange rate table (daily rates updated irregularly)
CREATE TABLE exchange_rates (
    currency VARCHAR(3),
    rate DECIMAL(10, 4),
    effective_date DATE
);

-- Apply the exchange rate at the time of each order
SELECT
    o.id AS order_id,
    o.order_date,
    o.amount_usd,
    er.rate,
    o.amount_usd * er.rate AS amount_jpy
FROM orders o
    INNER JOIN LATERAL (
        SELECT rate
        FROM exchange_rates
        WHERE currency = 'JPY'
          AND effective_date <= o.order_date
        ORDER BY effective_date DESC
        LIMIT 1
    ) er ON TRUE;
```

---

## Security Considerations

### 1. Cross-Boundary Data Exposure via JOIN

```sql
-- Risk: Data that should not be visible becomes visible through JOIN
-- User A can only view their own orders, but
-- information about other users may be leaked via JOIN

-- [NG] Insufficient tenant isolation
SELECT o.*, c.name, c.email
FROM orders o
    INNER JOIN customers c ON o.customer_id = c.id;
-- → Customer information from other tenants can also be retrieved

-- [OK] Restrict with Row-Level Security (RLS) or WHERE clause
SELECT o.*, c.name, c.email
FROM orders o
    INNER JOIN customers c ON o.customer_id = c.id
WHERE o.tenant_id = current_setting('app.current_tenant')::INTEGER;

-- PostgreSQL: Row-Level Security
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON orders
    USING (tenant_id = current_setting('app.current_tenant')::INTEGER);
```

### 2. SQL Injection and JOIN

```sql
-- [NG] Building table names for dynamic JOINs via string concatenation
-- User input: "employees; DROP TABLE users; --"

-- [OK] Validate table names with a whitelist
-- Application side:
-- allowed_tables = {'employees', 'departments', 'projects'}
-- if table_name not in allowed_tables:
--     raise ValueError("Invalid table name")
```

---

## Anti-Patterns

### Anti-Pattern 1: Implicit Join (Comma join)

```sql
-- NG: Old-style comma join (implicit CROSS JOIN + WHERE)
SELECT e.name, d.name
FROM employees e, departments d
WHERE e.department_id = d.id;

-- Problems:
-- 1. Forgetting the WHERE clause results in a CROSS JOIN
-- 2. Hard to read because join conditions and filter conditions are mixed
-- 3. OUTER JOIN cannot be expressed
-- 4. As more tables are added, missing join conditions are hard to detect

-- OK: Explicit JOIN syntax
SELECT e.name, d.name
FROM employees e
    INNER JOIN departments d ON e.department_id = d.id;
```

### Anti-Pattern 2: N+1 Query Problem

```sql
-- NG: Running queries individually in a loop when JOIN should be used
-- Pseudo-code on the application side:
-- for dept in get_all_departments():
--     employees = query("SELECT * FROM employees WHERE dept_id = ?", dept.id)
--     # N+1 queries for N departments

-- OK: One query using JOIN
SELECT d.name AS department, e.name AS employee
FROM departments d
    LEFT JOIN employees e ON d.id = e.department_id
ORDER BY d.name, e.name;
```

### Anti-Pattern 3: Performance Degradation from Unnecessary JOINs

```sql
-- NG: Joining tables that are not used
SELECT e.name, e.salary
FROM employees e
    INNER JOIN departments d ON e.department_id = d.id
    INNER JOIN locations l ON d.location_id = l.id  -- Not used!
WHERE d.name = 'Sales';

-- OK: Join only the necessary tables
SELECT e.name, e.salary
FROM employees e
    INNER JOIN departments d ON e.department_id = d.id
WHERE d.name = 'Sales';

-- Or use EXISTS for a lighter query
SELECT e.name, e.salary
FROM employees e
WHERE EXISTS (
    SELECT 1 FROM departments d
    WHERE d.id = e.department_id AND d.name = 'Sales'
);
```

### Anti-Pattern 4: Hiding JOIN Duplicates with DISTINCT

```sql
-- NG: Using DISTINCT to forcibly resolve duplicates caused by JOIN
SELECT DISTINCT e.name, e.department_id
FROM employees e
    INNER JOIN orders o ON e.id = o.employee_id;
-- → The JOIN design is likely incorrect

-- OK: Use EXISTS for a SEMI JOIN instead
SELECT e.name, e.department_id
FROM employees e
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.employee_id = e.id
);
```

---

## Practice Problems

### Exercise 1 (Basic): Fundamental JOINs

Write SQL queries to answer each question using the following table structure.

```sql
-- Table definitions
CREATE TABLE authors (id INT PRIMARY KEY, name VARCHAR(100), country VARCHAR(50));
CREATE TABLE books (id INT PRIMARY KEY, title VARCHAR(200), author_id INT, published_year INT);
CREATE TABLE reviews (id INT PRIMARY KEY, book_id INT, rating INT, reviewer_name VARCHAR(100));
```

1. Display all authors and their books (including authors with no books)
2. List all books with no reviews
3. Display the average review score per author for books written by Japanese authors

<details>
<summary>Sample Answers</summary>

```sql
-- 1. All authors and their books (LEFT JOIN)
SELECT a.name AS author, b.title AS book
FROM authors a
    LEFT JOIN books b ON a.id = b.author_id
ORDER BY a.name, b.title;

-- 2. Books with no reviews (ANTI JOIN)
SELECT b.title
FROM books b
    LEFT JOIN reviews r ON b.id = r.book_id
WHERE r.id IS NULL;

-- 3. Average review score for books by Japanese authors
SELECT
    a.name AS author,
    ROUND(AVG(r.rating), 1) AS avg_rating,
    COUNT(r.id) AS review_count
FROM authors a
    INNER JOIN books b ON a.id = b.author_id
    INNER JOIN reviews r ON b.id = r.book_id
WHERE a.country = 'Japan'
GROUP BY a.id, a.name
ORDER BY avg_rating DESC;
```

</details>

### Exercise 2 (Applied): Multi-Table JOINs and Aggregation

Write SQL queries to answer each question using the following e-commerce tables.

```sql
CREATE TABLE customers (id INT PRIMARY KEY, name VARCHAR(100), registered_at DATE);
CREATE TABLE orders (id INT PRIMARY KEY, customer_id INT, order_date DATE, status VARCHAR(20));
CREATE TABLE order_items (id INT PRIMARY KEY, order_id INT, product_id INT, quantity INT, unit_price DECIMAL);
CREATE TABLE products (id INT PRIMARY KEY, name VARCHAR(100), category VARCHAR(50));
```

1. Calculate the monthly sales total by category (show zero for month × category combinations with no sales)
2. Retrieve the list of customers who have not placed an order in the past 90 days
3. Display the "product category with the highest total purchase amount" for each customer

<details>
<summary>Sample Answers</summary>

```sql
-- 1. Monthly sales by category (CROSS JOIN + LEFT JOIN)
WITH months AS (
    SELECT generate_series(
        DATE_TRUNC('month', MIN(order_date)),
        DATE_TRUNC('month', MAX(order_date)),
        '1 month'
    )::DATE AS month
    FROM orders
),
categories AS (
    SELECT DISTINCT category FROM products
)
SELECT
    m.month,
    c.category,
    COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_sales
FROM months m
    CROSS JOIN categories c
    LEFT JOIN orders o
        ON DATE_TRUNC('month', o.order_date) = m.month
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN products p ON oi.product_id = p.id AND p.category = c.category
GROUP BY m.month, c.category
ORDER BY m.month, c.category;

-- 2. Customers with no orders in the past 90 days (ANTI JOIN)
SELECT c.id, c.name, c.registered_at
FROM customers c
    LEFT JOIN orders o
        ON c.id = o.customer_id
        AND o.order_date >= CURRENT_DATE - INTERVAL '90 days'
WHERE o.id IS NULL
ORDER BY c.name;

-- 3. Top purchase category per customer (LATERAL JOIN)
SELECT
    c.name AS customer,
    top_cat.category,
    top_cat.total_spent
FROM customers c
    CROSS JOIN LATERAL (
        SELECT p.category, SUM(oi.quantity * oi.unit_price) AS total_spent
        FROM orders o
            INNER JOIN order_items oi ON o.id = oi.order_id
            INNER JOIN products p ON oi.product_id = p.id
        WHERE o.customer_id = c.id
        GROUP BY p.category
        ORDER BY total_spent DESC
        LIMIT 1
    ) top_cat
ORDER BY c.name;
```

</details>

### Exercise 3 (Advanced): Self-Join and Graph Traversal

```sql
CREATE TABLE employees_v2 (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    manager_id INT REFERENCES employees_v2(id),
    department VARCHAR(50),
    salary DECIMAL(10, 2)
);
```

1. For each employee, calculate the "salary difference from their direct manager"
2. Among all manager-subordinate pairs, list cases where the subordinate earns more
3. Retrieve management chains of 3 or more levels (employee → manager → manager's manager) without using recursion

<details>
<summary>Sample Answers</summary>

```sql
-- 1. Salary difference from manager (self-join)
SELECT
    e.name AS employee,
    e.salary AS emp_salary,
    m.name AS manager,
    m.salary AS mgr_salary,
    e.salary - m.salary AS salary_diff
FROM employees_v2 e
    LEFT JOIN employees_v2 m ON e.manager_id = m.id
ORDER BY salary_diff DESC NULLS LAST;

-- 2. Cases where subordinate earns more than manager
SELECT
    m.name AS manager,
    m.salary AS mgr_salary,
    e.name AS subordinate,
    e.salary AS sub_salary,
    e.salary - m.salary AS overpay
FROM employees_v2 e
    INNER JOIN employees_v2 m ON e.manager_id = m.id
WHERE e.salary > m.salary
ORDER BY overpay DESC;

-- 3. 3-level management chain (3 self-joins)
SELECT
    e.name AS employee,
    m1.name AS direct_manager,
    m2.name AS skip_level_manager
FROM employees_v2 e
    INNER JOIN employees_v2 m1 ON e.manager_id = m1.id
    INNER JOIN employees_v2 m2 ON m1.manager_id = m2.id
ORDER BY m2.name, m1.name, e.name;
```

</details>


---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | Prioritize when | Can compromise when |
|-----------|----------------|---------------------|
| Performance | Real-time processing, large-scale data | Admin screens, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, speed to market | Quality-focused, mission-critical |

### Selecting an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│         Architecture Selection Flow              │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① What is the team size?                        │
│    ├─ Small (1-5 people) → Monolith              │
│    └─ Large (10+ people) → Go to ②               │
│                                                 │
│  ② How often do you deploy?                      │
│    ├─ Weekly or less → Monolith + modular split  │
│    └─ Daily / multiple times → Go to ③           │
│                                                 │
│  ③ How independent are teams?                    │
│    ├─ High → Microservices                       │
│    └─ Moderate → Modular Monolith                │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze them from the following perspectives:

**1. Short-term vs Long-term Cost**
- A faster approach in the short term can become technical debt in the long term
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies enables the right tool for the right job, but increases operational costs

**3. Level of Abstraction**
- High abstraction improves reusability but can make debugging more difficult
- Low abstraction is intuitive but tends to cause code duplication

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

### Q1: When should I use LEFT JOIN vs INNER JOIN?

The key question is: "Do I want rows to appear in the result even if there is no matching data in the joined table?" For example, use LEFT JOIN if you want to show employees without a department, and INNER JOIN if you only want employees who belong to a department. When in doubt, using LEFT JOIN and then checking whether there are any unnecessary NULL rows is a valid approach.

### Q2: Does the order of JOINs affect performance?

In theory, the query optimizer selects the optimal join order, so the written order should not matter. However, for complex queries or when the optimizer reaches its limits, hint clauses (such as `/*+ LEADING(...) */`) may be used to control the order. When the number of tables exceeds PostgreSQL's `join_collapse_limit` (default 8), the tables are joined in the written order, so caution is needed.

### Q3: Why is NATURAL JOIN not recommended?

NATURAL JOIN automatically joins on all columns with the same name, so simply adding a column to a table changes the join condition and can produce unexpected results. For example, if a `created_at` column is added to both tables, it gets unintentionally included in the join condition. Always specify join conditions explicitly using the ON clause.

### Q4: How do I choose between EXISTS, IN, and JOIN?

- **INNER JOIN**: Use when columns from the joined table are needed in the result
- **EXISTS**: Use when only existence checking is needed and columns from the joined table are not required (SEMI JOIN)
- **IN**: Use when the subquery result is small and contains no NULLs

Performance is equivalent in most RDBMS, but NOT IN has issues with NULLs, so NOT EXISTS is recommended.

### Q5: What is the best practice for getting "the most recent 1 record" with a JOIN?

```sql
-- Method 1: LATERAL JOIN (PostgreSQL 9.3+, MySQL 8.0.14+)
SELECT c.*, latest_order.*
FROM customers c
    LEFT JOIN LATERAL (
        SELECT order_date, total
        FROM orders WHERE customer_id = c.id
        ORDER BY order_date DESC LIMIT 1
    ) latest_order ON TRUE;

-- Method 2: ROW_NUMBER() + CTE
WITH ranked AS (
    SELECT o.*, ROW_NUMBER() OVER (
        PARTITION BY customer_id ORDER BY order_date DESC
    ) AS rn
    FROM orders o
)
SELECT c.*, r.order_date, r.total
FROM customers c
    LEFT JOIN ranked r ON c.id = r.customer_id AND r.rn = 1;

-- Method 3: Correlated subquery (not recommended; slow for large datasets)
SELECT c.*,
    (SELECT MAX(order_date) FROM orders WHERE customer_id = c.id)
FROM customers c;
```

### Q6: What should I be careful about when joining many tables?

- PostgreSQL's `join_collapse_limit` (default 8) restricts join order optimization when exceeded
- Write only the necessary JOINs and remove any that are not needed
- Pre-aggregate intermediate results using CTEs or subqueries to reduce the size of join targets
- Use EXPLAIN ANALYZE to inspect the execution plan and identify bottlenecks

---

## Troubleshooting

### Problem 1: JOIN Returns More Rows Than Expected

**Cause**: Row multiplication in a 1:N relationship. The join key has no unique constraint.

**Resolution**:
1. Check the row count with `SELECT COUNT(*) FROM result`
2. Check cardinality of the join key: `SELECT column, COUNT(*) FROM table GROUP BY column HAVING COUNT(*) > 1`
3. Eliminate duplicates with DISTINCT or GROUP BY, or rewrite as EXISTS (SEMI JOIN)

### Problem 2: JOIN Is Slow

**Cause**: Missing indexes, stale statistics, suboptimal join order.

**Resolution**:
1. Check the execution plan with `EXPLAIN ANALYZE`
2. Create an index on the join key column
3. Update statistics with `ANALYZE`
4. Increase `work_mem` to prevent Hash Join spilling to disk

### Problem 3: FULL OUTER JOIN Is Not Available in MySQL

**Resolution**: Use LEFT JOIN UNION ALL RIGHT JOIN (WHERE left.id IS NULL) as a substitute. See the code example above for reference.

---

## Summary

| Item | Key Point |
|------|-----------|
| INNER JOIN | Only matching rows from both tables. The most fundamental. |
| LEFT JOIN | Retains all rows from the left table. Most commonly used in practice. |
| RIGHT JOIN | Reverse of LEFT JOIN. Recommended to rewrite as LEFT JOIN for readability. |
| FULL OUTER JOIN | Retains all rows from both tables. Useful for diff detection. |
| CROSS JOIN | Cartesian product. For matrix generation. Watch out for the result row count. |
| LATERAL JOIN | Subquery join that references each row of the outer table. |
| SEMI/ANTI JOIN | Written with EXISTS/NOT EXISTS. No duplicates produced. |
| Join Condition | Specify explicitly with ON clause. Avoid NATURAL JOIN. |
| ON vs WHERE | Results differ with OUTER JOIN. Understand the purpose and use accordingly. |
| Performance | Set indexes on join columns. Verify with EXPLAIN ANALYZE. |
| Internal Algorithms | Three types: Nested Loop, Hash Join, Merge Join. |

---

## What to Read Next

- [03-aggregation.md](./03-aggregation.md) — GROUP BY and aggregate functions
- [04-subqueries.md](./04-subqueries.md) — Using subqueries
- [03-indexing.md](../01-advanced/03-indexing.md) — Indexes that affect JOIN performance
- [00-window-functions.md](../01-advanced/00-window-functions.md) — Combining with window functions
- [04-query-optimization.md](../01-advanced/04-query-optimization.md) — Full picture of query optimization

---

## References

1. PostgreSQL Documentation — "Joins Between Tables" https://www.postgresql.org/docs/current/tutorial-join.html
2. PostgreSQL Documentation — "EXPLAIN" https://www.postgresql.org/docs/current/sql-explain.html
3. Garcia-Molina, H., Ullman, J.D., & Widom, J. (2008). *Database Systems: The Complete Book*. Pearson.
4. Molinaro, A. (2005). *SQL Cookbook*. O'Reilly Media.
5. Winand, M. — "SQL Performance Explained" https://sql-performance-explained.com/
6. Karwin, B. (2010). *SQL Antipatterns*. Pragmatic Bookshelf.
7. Date, C.J. (2003). *An Introduction to Database Systems*. Addison Wesley. — Theoretical foundations of relational algebra

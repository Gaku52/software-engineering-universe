# Subqueries — Correlated / Non-Correlated, EXISTS, IN

> A subquery is a query nested inside another query, and is a powerful tool for expressing complex conditions or data transformations within a single SQL statement.

## What You Will Learn

1. The difference between non-correlated and correlated subqueries, and their execution models
2. When to use EXISTS, IN, and scalar subqueries
3. Performance characteristics of subqueries and when to rewrite them as JOINs
4. The relationship between LATERAL JOIN and subqueries
5. Internal transformation mechanisms for subqueries by the optimizer

## Prerequisites

- Basic SQL syntax (SELECT, WHERE, JOIN)
- Basics of aggregate functions (COUNT, SUM, AVG)
- Understanding of JOIN types from 03-joins.md

---

## 1. Subquery Classification

```
┌──────────────────── Subquery Classification ────────────────────┐
│                                                                  │
│  ┌──────────────────────────────────────────┐                   │
│  │ Classification by result shape            │                   │
│  ├──────────────────┬───────────────────────┤                   │
│  │ Scalar subquery  │ 1 row, 1 column        │                   │
│  │ Row subquery     │ 1 row, N columns       │                   │
│  │ Table subquery   │ N rows, N columns      │                   │
│  └──────────────────┴───────────────────────┘                   │
│                                                                  │
│  ┌──────────────────────────────────────────┐                   │
│  │ Classification by dependency on outer query│                  │
│  ├──────────────────┬───────────────────────┤                   │
│  │ Non-correlated   │ Can execute independently│                 │
│  │ Correlated       │ Depends on outer rows  │                   │
│  └──────────────────┴───────────────────────┘                   │
│                                                                  │
│  ┌──────────────────────────────────────────┐                   │
│  │ Classification by usage location          │                   │
│  ├──────────────────┬───────────────────────┤                   │
│  │ WHERE clause     │ As a condition         │                   │
│  │ FROM clause      │ As a derived table     │                   │
│  │ SELECT clause    │ As a scalar value      │                   │
│  │ HAVING clause    │ As a group condition   │                   │
│  │ INSERT INTO ... SELECT │ For data migration│                  │
│  │ UPDATE ... SET   │ For value calculation  │                   │
│  │ DELETE ... WHERE │ As a delete condition  │                   │
│  └──────────────────┴───────────────────────┘                   │
└──────────────────────────────────────────────────────────────────┘
```

### 1.1 Subquery Execution Model Overview

```
┌──────── Subquery Execution Model ────────────────┐
│                                                   │
│  Non-correlated subquery execution:               │
│  ┌──────────────────────────────┐                 │
│  │ Step 1: Execute subquery once │                 │
│  │ Step 2: Hold result in memory │                 │
│  │ Step 3: Reference result in outer query│        │
│  │                               │                 │
│  │ Complexity: O(M) + O(N)       │                 │
│  │ M = rows processed by subquery│                 │
│  │ N = rows processed by outer query│              │
│  └──────────────────────────────┘                 │
│                                                   │
│  Correlated subquery execution (naive case):      │
│  ┌──────────────────────────────┐                 │
│  │ For each row of the outer query:│               │
│  │   → Execute the subquery      │                 │
│  │   → Evaluate the outer row    │                 │
│  │                               │                 │
│  │ Complexity: O(N * M) (worst case)│              │
│  │ ※ Optimizer may improve to O(N + M)│           │
│  └──────────────────────────────┘                 │
└───────────────────────────────────────────────────┘
```

---

## 2. Non-Correlated Subqueries

### Code Example 1: Non-Correlated Subquery in WHERE Clause

```sql
-- IN: checks whether value is in the subquery result list
SELECT name, salary
FROM employees
WHERE department_id IN (
    SELECT id FROM departments WHERE location = 'Tokyo'
);

-- Comparison operator: scalar subquery
SELECT name, salary
FROM employees
WHERE salary > (
    SELECT AVG(salary) FROM employees  -- returns company-wide average
);

-- ALL / ANY: comparison against a set
-- Employees earning more than the average of every department
SELECT name, salary
FROM employees
WHERE salary > ALL (
    SELECT AVG(salary) FROM employees GROUP BY department_id
);

-- Employees earning more than the average of at least one department
SELECT name, salary
FROM employees
WHERE salary > ANY (
    SELECT AVG(salary) FROM employees GROUP BY department_id
);

-- Combining BETWEEN with subqueries
SELECT name, salary
FROM employees
WHERE salary BETWEEN
    (SELECT AVG(salary) - STDDEV(salary) FROM employees)
    AND
    (SELECT AVG(salary) + STDDEV(salary) FROM employees);
-- → employees within one standard deviation of the mean
```

#### Internal Behavior of ALL / ANY

```
┌──────── Logical Expansion of ALL / ANY ──────────────┐
│                                                        │
│  salary > ALL (10, 20, 30)                             │
│  ≡ salary > 10 AND salary > 20 AND salary > 30        │
│  ≡ salary > MAX(10, 20, 30)                            │
│  ≡ salary > 30                                         │
│                                                        │
│  salary > ANY (10, 20, 30)                             │
│  ≡ salary > 10 OR salary > 20 OR salary > 30           │
│  ≡ salary > MIN(10, 20, 30)                            │
│  ≡ salary > 10                                         │
│                                                        │
│  Note: empty set case                                  │
│  salary > ALL (empty) → TRUE (all elements satisfy    │
│                         condition = no elements = true)│
│  salary > ANY (empty) → FALSE                          │
│                                                        │
│  Note: when NULL is included                           │
│  salary > ALL (10, NULL, 30)                           │
│  → salary > 10 AND salary > NULL AND salary > 30       │
│  → ... AND UNKNOWN AND ...                             │
│  → result is UNKNOWN → row is filtered out             │
└────────────────────────────────────────────────────────┘
```

### Code Example 2: Non-Correlated Subquery in FROM Clause (Derived Table)

```sql
-- Derived table: use the subquery result as a table
SELECT
    dept_stats.department_name,
    dept_stats.avg_salary,
    dept_stats.employee_count
FROM (
    SELECT
        d.name AS department_name,
        AVG(e.salary) AS avg_salary,
        COUNT(*) AS employee_count
    FROM employees e
        INNER JOIN departments d ON e.department_id = d.id
    GROUP BY d.name
) AS dept_stats
WHERE dept_stats.avg_salary > 500000
ORDER BY dept_stats.avg_salary DESC;

-- Scalar subquery in SELECT clause
SELECT
    e.name,
    e.salary,
    (SELECT AVG(salary) FROM employees) AS company_avg,
    e.salary - (SELECT AVG(salary) FROM employees) AS diff_from_avg
FROM employees e
ORDER BY diff_from_avg DESC;

-- Using a window function inside a derived table
SELECT
    ranked.name,
    ranked.salary,
    ranked.department_name,
    ranked.salary_rank
FROM (
    SELECT
        e.name,
        e.salary,
        d.name AS department_name,
        RANK() OVER (PARTITION BY d.id ORDER BY e.salary DESC) AS salary_rank
    FROM employees e
        JOIN departments d ON e.department_id = d.id
) AS ranked
WHERE ranked.salary_rank <= 3;
-- → top 3 earners per department
```

#### Comparison: Derived Table vs CTE

```sql
-- Written with a derived table
SELECT dept_name, avg_salary
FROM (
    SELECT d.name AS dept_name, AVG(e.salary) AS avg_salary
    FROM employees e JOIN departments d ON e.department_id = d.id
    GROUP BY d.name
) AS dept_stats
WHERE avg_salary > 500000;

-- Written with a CTE (equivalent result)
WITH dept_stats AS (
    SELECT d.name AS dept_name, AVG(e.salary) AS avg_salary
    FROM employees e JOIN departments d ON e.department_id = d.id
    GROUP BY d.name
)
SELECT dept_name, avg_salary
FROM dept_stats
WHERE avg_salary > 500000;

-- Advantages of CTEs:
-- 1. The same subquery can be referenced multiple times
-- 2. Better readability (can be read top to bottom)
-- 3. Recursive queries are possible

-- Performance difference (PostgreSQL 12+):
-- PostgreSQL 12+ inlines CTEs by default (NOT MATERIALIZED)
-- → performance is nearly equivalent to derived tables
-- To force materialization: WITH x AS MATERIALIZED (...)
```

---

## 3. Correlated Subqueries

### Correlated Subquery Execution Model

```
┌────────── Correlated Subquery Execution Flow ──────────┐
│                                                         │
│  Outer query: SELECT * FROM employees e                 │
│  WHERE salary > (...)                                   │
│                                                         │
│  For each outer row:                                    │
│  ┌─────────────────────────────────────────┐            │
│  │ Row 1: Tanaka (dept=10)                 │            │
│  │  → Execute subquery: AVG WHERE dept=10  │            │
│  │  → Result: 450000                       │            │
│  │  → Tanaka's salary > 450000? → evaluate │            │
│  ├─────────────────────────────────────────┤            │
│  │ Row 2: Suzuki (dept=20)                 │            │
│  │  → Execute subquery: AVG WHERE dept=20  │            │
│  │  → Result: 520000                       │            │
│  │  → Suzuki's salary > 520000? → evaluate │            │
│  ├─────────────────────────────────────────┤            │
│  │ Row 3: Sato (dept=10)                   │            │
│  │  → Execute subquery: AVG WHERE dept=10  │            │
│  │  → Result: 450000 (cacheable)           │            │
│  │  → Sato's salary > 450000? → evaluate   │            │
│  └─────────────────────────────────────────┘            │
│                                                         │
│  ※ The subquery is executed once per outer row          │
│  ※ However, the optimizer may apply optimizations       │
└─────────────────────────────────────────────────────────┘
```

### Code Example 3: Correlated Subquery

```sql
-- Retrieve employees earning above their department's average salary
SELECT e.name, e.salary, e.department_id
FROM employees e
WHERE e.salary > (
    SELECT AVG(e2.salary)
    FROM employees e2
    WHERE e2.department_id = e.department_id  -- references the outer row
);

-- Retrieve the most recently added product in each category
SELECT p.name, p.category_id, p.created_at
FROM products p
WHERE p.created_at = (
    SELECT MAX(p2.created_at)
    FROM products p2
    WHERE p2.category_id = p.category_id
);

-- Equivalent window function version (generally preferred)
SELECT name, category_id, created_at
FROM (
    SELECT
        name, category_id, created_at,
        ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY created_at DESC) AS rn
    FROM products
) sub
WHERE rn = 1;

-- UPDATE with a correlated subquery
UPDATE employees e
SET salary = salary * 1.1
WHERE salary < (
    SELECT AVG(e2.salary)
    FROM employees e2
    WHERE e2.department_id = e.department_id
);
-- → give a 10% raise to employees below their department's average

-- DELETE with a correlated subquery
DELETE FROM order_items oi
WHERE NOT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = oi.order_id
    AND o.status != 'cancelled'
);
-- → delete line items belonging to cancelled orders
```

### 3.1 Optimizer Transformations for Correlated Subqueries

```
┌──── Optimizer Subquery Optimization Strategies ─────┐
│                                                       │
│  1. Subquery Unnesting                                │
│     Correlated subquery → converted to JOIN           │
│     Example:                                          │
│     SELECT * FROM t1                                  │
│     WHERE t1.x IN (SELECT t2.x FROM t2               │
│                     WHERE t2.y = t1.y)                │
│     →                                                 │
│     SELECT t1.* FROM t1                               │
│     SEMI JOIN t2 ON t1.x = t2.x AND t1.y = t2.y      │
│                                                       │
│  2. Subquery Materialization                          │
│     Hash-table the result of non-correlated subqueries│
│     → O(1) lookup for each outer row                  │
│                                                       │
│  3. EXISTS → SEMI JOIN conversion                     │
│     PostgreSQL internally converts EXISTS to SEMI JOIN │
│     and uses Hash Semi Join                           │
│                                                       │
│  4. Scalar subquery caching                           │
│     Reuse the result of a correlated subquery with    │
│     the same parameters (cache hit when dept_id=10    │
│     appears a second time)                            │
│                                                       │
│  How to verify: use EXPLAIN ANALYZE to inspect the    │
│  execution plan                                       │
└───────────────────────────────────────────────────────┘
```

```sql
-- Example to verify optimizer transformations
EXPLAIN ANALYZE
SELECT e.name
FROM employees e
WHERE e.department_id IN (
    SELECT d.id FROM departments d WHERE d.location = 'Tokyo'
);

-- PostgreSQL execution plan (after transformation):
-- Hash Semi Join  (actual time=0.050..1.200 rows=500 loops=1)
--   Hash Cond: (e.department_id = d.id)
--   -> Seq Scan on employees e
--   -> Hash
--     -> Seq Scan on departments d
--       Filter: (location = 'Tokyo')
-- → the IN subquery is automatically converted to a SEMI JOIN
```

---

## 4. EXISTS / NOT EXISTS

### Code Example 4: Using EXISTS

```sql
-- Retrieve customers who have placed an order
SELECT c.name, c.email
FROM customers c
WHERE EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.customer_id = c.id
      AND o.order_date >= '2024-01-01'
);

-- Retrieve customers who have never placed an order
SELECT c.name, c.email
FROM customers c
WHERE NOT EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.customer_id = c.id
);

-- Rewriting EXISTS vs IN
-- The following are logically equivalent (performance may differ)

-- IN version
SELECT * FROM customers
WHERE id IN (SELECT customer_id FROM orders);

-- EXISTS version (often more efficient for large datasets)
SELECT * FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);

-- EXISTS with multiple conditions
-- Customers who are VIP AND have a pending order
SELECT c.name, c.email
FROM customers c
WHERE c.tier = 'VIP'
  AND EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.id
      AND o.status = 'pending'
      AND o.total_amount > 10000
  );
```

#### Internal Mechanics of EXISTS

```
┌──────── EXISTS Execution Mechanism ─────────────┐
│                                                   │
│  EXISTS (SELECT 1 FROM orders WHERE ...)          │
│                                                   │
│  Behavior:                                        │
│  1. Begin executing the subquery                  │
│  2. Return TRUE as soon as one row is found       │
│  3. Stop evaluating remaining rows (short-circuit)│
│                                                   │
│  → Result is the same whether SELECT 1 or SELECT *│
│    (column contents are not evaluated)            │
│                                                   │
│  NOT EXISTS:                                      │
│  1. Execute the subquery                          │
│  2. Return TRUE if no rows are found              │
│  3. Return FALSE as soon as one row is found      │
│                                                   │
│  Performance tip:                                 │
│  ┌──────────────────────────────────┐             │
│  │ If the subquery's WHERE condition │             │
│  │ has an index, it is very fast    │             │
│  │ Index Scan → find 1 row → done   │             │
│  └──────────────────────────────────┘             │
└───────────────────────────────────────────────────┘
```

### Code Example 5: LATERAL JOIN (Correlated Subquery in the FROM Clause)

```sql
-- LATERAL JOIN: execute a subquery for each row and use it in FROM
-- Retrieve top 3 earners per department
SELECT d.name AS department, top3.name, top3.salary
FROM departments d
    CROSS JOIN LATERAL (
        SELECT e.name, e.salary
        FROM employees e
        WHERE e.department_id = d.id
        ORDER BY e.salary DESC
        LIMIT 3
    ) AS top3;

-- "Top-N per group" is hard to express with ordinary correlated subqueries
-- but is concise with LATERAL JOIN

-- Another LATERAL JOIN example: append the latest order information as columns
SELECT
    c.name,
    c.email,
    latest.order_date,
    latest.total_amount
FROM customers c
    LEFT JOIN LATERAL (
        SELECT o.order_date, o.total_amount
        FROM orders o
        WHERE o.customer_id = c.id
        ORDER BY o.order_date DESC
        LIMIT 1
    ) AS latest ON TRUE;
-- LEFT JOIN LATERAL ... ON TRUE returns NULL for customers with no orders

-- Reference the previous row in time-series data using LATERAL
SELECT
    m.month,
    m.revenue,
    prev.revenue AS prev_revenue,
    ROUND((m.revenue - prev.revenue) / prev.revenue * 100, 1) AS growth_pct
FROM monthly_sales m
    LEFT JOIN LATERAL (
        SELECT revenue
        FROM monthly_sales
        WHERE month = m.month - INTERVAL '1 month'
    ) prev ON TRUE
ORDER BY m.month;
```

#### LATERAL JOIN Execution Plan

```
┌──── LATERAL JOIN vs Correlated Subquery Execution Plan ───┐
│                                                             │
│  LATERAL JOIN:                                              │
│  Nested Loop                                                │
│    -> Seq Scan on departments d                             │
│    -> Limit                                                 │
│      -> Index Scan Backward on employees e                  │
│           Index Cond: (department_id = d.id)                │
│           Sort: salary DESC                                 │
│  → Retrieves TOP 3 per department using an index           │
│  → LIMIT applies, so at most 3 rows are read per dept      │
│                                                             │
│  Equivalent using correlated subqueries in SELECT clause:   │
│  → A separate subquery is needed per column → very slow     │
│  → LATERAL is ideal for the TOP-N pattern                   │
└─────────────────────────────────────────────────────────────┘
```

### Code Example 6: Practical Subquery Patterns

```sql
-- Classify all employees into four quartiles
SELECT
    name,
    salary,
    CASE
        WHEN salary >= (SELECT PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY salary) FROM employees)
            THEN 'Q4 (Top 25%)'
        WHEN salary >= (SELECT PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY salary) FROM employees)
            THEN 'Q3'
        WHEN salary >= (SELECT PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY salary) FROM employees)
            THEN 'Q2'
        ELSE 'Q1 (Bottom 25%)'
    END AS quartile
FROM employees
ORDER BY salary DESC;

-- Window function version (recommended: subquery runs only once)
SELECT
    name,
    salary,
    NTILE(4) OVER (ORDER BY salary) AS quartile_num,
    CASE NTILE(4) OVER (ORDER BY salary)
        WHEN 4 THEN 'Q4 (Top 25%)'
        WHEN 3 THEN 'Q3'
        WHEN 2 THEN 'Q2'
        ELSE 'Q1 (Bottom 25%)'
    END AS quartile
FROM employees
ORDER BY salary DESC;

-- Month-over-month sales comparison
SELECT
    current_month.month,
    current_month.total,
    prev_month.total AS prev_total,
    ROUND((current_month.total - prev_month.total) / prev_month.total * 100, 1) AS growth_pct
FROM (
    SELECT DATE_TRUNC('month', sale_date) AS month, SUM(amount) AS total
    FROM sales GROUP BY 1
) current_month
LEFT JOIN (
    SELECT DATE_TRUNC('month', sale_date) AS month, SUM(amount) AS total
    FROM sales GROUP BY 1
) prev_month ON current_month.month = prev_month.month + INTERVAL '1 month'
ORDER BY current_month.month;

-- Rewritten with CTE (DRY principle, recommended)
WITH monthly AS (
    SELECT DATE_TRUNC('month', sale_date) AS month, SUM(amount) AS total
    FROM sales GROUP BY 1
)
SELECT
    c.month,
    c.total,
    p.total AS prev_total,
    ROUND((c.total - p.total) / p.total * 100, 1) AS growth_pct
FROM monthly c
LEFT JOIN monthly p ON c.month = p.month + INTERVAL '1 month'
ORDER BY c.month;
```

### Code Example 7: Advanced Subquery Patterns

```sql
-- Pattern 1: Existence check with conditional aggregation
-- "High-value customers who ordered in the last 30 days with no returns"
SELECT c.id, c.name, c.email,
    (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id
     AND o.order_date >= CURRENT_DATE - INTERVAL '30 days') AS recent_orders,
    (SELECT SUM(o.total_amount) FROM orders o WHERE o.customer_id = c.id
     AND o.order_date >= CURRENT_DATE - INTERVAL '30 days') AS recent_total
FROM customers c
WHERE EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.id
    AND o.order_date >= CURRENT_DATE - INTERVAL '30 days'
)
AND NOT EXISTS (
    SELECT 1 FROM returns r
    JOIN orders o ON r.order_id = o.id
    WHERE o.customer_id = c.id
    AND r.return_date >= CURRENT_DATE - INTERVAL '30 days'
);

-- Pattern 2: Row value constructor with subquery
-- Simultaneous comparison of multiple columns
SELECT * FROM employees
WHERE (department_id, salary) IN (
    SELECT department_id, MAX(salary)
    FROM employees
    GROUP BY department_id
);
-- → retrieve the highest earner in each department

-- Pattern 3: INSERT ... SELECT subquery
-- Migrate data to an archive table
INSERT INTO orders_archive (id, customer_id, order_date, total_amount)
SELECT id, customer_id, order_date, total_amount
FROM orders
WHERE order_date < CURRENT_DATE - INTERVAL '2 years'
  AND status = 'delivered';

-- Pattern 4: UPDATE with subquery
-- Update the average rating for each product
UPDATE products p
SET avg_rating = sub.avg_rating,
    review_count = sub.review_count
FROM (
    SELECT
        product_id,
        AVG(rating)::DECIMAL(3,2) AS avg_rating,
        COUNT(*) AS review_count
    FROM reviews
    GROUP BY product_id
) sub
WHERE p.id = sub.product_id;

-- Pattern 5: DELETE with subquery
-- Delete duplicate rows (keep the row with the smallest ID)
DELETE FROM employees
WHERE id NOT IN (
    SELECT MIN(id)
    FROM employees
    GROUP BY name, department_id, salary
);

-- Safer alternative (NOT EXISTS version)
DELETE FROM employees e1
WHERE EXISTS (
    SELECT 1 FROM employees e2
    WHERE e2.name = e1.name
      AND e2.department_id = e1.department_id
      AND e2.salary = e1.salary
      AND e2.id < e1.id
);
```

---

## 5. Subquery Performance Analysis

### 5.1 Comparing Execution Plans

```sql
-- Assumed test data: employees 100,000 rows, departments 50 rows

-- Pattern 1: IN subquery
EXPLAIN ANALYZE
SELECT * FROM employees
WHERE department_id IN (
    SELECT id FROM departments WHERE location = 'Tokyo'
);
-- Execution plan:
-- Hash Semi Join  (cost=1.63..2500.00 rows=20000)
--   (actual time=0.050..25.000 rows=20000 loops=1)
--   Hash Cond: (employees.department_id = departments.id)
--   -> Seq Scan on employees
--   -> Hash
--     -> Seq Scan on departments
--       Filter: (location = 'Tokyo')
-- Execution Time: 25.500 ms

-- Pattern 2: EXISTS
EXPLAIN ANALYZE
SELECT * FROM employees e
WHERE EXISTS (
    SELECT 1 FROM departments d
    WHERE d.id = e.department_id AND d.location = 'Tokyo'
);
-- Execution plan (often identical in PostgreSQL):
-- Hash Semi Join  (cost=1.63..2500.00 rows=20000)
--   (actual time=0.050..25.000 rows=20000 loops=1)
-- → optimizer converts to the same execution plan

-- Pattern 3: JOIN
EXPLAIN ANALYZE
SELECT e.* FROM employees e
JOIN departments d ON e.department_id = d.id
WHERE d.location = 'Tokyo';
-- Execution plan:
-- Hash Join  (cost=1.63..2500.00 rows=20000)
--   (actual time=0.050..24.000 rows=20000 loops=1)
-- → nearly identical execution plan (note: JOIN may produce duplicates)
```

### 5.2 Subquery Optimization Differences Between RDBMSs

```
┌──── Subquery Optimization Comparison by RDBMS ────────────┐
│                                                             │
│  PostgreSQL:                                                │
│  - IN → automatically converted to Semi Join               │
│  - EXISTS → automatically converted to Semi Join           │
│  - Correlated subquery → converted to JOIN when possible   │
│  - CTE 12+: inlined by default                             │
│  - LATERAL: executed efficiently with Nested Loop          │
│                                                             │
│  MySQL:                                                     │
│  - Before 5.6: weak optimization for IN subqueries         │
│  - 5.6+: introduced Semi Join optimization                 │
│  - 8.0+: derived table merge optimization                  │
│  - 8.0+: added CTE support                                 │
│  - LATERAL: supported from 8.0.14+                         │
│                                                             │
│  Oracle:                                                    │
│  - Very advanced subquery unnesting                        │
│  - Controllable with UNNEST / NO_UNNEST hints              │
│  - Powerful scalar subquery caching                        │
│                                                             │
│  SQL Server:                                                │
│  - Implements LATERAL-equivalent via the Apply operator    │
│  - Subquery unnesting is automatic                         │
│  - OPTION (RECOMPILE) for re-optimization                  │
└─────────────────────────────────────────────────────────────┘
```

---

## IN vs EXISTS vs JOIN Comparison

| Approach | Best situation | NULL handling | Performance | Optimizer transformation |
|----------|---------------|---------------|-------------|--------------------------|
| IN | Small subquery result | Problematic with NULLs | Suited for small tables | Converted to Semi Join |
| NOT IN | — | Risk of excluding all rows if NULLs present | Not recommended | Converted to Anti Join (incomplete) |
| EXISTS | Large subquery result | No NULL issues | Suited for large tables | Converted to Semi Join |
| NOT EXISTS | Finding rows that do not exist | NULL-safe | Recommended | Converted to Anti Join |
| JOIN | Need joined data | Can be controlled explicitly | Most flexible | Executed as-is |
| LATERAL | TOP-N per row | N/A | Optimal for TOP-N | Nested Loop |

## Subquery Usage Location Comparison

| Location | Result shape | Purpose | Example | Performance note |
|----------|-------------|---------|---------|------------------|
| WHERE clause | Scalar / list | Filter condition | `WHERE x IN (SELECT ...)` | Index presence is important |
| FROM clause | Table | Derived table | `FROM (SELECT ...) AS t` | Materialization cost |
| SELECT clause | Scalar | Computed column | `SELECT (SELECT AVG(...))` | Can cause N+1 problem |
| HAVING clause | Scalar | Group filter | `HAVING COUNT(*) > (SELECT ...)` | Filter after aggregation |
| INSERT INTO | Table | Data migration | `INSERT INTO ... SELECT` | Bulk operation performance |
| UPDATE SET | Scalar | Value update | `SET x = (SELECT ...)` | Watch row count for correlated |
| DELETE WHERE | Boolean | Delete condition | `WHERE EXISTS (SELECT ...)` | Index presence is important |

## Subquery vs Alternative Approaches Comparison

| Requirement | Subquery | JOIN | Window function | CTE | Recommended |
|-------------|----------|------|-----------------|-----|-------------|
| Filter condition | WHERE IN/EXISTS | JOIN + DISTINCT | - | WITH | EXISTS preferred |
| TOP-N per group | Correlated + LIMIT | - | ROW_NUMBER | WITH | LATERAL preferred |
| Compare against aggregate | Scalar subquery | Self JOIN | Window aggregate | WITH | Window function preferred |
| Month-over-month comparison | Self JOIN | LAG support | LAG() | WITH | Window function preferred |
| Existence check | EXISTS | LEFT JOIN IS NULL | - | WITH + EXISTS | EXISTS preferred |
| Data migration | INSERT SELECT | - | - | INSERT WITH | Subquery preferred |

---

## Anti-Patterns

### Anti-Pattern 1: NOT IN and the NULL Trap

```sql
-- NG: NOT IN excludes all rows if any NULL is present in the subquery
SELECT * FROM employees
WHERE department_id NOT IN (
    SELECT department_id FROM temp_exclusions
    -- if even one NULL exists in temp_exclusions, the result is 0 rows!
);

-- Reason: comparison with NULL always yields UNKNOWN
-- x NOT IN (1, 2, NULL) → x<>1 AND x<>2 AND x<>NULL
-- → ... AND UNKNOWN → UNKNOWN → row is filtered out

-- OK: use NOT EXISTS instead
SELECT * FROM employees e
WHERE NOT EXISTS (
    SELECT 1 FROM temp_exclusions t
    WHERE t.department_id = e.department_id
);

-- OK: safe if NULLs are excluded from NOT IN
SELECT * FROM employees
WHERE department_id NOT IN (
    SELECT department_id FROM temp_exclusions
    WHERE department_id IS NOT NULL
);
```

```
┌──── Diagram: NOT IN and the NULL Problem ──────────────┐
│                                                         │
│  employees:                                             │
│  dept_id: 10, 20, 30                                    │
│                                                         │
│  temp_exclusions:                                       │
│  dept_id: 10, NULL                                      │
│                                                         │
│  NOT IN expansion:                                      │
│  dept_id NOT IN (10, NULL)                              │
│  = dept_id <> 10 AND dept_id <> NULL                   │
│                                                         │
│  For dept_id=20:                                        │
│  20 <> 10 → TRUE                                        │
│  20 <> NULL → UNKNOWN                                   │
│  TRUE AND UNKNOWN → UNKNOWN                             │
│  → WHERE result is UNKNOWN → row is filtered out        │
│                                                         │
│  For dept_id=30:                                        │
│  30 <> 10 → TRUE                                        │
│  30 <> NULL → UNKNOWN                                   │
│  TRUE AND UNKNOWN → UNKNOWN                             │
│  → also filtered out                                    │
│                                                         │
│  Result: 0 rows returned (unintended behavior)          │
└─────────────────────────────────────────────────────────┘
```

### Anti-Pattern 2: Overuse of Correlated Subqueries in the SELECT Clause

```sql
-- NG: a subquery is executed for each row (equivalent to the N+1 problem)
SELECT
    e.name,
    (SELECT d.name FROM departments d WHERE d.id = e.department_id) AS dept_name,
    (SELECT COUNT(*) FROM projects p WHERE p.lead_id = e.id) AS project_count,
    (SELECT MAX(r.rating) FROM reviews r WHERE r.employee_id = e.id) AS best_rating
FROM employees e;
-- → for 1,000 employees: 1000 * 3 = 3,000 subquery executions

-- OK: rewrite with JOIN and aggregation in a single query
SELECT
    e.name,
    d.name AS dept_name,
    COUNT(DISTINCT p.id) AS project_count,
    MAX(r.rating) AS best_rating
FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN projects p ON p.lead_id = e.id
    LEFT JOIN reviews r ON r.employee_id = e.id
GROUP BY e.id, e.name, d.name;

-- OK: use LATERAL JOIN to separate aggregations (avoids row explosion from JOINs)
SELECT
    e.name,
    d.name AS dept_name,
    pc.project_count,
    br.best_rating
FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN LATERAL (
        SELECT COUNT(*) AS project_count
        FROM projects p WHERE p.lead_id = e.id
    ) pc ON TRUE
    LEFT JOIN LATERAL (
        SELECT MAX(rating) AS best_rating
        FROM reviews r WHERE r.employee_id = e.id
    ) br ON TRUE;
```

### Anti-Pattern 3: Unnecessary Subquery Nesting

```sql
-- NG: unnecessarily nested subqueries
SELECT * FROM (
    SELECT * FROM (
        SELECT * FROM (
            SELECT id, name, salary, department_id
            FROM employees
            WHERE salary > 500000
        ) AS step1
        WHERE department_id IN (10, 20, 30)
    ) AS step2
    ORDER BY salary DESC
) AS step3
LIMIT 10;

-- OK: consolidate into a single query
SELECT id, name, salary, department_id
FROM employees
WHERE salary > 500000
  AND department_id IN (10, 20, 30)
ORDER BY salary DESC
LIMIT 10;
```

---

## Edge Cases

### Edge Case 1: Comparison Against an Empty Result Set

```sql
-- Comparison with ALL against an empty set
-- salary > ALL (empty set) → TRUE (vacuously true: all elements satisfy the condition)
SELECT * FROM employees
WHERE salary > ALL (
    SELECT salary FROM employees WHERE department_id = 999
    -- returns empty set if department_id=999 does not exist
);
-- → all employees are returned

-- Comparison with ANY against an empty set
-- salary > ANY (empty set) → FALSE
SELECT * FROM employees
WHERE salary > ANY (
    SELECT salary FROM employees WHERE department_id = 999
);
-- → 0 rows returned

-- IN with an empty set
-- department_id IN (empty set) → FALSE
SELECT * FROM employees
WHERE department_id IN (
    SELECT id FROM departments WHERE location = 'Mars'
);
-- → 0 rows returned
```

### Edge Case 2: Scalar Subquery Returning Multiple Rows

```sql
-- A scalar subquery that returns more than one row causes an error
SELECT name, (
    SELECT salary FROM employees WHERE department_id = 10
    -- error if department 10 has multiple employees!
) AS salary
FROM departments;
-- → ERROR: more than one row returned by a subquery

-- Fix 1: use an aggregate function to guarantee a single row
SELECT name, (
    SELECT AVG(salary) FROM employees e WHERE e.department_id = d.id
) AS avg_salary
FROM departments d;

-- Fix 2: force a single row with LIMIT 1
SELECT name, (
    SELECT salary FROM employees e
    WHERE e.department_id = d.id
    ORDER BY salary DESC LIMIT 1
) AS max_salary
FROM departments d;
```

### Edge Case 3: Self-Referencing Subquery

```sql
-- Subquery that references the same table
-- "Employee whose salary is >= all colleagues in the same department" = highest earner per department
SELECT e.name, e.salary, e.department_id
FROM employees e
WHERE e.salary >= ALL (
    SELECT e2.salary FROM employees e2
    WHERE e2.department_id = e.department_id
);

-- Note: works correctly even when a department has only one person
-- (self-comparison: salary >= salary → TRUE)

-- "Employee who has no colleague with a higher salary" (equivalent NOT EXISTS version)
SELECT e.name, e.salary, e.department_id
FROM employees e
WHERE NOT EXISTS (
    SELECT 1 FROM employees e2
    WHERE e2.department_id = e.department_id
      AND e2.salary > e.salary
);
```

---

## Exercises

### Exercise 1 (Basic): Rewriting Subqueries

Rewrite the following IN subquery in three ways: using EXISTS, JOIN, and CTE.

```sql
-- Original query
SELECT * FROM products
WHERE category_id IN (
    SELECT id FROM categories WHERE is_active = TRUE
);
```

<details>
<summary>Sample Answer</summary>

```sql
-- EXISTS version
SELECT * FROM products p
WHERE EXISTS (
    SELECT 1 FROM categories c
    WHERE c.id = p.category_id AND c.is_active = TRUE
);

-- JOIN version
SELECT p.* FROM products p
JOIN categories c ON p.category_id = c.id
WHERE c.is_active = TRUE;

-- CTE version
WITH active_categories AS (
    SELECT id FROM categories WHERE is_active = TRUE
)
SELECT p.* FROM products p
JOIN active_categories ac ON p.category_id = ac.id;
```
</details>

### Exercise 2 (Applied): Subquery with Composite Conditions

Implement the following requirement in a single SQL statement.

**Requirement**: Retrieve employees in each department whose salary is at or above the department average AND who have been employed for at least 5 years. Also display the difference between the employee's salary and the department average.

<details>
<summary>Sample Answer</summary>

```sql
-- Method 1: correlated subquery
SELECT
    e.name,
    e.salary,
    e.department_id,
    e.salary - (
        SELECT AVG(e2.salary)
        FROM employees e2
        WHERE e2.department_id = e.department_id
    ) AS diff_from_dept_avg
FROM employees e
WHERE e.salary >= (
    SELECT AVG(e2.salary)
    FROM employees e2
    WHERE e2.department_id = e.department_id
)
AND e.hired_date <= CURRENT_DATE - INTERVAL '5 years';

-- Method 2: window function (recommended)
SELECT name, salary, department_id, diff_from_dept_avg
FROM (
    SELECT
        e.name,
        e.salary,
        e.department_id,
        e.hired_date,
        e.salary - AVG(e.salary) OVER (PARTITION BY e.department_id) AS diff_from_dept_avg,
        AVG(e.salary) OVER (PARTITION BY e.department_id) AS dept_avg
    FROM employees e
) sub
WHERE salary >= dept_avg
  AND hired_date <= CURRENT_DATE - INTERVAL '5 years';

-- Method 3: stepwise with CTE
WITH dept_avg AS (
    SELECT department_id, AVG(salary) AS avg_salary
    FROM employees
    GROUP BY department_id
)
SELECT
    e.name,
    e.salary,
    e.department_id,
    e.salary - da.avg_salary AS diff_from_dept_avg
FROM employees e
    JOIN dept_avg da ON e.department_id = da.department_id
WHERE e.salary >= da.avg_salary
  AND e.hired_date <= CURRENT_DATE - INTERVAL '5 years';
```
</details>

### Exercise 3 (Advanced): Performance Optimization

Optimize the following query, using the EXPLAIN ANALYZE output as a reference.

```sql
-- Slow query (before optimization)
SELECT
    c.name,
    (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count,
    (SELECT SUM(oi.quantity * oi.unit_price)
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     WHERE o.customer_id = c.id) AS lifetime_value,
    (SELECT MAX(o.order_date) FROM orders o WHERE o.customer_id = c.id) AS last_order
FROM customers c
WHERE (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) > 5;
-- → 4 correlated subqueries in SELECT + 1 in WHERE = 5 subquery executions
```

**Hint**: Consolidate the SELECT clause subqueries into a LATERAL JOIN or CTE.

<details>
<summary>Sample Answer</summary>

```sql
-- Optimized version: consolidated with CTE and JOIN
WITH customer_stats AS (
    SELECT
        o.customer_id,
        COUNT(*) AS order_count,
        MAX(o.order_date) AS last_order,
        SUM(oi.quantity * oi.unit_price) AS lifetime_value
    FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
    GROUP BY o.customer_id
    HAVING COUNT(*) > 5  -- move filter condition here
)
SELECT
    c.name,
    cs.order_count,
    cs.lifetime_value,
    cs.last_order
FROM customers c
    JOIN customer_stats cs ON c.id = cs.customer_id;

-- Improvement:
-- Before: customers × 5 subquery executions = O(N * 5M)
-- After:  scan orders/order_items once + 1 JOIN = O(M + N)
-- With 100,000 customers and 1,000,000 orders: tens of seconds → hundreds of milliseconds
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
# Exercise 1: basic implementation template
class Exercise1:
    """Exercise for basic implementation patterns"""

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

### Exercise 2: Applied Pattern

Extend the basic implementation by adding the following features.

```python
# Exercise 2: applied pattern
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise for applied patterns"""

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
# Exercise 3: performance optimization
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

    print(f"Slow version:  {slow_time:.4f}s")
    print(f"Fast version:  {fast_time:.6f}s")
    print(f"Speedup:       {slow_time/fast_time:.0f}x")

benchmark()
```

**Key points:**
- Be aware of algorithm complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technical decisions.

| Criterion | Prioritize when | Can compromise when |
|-----------|----------------|---------------------|
| Performance | Real-time processing, large-scale data | Admin screens, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-critical, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│          Architecture Selection Flow              │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. Team size?                                   │
│    ├─ Small (1-5)  → Monolith                    │
│    └─ Large (10+)  → go to 2                     │
│                                                 │
│  2. Deployment frequency?                        │
│    ├─ Weekly or less → Monolith + modules        │
│    └─ Daily / multiple → go to 3                 │
│                                                 │
│  3. Team independence?                           │
│    ├─ High   → Microservices                     │
│    └─ Medium → Modular monolith                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Every technical decision involves trade-offs. Analyze from the following perspectives:

**1. Short-term vs long-term cost**
- A faster short-term approach can become technical debt in the long run
- Conversely, over-engineering incurs high short-term costs and can delay projects

**2. Consistency vs flexibility**
- A unified tech stack lowers the learning cost
- Adopting diverse technologies enables best-fit choices but increases operational costs

**3. Level of abstraction**
- High abstraction improves reusability but can make debugging harder
- Low abstraction is intuitive but tends to lead to code duplication

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
        """Describe the background and problem"""
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

### Q1: Should I use a subquery or a CTE (WITH clause)?

Use a CTE when the same subquery is referenced multiple times (DRY principle). A subquery is fine when used only once. CTEs are often more readable. Performance depends on the RDBMS, but in PostgreSQL 12+ CTEs are inlined, so the difference is minimal.

### Q2: Are correlated subqueries always slow?

Not necessarily. The optimizer may internally convert them to JOINs. However, when the outer table has many rows, consider rewriting as a JOIN or window function. Always check the execution plan with EXPLAIN. PostgreSQL also has the ability to cache correlated subquery results.

### Q3: How deeply can subqueries be nested?

There is no technical limit enforced by the RDBMS, but for readability, up to 2 levels is recommended. More than 3 levels of nesting should be decomposed into CTEs or views to maintain readability.

### Q4: When should I use LATERAL?

LATERAL JOIN is especially effective in the following cases: (1) retrieving TOP-N per group, (2) needing to reference outer rows in the FROM clause, (3) placing multiple aggregated results in a single row. It enables "per-row calculations" that are not possible with ordinary JOINs.

### Q5: Should I avoid SELECT * in subqueries?

`SELECT *` inside EXISTS is fine (the optimizer ignores it). However, specifying only the necessary columns in IN subqueries or derived tables in the FROM clause helps the optimizer produce better execution plans.

### Q6: What should I watch out for when subquery results contain NULLs?

IN/NOT IN behave specially with NULLs. NOT IN excludes all rows if even one NULL is present. EXISTS/NOT EXISTS are not affected by NULLs. From a NULL-safety perspective, NOT EXISTS is recommended.

---

## Troubleshooting

### Common Subquery Problems and Solutions

| Problem | Cause | Solution |
|---------|-------|---------|
| NOT IN returns no results | NULL present in subquery | Rewrite as NOT EXISTS |
| Error in scalar subquery | Returning more than one row | Add aggregate function or LIMIT 1 |
| Slow subquery | N+1 problem with correlated subquery | Rewrite as JOIN or LATERAL |
| Duplicate results | Problem after rewriting IN as JOIN | Add DISTINCT or change to EXISTS |
| Out of memory | Materializing a large non-correlated subquery | Adjust work_mem, process in chunks |
| Unstable execution plan | Insufficient statistics | Update statistics with ANALYZE |

### Performance Debugging Flow

```
┌──── Subquery Performance Debugging ────────────┐
│                                                  │
│  Step 1: Check execution plan with EXPLAIN ANALYZE│
│  │                                               │
│  Step 2: Is there Nested Loop + SubPlan?         │
│  │  ├── Yes → N+1 problem with correlated subquery│
│  │  │         → Rewrite as JOIN or LATERAL       │
│  │  └── No → Step 3                              │
│  │                                               │
│  Step 3: Is there a Seq Scan?                    │
│  │  ├── Yes → Consider adding an index           │
│  │  └── No → Step 4                              │
│  │                                               │
│  Step 4: Is the estimated row count far off the  │
│  │       actual row count?                       │
│  │  ├── Yes → Update table statistics with ANALYZE│
│  │  └── No → Step 5                              │
│  │                                               │
│  Step 5: Check cost of Hash Join / Merge Join    │
│       → Consider adjusting work_mem              │
└──────────────────────────────────────────────────┘
```

---

## Security Notes

### SQL Injection and Subqueries

```sql
-- NG: embedding user input directly into a subquery
-- (pseudo-code: this is a problem that occurs in actual programming languages)
-- query = "SELECT * FROM products WHERE id IN (" + user_input + ")"
-- user_input = "1); DROP TABLE products; --"

-- OK: use prepared statements
-- Python (psycopg2)
-- cursor.execute(
--     "SELECT * FROM products WHERE id IN (SELECT id FROM categories WHERE name = %s)",
--     (user_input,)
-- )

-- OK: use ANY + array parameter for IN lists (PostgreSQL)
-- cursor.execute(
--     "SELECT * FROM products WHERE id = ANY(%s)",
--     ([1, 2, 3],)
-- )
```

---

## Summary

| Topic | Key points |
|-------|-----------|
| Non-correlated subquery | Independent of outer query. Executed only once |
| Correlated subquery | Depends on each outer row. May execute once per row. Optimizer may optimize |
| EXISTS | Best for existence checks. NULL-safe. Efficient due to short-circuit evaluation |
| NOT IN | NULL trap exists. NOT EXISTS is recommended |
| LATERAL JOIN | Correlated subquery in FROM clause. Effective for Top-N problems |
| Performance | Check execution plan with EXPLAIN. Consider rewriting as JOIN |
| Optimizer | IN/EXISTS are often automatically converted to Semi Join |
| CTE | Use CTEs for subqueries referenced multiple times to improve readability |

---

## What to Read Next

- [00-window-functions.md](../01-advanced/00-window-functions.md) — Replace subqueries with window functions
- [01-cte-recursive.md](../01-advanced/01-cte-recursive.md) — Organize complex subqueries with CTEs
- [04-query-optimization.md](../01-advanced/04-query-optimization.md) — Optimizing subqueries

---

## References

1. PostgreSQL Documentation — "Subquery Expressions" https://www.postgresql.org/docs/current/functions-subquery.html
2. Celko, J. (2010). *Joe Celko's SQL for Smarties*. Morgan Kaufmann.
3. Winand, M. (2012). *SQL Performance Explained*. Markus Winand. https://use-the-index-luke.com/
4. PostgreSQL Documentation — "LATERAL Subqueries" https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-LATERAL
5. MySQL Documentation — "Optimizing Subqueries" https://dev.mysql.com/doc/refman/8.0/en/subquery-optimization.html
6. Date, C.J. (2015). *SQL and Relational Theory*. O'Reilly Media. Chapter 12: Subqueries.

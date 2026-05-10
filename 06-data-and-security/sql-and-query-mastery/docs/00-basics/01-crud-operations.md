# CRUD Operations — Complete Guide to SELECT / INSERT / UPDATE / DELETE

> CRUD stands for Create, Read, Update, and Delete — the four most fundamental database operations. The data layer of every application is built from combinations of these four operations.

---

## What You Will Learn

1. Understand the complete syntax and logical execution order of SELECT statements
2. Learn safe execution patterns for INSERT / UPDATE / DELETE and how to leverage transactions
3. Master practical patterns such as the RETURNING clause, UPSERT, and soft deletes
4. Understand the performance characteristics and anti-patterns of each operation

---

## Prerequisites

- [00-sql-overview.md](./00-sql-overview.md) — SQL overview, relational model fundamentals, RDBMS selection
- Understanding of basic SQL data types (INTEGER, VARCHAR, DATE, DECIMAL, etc.)
- ../../security-fundamentals/docs/01-web-security/ — SQL injection countermeasures (recommended)

---

## 1. SELECT — Reading Data

SELECT is the most frequently used SQL statement and the only means of retrieving data from a database. Understanding SELECT is the foundation of SQL mastery.

### 1.1 Logical Execution Order of SELECT

One of the most common stumbling blocks for beginners is that the order in which you *write* a SELECT statement differs from the order in which it is *executed*.

```
┌──────────────────────────────────────────────────────┐
│         Logical Execution Order of SELECT             │
│                                                      │
│   Written Order         Execution Order              │
│   ─────────────         ────────────────             │
│   SELECT   ──────┐    ① FROM / JOIN                  │
│   FROM     ◀─────┤    ② ON (join condition)          │
│   WHERE    ──────┤    ③ WHERE (row filter)            │
│   GROUP BY ──────┤    ④ GROUP BY (grouping)           │
│   HAVING   ──────┤    ⑤ HAVING (group filter)        │
│   SELECT   ──────┤    ⑥ SELECT (expression eval, alias)│
│   DISTINCT ──────┤    ⑦ DISTINCT (deduplication)     │
│   ORDER BY ──────┤    ⑧ ORDER BY (sorting)           │
│   LIMIT    ──────┘    ⑨ LIMIT / OFFSET (row limit)   │
│                                                      │
│   Key implications:                                  │
│   - SELECT aliases cannot be used in WHERE           │
│     (WHERE executes before SELECT)                   │
│   - SELECT aliases can be used in ORDER BY           │
│     (ORDER BY executes after SELECT)                 │
│   - Aggregate functions can be used in HAVING        │
│     (HAVING executes after GROUP BY)                 │
└──────────────────────────────────────────────────────┘
```

### Code Example 1: Complete SELECT Syntax and Execution Order

```sql
-- Table setup
CREATE TABLE departments (
    id   INTEGER PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

CREATE TABLE employees (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    department_id INTEGER REFERENCES departments(id),
    salary        DECIMAL(10, 2),
    status        VARCHAR(20) DEFAULT 'active',
    hired_date    DATE NOT NULL DEFAULT CURRENT_DATE
);

INSERT INTO departments VALUES (1, '営業'), (2, '開発'), (3, '人事'), (4, '企画');
INSERT INTO employees (name, department_id, salary, status, hired_date) VALUES
    ('田中太郎', 1, 450000, 'active', '2020-04-01'),
    ('鈴木花子', 2, 520000, 'active', '2019-07-15'),
    ('佐藤次郎', 1, 380000, 'active', '2021-01-10'),
    ('高橋三郎', 2, 600000, 'active', '2018-04-01'),
    ('山田四郎', 3, 420000, 'active', '2022-04-01'),
    ('伊藤五郎', 2, 480000, 'inactive', '2017-10-01'),
    ('渡辺六子', 1, 510000, 'active', '2019-01-15');

-- Full SELECT syntax example
SELECT DISTINCT
    d.name AS department,              -- ⑥ Select and compute columns
    COUNT(*) AS employee_count,        -- ⑥ Evaluate aggregate function
    AVG(e.salary) AS avg_salary        -- ⑥ Evaluate aggregate function
FROM employees e                       -- ① Identify table
    INNER JOIN departments d           -- ① Join table
        ON e.department_id = d.id      -- ② Evaluate join condition
WHERE e.status = 'active'              -- ③ Row-level filter
GROUP BY d.name                        -- ④ Grouping
HAVING COUNT(*) >= 2                   -- ⑤ Group-level filter
ORDER BY avg_salary DESC               -- ⑧ Sorting
LIMIT 10;                              -- ⑨ Row limit
```

### Code Example 2: All WHERE Clause Condition Patterns

```sql
-- === Comparison operators ===
SELECT * FROM products WHERE price > 1000;               -- Greater than
SELECT * FROM products WHERE price >= 1000;              -- Greater than or equal
SELECT * FROM products WHERE price < 5000;               -- Less than
SELECT * FROM products WHERE price <= 5000;              -- Less than or equal
SELECT * FROM products WHERE price <> 1000;              -- Not equal (standard SQL)
SELECT * FROM products WHERE price != 1000;              -- Not equal (supported by most RDBMSs)

-- === Range ===
SELECT * FROM products WHERE price BETWEEN 1000 AND 5000;
-- ↑ Equivalent to price >= 1000 AND price <= 5000 (inclusive on both ends)

-- === Pattern matching (LIKE) ===
SELECT * FROM users WHERE name LIKE '田中%';             -- Prefix match
SELECT * FROM users WHERE email LIKE '%@gmail.com';      -- Suffix match
SELECT * FROM users WHERE name LIKE '%太%';              -- Contains match
SELECT * FROM users WHERE code LIKE 'A_B';               -- _ = any single character
-- Escaping in LIKE
SELECT * FROM products WHERE name LIKE '%25\%%' ESCAPE '\';  -- Contains '%'

-- === NULL checks ===
-- Important: = NULL does not work (three-valued logic)
SELECT * FROM users WHERE phone IS NULL;                  -- Rows where phone is NULL
SELECT * FROM users WHERE phone IS NOT NULL;              -- Rows where phone is not NULL

-- === IN / NOT IN ===
SELECT * FROM orders WHERE status IN ('pending', 'processing', 'shipped');
SELECT * FROM orders WHERE status NOT IN ('cancelled', 'refunded');

-- === Compound conditions (AND / OR) ===
SELECT * FROM products
WHERE (category = 'electronics' OR category = 'books')
  AND price < 5000
  AND stock > 0;

-- === EXISTS ===
SELECT * FROM customers c
WHERE EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.id AND o.total > 10000
);

-- === ANY / ALL ===
SELECT * FROM employees
WHERE salary > ALL (
    SELECT AVG(salary) FROM employees GROUP BY department_id
);

-- === CASE expression in WHERE ===
SELECT * FROM orders
WHERE CASE
    WHEN priority = 'high' THEN total_amount > 0
    WHEN priority = 'low'  THEN total_amount > 1000
    ELSE TRUE
END;
```

### Code Example 3: Advanced SELECT Clause Techniques

```sql
-- === Computed columns ===
SELECT
    name,
    salary,
    salary * 12 AS annual_salary,                    -- Annual salary
    salary * 12 * 1.1 AS annual_with_bonus,          -- Annual salary + bonus
    ROUND(salary / 160, 0) AS hourly_rate            -- Hourly rate equivalent
FROM employees;

-- === CASE expression (conditional branching) ===
SELECT
    name,
    salary,
    CASE
        WHEN salary >= 600000 THEN 'S'
        WHEN salary >= 500000 THEN 'A'
        WHEN salary >= 400000 THEN 'B'
        ELSE 'C'
    END AS grade,
    -- Simplified CASE expression (simple CASE)
    CASE status
        WHEN 'active'   THEN 'Active'
        WHEN 'inactive' THEN 'On Leave'
        WHEN 'retired'  THEN 'Retired'
        ELSE 'Unknown'
    END AS status_label
FROM employees;

-- === COALESCE (first non-NULL value) ===
SELECT
    name,
    COALESCE(phone, mobile, email, 'No contact') AS primary_contact
FROM employees;

-- === NULLIF (returns NULL if two values are equal) ===
-- Pattern to prevent division by zero
SELECT
    department_id,
    total_revenue,
    total_cost,
    total_revenue / NULLIF(total_cost, 0) AS cost_ratio  -- Avoid division by zero
FROM department_financials;

-- === Type conversion (CAST) ===
SELECT
    CAST(price AS INTEGER) AS rounded_price,
    CAST(created_at AS DATE) AS created_date,
    CAST(quantity AS VARCHAR(10)) || ' units' AS quantity_text
FROM products;

-- === Combined with subqueries ===
SELECT
    e.name,
    e.salary,
    (SELECT AVG(salary) FROM employees) AS company_avg,
    e.salary - (SELECT AVG(salary) FROM employees) AS diff_from_avg,
    ROUND(e.salary / (SELECT AVG(salary) FROM employees) * 100, 1) AS pct_of_avg
FROM employees e
ORDER BY diff_from_avg DESC;
```

### 1.2 ORDER BY Details

```sql
-- Basic sorting
SELECT * FROM employees ORDER BY salary DESC;                -- Descending
SELECT * FROM employees ORDER BY salary ASC;                 -- Ascending (default)
SELECT * FROM employees ORDER BY department_id ASC, salary DESC;  -- Multi-column sort

-- Controlling NULL sort order
SELECT * FROM employees ORDER BY department_id NULLS FIRST;  -- NULLs first
SELECT * FROM employees ORDER BY department_id NULLS LAST;   -- NULLs last

-- Sorting by column number (not recommended due to poor readability, but good to know)
SELECT name, salary FROM employees ORDER BY 2 DESC;  -- 2nd column = salary

-- Custom sort order with CASE expression
SELECT * FROM orders
ORDER BY
    CASE status
        WHEN 'urgent'     THEN 1
        WHEN 'processing' THEN 2
        WHEN 'pending'    THEN 3
        WHEN 'completed'  THEN 4
        ELSE 5
    END,
    created_at DESC;
```

### 1.3 DISTINCT and LIMIT

```sql
-- DISTINCT: Remove duplicate rows
SELECT DISTINCT department_id FROM employees;

-- DISTINCT ON (PostgreSQL-specific): Only the first row per group
SELECT DISTINCT ON (department_id) *
FROM employees
ORDER BY department_id, salary DESC;
-- → Returns the highest-paid employee from each department

-- LIMIT / OFFSET: Pagination
SELECT * FROM products
ORDER BY created_at DESC
LIMIT 20 OFFSET 0;     -- Page 1 (rows 1-20)

SELECT * FROM products
ORDER BY created_at DESC
LIMIT 20 OFFSET 20;    -- Page 2 (rows 21-40)

-- Standard SQL: FETCH FIRST
SELECT * FROM products
ORDER BY created_at DESC
OFFSET 20 ROWS
FETCH NEXT 20 ROWS ONLY;
```

---

## 2. INSERT — Creating Data

### 2.1 Internal Processing of INSERT

When INSERT is executed, the following processing occurs internally:

```
┌──────────────── INSERT Internal Processing Flow ────────────────┐
│                                                                  │
│  ① Parse and check permissions                                   │
│      └→ Verify table existence, check column types              │
│  ② Constraint checks                                             │
│      ├→ NOT NULL constraint                                      │
│      ├→ UNIQUE / PRIMARY KEY constraint                          │
│      ├→ FOREIGN KEY constraint (verify referenced row exists)    │
│      ├→ CHECK constraint                                         │
│      └→ Exclusion constraint (PostgreSQL EXCLUDE)                │
│  ③ Compute DEFAULT values and GENERATED columns                  │
│  ④ Execute triggers (BEFORE INSERT)                              │
│  ⑤ Insert row (write to WAL → update buffer pool)               │
│  ⑥ Update indexes (all related indexes)                          │
│  ⑦ Execute triggers (AFTER INSERT)                               │
│  ⑧ Evaluate RETURNING clause (PostgreSQL)                        │
│                                                                  │
│  * All of the above is executed atomically within a transaction  │
└──────────────────────────────────────────────────────────────────┘
```

### Code Example 4: Various INSERT Patterns

```sql
-- === Basic INSERT (single row) ===
INSERT INTO employees (name, department_id, salary, hired_date)
VALUES ('山田太郎', 10, 400000, '2024-04-01');

-- === Bulk INSERT (multiple rows) ===
-- Performance: 10~100x faster than individual INSERTs
INSERT INTO employees (name, department_id, salary, hired_date)
VALUES
    ('鈴木花子', 20, 450000, '2024-04-01'),
    ('佐藤次郎', 10, 380000, '2024-04-01'),
    ('高橋三郎', 30, 420000, '2024-04-01');

-- === INSERT from SELECT result ===
-- Ideal for data migration and archiving
INSERT INTO employee_archive (name, department_id, salary, archived_at)
SELECT name, department_id, salary, CURRENT_TIMESTAMP
FROM employees
WHERE status = 'retired';

-- === RETURNING clause to get inserted result (PostgreSQL) ===
-- Immediately retrieve auto-generated IDs on the application side
INSERT INTO employees (name, department_id, salary)
VALUES ('新人一号', 10, 350000)
RETURNING id, name, created_at;
-- → id=42, name='新人一号', created_at='2024-04-01 10:30:00'

-- === DEFAULT VALUES ===
-- When all columns have DEFAULT values or allow NULL
INSERT INTO audit_log DEFAULT VALUES;

-- === INSERT with CTE ===
-- Insert with complex transformations
WITH source_data AS (
    SELECT
        name,
        department_id,
        salary * 1.05 AS adjusted_salary  -- Insert with 5% raise applied
    FROM employees
    WHERE status = 'active' AND hired_date < '2020-01-01'
)
INSERT INTO salary_adjustments (employee_name, dept_id, new_salary, adjusted_at)
SELECT name, department_id, adjusted_salary, CURRENT_TIMESTAMP
FROM source_data;
```

### Code Example 5: UPSERT (Update if exists, Insert if not)

```sql
-- === PostgreSQL: ON CONFLICT ===
-- user_settings table: (user_id, key) has a UNIQUE constraint
CREATE TABLE user_settings (
    user_id    INTEGER NOT NULL,
    key        VARCHAR(100) NOT NULL,
    value      TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, key)
);

-- Update value if exists, otherwise insert new row
INSERT INTO user_settings (user_id, key, value)
VALUES (1, 'theme', 'dark')
ON CONFLICT (user_id, key)
DO UPDATE SET
    value = EXCLUDED.value,          -- EXCLUDED = the value that was attempted to be inserted
    updated_at = CURRENT_TIMESTAMP;

-- ON CONFLICT DO NOTHING: Ignore duplicates (no error)
INSERT INTO user_settings (user_id, key, value)
VALUES (1, 'theme', 'dark')
ON CONFLICT (user_id, key) DO NOTHING;

-- Conditional UPSERT: Only update if the new value is newer
INSERT INTO cache_entries (key, value, version)
VALUES ('user:1', '{"name":"田中"}', 5)
ON CONFLICT (key)
DO UPDATE SET
    value = EXCLUDED.value,
    version = EXCLUDED.version
WHERE cache_entries.version < EXCLUDED.version;  -- Only if version is newer

-- === MySQL: ON DUPLICATE KEY UPDATE ===
INSERT INTO user_settings (user_id, setting_key, setting_value)
VALUES (1, 'theme', 'dark')
ON DUPLICATE KEY UPDATE
    setting_value = VALUES(setting_value),
    updated_at = NOW();

-- === SQL Server: MERGE ===
MERGE INTO user_settings AS target
USING (VALUES (1, 'theme', 'dark')) AS source (user_id, key, value)
ON target.user_id = source.user_id AND target.key = source.key
WHEN MATCHED THEN
    UPDATE SET value = source.value, updated_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (user_id, key, value) VALUES (source.user_id, source.key, source.value);
```

---

## 3. UPDATE — Updating Data

### 3.1 Safe UPDATE Execution Procedure

When executing UPDATE in a production environment, following this protocol is recommended:

```
┌──────────── Safe UPDATE Execution Protocol ────────────┐
│                                                        │
│  Step 1: Verify target rows                            │
│  ┌──────────────────────────────────────────┐         │
│  │ SELECT * FROM employees                   │         │
│  │ WHERE department_id = 10                  │         │
│  │   AND performance_rating >= 4;            │         │
│  │ -- → 5 rows hit (verify as expected)      │         │
│  └──────────────────────────────────────────┘         │
│                                                        │
│  Step 2: Begin transaction                             │
│  ┌──────────────────────────────────────────┐         │
│  │ BEGIN;                                    │         │
│  └──────────────────────────────────────────┘         │
│                                                        │
│  Step 3: Execute UPDATE                                │
│  ┌──────────────────────────────────────────┐         │
│  │ UPDATE employees                          │         │
│  │ SET salary = salary * 1.05                │         │
│  │ WHERE department_id = 10                  │         │
│  │   AND performance_rating >= 4;            │         │
│  │ -- → UPDATE 5 (verify row count matches)  │         │
│  └──────────────────────────────────────────┘         │
│                                                        │
│  Step 4: Verify result                                 │
│  ┌──────────────────────────────────────────┐         │
│  │ SELECT * FROM employees                   │         │
│  │ WHERE department_id = 10                  │         │
│  │   AND performance_rating >= 4;            │         │
│  │ -- → Verify updated values are as expected│         │
│  └──────────────────────────────────────────┘         │
│                                                        │
│  Step 5: Commit or rollback                            │
│  ┌──────────────────────────────────────────┐         │
│  │ COMMIT;    -- Commit if no issues         │         │
│  │ -- ROLLBACK;  -- Rollback if issues found │         │
│  └──────────────────────────────────────────┘         │
└────────────────────────────────────────────────────────┘
```

### Code Example 6: Various UPDATE Patterns

```sql
-- === Basic UPDATE ===
UPDATE employees
SET salary = 500000
WHERE employee_id = 42;

-- === Update multiple columns simultaneously ===
UPDATE employees
SET salary = salary * 1.05,
    updated_at = CURRENT_TIMESTAMP
WHERE department_id = 10
  AND performance_rating >= 4;

-- === Update using expressions ===
-- Raise salaries for all employees based on their grade
UPDATE employees
SET salary = CASE
    WHEN grade = 'S' THEN salary * 1.10   -- Grade S: 10% raise
    WHEN grade = 'A' THEN salary * 1.07   -- Grade A: 7% raise
    WHEN grade = 'B' THEN salary * 1.05   -- Grade B: 5% raise
    ELSE salary * 1.03                     -- Others: 3% raise
END,
updated_at = CURRENT_TIMESTAMP
WHERE status = 'active';

-- === UPDATE with JOIN (PostgreSQL) ===
-- Cancel pending orders of banned customers
UPDATE orders o
SET status = 'cancelled',
    cancelled_at = NOW(),
    cancel_reason = 'customer_banned'
FROM customers c
WHERE o.customer_id = c.id
  AND c.is_banned = TRUE
  AND o.status = 'pending';

-- === UPDATE with JOIN (MySQL) ===
-- UPDATE orders o
-- INNER JOIN customers c ON o.customer_id = c.id
-- SET o.status = 'cancelled',
--     o.cancelled_at = NOW()
-- WHERE c.is_banned = TRUE
--   AND o.status = 'pending';

-- === UPDATE with subquery ===
UPDATE products
SET price = price * 0.9
WHERE category_id IN (
    SELECT id FROM categories WHERE name = 'セール対象'
);

-- === RETURNING clause to confirm update result (PostgreSQL) ===
UPDATE employees
SET salary = salary * 1.10
WHERE department_id = 20
RETURNING id, name, salary AS new_salary;

-- === Complex UPDATE with CTE ===
-- Raise salaries of employees below the department average to a minimum floor
WITH dept_min AS (
    SELECT department_id, AVG(salary) * 0.8 AS min_salary
    FROM employees
    WHERE status = 'active'
    GROUP BY department_id
)
UPDATE employees e
SET salary = dm.min_salary
FROM dept_min dm
WHERE e.department_id = dm.department_id
  AND e.salary < dm.min_salary
  AND e.status = 'active'
RETURNING e.id, e.name, e.salary AS adjusted_salary;
```

---

## 4. DELETE — Deleting Data

### 4.1 Hard Delete vs Soft Delete

```
┌──────────── Hard Delete vs Soft Delete ────────────────┐
│                                                        │
│  Hard Delete (Physical Delete)                         │
│  ┌─────────────────────────────────────┐              │
│  │ DELETE FROM users WHERE id = 42;     │              │
│  │                                      │              │
│  │ Pros:                                │              │
│  │ - Keeps the table simple             │              │
│  │ - Immediately frees storage          │              │
│  │ - No filter conditions needed        │              │
│  │                                      │              │
│  │ Cons:                                │              │
│  │ - Difficult to recover (backup only) │              │
│  │ - No audit trail remains             │              │
│  │ - Risk of cascading FK deletes       │              │
│  └─────────────────────────────────────┘              │
│                                                        │
│  Soft Delete (Logical Delete)                          │
│  ┌─────────────────────────────────────┐              │
│  │ UPDATE users                         │              │
│  │ SET deleted_at = CURRENT_TIMESTAMP,  │              │
│  │     status = 'deleted'               │              │
│  │ WHERE id = 42;                       │              │
│  │                                      │              │
│  │ Pros:                                │              │
│  │ - Easy to recover (just reset flag)  │              │
│  │ - Audit trail is preserved           │              │
│  │ - Referential integrity is maintained│              │
│  │                                      │              │
│  │ Cons:                                │              │
│  │ - All queries need WHERE deleted_at IS NULL│        │
│  │ - Storage keeps growing              │              │
│  │ - UNIQUE constraint design gets complex│            │
│  └─────────────────────────────────────┘              │
│                                                        │
│  Recommendation: Soft delete + periodic archive/purge  │
└────────────────────────────────────────────────────────┘
```

### Code Example 7: Safe DELETE Patterns

```sql
-- === Basic DELETE ===
DELETE FROM sessions
WHERE expires_at < CURRENT_TIMESTAMP;

-- === DELETE with JOIN (PostgreSQL: USING clause) ===
DELETE FROM order_items oi
USING orders o
WHERE oi.order_id = o.id
  AND o.status = 'cancelled';

-- === RETURNING clause to retrieve deleted rows ===
DELETE FROM notifications
WHERE user_id = 42 AND read_at IS NOT NULL
RETURNING id, message, created_at;

-- === Soft delete implementation pattern ===
-- Basic pattern
UPDATE users
SET deleted_at = CURRENT_TIMESTAMP,
    status = 'deleted',
    -- Anonymize personal information (GDPR compliance)
    email = 'deleted_' || id || '@deleted.example.com',
    name = 'Deleted User'
WHERE id = 42;

-- View for soft delete support
CREATE VIEW active_users AS
SELECT * FROM users WHERE deleted_at IS NULL;

-- Soft delete + UNIQUE constraint issue and solution
-- Problem: We want UNIQUE to apply only among rows where deleted_at IS NULL
-- PostgreSQL: Solve with a partial index
CREATE UNIQUE INDEX idx_users_email_active
ON users (email)
WHERE deleted_at IS NULL;

-- === TRUNCATE: Fast deletion of all rows in a table (DDL operation) ===
TRUNCATE TABLE temp_import_data;
-- * WHERE clause cannot be used
-- * TRUNCATE cannot be rolled back (MySQL), but can be in PostgreSQL
-- * Triggers do not fire
-- * Auto-increment sequences are reset

-- === TRUNCATE with CASCADE ===
-- Also TRUNCATE tables that reference this one via foreign keys
TRUNCATE TABLE orders CASCADE;  -- Also TRUNCATEs order_items

-- === Safe DELETE execution (with transaction) ===
BEGIN;
    -- Step 1: Verify rows to delete
    SELECT COUNT(*) FROM logs WHERE created_at < '2023-01-01';
    -- → 15,000 rows

    -- Step 2: Execute delete
    DELETE FROM logs WHERE created_at < '2023-01-01';
    -- → DELETE 15000

    -- Step 3: Verify and commit
    SELECT COUNT(*) FROM logs WHERE created_at < '2023-01-01';
    -- → 0 rows (as expected)
COMMIT;

-- === Batch deletion of large datasets (to minimize lock time) ===
-- Deleting all rows at once can cause long lock times; process in batches instead
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    LOOP
        DELETE FROM logs
        WHERE id IN (
            SELECT id FROM logs
            WHERE created_at < '2023-01-01'
            LIMIT 10000  -- Delete 10,000 rows per iteration
        );
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        EXIT WHEN deleted_count = 0;

        -- Give other transactions a chance to run
        PERFORM pg_sleep(0.1);
    END LOOP;
END $$;
```

---

## 5. Overall Data Flow of CRUD Operations

```
┌─────────────────── CRUD Operation Lifecycle ──────────────────┐
│                                                               │
│  Application Layer                                            │
│  ┌───────────────────────────────────────────┐               │
│  │  ORM / Query Builder / Raw SQL            │               │
│  │  Parameter binding (SQL injection prevention)│            │
│  └──────────────────┬────────────────────────┘               │
│                     │                                         │
│  Database Connection Layer   ▼                                │
│  ┌───────────────────────────────────────────┐               │
│  │  Connection pooling (PgBouncer, etc.)     │               │
│  │  Prepared statements                      │               │
│  └──────────────────┬────────────────────────┘               │
│                     │                                         │
│  Database Engine    ▼                                         │
│  ┌───────────────────────────────────────────┐               │
│  │                                           │               │
│  │  INSERT INTO → constraint check → add row │               │
│  │                → update indexes           │               │
│  │                                           │               │
│  │  SELECT FROM → generate plan → fetch data │               │
│  │              → filter → sort → return     │               │
│  │                                           │               │
│  │  UPDATE SET  → row lock → save old version│               │
│  │             → write new value → release   │               │
│  │                                           │               │
│  │  DELETE FROM → row lock → logical/physical│               │
│  │             → space management → release  │               │
│  │                                           │               │
│  └───────────────────────────────────────────┘               │
│                                                               │
│  WAL (Write-Ahead Log) → Persisted to disk                   │
└───────────────────────────────────────────────────────────────┘
```

---

## Comparison Tables

### DELETE vs TRUNCATE vs DROP

| Feature | DELETE | TRUNCATE | DROP |
|---------|--------|----------|------|
| Operation type | DML | DDL | DDL |
| WHERE clause | Supported | Not supported | Not supported |
| Rollback | Possible | DB-dependent (PG: yes, MySQL: no) | DB-dependent |
| Speed | Slow (row-level logging) | Fast (page-level) | Fast |
| Trigger fires | Yes | No | No |
| Auto-increment reset | No | Yes | N/A |
| Storage freed | No (VACUUM required) | Yes | Yes |
| Table structure | Remains | Remains | Removed |
| Required privileges | DML | DDL | DDL |
| Foreign key constraints | Constraint checked | May require CASCADE | Can specify CASCADE |

### INSERT Method Comparison

| Method | Use Case | Speed | Safety | RDBMS |
|--------|----------|-------|--------|-------|
| Single-row INSERT | Individual record insertion | Low | High | All |
| Multi-row INSERT | Batch insert (~1000 rows) | Medium | High | All |
| INSERT...SELECT | Data migration/copy | High | Medium | All |
| COPY / LOAD DATA | Bulk data import (millions~billions) | Fastest | Low | PG / MySQL |
| UPSERT | Idempotent insert/update | Medium | High | All (syntax varies) |
| INSERT...RETURNING | Immediate ID retrieval | Medium | High | PostgreSQL |
| Bulk INSERT (ORM) | Application-layer optimization | Medium~High | High | All |

### UPDATE/DELETE Method Comparison

| Method | Use Case | Lock Impact | Recommended For |
|--------|----------|-------------|-----------------|
| Simple WHERE | Update/delete small number of rows | Low | Routine operations |
| With JOIN/FROM | Update based on related table | Medium | Data integration |
| With subquery | Update with complex conditions | Medium~High | Multi-condition updates |
| With CTE | Update based on computed results | Medium | Updates using aggregates |
| Batch split | Update/delete large datasets | Low (split) | Large production updates |
| With RETURNING | Immediate confirmation of result | Low | Auditing, logging |

---

## Anti-Patterns

### Anti-Pattern 1: UPDATE/DELETE Without a WHERE Clause

```sql
-- NG: All rows will be updated!
UPDATE employees SET salary = 0;
-- → Every employee's salary becomes 0

-- NG: All rows will be deleted!
DELETE FROM employees;
-- → All employee data is gone

-- OK: Always specify target rows with a WHERE clause
UPDATE employees SET salary = 500000 WHERE employee_id = 42;

-- Safety measure 1: Verify with SELECT first
SELECT COUNT(*), MIN(salary), MAX(salary) FROM employees
WHERE department_id = 99;
-- → 5 rows, 320000~480000 (verify it looks reasonable)

DELETE FROM employees WHERE department_id = 99;

-- Safety measure 2: Wrap in a transaction
BEGIN;
    DELETE FROM employees WHERE department_id = 99;
    -- DELETE 5 ← Verify the row count is as expected
    -- If OK → COMMIT;
    -- If not → ROLLBACK;
COMMIT;

-- Safety measure 3: Enable safe_update mode in production DBs (MySQL)
-- SET sql_safe_updates = 1;
-- → UPDATE/DELETE without a WHERE clause will result in an error
```

**WHY**: UPDATE and DELETE without a WHERE clause affect every row in the database. An accidental "delete all" in a production environment can be a fatal loss for a company. This problem should be prevented through *systems and processes*, not developer vigilance.

### Anti-Pattern 2: Overuse of SELECT *

```sql
-- NG: Retrieve all columns, including unnecessary ones
SELECT * FROM orders;

-- Problems:
-- 1. Wastes network bandwidth (especially severe with BLOB/TEXT columns)
--    Example: 1 million rows × unnecessary BLOB column = GB-scale network transfer
-- 2. Application breaks when table structure changes
--    Example: ORM mappings break when columns are added/removed/reordered
-- 3. Index-only scans (covering indexes) do not apply
--    Example: Even with CREATE INDEX ON orders(status, customer_id),
--             SELECT * requires full heap access for every row
-- 4. Execution plan becomes inefficient
--    Unnecessary column deserialization, memory consumption, increased sort cost

-- OK: Explicitly specify only the needed columns
SELECT order_id, customer_id, total_amount, status
FROM orders
WHERE status = 'pending';

-- Exception: SELECT * is acceptable during interactive exploration or debugging
-- However, always add LIMIT
SELECT * FROM orders LIMIT 10;
```

**WHY**: SELECT * violates the fundamental principle of database operations: "retrieve only the necessary and sufficient data." Especially in large tables, the accumulated transfer cost of unnecessary columns can have a serious performance impact.

### Anti-Pattern 3: Building SQL by String Concatenation

```sql
-- NG: SQL injection vulnerability
-- Python pseudocode
-- query = f"SELECT * FROM users WHERE name = '{user_input}'"
-- user_input = "'; DROP TABLE users; --"
-- → SELECT * FROM users WHERE name = ''; DROP TABLE users; --'

-- OK: Parameter binding (prepared statements)
-- Python (psycopg2)
-- cursor.execute("SELECT * FROM users WHERE name = %s", (user_input,))
-- Java (JDBC)
-- PreparedStatement ps = conn.prepareStatement("SELECT * FROM users WHERE name = ?");
-- ps.setString(1, userInput);
-- Node.js (pg)
-- client.query('SELECT * FROM users WHERE name = $1', [userInput])

-- Prepared statement in PostgreSQL
PREPARE get_user (TEXT) AS
SELECT * FROM users WHERE name = $1;

EXECUTE get_user('田中太郎');

DEALLOCATE get_user;
```

**WHY**: SQL injection is one of the oldest-known and most damaging web application vulnerabilities. Using parameter binding prevents user input from being interpreted as SQL syntax.

---

## Hands-on Exercises

### Exercise 1 (Basic): Basic CRUD on Employee Data

Write SQL for the specified CRUD operations against the table definitions below.

```sql
CREATE TABLE departments (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE employees (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    department_id INTEGER REFERENCES departments(id),
    salary        DECIMAL(10, 2) NOT NULL CHECK (salary >= 0),
    status        VARCHAR(20) DEFAULT 'active',
    hired_date    DATE NOT NULL DEFAULT CURRENT_DATE
);
```

1. Insert "Sales", "Engineering", and "HR" into the departments table
2. Insert 5 employees into the employees table (use multi-row INSERT)
3. Retrieve only the employees in the Engineering department, ordered by salary descending
4. Give all employees in the Sales department a 5% salary raise
5. Soft-delete employees with status 'retired' (set status='deleted' and deleted_at)

<details>
<summary>Model Answer</summary>

```sql
-- 1. Insert into departments table
INSERT INTO departments (name) VALUES ('営業'), ('開発'), ('人事');

-- 2. Insert 5 employees
INSERT INTO employees (name, email, department_id, salary, status, hired_date) VALUES
    ('田中太郎', 'tanaka@example.com', 1, 450000, 'active', '2020-04-01'),
    ('鈴木花子', 'suzuki@example.com', 2, 520000, 'active', '2019-07-15'),
    ('佐藤次郎', 'sato@example.com',   1, 380000, 'active', '2021-01-10'),
    ('高橋三郎', 'takahashi@example.com', 2, 600000, 'active', '2018-04-01'),
    ('山田四郎', 'yamada@example.com', 3, 420000, 'active', '2022-04-01');

-- 3. Retrieve Engineering department employees ordered by salary
SELECT e.id, e.name, e.salary
FROM employees e
    INNER JOIN departments d ON e.department_id = d.id
WHERE d.name = '開発'
ORDER BY e.salary DESC;

-- 4. Give Sales department employees a 5% raise
UPDATE employees
SET salary = salary * 1.05
WHERE department_id = (SELECT id FROM departments WHERE name = '営業');
-- Or alternatively
UPDATE employees e
SET salary = salary * 1.05
FROM departments d
WHERE e.department_id = d.id AND d.name = '営業';

-- 5. Soft-delete retired employees
-- First add the deleted_at column (modify existing table)
ALTER TABLE employees ADD COLUMN deleted_at TIMESTAMP;

UPDATE employees
SET status = 'deleted',
    deleted_at = CURRENT_TIMESTAMP
WHERE status = 'retired';
```

</details>

### Exercise 2 (Intermediate): Safe Bulk Data Operations

Write SQL for the following scenarios. All operations must be executed safely within a transaction.

1. In the `products` table, reduce the price of products with zero stock by 10%, and confirm the result with RETURNING
2. In the `orders` table, move orders created before 2023 with status 'completed' to an archive table (INSERT...SELECT → DELETE)
3. Write a "batch delete" for the `user_sessions` table to delete sessions that expired more than 24 hours ago (limit each delete to 5000 rows)

```sql
-- Table definitions
CREATE TABLE products (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE orders (
    id         SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    total      DECIMAL(10, 2),
    status     VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders_archive (LIKE orders INCLUDING ALL);

CREATE TABLE user_sessions (
    id         UUID PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

<details>
<summary>Model Answer</summary>

```sql
-- 1. 10% price reduction for out-of-stock products (with RETURNING)
BEGIN;
    -- Verify targets
    SELECT id, name, price, stock FROM products WHERE stock = 0;

    -- Execute price reduction
    UPDATE products
    SET price = ROUND(price * 0.9, 2)
    WHERE stock = 0
    RETURNING id, name, price AS new_price;
COMMIT;

-- 2. Archive old completed orders
BEGIN;
    -- Step 1: Copy to archive table
    INSERT INTO orders_archive (id, customer_id, total, status, created_at)
    SELECT id, customer_id, total, status, created_at
    FROM orders
    WHERE created_at < '2023-01-01'
      AND status = 'completed';
    -- → INSERT 0 12345

    -- Step 2: Delete from original table only after confirming copy is done
    DELETE FROM orders
    WHERE created_at < '2023-01-01'
      AND status = 'completed';
    -- → DELETE 12345 (verify row count matches INSERT)

    -- Step 3: Verify
    SELECT COUNT(*) FROM orders_archive WHERE created_at < '2023-01-01';
    -- → 12345
COMMIT;

-- 3. Batch deletion of expired sessions
DO $$
DECLARE
    batch_size CONSTANT INTEGER := 5000;
    deleted_count INTEGER;
    total_deleted INTEGER := 0;
BEGIN
    LOOP
        DELETE FROM user_sessions
        WHERE id IN (
            SELECT id FROM user_sessions
            WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
            LIMIT batch_size
            FOR UPDATE SKIP LOCKED  -- Avoid lock contention
        );
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        total_deleted := total_deleted + deleted_count;

        -- Progress log (RAISE NOTICE is PostgreSQL-specific)
        RAISE NOTICE 'Deleted % sessions (total: %)', deleted_count, total_deleted;

        EXIT WHEN deleted_count < batch_size;  -- Exit when remaining rows are less than batch size

        -- Give other transactions a chance to run
        PERFORM pg_sleep(0.1);
    END LOOP;

    RAISE NOTICE 'Total deleted: % sessions', total_deleted;
END $$;
```

**Key Points:**
- `FOR UPDATE SKIP LOCKED` skips rows already locked by other transactions (prevents deadlocks)
- Limiting batch size reduces lock duration
- `PERFORM pg_sleep(0.1)` gives other transactions a chance to execute

</details>

### Exercise 3 (Advanced): Combining UPSERT and RETURNING

Implement a shopping cart feature for an e-commerce site. Write SQL that satisfies the following requirements.

Requirements:
1. When adding a product to the cart, if the same product already exists, add to its quantity (UPSERT)
2. Retrieve the cart contents with product name and price
3. Calculate the total amount of the cart
4. Remove a specific product from the cart and return the removed item using RETURNING
5. Check for expired carts (auto-delete carts not updated in over 30 days)

```sql
CREATE TABLE cart_items (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity   INTEGER NOT NULL CHECK (quantity > 0),
    added_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, product_id)
);
```

<details>
<summary>Model Answer</summary>

```sql
-- 1. Add product to cart (UPSERT: add to quantity if already exists)
INSERT INTO cart_items (user_id, product_id, quantity)
VALUES (42, 101, 2)
ON CONFLICT (user_id, product_id)
DO UPDATE SET
    quantity = cart_items.quantity + EXCLUDED.quantity,
    updated_at = CURRENT_TIMESTAMP
RETURNING id, product_id, quantity AS total_quantity;
-- → If quantity was already 3: total_quantity=5

-- 2. Retrieve cart contents with product information
SELECT
    ci.id AS cart_item_id,
    p.name AS product_name,
    p.price AS unit_price,
    ci.quantity,
    p.price * ci.quantity AS subtotal,
    ci.added_at
FROM cart_items ci
    INNER JOIN products p ON ci.product_id = p.id
WHERE ci.user_id = 42
ORDER BY ci.added_at;

-- 3. Total cart amount
SELECT
    ci.user_id,
    COUNT(*) AS item_count,
    SUM(ci.quantity) AS total_quantity,
    SUM(p.price * ci.quantity) AS total_amount
FROM cart_items ci
    INNER JOIN products p ON ci.product_id = p.id
WHERE ci.user_id = 42
GROUP BY ci.user_id;

-- 4. Remove a specific product from the cart (with RETURNING)
DELETE FROM cart_items
WHERE user_id = 42 AND product_id = 101
RETURNING id, product_id, quantity;
-- → id=7, product_id=101, quantity=5

-- 5. Auto-delete expired carts
WITH expired_carts AS (
    DELETE FROM cart_items
    WHERE updated_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
    RETURNING user_id, product_id, quantity
)
SELECT
    user_id,
    COUNT(*) AS items_removed,
    SUM(quantity) AS total_quantity_removed
FROM expired_carts
GROUP BY user_id;
-- → user_id=15, items_removed=3, total_quantity_removed=8
-- → user_id=23, items_removed=1, total_quantity_removed=2

-- Bonus: Bulk update of cart contents (quantity changes)
UPDATE cart_items
SET quantity = new_data.quantity,
    updated_at = CURRENT_TIMESTAMP
FROM (VALUES
    (42, 101, 3),  -- user_id=42, product_id=101, new_quantity=3
    (42, 102, 1),  -- user_id=42, product_id=102, new_quantity=1
    (42, 103, 5)   -- user_id=42, product_id=103, new_quantity=5
) AS new_data (user_id, product_id, quantity)
WHERE cart_items.user_id = new_data.user_id
  AND cart_items.product_id = new_data.product_id
RETURNING cart_items.product_id, cart_items.quantity;
```

**Design Points:**
- UPSERT makes "add to cart" an idempotent operation (safe to execute the same request multiple times)
- RETURNING eliminates the need for an additional SELECT query (reduces round trips)
- Combining CTE with DELETE...RETURNING executes deletion and aggregation in a single query

</details>


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Misconfigured settings file | Verify the settings file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout value, add retry logic |
| Out of memory | Increased data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Verify executing user's permissions, review configuration |
| Data inconsistency | Race condition in concurrent processing | Introduce locking mechanism, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace and identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Stepwise verification**: Use log output or a debugger to verify hypotheses
5. **Fix and regression test**: After fixing, also run tests for related areas

```python
# Debugging utility
import logging
import traceback
from functools import wraps

# Logger configuration
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

def debug_decorator(func):
    """Decorator that logs function input and output"""
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

### Diagnosing Performance Issues

Steps for diagnosing performance issues:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Check for memory leaks
3. **Check I/O wait**: Review disk and network I/O status
4. **Check concurrent connections**: Review connection pool status

| Problem Type | Diagnostic Tool | Solution |
|--------------|----------------|----------|
| High CPU load | cProfile, py-spy | Algorithm improvements, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Asynchronous I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes judgment criteria for making technology choices.

| Criterion | When to prioritize | When to compromise |
|-----------|--------------------|--------------------|
| Performance | Real-time processing, large-scale data | Admin screens, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, speed to market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow            │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① Team size?                                   │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → Go to ②              │
│                                                 │
│  ② Deployment frequency?                        │
│    ├─ Weekly or less → Monolith + modular split  │
│    └─ Daily / multiple times → Go to ③          │
│                                                 │
│  ③ Team independence?                           │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Costs**
- A fast short-term approach can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can cause project delays

**2. Consistency vs Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies allows the right tool for the job but increases operational costs

**3. Level of Abstraction**
- Higher abstraction offers better reusability but can make debugging harder
- Lower abstraction is more intuitive but prone to code duplication

```python
# Design decision record template
class ArchitectureDecisionRecord:
    """Create an ADR (Architecture Decision Record)"""

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

## FAQ

### Q1: Can I reference the "old value" in an UPDATE statement?

In PostgreSQL, the RETURNING clause retrieves the value *after* the update, but the value before the update cannot be retrieved directly. If you need the old value, use a CTE:

```sql
WITH old AS (
    SELECT id, salary FROM employees WHERE id = 42
)
UPDATE employees SET salary = salary * 1.1 WHERE id = 42
RETURNING id,
    (SELECT salary FROM old) AS old_salary,
    salary AS new_salary;
-- → id=42, old_salary=450000, new_salary=495000
```

Another approach is to set up an audit trigger:

```sql
CREATE TABLE salary_audit (
    id          SERIAL PRIMARY KEY,
    employee_id INTEGER,
    old_salary  DECIMAL(10, 2),
    new_salary  DECIMAL(10, 2),
    changed_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION log_salary_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.salary <> NEW.salary THEN
        INSERT INTO salary_audit (employee_id, old_salary, new_salary)
        VALUES (OLD.id, OLD.salary, NEW.salary);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_salary_audit
    AFTER UPDATE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION log_salary_change();
```

### Q2: How can I speed up large-volume INSERTs?

Speed estimates and recommended methods:

| Method | Speed estimate (1M rows) | Recommended For |
|--------|--------------------------|-----------------|
| Individual INSERT | Tens of minutes | Do not use |
| Multi-row INSERT (1000 rows/batch) | Several minutes | Small~medium scale |
| COPY (PostgreSQL) | Tens of seconds | Large-scale data import |
| LOAD DATA (MySQL) | Tens of seconds | Large-scale data import |
| Disable indexes + COPY + rebuild | Seconds~tens of seconds | Initial data load |

```sql
-- PostgreSQL: COPY (fastest)
COPY employees (name, department_id, salary, hired_date)
FROM '/path/to/data.csv'
WITH (FORMAT CSV, HEADER TRUE, DELIMITER ',');

-- For even faster performance
BEGIN;
    -- 1. Temporarily disable indexes
    ALTER TABLE employees DISABLE TRIGGER ALL;
    DROP INDEX IF EXISTS idx_employees_dept;

    -- 2. Execute COPY
    COPY employees FROM '/path/to/data.csv' WITH (FORMAT CSV, HEADER);

    -- 3. Rebuild indexes
    CREATE INDEX idx_employees_dept ON employees(department_id);
    ALTER TABLE employees ENABLE TRIGGER ALL;

    -- 4. Update statistics
    ANALYZE employees;
COMMIT;
```

### Q3: Should I use soft delete or hard delete?

Decision criteria:

| Condition | Recommendation |
|-----------|----------------|
| Legal requirement to retain records | Soft delete |
| Providing "undo" functionality to users | Soft delete |
| Audit trail required | Soft delete |
| Large data volume with storage constraints | Hard delete + archive |
| GDPR "right to be forgotten" compliance | Hard delete (after anonymization) |
| Want to keep table design simple | Hard delete |

In practice, **soft delete + periodic archive/purge** is the most balanced choice. Soft-deleted data is moved to an archive table after a certain period, and then physically deleted after another period.

### Q4: Which RDBMSs support the RETURNING clause?

| RDBMS | RETURNING Support | Alternative |
|-------|-------------------|-------------|
| PostgreSQL | Full support for INSERT/UPDATE/DELETE | - |
| SQLite | Full support for INSERT/UPDATE/DELETE (3.35.0+) | - |
| MySQL | Not supported | `LAST_INSERT_ID()` / `SELECT` |
| SQL Server | `OUTPUT` clause (equivalent feature) | `SCOPE_IDENTITY()` |
| Oracle | `RETURNING INTO` (within PL/SQL) | sequence.CURRVAL |

### Q5: What is the maximum number of rows insertable in a single INSERT statement?

| RDBMS | Max rows | Recommended batch size |
|-------|----------|------------------------|
| PostgreSQL | No limit (memory-dependent) | 1,000~10,000 rows |
| MySQL | No limit (max_allowed_packet-dependent) | ~1,000 rows |
| SQLite | 500 rows (compile-time setting) | 500 rows |
| SQL Server | 1,000 rows (for literal values) | 1,000 rows |

---

## Summary

| Operation | SQL Statement | Key Cautions |
|-----------|---------------|--------------|
| CREATE | `INSERT INTO ... VALUES` | Constraint violations, duplicate keys, batch size |
| READ | `SELECT ... FROM ... WHERE` | Understand execution order, avoid SELECT *, leverage indexes |
| UPDATE | `UPDATE ... SET ... WHERE` | Prevent missing WHERE clause, use transactions |
| DELETE | `DELETE FROM ... WHERE` | Prevent missing WHERE clause, choose soft/hard delete |
| UPSERT | `ON CONFLICT DO UPDATE` | Dialect differences are large; design for idempotency |
| RETURNING | `INSERT/UPDATE/DELETE ... RETURNING` | Available in PostgreSQL/SQLite |
| Safety | `BEGIN` → verify → `COMMIT/ROLLBACK` | Always use transactions for production operations |
| Parameter binding | `$1` / `?` / `%s` | Essential means of SQL injection prevention |

---

## What to Read Next

- [02-joins.md](./02-joins.md) — All types of JOINs for combining multiple tables
- [03-aggregation.md](./03-aggregation.md) — Data analysis with GROUP BY and aggregate functions
- [04-subqueries.md](./04-subqueries.md) — Practical patterns for subqueries
- [../01-advanced/02-transactions.md](../01-advanced/02-transactions.md) — In-depth transaction management
- ../../security-fundamentals/docs/01-web-security/ — SQL injection countermeasures

---

## References

1. PostgreSQL Documentation — "Data Manipulation" https://www.postgresql.org/docs/current/dml.html
2. PostgreSQL Documentation — "INSERT" https://www.postgresql.org/docs/current/sql-insert.html
3. MySQL Reference Manual — "Data Manipulation Statements" https://dev.mysql.com/doc/refman/8.0/en/sql-data-manipulation-statements.html
4. Karwin, B. (2010). *SQL Antipatterns: Avoiding the Pitfalls of Database Programming*. Pragmatic Bookshelf.
5. Winand, M. (2012). *SQL Performance Explained*. Markus Winand. https://use-the-index-luke.com/
6. OWASP — "SQL Injection Prevention Cheat Sheet" https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html

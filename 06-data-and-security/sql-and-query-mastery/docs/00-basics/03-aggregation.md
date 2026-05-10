# Aggregation -- GROUP BY, HAVING, and Aggregate Functions

> Aggregation operations summarize multiple rows of data into a single value, forming the foundation of reporting and analytical queries. Aggregate functions are defined in the SQL standard and, combined with GROUP BY and HAVING, provide the building blocks for any business report.

## Prerequisites

- Basic syntax of SELECT / WHERE / FROM (01-select.md)
- Foundational knowledge of data types (numeric, string, date)
- Understanding of NULL and three-valued logic

## What You Will Learn

1. How major aggregate functions (COUNT, SUM, AVG, MIN, MAX) work and their internal implementation
2. Correct usage of GROUP BY and HAVING, and a complete understanding of execution order
3. Multi-dimensional aggregation with GROUPING SETS, ROLLUP, and CUBE
4. Statistical functions (STDDEV, VARIANCE, PERCENTILE) and string/array aggregation
5. Performance optimization of aggregate queries and how to read execution plans
6. Compatibility of aggregate functions across RDBMSs and migration considerations

---

## 1. Basics of Aggregate Functions

### Internal Behavior of Aggregate Functions

```
┌──────── Internal Processing Flow of Aggregate Functions ───────────┐
│                                                                     │
│  Input rows: [100, NULL, 200, NULL, 300, 150, 200]                 │
│                                                                     │
│  ■ COUNT(*):                                                        │
│    Counts all rows → 7                                              │
│    All rows including NULLs are counted                             │
│                                                                     │
│  ■ COUNT(col):                                                      │
│    Excludes NULLs and counts → 5                                    │
│    [100, 200, 300, 150, 200]                                        │
│                                                                     │
│  ■ COUNT(DISTINCT col):                                             │
│    Counts unique values → 4                                         │
│    {100, 150, 200, 300}                                             │
│                                                                     │
│  ■ SUM(col):                                                        │
│    Excludes NULLs and sums → 950                                    │
│    100 + 200 + 300 + 150 + 200                                      │
│                                                                     │
│  ■ AVG(col):                                                        │
│    Excludes NULLs and averages → 190 (= 950 / 5)                   │
│    NOTE: This is the average of 5 rows, not 7!                      │
│                                                                     │
│  ■ MIN(col) / MAX(col):                                             │
│    Excludes NULLs → min: 100 / max: 300                             │
│                                                                     │
│  ★ Important: When all rows are NULL                                │
│    COUNT(*) → row count (0 or more)                                 │
│    COUNT(col) → 0                                                   │
│    SUM/AVG/MIN/MAX → NULL (not 0!)                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Code Example 1: Basic Aggregate Functions

```sql
-- Sample table
CREATE TABLE sales (
    id          SERIAL PRIMARY KEY,
    product     VARCHAR(50),
    category    VARCHAR(30),
    amount      DECIMAL(10, 2),
    quantity    INTEGER,
    sale_date   DATE,
    region      VARCHAR(20),
    salesperson VARCHAR(50)
);

-- Insert sample data
INSERT INTO sales (product, category, amount, quantity, sale_date, region, salesperson) VALUES
    ('ノートPC', '家電', 89000, 2, '2024-01-15', '東京', '田中'),
    ('マウス', '周辺機器', 3500, 10, '2024-01-20', '東京', '佐藤'),
    ('モニター', '家電', 45000, 3, '2024-02-01', '大阪', '鈴木'),
    ('キーボード', '周辺機器', 8000, 5, '2024-02-15', '大阪', '田中'),
    ('プリンター', '家電', 32000, 1, '2024-03-01', '東京', '佐藤'),
    ('USBメモリ', '周辺機器', 1500, 20, '2024-03-10', '福岡', '高橋'),
    ('タブレット', '家電', 55000, 2, '2024-03-20', '東京', '田中'),
    ('ヘッドセット', '周辺機器', 12000, 4, '2024-04-01', '大阪', '鈴木'),
    ('デスクトップPC', '家電', 120000, 1, '2024-04-15', '福岡', '高橋'),
    ('Webカメラ', '周辺機器', 5000, 8, '2024-04-20', '東京', '佐藤');

-- Basic aggregate functions
SELECT
    COUNT(*)          AS total_rows,        -- Total row count: 10
    COUNT(amount)     AS non_null_count,    -- Non-NULL row count: 10
    COUNT(DISTINCT category) AS categories, -- Unique value count: 2
    SUM(amount)       AS total_sales,       -- Total
    AVG(amount)       AS avg_sale,          -- Average
    MIN(amount)       AS min_sale,          -- Minimum
    MAX(amount)       AS max_sale,          -- Maximum
    MIN(sale_date)    AS first_sale,        -- Earliest date
    MAX(sale_date)    AS last_sale          -- Latest date
FROM sales;

-- Conditional aggregation (using CASE expressions)
SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN category = '家電' THEN amount ELSE 0 END) AS electronics_total,
    SUM(CASE WHEN category = '周辺機器' THEN amount ELSE 0 END) AS peripheral_total,
    AVG(CASE WHEN region = '東京' THEN amount END) AS tokyo_avg,
    -- Rows returning NULL are not included in the AVG denominator
    COUNT(CASE WHEN amount > 50000 THEN 1 END) AS high_value_count
FROM sales;
```

### Code Example 2: Three Uses of COUNT and Their Caveats

```sql
-- COUNT(*): Counts all rows including NULLs
SELECT COUNT(*) FROM employees;           -- → 100

-- COUNT(column): Counts rows excluding NULLs
SELECT COUNT(phone) FROM employees;       -- → 85 (15 have NULL)

-- COUNT(DISTINCT column): Counts unique values
SELECT COUNT(DISTINCT department_id) FROM employees;  -- → 8

-- ★ Multi-column COUNT(DISTINCT) (PostgreSQL)
SELECT COUNT(DISTINCT (department_id, status)) FROM employees;
-- → Count of unique (department_id, status) combinations

-- ★ Caution: Behavior when all rows are NULL
CREATE TABLE empty_test (val INTEGER);
INSERT INTO empty_test VALUES (NULL), (NULL), (NULL);

SELECT
    COUNT(*)    AS star,   -- 3 (counts rows)
    COUNT(val)  AS col,    -- 0 (NULLs excluded)
    SUM(val)    AS total,  -- NULL (not 0!)
    AVG(val)    AS average -- NULL
FROM empty_test;

-- If you want SUM/AVG to return 0 when NULL
SELECT COALESCE(SUM(val), 0) AS safe_sum FROM empty_test;
```

### Code Example 3: NULL Behavior in Aggregate Functions in Detail

```sql
-- Demonstrating the impact of NULL
CREATE TABLE scores (
    student_id INTEGER,
    subject    VARCHAR(20),
    score      INTEGER  -- NULL means the exam was not taken
);

INSERT INTO scores VALUES
    (1, '数学', 80), (1, '英語', 90), (1, '国語', NULL),
    (2, '数学', 70), (2, '英語', NULL), (2, '国語', 60),
    (3, '数学', NULL), (3, '英語', NULL), (3, '国語', NULL);

-- Aggregation per student
SELECT
    student_id,
    COUNT(*) AS total_subjects,           -- Total subjects
    COUNT(score) AS taken_subjects,       -- Subjects taken
    SUM(score) AS total_score,            -- Total score (NULLs ignored)
    AVG(score) AS avg_score,              -- Average (taken subjects only)
    AVG(COALESCE(score, 0)) AS avg_with_zero  -- Treat untaken as 0
FROM scores
GROUP BY student_id
ORDER BY student_id;

-- Result:
-- student_id | total | taken | sum | avg  | avg_with_zero
-- 1          | 3     | 2     | 170 | 85.0 | 56.67
-- 2          | 3     | 2     | 130 | 65.0 | 43.33
-- 3          | 3     | 0     | NULL| NULL | 0.00
```

---

## 2. GROUP BY

### SQL Logical Execution Order

```
┌──────── SQL Logical Execution Order (with Aggregation) ──────────────┐
│                                                                       │
│  ① FROM / JOIN     Join tables and generate the Cartesian product    │
│  ② WHERE           Row-level filter (before aggregation)             │
│  ③ GROUP BY        Group rows                                        │
│  ④ Aggregate       Evaluate SUM, COUNT, AVG, etc.                   │
│  ⑤ HAVING          Group-level filter (after aggregation)            │
│  ⑥ SELECT          Select columns and evaluate expressions           │
│  ⑦ DISTINCT        Remove duplicates                                 │
│  ⑧ ORDER BY        Sort                                              │
│  ⑨ LIMIT/OFFSET    Limit results                                     │
│                                                                       │
│  ★ Key rules:                                                        │
│  - Aggregate functions cannot be used in WHERE (executed before ③)   │
│  - All non-aggregate columns in SELECT must appear in GROUP BY        │
│  - Aliases of aggregate functions can be used in ORDER BY             │
│  - Aggregate functions can be used in HAVING                          │
└───────────────────────────────────────────────────────────────────────┘
```

### Code Example 4: GROUP BY Basics and Applications

```sql
-- Basic: Sales aggregation by category
SELECT
    category,
    COUNT(*) AS sales_count,
    SUM(amount) AS total_amount,
    ROUND(AVG(amount), 2) AS avg_amount,
    MIN(amount) AS min_amount,
    MAX(amount) AS max_amount
FROM sales
GROUP BY category
ORDER BY total_amount DESC;

-- Group by multiple columns
SELECT
    category,
    region,
    COUNT(*) AS sales_count,
    SUM(amount) AS total_amount
FROM sales
GROUP BY category, region
ORDER BY category, total_amount DESC;

-- Group by expression (monthly aggregation)
SELECT
    DATE_TRUNC('month', sale_date) AS month,
    SUM(amount) AS monthly_total,
    COUNT(*) AS transaction_count,
    ROUND(AVG(amount), 2) AS avg_per_transaction
FROM sales
GROUP BY DATE_TRUNC('month', sale_date)
ORDER BY month;

-- Cross-tabulation by year-month + category
SELECT
    TO_CHAR(sale_date, 'YYYY-MM') AS year_month,
    category,
    SUM(amount) AS total,
    COUNT(*) AS cnt
FROM sales
GROUP BY TO_CHAR(sale_date, 'YYYY-MM'), category
ORDER BY year_month, category;

-- Group by CASE expression (by price range)
SELECT
    CASE
        WHEN amount < 5000 THEN '低額（5千未満）'
        WHEN amount < 50000 THEN '中額（5千-5万）'
        ELSE '高額（5万以上）'
    END AS price_range,
    COUNT(*) AS count,
    SUM(amount) AS total,
    ROUND(AVG(amount), 2) AS avg
FROM sales
GROUP BY
    CASE
        WHEN amount < 5000 THEN '低額（5千未満）'
        WHEN amount < 50000 THEN '中額（5千-5万）'
        ELSE '高額（5万以上）'
    END
ORDER BY avg;
```

### GROUP BY Execution Flow

```
┌─────────────────── GROUP BY Processing Flow ─────────────────────────┐
│                                                                       │
│  Source table (sales)                                                  │
│  ┌──────────┬──────────┬──────────┐                                  │
│  │ category │ region   │ amount   │                                  │
│  ├──────────┼──────────┼──────────┤                                  │
│  │ 食品     │ 東京     │ 1000     │                                  │
│  │ 食品     │ 大阪     │ 1500     │                                  │
│  │ 家電     │ 東京     │ 5000     │                                  │
│  │ 食品     │ 東京     │ 2000     │                                  │
│  │ 家電     │ 大阪     │ 3000     │                                  │
│  └──────────┴──────────┴──────────┘                                  │
│       │                                                               │
│       ▼ GROUP BY category                                             │
│  ┌──────────┬────────────────────────────┐                           │
│  │ category │ Rows within group          │                           │
│  ├──────────┼────────────────────────────┤                           │
│  │ 食品     │ {1000, 1500, 2000}         │ → SUM=4500, AVG=1500     │
│  │ 家電     │ {5000, 3000}               │ → SUM=8000, AVG=4000     │
│  └──────────┴────────────────────────────┘                           │
│       │                                                               │
│       ▼ Apply aggregate functions                                     │
│  ┌──────────┬───────┬───────┬───────┐                                │
│  │ category │ COUNT │ SUM   │ AVG   │                                │
│  ├──────────┼───────┼───────┼───────┤                                │
│  │ 食品     │ 3     │ 4500  │ 1500  │                                │
│  │ 家電     │ 2     │ 8000  │ 4000  │                                │
│  └──────────┴───────┴───────┴───────┘                                │
│                                                                       │
│  ★ Internal implementation of GROUP BY (PostgreSQL):                 │
│  ┌──────────────────────────────────────────────┐                    │
│  │ HashAggregate: Groups managed in hash table  │                    │
│  │ - Used when data fits within work_mem         │                    │
│  │ - O(N) time complexity                        │                    │
│  │                                               │                    │
│  │ GroupAggregate: Scans pre-sorted data         │                    │
│  │ - Fast when an index is available             │                    │
│  │ - Sort + one-pass time complexity             │                    │
│  │                                               │                    │
│  │ Mixed: PostgreSQL 13+ supports disk spill     │                    │
│  │ when hash aggregate overflows memory          │                    │
│  └──────────────────────────────────────────────┘                    │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 3. HAVING

### Code Example 5: Filtering Groups with HAVING

```sql
-- WHERE filters rows; HAVING filters groups
SELECT
    category,
    COUNT(*) AS sales_count,
    SUM(amount) AS total_amount
FROM sales
WHERE sale_date >= '2024-01-01'     -- ① Row-level filter (before aggregation)
GROUP BY category
HAVING SUM(amount) >= 10000         -- ② Group-level filter (after aggregation)
ORDER BY total_amount DESC;

-- Practical example: Customers with 5 or more orders
SELECT
    customer_id,
    COUNT(*) AS order_count,
    SUM(total_amount) AS lifetime_value
FROM orders
GROUP BY customer_id
HAVING COUNT(*) >= 5
ORDER BY lifetime_value DESC;

-- Practical example: Detecting duplicate data
SELECT
    email,
    COUNT(*) AS duplicate_count
FROM users
GROUP BY email
HAVING COUNT(*) > 1;

-- Practical example: Multiple conditions on aggregate results
SELECT
    category,
    region,
    COUNT(*) AS cnt,
    SUM(amount) AS total,
    AVG(amount) AS avg
FROM sales
GROUP BY category, region
HAVING COUNT(*) >= 2
   AND SUM(amount) > 10000
   AND AVG(amount) > 3000
ORDER BY total DESC;

-- Practical example: Using a subquery in HAVING
SELECT
    category,
    AVG(amount) AS avg_amount
FROM sales
GROUP BY category
HAVING AVG(amount) > (SELECT AVG(amount) FROM sales);
-- → Only categories whose average is above the overall average
```

### Execution Timing: WHERE vs HAVING

```
┌──────────── Differences Between WHERE and HAVING ──────────────────┐
│                                                                     │
│  FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY              │
│           │                   │                                     │
│    ┌──────┴──────┐    ┌──────┴──────┐                              │
│    │  WHERE      │    │  HAVING     │                              │
│    │  Filters    │    │  Filters    │                              │
│    │  rows       │    │  groups     │                              │
│    │  Before     │    │  After      │                              │
│    │  aggregation│    │  aggregation│                              │
│    │  Cannot use │    │  Can use    │                              │
│    │  aggregate  │    │  aggregate  │                              │
│    │  functions  │    │  functions  │                              │
│    │  Index      │    │  No index   │                              │
│    │  usable     │    │  available  │                              │
│    └─────────────┘    └─────────────┘                              │
│                                                                     │
│  ★ Performance rule of thumb:                                      │
│  "Put any condition expressible in WHERE into WHERE"                │
│                                                                     │
│  Example: WHERE amount > 100       ← Per-row check (fast)          │
│           HAVING SUM(amount) > 10000 ← Per-group check             │
│                                                                     │
│  Bad:  HAVING category = '家電'                                     │
│  Good: WHERE category = '家電'                                      │
│  → Same result, but WHERE filters earlier and is faster             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Advanced Aggregation

### Code Example 6: GROUPING SETS / ROLLUP / CUBE

```sql
-- GROUPING SETS: Retrieve multiple aggregation levels at once
SELECT
    category,
    region,
    SUM(amount) AS total
FROM sales
GROUP BY GROUPING SETS (
    (category, region),  -- category × region
    (category),          -- subtotal by category
    (region),            -- subtotal by region
    ()                   -- grand total
)
ORDER BY category NULLS LAST, region NULLS LAST;

-- ROLLUP: Hierarchical subtotals + grand total
-- ROLLUP(A, B) = GROUPING SETS((A,B), (A), ())
SELECT
    COALESCE(category, '【Grand Total】') AS category,
    COALESCE(region, '【Subtotal】') AS region,
    SUM(amount) AS total,
    COUNT(*) AS cnt
FROM sales
GROUP BY ROLLUP (category, region);

-- CUBE: All combinations of aggregation
-- CUBE(A, B) = GROUPING SETS((A,B), (A), (B), ())
SELECT
    category,
    region,
    SUM(amount) AS total
FROM sales
GROUP BY CUBE (category, region);

-- GROUPING function: Distinguish whether NULL is from aggregation or actual data
SELECT
    CASE WHEN GROUPING(category) = 1 THEN '【All Categories】'
         ELSE category END AS category,
    CASE WHEN GROUPING(region) = 1 THEN '【All Regions】'
         ELSE region END AS region,
    SUM(amount) AS total,
    GROUPING(category) AS is_cat_total,
    GROUPING(region) AS is_reg_total,
    GROUPING(category, region) AS grouping_id
FROM sales
GROUP BY CUBE (category, region)
ORDER BY GROUPING(category, region), category, region;

-- Partial ROLLUP: Apply ROLLUP to a subset of columns
SELECT
    category,
    region,
    TO_CHAR(sale_date, 'YYYY-MM') AS month,
    SUM(amount) AS total
FROM sales
GROUP BY category, ROLLUP(region, TO_CHAR(sale_date, 'YYYY-MM'));
-- → category always present; ROLLUP applied on region → month hierarchy
```

### Expansion Diagram: ROLLUP / CUBE / GROUPING SETS

```
┌──────── ROLLUP vs CUBE vs GROUPING SETS ───────────────────────────┐
│                                                                     │
│  GROUP BY ROLLUP(A, B, C) is equivalent to:                        │
│  GROUP BY GROUPING SETS(                                            │
│      (A, B, C),   -- detail                                        │
│      (A, B),      -- subtotal of C                                 │
│      (A),         -- subtotal of B, C                              │
│      ()           -- grand total                                    │
│  )                                                                  │
│  → N+1 = 4 groups (number of columns + 1)                          │
│                                                                     │
│  GROUP BY CUBE(A, B, C) is equivalent to:                          │
│  GROUP BY GROUPING SETS(                                            │
│      (A, B, C),   (A, B),   (A, C),   (B, C),                     │
│      (A),         (B),      (C),                                   │
│      ()                                                             │
│  )                                                                  │
│  → 2^N = 8 groups (2 to the power of the number of columns)        │
│                                                                     │
│  ★ Performance impact:                                             │
│  ┌───────────────────────────────────────┐                         │
│  │ CUBE(A,B,C,D) → 2^4 = 16 groups      │                         │
│  │ CUBE(A,B,C,D,E) → 2^5 = 32 groups    │                         │
│  │ Group count grows exponentially       │                         │
│  │ → Recommended to use CUBE with ≤3    │                         │
│  │   columns                             │                         │
│  └───────────────────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Code Example 7: FILTER Clause (PostgreSQL / SQLite)

```sql
-- FILTER clause: More concise conditional aggregation than CASE expressions
SELECT
    category,
    COUNT(*) AS total_count,
    COUNT(*) FILTER (WHERE region = '東京') AS tokyo_count,
    COUNT(*) FILTER (WHERE region = '大阪') AS osaka_count,
    COUNT(*) FILTER (WHERE region = '福岡') AS fukuoka_count,
    SUM(amount) FILTER (WHERE sale_date >= '2024-01-01'
                        AND sale_date < '2024-04-01') AS q1_amount,
    SUM(amount) FILTER (WHERE sale_date >= '2024-04-01'
                        AND sale_date < '2024-07-01') AS q2_amount,
    AVG(amount) FILTER (WHERE quantity >= 5) AS avg_bulk_amount
FROM sales
GROUP BY category;

-- Comparison: FILTER clause vs CASE expression
-- FILTER (recommended in PostgreSQL):
SELECT COUNT(*) FILTER (WHERE status = 'active') AS active_count FROM users;

-- CASE (works in all RDBMSs):
SELECT COUNT(CASE WHEN status = 'active' THEN 1 END) AS active_count FROM users;
-- Or:
SELECT SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_count FROM users;
```

### Code Example 8: Statistical Functions

```sql
-- Variance and standard deviation
SELECT
    department_id,
    COUNT(*) AS emp_count,
    AVG(salary) AS avg_salary,
    STDDEV_SAMP(salary) AS salary_stddev,      -- Sample std dev (N-1)
    STDDEV_POP(salary) AS salary_stddev_pop,   -- Population std dev (N)
    VAR_SAMP(salary) AS salary_variance,       -- Sample variance
    VAR_POP(salary) AS salary_variance_pop     -- Population variance
FROM employees
GROUP BY department_id
HAVING COUNT(*) >= 3;  -- Statistical values are meaningful with 3+ records

-- Median (PERCENTILE_CONT)
SELECT
    department_id,
    AVG(salary) AS mean_salary,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary) AS median_salary,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY salary) AS q1_salary,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY salary) AS q3_salary,
    -- Interquartile range (IQR)
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY salary)
    - PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY salary) AS iqr,
    -- Mode via MODE() (PostgreSQL)
    MODE() WITHIN GROUP (ORDER BY salary) AS mode_salary
FROM employees
GROUP BY department_id;

-- PERCENTILE_DISC: Discrete value (returns an actually existing value)
SELECT
    department_id,
    PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY salary) AS median_exact
FROM employees
GROUP BY department_id;
-- PERCENTILE_CONT returns an interpolated value; PERCENTILE_DISC returns an existing value

-- Correlation coefficient and regression analysis
SELECT
    CORR(age, salary) AS correlation,           -- Correlation coefficient
    REGR_SLOPE(salary, age) AS slope,           -- Slope of regression line
    REGR_INTERCEPT(salary, age) AS intercept,   -- Intercept of regression line
    REGR_R2(salary, age) AS r_squared,          -- Coefficient of determination
    REGR_COUNT(salary, age) AS valid_pairs      -- Number of valid pairs
FROM employees;
```

### Code Example 9: String and Array Aggregation

```sql
-- String aggregation (STRING_AGG / GROUP_CONCAT)
-- PostgreSQL / SQL Server
SELECT
    department_id,
    STRING_AGG(name, ', ' ORDER BY name) AS member_list,
    STRING_AGG(DISTINCT title, ' / ' ORDER BY title) AS unique_titles
FROM employees
GROUP BY department_id;

-- MySQL
-- SELECT department_id, GROUP_CONCAT(name ORDER BY name SEPARATOR ', ')
-- FROM employees GROUP BY department_id;

-- Array aggregation (PostgreSQL-specific)
SELECT
    department_id,
    ARRAY_AGG(name ORDER BY hired_date) AS members_by_tenure,
    ARRAY_AGG(DISTINCT department_id) AS depts,  -- Remove duplicates
    ARRAY_AGG(salary ORDER BY salary DESC) AS salaries_desc
FROM employees
GROUP BY department_id;

-- JSON aggregation (PostgreSQL 9.5+ / MySQL 5.7+)
-- PostgreSQL
SELECT
    department_id,
    JSON_AGG(
        JSON_BUILD_OBJECT(
            'name', name,
            'salary', salary,
            'hired', hired_date
        ) ORDER BY salary DESC
    ) AS members_json
FROM employees
GROUP BY department_id;

-- Boolean aggregation (PostgreSQL)
SELECT
    department_id,
    BOOL_AND(is_active) AS all_active,   -- Are all active?
    BOOL_OR(is_manager) AS has_manager,  -- Is there a manager?
    EVERY(salary > 300000) AS all_above_300k  -- All above 300k?
FROM employees
GROUP BY department_id;

-- Bit aggregation
SELECT
    department_id,
    BIT_AND(permissions) AS common_perms,  -- Common permissions (AND)
    BIT_OR(permissions) AS union_perms     -- Union of permissions (OR)
FROM employees
GROUP BY department_id;
```

---

## 5. Performance Optimization

### Execution Plans for Aggregate Queries

```
┌──────── Reading Execution Plans for Aggregate Queries ─────────────┐
│                                                                     │
│  ■ HashAggregate                                                    │
│  ┌────────────────────────────────────────────┐                    │
│  │ Behavior: Groups managed via hash table    │                    │
│  │ Characteristics:                           │                    │
│  │ - No pre-sorting of input required         │                    │
│  │ - Fast when fits in work_mem               │                    │
│  │ - Memory usage = groups × row size         │                    │
│  │ Used when:                                 │                    │
│  │ - Few to moderate number of groups         │                    │
│  │ - No ORDER BY                              │                    │
│  │ - No suitable index available              │                    │
│  └────────────────────────────────────────────┘                    │
│                                                                     │
│  ■ GroupAggregate                                                   │
│  ┌────────────────────────────────────────────┐                    │
│  │ Behavior: One-pass grouping on sorted data │                    │
│  │ Characteristics:                           │                    │
│  │ - Input is pre-sorted (index or Sort node) │                    │
│  │ - Low memory usage (one group at a time)   │                    │
│  │ - Advantageous when ORDER BY + GROUP BY    │                    │
│  │   share the same columns                   │                    │
│  │ Used when:                                 │                    │
│  │ - Index exists on GROUP BY column          │                    │
│  │ - Can combine ORDER BY + GROUP BY          │                    │
│  │ - work_mem is insufficient                 │                    │
│  └────────────────────────────────────────────┘                    │
│                                                                     │
│  ■ Improvements in PostgreSQL 13+                                   │
│  ┌────────────────────────────────────────────┐                    │
│  │ - Disk spill support for HashAggregate     │                    │
│  │ - Efficient processing of multiple GROUP   │                    │
│  │   BY sets                                  │                    │
│  │ - Integration with Incremental Sort        │                    │
│  └────────────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Code Example 10: Practical Performance Optimization

```sql
-- ■ Optimization via indexes
-- An index on the GROUP BY column encourages GroupAggregate
CREATE INDEX idx_sales_category ON sales (category);
CREATE INDEX idx_sales_cat_region ON sales (category, region);

-- Check the execution plan
EXPLAIN (ANALYZE, BUFFERS)
SELECT category, SUM(amount)
FROM sales
GROUP BY category;

-- ■ Pre-filter with WHERE (most effective optimization)
-- Bad: Read all rows, then filter with HAVING after GROUP BY
SELECT region, SUM(amount)
FROM sales
GROUP BY region
HAVING region IN ('東京', '大阪');  -- Filters all rows after GROUP BY

-- Good: Filter rows with WHERE first
SELECT region, SUM(amount)
FROM sales
WHERE region IN ('東京', '大阪')     -- Narrow rows first (index usable)
GROUP BY region;

-- ■ Using partial indexes
CREATE INDEX idx_sales_active ON sales (category, amount)
WHERE sale_date >= '2024-01-01';

-- ■ Caching with materialized views (PostgreSQL)
CREATE MATERIALIZED VIEW mv_monthly_sales AS
SELECT
    DATE_TRUNC('month', sale_date) AS month,
    category,
    region,
    SUM(amount) AS total_amount,
    COUNT(*) AS transaction_count,
    AVG(amount) AS avg_amount
FROM sales
GROUP BY DATE_TRUNC('month', sale_date), category, region;

CREATE UNIQUE INDEX ON mv_monthly_sales (month, category, region);

-- Refresh
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_sales;

-- ■ Approximate aggregation (for large-scale data)
-- PostgreSQL extension: HyperLogLog (approximate COUNT DISTINCT)
-- HLL computes COUNT DISTINCT over billions of rows in constant memory
-- CREATE EXTENSION hll;
-- SELECT hll_cardinality(hll_add_agg(hll_hash_text(user_id)))
-- FROM huge_events;

-- ■ Adjusting work_mem
SET work_mem = '256MB';  -- Raise the memory limit for HashAggregate
EXPLAIN (ANALYZE, BUFFERS)
SELECT category, region, COUNT(*)
FROM large_table
GROUP BY category, region;
```

---

## 6. Cross-RDBMS Compatibility

### Aggregate Function Support Comparison

| Function | PostgreSQL | MySQL 8.0+ | SQL Server | Oracle | SQLite |
|----------|-----------|------------|------------|--------|--------|
| COUNT/SUM/AVG/MIN/MAX | Supported | Supported | Supported | Supported | Supported |
| COUNT(DISTINCT) | Supported | Supported | Supported | Supported | Supported |
| STRING_AGG | Supported (9.0+) | GROUP_CONCAT | Supported (2017+) | LISTAGG | GROUP_CONCAT |
| ARRAY_AGG | Supported | Not supported | Not supported | Not supported | Not supported |
| JSON_AGG | Supported (9.5+) | JSON_ARRAYAGG | Not supported | JSON_ARRAYAGG | Not supported |
| FILTER clause | Supported (9.4+) | Not supported | Not supported | Not supported | Supported (3.30+) |
| BOOL_AND/BOOL_OR | Supported | BIT_AND/BIT_OR | Not supported | Not supported | Not supported |
| PERCENTILE_CONT | Supported | Not supported | PERCENTILE_CONT | Supported | Not supported |
| MODE() | Supported | Not supported | Not supported | STATS_MODE | Not supported |
| STDDEV_SAMP/POP | Supported | Supported | STDEV/STDEVP | Supported | Not supported |
| CORR/REGR_* | Supported | Not supported | Not supported | Supported | Not supported |
| GROUPING SETS | Supported (9.5+) | Not supported | Supported | Supported | Not supported |
| ROLLUP | Supported (9.5+) | Supported | Supported | Supported | Not supported |
| CUBE | Supported (9.5+) | Not supported | Supported | Supported | Not supported |
| GROUPING() | Supported | Supported (8.0+) | Supported | Supported | Not supported |

### RDBMS-Specific Syntax

```sql
-- ■ MySQL: GROUP_CONCAT caveats
-- Default maximum length is 1024 bytes (gets truncated!)
SET GROUP_CONCAT_MAX_LEN = 1000000;
SELECT department_id,
       GROUP_CONCAT(name ORDER BY name SEPARATOR ', ') AS members
FROM employees
GROUP BY department_id;

-- ■ MySQL: WITH ROLLUP syntax
SELECT category, region, SUM(amount)
FROM sales
GROUP BY category, region WITH ROLLUP;
-- NOTE: CUBE and GROUPING SETS are not supported

-- ■ SQL Server: STRING_AGG notes
-- Supported from SQL Server 2017+. Use FOR XML PATH for earlier versions.
SELECT
    department_id,
    STRING_AGG(name, ', ') WITHIN GROUP (ORDER BY name) AS members
FROM employees
GROUP BY department_id;

-- ■ Oracle: LISTAGG (string aggregation)
SELECT
    department_id,
    LISTAGG(name, ', ') WITHIN GROUP (ORDER BY name) AS members
FROM employees
GROUP BY department_id;

-- Oracle 19c+: LISTAGG DISTINCT
SELECT
    department_id,
    LISTAGG(DISTINCT title, ', ') WITHIN GROUP (ORDER BY title) AS titles
FROM employees
GROUP BY department_id;
```

---

## Aggregate Function Reference

| Function | Description | NULL Handling | Usage Example | Notes |
|----------|-------------|--------------|---------------|-------|
| COUNT(*) | Total row count | Included | `COUNT(*)` | Counts NULLs too |
| COUNT(col) | Non-NULL row count | Excluded | `COUNT(email)` | NULL rows excluded |
| COUNT(DISTINCT col) | Unique value count | Excluded | `COUNT(DISTINCT category)` | High memory usage |
| SUM(col) | Sum | Excluded | `SUM(amount)` | Returns NULL if all NULL |
| AVG(col) | Average | Excluded | `AVG(salary)` | Denominator excludes NULLs |
| MIN(col) | Minimum value | Excluded | `MIN(price)` | Works on strings and dates too |
| MAX(col) | Maximum value | Excluded | `MAX(created_at)` | Works on strings and dates too |
| STRING_AGG | Concatenated string | Excluded | `STRING_AGG(name, ',')` | MySQL: GROUP_CONCAT |
| ARRAY_AGG | Array | Included | `ARRAY_AGG(tag)` | PostgreSQL-specific |
| JSON_AGG | JSON array | Included | `JSON_AGG(col)` | PostgreSQL 9.5+ |
| BOOL_AND/OR | Logical AND/OR | Excluded | `BOOL_AND(is_active)` | PostgreSQL-specific |
| EVERY | TRUE for all rows | Excluded | `EVERY(score > 60)` | Alias for BOOL_AND |
| STDDEV_SAMP | Sample standard deviation | Excluded | `STDDEV_SAMP(salary)` | Divided by N-1 |
| STDDEV_POP | Population standard deviation | Excluded | `STDDEV_POP(salary)` | Divided by N |
| VAR_SAMP | Sample variance | Excluded | `VAR_SAMP(salary)` | Divided by N-1 |
| VAR_POP | Population variance | Excluded | `VAR_POP(salary)` | Divided by N |
| PERCENTILE_CONT | Continuous percentile | Excluded | `PERCENTILE_CONT(0.5)` | Returns interpolated value |
| PERCENTILE_DISC | Discrete percentile | Excluded | `PERCENTILE_DISC(0.5)` | Returns existing value |
| MODE | Mode (most frequent value) | Excluded | `MODE() WITHIN GROUP(...)` | PostgreSQL-specific |
| CORR | Correlation coefficient | Excluded | `CORR(x, y)` | Range: -1.0 to 1.0 |

## ROLLUP vs CUBE vs GROUPING SETS Comparison

| Feature | Groups Generated | Approximate Row Count | Use Case | Supported RDBMSs |
|---------|-----------------|----------------------|----------|-----------------|
| GROUP BY A, B | (A, B) | Number of groups | Basic aggregation | All RDBMSs |
| ROLLUP(A, B) | (A,B), (A), () | N+1 levels | Subtotal rows in reports | PG, SS, Oracle |
| CUBE(A, B) | (A,B), (A), (B), () | 2^N combinations | Multi-dimensional analysis | PG, SS, Oracle |
| GROUPING SETS | Explicitly specified | As specified | Flexible aggregation | PG, SS, Oracle |

---

## Edge Cases

### Edge Case 1: Aggregation on an Empty Table

```sql
-- Aggregation on an empty table (0 rows)
CREATE TABLE empty_table (amount INTEGER);

SELECT
    COUNT(*)   AS cnt,      -- 0 (still returns 1 row)
    SUM(amount) AS total,   -- NULL (not 0!)
    AVG(amount) AS avg,     -- NULL
    MIN(amount) AS mn,      -- NULL
    MAX(amount) AS mx       -- NULL
FROM empty_table;
-- → 1 row is returned (not 0 rows)

-- With GROUP BY
SELECT amount, COUNT(*) FROM empty_table GROUP BY amount;
-- → 0 rows (no groups exist)

-- ★ Safe approach
SELECT COALESCE(SUM(amount), 0) AS safe_total FROM empty_table;
```

### Edge Case 2: GROUP BY and NULL

```sql
-- NULL is treated as a single group
INSERT INTO sales (product, category, amount, quantity, sale_date, region) VALUES
    ('不明商品', NULL, 1000, 1, '2024-05-01', NULL);

SELECT category, COUNT(*), SUM(amount)
FROM sales
GROUP BY category;
-- → NULL is aggregated as a single group
-- → (NULL, 1, 1000) is included in the results

-- Handling NULL explicitly with COALESCE
SELECT COALESCE(category, 'Uncategorized') AS category, COUNT(*)
FROM sales
GROUP BY COALESCE(category, 'Uncategorized');
```

### Edge Case 3: DISTINCT Combined with Aggregation

```sql
-- Memory consumption of COUNT(DISTINCT)
-- Using COUNT(DISTINCT) on a large table consumes significant memory for the hash table
SELECT COUNT(DISTINCT user_id) FROM huge_events;  -- Millions of unique values

-- Alternatives when approximation is acceptable
-- PostgreSQL: HyperLogLog extension
-- BigQuery: APPROX_COUNT_DISTINCT(user_id)
-- Redshift: APPROXIMATE COUNT(DISTINCT user_id)

-- Multiple DISTINCT aggregations are inefficient
-- Bad: Two DISTINCT operations (requires two hash tables)
SELECT
    COUNT(DISTINCT user_id) AS unique_users,
    COUNT(DISTINCT product_id) AS unique_products
FROM orders;

-- Good: Split into subqueries (for large tables)
SELECT
    (SELECT COUNT(DISTINCT user_id) FROM orders) AS unique_users,
    (SELECT COUNT(DISTINCT product_id) FROM orders) AS unique_products;
```

### Edge Case 4: Floating-Point Precision in Aggregation

```sql
-- Difference in SUM precision between DECIMAL and FLOAT
CREATE TABLE float_test (
    val_decimal DECIMAL(10,2),
    val_float   FLOAT
);

INSERT INTO float_test VALUES (0.1, 0.1), (0.2, 0.2), (0.3, 0.3);

SELECT
    SUM(val_decimal) AS decimal_sum,  -- 0.60 (exact)
    SUM(val_float) AS float_sum       -- 0.6000000000000001 (rounding error)
FROM float_test;

-- Always use DECIMAL/NUMERIC for monetary calculations
```

---

## Anti-Patterns

### Anti-Pattern 1: Selecting a Column Not in GROUP BY

```sql
-- Bad: name is not included in GROUP BY
SELECT department_id, name, AVG(salary)
FROM employees
GROUP BY department_id;
-- → Error in PostgreSQL
-- → Returns an indeterminate value in MySQL (when ONLY_FULL_GROUP_BY is disabled)

-- Good: Include in GROUP BY or wrap in an aggregate function
SELECT department_id, MIN(name) AS first_name, AVG(salary)
FROM employees
GROUP BY department_id;

-- Good: Use a window function
SELECT DISTINCT
    department_id,
    FIRST_VALUE(name) OVER (PARTITION BY department_id ORDER BY salary DESC),
    AVG(salary) OVER (PARTITION BY department_id)
FROM employees;

-- Good: Retrieve the top earner's name via a subquery
SELECT
    e.department_id,
    e.name AS top_earner,
    d.avg_salary
FROM employees e
INNER JOIN (
    SELECT department_id, AVG(salary) AS avg_salary, MAX(salary) AS max_salary
    FROM employees
    GROUP BY department_id
) d ON e.department_id = d.department_id
   AND e.salary = d.max_salary;
```

### Anti-Pattern 2: Ignoring the NULL Problem with AVG

```sql
-- Bad pattern: Not considering the impact of NULL
-- Data: [100, NULL, 200, NULL, 300]
SELECT AVG(score) FROM tests;
-- → 200 (average of 3 rows), not the average of 5 rows including NULLs!

-- Good: Explicitly treat NULL as 0 when desired
SELECT AVG(COALESCE(score, 0)) FROM tests;
-- → 120 (average of 5 rows)

-- Good: When the average excluding NULLs is intended
SELECT AVG(score) FROM tests WHERE score IS NOT NULL;
-- → 200 (explicitly excludes NULLs)
```

### Anti-Pattern 3: Doing WHERE's Job in HAVING

```sql
-- Bad: Writing a row-level condition in HAVING
SELECT region, SUM(amount) AS total
FROM sales
GROUP BY region
HAVING region = '東京';  -- Should be in WHERE

-- Good: Pre-filter with WHERE
SELECT region, SUM(amount) AS total
FROM sales
WHERE region = '東京'
GROUP BY region;
-- → WHERE can use an index and is faster
```

### Anti-Pattern 4: Unnecessary DISTINCT Combined with GROUP BY

```sql
-- Bad: GROUP BY results are already unique
SELECT DISTINCT category, COUNT(*)
FROM sales
GROUP BY category;
-- DISTINCT is meaningless (GROUP BY already ensures uniqueness)

-- Good: Remove DISTINCT
SELECT category, COUNT(*)
FROM sales
GROUP BY category;
```

---

## Security Considerations

```
┌──────── Security Considerations ──────────────────────────────────┐
│                                                                    │
│  ■ Data leakage via aggregation                                    │
│  ┌──────────────────────────────────────────────┐                 │
│  │ - COUNT(*) results can reveal row existence  │                 │
│  │ - MIN/MAX can pinpoint individual values      │                 │
│  │ - A GROUP BY group with 1 row can identify   │                 │
│  │   an individual                               │                 │
│  │                                               │                 │
│  │ Countermeasures:                              │                 │
│  │ - Use HAVING COUNT(*) >= k to hide small      │                 │
│  │   groups (k-anonymity)                        │                 │
│  │ - Expose only aggregated results via views    │                 │
│  │ - Leverage row-level security (RLS)           │                 │
│  └──────────────────────────────────────────────┘                 │
│                                                                    │
│  ■ SQL injection and GROUP BY                                      │
│  ┌──────────────────────────────────────────────┐                 │
│  │ - When dynamically building GROUP BY columns: │                 │
│  │   Bad: "GROUP BY " + user_input               │                 │
│  │   Good: Restrict allowed columns via whitelist│                 │
│  │                                               │                 │
│  │ - Example (Python):                           │                 │
│  │   allowed = {'category', 'region', 'month'}   │                 │
│  │   if col not in allowed: raise ValueError     │                 │
│  └──────────────────────────────────────────────┘                 │
│                                                                    │
│  ■ Performance DoS                                                 │
│  ┌──────────────────────────────────────────────┐                 │
│  │ - CUBE(A,B,C,D,E) generates 2^5=32 groups    │                 │
│  │ - Unrestricted aggregation on large tables    │                 │
│  │   consumes enormous resources                 │                 │
│  │ - Set statement_timeout to protect            │                 │
│  │ - Always add LIMIT to user-facing queries     │                 │
│  └──────────────────────────────────────────────┘                 │
└────────────────────────────────────────────────────────────────────┘
```

---

## Exercises

### Exercise 1: Basics -- Aggregate Functions and GROUP BY

```sql
-- Problem: Write the following queries against the sales table.
-- Q1: Find the sales count, total amount, average amount, and maximum amount per category.
-- Q2: Show only regions with 2 or more sales, ordered by total amount descending.
-- Q3: Show the monthly sales total (in YYYY-MM format) and the change from the previous month.
```

**Model Answer:**

```sql
-- Q1: Aggregation by category
SELECT
    category,
    COUNT(*) AS sales_count,
    SUM(amount) AS total_amount,
    ROUND(AVG(amount), 2) AS avg_amount,
    MAX(amount) AS max_amount
FROM sales
GROUP BY category
ORDER BY total_amount DESC;

-- Q2: By region (2 or more sales)
SELECT
    region,
    COUNT(*) AS sales_count,
    SUM(amount) AS total_amount
FROM sales
GROUP BY region
HAVING COUNT(*) >= 2
ORDER BY total_amount DESC;

-- Q3: Monthly trend (combined with window functions)
WITH monthly AS (
    SELECT
        TO_CHAR(sale_date, 'YYYY-MM') AS month,
        SUM(amount) AS total
    FROM sales
    GROUP BY TO_CHAR(sale_date, 'YYYY-MM')
)
SELECT
    month,
    total,
    LAG(total) OVER (ORDER BY month) AS prev_month,
    total - LAG(total) OVER (ORDER BY month) AS change
FROM monthly
ORDER BY month;
```

### Exercise 2: Applied -- ROLLUP/CUBE and Conditional Aggregation

```sql
-- Problem:
-- Q1: Use ROLLUP on category and region to create a report with hierarchical subtotals.
--     (Label subtotal and grand total rows.)
-- Q2: Create a cross-tabulation (pivot) of category sales by quarter (Q1-Q4).
-- Q3: For each salesperson, display the number of transactions >= 10,000 and < 10,000 side by side.
```

**Model Answer:**

```sql
-- Q1: ROLLUP + GROUPING function
SELECT
    CASE WHEN GROUPING(category) = 1 THEN '★Grand Total'
         ELSE category END AS category,
    CASE WHEN GROUPING(region) = 1 THEN
        CASE WHEN GROUPING(category) = 1 THEN '' ELSE '☆Subtotal' END
    ELSE region END AS region,
    SUM(amount) AS total_amount,
    COUNT(*) AS cnt
FROM sales
GROUP BY ROLLUP(category, region)
ORDER BY GROUPING(category, region), category, region;

-- Q2: Cross-tabulation (pivot table)
SELECT
    category,
    SUM(amount) FILTER (WHERE EXTRACT(QUARTER FROM sale_date) = 1) AS q1,
    SUM(amount) FILTER (WHERE EXTRACT(QUARTER FROM sale_date) = 2) AS q2,
    SUM(amount) FILTER (WHERE EXTRACT(QUARTER FROM sale_date) = 3) AS q3,
    SUM(amount) FILTER (WHERE EXTRACT(QUARTER FROM sale_date) = 4) AS q4,
    SUM(amount) AS annual_total
FROM sales
GROUP BY category
ORDER BY annual_total DESC;

-- For RDBMSs that do not support the FILTER clause
SELECT
    category,
    SUM(CASE WHEN EXTRACT(QUARTER FROM sale_date) = 1 THEN amount ELSE 0 END) AS q1,
    SUM(CASE WHEN EXTRACT(QUARTER FROM sale_date) = 2 THEN amount ELSE 0 END) AS q2,
    SUM(amount) AS annual_total
FROM sales
GROUP BY category;

-- Q3: Count by condition
SELECT
    salesperson,
    COUNT(*) AS total_transactions,
    COUNT(*) FILTER (WHERE amount >= 10000) AS high_value_count,
    COUNT(*) FILTER (WHERE amount < 10000) AS low_value_count,
    ROUND(
        COUNT(*) FILTER (WHERE amount >= 10000)::NUMERIC / COUNT(*) * 100, 1
    ) AS high_value_pct
FROM sales
GROUP BY salesperson
ORDER BY total_transactions DESC;
```

### Exercise 3: Advanced -- Statistical Analysis and Practical Aggregation

```sql
-- Problem:
-- Q1: Find the standard deviation and coefficient of variation (CV = std dev / mean)
--     for the sales amount of each category.
-- Q2: Divide sales amounts into 10 buckets (deciles) and display the count and
--     amount range for each bucket.
-- Q3: For each salesperson's sales trend, compute a 3-period moving average
--     and determine the trend (rising/falling).
```

**Model Answer:**

```sql
-- Q1: Coefficient of variation
SELECT
    category,
    COUNT(*) AS cnt,
    ROUND(AVG(amount), 2) AS avg_amount,
    ROUND(STDDEV_SAMP(amount), 2) AS stddev_amount,
    ROUND(STDDEV_SAMP(amount) / NULLIF(AVG(amount), 0) * 100, 2) AS cv_pct
FROM sales
GROUP BY category
HAVING COUNT(*) >= 2;

-- Q2: Decile analysis (using NTILE)
WITH deciles AS (
    SELECT
        amount,
        NTILE(10) OVER (ORDER BY amount) AS decile
    FROM sales
)
SELECT
    decile,
    COUNT(*) AS cnt,
    MIN(amount) AS min_amount,
    MAX(amount) AS max_amount,
    ROUND(AVG(amount), 2) AS avg_amount,
    SUM(amount) AS total_amount
FROM deciles
GROUP BY decile
ORDER BY decile;

-- Q3: Moving average and trend determination
WITH sales_ordered AS (
    SELECT
        salesperson,
        sale_date,
        amount,
        ROW_NUMBER() OVER (PARTITION BY salesperson ORDER BY sale_date) AS rn,
        AVG(amount) OVER (
            PARTITION BY salesperson ORDER BY sale_date
            ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
        ) AS ma3
    FROM sales
),
with_prev AS (
    SELECT
        *,
        LAG(ma3) OVER (PARTITION BY salesperson ORDER BY sale_date) AS prev_ma3
    FROM sales_ordered
)
SELECT
    salesperson,
    sale_date,
    amount,
    ROUND(ma3, 2) AS moving_avg_3,
    CASE
        WHEN ma3 > prev_ma3 THEN '上昇↑'
        WHEN ma3 < prev_ma3 THEN '下降↓'
        ELSE '横ばい→'
    END AS trend
FROM with_prev
ORDER BY salesperson, sale_date;
```

---

## FAQ

### Q1: How should I use WHERE vs HAVING?

WHERE is a filter on individual rows (before aggregation); HAVING is a filter on groups (after aggregation). Conditions that do not use aggregate functions must always be placed in WHERE. Pre-filtering with WHERE reduces the number of rows to process and improves performance. Use HAVING only when the condition involves an aggregate result, such as `SUM(amount) > 10000`.

### Q2: Is there a performance difference between COUNT(*) and COUNT(1)?

In modern RDBMSs (PostgreSQL, MySQL, SQL Server, Oracle) there is no difference. The optimizer generates the same execution plan for both. `COUNT(*)` is recommended as it is the SQL standard and its intent is clear. `COUNT(column)` has a different meaning (excludes NULLs) and can introduce bugs if used unintentionally.

### Q3: What should I be aware of when using dates in GROUP BY?

Grouping by a TIMESTAMP column groups by the second or millisecond, which may not produce the intended aggregation. You need to round the value using `DATE_TRUNC('day', timestamp_col)` or `CAST(... AS DATE)`. Be careful with time zones as well — specify them explicitly, as in `DATE_TRUNC('day', timestamp_col AT TIME ZONE 'Asia/Tokyo')`.

### Q4: Is it safe to use column numbers in GROUP BY (e.g., GROUP BY 1, 2)?

This is non-standard SQL but supported by many RDBMSs. It is recommended to use explicit column names in production code because adding or reordering columns can introduce bugs. It is, however, convenient for ad hoc queries.

### Q5: Can aggregate functions be nested?

Direct nesting is not allowed. `SUM(COUNT(*))` is an error. However, you can write `SUM(COUNT(*)) OVER ()` using a window function. This applies a window aggregate to the results after the GROUP BY.

### Q6: What should I do if SUM() overflows?

Summing an INTEGER column is computed as BIGINT (PostgreSQL). If that is still insufficient, cast it to NUMERIC: `SUM(amount::NUMERIC)`. The NUMERIC type has arbitrary precision and practically never overflows.

---

## Troubleshooting

### Symptom 1: GROUP BY Results Don't Match Expectations

**Cause:** Grouping by a TIMESTAMP column, where differences in seconds or milliseconds create separate groups.

**Solution:** Round with `DATE_TRUNC('day', col)`. Check the number of groups with `EXPLAIN`.

### Symptom 2: AVG Result is Higher or Lower Than Expected

**Cause:** NULL rows are excluded from the AVG denominator. If 2 of 5 rows are NULL, the denominator becomes 3.

**Solution:** Use `AVG(COALESCE(col, 0))` to treat NULL as 0, or verify that the current behavior is intentional.

### Symptom 3: GROUP BY Query is Extremely Slow

**Cause:** (1) HashAggregate disk spill due to insufficient work_mem, (2) No index on the GROUP BY column, (3) Insufficient row filtering in WHERE.

**Solution:** (1) `SET work_mem = '256MB'`, (2) Add a composite index on the GROUP BY column, (3) Pre-filter with WHERE, (4) Consider a materialized view.

### Symptom 4: STRING_AGG/GROUP_CONCAT Result is Truncated

**Cause:** MySQL's `GROUP_CONCAT_MAX_LEN` limit (default: 1024).

**Solution:** Raise the limit with `SET GROUP_CONCAT_MAX_LEN = 1000000;`. PostgreSQL's STRING_AGG does not have this restriction.

---

## Summary

| Topic | Key Points |
|-------|-----------|
| Aggregate Functions | COUNT, SUM, AVG, MIN, MAX are the 5 basic functions. Understanding NULL behavior is essential. |
| NULL Handling | All functions except COUNT(*) exclude NULLs. SUM/AVG return NULL when all values are NULL. |
| GROUP BY | All non-aggregate columns in SELECT must be in GROUP BY. Grouping by expressions is also possible. |
| HAVING | Filters after GROUP BY. Aggregate functions can be used. Use alongside WHERE appropriately. |
| ROLLUP/CUBE | Obtain hierarchical/multi-dimensional subtotals in a single query. Be mindful of column count with CUBE. |
| FILTER Clause | Write conditional aggregation more concisely than CASE expressions (PostgreSQL / SQLite). |
| Statistical Functions | Advanced analysis possible with STDDEV, VARIANCE, PERCENTILE_CONT, CORR, and more. |
| Performance | Pre-filtering with WHERE, using indexes, and tuning work_mem are the fundamental strategies. |

---

## What to Read Next

- [04-subqueries.md](./04-subqueries.md) -- Using aggregate results in subqueries
- [00-window-functions.md](../01-advanced/00-window-functions.md) -- Per-row aggregation with window functions
- [04-query-optimization.md](../01-advanced/04-query-optimization.md) -- Optimizing aggregate queries

---

## References

1. PostgreSQL Documentation -- "Aggregate Functions" https://www.postgresql.org/docs/current/functions-aggregate.html
2. PostgreSQL Documentation -- "Querying a Table: GROUP BY and HAVING" https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-GROUP
3. Celko, J. (2010). *Joe Celko's SQL for Smarties: Advanced SQL Programming*. Morgan Kaufmann.
4. Kline, K., Kline, D., & Hunt, B. (2008). *SQL in a Nutshell*. O'Reilly Media.
5. Winand, M. -- "GROUP BY, HAVING, and Aggregate Functions" https://use-the-index-luke.com/sql/partial-results/distinct
6. ISO/IEC 9075-2:2023 -- SQL Part 2: Foundation (Aggregate Functions)

# Window Functions — ROW_NUMBER, RANK, LAG/LEAD

> Window functions do not collapse rows like GROUP BY. Instead, they define a "window" for each row and perform aggregation, ranking, and forward/backward row references within that range. Standardized in SQL:2003, they are one of the most powerful tools for eliminating subqueries and self-joins in analytical queries.

## Prerequisites

- Basic syntax of SELECT / WHERE / GROUP BY (01-select.md)
- How aggregate functions (COUNT, SUM, AVG) work ([03-aggregation.md](../00-basics/03-aggregation.md))
- Understanding of ORDER BY and sort processing

## What You Will Learn in This Chapter

1. Full understanding of window function syntax (OVER clause, PARTITION BY, ORDER BY, frames)
2. How to choose between ROW_NUMBER, RANK, DENSE_RANK, NTILE and their internal implementations
3. Practical patterns for LAG/LEAD, FIRST_VALUE/LAST_VALUE, NTH_VALUE
4. Details of frame specification (ROWS / RANGE / GROUPS) and cumulative aggregation
5. How the query optimizer processes window functions and how to read execution plans
6. Cross-RDBMS compatibility and migration considerations

---

## 1. Window Function Syntax

### Overall Structure of Window Functions

```
┌─────────── Window Function Syntax Structure ──────────────────────────┐
│                                                                        │
│  function_name(...) OVER (                                             │
│      [PARTITION BY col1, col2, ...]   -- Partition split (optional)   │
│      [ORDER BY col ASC|DESC, ...]     -- Sort order (optional)        │
│      [frame_clause]                    -- Frame definition (optional)  │
│  )                                                                     │
│                                                                        │
│  frame_clause:                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ {ROWS | RANGE | GROUPS}                                          │ │
│  │ BETWEEN                                                          │ │
│  │   { UNBOUNDED PRECEDING                                          │ │
│  │   | <N> PRECEDING                                                │ │
│  │   | CURRENT ROW                                                  │ │
│  │   | <N> FOLLOWING                                                │ │
│  │   | UNBOUNDED FOLLOWING }                                        │ │
│  │ AND                                                              │ │
│  │   { UNBOUNDED PRECEDING                                          │ │
│  │   | <N> PRECEDING                                                │ │
│  │   | CURRENT ROW                                                  │ │
│  │   | <N> FOLLOWING                                                │ │
│  │   | UNBOUNDED FOLLOWING }                                        │ │
│  │                                                                  │ │
│  │ [EXCLUDE { CURRENT ROW | GROUP | TIES | NO OTHERS }]             │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  Default frame:                                                        │
│  - When ORDER BY is specified: RANGE BETWEEN UNBOUNDED PRECEDING       │
│                                AND CURRENT ROW                         │
│  - When ORDER BY is omitted:   RANGE BETWEEN UNBOUNDED PRECEDING       │
│                                AND UNBOUNDED FOLLOWING                 │
└────────────────────────────────────────────────────────────────────────┘
```

### Position of Window Functions in SQL Execution Order

```
┌────────── SQL Logical Execution Order ──────────────────────┐
│                                                              │
│  ① FROM / JOIN       Table joins                            │
│  ② WHERE             Row filtering                          │
│  ③ GROUP BY          Grouping                               │
│  ④ HAVING            Group filtering                        │
│  ⑤ SELECT            Column computation                     │
│     ├─ Expression    Regular expressions                    │
│     └─ WINDOW        ★ Window functions are evaluated here ★│
│  ⑥ DISTINCT          Deduplication                          │
│  ⑦ ORDER BY          Sorting                                │
│  ⑧ LIMIT/OFFSET      Result limiting                        │
│                                                              │
│  Important:                                                  │
│  - Window functions cannot be used in WHERE/HAVING          │
│  - They operate on the result after GROUP BY                 │
│  - They can be used in the ORDER BY clause                   │
│  - Multiple window functions are evaluated in parallel       │
│    during the same execution phase                           │
└──────────────────────────────────────────────────────────────┘
```

### Code Example 1: Window Functions vs GROUP BY

```sql
-- Sample data
CREATE TABLE employees (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    department_id INTEGER NOT NULL,
    salary        INTEGER NOT NULL,
    hired_date    DATE NOT NULL,
    status        VARCHAR(20) DEFAULT 'active'
);

INSERT INTO employees (name, department_id, salary, hired_date) VALUES
    ('田中太郎', 10, 450000, '2018-04-01'),
    ('佐藤花子', 10, 380000, '2020-07-15'),
    ('鈴木一郎', 20, 520000, '2015-01-10'),
    ('高橋美咲', 20, 450000, '2019-06-01'),
    ('渡辺健太', 30, 600000, '2012-04-01'),
    ('伊藤恵子', 30, 480000, '2017-09-15'),
    ('山本大輔', 30, 420000, '2021-04-01');

-- GROUP BY: rows are collapsed (one row per department)
SELECT department_id, AVG(salary) AS avg_salary
FROM employees
GROUP BY department_id;
-- Result: 3 rows (departments 10, 20, 30)

-- Window function: all rows are preserved (each row gets the department average)
SELECT
    name,
    department_id,
    salary,
    AVG(salary) OVER (PARTITION BY department_id) AS dept_avg_salary,
    salary - AVG(salary) OVER (PARTITION BY department_id) AS diff_from_avg,
    ROUND(
        salary::NUMERIC / SUM(salary) OVER (PARTITION BY department_id) * 100, 1
    ) AS pct_of_dept
FROM employees
ORDER BY department_id, salary DESC;

-- Sample result (all 7 rows preserved):
-- name     | dept_id | salary  | dept_avg  | diff     | pct
-- 田中太郎 |    10   | 450000  | 415000.0  | +35000.0 | 54.2
-- 佐藤花子 |    10   | 380000  | 415000.0  | -35000.0 | 45.8
-- 鈴木一郎 |    20   | 520000  | 485000.0  | +35000.0 | 53.6
-- 高橋美咲 |    20   | 450000  | 485000.0  | -35000.0 | 46.4
-- 渡辺健太 |    30   | 600000  | 500000.0  | +100000  | 40.0
-- 伊藤恵子 |    30   | 480000  | 500000.0  | -20000.0 | 32.0
-- 山本大輔 |    30   | 420000  | 500000.0  | -80000.0 | 28.0
```

### Code Example 2: Combining Window Functions with GROUP BY

```sql
-- Applying window functions to GROUP BY results
-- Window functions are evaluated after GROUP BY execution
SELECT
    department_id,
    COUNT(*) AS emp_count,
    SUM(salary) AS dept_total,
    SUM(COUNT(*)) OVER () AS company_total_count,
    ROUND(
        SUM(salary)::NUMERIC / SUM(SUM(salary)) OVER () * 100, 1
    ) AS pct_of_company,
    RANK() OVER (ORDER BY SUM(salary) DESC) AS salary_rank
FROM employees
GROUP BY department_id;

-- Result:
-- dept_id | emp_count | dept_total | company_total | pct     | rank
-- 30      | 3         | 1500000    | 7             | 45.5    | 1
-- 20      | 2         | 970000     | 7             | 29.4    | 2
-- 10      | 2         | 830000     | 7             | 25.2    | 3
```

---

## 2. Ranking Functions

### Code Example 3: Full Comparison of ROW_NUMBER / RANK / DENSE_RANK / NTILE

```sql
-- Differences between the four ranking approaches
SELECT
    name,
    department_id,
    salary,
    ROW_NUMBER() OVER (ORDER BY salary DESC) AS row_num,
    RANK()       OVER (ORDER BY salary DESC) AS rnk,
    DENSE_RANK() OVER (ORDER BY salary DESC) AS dense_rnk,
    NTILE(3)     OVER (ORDER BY salary DESC) AS tertile,
    PERCENT_RANK() OVER (ORDER BY salary DESC) AS pct_rank,
    CUME_DIST()    OVER (ORDER BY salary DESC) AS cume_dist
FROM employees;

-- Result:
-- name     | dept | salary | row_num | rnk | dense | tertile | pct_rank | cume_dist
-- 渡辺健太 |  30  | 600000 |    1    |  1  |   1   |    1    | 0.0000   | 0.1429
-- 鈴木一郎 |  20  | 520000 |    2    |  2  |   2   |    1    | 0.1667   | 0.2857
-- 田中太郎 |  10  | 450000 |    3    |  3  |   3   |    1    | 0.3333   | 0.5714
-- 高橋美咲 |  20  | 450000 |    4    |  3  |   3   |    2    | 0.3333   | 0.5714
-- 伊藤恵子 |  30  | 480000 |    5    |  5  |   4   |    2    | 0.6667   | 0.7143
-- 山本大輔 |  30  | 420000 |    6    |  6  |   5   |    2    | 0.8333   | 0.8571
-- 佐藤花子 |  10  | 380000 |    7    |  7  |   6   |    3    | 1.0000   | 1.0000
```

### Diagram: Differences Between Ranking Functions

```
┌────────── ROW_NUMBER vs RANK vs DENSE_RANK ──────────────────┐
│                                                               │
│  Data: 100, 90, 90, 80, 70, 70, 70, 60                       │
│                                                               │
│  Value  ROW_NUMBER   RANK    DENSE_RANK   PERCENT_RANK        │
│  100        1          1         1         0.0000             │
│  90         2          2         2         0.1429             │
│  90         3          2         2         0.1429  ← tie      │
│  80         4          4         3         0.4286  ← RANK skips│
│  70         5          5         4         0.5714             │
│  70         6          5         4         0.5714  ← tie      │
│  70         7          5         4         0.5714  ← tie      │
│  60         8          8         5         1.0000  ← RANK skips│
│                                                               │
│  ROW_NUMBER  : Unique sequence. Ties get different numbers    │
│                (non-deterministic)                            │
│  RANK        : Ties share same rank; next rank skips (1,2,2,4)│
│  DENSE_RANK  : Ties share same rank; next rank is consecutive │
│                (1,2,2,3)                                      │
│  PERCENT_RANK: Normalized as (RANK - 1) / (rows - 1)         │
│  CUME_DIST   : Cumulative distribution: rows <= current / total│
│                                                               │
│  NTILE(n):                                                    │
│  ┌────────────────────────────┐                              │
│  │ 8 rows split into 3: [3,3,2]│                             │
│  │ Values 100,90,90 → Group 1  │                             │
│  │ Values 80,70,70  → Group 2  │                             │
│  │ Values 70,60     → Group 3  │                             │
│  │ ※ Remainder goes to first   │                             │
│  │   groups                    │                             │
│  └────────────────────────────┘                              │
└───────────────────────────────────────────────────────────────┘
```

### Code Example 4: PARTITION BY + Ranking (Top-N Problem)

```sql
-- Retrieve top 3 salaries per department (most common pattern)
WITH ranked AS (
    SELECT
        name,
        department_id,
        salary,
        ROW_NUMBER() OVER (
            PARTITION BY department_id
            ORDER BY salary DESC
        ) AS rn
    FROM employees
)
SELECT name, department_id, salary
FROM ranked
WHERE rn <= 3;

-- Top-N including ties (using DENSE_RANK)
WITH ranked AS (
    SELECT
        name,
        department_id,
        salary,
        DENSE_RANK() OVER (
            PARTITION BY department_id
            ORDER BY salary DESC
        ) AS dr
    FROM employees
)
SELECT name, department_id, salary, dr
FROM ranked
WHERE dr <= 3;
-- → If multiple employees are tied at 3rd, all are returned

-- NTILE: split into N equal groups (quartile calculation)
SELECT
    name,
    salary,
    NTILE(4) OVER (ORDER BY salary) AS quartile,
    CASE NTILE(4) OVER (ORDER BY salary)
        WHEN 1 THEN 'Bottom 25%'
        WHEN 2 THEN '25-50%'
        WHEN 3 THEN '50-75%'
        WHEN 4 THEN 'Top 25%'
    END AS quartile_label
FROM employees;
```

### Code Example 5: Deduplication

```sql
-- Keep only the most recent record for duplicate email addresses
WITH dedup AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY email
            ORDER BY updated_at DESC
        ) AS rn
    FROM users
)
-- Preview
SELECT * FROM dedup WHERE rn > 1;

-- Execute deletion
DELETE FROM users
WHERE id IN (
    SELECT id FROM (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY email
                ORDER BY updated_at DESC
            ) AS rn
        FROM users
    ) ranked
    WHERE rn > 1
);

-- PostgreSQL-specific: DELETE using CTE
WITH dedup AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY email
               ORDER BY updated_at DESC
           ) AS rn
    FROM users
)
DELETE FROM users
WHERE id IN (SELECT id FROM dedup WHERE rn > 1);
```

---

## 3. Forward/Backward Row References: LAG / LEAD

### Code Example 6: Basics and Applications of LAG / LEAD

```sql
-- Monthly sales table
CREATE TABLE monthly_sales (
    month    DATE PRIMARY KEY,
    revenue  DECIMAL(12, 2)
);

-- Calculate month-over-month and year-over-year changes
SELECT
    month,
    revenue,
    LAG(revenue, 1) OVER (ORDER BY month)  AS prev_month,
    LEAD(revenue, 1) OVER (ORDER BY month) AS next_month,
    LAG(revenue, 12) OVER (ORDER BY month) AS prev_year_same_month,
    -- Month-over-month change (amount)
    revenue - LAG(revenue, 1) OVER (ORDER BY month) AS mom_change,
    -- Month-over-month change (percentage)
    ROUND(
        (revenue - LAG(revenue, 1) OVER (ORDER BY month))::NUMERIC
        / NULLIF(LAG(revenue, 1) OVER (ORDER BY month), 0) * 100, 1
    ) AS mom_pct,
    -- Year-over-year change
    ROUND(
        (revenue - LAG(revenue, 12) OVER (ORDER BY month))::NUMERIC
        / NULLIF(LAG(revenue, 12) OVER (ORDER BY month), 0) * 100, 1
    ) AS yoy_pct
FROM monthly_sales
ORDER BY month;

-- Third argument of LAG: default value (instead of NULL)
SELECT
    month,
    revenue,
    LAG(revenue, 1, 0) OVER (ORDER BY month) AS prev_or_zero,
    -- No NULL for the first row
    revenue - LAG(revenue, 1, revenue) OVER (ORDER BY month) AS change_safe
FROM monthly_sales;
```

### Code Example 7: FIRST_VALUE / LAST_VALUE / NTH_VALUE

```sql
-- Names of the highest and lowest earners per department
SELECT
    name,
    department_id,
    salary,
    FIRST_VALUE(name) OVER w AS highest_paid,
    LAST_VALUE(name) OVER (
        PARTITION BY department_id ORDER BY salary DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS lowest_paid,
    NTH_VALUE(name, 2) OVER w AS second_highest,
    -- Gap from the highest salary
    FIRST_VALUE(salary) OVER w - salary AS gap_from_top
FROM employees
WINDOW w AS (PARTITION BY department_id ORDER BY salary DESC);

-- First and last page within a session
SELECT
    session_id,
    page_url,
    viewed_at,
    FIRST_VALUE(page_url) OVER (
        PARTITION BY session_id ORDER BY viewed_at
    ) AS landing_page,
    LAST_VALUE(page_url) OVER (
        PARTITION BY session_id ORDER BY viewed_at
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS exit_page,
    FIRST_VALUE(viewed_at) OVER (
        PARTITION BY session_id ORDER BY viewed_at
    ) AS session_start,
    LAST_VALUE(viewed_at) OVER (
        PARTITION BY session_id ORDER BY viewed_at
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS session_end
FROM page_views;
```

### Code Example 8: Difference Calculation for Sequential Data (IoT Sensor Data)

```sql
-- Detecting changes in sensor data
SELECT
    sensor_id,
    measured_at,
    temperature,
    LAG(temperature) OVER w AS prev_temp,
    temperature - LAG(temperature) OVER w AS temp_change,
    -- Detect sudden changes (more than 5 degrees from previous reading)
    CASE
        WHEN ABS(temperature - LAG(temperature) OVER w) > 5.0
        THEN 'ALERT'
        ELSE 'NORMAL'
    END AS status,
    -- Check measurement interval
    measured_at - LAG(measured_at) OVER w AS time_gap,
    -- Detect gaps (more than twice the normal interval)
    CASE
        WHEN measured_at - LAG(measured_at) OVER w > INTERVAL '10 minutes'
        THEN 'GAP_DETECTED'
        ELSE 'OK'
    END AS continuity
FROM sensor_data
WINDOW w AS (PARTITION BY sensor_id ORDER BY measured_at);
```

---

## 4. Frame Specification and Cumulative Aggregation

### Details: ROWS vs RANGE vs GROUPS

```
┌──────── Differences Between ROWS, RANGE, and GROUPS ─────────────────────┐
│                                                                            │
│  Data: ORDER BY salary with the following rows:                            │
│  Row A: salary=300000                                                      │
│  Row B: salary=400000                                                      │
│  Row C: salary=400000  ← same value as B (peer)                           │
│  Row D: salary=500000                                                      │
│  Row E: salary=600000                                                      │
│                                                                            │
│  ■ ROWS: range determined by physical row count                            │
│    ROWS BETWEEN 1 PRECEDING AND CURRENT ROW                                │
│    For Row C: [Row B, Row C] (physically 1 row before + current row)       │
│                                                                            │
│  ■ RANGE: range determined by logical value range                          │
│    RANGE BETWEEN CURRENT ROW AND CURRENT ROW                               │
│    For Row C: [Row B, Row C] (entire peer group with salary=400000)        │
│                                                                            │
│    RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW (default)             │
│    For Row C: [Row A, Row B, Row C] (from start through current row        │
│    including ties)                                                         │
│                                                                            │
│  ■ GROUPS (SQL:2011 / PostgreSQL 11+):                                     │
│    Range determined in units of peer groups                                │
│    GROUPS BETWEEN 1 PRECEDING AND CURRENT ROW                              │
│    For Row C: [Row A, Row B, Row C]                                        │
│    (previous 1 group {300000} + current group {400000, 400000})            │
│                                                                            │
│  Default frame (when ORDER BY is specified):                               │
│  RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW                         │
│  → Because rows with the same value are all included, results may differ   │
│    from ROWS                                                               │
└────────────────────────────────────────────────────────────────────────────┘
```

### Code Example 9: Running Total and Moving Average

```sql
-- Daily sales table
CREATE TABLE daily_sales (
    sale_date DATE PRIMARY KEY,
    amount    DECIMAL(10, 2)
);

-- Running Total
SELECT
    sale_date,
    amount,
    SUM(amount) OVER (
        ORDER BY sale_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_total
FROM daily_sales;

-- 7-day moving average (average of the most recent 7 days)
SELECT
    sale_date,
    amount,
    ROUND(
        AVG(amount) OVER (
            ORDER BY sale_date
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ), 2
    ) AS moving_avg_7d,
    COUNT(*) OVER (
        ORDER BY sale_date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS window_size  -- near the start, there may be fewer than 7 days of data
FROM daily_sales;

-- Monthly cumulative total (resets each month)
SELECT
    sale_date,
    amount,
    SUM(amount) OVER (
        PARTITION BY DATE_TRUNC('month', sale_date)
        ORDER BY sale_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS mtd_total  -- Month-to-Date
FROM daily_sales;

-- Smoothing over ±3 days (outlier mitigation)
SELECT
    sale_date,
    amount,
    AVG(amount) OVER (
        ORDER BY sale_date
        ROWS BETWEEN 3 PRECEDING AND 3 FOLLOWING
    ) AS smoothed_7d
FROM daily_sales;
```

### Code Example 10: Advanced Analysis Using Frames

```sql
-- Proportion and cumulative proportion within a partition
SELECT
    name,
    department_id,
    salary,
    -- Share within department
    ROUND(
        salary::NUMERIC / SUM(salary) OVER (PARTITION BY department_id) * 100, 1
    ) AS pct_of_dept,
    -- Share across the entire company
    ROUND(
        salary::NUMERIC / SUM(salary) OVER () * 100, 1
    ) AS pct_of_total,
    -- Cumulative proportion (within department, by descending salary)
    ROUND(
        SUM(salary) OVER (
            PARTITION BY department_id
            ORDER BY salary DESC
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        )::NUMERIC / SUM(salary) OVER (PARTITION BY department_id) * 100, 1
    ) AS cumulative_pct
FROM employees
ORDER BY department_id, salary DESC;

-- Pareto analysis (do the top 20% account for 80% of revenue?)
WITH product_sales AS (
    SELECT
        product_id,
        SUM(amount) AS total_sales,
        RANK() OVER (ORDER BY SUM(amount) DESC) AS sales_rank,
        COUNT(*) OVER () AS total_products
    FROM orders
    GROUP BY product_id
)
SELECT
    product_id,
    total_sales,
    sales_rank,
    ROUND(sales_rank::NUMERIC / total_products * 100, 1) AS rank_pct,
    ROUND(
        SUM(total_sales) OVER (ORDER BY total_sales DESC
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
        / SUM(total_sales) OVER () * 100, 1
    ) AS cumulative_revenue_pct
FROM product_sales
ORDER BY sales_rank;
```

### Code Example 11: EXCLUDE Clause (SQL:2011 / PostgreSQL 11+)

```sql
-- Excluding peer rows (ties) using the EXCLUDE clause
SELECT
    name,
    salary,
    -- Default: peers with the same value are included
    AVG(salary) OVER (
        ORDER BY salary
        ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING
    ) AS avg_with_current,
    -- EXCLUDE CURRENT ROW: exclude the current row
    AVG(salary) OVER (
        ORDER BY salary
        ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING
        EXCLUDE CURRENT ROW
    ) AS avg_without_current,
    -- EXCLUDE TIES: exclude other rows with the same value (current row is included)
    AVG(salary) OVER (
        ORDER BY salary
        ROWS BETWEEN 2 PRECEDING AND 2 FOLLOWING
        EXCLUDE TIES
    ) AS avg_exclude_ties,
    -- EXCLUDE GROUP: exclude the entire peer group
    AVG(salary) OVER (
        ORDER BY salary
        ROWS BETWEEN 2 PRECEDING AND 2 FOLLOWING
        EXCLUDE GROUP
    ) AS avg_exclude_group
FROM employees;
```

### Visualization of Frame Behavior

```
┌──────── Frame Visualization (ROWS BETWEEN 2 PRECEDING AND 1 FOLLOWING) ──┐
│                                                                            │
│  Row 1: 100  ─┐                                                           │
│  Row 2: 200  ─┤─ Frame for Row 2: [Row 1, Row 2, Row 3]                  │
│  Row 3: 150  ─┘                                                           │
│  Row 4: 300  ─┐                                                           │
│  Row 5: 250  ─┤─ Frame for Row 5: [Row 3, Row 4, Row 5, Row 6]           │
│  Row 6: 180  ─┘                                                           │
│  Row 7: 220      Frame for Row 7: [Row 5, Row 6, Row 7] ← shrinks at end  │
│                                                                            │
│  ┌─────── Common Frame Specifications ────────────────┐                   │
│  │                                                     │                   │
│  │ Running total:                                      │                   │
│  │   ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW  │                   │
│  │   [first row ... current row]                       │                   │
│  │                                                     │                   │
│  │ Moving average (7 days):                            │                   │
│  │   ROWS BETWEEN 6 PRECEDING AND CURRENT ROW          │                   │
│  │   [6 rows back ... current row]                     │                   │
│  │                                                     │                   │
│  │ Centered moving average:                            │                   │
│  │   ROWS BETWEEN 3 PRECEDING AND 3 FOLLOWING          │                   │
│  │   [3 rows back ... current row ... 3 rows ahead]    │                   │
│  │                                                     │                   │
│  │ Entire partition:                                   │                   │
│  │   ROWS BETWEEN UNBOUNDED PRECEDING                  │                   │
│  │                AND UNBOUNDED FOLLOWING               │                   │
│  │   [first row ... last row]                          │                   │
│  └─────────────────────────────────────────────────────┘                   │
└────────────────────────────────────────────────────────────────────────────┘
```

### Code Example 12: Named Windows (WINDOW Clause)

```sql
-- Reusing the same window definition
SELECT
    name,
    department_id,
    salary,
    ROW_NUMBER() OVER w_dept AS rn,
    RANK() OVER w_dept AS rnk,
    DENSE_RANK() OVER w_dept AS dense_rnk,
    SUM(salary) OVER w_dept AS running_sum,
    AVG(salary) OVER w_dept AS running_avg,
    -- Inherit the WINDOW clause and change the frame
    SUM(salary) OVER (w_dept ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS dept_total
FROM employees
WINDOW w_dept AS (PARTITION BY department_id ORDER BY salary DESC)
ORDER BY department_id, salary DESC;

-- Defining multiple windows
SELECT
    name,
    department_id,
    salary,
    hired_date,
    ROW_NUMBER() OVER w_salary AS salary_rank,
    ROW_NUMBER() OVER w_tenure AS tenure_rank,
    SUM(salary) OVER w_dept_all AS dept_total
FROM employees
WINDOW
    w_salary AS (PARTITION BY department_id ORDER BY salary DESC),
    w_tenure AS (PARTITION BY department_id ORDER BY hired_date),
    w_dept_all AS (PARTITION BY department_id);
```

---

## 5. Practical Pattern Collection

### Code Example 13: Gap Detection and the Islands Problem

```sql
-- Detect "islands" of consecutive logins (Islands and Gaps problem)
-- If there is a gap of 1 or more days between sessions, start a new island

WITH login_groups AS (
    SELECT
        user_id,
        login_date,
        -- Subtracting the row number from login_date gives the same group value
        -- for consecutive dates
        login_date - (ROW_NUMBER() OVER (
            PARTITION BY user_id ORDER BY login_date
        ))::INTEGER AS grp
    FROM user_logins
)
SELECT
    user_id,
    MIN(login_date) AS streak_start,
    MAX(login_date) AS streak_end,
    COUNT(*) AS consecutive_days
FROM login_groups
GROUP BY user_id, grp
HAVING COUNT(*) >= 7  -- 7 or more consecutive login days
ORDER BY user_id, streak_start;

-- Detecting gaps (identifying missing dates)
SELECT
    login_date AS last_login,
    LEAD(login_date) OVER (
        PARTITION BY user_id ORDER BY login_date
    ) AS next_login,
    LEAD(login_date) OVER (
        PARTITION BY user_id ORDER BY login_date
    ) - login_date - 1 AS gap_days
FROM user_logins
WHERE user_id = 42;
```

### Code Example 14: Sessionization

```sql
-- Split page view events into sessions with a 30-minute gap threshold
WITH events_with_gap AS (
    SELECT
        user_id,
        event_time,
        page_url,
        -- Calculate the time gap since the previous event
        event_time - LAG(event_time) OVER (
            PARTITION BY user_id ORDER BY event_time
        ) AS time_gap,
        -- Start a new session if more than 30 minutes have passed
        CASE WHEN event_time - LAG(event_time) OVER (
            PARTITION BY user_id ORDER BY event_time
        ) > INTERVAL '30 minutes'
        OR LAG(event_time) OVER (
            PARTITION BY user_id ORDER BY event_time
        ) IS NULL  -- First event
        THEN 1 ELSE 0
        END AS new_session_flag
    FROM page_views
),
sessions AS (
    SELECT
        *,
        -- Generate a session ID using cumulative SUM
        SUM(new_session_flag) OVER (
            PARTITION BY user_id ORDER BY event_time
        ) AS session_id
    FROM events_with_gap
)
SELECT
    user_id,
    session_id,
    MIN(event_time) AS session_start,
    MAX(event_time) AS session_end,
    COUNT(*) AS page_views,
    MAX(event_time) - MIN(event_time) AS session_duration
FROM sessions
GROUP BY user_id, session_id
ORDER BY user_id, session_start;
```

### Code Example 15: Change Detection

```sql
-- Flatten the price change history
SELECT
    product_id,
    price,
    effective_from,
    LEAD(effective_from) OVER (
        PARTITION BY product_id ORDER BY effective_from
    ) - INTERVAL '1 day' AS effective_until,
    -- If LEAD is NULL, the price is still in effect
    COALESCE(
        LEAD(effective_from) OVER (
            PARTITION BY product_id ORDER BY effective_from
        ) - INTERVAL '1 day',
        CURRENT_DATE
    ) AS effective_until_safe,
    -- Rate of change from the previous price
    ROUND(
        (price - LAG(price) OVER (
            PARTITION BY product_id ORDER BY effective_from
        ))::NUMERIC / NULLIF(LAG(price) OVER (
            PARTITION BY product_id ORDER BY effective_from
        ), 0) * 100, 2
    ) AS price_change_pct
FROM product_prices
ORDER BY product_id, effective_from;
```

---

## 6. Query Optimizer and Internal Implementation of Window Functions

### Execution Plan for Window Functions

```
┌──────── Execution Plan for Window Functions ───────────────────────────┐
│                                                                         │
│  Reading PostgreSQL EXPLAIN ANALYZE output:                             │
│                                                                         │
│  WindowAgg                                                              │
│  ├── Sort (sort based on PARTITION BY + ORDER BY)                       │
│  │   └── Seq Scan on employees                                         │
│  │       Filter: (status = 'active')                                   │
│  │                                                                      │
│  │  Sort Key: department_id, salary DESC                               │
│  │  Sort Method: quicksort  Memory: 25kB                               │
│  │                                                                      │
│  Execution flow:                                                        │
│  ① Table scan + WHERE filter                                           │
│  ② Sort based on PARTITION BY + ORDER BY                               │
│  ③ Compute window functions on sorted data                             │
│                                                                         │
│  Processing per partition:                                              │
│  ┌────────────────────────────────────┐                                │
│  │ Partition 1 (dept=10)              │                                │
│  │ Sorted: [450000, 380000]           │                                │
│  │ → ROW_NUMBER: 1, 2                 │                                │
│  │ → SUM (cumulative): 450000, 830000 │                                │
│  ├────────────────────────────────────┤                                │
│  │ Partition 2 (dept=20)              │                                │
│  │ Sorted: [520000, 450000]           │                                │
│  │ → ROW_NUMBER: 1, 2                 │                                │
│  │ → SUM (cumulative): 520000, 970000 │                                │
│  └────────────────────────────────────┘                                │
│                                                                         │
│  Window functions that share the same PARTITION BY + ORDER BY           │
│  can be computed together with a single sort pass                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Code Example 16: Checking and Optimizing Execution Plans

```sql
-- Check the execution plan
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
    name,
    department_id,
    salary,
    ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rn,
    SUM(salary) OVER (PARTITION BY department_id) AS dept_total
FROM employees
WHERE status = 'active';

-- Optimization: index for window functions
-- Index covering PARTITION BY + ORDER BY columns
CREATE INDEX idx_emp_dept_salary
ON employees (department_id, salary DESC)
WHERE status = 'active';  -- Partial index also covers WHERE clause

-- Verify: check if the sort step is eliminated
EXPLAIN (ANALYZE)
SELECT
    name, department_id, salary,
    ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rn
FROM employees
WHERE status = 'active';
-- → If the Sort node disappears and becomes an Index Scan, it is working

-- Number of sort passes when multiple different window definitions are present
EXPLAIN (ANALYZE)
SELECT
    name,
    ROW_NUMBER() OVER (ORDER BY salary DESC) AS salary_rank,
    ROW_NUMBER() OVER (ORDER BY hired_date) AS tenure_rank
FROM employees;
-- → Two sort passes are required (because the window definitions differ)
```

### Performance Optimization Guidelines

```
┌──────── Window Function Performance Optimization ─────────────┐
│                                                                 │
│  ■ Sort Optimization                                            │
│  ┌─────────────────────────────────────────────┐               │
│  │ Problem: Sorting large data consumes memory  │               │
│  │          and time                            │               │
│  │                                              │               │
│  │ Solution 1: Create a composite index         │               │
│  │   CREATE INDEX ON t (partition_col, order_col)│              │
│  │   → Sort becomes unnecessary                 │               │
│  │                                              │               │
│  │ Solution 2: Share the same window definition │               │
│  │   WINDOW w AS (...) for a single sort pass   │               │
│  │                                              │               │
│  │ Solution 3: Adjust work_mem                  │               │
│  │   SET work_mem = '256MB';                    │               │
│  │   → Prevent disk spill                       │               │
│  └─────────────────────────────────────────────┘               │
│                                                                 │
│  ■ ROWS vs RANGE Performance                                    │
│  ┌─────────────────────────────────────────────┐               │
│  │ ROWS: O(1) per row (direct access to frame   │               │
│  │       rows)                                  │               │
│  │ RANGE: Peer group lookup needed; slightly    │               │
│  │        slower                                │               │
│  │                                              │               │
│  │ Recommendation: Explicitly specify ROWS      │               │
│  │ (faster and more predictable than the default│               │
│  │  RANGE)                                      │               │
│  └─────────────────────────────────────────────┘               │
│                                                                 │
│  ■ Notes for Large-Scale Data                                   │
│  ┌─────────────────────────────────────────────┐               │
│  │ - Window functions need to hold all partition│               │
│  │   data in memory                             │               │
│  │ - Be careful with very large partitions      │               │
│  │ - Pre-filter rows with WHERE to reduce count │               │
│  │ - Without PARTITION BY, all rows form one    │               │
│  │   partition                                  │               │
│  └─────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Cross-RDBMS Compatibility

### Window Function Support Comparison Table

| Feature | PostgreSQL | MySQL 8.0+ | SQL Server | Oracle | SQLite 3.25+ |
|---------|-----------|-------------|------------|--------|-------------|
| ROW_NUMBER | Supported | Supported | Supported | Supported | Supported |
| RANK/DENSE_RANK | Supported | Supported | Supported | Supported | Supported |
| NTILE | Supported | Supported | Supported | Supported | Supported |
| LAG/LEAD | Supported | Supported | Supported | Supported | Supported |
| FIRST_VALUE/LAST_VALUE | Supported | Supported | Supported | Supported | Supported |
| NTH_VALUE | Supported | Supported | Not supported | Supported | Supported |
| PERCENT_RANK | Supported | Supported | Supported | Supported | Supported |
| CUME_DIST | Supported | Supported | Supported | Supported | Supported |
| WINDOW clause | Supported | Supported | Not supported | Not supported | Supported |
| GROUPS frame | Supported (11+) | Not supported | Not supported | Not supported | Supported (3.28+) |
| EXCLUDE clause | Supported (11+) | Not supported | Not supported | Not supported | Supported (3.28+) |
| FILTER + window | Supported | Not supported | Not supported | Not supported | Supported |
| RANGE + numeric range | Supported | Supported | Supported | Supported | Supported |
| RANGE + INTERVAL | Supported | Not supported | Not supported | Supported | Not supported |

### RDBMS-Specific Syntax

```sql
-- ■ SQL Server: Pagination using ROW_NUMBER()
-- SQL Server has no LIMIT/OFFSET, so OFFSET...FETCH is used
SELECT name, salary
FROM (
    SELECT name, salary,
           ROW_NUMBER() OVER (ORDER BY salary DESC) AS rn
    FROM employees
) sub
WHERE rn BETWEEN 11 AND 20;  -- Page 2

-- SQL Server 2012+
SELECT name, salary
FROM employees
ORDER BY salary DESC
OFFSET 10 ROWS FETCH NEXT 10 ROWS ONLY;

-- ■ Oracle: Extended analytic function syntax
-- KEEP (DENSE_RANK FIRST/LAST) — used with aggregate functions
SELECT
    department_id,
    MAX(salary) AS max_salary,
    MAX(name) KEEP (DENSE_RANK FIRST ORDER BY salary DESC) AS top_earner
FROM employees
GROUP BY department_id;

-- ■ MySQL 8.0+: Window function limitations
-- MySQL does not support FILTER clause or WINDOW clause chaining (inheritance)
-- Use CASE as an alternative
SELECT
    name,
    SUM(CASE WHEN status = 'active' THEN salary ELSE 0 END) OVER (
        PARTITION BY department_id
    ) AS active_salary_total
FROM employees;

-- ■ PostgreSQL: Combining FILTER clause with window functions
SELECT
    name,
    department_id,
    salary,
    COUNT(*) FILTER (WHERE salary > 400000) OVER (
        PARTITION BY department_id
    ) AS high_earner_count
FROM employees;
```

---

## Window Function Reference Table

| Function | Category | Description | Frame | Notes |
|----------|----------|-------------|-------|-------|
| ROW_NUMBER() | Ranking | Unique sequence number | Not used | Order of ties is non-deterministic |
| RANK() | Ranking | Allows ties; skips next rank | Not used | Rank gaps appear after ties |
| DENSE_RANK() | Ranking | Allows ties; no gaps in rank | Not used | Always consecutive numbers |
| NTILE(n) | Ranking | Split into N equal groups | Not used | Remainder goes to first groups |
| PERCENT_RANK() | Ranking | Normalized rank (0–1) | Not used | (rank-1)/(rows-1) |
| CUME_DIST() | Ranking | Cumulative distribution (0–1) | Not used | rows <= current / total rows |
| LAG(col, n, default) | Row reference | Value N rows before | Not used | n defaults to 1; default defaults to NULL |
| LEAD(col, n, default) | Row reference | Value N rows after | Not used | n defaults to 1 |
| FIRST_VALUE(col) | Row reference | First value in the frame | Applicable | Works with default frame |
| LAST_VALUE(col) | Row reference | Last value in the frame | Important | Requires UNBOUNDED FOLLOWING |
| NTH_VALUE(col, n) | Row reference | Nth value in the frame | Applicable | Not supported in SQL Server |
| SUM/AVG/COUNT/MIN/MAX | Aggregate | Aggregation within the frame | Applicable | Frame controls the range |

## ROWS vs RANGE vs GROUPS Comparison Table

| Item | ROWS | RANGE | GROUPS |
|------|------|-------|--------|
| Unit | Physical row count | Logical value range | Number of peer groups |
| Handling of ties | Treated individually | Treated together | Treated as a group |
| Default | -- | Default when ORDER BY is specified | -- |
| Performance | Fastest | Slightly slower | In between |
| Recommended for | Moving averages, running totals | Value-based range aggregation | Group-unit analysis |
| Supported RDBMS | All RDBMS | All RDBMS | PostgreSQL 11+, SQLite 3.28+ |
| N PRECEDING/FOLLOWING | N rows before/after | Value within N | N groups before/after |

---

## Edge Cases

### Edge Case 1: Handling NULL

```sql
-- NULL in window functions
-- When NULL is present in ORDER BY
SELECT
    name,
    salary,
    ROW_NUMBER() OVER (ORDER BY salary) AS rn,
    RANK() OVER (ORDER BY salary) AS rnk
FROM employees;
-- → NULL typically appears last (PostgreSQL defaults to NULLS LAST)

-- Control using NULLS FIRST
SELECT
    name,
    salary,
    ROW_NUMBER() OVER (ORDER BY salary NULLS FIRST) AS rn
FROM employees;

-- LAG/LEAD and NULL
-- You cannot distinguish whether a NULL comes from the previous row being NULL
-- or from there being no previous row (first row)
SELECT
    sale_date,
    amount,
    LAG(amount) OVER (ORDER BY sale_date) AS prev_amount,
    -- How to distinguish: use ROW_NUMBER to identify the first row
    CASE
        WHEN ROW_NUMBER() OVER (ORDER BY sale_date) = 1 THEN 'FIRST_ROW'
        WHEN LAG(amount) OVER (ORDER BY sale_date) IS NULL THEN 'NULL_VALUE'
        ELSE 'HAS_VALUE'
    END AS prev_status
FROM daily_sales;
```

### Edge Case 2: Non-Determinism of ROW_NUMBER

```sql
-- BAD: If there are ties, ROW_NUMBER results may differ between executions
SELECT
    name, salary,
    ROW_NUMBER() OVER (ORDER BY salary DESC) AS rn
FROM employees;
-- If two employees have salary=450000, the assignment of rn=2,3 is non-deterministic

-- GOOD: Add a tiebreaker to make it deterministic
SELECT
    name, salary,
    ROW_NUMBER() OVER (ORDER BY salary DESC, id ASC) AS rn
FROM employees;
-- Since id is unique, the result is always the same
```

### Edge Case 3: Single Row in a Partition

```sql
-- Behavior of each function when a partition contains only one row
-- ROW_NUMBER: 1
-- RANK: 1
-- DENSE_RANK: 1
-- LAG: NULL (no previous row)
-- LEAD: NULL (no next row)
-- NTILE(4): 1 (all data falls into group 1)
-- FIRST_VALUE: value of that row
-- LAST_VALUE: value of that row
-- SUM/AVG/COUNT: value of that row / 1

-- Near the start of a moving average, the window shrinks
SELECT
    sale_date,
    amount,
    AVG(amount) OVER (ORDER BY sale_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS ma7,
    COUNT(*) OVER (ORDER BY sale_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS window_size
FROM daily_sales
ORDER BY sale_date
LIMIT 10;
-- For the first 7 rows, window_size grows as 1, 2, 3, ..., 7
-- → Note that the moving average is unstable at the start
```

### Edge Case 4: Empty Partition

```sql
-- If PARTITION BY results in some partitions having no rows,
-- no rows appear in the window function result for that partition
-- (NULL is not returned)
-- Use LEFT JOIN to include all categories in the output

SELECT
    c.category_name,
    s.amount,
    s.sale_date,
    COALESCE(
        ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY s.sale_date),
        0
    ) AS rn
FROM categories c
LEFT JOIN sales s ON c.id = s.category_id;
```

---

## Anti-Patterns

### Anti-Pattern 1: The LAST_VALUE Frame Problem

```sql
-- BAD: With the default frame, LAST_VALUE does not behave as expected
SELECT
    name, salary,
    LAST_VALUE(name) OVER (ORDER BY salary) AS last_name
FROM employees;
-- → Default frame is RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
-- → "Last" at each row = the current row itself

-- GOOD: Specify the frame explicitly
SELECT
    name, salary,
    LAST_VALUE(name) OVER (
        ORDER BY salary
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS last_name
FROM employees;

-- Implementation note: FIRST_VALUE works correctly with the default frame
-- because the start of UNBOUNDED PRECEDING AND CURRENT ROW is always
-- the beginning of the partition
```

### Anti-Pattern 2: Filtering Window Function Results Directly in WHERE

```sql
-- BAD: Window functions cannot be used in the WHERE clause
--      (constraint of SQL logical execution order)
SELECT name, salary, ROW_NUMBER() OVER (ORDER BY salary DESC) AS rn
FROM employees
WHERE rn <= 10;  -- Error!

-- GOOD: Wrap in a subquery
SELECT * FROM (
    SELECT name, salary, ROW_NUMBER() OVER (ORDER BY salary DESC) AS rn
    FROM employees
) ranked
WHERE rn <= 10;

-- GOOD: Use a CTE (recommended)
WITH ranked AS (
    SELECT name, salary, ROW_NUMBER() OVER (ORDER BY salary DESC) AS rn
    FROM employees
)
SELECT * FROM ranked WHERE rn <= 10;

-- QUALIFY clause (supported by some RDBMS: Snowflake, BigQuery, DuckDB)
-- An SQL extension that allows filtering on window function results
SELECT name, salary, ROW_NUMBER() OVER (ORDER BY salary DESC) AS rn
FROM employees
QUALIFY rn <= 10;  -- Not available in PostgreSQL/MySQL/SQL Server
```

### Anti-Pattern 3: Overusing Different Window Definitions

```sql
-- BAD: Many different window definitions (multiple sort passes occur)
SELECT
    name,
    ROW_NUMBER() OVER (ORDER BY salary DESC) AS salary_rank,
    ROW_NUMBER() OVER (ORDER BY hired_date ASC) AS tenure_rank,
    ROW_NUMBER() OVER (ORDER BY name ASC) AS alpha_rank,
    ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY salary DESC) AS dept_rank
FROM employees;
-- → Four different sorts are required, which is very costly

-- GOOD: Use only what is necessary, and share window definitions where possible
SELECT
    name,
    ROW_NUMBER() OVER w AS salary_rank,
    RANK() OVER w AS salary_rnk,
    SUM(salary) OVER w AS running_sum
FROM employees
WINDOW w AS (ORDER BY salary DESC);
-- → Three functions computed with a single sort pass
```

### Anti-Pattern 4: Not Using Window Functions When They Could Replace Self-Joins

```sql
-- BAD: Calculating month-over-month change using a self-join
--      (inefficient and error-prone)
SELECT
    a.month,
    a.revenue,
    b.revenue AS prev_revenue,
    a.revenue - b.revenue AS change
FROM monthly_sales a
LEFT JOIN monthly_sales b
    ON b.month = a.month - INTERVAL '1 month';
-- → Join conditions become complex at month boundaries, business days only, etc.

-- GOOD: Concise and accurate with LAG
SELECT
    month,
    revenue,
    LAG(revenue) OVER (ORDER BY month) AS prev_revenue,
    revenue - LAG(revenue) OVER (ORDER BY month) AS change
FROM monthly_sales;
```

---

## Security Considerations

```
┌──────── Security Considerations ───────────────────────────────┐
│                                                                  │
│  ■ Interaction with Row-Level Security (RLS)                     │
│  ┌──────────────────────────────────────────────┐               │
│  │ When using window functions on RLS-enabled   │               │
│  │ tables:                                      │               │
│  │ - RLS filter is applied first (like WHERE)   │               │
│  │ - User A's RANK is computed among rows they  │               │
│  │   can see (by design)                        │               │
│  │ - They cannot learn the overall ranking      │               │
│  │ - However, gaps in RANK() values may reveal  │               │
│  │   the existence of hidden rows               │               │
│  │   → DENSE_RANK is safer in this case         │               │
│  └──────────────────────────────────────────────┘               │
│                                                                  │
│  ■ Performance DoS                                               │
│  ┌──────────────────────────────────────────────┐               │
│  │ - Window functions without PARTITION BY sort │               │
│  │   all rows                                   │               │
│  │ - Unrestricted window functions on large     │               │
│  │   tables consume significant memory and CPU  │               │
│  │ - If ORDER BY columns are dynamically         │               │
│  │   generated from user input, whitelist        │               │
│  │   validation is mandatory                     │               │
│  └──────────────────────────────────────────────┘               │
│                                                                  │
│  ■ Window Functions Through Views                                │
│  ┌──────────────────────────────────────────────┐               │
│  │ Views containing window functions are        │               │
│  │ non-updatable                                │               │
│  │ → INSERT/UPDATE/DELETE will result in errors │               │
│  │ → Can be worked around with INSTEAD OF       │               │
│  │   triggers (Oracle/PostgreSQL)               │               │
│  └──────────────────────────────────────────────┘               │
└──────────────────────────────────────────────────────────────────┘
```

---

## Practice Exercises

### Exercise 1: Fundamentals — Ranking and Row References

```sql
-- Problem: Write the required queries for the following table.
CREATE TABLE exam_scores (
    student_id   INTEGER,
    subject      VARCHAR(20),
    score        INTEGER,
    exam_date    DATE
);

-- Q1: Ranking by score per subject (ties share the same rank; no gaps)
-- Q2: Change in each student's score compared to their previous exam
-- Q3: Top 3 per subject (include all students in case of ties)
```

**Model Answers:**

```sql
-- Q1: DENSE_RANK for tied rankings with consecutive numbers
SELECT
    student_id,
    subject,
    score,
    DENSE_RANK() OVER (PARTITION BY subject ORDER BY score DESC) AS rank
FROM exam_scores;

-- Q2: Change from previous exam using LAG
SELECT
    student_id,
    subject,
    exam_date,
    score,
    LAG(score) OVER (
        PARTITION BY student_id, subject ORDER BY exam_date
    ) AS prev_score,
    score - LAG(score) OVER (
        PARTITION BY student_id, subject ORDER BY exam_date
    ) AS score_change
FROM exam_scores
ORDER BY student_id, subject, exam_date;

-- Q3: Top-3 (including ties)
WITH ranked AS (
    SELECT
        student_id,
        subject,
        score,
        DENSE_RANK() OVER (PARTITION BY subject ORDER BY score DESC) AS dr
    FROM exam_scores
)
SELECT * FROM ranked WHERE dr <= 3
ORDER BY subject, dr;
```

### Exercise 2: Applied — Moving Averages and Cumulative Analysis

```sql
-- Problem: Write queries for the following stock price data.
CREATE TABLE stock_prices (
    ticker     VARCHAR(10),
    trade_date DATE,
    close_price DECIMAL(10, 2),
    volume      BIGINT
);

-- Q1: Calculate the 5-day and 20-day moving averages for each ticker
-- Q2: Detect golden crosses (days when the 5-day MA crosses above the 20-day MA)
-- Q3: Calculate the daily deviation from each ticker's year-to-date high and low
```

**Model Answers:**

```sql
-- Q1: Moving averages
SELECT
    ticker,
    trade_date,
    close_price,
    ROUND(AVG(close_price) OVER (
        PARTITION BY ticker ORDER BY trade_date
        ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
    ), 2) AS ma5,
    ROUND(AVG(close_price) OVER (
        PARTITION BY ticker ORDER BY trade_date
        ROWS BETWEEN 19 PRECEDING AND CURRENT ROW
    ), 2) AS ma20
FROM stock_prices;

-- Q2: Golden cross detection
WITH ma AS (
    SELECT
        ticker,
        trade_date,
        close_price,
        AVG(close_price) OVER (
            PARTITION BY ticker ORDER BY trade_date
            ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
        ) AS ma5,
        AVG(close_price) OVER (
            PARTITION BY ticker ORDER BY trade_date
            ROWS BETWEEN 19 PRECEDING AND CURRENT ROW
        ) AS ma20
    FROM stock_prices
),
with_prev AS (
    SELECT
        *,
        LAG(ma5) OVER (PARTITION BY ticker ORDER BY trade_date) AS prev_ma5,
        LAG(ma20) OVER (PARTITION BY ticker ORDER BY trade_date) AS prev_ma20
    FROM ma
)
SELECT ticker, trade_date, close_price, ma5, ma20
FROM with_prev
WHERE prev_ma5 < prev_ma20  -- Previous day: 5-day MA < 20-day MA
  AND ma5 >= ma20;           -- Current day: 5-day MA >= 20-day MA (cross)

-- Q3: Year-to-date deviation from high and low
SELECT
    ticker,
    trade_date,
    close_price,
    MAX(close_price) OVER (
        PARTITION BY ticker, EXTRACT(YEAR FROM trade_date)
        ORDER BY trade_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS ytd_high,
    MIN(close_price) OVER (
        PARTITION BY ticker, EXTRACT(YEAR FROM trade_date)
        ORDER BY trade_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS ytd_low,
    ROUND(
        (close_price - MAX(close_price) OVER (
            PARTITION BY ticker, EXTRACT(YEAR FROM trade_date)
            ORDER BY trade_date
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        )) / MAX(close_price) OVER (
            PARTITION BY ticker, EXTRACT(YEAR FROM trade_date)
            ORDER BY trade_date
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) * 100, 2
    ) AS pct_from_ytd_high
FROM stock_prices;
```

### Exercise 3: Advanced — Sessionization and Gap Detection

```sql
-- Problem: Analyze user behavior from an e-commerce event log.
CREATE TABLE event_log (
    event_id    BIGSERIAL PRIMARY KEY,
    user_id     INTEGER,
    event_type  VARCHAR(20),  -- 'page_view', 'add_to_cart', 'purchase'
    event_time  TIMESTAMP,
    page_url    VARCHAR(500),
    amount      DECIMAL(10, 2)
);

-- Q1: Assign a session ID using gaps of 30 minutes or more as session boundaries
-- Q2: Calculate the funnel conversion rate for
--     "page_view → add_to_cart → purchase" within each session
-- Q3: Calculate the average and maximum purchase interval (in days) per user
```

**Model Answers:**

```sql
-- Q1: Assign session IDs
WITH with_gap AS (
    SELECT
        *,
        CASE
            WHEN event_time - LAG(event_time) OVER (
                PARTITION BY user_id ORDER BY event_time
            ) > INTERVAL '30 minutes'
            OR LAG(event_time) OVER (
                PARTITION BY user_id ORDER BY event_time
            ) IS NULL
            THEN 1
            ELSE 0
        END AS is_new_session
    FROM event_log
)
SELECT
    *,
    SUM(is_new_session) OVER (
        PARTITION BY user_id ORDER BY event_time
    ) AS session_id
FROM with_gap;

-- Q2: Funnel analysis
WITH sessions AS (
    -- Reuse the CTE from Q1 (abbreviated)
    SELECT user_id, session_id, event_type FROM ...
),
funnel AS (
    SELECT
        session_id,
        COUNT(*) FILTER (WHERE event_type = 'page_view') AS views,
        COUNT(*) FILTER (WHERE event_type = 'add_to_cart') AS carts,
        COUNT(*) FILTER (WHERE event_type = 'purchase') AS purchases
    FROM sessions
    GROUP BY session_id
)
SELECT
    COUNT(*) AS total_sessions,
    COUNT(*) FILTER (WHERE views > 0) AS with_views,
    COUNT(*) FILTER (WHERE carts > 0) AS with_cart,
    COUNT(*) FILTER (WHERE purchases > 0) AS with_purchase,
    ROUND(COUNT(*) FILTER (WHERE carts > 0)::NUMERIC
        / NULLIF(COUNT(*) FILTER (WHERE views > 0), 0) * 100, 1) AS view_to_cart_pct,
    ROUND(COUNT(*) FILTER (WHERE purchases > 0)::NUMERIC
        / NULLIF(COUNT(*) FILTER (WHERE carts > 0), 0) * 100, 1) AS cart_to_purchase_pct
FROM funnel;

-- Q3: Purchase interval analysis
WITH purchases AS (
    SELECT
        user_id,
        event_time::DATE AS purchase_date,
        LAG(event_time::DATE) OVER (
            PARTITION BY user_id ORDER BY event_time
        ) AS prev_purchase_date
    FROM event_log
    WHERE event_type = 'purchase'
)
SELECT
    user_id,
    COUNT(*) AS purchase_count,
    ROUND(AVG(purchase_date - prev_purchase_date), 1) AS avg_interval_days,
    MAX(purchase_date - prev_purchase_date) AS max_interval_days,
    MIN(purchase_date - prev_purchase_date) AS min_interval_days
FROM purchases
WHERE prev_purchase_date IS NOT NULL
GROUP BY user_id
ORDER BY avg_interval_days;
```

---

## FAQ

### Q1: Can window functions be used together with GROUP BY?

Yes, but window functions are executed after GROUP BY. This means window functions are applied to the aggregated results produced by GROUP BY — access to rows before GROUP BY is not possible. A common use case is further aggregating GROUP BY results with window functions, such as `SUM(COUNT(*)) OVER ()`.

### Q2: Can window functions be sped up with indexes?

If indexes exist on the PARTITION BY and ORDER BY columns, the sort step may be eliminated. A composite index such as `CREATE INDEX ON table (partition_col, order_col)` is particularly effective. However, if the window function is not the only access path in the query, the optimizer may choose not to use the index. Always verify with EXPLAIN ANALYZE.

### Q3: Is ROW_NUMBER recommended for pagination?

Not recommended for large datasets. ROW_NUMBER requires sorting all rows before assigning numbers, so performance degrades for deep pages (large OFFSET). Keyset pagination (`WHERE id > last_seen_id ORDER BY id LIMIT 20`) is more efficient. That said, ROW_NUMBER is practical for small to medium datasets.

### Q4: Can window functions be used in UPDATE queries?

In PostgreSQL, you can use window functions inside a subquery in the FROM clause and use the result in an UPDATE. Direct use in the SET clause is not supported.

```sql
UPDATE employees e
SET rank_in_dept = sub.rn
FROM (
    SELECT id, ROW_NUMBER() OVER (
        PARTITION BY department_id ORDER BY salary DESC
    ) AS rn
    FROM employees
) sub
WHERE e.id = sub.id;
```

### Q5: Is performance acceptable when using multiple window functions in the same query?

Functions that share the same window definition (PARTITION BY + ORDER BY) are computed with a single sort pass, which is efficient. Functions with different window definitions require additional sort passes. Use the WINDOW clause to share definitions, and verify the number of sort operations with EXPLAIN.

### Q6: Can the results of window functions be used in ORDER BY?

Yes. The ORDER BY clause is evaluated after SELECT, so window function aliases can be referenced. However, they cannot be used in WHERE/HAVING — wrap the query in a CTE or subquery in that case.

---

## Troubleshooting

### Symptom 1: LAST_VALUE Does Not Return the Same Value for All Rows

**Cause:** The default frame (RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) means the "last value" up to the current row = the current row itself.

**Fix:** Explicitly specify `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`.

### Symptom 2: ROW_NUMBER Results Differ Between Executions

**Cause:** The ORDER BY column has ties and there is no tiebreaker, making the result non-deterministic.

**Fix:** Add a unique column (PK or unique column) to ORDER BY. For example: `ORDER BY salary DESC, id ASC`

### Symptom 3: Queries Containing Window Functions Are Extremely Slow

**Cause:** (1) Window functions without PARTITION BY on a large table, (2) Many different window definitions, (3) Insufficient work_mem causing disk spill.

**Fix:** (1) Pre-filter with WHERE, (2) Consolidate window definitions using WINDOW clause, (3) `SET work_mem = '256MB'`, (4) Add a composite index.

### Symptom 4: COUNT(*) OVER() and COUNT(col) OVER() Return Different Results

**Cause:** COUNT(col) excludes NULLs. This occurs when a column within the partition contains NULL values.

**Fix:** Choose COUNT(*) (includes NULLs) or COUNT(col) (excludes NULLs) based on your intent.

---

## Summary

| Item | Key Points |
|------|------------|
| Window functions | Unlike GROUP BY, rows are not collapsed. Evaluated after SELECT, before ORDER BY |
| ROW_NUMBER | Unique sequence. Used for Top-N, pagination, deduplication. Tiebreaker required |
| RANK/DENSE_RANK | Differ in how ties are handled. DENSE_RANK is common for ranking displays |
| LAG/LEAD | Forward/backward row references. Essential for period-over-period, diffs, gap detection |
| FIRST_VALUE/LAST_VALUE | LAST_VALUE requires explicit frame. NTH_VALUE retrieves the Nth value |
| Frame specification | ROWS BETWEEN controls the aggregation range. Watch out for the default RANGE |
| WINDOW clause | Reuse window definitions. Reduces sort passes for better performance |
| Performance | Composite indexes, work_mem tuning, and pre-filtering with WHERE are key |

---

## Recommended Next Reads

- [01-cte-recursive.md](./01-cte-recursive.md) -- Combining CTEs and window functions
- [04-query-optimization.md](./04-query-optimization.md) -- Execution plans for window functions
- [03-aggregation.md](../00-basics/03-aggregation.md) -- Comparison with aggregate functions

---

## References

1. PostgreSQL Documentation -- "Window Functions" https://www.postgresql.org/docs/current/tutorial-window.html
2. PostgreSQL Documentation -- "Window Function Calls" https://www.postgresql.org/docs/current/sql-expressions.html#SYNTAX-WINDOW-FUNCTIONS
3. Winand, M. -- "Modern SQL: Window Functions" https://modern-sql.com/feature/window-functions
4. Molinaro, A. (2005). *SQL Cookbook*. O'Reilly Media. Chapter 12: Reporting and Warehousing.
5. Kline, K., Kline, D., & Hunt, B. (2008). *SQL in a Nutshell*. O'Reilly Media. Chapter 4: SQL Functions.
6. ISO/IEC 9075-2:2023 -- SQL Part 2: Foundation (Window Function Specification)

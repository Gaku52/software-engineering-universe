# Data Modeling — Star / Snowflake / Dimensional Models

> Data modeling is the practice of translating business requirements into data structures. By choosing between normalized models for OLTP and dimensional models (star/snowflake) for OLAP, you can achieve an optimal design for both transactional processing and analytical workloads.

## Prerequisites

- SQL basics (SELECT, JOIN, GROUP BY, aggregate functions)
- Fundamentals of normalization ([00-normalization.md](./00-normalization.md))
- Schema design basics ([01-schema-design.md](./01-schema-design.md))

## What You Will Learn

1. The essential differences between OLTP and OLAP models and their internal architectures
2. The structure and use cases of star schema and snowflake schema
3. Design patterns for fact tables and dimension tables
4. All SCD (Slowly Changing Dimensions) types and their implementations
5. Kimball vs. Inmon data warehouse design approaches
6. Data Vault 2.0 modeling
7. ETL/ELT pipeline design and implementation
8. Advanced use of materialized views

---

## 1. OLTP vs OLAP — Internal Architecture Differences

### 1.1 Conceptual Differences

```
┌────────────── OLTP vs OLAP ──────────────────┐
│                                               │
│  OLTP (Online Transaction Processing)         │
│  ┌─────────────────────────────────────────┐ │
│  │ Purpose: Business operations (orders,   │ │
│  │          updates, deletes)              │ │
│  │ Traits:  Reads/writes few rows, high    │ │
│  │          frequency                      │ │
│  │ Design:  Normalized (3NF)               │ │
│  │ Example: E-commerce order processing   │ │
│  └─────────────────────────────────────────┘ │
│                     │                         │
│                ETL / ELT                      │
│                     │                         │
│  OLAP (Online Analytical Processing)          │
│  ┌─────────────────────────────────────────┐ │
│  │ Purpose: Analytics & reporting          │ │
│  │ Traits:  Reads large volumes, aggregate │ │
│  │ Design:  Denormalized (star schema)     │ │
│  │ Example: Monthly sales reports,        │ │
│  │          KPI dashboards                │ │
│  └─────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
```

### 1.2 Storage Engine Differences

The performance gap between OLTP and OLAP stems from differences in storage engine architecture.

```
┌───────────────────────────────────────────────────────────────┐
│               Row-Oriented vs Column-Oriented                 │
│                                                               │
│  Row Store (for OLTP: PostgreSQL, MySQL)                      │
│  ┌─────────────────────────────────────────────┐             │
│  │  Row 1: [id=1, name="Tanaka", age=30,        │            │
│  │          city="Tokyo"]                       │            │
│  │  Row 2: [id=2, name="Suzuki", age=25,        │            │
│  │          city="Osaka"]                       │            │
│  │  Row 3: [id=3, name="Sato", age=35,          │            │
│  │          city="Fukuoka"]                     │            │
│  │                                               │           │
│  │  → All columns of one row stored contiguously │           │
│  │  → INSERT/UPDATE/DELETE are fast              │           │
│  │  → SELECT * WHERE id = 1 is fast             │           │
│  └─────────────────────────────────────────────┘             │
│                                                               │
│  Column Store (for OLAP: ClickHouse, Redshift, BigQuery)      │
│  ┌─────────────────────────────────────────────┐             │
│  │  id col:   [1, 2, 3, ...]                    │            │
│  │  name col: ["Tanaka", "Suzuki", "Sato", ...] │            │
│  │  age col:  [30, 25, 35, ...]                 │            │
│  │  city col: ["Tokyo", "Osaka", "Fukuoka", ...] │           │
│  │                                               │           │
│  │  → Values of the same column stored           │           │
│  │    contiguously                               │           │
│  │  → SUM(age), AVG(age) and other aggregates   │           │
│  │    are fast                                   │           │
│  │  → High compression efficiency (same-type    │           │
│  │    data stored consecutively)                │           │
│  └─────────────────────────────────────────────┘             │
└───────────────────────────────────────────────────────────────┘
```

### 1.3 Detailed Comparison Table

| Characteristic | OLTP | OLAP |
|----------------|------|------|
| **Primary operations** | INSERT/UPDATE/DELETE | SELECT (aggregation) |
| **Rows accessed** | A few to tens of rows | Tens of thousands to billions |
| **Concurrent users** | Thousands to tens of thousands | A few to tens |
| **Response requirements** | Milliseconds | Seconds to minutes |
| **Normalization level** | 3NF/BCNF | Denormalized (star) |
| **Indexes** | B-Tree (point queries) | Bitmap, Zone Map |
| **Storage** | Row Store | Column Store |
| **Compression** | Low (row-level is inefficient) | High (same-type data consecutive) |
| **Join patterns** | Multi-table JOINs | Star-type JOINs |
| **Transactions** | ACID required | Eventual consistency sufficient |
| **Representative products** | PostgreSQL, MySQL | BigQuery, Redshift, Snowflake |

---

## 2. Star Schema

### 2.1 Design Principles — Kimball Approach

Dimensional modeling as advocated by Ralph Kimball follows a 4-step design process.

```
┌───────── Kimball Dimensional Modeling 4 Steps ──────────┐
│                                                          │
│  Step 1: Select the Business Process                     │
│  │  "What do we want to analyze?"                       │
│  │  Examples: Sales, inventory, customer behavior       │
│  ▼                                                       │
│  Step 2: Declare the Grain                               │
│  │  "What does one row of the fact table represent?"    │
│  │  Examples: 1 product / 1 transaction / 1 day        │
│  ▼                                                       │
│  Step 3: Identify the Dimensions                         │
│  │  "By which dimensions will we slice the data?"       │
│  │  Examples: Date, product, customer, store            │
│  ▼                                                       │
│  Step 4: Identify the Facts (Measures)                   │
│     "What will we measure?"                             │
│     Examples: Quantity, amount, profit                  │
└──────────────────────────────────────────────────────────┘
```

### 2.2 Three Types of Fact Tables

Fact tables are classified into three types based on what they record.

```
┌──────────────────────────────────────────────────────────┐
│               Three Types of Fact Tables                 │
│                                                          │
│  1. Transaction Fact                                     │
│     ┌────────────────────────────────────────┐          │
│     │ 1 row = 1 event (purchase, click, etc.)│          │
│     │ Grain: Finest level                    │          │
│     │ Example: fact_sales (1 purchase = 1 row)│         │
│     │ Traits: Highest row count, append-only │          │
│     └────────────────────────────────────────┘          │
│                                                          │
│  2. Periodic Snapshot Fact                               │
│     ┌────────────────────────────────────────┐          │
│     │ 1 row = state over a fixed period       │          │
│     │ Grain: Daily/weekly/monthly             │          │
│     │ Example: fact_daily_balance             │          │
│     │ Traits: Fixed row count per period      │          │
│     └────────────────────────────────────────┘          │
│                                                          │
│  3. Accumulating Snapshot Fact                           │
│     ┌────────────────────────────────────────┐          │
│     │ 1 row = entire lifecycle                │          │
│     │ Grain: Per process                      │          │
│     │ Example: fact_order_lifecycle           │          │
│     │         (order → shipment → delivery)  │          │
│     │ Traits: Rows are updated (milestones    │          │
│     │         added)                          │          │
│     └────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────┘
```

### Code Example 1: Star Schema Implementation (All Three Types)

```sql
-- ==============================================
-- Transaction Fact
-- ==============================================
CREATE TABLE fact_sales (
    sale_id         BIGSERIAL PRIMARY KEY,
    -- Dimension keys (foreign keys)
    date_key        INTEGER NOT NULL REFERENCES dim_date(date_key),
    product_key     INTEGER NOT NULL REFERENCES dim_product(product_key),
    customer_key    INTEGER NOT NULL REFERENCES dim_customer(customer_key),
    store_key       INTEGER NOT NULL REFERENCES dim_store(store_key),
    -- Measures
    quantity        INTEGER NOT NULL,
    unit_price      DECIMAL(10, 2) NOT NULL,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount    DECIMAL(12, 2) NOT NULL,
    cost_amount     DECIMAL(10, 2) NOT NULL,
    profit_amount   DECIMAL(10, 2) GENERATED ALWAYS AS
                    (total_amount - cost_amount) STORED
);

-- Partitioning (for large data volumes)
CREATE TABLE fact_sales_partitioned (
    sale_id         BIGSERIAL,
    date_key        INTEGER NOT NULL,
    product_key     INTEGER NOT NULL,
    customer_key    INTEGER NOT NULL,
    store_key       INTEGER NOT NULL,
    quantity        INTEGER NOT NULL,
    unit_price      DECIMAL(10, 2) NOT NULL,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount    DECIMAL(12, 2) NOT NULL,
    cost_amount     DECIMAL(10, 2) NOT NULL,
    profit_amount   DECIMAL(10, 2) GENERATED ALWAYS AS
                    (total_amount - cost_amount) STORED,
    PRIMARY KEY (sale_id, date_key)
) PARTITION BY RANGE (date_key);

-- Monthly partitions
CREATE TABLE fact_sales_202401 PARTITION OF fact_sales_partitioned
    FOR VALUES FROM (20240101) TO (20240201);
CREATE TABLE fact_sales_202402 PARTITION OF fact_sales_partitioned
    FOR VALUES FROM (20240201) TO (20240301);

-- ==============================================
-- Periodic Snapshot Fact
-- ==============================================
CREATE TABLE fact_daily_inventory (
    date_key        INTEGER NOT NULL REFERENCES dim_date(date_key),
    product_key     INTEGER NOT NULL REFERENCES dim_product(product_key),
    store_key       INTEGER NOT NULL REFERENCES dim_store(store_key),
    -- Snapshot measures
    quantity_on_hand  INTEGER NOT NULL,
    quantity_on_order INTEGER NOT NULL DEFAULT 0,
    reorder_point     INTEGER,
    days_of_supply    DECIMAL(5, 1),
    PRIMARY KEY (date_key, product_key, store_key)
);

-- ==============================================
-- Accumulating Snapshot Fact
-- ==============================================
CREATE TABLE fact_order_lifecycle (
    order_key         BIGSERIAL PRIMARY KEY,
    order_id          VARCHAR(20) NOT NULL UNIQUE,
    customer_key      INTEGER NOT NULL REFERENCES dim_customer(customer_key),
    -- Milestone date keys
    order_date_key    INTEGER REFERENCES dim_date(date_key),
    ship_date_key     INTEGER REFERENCES dim_date(date_key),
    delivery_date_key INTEGER REFERENCES dim_date(date_key),
    return_date_key   INTEGER REFERENCES dim_date(date_key),
    -- Duration measures
    days_to_ship      INTEGER,
    days_to_deliver   INTEGER,
    -- Amount measures
    order_amount      DECIMAL(12, 2) NOT NULL,
    shipping_cost     DECIMAL(10, 2),
    -- Status
    current_status    VARCHAR(20) NOT NULL DEFAULT 'ordered'
);

-- Dimension tables (surrounding): analytical perspectives
CREATE TABLE dim_date (
    date_key      INTEGER PRIMARY KEY,  -- YYYYMMDD format
    full_date     DATE NOT NULL,
    year          SMALLINT NOT NULL,
    quarter       SMALLINT NOT NULL,
    month         SMALLINT NOT NULL,
    month_name    VARCHAR(10) NOT NULL,
    week          SMALLINT NOT NULL,
    day_of_week   SMALLINT NOT NULL,
    day_name      VARCHAR(10) NOT NULL,
    is_weekend    BOOLEAN NOT NULL,
    is_holiday    BOOLEAN DEFAULT FALSE,
    fiscal_year   SMALLINT,
    fiscal_quarter SMALLINT,
    -- Additional attributes for analysis
    year_month    VARCHAR(7) NOT NULL,    -- '2024-01'
    year_quarter  VARCHAR(7) NOT NULL,    -- '2024-Q1'
    day_of_year   SMALLINT NOT NULL,
    week_of_year  SMALLINT NOT NULL,
    is_month_end  BOOLEAN NOT NULL,
    is_quarter_end BOOLEAN NOT NULL
);

CREATE TABLE dim_product (
    product_key     SERIAL PRIMARY KEY,
    product_id      VARCHAR(20) NOT NULL,  -- Business key
    product_name    VARCHAR(200) NOT NULL,
    category        VARCHAR(100),
    subcategory     VARCHAR(100),
    brand           VARCHAR(100),
    supplier        VARCHAR(200),
    unit_cost       DECIMAL(10, 2),
    -- For SCD Type 2
    effective_from  DATE NOT NULL,
    effective_to    DATE DEFAULT '9999-12-31',
    is_current      BOOLEAN DEFAULT TRUE
);

CREATE TABLE dim_customer (
    customer_key    SERIAL PRIMARY KEY,
    customer_id     VARCHAR(20) NOT NULL,
    customer_name   VARCHAR(200) NOT NULL,
    segment         VARCHAR(50),
    city            VARCHAR(100),
    region          VARCHAR(50),
    country         VARCHAR(100),
    effective_from  DATE NOT NULL,
    effective_to    DATE DEFAULT '9999-12-31',
    is_current      BOOLEAN DEFAULT TRUE
);

CREATE TABLE dim_store (
    store_key   SERIAL PRIMARY KEY,
    store_id    VARCHAR(20) NOT NULL,
    store_name  VARCHAR(200) NOT NULL,
    store_type  VARCHAR(50),
    city        VARCHAR(100),
    region      VARCHAR(50),
    manager     VARCHAR(200)
);
```

### 2.3 Star Schema Structure

```
┌──────────────── Star Schema ─────────────────┐
│                                               │
│          dim_date                             │
│         ┌───────┐                             │
│         │ Date  │                             │
│         │ Year/ │                             │
│         │ Month │                             │
│         │ Weekday│                            │
│         └───┬───┘                             │
│             │                                 │
│  dim_product│        dim_customer             │
│  ┌───────┐  │  ┌────────────┐  ┌───────┐     │
│  │Product│──┼──│ fact_sales │──│Customer│    │
│  │Category│  │  │  (fact)    │  │ Region │    │
│  │Brand  │  │  │  Quantity  │  │ Segment│    │
│  └───────┘  │  │  Amount    │  └───────┘     │
│             │  │  Profit    │                 │
│         ┌───┴──│            │                 │
│         │      └────────────┘                 │
│  dim_store                                    │
│  ┌───────┐                                    │
│  │ Store │  ★ Fact in center, dimensions      │
│  │ Region│    surrounding it                  │
│  └───────┘  → Resembles a star shape          │
└───────────────────────────────────────────────┘
```

### 2.4 Auto-generating the Date Dimension

```sql
-- Auto-generate 20 years of date dimension data
INSERT INTO dim_date
SELECT
    TO_CHAR(d, 'YYYYMMDD')::INTEGER AS date_key,
    d AS full_date,
    EXTRACT(YEAR FROM d)::SMALLINT AS year,
    EXTRACT(QUARTER FROM d)::SMALLINT AS quarter,
    EXTRACT(MONTH FROM d)::SMALLINT AS month,
    TO_CHAR(d, 'Month') AS month_name,
    EXTRACT(WEEK FROM d)::SMALLINT AS week,
    EXTRACT(DOW FROM d)::SMALLINT AS day_of_week,
    TO_CHAR(d, 'Day') AS day_name,
    EXTRACT(DOW FROM d) IN (0, 6) AS is_weekend,
    FALSE AS is_holiday,  -- Update later from holiday master
    -- Fiscal year (starting in April)
    CASE WHEN EXTRACT(MONTH FROM d) >= 4
         THEN EXTRACT(YEAR FROM d)::SMALLINT
         ELSE (EXTRACT(YEAR FROM d) - 1)::SMALLINT
    END AS fiscal_year,
    CASE WHEN EXTRACT(MONTH FROM d) >= 4
         THEN ((EXTRACT(MONTH FROM d) - 4) / 3 + 1)::SMALLINT
         ELSE ((EXTRACT(MONTH FROM d) + 8) / 3 + 1)::SMALLINT
    END AS fiscal_quarter,
    TO_CHAR(d, 'YYYY-MM') AS year_month,
    TO_CHAR(d, 'YYYY') || '-Q' || EXTRACT(QUARTER FROM d) AS year_quarter,
    EXTRACT(DOY FROM d)::SMALLINT AS day_of_year,
    EXTRACT(WEEK FROM d)::SMALLINT AS week_of_year,
    d = (DATE_TRUNC('month', d) + INTERVAL '1 month - 1 day')::DATE AS is_month_end,
    d = (DATE_TRUNC('quarter', d) + INTERVAL '3 months - 1 day')::DATE AS is_quarter_end
FROM generate_series('2015-01-01'::DATE, '2034-12-31'::DATE, '1 day') AS d;

-- Apply public holidays (example)
UPDATE dim_date SET is_holiday = TRUE
WHERE full_date IN ('2024-01-01', '2024-01-08', '2024-02-11', '2024-02-12',
                    '2024-02-23', '2024-03-20', '2024-04-29', '2024-05-03',
                    '2024-05-04', '2024-05-05', '2024-05-06', '2024-07-15',
                    '2024-08-11', '2024-08-12', '2024-09-16', '2024-09-22',
                    '2024-09-23', '2024-10-14', '2024-11-03', '2024-11-04',
                    '2024-11-23');
```

---

## 3. Snowflake Schema

### 3.1 Structure and Design Principles

The snowflake schema is a form where dimension tables are further normalized.

```
┌──────── Snowflake Schema ────────┐
│                                  │
│  dim_category                    │
│  ┌──────────┐                    │
│  │ Category │                    │
│  └────┬─────┘                    │
│       │                          │
│  dim_subcategory                 │
│  ┌──────────┐    dim_date        │
│  │Subcategory│  ┌──────┐         │
│  └────┬─────┘  │ Date │         │
│       │        └──┬───┘         │
│  dim_product      │              │
│  ┌──────────┐     │  dim_customer│
│  │ Product  │─────┼──│ Customer ││
│  └──────────┘     │  └────┬─────┘│
│              fact_sales   │      │
│              ┌────────┐  dim_region│
│              │  Fact  │  ┌──────┐ │
│              └────────┘  │Region│ │
│                           └──────┘ │
│                                  │
│  ★ Dimensions are normalized     │
│    in multiple levels            │
│  → Resembles a snowflake shape   │
└──────────────────────────────────┘
```

### Code Example 2: Snowflake Schema

```sql
-- Snowflake: further normalize dimension tables
CREATE TABLE dim_category (
    category_key  SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL,
    department    VARCHAR(100)
);

CREATE TABLE dim_subcategory (
    subcategory_key  SERIAL PRIMARY KEY,
    subcategory_name VARCHAR(100) NOT NULL,
    category_key     INTEGER REFERENCES dim_category(category_key)
);

CREATE TABLE dim_brand (
    brand_key  SERIAL PRIMARY KEY,
    brand_name VARCHAR(100) NOT NULL,
    origin_country VARCHAR(100)
);

CREATE TABLE dim_product_snowflake (
    product_key     SERIAL PRIMARY KEY,
    product_name    VARCHAR(200) NOT NULL,
    subcategory_key INTEGER REFERENCES dim_subcategory(subcategory_key),
    brand_key       INTEGER REFERENCES dim_brand(brand_key),
    unit_cost       DECIMAL(10, 2)
);

-- Normalize geography
CREATE TABLE dim_country (
    country_key  SERIAL PRIMARY KEY,
    country_name VARCHAR(100) NOT NULL,
    continent    VARCHAR(50)
);

CREATE TABLE dim_region (
    region_key   SERIAL PRIMARY KEY,
    region_name  VARCHAR(50) NOT NULL,
    country_key  INTEGER REFERENCES dim_country(country_key)
);

CREATE TABLE dim_city (
    city_key    SERIAL PRIMARY KEY,
    city_name   VARCHAR(100) NOT NULL,
    region_key  INTEGER REFERENCES dim_region(region_key),
    population  INTEGER
);

-- Analysis query with snowflake schema (more JOINs required)
SELECT
    c.category_name,
    sc.subcategory_name,
    b.brand_name,
    SUM(f.total_amount) AS revenue,
    SUM(f.quantity)     AS total_quantity
FROM fact_sales f
    JOIN dim_product_snowflake p ON f.product_key = p.product_key
    JOIN dim_subcategory sc ON p.subcategory_key = sc.subcategory_key
    JOIN dim_category c ON sc.category_key = c.category_key
    JOIN dim_brand b ON p.brand_key = b.brand_key
GROUP BY c.category_name, sc.subcategory_name, b.brand_name
ORDER BY revenue DESC;
```

### 3.2 Schema Selection Decision Flow

```
┌───────── Schema Selection Flow ─────────┐
│                                         │
│  Q: How often are dimensions updated?   │
│  │                                      │
│  ├─ Frequently (daily or more)          │
│  │  → Snowflake candidate               │
│  │  (normalization localizes updates)   │
│  │                                      │
│  └─ Infrequently (monthly or less)      │
│     │                                   │
│     Q: Who are the BI tool users?       │
│     │                                   │
│     ├─ Mostly non-technical users       │
│     │  → Star recommended               │
│     │  (fewer JOINs, simpler)           │
│     │                                   │
│     └─ Mostly engineers                 │
│        │                                │
│        Q: Storage constraints?          │
│        │                                │
│        ├─ Tight → Snowflake             │
│        └─ Sufficient → Star             │
└─────────────────────────────────────────┘
```

---

## 4. SCD (Slowly Changing Dimensions) — All Types Explained

### 4.1 Overview of All SCD Types

```
┌─────────────── SCD Types Overview ────────────────┐
│                                                    │
│  Type 0: Fixed (no changes)                        │
│  Type 1: Overwrite (no history)                    │
│  Type 2: Add new row (full history)                │
│  Type 3: Previous value column (last 1 change)     │
│  Type 4: Separate history table                    │
│  Type 6: Hybrid (combination of 1+2+3)             │
│                                                    │
│  * Types 5 and 7 exist but are rare in practice    │
└────────────────────────────────────────────────────┘
```

### Code Example 3: SCD Type 1 / 2 / 3

```sql
-- ==============================================
-- SCD Type 0: Fixed — no changes after initial load
-- ==============================================
-- Used for immutable attributes such as date of birth, registration date
-- No special processing required — simply never UPDATE.

-- ==============================================
-- SCD Type 1: Overwrite (no history)
-- ==============================================
UPDATE dim_customer
SET city = 'Osaka', region = 'Kansai'
WHERE customer_id = 'C001' AND is_current = TRUE;

-- Advantage: Simple, storage-efficient
-- Disadvantage: Previous state is completely untracked

-- ==============================================
-- SCD Type 2: Add new row (full history)
-- ==============================================
-- Step 1: Expire the old row
UPDATE dim_customer
SET effective_to = CURRENT_DATE - 1, is_current = FALSE
WHERE customer_id = 'C001' AND is_current = TRUE;

-- Step 2: Insert the new row
INSERT INTO dim_customer (customer_id, customer_name, segment, city, region,
                          country, effective_from, effective_to, is_current)
VALUES ('C001', 'Taro Tanaka', 'Premium', 'Osaka', 'Kansai',
        'Japan', CURRENT_DATE, '9999-12-31', TRUE);

-- SCD Type 2 query: look up state at a specific point in time
SELECT * FROM dim_customer
WHERE customer_id = 'C001'
  AND '2024-06-15' BETWEEN effective_from AND effective_to;

-- Automate SCD Type 2 (trigger/procedure)
CREATE OR REPLACE FUNCTION scd2_update_customer()
RETURNS TRIGGER AS $$
BEGIN
    -- Expire the old row
    UPDATE dim_customer
    SET effective_to = CURRENT_DATE - 1, is_current = FALSE
    WHERE customer_id = NEW.customer_id AND is_current = TRUE;

    -- Set metadata for the new row
    NEW.effective_from := CURRENT_DATE;
    NEW.effective_to := '9999-12-31';
    NEW.is_current := TRUE;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- SCD Type 3: Keep current and previous values as columns
-- ==============================================
ALTER TABLE dim_customer ADD COLUMN previous_city VARCHAR(100);
ALTER TABLE dim_customer ADD COLUMN city_changed_at DATE;

UPDATE dim_customer
SET previous_city = city,
    city = 'Osaka',
    city_changed_at = CURRENT_DATE
WHERE customer_id = 'C001';

-- Query to compare before and after change
SELECT customer_id, customer_name,
       previous_city AS "Previous City",
       city AS "New City",
       city_changed_at AS "Change Date"
FROM dim_customer
WHERE previous_city IS NOT NULL;

-- ==============================================
-- SCD Type 4: Separate history table
-- ==============================================
-- Current table (always holds the latest state)
CREATE TABLE dim_customer_current (
    customer_key    SERIAL PRIMARY KEY,
    customer_id     VARCHAR(20) NOT NULL UNIQUE,
    customer_name   VARCHAR(200) NOT NULL,
    segment         VARCHAR(50),
    city            VARCHAR(100),
    region          VARCHAR(50)
);

-- History table (change log)
CREATE TABLE dim_customer_history (
    history_id      BIGSERIAL PRIMARY KEY,
    customer_id     VARCHAR(20) NOT NULL,
    customer_name   VARCHAR(200),
    segment         VARCHAR(50),
    city            VARCHAR(100),
    region          VARCHAR(50),
    effective_from  TIMESTAMPTZ NOT NULL,
    effective_to    TIMESTAMPTZ,
    change_type     VARCHAR(10) NOT NULL  -- INSERT/UPDATE/DELETE
);

-- Trigger to track changes
CREATE OR REPLACE FUNCTION scd4_track_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Set end time for the old row
    UPDATE dim_customer_history
    SET effective_to = NOW()
    WHERE customer_id = OLD.customer_id AND effective_to IS NULL;

    -- Add the new row to history
    INSERT INTO dim_customer_history
        (customer_id, customer_name, segment, city, region,
         effective_from, change_type)
    VALUES
        (NEW.customer_id, NEW.customer_name, NEW.segment, NEW.city, NEW.region,
         NOW(), TG_OP);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customer_scd4
    AFTER INSERT OR UPDATE ON dim_customer_current
    FOR EACH ROW EXECUTE FUNCTION scd4_track_changes();

-- ==============================================
-- SCD Type 6: Hybrid (1+2+3)
-- ==============================================
CREATE TABLE dim_customer_type6 (
    customer_key    SERIAL PRIMARY KEY,
    customer_id     VARCHAR(20) NOT NULL,
    customer_name   VARCHAR(200) NOT NULL,
    -- Type 2 attributes
    historical_city VARCHAR(100) NOT NULL,  -- Value at row creation time
    effective_from  DATE NOT NULL,
    effective_to    DATE DEFAULT '9999-12-31',
    is_current      BOOLEAN DEFAULT TRUE,
    -- Type 1 attribute (backfilled with latest value across all rows)
    current_city    VARCHAR(100) NOT NULL,   -- Always the latest value
    -- Type 3 attribute
    previous_city   VARCHAR(100)
);

-- Type 6 update procedure
-- 1. Expire the old row
UPDATE dim_customer_type6
SET effective_to = CURRENT_DATE - 1, is_current = FALSE,
    current_city = 'Osaka',  -- Type 1: update current across all rows
    previous_city = historical_city  -- Type 3: retain previous value
WHERE customer_id = 'C001' AND is_current = TRUE;

-- 2. Insert new row (Type 2)
INSERT INTO dim_customer_type6
    (customer_id, customer_name, historical_city, current_city,
     previous_city, effective_from)
VALUES ('C001', 'Taro Tanaka', 'Osaka', 'Osaka', 'Tokyo', CURRENT_DATE);

-- 3. Update current_city on all historical rows too (Type 1)
UPDATE dim_customer_type6
SET current_city = 'Osaka'
WHERE customer_id = 'C001';
```

### SCD (Slowly Changing Dimension) Comparison Table

| Type | Approach | History | Implementation Complexity | Storage | Use Case |
|------|----------|---------|--------------------------|---------|----------|
| Type 0 | No changes | None | Simplest | Minimal | Immutable master data (date of birth, etc.) |
| Type 1 | Overwrite | None | Simple | Minimal | Current value only needed (typo correction, etc.) |
| Type 2 | Add new row | Full | Complex | Large | Time-series analysis |
| Type 3 | Previous value column | Last 1 change | Moderate | Small | Before/after comparison |
| Type 4 | Separate history table | Full | Somewhat complex | Medium | Large volume history, audit requirements |
| Type 6 | Combination of 1+2+3 | Full + current value | Most complex | Largest | Advanced analytics |

---

## 5. Kimball vs. Inmon Approach

### 5.1 Architecture Comparison

```
┌──────────────── Kimball Approach ─────────────────┐
│                                                    │
│  OLTP ──┐                                          │
│  OLTP ──┼─ ETL → ┌──────────────────────┐         │
│  OLTP ──┘        │  Data Warehouse      │         │
│                   │  (Dimensional Model) │         │
│                   │  ┌─────────────────┐ │         │
│                   │  │  Star Schema    │ │         │
│                   │  │ Fact+Dimensions │ │         │
│                   │  └─────────────────┘ │         │
│                   └──────────┬───────────┘         │
│                              │                     │
│                          BI Tools                  │
│  ★ Bottom-up: Built from business unit needs       │
│  ★ Quick results: One data mart in a few months    │
│  ★ Understandable by non-technical users           │
└────────────────────────────────────────────────────┘

┌──────────────── Inmon Approach ────────────────────┐
│                                                    │
│  OLTP ──┐                                          │
│  OLTP ──┼─ ETL → ┌──────────────────────┐         │
│  OLTP ──┘        │  EDW (Enterprise DW) │         │
│                   │  (3NF Normalized)    │         │
│                   └──────────┬───────────┘         │
│                              │                     │
│              ┌───────────────┼───────────────┐     │
│              ▼               ▼               ▼     │
│        ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│        │Data Mart │  │Data Mart │  │Data Mart │   │
│        │ (Sales)  │  │(Inventory│  │(Customer)│   │
│        │Star Schema│  │Star Schema│  │Star Schema│  │
│        └──────────┘  └──────────┘  └──────────┘   │
│                                                    │
│  ★ Top-down: Enterprise-wide integrated model      │
│    designed first                                  │
│  ★ Long-term investment: Takes time to build,      │
│    but high consistency                            │
│  ★ EDW is the "single source of truth"             │
└────────────────────────────────────────────────────┘
```

### 5.2 Comparison Table

| Characteristic | Kimball Approach | Inmon Approach |
|----------------|-----------------|----------------|
| **Approach** | Bottom-up | Top-down |
| **Core structure** | Dimensional model (star) | 3NF normalized EDW |
| **Build time** | Short (months per mart) | Long (years) |
| **Initial cost** | Low | High |
| **Scalability** | Expand by adding data marts | Expand the EDW |
| **Data integration** | Unified via Conformed Dimensions | Centrally managed in EDW |
| **Redundancy** | High (denormalized) | Low (normalized) |
| **Primary users** | Business units | IT departments |
| **Scale** | Small to medium enterprises | Large enterprises |
| **Industry standard** | Currently dominant | Large enterprises in finance/telecoms |

---

## 6. Data Vault 2.0

### 6.1 Overview

Data Vault consists of three elements: Hub (business keys), Link (relationships), and Satellite (attributes and history).

```
┌──────────── Data Vault 2.0 Structure ──────────────┐
│                                                     │
│  Hub (Business Keys)                                │
│  ┌────────────────────────┐                         │
│  │ hub_customer           │                         │
│  │ - hub_customer_hk (PK) │ ← Hash key             │
│  │ - customer_id (BK)     │ ← Business key         │
│  │ - load_date            │                         │
│  │ - record_source        │                         │
│  └───────────┬────────────┘                         │
│              │                                      │
│  Satellite (Attributes & History)                   │
│  ┌────────────────────────┐                         │
│  │ sat_customer           │                         │
│  │ - hub_customer_hk (FK) │                         │
│  │ - load_date (PK)       │                         │
│  │ - name, city, region   │ ← Attribute group       │
│  │ - hash_diff            │ ← For change detection  │
│  │ - record_source        │                         │
│  └────────────────────────┘                         │
│                                                     │
│  Link (Relationships)                               │
│  ┌────────────────────────┐                         │
│  │ lnk_customer_order     │                         │
│  │ - link_hk (PK)         │                         │
│  │ - hub_customer_hk (FK) │                         │
│  │ - hub_order_hk (FK)    │                         │
│  │ - load_date            │                         │
│  │ - record_source        │                         │
│  └────────────────────────┘                         │
└─────────────────────────────────────────────────────┘
```

### Code Example 4: Data Vault 2.0 Implementation

```sql
-- Hub: Unique management of business keys
CREATE TABLE hub_customer (
    hub_customer_hk  CHAR(32) PRIMARY KEY,  -- MD5 hash
    customer_id      VARCHAR(20) NOT NULL UNIQUE,
    load_date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    record_source    VARCHAR(100) NOT NULL
);

CREATE TABLE hub_product (
    hub_product_hk   CHAR(32) PRIMARY KEY,
    product_id       VARCHAR(20) NOT NULL UNIQUE,
    load_date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    record_source    VARCHAR(100) NOT NULL
);

-- Satellite: Attributes and history
CREATE TABLE sat_customer (
    hub_customer_hk  CHAR(32) NOT NULL REFERENCES hub_customer(hub_customer_hk),
    load_date        TIMESTAMPTZ NOT NULL,
    load_end_date    TIMESTAMPTZ DEFAULT '9999-12-31',
    customer_name    VARCHAR(200),
    segment          VARCHAR(50),
    city             VARCHAR(100),
    region           VARCHAR(50),
    hash_diff        CHAR(32) NOT NULL,  -- Hash of attributes (for change detection)
    record_source    VARCHAR(100) NOT NULL,
    PRIMARY KEY (hub_customer_hk, load_date)
);

-- Link: Relationship between entities
CREATE TABLE lnk_sale (
    lnk_sale_hk      CHAR(32) PRIMARY KEY,
    hub_customer_hk   CHAR(32) REFERENCES hub_customer(hub_customer_hk),
    hub_product_hk    CHAR(32) REFERENCES hub_product(hub_product_hk),
    load_date         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    record_source     VARCHAR(100) NOT NULL
);

-- Link Satellite: Attributes of the link
CREATE TABLE sat_sale (
    lnk_sale_hk   CHAR(32) NOT NULL REFERENCES lnk_sale(lnk_sale_hk),
    load_date      TIMESTAMPTZ NOT NULL,
    quantity       INTEGER,
    unit_price     DECIMAL(10, 2),
    total_amount   DECIMAL(12, 2),
    hash_diff      CHAR(32) NOT NULL,
    record_source  VARCHAR(100) NOT NULL,
    PRIMARY KEY (lnk_sale_hk, load_date)
);

-- Example of hash key generation
INSERT INTO hub_customer (hub_customer_hk, customer_id, record_source)
VALUES (
    MD5('C001'),  -- Hash of the business key
    'C001',
    'erp_system'
)
ON CONFLICT (hub_customer_hk) DO NOTHING;  -- Idempotency
```

### 6.2 Modeling Approach Comparison

| Characteristic | Star Schema | Data Vault 2.0 | 3NF (Inmon EDW) |
|----------------|------------|-----------------|-----------------|
| **Purpose** | Analytics & reporting | Integration, audit & history | Integrated data management |
| **Flexibility** | Low (schema changes are large) | High (extend by adding Hub/Sat) | Medium |
| **History management** | SCD (requires design) | Automatic (Satellite) | Requires design |
| **Load speed** | Medium (transformation required) | Fast (parallel loading) | Medium |
| **Query performance** | Best (denormalized) | Low (many JOINs) | Medium |
| **Audit trail** | Limited | Complete (record_source) | Limited |
| **Idempotency** | Requires design | Naturally achieved | Requires design |
| **Learning cost** | Low | High | Medium |
| **Use case** | BI layer | Storage layer | EDW |

---

## 7. Code Example 4: Analytical Queries in Practice

```sql
-- =============================================
-- Monthly and category-level sales analysis
-- =============================================
SELECT
    dd.year,
    dd.month_name,
    dp.category,
    COUNT(*) AS transactions,
    SUM(fs.quantity) AS total_quantity,
    SUM(fs.total_amount) AS revenue,
    SUM(fs.profit_amount) AS profit,
    ROUND(SUM(fs.profit_amount) / NULLIF(SUM(fs.total_amount), 0) * 100, 1)
        AS profit_margin_pct
FROM fact_sales fs
    JOIN dim_date dd ON fs.date_key = dd.date_key
    JOIN dim_product dp ON fs.product_key = dp.product_key
WHERE dd.year = 2024
  AND dp.is_current = TRUE
GROUP BY dd.year, dd.month, dd.month_name, dp.category
ORDER BY dd.month, revenue DESC;

-- =============================================
-- YoY (Year-over-Year) comparison
-- =============================================
WITH yearly AS (
    SELECT
        dd.year,
        dp.category,
        SUM(fs.total_amount) AS revenue
    FROM fact_sales fs
        JOIN dim_date dd ON fs.date_key = dd.date_key
        JOIN dim_product dp ON fs.product_key = dp.product_key
    WHERE dd.year IN (2023, 2024)
    GROUP BY dd.year, dp.category
)
SELECT
    c.category,
    c.revenue AS current_year,
    p.revenue AS previous_year,
    ROUND((c.revenue - p.revenue) / p.revenue * 100, 1) AS yoy_growth
FROM yearly c
    JOIN yearly p ON c.category = p.category AND c.year = p.year + 1
ORDER BY yoy_growth DESC;

-- =============================================
-- RFM Analysis (Recency, Frequency, Monetary)
-- =============================================
WITH customer_rfm AS (
    SELECT
        dc.customer_id,
        dc.customer_name,
        dc.segment,
        -- Recency: days since last purchase
        CURRENT_DATE - MAX(dd.full_date) AS recency_days,
        -- Frequency: number of purchases
        COUNT(DISTINCT dd.full_date) AS frequency,
        -- Monetary: total purchase amount
        SUM(fs.total_amount) AS monetary
    FROM fact_sales fs
        JOIN dim_customer dc ON fs.customer_key = dc.customer_key
        JOIN dim_date dd ON fs.date_key = dd.date_key
    WHERE dc.is_current = TRUE
    GROUP BY dc.customer_id, dc.customer_name, dc.segment
),
rfm_scored AS (
    SELECT *,
        NTILE(5) OVER (ORDER BY recency_days ASC) AS r_score,   -- Higher = more recent
        NTILE(5) OVER (ORDER BY frequency DESC)    AS f_score,   -- Higher = more frequent
        NTILE(5) OVER (ORDER BY monetary DESC)     AS m_score    -- Higher = more spending
    FROM customer_rfm
)
SELECT
    customer_id,
    customer_name,
    segment,
    recency_days,
    frequency,
    monetary,
    r_score || f_score || m_score AS rfm_segment,
    CASE
        WHEN r_score >= 4 AND f_score >= 4 AND m_score >= 4 THEN 'VIP'
        WHEN r_score >= 4 AND f_score >= 3 THEN 'Loyal'
        WHEN r_score >= 3 AND f_score <= 2 THEN 'Promising New'
        WHEN r_score <= 2 AND f_score >= 3 THEN 'Dormant (Needs Re-activation)'
        WHEN r_score <= 2 AND f_score <= 2 THEN 'At-Risk Churn'
        ELSE 'General'
    END AS customer_type
FROM rfm_scored
ORDER BY monetary DESC;

-- =============================================
-- Cohort Analysis (Monthly Retention Rate)
-- =============================================
WITH first_purchase AS (
    SELECT
        dc.customer_key,
        DATE_TRUNC('month', MIN(dd.full_date)) AS cohort_month
    FROM fact_sales fs
        JOIN dim_customer dc ON fs.customer_key = dc.customer_key
        JOIN dim_date dd ON fs.date_key = dd.date_key
    WHERE dc.is_current = TRUE
    GROUP BY dc.customer_key
),
monthly_activity AS (
    SELECT
        fp.cohort_month,
        DATE_TRUNC('month', dd.full_date) AS activity_month,
        COUNT(DISTINCT dc.customer_key) AS active_customers
    FROM fact_sales fs
        JOIN dim_customer dc ON fs.customer_key = dc.customer_key
        JOIN dim_date dd ON fs.date_key = dd.date_key
        JOIN first_purchase fp ON dc.customer_key = fp.customer_key
    WHERE dc.is_current = TRUE
    GROUP BY fp.cohort_month, DATE_TRUNC('month', dd.full_date)
),
cohort_sizes AS (
    SELECT cohort_month, COUNT(*) AS cohort_size
    FROM first_purchase
    GROUP BY cohort_month
)
SELECT
    TO_CHAR(ma.cohort_month, 'YYYY-MM') AS cohort,
    cs.cohort_size,
    EXTRACT(MONTH FROM AGE(ma.activity_month, ma.cohort_month))::INT AS month_number,
    ma.active_customers,
    ROUND(100.0 * ma.active_customers / cs.cohort_size, 1) AS retention_pct
FROM monthly_activity ma
    JOIN cohort_sizes cs ON ma.cohort_month = cs.cohort_month
ORDER BY cohort, month_number;
```

---

## 8. Code Example 5: ETL Pipeline

```sql
-- =============================================
-- Load raw data into staging table
-- =============================================
CREATE TABLE stg_sales_raw (
    transaction_id  VARCHAR(50),
    sale_date       DATE,
    product_code    VARCHAR(20),
    customer_code   VARCHAR(20),
    store_code      VARCHAR(20),
    quantity        INTEGER,
    unit_price      DECIMAL(10,2),
    discount_pct    DECIMAL(5,2),
    loaded_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Table for data quality check logs
CREATE TABLE etl_quality_log (
    log_id          BIGSERIAL PRIMARY KEY,
    batch_id        VARCHAR(50) NOT NULL,
    check_name      VARCHAR(100) NOT NULL,
    check_result    VARCHAR(10) NOT NULL,  -- PASS / FAIL / WARN
    affected_rows   INTEGER,
    details         TEXT,
    checked_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Data quality checks
-- =============================================
CREATE OR REPLACE FUNCTION etl_data_quality_check(p_batch_id VARCHAR)
RETURNS TABLE(check_name VARCHAR, result VARCHAR, affected INT) AS $$
BEGIN
    -- Check 1: NULL check
    INSERT INTO etl_quality_log (batch_id, check_name, check_result, affected_rows, details)
    SELECT p_batch_id, 'null_check',
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
           COUNT(*),
           'NULLs found in transaction_id, sale_date, or product_code'
    FROM stg_sales_raw
    WHERE loaded_at > (SELECT COALESCE(MAX(checked_at), '1970-01-01') FROM etl_quality_log)
      AND (transaction_id IS NULL OR sale_date IS NULL OR product_code IS NULL);

    -- Check 2: Numeric range check
    INSERT INTO etl_quality_log (batch_id, check_name, check_result, affected_rows, details)
    SELECT p_batch_id, 'range_check',
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END,
           COUNT(*),
           'Rows found where quantity <= 0 or unit_price <= 0'
    FROM stg_sales_raw
    WHERE quantity <= 0 OR unit_price <= 0;

    -- Check 3: Referential integrity check
    INSERT INTO etl_quality_log (batch_id, check_name, check_result, affected_rows, details)
    SELECT p_batch_id, 'referential_check',
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
           COUNT(*),
           'Records with no matching dimension found'
    FROM stg_sales_raw s
    WHERE NOT EXISTS (
        SELECT 1 FROM dim_product dp
        WHERE dp.product_id = s.product_code AND dp.is_current
    );

    -- Check 4: Duplicate check
    INSERT INTO etl_quality_log (batch_id, check_name, check_result, affected_rows, details)
    SELECT p_batch_id, 'duplicate_check',
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END,
           COUNT(*),
           'Duplicate transaction_id found'
    FROM (
        SELECT transaction_id, COUNT(*) AS cnt
        FROM stg_sales_raw
        GROUP BY transaction_id
        HAVING COUNT(*) > 1
    ) dup;

    RETURN QUERY
    SELECT eql.check_name::VARCHAR, eql.check_result::VARCHAR, eql.affected_rows
    FROM etl_quality_log eql
    WHERE eql.batch_id = p_batch_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Transform and load from staging to fact table
-- =============================================
CREATE OR REPLACE FUNCTION etl_load_fact_sales(p_batch_id VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    v_rows_loaded INTEGER;
BEGIN
    -- Run quality checks
    PERFORM etl_data_quality_check(p_batch_id);

    -- Abort if any FAIL results exist
    IF EXISTS (
        SELECT 1 FROM etl_quality_log
        WHERE batch_id = p_batch_id AND check_result = 'FAIL'
    ) THEN
        RAISE EXCEPTION 'Data quality check failed: batch_id=%', p_batch_id;
    END IF;

    -- Load into the fact table
    INSERT INTO fact_sales (
        date_key, product_key, customer_key, store_key,
        quantity, unit_price, discount_amount, total_amount, cost_amount
    )
    SELECT
        TO_CHAR(s.sale_date, 'YYYYMMDD')::INTEGER AS date_key,
        dp.product_key,
        dc.customer_key,
        ds.store_key,
        s.quantity,
        s.unit_price,
        s.unit_price * s.quantity * s.discount_pct / 100 AS discount_amount,
        s.unit_price * s.quantity * (1 - s.discount_pct / 100) AS total_amount,
        dp.unit_cost * s.quantity AS cost_amount
    FROM stg_sales_raw s
        JOIN dim_product dp ON dp.product_id = s.product_code AND dp.is_current
        JOIN dim_customer dc ON dc.customer_id = s.customer_code AND dc.is_current
        JOIN dim_store ds ON ds.store_id = s.store_code
    WHERE s.loaded_at > (SELECT COALESCE(MAX(loaded_at), '1970-01-01')
                         FROM fact_sales_load_log);

    GET DIAGNOSTICS v_rows_loaded = ROW_COUNT;

    -- Log the load
    INSERT INTO fact_sales_load_log (batch_id, rows_loaded, loaded_at)
    VALUES (p_batch_id, v_rows_loaded, NOW());

    RETURN v_rows_loaded;
END;
$$ LANGUAGE plpgsql;
```

### 8.1 ETL vs ELT Comparison

```
┌──────────── ETL vs ELT ──────────────────┐
│                                           │
│  ETL (Extract-Transform-Load)             │
│  ┌────────┐  ┌──────────┐  ┌────────┐   │
│  │Extract │→ │Transform │→ │ Load   │   │
│  └────────┘  └──────────┘  └────────┘   │
│  Transform outside DWH, then load        │
│  Examples: Informatica, Talend, dbt      │
│                                           │
│  ELT (Extract-Load-Transform)             │
│  ┌────────┐  ┌────────┐  ┌──────────┐   │
│  │Extract │→ │ Load   │→ │Transform │   │
│  └────────┘  └────────┘  └──────────┘   │
│  Load raw data into DWH, transform       │
│  inside DWH                              │
│  Examples: BigQuery + dbt,               │
│            Snowflake + dbt               │
│                                           │
│  ELT is now mainstream (DWH processing   │
│  power has improved)                     │
└───────────────────────────────────────────┘
```

| Characteristic | ETL | ELT |
|----------------|-----|-----|
| **Transformation location** | External server | Inside DWH |
| **Scalability** | Depends on transformation server | Leverages DWH scale |
| **Raw data retention** | Usually only transformed data | Raw data can be retained |
| **Flexibility** | Changing transform logic requires reprocessing | SQL transforms — easy to reprocess |
| **Cost** | ETL server costs | DWH compute costs |
| **Representative tools** | Informatica, Talend | dbt, Dataform |
| **Use case** | Legacy environments | Cloud DWH |

---

## 9. Code Example 6: Using Materialized Views

```sql
-- =============================================
-- Materialized view for monthly summary
-- =============================================
CREATE MATERIALIZED VIEW mv_monthly_summary AS
SELECT
    dd.year,
    dd.month,
    dd.year_month,
    dp.category,
    dc.region,
    ds.store_name,
    COUNT(*) AS transaction_count,
    SUM(fs.quantity) AS total_quantity,
    SUM(fs.total_amount) AS revenue,
    SUM(fs.profit_amount) AS profit,
    AVG(fs.total_amount) AS avg_transaction_value,
    COUNT(DISTINCT dc.customer_key) AS unique_customers
FROM fact_sales fs
    JOIN dim_date dd ON fs.date_key = dd.date_key
    JOIN dim_product dp ON fs.product_key = dp.product_key
    JOIN dim_customer dc ON fs.customer_key = dc.customer_key
    JOIN dim_store ds ON fs.store_key = ds.store_key
WHERE dp.is_current AND dc.is_current
GROUP BY dd.year, dd.month, dd.year_month, dp.category, dc.region, ds.store_name
WITH DATA;

CREATE UNIQUE INDEX idx_mv_monthly ON mv_monthly_summary
    (year, month, category, region, store_name);

-- Incremental refresh (CONCURRENTLY = no read blocking)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_summary;

-- =============================================
-- Automatic materialized view refresh (pg_cron)
-- =============================================
-- Scheduled refresh using the pg_cron extension
-- CREATE EXTENSION pg_cron;  -- requires installation
-- SELECT cron.schedule(
--     'refresh_monthly_summary',
--     '0 2 * * *',  -- Run at 2 AM every day
--     'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_summary'
-- );

-- =============================================
-- Hierarchical materialized view strategy
-- =============================================
-- Level 1: Daily summary (finest granularity)
CREATE MATERIALIZED VIEW mv_daily_sales AS
SELECT
    date_key,
    product_key,
    store_key,
    SUM(quantity) AS total_quantity,
    SUM(total_amount) AS revenue,
    SUM(profit_amount) AS profit,
    COUNT(*) AS transactions
FROM fact_sales
GROUP BY date_key, product_key, store_key
WITH DATA;

-- Level 2: Monthly summary (built from daily view — faster to refresh)
CREATE MATERIALIZED VIEW mv_monthly_product AS
SELECT
    dd.year,
    dd.month,
    dp.product_name,
    dp.category,
    SUM(ds.total_quantity) AS total_quantity,
    SUM(ds.revenue) AS revenue,
    SUM(ds.profit) AS profit,
    SUM(ds.transactions) AS transactions
FROM mv_daily_sales ds
    JOIN dim_date dd ON ds.date_key = dd.date_key
    JOIN dim_product dp ON ds.product_key = dp.product_key
WHERE dp.is_current
GROUP BY dd.year, dd.month, dp.product_name, dp.category
WITH DATA;
```

### 9.1 Materialized View Support by RDBMS

| Feature | PostgreSQL | Oracle | SQL Server | MySQL |
|---------|-----------|--------|-----------|-------|
| **Materialized views** | Yes | Yes | Indexed View | No (manual implementation) |
| **CONCURRENTLY refresh** | Yes | Partial (ON COMMIT) | N/A | N/A |
| **Automatic refresh** | Via pg_cron | ON COMMIT / ON DEMAND | N/A | N/A |
| **Incremental refresh** | Requires UNIQUE INDEX | Materialized view log | Automatic | N/A |
| **Query rewrite** | No | Yes (auto-applied) | Yes (auto-applied) | No |

---

## Star Schema vs Snowflake Schema Comparison Table

| Feature | Star Schema | Snowflake Schema |
|---------|-------------|-----------------|
| Dimension structure | Denormalized (1 table) | Normalized (multiple tables) |
| Number of JOINs | Few | Many |
| Query complexity | Simple | Complex |
| Query performance | Fast | Slightly slower |
| Storage | Redundant (larger) | Efficient (smaller) |
| ETL complexity | Simple | Somewhat complex |
| Update consistency | Requires care | Easier |
| BI tool compatibility | High | Moderate |
| Number of dimensions | Fewer needed | More tables required |
| Learning cost | Low | Moderate |

---

## Anti-Patterns

### Anti-Pattern 1: Running Analytical Queries on an OLTP Schema

```sql
-- BAD: Complex analysis on a normalized OLTP schema
SELECT
    EXTRACT(YEAR FROM o.order_date) AS year,
    c.name AS category,
    r.name AS region,
    SUM(oi.quantity * oi.unit_price) AS revenue
FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    JOIN customers cu ON o.customer_id = cu.id
    JOIN addresses a ON cu.address_id = a.id
    JOIN regions r ON a.region_id = r.id
WHERE o.status = 'delivered'
GROUP BY 1, 2, 3;
-- → 6-table JOIN, extremely slow with large data volumes
-- → Lock contention on OLTP tables degrades transactional processing

-- GOOD: Build a separate star schema for analytics
SELECT year, category, region, SUM(revenue)
FROM mv_monthly_summary
GROUP BY year, category, region;
```

### Anti-Pattern 2: Storing Strings Directly in Fact Tables

```sql
-- BAD: Store dimension attributes directly in the fact table
CREATE TABLE fact_sales_bad (
    product_name   VARCHAR(200),  -- ← Dimension attribute in fact table
    category_name  VARCHAR(100),
    customer_name  VARCHAR(200),
    amount         DECIMAL(10,2)
);
-- → Redundant, difficult to update, wastes storage
-- → Requires UPDATE on every row when a product name changes

-- GOOD: Reference dimensions via surrogate keys
CREATE TABLE fact_sales_good (
    product_key   INTEGER REFERENCES dim_product(product_key),
    customer_key  INTEGER REFERENCES dim_customer(customer_key),
    amount        DECIMAL(10,2)
);
-- → INTEGER is 4 bytes, VARCHAR(200) is up to 200 bytes
-- → Difference is over 18 GB with 100 million rows in the fact table
```

### Anti-Pattern 3: Mixing Granularities

```sql
-- BAD: Mixing data at different granularities in one fact table
CREATE TABLE fact_mixed_bad (
    date_key     INTEGER,
    product_key  INTEGER,
    store_key    INTEGER,
    -- Transaction-level attributes
    transaction_id  VARCHAR(50),
    line_item_qty   INTEGER,
    -- Daily aggregate-level attributes
    daily_total     DECIMAL(12,2),
    daily_count     INTEGER
);
-- → Unclear grain; JOINs and aggregations cannot be done correctly

-- GOOD: Separate tables for each granularity
CREATE TABLE fact_sales_transaction (  -- Transaction grain
    sale_id BIGSERIAL PRIMARY KEY,
    date_key INTEGER, product_key INTEGER, store_key INTEGER,
    quantity INTEGER, amount DECIMAL(12,2)
);
CREATE TABLE fact_sales_daily (  -- Daily snapshot grain
    date_key INTEGER, product_key INTEGER, store_key INTEGER,
    total_quantity INTEGER, total_amount DECIMAL(12,2),
    transaction_count INTEGER,
    PRIMARY KEY (date_key, product_key, store_key)
);
```

---

## Edge Cases

### Edge Case 1: Late Arriving Facts/Dimensions

```sql
-- Problem: Sales data for Dec 15 arrives on Dec 20
-- The fact can simply use the correct date_key — no issue

-- Problem: Late-arriving dimension (purchase data arrives before customer is registered)
-- Solution: Prepare an "Unknown" dimension row
INSERT INTO dim_customer (customer_key, customer_id, customer_name, segment,
                          city, region, country, effective_from, is_current)
VALUES (0, 'UNKNOWN', 'Unknown', 'Unknown', 'Unknown', 'Unknown', 'Unknown',
        '1900-01-01', TRUE);

-- Once the correct dimension arrives, update the fact
UPDATE fact_sales
SET customer_key = (
    SELECT customer_key FROM dim_customer
    WHERE customer_id = 'C999' AND is_current
)
WHERE customer_key = 0;  -- Replace Unknown with the correct key
```

### Edge Case 2: Many-to-Many Dimensions (Bridge Table)

```sql
-- Problem: A single product has multiple promotions applied simultaneously
-- → Many-to-many relationship between fact and dimension

-- Solve with a Bridge table
CREATE TABLE bridge_promotion (
    promotion_group_key INTEGER NOT NULL,
    promotion_key       INTEGER NOT NULL REFERENCES dim_promotion(promotion_key),
    weight_factor       DECIMAL(5,4) NOT NULL,  -- Contribution rate (sum = 1.0)
    PRIMARY KEY (promotion_group_key, promotion_key)
);

-- Fact table references promotion_group_key
ALTER TABLE fact_sales ADD COLUMN promotion_group_key INTEGER;

-- Query
SELECT dp.promotion_name,
       SUM(fs.total_amount * bp.weight_factor) AS attributed_revenue
FROM fact_sales fs
    JOIN bridge_promotion bp ON fs.promotion_group_key = bp.promotion_group_key
    JOIN dim_promotion dp ON bp.promotion_key = dp.promotion_key
GROUP BY dp.promotion_name;
```

### Edge Case 3: Junk Dimension (Consolidating Low-Cardinality Attributes)

```sql
-- Problem: Low-cardinality flags/codes such as is_online, is_gift_wrapped,
-- payment_type scattered across the fact table

-- Consolidate with a Junk Dimension
CREATE TABLE dim_transaction_profile (
    profile_key     SERIAL PRIMARY KEY,
    is_online       BOOLEAN NOT NULL,
    is_gift_wrapped BOOLEAN NOT NULL,
    payment_type    VARCHAR(20) NOT NULL,
    delivery_type   VARCHAR(20) NOT NULL,
    -- 2 * 2 * 4 * 3 = 48 rows cover all combinations
    UNIQUE (is_online, is_gift_wrapped, payment_type, delivery_type)
);

-- Pre-populate all combinations
INSERT INTO dim_transaction_profile
    (is_online, is_gift_wrapped, payment_type, delivery_type)
SELECT
    online, gift, pay, delivery
FROM
    (VALUES (TRUE), (FALSE)) AS o(online),
    (VALUES (TRUE), (FALSE)) AS g(gift),
    (VALUES ('credit'), ('debit'), ('cash'), ('transfer')) AS p(pay),
    (VALUES ('standard'), ('express'), ('pickup')) AS d(delivery);

-- Fact table references just one profile_key
ALTER TABLE fact_sales ADD COLUMN profile_key INTEGER
    REFERENCES dim_transaction_profile(profile_key);
```

---

## Exercises

### Exercise 1: Basic — Star Schema Design

Design a star schema for the following requirements.

**Requirements**: Sales analysis for an online bookstore
- Analytical dimensions: Books (genre, author, publisher), customers (age group, region), date, shipping method
- Measures: Sales quantity, revenue, discount amount, shipping cost

**Sample Solution**:

```sql
-- Fact table
CREATE TABLE fact_book_sales (
    sale_id         BIGSERIAL PRIMARY KEY,
    date_key        INTEGER NOT NULL REFERENCES dim_date(date_key),
    book_key        INTEGER NOT NULL REFERENCES dim_book(book_key),
    customer_key    INTEGER NOT NULL REFERENCES dim_reader(reader_key),
    delivery_key    INTEGER NOT NULL REFERENCES dim_delivery(delivery_key),
    quantity        INTEGER NOT NULL,
    sale_amount     DECIMAL(10, 2) NOT NULL,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    delivery_cost   DECIMAL(8, 2) NOT NULL
);

-- Dimension: Books
CREATE TABLE dim_book (
    book_key     SERIAL PRIMARY KEY,
    isbn         VARCHAR(20) NOT NULL,
    title        VARCHAR(300) NOT NULL,
    genre        VARCHAR(100),
    sub_genre    VARCHAR(100),
    author       VARCHAR(200),
    publisher    VARCHAR(200),
    publish_date DATE,
    list_price   DECIMAL(8, 2),
    effective_from DATE NOT NULL,
    effective_to   DATE DEFAULT '9999-12-31',
    is_current     BOOLEAN DEFAULT TRUE
);

-- Dimension: Readers
CREATE TABLE dim_reader (
    reader_key   SERIAL PRIMARY KEY,
    reader_id    VARCHAR(20) NOT NULL,
    reader_name  VARCHAR(200),
    age_group    VARCHAR(20),  -- 'Teens', '20s', etc.
    prefecture   VARCHAR(20),
    region       VARCHAR(20),  -- 'Kanto', 'Kansai', etc.
    member_since DATE,
    effective_from DATE NOT NULL,
    effective_to   DATE DEFAULT '9999-12-31',
    is_current     BOOLEAN DEFAULT TRUE
);

-- Dimension: Delivery methods
CREATE TABLE dim_delivery (
    delivery_key    SERIAL PRIMARY KEY,
    delivery_method VARCHAR(50) NOT NULL,  -- 'Standard', 'Next Day', 'Convenience Store Pickup'
    carrier         VARCHAR(100),
    is_free         BOOLEAN DEFAULT FALSE
);
```

### Exercise 2: Intermediate — Implementing SCD Type 2

Implement SCD Type 2 updates in SQL for the `dim_book` table when a book price revision occurs.

**Sample Solution**:

```sql
-- Execute within a transaction (guarantees atomicity)
BEGIN;

-- Expire the old row
UPDATE dim_book
SET effective_to = CURRENT_DATE - 1,
    is_current = FALSE
WHERE isbn = '978-4-XXX-XXXXX-X'
  AND is_current = TRUE;

-- Insert new row (price change only)
INSERT INTO dim_book (isbn, title, genre, sub_genre, author, publisher,
                      publish_date, list_price, effective_from, is_current)
SELECT isbn, title, genre, sub_genre, author, publisher,
       publish_date,
       1980.00,  -- New price
       CURRENT_DATE,
       TRUE
FROM dim_book
WHERE isbn = '978-4-XXX-XXXXX-X'
  AND effective_to = CURRENT_DATE - 1
  AND is_current = FALSE
ORDER BY effective_to DESC
LIMIT 1;

COMMIT;

-- Verify: check prices at each point in time
SELECT isbn, title, list_price, effective_from, effective_to, is_current
FROM dim_book
WHERE isbn = '978-4-XXX-XXXXX-X'
ORDER BY effective_from;
```

### Exercise 3: Advanced — ETL Pipeline Quality Check Design

Design a data quality check procedure that meets the following requirements.

**Requirements**:
1. NULL check on staging table (required columns)
2. Numeric range check (quantity > 0, amount > 0)
3. Referential integrity check (do all dimensions have corresponding keys?)
4. Log check results to a log table
5. Abort subsequent loading if any FAIL occurs

**Sample Solution**: Refer to the `etl_data_quality_check` and `etl_load_fact_sales` functions in Code Example 5 above. In addition, a temporal consistency check like the following is also useful:

```sql
-- Temporal consistency check: no future dates
INSERT INTO etl_quality_log (batch_id, check_name, check_result, affected_rows)
SELECT 'batch_001', 'future_date_check',
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
       COUNT(*)
FROM stg_sales_raw
WHERE sale_date > CURRENT_DATE;

-- Duplicate transaction check: detect duplicates against the fact table
INSERT INTO etl_quality_log (batch_id, check_name, check_result, affected_rows)
SELECT 'batch_001', 'fact_duplicate_check',
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END,
       COUNT(*)
FROM stg_sales_raw s
WHERE EXISTS (
    SELECT 1 FROM fact_sales f
    -- Detect duplicates by combination of business keys
    WHERE f.date_key = TO_CHAR(s.sale_date, 'YYYYMMDD')::INTEGER
);
```

---

## FAQ

### Q1: Which should I choose — star schema or snowflake?

Star schema is recommended for BI tool integration and ad hoc analysis. It has fewer JOINs, is intuitive, and delivers higher query performance. Choose snowflake when storage efficiency is a priority or when dimensions are updated frequently. The Kimball approach (star) is the industry standard.

### Q2: What grain should I choose for a fact table?

Design at the finest possible grain (transaction level) and aggregate later. Choosing a coarser grain prevents detailed analysis in the future. However, when storage and performance constraints exist, use daily/monthly summary fact tables alongside the transaction-level table.

### Q3: Is a date dimension table really necessary?

Yes. Using raw DATE types forces every query to compute fiscal year, quarter, holidays, and other calculations on the fly. A pre-computed date dimension greatly improves analytical efficiency. 20 years of data is only about 7,300 rows — very small.

### Q4: How do I choose between Data Vault and Star Schema?

It is common practice to use Data Vault as the "storage layer" of the data warehouse and star schema as the "presentation layer" for end users. Data Vault excels at maintaining a complete audit trail and history, but queries are complex, so connecting BI tools directly to it is not recommended.

### Q5: How do I build dimensional models when using dbt?

With dbt, models are typically split into three layers: `staging` (raw data shaping), `intermediate` (intermediate transformations), and `marts` (final dimensional models). Facts and dimensions are placed in the `marts` layer, and SCD Type 2 can be automated using dbt's `snapshot` feature.

---

## Troubleshooting

| Symptom | Cause | Solution |
|---------|-------|----------|
| JOINs on fact table are slow | No index on dimension key columns | Create indexes on FK columns |
| Materialized view refresh is slow | No UNIQUE INDEX | Create a UNIQUE INDEX for CONCURRENTLY |
| Duplicate rows with SCD Type 2 | is_current not updated properly | Run UPDATE → INSERT within a transaction |
| Fewer fact rows than expected after ETL | Mismatched rows excluded by INNER JOIN | Use LEFT JOIN + NULL check to identify the cause |
| Gaps in date dimension | Insufficient range in generate_series | Regenerate with a sufficient date range |
| Aggregate query results are incorrect | Mismatch between fact grain and JOIN | Verify grain, review GROUP BY |
| UPDATE is slow on column store (Redshift, etc.) | Column stores are inefficient for UPDATE | Switch to DELETE + INSERT (re-insert) pattern |

---

## Performance Considerations

1. **Partitioning fact tables**: RANGE partitioning on `date_key` is most effective. Splitting by month or quarter enables partition pruning, which skips irrelevant partitions and provides significant speedups.

2. **Bitmap indexes**: In OLAP environments, bitmap indexes are effective for low-cardinality columns (gender, region, etc.). Note that PostgreSQL has no native bitmap index type — the optimizer applies Bitmap Index Scan automatically at query time. Oracle supports `CREATE BITMAP INDEX`.

3. **Compression**: Fact tables contain many repeated patterns, making table-level compression highly effective. PostgreSQL applies TOAST compression automatically; Redshift supports `ENCODE` specifications; BigQuery compresses automatically.

4. **Statistics updates**: Always run `ANALYZE` after a large data load. This allows the query planner to choose JOIN order and scan methods based on accurate statistics.

---

## Security Considerations

1. **Row-Level Security (RLS)**: Use RLS to restrict which data each department can view.

```sql
-- Department-level data access control
ALTER TABLE fact_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_region_policy ON fact_sales
    USING (store_key IN (
        SELECT store_key FROM dim_store
        WHERE region = current_setting('app.user_region')
    ));
```

2. **Isolating personally identifiable information (PII)**: Store PII from customer dimensions in a separate table, and include only anonymized or aggregated attributes in the analytical dimension.

3. **Masking**: Apply data masking to copies of production data in development and test environments.

---

## Summary

| Topic | Key Points |
|-------|-----------|
| OLTP vs OLAP | Transactions → normalized; analytics → dimensional model |
| Star schema | Fact (center) + dimensions (surrounding); industry standard |
| Snowflake | Normalized dimensions; more JOINs, better storage efficiency |
| Fact tables | 3 types: transaction / snapshot / accumulating |
| Dimensions | Analytical perspectives; change history managed with SCD (Types 0–6) |
| Kimball vs Inmon | Bottom-up vs top-down; Kimball is now dominant |
| Data Vault 2.0 | Hub/Link/Satellite; strong for auditing & history; suited for storage layer |
| ETL/ELT | ELT (dbt, etc.) is mainstream in the cloud era |
| Materialized views | Hierarchical construction enables efficient refresh |

---

## Further Reading

- [00-normalization.md](./00-normalization.md) — Normalization theory (for OLTP)
- [02-performance-tuning.md](../03-practical/02-performance-tuning.md) — Tuning analytical queries
- [00-postgresql-features.md](../03-practical/00-postgresql-features.md) — Using JSONB and other features
- [01-schema-design.md](./01-schema-design.md) — Practical patterns for table design

---

## References

1. Kimball, R. & Ross, M. (2013). *The Data Warehouse Toolkit: The Definitive Guide to Dimensional Modeling*. 3rd Edition. Wiley.
2. Inmon, W.H. (2005). *Building the Data Warehouse*. 4th Edition. Wiley.
3. Linstedt, D. & Olschimke, M. (2015). *Building a Scalable Data Warehouse with Data Vault 2.0*. Morgan Kaufmann.
4. Agosta, L. (2023). *The Data Warehouse Mentor: Practical Data Warehouse and Business Intelligence Insights*. Technics Publications.
5. dbt Labs. "How we structure our dbt projects" — https://docs.getdbt.com/guides/best-practices/how-we-structure/1-guide-overview

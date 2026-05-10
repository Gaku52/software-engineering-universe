# SQL Overview — History, RDBMS, Dialects, and the Relational Model

> SQL is a declarative language for manipulating relational databases. Since its birth in the 1970s, it has remained the world standard for data management. This chapter systematically covers SQL's historical background, the theory of the relational model, the characteristics and selection criteria of major RDBMSs, differences in SQL dialects, and SQL's classification system.

---

## What You Will Learn

1. Understand SQL's historical context and the theoretical background of the relational model
2. Grasp the characteristics, architecture, and selection criteria of major RDBMSs
3. Learn how to write SQL that is aware of dialect differences and portability
4. Be able to accurately distinguish SQL's classification system (DDL/DML/DCL/TCL/DQL)

---

## Prerequisites

- Computer science fundamentals (concepts of data structures)
- Basic operation of a text editor or terminal
- security-fundamentals 00-basics — Basic concepts of data protection (recommended)

> This chapter is the entry point for learning SQL and is structured so that it can be read even without programming experience.

---

## 1. History of SQL

### 1.1 The Birth of the Relational Model

In 1970, Edgar F. Codd of IBM Research published the paper "A Relational Model of Data for Large Shared Data Banks." This paper became the theoretical foundation for relational databases and has remained the dominant paradigm for data management for over 50 years since.

Codd's breakthrough was the complete separation of the physical storage of data from the logical manipulation of data. In previous database systems (hierarchical, network-type), you could not access data without knowing the physical storage structure. Codd's relational model proposed a declarative approach: "data is logically represented as tables (relations) and manipulated using set operations."

### 1.2 SQL History Timeline

```
┌──────────────────────────────────────────────────────────────┐
│                     SQL History Timeline                       │
├──────────┬───────────────────────────────────────────────────┤
│   1970   │ E.F. Codd publishes the relational model           │
│   1974   │ IBM develops SEQUEL (later SQL) — System R project │
│   1977   │ Larry Ellison founds Software Development Labs     │
│   1979   │ Oracle V2 (first commercial RDBMS) released        │
│   1983   │ IBM DB2 released                                   │
│   1986   │ SQL-86 (first ANSI standardization)                │
│   1989   │ SQL-89 (addition of integrity constraints)         │
│   1992   │ SQL-92 (major expansion, current foundation, JOIN syntax standardized) │
│   1995   │ MySQL 1.0 released                                 │
│   1996   │ PostgreSQL 6.0 released (successor to Ingres)      │
│   1999   │ SQL:1999 (recursive queries, triggers, OO extensions) │
│   2000   │ SQLite 1.0 released                                │
│   2003   │ SQL:2003 (window functions, XML, MERGE statement)  │
│   2006   │ SQL:2006 (XQuery integration)                      │
│   2008   │ SQL:2008 (TRUNCATE, FETCH FIRST)                   │
│   2011   │ SQL:2011 (temporal data, period predicates)        │
│   2016   │ SQL:2016 (JSON, row pattern recognition, polymorphic table functions) │
│   2023   │ SQL:2023 (property graph queries, SQL/PGQ)         │
└──────────┴───────────────────────────────────────────────────┘
```

### 1.3 How to Read "SQL" and the Origin of the Name

SQL's predecessor was "SEQUEL" (Structured English Query Language), developed in the IBM System R project. Due to trademark issues it was renamed "SQL," but many people still call it "sequel" due to this history. In the ISO/ANSI standard, "SQL" is the official name, and "S-Q-L" (spelled out) is the official pronunciation.

Note that it is often said to stand for "Structured Query Language," but this is a retroactive interpretation; in the current ISO standard, "SQL" is not an acronym for anything and is defined as an official name in its own right.

### 1.4 SQL as a Declarative Language

SQL is a **declarative language** that is fundamentally different from procedural languages (C, Java, Python, etc.).

```
┌──────────────── Procedural vs. Declarative ────────────────┐
│                                                              │
│  Procedural (HOW — how to do it)                             │
│  ┌────────────────────────────────────────────┐            │
│  │ 1. Open the file                            │            │
│  │ 2. Read line by line                        │            │
│  │ 3. Add matching rows to an array            │            │
│  │ 4. Sort the array                           │            │
│  │ 5. Extract the first 10 items               │            │
│  └────────────────────────────────────────────┘            │
│                                                              │
│  Declarative (WHAT — what you want)                          │
│  ┌────────────────────────────────────────────┐            │
│  │ SELECT * FROM users                         │            │
│  │ WHERE age >= 20                              │            │
│  │ ORDER BY name                                │            │
│  │ LIMIT 10;                                    │            │
│  │                                              │            │
│  │ → Leave "how" to retrieve to the DB engine  │            │
│  └────────────────────────────────────────────┘            │
│                                                              │
│  Benefits of declarative:                                    │
│  - No need to know implementation details                    │
│  - The optimizer automatically selects the best plan        │
│  - Automatically adapts to changes in data volume and index │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Fundamental Concepts of the Relational Model

### 2.1 Mathematical Foundation

The relational model is based on set theory and first-order predicate logic.

- **Domain**: The set of values that an attribute can take. For example, the domain of "age" is integers from 0 to 150.
- **Relation**: A subset of the Cartesian product of domains. Corresponds to a table in practice.
- **Tuple**: An element of a relation. Corresponds to a row (record) in practice.
- **Attribute**: Each column of a relation. Corresponds to a column in practice.
- **Candidate key**: The minimal set of attributes that can uniquely identify a tuple.
- **Primary Key**: The representative selected from the candidate keys.
- **Foreign Key**: An attribute that references the primary key of another relation.

### Code Example 1: Basics of a Relation (Table)

```sql
-- Relation = Table
-- Tuple    = Row (record)
-- Attribute = Column
-- Domain   = The range of values a column can take (data type + constraints)

CREATE TABLE employees (
    employee_id   INTEGER PRIMARY KEY,          -- Primary key (selected from candidate keys)
    name          VARCHAR(100) NOT NULL,        -- Attribute (NOT NULL constraint = excludes NULL from domain)
    email         VARCHAR(255) UNIQUE NOT NULL, -- Attribute (UNIQUE constraint = candidate key)
    department_id INTEGER,                      -- Foreign key (referential integrity)
    salary        DECIMAL(10, 2)
        CHECK (salary >= 0),                    -- CHECK constraint = domain restriction
    hired_date    DATE NOT NULL,                -- Attribute
    FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- Insert 1 tuple (row)
INSERT INTO employees (employee_id, name, email, department_id, salary, hired_date)
VALUES (1, 'Taro Tanaka', 'tanaka@example.com', 10, 450000.00, '2020-04-01');

-- "Selection" operation in relational algebra = WHERE clause
SELECT * FROM employees WHERE salary > 400000;

-- "Projection" operation in relational algebra = specifying columns in SELECT
SELECT name, salary FROM employees;
```

### Code Example 2: Basics of Set Operations

```sql
-- Expressing relational algebra set operations in SQL

-- Preparation: create two compatible relations
CREATE TABLE employees_tokyo (
    name VARCHAR(100),
    role VARCHAR(50)
);

CREATE TABLE employees_osaka (
    name VARCHAR(100),
    role VARCHAR(50)
);

INSERT INTO employees_tokyo VALUES ('Tanaka', 'Development'), ('Suzuki', 'Sales'), ('Sato', 'Development');
INSERT INTO employees_osaka VALUES ('Suzuki', 'Sales'), ('Takahashi', 'Planning'), ('Yamada', 'Development');

-- Union (UNION): combine two result sets (remove duplicates)
SELECT name, role FROM employees_tokyo
UNION
SELECT name, role FROM employees_osaka;
-- → Tanaka, Suzuki, Sato, Takahashi, Yamada (Suzuki appears only once)

-- UNION ALL: does not remove duplicates (faster)
SELECT name, role FROM employees_tokyo
UNION ALL
SELECT name, role FROM employees_osaka;
-- → Tanaka, Suzuki, Sato, Suzuki, Takahashi, Yamada (Suzuki appears twice)

-- Difference (EXCEPT): rows that exist only on the left
SELECT name, role FROM employees_tokyo
EXCEPT
SELECT name, role FROM employees_osaka;
-- → Tanaka, Sato (employees only in Tokyo)

-- Intersection (INTERSECT): rows that exist in both
SELECT name, role FROM employees_tokyo
INTERSECT
SELECT name, role FROM employees_osaka;
-- → Suzuki (employee in both)
```

### 2.2 Structural Diagram of the Relational Model

```
┌──────────────────── Relation (employees) ─────────────────────┐
│                                                                  │
│  ┌─────────┬──────────┬───────────┬────────────┬────────────┐  │
│  │ emp_id  │  name    │  email    │ dept_id    │ hired_date │  │
│  ├─────────┼──────────┼───────────┼────────────┼────────────┤  │ ← Schema
│  │    1    │ Taro T.  │ tanaka@.. │     10     │ 2020-04-01 │  │ ← Tuple 1
│  │    2    │ Hanako S.│ suzuki@.. │     20     │ 2019-07-15 │  │ ← Tuple 2
│  │    3    │ Jiro S.  │ sato@..   │     10     │ 2021-01-10 │  │ ← Tuple 3
│  └─────────┴──────────┴───────────┴────────────┴────────────┘  │
│                                                                  │
│  Schema: employees(emp_id: INT, name: VARCHAR, ...)              │
│  Degree: number of attributes = 5                                │
│  Cardinality: number of tuples = 3                               │
│  Primary key: employee_id (uniquely identifies each tuple)       │
│  Foreign key: department_id → departments(id)                    │
│  Candidate keys: {employee_id}, {email}                          │
└──────────────────────────────────────────────────────────────────┘
```

### 2.3 Overview of Normalization

Normalization is an important design principle of the relational model — a technique that eliminates data redundancy and prevents update anomalies.

```sql
-- Denormalized state (anti-pattern)
-- Cramming all information into one table
CREATE TABLE orders_denormalized (
    order_id      INTEGER,
    customer_name VARCHAR(100),     -- Customer name is duplicated per order
    customer_email VARCHAR(255),    -- Email is also duplicated
    product_name  VARCHAR(100),     -- Product name is also duplicated
    product_price DECIMAL(10, 2),   -- Price is also duplicated
    quantity      INTEGER,
    order_date    DATE
);

-- After normalization (Third Normal Form)
-- Separate each entity into independent tables
CREATE TABLE customers (
    id    INTEGER PRIMARY KEY,
    name  VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE products (
    id    INTEGER PRIMARY KEY,
    name  VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0)
);

CREATE TABLE orders (
    id          INTEGER PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    order_date  DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE order_items (
    id         INTEGER PRIMARY KEY,
    order_id   INTEGER NOT NULL REFERENCES orders(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity   INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL  -- Store the price at the time of the order
);
```

### 2.4 ACID Properties

Four properties that underpin the reliability of relational databases.

```
┌──────────────────── ACID Properties ────────────────────┐
│                                                           │
│  A = Atomicity                                            │
│  ┌─────────────────────────────────────────┐            │
│  │ A transaction is either "all success"   │            │
│  │ or "all failure (rollback)" — never     │            │
│  │ partial. Ex: transfer = withdraw +      │            │
│  │ deposit as an indivisible unit          │            │
│  └─────────────────────────────────────────┘            │
│                                                           │
│  C = Consistency                                          │
│  ┌─────────────────────────────────────────┐            │
│  │ Data integrity is maintained before     │            │
│  │ and after a transaction.                │            │
│  │ Ex: foreign key and CHECK constraints   │            │
│  │ are always satisfied                    │            │
│  └─────────────────────────────────────────┘            │
│                                                           │
│  I = Isolation                                            │
│  ┌─────────────────────────────────────────┐            │
│  │ Concurrent transactions do not          │            │
│  │ interfere with each other.              │            │
│  │ Ex: two people operating the same       │            │
│  │ account simultaneously still yields    │            │
│  │ a correct result                        │            │
│  └─────────────────────────────────────────┘            │
│                                                           │
│  D = Durability                                           │
│  ┌─────────────────────────────────────────┐            │
│  │ COMMITted data is not lost even after   │            │
│  │ a system failure.                       │            │
│  │ Ex: guaranteed by WAL                   │            │
│  │ (Write-Ahead Logging)                   │            │
│  └─────────────────────────────────────────┘            │
└───────────────────────────────────────────────────────────┘
```

---

## 3. Major RDBMSs

### 3.1 PostgreSQL: Characteristics and Internal Architecture

PostgreSQL bills itself as "the world's most advanced open-source relational database," with a high degree of conformance to the SQL standard and excellent extensibility.

**Internal architecture characteristics:**
- **MVCC (Multi-Version Concurrency Control)**: Maintains multiple versions of each row so that reads and writes do not block each other.
- **WAL (Write-Ahead Logging)**: Writes changes to a log first, making it possible to recover data after a crash.
- **Process-based architecture**: Assigns an independent process to each connection.

### Code Example 3: Distinctive Features of PostgreSQL

```sql
-- PostgreSQL: Advanced data types and extensibility

-- Array type: store multiple values in a single column
CREATE TABLE products (
    id       SERIAL PRIMARY KEY,
    name     TEXT NOT NULL,
    tags     TEXT[],                    -- Array type
    metadata JSONB,                     -- JSONB binary type (supports GIN index)
    price    NUMRANGE,                  -- Range type (express a price range)
    search   TSVECTOR                   -- Vector for full-text search
);

-- Insert sample data
INSERT INTO products (name, tags, metadata, price, search) VALUES (
    'Organic Miso',
    ARRAY['organic', 'japanese', 'fermented'],
    '{"category": "food", "origin": "Japan", "weight_g": 500}',
    NUMRANGE(300, 500),
    to_tsvector('japanese', 'organic miso domestic soybean')
);

-- Array search: ANY operator
SELECT * FROM products WHERE 'organic' = ANY(tags);

-- Array containment: @> operator
SELECT * FROM products WHERE tags @> ARRAY['organic', 'japanese'];

-- Search inside JSONB: @> operator (containment)
SELECT * FROM products WHERE metadata @> '{"category": "food"}';

-- Get a value inside JSONB: ->> operator
SELECT name, metadata->>'origin' AS origin FROM products;

-- Range type search: @> operator (is value within range?)
SELECT * FROM products WHERE price @> 350;

-- Full-text search: @@ operator
SELECT * FROM products WHERE search @@ to_tsquery('japanese', 'organic & miso');

-- Table inheritance (PostgreSQL-specific)
CREATE TABLE employees_2024 () INHERITS (employees);

-- GENERATED COLUMNS (computed columns)
CREATE TABLE orders_v2 (
    id         SERIAL PRIMARY KEY,
    quantity   INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total      DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- LATERAL JOIN: correlated subquery in FROM clause
SELECT d.name, top3.*
FROM departments d
CROSS JOIN LATERAL (
    SELECT e.name, e.salary
    FROM employees e
    WHERE e.department_id = d.id
    ORDER BY e.salary DESC
    LIMIT 3
) top3;
```

### 3.2 MySQL: Characteristics

MySQL is one of the most widely used open-source RDBMSs in the world, particularly well-suited for web applications (LAMP/LEMP stack).

**Internal architecture characteristics:**
- **Pluggable storage engines**: InnoDB, MyISAM, etc. can be selected according to the use case.
- **Thread-based architecture**: Assigns a thread to each connection (PostgreSQL uses processes).
- **InnoDB**: The default engine that fully supports MVCC, foreign keys, and transactions.

### Code Example 4: Distinctive Features of MySQL

```sql
-- MySQL: Wide adoption and simple operation

-- AUTO_INCREMENT and engine specification
CREATE TABLE articles (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title      VARCHAR(255) NOT NULL,
    body       LONGTEXT,
    status     ENUM('draft', 'published', 'archived') DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- MySQL full-text index
    FULLTEXT INDEX ft_body (body)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Full-text search (boolean mode)
SELECT * FROM articles
WHERE MATCH(body) AGAINST('database +design -NoSQL' IN BOOLEAN MODE);

-- ON DUPLICATE KEY UPDATE (UPSERT)
INSERT INTO user_settings (user_id, setting_key, setting_value)
VALUES (1, 'theme', 'dark')
ON DUPLICATE KEY UPDATE
    setting_value = VALUES(setting_value),
    updated_at = NOW();

-- REPLACE INTO (delete then insert if exists)
REPLACE INTO cache_table (cache_key, cache_value, expires_at)
VALUES ('user:1:profile', '{"name":"Tanaka"}', DATE_ADD(NOW(), INTERVAL 1 HOUR));

-- JSON type (MySQL 5.7+)
CREATE TABLE events (
    id   BIGINT AUTO_INCREMENT PRIMARY KEY,
    data JSON NOT NULL,
    -- Virtual generated column + index
    event_type VARCHAR(50) GENERATED ALWAYS AS (data->>'$.type') VIRTUAL,
    INDEX idx_event_type (event_type)
);

INSERT INTO events (data) VALUES ('{"type": "login", "user_id": 42, "ip": "192.168.1.1"}');
SELECT * FROM events WHERE data->>'$.type' = 'login';

-- Window Functions (MySQL 8.0+)
SELECT
    name,
    department_id,
    salary,
    RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) AS dept_rank
FROM employees;
```

### 3.3 SQLite: Characteristics

SQLite is a "serverless" RDBMS where the entire database is stored in a single file. It is widely used in mobile apps, embedded systems, test environments, and desktop applications.

### Code Example 5: Distinctive Features of SQLite

```sql
-- SQLite: embedded, no server required
-- A single file is the entire database (or in-memory via :memory:)

-- Dynamic typing (type affinity)
-- SQLite uses the declared column type as a "hint"; in practice any value can be stored
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value ANY              -- any type can be stored
);

INSERT INTO settings VALUES ('max_retry', 3);          -- INTEGER
INSERT INTO settings VALUES ('api_url', 'https://example.com');  -- TEXT
INSERT INTO settings VALUES ('enabled', 1);            -- INTEGER (SQLite has no BOOLEAN type)
INSERT INTO settings VALUES ('ratio', 3.14);           -- REAL

-- Check the actual type with typeof()
SELECT key, value, typeof(value) FROM settings;
-- max_retry | 3    | integer
-- api_url   | https://example.com | text
-- enabled   | 1    | integer
-- ratio     | 3.14 | real

-- JSON extension (built-in since SQLite 3.38.0+)
CREATE TABLE logs (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL  -- stored as a JSON string
);

INSERT INTO logs (data) VALUES ('{"level": "error", "message": "Connection failed", "code": 500}');

SELECT
    json_extract(data, '$.level') AS level,
    json_extract(data, '$.message') AS message
FROM logs
WHERE json_extract(data, '$.level') = 'error';

-- UPSERT (SQLite 3.24.0+)
INSERT INTO settings (key, value)
VALUES ('max_retry', 5)
ON CONFLICT(key) DO UPDATE SET value = excluded.value;

-- Improve concurrent read performance with WAL (Write-Ahead Logging) mode
-- PRAGMA journal_mode=WAL;
```

### Code Example 6: Distinctive Features of SQL Server

```sql
-- SQL Server: enterprise-oriented, deep integration with .NET

-- IDENTITY column (auto-increment)
CREATE TABLE orders (
    order_id   INT IDENTITY(1,1) PRIMARY KEY,  -- increments by 1 starting from 1
    order_date DATETIME2 DEFAULT SYSDATETIME(),
    customer_id INT NOT NULL,
    total_amount DECIMAL(12, 2)
);

-- TOP N (SQL Server pagination)
SELECT TOP 10 * FROM orders ORDER BY order_date DESC;

-- OFFSET-FETCH (conforms to SQL:2008 standard)
SELECT * FROM orders
ORDER BY order_date DESC
OFFSET 20 ROWS
FETCH NEXT 10 ROWS ONLY;

-- MERGE statement (UPSERT + DELETE in one statement)
MERGE INTO user_settings AS target
USING (VALUES (1, 'theme', 'dark')) AS source (user_id, setting_key, setting_value)
ON target.user_id = source.user_id AND target.setting_key = source.setting_key
WHEN MATCHED THEN
    UPDATE SET setting_value = source.setting_value
WHEN NOT MATCHED THEN
    INSERT (user_id, setting_key, setting_value)
    VALUES (source.user_id, source.setting_key, source.setting_value);

-- STRING_AGG (string aggregation, SQL Server 2017+)
SELECT
    department_id,
    STRING_AGG(name, ', ') WITHIN GROUP (ORDER BY name) AS members
FROM employees
GROUP BY department_id;

-- IIF (shorthand for conditional expression)
SELECT name, salary,
    IIF(salary >= 500000, 'High', 'Standard') AS grade
FROM employees;
```

### 3.4 Major RDBMS Comparison Table

| Feature | PostgreSQL | MySQL | SQLite | SQL Server | Oracle |
|---------|-----------|-------|--------|------------|--------|
| License | PostgreSQL License (BSD-style) | GPL v2/Commercial | Public Domain | Commercial (Express edition is free) | Commercial |
| Max DB Size | Unlimited | 256TB (InnoDB) | 281TB | 524PB | Unlimited |
| Max Row Size | 1.6TB | 65,535 bytes | 1GB | 8,060 bytes | No limit |
| Concurrent Connections | Thousands (config-dependent) | Thousands | Single writer | 32,767 | Config-dependent |
| MVCC | Yes | Yes (InnoDB) | Approximated in WAL mode | Yes | Yes |
| JSON Support | JSONB (GIN index, fast) | JSON (5.7+) | JSON1 extension | JSON (2016+) | JSON (21c+) |
| Full-Text Search | Built-in (multilingual) | Built-in (InnoDB/MyISAM) | FTS5 extension | Built-in | Oracle Text |
| Replication | Streaming/Logical | Group/Async | None | Always On AG | Data Guard |
| Partitioning | Declarative (10+) | Native | None | Native | Native |
| Extensibility | Very high (Extension) | Medium (Plugin) | Low | High | High |
| Learning Cost | Moderate | Low | Very low | Moderate | High |
| Primary Use Cases | General-purpose/GIS/Analytics | Web/LAMP | Embedded/Mobile | Enterprise/.NET | Mission-critical |

### 3.5 Common Internal Architecture of RDBMSs

```
┌──────────────── Internal Architecture of an RDBMS ────────────────┐
│                                                                      │
│  Client                                                              │
│      │                                                               │
│      ▼                                                               │
│  ┌───────────────────────┐                                          │
│  │   Connection Manager  │  Connection pooling, authentication       │
│  └───────────┬───────────┘                                          │
│              ▼                                                       │
│  ┌───────────────────────┐                                          │
│  │   Parser              │  SQL syntax analysis → parse tree        │
│  └───────────┬───────────┘                                          │
│              ▼                                                       │
│  ┌───────────────────────┐                                          │
│  │   Optimizer           │  Execution plan selection based on stats │
│  │   (Query Planner)     │  Cost-based optimization                 │
│  └───────────┬───────────┘                                          │
│              ▼                                                       │
│  ┌───────────────────────┐                                          │
│  │   Executor            │  Retrieve data according to the plan     │
│  └───────────┬───────────┘                                          │
│              ▼                                                       │
│  ┌───────────────────────┐                                          │
│  │   Storage Engine      │  Buffer pool, disk I/O                   │
│  │   + Transaction       │  WAL, MVCC, lock management              │
│  │   Manager             │                                          │
│  └───────────────────────┘                                          │
│                                                                      │
│  SQL statement lifecycle:                                            │
│  String → Parse → Optimize → Execute → Return result                │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. SQL Dialect Differences

The SQL standard is broad, but the scope of implementation and proprietary extensions vary greatly among RDBMSs. To write portable code, you need to accurately understand dialect differences.

### 4.1 Dialect Comparison Table (Key Operations)

| Operation | Standard SQL / PostgreSQL | MySQL | SQLite | SQL Server |
|-----------|--------------------------|-------|--------|------------|
| String concatenation | `'A' \|\| 'B'` | `CONCAT('A','B')` | `'A' \|\| 'B'` | `'A' + 'B'` / `CONCAT` |
| LIMIT | `LIMIT 10` | `LIMIT 10` | `LIMIT 10` | `TOP 10` / `FETCH NEXT 10 ROWS ONLY` |
| UPSERT | `ON CONFLICT DO UPDATE` | `ON DUPLICATE KEY UPDATE` | `ON CONFLICT DO UPDATE` | `MERGE` |
| Auto-increment | `SERIAL` / `GENERATED` | `AUTO_INCREMENT` | `AUTOINCREMENT` | `IDENTITY` |
| Current timestamp | `CURRENT_TIMESTAMP` | `NOW()` / `CURRENT_TIMESTAMP` | `datetime('now')` | `GETDATE()` / `SYSDATETIME()` |
| BOOLEAN | `TRUE` / `FALSE` | `TRUE` / `FALSE` (=1/0) | `1` / `0` | `BIT` (1/0) |
| IF expression | `CASE WHEN` | `IF()` / `CASE` | `CASE WHEN` / `IIF` | `IIF()` / `CASE` |
| Date difference | `age()` / `-` operator | `DATEDIFF()` | `julianday()` | `DATEDIFF()` |
| Regular expression | `~` / `~*` | `REGEXP` | None (available via extension) | None (CLR) |
| Array type | `TEXT[]` | None (JSON substitute) | None | None |
| CTE | `WITH` / `WITH RECURSIVE` | `WITH RECURSIVE` (8.0+) | `WITH RECURSIVE` (3.8.3+) | `WITH` |
| Window functions | Full support | 8.0+ | 3.25.0+ | Full support |

### 4.2 Dialect Comparison Table (Date Operations)

| Operation | PostgreSQL | MySQL | SQLite | SQL Server |
|-----------|-----------|-------|--------|------------|
| Current datetime | `NOW()` / `CURRENT_TIMESTAMP` | `NOW()` | `datetime('now')` | `GETDATE()` |
| Date addition | `date + INTERVAL '1 day'` | `DATE_ADD(date, INTERVAL 1 DAY)` | `datetime(date, '+1 day')` | `DATEADD(DAY, 1, date)` |
| Date difference | `date1 - date2` | `DATEDIFF(date1, date2)` | `julianday(d1) - julianday(d2)` | `DATEDIFF(DAY, d2, d1)` |
| Extract year | `EXTRACT(YEAR FROM date)` | `YEAR(date)` | `strftime('%Y', date)` | `YEAR(date)` |
| First day of month | `DATE_TRUNC('month', date)` | `DATE_FORMAT(date, '%Y-%m-01')` | `date(date, 'start of month')` | `DATEFROMPARTS(YEAR(d), MONTH(d), 1)` |
| Format conversion | `TO_CHAR(date, 'YYYY-MM-DD')` | `DATE_FORMAT(date, '%Y-%m-%d')` | `strftime('%Y-%m-%d', date)` | `FORMAT(date, 'yyyy-MM-dd')` |

### Code Example 7: Writing Portable SQL

```sql
-- Patterns for minimizing dialect differences

-- (1) Pagination: use OFFSET-FETCH (SQL:2008 standard)
-- Works in PostgreSQL, SQL Server, SQLite (3.35.0+)
SELECT employee_id, name, salary
FROM employees
ORDER BY salary DESC
OFFSET 20 ROWS
FETCH NEXT 10 ROWS ONLY;

-- (2) CASE expression is available in all RDBMSs
SELECT name, salary,
    CASE
        WHEN salary >= 600000 THEN 'High'
        WHEN salary >= 400000 THEN 'Mid'
        ELSE 'Standard'
    END AS salary_grade
FROM employees;

-- (3) COALESCE: NULL substitution (available in all RDBMSs)
SELECT name, COALESCE(phone, email, 'No contact info') AS contact
FROM employees;

-- (4) Standard date literal notation
SELECT * FROM orders
WHERE order_date >= DATE '2024-01-01'
  AND order_date <  DATE '2025-01-01';

-- (5) CAST expression is available in all RDBMSs
SELECT CAST(price AS INTEGER) AS rounded_price FROM products;

-- (6) EXISTS/NOT EXISTS behaves identically in all RDBMSs
SELECT * FROM customers c
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
```

### Code Example 8: Patterns for Absorbing Dialect Differences (Application Design)

```sql
-- Design patterns for absorbing dialect differences in the application layer

-- Pattern 1: Hide dialect differences with a view
-- For PostgreSQL
CREATE VIEW v_monthly_sales AS
SELECT
    DATE_TRUNC('month', sale_date) AS month,
    SUM(amount) AS total
FROM sales
GROUP BY DATE_TRUNC('month', sale_date);

-- For MySQL (same logic, but different functions)
-- CREATE VIEW v_monthly_sales AS
-- SELECT
--     DATE_FORMAT(sale_date, '%Y-%m-01') AS month,
--     SUM(amount) AS total
-- FROM sales
-- GROUP BY DATE_FORMAT(sale_date, '%Y-%m-01');

-- Pattern 2: Conditional INSERT (major dialect differences)
-- Standard approach: IF-ELSE in the application layer
-- PostgreSQL: INSERT ... ON CONFLICT DO UPDATE
-- MySQL:      INSERT ... ON DUPLICATE KEY UPDATE
-- SQL Server: MERGE
-- SQLite:     INSERT ... ON CONFLICT DO UPDATE

-- Pattern 3: Absorb dialect differences with stored procedures
-- PostgreSQL example
CREATE OR REPLACE FUNCTION upsert_setting(
    p_user_id INTEGER,
    p_key TEXT,
    p_value TEXT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO user_settings (user_id, key, value)
    VALUES (p_user_id, p_key, p_value)
    ON CONFLICT (user_id, key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- The caller does not need to be aware of the RDBMS
SELECT upsert_setting(1, 'theme', 'dark');
```

---

## 5. SQL Classification

SQL is classified into five categories according to the nature of the operation.

```
┌──────────────────────── SQL Language Classification ──────────────────────────┐
│                                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │   DDL    │  │   DML    │  │   DCL    │  │   TCL    │                      │
│  │          │  │          │  │          │  │          │                      │
│  │ CREATE   │  │ INSERT   │  │ GRANT    │  │ BEGIN    │                      │
│  │ ALTER    │  │ UPDATE   │  │ REVOKE   │  │ COMMIT   │                      │
│  │ DROP     │  │ DELETE   │  │          │  │ ROLLBACK │                      │
│  │ TRUNCATE │  │ MERGE    │  │          │  │ SAVEPOINT│                      │
│  │ RENAME   │  │ SELECT   │  │          │  │          │                      │
│  │ COMMENT  │  │          │  │          │  │          │                      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                      │
│                                                                                 │
│  DDL = Data Definition Language                                                 │
│  DML = Data Manipulation Language                                               │
│  DCL = Data Control Language                                                    │
│  TCL = Transaction Control Language                                             │
│                                                                                 │
│  * SELECT is sometimes independently classified as DQL (Data Query Language)   │
│  * Classification varies slightly between RDBMSs and textbooks                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 5.1 Details of Each Classification

### Code Example 9: DDL (Data Definition Language)

```sql
-- DDL: Define, modify, and delete the structure of database objects

-- CREATE: create an object
CREATE TABLE departments (
    id   INTEGER PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_employees_dept ON employees(department_id);

CREATE VIEW v_active_employees AS
SELECT * FROM employees WHERE status = 'active';

-- ALTER: modify an object
ALTER TABLE employees ADD COLUMN phone VARCHAR(20);
ALTER TABLE employees ALTER COLUMN name SET NOT NULL;
ALTER TABLE employees DROP COLUMN phone;
ALTER TABLE employees RENAME COLUMN name TO full_name;

-- DROP: delete an object
DROP TABLE IF EXISTS temp_data;
DROP INDEX IF EXISTS idx_old;
DROP VIEW IF EXISTS v_old_view;

-- TRUNCATE: delete all rows in a table (DDL operation, fast)
TRUNCATE TABLE log_entries;

-- COMMENT: add a comment to an object (PostgreSQL)
COMMENT ON TABLE employees IS 'Employee master table';
COMMENT ON COLUMN employees.salary IS 'Monthly base salary (JPY)';
```

### Code Example 10: DCL (Data Control Language) and TCL

```sql
-- DCL: Control data access permissions

-- GRANT: grant permissions
GRANT SELECT, INSERT ON employees TO app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin_user;
GRANT USAGE ON SEQUENCE employees_id_seq TO app_user;

-- REVOKE: revoke permissions
REVOKE DELETE ON employees FROM app_user;
REVOKE ALL PRIVILEGES ON employees FROM public;

-- Create and manage ROLEs
CREATE ROLE readonly_user LOGIN PASSWORD 'secure_password';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;

-- TCL: Control transactions

-- Basic transaction
BEGIN;
    UPDATE accounts SET balance = balance - 10000 WHERE id = 1;
    UPDATE accounts SET balance = balance + 10000 WHERE id = 2;
COMMIT;

-- SAVEPOINT: partial rollback
BEGIN;
    INSERT INTO orders (customer_id, total) VALUES (1, 5000);
    SAVEPOINT before_items;

    INSERT INTO order_items (order_id, product_id) VALUES (100, 1);
    -- If an error occurs, roll back to the SAVEPOINT
    -- ROLLBACK TO SAVEPOINT before_items;

    INSERT INTO order_items (order_id, product_id) VALUES (100, 2);
COMMIT;
```

### 5.2 Detailed Comparison Table of SQL Classifications

| Classification | Purpose | Key Commands | Rollback Possible | Implicit COMMIT |
|---------------|---------|-------------|-------------------|-----------------|
| DDL | Structure definition | CREATE, ALTER, DROP, TRUNCATE | DB-dependent | Yes in most RDBMSs |
| DML | Data manipulation | INSERT, UPDATE, DELETE, SELECT | Yes | No |
| DCL | Permission control | GRANT, REVOKE | DB-dependent | Yes in most RDBMSs |
| TCL | Transactions | BEGIN, COMMIT, ROLLBACK, SAVEPOINT | N/A | N/A |

---

## 6. SQL Learning Roadmap

```
┌──────────────── SQL Learning Roadmap ────────────────┐
│                                                        │
│  Level 1: Basics (this chapter + 00-basics)            │
│  ┌──────────────────────────────────────────┐         │
│  │ SQL Overview → CRUD → JOIN → Aggregation │         │
│  │ → Subqueries                             │         │
│  └──────────────────────────────────────────┘         │
│           │                                            │
│           ▼                                            │
│  Level 2: Applied (01-advanced)                        │
│  ┌──────────────────────────────────────────┐         │
│  │ Window functions → CTE → Transactions    │         │
│  │ → Indexes → Query optimization           │         │
│  └──────────────────────────────────────────┘         │
│           │                                            │
│           ▼                                            │
│  Level 3: Design (02-design)                           │
│  ┌──────────────────────────────────────────┐         │
│  │ Normalization → Schema design →          │         │
│  │ Constraints → ER diagrams                │         │
│  └──────────────────────────────────────────┘         │
│           │                                            │
│           ▼                                            │
│  Level 4: Practical (03-practical)                     │
│  ┌──────────────────────────────────────────┐         │
│  │ Migrations → Backup → Monitoring         │         │
│  │ → Security → Performance tuning          │         │
│  └──────────────────────────────────────────┘         │
└────────────────────────────────────────────────────────┘
```

---

## Anti-Patterns

### Anti-Pattern 1: Design That Depends on SQL Dialects

```sql
-- NG: depending on MySQL-specific syntax
SELECT * FROM users LIMIT 10, 20;  -- offset, limit order is MySQL-specific
-- further depending on MySQL's GROUP BY extension
SELECT department_id, name, MAX(salary)
FROM employees
GROUP BY department_id;
-- → In MySQL, name returns an indeterminate value (when ONLY_FULL_GROUP_BY is disabled)
-- → In PostgreSQL this is an immediate error

-- OK: writing closer to standard SQL
SELECT * FROM users
ORDER BY id
OFFSET 10 ROWS
FETCH NEXT 20 ROWS ONLY;  -- SQL:2008 standard

-- OK: correct use of GROUP BY
SELECT department_id, MIN(name), MAX(salary)
FROM employees
GROUP BY department_id;
```

**Problem**: You become locked into a specific RDBMS, and the future migration cost becomes enormous. Also, MySQL's GROUP BY extension returns non-deterministic results and becomes a source of bugs.

**WHY**: Dialect-dependent code may "work" but can be "incorrect." By basing your code on standard SQL, you can ensure not only portability but also correctness.

### Anti-Pattern 2: Deferring RDBMS Selection

```
Starting development with "SQLite for now" → suddenly switching to PostgreSQL in production
→ Many features not available in SQLite were used, causing a large-scale rewrite

Specific examples of problems:
┌──────────────────────────────────────────────────────┐
│ Features absent/different in SQLite  │ Problems on migration │
├──────────────────────────────────────┼──────────────────────┤
│ Concurrent writes (single writer)    │ Race condition errors in production │
│ ALTER TABLE restrictions (limited)   │ Difficult migrations │
│ Permission management (none)         │ Security not designed │
│ ENUM type (none)                     │ Validation gaps       │
│ Stored procedures (none)             │ Logic must be reimplemented │
│ DATE/TIME type (string substitute)   │ Complete rewrite of date arithmetic │
└──────────────────────────────────────┴──────────────────────┘
```

**Countermeasures**:
- Use the same RDBMS in development as in production from the start
- Use Docker / docker-compose to make environment setup easy
- Also use something other than SQLite in test environments (e.g., docker-compose.test.yml)

### Anti-Pattern 3: Ignoring NULL's Three-Valued Logic

```sql
-- NG: comparison with NULL is always UNKNOWN
SELECT * FROM employees WHERE department_id = NULL;
-- → result is always 0 rows! (NULL = NULL is UNKNOWN)

SELECT * FROM employees WHERE department_id != 10;
-- → rows where department_id IS NULL are not included!

-- OK: use IS NULL / IS NOT NULL
SELECT * FROM employees WHERE department_id IS NULL;

-- OK: condition that accounts for NULL
SELECT * FROM employees
WHERE department_id != 10 OR department_id IS NULL;

-- NULL's three-valued logic:
-- TRUE AND NULL    = NULL (UNKNOWN)
-- FALSE AND NULL   = FALSE
-- TRUE OR NULL     = TRUE
-- FALSE OR NULL    = NULL (UNKNOWN)
-- NOT NULL         = NULL (UNKNOWN)
```

**WHY**: SQL uses three-valued logic (TRUE/FALSE/UNKNOWN) rather than two-valued logic (TRUE/FALSE). The result of any operation involving NULL is always UNKNOWN, and UNKNOWN in a WHERE clause is treated as "condition not satisfied."

---

## Practical Exercises

### Exercise 1 (Basic): Organize RDBMS Characteristics

For each of the following requirements, choose the most suitable RDBMS and explain why.

1. Personal blog app (monthly PV under 1,000, zero budget)
2. E-commerce site (100 concurrent connections, payment processing, emphasis on future scalability)
3. Embedded data store for an IoT device (memory constrained, no server connection possible)
4. Core system for a large enterprise (SLA 99.99%, 24-hour support required)
5. Geographic Information System (GIS) that frequently handles location data

<details>
<summary>Model Answer</summary>

1. **SQLite** — No server needed, zero configuration. Runs as a single file and has sufficient performance for a small site. Further cost reduction if no VPS is needed. However, if using a CMS like WordPress, use MySQL/MariaDB.

2. **PostgreSQL** — ACID-compliant transactions ensure the reliability of payment processing. Extended features such as JSONB, partitioning, and logical replication accommodate future growth. Open source with no restrictions on commercial use.

3. **SQLite** — No server process needed; can be embedded in applications as a library. Small footprint (about 700KB), no configuration files needed. The standard database engine on Android/iOS.

4. **Oracle Database** or **SQL Server** — Provide 24-hour staffed support, high-availability configuration (Oracle RAC / SQL Server Always On), comprehensive monitoring tools, and SLA guarantees. Cost is high, but justified when the business impact of downtime is large.

5. **PostgreSQL + PostGIS** — The PostGIS extension provides standard support for spatial indexes (GiST/SP-GiST), geographic functions (ST_Distance, ST_Contains, etc.), and coordinate system conversions. Open source and the de facto standard in the GIS field.

</details>

### Exercise 2 (Applied): Verify SQL Dialect Portability

Rewrite the following MySQL-specific SQL for PostgreSQL and standard SQL.

```sql
-- MySQL version
SELECT
    id,
    IF(status = 1, 'active', 'inactive') AS status_label,
    DATE_FORMAT(created_at, '%Y年%m月%d日') AS formatted_date,
    GROUP_CONCAT(tag SEPARATOR ', ') AS tags
FROM articles
WHERE MATCH(body) AGAINST('database' IN BOOLEAN MODE)
GROUP BY id
LIMIT 5, 10;
```

<details>
<summary>Model Answer</summary>

```sql
-- PostgreSQL version
SELECT
    id,
    CASE WHEN status = 1 THEN 'active' ELSE 'inactive' END AS status_label,
    TO_CHAR(created_at, 'YYYY"年"MM"月"DD"日"') AS formatted_date,
    STRING_AGG(tag, ', ') AS tags
FROM articles
WHERE search_vector @@ to_tsquery('english', 'database')
    -- Note: search_vector is a TSVECTOR column (a GIN index must be created in advance)
GROUP BY id
ORDER BY id  -- ORDER BY is required for OFFSET-FETCH
OFFSET 5 ROWS
FETCH NEXT 10 ROWS ONLY;

-- Standard SQL version (full-text search is not part of standard SQL, so LIKE is used as a substitute)
SELECT
    id,
    CASE WHEN status = 1 THEN 'active' ELSE 'inactive' END AS status_label,
    -- Date format conversion in standard SQL has large dialect differences; processing in the app layer is recommended
    CAST(created_at AS DATE) AS sale_date,
    -- STRING_AGG was standardized in SQL:2023 (LISTAGG was Oracle's earlier implementation)
    LISTAGG(tag, ', ') WITHIN GROUP (ORDER BY tag) AS tags
FROM articles
WHERE body LIKE '%database%'  -- substitute for full-text search (lower performance)
GROUP BY id
ORDER BY id
OFFSET 5 ROWS
FETCH NEXT 10 ROWS ONLY;
```

**Key points for migration:**
- `IF()` → `CASE WHEN ... THEN ... ELSE ... END` (standard SQL)
- `DATE_FORMAT()` → `TO_CHAR()` (PostgreSQL) / conversion in the app layer
- `GROUP_CONCAT()` → `STRING_AGG()` (PostgreSQL) / `LISTAGG()` (Oracle/standard)
- `MATCH ... AGAINST` → `@@` + `to_tsquery()` (PostgreSQL) / `LIKE` (general)
- `LIMIT offset, count` → `OFFSET ... ROWS FETCH NEXT ... ROWS ONLY` (standard SQL)

</details>

### Exercise 3 (Advanced): Design Based on Relational Model Principles

Convert the following denormalized spreadsheet data into a third normal form table design. Write CREATE TABLE statements, constraints, sample INSERT statements, and a SELECT statement to display all order details.

```
Order ID | Order Date  | Customer Name | Customer Email   | Product Name | Unit Price | Qty | Shipping Address
1        | 2024-01-15  | Taro Tanaka   | tanaka@mail.com  | Laptop       | 80000      | 1   | 1-1 Shinjuku, Tokyo
1        | 2024-01-15  | Taro Tanaka   | tanaka@mail.com  | Mouse        | 3000       | 2   | 1-1 Shinjuku, Tokyo
2        | 2024-01-16  | Hanako Suzuki | suzuki@mail.com  | Keyboard     | 5000       | 1   | 2-2 Osaka City, Osaka
```

<details>
<summary>Model Answer</summary>

```sql
-- Decomposition into third normal form

-- 1. Customer table (eliminate duplication of customer data)
CREATE TABLE customers (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE
);

-- 2. Product table (eliminate duplication of product data)
CREATE TABLE products (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0)
);

-- 3. Order table (order header)
CREATE TABLE orders (
    id              SERIAL PRIMARY KEY,
    customer_id     INTEGER NOT NULL REFERENCES customers(id),
    order_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    shipping_address TEXT NOT NULL
);

-- 4. Order items table (many-to-many relationship between orders and products)
CREATE TABLE order_items (
    id         SERIAL PRIMARY KEY,
    order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
        -- Store the price at the time of the order (not affected by price changes in the product master)
    quantity   INTEGER NOT NULL CHECK (quantity > 0),
    UNIQUE (order_id, product_id)  -- prevent duplicate products within the same order
);

-- Sample data
INSERT INTO customers (id, name, email) VALUES
    (1, 'Taro Tanaka', 'tanaka@mail.com'),
    (2, 'Hanako Suzuki', 'suzuki@mail.com');

INSERT INTO products (id, name, price) VALUES
    (1, 'Laptop', 80000),
    (2, 'Mouse', 3000),
    (3, 'Keyboard', 5000);

INSERT INTO orders (id, customer_id, order_date, shipping_address) VALUES
    (1, 1, '2024-01-15', '1-1 Shinjuku, Tokyo'),
    (2, 2, '2024-01-16', '2-2 Osaka City, Osaka');

INSERT INTO order_items (order_id, product_id, unit_price, quantity) VALUES
    (1, 1, 80000, 1),  -- Order 1: Laptop x 1
    (1, 2, 3000, 2),   -- Order 1: Mouse x 2
    (2, 3, 5000, 1);   -- Order 2: Keyboard x 1

-- Query to display all order details
SELECT
    o.id AS order_id,
    o.order_date,
    c.name AS customer_name,
    c.email AS customer_email,
    p.name AS product_name,
    oi.unit_price,
    oi.quantity,
    oi.unit_price * oi.quantity AS subtotal,
    o.shipping_address
FROM orders o
    INNER JOIN customers c ON o.customer_id = c.id
    INNER JOIN order_items oi ON o.id = oi.order_id
    INNER JOIN products p ON oi.product_id = p.id
ORDER BY o.id, p.name;

-- Total amount per order
SELECT
    o.id AS order_id,
    c.name AS customer_name,
    SUM(oi.unit_price * oi.quantity) AS total_amount
FROM orders o
    INNER JOIN customers c ON o.customer_id = c.id
    INNER JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id, c.name
ORDER BY o.id;
```

**Key design points:**
- Storing `unit_price` in `order_items` means past orders are not affected by changes to product prices in the master table.
- `ON DELETE CASCADE` automatically deletes line items when an order is deleted.
- `UNIQUE (order_id, product_id)` prevents duplicate line items for the same product.
- `CHECK` constraints guarantee domain rules (price ≥ 0, quantity > 0).

</details>

---

## FAQ

### Q1: Isn't SQL an "old technology"?

SQL was born in the 1970s, but has been continuously extended through SQL:2023. Modern features such as JSON support, graph queries (SQL/PGQ), time-series data, and row pattern recognition continue to be added, and its scope of application is actually growing.

After the NoSQL boom, many NoSQL databases adopted SQL-like query languages (Cassandra's CQL, Couchbase's N1QL, Google BigQuery's SQL dialect, etc.), which proves the excellence of SQL's design. Furthermore, distributed databases called NewSQL (CockroachDB, TiDB, YugabyteDB, etc.) also adopt SQL interfaces, making SQL the standard access language even in distributed systems.

### Q2: Which RDBMS should I choose?

The criteria for judgment are as follows:

| Condition | Recommended RDBMS | Reason |
|-----------|------------------|--------|
| Personal/small project | SQLite | Zero configuration, runs as a single file |
| General web app | PostgreSQL | Rich features, extensibility, standard SQL conformance |
| Existing LAMP environment | MySQL / MariaDB | Mature ecosystem, proven operation |
| .NET / Azure environment | SQL Server | Integration with Visual Studio/Azure |
| Large-scale mission-critical | Oracle | Support quality, RAC, track record |
| GIS / geographic information | PostgreSQL + PostGIS | De facto standard for spatial data processing |
| Analytics / DWH | PostgreSQL / BigQuery | Rich analytic functions |

### Q3: Can I use any RDBMS if I only learn standard SQL?

Basic CRUD operations (SELECT, INSERT, UPDATE, DELETE) and JOINs can be written in standard SQL. However, the following areas have large dialect differences:

- **Date/time functions**: `DATE_TRUNC` vs `DATE_FORMAT` vs `strftime` vs `DATEPART`
- **String functions**: `||` vs `CONCAT` vs `+`
- **Pagination**: `LIMIT` vs `TOP` vs `FETCH FIRST`
- **UPSERT**: `ON CONFLICT` vs `ON DUPLICATE KEY` vs `MERGE`
- **Full-text search**: `@@` / `to_tsquery` vs `MATCH ... AGAINST` vs FTS5
- **Stored procedures**: PL/pgSQL vs MySQL Stored Procedures vs T-SQL

In practice it is necessary to use standard SQL as a foundation while also understanding the features specific to the RDBMS you are using. Even when using an ORM, it is important to be able to understand the SQL that is generated.

### Q4: How do I choose between SQL and NoSQL?

| Criterion | SQL (RDBMS) | NoSQL |
|-----------|------------|-------|
| Data structure | Fixed schema, normalized | Flexible/schema-less |
| Consistency | ACID (strong consistency) | BASE (eventual consistency in many cases) |
| Scaling | Primarily vertical scaling | Good at horizontal scaling |
| Queries | Complex JOINs, aggregations | Key-value, document search |
| Suitable for | Business data, accounting, inventory | Logs, cache, IoT, social media |

In actual production, it is common to use both together (e.g., PostgreSQL + Redis + Elasticsearch).

### Q5: What is the most efficient way to learn SQL?

1. **Get your hands dirty first**: Launch SQLite (no setup needed) or PostgreSQL with Docker and actually write queries.
2. **Follow the order**: Learn in sequence — SELECT → WHERE → JOIN → GROUP BY → Subqueries → Window functions.
3. **Practice with real data**: Import public datasets (Kaggle, data.gov, etc.) and analyze them.
4. **Use EXPLAIN**: Get in the habit of checking execution plans.
5. **One problem a day**: Practice daily with LeetCode SQL, HackerRank SQL, etc.

---

## Summary

| Item | Key Point |
|------|-----------|
| The essence of SQL | A declarative data manipulation language based on the relational model. Describes "what you want." |
| Theoretical foundation | Set theory and first-order predicate logic. Codd's 12 rules. |
| Standards | SQL:2023 is the latest. SQL-92 is the widely implemented foundation. Continuously extended. |
| Major RDBMSs | PostgreSQL (general-purpose), MySQL (web), SQLite (embedded), SQL Server/Oracle (enterprise) |
| ACID properties | Atomicity, Consistency, Isolation, Durability. Guarantees the reliability of transactions. |
| SQL classification | DDL (definition) / DML (manipulation) / DCL (control) / TCL (transaction) — four categories. |
| Handling dialects | Base on standard SQL; consciously separate RDBMS-specific features. Abstract with views and procedures. |
| NULL | Three-valued logic (TRUE/FALSE/UNKNOWN). Use `IS NULL`, not `= NULL`. |
| Selection criteria | Scale, team skills, existing infrastructure, license costs, future scalability. |

---

## Next Guides to Read

- [01-crud-operations.md](./01-crud-operations.md) — Details of SELECT/INSERT/UPDATE/DELETE and safe execution patterns
- [02-joins.md](./02-joins.md) — All types of JOINs and when to use each
- [03-aggregation.md](./03-aggregation.md) — Analysis with GROUP BY and aggregate functions
- [00-normalization.md](../02-design/00-normalization.md) — Theory and practice of normalization
- ../../security-fundamentals/docs/00-basics/ — Security fundamentals (including SQL injection prevention)

---

## References

1. Codd, E.F. (1970). "A Relational Model of Data for Large Shared Data Banks". *Communications of the ACM*, 13(6), 377-387.
2. ISO/IEC 9075:2023 — Information technology — Database languages — SQL (latest SQL standard)
3. PostgreSQL Documentation — https://www.postgresql.org/docs/current/
4. Date, C.J. (2019). *SQL and Relational Theory: How to Write Accurate SQL Code*. 3rd Edition. O'Reilly Media.
5. Karwin, B. (2010). *SQL Antipatterns: Avoiding the Pitfalls of Database Programming*. Pragmatic Bookshelf.
6. MySQL Reference Manual — https://dev.mysql.com/doc/refman/8.0/en/
7. SQLite Documentation — https://www.sqlite.org/docs.html
8. Celko, J. (2010). *Joe Celko's SQL for Smarties: Advanced SQL Programming*. 4th Edition. Morgan Kaufmann.

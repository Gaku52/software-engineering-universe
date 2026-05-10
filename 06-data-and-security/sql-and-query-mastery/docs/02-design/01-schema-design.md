# Schema Design — ER Diagrams, Constraints, and Partitioning

> Schema design determines the backbone of a database. The quality of table structures, constraints, and relationship designs directly affects the reliability and performance of the entire application.

## What You Will Learn

1. Reading and writing ER diagrams and relationship types (1:1, 1:N, M:N)
2. Proper use of constraints (PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK, NOT NULL)
3. Partitioning strategies for managing large-scale tables
4. Comparison and selection criteria for primary key strategies (SERIAL, UUID, ULID)
5. Best practices and common patterns for table design

## Prerequisites

- Basic SQL syntax (CREATE TABLE, ALTER TABLE)
- Normalization theory from [00-normalization.md](./00-normalization.md)
- Foundational concepts of the relational model

---

## 1. ER Diagrams and Relationships

### 1.1 Basic ER Diagram Notation

```
┌─────────────── ER図 (Entity-Relationship Diagram) ───────────────┐
│                                                                   │
│  ┌───────────────┐     1:N     ┌──────────────┐                 │
│  │  departments  │────────────│  employees   │                  │
│  ├───────────────┤             ├──────────────┤                 │
│  │ PK id         │             │ PK id        │                 │
│  │    name       │             │ FK dept_id   │──┐              │
│  │    location   │             │    name      │  │              │
│  └───────────────┘             │    salary    │  │              │
│                                 │    email     │  │              │
│                                 └──────────────┘  │              │
│                                                    │ M:N         │
│  ┌───────────────┐     1:1     ┌──────────────┐  │              │
│  │  user_profiles│────────────│  users       │  │              │
│  ├───────────────┤             ├──────────────┤  │              │
│  │ PK/FK user_id │             │ PK id        │  │              │
│  │    bio        │             │    username  │  │              │
│  │    avatar_url │             │    password  │  │              │
│  └───────────────┘             └──────────────┘  │              │
│                                                    │              │
│  ┌───────────────┐             ┌──────────────┐  │              │
│  │  projects     │             │ emp_projects │◀─┘              │
│  ├───────────────┤     M:N     ├──────────────┤                 │
│  │ PK id         │────────────│ PK emp_id    │                 │
│  │    name       │             │ PK proj_id   │                 │
│  │    deadline   │             │    role      │                 │
│  └───────────────┘             └──────────────┘                 │
│                                 Junction Table                    │
└───────────────────────────────────────────────────────────────────┘
```

### 1.2 Comparison of Major ER Diagram Notations

```
┌──────── ER Diagram Notation Styles ──────────────────┐
│                                                        │
│  Chen Notation (Academic):                             │
│  ┌──────┐    ◇     ┌──────┐                          │
│  │Employee│──<Belongs>──│Dept  │                      │
│  └──────┘    ◇     └──────┘                          │
│  Entity=□  Relationship=◇  Attribute=○               │
│                                                        │
│  IE Notation (Information Engineering):                │
│  ┌──────┐ ──||──< ┌──────┐                           │
│  │ Dept │          │Employee│                         │
│  └──────┘          └──────┘                           │
│  ||=1  <=Many  O=0(Optional)                          │
│                                                        │
│  UML Notation:                                         │
│  ┌──────┐  1..1     0..* ┌──────┐                    │
│  │ Dept │────────────────│Employee│                   │
│  └──────┘                └──────┘                    │
│  Multiplicity expressed as numbers                    │
│                                                        │
│  In practice, IE notation (crow's foot) is most common│
└────────────────────────────────────────────────────────┘
```

### Code Example 1: Implementing Relationships

```sql
-- 1:1 Relation
-- Implementation pattern: shared primary key (FK = PK)
CREATE TABLE users (
    id       SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email    VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE user_profiles (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    bio        TEXT,
    avatar_url VARCHAR(500),
    birthdate  DATE,
    -- user_id is both PK and FK → enforces 1:1
    -- ON DELETE CASCADE → deletes profile when user is deleted
    CONSTRAINT chk_birthdate CHECK (birthdate <= CURRENT_DATE)
);

-- 1:1 Relation: alternative pattern (UNIQUE FK)
CREATE TABLE user_settings (
    id       SERIAL PRIMARY KEY,
    user_id  INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- UNIQUE constraint prevents duplicate user_id → achieves 1:1
    theme    VARCHAR(20) DEFAULT 'light',
    language VARCHAR(10) DEFAULT 'ja',
    notifications_enabled BOOLEAN DEFAULT TRUE
);

-- 1:N Relation
CREATE TABLE departments (
    id       SERIAL PRIMARY KEY,
    name     VARCHAR(100) NOT NULL,
    location VARCHAR(100),
    -- Unique constraint on department code
    code     VARCHAR(10) UNIQUE NOT NULL
);

CREATE TABLE employees (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    salary        DECIMAL(10, 2) CHECK (salary >= 0),
    hired_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    email         VARCHAR(255) UNIQUE NOT NULL,
    -- Partial index: email uniqueness for active employees
    is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

-- Partial unique index (PostgreSQL)
CREATE UNIQUE INDEX idx_active_employees_email
    ON employees (email) WHERE is_active = TRUE;

-- M:N Relation (junction table)
CREATE TABLE projects (
    id       SERIAL PRIMARY KEY,
    name     VARCHAR(200) NOT NULL,
    deadline DATE,
    status   VARCHAR(20) NOT NULL DEFAULT 'planning'
             CHECK (status IN ('planning', 'active', 'completed', 'cancelled'))
);

CREATE TABLE employee_projects (
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    role        VARCHAR(50) DEFAULT 'member',
    joined_at   DATE NOT NULL DEFAULT CURRENT_DATE,
    left_at     DATE,
    PRIMARY KEY (employee_id, project_id),
    -- Period constraint: departure date must be on or after join date
    CONSTRAINT chk_dates CHECK (left_at IS NULL OR left_at >= joined_at)
);

-- Self-referencing relation (manager-subordinate)
CREATE TABLE employees_hierarchy (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    manager_id INTEGER REFERENCES employees_hierarchy(id) ON DELETE SET NULL,
    level      INTEGER NOT NULL DEFAULT 0
);

-- Query to view self-referencing tree structure
WITH RECURSIVE hierarchy AS (
    SELECT id, name, manager_id, 0 AS depth
    FROM employees_hierarchy WHERE manager_id IS NULL
    UNION ALL
    SELECT e.id, e.name, e.manager_id, h.depth + 1
    FROM employees_hierarchy e
    JOIN hierarchy h ON e.manager_id = h.id
)
SELECT REPEAT('  ', depth) || name AS org_chart FROM hierarchy ORDER BY depth;
```

### 1.3 Designing Relationship Cardinality

```
┌──── Cardinality Design Decision Flow ──────────────┐
│                                                      │
│  Q: What is the relationship between Entity A and B? │
│  │                                                  │
│  ├── How many B records per A record?               │
│  │   ├── Always one → 1:1 (consider merging)       │
│  │   ├── Zero or one → 1:0..1 (separate table)     │
│  │   └── Multiple possible → 1:N or M:N            │
│  │                                                  │
│  ├── What about the reverse direction from B to A?  │
│  │   ├── One B record relates to one A → 1:N       │
│  │   └── One B record relates to multiple A → M:N  │
│  │                                                  │
│  └── For M:N: does the junction table have attrs?   │
│      ├── Yes → junction table with attributes       │
│      └── No  → pure join table                      │
│                                                      │
│  Additional decisions for 1:1:                       │
│  ├── Both required → consider merging               │
│  ├── One is optional → separate into another table  │
│  └── Different access patterns → separate table     │
└──────────────────────────────────────────────────────┘
```

---

## 2. Constraints

### 2.1 Internal Behavior of Constraints

```
┌──────── Relationship Between Constraints and Indexes ──────────────┐
│                                                                      │
│  PRIMARY KEY:                                                        │
│  → Automatically creates a UNIQUE index                             │
│  → NOT NULL is implicitly applied                                   │
│  → PostgreSQL: B-Tree index                                         │
│  → InnoDB: clustered index                                          │
│                                                                      │
│  UNIQUE:                                                             │
│  → Automatically creates a UNIQUE index                             │
│  → NULLs are allowed (multiple NULLs possible)                     │
│  → PostgreSQL: NULLs are excluded from uniqueness checks            │
│  → SQL Server: only one NULL allowed (default)                      │
│                                                                      │
│  FOREIGN KEY:                                                        │
│  → Index is NOT created automatically                               │
│  → Strongly recommended to create indexes manually                  │
│  → Checks for referenced record existence on INSERT/UPDATE          │
│  → Checks for referencing records on DELETE                         │
│                                                                      │
│  CHECK:                                                              │
│  → No index is created                                              │
│  → Condition is evaluated on INSERT/UPDATE                          │
│  → PostgreSQL allows function calls in conditions                   │
└──────────────────────────────────────────────────────────────────────┘
```

### Code Example 2: Using Various Constraints

```sql
-- NOT NULL: prohibit NULLs
-- UNIQUE: prohibit duplicates
-- CHECK: value range constraints
-- DEFAULT: default values
-- REFERENCES: foreign key constraint

CREATE TABLE orders (
    id              SERIAL PRIMARY KEY,
    customer_id     INTEGER NOT NULL REFERENCES customers(id),
    order_number    VARCHAR(20) UNIQUE NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'shipped',
                                      'delivered', 'cancelled')),
    total_amount    DECIMAL(12, 2) NOT NULL CHECK (total_amount >= 0),
    discount_rate   DECIMAL(3, 2) DEFAULT 0.00
                    CHECK (discount_rate BETWEEN 0 AND 1),
    order_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    shipped_date    DATE,
    delivered_date  DATE,

    -- Table-level constraints (spanning multiple columns)
    CONSTRAINT chk_dates CHECK (
        shipped_date IS NULL OR shipped_date >= order_date
    ),
    CONSTRAINT chk_delivery CHECK (
        delivered_date IS NULL OR delivered_date >= shipped_date
    ),
    -- Status transition constraint (simplified)
    CONSTRAINT chk_status_dates CHECK (
        (status = 'shipped' AND shipped_date IS NOT NULL)
        OR (status != 'shipped')
    )
);

-- Exclusion constraint (PostgreSQL: prevent overlapping periods)
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- required for exclusion constraints

CREATE TABLE reservations (
    id        SERIAL PRIMARY KEY,
    room_id   INTEGER NOT NULL,
    guest     VARCHAR(100),
    period    DATERANGE NOT NULL,
    EXCLUDE USING GIST (
        room_id WITH =,
        period WITH &&  -- prevent overlapping periods for the same room
    )
);

-- Verify exclusion constraint behavior
INSERT INTO reservations (room_id, guest, period)
VALUES (101, 'Tanaka', '[2024-03-01, 2024-03-05)');

-- Overlapping reservation is rejected
INSERT INTO reservations (room_id, guest, period)
VALUES (101, 'Suzuki', '[2024-03-03, 2024-03-07)');
-- → ERROR: conflicting key value violates exclusion constraint

-- Different room can be reserved
INSERT INTO reservations (room_id, guest, period)
VALUES (102, 'Suzuki', '[2024-03-03, 2024-03-07)');
-- → succeeds

-- Using composite unique constraints
CREATE TABLE subscriptions (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    plan_id     INTEGER NOT NULL REFERENCES plans(id),
    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at    TIMESTAMPTZ,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    -- Same user can have only one active subscription per plan
    CONSTRAINT uq_active_subscription UNIQUE (user_id, plan_id, is_active)
    -- Note: duplicates with is_active=FALSE are allowed
);

-- Conditional unique (PostgreSQL: partial unique index)
CREATE UNIQUE INDEX idx_active_subscription
    ON subscriptions (user_id, plan_id)
    WHERE is_active = TRUE;
-- → unique constraint applies only to active subscriptions
```

### Code Example 3: Foreign Key Reference Actions

```sql
-- ON DELETE / ON UPDATE options
CREATE TABLE order_items (
    id         SERIAL PRIMARY KEY,
    order_id   INTEGER NOT NULL
               REFERENCES orders(id)
               ON DELETE CASCADE      -- on parent delete: delete children too
               ON UPDATE CASCADE,     -- on parent update: update children too
    product_id INTEGER NOT NULL
               REFERENCES products(id)
               ON DELETE RESTRICT,    -- on parent delete: error if children exist
    quantity   INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL
);

-- Reference action summary:
-- CASCADE    : follow the parent (delete/update)
-- RESTRICT   : reject parent operation if children exist (immediate check)
-- NO ACTION  : reject parent operation if children exist (deferred check possible) ※default
-- SET NULL   : set child FK column to NULL
-- SET DEFAULT: set child FK column to its DEFAULT value
```

### 2.2 Choosing the Right Reference Action

```
┌──── Reference Action Selection Guide ──────────────┐
│                                                      │
│  CASCADE:                                            │
│  ├── Use: parent and child are tightly coupled       │
│  │        (e.g., order - order items)               │
│  ├── Use: ownership relationship (user - profile)   │
│  └── Caution: performance impact on bulk deletes    │
│                                                      │
│  RESTRICT / NO ACTION:                               │
│  ├── Use: when strict referential integrity needed   │
│  ├── Use: to prevent accidental parent deletion     │
│  └── Diff: RESTRICT is immediate, NO ACTION deferred│
│                                                      │
│  SET NULL:                                           │
│  ├── Use: children can exist without a parent       │
│  ├── Example: employee-dept (dept gone, emp stays)  │
│  └── Requires: FK column must be NULLable           │
│                                                      │
│  SET DEFAULT:                                        │
│  ├── Use: when reverting to a default value         │
│  ├── Example: set to "uncategorized" on cat. delete │
│  └── Requires: DEFAULT value must be a valid ref    │
└──────────────────────────────────────────────────────┘
```

### Code Example 4: Deferred Constraints

```sql
-- Deferred constraint check: evaluated at transaction end
CREATE TABLE categories (
    id        SERIAL PRIMARY KEY,
    name      VARCHAR(100) NOT NULL,
    parent_id INTEGER REFERENCES categories(id)
              DEFERRABLE INITIALLY DEFERRED
);

-- Allows mutual references while avoiding circular reference errors
BEGIN;
INSERT INTO categories (id, name, parent_id) VALUES (1, 'Root', NULL);
INSERT INTO categories (id, name, parent_id) VALUES (2, 'Child', 1);
-- parent_id=1 already exists, so no issue

-- With deferred constraints, the following is also possible:
-- INSERT INTO categories VALUES (10, 'A', 20);  -- 20 doesn't exist yet
-- INSERT INTO categories VALUES (20, 'B', 10);  -- 10 was inserted above
-- COMMIT; -- FK constraint is checked here for the first time
COMMIT;
```

---

## 3. Partitioning

### 3.1 Criteria for Introducing Partitioning

```
┌──── Decision Criteria for Introducing Partitioning ──────────────┐
│                                                                    │
│  Conditions to introduce:                                          │
│  ├── Table size is hundreds of GB or more                         │
│  ├── Tables exceeding hundreds of millions of rows                │
│  ├── Time-series data with frequent deletion/archiving of old data│
│  ├── Queries are mostly limited to specific ranges                │
│  └── VACUUM or ANALYZE takes too long                             │
│                                                                    │
│  Conditions NOT to introduce:                                      │
│  ├── Table size is a few GB or less                               │
│  ├── Queries span all partitions                                   │
│  ├── Difficult to select a partition key                          │
│  └── Operational costs (partition management) not worth it        │
│                                                                    │
│  Recommended number of partitions:                                 │
│  ├── 10-100 partitions: optimal                                   │
│  ├── 100-1000: caution required (increased planning time)         │
│  └── 1000+: not recommended (performance degradation)             │
└────────────────────────────────────────────────────────────────────┘
```

### Code Example 5: Table Partitioning

```sql
-- Range partitioning (date-based)
CREATE TABLE access_logs (
    id         BIGSERIAL,
    user_id    INTEGER,
    action     VARCHAR(50),
    ip_address INET,
    created_at TIMESTAMP NOT NULL,
    -- For partitioned tables, the PK must include the partition key
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE access_logs_2024_01
    PARTITION OF access_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE access_logs_2024_02
    PARTITION OF access_logs
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Default partition (accepts out-of-range data)
CREATE TABLE access_logs_default
    PARTITION OF access_logs DEFAULT;

-- Automated partition creation script (PostgreSQL: using a function)
CREATE OR REPLACE FUNCTION create_monthly_partition(
    table_name TEXT,
    year INTEGER,
    month INTEGER
) RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    partition_name := format('%s_%s_%s', table_name, year,
                            LPAD(month::TEXT, 2, '0'));
    start_date := make_date(year, month, 1);
    end_date := start_date + INTERVAL '1 month';

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I
         FOR VALUES FROM (%L) TO (%L)',
        partition_name, table_name, start_date, end_date
    );
END;
$$ LANGUAGE plpgsql;

-- Example: create all 12 months of 2024 at once
SELECT create_monthly_partition('access_logs', 2024, m)
FROM generate_series(1, 12) AS m;

-- List partitioning (region-based)
CREATE TABLE sales (
    id     SERIAL,
    region VARCHAR(20) NOT NULL,
    amount DECIMAL(10,2),
    date   DATE,
    PRIMARY KEY (id, region)
) PARTITION BY LIST (region);

CREATE TABLE sales_japan PARTITION OF sales
    FOR VALUES IN ('tokyo', 'osaka', 'nagoya');
CREATE TABLE sales_asia PARTITION OF sales
    FOR VALUES IN ('seoul', 'taipei', 'singapore');
CREATE TABLE sales_default PARTITION OF sales DEFAULT;

-- Hash partitioning (uniform distribution)
CREATE TABLE events (
    id      BIGSERIAL,
    user_id INTEGER NOT NULL,
    data    JSONB,
    PRIMARY KEY (id, user_id)
) PARTITION BY HASH (user_id);

CREATE TABLE events_0 PARTITION OF events FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE events_1 PARTITION OF events FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE events_2 PARTITION OF events FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE events_3 PARTITION OF events FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- Verify partition pruning
EXPLAIN ANALYZE
SELECT * FROM access_logs WHERE created_at >= '2024-03-01' AND created_at < '2024-04-01';
-- → only access_logs_2024_03 is scanned
```

### Partitioning Structure

```
┌──────── Types of Partitioning ────────────┐
│                                            │
│  RANGE                                     │
│  ┌──────┬──────┬──────┬──────┐            │
│  │ Jan  │ Feb  │ Mar  │ ...  │            │
│  └──────┴──────┴──────┴──────┘            │
│  Split by date or numeric range            │
│  Use case: time-series data, logs,         │
│            transaction history             │
│                                            │
│  LIST                                      │
│  ┌──────┬──────┬──────┐                   │
│  │Japan │Korea │Taiwan│                   │
│  └──────┴──────┴──────┘                   │
│  Split by discrete values                  │
│  Use case: by region, category, status     │
│                                            │
│  HASH                                      │
│  ┌──────┬──────┬──────┬──────┐            │
│  │ mod0 │ mod1 │ mod2 │ mod3 │            │
│  └──────┴──────┴──────┴──────┘            │
│  Even distribution by hash value           │
│  Use case: even distribution required,     │
│            no specific range condition     │
│                                            │
│  * Partition Pruning:                      │
│    Partitions not matching query conditions│
│    are automatically skipped → significant │
│    performance improvement                 │
└────────────────────────────────────────────┘
```

### 3.2 Operational Management of Partitions

```sql
-- Delete old partition (DROP: executes instantly)
DROP TABLE access_logs_2023_01;

-- Detach a partition (keeps the table)
ALTER TABLE access_logs DETACH PARTITION access_logs_2023_01;

-- Rename the detached table to an archive table
ALTER TABLE access_logs_2023_01 RENAME TO access_logs_archive_2023_01;

-- Check partition statistics
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size,
    n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE tablename LIKE 'access_logs_%'
ORDER BY tablename;
```

---

## 4. Primary Key Strategies

### Code Example 6: Primary Key Design Patterns

```sql
-- 1. Natural key: a key with business meaning
CREATE TABLE countries (
    code CHAR(2) PRIMARY KEY,   -- ISO 3166-1 alpha-2
    name VARCHAR(100) NOT NULL
);

-- 2. Surrogate key: an artificially generated sequential ID
CREATE TABLE products (
    id   SERIAL PRIMARY KEY,    -- surrogate key
    sku  VARCHAR(20) UNIQUE NOT NULL,  -- natural key (business identifier)
    name VARCHAR(200) NOT NULL
);

-- Difference between SERIAL and IDENTITY (PostgreSQL 10+)
CREATE TABLE products_v2 (
    -- IDENTITY column (SQL standard, recommended)
    id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(200) NOT NULL
);
-- GENERATED ALWAYS: rejects manual ID specification (safer)
-- GENERATED BY DEFAULT: also allows manual specification

-- 3. UUID: for distributed systems
CREATE TABLE events (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    payload    JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- UUID v7: time-sortable (PostgreSQL 17+ or app-generated)
-- UUID v7 format:
-- ┌─────────────────────┬──────┬───────────────────┐
-- │  48bit timestamp    │ ver  │  74bit random      │
-- └─────────────────────┴──────┴───────────────────┘
-- → sortable by timestamp, favorable for B-Tree

-- 4. ULID: time-sortable UUID alternative
-- Typically generated on the application side
-- In PostgreSQL, use an extension or store as text
CREATE TABLE activities (
    id         CHAR(26) PRIMARY KEY,  -- ULID (Base32 encoded, 26 chars)
    action     VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Composite key: used in junction tables
CREATE TABLE user_roles (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);
```

### Primary Key Strategy Selection Flow

```
┌──── Primary Key Strategy Selection ──────────────────────────┐
│                                                               │
│  Q: Distributed system or microservices?                      │
│  │                                                           │
│  ├── Yes                                                      │
│  │   Q: Is time-sortability required?                        │
│  │   ├── Yes → UUID v7 or ULID                              │
│  │   └── No  → UUID v4                                      │
│  │                                                           │
│  └── No (single DB)                                          │
│      Q: Is the ID exposed externally?                        │
│      ├── Yes → UUID (hard to guess)                          │
│      └── No                                                   │
│          Q: Is performance the top priority?                  │
│          ├── Yes → SERIAL/IDENTITY (fastest)                 │
│          └── No  → SERIAL/IDENTITY                           │
│                                                               │
│  Exceptions:                                                  │
│  ├── ISO standard codes → natural key (country codes, etc.)  │
│  ├── Junction tables → composite key                         │
│  └── Event sourcing → UUID v7 / ULID                         │
└───────────────────────────────────────────────────────────────┘
```

---

## 5. Table Design Best Practices

### Code Example 7: Recommended Table Structure

```sql
-- Recommended table structure
CREATE TABLE articles (
    -- Primary key
    id          BIGSERIAL PRIMARY KEY,

    -- Business data
    title       VARCHAR(500) NOT NULL,
    slug        VARCHAR(500) UNIQUE NOT NULL,
    body        TEXT NOT NULL,
    excerpt     VARCHAR(1000),
    status      VARCHAR(20) NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'published', 'archived')),

    -- Relations
    author_id   INTEGER NOT NULL REFERENCES users(id),
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,

    -- Metadata
    tags        TEXT[] DEFAULT '{}',
    metadata    JSONB DEFAULT '{}',

    -- Audit columns (common to all tables)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ,  -- for soft deletes

    -- Index
    CONSTRAINT articles_slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

-- Trigger to auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_articles_updated_at
    BEFORE UPDATE ON articles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Soft delete pattern with logical deletion
-- View that excludes deleted records
CREATE VIEW active_articles AS
SELECT * FROM articles WHERE deleted_at IS NULL;

-- Soft delete function
CREATE OR REPLACE FUNCTION soft_delete_article(article_id BIGINT)
RETURNS VOID AS $$
BEGIN
    UPDATE articles SET deleted_at = NOW() WHERE id = article_id;
END;
$$ LANGUAGE plpgsql;

-- Index design
CREATE INDEX idx_articles_author ON articles (author_id);
CREATE INDEX idx_articles_category ON articles (category_id);
CREATE INDEX idx_articles_status ON articles (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_articles_created ON articles (created_at DESC);
CREATE INDEX idx_articles_tags ON articles USING GIN (tags);
CREATE INDEX idx_articles_metadata ON articles USING GIN (metadata);
```

### Code Example 8: Common Pattern — Audit Table

```sql
-- Audit table (recording change history)
CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    table_name  VARCHAR(100) NOT NULL,
    record_id   TEXT NOT NULL,
    action      VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data    JSONB,
    new_data    JSONB,
    changed_by  INTEGER REFERENCES users(id),
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address  INET
) PARTITION BY RANGE (changed_at);

-- Generic audit trigger
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, record_id, action, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id::TEXT, 'INSERT', row_to_json(NEW)::JSONB,
                current_setting('app.current_user_id', TRUE)::INTEGER);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id::TEXT, 'UPDATE',
                row_to_json(OLD)::JSONB, row_to_json(NEW)::JSONB,
                current_setting('app.current_user_id', TRUE)::INTEGER);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, record_id, action, old_data, changed_by)
        VALUES (TG_TABLE_NAME, OLD.id::TEXT, 'DELETE', row_to_json(OLD)::JSONB,
                current_setting('app.current_user_id', TRUE)::INTEGER);
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply auditing to the articles table
CREATE TRIGGER trg_articles_audit
    AFTER INSERT OR UPDATE OR DELETE ON articles
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
```

---

## Relationship Type Comparison Table

| Type | Implementation | Example | FK Placement | Index |
|------|---------------|---------|--------------|-------|
| 1:1 | Shared primary key or UNIQUE FK | User - Profile | Child table | PK (automatic) |
| 1:N | FK in child table | Department - Employee | Child table (N side) | Create manually on FK column |
| M:N | Junction table | Employee - Project | Junction table | Composite PK + individual FKs |
| Self-referencing | FK in same table | Employee - Manager | Same table | Create manually on FK column |
| Polymorphic | Type discriminator column + FK | Comment - Various entities | Use with care | Composite of type + ID |

## Primary Key Strategy Comparison Table

| Method | Size | Advantages | Disadvantages | Best For | B-Tree Efficiency |
|--------|------|-----------|---------------|----------|-------------------|
| SERIAL/IDENTITY | 4/8 byte | Simple, fast, memory-efficient | Not distributed, guessable | Single DB | Highest |
| UUID v4 | 16 byte | Distributed generation, hard to guess | Not sortable, index fragmentation | Distributed systems | Low |
| UUID v7 | 16 byte | Time-sortable, distributed | Requires PostgreSQL 17+ | Event-driven | High |
| ULID | 16 byte | Time-sortable, distributed | Non-standard in DB | Event sourcing | High |
| Natural key | Variable | Has business meaning | Risk of change, long | ISO standard codes | Medium |
| Composite key | Variable | Faithful to normalization | Complex JOINs | Junction tables | Medium |

## Partition Feature Comparison Table Across RDBMSs

| Feature | PostgreSQL | MySQL (InnoDB) | Oracle | SQL Server |
|---------|-----------|----------------|--------|------------|
| RANGE | ✓ (10+) | ✓ | ✓ | ✓ |
| LIST | ✓ (10+) | ✓ | ✓ | ✗ (use CHECK constraint) |
| HASH | ✓ (11+) | ✓ | ✓ | ✗ |
| Sub-partitioning | ✓ (manual) | ✓ | ✓ | ✗ |
| DEFAULT partition | ✓ (11+) | ✗ | ✗ | ✗ |
| Auto partitioning | ✗ (pg_partman) | ✗ | ✓ (Interval) | ✓ (Sliding Window) |
| Partition pruning | ✓ | ✓ | ✓ | ✓ |
| DETACH CONCURRENTLY | ✓ (14+) | ✗ | ✗ | ✗ |
| Global index | ✗ | ✗ | ✓ | ✓ |

---

## Anti-Patterns

### Anti-Pattern 1: Improper Implementation of Polymorphic Associations

```sql
-- NG: FK target varies by type (cannot use foreign key constraints)
CREATE TABLE comments (
    id              SERIAL PRIMARY KEY,
    commentable_type VARCHAR(50),   -- 'article' or 'product' or 'video'
    commentable_id   INTEGER,       -- FK target is unknown
    body            TEXT
);
-- → cannot add REFERENCES to commentable_id
-- → referential integrity depends on the application layer

-- OK: use dedicated junction tables
CREATE TABLE comments (
    id   SERIAL PRIMARY KEY,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE article_comments (
    comment_id INTEGER PRIMARY KEY REFERENCES comments(id) ON DELETE CASCADE,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE
);
CREATE TABLE product_comments (
    comment_id INTEGER PRIMARY KEY REFERENCES comments(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE
);

-- OK: exclusive relation (PostgreSQL CHECK constraint)
CREATE TABLE comments_v2 (
    id          SERIAL PRIMARY KEY,
    body        TEXT NOT NULL,
    article_id  INTEGER REFERENCES articles(id) ON DELETE CASCADE,
    product_id  INTEGER REFERENCES products(id) ON DELETE CASCADE,
    video_id    INTEGER REFERENCES videos(id) ON DELETE CASCADE,
    -- exactly one must be NOT NULL
    CONSTRAINT chk_exclusive CHECK (
        (article_id IS NOT NULL)::INTEGER +
        (product_id IS NOT NULL)::INTEGER +
        (video_id IS NOT NULL)::INTEGER = 1
    )
);
```

### Anti-Pattern 2: Insufficient Constraints

```sql
-- NG: table without constraints
CREATE TABLE users (
    id    SERIAL,
    email TEXT,
    age   INTEGER
);
-- → duplicate emails, NULLs, negative ages, and invalid formats are all allowed

-- OK: set appropriate constraints
CREATE TABLE users (
    id    SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE
          CHECK (email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'),
    age   INTEGER CHECK (age BETWEEN 0 AND 200)
);
```

### Anti-Pattern 3: FK Without an Index

```sql
-- NG: no index on FK column
CREATE TABLE orders (
    id          SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id)
    -- no index on customer_id
    -- → slow JOINs and DELETEs
);

-- OK: create an index on the FK column
CREATE TABLE orders (
    id          SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id)
);
CREATE INDEX idx_orders_customer ON orders (customer_id);
-- → fast lookup on orders side when deleting customers.id
-- → JOIN also benefits from index usage
```

---

## Edge Cases

### Edge Case 1: Circular References

```sql
-- Example of circular reference: setting a "current leader" for a department
-- employees → departments (belongs to) and departments → employees (leader)
CREATE TABLE departments (
    id        SERIAL PRIMARY KEY,
    name      VARCHAR(100) NOT NULL,
    leader_id INTEGER  -- FK to be added later
);

CREATE TABLE employees (
    id      SERIAL PRIMARY KEY,
    name    VARCHAR(100) NOT NULL,
    dept_id INTEGER REFERENCES departments(id)
);

-- Circular FK
ALTER TABLE departments ADD CONSTRAINT fk_leader
    FOREIGN KEY (leader_id) REFERENCES employees(id)
    DEFERRABLE INITIALLY DEFERRED;

-- Use deferred constraints for insertion
BEGIN;
INSERT INTO departments (id, name) VALUES (1, 'Engineering');
INSERT INTO employees (id, name, dept_id) VALUES (1, 'Tanaka', 1);
UPDATE departments SET leader_id = 1 WHERE id = 1;
COMMIT;
```

### Edge Case 2: Temporarily Disabling Constraints During Bulk Loads

```sql
-- Temporarily disable FK constraints during large data loads
-- PostgreSQL:
ALTER TABLE order_items DISABLE TRIGGER ALL;

-- Load data
COPY order_items FROM '/data/order_items.csv' CSV HEADER;

-- Re-enable constraints
ALTER TABLE order_items ENABLE TRIGGER ALL;

-- Manually verify data integrity
SELECT oi.id FROM order_items oi
LEFT JOIN orders o ON oi.order_id = o.id
WHERE o.id IS NULL;
-- → confirm 0 rows returned
```

### Edge Case 3: Multi-Tenant Schema Design

```sql
-- Method 1: row-level isolation (all tenants in one table)
CREATE TABLE tenant_users (
    id        SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name      VARCHAR(100) NOT NULL,
    email     VARCHAR(255) NOT NULL,
    UNIQUE (tenant_id, email)  -- email uniqueness within each tenant
);

-- Automatic filtering with RLS
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenant_users
    USING (tenant_id = current_setting('app.tenant_id')::INTEGER);

-- Method 2: schema isolation (one schema per tenant)
CREATE SCHEMA tenant_001;
CREATE TABLE tenant_001.users (...);
-- Advantages: complete isolation, easy tenant deletion
-- Disadvantages: schema management becomes difficult with many tenants
```

---

## Exercises

### Exercise 1 (Basic): E-commerce Schema Design

Create an ERD and CREATE TABLE statements that satisfy the following requirements.

**Requirements**:
- Customers, products, orders, and order items
- Customers can have multiple shipping addresses
- Products belong to categories (categories have a hierarchical structure)
- Manage order status transitions
- Audit columns on all tables

### Exercise 2 (Applied): Partition Design

Design monthly partitioning for an access log table with 100 million rows. Include an archiving strategy for data older than one year.

### Exercise 3 (Advanced): Multi-Tenant Schema

Design a multi-tenant schema for a SaaS application using three approaches (row-level, schema-level, DB-level) and analyze the trade-offs.


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
    """Exercise for basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main logic for data processing"""
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
        assert False, "Exception should be raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Applied Pattern

Extend the basic implementation to add the following features.

```python
# Exercise 2: Applied pattern
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

    print(f"Slow version:  {slow_time:.4f}s")
    print(f"Fast version:  {fast_time:.6f}s")
    print(f"Speedup ratio: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key points:**
- Be aware of algorithmic complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | When to prioritize | When to compromise |
|-----------|-------------------|-------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow             │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① What is the team size?                        │
│    ├─ Small (1-5 people) → Monolith              │
│    └─ Large (10+ people) → Go to ②              │
│                                                 │
│  ② How often do you deploy?                      │
│    ├─ Weekly or less → Monolith + module split   │
│    └─ Daily/multiple times → Go to ③            │
│                                                 │
│  ③ How independent are the teams?               │
│    ├─ High → Microservices                       │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Every technical decision involves trade-offs. Analyze them from the following perspectives:

**1. Short-term vs. long-term costs**
- A fast short-term approach can become technical debt in the long term
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs. flexibility**
- A unified tech stack has lower learning costs
- Adopting diverse technologies enables the right tool for each job, but increases operational costs

**3. Level of abstraction**
- Higher abstraction increases reusability but can make debugging more difficult
- Lower abstraction is intuitive but tends to lead to code duplication

```python
# Design decision record template
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe background and issues"""
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
        md += f"## Context\n{self.context}\n\n"
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

### Q1: Should I use a surrogate key or a natural key as the primary key?

In most cases, surrogate keys (SERIAL/UUID) are recommended. Natural keys carry a risk of change, and composite keys complicate JOINs. However, stable natural keys such as ISO country codes (JP, US) can be used directly without issue.

### Q2: When should I introduce partitioning?

Consider it when the table size exceeds hundreds of GB or the row count surpasses hundreds of millions. Partitioning enables partition pruning (skipping irrelevant partitions) and allows fast archiving/deletion of old data at the partition level.

### Q3: Do foreign key constraints affect performance?

There is a slight overhead because the existence of the referenced record is verified on INSERT/UPDATE/DELETE. However, the benefit of guaranteed data integrity far outweighs the cost. Temporarily disabling constraints during large bulk loads is an option. Always remember to create indexes on FK columns.

### Q4: Should I use logical deletion or physical deletion?

Use logical deletion (a `deleted_at` column) when audit requirements or data recovery needs exist. However, all queries must include `WHERE deleted_at IS NULL`, which also affects index design. If there is no such requirement, physical deletion is simpler.

### Q5: When should I use a JSONB column?

It is suitable for attributes with frequently changing schemas (variable product specifications, user settings, etc.). However, it should not be used as a substitute for relations. Efficient search is possible with GIN indexes, but data that is the target of JOINs should be designed relationally.

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|---------|
| INSERT fails with FK constraint violation | Referenced record does not exist | Check INSERT order, consider deferred constraints |
| Data does not enter a partition | Out-of-range data | Add a DEFAULT partition |
| UUID INSERTs are slow | Index fragmentation | Consider migrating to UUID v7/ULID |
| UNIQUE constraint violation | Duplicate data | Use ON CONFLICT (UPSERT) |
| CHECK constraint is too complex | Over-specified conditions | Combine with application-layer validation |
| FK DELETE is slow | Missing index on FK column | Create index on FK column |

---

## Security Considerations

```sql
-- Leveraging Row Level Security (RLS)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- General user: can only view their own orders
CREATE POLICY orders_user_policy ON orders
    FOR SELECT
    USING (customer_id = current_setting('app.current_user_id')::INTEGER);

-- Admin: can view all orders
CREATE POLICY orders_admin_policy ON orders
    FOR ALL
    USING (current_setting('app.current_role') = 'admin');

-- Minimize table permissions
GRANT SELECT, INSERT, UPDATE ON orders TO app_user;
-- Do not grant DELETE permission → logical deletion only
REVOKE DELETE ON orders FROM app_user;
```

---

## Summary

| Item | Key Points |
|------|-----------|
| ER Diagram | Visualize relationships between tables. The starting point of design. IE notation is standard. |
| Relations | Implement 1:1, 1:N, M:N correctly. Also handle self-referencing and polymorphic. |
| Constraints | Ensure integrity with NOT NULL, UNIQUE, CHECK, FK. Also leverage exclusion constraints. |
| Reference Actions | Choose CASCADE, RESTRICT, SET NULL appropriately. |
| Primary Key | SERIAL (single DB) / UUID v7 (distributed) recommended. |
| Partitioning | Split large tables with RANGE/LIST/HASH. Operational management is also important. |
| Audit Columns | created_at, updated_at on all tables. Audit triggers for change history. |
| Soft Delete | Managed with deleted_at column + view/RLS. |

---

## Next Guides to Read

- [02-migration.md](./02-migration.md) — Schema change migrations
- [03-data-modeling.md](./03-data-modeling.md) — Data modeling for analytics
- [00-normalization.md](./00-normalization.md) — Normalization theory

---

## References

1. PostgreSQL Documentation — "Table Partitioning" https://www.postgresql.org/docs/current/ddl-partitioning.html
2. Fowler, M. (2002). *Patterns of Enterprise Application Architecture*. Addison-Wesley.
3. Kleppmann, M. (2017). *Designing Data-Intensive Applications*. O'Reilly Media. Chapter 2: Data Models and Query Languages.
4. PostgreSQL Documentation — "Row Security Policies" https://www.postgresql.org/docs/current/ddl-rowsecurity.html
5. Percona Blog — "UUID vs Auto-Increment" https://www.percona.com/blog/
6. Date, C.J. (2019). *Database Design and Relational Theory*. O'Reilly Media.

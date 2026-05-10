# Migration

> A practical guide to version-controlling database schema changes and deploying them safely with zero downtime. This chapter covers everything from the theoretical foundations of migrations to zero-downtime techniques, lock-avoidance strategies, and rollback design required in large-scale production environments.

## Prerequisites

- [01-schema-design.md](./01-schema-design.md) — Fundamentals of schema design
- [03-indexing.md](../01-advanced/03-indexing.md) — Understanding indexes
- [02-transactions.md](../01-advanced/02-transactions.md) — Fundamentals of transactions and locks
- Basic DDL (Data Definition Language) syntax

## What You Will Learn

1. **Migration Basics** — Version control, rollback strategies, tool selection
2. **Zero-Downtime Techniques** — Expand-Contract pattern, online DDL, phased migration
3. **Avoiding Dangerous Operations** — Lock issues, large-scale data migration, ensuring backward compatibility
4. **CI/CD Integration** — Automating migrations, linting, testing strategies
5. **Multi-Environment Management** — Consistency across development/staging/production
6. **RDBMS-Specific Considerations** — Characteristics of PostgreSQL, MySQL, and SQL Server

---

## 1. Core Concepts of Migrations

### Why Migrations Are Necessary

Database schemas change as applications evolve. Without a migration system, the following problems arise.

```
World Without Migrations (Anti-Pattern)
=============================================

Problem 1: Inconsistency Across Environments
  Developer A: ALTER TABLE users ADD COLUMN phone VARCHAR(20);
  Developer B: ALTER TABLE users ADD COLUMN phone VARCHAR(15);  -- Different type!
  Production:  phone column does not exist  -- Migration was never applied

Problem 2: Inability to Roll Back
  DBA: ALTER TABLE orders DROP COLUMN old_status;
  → "Actually, revert that" → Data lost, recovery impossible

Problem 3: Unmanageable Execution Order
  migration_1: ADD COLUMN status
  migration_2: CREATE INDEX ON status
  → If migration_2 runs first, it fails

How a Migration System Solves This:
  ✓ Version numbers guarantee execution order
  ✓ UP/DOWN scripts enable rollback
  ✓ schema_migrations table tracks applied state
  ✓ Same scripts are used across all environments
```

### Migration Lifecycle

```
Migration Lifecycle
=================================

v1 (current)       v2 (target)
+-----------+      +-----------+
| users     |      | users     |
|  id       |  --> |  id       |
|  name     |      |  name     |
|  email    |      |  email    |
+-----------+      |  phone    |  <-- added
                   |  status   |  <-- added
                   +-----------+

Migration files:
  20260211_001_add_phone_to_users.sql
  20260211_002_add_status_to_users.sql

Each file contains UP (apply) and DOWN (rollback) statements

Application flow:
  ┌──────────┐
  │ pending  │ → migrate up → │ applied  │
  └──────────┘                └──────────┘
                                   │
                              migrate down
                                   │
                                   ▼
                              ┌──────────┐
                              │ rolled   │
                              │ back     │
                              └──────────┘
```

### Code Example 1: Comparing and Using Migration Tools

```sql
-- === Flyway Format ===
-- File naming: V{version}__{description}.sql
-- V2__add_phone_to_users.sql
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- For rollback (Flyway Pro/Enterprise only)
-- U2__add_phone_to_users.sql
ALTER TABLE users DROP COLUMN phone;

-- === golang-migrate Format ===
-- 000002_add_phone.up.sql
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- 000002_add_phone.down.sql
ALTER TABLE users DROP COLUMN phone;

-- === Liquibase Format (XML) ===
-- changelog-2.0.xml
-- <changeSet id="2" author="developer">
--   <addColumn tableName="users">
--     <column name="phone" type="VARCHAR(20)"/>
--   </addColumn>
--   <rollback>
--     <dropColumn tableName="users" columnName="phone"/>
--   </rollback>
-- </changeSet>
```

```bash
# Using golang-migrate
# Create a migration
migrate create -ext sql -dir ./migrations -seq add_phone_to_users

# Apply all migrations
migrate -path ./migrations -database "postgres://user:pass@localhost/mydb" up

# Roll back one migration
migrate -path ./migrations -database "postgres://user:pass@localhost/mydb" down 1

# Apply up to a specific version
migrate -path ./migrations -database "postgres://user:pass@localhost/mydb" goto 5

# Check current version
migrate -path ./migrations -database "postgres://user:pass@localhost/mydb" version

# Flyway
flyway -url=jdbc:postgresql://localhost/mydb migrate
flyway -url=jdbc:postgresql://localhost/mydb info
flyway -url=jdbc:postgresql://localhost/mydb validate
flyway -url=jdbc:postgresql://localhost/mydb repair  # Repair metadata
```

### Code Example 2: Migrations with Prisma

```prisma
// schema.prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String
  phone     String?  // newly added
  status    String   @default("active")  // newly added
  createdAt DateTime @default(now())
  orders    Order[]
}

model Order {
  id        Int      @id @default(autoincrement())
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  total     Decimal
  status    String   @default("pending")
  createdAt DateTime @default(now())
}
```

```bash
# Generate migration (development environment)
npx prisma migrate dev --name add_phone_and_status
# → prisma/migrations/20260211_add_phone_and_status/migration.sql is generated

# Apply to production (inside CI/CD pipeline)
npx prisma migrate deploy

# Check status
npx prisma migrate status

# Reset migrations (development environment only)
npx prisma migrate reset

# Check schema diff
npx prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datasource prisma/schema.prisma
```

### Migration Tool Comparison

| Tool | Language/Ecosystem | Approach | Rollback | Declarative | Notes |
|--------|------------------|------|------------|--------|------|
| Flyway | Java/JVM | SQL/Java | Pro only | No | Proven enterprise track record |
| Liquibase | Java/JVM | XML/YAML/SQL | Yes | Yes | Multi-format, diff detection |
| golang-migrate | Go | SQL | Yes | No | Simple, lightweight |
| Prisma Migrate | TypeScript | Auto-generated SQL | No | Yes | ORM integration, type-safe |
| Alembic | Python | Python/SQL | Yes | No | SQLAlchemy integration |
| Atlas | Go | HCL/SQL | Yes | Yes | Both declarative and imperative |
| Sqitch | Perl | SQL | Yes | No | Dependency-based |
| Knex.js | JavaScript | JavaScript | Yes | No | Node.js integration |

### Imperative vs. Declarative Migrations

```
Imperative Migrations (Traditional)
================================
Developers describe "how" to change

  V1: CREATE TABLE users (id INT, name VARCHAR(100));
  V2: ALTER TABLE users ADD COLUMN email VARCHAR(255);
  V3: CREATE INDEX idx_users_email ON users(email);

  Advantage: Full control over the order and content of changes
  Disadvantage: Written by hand, higher risk of errors

Declarative Migrations (Modern)
================================
Developers describe "what the final state should be"
The tool automatically calculates the diff

  schema.hcl:
    table "users" {
      column "id" { type = int }
      column "name" { type = varchar(100) }
      column "email" { type = varchar(255) }
      index "idx_users_email" { columns = [column.email] }
    }

  Tool: diff → ALTER TABLE ADD COLUMN email ...
                → CREATE INDEX idx_users_email ...

  Advantage: Declarative and readable, automatic diff calculation
  Disadvantage: Complex migrations (data transformations, etc.) are hard to express
```

---

## 2. Zero-Downtime Migrations

### Expand-Contract Pattern

```
Expand-Contract Pattern
==========================

Phase 1: Expand
  - Add new columns/tables
  - Support both old and new formats
  - App writes to both old and new

Phase 2: Migrate
  - Convert existing data in the background
  - Gradually switch access to the new format

Phase 3: Contract
  - Remove old columns/tables
  - Support only the new format

Timeline:
  Expand       Migrate      Contract
  [+col]       [data]       [-col]
  |------------|------------|----------|
  v1 + v2      v2           v2 only

  ← App v1 compatible →← App v2 only →

Safe migration per phase:
  Phase 1: Run migration → Deploy app v2
  Phase 2: Run backfill job (async)
  Phase 3: Migration to drop old column
  * Allow sufficient monitoring time between each phase
```

### Code Example 3: Zero-Downtime Column Rename

```sql
-- [BAD] Direct rename --> causes downtime
ALTER TABLE users RENAME COLUMN name TO full_name;
-- --> Existing app referencing "name" will error

-- [GOOD] Expand-Contract pattern (3 phases)

-- ===== Phase 1: Expand (add new column + trigger) =====
-- Migration: 20260211_001_expand_user_name.sql

ALTER TABLE users ADD COLUMN full_name VARCHAR(255);

-- Copy existing data
UPDATE users SET full_name = name WHERE full_name IS NULL;

-- Bidirectional sync trigger
CREATE OR REPLACE FUNCTION sync_user_name() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.full_name IS NULL THEN
      NEW.full_name := NEW.name;
    ELSIF NEW.name IS NULL THEN
      NEW.name := NEW.full_name;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
      NEW.name := NEW.full_name;
    ELSIF NEW.name IS DISTINCT FROM OLD.name THEN
      NEW.full_name := NEW.name;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_user_name
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION sync_user_name();

-- ===== Phase 2: Deploy App =====
-- Update the app to use full_name and deploy
-- Deploy compatibility code that reads/writes both name and full_name

-- ===== Phase 3: Contract (drop old column and trigger) =====
-- Migration: 20260218_001_contract_user_name.sql
-- (Run after a sufficient monitoring period of at least 1 week)

DROP TRIGGER trg_sync_user_name ON users;
DROP FUNCTION sync_user_name();
ALTER TABLE users DROP COLUMN name;
```

### Code Example 4: Zero-Downtime Table Split

```sql
-- Example of separating profile information from the users table

-- Phase 1: Create new table + sync with trigger
CREATE TABLE user_profiles (
    user_id     INTEGER PRIMARY KEY REFERENCES users(id),
    bio         TEXT,
    avatar_url  VARCHAR(500),
    website     VARCHAR(500),
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- Migrate existing data
INSERT INTO user_profiles (user_id, bio, avatar_url, website)
SELECT id, bio, avatar_url, website
FROM users
WHERE bio IS NOT NULL OR avatar_url IS NOT NULL;

-- Write sync trigger
CREATE OR REPLACE FUNCTION sync_user_profile() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO user_profiles (user_id, bio, avatar_url, website, updated_at)
    VALUES (NEW.id, NEW.bio, NEW.avatar_url, NEW.website, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      bio = EXCLUDED.bio,
      avatar_url = EXCLUDED.avatar_url,
      website = EXCLUDED.website,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_profile
AFTER INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION sync_user_profile();

-- Phase 2: Switch app to the new table
-- Phase 3: Drop old columns and trigger
DROP TRIGGER trg_sync_profile ON users;
DROP FUNCTION sync_user_profile();
ALTER TABLE users DROP COLUMN bio;
ALTER TABLE users DROP COLUMN avatar_url;
ALTER TABLE users DROP COLUMN website;
```

---

## 3. Dangerous Operations and Safe Alternatives

### Dangerous DDL Operations Comparison

| Operation | Risk | Lock Type | Lock Duration | Safe Alternative |
|---|---|---|---|---|
| `ADD COLUMN` (no default) | Low | AccessExclusiveLock | Instant | Use as-is |
| `ADD COLUMN DEFAULT x` (PG11+) | Low | AccessExclusiveLock | Instant | Use as-is |
| `ADD COLUMN DEFAULT x` (PG10 and earlier) | High | AccessExclusiveLock | Rewrites all rows | Add column, then UPDATE |
| `DROP COLUMN` | Medium | AccessExclusiveLock | Instant (logical delete) | Perform in Contract phase |
| `ALTER TYPE` (type change) | High | AccessExclusiveLock | Rewrites all rows | New column + backfill |
| `SET NOT NULL` | High | AccessExclusiveLock | Full table scan | CHECK constraint → VALIDATE → NOT NULL |
| `CREATE INDEX` | High | ShareLock | Depends on table size | Use `CONCURRENTLY` |
| `ADD CONSTRAINT` (FK) | High | ShareRowExclusiveLock | Validates all rows | `NOT VALID` + `VALIDATE` |
| `RENAME COLUMN` | High | AccessExclusiveLock | Instant but breaks app compatibility | Expand-Contract |
| `RENAME TABLE` | High | AccessExclusiveLock | Instant but breaks app compatibility | Migrate via view |
| `DROP TABLE` | Critical | AccessExclusiveLock | Instant | RENAME → monitor → DROP |

### PostgreSQL Lock Types

```
PostgreSQL Lock Types and Conflict Matrix
======================================

Lock types (lightest to heaviest):
  1. AccessShareLock        ← SELECT
  2. RowShareLock           ← SELECT FOR UPDATE
  3. RowExclusiveLock       ← INSERT/UPDATE/DELETE
  4. ShareUpdateExclusiveLock ← VACUUM, VALIDATE CONSTRAINT
  5. ShareLock              ← CREATE INDEX
  6. ShareRowExclusiveLock  ← CREATE TRIGGER, add FK
  7. ExclusiveLock          ← REFRESH MATERIALIZED VIEW CONCURRENTLY
  8. AccessExclusiveLock    ← ALTER TABLE, DROP TABLE

Example of conflict:
  AccessExclusiveLock blocks all operations
  → Even SELECT is queued while ALTER TABLE is running
  → In other words, even "instant" operations can block for a long time waiting to acquire the lock

Countermeasure:
  SET lock_timeout = '5s';  -- Give up trying to acquire lock after 5 seconds
  ALTER TABLE users ADD COLUMN phone VARCHAR(20);
  RESET lock_timeout;
```

### Code Example 5: Safe Index Addition

```sql
-- [BAD] Table lock causes downtime
CREATE INDEX idx_orders_email ON orders (email);
-- ShareLock: INSERT/UPDATE/DELETE are blocked

-- [GOOD] No lock (CONCURRENTLY)
CREATE INDEX CONCURRENTLY idx_orders_email ON orders (email);
-- Important notes:
-- 1. Cannot be used inside a transaction
-- 2. Build time is approximately 2-3x longer
-- 3. If it fails, an INVALID index is left behind
-- 4. The table is scanned twice

-- Check for and handle INVALID indexes
SELECT indexrelid::regclass, indisvalid
FROM pg_index
WHERE NOT indisvalid;

-- Rebuild an INVALID index
REINDEX INDEX CONCURRENTLY idx_orders_email;
-- Or drop and recreate
DROP INDEX CONCURRENTLY idx_orders_email;
CREATE INDEX CONCURRENTLY idx_orders_email ON orders (email);
```

### Code Example 6: Safely Adding a NOT NULL Constraint

```sql
-- [BAD] Setting NOT NULL directly → full table scan + AccessExclusiveLock
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
-- 10 million rows: lock lasts several seconds to tens of seconds

-- [GOOD] Add safely in 3 steps
-- Step 1: Add CHECK constraint with NOT VALID (instant, minimal lock)
SET lock_timeout = '5s';
ALTER TABLE users
ADD CONSTRAINT chk_users_email_not_null
CHECK (email IS NOT NULL) NOT VALID;
-- → Only checks new rows; existing rows are not validated

-- Step 2: Validate existing data (ShareUpdateExclusiveLock only)
-- SELECT/INSERT/UPDATE/DELETE can run concurrently
ALTER TABLE users VALIDATE CONSTRAINT chk_users_email_not_null;
-- → Validates all rows but only takes a weak lock

-- Step 3: Promote to NOT NULL (PostgreSQL 12+ recognizes automatically)
-- PostgreSQL 12+: If CHECK constraint exists, this completes instantly
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
ALTER TABLE users DROP CONSTRAINT chk_users_email_not_null;

-- Safely adding a foreign key constraint
-- Step 1: Add with NOT VALID
ALTER TABLE orders
ADD CONSTRAINT fk_orders_user_id
FOREIGN KEY (user_id) REFERENCES users(id) NOT VALID;

-- Step 2: Validate existing data
ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_user_id;
```

### Code Example 7: Backfilling Large Datasets

```sql
-- [BAD] Bulk UPDATE --> long lock + WAL bloat + VACUUM overhead
UPDATE orders SET status = 'active' WHERE status IS NULL;
-- For 10 million rows:
-- - Lock lasts minutes to tens of minutes
-- - Several GB of WAL is generated
-- - VACUUM becomes necessary
-- - Replica lag occurs

-- [GOOD] Gradual update with batch processing
DO $$
DECLARE
  batch_size INT := 10000;
  total_updated INT := 0;
  rows_affected INT;
BEGIN
  LOOP
    UPDATE orders
    SET status = 'active'
    WHERE id IN (
      SELECT id FROM orders
      WHERE status IS NULL
      LIMIT batch_size
      FOR UPDATE SKIP LOCKED  -- Avoid conflicts with other transactions
    );

    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    total_updated := total_updated + rows_affected;

    RAISE NOTICE 'Updated: % (total: %)', rows_affected, total_updated;

    EXIT WHEN rows_affected = 0;

    PERFORM pg_sleep(0.1);  -- Throttle load (prevents replica lag)
    COMMIT;
  END LOOP;
END $$;

-- [RECOMMENDED] Primary key range-based batch processing (more predictable)
DO $$
DECLARE
  batch_size INT := 10000;
  min_id INT;
  max_id INT;
  current_id INT;
BEGIN
  SELECT MIN(id), MAX(id) INTO min_id, max_id FROM orders WHERE status IS NULL;

  current_id := min_id;
  WHILE current_id <= max_id LOOP
    UPDATE orders
    SET status = 'active'
    WHERE id >= current_id
      AND id < current_id + batch_size
      AND status IS NULL;

    current_id := current_id + batch_size;

    RAISE NOTICE 'Progress: %/%', current_id - min_id, max_id - min_id;
    COMMIT;
    PERFORM pg_sleep(0.05);
  END LOOP;
END $$;
```

### Monitoring Backfill Progress

```sql
-- Progress check query (run from a separate session)
SELECT
    COUNT(*) FILTER (WHERE status IS NOT NULL) AS completed,
    COUNT(*) FILTER (WHERE status IS NULL) AS remaining,
    COUNT(*) AS total,
    ROUND(
        COUNT(*) FILTER (WHERE status IS NOT NULL)::NUMERIC / COUNT(*) * 100, 1
    ) AS progress_pct
FROM orders;

-- Check WAL generation volume
SELECT pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0') AS wal_bytes;

-- Check replica lag
SELECT
    client_addr,
    state,
    pg_wal_lsn_diff(sent_lsn, replay_lsn) AS replay_lag_bytes,
    replay_lag
FROM pg_stat_replication;
```

---

## 4. MySQL-Specific Considerations

### MySQL Online DDL Behavior

```
MySQL Online DDL Behavior
=============================

ALGORITHM options in MySQL 8.0:
  INSTANT   : Metadata-only change (instant)
  INPLACE   : No table copy (concurrent DML allowed)
  COPY      : Copies entire table (DML blocked)

Per-operation support:
  ADD COLUMN (at end)       → INSTANT (MySQL 8.0.12+)
  ADD COLUMN (in middle)    → INPLACE or COPY
  DROP COLUMN               → INPLACE (with rebuild)
  MODIFY COLUMN (type change) → COPY (table lock)
  ADD INDEX                 → INPLACE (concurrent DML allowed)
  DROP INDEX                → INPLACE
  RENAME COLUMN             → INSTANT (MySQL 8.0.28+)

Note:
  Even INPLACE briefly blocks when acquiring a metadata lock
  Long-running transactions cause metadata lock waits
```

### Code Example 8: Migrations in MySQL

```sql
-- MySQL: Specifying ALGORITHM
ALTER TABLE users
ADD COLUMN phone VARCHAR(20),
ALGORITHM=INSTANT;  -- Instant (MySQL 8.0.12+)

-- MySQL: pt-online-schema-change (Percona Tool)
-- Recommended for schema changes on large tables
-- Internally:
-- 1. Creates a new table
-- 2. Syncs writes via trigger
-- 3. Copies data in batches
-- 4. Switches tables (RENAME)

-- bash:
-- pt-online-schema-change \
--   --alter "ADD COLUMN phone VARCHAR(20)" \
--   --execute \
--   D=mydb,t=users

-- gh-ost (GitHub's tool)
-- Online schema change without triggers
-- bash:
-- gh-ost \
--   --alter="ADD COLUMN phone VARCHAR(20)" \
--   --database=mydb \
--   --table=users \
--   --execute
```

---

## 5. Migration CI/CD

```
Migrations in a CI/CD Pipeline
========================================

1. Create PR
   │
   ▼
2. Migration lint
   - SQL syntax check
   - Detection of dangerous operations
   - Rollback feasibility check
   - Schema consistency check
   │
   ▼
3. Apply test in test environment
   - Apply all migrations to an empty DB
   - Compare diff with production schema dump
   │
   ▼
4. Apply to staging
   - Test with production-equivalent data volume
   - Measure application time
   - Test rollback
   │
   ▼
5. Review approval
   - DBA/team lead approval
   - Confirm application plan
   │
   ▼
6. Apply to production
   - Blue/Green or Rolling
   - Check monitoring dashboard
   - Prepare rollback procedure
   │
   ▼
7. Post-deployment monitoring
   - Check error rates
   - Check query performance
   - Check replica lag
```

### Code Example 9: Migration Lint Tools

```bash
# squawk: PostgreSQL migration linter
npm install -g squawk-cli

# Detect dangerous operations
squawk migrations/V3__add_index.sql

# Example output:
# migrations/V3__add_index.sql:1:1
#   warning: prefer-create-index-concurrently
#   CREATE INDEX on a large table without CONCURRENTLY
#   can lock the table for a long time.
#
#   Instead:
#   CREATE INDEX CONCURRENTLY idx_orders_email ON orders (email);

# squawk config file (.squawk.toml)
# [general]
# excluded_rules = []
#
# [custom_rules]
# ban_drop_column = true  # Prohibit DROP COLUMN
```

```yaml
# Automated lint with GitHub Actions
# .github/workflows/migration-check.yml
name: Migration Check
on:
  pull_request:
    paths:
      - 'migrations/**'

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install squawk
        run: npm install -g squawk-cli

      - name: Get changed migration files
        id: changes
        run: |
          echo "files=$(git diff --name-only origin/main -- 'migrations/*.sql' | tr '\n' ' ')" >> $GITHUB_OUTPUT

      - name: Run squawk
        run: squawk ${{ steps.changes.outputs.files }}

  test-apply:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4

      - name: Apply all migrations
        run: |
          migrate -path ./migrations \
            -database "postgres://postgres:test@localhost:5432/test?sslmode=disable" \
            up

      - name: Verify schema
        run: |
          pg_dump -s postgres://postgres:test@localhost:5432/test > /tmp/schema.sql
          diff expected_schema.sql /tmp/schema.sql
```

### Code Example 10: Migration Deployment Script

```bash
#!/bin/bash
# deploy_migration.sh - Safe migration deployment script

set -euo pipefail

DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"
MIGRATIONS_PATH="${MIGRATIONS_PATH:-./migrations}"
LOCK_TIMEOUT="${LOCK_TIMEOUT:-5s}"
STATEMENT_TIMEOUT="${STATEMENT_TIMEOUT:-30s}"

echo "=== Starting migration ==="
echo "Database: ${DATABASE_URL%%@*}@..."
echo "Path: ${MIGRATIONS_PATH}"

# 1. Check current version
CURRENT_VERSION=$(migrate -path "${MIGRATIONS_PATH}" -database "${DATABASE_URL}" version 2>&1 || true)
echo "Current version: ${CURRENT_VERSION}"

# 2. Dry run (list of migrations to apply)
echo ""
echo "=== Migrations to be applied ==="
migrate -path "${MIGRATIONS_PATH}" -database "${DATABASE_URL}" up -dry-run 2>&1 || true

# 3. Confirm
read -p "Continue? (y/N): " confirm
if [[ "${confirm}" != "y" ]]; then
    echo "Aborted"
    exit 0
fi

# 4. Apply timeout settings
psql "${DATABASE_URL}" -c "ALTER DATABASE $(psql "${DATABASE_URL}" -t -c 'SELECT current_database()') SET lock_timeout = '${LOCK_TIMEOUT}';"
psql "${DATABASE_URL}" -c "ALTER DATABASE $(psql "${DATABASE_URL}" -t -c 'SELECT current_database()') SET statement_timeout = '${STATEMENT_TIMEOUT}';"

# 5. Apply migrations
echo ""
echo "=== Applying migrations ==="
if migrate -path "${MIGRATIONS_PATH}" -database "${DATABASE_URL}" up; then
    echo "Migration succeeded"
else
    echo "Migration failed"
    echo "Consider rolling back:"
    echo "  migrate -path ${MIGRATIONS_PATH} -database \"\${DATABASE_URL}\" down 1"
    exit 1
fi

# 6. Reset timeout settings
psql "${DATABASE_URL}" -c "ALTER DATABASE $(psql "${DATABASE_URL}" -t -c 'SELECT current_database()') RESET lock_timeout;"
psql "${DATABASE_URL}" -c "ALTER DATABASE $(psql "${DATABASE_URL}" -t -c 'SELECT current_database()') RESET statement_timeout;"

# 7. Confirm new version
NEW_VERSION=$(migrate -path "${MIGRATIONS_PATH}" -database "${DATABASE_URL}" version 2>&1 || true)
echo ""
echo "=== Migration complete ==="
echo "Version: ${CURRENT_VERSION} → ${NEW_VERSION}"
```

---

## 6. Rollback Strategies

### Types of Rollbacks

```
Rollback Strategy Comparison
========================

1. DOWN Migration (reverse execution)
   [Apply]   ALTER TABLE users ADD COLUMN phone VARCHAR(20);
   [Revert]  ALTER TABLE users DROP COLUMN phone;
   + Simplest approach
   - Data loss (data is gone when column is dropped)

2. Forward Fix
   → Instead of rolling back, add a corrective migration
   [V3] ALTER TABLE users ADD COLUMN phone VARCHAR(20);
   [V4] ALTER TABLE users ALTER COLUMN phone TYPE VARCHAR(30);
   + No data loss
   + Most recommended for production
   - Takes time in an emergency

3. Backup Restore
   → Restore from a DB backup
   + Guaranteed to revert correctly
   - Long downtime
   - Data after the migration is lost

4. Point-in-Time Recovery (PITR)
   → Restore to a specific point using WAL
   + Can restore to any point in time
   - Complex setup
   - Recovery takes time

Recommendation: Use forward fix normally; use DOWN migration only for critical failures
```

### Code Example 11: Safe Rollback Design

```sql
-- UP migration
-- 20260211_003_add_orders_status.up.sql
BEGIN;

-- Set lock wait timeout
SET lock_timeout = '5s';

ALTER TABLE orders ADD COLUMN status_new VARCHAR(20);

-- Set default value (for new rows only)
ALTER TABLE orders ALTER COLUMN status_new SET DEFAULT 'pending';

-- Record migration version
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('20260211_003', 'add_orders_status', NOW());

COMMIT;

-- DOWN migration
-- 20260211_003_add_orders_status.down.sql
BEGIN;

SET lock_timeout = '5s';

ALTER TABLE orders DROP COLUMN IF EXISTS status_new;

DELETE FROM schema_migrations WHERE version = '20260211_003';

COMMIT;
```

### Code Example 12: Safety Measures for Irreversible Migrations

```sql
-- Instead of dropping a table directly, rename it in stages for a gradual approach
-- Phase 1: Rename (can be rolled back immediately)
ALTER TABLE legacy_data RENAME TO _deprecated_legacy_data_20260211;

-- Phase 2: Monitoring period of 1-2 weeks
-- Confirm there are no application errors

-- Phase 3: Back up, then drop
-- pg_dump -t _deprecated_legacy_data_20260211 > backup.sql
DROP TABLE IF EXISTS _deprecated_legacy_data_20260211;

-- Same phased approach for column deletion
-- Phase 1: Confirm the column is not being used
SELECT count(*) FROM pg_stat_user_tables
WHERE relname = 'users';

-- Phase 2: Confirm via application logs (1 week)
-- Phase 3: Drop
ALTER TABLE users DROP COLUMN IF EXISTS old_column;
```

---

## 7. Managing Multiple Environments

### Environment-Specific Migration Strategies

```
Migration Strategies Per Environment
==============================

Development:
  - migrate reset is allowed
  - Seed data can be loaded
  - Test schema changes
  └── migrate up → test → migrate down → fix → migrate up

Staging:
  - Production-equivalent data volume (anonymized)
  - Measure migration execution time
  - Test rollbacks
  └── backup → migrate up → test → (if problems) restore

Production:
  - Phased rollout (canary deploy)
  - Minimize lock time
  - Execute with monitoring
  └── snapshot → set lock_timeout → migrate up → monitor

Consistency check across environments:
  pg_dump -s production > prod_schema.sql
  pg_dump -s staging > staging_schema.sql
  diff prod_schema.sql staging_schema.sql  -- Confirm no diff
```

### Code Example 13: Environment-Specific Migration Configuration

```yaml
# database.yml (Rails-style config example)
development:
  adapter: postgresql
  database: myapp_dev
  pool: 5
  timeout: 5000
  migration_options:
    lock_timeout: "30s"
    statement_timeout: "5min"

staging:
  adapter: postgresql
  database: myapp_staging
  pool: 10
  migration_options:
    lock_timeout: "10s"
    statement_timeout: "2min"

production:
  adapter: postgresql
  database: myapp_prod
  pool: 25
  migration_options:
    lock_timeout: "5s"
    statement_timeout: "30s"
    concurrent_index: true
    batch_backfill: true
    batch_size: 10000
    batch_sleep: 0.1
```

---

## 8. Advanced Migration Patterns

### Code Example 14: Safely Changing an ENUM Type

```sql
-- PostgreSQL ENUM types have restrictions with ALTER TYPE

-- [OK] Adding a value (safe)
ALTER TYPE order_status ADD VALUE 'cancelled';
ALTER TYPE order_status ADD VALUE 'refunded' AFTER 'shipped';

-- [BAD] Deleting/renaming a value → not directly possible
-- Safe alternative procedure:

-- 1. Create a new ENUM type
CREATE TYPE order_status_v2 AS ENUM (
    'pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded'
);

-- 2. Change the column type
ALTER TABLE orders
    ALTER COLUMN status TYPE order_status_v2
    USING status::text::order_status_v2;

-- 3. Drop the old ENUM type
DROP TYPE order_status;

-- 4. Rename the new ENUM type
ALTER TYPE order_status_v2 RENAME TO order_status;
```

### Code Example 15: Migrating to a Partitioned Table

```sql
-- Partitioning an existing large table
-- Note: PostgreSQL cannot directly partition an existing table

-- Phase 1: Create the partitioned table
CREATE TABLE orders_partitioned (
    id          SERIAL,
    customer_id INTEGER NOT NULL,
    order_date  DATE NOT NULL,
    total       DECIMAL(10, 2),
    status      VARCHAR(20),
    created_at  TIMESTAMP DEFAULT NOW()
) PARTITION BY RANGE (order_date);

-- Create monthly partitions
CREATE TABLE orders_y2024m01 PARTITION OF orders_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE orders_y2024m02 PARTITION OF orders_partitioned
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
-- ... same for other months

-- Default partition (catch-all for out-of-range data)
CREATE TABLE orders_default PARTITION OF orders_partitioned DEFAULT;

-- Phase 2: Migrate data (in batches)
INSERT INTO orders_partitioned
SELECT * FROM orders
WHERE order_date >= '2024-01-01' AND order_date < '2024-02-01';
-- COMMIT per batch

-- Phase 3: Transparent access via view
CREATE VIEW orders_v AS
SELECT * FROM orders_partitioned
UNION ALL
SELECT * FROM orders WHERE order_date < '2024-01-01';

-- Phase 4: Switch app to the new table
-- Phase 5: Archive/drop the old table
```

---

## Edge Cases

### Edge Case 1: Deadlock with Long-Running Transactions

```sql
-- Problem: Running ALTER TABLE while a long-running transaction exists
-- causes a cascade of lock waits

-- Session 1 (app): Long-running transaction
BEGIN;
SELECT * FROM users WHERE id = 1;  -- Acquires AccessShareLock
-- ... idle for 10 minutes ...

-- Session 2 (migration): ALTER TABLE
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
-- → Requests AccessExclusiveLock
-- → Waits for Session 1's AccessShareLock

-- Sessions 3-N (app): New SELECTs
SELECT * FROM users WHERE id = 2;
-- → Requests AccessShareLock
-- → Waits for Session 2's AccessExclusiveLock
-- → All app requests are blocked!

-- Countermeasure: Set lock_timeout
SET lock_timeout = '5s';
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
-- If lock cannot be acquired within 5 seconds, error → retry
RESET lock_timeout;
```

### Edge Case 2: Failure Mid-Migration

```sql
-- When multiple operations run inside a transaction,
-- a failure mid-way rolls back the entire transaction

BEGIN;
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
ALTER TABLE users ADD COLUMN fax VARCHAR(20);
CREATE INDEX CONCURRENTLY idx_users_phone ON users(phone);
-- → Error: CREATE INDEX CONCURRENTLY cannot be used inside a transaction
ROLLBACK;

-- Countermeasure: Run CONCURRENTLY outside a transaction
-- migration_part1.sql (inside transaction)
BEGIN;
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
ALTER TABLE users ADD COLUMN fax VARCHAR(20);
COMMIT;

-- migration_part2.sql (outside transaction)
CREATE INDEX CONCURRENTLY idx_users_phone ON users(phone);
```

### Edge Case 3: Replication Lag

```sql
-- Problem: Delay before DDL changes are reflected on replicas
-- If replicas are used for reads, schema inconsistency can occur

-- Countermeasure 1: Check replica lag
SELECT
    client_addr,
    pg_wal_lsn_diff(sent_lsn, replay_lsn) AS lag_bytes,
    replay_lag
FROM pg_stat_replication;

-- Countermeasure 2: Wait for replica sync after migration
-- On the application side:
-- 1. Execute migration
-- 2. Wait until replica lag reaches 0
-- 3. Deploy app
```

---

## Security Considerations

### 1. Managing Migration Execution Permissions

```sql
-- Create a dedicated migration user
CREATE ROLE migration_user WITH LOGIN PASSWORD 'secure_password';

-- Grant minimum required permissions
GRANT CONNECT ON DATABASE mydb TO migration_user;
GRANT CREATE ON SCHEMA public TO migration_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO migration_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO migration_user;

-- DDL permissions (PostgreSQL)
ALTER ROLE migration_user CREATEDB;  -- Only if necessary

-- Separate from application user
-- Do not grant DDL permissions to the app user
CREATE ROLE app_user WITH LOGIN PASSWORD 'app_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
```

### 2. Migration File Auditing

```sql
-- Migration audit table design
CREATE TABLE migration_audit (
    id           SERIAL PRIMARY KEY,
    version      VARCHAR(50) NOT NULL,
    description  VARCHAR(255),
    applied_by   VARCHAR(100) DEFAULT current_user,
    applied_at   TIMESTAMP DEFAULT NOW(),
    execution_ms INTEGER,
    checksum     VARCHAR(64),  -- SHA-256 of the file
    rollback_sql TEXT          -- Store rollback SQL
);
```

---

## Anti-Patterns

### 1. Running Migrations and App Deployments Simultaneously

**Problem**: Deploying an app that references a new column at the same time as running the migration means requests arriving before the migration completes will error.

**Solution**: Always run migrations before deploying the app. Maintain backward compatibility using the Expand-Contract pattern and proceed in three stages: "migration → deploy → cleanup."

### 2. Manual Schema Changes

**Problem**: When a DBA runs ALTER TABLE directly, it creates inconsistencies with the migration history, causing subsequent automated migrations to fail.

**Solution**: All schema changes must go through migration files. Even emergency manual changes should be recorded as migration files to keep history accurate.

### 3. Migrations Without Rollback Scripts

**Problem**: Without DOWN migrations, rolling back when a problem occurs is impossible. Restoring from a backup becomes the only option.

**Solution**: Prepare DOWN scripts for all migrations. For irreversible changes (DROP TABLE, etc.), either write a RECREATE in the DOWN script or explicitly comment that it is "irreversible."

### 4. Applying Many Migrations at Once

**Problem**: Applying 50 migrations to production at once makes it difficult to isolate the cause if something fails midway.

**Solution**: Split large changes across multiple releases, applying a small number of migrations per release. Group migrations with dependencies together for management.

---

## Practice Problems

### Exercise 1 (Basic): Creating Migration Files

Create UP/DOWN migrations for the following schema changes.

1. Add a `description TEXT` column to the `products` table
2. Add a `shipped_at TIMESTAMP` column to the `orders` table with a default value of NULL
3. Add a unique constraint to the `email` column of the `users` table

<details>
<summary>Example Solution</summary>

```sql
-- 1. Add description to products
-- UP:
ALTER TABLE products ADD COLUMN description TEXT;
-- DOWN:
ALTER TABLE products DROP COLUMN description;

-- 2. Add shipped_at to orders
-- UP:
ALTER TABLE orders ADD COLUMN shipped_at TIMESTAMP;
-- DOWN:
ALTER TABLE orders DROP COLUMN shipped_at;

-- 3. Unique constraint on users.email (safe version)
-- UP:
CREATE UNIQUE INDEX CONCURRENTLY idx_users_email_unique ON users(email);
ALTER TABLE users ADD CONSTRAINT uq_users_email UNIQUE USING INDEX idx_users_email_unique;
-- DOWN:
ALTER TABLE users DROP CONSTRAINT uq_users_email;
```

</details>

### Exercise 2 (Applied): Designing a Zero-Downtime Migration

Design a zero-downtime migration plan for the following scenario.

- Change the `status` column of the `orders` table from VARCHAR(20) to an ENUM type
- Current status values: 'pending', 'paid', 'shipped', 'delivered'
- 10 million records exist
- Zero downtime is required

<details>
<summary>Example Solution</summary>

```sql
-- Phase 1: Expand (add new column)
CREATE TYPE order_status AS ENUM ('pending', 'paid', 'shipped', 'delivered');
ALTER TABLE orders ADD COLUMN status_v2 order_status;

-- Sync with trigger
CREATE OR REPLACE FUNCTION sync_order_status() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status_v2 IS NULL AND NEW.status IS NOT NULL THEN
    NEW.status_v2 := NEW.status::order_status;
  ELSIF NEW.status IS NULL AND NEW.status_v2 IS NOT NULL THEN
    NEW.status := NEW.status_v2::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_sync_status BEFORE INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION sync_order_status();

-- Phase 2: Backfill (batch update)
-- Migrate existing data in batches (see batch processing pattern above)

-- Phase 3: Switch app to status_v2
-- Phase 4: Contract (drop old column)
DROP TRIGGER trg_sync_status ON orders;
DROP FUNCTION sync_order_status();
ALTER TABLE orders DROP COLUMN status;
ALTER TABLE orders RENAME COLUMN status_v2 TO status;
```

</details>

### Exercise 3 (Advanced): Responding to Migration Failures

Describe the response procedure for the following failure scenario.

- `CREATE INDEX CONCURRENTLY` failed midway in production, leaving an INVALID index
- At the same time, a backfill job is running and is 50% complete
- The application is operating normally

<details>
<summary>Example Solution</summary>

```sql
-- 1. Check for INVALID indexes
SELECT indexrelid::regclass, indisvalid
FROM pg_index WHERE NOT indisvalid;

-- 2. Drop the INVALID index safely (with CONCURRENTLY)
DROP INDEX CONCURRENTLY idx_failing_index;

-- 3. Check the state of the backfill job
-- Check progress (use monitoring query above)
-- If the job is running normally, let it continue

-- 4. Recreate the index (after backfill completes)
CREATE INDEX CONCURRENTLY idx_new_index ON table(column);

-- 5. Verify the result
SELECT indexrelid::regclass, indisvalid
FROM pg_index WHERE indexrelid = 'idx_new_index'::regclass;
```

</details>


---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology decisions.

| Criterion | Prioritize when | Can compromise when |
|---------|------------|-------------|
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
│  1. What is the team size?                      │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → Go to 2              │
│                                                 │
│  2. What is the deployment frequency?           │
│    ├─ Weekly or less → Monolith + modules       │
│    └─ Daily/multiple times → Go to 3            │
│                                                 │
│  3. How independent are teams?                  │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Every technical decision involves trade-offs. Analyze from the following perspectives:

**1. Short-term vs. Long-term Cost**
- A fast short-term approach can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs. Flexibility**
- A unified tech stack has lower learning costs
- Adopting diverse technologies enables best-fit choices but increases operational costs

**3. Level of Abstraction**
- High abstraction offers better reusability but can make debugging harder
- Low abstraction is intuitive but tends to lead to code duplication

```python
# Design decision recording template
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe background and problem"""
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

## Real-World Application Scenarios

### Scenario 1: MVP Development at a Startup

**Situation:** Need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on the minimum required features
- Automated tests only for the critical path
- Introduce monitoring early

**Lessons Learned:**
- Don't strive for perfection (YAGNI principle)
- Obtain user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Gradually overhauling a system that has been in operation for over 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- If no existing tests, write Characterization Tests first
- Coexist old and new systems via an API gateway
- Execute data migration in stages

| Phase | Work | Estimated Duration | Risk |
|---------|---------|---------|--------|
| 1. Investigation | Analyze current state, map dependencies | 2-4 weeks | Low |
| 2. Foundation | Set up CI/CD, test environment | 4-6 weeks | Low |
| 3. Begin migration | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core migration | Migrate core features | 6-12 months | High |
| 5. Completion | Decommission old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers working on the same product

**Approach:**
- Clarify boundaries with Domain-Driven Design
- Assign ownership per team
- Manage shared libraries via Inner Source
- Design API-first to minimize inter-team dependencies

```python
# API contract definition between teams
from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

class Priority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class APIContract:
    """API contract between teams"""
    endpoint: str
    method: str
    owner_team: str
    consumers: List[str]
    sla_ms: int  # Response time SLA
    priority: Priority

    def validate_sla(self, actual_ms: int) -> bool:
        """Check SLA compliance"""
        return actual_ms <= self.sla_ms

    def to_openapi(self) -> dict:
        """Output in OpenAPI format"""
        return {
            'path': self.endpoint,
            'method': self.method,
            'x-owner': self.owner_team,
            'x-consumers': self.consumers,
            'x-sla-ms': self.sla_ms
        }

# Usage example
contracts = [
    APIContract(
        endpoint="/api/v1/users",
        method="GET",
        owner_team="user-team",
        consumers=["order-team", "notification-team"],
        sla_ms=200,
        priority=Priority.HIGH
    ),
    APIContract(
        endpoint="/api/v1/orders",
        method="POST",
        owner_team="order-team",
        consumers=["payment-team", "inventory-team"],
        sla_ms=500,
        priority=Priority.CRITICAL
    )
]
```

### Scenario 4: Performance-Critical Systems

**Situation:** Systems where millisecond-level response times are required

**Optimization Points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging async processing
3. Connection pooling
4. Query optimization and index design

| Optimization Method | Impact | Implementation Cost | When to Apply |
|-----------|------|-----------|---------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-bound processing |
| DB optimization | High | High | When queries are slow |
| Code optimization | Low-Medium | High | CPU-bound processing |
---

## FAQ

### Q1: Which migration tool should I choose?

**A**: Choose based on your project's tech stack:
- **Flyway/Liquibase**: Java ecosystem. Enterprise-grade
- **golang-migrate**: Go projects. Simple and general-purpose
- **Prisma Migrate**: TypeScript/Node.js. ORM integration
- **Alembic**: Python (SQLAlchemy). Flexible scripting support
- **Atlas**: Declarative schema management. Modern approach
- **Knex.js**: JavaScript. For Express/Fastify projects

### Q2: How do I safely change a column type (e.g., VARCHAR to TEXT)?

**A**: A direct `ALTER TYPE` causes a table lock. Safe procedure:
1. Add a new column with the new type
2. Bidirectional sync with a trigger
3. Copy existing data via backfill
4. Switch the app to the new column
5. Drop the old column

Note: In PostgreSQL, expanding VARCHAR(N) to VARCHAR(M) (where M > N) is only a metadata change and completes instantly. The same applies to changing to TEXT.

### Q3: How do I estimate migration execution time?

**A**: Measure in a staging environment using production-equivalent data volume. Rough guidelines:
- `ADD COLUMN` (no default): Milliseconds
- `ADD COLUMN DEFAULT` (PG11+): Milliseconds
- `CREATE INDEX CONCURRENTLY`: Approximately 2-3x the time proportional to table size (100M rows: several minutes to tens of minutes)
- Backfill UPDATE: (number of rows / batch size) * (execution time + sleep)
- `ALTER TABLE ALTER TYPE`: Proportional to table size since all rows are rewritten

### Q4: What are the naming conventions for migrations?

**A**: The following formats are common:
- **Timestamp-based**: `20260211143025_add_phone_to_users.sql` (recommended, unlikely to conflict)
- **Sequential number-based**: `000042_add_phone_to_users.sql` (simple but can conflict across branches)
- **Semantic**: `V2.1.0__add_phone_to_users.sql` (Flyway format)

Naming best practices:
- Start with a verb: `add_`, `create_`, `remove_`, `rename_`, `modify_`
- Include the table name
- Use a name that conveys the purpose

### Q5: Should migrations include data-modifying statements (DML)?

**A**: There are two schools of thought:

1. **Include DML**: DML closely tied to schema changes, such as master data loading or data transformations, should be included in migrations
2. **Manage DML separately**: Seed data is managed in separate scripts; migrations contain only DDL

Recommendation: Include data transformations that accompany schema changes in migrations; separate initial data loading as seed scripts.

---

## Troubleshooting

### Issue 1: Migration is in a "dirty" state

```bash
# golang-migrate: Clearing dirty state
# 1. Check current state
migrate -path ./migrations -database "$DB_URL" version
# → Output: 5 (dirty)

# 2. Clear dirty flag (after manual fix)
migrate -path ./migrations -database "$DB_URL" force 5

# 3. Re-apply after fix
migrate -path ./migrations -database "$DB_URL" up
```

### Issue 2: Failing due to lock_timeout

```sql
-- Cause: A long-running transaction is holding the lock
-- 1. Check queries holding locks
SELECT
    pid,
    usename,
    state,
    query_start,
    NOW() - query_start AS duration,
    LEFT(query, 100) AS query
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < NOW() - INTERVAL '1 minute'
ORDER BY duration DESC;

-- 2. Wait for the long-running transaction to finish, or cancel it
SELECT pg_cancel_backend(pid);  -- Cancel the query
-- SELECT pg_terminate_backend(pid);  -- Force terminate the session (last resort)
```

### Issue 3: Staging and production schemas do not match

```bash
# Check schema diff
pg_dump -s $STAGING_URL > staging_schema.sql
pg_dump -s $PRODUCTION_URL > production_schema.sql
diff staging_schema.sql production_schema.sql

# Or use migra (auto-generate diff SQL)
pip install migra
migra $STAGING_URL $PRODUCTION_URL
# → Outputs ALTER TABLE ...
```

---

## Summary

| Item | Key Point |
|---|---|
| Version control | Manage all schema changes through migration files |
| Expand-Contract | Maintain backward compatibility with 3 phases: add → migrate → remove |
| CONCURRENTLY | Use lock-free CONCURRENTLY for index creation |
| NOT VALID | Add constraints in 2 steps: NOT VALID + VALIDATE |
| lock_timeout | Set a lock acquisition timeout before running DDL |
| Batch updates | Distribute load with batch processing for large-scale data updates |
| Rollback | Prepare DOWN scripts for all migrations |
| CI/CD | Automatically detect dangerous operations with lint tools |
| Environment separation | Use the same scripts across development/staging/production |
| Auditing | Record migration execution and manage permissions |

## Further Reading

- [Indexing](../01-advanced/03-indexing.md) — CONCURRENTLY details and optimization
- [NoSQL Comparison](../03-practical/04-nosql-comparison.md) — Migrations for schema-less databases
- [Transactions](../01-advanced/02-transactions.md) — Lock and transaction management

## References

1. **PostgreSQL Official**: [ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html) — Details on lock behavior for DDL operations
2. **PostgreSQL Official**: [Lock Monitoring](https://wiki.postgresql.org/wiki/Lock_Monitoring) — Techniques for monitoring locks
3. **Braintree Blog**: [Safe Operations for High Volume PostgreSQL](https://medium.com/braintree-product-technology) — Zero-downtime techniques
4. **squawk**: [PostgreSQL Migration Linter](https://squawkhq.com/) — Migration safety checking tool
5. **Martin Kleppmann**: *Designing Data-Intensive Applications* — Comprehensive guide to data system design
6. **GitHub Engineering**: [gh-ost: Online Schema Migration](https://github.com/github/gh-ost) — Trigger-free online DDL

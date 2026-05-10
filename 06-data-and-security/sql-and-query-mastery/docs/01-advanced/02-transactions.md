# Transactions — ACID, Isolation Levels, Deadlocks, and MVCC

> A transaction is a logical unit of database operations, and through the ACID properties it guarantees data consistency and reliability — the cornerstone of database systems. This chapter systematically covers each element of ACID at the internal implementation level, criteria for choosing isolation levels, strategies for deadlock avoidance and detection, and the mechanism of MVCC (Multi-Version Concurrency Control).

---

## What You Will Learn

1. **Understand each ACID property at the internal implementation level** — Durability guarantees via WAL (Write-Ahead Logging), how checkpoints work
2. **Grasp the four isolation levels and the anomalies that occur at each level with concrete examples** — dirty reads, non-repeatable reads, phantom reads, serialization anomalies
3. **Implement strategies to cause, avoid, and detect deadlocks** — consistent lock ordering, timeout configuration, choosing between optimistic and pessimistic locking
4. **Understand MVCC internals and design an appropriate VACUUM strategy** — xmin/xmax, snapshots, visibility maps

---

## Prerequisites

| Topic | Content | Reference |
|---------|------|--------|
| SQL Basics | Fundamental syntax for SELECT/INSERT/UPDATE/DELETE | [00-basics/](../00-basics/) |
| Table Design | PRIMARY KEY, FOREIGN KEY, constraints | [01-schema-design.md](../02-design/01-schema-design.md) |
| Database Connection | How to connect using psql or a GUI tool | [00-basics/](../00-basics/) |

---

## 1. ACID Properties

### Why ACID Is Necessary

Without ACID properties, databases would suffer the following serious problems.

- **Bank transfer**: If a withdrawal of 100,000 yen from account A succeeds but the deposit to account B fails, the 100,000 yen disappears (lack of atomicity)
- **Inventory management**: Two orders simultaneously purchase the last item, driving inventory to -1 (lack of isolation)
- **Accounting**: A journal entry is created where debits and credits do not balance (lack of consistency)
- **Crash recovery**: The server crashes immediately after a commit and the data is lost (lack of durability)

```
┌────────────────── ACID Properties ──────────────────┐
│                                                      │
│  A - Atomicity                                       │
│    Either "all succeed" or "all fail"                │
│    If something fails midway, roll back all changes  │
│    Implementation: UNDO log / WAL rollback           │
│                                                      │
│  C - Consistency                                     │
│    Data constraints are always satisfied             │
│    before and after a transaction                    │
│    Implementation: CHECK constraints, FK, triggers   │
│                                                      │
│  I - Isolation                                       │
│    Concurrent transactions do not interfere          │
│    with each other (or appear not to)                │
│    Implementation: MVCC / lock protocols             │
│                                                      │
│  D - Durability                                      │
│    COMMITted data is never lost                      │
│    even when a failure occurs                        │
│    Implementation: WAL (Write-Ahead Logging)         │
│                 + fsync / checkpoints                │
└──────────────────────────────────────────────────────┘
```

### Internal Implementation of ACID Properties

```
┌─────────────── How WAL (Write-Ahead Logging) Works ──────────────┐
│                                                                   │
│  ① Client: BEGIN; UPDATE ...; COMMIT;                            │
│                                                                   │
│  ② WAL buffer: write the changes to the WAL log first            │
│     ┌─────────────────────────────────────────────┐              │
│     │ LSN=100: UPDATE accounts SET balance=900    │              │
│     │ LSN=101: UPDATE accounts SET balance=1100   │              │
│     │ LSN=102: COMMIT                              │              │
│     └─────────────────────────────────────────────┘              │
│                                                                   │
│  ③ WAL disk write: persisted via fsync at COMMIT time            │
│     → Durability is guaranteed at this point                      │
│                                                                   │
│  ④ Shared buffer: table data is written lazily (dirty pages)     │
│                                                                   │
│  ⑤ Checkpoint: periodically flushes dirty pages to disk          │
│     → WAL records before the checkpoint become unnecessary        │
│                                                                   │
│  ⑥ Crash recovery: replay WAL from the last checkpoint           │
│     to restore a consistent state                                 │
│                                                                   │
│  [Client] → [WAL Buffer] → [WAL Disk] ← Durability guarantee     │
│                ↓                                                  │
│          [Shared Buffer] → [Data Disk] ← Written at checkpoint    │
└───────────────────────────────────────────────────────────────────┘
```

### Code Example 1: Transaction Basics

```sql
-- Prepare test tables
CREATE TABLE accounts (
    account_id VARCHAR(10) PRIMARY KEY,
    owner_name VARCHAR(100) NOT NULL,
    balance    DECIMAL(12, 2) NOT NULL DEFAULT 0
                CHECK (balance >= 0)
);

INSERT INTO accounts VALUES ('A001', '田中太郎', 100000);
INSERT INTO accounts VALUES ('B002', '鈴木花子', 50000);

-- Bank transfer: a typical example of Atomicity
BEGIN;

-- Decrease the sender's balance
UPDATE accounts SET balance = balance - 10000
WHERE account_id = 'A001';

-- Increase the recipient's balance
UPDATE accounts SET balance = balance + 10000
WHERE account_id = 'B002';

-- Check that the sender's balance has not gone below 0
DO $$
BEGIN
    IF (SELECT balance FROM accounts WHERE account_id = 'A001') < 0 THEN
        RAISE EXCEPTION '残高不足';
    END IF;
END $$;

-- Commit if everything succeeded
COMMIT;

-- Verification: total balance is unchanged (Consistency)
SELECT SUM(balance) FROM accounts;
-- Result: 150000 (same as before the transfer)
```

**Why wrap with BEGIN/COMMIT**: Without BEGIN/COMMIT, each UPDATE runs as an independent transaction. If the first UPDATE succeeds but the second fails, 10,000 yen disappears.

### Code Example 2: Partial Rollback with SAVEPOINT

```sql
-- Stepped transaction control using SAVEPOINT
BEGIN;

-- Create the order (required)
INSERT INTO orders (id, customer_id, total)
VALUES (100, 1, 5000);
SAVEPOINT order_created;

-- Add order items (required)
INSERT INTO order_items (order_id, product_id, quantity, unit_price)
VALUES (100, 1, 2, 2500);
SAVEPOINT items_added;

-- Award points (optional — order should still go through even if this fails)
DO $$
BEGIN
    INSERT INTO points (customer_id, amount, reason)
    VALUES (1, 50, '注文ポイント');
EXCEPTION WHEN OTHERS THEN
    -- Catch errors such as the points table not existing
    RAISE NOTICE 'ポイント付与失敗: %', SQLERRM;
    ROLLBACK TO SAVEPOINT items_added;
    -- Only the points award is undone; the order is preserved
END $$;

-- Deduct inventory (required)
UPDATE products SET stock = stock - 2 WHERE id = 1;

COMMIT;

-- SAVEPOINT hierarchy:
-- BEGIN
--   └── SAVEPOINT order_created
--         └── SAVEPOINT items_added
--               └── Points award (roll back to here on failure)
--         └── Inventory deduction
-- COMMIT
```

**When to use SAVEPOINTs**: Use them when you do not want a failure in part of the work to roll back the entire transaction. In PostgreSQL, an error inside a transaction causes all subsequent SQL statements to be rejected, so without a SAVEPOINT you cannot even issue COMMIT.

---

## 2. Isolation Levels

### Why Isolation Levels Are Necessary

Guaranteeing complete isolation (SERIALIZABLE) at all times degrades concurrent performance significantly. Real-world applications require a trade-off where the degree of isolation is chosen based on the use case.

### Code Example 3: Setting the Isolation Level

```sql
-- Set per transaction
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;
-- ... operations ...
COMMIT;

-- Set per session
SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL REPEATABLE READ;

-- Check the current isolation level (PostgreSQL)
SHOW transaction_isolation;
-- Result: "read committed" (default)

-- Check the default isolation level in MySQL
-- SELECT @@transaction_isolation;
-- Result: "REPEATABLE-READ" (MySQL default)

-- Change the server-wide default (postgresql.conf)
-- default_transaction_isolation = 'read committed'
```

### Relationship Between Isolation Levels and Anomalies

```
┌─────── Isolation Levels and Anomalies ──────────────┐
│                                                      │
│  Anomalies (abnormal phenomena):                     │
│                                                      │
│  1. Dirty Read: uncommitted data is visible          │
│  ┌─────┐                ┌─────┐                      │
│  │ Tx1 │ UPDATE balance │ Tx2 │ SELECT balance       │
│  │     │ = 500          │     │ → 500 (not COMMIT!)  │
│  │     │ ROLLBACK       │     │ ← uses invalid value │
│  └─────┘                └─────┘                      │
│                                                      │
│  2. Non-Repeatable Read: same SELECT returns diff.   │
│  ┌─────┐                ┌─────┐                      │
│  │ Tx1 │ SELECT → 1000  │ Tx2 │                      │
│  │     │                │     │ UPDATE → 500         │
│  │     │                │     │ COMMIT               │
│  │     │ SELECT → 500   │     │ ← value changed!     │
│  └─────┘                └─────┘                      │
│                                                      │
│  3. Phantom Read: row count changes                  │
│  ┌─────┐                ┌─────┐                      │
│  │ Tx1 │ COUNT → 10     │ Tx2 │                      │
│  │     │                │     │ INSERT (add 1 row)   │
│  │     │                │     │ COMMIT               │
│  │     │ COUNT → 11     │     │ ← row count changed! │
│  └─────┘                └─────┘                      │
│                                                      │
│  4. Serialization Anomaly: a result that could not   │
│     occur in serial execution occurs concurrently    │
│  ┌─────┐                ┌─────┐                      │
│  │ Tx1 │ read x=1→write y=1│ Tx2│ read y=1→write x=1│
│  │     │ result: x=0,y=1│     │ result: x=1,y=0     │
│  │     │ serial would give x=1,y=1 or x=0,y=0       │
│  └─────┘                └─────┘                      │
└──────────────────────────────────────────────────────┘
```

### Code Example 4: Behavior at Each Isolation Level

```sql
-- ===== READ UNCOMMITTED =====
-- In PostgreSQL this effectively behaves as READ COMMITTED
-- In MySQL InnoDB dirty reads actually occur
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

-- ===== READ COMMITTED (PostgreSQL default) =====
-- A snapshot is taken at the start of each SQL statement
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
BEGIN;
SELECT balance FROM accounts WHERE id = 1;  -- 1000

-- If another transaction UPDATEs and COMMITs here
SELECT balance FROM accounts WHERE id = 1;  -- 1200 (changed)
-- → Even within the same transaction, the latest COMMITted data is visible
COMMIT;

-- ===== REPEATABLE READ =====
-- A snapshot is taken at the start of the transaction (first query execution)
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
BEGIN;
SELECT balance FROM accounts WHERE id = 1;  -- 1000

-- Even if another transaction UPDATEs and COMMITs here
SELECT balance FROM accounts WHERE id = 1;  -- 1000 (unchanged)
-- → The snapshot from the start of the transaction is consistently visible

-- However, if your own UPDATE conflicts with another Tx, an error occurs
UPDATE accounts SET balance = balance + 100 WHERE id = 1;
-- ERROR: could not serialize access due to concurrent update
COMMIT;

-- ===== SERIALIZABLE (strictest) =====
-- Guarantees a result equivalent to serial execution
-- Implemented with SSI (Serializable Snapshot Isolation)
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN;
-- If there are transactions that conflict in read/write on the same data,
-- one of them is aborted with a serialization failure error
SELECT SUM(balance) FROM accounts;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
COMMIT;
-- ERROR: could not serialize access due to read/write dependencies
-- → Retry is required
```

### Code Example 5: Retry Logic for SERIALIZABLE Isolation Level

```sql
-- Retry logic on the application side (pseudocode → PL/pgSQL implementation)
CREATE OR REPLACE FUNCTION transfer_with_retry(
    p_from_account VARCHAR,
    p_to_account   VARCHAR,
    p_amount       DECIMAL,
    p_max_retries  INTEGER DEFAULT 3
) RETURNS VOID AS $$
DECLARE
    v_retries INTEGER := 0;
    v_success BOOLEAN := FALSE;
BEGIN
    WHILE NOT v_success AND v_retries < p_max_retries LOOP
        BEGIN
            -- Execute at SERIALIZABLE isolation level
            SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

            -- Check balance
            IF (SELECT balance FROM accounts WHERE account_id = p_from_account) < p_amount THEN
                RAISE EXCEPTION '残高不足';
            END IF;

            -- Execute transfer
            UPDATE accounts SET balance = balance - p_amount
            WHERE account_id = p_from_account;
            UPDATE accounts SET balance = balance + p_amount
            WHERE account_id = p_to_account;

            -- Record transfer history
            INSERT INTO transfer_log (from_account, to_account, amount, transferred_at)
            VALUES (p_from_account, p_to_account, p_amount, NOW());

            v_success := TRUE;

        EXCEPTION
            WHEN serialization_failure OR deadlock_detected THEN
                v_retries := v_retries + 1;
                RAISE NOTICE 'リトライ %/% (理由: %)', v_retries, p_max_retries, SQLERRM;
                -- Exponential backoff wait
                PERFORM pg_sleep(0.1 * power(2, v_retries - 1));
        END;
    END LOOP;

    IF NOT v_success THEN
        RAISE EXCEPTION '最大リトライ回数超過 (%回)', p_max_retries;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Usage example
SELECT transfer_with_retry('A001', 'B002', 10000);
```

---

## 3. Deadlocks

### How Deadlocks Work

```
┌────────────── Deadlock Structure ──────────────────┐
│                                                     │
│  Resource dependency graph (Wait-for Graph):        │
│                                                     │
│  Tx1 ──(waiting for B)──→ Tx2                       │
│   ↑                         │                       │
│   └──(waiting for A)────────┘                       │
│                                                     │
│  Circular wait = deadlock                           │
│                                                     │
│  Timeline:                                          │
│  t1: Tx1 → LOCK(A) ✓                               │
│  t2: Tx2 → LOCK(B) ✓                               │
│  t3: Tx1 → LOCK(B) → waiting (Tx2 holds B)         │
│  t4: Tx2 → LOCK(A) → waiting (Tx1 holds A)         │
│  → Mutually waiting → never resolves!               │
│                                                     │
│  PostgreSQL countermeasure:                         │
│  - After deadlock_timeout (default 1s) elapses,     │
│    inspect the Wait-for Graph                       │
│  - If a cycle is detected, force ROLLBACK one Tx    │
│  - Outputs "Process X waits for ... blocked by      │
│    process Y" to the log                            │
└─────────────────────────────────────────────────────┘
```

### Code Example 6: Deadlock Occurrence and Countermeasures

```sql
-- ===== Typical deadlock scenario =====
-- Terminal 1 (Tx1):
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE account_id = 'A001';  -- locks A001
-- Tx2 locks B002 here
UPDATE accounts SET balance = balance + 100 WHERE account_id = 'B002';  -- waiting for B002...

-- Terminal 2 (Tx2):
BEGIN;
UPDATE accounts SET balance = balance - 200 WHERE account_id = 'B002';  -- locks B002
-- Tx1 has already locked A001
UPDATE accounts SET balance = balance + 200 WHERE account_id = 'A001';  -- waiting for A001...
-- → Deadlock!

-- ===== Countermeasure 1: always acquire locks in the same order =====
-- If all transactions acquire locks in ascending ID order, cycles cannot form
BEGIN;
-- Acquire locks in ascending account_id order
UPDATE accounts SET balance = balance - 100 WHERE account_id = 'A001';  -- A → B order
UPDATE accounts SET balance = balance + 100 WHERE account_id = 'B002';
COMMIT;

-- ===== Countermeasure 2: acquire locks upfront with SELECT FOR UPDATE =====
BEGIN;
-- Acquire locks after sorting with ORDER BY
SELECT * FROM accounts
WHERE account_id IN ('A001', 'B002')
ORDER BY account_id
FOR UPDATE;
-- ↑ Both A001 and B002 are locked at this point
-- Other Txs wait, but deadlock does not occur

UPDATE accounts SET balance = balance - 100 WHERE account_id = 'A001';
UPDATE accounts SET balance = balance + 100 WHERE account_id = 'B002';
COMMIT;

-- ===== Countermeasure 3: set a lock timeout =====
SET lock_timeout = '5s';  -- give up waiting for a lock after 5 seconds
-- ERROR: canceling statement due to lock timeout

-- ===== Countermeasure 4: verify the deadlock detection setting =====
SHOW deadlock_timeout;
-- Default: 1s (deadlock detection runs after waiting this long)
```

### Code Example 7: Optimistic Locking vs. Pessimistic Locking

```sql
-- ===== Pessimistic Locking =====
-- Acquire a lock before operating on data
-- Suitable when: conflicts occur frequently

-- Basic form: FOR UPDATE
BEGIN;
SELECT * FROM products WHERE id = 42 FOR UPDATE;
-- → Other Txs with FOR UPDATE must wait
UPDATE products SET stock = stock - 1 WHERE id = 42;
COMMIT;

-- NOWAIT: return an error immediately if the lock cannot be acquired
SELECT * FROM products WHERE id = 42 FOR UPDATE NOWAIT;
-- ERROR: could not obtain lock on row in relation "products"
-- → The application can handle the error immediately

-- SKIP LOCKED: skip locked rows (suited for queue processing)
SELECT id, task_data FROM tasks
WHERE status = 'pending'
ORDER BY created_at
LIMIT 1
FOR UPDATE SKIP LOCKED;
-- → Workers acquire unprocessed tasks concurrently
-- → The same task will not be picked up by multiple workers

-- FOR SHARE: read lock (other Txs' UPDATEs wait, SELECTs are allowed)
SELECT * FROM products WHERE id = 42 FOR SHARE;


-- ===== Optimistic Locking =====
-- No lock is acquired; conflicts are detected at update time
-- Suitable when: conflicts are rare, stateless environments such as Web APIs

-- Step 1: record the version when reading data
SELECT id, name, stock, version FROM products WHERE id = 42;
-- → stock=10, version=5

-- Step 2: verify the version matches when updating
UPDATE products
SET stock = stock - 1,
    version = version + 1
WHERE id = 42
  AND version = 5;  -- verify it matches the version read earlier
-- → if rows affected = 0, a conflict occurred → retry in the application

-- Using updated_at instead of a version column
UPDATE products
SET stock = stock - 1,
    updated_at = NOW()
WHERE id = 42
  AND updated_at = '2024-01-15 10:30:00';
-- → Be careful about timestamp precision (compare up to microseconds)
```

### Code Example 8: Advisory Locks

```sql
-- ===== Advisory Locks =====
-- Application-level locks on arbitrary keys, not on tables or rows
-- Enables flexible mutual exclusion without affecting table-level locks

-- Session-level advisory lock
-- Other sessions that try to acquire the same key are blocked
SELECT pg_advisory_lock(12345);  -- acquire lock (blocking)
-- ... exclusive processing ...
SELECT pg_advisory_unlock(12345);  -- release lock

-- Non-blocking version: try to acquire; returns FALSE if unavailable
SELECT pg_try_advisory_lock(12345);  -- TRUE / FALSE

-- Transaction-level: automatically released on COMMIT/ROLLBACK
BEGIN;
SELECT pg_advisory_xact_lock(12345);
-- ... processing ...
COMMIT;  -- lock released automatically

-- Using two keys (e.g., combination of table ID + row ID)
SELECT pg_advisory_lock(hashtext('orders'), 42);

-- Practical example: preventing duplicate external API calls
CREATE OR REPLACE FUNCTION process_payment(p_order_id INTEGER)
RETURNS VOID AS $$
BEGIN
    -- Acquire an advisory lock using the order ID
    IF NOT pg_try_advisory_xact_lock(hashtext('payment'), p_order_id) THEN
        RAISE EXCEPTION '同じ注文の決済が処理中です';
    END IF;

    -- Payment processing (including external API calls)
    UPDATE orders SET status = 'processing' WHERE id = p_order_id;
    -- ... external API call ...
    UPDATE orders SET status = 'paid' WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. MVCC (Multi-Version Concurrency Control)

### Internal Structure of MVCC

PostgreSQL implements MVCC by attaching invisible system columns (`xmin`, `xmax`) to each row.

```
┌──────────── MVCC Internal Structure (PostgreSQL) ─────────────┐
│                                                                │
│  Each tuple (row) header:                                      │
│  ┌────────────────────────────────────────────────┐           │
│  │ xmin  = 100  (ID of the Tx that inserted this row)        │  │
│  │ xmax  = 0    (ID of the Tx that deleted/updated this row) │  │
│  │ ctid  = (0,1)(physical location: page 0, tuple 1)        │  │
│  │ infomask = ...(commit/abort flags, etc.)                  │  │
│  │ [row data]                                                │  │
│  └────────────────────────────────────────────────┘           │
│                                                                │
│  How UPDATE works internally:                                  │
│  ① Set xmax of the old tuple to the current TxID             │
│  ② INSERT the new tuple elsewhere (xmin = current TxID)      │
│  ③ Update ctid of the old tuple to the new tuple's location  │
│                                                                │
│  Example: Tx200 executes UPDATE accounts SET balance=900       │
│                                                                │
│  Old tuple:                                                    │
│  xmin=100, xmax=200, ctid=(0,5) → points to new tuple         │
│  balance=1000                                                  │
│                                                                │
│  New tuple:                                                    │
│  xmin=200, xmax=0, ctid=(0,5)                                 │
│  balance=900                                                   │
│                                                                │
│  → The old tuple is not deleted immediately (other Txs may    │
│    still reference it)                                         │
│  → VACUUM reclaims old tuples that are no longer needed       │
└────────────────────────────────────────────────────────────────┘
```

### Code Example 9: Verifying MVCC Behavior

```sql
-- Check xmin, xmax
-- In PostgreSQL they are accessible as hidden columns
SELECT xmin, xmax, ctid, * FROM accounts WHERE account_id = 'A001';
-- xmin=100, xmax=0, ctid=(0,1), account_id='A001', balance=100000

-- Check the current transaction ID
SELECT txid_current();
-- Result: 200

-- UPDATE inside a transaction
BEGIN;
UPDATE accounts SET balance = 90000 WHERE account_id = 'A001';

-- Check from another session (READ COMMITTED)
-- → The old tuple (balance=100000) is visible (Tx200 not yet committed)

COMMIT;

-- Check from another session again
-- → The new tuple (balance=90000) is visible

-- Check the snapshot
SELECT txid_current_snapshot();
-- Result: '200:205:200,202'
-- Meaning: xmin=200, xmax=205, running TxIDs=[200, 202]
-- → TxIDs below 200 are committed, 200 and 202 are running,
--   201, 203, 204 are committed, 205 and above have not started
```

### Code Example 10: VACUUM — Garbage Collection for MVCC

```sql
-- Check for unnecessary tuples (dead tuples)
SELECT
    schemaname,
    relname AS table_name,
    n_live_tup,          -- number of live tuples
    n_dead_tup,          -- number of dead tuples
    n_mod_since_analyze, -- changes since last ANALYZE
    last_vacuum,         -- timestamp of last VACUUM
    last_autovacuum,     -- timestamp of last autovacuum
    last_analyze         -- timestamp of last ANALYZE
FROM pg_stat_user_tables
WHERE n_dead_tup > 0
ORDER BY n_dead_tup DESC;

-- Manual VACUUM (normally leave this to autovacuum)
VACUUM (VERBOSE) accounts;
-- INFO: "accounts": found 150 removable, 1000 nonremovable row versions
-- INFO: "accounts": removed 150 row versions

-- VACUUM FULL: completely rewrites the table (exclusive lock)
-- → Normally use pg_repack instead (can run online)
VACUUM FULL accounts;

-- Check autovacuum parameters
SHOW autovacuum_vacuum_threshold;       -- 50 (default)
SHOW autovacuum_vacuum_scale_factor;    -- 0.2 (default)
-- → triggers automatically when dead tuples > 50 + 0.2 * n_live_tup

-- Change autovacuum settings per table
ALTER TABLE accounts SET (
    autovacuum_vacuum_threshold = 100,
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_threshold = 50,
    autovacuum_analyze_scale_factor = 0.02
);

-- Check table bloat ratio
SELECT
    relname,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    pg_size_pretty(pg_relation_size(relid)) AS table_size,
    ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 1) AS dead_pct
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 10;
```

---

## 5. Transaction Design Patterns

### Code Example 11: Idempotent Transaction Design

```sql
-- ===== Idempotent Design =====
-- A design where running the same operation multiple times produces the same result
-- Essential in environments where retries occur due to network failures

-- Bad: not idempotent (amount doubles on duplicate execution)
INSERT INTO payments (order_id, amount) VALUES (42, 10000);

-- Good: idempotent (only one record regardless of how many times it runs)
INSERT INTO payments (order_id, amount)
VALUES (42, 10000)
ON CONFLICT (order_id) DO NOTHING;

-- Good: idempotent design using an idempotency key
CREATE TABLE payments (
    id              SERIAL PRIMARY KEY,
    idempotency_key UUID UNIQUE NOT NULL,  -- unique key generated by the client
    order_id        INTEGER NOT NULL,
    amount          DECIMAL(10, 2) NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent duplicates with the idempotency key
INSERT INTO payments (idempotency_key, order_id, amount)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 42, 10000)
ON CONFLICT (idempotency_key) DO NOTHING
RETURNING *;
-- → On the second execution nothing is inserted and RETURNING is empty
```

### Code Example 12: Distributed Transactions — Saga Pattern

```sql
-- ===== Saga Pattern (transactions across microservices) =====
-- Maintains consistency via local transactions per service + compensating transactions

-- Saga state management table
CREATE TABLE saga_instances (
    saga_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    saga_type     VARCHAR(50) NOT NULL,
    current_step  INTEGER NOT NULL DEFAULT 0,
    status        VARCHAR(20) NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running', 'completed', 'compensating', 'failed')),
    payload       JSONB NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE saga_steps (
    saga_id       UUID REFERENCES saga_instances(saga_id),
    step_number   INTEGER NOT NULL,
    step_name     VARCHAR(100) NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    result        JSONB,
    executed_at   TIMESTAMPTZ,
    compensated_at TIMESTAMPTZ,
    PRIMARY KEY (saga_id, step_number)
);

-- Order saga example:
-- Step 1: Reserve inventory   → Compensation: cancel inventory reservation
-- Step 2: Execute payment     → Compensation: process refund
-- Step 3: Arrange shipping    → Compensation: cancel shipment
-- Step 4: Confirm order

-- Each step runs in a local transaction
-- If a step fails, compensating transactions for completed steps run in reverse order
```

---

## Isolation Level Comparison Table

| Isolation Level | Dirty Read | Non-Repeatable Read | Phantom Read | Serialization Anomaly | Performance |
|-----------|:---:|:---:|:---:|:---:|:---:|
| READ UNCOMMITTED | Occurs | Occurs | Occurs | Occurs | Fastest |
| READ COMMITTED | **Prevented** | Occurs | Occurs | Occurs | Fast |
| REPEATABLE READ | **Prevented** | **Prevented** | Occurs* | Occurs | Moderate |
| SERIALIZABLE | **Prevented** | **Prevented** | **Prevented** | **Prevented** | Slowest |

*PostgreSQL's REPEATABLE READ uses SI (Snapshot Isolation), a precursor to SSI (Serializable Snapshot Isolation), which also prevents phantom reads. However, write skew is not prevented.

## Lock Method Comparison Table

| Method | Lock Timing | Conflict Detection | Throughput | Suitable For | Retry Required |
|------|:---:|:---:|:---:|-----------|:---:|
| Pessimistic locking (FOR UPDATE) | At read | Prevented upfront | Low | When conflicts are frequent | No |
| Optimistic locking (version) | At update | Detected after the fact | High | When conflicts are rare | Yes |
| SKIP LOCKED | At read | Skipped | High | Queue / job processing | No |
| FOR UPDATE NOWAIT | At read | Immediate error | High | Short-lived processing | Yes |
| Advisory lock | Arbitrary | App-controlled | Flexible | External API mutual exclusion | Yes |

## RDBMS Default Comparison Table

| RDBMS | Default Isolation Level | MVCC | Deadlock Detection |
|-------|:---:|:---:|:---:|
| PostgreSQL | READ COMMITTED | Snapshot Isolation | Wait-for Graph (after 1 s) |
| MySQL InnoDB | REPEATABLE READ | Undo Log-based | Wait-for Graph (immediate) |
| Oracle | READ COMMITTED | Undo Tablespace-based | Immediate detection |
| SQL Server | READ COMMITTED | Lock-based (MVCC when RCSI enabled) | Wait-for Graph (5 s) |
| SQLite | SERIALIZABLE | MVCC in WAL mode | Timeout (5 s) |

---

## Anti-Patterns

### Anti-Pattern 1: Long-Running Transactions

```sql
-- Bad: waiting for user input inside a transaction
BEGIN;
SELECT * FROM products WHERE id = 42 FOR UPDATE;
-- ... user is thinking on the screen (lock held for several minutes) ...
UPDATE products SET price = 1000 WHERE id = 42;
COMMIT;

-- Problems:
-- 1. Long-held lock blocks other transactions
-- 2. Increased risk of deadlocks
-- 3. In MVCC environments, VACUUM is delayed (long-lived Tx holds a snapshot)
-- 4. Connection pool exhaustion
-- 5. Cause of replication lag

-- Good: keep transactions short (optimistic locking)
-- Read with a normal SELECT; only the update uses a short transaction
SELECT id, price, version FROM products WHERE id = 42;
-- → price=800, version=5
-- After the user action is complete, update in a short transaction
BEGIN;
UPDATE products SET price = 1000, version = version + 1
WHERE id = 42 AND version = 5;  -- optimistic lock
-- If rows affected = 0, retry
COMMIT;
```

### Anti-Pattern 2: Unnecessarily High Isolation Level

```sql
-- Bad: setting everything to SERIALIZABLE
SET default_transaction_isolation = 'serializable';

-- Problems:
-- 1. Serialization failures cause frequent retries (reduced concurrency)
-- 2. Performance may drop by 20–50%
-- 3. READ COMMITTED is sufficient in most cases
-- 4. Retry logic must be implemented for every transaction

-- Good: choose the isolation level based on the use case
-- General CRUD operations: READ COMMITTED (default)
BEGIN;
UPDATE products SET stock = stock - 1 WHERE id = 42;
COMMIT;

-- Balance calculations and consistency checks: REPEATABLE READ
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT SUM(balance) FROM accounts;
-- Even if another Tx changes a balance midway, the snapshot remains consistent
COMMIT;

-- Financial processing requiring strict consistency: SERIALIZABLE
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
-- Prevent double-spending, etc.
COMMIT;
```

### Anti-Pattern 3: Uncommitted Transactions Left Open

```sql
-- Bad: leaving a BEGIN open without committing
BEGIN;
SELECT * FROM large_table;
-- ... connection left open without doing anything ...
-- → VACUUM cannot reclaim dead tuples
-- → Table bloat progresses

-- Detect the problem
SELECT pid, state, query, xact_start,
       NOW() - xact_start AS duration
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND xact_start < NOW() - INTERVAL '5 minutes';

-- Countermeasure: set idle_in_transaction_session_timeout
SET idle_in_transaction_session_timeout = '10min';
-- → Automatically disconnect transactions that are idle for 10 minutes

-- Recommended setting in postgresql.conf
-- idle_in_transaction_session_timeout = '10min'
```

---

## Hands-On Exercises

### Exercise 1 (Basic): Basic Operations with Transactions and SAVEPOINTs

Implement the following scenario in SQL.

**Requirements**:
1. Decrease the inventory of product A (id=1) by 3 in the `warehouse_items` table
2. Insert a shipment record into the `shipments` table
3. Insert a notification into the `notifications` table, but allow the shipment to succeed even if this fails
4. Roll back the entire transaction if the inventory would drop below 0

```sql
-- Test tables
CREATE TABLE warehouse_items (
    id    INTEGER PRIMARY KEY,
    name  VARCHAR(100) NOT NULL,
    stock INTEGER NOT NULL CHECK (stock >= 0)
);

CREATE TABLE shipments (
    id         SERIAL PRIMARY KEY,
    item_id    INTEGER NOT NULL REFERENCES warehouse_items(id),
    quantity   INTEGER NOT NULL,
    shipped_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
    id         SERIAL PRIMARY KEY,
    message    TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO warehouse_items VALUES (1, '商品A', 10);
```

<details>
<summary>Sample Answer</summary>

```sql
BEGIN;

-- Step 1: deduct inventory
UPDATE warehouse_items SET stock = stock - 3 WHERE id = 1;

-- Step 2: inventory check
DO $$
BEGIN
    IF (SELECT stock FROM warehouse_items WHERE id = 1) < 0 THEN
        RAISE EXCEPTION '在庫不足: 商品A';
    END IF;
END $$;

-- Step 3: insert shipment record
INSERT INTO shipments (item_id, quantity)
VALUES (1, 3);
SAVEPOINT after_shipment;

-- Step 4: insert notification (shipment succeeds even if this fails)
DO $$
BEGIN
    INSERT INTO notifications (message)
    VALUES ('商品A: 3個出荷しました');
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '通知の送信に失敗しましたが、出荷は成立します: %', SQLERRM;
    ROLLBACK TO SAVEPOINT after_shipment;
END $$;

COMMIT;

-- Verification
SELECT * FROM warehouse_items WHERE id = 1;
-- stock = 7
SELECT * FROM shipments WHERE item_id = 1;
-- quantity = 3
```

**Explanation**: By placing a SAVEPOINT at `after_shipment`, all processing up to and including the shipment record is preserved even if the notification insert fails. Because an error inside a PostgreSQL transaction invalidates all subsequent SQL statements, you must catch the error in an EXCEPTION block and roll back to the SAVEPOINT.

</details>

### Exercise 2 (Intermediate): Full Implementation of Optimistic Locking

Implement a purchase flow for an e-commerce site's inventory management using optimistic locking.

**Requirements**:
1. Use a `version` column in the `products` table for optimistic locking
2. Return an appropriate error message when stock is insufficient
3. Retry up to 3 times on a version conflict
4. Apply exponential backoff between retries

```sql
CREATE TABLE products (
    id       SERIAL PRIMARY KEY,
    name     VARCHAR(200) NOT NULL,
    stock    INTEGER NOT NULL CHECK (stock >= 0),
    price    DECIMAL(10, 2) NOT NULL,
    version  INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO products VALUES (1, 'ノートPC', 5, 98000, 1, NOW());
```

<details>
<summary>Sample Answer</summary>

```sql
CREATE OR REPLACE FUNCTION purchase_product(
    p_product_id  INTEGER,
    p_quantity    INTEGER,
    p_max_retries INTEGER DEFAULT 3
) RETURNS TABLE (
    success    BOOLEAN,
    message    TEXT,
    new_stock  INTEGER,
    new_version INTEGER
) AS $$
DECLARE
    v_current_stock   INTEGER;
    v_current_version INTEGER;
    v_rows_affected   INTEGER;
    v_retries         INTEGER := 0;
BEGIN
    LOOP
        -- Step 1: read current data (no lock)
        SELECT stock, version
        INTO v_current_stock, v_current_version
        FROM products
        WHERE id = p_product_id;

        -- Product not found
        IF NOT FOUND THEN
            RETURN QUERY SELECT FALSE, '商品が見つかりません'::TEXT, 0, 0;
            RETURN;
        END IF;

        -- Insufficient stock check
        IF v_current_stock < p_quantity THEN
            RETURN QUERY SELECT FALSE,
                format('在庫不足: 要求=%s, 在庫=%s', p_quantity, v_current_stock)::TEXT,
                v_current_stock, v_current_version;
            RETURN;
        END IF;

        -- Step 2: UPDATE with optimistic lock
        UPDATE products
        SET stock = stock - p_quantity,
            version = version + 1,
            updated_at = NOW()
        WHERE id = p_product_id
          AND version = v_current_version;

        GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

        -- Update succeeded
        IF v_rows_affected = 1 THEN
            RETURN QUERY SELECT TRUE,
                '購入成功'::TEXT,
                v_current_stock - p_quantity,
                v_current_version + 1;
            RETURN;
        END IF;

        -- Version conflict → retry
        v_retries := v_retries + 1;
        IF v_retries >= p_max_retries THEN
            RETURN QUERY SELECT FALSE,
                format('最大リトライ回数(%s)を超過しました', p_max_retries)::TEXT,
                0, 0;
            RETURN;
        END IF;

        -- Exponential backoff (0.1 s, 0.2 s, 0.4 s, ...)
        PERFORM pg_sleep(0.1 * power(2, v_retries - 1));
        RAISE NOTICE 'バージョン競合 → リトライ %/%', v_retries, p_max_retries;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Usage example
SELECT * FROM purchase_product(1, 2);
-- success=true, message='購入成功', new_stock=3, new_version=2

-- Insufficient stock test
SELECT * FROM purchase_product(1, 100);
-- success=false, message='在庫不足: 要求=100, 在庫=3'
```

**Explanation**: With optimistic locking, if another transaction modifies the data between the SELECT and the UPDATE, the condition `WHERE version = v_current_version` does not match and `ROW_COUNT = 0`. In that case a retry is performed. Exponential backoff prevents excessive retries under high load.

</details>

### Exercise 3 (Advanced): Verifying Isolation Level Behavior

Use two terminals (sessions) to actually verify the differences between isolation levels.

**Tasks**:
1. Confirm that a "non-repeatable read" occurs under READ COMMITTED
2. Confirm that a "non-repeatable read" is prevented under REPEATABLE READ
3. Confirm that an update conflict error occurs under REPEATABLE READ
4. Confirm that a "write skew" is detected under SERIALIZABLE

```sql
-- Setup
CREATE TABLE test_accounts (
    id      INTEGER PRIMARY KEY,
    balance INTEGER NOT NULL,
    type    VARCHAR(20) NOT NULL
);
INSERT INTO test_accounts VALUES (1, 1000, 'checking');
INSERT INTO test_accounts VALUES (2, 2000, 'savings');
```

<details>
<summary>Sample Answer</summary>

```sql
-- ===== Verification 1: Non-Repeatable Read under READ COMMITTED =====

-- Terminal 1:
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;
SELECT balance FROM test_accounts WHERE id = 1;
-- Result: 1000

-- Terminal 2:
BEGIN;
UPDATE test_accounts SET balance = 1500 WHERE id = 1;
COMMIT;

-- Terminal 1 (continued):
SELECT balance FROM test_accounts WHERE id = 1;
-- Result: 1500 ← value changed! (non-repeatable read)
COMMIT;


-- ===== Verification 2: Prevention under REPEATABLE READ =====

-- Terminal 1:
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT balance FROM test_accounts WHERE id = 1;
-- Result: 1500

-- Terminal 2:
BEGIN;
UPDATE test_accounts SET balance = 2000 WHERE id = 1;
COMMIT;

-- Terminal 1 (continued):
SELECT balance FROM test_accounts WHERE id = 1;
-- Result: 1500 ← value unchanged! (non-repeatable read prevented)
COMMIT;

-- Check again from Terminal 1 after commit:
SELECT balance FROM test_accounts WHERE id = 1;
-- Result: 2000 ← latest value visible after COMMIT


-- ===== Verification 3: Update conflict under REPEATABLE READ =====

-- Setup
UPDATE test_accounts SET balance = 1000 WHERE id = 1;

-- Terminal 1:
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT balance FROM test_accounts WHERE id = 1;  -- 1000

-- Terminal 2:
BEGIN;
UPDATE test_accounts SET balance = 1500 WHERE id = 1;
COMMIT;

-- Terminal 1 (continued):
UPDATE test_accounts SET balance = balance + 100 WHERE id = 1;
-- ERROR: could not serialize access due to concurrent update
ROLLBACK;


-- ===== Verification 4: Write skew detection under SERIALIZABLE =====

-- Setup: on-call doctors (at least one must always be on duty)
UPDATE test_accounts SET balance = 1000 WHERE id = 1;
UPDATE test_accounts SET balance = 2000 WHERE id = 2;

-- Rule: the sum of id=1 and id=2 must be greater than 0

-- Terminal 1:
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
-- Check total: 3000 > 0, OK
SELECT SUM(balance) FROM test_accounts;
-- Set id=1 balance to 0
UPDATE test_accounts SET balance = 0 WHERE id = 1;

-- Terminal 2 (runs before Tx1 COMMITs):
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
-- Check total: 3000 > 0, OK (Tx1's change is not visible)
SELECT SUM(balance) FROM test_accounts;
-- Set id=2 balance to 0
UPDATE test_accounts SET balance = 0 WHERE id = 2;

-- Terminal 1:
COMMIT;  -- succeeds

-- Terminal 2:
COMMIT;
-- ERROR: could not serialize access due to read/write dependencies
-- → Write skew is detected and Tx2 is rolled back
-- → Total dropping to 0 is prevented!
```

**Explanation**: Write skew occurs when two transactions each read a different row, verify that a condition is satisfied, and then update different rows. READ COMMITTED and REPEATABLE READ cannot detect it; only SERIALIZABLE can prevent it. This is the representative case where SERIALIZABLE is needed.

</details>


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured configuration file | Verify the configuration file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Growing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Verify the executing user's privileges, review settings |
| Data inconsistency | Concurrent processing conflict | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace and identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with the minimal amount of code
3. **Form hypotheses**: List the possible causes
4. **Validate incrementally**: Use log output or a debugger to verify each hypothesis
5. **Fix and run regression tests**: After fixing, also run tests for related areas

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

### Diagnosing Performance Problems

Steps for diagnosing performance problems:

1. **Identify the bottleneck**: measure with a profiling tool
2. **Check memory usage**: look for memory leaks
3. **Check I/O wait**: examine disk and network I/O conditions
4. **Check concurrent connections**: review the state of the connection pool

| Problem Type | Diagnostic Tool | Countermeasure |
|-----------|-----------|------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Asynchronous I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | When to Prioritize | When to Compromise |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin screens, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow            │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① What is the team size?                       │
│    ├─ Small (1–5 people) → Monolith             │
│    └─ Large (10+ people) → go to ②             │
│                                                 │
│  ② How frequent are deployments?                │
│    ├─ Weekly or less → Monolith + modular split  │
│    └─ Daily / multiple times → go to ③         │
│                                                 │
│  ③ How independent are the teams?               │
│    ├─ High → Microservices                       │
│    └─ Moderate → Modular monolith                │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Every technical decision involves trade-offs. Analyze from the following perspectives:

**1. Short-term vs. long-term cost**
- A fast short-term approach can become technical debt in the long run
- Conversely, over-engineering incurs high short-term costs and can delay the project

**2. Consistency vs. flexibility**
- A unified technology stack has a low learning curve
- Adopting diverse technologies allows the right tool for the job but increases operational cost

**3. Level of abstraction**
- High abstraction increases reusability but can make debugging harder
- Low abstraction is intuitive but tends to produce duplicate code

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

### Q1: What is AUTO COMMIT?

When AUTO COMMIT is enabled (the PostgreSQL default), each SQL statement is automatically executed as an independent transaction. Without an explicit `BEGIN`/`COMMIT`, each statement is automatically committed upon completion.

**Notes**:
- In `psql`, AUTO COMMIT is enabled by default (`\set AUTOCOMMIT on`)
- With `\set AUTOCOMMIT off`, all SQL runs inside a transaction
- In batch processing, wrapping statements explicitly in BEGIN prevents intermediate commits
- Application frameworks (Django, Rails, etc.) typically manage transactions per request

### Q2: What is the difference between PostgreSQL's MVCC and lock-based approaches?

**MVCC (Multi-Version Concurrency Control)**:
- Maintains multiple versions of each row so reads and writes do not block each other
- SELECT acquires no lock and reads a snapshot taken at the start of the transaction
- **Advantage**: READERs and WRITERs coexist; reads are not delayed
- **Disadvantage**: accumulation of obsolete versions (VACUUM is required), table bloat

**Lock-based (SQL Server default, etc.)**:
- Controlled with shared locks (reads) and exclusive locks (writes)
- READERs wait if a WRITER is present
- **Advantage**: simpler implementation, no VACUUM needed
- **Disadvantage**: reads and writes conflict, more deadlocks

### Q3: Under what circumstances is a transaction rolled back?

(1) An explicit `ROLLBACK` statement is executed
(2) An error occurs, such as a constraint violation (CHECK, FK, UNIQUE, etc.) or a deadlock
(3) The client connection is dropped
(4) `statement_timeout` or `idle_in_transaction_session_timeout` is exceeded
(5) `serialization_failure` (conflict under SERIALIZABLE or REPEATABLE READ)
(6) `lock_timeout` is exceeded
(7) Disk space exhaustion or OOM (Out of Memory)

In PostgreSQL, after an error occurs all subsequent statements in the transaction are rejected (`ERROR: current transaction is aborted, commands ignored until end of transaction block`). Partial recovery is only possible when SAVEPOINTs are in use.

### Q4: What is Two-Phase Commit (2PC)?

2PC (Two-Phase Commit) is a protocol that guarantees atomicity for transactions spanning multiple databases or resource managers.

**Phase 1 (Prepare)**: The coordinator asks each participant "are you ready?". Each participant persists its data and replies "YES" or "NO".
**Phase 2 (Commit/Abort)**: If all participants say YES, "COMMIT" is sent; if even one says NO, "ABORT" is sent.

PostgreSQL supports this via `PREPARE TRANSACTION`, but the overhead of distributed transactions is significant. In modern microservice architectures the Saga pattern is recommended instead.

### Q5: How should the transaction log (WAL) be configured?

```sql
-- Key WAL-related settings
SHOW wal_level;                 -- replica (default)
SHOW max_wal_size;              -- 1GB (default)
SHOW min_wal_size;              -- 80MB (default)
SHOW checkpoint_timeout;        -- 5min (default)
SHOW synchronous_commit;        -- on (default)

-- Performance-focused configuration (risk of data loss)
-- synchronous_commit = off
-- → COMMIT does not wait for WAL to be written (risk of losing up to wal_writer_delay of data)
-- → Effective for bulk INSERT batch processing
```

---

## Summary

| Item | Key Points |
|------|------|
| ACID | Four properties: Atomicity, Consistency, Isolation, Durability. WAL is the foundation |
| Default isolation level | PostgreSQL/Oracle: READ COMMITTED; MySQL: REPEATABLE READ |
| MVCC | Non-blocking reads and writes. Implemented by storing xmin/xmax on each row |
| VACUUM | Reclaims obsolete MVCC versions. Autovacuum configuration is important |
| Deadlock countermeasures | Consistent lock ordering, timeout settings, NOWAIT/SKIP LOCKED |
| Pessimistic locking | FOR UPDATE. Effective when conflicts are frequent. Blocking |
| Optimistic locking | version column. Effective when conflicts are rare. Retry required |
| Advisory lock | Application-level lock with no impact on tables or rows |
| Idempotent design | Design where repeated execution does not change the result. Essential in retry environments |
| Saga pattern | Transactions across microservices. Consistency maintained via compensating transactions |
| Best practices | Keep transactions short, use the minimum isolation level, always implement retry logic |

---

## What to Read Next

- [03-indexing.md](./03-indexing.md) — Relationship between locks and indexes, interaction of FOR UPDATE with indexes
- [04-query-optimization.md](./04-query-optimization.md) — Transactions and execution plans, the effect of locks
- [02-performance-tuning.md](../03-practical/02-performance-tuning.md) — Connection pools and transaction management, VACUUM strategy
- [00-normalization.md](../02-design/00-normalization.md) — Relationship between normalization and transaction design
- security-fundamentals/ — SQL injection countermeasures and transaction security

---

## References

1. PostgreSQL Documentation — "Transaction Isolation" https://www.postgresql.org/docs/current/transaction-iso.html
2. PostgreSQL Documentation — "Concurrency Control" https://www.postgresql.org/docs/current/mvcc.html
3. Kleppmann, M. (2017). *Designing Data-Intensive Applications*. O'Reilly Media. Chapter 7: Transactions.
4. Berenson, H. et al. (1995). "A Critique of ANSI SQL Isolation Levels". *SIGMOD Record*, 24(2).
5. Fekete, A. et al. (2005). "Making Snapshot Isolation Serializable". *ACM Transactions on Database Systems*, 30(2).
6. PostgreSQL Wiki — "Lock Monitoring" https://wiki.postgresql.org/wiki/Lock_Monitoring

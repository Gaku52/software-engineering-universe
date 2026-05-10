# DB Security — Authentication, Authorization, Encryption, SQL Injection, and Auditing

> Database security is a comprehensive effort to defend against threats at every layer — network, authentication, authorization, encryption, input validation, and auditing — based on the principle of Defense in Depth. SQL injection has remained in the OWASP Top 10 for over 20 years and is the most critical attack vector; complete defense through parameterized queries is mandatory. This chapter covers the design, implementation, and operation of database security centered on PostgreSQL, including internal implementation details.

---

## What You Will Learn

1. **Defense-in-Depth Design Philosophy** — Understand why layered protection from the network layer to the application layer is necessary
2. **PostgreSQL Authentication and Authorization Model** — Master pg_hba.conf, roles, privileges, and Row Level Security (RLS) internals and implementation
3. **Complete SQL Injection Defense** — Cover everything from understanding attack principles to parameterized queries, escaping dynamic SQL, and ORM considerations
4. **Data Encryption** — Understand how to implement encryption in transit (TLS) and at rest (column-level encryption, disk encryption)
5. **Audit Log Implementation and Operations** — Learn to implement trigger-based auditing, pgAudit, and change history tracking

---

## Prerequisites

The following knowledge is required to understand this chapter.

- [SQL Basics](../00-basics/00-sql-overview.md) — Basic SELECT/INSERT/UPDATE/DELETE operations
- [Transactions](../01-advanced/02-transactions.md) — ACID properties and transaction isolation levels
- [PostgreSQL Features](./00-postgresql-features.md) — Basics of JSONB, triggers, and PL/pgSQL
- Security Fundamentals — Basic concepts of information security
- Cryptography Basics — Fundamentals of hashing, symmetric encryption, and public key cryptography

---

## 1. Defense-in-Depth Design Philosophy

### 1.1 Why Defense in Depth is Necessary

The most important principle in database security is "do not rely on a single layer of defense." If the firewall is breached, authentication is still in place; if authentication is bypassed, authorization restricts access; if authorization is circumvented, encryption protects the data. Each layer blocks the attack even if the previous one is compromised.

```
┌──────────── DB Security Defense in Depth ──────────────────┐
│                                                         │
│  Layer 1: Network                                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Firewall / VPC / Security Groups                │   │
│  │ pg_hba.conf (source IP restrictions)            │   │
│  │ Port change (non-5432) / VPN / SSH tunnel       │   │
│  └─────────────────────────────────────────────────┘   │
│  WHY: Physically block unauthorized connection sources  │
│                                                         │
│  Layer 2: Authentication — "Who are you?"               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Password (SCRAM-SHA-256 recommended, MD5 avoid)  │   │
│  │ Client certificates (mTLS)                       │   │
│  │ LDAP / Active Directory / Kerberos integration   │   │
│  │ peer authentication (local Unix socket)          │   │
│  └─────────────────────────────────────────────────┘   │
│  WHY: Ensure only legitimate users can connect          │
│                                                         │
│  Layer 3: Authorization — "What can you do?"            │
│  ┌─────────────────────────────────────────────────┐   │
│  │ GRANT/REVOKE (table, column, schema level)       │   │
│  │ Row Level Security (row-level access control)    │   │
│  │ Principle of Least Privilege                     │   │
│  └─────────────────────────────────────────────────┘   │
│  WHY: Grant only the minimum operations even to         │
│       authenticated users                               │
│                                                         │
│  Layer 4: Input Validation                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Parameterized queries (SQL injection defense)    │   │
│  │ Input validation and sanitization                │   │
│  │ Abstracting the API layer via stored procedures  │   │
│  └─────────────────────────────────────────────────┘   │
│  WHY: Completely prevent query tampering via            │
│       malicious input                                   │
│                                                         │
│  Layer 5: Encryption                                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │ TLS communication (encryption in transit)        │   │
│  │ Column-level encryption (pgcrypto: AES-256,      │   │
│  │   bcrypt)                                        │   │
│  │ Disk encryption (LUKS, AWS EBS Encryption)       │   │
│  │ Backup encryption                                │   │
│  └─────────────────────────────────────────────────┘   │
│  WHY: Prevent reading data even if it is leaked         │
│                                                         │
│  Layer 6: Auditing                                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Query logs / pgAudit                             │   │
│  │ Change history table (audit_log)                 │   │
│  │ Anomaly detection / alerting                     │   │
│  └─────────────────────────────────────────────────┘   │
│  WHY: Root-cause analysis and evidence preservation     │
│       when a breach occurs                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Authentication and Authorization

### Code Example 1: pg_hba.conf and Role/Privilege Design

```sql
-- ===== pg_hba.conf configuration example =====
-- pg_hba.conf is PostgreSQL's authentication control file
-- Authentication method is specified per connection source, database, and user
-- Rules are evaluated top to bottom; the first matching rule is applied

-- TYPE    DATABASE    USER           ADDRESS         METHOD
-- -------------------------------------------------------
-- # Local connections: OS authentication (peer)
-- local   all         postgres                       peer
-- local   all         all                            peer
--
-- # Same host: password authentication (SCRAM-SHA-256 recommended)
-- host    all         all            127.0.0.1/32    scram-sha-256
-- host    all         all            ::1/128         scram-sha-256
--
-- # Application server: allow only from specific IP
-- host    myapp_db    app_user       10.0.1.0/24     scram-sha-256
-- host    myapp_db    app_readonly   10.0.1.0/24     scram-sha-256
--
-- # Admin: allow only via VPN (certificate authentication)
-- hostssl all         admin_user     10.10.0.0/16    cert
--
-- # All others: deny (most important!)
-- host    all         all            0.0.0.0/0       reject
-- host    all         all            ::/0            reject

-- WHY SCRAM-SHA-256?
-- MD5 has the following vulnerabilities:
-- 1. Simply hashes password + username with MD5 (fixed salt)
-- 2. Vulnerable to rainbow table attacks
-- 3. If the hash is leaked, replay attacks are possible
-- SCRAM-SHA-256 uses a challenge-response mechanism that resolves these issues

-- A reload is required after changing pg_hba.conf
SELECT pg_reload_conf();

-- ===== Role design (Principle of Least Privilege) =====

-- 1. Read-only role (for analytics/reporting)
CREATE ROLE app_readonly
    LOGIN
    PASSWORD 'readonly_secure_password_2024!'
    CONNECTION LIMIT 10   -- limit concurrent connections
    VALID UNTIL '2027-12-31';  -- password expiry

-- 2. Application role (CRUD operations)
CREATE ROLE app_readwrite
    LOGIN
    PASSWORD 'readwrite_secure_password_2024!'
    CONNECTION LIMIT 30;

-- 3. Migration role (DDL operations)
CREATE ROLE app_migration
    LOGIN
    PASSWORD 'migration_secure_password_2024!'
    CREATEDB
    CONNECTION LIMIT 3;

-- 4. Admin role (limit to minimal use)
CREATE ROLE app_admin
    LOGIN
    PASSWORD 'admin_secure_password_2024!'
    CREATEDB CREATEROLE
    CONNECTION LIMIT 2;

-- ===== Privilege inheritance via group roles =====

-- Development team group
CREATE ROLE developers NOLOGIN;  -- group role, cannot log in
GRANT app_readwrite TO developers;

-- Individual developer users
CREATE ROLE dev_tanaka LOGIN PASSWORD '...';
CREATE ROLE dev_suzuki LOGIN PASSWORD '...';
GRANT developers TO dev_tanaka;
GRANT developers TO dev_suzuki;

-- ===== Schema-level privileges =====

-- First, grant USAGE on the schema (without this, nothing in the schema can be accessed)
GRANT USAGE ON SCHEMA public TO app_readonly;
GRANT USAGE, CREATE ON SCHEMA public TO app_readwrite;

-- ===== Table-level privileges =====

GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
    TO app_readwrite;

-- Set default privileges for tables created in the future (important!)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO app_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_readwrite;

-- Sequence privileges (needed for INSERT on SERIAL columns)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_readwrite;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE ON SEQUENCES TO app_readwrite;

-- ===== Column-level privileges =====

-- Allow access to specific columns only (example: hiding salary info)
REVOKE SELECT ON users FROM app_readonly;
GRANT SELECT (id, name, email, department, created_at) ON users
    TO app_readonly;
-- → app_readonly cannot access the salary or password_hash columns

-- ===== Verifying privileges =====

-- Check table privileges
SELECT grantee, table_name, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
ORDER BY grantee, table_name;

-- Check role membership
SELECT r.rolname AS role, m.rolname AS member
FROM pg_auth_members am
JOIN pg_roles r ON am.roleid = r.oid
JOIN pg_roles m ON am.member = m.oid;
```

### Code Example 2: Row Level Security (RLS) Implementation

```sql
-- ===== How RLS works =====
-- RLS is a feature that sets access policies on each row of a table
-- Conditions are automatically added to the SQL WHERE clause (works transparently)

-- Create table
CREATE TABLE documents (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    body        TEXT,
    owner_id    INTEGER NOT NULL,
    department  VARCHAR(50) NOT NULL,
    visibility  VARCHAR(20) NOT NULL DEFAULT 'private'
                CHECK (visibility IN ('private', 'department', 'public')),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- WHY: RLS is disabled by default. The table owner always bypasses RLS
-- Use FORCE ROW LEVEL SECURITY to apply it to owners as well
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

-- ===== Policy design =====

-- Policy 1: Users can perform all operations on documents they own
CREATE POLICY doc_owner_all ON documents
    FOR ALL
    USING (owner_id = current_setting('app.current_user_id')::INTEGER)
    WITH CHECK (owner_id = current_setting('app.current_user_id')::INTEGER);

-- Policy 2: Documents in the same department (visibility='department') can be viewed
CREATE POLICY doc_department_read ON documents
    FOR SELECT
    USING (
        visibility = 'department'
        AND department = current_setting('app.current_department')
    );

-- Policy 3: Public documents can be viewed by everyone
CREATE POLICY doc_public_read ON documents
    FOR SELECT
    USING (visibility = 'public');

-- Policy 4: Admins can perform all operations on all documents
CREATE POLICY doc_admin_all ON documents
    FOR ALL
    TO app_admin
    USING (TRUE)
    WITH CHECK (TRUE);

-- ===== Usage from application =====

-- Application sets session variables per request
-- (usually done in middleware or connection initialization)
SET app.current_user_id = '42';
SET app.current_department = 'engineering';

-- This SELECT automatically returns only rows matching any of:
-- 1. Documents where owner_id = 42
-- 2. department = 'engineering' and visibility = 'department'
-- 3. visibility = 'public'
SELECT * FROM documents;

-- ===== Multi-tenant RLS =====

CREATE TABLE tenant_orders (
    id          SERIAL PRIMARY KEY,
    tenant_id   INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    total       DECIMAL(12, 2) NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tenant_orders ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY tenant_isolation ON tenant_orders
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::INTEGER)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::INTEGER);

-- Index (directly affects RLS performance)
CREATE INDEX idx_tenant_orders_tenant ON tenant_orders (tenant_id);

-- WHY index on tenant_id?
-- RLS automatically adds WHERE tenant_id = ... to every query
-- Without an index, a full table scan is required, degrading performance

-- ===== Verifying RLS behavior =====

-- List all policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'documents';

-- Verify the policy is applied using EXPLAIN ANALYZE
SET app.current_user_id = '42';
EXPLAIN ANALYZE SELECT * FROM documents;
-- → Filter: (owner_id = 42) should be added
```

---

## 3. SQL Injection

### 3.1 Deep Understanding of Attack Principles

```
┌───────── SQL Injection Principles ──────────────────────┐
│                                                           │
│  ■ Root cause: Directly concatenating user input into    │
│    an SQL string                                          │
│    → "Data" is interpreted as "code"                     │
│                                                           │
│  ■ Normal query:                                          │
│  query = "SELECT * FROM users WHERE email = '" + input    │
│  input = "tanaka@example.com"                             │
│  → SELECT * FROM users WHERE email = 'tanaka@example.com' │
│                                                           │
│  ■ Attack 1: Authentication bypass                        │
│  input = "' OR '1'='1"                                    │
│  → SELECT * FROM users WHERE email = '' OR '1'='1'        │
│  → All rows are returned (always TRUE)                    │
│                                                           │
│  ■ Attack 2: Data destruction                             │
│  input = "'; DROP TABLE users; --"                        │
│  → SELECT * FROM users WHERE email = '';                  │
│    DROP TABLE users; --'                                   │
│  → The table is deleted!                                  │
│                                                           │
│  ■ Attack 3: Data theft (UNION-based)                     │
│  input = "' UNION SELECT username, password FROM          │
│           admin_users --"                                  │
│  → Admin passwords are retrieved                          │
│                                                           │
│  ■ Attack 4: Blind SQLi (time-based)                      │
│  input = "' AND (SELECT pg_sleep(5)) IS NOT NULL --"      │
│  → Response delays by 5 seconds → confirms vulnerability  │
│                                                           │
│  ■ Attack 5: Second-order SQL injection                   │
│  → Register "admin'--" as a username                      │
│  → During password reset:                                 │
│    UPDATE users SET pass='...' WHERE name='admin'--'      │
│  → The admin's password is changed                        │
│                                                           │
│  ■ Fundamental countermeasure:                            │
│  Parameterized queries (prepared statements)              │
│  → User input is treated only as data,                   │
│    never interpreted as SQL syntax                        │
│  → The structure of the SQL statement is fixed            │
│    and does not change based on input values              │
└───────────────────────────────────────────────────────────┘
```

### Code Example 3: Complete SQL Injection Defense

```sql
-- ===== Parameterized queries in each language =====

-- ■ PostgreSQL prepared statements (direct SQL)
PREPARE find_user_by_email (TEXT) AS
    SELECT id, name, email FROM users WHERE email = $1;

EXECUTE find_user_by_email('user@example.com');
DEALLOCATE find_user_by_email;

-- WHY do prepared statements provide defense?
-- 1. The SQL structure (parse tree) is determined at PREPARE time
-- 2. Parameters at EXECUTE time are bound only as "values"
-- 3. ' and ; inside parameters are not interpreted as SQL syntax
-- 4. That is, "data" and "code" are completely separated
```

```python
# ■ Python (psycopg2) — correct parameter binding

import psycopg2

conn = psycopg2.connect("dbname=myapp user=app_user")
cur = conn.cursor()

# NG: string formatting (SQL injection vulnerability!)
# user_input = "'; DROP TABLE users; --"
# cur.execute(f"SELECT * FROM users WHERE email = '{user_input}'")
# → SELECT * FROM users WHERE email = ''; DROP TABLE users; --'

# OK: parameter binding (%s placeholder)
user_input = "user@example.com"
cur.execute("SELECT * FROM users WHERE email = %s", (user_input,))
# → psycopg2 performs escaping and binds safely

# OK: named parameters
cur.execute(
    "SELECT * FROM users WHERE email = %(email)s AND status = %(status)s",
    {"email": user_input, "status": "active"}
)

# NG: building the string manually without using execute's arguments is also NG
# cur.execute("SELECT * FROM users WHERE email = '%s'" % user_input)

# Safe handling of IN clause (psycopg2 tuple support)
user_ids = [1, 2, 3, 4, 5]
cur.execute("SELECT * FROM users WHERE id = ANY(%s)", (user_ids,))

conn.close()
```

```typescript
// ■ Node.js (pg) — parameterized queries

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgres://app_user:pass@localhost:5432/myapp',
});

// NG: template literals (SQL injection vulnerability!)
// const result = await pool.query(
//   `SELECT * FROM users WHERE email = '${userInput}'`
// );

// OK: parameterized query ($1, $2, ... placeholders)
const userInput = 'user@example.com';
const result = await pool.query(
  'SELECT * FROM users WHERE email = $1 AND status = $2',
  [userInput, 'active']
);

// OK: safe handling of IN clause
const userIds = [1, 2, 3, 4, 5];
const inResult = await pool.query(
  'SELECT * FROM users WHERE id = ANY($1::int[])',
  [userIds]
);

// NG: dynamic table names and column names cannot be parameterized
// → validate with a whitelist
const allowedColumns = ['name', 'email', 'department'];
const sortColumn = allowedColumns.includes(userColumn) ? userColumn : 'name';
const sortResult = await pool.query(
  `SELECT * FROM users ORDER BY ${sortColumn} LIMIT $1`,
  [10]
);
```

```go
// ■ Go (database/sql) — parameterized queries

package main

import (
    "database/sql"
    "fmt"
    _ "github.com/lib/pq"
)

func findUserByEmail(db *sql.DB, email string) (*User, error) {
    // OK: parameter binding with $1 placeholder
    var user User
    err := db.QueryRow(
        "SELECT id, name, email FROM users WHERE email = $1",
        email,
    ).Scan(&user.ID, &user.Name, &user.Email)
    if err != nil {
        return nil, fmt.Errorf("findUserByEmail: %w", err)
    }
    return &user, nil
}

// NG: building queries with fmt.Sprintf is NG
// query := fmt.Sprintf("SELECT * FROM users WHERE email = '%s'", email)
// db.Query(query)
```

```sql
-- ===== Escaping when dynamic SQL is necessary (PL/pgSQL) =====

-- Table names and column names cannot use $1 parameters,
-- so dynamic SQL may be required. Use the following functions in those cases.

-- quote_ident: escape identifiers (table names, column names)
-- quote_literal: escape literal values
-- format('%I', ...): escape identifiers
-- format('%L', ...): escape literal values

-- Method 1: quote_ident + quote_literal
CREATE OR REPLACE FUNCTION search_by_column(
    p_table TEXT,
    p_column TEXT,
    p_value TEXT
) RETURNS SETOF RECORD AS $$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT * FROM ' || quote_ident(p_table)
        || ' WHERE ' || quote_ident(p_column)
        || ' = ' || quote_literal(p_value);
END;
$$ LANGUAGE plpgsql;

-- Method 2: format() function (recommended, more readable)
CREATE OR REPLACE FUNCTION search_by_column_v2(
    p_table TEXT,
    p_column TEXT,
    p_value TEXT
) RETURNS SETOF RECORD AS $$
BEGIN
    -- %I = identifier (automatically escaped with double quotes)
    -- %L = literal value (automatically escaped with single quotes)
    -- %s = string as-is (no escaping, use with caution)
    RETURN QUERY EXECUTE format(
        'SELECT * FROM %I WHERE %I = %L',
        p_table, p_column, p_value
    );
END;
$$ LANGUAGE plpgsql;

-- Method 3: Bind parameters using the USING clause (safest)
CREATE OR REPLACE FUNCTION search_by_column_v3(
    p_table TEXT,
    p_column TEXT,
    p_value TEXT
) RETURNS SETOF RECORD AS $$
BEGIN
    RETURN QUERY EXECUTE format(
        'SELECT * FROM %I WHERE %I = $1',
        p_table, p_column
    ) USING p_value;  -- bind p_value to $1
END;
$$ LANGUAGE plpgsql;

-- ===== Whitelist validation for table names and column names =====
CREATE OR REPLACE FUNCTION safe_search(
    p_table TEXT,
    p_column TEXT,
    p_value TEXT
) RETURNS SETOF RECORD AS $$
DECLARE
    allowed_tables TEXT[] := ARRAY['users', 'products', 'orders'];
    allowed_columns TEXT[] := ARRAY['name', 'email', 'status'];
BEGIN
    -- Whitelist validation
    IF NOT (p_table = ANY(allowed_tables)) THEN
        RAISE EXCEPTION 'Invalid table name: %', p_table;
    END IF;
    IF NOT (p_column = ANY(allowed_columns)) THEN
        RAISE EXCEPTION 'Invalid column name: %', p_column;
    END IF;

    RETURN QUERY EXECUTE format(
        'SELECT * FROM %I WHERE %I = $1', p_table, p_column
    ) USING p_value;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. Encryption

### 4.1 Three Layers of Encryption

```
┌──────── Three Layers of Encryption ────────────────────┐
│                                                        │
│  1. Encryption in Transit                              │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Client ←── TLS 1.3 ──→ PostgreSQL                │ │
│  │ • Server certificate + optional client cert      │ │
│  │ • Allow only hostssl in pg_hba.conf              │ │
│  │ • Use sslmode=verify-full to prevent MITM        │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  2. Encryption at Rest — Column-level                  │
│  ┌──────────────────────────────────────────────────┐ │
│  │ pgcrypto extension: pgp_sym_encrypt /            │ │
│  │   pgp_sym_decrypt                                │ │
│  │ • Encrypt sensitive columns individually         │ │
│  │   (SSN, card numbers, etc.)                      │ │
│  │ • Encrypting at the application layer is more    │ │
│  │   secure (no key handed to DB)                   │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  3. Encryption at Rest — Disk-level                    │
│  ┌──────────────────────────────────────────────────┐ │
│  │ • AWS: EBS Encryption / RDS Encryption           │ │
│  │ • Linux: LUKS (dm-crypt)                         │ │
│  │ • PostgreSQL: pgcrypto + pg_tde                  │ │
│  │   (transparent encryption)                       │ │
│  │ • Data is unreadable even if disk is stolen      │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  WHY are all 3 layers necessary?                       │
│  • No TLS → passwords/data leaked via eavesdropping   │
│  • No column encryption → sensitive data exposed      │
│    if DB backup leaks                                  │
│  • No disk encryption → data exposed if physical disk │
│    is stolen                                           │
└────────────────────────────────────────────────────────┘
```

### Code Example 4: Implementing Encryption

```sql
-- ===== Enable pgcrypto extension =====
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===== Password hashing =====

-- WHY bcrypt?
-- 1. Automatically generates a salt (prevents rainbow table attacks)
-- 2. Cost parameter allows adjusting computation (brute force resistance)
-- 3. Intentionally slow (resistance to GPU-parallel attacks)
-- Cost 12 → ~250ms per hash (current recommended value)

-- User table
CREATE TABLE secure_users (
    id            SERIAL PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(60) NOT NULL,  -- bcrypt hash is always 60 characters
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Register password
INSERT INTO secure_users (email, password_hash) VALUES (
    'user@example.com',
    crypt('user_password_2024!', gen_salt('bf', 12))
    --                          ~~~~~~~~  ~~  ~~
    --                          algorithm |   cost
    --                          (bf=bcrypt)|
    --                                     12 (2^12=4096 iterations)
);

-- Verify password
SELECT id, email FROM secure_users
WHERE email = 'user@example.com'
  AND password_hash = crypt('user_password_2024!', password_hash);
  --                        ~~~~~~~~~~~~~~~~~~~   ~~~~~~~~~~~~~~
  --                        input password        extract salt from stored hash
-- → returns a row on match, NULL on mismatch

-- ===== Column-level encryption (AES-256) =====

-- Sensitive data table
CREATE TABLE sensitive_data (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES secure_users(id),
    -- Encrypted data (stored as BYTEA type)
    ssn_encrypted    BYTEA,
    card_encrypted   BYTEA,
    -- Metadata (no encryption needed)
    data_type        VARCHAR(20) NOT NULL,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Encrypt and store
-- Key should be retrieved from an environment variable or key management service (AWS KMS, etc.)
INSERT INTO sensitive_data (user_id, ssn_encrypted, data_type) VALUES (
    1,
    pgp_sym_encrypt('123-45-6789', current_setting('app.encryption_key')),
    'ssn'
);

-- Decrypt and retrieve
SELECT
    user_id,
    pgp_sym_decrypt(ssn_encrypted, current_setting('app.encryption_key')) AS ssn
FROM sensitive_data
WHERE user_id = 1;

-- WHY is application-layer encryption more secure?
-- DB-layer encryption: the encryption key is included in SQL or session variables
--   → may be recorded in query logs
--   → privileged DB users can decrypt
-- App-layer encryption: key exists only in application memory
--   → only encrypted binary is stored in DB
--   → data cannot be decrypted without the key even if DB is leaked
```

### Code Example 5: TLS Configuration and Connection Security

```sql
-- ===== TLS configuration in postgresql.conf =====
-- ssl = on
-- ssl_cert_file = '/etc/ssl/certs/server.crt'
-- ssl_key_file = '/etc/ssl/private/server.key'
-- ssl_ca_file = '/etc/ssl/certs/ca.crt'           -- for client certificate verification
-- ssl_min_protocol_version = 'TLSv1.3'            -- enforce TLS 1.3 or higher
-- ssl_ciphers = 'HIGH:!aNULL:!MD5:!3DES:!RC4'     -- strong cipher suites only

-- Enforce SSL connections in pg_hba.conf
-- hostssl  all  all  0.0.0.0/0  scram-sha-256
-- hostnossl all  all  0.0.0.0/0  reject   -- reject all non-SSL connections

-- ===== Verify TLS connections =====
SELECT
    datname AS database,
    usename AS user,
    client_addr,
    ssl,
    ssl_version,
    ssl_cipher
FROM pg_stat_ssl
    JOIN pg_stat_activity USING (pid)
WHERE pid != pg_backend_pid();

-- Check for non-SSL connections
SELECT COUNT(*) AS non_ssl_connections
FROM pg_stat_ssl
    JOIN pg_stat_activity USING (pid)
WHERE NOT ssl AND usename != 'postgres';

-- ===== Specifying in application connection strings =====
-- Python:
-- postgresql://user:pass@host:5432/db?sslmode=verify-full&sslrootcert=/path/ca.crt
--
-- sslmode options:
-- disable      → No SSL (NG)
-- allow        → Tries SSL but OK without it (NG)
-- prefer       → Prefers SSL but OK without it (insufficient)
-- require      → Forces SSL but does not verify cert (vulnerable to MITM)
-- verify-ca    → SSL + verify CA certificate (recommended minimum)
-- verify-full  → SSL + verify CA + verify hostname (recommended)
```

---

## 5. Audit Logs

### Code Example 6: Trigger-based Audit Logging

```sql
-- ===== Audit log table =====
CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    table_name  VARCHAR(100) NOT NULL,
    record_id   TEXT,                    -- ID of the changed record
    operation   VARCHAR(10) NOT NULL     -- INSERT, UPDATE, DELETE
                CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data    JSONB,                   -- data before change (UPDATE, DELETE only)
    new_data    JSONB,                   -- data after change (INSERT, UPDATE only)
    changed_fields TEXT[],               -- field names changed in UPDATE
    changed_by  VARCHAR(100) NOT NULL DEFAULT current_user,
    app_user_id INTEGER,                 -- application-level user ID
    client_ip   INET DEFAULT inet_client_addr(),
    session_id  TEXT,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partitioning (monthly partitions make managing old audit logs easier)
-- CREATE TABLE audit_log (...) PARTITION BY RANGE (changed_at);
-- CREATE TABLE audit_log_2024_01 PARTITION OF audit_log
--     FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Indexes
CREATE INDEX idx_audit_log_table_op ON audit_log (table_name, operation);
CREATE INDEX idx_audit_log_changed_at ON audit_log (changed_at);
CREATE INDEX idx_audit_log_record_id ON audit_log (table_name, record_id);
CREATE INDEX idx_audit_log_app_user ON audit_log (app_user_id);

-- ===== Generic audit trigger function =====
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    record_pk TEXT;
    changed TEXT[] := '{}';
    old_json JSONB;
    new_json JSONB;
    col TEXT;
BEGIN
    -- Retrieve the record ID (assumes primary key column is named 'id')
    IF TG_OP = 'DELETE' THEN
        record_pk := OLD.id::TEXT;
        old_json := to_jsonb(OLD);
    ELSIF TG_OP = 'INSERT' THEN
        record_pk := NEW.id::TEXT;
        new_json := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        record_pk := NEW.id::TEXT;
        old_json := to_jsonb(OLD);
        new_json := to_jsonb(NEW);

        -- Identify changed fields
        FOR col IN SELECT key FROM jsonb_each(new_json)
        LOOP
            IF old_json->col IS DISTINCT FROM new_json->col THEN
                changed := array_append(changed, col);
            END IF;
        END LOOP;

        -- Skip if no changes (e.g., only updated_at was updated)
        IF array_length(changed, 1) IS NULL OR
           changed = ARRAY['updated_at'] THEN
            RETURN NEW;
        END IF;
    END IF;

    INSERT INTO audit_log (
        table_name, record_id, operation,
        old_data, new_data, changed_fields,
        app_user_id, session_id
    ) VALUES (
        TG_TABLE_NAME, record_pk, TG_OP,
        old_json, new_json, NULLIF(changed, '{}'),
        NULLIF(current_setting('app.current_user_id', true), '')::INTEGER,
        current_setting('app.session_id', true)
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ===== Set up triggers on audit target tables =====
CREATE TRIGGER audit_users
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_orders
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ===== Querying audit logs =====

-- Full change history for a specific user
SELECT
    changed_at,
    table_name,
    operation,
    changed_fields,
    old_data,
    new_data
FROM audit_log
WHERE app_user_id = 42
ORDER BY changed_at DESC
LIMIT 20;

-- Change history for a specific record (timeline)
SELECT
    changed_at,
    operation,
    changed_fields,
    CASE operation
        WHEN 'INSERT' THEN new_data
        WHEN 'DELETE' THEN old_data
        WHEN 'UPDATE' THEN jsonb_build_object(
            'before', jsonb_object_agg(f.key, old_data->f.key),
            'after',  jsonb_object_agg(f.key, new_data->f.key)
        )
    END AS changes,
    changed_by
FROM audit_log
LEFT JOIN LATERAL unnest(changed_fields) AS f(key) ON operation = 'UPDATE'
WHERE table_name = 'users' AND record_id = '42'
GROUP BY changed_at, operation, changed_fields, old_data, new_data, changed_by
ORDER BY changed_at;

-- ===== pgAudit (more advanced auditing) =====
-- The pgAudit extension provides detailed SQL-level audit logging
-- CREATE EXTENSION IF NOT EXISTS pgaudit;
--
-- -- Configuration in postgresql.conf
-- pgaudit.log = 'ddl, write, role'  -- record DDL, writes, role changes
-- pgaudit.log_catalog = off         -- exclude access to system catalogs
-- pgaudit.role = 'auditor'          -- role to audit

-- pgAudit sample output:
-- AUDIT: SESSION,1,1,DDL,CREATE TABLE,,,CREATE TABLE users (...),<not logged>
-- AUDIT: SESSION,2,1,WRITE,INSERT,TABLE,public.users,INSERT INTO users ...
```

### Code Example 7: Security Views and Monitoring

```sql
-- ===== Views for a security dashboard =====

-- 1. Current active connections list
CREATE VIEW v_active_connections AS
SELECT
    pid,
    usename,
    datname,
    client_addr,
    application_name,
    state,
    backend_start,
    NOW() - backend_start AS connection_duration,
    ssl,
    query_start,
    CASE WHEN state = 'active' THEN query ELSE NULL END AS current_query
FROM pg_stat_activity
WHERE pid != pg_backend_pid()
ORDER BY backend_start;

-- 2. Monitor failed login attempts
-- Set log_connections = on, log_disconnections = on in postgresql.conf
-- Monitor log files for: FATAL: password authentication failed

-- 3. Detect long-running queries
CREATE VIEW v_long_running_queries AS
SELECT
    pid,
    usename,
    datname,
    NOW() - query_start AS duration,
    state,
    LEFT(query, 200) AS query_preview
FROM pg_stat_activity
WHERE state = 'active'
  AND NOW() - query_start > interval '30 seconds'
  AND pid != pg_backend_pid()
ORDER BY duration DESC;

-- 4. Detect lock contention
CREATE VIEW v_lock_contention AS
SELECT
    blocked.pid AS blocked_pid,
    blocked.usename AS blocked_user,
    LEFT(blocked.query, 100) AS blocked_query,
    blocking.pid AS blocking_pid,
    blocking.usename AS blocking_user,
    LEFT(blocking.query, 100) AS blocking_query,
    NOW() - blocked.query_start AS wait_duration
FROM pg_stat_activity blocked
JOIN pg_locks bl ON bl.pid = blocked.pid AND NOT bl.granted
JOIN pg_locks gl ON gl.pid != blocked.pid
    AND gl.transactionid = bl.transactionid AND gl.granted
JOIN pg_stat_activity blocking ON blocking.pid = gl.pid;

-- 5. Detect superuser connections
SELECT usename, client_addr, backend_start
FROM pg_stat_activity
WHERE usename = 'postgres'
  AND client_addr IS NOT NULL;  -- remote postgres connections warrant attention
```

---

## Authentication Method Comparison

| Method | Security | Ease of Setup | Password Transmission | Use Case | Recommended |
|--------|:---:|:---:|:---:|------|:---:|
| trust | Lowest (no auth) | Easiest | None | Local dev only | Dev only |
| password (plaintext) | Low | Easy | Plaintext | Prohibited | NG |
| md5 | Medium (deprecated) | Easy | MD5 hash | Legacy compat only | Not recommended |
| scram-sha-256 | High | Easy | Challenge-response | General password auth | Recommended |
| peer / ident | High | Medium | None (OS auth) | Local Unix connections | Recommended for local |
| cert (mTLS) | Highest | Complex | None (certificate) | TLS client certificates | Highest recommendation |
| ldap | High | Complex | Via LDAP | Enterprise AD/LDAP integration | Recommended for enterprise |
| gss (Kerberos) | Highest | Most complex | None (ticket) | Enterprise SSO | Recommended for large scale |
| radius | High | Complex | Via RADIUS | Two-factor auth integration | Depends on use case |

## Privilege Level Comparison

| Level | Target | Configuration Method | Granularity | Example |
|-------|--------|---------------------|-------------|---------|
| Cluster | Entire PostgreSQL | CREATE ROLE + attributes | Coarsest | SUPERUSER, CREATEDB, CREATEROLE |
| Database | Specific DB | GRANT CONNECT | Per DB | Allow connection to specific DB |
| Schema | Namespace | GRANT USAGE/CREATE | Per schema | Access objects within schema |
| Table | Individual table | GRANT SELECT/INSERT/... | Per table | Allow CRUD operations |
| Column | Individual column | GRANT SELECT(col) | Per column | Allow access to specific columns only |
| Row | Individual record | CREATE POLICY (RLS) | Per row | Multi-tenant isolation |

## SQL Injection Defense Method Comparison

| Defense Method | Defense Effect | Application | Notes |
|---------------|:---:|------------|-------|
| Parameterized queries | Complete | Value binding | Cannot be used for table/column names |
| quote_ident / format(%I) | Complete | Dynamic table/column names | Recommended combined with whitelist validation |
| quote_literal / format(%L) | Complete | Dynamic literal values | Only when parameterized queries are not available |
| Whitelist validation | Complete | Dynamic identifiers | Requires maintenance of the allowlist |
| Escape functions | High | Legacy code | Not recommended due to risk of omissions |
| ORM API only | High | General CRUD | Be careful when using raw SQL |
| WAF | Supplementary | Outer defense layer | Insufficient alone; bypass techniques exist |

---

## Anti-patterns

### Anti-pattern 1: Connecting to Applications as Superuser

```sql
-- NG: all applications connect as the postgres user (superuser)
-- Connection string: postgres://postgres:password@db:5432/myapp

-- Problems:
-- 1. Read/write/delete on all tables is possible
-- 2. DROP DATABASE can also be executed
-- 3. System catalog modifications are possible
-- 4. RLS is bypassed (superuser bypasses RLS)
-- 5. Damage is maximized on SQL injection
-- 6. Difficult to identify who performed an operation in audit logs

-- OK: role design based on the Principle of Least Privilege
CREATE ROLE web_app LOGIN PASSWORD 'secure_password_here'
    CONNECTION LIMIT 30     -- connection limit
    NOSUPERUSER             -- explicitly deny superuser privilege
    NOCREATEDB              -- no DB creation privilege
    NOCREATEROLE;           -- no role creation privilege

-- Grant only the minimum necessary privileges
GRANT SELECT, INSERT, UPDATE ON customers, orders, order_items TO web_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO web_app;
-- Do not grant DELETE → use logical deletion (deleted_at column)
-- Do not grant DDL (CREATE TABLE, etc.) → set up a separate role for migrations
```

### Anti-pattern 2: Storing Sensitive Data in Plaintext

```sql
-- NG (Level 1): store passwords in plaintext
CREATE TABLE bad_users_v1 (
    id       SERIAL PRIMARY KEY,
    email    VARCHAR(255),
    password VARCHAR(255)  -- stored as plaintext!
);
-- → Anyone who can access the database can read passwords
-- → Also readable from backup files

-- NG (Level 2): hash with MD5 (vulnerable)
INSERT INTO users (email, password_hash) VALUES
('user@example.com', md5('password123'));
-- → md5('password123') = '482c811da5d5b4bc6d497ffa98491e38'
-- → Can be cracked instantly with rainbow tables
-- → Without salt, same password always produces the same hash

-- NG (Level 3): hash with SHA-256 (no salt)
INSERT INTO users (email, password_hash) VALUES
('user@example.com', encode(digest('password123', 'sha256'), 'hex'));
-- → Without salt, same password always produces the same hash
-- → Can be brute-forced quickly with GPUs

-- OK: hash with bcrypt (auto-generated salt, intentionally slow)
INSERT INTO users (email, password_hash) VALUES
('user@example.com', crypt('password123', gen_salt('bf', 12)));
-- → Salt is generated automatically
-- → Cost 12 → ~250ms/hash → brute force is impractical
-- → Even the same password produces a different hash each time
```

### Anti-pattern 3: Multi-tenant Without RLS Policies

```sql
-- NG: tenant isolation only at the application layer
-- Manually adding WHERE tenant_id = ? to every query in the app

-- Problems:
-- 1. Omitting WHERE clause in even one place causes a data leak
-- 2. Cannot be controlled from tools with direct DB access (psql, etc.)
-- 3. ORM relation loading may miss the filter

-- OK: guarantee database-level tenant isolation with RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON orders
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::INTEGER)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::INTEGER);

-- → No matter what query is run, only the current tenant's data is visible
-- → RLS is applied even with a direct SELECT from psql
-- → WITH CHECK also prevents inserting data for another tenant
```

---

## Practice Exercises

### Exercise 1 (Basic): Role and Privilege Design

**Task**: Implement a role and privilege design that meets the following requirements.

- `api_service`: For the web app. CRUD on customers, orders, products tables (excluding DELETE)
- `analytics_user`: For analytics. SELECT only on all tables. Exclude the salary column
- `migration_runner`: For migrations. DDL operations allowed
- Set connection limits for each role

<details>
<summary>Model Answer</summary>

```sql
-- Create roles
CREATE ROLE api_service
    LOGIN PASSWORD 'api_service_secure_2024!'
    CONNECTION LIMIT 30
    NOSUPERUSER NOCREATEDB NOCREATEROLE;

CREATE ROLE analytics_user
    LOGIN PASSWORD 'analytics_secure_2024!'
    CONNECTION LIMIT 10
    NOSUPERUSER NOCREATEDB NOCREATEROLE;

CREATE ROLE migration_runner
    LOGIN PASSWORD 'migration_secure_2024!'
    CONNECTION LIMIT 3
    NOSUPERUSER CREATEDB NOCREATEROLE;

-- Schema privileges
GRANT USAGE ON SCHEMA public TO api_service, analytics_user;
GRANT USAGE, CREATE ON SCHEMA public TO migration_runner;

-- api_service: SELECT, INSERT, UPDATE (no DELETE)
GRANT SELECT, INSERT, UPDATE ON customers, orders, products TO api_service;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO api_service;

-- analytics_user: SELECT only (exclude salary column)
GRANT SELECT ON orders, products TO analytics_user;
-- Grant customers table excluding salary column
GRANT SELECT (id, name, email, department, created_at) ON customers
    TO analytics_user;

-- migration_runner: DDL operations
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO migration_runner;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO migration_runner;

-- Default privileges (also applies to future tables)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE ON TABLES TO api_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO analytics_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE ON SEQUENCES TO api_service;

-- Verify
SELECT grantee, table_name, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
    AND grantee IN ('api_service', 'analytics_user', 'migration_runner')
ORDER BY grantee, table_name, privilege_type;
```

</details>

### Exercise 2 (Intermediate): Multi-tenant RLS Implementation

**Task**: Assuming a SaaS project management tool, implement RLS that meets the following requirements.

- Tenant isolation: data from different tenants is completely inaccessible
- Role control: three roles within a tenant — admin/member/viewer
- admin: all operations allowed
- member: CRUD on tasks they created + view other tasks
- viewer: view only

<details>
<summary>Model Answer</summary>

```sql
-- Table definition
CREATE TABLE tenant_users (
    id          SERIAL PRIMARY KEY,
    tenant_id   INTEGER NOT NULL,
    name        VARCHAR(100) NOT NULL,
    role        VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
    UNIQUE (tenant_id, id)
);

CREATE TABLE tasks (
    id          SERIAL PRIMARY KEY,
    tenant_id   INTEGER NOT NULL,
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    status      VARCHAR(20) DEFAULT 'open',
    creator_id  INTEGER NOT NULL,
    assignee_id INTEGER,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;

-- Helper functions to retrieve session variables
CREATE OR REPLACE FUNCTION get_current_tenant_id() RETURNS INTEGER AS $$
BEGIN
    RETURN current_setting('app.tenant_id')::INTEGER;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_current_user_id() RETURNS INTEGER AS $$
BEGIN
    RETURN current_setting('app.current_user_id')::INTEGER;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_current_user_role() RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('app.user_role');
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Policy 1: tenant isolation (applies to all roles)
CREATE POLICY tenant_isolation ON tasks
    FOR ALL
    USING (tenant_id = get_current_tenant_id());

-- Policy 2: admin can perform all operations
CREATE POLICY admin_all ON tasks
    FOR ALL
    USING (
        tenant_id = get_current_tenant_id()
        AND get_current_user_role() = 'admin'
    )
    WITH CHECK (
        tenant_id = get_current_tenant_id()
        AND get_current_user_role() = 'admin'
    );

-- Policy 3: member can view all tasks
CREATE POLICY member_select ON tasks
    FOR SELECT
    USING (
        tenant_id = get_current_tenant_id()
        AND get_current_user_role() = 'member'
    );

-- Policy 4: member can CUD only their own tasks
CREATE POLICY member_modify ON tasks
    FOR ALL
    USING (
        tenant_id = get_current_tenant_id()
        AND get_current_user_role() = 'member'
        AND creator_id = get_current_user_id()
    )
    WITH CHECK (
        tenant_id = get_current_tenant_id()
        AND get_current_user_role() = 'member'
        AND creator_id = get_current_user_id()
    );

-- Policy 5: viewer can only view
CREATE POLICY viewer_select ON tasks
    FOR SELECT
    USING (
        tenant_id = get_current_tenant_id()
        AND get_current_user_role() = 'viewer'
    );

-- Indexes
CREATE INDEX idx_tasks_tenant ON tasks (tenant_id);
CREATE INDEX idx_tasks_creator ON tasks (tenant_id, creator_id);

-- Test
SET app.tenant_id = '1';
SET app.current_user_id = '10';
SET app.user_role = 'member';
SELECT * FROM tasks;  -- shows only tenant 1 tasks
```

</details>

### Exercise 3 (Advanced): Comprehensive Security Audit System

**Task**: Design and implement a comprehensive security audit system that meets the following requirements.

- Record all CRUD operations on target tables to the audit log
- Record before/after for each changed field
- Record application user ID and IP address
- Views to detect suspicious operation patterns (e.g., mass DELETE in a short time)
- Monthly partitioning of the audit log

<details>
<summary>Model Answer</summary>

```sql
-- Audit log table (with partitioning support)
CREATE TABLE security_audit_log (
    id              BIGSERIAL,
    table_name      VARCHAR(100) NOT NULL,
    record_id       TEXT,
    operation       VARCHAR(10) NOT NULL,
    old_data        JSONB,
    new_data        JSONB,
    changed_fields  TEXT[],
    db_user         VARCHAR(100) DEFAULT current_user,
    app_user_id     INTEGER,
    client_ip       INET DEFAULT inet_client_addr(),
    user_agent      TEXT,
    session_id      TEXT,
    risk_level      VARCHAR(10) DEFAULT 'normal'
                    CHECK (risk_level IN ('normal', 'elevated', 'critical')),
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- Create monthly partitions
CREATE TABLE security_audit_log_2024_01 PARTITION OF security_audit_log
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE security_audit_log_2024_02 PARTITION OF security_audit_log
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
-- ... and so on

-- Indexes
CREATE INDEX idx_sal_table_op ON security_audit_log (table_name, operation);
CREATE INDEX idx_sal_occurred ON security_audit_log (occurred_at);
CREATE INDEX idx_sal_app_user ON security_audit_log (app_user_id);
CREATE INDEX idx_sal_risk ON security_audit_log (risk_level) WHERE risk_level != 'normal';

-- Audit trigger function (with automatic risk level determination)
CREATE OR REPLACE FUNCTION security_audit_func()
RETURNS TRIGGER AS $$
DECLARE
    v_record_pk TEXT;
    v_changed TEXT[] := '{}';
    v_old_json JSONB;
    v_new_json JSONB;
    v_risk VARCHAR(10) := 'normal';
    col TEXT;
BEGIN
    -- Determine risk level
    IF TG_OP = 'DELETE' THEN
        v_record_pk := OLD.id::TEXT;
        v_old_json := to_jsonb(OLD);
        v_risk := 'elevated';  -- DELETE is always elevated
    ELSIF TG_OP = 'INSERT' THEN
        v_record_pk := NEW.id::TEXT;
        v_new_json := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_record_pk := NEW.id::TEXT;
        v_old_json := to_jsonb(OLD);
        v_new_json := to_jsonb(NEW);

        FOR col IN SELECT key FROM jsonb_each(v_new_json)
        LOOP
            IF v_old_json->col IS DISTINCT FROM v_new_json->col THEN
                v_changed := array_append(v_changed, col);
            END IF;
        END LOOP;

        -- Changes to sensitive fields are elevated
        IF v_changed && ARRAY['password_hash', 'email', 'role', 'status'] THEN
            v_risk := 'elevated';
        END IF;
    END IF;

    INSERT INTO security_audit_log (
        table_name, record_id, operation,
        old_data, new_data, changed_fields,
        app_user_id, session_id, risk_level
    ) VALUES (
        TG_TABLE_NAME, v_record_pk, TG_OP,
        v_old_json, v_new_json, NULLIF(v_changed, '{}'),
        NULLIF(current_setting('app.current_user_id', true), '')::INTEGER,
        current_setting('app.session_id', true),
        v_risk
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- View for detecting suspicious operation patterns
CREATE VIEW v_suspicious_activities AS
SELECT
    app_user_id,
    table_name,
    operation,
    COUNT(*) AS operation_count,
    MIN(occurred_at) AS first_at,
    MAX(occurred_at) AS last_at,
    'HIGH_FREQUENCY_DELETE' AS alert_type
FROM security_audit_log
WHERE operation = 'DELETE'
  AND occurred_at >= NOW() - INTERVAL '5 minutes'
GROUP BY app_user_id, table_name, operation
HAVING COUNT(*) > 10

UNION ALL

SELECT
    app_user_id,
    table_name,
    operation,
    COUNT(*),
    MIN(occurred_at),
    MAX(occurred_at),
    'ELEVATED_RISK_BURST'
FROM security_audit_log
WHERE risk_level IN ('elevated', 'critical')
  AND occurred_at >= NOW() - INTERVAL '1 hour'
GROUP BY app_user_id, table_name, operation
HAVING COUNT(*) > 5;
```

</details>

---

## FAQ

### Q1: Does RLS (Row Level Security) affect performance?

RLS policies are added as WHERE conditions to each query, so with proper indexes, the overhead is minimal (typically less than 1-5%). However, care is needed in the following cases:

- Complex policies (containing subqueries): Policies with JOINs or subqueries can complicate the execution plan
- Many policies: Having 10 or more policies on the same table can slow things down due to increased OR conditions
- Frequent calls to current_setting(): When using current_setting() in policies, wrapping it in a STABLE function makes it easier for the planner to optimize

Use EXPLAIN ANALYZE to verify the execution plan and confirm that indexes are used for the policy filter conditions.

### Q2: Should database backups also be encrypted?

Mandatory. Backup files contain all data, so they require the same or higher level of security as production.

- pg_dump output: Encrypt with GPG or store in encrypted storage
- WAL archives: Enable Server-Side Encryption (SSE) when sending via aws s3 cp or gsutil cp
- Cloud backups: AWS RDS automatically encrypts with AES-256 (enabled by default)
- Backup transfer: Always use TLS (scp/sftp). FTP or rsync without SSH is strictly prohibited

### Q3: What injection attacks exist beyond SQL injection?

- **OS Command Injection**: Abuse of PostgreSQL's `COPY FROM PROGRAM` command. Allows executing arbitrary OS commands with superuser privileges
- **LDAP Injection**: Attacks against filter expressions when LDAP authentication is configured
- **NoSQL Injection**: Attacks on MongoDB's `$where` clause or JavaScript injection
- **ORM-based injection**: SQL injection can occur when using raw SQL features or dynamic filters improperly
- **Second-order injection**: Injection occurs when data previously stored in the DB is used in another query

Even when using an ORM, always use parameter binding when calling raw SQL methods (Prisma's `$queryRaw`, SQLAlchemy's `text()`, etc.). See [ORM Comparison](./03-orm-comparison.md) for details.

### Q4: What are best practices for excluding password_hash from SELECT?

1. **Column-level privilege**: `REVOKE SELECT(password_hash) ON users FROM app_readonly;`
2. **Views**: Create a view that does not include password_hash, and have the app access through the view
3. **Application layer**: Explicitly specify columns on SELECT (prohibit `SELECT *`)
4. **RLS**: For operations that do not need password_hash, restrict the entire row with RLS

In ORMs, Prisma's `select` and SQLAlchemy's `defer` can configure deferred column loading.

### Q5: What operations require superuser and cannot be avoided?

- CREATE EXTENSION (installing extensions)
- Reloading changes to pg_hba.conf
- Changing parameters in postgresql.conf
- Granting REPLICATION privilege
- Sending signals (pg_cancel_backend, pg_terminate_backend)
- File system access (COPY TO/FROM file)

These should be performed in CI/CD pipelines or infrastructure automation, and the design should avoid using them for day-to-day application operations.

---

## Summary

| Topic | Key Point |
|-------|-----------|
| Defense in Depth | 6 layers: network → authentication → authorization → input validation → encryption → auditing |
| Principle of Least Privilege | App roles get only the minimum required privileges. SUPERUSER is prohibited |
| pg_hba.conf | Place a `reject` rule at the end. Use scram-sha-256 |
| RLS | Row-level access control. Essential for multi-tenant isolation |
| SQL Injection | 100% prevention with parameterized queries. Use format(%I, %L) for dynamic SQL |
| Passwords | Hash with bcrypt (gen_salt('bf', 12)). MD5/SHA-256 are not acceptable |
| Encryption | TLS communication (verify-full) + column-level encryption + disk encryption + backup encryption |
| Auditing | Record all operations with audit_log table + pgAudit. Monthly partitioning recommended |
| Monitoring | Continuously monitor active connections, long-running queries, and lock contention |

---

## Next Guides to Read

- [00-postgresql-features.md](./00-postgresql-features.md) — Using pgcrypto, pg_trgm, and more
- [02-performance-tuning.md](./02-performance-tuning.md) — Balancing security settings and performance
- [03-orm-comparison.md](./03-orm-comparison.md) — SQL injection countermeasures in ORMs
- Security Overview — The big picture of information security
- OWASP Top 10 — Top 10 web vulnerabilities
- Injection — Injection attacks beyond SQLi
- TLS/Certificates — How TLS works and certificate management
- Password Security — Details of password hashing
- RBAC — Role-based access control

---

## References

1. PostgreSQL Documentation — "Client Authentication" https://www.postgresql.org/docs/current/client-authentication.html
2. PostgreSQL Documentation — "Row Security Policies" https://www.postgresql.org/docs/current/ddl-rowsecurity.html
3. PostgreSQL Documentation — "pgcrypto" https://www.postgresql.org/docs/current/pgcrypto.html
4. OWASP — "SQL Injection Prevention Cheat Sheet" https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
5. OWASP — "Database Security Cheat Sheet" https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html
6. CIS PostgreSQL Benchmark — https://www.cisecurity.org/benchmark/postgresql
7. Riggs, S. & Ciolli, G. (2022). *PostgreSQL 14 Administration Cookbook*. Packt Publishing.

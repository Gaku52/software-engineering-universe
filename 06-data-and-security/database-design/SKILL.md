# Database Design

> A comprehensive collection of practical guides for database design. Covers normalization, schema design, query optimization, performance tuning, and migration strategies -- everything needed to build efficient, scalable databases.

## Target Audience

- Developers who want to design reliable, performant database schemas
- Engineers working on query optimization and performance tuning
- Teams managing database migrations and schema evolution

## Prerequisites

- Basic SQL knowledge (SELECT, INSERT, UPDATE, DELETE)
- Familiarity with at least one relational database (PostgreSQL, MySQL)

## Study Guide

### 01-schema-design -- Database Schema Design

| # | File | Content |
|---|------|---------|
| 01 | [schema-design-complete.md](docs/01-schema-design/schema-design-complete.md) | Normalization, relationships, data types, constraints, indexes |

### 02-query-optimization -- Query Optimization

| # | File | Content |
|---|------|---------|
| 01 | [query-optimization-complete.md](docs/02-query-optimization/query-optimization-complete.md) | EXPLAIN ANALYZE, index optimization, JOIN optimization, N+1 |

### 03-performance -- Performance Optimization

| # | File | Content |
|---|------|---------|
| 01 | [performance-optimization-complete.md](docs/03-performance/performance-optimization-complete.md) | Caching, partitioning, sharding, monitoring |

### 04-migrations -- Database Migrations

| # | File | Content |
|---|------|---------|
| 01 | [migration-complete.md](docs/04-migrations/migration-complete.md) | Prisma, TypeORM, Knex.js, zero-downtime deployments |

### 05-schema-evolution -- Schema Evolution

| # | File | Content |
|---|------|---------|
| 01 | [schema-evolution-complete.md](docs/05-schema-evolution/schema-evolution-complete.md) | Alembic, Flyway, Liquibase, Blue-Green deployments, disaster recovery |

### 06-algorithms -- Algorithms

| # | File | Content |
|---|------|---------|
| 01 | [btree-operations-proof.md](docs/06-algorithms/btree-operations-proof.md) | B-tree operations and correctness proofs |

### 07-checklists -- Checklists

| # | File | Content |
|---|------|---------|
| 01 | [index-design.md](docs/07-checklists/index-design.md) | Index design checklist |
| 02 | [performance-optimization.md](docs/07-checklists/performance-optimization.md) | Performance optimization checklist |

## Quick Reference

```
Database Design Cheat Sheet:

  Normalization:
    1NF  -- eliminate repeating groups
    2NF  -- eliminate partial dependencies
    3NF  -- eliminate transitive dependencies
    BCNF -- every determinant is a candidate key

  Index Types (PostgreSQL):
    B-tree  -- equality, range, ORDER BY (default)
    Hash    -- equality only
    GIN     -- full-text search, JSONB, arrays
    GiST    -- spatial data, range types

  Key Rules:
    - Index columns used in WHERE, JOIN, ORDER BY
    - Use composite indexes with equality columns first
    - Use partial indexes to reduce index size
    - Use covering indexes to avoid table access
    - Avoid indexing low-selectivity columns (flags, booleans)

  Migration Best Practices:
    - Always write a rollback (down migration)
    - Use zero-downtime patterns for production
    - Prefer additive changes (add columns, not drop)
    - Test migrations against a copy of production data
```

## References

1. PostgreSQL Global Development Group. "PostgreSQL Documentation." postgresql.org/docs, 2024.
2. Winand, M. "SQL Performance Explained." use-the-index-luke.com, 2024.
3. Karwin, B. "SQL Antipatterns." Pragmatic Programmers, 2010.
4. Kleppmann, M. "Designing Data-Intensive Applications." O'Reilly, 2017.
